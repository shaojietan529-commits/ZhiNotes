import {
  HOT_CACHE_PREFERENCES_SETTING_KEY,
  normalizeHotCachePreferences,
  type HotCachePreferences,
} from "@/lib/sync/hotCacheSelectionSettings";

export const HOT_CACHE_CLOUD_TARGET =
  "workspaces.settings.hot_cache_preferences" as const;
export const HOT_CACHE_SETTINGS_CLOUD_PAYLOAD_MAX_BYTES = 8_000;

export const HOT_CACHE_SETTINGS_FORBIDDEN_FIELDS = [
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
] as const;

type HotCacheSettingsCloudRole = "owner" | "researcher" | "viewer";

export interface HotCacheSettingsCloudPayload {
  setting_key: typeof HOT_CACHE_PREFERENCES_SETTING_KEY;
  preferences: HotCachePreferences;
  client_pending_row_id: typeof HOT_CACHE_PREFERENCES_SETTING_KEY;
}

export interface HotCacheSettingsCloudReceipt {
  format: "zhinote-hot-cache-settings-cloud-receipt";
  format_version: 1;
  setting_key: typeof HOT_CACHE_PREFERENCES_SETTING_KEY;
  cloud_target: typeof HOT_CACHE_CLOUD_TARGET;
  workspace_id: string;
  saved_at: string;
  role: "owner" | "researcher";
  summary: {
    uploaded_preference_keys: number;
    writes_workspace_settings: true;
    uploads_workspace_content: false;
    reads_page_body_text: false;
    reads_file_bytes: false;
    acknowledges_pending_row: typeof HOT_CACHE_PREFERENCES_SETTING_KEY;
  };
  sync_rule: {
    ordinary_sync_pending_only: true;
    local_pending_table: "sync_log";
    local_pending_row_id: typeof HOT_CACHE_PREFERENCES_SETTING_KEY;
    cloud_wins_except_unsynced_local_setting: true;
  };
  privacy_note: string;
}

export interface ParsedHotCacheSettingsCloudValue {
  setting_found: boolean;
  cloud_value_valid: boolean;
  saved_at: string | null;
  preferences: HotCachePreferences;
}

export interface HotCacheSettingsCloudReadReceipt {
  format: "zhinote-hot-cache-settings-cloud-read-receipt";
  format_version: 1;
  setting_key: typeof HOT_CACHE_PREFERENCES_SETTING_KEY;
  cloud_target: typeof HOT_CACHE_CLOUD_TARGET;
  workspace_id: string;
  read_at: string;
  role: HotCacheSettingsCloudRole;
  setting_found: boolean;
  cloud_value_valid: boolean;
  saved_at: string | null;
  preferences: HotCachePreferences;
  summary: {
    reads_workspace_settings: true;
    writes_workspace_settings: false;
    uploads_workspace_content: false;
    reads_page_body_text: false;
    reads_file_bytes: false;
    returns_cache_preferences_only: true;
  };
  sync_rule: {
    ordinary_sync_pending_only: true;
    local_pending_table: "sync_log";
    local_pending_row_id: typeof HOT_CACHE_PREFERENCES_SETTING_KEY;
    cloud_wins_except_unsynced_local_setting: true;
    local_unsynced_setting_must_block_pull: true;
  };
  privacy_note: string;
}

export type HotCacheSettingsValidationResult =
  | {
      ok: true;
      payload: HotCacheSettingsCloudPayload;
    }
  | {
      ok: false;
      message: string;
    };

export function validateHotCacheSettingsCloudPayload(
  body: unknown
): HotCacheSettingsValidationResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      ok: false,
      message: "请求体必须是 JSON object。",
    };
  }

  const forbiddenField = findForbiddenPayloadField(body);
  if (forbiddenField) {
    return {
      ok: false,
      message: `请求体不能包含 ${forbiddenField}。这里只能同步热缓存偏好元数据。`,
    };
  }

  const record = body as Record<string, unknown>;
  if (record.setting_key !== HOT_CACHE_PREFERENCES_SETTING_KEY) {
    return {
      ok: false,
      message: `setting_key 必须是 ${HOT_CACHE_PREFERENCES_SETTING_KEY}。`,
    };
  }

  if (!record.preferences || typeof record.preferences !== "object") {
    return {
      ok: false,
      message: "preferences 必须是对象。",
    };
  }

  return {
    ok: true,
    payload: {
      setting_key: HOT_CACHE_PREFERENCES_SETTING_KEY,
      preferences: normalizeHotCachePreferences(
        record.preferences as Partial<HotCachePreferences>
      ),
      client_pending_row_id: HOT_CACHE_PREFERENCES_SETTING_KEY,
    },
  };
}

export function buildHotCacheSettingsCloudValue(
  payload: HotCacheSettingsCloudPayload,
  savedAt: string
) {
  return {
    format: "zhinote-hot-cache-settings-cloud-value",
    format_version: 1,
    setting_key: payload.setting_key,
    preferences: payload.preferences,
    saved_at: savedAt,
    source: "zhinotes-hot-cache-settings-ui",
    privacy_boundary:
      "Settings metadata only. No page body, database row value, comment body, file byte, token, or raw local cache dump is stored here.",
  };
}

export function parseHotCacheSettingsCloudValue(
  settings: Record<string, unknown> | null
): ParsedHotCacheSettingsCloudValue {
  const value = settings?.hot_cache_preferences;
  if (value === undefined || value === null) {
    return {
      setting_found: false,
      cloud_value_valid: true,
      saved_at: null,
      preferences: normalizeHotCachePreferences({}),
    };
  }

  if (!isPlainRecord(value)) {
    return {
      setting_found: true,
      cloud_value_valid: false,
      saved_at: null,
      preferences: normalizeHotCachePreferences({}),
    };
  }

  const preferences = isPlainRecord(value.preferences)
    ? normalizeHotCachePreferences(value.preferences as Partial<HotCachePreferences>)
    : normalizeHotCachePreferences({});
  const savedAt = typeof value.saved_at === "string" ? value.saved_at : null;

  return {
    setting_found: true,
    cloud_value_valid:
      value.format === "zhinote-hot-cache-settings-cloud-value" &&
      value.format_version === 1 &&
      value.setting_key === HOT_CACHE_PREFERENCES_SETTING_KEY &&
      isPlainRecord(value.preferences),
    saved_at: savedAt,
    preferences,
  };
}

export function buildHotCacheSettingsCloudReceipt(input: {
  workspaceId: string;
  role: "owner" | "researcher";
  savedAt: string;
  payload: HotCacheSettingsCloudPayload;
}): HotCacheSettingsCloudReceipt {
  return {
    format: "zhinote-hot-cache-settings-cloud-receipt",
    format_version: 1,
    setting_key: input.payload.setting_key,
    cloud_target: HOT_CACHE_CLOUD_TARGET,
    workspace_id: input.workspaceId,
    saved_at: input.savedAt,
    role: input.role,
    summary: {
      uploaded_preference_keys: Object.keys(input.payload.preferences).length,
      writes_workspace_settings: true,
      uploads_workspace_content: false,
      reads_page_body_text: false,
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
      "This receipt confirms only the hot-cache preference setting was saved to workspaces.settings. It does not upload notes, files, database rows, comments, versions, or local cache dumps.",
  };
}

export function buildHotCacheSettingsCloudReadReceipt(input: {
  workspaceId: string;
  role: HotCacheSettingsCloudRole;
  readAt: string;
  parsed: ParsedHotCacheSettingsCloudValue;
}): HotCacheSettingsCloudReadReceipt {
  return {
    format: "zhinote-hot-cache-settings-cloud-read-receipt",
    format_version: 1,
    setting_key: HOT_CACHE_PREFERENCES_SETTING_KEY,
    cloud_target: HOT_CACHE_CLOUD_TARGET,
    workspace_id: input.workspaceId,
    read_at: input.readAt,
    role: input.role,
    setting_found: input.parsed.setting_found,
    cloud_value_valid: input.parsed.cloud_value_valid,
    saved_at: input.parsed.saved_at,
    preferences: input.parsed.preferences,
    summary: {
      reads_workspace_settings: true,
      writes_workspace_settings: false,
      uploads_workspace_content: false,
      reads_page_body_text: false,
      reads_file_bytes: false,
      returns_cache_preferences_only: true,
    },
    sync_rule: {
      ordinary_sync_pending_only: true,
      local_pending_table: "sync_log",
      local_pending_row_id: HOT_CACHE_PREFERENCES_SETTING_KEY,
      cloud_wins_except_unsynced_local_setting: true,
      local_unsynced_setting_must_block_pull: true,
    },
    privacy_note:
      "This read receipt returns only the hot-cache preference setting from workspaces.settings. It does not read note bodies, files, database rows, comments, versions, or raw local cache dumps.",
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
    const forbidden = HOT_CACHE_SETTINGS_FORBIDDEN_FIELDS.find(
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
