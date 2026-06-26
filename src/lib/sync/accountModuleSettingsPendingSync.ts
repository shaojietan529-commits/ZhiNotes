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
