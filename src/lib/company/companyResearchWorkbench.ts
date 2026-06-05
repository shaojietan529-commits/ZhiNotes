import type {
  CompanyCoverageAreaId,
  CompanyCoverageReport,
} from "@/lib/company/companyCoverage";
import type { CompanyResearchDossierPlan } from "@/lib/company/companyResearchDossier";
import type { CompanyResearchPlaybook } from "@/lib/company/companyResearchPlaybook";
import type { CompanyTrackerIntakeItem } from "@/lib/company/companyTrackerIntake";

export type CompanyResearchWorkbenchLaneId =
  | "company-foundation"
  | "thesis-workflow"
  | "earnings-valuation"
  | "research-links"
  | "tracker-intake"
  | "review-cadence"
  | "privacy-boundary";

export type CompanyResearchWorkbenchPriority = "high" | "medium" | "low";

export type CompanyResearchWorkbenchStatus =
  | "ready"
  | "missing"
  | "manual-confirmation"
  | "blocked-boundary";

export type CompanyResearchDecisionStatus =
  | "available-local"
  | "requires-owner-confirmation"
  | "blocked";

export interface CompanyResearchWorkbenchLane {
  id: CompanyResearchWorkbenchLaneId;
  title: string;
  description: string;
  route: string;
  action_count: number;
  high_priority_count: number;
  privacy_boundary: string;
}

export interface CompanyResearchWorkbenchAction {
  id: string;
  lane_id: CompanyResearchWorkbenchLaneId;
  title: string;
  priority: CompanyResearchWorkbenchPriority;
  status: CompanyResearchWorkbenchStatus;
  applies_to: CompanyCoverageAreaId[];
  evidence: string;
  next_action: string;
  action_route: string;
  route_label: string;
  requires_manual_confirmation: boolean;
  writes_workspace_data: false;
  privacy_boundary: string;
}

export interface CompanyResearchWorkbenchReviewStep {
  id: string;
  order: number;
  title: string;
  route: string;
  target_section_id: string;
  reason: string;
  completion_signal: string;
}

export interface CompanyResearchDecision {
  id:
    | "company-foundation"
    | "thesis-dossier"
    | "earnings-valuation"
    | "links-tracker-intake"
    | "cloud-ai-sync-boundary";
  title: string;
  status: CompanyResearchDecisionStatus;
  answer: string;
  evidence: string;
  next_action: string;
  route: string;
  target_section_id: string;
  allowed_now: boolean;
  requires_owner_confirmation: boolean;
  blocked_until_cloud_ai_gate: boolean;
  workbench_writes_workspace_data: false;
  reads_page_text: false;
  includes_page_text: false;
  includes_page_titles: false;
  includes_company_names: false;
  includes_database_row_values: false;
  reads_file_bytes: false;
  includes_holdings: false;
  includes_trading_plans: false;
  uploads_data: false;
  enables_ai: false;
}

export interface CompanyResearchDecisionSummary {
  current_state: "local-company-owner-review";
  current_conclusion: string;
  can_create_local_research_assets_now: true;
  can_review_coverage_now: true;
  can_review_dossier_now: true;
  can_write_tracker_rows_without_manual_click_now: false;
  can_auto_link_reports_meetings_now: false;
  can_send_company_research_to_ai_now: false;
  can_sync_company_research_now: false;
  safe_local_work: string[];
  blocked_work: string[];
  required_owner_decisions: string[];
  top_blockers: string[];
  decisions: CompanyResearchDecision[];
}

export interface CompanyResearchWorkbenchPacket {
  format: "zhinote-company-research-workbench-packet";
  format_version: 1;
  packet_status: "local-company-workbench-only";
  privacy_note: string;
  boundary: {
    local_packet_only: true;
    reads_company_coverage_report: true;
    reads_company_playbook: true;
    reads_company_dossier_plan: true;
    reads_tracker_intake_metadata: true;
    reads_page_text: false;
    includes_page_text: false;
    includes_page_titles: false;
    reads_database_rows: false;
    includes_database_row_values: false;
    reads_file_names: false;
    reads_file_bytes: false;
    includes_file_bytes: false;
    includes_holdings: false;
    includes_trading_plans: false;
    writes_workspace_data: false;
    creates_pages: false;
    creates_database_rows: false;
    updates_relation_values: false;
    connects_cloud_services: false;
    uploads_data: false;
    enables_ai: false;
  };
  summary: {
    coverage_areas: number;
    missing_areas: number;
    company_pages: number;
    tracker_databases: number;
    dossier_candidates: number;
    incomplete_dossiers: number;
    playbook_actions: number;
    tracker_intake_candidates: number;
    actions: number;
    high_priority_actions: number;
    manual_confirmation_actions: number;
  };
  decision_summary: CompanyResearchDecisionSummary;
  lanes: CompanyResearchWorkbenchLane[];
  actions: CompanyResearchWorkbenchAction[];
  review_sequence: CompanyResearchWorkbenchReviewStep[];
  forbidden_actions: string[];
  required_verification_commands: string[];
}

const LANE_META: Record<
  CompanyResearchWorkbenchLaneId,
  Omit<
    CompanyResearchWorkbenchLane,
    "action_count" | "high_priority_count"
  >
> = {
  "company-foundation": {
    id: "company-foundation",
    title: "公司中枢",
    description: "先确保每个重点公司都有长期主页和公司级档案入口。",
    route: "/modules/company-research",
    privacy_boundary:
      "只读取公司覆盖报告的结构状态，不导出公司名称、页面正文、持仓或交易计划。",
  },
  "thesis-workflow": {
    id: "thesis-workflow",
    title: "投资假设",
    description: "把公司主页连接到投资备忘录、风险收益和下一步研究动作。",
    route: "/modules/company-research",
    privacy_boundary:
      "只提示备忘录结构缺口，不读取或生成投资结论、仓位建议或交易计划。",
  },
  "earnings-valuation": {
    id: "earnings-valuation",
    title: "业绩和估值",
    description: "补齐业绩复盘、估值假设和关键指标入口。",
    route: "/modules/company-research",
    privacy_boundary:
      "只提示结构缺口，不导出目标价、模型数值、指标值或财务模型文件内容。",
  },
  "research-links": {
    id: "research-links",
    title: "报告和会议关联",
    description: "把报告库和会议模块挂回公司研究上下文。",
    route: "/modules/research-graph",
    privacy_boundary:
      "只使用关系结构状态，不读取报告正文、会议正文、转录稿、文件字节或数据库行值。",
  },
  "tracker-intake": {
    id: "tracker-intake",
    title: "公司跟踪表",
    description: "将公司页转成公司跟踪表候选行，但真实写入必须由用户点击。",
    route: "/modules/company-research",
    privacy_boundary:
      "工作台不创建数据库行；单条跟踪表行写入仍在公司入库台手动触发。",
  },
  "review-cadence": {
    id: "review-cadence",
    title: "复盘节奏",
    description: "设定覆盖频率、催化剂复盘、下次更新和手动复核节点。",
    route: "/modules/company-research",
    privacy_boundary:
      "只提示复盘流程，不推断持仓、交易计划、评级变化或未确认投资动作。",
  },
  "privacy-boundary": {
    id: "privacy-boundary",
    title: "隐私和外发边界",
    description: "任何 AI、云同步、批量行写入或关系自动补全都必须单独确认。",
    route: "/modules/sync",
    privacy_boundary:
      "公司研究工作台不会上传数据、调用 AI、连接云服务或自动写 relation。",
  },
};

const FORBIDDEN_ACTIONS = [
  "export_company_names_from_workbench",
  "export_page_titles_from_workbench",
  "export_page_body_text_from_company_workbench",
  "export_database_row_values_from_company_workbench",
  "infer_holdings_or_trading_plans",
  "auto_create_company_pages",
  "auto_create_tracker_rows",
  "auto_write_relation_values",
  "bulk_update_database_rows",
  "send_company_research_to_ai",
  "sync_company_research_to_cloud",
  "read_file_bytes_for_company_context",
];

export function buildCompanyResearchWorkbenchPacket(input: {
  coverage: CompanyCoverageReport;
  playbook: CompanyResearchPlaybook;
  dossier: CompanyResearchDossierPlan;
  trackerIntakeItems: CompanyTrackerIntakeItem[];
}): CompanyResearchWorkbenchPacket {
  const actions = buildActions(input);
  const lanes = buildLanes(actions);

  return {
    format: "zhinote-company-research-workbench-packet",
    format_version: 1,
    packet_status: "local-company-workbench-only",
    privacy_note:
      "由本地公司覆盖、行动手册、档案和入库台 metadata 生成。动作包只导出汇总路由和动作数量，不包含公司名、页面标题、页面正文、数据库行值、文件名、文件字节、持仓、交易计划、云端数据、AI prompt、token 或凭证；它不会创建页面、创建跟踪表行、更新 relation 值、上传数据、连接云服务或启用 AI。",
    boundary: {
      local_packet_only: true,
      reads_company_coverage_report: true,
      reads_company_playbook: true,
      reads_company_dossier_plan: true,
      reads_tracker_intake_metadata: true,
      reads_page_text: false,
      includes_page_text: false,
      includes_page_titles: false,
      reads_database_rows: false,
      includes_database_row_values: false,
      reads_file_names: false,
      reads_file_bytes: false,
      includes_file_bytes: false,
      includes_holdings: false,
      includes_trading_plans: false,
      writes_workspace_data: false,
      creates_pages: false,
      creates_database_rows: false,
      updates_relation_values: false,
      connects_cloud_services: false,
      uploads_data: false,
      enables_ai: false,
    },
    summary: {
      coverage_areas: input.coverage.summary.coverage_areas,
      missing_areas: input.coverage.summary.missing,
      company_pages: input.coverage.summary.company_pages,
      tracker_databases: input.coverage.summary.tracker_databases,
      dossier_candidates: input.dossier.summary.company_candidates,
      incomplete_dossiers: input.dossier.summary.incomplete_dossiers,
      playbook_actions: input.playbook.summary.action_queue_items,
      tracker_intake_candidates: input.trackerIntakeItems.length,
      actions: actions.length,
      high_priority_actions: actions.filter((action) => action.priority === "high")
        .length,
      manual_confirmation_actions: actions.filter(
        (action) => action.requires_manual_confirmation
      ).length,
    },
    decision_summary: buildDecisionSummary(input, actions),
    lanes,
    actions,
    review_sequence: buildReviewSequence(input),
    forbidden_actions: FORBIDDEN_ACTIONS,
    required_verification_commands: [
      "npm run verify:research-workflow",
      "npm run verify:modules",
      "npm run lint",
      "npm run build",
    ],
  };
}

function buildDecisionSummary(
  input: {
    coverage: CompanyCoverageReport;
    playbook: CompanyResearchPlaybook;
    dossier: CompanyResearchDossierPlan;
    trackerIntakeItems: CompanyTrackerIntakeItem[];
  },
  actions: CompanyResearchWorkbenchAction[]
): CompanyResearchDecisionSummary {
  const companyFoundationActions = actions.filter(
    (action) => action.lane_id === "company-foundation"
  );
  const thesisActions = actions.filter(
    (action) => action.lane_id === "thesis-workflow"
  );
  const earningsValuationActions = actions.filter(
    (action) => action.lane_id === "earnings-valuation"
  );
  const linkActions = actions.filter(
    (action) => action.lane_id === "research-links"
  );
  const trackerActions = actions.filter(
    (action) => action.lane_id === "tracker-intake"
  );
  const manualActions = actions.filter(
    (action) => action.requires_manual_confirmation
  );
  const topBlockers = [
    input.coverage.summary.company_pages === 0
      ? "还没有公司研究主页，公司级研究中枢尚未建立。"
      : null,
    input.coverage.summary.missing > 0
      ? `${input.coverage.summary.missing} 个公司研究覆盖面缺失。`
      : null,
    input.dossier.summary.incomplete_dossiers > 0
      ? `${input.dossier.summary.incomplete_dossiers} 个公司档案需要补齐。`
      : null,
    input.trackerIntakeItems.length > 0
      ? `${input.trackerIntakeItems.length} 个公司页等待逐条入库。`
      : null,
    "公司研究 AI、云同步、批量行写入和 relation 自动补全仍未启用。",
  ].filter(Boolean) as string[];

  return {
    current_state: "local-company-owner-review",
    current_conclusion:
      "可以继续在本地搭建公司主页、投资备忘录、业绩复盘、估值假设、关键指标、报告/会议关联和公司跟踪表；跟踪表行写入、relation 补全、AI 处理、云同步、批量更新以及任何持仓/交易计划推断仍然必须经过单独用户确认。",
    can_create_local_research_assets_now: true,
    can_review_coverage_now: true,
    can_review_dossier_now: true,
    can_write_tracker_rows_without_manual_click_now: false,
    can_auto_link_reports_meetings_now: false,
    can_send_company_research_to_ai_now: false,
    can_sync_company_research_now: false,
    safe_local_work: [
      "继续创建本地公司主页、投资备忘录、业绩复盘、估值假设、关键指标和公司跟踪表。",
      "继续复核覆盖雷达、行动手册、档案和入库台 metadata。",
      "继续从公司研究模块跳转到研究图谱，手动补报告和会议 relation。",
      "继续导出仅 metadata 的公司工作台，不包含公司名、页面标题、正文、数据库行值或文件字节。",
    ],
    blocked_work: [
      "不能从公司工作台导出公司名、页面标题、页面正文或数据库行值。",
      "不能批量创建跟踪表行、批量更新数据库、自动写 relation 值。",
      "不能推断持仓、仓位、评级变化、交易计划或未确认投资动作。",
      "不能把公司研究内容发送给 AI、云同步、外部 API 或远端数据库。",
    ],
    required_owner_decisions:
      manualActions.length > 0
        ? manualActions.slice(0, 5).map((action) => action.next_action)
        : [
            "确认哪些公司研究资产应作为正式覆盖范围。",
            "确认公司研究内容何时允许进入 AI payload、云同步、分享或备份恢复路径。",
          ],
    top_blockers: topBlockers,
    decisions: [
      {
        id: "company-foundation",
        title: "公司研究中枢",
        status:
          input.coverage.summary.company_pages > 0
            ? "available-local"
            : "requires-owner-confirmation",
        answer:
          input.coverage.summary.company_pages > 0
            ? "可以继续"
            : "先建公司主页",
        evidence: `${input.coverage.summary.company_pages} 个公司主页，${companyFoundationActions.length} 个中枢/档案行动。`,
        next_action:
          "先用公司研究页建立长期研究中枢，再把备忘录、报告、会议、指标和跟踪表挂回公司页。",
        route: "/modules/company-research",
        target_section_id: "company-create-assets",
        allowed_now: true,
        requires_owner_confirmation: input.coverage.summary.company_pages === 0,
        blocked_until_cloud_ai_gate: false,
        workbench_writes_workspace_data: false,
        reads_page_text: false,
        includes_page_text: false,
        includes_page_titles: false,
        includes_company_names: false,
        includes_database_row_values: false,
        reads_file_bytes: false,
        includes_holdings: false,
        includes_trading_plans: false,
        uploads_data: false,
        enables_ai: false,
      },
      {
        id: "thesis-dossier",
        title: "投资备忘录与档案",
        status:
          thesisActions.length > 0 || input.dossier.summary.incomplete_dossiers > 0
            ? "requires-owner-confirmation"
            : "available-local",
        answer:
          thesisActions.length > 0 || input.dossier.summary.incomplete_dossiers > 0
            ? "需要补齐"
            : "继续复核",
        evidence: `${input.coverage.summary.investment_memos} 个投资备忘录，${input.dossier.summary.incomplete_dossiers} 个待补档案。`,
        next_action:
          "按档案清单补投资假设、相关报告、相关会议和跟踪表结构；投资结论仍由用户填写。",
        route: "/modules/company-research",
        target_section_id: "company-dossier",
        allowed_now: true,
        requires_owner_confirmation:
          thesisActions.length > 0 || input.dossier.summary.incomplete_dossiers > 0,
        blocked_until_cloud_ai_gate: false,
        workbench_writes_workspace_data: false,
        reads_page_text: false,
        includes_page_text: false,
        includes_page_titles: false,
        includes_company_names: false,
        includes_database_row_values: false,
        reads_file_bytes: false,
        includes_holdings: false,
        includes_trading_plans: false,
        uploads_data: false,
        enables_ai: false,
      },
      {
        id: "earnings-valuation",
        title: "业绩、估值、指标",
        status:
          earningsValuationActions.length > 0
            ? "requires-owner-confirmation"
            : "available-local",
        answer:
          earningsValuationActions.length > 0 ? "需要补结构" : "继续保持",
        evidence: `${earningsValuationActions.length} 个业绩/估值/指标行动；工作台不导出目标价、模型数值或财务模型内容。`,
        next_action:
          "补齐业绩复盘、估值假设和关键指标入口，让公司研究可以从事实、模型影响和后续问题复盘。",
        route: "/modules/company-research",
        target_section_id: "company-playbook",
        allowed_now: true,
        requires_owner_confirmation: earningsValuationActions.length > 0,
        blocked_until_cloud_ai_gate: false,
        workbench_writes_workspace_data: false,
        reads_page_text: false,
        includes_page_text: false,
        includes_page_titles: false,
        includes_company_names: false,
        includes_database_row_values: false,
        reads_file_bytes: false,
        includes_holdings: false,
        includes_trading_plans: false,
        uploads_data: false,
        enables_ai: false,
      },
      {
        id: "links-tracker-intake",
        title: "关联与跟踪表入库",
        status:
          linkActions.length + trackerActions.length > 0
            ? "requires-owner-confirmation"
            : "available-local",
        answer:
          linkActions.length + trackerActions.length > 0
            ? "逐条确认"
            : "继续复核",
        evidence: `${linkActions.length} 个报告/会议关联行动，${input.trackerIntakeItems.length} 个入库候选。`,
        next_action:
          "通过研究图谱手动补报告/会议 relation；公司跟踪表行只能在入库台逐条点击创建。",
        route: "/modules/company-research",
        target_section_id: "company-tracker-intake",
        allowed_now: true,
        requires_owner_confirmation: linkActions.length + trackerActions.length > 0,
        blocked_until_cloud_ai_gate: false,
        workbench_writes_workspace_data: false,
        reads_page_text: false,
        includes_page_text: false,
        includes_page_titles: false,
        includes_company_names: false,
        includes_database_row_values: false,
        reads_file_bytes: false,
        includes_holdings: false,
        includes_trading_plans: false,
        uploads_data: false,
        enables_ai: false,
      },
      {
        id: "cloud-ai-sync-boundary",
        title: "AI、云同步与敏感边界",
        status: "blocked",
        answer: "保持关闭",
        evidence:
          "当前公司研究工作台不读取页面正文、不导出公司名、不上传、不调用 AI，也不推断持仓或交易计划。",
        next_action:
          "等 AI payload preview、账号权限、同步审计、回滚和敏感投资字段排除合同确认后，再决定是否启用外发。",
        route: "/modules/sync",
        target_section_id: "sync-architecture",
        allowed_now: false,
        requires_owner_confirmation: true,
        blocked_until_cloud_ai_gate: true,
        workbench_writes_workspace_data: false,
        reads_page_text: false,
        includes_page_text: false,
        includes_page_titles: false,
        includes_company_names: false,
        includes_database_row_values: false,
        reads_file_bytes: false,
        includes_holdings: false,
        includes_trading_plans: false,
        uploads_data: false,
        enables_ai: false,
      },
    ],
  };
}

function buildActions(input: {
  coverage: CompanyCoverageReport;
  playbook: CompanyResearchPlaybook;
  dossier: CompanyResearchDossierPlan;
  trackerIntakeItems: CompanyTrackerIntakeItem[];
}) {
  const missingAreas = new Set(
    input.coverage.areas
      .filter((area) => area.status === "missing")
      .map((area) => area.id)
  );
  const actions: CompanyResearchWorkbenchAction[] = [];

  if (missingAreas.has("company-home")) {
    actions.push(
      action({
        id: "company-workbench:create-company-home",
        lane_id: "company-foundation",
        title: "先建立公司研究主页",
        priority: "high",
        status: "missing",
        applies_to: ["company-home"],
        evidence: "当前没有公司研究主页结构。",
        next_action:
          "新建公司研究页，作为商业模式、行业结构、研究问题和关联资产的长期中枢。",
        action_route: "/modules/company-research",
        route_label: "打开公司研究",
        requires_manual_confirmation: true,
      })
    );
  }

  if (missingAreas.has("investment-memo")) {
    actions.push(
      action({
        id: "company-workbench:create-investment-memo",
        lane_id: "thesis-workflow",
        title: "补投资备忘录",
        priority: "high",
        status: "missing",
        applies_to: ["investment-memo"],
        evidence: "公司研究覆盖中缺少投资备忘录结构。",
        next_action:
          "创建投资备忘录，沉淀投资假设、风险收益、催化剂和下一步动作。",
        action_route: "/modules/company-research",
        route_label: "创建研究资产",
        requires_manual_confirmation: true,
      })
    );
  }

  const earningsValuationAreas = [
    "earnings-review",
    "valuation",
    "key-metrics",
  ] as const;
  const missingEarningsValuation = earningsValuationAreas.filter((area) =>
    missingAreas.has(area)
  );
  if (missingEarningsValuation.length > 0) {
    actions.push(
      action({
        id: "company-workbench:earnings-valuation-metrics",
        lane_id: "earnings-valuation",
        title: "补业绩、估值和关键指标结构",
        priority: "high",
        status: "missing",
        applies_to: missingEarningsValuation,
        evidence: `${missingEarningsValuation.length} 个业绩/估值/指标结构面缺失。`,
        next_action:
          "优先建立业绩复盘、估值假设和关键指标入口，让公司研究可复盘。",
        action_route: "/modules/company-research",
        route_label: "打开公司研究",
        requires_manual_confirmation: true,
      })
    );
  }

  const missingLinkAreas = [
    "related-reports",
    "related-meetings",
  ] as const;
  const missingLinks = missingLinkAreas.filter((area) => missingAreas.has(area));
  if (missingLinks.length > 0) {
    actions.push(
      action({
        id: "company-workbench:link-reports-meetings",
        lane_id: "research-links",
        title: "补报告和会议关联",
        priority: "medium",
        status: "manual-confirmation",
        applies_to: missingLinks,
        evidence: `${missingLinks.length} 个研究关联结构面缺失。`,
        next_action:
          "用研究图谱检查公司、报告、会议之间的 relation 缺口，再手动补齐。",
        action_route: "/modules/research-graph",
        route_label: "打开研究图谱",
        requires_manual_confirmation: true,
      })
    );
  }

  if (missingAreas.has("tracker-database")) {
    actions.push(
      action({
        id: "company-workbench:create-company-tracker",
        lane_id: "tracker-intake",
        title: "创建公司跟踪表",
        priority: "high",
        status: "missing",
        applies_to: ["tracker-database"],
        evidence: "当前公司研究缺少本地跟踪表。",
        next_action:
          "创建公司跟踪表后，再将公司页逐条纳入跟踪表行。",
        action_route: "/modules/company-research",
        route_label: "创建跟踪表",
        requires_manual_confirmation: true,
      })
    );
  }

  if (input.trackerIntakeItems.length > 0) {
    actions.push(
      action({
        id: "company-workbench:tracker-intake-review",
        lane_id: "tracker-intake",
        title: "复核公司入库候选",
        priority:
          input.coverage.summary.tracker_databases > 0 ? "medium" : "high",
        status:
          input.coverage.summary.tracker_databases > 0
            ? "manual-confirmation"
            : "blocked-boundary",
        applies_to: ["tracker-database"],
        evidence: `${input.trackerIntakeItems.length} 个公司页可进入公司入库台。`,
        next_action:
          input.coverage.summary.tracker_databases > 0
            ? "逐条确认公司页是否应创建跟踪表行；不要批量写入。"
            : "先创建公司跟踪表，再逐条处理入库候选。",
        action_route: "/modules/company-research",
        route_label: "查看入库台",
        requires_manual_confirmation: true,
      })
    );
  }

  if (input.dossier.summary.incomplete_dossiers > 0) {
    actions.push(
      action({
        id: "company-workbench:review-incomplete-dossiers",
        lane_id: "company-foundation",
        title: "复核待补齐档案",
        priority: "medium",
        status: "manual-confirmation",
        applies_to: [
          "investment-memo",
          "earnings-review",
          "valuation",
          "key-metrics",
          "related-reports",
          "related-meetings",
        ],
        evidence: `${input.dossier.summary.incomplete_dossiers} 个公司级档案仍不完整。`,
        next_action:
          "先按档案清单补结构，再进入 relation 和跟踪表清理。",
        action_route: "/modules/company-research",
        route_label: "查看档案",
        requires_manual_confirmation: false,
      })
    );
  }

  if (input.playbook.summary.manual_confirmation_steps > 0) {
    actions.push(
      action({
        id: "company-workbench:review-cadence",
        lane_id: "review-cadence",
        title: "设置复盘节奏",
        priority: "low",
        status: "manual-confirmation",
        applies_to: ["tracker-database"],
        evidence: `${input.playbook.summary.manual_confirmation_steps} 个步骤需要人工确认复盘节奏。`,
        next_action:
          "在跟踪表中维护覆盖状态、下次复盘、下一催化剂和手动复核节点。",
        action_route: "/modules/company-research",
        route_label: "查看行动手册",
        requires_manual_confirmation: true,
      })
    );
  }

  actions.push(
    action({
      id: "company-workbench:privacy-boundary",
      lane_id: "privacy-boundary",
      title: "公司研究外发前必须确认",
      priority: "high",
      status: "blocked-boundary",
      applies_to: [],
      evidence: "AI、云同步、批量写入和 relation 自动补全均未启用。",
      next_action:
        "任何公司研究进入 AI、云同步、外部分享或批量数据库写入前，都必须先做 payload preview 和用户确认。",
      action_route: "/modules/sync",
      route_label: "打开同步边界",
      requires_manual_confirmation: true,
    })
  );

  return actions.sort(sortActions);
}

function action(input: Omit<CompanyResearchWorkbenchAction, "writes_workspace_data" | "privacy_boundary">): CompanyResearchWorkbenchAction {
  return {
    ...input,
    writes_workspace_data: false,
    privacy_boundary:
      "工作台动作只处理 metadata，不包含公司名、页面标题、页面正文、数据库行值、文件名、文件字节、持仓、交易计划、云端数据、AI prompt、token 或凭证。",
  };
}

function buildLanes(actions: CompanyResearchWorkbenchAction[]) {
  return (Object.keys(LANE_META) as CompanyResearchWorkbenchLaneId[]).map((id) => {
    const laneActions = actions.filter((action) => action.lane_id === id);
    return {
      ...LANE_META[id],
      action_count: laneActions.length,
      high_priority_count: laneActions.filter(
        (action) => action.priority === "high"
      ).length,
    };
  });
}

function buildReviewSequence(input: {
  coverage: CompanyCoverageReport;
  playbook: CompanyResearchPlaybook;
  dossier: CompanyResearchDossierPlan;
  trackerIntakeItems: CompanyTrackerIntakeItem[];
}): CompanyResearchWorkbenchReviewStep[] {
  const steps: CompanyResearchWorkbenchReviewStep[] = [
    reviewStep(
      "company-foundation",
      1,
      "先建公司研究主页和档案",
      "/modules/company-research",
      "company-create-assets",
      "公司主页是所有备忘录、报告、会议、指标和跟踪表的研究中枢。",
      input.coverage.summary.company_pages > 0
        ? "已有公司研究主页。"
        : "至少创建一个公司研究主页。"
    ),
    reviewStep(
      "thesis-workflow",
      2,
      "再补投资备忘录",
      "/modules/company-research",
      "company-coverage-radar",
      "投资备忘录承载投资假设、风险收益、催化剂和决策上下文。",
      input.coverage.summary.investment_memos > 0
        ? "已有投资备忘录结构。"
        : "至少创建一个投资备忘录。"
    ),
    reviewStep(
      "earnings-valuation",
      3,
      "补业绩复盘、估值和关键指标",
      "/modules/company-research",
      "company-playbook",
      "业绩、估值和 KPI 是公司研究进入可复盘状态的核心。",
      input.playbook.summary.missing_steps === 0
        ? "行动手册无结构性缺口。"
        : "缺失结构已进入行动队列。"
    ),
    reviewStep(
      "research-links",
      4,
      "连接报告和会议",
      "/modules/research-graph",
      "company-research-connections",
      "公司研究需要和报告库、会议纪要互相关联，后续才能从公司维度复盘。",
      input.dossier.summary.missing_related_reports === 0 &&
      input.dossier.summary.missing_related_meetings === 0
        ? "报告和会议关联结构已覆盖。"
        : "报告或会议关联仍需手动补齐。"
    ),
    reviewStep(
      "tracker-intake",
      5,
      "最后逐条入公司跟踪表",
      "/modules/company-research",
      "company-tracker-intake",
      "跟踪表行是本地写入动作，必须逐条确认，不能由工作台批量写入。",
      input.trackerIntakeItems.length > 0
        ? `${input.trackerIntakeItems.length} 个候选等待公司入库台复核。`
        : "当前没有公司入库候选。"
    ),
    reviewStep(
      "privacy-boundary",
      6,
      "外发和自动化必须单独确认",
      "/modules/sync",
      "company-privacy-boundary",
      "AI、云同步、批量写入、自动 relation 都是高风险动作。",
      "当前动作包只做本地 metadata 排队。",
    ),
  ];

  return steps;
}

function reviewStep(
  id: string,
  order: number,
  title: string,
  route: string,
  targetSectionId: string,
  reason: string,
  completionSignal: string
): CompanyResearchWorkbenchReviewStep {
  return {
    id,
    order,
    title,
    route,
    target_section_id: targetSectionId,
    reason,
    completion_signal: completionSignal,
  };
}

function sortActions(
  left: CompanyResearchWorkbenchAction,
  right: CompanyResearchWorkbenchAction
) {
  const priorityRank: Record<CompanyResearchWorkbenchPriority, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };
  const laneRank: Record<CompanyResearchWorkbenchLaneId, number> = {
    "company-foundation": 0,
    "thesis-workflow": 1,
    "earnings-valuation": 2,
    "research-links": 3,
    "tracker-intake": 4,
    "review-cadence": 5,
    "privacy-boundary": 6,
  };

  if (priorityRank[left.priority] !== priorityRank[right.priority]) {
    return priorityRank[left.priority] - priorityRank[right.priority];
  }
  if (laneRank[left.lane_id] !== laneRank[right.lane_id]) {
    return laneRank[left.lane_id] - laneRank[right.lane_id];
  }
  return left.title.localeCompare(right.title, "zh-CN");
}
