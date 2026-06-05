import type { ReportConversionReviewReport } from "@/lib/reports/reportConversionReview";
import type { ReportConnectionPlan } from "@/lib/reports/reportConnectionPlan";
import type { ReportFormatCoverageReport } from "@/lib/reports/reportFormatCoverage";
import type { ReportFormatPlaybook } from "@/lib/reports/reportFormatPlaybook";
import type { ReportIntakeReport } from "@/lib/reports/reportIntake";
import type { ReportReviewQueueReport } from "@/lib/reports/reportReviewQueue";

export type ReportDecisionSummaryStatus =
  | "available-local"
  | "requires-owner-confirmation"
  | "blocked";

export interface ReportDecisionSummaryInput {
  intake: ReportIntakeReport;
  formatPlaybook: ReportFormatPlaybook;
  formatCoverage: ReportFormatCoverageReport;
  conversionReview: ReportConversionReviewReport;
  reviewQueue: ReportReviewQueueReport;
  connectionPlan: ReportConnectionPlan;
}

export interface ReportDecisionSummaryItem {
  id:
    | "html-page-native-preview"
    | "markdown-editable-page-import"
    | "pdf-office-conversion-review"
    | "tracker-relation-intake"
    | "cloud-ai-external-resource-boundary";
  title: string;
  status: ReportDecisionSummaryStatus;
  answer: string;
  evidence: string;
  next_action: string;
  route: string;
  target_section_id: string;
  allowed_now: boolean;
  requires_owner_confirmation: boolean;
  blocks_report_externalization: boolean;
  writes_workspace_data: false;
  reads_file_bytes: false;
  reads_file_text: false;
  reads_page_body_text: false;
  uploads_data: false;
  enables_ai: false;
}

export interface ReportDecisionSummary {
  format: "zhinote-report-decision-summary";
  format_version: 1;
  summary_status: "local-report-owner-review";
  current_state: "local-report-owner-review";
  current_conclusion: string;
  privacy_note: string;
  boundary: {
    local_summary_only: true;
    reads_report_intake_summary: true;
    reads_format_route_summary: true;
    reads_review_queue_summary: true;
    reads_connection_plan_summary: true;
    reads_file_names: false;
    reads_file_bytes: false;
    reads_file_text: false;
    reads_page_body_text: false;
    reads_database_rows: false;
    writes_workspace_data: false;
    creates_database_rows: false;
    loads_external_resources: false;
    connects_cloud_services: false;
    uploads_data: false;
    enables_ai: false;
  };
  summary: {
    intake_items: number;
    html_reports: number;
    markdown_notes: number;
    spreadsheet_candidates: number;
    review_needed_items: number;
    blocked_items: number;
    confirmation_queue_items: number;
    relation_suggestions: number;
    report_trackers: number;
    active_confirmation_groups: number;
  };
  can_create_local_report_pages_now: true;
  can_preview_html_reports_now: true;
  can_import_markdown_editable_now: true;
  can_review_pdf_office_locally_now: true;
  can_write_tracker_rows_without_manual_click_now: false;
  can_bulk_import_spreadsheet_now: false;
  can_load_external_html_resources_now: false;
  can_send_reports_to_ai_now: false;
  can_sync_report_files_now: false;
  safe_local_work: string[];
  blocked_work: string[];
  required_owner_decisions: string[];
  top_blockers: string[];
  decisions: ReportDecisionSummaryItem[];
  forbidden_actions: string[];
  required_verification_commands: string[];
}

export function buildReportDecisionSummary(
  input: ReportDecisionSummaryInput
): ReportDecisionSummary {
  const summary = {
    intake_items: input.intake.summary.intake_items,
    html_reports: input.formatPlaybook.summary.html_reports,
    markdown_notes: input.formatPlaybook.summary.markdown_notes,
    spreadsheet_candidates: input.intake.summary.spreadsheet_candidates,
    review_needed_items:
      input.reviewQueue.summary.review_needed_items +
      input.conversionReview.summary.review_needed_items,
    blocked_items:
      input.reviewQueue.summary.blocked_items +
      input.conversionReview.summary.blocked_items +
      input.formatCoverage.summary.blocked_gaps,
    confirmation_queue_items:
      input.formatPlaybook.summary.confirmation_queue_items +
      input.reviewQueue.summary.confirmation_required_items,
    relation_suggestions: input.connectionPlan.summary.suggestions,
    report_trackers: input.connectionPlan.summary.report_trackers,
    active_confirmation_groups:
      input.formatCoverage.summary.active_confirmation_groups,
  };

  const conversionNeedsReview = summary.review_needed_items > 0;
  const trackerReady = summary.report_trackers > 0;

  return {
    format: "zhinote-report-decision-summary",
    format_version: 1,
    summary_status: "local-report-owner-review",
    current_state: "local-report-owner-review",
    current_conclusion:
      "报告库现在可以继续本地创建页面、原生展示 HTML/PDF、导入 Markdown、复核 Office/Notebook 转换，并把单个报告接入跟踪表；批量表格入库、HTML 外部资源、AI 总结、云同步和文件外发仍保持关闭，必须由你确认。",
    privacy_note:
      "由聚合后的报告工作流摘要在本地生成。不包含文件名、报告标题、页面文本、文件字节、抽取后的文件文本、数据库行值、提示词、token、凭证、云端数据或 AI 输出。",
    boundary: {
      local_summary_only: true,
      reads_report_intake_summary: true,
      reads_format_route_summary: true,
      reads_review_queue_summary: true,
      reads_connection_plan_summary: true,
      reads_file_names: false,
      reads_file_bytes: false,
      reads_file_text: false,
      reads_page_body_text: false,
      reads_database_rows: false,
      writes_workspace_data: false,
      creates_database_rows: false,
      loads_external_resources: false,
      connects_cloud_services: false,
      uploads_data: false,
      enables_ai: false,
    },
    summary,
    can_create_local_report_pages_now: true,
    can_preview_html_reports_now: true,
    can_import_markdown_editable_now: true,
    can_review_pdf_office_locally_now: true,
    can_write_tracker_rows_without_manual_click_now: false,
    can_bulk_import_spreadsheet_now: false,
    can_load_external_html_resources_now: false,
    can_send_reports_to_ai_now: false,
    can_sync_report_files_now: false,
    safe_local_work: [
      "上传 HTML、PDF、Markdown、Office、Notebook、压缩包和媒体文件时，先创建本地页面与文件预览块。",
      "HTML Page 预览继续使用沙盒 iframe；外部图片、脚本、样式、字体和 frame 默认阻止。",
      "Markdown 可编辑导入可以直接生成页面内容，同时保留本地原文件动作收据。",
      "PDF、Word、PPT、Excel、EPUB、RTF 和 Notebook 先进入本地预览、转换复核或复核队列。",
    ],
    blocked_work: [
      "不能默认加载 HTML 报告里的远程资源或执行外部脚本。",
      "不能默认把 Excel/CSV/ODS 批量写入数据库行。",
      "不能把报告正文、文件文本、文件字节、文件名或页面正文发送给 AI 服务。",
      "不能自动同步报告文件、生成分享链接、执行 Notebook 或解包写入工作区。",
    ],
    required_owner_decisions: [
      "确认某个 HTML 报告是否值得开启外部资源，默认继续关闭。",
      "确认转换后的 Word/PPT/Excel/Notebook 是否保真，再把结论写入页面或跟踪表。",
      "确认表格入库的字段、行数、目标数据库、回滚边界，并输入确认文本。",
      "确认 AI、云同步或外部分享前的发送内容预览、权限检查和审计事件。",
    ],
    top_blockers: buildTopBlockers(summary),
    decisions: [
      {
        id: "html-page-native-preview",
        title: "HTML Page 预览",
        status: "available-local",
        answer: "本地可做",
        evidence: `${summary.html_reports} 个 HTML 报告已经在入库队列/行动手册中识别；HTML 仍是 AI 可视化报告的首选原生展示格式。`,
        next_action:
          "从报告页打开沙盒预览，先读图表和结论；外部资源保持关闭。",
        route: "/modules/reports",
        target_section_id: "reports-preview-routing",
        allowed_now: true,
        requires_owner_confirmation: false,
        blocks_report_externalization: false,
        writes_workspace_data: false,
        reads_file_bytes: false,
        reads_file_text: false,
        reads_page_body_text: false,
        uploads_data: false,
        enables_ai: false,
      },
      {
        id: "markdown-editable-page-import",
        title: "Markdown 可编辑导入",
        status: "available-local",
        answer: "直接导入",
        evidence: `${summary.markdown_notes} 个 Markdown 笔记已经进入格式 playbook；Markdown 是个人笔记的首选可编辑源格式。`,
        next_action:
          "用报告库顶部的导入 Markdown 笔记按钮创建可编辑页面，再继续补充块、关系和摘要。",
        route: "/modules/reports",
        target_section_id: "reports-create-assets",
        allowed_now: true,
        requires_owner_confirmation: false,
        blocks_report_externalization: false,
        writes_workspace_data: false,
        reads_file_bytes: false,
        reads_file_text: false,
        reads_page_body_text: false,
        uploads_data: false,
        enables_ai: false,
      },
      {
        id: "pdf-office-conversion-review",
        title: "PDF / Office 复核",
        status: conversionNeedsReview
          ? "requires-owner-confirmation"
          : "available-local",
        answer: conversionNeedsReview ? "先复核" : "暂无阻塞",
        evidence: `${summary.review_needed_items} 个需复核项需要关注转换保真、公式、图表、批注、幻灯片顺序或 Notebook 输出。`,
        next_action:
          "对照原生预览和转换结果，确认关键结论不丢失后再写入页面、备忘录或跟踪表。",
        route: "/modules/reports",
        target_section_id: "reports-conversion-review",
        allowed_now: !conversionNeedsReview,
        requires_owner_confirmation: conversionNeedsReview,
        blocks_report_externalization: false,
        writes_workspace_data: false,
        reads_file_bytes: false,
        reads_file_text: false,
        reads_page_body_text: false,
        uploads_data: false,
        enables_ai: false,
      },
      {
        id: "tracker-relation-intake",
        title: "跟踪表与关系",
        status: "requires-owner-confirmation",
        answer: trackerReady ? "单条确认后写" : "先建跟踪表",
        evidence: `${summary.relation_suggestions} 个关系建议，${summary.report_trackers} 个报告跟踪表可用；写入行必须通过单条点击。`,
        next_action:
          "先确认报告页关系、格式、状态、来源和核心结论，再创建单条本地跟踪表行。",
        route: "/modules/reports",
        target_section_id: "reports-tracker-intake",
        allowed_now: false,
        requires_owner_confirmation: true,
        blocks_report_externalization: false,
        writes_workspace_data: false,
        reads_file_bytes: false,
        reads_file_text: false,
        reads_page_body_text: false,
        uploads_data: false,
        enables_ai: false,
      },
      {
        id: "cloud-ai-external-resource-boundary",
        title: "AI、云同步与外部资源边界",
        status: "blocked",
        answer: "保持关闭",
        evidence: `${summary.confirmation_queue_items} 个格式或复核队列确认项仍在本地闸门后面；报告文件、正文和文件名不外发。`,
        next_action:
          "只有在发送内容预览、权限检查、审计事件和确认文本齐备后，才讨论 AI、云同步、分享或外部资源。",
        route: "/modules/sync",
        target_section_id: "sync-ai-provider-boundary",
        allowed_now: false,
        requires_owner_confirmation: true,
        blocks_report_externalization: true,
        writes_workspace_data: false,
        reads_file_bytes: false,
        reads_file_text: false,
        reads_page_body_text: false,
        uploads_data: false,
        enables_ai: false,
      },
    ],
    forbidden_actions: [
      "load_html_external_resources_without_confirmation",
      "send_report_text_or_file_bytes_to_ai",
      "sync_report_files_to_cloud",
      "bulk_import_spreadsheet_without_typed_confirmation",
      "auto_create_report_tracker_rows",
      "export_file_names_from_report_decision_summary",
      "execute_notebook_code",
      "unzip_archive_into_workspace",
    ],
    required_verification_commands: [
      "npm run verify:file-preview",
      "npm run verify:research-workflow",
      "npm run lint",
      "npm run build",
    ],
  };
}

function buildTopBlockers(summary: ReportDecisionSummary["summary"]) {
  const blockers = [
    `${summary.active_confirmation_groups} 个活跃格式组需要你确认。`,
    `${summary.spreadsheet_candidates} 个表格候选仍禁止默认批量入库。`,
    `${summary.blocked_items} 个阻塞项来自旧版、未知格式或明确 gap。`,
  ];

  if (summary.report_trackers === 0) {
    blockers.push("还没有报告跟踪表时，关系入库只能先停在建表/补字段步骤。");
  }

  return blockers;
}
