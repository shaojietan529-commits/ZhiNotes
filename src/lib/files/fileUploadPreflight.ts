import {
  FILE_PREVIEW_CAPABILITIES,
  type FilePreviewCapability,
  type FilePreviewSupportLevel,
} from "@/lib/files/filePreviewCapabilities";

export type FileUploadPreflightAction =
  | "native-preview"
  | "editable-import"
  | "database-import"
  | "metadata-review"
  | "download-retain";

export type FileUploadPreflightRisk = "low" | "medium" | "high";

export type FileUploadPreflightGateStatus =
  | "ready"
  | "manual-confirmation"
  | "blocked";

export interface FileUploadPreflightRoute {
  id: string;
  label: string;
  extensions: string[];
  support_level: FilePreviewSupportLevel;
  primary_action: FileUploadPreflightAction;
  upload_entrypoint: "上传报告文件" | "导入 Markdown 笔记";
  page_handling: string;
  preview_result: string;
  editable_result: string;
  database_result: string;
  risk_level: FileUploadPreflightRisk;
  confirmation_required_before_upload: boolean;
  confirmation_required_after_upload: boolean;
  local_receipt_action: "auto-recorded" | "available-after-upload";
  best_fit_use_case: string;
  fallback_or_gap: string | null;
  privacy_boundary: string;
}

export interface FileUploadPreflightGate {
  id: string;
  title: string;
  status: FileUploadPreflightGateStatus;
  evidence: string;
  required_action: string;
}

export interface FileUploadPreflightReport {
  format: "zhinote-file-upload-preflight";
  format_version: 1;
  report_status: "local-capability-preflight-only";
  preflight_verdict: "ready-for-local-file-intake";
  default_container: "zhinote-page";
  primary_formats: {
    ai_visual_report: "html";
    personal_note: "markdown";
    database_source: "spreadsheet";
  };
  privacy_note: string;
  boundary: {
    local_report_only: true;
    reads_capability_metadata: true;
    reads_file_names: false;
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
    capability_groups: number;
    accepted_extension_patterns: number;
    native_groups: number;
    converted_groups: number;
    metadata_groups: number;
    download_only_groups: number;
    low_risk_groups: number;
    medium_risk_groups: number;
    high_risk_groups: number;
    confirmation_after_upload_groups: number;
    limited_groups: number;
    upload_entrypoints: number;
  };
  gates: FileUploadPreflightGate[];
  routes: FileUploadPreflightRoute[];
}

export function buildFileUploadPreflightReport(
  capabilities: FilePreviewCapability[] = FILE_PREVIEW_CAPABILITIES
): FileUploadPreflightReport {
  const routes = capabilities.map(buildPreflightRoute);
  const gates = buildPreflightGates(routes);

  return {
    format: "zhinote-file-upload-preflight",
    format_version: 1,
    report_status: "local-capability-preflight-only",
    preflight_verdict: "ready-for-local-file-intake",
    default_container: "zhinote-page",
    primary_formats: {
      ai_visual_report: "html",
      personal_note: "markdown",
      database_source: "spreadsheet",
    },
    privacy_note:
      "上传前由文件能力矩阵在本地生成。不检查文件名、文件字节、文件文本、页面正文、表格值、token、凭证、云端数据或 AI 输出。",
    boundary: {
      local_report_only: true,
      reads_capability_metadata: true,
      reads_file_names: false,
      reads_file_bytes: false,
      reads_file_text: false,
      reads_page_body_text: false,
      writes_workspace_data: false,
      loads_external_resources: false,
      connects_cloud_services: false,
      uploads_data: false,
      enables_ai: false,
    },
    summary: {
      capability_groups: capabilities.length,
      accepted_extension_patterns: capabilities.reduce(
        (total, capability) => total + capability.extensions.length,
        0
      ),
      native_groups: countSupport(routes, "native"),
      converted_groups: countSupport(routes, "converted"),
      metadata_groups: countSupport(routes, "metadata"),
      download_only_groups: countSupport(routes, "download-only"),
      low_risk_groups: countRisk(routes, "low"),
      medium_risk_groups: countRisk(routes, "medium"),
      high_risk_groups: countRisk(routes, "high"),
      confirmation_after_upload_groups: routes.filter(
        (route) => route.confirmation_required_after_upload
      ).length,
      limited_groups: routes.filter((route) => route.fallback_or_gap).length,
      upload_entrypoints: 2,
    },
    gates,
    routes,
  };
}

function buildPreflightRoute(
  capability: FilePreviewCapability
): FileUploadPreflightRoute {
  const primaryAction = getPrimaryAction(capability);
  const riskLevel = getRiskLevel(capability, primaryAction);
  const isMarkdown = capability.id === "markdown-note";

  return {
    id: capability.id,
    label: capability.label,
    extensions: capability.extensions,
    support_level: capability.support_level,
    primary_action: primaryAction,
    upload_entrypoint: isMarkdown ? "导入 Markdown 笔记" : "上传报告文件",
    page_handling: getPageHandling(capability, primaryAction),
    preview_result: capability.preview,
    editable_result: capability.editable_import,
    database_result: capability.database_import,
    risk_level: riskLevel,
    confirmation_required_before_upload: false,
    confirmation_required_after_upload:
      capability.id === "html-report" ||
      capability.id === "spreadsheet" ||
      (capability.support_level === "converted" &&
        capability.id !== "markdown-note"),
    local_receipt_action:
      capability.support_level === "metadata" ||
      capability.support_level === "download-only" ||
      capability.limitation
        ? "available-after-upload"
        : "auto-recorded",
    best_fit_use_case: getBestFitUseCase(capability),
    fallback_or_gap: capability.limitation ?? getFallback(capability),
    privacy_boundary: capability.privacy_boundary,
  };
}

function buildPreflightGates(
  routes: FileUploadPreflightRoute[]
): FileUploadPreflightGate[] {
  return [
    gate(
      "pre-upload-locality",
      "上传前本地边界",
      "ready",
      "预检只读取格式能力矩阵，不读取文件名、文件正文、字节或页面正文。",
      "用户选择文件前先展示处理路线；真正读取文件只发生在本地预览创建时。"
    ),
    gate(
      "html-report-native-first",
      "HTML 报告原生优先",
      "manual-confirmation",
      "HTML 是 AI 可视化报告的首选原生格式，但外部资源默认阻止。",
      "上传后如需加载远程图片、脚本、字体、样式或 iframe，必须单独确认。"
    ),
    gate(
      "markdown-editable-first",
      "Markdown 笔记可编辑优先",
      "ready",
      "Markdown 可以直接导入为可编辑 page，同时保留本地原文件预览块。",
      "个人笔记优先使用导入 Markdown 笔记入口；复杂 MDX 仍需人工复核。"
    ),
    gate(
      "spreadsheet-write-gate",
      "表格入库写入门槛",
      "manual-confirmation",
      "表格文件可以预览；导入数据库会创建字段和行，属于批量本地写入。",
      "导入数据库前必须确认目标表、字段、行数、回滚边界，并输入确认文本。"
    ),
    gate(
      "converted-fidelity-review",
      "转换保真复核",
      "manual-confirmation",
      `${routes.filter((route) => route.support_level === "converted").length} 个格式组依赖本地转换，可能丢失复杂样式、公式、批注或交互。`,
      "转换为可编辑内容后先对照原预览复核，再进入投研结论和数据库关联。"
    ),
    gate(
      "legacy-office-retain",
      "旧版 Office 留存",
      "blocked",
      "旧版 .doc 和 .ppt 在安全本地转换器确定前，只保留本地下载和元数据收据。",
      "建议先转为 .docx 或 .pptx；否则保持 download-retain，不伪装成可编辑导入。"
    ),
    gate(
      "cloud-ai-separation",
      "云同步和 AI 隔离",
      "blocked",
      "上传预检不启用云同步、AI、外部资源加载或服务器审计写入。",
      "任何文件外发、AI 处理、云同步或外部资源加载都要走单独权限确认。"
    ),
  ];
}

function getPrimaryAction(
  capability: FilePreviewCapability
): FileUploadPreflightAction {
  if (capability.id === "spreadsheet") return "database-import";
  if (
    capability.id === "markdown-note" ||
    capability.id === "word" ||
    capability.id === "rtf" ||
    capability.id === "notebook" ||
    capability.id === "opml"
  ) {
    return "editable-import";
  }
  if (capability.support_level === "metadata") return "metadata-review";
  if (capability.support_level === "download-only" || capability.limitation) {
    return "download-retain";
  }
  return "native-preview";
}

function getRiskLevel(
  capability: FilePreviewCapability,
  action: FileUploadPreflightAction
): FileUploadPreflightRisk {
  if (capability.limitation || action === "database-import") return "high";
  if (capability.id === "html-report" || capability.support_level === "converted") {
    return "medium";
  }
  return "low";
}

function getPageHandling(
  capability: FilePreviewCapability,
  action: FileUploadPreflightAction
) {
  if (capability.id === "markdown-note") {
    return "创建可编辑 Markdown 笔记页，并保留本地原文件预览块。";
  }
  if (capability.id === "html-report") {
    return "创建报告页并嵌入沙盒 HTML 原生预览块。";
  }
  if (action === "database-import") {
    return "先创建报告页本地预览；如需入库，再走数据库导入确认。";
  }
  if (action === "download-retain") {
    return "创建报告页并保留本地文件块，默认只提供下载和留存收据。";
  }
  if (action === "metadata-review") {
    return "创建报告页并显示元数据预览，不解包写入工作区。";
  }
  return "创建报告页并嵌入本地文件预览块。";
}

function getBestFitUseCase(capability: FilePreviewCapability) {
  if (capability.id === "html-report") return "AI 生成的可视化投研报告。";
  if (capability.id === "markdown-note") return "自己写的可编辑投研笔记。";
  if (capability.id === "pdf") return "卖方报告、公告、会议材料和不可编辑原件。";
  if (capability.id === "spreadsheet") return "模型、KPI、持仓、财务数据和跟踪表来源。";
  if (capability.id === "word") return "外部备忘录、访谈记录和长文档。";
  if (capability.id === "presentation") return "路演材料、专家会 slide 和公司材料。";
  if (capability.id === "archive") return "打包资料、本地留存和后续人工拆分。";
  if (capability.id === "notebook") return "研究脚本输出和可复核分析 notebook。";
  return "补充资料、媒体、文本、代码或结构化大纲。";
}

function getFallback(capability: FilePreviewCapability) {
  if (capability.support_level === "metadata") {
    return "只显示元数据，不自动写入解包内容。";
  }
  if (capability.support_level === "download-only") {
    return "只本地留存和下载。";
  }
  return null;
}

function countSupport(
  routes: FileUploadPreflightRoute[],
  supportLevel: FilePreviewSupportLevel
) {
  return routes.filter((route) => route.support_level === supportLevel).length;
}

function countRisk(
  routes: FileUploadPreflightRoute[],
  risk: FileUploadPreflightRisk
) {
  return routes.filter((route) => route.risk_level === risk).length;
}

function gate(
  id: string,
  title: string,
  status: FileUploadPreflightGateStatus,
  evidence: string,
  requiredAction: string
): FileUploadPreflightGate {
  return {
    id,
    title,
    status,
    evidence,
    required_action: requiredAction,
  };
}
