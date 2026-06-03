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
  created_at: string;
  updated_at: string;
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

export function linkLocalWorkspaceToCloud(
  input: LinkLocalWorkspaceToCloudInput
) {
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
    updated_at: now,
    privacy_note:
      "Linked locally to a private-alpha cloud workspace. This stores account/workspace metadata in browser localStorage only. It does not upload notes, files, databases, backups, or sync queue rows.",
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

  writeLocalWorkspaceIdentity(next);
  return next;
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
