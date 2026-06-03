import type { AuditEventEnvelopeContract } from "@/lib/security/auditEventEnvelope";
import type { PermissionDecisionReport } from "@/lib/security/permissionDecision";
import type {
  PermissionActionId,
  PermissionResourceId,
  PermissionRoleId,
} from "@/lib/security/permissionPolicy";
import type { LocalWorkspaceIdentity } from "@/lib/sync/workspaceIdentity";

export type PermissionCheckEnvelopeStatus =
  | "planned"
  | "manual-confirmation"
  | "blocked";

export interface PermissionCheckEnvelopeInput {
  workspaceIdentity: LocalWorkspaceIdentity | null;
  permissionDecisionReport: PermissionDecisionReport;
  auditEventEnvelope: AuditEventEnvelopeContract;
}

export interface PermissionCheckField {
  field: string;
  status: "allowed" | "forbidden";
  value_shape: string;
  purpose: string;
}

export interface PermissionCheckScenario {
  id: string;
  title: string;
  status: PermissionCheckEnvelopeStatus;
  role_id: PermissionRoleId;
  resource_id: PermissionResourceId;
  action_id: PermissionActionId;
  required_confirmation: boolean;
  expected_decision: "allow-after-confirmation" | "deny" | "allow-read-only";
  required_evidence: string;
}

export interface PermissionCheckGate {
  id: string;
  title: string;
  status: PermissionCheckEnvelopeStatus;
  evidence: string;
  required_action: string;
}

export interface PermissionCheckEnvelopeContract {
  format: "zhinote-permission-check-envelope-contract";
  format_version: 1;
  contract_status: "local-permission-envelope-only";
  can_export_permission_envelope_now: true;
  can_enforce_permissions_now: false;
  can_read_request_body_now: false;
  can_create_users_now: false;
  can_grant_access_now: false;
  can_revoke_access_now: false;
  can_write_server_audit_log_now: false;
  can_upload_workspace_data_now: false;
  disabled_endpoint: "/api/permissions/check";
  privacy_note: string;
  boundary: {
    local_contract_only: true;
    endpoint_disabled: true;
    metadata_only_request: true;
    reads_request_body: false;
    creates_users: false;
    grants_access: false;
    revokes_access: false;
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_comment_bodies: false;
    reads_file_bytes: false;
    reads_prompt_text: false;
    reads_secret_values: false;
    exposes_secret_values: false;
    writes_server_audit_log: false;
    writes_workspace_data: false;
    uploads_workspace_data: false;
    requires_authenticated_actor: true;
    requires_workspace_membership: true;
    requires_role_membership_lookup: true;
    requires_high_risk_confirmation: true;
    requires_audit_event_envelope: true;
  };
  local_evidence: {
    workspace_id: string | null;
    cloud_workspace_id: string | null;
    cloud_status: LocalWorkspaceIdentity["cloud_status"] | "missing";
    permission_matrix_decisions: number;
    high_risk_scenarios: number;
    decisions_needing_confirmation: number;
    local_denied_decisions: number;
    audit_allowed_fields: number;
    audit_forbidden_fields: number;
  };
  summary: {
    request_allowed_fields: number;
    response_allowed_fields: number;
    forbidden_fields: number;
    scenarios: number;
    gates: number;
    blocked: number;
    manual_confirmation: number;
    planned: number;
  };
  request_fields: PermissionCheckField[];
  response_fields: PermissionCheckField[];
  forbidden_fields: PermissionCheckField[];
  scenarios: PermissionCheckScenario[];
  gates: PermissionCheckGate[];
  final_enablement_requirements: string[];
}

export function buildPermissionCheckEnvelopeContract(
  input: PermissionCheckEnvelopeInput
): PermissionCheckEnvelopeContract {
  const requestFields = buildRequestFields();
  const responseFields = buildResponseFields();
  const forbiddenFields = buildForbiddenFields();
  const scenarios = buildScenarios();
  const gates = buildGates(input);
  const statuses = [
    ...scenarios.map((scenario) => scenario.status),
    ...gates.map((gate) => gate.status),
  ];

  return {
    format: "zhinote-permission-check-envelope-contract",
    format_version: 1,
    contract_status: "local-permission-envelope-only",
    can_export_permission_envelope_now: true,
    can_enforce_permissions_now: false,
    can_read_request_body_now: false,
    can_create_users_now: false,
    can_grant_access_now: false,
    can_revoke_access_now: false,
    can_write_server_audit_log_now: false,
    can_upload_workspace_data_now: false,
    disabled_endpoint: "/api/permissions/check",
    privacy_note:
      "Generated locally. This permission check envelope defines metadata-only request and response fields before /api/permissions/check can enforce server permissions. It does not read request bodies, create users, grant access, revoke access, read page text, database values, comment bodies, file bytes, prompt text, tokens, cookies, signed URLs, secret values, write audit logs, write workspace data, or upload workspace data.",
    boundary: {
      local_contract_only: true,
      endpoint_disabled: true,
      metadata_only_request: true,
      reads_request_body: false,
      creates_users: false,
      grants_access: false,
      revokes_access: false,
      reads_page_body_text: false,
      reads_database_row_values: false,
      reads_comment_bodies: false,
      reads_file_bytes: false,
      reads_prompt_text: false,
      reads_secret_values: false,
      exposes_secret_values: false,
      writes_server_audit_log: false,
      writes_workspace_data: false,
      uploads_workspace_data: false,
      requires_authenticated_actor: true,
      requires_workspace_membership: true,
      requires_role_membership_lookup: true,
      requires_high_risk_confirmation: true,
      requires_audit_event_envelope: true,
    },
    local_evidence: {
      workspace_id: input.workspaceIdentity?.workspace_id ?? null,
      cloud_workspace_id: input.workspaceIdentity?.cloud_workspace_id ?? null,
      cloud_status: input.workspaceIdentity?.cloud_status ?? "missing",
      permission_matrix_decisions:
        input.permissionDecisionReport.summary.matrix_decisions,
      high_risk_scenarios:
        input.permissionDecisionReport.summary.high_risk_scenarios,
      decisions_needing_confirmation:
        input.permissionDecisionReport.summary.needs_confirmation,
      local_denied_decisions:
        input.permissionDecisionReport.summary.local_denied,
      audit_allowed_fields: input.auditEventEnvelope.summary.allowed_fields,
      audit_forbidden_fields: input.auditEventEnvelope.summary.forbidden_fields,
    },
    summary: {
      request_allowed_fields: requestFields.length,
      response_allowed_fields: responseFields.length,
      forbidden_fields: forbiddenFields.length,
      scenarios: scenarios.length,
      gates: gates.length,
      blocked: statuses.filter((status) => status === "blocked").length,
      manual_confirmation: statuses.filter(
        (status) => status === "manual-confirmation"
      ).length,
      planned: statuses.filter((status) => status === "planned").length,
    },
    request_fields: requestFields,
    response_fields: responseFields,
    forbidden_fields: forbiddenFields,
    scenarios,
    gates,
    final_enablement_requirements: [
      "Permission checks require authenticated actor identity and workspace membership.",
      "The endpoint must validate role, resource, action, risk class, and confirmation receipt ids before any high-risk action executes.",
      "Permission requests must stay metadata-only and reject page text, database values, comments, file bytes, prompt text, secrets, signed URLs, and raw request bodies.",
      "Every allow or deny result must be linked to a metadata-only audit event envelope before the action is executed.",
      "Server enforcement stays disabled until integration tests prove Owner, Researcher, and Viewer decisions are rejected on the server when invalid.",
    ],
  };
}

function buildRequestFields(): PermissionCheckField[] {
  return [
    field("request_id", "allowed", "opaque id", "Deduplicates one permission check request."),
    field("workspace_id", "allowed", "workspace uuid", "Scopes the check to one cloud workspace."),
    field("actor_user_id", "allowed", "authenticated user uuid", "Identifies the actor requesting the action."),
    field("actor_role_id", "allowed", "owner | researcher | viewer", "Supplies the role to validate against server membership."),
    field("resource_type", "allowed", "pages | databases | files | reports | portfolio | ai | sync", "Identifies the resource family."),
    field("resource_id", "allowed", "opaque id or null", "Identifies the target without storing content."),
    field("action_id", "allowed", "view | edit | export | sync | ai | share | admin", "Identifies the requested action."),
    field("risk_action_id", "allowed", "cloud-sync | backup-restore | ai-execution | external-assets | sharing | bulk-delete | broker-import | null", "Marks high-risk actions."),
    field("confirmation_receipt_id", "allowed", "receipt id or null", "Links visible owner confirmation for high-risk actions."),
    field("audit_event_envelope_id", "allowed", "audit envelope id or null", "Links the check to metadata-only audit evidence."),
    field("idempotency_key", "allowed", "short opaque string", "Prevents duplicate high-risk execution after retries."),
    field("created_at", "allowed", "client timestamp", "Supports expiry checks before server trust."),
  ];
}

function buildResponseFields(): PermissionCheckField[] {
  return [
    field("decision_id", "allowed", "server-generated id", "Identifies one server decision."),
    field("allowed", "allowed", "boolean", "Primary decision result."),
    field("decision_status", "allowed", "allowed | denied | needs-confirmation | blocked", "Explains whether the action can proceed."),
    field("reason_code", "allowed", "normalized enum", "Machine-readable reason without private content."),
    field("required_confirmation", "allowed", "boolean", "Shows whether a visible confirmation is still needed."),
    field("required_audit_event", "allowed", "boolean", "Shows whether audit evidence must be attached."),
    field("expires_at", "allowed", "server timestamp", "Prevents stale permission decisions."),
    field("redaction_profile", "allowed", "metadata-only", "Confirms no private payload was used."),
  ];
}

function buildForbiddenFields(): PermissionCheckField[] {
  return [
    field("page_body_text", "forbidden", "raw text", "Permission checks must not inspect note content."),
    field("block_text", "forbidden", "raw text", "Block text is private workspace content."),
    field("database_cell_values", "forbidden", "raw values", "Permission checks use resource ids, not row values."),
    field("comment_body", "forbidden", "raw text", "Comments may contain private research discussion."),
    field("file_bytes", "forbidden", "binary payload", "File content belongs in storage, not permission checks."),
    field("backup_payload", "forbidden", "JSON or ZIP payload", "Restore scope should be count-only before permission checks."),
    field("prompt_text", "forbidden", "raw prompt", "AI prompts may contain private research context."),
    field("model_raw_output", "forbidden", "raw AI output", "AI output review is separate from permission checks."),
    field("token", "forbidden", "secret", "Tokens must never be permission payloads."),
    field("cookie", "forbidden", "secret", "Cookies must never be permission payloads."),
    field("password", "forbidden", "secret", "Passwords must never be permission payloads."),
    field("signed_download_url", "forbidden", "secret URL", "Signed URLs are credentials."),
    field("raw_request_body", "forbidden", "unredacted JSON", "The route must validate a schema, not store raw payloads."),
    field("environment_value", "forbidden", "secret or config value", "Environment values must not be exposed."),
  ];
}

function buildScenarios(): PermissionCheckScenario[] {
  return [
    scenario("owner-cloud-sync-check", "Owner cloud sync check", "manual-confirmation", "owner", "sync", "sync", true, "allow-after-confirmation", "Owner role, cloud-sync risk id, payload preview, confirmation receipt, and audit envelope are required."),
    scenario("researcher-cloud-sync-deny", "Researcher cloud sync denied", "blocked", "researcher", "sync", "sync", true, "deny", "Researcher can view/export sync metadata locally, but cannot start cloud sync."),
    scenario("viewer-page-export-check", "Viewer page export check", "planned", "viewer", "pages", "export", false, "allow-read-only", "Viewer can export page metadata after server membership and audit envelope pass."),
    scenario("viewer-ai-run-deny", "Viewer AI execution denied", "blocked", "viewer", "ai", "ai", true, "deny", "Viewer can view AI surfaces but cannot send selected context to an AI provider."),
    scenario("researcher-ai-run-check", "Researcher AI execution check", "manual-confirmation", "researcher", "ai", "ai", true, "allow-after-confirmation", "Researcher AI execution requires payload preview, provider/retention review, permission check, and audit envelope."),
    scenario("owner-permission-admin-check", "Owner permission admin check", "manual-confirmation", "owner", "sync", "admin", true, "allow-after-confirmation", "Owner can change permission policy only after visible confirmation and audit envelope."),
  ];
}

function buildGates(
  input: PermissionCheckEnvelopeInput
): PermissionCheckGate[] {
  return [
    gate(
      "endpoint-disabled",
      "Permission endpoint disabled",
      "blocked",
      "/api/permissions/check currently returns a disabled Web Beta stub and does not read request bodies.",
      "Keep the endpoint disabled until auth, membership, schema validation, audit envelope, and test coverage exist."
    ),
    gate(
      "authenticated-actor",
      "Authenticated actor required",
      input.workspaceIdentity?.cloud_workspace_id ? "manual-confirmation" : "blocked",
      input.workspaceIdentity?.cloud_workspace_id
        ? `Local workspace is linked to cloud workspace ${input.workspaceIdentity.cloud_workspace_id}, but server actor identity is still disabled.`
        : "No cloud workspace membership proof is available.",
      "Implement account login and server session identity before permission checks can be trusted."
    ),
    gate(
      "role-membership-lookup",
      "Role membership lookup",
      "blocked",
      `${input.permissionDecisionReport.summary.matrix_decisions} local role/resource/action decisions exist, but no server membership lookup exists.`,
      "Load role membership server-side before trusting any requested actor_role_id."
    ),
    gate(
      "high-risk-confirmation",
      "High-risk confirmation",
      input.permissionDecisionReport.summary.needs_confirmation > 0
        ? "manual-confirmation"
        : "planned",
      `${input.permissionDecisionReport.summary.needs_confirmation} local decisions need visible confirmation.`,
      "Require confirmation receipts for cloud sync, restore, AI execution, external assets, sharing, bulk delete, and broker import."
    ),
    gate(
      "audit-envelope-before-result",
      "Audit envelope before result",
      input.auditEventEnvelope.summary.blocked > 0 ? "blocked" : "planned",
      `Audit envelope has ${input.auditEventEnvelope.summary.allowed_fields} allowed fields and ${input.auditEventEnvelope.summary.forbidden_fields} forbidden fields; writes remain disabled.`,
      "Attach metadata-only audit event envelope before returning an executable allow result."
    ),
  ];
}

function field(
  fieldName: string,
  status: PermissionCheckField["status"],
  valueShape: string,
  purpose: string
): PermissionCheckField {
  return {
    field: fieldName,
    status,
    value_shape: valueShape,
    purpose,
  };
}

function scenario(
  id: string,
  title: string,
  status: PermissionCheckEnvelopeStatus,
  roleId: PermissionRoleId,
  resourceId: PermissionResourceId,
  actionId: PermissionActionId,
  requiredConfirmation: boolean,
  expectedDecision: PermissionCheckScenario["expected_decision"],
  requiredEvidence: string
): PermissionCheckScenario {
  return {
    id,
    title,
    status,
    role_id: roleId,
    resource_id: resourceId,
    action_id: actionId,
    required_confirmation: requiredConfirmation,
    expected_decision: expectedDecision,
    required_evidence: requiredEvidence,
  };
}

function gate(
  id: string,
  title: string,
  status: PermissionCheckEnvelopeStatus,
  evidence: string,
  requiredAction: string
): PermissionCheckGate {
  return {
    id,
    title,
    status,
    evidence,
    required_action: requiredAction,
  };
}
