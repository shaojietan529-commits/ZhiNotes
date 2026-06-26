import type {
  AccountSettingRecord,
  ModuleSettingRecord,
  SyncLogEntry,
} from "@/lib/db/local/queries";
import {
  buildModuleSettingSyncRowId,
  parseModuleSettingSyncRowId,
} from "@/lib/db/local/queries";

export const ACCOUNT_DISPLAY_NAME_SETTING_KEY =
  "account_profile.display_name.v1";
export const ACCOUNT_UI_PREFERENCES_SETTING_KEY =
  "account_preferences.ui.v1";
export const MODULE_PINNED_ITEMS_SETTING_KEY =
  "module_settings.pinned_items.v1";
export const MODULE_DASHBOARD_LAYOUT_SETTING_KEY =
  "module_settings.dashboard_layout.v1";
export const ACCOUNT_SETTINGS_CLOUD_FIELD = "account_settings" as const;
export const MODULE_SETTINGS_CLOUD_FIELD = "module_settings" as const;
export const ACCOUNT_SETTINGS_CLOUD_TARGET =
  "workspaces.settings.account_settings" as const;
export const MODULE_SETTINGS_CLOUD_TARGET =
  "workspaces.settings.module_settings" as const;

export const ACCOUNT_MODULE_SETTINGS_FORBIDDEN_FIELDS = [
  "page_body",
  "content_text",
  "content_yjs",
  "database_row_values",
  "field_values",
  "comment_body",
  "comment_bodies",
  "file_bytes",
  "file_text",
  "raw_cache_dump",
  "token",
  "access_token",
  "refresh_token",
  "password",
  "secret",
] as const;

export const SUPPORTED_ACCOUNT_SETTING_SYNC_KEYS = [
  ACCOUNT_DISPLAY_NAME_SETTING_KEY,
  ACCOUNT_UI_PREFERENCES_SETTING_KEY,
] as const;

export const SUPPORTED_MODULE_SETTING_SYNC_KEYS = [
  MODULE_PINNED_ITEMS_SETTING_KEY,
  MODULE_DASHBOARD_LAYOUT_SETTING_KEY,
] as const;

export type SupportedAccountSettingSyncKey =
  (typeof SUPPORTED_ACCOUNT_SETTING_SYNC_KEYS)[number];

export type SupportedModuleSettingSyncKey =
  (typeof SUPPORTED_MODULE_SETTING_SYNC_KEYS)[number];

export interface AccountModuleSettingsPendingSyncPlan {
  format: "zhinote-account-module-settings-pending-sync-plan";
  format_version: 1;
  architecture_target: "cloud-master-local-settings-pending";
  ordinary_sync_pending_only: true;
  pending_queue_table: "sync_log";
  local_tables: ["account_settings", "module_settings"];
  cloud_targets: ["account_settings", "module_settings"];
  supported_account_setting_keys: SupportedAccountSettingSyncKey[];
  supported_module_setting_keys: SupportedModuleSettingSyncKey[];
  upload_account_keys: SupportedAccountSettingSyncKey[];
  upload_module_rows: Array<{
    module_id: string;
    setting_key: SupportedModuleSettingSyncKey;
    row_id: string;
  }>;
  skipped_pending_rows: Array<{
    table_name: "account_settings" | "module_settings";
    row_id: string;
    reason:
      | "unsupported-setting-key"
      | "missing-local-record"
      | "invalid-module-row-id";
  }>;
  summary: {
    pending_rows_seen: number;
    uploadable_account_settings: number;
    uploadable_module_settings: number;
    skipped_pending_rows: number;
    account_settings_seen: number;
    module_settings_seen: number;
  };
  privacy_boundary: string;
  boundary: {
    reads_page_body_text: false;
    reads_page_yjs: false;
    reads_database_row_values: false;
    reads_comment_bodies: false;
    reads_file_bytes: false;
    reads_secret_values: false;
    uploads_workspace_cache_dump: false;
    mutates_local_cache_records: false;
  };
}

export type AccountModuleSettingCloudPayload =
  | {
      table_name: "account_settings";
      setting_key: SupportedAccountSettingSyncKey;
      client_pending_row_id: SupportedAccountSettingSyncKey;
      value: Record<string, unknown>;
    }
  | {
      table_name: "module_settings";
      module_id: string;
      setting_key: SupportedModuleSettingSyncKey;
      client_pending_row_id: string;
      value: Record<string, unknown>;
    };

export interface AccountModuleSettingsCloudValue {
  format: "zhinote-account-module-setting-cloud-value";
  format_version: 1;
  table_name: "account_settings" | "module_settings";
  module_id?: string;
  setting_key: SupportedAccountSettingSyncKey | SupportedModuleSettingSyncKey;
  value: Record<string, unknown>;
  saved_at: string;
  source: "zhinotes-account-module-settings-ui";
  privacy_boundary: string;
}

export interface ParsedAccountModuleSettingsCloudValues {
  format: "zhinote-account-module-settings-cloud-read-summary";
  format_version: 1;
  cloud_targets: [
    typeof ACCOUNT_SETTINGS_CLOUD_TARGET,
    typeof MODULE_SETTINGS_CLOUD_TARGET,
  ];
  cloud_value_valid: boolean;
  account_settings_found: boolean;
  module_settings_found: boolean;
  account_settings: Record<string, AccountModuleSettingsCloudValue>;
  module_settings: Record<
    string,
    Record<string, AccountModuleSettingsCloudValue>
  >;
  account_settings_count: number;
  module_modules_count: number;
  module_settings_count: number;
  supported_account_setting_keys: SupportedAccountSettingSyncKey[];
  supported_module_setting_keys: SupportedModuleSettingSyncKey[];
  summary: {
    reads_workspace_settings: true;
    writes_workspace_settings: false;
    uploads_workspace_content: false;
    reads_page_body_text: false;
    reads_file_bytes: false;
  };
  privacy_note: string;
}

export interface AccountModuleSettingsCloudReceipt {
  format: "zhinote-account-module-settings-cloud-receipt";
  format_version: 1;
  table_name: "account_settings" | "module_settings";
  setting_key: SupportedAccountSettingSyncKey | SupportedModuleSettingSyncKey;
  module_id: string | null;
  cloud_target:
    | typeof ACCOUNT_SETTINGS_CLOUD_TARGET
    | typeof MODULE_SETTINGS_CLOUD_TARGET;
  workspace_id: string;
  saved_at: string;
  role: "owner" | "researcher";
  summary: {
    uploaded_value_keys: number;
    writes_workspace_settings: true;
    uploads_workspace_content: false;
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_file_bytes: false;
    acknowledges_pending_row: string;
  };
  sync_rule: {
    ordinary_sync_pending_only: true;
    local_pending_table: "sync_log";
    local_pending_row_id: string;
    cloud_wins_except_unsynced_local_setting: true;
  };
  privacy_note: string;
}

export type AccountModuleSettingsValidationResult =
  | {
      ok: true;
      payload: AccountModuleSettingCloudPayload;
    }
  | {
      ok: false;
      message: string;
    };

export function buildAccountModuleSettingsPendingSyncPlan(input: {
  pendingEntries: SyncLogEntry[];
  accountSettings: AccountSettingRecord[];
  moduleSettings: ModuleSettingRecord[];
}): AccountModuleSettingsPendingSyncPlan {
  const accountSettingsByKey = new Map(
    input.accountSettings.map((setting) => [setting.key, setting])
  );
  const moduleSettingsByRowId = new Map(
    input.moduleSettings.map((setting) => [
      buildModuleSettingSyncRowId(setting.moduleId, setting.key),
      setting,
    ])
  );
  const accountPendingKeys = new Set<string>();
  const modulePendingRowIds = new Set<string>();
  const skippedPendingRows: AccountModuleSettingsPendingSyncPlan["skipped_pending_rows"] =
    [];
  const uploadAccountKeys: SupportedAccountSettingSyncKey[] = [];
  const uploadModuleRows: AccountModuleSettingsPendingSyncPlan["upload_module_rows"] =
    [];

  for (const entry of input.pendingEntries) {
    if (entry.tableName === "account_settings") {
      const key = entry.rowId.trim();
      if (!key || accountPendingKeys.has(key)) continue;
      accountPendingKeys.add(key);
      if (!isSupportedAccountSettingSyncKey(key)) {
        skippedPendingRows.push({
          table_name: "account_settings",
          row_id: key,
          reason: "unsupported-setting-key",
        });
        continue;
      }
      if (!accountSettingsByKey.has(key)) {
        skippedPendingRows.push({
          table_name: "account_settings",
          row_id: key,
          reason: "missing-local-record",
        });
        continue;
      }
      uploadAccountKeys.push(key);
      continue;
    }

    if (entry.tableName === "module_settings") {
      const rowId = entry.rowId.trim();
      if (!rowId || modulePendingRowIds.has(rowId)) continue;
      modulePendingRowIds.add(rowId);
      const parsed = parseModuleSettingSyncRowId(rowId);
      if (!parsed) {
        skippedPendingRows.push({
          table_name: "module_settings",
          row_id: rowId,
          reason: "invalid-module-row-id",
        });
        continue;
      }
      if (!isSupportedModuleSettingSyncKey(parsed.key)) {
        skippedPendingRows.push({
          table_name: "module_settings",
          row_id: rowId,
          reason: "unsupported-setting-key",
        });
        continue;
      }
      if (!moduleSettingsByRowId.has(rowId)) {
        skippedPendingRows.push({
          table_name: "module_settings",
          row_id: rowId,
          reason: "missing-local-record",
        });
        continue;
      }
      uploadModuleRows.push({
        module_id: parsed.moduleId,
        setting_key: parsed.key,
        row_id: rowId,
      });
    }
  }

  return {
    format: "zhinote-account-module-settings-pending-sync-plan",
    format_version: 1,
    architecture_target: "cloud-master-local-settings-pending",
    ordinary_sync_pending_only: true,
    pending_queue_table: "sync_log",
    local_tables: ["account_settings", "module_settings"],
    cloud_targets: ["account_settings", "module_settings"],
    supported_account_setting_keys: [...SUPPORTED_ACCOUNT_SETTING_SYNC_KEYS],
    supported_module_setting_keys: [...SUPPORTED_MODULE_SETTING_SYNC_KEYS],
    upload_account_keys: uploadAccountKeys,
    upload_module_rows: uploadModuleRows,
    skipped_pending_rows: skippedPendingRows,
    summary: {
      pending_rows_seen: accountPendingKeys.size + modulePendingRowIds.size,
      uploadable_account_settings: uploadAccountKeys.length,
      uploadable_module_settings: uploadModuleRows.length,
      skipped_pending_rows: skippedPendingRows.length,
      account_settings_seen: input.accountSettings.length,
      module_settings_seen: input.moduleSettings.length,
    },
    privacy_boundary:
      "Only explicit account_settings and module_settings rows that also have unsynced sync_log entries are eligible. Page bodies, database values, comments, files, secrets, and raw local cache dumps are never included.",
    boundary: {
      reads_page_body_text: false,
      reads_page_yjs: false,
      reads_database_row_values: false,
      reads_comment_bodies: false,
      reads_file_bytes: false,
      reads_secret_values: false,
      uploads_workspace_cache_dump: false,
      mutates_local_cache_records: false,
    },
  };
}

export function buildAccountModuleSettingCloudPayload(
  setting: AccountSettingRecord | ModuleSettingRecord
): AccountModuleSettingCloudPayload | null {
  const value = safeRecordFromJson(setting.valueJson);
  if ("moduleId" in setting) {
    if (!isSupportedModuleSettingSyncKey(setting.key)) return null;
    return {
      table_name: "module_settings",
      module_id: setting.moduleId,
      setting_key: setting.key,
      client_pending_row_id: buildModuleSettingSyncRowId(
        setting.moduleId,
        setting.key
      ),
      value,
    };
  }

  if (!isSupportedAccountSettingSyncKey(setting.key)) return null;
  return {
    table_name: "account_settings",
    setting_key: setting.key,
    client_pending_row_id: setting.key,
    value,
  };
}

export function validateAccountModuleSettingCloudPayload(
  body: unknown
): AccountModuleSettingsValidationResult {
  if (!isPlainRecord(body)) {
    return {
      ok: false,
      message: "请求体必须是 JSON object。",
    };
  }

  const forbiddenField = findForbiddenPayloadField(body);
  if (forbiddenField) {
    return {
      ok: false,
      message: `请求体不能包含 ${forbiddenField}。这里只能同步账号/模块设置元数据。`,
    };
  }

  const tableName = body.table_name;
  const settingKey = body.setting_key;
  const clientPendingRowId = body.client_pending_row_id;
  const value = body.value;

  if (tableName === "account_settings") {
    if (
      typeof settingKey !== "string" ||
      !isSupportedAccountSettingSyncKey(settingKey)
    ) {
      return {
        ok: false,
        message: "account_settings 只能同步白名单账号 setting_key。",
      };
    }
    if (clientPendingRowId !== settingKey) {
      return {
        ok: false,
        message: "account_settings 的 client_pending_row_id 必须等于 setting_key。",
      };
    }
    if (!isPlainRecord(value)) {
      return {
        ok: false,
        message: "value 必须是 JSON object。",
      };
    }
    return {
      ok: true,
      payload: {
        table_name: "account_settings",
        setting_key: settingKey,
        client_pending_row_id: settingKey,
        value,
      },
    };
  }

  if (tableName === "module_settings") {
    const moduleId =
      typeof body.module_id === "string" ? body.module_id.trim() : "";
    if (!moduleId || moduleId.length > 120) {
      return {
        ok: false,
        message: "module_settings 必须提供有效 module_id。",
      };
    }
    if (
      typeof settingKey !== "string" ||
      !isSupportedModuleSettingSyncKey(settingKey)
    ) {
      return {
        ok: false,
        message: "module_settings 只能同步白名单模块 setting_key。",
      };
    }
    const expectedRowId = buildModuleSettingSyncRowId(moduleId, settingKey);
    if (clientPendingRowId !== expectedRowId) {
      return {
        ok: false,
        message:
          "module_settings 的 client_pending_row_id 必须匹配 module_id 和 setting_key。",
      };
    }
    if (!isPlainRecord(value)) {
      return {
        ok: false,
        message: "value 必须是 JSON object。",
      };
    }
    return {
      ok: true,
      payload: {
        table_name: "module_settings",
        module_id: moduleId,
        setting_key: settingKey,
        client_pending_row_id: expectedRowId,
        value,
      },
    };
  }

  return {
    ok: false,
    message: "table_name 必须是 account_settings 或 module_settings。",
  };
}

export function buildAccountModuleSettingCloudValue(
  payload: AccountModuleSettingCloudPayload,
  savedAt: string
): AccountModuleSettingsCloudValue {
  return {
    format: "zhinote-account-module-setting-cloud-value",
    format_version: 1,
    table_name: payload.table_name,
    ...(payload.table_name === "module_settings"
      ? { module_id: payload.module_id }
      : {}),
    setting_key: payload.setting_key,
    value: payload.value,
    saved_at: savedAt,
    source: "zhinotes-account-module-settings-ui",
    privacy_boundary:
      "Settings metadata only. No page body, database row value, comment body, file byte, token, secret, or raw local cache dump is stored here.",
  };
}

export function parseAccountModuleSettingsCloudValues(
  settings: Record<string, unknown> | null
): ParsedAccountModuleSettingsCloudValues {
  const accountSettings = parseAccountSettingsCloudBucket(
    settings?.[ACCOUNT_SETTINGS_CLOUD_FIELD]
  );
  const moduleSettings = parseModuleSettingsCloudBucket(
    settings?.[MODULE_SETTINGS_CLOUD_FIELD]
  );
  const moduleSettingsCount = Object.values(moduleSettings.values).reduce(
    (count, moduleBucket) => count + Object.keys(moduleBucket).length,
    0
  );

  return {
    format: "zhinote-account-module-settings-cloud-read-summary",
    format_version: 1,
    cloud_targets: [ACCOUNT_SETTINGS_CLOUD_TARGET, MODULE_SETTINGS_CLOUD_TARGET],
    cloud_value_valid: accountSettings.valid && moduleSettings.valid,
    account_settings_found: accountSettings.found,
    module_settings_found: moduleSettings.found,
    account_settings: accountSettings.values,
    module_settings: moduleSettings.values,
    account_settings_count: Object.keys(accountSettings.values).length,
    module_modules_count: Object.keys(moduleSettings.values).length,
    module_settings_count: moduleSettingsCount,
    supported_account_setting_keys: [...SUPPORTED_ACCOUNT_SETTING_SYNC_KEYS],
    supported_module_setting_keys: [...SUPPORTED_MODULE_SETTING_SYNC_KEYS],
    summary: {
      reads_workspace_settings: true,
      writes_workspace_settings: false,
      uploads_workspace_content: false,
      reads_page_body_text: false,
      reads_file_bytes: false,
    },
    privacy_note:
      "This read summary returns only account/module settings metadata from workspaces.settings. It does not read note bodies, files, database rows, comments, versions, or raw local cache dumps.",
  };
}

export function buildAccountModuleSettingsCloudReceipt(input: {
  workspaceId: string;
  role: "owner" | "researcher";
  savedAt: string;
  payload: AccountModuleSettingCloudPayload;
}): AccountModuleSettingsCloudReceipt {
  return {
    format: "zhinote-account-module-settings-cloud-receipt",
    format_version: 1,
    table_name: input.payload.table_name,
    setting_key: input.payload.setting_key,
    module_id:
      input.payload.table_name === "module_settings"
        ? input.payload.module_id
        : null,
    cloud_target:
      input.payload.table_name === "account_settings"
        ? ACCOUNT_SETTINGS_CLOUD_TARGET
        : MODULE_SETTINGS_CLOUD_TARGET,
    workspace_id: input.workspaceId,
    saved_at: input.savedAt,
    role: input.role,
    summary: {
      uploaded_value_keys: Object.keys(input.payload.value).length,
      writes_workspace_settings: true,
      uploads_workspace_content: false,
      reads_page_body_text: false,
      reads_database_row_values: false,
      reads_file_bytes: false,
      acknowledges_pending_row: input.payload.client_pending_row_id,
    },
    sync_rule: {
      ordinary_sync_pending_only: true,
      local_pending_table: "sync_log",
      local_pending_row_id: input.payload.client_pending_row_id,
      cloud_wins_except_unsynced_local_setting: true,
    },
    privacy_note:
      "This receipt confirms only one account/module setting was saved to workspaces.settings. It does not upload notes, files, database rows, comments, versions, secrets, or local cache dumps.",
  };
}

export function isSupportedAccountSettingSyncKey(
  key: string
): key is SupportedAccountSettingSyncKey {
  return SUPPORTED_ACCOUNT_SETTING_SYNC_KEYS.includes(
    key as SupportedAccountSettingSyncKey
  );
}

export function isSupportedModuleSettingSyncKey(
  key: string
): key is SupportedModuleSettingSyncKey {
  return SUPPORTED_MODULE_SETTING_SYNC_KEYS.includes(
    key as SupportedModuleSettingSyncKey
  );
}

function parseAccountSettingsCloudBucket(value: unknown): {
  found: boolean;
  valid: boolean;
  values: Record<string, AccountModuleSettingsCloudValue>;
} {
  if (value === undefined || value === null) {
    return { found: false, valid: true, values: {} };
  }
  if (!isPlainRecord(value)) {
    return { found: true, valid: false, values: {} };
  }

  const values: Record<string, AccountModuleSettingsCloudValue> = {};
  let valid = true;
  for (const [settingKey, cloudValue] of Object.entries(value)) {
    if (!isSupportedAccountSettingSyncKey(settingKey)) {
      valid = false;
      continue;
    }
    if (!isValidAccountModuleSettingCloudValue(cloudValue, "account_settings")) {
      valid = false;
      continue;
    }
    values[settingKey] = cloudValue;
  }
  return { found: true, valid, values };
}

function parseModuleSettingsCloudBucket(value: unknown): {
  found: boolean;
  valid: boolean;
  values: Record<string, Record<string, AccountModuleSettingsCloudValue>>;
} {
  if (value === undefined || value === null) {
    return { found: false, valid: true, values: {} };
  }
  if (!isPlainRecord(value)) {
    return { found: true, valid: false, values: {} };
  }

  const values: Record<string, Record<string, AccountModuleSettingsCloudValue>> =
    {};
  let valid = true;
  for (const [moduleId, moduleBucket] of Object.entries(value)) {
    if (!isPlainRecord(moduleBucket)) {
      valid = false;
      continue;
    }
    const nextModuleValues: Record<string, AccountModuleSettingsCloudValue> = {};
    for (const [settingKey, cloudValue] of Object.entries(moduleBucket)) {
      if (!isSupportedModuleSettingSyncKey(settingKey)) {
        valid = false;
        continue;
      }
      if (
        !isValidAccountModuleSettingCloudValue(cloudValue, "module_settings") ||
        cloudValue.module_id !== moduleId
      ) {
        valid = false;
        continue;
      }
      nextModuleValues[settingKey] = cloudValue;
    }
    if (Object.keys(nextModuleValues).length > 0) {
      values[moduleId] = nextModuleValues;
    }
  }
  return { found: true, valid, values };
}

function isValidAccountModuleSettingCloudValue(
  value: unknown,
  tableName: "account_settings" | "module_settings"
): value is AccountModuleSettingsCloudValue {
  if (!isPlainRecord(value)) return false;
  return (
    value.format === "zhinote-account-module-setting-cloud-value" &&
    value.format_version === 1 &&
    value.table_name === tableName &&
    typeof value.setting_key === "string" &&
    isPlainRecord(value.value) &&
    typeof value.saved_at === "string"
  );
}

function findForbiddenPayloadField(value: unknown, depth = 0): string | null {
  if (!value || typeof value !== "object" || depth > 8) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const match = findForbiddenPayloadField(item, depth + 1);
      if (match) return match;
    }
    return null;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase();
    const forbidden = ACCOUNT_MODULE_SETTINGS_FORBIDDEN_FIELDS.find(
      (field) => field === normalizedKey
    );
    if (forbidden) return forbidden;

    const nestedMatch = findForbiddenPayloadField(nestedValue, depth + 1);
    if (nestedMatch) return nestedMatch;
  }

  return null;
}

function safeRecordFromJson(valueJson: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(valueJson);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return {};
  }
  return {};
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
