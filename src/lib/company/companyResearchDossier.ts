import {
  getCoverageAreaLabel,
  type CompanyCoverageAreaId,
  type CompanyCoverageReport,
  type CompanyCoverageStatus,
} from "@/lib/company/companyCoverage";

export type CompanyResearchDossierStatus =
  | CompanyCoverageStatus
  | "manual-confirmation";

export interface CompanyResearchDossierSection {
  id: CompanyCoverageAreaId;
  title: string;
  status: CompanyResearchDossierStatus;
  evidence: string;
  next_action: string;
  target_route: string;
  writes_workspace_data: false;
  privacy_boundary: string;
}

export interface CompanyResearchDossierItem {
  id: string;
  company_page_id: string;
  company_title: string;
  route: string;
  updated_at: string;
  completion_score: number;
  ready_sections: CompanyCoverageAreaId[];
  missing_sections: CompanyCoverageAreaId[];
  sections: CompanyResearchDossierSection[];
  next_action: string;
  privacy_boundary: string;
}

export interface CompanyResearchDossierAction {
  id: string;
  title: string;
  status: CompanyResearchDossierStatus;
  applies_to: CompanyCoverageAreaId[];
  reason: string;
  target_route: string;
}

export interface CompanyResearchDossierPlan {
  format: "zhinote-company-research-dossier-plan";
  format_version: 1;
  plan_status: "local-company-dossier-only";
  privacy_note: string;
  boundary: {
    local_plan_only: true;
    reads_company_coverage_report: true;
    reads_page_text: false;
    includes_page_text: false;
    includes_database_row_values: false;
    reads_file_bytes: false;
    includes_holdings: false;
    includes_trading_plans: false;
    writes_workspace_data: false;
    connects_cloud_services: false;
    uploads_data: false;
    enables_ai: false;
  };
  summary: {
    company_pages: number;
    company_candidates: number;
    complete_dossiers: number;
    incomplete_dossiers: number;
    missing_memos: number;
    missing_earnings_reviews: number;
    missing_valuations: number;
    missing_key_metrics: number;
    missing_related_reports: number;
    missing_related_meetings: number;
    tracker_databases: number;
    manual_actions: number;
    ready_actions: number;
  };
  dossiers: CompanyResearchDossierItem[];
  global_actions: CompanyResearchDossierAction[];
}

const DOSSIER_SECTION_IDS: CompanyCoverageAreaId[] = [
  "company-home",
  "investment-memo",
  "earnings-review",
  "valuation",
  "key-metrics",
  "related-reports",
  "related-meetings",
  "tracker-database",
];

export function buildCompanyResearchDossierPlan(
  coverage: CompanyCoverageReport
): CompanyResearchDossierPlan {
  const areaMap = new Map(coverage.areas.map((area) => [area.id, area]));
  const trackerArea = areaMap.get("tracker-database");
  const trackerReady = trackerArea?.status === "ready";
  const dossiers = coverage.candidates.map((candidate) =>
    buildDossier(candidate, areaMap, trackerReady)
  );
  const globalActions = buildGlobalActions(coverage);
  const completeDossiers = trackerReady
    ? Math.max(
        coverage.summary.company_pages -
          coverage.summary.candidates_needing_work,
        0
      )
    : 0;
  const incompleteDossiers = Math.max(
    coverage.summary.company_pages - completeDossiers,
    0
  );

  return {
    format: "zhinote-company-research-dossier-plan",
    format_version: 1,
    plan_status: "local-company-dossier-only",
    privacy_note:
      "由本地公司覆盖报告生成。它创建公司级档案清单，覆盖页面、备忘录、业绩复盘、估值假设、关键指标、相关报告、相关会议和跟踪表设置；不会读取或导出页面正文、数据库行值、文件字节、持仓、交易计划、云端数据、AI 提示词、token 或凭证。",
    boundary: {
      local_plan_only: true,
      reads_company_coverage_report: true,
      reads_page_text: false,
      includes_page_text: false,
      includes_database_row_values: false,
      reads_file_bytes: false,
      includes_holdings: false,
      includes_trading_plans: false,
      writes_workspace_data: false,
      connects_cloud_services: false,
      uploads_data: false,
      enables_ai: false,
    },
    summary: {
      company_pages: coverage.summary.company_pages,
      company_candidates: coverage.summary.candidates_needing_work,
      complete_dossiers: completeDossiers,
      incomplete_dossiers: incompleteDossiers,
      missing_memos: countMissing(dossiers, "investment-memo"),
      missing_earnings_reviews: countMissing(dossiers, "earnings-review"),
      missing_valuations: countMissing(dossiers, "valuation"),
      missing_key_metrics: countMissing(dossiers, "key-metrics"),
      missing_related_reports: countMissing(dossiers, "related-reports"),
      missing_related_meetings: countMissing(dossiers, "related-meetings"),
      tracker_databases: coverage.summary.tracker_databases,
      manual_actions: globalActions.filter(
        (action) => action.status === "manual-confirmation"
      ).length,
      ready_actions: globalActions.filter((action) => action.status === "ready")
        .length,
    },
    dossiers,
    global_actions: globalActions,
  };
}

function buildDossier(
  candidate: CompanyCoverageReport["candidates"][number],
  areaMap: Map<CompanyCoverageAreaId, CompanyCoverageReport["areas"][number]>,
  trackerReady: boolean
): CompanyResearchDossierItem {
  const missingSet = new Set(candidate.missing_sections);
  if (!trackerReady) {
    missingSet.add("tracker-database");
  }

  const sections = DOSSIER_SECTION_IDS.map((areaId) =>
    buildDossierSection(candidate, areaMap, areaId, missingSet)
  );
  const missingSections = sections
    .filter((section) => section.status === "missing")
    .map((section) => section.id);
  const readySections = sections
    .filter((section) => section.status === "ready")
    .map((section) => section.id);

  return {
    id: `dossier-${candidate.id}`,
    company_page_id: candidate.id,
    company_title: candidate.title,
    route: candidate.route,
    updated_at: candidate.updated_at,
    completion_score: Math.round(
      (readySections.length / DOSSIER_SECTION_IDS.length) * 100
    ),
    ready_sections: readySections,
    missing_sections: missingSections,
    sections,
    next_action:
      missingSections.length === 0
        ? "公司档案基础结构已齐，下一步手动复核关系值、最新结论和复盘节奏。"
        : `优先补齐 ${missingSections.map(getCoverageAreaLabel).join("、")}。`,
    privacy_boundary:
      "公司档案只整理结构缺口，不读取或导出页面正文、数据库行值、文件字节、持仓或交易计划。",
  };
}

function buildDossierSection(
  candidate: CompanyCoverageReport["candidates"][number],
  areaMap: Map<CompanyCoverageAreaId, CompanyCoverageReport["areas"][number]>,
  areaId: CompanyCoverageAreaId,
  missingSet: Set<CompanyCoverageAreaId>
): CompanyResearchDossierSection {
  const area = areaMap.get(areaId);
  const status: CompanyResearchDossierStatus = missingSet.has(areaId)
    ? "missing"
    : "ready";

  return {
    id: areaId,
    title: getCoverageAreaLabel(areaId),
    status,
    evidence:
      areaId === "company-home"
        ? `已定位公司研究页：${candidate.title}。`
        : status === "missing"
          ? `${candidate.title} 缺少 ${getCoverageAreaLabel(areaId)} 结构。`
          : area?.evidence ??
            `${candidate.title} 已覆盖 ${getCoverageAreaLabel(areaId)}。`,
    next_action:
      status === "missing"
        ? missingSectionAction(areaId)
        : readySectionAction(areaId),
    target_route: getSectionTargetRoute(areaId, candidate.route),
    writes_workspace_data: false,
    privacy_boundary:
      area?.privacy_boundary ??
      "只标记结构状态，不读取正文、数据库行值、文件字节、持仓或交易计划。",
  };
}

function buildGlobalActions(
  coverage: CompanyCoverageReport
): CompanyResearchDossierAction[] {
  const actions: CompanyResearchDossierAction[] = [];
  const areaMap = new Map(coverage.areas.map((area) => [area.id, area]));

  if (coverage.summary.company_pages === 0) {
    actions.push({
      id: "create-company-home",
      title: "先创建公司研究页",
      status: "missing",
      applies_to: ["company-home"],
      reason: "还没有公司研究主页，无法形成公司级档案。",
      target_route: "/modules/company-research",
    });
  }

  for (const areaId of ["related-reports", "related-meetings"] as const) {
    if (areaMap.get(areaId)?.status === "missing") {
      actions.push({
        id: `link-${areaId}`,
        title: `补齐${getCoverageAreaLabel(areaId)}`,
        status: "manual-confirmation",
        applies_to: [areaId],
        reason:
          areaId === "related-reports"
            ? "公司档案需要挂回报告库，才能从公司页追溯重要报告。"
            : "公司档案需要挂回会议纪要，才能追踪管理层会议、专家电话会和行动项。",
        target_route:
          areaId === "related-reports" ? "/modules/reports" : "/modules/meetings",
      });
    }
  }

  if (areaMap.get("tracker-database")?.status === "missing") {
    actions.push({
      id: "create-company-tracker",
      title: "创建公司跟踪表",
      status: "missing",
      applies_to: ["tracker-database"],
      reason: "缺少公司跟踪表时，公司档案只能停留在页面清单，无法进入数据库化跟踪。",
      target_route: "/modules/company-research",
    });
  }

  if (coverage.summary.candidates_needing_work > 0) {
    actions.push({
      id: "review-company-dossiers",
      title: "逐个复核公司档案",
      status: "manual-confirmation",
      applies_to: [
        "investment-memo",
        "earnings-review",
        "valuation",
        "key-metrics",
        "related-reports",
        "related-meetings",
      ],
      reason: `${coverage.summary.candidates_needing_work} 个公司研究页仍有结构缺口。`,
      target_route: "/modules/company-research",
    });
  }

  if (actions.length === 0) {
    actions.push({
      id: "maintain-review-cadence",
      title: "维护复盘节奏",
      status: "ready",
      applies_to: ["tracker-database"],
      reason:
        "公司档案基础结构已齐，下一步手动维护关系值、催化剂、复盘日期和最新结论。",
      target_route: "/modules/company-research",
    });
  }

  return actions;
}

function countMissing(
  dossiers: CompanyResearchDossierItem[],
  areaId: CompanyCoverageAreaId
) {
  return dossiers.filter((dossier) => dossier.missing_sections.includes(areaId))
    .length;
}

function getSectionTargetRoute(areaId: CompanyCoverageAreaId, pageRoute: string) {
  const routes: Record<CompanyCoverageAreaId, string> = {
    "company-home": pageRoute,
    "investment-memo": pageRoute,
    "earnings-review": pageRoute,
    valuation: pageRoute,
    "key-metrics": pageRoute,
    "related-reports": "/modules/reports",
    "related-meetings": "/modules/meetings",
    "tracker-database": "/modules/company-research",
  };

  return routes[areaId];
}

function missingSectionAction(areaId: CompanyCoverageAreaId) {
  const actions: Record<CompanyCoverageAreaId, string> = {
    "company-home": "打开公司研究页，补商业模式、行业结构和关键问题。",
    "investment-memo": "补投资备忘录，沉淀假设、风险收益、催化剂和下一步动作。",
    "earnings-review": "补业绩复盘，记录季度数据、管理层表述和模型影响。",
    valuation: "补估值假设，把收入、利润率、倍数或 DCF 假设放到可复盘结构里。",
    "key-metrics": "补关键指标，维护 KPI、单位经济和运营指标入口。",
    "related-reports": "去报告库补公司 relation 或页面链接。",
    "related-meetings": "去会议模块补公司 relation 或页面链接。",
    "tracker-database": "创建公司跟踪表，并把公司页入库为跟踪表行。",
  };

  return actions[areaId];
}

function readySectionAction(areaId: CompanyCoverageAreaId) {
  const actions: Record<CompanyCoverageAreaId, string> = {
    "company-home": "继续维护最新结论、开放问题和研究链接。",
    "investment-memo": "复核 memo 是否反映最新 thesis、风险和催化剂。",
    "earnings-review": "复核最近一次业绩变化是否已进入 memo 和估值假设。",
    valuation: "复核估值假设是否有日期、情景和来源说明。",
    "key-metrics": "复核关键指标是否可持续更新并能连接业绩复盘。",
    "related-reports": "手动确认关键报告是否已挂回公司页。",
    "related-meetings": "手动确认会议纪要和行动项是否已挂回公司页。",
    "tracker-database": "手动维护状态、评级、催化剂和下一次复盘日期。",
  };

  return actions[areaId];
}
