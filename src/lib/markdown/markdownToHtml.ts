interface MarkdownFootnote {
  content: string;
  id: string;
}

interface MarkdownLinkDefinition {
  id: string;
  title: string;
  url: string;
}

interface MarkdownToHtmlOptions {
  footnotes?: MarkdownFootnote[];
  linkDefinitions?: MarkdownLinkDefinition[];
  skipFootnotes?: boolean;
}

export function markdownToHtml(
  markdown: string,
  options: MarkdownToHtmlOptions = {}
) {
  let lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let inCode = false;
  let codeFenceMarker: "```" | "~~~" | "" = "";
  let codeLanguage = "";
  let codeLines: string[] = [];
  let inMath = false;
  let mathLines: string[] = [];
  let listType: "ul" | "ol" | "task" | null = null;
  let startIndex = 0;

  const closeList = () => {
    if (!listType) return;
    html.push(listType === "task" ? "</ul>" : `</${listType}>`);
    listType = null;
  };

  const frontmatterEnd = findFrontmatterEnd(lines);
  if (frontmatterEnd !== -1) {
    html.push(renderFrontmatterBlock(lines.slice(1, frontmatterEnd)));
    startIndex = frontmatterEnd + 1;
  }

  const footnoteExtraction = options.footnotes
    ? { lines, footnotes: options.footnotes }
    : extractMarkdownFootnotes(lines, startIndex);
  lines = footnoteExtraction.lines;
  const footnotes = footnoteExtraction.footnotes;
  const linkDefinitionExtraction = options.linkDefinitions
    ? { lines, linkDefinitions: options.linkDefinitions }
    : extractMarkdownLinkDefinitions(lines, startIndex);
  lines = linkDefinitionExtraction.lines;
  const linkDefinitions = linkDefinitionExtraction.linkDefinitions;

  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index];

    const codeFence = /^(```|~~~)\s*([A-Za-z0-9_+#.-]+)?\s*$/.exec(
      line.trim()
    );
    if (codeFence) {
      if (inCode) {
        if (codeFence[1] !== codeFenceMarker) {
          codeLines.push(line);
          continue;
        }
        html.push(renderCodeBlock(codeLines, codeLanguage));
        codeLines = [];
        codeFenceMarker = "";
        codeLanguage = "";
        inCode = false;
      } else {
        closeList();
        inCode = true;
        codeFenceMarker = codeFence[1] as "```" | "~~~";
        codeLanguage = sanitizeCodeLanguage(codeFence[2] ?? "");
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    const singleLineMath = /^\$\$\s*(.+?)\s*\$\$$/.exec(line.trim());
    if (singleLineMath) {
      closeList();
      html.push(renderEquationBlock([singleLineMath[1]]));
      continue;
    }

    if (line.trim() === "$$") {
      if (inMath) {
        html.push(renderEquationBlock(mathLines));
        mathLines = [];
        inMath = false;
      } else {
        closeList();
        inMath = true;
      }
      continue;
    }

    if (inMath) {
      mathLines.push(line);
      continue;
    }

    if (/^<details(?:\s+[^>]*)?>\s*$/i.test(line.trim())) {
      closeList();
      const detailsLines: string[] = [];
      let summary = "折叠项";

      while (index + 1 < lines.length) {
        index += 1;
        const detailsLine = lines[index];
        if (/^<\/details>\s*$/i.test(detailsLine.trim())) break;

        const summaryMatch = /^<summary>([\s\S]*)<\/summary>\s*$/i.exec(
          detailsLine.trim()
        );
        if (summaryMatch) {
          summary = summaryMatch[1].trim() || "折叠项";
        } else {
          detailsLines.push(detailsLine);
        }
      }

      html.push(
        renderToggleBlock(
          summary,
          markdownToHtml(detailsLines.join("\n"), {
            footnotes,
            linkDefinitions,
            skipFootnotes: true,
          })
        )
      );
      continue;
    }

    if (!line.trim()) {
      closeList();
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      closeList();
      const level = Math.min(heading[1].length, 3);
      html.push(
        `<h${level}>${renderInlineMarkdown(
          cleanHeadingText(heading[2]),
          footnotes,
          linkDefinitions
        )}</h${level}>`
      );
      continue;
    }

    const setextHeading = parseSetextHeading(line, lines[index + 1]);
    if (setextHeading) {
      closeList();
      html.push(
        `<h${setextHeading.level}>${renderInlineMarkdown(
          setextHeading.text,
          footnotes,
          linkDefinitions
        )}</h${setextHeading.level}>`
      );
      index += 1;
      continue;
    }

    if (isMarkdownTable(line, lines[index + 1])) {
      closeList();
      const headers = splitTableRow(line);
      index += 2;
      const rows: string[][] = [];

      while (index < lines.length && isTableRow(lines[index])) {
        rows.push(splitTableRow(lines[index]));
        index += 1;
      }
      index -= 1;

      html.push(renderTable(headers, rows, footnotes, linkDefinitions));
      continue;
    }

    if (/^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
      closeList();
      html.push("<hr />");
      continue;
    }

    const callout = parseMarkdownCalloutStart(line);
    if (callout) {
      closeList();
      const bodyLines: string[] = [];
      if (callout.title) bodyLines.push(`**${callout.title}**`, "");

      while (index + 1 < lines.length) {
        const nextLine = lines[index + 1];
        const quotedLine = /^>\s?(.*)$/.exec(nextLine);
        if (!quotedLine) break;
        index += 1;
        bodyLines.push(quotedLine[1]);
      }

      const fallback = `<p>${escapeHtml(callout.label)}</p>`;
      const bodyMarkdown = bodyLines.join("\n").trim();
      html.push(
        renderCalloutBlock(
          callout.icon,
          callout.tone,
          bodyMarkdown
            ? markdownToHtml(bodyMarkdown, {
                footnotes,
                linkDefinitions,
                skipFootnotes: true,
              })
            : fallback
        )
      );
      continue;
    }

    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      closeList();
      const quoteLines = [quote[1]];

      while (index + 1 < lines.length) {
        const nextLine = /^>\s?(.*)$/.exec(lines[index + 1]);
        if (!nextLine) break;
        index += 1;
        quoteLines.push(nextLine[1]);
      }

      html.push(
        `<blockquote>${markdownToHtml(quoteLines.join("\n"), {
          footnotes,
          linkDefinitions,
          skipFootnotes: true,
        })}</blockquote>`
      );
      continue;
    }

    const listItem = parseMarkdownListItem(line);
    if (listItem) {
      closeList();
      const listBlock = renderMarkdownListBlock(
        lines,
        index,
        footnotes,
        linkDefinitions
      );
      html.push(listBlock.html);
      index = listBlock.nextIndex - 1;
      continue;
    }

    const task = /^\s*[-*+]\s+\[([ xX])]\s+(.+)$/.exec(line);
    if (task) {
      if (listType !== "task") {
        closeList();
        listType = "task";
        html.push('<ul data-type="taskList">');
      }
      const checked = task[1].toLowerCase() === "x" ? "true" : "false";
      html.push(
        `<li data-type="taskItem" data-checked="${checked}"><label><input type="checkbox" ${
          checked === "true" ? "checked" : ""
        } /></label><div><p>${renderInlineMarkdown(
          task[2],
          footnotes,
          linkDefinitions
        )}</p></div></li>`
      );
      continue;
    }

    const unordered = /^\s*[-*+]\s+(.+)$/.exec(line);
    if (unordered) {
      if (listType !== "ul") {
        closeList();
        listType = "ul";
        html.push("<ul>");
      }
      html.push(
        `<li>${renderInlineMarkdown(
          unordered[1],
          footnotes,
          linkDefinitions
        )}</li>`
      );
      continue;
    }

    const ordered = /^\s*\d+[.)]\s+(.+)$/.exec(line);
    if (ordered) {
      if (listType !== "ol") {
        closeList();
        listType = "ol";
        html.push("<ol>");
      }
      html.push(
        `<li>${renderInlineMarkdown(
          ordered[1],
          footnotes,
          linkDefinitions
        )}</li>`
      );
      continue;
    }

    closeList();
    html.push(`<p>${renderInlineMarkdown(line, footnotes, linkDefinitions)}</p>`);
  }

  if (inCode) {
    html.push(renderCodeBlock(codeLines, codeLanguage));
  }
  if (inMath) {
    html.push(renderEquationBlock(mathLines));
  }
  closeList();
  if (!options.skipFootnotes && footnotes.length > 0) {
    html.push(renderFootnotesBlock(footnotes));
  }

  return html.join("\n");
}

function renderCodeBlock(lines: string[], language: string) {
  const languageClass = language ? ` class="language-${escapeHtml(language)}"` : "";
  return `<pre><code${languageClass}>${escapeHtml(lines.join("\n"))}</code></pre>`;
}

function renderEquationBlock(lines: string[]) {
  const formula = lines.join("\n").trim();
  return `<div data-type="equation-block" data-formula="${escapeHtml(formula)}"><code data-equation-formula>${escapeHtml(formula)}</code></div>`;
}

function renderFrontmatterBlock(lines: string[]) {
  return renderCalloutBlock(
    "i",
    "neutral",
    `<p><strong>Metadata</strong></p>${renderCodeBlock(lines, "yaml")}`
  );
}

function renderToggleBlock(summary: string, innerHtml: string) {
  const safeSummary = escapeHtml(summary);
  return `<div data-type="toggle-block" data-summary="${safeSummary}" data-open="true"><div data-toggle-summary>${safeSummary}</div><div data-toggle-content>${innerHtml}</div></div>`;
}

function renderCalloutBlock(icon: string, tone: string, innerHtml: string) {
  return `<div data-type="callout-block" data-icon="${escapeHtml(
    icon
  )}" data-tone="${escapeHtml(tone)}">${innerHtml}</div>`;
}

type MarkdownListKind = "ol" | "task" | "ul";

interface MarkdownListItem {
  checked?: boolean;
  indent: number;
  kind: MarkdownListKind;
  text: string;
}

function renderMarkdownListBlock(
  lines: string[],
  startIndex: number,
  footnotes: MarkdownFootnote[],
  linkDefinitions: MarkdownLinkDefinition[]
) {
  const firstItem = parseMarkdownListItem(lines[startIndex]);
  if (!firstItem) return { html: "", nextIndex: startIndex + 1 };
  return renderMarkdownListAt(
    lines,
    startIndex,
    firstItem.indent,
    firstItem.kind,
    footnotes,
    linkDefinitions
  );
}

function renderMarkdownListAt(
  lines: string[],
  startIndex: number,
  indent: number,
  kind: MarkdownListKind,
  footnotes: MarkdownFootnote[],
  linkDefinitions: MarkdownLinkDefinition[]
): { html: string; nextIndex: number } {
  const items: string[] = [];
  let index = startIndex;

  while (index < lines.length) {
    if (!lines[index].trim()) break;

    const item = parseMarkdownListItem(lines[index]);
    if (!item || item.indent !== indent || item.kind !== kind) break;

    index += 1;
    const nested: string[] = [];
    while (index < lines.length) {
      const nextItem = parseMarkdownListItem(lines[index]);
      if (!nextItem || nextItem.indent <= indent) break;
      const nestedList = renderMarkdownListAt(
        lines,
        index,
        nextItem.indent,
        nextItem.kind,
        footnotes,
        linkDefinitions
      );
      nested.push(nestedList.html);
      index = nestedList.nextIndex;
    }

    items.push(
      renderMarkdownListItem(item, nested.join(""), footnotes, linkDefinitions)
    );
  }

  return {
    html: `${getMarkdownListOpenTag(kind)}${items.join("")}${getMarkdownListCloseTag(
      kind
    )}`,
    nextIndex: index,
  };
}

function renderMarkdownListItem(
  item: MarkdownListItem,
  nestedHtml: string,
  footnotes: MarkdownFootnote[],
  linkDefinitions: MarkdownLinkDefinition[]
) {
  if (item.kind === "task") {
    const checked = item.checked ? "true" : "false";
    return `<li data-type="taskItem" data-checked="${checked}"><label><input type="checkbox" ${
      checked === "true" ? "checked" : ""
    } /></label><div><p>${renderInlineMarkdown(
      item.text,
      footnotes,
      linkDefinitions
    )}</p>${nestedHtml}</div></li>`;
  }
  return `<li>${renderInlineMarkdown(
    item.text,
    footnotes,
    linkDefinitions
  )}${nestedHtml}</li>`;
}

function getMarkdownListOpenTag(kind: MarkdownListKind) {
  if (kind === "ol") return "<ol>";
  if (kind === "task") return '<ul data-type="taskList">';
  return "<ul>";
}

function getMarkdownListCloseTag(kind: MarkdownListKind) {
  return kind === "ol" ? "</ol>" : "</ul>";
}

function parseMarkdownListItem(line: string): MarkdownListItem | null {
  const task = /^(\s*)[-*+]\s+\[([ xX])]\s+(.+)$/.exec(line);
  if (task) {
    return {
      checked: task[2].toLowerCase() === "x",
      indent: countMarkdownIndent(task[1]),
      kind: "task",
      text: task[3],
    };
  }

  const unordered = /^(\s*)[-*+]\s+(.+)$/.exec(line);
  if (unordered) {
    return {
      indent: countMarkdownIndent(unordered[1]),
      kind: "ul",
      text: unordered[2],
    };
  }

  const ordered = /^(\s*)\d+[.)]\s+(.+)$/.exec(line);
  if (ordered) {
    return {
      indent: countMarkdownIndent(ordered[1]),
      kind: "ol",
      text: ordered[2],
    };
  }

  return null;
}

function countMarkdownIndent(value: string) {
  return value.replace(/\t/g, "    ").length;
}

function renderInlineMarkdown(
  value: string,
  footnotes: MarkdownFootnote[] = [],
  linkDefinitions: MarkdownLinkDefinition[] = []
): string {
  const tokens: string[] = [];
  const protect = (html: string) => {
    const token = `\uE000${tokens.length}\uE001`;
    tokens.push(html);
    return token;
  };

  let text = value
    .replace(/`([^`]+)`/g, (_match, code: string) =>
      protect(`<code>${escapeHtml(code)}</code>`)
    )
    .replace(/\\\((.+?)\\\)/g, (_match, formula: string) =>
      protect(renderInlineEquation(formula))
    )
    .replace(/\[\[([^\]\n]{1,180})]]/g, (_match, value: string) =>
      protect(renderWikiReference(value))
    )
    .replace(/(^|[^\\$])\$([^\s$](?:[^$\n]*[^\s$])?)\$(?!\$)/g, (
      _match,
      prefix: string,
      formula: string
    ) => `${prefix}${protect(renderInlineEquation(formula))}`)
    .replace(
      /!\[([^\]]*)]\(([^)\n]+)\)/g,
      (_match, alt: string, destination: string) => {
        const target = parseMarkdownLinkDestination(destination);
        return protect(
          `<img src="${sanitizeUrl(target.url)}" alt="${escapeHtml(alt)}"${
            target.title ? ` title="${escapeHtml(target.title)}"` : ""
          } />`
        );
      }
    )
    .replace(
      /\[([^\]]+)]\(([^)\n]+)\)/g,
      (_match, label: string, destination: string) => {
        const target = parseMarkdownLinkDestination(destination);
        return protect(
          `<a href="${sanitizeUrl(target.url)}"${
            target.title ? ` title="${escapeHtml(target.title)}"` : ""
          } target="_blank" rel="noreferrer">${renderInlineMarkdown(
            label,
            footnotes,
            linkDefinitions
          )}</a>`
        );
      }
    )
    .replace(
      /!\[([^\]]*)]\[([^\]]*)]/g,
      (_match, alt: string, id: string) => {
        const target = findMarkdownLinkDefinition(id || alt, linkDefinitions);
        return target
          ? protect(
              `<img src="${sanitizeUrl(target.url)}" alt="${escapeHtml(alt)}"${
                target.title ? ` title="${escapeHtml(target.title)}"` : ""
              } />`
            )
          : _match;
      }
    )
    .replace(
      /\[([^\]]+)]\[([^\]]*)]/g,
      (_match, label: string, id: string) => {
        const target = findMarkdownLinkDefinition(id || label, linkDefinitions);
        return target
          ? protect(
              `<a href="${sanitizeUrl(target.url)}"${
                target.title ? ` title="${escapeHtml(target.title)}"` : ""
              } target="_blank" rel="noreferrer">${renderInlineMarkdown(
                label,
                footnotes,
                linkDefinitions
              )}</a>`
            )
          : _match;
      }
    )
    .replace(/<((?:https?:\/\/|mailto:)[^<>\s]+)>/gi, (_match, url: string) =>
      protect(renderInlineLink(url, url))
    )
    .replace(
      /(^|[\s(])((?:https?:\/\/|mailto:)[^\s<>()]+[^\s<>().,!?;:])/gi,
      (_match, prefix: string, url: string) => `${prefix}${protect(renderInlineLink(url, url))}`
    )
    .replace(/\[\^([^\]\s]+)]/g, (_match, id: string) =>
      protect(renderFootnoteReference(id, footnotes))
    );

  text = escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/~~([^~]+)~~/g, "<s>$1</s>")
    .replace(/==([^=]+)==/g, "<mark>$1</mark>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/_([^_]+)_/g, "<em>$1</em>");

  return tokens.reduce((html, tokenHtml, index) => {
    return html.replace(new RegExp(`\\uE000${index}\\uE001`, "g"), tokenHtml);
  }, text);
}

function extractMarkdownFootnotes(lines: string[], startIndex: number) {
  const output: string[] = [];
  const footnotes: MarkdownFootnote[] = [];
  let inCode = false;
  let codeFenceMarker = "";

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const codeFence = /^(```|~~~)/.exec(line.trim());

    if (codeFence) {
      if (inCode && codeFence[1] === codeFenceMarker) {
        inCode = false;
        codeFenceMarker = "";
      } else if (!inCode) {
        inCode = true;
        codeFenceMarker = codeFence[1];
      }
      output.push(line);
      continue;
    }

    if (index < startIndex || inCode) {
      output.push(line);
      continue;
    }

    const definition = /^\[\^([^\]\s]+)]:\s*(.*)$/.exec(line);
    if (!definition) {
      output.push(line);
      continue;
    }

    const contentLines = [definition[2]];
    while (index + 1 < lines.length && /^(?:\t| {2,})\S/.test(lines[index + 1])) {
      index += 1;
      contentLines.push(lines[index].trim());
    }

    footnotes.push({
      id: definition[1],
      content: contentLines.join("\n").trim(),
    });
  }

  return { lines: output, footnotes };
}

function extractMarkdownLinkDefinitions(lines: string[], startIndex: number) {
  const output: string[] = [];
  const linkDefinitions: MarkdownLinkDefinition[] = [];
  let inCode = false;
  let codeFenceMarker = "";

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const codeFence = /^(```|~~~)/.exec(line.trim());

    if (codeFence) {
      if (inCode && codeFence[1] === codeFenceMarker) {
        inCode = false;
        codeFenceMarker = "";
      } else if (!inCode) {
        inCode = true;
        codeFenceMarker = codeFence[1];
      }
      output.push(line);
      continue;
    }

    if (index < startIndex || inCode) {
      output.push(line);
      continue;
    }

    const definition = /^\[([^\]^][^\]]*)]:\s*(<[^>]+>|\S+)(?:\s+["']([^"']+)["'])?\s*$/.exec(
      line
    );
    if (!definition) {
      output.push(line);
      continue;
    }

    linkDefinitions.push({
      id: normalizeMarkdownReferenceId(definition[1]),
      title: definition[3] ?? "",
      url: definition[2].replace(/^<|>$/g, ""),
    });
  }

  return { lines: output, linkDefinitions };
}

function findMarkdownLinkDefinition(
  id: string,
  linkDefinitions: MarkdownLinkDefinition[]
) {
  const normalized = normalizeMarkdownReferenceId(id);
  return linkDefinitions.find((definition) => definition.id === normalized) ?? null;
}

function normalizeMarkdownReferenceId(id: string) {
  return id.trim().replace(/\s+/g, " ").toLowerCase();
}

function renderFootnoteReference(id: string, footnotes: MarkdownFootnote[]) {
  const index = findFootnoteIndex(id, footnotes);
  const label = index === -1 ? id : String(index + 1);
  const anchorId = footnoteAnchorId(id);
  return `<sup id="fnref-${anchorId}"><a href="#fn-${anchorId}">${escapeHtml(
    label
  )}</a></sup>`;
}

function renderInlineEquation(formula: string) {
  const trimmed = formula.trim();
  return `<span data-type="inline-equation" data-formula="${escapeHtml(
    trimmed
  )}"><code data-inline-equation-formula>${escapeHtml(trimmed)}</code></span>`;
}

function renderWikiReference(value: string) {
  const parsed = parseWikiReferenceValue(value);
  const body =
    parsed.target && parsed.label && parsed.target !== parsed.label
      ? `[[${parsed.target}|${parsed.label}]]`
      : `[[${parsed.label || parsed.target}]]`;
  return `<span data-type="wiki-reference" data-target="${escapeHtml(
    parsed.target
  )}" data-label="${escapeHtml(parsed.label)}">${escapeHtml(body)}</span>`;
}

function parseWikiReferenceValue(value: string) {
  const [rawTarget, ...labelParts] = value.trim().split("|");
  const target = sanitizeWikiReferencePart(rawTarget);
  const label = sanitizeWikiReferencePart(labelParts.join("|")) || target;

  return {
    target: target || label || "未命名页面",
    label: label || target || "未命名页面",
  };
}

function sanitizeWikiReferencePart(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/\]\]/g, ")")
    .trim()
    .slice(0, 180);
}

function renderFootnotesBlock(footnotes: MarkdownFootnote[]) {
  const items = footnotes
    .map((footnote, index) => {
      const anchorId = footnoteAnchorId(footnote.id);
      const body = markdownToHtml(footnote.content, {
        footnotes,
        skipFootnotes: true,
      });
      return `<li id="fn-${anchorId}"><p><strong>${index + 1}.</strong></p>${body}<p><a href="#fnref-${anchorId}">Back</a></p></li>`;
    })
    .join("");

  return `<section data-type="footnotes"><h3>Footnotes</h3><ol>${items}</ol></section>`;
}

function findFootnoteIndex(id: string, footnotes: MarkdownFootnote[]) {
  const normalized = normalizeFootnoteId(id);
  return footnotes.findIndex(
    (footnote) => normalizeFootnoteId(footnote.id) === normalized
  );
}

function normalizeFootnoteId(id: string) {
  return id.trim().toLowerCase();
}

function footnoteAnchorId(id: string) {
  const normalized = normalizeFootnoteId(id).replace(/[^a-z0-9_-]+/g, "-");
  return normalized || "footnote";
}

function isMarkdownTable(headerLine: string | undefined, separatorLine: string | undefined) {
  return Boolean(
    headerLine &&
      separatorLine &&
      isTableRow(headerLine) &&
      /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(separatorLine)
  );
}

function isTableRow(line: string | undefined) {
  return Boolean(line && line.includes("|") && line.trim().length > 0);
}

function splitTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function renderTable(
  headers: string[],
  rows: string[][],
  footnotes: MarkdownFootnote[],
  linkDefinitions: MarkdownLinkDefinition[]
) {
  const headerHtml = headers
    .map(
      (header) =>
        `<th>${renderInlineMarkdown(header, footnotes, linkDefinitions)}</th>`
    )
    .join("");
  const bodyHtml = rows
    .map((row) => {
      const cells = headers
        .map(
          (_, index) =>
            `<td>${renderInlineMarkdown(
              row[index] ?? "",
              footnotes,
              linkDefinitions
            )}</td>`
        )
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  return `<table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`;
}

function findFrontmatterEnd(lines: string[]) {
  if (lines[0]?.trim() !== "---") return -1;

  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() === "---") return index;
  }

  return -1;
}

function parseSetextHeading(line: string, nextLine: string | undefined) {
  const text = line.trim();
  const underline = nextLine?.trim();
  if (!text || !underline) return null;
  if (/^=+$/.test(underline)) return { level: 1, text };
  if (/^-+$/.test(underline)) return { level: 2, text };
  return null;
}

function cleanHeadingText(text: string) {
  return text.replace(/\s+#+\s*$/, "").trim();
}

function parseMarkdownCalloutStart(line: string) {
  const match = /^>\s*\[!([A-Za-z][A-Za-z0-9_-]*)](?:[+-])?\s*(.*)$/.exec(
    line.trim()
  );
  if (!match) return null;

  const type = match[1].toLowerCase();
  const title = match[2].trim();
  const meta = getCalloutMeta(type);
  return { ...meta, title };
}

function getCalloutMeta(type: string) {
  switch (type) {
    case "todo":
    case "success":
    case "check":
    case "done":
    case "tip":
      return { icon: "OK", tone: "green", label: "Tip" };
    case "warning":
    case "warn":
    case "attention":
    case "caution":
      return { icon: "!", tone: "yellow", label: "Warning" };
    case "error":
    case "failure":
    case "fail":
    case "danger":
    case "bug":
      return { icon: "!", tone: "red", label: "Warning" };
    case "question":
    case "help":
    case "faq":
      return { icon: "?", tone: "yellow", label: "Question" };
    case "abstract":
    case "summary":
    case "quote":
      return { icon: "i", tone: "neutral", label: "Note" };
    case "note":
    case "info":
    default:
      return { icon: "i", tone: "blue", label: "Note" };
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sanitizeCodeLanguage(language: string) {
  return language.trim().toLowerCase().replace(/[^a-z0-9_+#.-]/g, "");
}

function sanitizeUrl(url: string) {
  const trimmed = url.trim();
  if (/^(https?:|mailto:|#|\/)/i.test(trimmed)) return escapeHtml(trimmed);
  return "#";
}

function parseMarkdownLinkDestination(destination: string) {
  const trimmed = destination.trim();
  const match = /^(<[^>]+>|\S+)(?:\s+["']([^"']+)["'])?$/.exec(trimmed);
  const rawUrl = match?.[1] ?? trimmed;
  return {
    url: rawUrl.replace(/^<|>$/g, ""),
    title: match?.[2] ?? "",
  };
}

function renderInlineLink(label: string, url: string) {
  return `<a href="${sanitizeUrl(url)}" target="_blank" rel="noreferrer">${escapeHtml(
    label
  )}</a>`;
}
