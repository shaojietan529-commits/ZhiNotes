"use client";

import { readZipEntries } from "./zipReader";

interface EpubFileMap {
  basePath: string;
  files: Map<string, string>;
}

const textDecoder = new TextDecoder();
const EPUB_CHAPTER_LIMIT = 50;

export async function convertEpubToHtml(arrayBuffer: ArrayBuffer) {
  const entries = await readZipEntries(arrayBuffer);
  const fileMap = createEpubFileMap(entries);
  const opfPath = getEpubOpfPath(fileMap.files.get("META-INF/container.xml"));

  if (!opfPath) {
    return "<p>这个 EPUB 文件没有可读取的目录清单。</p>";
  }

  const opfXml = fileMap.files.get(opfPath);
  if (!opfXml) {
    return "<p>这个 EPUB 的目录清单无法加载。</p>";
  }

  const opf = new DOMParser().parseFromString(opfXml, "application/xml");
  if (opf.querySelector("parsererror")) {
    return "<p>这个 EPUB 的目录清单无法解析。</p>";
  }

  const spinePaths = getEpubSpinePaths(opf, opfPath).slice(0, EPUB_CHAPTER_LIMIT);
  if (spinePaths.length === 0) {
    return "<p>这个 EPUB 文件没有可读取的章节引用。</p>";
  }

  const chapters = spinePaths
    .map((path, index) => renderEpubChapter(fileMap.files.get(path), index + 1))
    .filter(Boolean)
    .join("");

  return chapters || "<p>这个 EPUB 文件没有生成可见章节文本。</p>";
}

function createEpubFileMap(entries: Array<{ path: string; data: Uint8Array }>): EpubFileMap {
  const files = new Map<string, string>();
  for (const entry of entries) {
    files.set(normalizeZipPath(entry.path), textDecoder.decode(entry.data));
  }
  return { basePath: "", files };
}

function getEpubOpfPath(containerXml: string | undefined) {
  if (!containerXml) return "";
  const doc = new DOMParser().parseFromString(containerXml, "application/xml");
  if (doc.querySelector("parsererror")) return "";

  const rootfile = Array.from(doc.getElementsByTagName("*")).find(
    (node) => node.localName === "rootfile"
  );
  return normalizeZipPath(rootfile?.getAttribute("full-path") ?? "");
}

function getEpubSpinePaths(opf: Document, opfPath: string) {
  const basePath = opfPath.includes("/")
    ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1)
    : "";
  const manifest = new Map<string, string>();

  for (const item of Array.from(opf.getElementsByTagName("*")).filter(
    (node) => node.localName === "item"
  )) {
    const id = item.getAttribute("id");
    const href = item.getAttribute("href");
    if (!id || !href) continue;
    manifest.set(id, normalizeZipPath(`${basePath}${href}`));
  }

  return Array.from(opf.getElementsByTagName("*"))
    .filter((node) => node.localName === "itemref")
    .map((itemref) => itemref.getAttribute("idref") ?? "")
    .map((idref) => manifest.get(idref) ?? "")
    .filter(Boolean);
}

function renderEpubChapter(markup: string | undefined, chapterNumber: number) {
  if (!markup) return "";

  const doc = new DOMParser().parseFromString(markup, "text/html");
  const body = doc.body;
  if (!body) return "";

  const bodyHtml = Array.from(body.childNodes).map(renderEpubNode).join("").trim();
  if (!bodyHtml) return "";

  const title =
    body.querySelector("h1, h2, h3")?.textContent?.replace(/\s+/g, " ").trim() ||
    `第 ${chapterNumber} 章`;

  return `<section><h2>${escapeHtml(title)}</h2>${bodyHtml}</section>`;
}

function renderEpubNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent ?? "");
  if (!(node instanceof Element)) return "";

  const children = () => Array.from(node.childNodes).map(renderEpubNode).join("");
  const childHtml = children().trim();

  switch (node.localName.toLowerCase()) {
    case "h1":
      return childHtml ? `<h1>${childHtml}</h1>` : "";
    case "h2":
      return childHtml ? `<h2>${childHtml}</h2>` : "";
    case "h3":
    case "h4":
    case "h5":
    case "h6":
      return childHtml ? `<h3>${childHtml}</h3>` : "";
    case "p":
      return childHtml ? `<p>${childHtml}</p>` : "";
    case "br":
      return "<br />";
    case "strong":
    case "b":
      return childHtml ? `<strong>${childHtml}</strong>` : "";
    case "em":
    case "i":
      return childHtml ? `<em>${childHtml}</em>` : "";
    case "blockquote":
      return childHtml ? `<blockquote>${childHtml}</blockquote>` : "";
    case "ul":
      return childHtml ? `<ul>${childHtml}</ul>` : "";
    case "ol":
      return childHtml ? `<ol>${childHtml}</ol>` : "";
    case "li":
      return childHtml ? `<li>${childHtml}</li>` : "";
    case "table":
      return childHtml ? `<table>${childHtml}</table>` : "";
    case "thead":
    case "tbody":
      return childHtml;
    case "tr":
      return childHtml ? `<tr>${childHtml}</tr>` : "";
    case "th":
      return childHtml ? `<th>${childHtml}</th>` : "";
    case "td":
      return childHtml ? `<td>${childHtml}</td>` : "";
    case "a":
    case "span":
    case "section":
    case "article":
    case "div":
      return childHtml;
    case "img": {
      const alt = node.getAttribute("alt")?.trim();
      return alt ? `<p>[图片：${escapeHtml(alt)}]</p>` : "";
    }
    default:
      return "";
  }
}

function normalizeZipPath(path: string) {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
