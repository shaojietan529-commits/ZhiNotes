import {
  getMeetingFollowUpStageLabel,
  type MeetingFollowUpReport,
} from "@/lib/meetings/meetingFollowUp";
import {
  getResearchWorkflowSpec,
  type ResearchWorkflowStage,
} from "@/lib/modules/researchWorkflow";

export type MeetingResearchPlaybookStatus =
  | "ready"
  | "partial"
  | "missing"
  | "manual-confirmation";

export type MeetingResearchPlaybookStepId =
  | "meeting-context"
  | "transcript-review"
  | "action-items"
  | "company-linking"
  | "report-linking"
  | "meeting-tracker"
  | "follow-up-cadence";

export interface MeetingResearchPlaybookStep {
  id: MeetingResearchPlaybookStepId;
  title: string;
  status: MeetingResearchPlaybookStatus;
  surface: ResearchWorkflowStage["surface"] | "review";
  evidence: string;
  next_action: string;
  privacy_boundary: string;
}

export interface MeetingResearchActionQueueItem {
  id:
    | "add-meeting-context"
    | "attach-transcript-page"
    | "extract-action-items"
    | "link-company-page"
    | "link-related-report"
    | "create-meeting-tracker"
    | "review-follow-up-candidates";
  title: string;
  status: MeetingResearchPlaybookStatus;
  applies_to: MeetingResearchPlaybookStepId[];
  reason: string;
  suggested_destination: string;
}

export interface MeetingResearchPlaybook {
  format: "zhinote-meeting-research-playbook";
  format_version: 1;
  playbook_status: "local-meeting-playbook-only";
  privacy_note: string;
  boundary: {
    local_playbook_only: true;
    reads_meeting_follow_up_report: true;
    reads_research_workflow_schema: true;
    reads_page_text: false;
    includes_page_text: false;
    includes_transcript_text: false;
    includes_recording_bytes: false;
    includes_participant_details: false;
    includes_meeting_passcodes: false;
    includes_database_row_values: false;
    joins_calls: false;
    records_audio: false;
    publishes_notes: false;
    writes_workspace_data: false;
    connects_cloud_services: false;
    uploads_data: false;
    enables_ai: false;
  };
  summary: {
    workflow_steps: number;
    ready_steps: number;
    partial_steps: number;
    missing_steps: number;
    manual_confirmation_steps: number;
    action_queue_items: number;
    candidate_meetings: number;
    tracker_databases: number;
    transcript_gaps: number;
    action_item_gaps: number;
    relation_gates: number;
  };
  workflow: {
    module_route: string;
    primary_database_preset: string;
    primary_assets: string[];
    required_relation_kinds: string[];
    key_tracker_fields: string[];
  };
  steps: MeetingResearchPlaybookStep[];
  action_queue: MeetingResearchActionQueueItem[];
}

export function buildMeetingResearchPlaybook(
  followUp: MeetingFollowUpReport
): MeetingResearchPlaybook {
  const workflow = getResearchWorkflowSpec("meeting");
  const steps = buildPlaybookSteps(followUp);
  const actionQueue = buildActionQueue(followUp);

  return {
    format: "zhinote-meeting-research-playbook",
    format_version: 1,
    playbook_status: "local-meeting-playbook-only",
    privacy_note:
      "由会议跟进报告和共享研究工作流结构在本地生成。这个行动手册不读取或导出页面正文、转录稿文本、录音字节、参会人详情、会议密码、数据库行值、云端数据、AI 提示词、token 或凭证。",
    boundary: {
      local_playbook_only: true,
      reads_meeting_follow_up_report: true,
      reads_research_workflow_schema: true,
      reads_page_text: false,
      includes_page_text: false,
      includes_transcript_text: false,
      includes_recording_bytes: false,
      includes_participant_details: false,
      includes_meeting_passcodes: false,
      includes_database_row_values: false,
      joins_calls: false,
      records_audio: false,
      publishes_notes: false,
      writes_workspace_data: false,
      connects_cloud_services: false,
      uploads_data: false,
      enables_ai: false,
    },
    summary: {
      workflow_steps: steps.length,
      ready_steps: steps.filter((step) => step.status === "ready").length,
      partial_steps: steps.filter((step) => step.status === "partial").length,
      missing_steps: steps.filter((step) => step.status === "missing").length,
      manual_confirmation_steps: steps.filter(
        (step) => step.status === "manual-confirmation"
      ).length,
      action_queue_items: actionQueue.length,
      candidate_meetings: followUp.summary.follow_up_items,
      tracker_databases: followUp.summary.tracker_databases,
      transcript_gaps: followUp.summary.missing_transcripts,
      action_item_gaps: followUp.summary.missing_action_items,
      relation_gates:
        followUp.summary.missing_company_links + followUp.summary.missing_report_links,
    },
    workflow: {
      module_route: workflow.module_route,
      primary_database_preset: workflow.primary_database_preset,
      primary_assets: workflow.primary_assets,
      required_relation_kinds: workflow.required_relation_kinds,
      key_tracker_fields: workflow.key_tracker_fields,
    },
    steps,
    action_queue: actionQueue,
  };
}

function buildPlaybookSteps(
  followUp: MeetingFollowUpReport
): MeetingResearchPlaybookStep[] {
  const hasMeetingPages = followUp.summary.meeting_pages > 0;

  return [
    {
      id: "meeting-context",
      title: "会议背景",
      status: hasMeetingPages ? "partial" : "missing",
      surface: "database",
      evidence: hasMeetingPages
        ? `${followUp.summary.meeting_pages} 个会议页可继续补平台、组织者、公司、议程和研究问题。`
        : "还没有会议页，无法建立会议背景和研究问题。",
      next_action:
        "为每场会议补齐平台、组织者、公司、会议类型、议程、关键问题和会前材料链接。",
      privacy_boundary:
        "只提示背景字段结构，不导出会议链接、参会人详情、会议密码或页面正文。",
    },
    {
      id: "transcript-review",
      title: getMeetingFollowUpStageLabel("transcript-review"),
      status: statusFromGap(
        hasMeetingPages,
        followUp.summary.missing_transcripts
      ),
      surface: "page",
      evidence:
        followUp.summary.missing_transcripts > 0
          ? `${followUp.summary.missing_transcripts} 个会议页缺少转录稿结构。`
          : hasMeetingPages
            ? "会议页已经识别到转录稿结构。"
            : "还没有会议页，无法检查转录结构。",
      next_action:
        "把 transcript page 或录音索引连接到会议页，再人工标记关键表述、开放问题和可信度。",
      privacy_boundary:
        "只检查是否存在转录稿结构，不导出转录稿文本或录音字节。",
    },
    {
      id: "action-items",
      title: getMeetingFollowUpStageLabel("action-items"),
      status: statusFromGap(
        hasMeetingPages,
        followUp.summary.missing_action_items
      ),
      surface: "database",
      evidence:
        followUp.summary.missing_action_items > 0
          ? `${followUp.summary.missing_action_items} 个会议页缺少行动项或跟进结构。`
          : hasMeetingPages
            ? "会议页已经识别到行动项或跟进结构。"
            : "还没有会议页，无法检查行动项。",
      next_action:
        "提取开放问题、负责人、模型调整、报告补读和下次跟进时间，放入本地行动项区或会议跟踪表。",
      privacy_boundary:
        "只输出行动项结构缺口，不导出行动项正文、负责人个人信息或数据库行值。",
    },
    {
      id: "company-linking",
      title: "公司关联",
      status: statusFromGap(
        hasMeetingPages,
        followUp.summary.missing_company_links
      ),
      surface: "relation",
      evidence:
        followUp.summary.missing_company_links > 0
          ? `${followUp.summary.missing_company_links} 个会议页缺少公司页面关联。`
          : hasMeetingPages
            ? "会议页已经识别到公司关联结构。"
            : "还没有会议页，无法检查公司关联。",
      next_action:
        "把会议页或会议跟踪表行连接到公司主页，方便从公司视角回看管理层会议、专家电话会和后续问题。",
      privacy_boundary:
        "只提示关系结构，不导出公司研究正文、会议正文或数据库行值。",
    },
    {
      id: "report-linking",
      title: "报告关联",
      status: statusFromGap(
        hasMeetingPages,
        followUp.summary.missing_report_links
      ),
      surface: "relation",
      evidence:
        followUp.summary.missing_report_links > 0
          ? `${followUp.summary.missing_report_links} 个会议页缺少相关报告关联。`
          : hasMeetingPages
            ? "会议页已经识别到相关报告结构。"
            : "还没有会议页，无法检查报告关联。",
      next_action:
        "把会议结论连接到来源报告、后续备忘录或业绩复盘，形成报告-会议-公司闭环。",
      privacy_boundary:
        "只提示关系结构，不导出报告正文、会议正文或文件字节。",
    },
    {
      id: "meeting-tracker",
      title: "会议跟踪表",
      status: followUp.summary.tracker_databases > 0 ? "ready" : "missing",
      surface: "database",
      evidence:
        followUp.summary.tracker_databases > 0
          ? `${followUp.summary.tracker_databases} 个会议跟踪表可用于统一管理状态、平台、行动项和 relation。`
          : "还没有会议跟踪表，无法集中管理会议状态和关系字段。",
      next_action:
        "创建会议跟踪表，并保留会议页、转录稿页面、行动项、公司页和关联报告字段。",
      privacy_boundary:
        "只检查数据库元数据，不读取或导出数据库行值。",
    },
    {
      id: "follow-up-cadence",
      title: "复盘节奏",
      status:
        followUp.summary.follow_up_items > 0
          ? "manual-confirmation"
          : hasMeetingPages
            ? "ready"
            : "missing",
      surface: "review",
      evidence:
        followUp.summary.follow_up_items > 0
          ? `${followUp.summary.follow_up_items} 个会议候选项需要人工复核和排序。`
          : hasMeetingPages
            ? "当前没有结构性会议跟进缺口。"
            : "还没有会议页，无法建立会议复盘节奏。",
      next_action:
        "每周复核会议跟进，确认哪些开放问题进入公司页、报告库、模型更新或下一次会议准备。",
      privacy_boundary:
        "只提示复盘节奏，不自动发布会议纪要、调用 AI、入会或录音。",
    },
  ];
}

function buildActionQueue(
  followUp: MeetingFollowUpReport
): MeetingResearchActionQueueItem[] {
  const queue: MeetingResearchActionQueueItem[] = [];

  if (followUp.summary.meeting_pages === 0) {
    queue.push(actionItem("add-meeting-context", ["meeting-context"]));
  }
  if (followUp.summary.missing_transcripts > 0) {
    queue.push(actionItem("attach-transcript-page", ["transcript-review"]));
  }
  if (followUp.summary.missing_action_items > 0) {
    queue.push(actionItem("extract-action-items", ["action-items"]));
  }
  if (followUp.summary.missing_company_links > 0) {
    queue.push(actionItem("link-company-page", ["company-linking"]));
  }
  if (followUp.summary.missing_report_links > 0) {
    queue.push(actionItem("link-related-report", ["report-linking"]));
  }
  if (followUp.summary.tracker_databases === 0) {
    queue.push(actionItem("create-meeting-tracker", ["meeting-tracker"]));
  }
  if (followUp.summary.follow_up_items > 0) {
    queue.push({
      id: "review-follow-up-candidates",
      title: "复核会议候选项",
      status: "manual-confirmation",
      applies_to: [
        "transcript-review",
        "action-items",
        "company-linking",
        "report-linking",
        "follow-up-cadence",
      ],
      reason: `${followUp.summary.follow_up_items} 个会议页还有转录稿、行动项或关系缺口。`,
      suggested_destination: "会议跟进队列",
    });
  }

  return queue;
}

function actionItem(
  id: Exclude<MeetingResearchActionQueueItem["id"], "review-follow-up-candidates">,
  appliesTo: MeetingResearchPlaybookStepId[]
): MeetingResearchActionQueueItem {
  const map: Record<
    typeof id,
    Omit<MeetingResearchActionQueueItem, "id" | "applies_to">
  > = {
    "add-meeting-context": {
      title: "补会议背景",
      status: "missing",
      reason: "会议研究需要先知道平台、组织者、公司、议程和核心研究问题。",
      suggested_destination: "新建会议纪要",
    },
    "attach-transcript-page": {
      title: "连接转录稿页面",
      status: "missing",
      reason: "转录稿是提取管理层表述、专家观点和开放问题的基础材料。",
      suggested_destination: "会议页转录稿区",
    },
    "extract-action-items": {
      title: "提取行动项",
      status: "missing",
      reason: "会议后需要明确开放问题、模型调整、补读报告和下次跟进动作。",
      suggested_destination: "会议页行动项或会议跟踪表",
    },
    "link-company-page": {
      title: "补公司关系",
      status: "missing",
      reason: "会议需要回到公司研究页，才方便从公司维度追踪管理层和专家观点。",
      suggested_destination: "公司关系字段",
    },
    "link-related-report": {
      title: "补报告关系",
      status: "missing",
      reason: "会议结论需要连接来源报告、后续备忘录或业绩复盘，避免孤立存放。",
      suggested_destination: "相关报告关系",
    },
    "create-meeting-tracker": {
      title: "创建会议跟踪表",
      status: "missing",
      reason: "会议跟踪表统一承载日期、平台、状态、行动项、转录稿和关系字段。",
      suggested_destination: "创建会议跟踪表",
    },
  };

  return {
    id,
    applies_to: appliesTo,
    ...map[id],
  };
}

function statusFromGap(
  hasMeetingPages: boolean,
  missingCount: number
): MeetingResearchPlaybookStatus {
  if (!hasMeetingPages) return "missing";
  return missingCount > 0 ? "missing" : "ready";
}
