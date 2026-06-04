import {
  FILE_PREVIEW_CAPABILITIES,
  type FilePreviewSupportLevel,
} from "@/lib/files/filePreviewCapabilities";
import {
  formatFileSize,
  type PageFileKind,
  type StoredPageFile,
} from "@/lib/files/localStore";

export type FileLibraryLaneId =
  | "native-preview"
  | "editable-import"
  | "database-import"
  | "metadata-review"
  | "download-retain"
  | "cloud-ai-boundary";

export type FileLibraryActionStatus =
  | "ready-to-preview"
  | "needs-conversion-review"
  | "needs-database-confirmation"
  | "metadata-only"
  | "download-retain"
  | "blocked-boundary";

export type FileLibraryPriority = "high" | "medium" | "low";

export interface FileLibraryLane {
  id: FileLibraryLaneId;
  title: string;
  description: string;
  route: string;
  file_count: number;
  action_count: number;
  high_priority_count: number;
  privacy_boundary: string;
}

export interface FileLibraryFormatGroup {
  id: string;
  label: string;
  kinds: PageFileKind[];
  extensions: string[];
  support_level: FilePreviewSupportLevel;
  local_file_count: number;
  route_lane_id: FileLibraryLaneId;
  confirmation_required: boolean;
  next_action: string;
  privacy_boundary: string;
}

export interface FileLibraryFileItem {
  local_file_id: string;
  display_label: string;
  file_name_included: false;
  kind: PageFileKind;
  kind_label: string;
  mime_type_group: string;
  size_bytes: number;
  size_label: string;
  created_at: string;
  support_level: FilePreviewSupportLevel | "unknown";
  lane_id: FileLibraryLaneId;
  confirmation_required: boolean;
  editable_import_candidate: boolean;
  database_import_candidate: boolean;
  external_resource_confirmation_required: boolean;
  download_only: boolean;
  next_action: string;
  privacy_boundary: string;
}

export interface FileLibraryAction {
  id: string;
  lane_id: FileLibraryLaneId;
  file_id: string | null;
  title: string;
  priority: FileLibraryPriority;
  status: FileLibraryActionStatus;
  evidence: string;
  next_action: string;
  action_route: string;
  route_label: string;
  requires_manual_confirmation: boolean;
  writes_workspace_data: false;
  privacy_boundary: string;
}

export interface FileLibraryReviewStep {
  id: string;
  order: number;
  title: string;
  route: string;
  reason: string;
  completion_signal: string;
}

export interface FileLibraryWorkbenchReport {
  format: "zhinote-file-library-workbench";
  format_version: 1;
  report_status: "local-file-library-only";
  privacy_note: string;
  boundary: {
    local_report_only: true;
    reads_file_metadata: true;
    reads_capability_metadata: true;
    reads_file_names: true;
    reads_file_names_for_local_ui: true;
    reads_file_bytes: false;
    reads_file_text: false;
    reads_page_body_text: false;
    includes_file_names: false;
    includes_file_bytes: false;
    includes_file_text: false;
    writes_workspace_data: false;
    loads_external_resources: false;
    imports_database_values: false;
    creates_database_rows: false;
    connects_cloud_services: false;
    uploads_data: false;
    enables_ai: false;
  };
  summary: {
    files: number;
    total_bytes: number;
    total_size_label: string;
    native_files: number;
    converted_files: number;
    metadata_files: number;
    download_retain_files: number;
    html_reports: number;
    markdown_notes: number;
    spreadsheet_candidates: number;
    office_files: number;
    unknown_files: number;
    confirmation_required_files: number;
    actions: number;
    high_priority_actions: number;
  };
  lanes: FileLibraryLane[];
  format_groups: FileLibraryFormatGroup[];
  files: FileLibraryFileItem[];
  actions: FileLibraryAction[];
  review_sequence: FileLibraryReviewStep[];
  forbidden_actions: string[];
  required_verification_commands: string[];
}

const LANE_META: Record<
  FileLibraryLaneId,
  Omit<FileLibraryLane, "file_count" | "action_count" | "high_priority_count">
> = {
  "native-preview": {
    id: "native-preview",
    title: "原生预览",
    description: "HTML、PDF、图片、音频、视频和文本尽量在 page 里直接展示。",
    route: "/modules/reports",
    privacy_boundary:
      "原生预览仍留在本地 page；HTML 外部资源默认阻止，需单独确认。",
  },
  "editable-import": {
    id: "editable-import",
    title: "可编辑导入",
    description: "Markdown、Word、PPT、RTF、EPUB、Notebook 转成页面内容前先复核。",
    route: "/modules/reports",
    privacy_boundary:
      "转换在浏览器本地完成；工作台不导出文件文本或转换后的正文。",
  },
  "database-import": {
    id: "database-import",
    title: "表格入库",
    description: "Excel、CSV、TSV、ODS 是数据库候选，但必须经 typed confirmation。",
    route: "/modules/databases",
    privacy_boundary:
      "工作台不读取 spreadsheet cell values；真实入库只在页面预览或数据库页确认后发生。",
  },
  "metadata-review": {
    id: "metadata-review",
    title: "元数据复核",
    description: "ZIP、未知或低结构文件先复核类型、用途和保留策略。",
    route: "/modules/files",
    privacy_boundary:
      "只使用文件 kind、大小、时间和能力矩阵，不解包、不读取 bytes。",
  },
  "download-retain": {
    id: "download-retain",
    title: "本地留存",
    description: "旧版 Office 或暂不支持格式保留在本地，等待转换或手动下载。",
    route: "/modules/files",
    privacy_boundary:
      "不删除、不移动、不上传文件；保留策略只记录本地 metadata。",
  },
  "cloud-ai-boundary": {
    id: "cloud-ai-boundary",
    title: "云和 AI 边界",
    description: "文件外发、AI 处理、云同步和外部资源加载必须单独确认。",
    route: "/modules/sync",
    privacy_boundary:
      "文件库不会把文件 bytes、文本或名称发送给云端、AI provider 或外部资源。",
  },
};

const FORBIDDEN_ACTIONS = [
  "upload_file_bytes_without_confirmation",
  "send_file_text_to_ai",
  "load_html_external_resources_without_confirmation",
  "bulk_import_spreadsheet_without_typed_confirmation",
  "delete_or_overwrite_local_files",
  "export_file_names_from_workbench",
  "export_file_bytes_from_workbench",
  "sync_files_to_cloud",
  "execute_notebook_code",
  "unzip_archive_into_workspace",
];

export function buildFileLibraryWorkbenchReport(
  storedFiles: StoredPageFile[]
): FileLibraryWorkbenchReport {
  const fileItems = storedFiles
    .map((file, index) => buildFileItem(file, index))
    .sort(sortFiles);
  const formatGroups = buildFormatGroups(storedFiles);
  const actions = buildActions(fileItems).sort(sortActions);
  const lanes = buildLanes(fileItems, actions);

  return {
    format: "zhinote-file-library-workbench",
    format_version: 1,
    report_status: "local-file-library-only",
    privacy_note:
      "Generated locally from IndexedDB file metadata and the file preview capability matrix. The local UI may show file names to the user, but the exported workbench report redacts file names and does not include file bytes, file text, page body text, spreadsheet values, cloud data, AI prompts, tokens, or credentials. It does not write workspace data, load external resources, import database values, connect cloud services, upload data, or enable AI.",
    boundary: {
      local_report_only: true,
      reads_file_metadata: true,
      reads_capability_metadata: true,
      reads_file_names: true,
      reads_file_names_for_local_ui: true,
      reads_file_bytes: false,
      reads_file_text: false,
      reads_page_body_text: false,
      includes_file_names: false,
      includes_file_bytes: false,
      includes_file_text: false,
      writes_workspace_data: false,
      loads_external_resources: false,
      imports_database_values: false,
      creates_database_rows: false,
      connects_cloud_services: false,
      uploads_data: false,
      enables_ai: false,
    },
    summary: summarize(fileItems, actions),
    lanes,
    format_groups: formatGroups,
    files: fileItems,
    actions,
    review_sequence: buildReviewSequence(fileItems, actions),
    forbidden_actions: FORBIDDEN_ACTIONS,
    required_verification_commands: [
      "npm run verify:file-preview",
      "npm run verify:modules",
      "npm run lint",
      "npm run build",
    ],
  };
}

function buildFileItem(file: StoredPageFile, index: number): FileLibraryFileItem {
  const capability = getCapabilityForKind(file.kind);
  const supportLevel = capability?.support_level ?? "unknown";
  const laneId = getLaneForKind(file.kind, supportLevel);
  const confirmationRequired =
    file.kind === "html" ||
    file.kind === "spreadsheet" ||
    supportLevel === "converted" ||
    supportLevel === "metadata" ||
    supportLevel === "download-only" ||
    supportLevel === "unknown";

  return {
    local_file_id: file.id,
    display_label: `${getKindLabel(file.kind)} #${index + 1}`,
    file_name_included: false,
    kind: file.kind,
    kind_label: getKindLabel(file.kind),
    mime_type_group: getMimeTypeGroup(file.mimeType),
    size_bytes: file.size,
    size_label: formatFileSize(file.size),
    created_at: file.createdAt,
    support_level: supportLevel,
    lane_id: laneId,
    confirmation_required: confirmationRequired,
    editable_import_candidate: isEditableImportCandidate(file.kind),
    database_import_candidate: file.kind === "spreadsheet",
    external_resource_confirmation_required: file.kind === "html",
    download_only:
      supportLevel === "download-only" ||
      supportLevel === "unknown" ||
      isLegacyRetainCandidate(file),
    next_action: getNextAction(file.kind, supportLevel),
    privacy_boundary:
      "Exported file item redacts file name and never includes file bytes, file text, converted preview text, page body text, spreadsheet values, or external URLs.",
  };
}

function buildFormatGroups(
  storedFiles: StoredPageFile[]
): FileLibraryFormatGroup[] {
  return FILE_PREVIEW_CAPABILITIES.map((capability) => {
    const localFileCount = storedFiles.filter((file) =>
      capability.kinds.includes(file.kind)
    ).length;
    return {
      id: capability.id,
      label: capability.label,
      kinds: capability.kinds,
      extensions: capability.extensions,
      support_level: capability.support_level,
      local_file_count: localFileCount,
      route_lane_id: getLaneForKind(capability.kinds[0], capability.support_level),
      confirmation_required:
        capability.id === "html-report" ||
        capability.id === "spreadsheet" ||
        capability.support_level === "converted" ||
        capability.support_level === "metadata" ||
        Boolean(capability.limitation),
      next_action:
        localFileCount > 0
          ? getCapabilityNextAction(capability.id)
          : "当前没有本地文件；能力路线保留在格式矩阵中。",
      privacy_boundary: capability.privacy_boundary,
    };
  });
}

function buildActions(files: FileLibraryFileItem[]): FileLibraryAction[] {
  const actions: FileLibraryAction[] = [];

  if (files.length === 0) {
    actions.push({
      id: "file-library:add-first-file",
      lane_id: "native-preview",
      file_id: null,
      title: "通过报告模块添加第一个本地文件",
      priority: "high",
      status: "ready-to-preview",
      evidence: "当前 IndexedDB 文件库为空。",
      next_action:
        "打开报告库，上传 HTML、Markdown、PDF、Excel、Word、PPT 或其他本地文件并生成 page preview block。",
      action_route: "/modules/reports",
      route_label: "打开报告库",
      requires_manual_confirmation: true,
      writes_workspace_data: false,
      privacy_boundary:
        "This action only opens the Reports module. File selection remains a separate local user action.",
    });
    return actions;
  }

  for (const file of files) {
    if (file.external_resource_confirmation_required) {
      actions.push({
        id: `file-library:html:${file.local_file_id}`,
        lane_id: "native-preview",
        file_id: file.local_file_id,
        title: "HTML 报告外部资源默认阻止",
        priority: "medium",
        status: "ready-to-preview",
        evidence: `${file.kind_label} · ${file.size_label}`,
        next_action:
          "在页面 file preview block 中本地查看；只有明确确认后才允许加载远程图片、脚本、字体、样式或 iframe。",
        action_route: "/modules/reports",
        route_label: "打开报告库",
        requires_manual_confirmation: true,
        writes_workspace_data: false,
        privacy_boundary:
          "The file library does not load external resources or export file names, bytes, text, or URL lists.",
      });
    }

    if (file.database_import_candidate) {
      actions.push({
        id: `file-library:spreadsheet:${file.local_file_id}`,
        lane_id: "database-import",
        file_id: file.local_file_id,
        title: "表格文件是数据库导入候选",
        priority: "high",
        status: "needs-database-confirmation",
        evidence: `${file.kind_label} · ${file.size_label}`,
        next_action:
          "先在页面预览中检查字段、行数和回滚边界，再输入 typed confirmation 创建本地数据库。",
        action_route: "/modules/databases",
        route_label: "打开数据库",
        requires_manual_confirmation: true,
        writes_workspace_data: false,
        privacy_boundary:
          "The workbench does not read spreadsheet values or create database rows.",
      });
    }

    if (file.editable_import_candidate) {
      actions.push({
        id: `file-library:editable:${file.local_file_id}`,
        lane_id: "editable-import",
        file_id: file.local_file_id,
        title: `${file.kind_label} 需要转换复核`,
        priority: file.kind === "markdown" ? "low" : "medium",
        status: "needs-conversion-review",
        evidence: `${file.support_level} · ${file.size_label}`,
        next_action:
          "转换成可编辑 page 内容后，先人工复核格式、表格、公式、批注和关键信息。",
        action_route: "/modules/reports",
        route_label: "打开报告库",
        requires_manual_confirmation: true,
        writes_workspace_data: false,
        privacy_boundary:
          "The workbench does not include converted text or page body text.",
      });
    }

    if (file.lane_id === "metadata-review") {
      actions.push({
        id: `file-library:metadata:${file.local_file_id}`,
        lane_id: "metadata-review",
        file_id: file.local_file_id,
        title: `${file.kind_label} 只做元数据复核`,
        priority: "medium",
        status: "metadata-only",
        evidence: `${file.mime_type_group} · ${file.size_label}`,
        next_action:
          "确认来源和研究用途；不要自动解包、执行或写入 workspace。",
        action_route: "/modules/files",
        route_label: "查看文件库",
        requires_manual_confirmation: false,
        writes_workspace_data: false,
        privacy_boundary:
          "Metadata review does not read archive contents or file bytes.",
      });
    }

    if (file.download_only) {
      actions.push({
        id: `file-library:retain:${file.local_file_id}`,
        lane_id: "download-retain",
        file_id: file.local_file_id,
        title: `${file.kind_label} 暂时本地留存`,
        priority: file.kind === "unknown" ? "high" : "medium",
        status: "download-retain",
        evidence: `${file.support_level} · ${file.size_label}`,
        next_action:
          "保持本地留存或先转换为受支持格式；不要伪装成可编辑导入。",
        action_route: "/modules/files",
        route_label: "查看文件库",
        requires_manual_confirmation: false,
        writes_workspace_data: false,
        privacy_boundary:
          "Retain action does not delete, upload, execute, unzip, or sync files.",
      });
    }
  }

  if (files.length > 0) {
    actions.push({
      id: "file-library:cloud-ai-boundary",
      lane_id: "cloud-ai-boundary",
      file_id: null,
      title: "文件上云或进入 AI 前必须单独确认",
      priority: "high",
      status: "blocked-boundary",
      evidence: `${files.length} 个本地文件目前只在浏览器 IndexedDB 中管理。`,
      next_action:
        "任何 AI、云同步、外部资源或共享链接动作，都必须先经过 payload preview、权限检查和审计边界。",
      action_route: "/modules/sync",
      route_label: "打开同步",
      requires_manual_confirmation: true,
      writes_workspace_data: false,
      privacy_boundary:
        "This boundary action never sends file names, bytes, text, prompts, tokens, or credentials.",
    });
  }

  return actions;
}

function buildLanes(
  files: FileLibraryFileItem[],
  actions: FileLibraryAction[]
): FileLibraryLane[] {
  return (Object.keys(LANE_META) as FileLibraryLaneId[]).map((id) => {
    const laneActions = actions.filter((action) => action.lane_id === id);
    return {
      ...LANE_META[id],
      file_count: files.filter((file) => file.lane_id === id).length,
      action_count: laneActions.length,
      high_priority_count: laneActions.filter(
        (action) => action.priority === "high"
      ).length,
    };
  });
}

function buildReviewSequence(
  files: FileLibraryFileItem[],
  actions: FileLibraryAction[]
): FileLibraryReviewStep[] {
  if (files.length === 0) {
    return [
      reviewStep(
        "add-first-file",
        1,
        "先通过报告模块添加本地文件",
        "/modules/reports",
        "文件需要挂在 ZhiNotes page 上，才能进入原生预览、可编辑导入和关系追踪。",
        "至少有一个本地 file preview block 和 IndexedDB 文件。"
      ),
    ];
  }

  const steps: FileLibraryReviewStep[] = [];
  if (actions.some((action) => action.lane_id === "native-preview")) {
    steps.push(
      reviewStep(
        "native-preview",
        steps.length + 1,
        "先确认原生预览",
        "/modules/reports",
        "HTML/PDF/media/text 适合先留在 page 中原生查看，避免过早转换损失信息。",
        "关键文件能在 page 中预览，HTML 外部资源保持阻止或有 receipt。"
      )
    );
  }
  if (actions.some((action) => action.lane_id === "editable-import")) {
    steps.push(
      reviewStep(
        "editable-import",
        steps.length + 1,
        "再处理可编辑导入",
        "/modules/reports",
        "Markdown、Word、PPT、RTF、EPUB、Notebook 进入页面前需要格式复核。",
        "转换后的内容由用户确认后再作为投研笔记使用。"
      )
    );
  }
  if (actions.some((action) => action.lane_id === "database-import")) {
    steps.push(
      reviewStep(
        "database-import",
        steps.length + 1,
        "表格最后入库",
        "/modules/databases",
        "Spreadsheet 入库会创建字段和 rows，属于批量写入，必须晚于结构复核。",
        "导入前确认字段、行数、目标数据库、回滚边界和 typed confirmation。"
      )
    );
  }
  steps.push(
    reviewStep(
      "cloud-ai-boundary",
      steps.length + 1,
      "任何外发都走同步和权限边界",
      "/modules/sync",
      "文件是高敏感数据源，AI、云同步、共享链接和外部资源加载必须单独确认。",
      "没有文件 bytes、文件文本或文件名被发送到外部。"
    )
  );
  return steps;
}

function reviewStep(
  id: string,
  order: number,
  title: string,
  route: string,
  reason: string,
  completionSignal: string
): FileLibraryReviewStep {
  return {
    id,
    order,
    title,
    route,
    reason,
    completion_signal: completionSignal,
  };
}

function summarize(
  files: FileLibraryFileItem[],
  actions: FileLibraryAction[]
): FileLibraryWorkbenchReport["summary"] {
  const totalBytes = files.reduce((sum, file) => sum + file.size_bytes, 0);
  return {
    files: files.length,
    total_bytes: totalBytes,
    total_size_label: formatFileSize(totalBytes),
    native_files: files.filter((file) => file.support_level === "native").length,
    converted_files: files.filter((file) => file.support_level === "converted")
      .length,
    metadata_files: files.filter((file) => file.support_level === "metadata")
      .length,
    download_retain_files: files.filter((file) => file.download_only).length,
    html_reports: files.filter((file) => file.kind === "html").length,
    markdown_notes: files.filter((file) => file.kind === "markdown").length,
    spreadsheet_candidates: files.filter((file) => file.kind === "spreadsheet")
      .length,
    office_files: files.filter((file) =>
      ["word", "presentation"].includes(file.kind)
    ).length,
    unknown_files: files.filter((file) => file.kind === "unknown").length,
    confirmation_required_files: files.filter(
      (file) => file.confirmation_required
    ).length,
    actions: actions.length,
    high_priority_actions: actions.filter((action) => action.priority === "high")
      .length,
  };
}

function getCapabilityForKind(kind: PageFileKind) {
  return FILE_PREVIEW_CAPABILITIES.find((capability) =>
    capability.kinds.includes(kind)
  );
}

function getLaneForKind(
  kind: PageFileKind,
  supportLevel: FilePreviewSupportLevel | "unknown"
): FileLibraryLaneId {
  if (kind === "spreadsheet") return "database-import";
  if (supportLevel === "converted") return "editable-import";
  if (supportLevel === "metadata") return "metadata-review";
  if (supportLevel === "download-only" || supportLevel === "unknown") {
    return "download-retain";
  }
  return "native-preview";
}

function isEditableImportCandidate(kind: PageFileKind) {
  return [
    "markdown",
    "word",
    "presentation",
    "rtf",
    "epub",
    "notebook",
    "text",
    "opml",
  ].includes(kind);
}

function isLegacyRetainCandidate(file: StoredPageFile) {
  const name = file.name.toLowerCase();
  return name.endsWith(".doc") || name.endsWith(".ppt");
}

function getNextAction(
  kind: PageFileKind,
  supportLevel: FilePreviewSupportLevel | "unknown"
) {
  if (kind === "html") {
    return "在 page 中原生预览；外部资源默认阻止，开启前需要 confirmation receipt。";
  }
  if (kind === "spreadsheet") {
    return "先本地预览，再确认字段、行数和回滚边界后导入数据库。";
  }
  if (supportLevel === "converted") {
    return "转换为可编辑内容前先复核格式和信息保真度。";
  }
  if (supportLevel === "metadata") {
    return "只做元数据复核，不自动解包或写入 workspace。";
  }
  if (supportLevel === "unknown") {
    return "先保留本地下载，确认安全路线后再新增预览或转换能力。";
  }
  return "保留在 page 中原生预览，并按需要连接到公司、报告、会议或 memo。";
}

function getCapabilityNextAction(capabilityId: string) {
  if (capabilityId === "html-report") return "复核 HTML 外部资源边界。";
  if (capabilityId === "spreadsheet") return "复核表格入库确认门槛。";
  if (capabilityId === "word" || capabilityId === "presentation") {
    return "复核 Office 转换保真度和旧版文件留存策略。";
  }
  if (capabilityId === "archive") return "只做压缩包元数据复核。";
  return "按当前本地预览路线处理。";
}

function getKindLabel(kind: PageFileKind) {
  const labels: Record<PageFileKind, string> = {
    html: "HTML",
    markdown: "Markdown",
    opml: "OPML",
    rtf: "RTF",
    epub: "EPUB",
    archive: "ZIP",
    pdf: "PDF",
    image: "图片",
    audio: "音频",
    video: "视频",
    text: "文本",
    notebook: "Notebook",
    spreadsheet: "表格",
    word: "Word",
    presentation: "PPT",
    unknown: "未知",
  };
  return labels[kind];
}

function getMimeTypeGroup(mimeType: string) {
  if (!mimeType) return "unknown";
  return mimeType.split("/")[0] || "unknown";
}

function sortFiles(left: FileLibraryFileItem, right: FileLibraryFileItem) {
  if (left.confirmation_required !== right.confirmation_required) {
    return left.confirmation_required ? -1 : 1;
  }
  return (
    new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  );
}

function sortActions(left: FileLibraryAction, right: FileLibraryAction) {
  const priorityRank: Record<FileLibraryPriority, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };
  const laneRank: Record<FileLibraryLaneId, number> = {
    "native-preview": 0,
    "editable-import": 1,
    "database-import": 2,
    "metadata-review": 3,
    "download-retain": 4,
    "cloud-ai-boundary": 5,
  };
  if (priorityRank[left.priority] !== priorityRank[right.priority]) {
    return priorityRank[left.priority] - priorityRank[right.priority];
  }
  if (laneRank[left.lane_id] !== laneRank[right.lane_id]) {
    return laneRank[left.lane_id] - laneRank[right.lane_id];
  }
  return left.title.localeCompare(right.title, "zh-CN");
}
