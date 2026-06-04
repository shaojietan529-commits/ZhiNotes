import type {
  PortfolioReviewAreaId,
  PortfolioReviewReport,
} from "@/lib/portfolio/portfolioReview";
import type { PortfolioTrackerIntakeItem } from "@/lib/portfolio/portfolioTrackerIntake";

export type PortfolioWorkbenchLaneId =
  | "idea-intake"
  | "position-discipline"
  | "thesis-risk"
  | "catalyst-review"
  | "research-links"
  | "tracker-intake"
  | "privacy-boundary";

export type PortfolioWorkbenchPriority = "high" | "medium" | "low";

export type PortfolioWorkbenchStatus =
  | "ready"
  | "review-needed"
  | "missing"
  | "blocked-boundary";

export interface PortfolioWorkbenchLane {
  id: PortfolioWorkbenchLaneId;
  title: string;
  description: string;
  route: string;
  action_count: number;
  high_priority_count: number;
  privacy_boundary: string;
}

export interface PortfolioWorkbenchAction {
  id: string;
  lane_id: PortfolioWorkbenchLaneId;
  title: string;
  priority: PortfolioWorkbenchPriority;
  status: PortfolioWorkbenchStatus;
  applies_to: PortfolioReviewAreaId[];
  evidence: string;
  next_action: string;
  action_route: string;
  route_label: string;
  requires_manual_confirmation: boolean;
  writes_workspace_data: false;
  connects_brokerage_accounts: false;
  fetches_prices: false;
  privacy_boundary: string;
}

export interface PortfolioWorkbenchReviewStep {
  id: string;
  order: number;
  title: string;
  route: string;
  target_section_id: string;
  reason: string;
  completion_signal: string;
}

export interface PortfolioWorkbenchPacket {
  format: "zhinote-portfolio-workbench-packet";
  format_version: 1;
  packet_status: "local-portfolio-workbench-only";
  privacy_note: string;
  boundary: {
    local_packet_only: true;
    reads_portfolio_review_report: true;
    reads_tracker_intake_metadata: true;
    reads_page_text: false;
    includes_page_text: false;
    includes_page_titles: false;
    reads_database_rows: false;
    includes_database_row_values: false;
    includes_position_names: false;
    includes_tickers: false;
    includes_weights: false;
    includes_holdings: false;
    includes_trading_plans: false;
    includes_transactions: false;
    reads_file_bytes: false;
    connects_brokerage_accounts: false;
    fetches_prices: false;
    writes_workspace_data: false;
    creates_pages: false;
    creates_database_rows: false;
    updates_relation_values: false;
    connects_cloud_services: false;
    uploads_data: false;
    enables_ai: false;
  };
  summary: {
    review_areas: number;
    missing_areas: number;
    portfolio_memos: number;
    watchlist_pages: number;
    tracker_databases: number;
    items_needing_review: number;
    tracker_intake_candidates: number;
    actions: number;
    high_priority_actions: number;
    manual_confirmation_actions: number;
    blocked_actions: number;
  };
  lanes: PortfolioWorkbenchLane[];
  actions: PortfolioWorkbenchAction[];
  review_sequence: PortfolioWorkbenchReviewStep[];
  forbidden_actions: string[];
  required_verification_commands: string[];
}

const LANE_META: Record<
  PortfolioWorkbenchLaneId,
  Omit<PortfolioWorkbenchLane, "action_count" | "high_priority_count">
> = {
  "idea-intake": {
    id: "idea-intake",
    title: "想法和观察名单",
    description: "先建立观察名单或持仓 memo，避免投资想法散落在普通笔记里。",
    route: "/modules/portfolio",
    privacy_boundary:
      "只使用结构状态，不导出页面标题、公司名、ticker、持仓名或观察名单条目。",
  },
  "position-discipline": {
    id: "position-discipline",
    title: "仓位纪律",
    description: "补齐目标权重、当前权重、组合角色、确信度和复盘纪律。",
    route: "/modules/portfolio",
    privacy_boundary:
      "只提示仓位结构缺口，不导出权重数值、持仓、交易计划或账户数据。",
  },
  "thesis-risk": {
    id: "thesis-risk",
    title: "假设和风险",
    description: "沉淀投资假设、风险笔记、反向证据和证伪条件。",
    route: "/modules/portfolio",
    privacy_boundary:
      "只提示结构缺口，不导出投资观点正文、风险判断、交易计划或持仓细节。",
  },
  "catalyst-review": {
    id: "catalyst-review",
    title: "催化剂复盘",
    description: "把下一催化剂、检查点、复盘日期和降权/退出条件结构化。",
    route: "/modules/portfolio",
    privacy_boundary:
      "只提示催化剂结构，不导出事件细节、交易节奏、持仓或未确认操作。",
  },
  "research-links": {
    id: "research-links",
    title: "研究关联",
    description: "把组合条目连接回公司页、报告、会议和研究 memo。",
    route: "/modules/research-graph",
    privacy_boundary:
      "只提示 relation 缺口，不自动写 relation、不读取公司/报告/会议正文。",
  },
  "tracker-intake": {
    id: "tracker-intake",
    title: "组合跟踪表",
    description: "将持仓 memo 或观察名单逐条接入组合跟踪表。",
    route: "/modules/portfolio",
    privacy_boundary:
      "工作台不创建 database rows；组合入库台单条写入仍需用户手动触发。",
  },
  "privacy-boundary": {
    id: "privacy-boundary",
    title: "隐私和外部数据边界",
    description: "价格源、券商、云同步、AI 和批量写入必须单独确认。",
    route: "/modules/sync",
    privacy_boundary:
      "组合工作台不会连接券商、抓价格、同步持仓、上传数据、调用 AI 或批量写入。",
  },
};

const FORBIDDEN_ACTIONS = [
  "export_portfolio_page_titles_from_workbench",
  "export_position_names_from_workbench",
  "export_tickers_from_workbench",
  "export_weights_from_workbench",
  "export_holdings_from_workbench",
  "export_trading_plans_from_workbench",
  "export_transactions_from_workbench",
  "connect_brokerage_accounts",
  "fetch_live_prices",
  "auto_create_tracker_rows",
  "auto_write_relation_values",
  "bulk_update_database_rows",
  "send_portfolio_context_to_ai",
  "sync_portfolio_data_to_cloud",
];

export function buildPortfolioWorkbenchPacket(input: {
  review: PortfolioReviewReport;
  trackerIntakeItems: PortfolioTrackerIntakeItem[];
}): PortfolioWorkbenchPacket {
  const actions = buildActions(input.review, input.trackerIntakeItems);

  return {
    format: "zhinote-portfolio-workbench-packet",
    format_version: 1,
    packet_status: "local-portfolio-workbench-only",
    privacy_note:
      "Generated locally from portfolio review and tracker-intake metadata. It exports aggregated routing and redacted structure counts only. It does not include page text, page titles, position names, tickers, weights, holdings, trading plans, transactions, brokerage data, prices, file bytes, cloud data, AI prompts, tokens, or credentials; it does not create pages, create tracker rows, update relation values, connect brokerage accounts, fetch prices, upload data, connect cloud services, or enable AI.",
    boundary: {
      local_packet_only: true,
      reads_portfolio_review_report: true,
      reads_tracker_intake_metadata: true,
      reads_page_text: false,
      includes_page_text: false,
      includes_page_titles: false,
      reads_database_rows: false,
      includes_database_row_values: false,
      includes_position_names: false,
      includes_tickers: false,
      includes_weights: false,
      includes_holdings: false,
      includes_trading_plans: false,
      includes_transactions: false,
      reads_file_bytes: false,
      connects_brokerage_accounts: false,
      fetches_prices: false,
      writes_workspace_data: false,
      creates_pages: false,
      creates_database_rows: false,
      updates_relation_values: false,
      connects_cloud_services: false,
      uploads_data: false,
      enables_ai: false,
    },
    summary: {
      review_areas: input.review.summary.review_areas,
      missing_areas: input.review.summary.missing,
      portfolio_memos: input.review.summary.portfolio_memos,
      watchlist_pages: input.review.summary.watchlist_pages,
      tracker_databases: input.review.summary.tracker_databases,
      items_needing_review: input.review.summary.items_needing_review,
      tracker_intake_candidates: input.trackerIntakeItems.length,
      actions: actions.length,
      high_priority_actions: actions.filter((action) => action.priority === "high")
        .length,
      manual_confirmation_actions: actions.filter(
        (action) => action.requires_manual_confirmation
      ).length,
      blocked_actions: actions.filter((action) => action.status === "blocked-boundary")
        .length,
    },
    lanes: buildLanes(actions),
    actions,
    review_sequence: buildReviewSequence(input.review, input.trackerIntakeItems),
    forbidden_actions: FORBIDDEN_ACTIONS,
    required_verification_commands: [
      "npm run verify:research-workflow",
      "npm run verify:modules",
      "npm run lint",
      "npm run build",
    ],
  };
}

function buildActions(
  review: PortfolioReviewReport,
  trackerIntakeItems: PortfolioTrackerIntakeItem[]
) {
  const missingAreas = new Set(
    review.areas
      .filter((area) => area.status === "missing")
      .map((area) => area.id)
  );
  const actions: PortfolioWorkbenchAction[] = [];

  if (missingAreas.has("position-memo") && missingAreas.has("watchlist")) {
    actions.push(
      action({
        id: "portfolio-workbench:create-first-asset",
        lane_id: "idea-intake",
        title: "先建立观察名单或持仓 memo",
        priority: "high",
        status: "missing",
        applies_to: ["position-memo", "watchlist"],
        evidence: "当前缺少组合 memo 和观察名单结构。",
        next_action:
          "新建观察名单或持仓备忘录，把投资想法放进可复盘的本地页面。",
        action_route: "/modules/portfolio",
        route_label: "创建组合资产",
        requires_manual_confirmation: true,
      })
    );
  } else if (missingAreas.has("watchlist")) {
    actions.push(
      action({
        id: "portfolio-workbench:create-watchlist",
        lane_id: "idea-intake",
        title: "补观察名单入口",
        priority: "medium",
        status: "missing",
        applies_to: ["watchlist"],
        evidence: "当前缺少观察名单结构。",
        next_action:
          "建立观察名单，用于暂存还没有进入正式 memo 的公司想法。",
        action_route: "/modules/portfolio",
        route_label: "新建观察名单",
        requires_manual_confirmation: true,
      })
    );
  }

  const positionDisciplineAreas = [
    "sizing-discipline",
    "conviction",
  ] as const;
  const missingDiscipline = positionDisciplineAreas.filter((area) =>
    missingAreas.has(area)
  );
  if (missingDiscipline.length > 0) {
    actions.push(
      action({
        id: "portfolio-workbench:position-discipline",
        lane_id: "position-discipline",
        title: "补仓位纪律和确信度结构",
        priority: "high",
        status: "review-needed",
        applies_to: missingDiscipline,
        evidence: `${missingDiscipline.length} 个仓位纪律结构面缺失。`,
        next_action:
          "补目标权重、当前权重、组合角色、确信度和证伪条件的结构，不导出具体数值。",
        action_route: "/modules/portfolio",
        route_label: "查看组合模块",
        requires_manual_confirmation: true,
      })
    );
  }

  const thesisRiskAreas = ["thesis", "risk-notes"] as const;
  const missingThesisRisk = thesisRiskAreas.filter((area) =>
    missingAreas.has(area)
  );
  if (missingThesisRisk.length > 0) {
    actions.push(
      action({
        id: "portfolio-workbench:thesis-risk",
        lane_id: "thesis-risk",
        title: "补投资假设和风险笔记",
        priority: "high",
        status: "review-needed",
        applies_to: missingThesisRisk,
        evidence: `${missingThesisRisk.length} 个 thesis/risk 结构面缺失。`,
        next_action:
          "补核心假设、反向证据、下行情景、风险监控项和降权/退出触发条件。",
        action_route: "/modules/portfolio",
        route_label: "查看复盘雷达",
        requires_manual_confirmation: true,
      })
    );
  }

  if (missingAreas.has("catalyst")) {
    actions.push(
      action({
        id: "portfolio-workbench:catalyst-review",
        lane_id: "catalyst-review",
        title: "补催化剂复盘",
        priority: "medium",
        status: "review-needed",
        applies_to: ["catalyst"],
        evidence: "当前缺少催化剂或检查点结构。",
        next_action:
          "补下一催化剂、复盘日期、关键事件和降权/退出条件。",
        action_route: "/modules/portfolio",
        route_label: "新建催化剂复盘",
        requires_manual_confirmation: true,
      })
    );
  }

  if (missingAreas.has("research-links")) {
    actions.push(
      action({
        id: "portfolio-workbench:research-links",
        lane_id: "research-links",
        title: "补公司、报告和会议关联",
        priority: "medium",
        status: "review-needed",
        applies_to: ["research-links"],
        evidence: "当前缺少研究关联结构。",
        next_action:
          "用研究图谱把组合资产连接回公司页、报告、会议或 memo。",
        action_route: "/modules/research-graph",
        route_label: "打开研究图谱",
        requires_manual_confirmation: true,
      })
    );
  }

  if (missingAreas.has("tracker-database")) {
    actions.push(
      action({
        id: "portfolio-workbench:create-tracker",
        lane_id: "tracker-intake",
        title: "创建组合跟踪表",
        priority: "high",
        status: "missing",
        applies_to: ["tracker-database"],
        evidence: "当前缺少组合跟踪表。",
        next_action:
          "创建组合跟踪表后，再逐条把持仓 memo 或观察名单接入 tracker row。",
        action_route: "/modules/portfolio",
        route_label: "创建组合跟踪表",
        requires_manual_confirmation: true,
      })
    );
  }

  if (trackerIntakeItems.length > 0) {
    actions.push(
      action({
        id: "portfolio-workbench:tracker-intake-review",
        lane_id: "tracker-intake",
        title: "复核组合入库候选",
        priority: review.summary.tracker_databases > 0 ? "medium" : "high",
        status:
          review.summary.tracker_databases > 0
            ? "review-needed"
            : "blocked-boundary",
        applies_to: ["tracker-database"],
        evidence: `${trackerIntakeItems.length} 个脱敏组合资产可进入组合入库台。`,
        next_action:
          review.summary.tracker_databases > 0
            ? "逐条确认是否创建 tracker row；不要批量写入，不导出敏感资产名称。"
            : "先创建组合跟踪表，再逐条处理入库候选。",
        action_route: "/modules/portfolio",
        route_label: "查看入库台",
        requires_manual_confirmation: true,
      })
    );
  }

  if (review.summary.items_needing_review > 0) {
    actions.push(
      action({
        id: "portfolio-workbench:review-redacted-assets",
        lane_id: "idea-intake",
        title: "复核脱敏组合资产",
        priority: "medium",
        status: "review-needed",
        applies_to: [
          "sizing-discipline",
          "conviction",
          "catalyst",
          "risk-notes",
          "thesis",
          "research-links",
        ],
        evidence: `${review.summary.items_needing_review} 个脱敏组合资产仍有结构缺口。`,
        next_action:
          "按脱敏标签逐个打开来源页，补结构，不在导出包里暴露名称或 ticker。",
        action_route: "/modules/portfolio",
        route_label: "查看复盘雷达",
        requires_manual_confirmation: false,
      })
    );
  }

  actions.push(
    action({
      id: "portfolio-workbench:privacy-boundary",
      lane_id: "privacy-boundary",
      title: "组合外发和外部数据前必须确认",
      priority: "high",
      status: "blocked-boundary",
      applies_to: [],
      evidence: "价格源、券商连接、AI、云同步和批量写入均未启用。",
      next_action:
        "任何价格源、券商导入、AI、云同步、外部分享或批量数据库写入前，都必须先做 payload preview 和用户确认。",
      action_route: "/modules/sync",
      route_label: "打开同步边界",
      requires_manual_confirmation: true,
    })
  );

  return actions.sort(sortActions);
}

function action(
  input: Omit<
    PortfolioWorkbenchAction,
    | "writes_workspace_data"
    | "connects_brokerage_accounts"
    | "fetches_prices"
    | "privacy_boundary"
  >
): PortfolioWorkbenchAction {
  return {
    ...input,
    writes_workspace_data: false,
    connects_brokerage_accounts: false,
    fetches_prices: false,
    privacy_boundary:
      "Workbench action is metadata-only and does not include page text, page titles, position names, tickers, weights, holdings, trading plans, transactions, brokerage data, prices, cloud data, AI prompts, tokens, or credentials.",
  };
}

function buildLanes(actions: PortfolioWorkbenchAction[]) {
  return (Object.keys(LANE_META) as PortfolioWorkbenchLaneId[]).map((id) => {
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

function buildReviewSequence(
  review: PortfolioReviewReport,
  trackerIntakeItems: PortfolioTrackerIntakeItem[]
) {
  return [
    reviewStep(
      "idea-intake",
      1,
      "先建观察名单或持仓 memo",
      "/modules/portfolio",
      "portfolio-create-assets",
      "组合想法需要进入观察名单或持仓 memo，才有复盘和关联基础。",
      review.summary.portfolio_memos > 0 || review.summary.watchlist_pages > 0
        ? "已有组合资产页面。"
        : "至少创建一个观察名单或持仓 memo。"
    ),
    reviewStep(
      "position-discipline",
      2,
      "补仓位纪律",
      "/modules/portfolio",
      "portfolio-review-radar",
      "仓位纪律是组合复盘的核心，但工作台不能导出权重或持仓细节。",
      review.areas.find((area) => area.id === "sizing-discipline")?.status ===
        "ready"
        ? "仓位纪律结构已覆盖。"
        : "仓位纪律结构仍需补齐。"
    ),
    reviewStep(
      "thesis-risk",
      3,
      "补投资假设和风险",
      "/modules/portfolio",
      "portfolio-review-radar",
      "组合条目需要明确 thesis、风险、反证和证伪条件。",
      review.areas.find((area) => area.id === "thesis")?.status === "ready" &&
      review.areas.find((area) => area.id === "risk-notes")?.status === "ready"
        ? "投资假设和风险结构已覆盖。"
        : "投资假设或风险结构仍需补齐。"
    ),
    reviewStep(
      "catalyst-review",
      4,
      "补催化剂复盘",
      "/modules/portfolio",
      "portfolio-review-radar",
      "催化剂和检查点让组合结论可以定期复盘。",
      review.areas.find((area) => area.id === "catalyst")?.status === "ready"
        ? "催化剂结构已覆盖。"
        : "催化剂结构仍需补齐。"
    ),
    reviewStep(
      "research-links",
      5,
      "连接公司、报告和会议",
      "/modules/research-graph",
      "portfolio-research-connections",
      "组合条目要回到公司研究、报告和会议，才形成完整投研闭环。",
      review.areas.find((area) => area.id === "research-links")?.status ===
        "ready"
        ? "研究关联结构已覆盖。"
        : "研究关联仍需手动补齐。"
    ),
    reviewStep(
      "tracker-intake",
      6,
      "最后逐条入组合跟踪表",
      "/modules/portfolio",
      "portfolio-tracker-intake",
      "tracker row 是本地写入动作，必须逐条确认，不能由工作台批量写入。",
      trackerIntakeItems.length > 0
        ? `${trackerIntakeItems.length} 个脱敏候选等待组合入库台复核。`
        : "当前没有 tracker intake 候选。"
    ),
    reviewStep(
      "privacy-boundary",
      7,
      "外部数据和外发必须单独确认",
      "/modules/sync",
      "portfolio-privacy-boundary",
      "价格源、券商、AI、云同步和批量写入都是高风险动作。",
      "当前 packet 只做本地 metadata-only 排队。"
    ),
  ];
}

function reviewStep(
  id: string,
  order: number,
  title: string,
  route: string,
  targetSectionId: string,
  reason: string,
  completionSignal: string
): PortfolioWorkbenchReviewStep {
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
  left: PortfolioWorkbenchAction,
  right: PortfolioWorkbenchAction
) {
  const priorityRank: Record<PortfolioWorkbenchPriority, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };
  const laneRank: Record<PortfolioWorkbenchLaneId, number> = {
    "idea-intake": 0,
    "position-discipline": 1,
    "thesis-risk": 2,
    "catalyst-review": 3,
    "research-links": 4,
    "tracker-intake": 5,
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
