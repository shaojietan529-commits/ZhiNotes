import type {
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

export const SUPPORTED_WORKSPACE_SETTING_SYNC_KEYS = [
  HOT_CACHE_PREFERENCES_SETTING_KEY,
  SIDEBAR_PRIMARY_ORDER_SETTING_KEY,
  SIDEBAR_PRIMARY_CUSTOMIZATION_SETTING_KEY,
  PAGE_FAVORITES_SETTING_KEY,
  PAGE_VIEW_PREFERENCES_SETTING_KEY,
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
