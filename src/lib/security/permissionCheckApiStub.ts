import {
  buildPermissionCheckForbiddenFields,
  buildPermissionCheckRequestFields,
  buildPermissionCheckResponseFields,
  type PermissionCheckField,
} from "@/lib/security/permissionCheckEnvelope";
import {
  buildPermissionCheckValidatorReport,
  type PermissionCheckValidatorReport,
} from "@/lib/security/permissionCheckRequestValidator";
import {
  buildWebBetaApiStubResponse,
  type WebBetaApiStubResponse,
} from "@/lib/sync/webBetaApiStubs";

export interface PermissionCheckApiDisabledResponse {
  format: "zhinote-permission-check-api-disabled";
  format_version: 1;
  api_id: "permission-check";
  path: "/api/permissions/check";
  method: "POST";
  stub_status: "disabled-local-stub";
  can_enforce_permissions_now: false;
  can_read_request_body_now: false;
  can_create_users_now: false;
  can_grant_access_now: false;
  can_revoke_access_now: false;
  can_write_server_audit_log_now: false;
  can_upload_workspace_data_now: false;
  privacy_note: string;
  base_stub: WebBetaApiStubResponse;
  boundary: {
    no_request_argument: true;
    reads_request_body: false;
    metadata_only_request: true;
    executes_actions: false;
    creates_users: false;
    grants_access: false;
    revokes_access: false;
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_comment_bodies: false;
    reads_file_bytes: false;
    reads_prompt_text: false;
    reads_secret_values: false;
    writes_server_audit_log: false;
    uploads_workspace_data: false;
    requires_authenticated_actor_before_enablement: true;
    requires_workspace_membership_before_enablement: true;
    requires_role_membership_lookup_before_enablement: true;
    requires_high_risk_confirmation_before_enablement: true;
    requires_audit_event_envelope_before_enablement: true;
  };
  request_schema: {
    schema_status: "planned-metadata-only";
    allowed_fields: PermissionCheckField[];
    forbidden_fields: PermissionCheckField[];
  };
  response_schema: {
    schema_status: "planned-decision-only";
    allowed_fields: PermissionCheckField[];
  };
  local_validator_report: PermissionCheckValidatorReport;
  disabled_response_contract: {
    http_status: 501;
    returns_permission_result: false;
    returns_allow_decision: false;
    returns_deny_decision: false;
    returns_required_confirmation: true;
  };
  enablement_gates: Array<{
    id: string;
    title: string;
    required_before_enablement: string;
  }>;
}

export function buildPermissionCheckApiDisabledResponse(): PermissionCheckApiDisabledResponse {
  return {
    format: "zhinote-permission-check-api-disabled",
    format_version: 1,
    api_id: "permission-check",
    path: "/api/permissions/check",
    method: "POST",
    stub_status: "disabled-local-stub",
    can_enforce_permissions_now: false,
    can_read_request_body_now: false,
    can_create_users_now: false,
    can_grant_access_now: false,
    can_revoke_access_now: false,
    can_write_server_audit_log_now: false,
    can_upload_workspace_data_now: false,
    privacy_note:
      "This route is intentionally disabled. It does not accept workspace data, read request bodies, inspect note text, inspect database values, read files, read prompts, read secrets, grant access, revoke access, write audit logs, or upload data.",
    base_stub: buildWebBetaApiStubResponse("permission-check"),
    boundary: {
      no_request_argument: true,
      reads_request_body: false,
      metadata_only_request: true,
      executes_actions: false,
      creates_users: false,
      grants_access: false,
      revokes_access: false,
      reads_page_body_text: false,
      reads_database_row_values: false,
      reads_comment_bodies: false,
      reads_file_bytes: false,
      reads_prompt_text: false,
      reads_secret_values: false,
      writes_server_audit_log: false,
      uploads_workspace_data: false,
      requires_authenticated_actor_before_enablement: true,
      requires_workspace_membership_before_enablement: true,
      requires_role_membership_lookup_before_enablement: true,
      requires_high_risk_confirmation_before_enablement: true,
      requires_audit_event_envelope_before_enablement: true,
    },
    request_schema: {
      schema_status: "planned-metadata-only",
      allowed_fields: buildPermissionCheckRequestFields(),
      forbidden_fields: buildPermissionCheckForbiddenFields(),
    },
    response_schema: {
      schema_status: "planned-decision-only",
      allowed_fields: buildPermissionCheckResponseFields(),
    },
    local_validator_report: buildPermissionCheckValidatorReport(),
    disabled_response_contract: {
      http_status: 501,
      returns_permission_result: false,
      returns_allow_decision: false,
      returns_deny_decision: false,
      returns_required_confirmation: true,
    },
    enablement_gates: [
      {
        id: "authenticated-actor",
        title: "Authenticated actor",
        required_before_enablement:
          "Server session identity must be implemented before the route can trust actor_user_id.",
      },
      {
        id: "workspace-membership",
        title: "Workspace membership",
        required_before_enablement:
          "Server-side workspace membership and role lookup must pass before any permission decision can be returned.",
      },
      {
        id: "metadata-only-schema-validation",
        title: "Metadata-only schema validation",
        required_before_enablement:
          "The route must reject raw page text, database values, comments, file bytes, prompts, tokens, cookies, signed URLs, and raw request bodies.",
      },
      {
        id: "high-risk-confirmation",
        title: "High-risk confirmation",
        required_before_enablement:
          "Cloud sync, restore, AI execution, external assets, sharing, bulk delete, and broker import require visible confirmation receipts.",
      },
      {
        id: "audit-event-envelope",
        title: "Audit event envelope",
        required_before_enablement:
          "Every returned allow or deny result must link to a metadata-only audit event envelope before execution.",
      },
    ],
  };
}
