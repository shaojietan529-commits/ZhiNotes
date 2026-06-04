import type {
  FilePreviewReadinessReport,
  FilePreviewReadinessRoute,
} from "@/lib/files/filePreviewReadiness";
import type { FilePreviewSupportLevel } from "@/lib/files/filePreviewCapabilities";
import type {
  ReportFormatCoverageReport,
  ReportFormatCoverageRow,
} from "@/lib/reports/reportFormatCoverage";
import type { ReportReviewQueueReport } from "@/lib/reports/reportReviewQueue";

export type FilePreviewRoutingLaneId =
  | "native-preview"
  | "editable-import"
  | "database-import"
  | "metadata-review"
  | "download-retain"
  | "gap-review";

export type FilePreviewRoutingStatus =
  | "native-ready"
  | "external-confirmation"
  | "converted-review"
  | "database-confirmation"
  | "metadata-review"
  | "download-retain"
  | "blocked-limited"
  | "unsupported";

export type FilePreviewDisplaySurface =
  | "sandboxed-iframe"
  | "browser-native"
  | "converted-html"
  | "metadata-list"
  | "download-retain";

export interface FilePreviewRoutingLane {
  id: FilePreviewRoutingLaneId;
  title: string;
  description: string;
  route_count: number;
  active_items: number;
  confirmation_routes: number;
  privacy_boundary: string;
}

export interface FilePreviewRoutingRoute {
  id: string;
  label: string;
  lane_id: FilePreviewRoutingLaneId;
  support_level: FilePreviewSupportLevel | "unknown";
  status: FilePreviewRoutingStatus;
  display_surface: FilePreviewDisplaySurface;
  extensions: string[];
  active_items: number;
  route_present_in_readiness: boolean;
  confirmation_required: boolean;
  editable_import_available: boolean;
  database_import_candidate: boolean;
  opens_external_resources: false;
  writes_workspace_data: false;
  primary_action: string;
  secondary_action: string;
  gap: string | null;
  privacy_boundary: string;
}

export interface FilePreviewRoutingStep {
  id: string;
  order: number;
  title: string;
  route: string;
  target_section_id: string;
  reason: string;
  completion_signal: string;
}

export interface FilePreviewRoutingPacket {
  format: "zhinote-file-preview-routing-packet";
  format_version: 1;
  packet_status: "local-preview-routing-only";
  route_verdict: "ready-for-local-preview";
  canonical_container: "zhinote-page";
  native_report_format: "html";
  editable_note_format: "markdown";
  database_source_format: "spreadsheet";
  privacy_note: string;
  boundary: {
    local_packet_only: true;
    reads_file_preview_readiness: true;
    reads_format_coverage: true;
    reads_review_queue: true;
    reads_file_names: false;
    reads_file_bytes: false;
    reads_file_text: false;
    reads_page_body_text: false;
    includes_file_names: false;
    includes_database_row_values: false;
    writes_workspace_data: false;
    loads_external_resources: false;
    creates_database_rows: false;
    connects_cloud_services: false;
    uploads_data: false;
    enables_ai: false;
  };
  summary: {
    routes: number;
    active_routes: number;
    active_items: number;
    native_routes: number;
    converted_routes: number;
    metadata_routes: number;
    download_retain_routes: number;
    ready_native_routes: number;
    confirmation_routes: number;
    database_import_candidates: number;
    editable_import_routes: number;
    unsupported_routes: number;
    blocked_routes: number;
    review_queue_items: number;
    review_needed_items: number;
    high_risk_queue_items: number;
  };
  lanes: FilePreviewRoutingLane[];
  routes: FilePreviewRoutingRoute[];
  review_sequence: FilePreviewRoutingStep[];
  forbidden_actions: string[];
  required_verification_commands: string[];
}

const LANE_COPY: Record<
  FilePreviewRoutingLaneId,
  Omit<FilePreviewRoutingLane, "route_count" | "active_items" | "confirmation_routes">
> = {
  "native-preview": {
    id: "native-preview",
    title: "原生预览",
    description: "HTML、PDF、图片、音频、视频等尽量在 page 中直接显示。",
    privacy_boundary:
      "原生预览默认仍在本地执行；HTML 外部资源保持阻止，除非用户单独确认。",
  },
  "editable-import": {
    id: "editable-import",
    title: "可编辑导入",
    description: "Markdown、Word、PPT、RTF、EPUB、Notebook 等转为 page 内可编辑内容前先复核。",
    privacy_boundary:
      "本地转换不上传文件内容；导入会写入当前本地 page，需要用户在页面内主动触发。",
  },
  "database-import": {
    id: "database-import",
    title: "表格入库",
    description: "Excel、CSV、TSV、ODS 先预览，再经确认创建本地数据库字段和 rows。",
    privacy_boundary:
      "批量入库前需要 typed confirmation；路由包不包含单元格值或文件 bytes。",
  },
  "metadata-review": {
    id: "metadata-review",
    title: "元数据复核",
    description: "ZIP、未知或低结构文件先看目录、格式和用途，不自动解包。",
    privacy_boundary:
      "只使用格式路线和数量，不列出文件名、不读取压缩包内容或文件 bytes。",
  },
  "download-retain": {
    id: "download-retain",
    title: "本地留存",
    description: "暂不能安全转换的文件保留在本地，提供下载或后续手动转换。",
    privacy_boundary:
      "保留动作只记录 metadata receipt，不上传、不同步、不导出文件名或文件 bytes。",
  },
  "gap-review": {
    id: "gap-review",
    title: "缺口复核",
    description: "未知格式、旧版 Office 和其他限制格式需要先决定是否新增安全路线。",
    privacy_boundary:
      "缺口复核只记录能力矩阵缺口，不执行文件、不连接外部工具或云服务。",
  },
};

const FORBIDDEN_ACTIONS = [
  "load_html_external_resources_without_confirmation",
  "bulk_import_spreadsheet_without_confirmation",
  "send_file_text_to_ai",
  "upload_file_bytes_to_cloud",
  "execute_notebook_code",
  "unzip_archive_into_workspace",
  "auto_create_database_rows",
  "auto_write_page_content",
  "sync_file_bytes",
];

export function buildFilePreviewRoutingPacket(input: {
  readiness: FilePreviewReadinessReport;
  coverage: ReportFormatCoverageReport;
  reviewQueue: ReportReviewQueueReport;
}): FilePreviewRoutingPacket {
  const readinessById = new Map(
    input.readiness.routes.map((route) => [route.id, route])
  );
  const routes = input.coverage.rows.map((row) =>
    buildRoutingRoute(row, readinessById.get(row.id) ?? null)
  );
  const lanes = buildRoutingLanes(routes);

  return {
    format: "zhinote-file-preview-routing-packet",
    format_version: 1,
    packet_status: "local-preview-routing-only",
    route_verdict: "ready-for-local-preview",
    canonical_container: "zhinote-page",
    native_report_format: "html",
    editable_note_format: "markdown",
    database_source_format: "spreadsheet",
    privacy_note:
      "Generated locally from file preview readiness, report format coverage, and report review queue metadata. This routing packet explains how each format should be displayed, imported, retained, or reviewed inside ZhiNotes pages. It does not read file names, file bytes, file text, page body text, database row values, cloud data, AI prompts, tokens, or credentials; it does not write workspace data, load external resources, create database rows, upload data, connect cloud services, or enable AI.",
    boundary: {
      local_packet_only: true,
      reads_file_preview_readiness: true,
      reads_format_coverage: true,
      reads_review_queue: true,
      reads_file_names: false,
      reads_file_bytes: false,
      reads_file_text: false,
      reads_page_body_text: false,
      includes_file_names: false,
      includes_database_row_values: false,
      writes_workspace_data: false,
      loads_external_resources: false,
      creates_database_rows: false,
      connects_cloud_services: false,
      uploads_data: false,
      enables_ai: false,
    },
    summary: {
      routes: routes.length,
      active_routes: routes.filter((route) => route.active_items > 0).length,
      active_items: routes.reduce((total, route) => total + route.active_items, 0),
      native_routes: routes.filter((route) => route.lane_id === "native-preview")
        .length,
      converted_routes: routes.filter(
        (route) => route.support_level === "converted"
      ).length,
      metadata_routes: routes.filter((route) => route.lane_id === "metadata-review")
        .length,
      download_retain_routes: routes.filter(
        (route) => route.lane_id === "download-retain"
      ).length,
      ready_native_routes: routes.filter(
        (route) => route.status === "native-ready"
      ).length,
      confirmation_routes: routes.filter((route) => route.confirmation_required)
        .length,
      database_import_candidates: routes.filter(
        (route) => route.database_import_candidate
      ).length,
      editable_import_routes: routes.filter(
        (route) => route.editable_import_available
      ).length,
      unsupported_routes: routes.filter((route) => route.status === "unsupported")
        .length,
      blocked_routes: routes.filter((route) => route.status === "blocked-limited")
        .length,
      review_queue_items: input.reviewQueue.summary.queue_items,
      review_needed_items: input.reviewQueue.summary.review_needed_items,
      high_risk_queue_items: input.reviewQueue.summary.high_risk_items,
    },
    lanes,
    routes: routes.sort(sortRoutes),
    review_sequence: buildReviewSequence(input, routes),
    forbidden_actions: FORBIDDEN_ACTIONS,
    required_verification_commands: [
      "npm run verify:file-preview",
      "npm run lint",
      "npm run build",
    ],
  };
}

function buildRoutingRoute(
  row: ReportFormatCoverageRow,
  readinessRoute: FilePreviewReadinessRoute | null
): FilePreviewRoutingRoute {
  const status = getRoutingStatus(row, readinessRoute);
  const laneId = getLaneId(status, row);
  const displaySurface = getDisplaySurface(row, status);

  return {
    id: row.id,
    label: row.label,
    lane_id: laneId,
    support_level: row.support_level,
    status,
    display_surface: displaySurface,
    extensions: row.extensions,
    active_items: row.active_items,
    route_present_in_readiness: row.route_present_in_readiness,
    confirmation_required: row.requires_confirmation,
    editable_import_available: canEditableImport(row),
    database_import_candidate: row.id === "spreadsheet",
    opens_external_resources: false,
    writes_workspace_data: false,
    primary_action: getPrimaryAction(row, status),
    secondary_action: getSecondaryAction(row, readinessRoute),
    gap: row.capability_gap,
    privacy_boundary:
      readinessRoute?.privacy_boundary ??
      row.privacy_boundary ??
      "Unknown formats stay local and are not read, executed, uploaded, synced, or sent to AI.",
  };
}

function buildRoutingLanes(routes: FilePreviewRoutingRoute[]) {
  return Object.values(LANE_COPY).map((lane) => {
    const laneRoutes = routes.filter((route) => route.lane_id === lane.id);
    return {
      ...lane,
      route_count: laneRoutes.length,
      active_items: laneRoutes.reduce(
        (total, route) => total + route.active_items,
        0
      ),
      confirmation_routes: laneRoutes.filter(
        (route) => route.confirmation_required
      ).length,
    };
  });
}

function buildReviewSequence(
  input: {
    readiness: FilePreviewReadinessReport;
    coverage: ReportFormatCoverageReport;
    reviewQueue: ReportReviewQueueReport;
  },
  routes: FilePreviewRoutingRoute[]
): FilePreviewRoutingStep[] {
  const firstActiveNative = routes.find(
    (route) => route.active_items > 0 && route.lane_id === "native-preview"
  );
  const firstConverted = routes.find(
    (route) => route.active_items > 0 && route.support_level === "converted"
  );
  const spreadsheet = routes.find((route) => route.id === "spreadsheet");
  const firstGap = routes.find(
    (route) =>
      route.status === "blocked-limited" || route.status === "unsupported"
  );

  return [
    {
      id: "open-native-preview-first",
      order: 1,
      title: "先打开可原生预览的报告",
      route: "/modules/reports",
      target_section_id: "reports-review-queue",
      reason: firstActiveNative
        ? `${firstActiveNative.label} has ${firstActiveNative.active_items} active local items.`
        : "No active native-preview items yet; upload HTML, PDF, or media files to start.",
      completion_signal: "Native previews render inside ZhiNotes page without external resource loading.",
    },
    {
      id: "review-converted-formats",
      order: 2,
      title: "再复核转换类格式",
      route: "/modules/reports",
      target_section_id: "reports-conversion-review",
      reason: firstConverted
        ? `${firstConverted.label} uses converted HTML preview and may lose layout details.`
        : `${input.coverage.summary.active_converted_groups} active converted groups need review.`,
      completion_signal: "Converted previews are checked before editable import or research linking.",
    },
    {
      id: "confirm-spreadsheet-import",
      order: 3,
      title: "表格先确认再入库",
      route: "/modules/reports",
      target_section_id: "reports-format-playbook",
      reason: spreadsheet
        ? `${spreadsheet.active_items} active spreadsheet candidates; bulk import remains gated.`
        : "Spreadsheet route is not present in the current coverage rows.",
      completion_signal: "Field mapping, row count, rollback boundary, and typed confirmation are captured before rows are written.",
    },
    {
      id: "route-gaps-last",
      order: 4,
      title: "最后处理旧版或未知格式",
      route: "/modules/reports",
      target_section_id: "reports-format-coverage",
      reason: firstGap
        ? `${firstGap.label}: ${firstGap.gap ?? "requires manual route review."}`
        : `${input.readiness.summary.blocked_routes} readiness routes are blocked.`,
      completion_signal: "Legacy/unknown formats are retained locally or converted outside ZhiNotes before import.",
    },
  ];
}

function getRoutingStatus(
  row: ReportFormatCoverageRow,
  readinessRoute: FilePreviewReadinessRoute | null
): FilePreviewRoutingStatus {
  if (row.coverage_status === "unsupported-active") return "unsupported";
  if (row.coverage_status === "blocked-limited") return "blocked-limited";
  if (row.id === "html-report" && row.requires_confirmation) {
    return "external-confirmation";
  }
  if (row.id === "spreadsheet") return "database-confirmation";
  if (row.support_level === "converted") return "converted-review";
  if (row.support_level === "metadata") return "metadata-review";
  if (row.support_level === "download-only") return "download-retain";
  if (readinessRoute?.readiness_status === "blocked") return "blocked-limited";
  return "native-ready";
}

function getLaneId(
  status: FilePreviewRoutingStatus,
  row: ReportFormatCoverageRow
): FilePreviewRoutingLaneId {
  if (status === "database-confirmation") return "database-import";
  if (status === "converted-review") return "editable-import";
  if (status === "metadata-review") return "metadata-review";
  if (status === "download-retain") return "download-retain";
  if (status === "blocked-limited" || status === "unsupported") {
    return "gap-review";
  }
  if (row.support_level === "native") return "native-preview";
  return "editable-import";
}

function getDisplaySurface(
  row: ReportFormatCoverageRow,
  status: FilePreviewRoutingStatus
): FilePreviewDisplaySurface {
  if (row.id === "html-report") return "sandboxed-iframe";
  if (status === "native-ready" || status === "external-confirmation") {
    return "browser-native";
  }
  if (status === "converted-review" || status === "database-confirmation") {
    return "converted-html";
  }
  if (status === "metadata-review") return "metadata-list";
  return "download-retain";
}

function canEditableImport(row: ReportFormatCoverageRow) {
  return (
    row.id === "markdown-note" ||
    row.id === "word" ||
    row.id === "presentation" ||
    row.id === "rtf" ||
    row.id === "epub" ||
    row.id === "notebook" ||
    row.id === "media-and-text"
  );
}

function getPrimaryAction(
  row: ReportFormatCoverageRow,
  status: FilePreviewRoutingStatus
) {
  if (status === "native-ready") return "在 page 内原生打开预览。";
  if (status === "external-confirmation") {
    return "先用沙盒 HTML 原生预览，默认不加载外部资源。";
  }
  if (status === "database-confirmation") {
    return "先预览表格，再确认字段、行数和回滚边界。";
  }
  if (status === "converted-review") {
    return "本地转换成 HTML 预览，并人工复核版式/公式/输出。";
  }
  if (status === "metadata-review") {
    return "只查看目录、格式和元数据，不自动解包写入。";
  }
  if (status === "download-retain") return "保留本地原件并记录留存 receipt。";
  if (status === "unsupported") return "先确认来源和用途，再决定是否新增安全路线。";
  return row.recommended_action;
}

function getSecondaryAction(
  row: ReportFormatCoverageRow,
  readinessRoute: FilePreviewReadinessRoute | null
) {
  if (row.id === "spreadsheet") {
    return "需要 typed confirmation 后才允许创建本地数据库 rows。";
  }
  if (row.id === "html-report") {
    return "只有单独确认后才允许外部图片、脚本、样式、字体或 frame。";
  }
  return readinessRoute?.editable_import ?? row.recommended_action;
}

function sortRoutes(a: FilePreviewRoutingRoute, b: FilePreviewRoutingRoute) {
  const activeDelta = b.active_items - a.active_items;
  if (activeDelta !== 0) return activeDelta;

  const laneDelta = laneRank(a.lane_id) - laneRank(b.lane_id);
  if (laneDelta !== 0) return laneDelta;

  return a.label.localeCompare(b.label);
}

function laneRank(lane: FilePreviewRoutingLaneId) {
  if (lane === "native-preview") return 0;
  if (lane === "editable-import") return 1;
  if (lane === "database-import") return 2;
  if (lane === "metadata-review") return 3;
  if (lane === "download-retain") return 4;
  return 5;
}
