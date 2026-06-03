import type { LocalWorkspaceIdentity } from "@/lib/sync/workspaceIdentity";
import type { SyncConflictReviewReport } from "@/lib/sync/syncConflictReview";
import type { SyncPayloadPreview } from "@/lib/sync/syncPayloadPreview";

export type SyncOptInGateStatus =
  | "ready"
  | "manual-confirmation"
  | "blocked";

export interface SyncOptInGateInput {
  workspaceIdentity: LocalWorkspaceIdentity | null;
  syncPayloadPreview: SyncPayloadPreview;
  conflictReview: SyncConflictReviewReport;
  pushApiPath: string;
}

export interface SyncOptInGateRow {
  id: string;
  title: string;
  status: SyncOptInGateStatus;
  evidence: string;
  required_action: string;
}

export interface SyncOptInGateReport {
  format: "zhinote-sync-opt-in-gate";
  format_version: 1;
  gate_status: "blocked-before-private-alpha-sync";
  can_start_cloud_sync: false;
  privacy_note: string;
  workspace_identity: {
    workspace_id: string | null;
    device_id: string | null;
    cloud_status: LocalWorkspaceIdentity["cloud_status"] | "missing";
    cloud_workspace_id: string | null;
    cloud_role: LocalWorkspaceIdentity["cloud_role"] | null;
  };
  payload_scope: {
    pending_count: number;
    included_count: number;
    high_risk_tables: number;
    medium_risk_tables: number;
    contains_page_text: false;
    contains_file_bytes: false;
  };
  boundary: {
    uploads_data: false;
    reads_remote_data: false;
    writes_server_data: false;
    requires_owner_confirmation: true;
    requires_remote_baseline: true;
    push_api_disabled: true;
  };
  confirmation: {
    required_phrase: string;
    current_ui_collects_phrase: false;
  };
  summary: {
    gates: number;
    ready: number;
    manual_confirmation: number;
    blocked: number;
  };
  gates: SyncOptInGateRow[];
}

export function buildSyncOptInGateReport(
  input: SyncOptInGateInput
): SyncOptInGateReport {
  const gates = buildGates(input);

  return {
    format: "zhinote-sync-opt-in-gate",
    format_version: 1,
    gate_status: "blocked-before-private-alpha-sync",
    can_start_cloud_sync: false,
    privacy_note:
      "Generated locally. This opt-in gate checks whether cloud sync can enter a future confirmation flow. It does not upload notes, files, databases, backups, sync queue rows, or page text.",
    workspace_identity: {
      workspace_id: input.workspaceIdentity?.workspace_id ?? null,
      device_id: input.workspaceIdentity?.device_id ?? null,
      cloud_status: input.workspaceIdentity?.cloud_status ?? "missing",
      cloud_workspace_id: input.workspaceIdentity?.cloud_workspace_id ?? null,
      cloud_role: input.workspaceIdentity?.cloud_role ?? null,
    },
    payload_scope: {
      pending_count: input.syncPayloadPreview.summary.pending_count,
      included_count: input.syncPayloadPreview.summary.included_count,
      high_risk_tables: input.syncPayloadPreview.summary.high_risk_tables,
      medium_risk_tables: input.syncPayloadPreview.summary.medium_risk_tables,
      contains_page_text: false,
      contains_file_bytes: false,
    },
    boundary: {
      uploads_data: false,
      reads_remote_data: false,
      writes_server_data: false,
      requires_owner_confirmation: true,
      requires_remote_baseline: true,
      push_api_disabled: true,
    },
    confirmation: {
      required_phrase: "ENABLE PRIVATE ALPHA SYNC",
      current_ui_collects_phrase: false,
    },
    summary: {
      gates: gates.length,
      ready: gates.filter((gate) => gate.status === "ready").length,
      manual_confirmation: gates.filter(
        (gate) => gate.status === "manual-confirmation"
      ).length,
      blocked: gates.filter((gate) => gate.status === "blocked").length,
    },
    gates,
  };
}

function buildGates(input: SyncOptInGateInput): SyncOptInGateRow[] {
  const identity = input.workspaceIdentity;
  const linked = identity?.cloud_status === "linked-alpha";
  const hasPendingRows = input.syncPayloadPreview.summary.pending_count > 0;
  const needsRemoteBaseline =
    input.conflictReview.summary.needs_remote_baseline > 0;
  const hasHighRiskTables =
    input.syncPayloadPreview.summary.high_risk_tables > 0;

  return [
    {
      id: "local-identity",
      title: "Local workspace identity",
      status: identity ? "ready" : "blocked",
      evidence: identity
        ? `Local workspace ${identity.workspace_id} and device ${identity.device_id} exist.`
        : "No browser-local workspace identity is available.",
      required_action:
        "Keep a stable local workspace and device id before any cloud cursor is created.",
    },
    {
      id: "cloud-link",
      title: "Cloud workspace link",
      status: linked ? "ready" : "blocked",
      evidence: linked
        ? `Linked to cloud workspace ${identity?.cloud_workspace_id} as ${identity?.cloud_role}.`
        : "The local browser workspace is not linked to a cloud workspace id.",
      required_action:
        "Use Cloud Alpha to log in, list or create a workspace, run bootstrap, then connect the local workspace.",
    },
    {
      id: "payload-preview",
      title: "Payload preview reviewed",
      status: hasPendingRows ? "manual-confirmation" : "ready",
      evidence: hasPendingRows
        ? `${input.syncPayloadPreview.summary.pending_count} pending rows exist; preview includes ${input.syncPayloadPreview.summary.included_count} metadata rows.`
        : "No pending sync rows are waiting for cloud push.",
      required_action:
        "Export and review the metadata-only payload preview before any upload implementation is enabled.",
    },
    {
      id: "sensitivity",
      title: "Sensitive table confirmation",
      status: hasHighRiskTables ? "manual-confirmation" : "ready",
      evidence: `${input.syncPayloadPreview.summary.high_risk_tables} high-risk table groups and ${input.syncPayloadPreview.summary.medium_risk_tables} medium-risk table groups are in scope.`,
      required_action:
        "Require owner confirmation for page bodies, versions, comments, database rows, files, and relation metadata.",
    },
    {
      id: "remote-baseline",
      title: "Remote baseline and conflicts",
      status: needsRemoteBaseline ? "blocked" : "ready",
      evidence: needsRemoteBaseline
        ? `${input.conflictReview.summary.needs_remote_baseline} conflict surfaces need remote latest baseline before sync.`
        : "No active local conflict surface currently requires remote baseline.",
      required_action:
        "Implement remote baseline fetch and side-by-side conflict review before acknowledging cloud push or pull.",
    },
    {
      id: "push-api",
      title: "Cloud push API",
      status: "blocked",
      evidence: `${input.pushApiPath} is intentionally disabled and does not read request bodies.`,
      required_action:
        "Keep push disabled until permission checks, audit events, retries, idempotency, acknowledgement, and rollback proof exist.",
    },
    {
      id: "owner-confirmation",
      title: "Owner opt-in confirmation",
      status: "manual-confirmation",
      evidence:
        "No UI currently collects the required private-alpha sync phrase.",
      required_action:
        "Before first real upload, require the owner to type ENABLE PRIVATE ALPHA SYNC after reviewing exact scope and destination.",
    },
  ];
}
