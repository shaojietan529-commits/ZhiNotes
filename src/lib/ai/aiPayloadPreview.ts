import type { StoredPageFile } from "@/lib/files/localStore";
import type { Page } from "@/lib/utils/types";

export type AiPayloadRisk = "low" | "medium" | "high";

export interface AiPayloadWorkflow {
  id: string;
  title: string;
  output: string;
}

export interface AiPayloadPreviewInput {
  workflow: AiPayloadWorkflow;
  selectedPages: Page[];
  storedFiles: StoredPageFile[];
  question: string;
}

export interface AiPayloadPageContext {
  page_id: string;
  title: string;
  content_included: false;
  risk: AiPayloadRisk;
}

export interface AiPayloadFileContext {
  kind: string;
  count: number;
  total_bytes: number;
  included_in_payload: false;
  requires_separate_confirmation: true;
  risk: AiPayloadRisk;
}

export interface AiPayloadPreview {
  format: "zhinote-ai-payload-preview";
  format_version: 1;
  preview_status: "local-preview-only";
  can_run_ai_now: false;
  privacy_note: string;
  boundary: {
    local_preview_only: true;
    calls_model_provider: false;
    uploads_page_content: false;
    uploads_file_bytes: false;
    includes_page_body_text: false;
    includes_file_bytes: false;
    requires_provider_confirmation: true;
    requires_retention_confirmation: true;
  };
  workflow: AiPayloadWorkflow;
  prompt: {
    provided: boolean;
    character_count: number;
    included_text_in_preview: false;
  };
  summary: {
    selected_pages: number;
    file_kinds_available: number;
    files_available: number;
    high_risk_items: number;
    approvals_required: number;
  };
  selected_pages: AiPayloadPageContext[];
  available_files: AiPayloadFileContext[];
  approvals_required: string[];
}

export function buildAiPayloadPreview(
  input: AiPayloadPreviewInput
): AiPayloadPreview {
  const selectedPages = input.selectedPages.map((page) => ({
    page_id: page.id,
    title: page.title || "Untitled",
    content_included: false as const,
    risk: "high" as const,
  }));
  const availableFiles = summarizeFiles(input.storedFiles);
  const approvalsRequired = buildApprovals(input, availableFiles);

  return {
    format: "zhinote-ai-payload-preview",
    format_version: 1,
    preview_status: "local-preview-only",
    can_run_ai_now: false,
    privacy_note:
      "Generated locally. This AI payload preview does not call model providers, upload page content, upload file bytes, include page body text, include file bytes, or share workspace data.",
    boundary: {
      local_preview_only: true,
      calls_model_provider: false,
      uploads_page_content: false,
      uploads_file_bytes: false,
      includes_page_body_text: false,
      includes_file_bytes: false,
      requires_provider_confirmation: true,
      requires_retention_confirmation: true,
    },
    workflow: {
      id: input.workflow.id,
      title: input.workflow.title,
      output: input.workflow.output,
    },
    prompt: {
      provided: input.question.trim().length > 0,
      character_count: input.question.trim().length,
      included_text_in_preview: false,
    },
    summary: {
      selected_pages: selectedPages.length,
      file_kinds_available: availableFiles.length,
      files_available: input.storedFiles.length,
      high_risk_items:
        selectedPages.filter((page) => page.risk === "high").length +
        availableFiles.filter((file) => file.risk === "high").length,
      approvals_required: approvalsRequired.length,
    },
    selected_pages: selectedPages,
    available_files: availableFiles,
    approvals_required: approvalsRequired,
  };
}

function summarizeFiles(files: StoredPageFile[]): AiPayloadFileContext[] {
  const grouped = files.reduce<
    Record<string, { count: number; totalBytes: number; risk: AiPayloadRisk }>
  >((summary, file) => {
    const current = summary[file.kind] ?? {
      count: 0,
      totalBytes: 0,
      risk: getFileRisk(file.kind),
    };
    current.count += 1;
    current.totalBytes += file.size;
    summary[file.kind] = current;
    return summary;
  }, {});

  return Object.entries(grouped)
    .map(([kind, value]) => ({
      kind,
      count: value.count,
      total_bytes: value.totalBytes,
      included_in_payload: false as const,
      requires_separate_confirmation: true as const,
      risk: value.risk,
    }))
    .sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind));
}

function buildApprovals(
  input: AiPayloadPreviewInput,
  files: AiPayloadFileContext[]
) {
  const approvals = [
    "Choose model provider and destination before any outbound AI request.",
    "Confirm retention policy and whether prompts/outputs may be stored.",
    "Preview final payload immediately before sending to AI.",
  ];

  if (input.selectedPages.length > 0) {
    approvals.push("Confirm page body text inclusion for selected pages.");
  }

  if (files.length > 0) {
    approvals.push("Confirm each file kind before including file content.");
  }

  if (input.question.trim().length > 0) {
    approvals.push("Confirm the research question text before sending.");
  }

  return approvals;
}

function getFileRisk(kind: string): AiPayloadRisk {
  if (
    [
      "html",
      "markdown",
      "pdf",
      "spreadsheet",
      "word",
      "presentation",
      "notebook",
      "archive",
    ].includes(kind)
  ) {
    return "high";
  }

  if (["image", "audio", "video", "rtf", "epub"].includes(kind)) {
    return "medium";
  }

  return "low";
}
