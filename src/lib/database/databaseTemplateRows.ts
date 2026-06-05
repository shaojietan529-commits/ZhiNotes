import { getFieldOptions } from "@/lib/database/fields";
import type { NoteTemplate } from "@/lib/templates/noteTemplates";
import type { DatabaseField, DatabaseRow } from "@/lib/utils/types";

export const DATABASE_TEMPLATE_ROW_RECEIPT_EVENT =
  "zhinote:database-template-row-receipt";

const TEMPLATE_ROW_RECEIPT_STORAGE_KEY =
  "zhinote.databaseTemplateRows.receipts";
const MAX_TEMPLATE_ROW_RECEIPTS = 100;

export type DatabaseTemplateRowGroupId =
  | "company"
  | "report"
  | "meeting"
  | "portfolio";

export interface DatabaseTemplateRowDraft {
  format: "zhinote-database-template-row-draft";
  format_version: 1;
  draft_status: "local-template-row-structure-only";
  template_title: string;
  group_id: DatabaseTemplateRowGroupId;
  field_values: Record<string, unknown>;
  applied_fields: Array<{
    field_id: string;
    field_name: string;
    field_type: string;
    value_kind: "status" | "select" | "date" | "checkbox" | "text";
    reason: string;
  }>;
  skipped_fields: Array<{
    field_id: string;
    field_name: string;
    field_type: string;
    reason: string;
  }>;
  boundary: {
    local_draft_only: true;
    reads_template_metadata: true;
    reads_database_schema: true;
    reads_database_rows: false;
    reads_database_row_values: false;
    reads_page_text: false;
    includes_private_investment_details: false;
    includes_holdings: false;
    includes_tickers: false;
    includes_position_sizes: false;
    includes_prices: false;
    includes_trading_plan: false;
    writes_workspace_data: false;
    connects_cloud_services: false;
    uploads_data: false;
    enables_ai: false;
  };
}

export type DatabaseTemplateRowReceiptSourceSurface =
  | "database-page"
  | "inline-database";

export interface DatabaseTemplateRowReceiptInput {
  template: Pick<NoteTemplate, "title" | "description">;
  draft: DatabaseTemplateRowDraft;
  row: Pick<DatabaseRow, "id" | "database_id" | "page_id">;
  source_surface: DatabaseTemplateRowReceiptSourceSurface;
}

export interface DatabaseTemplateRowReceipt {
  format: "zhinote-database-template-row-receipt";
  format_version: 1;
  receipt_id: string;
  receipt_status: "local-template-row-metadata-only";
  created_at: string;
  source_surface: DatabaseTemplateRowReceiptSourceSurface;
  privacy_note: string;
  template: {
    template_title: string;
    group_id: DatabaseTemplateRowGroupId;
    template_description_included: false;
  };
  local_write: {
    database_id: string;
    row_id: string;
    page_id: string;
    writes_local_database_row: true;
    writes_local_page: true;
    writes_page_body_from_template: true;
    database_title_included: false;
    row_title_included: false;
    page_title_included: false;
  };
  field_draft_summary: {
    fields_prefilled: number;
    fields_left_manual: number;
    value_kinds_prefilled: Array<
      DatabaseTemplateRowDraft["applied_fields"][number]["value_kind"]
    >;
    field_names_included: false;
    row_values_included: false;
  };
  boundary: {
    local_receipt_only: true;
    stored_in_browser_local_storage: true;
    includes_database_title: false;
    includes_row_title: false;
    includes_page_title: false;
    includes_database_field_names: false;
    includes_database_row_values: false;
    includes_page_body_text: false;
    includes_private_investment_details: false;
    includes_holdings: false;
    includes_tickers: false;
    includes_position_sizes: false;
    includes_prices: false;
    includes_trading_plan: false;
    includes_tokens_or_credentials: false;
    uploads_data: false;
    calls_external_service: false;
    writes_server_audit_log: false;
    receipt_writes_workspace_data: false;
    action_writes_local_workspace_data: true;
  };
}

export function buildDatabaseTemplateRowDraft(
  template: Pick<NoteTemplate, "title" | "description">,
  fields: DatabaseField[],
  now: Date = new Date()
): DatabaseTemplateRowDraft {
  const groupId = inferTemplateRowGroupId(template.title);
  const fieldValues: Record<string, unknown> = {};
  const appliedFields: DatabaseTemplateRowDraft["applied_fields"] = [];
  const skippedFields: DatabaseTemplateRowDraft["skipped_fields"] = [];

  for (const field of fields) {
    if (field.position === 0 && field.name === "Name") continue;

    const draft = getTemplateFieldDraftValue(template, groupId, field, now);
    if (!draft) {
      skippedFields.push({
        field_id: field.id,
        field_name: field.name,
        field_type: field.field_type,
        reason: getTemplateFieldSkipReason(field),
      });
      continue;
    }

    fieldValues[field.id] = draft.value;
    appliedFields.push({
      field_id: field.id,
      field_name: field.name,
      field_type: field.field_type,
      value_kind: draft.valueKind,
      reason: draft.reason,
    });
  }

  return {
    format: "zhinote-database-template-row-draft",
    format_version: 1,
    draft_status: "local-template-row-structure-only",
    template_title: template.title,
    group_id: groupId,
    field_values: fieldValues,
    applied_fields: appliedFields,
    skipped_fields: skippedFields,
    boundary: {
      local_draft_only: true,
      reads_template_metadata: true,
      reads_database_schema: true,
      reads_database_rows: false,
      reads_database_row_values: false,
      reads_page_text: false,
      includes_private_investment_details: false,
      includes_holdings: false,
      includes_tickers: false,
      includes_position_sizes: false,
      includes_prices: false,
      includes_trading_plan: false,
      writes_workspace_data: false,
      connects_cloud_services: false,
      uploads_data: false,
      enables_ai: false,
    },
  };
}

export function buildDatabaseTemplateRowReceipt(
  input: DatabaseTemplateRowReceiptInput
): DatabaseTemplateRowReceipt {
  return {
    format: "zhinote-database-template-row-receipt",
    format_version: 1,
    receipt_id: createReceiptId(),
    receipt_status: "local-template-row-metadata-only",
    created_at: new Date().toISOString(),
    source_surface: input.source_surface,
    privacy_note:
      "Generated locally after creating a database template row. This receipt records template-row action metadata only. It does not include database titles, row titles, page titles, database field names, database row values, page body text, private investment details, holdings, tickers, position sizes, prices, trading plans, tokens, credentials, cloud data, or AI output.",
    template: {
      template_title: input.template.title,
      group_id: input.draft.group_id,
      template_description_included: false,
    },
    local_write: {
      database_id: input.row.database_id,
      row_id: input.row.id,
      page_id: input.row.page_id,
      writes_local_database_row: true,
      writes_local_page: true,
      writes_page_body_from_template: true,
      database_title_included: false,
      row_title_included: false,
      page_title_included: false,
    },
    field_draft_summary: {
      fields_prefilled: input.draft.applied_fields.length,
      fields_left_manual: input.draft.skipped_fields.length,
      value_kinds_prefilled: Array.from(
        new Set(input.draft.applied_fields.map((field) => field.value_kind))
      ),
      field_names_included: false,
      row_values_included: false,
    },
    boundary: {
      local_receipt_only: true,
      stored_in_browser_local_storage: true,
      includes_database_title: false,
      includes_row_title: false,
      includes_page_title: false,
      includes_database_field_names: false,
      includes_database_row_values: false,
      includes_page_body_text: false,
      includes_private_investment_details: false,
      includes_holdings: false,
      includes_tickers: false,
      includes_position_sizes: false,
      includes_prices: false,
      includes_trading_plan: false,
      includes_tokens_or_credentials: false,
      uploads_data: false,
      calls_external_service: false,
      writes_server_audit_log: false,
      receipt_writes_workspace_data: false,
      action_writes_local_workspace_data: true,
    },
  };
}

export function appendDatabaseTemplateRowReceipt(
  receipt: DatabaseTemplateRowReceipt
) {
  if (!canUseLocalStorage()) return;

  const receipts = [receipt, ...listDatabaseTemplateRowReceipts()].slice(
    0,
    MAX_TEMPLATE_ROW_RECEIPTS
  );
  window.localStorage.setItem(
    TEMPLATE_ROW_RECEIPT_STORAGE_KEY,
    JSON.stringify(receipts)
  );
  window.dispatchEvent(
    new CustomEvent(DATABASE_TEMPLATE_ROW_RECEIPT_EVENT, { detail: receipt })
  );
}

export function listDatabaseTemplateRowReceipts(): DatabaseTemplateRowReceipt[] {
  if (!canUseLocalStorage()) return [];

  try {
    const raw = window.localStorage.getItem(TEMPLATE_ROW_RECEIPT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isDatabaseTemplateRowReceipt);
  } catch {
    return [];
  }
}

export function inferTemplateRowGroupId(
  templateTitle: string
): DatabaseTemplateRowGroupId {
  if (templateTitle === "研究报告" || templateTitle === "报告摄取清单") {
    return "report";
  }
  if (
    templateTitle === "会议纪要" ||
    templateTitle === "会议转录稿" ||
    templateTitle === "会议行动项" ||
    templateTitle === "专家电话纪要" ||
    templateTitle === "管理层会议纪要"
  ) {
    return "meeting";
  }
  if (
    templateTitle === "持仓备忘录" ||
    templateTitle === "观察名单" ||
    templateTitle === "催化剂与风险复盘"
  ) {
    return "portfolio";
  }
  return "company";
}

interface TemplateFieldDraftValue {
  value: unknown;
  valueKind: DatabaseTemplateRowDraft["applied_fields"][number]["value_kind"];
  reason: string;
}

function getTemplateFieldDraftValue(
  template: Pick<NoteTemplate, "title" | "description">,
  groupId: DatabaseTemplateRowGroupId,
  field: DatabaseField,
  now: Date
): TemplateFieldDraftValue | null {
  if (isSensitiveInvestmentField(field.name)) return null;

  if (field.field_type === "status") {
    return chooseOptionDraft(field, getStatusCandidates(template.title, groupId), {
      valueKind: "status",
      reason: "模板行默认状态，用于看板和 feed 分组。",
    });
  }

  if (field.field_type === "select") {
    return chooseOptionDraft(
      field,
      getSelectCandidates(template.title, groupId, field.name),
      {
        valueKind: "select",
        reason: "模板行默认类型，用于 gallery、chart 或筛选。",
      }
    );
  }

  if (field.field_type === "date" && shouldFillDateField(field.name)) {
    return {
      value: toDateInputValue(now),
      valueKind: "date",
      reason: "模板行创建日期，用于日历和时间线视图。",
    };
  }

  if (field.field_type === "checkbox" && shouldFillCheckboxField(field.name)) {
    return {
      value: template.title === "会议行动项",
      valueKind: "checkbox",
      reason: "会议行动项默认进入 follow-up 队列，其它模板保持未勾选。",
    };
  }

  if (field.field_type === "text") {
    const text = getTextDraftValue(template, field.name);
    if (text) {
      return {
        value: text,
        valueKind: "text",
        reason: "模板行结构化占位，不包含私人投资细节。",
      };
    }
  }

  return null;
}

function chooseOptionDraft(
  field: DatabaseField,
  candidates: string[],
  metadata: Pick<TemplateFieldDraftValue, "valueKind" | "reason">
): TemplateFieldDraftValue | null {
  const options = getFieldOptions(field);
  const selected = findMatchingOption(options, candidates);
  if (!selected) return null;

  return {
    value: selected,
    ...metadata,
  };
}

function findMatchingOption(options: string[], candidates: string[]) {
  const normalizedOptions = options.map((option) => ({
    option,
    normalized: normalizeName(option),
  }));
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeName(candidate);
    const exact = normalizedOptions.find(
      (item) => item.normalized === normalizedCandidate
    );
    if (exact) return exact.option;
    const fuzzy = normalizedOptions.find(
      (item) =>
        item.normalized.includes(normalizedCandidate) ||
        normalizedCandidate.includes(item.normalized)
    );
    if (fuzzy) return fuzzy.option;
  }
  return null;
}

function getStatusCandidates(
  templateTitle: string,
  groupId: DatabaseTemplateRowGroupId
) {
  if (groupId === "report") return ["Inbox", "Reviewing", "待复核", "待处理"];
  if (groupId === "meeting") {
    if (templateTitle === "会议转录稿") {
      return ["Transcribed", "Notes to process", "Recorded", "已转录"];
    }
    if (templateTitle === "会议行动项") return ["Follow-up", "Notes to process"];
    return ["Notes to process", "Scheduled", "Recorded"];
  }
  if (groupId === "portfolio") {
    if (templateTitle === "观察名单") return ["Watchlist", "Idea", "Researching"];
    if (templateTitle === "催化剂与风险复盘") return ["Review", "Researching"];
    return ["Researching", "Watchlist", "Review"];
  }
  return ["Researching", "Idea", "Active coverage", "Reviewing"];
}

function getSelectCandidates(
  templateTitle: string,
  groupId: DatabaseTemplateRowGroupId,
  fieldName: string
) {
  const normalizedField = normalizeName(fieldName);
  if (normalizedField.includes("format") || normalizedField.includes("格式")) {
    if (groupId === "report") {
      return ["HTML", "Markdown", "PDF", "Excel", "Word", "Other"];
    }
    return ["Markdown", "Other"];
  }
  if (normalizedField.includes("type") || normalizedField.includes("类型")) {
    if (groupId === "meeting") {
      if (templateTitle === "专家电话纪要") {
        return ["Expert call", "Channel check", "Interview"];
      }
      if (templateTitle === "管理层会议纪要") {
        return ["Management call", "NDR", "Investor meeting"];
      }
      return ["Internal review", "Management call", "Expert call"];
    }
    if (groupId === "report") {
      return ["Research report", "HTML", "Markdown", "PDF", "Excel", "Word"];
    }
    return [templateTitle, "Research"];
  }
  if (
    normalizedField.includes("priority") ||
    normalizedField.includes("优先级")
  ) {
    return ["Medium", "Normal", "中"];
  }
  if (
    normalizedField.includes("conviction") ||
    normalizedField.includes("确信")
  ) {
    return ["Review", "Medium", "Low"];
  }
  return getStatusCandidates(templateTitle, groupId);
}

function shouldFillDateField(fieldName: string) {
  const normalized = normalizeName(fieldName);
  return (
    normalized.includes("date") ||
    normalized.includes("日期") ||
    normalized.includes("published")
  ) && !normalized.includes("catalyst");
}

function shouldFillCheckboxField(fieldName: string) {
  const normalized = normalizeName(fieldName);
  return (
    normalized.includes("follow") ||
    normalized.includes("action") ||
    normalized.includes("后续")
  );
}

function getTextDraftValue(
  template: Pick<NoteTemplate, "title" | "description">,
  fieldName: string
) {
  const normalized = normalizeName(fieldName);
  if (isSensitiveInvestmentField(fieldName)) return null;
  if (normalized.includes("source") || normalized.includes("来源")) {
    return "手动模板行";
  }
  if (normalized.includes("action") || normalized.includes("follow")) {
    return template.title === "会议行动项" ? "待跟进" : "待补充";
  }
  if (
    normalized.includes("takeaway") ||
    normalized.includes("impact") ||
    normalized.includes("thesis") ||
    normalized.includes("assumption") ||
    normalized.includes("metric") ||
    normalized.includes("risk") ||
    normalized.includes("note") ||
    normalized.includes("结论") ||
    normalized.includes("假设") ||
    normalized.includes("指标") ||
    normalized.includes("风险") ||
    normalized.includes("备注")
  ) {
    return `待补充：${template.description}`;
  }
  return null;
}

function getTemplateFieldSkipReason(field: DatabaseField) {
  if (isSensitiveInvestmentField(field.name)) {
    return "敏感或方向性投资字段必须由用户手动填写。";
  }
  if (field.field_type === "relation") {
    return "Relation 字段需要用户选择具体页面。";
  }
  if (field.field_type === "url") {
    return "URL 字段需要用户粘贴具体来源。";
  }
  if (field.field_type === "number") {
    return "数字字段可能包含价格、权重、估值或仓位，默认不填写。";
  }
  return "没有安全的结构化默认值。";
}

function isSensitiveInvestmentField(fieldName: string) {
  const normalized = normalizeName(fieldName);
  return [
    "ticker",
    "holding",
    "position",
    "weight",
    "price",
    "target",
    "downside",
    "entry",
    "direction",
    "rating",
    "broker",
    "account",
    "trade",
    "transaction",
    "仓位",
    "持仓",
    "权重",
    "价格",
    "目标价",
    "下行",
    "买入",
    "卖出",
    "交易",
  ].some((keyword) => normalized.includes(keyword));
}

function toDateInputValue(value: Date) {
  return value.toISOString().slice(0, 10);
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[\s_\-:/]+/g, "");
}

function isDatabaseTemplateRowReceipt(
  value: unknown
): value is DatabaseTemplateRowReceipt {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<DatabaseTemplateRowReceipt>;
  return (
    record.format === "zhinote-database-template-row-receipt" &&
    record.receipt_status === "local-template-row-metadata-only" &&
    Boolean(record.receipt_id) &&
    Boolean(record.created_at)
  );
}

function canUseLocalStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function createReceiptId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `template-row-receipt-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}
