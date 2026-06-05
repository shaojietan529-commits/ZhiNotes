import {
  getCoverageAreaLabel,
  type CompanyCoverageAreaId,
} from "@/lib/company/companyCoverage";
import { normalizeRelationValue } from "@/lib/database/relationValues";
import type { DatabaseField, DatabaseRow, Page } from "@/lib/utils/types";

export interface CompanyTrackerIntakeItem {
  page_id: string;
  page_title: string;
  missing_sections: CompanyCoverageAreaId[];
  next_action: string;
}

export interface CompanyTrackerIntakeDraft {
  format: "zhinote-company-tracker-intake-draft";
  format_version: 1;
  draft_status: "local-company-tracker-row-draft";
  privacy_note: string;
  boundary: {
    local_row_draft_only: true;
    reads_company_coverage_candidate: true;
    reads_database_fields: true;
    reads_page_text: false;
    includes_page_text: false;
    includes_database_row_values: false;
    includes_file_bytes: false;
    includes_holdings: false;
    includes_trading_plans: false;
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
      | "company-page-relation"
      | "ticker"
      | "status"
      | "thesis"
      | "valuation-assumptions"
      | "key-metrics";
  }>;
  missing_fields: string[];
}

export interface CompanyTrackerExistingRow {
  row_id: string;
  row_page_id: string;
  row_title: string;
  company_page_field_id: string;
}

const COMPANY_TRACKER_REQUIRED_FIELDS = [
  { label: "公司页", aliases: ["公司页", "公司页面", "Company page"] },
  { label: "股票代码", aliases: ["股票代码", "代码", "Ticker"] },
  { label: "状态", aliases: ["状态", "Status"] },
  { label: "投资假设", aliases: ["投资假设", "Thesis"] },
  { label: "估值假设", aliases: ["估值假设", "估值", "Valuation assumptions"] },
  { label: "关键指标", aliases: ["关键指标", "KPI", "Key metrics"] },
];

export function buildCompanyTrackerIntakeDraft(
  item: CompanyTrackerIntakeItem,
  fields: DatabaseField[]
): CompanyTrackerIntakeDraft {
  const mappedFields: CompanyTrackerIntakeDraft["mapped_fields"] = [];
  const fieldValues: Record<string, unknown> = {};

  const companyPageField = findField(fields, ["公司页", "Company page", "公司页面"]);
  const tickerField = findField(fields, ["Ticker", "股票代码", "代码"]);
  const statusField = findField(fields, ["Status", "状态"]);
  const thesisField = findField(fields, ["Thesis", "投资假设"]);
  const valuationField = findField(fields, [
    "Valuation assumptions",
    "估值假设",
    "估值",
  ]);
  const keyMetricsField = findField(fields, [
    "Key metrics",
    "关键指标",
    "KPI",
  ]);
  const ticker = inferTickerFromTitle(item.page_title);

  if (companyPageField) {
    fieldValues[companyPageField.id] = [item.page_id];
    mappedFields.push({
      field_name: companyPageField.name,
      field_type: companyPageField.field_type,
      mapped_value: "company-page-relation",
    });
  }

  if (tickerField && ticker) {
    fieldValues[tickerField.id] = ticker;
    mappedFields.push({
      field_name: tickerField.name,
      field_type: tickerField.field_type,
      mapped_value: "ticker",
    });
  }

  if (statusField) {
    fieldValues[statusField.id] =
      item.missing_sections.length > 0 ? "研究中" : "正式覆盖";
    mappedFields.push({
      field_name: statusField.name,
      field_type: statusField.field_type,
      mapped_value: "status",
    });
  }

  if (thesisField) {
    fieldValues[thesisField.id] = item.next_action;
    mappedFields.push({
      field_name: thesisField.name,
      field_type: thesisField.field_type,
      mapped_value: "thesis",
    });
  }

  if (valuationField && item.missing_sections.includes("valuation")) {
    fieldValues[valuationField.id] = "待补估值假设";
    mappedFields.push({
      field_name: valuationField.name,
      field_type: valuationField.field_type,
      mapped_value: "valuation-assumptions",
    });
  }

  if (keyMetricsField && item.missing_sections.includes("key-metrics")) {
    fieldValues[keyMetricsField.id] = "待补关键指标";
    mappedFields.push({
      field_name: keyMetricsField.name,
      field_type: keyMetricsField.field_type,
      mapped_value: "key-metrics",
    });
  }

  return {
    format: "zhinote-company-tracker-intake-draft",
    format_version: 1,
    draft_status: "local-company-tracker-row-draft",
    privacy_note:
      "由一个公司覆盖候选和所选公司跟踪表字段结构在本地生成。它只创建带关系 id 和结构状态的行草稿，不读取或导出页面正文、数据库行值、文件字节、持仓、交易计划、云端数据、AI 提示词、token 或凭证。",
    boundary: {
      local_row_draft_only: true,
      reads_company_coverage_candidate: true,
      reads_database_fields: true,
      reads_page_text: false,
      includes_page_text: false,
      includes_database_row_values: false,
      includes_file_bytes: false,
      includes_holdings: false,
      includes_trading_plans: false,
      writes_workspace_data: false,
      connects_cloud_services: false,
      uploads_data: false,
      enables_ai: false,
    },
    row_title: `公司跟踪 - ${item.page_title}`,
    row_page_content: buildCompanyTrackerRowContent(item),
    field_values: fieldValues,
    mapped_fields: mappedFields,
    missing_fields: COMPANY_TRACKER_REQUIRED_FIELDS.filter(
      (requiredField) =>
        !mappedFields.some((field) =>
          requiredField.aliases.some(
            (alias) => normalizeName(field.field_name) === normalizeName(alias)
          )
        )
    ).map((requiredField) => requiredField.label),
  };
}

export function findExistingCompanyTrackerRow(
  rows: Array<DatabaseRow & { page: Page }>,
  fields: DatabaseField[],
  companyPageId: string
): CompanyTrackerExistingRow | null {
  const companyPageField = findField(fields, ["公司页", "Company page", "公司页面"]);
  if (!companyPageField) return null;

  for (const row of rows) {
    const values = parseFieldValues(row.field_values);
    const relationIds = normalizeRelationValue(values[companyPageField.id]);
    if (relationIds.includes(companyPageId)) {
      return {
        row_id: row.id,
        row_page_id: row.page_id,
        row_title: row.page?.title || "未命名公司跟踪行",
        company_page_field_id: companyPageField.id,
      };
    }
  }

  return null;
}

function buildCompanyTrackerRowContent(item: CompanyTrackerIntakeItem) {
  const missingSections =
    item.missing_sections.length > 0
      ? item.missing_sections
          .map((area) => `<li>${escapeHtml(getCoverageAreaLabel(area))}</li>`)
          .join("")
      : "<li>基础结构已覆盖，继续维护关系值、复盘节奏和最新结论。</li>";

  return `
    <h1>${escapeHtml(`公司跟踪 - ${item.page_title}`)}</h1>
    <p>由公司研究模块本地入库创建。这个行用来把公司主页接入公司跟踪表。</p>
    <h2>已连接</h2>
    <ul>
      <li>公司页 relation: ${escapeHtml(item.page_title)}</li>
    </ul>
    <h2>下一步</h2>
    <ul>
      <li>${escapeHtml(item.next_action)}</li>
      ${missingSections}
    </ul>
    <p><strong>隐私边界：</strong>本地单条写入，不读取页面正文、数据库行值、文件字节、持仓或交易计划。</p>
  `.trim();
}

function findField(fields: DatabaseField[], aliases: string[]) {
  const aliasSet = new Set(aliases.map(normalizeName));
  return fields.find((field) => aliasSet.has(normalizeName(field.name))) ?? null;
}

function inferTickerFromTitle(title: string) {
  const bracketMatch = title.match(/\(([A-Z]{1,6}(?:\.[A-Z]{1,3})?)\)/);
  if (bracketMatch?.[1]) return bracketMatch[1];

  const leadingMatch = title.match(/^([A-Z]{1,6}(?:\.[A-Z]{1,3})?)\b/);
  return leadingMatch?.[1] ?? "";
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
