"use client";

import {
  getAllDatabases,
  getAllPages,
  getBlockComments,
  getDeletedPages,
  getFields,
  getPageComments,
  getRows,
  getVersions,
  getViews,
} from "@/lib/db/local/queries";
import { listStoredPageFiles } from "@/lib/files/localStore";
import type { Page } from "@/lib/utils/types";
import {
  buildPageHtmlDocument,
  downloadTextFile,
  htmlToMarkdown,
} from "./pageExport";
import { downloadZip, type ZipFileInput } from "./zip";

export async function exportWorkspaceBackup() {
  const [pages, deletedPages, databases, storedFiles] = await Promise.all([
    getAllPages(),
    getDeletedPages(),
    getAllDatabases(),
    listStoredPageFiles().catch(() => []),
  ]);

  const pageIds = uniqueIds([...pages, ...deletedPages].map((page) => page.id));
  const [versionsByPageId, commentsByPageId, blockCommentsByPageId, databaseBackups] =
    await Promise.all([
      collectByPageId(pageIds, getVersions),
      collectByPageId(pageIds, getPageComments),
      collectByPageId(pageIds, getBlockComments),
      Promise.all(
        databases.map(async (database) => ({
          database,
          fields: await getFields(database.id),
          rows: await getRows(database.id),
          views: await getViews(database.id),
        }))
      ),
    ]);

  const backup = {
    format: "zhinote-workspace-backup",
    format_version: 1,
    exported_at: new Date().toISOString(),
    privacy_note:
      "This file is generated locally in the browser and may contain private page text and uploaded file data.",
    pages,
    deleted_pages: deletedPages,
    page_versions: versionsByPageId,
    page_comments: commentsByPageId,
    block_comments: blockCommentsByPageId,
    databases: databaseBackups,
    uploaded_files: storedFiles,
    local_preferences: getLocalPreferences(pageIds),
  };

  downloadJsonFile(
    `zhinote-workspace-backup-${fileSafeTimestamp()}.json`,
    backup
  );
}

export async function exportWorkspaceMarkdown() {
  const pages = await getAllPages();
  const pagesById = new Map(pages.map((page) => [page.id, page]));
  const content = pages.length
    ? pages
        .map((page) => pageToWorkspaceMarkdown(page, pagesById))
        .join("\n\n---\n\n")
    : "# ZhiNotes Workspace\n\nNo active pages.";

  downloadTextFile(
    `zhinote-workspace-pages-${fileSafeTimestamp()}.md`,
    "text/markdown;charset=utf-8",
    content
  );
}

export async function exportWorkspaceZip() {
  const [pages, storedFiles] = await Promise.all([
    getAllPages(),
    listStoredPageFiles().catch(() => []),
  ]);
  const pagesById = new Map(pages.map((page) => [page.id, page]));
  const usedPaths = new Set(["manifest.json", "index.html"]);
  const assetPathByFileId = new Map<string, string>();
  const assetFiles: ZipFileInput[] = [];

  for (const file of storedFiles) {
    const assetPath = uniquePath(
      `assets/${safeFileName(`${file.id}-${file.name}`)}`,
      usedPaths
    );
    assetPathByFileId.set(file.id, assetPath);
    assetFiles.push({
      path: assetPath,
      data: dataUrlToBytes(file.dataUrl),
      mimeType: file.mimeType,
    });
  }

  const manifest = {
    format: "zhinote-workspace-export",
    format_version: 1,
    exported_at: new Date().toISOString(),
    pages: pages.map((page) => ({
      id: page.id,
      title: page.title,
      path: getPagePath(page, pagesById),
      updated_at: page.updated_at,
    })),
    uploaded_files: storedFiles.map((file) => ({
      id: file.id,
      name: file.name,
      kind: file.kind,
      mimeType: file.mimeType,
      size: file.size,
      createdAt: file.createdAt,
      exportPath: assetPathByFileId.get(file.id) ?? null,
    })),
  };

  const files: ZipFileInput[] = [
    {
      path: "manifest.json",
      data: JSON.stringify(manifest, jsonReplacer, 2),
    },
    {
      path: "index.html",
      data: buildWorkspaceIndexHtml(pages, pagesById),
    },
  ];

  for (const page of pages) {
    const pagePath = uniquePath(
      `pages/${safePath(getPagePath(page, pagesById))}.html`,
      usedPaths
    );
    files.push({
      path: pagePath,
      data: buildPageHtmlDocument(
        page.title || "Untitled",
        rewriteFilePreviewReferences(
          page.content_text ?? "",
          pagePath,
          assetPathByFileId
        )
      ),
    });

    const markdownPath = uniquePath(
      `markdown/${safePath(getPagePath(page, pagesById))}.md`,
      usedPaths
    );
    files.push({
      path: markdownPath,
      data: pageToWorkspaceMarkdown(
        page,
        pagesById,
        markdownPath,
        assetPathByFileId
      ),
    });
  }

  files.push(...assetFiles);

  downloadZip(`zhinote-workspace-export-${fileSafeTimestamp()}.zip`, files);
}

function uniqueIds(ids: string[]) {
  return Array.from(new Set(ids));
}

async function collectByPageId<T>(
  pageIds: string[],
  loader: (pageId: string) => Promise<T[]>
) {
  const entries = await Promise.all(
    pageIds.map(async (pageId) => [pageId, await loader(pageId)] as const)
  );
  return Object.fromEntries(entries);
}

function downloadJsonFile(fileName: string, value: unknown) {
  const json = JSON.stringify(value, jsonReplacer, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function jsonReplacer(_key: string, value: unknown) {
  if (value instanceof Uint8Array) {
    return Array.from(value);
  }
  return value;
}

function fileSafeTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function pageToWorkspaceMarkdown(
  page: Page,
  pagesById: Map<string, Page>,
  markdownPath?: string,
  assetPathByFileId?: Map<string, string>
) {
  const path = getPagePath(page, pagesById);
  const contentHtml =
    markdownPath && assetPathByFileId
      ? rewriteFilePreviewReferences(
          page.content_text ?? "",
          markdownPath,
          assetPathByFileId
        )
      : page.content_text ?? "";
  const body = htmlToMarkdown(contentHtml);
  return [
    `# ${page.title || "Untitled"}`,
    "",
    `Path: ${path}`,
    `Updated: ${page.updated_at}`,
    "",
    body || "_Empty page_",
  ].join("\n");
}

function getPagePath(page: Page, pagesById: Map<string, Page>) {
  const parts = [page.title || "Untitled"];
  let parentId = page.parent_id;
  const seen = new Set<string>([page.id]);

  while (parentId) {
    if (seen.has(parentId)) break;
    seen.add(parentId);
    const parent = pagesById.get(parentId);
    if (!parent) break;
    parts.unshift(parent.title || "Untitled");
    parentId = parent.parent_id;
  }

  return parts.join(" / ");
}

function buildWorkspaceIndexHtml(pages: Page[], pagesById: Map<string, Page>) {
  const items = pages
    .map((page) => {
      const path = getPagePath(page, pagesById);
      return `<li><strong>${escapeHtml(page.title || "Untitled")}</strong><br /><span>${escapeHtml(path)}</span></li>`;
    })
    .join("\n");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ZhiNotes Export</title>
  <style>
    body { margin: 0 auto; max-width: 840px; padding: 48px 28px; color: #18181b; font: 15px/1.6 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    li { margin: 10px 0; }
    span { color: #71717a; }
  </style>
</head>
<body>
  <h1>ZhiNotes Export</h1>
  <p>Generated locally. See <code>pages/</code> for HTML pages, <code>markdown/</code> for Markdown pages, and <code>assets/</code> for uploaded files.</p>
  <ul>${items || "<li>No active pages.</li>"}</ul>
</body>
</html>`;
}

function rewriteFilePreviewReferences(
  contentHtml: string,
  pagePath: string,
  assetPathByFileId: Map<string, string>
) {
  if (!contentHtml.includes('data-type="file-preview"')) return contentHtml;

  const doc = new DOMParser().parseFromString(
    `<main>${contentHtml}</main>`,
    "text/html"
  );
  const root = doc.querySelector("main");
  if (!root) return contentHtml;

  root.querySelectorAll<HTMLElement>('[data-type="file-preview"]').forEach(
    (element) => {
      const fileId = element.getAttribute("data-file-id") || "";
      const assetPath = assetPathByFileId.get(fileId);
      if (!assetPath) return;

      const relativePath = relativeZipPath(pagePath, assetPath);
      const fileName = element.getAttribute("data-file-name") || "file";
      const kind = element.getAttribute("data-kind") || "file";

      element.setAttribute("data-asset-path", relativePath);
      if (kind === "image") {
        element.innerHTML = `<img src="${escapeHtml(relativePath)}" alt="${escapeHtml(fileName)}" />`;
      } else {
        element.innerHTML = `<p><a href="${escapeHtml(relativePath)}">${escapeHtml(fileName)}</a></p>`;
      }
    }
  );

  return root.innerHTML;
}

function relativeZipPath(fromFilePath: string, toFilePath: string) {
  const fromParts = fromFilePath.split("/").slice(0, -1);
  const toParts = toFilePath.split("/");
  let shared = 0;

  while (
    shared < fromParts.length &&
    shared < toParts.length &&
    fromParts[shared] === toParts[shared]
  ) {
    shared += 1;
  }

  const up = Array.from({ length: fromParts.length - shared }, () => "..");
  const down = toParts.slice(shared);
  return [...up, ...down].join("/") || ".";
}

function safePath(path: string) {
  return path
    .split(" / ")
    .map(safeFileName)
    .join("/");
}

function safeFileName(value: string) {
  return value.trim().replace(/[\\/:*?"<>|]+/g, "-").slice(0, 90) || "Untitled";
}

function uniquePath(path: string, usedPaths: Set<string>) {
  if (!usedPaths.has(path)) {
    usedPaths.add(path);
    return path;
  }

  const dotIndex = path.lastIndexOf(".");
  const base = dotIndex >= 0 ? path.slice(0, dotIndex) : path;
  const ext = dotIndex >= 0 ? path.slice(dotIndex) : "";
  let index = 2;
  let candidate = `${base}-${index}${ext}`;
  while (usedPaths.has(candidate)) {
    index += 1;
    candidate = `${base}-${index}${ext}`;
  }
  usedPaths.add(candidate);
  return candidate;
}

function dataUrlToBytes(dataUrl: string) {
  const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function getBackupPageCount(pages: Page[], deletedPages: Page[]) {
  return pages.length + deletedPages.length;
}

function getLocalPreferences(pageIds: string[]) {
  if (typeof window === "undefined") {
    return {
      favorite_page_ids: [],
      locked_page_ids: [],
      wide_page: false,
    };
  }

  return {
    favorite_page_ids: parseStringArray(
      window.localStorage.getItem("zhinote.page.favorites")
    ),
    locked_page_ids: pageIds.filter(
      (pageId) =>
        window.localStorage.getItem(`zhinote.page.locked.${pageId}`) === "true"
    ),
    wide_page: window.localStorage.getItem("zhinote.page.wide") === "true",
  };
}

function parseStringArray(value: string | null) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}
