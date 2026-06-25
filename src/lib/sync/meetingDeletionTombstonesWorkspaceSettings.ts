import type { WorkspaceSettingRecord } from "@/lib/db/local/queries";

export const MEETING_DELETION_TOMBSTONES_SETTING_KEY =
  "meeting.deletionTombstones.v1";
export const MEETING_DELETION_TOMBSTONES_CLOUD_FIELD =
  "meeting_deletion_tombstones";

const MAX_MEETING_DELETION_PAGE_IDS = 96;
const MAX_MEETING_DELETION_PAGE_ID_LENGTH = 48;

export interface MeetingDeletionTombstonesWorkspaceSettingValue {
  deleted_meeting_page_ids: string[];
}

export interface MeetingDeletionTombstonesWorkspaceSettingsCloudPayload
  extends MeetingDeletionTombstonesWorkspaceSettingValue {
  setting_key: typeof MEETING_DELETION_TOMBSTONES_SETTING_KEY;
  client_pending_row_id: typeof MEETING_DELETION_TOMBSTONES_SETTING_KEY;
}

export interface ParsedMeetingDeletionTombstonesWorkspaceSettingsCloudValue
  extends MeetingDeletionTombstonesWorkspaceSettingValue {
  setting_found: boolean;
  cloud_value_valid: boolean;
  saved_at: string | null;
}

export interface MeetingDeletionTombstonesWorkspaceSettingsCloudReceipt {
  format: "zhinote-meeting-deletion-tombstones-settings-cloud-receipt";
  format_version: 1;
  setting_key: typeof MEETING_DELETION_TOMBSTONES_SETTING_KEY;
  cloud_target: "workspaces.settings.meeting_deletion_tombstones";
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
    acknowledges_pending_row: typeof MEETING_DELETION_TOMBSTONES_SETTING_KEY;
    deleted_meeting_page_count: number;
  };
  sync_rule: {
    ordinary_sync_pending_only: true;
    local_pending_table: "sync_log";
    local_pending_row_id: typeof MEETING_DELETION_TOMBSTONES_SETTING_KEY;
    cloud_wins_except_unsynced_local_setting: true;
  };
  privacy_note: string;
}

export type MeetingDeletionTombstonesWorkspaceSettingsValidationResult =
  | {
      ok: true;
      payload: MeetingDeletionTombstonesWorkspaceSettingsCloudPayload;
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

export function isMeetingDeletionTombstonesWorkspaceSettingKey(
  value: unknown
): value is typeof MEETING_DELETION_TOMBSTONES_SETTING_KEY {
  return value === MEETING_DELETION_TOMBSTONES_SETTING_KEY;
}

export function normalizeMeetingDeletionPageIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const ids: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const id = item.trim().slice(0, MAX_MEETING_DELETION_PAGE_ID_LENGTH);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= MAX_MEETING_DELETION_PAGE_IDS) break;
  }
  return ids;
}

export function parseMeetingDeletionTombstonesWorkspaceSetting(
  setting: WorkspaceSettingRecord | null
): MeetingDeletionTombstonesWorkspaceSettingValue {
  if (!setting?.valueJson) return getDefaultMeetingDeletionTombstones();

  try {
    return parseMeetingDeletionTombstonesWorkspaceSettingValue(
      JSON.parse(setting.valueJson) as unknown
    );
  } catch {
    return getDefaultMeetingDeletionTombstones();
  }
}

export function parseMeetingDeletionTombstonesWorkspaceSettingValue(
  value: unknown
): MeetingDeletionTombstonesWorkspaceSettingValue {
  if (!isPlainRecord(value)) return getDefaultMeetingDeletionTombstones();
  const payload = readSettingPayloadValue(value);
  return {
    deleted_meeting_page_ids: normalizeMeetingDeletionPageIds(
      payload.deleted_meeting_page_ids ??
        payload.deletedMeetingPageIds ??
        payload.deletedIds
    ),
  };
}

export function validateMeetingDeletionTombstonesWorkspaceSettingsCloudPayload(
  body: unknown
): MeetingDeletionTombstonesWorkspaceSettingsValidationResult {
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
      message: `请求体不能包含 ${forbiddenField}。会议删除 tombstone 只接受页面 ID metadata。`,
    };
  }

  if (body.setting_key !== MEETING_DELETION_TOMBSTONES_SETTING_KEY) {
    return {
      ok: false,
      message: `setting_key 必须是 ${MEETING_DELETION_TOMBSTONES_SETTING_KEY}。`,
    };
  }

  if (!Array.isArray(body.deleted_meeting_page_ids)) {
    return {
      ok: false,
      message:
        "meeting.deletionTombstones.v1 需要提供 deleted_meeting_page_ids 数组。",
    };
  }

  return {
    ok: true,
    payload: {
      setting_key: MEETING_DELETION_TOMBSTONES_SETTING_KEY,
      client_pending_row_id: MEETING_DELETION_TOMBSTONES_SETTING_KEY,
      deleted_meeting_page_ids: normalizeMeetingDeletionPageIds(
        body.deleted_meeting_page_ids
      ),
    },
  };
}

export function buildMeetingDeletionTombstonesWorkspaceSettingsCloudValue(
  payload: MeetingDeletionTombstonesWorkspaceSettingsCloudPayload,
  savedAt: string
) {
  return {
    format: "zhinote-meeting-deletion-tombstones-settings-cloud-value",
    format_version: 1,
    setting_key: payload.setting_key,
    saved_at: savedAt,
    source: "zhinotes-meeting-deletion-tombstones-ui",
    deleted_meeting_page_ids: payload.deleted_meeting_page_ids,
    privacy_boundary:
      "Meeting deletion tombstone metadata only. No meeting title, join URL, page body, database row value, comment body, file byte, token, or raw local cache dump is stored here.",
  };
}

export function parseMeetingDeletionTombstonesWorkspaceSettingsCloudValue(
  settings: Record<string, unknown> | null
): ParsedMeetingDeletionTombstonesWorkspaceSettingsCloudValue {
  const value = settings?.[MEETING_DELETION_TOMBSTONES_CLOUD_FIELD];
  if (value === undefined || value === null) {
    return {
      setting_found: false,
      cloud_value_valid: true,
      saved_at: null,
      ...getDefaultMeetingDeletionTombstones(),
    };
  }

  if (!isPlainRecord(value)) {
    return {
      setting_found: true,
      cloud_value_valid: false,
      saved_at: null,
      ...getDefaultMeetingDeletionTombstones(),
    };
  }

  const state = parseMeetingDeletionTombstonesWorkspaceSettingValue(value);
  return {
    setting_found: true,
    cloud_value_valid:
      value.format ===
        "zhinote-meeting-deletion-tombstones-settings-cloud-value" &&
      value.format_version === 1 &&
      value.setting_key === MEETING_DELETION_TOMBSTONES_SETTING_KEY &&
      Array.isArray(value.deleted_meeting_page_ids),
    saved_at: typeof value.saved_at === "string" ? value.saved_at : null,
    ...state,
  };
}

export function buildMeetingDeletionTombstonesWorkspaceSettingsCloudReceipt(input: {
  workspaceId: string;
  role: "owner" | "researcher";
  savedAt: string;
  payload: MeetingDeletionTombstonesWorkspaceSettingsCloudPayload;
}): MeetingDeletionTombstonesWorkspaceSettingsCloudReceipt {
  return {
    format: "zhinote-meeting-deletion-tombstones-settings-cloud-receipt",
    format_version: 1,
    setting_key: MEETING_DELETION_TOMBSTONES_SETTING_KEY,
    cloud_target: "workspaces.settings.meeting_deletion_tombstones",
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
      deleted_meeting_page_count: input.payload.deleted_meeting_page_ids.length,
    },
    sync_rule: {
      ordinary_sync_pending_only: true,
      local_pending_table: "sync_log",
      local_pending_row_id: input.payload.client_pending_row_id,
      cloud_wins_except_unsynced_local_setting: true,
    },
    privacy_note:
      "This receipt confirms only deleted meeting page ids were saved to workspaces.settings. It does not upload meeting titles, join URLs, notes, page bodies, database rows, comments, versions, files, or local cache dumps.",
  };
}

function getDefaultMeetingDeletionTombstones(): MeetingDeletionTombstonesWorkspaceSettingValue {
  return {
    deleted_meeting_page_ids: [],
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
