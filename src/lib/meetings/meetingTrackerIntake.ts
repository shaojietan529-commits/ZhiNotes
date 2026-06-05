import type { MeetingFollowUpReport } from "@/lib/meetings/meetingFollowUp";
import { normalizeRelationValue } from "@/lib/database/relationValues";
import type { DatabaseField, DatabaseRow, Page } from "@/lib/utils/types";

export interface MeetingTrackerIntakeDraft {
  format: "zhinote-meeting-tracker-intake-draft";
  format_version: 1;
  draft_status: "local-meeting-tracker-row-draft";
  privacy_note: string;
  boundary: {
    local_row_draft_only: true;
    reads_meeting_follow_up_item: true;
    reads_database_fields: true;
    reads_page_text: false;
    reads_transcript_text: false;
    reads_recording_bytes: false;
    includes_participant_details: false;
    includes_meeting_passcodes: false;
    writes_workspace_data: false;
    connects_cloud_services: false;
    uploads_data: false;
    enables_ai: false;
  };
  row_title: string;
  row_page_content: string;
  field_values: Record<string, unknown>;
  mapped_fields: Array<{
    field_name: string;
    field_type: string;
    mapped_value: "meeting-note-relation" | "status" | "follow-up-needed" | "next-action";
  }>;
  missing_fields: string[];
}

export interface MeetingTrackerExistingRow {
  row_id: string;
  row_page_id: string;
  row_title: string;
  meeting_note_field_id: string;
}

export type MeetingTrackerFollowUpItem = MeetingFollowUpReport["items"][number];

const MEETING_TRACKER_REQUIRED_FIELDS = [
  "Meeting note",
  "Status",
  "Follow-up needed",
  "Action items",
];

export function buildMeetingTrackerIntakeDraft(
  item: MeetingTrackerFollowUpItem,
  fields: DatabaseField[]
): MeetingTrackerIntakeDraft {
  const mappedFields: MeetingTrackerIntakeDraft["mapped_fields"] = [];
  const fieldValues: Record<string, unknown> = {};

  const meetingNoteField = findField(fields, ["Meeting note", "会议纪要"]);
  const statusField = findField(fields, ["Status", "状态"]);
  const followUpField = findField(fields, [
    "Follow-up needed",
    "Follow up needed",
    "需要跟进",
    "后续跟进",
  ]);
  const actionItemsField = findField(fields, [
    "Action items",
    "Action item",
    "行动项",
    "后续行动",
  ]);

  if (meetingNoteField) {
    fieldValues[meetingNoteField.id] = [item.page_id];
    mappedFields.push({
      field_name: meetingNoteField.name,
      field_type: meetingNoteField.field_type,
      mapped_value: "meeting-note-relation",
    });
  }

  if (statusField) {
    fieldValues[statusField.id] = getMeetingTrackerStatus(item);
    mappedFields.push({
      field_name: statusField.name,
      field_type: statusField.field_type,
      mapped_value: "status",
    });
  }

  if (followUpField) {
    fieldValues[followUpField.id] = item.missing_steps.length > 0;
    mappedFields.push({
      field_name: followUpField.name,
      field_type: followUpField.field_type,
      mapped_value: "follow-up-needed",
    });
  }

  if (actionItemsField) {
    fieldValues[actionItemsField.id] = item.next_action;
    mappedFields.push({
      field_name: actionItemsField.name,
      field_type: actionItemsField.field_type,
      mapped_value: "next-action",
    });
  }

  return {
    format: "zhinote-meeting-tracker-intake-draft",
    format_version: 1,
    draft_status: "local-meeting-tracker-row-draft",
    privacy_note:
      "由一个会议跟进条目和所选会议跟踪表字段结构在本地生成。它只创建带关系 id 和结构状态的行草稿，不读取或导出会议正文、转录稿文本、录音字节、参会人详情、会议密码、云端数据、AI 提示词、token 或凭证。",
    boundary: {
      local_row_draft_only: true,
      reads_meeting_follow_up_item: true,
      reads_database_fields: true,
      reads_page_text: false,
      reads_transcript_text: false,
      reads_recording_bytes: false,
      includes_participant_details: false,
      includes_meeting_passcodes: false,
      writes_workspace_data: false,
      connects_cloud_services: false,
      uploads_data: false,
      enables_ai: false,
    },
    row_title: `会议跟踪 - ${item.page_title}`,
    row_page_content: buildMeetingTrackerRowContent(item),
    field_values: fieldValues,
    mapped_fields: mappedFields,
    missing_fields: MEETING_TRACKER_REQUIRED_FIELDS.filter(
      (fieldName) => !mappedFields.some((field) => normalizeName(field.field_name) === normalizeName(fieldName))
    ),
  };
}

export function findExistingMeetingTrackerRow(
  rows: Array<DatabaseRow & { page: Page }>,
  fields: DatabaseField[],
  meetingPageId: string
): MeetingTrackerExistingRow | null {
  const meetingNoteField = findField(fields, ["Meeting note", "会议纪要"]);
  if (!meetingNoteField) return null;

  for (const row of rows) {
    const values = parseFieldValues(row.field_values);
    const relationIds = normalizeRelationValue(values[meetingNoteField.id]);
    if (relationIds.includes(meetingPageId)) {
      return {
        row_id: row.id,
        row_page_id: row.page_id,
        row_title: row.page?.title || "未命名会议跟踪行",
        meeting_note_field_id: meetingNoteField.id,
      };
    }
  }

  return null;
}

function getMeetingTrackerStatus(item: MeetingTrackerFollowUpItem) {
  if (item.missing_steps.length === 0) return "Done";
  if (item.missing_steps.includes("transcript-review")) return "Notes to process";
  if (item.missing_steps.includes("action-items")) return "Follow-up";
  if (item.missing_steps.includes("research-linking")) return "Follow-up";
  return "Notes to process";
}

function buildMeetingTrackerRowContent(item: MeetingTrackerFollowUpItem) {
  const missingSteps =
    item.missing_steps.length > 0
      ? item.missing_steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")
      : "<li>基础结构已覆盖，继续补关系值和最新结论。</li>";

  return `
    <h1>${escapeHtml(`会议跟踪 - ${item.page_title}`)}</h1>
    <p>由会议模块本地入库创建。这个 row 用来把会议纪要接入会议跟踪表。</p>
    <h2>已连接</h2>
    <ul>
      <li>Meeting note relation: ${escapeHtml(item.page_title)}</li>
    </ul>
    <h2>下一步</h2>
    <ul>
      <li>${escapeHtml(item.next_action)}</li>
      ${missingSteps}
    </ul>
    <p><strong>隐私边界：</strong>本地单条写入，不自动入会、录音、发布、上传或调用 AI。</p>
  `.trim();
}

function findField(fields: DatabaseField[], aliases: string[]) {
  const aliasSet = new Set(aliases.map(normalizeName));
  return fields.find((field) => aliasSet.has(normalizeName(field.name))) ?? null;
}

function parseFieldValues(fieldValues: string) {
  try {
    return JSON.parse(fieldValues || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[-_\s]+/g, " ").trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
