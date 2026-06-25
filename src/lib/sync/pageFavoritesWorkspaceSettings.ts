import type { WorkspaceSettingRecord } from "@/lib/db/local/queries";

export const PAGE_FAVORITES_SETTING_KEY = "page.favorites.v1";
export const PAGE_FAVORITES_CLOUD_FIELD = "page_favorites";

export interface PageFavoritesWorkspaceSettingValue {
  favorite_page_ids: string[];
}

export interface PageFavoritesWorkspaceSettingsCloudPayload {
  setting_key: typeof PAGE_FAVORITES_SETTING_KEY;
  client_pending_row_id: typeof PAGE_FAVORITES_SETTING_KEY;
  favorite_page_ids: string[];
}

export interface ParsedPageFavoritesWorkspaceSettingsCloudValue {
  setting_found: boolean;
  cloud_value_valid: boolean;
  saved_at: string | null;
  favorite_page_ids: string[];
}

export interface PageFavoritesWorkspaceSettingsCloudReceipt {
  format: "zhinote-page-favorites-settings-cloud-receipt";
  format_version: 1;
  setting_key: typeof PAGE_FAVORITES_SETTING_KEY;
  cloud_target: "workspaces.settings.page_favorites";
  workspace_id: string;
  saved_at: string;
  role: "owner" | "researcher";
  summary: {
    writes_workspace_settings: true;
    uploads_workspace_content: false;
    reads_page_body_text: false;
    reads_page_titles: false;
    reads_file_bytes: false;
    acknowledges_pending_row: typeof PAGE_FAVORITES_SETTING_KEY;
    favorite_page_count: number;
  };
  sync_rule: {
    ordinary_sync_pending_only: true;
    local_pending_table: "sync_log";
    local_pending_row_id: typeof PAGE_FAVORITES_SETTING_KEY;
    cloud_wins_except_unsynced_local_setting: true;
  };
  privacy_note: string;
}

export type PageFavoritesWorkspaceSettingsValidationResult =
  | {
      ok: true;
      payload: PageFavoritesWorkspaceSettingsCloudPayload;
    }
  | {
      ok: false;
      message: string;
    };

const FORBIDDEN_PAYLOAD_FIELDS = [
  "title",
  "page_title",
  "content",
  "content_text",
  "content_yjs",
  "page_body",
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

export function isPageFavoritesWorkspaceSettingKey(
  value: unknown
): value is typeof PAGE_FAVORITES_SETTING_KEY {
  return value === PAGE_FAVORITES_SETTING_KEY;
}

export function normalizePageFavoriteIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const ids: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const id = item.trim().slice(0, 80);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= 64) break;
  }
  return ids;
}

export function parsePageFavoritesWorkspaceSetting(
  setting: WorkspaceSettingRecord | null
): PageFavoritesWorkspaceSettingValue {
  if (!setting?.valueJson) {
    return { favorite_page_ids: [] };
  }

  try {
    const parsed = JSON.parse(setting.valueJson) as unknown;
    return parsePageFavoritesWorkspaceSettingValue(parsed);
  } catch {
    return { favorite_page_ids: [] };
  }
}

export function parsePageFavoritesWorkspaceSettingValue(
  value: unknown
): PageFavoritesWorkspaceSettingValue {
  if (!isPlainRecord(value)) {
    return { favorite_page_ids: [] };
  }

  return {
    favorite_page_ids: normalizePageFavoriteIds(
      value.favorite_page_ids ?? value.favoritePageIds ?? value.ids
    ),
  };
}

export function validatePageFavoritesWorkspaceSettingsCloudPayload(
  body: unknown
): PageFavoritesWorkspaceSettingsValidationResult {
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
      message: `请求体不能包含 ${forbiddenField}。页面收藏只接受页面 ID metadata。`,
    };
  }

  if (body.setting_key !== PAGE_FAVORITES_SETTING_KEY) {
    return {
      ok: false,
      message: `setting_key 必须是 ${PAGE_FAVORITES_SETTING_KEY}。`,
    };
  }

  if (!Array.isArray(body.favorite_page_ids)) {
    return {
      ok: false,
      message: "page.favorites.v1 需要提供 favorite_page_ids 数组。",
    };
  }

  return {
    ok: true,
    payload: {
      setting_key: PAGE_FAVORITES_SETTING_KEY,
      client_pending_row_id: PAGE_FAVORITES_SETTING_KEY,
      favorite_page_ids: normalizePageFavoriteIds(body.favorite_page_ids),
    },
  };
}

export function buildPageFavoritesWorkspaceSettingsCloudValue(
  payload: PageFavoritesWorkspaceSettingsCloudPayload,
  savedAt: string
) {
  return {
    format: "zhinote-page-favorites-settings-cloud-value",
    format_version: 1,
    setting_key: payload.setting_key,
    saved_at: savedAt,
    source: "zhinotes-page-favorites-ui",
    favorite_page_ids: payload.favorite_page_ids,
    privacy_boundary:
      "Page favorite metadata only. No page title, page body, database row value, comment body, file byte, token, or raw local cache dump is stored here.",
  };
}

export function parsePageFavoritesWorkspaceSettingsCloudValue(
  settings: Record<string, unknown> | null
): ParsedPageFavoritesWorkspaceSettingsCloudValue {
  const value = settings?.[PAGE_FAVORITES_CLOUD_FIELD];
  if (value === undefined || value === null) {
    return {
      setting_found: false,
      cloud_value_valid: true,
      saved_at: null,
      favorite_page_ids: [],
    };
  }

  if (!isPlainRecord(value)) {
    return {
      setting_found: true,
      cloud_value_valid: false,
      saved_at: null,
      favorite_page_ids: [],
    };
  }

  return {
    setting_found: true,
    cloud_value_valid:
      value.format === "zhinote-page-favorites-settings-cloud-value" &&
      value.format_version === 1 &&
      value.setting_key === PAGE_FAVORITES_SETTING_KEY &&
      Array.isArray(value.favorite_page_ids),
    saved_at: typeof value.saved_at === "string" ? value.saved_at : null,
    favorite_page_ids: normalizePageFavoriteIds(value.favorite_page_ids),
  };
}

export function buildPageFavoritesWorkspaceSettingsCloudReceipt(input: {
  workspaceId: string;
  role: "owner" | "researcher";
  savedAt: string;
  payload: PageFavoritesWorkspaceSettingsCloudPayload;
}): PageFavoritesWorkspaceSettingsCloudReceipt {
  return {
    format: "zhinote-page-favorites-settings-cloud-receipt",
    format_version: 1,
    setting_key: PAGE_FAVORITES_SETTING_KEY,
    cloud_target: "workspaces.settings.page_favorites",
    workspace_id: input.workspaceId,
    saved_at: input.savedAt,
    role: input.role,
    summary: {
      writes_workspace_settings: true,
      uploads_workspace_content: false,
      reads_page_body_text: false,
      reads_page_titles: false,
      reads_file_bytes: false,
      acknowledges_pending_row: input.payload.client_pending_row_id,
      favorite_page_count: input.payload.favorite_page_ids.length,
    },
    sync_rule: {
      ordinary_sync_pending_only: true,
      local_pending_table: "sync_log",
      local_pending_row_id: input.payload.client_pending_row_id,
      cloud_wins_except_unsynced_local_setting: true,
    },
    privacy_note:
      "This receipt confirms only favorite page ids were saved to workspaces.settings. It does not upload notes, page titles, files, database rows, comments, versions, or local cache dumps.",
  };
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
