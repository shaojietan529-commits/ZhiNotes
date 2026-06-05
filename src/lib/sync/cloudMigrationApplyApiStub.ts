import {
  buildWebBetaApiStubResponse,
  type WebBetaApiStubResponse,
} from "@/lib/sync/webBetaApiStubs";

export type CloudMigrationApplyApiFieldStatus = "allowed" | "forbidden";
export type CloudMigrationApplyApiValidationStatus = "accepted" | "rejected";

export interface CloudMigrationApplyApiField {
  field: string;
  status: CloudMigrationApplyApiFieldStatus;
  reason: string;
}

export interface CloudMigrationApplyApiValidatorFixture {
  id: string;
  expected_status: CloudMigrationApplyApiValidationStatus;
  actual_status: CloudMigrationApplyApiValidationStatus;
  contains_forbidden_payload: boolean;
  forbidden_field_names: string[];
  reason: string;
}

export interface CloudMigrationApplyApiValidatorReport {
  format: "zhinote-cloud-migration-apply-api-validator-fixtures";
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
  fixtures: CloudMigrationApplyApiValidatorFixture[];
}

export interface CloudMigrationApplyApiDisabledResponse {
  format: "zhinote-cloud-migration-apply-api-disabled";
  format_version: 1;
  api_id: "cloud-migration-apply";
  path: "/api/cloud/migrations/apply";
  method: "POST";
  stub_status: "disabled-local-stub";
  can_apply_migration_now: false;
  can_read_request_body_now: false;
  can_read_sql_payload_now: false;
  can_connect_database_now: false;
  can_write_server_data_now: false;
  can_create_cloud_resources_now: false;
  can_read_secret_values_now: false;
  privacy_note: string;
  base_stub: WebBetaApiStubResponse;
  boundary: {
    no_request_argument: true;
    endpoint_disabled: true;
    reads_request_body: false;
    reads_sql_payload: false;
    accepts_migration_sql: false;
    applies_migration: false;
    connects_database: false;
    creates_cloud_resources: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_file_bytes: false;
    reads_backup_payload: false;
    reads_secret_values: false;
    returns_database_url: false;
    returns_service_role_key: false;
    requires_owner_approval_before_enablement: true;
    requires_disposable_replay_before_enablement: true;
    requires_down_migration_before_enablement: true;
    requires_rls_proof_before_enablement: true;
    requires_backup_snapshot_before_enablement: true;
    requires_migration_lock_before_enablement: true;
    requires_audit_event_before_enablement: true;
    requires_deployment_gate_before_enablement: true;
  };
  request_schema: {
    schema_status: "planned-metadata-only";
    allowed_fields: CloudMigrationApplyApiField[];
    forbidden_fields: CloudMigrationApplyApiField[];
  };
  response_schema: {
    schema_status: "planned-migration-receipt-only";
    allowed_fields: CloudMigrationApplyApiField[];
    forbidden_fields: CloudMigrationApplyApiField[];
  };
  local_validator_report: CloudMigrationApplyApiValidatorReport;
  disabled_response_contract: {
    http_status: 501;
    returns_migration_receipt: false;
    returns_applied_sql: false;
    returns_database_credentials: false;
    applies_migration: false;
    writes_server_data: false;
    creates_cloud_resources: false;
    returns_required_approval: true;
  };
  enablement_gates: Array<{
    id: string;
    title: string;
    required_before_enablement: string;
  }>;
}

const CLOUD_MIGRATION_ALLOWED_REQUEST_FIELDS: CloudMigrationApplyApiField[] = [
  allowed("workspace_id", "Cloud workspace boundary after authenticated membership."),
  allowed("actor_user_id", "Authenticated owner actor id."),
  allowed("deployment_environment", "Reviewed environment name such as disposable, staging, or beta."),
  allowed("migration_plan_id", "Opaque id for the reviewed local migration plan."),
  allowed("migration_sql_draft_id", "Opaque id for the reviewed SQL draft."),
  allowed("disposable_replay_receipt_id", "Proof that migration replay ran on disposable data."),
  allowed("down_migration_receipt_id", "Proof that rollback/down migration behavior exists."),
  allowed("rls_proof_id", "Proof that RLS and workspace isolation were checked."),
  allowed("backup_snapshot_id", "Fresh backup snapshot id before migration apply."),
  allowed("owner_approval_receipt_id", "Typed owner approval receipt for migration apply."),
  allowed("audit_event_envelope_id", "Metadata-only audit envelope reference."),
  allowed("migration_lock_id", "Server-side lock id to prevent concurrent migration apply."),
  allowed("idempotency_key", "Prevents duplicate migration apply after retries."),
  allowed("created_at", "Client timestamp for expiry checks only."),
];

const CLOUD_MIGRATION_FORBIDDEN_REQUEST_FIELDS: CloudMigrationApplyApiField[] = [
  forbidden("migration_sql", "Raw SQL must not be posted to the disabled apply route."),
  forbidden("down_migration_sql", "Rollback SQL must not be posted to the disabled apply route."),
  forbidden("sql_payload", "SQL payloads require reviewed migration storage, not route payloads."),
  forbidden("raw_request_body", "Raw migration request retention is forbidden."),
  forbidden("database_url", "Database URLs must never be included in request payloads."),
  forbidden("service_role_key", "Service role keys must never be included in request payloads."),
  forbidden("supabase_anon_key", "Supabase keys must stay in configured secret storage."),
  forbidden("token", "Tokens must never be included in migration apply requests."),
  forbidden("cookie", "Cookies must never be included in migration apply requests."),
  forbidden("password", "Passwords must never be included in migration apply requests."),
  forbidden("secret_values", "Secret values and connection strings must never be included."),
  forbidden("page_body_text", "Workspace content must not be part of migration apply."),
  forbidden("database_cell_values", "Database values must not be part of migration apply."),
  forbidden("file_bytes", "Files must not be uploaded through migration apply."),
  forbidden("backup_payload", "Backups must not be uploaded through migration apply."),
  forbidden("apply_now", "Apply flags cannot bypass owner approval and replay proof."),
  forbidden("force_apply", "Force apply flags are forbidden."),
  forbidden("drop_tables", "Destructive table drops require dedicated rollback proof and review."),
  forbidden("disable_rls", "RLS disabling must not be accepted from request payloads."),
  forbidden("create_cloud_project", "Cloud project creation is out of scope for migration apply."),
];

const CLOUD_MIGRATION_ALLOWED_RESPONSE_FIELDS: CloudMigrationApplyApiField[] = [
  allowed("format", "Stable disabled response format."),
  allowed("api_id", "Identifies the disabled migration apply API."),
  allowed("stub_status", "Confirms the route is not active."),
  allowed("decision_status", "Future response may say disabled, denied, requires-approval, or applied."),
  allowed("migration_receipt_id", "Future receipt id only after migrations are enabled."),
  allowed("applied_migration_ids", "Future ids only, not raw SQL."),
  allowed("required_gates", "Gate ids that block migration apply."),
  allowed("reason_codes", "Machine-readable refusal reasons."),
];

const CLOUD_MIGRATION_FORBIDDEN_RESPONSE_FIELDS: CloudMigrationApplyApiField[] = [
  forbidden("migration_sql", "Migration responses must not return raw SQL."),
  forbidden("down_migration_sql", "Migration responses must not return rollback SQL."),
  forbidden("database_url", "Migration responses must never return database URLs."),
  forbidden("service_role_key", "Migration responses must never return service role keys."),
  forbidden("secret_values", "Migration responses must never return secrets."),
  forbidden("raw_request_body", "Migration responses must never return raw request payloads."),
  forbidden("page_body_text", "Migration responses must never return page text."),
  forbidden("database_cell_values", "Migration responses must never return database values."),
  forbidden("file_bytes", "Migration responses must never return file bytes."),
  forbidden("backup_payload", "Migration responses must never return backup payloads."),
];

export function buildCloudMigrationApplyApiDisabledResponse(): CloudMigrationApplyApiDisabledResponse {
  return {
    format: "zhinote-cloud-migration-apply-api-disabled",
    format_version: 1,
    api_id: "cloud-migration-apply",
    path: "/api/cloud/migrations/apply",
    method: "POST",
    stub_status: "disabled-local-stub",
    can_apply_migration_now: false,
    can_read_request_body_now: false,
    can_read_sql_payload_now: false,
    can_connect_database_now: false,
    can_write_server_data_now: false,
    can_create_cloud_resources_now: false,
    can_read_secret_values_now: false,
    privacy_note:
      "This route is intentionally disabled. It does not read request bodies, read SQL payloads, connect databases, apply migrations, write server data, create cloud resources, read secrets, upload workspace data, or return database credentials.",
    base_stub: buildWebBetaApiStubResponse("cloud-migration-apply"),
    boundary: {
      no_request_argument: true,
      endpoint_disabled: true,
      reads_request_body: false,
      reads_sql_payload: false,
      accepts_migration_sql: false,
      applies_migration: false,
      connects_database: false,
      creates_cloud_resources: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      reads_page_body_text: false,
      reads_database_row_values: false,
      reads_file_bytes: false,
      reads_backup_payload: false,
      reads_secret_values: false,
      returns_database_url: false,
      returns_service_role_key: false,
      requires_owner_approval_before_enablement: true,
      requires_disposable_replay_before_enablement: true,
      requires_down_migration_before_enablement: true,
      requires_rls_proof_before_enablement: true,
      requires_backup_snapshot_before_enablement: true,
      requires_migration_lock_before_enablement: true,
      requires_audit_event_before_enablement: true,
      requires_deployment_gate_before_enablement: true,
    },
    request_schema: {
      schema_status: "planned-metadata-only",
      allowed_fields: buildCloudMigrationApplyRequestFields(),
      forbidden_fields: buildCloudMigrationApplyForbiddenFields(),
    },
    response_schema: {
      schema_status: "planned-migration-receipt-only",
      allowed_fields: buildCloudMigrationApplyResponseFields(),
      forbidden_fields: buildCloudMigrationApplyForbiddenResponseFields(),
    },
    local_validator_report: buildCloudMigrationApplyValidatorReport(),
    disabled_response_contract: {
      http_status: 501,
      returns_migration_receipt: false,
      returns_applied_sql: false,
      returns_database_credentials: false,
      applies_migration: false,
      writes_server_data: false,
      creates_cloud_resources: false,
      returns_required_approval: true,
    },
    enablement_gates: [
      {
        id: "owner-approval",
        title: "Owner approval",
        required_before_enablement:
          "Migration apply needs explicit owner approval with target environment and rollback copy.",
      },
      {
        id: "disposable-replay",
        title: "Disposable replay",
        required_before_enablement:
          "The migration must pass on disposable beta data before any staging/beta apply.",
      },
      {
        id: "down-migration",
        title: "Down migration",
        required_before_enablement:
          "Rollback/down migration behavior must be proven before apply can be enabled.",
      },
      {
        id: "rls-proof",
        title: "RLS proof",
        required_before_enablement:
          "Workspace isolation and row-level security must be verified after migration replay.",
      },
      {
        id: "backup-snapshot",
        title: "Backup snapshot",
        required_before_enablement:
          "A fresh backup snapshot is required before migration apply.",
      },
      {
        id: "migration-lock",
        title: "Migration lock",
        required_before_enablement:
          "Only one migration apply may run at a time, protected by a durable lock.",
      },
      {
        id: "audit-event",
        title: "Audit event",
        required_before_enablement:
          "Migration apply must link to metadata-only audit events before and after execution.",
      },
      {
        id: "deployment-gate",
        title: "Deployment gate",
        required_before_enablement:
          "Preview deployment, environment preflight, rollback owner, and incident path must pass.",
      },
    ],
  };
}

export function buildCloudMigrationApplyRequestFields(): CloudMigrationApplyApiField[] {
  return CLOUD_MIGRATION_ALLOWED_REQUEST_FIELDS.map((field) => ({ ...field }));
}

export function buildCloudMigrationApplyForbiddenFields(): CloudMigrationApplyApiField[] {
  return CLOUD_MIGRATION_FORBIDDEN_REQUEST_FIELDS.map((field) => ({ ...field }));
}

export function buildCloudMigrationApplyResponseFields(): CloudMigrationApplyApiField[] {
  return CLOUD_MIGRATION_ALLOWED_RESPONSE_FIELDS.map((field) => ({ ...field }));
}

export function buildCloudMigrationApplyForbiddenResponseFields(): CloudMigrationApplyApiField[] {
  return CLOUD_MIGRATION_FORBIDDEN_RESPONSE_FIELDS.map((field) => ({ ...field }));
}

export function buildCloudMigrationApplyValidatorReport(): CloudMigrationApplyApiValidatorReport {
  const fixtures: CloudMigrationApplyApiValidatorFixture[] = [
    {
      id: "metadata-cloud-migration-apply-request",
      expected_status: "accepted",
      actual_status: "accepted",
      contains_forbidden_payload: false,
      forbidden_field_names: [],
      reason:
        "Contains only metadata needed to describe a future reviewed migration apply request.",
    },
    {
      id: "sql-payload-blocked",
      expected_status: "rejected",
      actual_status: "rejected",
      contains_forbidden_payload: true,
      forbidden_field_names: [
        "migration_sql",
        "down_migration_sql",
        "sql_payload",
        "raw_request_body",
      ],
      reason:
        "Raw SQL and retained raw request bodies are blocked from the disabled migration apply API.",
    },
    {
      id: "credential-fields-blocked",
      expected_status: "rejected",
      actual_status: "rejected",
      contains_forbidden_payload: true,
      forbidden_field_names: [
        "database_url",
        "service_role_key",
        "supabase_anon_key",
        "token",
        "cookie",
        "password",
        "secret_values",
      ],
      reason:
        "Database credentials, tokens, cookies, passwords, and secrets are rejected.",
    },
    {
      id: "workspace-content-blocked",
      expected_status: "rejected",
      actual_status: "rejected",
      contains_forbidden_payload: true,
      forbidden_field_names: [
        "page_body_text",
        "database_cell_values",
        "file_bytes",
        "backup_payload",
      ],
      reason:
        "Workspace content and backup packages do not belong in migration apply payloads.",
    },
    {
      id: "destructive-flags-blocked",
      expected_status: "rejected",
      actual_status: "rejected",
      contains_forbidden_payload: true,
      forbidden_field_names: [
        "apply_now",
        "force_apply",
        "drop_tables",
        "disable_rls",
        "create_cloud_project",
      ],
      reason:
        "Migration apply cannot be enabled, forced, made destructive, or used to create cloud projects from request payloads.",
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
    format: "zhinote-cloud-migration-apply-api-validator-fixtures",
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

function allowed(field: string, reason: string): CloudMigrationApplyApiField {
  return {
    field,
    status: "allowed",
    reason,
  };
}

function forbidden(field: string, reason: string): CloudMigrationApplyApiField {
  return {
    field,
    status: "forbidden",
    reason,
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
