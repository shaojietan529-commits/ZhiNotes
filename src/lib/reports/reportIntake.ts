import {
  getFilePreviewCapabilityByKind,
  type FilePreviewSupportLevel,
} from "@/lib/files/filePreviewCapabilities";
import type { PageFileKind } from "@/lib/files/localStore";
import type { Page } from "@/lib/utils/types";

export type ReportIntakeStage =
  | "captured"
  | "source-triage"
  | "reading-review"
  | "database-review"
  | "linking";

export type ReportIntakePriority = "high" | "medium" | "low";

export interface ReportIntakeLane {
  id: ReportIntakeStage;
  title: string;
  description: string;
}

export interface ReportIntakeItem {
  id: string;
  page_id: string;
  page_title: string;
  file_id: string;
  file_name: string;
  file_kind: PageFileKind;
  file_size: number;
  file_size_label: string;
  mime_type: string;
  stage: ReportIntakeStage;
  priority: ReportIntakePriority;
  preview_support: FilePreviewSupportLevel | "unknown";
  next_action: string;
  relation_gaps: string[];
  privacy_boundary: string;
  updated_at: string;
}

export interface ReportIntakeReport {
  format: "zhinote-report-intake-report";
  format_version: 1;
  report_status: "local-report-intake-only";
  privacy_note: string;
  boundary: {
    local_report_only: true;
    reads_local_page_html: true;
    extracts_file_preview_attributes_only: true;
    reads_file_bytes: false;
    reads_file_text: false;
    writes_workspace_data: false;
    connects_cloud_services: false;
    uploads_data: false;
    enables_ai: false;
  };
  summary: {
    pages_scanned: number;
    intake_items: number;
    high_priority: number;
    medium_priority: number;
    low_priority: number;
    unique_file_kinds: number;
    html_reports: number;
    spreadsheet_candidates: number;
  };
  lanes: ReportIntakeLane[];
  items: ReportIntakeItem[];
}

export const REPORT_INTAKE_LANES: ReportIntakeLane[] = [
  {
    id: "captured",
    title: "已收集",
    description: "文件已经进入本地页面，等待确认来源和研究用途。",
  },
  {
    id: "source-triage",
    title: "来源分流",
    description: "先判断文件类型、是否值得阅读，以及是否需要转成其他格式。",
  },
  {
    id: "reading-review",
    title: "阅读复盘",
    description: "提取核心结论、投资假设影响、模型影响和待回答问题。",
  },
  {
    id: "database-review",
    title: "结构化入库",
    description: "表格类资料需要确认字段、行数和是否导入本地数据库。",
  },
  {
    id: "linking",
    title: "关联归档",
    description: "把报告关联到公司、会议、备忘录、组合或后续跟踪事项。",
  },
];

export function buildReportIntakeReport(pages: Page[]): ReportIntakeReport {
  const items = pages.flatMap(buildReportIntakeItemsForPage);
  const uniqueFileKinds = new Set(items.map((item) => item.file_kind));

  return {
    format: "zhinote-report-intake-report",
    format_version: 1,
    report_status: "local-report-intake-only",
    privacy_note:
      "由页面级 file-preview block 属性在本地生成。报告只列出文件名、类型、大小、预览支持、工作流阶段和下一步动作；不读取文件字节、不读取转换后的文件文本、不连接云服务、不上传数据、也不启用 AI。",
    boundary: {
      local_report_only: true,
      reads_local_page_html: true,
      extracts_file_preview_attributes_only: true,
      reads_file_bytes: false,
      reads_file_text: false,
      writes_workspace_data: false,
      connects_cloud_services: false,
      uploads_data: false,
      enables_ai: false,
    },
    summary: {
      pages_scanned: pages.length,
      intake_items: items.length,
      high_priority: items.filter((item) => item.priority === "high").length,
      medium_priority: items.filter((item) => item.priority === "medium").length,
      low_priority: items.filter((item) => item.priority === "low").length,
      unique_file_kinds: uniqueFileKinds.size,
      html_reports: items.filter((item) => item.file_kind === "html").length,
      spreadsheet_candidates: items.filter(
        (item) => item.file_kind === "spreadsheet"
      ).length,
    },
    lanes: REPORT_INTAKE_LANES,
    items,
  };
}

function buildReportIntakeItemsForPage(page: Page): ReportIntakeItem[] {
  const blocks = extractFilePreviewBlocks(page.content_text ?? "");

  return blocks.map((block, index) => {
    const fileKind = normalizeFileKind(block.kind);
    const capability = getFilePreviewCapabilityByKind(fileKind);
    const stage = getIntakeStage(fileKind);
    const priority = getIntakePriority(fileKind);
    const fileName = block.fileName || "未命名本地文件";

    return {
      id: `${page.id}:${index}:${block.fileId || fileName}`,
      page_id: page.id,
      page_title: page.title || "未命名报告页",
      file_id: block.fileId,
      file_name: fileName,
      file_kind: fileKind,
      file_size: block.size,
      file_size_label: formatBytes(block.size),
      mime_type: block.mimeType || "application/octet-stream",
      stage,
      priority,
      preview_support: capability?.support_level ?? "unknown",
      next_action: getNextAction(fileKind),
      relation_gaps: getRelationGaps(page.content_text ?? ""),
      privacy_boundary:
        capability?.privacy_boundary ??
        "本地文件只保存在浏览器工作区；未知格式默认只做本地保存和下载。",
      updated_at: page.updated_at,
    };
  });
}

function extractFilePreviewBlocks(content: string) {
  const blocks: Array<{
    fileId: string;
    fileName: string;
    mimeType: string;
    kind: string;
    size: number;
  }> = [];
  const blockPattern = /<div\s+[^>]*data-type=["']file-preview["'][^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = blockPattern.exec(content)) !== null) {
    const attrs = parseDataAttributes(match[0]);
    blocks.push({
      fileId: attrs["data-file-id"] ?? "",
      fileName: attrs["data-file-name"] ?? "",
      mimeType: attrs["data-mime-type"] ?? "",
      kind: attrs["data-kind"] ?? "unknown",
      size: Number(attrs["data-size"] ?? 0),
    });
  }

  return blocks;
}

function parseDataAttributes(value: string) {
  const attrs: Record<string, string> = {};
  const attributePattern = /\s(data-[a-z-]+)=["']([^"']*)["']/gi;
  let match: RegExpExecArray | null;

  while ((match = attributePattern.exec(value)) !== null) {
    attrs[match[1]] = decodeHtmlAttribute(match[2]);
  }

  return attrs;
}

function normalizeFileKind(value: string): PageFileKind {
  const supportedKinds: PageFileKind[] = [
    "html",
    "markdown",
    "opml",
    "rtf",
    "epub",
    "archive",
    "pdf",
    "image",
    "audio",
    "video",
    "text",
    "notebook",
    "spreadsheet",
    "word",
    "presentation",
    "unknown",
  ];
  return supportedKinds.includes(value as PageFileKind)
    ? (value as PageFileKind)
    : "unknown";
}

function getIntakeStage(kind: PageFileKind): ReportIntakeStage {
  if (kind === "spreadsheet") return "database-review";
  if (kind === "archive" || kind === "unknown") return "source-triage";
  if (kind === "image" || kind === "audio" || kind === "video") {
    return "source-triage";
  }
  return "reading-review";
}

function getIntakePriority(kind: PageFileKind): ReportIntakePriority {
  if (
    kind === "html" ||
    kind === "markdown" ||
    kind === "pdf" ||
    kind === "spreadsheet" ||
    kind === "word" ||
    kind === "presentation" ||
    kind === "notebook"
  ) {
    return "high";
  }
  if (kind === "archive" || kind === "epub" || kind === "rtf" || kind === "text") {
    return "medium";
  }
  return "low";
}

function getNextAction(kind: PageFileKind) {
  if (kind === "spreadsheet") {
    return "确认字段、行数和导入边界后，再决定是否转成本地数据库。";
  }
  if (kind === "html") {
    return "先保持外部资源阻止，阅读核心图表，再补公司、会议和备忘录关联。";
  }
  if (kind === "markdown") {
    return "导入为可编辑块后，提取核心结论、假设影响和后续问题。";
  }
  if (kind === "pdf" || kind === "word" || kind === "presentation") {
    return "先做阅读复盘，再把关键结论连接到公司页和报告跟踪表。";
  }
  if (kind === "notebook") {
    return "检查代码输出和图表结论，但不要执行 notebook 代码。";
  }
  if (kind === "archive") {
    return "先查看压缩包目录，确认是否需要拆成多个报告资产。";
  }
  return "确认研究用途、来源可信度和是否需要转为标准报告页。";
}

function getRelationGaps(content: string) {
  const gaps: string[] = [];
  const lowerContent = content.toLowerCase();

  if (!lowerContent.includes("公司页面") && !lowerContent.includes("company")) {
    gaps.push("公司");
  }
  if (!lowerContent.includes("相关会议") && !lowerContent.includes("meeting")) {
    gaps.push("会议");
  }
  if (!lowerContent.includes("memo") && !lowerContent.includes("备忘")) {
    gaps.push("备忘录");
  }

  return gaps.length > 0 ? gaps : ["待确认"];
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function decodeHtmlAttribute(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
