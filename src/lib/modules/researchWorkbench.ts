import type {
  ResearchAssetKind,
  ResearchGraphPriorityLevel,
  ResearchGraphReport,
} from "@/lib/modules/researchGraph";

export type ResearchWorkbenchActionStatus =
  | "ready-to-start"
  | "needs-relation"
  | "needs-schema"
  | "needs-tracker"
  | "review-only";

export type ResearchWorkbenchDecisionStatus =
  | "available-local"
  | "requires-owner-confirmation"
  | "blocked";

export type ResearchWorkbenchLaneId =
  | "company-context"
  | "report-linking"
  | "meeting-follow-up"
  | "portfolio-review"
  | "schema-setup";

export interface ResearchWorkbenchLane {
  id: ResearchWorkbenchLaneId;
  title: string;
  description: string;
  module_route: string;
  action_count: number;
  high_priority_count: number;
  privacy_boundary: string;
}

export interface ResearchWorkbenchModuleRollup {
  kind: ResearchAssetKind;
  label: string;
  module_route: string;
  health_status: ResearchGraphReport["health_summary"][number]["status"];
  connection_rate: number;
  assets: number;
  connected_assets: number;
  unlinked_assets: number;
  relation_links: number;
  schema_gaps: number;
  completion_actions: number;
  next_action_label: string;
  next_action_route: string;
  writes_workspace_data: false;
  privacy_boundary: string;
}

export interface ResearchWorkbenchAction {
  id: string;
  lane_id: ResearchWorkbenchLaneId;
  module_kind: ResearchAssetKind;
  module_label: string;
  priority: ResearchGraphPriorityLevel;
  status: ResearchWorkbenchActionStatus;
  title: string;
  evidence: string;
  next_action: string;
  action_route: string;
  route_label: string;
  source: string;
  requires_manual_confirmation: boolean;
  writes_workspace_data: false;
  privacy_boundary: string;
}

export interface ResearchWorkbenchReviewStep {
  id: string;
  order: number;
  title: string;
  route: string;
  reason: string;
  completion_signal: string;
}

export interface ResearchWorkbenchDecision {
  id:
    | "graph-coverage-review"
    | "manual-relation-handoff"
    | "schema-field-setup"
    | "module-follow-up-queue"
    | "cloud-ai-bulk-boundary";
  title: string;
  status: ResearchWorkbenchDecisionStatus;
  answer: string;
  evidence: string;
  next_action: string;
  route: string;
  target_section_id: string;
  allowed_now: boolean;
  requires_owner_confirmation: boolean;
  blocks_graph_externalization: boolean;
  writes_workspace_data: false;
  creates_relation_values: false;
  creates_schema_fields: false;
  uploads_data: false;
  enables_ai: false;
}

export interface ResearchWorkbenchDecisionSummary {
  current_state: "local-research-graph-owner-review";
  current_conclusion: string;
  can_review_graph_coverage_now: true;
  can_open_relation_handoffs_now: true;
  can_create_schema_fields_without_confirmation_now: false;
  can_auto_write_relation_values_now: false;
  can_bulk_update_database_rows_now: false;
  can_send_graph_context_to_ai_now: false;
  can_sync_graph_data_now: false;
  safe_local_work: string[];
  blocked_work: string[];
  required_owner_decisions: string[];
  decisions: ResearchWorkbenchDecision[];
}

export interface ResearchWorkbenchPacket {
  format: "zhinote-research-workbench-packet";
  format_version: 1;
  packet_status: "local-research-workbench-only";
  privacy_note: string;
  boundary: {
    local_packet_only: true;
    reads_research_graph_report: true;
    reads_page_text: false;
    includes_page_text: false;
    reads_database_rows: false;
    includes_database_row_values: false;
    reads_file_names: false;
    reads_file_bytes: false;
    includes_holdings: false;
    includes_trading_plans: false;
    writes_workspace_data: false;
    creates_relation_values: false;
    creates_schema_fields: false;
    connects_cloud_services: false;
    uploads_data: false;
    enables_ai: false;
  };
  summary: {
    modules: number;
    lanes: number;
    actions: number;
    high_priority: number;
    relation_actions: number;
    schema_actions: number;
    tracker_actions: number;
    review_only_actions: number;
    local_open_routes: number;
    manual_confirmation_actions: number;
    connected_assets: number;
    unlinked_assets: number;
    schema_gaps: number;
  };
  decision_summary: ResearchWorkbenchDecisionSummary;
  lanes: ResearchWorkbenchLane[];
  module_rollups: ResearchWorkbenchModuleRollup[];
  actions: ResearchWorkbenchAction[];
  review_sequence: ResearchWorkbenchReviewStep[];
  forbidden_actions: string[];
  required_verification_commands: string[];
}

const LANE_META: Record<
  ResearchWorkbenchLaneId,
  Omit<ResearchWorkbenchLane, "action_count" | "high_priority_count">
> = {
  "company-context": {
    id: "company-context",
    title: "公司研究中枢",
    description: "优先让公司主页、投资 memo、报告和会议关系闭环。",
    module_route: "/modules/company-research",
    privacy_boundary:
      "只打开本地公司研究模块和页面，不读取或导出公司页面正文、持仓或交易计划。",
  },
  "report-linking": {
    id: "report-linking",
    title: "报告归档与关联",
    description: "把 HTML、Markdown、PDF、Office 报告连回公司、会议和 memo。",
    module_route: "/modules/reports",
    privacy_boundary:
      "只使用报告 intake 和图谱 metadata，不读取报告正文、文件名或文件 bytes。",
  },
  "meeting-follow-up": {
    id: "meeting-follow-up",
    title: "会议复盘与跟踪",
    description: "把会议纪要、转录、行动项和公司/报告关系补齐。",
    module_route: "/modules/meetings",
    privacy_boundary:
      "只打开本地会议模块，不导出转录文本、参会人、录音、passcode 或会议正文。",
  },
  "portfolio-review": {
    id: "portfolio-review",
    title: "组合复盘连接",
    description: "让组合、观察名单、催化剂和研究资产互相引用。",
    module_route: "/modules/portfolio",
    privacy_boundary:
      "只整理连接缺口，不导出持仓细节、目标仓位、交易计划或客户信息。",
  },
  "schema-setup": {
    id: "schema-setup",
    title: "关系结构搭建",
    description: "检查跟踪表缺少哪些关系字段，先补结构再补值。",
    module_route: "/modules/research-graph",
    privacy_boundary:
      "只列出结构缺口和本地数据库入口；不会自动创建字段或写入行值。",
  },
};

const FORBIDDEN_ACTIONS = [
  "auto_write_relation_values",
  "bulk_update_database_rows",
  "delete_or_overwrite_research_assets",
  "upload_workspace_data",
  "enable_cloud_sync",
  "send_page_text_to_ai",
  "read_file_bytes_for_linking",
  "export_holdings_or_trading_plans",
  "connect_external_data_sources",
];

export function buildResearchWorkbenchPacket(
  report: ResearchGraphReport
): ResearchWorkbenchPacket {
  const moduleRollups = buildModuleRollups(report);
  const actions = buildWorkbenchActions(report).sort(sortActions);
  const lanes = buildLanes(actions);
  const reviewSequence = buildReviewSequence(moduleRollups, actions);

  return {
    format: "zhinote-research-workbench-packet",
    format_version: 1,
    packet_status: "local-research-workbench-only",
    privacy_note:
      "这份研究工作台行动包只在本地由研究图谱报告生成，把公司、报告、会议、组合和关系结构缺口转成工作队列。它不读取页面正文、数据库行、行值、文件名、文件字节、持仓、交易计划、云端数据、AI 提示词、token 或凭证；也不会写入关系值、创建结构字段、上传数据、连接云服务或启用 AI。",
    boundary: {
      local_packet_only: true,
      reads_research_graph_report: true,
      reads_page_text: false,
      includes_page_text: false,
      reads_database_rows: false,
      includes_database_row_values: false,
      reads_file_names: false,
      reads_file_bytes: false,
      includes_holdings: false,
      includes_trading_plans: false,
      writes_workspace_data: false,
      creates_relation_values: false,
      creates_schema_fields: false,
      connects_cloud_services: false,
      uploads_data: false,
      enables_ai: false,
    },
    summary: {
      modules: moduleRollups.length,
      lanes: lanes.length,
      actions: actions.length,
      high_priority: actions.filter((action) => action.priority === "high")
        .length,
      relation_actions: actions.filter(
        (action) => action.status === "needs-relation"
      ).length,
      schema_actions: actions.filter((action) => action.status === "needs-schema")
        .length,
      tracker_actions: actions.filter(
        (action) => action.status === "needs-tracker"
      ).length,
      review_only_actions: actions.filter(
        (action) => action.status === "review-only"
      ).length,
      local_open_routes: new Set(actions.map((action) => action.action_route))
        .size,
      manual_confirmation_actions: actions.filter(
        (action) => action.requires_manual_confirmation
      ).length,
      connected_assets: report.summary.connected_assets,
      unlinked_assets: report.summary.unlinked_assets,
      schema_gaps: report.summary.schema_gaps,
    },
    decision_summary: buildDecisionSummary(report, actions),
    lanes,
    module_rollups: moduleRollups,
    actions,
    review_sequence: reviewSequence,
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
  report: ResearchGraphReport,
  actions: ResearchWorkbenchAction[]
): ResearchWorkbenchDecisionSummary {
  const relationActions = actions.filter(
    (action) => action.status === "needs-relation"
  );
  const schemaActions = actions.filter(
    (action) => action.status === "needs-schema"
  );
  const trackerActions = actions.filter(
    (action) => action.status === "needs-tracker"
  );
  const manualActions = actions.filter(
    (action) => action.requires_manual_confirmation
  );

  return {
    current_state: "local-research-graph-owner-review",
    current_conclusion:
      "研究图谱现在可以继续本地查看跨模块连接覆盖、打开关系补全交接包、复核结构缺口，并跳转到公司/报告/会议/组合模块；自动写关系值、批量更新数据库、AI、云同步和外发图谱上下文仍保持关闭，必须经过你确认。",
    can_review_graph_coverage_now: true,
    can_open_relation_handoffs_now: true,
    can_create_schema_fields_without_confirmation_now: false,
    can_auto_write_relation_values_now: false,
    can_bulk_update_database_rows_now: false,
    can_send_graph_context_to_ai_now: false,
    can_sync_graph_data_now: false,
    safe_local_work: [
      "查看公司、报告、会议和组合的本地连接覆盖率、健康状态和断点队列。",
      "打开关系补全交接包，跳到对应页面或数据库，人工确认后再补关系。",
      "复核结构缺口，确认本地数据库是否需要新增关系字段。",
      "把断点分流回 Company、Reports、Meetings、Portfolio 和 Databases 模块继续处理。",
    ],
    blocked_work: [
      "不能自动写关系值、自动创建跟踪表行或批量更新数据库行。",
      "不能默认创建关系字段；结构字段创建必须有本地确认。",
      "不能读取页面正文、数据库行值、文件名或文件字节来做图谱导出。",
      "不能把图谱上下文、持仓、交易计划、文件或页面内容发送给 AI、云端或外部服务。",
    ],
    required_owner_decisions: [
      "确认某个结构缺口是否真的应该创建关系字段。",
      "确认关系补全交接包的来源页面、目标跟踪表、关系字段和行后再手动写值。",
      "确认批量关系修复前的目标资产、行、字段和回滚边界。",
      "确认 AI 或云同步前的载荷预览、权限检查、审计事件和敏感字段排除。",
    ],
    decisions: [
      {
        id: "graph-coverage-review",
        title: "图谱覆盖复核",
        status: "available-local",
        answer: "本地可看",
        evidence: `${report.summary.assets} 个资产，${report.summary.connected_assets} 个已连接，${report.summary.relation_links} 条关系连接。`,
        next_action:
          "先看连接健康摘要和模块覆盖，把断点最多的模块排到下一步。",
        route: "/modules/research-graph",
        target_section_id: "research-graph-health-summary",
        allowed_now: true,
        requires_owner_confirmation: false,
        blocks_graph_externalization: false,
        writes_workspace_data: false,
        creates_relation_values: false,
        creates_schema_fields: false,
        uploads_data: false,
        enables_ai: false,
      },
      {
        id: "manual-relation-handoff",
        title: "关系补全交接",
        status:
          relationActions.length > 0
            ? "requires-owner-confirmation"
            : "available-local",
        answer: relationActions.length > 0 ? "手动补值" : "暂无断点",
        evidence: `${relationActions.length} 个补关系行动，${report.summary.relation_handoff_packets} 个交接包；不会自动写关系值。`,
        next_action:
          "打开交接包，确认来源页面、目标跟踪表、关系字段和行后再手动写值。",
        route: "/modules/research-graph",
        target_section_id: "research-graph-relation-handoff",
        allowed_now: true,
        requires_owner_confirmation: relationActions.length > 0,
        blocks_graph_externalization: false,
        writes_workspace_data: false,
        creates_relation_values: false,
        creates_schema_fields: false,
        uploads_data: false,
        enables_ai: false,
      },
      {
        id: "schema-field-setup",
        title: "关系字段结构",
        status:
          schemaActions.length > 0
            ? "requires-owner-confirmation"
            : "available-local",
        answer: schemaActions.length > 0 ? "确认后创建" : "结构可用",
        evidence: `${schemaActions.length} 个结构行动，${report.summary.schema_gaps} 个关系字段缺口；创建字段必须本地确认。`,
        next_action:
          "先复核字段名称和目标数据库，再用结构缺口面板创建单个本地关系字段。",
        route: "/modules/research-graph",
        target_section_id: "research-graph-schema-gaps",
        allowed_now: false,
        requires_owner_confirmation: true,
        blocks_graph_externalization: false,
        writes_workspace_data: false,
        creates_relation_values: false,
        creates_schema_fields: false,
        uploads_data: false,
        enables_ai: false,
      },
      {
        id: "module-follow-up-queue",
        title: "跨模块行动队列",
        status:
          trackerActions.length + relationActions.length + schemaActions.length > 0
            ? "requires-owner-confirmation"
            : "available-local",
        answer:
          trackerActions.length + relationActions.length + schemaActions.length > 0
            ? "逐项处理"
            : "队列清爽",
        evidence: `${actions.length} 个工作台行动，${manualActions.length} 个需要手动确认，覆盖公司、报告、会议、组合和结构搭建。`,
        next_action:
          "按优先级打开对应模块，把断点回收到真实工作流，而不是在图谱里批量改数据。",
        route: "/modules/research-graph",
        target_section_id: "research-graph-workbench",
        allowed_now: true,
        requires_owner_confirmation: manualActions.length > 0,
        blocks_graph_externalization: false,
        writes_workspace_data: false,
        creates_relation_values: false,
        creates_schema_fields: false,
        uploads_data: false,
        enables_ai: false,
      },
      {
        id: "cloud-ai-bulk-boundary",
        title: "AI、云同步与批量写入边界",
        status: "blocked",
        answer: "保持关闭",
        evidence:
          "图谱工作台只做本地元数据路由；AI、云同步、外部服务和批量写入仍被禁止。",
        next_action:
          "只有在载荷预览、权限检查、审计事件、输入确认和回滚方案齐备后，才讨论自动化修复。",
        route: "/modules/sync",
        target_section_id: "sync-ai-provider-boundary",
        allowed_now: false,
        requires_owner_confirmation: true,
        blocks_graph_externalization: true,
        writes_workspace_data: false,
        creates_relation_values: false,
        creates_schema_fields: false,
        uploads_data: false,
        enables_ai: false,
      },
    ],
  };
}

function buildModuleRollups(
  report: ResearchGraphReport
): ResearchWorkbenchModuleRollup[] {
  return report.health_summary.map((item) => ({
    kind: item.kind,
    label: item.kind_label,
    module_route: item.module_route,
    health_status: item.status,
    connection_rate: item.connection_rate,
    assets: item.assets,
    connected_assets: item.connected_assets,
    unlinked_assets: item.unlinked_assets,
    relation_links: item.relation_links,
    schema_gaps: item.schema_gaps,
    completion_actions: item.completion_actions,
    next_action_label: item.next_action.label,
    next_action_route: item.next_action.route,
    writes_workspace_data: false,
    privacy_boundary:
      "模块汇总只使用图谱摘要元数据，不包含页面正文、数据库行值、文件字节、持仓、交易计划或云端数据。",
  }));
}

function buildWorkbenchActions(
  report: ResearchGraphReport
): ResearchWorkbenchAction[] {
  const priorityActions = report.priority_queue.map((item) => {
    const status = getStatusForPriorityAction(item.recommended_action);
    return {
      id: `workbench:${item.id}`,
      lane_id: getLaneForKind(item.asset_kind),
      module_kind: item.asset_kind,
      module_label: item.asset_kind_label,
      priority: item.priority,
      status,
      title: item.asset_title,
      evidence: item.reason,
      next_action: item.action_label,
      action_route: item.action_route,
      route_label:
        item.recommended_action === "open-page"
          ? "打开页面"
          : item.recommended_action === "complete-relation"
            ? "打开关系入口"
            : "打开模块",
      source: `priority-queue:${item.id}`,
      requires_manual_confirmation: status !== "review-only",
      writes_workspace_data: false,
      privacy_boundary: item.privacy_boundary,
    } satisfies ResearchWorkbenchAction;
  });

  const schemaActions = report.schema_gaps.map(
    (gap) =>
      ({
    id: `workbench:schema:${gap.id}`,
    lane_id: "schema-setup" as const,
    module_kind: gap.database_kind,
    module_label: gap.database_kind_label,
    priority: getSchemaGapPriority(gap.database_kind),
    status: "needs-schema" as const,
    title: `${gap.database_title} 缺少 ${gap.suggested_field_label}`,
    evidence: gap.reason,
    next_action:
      "打开数据库并手动确认是否应该创建这个关系字段。",
    action_route: gap.database_route,
    route_label: "打开数据库",
    source: `schema-gap:${gap.id}`,
    requires_manual_confirmation: true,
    writes_workspace_data: false,
    privacy_boundary:
      "结构行动只列出缺失的本地关系字段，不会创建字段、写入行、读取行值或上传数据。",
      }) satisfies ResearchWorkbenchAction
  );

  const trackerActions = report.health_summary
    .filter((item) => item.status === "needs-tracker")
    .map(
      (item) =>
        ({
          id: `workbench:tracker:${item.kind}`,
          lane_id: getLaneForKind(item.kind),
          module_kind: item.kind,
          module_label: item.kind_label,
          priority: "medium" as const,
          status: "needs-tracker" as const,
          title: `${item.kind_label} 缺少跟踪表`,
          evidence: `${item.kind_label}有 ${item.assets} 个资产和 ${item.tracker_databases} 个跟踪表。`,
          next_action: item.next_action.label,
          action_route: item.next_action.route,
          route_label: "打开模块",
          source: `health-summary:${item.kind}`,
          requires_manual_confirmation: true,
          writes_workspace_data: false,
          privacy_boundary:
            "跟踪表设置行动只打开本地模块入口，不会在缺少单独用户动作时创建数据库。",
        }) satisfies ResearchWorkbenchAction
    );

  return [...priorityActions, ...schemaActions, ...trackerActions];
}

function buildLanes(actions: ResearchWorkbenchAction[]): ResearchWorkbenchLane[] {
  return Object.values(LANE_META).map((lane) => {
    const laneActions = actions.filter((action) => action.lane_id === lane.id);
    return {
      ...lane,
      action_count: laneActions.length,
      high_priority_count: laneActions.filter(
        (action) => action.priority === "high"
      ).length,
    };
  });
}

function buildReviewSequence(
  moduleRollups: ResearchWorkbenchModuleRollup[],
  actions: ResearchWorkbenchAction[]
): ResearchWorkbenchReviewStep[] {
  const mostBlockedModule =
    [...moduleRollups].sort((a, b) => b.unlinked_assets - a.unlinked_assets)[0] ??
    null;
  const firstHighPriority =
    actions.find((action) => action.priority === "high") ?? actions[0] ?? null;

  return [
    {
      id: "review-company-context",
      order: 1,
      title: "先看公司中枢",
      route: "/modules/company-research",
      reason:
        "公司页面是投研资料的长期锚点，报告、会议和组合最好先能连回公司。",
      completion_signal: "公司资产已经具备报告和会议关系路径。",
    },
    {
      id: "resolve-high-priority-breaks",
      order: 2,
      title: "处理最高优先级断点",
      route: firstHighPriority?.action_route ?? "/modules/research-graph",
      reason: firstHighPriority
        ? `${firstHighPriority.module_label}: ${firstHighPriority.title}`
        : "当前没有高优先级图谱行动。",
      completion_signal: "高优先级未连接资产已经完成复核或路由。",
    },
    {
      id: "repair-most-blocked-module",
      order: 3,
      title: "修复断点最多的模块",
      route: mostBlockedModule?.module_route ?? "/modules/research-graph",
      reason: mostBlockedModule
        ? `${mostBlockedModule.label} 有 ${mostBlockedModule.unlinked_assets} 个未连接资产。`
        : "当前没有模块汇总。",
      completion_signal: "模块连接率提升，或缺失的跟踪表/结构配置已经确认。",
    },
    {
      id: "review-schema-before-values",
      order: 4,
      title: "先补关系结构，再补关系值",
      route: "/modules/research-graph",
      reason:
        "缺失关系字段会阻塞报告到公司、报告到会议、组合到研究材料的清晰连接。",
      completion_signal: "任何手动行连接开始前，结构缺口已经完成复核。",
    },
  ];
}

function getStatusForPriorityAction(
  action: ResearchGraphReport["priority_queue"][number]["recommended_action"]
): ResearchWorkbenchActionStatus {
  if (action === "complete-relation") return "needs-relation";
  if (action === "create-target") return "needs-tracker";
  return "review-only";
}

function getLaneForKind(kind: ResearchAssetKind): ResearchWorkbenchLaneId {
  if (kind === "company") return "company-context";
  if (kind === "report") return "report-linking";
  if (kind === "meeting") return "meeting-follow-up";
  return "portfolio-review";
}

function getSchemaGapPriority(
  kind: ResearchAssetKind
): ResearchGraphPriorityLevel {
  if (kind === "company" || kind === "report") return "high";
  if (kind === "meeting") return "medium";
  return "low";
}

function sortActions(a: ResearchWorkbenchAction, b: ResearchWorkbenchAction) {
  const priorityDelta = priorityRank(a.priority) - priorityRank(b.priority);
  if (priorityDelta !== 0) return priorityDelta;

  const statusDelta = statusRank(a.status) - statusRank(b.status);
  if (statusDelta !== 0) return statusDelta;

  return a.title.localeCompare(b.title);
}

function priorityRank(priority: ResearchGraphPriorityLevel) {
  if (priority === "high") return 0;
  if (priority === "medium") return 1;
  return 2;
}

function statusRank(status: ResearchWorkbenchActionStatus) {
  if (status === "needs-relation") return 0;
  if (status === "needs-schema") return 1;
  if (status === "needs-tracker") return 2;
  if (status === "ready-to-start") return 3;
  return 4;
}
