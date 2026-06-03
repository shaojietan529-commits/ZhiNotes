import type {
  AuditTrailCategory,
  AuditTrailPolicy,
  AuditTrailStatus,
} from "@/lib/security/auditTrailPolicy";
import type { PermissionDecisionReport } from "@/lib/security/permissionDecision";
import type { SyncLogSummary } from "@/lib/db/local/queries";
import type { LocalWorkspaceIdentity } from "@/lib/sync/workspaceIdentity";

export type AuditEventEnvelopeStatus = AuditTrailStatus;

export interface AuditEventEnvelopeInput {
  workspaceIdentity: LocalWorkspaceIdentity | null;
  auditTrailPolicy: AuditTrailPolicy;
  permissionDecisionReport: PermissionDecisionReport | null;
  syncSummary: SyncLogSummary | null;
}

export interface AuditEventEnvelopeField {
  field: string;
  status: "allowed" | "forbidden";
  value_shape: string;
  rationale: string;
}

export interface AuditEventRedactionCheck {
  id: string;
  title: string;
  status: AuditEventEnvelopeStatus;
  evidence: string;
  failure_condition: string;
}

export interface AuditEventEnvelopeTemplate {
  id: string;
  category: AuditTrailCategory;
  title: string;
  status: AuditEventEnvelopeStatus;
  trigger: string;
  allowed_metadata: string[];
  forbidden_payloads: string[];
  endpoint_status: "disabled-stub";
}

export interface AuditEventEnvelopeGate {
  id: string;
  title: string;
  status: AuditEventEnvelopeStatus;
  evidence: string;
  required_action: string;
}

export interface AuditEventEnvelopeContract {
  format: "zhinote-audit-event-envelope-contract";
  format_version: 1;
  contract_status: "local-redaction-envelope-only";
  can_export_envelope_now: true;
  can_record_server_audit_event_now: false;
  can_read_request_body_now: false;
  can_write_audit_events_table_now: false;
  can_upload_workspace_data_now: false;
  disabled_endpoint: "/api/audit/events";
  privacy_note: string;
  boundary: {
    local_contract_only: true;
    metadata_only_envelope: true;
    endpoint_disabled: true;
    reads_request_body: false;
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_comment_bodies: false;
    reads_file_bytes: false;
    reads_prompt_text: false;
    reads_model_raw_output: false;
    reads_secret_values: false;
    exposes_secret_values: false;
    writes_server_audit_log: false;
    writes_workspace_data: false;
    uploads_workspace_data: false;
    requires_authenticated_actor: true;
    requires_workspace_membership: true;
    requires_permission_decision: true;
    requires_redaction_before_write: true;
    requires_retention_policy: true;
  };
  local_evidence: {
    workspace_id: string | null;
    cloud_workspace_id: string | null;
    cloud_status: LocalWorkspaceIdentity["cloud_status"] | "missing";
    audit_policy_events: number;
    audit_policy_blocked_gates: number;
    permission_decisions: number;
    permission_confirmations_required: number;
    sync_log_rows: number;
    pending_sync_rows: number;
  };
  summary: {
    allowed_fields: number;
    forbidden_fields: number;
    redaction_checks: number;
    templates: number;
    gates: number;
    blocked: number;
    manual_confirmation: number;
    planned: number;
  };
  allowed_fields: AuditEventEnvelopeField[];
  forbidden_fields: AuditEventEnvelopeField[];
  redaction_checks: AuditEventRedactionCheck[];
  templates: AuditEventEnvelopeTemplate[];
  gates: AuditEventEnvelopeGate[];
  final_write_requirements: string[];
}

export function buildAuditEventEnvelopeContract(
  input: AuditEventEnvelopeInput
): AuditEventEnvelopeContract {
  const allowedFields = buildAllowedFields();
  const forbiddenFields = buildForbiddenFields();
  const redactionChecks = buildRedactionChecks(input);
  const templates = buildEnvelopeTemplates();
  const gates = buildEnvelopeGates(input);
  const statuses = [
    ...redactionChecks.map((check) => check.status),
    ...templates.map((template) => template.status),
    ...gates.map((gate) => gate.status),
  ];

  return {
    format: "zhinote-audit-event-envelope-contract",
    format_version: 1,
    contract_status: "local-redaction-envelope-only",
    can_export_envelope_now: true,
    can_record_server_audit_event_now: false,
    can_read_request_body_now: false,
    can_write_audit_events_table_now: false,
    can_upload_workspace_data_now: false,
    disabled_endpoint: "/api/audit/events",
    privacy_note:
      "Generated locally. This audit event envelope defines metadata-only audit rows before any server write path exists. It does not read request bodies, page text, database row values, comment bodies, file bytes, prompt text, model raw output, tokens, cookies, secret values, signed URLs, or connection strings; it does not write audit logs, write workspace data, or upload workspace data.",
    boundary: {
      local_contract_only: true,
      metadata_only_envelope: true,
      endpoint_disabled: true,
      reads_request_body: false,
      reads_page_body_text: false,
      reads_database_row_values: false,
      reads_comment_bodies: false,
      reads_file_bytes: false,
      reads_prompt_text: false,
      reads_model_raw_output: false,
      reads_secret_values: false,
      exposes_secret_values: false,
      writes_server_audit_log: false,
      writes_workspace_data: false,
      uploads_workspace_data: false,
      requires_authenticated_actor: true,
      requires_workspace_membership: true,
      requires_permission_decision: true,
      requires_redaction_before_write: true,
      requires_retention_policy: true,
    },
    local_evidence: {
      workspace_id: input.workspaceIdentity?.workspace_id ?? null,
      cloud_workspace_id: input.workspaceIdentity?.cloud_workspace_id ?? null,
      cloud_status: input.workspaceIdentity?.cloud_status ?? "missing",
      audit_policy_events: input.auditTrailPolicy.summary.events,
      audit_policy_blocked_gates: input.auditTrailPolicy.summary.blocked,
      permission_decisions:
        input.permissionDecisionReport?.summary.matrix_decisions ?? 0,
      permission_confirmations_required:
        input.permissionDecisionReport?.summary.needs_confirmation ?? 0,
      sync_log_rows: input.syncSummary?.total ?? 0,
      pending_sync_rows: input.syncSummary?.pending ?? 0,
    },
    summary: {
      allowed_fields: allowedFields.length,
      forbidden_fields: forbiddenFields.length,
      redaction_checks: redactionChecks.length,
      templates: templates.length,
      gates: gates.length,
      blocked: statuses.filter((status) => status === "blocked").length,
      manual_confirmation: statuses.filter(
        (status) => status === "manual-confirmation"
      ).length,
      planned: statuses.filter((status) => status === "planned").length,
    },
    allowed_fields: allowedFields,
    forbidden_fields: forbiddenFields,
    redaction_checks: redactionChecks,
    templates,
    gates,
    final_write_requirements: [
      "Audit writes require authenticated actor identity and workspace membership.",
      "Every high-risk action must attach permission decision metadata before audit write.",
      "Envelope metadata must pass redaction checks before /api/audit/events can read a request body.",
      "Audit rows must store ids, counts, statuses, checksums, and retention class only by default.",
      "Audit writes remain disabled until retention, owner export, incident review, and migration rollback are proven.",
    ],
  };
}

function buildAllowedFields(): AuditEventEnvelopeField[] {
  return [
    field("event_id", "allowed", "server-generated id", "Stable id for one audit event."),
    field("workspace_id", "allowed", "workspace uuid", "Required workspace boundary."),
    field("actor_user_id", "allowed", "authenticated user uuid", "Identifies who took the action."),
    field("device_id", "allowed", "local device id", "Links action to a browser/device."),
    field("event_type", "allowed", "normalized enum", "Auth, sync, restore, AI, file, export, permission, or admin action."),
    field("resource_type", "allowed", "normalized enum", "Page, database, file, sync batch, AI run, permission, restore, or deployment gate."),
    field("resource_id", "allowed", "opaque id or null", "Identifies the target resource without storing content."),
    field("operation_status", "allowed", "started | approved | denied | failed | completed", "Supports incident review without payloads."),
    field("metadata_counts", "allowed", "small numeric map", "Stores counts such as rows, files, fields, conflicts, or pages."),
    field("metadata_hashes", "allowed", "checksum map", "Stores checksums or ids, not raw content."),
    field("changed_field_names", "allowed", "string array", "Records field names touched by sync without field values."),
    field("permission_decision_id", "allowed", "decision id or null", "Links audit row to a permission check result."),
    field("confirmation_receipt_id", "allowed", "receipt id or null", "Links audit row to explicit owner confirmation."),
    field("redaction_profile", "allowed", "metadata-only | explicit-payload-approved", "Records which privacy profile was used."),
    field("retention_class", "allowed", "short | beta | incident", "Controls retention without storing secrets."),
    field("created_at", "allowed", "server timestamp", "Orders events and supports audit export."),
  ];
}

function buildForbiddenFields(): AuditEventEnvelopeField[] {
  return [
    field("page_body_text", "forbidden", "raw text", "Research notes never belong in audit rows."),
    field("block_text", "forbidden", "raw text", "Block text is page content, not audit metadata."),
    field("database_cell_values", "forbidden", "raw values", "Database values may contain private research data."),
    field("comment_body", "forbidden", "raw text", "Comments may contain private discussion."),
    field("file_bytes", "forbidden", "binary payload", "Files stay in private storage, not audit rows."),
    field("backup_payload", "forbidden", "JSON or ZIP payload", "Backups are export artifacts, not audit metadata."),
    field("prompt_text", "forbidden", "raw prompt", "AI prompts may include private research context."),
    field("model_raw_output", "forbidden", "raw AI output", "AI outputs need separate review before storage."),
    field("token", "forbidden", "secret", "Tokens must never be logged."),
    field("cookie", "forbidden", "secret", "Cookies must never be logged."),
    field("password", "forbidden", "secret", "Passwords must never be logged."),
    field("secret_values", "forbidden", "secret", "Connection strings and keys must never be logged."),
    field("signed_download_url", "forbidden", "secret URL", "Signed URLs are credentials and must not be logged."),
    field("raw_request_body", "forbidden", "unredacted JSON", "Request bodies must be redacted before audit storage."),
    field("environment_value", "forbidden", "secret or config value", "Environment values must not be exposed."),
  ];
}

function buildRedactionChecks(
  input: AuditEventEnvelopeInput
): AuditEventRedactionCheck[] {
  return [
    check(
      "endpoint-disabled",
      "Audit endpoint disabled",
      "blocked",
      "/api/audit/events currently returns a disabled Web Beta stub and does not read request bodies.",
      "Fail if the endpoint starts accepting payloads before envelope redaction is enforced."
    ),
    check(
      "allowed-field-envelope",
      "Allowed field envelope",
      "planned",
      "Allowed fields are ids, counts, statuses, hashes, field names, retention class, and timestamps only.",
      "Fail if raw note text, file bytes, prompts, secrets, signed URLs, or backup payloads are added."
    ),
    check(
      "permission-decision-link",
      "Permission decision link",
      input.permissionDecisionReport ? "manual-confirmation" : "blocked",
      input.permissionDecisionReport
        ? `${input.permissionDecisionReport.summary.matrix_decisions} local permission decisions exist, but server checks remain disabled.`
        : "No permission decision report is attached.",
      "Fail if a writeable audit event has no permission decision for high-risk actions."
    ),
    check(
      "workspace-membership-link",
      "Workspace membership link",
      input.workspaceIdentity?.cloud_workspace_id ? "manual-confirmation" : "blocked",
      input.workspaceIdentity?.cloud_workspace_id
        ? `Local workspace is linked to cloud workspace ${input.workspaceIdentity.cloud_workspace_id}, but server membership enforcement remains disabled.`
        : "No cloud workspace membership proof is available.",
      "Fail if actor identity and workspace membership are missing."
    ),
    check(
      "retention-class-required",
      "Retention class required",
      "manual-confirmation",
      "Audit policy requires retention and owner export decisions before private beta.",
      "Fail if event rows can be written without a retention_class."
    ),
    check(
      "content-field-denylist",
      "Content field denylist",
      "planned",
      "Forbidden fields include page_body_text, database_cell_values, comment_body, file_bytes, prompt_text, model_raw_output, token, cookie, signed_download_url, raw_request_body, and environment_value.",
      "Fail if any forbidden field appears in the envelope payload."
    ),
  ];
}

function buildEnvelopeTemplates(): AuditEventEnvelopeTemplate[] {
  return [
    template("auth-session-envelope", "auth", "Auth session envelope", "blocked", "Login, logout, session refresh, or device revoke."),
    template("sync-batch-envelope", "sync", "Sync batch envelope", "blocked", "Push, pull, acknowledgement, retry, conflict, or cursor update."),
    template("restore-envelope", "restore", "Restore envelope", "manual-confirmation", "Backup export, restore preview, rollback export, or restore write-back."),
    template("ai-run-envelope", "ai", "AI execution envelope", "blocked", "AI payload approval, provider call, report generation, or output write-back."),
    template("file-storage-envelope", "files", "File storage envelope", "blocked", "Private file upload, preview, signed URL generation, or delete."),
    template("permission-envelope", "permissions", "Permission envelope", "blocked", "Role, invite, share, or resource policy change."),
    template("export-envelope", "exports", "Export envelope", "planned", "Workspace backup, readiness, policy, or report export."),
    template("admin-launch-envelope", "admin", "Admin launch envelope", "blocked", "Deployment gate review, environment check, or rollback approval."),
  ];
}

function buildEnvelopeGates(
  input: AuditEventEnvelopeInput
): AuditEventEnvelopeGate[] {
  return [
    gate(
      "api-stub-remains-disabled",
      "API stub remains disabled",
      "blocked",
      "/api/audit/events does not read event payloads or write logs.",
      "Keep the endpoint disabled until envelope redaction, auth, permissions, retention, and rollback are implemented."
    ),
    gate(
      "cloud-schema-retention",
      "Cloud schema and retention",
      input.auditTrailPolicy.summary.blocked > 0 ? "blocked" : "manual-confirmation",
      `${input.auditTrailPolicy.summary.blocked} audit policy gates remain blocked.`,
      "Create audit_events migration, retention fields, owner export rules, and rollback proof before writes."
    ),
    gate(
      "permission-before-write",
      "Permission before write",
      input.permissionDecisionReport ? "manual-confirmation" : "blocked",
      input.permissionDecisionReport
        ? `${input.permissionDecisionReport.summary.needs_confirmation} permission decisions still need confirmation.`
        : "No permission decision report is available.",
      "Attach permission decision metadata before high-risk audit events can be written."
    ),
    gate(
      "request-body-redaction",
      "Request body redaction",
      "blocked",
      "No request body parser or redaction middleware is enabled for audit events.",
      "Implement schema validation that rejects forbidden fields before the route can read a request body."
    ),
    gate(
      "sync-volume-context",
      "Sync volume context",
      "planned",
      `${input.syncSummary?.total ?? 0} local sync rows and ${input.syncSummary?.pending ?? 0} pending rows provide count-only local context.`,
      "Use count-only metadata for sync audit events; never write row payloads."
    ),
  ];
}

function field(
  fieldName: string,
  status: AuditEventEnvelopeField["status"],
  valueShape: string,
  rationale: string
): AuditEventEnvelopeField {
  return {
    field: fieldName,
    status,
    value_shape: valueShape,
    rationale,
  };
}

function check(
  id: string,
  title: string,
  status: AuditEventEnvelopeStatus,
  evidence: string,
  failureCondition: string
): AuditEventRedactionCheck {
  return {
    id,
    title,
    status,
    evidence,
    failure_condition: failureCondition,
  };
}

function template(
  id: string,
  category: AuditTrailCategory,
  title: string,
  status: AuditEventEnvelopeStatus,
  trigger: string
): AuditEventEnvelopeTemplate {
  return {
    id,
    category,
    title,
    status,
    trigger,
    allowed_metadata: [
      "event_id",
      "workspace_id",
      "actor_user_id",
      "device_id",
      "resource_type",
      "resource_id",
      "operation_status",
      "metadata_counts",
      "metadata_hashes",
      "permission_decision_id",
      "confirmation_receipt_id",
      "retention_class",
    ],
    forbidden_payloads: [
      "page_body_text",
      "database_cell_values",
      "comment_body",
      "file_bytes",
      "backup_payload",
      "prompt_text",
      "model_raw_output",
      "token",
      "cookie",
      "signed_download_url",
      "raw_request_body",
      "environment_value",
    ],
    endpoint_status: "disabled-stub",
  };
}

function gate(
  id: string,
  title: string,
  status: AuditEventEnvelopeStatus,
  evidence: string,
  requiredAction: string
): AuditEventEnvelopeGate {
  return {
    id,
    title,
    status,
    evidence,
    required_action: requiredAction,
  };
}
