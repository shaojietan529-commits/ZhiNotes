import type { HighRiskConfirmationReceipt } from "@/lib/security/typedConfirmation";
import type { RemoteBaselineStageReplayContract } from "@/lib/sync/remoteBaselineStageReplay";
import type {
  RemoteBaselineStageColumn,
  RemoteBaselineStageSchemaContract,
} from "@/lib/sync/remoteBaselineStageSchema";
import type { LocalWorkspaceIdentity } from "@/lib/sync/workspaceIdentity";

export type RemoteBaselineReplayFixtureStatus =
  | "ready"
  | "manual-confirmation"
  | "blocked";

export interface RemoteBaselineReplayFixtureInput {
  workspaceIdentity: LocalWorkspaceIdentity | null;
  stageSchema: RemoteBaselineStageSchemaContract;
  stageReplay: RemoteBaselineStageReplayContract;
  replayConfirmationReceipt: HighRiskConfirmationReceipt | null;
}

export interface RemoteBaselineReplayFixtureWorkspace {
  fixture_workspace_id: string;
  role_scope: "owner" | "researcher";
  page_count: 0;
  database_row_count: 0;
  comment_count: 0;
  file_count: 0;
  private_content_included: false;
}

export interface RemoteBaselineReplayFixtureUser {
  fixture_user_id: string;
  fixture_workspace_id: string;
  role: "owner" | "researcher";
  email: null;
  token: null;
  cookie: null;
}

export interface RemoteBaselineReplayFixtureValidation {
  id: string;
  title: string;
  status: RemoteBaselineReplayFixtureStatus;
  evidence: string;
  failure_condition: string;
}

export interface RemoteBaselineReplayFixturePackage {
  format: "zhinote-remote-baseline-replay-fixture-package";
  format_version: 1;
  package_status: "local-empty-fixture-package-only";
  can_export_fixture_now: true;
  can_run_replay_now: false;
  can_connect_database_now: false;
  can_apply_sql_now: false;
  can_stage_remote_rows_now: false;
  can_upload_workspace_data_now: false;
  disabled_replay_endpoint: "/api/sync/replay-test";
  privacy_note: string;
  boundary: {
    local_fixture_only: true;
    empty_workspace_fixture: true;
    metadata_only_fixture: true;
    creates_database: false;
    connects_cloud_database: false;
    applies_sql: false;
    starts_network_request: false;
    writes_server_data: false;
    writes_workspace_data: false;
    uploads_workspace_data: false;
    reads_remote_data: false;
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_comment_bodies: false;
    reads_file_bytes: false;
    includes_page_body_text: false;
    includes_database_row_values: false;
    includes_comment_bodies: false;
    includes_file_bytes: false;
    includes_tokens: false;
    includes_cookies: false;
    stage_seed_rows: 0;
    cursor_proof_seed_rows: 0;
    requires_owner_confirmation_receipt: true;
    requires_phrase_match_before_real_replay: true;
  };
  local_evidence: {
    workspace_id: string | null;
    cloud_workspace_id: string | null;
    cloud_status: LocalWorkspaceIdentity["cloud_status"] | "missing";
    confirmation_status: HighRiskConfirmationReceipt["status"] | "missing";
    confirmation_action_id: HighRiskConfirmationReceipt["action_id"] | null;
    confirmation_phrase_matches: boolean;
    schema_sql_statements: number;
    replay_scenarios: number;
    replay_gates: number;
    forbidden_payload_columns: number;
  };
  summary: {
    fixture_workspaces: number;
    fixture_users: number;
    stage_seed_rows: 0;
    cursor_proof_seed_rows: 0;
    forbidden_payload_columns: number;
    validation_checks: number;
    ready: number;
    manual_confirmation: number;
    blocked: number;
  };
  workspaces: RemoteBaselineReplayFixtureWorkspace[];
  users: RemoteBaselineReplayFixtureUser[];
  stage_seed_rows: [];
  cursor_proof_seed_rows: [];
  payload_column_denylist: string[];
  validation_checks: RemoteBaselineReplayFixtureValidation[];
  final_replay_requirements: string[];
}

export function buildRemoteBaselineReplayFixturePackage(
  input: RemoteBaselineReplayFixtureInput
): RemoteBaselineReplayFixturePackage {
  const workspaces = buildFixtureWorkspaces();
  const users = buildFixtureUsers(workspaces);
  const payloadColumnDenylist = buildPayloadColumnDenylist(
    input.stageSchema.stage_table.forbidden_columns
  );
  const validationChecks = buildValidationChecks({
    input,
    workspaces,
    users,
    payloadColumnDenylist,
  });

  return {
    format: "zhinote-remote-baseline-replay-fixture-package",
    format_version: 1,
    package_status: "local-empty-fixture-package-only",
    can_export_fixture_now: true,
    can_run_replay_now: false,
    can_connect_database_now: false,
    can_apply_sql_now: false,
    can_stage_remote_rows_now: false,
    can_upload_workspace_data_now: false,
    disabled_replay_endpoint: "/api/sync/replay-test",
    privacy_note:
      "Generated locally. This fixture package contains only empty disposable workspace metadata, empty fixture users, zero stage rows, zero cursor proof rows, and a payload-column denylist. It does not read page text, database row values, comment bodies, file bytes, tokens, cookies, remote data, or workspace payloads; it does not connect a database, apply SQL, write server data, stage remote rows, run replay, or upload workspace data.",
    boundary: {
      local_fixture_only: true,
      empty_workspace_fixture: true,
      metadata_only_fixture: true,
      creates_database: false,
      connects_cloud_database: false,
      applies_sql: false,
      starts_network_request: false,
      writes_server_data: false,
      writes_workspace_data: false,
      uploads_workspace_data: false,
      reads_remote_data: false,
      reads_page_body_text: false,
      reads_database_row_values: false,
      reads_comment_bodies: false,
      reads_file_bytes: false,
      includes_page_body_text: false,
      includes_database_row_values: false,
      includes_comment_bodies: false,
      includes_file_bytes: false,
      includes_tokens: false,
      includes_cookies: false,
      stage_seed_rows: 0,
      cursor_proof_seed_rows: 0,
      requires_owner_confirmation_receipt: true,
      requires_phrase_match_before_real_replay: true,
    },
    local_evidence: {
      workspace_id: input.workspaceIdentity?.workspace_id ?? null,
      cloud_workspace_id: input.workspaceIdentity?.cloud_workspace_id ?? null,
      cloud_status: input.workspaceIdentity?.cloud_status ?? "missing",
      confirmation_status:
        input.replayConfirmationReceipt?.status ?? "missing",
      confirmation_action_id:
        input.replayConfirmationReceipt?.action_id ?? null,
      confirmation_phrase_matches: Boolean(
        input.replayConfirmationReceipt?.typed_phrase_matches
      ),
      schema_sql_statements: input.stageSchema.summary.sql_statements,
      replay_scenarios: input.stageReplay.summary.scenarios,
      replay_gates: input.stageReplay.summary.gates,
      forbidden_payload_columns: payloadColumnDenylist.length,
    },
    summary: summarizeFixturePackage(
      workspaces,
      users,
      payloadColumnDenylist,
      validationChecks
    ),
    workspaces,
    users,
    stage_seed_rows: [],
    cursor_proof_seed_rows: [],
    payload_column_denylist: payloadColumnDenylist,
    validation_checks: validationChecks,
    final_replay_requirements: [
      "Owner confirmation receipt must match APPROVE DISPOSABLE SYNC REPLAY ONLY before any real disposable replay can run.",
      "Replay uses empty disposable workspaces only; fixture package must keep page, database, comment, and file counts at zero.",
      "Stage and cursor proof seed rows remain empty until the replay runner builds metadata-only synthetic rows.",
      "Payload-column denylist must fail the replay if page body text, database row values, comment bodies, file bytes, signed URLs, tokens, cookies, or payload bodies appear.",
      "Replay endpoint /api/sync/replay-test remains disabled until permission checks, audit events, RLS proof, idempotency proof, and rollback proof pass.",
    ],
  };
}

function buildFixtureWorkspaces(): RemoteBaselineReplayFixtureWorkspace[] {
  return [
    {
      fixture_workspace_id: "fixture-workspace-a-empty",
      role_scope: "owner",
      page_count: 0,
      database_row_count: 0,
      comment_count: 0,
      file_count: 0,
      private_content_included: false,
    },
    {
      fixture_workspace_id: "fixture-workspace-b-empty",
      role_scope: "researcher",
      page_count: 0,
      database_row_count: 0,
      comment_count: 0,
      file_count: 0,
      private_content_included: false,
    },
  ];
}

function buildFixtureUsers(
  workspaces: RemoteBaselineReplayFixtureWorkspace[]
): RemoteBaselineReplayFixtureUser[] {
  return workspaces.map((workspace, index) => ({
    fixture_user_id: `fixture-user-${index + 1}`,
    fixture_workspace_id: workspace.fixture_workspace_id,
    role: workspace.role_scope,
    email: null,
    token: null,
    cookie: null,
  }));
}

function buildPayloadColumnDenylist(columns: RemoteBaselineStageColumn[]) {
  return [
    ...new Set([
      ...columns.map((column) => column.name),
      "page_body_text",
      "block_text",
      "database_cell_values",
      "comment_body",
      "file_bytes",
      "signed_download_url",
      "payload_body",
      "token",
      "cookie",
      "secret",
    ]),
  ].sort();
}

function buildValidationChecks(input: {
  input: RemoteBaselineReplayFixtureInput;
  workspaces: RemoteBaselineReplayFixtureWorkspace[];
  users: RemoteBaselineReplayFixtureUser[];
  payloadColumnDenylist: string[];
}): RemoteBaselineReplayFixtureValidation[] {
  const receipt = input.input.replayConfirmationReceipt;
  const emptyWorkspaceCount = input.workspaces.filter(
    (workspace) =>
      workspace.page_count === 0 &&
      workspace.database_row_count === 0 &&
      workspace.comment_count === 0 &&
      workspace.file_count === 0 &&
      !workspace.private_content_included
  ).length;

  return [
    validation(
      "owner-confirmation-receipt",
      "Owner confirmation receipt",
      receipt?.confirmed ? "ready" : "manual-confirmation",
      receipt
        ? `Receipt status is ${receipt.status}; typed phrase match is ${receipt.typed_phrase_matches}.`
        : "No disposable replay confirmation receipt is attached.",
      "A real disposable replay must not start without a matching local owner confirmation receipt."
    ),
    validation(
      "empty-workspace-fixtures",
      "Empty workspace fixtures",
      emptyWorkspaceCount === input.workspaces.length ? "ready" : "blocked",
      `${input.workspaces.length} fixture workspaces are defined with zero pages, rows, comments, files, and private content.`,
      "Fail if any fixture includes real workspace ids, page bodies, database values, comment bodies, or file records."
    ),
    validation(
      "empty-fixture-users",
      "Empty fixture users",
      input.users.every((user) => !user.email && !user.token && !user.cookie)
        ? "ready"
        : "blocked",
      `${input.users.length} fixture users are anonymous and contain no email, token, or cookie values.`,
      "Fail if fixture users include real emails, tokens, cookies, or credentials."
    ),
    validation(
      "zero-stage-seed-rows",
      "Zero stage seed rows",
      "ready",
      "stage_seed_rows is intentionally empty; no remote metadata rows are staged by this package.",
      "Fail if exported fixture package includes staged remote rows before the replay runner creates synthetic metadata."
    ),
    validation(
      "zero-cursor-proof-seed-rows",
      "Zero cursor proof seed rows",
      "ready",
      "cursor_proof_seed_rows is intentionally empty; no acknowledgement cursor is moved by this package.",
      "Fail if exported fixture package includes cursor proof rows or acknowledgement cursor movement."
    ),
    validation(
      "payload-column-denylist",
      "Payload column denylist",
      input.payloadColumnDenylist.length > 0 ? "ready" : "blocked",
      `${input.payloadColumnDenylist.length} forbidden payload fields are included in the denylist.`,
      "Fail if the denylist omits page body text, database values, comment bodies, file bytes, signed URLs, tokens, cookies, or payload bodies."
    ),
    validation(
      "replay-endpoint-disabled",
      "Replay endpoint disabled",
      input.input.stageReplay.disabled_replay_endpoint ===
        "/api/sync/replay-test"
        ? "ready"
        : "blocked",
      `${input.input.stageReplay.disabled_replay_endpoint} remains the disabled replay endpoint.`,
      "Fail if the fixture package enables a replay endpoint or attempts a network request."
    ),
  ];
}

function validation(
  id: string,
  title: string,
  status: RemoteBaselineReplayFixtureStatus,
  evidence: string,
  failureCondition: string
): RemoteBaselineReplayFixtureValidation {
  return {
    id,
    title,
    status,
    evidence,
    failure_condition: failureCondition,
  };
}

function summarizeFixturePackage(
  workspaces: RemoteBaselineReplayFixtureWorkspace[],
  users: RemoteBaselineReplayFixtureUser[],
  payloadColumnDenylist: string[],
  validationChecks: RemoteBaselineReplayFixtureValidation[]
): RemoteBaselineReplayFixturePackage["summary"] {
  return {
    fixture_workspaces: workspaces.length,
    fixture_users: users.length,
    stage_seed_rows: 0,
    cursor_proof_seed_rows: 0,
    forbidden_payload_columns: payloadColumnDenylist.length,
    validation_checks: validationChecks.length,
    ready: validationChecks.filter((check) => check.status === "ready").length,
    manual_confirmation: validationChecks.filter(
      (check) => check.status === "manual-confirmation"
    ).length,
    blocked: validationChecks.filter((check) => check.status === "blocked")
      .length,
  };
}
