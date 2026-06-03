import { WEB_BETA_API_STUBS } from "@/lib/sync/webBetaApiStubs";
import type { CloudSchemaMigrationPlan } from "@/lib/sync/cloudSchemaMigrationPlan";
import type { WebBetaLaunchChecklist } from "@/lib/sync/webBetaLaunchChecklist";
import type { WebBetaEnvironmentPreflight } from "@/lib/sync/webBetaEnvironmentPreflight";

export type WebBetaContractStatus =
  | "local-draft"
  | "planned"
  | "required"
  | "manual-confirmation"
  | "blocked";

export interface WebBetaAuthContract {
  id: string;
  title: string;
  status: WebBetaContractStatus;
  detail: string;
  acceptance: string;
}

export interface CloudSchemaTableContract {
  tableName: string;
  status: WebBetaContractStatus;
  localSource: string;
  cloudPurpose: string;
  privacyBoundary: string;
}

export interface SyncApiContract {
  id: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  status: WebBetaContractStatus;
  purpose: string;
  payloadBoundary: string;
}

export interface ConflictPolicyContract {
  id: string;
  surface: string;
  status: WebBetaContractStatus;
  strategy: string;
  userGate: string;
}

export interface DeploymentGateContract {
  id: string;
  title: string;
  status: WebBetaContractStatus;
  evidence: string;
  failureMode: string;
}

export const AUTH_CONTRACT_ITEMS: WebBetaAuthContract[] = [
  {
    id: "workspace-identity",
    title: "Workspace identity",
    status: "required",
    detail:
      "Every cloud row must belong to one workspace_id so personal notes, company research, reports, and portfolios cannot mix across accounts.",
    acceptance:
      "All syncable tables include workspace_id and server-side workspace checks.",
  },
  {
    id: "account-login",
    title: "Account login and sessions",
    status: "planned",
    detail:
      "Private beta needs email login, session refresh, logout, and device-level session visibility.",
    acceptance:
      "A user can log in, log out, and revoke a device without touching local backup files.",
  },
  {
    id: "membership-roles",
    title: "Membership roles",
    status: "local-draft",
    detail:
      "Owner, Researcher, and Viewer roles are drafted locally and must become enforceable on the server.",
    acceptance:
      "Server rejects actions outside the role policy before the client UI is trusted.",
  },
  {
    id: "sharing-default",
    title: "Private by default",
    status: "manual-confirmation",
    detail:
      "New workspaces, pages, files, reports, and portfolio data should stay private unless the owner explicitly shares them.",
    acceptance:
      "No share link, invite, external asset, or AI payload is created without a visible confirmation step.",
  },
];

export const CLOUD_SCHEMA_TABLES: CloudSchemaTableContract[] = [
  {
    tableName: "users",
    status: "planned",
    localSource: "None yet",
    cloudPurpose: "Account identity, login email, and recovery metadata.",
    privacyBoundary: "No page text or research content belongs in this table.",
  },
  {
    tableName: "workspaces",
    status: "planned",
    localSource: "local workspace identity",
    cloudPurpose: "Workspace ownership, beta status, and workspace settings.",
    privacyBoundary: "Workspace name and settings only.",
  },
  {
    tableName: "workspace_members",
    status: "planned",
    localSource: "permission policy draft",
    cloudPurpose: "User role membership for Owner, Researcher, and Viewer.",
    privacyBoundary: "No research content; role metadata only.",
  },
  {
    tableName: "pages",
    status: "required",
    localSource: "pages",
    cloudPurpose: "Page title, icon, cover, tree position, editor body, lock state, and trash state.",
    privacyBoundary: "High-sensitivity note content; sync requires explicit beta opt-in.",
  },
  {
    tableName: "page_versions",
    status: "required",
    localSource: "page_versions",
    cloudPurpose: "Version snapshots for rollback and conflict review.",
    privacyBoundary: "Contains page content snapshots and must follow the same retention policy as pages.",
  },
  {
    tableName: "comments",
    status: "required",
    localSource: "page_comments, block_comments",
    cloudPurpose: "Page and block discussion history.",
    privacyBoundary: "Contains research discussion and should never be public by default.",
  },
  {
    tableName: "databases",
    status: "required",
    localSource: "databases, database_fields, database_rows, database_views",
    cloudPurpose: "Research trackers, field definitions, rows, views, and relation field values.",
    privacyBoundary: "Rows can contain positions, ratings, thesis text, and meeting links.",
  },
  {
    tableName: "files",
    status: "required",
    localSource: "IndexedDB file store",
    cloudPurpose: "Private file metadata, preview kind, storage pointer, checksum, and render status.",
    privacyBoundary: "File bytes must use private storage and must not be included in sync metadata exports.",
  },
  {
    tableName: "sync_log",
    status: "local-draft",
    localSource: "sync_log",
    cloudPurpose: "Client change queue, retry state, remote acknowledgement, and cursor movement.",
    privacyBoundary: "Queue metadata should avoid page body text and file bytes.",
  },
  {
    tableName: "audit_events",
    status: "planned",
    localSource: "None yet",
    cloudPurpose: "Login, export, restore, sharing, sync, AI, and permission change audit trail.",
    privacyBoundary: "Event metadata only; avoid storing full research payloads.",
  },
];

export const SYNC_API_CONTRACTS: SyncApiContract[] = [
  {
    id: "workspace-list",
    method: "GET",
    path: "/api/workspaces",
    status: "planned",
    purpose:
      "List cloud workspaces available to the authenticated user before linking a local browser workspace.",
    payloadBoundary:
      "Returns workspace ids, names, beta status, and roles only; no page bodies, files, database rows, or sync queue payloads.",
  },
  {
    id: "workspace-create",
    method: "POST",
    path: "/api/workspaces",
    status: "planned",
    purpose:
      "Create an empty private-alpha workspace and owner membership after Supabase Auth login.",
    payloadBoundary:
      "Writes account/workspace metadata only; local page bodies, files, database rows, and sync queue entries stay local.",
  },
  {
    id: "workspace-bootstrap",
    method: "GET",
    path: "/api/workspaces/:workspaceId/bootstrap",
    status: "planned",
    purpose:
      "Load workspace metadata, membership role, sync cursor, and module availability after login.",
    payloadBoundary:
      "Returns metadata and counts first; page bodies should be pulled through the sync API.",
  },
  {
    id: "sync-push",
    method: "POST",
    path: "/api/sync/push",
    status: "required",
    purpose:
      "Send local sync_log entries to the server in deterministic batches with retry state.",
    payloadBoundary:
      "Must preview included tables and record counts before the first beta upload.",
  },
  {
    id: "sync-pull",
    method: "GET",
    path: "/api/sync/pull?cursor=:cursor",
    status: "required",
    purpose:
      "Fetch remote changes since the local cursor and apply them through the same local write model.",
    payloadBoundary:
      "Must include conflict markers instead of overwriting local dirty rows silently.",
  },
  {
    id: "restore-preview",
    method: "POST",
    path: "/api/backup/restore-preview",
    status: "manual-confirmation",
    purpose:
      "Validate a backup or remote restore package and return a scope summary before any write.",
    payloadBoundary:
      "Preview can inspect the selected package, but restore write-back needs a second explicit confirmation.",
  },
  {
    id: "restore-apply",
    method: "POST",
    path: "/api/backup/restore-apply",
    status: "manual-confirmation",
    purpose:
      "Apply a selected restore scope after rollback snapshot, permission check, audit event, sync safety, and second confirmation.",
    payloadBoundary:
      "Must stay disabled until rollback proof and failed-restore recovery exist; apply must never run from preview alone.",
  },
  {
    id: "file-presign",
    method: "POST",
    path: "/api/files/presign",
    status: "planned",
    purpose:
      "Create private upload/download URLs for HTML reports, PDFs, Office files, archives, and notebooks.",
    payloadBoundary:
      "File bytes use private storage URLs and should not pass through generic sync metadata exports.",
  },
  {
    id: "permission-check",
    method: "POST",
    path: "/api/permissions/check",
    status: "required",
    purpose:
      "Server-side action check for export, restore, sync, sharing, AI, and admin actions.",
    payloadBoundary:
      "Checks action/resource metadata; it should not require sending page body text.",
  },
  {
    id: "audit-events",
    method: "POST",
    path: "/api/audit/events",
    status: "required",
    purpose:
      "Record server-side audit events for auth, export, restore, sync, sharing, permission, file, AI, and admin actions.",
    payloadBoundary:
      "Stores actor, workspace, device, resource, event type, counts, and redacted metadata; never page bodies, file bytes, prompt text, tokens, or secret values.",
  },
];

export const CONFLICT_POLICIES: ConflictPolicyContract[] = [
  {
    id: "page-body",
    surface: "Page body and title",
    status: "required",
    strategy:
      "Use base version, local version, and remote version to detect conflicts; show side-by-side review when both sides changed the same page.",
    userGate:
      "Do not auto-overwrite research notes when local and remote edits both exist.",
  },
  {
    id: "database-row",
    surface: "Database rows",
    status: "required",
    strategy:
      "Merge different fields when possible; mark a conflict when the same field changed locally and remotely.",
    userGate:
      "Conflicted ratings, target prices, position weights, and thesis fields need manual choice.",
  },
  {
    id: "file-object",
    surface: "Uploaded files",
    status: "planned",
    strategy:
      "Treat file bytes as immutable objects; a replacement creates a new file version instead of changing the old object silently.",
    userGate:
      "Replacing a report, model, or deck should show old and new file metadata before confirmation.",
  },
  {
    id: "comments",
    surface: "Comments and action items",
    status: "planned",
    strategy:
      "Append new comments by timestamp and preserve edit history for comment updates.",
    userGate:
      "Deleted comments should remain recoverable through audit or version history during beta.",
  },
  {
    id: "permissions",
    surface: "Permissions and sharing",
    status: "manual-confirmation",
    strategy:
      "Never merge permission changes automatically; owner decisions win only after a visible confirmation step.",
    userGate:
      "Sharing, role downgrade, role upgrade, or invite changes must be confirmed by an owner.",
  },
  {
    id: "restore",
    surface: "Backup restore",
    status: "manual-confirmation",
    strategy:
      "Run restore preview, create a rollback snapshot, then apply selected restore scope only after confirmation.",
    userGate:
      "No backup restore write-back should happen from a single click or background sync.",
  },
];

export const DEPLOYMENT_GATES: DeploymentGateContract[] = [
  {
    id: "auth-enforced",
    title: "Auth and role checks are enforced server-side",
    status: "blocked",
    evidence:
      "Integration tests prove Owner, Researcher, and Viewer permissions are rejected on the server when invalid.",
    failureMode:
      "Do not launch web beta if the client UI is the only permission control.",
  },
  {
    id: "cloud-migrations",
    title: "Cloud schema migrations and rollback exist",
    status: "blocked",
    evidence:
      "Versioned migrations create users, workspaces, pages, databases, files, sync_log, permissions, and audit_events.",
    failureMode:
      "Do not launch if database changes cannot be rolled back or replayed on a clean environment.",
  },
  {
    id: "sync-replay-tested",
    title: "Sync queue replay is tested",
    status: "blocked",
    evidence:
      "Automated tests replay page, database, comment, file metadata, relation, and version changes through push and pull.",
    failureMode:
      "Do not launch if local queued changes can be acknowledged without being durably stored remotely.",
  },
  {
    id: "conflict-ui",
    title: "Conflict review UI exists",
    status: "blocked",
    evidence:
      "Manual review screen handles page, database row, file replacement, permission, and restore conflicts.",
    failureMode:
      "Do not launch multi-device editing if conflicts can silently overwrite local research.",
  },
  {
    id: "backup-restore-rollback",
    title: "Backup restore has preview and rollback",
    status: "manual-confirmation",
    evidence:
      "Restore preview, restore confirmation, and rollback snapshot are verified before write-back is enabled.",
    failureMode:
      "Keep restore write-back disabled until rollback is proven.",
  },
  {
    id: "private-file-storage",
    title: "Private file storage is configured",
    status: "blocked",
    evidence:
      "Uploaded files use private buckets, signed URLs, checksums, size limits, and blocked public listing.",
    failureMode:
      "Do not sync reports, PDFs, Excel, Word, PPT, archives, or notebooks to public storage.",
  },
  {
    id: "payload-preview",
    title: "High-risk payload preview is visible",
    status: "manual-confirmation",
    evidence:
      "Cloud sync, AI execution, external assets, sharing, bulk delete, and broker import all show payload boundaries.",
    failureMode:
      "Do not enable high-risk actions when the user cannot see what will be sent or changed.",
  },
  {
    id: "export-before-beta",
    title: "User can export before beta sync",
    status: "required",
    evidence:
      "Backup JSON, workspace ZIP, Markdown export, queue snapshot, permission policy, and contract export are available locally.",
    failureMode:
      "Do not ask users to opt into beta sync without a local escape hatch.",
  },
];

export function buildWebBetaContractSnapshot(input?: {
  cloudSchemaMigrationPlan?: CloudSchemaMigrationPlan | null;
  webBetaLaunchChecklist?: WebBetaLaunchChecklist | null;
  webBetaEnvironmentPreflight?: WebBetaEnvironmentPreflight | null;
}) {
  return {
    format: "zhinote-web-beta-contract",
    format_version: 1,
    contract_status: "local-draft",
    privacy_note:
      "Generated locally. This contract does not create accounts, connect cloud services, upload notes, sync files, or share workspace data.",
    auth: AUTH_CONTRACT_ITEMS,
    cloud_schema_tables: CLOUD_SCHEMA_TABLES,
    cloud_schema_migration_plan: input?.cloudSchemaMigrationPlan ?? null,
    web_beta_launch_checklist: input?.webBetaLaunchChecklist ?? null,
    web_beta_environment_preflight:
      input?.webBetaEnvironmentPreflight ?? null,
    sync_api_contracts: SYNC_API_CONTRACTS,
    disabled_api_stubs: WEB_BETA_API_STUBS,
    conflict_policies: CONFLICT_POLICIES,
    deployment_gates: DEPLOYMENT_GATES,
  };
}
