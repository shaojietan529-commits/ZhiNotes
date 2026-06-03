import {
  evaluatePermissionDecision,
  type PermissionDecisionStatus,
} from "@/lib/security/permissionDecision";
import type {
  PermissionActionId,
  PermissionResourceId,
  PermissionRoleId,
} from "@/lib/security/permissionPolicy";
import {
  validatePermissionCheckMetadataRequest,
  type PermissionCheckRequestValidationStatus,
} from "@/lib/security/permissionCheckRequestValidator";

export type PermissionServerExpectedDecision =
  | "allow-read-only"
  | "allow-after-confirmation"
  | "deny"
  | "reject-request";

export type PermissionServerMatrixCaseStatus =
  | "planned"
  | "manual-confirmation"
  | "blocked";

export interface PermissionServerMatrixCase {
  id: string;
  title: string;
  case_status: PermissionServerMatrixCaseStatus;
  role_id: PermissionRoleId;
  resource_id: PermissionResourceId;
  action_id: PermissionActionId;
  risk_action_id: string | null;
  local_decision_status: PermissionDecisionStatus;
  request_validation_status: PermissionCheckRequestValidationStatus;
  expected_server_decision: PermissionServerExpectedDecision;
  expected_http_status_after_enablement: 200 | 202 | 403 | 422;
  requires_authenticated_actor: true;
  requires_workspace_membership: true;
  requires_role_membership_lookup: true;
  requires_audit_event_envelope: true;
  requires_confirmation_receipt: boolean;
  must_reject_private_payload: true;
  acceptance_criteria: string[];
}

export interface PermissionServerTestMatrix {
  format: "zhinote-server-permission-enforcement-test-matrix";
  format_version: 1;
  matrix_status: "local-server-test-contract-only";
  disabled_endpoint: "/api/permissions/check";
  can_run_server_permission_tests_now: false;
  can_enforce_permissions_now: false;
  can_read_request_body_now: false;
  can_write_server_audit_log_now: false;
  can_upload_workspace_data_now: false;
  privacy_note: string;
  boundary: {
    local_contract_only: true;
    endpoint_disabled: true;
    no_server_execution: true;
    metadata_only_request: true;
    stores_raw_request: false;
    returns_raw_values: false;
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_comment_bodies: false;
    reads_file_bytes: false;
    reads_prompt_text: false;
    reads_secret_values: false;
    writes_server_audit_log: false;
    uploads_workspace_data: false;
  };
  summary: {
    cases: number;
    allow_read_only: number;
    allow_after_confirmation: number;
    denied: number;
    rejected_request: number;
    blocked: number;
    manual_confirmation: number;
    planned: number;
  };
  cases: PermissionServerMatrixCase[];
  server_enablement_requirements: string[];
}

export function buildPermissionServerTestMatrix(): PermissionServerTestMatrix {
  const cases = buildServerMatrixCases();

  return {
    format: "zhinote-server-permission-enforcement-test-matrix",
    format_version: 1,
    matrix_status: "local-server-test-contract-only",
    disabled_endpoint: "/api/permissions/check",
    can_run_server_permission_tests_now: false,
    can_enforce_permissions_now: false,
    can_read_request_body_now: false,
    can_write_server_audit_log_now: false,
    can_upload_workspace_data_now: false,
    privacy_note:
      "Generated locally. This matrix defines future server-side permission enforcement tests only; it does not run server tests, enforce permissions, read request bodies, read page text, read database values, read files, read prompts, read secrets, write audit logs, upload data, or return executable allow decisions.",
    boundary: {
      local_contract_only: true,
      endpoint_disabled: true,
      no_server_execution: true,
      metadata_only_request: true,
      stores_raw_request: false,
      returns_raw_values: false,
      reads_page_body_text: false,
      reads_database_row_values: false,
      reads_comment_bodies: false,
      reads_file_bytes: false,
      reads_prompt_text: false,
      reads_secret_values: false,
      writes_server_audit_log: false,
      uploads_workspace_data: false,
    },
    summary: {
      cases: cases.length,
      allow_read_only: cases.filter(
        (item) => item.expected_server_decision === "allow-read-only"
      ).length,
      allow_after_confirmation: cases.filter(
        (item) => item.expected_server_decision === "allow-after-confirmation"
      ).length,
      denied: cases.filter((item) => item.expected_server_decision === "deny")
        .length,
      rejected_request: cases.filter(
        (item) => item.expected_server_decision === "reject-request"
      ).length,
      blocked: cases.filter((item) => item.case_status === "blocked").length,
      manual_confirmation: cases.filter(
        (item) => item.case_status === "manual-confirmation"
      ).length,
      planned: cases.filter((item) => item.case_status === "planned").length,
    },
    cases,
    server_enablement_requirements: [
      "Every server permission test must authenticate the actor from a server session, not from client-provided role text.",
      "Every test must load workspace membership and role server-side before trusting requested actor_role_id.",
      "Every request must pass metadata-only validation and reject page text, database values, comments, file bytes, prompts, tokens, cookies, signed URLs, and raw request bodies.",
      "Every high-risk allow result must require a visible confirmation receipt and a metadata-only audit event envelope.",
      "Every deny or reject result must be tested with Owner, Researcher, and Viewer fixtures before sync, restore, sharing, AI execution, file access, or admin actions can execute.",
    ],
  };
}

function buildServerMatrixCases(): PermissionServerMatrixCase[] {
  return [
    matrixCase({
      id: "owner-cloud-sync-confirmed",
      title: "Owner cloud sync requires confirmation",
      roleId: "owner",
      resourceId: "sync",
      actionId: "sync",
      riskActionId: "cloud-sync",
      expectedServerDecision: "allow-after-confirmation",
      expectedHttpStatus: 202,
      confirmationRequired: true,
      acceptanceCriteria: [
        "Server identifies owner from session and workspace membership.",
        "Request contains confirmation receipt and audit event envelope ids.",
        "Server returns needs-confirmation until the receipt is fresh and valid.",
      ],
    }),
    matrixCase({
      id: "researcher-cloud-sync-denied",
      title: "Researcher cloud sync is denied",
      roleId: "researcher",
      resourceId: "sync",
      actionId: "sync",
      riskActionId: "cloud-sync",
      expectedServerDecision: "deny",
      expectedHttpStatus: 403,
      confirmationRequired: false,
      acceptanceCriteria: [
        "Server denies sync even if the client sends a confirmation receipt.",
        "Server records only metadata in the audit envelope.",
        "No sync push, pull, replay, or upload starts after denial.",
      ],
    }),
    matrixCase({
      id: "viewer-export-page-read-only",
      title: "Viewer page export is read-only",
      roleId: "viewer",
      resourceId: "pages",
      actionId: "export",
      riskActionId: null,
      expectedServerDecision: "allow-read-only",
      expectedHttpStatus: 200,
      confirmationRequired: false,
      acceptanceCriteria: [
        "Server allows export metadata after membership lookup.",
        "Export path still avoids private data upload.",
        "Result is linked to a metadata-only audit event envelope.",
      ],
    }),
    matrixCase({
      id: "viewer-edit-portfolio-denied",
      title: "Viewer portfolio edits are denied",
      roleId: "viewer",
      resourceId: "portfolio",
      actionId: "edit",
      riskActionId: null,
      expectedServerDecision: "deny",
      expectedHttpStatus: 403,
      confirmationRequired: false,
      acceptanceCriteria: [
        "Server denies portfolio edits for viewer role.",
        "No portfolio row, thesis, catalyst, or position metadata is mutated.",
        "Deny result is audited without holdings or account identifiers.",
      ],
    }),
    matrixCase({
      id: "viewer-ai-run-denied",
      title: "Viewer AI execution is denied",
      roleId: "viewer",
      resourceId: "ai",
      actionId: "ai",
      riskActionId: "ai-execution",
      expectedServerDecision: "deny",
      expectedHttpStatus: 403,
      confirmationRequired: false,
      acceptanceCriteria: [
        "Server denies AI execution for viewer role.",
        "No selected context, prompt, or model payload is sent externally.",
        "Deny result is audited without prompt text or model output.",
      ],
    }),
    matrixCase({
      id: "researcher-ai-run-confirmed",
      title: "Researcher AI execution requires confirmation",
      roleId: "researcher",
      resourceId: "ai",
      actionId: "ai",
      riskActionId: "ai-execution",
      expectedServerDecision: "allow-after-confirmation",
      expectedHttpStatus: 202,
      confirmationRequired: true,
      acceptanceCriteria: [
        "Server confirms researcher role from workspace membership.",
        "Payload preview, provider, retention, confirmation receipt, and audit envelope must be present.",
        "Server does not receive prompt text through the permission check request.",
      ],
    }),
    matrixCase({
      id: "owner-admin-confirmed",
      title: "Owner permission admin requires confirmation",
      roleId: "owner",
      resourceId: "sync",
      actionId: "admin",
      riskActionId: "sharing",
      expectedServerDecision: "allow-after-confirmation",
      expectedHttpStatus: 202,
      confirmationRequired: true,
      acceptanceCriteria: [
        "Server confirms owner role from workspace membership.",
        "Permission policy changes require confirmation receipt and audit envelope.",
        "Server audit event stores old/new role metadata only.",
      ],
    }),
    rejectedPayloadCase({
      id: "page-body-payload-rejected",
      title: "Private page text payload is rejected",
      roleId: "owner",
      resourceId: "pages",
      actionId: "export",
      riskActionId: null,
      injectedField: "page_body_text",
    }),
    rejectedPayloadCase({
      id: "prompt-payload-rejected",
      title: "Private prompt payload is rejected",
      roleId: "researcher",
      resourceId: "ai",
      actionId: "ai",
      riskActionId: "ai-execution",
      injectedField: "prompt_text",
    }),
  ];
}

function matrixCase(input: {
  id: string;
  title: string;
  roleId: PermissionRoleId;
  resourceId: PermissionResourceId;
  actionId: PermissionActionId;
  riskActionId: string | null;
  expectedServerDecision: Exclude<
    PermissionServerExpectedDecision,
    "reject-request"
  >;
  expectedHttpStatus: 200 | 202 | 403;
  confirmationRequired: boolean;
  acceptanceCriteria: string[];
}): PermissionServerMatrixCase {
  const decision = evaluatePermissionDecision({
    roleId: input.roleId,
    resourceId: input.resourceId,
    actionId: input.actionId,
    riskActionId: input.riskActionId ?? undefined,
  });
  const validation = validatePermissionCheckMetadataRequest(
    metadataRequest(input)
  );

  return {
    id: input.id,
    title: input.title,
    case_status: input.confirmationRequired ? "manual-confirmation" : "planned",
    role_id: input.roleId,
    resource_id: input.resourceId,
    action_id: input.actionId,
    risk_action_id: input.riskActionId,
    local_decision_status: decision.decision_status,
    request_validation_status: validation.validation_status,
    expected_server_decision: input.expectedServerDecision,
    expected_http_status_after_enablement: input.expectedHttpStatus,
    requires_authenticated_actor: true,
    requires_workspace_membership: true,
    requires_role_membership_lookup: true,
    requires_audit_event_envelope: true,
    requires_confirmation_receipt: input.confirmationRequired,
    must_reject_private_payload: true,
    acceptance_criteria: input.acceptanceCriteria,
  };
}

function rejectedPayloadCase(input: {
  id: string;
  title: string;
  roleId: PermissionRoleId;
  resourceId: PermissionResourceId;
  actionId: PermissionActionId;
  riskActionId: string | null;
  injectedField: "page_body_text" | "prompt_text";
}): PermissionServerMatrixCase {
  const decision = evaluatePermissionDecision({
    roleId: input.roleId,
    resourceId: input.resourceId,
    actionId: input.actionId,
    riskActionId: input.riskActionId ?? undefined,
  });
  const request = {
    ...metadataRequest(input),
    [input.injectedField]: "PRIVATE_PAYLOAD_VALUE",
  };
  const validation = validatePermissionCheckMetadataRequest(request);

  return {
    id: input.id,
    title: input.title,
    case_status: "blocked",
    role_id: input.roleId,
    resource_id: input.resourceId,
    action_id: input.actionId,
    risk_action_id: input.riskActionId,
    local_decision_status: decision.decision_status,
    request_validation_status: validation.validation_status,
    expected_server_decision: "reject-request",
    expected_http_status_after_enablement: 422,
    requires_authenticated_actor: true,
    requires_workspace_membership: true,
    requires_role_membership_lookup: true,
    requires_audit_event_envelope: true,
    requires_confirmation_receipt: false,
    must_reject_private_payload: true,
    acceptance_criteria: [
      `Server rejects ${input.injectedField} before evaluating role permissions.`,
      "Server response reports field names or paths only and never echoes private values.",
      "No protected action executes after request rejection.",
    ],
  };
}

function metadataRequest(input: {
  id: string;
  roleId: PermissionRoleId;
  resourceId: PermissionResourceId;
  actionId: PermissionActionId;
  riskActionId: string | null;
}) {
  return {
    request_id: `req_${input.id}`,
    workspace_id: "workspace_server_matrix",
    actor_user_id: "user_server_matrix",
    actor_role_id: input.roleId,
    resource_type: input.resourceId,
    resource_id: `${input.resourceId}_server_matrix`,
    action_id: input.actionId,
    risk_action_id: input.riskActionId,
    confirmation_receipt_id: input.riskActionId ? `receipt_${input.id}` : null,
    audit_event_envelope_id: `audit_${input.id}`,
    idempotency_key: `idem_${input.id}`,
    created_at: "2026-06-04T00:00:00.000Z",
  };
}
