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

export type PortfolioDecisionSummaryStatus =
  | "available-local"
  | "requires-owner-confirmation"
  | "blocked";

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

export interface PortfolioDecisionSummaryItem {
  id:
    | "local-portfolio-asset-intake"
    | "position-discipline-thesis-risk"
    | "catalyst-research-link-review"
    | "tracker-row-intake"
    | "brokerage-price-ai-cloud-boundary";
  title: string;
  status: PortfolioDecisionSummaryStatus;
  answer: string;
  evidence: string;
  next_action: string;
  route: string;
  target_section_id: string;
  allowed_now: boolean;
  requires_owner_confirmation: boolean;
  blocks_portfolio_externalization: boolean;
  writes_workspace_data: false;
  connects_brokerage_accounts: false;
  fetches_prices: false;
  uploads_data: false;
  enables_ai: false;
}

export interface PortfolioWorkbenchDecisionSummary {
  current_state: "local-portfolio-owner-review";
  current_conclusion: string;
  can_create_local_portfolio_assets_now: true;
  can_review_position_discipline_now: true;
  can_review_research_links_now: true;
  can_write_tracker_rows_without_manual_click_now: false;
  can_connect_brokerage_accounts_now: false;
  can_fetch_live_prices_now: false;
  can_send_portfolio_context_to_ai_now: false;
  can_sync_portfolio_data_now: false;
  can_bulk_update_database_rows_now: false;
  safe_local_work: string[];
  blocked_work: string[];
  required_owner_decisions: string[];
  decisions: PortfolioDecisionSummaryItem[];
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
  decision_summary: PortfolioWorkbenchDecisionSummary;
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
    description: "先建立观察名单或持仓备忘录，避免投资想法散落在普通笔记里。",
    route: "/modules/portfolio",
    privacy_boundary:
      "只使用结构状态，不导出页面标题、公司名、股票代码、持仓名或观察名单条目。",
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
    description: "把组合条目连接回公司页、报告、会议和研究备忘录。",
    route: "/modules/research-graph",
    privacy_boundary:
      "只提示关系缺口，不自动写关系，不读取公司、报告或会议正文。",
  },
  "tracker-intake": {
    id: "tracker-intake",
    title: "组合跟踪表",
    description: "将持仓备忘录或观察名单逐条接入组合跟踪表。",
    route: "/modules/portfolio",
    privacy_boundary:
      "工作台不创建数据库行；组合入库台单条写入仍需用户手动触发。",
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
      "由本地组合复盘和入库台元数据生成。导出只包含汇总路由和脱敏结构数量，不包含页面正文、页面标题、持仓名、股票代码、权重、持仓、交易计划、交易记录、券商数据、价格、文件字节、云端数据、AI 提示词、token 或凭证；它不会创建页面、创建跟踪表行、更新关系值、连接券商、抓取价格、上传数据、连接云服务或启用 AI。",
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
    decision_summary: buildDecisionSummary(input.review, input.trackerIntakeItems, actions),
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

function buildDecisionSummary(
  review: PortfolioReviewReport,
  trackerIntakeItems: PortfolioTrackerIntakeItem[],
  actions: PortfolioWorkbenchAction[]
): PortfolioWorkbenchDecisionSummary {
  const disciplineGaps = countMissingAreas(review, [
    "sizing-discipline",
    "conviction",
  ]);
  const thesisRiskGaps = countMissingAreas(review, ["thesis", "risk-notes"]);
  const catalystLinkGaps = countMissingAreas(review, [
    "catalyst",
    "research-links",
  ]);
  const manualActions = actions.filter(
    (action) => action.requires_manual_confirmation
  );
  const blockedActions = actions.filter(
    (action) => action.status === "blocked-boundary"
  );
  const trackerReady = review.summary.tracker_databases > 0;
  const hasPortfolioAsset =
    review.summary.portfolio_memos > 0 || review.summary.watchlist_pages > 0;

  return {
    current_state: "local-portfolio-owner-review",
    current_conclusion:
      "组合模块可以继续本地创建持仓备忘录、观察名单、催化剂复盘和组合跟踪表，并复核仓位纪律、投资假设、风险、研究关联和入库候选；券商连接、实时价格、AI、云同步、批量行更新和任何持仓外发仍保持关闭，必须经过用户确认。",
    can_create_local_portfolio_assets_now: true,
    can_review_position_discipline_now: true,
    can_review_research_links_now: true,
    can_write_tracker_rows_without_manual_click_now: false,
    can_connect_brokerage_accounts_now: false,
    can_fetch_live_prices_now: false,
    can_send_portfolio_context_to_ai_now: false,
    can_sync_portfolio_data_now: false,
    can_bulk_update_database_rows_now: false,
    safe_local_work: [
      "新建持仓备忘录、观察名单、催化剂复盘和组合跟踪表，全部留在本地浏览器工作区。",
      "复核仓位纪律、确信度、投资假设、风险笔记和催化剂结构，但不导出具体权重或观点正文。",
      "用研究图谱查看组合与公司、报告、会议和备忘录的关系缺口，不自动写关系。",
      "用组合入库台逐条创建跟踪表行，继续使用脱敏标签和本地单条写入。",
    ],
    blocked_work: [
      "不能默认连接券商账户、读取账户 ID、余额、持仓、交易记录或订单。",
      "不能默认抓取实时价格、估值数据或外部行情源。",
      "不能把组合上下文、持仓名、股票代码、权重、交易计划或交易记录发送给 AI 或云端。",
      "不能批量创建跟踪表行、批量更新数据库、自动写关系或同步组合数据。",
    ],
    required_owner_decisions: [
      "确认组合跟踪表字段和关系后，再逐条创建跟踪表行。",
      "确认任何外部价格源、券商连接或账户导入前的权限范围、外发内容预览和审计事件。",
      "确认 AI 或云同步前是否允许包含组合上下文，以及哪些敏感字段必须排除。",
      "确认批量更新数据库前的目标行、字段、回滚边界和手动确认文本。",
    ],
    decisions: [
      {
        id: "local-portfolio-asset-intake",
        title: "组合资产入口",
        status: hasPortfolioAsset ? "available-local" : "requires-owner-confirmation",
        answer: hasPortfolioAsset ? "本地可做" : "先建资产",
        evidence: `${review.summary.portfolio_memos} 个持仓备忘录，${review.summary.watchlist_pages} 个观察名单页面；创建动作只写本地页面。`,
        next_action:
          "继续新建或补齐持仓备忘录、观察名单和催化剂复盘，把想法放进可复盘结构。",
        route: "/modules/portfolio",
        target_section_id: "portfolio-create-assets",
        allowed_now: true,
        requires_owner_confirmation: !hasPortfolioAsset,
        blocks_portfolio_externalization: false,
        writes_workspace_data: false,
        connects_brokerage_accounts: false,
        fetches_prices: false,
        uploads_data: false,
        enables_ai: false,
      },
      {
        id: "position-discipline-thesis-risk",
        title: "仓位纪律 / 投资假设 / 风险",
        status:
          disciplineGaps + thesisRiskGaps > 0
            ? "requires-owner-confirmation"
            : "available-local",
        answer: disciplineGaps + thesisRiskGaps > 0 ? "先复核" : "结构可用",
        evidence: `${disciplineGaps} 个仓位纪律缺口，${thesisRiskGaps} 个投资假设/风险缺口；摘要不包含权重、股票代码或观点正文。`,
        next_action:
          "逐个打开来源页补结构，确认是否需要进入 tracker 或公司研究，而不是批量导出敏感内容。",
        route: "/modules/portfolio",
        target_section_id: "portfolio-review-radar",
        allowed_now: true,
        requires_owner_confirmation: disciplineGaps + thesisRiskGaps > 0,
        blocks_portfolio_externalization: false,
        writes_workspace_data: false,
        connects_brokerage_accounts: false,
        fetches_prices: false,
        uploads_data: false,
        enables_ai: false,
      },
      {
        id: "catalyst-research-link-review",
        title: "催化剂与研究关联",
        status:
          catalystLinkGaps > 0
            ? "requires-owner-confirmation"
            : "available-local",
        answer: catalystLinkGaps > 0 ? "补关系" : "结构可用",
        evidence: `${catalystLinkGaps} 个催化剂或研究关联缺口；工作台只提示结构，不写关系值。`,
        next_action:
          "用研究图谱把组合资产连接回公司、报告、会议和备忘录，确认对象后再手动补关系。",
        route: "/modules/research-graph",
        target_section_id: "portfolio-research-connections",
        allowed_now: true,
        requires_owner_confirmation: catalystLinkGaps > 0,
        blocks_portfolio_externalization: false,
        writes_workspace_data: false,
        connects_brokerage_accounts: false,
        fetches_prices: false,
        uploads_data: false,
        enables_ai: false,
      },
      {
        id: "tracker-row-intake",
        title: "跟踪表单条入库",
        status: "requires-owner-confirmation",
        answer: trackerReady ? "单条确认后写" : "先建跟踪表",
        evidence: `${trackerIntakeItems.length} 个脱敏入库候选，${review.summary.tracker_databases} 个组合跟踪表；禁止自动或批量写行。`,
        next_action:
          "确认关联备忘录、状态、确信度、投资假设和风险笔记字段后，再逐条创建本地跟踪表行。",
        route: "/modules/portfolio",
        target_section_id: "portfolio-tracker-intake",
        allowed_now: false,
        requires_owner_confirmation: true,
        blocks_portfolio_externalization: false,
        writes_workspace_data: false,
        connects_brokerage_accounts: false,
        fetches_prices: false,
        uploads_data: false,
        enables_ai: false,
      },
      {
        id: "brokerage-price-ai-cloud-boundary",
        title: "券商 / 价格 / AI / 云边界",
        status: "blocked",
        answer: "保持关闭",
        evidence: `${blockedActions.length} 个边界动作阻塞，${manualActions.length} 个动作需要手动确认；组合敏感信息不外发。`,
        next_action:
          "任何券商、价格源、AI、云同步、分享或批量更新，都先做外发内容预览、权限检查、审计和手动确认文本。",
        route: "/modules/sync",
        target_section_id: "sync-ai-provider-boundary",
        allowed_now: false,
        requires_owner_confirmation: true,
        blocks_portfolio_externalization: true,
        writes_workspace_data: false,
        connects_brokerage_accounts: false,
        fetches_prices: false,
        uploads_data: false,
        enables_ai: false,
      },
    ],
  };
}

function countMissingAreas(
  review: PortfolioReviewReport,
  areaIds: PortfolioReviewAreaId[]
) {
  const missingAreas = new Set(
    review.areas
      .filter((area) => area.status === "missing")
      .map((area) => area.id)
  );
  return areaIds.filter((areaId) => missingAreas.has(areaId)).length;
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
        title: "先建立观察名单或持仓备忘录",
        priority: "high",
        status: "missing",
        applies_to: ["position-memo", "watchlist"],
        evidence: "当前缺少组合备忘录和观察名单结构。",
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
          "建立观察名单，用于暂存还没有进入正式备忘录的公司想法。",
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
        evidence: `${missingThesisRisk.length} 个投资假设/风险结构面缺失。`,
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
          "用研究图谱把组合资产连接回公司页、报告、会议或备忘录。",
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
          "创建组合跟踪表后，再逐条把持仓备忘录或观察名单接入跟踪表行。",
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
            ? "逐条确认是否创建跟踪表行；不要批量写入，不导出敏感资产名称。"
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
          "按脱敏标签逐个打开来源页，补结构，不在导出包里暴露名称或股票代码。",
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
        "任何价格源、券商导入、AI、云同步、外部分享或批量数据库写入前，都必须先做外发内容预览和用户确认。",
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
      "工作台动作只处理元数据，不包含页面正文、页面标题、持仓名、股票代码、权重、持仓、交易计划、交易记录、券商数据、价格、云端数据、AI 提示词、token 或凭证。",
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
      "先建观察名单或持仓备忘录",
      "/modules/portfolio",
      "portfolio-create-assets",
      "组合想法需要进入观察名单或持仓备忘录，才有复盘和关联基础。",
      review.summary.portfolio_memos > 0 || review.summary.watchlist_pages > 0
        ? "已有组合资产页面。"
        : "至少创建一个观察名单或持仓备忘录。"
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
      "组合条目需要明确投资假设、风险、反证和证伪条件。",
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
      "跟踪表行是本地写入动作，必须逐条确认，不能由工作台批量写入。",
      trackerIntakeItems.length > 0
        ? `${trackerIntakeItems.length} 个脱敏候选等待组合入库台复核。`
        : "当前没有组合入库候选。"
    ),
    reviewStep(
      "privacy-boundary",
      7,
      "外部数据和外发必须单独确认",
      "/modules/sync",
      "portfolio-privacy-boundary",
      "价格源、券商、AI、云同步和批量写入都是高风险动作。",
      "当前动作包只做本地 metadata 排队。"
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
