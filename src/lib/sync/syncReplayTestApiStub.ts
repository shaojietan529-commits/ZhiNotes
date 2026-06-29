import {
  buildWebBetaApiStubResponse,
  type WebBetaApiStubResponse,
} from "@/lib/sync/webBetaApiStubs";

export type SyncReplayTestApiFieldStatus = "allowed" | "forbidden";
export type SyncReplayTestApiValidationStatus = "accepted" | "rejected";

export interface SyncReplayTestApiField {
  field: string;
  status: SyncReplayTestApiFieldStatus;
  reason: string;
}

export interface SyncReplayTestApiValidatorFixture {
  id: string;
  expected_status: SyncReplayTestApiValidationStatus;
  actual_status: SyncReplayTestApiValidationStatus;
  contains_forbidden_payload: boolean;
  forbidden_field_names: string[];
  reason: string;
}

export interface SyncReplayTestApiValidatorReport {
  format: "zhinote-sync-replay-test-api-validator-fixtures";
  format_version: 1;
  report_status: "local-fixture-report-only";
  validator_status: "not-executing-route";
  summary: {
    fixtures: number;
    accepted: number;
    rejected: number;
    forbidden_payload_rejections: number;
    forbidden_fields_covered: number;
  };
  fixtures: SyncReplayTestApiValidatorFixture[];
}

export interface SyncReplayTestApiDisabledResponse {
  format: "zhinote-sync-replay-test-api-disabled";
  format_version: 1;
  api_id: "sync-replay-test";
  path: "/api/sync/replay-test";
  method: "POST";
  stub_status: "disabled-local-stub";
  can_run_replay_now: false;
  can_read_request_body_now: false;
  can_create_disposable_workspace_now: false;
  can_connect_cloud_now: false;
  can_write_server_data_now: false;
  can_upload_workspace_data_now: false;
  can_acknowledge_rows_now: false;
  can_mark_local_rows_synced_now: false;
  can_touch_production_workspace_now: false;
  privacy_note: string;
  base_stub: WebBetaApiStubResponse;
  boundary: {
    no_request_argument: true;
    endpoint_disabled: true;
    reads_request_body: false;
    accepts_disposable_replay_payload: false;
    creates_disposable_workspace: false;
    connects_cloud_services: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    acknowledges_sync_rows: false;
    mutates_local_sync_status: false;
    marks_local_rows_synced: false;
    uses_production_workspace: false;
    returns_remote_rows: false;
    returns_workspace_content: false;
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_comment_bodies: false;
    reads_file_bytes: false;
    reads_backup_payload: false;
    reads_secret_values: false;
    reads_environment_values: false;
    requires_owner_confirmation_before_replay: true;
    requires_disposable_workspace_before_enablement: true;
    requires_rls_assertion_before_enablement: true;
    requires_permission_check_before_enablement: true;
    requires_audit_event_before_enablement: true;
    requires_rollback_proof_before_enablement: true;
    requires_ack_ledger_enablement_before_replay: true;
    requires_zero_private_payload_before_enablement: true;
  };
  request_schema: {
    schema_status: "planned-disposable-metadata-only";
    allowed_fields: SyncReplayTestApiField[];
    forbidden_fields: SyncReplayTestApiField[];
  };
  response_schema: {
    schema_status: "planned-disabled-replay-receipt-only";
    allowed_fields: SyncReplayTestApiField[];
    forbidden_fields: SyncReplayTestApiField[];
  };
  local_validator_report: SyncReplayTestApiValidatorReport;
  disabled_response_contract: {
    http_status: 501;
    returns_replay_receipt: false;
    returns_remote_ack: false;
    returns_remote_rows: false;
    returns_workspace_content: false;
    creates_disposable_workspace: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    mutates_local_sync_log: false;
    returns_required_owner_confirmation: true;
    returns_required_disposable_workspace: true;
  };
  enablement_gates: Array<{
    id: string;
    title: string;
    required_before_enablement: string;
  }>;
}

const SYNC_REPLAY_TEST_ALLOWED_REQUEST_FIELDS: SyncReplayTestApiField[] = [
  allowed("workspace_id", "Authenticated cloud workspace boundary."),
  allowed("actor_user_id", "Authenticated actor id, never a free-form name."),
  allowed("device_id", "Registered device id for local provenance."),
  allowed("disposable_workspace_id", "Isolated replay workspace, not production."),
  allowed("disposable_replay_id", "Opaque id for one replay attempt."),
  allowed("owner_confirmation_receipt_id", "Proof that the owner approved this disposable replay scope."),
  allowed("ack_replay_enablement_id", "Reviewed ack/retry replay enablement package id."),
  allowed("fixture_package_id", "Empty fixture package reference, not fixture contents."),
  allowed("idempotency_key", "Prevents duplicate replay jobs after retries."),
  allowed("expected_operation_counts", "Count-only fixture operation summary."),
  allowed("ledger_table_names", "Expected sync ledger tables for the fixture."),
  allowed("permission_decision_id", "Server permission decision reference."),
  allowed("audit_event_envelope_id", "Metadata-only audit envelope reference."),
  allowed("rollback_snapshot_id", "Disposable rollback snapshot reference."),
  allowed("created_at", "Client timestamp for expiry checks only."),
];

const SYNC_REPLAY_TEST_FORBIDDEN_REQUEST_FIELDS: SyncReplayTestApiField[] = [
  forbidden("production_workspace_id", "Production workspace ids must not be accepted by a replay test route."),
  forbidden("sync_log_payload", "Full sync_log payloads must not be posted to the disabled replay route."),
  forbidden("page_body_text", "Page text is private content, not replay metadata."),
  forbidden("block_text", "Block text can contain research notes and is forbidden."),
  forbidden("database_cell_values", "Database values must not be posted before replay is enabled."),
  forbidden("comment_body", "Comments may contain private discussion and must not be logged or echoed."),
  forbidden("file_bytes", "Files stay in private storage flows, not replay metadata."),
  forbidden("backup_payload", "Backups must not be uploaded through replay test."),
  forbidden("raw_request_body", "Raw replay request retention is forbidden."),
  forbidden("token", "Tokens must never be included in replay requests."),
  forbidden("cookie", "Cookies must never be included in replay requests."),
  forbidden("password", "Passwords must never be included in replay requests."),
  forbidden("secret_values", "Secret values and connection strings must never be included."),
  forbidden("local_file_path", "Local paths can disclose private folder names."),
  forbidden("enable_sync_push", "A replay request cannot enable sync push."),
  forbidden("force_acknowledge", "Clients cannot force remote acknowledgement."),
  forbidden("mark_synced", "Clients cannot mark local rows synced from a replay request."),
  forbidden("overwrite_remote", "Broad remote overwrite flags require separate reviewed conflict handling."),
  forbidden("delete_remote", "Remote deletes require explicit permission and rollback handling."),
  forbidden("connect_production_database", "Replay tests must never choose or connect a production database."),
];

const SYNC_REPLAY_TEST_ALLOWED_RESPONSE_FIELDS: SyncReplayTestApiField[] = [
  allowed("format", "Stable disabled response format."),
  allowed("api_id", "Identifies the disabled replay test API."),
  allowed("stub_status", "Confirms the route is not active."),
  allowed("decision_status", "Future response may say disabled, denied, requires-owner-confirmation, or accepted."),
  allowed("replay_receipt_id", "Future server-generated receipt id only after replay is enabled."),
  allowed("accepted_counts", "Future count-only accepted fixture rows summary."),
  allowed("rejected_counts", "Future count-only rejected fixture rows summary."),
  allowed("ack_cursor", "Future acknowledgement cursor after durable replay proof."),
  allowed("rollback_receipt_id", "Future disposable rollback proof reference."),
  allowed("required_gates", "Gate ids that block replay."),
  allowed("reason_codes", "Machine-readable refusal reasons."),
];

const SYNC_REPLAY_TEST_FORBIDDEN_RESPONSE_FIELDS: SyncReplayTestApiField[] = [
  forbidden("remote_rows", "Replay responses must not return full remote rows."),
  forbidden("sync_log_payload", "Replay responses must not echo sync payloads."),
  forbidden("page_body_text", "Replay responses must never return page text."),
  forbidden("database_cell_values", "Replay responses must never return database values."),
  forbidden("comment_body", "Replay responses must never return comment bodies."),
  forbidden("file_bytes", "Replay responses must never return file bytes."),
  forbidden("backup_payload", "Replay responses must never return backup payloads."),
  forbidden("raw_request_body", "Replay responses must never return raw request payloads."),
  forbidden("token", "Replay responses must never return tokens."),
  forbidden("cookie", "Replay responses must never return cookies."),
  forbidden("secret_values", "Replay responses must never return secrets."),
  forbidden("production_connection_string", "Replay responses must never expose production database details."),
];

export function buildSyncReplayTestApiDisabledResponse(): SyncReplayTestApiDisabledResponse {
  return {
    format: "zhinote-sync-replay-test-api-disabled",
    format_version: 1,
    api_id: "sync-replay-test",
    path: "/api/sync/replay-test",
    method: "POST",
    stub_status: "disabled-local-stub",
    can_run_replay_now: false,
    can_read_request_body_now: false,
    can_create_disposable_workspace_now: false,
    can_connect_cloud_now: false,
    can_write_server_data_now: false,
    can_upload_workspace_data_now: false,
    can_acknowledge_rows_now: false,
    can_mark_local_rows_synced_now: false,
    can_touch_production_workspace_now: false,
    privacy_note:
      "This route is intentionally disabled. It does not read request bodies, create disposable workspaces, connect cloud services, write server data, upload workspace data, acknowledge sync rows, mark local rows synced, touch production workspaces, or return remote rows.",
    base_stub: buildWebBetaApiStubResponse("sync-replay-test"),
    boundary: {
      no_request_argument: true,
      endpoint_disabled: true,
      reads_request_body: false,
      accepts_disposable_replay_payload: false,
      creates_disposable_workspace: false,
      connects_cloud_services: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      acknowledges_sync_rows: false,
      mutates_local_sync_status: false,
      marks_local_rows_synced: false,
      uses_production_workspace: false,
      returns_remote_rows: false,
      returns_workspace_content: false,
      reads_page_body_text: false,
      reads_database_row_values: false,
      reads_comment_bodies: false,
      reads_file_bytes: false,
      reads_backup_payload: false,
      reads_secret_values: false,
      reads_environment_values: false,
      requires_owner_confirmation_before_replay: true,
      requires_disposable_workspace_before_enablement: true,
      requires_rls_assertion_before_enablement: true,
      requires_permission_check_before_enablement: true,
      requires_audit_event_before_enablement: true,
      requires_rollback_proof_before_enablement: true,
      requires_ack_ledger_enablement_before_replay: true,
      requires_zero_private_payload_before_enablement: true,
    },
    request_schema: {
      schema_status: "planned-disposable-metadata-only",
      allowed_fields: buildSyncReplayTestRequestFields(),
      forbidden_fields: buildSyncReplayTestForbiddenFields(),
    },
    response_schema: {
      schema_status: "planned-disabled-replay-receipt-only",
      allowed_fields: buildSyncReplayTestResponseFields(),
      forbidden_fields: buildSyncReplayTestForbiddenResponseFields(),
    },
    local_validator_report: buildSyncReplayTestValidatorReport(),
    disabled_response_contract: {
      http_status: 501,
      returns_replay_receipt: false,
      returns_remote_ack: false,
      returns_remote_rows: false,
      returns_workspace_content: false,
      creates_disposable_workspace: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      mutates_local_sync_log: false,
      returns_required_owner_confirmation: true,
      returns_required_disposable_workspace: true,
    },
    enablement_gates: [
      {
        id: "owner-confirmation",
        title: "Owner confirmation",
        required_before_enablement:
          "The owner must approve a disposable replay scope, expected fixture counts, stop conditions, and rollback behavior.",
      },
      {
        id: "disposable-workspace",
        title: "Disposable workspace",
        required_before_enablement:
          "Replay can only run inside an isolated disposable workspace that cannot read or write production data.",
      },
      {
        id: "rls-assertion",
        title: "RLS assertion",
        required_before_enablement:
          "Server tests must prove replay actor isolation across workspaces before accepting any request.",
      },
      {
        id: "permission-check",
        title: "Permission check",
        required_before_enablement:
          "Replay must pass server-side permission checks and cannot trust client-supplied role claims.",
      },
      {
        id: "audit-event",
        title: "Audit event",
        required_before_enablement:
          "Replay must write redacted metadata-only audit events for request, result, and rollback.",
      },
      {
        id: "rollback-proof",
        title: "Rollback proof",
        required_before_enablement:
          "Disposable replay must prove all fixture rows can be reset or dropped after failure.",
      },
      {
        id: "ack-ledger-enable",
        title: "Ack ledger enablement",
        required_before_enablement:
          "Ack/retry replay enablement gates must pass before replay can acknowledge rows or advance cursors.",
      },
    ],
  };
}

function buildSyncReplayTestRequestFields(): SyncReplayTestApiField[] {
  return SYNC_REPLAY_TEST_ALLOWED_REQUEST_FIELDS;
}

function buildSyncReplayTestForbiddenFields(): SyncReplayTestApiField[] {
  return SYNC_REPLAY_TEST_FORBIDDEN_REQUEST_FIELDS;
}

function buildSyncReplayTestResponseFields(): SyncReplayTestApiField[] {
  return SYNC_REPLAY_TEST_ALLOWED_RESPONSE_FIELDS;
}

function buildSyncReplayTestForbiddenResponseFields(): SyncReplayTestApiField[] {
  return SYNC_REPLAY_TEST_FORBIDDEN_RESPONSE_FIELDS;
}

function buildSyncReplayTestValidatorReport(): SyncReplayTestApiValidatorReport {
  const fixtures: SyncReplayTestApiValidatorFixture[] = [
    {
      id: "metadata-only-disposable-replay",
      expected_status: "accepted",
      actual_status: "accepted",
      contains_forbidden_payload: false,
      forbidden_field_names: [],
      reason:
        "Only ids, fixture references, expected counts, permission, audit, rollback, and idempotency metadata are present.",
    },
    {
      id: "reject-production-workspace",
      expected_status: "rejected",
      actual_status: "rejected",
      contains_forbidden_payload: true,
      forbidden_field_names: ["production_workspace_id"],
      reason: "Replay tests must target disposable workspaces only.",
    },
    {
      id: "reject-private-content",
      expected_status: "rejected",
      actual_status: "rejected",
      contains_forbidden_payload: true,
      forbidden_field_names: [
        "page_body_text",
        "database_cell_values",
        "comment_body",
        "file_bytes",
      ],
      reason:
        "Replay route metadata must never carry note text, database values, comment bodies, or files.",
    },
    {
      id: "reject-client-acknowledgement",
      expected_status: "rejected",
      actual_status: "rejected",
      contains_forbidden_payload: true,
      forbidden_field_names: ["force_acknowledge", "mark_synced"],
      reason:
        "The client cannot force remote ack or mark local rows synced from a replay request.",
    },
    {
      id: "reject-secrets",
      expected_status: "rejected",
      actual_status: "rejected",
      contains_forbidden_payload: true,
      forbidden_field_names: ["token", "cookie", "secret_values"],
      reason: "Credentials and connection secrets must never enter replay requests.",
    },
  ];

  return {
    format: "zhinote-sync-replay-test-api-validator-fixtures",
    format_version: 1,
    report_status: "local-fixture-report-only",
    validator_status: "not-executing-route",
    summary: {
      fixtures: fixtures.length,
      accepted: fixtures.filter((fixture) => fixture.actual_status === "accepted")
        .length,
      rejected: fixtures.filter((fixture) => fixture.actual_status === "rejected")
        .length,
      forbidden_payload_rejections: fixtures.filter(
        (fixture) => fixture.contains_forbidden_payload
      ).length,
      forbidden_fields_covered: Array.from(
        new Set(fixtures.flatMap((fixture) => fixture.forbidden_field_names))
      ).length,
    },
    fixtures,
  };
}

function allowed(field: string, reason: string): SyncReplayTestApiField {
  return {
    field,
    status: "allowed",
    reason,
  };
}

function forbidden(field: string, reason: string): SyncReplayTestApiField {
  return {
    field,
    status: "forbidden",
    reason,
  };
}
