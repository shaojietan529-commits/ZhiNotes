import { normalizeRelationValue } from "@/lib/database/relationValues";
import type { ReportIntakeItem, ReportIntakeStage } from "@/lib/reports/reportIntake";
import type { DatabaseField, DatabaseRow, Page } from "@/lib/utils/types";

export interface ReportTrackerIntakeDraft {
  format: "zhinote-report-tracker-intake-draft";
  format_version: 1;
  draft_status: "local-report-tracker-row-draft";
  privacy_note: string;
  boundary: {
    local_row_draft_only: true;
    reads_report_intake_item: true;
    reads_database_fields: true;
    reads_page_text: false;
    reads_file_bytes: false;
    reads_file_text: false;
    includes_report_text: false;
    includes_file_bytes: false;
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
    mapped_value:
      | "report-page-relation"
      | "format"
      | "status"
      | "source"
      | "key-takeaways";
  }>;
  missing_fields: string[];
}

export interface ReportTrackerExistingRow {
  row_id: string;
  row_page_id: string;
  row_title: string;
  report_page_field_id: string;
}

const REPORT_TRACKER_REQUIRED_FIELDS = [
  "Report page",
  "Format",
  "Status",
  "Source",
  "Key takeaways",
];

export function buildReportTrackerIntakeDraft(
  item: ReportIntakeItem,
  fields: DatabaseField[]
): ReportTrackerIntakeDraft {
  const mappedFields: ReportTrackerIntakeDraft["mapped_fields"] = [];
  const fieldValues: Record<string, unknown> = {};

  const reportPageField = findField(fields, ["Report page", "报告页面"]);
  const formatField = findField(fields, ["Format", "格式"]);
  const statusField = findField(fields, ["Status", "状态"]);
  const sourceField = findField(fields, ["Source", "来源"]);
  const keyTakeawaysField = findField(fields, [
    "Key takeaways",
    "核心结论",
    "Takeaways",
  ]);

  if (reportPageField) {
    fieldValues[reportPageField.id] = [item.page_id];
    mappedFields.push({
      field_name: reportPageField.name,
      field_type: reportPageField.field_type,
      mapped_value: "report-page-relation",
    });
  }

  if (formatField) {
    fieldValues[formatField.id] = getReportTrackerFormat(item);
    mappedFields.push({
      field_name: formatField.name,
      field_type: formatField.field_type,
      mapped_value: "format",
    });
  }

  if (statusField) {
    fieldValues[statusField.id] = getReportTrackerStatus(item.stage);
    mappedFields.push({
      field_name: statusField.name,
      field_type: statusField.field_type,
      mapped_value: "status",
    });
  }

  if (sourceField) {
    fieldValues[sourceField.id] = item.file_name;
    mappedFields.push({
      field_name: sourceField.name,
      field_type: sourceField.field_type,
      mapped_value: "source",
    });
  }

  if (keyTakeawaysField) {
    fieldValues[keyTakeawaysField.id] = item.next_action;
    mappedFields.push({
      field_name: keyTakeawaysField.name,
      field_type: keyTakeawaysField.field_type,
      mapped_value: "key-takeaways",
    });
  }

  return {
    format: "zhinote-report-tracker-intake-draft",
    format_version: 1,
    draft_status: "local-report-tracker-row-draft",
    privacy_note:
      "Generated locally from one report intake item and the selected report tracker field schema. It creates a row draft with relation ids and file metadata only. It does not read or export report text, file text, file bytes, page body text, cloud data, AI prompts, tokens, or credentials.",
    boundary: {
      local_row_draft_only: true,
      reads_report_intake_item: true,
      reads_database_fields: true,
      reads_page_text: false,
      reads_file_bytes: false,
      reads_file_text: false,
      includes_report_text: false,
      includes_file_bytes: false,
      writes_workspace_data: false,
      connects_cloud_services: false,
      uploads_data: false,
      enables_ai: false,
    },
    row_title: `报告跟踪 - ${item.page_title}`,
    row_page_content: buildReportTrackerRowContent(item),
    field_values: fieldValues,
    mapped_fields: mappedFields,
    missing_fields: REPORT_TRACKER_REQUIRED_FIELDS.filter(
      (fieldName) =>
        !mappedFields.some(
          (field) => normalizeName(field.field_name) === normalizeName(fieldName)
        )
    ),
  };
}

export function findExistingReportTrackerRow(
  rows: Array<DatabaseRow & { page: Page }>,
  fields: DatabaseField[],
  reportPageId: string
): ReportTrackerExistingRow | null {
  const reportPageField = findField(fields, ["Report page", "报告页面"]);
  if (!reportPageField) return null;

  for (const row of rows) {
    const values = parseFieldValues(row.field_values);
    const relationIds = normalizeRelationValue(values[reportPageField.id]);
    if (relationIds.includes(reportPageId)) {
      return {
        row_id: row.id,
        row_page_id: row.page_id,
        row_title: row.page?.title || "未命名报告跟踪行",
        report_page_field_id: reportPageField.id,
      };
    }
  }

  return null;
}

function getReportTrackerFormat(item: ReportIntakeItem) {
  const labels: Record<ReportIntakeItem["file_kind"], string> = {
    html: "HTML",
    markdown: "Markdown",
    opml: "Other",
    rtf: "Other",
    epub: "Other",
    archive: "Archive",
    pdf: "PDF",
    image: "Other",
    audio: "Other",
    video: "Other",
    text: "Other",
    notebook: "Notebook",
    spreadsheet: "Excel",
    word: "Word",
    presentation: "PowerPoint",
    unknown: "Other",
  };

  return labels[item.file_kind] ?? "Other";
}

function getReportTrackerStatus(stage: ReportIntakeStage) {
  if (stage === "captured" || stage === "source-triage") return "Inbox";
  if (stage === "reading-review" || stage === "database-review") return "Reviewing";
  if (stage === "linking") return "Linked";
  return "Inbox";
}

function buildReportTrackerRowContent(item: ReportIntakeItem) {
  const relationGaps =
    item.relation_gaps.length > 0
      ? item.relation_gaps.map((gap) => `<li>${escapeHtml(gap)}</li>`).join("")
      : "<li>待确认公司、会议和 memo 关系。</li>";

  return `
    <h1>${escapeHtml(`报告跟踪 - ${item.page_title}`)}</h1>
    <p>由报告库本地入库创建。这个 row 用来把本地报告页接入报告跟踪表。</p>
    <h2>已连接</h2>
    <ul>
      <li>Report page relation: ${escapeHtml(item.page_title)}</li>
      <li>文件名：${escapeHtml(item.file_name)}</li>
      <li>格式：${escapeHtml(item.file_kind)}</li>
    </ul>
    <h2>下一步</h2>
    <ul>
      <li>${escapeHtml(item.next_action)}</li>
      ${relationGaps}
    </ul>
    <p><strong>隐私边界：</strong>本地单条写入，不读取报告正文、文件文本、文件 bytes、上传或调用 AI。</p>
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
