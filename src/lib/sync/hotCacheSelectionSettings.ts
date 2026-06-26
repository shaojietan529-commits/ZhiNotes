import type { WorkspaceSettingRecord } from "@/lib/db/local/queries";
import type { HotCachePolicyPlan } from "@/lib/sync/hotCachePolicyPlan";

export const HOT_CACHE_PREFERENCES_SETTING_KEY = "hot_cache_preferences.v1";
export const HOT_CACHE_PREFERENCES_CHANGED_EVENT =
  "zhinote:hot-cache-preferences-changed";
export const HOT_CACHE_PREFERENCES_CHANGED_STORAGE_KEY =
  "zhinote.hot-cache-preferences.changed-at";

export interface HotCachePreferences {
  recentDays: 30 | 90;
  keepCurrentMonthDailyNotes: boolean;
  keepActiveDatabases: boolean;
  keepRecentFilePreviews: boolean;
  keepFavoritePages: boolean;
  keepCurrentProjects: boolean;
}

export interface HotCacheSelectionContract {
  format: "zhinote-hot-cache-selection-contract";
  format_version: 1;
  contract_status: "local-settings-pending-contract";
  architecture_target: "cloud-master-local-hot-cache";
  setting_key: typeof HOT_CACHE_PREFERENCES_SETTING_KEY;
  cloud_target: "workspaces.settings.hot_cache_preferences";
  local_target: "workspace_settings.value_json";
  pending_queue_table: "sync_log";
  privacy_boundary: string;
  boundary: {
    reads_page_body_text: false;
    reads_page_yjs: false;
    reads_database_row_values: false;
    reads_comment_bodies: false;
    reads_file_bytes: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    mutates_cache_records: false;
    saves_user_setting_locally: true;
    queues_pending_setting_change: true;
  };
  summary: {
    has_local_setting: boolean;
    enabled_preferences: number;
    recent_days: 30 | 90;
    plan_policy_hash: string;
    pending_rows: number;
  };
  allowed_preference_keys: Array<keyof HotCachePreferences>;
  sync_rule: {
    ordinary_sync_pending_only: true;
    row_id: typeof HOT_CACHE_PREFERENCES_SETTING_KEY;
    table_name: "workspace_settings";
    changed_cols: string[];
    cloud_wins_except_unsynced_local_setting: true;
  };
  forbidden_payload_fields: string[];
  preferences: HotCachePreferences;
}

export const DEFAULT_HOT_CACHE_PREFERENCES: HotCachePreferences = {
  recentDays: 30,
  keepCurrentMonthDailyNotes: true,
  keepActiveDatabases: true,
  keepRecentFilePreviews: false,
  keepFavoritePages: false,
  keepCurrentProjects: false,
};

export function metadataRecentLimitForHotCachePreferences(
  preferences: HotCachePreferences
): number {
  // This is a bounded metadata window, not a promise to cache full content.
  return preferences.recentDays === 90 ? 72 : 24;
}

export function notifyHotCachePreferencesChanged(
  preferences: HotCachePreferences
) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent(HOT_CACHE_PREFERENCES_CHANGED_EVENT, {
      detail: { preferences },
    })
  );

  try {
    window.localStorage.setItem(
      HOT_CACHE_PREFERENCES_CHANGED_STORAGE_KEY,
      String(Date.now())
    );
  } catch {
    // localStorage is only a cross-tab hint; workspace_settings is durable.
  }
}

export function parseHotCachePreferences(
  setting: WorkspaceSettingRecord | null
): HotCachePreferences {
  if (!setting?.valueJson) return DEFAULT_HOT_CACHE_PREFERENCES;

  try {
    const parsed = JSON.parse(setting.valueJson) as Partial<HotCachePreferences>;
    return normalizeHotCachePreferences(parsed);
  } catch {
    return DEFAULT_HOT_CACHE_PREFERENCES;
  }
}

export function normalizeHotCachePreferences(
  value: Partial<HotCachePreferences>
): HotCachePreferences {
  return {
    recentDays: value.recentDays === 90 ? 90 : 30,
    keepCurrentMonthDailyNotes:
      typeof value.keepCurrentMonthDailyNotes === "boolean"
        ? value.keepCurrentMonthDailyNotes
        : DEFAULT_HOT_CACHE_PREFERENCES.keepCurrentMonthDailyNotes,
    keepActiveDatabases:
      typeof value.keepActiveDatabases === "boolean"
        ? value.keepActiveDatabases
        : DEFAULT_HOT_CACHE_PREFERENCES.keepActiveDatabases,
    keepRecentFilePreviews:
      typeof value.keepRecentFilePreviews === "boolean"
        ? value.keepRecentFilePreviews
        : DEFAULT_HOT_CACHE_PREFERENCES.keepRecentFilePreviews,
    keepFavoritePages:
      typeof value.keepFavoritePages === "boolean"
        ? value.keepFavoritePages
        : DEFAULT_HOT_CACHE_PREFERENCES.keepFavoritePages,
    keepCurrentProjects:
      typeof value.keepCurrentProjects === "boolean"
        ? value.keepCurrentProjects
        : DEFAULT_HOT_CACHE_PREFERENCES.keepCurrentProjects,
  };
}

export function buildHotCacheSelectionContract(input: {
  plan: HotCachePolicyPlan;
  setting: WorkspaceSettingRecord | null;
}): HotCacheSelectionContract {
  const preferences = parseHotCachePreferences(input.setting);
  const enabledPreferences = [
    preferences.keepCurrentMonthDailyNotes,
    preferences.keepActiveDatabases,
    preferences.keepRecentFilePreviews,
    preferences.keepFavoritePages,
    preferences.keepCurrentProjects,
  ].filter(Boolean).length;

  return {
    format: "zhinote-hot-cache-selection-contract",
    format_version: 1,
    contract_status: "local-settings-pending-contract",
    architecture_target: "cloud-master-local-hot-cache",
    setting_key: HOT_CACHE_PREFERENCES_SETTING_KEY,
    cloud_target: "workspaces.settings.hot_cache_preferences",
    local_target: "workspace_settings.value_json",
    pending_queue_table: "sync_log",
    privacy_boundary:
      "User hot-cache choices are settings metadata. Saving them writes one workspace_settings row and one pending sync_log row; it does not upload workspace content, read page bodies, read file bytes, or evict local cache records.",
    boundary: {
      reads_page_body_text: false,
      reads_page_yjs: false,
      reads_database_row_values: false,
      reads_comment_bodies: false,
      reads_file_bytes: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      mutates_cache_records: false,
      saves_user_setting_locally: true,
      queues_pending_setting_change: true,
    },
    summary: {
      has_local_setting: Boolean(input.setting),
      enabled_preferences: enabledPreferences,
      recent_days: preferences.recentDays,
      plan_policy_hash: input.plan.summary.policy_hash,
      pending_rows: input.plan.summary.pending_sync_rows,
    },
    allowed_preference_keys: [
      "recentDays",
      "keepCurrentMonthDailyNotes",
      "keepActiveDatabases",
      "keepRecentFilePreviews",
      "keepFavoritePages",
      "keepCurrentProjects",
    ],
    sync_rule: {
      ordinary_sync_pending_only: true,
      row_id: HOT_CACHE_PREFERENCES_SETTING_KEY,
      table_name: "workspace_settings",
      changed_cols: ["value_json", "source", "updated_at"],
      cloud_wins_except_unsynced_local_setting: true,
    },
    forbidden_payload_fields: [
      "page_body",
      "content_text",
      "content_yjs",
      "database_row_values",
      "comment_body",
      "file_bytes",
      "file_text",
      "raw_cache_dump",
    ],
    preferences,
  };
}
