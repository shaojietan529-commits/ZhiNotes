import {
  getMeetingDecisionSignalLabel,
  type MeetingDecisionLedgerReport,
  type MeetingDecisionSignalId,
} from "@/lib/meetings/meetingDecisionLedger";
import {
  getMeetingFollowUpStageLabel,
  type MeetingFollowUpPriority,
  type MeetingFollowUpReport,
} from "@/lib/meetings/meetingFollowUp";

export type MeetingResearchQueueWorkstream =
  | "transcript-review"
  | "decision-capture"
  | "model-update"
  | "risk-catalyst"
  | "open-question"
  | "relation-linking"
  | "tracker-intake";

export type MeetingResearchQueueStatus = "ready" | "review-needed" | "blocked";

export type MeetingResearchQueueRisk = "high" | "medium" | "low";

export type MeetingResearchQueueSource =
  | "follow-up"
  | "decision-ledger"
  | "mixed";

export interface MeetingResearchQueueItem {
  id: string;
  page_id: string;
  page_title: string;
  route: string;
  workstream: MeetingResearchQueueWorkstream;
  status: MeetingResearchQueueStatus;
  priority: MeetingFollowUpPriority;
  risk: MeetingResearchQueueRisk;
  source: MeetingResearchQueueSource;
  trigger: string;
  missing_structures: string[];
  next_action: string;
  privacy_boundary: string;
  updated_at: string;
}

export interface MeetingResearchQueueGate {
  id:
    | "queue-built-from-local-reports"
    | "transcript-review-gate"
    | "decision-capture-gate"
    | "model-update-gate"
    | "risk-catalyst-gate"
    | "relation-linking-gate";
  title: string;
  status: MeetingResearchQueueStatus;
  evidence: string;
  next_action: string;
  privacy_boundary: string;
}

export interface MeetingResearchQueueReport {
  format: "zhinote-meeting-research-queue";
  format_version: 1;
  report_status: "local-meeting-research-queue-only";
  privacy_note: string;
  boundary: {
    local_queue_only: true;
    reads_meeting_follow_up_report: true;
    reads_meeting_decision_ledger: true;
    reads_page_text: false;
    includes_page_text: false;
    includes_transcript_text: false;
    includes_recording_bytes: false;
    includes_participant_details: false;
    includes_meeting_passcodes: false;
    includes_database_row_values: false;
    includes_holdings_or_trading_plans: false;
    writes_workspace_data: false;
    connects_cloud_services: false;
    uploads_data: false;
    enables_ai: false;
  };
  summary: {
    queue_items: number;
    review_needed_items: number;
    blocked_items: number;
    high_priority_items: number;
    transcript_review_items: number;
    decision_capture_items: number;
    model_update_items: number;
    risk_catalyst_items: number;
    open_question_items: number;
    relation_linking_items: number;
    tracker_intake_items: number;
  };
  gates: MeetingResearchQueueGate[];
  items: MeetingResearchQueueItem[];
}

export function buildMeetingResearchQueue(input: {
  followUp: MeetingFollowUpReport;
  decisionLedger: MeetingDecisionLedgerReport;
}): MeetingResearchQueueReport {
  const items = buildQueueItems(input.followUp, input.decisionLedger);
  const summary = buildSummary(items);

  return {
    format: "zhinote-meeting-research-queue",
    format_version: 1,
    report_status: "local-meeting-research-queue-only",
    privacy_note:
      "由会议跟进报告和会议决策账本在本地生成。它只把本地结构缺口转成研究任务，不读取或导出页面正文、会议正文、转录稿文本、录音字节、参会人详情、会议密码、数据库行值、持仓、交易计划、云端数据、AI 提示词、token 或凭证。",
    boundary: {
      local_queue_only: true,
      reads_meeting_follow_up_report: true,
      reads_meeting_decision_ledger: true,
      reads_page_text: false,
      includes_page_text: false,
      includes_transcript_text: false,
      includes_recording_bytes: false,
      includes_participant_details: false,
      includes_meeting_passcodes: false,
      includes_database_row_values: false,
      includes_holdings_or_trading_plans: false,
      writes_workspace_data: false,
      connects_cloud_services: false,
      uploads_data: false,
      enables_ai: false,
    },
    summary,
    gates: buildGates(input.followUp, input.decisionLedger, summary),
    items,
  };
}

function buildQueueItems(
  followUp: MeetingFollowUpReport,
  decisionLedger: MeetingDecisionLedgerReport
) {
  const queue = new Map<string, MeetingResearchQueueItem>();

  for (const item of followUp.items) {
    if (item.missing_steps.includes("transcript-review")) {
      addQueueItem(queue, {
        id: `${item.page_id}:transcript-review`,
        page_id: item.page_id,
        page_title: item.page_title,
        route: item.route,
        workstream: "transcript-review",
        status: "review-needed",
        priority: item.priority,
        risk: riskFromPriority(item.priority, "transcript-review"),
        source: "follow-up",
        trigger: "缺转录稿结构",
        missing_structures: [getMeetingFollowUpStageLabel("transcript-review")],
        next_action:
          "补转录稿页面或录音索引，再人工提取关键表述、开放问题和可信度。",
        privacy_boundary:
          "只来自跟进结构状态，不读取或导出会议正文、转录稿文本、录音字节、参会人详情或会议密码。",
        updated_at: item.updated_at,
      });
    }

    if (item.missing_steps.includes("action-items")) {
      addQueueItem(queue, {
        id: `${item.page_id}:open-question`,
        page_id: item.page_id,
        page_title: item.page_title,
        route: item.route,
        workstream: "open-question",
        status: "review-needed",
        priority: "high",
        risk: "high",
        source: "follow-up",
        trigger: "缺 action items 或开放问题结构",
        missing_structures: [getMeetingFollowUpStageLabel("action-items")],
        next_action:
          "把会议后的开放问题、负责人、补读材料、模型调整和下次跟进时间写入本地行动项。",
        privacy_boundary:
          "只提示行动项结构缺口，不读取或导出行动项正文、负责人个人信息或数据库行值。",
        updated_at: item.updated_at,
      });
    }

    if (item.missing_steps.includes("research-linking")) {
      addQueueItem(queue, {
        id: `${item.page_id}:relation-linking`,
        page_id: item.page_id,
        page_title: item.page_title,
        route: item.route,
        workstream: "relation-linking",
        status: "review-needed",
        priority: item.priority,
        risk: riskFromPriority(item.priority, "relation-linking"),
        source: "follow-up",
        trigger: "缺公司或报告 relation",
        missing_structures: [getMeetingFollowUpStageLabel("research-linking")],
        next_action:
          "把会议页连接到公司主页、相关报告、备忘录或业绩复盘，形成会议-公司-报告闭环。",
        privacy_boundary:
          "只提示关系结构缺口，不读取或导出会议正文、报告正文、公司研究正文或数据库行值。",
        updated_at: item.updated_at,
      });
    }

    if (followUp.summary.tracker_databases === 0) {
      addQueueItem(queue, {
        id: `${item.page_id}:tracker-intake`,
        page_id: item.page_id,
        page_title: item.page_title,
        route: item.route,
        workstream: "tracker-intake",
        status: "blocked",
        priority: item.priority,
        risk: "medium",
        source: "follow-up",
        trigger: "缺会议跟踪表",
        missing_structures: ["会议跟踪表"],
        next_action:
          "先创建会议跟踪表，再把会议页入库为本地跟踪表行，后续手动补关系值。",
        privacy_boundary:
          "只检查跟踪表元数据，不读取或导出跟踪表行值、参会人详情、会议密码或转录稿文本。",
        updated_at: item.updated_at,
      });
    }
  }

  for (const item of decisionLedger.items) {
    for (const signalId of item.missing_signals) {
      const workstream = workstreamFromSignal(signalId);
      addQueueItem(queue, {
        id: `${item.page_id}:${workstream}`,
        page_id: item.page_id,
        page_title: item.page_title,
        route: item.route,
        workstream,
        status: "review-needed",
        priority: item.priority,
        risk: riskFromDecisionSignal(signalId, item.priority),
        source: "decision-ledger",
        trigger: `缺 ${getMeetingDecisionSignalLabel(signalId)}`,
        missing_structures: [getMeetingDecisionSignalLabel(signalId)],
        next_action: nextActionFromSignal(signalId),
        privacy_boundary:
          "只来自决策账本结构状态，不读取或导出会议正文、转录稿文本、录音字节、参会人详情、会议密码、持仓或交易计划。",
        updated_at: item.updated_at,
      });
    }
  }

  return Array.from(queue.values()).sort(sortQueueItems);
}

function addQueueItem(
  queue: Map<string, MeetingResearchQueueItem>,
  item: MeetingResearchQueueItem
) {
  const existing = queue.get(item.id);
  if (!existing) {
    queue.set(item.id, item);
    return;
  }

  queue.set(item.id, {
    ...existing,
    status: mergeStatus(existing.status, item.status),
    priority: mergePriority(existing.priority, item.priority),
    risk: mergeRisk(existing.risk, item.risk),
    source: existing.source === item.source ? existing.source : "mixed",
    trigger: mergeText(existing.trigger, item.trigger),
    missing_structures: unique([
      ...existing.missing_structures,
      ...item.missing_structures,
    ]),
    next_action: mergeText(existing.next_action, item.next_action),
    privacy_boundary: mergeText(existing.privacy_boundary, item.privacy_boundary),
    updated_at:
      existing.updated_at > item.updated_at ? existing.updated_at : item.updated_at,
  });
}

function buildSummary(items: MeetingResearchQueueItem[]) {
  return {
    queue_items: items.length,
    review_needed_items: items.filter((item) => item.status === "review-needed")
      .length,
    blocked_items: items.filter((item) => item.status === "blocked").length,
    high_priority_items: items.filter((item) => item.priority === "high").length,
    transcript_review_items: countWorkstream(items, "transcript-review"),
    decision_capture_items: countWorkstream(items, "decision-capture"),
    model_update_items: countWorkstream(items, "model-update"),
    risk_catalyst_items: countWorkstream(items, "risk-catalyst"),
    open_question_items: countWorkstream(items, "open-question"),
    relation_linking_items: countWorkstream(items, "relation-linking"),
    tracker_intake_items: countWorkstream(items, "tracker-intake"),
  };
}

function buildGates(
  followUp: MeetingFollowUpReport,
  decisionLedger: MeetingDecisionLedgerReport,
  summary: MeetingResearchQueueReport["summary"]
): MeetingResearchQueueGate[] {
  const hasMeetings =
    followUp.summary.meeting_pages > 0 || decisionLedger.summary.meeting_pages > 0;

  return [
    {
      id: "queue-built-from-local-reports",
      title: "本地队列来源",
      status: hasMeetings ? "ready" : "blocked",
      evidence: hasMeetings
        ? `${summary.queue_items} 个任务来自跟进报告和决策账本。`
        : "还没有会议页，无法生成会议研究队列。",
      next_action: hasMeetings
        ? "先处理高优先级和 blocked 项，再进入每周会议复盘。"
        : "先创建会议纪要或导入会议页面。",
      privacy_boundary:
        "队列只读取本地跟进报告和决策账本，不读取页面正文、会议正文或文件字节。",
    },
    {
      id: "transcript-review-gate",
      title: "转录稿复盘门",
      status: gateStatus(hasMeetings, summary.transcript_review_items),
      evidence:
        summary.transcript_review_items > 0
          ? `${summary.transcript_review_items} 个会议任务需要补转录稿结构。`
          : hasMeetings
            ? "当前没有转录稿结构缺口。"
            : "还没有会议页，无法检查转录稿结构。",
      next_action:
        "先连接转录稿页面或录音索引，再人工标记关键表述和开放问题。",
      privacy_boundary:
        "只检查转录稿结构状态，不导出转录稿文本或录音字节。",
    },
    {
      id: "decision-capture-gate",
      title: "会议结论门",
      status: gateStatus(hasMeetings, summary.decision_capture_items),
      evidence:
        summary.decision_capture_items > 0
          ? `${summary.decision_capture_items} 个会议任务需要补会议结论或 Thesis 影响。`
          : hasMeetings
            ? "当前没有会议结论结构缺口。"
            : "还没有会议页，无法检查会议结论。",
      next_action:
        "把会议改变了什么判断、保留了什么判断、削弱了什么假设写入会议页或公司页。",
      privacy_boundary:
        "只检查结论结构，不导出会议正文、投资备忘录正文、持仓或交易计划。",
    },
    {
      id: "model-update-gate",
      title: "模型影响门",
      status: gateStatus(hasMeetings, summary.model_update_items),
      evidence:
        summary.model_update_items > 0
          ? `${summary.model_update_items} 个会议任务需要补模型影响。`
          : hasMeetings
            ? "当前没有模型影响结构缺口。"
            : "还没有会议页，无法检查模型影响。",
      next_action:
        "把收入、利润率、估值或假设变化登记为可复盘的本地页面区块或字段。",
      privacy_boundary:
        "只检查模型影响结构，不读取、计算或导出财务模型文件内容。",
    },
    {
      id: "risk-catalyst-gate",
      title: "风险/催化剂门",
      status: gateStatus(hasMeetings, summary.risk_catalyst_items),
      evidence:
        summary.risk_catalyst_items > 0
          ? `${summary.risk_catalyst_items} 个会议任务需要补风险监控或催化剂跟进。`
          : hasMeetings
            ? "当前没有风险/催化剂结构缺口。"
            : "还没有会议页，无法检查风险/催化剂。",
      next_action:
        "把反向证据、下一催化剂、检查日期和复盘窗口挂回公司或组合复盘。",
      privacy_boundary:
        "只检查风险/催化剂结构，不导出交易节奏、持仓、权重或具体观点正文。",
    },
    {
      id: "relation-linking-gate",
      title: "关系与入库门",
      status: gateStatus(
        hasMeetings,
        summary.relation_linking_items + summary.tracker_intake_items
      ),
      evidence:
        summary.relation_linking_items + summary.tracker_intake_items > 0
          ? `${summary.relation_linking_items} 个关系任务和 ${summary.tracker_intake_items} 个跟踪表入库任务待处理。`
          : hasMeetings
            ? "当前没有关系或跟踪表入库结构缺口。"
            : "还没有会议页，无法检查关系。",
      next_action:
        "把会议页连接到公司页、报告、备忘录、业绩复盘，并确认是否需要创建跟踪表行。",
      privacy_boundary:
        "只检查关系和跟踪表元数据，不导出数据库行值、会议正文或参会人详情。",
    },
  ];
}

function workstreamFromSignal(
  signalId: MeetingDecisionSignalId
): MeetingResearchQueueWorkstream {
  if (signalId === "model-impact") return "model-update";
  if (signalId === "risk-watch" || signalId === "catalyst-follow-up") {
    return "risk-catalyst";
  }
  if (signalId === "open-questions") return "open-question";
  return "decision-capture";
}

function nextActionFromSignal(signalId: MeetingDecisionSignalId) {
  const map: Record<MeetingDecisionSignalId, string> = {
    "decision-summary":
      "补一个会议结论区：这次会议改变了什么判断、确认了什么判断、下一步如何处理。",
    "thesis-impact":
      "把会议对核心投资假设的增强、削弱或待验证部分写入公司页或备忘录。",
    "model-impact":
      "把收入、利润率、估值或假设变化登记到本地模型影响区，后续再人工同步到模型。",
    "risk-watch":
      "把反向证据、风险监控项和需要降低确信度的信号挂回公司或组合复盘。",
    "catalyst-follow-up":
      "把下一催化剂、检查日期和复盘窗口连接到公司页、报告或组合跟踪表。",
    "open-questions":
      "把开放问题拆成可追踪的后续行动，进入会议跟踪表或公司研究队列。",
  };

  return map[signalId];
}

function riskFromDecisionSignal(
  signalId: MeetingDecisionSignalId,
  priority: MeetingFollowUpPriority
): MeetingResearchQueueRisk {
  if (
    signalId === "decision-summary" ||
    signalId === "thesis-impact" ||
    signalId === "model-impact"
  ) {
    return "high";
  }
  return riskFromPriority(priority, workstreamFromSignal(signalId));
}

function riskFromPriority(
  priority: MeetingFollowUpPriority,
  workstream: MeetingResearchQueueWorkstream
): MeetingResearchQueueRisk {
  if (priority === "high") return "high";
  if (workstream === "tracker-intake" || priority === "medium") return "medium";
  return "low";
}

function gateStatus(
  hasMeetings: boolean,
  gapCount: number
): MeetingResearchQueueStatus {
  if (!hasMeetings) return "blocked";
  return gapCount > 0 ? "review-needed" : "ready";
}

function countWorkstream(
  items: MeetingResearchQueueItem[],
  workstream: MeetingResearchQueueWorkstream
) {
  return items.filter((item) => item.workstream === workstream).length;
}

function mergeStatus(
  first: MeetingResearchQueueStatus,
  second: MeetingResearchQueueStatus
) {
  if (first === "blocked" || second === "blocked") return "blocked";
  if (first === "review-needed" || second === "review-needed") {
    return "review-needed";
  }
  return "ready";
}

function mergePriority(
  first: MeetingFollowUpPriority,
  second: MeetingFollowUpPriority
) {
  const weights: Record<MeetingFollowUpPriority, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };

  return weights[first] <= weights[second] ? first : second;
}

function mergeRisk(first: MeetingResearchQueueRisk, second: MeetingResearchQueueRisk) {
  const weights: Record<MeetingResearchQueueRisk, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };

  return weights[first] <= weights[second] ? first : second;
}

function mergeText(first: string, second: string) {
  if (first === second) return first;
  return `${first} ${second}`;
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function sortQueueItems(
  first: MeetingResearchQueueItem,
  second: MeetingResearchQueueItem
) {
  const statusDelta = statusWeight(first.status) - statusWeight(second.status);
  if (statusDelta !== 0) return statusDelta;

  const priorityDelta =
    priorityWeight(first.priority) - priorityWeight(second.priority);
  if (priorityDelta !== 0) return priorityDelta;

  const riskDelta = riskWeight(first.risk) - riskWeight(second.risk);
  if (riskDelta !== 0) return riskDelta;

  return second.updated_at.localeCompare(first.updated_at);
}

function statusWeight(status: MeetingResearchQueueStatus) {
  const weights: Record<MeetingResearchQueueStatus, number> = {
    blocked: 0,
    "review-needed": 1,
    ready: 2,
  };

  return weights[status];
}

function priorityWeight(priority: MeetingFollowUpPriority) {
  const weights: Record<MeetingFollowUpPriority, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };

  return weights[priority];
}

function riskWeight(risk: MeetingResearchQueueRisk) {
  const weights: Record<MeetingResearchQueueRisk, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };

  return weights[risk];
}

export function getMeetingResearchQueueWorkstreamLabel(
  workstream: MeetingResearchQueueWorkstream
) {
	  const labels: Record<MeetingResearchQueueWorkstream, string> = {
	    "transcript-review": "转录稿复盘",
	    "decision-capture": "会议结论",
	    "model-update": "模型更新",
	    "risk-catalyst": "风险/催化剂",
	    "open-question": "开放问题",
	    "relation-linking": "关系补全",
	    "tracker-intake": "跟踪表入库",
	  };

  return labels[workstream];
}

export function getMeetingResearchQueueStatusLabel(
  status: MeetingResearchQueueStatus
) {
	  const labels: Record<MeetingResearchQueueStatus, string> = {
	    ready: "就绪",
	    "review-needed": "待复核",
	    blocked: "阻塞",
	  };

  return labels[status];
}

export function getMeetingResearchQueueRiskLabel(risk: MeetingResearchQueueRisk) {
	  const labels: Record<MeetingResearchQueueRisk, string> = {
	    high: "高风险",
	    medium: "中风险",
	    low: "低风险",
	  };

  return labels[risk];
}
