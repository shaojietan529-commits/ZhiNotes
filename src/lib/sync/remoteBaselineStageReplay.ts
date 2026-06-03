import type { AuditTrailPolicy } from "@/lib/security/auditTrailPolicy";
import type { PermissionDecisionReport } from "@/lib/security/permissionDecision";
import type { RemoteBaselineStageSchemaContract } from "@/lib/sync/remoteBaselineStageSchema";
import type { LocalWorkspaceIdentity } from "@/lib/sync/workspaceIdentity";

export type RemoteBaselineStageReplayStatus =
  | "planned"
  | "manual-confirmation"
  | "blocked";

export interface RemoteBaselineStageReplayInput {
  workspaceIdentity: LocalWorkspaceIdentity | null;
  stageSchema: RemoteBaselineStageSchemaContract;
  permissionDecisionReport: PermissionDecisionReport | null;
  auditTrailPolicy: AuditTrailPolicy | null;
}

export interface RemoteBaselineReplayScenario {
  id: string;
  title: string;
  status: RemoteBaselineStageReplayStatus;
  fixture_scope: "empty-disposable-workspace" | "metadata-only-fixture";
  expected_result: string;
  forbidden_result: string;
  evidence: string;
}

export interface RemoteBaselineRlsProof {
  id: string;
  title: string;
  status: RemoteBaselineStageReplayStatus;
  policy_target: string;
  allow_rule: string;
  deny_rule: string;
  proof_method: string;
}

export interface RemoteBaselineRollbackProof {
  id: string;
  title: string;
  status: RemoteBaselineStageReplayStatus;
  rollback_scope: string;
  expected_recovery: string;
  blocked_until: string;
}

export interface RemoteBaselineReplayGate {
  id: string;
  title: string;
  status: RemoteBaselineStageReplayStatus;
  evidence: string;
  required_action: string;
}

export interface RemoteBaselineStageReplayContract {
  format: "zhinote-remote-baseline-stage-replay-contract";
  format_version: 1;
  replay_status: "local-disposable-replay-contract-only";
  can_run_replay_now: false;
  can_connect_disposable_database_now: false;
  can_apply_sql_now: false;
  can_write_server_data_now: false;
  can_stage_remote_metadata_now: false;
  disabled_apply_path: "/api/cloud/migrations/apply";
  disabled_replay_endpoint: "/api/sync/replay-test";
  privacy_note: string;
  boundary: {
    local_contract_only: true;
    uses_disposable_data_only: true;
    creates_disposable_database: false;
    connects_cloud_database: false;
    applies_sql: false;
    writes_server_data: false;
    writes_workspace_data: false;
    uploads_workspace_data: false;
    reads_remote_data: false;
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_comment_bodies: false;
    reads_file_bytes: false;
    stages_remote_rows: false;
    acknowledges_remote_rows: false;
    applies_remote_changes: false;
    requires_owner_confirmation_before_replay: true;
    requires_empty_workspace_fixture: true;
    requires_payload_denylist_assertion: true;
    requires_rls_workspace_isolation_proof: true;
    requires_cursor_monotonicity_proof: true;
    requires_idempotency_replay_proof: true;
    requires_down_migration_rollback_proof: true;
    requires_audit_event_before_replay: true;
    requires_permission_check_before_replay: true;
  };
  local_evidence: {
    workspace_id: string | null;
    cloud_workspace_id: string | null;
    cloud_status: LocalWorkspaceIdentity["cloud_status"] | "missing";
    schema_sql_statements: number;
    schema_blocked_gates: number;
    schema_allowed_columns: number;
    schema_forbidden_columns: number;
    permission_confirmations_required: number;
    audit_policy_events: number;
  };
  summary: {
    scenarios: number;
    rls_proofs: number;
    rollback_proofs: number;
    gates: number;
    blocked: number;
    manual_confirmation: number;
  };
  scenarios: RemoteBaselineReplayScenario[];
  rls_proofs: RemoteBaselineRlsProof[];
  rollback_proofs: RemoteBaselineRollbackProof[];
  gates: RemoteBaselineReplayGate[];
  final_enablement_conditions: string[];
}

export function buildRemoteBaselineStageReplayContract(
  input: RemoteBaselineStageReplayInput
): RemoteBaselineStageReplayContract {
  const scenarios = buildReplayScenarios(input.stageSchema);
  const rlsProofs = buildRlsProofs();
  const rollbackProofs = buildRollbackProofs();
  const gates = buildReplayGates(input);

  return {
    format: "zhinote-remote-baseline-stage-replay-contract",
    format_version: 1,
    replay_status: "local-disposable-replay-contract-only",
    can_run_replay_now: false,
    can_connect_disposable_database_now: false,
    can_apply_sql_now: false,
    can_write_server_data_now: false,
    can_stage_remote_metadata_now: false,
    disabled_apply_path: "/api/cloud/migrations/apply",
    disabled_replay_endpoint: "/api/sync/replay-test",
    privacy_note:
      "Generated locally. This replay contract defines disposable schema replay and RLS proof for remote_baseline_stage without creating databases, connecting cloud services, applying SQL, writing server data, reading remote data, reading page bodies, reading database row values, reading comment bodies, reading file bytes, staging rows, acknowledging rows, applying remote changes, or uploading workspace data.",
    boundary: {
      local_contract_only: true,
      uses_disposable_data_only: true,
      creates_disposable_database: false,
      connects_cloud_database: false,
      applies_sql: false,
      writes_server_data: false,
      writes_workspace_data: false,
      uploads_workspace_data: false,
      reads_remote_data: false,
      reads_page_body_text: false,
      reads_database_row_values: false,
      reads_comment_bodies: false,
      reads_file_bytes: false,
      stages_remote_rows: false,
      acknowledges_remote_rows: false,
      applies_remote_changes: false,
      requires_owner_confirmation_before_replay: true,
      requires_empty_workspace_fixture: true,
      requires_payload_denylist_assertion: true,
      requires_rls_workspace_isolation_proof: true,
      requires_cursor_monotonicity_proof: true,
      requires_idempotency_replay_proof: true,
      requires_down_migration_rollback_proof: true,
      requires_audit_event_before_replay: true,
      requires_permission_check_before_replay: true,
    },
    local_evidence: {
      workspace_id: input.workspaceIdentity?.workspace_id ?? null,
      cloud_workspace_id: input.workspaceIdentity?.cloud_workspace_id ?? null,
      cloud_status: input.workspaceIdentity?.cloud_status ?? "missing",
      schema_sql_statements: input.stageSchema.summary.sql_statements,
      schema_blocked_gates: input.stageSchema.summary.blocked,
      schema_allowed_columns: input.stageSchema.summary.allowed_columns,
      schema_forbidden_columns: input.stageSchema.summary.forbidden_columns,
      permission_confirmations_required:
        input.permissionDecisionReport?.summary.needs_confirmation ?? 0,
      audit_policy_events: input.auditTrailPolicy?.summary.events ?? 0,
    },
    summary: {
      scenarios: scenarios.length,
      rls_proofs: rlsProofs.length,
      rollback_proofs: rollbackProofs.length,
      gates: gates.length,
      blocked: gates.filter((gate) => gate.status === "blocked").length,
      manual_confirmation: gates.filter(
        (gate) => gate.status === "manual-confirmation"
      ).length,
    },
    scenarios,
    rls_proofs: rlsProofs,
    rollback_proofs: rollbackProofs,
    gates,
    final_enablement_conditions: [
      "Owner approves disposable replay with empty workspace fixtures only.",
      "SQL up/down draft replays cleanly on disposable database.",
      "Payload denylist proves forbidden columns are absent from remote_baseline_stage.",
      "RLS proves workspace A cannot read or write workspace B staged metadata.",
      "Cursor proof proves monotonicity and idempotent replay without moving acknowledgement cursor.",
      "Rollback proof restores empty workspace state after failed replay.",
    ],
  };
}

function buildReplayScenarios(
  stageSchema: RemoteBaselineStageSchemaContract
): RemoteBaselineReplayScenario[] {
  return [
    scenario(
      "apply-up-sql-disposable",
      "Apply up SQL on disposable database",
      "blocked",
      "empty-disposable-workspace",
      `${stageSchema.summary.sql_statements} SQL statements apply on empty disposable schema with no private content.`,
      "No production database, real workspace, page body, file bytes, or database row value is touched.",
      "/api/cloud/migrations/apply remains disabled, so this is a replay plan only."
    ),
    scenario(
      "payload-denylist-schema-check",
      "Payload denylist schema check",
      "planned",
      "metadata-only-fixture",
      "remote_baseline_stage contains metadata columns and excludes page_body_text, database_cell_values, comment_body, file_bytes, signed_download_url, and payload_body.",
      "Replay fails if any forbidden payload column exists.",
      `${stageSchema.summary.forbidden_columns} forbidden fields are declared by the schema contract.`
    ),
    scenario(
      "cursor-monotonicity",
      "Cursor monotonicity proof",
      "blocked",
      "metadata-only-fixture",
      "next_cursor advances only after permission, audit, checksum, and workspace scope checks pass.",
      "previous_cursor never changes after rejected, expired, or failed replay.",
      "No cursor proof table is persisted yet.",
    ),
    scenario(
      "idempotent-batch-replay",
      "Idempotent batch replay",
      "blocked",
      "metadata-only-fixture",
      "Replaying the same remote_batch_id returns the same staged metadata ids and does not duplicate stage rows.",
      "Remote acknowledgement cursor does not move during staging replay.",
      "remote_baseline_cursor_batch_unique is drafted but not replayed.",
    ),
    scenario(
      "down-migration-rollback",
      "Down migration rollback",
      "blocked",
      "empty-disposable-workspace",
      "Down SQL removes stage schema and cursor proof tables from disposable database.",
      "Rollback never touches local browser workspace data.",
      "No down migration has run on disposable data yet.",
    ),
  ];
}

function buildRlsProofs(): RemoteBaselineRlsProof[] {
  return [
    {
      id: "workspace-read-isolation",
      title: "Workspace read isolation",
      status: "blocked",
      policy_target: "remote_baseline_stage",
      allow_rule:
        "workspace member can read staged metadata for their own workspace only.",
      deny_rule:
        "workspace A member cannot read workspace B staged metadata.",
      proof_method:
        "Disposable database uses two empty workspaces and two disposable users.",
    },
    {
      id: "workspace-write-isolation",
      title: "Workspace write isolation",
      status: "blocked",
      policy_target: "remote_baseline_stage",
      allow_rule:
        "workspace member with sync permission can write metadata-only stage rows for their workspace.",
      deny_rule:
        "user without workspace membership cannot insert or update staged metadata.",
      proof_method:
        "Attempt insert/update with mismatched workspace_id and expect denial.",
    },
    {
      id: "cursor-proof-isolation",
      title: "Cursor proof isolation",
      status: "blocked",
      policy_target: "remote_baseline_cursor_proof",
      allow_rule:
        "workspace member can read cursor proof for their own workspace only.",
      deny_rule:
        "workspace A cannot read or write workspace B cursor proof.",
      proof_method:
        "Replay proof with two workspace ids and verify cross-workspace denial.",
    },
  ];
}

function buildRollbackProofs(): RemoteBaselineRollbackProof[] {
  return [
    {
      id: "down-sql-cleanup",
      title: "Down SQL cleanup",
      status: "blocked",
      rollback_scope:
        "remote_baseline_stage, remote_baseline_cursor_proof, indexes, constraints, and RLS policies.",
      expected_recovery:
        "Disposable database returns to pre-replay empty workspace schema state.",
      blocked_until:
        "Down SQL and replay harness are implemented for disposable database only.",
    },
    {
      id: "failed-replay-recovery",
      title: "Failed replay recovery",
      status: "blocked",
      rollback_scope:
        "Rejected cursor proof, staged metadata rows, and audit replay metadata.",
      expected_recovery:
        "previous_cursor remains unchanged and staged metadata is marked rejected or removed.",
      blocked_until:
        "Failure injection proves cursor and stage rows recover without applying remote changes.",
    },
  ];
}

function buildReplayGates(
  input: RemoteBaselineStageReplayInput
): RemoteBaselineReplayGate[] {
  return [
    gate(
      "owner-confirmation-before-replay",
      "Owner confirmation before replay",
      "blocked",
      "No owner-approved disposable replay receipt exists.",
      "Require owner confirmation that replay uses empty disposable workspaces only."
    ),
    gate(
      "disposable-database-available",
      "Disposable database available",
      "blocked",
      "No disposable Supabase/Postgres database is configured for replay.",
      "Create disposable project only after owner confirmation and never upload private workspace data."
    ),
    gate(
      "schema-sql-reviewed",
      "Schema SQL reviewed",
      input.stageSchema.summary.sql_statements > 0 ? "planned" : "blocked",
      `${input.stageSchema.summary.sql_statements} schema SQL draft statements exist locally.`,
      "Review DDL and denylist before replay harness can run."
    ),
    gate(
      "payload-denylist-proof",
      "Payload denylist proof",
      "blocked",
      `${input.stageSchema.summary.forbidden_columns} forbidden payload fields are declared.`,
      "Fail replay if forbidden payload columns appear in stage schema or fixtures."
    ),
    gate(
      "rls-policy-proof",
      "RLS policy proof",
      "blocked",
      "No workspace isolation proof has run.",
      "Prove workspace read/write isolation with two disposable users and workspaces."
    ),
    gate(
      "cursor-proof-replay",
      "Cursor proof replay",
      "blocked",
      "No monotonic cursor or idempotency replay has run.",
      "Prove previous_cursor, next_cursor, cursor_checksum, and remote_batch_id behavior."
    ),
    gate(
      "permission-check-before-replay",
      "Permission check before replay",
      input.permissionDecisionReport ? "manual-confirmation" : "blocked",
      input.permissionDecisionReport
        ? `${input.permissionDecisionReport.summary.needs_confirmation} permission decisions still require confirmation.`
        : "No permission decision report is attached.",
      "Run /api/permissions/check before disposable replay can stage metadata."
    ),
    gate(
      "audit-event-before-replay",
      "Audit event before replay",
      input.auditTrailPolicy ? "manual-confirmation" : "blocked",
      input.auditTrailPolicy
        ? `Audit policy covers ${input.auditTrailPolicy.summary.events} event types, but audit writes remain disabled.`
        : "No audit trail policy is attached.",
      "Write redacted audit metadata before and after disposable replay."
    ),
    gate(
      "rollback-proof",
      "Rollback proof",
      "blocked",
      "No up/down replay or failed replay recovery proof exists.",
      "Prove down SQL and failure recovery before migration apply can ever be enabled."
    ),
  ];
}

function scenario(
  id: string,
  title: string,
  status: RemoteBaselineStageReplayStatus,
  fixtureScope: RemoteBaselineReplayScenario["fixture_scope"],
  expectedResult: string,
  forbiddenResult: string,
  evidence: string
): RemoteBaselineReplayScenario {
  return {
    id,
    title,
    status,
    fixture_scope: fixtureScope,
    expected_result: expectedResult,
    forbidden_result: forbiddenResult,
    evidence,
  };
}

function gate(
  id: string,
  title: string,
  status: RemoteBaselineStageReplayStatus,
  evidence: string,
  requiredAction: string
): RemoteBaselineReplayGate {
  return {
    id,
    title,
    status,
    evidence,
    required_action: requiredAction,
  };
}
