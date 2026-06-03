import type { AuditTrailPolicy } from "@/lib/security/auditTrailPolicy";
import type { PermissionDecisionReport } from "@/lib/security/permissionDecision";
import type { RemoteBaselineReplayFixturePackage } from "@/lib/sync/remoteBaselineReplayFixture";
import type { RemoteBaselineStageReplayContract } from "@/lib/sync/remoteBaselineStageReplay";
import type { RemoteBaselineStageSchemaContract } from "@/lib/sync/remoteBaselineStageSchema";
import type { LocalWorkspaceIdentity } from "@/lib/sync/workspaceIdentity";

export type RemoteBaselineReplayHarnessStatus =
  | "ready"
  | "manual-confirmation"
  | "blocked";

export interface RemoteBaselineReplayHarnessInput {
  workspaceIdentity: LocalWorkspaceIdentity | null;
  stageSchema: RemoteBaselineStageSchemaContract;
  stageReplay: RemoteBaselineStageReplayContract;
  fixturePackage: RemoteBaselineReplayFixturePackage;
  permissionDecisionReport: PermissionDecisionReport | null;
  auditTrailPolicy: AuditTrailPolicy | null;
}

export interface RemoteBaselineReplayHarnessStep {
  id: string;
  title: string;
  status: RemoteBaselineReplayHarnessStatus;
  runner_status: "planned-only" | "disabled";
  input_source: string;
  expected_evidence: string;
  blocked_until: string;
}

export interface RemoteBaselineReplayHarnessAssertion {
  id: string;
  title: string;
  status: RemoteBaselineReplayHarnessStatus;
  assertion: string;
  evidence: string;
}

export interface RemoteBaselineReplayHarnessGate {
  id: string;
  title: string;
  status: RemoteBaselineReplayHarnessStatus;
  evidence: string;
  required_action: string;
}

export interface RemoteBaselineReplayHarnessPreflight {
  format: "zhinote-remote-baseline-replay-harness-preflight";
  format_version: 1;
  preflight_status: "local-harness-preflight-only";
  can_run_harness_now: false;
  can_connect_database_now: false;
  can_apply_sql_now: false;
  can_write_server_data_now: false;
  can_stage_remote_rows_now: false;
  can_upload_workspace_data_now: false;
  disabled_replay_endpoint: "/api/sync/replay-test";
  disabled_apply_path: "/api/cloud/migrations/apply";
  privacy_note: string;
  boundary: {
    local_preflight_only: true;
    dry_run_only: true;
    uses_empty_fixture_package: true;
    starts_network_request: false;
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
    requires_owner_confirmation_receipt: true;
    requires_empty_fixture_package: true;
    requires_payload_denylist: true;
    requires_permission_check_stub: true;
    requires_redacted_audit_event: true;
    requires_rls_assertion_plan: true;
    requires_rollback_assertion_plan: true;
  };
  local_evidence: {
    workspace_id: string | null;
    cloud_workspace_id: string | null;
    cloud_status: LocalWorkspaceIdentity["cloud_status"] | "missing";
    fixture_workspaces: number;
    fixture_users: number;
    fixture_stage_seed_rows: 0;
    fixture_cursor_seed_rows: 0;
    fixture_confirmation_status:
      | RemoteBaselineReplayFixturePackage["local_evidence"]["confirmation_status"]
      | "missing";
    fixture_confirmation_phrase_matches: boolean;
    schema_sql_statements: number;
    replay_scenarios: number;
    replay_gates: number;
    permission_confirmations_required: number;
    audit_policy_events: number;
  };
  summary: {
    steps: number;
    assertions: number;
    gates: number;
    ready: number;
    manual_confirmation: number;
    blocked: number;
  };
  steps: RemoteBaselineReplayHarnessStep[];
  assertions: RemoteBaselineReplayHarnessAssertion[];
  gates: RemoteBaselineReplayHarnessGate[];
  final_harness_requirements: string[];
}

export function buildRemoteBaselineReplayHarnessPreflight(
  input: RemoteBaselineReplayHarnessInput
): RemoteBaselineReplayHarnessPreflight {
  const steps = buildHarnessSteps(input);
  const assertions = buildHarnessAssertions(input);
  const gates = buildHarnessGates(input);
  const statuses = [
    ...steps.map((step) => step.status),
    ...assertions.map((assertion) => assertion.status),
    ...gates.map((gate) => gate.status),
  ];

  return {
    format: "zhinote-remote-baseline-replay-harness-preflight",
    format_version: 1,
    preflight_status: "local-harness-preflight-only",
    can_run_harness_now: false,
    can_connect_database_now: false,
    can_apply_sql_now: false,
    can_write_server_data_now: false,
    can_stage_remote_rows_now: false,
    can_upload_workspace_data_now: false,
    disabled_replay_endpoint: "/api/sync/replay-test",
    disabled_apply_path: "/api/cloud/migrations/apply",
    privacy_note:
      "Generated locally. This harness preflight turns the replay contract, schema contract, and empty-fixture package into a dry-run checklist only. It does not create databases, connect cloud services, apply SQL, run replay, write server data, stage remote rows, acknowledge cursors, read page text, read database row values, read comment bodies, read file bytes, or upload workspace data.",
    boundary: {
      local_preflight_only: true,
      dry_run_only: true,
      uses_empty_fixture_package: true,
      starts_network_request: false,
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
      requires_owner_confirmation_receipt: true,
      requires_empty_fixture_package: true,
      requires_payload_denylist: true,
      requires_permission_check_stub: true,
      requires_redacted_audit_event: true,
      requires_rls_assertion_plan: true,
      requires_rollback_assertion_plan: true,
    },
    local_evidence: {
      workspace_id: input.workspaceIdentity?.workspace_id ?? null,
      cloud_workspace_id: input.workspaceIdentity?.cloud_workspace_id ?? null,
      cloud_status: input.workspaceIdentity?.cloud_status ?? "missing",
      fixture_workspaces: input.fixturePackage.summary.fixture_workspaces,
      fixture_users: input.fixturePackage.summary.fixture_users,
      fixture_stage_seed_rows: input.fixturePackage.summary.stage_seed_rows,
      fixture_cursor_seed_rows:
        input.fixturePackage.summary.cursor_proof_seed_rows,
      fixture_confirmation_status:
        input.fixturePackage.local_evidence.confirmation_status ?? "missing",
      fixture_confirmation_phrase_matches:
        input.fixturePackage.local_evidence.confirmation_phrase_matches,
      schema_sql_statements: input.stageSchema.summary.sql_statements,
      replay_scenarios: input.stageReplay.summary.scenarios,
      replay_gates: input.stageReplay.summary.gates,
      permission_confirmations_required:
        input.permissionDecisionReport?.summary.needs_confirmation ?? 0,
      audit_policy_events: input.auditTrailPolicy?.summary.events ?? 0,
    },
    summary: {
      steps: steps.length,
      assertions: assertions.length,
      gates: gates.length,
      ready: statuses.filter((status) => status === "ready").length,
      manual_confirmation: statuses.filter(
        (status) => status === "manual-confirmation"
      ).length,
      blocked: statuses.filter((status) => status === "blocked").length,
    },
    steps,
    assertions,
    gates,
    final_harness_requirements: [
      "Owner confirmation phrase must match before any future harness execution.",
      "Harness execution must use a disposable database created outside the user's production workspace.",
      "SQL apply must remain disabled until up/down replay, RLS isolation, payload denylist, cursor idempotency, redacted audit event, and rollback proof all pass.",
      "Fixture package must keep zero real pages, zero database row values, zero comments, zero files, zero tokens, and zero cookies.",
      "The first real harness run must emit redacted audit metadata only and must never upload user workspace payloads.",
    ],
  };
}

function buildHarnessSteps(
  input: RemoteBaselineReplayHarnessInput
): RemoteBaselineReplayHarnessStep[] {
  return [
    step(
      "load-empty-fixture-package",
      "Load empty fixture package",
      input.fixturePackage.summary.fixture_workspaces > 0 ? "ready" : "blocked",
      "planned-only",
      "remoteBaselineReplayFixturePackage",
      `${input.fixturePackage.summary.fixture_workspaces} empty fixture workspaces and ${input.fixturePackage.summary.fixture_users} anonymous fixture users are available.`,
      "Fixture package exports empty workspace metadata with no private content."
    ),
    step(
      "verify-owner-receipt",
      "Verify owner confirmation receipt",
      input.fixturePackage.local_evidence.confirmation_phrase_matches
        ? "ready"
        : "manual-confirmation",
      "planned-only",
      "remoteBaselineReplayConfirmationReceipt",
      `Receipt status is ${input.fixturePackage.local_evidence.confirmation_status}; phrase match is ${input.fixturePackage.local_evidence.confirmation_phrase_matches}.`,
      "Owner types ENABLE DISPOSABLE REPLAY and exports a matching local receipt."
    ),
    step(
      "review-stage-schema-sql",
      "Review stage schema SQL",
      input.stageSchema.summary.sql_statements > 0 ? "ready" : "blocked",
      "planned-only",
      "remoteBaselineStageSchema.sql_draft",
      `${input.stageSchema.summary.sql_statements} SQL draft statements are available locally.`,
      "SQL statements remain metadata-only and payload columns stay denied."
    ),
    step(
      "plan-up-down-replay",
      "Plan up/down replay",
      "blocked",
      "disabled",
      "/api/cloud/migrations/apply",
      "Migration apply endpoint remains disabled.",
      "A disposable database exists and owner approves a controlled replay run."
    ),
    step(
      "plan-rls-isolation",
      "Plan RLS isolation proof",
      "blocked",
      "disabled",
      "remoteBaselineStageReplay.rls_proofs",
      `${input.stageReplay.summary.rls_proofs} RLS proof scenarios are defined.`,
      "Two empty workspaces and two disposable users prove cross-workspace denial."
    ),
    step(
      "plan-cursor-idempotency",
      "Plan cursor idempotency proof",
      "blocked",
      "disabled",
      "remoteBaselineStageReplay.scenarios",
      "Cursor monotonicity and idempotent-batch-replay scenarios are defined.",
      "A replay runner proves duplicate batches do not move acknowledgement cursor."
    ),
    step(
      "plan-rollback-proof",
      "Plan rollback proof",
      "blocked",
      "disabled",
      "remoteBaselineStageReplay.rollback_proofs",
      `${input.stageReplay.summary.rollback_proofs} rollback proof scenarios are defined.`,
      "Down SQL and failed replay recovery are proven on disposable data."
    ),
  ];
}

function buildHarnessAssertions(
  input: RemoteBaselineReplayHarnessInput
): RemoteBaselineReplayHarnessAssertion[] {
  const denylist = input.fixturePackage.payload_column_denylist;

  return [
    assertion(
      "fixture-has-zero-payload",
      "Fixture has zero payload",
      input.fixturePackage.summary.stage_seed_rows === 0 &&
        input.fixturePackage.summary.cursor_proof_seed_rows === 0
        ? "ready"
        : "blocked",
      "stage_seed_rows and cursor_proof_seed_rows must both equal zero.",
      `Stage rows: ${input.fixturePackage.summary.stage_seed_rows}; cursor rows: ${input.fixturePackage.summary.cursor_proof_seed_rows}.`
    ),
    assertion(
      "denylist-covers-private-content",
      "Denylist covers private content",
      hasRequiredDenylistFields(denylist) ? "ready" : "blocked",
      "Denylist must include page_body_text, database_cell_values, comment_body, file_bytes, signed_download_url, payload_body, token, and cookie.",
      `${denylist.length} denylist fields are exported.`
    ),
    assertion(
      "replay-endpoint-disabled",
      "Replay endpoint disabled",
      input.stageReplay.disabled_replay_endpoint === "/api/sync/replay-test"
        ? "ready"
        : "blocked",
      "/api/sync/replay-test must stay disabled until all harness proofs pass.",
      `${input.stageReplay.disabled_replay_endpoint} is the current replay endpoint.`
    ),
    assertion(
      "apply-endpoint-disabled",
      "Apply endpoint disabled",
      input.stageReplay.disabled_apply_path === "/api/cloud/migrations/apply"
        ? "ready"
        : "blocked",
      "/api/cloud/migrations/apply must stay disabled until rollback proof passes.",
      `${input.stageReplay.disabled_apply_path} is the current apply path.`
    ),
    assertion(
      "permission-check-not-live",
      "Permission check not live",
      input.permissionDecisionReport ? "manual-confirmation" : "blocked",
      "Permission report can be reviewed locally, but server permission checks remain disabled.",
      input.permissionDecisionReport
        ? `${input.permissionDecisionReport.summary.needs_confirmation} permission decisions require confirmation.`
        : "No permission decision report is attached."
    ),
    assertion(
      "audit-event-not-live",
      "Audit event not live",
      input.auditTrailPolicy ? "manual-confirmation" : "blocked",
      "Audit policy can be reviewed locally, but server audit writes remain disabled.",
      input.auditTrailPolicy
        ? `${input.auditTrailPolicy.summary.events} audit event types are planned.`
        : "No audit trail policy is attached."
    ),
  ];
}

function buildHarnessGates(
  input: RemoteBaselineReplayHarnessInput
): RemoteBaselineReplayHarnessGate[] {
  return [
    gate(
      "owner-receipt-gate",
      "Owner receipt gate",
      input.fixturePackage.local_evidence.confirmation_phrase_matches
        ? "ready"
        : "manual-confirmation",
      input.fixturePackage.local_evidence.confirmation_phrase_matches
        ? "Confirmation phrase matches local receipt."
        : "Confirmation receipt exists but phrase is not matched yet.",
      "Require matching owner receipt before any future replay harness can run."
    ),
    gate(
      "disposable-database-gate",
      "Disposable database gate",
      "blocked",
      "No disposable Supabase/Postgres database connection is configured.",
      "Create a disposable database only after owner approval and never connect production workspace data."
    ),
    gate(
      "network-disabled-gate",
      "Network disabled gate",
      "blocked",
      "Harness preflight starts no network request and keeps replay endpoint disabled.",
      "Enable network only for a disposable database after permission, audit, RLS, and rollback gates pass."
    ),
    gate(
      "payload-denylist-gate",
      "Payload denylist gate",
      hasRequiredDenylistFields(input.fixturePackage.payload_column_denylist)
        ? "ready"
        : "blocked",
      `${input.fixturePackage.payload_column_denylist.length} payload fields are denied.`,
      "Fail harness setup if private payload fields appear in fixtures or stage schema."
    ),
    gate(
      "rollback-before-apply-gate",
      "Rollback before apply gate",
      "blocked",
      "No down migration or failed replay recovery proof has run.",
      "Prove rollback on disposable data before migration apply can ever be enabled."
    ),
  ];
}

function step(
  id: string,
  title: string,
  status: RemoteBaselineReplayHarnessStatus,
  runnerStatus: RemoteBaselineReplayHarnessStep["runner_status"],
  inputSource: string,
  expectedEvidence: string,
  blockedUntil: string
): RemoteBaselineReplayHarnessStep {
  return {
    id,
    title,
    status,
    runner_status: runnerStatus,
    input_source: inputSource,
    expected_evidence: expectedEvidence,
    blocked_until: blockedUntil,
  };
}

function assertion(
  id: string,
  title: string,
  status: RemoteBaselineReplayHarnessStatus,
  assertionText: string,
  evidence: string
): RemoteBaselineReplayHarnessAssertion {
  return {
    id,
    title,
    status,
    assertion: assertionText,
    evidence,
  };
}

function gate(
  id: string,
  title: string,
  status: RemoteBaselineReplayHarnessStatus,
  evidence: string,
  requiredAction: string
): RemoteBaselineReplayHarnessGate {
  return {
    id,
    title,
    status,
    evidence,
    required_action: requiredAction,
  };
}

function hasRequiredDenylistFields(fields: string[]) {
  return [
    "page_body_text",
    "database_cell_values",
    "comment_body",
    "file_bytes",
    "signed_download_url",
    "payload_body",
    "token",
    "cookie",
  ].every((field) => fields.includes(field));
}
