"use client";

import { highlightCodeToHtml } from "@/lib/codeHighlight";

export function exportPageAsHtml(title: string, contentHtml: string) {
  downloadTextFile(
    `${safeFileName(title || "未命名页面")}.html`,
    "text/html;charset=utf-8",
    buildPageHtmlDocument(title, contentHtml)
  );
}

export function buildPageHtmlDocument(title: string, contentHtml: string) {
  const highlightedContentHtml = prepareExportContentHtml(contentHtml);

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title || "未命名页面")}</title>
  <style>
    body {
      margin: 0 auto;
      max-width: 760px;
      padding: 48px 28px;
      color: #18181b;
      font: 15px/1.65 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    h1, h2, h3 { line-height: 1.25; }
    img, table, iframe { max-width: 100%; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #d4d4d8; padding: 6px 8px; }
    blockquote { border-left: 3px solid #d4d4d8; margin-left: 0; padding-left: 12px; color: #52525b; }
    pre, code { background: #f4f4f5; border-radius: 4px; }
    pre { overflow: auto; padding: 12px; position: relative; }
    code { padding: 2px 4px; }
    pre code { background: transparent; padding: 0; }
    pre:has(> code[class*="language-"]) { padding-top: 34px; }
    pre:has(> code[class*="language-"])::before {
      background: rgba(255, 255, 255, 0.8);
      border: 1px solid #d4d4d8;
      border-radius: 999px;
      color: #52525b;
      content: "Code";
      font: 700 11px/1 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      padding: 4px 7px;
      position: absolute;
      right: 10px;
      top: 9px;
    }
    pre:has(> code.language-javascript)::before { content: "JavaScript"; }
    pre:has(> code.language-typescript)::before { content: "TypeScript"; }
    pre:has(> code.language-python)::before { content: "Python"; }
    pre:has(> code.language-sql)::before { content: "SQL"; }
    pre:has(> code.language-html)::before { content: "HTML"; }
    pre:has(> code.language-css)::before { content: "CSS"; }
    pre:has(> code.language-json)::before { content: "JSON"; }
    pre:has(> code.language-markdown)::before { content: "Markdown"; }
    pre:has(> code.language-yaml)::before { content: "YAML"; }
    pre:has(> code.language-toml)::before { content: "TOML"; }
    pre:has(> code.language-xml)::before { content: "XML"; }
    pre:has(> code.language-bash)::before { content: "Shell"; }
    pre:has(> code.language-java)::before { content: "Java"; }
    pre:has(> code.language-cpp)::before { content: "C / C++"; }
    pre:has(> code.language-go)::before { content: "Go"; }
    pre:has(> code.language-rust)::before { content: "Rust"; }
    pre:has(> code.language-php)::before { content: "PHP"; }
    pre:has(> code.language-ruby)::before { content: "Ruby"; }
    pre:has(> code.language-swift)::before { content: "Swift"; }
    pre:has(> code.language-kotlin)::before { content: "Kotlin"; }
    pre:has(> code.language-r)::before { content: "R"; }
    pre:has(> code.language-graphql)::before { content: "GraphQL"; }
    pre:has(> code.language-dockerfile)::before { content: "Dockerfile"; }
    pre:has(> code.language-makefile)::before { content: "Makefile"; }
    pre:has(> code.language-dart)::before { content: "Dart"; }
    pre:has(> code.language-lua)::before { content: "Lua"; }
    pre:has(> code.language-perl)::before { content: "Perl"; }
    pre:has(> code.language-protobuf)::before { content: "Protobuf"; }
    pre:has(> code.language-groovy)::before { content: "Groovy"; }
    pre:has(> code.language-log)::before { content: "Log"; }
    pre:has(> code.language-text)::before { content: "Plain"; }
    .zhinote-code-token { background: transparent; border-radius: 0; padding: 0; }
    .zhinote-code-keyword { color: #7c3aed; font-weight: 600; }
    .zhinote-code-string { color: #0f766e; }
    .zhinote-code-comment { color: #71717a; font-style: italic; }
    .zhinote-code-number { color: #c2410c; }
    .zhinote-code-operator { color: #9333ea; }
    .zhinote-code-function { color: #2563eb; }
    .zhinote-code-property { color: #b45309; }
    .zhinote-code-attribute { color: #b45309; }
    .zhinote-code-tag { color: #dc2626; font-weight: 600; }
    .zhinote-code-literal { color: #be123c; }
    .zhinote-code-builtin { color: #0369a1; }
    [data-type="inline-equation"] {
      background: #f4f4f5;
      border: 1px solid #e4e4e7;
      border-radius: 4px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      padding: 1px 5px;
    }
    [data-type="wiki-reference"] {
      background: #eff6ff;
      border: 1px solid #dbeafe;
      border-radius: 4px;
      color: #1d4ed8;
      font-weight: 600;
      padding: 1px 5px;
    }
    [data-inline-comment-id] {
      background: rgba(250, 204, 21, 0.24);
      border-bottom: 2px solid rgba(234, 179, 8, 0.55);
      border-radius: 2px;
    }
    [data-type="toggle-block"],
    [data-type="callout-block"],
    [data-type="file-preview"],
    [data-type="bookmark-block"],
    [data-type="equation-block"],
    [data-type="toc-block"],
    [data-type="breadcrumb-block"],
    [data-type="template-button"],
    [data-type="synced-block"],
    [data-type="embed-block"] {
      border: 1px solid #e4e4e7;
      border-radius: 8px;
      margin: 16px 0;
      padding: 12px;
    }
    [data-type="toggle-block"] { border-color: transparent; padding: 4px 0; }
    [data-toggle-summary] { font-weight: 600; margin-bottom: 6px; }
    [data-toggle-summary]::before { content: "> "; color: #71717a; }
    [data-toggle-content] {
      border-left: 2px solid #e4e4e7;
      margin-left: 12px;
      padding-left: 14px;
    }
    [data-type="callout-block"] { background: #eff6ff; border-color: #bfdbfe; }
    [data-type="callout-block"][data-tone="neutral"] { background: #f4f4f5; border-color: #d4d4d8; }
    [data-type="callout-block"][data-tone="yellow"] { background: #fefce8; border-color: #fde68a; }
    [data-type="callout-block"][data-tone="green"] { background: #f0fdf4; border-color: #bbf7d0; }
    [data-type="callout-block"][data-tone="red"] { background: #fef2f2; border-color: #fecaca; }
    [data-callout-icon] { display: inline-block; font-weight: 700; margin-right: 8px; }
    [data-callout-content] { display: inline-block; vertical-align: top; max-width: calc(100% - 40px); }
    [data-type="column-layout"] {
      display: grid;
      gap: 18px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      margin: 18px 0;
    }
    [data-type="column-block"] {
      min-width: 0;
    }
    [data-type="bookmark-block"] { background: #fafafa; }
    [data-type="equation-block"] {
      background: #fafafa;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      overflow-x: auto;
      white-space: pre-wrap;
    }
    [data-type="toc-block"] a {
      color: #2563eb;
      display: block;
      padding: 2px 0;
      text-decoration: none;
    }
    [data-type="file-preview"] {
      background: #fafafa;
      color: #52525b;
      font-size: 13px;
    }
    [data-type="breadcrumb-block"] {
      background: #fafafa;
      color: #52525b;
      font-size: 13px;
    }
    [data-type="template-button"] {
      background: #fafafa;
      color: #52525b;
      font-size: 13px;
    }
    [data-type="synced-block"] { background: #f0f9ff; border-color: #bae6fd; }
    [data-synced-label] { color: #0369a1; font-size: 12px; font-weight: 700; margin-bottom: 8px; }
    [data-type="embed-block"] { background: #fafafa; color: #52525b; }
    @media (max-width: 720px) {
      [data-type="column-layout"] { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(title || "未命名页面")}</h1>
  ${highlightedContentHtml}
</body>
</html>`;
}

export function exportPageAsMarkdown(title: string, contentHtml: string) {
  downloadTextFile(
    `${safeFileName(title || "未命名页面")}.md`,
    "text/markdown;charset=utf-8",
    `# ${title || "未命名页面"}\n\n${htmlToMarkdown(contentHtml)}`
  );
}

export function downloadTextFile(fileName: string, mimeType: string, content: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function htmlToMarkdown(html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  hydrateTableOfContents(doc);
  return Array.from(doc.body.childNodes)
    .map((node) => nodeToMarkdown(node).trimEnd())
    .filter(Boolean)
    .join("\n\n");
}

function nodeToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (!(node instanceof HTMLElement)) return "";

  const children = () =>
    Array.from(node.childNodes).map(nodeToMarkdown).join("").trim();

  switch (node.tagName.toLowerCase()) {
    case "h1":
      return `# ${children()}`;
    case "h2":
      return `## ${children()}`;
    case "h3":
      return `### ${children()}`;
    case "p":
      return children();
    case "strong":
    case "b":
      return `**${children()}**`;
    case "em":
    case "i":
      return `*${children()}*`;
    case "s":
    case "del":
    case "strike":
      return `~~${children()}~~`;
    case "mark":
      return `==${children()}==`;
    case "sup": {
      const footnoteReference = footnoteReferenceToMarkdown(node);
      return footnoteReference || children();
    }
    case "code":
      return markdownInlineCode(node.textContent ?? "");
    case "span":
      if (node.getAttribute("data-type") === "inline-equation") {
        const formula =
          node.getAttribute("data-formula") ||
          node.querySelector("[data-inline-equation-formula]")?.textContent ||
          node.textContent ||
          "";
        return markdownInlineEquation(formula);
      }
      if (node.getAttribute("data-type") === "wiki-reference") {
        const target =
          node.getAttribute("data-target") ||
          node.getAttribute("data-label") ||
          node.textContent?.replace(/^\[\[|\]\]$/g, "") ||
          "未命名页面";
        const label =
          node.getAttribute("data-label") ||
          node.textContent?.replace(/^\[\[|\]\]$/g, "") ||
          target;
        return markdownWikiReference(target, label);
      }
      return children();
    case "pre": {
      const code = node.querySelector("code");
      const language = getCodeLanguage(code);
      return `\`\`\`${language}\n${node.textContent?.trimEnd() ?? ""}\n\`\`\``;
    }
    case "blockquote":
      return children()
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
    case "ul":
      return listToMarkdown(node);
    case "ol":
      return listToMarkdown(node);
    case "li":
      return listItemContentToMarkdown(node);
    case "a": {
      if (node.getAttribute("data-type") === "mention") {
        const label =
          node.getAttribute("data-label") ||
          children() ||
          "未命名页面";
        return `[[${sanitizeWikiLinkLabel(label)}]]`;
      }
      const href = node.getAttribute("href");
      return href && isSafeExportUrl(href)
        ? `[${escapeMarkdownLinkText(children())}](${escapeMarkdownLinkDestination(
            href
          )})`
        : children();
    }
    case "img": {
      const src = node.getAttribute("src");
      const alt = node.getAttribute("alt") ?? "";
      return src
        ? `![${escapeMarkdownLinkText(alt)}](${escapeMarkdownLinkDestination(src)})`
        : "";
    }
    case "table":
      return tableToMarkdown(node);
    case "hr":
      return "---";
    case "section":
      if (node.getAttribute("data-type") === "footnotes") {
        return footnotesToMarkdown(node);
      }
      return Array.from(node.childNodes)
        .map(nodeToMarkdown)
        .filter(Boolean)
        .join("\n\n");
    case "div":
      if (node.getAttribute("data-type") === "column-layout") {
        const columns = Array.from(node.children).filter(
          (child): child is HTMLElement =>
            child instanceof HTMLElement &&
            child.getAttribute("data-type") === "column-block"
        );
        return columns
          .map((column, index) => {
            const markdown = nodeToMarkdown(column).trim();
            return `**Column ${index + 1}**${markdown ? `\n\n${markdown}` : ""}`;
          })
          .join("\n\n---\n\n");
      }
      if (node.getAttribute("data-type") === "column-block") {
        return Array.from(node.childNodes)
          .map(nodeToMarkdown)
          .filter(Boolean)
          .join("\n\n");
      }
      if (node.getAttribute("data-type") === "file-preview") {
        const fileName = node.getAttribute("data-file-name") ?? "file";
        const assetPath = node.getAttribute("data-asset-path");
        return assetPath
          ? `[${escapeMarkdownLinkText(fileName)}](${escapeMarkdownLinkDestination(
              assetPath
            )})`
          : `[File preview: ${fileName}]`;
      }
      if (node.getAttribute("data-type") === "toggle-block") {
        const summary =
          node.querySelector("[data-toggle-summary]")?.textContent?.trim() ||
          node.getAttribute("data-summary") ||
          "折叠项";
        const content =
          node.querySelector("[data-toggle-content]") ??
          node.querySelector("[data-toggle-body]");
        const markdown = content ? nodeToMarkdown(content).trim() : "";
        return `<details open>\n<summary>${escapeHtml(
          summary
        )}</summary>${markdown ? `\n\n${markdown}` : ""}\n</details>`;
      }
      if (node.getAttribute("data-type") === "callout-block") {
        const tone = node.getAttribute("data-tone") || "blue";
        const content =
          node.querySelector("[data-callout-content]") ??
          node.querySelector("[data-callout-text]");
        const markdown = content ? nodeToMarkdown(content).trim() : "";
        return `> [!${getMarkdownCalloutType(tone)}]${
          markdown ? `\n${prefixLines(markdown, "> ")}` : ""
        }`;
      }
      if (node.getAttribute("data-type") === "toc-block") {
        const links = Array.from(node.querySelectorAll("[data-toc-link]"));
        if (links.length === 0) return "[目录]";
        return links
          .map((link) => {
            if (!(link instanceof HTMLElement)) return "";
            const level = Number(link.getAttribute("data-level") || "1");
            const text = link.textContent?.trim() || "未命名页面";
            const href = link.getAttribute("href") || "";
            const indent = "  ".repeat(Math.max(0, level - 1));
            return `${indent}- ${href ? `[${text}](${href})` : text}`;
          })
          .filter(Boolean)
          .join("\n");
      }
      if (node.getAttribute("data-type") === "breadcrumb-block") {
        const path = node.getAttribute("data-path") || "页面路径";
        return `页面路径：${path}`;
      }
      if (node.getAttribute("data-type") === "bookmark-block") {
        const url = node.getAttribute("data-url") || "";
        const title = node.getAttribute("data-title") || url || "书签";
        const description = node.getAttribute("data-description") || "";
        return `${
          url && isSafeExportUrl(url)
            ? `[${escapeMarkdownLinkText(title)}](${escapeMarkdownLinkDestination(url)})`
            : title
        }${description ? `\n\n${description}` : ""}`;
      }
      if (node.getAttribute("data-type") === "equation-block") {
        const formula =
          node.getAttribute("data-formula") ||
          node.querySelector("[data-equation-formula]")?.textContent ||
          "";
        return `$$\n${formula}\n$$`;
      }
      if (node.getAttribute("data-type") === "template-button") {
        return `[模板按钮：${
          node.getAttribute("data-label") || "插入模板"
        }]`;
      }
      if (node.getAttribute("data-type") === "synced-block") {
        const syncId = node.getAttribute("data-sync-id") || "";
        const content = node.querySelector("[data-synced-content]");
        const markdown = content ? nodeToMarkdown(content).trim() : children();
        return `> 同步块${syncId ? ` (${syncId})` : ""}${
          markdown ? `\n>\n${prefixLines(markdown, "> ")}` : ""
        }`;
      }
      if (node.getAttribute("data-type") === "embed-block") {
        const url = node.getAttribute("data-url") || "";
        const caption = node.getAttribute("data-caption") || "嵌入";
        return url && isSafeExportUrl(url)
          ? `[${escapeMarkdownLinkText(caption)}](${escapeMarkdownLinkDestination(url)})`
          : `[嵌入：${caption}]`;
      }
      return Array.from(node.childNodes)
        .map(nodeToMarkdown)
        .filter(Boolean)
        .join("\n");
    default:
      return children();
  }
}

function safeFileName(value: string) {
  return value.trim().replace(/[\\/:*?"<>|]+/g, "-").slice(0, 80) || "未命名页面";
}

function prefixLines(value: string, prefix: string) {
  return value
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");
}

function listToMarkdown(list: HTMLElement, depth = 0): string {
  const ordered = list.tagName.toLowerCase() === "ol";
  const taskList = list.getAttribute("data-type") === "taskList";
  return Array.from(list.children)
    .filter((child): child is HTMLElement => child instanceof HTMLElement)
    .map((item, index) => {
      const marker = getListMarker(item, index, ordered, taskList);
      const content = listItemContentToMarkdown(item);
      const nestedLists = Array.from(item.children).filter(
        (child): child is HTMLElement =>
          child instanceof HTMLElement &&
          ["ul", "ol"].includes(child.tagName.toLowerCase())
      );
      const line = `${"  ".repeat(depth)}${marker} ${content || " "}`.trimEnd();
      const nested = nestedLists
        .map((nestedList) => listToMarkdown(nestedList, depth + 1))
        .filter(Boolean)
        .join("\n");
      return nested ? `${line}\n${nested}` : line;
    })
    .join("\n");
}

function getListMarker(
  item: HTMLElement,
  index: number,
  ordered: boolean,
  taskList: boolean
) {
  if (taskList) {
    const checked =
      item.getAttribute("data-checked") === "true" ||
      item.querySelector("input[type='checkbox']")?.hasAttribute("checked");
    return `- [${checked ? "x" : " "}]`;
  }
  return ordered ? `${index + 1}.` : "-";
}

function listItemContentToMarkdown(item: HTMLElement): string {
  return Array.from(item.childNodes)
    .filter((child) => {
      return !(
        child instanceof HTMLElement &&
        ["ul", "ol"].includes(child.tagName.toLowerCase())
      );
    })
    .map(nodeToMarkdown)
    .join("")
    .trim();
}

function tableToMarkdown(table: HTMLElement) {
  const rows = Array.from(table.querySelectorAll("tr"))
    .map((row) =>
      Array.from(row.children)
        .filter((cell) => ["td", "th"].includes(cell.tagName.toLowerCase()))
        .map((cell) => normalizeMarkdownTableCell(nodeToMarkdown(cell)))
    )
    .filter((row) => row.length > 0);

  if (rows.length === 0) return "";

  const columnCount = Math.max(...rows.map((row) => row.length));
  const [header, ...bodyRows] = rows;
  const separator = Array.from({ length: columnCount }, () => "---");
  return [
    markdownTableRow(header, columnCount),
    markdownTableRow(separator, columnCount),
    ...bodyRows.map((row) => markdownTableRow(row, columnCount)),
  ].join("\n");
}

function markdownTableRow(cells: string[], columnCount: number) {
  const paddedCells = Array.from({ length: columnCount }, (_, index) => cells[index] ?? "");
  return `| ${paddedCells.join(" | ")} |`;
}

function normalizeMarkdownTableCell(value: string) {
  return value.replace(/\|/g, "\\|").replace(/\s*\n+\s*/g, " ").trim();
}

function footnoteReferenceToMarkdown(node: HTMLElement) {
  const href =
    node.querySelector('a[href^="#fn-"]')?.getAttribute("href") ||
    node.getAttribute("href") ||
    "";
  const id =
    href.replace(/^#fn-/, "") ||
    node.id.replace(/^fnref-/, "") ||
    node.textContent?.trim() ||
    "";

  return id ? `[^${sanitizeFootnoteId(id)}]` : "";
}

function footnotesToMarkdown(section: HTMLElement) {
  const list = Array.from(section.children).find(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && child.tagName.toLowerCase() === "ol"
  );
  const items = Array.from(list?.children ?? []).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && child.tagName.toLowerCase() === "li"
  );

  return items
    .map((item, index) => {
      const id = sanitizeFootnoteId(item.id.replace(/^fn-/, "")) || String(index + 1);
      const markdown = Array.from(item.childNodes)
        .filter((child) => !isFootnoteNumberMarker(child))
        .filter((child) => !isFootnoteBackLink(child))
        .map(nodeToMarkdown)
        .map((value) => value.trimEnd())
        .filter(Boolean)
        .join("\n\n")
        .trim();
      return `[^${id}]: ${formatFootnoteDefinition(markdown)}`;
    })
    .filter(Boolean)
    .join("\n\n");
}

function isFootnoteNumberMarker(node: Node) {
  if (!(node instanceof HTMLElement)) return false;
  if (node.tagName.toLowerCase() !== "p") return false;
  return /^\d+\.$/.test(node.textContent?.trim() ?? "");
}

function isFootnoteBackLink(node: Node) {
  if (!(node instanceof HTMLElement)) return false;
  const backLink = node.querySelector('a[href^="#fnref-"]');
  return Boolean(backLink && /^back$/i.test(node.textContent?.trim() ?? ""));
}

function formatFootnoteDefinition(markdown: string) {
  if (!markdown) return "";
  return markdown.replace(/\n/g, "\n    ");
}

function sanitizeFootnoteId(value: string) {
  return value.trim().replace(/^\#?fn-/, "").replace(/\s+/g, "-");
}

function getCodeLanguage(code: HTMLElement | null) {
  if (!code) return "";
  const languageClass = Array.from(code.classList).find((className) =>
    className.startsWith("language-")
  );
  return languageClass ? languageClass.replace(/^language-/, "") : "";
}

function prepareExportContentHtml(contentHtml: string) {
  const doc = new DOMParser().parseFromString(contentHtml, "text/html");
  hydrateTableOfContents(doc);
  for (const code of Array.from(doc.querySelectorAll("pre > code"))) {
    if (!(code instanceof HTMLElement)) continue;
    const language = getCodeLanguage(code);
    const text = code.textContent ?? "";
    code.innerHTML = highlightCodeToHtml(text, language);
  }
  return doc.body.innerHTML;
}

function hydrateTableOfContents(doc: Document) {
  const headings = Array.from(doc.body.querySelectorAll("h1, h2, h3"))
    .filter((heading): heading is HTMLHeadingElement =>
      heading instanceof HTMLHeadingElement
    )
    .map((heading, index) => {
      const text = heading.textContent?.trim() || `Heading ${index + 1}`;
      const level = Number(heading.tagName.slice(1));
      const id =
        heading.id ||
        heading.getAttribute("data-block-id") ||
        uniqueHeadingId(text, index);
      heading.id = id;
      return { id, level, text };
    });

  for (const toc of Array.from(doc.body.querySelectorAll('[data-type="toc-block"]'))) {
    if (!(toc instanceof HTMLElement)) continue;
    if (headings.length === 0) {
      toc.innerHTML = "<p>这个页面还没有标题。</p>";
      continue;
    }
    toc.innerHTML = `<p><strong>目录</strong></p><nav>${headings
      .map(
        (heading) =>
          `<a data-toc-link="true" data-level="${heading.level}" href="#${escapeHtml(
            heading.id
          )}" style="display:block;padding-left:${Math.max(
            0,
            heading.level - 1
          ) * 14}px">${escapeHtml(heading.text)}</a>`
      )
      .join("")}</nav>`;
  }
}

function uniqueHeadingId(text: string, index: number) {
  const slug =
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "heading";
  return `${slug}-${index + 1}`;
}

function getMarkdownCalloutType(tone: string) {
  switch (tone) {
    case "red":
      return "DANGER";
    case "yellow":
      return "WARNING";
    case "green":
      return "TIP";
    case "neutral":
      return "NOTE";
    case "blue":
    default:
      return "NOTE";
  }
}

function sanitizeWikiLinkLabel(label: string) {
  return label.replace(/\s+/g, " ").replace(/\]\]/g, ")").trim() || "未命名页面";
}

function markdownInlineCode(value: string) {
  if (!value.includes("`")) return `\`${value}\``;
  const longestRun = Math.max(...Array.from(value.matchAll(/`+/g), (match) => match[0].length));
  const fence = "`".repeat(longestRun + 1);
  return `${fence} ${value} ${fence}`;
}

function markdownInlineEquation(value: string) {
  const formula = value.trim();
  if (!formula.includes("$")) return `$${formula}$`;
  return `\\(${formula}\\)`;
}

function markdownWikiReference(target: string, label: string) {
  const cleanTarget = sanitizeWikiLinkLabel(target);
  const cleanLabel = sanitizeWikiLinkLabel(label);
  if (cleanTarget && cleanLabel && cleanTarget !== cleanLabel) {
    return `[[${cleanTarget}|${cleanLabel}]]`;
  }
  return `[[${cleanLabel || cleanTarget || "未命名页面"}]]`;
}

function escapeMarkdownLinkText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\[/g, "\\[").replace(/]/g, "\\]");
}

function escapeMarkdownLinkDestination(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\)/g, "\\)");
}

function isSafeExportUrl(url: string) {
  return /^(https?:|mailto:|#|\/)/i.test(url.trim());
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
