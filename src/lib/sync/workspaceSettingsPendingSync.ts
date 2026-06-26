import type {
  RemoteWorkspaceSettingCacheRecord,
  SyncLogEntry,
  WorkspaceSettingRecord,
} from "@/lib/db/local/queries";
import {
  HOT_CACHE_PREFERENCES_SETTING_KEY,
  normalizeHotCachePreferences,
} from "@/lib/sync/hotCacheSelectionSettings";
import {
  SIDEBAR_PRIMARY_CUSTOMIZATION_SETTING_KEY,
  SIDEBAR_PRIMARY_ORDER_SETTING_KEY,
} from "@/lib/sync/sidebarWorkspaceSettings";
import {
  PAGE_FAVORITES_SETTING_KEY,
  parsePageFavoritesWorkspaceSettingValue,
} from "@/lib/sync/pageFavoritesWorkspaceSettings";
import {
  PAGE_VIEW_PREFERENCES_SETTING_KEY,
  parsePageViewPreferencesWorkspaceSettingValue,
} from "@/lib/sync/pageViewPreferencesWorkspaceSettings";
import {
  QUICK_SEARCH_SAVED_SEARCHES_SETTING_KEY,
  parseQuickSearchSavedSearchesWorkspaceSettingValue,
} from "@/lib/sync/quickSearchWorkspaceSettings";
import {
  CALENDAR_VIEW_STATE_SETTING_KEY,
  parseCalendarViewStateWorkspaceSettingValue,
} from "@/lib/sync/calendarViewStateWorkspaceSettings";
import {
  MEETING_REVIEW_STATE_SETTING_KEY,
  parseMeetingReviewStateWorkspaceSettingValue,
} from "@/lib/sync/meetingReviewStateWorkspaceSettings";
import {
  MEETING_DELETION_TOMBSTONES_SETTING_KEY,
  parseMeetingDeletionTombstonesWorkspaceSettingValue,
} from "@/lib/sync/meetingDeletionTombstonesWorkspaceSettings";

export const SUPPORTED_WORKSPACE_SETTING_SYNC_KEYS = [
  HOT_CACHE_PREFERENCES_SETTING_KEY,
  SIDEBAR_PRIMARY_ORDER_SETTING_KEY,
  SIDEBAR_PRIMARY_CUSTOMIZATION_SETTING_KEY,
  PAGE_FAVORITES_SETTING_KEY,
  PAGE_VIEW_PREFERENCES_SETTING_KEY,
  QUICK_SEARCH_SAVED_SEARCHES_SETTING_KEY,
  CALENDAR_VIEW_STATE_SETTING_KEY,
  MEETING_REVIEW_STATE_SETTING_KEY,
  MEETING_DELETION_TOMBSTONES_SETTING_KEY,
] as const;

export type SupportedWorkspaceSettingSyncKey =
  (typeof SUPPORTED_WORKSPACE_SETTING_SYNC_KEYS)[number];

export interface WorkspaceSettingPendingSyncPlan {
  format: "zhinote-workspace-settings-pending-sync-plan";
  format_version: 1;
  architecture_target: "cloud-master-local-settings-pending";
  ordinary_sync_pending_only: true;
  pending_queue_table: "sync_log";
  local_table: "workspace_settings";
  cloud_target: "workspaces.settings";
  supported_setting_keys: SupportedWorkspaceSettingSyncKey[];
  upload_keys: SupportedWorkspaceSettingSyncKey[];
  skipped_pending_keys: string[];
  missing_local_setting_keys: SupportedWorkspaceSettingSyncKey[];
  summary: {
    pending_rows_seen: number;
    uploadable_settings: number;
    skipped_pending_settings: number;
    missing_local_settings: number;
  };
  privacy_boundary: string;
}

export interface WorkspaceSettingsCloudRestorePlan {
  format: "zhinote-workspace-settings-cloud-restore-plan";
  format_version: 1;
  architecture_target: "cloud-master-local-cache-rebuild";
  direction: "cloud-to-local-cache";
  restore_allowed: boolean;
  blocked_reason:
    | null
    | "local-pending-settings"
    | "missing-cloud-summary"
    | "invalid-cloud-summary";
  local_pending_must_be_empty: true;
  cloud_value_valid: boolean;
  cloud_settings_found: boolean;
  pending_rows: Array<{
    table_name: "workspace_settings";
    row_id: string;
    status: string;
  }>;
  settings_to_restore: RemoteWorkspaceSettingCacheRecord[];
  invalid_setting_keys: string[];
  summary: {
    local_pending_rows: number;
    cloud_settings: number;
    total_restore_rows: number;
    invalid_setting_keys: number;
  };
  boundary: {
    reads_workspace_settings: true;
    writes_local_cache_records: true;
    writes_sync_log: false;
    uploads_workspace_content: false;
    reads_page_body_text: false;
    reads_page_titles: false;
    reads_meeting_titles: false;
    reads_database_row_values: false;
    reads_comment_bodies: false;
    reads_file_bytes: false;
    reads_secret_values: false;
  };
  privacy_boundary: string;
}

export type WorkspaceSettingCloudPayload =
  | {
      setting_key: typeof HOT_CACHE_PREFERENCES_SETTING_KEY;
      client_pending_row_id: typeof HOT_CACHE_PREFERENCES_SETTING_KEY;
      preferences: ReturnType<typeof normalizeHotCachePreferences>;
    }
  | {
      setting_key: typeof SIDEBAR_PRIMARY_ORDER_SETTING_KEY;
      client_pending_row_id: typeof SIDEBAR_PRIMARY_ORDER_SETTING_KEY;
      order: string[];
    }
  | {
      setting_key: typeof SIDEBAR_PRIMARY_CUSTOMIZATION_SETTING_KEY;
      client_pending_row_id: typeof SIDEBAR_PRIMARY_CUSTOMIZATION_SETTING_KEY;
      customizations: Record<string, { icon?: string; label?: string }>;
    }
  | {
      setting_key: typeof PAGE_FAVORITES_SETTING_KEY;
      client_pending_row_id: typeof PAGE_FAVORITES_SETTING_KEY;
      favorite_page_ids: string[];
    }
  | {
      setting_key: typeof PAGE_VIEW_PREFERENCES_SETTING_KEY;
      client_pending_row_id: typeof PAGE_VIEW_PREFERENCES_SETTING_KEY;
      wide_page: boolean;
      comments_panel_open: boolean;
      locked_page_ids: string[];
      child_tree_view_modes: Record<string, "list" | "calendar">;
    }
  | {
      setting_key: typeof QUICK_SEARCH_SAVED_SEARCHES_SETTING_KEY;
      client_pending_row_id: typeof QUICK_SEARCH_SAVED_SEARCHES_SETTING_KEY;
      saved_searches: string[];
    }
  | {
      setting_key: typeof CALENDAR_VIEW_STATE_SETTING_KEY;
      client_pending_row_id: typeof CALENDAR_VIEW_STATE_SETTING_KEY;
      daily_view_month: string | null;
      meeting_view_month: string | null;
    }
  | {
      setting_key: typeof MEETING_REVIEW_STATE_SETTING_KEY;
      client_pending_row_id: typeof MEETING_REVIEW_STATE_SETTING_KEY;
      seen_meeting_page_ids: string[];
      dismissed_trace_page_ids: string[];
    }
  | {
      setting_key: typeof MEETING_DELETION_TOMBSTONES_SETTING_KEY;
      client_pending_row_id: typeof MEETING_DELETION_TOMBSTONES_SETTING_KEY;
      deleted_meeting_page_ids: string[];
    };

export function buildWorkspaceSettingsPendingSyncPlan(input: {
  pendingEntries: SyncLogEntry[];
  settings: WorkspaceSettingRecord[];
}): WorkspaceSettingPendingSyncPlan {
  const pendingWorkspaceKeys = uniquePendingWorkspaceSettingKeys(
    input.pendingEntries
  );
  const settingsByKey = new Map(
    input.settings.map((setting) => [setting.key, setting])
  );
  const uploadKeys: SupportedWorkspaceSettingSyncKey[] = [];
  const skippedPendingKeys: string[] = [];
  const missingLocalSettingKeys: SupportedWorkspaceSettingSyncKey[] = [];

  for (const key of pendingWorkspaceKeys) {
    if (!isSupportedWorkspaceSettingSyncKey(key)) {
      skippedPendingKeys.push(key);
      continue;
    }
    if (!settingsByKey.has(key)) {
      missingLocalSettingKeys.push(key);
      continue;
    }
    uploadKeys.push(key);
  }

  return {
    format: "zhinote-workspace-settings-pending-sync-plan",
    format_version: 1,
    architecture_target: "cloud-master-local-settings-pending",
    ordinary_sync_pending_only: true,
    pending_queue_table: "sync_log",
    local_table: "workspace_settings",
    cloud_target: "workspaces.settings",
    supported_setting_keys: [...SUPPORTED_WORKSPACE_SETTING_SYNC_KEYS],
    upload_keys: uploadKeys,
    skipped_pending_keys: skippedPendingKeys,
    missing_local_setting_keys: missingLocalSettingKeys,
    summary: {
      pending_rows_seen: pendingWorkspaceKeys.length,
      uploadable_settings: uploadKeys.length,
      skipped_pending_settings: skippedPendingKeys.length,
      missing_local_settings: missingLocalSettingKeys.length,
    },
    privacy_boundary:
      "Only explicit workspace_settings rows that also have unsynced sync_log entries are uploaded. Page bodies, database row values, comments, files, tokens, and raw local cache dumps are never included.",
  };
}

export function buildWorkspaceSettingsCloudRestorePlan(input: {
  cloudReadBody: unknown;
  pendingEntries: SyncLogEntry[];
}): WorkspaceSettingsCloudRestorePlan {
  const pendingRows = input.pendingEntries
    .filter((entry) => entry.tableName === "workspace_settings")
    .map((entry) => ({
      table_name: "workspace_settings" as const,
      row_id: entry.rowId,
      status: entry.status,
    }));
  const parsed = parseWorkspaceSettingsCloudRestoreRecords(
    input.cloudReadBody
  );
  const blockedReason =
    pendingRows.length > 0
      ? "local-pending-settings"
      : !isPlainRecord(input.cloudReadBody)
        ? "missing-cloud-summary"
        : !parsed.cloudValueValid
          ? "invalid-cloud-summary"
          : null;

  return {
    format: "zhinote-workspace-settings-cloud-restore-plan",
    format_version: 1,
    architecture_target: "cloud-master-local-cache-rebuild",
    direction: "cloud-to-local-cache",
    restore_allowed: blockedReason === null,
    blocked_reason: blockedReason,
    local_pending_must_be_empty: true,
    cloud_value_valid: parsed.cloudValueValid,
    cloud_settings_found: parsed.settings.length > 0,
    pending_rows: pendingRows,
    settings_to_restore: parsed.settings,
    invalid_setting_keys: parsed.invalidSettingKeys,
    summary: {
      local_pending_rows: pendingRows.length,
      cloud_settings: parsed.settings.length,
      total_restore_rows: parsed.settings.length,
      invalid_setting_keys: parsed.invalidSettingKeys.length,
    },
    boundary: {
      reads_workspace_settings: true,
      writes_local_cache_records: true,
      writes_sync_log: false,
      uploads_workspace_content: false,
      reads_page_body_text: false,
      reads_page_titles: false,
      reads_meeting_titles: false,
      reads_database_row_values: false,
      reads_comment_bodies: false,
      reads_file_bytes: false,
      reads_secret_values: false,
    },
    privacy_boundary:
      "Cloud restore reads only workspace settings metadata from the workspace settings response and rebuilds local cache rows. It never uploads local data, writes sync_log, reads page bodies, page titles, meeting titles, database values, comments, files, secrets, or raw local cache dumps.",
  };
}

export function buildWorkspaceSettingCloudPayload(
  setting: WorkspaceSettingRecord
): WorkspaceSettingCloudPayload | null {
  const value = safeJsonParse(setting.valueJson);

  if (setting.key === HOT_CACHE_PREFERENCES_SETTING_KEY) {
    return {
      setting_key: HOT_CACHE_PREFERENCES_SETTING_KEY,
      client_pending_row_id: HOT_CACHE_PREFERENCES_SETTING_KEY,
      preferences: normalizeHotCachePreferences(
        isPlainRecord(value) ? value : {}
      ),
    };
  }

  if (setting.key === SIDEBAR_PRIMARY_ORDER_SETTING_KEY) {
    return {
      setting_key: SIDEBAR_PRIMARY_ORDER_SETTING_KEY,
      client_pending_row_id: SIDEBAR_PRIMARY_ORDER_SETTING_KEY,
      order: normalizeSidebarPrimaryOrder(
        readSettingPayloadValue(value, "order")
      ),
    };
  }

  if (setting.key === SIDEBAR_PRIMARY_CUSTOMIZATION_SETTING_KEY) {
    return {
      setting_key: SIDEBAR_PRIMARY_CUSTOMIZATION_SETTING_KEY,
      client_pending_row_id: SIDEBAR_PRIMARY_CUSTOMIZATION_SETTING_KEY,
      customizations: normalizeSidebarPrimaryCustomizations(
        readSettingPayloadValue(value, "customizations")
      ),
    };
  }

  if (setting.key === PAGE_FAVORITES_SETTING_KEY) {
    return {
      setting_key: PAGE_FAVORITES_SETTING_KEY,
      client_pending_row_id: PAGE_FAVORITES_SETTING_KEY,
      favorite_page_ids:
        parsePageFavoritesWorkspaceSettingValue(value).favorite_page_ids,
    };
  }

  if (setting.key === PAGE_VIEW_PREFERENCES_SETTING_KEY) {
    const pageViewPreferences =
      parsePageViewPreferencesWorkspaceSettingValue(value);
    return {
      setting_key: PAGE_VIEW_PREFERENCES_SETTING_KEY,
      client_pending_row_id: PAGE_VIEW_PREFERENCES_SETTING_KEY,
      wide_page: pageViewPreferences.wide_page,
      comments_panel_open: pageViewPreferences.comments_panel_open,
      locked_page_ids: pageViewPreferences.locked_page_ids,
      child_tree_view_modes: pageViewPreferences.child_tree_view_modes,
    };
  }

  if (setting.key === QUICK_SEARCH_SAVED_SEARCHES_SETTING_KEY) {
    return {
      setting_key: QUICK_SEARCH_SAVED_SEARCHES_SETTING_KEY,
      client_pending_row_id: QUICK_SEARCH_SAVED_SEARCHES_SETTING_KEY,
      saved_searches:
        parseQuickSearchSavedSearchesWorkspaceSettingValue(value)
          .saved_searches,
    };
  }

  if (setting.key === CALENDAR_VIEW_STATE_SETTING_KEY) {
    const calendarViewState =
      parseCalendarViewStateWorkspaceSettingValue(value);
    return {
      setting_key: CALENDAR_VIEW_STATE_SETTING_KEY,
      client_pending_row_id: CALENDAR_VIEW_STATE_SETTING_KEY,
      daily_view_month: calendarViewState.daily_view_month,
      meeting_view_month: calendarViewState.meeting_view_month,
    };
  }

  if (setting.key === MEETING_REVIEW_STATE_SETTING_KEY) {
    const meetingReviewState =
      parseMeetingReviewStateWorkspaceSettingValue(value);
    return {
      setting_key: MEETING_REVIEW_STATE_SETTING_KEY,
      client_pending_row_id: MEETING_REVIEW_STATE_SETTING_KEY,
      seen_meeting_page_ids: meetingReviewState.seen_meeting_page_ids,
      dismissed_trace_page_ids: meetingReviewState.dismissed_trace_page_ids,
    };
  }

  if (setting.key === MEETING_DELETION_TOMBSTONES_SETTING_KEY) {
    const meetingDeletionTombstones =
      parseMeetingDeletionTombstonesWorkspaceSettingValue(value);
    return {
      setting_key: MEETING_DELETION_TOMBSTONES_SETTING_KEY,
      client_pending_row_id: MEETING_DELETION_TOMBSTONES_SETTING_KEY,
      deleted_meeting_page_ids:
        meetingDeletionTombstones.deleted_meeting_page_ids,
    };
  }

  return null;
}

export function isSupportedWorkspaceSettingSyncKey(
  key: string
): key is SupportedWorkspaceSettingSyncKey {
  return SUPPORTED_WORKSPACE_SETTING_SYNC_KEYS.includes(
    key as SupportedWorkspaceSettingSyncKey
  );
}

function uniquePendingWorkspaceSettingKeys(entries: SyncLogEntry[]): string[] {
  const keys = new Set<string>();
  for (const entry of entries) {
    if (entry.tableName !== "workspace_settings") continue;
    if (!entry.rowId.trim()) continue;
    keys.add(entry.rowId.trim());
  }
  return [...keys];
}

function parseWorkspaceSettingsCloudRestoreRecords(value: unknown): {
  cloudValueValid: boolean;
  settings: RemoteWorkspaceSettingCacheRecord[];
  invalidSettingKeys: string[];
} {
  if (!isPlainRecord(value)) {
    return {
      cloudValueValid: false,
      settings: [],
      invalidSettingKeys: [],
    };
  }

  let valid = true;
  let summarySeen = false;
  const settings: RemoteWorkspaceSettingCacheRecord[] = [];
  const invalidSettingKeys: string[] = [];
  const markInvalid = (key: string) => {
    valid = false;
    invalidSettingKeys.push(key);
  };
  const addSetting = (
    key: SupportedWorkspaceSettingSyncKey,
    summary: Record<string, unknown> | null,
    valueBuilder: (summary: Record<string, unknown>) => Record<string, unknown>
  ) => {
    if (!summary) return;
    summarySeen = true;
    if (summary.setting_found !== true) {
      if (summary.cloud_value_valid === false) markInvalid(key);
      return;
    }
    if (summary.cloud_value_valid !== true) {
      markInvalid(key);
      return;
    }
    settings.push({
      key,
      value: valueBuilder(summary),
      savedAt: typeof summary.saved_at === "string" ? summary.saved_at : null,
    });
  };

  const hotCacheSummary =
    "setting_found" in value ||
    "cloud_value_valid" in value ||
    "preferences" in value
      ? value
      : null;
  addSetting(
    HOT_CACHE_PREFERENCES_SETTING_KEY,
    hotCacheSummary,
    (summary) =>
      normalizeHotCachePreferences(
        isPlainRecord(summary.preferences) ? summary.preferences : {}
      ) as unknown as Record<string, unknown>
  );

  const sidebarSettings = readRecord(value.sidebar_settings);
  if (sidebarSettings) {
    addSetting(
      SIDEBAR_PRIMARY_ORDER_SETTING_KEY,
      readRecord(sidebarSettings.order),
      (summary) => ({
        schema_version: 1,
        order: normalizeSidebarPrimaryOrder(summary.order),
        cloud_target: "workspaces.settings.sidebar_primary_order",
        ordinary_sync_pending_only: true,
      })
    );
    addSetting(
      SIDEBAR_PRIMARY_CUSTOMIZATION_SETTING_KEY,
      readRecord(sidebarSettings.customizations),
      (summary) => ({
        schema_version: 1,
        customizations: normalizeSidebarPrimaryCustomizations(
          summary.customizations
        ),
        cloud_target: "workspaces.settings.sidebar_primary_customization",
        ordinary_sync_pending_only: true,
      })
    );
  } else if (value.sidebar_settings !== undefined && value.sidebar_settings !== null) {
    markInvalid("sidebar_settings");
  }

  addSetting(
    PAGE_FAVORITES_SETTING_KEY,
    readRecord(value.page_favorites),
    (summary) => ({
      favorite_page_ids:
        parsePageFavoritesWorkspaceSettingValue(summary).favorite_page_ids,
    })
  );
  addSetting(
    PAGE_VIEW_PREFERENCES_SETTING_KEY,
    readRecord(value.page_view_preferences),
    (summary) => ({
      ...parsePageViewPreferencesWorkspaceSettingValue(summary),
    })
  );
  addSetting(
    QUICK_SEARCH_SAVED_SEARCHES_SETTING_KEY,
    readRecord(value.quick_search_saved_searches),
    (summary) => ({
      saved_searches:
        parseQuickSearchSavedSearchesWorkspaceSettingValue(summary)
          .saved_searches,
    })
  );
  addSetting(
    CALENDAR_VIEW_STATE_SETTING_KEY,
    readRecord(value.calendar_view_state),
    (summary) => {
      const parsed = parseCalendarViewStateWorkspaceSettingValue(summary);
      return {
        schema_version: 1,
        daily_view_month: parsed.daily_view_month,
        meeting_view_month: parsed.meeting_view_month,
        cloud_target: "workspaces.settings.calendar_view_state",
        ordinary_sync_pending_only: true,
      };
    }
  );
  addSetting(
    MEETING_REVIEW_STATE_SETTING_KEY,
    readRecord(value.meeting_review_state),
    (summary) => {
      const parsed = parseMeetingReviewStateWorkspaceSettingValue(summary);
      return {
        schema_version: 1,
        seen_meeting_page_ids: parsed.seen_meeting_page_ids,
        dismissed_trace_page_ids: parsed.dismissed_trace_page_ids,
        cloud_target: "workspaces.settings.meeting_review_state",
        ordinary_sync_pending_only: true,
      };
    }
  );
  addSetting(
    MEETING_DELETION_TOMBSTONES_SETTING_KEY,
    readRecord(value.meeting_deletion_tombstones),
    (summary) => {
      const parsed =
        parseMeetingDeletionTombstonesWorkspaceSettingValue(summary);
      return {
        schema_version: 1,
        deleted_meeting_page_ids: parsed.deleted_meeting_page_ids,
        cloud_target: "workspaces.settings.meeting_deletion_tombstones",
        ordinary_sync_pending_only: true,
      };
    }
  );

  return {
    cloudValueValid: summarySeen && valid,
    settings: valid ? settings : [],
    invalidSettingKeys,
  };
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return isPlainRecord(value) ? value : null;
}

function readSettingPayloadValue(value: unknown, field: string): unknown {
  if (!isPlainRecord(value)) return null;
  const direct = value[field];
  if (direct !== undefined) return direct;
  const nested = value.value;
  return isPlainRecord(nested) ? nested[field] : null;
}

function normalizeSidebarPrimaryOrder(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const order: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const id = item.trim().slice(0, 80);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    order.push(id);
    if (order.length >= 48) break;
  }
  return order;
}

function normalizeSidebarPrimaryCustomizations(
  value: unknown
): Record<string, { icon?: string; label?: string }> {
  if (!isPlainRecord(value)) return {};
  const output: Record<string, { icon?: string; label?: string }> = {};
  for (const [rawId, rawCustomization] of Object.entries(value)) {
    if (!isPlainRecord(rawCustomization)) continue;
    const id = rawId.trim().slice(0, 80);
    if (!id) continue;
    const icon =
      typeof rawCustomization.icon === "string"
        ? rawCustomization.icon.trim().slice(0, 8)
        : "";
    const label =
      typeof rawCustomization.label === "string"
        ? rawCustomization.label.trim().replace(/\s+/g, " ").slice(0, 24)
        : "";
    output[id] = {
      ...(icon ? { icon } : {}),
      ...(label ? { label } : {}),
    };
    if (Object.keys(output).length >= 48) break;
  }
  return output;
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
