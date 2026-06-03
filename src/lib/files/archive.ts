"use client";

import { formatFileSize } from "./localStore";
import { listZipEntries } from "./zipReader";

const ZIP_ENTRY_PREVIEW_LIMIT = 500;

export function convertZipToHtml(arrayBuffer: ArrayBuffer) {
  const entries = listZipEntries(arrayBuffer);
  if (entries.length === 0) {
    return "<p>这个 ZIP 压缩包是空的。</p>";
  }

  const visibleEntries = entries.slice(0, ZIP_ENTRY_PREVIEW_LIMIT);
  const directoryCount = entries.filter((entry) => entry.path.endsWith("/")).length;
  const fileCount = entries.length - directoryCount;
  const truncated =
    entries.length > visibleEntries.length
      ? `<p><small>仅显示前 ${visibleEntries.length} 个，共 ${entries.length} 个条目。</small></p>`
      : "";

  const rows = visibleEntries
    .map(
      (entry) =>
        `<tr><td>${escapeHtml(entry.path)}</td><td>${entry.path.endsWith("/") ? "文件夹" : "文件"}</td><td>${escapeHtml(
          formatFileSize(entry.compressedSize)
        )}</td><td>${escapeHtml(zipCompressionLabel(entry.compressionMethod))}</td></tr>`
    )
    .join("");

  return `<section><h2>压缩包内容</h2><p>${fileCount} 个文件，${directoryCount} 个文件夹。</p>${truncated}<table><thead><tr><th>路径</th><th>类型</th><th>压缩后大小</th><th>压缩方式</th></tr></thead><tbody>${rows}</tbody></table></section>`;
}

function zipCompressionLabel(method: number) {
  if (method === 0) return "未压缩";
  if (method === 8) return "Deflate";
  return `方式 ${method}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
