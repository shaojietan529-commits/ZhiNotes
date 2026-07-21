"use client";

import {
  applyRemoteKnowledgeRecords,
  buildRemoteKnowledgeRecordKey,
  getPendingKnowledgeSyncRecords,
  markKnowledgeSyncLogEntriesAttempted,
  markKnowledgeSyncLogEntriesFailed,
  markKnowledgeSyncLogEntriesSynced,
  type RemoteKnowledgeRecord,
} from "@/lib/db/local/queries";
import {
  checkAccountCloudSyncGate,
  type AccountCloudSyncGateStatus,
} from "@/lib/account/accountCloudSyncGate";
import { emitKnowledgeSyncStatusEvent } from "@/lib/sync/knowledgeSyncStatus";

export type AccountKnowledgeSyncStatus =
  | "ok"
  | "disabled"
  | "unauthenticated"
  | "unconfigured"
  | "unconfirmed"
  | "error";

export interface AccountKnowledgeSyncResult {
  status: AccountKnowledgeSyncStatus;
  pushed: number;
  pulled: number;
  skipped: number;
  failed: number;
  markedSynced: number;
  totalPending: number;
  skippedLocalPendingPulls: number;
  message?: string;
}

interface AccountKnowledgeSyncOptions {
  includeManualReview?: boolean;
  forceAccountGate?: boolean;
  limit?: number;
}

interface KnowledgePushResponse {
  accepted?: unknown;
  skipped?: unknown;
  rejected?: unknown;
  ack?: unknown;
}

interface KnowledgeCloudAckReceipt {
  format: "zhinote-knowledge-cloud-ack-receipt";
  format_version: 1;
  ack_status: "acknowledged" | "empty";
  requested_count: number;
  accepted_count: number;
  skipped_count: number;
  rejected_count: number;
  remote_cursor: string;
  remote_watermark: string;
  boundary: {
    account_scoped: true;
    stores_only_authenticated_account_copy: true;
    uses_raw_browser_storage_dump: false;
  };
}

interface KnowledgeChangesResponse {
  records?: unknown;
  cursor?: unknown;
  hasMore?: unknown;
  count?: unknown;
}

const KNOWLEDGE_SYNC_REMOTE_CURSOR_KEY =
  "zhinote.knowledgeSync.remoteCursor.v1";
const KNOWLEDGE_SYNC_REQUEST_TIMEOUT_MS = 12_000;
const KNOWLEDGE_SYNC_RETRY_DELAY_MS = 60_000;
const DEFAULT_KNOWLEDGE_SYNC_LIMIT = 80;
const INVALID_KNOWLEDGE_ACK_MESSAGE =
  "云端没有返回有效知识库 ACK，已保留为 pending。";
const EMPTY_KNOWLEDGE_ACK_MESSAGE =
  "云端没有确认任何知识库记录，已保留为 pending。";

export async function syncAccountKnowledgeNow(
  options: AccountKnowledgeSyncOptions = {}
): Promise<AccountKnowledgeSyncResult> {
  const gate = await checkAccountCloudSyncGate({
    force: options.forceAccountGate,
  });
  if (gate.status !== "ready") {
    return buildGateResult(gate.status);
  }

  const pushResult = await pushPendingKnowledgeRows(options);
  const pullResult = await pullRemoteKnowledgeRows(options);
  emitKnowledgeSyncStatusEvent();

  const status: AccountKnowledgeSyncStatus =
    pushResult.status === "error" || pullResult.status === "error"
      ? "error"
      : "ok";
  return {
    status,
    pushed: pushResult.pushed,
    pulled: pullResult.pulled,
    skipped: pushResult.skipped,
    failed: pushResult.failed + pullResult.failed,
    markedSynced: pushResult.markedSynced,
    totalPending: pushResult.totalPending,
    skippedLocalPendingPulls: pullResult.skippedLocalPendingPulls,
    message:
      status === "error"
        ? pushResult.message ?? pullResult.message
        : undefined,
  };
}

async function pushPendingKnowledgeRows(
  options: AccountKnowledgeSyncOptions
): Promise<AccountKnowledgeSyncResult> {
  const pending = await getPendingKnowledgeSyncRecords(
    options.limit ?? DEFAULT_KNOWLEDGE_SYNC_LIMIT,
    { includeManualReview: options.includeManualReview }
  );
  if (pending.entries.length === 0) {
    return buildEmptyResult("ok");
  }

  const recordsByKey = new Map(
    pending.records.map((record) => [
      buildRemoteKnowledgeRecordKey(record.type, record.id),
      record,
    ])
  );
  const missingLogIds = pending.entries
    .filter((entry) => !recordsByKey.has(entry.key))
    .map((entry) => entry.logId);
  const records = pending.entries
    .map((entry) => recordsByKey.get(entry.key))
    .filter((record): record is RemoteKnowledgeRecord => Boolean(record));
  const recordLogIds = pending.entries
    .filter((entry) => recordsByKey.has(entry.key))
    .map((entry) => entry.logId);

  if (missingLogIds.length > 0) {
    await markKnowledgeSyncLogEntriesFailed(
      missingLogIds,
      "知识库同步日志指向的本地记录不存在，已保留为待处理。",
      KNOWLEDGE_SYNC_RETRY_DELAY_MS
    );
  }
  if (records.length === 0) {
    return {
      ...buildEmptyResult("error"),
      failed: missingLogIds.length,
      totalPending: pending.entries.length,
      message: "知识库同步日志指向的本地记录不存在，已保留为待处理。",
    };
  }

  await markKnowledgeSyncLogEntriesAttempted(recordLogIds);

  let response: KnowledgePushResponse;
  try {
    response = await callKnowledgeSync<KnowledgePushResponse>({
      action: "push",
      records,
    });
  } catch (error) {
    const message = formatKnowledgeSyncError(error);
    await markKnowledgeSyncLogEntriesFailed(
      recordLogIds,
      message,
      KNOWLEDGE_SYNC_RETRY_DELAY_MS
    );
    return {
      ...buildEmptyResult("error"),
      failed: recordLogIds.length + missingLogIds.length,
      totalPending: pending.entries.length,
      message,
    };
  }

  const accepted = readStringArray(response.accepted);
  const skipped = readStringArray(response.skipped);
  const rejected = readStringArray(response.rejected);
  const ack = normalizeKnowledgeCloudAckReceipt(response.ack);
  if (
    !knowledgeCloudAckConfirmsPush(ack, {
      requested: records.length,
      accepted: accepted.length,
      skipped: skipped.length,
      rejected: rejected.length,
    })
  ) {
    await markKnowledgeSyncLogEntriesFailed(
      recordLogIds,
      INVALID_KNOWLEDGE_ACK_MESSAGE,
      KNOWLEDGE_SYNC_RETRY_DELAY_MS
    );
    return {
      ...buildEmptyResult("error"),
      failed: recordLogIds.length + missingLogIds.length,
      totalPending: pending.entries.length,
      message: INVALID_KNOWLEDGE_ACK_MESSAGE,
    };
  }

  const acceptedKeys = new Set(accepted);
  const skippedKeys = new Set(skipped);
  const acknowledgedKeys = new Set([...acceptedKeys, ...skippedKeys]);
  if (records.length > 0 && acknowledgedKeys.size === 0) {
    await markKnowledgeSyncLogEntriesFailed(
      recordLogIds,
      EMPTY_KNOWLEDGE_ACK_MESSAGE,
      KNOWLEDGE_SYNC_RETRY_DELAY_MS
    );
    return {
      ...buildEmptyResult("error"),
      failed: recordLogIds.length + missingLogIds.length,
      totalPending: pending.entries.length,
      message: EMPTY_KNOWLEDGE_ACK_MESSAGE,
    };
  }
  const acknowledgedLogIds = pending.entries
    .filter((entry) => acknowledgedKeys.has(entry.key))
    .map((entry) => entry.logId);
  const markedSynced = await markKnowledgeSyncLogEntriesSynced(
    acknowledgedLogIds
  );
  const failedLogIds = pending.entries
    .filter(
      (entry) =>
        !acknowledgedKeys.has(entry.key) &&
        !missingLogIds.includes(entry.logId)
    )
    .map((entry) => entry.logId);
  if (failedLogIds.length > 0) {
    await markKnowledgeSyncLogEntriesFailed(
      failedLogIds,
      "云端未确认这些知识库记录，已保留为待上传并稍后重试。",
      KNOWLEDGE_SYNC_RETRY_DELAY_MS
    );
  }

  return {
    status: failedLogIds.length > 0 || missingLogIds.length > 0 ? "error" : "ok",
    pushed: acceptedKeys.size,
    pulled: 0,
    skipped: skippedKeys.size,
    failed: failedLogIds.length + missingLogIds.length,
    markedSynced,
    totalPending: pending.entries.length,
    skippedLocalPendingPulls: 0,
    message:
      failedLogIds.length > 0
        ? "云端只确认了部分知识库记录，未确认记录已保留为 pending。"
        : undefined,
  };
}

async function pullRemoteKnowledgeRows(
  options: AccountKnowledgeSyncOptions
): Promise<AccountKnowledgeSyncResult> {
  let response: KnowledgeChangesResponse;
  try {
    response = await callKnowledgeSync<KnowledgeChangesResponse>({
      action: "changes-since",
      since: readKnowledgeRemoteCursor(),
      limit: options.limit ?? DEFAULT_KNOWLEDGE_SYNC_LIMIT,
    });
  } catch (error) {
    return {
      ...buildEmptyResult("error"),
      failed: 1,
      message: formatKnowledgeSyncError(error),
    };
  }

  const records = Array.isArray(response.records)
    ? (response.records as RemoteKnowledgeRecord[])
    : [];
  const applyResult =
    records.length > 0
      ? await applyRemoteKnowledgeRecords(records)
      : { applied: 0, skippedLocalPending: 0 };
  if (
    typeof response.cursor === "string" &&
    applyResult.skippedLocalPending === 0
  ) {
    writeKnowledgeRemoteCursor(response.cursor);
  }
  return {
    ...buildEmptyResult("ok"),
    pulled: applyResult.applied,
    skippedLocalPendingPulls: applyResult.skippedLocalPending,
  };
}

async function callKnowledgeSync<T>(
  body: Record<string, unknown>
): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(),
    KNOWLEDGE_SYNC_REQUEST_TIMEOUT_MS
  );
  try {
    const response = await fetch("/api/knowledge/account-sync", {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        getResponseMessage(json) || `知识库同步接口失败：HTTP ${response.status}`
      );
    }
    return json as T;
  } finally {
    window.clearTimeout(timeout);
  }
}

function buildGateResult(
  status: AccountCloudSyncGateStatus
): AccountKnowledgeSyncResult {
  if (status === "signed-out") {
    return {
      ...buildEmptyResult("unauthenticated"),
      message: "需要先登录账号；知识库变更仍保留在本地待上传队列。",
    };
  }
  if (status === "unconfigured") {
    return {
      ...buildEmptyResult("unconfigured"),
      message: "账号同步环境未配置；知识库变更仍保留在本地待上传队列。",
    };
  }
  if (status === "unconfirmed") {
    return {
      ...buildEmptyResult("unconfirmed"),
      message: "账号状态暂时无法确认；知识库变更仍保留在本地待上传队列。",
    };
  }
  return {
    ...buildEmptyResult("error"),
    message: "知识库同步暂时无法确认账号；本地输入已保留。",
  };
}

function buildEmptyResult(
  status: AccountKnowledgeSyncStatus
): AccountKnowledgeSyncResult {
  return {
    status,
    pushed: 0,
    pulled: 0,
    skipped: 0,
    failed: 0,
    markedSynced: 0,
    totalPending: 0,
    skippedLocalPendingPulls: 0,
  };
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function normalizeKnowledgeCloudAckReceipt(
  value: unknown
): KnowledgeCloudAckReceipt | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const ack = value as Partial<KnowledgeCloudAckReceipt>;
  const boundary = ack.boundary;
  if (ack.format !== "zhinote-knowledge-cloud-ack-receipt") return null;
  if (ack.format_version !== 1) return null;
  if (ack.ack_status !== "acknowledged" && ack.ack_status !== "empty") {
    return null;
  }
  if (typeof ack.remote_cursor !== "string") return null;
  if (typeof ack.remote_watermark !== "string") return null;
  if (
    !boundary ||
    boundary.account_scoped !== true ||
    boundary.stores_only_authenticated_account_copy !== true ||
    boundary.uses_raw_browser_storage_dump !== false
  ) {
    return null;
  }
  return {
    format: "zhinote-knowledge-cloud-ack-receipt",
    format_version: 1,
    ack_status: ack.ack_status,
    requested_count: normalizeNonNegativeCount(ack.requested_count),
    accepted_count: normalizeNonNegativeCount(ack.accepted_count),
    skipped_count: normalizeNonNegativeCount(ack.skipped_count),
    rejected_count: normalizeNonNegativeCount(ack.rejected_count),
    remote_cursor: ack.remote_cursor,
    remote_watermark: ack.remote_watermark,
    boundary: {
      account_scoped: true,
      stores_only_authenticated_account_copy: true,
      uses_raw_browser_storage_dump: false,
    },
  };
}

function knowledgeCloudAckConfirmsPush(
  ack: KnowledgeCloudAckReceipt | null,
  counts: {
    requested: number;
    accepted: number;
    skipped: number;
    rejected: number;
  }
): ack is KnowledgeCloudAckReceipt {
  return (
    Boolean(ack) &&
    ack?.ack_status === "acknowledged" &&
    ack.requested_count === counts.requested &&
    ack.accepted_count === counts.accepted &&
    ack.skipped_count === counts.skipped &&
    ack.rejected_count === counts.rejected
  );
}

function normalizeNonNegativeCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}

function readKnowledgeRemoteCursor(): string {
  try {
    return window.localStorage.getItem(KNOWLEDGE_SYNC_REMOTE_CURSOR_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeKnowledgeRemoteCursor(value: string): void {
  try {
    window.localStorage.setItem(KNOWLEDGE_SYNC_REMOTE_CURSOR_KEY, value);
  } catch {
    // A missing cursor only makes the next pull scan the remote index.
  }
}

function getResponseMessage(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  return typeof record.message === "string"
    ? record.message
    : typeof record.error === "string"
      ? record.error
      : "";
}

function formatKnowledgeSyncError(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "AbortError"
  ) {
    return "知识库同步请求超时；本地输入已保留，会稍后重试。";
  }
  return error instanceof Error ? error.message : "知识库同步失败。";
}
