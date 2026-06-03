import type { AuditTrailPolicy } from "@/lib/security/auditTrailPolicy";
import type { PermissionDecisionReport } from "@/lib/security/permissionDecision";
import type { RemoteBaselineRequestContract } from "@/lib/sync/remoteBaselineRequest";
import type { SyncConflictResolutionContract } from "@/lib/sync/syncConflictResolution";
import type { SyncReplayTestPlan } from "@/lib/sync/syncReplayTestPlan";
import type { LocalWorkspaceIdentity } from "@/lib/sync/workspaceIdentity";

export type RemoteBaselineStagingStatus =
  | "planned"
  | "manual-confirmation"
  | "blocked";

export interface RemoteBaselineStagingInput {
  workspaceIdentity: LocalWorkspaceIdentity | null;
  baselineRequest: RemoteBaselineRequestContract;
  conflictResolution: SyncConflictResolutionContract;
  replayTestPlan: SyncReplayTestPlan;
  permissionDecisionReport: PermissionDecisionReport | null;
  auditTrailPolicy: AuditTrailPolicy | null;
}

export interface RemoteBaselineStageSurface {
  surface_id: string;
  surface: string;
  status: RemoteBaselineStagingStatus;
  stage_status: "disabled";
  source_contract: "remote-baseline-request";
  target_review_lane: "remote";
  target_review_surface: string;
  staging_table: "remote_baseline_stage";
  allowed_metadata_fields: string[];
  forbidden_payload_fields: string[];
  validation_steps: string[];
  privacy_boundary: string;
}

export interface RemoteBaselineStageStore {
  table_name: "remote_baseline_stage";
  status: RemoteBaselineStagingStatus;
  write_status: "disabled";
  retention: "review-session-only";
  allowed_columns: string[];
  forbidden_columns: string[];
  required_indexes: string[];
}

export interface RemoteBaselineStageGate {
  id: string;
  title: string;
  status: RemoteBaselineStagingStatus;
  evidence: string;
  required_action: string;
}

export interface RemoteBaselineStageField {
  field: string;
  status: "allowed" | "forbidden";
  target: "stage-store" | "review-lane" | "blocked";
  reason: string;
}

export interface RemoteBaselineStagingContract {
  format: "zhinote-remote-baseline-staging-contract";
  format_version: 1;
  staging_status: "local-staging-contract-only";
  can_stage_remote_metadata_now: false;
  can_persist_stage_store_now: false;
  can_apply_staged_rows_now: false;
  disabled_source_endpoint: "/api/sync/pull";
  disabled_stage_table: "remote_baseline_stage";
  privacy_note: string;
  boundary: {
    local_contract_only: true;
    uses_placeholder_metadata: true;
    starts_network_request: false;
    connects_cloud_services: false;
    reads_remote_data: false;
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_comment_bodies: false;
    reads_file_bytes: false;
    persists_stage_store: false;
    stages_remote_rows: false;
    acknowledges_remote_rows: false;
    applies_remote_changes: false;
    writes_workspace_data: false;
    uploads_workspace_data: false;
    requires_remote_baseline_request_contract: true;
    requires_cursor_proof: true;
    requires_side_by_side_review_surface: true;
    requires_permission_check_before_stage: true;
    requires_audit_event_before_stage: true;
    requires_rollback_snapshot_before_apply: true;
    requires_owner_confirmation_before_apply: true;
  };
  local_evidence: {
    workspace_id: string | null;
    cloud_workspace_id: string | null;
    cloud_status: LocalWorkspaceIdentity["cloud_status"] | "missing";
    request_surfaces: number;
    review_surfaces: number;
    replay_conflict_baselines: number;
    permission_confirmations_required: number;
    audit_policy_events: number;
  };
  summary: {
    stage_surfaces: number;
    gates: number;
    blocked: number;
    manual_confirmation: number;
    allowed_fields: number;
    forbidden_fields: number;
    stage_tables: number;
  };
  stage_store: RemoteBaselineStageStore;
  surface_stages: RemoteBaselineStageSurface[];
  gates: RemoteBaselineStageGate[];
  fields: RemoteBaselineStageField[];
  final_enablement_conditions: string[];
}

export function buildRemoteBaselineStagingContract(
  input: RemoteBaselineStagingInput
): RemoteBaselineStagingContract {
  const surfaceStages = input.baselineRequest.surface_requests.map((surface) =>
    buildStageSurface(surface)
  );
  const stageStore = buildStageStore(input);
  const gates = buildStageGates(input);
  const fields = buildStageFields(input);

  return {
    format: "zhinote-remote-baseline-staging-contract",
    format_version: 1,
    staging_status: "local-staging-contract-only",
    can_stage_remote_metadata_now: false,
    can_persist_stage_store_now: false,
    can_apply_staged_rows_now: false,
    disabled_source_endpoint: "/api/sync/pull",
    disabled_stage_table: "remote_baseline_stage",
    privacy_note:
      "Generated locally. This staging contract defines how future remote baseline metadata can be staged into the side-by-side review UI. It does not start network requests, connect cloud services, read remote data, read page bodies, read database row values, read comment bodies, read file bytes, persist a stage store, stage remote rows, acknowledge remote rows, apply remote changes, write workspace data, or upload workspace data.",
    boundary: {
      local_contract_only: true,
      uses_placeholder_metadata: true,
      starts_network_request: false,
      connects_cloud_services: false,
      reads_remote_data: false,
      reads_page_body_text: false,
      reads_database_row_values: false,
      reads_comment_bodies: false,
      reads_file_bytes: false,
      persists_stage_store: false,
      stages_remote_rows: false,
      acknowledges_remote_rows: false,
      applies_remote_changes: false,
      writes_workspace_data: false,
      uploads_workspace_data: false,
      requires_remote_baseline_request_contract: true,
      requires_cursor_proof: true,
      requires_side_by_side_review_surface: true,
      requires_permission_check_before_stage: true,
      requires_audit_event_before_stage: true,
      requires_rollback_snapshot_before_apply: true,
      requires_owner_confirmation_before_apply: true,
    },
    local_evidence: {
      workspace_id: input.workspaceIdentity?.workspace_id ?? null,
      cloud_workspace_id: input.workspaceIdentity?.cloud_workspace_id ?? null,
      cloud_status: input.workspaceIdentity?.cloud_status ?? "missing",
      request_surfaces: input.baselineRequest.summary.surface_requests,
      review_surfaces: input.conflictResolution.summary.side_by_side_surfaces,
      replay_conflict_baselines:
        input.replayTestPlan.summary.conflict_surfaces_needing_baseline,
      permission_confirmations_required:
        input.permissionDecisionReport?.summary.needs_confirmation ?? 0,
      audit_policy_events: input.auditTrailPolicy?.summary.events ?? 0,
    },
    summary: {
      stage_surfaces: surfaceStages.length,
      gates: gates.length,
      blocked: gates.filter((gate) => gate.status === "blocked").length,
      manual_confirmation: gates.filter(
        (gate) => gate.status === "manual-confirmation"
      ).length,
      allowed_fields: fields.filter((field) => field.status === "allowed")
        .length,
      forbidden_fields: fields.filter((field) => field.status === "forbidden")
        .length,
      stage_tables: 1,
    },
    stage_store: stageStore,
    surface_stages: surfaceStages,
    gates,
    fields,
    final_enablement_conditions: [
      "Remote baseline request contract is enabled for metadata-only responses after authentication.",
      "A durable cursor proof exists before any remote baseline row can be staged.",
      "remote_baseline_stage table exists with payload-body columns forbidden by schema and verifier.",
      "Permission check and redacted audit event run before metadata enters the stage store.",
      "Staged metadata maps only to the Remote lane of the side-by-side review UI.",
      "Apply remains disabled until rollback snapshot and owner confirmation are proven.",
    ],
  };
}

function buildStageSurface(
  request: RemoteBaselineRequestContract["surface_requests"][number]
): RemoteBaselineStageSurface {
  return {
    surface_id: request.surface_id,
    surface: request.surface,
    status:
      request.status === "blocked" ? "blocked" : "manual-confirmation",
    stage_status: "disabled",
    source_contract: "remote-baseline-request",
    target_review_lane: "remote",
    target_review_surface: request.surface_id,
    staging_table: "remote_baseline_stage",
    allowed_metadata_fields: request.required_remote_metadata,
    forbidden_payload_fields: request.forbidden_remote_payload,
    validation_steps: [
      "Validate workspace id, surface id, remote row id, remote version id, checksum, updated_at, and cursor before staging.",
      "Reject any page body text, database cell values, comment body, file bytes, signed download URL, or private payload column.",
      "Map staged metadata into the Remote lane only; never write page/database/file/comment data.",
      "Keep the conflict action buttons disabled until rollback and owner confirmation gates pass.",
    ],
    privacy_boundary:
      `${request.privacy_boundary} Staging remains disabled and metadata-only in this contract.`,
  };
}

function buildStageStore(
  input: RemoteBaselineStagingInput
): RemoteBaselineStageStore {
  const allowedColumns = unique([
    "workspace_id",
    "surface_id",
    "remote_row_id",
    "remote_version_id",
    "remote_checksum",
    "remote_updated_at",
    "remote_author_id",
    "remote_cursor",
    ...input.baselineRequest.fields
      .filter((field) => field.status === "allowed")
      .map((field) => field.field),
  ]);

  const forbiddenColumns = unique([
    "page_body_text",
    "block_text",
    "database_cell_values",
    "thesis_text",
    "rating_values",
    "position_size",
    "comment_body",
    "file_bytes",
    "signed_download_url",
    "invite_email_body",
    ...input.baselineRequest.fields
      .filter((field) => field.status === "forbidden")
      .map((field) => field.field),
  ]);

  return {
    table_name: "remote_baseline_stage",
    status: "blocked",
    write_status: "disabled",
    retention: "review-session-only",
    allowed_columns: allowedColumns,
    forbidden_columns: forbiddenColumns,
    required_indexes: [
      "workspace_id",
      "surface_id",
      "remote_cursor",
      "remote_row_id",
      "remote_version_id",
    ],
  };
}

function buildStageGates(
  input: RemoteBaselineStagingInput
): RemoteBaselineStageGate[] {
  return [
    {
      id: "baseline-request-contract",
      title: "Baseline request contract",
      status:
        input.baselineRequest.can_request_remote_baseline_now === false
          ? "planned"
          : "blocked",
      evidence:
        "Remote baseline request contract exists and keeps request, stage, and apply disabled.",
      required_action:
        "Enable metadata-only remote request only after auth, cursor, permissions, audit, and review staging are proven.",
    },
    {
      id: "stage-store-schema",
      title: "Stage store schema",
      status: "blocked",
      evidence:
        "remote_baseline_stage is a planned table only; no persistence schema exists yet.",
      required_action:
        "Add a schema migration that permits metadata columns and forbids payload body columns.",
    },
    {
      id: "cursor-proof-before-stage",
      title: "Cursor proof before stage",
      status: "blocked",
      evidence:
        "No remote cursor, baseline cursor, acknowledgement cursor, or replay cursor proof exists yet.",
      required_action:
        "Implement workspace-scoped cursor proof before any remote metadata row can enter staging.",
    },
    {
      id: "permission-check-before-stage",
      title: "Permission check before stage",
      status: input.permissionDecisionReport
        ? "manual-confirmation"
        : "blocked",
      evidence: input.permissionDecisionReport
        ? `${input.permissionDecisionReport.summary.needs_confirmation} permission decisions still require confirmation.`
        : "No permission decision report is attached.",
      required_action:
        "Run /api/permissions/check before staging workspace-scoped remote metadata.",
    },
    {
      id: "audit-event-before-stage",
      title: "Audit event before stage",
      status: input.auditTrailPolicy ? "manual-confirmation" : "blocked",
      evidence: input.auditTrailPolicy
        ? `Audit policy covers ${input.auditTrailPolicy.summary.events} event types, but audit writes remain disabled.`
        : "No audit trail policy is attached.",
      required_action:
        "Write redacted audit metadata before and after staging remote baseline metadata.",
    },
    {
      id: "side-by-side-remote-lane",
      title: "Side-by-side remote lane",
      status:
        input.conflictResolution.review_ui.surface_reviews.length > 0
          ? "planned"
          : "blocked",
      evidence: `${input.conflictResolution.review_ui.surface_reviews.length} side-by-side review surfaces can receive remote-lane metadata placeholders.`,
      required_action:
        "Map staged metadata to the Remote lane without enabling action selection or apply.",
    },
    {
      id: "rollback-before-apply",
      title: "Rollback before apply",
      status: "blocked",
      evidence:
        "No conflict-specific rollback snapshot exists for staged baseline apply.",
      required_action:
        "Create rollback snapshot before any staged metadata can lead to local workspace writes.",
    },
    {
      id: "owner-confirmation-before-apply",
      title: "Owner confirmation before apply",
      status: "blocked",
      evidence:
        "Staged metadata is review-only and no owner apply confirmation flow is enabled.",
      required_action:
        "Require owner confirmation after side-by-side review and before any apply path writes local data.",
    },
  ];
}

function buildStageFields(
  input: RemoteBaselineStagingInput
): RemoteBaselineStageField[] {
  const allowed = input.baselineRequest.fields
    .filter((field) => field.status === "allowed")
    .map((field) => ({
      field: field.field,
      status: "allowed" as const,
      target: "stage-store" as const,
      reason: `${field.reason} This can be stored as metadata only after staging is enabled.`,
    }));

  const forbidden = input.baselineRequest.fields
    .filter((field) => field.status === "forbidden")
    .map((field) => ({
      field: field.field,
      status: "forbidden" as const,
      target: "blocked" as const,
      reason: `${field.reason} This must never enter remote_baseline_stage.`,
    }));

  return [
    ...allowed,
    {
      field: "remote_lane_status",
      status: "allowed",
      target: "review-lane",
      reason:
        "Review UI may show whether remote metadata is missing, staged, stale, or rejected.",
    },
    ...forbidden,
  ];
}

function unique(values: string[]) {
  return [...new Set(values)];
}
