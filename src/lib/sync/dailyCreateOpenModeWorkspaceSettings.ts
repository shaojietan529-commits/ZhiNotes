import type { WorkspaceSettingRecord } from "@/lib/db/local/queries";

export const DAILY_CREATE_OPEN_MODE_SETTING_KEY =
  "daily_create_open_mode.v1";
export const DAILY_CREATE_OPEN_MODE_CLOUD_FIELD =
  "daily_create_open_mode";
export const DAILY_CREATE_OPEN_MODE_CLOUD_TARGET =
  "workspaces.settings.daily_create_open_mode" as const;

export type DailyCreateOpenMode = "full-page" | "peek";

export interface DailyCreateOpenModeWorkspaceSettingValue {
  schema_version: 1;
  open_mode: DailyCreateOpenMode;
  cloud_target: typeof DAILY_CREATE_OPEN_MODE_CLOUD_TARGET;
  ordinary_sync_pending_only: true;
}

export interface DailyCreateOpenModeWorkspaceSettingsCloudPayload {
  setting_key: typeof DAILY_CREATE_OPEN_MODE_SETTING_KEY;
  client_pending_row_id: typeof DAILY_CREATE_OPEN_MODE_SETTING_KEY;
  open_mode: DailyCreateOpenMode;
}

export interface ParsedDailyCreateOpenModeWorkspaceSettingsCloudValue
  extends DailyCreateOpenModeWorkspaceSettingValue {
  setting_found: boolean;
  cloud_value_valid: boolean;
  saved_at: string | null;
}

export interface DailyCreateOpenModeWorkspaceSettingsCloudReceipt {
  format: "zhinote-daily-create-open-mode-settings-cloud-receipt";
  format_version: 1;
  setting_key: typeof DAILY_CREATE_OPEN_MODE_SETTING_KEY;
  cloud_target: typeof DAILY_CREATE_OPEN_MODE_CLOUD_TARGET;
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
    acknowledges_pending_row: typeof DAILY_CREATE_OPEN_MODE_SETTING_KEY;
    saved_open_mode: DailyCreateOpenMode;
  };
  sync_rule: {
    ordinary_sync_pending_only: true;
    local_pending_table: "sync_log";
    local_pending_row_id: typeof DAILY_CREATE_OPEN_MODE_SETTING_KEY;
    cloud_wins_except_unsynced_local_setting: true;
  };
  privacy_note: string;
}

export type DailyCreateOpenModeWorkspaceSettingsValidationResult =
  | {
      ok: true;
      payload: DailyCreateOpenModeWorkspaceSettingsCloudPayload;
    }
  | {
      ok: false;
      message: string;
    };

export const DEFAULT_DAILY_CREATE_OPEN_MODE: DailyCreateOpenMode =
  "full-page";

const FORBIDDEN_PAYLOAD_FIELDS = [
  "title",
  "page_title",
  "meeting_title",
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

export function isDailyCreateOpenModeWorkspaceSettingKey(
  value: unknown
): value is typeof DAILY_CREATE_OPEN_MODE_SETTING_KEY {
  return value === DAILY_CREATE_OPEN_MODE_SETTING_KEY;
}

export function normalizeDailyCreateOpenMode(
  value: unknown
): DailyCreateOpenMode {
  if (value === "peek") return "peek";
  if (value === "full-page") return "full-page";

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    return normalizeDailyCreateOpenMode(
      record.open_mode ?? record.openMode ?? record.mode
    );
  }

  return DEFAULT_DAILY_CREATE_OPEN_MODE;
}

export function buildDailyCreateOpenModeWorkspaceSettingValue(
  openMode: DailyCreateOpenMode
): DailyCreateOpenModeWorkspaceSettingValue {
  return {
    schema_version: 1,
    open_mode: normalizeDailyCreateOpenMode(openMode),
    cloud_target: DAILY_CREATE_OPEN_MODE_CLOUD_TARGET,
    ordinary_sync_pending_only: true,
  };
}

export function parseDailyCreateOpenModeWorkspaceSetting(
  setting: WorkspaceSettingRecord | null
): DailyCreateOpenModeWorkspaceSettingValue {
  if (!setting?.valueJson) {
    return buildDailyCreateOpenModeWorkspaceSettingValue(
      DEFAULT_DAILY_CREATE_OPEN_MODE
    );
  }

  try {
    return parseDailyCreateOpenModeWorkspaceSettingValue(
      JSON.parse(setting.valueJson)
    );
  } catch {
    return buildDailyCreateOpenModeWorkspaceSettingValue(
      DEFAULT_DAILY_CREATE_OPEN_MODE
    );
  }
}

export function parseDailyCreateOpenModeWorkspaceSettingValue(
  value: unknown
): DailyCreateOpenModeWorkspaceSettingValue {
  return buildDailyCreateOpenModeWorkspaceSettingValue(
    normalizeDailyCreateOpenMode(value)
  );
}

export function validateDailyCreateOpenModeWorkspaceSettingsCloudPayload(
  body: unknown
): DailyCreateOpenModeWorkspaceSettingsValidationResult {
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
      message: `请求体不能包含 ${forbiddenField}。每日纪要打开方式只接受 open_mode metadata。`,
    };
  }

  if (body.setting_key !== DAILY_CREATE_OPEN_MODE_SETTING_KEY) {
    return {
      ok: false,
      message: `setting_key 必须是 ${DAILY_CREATE_OPEN_MODE_SETTING_KEY}。`,
    };
  }

  if (body.open_mode !== "full-page" && body.open_mode !== "peek") {
    return {
      ok: false,
      message: "open_mode 必须是 full-page 或 peek。",
    };
  }

  return {
    ok: true,
    payload: {
      setting_key: DAILY_CREATE_OPEN_MODE_SETTING_KEY,
      client_pending_row_id: DAILY_CREATE_OPEN_MODE_SETTING_KEY,
      open_mode: body.open_mode,
    },
  };
}

export function buildDailyCreateOpenModeWorkspaceSettingsCloudValue(
  payload: DailyCreateOpenModeWorkspaceSettingsCloudPayload,
  savedAt: string
) {
  return {
    format: "zhinote-daily-create-open-mode-settings-cloud-value",
    format_version: 1,
    setting_key: payload.setting_key,
    saved_at: savedAt,
    source: "zhinotes-daily-create-open-mode-ui",
    open_mode: normalizeDailyCreateOpenMode(payload.open_mode),
    privacy_boundary:
      "Daily create open-mode metadata only. No page title, page body, database row value, comment body, file byte, token, or raw local cache dump is stored here.",
  };
}

export function parseDailyCreateOpenModeWorkspaceSettingsCloudValue(
  settings: Record<string, unknown> | null
): ParsedDailyCreateOpenModeWorkspaceSettingsCloudValue {
  const value = settings?.[DAILY_CREATE_OPEN_MODE_CLOUD_FIELD];
  if (value === undefined || value === null) {
    return {
      setting_found: false,
      cloud_value_valid: true,
      saved_at: null,
      ...buildDailyCreateOpenModeWorkspaceSettingValue(
        DEFAULT_DAILY_CREATE_OPEN_MODE
      ),
    };
  }

  if (!isPlainRecord(value)) {
    return {
      setting_found: true,
      cloud_value_valid: false,
      saved_at: null,
      ...buildDailyCreateOpenModeWorkspaceSettingValue(
        DEFAULT_DAILY_CREATE_OPEN_MODE
      ),
    };
  }

  return {
    setting_found: true,
    cloud_value_valid:
      value.format === "zhinote-daily-create-open-mode-settings-cloud-value" &&
      value.format_version === 1 &&
      value.setting_key === DAILY_CREATE_OPEN_MODE_SETTING_KEY,
    saved_at: typeof value.saved_at === "string" ? value.saved_at : null,
    ...parseDailyCreateOpenModeWorkspaceSettingValue(value),
  };
}

export function buildDailyCreateOpenModeWorkspaceSettingsCloudReceipt(input: {
  workspaceId: string;
  role: "owner" | "researcher";
  savedAt: string;
  payload: DailyCreateOpenModeWorkspaceSettingsCloudPayload;
}): DailyCreateOpenModeWorkspaceSettingsCloudReceipt {
  return {
    format: "zhinote-daily-create-open-mode-settings-cloud-receipt",
    format_version: 1,
    setting_key: DAILY_CREATE_OPEN_MODE_SETTING_KEY,
    cloud_target: DAILY_CREATE_OPEN_MODE_CLOUD_TARGET,
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
      saved_open_mode: input.payload.open_mode,
    },
    sync_rule: {
      ordinary_sync_pending_only: true,
      local_pending_table: "sync_log",
      local_pending_row_id: input.payload.client_pending_row_id,
      cloud_wins_except_unsynced_local_setting: true,
    },
    privacy_note:
      "This receipt confirms only the daily note create-open mode was saved to workspaces.settings. It does not upload notes, page titles, page bodies, database rows, comments, versions, files, or local cache dumps.",
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
