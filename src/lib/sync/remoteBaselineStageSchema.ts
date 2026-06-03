import type { AuditTrailPolicy } from "@/lib/security/auditTrailPolicy";
import type { PermissionDecisionReport } from "@/lib/security/permissionDecision";
import type { RemoteBaselineStagingContract } from "@/lib/sync/remoteBaselineStaging";
import type { LocalWorkspaceIdentity } from "@/lib/sync/workspaceIdentity";

export type RemoteBaselineStageSchemaStatus =
  | "drafted"
  | "manual-confirmation"
  | "blocked";

export interface RemoteBaselineStageSchemaInput {
  workspaceIdentity: LocalWorkspaceIdentity | null;
  baselineStaging: RemoteBaselineStagingContract;
  permissionDecisionReport: PermissionDecisionReport | null;
  auditTrailPolicy: AuditTrailPolicy | null;
}

export interface RemoteBaselineStageColumn {
  name: string;
  sql_type: string;
  status: "allowed" | "forbidden";
  purpose: string;
}

export interface RemoteBaselineStageIndex {
  name: string;
  columns: string[];
  purpose: string;
}

export interface RemoteBaselineStageConstraint {
  name: string;
  status: RemoteBaselineStageSchemaStatus;
  expression: string;
  purpose: string;
}

export interface RemoteBaselineStageTableDraft {
  table_name: "remote_baseline_stage";
  status: RemoteBaselineStageSchemaStatus;
  create_status: "disabled";
  retention: "review-session-only";
  allowed_columns: RemoteBaselineStageColumn[];
  forbidden_columns: RemoteBaselineStageColumn[];
  indexes: RemoteBaselineStageIndex[];
  constraints: RemoteBaselineStageConstraint[];
}

export interface RemoteBaselineCursorProofDraft {
  table_name: "remote_baseline_cursor_proof";
  status: RemoteBaselineStageSchemaStatus;
  persist_status: "disabled";
  required_columns: RemoteBaselineStageColumn[];
  monotonic_rules: string[];
  idempotency_rules: string[];
}

export interface RemoteBaselineStageSchemaSql {
  id: string;
  title: string;
  status: RemoteBaselineStageSchemaStatus;
  apply_status: "disabled";
  sql: string;
  privacy_boundary: string;
}

export interface RemoteBaselineStageSchemaGate {
  id: string;
  title: string;
  status: RemoteBaselineStageSchemaStatus;
  evidence: string;
  required_action: string;
}

export interface RemoteBaselineStageSchemaContract {
  format: "zhinote-remote-baseline-stage-schema-contract";
  format_version: 1;
  schema_status: "local-schema-and-cursor-proof-contract-only";
  disabled_apply_path: "/api/cloud/migrations/apply";
  can_create_stage_schema_now: false;
  can_persist_cursor_proof_now: false;
  can_apply_sql_now: false;
  can_stage_remote_metadata_now: false;
  can_apply_staged_rows_now: false;
  privacy_note: string;
  boundary: {
    local_contract_only: true;
    creates_database_migration: false;
    applies_sql: false;
    connects_cloud_database: false;
    writes_server_data: false;
    writes_workspace_data: false;
    uploads_workspace_data: false;
    reads_remote_data: false;
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_comment_bodies: false;
    reads_file_bytes: false;
    permits_payload_columns: false;
    persists_cursor_proof: false;
    stages_remote_rows: false;
    acknowledges_remote_rows: false;
    applies_remote_changes: false;
    requires_owner_confirmation_before_apply: true;
    requires_disposable_database_replay: true;
    requires_rls_workspace_scope: true;
    requires_payload_column_denylist: true;
    requires_cursor_monotonicity_proof: true;
    requires_idempotency_proof: true;
    requires_audit_event_before_stage: true;
    requires_permission_check_before_stage: true;
  };
  local_evidence: {
    workspace_id: string | null;
    cloud_workspace_id: string | null;
    cloud_status: LocalWorkspaceIdentity["cloud_status"] | "missing";
    stage_table_name: string;
    staging_surfaces: number;
    stage_store_allowed_columns: number;
    stage_store_forbidden_columns: number;
    permission_confirmations_required: number;
    audit_policy_events: number;
  };
  summary: {
    allowed_columns: number;
    forbidden_columns: number;
    indexes: number;
    constraints: number;
    cursor_columns: number;
    sql_statements: number;
    gates: number;
    blocked: number;
    manual_confirmation: number;
  };
  stage_table: RemoteBaselineStageTableDraft;
  cursor_proof: RemoteBaselineCursorProofDraft;
  sql_draft: RemoteBaselineStageSchemaSql[];
  gates: RemoteBaselineStageSchemaGate[];
  final_enablement_conditions: string[];
}

export function buildRemoteBaselineStageSchemaContract(
  input: RemoteBaselineStageSchemaInput
): RemoteBaselineStageSchemaContract {
  const stageTable = buildStageTable(input.baselineStaging);
  const cursorProof = buildCursorProof();
  const sqlDraft = buildSqlDraft();
  const gates = buildGates(input);

  return {
    format: "zhinote-remote-baseline-stage-schema-contract",
    format_version: 1,
    schema_status: "local-schema-and-cursor-proof-contract-only",
    disabled_apply_path: "/api/cloud/migrations/apply",
    can_create_stage_schema_now: false,
    can_persist_cursor_proof_now: false,
    can_apply_sql_now: false,
    can_stage_remote_metadata_now: false,
    can_apply_staged_rows_now: false,
    privacy_note:
      "Generated locally. This schema and cursor proof contract drafts remote_baseline_stage and remote_baseline_cursor_proof without creating migrations, applying SQL, connecting a cloud database, writing server data, reading remote data, reading page bodies, reading database row values, reading comment bodies, reading file bytes, staging rows, acknowledging rows, applying remote changes, or uploading workspace data.",
    boundary: {
      local_contract_only: true,
      creates_database_migration: false,
      applies_sql: false,
      connects_cloud_database: false,
      writes_server_data: false,
      writes_workspace_data: false,
      uploads_workspace_data: false,
      reads_remote_data: false,
      reads_page_body_text: false,
      reads_database_row_values: false,
      reads_comment_bodies: false,
      reads_file_bytes: false,
      permits_payload_columns: false,
      persists_cursor_proof: false,
      stages_remote_rows: false,
      acknowledges_remote_rows: false,
      applies_remote_changes: false,
      requires_owner_confirmation_before_apply: true,
      requires_disposable_database_replay: true,
      requires_rls_workspace_scope: true,
      requires_payload_column_denylist: true,
      requires_cursor_monotonicity_proof: true,
      requires_idempotency_proof: true,
      requires_audit_event_before_stage: true,
      requires_permission_check_before_stage: true,
    },
    local_evidence: {
      workspace_id: input.workspaceIdentity?.workspace_id ?? null,
      cloud_workspace_id: input.workspaceIdentity?.cloud_workspace_id ?? null,
      cloud_status: input.workspaceIdentity?.cloud_status ?? "missing",
      stage_table_name: input.baselineStaging.stage_store.table_name,
      staging_surfaces: input.baselineStaging.summary.stage_surfaces,
      stage_store_allowed_columns:
        input.baselineStaging.stage_store.allowed_columns.length,
      stage_store_forbidden_columns:
        input.baselineStaging.stage_store.forbidden_columns.length,
      permission_confirmations_required:
        input.permissionDecisionReport?.summary.needs_confirmation ?? 0,
      audit_policy_events: input.auditTrailPolicy?.summary.events ?? 0,
    },
    summary: {
      allowed_columns: stageTable.allowed_columns.length,
      forbidden_columns: stageTable.forbidden_columns.length,
      indexes: stageTable.indexes.length,
      constraints: stageTable.constraints.length,
      cursor_columns: cursorProof.required_columns.length,
      sql_statements: sqlDraft.length,
      gates: gates.length,
      blocked: gates.filter((gate) => gate.status === "blocked").length,
      manual_confirmation: gates.filter(
        (gate) => gate.status === "manual-confirmation"
      ).length,
    },
    stage_table: stageTable,
    cursor_proof: cursorProof,
    sql_draft: sqlDraft,
    gates,
    final_enablement_conditions: [
      "SQL is reviewed and replayed on a disposable database with rollback proof.",
      "RLS policy proves workspace-scoped reads and writes before any beta use.",
      "Payload-body columns remain absent from remote_baseline_stage and are blocked by verifier.",
      "Cursor proof enforces monotonic cursor movement and idempotent replay.",
      "Permission check and redacted audit event run before any metadata staging.",
      "Apply paths remain disabled until rollback snapshot and owner confirmation are proven.",
    ],
  };
}

function buildStageTable(
  baselineStaging: RemoteBaselineStagingContract
): RemoteBaselineStageTableDraft {
  const allowedFromStaging = baselineStaging.stage_store.allowed_columns.map(
    (columnName) =>
      column(
        columnName,
        getColumnSqlType(columnName),
        "allowed",
        getAllowedColumnPurpose(columnName)
      )
  );
  const requiredColumns = [
    column("stage_id", "uuid", "allowed", "Primary key for a staged baseline row."),
    column("stage_status", "text", "allowed", "Tracks missing, staged, rejected, stale, or reviewed metadata state."),
    column("remote_lane_status", "text", "allowed", "Feeds the Remote lane in side-by-side review UI."),
    column("rejected_reason", "text", "allowed", "Explains why metadata was rejected without storing payload bodies."),
    column("created_at", "timestamptz", "allowed", "Records when metadata would be staged."),
    column("expires_at", "timestamptz", "allowed", "Supports review-session-only retention."),
  ];
  const forbidden = baselineStaging.stage_store.forbidden_columns.map(
    (columnName) =>
      column(
        columnName,
        "forbidden",
        "forbidden",
        "Payload data must never exist in remote_baseline_stage."
      )
  );

  return {
    table_name: "remote_baseline_stage",
    status: "drafted",
    create_status: "disabled",
    retention: "review-session-only",
    allowed_columns: uniqueColumns([...requiredColumns, ...allowedFromStaging]),
    forbidden_columns: uniqueColumns(forbidden),
    indexes: [
      index("idx_remote_baseline_stage_workspace_cursor", [
        "workspace_id",
        "remote_cursor",
      ], "Find staged metadata by workspace cursor."),
      index("idx_remote_baseline_stage_surface_row", [
        "workspace_id",
        "surface_id",
        "remote_row_id",
      ], "Find staged metadata for a conflict surface row."),
      index("idx_remote_baseline_stage_version", [
        "workspace_id",
        "remote_version_id",
      ], "Compare staged remote version metadata."),
      index("idx_remote_baseline_stage_status", [
        "workspace_id",
        "stage_status",
      ], "Review missing, staged, stale, and rejected metadata."),
    ],
    constraints: [
      constraint(
        "remote_baseline_stage_status_check",
        "drafted",
        "stage_status in ('missing', 'staged', 'rejected', 'stale', 'reviewed')",
        "Restricts staged metadata lifecycle states."
      ),
      constraint(
        "remote_baseline_stage_no_payload_columns",
        "blocked",
        "schema must not contain page_body_text, database_cell_values, comment_body, file_bytes, signed_download_url, or payload_body columns",
        "Prevents private payload columns from entering the stage table."
      ),
      constraint(
        "remote_baseline_stage_workspace_scope_required",
        "blocked",
        "workspace_id is not null and RLS policy uses workspace membership",
        "Requires workspace scoping before staging can be enabled."
      ),
    ],
  };
}

function buildCursorProof(): RemoteBaselineCursorProofDraft {
  return {
    table_name: "remote_baseline_cursor_proof",
    status: "blocked",
    persist_status: "disabled",
    required_columns: [
      column("proof_id", "uuid", "allowed", "Primary key for cursor proof."),
      column("workspace_id", "uuid", "allowed", "Workspace-scoped cursor proof."),
      column("previous_cursor", "text", "allowed", "Last accepted remote cursor."),
      column("next_cursor", "text", "allowed", "Candidate cursor from metadata-only baseline pull."),
      column("cursor_checksum", "text", "allowed", "Detects cursor tampering or replay drift."),
      column("remote_batch_id", "text", "allowed", "Idempotency key for remote baseline batch."),
      column("proof_status", "text", "allowed", "Tracks draft, verified, rejected, or expired proof."),
      column("created_at", "timestamptz", "allowed", "Proof creation time."),
    ],
    monotonic_rules: [
      "next_cursor must be different from previous_cursor.",
      "next_cursor can only advance after workspace membership and permission check pass.",
      "cursor_checksum must match the staged metadata batch checksum.",
      "expired or rejected cursor proof cannot stage metadata.",
    ],
    idempotency_rules: [
      "remote_batch_id must be unique per workspace.",
      "replaying the same remote_batch_id returns the same staged metadata ids.",
      "acknowledgement cursor cannot move until review and apply are separately confirmed.",
      "failed staging keeps the previous cursor unchanged.",
    ],
  };
}

function buildSqlDraft(): RemoteBaselineStageSchemaSql[] {
  return [
    sqlStatement(
      "create-remote-baseline-stage",
      "Create remote_baseline_stage draft",
      "drafted",
      [
        "create table if not exists public.remote_baseline_stage (",
        "  stage_id uuid primary key default gen_random_uuid(),",
        "  workspace_id uuid not null references public.workspaces(id) on delete cascade,",
        "  surface_id text not null,",
        "  remote_row_id text not null,",
        "  remote_version_id text not null,",
        "  remote_checksum text not null,",
        "  remote_updated_at timestamptz not null,",
        "  remote_author_id text,",
        "  remote_cursor text not null,",
        "  remote_lane_status text not null default 'missing',",
        "  stage_status text not null default 'missing',",
        "  rejected_reason text,",
        "  created_at timestamptz not null default now(),",
        "  expires_at timestamptz,",
        "  constraint remote_baseline_stage_status_check check (stage_status in ('missing', 'staged', 'rejected', 'stale', 'reviewed'))",
        ");",
      ].join("\n"),
      "DDL draft contains metadata columns only and excludes payload bodies."
    ),
    sqlStatement(
      "create-remote-baseline-cursor-proof",
      "Create remote_baseline_cursor_proof draft",
      "blocked",
      [
        "create table if not exists public.remote_baseline_cursor_proof (",
        "  proof_id uuid primary key default gen_random_uuid(),",
        "  workspace_id uuid not null references public.workspaces(id) on delete cascade,",
        "  previous_cursor text,",
        "  next_cursor text not null,",
        "  cursor_checksum text not null,",
        "  remote_batch_id text not null,",
        "  proof_status text not null default 'draft',",
        "  created_at timestamptz not null default now(),",
        "  constraint remote_baseline_cursor_proof_status_check check (proof_status in ('draft', 'verified', 'rejected', 'expired')),",
        "  constraint remote_baseline_cursor_batch_unique unique (workspace_id, remote_batch_id)",
        ");",
      ].join("\n"),
      "Cursor proof remains disabled until replay and idempotency are proven."
    ),
    sqlStatement(
      "create-remote-baseline-stage-indexes",
      "Create remote baseline stage indexes draft",
      "drafted",
      [
        "create index if not exists idx_remote_baseline_stage_workspace_cursor on public.remote_baseline_stage (workspace_id, remote_cursor);",
        "create index if not exists idx_remote_baseline_stage_surface_row on public.remote_baseline_stage (workspace_id, surface_id, remote_row_id);",
        "create index if not exists idx_remote_baseline_stage_version on public.remote_baseline_stage (workspace_id, remote_version_id);",
        "create index if not exists idx_remote_baseline_stage_status on public.remote_baseline_stage (workspace_id, stage_status);",
      ].join("\n"),
      "Indexes only address metadata lookup for review lanes."
    ),
    sqlStatement(
      "deny-payload-columns",
      "Payload column denylist",
      "blocked",
      [
        "-- verifier must fail if remote_baseline_stage contains:",
        "-- page_body_text, block_text, database_cell_values, thesis_text, rating_values, position_size, comment_body, file_bytes, signed_download_url, payload_body",
      ].join("\n"),
      "Payload columns are documented as forbidden and must remain absent."
    ),
  ];
}

function buildGates(
  input: RemoteBaselineStageSchemaInput
): RemoteBaselineStageSchemaGate[] {
  return [
    gate(
      "stage-schema-draft",
      "Stage schema draft",
      "drafted",
      "remote_baseline_stage DDL draft exists locally and apply path remains disabled.",
      "Review metadata-only columns and keep payload columns absent before any migration file is created."
    ),
    gate(
      "cursor-proof-draft",
      "Cursor proof draft",
      "blocked",
      "remote_baseline_cursor_proof is drafted locally, but no replay or monotonic proof has run.",
      "Prove cursor monotonicity and idempotency on disposable data before enabling stage persistence."
    ),
    gate(
      "payload-column-denylist",
      "Payload column denylist",
      "blocked",
      "Forbidden payload columns are listed but no database verifier has replayed the schema.",
      "Fail migration review if page text, database values, comment bodies, file bytes, signed URLs, or payload bodies appear."
    ),
    gate(
      "rls-workspace-scope",
      "RLS workspace scope",
      "blocked",
      "No Row Level Security policy exists for remote_baseline_stage or cursor proof tables.",
      "Require workspace membership checks before metadata staging is enabled."
    ),
    gate(
      "permission-check-before-stage",
      "Permission check before stage",
      input.permissionDecisionReport ? "manual-confirmation" : "blocked",
      input.permissionDecisionReport
        ? `${input.permissionDecisionReport.summary.needs_confirmation} permission decisions still require confirmation.`
        : "No permission decision report is attached.",
      "Run /api/permissions/check before stage-store persistence can be enabled."
    ),
    gate(
      "audit-event-before-stage",
      "Audit event before stage",
      input.auditTrailPolicy ? "manual-confirmation" : "blocked",
      input.auditTrailPolicy
        ? `Audit policy covers ${input.auditTrailPolicy.summary.events} event types, but audit writes remain disabled.`
        : "No audit trail policy is attached.",
      "Write redacted audit metadata before and after staging schema writes."
    ),
    gate(
      "migration-apply-disabled",
      "Migration apply disabled",
      "blocked",
      "/api/cloud/migrations/apply remains a disabled Web Beta stub.",
      "Keep migration apply disabled until owner approval and disposable rollback proof exist."
    ),
    gate(
      "rollback-before-apply",
      "Rollback before apply",
      "blocked",
      "No rollback replay has proven down migration behavior for staging schema.",
      "Prove down migration and workspace recovery before schema apply can be enabled."
    ),
  ];
}

function column(
  name: string,
  sqlType: string,
  status: RemoteBaselineStageColumn["status"],
  purpose: string
): RemoteBaselineStageColumn {
  return {
    name,
    sql_type: sqlType,
    status,
    purpose,
  };
}

function index(
  name: string,
  columns: string[],
  purpose: string
): RemoteBaselineStageIndex {
  return {
    name,
    columns,
    purpose,
  };
}

function constraint(
  name: string,
  status: RemoteBaselineStageSchemaStatus,
  expression: string,
  purpose: string
): RemoteBaselineStageConstraint {
  return {
    name,
    status,
    expression,
    purpose,
  };
}

function sqlStatement(
  id: string,
  title: string,
  status: RemoteBaselineStageSchemaStatus,
  sql: string,
  privacyBoundary: string
): RemoteBaselineStageSchemaSql {
  return {
    id,
    title,
    status,
    apply_status: "disabled",
    sql,
    privacy_boundary: privacyBoundary,
  };
}

function gate(
  id: string,
  title: string,
  status: RemoteBaselineStageSchemaStatus,
  evidence: string,
  requiredAction: string
): RemoteBaselineStageSchemaGate {
  return {
    id,
    title,
    status,
    evidence,
    required_action: requiredAction,
  };
}

function getColumnSqlType(columnName: string) {
  if (columnName === "workspace_id") return "uuid";
  if (columnName === "remote_updated_at") return "timestamptz";
  return "text";
}

function getAllowedColumnPurpose(columnName: string) {
  switch (columnName) {
    case "workspace_id":
      return "Workspace scope for RLS and cursor proof.";
    case "surface_id":
      return "Conflict surface identifier.";
    case "remote_row_id":
      return "Remote metadata row identifier.";
    case "remote_version_id":
      return "Remote version identifier for side-by-side review.";
    case "remote_checksum":
      return "Metadata checksum for drift detection without payload bodies.";
    case "remote_updated_at":
      return "Remote metadata update timestamp.";
    case "remote_author_id":
      return "Remote actor metadata after permission checks.";
    case "remote_cursor":
      return "Cursor used for monotonic pull proof.";
    default:
      return "Metadata-only field inherited from baseline staging contract.";
  }
}

function uniqueColumns(columns: RemoteBaselineStageColumn[]) {
  const seen = new Set<string>();
  return columns.filter((columnValue) => {
    if (seen.has(columnValue.name)) return false;
    seen.add(columnValue.name);
    return true;
  });
}
