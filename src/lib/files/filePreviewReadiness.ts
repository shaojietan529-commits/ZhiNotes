import {
  FILE_PREVIEW_CAPABILITIES,
  type FilePreviewCapability,
  type FilePreviewSupportLevel,
} from "@/lib/files/filePreviewCapabilities";

export type FilePreviewReadinessStatus =
  | "ready"
  | "manual-confirmation"
  | "blocked";

export interface FilePreviewReadinessGate {
  id: string;
  title: string;
  status: FilePreviewReadinessStatus;
  evidence: string;
  required_action: string;
}

export interface FilePreviewReadinessRoute {
  id: string;
  label: string;
  support_level: FilePreviewSupportLevel;
  extensions: string[];
  native_display: string;
  editable_import: string;
  database_import: string;
  privacy_boundary: string;
  readiness_status: FilePreviewReadinessStatus;
  requires_confirmation: boolean;
  gap: string | null;
}

export interface FilePreviewReadinessReport {
  format: "zhinote-file-preview-readiness-report";
  format_version: 1;
  report_status: "local-file-preview-readiness-only";
  readiness_verdict: "ready-with-local-boundaries";
  canonical_container: "zhinote-page";
  preferred_native_report_format: "html";
  preferred_written_note_format: "markdown";
  preferred_database_source_format: "spreadsheet";
  can_preview_files_locally_now: true;
  can_upload_files_now: false;
  can_load_external_resources_now: false;
  can_run_ai_on_files_now: false;
  can_sync_files_now: false;
  can_bulk_import_without_confirmation_now: false;
  privacy_note: string;
  boundary: {
    local_report_only: true;
    reads_capability_metadata: true;
    reads_file_bytes: false;
    reads_file_text: false;
    reads_page_body_text: false;
    loads_external_resources: false;
    writes_workspace_data: false;
    connects_cloud_services: false;
    uploads_data: false;
    enables_ai: false;
  };
  summary: {
    capability_groups: number;
    extension_patterns: number;
    native_routes: number;
    converted_routes: number;
    metadata_routes: number;
    download_only_routes: number;
    ready_routes: number;
    manual_confirmation_routes: number;
    blocked_routes: number;
    confirmation_gates: number;
  };
  routes: FilePreviewReadinessRoute[];
  gates: FilePreviewReadinessGate[];
  recommended_native_format: {
    report: "html";
    note: "markdown";
    database: "spreadsheet";
    rationale: string;
  };
}

export function buildFilePreviewReadinessReport(
  capabilities: FilePreviewCapability[] = FILE_PREVIEW_CAPABILITIES
): FilePreviewReadinessReport {
  const routes = capabilities.map((capability) => buildReadinessRoute(capability));
  const gates = buildReadinessGates(routes);

  return {
    format: "zhinote-file-preview-readiness-report",
    format_version: 1,
    report_status: "local-file-preview-readiness-only",
    readiness_verdict: "ready-with-local-boundaries",
    canonical_container: "zhinote-page",
    preferred_native_report_format: "html",
    preferred_written_note_format: "markdown",
    preferred_database_source_format: "spreadsheet",
    can_preview_files_locally_now: true,
    can_upload_files_now: false,
    can_load_external_resources_now: false,
    can_run_ai_on_files_now: false,
    can_sync_files_now: false,
    can_bulk_import_without_confirmation_now: false,
    privacy_note:
      "这个报告只在本地根据文件预览能力元数据生成；不会读取文件字节、转换后的文件文本或页面正文，不会加载外部资源、写入工作区、连接云服务、上传数据或启用 AI。",
    boundary: {
      local_report_only: true,
      reads_capability_metadata: true,
      reads_file_bytes: false,
      reads_file_text: false,
      reads_page_body_text: false,
      loads_external_resources: false,
      writes_workspace_data: false,
      connects_cloud_services: false,
      uploads_data: false,
      enables_ai: false,
    },
    summary: {
      capability_groups: capabilities.length,
      extension_patterns: capabilities.reduce(
        (total, capability) => total + capability.extensions.length,
        0
      ),
      native_routes: countSupport(routes, "native"),
      converted_routes: countSupport(routes, "converted"),
      metadata_routes: countSupport(routes, "metadata"),
      download_only_routes: countSupport(routes, "download-only"),
      ready_routes: routes.filter((route) => route.readiness_status === "ready")
        .length,
      manual_confirmation_routes: routes.filter(
        (route) => route.readiness_status === "manual-confirmation"
      ).length,
      blocked_routes: routes.filter(
        (route) => route.readiness_status === "blocked"
      ).length,
      confirmation_gates: gates.filter(
        (gate) => gate.status === "manual-confirmation"
      ).length,
    },
    routes,
    gates,
    recommended_native_format: {
      report: "html",
      note: "markdown",
      database: "spreadsheet",
      rationale:
        "ZhiNotes page 是统一研究容器；HTML 最适合承载 AI 生成的可视化报告，Markdown 最适合自己写可编辑笔记，表格文件适合在确认字段、行数和回滚方案后进入数据库。",
    },
  };
}

function buildReadinessRoute(
  capability: FilePreviewCapability
): FilePreviewReadinessRoute {
  const requiresConfirmation =
    capability.id === "html-report" ||
    capability.id === "spreadsheet" ||
    capability.support_level === "converted";

  return {
    id: capability.id,
    label: capability.label,
    support_level: capability.support_level,
    extensions: capability.extensions,
    native_display: capability.preview,
    editable_import: capability.editable_import,
    database_import: capability.database_import,
    privacy_boundary: capability.privacy_boundary,
    readiness_status: getRouteStatus(capability),
    requires_confirmation: requiresConfirmation,
    gap: capability.limitation ?? getDefaultGap(capability),
  };
}

function buildReadinessGates(
  routes: FilePreviewReadinessRoute[]
): FilePreviewReadinessGate[] {
  return [
    gate(
      "local-preview-coverage",
      "本地预览覆盖",
      "ready",
      `${routes.length} 个格式组已经纳入本地预览、转换、元数据复核或下载留存路线。`,
      "每新增一种上传类型，都要同步登记到能力矩阵和验证脚本。"
    ),
    gate(
      "html-external-resources",
      "HTML 外部资源",
      "manual-confirmation",
      "HTML 报告可以原生渲染，但外部脚本、图片、字体、样式和 iframe 默认保持阻止。",
      "只有在用户明确确认后，才能加载 HTML 报告里的远程资源。"
    ),
    gate(
      "spreadsheet-database-import",
      "表格数据库导入",
      "manual-confirmation",
      "Excel、CSV、TSV 和 ODS 可以在字段、行数和回滚方案复核后导入本地数据库。",
      "任何批量数据库写入前，都要要求用户输入确认文本。"
    ),
    gate(
      "editable-conversion-review",
      "可编辑转换复核",
      "manual-confirmation",
      `${routes.filter((route) => route.support_level === "converted").length} 条转换路线可能丢失部分版式或交互细节。`,
      "Markdown、Word、PPT、RTF、EPUB 和 notebook 转换后，需要先复核再作为可编辑研究笔记。"
    ),
    gate(
      "legacy-office-gap",
      "旧版 Office 缺口",
      "blocked",
      "旧版 .doc 和 .ppt 在安全本地转换器确定前，只能本地留存和下载。",
      "后续要么接入明确的旧版转换支持，要么继续在 UI 里如实标注不能编辑导入。"
    ),
    gate(
      "cloud-ai-boundary",
      "云端和 AI 边界",
      "blocked",
      "文件预览是本地能力；AI 执行、云同步和外部资源加载都属于单独的高风险动作。",
      "在发送内容预览、权限检查、审计事件和用户确认齐备前，不把文件内容发送给 AI 或云服务。"
    ),
  ];
}

function getRouteStatus(
  capability: FilePreviewCapability
): FilePreviewReadinessStatus {
  if (capability.limitation) return "blocked";
  if (
    capability.id === "html-report" ||
    capability.id === "spreadsheet" ||
    capability.support_level === "converted"
  ) {
    return "manual-confirmation";
  }
  return "ready";
}

function getDefaultGap(capability: FilePreviewCapability) {
  if (capability.support_level === "metadata") {
    return "只复核元数据；不会把压缩包内容解包写入工作区。";
  }
  if (capability.support_level === "download-only") {
    return "仅本地留存和下载。";
  }
  return null;
}

function countSupport(
  routes: FilePreviewReadinessRoute[],
  supportLevel: FilePreviewSupportLevel
) {
  return routes.filter((route) => route.support_level === supportLevel).length;
}

function gate(
  id: string,
  title: string,
  status: FilePreviewReadinessStatus,
  evidence: string,
  requiredAction: string
): FilePreviewReadinessGate {
  return {
    id,
    title,
    status,
    evidence,
    required_action: requiredAction,
  };
}
