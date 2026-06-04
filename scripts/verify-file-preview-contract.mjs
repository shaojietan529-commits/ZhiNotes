#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const files = {
  capabilities: "src/lib/files/filePreviewCapabilities.ts",
  intake: "src/lib/reports/reportIntake.ts",
  trackerIntake: "src/lib/reports/reportTrackerIntake.ts",
  formatPlaybook: "src/lib/reports/reportFormatPlaybook.ts",
  formatCoverage: "src/lib/reports/reportFormatCoverage.ts",
  conversionReview: "src/lib/reports/reportConversionReview.ts",
  reviewQueue: "src/lib/reports/reportReviewQueue.ts",
  readiness: "src/lib/files/filePreviewReadiness.ts",
  preflight: "src/lib/files/fileUploadPreflight.ts",
  structure: "src/lib/files/filePreviewStructure.ts",
  actionReceipts: "src/lib/files/filePreviewActionReceipts.ts",
  upload: "src/components/editor/filePreviewUpload.ts",
  localStore: "src/lib/files/localStore.ts",
  previewNode: "src/components/editor/extensions/FilePreviewNode.tsx",
  reportsShell: "src/components/modules/ReportsShell.tsx",
};

const requiredCapabilities = [
  {
    id: "html-report",
    kind: "html",
    extensions: [".html", ".htm"],
    snippets: ["normalizeHtmlDocument", "EXTERNAL_RESOURCE_CONFIRMATION_PHRASE"],
  },
  {
    id: "markdown-note",
    kind: "markdown",
    extensions: [".md", ".markdown", ".mdx"],
    snippets: ["markdownToHtml", "handleImportMarkdown"],
  },
  {
    id: "pdf",
    kind: "pdf",
    extensions: [".pdf"],
    snippets: ['file.kind === "pdf"', "src={file.dataUrl}"],
  },
  {
    id: "spreadsheet",
    kind: "spreadsheet",
    extensions: [".xlsx", ".xls", ".csv", ".tsv", ".ods"],
    snippets: [
      "convertSpreadsheetToHtml",
      "handleImportSpreadsheetDatabase",
      "BULK_IMPORT_CONFIRMATION_PHRASE",
    ],
  },
  {
    id: "word",
    kind: "word",
    extensions: [".docx", ".doc", ".odt"],
    snippets: ["convertWordToHtml", "convertOdtToHtml", "mammoth"],
  },
  {
    id: "presentation",
    kind: "presentation",
    extensions: [".pptx", ".ppt", ".odp"],
    snippets: ["convertPresentationToHtml", "convertPptxToHtml", "convertOdpToHtml"],
  },
  {
    id: "rtf",
    kind: "rtf",
    extensions: [".rtf"],
    snippets: ["convertRtfToHtml", "handleImportRtf"],
  },
  {
    id: "epub",
    kind: "epub",
    extensions: [".epub"],
    snippets: ["convertEpubToHtml"],
  },
  {
    id: "archive",
    kind: "archive",
    extensions: [".zip"],
    snippets: ["convertZipToHtml"],
  },
  {
    id: "notebook",
    kind: "notebook",
    extensions: [".ipynb"],
    snippets: ["convertNotebookToHtml", "handleImportNotebook"],
  },
  {
    id: "media-and-text",
    kind: "image",
    extensions: ["image/*", "audio/*", "video/*", ".txt", ".json", ".opml"],
    snippets: [
      'file.kind === "image"',
      'file.kind === "audio"',
      'file.kind === "video"',
      'file.kind === "text"',
      'file.kind === "opml"',
      "convertOpmlToHtml",
    ],
  },
];

const failures = [];

const requiredIntakeStages = [
  "captured",
  "source-triage",
  "reading-review",
  "database-review",
  "linking",
];
const requiredFormatActions = [
  "native-preview",
  "editable-import",
  "database-import",
  "metadata-review",
  "download-retain",
];

function readProjectFile(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!existsSync(absolutePath)) {
    failures.push(`Missing file: ${relativePath}`);
    return "";
  }
  return readFileSync(absolutePath, "utf8");
}

function fail(message) {
  failures.push(message);
}

function assertIncludes(sourceLabel, source, snippet, message) {
  if (!source.includes(snippet)) {
    fail(`${sourceLabel} missing ${snippet}: ${message}`);
  }
}

function run() {
  const capabilities = readProjectFile(files.capabilities);
  const intake = readProjectFile(files.intake);
  const trackerIntake = readProjectFile(files.trackerIntake);
  const formatPlaybook = readProjectFile(files.formatPlaybook);
  const formatCoverage = readProjectFile(files.formatCoverage);
  const conversionReview = readProjectFile(files.conversionReview);
  const reviewQueue = readProjectFile(files.reviewQueue);
  const readiness = readProjectFile(files.readiness);
  const preflight = readProjectFile(files.preflight);
  const structure = readProjectFile(files.structure);
  const actionReceipts = readProjectFile(files.actionReceipts);
  const upload = readProjectFile(files.upload);
  const localStore = readProjectFile(files.localStore);
  const previewNode = readProjectFile(files.previewNode);
  const reportsShell = readProjectFile(files.reportsShell);

  for (const requirement of requiredCapabilities) {
    assertIncludes(
      files.capabilities,
      capabilities,
      `id: "${requirement.id}"`,
      "Capability matrix must list every promised file group."
    );
    assertIncludes(
      files.capabilities,
      capabilities,
      `kinds: ["${requirement.kind}"`,
      `Capability ${requirement.id} must map to kind ${requirement.kind}.`
    );
    assertIncludes(
      files.localStore,
      localStore,
      `return "${requirement.kind}"`,
      `File kind detection must classify ${requirement.kind}.`
    );

    for (const extension of requirement.extensions) {
      assertIncludes(
        files.upload,
        upload,
        `"${extension}"`,
        `Upload accept list must include ${extension}.`
      );
      assertIncludes(
        files.capabilities,
        capabilities,
        `"${extension}"`,
        `Capability ${requirement.id} must document ${extension}.`
      );
    }

    for (const snippet of requirement.snippets) {
      assertIncludes(
        files.previewNode,
        previewNode,
        snippet,
        `Preview node must implement ${requirement.id}.`
      );
    }
  }

  assertIncludes(
    files.previewNode,
    previewNode,
    "isLegacyOfficeFile",
    "Legacy .doc/.ppt files must be handled explicitly."
  );
  assertIncludes(
    files.previewNode,
    previewNode,
    "supportsEditableConvertedImport",
    "Legacy Office files should not show editable import as if conversion is supported."
  );
  for (const snippet of [
    "getFilePreviewCapabilityByKind",
    "FilePreviewCapabilityStrip",
    "FilePreviewSupportPill",
    "buildFilePreviewStructure",
    "FilePreviewStructureStrip",
    "FilePreviewStructureStatusPill",
    "FilePreviewStructureSignalCard",
    "getStructurePreviewHtml",
    "getEffectivePreviewSupportLevel",
    "isLegacyPreviewFallback",
    "文档结构",
    "预览路径",
    "转换/导入",
    "隐私边界",
    "download-only",
  ]) {
    assertIncludes(
      files.previewNode,
      previewNode,
      snippet,
      "Preview node must expose the same local capability route shown in the Reports module."
    );
  }
  assertIncludes(
    files.structure,
    structure,
    'format: "zhinote-file-preview-structure"',
    "File preview structure must define a local structure format."
  );
  assertIncludes(
    files.structure,
    structure,
    "buildFilePreviewStructure",
    "File preview structure must expose a reusable builder."
  );
  for (const snippet of [
    'report_status: "local-preview-structure-only"',
    "local_preview_structure_only: true",
    "reads_loaded_file_text",
    "reads_converted_preview_html",
    "reads_file_bytes: false",
    "includes_file_name: false",
    "uploads_data: false",
    "connects_cloud_services: false",
    "enables_ai: false",
    "writes_workspace_data: false",
  ]) {
    assertIncludes(
      files.structure,
      structure,
      snippet,
      "File preview structure must preserve local-only preview boundaries."
    );
  }
  for (const snippet of [
    '"outline"',
    '"tables"',
    '"links"',
    '"media"',
    '"code"',
    '"sheets"',
    '"slides"',
    '"local-boundary"',
    "estimated_sheets",
    "estimated_slides",
  ]) {
    assertIncludes(
      files.structure,
      structure,
      snippet,
      "File preview structure must expose document signals for research review."
    );
  }
  assertIncludes(
    files.reportsShell,
    reportsShell,
    "FILE_PREVIEW_CAPABILITIES",
    "Reports module must render the file preview capability matrix."
  );
  assertIncludes(
    files.reportsShell,
    reportsShell,
    "格式支持矩阵",
    "Reports module must expose a reader-facing support matrix."
  );
  assertIncludes(
    files.intake,
    intake,
    'format: "zhinote-report-intake-report"',
    "Report intake must define a local export format."
  );
  for (const snippet of [
    "local_report_only: true",
    "reads_local_page_html: true",
    "extracts_file_preview_attributes_only: true",
    "reads_file_bytes: false",
    "reads_file_text: false",
    "writes_workspace_data: false",
    "connects_cloud_services: false",
    "uploads_data: false",
    "enables_ai: false",
  ]) {
    assertIncludes(
      files.intake,
      intake,
      snippet,
      "Report intake must preserve local-only boundaries."
    );
  }
  for (const stage of requiredIntakeStages) {
    assertIncludes(
      files.intake,
      intake,
      `id: "${stage}"`,
      `Report intake must keep workflow stage ${stage}.`
    );
  }
  assertIncludes(
    files.intake,
    intake,
    "buildReportIntakeReport",
    "Report intake must expose a reusable builder."
  );
  assertIncludes(
    files.trackerIntake,
    trackerIntake,
    'format: "zhinote-report-tracker-intake-draft"',
    "Report tracker intake must define a local row draft format."
  );
  assertIncludes(
    files.trackerIntake,
    trackerIntake,
    "buildReportTrackerIntakeDraft",
    "Report tracker intake must expose a reusable draft builder."
  );
  assertIncludes(
    files.trackerIntake,
    trackerIntake,
    "findExistingReportTrackerRow",
    "Report tracker intake must avoid duplicate report-page rows."
  );
  for (const snippet of [
    "local_row_draft_only: true",
    "reads_report_intake_item: true",
    "reads_database_fields: true",
    "reads_page_text: false",
    "reads_file_bytes: false",
    "reads_file_text: false",
    "includes_report_text: false",
    "includes_file_bytes: false",
    "writes_workspace_data: false",
    "connects_cloud_services: false",
    "uploads_data: false",
    "enables_ai: false",
  ]) {
    assertIncludes(
      files.trackerIntake,
      trackerIntake,
      snippet,
      "Report tracker intake draft must preserve local-only privacy boundaries."
    );
  }
  for (const fieldName of [
    "Report page",
    "Format",
    "Status",
    "Source",
    "Key takeaways",
  ]) {
    assertIncludes(
      files.trackerIntake,
      trackerIntake,
      fieldName,
      `Report tracker intake must map ${fieldName}.`
    );
  }
  assertIncludes(
    files.formatPlaybook,
    formatPlaybook,
    'format: "zhinote-report-format-playbook"',
    "Report format playbook must define a local export format."
  );
  for (const snippet of [
    "local_playbook_only: true",
    "reads_report_intake_metadata: true",
    "reads_file_bytes: false",
    "reads_file_text: false",
    "reads_page_body_text: false",
    "writes_workspace_data: false",
    "loads_external_resources: false",
    "connects_cloud_services: false",
    "uploads_data: false",
    "enables_ai: false",
  ]) {
    assertIncludes(
      files.formatPlaybook,
      formatPlaybook,
      snippet,
      "Report format playbook must preserve local-only boundaries."
    );
  }
  for (const action of requiredFormatActions) {
    assertIncludes(
      files.formatPlaybook,
      formatPlaybook,
      action,
      `Report format playbook must keep action ${action}.`
    );
  }
  for (const snippet of [
    'canonical_container: "zhinote-page"',
    'primary_generated_report_format: "html"',
    'primary_written_note_format: "markdown"',
    'database_source_format: "spreadsheet"',
    'editable_page_format: "tiptap-html"',
  ]) {
    assertIncludes(
      files.formatPlaybook,
      formatPlaybook,
      snippet,
      "Report format playbook must document the native format strategy."
    );
  }
  assertIncludes(
    files.formatPlaybook,
    formatPlaybook,
    "buildReportFormatPlaybook",
    "Report format playbook must expose a reusable builder."
  );
  assertIncludes(
    files.formatCoverage,
    formatCoverage,
    'format: "zhinote-report-format-coverage"',
    "Report format coverage must define a local export format."
  );
  assertIncludes(
    files.formatCoverage,
    formatCoverage,
    "buildReportFormatCoverageReport",
    "Report format coverage must expose a reusable builder."
  );
  for (const snippet of [
    'report_status: "local-format-coverage-only"',
    'coverage_verdict: "usable-with-local-gates"',
    "reads_report_intake_metadata: true",
    "reads_capability_metadata: true",
    "reads_file_names: false",
    "reads_file_bytes: false",
    "reads_file_text: false",
    "reads_page_body_text: false",
    "writes_workspace_data: false",
    "loads_external_resources: false",
    "connects_cloud_services: false",
    "uploads_data: false",
    "enables_ai: false",
  ]) {
    assertIncludes(
      files.formatCoverage,
      formatCoverage,
      snippet,
      "Report format coverage must preserve local-only metadata boundaries."
    );
  }
  for (const snippet of [
    '"active"',
    '"active-needs-confirmation"',
    '"supported-unused"',
    '"blocked-limited"',
    '"unsupported-active"',
    '"intake-coverage"',
    '"confirmation-workload"',
    '"html-report-boundary"',
    '"spreadsheet-database-import"',
    '"converted-format-review"',
    '"legacy-office-gap"',
    '"unsupported-format-gap"',
  ]) {
    assertIncludes(
      files.formatCoverage,
      formatCoverage,
      snippet,
      "Report format coverage must expose coverage states and gap gates."
    );
  }
  assertIncludes(
    files.formatCoverage,
    formatCoverage,
    "FILE_PREVIEW_CAPABILITIES",
    "Report format coverage must compare intake against the capability matrix."
  );
  assertIncludes(
    files.formatCoverage,
    formatCoverage,
    "FilePreviewReadinessReport",
    "Report format coverage must compare intake against readiness routes."
  );
  assertIncludes(
    files.conversionReview,
    conversionReview,
    'format: "zhinote-report-conversion-review"',
    "Report conversion review must define a local export format."
  );
  assertIncludes(
    files.conversionReview,
    conversionReview,
    "buildReportConversionReviewReport",
    "Report conversion review must expose a reusable builder."
  );
  for (const snippet of [
    'report_status: "local-conversion-review-only"',
    'review_verdict: "usable-after-local-review"',
    "reads_report_intake_metadata: true",
    "reads_capability_metadata: true",
    "reads_file_extensions: true",
    "includes_file_names: false",
    "reads_file_bytes: false",
    "reads_file_text: false",
    "reads_page_body_text: false",
    "writes_workspace_data: false",
    "loads_external_resources: false",
    "connects_cloud_services: false",
    "uploads_data: false",
    "enables_ai: false",
  ]) {
    assertIncludes(
      files.conversionReview,
      conversionReview,
      snippet,
      "Report conversion review must preserve local-only metadata boundaries."
    );
  }
  for (const snippet of [
    '"native-render-fit"',
    '"office-conversion-fidelity"',
    '"presentation-layout-gap"',
    '"spreadsheet-formula-chart-review"',
    '"legacy-office-block"',
    '"cloud-ai-boundary"',
    "PPTX/ODP",
    "speaker notes",
    "legacy_items",
  ]) {
    assertIncludes(
      files.conversionReview,
      conversionReview,
      snippet,
      "Report conversion review must expose Office/PPT fidelity gates."
    );
  }
  assertIncludes(
    files.reviewQueue,
    reviewQueue,
    'format: "zhinote-report-review-queue"',
    "Report review queue must define a local export format."
  );
  assertIncludes(
    files.reviewQueue,
    reviewQueue,
    "buildReportReviewQueue",
    "Report review queue must expose a reusable builder."
  );
  for (const snippet of [
    'queue_status: "local-review-queue-only"',
    'queue_verdict: "ready-for-local-research-triage"',
    "local_queue_only: true",
    "reads_report_intake_metadata: true",
    "reads_file_names: true",
    "reads_file_bytes: false",
    "reads_file_text: false",
    "reads_page_body_text: false",
    "writes_workspace_data: false",
    "loads_external_resources: false",
    "connects_cloud_services: false",
    "uploads_data: false",
    "enables_ai: false",
  ]) {
    assertIncludes(
      files.reviewQueue,
      reviewQueue,
      snippet,
      "Report review queue must preserve local-only metadata boundaries."
    );
  }
  for (const snippet of [
    '"first-pass-reading"',
    '"conversion-review"',
    '"database-review"',
    '"source-triage"',
    '"relation-linking"',
    '"local-retain"',
    '"queue-built-from-intake"',
    '"first-pass-reading-focus"',
    '"conversion-review-focus"',
    '"spreadsheet-database-gate"',
    '"relation-linking-gate"',
    '"legacy-unknown-block"',
    "isLegacyOffice",
    "sort_score",
  ]) {
    assertIncludes(
      files.reviewQueue,
      reviewQueue,
      snippet,
      "Report review queue must expose ordered workstreams and gates."
    );
  }
  assertIncludes(
    files.readiness,
    readiness,
    'format: "zhinote-file-preview-readiness-report"',
    "File preview readiness must define a local export format."
  );
  assertIncludes(
    files.readiness,
    readiness,
    "buildFilePreviewReadinessReport",
    "File preview readiness must expose a reusable builder."
  );
  for (const snippet of [
    'report_status: "local-file-preview-readiness-only"',
    'readiness_verdict: "ready-with-local-boundaries"',
    'canonical_container: "zhinote-page"',
    'preferred_native_report_format: "html"',
    'preferred_written_note_format: "markdown"',
    'preferred_database_source_format: "spreadsheet"',
    "can_preview_files_locally_now: true",
    "can_upload_files_now: false",
    "can_load_external_resources_now: false",
    "can_run_ai_on_files_now: false",
    "can_sync_files_now: false",
    "can_bulk_import_without_confirmation_now: false",
    "local_report_only: true",
    "reads_capability_metadata: true",
    "reads_file_bytes: false",
    "reads_file_text: false",
    "reads_page_body_text: false",
    "loads_external_resources: false",
    "writes_workspace_data: false",
    "connects_cloud_services: false",
    "uploads_data: false",
    "enables_ai: false",
  ]) {
    assertIncludes(
      files.readiness,
      readiness,
      snippet,
      "File preview readiness must preserve local-only privacy boundaries."
    );
  }
  for (const snippet of [
    "FILE_PREVIEW_CAPABILITIES",
    'support_level === "converted"',
    "capability.limitation",
    '"local-preview-coverage"',
    '"html-external-resources"',
    '"spreadsheet-database-import"',
    '"editable-conversion-review"',
    '"legacy-office-gap"',
    '"cloud-ai-boundary"',
  ]) {
    assertIncludes(
      files.readiness,
      readiness,
      snippet,
      "File preview readiness must map capability routes and safety gates."
    );
  }
  assertIncludes(
    files.actionReceipts,
    actionReceipts,
    'format: "zhinote-file-preview-action-receipt"',
    "File preview action receipts must define a local export format."
  );
  assertIncludes(
    files.actionReceipts,
    actionReceipts,
    'receipt_status: "local-file-action-metadata-only"',
    "File preview action receipts must remain metadata-only."
  );
  for (const snippet of [
    "buildFilePreviewActionReceipt",
    "appendFilePreviewActionReceipt",
    "listFilePreviewActionReceipts",
    "FILE_PREVIEW_ACTION_RECEIPT_EVENT",
    '"reports-module"',
    '"native-preview"',
    '"download-retain"',
    '"editable-import"',
    '"database-import"',
    '"external-resource-enable"',
    '"external-resource-disable"',
    "stored_in_browser_local_storage: true",
    "includes_file_name: false",
    "includes_file_bytes: false",
    "includes_file_text: false",
    "includes_page_body_text: false",
    "includes_spreadsheet_cell_values: false",
    "includes_tokens_or_credentials: false",
    "uploads_data: false",
    "calls_external_service: false",
    "writes_server_audit_log: false",
    "receipt_writes_workspace_data: false",
    "action_may_write_local_workspace_data",
  ]) {
    assertIncludes(
      files.actionReceipts,
      actionReceipts,
      snippet,
      "File preview action receipts must preserve metadata-only local boundaries."
    );
  }
  assertIncludes(
    files.reportsShell,
    reportsShell,
    "buildReportIntakeReport",
    "Reports module must build the intake report."
  );
  assertIncludes(
    files.reportsShell,
    reportsShell,
    "报告 intake 队列",
    "Reports module must render the intake queue panel."
  );
  assertIncludes(
    files.reportsShell,
    reportsShell,
    "Export intake",
    "Reports module must export the intake report."
  );
  assertIncludes(
    files.reportsShell,
    reportsShell,
    "buildReportTrackerIntakeDraft",
    "Reports module must build tracker intake drafts."
  );
  assertIncludes(
    files.reportsShell,
    reportsShell,
    "findExistingReportTrackerRow",
    "Reports module must check existing tracker rows before writing."
  );
  assertIncludes(
    files.reportsShell,
    reportsShell,
    "报告入库台",
    "Reports module must render the tracker intake desk."
  );
  assertIncludes(
    files.reportsShell,
    reportsShell,
    "创建 tracker row",
    "Reports module must expose a tracker-row creation action."
  );
  assertIncludes(
    files.reportsShell,
    reportsShell,
    "本地单条写入",
    "Reports module must label tracker intake as a single local write."
  );
  assertIncludes(
    files.reportsShell,
    reportsShell,
    "buildReportFormatPlaybook",
    "Reports module must build the format playbook."
  );
  assertIncludes(
    files.reportsShell,
    reportsShell,
    "格式处理 Playbook",
    "Reports module must render the format playbook panel."
  );
  assertIncludes(
    files.reportsShell,
    reportsShell,
    "导出 Playbook",
    "Reports module must export the format playbook."
  );
  for (const snippet of [
    "buildReportFormatCoverageReport",
    "handleExportFormatCoverage",
    "格式覆盖缺口",
    "导出 coverage",
    "FormatCoverageGapRow",
    "FormatCoverageRowCard",
    "FormatCoverageStatusPill",
  ]) {
    assertIncludes(
      files.reportsShell,
      reportsShell,
      snippet,
      "Reports module must render and export report format coverage."
    );
  }
  for (const snippet of [
    "buildReportConversionReviewReport",
    "handleExportConversionReview",
    "转换质量复核",
    "导出复核",
    "ConversionReviewGateRow",
    "ConversionReviewRouteCard",
    "ConversionStatusPill",
    "ConversionRiskPill",
  ]) {
    assertIncludes(
      files.reportsShell,
      reportsShell,
      snippet,
      "Reports module must render and export conversion fidelity review."
    );
  }
  for (const snippet of [
    "buildReportReviewQueue",
    "reportReviewQueue",
    "handleExportReviewQueue",
    "下一步 review queue",
    "导出 queue",
    "ReportReviewQueueGateRow",
    "ReportReviewQueueItemCard",
    "ReportReviewQueueStatusPill",
    "ReportReviewQueueRiskPill",
    "ReportReviewQueueWorkstreamPill",
    "不读取文件正文",
  ]) {
    assertIncludes(
      files.reportsShell,
      reportsShell,
      snippet,
      "Reports module must render and export the operational report review queue."
    );
  }
  for (const snippet of [
    "buildFilePreviewReadinessReport",
    "handleExportPreviewReadiness",
    "原生预览 readiness",
    "导出 readiness",
    "FilePreviewReadinessGateRow",
    "FilePreviewReadinessRouteCard",
    "FilePreviewReadinessPill",
  ]) {
    assertIncludes(
      files.reportsShell,
      reportsShell,
      snippet,
      "Reports module must render and export file preview readiness."
    );
  }
  for (const snippet of [
    'format: "zhinote-file-upload-preflight"',
    "buildFileUploadPreflightReport",
    'preflight_verdict: "ready-for-local-file-intake"',
    'default_container: "zhinote-page"',
    'ai_visual_report: "html"',
    'personal_note: "markdown"',
    'database_source: "spreadsheet"',
    "reads_file_names: false",
    "reads_file_bytes: false",
    "reads_file_text: false",
    "reads_page_body_text: false",
    "writes_workspace_data: false",
    "loads_external_resources: false",
    "connects_cloud_services: false",
    "uploads_data: false",
    "enables_ai: false",
    "pre-upload-locality",
    "html-report-native-first",
    "markdown-editable-first",
    "spreadsheet-write-gate",
    "converted-fidelity-review",
    "legacy-office-retain",
    "cloud-ai-separation",
    "confirmation_required_before_upload: false",
    "confirmation_required_after_upload",
    "local_receipt_action",
  ]) {
    assertIncludes(
      files.preflight,
      preflight,
      snippet,
      "File upload preflight must define local-only format routing before file selection."
    );
  }
  for (const snippet of [
    "buildFileUploadPreflightReport",
    "handleExportUploadPreflight",
    "上传前格式预检",
    "导出预检",
    "UploadPreflightGateRow",
    "UploadPreflightRouteCard",
    "UploadPreflightActionPill",
    "UploadPreflightRiskPill",
    "不读取文件名、文件 bytes、文件文本或页面正文",
    "AI 可视化报告优先用",
  ]) {
    assertIncludes(
      files.reportsShell,
      reportsShell,
      snippet,
      "Reports module must render and export local upload preflight routes."
    );
  }
  for (const snippet of [
    "listFilePreviewActionReceipts",
    "FILE_PREVIEW_ACTION_RECEIPT_EVENT",
    "appendFilePreviewActionReceipt",
    "buildFilePreviewActionReceipt",
    "handleExportFileActionReceipts",
    "文件动作 receipts",
    "导出 receipts",
    "zhinote-file-preview-action-receipt-history",
    "history_status: \"local-metadata-only\"",
    "不保存文件名、正文、bytes、表格值、token 或凭证",
    "summarizeFileActionReceipts",
    "native_preview",
    "download_retain",
    "getReportFileReceiptActionKind",
    "本地原生预览",
    "本地留存下载",
    "FileActionReceiptCard",
  ]) {
    assertIncludes(
      files.reportsShell,
      reportsShell,
      snippet,
      "Reports module must render local file action receipt history."
    );
  }
  for (const snippet of [
    "MARKDOWN_EDITABLE_IMPORT_LABEL",
    "REPORT_FILE_ACTION_LABEL",
    "MARKDOWN_EDITABLE_IMPORT_ACCEPT",
    "handleReportFileSelected",
    "selectedFiles",
    "createReportPageFromStoredFile",
    "ReportFileBatchMessage",
    "reportFileBatchMessage",
    "批量上传结果",
    "文件仍只保存在本地浏览器",
    "multiple",
    "handleChooseMarkdownImport",
    "handleMarkdownFileSelected",
    "createMarkdownImportedPageContent",
    "markdownPageTitleFromFile",
    "markdownToHtml",
    "source_surface: \"reports-module\"",
    "导入 Markdown 笔记",
    "Markdown imported from the Reports module into a local editable page.",
  ]) {
    assertIncludes(
      files.reportsShell,
      reportsShell,
      snippet,
      "Reports module must support direct local Markdown import into editable pages."
    );
  }
  for (const snippet of [
    "appendFilePreviewActionReceipt",
    "buildFilePreviewActionReceipt",
    "recordActionReceipt",
    "handleRecordDownloadRetainReceipt",
    "shouldShowDownloadRetainReceiptAction",
    "记录留存 receipt",
    "File retained locally for metadata or download-only preview",
    "handleExportLastActionReceipt",
    "最近文件动作 receipt",
    "导出动作 receipt",
    "不含文件名、正文、bytes 或表格值",
    '"native-preview"',
    '"download-retain"',
    '"editable-import"',
    '"database-import"',
    '"external-resource-enable"',
    '"external-resource-disable"',
  ]) {
    assertIncludes(
      files.previewNode,
      previewNode,
      snippet,
      "File preview node must create and expose local action receipts."
    );
  }

  if (failures.length > 0) {
    console.error("File preview contract verification failed");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("File preview contract verification passed");
  console.log(
    JSON.stringify(
      {
        capability_groups: requiredCapabilities.length,
        required_extensions: requiredCapabilities.reduce(
          (count, item) => count + item.extensions.length,
          0
        ),
        intake_stages: requiredIntakeStages.length,
        tracker_intake_fields: 5,
        format_actions: requiredFormatActions.length,
        format_coverage_gates: 7,
        conversion_review_gates: 6,
        review_queue_gates: 6,
        readiness_gates: 6,
        upload_preflight_gates: 7,
        preview_structure_signals: 8,
        action_receipt_kinds: 6,
        local_only: true,
      },
      null,
      2
    )
  );
}

run();
