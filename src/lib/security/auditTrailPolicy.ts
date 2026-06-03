import type {
  SyncLogSummary,
} from "@/lib/db/local/queries";
import type { LocalWorkspaceIdentity } from "@/lib/sync/workspaceIdentity";

export type AuditTrailStatus =
  | "planned"
  | "manual-confirmation"
  | "blocked";

export type AuditTrailCategory =
  | "auth"
  | "sync"
  | "restore"
  | "ai"
  | "permissions"
  | "exports"
  | "files"
  | "admin";

export interface AuditTrailPolicyInput {
  workspaceIdentity: LocalWorkspaceIdentity | null;
  syncSummary: SyncLogSummary | null;
  disabledApiStubs: number;
}

export interface AuditTrailEvent {
  id: string;
  category: AuditTrailCategory;
  title: string;
  status: AuditTrailStatus;
  trigger: string;
  required_action: string;
  payload_policy: string;
}

export interface AuditTrailGate {
  id: string;
  title: string;
  status: AuditTrailStatus;
  evidence: string;
  required_action: string;
}

export interface AuditTrailField {
  field: string;
  status: "allowed" | "forbidden";
  purpose: string;
}

export interface AuditTrailPolicy {
  format: "zhinote-audit-trail-policy";
  format_version: 1;
  policy_status: "local-policy-only";
  can_record_server_audit_events: false;
  disabled_endpoint: "/api/audit/events";
  privacy_note: string;
  boundary: {
    local_policy_only: true;
    reads_page_body_text: false;
    reads_file_bytes: false;
    uploads_workspace_data: false;
    writes_server_audit_log: false;
    exposes_secret_values: false;
    requires_authenticated_actor: true;
  };
  local_evidence: {
    workspace_identity_available: boolean;
    device_identity_available: boolean;
    sync_log_rows: number;
    pending_sync_rows: number;
    disabled_api_stubs: number;
  };
  summary: {
    events: number;
    blocked: number;
    manual_confirmation: number;
    planned: number;
    required_before_private_beta: number;
  };
  events: AuditTrailEvent[];
  gates: AuditTrailGate[];
  fields: AuditTrailField[];
}

export function buildAuditTrailPolicy(
  input: AuditTrailPolicyInput
): AuditTrailPolicy {
  const events = buildAuditTrailEvents();
  const gates = buildAuditTrailGates(input);

  return {
    format: "zhinote-audit-trail-policy",
    format_version: 1,
    policy_status: "local-policy-only",
    can_record_server_audit_events: false,
    disabled_endpoint: "/api/audit/events",
    privacy_note:
      "Generated locally. This audit policy does not record server audit events, read page body text, read file bytes, upload workspace data, write server logs, or expose secret values.",
    boundary: {
      local_policy_only: true,
      reads_page_body_text: false,
      reads_file_bytes: false,
      uploads_workspace_data: false,
      writes_server_audit_log: false,
      exposes_secret_values: false,
      requires_authenticated_actor: true,
    },
    local_evidence: {
      workspace_identity_available: Boolean(input.workspaceIdentity),
      device_identity_available: Boolean(input.workspaceIdentity?.device_id),
      sync_log_rows: input.syncSummary?.total ?? 0,
      pending_sync_rows: input.syncSummary?.pending ?? 0,
      disabled_api_stubs: input.disabledApiStubs,
    },
    summary: {
      events: events.length,
      blocked: gates.filter((gate) => gate.status === "blocked").length,
      manual_confirmation: gates.filter(
        (gate) => gate.status === "manual-confirmation"
      ).length,
      planned: gates.filter((gate) => gate.status === "planned").length,
      required_before_private_beta: gates.length,
    },
    events,
    gates,
    fields: buildAuditTrailFields(),
  };
}

function buildAuditTrailEvents(): AuditTrailEvent[] {
  return [
    event(
      "login-session",
      "auth",
      "Login, logout, and device session changes",
      "blocked",
      "Auth session APIs become real server endpoints.",
      "Record actor id, workspace id, device id, session action, IP risk metadata, and timestamp after auth is implemented.",
      "Never store passwords, magic-link tokens, session cookies, or OAuth tokens in audit rows."
    ),
    event(
      "permission-change",
      "permissions",
      "Role, invite, share, and permission changes",
      "blocked",
      "Owner changes workspace membership or share settings.",
      "Require server-side owner permission check and record old/new role metadata.",
      "Store role ids and resource ids only; do not store page bodies or file bytes."
    ),
    event(
      "sync-push-pull",
      "sync",
      "Cloud sync push, pull, acknowledgement, and conflict actions",
      "blocked",
      "A sync batch is pushed, pulled, acknowledged, retried, or marked conflicted.",
      "Record batch id, table counts, conflict count, device id, and permission decision.",
      "Store table names, row counts, and changed field names only; exclude note text and file bytes."
    ),
    event(
      "backup-restore",
      "restore",
      "Backup export, restore preview, rollback, and restore write-back",
      "manual-confirmation",
      "A backup export, restore preview, rollback export, or restore write-back is requested.",
      "Record restore scope summary and confirmation ids before any restore write-back can exist.",
      "Store counts, backup format, checksum, and confirmation timestamps; never store the full backup payload."
    ),
    event(
      "ai-execution",
      "ai",
      "AI payload approval and model execution",
      "blocked",
      "AI provider calls are enabled after final payload preview.",
      "Record provider, model, prompt class, approved context counts, and retention decision after user confirmation.",
      "Store payload metadata only by default; do not store full prompt text, page text, or file bytes unless explicitly approved."
    ),
    event(
      "file-storage",
      "files",
      "Private file upload, download, preview, and deletion",
      "blocked",
      "Private storage buckets and signed URLs are enabled.",
      "Record file metadata, storage action, checksum, size class, and resource permission result.",
      "Do not store raw file bytes, signed URL secrets, or public links in audit rows."
    ),
    event(
      "export-download",
      "exports",
      "Workspace, queue, policy, readiness, and report exports",
      "planned",
      "A user exports local workspace or Web Beta readiness artifacts.",
      "Record export type, resource scope, actor role, and generated file metadata after auth exists.",
      "Store export metadata and counts only; do not store exported content."
    ),
    event(
      "admin-launch",
      "admin",
      "Deployment, environment, and private beta launch approvals",
      "blocked",
      "Private beta deployment gates are checked or approved.",
      "Record gate id, evidence status, approver, environment, and rollback readiness.",
      "Never store secret environment values, tokens, or connection strings."
    ),
  ];
}

function buildAuditTrailGates(input: AuditTrailPolicyInput): AuditTrailGate[] {
  return [
    {
      id: "authenticated-actor",
      title: "Authenticated actor identity",
      status: "blocked",
      evidence: input.workspaceIdentity
        ? `Local workspace ${input.workspaceIdentity.workspace_id} and device ${input.workspaceIdentity.device_id} exist, but no authenticated user exists.`
        : "No authenticated user or local workspace identity is available.",
      required_action:
        "Implement account login, workspace membership, and server session identity before audit events can be trusted.",
    },
    {
      id: "server-audit-table",
      title: "Server audit_events table",
      status: "blocked",
      evidence:
        "audit_events is contracted in the cloud schema, but no migration, retention policy, or server write path exists.",
      required_action:
        "Create a versioned audit_events migration with workspace_id, actor_id, device_id, event type, resource id, metadata, and retention fields.",
    },
    {
      id: "permission-integration",
      title: "Permission check integration",
      status: "blocked",
      evidence: `${input.disabledApiStubs} Web Beta API stubs remain disabled; permission checks do not enforce server actions yet.`,
      required_action:
        "Require permission-check decisions before logging export, restore, sync, sharing, AI, file, or admin actions.",
    },
    {
      id: "payload-redaction",
      title: "Payload redaction policy",
      status: "manual-confirmation",
      evidence: `${input.syncSummary?.pending ?? 0} sync rows are pending locally; audit rows must stay metadata-only by default.`,
      required_action:
        "Finalize which metadata fields are allowed and forbid page bodies, file bytes, prompt text, tokens, and secret values unless explicitly approved.",
    },
    {
      id: "retention-export",
      title: "Retention and audit export policy",
      status: "manual-confirmation",
      evidence:
        "No audit retention duration, admin export permission, or user-visible audit download flow exists yet.",
      required_action:
        "Choose retention windows, owner-only audit export rules, and incident review workflow before private beta.",
    },
    {
      id: "local-evidence",
      title: "Local readiness evidence",
      status: "planned",
      evidence: `${input.syncSummary?.total ?? 0} local sync rows exist and local readiness exports are available; no server audit write is attempted.`,
      required_action:
        "Keep this policy exportable locally until the server audit implementation is reviewed.",
    },
  ];
}

function buildAuditTrailFields(): AuditTrailField[] {
  return [
    field("event_id", "allowed", "Stable server id for one audit event."),
    field("workspace_id", "allowed", "Workspace boundary for every event."),
    field("actor_user_id", "allowed", "Authenticated user who took the action."),
    field("device_id", "allowed", "Device that initiated the action."),
    field("event_type", "allowed", "Normalized action category."),
    field("resource_type", "allowed", "Page, database, file, sync batch, AI run, permission, or deployment gate."),
    field("resource_id", "allowed", "Resource identifier when available."),
    field("metadata_counts", "allowed", "Counts, field names, statuses, and checksums only."),
    field("created_at", "allowed", "Server timestamp for ordering and incident review."),
    field("page_body_text", "forbidden", "Research notes must not be stored in audit rows."),
    field("file_bytes", "forbidden", "Files must stay in private storage, not audit rows."),
    field("prompt_text", "forbidden", "AI prompts stay out of audit rows unless the user explicitly opts in later."),
    field("secret_values", "forbidden", "Tokens, cookies, connection strings, and signed URLs are never audit payloads."),
  ];
}

function event(
  id: string,
  category: AuditTrailCategory,
  title: string,
  status: AuditTrailStatus,
  trigger: string,
  requiredAction: string,
  payloadPolicy: string
): AuditTrailEvent {
  return {
    id,
    category,
    title,
    status,
    trigger,
    required_action: requiredAction,
    payload_policy: payloadPolicy,
  };
}

function field(
  fieldName: string,
  status: AuditTrailField["status"],
  purpose: string
): AuditTrailField {
  return {
    field: fieldName,
    status,
    purpose,
  };
}
