import type { StoredPageFile } from "./localStore";

export function createFilePreviewBlockHtml(
  file: StoredPageFile,
  opts?: { allowExternalResources?: boolean }
) {
  return `<div data-type="file-preview" data-file-id="${escapeHtmlAttribute(
    file.id
  )}" data-file-name="${escapeHtmlAttribute(
    file.name
  )}" data-mime-type="${escapeHtmlAttribute(
    file.mimeType
  )}" data-kind="${escapeHtmlAttribute(file.kind)}" data-size="${file.size}" data-allow-external-resources="${String(
    Boolean(opts?.allowExternalResources)
  )}"></div>`;
}

function escapeHtmlAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
