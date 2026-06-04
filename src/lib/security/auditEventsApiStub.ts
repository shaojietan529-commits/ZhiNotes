import {
  buildWebBetaApiStubResponse,
  type WebBetaApiStubResponse,
} from "@/lib/sync/webBetaApiStubs";

export type AuditEventsApiFieldStatus = "allowed" | "forbidden";
export type AuditEventsApiValidationStatus = "accepted" | "rejected";

export interface AuditEventsApiField {
  field: string;
  status: AuditEventsApiFieldStatus;
  reason: string;
}

export interface AuditEventsApiValidatorFixture {
  id: string;
  expected_status: AuditEventsApiValidationStatus;
  actual_status: AuditEventsApiValidationStatus;
  contains_forbidden_payload: boolean;
  reason: string;
}

export interface AuditEventsApiValidatorReport {
  format: "zhinote-audit-events-api-validator-fixtures";
  format_version: 1;
  report_status: "local-fixture-report-only";
  validator_status: "not-executing-route";
  summary: {
    fixtures: number;
    accepted: number;
    rejected: number;
    forbidden_payload_rejections: number;
  };
  fixtures: AuditEventsApiValidatorFixture[];
}

export interface AuditEventsApiDisabledResponse {
  format: "zhinote-audit-events-api-disabled";
  format_version: 1;
  api_id: "audit-events";
  path: "/api/audit/events";
  method: "POST";
  stub_status: "disabled-local-stub";
  can_record_server_audit_events_now: false;
  can_read_request_body_now: false;
  can_read_event_payload_now: false;
  can_write_audit_events_table_now: false;
  can_write_server_audit_log_now: false;
  can_read_page_body_text_now: false;
  can_read_database_values_now: false;
  can_read_file_bytes_now: false;
  can_read_prompt_text_now: false;
  can_upload_workspace_data_now: false;
  can_expose_secret_values_now: false;
  privacy_note: string;
  base_stub: WebBetaApiStubResponse;
  boundary: {
    no_request_argument: true;
    reads_request_body: false;
    metadata_only_request: true;
    accepts_event_payload: false;
    executes_actions: false;
    writes_audit_events_table: false;
    writes_server_audit_log: false;
    writes_workspace_data: false;
    uploads_workspace_data: false;
    reads_page_body_text: false;
    reads_block_text: false;
    reads_database_row_values: false;
    reads_comment_bodies: false;
    reads_file_bytes: false;
    reads_backup_payload: false;
    reads_prompt_text: false;
    reads_model_raw_output: false;
    reads_secret_values: false;
    exposes_secret_values: false;
    records_signed_urls: false;
    requires_authenticated_actor_before_enablement: true;
    requires_workspace_membership_before_enablement: true;
    requires_permission_decision_before_enablement: true;
    requires_redaction_before_enablement: true;
    requires_retention_policy_before_enablement: true;
    requires_tamper_resistant_storage_before_enablement: true;
    requires_owner_audit_export_before_enablement: true;
  };
  request_schema: {
    schema_status: "planned-metadata-only";
    allowed_fields: AuditEventsApiField[];
    forbidden_fields: AuditEventsApiField[];
  };
  response_schema: {
    schema_status: "planned-receipt-only";
    allowed_fields: AuditEventsApiField[];
    forbidden_fields: AuditEventsApiField[];
  };
  local_validator_report: AuditEventsApiValidatorReport;
  disabled_response_contract: {
    http_status: 501;
    returns_recorded_event_id: false;
    returns_audit_payload: false;
    returns_sensitive_payload: false;
    writes_audit_event: false;
    returns_required_confirmation: true;
  };
  enablement_gates: Array<{
    id: string;
    title: string;
    required_before_enablement: string;
  }>;
}

const AUDIT_EVENTS_ALLOWED_REQUEST_FIELDS: AuditEventsApiField[] = [
  allowed("workspace_id", "Cloud workspace boundary after authenticated membership."),
  allowed("actor_user_id", "Authenticated actor id, never a free-form name."),
  allowed("device_id", "Registered device id for local-first sync provenance."),
  allowed("event_type", "Normalized audit event enum such as auth, sync, restore, file, AI, export, permission, or admin."),
  allowed("resource_type", "Normalized resource enum such as page, database, file, sync batch, AI run, restore, or permission."),
  allowed("resource_id", "Opaque resource id or null; content and titles stay out."),
  allowed("operation_status", "started, approved, denied, failed, completed, or cancelled."),
  allowed("metadata_counts", "Small numeric counts such as rows, fields, conflicts, files, or pages."),
  allowed("metadata_hashes", "Checksums or ids that prove integrity without raw content."),
  allowed("changed_field_names", "Field names touched by sync without values."),
  allowed("permission_decision_id", "Server permission decision reference for high-risk actions."),
  allowed("confirmation_receipt_id", "Typed confirmation receipt id for user-approved actions."),
  allowed("redaction_profile", "metadata-only or explicit-payload-approved profile id."),
  allowed("retention_class", "short, beta, or incident retention label."),
  allowed("client_event_id", "Client idempotency key before the server generates an event id."),
  allowed("occurred_at", "Client timestamp for ordering only; server timestamp remains authoritative."),
];

const AUDIT_EVENTS_FORBIDDEN_REQUEST_FIELDS: AuditEventsApiField[] = [
  forbidden("page_body_text", "Research note text must never be posted to audit events."),
  forbidden("block_text", "Block content is workspace payload, not audit metadata."),
  forbidden("database_cell_values", "Database values may contain private investment research."),
  forbidden("comment_body", "Comments may contain private discussion."),
  forbidden("file_bytes", "Files belong in private storage, not audit payloads."),
  forbidden("backup_payload", "Backup JSON or ZIP payloads must stay out of audit rows."),
  forbidden("prompt_text", "AI prompts may include private research context."),
  forbidden("model_raw_output", "Raw AI output needs separate review before storage."),
  forbidden("token", "Tokens must never be accepted by the route body."),
  forbidden("cookie", "Cookies must never be accepted by the route body."),
  forbidden("password", "Passwords must never be accepted by audit events."),
  forbidden("secret_values", "Connection strings, API keys, and env values must not be logged."),
  forbidden("signed_upload_url", "Signed upload URLs are credentials and must not enter audit rows."),
  forbidden("signed_download_url", "Signed download URLs are credentials and must not enter audit rows."),
  forbidden("public_url", "Public URLs are forbidden for private research files by default."),
  forbidden("raw_request_body", "Raw request body retention is forbidden."),
  forbidden("environment_value", "Environment values can expose configuration and secrets."),
  forbidden("local_file_path", "Local file paths can disclose private folder names."),
  forbidden("sql_text", "SQL text can expose schema details, secrets, or destructive actions."),
];

const AUDIT_EVENTS_ALLOWED_RESPONSE_FIELDS: AuditEventsApiField[] = [
  allowed("format", "Stable disabled response format."),
  allowed("api_id", "Identifies the disabled audit-events API."),
  allowed("stub_status", "Confirms the route is not active."),
  allowed("decision_status", "Future response may say disabled, denied, requires-confirmation, or recorded."),
  allowed("audit_event_id", "Future server-generated receipt id only after writes are enabled."),
  allowed("required_gates", "Gate ids that block audit writes."),
  allowed("reason_codes", "Machine-readable refusal reasons."),
  allowed("retention_class", "Retention label metadata only."),
];

const AUDIT_EVENTS_FORBIDDEN_RESPONSE_FIELDS: AuditEventsApiField[] = [
  forbidden("audit_payload", "Audit response must not echo request payloads."),
  forbidden("page_body_text", "Page text must never be returned by audit events."),
  forbidden("database_cell_values", "Database values must never be returned by audit events."),
  forbidden("file_bytes", "File bytes must never be returned by audit events."),
  forbidden("backup_payload", "Backup payloads must never be returned by audit events."),
  forbidden("prompt_text", "Prompt text must never be returned by audit events."),
  forbidden("model_raw_output", "Raw AI output must never be returned by audit events."),
  forbidden("token", "Tokens must never be returned by audit events."),
  forbidden("cookie", "Cookies must never be returned by audit events."),
  forbidden("secret_values", "Secrets must never be returned by audit events."),
  forbidden("signed_upload_url", "Signed upload URLs must never be returned by audit events."),
  forbidden("signed_download_url", "Signed download URLs must never be returned by audit events."),
  forbidden("public_url", "Public URLs must never be returned by audit events."),
];

export function buildAuditEventsApiDisabledResponse(): AuditEventsApiDisabledResponse {
  return {
    format: "zhinote-audit-events-api-disabled",
    format_version: 1,
    api_id: "audit-events",
    path: "/api/audit/events",
    method: "POST",
    stub_status: "disabled-local-stub",
    can_record_server_audit_events_now: false,
    can_read_request_body_now: false,
    can_read_event_payload_now: false,
    can_write_audit_events_table_now: false,
    can_write_server_audit_log_now: false,
    can_read_page_body_text_now: false,
    can_read_database_values_now: false,
    can_read_file_bytes_now: false,
    can_read_prompt_text_now: false,
    can_upload_workspace_data_now: false,
    can_expose_secret_values_now: false,
    privacy_note:
      "This route is intentionally disabled. It does not accept event payloads, read request bodies, inspect page text, inspect database values, read comments, read file bytes, read backups, read prompts, read model output, read secrets, write audit_events, write server logs, or upload workspace data.",
    base_stub: buildWebBetaApiStubResponse("audit-events"),
    boundary: {
      no_request_argument: true,
      reads_request_body: false,
      metadata_only_request: true,
      accepts_event_payload: false,
      executes_actions: false,
      writes_audit_events_table: false,
      writes_server_audit_log: false,
      writes_workspace_data: false,
      uploads_workspace_data: false,
      reads_page_body_text: false,
      reads_block_text: false,
      reads_database_row_values: false,
      reads_comment_bodies: false,
      reads_file_bytes: false,
      reads_backup_payload: false,
      reads_prompt_text: false,
      reads_model_raw_output: false,
      reads_secret_values: false,
      exposes_secret_values: false,
      records_signed_urls: false,
      requires_authenticated_actor_before_enablement: true,
      requires_workspace_membership_before_enablement: true,
      requires_permission_decision_before_enablement: true,
      requires_redaction_before_enablement: true,
      requires_retention_policy_before_enablement: true,
      requires_tamper_resistant_storage_before_enablement: true,
      requires_owner_audit_export_before_enablement: true,
    },
    request_schema: {
      schema_status: "planned-metadata-only",
      allowed_fields: buildAuditEventsRequestFields(),
      forbidden_fields: buildAuditEventsForbiddenFields(),
    },
    response_schema: {
      schema_status: "planned-receipt-only",
      allowed_fields: buildAuditEventsResponseFields(),
      forbidden_fields: buildAuditEventsForbiddenResponseFields(),
    },
    local_validator_report: buildAuditEventsValidatorReport(),
    disabled_response_contract: {
      http_status: 501,
      returns_recorded_event_id: false,
      returns_audit_payload: false,
      returns_sensitive_payload: false,
      writes_audit_event: false,
      returns_required_confirmation: true,
    },
    enablement_gates: [
      {
        id: "authenticated-actor",
        title: "Authenticated actor",
        required_before_enablement:
          "Server session identity must be implemented before audit events can trust actor_user_id.",
      },
      {
        id: "workspace-membership",
        title: "Workspace membership",
        required_before_enablement:
          "Server-side workspace membership and role lookup must pass before any audit event can be recorded.",
      },
      {
        id: "metadata-only-schema-validation",
        title: "Metadata-only schema validation",
        required_before_enablement:
          "The route must reject page text, database values, comments, file bytes, backups, prompts, model output, tokens, cookies, signed URLs, public URLs, and raw request bodies.",
      },
      {
        id: "permission-decision-link",
        title: "Permission decision link",
        required_before_enablement:
          "High-risk audit events must link to a server permission decision before the event is written.",
      },
      {
        id: "retention-policy",
        title: "Retention policy",
        required_before_enablement:
          "Every event must map to a retention class before audit_events writes are enabled.",
      },
      {
        id: "tamper-resistant-storage",
        title: "Tamper-resistant storage",
        required_before_enablement:
          "Audit storage must be append-only or otherwise tamper-evident for private beta.",
      },
      {
        id: "owner-audit-export",
        title: "Owner audit export",
        required_before_enablement:
          "Workspace owners need an audit export path that excludes raw research payloads and secrets.",
      },
    ],
  };
}

export function buildAuditEventsRequestFields(): AuditEventsApiField[] {
  return AUDIT_EVENTS_ALLOWED_REQUEST_FIELDS;
}

export function buildAuditEventsForbiddenFields(): AuditEventsApiField[] {
  return AUDIT_EVENTS_FORBIDDEN_REQUEST_FIELDS;
}

export function buildAuditEventsResponseFields(): AuditEventsApiField[] {
  return AUDIT_EVENTS_ALLOWED_RESPONSE_FIELDS;
}

export function buildAuditEventsForbiddenResponseFields(): AuditEventsApiField[] {
  return AUDIT_EVENTS_FORBIDDEN_RESPONSE_FIELDS;
}

export function buildAuditEventsValidatorReport(): AuditEventsApiValidatorReport {
  const fixtures: AuditEventsApiValidatorFixture[] = [
    fixture(
      "metadata-sync-event",
      "accepted",
      false,
      "Workspace, actor, device, event type, resource id, counts, hashes, permission decision, and retention metadata are allowed in the future schema."
    ),
    fixture(
      "high-risk-confirmation-event",
      "accepted",
      false,
      "Restore, AI, external asset, bulk import, file sync, and sharing actions may link typed confirmation receipt ids after auth is implemented."
    ),
    fixture(
      "page-text-blocked",
      "rejected",
      true,
      "page_body_text, block_text, comment_body, and database_cell_values are forbidden because they can contain private research content."
    ),
    fixture(
      "file-backup-bytes-blocked",
      "rejected",
      true,
      "file_bytes and backup_payload are forbidden because audit rows must not store private files or backup packages."
    ),
    fixture(
      "ai-payload-blocked",
      "rejected",
      true,
      "prompt_text and model_raw_output are forbidden unless a separate reviewed storage policy explicitly allows them."
    ),
    fixture(
      "secret-url-blocked",
      "rejected",
      true,
      "token, cookie, password, secret_values, signed URLs, public URLs, environment values, and local file paths are forbidden."
    ),
  ];

  return {
    format: "zhinote-audit-events-api-validator-fixtures",
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
    },
    fixtures,
  };
}

function allowed(field: string, reason: string): AuditEventsApiField {
  return { field, status: "allowed", reason };
}

function forbidden(field: string, reason: string): AuditEventsApiField {
  return { field, status: "forbidden", reason };
}

function fixture(
  id: string,
  status: AuditEventsApiValidationStatus,
  containsForbiddenPayload: boolean,
  reason: string
): AuditEventsApiValidatorFixture {
  return {
    id,
    expected_status: status,
    actual_status: status,
    contains_forbidden_payload: containsForbiddenPayload,
    reason,
  };
}
