import type { Database, Page } from "@/lib/utils/types";

export type MeetingFollowUpStage =
  | "prep"
  | "transcript-review"
  | "action-items"
  | "research-linking"
  | "done";

export type MeetingFollowUpPriority = "high" | "medium" | "low";

export interface MeetingFollowUpLane {
  id: MeetingFollowUpStage;
  title: string;
  description: string;
}

export interface MeetingFollowUpItem {
  id: string;
  page_id: string;
  page_title: string;
  route: string;
  stage: MeetingFollowUpStage;
  priority: MeetingFollowUpPriority;
  has_transcript: boolean;
  has_action_items: boolean;
  has_company_link: boolean;
  has_report_link: boolean;
  missing_steps: MeetingFollowUpStage[];
  next_action: string;
  privacy_boundary: string;
  updated_at: string;
}

export interface MeetingFollowUpReport {
  format: "zhinote-meeting-follow-up-report";
  format_version: 1;
  report_status: "local-meeting-follow-up-only";
  privacy_note: string;
  boundary: {
    local_report_only: true;
    reads_local_page_html: true;
    reads_database_metadata: true;
    includes_page_text: false;
    includes_database_row_values: false;
    reads_file_bytes: false;
    joins_calls: false;
    records_audio: false;
    publishes_notes: false;
    writes_workspace_data: false;
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
    high_priority: number;
    missing_transcripts: number;
    missing_action_items: number;
    missing_company_links: number;
    missing_report_links: number;
  };
  lanes: MeetingFollowUpLane[];
  items: MeetingFollowUpItem[];
}

export const MEETING_FOLLOW_UP_LANES: MeetingFollowUpLane[] = [
  {
    id: "prep",
    title: "会前准备",
    description: "确认平台、组织者、公司、议程和核心研究问题。",
  },
  {
    id: "transcript-review",
    title: "转录复盘",
    description: "补充转录稿、录音链接、关键表述和会议观察。",
  },
  {
    id: "action-items",
    title: "行动项",
    description: "跟踪跟进、开放问题、模型调整和负责人。",
  },
  {
    id: "research-linking",
    title: "研究关联",
    description: "把会议连接到公司页面、报告、备忘录和业绩复盘。",
  },
  {
    id: "done",
    title: "已归档",
    description: "会议结构已覆盖基础转录、行动项和研究关联。",
  },
];

const MEETING_TERMS = [
  "meeting notes",
  "会议纪要",
  "management call",
  "expert call",
  "earnings call",
  "电话会",
  "participants",
  "discussion",
  "decisions",
];
const TRANSCRIPT_TERMS = [
  "transcript",
  "raw transcript",
  "recording",
  "转录稿",
  "录音",
  "管理层表述",
];
const ACTION_ITEM_TERMS = [
  "action items",
  "follow-up",
  "follow up",
  "open questions",
  "行动项",
  "后续行动",
  "开放问题",
];
const COMPANY_LINK_TERMS = [
  "company page",
  "company",
  "公司页面",
  "公司",
];
const REPORT_LINK_TERMS = [
  "report page",
  "related report",
  "source report",
  "报告页面",
  "相关报告",
  "研究报告",
];
const TRACKER_TERMS = ["meeting", "call tracker", "会议", "电话会"];

export function buildMeetingFollowUpReport(
  pages: Page[],
  databases: Database[]
): MeetingFollowUpReport {
  const meetingPages = filterPages(pages, MEETING_TERMS);
  const transcriptPages = filterPages(pages, TRANSCRIPT_TERMS);
  const actionItemPages = filterPages(pages, ACTION_ITEM_TERMS);
  const trackerDatabases = databases.filter((database) =>
    textMatches(`${database.title} ${database.description ?? ""}`, TRACKER_TERMS)
  );
  const items = meetingPages.map(buildFollowUpItem);

  return {
    format: "zhinote-meeting-follow-up-report",
    format_version: 1,
    report_status: "local-meeting-follow-up-only",
    privacy_note:
      "由会议页面标题、页面 HTML 结构和数据库元数据在本地生成。它只识别跟进阶段、缺失的转录稿/行动项/关系结构和下一步动作，不导出会议正文、转录稿文本、录音字节、数据库行值、云端数据、AI 提示词、会议密码或参会人详情。",
    boundary: {
      local_report_only: true,
      reads_local_page_html: true,
      reads_database_metadata: true,
      includes_page_text: false,
      includes_database_row_values: false,
      reads_file_bytes: false,
      joins_calls: false,
      records_audio: false,
      publishes_notes: false,
      writes_workspace_data: false,
      connects_cloud_services: false,
      uploads_data: false,
      enables_ai: false,
    },
    summary: {
      meeting_pages: meetingPages.length,
      transcript_pages: transcriptPages.length,
      action_item_pages: actionItemPages.length,
      tracker_databases: trackerDatabases.length,
      follow_up_items: items.length,
      high_priority: items.filter((item) => item.priority === "high").length,
      missing_transcripts: items.filter((item) => !item.has_transcript).length,
      missing_action_items: items.filter((item) => !item.has_action_items).length,
      missing_company_links: items.filter((item) => !item.has_company_link)
        .length,
      missing_report_links: items.filter((item) => !item.has_report_link).length,
    },
    lanes: MEETING_FOLLOW_UP_LANES,
    items,
  };
}

function buildFollowUpItem(page: Page): MeetingFollowUpItem {
  const text = pageText(page);
  const hasTranscript = textMatches(text, TRANSCRIPT_TERMS);
  const hasActionItems = textMatches(text, ACTION_ITEM_TERMS);
  const hasCompanyLink = textMatches(text, COMPANY_LINK_TERMS);
  const hasReportLink = textMatches(text, REPORT_LINK_TERMS);
  const missingSteps = getMissingSteps({
    hasTranscript,
    hasActionItems,
    hasCompanyLink,
    hasReportLink,
  });
  const stage = getCurrentStage(missingSteps);

  return {
    id: page.id,
    page_id: page.id,
    page_title: page.title || "未命名会议纪要",
    route: `/page/${page.id}`,
    stage,
    priority: getPriority(missingSteps),
    has_transcript: hasTranscript,
    has_action_items: hasActionItems,
    has_company_link: hasCompanyLink,
    has_report_link: hasReportLink,
    missing_steps: missingSteps,
    next_action: getNextAction(missingSteps),
    privacy_boundary:
      "只输出会议页结构状态和缺口，不导出会议正文、转录稿、录音、参会人详情或会议密码。",
    updated_at: page.updated_at,
  };
}

function getMissingSteps(input: {
  hasTranscript: boolean;
  hasActionItems: boolean;
  hasCompanyLink: boolean;
  hasReportLink: boolean;
}) {
  const missing: MeetingFollowUpStage[] = [];

  if (!input.hasTranscript) missing.push("transcript-review");
  if (!input.hasActionItems) missing.push("action-items");
  if (!input.hasCompanyLink || !input.hasReportLink) {
    missing.push("research-linking");
  }

  return missing;
}

function getCurrentStage(missingSteps: MeetingFollowUpStage[]) {
  return missingSteps[0] ?? "done";
}

function getPriority(missingSteps: MeetingFollowUpStage[]): MeetingFollowUpPriority {
  if (
    missingSteps.includes("action-items") ||
    missingSteps.includes("research-linking")
  ) {
    return "high";
  }
  if (missingSteps.includes("transcript-review")) return "medium";
  return "low";
}

function getNextAction(missingSteps: MeetingFollowUpStage[]) {
  if (missingSteps.length === 0) {
    return "基础会议结构已覆盖，下一步可以补关系值和最新结论。";
  }
  if (missingSteps.includes("transcript-review")) {
    return "先补转录稿或录音链接，再提取关键表述和待回答问题。";
  }
  if (missingSteps.includes("action-items")) {
    return "补充跟进、开放问题、模型调整和负责人。";
  }
  return "把会议关联到公司页面、相关报告、备忘录或业绩复盘。";
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

export function getMeetingFollowUpStageLabel(stage: MeetingFollowUpStage) {
  const labels: Record<MeetingFollowUpStage, string> = {
    prep: "会前准备",
    "transcript-review": "转录复盘",
    "action-items": "行动项",
    "research-linking": "研究关联",
    done: "已归档",
  };

  return labels[stage];
}
