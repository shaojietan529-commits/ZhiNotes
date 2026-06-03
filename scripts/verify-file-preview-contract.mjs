#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const files = {
  capabilities: "src/lib/files/filePreviewCapabilities.ts",
  intake: "src/lib/reports/reportIntake.ts",
  formatPlaybook: "src/lib/reports/reportFormatPlaybook.ts",
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
    extensions: [".docx", ".odt"],
    snippets: ["convertWordToHtml", "convertOdtToHtml", "mammoth"],
  },
  {
    id: "presentation",
    kind: "presentation",
    extensions: [".pptx", ".odp"],
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
  const formatPlaybook = readProjectFile(files.formatPlaybook);
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
        format_actions: requiredFormatActions.length,
        local_only: true,
      },
      null,
      2
    )
  );
}

run();
