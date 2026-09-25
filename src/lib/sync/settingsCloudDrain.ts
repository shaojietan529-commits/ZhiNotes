"use client";

import {
  applyRemoteAccountModuleSettings,
  applyRemoteWorkspaceSettings,
  buildModuleSettingSyncRowId,
  getPendingAccountModuleSettingSyncLogEntries,
  getPendingWorkspaceSettingSyncLogEntries,
  listAccountSettings,
  listModuleSettings,
  listWorkspaceSettings,
  markAccountSettingSyncLogEntriesAttempted,
  markAccountSettingSyncLogEntriesFailed,
  markAccountSettingSyncLogEntriesSynced,
  markModuleSettingSyncLogEntriesAttempted,
  markModuleSettingSyncLogEntriesFailed,
  markModuleSettingSyncLogEntriesSynced,
  markWorkspaceSettingSyncLogEntriesAttempted,
  markWorkspaceSettingSyncLogEntriesFailed,
  markWorkspaceSettingSyncLogEntriesSynced,
  type SyncLogEntry,
} from "@/lib/db/local/queries";
import { fetchAccountSession } from "@/lib/account/clientSession";
import {
  ensureFreshCloudSession,
  type ZhiNotesCloudSession,
} from "@/lib/cloud/clientSession";
import {
  buildAccountModuleSettingCloudPayload,
  buildAccountModuleSettingsPendingSyncPlan,
  buildAccountModuleSettingsCloudRestorePlan,
  type AccountModuleSettingCloudPayload,
  type SupportedAccountSettingSyncKey,
} from "@/lib/sync/accountModuleSettingsPendingSync";
import { SETTINGS_SYNC_MANUAL_REVIEW_FAILURE_THRESHOLD, SETTINGS_CLOUD_APPLIED_EVENT } from "@/lib/sync/settingsSyncStatus";
import {
  buildWorkspaceSettingCloudPayload,
  buildWorkspaceSettingsPendingSyncPlan,
  buildWorkspaceSettingsCloudRestorePlan,
  type WorkspaceSettingCloudPayload,
  type SupportedWorkspaceSettingSyncKey,
} from "@/lib/sync/workspaceSettingsPendingSync";
import { readLocalWorkspaceIdentity } from "@/lib/sync/workspaceIdentity";

const SETTINGS_CLOUD_DRAIN_REQUEST_TIMEOUT_MS = 12_000;
const SETTINGS_CLOUD_DRAIN_RETRY_DELAY_MS = 60_000;
const INVALID_SETTINGS_CLOUD_ACK_MESSAGE =
  "设置云端没有返回有效 ACK；本地设置仍保留在 pending 队列。";

export type SettingsCloudDrainStatus =
  | "ok"
  | "disabled"
  | "needs-attention"
  | "error";

export interface DrainPendingSettingsCloudSyncResult {
  status: SettingsCloudDrainStatus;
  attempted: number;
  synced: number;
  failed: number;
  skipped: number;
  markedSynced: number;
  message: string;
}

export interface DrainPendingSettingsCloudSyncOptions {
  includeManualReview?: boolean;
}

class SettingsCloudDrainRequestTimeoutError extends Error {
  constructor() {
    super("设置同步请求超时；本地设置和待上传队列已保留，可稍后重试。");
    this.name = "SettingsCloudDrainRequestTimeoutError";
  }
}

type SettingsCloudPayload =
  | WorkspaceSettingCloudPayload
  | AccountModuleSettingCloudPayload;

interface SettingsCloudAckReceiptShape {
  format?: unknown;
  format_version?: unknown;
  setting_key?: unknown;
  workspace_id?: unknown;
  saved_at?: unknown;
  table_name?: unknown;
  module_id?: unknown;
  summary?: unknown;
  sync_rule?: unknown;
}

interface SettingsSyncConnection {
  session: ZhiNotesCloudSession | null;
  workspaceId: string;
}

let drainInFlight: Promise<DrainPendingSettingsCloudSyncResult> | null = null;

export async function drainPendingSettingsCloudSync(
  options: DrainPendingSettingsCloudSyncOptions = {}
): Promise<DrainPendingSettingsCloudSyncResult> {
  if (drainInFlight) return drainInFlight;
  drainInFlight = runSettingsCloudSync(options).finally(() => { drainInFlight = null; });
  return drainInFlight;
}

async function runSettingsCloudSync(
  options: DrainPendingSettingsCloudSyncOptions
): Promise<DrainPendingSettingsCloudSyncResult> {
  const boundWorkspaceId = readLocalWorkspaceIdentity()?.cloud_workspace_id;
  let connection: SettingsSyncConnection;
  if (boundWorkspaceId) {
    const sessionResult = await ensureFreshCloudSession();
    if (sessionResult.status !== "refreshed") {
      return buildSettingsDrainResult({ status: "disabled",
        message: "云工作区登录暂时无法确认；设置变更仍保留在待上传队列。" });
    }
    connection = { session: sessionResult.session, workspaceId: boundWorkspaceId };
  } else {
    const account = await fetchAccountSession();
    if (account.status !== "ok" || !account.authenticated || account.stale || !account.account) {
      return buildSettingsDrainResult({ status: "disabled",
        message: "账号登录暂时无法确认；设置变更仍保留在待上传队列。" });
    }
    connection = { session: null, workspaceId: `account-${account.account.id}` };
  }

  const workspaceResult = await drainWorkspaceSettings({
    ...connection,
    includeManualReview: options.includeManualReview,
  });
  const accountModuleResult = await drainAccountModuleSettings({
    ...connection,
    includeManualReview: options.includeManualReview,
  });
  const attempted = workspaceResult.attempted + accountModuleResult.attempted;
  const synced = workspaceResult.synced + accountModuleResult.synced;
  const failed = workspaceResult.failed + accountModuleResult.failed;
  const skipped = workspaceResult.skipped + accountModuleResult.skipped;
  const markedSynced =
    workspaceResult.markedSynced + accountModuleResult.markedSynced;
  let pullError = "";
  try {
    await pullSettingsCloudSync(connection);
  } catch (error) {
    pullError = formatSettingsCloudDrainError(error);
  }
  const status: SettingsCloudDrainStatus =
    failed > 0 || pullError
      ? "error"
      : skipped > 0
        ? "needs-attention"
        : synced > 0 || attempted > 0
          ? "ok"
          : "ok";

  return {
    status,
    attempted,
    synced,
    failed,
    skipped,
    markedSynced,
    message:
      pullError ? pullError : attempted === 0 && skipped === 0
        ? "当前没有可自动补传的设置变更。"
        : `设置补传完成：已上传 ${synced}/${attempted} 项，确认本地 pending ${markedSynced} 条${
            skipped > 0 ? `；${skipped} 条不在白名单或缺失本地记录，已保留为待处理` : ""
          }${failed > 0 ? `；${failed} 项失败，已保留待重试` : ""}。`,
  };
}

async function drainWorkspaceSettings(input: {
  session: ZhiNotesCloudSession | null;
  workspaceId: string;
  includeManualReview?: boolean;
}): Promise<DrainPendingSettingsCloudSyncResult> {
  let attemptedKeys: SupportedWorkspaceSettingSyncKey[] = [];
  try {
    const pendingEntries = await getPendingWorkspaceSettingSyncLogEntries();
    const maxLogId = Math.max(0, ...pendingEntries.map((entry) => entry.id));
    const settings = await listWorkspaceSettings();
    const plan = buildWorkspaceSettingsPendingSyncPlan({
      pendingEntries: filterRetryableSettingsEntries(
        pendingEntries,
        Boolean(input.includeManualReview)
      ),
      settings,
    });
    const skipped = plan.summary.skipped_pending_settings +
      plan.summary.missing_local_settings;
    if (plan.upload_keys.length === 0) {
      return buildSettingsDrainResult({
        status: skipped > 0 ? "needs-attention" : "ok",
        skipped,
        message:
          skipped > 0
            ? "workspace settings 队列里有不在白名单或缺失本地记录的行。"
            : "当前没有待上传的 workspace settings。",
      });
    }

    const settingsByKey = new Map(
      settings.map((setting) => [setting.key, setting])
    );
    const uploadedKeys: SupportedWorkspaceSettingSyncKey[] = [];
    const failedKeys: SupportedWorkspaceSettingSyncKey[] = [];
    const failedMessages: string[] = [];
    await markWorkspaceSettingSyncLogEntriesAttempted(plan.upload_keys);
    attemptedKeys = [...plan.upload_keys];

    for (const key of plan.upload_keys) {
      const setting = settingsByKey.get(key);
      const payload = setting ? buildWorkspaceSettingCloudPayload(setting) : null;
      if (!payload) {
        failedKeys.push(key);
        failedMessages.push(`${key}: 无法生成云端 payload`);
        continue;
      }
      const result = await patchWorkspaceSettings(input, payload);
      if (result.ok) {
        uploadedKeys.push(key);
      } else {
        failedKeys.push(key);
        failedMessages.push(`${key}: ${result.message}`);
      }
    }

    const markedSynced =
      uploadedKeys.length > 0
        ? await markWorkspaceSettingSyncLogEntriesSynced(uploadedKeys, maxLogId)
        : 0;
    if (failedKeys.length > 0) {
      await markWorkspaceSettingSyncLogEntriesFailed(
        failedKeys,
        failedMessages.join("; "),
        SETTINGS_CLOUD_DRAIN_RETRY_DELAY_MS
      );
    }
    return buildSettingsDrainResult({
      status: failedKeys.length > 0 ? "error" : skipped > 0 ? "needs-attention" : "ok",
      attempted: plan.upload_keys.length,
      synced: uploadedKeys.length,
      failed: failedKeys.length,
      skipped,
      markedSynced,
      message: "workspace settings 补传完成。",
    });
  } catch (error) {
    if (attemptedKeys.length > 0) {
      await markWorkspaceSettingSyncLogEntriesFailed(
        attemptedKeys,
        formatSettingsCloudDrainError(error),
        SETTINGS_CLOUD_DRAIN_RETRY_DELAY_MS
      );
    }
    return buildSettingsDrainResult({
      status: "error",
      attempted: attemptedKeys.length,
      failed: attemptedKeys.length,
      message: formatSettingsCloudDrainError(error),
    });
  }
}

async function drainAccountModuleSettings(input: {
  session: ZhiNotesCloudSession | null;
  workspaceId: string;
  includeManualReview?: boolean;
}): Promise<DrainPendingSettingsCloudSyncResult> {
  let attemptedAccountKeys: SupportedAccountSettingSyncKey[] = [];
  let attemptedModuleRowIds: string[] = [];
  try {
    const pendingEntries = await getPendingAccountModuleSettingSyncLogEntries();
    const maxLogId = Math.max(0, ...pendingEntries.map((entry) => entry.id));
    const [accountSettings, moduleSettings] =
      await Promise.all([
        listAccountSettings(),
        listModuleSettings(),
      ]);
    const plan = buildAccountModuleSettingsPendingSyncPlan({
      pendingEntries: filterRetryableSettingsEntries(
        pendingEntries,
        Boolean(input.includeManualReview)
      ),
      accountSettings,
      moduleSettings,
    });
    const skipped = plan.summary.skipped_pending_rows;
    const attempted =
      plan.upload_account_keys.length + plan.upload_module_rows.length;
    if (attempted === 0) {
      return buildSettingsDrainResult({
        status: skipped > 0 ? "needs-attention" : "ok",
        skipped,
        message:
          skipped > 0
            ? "account/module settings 队列里有不在白名单或缺失本地记录的行。"
            : "当前没有待上传的 account/module settings。",
      });
    }

    const accountSettingsByKey = new Map(
      accountSettings.map((setting) => [setting.key, setting])
    );
    const moduleSettingsByRowId = new Map(
      moduleSettings.map((setting) => [
        buildModuleSettingSyncRowId(setting.moduleId, setting.key),
        setting,
      ])
    );
    const uploadedAccountKeys: SupportedAccountSettingSyncKey[] = [];
    const uploadedModuleRowIds: string[] = [];
    const failedAccountKeys: SupportedAccountSettingSyncKey[] = [];
    const failedModuleRowIds: string[] = [];
    const failedMessages: string[] = [];
    await Promise.all([
      markAccountSettingSyncLogEntriesAttempted(plan.upload_account_keys),
      markModuleSettingSyncLogEntriesAttempted(
        plan.upload_module_rows.map((row) => row.row_id)
      ),
    ]);
    attemptedAccountKeys = [...plan.upload_account_keys];
    attemptedModuleRowIds = plan.upload_module_rows.map((row) => row.row_id);

    for (const key of plan.upload_account_keys) {
      const setting = accountSettingsByKey.get(key);
      const payload = setting
        ? buildAccountModuleSettingCloudPayload(setting)
        : null;
      if (!payload) {
        failedAccountKeys.push(key);
        failedMessages.push(`${key}: 无法生成云端 payload`);
        continue;
      }
      const result = await patchWorkspaceSettings(input, payload);
      if (result.ok) {
        uploadedAccountKeys.push(key);
      } else {
        failedAccountKeys.push(key);
        failedMessages.push(`${key}: ${result.message}`);
      }
    }

    for (const row of plan.upload_module_rows) {
      const setting = moduleSettingsByRowId.get(row.row_id);
      const payload = setting
        ? buildAccountModuleSettingCloudPayload(setting)
        : null;
      if (!payload) {
        failedModuleRowIds.push(row.row_id);
        failedMessages.push(`${row.row_id}: 无法生成云端 payload`);
        continue;
      }
      const result = await patchWorkspaceSettings(input, payload);
      if (result.ok) {
        uploadedModuleRowIds.push(row.row_id);
      } else {
        failedModuleRowIds.push(row.row_id);
        failedMessages.push(`${row.row_id}: ${result.message}`);
      }
    }

    const [markedAccount, markedModule] = await Promise.all([
      uploadedAccountKeys.length > 0
        ? markAccountSettingSyncLogEntriesSynced(uploadedAccountKeys, maxLogId)
        : Promise.resolve(0),
      uploadedModuleRowIds.length > 0
        ? markModuleSettingSyncLogEntriesSynced(uploadedModuleRowIds, maxLogId)
        : Promise.resolve(0),
    ]);
    await Promise.all([
      failedAccountKeys.length > 0
        ? markAccountSettingSyncLogEntriesFailed(
            failedAccountKeys,
            failedMessages.join("; "),
            SETTINGS_CLOUD_DRAIN_RETRY_DELAY_MS
          )
        : Promise.resolve(0),
      failedModuleRowIds.length > 0
        ? markModuleSettingSyncLogEntriesFailed(
            failedModuleRowIds,
            failedMessages.join("; "),
            SETTINGS_CLOUD_DRAIN_RETRY_DELAY_MS
          )
        : Promise.resolve(0),
    ]);
    const failed = failedAccountKeys.length + failedModuleRowIds.length;
    return buildSettingsDrainResult({
      status: failed > 0 ? "error" : skipped > 0 ? "needs-attention" : "ok",
      attempted,
      synced: uploadedAccountKeys.length + uploadedModuleRowIds.length,
      failed,
      skipped,
      markedSynced: markedAccount + markedModule,
      message: "account/module settings 补传完成。",
    });
  } catch (error) {
    await Promise.all([
      attemptedAccountKeys.length > 0
        ? markAccountSettingSyncLogEntriesFailed(
            attemptedAccountKeys,
            formatSettingsCloudDrainError(error),
            SETTINGS_CLOUD_DRAIN_RETRY_DELAY_MS
          )
        : Promise.resolve(0),
      attemptedModuleRowIds.length > 0
        ? markModuleSettingSyncLogEntriesFailed(
            attemptedModuleRowIds,
            formatSettingsCloudDrainError(error),
            SETTINGS_CLOUD_DRAIN_RETRY_DELAY_MS
          )
        : Promise.resolve(0),
    ]);
    return buildSettingsDrainResult({
      status: "error",
      attempted: attemptedAccountKeys.length + attemptedModuleRowIds.length,
      failed: attemptedAccountKeys.length + attemptedModuleRowIds.length,
      message: formatSettingsCloudDrainError(error),
    });
  }
}

function filterRetryableSettingsEntries(
  entries: SyncLogEntry[],
  includeManualReview: boolean
): SyncLogEntry[] {
  if (includeManualReview) return entries;
  const now = Date.now();
  return entries.filter((entry) => {
    if (
      entry.status === "failed" &&
      entry.attemptCount >= SETTINGS_SYNC_MANUAL_REVIEW_FAILURE_THRESHOLD
    ) {
      return false;
    }
    if (entry.nextRetryAt && Date.parse(entry.nextRetryAt) > now) {
      return false;
    }
    return true;
  });
}

async function pullSettingsCloudSync(input: SettingsSyncConnection) {
  const response = await fetchSettingsCloudApiWithTimeout(
    `/api/workspaces/${encodeURIComponent(input.workspaceId)}/settings`,
    { headers: input.session ? { Authorization: `Bearer ${input.session.accessToken}` } : {} }
  );
  const body = await readSettingsCloudApiBody(response);
  if (!response.ok) throw new Error(getSettingsCloudApiDetail(body, response));
  if (body?.workspace_id !== input.workspaceId) {
    throw new Error("设置读取回执不匹配；本地设置未被替换。");
  }
  const workspacePending = await getPendingWorkspaceSettingSyncLogEntries();
  const accountModulePending = await getPendingAccountModuleSettingSyncLogEntries();
  const workspacePlan = buildWorkspaceSettingsCloudRestorePlan({
    cloudReadBody: body, pendingEntries: workspacePending,
  });
  const accountModulePlan = buildAccountModuleSettingsCloudRestorePlan({
    cloudReadBody: body, pendingEntries: accountModulePending,
  });
  let applied = false;
  try {
    if (workspacePlan.restore_allowed) {
      const local = new Map((await listWorkspaceSettings()).map((row) => [row.key, row.valueJson]));
      const settings = workspacePlan.settings_to_restore.filter(
        (row) => local.get(row.key) !== JSON.stringify(row.value ?? {})
      );
      if (settings.length) {
        await applyRemoteWorkspaceSettings({ settings });
        applied = true;
      }
    }
    if (accountModulePlan.restore_allowed) {
      const accounts = new Map((await listAccountSettings()).map((row) => [row.key, row.valueJson]));
      const modules = new Map((await listModuleSettings()).map((row) => [
        buildModuleSettingSyncRowId(row.moduleId, row.key), row.valueJson,
      ]));
      const accountSettings = accountModulePlan.account_settings_to_restore.filter(
        (row) => accounts.get(row.key) !== JSON.stringify(row.value ?? {})
      );
      const moduleSettings = accountModulePlan.module_settings_to_restore.filter(
        (row) => modules.get(buildModuleSettingSyncRowId(row.moduleId, row.key)) !== JSON.stringify(row.value ?? {})
      );
      if (accountSettings.length || moduleSettings.length) {
        await applyRemoteAccountModuleSettings({ accountSettings, moduleSettings });
        applied = true;
      }
    }
  } finally {
    if (applied) window.dispatchEvent(new Event(SETTINGS_CLOUD_APPLIED_EVENT));
  }
}

async function patchWorkspaceSettings(
  input: {
    session: ZhiNotesCloudSession | null;
    workspaceId: string;
  },
  payload: SettingsCloudPayload
): Promise<{ ok: true } | { ok: false; message: string }> {
  let response: Response;
  try {
    response = await fetchSettingsCloudApiWithTimeout(
      `/api/workspaces/${encodeURIComponent(input.workspaceId)}/settings`,
      {
        method: "PATCH",
        headers: {
          ...(input.session ? { Authorization: `Bearer ${input.session.accessToken}` } : {}),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );
  } catch (error) {
    return { ok: false, message: formatSettingsCloudDrainError(error) };
  }
  const body = await readSettingsCloudApiBody(response);
  if (!response.ok) {
    return { ok: false, message: getSettingsCloudApiDetail(body, response) };
  }
  const receipt = validateSettingsCloudAckReceipt({
    body,
    workspaceId: input.workspaceId,
    payload,
  });
  if (!receipt.ok) return { ok: false, message: receipt.message };
  return { ok: true };
}

function validateSettingsCloudAckReceipt(input: {
  body: Record<string, unknown> | null;
  workspaceId: string;
  payload: SettingsCloudPayload;
}): { ok: true } | { ok: false; message: string } {
  if (!input.body) {
    return { ok: false, message: INVALID_SETTINGS_CLOUD_ACK_MESSAGE };
  }
  const receipt = input.body as SettingsCloudAckReceiptShape;
  const summary = isPlainRecord(receipt.summary) ? receipt.summary : null;
  const syncRule = isPlainRecord(receipt.sync_rule) ? receipt.sync_rule : null;
  if (
    typeof receipt.format !== "string" ||
    !receipt.format.startsWith("zhinote-") ||
    !receipt.format.endsWith("settings-cloud-receipt") ||
    receipt.format_version !== 1 ||
    receipt.workspace_id !== input.workspaceId ||
    receipt.setting_key !== input.payload.setting_key ||
    typeof receipt.saved_at !== "string" ||
    Number.isNaN(Date.parse(receipt.saved_at)) ||
    !summary ||
    summary.writes_workspace_settings !== true ||
    summary.uploads_workspace_content !== false ||
    summary.acknowledges_pending_row !==
      input.payload.client_pending_row_id ||
    !syncRule ||
    syncRule.ordinary_sync_pending_only !== true ||
    syncRule.local_pending_table !== "sync_log" ||
    syncRule.local_pending_row_id !== input.payload.client_pending_row_id ||
    syncRule.cloud_wins_except_unsynced_local_setting !== true
  ) {
    return { ok: false, message: INVALID_SETTINGS_CLOUD_ACK_MESSAGE };
  }

  if ("table_name" in input.payload) {
    if (
      receipt.table_name !== input.payload.table_name ||
      (input.payload.table_name === "module_settings" &&
        receipt.module_id !== input.payload.module_id) ||
      (input.payload.table_name === "account_settings" &&
        receipt.module_id !== null)
    ) {
      return { ok: false, message: INVALID_SETTINGS_CLOUD_ACK_MESSAGE };
    }
  }

  return { ok: true };
}

async function fetchSettingsCloudApiWithTimeout(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1]
): Promise<Response> {
  const controller = new AbortController();
  let didTimeout = false;
  const timeout = window.setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, SETTINGS_CLOUD_DRAIN_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      cache: init?.cache ?? "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    if (didTimeout) throw new SettingsCloudDrainRequestTimeoutError();
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function readSettingsCloudApiBody(
  response: Response
): Promise<Record<string, unknown> | null> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { message: text };
  }
}

function getSettingsCloudApiDetail(
  body: Record<string, unknown> | null,
  response: Response
): string {
  const message = getRecordString(body, "message");
  if (message) return message;
  const error = getRecordString(body, "error");
  if (error) return error;
  const purpose = getRecordString(body, "purpose");
  if (purpose) return purpose;
  return `HTTP ${response.status}`;
}

function formatSettingsCloudDrainError(error: unknown): string {
  return error instanceof Error ? error.message : "设置云端补传失败。";
}

function getRecordString(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === "string" ? value : "";
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function buildSettingsDrainResult(
  input: Partial<DrainPendingSettingsCloudSyncResult> & {
    status: SettingsCloudDrainStatus;
    message: string;
  }
): DrainPendingSettingsCloudSyncResult {
  return {
    status: input.status,
    attempted: input.attempted ?? 0,
    synced: input.synced ?? 0,
    failed: input.failed ?? 0,
    skipped: input.skipped ?? 0,
    markedSynced: input.markedSynced ?? 0,
    message: input.message,
  };
}
