import type { LocalWorkspaceIdentity } from "@/lib/sync/workspaceIdentity";
import type { WebBetaApiStub } from "@/lib/sync/webBetaApiStubs";

export type AccountSessionBoundaryStatus =
  | "planned"
  | "manual-confirmation"
  | "blocked";

export interface AccountSessionBoundaryInput {
  workspaceIdentity: LocalWorkspaceIdentity | null;
  authApiStubs: WebBetaApiStub[];
}

export interface AccountSessionPhase {
  id: string;
  title: string;
  status: AccountSessionBoundaryStatus;
  disabled_route: string | null;
  current_boundary: string;
  required_before_enablement: string;
}

export interface AccountSessionGate {
  id: string;
  title: string;
  status: AccountSessionBoundaryStatus;
  evidence: string;
  required_action: string;
}

export interface AccountSessionFieldRule {
  field: string;
  status: "allowed" | "forbidden";
  purpose: string;
}

export interface AccountSessionBoundary {
  format: "zhinote-account-session-boundary";
  format_version: 1;
  boundary_status: "local-boundary-only";
  can_create_accounts: false;
  can_start_login: false;
  can_read_session: false;
  can_revoke_device: false;
  privacy_note: string;
  boundary: {
    local_boundary_only: true;
    creates_accounts: false;
    reads_email_addresses: false;
    reads_passwords: false;
    reads_tokens: false;
    reads_cookies: false;
    connects_auth_provider: false;
    writes_server_session: false;
    uploads_workspace_data: false;
    requires_owner_confirmation_before_beta_login: true;
  };
  local_evidence: {
    workspace_identity_available: boolean;
    workspace_id: string | null;
    device_id: string | null;
    auth_disabled_routes: number;
  };
  summary: {
    phases: number;
    gates: number;
    blocked: number;
    manual_confirmation: number;
    planned: number;
    forbidden_fields: number;
  };
  phases: AccountSessionPhase[];
  gates: AccountSessionGate[];
  fields: AccountSessionFieldRule[];
}

export function buildAccountSessionBoundary(
  input: AccountSessionBoundaryInput
): AccountSessionBoundary {
  const phases = buildAccountSessionPhases(input.authApiStubs);
  const gates = buildAccountSessionGates(input);
  const fields = buildAccountSessionFieldRules();

  return {
    format: "zhinote-account-session-boundary",
    format_version: 1,
    boundary_status: "local-boundary-only",
    can_create_accounts: false,
    can_start_login: false,
    can_read_session: false,
    can_revoke_device: false,
    privacy_note:
      "Generated locally. This account/session boundary does not create accounts, start login, read sessions, read emails, read passwords, read tokens, read cookies, connect auth providers, write server sessions, or upload workspace data.",
    boundary: {
      local_boundary_only: true,
      creates_accounts: false,
      reads_email_addresses: false,
      reads_passwords: false,
      reads_tokens: false,
      reads_cookies: false,
      connects_auth_provider: false,
      writes_server_session: false,
      uploads_workspace_data: false,
      requires_owner_confirmation_before_beta_login: true,
    },
    local_evidence: {
      workspace_identity_available: Boolean(input.workspaceIdentity),
      workspace_id: input.workspaceIdentity?.workspace_id ?? null,
      device_id: input.workspaceIdentity?.device_id ?? null,
      auth_disabled_routes: input.authApiStubs.length,
    },
    summary: {
      phases: phases.length,
      gates: gates.length,
      blocked: gates.filter((gate) => gate.status === "blocked").length,
      manual_confirmation: gates.filter(
        (gate) => gate.status === "manual-confirmation"
      ).length,
      planned: gates.filter((gate) => gate.status === "planned").length,
      forbidden_fields: fields.filter((field) => field.status === "forbidden")
        .length,
    },
    phases,
    gates,
    fields,
  };
}

function buildAccountSessionPhases(
  authApiStubs: WebBetaApiStub[]
): AccountSessionPhase[] {
  const authRouteMap = new Map(
    authApiStubs.map((stub) => [stub.id, stub.path] as const)
  );

  return [
    {
      id: "local-workspace-identity",
      title: "Local workspace and device identity",
      status: "planned",
      disabled_route: null,
      current_boundary:
        "Browser-local workspace_id and device_id exist without account login or cloud sync.",
      required_before_enablement:
        "Keep this identity local until the user explicitly opts into private beta login.",
    },
    {
      id: "login-start",
      title: "Login start",
      status: "blocked",
      disabled_route: authRouteMap.get("auth-login-start") ?? null,
      current_boundary:
        "Login start route is disabled and does not read email, password, token, or request body data.",
      required_before_enablement:
        "Choose auth provider, allowed redirects, CSRF/rate-limit policy, and user-facing consent copy.",
    },
    {
      id: "session-read",
      title: "Session read",
      status: "blocked",
      disabled_route: authRouteMap.get("auth-session") ?? null,
      current_boundary:
        "Session route is disabled and does not read cookies, expose users, or connect to an auth provider.",
      required_before_enablement:
        "Implement secure cookies, session refresh, workspace membership lookup, and device visibility.",
    },
    {
      id: "workspace-bootstrap",
      title: "Workspace bootstrap",
      status: "blocked",
      disabled_route: authRouteMap.get("workspace-bootstrap") ?? null,
      current_boundary:
        "Workspace bootstrap returns disabled metadata and does not read note bodies, files, or database rows.",
      required_before_enablement:
        "Require authenticated workspace membership before returning cloud cursors, modules, or counts.",
    },
    {
      id: "logout-revoke",
      title: "Logout and device revoke",
      status: "blocked",
      disabled_route: authRouteMap.get("auth-logout") ?? null,
      current_boundary:
        "Logout route is disabled and does not mutate sessions, revoke devices, or send account data externally.",
      required_before_enablement:
        "Define logout behavior, device revoke behavior, audit events, and stale session cleanup.",
    },
    {
      id: "local-to-cloud-link",
      title: "Local workspace to cloud account link",
      status: "manual-confirmation",
      disabled_route: null,
      current_boundary:
        "No local workspace is linked to a cloud account, and no local notes are uploaded.",
      required_before_enablement:
        "Show owner confirmation, backup export prompt, sync payload preview, and conflict policy before linking local data to an account.",
    },
  ];
}

function buildAccountSessionGates(
  input: AccountSessionBoundaryInput
): AccountSessionGate[] {
  return [
    {
      id: "auth-provider",
      title: "Auth provider and account boundary",
      status: "blocked",
      evidence:
        "No auth provider, account model, invite flow, or recovery behavior is selected.",
      required_action:
        "Choose provider, beta account rules, recovery path, redirect allowlist, and terms/privacy messaging.",
    },
    {
      id: "secure-session",
      title: "Secure session storage",
      status: "blocked",
      evidence:
        "Auth routes are disabled; no secure cookie, session refresh, CSRF, or revoke logic exists.",
      required_action:
        "Implement secure cookies, CSRF protection, refresh expiry, logout, device revoke, and rate limits.",
    },
    {
      id: "workspace-membership",
      title: "Workspace membership enforcement",
      status: "blocked",
      evidence: input.workspaceIdentity
        ? `Local workspace ${input.workspaceIdentity.workspace_id} exists, but no cloud membership or server role check exists.`
        : "No local workspace identity or cloud membership exists.",
      required_action:
        "Require workspace membership checks before bootstrap, sync, restore, file, permission, audit, or AI endpoints.",
    },
    {
      id: "local-link-confirmation",
      title: "Local-to-cloud link confirmation",
      status: "manual-confirmation",
      evidence:
        "Local workspace data remains browser-local and unlinked to any account.",
      required_action:
        "Require owner confirmation, backup export, sync payload preview, and rollback path before linking local data to a cloud account.",
    },
    {
      id: "audit-permission-integration",
      title: "Permission and audit integration",
      status: "blocked",
      evidence:
        "Permission decisions and audit policy exist locally, but server enforcement and audit writes are disabled.",
      required_action:
        "Gate all authenticated actions through server permission checks and write redacted audit events.",
    },
    {
      id: "privacy-field-policy",
      title: "Credential and secret redaction",
      status: "manual-confirmation",
      evidence:
        "Allowed and forbidden auth/session fields are documented locally.",
      required_action:
        "Ensure email, token, cookie, IP risk, and provider metadata policies are reviewed before private beta login.",
    },
  ];
}

function buildAccountSessionFieldRules(): AccountSessionFieldRule[] {
  return [
    field("user_id", "allowed", "Stable account id after real login exists."),
    field("workspace_id", "allowed", "Workspace boundary for membership and sync."),
    field("device_id", "allowed", "Device session visibility and revoke workflow."),
    field("role_id", "allowed", "Owner, Researcher, or Viewer membership role."),
    field("session_created_at", "allowed", "Session timing for security review."),
    field("session_expires_at", "allowed", "Session expiry and refresh policy."),
    field("email_normalized", "allowed", "Account lookup only after provider and retention rules are selected."),
    field("password", "forbidden", "Passwords must never be handled by ZhiNotes local stubs or stored in reports."),
    field("magic_link_token", "forbidden", "Login tokens must never be exported or shown in readiness reports."),
    field("oauth_access_token", "forbidden", "Provider tokens must stay in secure server storage only."),
    field("session_cookie_value", "forbidden", "Cookie values must never be exposed to readiness exports."),
    field("secret_env_value", "forbidden", "Environment secrets must remain presence-only in preflight checks."),
  ];
}

function field(
  fieldName: string,
  status: AccountSessionFieldRule["status"],
  purpose: string
): AccountSessionFieldRule {
  return {
    field: fieldName,
    status,
    purpose,
  };
}
