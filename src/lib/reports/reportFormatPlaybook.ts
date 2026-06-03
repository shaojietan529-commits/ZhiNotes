import {
  FILE_PREVIEW_CAPABILITIES,
  getFilePreviewCapabilityByKind,
  type FilePreviewSupportLevel,
} from "@/lib/files/filePreviewCapabilities";
import type { PageFileKind } from "@/lib/files/localStore";
import type {
  ReportIntakeItem,
  ReportIntakePriority,
  ReportIntakeReport,
  ReportIntakeStage,
} from "@/lib/reports/reportIntake";

export type ReportFormatAction =
  | "native-preview"
  | "editable-import"
  | "database-import"
  | "metadata-review"
  | "download-retain";

export type ReportFormatConfirmationStatus =
  | "required"
  | "recommended"
  | "not-needed";

export interface ReportNativeFormatStrategy {
  canonical_container: "zhinote-page";
  raw_original_storage: "local-indexeddb-file";
  primary_generated_report_format: "html";
  primary_written_note_format: "markdown";
  database_source_format: "spreadsheet";
  editable_page_format: "tiptap-html";
  rationale: string;
}

export interface ReportFormatRoute {
  id: string;
  kind: PageFileKind;
  label: string;
  support_level: FilePreviewSupportLevel | "unknown";
  item_count: number;
  priority: ReportIntakePriority;
  stage: ReportIntakeStage;
  recommended_action: ReportFormatAction;
  page_handling: string;
  native_preview: string;
  editable_import: string;
  database_import: string;
  confirmation_status: ReportFormatConfirmationStatus;
  confirmation_reason: string;
  privacy_boundary: string;
  relation_target: string[];
  sample_file_names: string[];
}

export interface ReportFormatConfirmation {
  id: string;
  title: string;
  status: ReportFormatConfirmationStatus;
  applies_to_kinds: PageFileKind[];
  reason: string;
}

export interface ReportFormatPlaybook {
  format: "zhinote-report-format-playbook";
  format_version: 1;
  playbook_status: "local-format-playbook-only";
  privacy_note: string;
  boundary: {
    local_playbook_only: true;
    reads_report_intake_metadata: true;
    reads_file_bytes: false;
    reads_file_text: false;
    reads_page_body_text: false;
    writes_workspace_data: false;
    loads_external_resources: false;
    connects_cloud_services: false;
    uploads_data: false;
    enables_ai: false;
  };
  native_format_strategy: ReportNativeFormatStrategy;
  summary: {
    intake_items: number;
    format_routes: number;
    native_preview_routes: number;
    editable_import_routes: number;
    database_import_routes: number;
    metadata_review_routes: number;
    confirmation_queue_items: number;
    html_reports: number;
    markdown_notes: number;
    spreadsheet_candidates: number;
  };
  confirmation_queue: ReportFormatConfirmation[];
  routes: ReportFormatRoute[];
}

export function buildReportFormatPlaybook(
  intake: ReportIntakeReport
): ReportFormatPlaybook {
  const routes = buildFormatRoutes(intake.items);
  const confirmationQueue = buildConfirmationQueue(routes);

  return {
    format: "zhinote-report-format-playbook",
    format_version: 1,
    playbook_status: "local-format-playbook-only",
    privacy_note:
      "Generated locally from report intake metadata. This playbook uses file names, kinds, sizes, preview support, and relation gaps only. It does not read file bytes, read converted file text, read page body text, write workspace data, load external resources, connect cloud services, upload data, or enable AI.",
    boundary: {
      local_playbook_only: true,
      reads_report_intake_metadata: true,
      reads_file_bytes: false,
      reads_file_text: false,
      reads_page_body_text: false,
      writes_workspace_data: false,
      loads_external_resources: false,
      connects_cloud_services: false,
      uploads_data: false,
      enables_ai: false,
    },
    native_format_strategy: {
      canonical_container: "zhinote-page",
      raw_original_storage: "local-indexeddb-file",
      primary_generated_report_format: "html",
      primary_written_note_format: "markdown",
      database_source_format: "spreadsheet",
      editable_page_format: "tiptap-html",
      rationale:
        "ZhiNotes page remains the canonical research container. HTML is the best native preview target for AI-generated visual reports, Markdown is the best editable source for written notes, spreadsheets feed local databases after confirmation, and original files remain attached locally for auditability.",
    },
    summary: {
      intake_items: intake.summary.intake_items,
      format_routes: routes.length,
      native_preview_routes: routes.filter(
        (route) => route.recommended_action === "native-preview"
      ).length,
      editable_import_routes: routes.filter(
        (route) => route.recommended_action === "editable-import"
      ).length,
      database_import_routes: routes.filter(
        (route) => route.recommended_action === "database-import"
      ).length,
      metadata_review_routes: routes.filter(
        (route) => route.recommended_action === "metadata-review"
      ).length,
      confirmation_queue_items: confirmationQueue.length,
      html_reports: routes.find((route) => route.kind === "html")?.item_count ?? 0,
      markdown_notes:
        routes.find((route) => route.kind === "markdown")?.item_count ?? 0,
      spreadsheet_candidates:
        routes.find((route) => route.kind === "spreadsheet")?.item_count ?? 0,
    },
    confirmation_queue: confirmationQueue,
    routes,
  };
}

function buildFormatRoutes(items: ReportIntakeItem[]): ReportFormatRoute[] {
  const grouped = items.reduce<Record<string, ReportIntakeItem[]>>(
    (groups, item) => {
      const key = item.file_kind;
      groups[key] = [...(groups[key] ?? []), item];
      return groups;
    },
    {}
  );

  const routes = Object.entries(grouped).map(([kind, group]) => {
    const normalizedKind = kind as PageFileKind;
    const capability = getFilePreviewCapabilityByKind(normalizedKind);
    const routePolicy = getRoutePolicy(normalizedKind);

    return {
      id: `format-route-${normalizedKind}`,
      kind: normalizedKind,
      label:
        capability?.label ??
        normalizedKind.charAt(0).toUpperCase() + normalizedKind.slice(1),
      support_level: capability?.support_level ?? "unknown",
      item_count: group.length,
      priority: highestPriority(group.map((item) => item.priority)),
      stage: routePolicy.stage,
      recommended_action: routePolicy.action,
      page_handling: routePolicy.pageHandling,
      native_preview: capability?.preview ?? "未知格式默认仅保留本地附件和下载入口。",
      editable_import:
        capability?.editable_import ?? "未知格式暂不导入为可编辑块。",
      database_import: capability?.database_import ?? "不适用。",
      confirmation_status: routePolicy.confirmationStatus,
      confirmation_reason: routePolicy.confirmationReason,
      privacy_boundary:
        capability?.privacy_boundary ??
        "未知格式默认只做本地保存和下载，不读取文件内容、不上传。",
      relation_target: routePolicy.relationTarget,
      sample_file_names: group
        .slice(0, 3)
        .map((item) => item.file_name)
        .filter(Boolean),
    } satisfies ReportFormatRoute;
  });

  return routes.sort(
    (a, b) =>
      actionRank(a.recommended_action) - actionRank(b.recommended_action) ||
      priorityRank(a.priority) - priorityRank(b.priority) ||
      b.item_count - a.item_count ||
      a.label.localeCompare(b.label)
  );
}

function buildConfirmationQueue(
  routes: ReportFormatRoute[]
): ReportFormatConfirmation[] {
  const confirmations: ReportFormatConfirmation[] = [];

  const htmlRoute = routes.find((route) => route.kind === "html");
  if (htmlRoute) {
    confirmations.push({
      id: "html-external-resource-confirmation",
      title: "HTML 外部资源确认",
      status: "required",
      applies_to_kinds: ["html"],
      reason:
        "HTML 报告可以原生展示，但外部图片、脚本、样式、字体和 frame 默认必须阻止。",
    });
  }

  const spreadsheetRoute = routes.find((route) => route.kind === "spreadsheet");
  if (spreadsheetRoute) {
    confirmations.push({
      id: "spreadsheet-database-import-confirmation",
      title: "表格入库确认",
      status: "required",
      applies_to_kinds: ["spreadsheet"],
      reason:
        "Excel/CSV/ODS 可以转成本地数据库，但批量写入前必须确认字段、行数、表名和回滚边界。",
    });
  }

  const editableKinds = routes
    .filter((route) => route.recommended_action === "editable-import")
    .map((route) => route.kind);
  if (editableKinds.length > 0) {
    confirmations.push({
      id: "editable-import-review",
      title: "可编辑导入复核",
      status: "recommended",
      applies_to_kinds: editableKinds,
      reason:
        "Markdown、Word、PPT、RTF、EPUB、Notebook 等转换后可能丢失复杂布局，需要人工复核。",
    });
  }

  const metadataKinds = routes
    .filter((route) => route.recommended_action === "metadata-review")
    .map((route) => route.kind);
  if (metadataKinds.length > 0) {
    confirmations.push({
      id: "metadata-only-review",
      title: "元数据-only 复核",
      status: "recommended",
      applies_to_kinds: metadataKinds,
      reason:
        "ZIP、未知格式和多媒体文件先确认来源、用途和是否需要拆分，不自动读取或解包。",
    });
  }

  return confirmations;
}

function getRoutePolicy(kind: PageFileKind): {
  action: ReportFormatAction;
  stage: ReportIntakeStage;
  pageHandling: string;
  confirmationStatus: ReportFormatConfirmationStatus;
  confirmationReason: string;
  relationTarget: string[];
} {
  if (kind === "html") {
    return {
      action: "native-preview",
      stage: "reading-review",
      pageHandling: "保留为报告页内的沙盒 HTML 预览，并补核心结论和关联研究。",
      confirmationStatus: "required",
      confirmationReason: "开启任何外部资源前必须 typed confirmation。",
      relationTarget: ["公司", "会议", "memo", "业绩复盘"],
    };
  }

  if (kind === "markdown") {
    return {
      action: "editable-import",
      stage: "reading-review",
      pageHandling: "优先导入为可编辑块，作为长期笔记源格式。",
      confirmationStatus: "not-needed",
      confirmationReason: "本地文本导入不需要外部连接。",
      relationTarget: ["公司", "memo", "任务"],
    };
  }

  if (kind === "spreadsheet") {
    return {
      action: "database-import",
      stage: "database-review",
      pageHandling: "先预览表格，再决定是否批量导入本地数据库。",
      confirmationStatus: "required",
      confirmationReason: "批量写入数据库前必须确认字段、行数、表名和回滚边界。",
      relationTarget: ["数据库", "公司", "模型假设"],
    };
  }

  if (
    kind === "word" ||
    kind === "presentation" ||
    kind === "rtf" ||
    kind === "epub" ||
    kind === "notebook" ||
    kind === "opml" ||
    kind === "text"
  ) {
    return {
      action: "editable-import",
      stage: "reading-review",
      pageHandling: "本地转换为页面内容后复核格式，再提取结论和待办。",
      confirmationStatus: "recommended",
      confirmationReason: "本地转换可能丢失复杂布局，建议导入后人工复核。",
      relationTarget: ["公司", "memo", "会议"],
    };
  }

  if (kind === "pdf") {
    return {
      action: "native-preview",
      stage: "reading-review",
      pageHandling: "使用浏览器原生 PDF 预览，关键结论手动写入报告页。",
      confirmationStatus: "not-needed",
      confirmationReason: "原生 PDF 预览留在本地页面，不需要外部连接。",
      relationTarget: ["公司", "memo", "会议"],
    };
  }

  if (
    kind === "archive" ||
    kind === "image" ||
    kind === "audio" ||
    kind === "video" ||
    kind === "unknown"
  ) {
    return {
      action: "metadata-review",
      stage: "source-triage",
      pageHandling: "先查看本地元数据或原生媒体预览，不自动解包、不转写、不外发。",
      confirmationStatus: "recommended",
      confirmationReason: "先确认来源可信度、用途和是否需要拆分为标准报告资产。",
      relationTarget: ["来源", "公司", "会议"],
    };
  }

  return {
    action: "download-retain",
    stage: "source-triage",
    pageHandling: "保留本地附件和下载入口，等待手动确认处理方式。",
    confirmationStatus: "recommended",
    confirmationReason: "未知处理路线前只保留本地附件。",
    relationTarget: ["来源"],
  };
}

function highestPriority(values: ReportIntakePriority[]): ReportIntakePriority {
  if (values.includes("high")) return "high";
  if (values.includes("medium")) return "medium";
  return "low";
}

function actionRank(action: ReportFormatAction) {
  const ranks: Record<ReportFormatAction, number> = {
    "native-preview": 0,
    "editable-import": 1,
    "database-import": 2,
    "metadata-review": 3,
    "download-retain": 4,
  };
  return ranks[action];
}

function priorityRank(priority: ReportIntakePriority) {
  const ranks: Record<ReportIntakePriority, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };
  return ranks[priority];
}

export function getPromisedReportFileKinds() {
  return FILE_PREVIEW_CAPABILITIES.flatMap((capability) => capability.kinds);
}
