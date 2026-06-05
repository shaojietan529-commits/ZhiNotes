import type { PageFileKind } from "@/lib/files/localStore";

export type FilePreviewSupportLevel =
  | "native"
  | "converted"
  | "metadata"
  | "download-only";

export interface FilePreviewCapability {
  id: string;
  label: string;
  kinds: PageFileKind[];
  extensions: string[];
  support_level: FilePreviewSupportLevel;
  preview: string;
  editable_import: string;
  database_import: string;
  privacy_boundary: string;
  limitation?: string;
}

export const FILE_PREVIEW_CAPABILITIES: FilePreviewCapability[] = [
  {
    id: "html-report",
    label: "HTML 报告",
    kinds: ["html"],
    extensions: [".html", ".htm", ".xhtml"],
    support_level: "native",
    preview: "沙盒 iframe 原生预览，默认阻止外部资源。",
    editable_import: "可导入为可编辑块，但复杂布局、脚本和部分样式会被清理。",
    database_import: "不适用。",
    privacy_boundary:
      "外部图片、脚本、样式、字体、iframe 和网络端点默认阻止；开启前需要确认记录。",
  },
  {
    id: "markdown-note",
    label: "Markdown / MDX",
    kinds: ["markdown"],
    extensions: [".md", ".markdown", ".mdx", ".mdown", ".mkd", ".mkdn"],
    support_level: "converted",
    preview: "转换为页面内 HTML 预览。",
    editable_import: "可导入为可编辑块。",
    database_import: "不适用。",
    privacy_boundary: "本地文本解析，不上传文件内容。",
  },
  {
    id: "pdf",
    label: "PDF",
    kinds: ["pdf"],
    extensions: [".pdf"],
    support_level: "native",
    preview: "浏览器原生 PDF 预览。",
    editable_import: "暂不转换为可编辑块。",
    database_import: "不适用。",
    privacy_boundary: "PDF 字节保存在浏览器本地 IndexedDB，不上传。",
  },
  {
    id: "spreadsheet",
    label: "Excel / CSV / ODS",
    kinds: ["spreadsheet"],
    extensions: [".xlsx", ".xls", ".csv", ".tsv", ".ods"],
    support_level: "converted",
    preview: "转换为表格 HTML 预览，最多显示前 5 个工作表。",
    editable_import: "可导入为可编辑表格块。",
    database_import:
      "可批量导入为本地数据库，导入前需要输入确认文本并留下确认记录。",
    privacy_boundary: "导入记录不包含单元格值或文件字节。",
  },
  {
    id: "word",
    label: "Word / ODT",
    kinds: ["word"],
    extensions: [".docx", ".doc", ".odt"],
    support_level: "converted",
    preview: "DOCX 使用 mammoth 转换，ODT 读取 OpenDocument content.xml。",
    editable_import: "可导入为可编辑块。",
    database_import: "不适用。",
    privacy_boundary: "转换在浏览器本地完成，不上传文档内容。",
    limitation: "旧版 .doc 暂不转换，仍可本地保存和下载。",
  },
  {
    id: "presentation",
    label: "PowerPoint / ODP",
    kinds: ["presentation"],
    extensions: [".pptx", ".ppt", ".odp"],
    support_level: "converted",
    preview: "PPTX/ODP 提取幻灯片文本并生成本地 HTML 预览。",
    editable_import: "可导入为可编辑块。",
    database_import: "不适用。",
    privacy_boundary: "转换在浏览器本地完成，不上传演示文稿内容。",
    limitation: "旧版 .ppt 暂不转换，仍可本地保存和下载。",
  },
  {
    id: "apple-iwork",
    label: "Apple iWork",
    kinds: ["pages", "numbers", "keynote"],
    extensions: [".pages", ".numbers", ".key", ".keynote"],
    support_level: "download-only",
    preview: "先作为本地附件留存并下载复核，暂不自动转换。",
    editable_import: "暂不导入为可编辑块；建议先导出为 Word、Excel 或 PowerPoint。",
    database_import: "Numbers 文件需先导出为 Excel/CSV 后再走数据库导入。",
    privacy_boundary:
      "文件保存在浏览器本地 IndexedDB；不会上传、不会调用外部转换服务。",
    limitation:
      "Pages、Numbers、Keynote 的原生转换需要后续接入安全的本地转换路线。",
  },
  {
    id: "rtf",
    label: "RTF",
    kinds: ["rtf"],
    extensions: [".rtf"],
    support_level: "converted",
    preview: "提取纯文本段落并生成本地 HTML 预览。",
    editable_import: "可导入为可编辑块。",
    database_import: "不适用。",
    privacy_boundary: "本地文本解析，不上传文件内容。",
  },
  {
    id: "epub",
    label: "EPUB",
    kinds: ["epub"],
    extensions: [".epub"],
    support_level: "converted",
    preview: "读取 EPUB spine 章节并生成本地 HTML 预览。",
    editable_import: "可导入为可编辑块。",
    database_import: "不适用。",
    privacy_boundary: "本地 ZIP/章节解析，不加载远程资源。",
  },
  {
    id: "archive",
    label: "ZIP",
    kinds: ["archive"],
    extensions: [".zip"],
    support_level: "metadata",
    preview: "列出压缩包内容、类型、压缩后大小和压缩方式。",
    editable_import: "不导入为可编辑块。",
    database_import: "不适用。",
    privacy_boundary: "只读取本地目录元数据，不解包写入工作区。",
  },
  {
    id: "notebook",
    label: "Jupyter Notebook",
    kinds: ["notebook"],
    extensions: [".ipynb"],
    support_level: "converted",
    preview: "解析 markdown/code cells 和常见文本输出。",
    editable_import: "可导入为可编辑块。",
    database_import: "不适用。",
    privacy_boundary: "本地 JSON 解析，不执行代码，不上传 notebook 内容。",
  },
  {
    id: "media-and-text",
    label: "图片 / 音频 / 视频 / 文本",
    kinds: ["image", "audio", "video", "text", "opml"],
    extensions: ["image/*", "audio/*", "video/*", ".txt", ".json", ".opml"],
    support_level: "native",
    preview: "媒体使用浏览器原生预览；文本/代码高亮；OPML 转大纲。",
    editable_import: "文本、代码和 OPML 可导入为可编辑块。",
    database_import: "不适用。",
    privacy_boundary: "所有内容留在浏览器本地。",
  },
];

export function getFilePreviewCapabilityByKind(kind: PageFileKind) {
  return FILE_PREVIEW_CAPABILITIES.find((capability) =>
    capability.kinds.includes(kind)
  );
}
