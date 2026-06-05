import type { PermissionCheckValidatorReport } from "@/lib/security/permissionCheckRequestValidator";
import type { PermissionServerTestMatrix } from "@/lib/security/permissionServerTestMatrix";

export type PermissionServerReadinessStatus =
  | "ready"
  | "manual-confirmation"
  | "blocked";

export interface PermissionServerReadinessGate {
  id: string;
  title: string;
  status: PermissionServerReadinessStatus;
  evidence: string;
  required_action: string;
}

export interface PermissionServerReadinessReport {
  format: "zhinote-server-permission-readiness-report";
  format_version: 1;
  report_status: "local-readiness-report-only";
  readiness_verdict: "not-ready";
  disabled_endpoint: "/api/permissions/check";
  can_enable_permission_endpoint_now: false;
  can_run_server_permission_tests_now: false;
  can_enforce_permissions_now: false;
  can_read_request_body_now: false;
  can_write_server_audit_log_now: false;
  can_upload_workspace_data_now: false;
  privacy_note: string;
  boundary: {
    local_report_only: true;
    endpoint_disabled: true;
    no_server_execution: true;
    reads_request_body: false;
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
    gates: number;
    ready: number;
    manual_confirmation: number;
    blocked: number;
    validator_fixtures: number;
    validator_passed: number;
    server_matrix_cases: number;
    server_matrix_rejected_requests: number;
    server_matrix_denied: number;
    server_matrix_confirmation_cases: number;
  };
  gates: PermissionServerReadinessGate[];
  next_server_steps: string[];
}

export function buildPermissionServerReadinessReport(input: {
  validatorReport: PermissionCheckValidatorReport;
  serverTestMatrix: PermissionServerTestMatrix;
}): PermissionServerReadinessReport {
  const gates = buildReadinessGates(input);

  return {
    format: "zhinote-server-permission-readiness-report",
    format_version: 1,
    report_status: "local-readiness-report-only",
    readiness_verdict: "not-ready",
    disabled_endpoint: "/api/permissions/check",
    can_enable_permission_endpoint_now: false,
    can_run_server_permission_tests_now: false,
    can_enforce_permissions_now: false,
    can_read_request_body_now: false,
    can_write_server_audit_log_now: false,
    can_upload_workspace_data_now: false,
    privacy_note:
      "Generated locally. This readiness report summarizes permission envelope validation, request validator fixtures, and server test matrix coverage only; it does not run server tests, enforce permissions, read request bodies, read page text, read database values, read files, read prompts, read secrets, write audit logs, or upload workspace data.",
    boundary: {
      local_report_only: true,
      endpoint_disabled: true,
      no_server_execution: true,
      reads_request_body: false,
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
      gates: gates.length,
      ready: gates.filter((gate) => gate.status === "ready").length,
      manual_confirmation: gates.filter(
        (gate) => gate.status === "manual-confirmation"
      ).length,
      blocked: gates.filter((gate) => gate.status === "blocked").length,
      validator_fixtures: input.validatorReport.summary.fixtures,
      validator_passed: input.validatorReport.summary.passed,
      server_matrix_cases: input.serverTestMatrix.summary.cases,
      server_matrix_rejected_requests:
        input.serverTestMatrix.summary.rejected_request,
      server_matrix_denied: input.serverTestMatrix.summary.denied,
      server_matrix_confirmation_cases:
        input.serverTestMatrix.summary.allow_after_confirmation,
    },
    gates,
    next_server_steps: [
      "Implement server session identity before trusting actor_user_id or actor_role_id.",
      "Load workspace membership and role from the database before evaluating role/resource/action permissions.",
      "Move metadata-only request validation into /api/permissions/check and reject forbidden payloads with 422 before permission decisions.",
      "Run the server permission matrix as integration tests for allow, deny, confirmation, and request rejection cases.",
      "Write metadata-only audit event envelopes for every allow, deny, and rejected request before enabling sync, restore, sharing, AI execution, file access, or admin actions.",
    ],
  };
}

function buildReadinessGates(input: {
  validatorReport: PermissionCheckValidatorReport;
  serverTestMatrix: PermissionServerTestMatrix;
}): PermissionServerReadinessGate[] {
  const validatorComplete =
    input.validatorReport.summary.fixtures > 0 &&
    input.validatorReport.summary.failed === 0;
  const matrixComplete =
    input.serverTestMatrix.summary.cases >= 12 &&
    input.serverTestMatrix.summary.denied > 0 &&
    input.serverTestMatrix.summary.rejected_request > 0 &&
    input.serverTestMatrix.summary.allow_after_confirmation > 0;

  return [
    gate(
      "endpoint-disabled",
      "Permission endpoint disabled",
      "blocked",
      "/api/permissions/check returns a disabled 501 response and does not read request bodies.",
      "Keep the endpoint disabled until auth, membership, validation, audit, and integration tests are implemented."
    ),
    gate(
      "metadata-validator",
      "Metadata-only validator fixtures",
      validatorComplete ? "ready" : "blocked",
      `${input.validatorReport.summary.passed}/${input.validatorReport.summary.fixtures} local validator fixtures pass; ${input.validatorReport.summary.rejected_forbidden_payload} fixtures reject forbidden payloads.`,
      "Move the validator into the server route and prove forbidden payloads are rejected before role evaluation."
    ),
    gate(
      "server-matrix-coverage",
      "Server permission matrix coverage",
      matrixComplete ? "manual-confirmation" : "blocked",
      `${input.serverTestMatrix.summary.cases} planned cases cover ${input.serverTestMatrix.summary.denied} denies, ${input.serverTestMatrix.summary.rejected_request} request rejects, and ${input.serverTestMatrix.summary.allow_after_confirmation} confirmation-based allows.`,
      "Convert the matrix to automated integration tests against authenticated server routes."
    ),
    gate(
      "authenticated-actor",
      "Authenticated actor identity",
      "blocked",
      "No server session identity is enabled for permission checks.",
      "Implement auth session lookup before trusting client-provided actor ids or roles."
    ),
    gate(
      "workspace-membership",
      "Workspace membership lookup",
      "blocked",
      "Permission cases require server-side workspace membership and role lookup, but those checks are not live.",
      "Load workspace role from the cloud database before any allow, deny, or confirmation result."
    ),
    gate(
      "audit-envelope-linkage",
      "Audit envelope linkage",
      "blocked",
      "Audit event envelopes are modeled locally, but server audit writes remain disabled.",
      "Attach metadata-only audit event envelopes to every permission result before execution."
    ),
    gate(
      "high-risk-confirmation",
      "High-risk confirmation receipts",
      "manual-confirmation",
      `${input.serverTestMatrix.summary.allow_after_confirmation} server matrix cases require visible confirmation receipts.`,
      "Require fresh confirmation receipts for cloud sync, restore, AI execution, sharing, external assets, bulk delete, and broker import."
    ),
  ];
}

function gate(
  id: string,
  title: string,
  status: PermissionServerReadinessStatus,
  evidence: string,
  requiredAction: string
): PermissionServerReadinessGate {
  return {
    id,
    title,
    status,
    evidence,
    required_action: requiredAction,
  };
}
