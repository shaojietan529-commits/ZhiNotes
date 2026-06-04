"use client";

import {
  formatFileSize,
  type PageFileKind,
  type StoredPageFile,
} from "@/lib/files/localStore";

export const FILE_PREVIEW_ACTION_RECEIPT_EVENT =
  "zhinote:file-preview-action-receipt";

const STORAGE_KEY = "zhinote.filePreview.actionReceipts";
const MAX_RECEIPTS = 100;

export type FilePreviewActionKind =
  | "native-preview"
  | "download-retain"
  | "editable-import"
  | "database-import"
  | "external-resource-enable"
  | "external-resource-disable";

export type FilePreviewActionStatus = "completed" | "confirmed" | "failed";

export interface FilePreviewActionReceiptInput {
  file: Pick<
    StoredPageFile,
    "id" | "name" | "kind" | "mimeType" | "size"
  >;
  action_kind: FilePreviewActionKind;
  action_status?: FilePreviewActionStatus;
  source_surface?: "file-preview-block" | "reports-module";
  writes_page_content?: boolean;
  creates_database?: boolean;
  creates_database_rows?: boolean;
  changes_preview_network_boundary?: boolean;
  external_resources_allowed?: boolean;
  confirmation_required?: boolean;
  confirmation_matched?: boolean;
  rows_written?: number | null;
  fields_written?: number | null;
  note?: string | null;
}

export interface FilePreviewActionReceipt {
  format: "zhinote-file-preview-action-receipt";
  format_version: 1;
  receipt_id: string;
  receipt_status: "local-file-action-metadata-only";
  action_kind: FilePreviewActionKind;
  action_status: FilePreviewActionStatus;
  source_surface: "file-preview-block" | "reports-module";
  created_at: string;
  privacy_note: string;
  file: {
    local_file_id: string;
    kind: PageFileKind;
    extension: string;
    mime_type: string;
    size_bytes: number;
    size_label: string;
    file_name_included: false;
  };
  action: {
    writes_page_content: boolean;
    creates_database: boolean;
    creates_database_rows: boolean;
    changes_preview_network_boundary: boolean;
    external_resources_allowed: boolean;
    confirmation_required: boolean;
    confirmation_matched: boolean;
    rows_written: number | null;
    fields_written: number | null;
    note: string | null;
  };
  boundary: {
    local_receipt_only: true;
    stored_in_browser_local_storage: true;
    includes_file_name: false;
    includes_file_bytes: false;
    includes_file_text: false;
    includes_page_body_text: false;
    includes_spreadsheet_cell_values: false;
    includes_tokens_or_credentials: false;
    uploads_data: false;
    calls_external_service: false;
    writes_server_audit_log: false;
    receipt_writes_workspace_data: false;
    action_may_write_local_workspace_data: boolean;
  };
}

export function buildFilePreviewActionReceipt(
  input: FilePreviewActionReceiptInput
): FilePreviewActionReceipt {
  const writesPageContent =
    input.writes_page_content ??
    (input.action_kind === "editable-import" ||
      input.action_kind === "native-preview");
  const createsDatabase =
    input.creates_database ?? input.action_kind === "database-import";
  const createsDatabaseRows =
    input.creates_database_rows ?? input.action_kind === "database-import";
  const changesPreviewNetworkBoundary =
    input.changes_preview_network_boundary ??
    input.action_kind.startsWith("external-resource-");
  const confirmationRequired =
    input.confirmation_required ??
    (input.action_kind === "database-import" ||
      input.action_kind === "external-resource-enable");
  const confirmationMatched =
    input.confirmation_matched ?? input.action_status !== "failed";
  const actionMayWriteLocalWorkspaceData =
    writesPageContent || createsDatabase || createsDatabaseRows;

  return {
    format: "zhinote-file-preview-action-receipt",
    format_version: 1,
    receipt_id: createReceiptId(),
    receipt_status: "local-file-action-metadata-only",
    action_kind: input.action_kind,
    action_status: input.action_status ?? "completed",
    source_surface: input.source_surface ?? "file-preview-block",
    created_at: new Date().toISOString(),
    privacy_note:
      "Generated locally after a file preview action. This receipt records action metadata only. It does not include file names, file bytes, file text, page body text, spreadsheet cell values, tokens, credentials, prompts, cloud data, or AI output.",
    file: {
      local_file_id: input.file.id,
      kind: input.file.kind,
      extension: getSafeExtension(input.file.name),
      mime_type: input.file.mimeType || "application/octet-stream",
      size_bytes: input.file.size,
      size_label: formatFileSize(input.file.size),
      file_name_included: false,
    },
    action: {
      writes_page_content: writesPageContent,
      creates_database: createsDatabase,
      creates_database_rows: createsDatabaseRows,
      changes_preview_network_boundary: changesPreviewNetworkBoundary,
      external_resources_allowed: input.external_resources_allowed ?? false,
      confirmation_required: confirmationRequired,
      confirmation_matched: confirmationMatched,
      rows_written: input.rows_written ?? null,
      fields_written: input.fields_written ?? null,
      note: input.note ?? null,
    },
    boundary: {
      local_receipt_only: true,
      stored_in_browser_local_storage: true,
      includes_file_name: false,
      includes_file_bytes: false,
      includes_file_text: false,
      includes_page_body_text: false,
      includes_spreadsheet_cell_values: false,
      includes_tokens_or_credentials: false,
      uploads_data: false,
      calls_external_service: false,
      writes_server_audit_log: false,
      receipt_writes_workspace_data: false,
      action_may_write_local_workspace_data: actionMayWriteLocalWorkspaceData,
    },
  };
}

export function appendFilePreviewActionReceipt(
  receipt: FilePreviewActionReceipt
) {
  if (!canUseLocalStorage()) return;

  const receipts = [receipt, ...listFilePreviewActionReceipts()].slice(
    0,
    MAX_RECEIPTS
  );
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(receipts));
  window.dispatchEvent(
    new CustomEvent(FILE_PREVIEW_ACTION_RECEIPT_EVENT, { detail: receipt })
  );
}

export function listFilePreviewActionReceipts(): FilePreviewActionReceipt[] {
  if (!canUseLocalStorage()) return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isFilePreviewActionReceipt);
  } catch {
    return [];
  }
}

function isFilePreviewActionReceipt(
  value: unknown
): value is FilePreviewActionReceipt {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<FilePreviewActionReceipt>;
  return (
    record.format === "zhinote-file-preview-action-receipt" &&
    record.receipt_status === "local-file-action-metadata-only" &&
    Boolean(record.receipt_id) &&
    Boolean(record.created_at)
  );
}

function canUseLocalStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function getSafeExtension(fileName: string) {
  const baseName = fileName.split(/[\\/]/).pop() ?? fileName;
  const lastDot = baseName.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === baseName.length - 1) return "";
  return baseName.slice(lastDot).toLowerCase();
}

function createReceiptId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `receipt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
