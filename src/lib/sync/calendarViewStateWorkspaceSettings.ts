import type { WorkspaceSettingRecord } from "@/lib/db/local/queries";

export const CALENDAR_VIEW_STATE_SETTING_KEY = "calendar.viewState.v1";
export const CALENDAR_VIEW_STATE_CLOUD_FIELD = "calendar_view_state";

export interface CalendarViewStateWorkspaceSettingValue {
  daily_view_month: string | null;
  meeting_view_month: string | null;
}

export interface CalendarViewStateWorkspaceSettingsCloudPayload
  extends CalendarViewStateWorkspaceSettingValue {
  setting_key: typeof CALENDAR_VIEW_STATE_SETTING_KEY;
  client_pending_row_id: typeof CALENDAR_VIEW_STATE_SETTING_KEY;
}

export interface ParsedCalendarViewStateWorkspaceSettingsCloudValue
  extends CalendarViewStateWorkspaceSettingValue {
  setting_found: boolean;
  cloud_value_valid: boolean;
  saved_at: string | null;
}

export interface CalendarViewStateWorkspaceSettingsCloudReceipt {
  format: "zhinote-calendar-view-state-settings-cloud-receipt";
  format_version: 1;
  setting_key: typeof CALENDAR_VIEW_STATE_SETTING_KEY;
  cloud_target: "workspaces.settings.calendar_view_state";
  workspace_id: string;
  saved_at: string;
  role: "owner" | "researcher";
  summary: {
    writes_workspace_settings: true;
    uploads_workspace_content: false;
    reads_page_body_text: false;
    reads_page_titles: false;
    reads_meeting_titles: false;
    reads_database_row_values: false;
    reads_file_bytes: false;
    acknowledges_pending_row: typeof CALENDAR_VIEW_STATE_SETTING_KEY;
    saved_month_count: number;
  };
  sync_rule: {
    ordinary_sync_pending_only: true;
    local_pending_table: "sync_log";
    local_pending_row_id: typeof CALENDAR_VIEW_STATE_SETTING_KEY;
    cloud_wins_except_unsynced_local_setting: true;
  };
  privacy_note: string;
}

export type CalendarViewStateWorkspaceSettingsValidationResult =
  | {
      ok: true;
      payload: CalendarViewStateWorkspaceSettingsCloudPayload;
    }
  | {
      ok: false;
      message: string;
    };

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

export function isCalendarViewStateWorkspaceSettingKey(
  value: unknown
): value is typeof CALENDAR_VIEW_STATE_SETTING_KEY {
  return value === CALENDAR_VIEW_STATE_SETTING_KEY;
}

export function normalizeCalendarViewMonth(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const month = value.trim();
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7));
  if (year < 2000 || year > 2099 || monthIndex < 1 || monthIndex > 12) {
    return null;
  }
  return month;
}

export function parseCalendarViewStateWorkspaceSetting(
  setting: WorkspaceSettingRecord | null
): CalendarViewStateWorkspaceSettingValue {
  if (!setting?.valueJson) return getDefaultCalendarViewState();

  try {
    return parseCalendarViewStateWorkspaceSettingValue(
      JSON.parse(setting.valueJson) as unknown
    );
  } catch {
    return getDefaultCalendarViewState();
  }
}

export function parseCalendarViewStateWorkspaceSettingValue(
  value: unknown
): CalendarViewStateWorkspaceSettingValue {
  if (!isPlainRecord(value)) return getDefaultCalendarViewState();
  const payload = readSettingPayloadValue(value);
  return {
    daily_view_month: normalizeCalendarViewMonth(
      payload.daily_view_month ?? payload.dailyViewMonth
    ),
    meeting_view_month: normalizeCalendarViewMonth(
      payload.meeting_view_month ?? payload.meetingViewMonth
    ),
  };
}

export function validateCalendarViewStateWorkspaceSettingsCloudPayload(
  body: unknown
): CalendarViewStateWorkspaceSettingsValidationResult {
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
      message: `请求体不能包含 ${forbiddenField}。日历视图状态只接受月份 metadata。`,
    };
  }

  if (body.setting_key !== CALENDAR_VIEW_STATE_SETTING_KEY) {
    return {
      ok: false,
      message: `setting_key 必须是 ${CALENDAR_VIEW_STATE_SETTING_KEY}。`,
    };
  }

  return {
    ok: true,
    payload: {
      setting_key: CALENDAR_VIEW_STATE_SETTING_KEY,
      client_pending_row_id: CALENDAR_VIEW_STATE_SETTING_KEY,
      daily_view_month: normalizeCalendarViewMonth(body.daily_view_month),
      meeting_view_month: normalizeCalendarViewMonth(body.meeting_view_month),
    },
  };
}

export function buildCalendarViewStateWorkspaceSettingsCloudValue(
  payload: CalendarViewStateWorkspaceSettingsCloudPayload,
  savedAt: string
) {
  return {
    format: "zhinote-calendar-view-state-settings-cloud-value",
    format_version: 1,
    setting_key: payload.setting_key,
    saved_at: savedAt,
    source: "zhinotes-calendar-view-state-ui",
    daily_view_month: payload.daily_view_month,
    meeting_view_month: payload.meeting_view_month,
    privacy_boundary:
      "Calendar view-state metadata only. No page title, meeting title, page body, database row value, comment body, file byte, token, or raw local cache dump is stored here.",
  };
}

export function parseCalendarViewStateWorkspaceSettingsCloudValue(
  settings: Record<string, unknown> | null
): ParsedCalendarViewStateWorkspaceSettingsCloudValue {
  const value = settings?.[CALENDAR_VIEW_STATE_CLOUD_FIELD];
  if (value === undefined || value === null) {
    return {
      setting_found: false,
      cloud_value_valid: true,
      saved_at: null,
      ...getDefaultCalendarViewState(),
    };
  }

  if (!isPlainRecord(value)) {
    return {
      setting_found: true,
      cloud_value_valid: false,
      saved_at: null,
      ...getDefaultCalendarViewState(),
    };
  }

  const state = parseCalendarViewStateWorkspaceSettingValue(value);
  return {
    setting_found: true,
    cloud_value_valid:
      value.format === "zhinote-calendar-view-state-settings-cloud-value" &&
      value.format_version === 1 &&
      value.setting_key === CALENDAR_VIEW_STATE_SETTING_KEY,
    saved_at: typeof value.saved_at === "string" ? value.saved_at : null,
    ...state,
  };
}

export function buildCalendarViewStateWorkspaceSettingsCloudReceipt(input: {
  workspaceId: string;
  role: "owner" | "researcher";
  savedAt: string;
  payload: CalendarViewStateWorkspaceSettingsCloudPayload;
}): CalendarViewStateWorkspaceSettingsCloudReceipt {
  return {
    format: "zhinote-calendar-view-state-settings-cloud-receipt",
    format_version: 1,
    setting_key: CALENDAR_VIEW_STATE_SETTING_KEY,
    cloud_target: "workspaces.settings.calendar_view_state",
    workspace_id: input.workspaceId,
    saved_at: input.savedAt,
    role: input.role,
    summary: {
      writes_workspace_settings: true,
      uploads_workspace_content: false,
      reads_page_body_text: false,
      reads_page_titles: false,
      reads_meeting_titles: false,
      reads_database_row_values: false,
      reads_file_bytes: false,
      acknowledges_pending_row: input.payload.client_pending_row_id,
      saved_month_count: [
        input.payload.daily_view_month,
        input.payload.meeting_view_month,
      ].filter(Boolean).length,
    },
    sync_rule: {
      ordinary_sync_pending_only: true,
      local_pending_table: "sync_log",
      local_pending_row_id: input.payload.client_pending_row_id,
      cloud_wins_except_unsynced_local_setting: true,
    },
    privacy_note:
      "This receipt confirms only daily and meeting calendar view-month metadata was saved to workspaces.settings. It does not upload notes, page titles, meeting titles, database rows, comments, versions, files, or local cache dumps.",
  };
}

function getDefaultCalendarViewState(): CalendarViewStateWorkspaceSettingValue {
  return {
    daily_view_month: null,
    meeting_view_month: null,
  };
}

function readSettingPayloadValue(
  value: Record<string, unknown>
): Record<string, unknown> {
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
