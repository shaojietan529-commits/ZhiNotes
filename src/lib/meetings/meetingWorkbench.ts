import type { MeetingDecisionLedgerReport } from "@/lib/meetings/meetingDecisionLedger";
import type { MeetingFollowUpReport } from "@/lib/meetings/meetingFollowUp";
import type { MeetingResearchPlaybook } from "@/lib/meetings/meetingResearchPlaybook";
import type { MeetingResearchQueueReport } from "@/lib/meetings/meetingResearchQueue";
import type { MeetingTrackerFollowUpItem } from "@/lib/meetings/meetingTrackerIntake";

export type MeetingWorkbenchLaneId =
  | "meeting-capture"
  | "transcript-review"
  | "decision-ledger"
  | "research-queue"
  | "tracker-intake"
  | "relation-linking"
  | "privacy-boundary";

export type MeetingWorkbenchPriority = "high" | "medium" | "low";

export type MeetingWorkbenchStatus =
  | "ready"
  | "review-needed"
  | "missing"
  | "blocked-boundary";

export interface MeetingWorkbenchLane {
  id: MeetingWorkbenchLaneId;
  title: string;
  description: string;
  route: string;
  action_count: number;
  high_priority_count: number;
  privacy_boundary: string;
}

export interface MeetingWorkbenchAction {
  id: string;
  lane_id: MeetingWorkbenchLaneId;
  title: string;
  priority: MeetingWorkbenchPriority;
  status: MeetingWorkbenchStatus;
  evidence: string;
  next_action: string;
  action_route: string;
  route_label: string;
  requires_manual_confirmation: boolean;
  writes_workspace_data: false;
  joins_calls: false;
  records_audio: false;
  publishes_notes: false;
  privacy_boundary: string;
}

export interface MeetingWorkbenchReviewStep {
  id: string;
  order: number;
  title: string;
  route: string;
  reason: string;
  completion_signal: string;
}

export interface MeetingWorkbenchPacket {
  format: "zhinote-meeting-workbench-packet";
  format_version: 1;
  packet_status: "local-meeting-workbench-only";
  privacy_note: string;
  boundary: {
    local_packet_only: true;
    reads_meeting_follow_up_report: true;
    reads_meeting_decision_ledger: true;
    reads_meeting_research_queue: true;
    reads_meeting_playbook: true;
    reads_tracker_intake_metadata: true;
    reads_page_text: false;
    includes_page_text: false;
    includes_page_titles: false;
    reads_transcript_text: false;
    includes_transcript_text: false;
    reads_recording_bytes: false;
    includes_recording_bytes: false;
    includes_participant_details: false;
    includes_meeting_passcodes: false;
    reads_database_rows: false;
    includes_database_row_values: false;
    includes_holdings_or_trading_plans: false;
    writes_workspace_data: false;
    creates_pages: false;
    creates_database_rows: false;
    updates_relation_values: false;
    joins_calls: false;
    records_audio: false;
    publishes_notes: false;
    connects_cloud_services: false;
    uploads_data: false;
    enables_ai: false;
  };
  summary: {
    meeting_pages: number;
    transcript_pages: number;
    action_item_pages: number;
    tracker_databases: number;
    follow_up_items: number;
    decision_ledger_items: number;
    research_queue_items: number;
    playbook_actions: number;
    tracker_intake_candidates: number;
    actions: number;
    high_priority_actions: number;
    manual_confirmation_actions: number;
    blocked_actions: number;
  };
  lanes: MeetingWorkbenchLane[];
  actions: MeetingWorkbenchAction[];
  review_sequence: MeetingWorkbenchReviewStep[];
  forbidden_actions: string[];
  required_verification_commands: string[];
}

const LANE_META: Record<
  MeetingWorkbenchLaneId,
  Omit<MeetingWorkbenchLane, "action_count" | "high_priority_count">
> = {
  "meeting-capture": {
    id: "meeting-capture",
    title: "会议记录",
    description: "先建立会议纪要、会前背景和基础研究问题。",
    route: "/modules/meetings",
    privacy_boundary:
      "只使用结构状态，不导出会议标题、会议正文、参会人详情或 meeting passcodes。",
  },
  "transcript-review": {
    id: "transcript-review",
    title: "转录复盘",
    description: "把 transcript 页面或录音索引补齐，并保留人工复核门槛。",
    route: "/modules/meetings",
    privacy_boundary:
      "只提示 transcript 结构缺口，不读取 transcript text 或 recording bytes。",
  },
  "decision-ledger": {
    id: "decision-ledger",
    title: "投研闭环",
    description: "沉淀会议结论、thesis 影响、模型影响、风险、催化剂和开放问题。",
    route: "/modules/meetings",
    privacy_boundary:
      "只读取 decision ledger 结构状态，不导出会议正文、持仓或交易计划。",
  },
  "research-queue": {
    id: "research-queue",
    title: "研究任务队列",
    description: "将会议结构缺口转成 transcript、模型、风险、开放问题和 relation 任务。",
    route: "/modules/meetings",
    privacy_boundary:
      "任务队列只包含结构缺口，不导出页面正文、transcript、row values 或文件 bytes。",
  },
  "tracker-intake": {
    id: "tracker-intake",
    title: "会议跟踪表",
    description: "将会议页逐条接入会议跟踪表；真实写入必须由用户点击。",
    route: "/modules/meetings",
    privacy_boundary:
      "工作台不创建 database rows；会议入库台单条写入仍需用户手动触发。",
  },
  "relation-linking": {
    id: "relation-linking",
    title: "公司和报告关联",
    description: "把会议连接到公司页、报告、memo 或业绩复盘。",
    route: "/modules/research-graph",
    privacy_boundary:
      "只提示 relation 缺口，不自动写 relation、不读取公司正文或报告正文。",
  },
  "privacy-boundary": {
    id: "privacy-boundary",
    title: "隐私和自动化边界",
    description: "会议入会、录音、发布、AI、云同步和批量写入必须单独确认。",
    route: "/modules/sync",
    privacy_boundary:
      "会议工作台不会加入会议、录音、发布纪要、上传数据、调用 AI 或连接云服务。",
  },
};

const FORBIDDEN_ACTIONS = [
  "join_calls_from_meeting_workbench",
  "record_audio_from_meeting_workbench",
  "publish_notes_from_meeting_workbench",
  "export_meeting_titles_from_workbench",
  "export_page_body_text_from_meeting_workbench",
  "export_transcript_text_from_meeting_workbench",
  "export_recording_bytes_from_meeting_workbench",
  "export_participant_details_from_meeting_workbench",
  "export_meeting_passcodes_from_workbench",
  "auto_create_tracker_rows",
  "auto_write_relation_values",
  "bulk_update_database_rows",
  "send_meeting_context_to_ai",
  "sync_meeting_data_to_cloud",
];

export function buildMeetingWorkbenchPacket(input: {
  followUp: MeetingFollowUpReport;
  decisionLedger: MeetingDecisionLedgerReport;
  researchQueue: MeetingResearchQueueReport;
  playbook: MeetingResearchPlaybook;
  trackerIntakeItems: MeetingTrackerFollowUpItem[];
}): MeetingWorkbenchPacket {
  const actions = buildActions(input);

  return {
    format: "zhinote-meeting-workbench-packet",
    format_version: 1,
    packet_status: "local-meeting-workbench-only",
    privacy_note:
      "Generated locally from meeting follow-up, decision ledger, research queue, playbook, and tracker-intake metadata. It exports aggregated action routing only. It does not include meeting titles, page text, transcript text, recording bytes, participant details, meeting passcodes, database row values, holdings, trading plans, cloud data, AI prompts, tokens, or credentials; it does not join calls, record audio, publish notes, create tracker rows, write relation values, upload data, connect cloud services, or enable AI.",
    boundary: {
      local_packet_only: true,
      reads_meeting_follow_up_report: true,
      reads_meeting_decision_ledger: true,
      reads_meeting_research_queue: true,
      reads_meeting_playbook: true,
      reads_tracker_intake_metadata: true,
      reads_page_text: false,
      includes_page_text: false,
      includes_page_titles: false,
      reads_transcript_text: false,
      includes_transcript_text: false,
      reads_recording_bytes: false,
      includes_recording_bytes: false,
      includes_participant_details: false,
      includes_meeting_passcodes: false,
      reads_database_rows: false,
      includes_database_row_values: false,
      includes_holdings_or_trading_plans: false,
      writes_workspace_data: false,
      creates_pages: false,
      creates_database_rows: false,
      updates_relation_values: false,
      joins_calls: false,
      records_audio: false,
      publishes_notes: false,
      connects_cloud_services: false,
      uploads_data: false,
      enables_ai: false,
    },
    summary: {
      meeting_pages: input.followUp.summary.meeting_pages,
      transcript_pages: input.followUp.summary.transcript_pages,
      action_item_pages: input.followUp.summary.action_item_pages,
      tracker_databases: input.followUp.summary.tracker_databases,
      follow_up_items: input.followUp.summary.follow_up_items,
      decision_ledger_items: input.decisionLedger.summary.ledger_items,
      research_queue_items: input.researchQueue.summary.queue_items,
      playbook_actions: input.playbook.summary.action_queue_items,
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

function buildActions(input: {
  followUp: MeetingFollowUpReport;
  decisionLedger: MeetingDecisionLedgerReport;
  researchQueue: MeetingResearchQueueReport;
  playbook: MeetingResearchPlaybook;
  trackerIntakeItems: MeetingTrackerFollowUpItem[];
}) {
  const actions: MeetingWorkbenchAction[] = [];

  if (input.followUp.summary.meeting_pages === 0) {
    actions.push(
      action({
        id: "meeting-workbench:create-first-meeting-note",
        lane_id: "meeting-capture",
        title: "先创建会议纪要",
        priority: "high",
        status: "missing",
        evidence: "当前没有会议纪要页面。",
        next_action:
          "创建会议纪要，记录平台、公司、议程、核心问题和后续研究上下文。",
        action_route: "/modules/meetings",
        route_label: "创建会议资产",
        requires_manual_confirmation: true,
      })
    );
  }

  if (input.followUp.summary.missing_transcripts > 0) {
    actions.push(
      action({
        id: "meeting-workbench:transcript-review",
        lane_id: "transcript-review",
        title: "补转录稿或录音索引",
        priority: "medium",
        status: "review-needed",
        evidence: `${input.followUp.summary.missing_transcripts} 个会议页缺少 transcript 结构。`,
        next_action:
          "连接 transcript page 或录音索引，再人工复核关键表述、开放问题和可信度。",
        action_route: "/modules/meetings",
        route_label: "查看会议模块",
        requires_manual_confirmation: true,
      })
    );
  }

  if (input.followUp.summary.missing_action_items > 0) {
    actions.push(
      action({
        id: "meeting-workbench:action-items",
        lane_id: "research-queue",
        title: "提取会议行动项",
        priority: "high",
        status: "review-needed",
        evidence: `${input.followUp.summary.missing_action_items} 个会议页缺少行动项结构。`,
        next_action:
          "把开放问题、负责人、模型调整、报告补读和下次跟进时间写入本地行动项。",
        action_route: "/modules/meetings",
        route_label: "查看任务队列",
        requires_manual_confirmation: true,
      })
    );
  }

  if (input.decisionLedger.summary.ledger_items > 0) {
    actions.push(
      action({
        id: "meeting-workbench:decision-ledger",
        lane_id: "decision-ledger",
        title: "补会议投研闭环",
        priority: "high",
        status: "review-needed",
        evidence: `${input.decisionLedger.summary.ledger_items} 个会议页缺少投研闭环结构。`,
        next_action:
          "补会议结论、thesis 影响、模型影响、风险、催化剂和开放问题。",
        action_route: "/modules/meetings",
        route_label: "查看投研闭环",
        requires_manual_confirmation: true,
      })
    );
  }

  if (input.researchQueue.summary.queue_items > 0) {
    actions.push(
      action({
        id: "meeting-workbench:research-queue-review",
        lane_id: "research-queue",
        title: "复核会议研究任务队列",
        priority:
          input.researchQueue.summary.high_priority_items > 0 ? "high" : "medium",
        status:
          input.researchQueue.summary.blocked_items > 0
            ? "blocked-boundary"
            : "review-needed",
        evidence: `${input.researchQueue.summary.queue_items} 个会议研究任务等待处理。`,
        next_action:
          "按 transcript、decision、model、risk/catalyst、open question、relation 顺序复核。",
        action_route: "/modules/meetings",
        route_label: "查看任务队列",
        requires_manual_confirmation: false,
      })
    );
  }

  const relationGaps =
    input.followUp.summary.missing_company_links +
    input.followUp.summary.missing_report_links;
  if (relationGaps > 0) {
    actions.push(
      action({
        id: "meeting-workbench:relation-linking",
        lane_id: "relation-linking",
        title: "补公司和报告关联",
        priority: "medium",
        status: "review-needed",
        evidence: `${relationGaps} 个公司/报告 relation 结构缺口。`,
        next_action:
          "用研究图谱把会议连接到公司页、报告、memo 或业绩复盘。",
        action_route: "/modules/research-graph",
        route_label: "打开研究图谱",
        requires_manual_confirmation: true,
      })
    );
  }

  if (input.followUp.summary.tracker_databases === 0) {
    actions.push(
      action({
        id: "meeting-workbench:create-meeting-tracker",
        lane_id: "tracker-intake",
        title: "创建会议跟踪表",
        priority: "high",
        status: "missing",
        evidence: "当前缺少会议跟踪表。",
        next_action:
          "创建会议跟踪表后，再逐条把会议页接入 tracker row。",
        action_route: "/modules/meetings",
        route_label: "创建会议跟踪表",
        requires_manual_confirmation: true,
      })
    );
  }

  if (input.trackerIntakeItems.length > 0) {
    actions.push(
      action({
        id: "meeting-workbench:tracker-intake-review",
        lane_id: "tracker-intake",
        title: "复核会议入库候选",
        priority:
          input.followUp.summary.tracker_databases > 0 ? "medium" : "high",
        status:
          input.followUp.summary.tracker_databases > 0
            ? "review-needed"
            : "blocked-boundary",
        evidence: `${input.trackerIntakeItems.length} 个会议页可进入会议入库台。`,
        next_action:
          input.followUp.summary.tracker_databases > 0
            ? "逐条确认会议页是否应创建 tracker row；不要批量写入。"
            : "先创建会议跟踪表，再逐条处理入库候选。",
        action_route: "/modules/meetings",
        route_label: "查看入库台",
        requires_manual_confirmation: true,
      })
    );
  }

  actions.push(
    action({
      id: "meeting-workbench:privacy-boundary",
      lane_id: "privacy-boundary",
      title: "会议自动化和外发前必须确认",
      priority: "high",
      status: "blocked-boundary",
      evidence: "会议入会、录音、发布、AI、云同步和批量写入均未启用。",
      next_action:
        "任何 meeting agent、AI、云同步、外部分享或批量数据库写入前，都必须先做 payload preview 和用户确认。",
      action_route: "/modules/sync",
      route_label: "打开同步边界",
      requires_manual_confirmation: true,
    })
  );

  return actions.sort(sortActions);
}

function action(
  input: Omit<
    MeetingWorkbenchAction,
    | "writes_workspace_data"
    | "joins_calls"
    | "records_audio"
    | "publishes_notes"
    | "privacy_boundary"
  >
): MeetingWorkbenchAction {
  return {
    ...input,
    writes_workspace_data: false,
    joins_calls: false,
    records_audio: false,
    publishes_notes: false,
    privacy_boundary:
      "Workbench action is metadata-only and does not include meeting titles, page text, transcript text, recording bytes, participant details, meeting passcodes, row values, holdings, trading plans, cloud data, AI prompts, tokens, or credentials.",
  };
}

function buildLanes(actions: MeetingWorkbenchAction[]) {
  return (Object.keys(LANE_META) as MeetingWorkbenchLaneId[]).map((id) => {
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
  followUp: MeetingFollowUpReport;
  decisionLedger: MeetingDecisionLedgerReport;
  researchQueue: MeetingResearchQueueReport;
  playbook: MeetingResearchPlaybook;
  trackerIntakeItems: MeetingTrackerFollowUpItem[];
}): MeetingWorkbenchReviewStep[] {
  return [
    reviewStep(
      "meeting-capture",
      1,
      "先建立会议纪要",
      "/modules/meetings",
      "会议纪要是 transcript、行动项、投研闭环和 relation 的本地中枢。",
      input.followUp.summary.meeting_pages > 0
        ? "已有会议纪要页面。"
        : "至少创建一个会议纪要页面。"
    ),
    reviewStep(
      "transcript-review",
      2,
      "再补 transcript 复盘",
      "/modules/meetings",
      "转录稿或录音索引需要先人工复核，才能抽取可靠观点和开放问题。",
      input.followUp.summary.missing_transcripts === 0
        ? "Transcript 结构已覆盖。"
        : "Transcript 结构仍有缺口。"
    ),
    reviewStep(
      "decision-ledger",
      3,
      "沉淀投研闭环",
      "/modules/meetings",
      "会议结论需要进入 thesis、模型、风险、催化剂和开放问题结构。",
      input.decisionLedger.summary.ledger_items === 0
        ? "会议投研闭环结构已覆盖。"
        : "仍有会议缺少投研闭环结构。"
    ),
    reviewStep(
      "research-queue",
      4,
      "处理研究任务队列",
      "/modules/meetings",
      "研究任务队列把会议后的补读、模型调整、开放问题和关系补齐排成队。",
      input.researchQueue.summary.queue_items === 0
        ? "当前没有会议研究任务。"
        : "会议研究任务等待复核。"
    ),
    reviewStep(
      "relation-linking",
      5,
      "连接公司和报告",
      "/modules/research-graph",
      "会议要回到公司、报告、memo 或业绩复盘，才形成投研闭环。",
      input.followUp.summary.missing_company_links === 0 &&
      input.followUp.summary.missing_report_links === 0
        ? "公司和报告 relation 结构已覆盖。"
        : "公司或报告 relation 仍需手动补齐。"
    ),
    reviewStep(
      "tracker-intake",
      6,
      "最后逐条入会议跟踪表",
      "/modules/meetings",
      "tracker row 是本地写入动作，必须逐条确认，不能由工作台批量写入。",
      input.trackerIntakeItems.length > 0
        ? `${input.trackerIntakeItems.length} 个候选等待会议入库台复核。`
        : "当前没有 tracker intake 候选。"
    ),
    reviewStep(
      "privacy-boundary",
      7,
      "外发和自动化必须单独确认",
      "/modules/sync",
      "入会、录音、发布、AI、云同步和批量写入都是高风险动作。",
      "当前 packet 只做本地 metadata-only 排队。"
    ),
  ];
}

function reviewStep(
  id: string,
  order: number,
  title: string,
  route: string,
  reason: string,
  completionSignal: string
): MeetingWorkbenchReviewStep {
  return {
    id,
    order,
    title,
    route,
    reason,
    completion_signal: completionSignal,
  };
}

function sortActions(left: MeetingWorkbenchAction, right: MeetingWorkbenchAction) {
  const priorityRank: Record<MeetingWorkbenchPriority, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };
  const laneRank: Record<MeetingWorkbenchLaneId, number> = {
    "meeting-capture": 0,
    "transcript-review": 1,
    "decision-ledger": 2,
    "research-queue": 3,
    "tracker-intake": 4,
    "relation-linking": 5,
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
