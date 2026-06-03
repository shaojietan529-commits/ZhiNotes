"use client";

import { DEFAULT_OWNER_ID, generateId } from "@/lib/utils/id";

const STORAGE_KEY = "zhinote.sync.workspace_identity";
const FORMAT_VERSION = 1;

export interface LocalWorkspaceIdentity {
  format: "zhinote-local-workspace-identity";
  format_version: 1;
  workspace_id: string;
  device_id: string;
  owner_id: string;
  workspace_name: string;
  source: "browser-local";
  cloud_status: "local-only" | "linked-alpha";
  cloud_workspace_id?: string;
  cloud_workspace_name?: string;
  cloud_user_id?: string;
  cloud_role?: "owner" | "researcher" | "viewer";
  cloud_linked_at?: string;
  cloud_bootstrap_checked_at?: string;
  cloud_bootstrap_module_count?: number;
  cloud_sync_push_enabled?: boolean;
  cloud_sync_pull_enabled?: boolean;
  created_at: string;
  updated_at: string;
  privacy_note: string;
}

export interface CloudWorkspaceBootstrapProof {
  format: "zhinote-cloud-workspace-bootstrap-proof";
  format_version: 1;
  workspace_id: string;
  workspace_name: string;
  cloud_user_id: string;
  cloud_role: "owner" | "researcher" | "viewer";
  checked_at: string;
  module_count: number;
  sync_push_enabled: boolean;
  sync_pull_enabled: boolean;
  contains_page_text: false;
  contains_file_bytes: false;
  contains_database_rows: false;
  privacy_note: string;
}

export interface LinkLocalWorkspaceToCloudInput {
  workspace: {
    id: string;
    name: string;
  };
  user: {
    id: string;
  };
  role: "owner" | "researcher" | "viewer";
  bootstrapProof: CloudWorkspaceBootstrapProof;
}

export interface LocalWorkspaceCloudLinkReceipt {
  format: "zhinote-local-cloud-workspace-link-receipt";
  format_version: 1;
  action: "link" | "unlink";
  generated_at: string;
  local_workspace_id: string;
  local_device_id: string;
  cloud_status_before_export: LocalWorkspaceIdentity["cloud_status"];
  cloud_workspace_id: string | null;
  cloud_workspace_name: string | null;
  cloud_user_id: string | null;
  cloud_role: LocalWorkspaceIdentity["cloud_role"] | null;
  bootstrap_checked_at: string | null;
  bootstrap_module_count: number | null;
  sync_push_enabled: boolean;
  sync_pull_enabled: boolean;
  boundary: {
    local_receipt_only: true;
    uploads_workspace_data: false;
    reads_page_body_text: false;
    reads_file_bytes: false;
    reads_database_rows: false;
    creates_cloud_workspace: false;
    deletes_cloud_workspace: false;
  };
  privacy_note: string;
}

export function getOrCreateLocalWorkspaceIdentity(): LocalWorkspaceIdentity {
  const existing = readLocalWorkspaceIdentity();
  if (existing) return existing;

  const now = new Date().toISOString();
  const identity: LocalWorkspaceIdentity = {
    format: "zhinote-local-workspace-identity",
    format_version: FORMAT_VERSION,
    workspace_id: `ws_${generateId()}`,
    device_id: `dev_${generateId()}`,
    owner_id: DEFAULT_OWNER_ID,
    workspace_name: "Local ZhiNotes Workspace",
    source: "browser-local",
    cloud_status: "local-only",
    created_at: now,
    updated_at: now,
    privacy_note:
      "Generated locally. This identity is an anonymous browser-local workspace and device id. It does not create an account, connect cloud services, upload notes, sync files, or share workspace data.",
  };

  writeLocalWorkspaceIdentity(identity);
  return identity;
}

export function readLocalWorkspaceIdentity(): LocalWorkspaceIdentity | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isLocalWorkspaceIdentity(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function buildLocalWorkspaceIdentitySnapshot(
  identity: LocalWorkspaceIdentity
) {
  return {
    ...identity,
    exported_at: new Date().toISOString(),
  };
}

export function buildCloudWorkspaceBootstrapProof(input: {
  workspace: {
    id: string;
    name: string;
  };
  user: {
    id: string;
  };
  role: "owner" | "researcher" | "viewer";
  moduleCount: number;
  syncPushEnabled: boolean;
  syncPullEnabled: boolean;
}): CloudWorkspaceBootstrapProof {
  return {
    format: "zhinote-cloud-workspace-bootstrap-proof",
    format_version: FORMAT_VERSION,
    workspace_id: input.workspace.id,
    workspace_name: input.workspace.name,
    cloud_user_id: input.user.id,
    cloud_role: input.role,
    checked_at: new Date().toISOString(),
    module_count: input.moduleCount,
    sync_push_enabled: input.syncPushEnabled,
    sync_pull_enabled: input.syncPullEnabled,
    contains_page_text: false,
    contains_file_bytes: false,
    contains_database_rows: false,
    privacy_note:
      "Generated locally from the workspace bootstrap response. This proof contains account/workspace metadata only and does not include page text, file bytes, database rows, backups, or sync queue payloads.",
  };
}

export function linkLocalWorkspaceToCloud(
  input: LinkLocalWorkspaceToCloudInput
) {
  validateBootstrapProof(input);

  const current = getOrCreateLocalWorkspaceIdentity();
  const now = new Date().toISOString();
  const next: LocalWorkspaceIdentity = {
    ...current,
    cloud_status: "linked-alpha",
    cloud_workspace_id: input.workspace.id,
    cloud_workspace_name: input.workspace.name,
    cloud_user_id: input.user.id,
    cloud_role: input.role,
    cloud_linked_at: now,
    cloud_bootstrap_checked_at: input.bootstrapProof.checked_at,
    cloud_bootstrap_module_count: input.bootstrapProof.module_count,
    cloud_sync_push_enabled: input.bootstrapProof.sync_push_enabled,
    cloud_sync_pull_enabled: input.bootstrapProof.sync_pull_enabled,
    updated_at: now,
    privacy_note:
      "Linked locally to a private-alpha cloud workspace after a bootstrap membership check. This stores account/workspace metadata in browser localStorage only. It does not upload notes, files, databases, backups, or sync queue rows.",
  };

  writeLocalWorkspaceIdentity(next);
  return next;
}

export function unlinkLocalWorkspaceFromCloud() {
  const current = getOrCreateLocalWorkspaceIdentity();
  const now = new Date().toISOString();
  const next: LocalWorkspaceIdentity = {
    ...current,
    cloud_status: "local-only",
    updated_at: now,
    privacy_note:
      "Generated locally. This identity is an anonymous browser-local workspace and device id. It does not create an account, connect cloud services, upload notes, sync files, or share workspace data.",
  };

  delete next.cloud_workspace_id;
  delete next.cloud_workspace_name;
  delete next.cloud_user_id;
  delete next.cloud_role;
  delete next.cloud_linked_at;
  delete next.cloud_bootstrap_checked_at;
  delete next.cloud_bootstrap_module_count;
  delete next.cloud_sync_push_enabled;
  delete next.cloud_sync_pull_enabled;

  writeLocalWorkspaceIdentity(next);
  return next;
}

export function buildLocalWorkspaceCloudLinkReceipt(input: {
  action: "link" | "unlink";
  identity: LocalWorkspaceIdentity;
}): LocalWorkspaceCloudLinkReceipt {
  return {
    format: "zhinote-local-cloud-workspace-link-receipt",
    format_version: FORMAT_VERSION,
    action: input.action,
    generated_at: new Date().toISOString(),
    local_workspace_id: input.identity.workspace_id,
    local_device_id: input.identity.device_id,
    cloud_status_before_export: input.identity.cloud_status,
    cloud_workspace_id: input.identity.cloud_workspace_id ?? null,
    cloud_workspace_name: input.identity.cloud_workspace_name ?? null,
    cloud_user_id: input.identity.cloud_user_id ?? null,
    cloud_role: input.identity.cloud_role ?? null,
    bootstrap_checked_at: input.identity.cloud_bootstrap_checked_at ?? null,
    bootstrap_module_count: input.identity.cloud_bootstrap_module_count ?? null,
    sync_push_enabled: Boolean(input.identity.cloud_sync_push_enabled),
    sync_pull_enabled: Boolean(input.identity.cloud_sync_pull_enabled),
    boundary: {
      local_receipt_only: true,
      uploads_workspace_data: false,
      reads_page_body_text: false,
      reads_file_bytes: false,
      reads_database_rows: false,
      creates_cloud_workspace: false,
      deletes_cloud_workspace: false,
    },
    privacy_note:
      "Generated locally. This receipt records local cloud-link metadata only. It does not include page text, file bytes, database rows, sync queue payloads, tokens, credentials, backups, or private report content.",
  };
}

function writeLocalWorkspaceIdentity(identity: LocalWorkspaceIdentity) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  } catch {
    // Keep the generated identity usable for the current session even if
    // browser storage is unavailable.
  }
}

function validateBootstrapProof(input: LinkLocalWorkspaceToCloudInput) {
  const proof = input.bootstrapProof;

  if (proof.workspace_id !== input.workspace.id) {
    throw new Error("Bootstrap proof workspace does not match selected workspace.");
  }

  if (proof.cloud_user_id !== input.user.id) {
    throw new Error("Bootstrap proof user does not match current session.");
  }

  if (proof.cloud_role !== input.role) {
    throw new Error("Bootstrap proof role does not match selected workspace role.");
  }

  if (proof.sync_push_enabled || proof.sync_pull_enabled) {
    throw new Error("Bootstrap proof must show sync push and pull are disabled.");
  }
}

function isLocalWorkspaceIdentity(
  value: unknown
): value is LocalWorkspaceIdentity {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    record.format === "zhinote-local-workspace-identity" &&
    record.format_version === FORMAT_VERSION &&
    typeof record.workspace_id === "string" &&
    typeof record.device_id === "string" &&
    typeof record.owner_id === "string" &&
    typeof record.workspace_name === "string" &&
    record.source === "browser-local" &&
    (record.cloud_status === "local-only" ||
      isLinkedCloudWorkspaceIdentity(record)) &&
    typeof record.created_at === "string" &&
    typeof record.updated_at === "string" &&
    typeof record.privacy_note === "string"
  );
}

function isLinkedCloudWorkspaceIdentity(record: Record<string, unknown>) {
  return (
    record.cloud_status === "linked-alpha" &&
    typeof record.cloud_workspace_id === "string" &&
    typeof record.cloud_workspace_name === "string" &&
    typeof record.cloud_user_id === "string" &&
    (record.cloud_role === "owner" ||
      record.cloud_role === "researcher" ||
      record.cloud_role === "viewer") &&
    typeof record.cloud_linked_at === "string"
  );
}
