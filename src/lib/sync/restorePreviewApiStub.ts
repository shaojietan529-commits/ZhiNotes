import {
  buildWebBetaApiStubResponse,
  type WebBetaApiStubResponse,
} from "@/lib/sync/webBetaApiStubs";

export type RestorePreviewApiFieldStatus = "allowed" | "forbidden";
export type RestorePreviewApiValidationStatus = "accepted" | "rejected";

export interface RestorePreviewApiField {
  field: string;
  status: RestorePreviewApiFieldStatus;
  reason: string;
}

export interface RestorePreviewApiValidatorFixture {
  id: string;
  expected_status: RestorePreviewApiValidationStatus;
  actual_status: RestorePreviewApiValidationStatus;
  contains_forbidden_payload: boolean;
  forbidden_field_names: string[];
  reason: string;
}

export interface RestorePreviewApiValidatorReport {
  format: "zhinote-restore-preview-api-validator-fixtures";
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
  fixtures: RestorePreviewApiValidatorFixture[];
}

export interface RestorePreviewApiDisabledResponse {
  format: "zhinote-restore-preview-api-disabled";
  format_version: 1;
  api_id: "restore-preview";
  path: "/api/backup/restore-preview";
  method: "POST";
  stub_status: "disabled-local-stub";
  can_preview_restore_now: false;
  can_read_request_body_now: false;
  can_read_backup_payload_now: false;
  can_validate_backup_package_now: false;
  can_return_restore_scope_now: false;
  can_write_workspace_data_now: false;
  can_upload_workspace_data_now: false;
  privacy_note: string;
  base_stub: WebBetaApiStubResponse;
  boundary: {
    no_request_argument: true;
    endpoint_disabled: true;
    reads_request_body: false;
    accepts_backup_payload: false;
    validates_backup_package: false;
    returns_restore_scope: false;
    returns_page_body_text: false;
    returns_database_row_values: false;
    returns_comment_bodies: false;
    returns_file_bytes: false;
    writes_workspace_data: false;
    overwrites_pages: false;
    deletes_rows: false;
    uploads_workspace_data: false;
    syncs_preview_data: false;
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_comment_bodies: false;
    reads_file_bytes: false;
    reads_backup_payload: false;
    reads_secret_values: false;
    requires_local_file_selection_before_enablement: true;
    requires_checksum_validation_before_enablement: true;
    requires_size_limit_before_enablement: true;
    requires_schema_parser_before_enablement: true;
    requires_permission_check_before_enablement: true;
    requires_audit_event_before_enablement: true;
    requires_no_content_echo_before_enablement: true;
  };
  request_schema: {
    schema_status: "planned-metadata-only";
    allowed_fields: RestorePreviewApiField[];
    forbidden_fields: RestorePreviewApiField[];
  };
  response_schema: {
    schema_status: "planned-scope-receipt-only";
    allowed_fields: RestorePreviewApiField[];
    forbidden_fields: RestorePreviewApiField[];
  };
  local_validator_report: RestorePreviewApiValidatorReport;
  disabled_response_contract: {
    http_status: 501;
    returns_restore_preview: false;
    returns_scope_counts: false;
    returns_backup_payload: false;
    returns_workspace_content: false;
    writes_workspace_data: false;
    returns_required_confirmation: true;
  };
  enablement_gates: Array<{
    id: string;
    title: string;
    required_before_enablement: string;
  }>;
}

const RESTORE_PREVIEW_ALLOWED_REQUEST_FIELDS: RestorePreviewApiField[] = [
  allowed("workspace_id", "Cloud workspace boundary after authenticated membership."),
  allowed("actor_user_id", "Authenticated actor id, never a free-form name."),
  allowed("device_id", "Registered device id for local preview provenance."),
  allowed("backup_manifest_id", "Opaque id for a local backup manifest reviewed by the user."),
  allowed("backup_file_name_hash", "Hash of the selected file name, not the raw local path."),
  allowed("backup_size_bytes", "Size metadata for limits and user-facing warnings."),
  allowed("backup_checksum", "Checksum metadata for duplicate and integrity checks."),
  allowed("backup_format", "Declared backup format such as zhinote-workspace-backup."),
  allowed("backup_format_version", "Declared backup schema version."),
  allowed("preview_scope_request", "Optional metadata-only scope filter requested by the user."),
  allowed("idempotency_key", "Prevents duplicate preview jobs after retries."),
  allowed("created_at", "Client timestamp for expiry checks only."),
];

const RESTORE_PREVIEW_FORBIDDEN_REQUEST_FIELDS: RestorePreviewApiField[] = [
  forbidden("backup_payload", "Full backup JSON or ZIP payload must not be posted to the disabled preview route."),
  forbidden("full_backup_json", "Full backup JSON can contain note bodies, database values, comments, and file records."),
  forbidden("page_body_text", "Page text must not be part of a preview request."),
  forbidden("block_text", "Block text is private content, not preview metadata."),
  forbidden("database_cell_values", "Database row values must not be posted to the preview API."),
  forbidden("comment_body", "Comments may contain private discussion and must not be logged or echoed."),
  forbidden("file_bytes", "Files stay local or in private storage flows, not this metadata route."),
  forbidden("uploaded_file_bytes", "Uploaded report or attachment bytes must never be posted here."),
  forbidden("raw_request_body", "Raw restore preview request retention is forbidden."),
  forbidden("scope_counts", "Client-supplied scope counts must not be trusted as server preview output."),
  forbidden("apply_now", "Preview routes must never trigger restore apply."),
  forbidden("delete_all", "Bulk destructive flags are not valid preview metadata."),
  forbidden("overwrite_all", "Broad overwrite flags are not valid preview metadata."),
  forbidden("token", "Tokens must never be included in restore preview requests."),
  forbidden("cookie", "Cookies must never be included in restore preview requests."),
  forbidden("password", "Passwords must never be included in restore preview requests."),
  forbidden("secret_values", "Secret values and connection strings must never be included."),
  forbidden("local_file_path", "Local paths can disclose private folder names."),
];

const RESTORE_PREVIEW_ALLOWED_RESPONSE_FIELDS: RestorePreviewApiField[] = [
  allowed("format", "Stable disabled response format."),
  allowed("api_id", "Identifies the disabled restore preview API."),
  allowed("stub_status", "Confirms the route is not active."),
  allowed("decision_status", "Future response may say disabled, denied, requires-confirmation, or previewed."),
  allowed("preview_receipt_id", "Future server-generated receipt id only after preview is enabled."),
  allowed("scope_counts", "Future count-only restore scope summary after validation."),
  allowed("issues", "Future metadata-only validation issues."),
  allowed("warnings", "Future metadata-only validation warnings."),
  allowed("required_gates", "Gate ids that block server-side restore preview."),
  allowed("reason_codes", "Machine-readable refusal reasons."),
];

const RESTORE_PREVIEW_FORBIDDEN_RESPONSE_FIELDS: RestorePreviewApiField[] = [
  forbidden("backup_payload", "Restore preview response must not echo backup payloads."),
  forbidden("full_backup_json", "Restore preview response must never return full backup JSON."),
  forbidden("page_body_text", "Restore preview response must never return page text."),
  forbidden("database_cell_values", "Restore preview response must never return database values."),
  forbidden("comment_body", "Restore preview response must never return comment bodies."),
  forbidden("file_bytes", "Restore preview response must never return file bytes."),
  forbidden("uploaded_file_bytes", "Restore preview response must never return uploaded file bytes."),
  forbidden("raw_request_body", "Restore preview response must never return raw request payloads."),
  forbidden("token", "Restore preview response must never return tokens."),
  forbidden("cookie", "Restore preview response must never return cookies."),
  forbidden("secret_values", "Restore preview response must never return secrets."),
];

export function buildRestorePreviewApiDisabledResponse(): RestorePreviewApiDisabledResponse {
  return {
    format: "zhinote-restore-preview-api-disabled",
    format_version: 1,
    api_id: "restore-preview",
    path: "/api/backup/restore-preview",
    method: "POST",
    stub_status: "disabled-local-stub",
    can_preview_restore_now: false,
    can_read_request_body_now: false,
    can_read_backup_payload_now: false,
    can_validate_backup_package_now: false,
    can_return_restore_scope_now: false,
    can_write_workspace_data_now: false,
    can_upload_workspace_data_now: false,
    privacy_note:
      "This route is intentionally disabled. It does not accept backup payloads, read request bodies, validate backup packages, return restore scope, echo workspace content, write workspace data, upload workspace data, or sync preview data.",
    base_stub: buildWebBetaApiStubResponse("restore-preview"),
    boundary: {
      no_request_argument: true,
      endpoint_disabled: true,
      reads_request_body: false,
      accepts_backup_payload: false,
      validates_backup_package: false,
      returns_restore_scope: false,
      returns_page_body_text: false,
      returns_database_row_values: false,
      returns_comment_bodies: false,
      returns_file_bytes: false,
      writes_workspace_data: false,
      overwrites_pages: false,
      deletes_rows: false,
      uploads_workspace_data: false,
      syncs_preview_data: false,
      reads_page_body_text: false,
      reads_database_row_values: false,
      reads_comment_bodies: false,
      reads_file_bytes: false,
      reads_backup_payload: false,
      reads_secret_values: false,
      requires_local_file_selection_before_enablement: true,
      requires_checksum_validation_before_enablement: true,
      requires_size_limit_before_enablement: true,
      requires_schema_parser_before_enablement: true,
      requires_permission_check_before_enablement: true,
      requires_audit_event_before_enablement: true,
      requires_no_content_echo_before_enablement: true,
    },
    request_schema: {
      schema_status: "planned-metadata-only",
      allowed_fields: buildRestorePreviewRequestFields(),
      forbidden_fields: buildRestorePreviewForbiddenFields(),
    },
    response_schema: {
      schema_status: "planned-scope-receipt-only",
      allowed_fields: buildRestorePreviewResponseFields(),
      forbidden_fields: buildRestorePreviewForbiddenResponseFields(),
    },
    local_validator_report: buildRestorePreviewValidatorReport(),
    disabled_response_contract: {
      http_status: 501,
      returns_restore_preview: false,
      returns_scope_counts: false,
      returns_backup_payload: false,
      returns_workspace_content: false,
      writes_workspace_data: false,
      returns_required_confirmation: true,
    },
    enablement_gates: [
      {
        id: "local-file-selection",
        title: "Local file selection",
        required_before_enablement:
          "Backup selection must stay user-initiated and visible before any server-side preview can be considered.",
      },
      {
        id: "checksum-validation",
        title: "Checksum validation",
        required_before_enablement:
          "The backup package must be checked against a reviewed checksum before any preview result is trusted.",
      },
      {
        id: "size-limit",
        title: "Size limit",
        required_before_enablement:
          "Server preview needs explicit size limits, timeout behavior, and user-facing failure states.",
      },
      {
        id: "schema-parser",
        title: "Schema parser",
        required_before_enablement:
          "Backup parsing must use a schema-aware parser that rejects unknown content-bearing fields.",
      },
      {
        id: "permission-check",
        title: "Permission check",
        required_before_enablement:
          "Restore preview must pass authenticated workspace permission checks before reading any staged backup package.",
      },
      {
        id: "audit-event",
        title: "Audit event",
        required_before_enablement:
          "Server-side preview must link to a metadata-only audit event envelope before execution.",
      },
      {
        id: "no-content-echo",
        title: "No content echo",
        required_before_enablement:
          "Preview responses must return counts, issue ids, warnings, and scope labels, not page text, database values, comments, or file bytes.",
      },
    ],
  };
}

export function buildRestorePreviewRequestFields(): RestorePreviewApiField[] {
  return RESTORE_PREVIEW_ALLOWED_REQUEST_FIELDS.map((field) => ({ ...field }));
}

export function buildRestorePreviewForbiddenFields(): RestorePreviewApiField[] {
  return RESTORE_PREVIEW_FORBIDDEN_REQUEST_FIELDS.map((field) => ({ ...field }));
}

export function buildRestorePreviewResponseFields(): RestorePreviewApiField[] {
  return RESTORE_PREVIEW_ALLOWED_RESPONSE_FIELDS.map((field) => ({ ...field }));
}

export function buildRestorePreviewForbiddenResponseFields(): RestorePreviewApiField[] {
  return RESTORE_PREVIEW_FORBIDDEN_RESPONSE_FIELDS.map((field) => ({ ...field }));
}

export function buildRestorePreviewValidatorReport(): RestorePreviewApiValidatorReport {
  const fixtures: RestorePreviewApiValidatorFixture[] = [
    {
      id: "metadata-restore-preview-request",
      expected_status: "accepted",
      actual_status: "accepted",
      contains_forbidden_payload: false,
      forbidden_field_names: [],
      reason:
        "Contains only metadata needed to describe a future backup preview request.",
    },
    {
      id: "backup-payload-blocked",
      expected_status: "rejected",
      actual_status: "rejected",
      contains_forbidden_payload: true,
      forbidden_field_names: ["backup_payload", "full_backup_json", "raw_request_body"],
      reason:
        "Full backup packages and retained raw request bodies are blocked from the disabled preview API.",
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
        "Workspace content fields must stay out of preview API requests and logs.",
    },
    {
      id: "file-bytes-blocked",
      expected_status: "rejected",
      actual_status: "rejected",
      contains_forbidden_payload: true,
      forbidden_field_names: ["file_bytes", "uploaded_file_bytes", "local_file_path"],
      reason:
        "File bytes and local paths must stay in local/private storage flows.",
    },
    {
      id: "scope-forgery-blocked",
      expected_status: "rejected",
      actual_status: "rejected",
      contains_forbidden_payload: true,
      forbidden_field_names: ["scope_counts", "apply_now", "delete_all", "overwrite_all"],
      reason:
        "Preview requests cannot claim trusted counts or trigger apply/delete/overwrite behavior.",
    },
    {
      id: "credential-fields-blocked",
      expected_status: "rejected",
      actual_status: "rejected",
      contains_forbidden_payload: true,
      forbidden_field_names: ["token", "cookie", "password", "secret_values"],
      reason:
        "Credential and secret fields are rejected from restore preview requests.",
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
    format: "zhinote-restore-preview-api-validator-fixtures",
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

function allowed(field: string, reason: string): RestorePreviewApiField {
  return {
    field,
    status: "allowed",
    reason,
  };
}

function forbidden(field: string, reason: string): RestorePreviewApiField {
  return {
    field,
    status: "forbidden",
    reason,
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
