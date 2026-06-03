import {
  getCoverageAreaLabel,
  type CompanyCoverageAreaId,
  type CompanyCoverageReport,
  type CompanyCoverageStatus,
} from "@/lib/company/companyCoverage";
import {
  getResearchWorkflowSpec,
  type ResearchWorkflowStage,
} from "@/lib/modules/researchWorkflow";

export type CompanyResearchPlaybookStatus =
  | CompanyCoverageStatus
  | "manual-confirmation";

export interface CompanyResearchPlaybookStep {
  id: string;
  title: string;
  status: CompanyResearchPlaybookStatus;
  surface: ResearchWorkflowStage["surface"] | "analysis";
  evidence: string;
  next_action: string;
  privacy_boundary: string;
}

export interface CompanyResearchActionQueueItem {
  id: string;
  title: string;
  status: CompanyResearchPlaybookStatus;
  applies_to: CompanyCoverageAreaId[];
  reason: string;
  suggested_destination: string;
}

export interface CompanyResearchPlaybook {
  format: "zhinote-company-research-playbook";
  format_version: 1;
  playbook_status: "local-company-playbook-only";
  privacy_note: string;
  boundary: {
    local_playbook_only: true;
    reads_company_coverage_report: true;
    reads_research_workflow_schema: true;
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
  summary: {
    workflow_steps: number;
    ready_steps: number;
    partial_steps: number;
    missing_steps: number;
    manual_confirmation_steps: number;
    action_queue_items: number;
    candidate_companies: number;
    tracker_databases: number;
    relation_gates: number;
  };
  workflow: {
    module_route: string;
    primary_database_preset: string;
    primary_assets: string[];
    required_relation_kinds: string[];
    key_tracker_fields: string[];
  };
  steps: CompanyResearchPlaybookStep[];
  action_queue: CompanyResearchActionQueueItem[];
}

export function buildCompanyResearchPlaybook(
  coverage: CompanyCoverageReport
): CompanyResearchPlaybook {
  const workflow = getResearchWorkflowSpec("company");
  const steps = buildPlaybookSteps(coverage);
  const actionQueue = buildActionQueue(coverage);

  return {
    format: "zhinote-company-research-playbook",
    format_version: 1,
    playbook_status: "local-company-playbook-only",
    privacy_note:
      "Generated locally from the company coverage report and shared research workflow schema. This playbook does not read or export page text, database row values, file bytes, holdings, trading plans, cloud data, AI prompts, tokens, or credentials.",
    boundary: {
      local_playbook_only: true,
      reads_company_coverage_report: true,
      reads_research_workflow_schema: true,
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
    summary: {
      workflow_steps: steps.length,
      ready_steps: steps.filter((step) => step.status === "ready").length,
      partial_steps: steps.filter((step) => step.status === "partial").length,
      missing_steps: steps.filter((step) => step.status === "missing").length,
      manual_confirmation_steps: steps.filter(
        (step) => step.status === "manual-confirmation"
      ).length,
      action_queue_items: actionQueue.length,
      candidate_companies: coverage.summary.candidates_needing_work,
      tracker_databases: coverage.summary.tracker_databases,
      relation_gates: actionQueue.filter((item) =>
        item.applies_to.some((area) =>
          ["related-reports", "related-meetings", "tracker-database"].includes(
            area
          )
        )
      ).length,
    },
    workflow: {
      module_route: workflow.module_route,
      primary_database_preset: workflow.primary_database_preset,
      primary_assets: workflow.primary_assets,
      required_relation_kinds: workflow.required_relation_kinds,
      key_tracker_fields: workflow.key_tracker_fields,
    },
    steps,
    action_queue: actionQueue,
  };
}

function buildPlaybookSteps(
  coverage: CompanyCoverageReport
): CompanyResearchPlaybookStep[] {
  const areaMap = new Map(coverage.areas.map((area) => [area.id, area]));

  return [
    areaStep(areaMap, "company-home", "page"),
    areaStep(areaMap, "investment-memo", "page"),
    areaStep(areaMap, "earnings-review", "page"),
    areaStep(areaMap, "valuation", "analysis"),
    areaStep(areaMap, "key-metrics", "database"),
    areaStep(areaMap, "related-reports", "relation"),
    areaStep(areaMap, "related-meetings", "relation"),
    areaStep(areaMap, "tracker-database", "database"),
    {
      id: "review-cadence",
      title: "复盘节奏",
      status:
        coverage.summary.company_pages > 0 &&
        coverage.summary.tracker_databases > 0
          ? "manual-confirmation"
          : "missing",
      surface: "database",
      evidence:
        coverage.summary.company_pages > 0
          ? "已有公司研究页，可继续设定覆盖频率、催化剂复盘和下一次更新日期。"
          : "还没有公司研究页，无法建立复盘节奏。",
      next_action:
        "在公司跟踪表中维护状态、下一催化剂、评级、估值假设和下次复盘动作。",
      privacy_boundary:
        "只提示复盘结构，不读取持仓、交易计划、目标价或数据库 row values。",
    },
  ];
}

function areaStep(
  areaMap: Map<CompanyCoverageAreaId, CompanyCoverageReport["areas"][number]>,
  areaId: CompanyCoverageAreaId,
  surface: CompanyResearchPlaybookStep["surface"]
): CompanyResearchPlaybookStep {
  const area = areaMap.get(areaId);

  return {
    id: areaId,
    title: getCoverageAreaLabel(areaId),
    status: area?.status ?? "missing",
    surface,
    evidence: area?.evidence ?? `${getCoverageAreaLabel(areaId)} 尚未覆盖。`,
    next_action:
      area?.next_action ?? `补齐 ${getCoverageAreaLabel(areaId)} 结构。`,
    privacy_boundary:
      area?.privacy_boundary ??
      "只生成结构化行动项，不导出页面正文或数据库 row values。",
  };
}

function buildActionQueue(
  coverage: CompanyCoverageReport
): CompanyResearchActionQueueItem[] {
  const queue: CompanyResearchActionQueueItem[] = [];
  const missingAreaIds = coverage.areas
    .filter((area) => area.status === "missing")
    .map((area) => area.id);

  if (missingAreaIds.includes("company-home")) {
    queue.push(actionItem("create-company-home", ["company-home"]));
  }
  if (missingAreaIds.includes("investment-memo")) {
    queue.push(actionItem("create-investment-memo", ["investment-memo"]));
  }
  if (missingAreaIds.includes("earnings-review")) {
    queue.push(actionItem("create-earnings-review", ["earnings-review"]));
  }
  if (
    missingAreaIds.includes("valuation") ||
    missingAreaIds.includes("key-metrics")
  ) {
    queue.push(actionItem("build-assumption-and-metrics", ["valuation", "key-metrics"]));
  }
  if (
    missingAreaIds.includes("related-reports") ||
    missingAreaIds.includes("related-meetings")
  ) {
    queue.push(
      actionItem("link-research-context", [
        "related-reports",
        "related-meetings",
      ])
    );
  }
  if (missingAreaIds.includes("tracker-database")) {
    queue.push(actionItem("create-company-tracker", ["tracker-database"]));
  }
  if (coverage.summary.candidates_needing_work > 0) {
    queue.push({
      id: "review-company-candidates",
      title: "复核待补齐公司页",
      status: "manual-confirmation",
      applies_to: [
        "investment-memo",
        "earnings-review",
        "valuation",
        "key-metrics",
        "related-reports",
        "related-meetings",
      ],
      reason: `${coverage.summary.candidates_needing_work} 个公司页还有结构缺口。`,
      suggested_destination: "公司覆盖雷达候选清单",
    });
  }

  return queue;
}

function actionItem(
  id:
    | "create-company-home"
    | "create-investment-memo"
    | "create-earnings-review"
    | "build-assumption-and-metrics"
    | "link-research-context"
    | "create-company-tracker",
  appliesTo: CompanyCoverageAreaId[]
): CompanyResearchActionQueueItem {
  const map: Record<
    typeof id,
    Omit<CompanyResearchActionQueueItem, "id" | "applies_to">
  > = {
    "create-company-home": {
      title: "创建公司主页",
      status: "missing",
      reason: "公司研究需要一个长期中枢页面承载商业模式、行业结构和研究问题。",
      suggested_destination: "新建公司研究页",
    },
    "create-investment-memo": {
      title: "创建投资 memo",
      status: "missing",
      reason: "投资假设、风险收益、催化剂和下一步动作需要沉淀到 memo。",
      suggested_destination: "新建投资备忘录",
    },
    "create-earnings-review": {
      title: "创建业绩复盘",
      status: "missing",
      reason: "业绩后需要记录管理层表述、模型影响和开放问题。",
      suggested_destination: "新建业绩复盘",
    },
    "build-assumption-and-metrics": {
      title: "补估值假设和关键指标",
      status: "missing",
      reason: "估值和 KPI 是公司研究进入可复盘状态的核心结构。",
      suggested_destination: "公司主页或公司跟踪表",
    },
    "link-research-context": {
      title: "补报告和会议关系",
      status: "missing",
      reason: "公司页需要连接报告库和会议纪要，形成完整研究上下文。",
      suggested_destination: "Research Graph relation 补全",
    },
    "create-company-tracker": {
      title: "创建公司跟踪表",
      status: "missing",
      reason: "公司跟踪表统一承载覆盖状态、评级、催化剂和 relation 字段。",
      suggested_destination: "创建公司跟踪表",
    },
  };

  return {
    id,
    applies_to: appliesTo,
    ...map[id],
  };
}
