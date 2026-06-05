import type { Database, Page } from "@/lib/utils/types";

export type CompanyCoverageStatus = "ready" | "partial" | "missing";

export type CompanyCoverageAreaId =
  | "company-home"
  | "investment-memo"
  | "earnings-review"
  | "valuation"
  | "key-metrics"
  | "related-reports"
  | "related-meetings"
  | "tracker-database";

export interface CompanyCoverageArea {
  id: CompanyCoverageAreaId;
  title: string;
  status: CompanyCoverageStatus;
  evidence: string;
  next_action: string;
  privacy_boundary: string;
}

export interface CompanyCoverageCandidate {
  id: string;
  title: string;
  updated_at: string;
  route: string;
  missing_sections: CompanyCoverageAreaId[];
  next_action: string;
}

export interface CompanyCoverageReport {
  format: "zhinote-company-coverage-report";
  format_version: 1;
  report_status: "local-company-coverage-only";
  privacy_note: string;
  boundary: {
    local_report_only: true;
    reads_local_page_html: true;
    reads_database_metadata: true;
    includes_page_text: false;
    includes_database_row_values: false;
    reads_file_bytes: false;
    writes_workspace_data: false;
    connects_cloud_services: false;
    uploads_data: false;
    enables_ai: false;
  };
  summary: {
    coverage_areas: number;
    ready: number;
    partial: number;
    missing: number;
    company_pages: number;
    investment_memos: number;
    earnings_reviews: number;
    tracker_databases: number;
    candidates_needing_work: number;
  };
  areas: CompanyCoverageArea[];
  candidates: CompanyCoverageCandidate[];
}

const COMPANY_HOME_TERMS = [
  "company research",
  "公司研究",
  "business model",
  "商业模式",
  "行业结构",
  "unit economics",
];
const INVESTMENT_MEMO_TERMS = [
  "investment memo",
  "投资备忘录",
  "投资假设",
  "risk/reward",
  "风险收益",
];
const EARNINGS_REVIEW_TERMS = [
  "earnings review",
  "业绩复盘",
  "quarterly",
  "季度",
  "management commentary",
];
const VALUATION_TERMS = [
  "valuation",
  "估值",
  "target price",
  "目标价",
  "assumption",
  "假设",
];
const KEY_METRIC_TERMS = [
  "key metrics",
  "关键指标",
  "unit economics",
  "单位经济",
  "kpi",
  "指标",
];
const REPORT_TERMS = [
  "related reports",
  "related report",
  "相关报告",
  "研究报告",
  "report page",
];
const MEETING_TERMS = [
  "related meetings",
  "related meeting",
  "相关会议",
  "会议纪要",
  "meeting note",
  "电话会",
];
const TRACKER_TERMS = [
  "company research",
  "company-level research",
  "公司研究",
  "公司跟踪",
];

export function buildCompanyCoverageReport(
  pages: Page[],
  databases: Database[]
): CompanyCoverageReport {
  const companyPages = filterPages(pages, COMPANY_HOME_TERMS);
  const investmentMemos = filterPages(pages, INVESTMENT_MEMO_TERMS);
  const earningsReviews = filterPages(pages, EARNINGS_REVIEW_TERMS);
  const valuationPages = filterPages(pages, VALUATION_TERMS);
  const keyMetricPages = filterPages(pages, KEY_METRIC_TERMS);
  const relatedReportPages = filterPages(pages, REPORT_TERMS);
  const relatedMeetingPages = filterPages(pages, MEETING_TERMS);
  const trackerDatabases = databases.filter((database) =>
    textMatches(`${database.title} ${database.description ?? ""}`, TRACKER_TERMS)
  );

  const areas: CompanyCoverageArea[] = [
    {
      id: "company-home",
      title: "公司主页",
      status: countStatus(companyPages.length),
      evidence: `${companyPages.length} 个本地页面匹配公司研究主页。`,
      next_action:
        "每个重点公司都应有一个长期主页，承载商业模式、行业结构、关键问题和研究链接。",
      privacy_boundary:
        "只统计本地页面标题和页面 HTML 中的结构关键词，不导出正文。",
    },
    {
      id: "investment-memo",
      title: "投资备忘录",
      status: countStatus(investmentMemos.length),
      evidence: `${investmentMemos.length} 个页面匹配投资备忘录。`,
      next_action:
        "把核心投资假设、风险收益、催化剂、仓位纪律和下一步动作沉淀到备忘录。",
      privacy_boundary: "只统计本地页面结构，不推断持仓或投资计划。",
    },
    {
      id: "earnings-review",
      title: "业绩复盘",
      status: countStatus(earningsReviews.length),
      evidence: `${earningsReviews.length} 个页面匹配业绩复盘。`,
      next_action:
        "每次业绩后记录数据变化、管理层表述、模型影响和开放问题。",
      privacy_boundary: "只统计本地页面结构，不读取财务模型文件内容。",
    },
    {
      id: "valuation",
      title: "估值假设",
      status: countStatus(valuationPages.length),
      evidence: `${valuationPages.length} 个页面包含估值或假设结构。`,
      next_action:
        "把收入、利润率、倍数、DCF 或情景假设放到可追踪页面或数据库字段里。",
      privacy_boundary: "只记录是否有估值结构，不导出具体估值数值。",
    },
    {
      id: "key-metrics",
      title: "关键指标",
      status: countStatus(keyMetricPages.length),
      evidence: `${keyMetricPages.length} 个页面包含关键指标结构。`,
      next_action:
        "为每个重点公司维护可复查的 KPI、单位经济和运营指标入口。",
      privacy_boundary: "只记录指标结构覆盖，不导出指标值。",
    },
    {
      id: "related-reports",
      title: "相关报告",
      status: countStatus(relatedReportPages.length),
      evidence: `${relatedReportPages.length} 个页面包含报告关联结构。`,
      next_action:
        "把报告库里的核心报告通过 relation 或页面链接挂回公司研究主页。",
      privacy_boundary: "只统计页面是否有报告关联结构，不读取报告文件内容。",
    },
    {
      id: "related-meetings",
      title: "相关会议",
      status: countStatus(relatedMeetingPages.length),
      evidence: `${relatedMeetingPages.length} 个页面包含会议关联结构。`,
      next_action:
        "把管理层会议、专家电话会和行动项关联到公司研究上下文。",
      privacy_boundary: "只统计页面是否有会议关联结构，不读取转录稿或录音。",
    },
    {
      id: "tracker-database",
      title: "公司跟踪表",
      status: countStatus(trackerDatabases.length),
      evidence: `${trackerDatabases.length} 个本地数据库匹配公司研究跟踪表。`,
      next_action:
        "用跟踪表统一管理覆盖状态、评级、催化剂、估值假设、报告和会议 relation。",
      privacy_boundary: "只读取数据库标题和描述，不读取数据库行值。",
    },
  ];

  const candidates = companyPages
    .map((page) => buildCandidate(page))
    .filter((candidate) => candidate.missing_sections.length > 0);

  return {
    format: "zhinote-company-coverage-report",
    format_version: 1,
    report_status: "local-company-coverage-only",
    privacy_note:
      "由本地页面标题、页面 HTML 结构和数据库 metadata 生成。它只识别公司研究覆盖面和缺失结构，不导出页面正文、数据库行值、文件字节、云端数据、AI prompt、持仓或投资计划。",
    boundary: {
      local_report_only: true,
      reads_local_page_html: true,
      reads_database_metadata: true,
      includes_page_text: false,
      includes_database_row_values: false,
      reads_file_bytes: false,
      writes_workspace_data: false,
      connects_cloud_services: false,
      uploads_data: false,
      enables_ai: false,
    },
    summary: {
      coverage_areas: areas.length,
      ready: areas.filter((area) => area.status === "ready").length,
      partial: areas.filter((area) => area.status === "partial").length,
      missing: areas.filter((area) => area.status === "missing").length,
      company_pages: companyPages.length,
      investment_memos: investmentMemos.length,
      earnings_reviews: earningsReviews.length,
      tracker_databases: trackerDatabases.length,
      candidates_needing_work: candidates.length,
    },
    areas,
    candidates,
  };
}

function buildCandidate(page: Page): CompanyCoverageCandidate {
  const text = pageText(page);
  const missingSections: CompanyCoverageAreaId[] = [];

  if (!textMatches(text, INVESTMENT_MEMO_TERMS)) {
    missingSections.push("investment-memo");
  }
  if (!textMatches(text, EARNINGS_REVIEW_TERMS)) {
    missingSections.push("earnings-review");
  }
  if (!textMatches(text, VALUATION_TERMS)) {
    missingSections.push("valuation");
  }
  if (!textMatches(text, KEY_METRIC_TERMS)) {
    missingSections.push("key-metrics");
  }
  if (!textMatches(text, REPORT_TERMS)) {
    missingSections.push("related-reports");
  }
  if (!textMatches(text, MEETING_TERMS)) {
    missingSections.push("related-meetings");
  }

  return {
    id: page.id,
    title: page.title || "未命名公司研究",
    updated_at: page.updated_at,
    route: `/page/${page.id}`,
    missing_sections: missingSections,
    next_action:
      missingSections.length === 0
        ? "结构已覆盖基础公司研究面，下一步补 relation 值和最新结论。"
        : `优先补齐 ${missingSections.map(getCoverageAreaLabel).join("、")}。`,
  };
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

function countStatus(count: number): CompanyCoverageStatus {
  if (count > 0) return "ready";
  return "missing";
}

export function getCoverageAreaLabel(areaId: CompanyCoverageAreaId) {
  const labels: Record<CompanyCoverageAreaId, string> = {
    "company-home": "公司主页",
    "investment-memo": "投资备忘录",
    "earnings-review": "业绩复盘",
    valuation: "估值假设",
    "key-metrics": "关键指标",
    "related-reports": "相关报告",
    "related-meetings": "相关会议",
    "tracker-database": "公司跟踪表",
  };

  return labels[areaId];
}
