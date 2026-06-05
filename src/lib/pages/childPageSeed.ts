export function buildChildPageInitialHtml({
  parentPageId,
  parentTitle,
}: {
  parentPageId: string | null;
  parentTitle: string | null;
}) {
  const parentLabel = escapeHtml(parentTitle || "父页面");
  const parentLink = parentPageId
    ? `<p>父页面：<span data-type="mention" data-id="${escapeHtml(
        parentPageId
      )}" data-label="${parentLabel}">📄 ${parentLabel}</span></p>`
    : "";

  return `${parentLink}<p>开始记录...</p>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
