"use client";

import type { Editor } from "@tiptap/core";
import {
  savePageFile,
  type PageFileKind,
  type StoredPageFile,
} from "@/lib/files/localStore";
import {
  fetchFileEmbedSyncWithTimeout,
  FileEmbedSyncRequestTimeoutError,
} from "@/lib/files/fileEmbedSyncClient";
import {
  markFileEmbedCloudSyncAttempt,
  markFileEmbedCloudSyncFailure,
  markFileEmbedCloudSyncSuccess,
} from "@/lib/files/fileEmbedSyncQueue";
import {
  appendFilePreviewActionReceipt,
  buildFilePreviewActionReceipt,
  type FilePreviewActionKind,
} from "@/lib/files/filePreviewActionReceipts";
import { markdownToHtml } from "@/lib/markdown/markdownToHtml";

export const FILE_PREVIEW_IMPORT_PROGRESS_EVENT =
  "zhinote:file-preview-import-progress";
export const FILE_PREVIEW_ACCEPT = [
  ".html",
  ".htm",
  ".xhtml",
  ".md",
  ".markdown",
  ".mdx",
  ".mdown",
  ".mkd",
  ".mkdn",
  ".rmd",
  ".qmd",
  ".opml",
  ".rtf",
  ".epub",
  ".zip",
  ".ipynb",
  ".pdf",
  ".xlsx",
  ".xls",
  ".csv",
  ".tsv",
  ".ods",
  ".pptx",
  ".ppt",
  ".odp",
  ".pages",
  ".numbers",
  ".key",
  ".keynote",
  ".docx",
  ".doc",
  ".odt",
  ".txt",
  ".log",
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
  ".ini",
  ".conf",
  ".env",
  ".graphql",
  ".gql",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".vue",
  ".svelte",
  ".css",
  ".scss",
  ".less",
  ".sql",
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
  ".scala",
  ".py",
  ".r",
  ".sh",
  ".bash",
  ".zsh",
  ".java",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
  ".go",
  ".rs",
  ".php",
  ".rb",
  ".swift",
  ".kt",
  ".kts",
  ".dart",
  ".lua",
  ".proto",
  ".mp3",
  ".wav",
  ".m4a",
  ".ogg",
  ".flac",
  ".mp4",
  ".mov",
  ".m4v",
  ".webm",
  "text/*",
  "image/*",
  "audio/*",
  "video/*",
  "application/pdf",
  "application/xhtml+xml",
  "application/rtf",
  "text/rtf",
  "application/epub+zip",
  "application/zip",
  "application/x-zip-compressed",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "text/tab-separated-values",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
  "application/vnd.oasis.opendocument.presentation",
  "application/vnd.apple.pages",
  "application/vnd.apple.numbers",
  "application/vnd.apple.keynote",
  "application/x-iwork-pages-sffpages",
  "application/x-iwork-numbers-sffnumbers",
  "application/x-iwork-keynote-sffkey",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.oasis.opendocument.text",
].join(",");
export const HTML_REPORT_ACCEPT = ".html,.htm,.xhtml,text/html,application/xhtml+xml";
export const MARKDOWN_FILE_ACCEPT =
  ".md,.markdown,.mdx,.mdown,.mkd,.mkdn,.rmd,.qmd,text/markdown,text/x-markdown,text/plain";

export interface FilePreviewImportProgress {
  status: "started" | "progress" | "done";
  total: number;
  completed: number;
  failed: number;
  currentFileName?: string;
}

export async function insertFilesAsPreviews(editor: Editor, files: File[]) {
  const total = files.length;
  let completed = 0;
  let failed = 0;

  if (total === 0) return;

  emitFilePreviewImportProgress({
    status: "started",
    total,
    completed,
    failed,
  });

  for (const file of files) {
    try {
      const stored = await savePageFile(file);
      editor
        .chain()
        .focus()
        .insertFilePreview({
          fileId: stored.id,
          fileName: stored.name,
          mimeType: stored.mimeType,
          kind: stored.kind,
          size: stored.size,
        })
        .run();
      recordInsertedFilePreviewReceipt(stored);
    } catch (err) {
      failed += 1;
      console.error("[Zhinote] Failed to import file preview:", err);
    } finally {
      completed += 1;
      emitFilePreviewImportProgress({
        status: "progress",
        total,
        completed,
        failed,
        currentFileName: file.name,
      });
    }
  }

  emitFilePreviewImportProgress({
    status: "done",
    total,
    completed,
    failed,
  });
}

export function promptAndInsertFilePreview(
  editor: Editor,
  opts?: { accept?: string; multiple?: boolean }
) {
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = opts?.multiple ?? true;
  if (opts?.accept !== undefined) {
    input.accept = opts.accept;
  }

  input.onchange = () => {
    const files = Array.from(input.files ?? []);
    if (files.length > 0) {
      void insertFilesAsPreviews(editor, files);
    }
  };

  input.click();
}

function recordInsertedFilePreviewReceipt(file: StoredPageFile) {
  appendFilePreviewActionReceipt(
    buildFilePreviewActionReceipt({
      file,
      action_kind: getInsertedFilePreviewActionKind(file),
      source_surface: "editor-file-preview",
      writes_page_content: true,
      confirmation_required: false,
      confirmation_matched: true,
      note:
        file.kind === "archive" || isDownloadRetainOnlyFile(file.kind, file.name)
          ? "文件已从编辑器插入为本地留存预览块；没有上传、转换或调用外部服务。"
          : "文件已从编辑器插入为本地文件预览块；没有上传、云同步或调用 AI。",
    })
  );
}

function getInsertedFilePreviewActionKind(
  file: Pick<StoredPageFile, "kind" | "name">
): FilePreviewActionKind {
  return isDownloadRetainOnlyFile(file.kind, file.name)
    ? "download-retain"
    : "native-preview";
}

function isDownloadRetainOnlyFile(kind: PageFileKind, fileName: string) {
  const lowerName = fileName.toLowerCase();
  return (
    kind === "archive" ||
    kind === "unknown" ||
    kind === "pages" ||
    kind === "numbers" ||
    kind === "keynote" ||
    (kind === "word" && lowerName.endsWith(".doc")) ||
    (kind === "presentation" && lowerName.endsWith(".ppt"))
  );
}

export function promptAndInsertHtmlReportPreview(editor: Editor) {
  promptAndInsertFilePreview(editor, {
    accept: HTML_REPORT_ACCEPT,
    multiple: true,
  });
}

export function promptAndInsertMarkdownFilePreview(editor: Editor) {
  promptAndInsertFilePreview(editor, {
    accept: MARKDOWN_FILE_ACCEPT,
    multiple: true,
  });
}

function emitFilePreviewImportProgress(detail: FilePreviewImportProgress) {
  window.dispatchEvent(
    new CustomEvent(FILE_PREVIEW_IMPORT_PROGRESS_EVENT, { detail })
  );
}

export function promptAndImportMarkdown(editor: Editor) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = MARKDOWN_FILE_ACCEPT;

  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;

    void file.text().then((markdown) => {
      editor.chain().focus().insertContent(markdownToHtml(markdown)).run();
    });
  };

  input.click();
}

export function promptAndInsertFileEmbed(editor: Editor) {
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.accept = FILE_PREVIEW_ACCEPT;

  input.onchange = () => {
    const files = Array.from(input.files ?? []);
    if (files.length > 0) {
      void insertFilesAsEmbeds(editor, files);
    }
  };

  input.click();
}

export async function insertFilesAsEmbeds(editor: Editor, files: File[]) {
  for (const file of files) {
    try {
      const stored = await savePageFile(file);
      editor
        .chain()
        .focus()
        .insertFileEmbed({
          fileId: stored.id,
          fileName: stored.name,
          mimeType: stored.mimeType,
          kind: stored.kind,
          size: stored.size,
        })
        .run();
      syncFileToCloud(stored).catch((err) => {
        const message =
          err instanceof FileEmbedSyncRequestTimeoutError
            ? err.message
            : "文件云同步失败；文件仍保存在本地。";
        console.warn("[Zhinote] File cloud sync:", message);
      });
    } catch (err) {
      console.error("[Zhinote] Failed to embed file:", err);
    }
  }
}

async function syncFileToCloud(stored: StoredPageFile) {
  markFileEmbedCloudSyncAttempt(stored);
  let recordedFailure = false;
  try {
    const res = await fetchFileEmbedSyncWithTimeout({
      action: "push",
      fileId: stored.id,
      fileName: stored.name,
      mimeType: stored.mimeType,
      kind: stored.kind,
      size: stored.size,
      dataUrl: stored.dataUrl,
      textContent: stored.textContent ?? null,
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };
      const message =
        data.message ?? data.error ?? "文件云同步失败；文件仍保存在本地。";
      markFileEmbedCloudSyncFailure(stored, message, {
        retryable: res.status !== 413,
      });
      recordedFailure = true;
      throw new Error(message);
    }
    markFileEmbedCloudSyncSuccess(stored.id);
  } catch (error) {
    if (!recordedFailure) {
      markFileEmbedCloudSyncFailure(
        stored,
        error instanceof Error
          ? error.message
          : "文件云同步失败；文件仍保存在本地。"
      );
    }
    throw error;
  }
}
