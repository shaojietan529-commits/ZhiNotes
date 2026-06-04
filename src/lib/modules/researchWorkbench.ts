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
    title: "Relation 结构搭建",
    description: "检查跟踪表缺少哪些 relation 字段，先补结构再补值。",
    module_route: "/modules/research-graph",
    privacy_boundary:
      "只列出 schema gap 和本地数据库入口；不会自动创建字段或写入行值。",
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
      "Generated locally from the research graph report. This packet turns company, report, meeting, portfolio, and relation-schema gaps into a local workbench queue. It does not read page bodies, database rows, row values, file names, file bytes, holdings, trading plans, cloud data, AI prompts, tokens, or credentials; it does not write relation values, create schema fields, upload data, connect cloud services, or enable AI.",
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
      "Module rollup uses graph summary metadata only. It does not include page bodies, database row values, file bytes, holdings, trading plans, or cloud data.",
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
            ? "打开 relation 入口"
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
      "Open the database and manually confirm whether this relation field should be created.",
    action_route: gap.database_route,
    route_label: "打开数据库",
    source: `schema-gap:${gap.id}`,
    requires_manual_confirmation: true,
    writes_workspace_data: false,
    privacy_boundary:
      "Schema actions list missing local relation fields only. They do not create fields, write rows, read row values, or upload data.",
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
          evidence: `${item.kind_label} has ${item.assets} assets and ${item.tracker_databases} tracker databases.`,
          next_action: item.next_action.label,
          action_route: item.next_action.route,
          route_label: "打开模块",
          source: `health-summary:${item.kind}`,
          requires_manual_confirmation: true,
          writes_workspace_data: false,
          privacy_boundary:
            "Tracker setup actions open local module routes only and do not create databases without a separate user action.",
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
      completion_signal: "Company assets have report and meeting relation paths.",
    },
    {
      id: "resolve-high-priority-breaks",
      order: 2,
      title: "处理最高优先级断点",
      route: firstHighPriority?.action_route ?? "/modules/research-graph",
      reason: firstHighPriority
        ? `${firstHighPriority.module_label}: ${firstHighPriority.title}`
        : "No high-priority graph action is currently available.",
      completion_signal: "High-priority unlinked assets are reviewed or routed.",
    },
    {
      id: "repair-most-blocked-module",
      order: 3,
      title: "修复断点最多的模块",
      route: mostBlockedModule?.module_route ?? "/modules/research-graph",
      reason: mostBlockedModule
        ? `${mostBlockedModule.label} has ${mostBlockedModule.unlinked_assets} unlinked assets.`
        : "No module rollup is available.",
      completion_signal: "The module connection rate improves or missing tracker/schema setup is confirmed.",
    },
    {
      id: "review-schema-before-values",
      order: 4,
      title: "先补 relation 结构，再补 relation 值",
      route: "/modules/research-graph",
      reason:
        "Missing relation fields block clean report-to-company, report-to-meeting, and portfolio-to-research linking.",
      completion_signal: "Schema gaps are reviewed before any manual row linking starts.",
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
