import type { WorkspaceSettingRecord } from "@/lib/db/local/queries";

export const PAGE_VIEW_PREFERENCES_SETTING_KEY = "page.viewPreferences.v1";
export const PAGE_VIEW_PREFERENCES_CLOUD_FIELD = "page_view_preferences";

export interface PageViewPreferencesWorkspaceSettingValue {
  wide_page: boolean;
  comments_panel_open: boolean;
  locked_page_ids: string[];
  child_tree_view_modes: Record<string, "list" | "calendar">;
}

export interface PageViewPreferencesWorkspaceSettingsCloudPayload
  extends PageViewPreferencesWorkspaceSettingValue {
  setting_key: typeof PAGE_VIEW_PREFERENCES_SETTING_KEY;
  client_pending_row_id: typeof PAGE_VIEW_PREFERENCES_SETTING_KEY;
}

export interface ParsedPageViewPreferencesWorkspaceSettingsCloudValue
  extends PageViewPreferencesWorkspaceSettingValue {
  setting_found: boolean;
  cloud_value_valid: boolean;
  saved_at: string | null;
}

export interface PageViewPreferencesWorkspaceSettingsCloudReceipt {
  format: "zhinote-page-view-preferences-settings-cloud-receipt";
  format_version: 1;
  setting_key: typeof PAGE_VIEW_PREFERENCES_SETTING_KEY;
  cloud_target: "workspaces.settings.page_view_preferences";
  workspace_id: string;
  saved_at: string;
  role: "owner" | "researcher";
  summary: {
    writes_workspace_settings: true;
    uploads_workspace_content: false;
    reads_page_body_text: false;
    reads_page_titles: false;
    reads_comment_bodies: false;
    reads_file_bytes: false;
    acknowledges_pending_row: typeof PAGE_VIEW_PREFERENCES_SETTING_KEY;
    locked_page_count: number;
    child_tree_view_mode_count: number;
  };
  sync_rule: {
    ordinary_sync_pending_only: true;
    local_pending_table: "sync_log";
    local_pending_row_id: typeof PAGE_VIEW_PREFERENCES_SETTING_KEY;
    cloud_wins_except_unsynced_local_setting: true;
  };
  privacy_note: string;
}

export type PageViewPreferencesWorkspaceSettingsValidationResult =
  | {
      ok: true;
      payload: PageViewPreferencesWorkspaceSettingsCloudPayload;
    }
  | {
      ok: false;
      message: string;
    };

const DEFAULT_PAGE_VIEW_PREFERENCES: PageViewPreferencesWorkspaceSettingValue = {
  wide_page: false,
  comments_panel_open: false,
  locked_page_ids: [],
  child_tree_view_modes: {},
};

const FORBIDDEN_PAYLOAD_FIELDS = [
  "title",
  "page_title",
  "content",
  "content_text",
  "content_yjs",
  "page_body",
  "comment",
  "comment_body",
  "comment_bodies",
  "database_row_values",
  "field_values",
  "file_bytes",
  "file_text",
  "token",
  "access_token",
  "refresh_token",
  "password",
] as const;

export function isPageViewPreferencesWorkspaceSettingKey(
  value: unknown
): value is typeof PAGE_VIEW_PREFERENCES_SETTING_KEY {
  return value === PAGE_VIEW_PREFERENCES_SETTING_KEY;
}

export function getDefaultPageViewPreferences(): PageViewPreferencesWorkspaceSettingValue {
  return {
    ...DEFAULT_PAGE_VIEW_PREFERENCES,
    child_tree_view_modes: {},
  };
}

export function normalizeLockedPageIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const ids: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const id = item.trim().slice(0, 80);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= 256) break;
  }
  return ids;
}

export function normalizeChildTreeViewModes(
  value: unknown
): Record<string, "list" | "calendar"> {
  if (!isPlainRecord(value)) return {};

  const output: Record<string, "list" | "calendar"> = {};
  for (const [rawPageId, rawMode] of Object.entries(value)) {
    const pageId = rawPageId.trim().slice(0, 80);
    if (!pageId) continue;
    if (rawMode !== "list" && rawMode !== "calendar") continue;
    output[pageId] = rawMode;
    if (Object.keys(output).length >= 256) break;
  }
  return output;
}

export function normalizePageViewPreferencesValue(
  value: unknown
): PageViewPreferencesWorkspaceSettingValue {
  if (!isPlainRecord(value)) {
    return getDefaultPageViewPreferences();
  }

  return {
    wide_page: Boolean(value.wide_page ?? value.widePage),
    comments_panel_open: Boolean(
      value.comments_panel_open ?? value.commentsPanelOpen
    ),
    locked_page_ids: normalizeLockedPageIds(
      value.locked_page_ids ?? value.lockedPageIds ?? value.locked_ids
    ),
    child_tree_view_modes: normalizeChildTreeViewModes(
      value.child_tree_view_modes ??
        value.childTreeViewModes ??
        value.childtree_view_modes
    ),
  };
}

export function parsePageViewPreferencesWorkspaceSetting(
  setting: WorkspaceSettingRecord | null
): PageViewPreferencesWorkspaceSettingValue {
  if (!setting?.valueJson) {
    return getDefaultPageViewPreferences();
  }

  try {
    const parsed = JSON.parse(setting.valueJson) as unknown;
    return parsePageViewPreferencesWorkspaceSettingValue(parsed);
  } catch {
    return getDefaultPageViewPreferences();
  }
}

export function parsePageViewPreferencesWorkspaceSettingValue(
  value: unknown
): PageViewPreferencesWorkspaceSettingValue {
  return normalizePageViewPreferencesValue(readSettingPayloadValue(value));
}

export function validatePageViewPreferencesWorkspaceSettingsCloudPayload(
  body: unknown
): PageViewPreferencesWorkspaceSettingsValidationResult {
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
      message: `请求体不能包含 ${forbiddenField}。页面视图偏好只接受页面 ID 和布尔设置 metadata。`,
    };
  }

  if (body.setting_key !== PAGE_VIEW_PREFERENCES_SETTING_KEY) {
    return {
      ok: false,
      message: `setting_key 必须是 ${PAGE_VIEW_PREFERENCES_SETTING_KEY}。`,
    };
  }

  return {
    ok: true,
    payload: {
      setting_key: PAGE_VIEW_PREFERENCES_SETTING_KEY,
      client_pending_row_id: PAGE_VIEW_PREFERENCES_SETTING_KEY,
      ...normalizePageViewPreferencesValue(body),
    },
  };
}

export function buildPageViewPreferencesWorkspaceSettingsCloudValue(
  payload: PageViewPreferencesWorkspaceSettingsCloudPayload,
  savedAt: string
) {
  return {
    format: "zhinote-page-view-preferences-settings-cloud-value",
    format_version: 1,
    setting_key: payload.setting_key,
    saved_at: savedAt,
    source: "zhinotes-page-view-preferences-ui",
    wide_page: payload.wide_page,
    comments_panel_open: payload.comments_panel_open,
    locked_page_ids: payload.locked_page_ids,
    child_tree_view_modes: payload.child_tree_view_modes,
    privacy_boundary:
      "Page view preference metadata only. No page title, page body, comment body, database row value, file byte, token, or raw local cache dump is stored here.",
  };
}

export function parsePageViewPreferencesWorkspaceSettingsCloudValue(
  settings: Record<string, unknown> | null
): ParsedPageViewPreferencesWorkspaceSettingsCloudValue {
  const value = settings?.[PAGE_VIEW_PREFERENCES_CLOUD_FIELD];
  if (value === undefined || value === null) {
    return {
      setting_found: false,
      cloud_value_valid: true,
      saved_at: null,
      ...getDefaultPageViewPreferences(),
    };
  }

  if (!isPlainRecord(value)) {
    return {
      setting_found: true,
      cloud_value_valid: false,
      saved_at: null,
      ...getDefaultPageViewPreferences(),
    };
  }

  const preferences = normalizePageViewPreferencesValue(value);
  return {
    setting_found: true,
    cloud_value_valid:
      value.format === "zhinote-page-view-preferences-settings-cloud-value" &&
      value.format_version === 1 &&
      value.setting_key === PAGE_VIEW_PREFERENCES_SETTING_KEY &&
      Array.isArray(value.locked_page_ids) &&
      (value.child_tree_view_modes === undefined ||
        isPlainRecord(value.child_tree_view_modes)),
    saved_at: typeof value.saved_at === "string" ? value.saved_at : null,
    ...preferences,
  };
}

export function buildPageViewPreferencesWorkspaceSettingsCloudReceipt(input: {
  workspaceId: string;
  role: "owner" | "researcher";
  savedAt: string;
  payload: PageViewPreferencesWorkspaceSettingsCloudPayload;
}): PageViewPreferencesWorkspaceSettingsCloudReceipt {
  return {
    format: "zhinote-page-view-preferences-settings-cloud-receipt",
    format_version: 1,
    setting_key: PAGE_VIEW_PREFERENCES_SETTING_KEY,
    cloud_target: "workspaces.settings.page_view_preferences",
    workspace_id: input.workspaceId,
    saved_at: input.savedAt,
    role: input.role,
    summary: {
      writes_workspace_settings: true,
      uploads_workspace_content: false,
      reads_page_body_text: false,
      reads_page_titles: false,
      reads_comment_bodies: false,
      reads_file_bytes: false,
      acknowledges_pending_row: input.payload.client_pending_row_id,
      locked_page_count: input.payload.locked_page_ids.length,
      child_tree_view_mode_count: Object.keys(
        input.payload.child_tree_view_modes
      ).length,
    },
    sync_rule: {
      ordinary_sync_pending_only: true,
      local_pending_table: "sync_log",
      local_pending_row_id: input.payload.client_pending_row_id,
      cloud_wins_except_unsynced_local_setting: true,
    },
    privacy_note:
      "This receipt confirms only page view preferences, child-tree view modes, and locked page ids were saved to workspaces.settings. It does not upload notes, page titles, comments, files, database rows, versions, or local cache dumps.",
  };
}

function readSettingPayloadValue(value: unknown): unknown {
  if (!isPlainRecord(value)) return null;
  if (
    "wide_page" in value ||
    "comments_panel_open" in value ||
    "locked_page_ids" in value ||
    "child_tree_view_modes" in value
  ) {
    return value;
  }
  return isPlainRecord(value.value) ? value.value : value;
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
    const forbidden = FORBIDDEN_PAYLOAD_FIELDS.find(
      (field) => field === normalizedKey
    );
    if (forbidden) return forbidden;

    const nestedMatch = findForbiddenPayloadField(nestedValue, depth + 1);
    if (nestedMatch) return nestedMatch;
  }

  return null;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
