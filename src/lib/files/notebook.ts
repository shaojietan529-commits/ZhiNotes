"use client";

import { markdownToHtml } from "@/lib/markdown/markdownToHtml";

interface NotebookCell {
  cell_type?: string;
  outputs?: NotebookOutput[];
  source?: string | string[];
}

interface NotebookOutput {
  data?: Record<string, string | string[]>;
  text?: string | string[];
  output_type?: string;
}

interface NotebookDocument {
  cells?: NotebookCell[];
  metadata?: {
    kernelspec?: {
      language?: string;
      name?: string;
    };
    language_info?: {
      name?: string;
    };
  };
}

export function convertNotebookToHtml(notebookJson: string) {
  const notebook = parseNotebook(notebookJson);
  if (!notebook) {
    return "<p>这个 notebook 无法解析。</p>";
  }

  const cells = Array.isArray(notebook.cells) ? notebook.cells : [];
  if (cells.length === 0) {
    return "<p>这个 notebook 没有任何单元格。</p>";
  }

  const language = notebookLanguage(notebook);
  return cells.map((cell, index) => renderNotebookCell(cell, index, language)).join("");
}

function parseNotebook(notebookJson: string): NotebookDocument | null {
  try {
    return JSON.parse(notebookJson) as NotebookDocument;
  } catch {
    return null;
  }
}

function notebookLanguage(notebook: NotebookDocument) {
  return sanitizeCodeLanguage(
    notebook.metadata?.language_info?.name ||
      notebook.metadata?.kernelspec?.language ||
      notebook.metadata?.kernelspec?.name ||
      "python"
  );
}

function renderNotebookCell(cell: NotebookCell, index: number, language: string) {
  const source = normalizeNotebookText(cell.source);
  const label = `单元格 ${index + 1}`;

  if (cell.cell_type === "markdown") {
    return `<section><p><small>${label} - Markdown</small></p>${markdownToHtml(
      source
    )}</section>`;
  }

  if (cell.cell_type === "code") {
    const outputs = renderNotebookOutputs(cell.outputs ?? []);
    return `<section><p><small>${label} - 代码</small></p>${renderCodeBlock(
      source,
      language
    )}${outputs}</section>`;
  }

  const text = source.trim();
  return text
    ? `<section><p><small>${label} - ${escapeHtml(
        cell.cell_type || "原始内容"
      )}</small></p><pre><code>${escapeHtml(text)}</code></pre></section>`
    : "";
}

function renderNotebookOutputs(outputs: NotebookOutput[]) {
  const rendered = outputs
    .map((output) => {
      const text =
        normalizeNotebookText(output.text) ||
        normalizeNotebookText(output.data?.["text/plain"]);
      return text.trim()
        ? `<details open><summary>输出</summary><pre><code>${escapeHtml(
            text.trimEnd()
          )}</code></pre></details>`
        : "";
    })
    .filter(Boolean)
    .join("");

  return rendered ? `<div>${rendered}</div>` : "";
}

function renderCodeBlock(source: string, language: string) {
  const languageClass = language ? ` class="language-${escapeHtml(language)}"` : "";
  return `<pre><code${languageClass}>${escapeHtml(source.trimEnd())}</code></pre>`;
}

function normalizeNotebookText(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value.join("");
  return value ?? "";
}

function sanitizeCodeLanguage(language: string) {
  return language.trim().toLowerCase().replace(/[^a-z0-9_+#.-]/g, "");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
