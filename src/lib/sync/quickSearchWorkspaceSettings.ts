import type { WorkspaceSettingRecord } from "@/lib/db/local/queries";

export const QUICK_SEARCH_SAVED_SEARCHES_SETTING_KEY =
  "quick_search.savedSearches.v1";
export const QUICK_SEARCH_SAVED_SEARCHES_CLOUD_FIELD =
  "quick_search_saved_searches";

export interface QuickSearchSavedSearchesWorkspaceSettingValue {
  saved_searches: string[];
}

export interface QuickSearchSavedSearchesWorkspaceSettingsCloudPayload {
  setting_key: typeof QUICK_SEARCH_SAVED_SEARCHES_SETTING_KEY;
  client_pending_row_id: typeof QUICK_SEARCH_SAVED_SEARCHES_SETTING_KEY;
  saved_searches: string[];
}

export interface ParsedQuickSearchSavedSearchesWorkspaceSettingsCloudValue {
  setting_found: boolean;
  cloud_value_valid: boolean;
  saved_at: string | null;
  saved_searches: string[];
}

export interface QuickSearchSavedSearchesWorkspaceSettingsCloudReceipt {
  format: "zhinote-quick-search-saved-searches-settings-cloud-receipt";
  format_version: 1;
  setting_key: typeof QUICK_SEARCH_SAVED_SEARCHES_SETTING_KEY;
  cloud_target: "workspaces.settings.quick_search_saved_searches";
  workspace_id: string;
  saved_at: string;
  role: "owner" | "researcher";
  summary: {
    writes_workspace_settings: true;
    uploads_workspace_content: false;
    reads_page_body_text: false;
    reads_page_titles: false;
    reads_database_row_values: false;
    reads_file_bytes: false;
    acknowledges_pending_row: typeof QUICK_SEARCH_SAVED_SEARCHES_SETTING_KEY;
    saved_search_count: number;
  };
  sync_rule: {
    ordinary_sync_pending_only: true;
    local_pending_table: "sync_log";
    local_pending_row_id: typeof QUICK_SEARCH_SAVED_SEARCHES_SETTING_KEY;
    cloud_wins_except_unsynced_local_setting: true;
  };
  privacy_note: string;
}

export type QuickSearchSavedSearchesWorkspaceSettingsValidationResult =
  | {
      ok: true;
      payload: QuickSearchSavedSearchesWorkspaceSettingsCloudPayload;
    }
  | {
      ok: false;
      message: string;
    };

const MAX_SAVED_SEARCHES = 10;

const FORBIDDEN_PAYLOAD_FIELDS = [
  "title",
  "page_title",
  "database_title",
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

export function isQuickSearchSavedSearchesWorkspaceSettingKey(
  value: unknown
): value is typeof QUICK_SEARCH_SAVED_SEARCHES_SETTING_KEY {
  return value === QUICK_SEARCH_SAVED_SEARCHES_SETTING_KEY;
}

export function normalizeQuickSearchSavedSearches(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const searches: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const query = item.trim().replace(/\s+/g, " ").slice(0, 120);
    const key = query.toLowerCase();
    if (!query || seen.has(key)) continue;
    seen.add(key);
    searches.push(query);
    if (searches.length >= MAX_SAVED_SEARCHES) break;
  }
  return searches;
}

export function parseQuickSearchSavedSearchesWorkspaceSetting(
  setting: WorkspaceSettingRecord | null
): QuickSearchSavedSearchesWorkspaceSettingValue {
  if (!setting?.valueJson) {
    return { saved_searches: [] };
  }

  try {
    const parsed = JSON.parse(setting.valueJson) as unknown;
    return parseQuickSearchSavedSearchesWorkspaceSettingValue(parsed);
  } catch {
    return { saved_searches: [] };
  }
}

export function parseQuickSearchSavedSearchesWorkspaceSettingValue(
  value: unknown
): QuickSearchSavedSearchesWorkspaceSettingValue {
  if (!isPlainRecord(value)) {
    return { saved_searches: [] };
  }

  return {
    saved_searches: normalizeQuickSearchSavedSearches(
      value.saved_searches ?? value.savedSearches ?? value.searches
    ),
  };
}

export function validateQuickSearchSavedSearchesWorkspaceSettingsCloudPayload(
  body: unknown
): QuickSearchSavedSearchesWorkspaceSettingsValidationResult {
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
      message: `请求体不能包含 ${forbiddenField}。保存的搜索只接受搜索词 metadata。`,
    };
  }

  if (body.setting_key !== QUICK_SEARCH_SAVED_SEARCHES_SETTING_KEY) {
    return {
      ok: false,
      message: `setting_key 必须是 ${QUICK_SEARCH_SAVED_SEARCHES_SETTING_KEY}。`,
    };
  }

  if (!Array.isArray(body.saved_searches)) {
    return {
      ok: false,
      message: "quick_search.savedSearches.v1 需要提供 saved_searches 数组。",
    };
  }

  return {
    ok: true,
    payload: {
      setting_key: QUICK_SEARCH_SAVED_SEARCHES_SETTING_KEY,
      client_pending_row_id: QUICK_SEARCH_SAVED_SEARCHES_SETTING_KEY,
      saved_searches: normalizeQuickSearchSavedSearches(body.saved_searches),
    },
  };
}

export function buildQuickSearchSavedSearchesWorkspaceSettingsCloudValue(
  payload: QuickSearchSavedSearchesWorkspaceSettingsCloudPayload,
  savedAt: string
) {
  return {
    format: "zhinote-quick-search-saved-searches-settings-cloud-value",
    format_version: 1,
    setting_key: payload.setting_key,
    saved_at: savedAt,
    source: "zhinotes-quick-search-ui",
    saved_searches: payload.saved_searches,
    privacy_boundary:
      "Quick search saved-search metadata only. No page title, page body, database row value, comment body, file byte, token, or raw local cache dump is stored here.",
  };
}

export function parseQuickSearchSavedSearchesWorkspaceSettingsCloudValue(
  settings: Record<string, unknown> | null
): ParsedQuickSearchSavedSearchesWorkspaceSettingsCloudValue {
  const value = settings?.[QUICK_SEARCH_SAVED_SEARCHES_CLOUD_FIELD];
  if (value === undefined || value === null) {
    return {
      setting_found: false,
      cloud_value_valid: true,
      saved_at: null,
      saved_searches: [],
    };
  }

  if (!isPlainRecord(value)) {
    return {
      setting_found: true,
      cloud_value_valid: false,
      saved_at: null,
      saved_searches: [],
    };
  }

  return {
    setting_found: true,
    cloud_value_valid:
      value.format ===
        "zhinote-quick-search-saved-searches-settings-cloud-value" &&
      value.format_version === 1 &&
      value.setting_key === QUICK_SEARCH_SAVED_SEARCHES_SETTING_KEY &&
      Array.isArray(value.saved_searches),
    saved_at: typeof value.saved_at === "string" ? value.saved_at : null,
    saved_searches: normalizeQuickSearchSavedSearches(value.saved_searches),
  };
}

export function buildQuickSearchSavedSearchesWorkspaceSettingsCloudReceipt(input: {
  workspaceId: string;
  role: "owner" | "researcher";
  savedAt: string;
  payload: QuickSearchSavedSearchesWorkspaceSettingsCloudPayload;
}): QuickSearchSavedSearchesWorkspaceSettingsCloudReceipt {
  return {
    format: "zhinote-quick-search-saved-searches-settings-cloud-receipt",
    format_version: 1,
    setting_key: QUICK_SEARCH_SAVED_SEARCHES_SETTING_KEY,
    cloud_target: "workspaces.settings.quick_search_saved_searches",
    workspace_id: input.workspaceId,
    saved_at: input.savedAt,
    role: input.role,
    summary: {
      writes_workspace_settings: true,
      uploads_workspace_content: false,
      reads_page_body_text: false,
      reads_page_titles: false,
      reads_database_row_values: false,
      reads_file_bytes: false,
      acknowledges_pending_row: input.payload.client_pending_row_id,
      saved_search_count: input.payload.saved_searches.length,
    },
    sync_rule: {
      ordinary_sync_pending_only: true,
      local_pending_table: "sync_log",
      local_pending_row_id: input.payload.client_pending_row_id,
      cloud_wins_except_unsynced_local_setting: true,
    },
    privacy_note:
      "This receipt confirms only quick search saved-search metadata was saved to workspaces.settings. It does not upload notes, page titles, database rows, comments, versions, files, or local cache dumps.",
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
