import {
  buildWebBetaApiStubResponse,
  type WebBetaApiStubResponse,
} from "@/lib/sync/webBetaApiStubs";

export type RestoreApplyApiFieldStatus = "allowed" | "forbidden";
export type RestoreApplyApiValidationStatus = "accepted" | "rejected";

export interface RestoreApplyApiField {
  field: string;
  status: RestoreApplyApiFieldStatus;
  reason: string;
}

export interface RestoreApplyApiValidatorFixture {
  id: string;
  expected_status: RestoreApplyApiValidationStatus;
  actual_status: RestoreApplyApiValidationStatus;
  contains_forbidden_payload: boolean;
  forbidden_field_names: string[];
  reason: string;
}

export interface RestoreApplyApiValidatorReport {
  format: "zhinote-restore-apply-api-validator-fixtures";
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
  fixtures: RestoreApplyApiValidatorFixture[];
}

export interface RestoreApplyApiDisabledResponse {
  format: "zhinote-restore-apply-api-disabled";
  format_version: 1;
  api_id: "restore-apply";
  path: "/api/backup/restore-apply";
  method: "POST";
  stub_status: "disabled-local-stub";
  can_apply_restore_now: false;
  can_read_request_body_now: false;
  can_read_backup_payload_now: false;
  can_write_workspace_data_now: false;
  can_overwrite_pages_now: false;
  can_delete_rows_now: false;
  can_upload_workspace_data_now: false;
  can_sync_restored_data_now: false;
  privacy_note: string;
  base_stub: WebBetaApiStubResponse;
  boundary: {
    no_request_argument: true;
    endpoint_disabled: true;
    reads_request_body: false;
    accepts_restore_payload: false;
    metadata_only_request: true;
    applies_restore: false;
    writes_workspace_data: false;
    overwrites_pages: false;
    deletes_rows: false;
    uploads_workspace_data: false;
    syncs_restored_data: false;
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_comment_bodies: false;
    reads_file_bytes: false;
    reads_backup_payload: false;
    reads_secret_values: false;
    requires_rollback_snapshot_before_enablement: true;
    requires_scope_review_before_enablement: true;
    requires_permission_check_before_enablement: true;
    requires_audit_event_before_enablement: true;
    requires_sync_replay_safety_before_enablement: true;
    requires_second_confirmation_before_enablement: true;
    requires_failure_recovery_before_enablement: true;
  };
  request_schema: {
    schema_status: "planned-metadata-only";
    allowed_fields: RestoreApplyApiField[];
    forbidden_fields: RestoreApplyApiField[];
  };
  response_schema: {
    schema_status: "planned-receipt-only";
    allowed_fields: RestoreApplyApiField[];
    forbidden_fields: RestoreApplyApiField[];
  };
  local_validator_report: RestoreApplyApiValidatorReport;
  disabled_response_contract: {
    http_status: 501;
    returns_restore_result: false;
    returns_applied_counts: false;
    returns_backup_payload: false;
    writes_workspace_data: false;
    returns_required_confirmation: true;
  };
  enablement_gates: Array<{
    id: string;
    title: string;
    required_before_enablement: string;
  }>;
}

const RESTORE_APPLY_ALLOWED_REQUEST_FIELDS: RestoreApplyApiField[] = [
  allowed("workspace_id", "Cloud workspace boundary after authenticated membership."),
  allowed("actor_user_id", "Authenticated actor id, never a free-form name."),
  allowed("device_id", "Registered device id for local rollback provenance."),
  allowed("backup_manifest_id", "Opaque id for a previously reviewed backup manifest."),
  allowed("rollback_snapshot_id", "Fresh rollback backup id created immediately before apply."),
  allowed("restore_scope_ids", "Reviewed scope ids such as pages, databases, files, versions, and comments."),
  allowed("restore_scope_counts", "Count-only summary for reviewed restore scopes."),
  allowed("permission_decision_id", "Server permission decision reference for restore."),
  allowed("audit_event_envelope_id", "Metadata-only audit envelope reference."),
  allowed("sync_replay_proof_id", "Disposable replay proof id before restore interacts with sync."),
  allowed("second_confirmation_receipt_id", "Typed confirmation receipt id for restore write-back."),
  allowed("failure_recovery_plan_id", "Rollback/failure recovery proof id."),
  allowed("idempotency_key", "Prevents duplicate restore application after retries."),
  allowed("created_at", "Client timestamp for expiry checks only."),
];

const RESTORE_APPLY_FORBIDDEN_REQUEST_FIELDS: RestoreApplyApiField[] = [
  forbidden("backup_payload", "Full backup JSON or ZIP payload must not be posted to the apply route."),
  forbidden("page_body_text", "Page text must not be part of a restore permission/apply request."),
  forbidden("block_text", "Block text is private content, not apply metadata."),
  forbidden("database_cell_values", "Database row values must be restored through reviewed import logic, not this metadata route."),
  forbidden("comment_body", "Comments may contain private discussion and must not be logged or echoed."),
  forbidden("file_bytes", "Files stay in private storage/import flows, not restore apply metadata."),
  forbidden("raw_request_body", "Raw restore request retention is forbidden."),
  forbidden("delete_all", "Bulk destructive flags must not be accepted by the disabled route."),
  forbidden("overwrite_all", "Broad overwrite flags require a dedicated reviewed runner, not metadata apply."),
  forbidden("token", "Tokens must never be included in restore requests."),
  forbidden("cookie", "Cookies must never be included in restore requests."),
  forbidden("password", "Passwords must never be included in restore requests."),
  forbidden("secret_values", "Secret values and connection strings must never be included."),
  forbidden("local_file_path", "Local paths can disclose private folder names."),
];

const RESTORE_APPLY_ALLOWED_RESPONSE_FIELDS: RestoreApplyApiField[] = [
  allowed("format", "Stable disabled response format."),
  allowed("api_id", "Identifies the disabled restore apply API."),
  allowed("stub_status", "Confirms the route is not active."),
  allowed("decision_status", "Future response may say disabled, denied, requires-confirmation, or applied."),
  allowed("restore_receipt_id", "Future server-generated receipt id only after writes are enabled."),
  allowed("required_gates", "Gate ids that block restore write-back."),
  allowed("reason_codes", "Machine-readable refusal reasons."),
];

const RESTORE_APPLY_FORBIDDEN_RESPONSE_FIELDS: RestoreApplyApiField[] = [
  forbidden("backup_payload", "Restore response must not echo backup payloads."),
  forbidden("page_body_text", "Restore response must never return page text."),
  forbidden("database_cell_values", "Restore response must never return database values."),
  forbidden("comment_body", "Restore response must never return comment bodies."),
  forbidden("file_bytes", "Restore response must never return file bytes."),
  forbidden("raw_request_body", "Restore response must never return raw request payloads."),
  forbidden("token", "Restore response must never return tokens."),
  forbidden("cookie", "Restore response must never return cookies."),
  forbidden("secret_values", "Restore response must never return secrets."),
];

export function buildRestoreApplyApiDisabledResponse(): RestoreApplyApiDisabledResponse {
  return {
    format: "zhinote-restore-apply-api-disabled",
    format_version: 1,
    api_id: "restore-apply",
    path: "/api/backup/restore-apply",
    method: "POST",
    stub_status: "disabled-local-stub",
    can_apply_restore_now: false,
    can_read_request_body_now: false,
    can_read_backup_payload_now: false,
    can_write_workspace_data_now: false,
    can_overwrite_pages_now: false,
    can_delete_rows_now: false,
    can_upload_workspace_data_now: false,
    can_sync_restored_data_now: false,
    privacy_note:
      "This route is intentionally disabled. It does not accept restore payloads, read request bodies, read backup packages, overwrite pages, delete rows, write workspace data, upload workspace data, or sync restored data.",
    base_stub: buildWebBetaApiStubResponse("restore-apply"),
    boundary: {
      no_request_argument: true,
      endpoint_disabled: true,
      reads_request_body: false,
      accepts_restore_payload: false,
      metadata_only_request: true,
      applies_restore: false,
      writes_workspace_data: false,
      overwrites_pages: false,
      deletes_rows: false,
      uploads_workspace_data: false,
      syncs_restored_data: false,
      reads_page_body_text: false,
      reads_database_row_values: false,
      reads_comment_bodies: false,
      reads_file_bytes: false,
      reads_backup_payload: false,
      reads_secret_values: false,
      requires_rollback_snapshot_before_enablement: true,
      requires_scope_review_before_enablement: true,
      requires_permission_check_before_enablement: true,
      requires_audit_event_before_enablement: true,
      requires_sync_replay_safety_before_enablement: true,
      requires_second_confirmation_before_enablement: true,
      requires_failure_recovery_before_enablement: true,
    },
    request_schema: {
      schema_status: "planned-metadata-only",
      allowed_fields: buildRestoreApplyRequestFields(),
      forbidden_fields: buildRestoreApplyForbiddenFields(),
    },
    response_schema: {
      schema_status: "planned-receipt-only",
      allowed_fields: buildRestoreApplyResponseFields(),
      forbidden_fields: buildRestoreApplyForbiddenResponseFields(),
    },
    local_validator_report: buildRestoreApplyValidatorReport(),
    disabled_response_contract: {
      http_status: 501,
      returns_restore_result: false,
      returns_applied_counts: false,
      returns_backup_payload: false,
      writes_workspace_data: false,
      returns_required_confirmation: true,
    },
    enablement_gates: [
      {
        id: "rollback-snapshot",
        title: "Rollback snapshot",
        required_before_enablement:
          "A fresh current-workspace backup must be exported immediately before any restore apply can start.",
      },
      {
        id: "scope-review",
        title: "Restore scope review",
        required_before_enablement:
          "Every restore scope, count, risk class, and write target must be reviewed before apply.",
      },
      {
        id: "permission-check",
        title: "Permission check",
        required_before_enablement:
          "Restore write-back must pass authenticated server permission checks before any workspace mutation.",
      },
      {
        id: "audit-event",
        title: "Audit event",
        required_before_enablement:
          "Restore apply must link to a metadata-only audit event envelope before execution.",
      },
      {
        id: "sync-replay-safety",
        title: "Sync replay safety",
        required_before_enablement:
          "Push, pull, acknowledgement, conflict, retry, idempotency, and rollback interactions must be proven first.",
      },
      {
        id: "second-confirmation",
        title: "Second confirmation",
        required_before_enablement:
          "A typed second confirmation must reference the backup manifest, rollback snapshot, scope review, permission decision, and audit envelope.",
      },
      {
        id: "failure-recovery",
        title: "Failure recovery",
        required_before_enablement:
          "A partial failure checkpoint and rollback proof must exist before writes are enabled.",
      },
    ],
  };
}

export function buildRestoreApplyRequestFields(): RestoreApplyApiField[] {
  return RESTORE_APPLY_ALLOWED_REQUEST_FIELDS;
}

export function buildRestoreApplyForbiddenFields(): RestoreApplyApiField[] {
  return RESTORE_APPLY_FORBIDDEN_REQUEST_FIELDS;
}

export function buildRestoreApplyResponseFields(): RestoreApplyApiField[] {
  return RESTORE_APPLY_ALLOWED_RESPONSE_FIELDS;
}

export function buildRestoreApplyForbiddenResponseFields(): RestoreApplyApiField[] {
  return RESTORE_APPLY_FORBIDDEN_RESPONSE_FIELDS;
}

export function buildRestoreApplyValidatorReport(): RestoreApplyApiValidatorReport {
  const fixtures: RestoreApplyApiValidatorFixture[] = [
    fixture(
      "metadata-restore-apply-request",
      "accepted",
      false,
      [],
      "Backup manifest id, rollback snapshot id, reviewed scope ids/counts, permission decision, audit envelope, sync replay proof, second confirmation, and idempotency metadata are allowed in the future schema."
    ),
    fixture(
      "backup-payload-blocked",
      "rejected",
      true,
      ["backup_payload", "raw_request_body"],
      "Full backup packages and raw request bodies are forbidden because restore apply must consume reviewed metadata and staged import records only."
    ),
    fixture(
      "workspace-content-blocked",
      "rejected",
      true,
      ["page_body_text", "block_text", "database_cell_values", "comment_body"],
      "Workspace content fields are forbidden because restore apply must not echo private research content."
    ),
    fixture(
      "file-bytes-blocked",
      "rejected",
      true,
      ["file_bytes", "local_file_path"],
      "File bytes and local file paths are forbidden because files need private storage/import review."
    ),
    fixture(
      "destructive-flags-blocked",
      "rejected",
      true,
      ["delete_all", "overwrite_all"],
      "Broad destructive flags are forbidden in the disabled route and require a dedicated reviewed runner before enablement."
    ),
    fixture(
      "credential-fields-blocked",
      "rejected",
      true,
      ["token", "cookie", "password", "secret_values"],
      "Credentials and secret values are forbidden because restore apply must not carry auth secrets."
    ),
  ];

  return {
    format: "zhinote-restore-apply-api-validator-fixtures",
    format_version: 1,
    report_status: "local-fixture-report-only",
    validator_status: "not-executing-route",
    summary: {
      fixtures: fixtures.length,
      accepted: fixtures.filter((item) => item.actual_status === "accepted")
        .length,
      rejected: fixtures.filter((item) => item.actual_status === "rejected")
        .length,
      forbidden_payload_rejections: fixtures.filter(
        (item) => item.contains_forbidden_payload
      ).length,
      forbidden_fields_covered: unique(
        fixtures.flatMap((item) => item.forbidden_field_names)
      ).length,
    },
    fixtures,
  };
}

function allowed(field: string, reason: string): RestoreApplyApiField {
  return { field, status: "allowed", reason };
}

function forbidden(field: string, reason: string): RestoreApplyApiField {
  return { field, status: "forbidden", reason };
}

function fixture(
  id: string,
  status: RestoreApplyApiValidationStatus,
  containsForbiddenPayload: boolean,
  forbiddenFieldNames: string[],
  reason: string
): RestoreApplyApiValidatorFixture {
  return {
    id,
    expected_status: status,
    actual_status: status,
    contains_forbidden_payload: containsForbiddenPayload,
    forbidden_field_names: forbiddenFieldNames,
    reason,
  };
}

function unique(values: string[]) {
  return [...new Set(values)];
}
