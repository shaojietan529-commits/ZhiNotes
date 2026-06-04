export type WebBetaApiStubId =
  | "auth-session"
  | "auth-login-start"
  | "auth-logout"
  | "workspace-list"
  | "workspace-create"
  | "workspace-bootstrap"
  | "sync-push"
  | "sync-pull"
  | "sync-replay-test"
  | "restore-preview"
  | "restore-apply"
  | "file-presign"
  | "permission-check"
  | "audit-events"
  | "cloud-migration-apply";

export interface WebBetaApiStub {
  id: WebBetaApiStubId;
  method: "GET" | "POST";
  path: string;
  purpose: string;
  future_requirement: string;
  privacy_boundary: string;
}

export interface WebBetaApiStubResponse {
  format: "zhinote-web-beta-api-stub";
  format_version: 1;
  api_id: WebBetaApiStubId;
  method: WebBetaApiStub["method"];
  path: string;
  stub_status: "disabled-local-stub";
  can_accept_workspace_data: false;
  reads_request_body: false;
  writes_server_data: false;
  uploads_data: false;
  privacy_note: string;
  purpose: string;
  required_before_enablement: string;
}

export const WEB_BETA_API_STUB_HTTP_STATUS = 501;

export const WEB_BETA_API_STUBS: WebBetaApiStub[] = [
  {
    id: "auth-session",
    method: "GET",
    path: "/api/auth/session",
    purpose:
      "Future endpoint for reading the current authenticated user, workspace memberships, and device session state.",
    future_requirement:
      "Enable only after account provider selection, secure cookies, session refresh, logout, and audit logging exist.",
    privacy_boundary:
      "The current stub does not read cookies, create sessions, expose users, or connect to an auth provider.",
  },
  {
    id: "auth-login-start",
    method: "POST",
    path: "/api/auth/login/start",
    purpose:
      "Future endpoint for starting email, magic-link, or provider-based login for the private beta.",
    future_requirement:
      "Enable only after login provider, rate limits, CSRF protection, redirect allowlists, and user messaging are defined.",
    privacy_boundary:
      "The current stub does not read email addresses, passwords, tokens, request bodies, or external identity data.",
  },
  {
    id: "auth-logout",
    method: "POST",
    path: "/api/auth/logout",
    purpose:
      "Future endpoint for ending the current session and optionally revoking the browser device session.",
    future_requirement:
      "Enable only after session storage, device visibility, revoke behavior, and audit events are implemented.",
    privacy_boundary:
      "The current stub does not read cookies, mutate sessions, revoke devices, or send account data externally.",
  },
  {
    id: "workspace-list",
    method: "GET",
    path: "/api/workspaces",
    purpose:
      "Private alpha endpoint for listing cloud workspaces that the current authenticated user can access.",
    future_requirement:
      "Enable only after Supabase Auth, workspace membership RLS, and metadata-only response boundaries are configured.",
    privacy_boundary:
      "The current disabled response does not read page bodies, file bytes, database rows, backups, or sync queue payloads.",
  },
  {
    id: "workspace-create",
    method: "POST",
    path: "/api/workspaces",
    purpose:
      "Private alpha endpoint for creating an empty cloud workspace and assigning the current authenticated user as owner.",
    future_requirement:
      "Enable only after Supabase Auth, workspace RLS, owner membership creation, redirect policy, and user-facing cloud opt-in copy are configured.",
    privacy_boundary:
      "The current disabled response does not read local notes, files, databases, backups, or sync queue rows.",
  },
  {
    id: "workspace-bootstrap",
    method: "GET",
    path: "/api/workspaces/:workspaceId/bootstrap",
    purpose:
      "Future login bootstrap endpoint for workspace metadata, membership role, sync cursor, and module availability.",
    future_requirement:
      "Enable only after account login, workspace membership checks, and server-side role enforcement exist.",
    privacy_boundary:
      "The current stub returns metadata only and does not read note bodies, files, or database rows.",
  },
  {
    id: "sync-push",
    method: "POST",
    path: "/api/sync/push",
    purpose:
      "Future endpoint for sending local sync_log batches to the cloud after payload preview and confirmation.",
    future_requirement:
      "Enable only after payload preview, permission checks, retries, acknowledgements, and audit logging exist.",
    privacy_boundary:
      "The current stub intentionally does not read the request body or upload workspace data.",
  },
  {
    id: "sync-pull",
    method: "GET",
    path: "/api/sync/pull?cursor=:cursor",
    purpose:
      "Future endpoint for pulling remote changes by cursor without overwriting local dirty rows silently.",
    future_requirement:
      "Enable only after conflict detection, cursors, local apply rules, and rollback behavior are implemented.",
    privacy_boundary:
      "The current stub returns a disabled response and does not fetch remote workspace data.",
  },
  {
    id: "sync-replay-test",
    method: "POST",
    path: "/api/sync/replay-test",
    purpose:
      "Future endpoint for running controlled sync push/pull replay tests in a disposable beta environment.",
    future_requirement:
      "Enable only after auth, permission checks, payload preview, conflict UI, retry/idempotency, audit events, rollback proof, and disposable test data exist.",
    privacy_boundary:
      "The current stub does not read replay payloads, connect cloud services, push data, pull remote rows, acknowledge sync rows, write local data, or upload workspace data.",
  },
  {
    id: "restore-preview",
    method: "POST",
    path: "/api/backup/restore-preview",
    purpose:
      "Future endpoint for validating a backup package and returning restore scope before write-back.",
    future_requirement:
      "Enable only after restore rollback export, scope review, and second confirmation are enforced.",
    privacy_boundary:
      "The current stub does not read backup payloads, restore, overwrite, delete, upload, or sync data.",
  },
  {
    id: "restore-apply",
    method: "POST",
    path: "/api/backup/restore-apply",
    purpose:
      "Future endpoint for applying a selected restore scope back into the workspace after every recovery gate passes.",
    future_requirement:
      "Enable only after rollback snapshot export, restore scope review, permission check, audit event, second confirmation, sync replay safety, and failed-restore rollback proof exist.",
    privacy_boundary:
      "The current stub does not read restore payloads, restore data, overwrite pages, delete rows, write workspace data, upload files, or sync notes.",
  },
  {
    id: "file-presign",
    method: "POST",
    path: "/api/files/presign",
    purpose:
      "Future endpoint for private upload/download URLs for reports, PDFs, Office files, archives, and notebooks.",
    future_requirement:
      "Enable only after private storage buckets, signed URL expiry, checksums, size limits, server permission checks, metadata-only audit envelopes, validator-backed forbidden payload rejection, and owner confirmation exist.",
    privacy_boundary:
      "The current dedicated disabled response does not read request bodies, inspect file metadata, create signed URLs, expose public links, upload files, write audit logs, or return storage credentials.",
  },
  {
    id: "permission-check",
    method: "POST",
    path: "/api/permissions/check",
    purpose:
      "Future endpoint for server-side checks before export, restore, sync, sharing, AI, or admin actions.",
    future_requirement:
      "Enable only after authenticated users, workspace roles, resource policies, metadata-only schema validation, validator-backed forbidden payload rejection, server permission matrix tests, readiness gates, high-risk confirmations, and audit events exist.",
    privacy_boundary:
      "The current dedicated disabled response does not read page text, file content, database rows, prompts, secrets, or action payload bodies.",
  },
  {
    id: "audit-events",
    method: "POST",
    path: "/api/audit/events",
    purpose:
      "Future endpoint for recording server-side audit events for login, export, restore, sync, sharing, permissions, files, AI, and admin actions.",
    future_requirement:
      "Enable only after authenticated actor identity, workspace membership, metadata-only schema validation, permission decision linkage, retention policy, tamper-resistant audit storage, owner audit export, and validator-backed forbidden payload rejection exist.",
    privacy_boundary:
      "The current dedicated disabled response does not read request bodies, accept event payloads, inspect page text, database values, comments, file bytes, backups, prompts, model output, secrets, signed URLs, or write audit logs.",
  },
  {
    id: "cloud-migration-apply",
    method: "POST",
    path: "/api/cloud/migrations/apply",
    purpose:
      "Future endpoint for applying reviewed cloud database migrations in a controlled private beta environment.",
    future_requirement:
      "Enable only after owner approval, disposable database replay, rollback proof, migration lock, backup snapshot, audit events, and deployment gate checks exist.",
    privacy_boundary:
      "The current stub does not read SQL payloads, connect databases, apply migrations, write server data, expose secrets, or upload workspace data.",
  },
];

export function buildWebBetaApiStubResponse(
  id: WebBetaApiStubId
): WebBetaApiStubResponse {
  const stub = WEB_BETA_API_STUBS.find((item) => item.id === id);

  if (!stub) {
    throw new Error(`Unknown Web Beta API stub: ${id}`);
  }

  return {
    format: "zhinote-web-beta-api-stub",
    format_version: 1,
    api_id: stub.id,
    method: stub.method,
    path: stub.path,
    stub_status: "disabled-local-stub",
    can_accept_workspace_data: false,
    reads_request_body: false,
    writes_server_data: false,
    uploads_data: false,
    privacy_note:
      "This local route is a disabled Web Beta stub. It does not read request bodies, store server data, restore backups, upload files, sync notes, create accounts, or share workspace data.",
    purpose: stub.purpose,
    required_before_enablement: stub.future_requirement,
  };
}
