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
  reportDecisionSummary: "src/lib/reports/reportDecisionSummary.ts",
  readiness: "src/lib/files/filePreviewReadiness.ts",
  routing: "src/lib/files/filePreviewRouting.ts",
  preflight: "src/lib/files/fileUploadPreflight.ts",
  filePage: "src/lib/files/filePage.ts",
  htmlAssetPreflight: "src/lib/files/htmlAssetPreflight.ts",
  zipImportPreflight: "src/lib/files/zipImportPreflight.ts",
  structure: "src/lib/files/filePreviewStructure.ts",
  actionReceipts: "src/lib/files/filePreviewActionReceipts.ts",
  fileEmbedSyncClient: "src/lib/files/fileEmbedSyncClient.ts",
  fileEmbedSyncQueue: "src/lib/files/fileEmbedSyncQueue.ts",
  fileEmbedSyncStatusHook: "src/hooks/useFileEmbedCloudSyncStatus.ts",
  accountSyncCoordinator: "src/hooks/useAccountCloudSyncCoordinator.ts",
  sidebar: "src/components/sidebar/Sidebar.tsx",
  syncShell: "src/components/modules/SyncShell.tsx",
  syncPendingDomainRegistry: "src/lib/sync/syncPendingDomainRegistry.ts",
  upload: "src/components/editor/filePreviewUpload.ts",
  editor: "src/components/editor/Editor.tsx",
  codeHighlight: "src/lib/codeHighlight.ts",
  slashSuggestion: "src/components/editor/extensions/SlashCommandSuggestion.ts",
  localStore: "src/lib/files/localStore.ts",
  fileLibrary: "src/lib/files/fileLibraryWorkbench.ts",
  previewNode: "src/components/editor/extensions/FilePreviewNode.tsx",
  fileEmbedNode: "src/components/editor/extensions/FileEmbedNode.tsx",
  spreadsheet: "src/lib/files/spreadsheet.ts",
  spreadsheetLimits: "src/lib/files/spreadsheetLimits.ts",
  word: "src/lib/files/word.ts",
  presentationImport: "src/lib/files/presentationImport.ts",
  reportsShell: "src/components/modules/ReportsShell.tsx",
  meetingsShell: "src/components/modules/MeetingsShell.tsx",
  meetingTranscriptPage: "src/lib/meetings/meetingTranscriptPage.ts",
  quickSearch: "src/components/sidebar/QuickSearch.tsx",
  filesShell: "src/components/modules/FilesShell.tsx",
  filesRoute: "src/app/(workspace)/modules/files/page.tsx",
  registry: "src/lib/modules/registry.ts",
};

const requiredCapabilities = [
  {
    id: "html-report",
    kind: "html",
    extensions: [".html", ".htm", ".xhtml"],
    snippets: ["normalizeHtmlDocument", "EXTERNAL_RESOURCE_CONFIRMATION_PHRASE"],
  },
  {
    id: "markdown-note",
    kind: "markdown",
    extensions: [
      ".md",
      ".markdown",
      ".mdx",
      ".mdown",
      ".mkd",
      ".mkdn",
      ".rmd",
      ".qmd",
    ],
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
      "工作表预览",
      "<thead>",
      "这个工作表没有数据行",
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
    id: "apple-iwork",
    kind: "pages",
    extensions: [".pages", ".numbers", ".key", ".keynote"],
    snippets: ['pages: "Pages"', 'numbers: "Numbers"', 'keynote: "Keynote"'],
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
    extensions: [
      "image/*",
      "audio/*",
      "video/*",
      ".txt",
      ".srt",
      ".vtt",
      ".webvtt",
      ".sbv",
      ".lrc",
      ".ttml",
      ".json",
      ".jsonl",
      ".xml",
      ".xbrl",
      ".xsd",
      ".xsl",
      ".xslt",
      ".yaml",
      ".yml",
      ".toml",
      ".opml",
      ".tex",
      ".bib",
      ".ris",
      ".rst",
      ".adoc",
      ".asciidoc",
      ".mmd",
      ".mermaid",
      ".org",
      ".do",
      ".sas",
      ".jl",
    ],
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
  const reportDecisionSummary = readProjectFile(files.reportDecisionSummary);
  const readiness = readProjectFile(files.readiness);
  const routing = readProjectFile(files.routing);
  const preflight = readProjectFile(files.preflight);
  const filePage = readProjectFile(files.filePage);
  const htmlAssetPreflight = readProjectFile(files.htmlAssetPreflight);
  const zipImportPreflight = readProjectFile(files.zipImportPreflight);
  const structure = readProjectFile(files.structure);
  const actionReceipts = readProjectFile(files.actionReceipts);
  const fileEmbedSyncClient = readProjectFile(files.fileEmbedSyncClient);
  const fileEmbedSyncQueue = readProjectFile(files.fileEmbedSyncQueue);
  const fileEmbedSyncStatusHook = readProjectFile(
    files.fileEmbedSyncStatusHook
  );
  const accountSyncCoordinator = readProjectFile(
    files.accountSyncCoordinator
  );
  const sidebar = readProjectFile(files.sidebar);
  const syncShell = readProjectFile(files.syncShell);
  const syncPendingDomainRegistry = readProjectFile(
    files.syncPendingDomainRegistry
  );
  const upload = readProjectFile(files.upload);
  const editor = readProjectFile(files.editor);
  const codeHighlight = readProjectFile(files.codeHighlight);
  const slashSuggestion = readProjectFile(files.slashSuggestion);
  const localStore = readProjectFile(files.localStore);
  const fileLibrary = readProjectFile(files.fileLibrary);
  const previewNode = readProjectFile(files.previewNode);
  const fileEmbedNode = readProjectFile(files.fileEmbedNode);
  const spreadsheet = readProjectFile(files.spreadsheet);
  const spreadsheetLimits = readProjectFile(files.spreadsheetLimits);
  const word = readProjectFile(files.word);
  const presentationImport = readProjectFile(files.presentationImport);
  const previewImplementation = [
    previewNode,
    spreadsheet,
    word,
    presentationImport,
  ].join("\n");
  const reportsShell = readProjectFile(files.reportsShell);
  const meetingsShell = readProjectFile(files.meetingsShell);
  const meetingTranscriptPage = readProjectFile(files.meetingTranscriptPage);
  const quickSearch = readProjectFile(files.quickSearch);
  const filesShell = readProjectFile(files.filesShell);
  const filesRoute = readProjectFile(files.filesRoute);
  const registry = readProjectFile(files.registry);

  for (const [snippet, message] of [
    [
      'const loadFilePreviewStructureModule = () =>\n  import("@/lib/files/filePreviewStructure")',
      "File preview structure analysis must load only after the user opens the structure panel.",
    ],
    [
      'const loadCodeHighlightModule = () => import("@/lib/codeHighlight")',
      "Code highlighting must stay out of the editor first paint bundle.",
    ],
    [
      'const loadArchiveModule = () => import("@/lib/files/archive")',
      "ZIP conversion must stay out of the editor first paint bundle.",
    ],
    [
      'const loadEpubModule = () => import("@/lib/files/epub")',
      "EPUB conversion must stay out of the editor first paint bundle.",
    ],
    [
      'const loadPresentationModule = () =>\n  import("@/lib/files/presentationImport")',
      "Presentation conversion must stay out of the editor first paint bundle.",
    ],
    [
      'const loadSpreadsheetModule = () => import("@/lib/files/spreadsheet")',
      "Spreadsheet parsing and database import must load only after spreadsheet preview/import intent.",
    ],
    [
      'const loadWordModule = () => import("@/lib/files/word")',
      "Word conversion must stay out of the editor first paint bundle.",
    ],
    [
      'from "@/lib/files/spreadsheetLimits"',
      "File preview should import only lightweight spreadsheet row/column limits at first paint.",
    ],
  ]) {
    assertIncludes(files.previewNode, previewNode, snippet, message);
  }

  for (const [snippet, message] of [
    [
      "buildFilePreviewStructure,",
      "File preview must not statically import the structure analyzer runtime.",
    ],
    [
      'import { highlightCodeToHtml } from "@/lib/codeHighlight"',
      "File preview must not statically import the code highlighter runtime.",
    ],
    [
      'import { convertZipToHtml } from "@/lib/files/archive"',
      "File preview must not statically import ZIP conversion runtime.",
    ],
    [
      'import { convertEpubToHtml } from "@/lib/files/epub"',
      "File preview must not statically import EPUB conversion runtime.",
    ],
    [
      "convertPresentationToHtml,",
      "File preview must not statically import presentation conversion runtime.",
    ],
    [
      "convertSpreadsheetToHtml,",
      "File preview must not statically import spreadsheet conversion runtime.",
    ],
    [
      "importSpreadsheetAsDatabase,",
      "File preview must not statically import spreadsheet database import runtime.",
    ],
    [
      'import { convertWordToHtml } from "@/lib/files/word"',
      "File preview must not statically import Word conversion runtime.",
    ],
  ]) {
    if (previewNode.includes(snippet)) {
      fail(`${files.previewNode} must not include ${snippet}: ${message}`);
    }
  }

  for (const snippet of [
    "export const SPREADSHEET_DATABASE_ROW_LIMIT = 500",
    "export const SPREADSHEET_DATABASE_COLUMN_LIMIT = 50",
  ]) {
    assertIncludes(
      files.spreadsheetLimits,
      spreadsheetLimits,
      snippet,
      "Spreadsheet row/column limits must live in a tiny constants module so file preview can avoid importing the spreadsheet engine."
    );
    if (spreadsheet.includes(snippet)) {
      fail(
        `${files.spreadsheet} must not include ${snippet}: spreadsheet limits should stay in ${files.spreadsheetLimits}`
      );
    }
  }

  assertIncludes(
    files.upload,
    upload,
    "if (opts?.accept !== undefined)",
    "Generic file preview insertion must allow any local file; only specialized entrypoints should restrict accept types."
  );
  assertIncludes(
    files.upload,
    upload,
    "input.accept = opts.accept",
    "Generic file preview insertion must only set accept when a specialized entrypoint passes it."
  );
  assertIncludes(
    files.upload,
    upload,
    "accept: HTML_REPORT_ACCEPT",
    "HTML report entrypoint should still restrict the picker to HTML."
  );
  assertIncludes(
    files.upload,
    upload,
    "accept: MARKDOWN_FILE_ACCEPT",
    "Markdown preview entrypoint should still restrict the picker to Markdown/Text."
  );
  for (const [sourceLabel, source, snippet, message] of [
    [
      files.fileEmbedSyncClient,
      fileEmbedSyncClient,
      "FILE_EMBED_SYNC_REQUEST_TIMEOUT_MS = 12000",
      "File embed cloud sync must have a bounded browser-side timeout.",
    ],
    [
      files.fileEmbedSyncClient,
      fileEmbedSyncClient,
      "class FileEmbedSyncRequestTimeoutError extends Error",
      "File embed cloud sync timeouts must use a typed retryable error.",
    ],
    [
      files.fileEmbedSyncClient,
      fileEmbedSyncClient,
      "async function fetchFileEmbedSyncWithTimeout",
      "File embed cloud sync must route through one shared timeout wrapper.",
    ],
    [
      files.fileEmbedSyncClient,
      fileEmbedSyncClient,
      "const controller = new AbortController();",
      "File embed cloud sync must be abortable.",
    ],
    [
      files.fileEmbedSyncClient,
      fileEmbedSyncClient,
      "signal: controller.signal",
      "File embed cloud sync fetches must pass the abort signal.",
    ],
    [
      files.fileEmbedSyncClient,
      fileEmbedSyncClient,
      "window.clearTimeout(timeout)",
      "File embed cloud sync timeout timers must be cleared after fetch settles.",
    ],
    [
      files.fileEmbedSyncClient,
      fileEmbedSyncClient,
      "文件云同步请求超时；文件已保存在本地，可稍后重试。",
      "File embed timeout copy must tell users the local file is preserved.",
    ],
    [
      files.upload,
      upload,
      "fetchFileEmbedSyncWithTimeout({",
      "Editor file embed push must use the bounded sync helper.",
    ],
    [
      files.upload,
      upload,
      "文件云同步失败；文件仍保存在本地。",
      "Editor file embed push failures must keep local-file-preserved copy.",
    ],
    [
      files.fileEmbedNode,
      fileEmbedNode,
      "fetchFileEmbedSyncWithTimeout({",
      "File embed pull must use the bounded sync helper.",
    ],
    [
      files.fileEmbedNode,
      fileEmbedNode,
      "文件云端加载超时；本地页面保持可用，可稍后重试。",
      "File embed pull timeout copy must keep the page usable.",
    ],
  ]) {
    assertIncludes(sourceLabel, source, snippet, message);
  }
  if ((fileEmbedSyncClient.match(/\bfetch\(/g) ?? []).length !== 1) {
    fail(
      `${files.fileEmbedSyncClient} must keep direct fetch usage centralized in fetchFileEmbedSyncWithTimeout.`
    );
  }
  for (const [sourceLabel, source, snippet, message] of [
    [
      files.fileEmbedSyncQueue,
      fileEmbedSyncQueue,
      "FILE_EMBED_SYNC_QUEUE_STORAGE_KEY",
      "File embed cloud sync retries must have a visible metadata queue.",
    ],
    [
      files.fileEmbedSyncQueue,
      fileEmbedSyncQueue,
      "FILE_EMBED_SYNC_QUEUE_EVENT",
      "File embed sync queue updates must notify open tabs.",
    ],
    [
      files.fileEmbedSyncQueue,
      fileEmbedSyncQueue,
      "storesFileBytes: false",
      "File embed sync queue must prove it does not persist file bytes in localStorage.",
    ],
    [
      files.fileEmbedSyncQueue,
      fileEmbedSyncQueue,
      "getStoredPageFile(entry.fileId)",
      "File embed retry must load bytes from the local IndexedDB file copy, not localStorage.",
    ],
    [
      files.fileEmbedSyncQueue,
      fileEmbedSyncQueue,
      "FILE_EMBED_MANUAL_REVIEW_FAILURE_THRESHOLD = 3",
      "Repeated file upload failures must stop at manual review instead of looping forever.",
    ],
    [
      files.fileEmbedSyncQueue,
      fileEmbedSyncQueue,
      "classifyFileEmbedCloudSyncAuthDeferral",
      "Account/session temporary failures must be separated from ordinary file upload failures.",
    ],
    [
      files.fileEmbedSyncQueue,
      fileEmbedSyncQueue,
      "markFileEmbedCloudSyncDeferred",
      "Account/session temporary failures must keep file uploads pending instead of increasing failure counts.",
    ],
    [
      files.fileEmbedSyncQueue,
      fileEmbedSyncQueue,
      "authDeferred",
      "File retry results must expose account-deferred attempts separately from failed uploads.",
    ],
    [
      files.fileEmbedSyncQueue,
      fileEmbedSyncQueue,
      "FILE_EMBED_SYNC_AUTH_RETRY_STORAGE_KEY",
      "File queue auth retry state must be visible across tabs without storing file bytes.",
    ],
    [
      files.fileEmbedSyncQueue,
      fileEmbedSyncQueue,
      "status: \"manual_review\"",
      "Missing local file copies must be surfaced for manual review.",
    ],
    [
      files.fileEmbedSyncStatusHook,
      fileEmbedSyncStatusHook,
      "useFileEmbedCloudSyncStatus",
      "UI surfaces must subscribe to the file embed queue status.",
    ],
    [
      files.fileEmbedSyncStatusHook,
      fileEmbedSyncStatusHook,
      'window.addEventListener("storage", handleStorage)',
      "File embed queue state must update across tabs.",
    ],
    [
      files.fileEmbedSyncStatusHook,
      fileEmbedSyncStatusHook,
      'window.addEventListener("online", handleForeground)',
      "File embed queue status must refresh when connectivity returns.",
    ],
    [
      files.fileEmbedSyncStatusHook,
      fileEmbedSyncStatusHook,
      "ACCOUNT_SESSION_LAST_AUTHENTICATED_STORAGE_KEY",
      "File embed queue must retry quickly when account recovery is observed in another tab.",
    ],
	    [
	      files.fileEmbedSyncStatusHook,
	      fileEmbedSyncStatusHook,
	      "ACCOUNT_PROFILE_UPDATED_EVENT",
	      "File embed queue must retry quickly after same-tab account login/profile recovery.",
	    ],
    [
      files.fileEmbedSyncStatusHook,
      fileEmbedSyncStatusHook,
      "FILE_EMBED_ACCOUNT_RECOVERY_RETRY_LIMIT",
      "File embed account-recovery retry must stay bounded instead of high-frequency uploading large files.",
    ],
    [
      files.fileEmbedSyncStatusHook,
      fileEmbedSyncStatusHook,
      "FILE_EMBED_FOREGROUND_RETRY_LIMIT",
      "File embed foreground auto-retry must stay in small batches.",
    ],
    [
      files.fileEmbedSyncStatusHook,
      fileEmbedSyncStatusHook,
      "FILE_EMBED_AUTO_RETRY_MIN_INTERVAL_MS",
      "File embed auto-retry must have a minimum interval so large uploads do not thrash the network.",
    ],
    [
      files.fileEmbedSyncStatusHook,
      fileEmbedSyncStatusHook,
      "scheduleAutoRetry",
      "File embed queue changes must schedule bounded auto-retry instead of only refreshing status.",
    ],
    [
      files.fileEmbedSyncStatusHook,
      fileEmbedSyncStatusHook,
      "FILE_EMBED_QUEUE_RETRY_DELAY_MS",
      "File embed queue updates must coalesce before auto-retry so queue events do not cause upload loops.",
    ],
    [
      files.fileEmbedSyncStatusHook,
      fileEmbedSyncStatusHook,
      "if (document.visibilityState === \"visible\") {\n        refreshAndMaybeForegroundRetry();\n      }",
      "Visible file embed queue heartbeats must continue draining large queues in small batches.",
    ],
    [
      files.upload,
      upload,
      "markFileEmbedCloudSyncAttempt",
      "Editor file uploads must enter the metadata queue before cloud push.",
    ],
    [
      files.upload,
      upload,
      "markFileEmbedCloudSyncSuccess",
      "Successful cloud pushes must remove file entries from the queue.",
    ],
    [
      files.upload,
      upload,
      "markFileEmbedCloudSyncFailure",
      "File cloud failures must remain visible for retry or manual review.",
    ],
    [
      files.upload,
      upload,
      "markFileEmbedCloudSyncDeferred",
      "Editor file upload auth/session deferrals must stay pending without increasing failure counts.",
    ],
    [
      files.upload,
      upload,
      "classifyFileEmbedCloudSyncAuthDeferral",
      "Editor file upload must classify account/session responses before marking ordinary failure.",
    ],
    [
      files.upload,
      upload,
      "retryable: res.status !== 413",
      "Oversized file sync responses must go to manual review instead of retrying forever.",
    ],
    [
      files.accountSyncCoordinator,
      accountSyncCoordinator,
      "useFileEmbedCloudSyncStatus",
      "Global account sync status must include file embed queue visibility.",
    ],
    [
      files.accountSyncCoordinator,
      accountSyncCoordinator,
      "filePendingTotal",
      "Global account sync status must expose file pending counts.",
    ],
    [
      files.accountSyncCoordinator,
      accountSyncCoordinator,
      "retryFileEmbedSync({",
      "Global account sync retry must include file embed pending uploads.",
    ],
    [
      files.accountSyncCoordinator,
      accountSyncCoordinator,
      "const fileAutoRetryablePendingTotal = 0",
      "File byte uploads must stay out of the high-frequency account auto-retry loop.",
    ],
    [
      files.accountSyncCoordinator,
      accountSyncCoordinator,
      "const accountUncertainByAuthRetry = Boolean(authRetryDomainLabel)",
      "Global account sync status must treat file auth retry markers as cloud uncertainty before reporting synced.",
    ],
    [
      files.accountSyncCoordinator,
      accountSyncCoordinator,
      'accountUncertainByAuthRetry\n                ? "error"',
      "Global account sync status must not report synced when only a file auth retry marker remains.",
    ],
    [
      files.sidebar,
      sidebar,
      "data-file-pending-total",
      "Sidebar sync status must expose file pending counts for smoke tests.",
    ],
    [
      files.sidebar,
      sidebar,
      "/modules/sync#file-embed-pending-upload-queue",
      "Sidebar file pending status must deep-link to the sync center file queue.",
    ],
    [
      files.syncShell,
      syncShell,
      "fileEmbedPendingStatus",
      "Sync center must include file embed pending counts.",
    ],
    [
      files.syncShell,
      syncShell,
      'fileEmbedPendingStatus.authRetryStatus ? "文件" : null',
      "Sync center must include file embed account retry state in the visible auth retry domain label.",
    ],
    [
      files.syncShell,
      syncShell,
      "fileEmbedPendingStatus.authRetryUntil",
      "Sync center must include file embed account retry timing in the visible auth retry status.",
    ],
    [
      files.syncPendingDomainRegistry,
      syncPendingDomainRegistry,
      "file_embed_sync_queue",
      "Sync center pending-domain rows must identify the file embed queue table.",
    ],
    [
      files.syncShell,
      syncShell,
      "file-embed-pending-upload-queue",
      "Sync center must expose a stable anchor for file pending uploads.",
    ],
    [
      files.syncShell,
      syncShell,
      "receipt.summary.file_waiting_rows_after",
      "Sync center handoff copy must use receipt-level file queue counts instead of double-counting files.",
    ],
  ]) {
    assertIncludes(sourceLabel, source, snippet, message);
  }
  for (const [sourceLabel, source] of [
    [files.upload, upload],
    [files.fileEmbedNode, fileEmbedNode],
  ]) {
    if (source.includes('fetch("/api/files/embed-sync"')) {
      fail(
        `${sourceLabel} must use fetchFileEmbedSyncWithTimeout instead of directly calling /api/files/embed-sync.`
      );
    }
  }
  for (const snippet of [
    "recordInsertedFilePreviewReceipt",
    "getInsertedFilePreviewActionKind",
    "isDownloadRetainOnlyFile",
    "source_surface: \"editor-file-preview\"",
    "appendFilePreviewActionReceipt",
    "buildFilePreviewActionReceipt",
  ]) {
    assertIncludes(
      files.upload,
      upload,
      snippet,
      "Editor file preview insertion must create a local metadata-only action receipt."
    );
  }

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
        `${files.previewNode} + shared converters`,
        previewImplementation,
        snippet,
        `Preview implementation must cover ${requirement.id}.`
      );
    }
  }

  for (const snippet of [
    'return "numbers"',
    'return "keynote"',
    '"application/vnd.apple.pages"',
    '"application/vnd.apple.numbers"',
    '"application/vnd.apple.keynote"',
    '"application/x-iwork-pages-sffpages"',
    '"application/x-iwork-numbers-sffnumbers"',
    '"application/x-iwork-keynote-sffkey"',
    'kinds: ["pages", "numbers", "keynote"]',
    'support_level: "download-only"',
    "Numbers 文件需先导出为 Excel/CSV",
    '"pages"',
    '"numbers"',
    '"keynote"',
    "iWork 本地留存",
    "Pages 文档",
    "Numbers 表格",
    "Keynote 演示文稿",
    'pages: "Pages"',
    'numbers: "Numbers"',
    'keynote: "Keynote"',
  ]) {
    const sourceLabel =
      snippet.startsWith('"application/x-iwork')
        ? files.upload
        : snippet.startsWith('return "') ||
            snippet.startsWith('"application') ||
            snippet === '"pages"' ||
            snippet === '"numbers"' ||
            snippet === '"keynote"'
          ? files.localStore
          : snippet === "Pages 文档" ||
              snippet === "Numbers 表格" ||
              snippet === "Keynote 演示文稿"
            ? files.reportsShell
            : snippet.startsWith("pages:") ||
                snippet.startsWith("numbers:") ||
                snippet.startsWith("keynote:")
              ? files.trackerIntake
              : snippet === "iWork 本地留存"
                ? files.reviewQueue
                : files.capabilities;
    const source =
      sourceLabel === files.localStore
        ? localStore
        : sourceLabel === files.upload
          ? upload
        : sourceLabel === files.reportsShell
          ? reportsShell
          : sourceLabel === files.trackerIntake
            ? trackerIntake
          : sourceLabel === files.reviewQueue
            ? reviewQueue
            : capabilities;
    assertIncludes(
      sourceLabel,
      source,
      snippet,
      "Apple iWork files must be recognized as local download-retain formats instead of unknown files."
    );
  }

  for (const [sourceLabel, source] of [
    [files.slashSuggestion, slashSuggestion],
    [files.quickSearch, quickSearch],
  ]) {
    assertIncludes(
      sourceLabel,
      source,
      '"iwork"',
      "Apple iWork aliases must stay searchable from file preview entrypoints."
    );
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
    "getStoredPageFileMetadata",
    "FilePreviewCapabilityStrip",
    "FilePreviewSupportPill",
    "FilePreviewLoadPrompt",
    "buildFilePreviewStructure",
    "FilePreviewStructureStrip",
    "FilePreviewStructureRequestStrip",
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
    "handleOpenFileRouteHub",
    "/modules/files#files-preview-routing",
    "查看文件路线",
    "AUTO_LOAD_TEXT_PREVIEW_BYTES",
    "AUTO_LOAD_NATIVE_PREVIEW_BYTES",
    "shouldAutoLoadFileContent",
    "fileMetadata",
    "fileLoadFailed",
    "加载预览/文件",
    "文件已显示 metadata",
    "避免打开页面时读取大文件本体",
    "convertedPreviewRequested",
    "isOnDemandConvertedPreviewKind",
    "handleRequestConvertedPreview",
    "handleToggleExpanded",
    "fileStructureRequested",
    "waitingForConvertedStructure",
    "handleRequestFileStructure",
    "分析结构",
    "避免打开页面时解析大报告",
    "结构分析只读取当前预览内容",
    "生成预览",
    "为避免打开页面时同时转换大量附件",
    "CONVERTED_PREVIEW_CACHE_LIMIT",
    "convertedPreviewCache",
    "convertedPreviewWorkCache",
    "getConvertedPreviewCacheKey",
    "getCachedConvertedPreview",
    "setCachedConvertedPreview",
    "getOrCreateConvertedPreview",
    "buildConvertedPreview",
    "editableHtml",
    "当前浏览器会话复用本地内存缓存",
    "缓存不包含文件名，不上传，不调用云服务或 AI",
  ]) {
    assertIncludes(
      files.previewNode,
      previewNode,
      snippet,
      "Preview node must expose the same local capability route shown in the Reports module."
    );
  }
  assertIncludes(
    files.localStore,
    localStore,
    "getStoredPageFileMetadata",
    "File preview blocks must be able to read lightweight file metadata before loading file bytes."
  );
  for (const snippet of [
    "按需转换为表格 HTML 预览",
    "按需转换预览；DOCX 使用 mammoth",
    "按需转换预览；PPTX/ODP",
    "按需读取 EPUB spine",
    "按需列出压缩包内容",
  ]) {
    assertIncludes(
      files.capabilities,
      capabilities,
      snippet,
      "Converted/heavy file formats must document on-demand local preview generation."
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
  for (const snippet of [
    "buildFilePreviewRoutingPacket",
    "filePreviewRouting",
    "handleExportPreviewRouting",
    "PreviewRoutingPanel",
    "PreviewRoutingRouteCard",
    "PreviewRoutingReviewStepCard",
    "PreviewRoutingStatusPill",
    "handlePreviewRoutingStepNavigate",
    "onReviewStepOpen",
    "scrollIntoView",
    "打开步骤",
    "reports-preview-routing",
    "reports-review-queue",
    "reports-format-playbook",
    "reports-format-coverage",
    "reports-conversion-review",
    "原生预览路由",
    "导出路由包",
    "不读取文件名、正文、字节、表格值",
  ]) {
    assertIncludes(
      files.reportsShell,
      reportsShell,
      snippet,
      "Reports module must build, render, and export the file preview routing packet."
    );
  }
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
    "演讲者备注",
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
    files.reportDecisionSummary,
    reportDecisionSummary,
    'format: "zhinote-report-decision-summary"',
    "Report decision summary must define a local export format."
  );
  assertIncludes(
    files.reportDecisionSummary,
    reportDecisionSummary,
    "buildReportDecisionSummary",
    "Report decision summary must expose a reusable builder."
  );
  for (const snippet of [
    'summary_status: "local-report-owner-review"',
    'current_state: "local-report-owner-review"',
    "ReportDecisionSummaryStatus",
    "reads_report_intake_summary: true",
    "reads_format_route_summary: true",
    "reads_review_queue_summary: true",
    "reads_connection_plan_summary: true",
    "reads_file_names: false",
    "reads_file_bytes: false",
    "reads_file_text: false",
    "reads_page_body_text: false",
    "reads_database_rows: false",
    "writes_workspace_data: false",
    "creates_database_rows: false",
    "loads_external_resources: false",
    "connects_cloud_services: false",
    "uploads_data: false",
    "enables_ai: false",
    "can_create_local_report_pages_now: true",
    "can_preview_html_reports_now: true",
    "can_import_markdown_editable_now: true",
    "can_review_pdf_office_locally_now: true",
    "can_write_tracker_rows_without_manual_click_now: false",
    "can_bulk_import_spreadsheet_now: true",
    "can_load_external_html_resources_now: false",
    "can_send_reports_to_ai_now: false",
    "can_sync_report_files_now: false",
    "html-page-native-preview",
    "markdown-editable-page-import",
    "pdf-office-conversion-review",
    "spreadsheet-confirmed-database-import",
    "tracker-relation-intake",
    "cloud-ai-external-resource-boundary",
    "HTML Page 预览",
    "Markdown 可编辑导入",
    "表格确认入库",
    "跟踪表与关系",
    "AI、云同步与外部资源边界",
    "load_html_external_resources_without_confirmation",
    "send_report_text_or_file_bytes_to_ai",
    "sync_report_files_to_cloud",
    "bulk_import_spreadsheet_without_typed_confirmation",
    "auto_create_report_tracker_rows",
    "export_file_names_from_report_decision_summary",
    "execute_notebook_code",
    "unzip_archive_into_workspace",
    "npm run verify:file-preview",
    "npm run verify:research-workflow",
    "npm run lint",
    "npm run build",
  ]) {
    assertIncludes(
      files.reportDecisionSummary,
      reportDecisionSummary,
      snippet,
      "Report decision summary must preserve local-only owner gates."
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
    files.routing,
    routing,
    'format: "zhinote-file-preview-routing-packet"',
    "File preview routing must define a local export format."
  );
  assertIncludes(
    files.routing,
    routing,
    "buildFilePreviewRoutingPacket",
    "File preview routing must expose a reusable builder."
  );
  for (const snippet of [
    'packet_status: "local-preview-routing-only"',
    'route_verdict: "ready-for-local-preview"',
    'canonical_container: "zhinote-page"',
    'native_report_format: "html"',
    'editable_note_format: "markdown"',
    'database_source_format: "spreadsheet"',
    "local_packet_only: true",
    "reads_file_preview_readiness: true",
    "reads_format_coverage: true",
    "reads_review_queue: true",
    "reads_file_names: false",
    "reads_file_bytes: false",
    "reads_file_text: false",
    "reads_page_body_text: false",
    "includes_file_names: false",
    "includes_database_row_values: false",
    "writes_workspace_data: false",
    "loads_external_resources: false",
    "creates_database_rows: false",
    "connects_cloud_services: false",
    "uploads_data: false",
    "enables_ai: false",
  ]) {
    assertIncludes(
      files.routing,
      routing,
      snippet,
      "File preview routing must preserve local-only routing boundaries."
    );
  }
  for (const snippet of [
    '"native-preview"',
    '"editable-import"',
    '"database-import"',
    '"metadata-review"',
    '"download-retain"',
    '"gap-review"',
    '"native-ready"',
    '"external-confirmation"',
    '"converted-review"',
    '"database-confirmation"',
    '"blocked-limited"',
    '"unsupported"',
    "target_section_id",
    "reports-review-queue",
    "reports-format-playbook",
    "reports-format-coverage",
    "reports-conversion-review",
    "forbidden_actions",
    "required_verification_commands",
    "load_html_external_resources_without_confirmation",
    "bulk_import_spreadsheet_without_confirmation",
    "send_file_text_to_ai",
    "upload_file_bytes_to_cloud",
    "execute_notebook_code",
    "npm run verify:file-preview",
    "npm run lint",
    "npm run build",
  ]) {
    assertIncludes(
      files.routing,
      routing,
      snippet,
      "File preview routing must preserve lanes, statuses, forbidden actions, and verification commands."
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
  assertIncludes(
    files.actionReceipts,
    actionReceipts,
    "这个 receipt 只记录动作 metadata",
    "File preview action receipt privacy note must stay localized and metadata-only."
  );
  for (const snippet of [
    "buildFilePreviewActionReceipt",
    "appendFilePreviewActionReceipt",
    "listFilePreviewActionReceipts",
    "FILE_PREVIEW_ACTION_RECEIPT_EVENT",
    '"editor-file-preview"',
    '"reports-module"',
    '"meetings-module"',
    '"files-module"',
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
  for (const snippet of [
    "Markdown 已在本地转换",
    "HTML 已在本地清理",
    "HTML 预览已在输入确认短语后允许外部资源。",
    "导出导入 receipt",
    "导出资源 receipt",
    "短语匹配",
    "默认阻止",
    "receipt 不含表格单元格值或文件 bytes。",
    "receipt 不含报告文本、URL、token 或文件 bytes。",
  ]) {
    assertIncludes(
      files.previewNode,
      previewNode,
      snippet,
      "File preview receipt UI must keep privacy and confirmation labels in Chinese."
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
    "报告入库队列",
    "Reports module must render the intake queue panel."
  );
  assertIncludes(
    files.reportsShell,
    reportsShell,
    "导出入库队列",
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
    "创建跟踪表行",
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
    "导出覆盖报告",
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
    "下一步复核队列",
    "导出队列",
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
    "导出预览就绪",
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
    'format: "zhinote-file-library-workbench"',
    'report_status: "local-file-library-only"',
    "buildFileLibraryWorkbenchReport",
    "reads_file_metadata: true",
    "reads_capability_metadata: true",
    "reads_file_names: true",
    "includes_file_names: false",
    "includes_file_bytes: false",
    "includes_file_text: false",
    "reads_file_bytes: false",
    "reads_file_text: false",
    "reads_page_body_text: false",
    "loads_external_resources: false",
    "creates_database_rows: false",
    "connects_cloud_services: false",
    "uploads_data: false",
    "enables_ai: false",
    "decision_summary",
    "native_strategy",
    'format: "zhinote-file-native-strategy"',
    'canonical_container: "zhinote-page"',
    'primary_generated_report_format: "html"',
    'primary_written_note_format: "markdown"',
    'editable_page_format: "tiptap-html"',
    "current_recommendation",
    "html-report-native",
    "markdown-editable",
    "pdf-native",
    "spreadsheet-database",
    "office-conversion",
    "notebook-epub-rtf",
    "archive-retain",
    "media-text-native",
    "page-native-preview",
    "editable-page-import",
    "confirmed-database-import",
    "conversion-review",
    "metadata-retain",
    "ZhiNotes 页面是统一容器",
    "local-file-routing-only",
    "can_preview_native_now: true",
    "can_review_converted_import_now: true",
    "can_bulk_import_spreadsheet_now: true",
    "can_load_external_html_resources_now: false",
    "can_send_files_to_ai_now: false",
    "can_sync_file_bytes_now: false",
    "native-page-preview",
    "editable-import-review",
    "spreadsheet-database-import",
    "legacy-unknown-retain",
    "cloud-ai-sync-boundary",
    "文件字节、文本和文件名不外发",
    '"native-preview"',
    '"editable-import"',
    '"database-import"',
    '"metadata-review"',
    '"download-retain"',
    '"cloud-ai-boundary"',
    "upload_file_bytes_without_confirmation",
    "send_file_text_to_ai",
    "load_html_external_resources_without_confirmation",
    "bulk_import_spreadsheet_without_typed_confirmation",
    "delete_or_overwrite_local_files",
    "export_file_names_from_workbench",
    "sync_files_to_cloud",
    "execute_notebook_code",
    "target_section_id",
    "reports-preview-routing",
    "reports-conversion-review",
    "databases-import-export-readiness",
    "web-beta-owner-review",
    "npm run verify:file-preview",
    "npm run verify:modules",
    "npm run lint",
    "npm run build",
  ]) {
    assertIncludes(
      files.fileLibrary,
      fileLibrary,
      snippet,
      "File Library workbench must preserve metadata-only routing and safety boundaries."
    );
  }
  for (const snippet of [
    'format: "zhinote-html-assets-preflight-contract"',
    'report_status: "metadata-contract-only"',
    "reads_html_file_now: false",
    "reads_asset_file_names_now: false",
    "reads_asset_bytes_now: false",
    "returns_resource_urls: false",
    "returns_asset_file_names: false",
    "rewrites_html_now: false",
    "creates_pages_now: false",
    "loads_external_resources: false",
    "uploads_data: false",
    "enables_ai: false",
    "same-folder-html-assets",
    "zip-html-assets",
    "remote-html-assets",
    "html-document-selection",
    "local-asset-match-preview",
    "external-resource-allowlist",
    "sandbox-render-confirmation",
    "html-assets-import-receipt",
    "buildHtmlAssetPreflightContract",
    'format: "zhinote-html-assets-reference-preview"',
    'preview_status: "metadata-only"',
    "buildHtmlAssetReferencePreview",
    "reads_html_text_now: true",
    "reads_asset_file_names_now: true",
    "reads_asset_bytes_now: false",
    "returns_html_text: false",
    "returns_resource_urls: false",
    "returns_asset_file_names: false",
    "resource_groups",
    "asset_extension_groups",
    'format: "zhinote-html-assets-local-bundle"',
    "buildBundledHtmlWithLocalAssets",
    "reads_asset_bytes_now: true",
    "returns_html_text_to_caller: true",
    "rewrites_html_now: true",
    "loads_external_resources: false",
    "uploads_data: false",
    "enables_ai: false",
    "rewriteStylesheetLinks",
    "rewriteScriptSources",
    "rewriteElementAssetAttributes",
    "rewriteCssUrls",
    "data-zhinote-local-asset",
    "HTML_ASSET_LOCAL_BUNDLE_MAX_BYTES",
    "本地 assets 超过 25 MB",
  ]) {
    assertIncludes(
      files.htmlAssetPreflight,
      htmlAssetPreflight,
      snippet,
      "HTML assets preflight must stay metadata-only and block external resources until owner review."
    );
  }
  for (const snippet of [
    'format: "zhinote-zip-import-preflight-contract"',
    'report_status: "metadata-contract-only"',
    "reads_zip_file_now: false",
    "reads_entry_file_names_now: false",
    "reads_entry_bytes_now: false",
    "extracts_files_now: false",
    "creates_pages_now: false",
    "creates_databases_now: false",
    "uploads_data: false",
    "enables_ai: false",
    "markdown-text-pages",
    "html-pages",
    "spreadsheet-databases",
    "unknown-blocked",
    "entry-manifest-preview",
    "batch-create-confirmation",
    "rollback-receipt",
    "buildZipImportPreflightContract",
    'format: "zhinote-zip-central-directory-preview"',
    'preview_status: "metadata-only"',
    "buildZipCentralDirectoryPreview",
    "returns_entry_file_names: false",
    "extension_groups",
    "getZipEntryExtension",
    'format: "zhinote-zip-local-file-page-import"',
    "extractZipEntriesForLocalFilePages",
    "ZIP_LOCAL_FILE_PAGE_IMPORT_ENTRY_LIMIT",
    "ZIP_LOCAL_FILE_PAGE_IMPORT_COMPRESSED_LIMIT_BYTES",
    "ZIP_LOCAL_FILE_PAGE_IMPORT_TOTAL_BYTES_LIMIT",
    "reads_entry_bytes_now: true",
    "extracts_files_now: true",
    "creates_pages_now: false",
    "creates_databases_now: false",
    "nested_archive_entries",
    "isUnsafeZipEntryPath",
    "inferZipEntryMimeType",
  ]) {
    assertIncludes(
      files.zipImportPreflight,
      zipImportPreflight,
      snippet,
      "ZIP import preflight must stay metadata-contract-only until owner review."
    );
  }
  for (const snippet of [
    "buildFileLibraryWorkbenchReport",
    "buildFilePreviewRoutingPacket",
    "buildHtmlAssetPreflightContract",
    "buildHtmlAssetReferencePreview",
    "buildZipImportPreflightContract",
    "filePreviewRouting",
    "htmlAssetPreflight",
    "zipImportPreflight",
    "handleExportHtmlAssetPreflight",
    "handleChooseHtmlAssetPreview",
    "handleHtmlAssetPreviewSelected",
    "handleExportHtmlAssetReferencePreview",
    "handleCreateHtmlAssetPage",
    "buildBundledHtmlWithLocalAssets",
    "htmlAssetPreviewFiles",
    "creatingHtmlAssetPage",
    "htmlAssetBundleMessage",
    "HtmlAssetPreflightPanel",
    "HtmlAssetReferencePreviewPanel",
    "HTML assets 保真预检",
    "选择 HTML + assets 只读预检",
    "创建本地保真页面",
    "HTML assets 已在浏览器本地改写为保真 HTML 页面",
    "导出 HTML assets 预检合同",
    "导出 HTML assets 引用预览",
    "不返回资源 URL 或 assets 文件名",
    "不读取 asset bytes",
    "assets bytes 并改写 HTML，不上传、不联网、不调用 AI",
    "handleExportZipPreflight",
    "handleChooseZipPreview",
    "handleZipPreviewSelected",
    "handleExportZipDirectoryPreview",
    "handleExportZipImportReceipt",
    "handleCreateZipFilePages",
    "extractZipEntriesForLocalFilePages",
    "ZIP_BULK_IMPORT_CONFIRMATION_PHRASE",
    "zipPreviewFile",
    "zipImportPhrase",
    "zipBulkImportReceipt",
    "ZipImportPreflightPanel",
    "ZipCentralDirectoryPreviewPanel",
    "选择 ZIP 只读预览",
    "导出 ZIP 目录预览",
    "导出 ZIP 导入 receipt",
    "创建本地文件页面",
    'getHighRiskRequiredPhrase("bulk-import")',
    "预览后的确认队列",
    "只显示扩展名分布，不展示内部文件名",
    "先只读预览，确认后本地创建页面",
    "未知格式、嵌套 ZIP 和不安全路径会被跳过",
    "不创建数据库、不上传、不调用 AI",
    "ZIP 条目已在输入批量导入确认短语后创建为本地文件页面",
    "预览阶段不读取条目 bytes、不解压、不创建 page/database",
    "handleExportPreviewRouting",
    "FilePreviewRoutingHubPanel",
    "FilePreviewRoutingRouteCard",
    "FilePreviewRoutingReviewStepCard",
    "FilePreviewRoutingStatusPill",
    "buildFilesModuleIntakeReport",
    "listStoredPageFileMetadata",
    "getStoredPageFile",
    "文件库中心",
    "文件工作台",
    "文件预览路由总控",
    "ZIP 批量导入预检",
    "导出 ZIP 预检合同",
    "先只读预览，确认后本地创建页面",
    "files-zip-import-preflight",
    "getZipRouteLabel",
    "格式路线矩阵",
    "FileFormatGroupCard",
    "导出文件工作台",
    "导出路由包",
    "文件接入入口",
    "files-decision-summary",
    "文件格式接入决策摘要",
    "FileDecisionSummaryPanel",
    "FileDecisionCard",
    "FileDecisionStatusPill",
    "FileNativeStrategyPanel",
    "FileNativeStrategyCard",
    "NativePreferencePill",
    "FileLibraryLaneCard",
    "getFileLaneTargetSectionId",
    "openFileWorkflowRoute",
    "files-native-strategy",
    "原生格式策略",
    "待你确认",
    "getNativeStrategyValueLabel",
    "getNativeRouteLabel",
    "getSupportLevelLabel",
    "getLaneLabel",
    "getForbiddenActionLabel",
    "未输入确认文本批量导入表格",
    "打开路线",
    "onOpen={() => handleLaneOpen(lane)}",
    'navigate(`${route}#${targetSectionId}`)',
    "打开报告库上传",
    "打开笔记中心",
    "打开数据库中心",
    "handleReviewStepOpen",
    "scrollIntoView",
    "打开步骤",
    "files-intake-entrypoints",
    "files-preview-routing",
    "files-workbench-lanes",
    "files-format-matrix",
    "files-local-files",
    "FILE_LIBRARY_FILTERS",
    "matchesFileLibraryFilter",
    "当前筛选",
    "当前筛选没有文件",
    "files-next-actions",
    "files-review-sequence",
    "files-privacy-boundary",
    "导出不包含文件名、字节或正文",
    "不读取文件名、正文、字节、表格值",
    "不自动删除",
  ]) {
    assertIncludes(
      files.filesShell,
      filesShell,
      snippet,
      "Files module UI must render the local file workbench, routes, and safety boundary."
    );
  }
  for (const snippet of [
    "DB_VERSION = 2",
    'METADATA_STORE_NAME = "file_metadata"',
    "StoredPageFileMetadata",
    "listStoredPageFileMetadata",
    "toStoredPageFileMetadata",
    "writeStoredPageFileMetadata",
    "hasTextContent",
  ]) {
    assertIncludes(
      files.localStore,
      localStore,
      snippet,
      "Local file storage must keep a metadata-only index for fast file-library first paint."
    );
  }
  assertIncludes(
    files.filesShell,
    filesShell,
    "getStoredPageFile(fileId)",
    "Files module must load full file payload only for a specific local-file action."
  );
  for (const snippet of [
    "useLocalFirstDatabaseNavigation",
    "const openDatabase = useLocalFirstDatabaseNavigation();",
    "openDatabase(importResult.database_id)",
  ]) {
    assertIncludes(
      files.previewNode,
      previewNode,
      snippet,
      "Spreadsheet database imports must open the created database through shared local-first navigation."
    );
  }
  if (previewNode.includes("router.push(`/database")) {
    fail(
      `${files.previewNode} must not direct hard route to database pages after spreadsheet imports.`
    );
  }
  assertIncludes(
    files.filesShell,
    filesShell,
    'const loadPageMutationModule = () => import("@/lib/pages/cloudPageMutations")',
    "Files module must lazy-load page mutation code only after local-file page creation intent."
  );
  for (const [sourceLabel, source, surfaceLabel] of [
    [files.filesShell, filesShell, "Files"],
    [files.reportsShell, reportsShell, "Reports"],
    [files.meetingsShell, meetingsShell, "Meetings"],
  ]) {
    assertIncludes(
      sourceLabel,
      source,
      'const loadPageMutationModule = () => import("@/lib/pages/cloudPageMutations")',
      `${surfaceLabel} module must lazy-load page mutation code only after local file/page creation intent.`
    );
    if (source.includes('from "@/lib/pages/cloudPageMutations"')) {
      fail(
        `${sourceLabel} must not include static cloudPageMutations imports: ${surfaceLabel} module page mutation code must stay out of first paint.`
      );
    }
  }
  for (const [sourceLabel, source, surfaceLabel] of [
    [files.reportsShell, reportsShell, "Reports"],
    [files.meetingsShell, meetingsShell, "Meetings"],
  ]) {
    assertIncludes(
      sourceLabel,
      source,
      "const loadDatabaseMutationModule = () =>",
      `${surfaceLabel} module must lazy-load database mutation code only after tracker-intake intent.`
    );
    assertIncludes(
      sourceLabel,
      source,
      'import("@/lib/database/cloudDatabaseMutations")',
      `${surfaceLabel} module must keep tracker database mutation code out of first paint.`
    );
    if (source.includes('from "@/lib/database/cloudDatabaseMutations"')) {
      fail(
        `${sourceLabel} must not include static cloudDatabaseMutations imports: ${surfaceLabel} module tracker writes must stay out of first paint.`
      );
    }
  }
  assertIncludes(
    files.fileLibrary,
    fileLibrary,
    "type StoredPageFileMetadata",
    "File Library workbench must be computed from metadata instead of full file payload records."
  );
  assertIncludes(
    files.filesRoute,
    filesRoute,
    'import("@/components/modules/FilesShell")',
    "Files module route must lazy-load the client shell."
  );
  assertIncludes(
    files.registry,
    registry,
    'route: "/modules/files"',
    "Module registry must expose the File Library route."
  );
  for (const snippet of [
    "文件预览路由总控",
    "文件路由包导出",
    "Page 文件块路线跳转",
  ]) {
    assertIncludes(
      files.registry,
      registry,
      snippet,
      "File Library registry capabilities must advertise the routing hub and page handoff."
    );
  }
  for (const snippet of [
    "buildReportDecisionSummary",
    "reportDecisionSummary",
    "handleExportDecisionSummary",
    "handleDecisionOpen",
    "reports-decision-summary",
    "报告决策摘要",
    "ReportDecisionSummaryPanel",
    "ReportDecisionCard",
    "ReportDecisionStatusPill",
    "导出摘要",
    "打开对应区域",
    "当前可做",
    "保持关闭",
    "待你确认",
    "报告决策摘要只读取本地摘要元数据",
  ]) {
    assertIncludes(
      files.reportsShell,
      reportsShell,
      snippet,
      "Reports module must render and export the report decision summary."
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
    "不读取文件名、文件字节、文件文本或页面正文",
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
    "文件动作收据",
    "导出收据",
    "zhinote-file-preview-action-receipt-history",
    "history_status: \"local-metadata-only\"",
    "不保存文件名、正文、字节、表格值、token 或凭证",
    "summarizeFileActionReceipts",
    "native_preview",
    "download_retain",
    "getReportFileReceiptActionKind",
    "本地原生预览",
    "本地留存下载",
    "FileActionReceiptCard",
    "getFileActionSourceLabel",
    "来源：",
    "编辑器上传",
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
    ".mdown",
    ".mkd",
    ".mkdn",
    ".rmd",
    ".qmd",
    "handleReportFileSelected",
    "selectedFiles",
    "createReportPageFromStoredFile",
    "getFilePreviewCapabilityByKind",
    "原生预览状态",
    "预览路径",
    "可编辑导入",
    "数据库导入",
    "隐私边界",
    "ReportFileBatchMessage",
    "reportFileBatchMessage",
    "批量上传结果",
    "文件仍只保存在本地浏览器",
    "multiple",
    "handleChooseMarkdownImport",
    "handleMarkdownFileSelected",
    "createMarkdownImportedPageContent",
    "markdownPageTitleFromFile",
    "resolveMarkdownWikiReferences",
    "normalizeWikiReferenceTitle",
    "extractLinkedPageIdsFromHtml",
    "updateWikiLinks",
    'data-type", "mention"',
    'span[data-type="wiki-reference"]',
    "reportPageTitleFromStoredFile",
    "extractHtmlDocumentTitle",
    "extractMarkdownDocumentTitle",
    "extractMarkdownFrontmatterTitle",
    "stripLeadingMarkdownFrontmatter",
    "extractMarkdownHeadingTitle",
    "normalizeImportedPageTitle",
    "IMPORTED_PAGE_TITLE_MAX_LENGTH",
    "title: reportPageTitleFromStoredFile(storedFile)",
    "title: markdownPageTitleFromFile(",
    "markdownToHtml",
    "source_surface: \"reports-module\"",
    "导入 Markdown 笔记",
    "Markdown / MDX / MDown / R Markdown / Quarto",
    "Markdown 已从报告库模块导入为本地可编辑页面。",
  ]) {
    assertIncludes(
      files.reportsShell,
      reportsShell,
      snippet,
      "Reports module must support direct local Markdown import into editable pages."
    );
  }
  for (const snippet of [
    "FILE_LIBRARY_PAGE_ACTION_LABEL",
    "buildFileLibraryPageTitle",
    "buildFileLibraryPageContent",
    "getFileLibraryReceiptActionKind",
    "createFilePreviewBlockHtml",
    "getFilePreviewCapabilityByKind",
    "推荐去向",
    "复核清单",
    "研究关联",
    "不上传、不云同步、不调用 AI、不加载外部资源、不执行文件、不删除原文件",
    "download-retain",
    "native-preview",
  ]) {
    assertIncludes(
      files.filePage,
      filePage,
      snippet,
      "Generic file page builder must reuse local file preview blocks and preserve local-only boundaries."
    );
  }
  for (const snippet of [
    "MEETING_TRANSCRIPT_FILE_ACTION_LABEL",
    "buildMeetingTranscriptPageTitle",
    "buildMeetingTranscriptPageContent",
    "getMeetingTranscriptReceiptActionKind",
    "createFilePreviewBlockHtml",
    "getFilePreviewCapabilityByKind",
    "会议转录稿",
    "会议录音索引",
    "会议行动项表",
    "会议材料",
    "本地文件预览",
    "不上传、不云同步、不调用 AI、不发布纪要、不自动转写录音",
    "download-retain",
    "native-preview",
  ]) {
    assertIncludes(
      files.meetingTranscriptPage,
      meetingTranscriptPage,
      snippet,
      "Meeting transcript page builder must reuse local file preview blocks and preserve local-only boundaries."
    );
  }
  for (const snippet of [
    "fileInputRef",
    "getStoredPageFile(fileId)",
    "handleChooseFiles",
    "handleFilesSelected",
    "handleCreatePageForStoredFile",
    "creatingExistingFilePageId",
    "createFileLibraryPageFromStoredFile",
    "savePageFile(file)",
    "source_surface: \"files-module\"",
    "buildFilePreviewActionReceipt",
    "appendFilePreviewActionReceipt",
    "buildFileLibraryPageContent",
    "upsertPages(createdPages)",
    "upsertPages([page])",
    "FILE_LIBRARY_PAGE_ACTION_LABEL",
    "文件没有上传、同步或调用 AI",
    "从本地文件创建 Page",
    "只复用浏览器本地文件和通用文件页面模板",
    "不确定文件属于哪个模块时",
  ]) {
    assertIncludes(
      files.filesShell,
      filesShell,
      snippet,
      "Files module must create generic local file pages from user-selected files without upload or AI."
    );
  }
  if (filesShell.includes("refreshPages()")) {
    fail(
      `${files.filesShell} must not include refreshPages(): Files module must optimistically merge created file pages instead of refreshing the full page list.`
    );
  }
  for (const snippet of [
    "transcriptFileInputRef",
    "handleChooseTranscriptFiles",
    "handleTranscriptFilesSelected",
    "createMeetingTranscriptPageFromStoredFile",
    "savePageFile(file)",
    "source_surface: \"meetings-module\"",
    "buildFilePreviewActionReceipt",
    "appendFilePreviewActionReceipt",
    "buildMeetingTranscriptPageContent",
    "选择会议文件",
    "MEETING_TRANSCRIPT_FILE_ACTION_LABEL",
    "文件没有上传、同步或调用 AI",
  ]) {
    assertIncludes(
      files.meetingsShell,
      meetingsShell,
      snippet,
      "Meetings module must create local transcript pages from user-selected files without upload or AI."
    );
  }

  for (const [sourceLabel, source, snippet] of [
    [files.localStore, localStore, '".xbrl"'],
    [files.localStore, localStore, '".xsd"'],
    [files.localStore, localStore, '".xsl"'],
    [files.localStore, localStore, '".xslt"'],
    [files.upload, upload, '".xbrl"'],
    [files.upload, upload, '".xsd"'],
    [files.upload, upload, '".xsl"'],
    [files.upload, upload, '".xslt"'],
    [files.capabilities, capabilities, "SEC XBRL"],
    [files.localStore, localStore, '".srt"'],
    [files.localStore, localStore, '".vtt"'],
    [files.localStore, localStore, '".webvtt"'],
    [files.localStore, localStore, '".sbv"'],
    [files.localStore, localStore, '".lrc"'],
    [files.localStore, localStore, '".ttml"'],
    [files.upload, upload, '".srt"'],
    [files.upload, upload, '".vtt"'],
    [files.upload, upload, '".webvtt"'],
    [files.upload, upload, '".sbv"'],
    [files.upload, upload, '".lrc"'],
    [files.upload, upload, '".ttml"'],
    [files.capabilities, capabilities, "会议转录字幕"],
    [files.previewNode, previewNode, 'lowerName.endsWith(".tex")'],
    [files.previewNode, previewNode, 'lowerName.endsWith(".srt")'],
    [files.previewNode, previewNode, 'lowerName.endsWith(".vtt")'],
    [files.previewNode, previewNode, 'lowerName.endsWith(".webvtt")'],
    [files.previewNode, previewNode, 'lowerName.endsWith(".sbv")'],
    [files.previewNode, previewNode, 'lowerName.endsWith(".lrc")'],
    [files.previewNode, previewNode, 'lowerName.endsWith(".ttml")'],
    [files.previewNode, previewNode, 'lowerName.endsWith(".xbrl")'],
    [files.previewNode, previewNode, 'lowerName.endsWith(".xsd")'],
    [files.previewNode, previewNode, 'lowerName.endsWith(".xsl")'],
    [files.previewNode, previewNode, 'lowerName.endsWith(".xslt")'],
    [files.previewNode, previewNode, 'return "xml"'],
    [files.previewNode, previewNode, 'return "latex"'],
    [files.previewNode, previewNode, 'return "bibtex"'],
    [files.previewNode, previewNode, 'return "ris"'],
    [files.previewNode, previewNode, 'return "mermaid"'],
    [files.previewNode, previewNode, 'return "stata"'],
    [files.previewNode, previewNode, 'return "sas"'],
    [files.previewNode, previewNode, 'return "julia"'],
    [files.editor, editor, '{ label: "LaTeX", value: "latex" }'],
    [files.editor, editor, '{ label: "BibTeX", value: "bibtex" }'],
    [files.editor, editor, '{ label: "Mermaid", value: "mermaid" }'],
    [files.editor, editor, '{ label: "Julia", value: "julia" }'],
    [files.editor, editor, '{ label: "SAS", value: "sas" }'],
    [files.editor, editor, '{ label: "Stata", value: "stata" }'],
    [files.codeHighlight, codeHighlight, 'tex: "latex"'],
    [files.codeHighlight, codeHighlight, 'bib: "bibtex"'],
    [files.codeHighlight, codeHighlight, 'mmd: "mermaid"'],
    [files.codeHighlight, codeHighlight, 'if (language === "latex" || language === "bibtex")'],
    [files.codeHighlight, codeHighlight, 'if (language === "mermaid")'],
    [files.codeHighlight, codeHighlight, 'if (language === "julia" || language === "sas" || language === "stata")'],
    [files.codeHighlight, codeHighlight, 'if (language === "ris")'],
  ]) {
    assertIncludes(
      sourceLabel,
      source,
      snippet,
      "Research text previews must keep specialized language mapping and highlighting."
    );
  }
  for (const snippet of [
    "appendFilePreviewActionReceipt",
    "buildFilePreviewActionReceipt",
    "recordActionReceipt",
    "handleRecordDownloadRetainReceipt",
    "shouldShowDownloadRetainReceiptAction",
    "记录留存 receipt",
    "文件已保留在本地，用于 metadata 或仅下载预览。",
    "handleExportLastActionReceipt",
    "最近文件动作 receipt",
    "导出动作 receipt",
    "不含文件名、正文、bytes 或表格值",
    "外部资源当前",
    "表格行已在输入确认短语后导入到新的本地数据库",
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
        routing_lanes: 6,
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
