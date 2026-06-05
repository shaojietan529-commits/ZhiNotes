import type { ReportIntakeItem, ReportIntakeReport } from "@/lib/reports/reportIntake";
import type { Database } from "@/lib/utils/types";

export type ReportConnectionTargetKind =
  | "company"
  | "meeting"
  | "memo"
  | "portfolio";

export type ReportConnectionActionStatus =
  | "ready"
  | "manual-confirmation"
  | "blocked";

export interface ReportConnectionTrackerTarget {
  kind: ReportConnectionTargetKind | "report";
  database_id: string;
  database_title: string;
  module_route: string;
  database_route: string;
}

export interface ReportConnectionAction {
  id: string;
  target_kind: ReportConnectionTargetKind;
  target_label: string;
  status: ReportConnectionActionStatus;
  route: string;
  writes_workspace_data: false;
  reason: string;
}

export interface ReportConnectionSuggestion {
  id: string;
  report_page_id: string;
  report_page_title: string;
  file_name: string;
  file_kind: ReportIntakeItem["file_kind"];
  priority: ReportIntakeItem["priority"];
  stage: ReportIntakeItem["stage"];
  missing_targets: ReportConnectionTargetKind[];
  missing_target_labels: string[];
  tracker_targets: ReportConnectionTrackerTarget[];
  actions: ReportConnectionAction[];
  next_action: string;
  privacy_boundary: string;
}

export interface ReportConnectionPlan {
  format: "zhinote-report-connection-plan";
  format_version: 1;
  plan_status: "local-relation-plan-only";
  privacy_note: string;
  boundary: {
    local_plan_only: true;
    reads_report_intake_metadata: true;
    reads_database_metadata: true;
    reads_page_text: false;
    reads_database_rows: false;
    reads_database_row_values: false;
    reads_file_bytes: false;
    reads_file_text: false;
    writes_workspace_data: false;
    connects_cloud_services: false;
    uploads_data: false;
    enables_ai: false;
  };
  summary: {
    intake_items: number;
    suggestions: number;
    high_priority_suggestions: number;
    missing_company_links: number;
    missing_meeting_links: number;
    missing_memo_links: number;
    missing_portfolio_links: number;
    report_trackers: number;
    company_trackers: number;
    meeting_trackers: number;
    portfolio_trackers: number;
    ready_actions: number;
    confirmation_actions: number;
    blocked_actions: number;
  };
  tracker_targets: ReportConnectionTrackerTarget[];
  suggestions: ReportConnectionSuggestion[];
  required_fields: Array<{
    target_kind: ReportConnectionTargetKind | "report";
    field_names: string[];
    reason: string;
  }>;
}

const TARGET_LABELS: Record<ReportConnectionTargetKind, string> = {
  company: "公司",
  meeting: "会议",
  memo: "备忘录",
  portfolio: "组合",
};

export function buildReportConnectionPlan(input: {
  intake: ReportIntakeReport;
  databases: Database[];
}): ReportConnectionPlan {
  const trackerTargets = buildTrackerTargets(input.databases);
  const suggestions = input.intake.items
    .map((item) => buildSuggestion(item, trackerTargets))
    .filter((suggestion): suggestion is ReportConnectionSuggestion =>
      Boolean(suggestion)
    );
  const actions = suggestions.flatMap((suggestion) => suggestion.actions);

  return {
    format: "zhinote-report-connection-plan",
    format_version: 1,
    plan_status: "local-relation-plan-only",
    privacy_note:
      "由报告 intake 元数据和数据库元数据在本地生成。这个计划建议报告到公司、会议、备忘录和组合的关联工作；不读取报告正文、文件文本、文件字节、数据库行、prompt、token、凭证、云端数据或私有行值，也不写入工作区数据。",
    boundary: {
      local_plan_only: true,
      reads_report_intake_metadata: true,
      reads_database_metadata: true,
      reads_page_text: false,
      reads_database_rows: false,
      reads_database_row_values: false,
      reads_file_bytes: false,
      reads_file_text: false,
      writes_workspace_data: false,
      connects_cloud_services: false,
      uploads_data: false,
      enables_ai: false,
    },
    summary: {
      intake_items: input.intake.summary.intake_items,
      suggestions: suggestions.length,
      high_priority_suggestions: suggestions.filter(
        (suggestion) => suggestion.priority === "high"
      ).length,
      missing_company_links: countMissing(suggestions, "company"),
      missing_meeting_links: countMissing(suggestions, "meeting"),
      missing_memo_links: countMissing(suggestions, "memo"),
      missing_portfolio_links: countMissing(suggestions, "portfolio"),
      report_trackers: countTrackers(trackerTargets, "report"),
      company_trackers: countTrackers(trackerTargets, "company"),
      meeting_trackers: countTrackers(trackerTargets, "meeting"),
      portfolio_trackers: countTrackers(trackerTargets, "portfolio"),
      ready_actions: actions.filter((action) => action.status === "ready")
        .length,
      confirmation_actions: actions.filter(
        (action) => action.status === "manual-confirmation"
      ).length,
      blocked_actions: actions.filter((action) => action.status === "blocked")
        .length,
    },
    tracker_targets: trackerTargets,
    suggestions,
    required_fields: [
      {
        target_kind: "report",
        field_names: [
          "报告页",
          "公司页",
          "关联会议",
          "关联备忘录",
        ],
        reason:
          "报告跟踪表行应把来源报告页连接到公司、会议和备忘录上下文。",
      },
      {
        target_kind: "company",
        field_names: ["公司页", "关联报告", "关联会议"],
        reason:
          "公司跟踪表行应提供回连报告和会议的 relation 字段。",
      },
      {
        target_kind: "meeting",
        field_names: ["会议纪要", "关联报告", "公司页"],
        reason:
          "会议跟踪表行应把纪要、电话会与报告和公司页连接起来。",
      },
      {
        target_kind: "portfolio",
        field_names: ["公司页", "关联报告", "关联会议"],
        reason:
          "组合跟踪表行应把持仓复盘上下文连接到相关研究资产。",
      },
    ],
  };
}

function buildSuggestion(
  item: ReportIntakeItem,
  trackerTargets: ReportConnectionTrackerTarget[]
): ReportConnectionSuggestion | null {
  const missingTargets = normalizeRelationGaps(item.relation_gaps);
  if (missingTargets.length === 0) return null;

  const actions = missingTargets.map((target) =>
    buildAction(item, target, trackerTargets)
  );

  return {
    id: `report-connection:${item.id}`,
    report_page_id: item.page_id,
    report_page_title: item.page_title,
    file_name: item.file_name,
    file_kind: item.file_kind,
    priority: item.priority,
    stage: item.stage,
    missing_targets: missingTargets,
    missing_target_labels: missingTargets.map((target) => TARGET_LABELS[target]),
    tracker_targets: trackerTargets.filter((target) =>
      missingTargets.includes(target.kind as ReportConnectionTargetKind)
    ),
    actions,
    next_action:
      "并排打开报告页和目标跟踪表，在确认公司、会议、备忘录或组合上下文后手动补 relation。",
    privacy_boundary:
      "这个建议只使用 intake 元数据；不检查报告正文、文件文本、文件字节、数据库行、token、凭证、云端数据或 AI prompt。",
  };
}

function buildAction(
  item: ReportIntakeItem,
  target: ReportConnectionTargetKind,
  trackerTargets: ReportConnectionTrackerTarget[]
): ReportConnectionAction {
  const tracker = trackerTargets.find((candidate) => candidate.kind === target);
  const fallbackRoute = moduleRouteForTarget(target);

  return {
    id: `${item.id}:${target}`,
    target_kind: target,
    target_label: TARGET_LABELS[target],
    status: tracker ? "manual-confirmation" : "blocked",
    route: tracker?.database_route ?? fallbackRoute,
    writes_workspace_data: false,
    reason: tracker
      ? `打开 ${tracker.database_title}，确认正确的${TARGET_LABELS[target]} relation 后手动连接报告。`
      : `当前还没有可用的${TARGET_LABELS[target]}跟踪表。先创建或配置跟踪表，再关联这份报告。`,
  };
}

function buildTrackerTargets(
  databases: Database[]
): ReportConnectionTrackerTarget[] {
  return databases
    .map((database) => {
      const kind = classifyDatabase(database);
      if (!kind) return null;

      return {
        kind,
        database_id: database.id,
        database_title: database.title || "未命名数据库",
        module_route: moduleRouteForTarget(kind),
        database_route: `/database/${database.id}`,
      };
    })
    .filter((target): target is ReportConnectionTrackerTarget =>
      Boolean(target)
    );
}

function normalizeRelationGaps(
  relationGaps: string[]
): ReportConnectionTargetKind[] {
  const targets = new Set<ReportConnectionTargetKind>();
  const normalized = relationGaps.map((gap) => gap.toLowerCase());

  for (const gap of normalized) {
    if (gap.includes("公司") || gap.includes("company")) targets.add("company");
    if (gap.includes("会议") || gap.includes("meeting")) targets.add("meeting");
    if (gap.includes("memo") || gap.includes("备忘")) targets.add("memo");
    if (gap.includes("组合") || gap.includes("portfolio")) targets.add("portfolio");
  }

  if (targets.size === 0 && normalized.some((gap) => gap.includes("待确认"))) {
    targets.add("company");
    targets.add("meeting");
    targets.add("memo");
  }

  return [...targets];
}

function classifyDatabase(
  database: Pick<Database, "title" | "description">
): ReportConnectionTrackerTarget["kind"] | null {
  const text = `${database.title ?? ""} ${database.description ?? ""}`
    .toLowerCase()
    .replace(/[_-]+/g, " ");

  if (
    text.includes("report library") ||
    text.includes("report tracker") ||
    text.includes("报告库") ||
    text.includes("报告跟踪")
  ) {
    return "report";
  }
  if (
    text.includes("company research") ||
    text.includes("company tracker") ||
    text.includes("公司研究") ||
    text.includes("公司跟踪")
  ) {
    return "company";
  }
  if (
    text.includes("meeting") ||
    text.includes("call tracker") ||
    text.includes("会议") ||
    text.includes("电话会")
  ) {
    return "meeting";
  }
  if (
    text.includes("portfolio") ||
    text.includes("watchlist") ||
    text.includes("组合") ||
    text.includes("观察名单")
  ) {
    return "portfolio";
  }

  return null;
}

function moduleRouteForTarget(
  target: ReportConnectionTargetKind | "report"
): string {
  switch (target) {
    case "company":
      return "/modules/company-research";
    case "meeting":
      return "/modules/meetings";
    case "memo":
      return "/modules/company-research";
    case "portfolio":
      return "/modules/portfolio";
    case "report":
      return "/modules/reports";
  }
}

function countMissing(
  suggestions: ReportConnectionSuggestion[],
  target: ReportConnectionTargetKind
) {
  return suggestions.filter((suggestion) =>
    suggestion.missing_targets.includes(target)
  ).length;
}

function countTrackers(
  trackers: ReportConnectionTrackerTarget[],
  kind: ReportConnectionTrackerTarget["kind"]
) {
  return trackers.filter((tracker) => tracker.kind === kind).length;
}
