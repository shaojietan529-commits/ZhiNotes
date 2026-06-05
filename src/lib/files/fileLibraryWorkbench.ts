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

export type FileLibraryDecisionStatus =
  | "available-local"
  | "requires-owner-confirmation"
  | "blocked";

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
  target_section_id: string;
  reason: string;
  completion_signal: string;
}

export interface FileLibraryDecision {
  id:
    | "native-page-preview"
    | "editable-import-review"
    | "spreadsheet-database-import"
    | "legacy-unknown-retain"
    | "cloud-ai-sync-boundary";
  title: string;
  status: FileLibraryDecisionStatus;
  answer: string;
  evidence: string;
  next_action: string;
  route: string;
  target_section_id: string;
  allowed_now: boolean;
  requires_owner_confirmation: boolean;
  blocks_file_externalization: boolean;
  writes_workspace_data: false;
  reads_file_bytes: false;
  reads_file_text: false;
  uploads_data: false;
  enables_ai: false;
}

export interface FileLibraryDecisionSummary {
  current_state: "local-file-routing-only";
  current_conclusion: string;
  can_preview_native_now: true;
  can_review_converted_import_now: true;
  can_bulk_import_spreadsheet_now: false;
  can_load_external_html_resources_now: false;
  can_send_files_to_ai_now: false;
  can_sync_file_bytes_now: false;
  safe_local_work: string[];
  blocked_work: string[];
  required_owner_decisions: string[];
  decisions: FileLibraryDecision[];
}

export interface FileLibraryNativeStrategyItem {
  id:
    | "html-report-native"
    | "markdown-editable"
    | "pdf-native"
    | "spreadsheet-database"
    | "office-conversion"
    | "notebook-epub-rtf"
    | "archive-retain"
    | "media-text-native";
  label: string;
  default_route:
    | "page-native-preview"
    | "editable-page-import"
    | "database-import-candidate"
    | "conversion-review"
    | "metadata-retain";
  native_preference: "primary" | "supported" | "review-required" | "retain-only";
  best_for: string;
  page_behavior: string;
  owner_gate: string;
  route: string;
  target_section_id: string;
  privacy_boundary: string;
}

export interface FileLibraryNativeStrategy {
  format: "zhinote-file-native-strategy";
  canonical_container: "zhinote-page";
  primary_generated_report_format: "html";
  primary_written_note_format: "markdown";
  editable_page_format: "tiptap-html";
  current_recommendation: string;
  safe_defaults: string[];
  blocked_defaults: string[];
  items: FileLibraryNativeStrategyItem[];
  privacy_boundary: string;
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
  decision_summary: FileLibraryDecisionSummary;
  native_strategy: FileLibraryNativeStrategy;
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
    description: "Excel、CSV、TSV、ODS 是数据库候选，但必须输入确认文本。",
    route: "/modules/databases",
    privacy_boundary:
      "工作台不读取表格单元格值；真实入库只在页面预览或数据库页确认后发生。",
  },
  "metadata-review": {
    id: "metadata-review",
    title: "元数据复核",
    description: "ZIP、未知或低结构文件先复核类型、用途和保留策略。",
    route: "/modules/files",
    privacy_boundary:
      "只使用文件类型、大小、时间和能力矩阵，不解包、不读取字节。",
  },
  "download-retain": {
    id: "download-retain",
    title: "本地留存",
    description: "旧版 Office 或暂不支持格式保留在本地，等待转换或手动下载。",
    route: "/modules/files",
    privacy_boundary:
      "不删除、不移动、不上传文件；保留策略只记录本地元数据。",
  },
  "cloud-ai-boundary": {
    id: "cloud-ai-boundary",
    title: "云和 AI 边界",
    description: "文件外发、AI 处理、云同步和外部资源加载必须单独确认。",
    route: "/modules/sync",
    privacy_boundary:
      "文件库不会把文件字节、文本或名称发送给云端、AI 服务或外部资源。",
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
      "由 IndexedDB 文件元数据和文件预览能力矩阵在本地生成。本地 UI 可以向用户显示文件名，但导出的工作台报告会脱敏文件名，且不包含文件字节、文件文本、页面正文、表格值、云端数据、AI prompt、token 或凭证。它不写入工作区数据、不加载外部资源、不导入数据库值、不连接云服务、不上传数据、也不启用 AI。",
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
    decision_summary: buildDecisionSummary(fileItems, actions),
    native_strategy: buildNativeStrategy(),
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

function buildNativeStrategy(): FileLibraryNativeStrategy {
  return {
    format: "zhinote-file-native-strategy",
    canonical_container: "zhinote-page",
    primary_generated_report_format: "html",
    primary_written_note_format: "markdown",
    editable_page_format: "tiptap-html",
    current_recommendation:
      "如果必须选一个原生容器，ZhiNotes page 是统一容器；AI 生成的可视化报告优先用 HTML 沙盒原生预览，个人写作优先用 Markdown 导入为可编辑块，表格资料优先转为本地数据库候选。",
    safe_defaults: [
      "HTML 报告默认以沙盒 iframe 在 page 内原生预览，并阻止外部资源。",
      "Markdown/MDX 默认可本地预览，也可以导入为可编辑 page 内容。",
      "PDF、图片、音频、视频和文本优先使用浏览器本地原生预览。",
      "Excel/CSV/ODS 默认只进入数据库导入候选，真实入库前必须输入确认文本。",
    ],
    blocked_defaults: [
      "不默认加载 HTML 外部图片、脚本、样式、字体或 frame。",
      "不默认把 Office、PDF、Notebook 或表格内容发送给 AI 或云端。",
      "不默认批量导入表格单元格值，也不自动创建数据库行。",
      "不默认执行 notebook 代码、解包 ZIP 到工作区、或删除本地文件。",
    ],
    items: [
      nativeStrategyItem(
        "html-report-native",
        "HTML 可视化报告",
        "page-native-preview",
        "primary",
        "AI 生成的可交互投研报告、图表和仪表盘。",
        "在 page 中以沙盒 iframe 原生展示，保留原始布局；复杂报告不强制转成编辑块。",
        "加载外部资源前必须输入确认文本。",
        "/modules/reports",
        "reports-preview-routing",
        "默认阻止外部网络资源，文件字节保留在本地。"
      ),
      nativeStrategyItem(
        "markdown-editable",
        "Markdown / MDX 笔记",
        "editable-page-import",
        "primary",
        "个人笔记、研究框架、会议纪要和备忘录草稿。",
        "可保留为文件预览，也可导入为 Tiptap 可编辑 page 内容。",
        "导入前只在本地解析；不上传文本。",
        "/modules/reports",
        "reports-conversion-review",
        "本地文本解析，导出的工作台不包含 Markdown 正文。"
      ),
      nativeStrategyItem(
        "pdf-native",
        "PDF",
        "page-native-preview",
        "supported",
        "券商报告、公告、长 PDF 附件。",
        "优先使用浏览器 PDF 原生预览；暂不把 PDF 自动转成可编辑正文。",
        "AI 摘要或全文提取必须另走发送内容预览和用户确认。",
        "/modules/reports",
        "reports-preview-routing",
        "PDF 字节保存在本地 IndexedDB，不上传。"
      ),
      nativeStrategyItem(
        "spreadsheet-database",
        "Excel / CSV / ODS",
        "database-import-candidate",
        "review-required",
        "模型表、跟踪表、财务数据、指标表和交易可比数据。",
        "先显示本地表格预览，再作为数据库导入候选；不把表格当普通文档处理。",
        "导入数据库前必须输入确认文本，不批量静默写入行。",
        "/modules/databases",
        "databases-import-export-readiness",
        "工作台不读取或导出单元格值。"
      ),
      nativeStrategyItem(
        "office-conversion",
        "Word / PowerPoint / OpenDocument",
        "conversion-review",
        "review-required",
        "投资备忘录、会议材料、路演 PPT、外部文档。",
        "DOCX/PPTX/ODT/ODP 走本地转换预览；旧版 DOC/PPT 保留下载并提示转换。",
        "导入为编辑块前需要人工复核版式损失。",
        "/modules/reports",
        "reports-conversion-review",
        "转换在浏览器本地完成，不上传文档内容。"
      ),
      nativeStrategyItem(
        "notebook-epub-rtf",
        "Notebook / EPUB / RTF",
        "conversion-review",
        "review-required",
        "研究 notebook、电子书章节、富文本资料。",
        "本地解析为预览 HTML，可选择导入为可编辑块；Notebook 只读单元格，不执行代码。",
        "执行代码、加载远程资源或 AI 处理保持关闭。",
        "/modules/files",
        "files-format-matrix",
        "本地解析结构，不执行 notebook，不加载 EPUB 远程资源。"
      ),
      nativeStrategyItem(
        "archive-retain",
        "ZIP / Archive",
        "metadata-retain",
        "retain-only",
        "原始资料包、批量附件、导出的工作区资产。",
        "只显示压缩包元数据和保留/下载路线；不自动解包写入工作区。",
        "解包、批量导入或覆盖写入必须单独确认。",
        "/modules/files",
        "files-format-matrix",
        "只读取目录元数据，不写入工作区。"
      ),
      nativeStrategyItem(
        "media-text-native",
        "图片 / 音频 / 视频 / 文本",
        "page-native-preview",
        "supported",
        "截图、录音、视频、纯文本、JSON、OPML。",
        "媒体和文本尽量用浏览器原生预览；文本、代码和 OPML 可导入为可编辑块。",
        "外发、转写、AI 处理或云同步前必须由你确认。",
        "/modules/reports",
        "reports-preview-routing",
        "所有内容保留本地，工作台导出不含字节或正文。"
      ),
    ],
    privacy_boundary:
      "原生格式策略只由静态能力元数据生成；不检查本地文件字节、文件文本、页面正文、表格单元格值、云端数据、prompt、token、凭证或私人研究内容。",
  };
}

function nativeStrategyItem(
  id: FileLibraryNativeStrategyItem["id"],
  label: string,
  defaultRoute: FileLibraryNativeStrategyItem["default_route"],
  nativePreference: FileLibraryNativeStrategyItem["native_preference"],
  bestFor: string,
  pageBehavior: string,
  ownerGate: string,
  route: string,
  targetSectionId: string,
  privacyBoundary: string
): FileLibraryNativeStrategyItem {
  return {
    id,
    label,
    default_route: defaultRoute,
    native_preference: nativePreference,
    best_for: bestFor,
    page_behavior: pageBehavior,
    owner_gate: ownerGate,
    route,
    target_section_id: targetSectionId,
    privacy_boundary: privacyBoundary,
  };
}

function buildDecisionSummary(
  files: FileLibraryFileItem[],
  actions: FileLibraryAction[]
): FileLibraryDecisionSummary {
  const nativeFiles = files.filter((file) => file.support_level === "native");
  const convertedFiles = files.filter(
    (file) => file.support_level === "converted"
  );
  const spreadsheetFiles = files.filter((file) => file.kind === "spreadsheet");
  const retainFiles = files.filter(
    (file) => file.download_only || file.kind === "unknown"
  );
  const highRiskActions = actions.filter(
    (action) => action.status === "blocked-boundary"
  );

  return {
    current_state: "local-file-routing-only",
    current_conclusion:
      "可以继续把文件留在本地 page 中预览、转换复核和整理路线；表格批量入库、HTML 外部资源、AI 文件处理、云同步和文件字节外发仍然需要你单独确认。",
    can_preview_native_now: true,
    can_review_converted_import_now: true,
    can_bulk_import_spreadsheet_now: false,
    can_load_external_html_resources_now: false,
    can_send_files_to_ai_now: false,
    can_sync_file_bytes_now: false,
    safe_local_work: [
      "HTML、PDF、图片、音频、视频和文本优先保留在 page 内本地预览。",
      "Markdown、Word、PPT、RTF、EPUB 和 Notebook 先本地转换预览，再人工复核。",
      "ZIP、未知格式和旧版 Office 先本地留存或元数据复核。",
      "导出文件工作台时继续排除文件名、字节、正文和表格值。",
    ],
    blocked_work: [
      "不能默认加载 HTML 远程图片、脚本、样式、字体或 iframe。",
      "不能默认把 Excel/CSV 批量写入数据库行。",
      "不能把文件文本、文件字节或文件名发送给 AI 服务或云端。",
      "不能自动删除、覆盖、解包、执行 notebook 或同步文件。",
    ],
    required_owner_decisions: [
      "确认 HTML 报告是否允许外部资源，默认保持沙盒预览。",
      "确认转换类文件是否足够保真，尤其是 Word、PPT、Notebook 和 EPUB。",
      "确认表格入库的字段、行数、目标数据库、回滚边界，并输入确认文本。",
      "确认云同步或 AI 处理前的发送内容预览、权限检查和审计事件。",
    ],
    decisions: [
      {
        id: "native-page-preview",
        title: "Page 原生预览",
        status: "available-local",
        answer: "可以继续",
        evidence: `${nativeFiles.length} 个本地文件走原生预览路线；HTML 外部资源仍默认阻止。`,
        next_action:
          "从报告库打开 page 文件预览，先在本地确认 HTML/PDF/媒体是否可读。",
        route: "/modules/reports",
        target_section_id: "reports-preview-routing",
        allowed_now: true,
        requires_owner_confirmation: false,
        blocks_file_externalization: false,
        writes_workspace_data: false,
        reads_file_bytes: false,
        reads_file_text: false,
        uploads_data: false,
        enables_ai: false,
      },
      {
        id: "editable-import-review",
        title: "可编辑导入复核",
        status: "requires-owner-confirmation",
        answer: "先复核",
        evidence: `${convertedFiles.length} 个本地文件属于转换路线，可能丢失复杂版式、公式、图表或输出。`,
        next_action:
          "转换后先人工复核，再决定是否作为可编辑 page 内容、公司备忘录或报告摘要使用。",
        route: "/modules/reports",
        target_section_id: "reports-conversion-review",
        allowed_now: false,
        requires_owner_confirmation: true,
        blocks_file_externalization: false,
        writes_workspace_data: false,
        reads_file_bytes: false,
        reads_file_text: false,
        uploads_data: false,
        enables_ai: false,
      },
      {
        id: "spreadsheet-database-import",
        title: "表格入库",
        status: "requires-owner-confirmation",
        answer: "确认后再写",
        evidence: `${spreadsheetFiles.length} 个表格文件是数据库导入候选；工作台不读取单元格值。`,
        next_action:
          "入库前确认字段、行数、目标数据库、回滚边界，并输入确认文本。",
        route: "/modules/databases",
        target_section_id: "databases-import-export-readiness",
        allowed_now: false,
        requires_owner_confirmation: true,
        blocks_file_externalization: false,
        writes_workspace_data: false,
        reads_file_bytes: false,
        reads_file_text: false,
        uploads_data: false,
        enables_ai: false,
      },
      {
        id: "legacy-unknown-retain",
        title: "旧版/未知格式",
        status: retainFiles.length > 0 ? "blocked" : "available-local",
        answer: retainFiles.length > 0 ? "本地留存" : "暂无阻塞",
        evidence: `${retainFiles.length} 个文件暂时只能本地留存、下载或转换为受支持格式。`,
        next_action:
          "不要伪装成可编辑导入；先确认来源、用途和安全转换路线。",
        route: "/modules/files",
        target_section_id: "files-format-matrix",
        allowed_now: retainFiles.length === 0,
        requires_owner_confirmation: retainFiles.length > 0,
        blocks_file_externalization: retainFiles.length > 0,
        writes_workspace_data: false,
        reads_file_bytes: false,
        reads_file_text: false,
        uploads_data: false,
        enables_ai: false,
      },
      {
        id: "cloud-ai-sync-boundary",
        title: "云 / AI / 同步",
        status: "blocked",
        answer: "保持关闭",
        evidence: `${highRiskActions.length} 个高风险边界动作仍阻塞；文件字节、文本和文件名不外发。`,
        next_action:
          "任何 AI、云同步、分享链接或外部资源动作，都先走发送内容预览、权限检查、审计和用户确认。",
        route: "/modules/sync",
        target_section_id: "web-beta-owner-review",
        allowed_now: false,
        requires_owner_confirmation: true,
        blocks_file_externalization: true,
        writes_workspace_data: false,
        reads_file_bytes: false,
        reads_file_text: false,
        uploads_data: false,
        enables_ai: false,
      },
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
      "导出的文件项会脱敏文件名，并且不包含文件字节、文件文本、转换预览文本、页面正文、表格值或外部 URL。",
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
        "打开报告库，上传 HTML、Markdown、PDF、Excel、Word、PPT 或其他本地文件并生成 page 文件预览块。",
      action_route: "/modules/reports",
      route_label: "打开报告库",
      requires_manual_confirmation: true,
      writes_workspace_data: false,
      privacy_boundary:
        "这个动作只打开报告模块。选择文件仍然是单独的本地用户动作。",
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
          "在页面文件预览块中本地查看；只有明确确认后才允许加载远程图片、脚本、字体、样式或 iframe。",
        action_route: "/modules/reports",
        route_label: "打开报告库",
        requires_manual_confirmation: true,
        writes_workspace_data: false,
        privacy_boundary:
          "文件库不会加载外部资源，也不会导出文件名、字节、文本或 URL 列表。",
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
          "先在页面预览中检查字段、行数和回滚边界，再输入确认文本创建本地数据库。",
        action_route: "/modules/databases",
        route_label: "打开数据库",
        requires_manual_confirmation: true,
        writes_workspace_data: false,
        privacy_boundary:
          "工作台不读取表格值，也不会创建数据库行。",
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
        evidence: `${getSupportLevelLabel(file.support_level)} · ${file.size_label}`,
        next_action:
          "转换成可编辑 page 内容后，先人工复核格式、表格、公式、批注和关键信息。",
        action_route: "/modules/reports",
        route_label: "打开报告库",
        requires_manual_confirmation: true,
        writes_workspace_data: false,
        privacy_boundary:
          "工作台不包含转换后的文本或页面正文。",
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
          "确认来源和研究用途；不要自动解包、执行或写入工作区。",
        action_route: "/modules/files",
        route_label: "查看文件库",
        requires_manual_confirmation: false,
        writes_workspace_data: false,
        privacy_boundary:
          "元数据复核不会读取压缩包内容或文件字节。",
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
        evidence: `${getSupportLevelLabel(file.support_level)} · ${file.size_label}`,
        next_action:
          "保持本地留存或先转换为受支持格式；不要伪装成可编辑导入。",
        action_route: "/modules/files",
        route_label: "查看文件库",
        requires_manual_confirmation: false,
        writes_workspace_data: false,
        privacy_boundary:
          "留存动作不会删除、上传、执行、解包或同步文件。",
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
        "任何 AI、云同步、外部资源或共享链接动作，都必须先经过发送内容预览、权限检查和审计边界。",
      action_route: "/modules/sync",
      route_label: "打开同步",
      requires_manual_confirmation: true,
      writes_workspace_data: false,
      privacy_boundary:
        "这个边界动作不会发送文件名、字节、文本、prompt、token 或凭证。",
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
        "reports-preview-routing",
        "文件需要挂在 ZhiNotes page 上，才能进入原生预览、可编辑导入和关系追踪。",
        "至少有一个本地文件预览块和 IndexedDB 文件。"
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
        "reports-preview-routing",
        "HTML/PDF/媒体/文本适合先留在 page 中原生查看，避免过早转换损失信息。",
        "关键文件能在 page 中预览，HTML 外部资源保持阻止或有确认记录。"
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
        "reports-conversion-review",
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
        "databases-import-export-readiness",
        "表格入库会创建字段和行，属于批量写入，必须晚于结构复核。",
        "导入前确认字段、行数、目标数据库、回滚边界，并输入确认文本。"
      )
    );
  }
  steps.push(
    reviewStep(
      "cloud-ai-boundary",
      steps.length + 1,
      "任何外发都走同步和权限边界",
      "/modules/sync",
      "web-beta-owner-review",
      "文件是高敏感数据源，AI、云同步、共享链接和外部资源加载必须单独确认。",
      "没有文件字节、文件文本或文件名被发送到外部。"
    )
  );
  return steps;
}

function reviewStep(
  id: string,
  order: number,
  title: string,
  route: string,
  targetSectionId: string,
  reason: string,
  completionSignal: string
): FileLibraryReviewStep {
  return {
    id,
    order,
    title,
    route,
    target_section_id: targetSectionId,
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
    return "在 page 中原生预览；外部资源默认阻止，开启前需要确认记录。";
  }
  if (kind === "spreadsheet") {
    return "先本地预览，再确认字段、行数和回滚边界后导入数据库。";
  }
  if (supportLevel === "converted") {
    return "转换为可编辑内容前先复核格式和信息保真度。";
  }
  if (supportLevel === "metadata") {
    return "只做元数据复核，不自动解包或写入工作区。";
  }
  if (supportLevel === "unknown") {
    return "先保留本地下载，确认安全路线后再新增预览或转换能力。";
  }
  return "保留在 page 中原生预览，并按需要连接到公司、报告、会议或备忘录。";
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

function getSupportLevelLabel(level: FilePreviewSupportLevel | "unknown") {
  const labels: Record<FilePreviewSupportLevel | "unknown", string> = {
    native: "原生预览",
    converted: "本地转换",
    metadata: "元数据复核",
    "download-only": "仅下载",
    unknown: "未知支持",
  };
  return labels[level];
}

function getMimeTypeGroup(mimeType: string) {
  const group = mimeType.split("/")[0];
  const labels: Record<string, string> = {
    application: "应用文件",
    audio: "音频",
    image: "图片",
    text: "文本",
    video: "视频",
  };
  return labels[group] ?? "未知";
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
