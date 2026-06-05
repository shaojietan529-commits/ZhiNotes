import {
  FILE_PREVIEW_CAPABILITIES,
  type FilePreviewSupportLevel,
} from "@/lib/files/filePreviewCapabilities";
import { getPageFileKind, type PageFileKind } from "@/lib/files/localStore";

export type MeetingTranscriptIntakeRole =
  | "transcript-text"
  | "meeting-note"
  | "report-attachment"
  | "recording-index"
  | "data-attachment"
  | "retained-file";

export type MeetingTranscriptIntakeStatus =
  | "native-preview"
  | "converted-preview"
  | "metadata-only"
  | "download-only"
  | "unsupported";

export interface MeetingTranscriptIntakeFormat {
  id: string;
  label: string;
  role: MeetingTranscriptIntakeRole;
  examples: string[];
  detected_kind: PageFileKind;
  support_level: FilePreviewSupportLevel | "unsupported";
  status: MeetingTranscriptIntakeStatus;
  preview_route: string;
  editable_import_candidate: boolean;
  database_import_candidate: boolean;
  recording_index_only: boolean;
  owner_confirmation_required: boolean;
  next_action: string;
  privacy_boundary: string;
  limitation?: string;
}

export interface MeetingTranscriptIntakeReport {
  format: "zhinote-meeting-transcript-intake-readiness";
  format_version: 1;
  report_status: "local-transcript-intake-capability-only";
  privacy_note: string;
  boundary: {
    local_report_only: true;
    reads_static_format_matrix: true;
    reads_file_names: false;
    reads_file_bytes: false;
    reads_page_text: false;
    includes_page_text: false;
    reads_transcript_text: false;
    includes_transcript_text: false;
    reads_recording_bytes: false;
    includes_recording_bytes: false;
    includes_participant_details: false;
    includes_meeting_passcodes: false;
    includes_database_row_values: false;
    writes_workspace_data: false;
    creates_pages: false;
    uploads_data: false;
    connects_cloud_services: false;
    enables_ai: false;
  };
  summary: {
    formats: number;
    native_preview_formats: number;
    converted_preview_formats: number;
    metadata_only_formats: number;
    download_only_formats: number;
    unsupported_formats: number;
    transcript_text_preview_formats: number;
    recording_index_formats: number;
    editable_import_candidates: number;
    database_import_candidates: number;
    owner_confirmation_required_formats: number;
  };
  formats: MeetingTranscriptIntakeFormat[];
  recommended_sequence: string[];
  blocked_actions: string[];
}

interface MeetingTranscriptIntakeSpec {
  id: string;
  label: string;
  role: MeetingTranscriptIntakeRole;
  sample_file_name: string;
  sample_mime_type: string;
  examples: string[];
  next_action: string;
  owner_confirmation_required?: boolean;
  limitation?: string;
}

const MEETING_TRANSCRIPT_INTAKE_SPECS: MeetingTranscriptIntakeSpec[] = [
  {
    id: "caption-transcript",
    label: "字幕/转写文件",
    role: "transcript-text",
    sample_file_name: "meeting-transcript.srt",
    sample_mime_type: "text/plain",
    examples: [".srt", ".vtt", ".webvtt", ".sbv", ".lrc", ".ttml"],
    next_action:
      "作为本地文本预览插入会议页，再人工复核关键表述、开放问题和可信度。",
  },
  {
    id: "plain-transcript",
    label: "纯文本转录",
    role: "transcript-text",
    sample_file_name: "meeting-transcript.txt",
    sample_mime_type: "text/plain",
    examples: [".txt", ".log"],
    next_action:
      "作为本地文本预览插入会议页；如果要进入 AI 或云同步，必须另行确认。",
  },
  {
    id: "markdown-meeting-notes",
    label: "Markdown 会议笔记",
    role: "meeting-note",
    sample_file_name: "meeting-notes.md",
    sample_mime_type: "text/markdown",
    examples: [".md", ".markdown", ".mdx", ".rmd", ".qmd"],
    next_action:
      "转换为页面内 HTML 预览，必要时导入为可编辑会议页块。",
  },
  {
    id: "html-ai-report",
    label: "HTML 可视化报告",
    role: "report-attachment",
    sample_file_name: "meeting-visual-report.html",
    sample_mime_type: "text/html",
    examples: [".html", ".htm", ".xhtml"],
    next_action:
      "用沙盒 iframe 原生预览；外部资源默认关闭，开启前需要单独确认。",
    owner_confirmation_required: true,
  },
  {
    id: "pdf-transcript",
    label: "PDF 会议材料",
    role: "report-attachment",
    sample_file_name: "meeting-transcript.pdf",
    sample_mime_type: "application/pdf",
    examples: [".pdf"],
    next_action:
      "作为浏览器原生 PDF 预览保留在会议页旁边；暂不转成可编辑块。",
  },
  {
    id: "word-notes",
    label: "Word/ODT 会议纪要",
    role: "meeting-note",
    sample_file_name: "meeting-notes.docx",
    sample_mime_type:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    examples: [".docx", ".doc", ".odt"],
    next_action:
      "DOCX/ODT 可本地转换为页面预览，再人工确认是否导入为可编辑块。",
    limitation: "旧版 .doc 会先作为本地留存文件处理，建议另存为 .docx。",
  },
  {
    id: "spreadsheet-action-log",
    label: "Excel/CSV 行动项表",
    role: "data-attachment",
    sample_file_name: "meeting-action-items.xlsx",
    sample_mime_type:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    examples: [".xlsx", ".xls", ".csv", ".tsv", ".ods"],
    next_action:
      "转换为本地表格预览；如果要导入数据库，必须输入确认文本。",
    owner_confirmation_required: true,
  },
  {
    id: "audio-recording",
    label: "音频录音索引",
    role: "recording-index",
    sample_file_name: "meeting-recording.m4a",
    sample_mime_type: "audio/mp4",
    examples: [".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac"],
    next_action:
      "仅作为本地媒体预览和录音索引；不会自动转写、上传或调用 AI。",
  },
  {
    id: "video-recording",
    label: "视频录制索引",
    role: "recording-index",
    sample_file_name: "meeting-recording.mp4",
    sample_mime_type: "video/mp4",
    examples: [".mp4", ".mov", ".m4v", ".webm", ".ogv"],
    next_action:
      "仅作为本地媒体预览和录制索引；不会自动生成 transcript。",
  },
  {
    id: "archive-bundle",
    label: "会议资料 ZIP",
    role: "retained-file",
    sample_file_name: "meeting-pack.zip",
    sample_mime_type: "application/zip",
    examples: [".zip"],
    next_action:
      "只列出压缩包元数据，后续由用户决定是否解包或逐个文件导入。",
    owner_confirmation_required: true,
  },
  {
    id: "apple-iwork-notes",
    label: "Apple iWork 文件",
    role: "retained-file",
    sample_file_name: "meeting-notes.pages",
    sample_mime_type: "application/vnd.apple.pages",
    examples: [".pages", ".numbers", ".key", ".keynote"],
    next_action:
      "先作为本地附件留存；建议导出为 Word、Excel 或 PowerPoint 后再预览。",
    owner_confirmation_required: true,
  },
];

export function buildMeetingTranscriptIntakeReadiness(): MeetingTranscriptIntakeReport {
  const formats = MEETING_TRANSCRIPT_INTAKE_SPECS.map(buildFormat);

  return {
    format: "zhinote-meeting-transcript-intake-readiness",
    format_version: 1,
    report_status: "local-transcript-intake-capability-only",
    privacy_note:
      "这份会议转录稿接入准备报告只来自内置格式能力矩阵，不读取你的文件名、文件字节、页面正文、转录稿文本、录音、参会人、会议密码、数据库行值、云端数据、AI 提示词、token 或凭证；也不会创建页面、上传、同步或调用 AI。",
    boundary: {
      local_report_only: true,
      reads_static_format_matrix: true,
      reads_file_names: false,
      reads_file_bytes: false,
      reads_page_text: false,
      includes_page_text: false,
      reads_transcript_text: false,
      includes_transcript_text: false,
      reads_recording_bytes: false,
      includes_recording_bytes: false,
      includes_participant_details: false,
      includes_meeting_passcodes: false,
      includes_database_row_values: false,
      writes_workspace_data: false,
      creates_pages: false,
      uploads_data: false,
      connects_cloud_services: false,
      enables_ai: false,
    },
    summary: {
      formats: formats.length,
      native_preview_formats: countByStatus(formats, "native-preview"),
      converted_preview_formats: countByStatus(formats, "converted-preview"),
      metadata_only_formats: countByStatus(formats, "metadata-only"),
      download_only_formats: countByStatus(formats, "download-only"),
      unsupported_formats: countByStatus(formats, "unsupported"),
      transcript_text_preview_formats: formats.filter(
        (format) =>
          format.role === "transcript-text" &&
          (format.status === "native-preview" ||
            format.status === "converted-preview")
      ).length,
      recording_index_formats: formats.filter((format) => format.recording_index_only)
        .length,
      editable_import_candidates: formats.filter(
        (format) => format.editable_import_candidate
      ).length,
      database_import_candidates: formats.filter(
        (format) => format.database_import_candidate
      ).length,
      owner_confirmation_required_formats: formats.filter(
        (format) => format.owner_confirmation_required
      ).length,
    },
    formats,
    recommended_sequence: [
      "先把字幕/转写、Markdown、Word、PDF 或 HTML 作为本地文件预览块放进会议页。",
      "再人工复核关键表述、开放问题、行动项、公司/报告关系和投研结论。",
      "录音或视频只作为本地索引，不自动转写；如需 AI、云同步或发布纪要，另开确认门。",
      "Excel/CSV 行动项表可以先预览；导入数据库前必须输入确认文本并留下 receipt。",
    ],
    blocked_actions: [
      "auto_read_transcript_text",
      "auto_transcribe_recordings",
      "upload_meeting_files",
      "send_meeting_context_to_ai",
      "publish_meeting_notes",
      "sync_meeting_files_to_cloud",
    ],
  };
}

function buildFormat(
  spec: MeetingTranscriptIntakeSpec
): MeetingTranscriptIntakeFormat {
  const detectedKind = getPageFileKind(spec.sample_file_name, spec.sample_mime_type);
  const capability = FILE_PREVIEW_CAPABILITIES.find((item) =>
    item.kinds.includes(detectedKind)
  );
  const supportLevel = capability?.support_level ?? "unsupported";
  const status = getStatus(supportLevel);

  return {
    id: spec.id,
    label: spec.label,
    role: spec.role,
    examples: spec.examples,
    detected_kind: detectedKind,
    support_level: supportLevel,
    status,
    preview_route: capability?.preview ?? "暂未识别为可预览格式。",
    editable_import_candidate: isEditableImportCandidate(detectedKind, status),
    database_import_candidate: detectedKind === "spreadsheet",
    recording_index_only: spec.role === "recording-index",
    owner_confirmation_required:
      spec.owner_confirmation_required === true ||
      detectedKind === "html" ||
      detectedKind === "spreadsheet" ||
      status === "download-only" ||
      status === "unsupported",
    next_action: spec.next_action,
    privacy_boundary: getPrivacyBoundary(spec, capability?.privacy_boundary),
    limitation: spec.limitation ?? capability?.limitation,
  };
}

function getStatus(
  supportLevel: FilePreviewSupportLevel | "unsupported"
): MeetingTranscriptIntakeStatus {
  if (supportLevel === "native") return "native-preview";
  if (supportLevel === "converted") return "converted-preview";
  if (supportLevel === "metadata") return "metadata-only";
  if (supportLevel === "download-only") return "download-only";
  return "unsupported";
}

function isEditableImportCandidate(
  kind: PageFileKind,
  status: MeetingTranscriptIntakeStatus
) {
  if (status === "unsupported" || status === "download-only") return false;
  return [
    "html",
    "markdown",
    "opml",
    "rtf",
    "notebook",
    "text",
    "spreadsheet",
    "word",
    "presentation",
  ].includes(kind);
}

function getPrivacyBoundary(
  spec: MeetingTranscriptIntakeSpec,
  capabilityBoundary?: string
) {
  if (spec.role === "recording-index") {
    return "只作为本地媒体索引和预览，不自动转写、不读取录音字节、不上传、不调用 AI。";
  }

  return capabilityBoundary
    ? `${capabilityBoundary} 会议模块只引用这条能力路线，不读取真实文件内容。`
    : "会议模块只识别格式路线，不读取真实文件内容、不上传、不调用 AI。";
}

function countByStatus(
  formats: MeetingTranscriptIntakeFormat[],
  status: MeetingTranscriptIntakeStatus
) {
  return formats.filter((format) => format.status === status).length;
}

export function getMeetingTranscriptIntakeStatusLabel(
  status: MeetingTranscriptIntakeStatus
) {
  const labels: Record<MeetingTranscriptIntakeStatus, string> = {
    "native-preview": "原生预览",
    "converted-preview": "转换预览",
    "metadata-only": "只看元数据",
    "download-only": "仅留存",
    unsupported: "暂不支持",
  };

  return labels[status];
}
