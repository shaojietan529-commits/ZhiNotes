import type { Database, Page } from "@/lib/utils/types";

export type PortfolioReviewStatus = "ready" | "partial" | "missing";

export type PortfolioReviewAreaId =
  | "position-memo"
  | "watchlist"
  | "sizing-discipline"
  | "conviction"
  | "catalyst"
  | "risk-notes"
  | "thesis"
  | "research-links"
  | "tracker-database";

export interface PortfolioReviewArea {
  id: PortfolioReviewAreaId;
  title: string;
  status: PortfolioReviewStatus;
  evidence: string;
  next_action: string;
  privacy_boundary: string;
}

export interface PortfolioReviewItem {
  id: string;
  route: string;
  label: string;
  missing_areas: PortfolioReviewAreaId[];
  next_action: string;
  updated_at: string;
}

export interface PortfolioReviewReport {
  format: "zhinote-portfolio-review-report";
  format_version: 1;
  report_status: "local-portfolio-review-only";
  privacy_note: string;
  boundary: {
    local_report_only: true;
    reads_local_page_html: true;
    reads_database_metadata: true;
    includes_page_text: false;
    includes_page_titles: false;
    includes_database_row_values: false;
    includes_position_names: false;
    includes_tickers: false;
    includes_weights: false;
    includes_trading_plans: false;
    includes_transactions: false;
    reads_file_bytes: false;
    connects_brokerage_accounts: false;
    fetches_prices: false;
    writes_workspace_data: false;
    connects_cloud_services: false;
    uploads_data: false;
    enables_ai: false;
  };
  summary: {
    review_areas: number;
    ready: number;
    partial: number;
    missing: number;
    portfolio_memos: number;
    watchlist_pages: number;
    tracker_databases: number;
    items_needing_review: number;
  };
  areas: PortfolioReviewArea[];
  items: PortfolioReviewItem[];
}

const POSITION_MEMO_TERMS = [
  "position memo",
  "investment memo",
  "持仓备忘录",
  "投资备忘录",
];
const WATCHLIST_TERMS = ["watchlist", "观察名单", "idea", "想法"];
const SIZING_TERMS = [
  "target weight",
  "current weight",
  "position size",
  "仓位",
  "目标权重",
  "当前权重",
];
const CONVICTION_TERMS = ["conviction", "确信度", "confidence", "评级"];
const CATALYST_TERMS = ["catalyst", "next catalyst", "催化剂", "检查点"];
const RISK_TERMS = ["risk notes", "risk", "风险", "下行"];
const THESIS_TERMS = ["thesis", "investment thesis", "投资假设", "核心假设"];
const RESEARCH_LINK_TERMS = [
  "company page",
  "related report",
  "related meeting",
  "related memo",
  "公司页面",
  "相关报告",
  "相关会议",
  "相关备忘录",
];
const TRACKER_TERMS = [
  "portfolio tracker",
  "portfolio and watchlist",
  "组合跟踪",
  "观察名单",
];

export function buildPortfolioReviewReport(
  pages: Page[],
  databases: Database[]
): PortfolioReviewReport {
  const portfolioMemos = filterPages(pages, POSITION_MEMO_TERMS);
  const watchlistPages = filterPages(pages, WATCHLIST_TERMS);
  const sizingPages = filterPages(pages, SIZING_TERMS);
  const convictionPages = filterPages(pages, CONVICTION_TERMS);
  const catalystPages = filterPages(pages, CATALYST_TERMS);
  const riskPages = filterPages(pages, RISK_TERMS);
  const thesisPages = filterPages(pages, THESIS_TERMS);
  const researchLinkPages = filterPages(pages, RESEARCH_LINK_TERMS);
  const trackerDatabases = databases.filter((database) =>
    textMatches(`${database.title} ${database.description ?? ""}`, TRACKER_TERMS)
  );
  const reviewPages = uniquePages([...portfolioMemos, ...watchlistPages]);
  const items = reviewPages
    .map((page, index) => buildReviewItem(page, index))
    .filter((item) => item.missing_areas.length > 0);

  const areas: PortfolioReviewArea[] = [
    {
      id: "position-memo",
      title: "持仓备忘录",
      status: countStatus(portfolioMemos.length),
      evidence: `${portfolioMemos.length} 个本地页面包含持仓或投资备忘录结构。`,
      next_action:
        "每个正式组合想法都应有备忘录，记录决策逻辑、核心假设和复盘节奏。",
      privacy_boundary:
        "只统计结构覆盖；导出不包含页面标题、ticker、持仓名或交易计划。",
    },
    {
      id: "watchlist",
      title: "观察名单",
      status: countStatus(watchlistPages.length),
      evidence: `${watchlistPages.length} 个本地页面包含观察名单结构。`,
      next_action:
        "把待研究公司先放入观察名单，再决定是否进入正式组合研究。",
      privacy_boundary: "只统计结构覆盖，不导出观察名单条目名称。",
    },
    {
      id: "sizing-discipline",
      title: "仓位纪律",
      status: countStatus(sizingPages.length),
      evidence: `${sizingPages.length} 个页面包含仓位纪律结构。`,
      next_action:
        "把目标权重、当前权重、上行、下行和组合角色放在可复盘位置。",
      privacy_boundary: "只记录是否有仓位结构，不导出任何权重数值。",
    },
    {
      id: "conviction",
      title: "确信度",
      status: countStatus(convictionPages.length),
      evidence: `${convictionPages.length} 个页面包含确信度或评级结构。`,
      next_action:
        "为每个组合想法维护确信度、证伪条件和需要继续验证的问题。",
      privacy_boundary: "只记录结构覆盖，不导出评级或观点内容。",
    },
    {
      id: "catalyst",
      title: "催化剂",
      status: countStatus(catalystPages.length),
      evidence: `${catalystPages.length} 个页面包含催化剂或检查点结构。`,
      next_action:
        "把下一催化剂、复盘日期和关键事件挂回公司研究和会议记录。",
      privacy_boundary: "只记录结构覆盖，不导出事件细节或交易节奏。",
    },
    {
      id: "risk-notes",
      title: "风险笔记",
      status: countStatus(riskPages.length),
      evidence: `${riskPages.length} 个页面包含风险笔记结构。`,
      next_action:
        "补齐下行情景、反向证据、风险监控项和止损/降权触发条件。",
      privacy_boundary: "只记录结构覆盖，不导出风险判断正文。",
    },
    {
      id: "thesis",
      title: "投资假设",
      status: countStatus(thesisPages.length),
      evidence: `${thesisPages.length} 个页面包含投资假设结构。`,
      next_action:
        "把核心假设、验证证据、反证和更新节奏放进备忘录或公司页。",
      privacy_boundary: "只记录结构覆盖，不导出具体投资假设。",
    },
    {
      id: "research-links",
      title: "研究关联",
      status: countStatus(researchLinkPages.length),
      evidence: `${researchLinkPages.length} 个页面包含公司、报告、会议或备忘录关联结构。`,
      next_action:
        "用关系字段把组合条目连接回公司、报告、会议和研究备忘录。",
      privacy_boundary: "只统计关联结构，不导出关联对象标题或内容。",
    },
    {
      id: "tracker-database",
      title: "组合跟踪表",
      status: countStatus(trackerDatabases.length),
      evidence: `${trackerDatabases.length} 个本地数据库匹配组合或观察名单跟踪表。`,
      next_action:
        "用跟踪表统一管理状态、角色、确信度、催化剂、风险和研究关系。",
      privacy_boundary: "只读取数据库标题和描述，不读取数据库行值。",
    },
  ];

  return {
    format: "zhinote-portfolio-review-report",
    format_version: 1,
    report_status: "local-portfolio-review-only",
    privacy_note:
      "由页面结构信号和数据库元数据在本地生成。它只报告组合工作流覆盖面和缺失结构，不导出页面正文、页面标题、数据库行值、持仓名、股票代码、权重、持仓、交易计划、交易记录、账户数据、文件字节、云端数据或 AI 提示词。",
    boundary: {
      local_report_only: true,
      reads_local_page_html: true,
      reads_database_metadata: true,
      includes_page_text: false,
      includes_page_titles: false,
      includes_database_row_values: false,
      includes_position_names: false,
      includes_tickers: false,
      includes_weights: false,
      includes_trading_plans: false,
      includes_transactions: false,
      reads_file_bytes: false,
      connects_brokerage_accounts: false,
      fetches_prices: false,
      writes_workspace_data: false,
      connects_cloud_services: false,
      uploads_data: false,
      enables_ai: false,
    },
    summary: {
      review_areas: areas.length,
      ready: areas.filter((area) => area.status === "ready").length,
      partial: areas.filter((area) => area.status === "partial").length,
      missing: areas.filter((area) => area.status === "missing").length,
      portfolio_memos: portfolioMemos.length,
      watchlist_pages: watchlistPages.length,
      tracker_databases: trackerDatabases.length,
      items_needing_review: items.length,
    },
    areas,
    items,
  };
}

function buildReviewItem(page: Page, index: number): PortfolioReviewItem {
  const text = pageText(page);
  const missingAreas: PortfolioReviewAreaId[] = [];

  if (!textMatches(text, SIZING_TERMS)) missingAreas.push("sizing-discipline");
  if (!textMatches(text, CONVICTION_TERMS)) missingAreas.push("conviction");
  if (!textMatches(text, CATALYST_TERMS)) missingAreas.push("catalyst");
  if (!textMatches(text, RISK_TERMS)) missingAreas.push("risk-notes");
  if (!textMatches(text, THESIS_TERMS)) missingAreas.push("thesis");
  if (!textMatches(text, RESEARCH_LINK_TERMS)) missingAreas.push("research-links");

  return {
    id: page.id,
    route: `/page/${page.id}`,
    label: `本地组合资产 ${index + 1}`,
    missing_areas: missingAreas,
    next_action:
      missingAreas.length === 0
        ? "结构已覆盖基础组合复盘面，下一步补关系值和最新复盘结论。"
        : `优先补齐 ${missingAreas.map(getPortfolioReviewAreaLabel).join("、")}。`,
    updated_at: page.updated_at,
  };
}

function uniquePages(pages: Page[]) {
  return Array.from(new Map(pages.map((page) => [page.id, page])).values());
}

function filterPages(pages: Page[], terms: string[]) {
  return pages.filter((page) => textMatches(pageText(page), terms));
}

function pageText(page: Pick<Page, "title" | "content_text">) {
  return `${page.title ?? ""} ${page.content_text ?? ""}`;
}

function textMatches(value: string, terms: string[]) {
  const normalized = normalizeText(value);
  return terms.some((term) => normalized.includes(normalizeText(term)));
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function countStatus(count: number): PortfolioReviewStatus {
  if (count > 0) return "ready";
  return "missing";
}

export function getPortfolioReviewAreaLabel(areaId: PortfolioReviewAreaId) {
  const labels: Record<PortfolioReviewAreaId, string> = {
    "position-memo": "持仓备忘录",
    watchlist: "观察名单",
    "sizing-discipline": "仓位纪律",
    conviction: "确信度",
    catalyst: "催化剂",
    "risk-notes": "风险笔记",
    thesis: "投资假设",
    "research-links": "研究关联",
    "tracker-database": "组合跟踪表",
  };

  return labels[areaId];
}
