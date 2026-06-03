import {
  getPortfolioReviewAreaLabel,
  type PortfolioReviewAreaId,
} from "@/lib/portfolio/portfolioReview";
import { normalizeRelationValue } from "@/lib/database/relationValues";
import type { DatabaseField, DatabaseRow, Page } from "@/lib/utils/types";

export type PortfolioTrackerSourceKind = "position" | "watchlist";

export interface PortfolioTrackerIntakeItem {
  page_id: string;
  redacted_label: string;
  source_kind: PortfolioTrackerSourceKind;
  missing_areas: PortfolioReviewAreaId[];
  next_action: string;
  updated_at: string;
}

export interface PortfolioTrackerIntakeDraft {
  format: "zhinote-portfolio-tracker-intake-draft";
  format_version: 1;
  draft_status: "local-portfolio-tracker-row-draft";
  privacy_note: string;
  boundary: {
    local_row_draft_only: true;
    reads_portfolio_review_item: true;
    reads_database_fields: true;
    reads_page_text: false;
    includes_page_text: false;
    includes_page_titles: false;
    includes_database_row_values: false;
    includes_position_names: false;
    includes_tickers: false;
    includes_weights: false;
    includes_holdings: false;
    includes_trading_plans: false;
    includes_transactions: false;
    connects_brokerage_accounts: false;
    fetches_prices: false;
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
      | "related-memo-relation"
      | "status"
      | "conviction"
      | "thesis"
      | "risk-notes";
  }>;
  missing_fields: string[];
}

export interface PortfolioTrackerExistingRow {
  row_id: string;
  row_page_id: string;
  row_title: string;
  related_memo_field_id: string;
}

const PORTFOLIO_TRACKER_REQUIRED_FIELDS = [
  "Related memo",
  "Status",
  "Conviction",
  "Thesis",
  "Risk notes",
];

export function buildPortfolioTrackerIntakeDraft(
  item: PortfolioTrackerIntakeItem,
  fields: DatabaseField[]
): PortfolioTrackerIntakeDraft {
  const mappedFields: PortfolioTrackerIntakeDraft["mapped_fields"] = [];
  const fieldValues: Record<string, unknown> = {};

  const relatedMemoField = findField(fields, [
    "Related memo",
    "相关备忘录",
    "Memo",
  ]);
  const statusField = findField(fields, ["Status", "状态"]);
  const convictionField = findField(fields, ["Conviction", "确信度"]);
  const thesisField = findField(fields, ["Thesis", "投资假设"]);
  const riskNotesField = findField(fields, ["Risk notes", "风险笔记", "风险"]);

  if (relatedMemoField) {
    fieldValues[relatedMemoField.id] = [item.page_id];
    mappedFields.push({
      field_name: relatedMemoField.name,
      field_type: relatedMemoField.field_type,
      mapped_value: "related-memo-relation",
    });
  }

  if (statusField) {
    fieldValues[statusField.id] = getPortfolioTrackerStatus(item);
    mappedFields.push({
      field_name: statusField.name,
      field_type: statusField.field_type,
      mapped_value: "status",
    });
  }

  if (convictionField) {
    fieldValues[convictionField.id] = "Review";
    mappedFields.push({
      field_name: convictionField.name,
      field_type: convictionField.field_type,
      mapped_value: "conviction",
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

  if (riskNotesField && item.missing_areas.includes("risk-notes")) {
    fieldValues[riskNotesField.id] = "待补风险笔记";
    mappedFields.push({
      field_name: riskNotesField.name,
      field_type: riskNotesField.field_type,
      mapped_value: "risk-notes",
    });
  }

  return {
    format: "zhinote-portfolio-tracker-intake-draft",
    format_version: 1,
    draft_status: "local-portfolio-tracker-row-draft",
    privacy_note:
      "Generated locally from one redacted portfolio review item and the selected portfolio tracker field schema. It creates a row draft with relation ids and structural status only. It does not read or export page text, page titles, database row values, position names, tickers, weights, holdings, trading plans, transactions, brokerage data, prices, cloud data, AI prompts, tokens, or credentials.",
    boundary: {
      local_row_draft_only: true,
      reads_portfolio_review_item: true,
      reads_database_fields: true,
      reads_page_text: false,
      includes_page_text: false,
      includes_page_titles: false,
      includes_database_row_values: false,
      includes_position_names: false,
      includes_tickers: false,
      includes_weights: false,
      includes_holdings: false,
      includes_trading_plans: false,
      includes_transactions: false,
      connects_brokerage_accounts: false,
      fetches_prices: false,
      writes_workspace_data: false,
      connects_cloud_services: false,
      uploads_data: false,
      enables_ai: false,
    },
    row_title: `组合跟踪 - ${item.redacted_label}`,
    row_page_content: buildPortfolioTrackerRowContent(item),
    field_values: fieldValues,
    mapped_fields: mappedFields,
    missing_fields: PORTFOLIO_TRACKER_REQUIRED_FIELDS.filter(
      (fieldName) =>
        !mappedFields.some(
          (field) => normalizeName(field.field_name) === normalizeName(fieldName)
        )
    ),
  };
}

export function findExistingPortfolioTrackerRow(
  rows: Array<DatabaseRow & { page: Page }>,
  fields: DatabaseField[],
  memoPageId: string
): PortfolioTrackerExistingRow | null {
  const relatedMemoField = findField(fields, [
    "Related memo",
    "相关备忘录",
    "Memo",
  ]);
  if (!relatedMemoField) return null;

  for (const row of rows) {
    const values = parseFieldValues(row.field_values);
    const relationIds = normalizeRelationValue(values[relatedMemoField.id]);
    if (relationIds.includes(memoPageId)) {
      return {
        row_id: row.id,
        row_page_id: row.page_id,
        row_title: row.page?.title || "未命名组合跟踪行",
        related_memo_field_id: relatedMemoField.id,
      };
    }
  }

  return null;
}

function getPortfolioTrackerStatus(item: PortfolioTrackerIntakeItem) {
  if (item.source_kind === "watchlist") return "Watchlist";
  if (item.missing_areas.length > 0) return "Researching";
  return "Active";
}

function buildPortfolioTrackerRowContent(item: PortfolioTrackerIntakeItem) {
  const missingAreas =
    item.missing_areas.length > 0
      ? item.missing_areas
          .map((area) => `<li>${escapeHtml(getPortfolioReviewAreaLabel(area))}</li>`)
          .join("")
      : "<li>基础结构已覆盖，继续补 relation 值和最新复盘结论。</li>";

  return `
    <h1>${escapeHtml(`组合跟踪 - ${item.redacted_label}`)}</h1>
    <p>由组合模块本地入库创建。这个 row 用来把本地持仓或观察名单 memo 接入组合跟踪表。</p>
    <h2>已连接</h2>
    <ul>
      <li>Related memo relation: ${escapeHtml(item.redacted_label)}</li>
      <li>来源类型：${item.source_kind === "watchlist" ? "观察名单" : "持仓 memo"}</li>
    </ul>
    <h2>下一步</h2>
    <ul>
      <li>${escapeHtml(item.next_action)}</li>
      ${missingAreas}
    </ul>
    <p><strong>隐私边界：</strong>本地单条写入，不读取页面正文、页面标题、ticker、权重、持仓名、交易计划、交易记录、券商账户或价格源。</p>
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
