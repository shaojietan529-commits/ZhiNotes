import type { FilePreviewActionKind } from "@/lib/files/filePreviewActionReceipts";
import { createFilePreviewBlockHtml } from "@/lib/files/filePreviewBlock";
import {
  getFilePreviewCapabilityByKind,
  type FilePreviewCapability,
} from "@/lib/files/filePreviewCapabilities";
import type { PageFileKind, StoredPageFile } from "@/lib/files/localStore";

export const MEETING_TRANSCRIPT_FILE_ACTION_LABEL = "接入会议文件";

type MeetingTranscriptPageRole =
  | "transcript"
  | "recording"
  | "action-log"
  | "meeting-material"
  | "retained-file";

export function buildMeetingTranscriptPageTitle(file: StoredPageFile) {
  const baseName = baseFileName(file.name);
  const role = getMeetingTranscriptPageRole(file);

  if (role === "recording") {
    return baseName ? `会议录音索引 · ${baseName}` : "会议录音索引";
  }
  if (role === "action-log") {
    return baseName ? `会议行动项表 · ${baseName}` : "会议行动项表";
  }
  if (role === "meeting-material") {
    return baseName ? `会议材料 · ${baseName}` : "会议材料";
  }
  if (role === "retained-file") {
    return baseName ? `会议附件 · ${baseName}` : "会议附件";
  }

  return baseName ? `会议转录稿 · ${baseName}` : "会议转录稿";
}

export function buildMeetingTranscriptPageContent(file: StoredPageFile) {
  const capability = getFilePreviewCapabilityByKind(file.kind);
  const role = getMeetingTranscriptPageRole(file);

  return `
    <h1>${escapeHtml(buildMeetingTranscriptPageTitle(file))}</h1>
    <h2>源文件</h2>
    <ul>
      <li>文件名：${escapeHtml(file.name)}</li>
      <li>格式：${escapeHtml(getMeetingFileKindLabel(file.kind))}</li>
      <li>会议用途：${escapeHtml(getMeetingTranscriptPageRoleLabel(role))}</li>
      <li>本地文件预览：</li>
    </ul>
    ${createFilePreviewBlockHtml(file, { allowExternalResources: false })}
    <h2>预览路线</h2>
    <table>
      <tbody>
        <tr><th>项目</th><th>当前路线</th></tr>
        <tr><td>预览路径</td><td>${escapeHtml(getCapabilityText(capability, "preview"))}</td></tr>
        <tr><td>可编辑导入</td><td>${escapeHtml(getCapabilityText(capability, "editable_import"))}</td></tr>
        <tr><td>数据库导入</td><td>${escapeHtml(getCapabilityText(capability, "database_import"))}</td></tr>
        <tr><td>隐私边界</td><td>${escapeHtml(getCapabilityText(capability, "privacy_boundary"))}</td></tr>
      </tbody>
    </table>
    <h2>关键表述</h2>
    <ul>
      <li></li>
    </ul>
    <h2>开放问题</h2>
    <ul data-type="taskList">
      <li data-type="taskItem" data-checked="false"><label><input type="checkbox" /></label><div><p></p></div></li>
    </ul>
    <h2>行动项</h2>
    <ul data-type="taskList">
      <li data-type="taskItem" data-checked="false"><label><input type="checkbox" /></label><div><p></p></div></li>
    </ul>
    <h2>投研影响</h2>
    <ul>
      <li>会议结论：</li>
      <li>Thesis 影响：</li>
      <li>模型影响：</li>
      <li>风险/催化剂：</li>
    </ul>
    <h2>研究关联</h2>
    <ul>
      <li>公司页面：</li>
      <li>相关报告：</li>
      <li>会议纪要：</li>
      <li>会议跟踪表：</li>
    </ul>
    <h2>安全边界</h2>
    <p>这个页面来自用户主动选择的本地文件；文件保存在浏览器本地 IndexedDB，不上传、不云同步、不调用 AI、不发布纪要、不自动转写录音。</p>
  `;
}

export function getMeetingTranscriptReceiptActionKind(
  file: Pick<StoredPageFile, "kind" | "name">
): FilePreviewActionKind {
  return isDownloadRetainOnlyFile(file.kind, file.name)
    ? "download-retain"
    : "native-preview";
}

export function getMeetingTranscriptPageRole(file: Pick<StoredPageFile, "kind">) {
  if (file.kind === "audio" || file.kind === "video") return "recording";
  if (file.kind === "spreadsheet") return "action-log";
  if (
    file.kind === "html" ||
    file.kind === "pdf" ||
    file.kind === "word" ||
    file.kind === "presentation"
  ) {
    return "meeting-material";
  }
  if (
    file.kind === "archive" ||
    file.kind === "pages" ||
    file.kind === "numbers" ||
    file.kind === "keynote" ||
    file.kind === "unknown"
  ) {
    return "retained-file";
  }
  return "transcript";
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

function getMeetingTranscriptPageRoleLabel(role: MeetingTranscriptPageRole) {
  const labels: Record<MeetingTranscriptPageRole, string> = {
    transcript: "transcript / 转录稿复盘",
    recording: "recording index / 录音索引",
    "action-log": "action items / 行动项表",
    "meeting-material": "meeting material / 会议材料",
    "retained-file": "retained attachment / 本地留存附件",
  };

  return labels[role];
}

function getMeetingFileKindLabel(kind: PageFileKind) {
  const labels: Record<PageFileKind, string> = {
    html: "HTML 报告",
    markdown: "Markdown",
    opml: "OPML",
    rtf: "RTF",
    epub: "EPUB",
    archive: "ZIP 压缩包",
    pdf: "PDF",
    image: "图片",
    audio: "音频",
    video: "视频",
    text: "文本/字幕/转写",
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
