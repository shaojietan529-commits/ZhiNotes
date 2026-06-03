import type { AccountSessionBoundary } from "@/lib/security/accountSessionBoundary";
import type { AuditTrailPolicy } from "@/lib/security/auditTrailPolicy";
import type { PermissionDecisionReport } from "@/lib/security/permissionDecision";
import type { SyncConflictResolutionContract } from "@/lib/sync/syncConflictResolution";
import type { SyncConflictReviewReport } from "@/lib/sync/syncConflictReview";
import type { SyncReplayTestPlan } from "@/lib/sync/syncReplayTestPlan";
import type { LocalWorkspaceIdentity } from "@/lib/sync/workspaceIdentity";

export type RemoteBaselineRequestStatus =
  | "planned"
  | "manual-confirmation"
  | "blocked";

export interface RemoteBaselineRequestInput {
  workspaceIdentity: LocalWorkspaceIdentity | null;
  conflictReview: SyncConflictReviewReport;
  conflictResolution: SyncConflictResolutionContract;
  replayTestPlan: SyncReplayTestPlan;
  accountSessionBoundary: AccountSessionBoundary;
  permissionDecisionReport: PermissionDecisionReport | null;
  auditTrailPolicy: AuditTrailPolicy | null;
}

export interface RemoteBaselineSurfaceRequest {
  surface_id: string;
  surface: string;
  status: RemoteBaselineRequestStatus;
  request_status: "disabled";
  endpoint: "/api/sync/pull";
  query_mode: "baseline";
  required_remote_metadata: string[];
  forbidden_remote_payload: string[];
  staging_target: string;
  privacy_boundary: string;
}

export interface RemoteBaselineGate {
  id: string;
  title: string;
  status: RemoteBaselineRequestStatus;
  evidence: string;
  required_action: string;
}

export interface RemoteBaselineFieldRule {
  field: string;
  status: "allowed" | "forbidden";
  reason: string;
}

export interface RemoteBaselineRequestContract {
  format: "zhinote-remote-baseline-request-contract";
  format_version: 1;
  request_status: "local-baseline-request-contract-only";
  method: "GET";
  disabled_endpoint: "/api/sync/pull?cursor=:cursor";
  can_request_remote_baseline_now: false;
  can_stage_remote_rows_now: false;
  can_apply_remote_rows_now: false;
  privacy_note: string;
  boundary: {
    local_contract_only: true;
    starts_network_request: false;
    connects_cloud_services: false;
    reads_remote_data: false;
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_comment_bodies: false;
    reads_file_bytes: false;
    stages_remote_rows: false;
    acknowledges_remote_rows: false;
    applies_remote_changes: false;
    writes_workspace_data: false;
    uploads_workspace_data: false;
    requires_authenticated_session: true;
    requires_workspace_membership: true;
    requires_side_by_side_review_staging: true;
    requires_permission_check_before_fetch: true;
    requires_audit_event_before_fetch: true;
    requires_owner_confirmation_before_apply: true;
  };
  local_evidence: {
    workspace_id: string | null;
    cloud_workspace_id: string | null;
    cloud_status: LocalWorkspaceIdentity["cloud_status"] | "missing";
    sync_pull_enabled: boolean;
    conflict_surfaces: number;
    surfaces_needing_baseline: number;
    side_by_side_surfaces: number;
    replay_conflict_baselines: number;
    permission_confirmations_required: number;
    audit_policy_events: number;
  };
  summary: {
    surface_requests: number;
    gates: number;
    blocked: number;
    manual_confirmation: number;
    allowed_fields: number;
    forbidden_fields: number;
  };
  request_scope: {
    route: "/modules/sync";
    endpoint: "/api/sync/pull";
    query_mode: "baseline";
    cursor_source: "not-available";
    workspace_scope: "linked-cloud-workspace-required";
    response_handling: "stage-for-review-only";
  };
  surface_requests: RemoteBaselineSurfaceRequest[];
  gates: RemoteBaselineGate[];
  fields: RemoteBaselineFieldRule[];
}

export function buildRemoteBaselineRequestContract(
  input: RemoteBaselineRequestInput
): RemoteBaselineRequestContract {
  const surfaceRequests = input.conflictResolution.surface_plans.map((surface) =>
    buildSurfaceRequest(surface)
  );
  const gates = buildRemoteBaselineGates(input);
  const fields = buildRemoteBaselineFieldRules();

  return {
    format: "zhinote-remote-baseline-request-contract",
    format_version: 1,
    request_status: "local-baseline-request-contract-only",
    method: "GET",
    disabled_endpoint: "/api/sync/pull?cursor=:cursor",
    can_request_remote_baseline_now: false,
    can_stage_remote_rows_now: false,
    can_apply_remote_rows_now: false,
    privacy_note:
      "Generated locally. This contract plans the future remote baseline request but does not start network requests, connect cloud services, read remote data, read page bodies, read database row values, read comment bodies, read file bytes, stage remote rows, acknowledge remote rows, apply remote changes, write workspace data, or upload workspace data.",
    boundary: {
      local_contract_only: true,
      starts_network_request: false,
      connects_cloud_services: false,
      reads_remote_data: false,
      reads_page_body_text: false,
      reads_database_row_values: false,
      reads_comment_bodies: false,
      reads_file_bytes: false,
      stages_remote_rows: false,
      acknowledges_remote_rows: false,
      applies_remote_changes: false,
      writes_workspace_data: false,
      uploads_workspace_data: false,
      requires_authenticated_session: true,
      requires_workspace_membership: true,
      requires_side_by_side_review_staging: true,
      requires_permission_check_before_fetch: true,
      requires_audit_event_before_fetch: true,
      requires_owner_confirmation_before_apply: true,
    },
    local_evidence: {
      workspace_id: input.workspaceIdentity?.workspace_id ?? null,
      cloud_workspace_id: input.workspaceIdentity?.cloud_workspace_id ?? null,
      cloud_status: input.workspaceIdentity?.cloud_status ?? "missing",
      sync_pull_enabled: Boolean(
        input.workspaceIdentity?.cloud_sync_pull_enabled
      ),
      conflict_surfaces: input.conflictReview.summary.surfaces,
      surfaces_needing_baseline:
        input.conflictReview.summary.needs_remote_baseline,
      side_by_side_surfaces:
        input.conflictResolution.summary.side_by_side_surfaces,
      replay_conflict_baselines:
        input.replayTestPlan.summary.conflict_surfaces_needing_baseline,
      permission_confirmations_required:
        input.permissionDecisionReport?.summary.needs_confirmation ?? 0,
      audit_policy_events: input.auditTrailPolicy?.summary.events ?? 0,
    },
    summary: {
      surface_requests: surfaceRequests.length,
      gates: gates.length,
      blocked: gates.filter((gate) => gate.status === "blocked").length,
      manual_confirmation: gates.filter(
        (gate) => gate.status === "manual-confirmation"
      ).length,
      allowed_fields: fields.filter((field) => field.status === "allowed")
        .length,
      forbidden_fields: fields.filter((field) => field.status === "forbidden")
        .length,
    },
    request_scope: {
      route: "/modules/sync",
      endpoint: "/api/sync/pull",
      query_mode: "baseline",
      cursor_source: "not-available",
      workspace_scope: "linked-cloud-workspace-required",
      response_handling: "stage-for-review-only",
    },
    surface_requests: surfaceRequests,
    gates,
    fields,
  };
}

function buildSurfaceRequest(
  surface: SyncConflictResolutionContract["surface_plans"][number]
): RemoteBaselineSurfaceRequest {
  return {
    surface_id: surface.surface_id,
    surface: surface.surface,
    status:
      surface.status === "planned" ? "planned" : "manual-confirmation",
    request_status: "disabled",
    endpoint: "/api/sync/pull",
    query_mode: "baseline",
    required_remote_metadata: getRequiredRemoteMetadata(surface.surface_id),
    forbidden_remote_payload: getForbiddenRemotePayload(surface.surface_id),
    staging_target:
      "Stage metadata into the side-by-side review surface without applying writes.",
    privacy_boundary:
      `${surface.privacy_boundary} Remote baseline request planning stays metadata-only and never fetches payload bodies in this contract.`,
  };
}

function getRequiredRemoteMetadata(surfaceId: string) {
  const common = [
    "remote_row_id",
    "remote_version_id",
    "remote_checksum",
    "remote_updated_at",
    "remote_author_id",
    "remote_cursor",
  ];

  switch (surfaceId) {
    case "page-body":
      return [...common, "remote_page_id", "base_page_version_id"];
    case "database-row":
      return [...common, "remote_database_id", "remote_field_ids"];
    case "file-object":
      return [...common, "remote_file_id", "remote_file_size", "remote_mime_type"];
    case "comments":
      return [...common, "remote_comment_id", "remote_thread_id"];
    case "permissions":
      return [...common, "remote_role_change_id", "remote_actor_id"];
    case "restore":
      return [...common, "remote_backup_id", "remote_restore_scope_id"];
    default:
      return common;
  }
}

function getForbiddenRemotePayload(surfaceId: string) {
  switch (surfaceId) {
    case "page-body":
      return ["page_body_text", "block_text", "embedded_file_bytes"];
    case "database-row":
      return ["database_cell_values", "thesis_text", "rating_values", "position_size"];
    case "file-object":
      return ["file_bytes", "signed_download_url", "external_file_body"];
    case "comments":
      return ["comment_body", "inline_discussion_text"];
    case "permissions":
      return ["invite_email_body", "private_share_message"];
    case "restore":
      return ["backup_file_bytes", "restored_page_body_text", "restored_row_values"];
    default:
      return ["payload_body"];
  }
}

function buildRemoteBaselineGates(
  input: RemoteBaselineRequestInput
): RemoteBaselineGate[] {
  const linked = input.workspaceIdentity?.cloud_status === "linked-alpha";
  const hasBootstrapProof = Boolean(
    linked &&
      input.workspaceIdentity?.cloud_bootstrap_checked_at &&
      typeof input.workspaceIdentity.cloud_bootstrap_module_count === "number"
  );

  return [
    {
      id: "cloud-workspace-link",
      title: "Cloud workspace link",
      status: linked && hasBootstrapProof ? "manual-confirmation" : "blocked",
      evidence: linked
        ? `Cloud workspace ${input.workspaceIdentity?.cloud_workspace_id ?? "unknown"} is linked; bootstrap proof ${input.workspaceIdentity?.cloud_bootstrap_checked_at ?? "missing"}.`
        : "No linked cloud workspace is available.",
      required_action:
        "Keep local workspace as source of truth and verify bootstrap membership before any remote baseline fetch.",
    },
    {
      id: "auth-session-boundary",
      title: "Authenticated session boundary",
      status: input.accountSessionBoundary.can_read_session
        ? "manual-confirmation"
        : "blocked",
      evidence: input.accountSessionBoundary.can_read_session
        ? "Session read is enabled."
        : "Account/session boundary keeps session read disabled.",
      required_action:
        "Enable session read only after auth provider, consent copy, redirects, CSRF, and rate limits are approved.",
    },
    {
      id: "sync-pull-endpoint-disabled",
      title: "Sync pull endpoint disabled",
      status: "blocked",
      evidence: "/api/sync/pull returns a disabled Web Beta stub.",
      required_action:
        "Keep the endpoint disabled until remote metadata staging, permissions, audit, replay, and rollback are proven.",
    },
    {
      id: "remote-cursor-contract",
      title: "Remote cursor contract",
      status: "blocked",
      evidence: "No durable remote cursor, baseline cursor, or acknowledgement cursor exists yet.",
      required_action:
        "Define workspace-scoped cursor tables before fetching or acknowledging remote baseline rows.",
    },
    {
      id: "side-by-side-staging-target",
      title: "Side-by-side staging target",
      status:
        input.conflictResolution.review_ui.surface_reviews.length > 0
          ? "planned"
          : "blocked",
      evidence: `${input.conflictResolution.review_ui.surface_reviews.length} local side-by-side review surfaces are available for staged metadata.`,
      required_action:
        "Route remote metadata into the existing Base / Local / Remote review lanes before any apply action is enabled.",
    },
    {
      id: "permission-check-before-fetch",
      title: "Permission check before fetch",
      status: input.permissionDecisionReport
        ? "manual-confirmation"
        : "blocked",
      evidence: input.permissionDecisionReport
        ? `${input.permissionDecisionReport.summary.needs_confirmation} permission decisions still require confirmation.`
        : "No permission decision report is attached.",
      required_action:
        "Call /api/permissions/check before remote baseline fetch reads workspace-scoped remote metadata.",
    },
    {
      id: "audit-event-before-fetch",
      title: "Audit event before fetch",
      status: input.auditTrailPolicy ? "manual-confirmation" : "blocked",
      evidence: input.auditTrailPolicy
        ? `Audit policy covers ${input.auditTrailPolicy.summary.events} event types, but audit write routes remain gated.`
        : "No audit trail policy is attached.",
      required_action:
        "Write redacted audit metadata before and after remote baseline fetch.",
    },
    {
      id: "owner-confirmation-before-apply",
      title: "Owner confirmation before apply",
      status: "blocked",
      evidence:
        "Remote baseline fetch can only stage metadata; no apply confirmation flow is enabled.",
      required_action:
        "Require owner confirmation after side-by-side review and before any remote row writes local workspace data.",
    },
  ];
}

function buildRemoteBaselineFieldRules(): RemoteBaselineFieldRule[] {
  return [
    field("remote_row_id", "allowed", "Identify the remote metadata row."),
    field("remote_version_id", "allowed", "Compare version ancestry without payload bodies."),
    field("remote_checksum", "allowed", "Detect drift without reading private content."),
    field("remote_updated_at", "allowed", "Order remote baseline changes."),
    field("remote_author_id", "allowed", "Show actor metadata after permission checks."),
    field("remote_cursor", "allowed", "Support cursor-based pull replay."),
    field("page_body_text", "forbidden", "Page content remains out of baseline metadata."),
    field("database_cell_values", "forbidden", "Structured research values stay private until explicit review."),
    field("comment_body", "forbidden", "Discussion text is not part of baseline staging."),
    field("file_bytes", "forbidden", "File content is not fetched by baseline planning."),
    field("signed_download_url", "forbidden", "Baseline staging must not grant file access."),
    field("invite_email_body", "forbidden", "Permission changes require dedicated owner review."),
  ];
}

function field(
  fieldName: string,
  status: RemoteBaselineFieldRule["status"],
  reason: string
): RemoteBaselineFieldRule {
  return {
    field: fieldName,
    status,
    reason,
  };
}
