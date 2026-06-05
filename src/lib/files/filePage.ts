import type { FilePreviewActionKind } from "@/lib/files/filePreviewActionReceipts";
import { createFilePreviewBlockHtml } from "@/lib/files/filePreviewBlock";
import {
  getFilePreviewCapabilityByKind,
  type FilePreviewCapability,
} from "@/lib/files/filePreviewCapabilities";
import type { PageFileKind, StoredPageFile } from "@/lib/files/localStore";

export const FILE_LIBRARY_PAGE_ACTION_LABEL = "创建文件页面";

export function buildFileLibraryPageTitle(file: StoredPageFile) {
  const baseName = baseFileName(file.name);
  const role = getFileLibraryPageRole(file.kind);
  return baseName ? `${role} · ${baseName}` : role;
}

export function buildFileLibraryPageContent(file: StoredPageFile) {
  const capability = getFilePreviewCapabilityByKind(file.kind);

  return `
    <h1>${escapeHtml(buildFileLibraryPageTitle(file))}</h1>
    <h2>源文件</h2>
    <ul>
      <li>文件名：${escapeHtml(file.name)}</li>
      <li>格式：${escapeHtml(getFileKindLabel(file.kind))}</li>
      <li>本地文件预览：</li>
    </ul>
    ${createFilePreviewBlockHtml(file, { allowExternalResources: false })}
    <h2>格式路线</h2>
    <table>
      <tbody>
        <tr><th>项目</th><th>当前路线</th></tr>
        <tr><td>预览路径</td><td>${escapeHtml(getCapabilityText(capability, "preview"))}</td></tr>
        <tr><td>可编辑导入</td><td>${escapeHtml(getCapabilityText(capability, "editable_import"))}</td></tr>
        <tr><td>数据库导入</td><td>${escapeHtml(getCapabilityText(capability, "database_import"))}</td></tr>
        <tr><td>隐私边界</td><td>${escapeHtml(getCapabilityText(capability, "privacy_boundary"))}</td></tr>
      </tbody>
    </table>
    <h2>推荐去向</h2>
    <ul>
      <li>${escapeHtml(getRecommendedDestination(file.kind))}</li>
    </ul>
    <h2>复核清单</h2>
    <ul data-type="taskList">
      <li data-type="taskItem" data-checked="false"><label><input type="checkbox" /></label><div><p>确认文件用途：报告、会议、公司研究、模型、笔记或数据库。</p></div></li>
      <li data-type="taskItem" data-checked="false"><label><input type="checkbox" /></label><div><p>确认是否需要关联到公司、会议、报告、组合或项目。</p></div></li>
      <li data-type="taskItem" data-checked="false"><label><input type="checkbox" /></label><div><p>如果要发送 AI、云同步、外部分享或数据库批量导入，先单独确认。</p></div></li>
    </ul>
    <h2>研究关联</h2>
    <ul>
      <li>公司页面：</li>
      <li>相关会议：</li>
      <li>相关报告：</li>
      <li>相关数据库：</li>
      <li>相关项目：</li>
    </ul>
    <h2>安全边界</h2>
    <p>这个页面来自用户主动选择的本地文件；文件保存在浏览器本地 IndexedDB，不上传、不云同步、不调用 AI、不加载外部资源、不执行文件、不删除原文件。</p>
  `;
}

export function getFileLibraryReceiptActionKind(
  file: Pick<StoredPageFile, "kind" | "name">
): FilePreviewActionKind {
  return isDownloadRetainOnlyFile(file.kind, file.name)
    ? "download-retain"
    : "native-preview";
}

function getCapabilityText(
  capability: FilePreviewCapability | undefined,
  key: "preview" | "editable_import" | "database_import" | "privacy_boundary"
) {
  if (!capability) {
    return "未知格式默认只做本地保存和下载，不读取文件内容、不上传。";
  }
  return capability[key];
}

function getFileLibraryPageRole(kind: PageFileKind) {
  if (kind === "html") return "HTML 报告";
  if (kind === "markdown") return "Markdown 笔记";
  if (kind === "spreadsheet") return "表格文件";
  if (kind === "word") return "文档文件";
  if (kind === "presentation") return "演示文稿";
  if (kind === "pdf") return "PDF 文件";
  if (kind === "audio" || kind === "video") return "媒体文件";
  if (kind === "archive") return "压缩包附件";
  return "文件页面";
}

function getRecommendedDestination(kind: PageFileKind) {
  if (kind === "html" || kind === "pdf" || kind === "presentation") {
    return "适合进入报告库或作为公司/会议研究材料引用。";
  }
  if (kind === "markdown" || kind === "rtf" || kind === "word") {
    return "适合作为可编辑笔记或研究备忘录的来源。";
  }
  if (kind === "spreadsheet" || kind === "numbers") {
    return "适合先预览，确认字段和回滚方案后再进入数据库导入。";
  }
  if (kind === "audio" || kind === "video" || kind === "text") {
    return "适合作为会议、访谈、转录稿或研究素材的本地附件。";
  }
  return "先作为本地附件留存，再人工决定是否关联到报告、会议、公司或项目。";
}

function getFileKindLabel(kind: PageFileKind) {
  const labels: Record<PageFileKind, string> = {
    html: "HTML",
    markdown: "Markdown",
    opml: "OPML",
    rtf: "RTF",
    epub: "EPUB",
    archive: "ZIP",
    pdf: "PDF",
    image: "图片",
    audio: "音频",
    video: "视频",
    text: "文本/代码/字幕",
    notebook: "Jupyter Notebook",
    spreadsheet: "Excel/CSV/ODS",
    word: "Word/ODT",
    presentation: "PowerPoint/ODP",
    pages: "Apple Pages",
    numbers: "Apple Numbers",
    keynote: "Apple Keynote",
    unknown: "未知格式",
  };

  return labels[kind];
}

function isDownloadRetainOnlyFile(kind: PageFileKind, fileName: string) {
  const lowerName = fileName.toLowerCase();
  return (
    kind === "archive" ||
    kind === "unknown" ||
    kind === "pages" ||
    kind === "numbers" ||
    kind === "keynote" ||
    (kind === "word" && lowerName.endsWith(".doc")) ||
    (kind === "presentation" && lowerName.endsWith(".ppt"))
  );
}

function baseFileName(fileName: string) {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
