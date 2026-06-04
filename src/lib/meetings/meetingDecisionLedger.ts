import type { Database, Page } from "@/lib/utils/types";

export type MeetingDecisionStatus = "ready" | "partial" | "missing";

export type MeetingDecisionSignalId =
  | "decision-summary"
  | "thesis-impact"
  | "model-impact"
  | "risk-watch"
  | "catalyst-follow-up"
  | "open-questions";

export type MeetingDecisionPriority = "high" | "medium" | "low";

export interface MeetingDecisionSignal {
  id: MeetingDecisionSignalId;
  title: string;
  status: MeetingDecisionStatus;
  evidence: string;
  next_action: string;
  privacy_boundary: string;
}

export interface MeetingDecisionLedgerItem {
  id: string;
  page_id: string;
  page_title: string;
  route: string;
  priority: MeetingDecisionPriority;
  missing_signals: MeetingDecisionSignalId[];
  ready_signals: MeetingDecisionSignalId[];
  next_action: string;
  privacy_boundary: string;
  updated_at: string;
}

export interface MeetingDecisionLedgerReport {
  format: "zhinote-meeting-decision-ledger";
  format_version: 1;
  report_status: "local-meeting-decision-ledger-only";
  privacy_note: string;
  boundary: {
    local_report_only: true;
    reads_local_page_html: true;
    reads_database_metadata: true;
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
    meeting_pages: number;
    tracker_databases: number;
    decision_signals: number;
    ready_signals: number;
    partial_signals: number;
    missing_signals: number;
    meetings_with_decision_summary: number;
    meetings_with_thesis_impact: number;
    meetings_with_model_impact: number;
    meetings_with_risk_watch: number;
    meetings_with_catalyst_follow_up: number;
    meetings_with_open_questions: number;
    ledger_items: number;
    high_priority_items: number;
  };
  signals: MeetingDecisionSignal[];
  items: MeetingDecisionLedgerItem[];
}

const MEETING_TERMS = [
  "meeting notes",
  "meeting note",
  "management call",
  "expert call",
  "earnings call",
  "call notes",
  "会议纪要",
  "电话会",
  "管理层会议",
  "专家电话会",
  "转录稿",
];

const TRACKER_TERMS = [
  "meeting tracker",
  "call tracker",
  "meeting",
  "会议跟踪",
  "电话会",
  "会议",
];

const SIGNAL_TERMS: Record<MeetingDecisionSignalId, string[]> = {
  "decision-summary": [
    "decision",
    "decision summary",
    "research decision",
    "结论 / 决策",
    "结论",
    "决策",
    "核心结论",
  ],
  "thesis-impact": [
    "thesis impact",
    "investment thesis",
    "thesis",
    "投资假设变化",
    "投资假设",
    "核心假设",
    "增强的假设",
    "削弱的假设",
  ],
  "model-impact": [
    "model impact",
    "model update",
    "assumption update",
    "模型影响",
    "模型调整",
    "估值影响",
    "假设更新",
  ],
  "risk-watch": [
    "risk watch",
    "risk notes",
    "risk",
    "downside",
    "风险",
    "风险监控",
    "风险笔记",
    "反向证据",
  ],
  "catalyst-follow-up": [
    "catalyst",
    "next catalyst",
    "review window",
    "check point",
    "催化剂",
    "下一催化剂",
    "复盘窗口",
    "检查点",
  ],
  "open-questions": [
    "open questions",
    "follow-up questions",
    "questions to answer",
    "开放问题",
    "后续问题",
    "待回答问题",
    "需要验证的问题",
  ],
};

export function buildMeetingDecisionLedgerReport(
  pages: Page[],
  databases: Database[]
): MeetingDecisionLedgerReport {
  const meetingPages = filterPages(pages, MEETING_TERMS);
  const trackerDatabases = databases.filter((database) =>
    textMatches(`${database.title} ${database.description ?? ""}`, TRACKER_TERMS)
  );
  const signalCounts = getSignalCounts(meetingPages);
  const signals = buildSignals(meetingPages.length, signalCounts);
  const items = meetingPages
    .map(buildLedgerItem)
    .filter((item) => item.missing_signals.length > 0);

  return {
    format: "zhinote-meeting-decision-ledger",
    format_version: 1,
    report_status: "local-meeting-decision-ledger-only",
    privacy_note:
      "Generated locally from meeting page titles, page HTML structure, and database metadata. It checks whether meeting assets have decision, thesis impact, model impact, risk, catalyst, and open-question structure. It does not export meeting text, transcript text, recording bytes, participant details, meeting passcodes, database row values, holdings, trading plans, cloud data, AI prompts, tokens, or credentials.",
    boundary: {
      local_report_only: true,
      reads_local_page_html: true,
      reads_database_metadata: true,
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
    summary: {
      meeting_pages: meetingPages.length,
      tracker_databases: trackerDatabases.length,
      decision_signals: signals.length,
      ready_signals: signals.filter((signal) => signal.status === "ready").length,
      partial_signals: signals.filter((signal) => signal.status === "partial")
        .length,
      missing_signals: signals.filter((signal) => signal.status === "missing")
        .length,
      meetings_with_decision_summary: signalCounts["decision-summary"],
      meetings_with_thesis_impact: signalCounts["thesis-impact"],
      meetings_with_model_impact: signalCounts["model-impact"],
      meetings_with_risk_watch: signalCounts["risk-watch"],
      meetings_with_catalyst_follow_up: signalCounts["catalyst-follow-up"],
      meetings_with_open_questions: signalCounts["open-questions"],
      ledger_items: items.length,
      high_priority_items: items.filter((item) => item.priority === "high")
        .length,
    },
    signals,
    items,
  };
}

function buildSignals(
  meetingCount: number,
  signalCounts: Record<MeetingDecisionSignalId, number>
): MeetingDecisionSignal[] {
  return SIGNAL_IDS.map((id) => ({
    id,
    title: getMeetingDecisionSignalLabel(id),
    status: coverageStatus(signalCounts[id], meetingCount),
    evidence:
      meetingCount > 0
        ? `${signalCounts[id]} / ${meetingCount} 个会议页包含${getMeetingDecisionSignalLabel(id)}结构。`
        : "还没有会议页，无法检查投研闭环结构。",
    next_action: getSignalNextAction(id),
    privacy_boundary: getSignalPrivacyBoundary(id),
  }));
}

function buildLedgerItem(page: Page): MeetingDecisionLedgerItem {
  const readySignals = SIGNAL_IDS.filter((id) =>
    textMatches(pageText(page), SIGNAL_TERMS[id])
  );
  const missingSignals = SIGNAL_IDS.filter((id) => !readySignals.includes(id));

  return {
    id: page.id,
    page_id: page.id,
    page_title: page.title || "未命名会议纪要",
    route: `/page/${page.id}`,
    priority: getPriority(missingSignals),
    missing_signals: missingSignals,
    ready_signals: readySignals,
    next_action: getLedgerNextAction(missingSignals),
    privacy_boundary:
      "只输出会议页闭环结构状态，不导出会议正文、转录稿、录音、参会人详情、meeting passcodes、持仓或交易计划。",
    updated_at: page.updated_at,
  };
}

function getSignalCounts(pages: Page[]) {
  return SIGNAL_IDS.reduce(
    (counts, id) => ({
      ...counts,
      [id]: pages.filter((page) => textMatches(pageText(page), SIGNAL_TERMS[id]))
        .length,
    }),
    {} as Record<MeetingDecisionSignalId, number>
  );
}

function getLedgerNextAction(missingSignals: MeetingDecisionSignalId[]) {
  if (missingSignals.length === 0) {
    return "会议已经覆盖基础投研闭环，下一步可以维护 relation 值和最新结论。";
  }

  return `优先补齐 ${missingSignals
    .map(getMeetingDecisionSignalLabel)
    .join("、")}，让会议结论进入公司页、报告库、模型或组合复盘。`;
}

function getPriority(
  missingSignals: MeetingDecisionSignalId[]
): MeetingDecisionPriority {
  if (
    missingSignals.includes("decision-summary") ||
    missingSignals.includes("thesis-impact") ||
    missingSignals.includes("model-impact")
  ) {
    return "high";
  }
  if (
    missingSignals.includes("risk-watch") ||
    missingSignals.includes("catalyst-follow-up")
  ) {
    return "medium";
  }
  return "low";
}

function getSignalNextAction(id: MeetingDecisionSignalId) {
  const map: Record<MeetingDecisionSignalId, string> = {
    "decision-summary":
      "在会议页补一个结论区，明确这次会议改变了什么判断、保留了什么判断、下一步如何处理。",
    "thesis-impact":
      "把会议对核心投资假设的增强、削弱或待验证部分写入公司页或投资 memo。",
    "model-impact":
      "把收入、利润率、假设、估值或模型调整放入可复盘的页面区块或跟踪字段。",
    "risk-watch":
      "把反向证据、风险监控项和需要降低确信度的信号挂回公司或组合复盘。",
    "catalyst-follow-up":
      "把下一催化剂、检查日期和复盘窗口连接到公司、报告或组合跟踪表。",
    "open-questions":
      "把开放问题和待验证事项转成后续行动，进入会议跟踪表或公司研究队列。",
  };

  return map[id];
}

function getSignalPrivacyBoundary(id: MeetingDecisionSignalId) {
  const common =
    "只检查是否存在结构信号，不导出页面正文、转录文本、数据库 row values 或文件 bytes。";
  if (id === "model-impact") {
    return "只检查模型影响结构，不读取、计算或导出财务模型文件内容。";
  }
  if (id === "risk-watch" || id === "catalyst-follow-up") {
    return "只检查风险/催化剂结构，不导出交易节奏、持仓、权重或具体观点正文。";
  }
  return common;
}

function filterPages(pages: Page[], terms: string[]) {
  return pages.filter((page) => textMatches(pageText(page), terms));
}

function pageText(page: Pick<Page, "title" | "content_text">) {
  return `${page.title ?? ""} ${page.content_text ?? ""}`;
}

function textMatches(value: string, terms: string[]) {
  const normalized = normalizeText(value);
  return terms.some((term) => normalized.includes(normalizeText(term)));
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function coverageStatus(
  count: number,
  total: number
): MeetingDecisionStatus {
  if (total === 0 || count === 0) return "missing";
  if (count === total) return "ready";
  return "partial";
}

const SIGNAL_IDS: MeetingDecisionSignalId[] = [
  "decision-summary",
  "thesis-impact",
  "model-impact",
  "risk-watch",
  "catalyst-follow-up",
  "open-questions",
];

export function getMeetingDecisionSignalLabel(id: MeetingDecisionSignalId) {
  const labels: Record<MeetingDecisionSignalId, string> = {
    "decision-summary": "会议结论",
    "thesis-impact": "Thesis 影响",
    "model-impact": "模型影响",
    "risk-watch": "风险监控",
    "catalyst-follow-up": "催化剂跟进",
    "open-questions": "开放问题",
  };

  return labels[id];
}
