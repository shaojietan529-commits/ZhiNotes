import type { PageFileKind } from "@/lib/files/localStore";
import type {
  ReportIntakeItem,
  ReportIntakePriority,
  ReportIntakeReport,
} from "@/lib/reports/reportIntake";

export type ReportReviewQueueWorkstream =
  | "first-pass-reading"
  | "conversion-review"
  | "database-review"
  | "source-triage"
  | "relation-linking"
  | "local-retain";

export type ReportReviewQueueStatus =
  | "ready"
  | "review-needed"
  | "blocked";

export type ReportReviewQueueRisk = "low" | "medium" | "high";

export interface ReportReviewQueueItem {
  id: string;
  intake_item_id: string;
  page_id: string;
  page_title: string;
  file_name: string;
  file_kind: PageFileKind;
  file_size_label: string;
  priority: ReportIntakePriority;
  workstream: ReportReviewQueueWorkstream;
  status: ReportReviewQueueStatus;
  risk: ReportReviewQueueRisk;
  action_label: string;
  evidence: string;
  next_step: string;
  required_confirmation: boolean;
  relation_gaps: string[];
  privacy_boundary: string;
  sort_score: number;
}

export interface ReportReviewQueueGate {
  id:
    | "queue-built-from-intake"
    | "first-pass-reading-focus"
    | "conversion-review-focus"
    | "spreadsheet-database-gate"
    | "relation-linking-gate"
    | "legacy-unknown-block";
  title: string;
  status: ReportReviewQueueStatus;
  evidence: string;
  required_action: string;
}

export interface ReportReviewQueueReport {
  format: "zhinote-report-review-queue";
  format_version: 1;
  queue_status: "local-review-queue-only";
  queue_verdict: "ready-for-local-research-triage";
  privacy_note: string;
  boundary: {
    local_queue_only: true;
    reads_report_intake_metadata: true;
    reads_file_names: true;
    reads_file_bytes: false;
    reads_file_text: false;
    reads_page_body_text: false;
    writes_workspace_data: false;
    loads_external_resources: false;
    connects_cloud_services: false;
    uploads_data: false;
    enables_ai: false;
  };
  summary: {
    queue_items: number;
    ready_items: number;
    review_needed_items: number;
    blocked_items: number;
    high_risk_items: number;
    first_pass_reading_items: number;
    conversion_review_items: number;
    database_review_items: number;
    source_triage_items: number;
    relation_gap_items: number;
    confirmation_required_items: number;
  };
  gates: ReportReviewQueueGate[];
  items: ReportReviewQueueItem[];
}

export function buildReportReviewQueue(
  intake: ReportIntakeReport
): ReportReviewQueueReport {
  const items = intake.items.map(buildQueueItem).sort(sortQueueItems);
  const summary = summarizeQueue(items);

  return {
    format: "zhinote-report-review-queue",
    format_version: 1,
    queue_status: "local-review-queue-only",
    queue_verdict: "ready-for-local-research-triage",
    privacy_note:
      "由报告 intake 元数据在本地生成。队列只使用文件名、文件类型、大小、优先级、预览支持和关联缺口；不读取文件字节、不读取转换后的文件文本、不读取页面正文、不写入工作区、不加载外部资源、不连接云服务、不上传数据、也不启用 AI。",
    boundary: {
      local_queue_only: true,
      reads_report_intake_metadata: true,
      reads_file_names: true,
      reads_file_bytes: false,
      reads_file_text: false,
      reads_page_body_text: false,
      writes_workspace_data: false,
      loads_external_resources: false,
      connects_cloud_services: false,
      uploads_data: false,
      enables_ai: false,
    },
    summary,
    gates: buildQueueGates(summary),
    items,
  };
}

function buildQueueItem(item: ReportIntakeItem): ReportReviewQueueItem {
  const policy = getQueuePolicy(item);
  const relationGaps = item.relation_gaps.filter((gap) => gap !== "待确认");
  const sortScore = getSortScore(item, policy, relationGaps.length);

  return {
    id: `report-review:${item.id}`,
    intake_item_id: item.id,
    page_id: item.page_id,
    page_title: item.page_title,
    file_name: item.file_name,
    file_kind: item.file_kind,
    file_size_label: item.file_size_label,
    priority: item.priority,
    workstream: policy.workstream,
    status: policy.status,
    risk: policy.risk,
    action_label: policy.actionLabel,
    evidence: policy.evidence,
    next_step: relationGaps.length > 0 ? `${policy.nextStep} 然后补 ${relationGaps.join("、")} 关联。` : policy.nextStep,
    required_confirmation: policy.requiredConfirmation,
    relation_gaps: item.relation_gaps,
    privacy_boundary:
      "本地复核队列只使用 intake 元数据；不读取报告正文、文件文本、文件字节、token、凭证、云数据或 AI 输出。",
    sort_score: sortScore,
  };
}

function getQueuePolicy(item: ReportIntakeItem): {
  workstream: ReportReviewQueueWorkstream;
  status: ReportReviewQueueStatus;
  risk: ReportReviewQueueRisk;
  actionLabel: string;
  evidence: string;
  nextStep: string;
  requiredConfirmation: boolean;
} {
  if (isLegacyOffice(item.file_name)) {
    return {
      workstream: "local-retain",
      status: "blocked",
      risk: "high",
      actionLabel: "旧版 Office 留存",
      evidence: "旧版 .doc/.ppt 不能安全地本地转换为可编辑内容。",
      nextStep: "保留原文件并优先转为 .docx/.pptx 后再进入转换复核。",
      requiredConfirmation: false,
    };
  }

  if (item.file_kind === "spreadsheet") {
    return {
      workstream: "database-review",
      status: "review-needed",
      risk: "high",
      actionLabel: "表格入库复核",
      evidence: "Excel/CSV/ODS 可以预览，也可能批量创建字段和行。",
      nextStep: "先确认字段、行数、公式值和回滚边界，再决定是否导入本地数据库。",
      requiredConfirmation: true,
    };
  }

  if (item.file_kind === "html") {
    return {
      workstream: "first-pass-reading",
      status: "ready",
      risk: "medium",
      actionLabel: "阅读 HTML 报告",
      evidence: "HTML 报告可在沙盒 iframe 中原生预览，外部资源默认阻止。",
      nextStep: "先读核心图表、结论和假设变化，不开启外部资源。",
      requiredConfirmation: false,
    };
  }

  if (item.file_kind === "pdf" || item.file_kind === "markdown") {
    return {
      workstream: "first-pass-reading",
      status: "ready",
      risk: item.file_kind === "markdown" ? "low" : "medium",
      actionLabel:
        item.file_kind === "markdown" ? "复盘 Markdown 笔记" : "阅读 PDF 报告",
      evidence:
        item.file_kind === "markdown"
          ? "Markdown 可导入为可编辑 page，也可保留原文件预览。"
          : "PDF 使用浏览器原生预览并保留本地原件。",
      nextStep: "提取核心结论、投资假设影响、模型影响和待回答问题。",
      requiredConfirmation: false,
    };
  }

  if (
    item.file_kind === "word" ||
    item.file_kind === "presentation" ||
    item.file_kind === "rtf" ||
    item.file_kind === "epub" ||
    item.file_kind === "notebook" ||
    item.file_kind === "text" ||
    item.file_kind === "opml"
  ) {
    return {
      workstream: "conversion-review",
      status: "review-needed",
      risk: item.file_kind === "presentation" ? "high" : "medium",
      actionLabel: "转换质量复核",
      evidence: "这个格式依赖本地转换或文本提取，可能丢失复杂版式、图表、公式或输出。",
      nextStep: "对照原文件预览复核转换结果，再把可用结论写入报告页。",
      requiredConfirmation:
        item.file_kind === "word" ||
        item.file_kind === "presentation" ||
        item.file_kind === "epub" ||
        item.file_kind === "notebook",
    };
  }

  if (item.file_kind === "archive" || item.file_kind === "unknown") {
    return {
      workstream: "source-triage",
      status: item.file_kind === "unknown" ? "blocked" : "review-needed",
      risk: item.file_kind === "unknown" ? "high" : "medium",
      actionLabel:
        item.file_kind === "unknown" ? "未知格式分流" : "压缩包目录复核",
      evidence:
        item.file_kind === "unknown"
          ? "未知格式没有明确预览或转换路线。"
          : "ZIP 只做本地目录元数据复核，不自动解包写入工作区。",
      nextStep:
        item.file_kind === "unknown"
          ? "先确认来源和用途，再决定是否新增安全预览路线。"
          : "查看目录后决定是否拆成多个报告资产。",
      requiredConfirmation: false,
    };
  }

  return {
    workstream: "source-triage",
    status: "review-needed",
    risk: "low",
    actionLabel: "来源和用途确认",
    evidence: "媒体或低结构化文件通常需要先确认研究用途。",
    nextStep: "确认来源可信度和是否需要转为标准报告页。",
    requiredConfirmation: false,
  };
}

function summarizeQueue(
  items: ReportReviewQueueItem[]
): ReportReviewQueueReport["summary"] {
  return {
    queue_items: items.length,
    ready_items: countStatus(items, "ready"),
    review_needed_items: countStatus(items, "review-needed"),
    blocked_items: countStatus(items, "blocked"),
    high_risk_items: items.filter((item) => item.risk === "high").length,
    first_pass_reading_items: countWorkstream(items, "first-pass-reading"),
    conversion_review_items: countWorkstream(items, "conversion-review"),
    database_review_items: countWorkstream(items, "database-review"),
    source_triage_items: countWorkstream(items, "source-triage"),
    relation_gap_items: items.filter((item) =>
      item.relation_gaps.some((gap) => gap !== "待确认")
    ).length,
    confirmation_required_items: items.filter(
      (item) => item.required_confirmation
    ).length,
  };
}

function buildQueueGates(
  summary: ReportReviewQueueReport["summary"]
): ReportReviewQueueGate[] {
  return [
    gate(
      "queue-built-from-intake",
      "队列来源",
      summary.queue_items > 0 ? "ready" : "review-needed",
      summary.queue_items > 0
        ? `${summary.queue_items} 个 intake 文件已经进入下一步复核队列。`
        : "还没有 intake 文件，队列暂时为空。",
      "继续通过报告库上传文件，让队列反映真实投研资料。"
    ),
    gate(
      "first-pass-reading-focus",
      "第一遍阅读",
      summary.first_pass_reading_items > 0 ? "ready" : "review-needed",
      `${summary.first_pass_reading_items} 个文件可以直接进入第一遍阅读。`,
      "优先处理 HTML、PDF 和 Markdown，提取核心结论、假设影响和待回答问题。"
    ),
    gate(
      "conversion-review-focus",
      "转换复核",
      summary.conversion_review_items > 0 ? "review-needed" : "ready",
      `${summary.conversion_review_items} 个文件需要检查转换保真度。`,
      "Word、PPT、EPUB、RTF、Notebook 或文本导入后先对照原件复核。"
    ),
    gate(
      "spreadsheet-database-gate",
      "表格入库",
      summary.database_review_items > 0 ? "review-needed" : "ready",
      `${summary.database_review_items} 个表格文件可能进入数据库导入。`,
      "导入前确认字段、行数、公式值、目标表和回滚边界。"
    ),
    gate(
      "relation-linking-gate",
      "关联归档",
      summary.relation_gap_items > 0 ? "review-needed" : "ready",
      `${summary.relation_gap_items} 个文件仍缺公司、会议或备忘录关系。`,
      "完成阅读或转换复核后，把报告页连接到公司、会议、备忘录或组合。"
    ),
    gate(
      "legacy-unknown-block",
      "阻塞格式",
      summary.blocked_items > 0 ? "blocked" : "ready",
      `${summary.blocked_items} 个文件暂时只能留存或分流。`,
      "旧版 Office 和未知格式不要伪装成可编辑导入，先转格式或新增明确安全路线。"
    ),
  ];
}

function gate(
  id: ReportReviewQueueGate["id"],
  title: string,
  status: ReportReviewQueueStatus,
  evidence: string,
  requiredAction: string
): ReportReviewQueueGate {
  return {
    id,
    title,
    status,
    evidence,
    required_action: requiredAction,
  };
}

function getSortScore(
  item: ReportIntakeItem,
  policy: ReturnType<typeof getQueuePolicy>,
  relationGapCount: number
) {
  return (
    priorityScore(item.priority) +
    statusScore(policy.status) +
    riskScore(policy.risk) +
    workstreamScore(policy.workstream) +
    relationGapCount * 5
  );
}

function sortQueueItems(
  a: ReportReviewQueueItem,
  b: ReportReviewQueueItem
) {
  return (
    b.sort_score - a.sort_score ||
    a.file_kind.localeCompare(b.file_kind) ||
    a.file_name.localeCompare(b.file_name)
  );
}

function priorityScore(priority: ReportIntakePriority) {
  if (priority === "high") return 60;
  if (priority === "medium") return 30;
  return 10;
}

function statusScore(status: ReportReviewQueueStatus) {
  if (status === "review-needed") return 25;
  if (status === "ready") return 20;
  return 15;
}

function riskScore(risk: ReportReviewQueueRisk) {
  if (risk === "high") return 20;
  if (risk === "medium") return 10;
  return 0;
}

function workstreamScore(workstream: ReportReviewQueueWorkstream) {
  const scores: Record<ReportReviewQueueWorkstream, number> = {
    "database-review": 20,
    "first-pass-reading": 18,
    "conversion-review": 16,
    "relation-linking": 14,
    "source-triage": 10,
    "local-retain": 6,
  };
  return scores[workstream];
}

function countStatus(
  items: ReportReviewQueueItem[],
  status: ReportReviewQueueStatus
) {
  return items.filter((item) => item.status === status).length;
}

function countWorkstream(
  items: ReportReviewQueueItem[],
  workstream: ReportReviewQueueWorkstream
) {
  return items.filter((item) => item.workstream === workstream).length;
}

function isLegacyOffice(fileName: string) {
  const lower = fileName.toLowerCase();
  return lower.endsWith(".doc") || lower.endsWith(".ppt");
}
