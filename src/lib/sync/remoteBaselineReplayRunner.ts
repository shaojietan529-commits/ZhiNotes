import type { AuditTrailPolicy } from "@/lib/security/auditTrailPolicy";
import type { PermissionDecisionReport } from "@/lib/security/permissionDecision";
import type { RemoteBaselineReplayFixturePackage } from "@/lib/sync/remoteBaselineReplayFixture";
import type { RemoteBaselineReplayHarnessPreflight } from "@/lib/sync/remoteBaselineReplayHarness";
import type { RemoteBaselineStageReplayContract } from "@/lib/sync/remoteBaselineStageReplay";
import type { LocalWorkspaceIdentity } from "@/lib/sync/workspaceIdentity";

export type RemoteBaselineReplayRunnerStatus =
  | "ready"
  | "manual-confirmation"
  | "blocked";

export interface RemoteBaselineReplayRunnerInput {
  workspaceIdentity: LocalWorkspaceIdentity | null;
  harnessPreflight: RemoteBaselineReplayHarnessPreflight;
  fixturePackage: RemoteBaselineReplayFixturePackage;
  stageReplay: RemoteBaselineStageReplayContract;
  permissionDecisionReport: PermissionDecisionReport | null;
  auditTrailPolicy: AuditTrailPolicy | null;
}

export interface RemoteBaselineReplayRunnerEntryPoint {
  id: string;
  title: string;
  status: RemoteBaselineReplayRunnerStatus;
  entry_kind:
    | "local-export"
    | "verification-command"
    | "disabled-api-route"
    | "disabled-apply-route";
  target: string;
  allowed_now: boolean;
  evidence: string;
}

export interface RemoteBaselineReplayRunnerPhase {
  id: string;
  title: string;
  status: RemoteBaselineReplayRunnerStatus;
  runner_stage:
    | "preflight"
    | "fixture"
    | "confirmation"
    | "database"
    | "migration"
    | "proof"
    | "audit";
  input_source: string;
  expected_evidence: string;
  blocked_until: string;
}

export interface RemoteBaselineReplayRunnerRefusal {
  id: string;
  title: string;
  status: RemoteBaselineReplayRunnerStatus;
  refused_action: string;
  evidence: string;
  required_before_enablement: string;
}

export interface RemoteBaselineReplayRunnerSkeleton {
  format: "zhinote-remote-baseline-replay-runner-skeleton";
  format_version: 1;
  runner_status: "disabled-runner-skeleton-only";
  can_export_runner_skeleton_now: true;
  can_run_runner_now: false;
  can_connect_database_now: false;
  can_create_disposable_database_now: false;
  can_apply_sql_now: false;
  can_start_network_request_now: false;
  can_write_server_data_now: false;
  can_stage_remote_rows_now: false;
  can_acknowledge_remote_rows_now: false;
  can_upload_workspace_data_now: false;
  disabled_replay_endpoint: "/api/sync/replay-test";
  disabled_apply_path: "/api/cloud/migrations/apply";
  privacy_note: string;
  boundary: {
    local_skeleton_only: true;
    runner_disabled_by_default: true;
    export_only: true;
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
    includes_tokens: false;
    includes_cookies: false;
    stages_remote_rows: false;
    acknowledges_remote_rows: false;
    applies_remote_changes: false;
    uses_production_workspace: false;
    reads_environment_values: false;
    uses_runtime_secrets: false;
    requires_owner_confirmation_receipt: true;
    requires_empty_fixture_package: true;
    requires_payload_denylist: true;
    requires_permission_check_stub: true;
    requires_redacted_audit_event: true;
    requires_rls_assertion_plan: true;
    requires_rollback_assertion_plan: true;
    requires_owner_approval_to_enable: true;
  };
  local_evidence: {
    workspace_id: string | null;
    cloud_workspace_id: string | null;
    cloud_status: LocalWorkspaceIdentity["cloud_status"] | "missing";
    harness_preflight_status: RemoteBaselineReplayHarnessPreflight["preflight_status"];
    fixture_confirmation_status:
      | RemoteBaselineReplayFixturePackage["local_evidence"]["confirmation_status"]
      | "missing";
    fixture_confirmation_phrase_matches: boolean;
    fixture_stage_seed_rows: 0;
    fixture_cursor_seed_rows: 0;
    harness_steps: number;
    harness_assertions: number;
    harness_gates: number;
    replay_scenarios: number;
    replay_gates: number;
    permission_confirmations_required: number;
    audit_policy_events: number;
  };
  summary: {
    entrypoints: number;
    phases: number;
    refusal_reasons: number;
    ready: number;
    manual_confirmation: number;
    blocked: number;
  };
  entrypoints: RemoteBaselineReplayRunnerEntryPoint[];
  phases: RemoteBaselineReplayRunnerPhase[];
  refusal_reasons: RemoteBaselineReplayRunnerRefusal[];
  final_enablement_requirements: string[];
}

export function buildRemoteBaselineReplayRunnerSkeleton(
  input: RemoteBaselineReplayRunnerInput
): RemoteBaselineReplayRunnerSkeleton {
  const entrypoints = buildRunnerEntrypoints();
  const phases = buildRunnerPhases(input);
  const refusalReasons = buildRunnerRefusals(input);
  const statuses = [
    ...entrypoints.map((entrypoint) => entrypoint.status),
    ...phases.map((phase) => phase.status),
    ...refusalReasons.map((reason) => reason.status),
  ];

  return {
    format: "zhinote-remote-baseline-replay-runner-skeleton",
    format_version: 1,
    runner_status: "disabled-runner-skeleton-only",
    can_export_runner_skeleton_now: true,
    can_run_runner_now: false,
    can_connect_database_now: false,
    can_create_disposable_database_now: false,
    can_apply_sql_now: false,
    can_start_network_request_now: false,
    can_write_server_data_now: false,
    can_stage_remote_rows_now: false,
    can_acknowledge_remote_rows_now: false,
    can_upload_workspace_data_now: false,
    disabled_replay_endpoint: "/api/sync/replay-test",
    disabled_apply_path: "/api/cloud/migrations/apply",
    privacy_note:
      "Generated locally. This disabled runner skeleton documents the future disposable replay runner without running it. It does not create or connect a database, apply SQL, start network requests, write server data, stage remote rows, acknowledge cursors, read page text, read database row values, read comment bodies, read file bytes, include tokens or cookies, use production workspace data, or upload workspace data.",
    boundary: {
      local_skeleton_only: true,
      runner_disabled_by_default: true,
      export_only: true,
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
      includes_tokens: false,
      includes_cookies: false,
      stages_remote_rows: false,
      acknowledges_remote_rows: false,
      applies_remote_changes: false,
      uses_production_workspace: false,
      reads_environment_values: false,
      uses_runtime_secrets: false,
      requires_owner_confirmation_receipt: true,
      requires_empty_fixture_package: true,
      requires_payload_denylist: true,
      requires_permission_check_stub: true,
      requires_redacted_audit_event: true,
      requires_rls_assertion_plan: true,
      requires_rollback_assertion_plan: true,
      requires_owner_approval_to_enable: true,
    },
    local_evidence: {
      workspace_id: input.workspaceIdentity?.workspace_id ?? null,
      cloud_workspace_id: input.workspaceIdentity?.cloud_workspace_id ?? null,
      cloud_status: input.workspaceIdentity?.cloud_status ?? "missing",
      harness_preflight_status: input.harnessPreflight.preflight_status,
      fixture_confirmation_status:
        input.fixturePackage.local_evidence.confirmation_status ?? "missing",
      fixture_confirmation_phrase_matches:
        input.fixturePackage.local_evidence.confirmation_phrase_matches,
      fixture_stage_seed_rows: input.fixturePackage.summary.stage_seed_rows,
      fixture_cursor_seed_rows:
        input.fixturePackage.summary.cursor_proof_seed_rows,
      harness_steps: input.harnessPreflight.summary.steps,
      harness_assertions: input.harnessPreflight.summary.assertions,
      harness_gates: input.harnessPreflight.summary.gates,
      replay_scenarios: input.stageReplay.summary.scenarios,
      replay_gates: input.stageReplay.summary.gates,
      permission_confirmations_required:
        input.permissionDecisionReport?.summary.needs_confirmation ?? 0,
      audit_policy_events: input.auditTrailPolicy?.summary.events ?? 0,
    },
    summary: {
      entrypoints: entrypoints.length,
      phases: phases.length,
      refusal_reasons: refusalReasons.length,
      ready: statuses.filter((status) => status === "ready").length,
      manual_confirmation: statuses.filter(
        (status) => status === "manual-confirmation"
      ).length,
      blocked: statuses.filter((status) => status === "blocked").length,
    },
    entrypoints,
    phases,
    refusal_reasons: refusalReasons,
    final_enablement_requirements: [
      "Owner confirmation phrase must match before the runner can ever execute.",
      "Runner execution must target a disposable database created outside the user's production workspace.",
      "Replay endpoint /api/sync/replay-test and migration apply path /api/cloud/migrations/apply must remain disabled until permission, audit, RLS, cursor idempotency, and rollback proofs pass.",
      "Runner input must stay empty-fixture only: zero page bodies, zero database row values, zero comments, zero files, zero tokens, and zero cookies.",
      "First enabled runner must emit redacted audit metadata only and must never upload user workspace payloads.",
    ],
  };
}

function buildRunnerEntrypoints(): RemoteBaselineReplayRunnerEntryPoint[] {
  return [
    entrypoint(
      "export-runner-skeleton",
      "Export runner skeleton",
      "ready",
      "local-export",
      "Sync module JSON export",
      true,
      "Local export is allowed because it only serializes the disabled runner skeleton."
    ),
    entrypoint(
      "verify-replay-harness",
      "Verify replay harness safety",
      "ready",
      "verification-command",
      "npm run verify:replay-harness",
      true,
      "Safety verification is allowed because it reads source contracts and checks disabled boundaries."
    ),
    entrypoint(
      "disabled-replay-route",
      "Replay route remains disabled",
      "blocked",
      "disabled-api-route",
      "/api/sync/replay-test",
      false,
      "The replay route stays a disabled Web Beta stub and must not execute runner work."
    ),
    entrypoint(
      "disabled-migration-apply-route",
      "Migration apply route remains disabled",
      "blocked",
      "disabled-apply-route",
      "/api/cloud/migrations/apply",
      false,
      "The migration apply path stays disabled until rollback proof and owner approval pass."
    ),
  ];
}

function buildRunnerPhases(
  input: RemoteBaselineReplayRunnerInput
): RemoteBaselineReplayRunnerPhase[] {
  return [
    phase(
      "load-harness-preflight",
      "Load harness preflight",
      input.harnessPreflight.summary.steps > 0 ? "ready" : "blocked",
      "preflight",
      "remoteBaselineReplayHarnessPreflight",
      `${input.harnessPreflight.summary.steps} dry-run steps and ${input.harnessPreflight.summary.assertions} assertions are available.`,
      "Harness preflight export exists and stays local-only."
    ),
    phase(
      "verify-fixture-zero-payload",
      "Verify fixture has zero payload",
      input.fixturePackage.summary.stage_seed_rows === 0 &&
        input.fixturePackage.summary.cursor_proof_seed_rows === 0
        ? "ready"
        : "blocked",
      "fixture",
      "remoteBaselineReplayFixturePackage",
      `Stage rows: ${input.fixturePackage.summary.stage_seed_rows}; cursor rows: ${input.fixturePackage.summary.cursor_proof_seed_rows}.`,
      "Fixture package must keep zero stage rows and zero cursor proof rows."
    ),
    phase(
      "verify-owner-confirmation",
      "Verify owner confirmation",
      input.fixturePackage.local_evidence.confirmation_phrase_matches
        ? "ready"
        : "manual-confirmation",
      "confirmation",
      "remoteBaselineReplayConfirmationReceipt",
      `Confirmation status is ${input.fixturePackage.local_evidence.confirmation_status}; phrase match is ${input.fixturePackage.local_evidence.confirmation_phrase_matches}.`,
      "Owner types ENABLE DISPOSABLE REPLAY and exports a matching local receipt."
    ),
    phase(
      "prepare-redacted-audit",
      "Prepare redacted audit event",
      input.auditTrailPolicy ? "manual-confirmation" : "blocked",
      "audit",
      "auditTrailPolicy",
      input.auditTrailPolicy
        ? `${input.auditTrailPolicy.summary.events} planned audit events are available, but server audit writes are disabled.`
        : "No audit trail policy is attached to the runner skeleton.",
      "Audit writes stay disabled until a redacted event path is implemented."
    ),
    phase(
      "open-disposable-database-connection",
      "Open disposable database connection",
      "blocked",
      "database",
      "future disposable database",
      "No disposable database connection is configured or opened.",
      "Owner approves a disposable-only database target and confirms it is not production."
    ),
    phase(
      "apply-up-sql",
      "Apply up SQL",
      "blocked",
      "migration",
      "/api/cloud/migrations/apply",
      "Migration apply endpoint remains disabled.",
      "Disposable database exists, SQL is reviewed, and rollback proof is ready."
    ),
    phase(
      "run-rls-isolation",
      "Run RLS isolation",
      "blocked",
      "proof",
      "remoteBaselineStageReplay.rls_proofs",
      `${input.stageReplay.summary.rls_proofs} RLS proof scenarios are planned.`,
      "Disposable users and empty workspaces prove workspace isolation."
    ),
    phase(
      "run-cursor-idempotency",
      "Run cursor idempotency",
      "blocked",
      "proof",
      "remoteBaselineStageReplay.scenarios",
      "Cursor monotonicity and idempotent batch replay scenarios are planned.",
      "Runner proves duplicate batches do not advance acknowledgement cursor."
    ),
    phase(
      "run-down-migration-rollback",
      "Run down migration rollback",
      "blocked",
      "proof",
      "remoteBaselineStageReplay.rollback_proofs",
      `${input.stageReplay.summary.rollback_proofs} rollback proof scenarios are planned.`,
      "Down migration restores disposable empty state after a failed replay."
    ),
    phase(
      "emit-redacted-audit-event",
      "Emit redacted audit event",
      "blocked",
      "audit",
      "audit_events",
      "Server audit writes remain disabled.",
      "Runner emits metadata-only audit evidence after permission and rollback gates pass."
    ),
  ];
}

function buildRunnerRefusals(
  input: RemoteBaselineReplayRunnerInput
): RemoteBaselineReplayRunnerRefusal[] {
  return [
    refusal(
      "missing-owner-confirmation",
      "Missing owner confirmation",
      input.fixturePackage.local_evidence.confirmation_phrase_matches
        ? "ready"
        : "manual-confirmation",
      "run disposable replay",
      input.fixturePackage.local_evidence.confirmation_phrase_matches
        ? "Owner confirmation receipt phrase matches locally."
        : "Owner confirmation receipt phrase does not match yet.",
      "Require matching ENABLE DISPOSABLE REPLAY receipt before execution."
    ),
    refusal(
      "no-disposable-database",
      "No disposable database",
      "blocked",
      "connect database",
      "No disposable Supabase/Postgres database target is configured.",
      "Create a disposable database only after owner approval."
    ),
    refusal(
      "replay-endpoint-disabled",
      "Replay endpoint disabled",
      "blocked",
      "start replay route",
      "/api/sync/replay-test remains disabled.",
      "Keep endpoint disabled until empty-fixture replay, RLS, cursor, audit, and rollback proofs pass."
    ),
    refusal(
      "apply-endpoint-disabled",
      "Apply endpoint disabled",
      "blocked",
      "apply migration SQL",
      "/api/cloud/migrations/apply remains disabled.",
      "Enable apply only after reversible migration and rollback proof."
    ),
    refusal(
      "permission-check-disabled",
      "Permission check disabled",
      input.permissionDecisionReport ? "manual-confirmation" : "blocked",
      "authorize runner mutation",
      input.permissionDecisionReport
        ? `${input.permissionDecisionReport.summary.needs_confirmation} local permission decisions require confirmation; server checks remain disabled.`
        : "No permission decision report is attached.",
      "Implement authenticated server permission checks before replay can mutate anything."
    ),
    refusal(
      "audit-write-disabled",
      "Audit write disabled",
      input.auditTrailPolicy ? "manual-confirmation" : "blocked",
      "write audit event",
      input.auditTrailPolicy
        ? `${input.auditTrailPolicy.summary.events} audit event types are planned; server writes remain disabled.`
        : "No audit policy is attached.",
      "Implement metadata-only redacted audit writes before enabling replay execution."
    ),
    refusal(
      "private-payload-denylist",
      "Private payload denylist",
      hasRequiredDenylistFields(input.fixturePackage.payload_column_denylist)
        ? "ready"
        : "blocked",
      "accept fixture payload",
      `${input.fixturePackage.payload_column_denylist.length} payload fields are denied.`,
      "Fail setup if page body text, database values, comment bodies, file bytes, signed URLs, payload bodies, tokens, or cookies appear."
    ),
  ];
}

function entrypoint(
  id: string,
  title: string,
  status: RemoteBaselineReplayRunnerStatus,
  entryKind: RemoteBaselineReplayRunnerEntryPoint["entry_kind"],
  target: string,
  allowedNow: boolean,
  evidence: string
): RemoteBaselineReplayRunnerEntryPoint {
  return {
    id,
    title,
    status,
    entry_kind: entryKind,
    target,
    allowed_now: allowedNow,
    evidence,
  };
}

function phase(
  id: string,
  title: string,
  status: RemoteBaselineReplayRunnerStatus,
  runnerStage: RemoteBaselineReplayRunnerPhase["runner_stage"],
  inputSource: string,
  expectedEvidence: string,
  blockedUntil: string
): RemoteBaselineReplayRunnerPhase {
  return {
    id,
    title,
    status,
    runner_stage: runnerStage,
    input_source: inputSource,
    expected_evidence: expectedEvidence,
    blocked_until: blockedUntil,
  };
}

function refusal(
  id: string,
  title: string,
  status: RemoteBaselineReplayRunnerStatus,
  refusedAction: string,
  evidence: string,
  requiredBeforeEnablement: string
): RemoteBaselineReplayRunnerRefusal {
  return {
    id,
    title,
    status,
    refused_action: refusedAction,
    evidence,
    required_before_enablement: requiredBeforeEnablement,
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
