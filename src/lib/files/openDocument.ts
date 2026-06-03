"use client";

import { readZipEntries } from "./zipReader";

const textDecoder = new TextDecoder();

export async function convertOdtToHtml(arrayBuffer: ArrayBuffer) {
  const doc = await readOpenDocumentXml(arrayBuffer);
  if (!doc) {
    return "<p>这个 OpenDocument 文件没有可读取的内容。</p>";
  }

  if (doc.querySelector("parsererror")) {
    return "<p>这个 OpenDocument 文件无法解析。</p>";
  }

  const textRoot = Array.from(doc.getElementsByTagName("*")).find(
    (node) => node.localName === "text"
  );
  if (!textRoot) {
    return "<p>这个 OpenDocument 文件没有文本内容。</p>";
  }

  const html = Array.from(textRoot.childNodes).map(renderOdtBlock).join("").trim();
  return html || "<p>这个 OpenDocument 文件没有生成可见内容。</p>";
}

export async function convertOdpToHtml(arrayBuffer: ArrayBuffer) {
  const doc = await readOpenDocumentXml(arrayBuffer);
  if (!doc) {
    return "<p>这个 OpenDocument 演示文稿没有可读取的内容。</p>";
  }

  if (doc.querySelector("parsererror")) {
    return "<p>这个 OpenDocument 演示文稿无法解析。</p>";
  }

  const pages = Array.from(doc.getElementsByTagName("*")).filter(
    (node) => node.localName === "page"
  );

  if (pages.length === 0) {
    return "<p>这个 OpenDocument 演示文稿没有可读取的幻灯片。</p>";
  }

  const html = pages
    .map((page, index) => renderOdpSlide(page, index + 1))
    .filter(Boolean)
    .join("");

  return html || "<p>这个 OpenDocument 演示文稿没有生成可见文本内容。</p>";
}

async function readOpenDocumentXml(arrayBuffer: ArrayBuffer) {
  const entries = await readZipEntries(arrayBuffer);
  const contentEntry = entries.find((entry) => entry.path === "content.xml");

  if (!contentEntry) {
    return null;
  }

  const xml = textDecoder.decode(contentEntry.data);
  return new DOMParser().parseFromString(xml, "application/xml");
}

function renderOdpSlide(page: Element, slideNumber: number) {
  const paragraphs = collectOdtTextBlocks(page);
  if (paragraphs.length === 0) return "";

  const [title, ...body] = paragraphs;
  return `<section><h2>第 ${slideNumber} 页：${escapeHtml(
    title
  )}</h2>${
    body.length
      ? `<ul>${body.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`
      : ""
  }</section>`;
}

function collectOdtTextBlocks(root: Element) {
  return Array.from(root.getElementsByTagName("*"))
    .filter((node) => node.localName === "h" || node.localName === "p")
    .map((node) => odtInlineText(node).trim())
    .filter(Boolean);
}

function renderOdtBlock(node: Node): string {
  if (!(node instanceof Element)) return "";

  switch (node.localName) {
    case "h": {
      const level = normalizeHeadingLevel(
        node.getAttribute("text:outline-level") || node.getAttribute("outline-level")
      );
      const text = odtInlineText(node).trim();
      return text ? `<h${level}>${escapeHtml(text)}</h${level}>` : "";
    }
    case "p": {
      const text = odtInlineText(node).trim();
      return text ? `<p>${escapeHtml(text)}</p>` : "";
    }
    case "list":
      return renderOdtList(node);
    case "table":
      return renderOdtTable(node);
    default:
      return Array.from(node.childNodes).map(renderOdtBlock).join("");
  }
}

function renderOdtList(list: Element): string {
  const items = Array.from(list.childNodes)
    .filter((node): node is Element => node instanceof Element)
    .filter((node) => node.localName === "list-item")
    .map(renderOdtListItem)
    .filter(Boolean)
    .join("");

  return items ? `<ul>${items}</ul>` : "";
}

function renderOdtListItem(item: Element): string {
  const parts = Array.from(item.childNodes)
    .map((child) => {
      if (child instanceof Element && child.localName === "list") {
        return renderOdtList(child);
      }
      if (child instanceof Element && child.localName === "p") {
        const text = odtInlineText(child).trim();
        return text ? escapeHtml(text) : "";
      }
      return renderOdtBlock(child);
    })
    .filter(Boolean)
    .join("");

  return parts ? `<li>${parts}</li>` : "";
}

function renderOdtTable(table: Element) {
  const rows = Array.from(table.childNodes)
    .filter((node): node is Element => node instanceof Element)
    .filter((node) => node.localName === "table-row")
    .map((row) => {
      const cells = Array.from(row.childNodes)
        .filter((node): node is Element => node instanceof Element)
        .filter((node) => node.localName === "table-cell")
        .map((cell) => {
          const text = odtInlineText(cell).trim();
          return `<td>${escapeHtml(text)}</td>`;
        })
        .join("");
      return cells ? `<tr>${cells}</tr>` : "";
    })
    .filter(Boolean)
    .join("");

  return rows ? `<table><tbody>${rows}</tbody></table>` : "";
}

function odtInlineText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (!(node instanceof Element)) return "";

  if (node.localName === "line-break") return "\n";
  if (node.localName === "tab") return "\t";
  if (node.localName === "s") {
    const count = Number(node.getAttribute("text:c") || node.getAttribute("c") || "1");
    return " ".repeat(Math.max(1, Number.isFinite(count) ? count : 1));
  }

  return Array.from(node.childNodes).map(odtInlineText).join("");
}

function normalizeHeadingLevel(value: string | null) {
  const level = Number(value || "2");
  if (!Number.isFinite(level)) return 2;
  return Math.min(3, Math.max(1, level));
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
