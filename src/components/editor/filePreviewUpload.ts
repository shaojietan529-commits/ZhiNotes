"use client";

import type { Editor } from "@tiptap/core";
import { savePageFile } from "@/lib/files/localStore";
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
  ".docx",
  ".doc",
  ".odt",
  ".txt",
  ".log",
  ".json",
  ".jsonl",
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
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.oasis.opendocument.text",
].join(",");
export const HTML_REPORT_ACCEPT = ".html,.htm,.xhtml,text/html,application/xhtml+xml";
export const MARKDOWN_FILE_ACCEPT =
  ".md,.markdown,.mdx,.mdown,.mkd,.mkdn,text/markdown,text/x-markdown,text/plain";

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
