import type { WorkspaceSettingRecord } from "@/lib/db/local/queries";

export const MEETING_REVIEW_STATE_SETTING_KEY = "meeting.reviewState.v1";
export const MEETING_REVIEW_STATE_CLOUD_FIELD = "meeting_review_state";

const MAX_MEETING_REVIEW_PAGE_IDS = 64;
const MAX_MEETING_REVIEW_PAGE_ID_LENGTH = 48;

export interface MeetingReviewStateWorkspaceSettingValue {
  seen_meeting_page_ids: string[];
  dismissed_trace_page_ids: string[];
}

export interface MeetingReviewStateWorkspaceSettingsCloudPayload
  extends MeetingReviewStateWorkspaceSettingValue {
  setting_key: typeof MEETING_REVIEW_STATE_SETTING_KEY;
  client_pending_row_id: typeof MEETING_REVIEW_STATE_SETTING_KEY;
}

export interface ParsedMeetingReviewStateWorkspaceSettingsCloudValue
  extends MeetingReviewStateWorkspaceSettingValue {
  setting_found: boolean;
  cloud_value_valid: boolean;
  saved_at: string | null;
}

export interface MeetingReviewStateWorkspaceSettingsCloudReceipt {
  format: "zhinote-meeting-review-state-settings-cloud-receipt";
  format_version: 1;
  setting_key: typeof MEETING_REVIEW_STATE_SETTING_KEY;
  cloud_target: "workspaces.settings.meeting_review_state";
  workspace_id: string;
  saved_at: string;
  role: "owner" | "researcher";
  summary: {
    writes_workspace_settings: true;
    uploads_workspace_content: false;
    reads_page_body_text: false;
    reads_page_titles: false;
    reads_meeting_titles: false;
    reads_meeting_urls: false;
    reads_database_row_values: false;
    reads_file_bytes: false;
    acknowledges_pending_row: typeof MEETING_REVIEW_STATE_SETTING_KEY;
    seen_meeting_page_count: number;
    dismissed_trace_page_count: number;
  };
  sync_rule: {
    ordinary_sync_pending_only: true;
    local_pending_table: "sync_log";
    local_pending_row_id: typeof MEETING_REVIEW_STATE_SETTING_KEY;
    cloud_wins_except_unsynced_local_setting: true;
  };
  privacy_note: string;
}

export type MeetingReviewStateWorkspaceSettingsValidationResult =
  | {
      ok: true;
      payload: MeetingReviewStateWorkspaceSettingsCloudPayload;
    }
  | {
      ok: false;
      message: string;
    };

const FORBIDDEN_PAYLOAD_FIELDS = [
  "title",
  "page_title",
  "meeting_title",
  "meeting_url",
  "join_url",
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

export function isMeetingReviewStateWorkspaceSettingKey(
  value: unknown
): value is typeof MEETING_REVIEW_STATE_SETTING_KEY {
  return value === MEETING_REVIEW_STATE_SETTING_KEY;
}

export function normalizeMeetingReviewPageIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const ids: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const id = item.trim().slice(0, MAX_MEETING_REVIEW_PAGE_ID_LENGTH);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= MAX_MEETING_REVIEW_PAGE_IDS) break;
  }
  return ids;
}

export function parseMeetingReviewStateWorkspaceSetting(
  setting: WorkspaceSettingRecord | null
): MeetingReviewStateWorkspaceSettingValue {
  if (!setting?.valueJson) return getDefaultMeetingReviewState();

  try {
    return parseMeetingReviewStateWorkspaceSettingValue(
      JSON.parse(setting.valueJson) as unknown
    );
  } catch {
    return getDefaultMeetingReviewState();
  }
}

export function parseMeetingReviewStateWorkspaceSettingValue(
  value: unknown
): MeetingReviewStateWorkspaceSettingValue {
  if (!isPlainRecord(value)) return getDefaultMeetingReviewState();
  const payload = readSettingPayloadValue(value);
  return {
    seen_meeting_page_ids: normalizeMeetingReviewPageIds(
      payload.seen_meeting_page_ids ??
        payload.seenMeetingPageIds ??
        payload.seenIds
    ),
    dismissed_trace_page_ids: normalizeMeetingReviewPageIds(
      payload.dismissed_trace_page_ids ??
        payload.dismissedTracePageIds ??
        payload.dismissedTraces
    ),
  };
}

export function validateMeetingReviewStateWorkspaceSettingsCloudPayload(
  body: unknown
): MeetingReviewStateWorkspaceSettingsValidationResult {
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
      message: `请求体不能包含 ${forbiddenField}。会议 review 状态只接受页面 ID metadata。`,
    };
  }

  if (body.setting_key !== MEETING_REVIEW_STATE_SETTING_KEY) {
    return {
      ok: false,
      message: `setting_key 必须是 ${MEETING_REVIEW_STATE_SETTING_KEY}。`,
    };
  }

  if (
    !Array.isArray(body.seen_meeting_page_ids) ||
    !Array.isArray(body.dismissed_trace_page_ids)
  ) {
    return {
      ok: false,
      message:
        "meeting.reviewState.v1 需要提供 seen_meeting_page_ids 和 dismissed_trace_page_ids 数组。",
    };
  }

  return {
    ok: true,
    payload: {
      setting_key: MEETING_REVIEW_STATE_SETTING_KEY,
      client_pending_row_id: MEETING_REVIEW_STATE_SETTING_KEY,
      seen_meeting_page_ids: normalizeMeetingReviewPageIds(
        body.seen_meeting_page_ids
      ),
      dismissed_trace_page_ids: normalizeMeetingReviewPageIds(
        body.dismissed_trace_page_ids
      ),
    },
  };
}

export function buildMeetingReviewStateWorkspaceSettingsCloudValue(
  payload: MeetingReviewStateWorkspaceSettingsCloudPayload,
  savedAt: string
) {
  return {
    format: "zhinote-meeting-review-state-settings-cloud-value",
    format_version: 1,
    setting_key: payload.setting_key,
    saved_at: savedAt,
    source: "zhinotes-meeting-review-state-ui",
    seen_meeting_page_ids: payload.seen_meeting_page_ids,
    dismissed_trace_page_ids: payload.dismissed_trace_page_ids,
    privacy_boundary:
      "Meeting review-state metadata only. No meeting title, join URL, page body, database row value, comment body, file byte, token, or raw local cache dump is stored here.",
  };
}

export function parseMeetingReviewStateWorkspaceSettingsCloudValue(
  settings: Record<string, unknown> | null
): ParsedMeetingReviewStateWorkspaceSettingsCloudValue {
  const value = settings?.[MEETING_REVIEW_STATE_CLOUD_FIELD];
  if (value === undefined || value === null) {
    return {
      setting_found: false,
      cloud_value_valid: true,
      saved_at: null,
      ...getDefaultMeetingReviewState(),
    };
  }

  if (!isPlainRecord(value)) {
    return {
      setting_found: true,
      cloud_value_valid: false,
      saved_at: null,
      ...getDefaultMeetingReviewState(),
    };
  }

  const state = parseMeetingReviewStateWorkspaceSettingValue(value);
  return {
    setting_found: true,
    cloud_value_valid:
      value.format === "zhinote-meeting-review-state-settings-cloud-value" &&
      value.format_version === 1 &&
      value.setting_key === MEETING_REVIEW_STATE_SETTING_KEY &&
      Array.isArray(value.seen_meeting_page_ids) &&
      Array.isArray(value.dismissed_trace_page_ids),
    saved_at: typeof value.saved_at === "string" ? value.saved_at : null,
    ...state,
  };
}

export function buildMeetingReviewStateWorkspaceSettingsCloudReceipt(input: {
  workspaceId: string;
  role: "owner" | "researcher";
  savedAt: string;
  payload: MeetingReviewStateWorkspaceSettingsCloudPayload;
}): MeetingReviewStateWorkspaceSettingsCloudReceipt {
  return {
    format: "zhinote-meeting-review-state-settings-cloud-receipt",
    format_version: 1,
    setting_key: MEETING_REVIEW_STATE_SETTING_KEY,
    cloud_target: "workspaces.settings.meeting_review_state",
    workspace_id: input.workspaceId,
    saved_at: input.savedAt,
    role: input.role,
    summary: {
      writes_workspace_settings: true,
      uploads_workspace_content: false,
      reads_page_body_text: false,
      reads_page_titles: false,
      reads_meeting_titles: false,
      reads_meeting_urls: false,
      reads_database_row_values: false,
      reads_file_bytes: false,
      acknowledges_pending_row: input.payload.client_pending_row_id,
      seen_meeting_page_count: input.payload.seen_meeting_page_ids.length,
      dismissed_trace_page_count: input.payload.dismissed_trace_page_ids.length,
    },
    sync_rule: {
      ordinary_sync_pending_only: true,
      local_pending_table: "sync_log",
      local_pending_row_id: input.payload.client_pending_row_id,
      cloud_wins_except_unsynced_local_setting: true,
    },
    privacy_note:
      "This receipt confirms only meeting page ids for seen notes and dismissed trace reminders were saved to workspaces.settings. It does not upload meeting titles, join URLs, notes, page bodies, database rows, comments, versions, files, or local cache dumps.",
  };
}

function getDefaultMeetingReviewState(): MeetingReviewStateWorkspaceSettingValue {
  return {
    seen_meeting_page_ids: [],
    dismissed_trace_page_ids: [],
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
