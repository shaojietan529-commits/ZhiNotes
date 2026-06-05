import {
  buildWebBetaApiStubResponse,
  type WebBetaApiStubResponse,
} from "@/lib/sync/webBetaApiStubs";

export type SyncPushApiFieldStatus = "allowed" | "forbidden";
export type SyncPushApiValidationStatus = "accepted" | "rejected";

export interface SyncPushApiField {
  field: string;
  status: SyncPushApiFieldStatus;
  reason: string;
}

export interface SyncPushApiValidatorFixture {
  id: string;
  expected_status: SyncPushApiValidationStatus;
  actual_status: SyncPushApiValidationStatus;
  contains_forbidden_payload: boolean;
  forbidden_field_names: string[];
  reason: string;
}

export interface SyncPushApiValidatorReport {
  format: "zhinote-sync-push-api-validator-fixtures";
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
  fixtures: SyncPushApiValidatorFixture[];
}

export interface SyncPushApiDisabledResponse {
  format: "zhinote-sync-push-api-disabled";
  format_version: 1;
  api_id: "sync-push";
  path: "/api/sync/push";
  method: "POST";
  stub_status: "disabled-local-stub";
  can_push_now: false;
  can_read_request_body_now: false;
  can_accept_sync_batch_now: false;
  can_upload_workspace_data_now: false;
  can_write_server_data_now: false;
  can_acknowledge_rows_now: false;
  can_mark_local_rows_synced_now: false;
  privacy_note: string;
  base_stub: WebBetaApiStubResponse;
  boundary: {
    no_request_argument: true;
    endpoint_disabled: true;
    reads_request_body: false;
    accepts_sync_batch: false;
    accepts_workspace_payload: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    acknowledges_sync_rows: false;
    mutates_local_sync_status: false;
    returns_remote_rows: false;
    connects_cloud_services: false;
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_comment_bodies: false;
    reads_file_bytes: false;
    reads_backup_payload: false;
    reads_secret_values: false;
    requires_payload_preview_before_enablement: true;
    requires_permission_check_before_enablement: true;
    requires_audit_event_before_enablement: true;
    requires_idempotency_before_enablement: true;
    requires_durable_remote_ack_before_enablement: true;
    requires_retry_dead_letter_before_enablement: true;
    requires_rollback_proof_before_enablement: true;
    requires_conflict_baseline_before_enablement: true;
    requires_first_push_confirmation_before_enablement: true;
  };
  request_schema: {
    schema_status: "planned-metadata-only";
    allowed_fields: SyncPushApiField[];
    forbidden_fields: SyncPushApiField[];
  };
  response_schema: {
    schema_status: "planned-ack-receipt-only";
    allowed_fields: SyncPushApiField[];
    forbidden_fields: SyncPushApiField[];
  };
  local_validator_report: SyncPushApiValidatorReport;
  disabled_response_contract: {
    http_status: 501;
    returns_push_receipt: false;
    returns_remote_ack: false;
    returns_remote_rows: false;
    returns_workspace_content: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    mutates_local_sync_log: false;
    returns_required_confirmation: true;
  };
  enablement_gates: Array<{
    id: string;
    title: string;
    required_before_enablement: string;
  }>;
}

const SYNC_PUSH_ALLOWED_REQUEST_FIELDS: SyncPushApiField[] = [
  allowed("workspace_id", "Cloud workspace boundary after authenticated membership."),
  allowed("actor_user_id", "Authenticated actor id, never a free-form name."),
  allowed("device_id", "Registered device id for local sync provenance."),
  allowed("local_batch_id", "Opaque local batch id created after payload preview."),
  allowed("idempotency_key", "Prevents duplicate remote writes after retries."),
  allowed("sync_cursor", "Last known cursor metadata before push."),
  allowed("sync_log_row_ids", "Reviewed local sync_log row ids, not row payloads."),
  allowed("table_names", "Included table names for risk labeling."),
  allowed("operation_counts", "Count-only create/update/delete summary."),
  allowed("changed_field_names", "Changed field names without field values."),
  allowed("payload_preview_id", "Local payload preview receipt id."),
  allowed("permission_decision_id", "Server permission decision reference for push."),
  allowed("audit_event_envelope_id", "Metadata-only audit envelope reference."),
  allowed("replay_proof_id", "Disposable replay proof id before private beta push."),
  allowed("created_at", "Client timestamp for expiry checks only."),
];

const SYNC_PUSH_FORBIDDEN_REQUEST_FIELDS: SyncPushApiField[] = [
  forbidden("sync_log_payload", "Full sync_log payloads must not be posted to the disabled push route."),
  forbidden("page_body_text", "Page text must not be part of a push permission request."),
  forbidden("block_text", "Block text is private content, not push metadata."),
  forbidden("page_snapshot_json", "Version snapshots can contain full research text."),
  forbidden("database_cell_values", "Database row values must not be posted before sync push is enabled."),
  forbidden("comment_body", "Comments may contain private discussion and must not be logged or echoed."),
  forbidden("file_bytes", "Files stay in private storage flows, not sync push metadata."),
  forbidden("backup_payload", "Backups must not be uploaded through sync push."),
  forbidden("raw_request_body", "Raw push request retention is forbidden."),
  forbidden("token", "Tokens must never be included in sync push requests."),
  forbidden("cookie", "Cookies must never be included in sync push requests."),
  forbidden("password", "Passwords must never be included in sync push requests."),
  forbidden("secret_values", "Secret values and connection strings must never be included."),
  forbidden("local_file_path", "Local paths can disclose private folder names."),
  forbidden("enable_sync_push", "Feature flags must not be accepted from request payloads."),
  forbidden("force_acknowledge", "Client requests must not force server acknowledgement."),
  forbidden("mark_synced", "Client requests must not mark local rows synced without remote ack."),
  forbidden("overwrite_remote", "Broad remote overwrite flags require a dedicated reviewed runner."),
  forbidden("delete_remote", "Remote deletes require explicit conflict and permission handling."),
];

const SYNC_PUSH_ALLOWED_RESPONSE_FIELDS: SyncPushApiField[] = [
  allowed("format", "Stable disabled response format."),
  allowed("api_id", "Identifies the disabled sync push API."),
  allowed("stub_status", "Confirms the route is not active."),
  allowed("decision_status", "Future response may say disabled, denied, requires-confirmation, or accepted."),
  allowed("push_receipt_id", "Future server-generated receipt id only after push is enabled."),
  allowed("accepted_counts", "Future count-only accepted rows summary."),
  allowed("rejected_counts", "Future count-only rejected rows summary."),
  allowed("ack_cursor", "Future acknowledgement cursor after durable remote write."),
  allowed("required_gates", "Gate ids that block sync push."),
  allowed("reason_codes", "Machine-readable refusal reasons."),
];

const SYNC_PUSH_FORBIDDEN_RESPONSE_FIELDS: SyncPushApiField[] = [
  forbidden("remote_rows", "Push responses must not return full remote rows."),
  forbidden("sync_log_payload", "Push responses must not echo sync payloads."),
  forbidden("page_body_text", "Push responses must never return page text."),
  forbidden("database_cell_values", "Push responses must never return database values."),
  forbidden("comment_body", "Push responses must never return comment bodies."),
  forbidden("file_bytes", "Push responses must never return file bytes."),
  forbidden("backup_payload", "Push responses must never return backup payloads."),
  forbidden("raw_request_body", "Push responses must never return raw request payloads."),
  forbidden("token", "Push responses must never return tokens."),
  forbidden("cookie", "Push responses must never return cookies."),
  forbidden("secret_values", "Push responses must never return secrets."),
];

export function buildSyncPushApiDisabledResponse(): SyncPushApiDisabledResponse {
  return {
    format: "zhinote-sync-push-api-disabled",
    format_version: 1,
    api_id: "sync-push",
    path: "/api/sync/push",
    method: "POST",
    stub_status: "disabled-local-stub",
    can_push_now: false,
    can_read_request_body_now: false,
    can_accept_sync_batch_now: false,
    can_upload_workspace_data_now: false,
    can_write_server_data_now: false,
    can_acknowledge_rows_now: false,
    can_mark_local_rows_synced_now: false,
    privacy_note:
      "This route is intentionally disabled. It does not accept sync batches, read request bodies, upload workspace data, write server data, acknowledge sync rows, mark local rows synced, connect cloud services, or return remote rows.",
    base_stub: buildWebBetaApiStubResponse("sync-push"),
    boundary: {
      no_request_argument: true,
      endpoint_disabled: true,
      reads_request_body: false,
      accepts_sync_batch: false,
      accepts_workspace_payload: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      acknowledges_sync_rows: false,
      mutates_local_sync_status: false,
      returns_remote_rows: false,
      connects_cloud_services: false,
      reads_page_body_text: false,
      reads_database_row_values: false,
      reads_comment_bodies: false,
      reads_file_bytes: false,
      reads_backup_payload: false,
      reads_secret_values: false,
      requires_payload_preview_before_enablement: true,
      requires_permission_check_before_enablement: true,
      requires_audit_event_before_enablement: true,
      requires_idempotency_before_enablement: true,
      requires_durable_remote_ack_before_enablement: true,
      requires_retry_dead_letter_before_enablement: true,
      requires_rollback_proof_before_enablement: true,
      requires_conflict_baseline_before_enablement: true,
      requires_first_push_confirmation_before_enablement: true,
    },
    request_schema: {
      schema_status: "planned-metadata-only",
      allowed_fields: buildSyncPushRequestFields(),
      forbidden_fields: buildSyncPushForbiddenFields(),
    },
    response_schema: {
      schema_status: "planned-ack-receipt-only",
      allowed_fields: buildSyncPushResponseFields(),
      forbidden_fields: buildSyncPushForbiddenResponseFields(),
    },
    local_validator_report: buildSyncPushValidatorReport(),
    disabled_response_contract: {
      http_status: 501,
      returns_push_receipt: false,
      returns_remote_ack: false,
      returns_remote_rows: false,
      returns_workspace_content: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      mutates_local_sync_log: false,
      returns_required_confirmation: true,
    },
    enablement_gates: [
      {
        id: "payload-preview",
        title: "Payload preview",
        required_before_enablement:
          "The user must review table names, operations, changed fields, counts, and exclusions before any first push.",
      },
      {
        id: "permission-check",
        title: "Permission check",
        required_before_enablement:
          "Sync push must pass authenticated workspace permission checks before accepting any batch.",
      },
      {
        id: "audit-event",
        title: "Audit event",
        required_before_enablement:
          "Push must link to a metadata-only audit event envelope before execution.",
      },
      {
        id: "idempotency",
        title: "Idempotency",
        required_before_enablement:
          "Each push batch needs an idempotency key so retries cannot duplicate remote rows.",
      },
      {
        id: "durable-remote-ack",
        title: "Durable remote ack",
        required_before_enablement:
          "Local rows may only become synced after durable server acknowledgement exists.",
      },
      {
        id: "retry-dead-letter",
        title: "Retry and dead-letter",
        required_before_enablement:
          "Network failures need retry caps, dead-letter state, and visible recovery steps.",
      },
      {
        id: "rollback-proof",
        title: "Rollback proof",
        required_before_enablement:
          "Failed push and partial ack behavior must be reversible in disposable beta replay.",
      },
      {
        id: "conflict-baseline",
        title: "Conflict baseline",
        required_before_enablement:
          "Remote baseline and conflict review must exist before cloud push can overwrite or delete anything.",
      },
      {
        id: "first-push-confirmation",
        title: "First push confirmation",
        required_before_enablement:
          "The first beta upload needs explicit owner confirmation with destination and data boundary copy.",
      },
    ],
  };
}

export function buildSyncPushRequestFields(): SyncPushApiField[] {
  return SYNC_PUSH_ALLOWED_REQUEST_FIELDS.map((field) => ({ ...field }));
}

export function buildSyncPushForbiddenFields(): SyncPushApiField[] {
  return SYNC_PUSH_FORBIDDEN_REQUEST_FIELDS.map((field) => ({ ...field }));
}

export function buildSyncPushResponseFields(): SyncPushApiField[] {
  return SYNC_PUSH_ALLOWED_RESPONSE_FIELDS.map((field) => ({ ...field }));
}

export function buildSyncPushForbiddenResponseFields(): SyncPushApiField[] {
  return SYNC_PUSH_FORBIDDEN_RESPONSE_FIELDS.map((field) => ({ ...field }));
}

export function buildSyncPushValidatorReport(): SyncPushApiValidatorReport {
  const fixtures: SyncPushApiValidatorFixture[] = [
    {
      id: "metadata-sync-push-request",
      expected_status: "accepted",
      actual_status: "accepted",
      contains_forbidden_payload: false,
      forbidden_field_names: [],
      reason:
        "Contains only metadata needed to describe a future reviewed sync push batch.",
    },
    {
      id: "sync-payload-blocked",
      expected_status: "rejected",
      actual_status: "rejected",
      contains_forbidden_payload: true,
      forbidden_field_names: [
        "sync_log_payload",
        "page_snapshot_json",
        "raw_request_body",
      ],
      reason:
        "Full sync payloads and retained raw request bodies are blocked from the disabled push API.",
    },
    {
      id: "workspace-content-blocked",
      expected_status: "rejected",
      actual_status: "rejected",
      contains_forbidden_payload: true,
      forbidden_field_names: [
        "page_body_text",
        "block_text",
        "database_cell_values",
        "comment_body",
      ],
      reason:
        "Workspace content fields must stay out of push API requests and logs.",
    },
    {
      id: "file-backup-blocked",
      expected_status: "rejected",
      actual_status: "rejected",
      contains_forbidden_payload: true,
      forbidden_field_names: ["file_bytes", "backup_payload", "local_file_path"],
      reason:
        "File bytes, backup packages, and local paths must stay in private local/storage flows.",
    },
    {
      id: "credential-fields-blocked",
      expected_status: "rejected",
      actual_status: "rejected",
      contains_forbidden_payload: true,
      forbidden_field_names: ["token", "cookie", "password", "secret_values"],
      reason:
        "Credential and secret fields are rejected from sync push requests.",
    },
    {
      id: "ack-mutation-blocked",
      expected_status: "rejected",
      actual_status: "rejected",
      contains_forbidden_payload: true,
      forbidden_field_names: [
        "enable_sync_push",
        "force_acknowledge",
        "mark_synced",
        "overwrite_remote",
        "delete_remote",
      ],
      reason:
        "Push requests cannot enable sync, force acknowledgements, mutate local sync status, or perform broad remote writes.",
    },
  ];

  const accepted = fixtures.filter(
    (fixture) => fixture.actual_status === "accepted"
  ).length;
  const rejected = fixtures.filter(
    (fixture) => fixture.actual_status === "rejected"
  ).length;
  const forbiddenPayloadRejections = fixtures.filter(
    (fixture) =>
      fixture.actual_status === "rejected" &&
      fixture.contains_forbidden_payload
  ).length;
  const forbiddenFieldsCovered = unique(
    fixtures.flatMap((fixture) => fixture.forbidden_field_names)
  ).length;

  return {
    format: "zhinote-sync-push-api-validator-fixtures",
    format_version: 1,
    report_status: "local-fixture-report-only",
    validator_status: "not-executing-route",
    summary: {
      fixtures: fixtures.length,
      accepted,
      rejected,
      forbidden_payload_rejections: forbiddenPayloadRejections,
      forbidden_fields_covered: forbiddenFieldsCovered,
    },
    fixtures,
  };
}

function allowed(field: string, reason: string): SyncPushApiField {
  return {
    field,
    status: "allowed",
    reason,
  };
}

function forbidden(field: string, reason: string): SyncPushApiField {
  return {
    field,
    status: "forbidden",
    reason,
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
