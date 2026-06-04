"use client";

import type { PageFileKind, StoredPageFile } from "@/lib/files/localStore";

export type FilePreviewStructureStatus =
  | "ready"
  | "converted-preview"
  | "metadata-only"
  | "unsupported";

export type FilePreviewStructureSignalId =
  | "outline"
  | "tables"
  | "links"
  | "media"
  | "code"
  | "sheets"
  | "slides"
  | "local-boundary";

export interface FilePreviewStructureOutlineItem {
  id: string;
  level: number;
  title: string;
}

export interface FilePreviewStructureSignal {
  id: FilePreviewStructureSignalId;
  label: string;
  value: number | string;
  status: "ready" | "review" | "empty";
  detail: string;
}

export interface FilePreviewStructureReport {
  format: "zhinote-file-preview-structure";
  format_version: 1;
  report_status: "local-preview-structure-only";
  file_kind: PageFileKind;
  structure_status: FilePreviewStructureStatus;
  privacy_note: string;
  boundary: {
    local_preview_structure_only: true;
    reads_loaded_file_text: boolean;
    reads_converted_preview_html: boolean;
    reads_file_bytes: false;
    includes_file_name: false;
    uploads_data: false;
    connects_cloud_services: false;
    enables_ai: false;
    writes_workspace_data: false;
  };
  summary: {
    headings: number;
    tables: number;
    links: number;
    media: number;
    code_blocks: number;
    list_items: number;
    sections: number;
    words: number;
    lines: number;
    estimated_sheets: number;
    estimated_slides: number;
  };
  outline: FilePreviewStructureOutlineItem[];
  signals: FilePreviewStructureSignal[];
}

export function buildFilePreviewStructure(input: {
  file: Pick<StoredPageFile, "kind" | "textContent">;
  previewHtml?: string;
}): FilePreviewStructureReport {
  const status = getStructureStatus(input.file.kind, input.previewHtml);
  const doc = parsePreviewDocument(input.previewHtml);
  const text = doc?.body.textContent ?? input.file.textContent ?? "";
  const outline = doc ? extractOutline(doc) : [];
  const summary = {
    headings: outline.length,
    tables: doc?.querySelectorAll("table").length ?? 0,
    links: doc?.querySelectorAll("a[href]").length ?? 0,
    media:
      doc?.querySelectorAll("img, svg, canvas, video, audio, iframe").length ?? 0,
    code_blocks: doc?.querySelectorAll("pre, code").length ?? 0,
    list_items: doc?.querySelectorAll("li").length ?? 0,
    sections: doc?.querySelectorAll("section").length ?? 0,
    words: countWords(text),
    lines: countLines(text),
    estimated_sheets: estimateSheets(input.file.kind, doc),
    estimated_slides: estimateSlides(input.file.kind, doc),
  };

  return {
    format: "zhinote-file-preview-structure",
    format_version: 1,
    report_status: "local-preview-structure-only",
    file_kind: input.file.kind,
    structure_status: status,
    privacy_note:
      "Generated locally inside the file preview block from already-loaded file text or converted preview HTML. It does not read file bytes, include file names, upload data, connect cloud services, call AI, or write workspace data.",
    boundary: {
      local_preview_structure_only: true,
      reads_loaded_file_text: Boolean(input.file.textContent),
      reads_converted_preview_html: Boolean(input.previewHtml),
      reads_file_bytes: false,
      includes_file_name: false,
      uploads_data: false,
      connects_cloud_services: false,
      enables_ai: false,
      writes_workspace_data: false,
    },
    summary,
    outline,
    signals: buildSignals(input.file.kind, status, summary),
  };
}

function getStructureStatus(
  kind: PageFileKind,
  previewHtml: string | undefined
): FilePreviewStructureStatus {
  if (kind === "pdf" || kind === "image" || kind === "audio" || kind === "video") {
    return "metadata-only";
  }
  if (kind === "unknown") return "unsupported";
  if (previewHtml) {
    return kind === "html" || kind === "markdown" || kind === "text"
      ? "ready"
      : "converted-preview";
  }
  if (kind === "text" || kind === "rtf" || kind === "opml" || kind === "notebook") {
    return "ready";
  }
  return "metadata-only";
}

function parsePreviewDocument(html: string | undefined) {
  if (!html || typeof DOMParser === "undefined") return null;
  return new DOMParser().parseFromString(html, "text/html");
}

function extractOutline(doc: Document): FilePreviewStructureOutlineItem[] {
  return Array.from(doc.querySelectorAll("h1, h2, h3, h4"))
    .map((heading, index) => ({
      id: `heading-${index + 1}`,
      level: Number(heading.tagName.slice(1)),
      title: normalizeText(heading.textContent ?? "") || "未命名标题",
    }))
    .filter((item) => item.title)
    .slice(0, 8);
}

function buildSignals(
  kind: PageFileKind,
  status: FilePreviewStructureStatus,
  summary: FilePreviewStructureReport["summary"]
): FilePreviewStructureSignal[] {
  const signals: FilePreviewStructureSignal[] = [
    {
      id: "outline",
      label: "标题",
      value: summary.headings,
      status: summary.headings > 0 ? "ready" : "review",
      detail:
        summary.headings > 0
          ? "可以用标题快速定位报告结构。"
          : "没有识别到标题，可能需要人工补目录或拆分章节。",
    },
    {
      id: "tables",
      label: "表格",
      value: summary.tables,
      status: summary.tables > 0 ? "ready" : "empty",
      detail:
        summary.tables > 0
          ? "包含表格，可继续复核是否要进入数据库。"
          : "没有识别到表格。",
    },
    {
      id: "links",
      label: "链接",
      value: summary.links,
      status: summary.links > 0 ? "review" : "empty",
      detail:
        summary.links > 0
          ? "包含链接；HTML 外部资源仍由单独确认门控制。"
          : "没有识别到链接。",
    },
    {
      id: "media",
      label: "媒体",
      value: summary.media,
      status: summary.media > 0 ? "review" : "empty",
      detail:
        summary.media > 0
          ? "包含图片、媒体或嵌入元素，需要检查本地/外部资源边界。"
          : "没有识别到媒体元素。",
    },
    {
      id: "code",
      label: "代码",
      value: summary.code_blocks,
      status: summary.code_blocks > 0 ? "ready" : "empty",
      detail:
        summary.code_blocks > 0
          ? "包含代码或 notebook 输出块。"
          : "没有识别到代码块。",
    },
    {
      id: "local-boundary",
      label: "边界",
      value: getStatusLabel(status),
      status: status === "unsupported" ? "review" : "ready",
      detail: "结构摘要只在本地生成，不上传、不调用 AI、不写入 workspace。",
    },
  ];

  if (kind === "spreadsheet" || summary.estimated_sheets > 0) {
    signals.splice(1, 0, {
      id: "sheets",
      label: "工作表",
      value: summary.estimated_sheets,
      status: summary.estimated_sheets > 0 ? "ready" : "review",
      detail: "表格预览只显示有限工作表和行列，批量导入仍需要确认。",
    });
  }

  if (kind === "presentation" || summary.estimated_slides > 0) {
    signals.splice(1, 0, {
      id: "slides",
      label: "Slides",
      value: summary.estimated_slides,
      status: summary.estimated_slides > 0 ? "ready" : "review",
      detail: "PPT 结构来自本地文本转换，视觉版式仍需人工复核。",
    });
  }

  return signals;
}

function estimateSheets(kind: PageFileKind, doc: Document | null) {
  if (kind !== "spreadsheet" || !doc) return 0;
  const sections = doc.querySelectorAll("section").length;
  return sections > 0 ? sections : doc.querySelectorAll("table").length;
}

function estimateSlides(kind: PageFileKind, doc: Document | null) {
  if (kind !== "presentation" || !doc) return 0;
  return doc.querySelectorAll("section").length;
}

function countWords(text: string) {
  const normalized = normalizeText(text);
  if (!normalized) return 0;
  const cjkMatches = normalized.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  const wordMatches = normalized
    .replace(/[\u4e00-\u9fff]/g, " ")
    .match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g)?.length ?? 0;
  return cjkMatches + wordMatches;
}

function countLines(text: string) {
  return text.split(/\r?\n/).filter((line) => line.trim()).length;
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function getStatusLabel(status: FilePreviewStructureStatus) {
  const labels: Record<FilePreviewStructureStatus, string> = {
    ready: "ready",
    "converted-preview": "converted",
    "metadata-only": "metadata",
    unsupported: "unsupported",
  };

  return labels[status];
}
