import { normalizeRelationValue } from "@/lib/database/relationValues";
import { RESEARCH_PROJECT_PAGE_FIELD_ALIASES } from "@/lib/modules/researchProjectFields";
import type { ResearchProjectBrief } from "@/lib/modules/researchProjectBrief";
import type { DatabaseField, DatabaseRow, Page } from "@/lib/utils/types";

export interface ResearchProjectTrackerIntakeItem {
  project_page_id: string;
  project_page_title: string;
  brief: ResearchProjectBrief;
}

export interface ResearchProjectTrackerIntakeDraft {
  format: "zhinote-research-project-tracker-intake-draft";
  format_version: 1;
  draft_status: "local-project-tracker-row-draft";
  privacy_note: string;
  boundary: {
    local_row_draft_only: true;
    reads_project_brief_metadata: true;
    reads_database_fields: true;
    reads_page_text: false;
    includes_page_text: false;
    includes_database_row_values: false;
    includes_file_names: false;
    includes_file_bytes: false;
    includes_holdings: false;
    includes_trading_plans: false;
    writes_workspace_data: false;
    creates_database_rows: false;
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
      | "project-page-relation"
      | "status"
      | "project-mode"
      | "priority"
      | "horizon"
      | "research-question"
      | "owner-confirmation"
      | "next-action";
  }>;
  missing_fields: string[];
}

export interface ResearchProjectTrackerExistingRow {
  row_id: string;
  row_page_id: string;
  row_title: string;
  project_page_field_id: string;
}

const PROJECT_TRACKER_REQUIRED_FIELDS = [
  {
    label: "Project page",
    aliases: RESEARCH_PROJECT_PAGE_FIELD_ALIASES,
  },
  { label: "Status", aliases: ["Status", "状态"] },
  { label: "Project mode", aliases: ["Project mode", "项目类型"] },
  { label: "Priority", aliases: ["Priority", "优先级"] },
  { label: "Horizon", aliases: ["Horizon", "时间范围"] },
  {
    label: "Research question",
    aliases: ["Research question", "研究主题", "研究问题"],
  },
  {
    label: "Owner confirmation",
    aliases: ["Owner confirmation", "Owner 确认", "确认"],
  },
  { label: "Next action", aliases: ["Next action", "下一步"] },
];

export function buildResearchProjectTrackerIntakeDraft(
  item: ResearchProjectTrackerIntakeItem,
  fields: DatabaseField[]
): ResearchProjectTrackerIntakeDraft {
  const mappedFields: ResearchProjectTrackerIntakeDraft["mapped_fields"] = [];
  const fieldValues: Record<string, unknown> = {};

  const projectPageField = findField(fields, RESEARCH_PROJECT_PAGE_FIELD_ALIASES);
  const statusField = findField(fields, ["Status", "状态"]);
  const modeField = findField(fields, ["Project mode", "项目类型"]);
  const priorityField = findField(fields, ["Priority", "优先级"]);
  const horizonField = findField(fields, ["Horizon", "时间范围"]);
  const questionField = findField(fields, [
    "Research question",
    "研究主题",
    "研究问题",
  ]);
  const ownerConfirmationField = findField(fields, [
    "Owner confirmation",
    "Owner 确认",
    "确认",
  ]);
  const nextActionField = findField(fields, ["Next action", "下一步"]);

  if (projectPageField) {
    fieldValues[projectPageField.id] = [item.project_page_id];
    mappedFields.push({
      field_name: projectPageField.name,
      field_type: projectPageField.field_type,
      mapped_value: "project-page-relation",
    });
  }

  if (statusField) {
    fieldValues[statusField.id] = getProjectStatus(item.brief);
    mappedFields.push({
      field_name: statusField.name,
      field_type: statusField.field_type,
      mapped_value: "status",
    });
  }

  if (modeField) {
    fieldValues[modeField.id] = item.brief.project_mode_label;
    mappedFields.push({
      field_name: modeField.name,
      field_type: modeField.field_type,
      mapped_value: "project-mode",
    });
  }

  if (priorityField) {
    fieldValues[priorityField.id] =
      item.brief.summary.checklist_missing > 0 ? "Medium" : "Low";
    mappedFields.push({
      field_name: priorityField.name,
      field_type: priorityField.field_type,
      mapped_value: "priority",
    });
  }

  if (horizonField) {
    fieldValues[horizonField.id] = item.brief.horizon;
    mappedFields.push({
      field_name: horizonField.name,
      field_type: horizonField.field_type,
      mapped_value: "horizon",
    });
  }

  if (questionField) {
    fieldValues[questionField.id] = item.brief.topic || "待补研究问题";
    mappedFields.push({
      field_name: questionField.name,
      field_type: questionField.field_type,
      mapped_value: "research-question",
    });
  }

  if (ownerConfirmationField) {
    fieldValues[ownerConfirmationField.id] = false;
    mappedFields.push({
      field_name: ownerConfirmationField.name,
      field_type: ownerConfirmationField.field_type,
      mapped_value: "owner-confirmation",
    });
  }

  if (nextActionField) {
    fieldValues[nextActionField.id] = getNextAction(item.brief);
    mappedFields.push({
      field_name: nextActionField.name,
      field_type: nextActionField.field_type,
      mapped_value: "next-action",
    });
  }

  return {
    format: "zhinote-research-project-tracker-intake-draft",
    format_version: 1,
    draft_status: "local-project-tracker-row-draft",
    privacy_note:
      "Generated locally from one research project brief and the selected project tracker field schema. It creates a row draft with relation ids and structural status only. It does not read or export page text, database row values, file names, file bytes, holdings, trading plans, cloud data, AI prompts, tokens, or credentials.",
    boundary: {
      local_row_draft_only: true,
      reads_project_brief_metadata: true,
      reads_database_fields: true,
      reads_page_text: false,
      includes_page_text: false,
      includes_database_row_values: false,
      includes_file_names: false,
      includes_file_bytes: false,
      includes_holdings: false,
      includes_trading_plans: false,
      writes_workspace_data: false,
      creates_database_rows: false,
      connects_cloud_services: false,
      uploads_data: false,
      enables_ai: false,
    },
    row_title: `项目跟踪 - ${
      item.brief.topic || item.brief.project_mode_label || item.project_page_title
    }`,
    row_page_content: buildProjectTrackerRowContent(item),
    field_values: fieldValues,
    mapped_fields: mappedFields,
    missing_fields: PROJECT_TRACKER_REQUIRED_FIELDS.filter(
      (requiredField) =>
        !mappedFields.some(
          (field) =>
            requiredField.aliases.some(
              (alias) => normalizeName(field.field_name) === normalizeName(alias)
            )
        )
    ).map((requiredField) => requiredField.label),
  };
}

export function findExistingResearchProjectTrackerRow(
  rows: Array<DatabaseRow & { page: Page }>,
  fields: DatabaseField[],
  projectPageId: string
): ResearchProjectTrackerExistingRow | null {
  const projectPageField = findField(fields, RESEARCH_PROJECT_PAGE_FIELD_ALIASES);
  if (!projectPageField) return null;

  for (const row of rows) {
    const values = parseFieldValues(row.field_values);
    const relationIds = normalizeRelationValue(values[projectPageField.id]);
    if (relationIds.includes(projectPageId)) {
      return {
        row_id: row.id,
        row_page_id: row.page_id,
        row_title: row.page?.title || "未命名项目跟踪行",
        project_page_field_id: projectPageField.id,
      };
    }
  }

  return null;
}

function getProjectStatus(brief: ResearchProjectBrief) {
  if (brief.topic_status === "empty-draft") return "Scoping";
  if (brief.summary.checklist_missing > 0) return "Researching";
  return "Review";
}

function getNextAction(brief: ResearchProjectBrief) {
  return `${brief.summary.recommended_first_label}：${brief.summary.recommended_first_route}`;
}

function buildProjectTrackerRowContent(item: ResearchProjectTrackerIntakeItem) {
  const missingChecklist = item.brief.checklist
    .filter((entry) => entry.status !== "ready")
    .map((entry) => `<li>${escapeHtml(entry.title)}：${escapeHtml(entry.reason)}</li>`)
    .join("");

  return `
    <h1>${escapeHtml(`项目跟踪 - ${item.project_page_title}`)}</h1>
    <p>由投研项目模块本地入库创建。这个 row 用来把项目页接入项目跟踪表。</p>
    <h2>已连接</h2>
    <ul>
      <li>Project page relation: ${escapeHtml(item.project_page_title)}</li>
      <li>项目类型：${escapeHtml(item.brief.project_mode_label)}</li>
      <li>时间范围：${escapeHtml(item.brief.horizon)}</li>
    </ul>
    <h2>下一步</h2>
    <ul>
      <li>${escapeHtml(getNextAction(item.brief))}</li>
      ${missingChecklist || "<li>基础 checklist 已覆盖，继续补 relation 值和决策 memo。</li>"}
    </ul>
    <p><strong>隐私边界：</strong>本地单条写入，只写项目页 relation 和结构化状态，不读取页面正文、数据库 row values、文件名、文件 bytes、持仓或交易计划。</p>
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
