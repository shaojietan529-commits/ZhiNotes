import type { DeploymentGateContract } from "@/lib/sync/webBetaContract";
import type { CloudSchemaMigrationPlan } from "@/lib/sync/cloudSchemaMigrationPlan";
import type { RestoreRollbackPlan } from "@/lib/sync/restoreRollbackPlan";
import type { RestoreWritebackContract } from "@/lib/sync/restoreWritebackContract";
import type { SyncConflictReviewReport } from "@/lib/sync/syncConflictReview";
import type { SyncPayloadPreview } from "@/lib/sync/syncPayloadPreview";
import type { WebBetaEnvironmentPreflight } from "@/lib/sync/webBetaEnvironmentPreflight";
import type { AuditTrailPolicy } from "@/lib/security/auditTrailPolicy";
import type { PermissionDecisionReport } from "@/lib/security/permissionDecision";
import type { AccountSessionBoundary } from "@/lib/security/accountSessionBoundary";
import type { CloudMigrationSqlDraft } from "@/lib/sync/cloudMigrationSqlDraft";
import type { SyncReplayTestPlan } from "@/lib/sync/syncReplayTestPlan";
import { WEB_BETA_API_STUBS } from "@/lib/sync/webBetaApiStubs";
import type { WebBetaApiStubId } from "@/lib/sync/webBetaApiStubs";

export type WebBetaLaunchStatus =
  | "ready"
  | "partial"
  | "manual-confirmation"
  | "blocked";

export interface WebBetaLaunchChecklistInput {
  activePages: number;
  databases: number;
  uploadedFiles: number;
  syncRows: number;
  pendingSyncRows: number;
  disabledApiStubs: number;
  deploymentGates: DeploymentGateContract[];
  cloudSchemaMigrationPlan: CloudSchemaMigrationPlan | null;
  restoreRollbackPlan: RestoreRollbackPlan | null;
  restoreWritebackContract: RestoreWritebackContract | null;
  syncPayloadPreview: SyncPayloadPreview | null;
  conflictReview: SyncConflictReviewReport | null;
  environmentPreflight: WebBetaEnvironmentPreflight | null;
  auditTrailPolicy: AuditTrailPolicy | null;
  permissionDecisionReport: PermissionDecisionReport | null;
  accountSessionBoundary: AccountSessionBoundary | null;
  cloudMigrationSqlDraft: CloudMigrationSqlDraft | null;
  syncReplayTestPlan: SyncReplayTestPlan | null;
}

export interface WebBetaLaunchTrack {
  id: string;
  title: string;
  status: WebBetaLaunchStatus;
  evidence: string;
  required_action: string;
}

export interface WebBetaRouteCheck {
  method: "GET" | "POST";
  route: string;
  surface: "workspace" | "module" | "api";
  status: "local-route" | "disabled-stub" | "cloud-alpha-gated" | "blocked";
  required_action: string;
}

export interface WebBetaLaunchChecklist {
  format: "zhinote-web-beta-launch-checklist";
  format_version: 1;
  checklist_status: "local-checklist-only";
  launch_verdict: "not-ready";
  privacy_note: string;
  boundary: {
    local_checklist_only: true;
    deploys_app: false;
    creates_accounts: false;
    connects_cloud_services: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    requires_owner_confirmation_before_beta: true;
  };
  local_evidence: {
    active_pages: number;
    databases: number;
    uploaded_files: number;
    sync_log_rows: number;
    pending_sync_rows: number;
    disabled_api_stubs: number;
    deployment_gates: number;
    restore_writeback_contract: "present" | "missing";
  };
  summary: {
    tracks: number;
    ready: number;
    partial: number;
    manual_confirmation: number;
    blocked: number;
    local_routes: number;
    disabled_stub_routes: number;
    cloud_alpha_gated_routes: number;
  };
  tracks: WebBetaLaunchTrack[];
  routes: WebBetaRouteCheck[];
}

export function buildWebBetaLaunchChecklist(
  input: WebBetaLaunchChecklistInput
): WebBetaLaunchChecklist {
  const tracks = buildLaunchTracks(input);
  const routes = buildRouteChecks();
  const summary = summarizeLaunchChecklist(tracks, routes);

  return {
    format: "zhinote-web-beta-launch-checklist",
    format_version: 1,
    checklist_status: "local-checklist-only",
    launch_verdict: "not-ready",
    privacy_note:
      "Generated locally. This checklist does not deploy the app, create accounts, connect cloud services, write server data, upload workspace data, or share notes.",
    boundary: {
      local_checklist_only: true,
      deploys_app: false,
      creates_accounts: false,
      connects_cloud_services: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      requires_owner_confirmation_before_beta: true,
    },
    local_evidence: {
      active_pages: input.activePages,
      databases: input.databases,
      uploaded_files: input.uploadedFiles,
      sync_log_rows: input.syncRows,
      pending_sync_rows: input.pendingSyncRows,
      disabled_api_stubs: input.disabledApiStubs,
      deployment_gates: input.deploymentGates.length,
      restore_writeback_contract: input.restoreWritebackContract
        ? "present"
        : "missing",
    },
    summary,
    tracks,
    routes,
  };
}

function buildLaunchTracks(
  input: WebBetaLaunchChecklistInput
): WebBetaLaunchTrack[] {
  const blockedDeploymentGates = input.deploymentGates.filter(
    (gate) => gate.status === "blocked"
  ).length;

  return [
    {
      id: "local-workspace",
      title: "Local workspace remains usable",
      status: "partial",
      evidence: `${input.activePages} active pages, ${input.databases} databases, and ${input.uploadedFiles} uploaded files are visible locally.`,
      required_action:
        "Keep local workspace as source of truth until account login and beta sync are explicitly enabled.",
    },
    {
      id: "auth-and-permissions",
      title: "Auth and server-side permissions",
      status: "blocked",
      evidence: input.permissionDecisionReport
        ? `${input.disabledApiStubs} Web Beta API routes are disabled stubs; local permission decisions cover ${input.permissionDecisionReport.summary.matrix_decisions} role/resource/action combinations and the sync UI exports a metadata-only permission check envelope, but server enforcement is disabled.`
        : `${input.disabledApiStubs} Web Beta API routes are disabled stubs; auth/session routes do not create sessions.`,
      required_action:
        "Choose auth provider, session storage, workspace membership model, permission envelope validation, and server-side role enforcement.",
    },
    {
      id: "account-session-boundary",
      title: "Account and device session boundary",
      status: input.accountSessionBoundary ? "partial" : "blocked",
      evidence: input.accountSessionBoundary
        ? `Account/session boundary covers ${input.accountSessionBoundary.summary.phases} phases and ${input.accountSessionBoundary.summary.forbidden_fields} forbidden credential fields; auth routes remain disabled.`
        : "No account/session boundary is attached to this launch checklist.",
      required_action:
        "Implement provider selection, secure cookies, device revoke, workspace membership, and local-to-cloud owner confirmation before login is enabled.",
    },
    {
      id: "cloud-schema-migrations",
      title: "Cloud schema migrations",
      status: input.cloudSchemaMigrationPlan ? "partial" : "blocked",
      evidence: input.cloudSchemaMigrationPlan && input.cloudMigrationSqlDraft
        ? `Migration plan covers ${input.cloudSchemaMigrationPlan.summary.contracted_tables} contracted tables and SQL draft includes ${input.cloudMigrationSqlDraft.summary.statements} statements; apply remains disabled.`
        : input.cloudSchemaMigrationPlan
          ? `Migration plan covers ${input.cloudSchemaMigrationPlan.summary.contracted_tables} contracted tables, but creates no real migrations.`
        : "No local cloud schema migration plan is available.",
      required_action:
        "Create reversible migrations and prove rollback on a clean beta environment.",
    },
    {
      id: "cloud-migration-sql",
      title: "Cloud migration SQL draft",
      status: input.cloudMigrationSqlDraft ? "partial" : "blocked",
      evidence: input.cloudMigrationSqlDraft
        ? `SQL draft includes ${input.cloudMigrationSqlDraft.summary.statements} DDL statements and ${input.cloudMigrationSqlDraft.summary.blocked} blocked apply gates; no SQL is applied.`
        : "No cloud migration SQL draft is attached to this launch checklist.",
      required_action:
        "Review SQL, run disposable database replay, prove rollback, and require owner approval before enabling migration apply.",
    },
    {
      id: "private-file-storage",
      title: "Private file storage",
      status: "blocked",
      evidence: `${input.uploadedFiles} local files would need private buckets, checksums, signed URLs, and size limits before sync.`,
      required_action:
        "Configure private object storage before syncing HTML reports, PDFs, Office files, archives, or notebooks.",
    },
    {
      id: "sync-replay",
      title: "Sync push/pull replay",
      status: "blocked",
      evidence: input.syncReplayTestPlan
        ? `${input.syncRows} sync_log rows exist locally; replay plan covers ${input.syncReplayTestPlan.summary.scenarios} scenarios and ${input.syncReplayTestPlan.summary.blocked} blocked gates.`
        : `${input.syncRows} sync_log rows exist locally; ${input.pendingSyncRows} rows are pending.`,
      required_action:
        "Implement push/pull endpoints, cursors, acknowledgements, retries, and durable remote persistence.",
    },
    {
      id: "conflict-review",
      title: "Conflict review",
      status: input.conflictReview ? "partial" : "blocked",
      evidence: input.conflictReview
        ? `Conflict scaffold covers ${input.conflictReview.summary.surfaces} surfaces, and sync UI includes local-only side-by-side, baseline request, staging, schema/cursor proof, disposable replay/RLS proof contracts, disposable replay confirmation receipt, empty-fixture replay package, harness preflight, and disabled runner skeleton. It still does not read remote baselines.`
        : "No local conflict review scaffold is available.",
      required_action:
        "Export owner confirmation, empty-fixture package, harness preflight, and disabled runner skeleton, run disposable replay/RLS proof on empty workspace fixtures, prove rollback, and require owner confirmation before multi-device editing.",
    },
    {
      id: "restore-and-rollback",
      title: "Backup restore and rollback",
      status:
        input.restoreRollbackPlan && input.restoreWritebackContract
          ? "partial"
          : "manual-confirmation",
      evidence: input.restoreRollbackPlan && input.restoreWritebackContract
        ? `Restore rollback plan status is ${input.restoreRollbackPlan.plan_status}; write-back contract covers ${input.restoreWritebackContract.summary.stages} stages and disabled endpoint ${input.restoreWritebackContract.disabled_endpoint}.`
        : input.restoreRollbackPlan
          ? `Restore rollback plan status is ${input.restoreRollbackPlan.plan_status}; write-back contract is missing.`
        : "Restore rollback plan is missing.",
      required_action:
        "Require fresh rollback backup, restore scope review, permission check, audit event, sync replay safety, failure recovery proof, and second confirmation before restore write-back.",
    },
    {
      id: "payload-confirmations",
      title: "High-risk payload confirmations",
      status: input.syncPayloadPreview ? "partial" : "manual-confirmation",
      evidence:
        input.syncPayloadPreview && input.permissionDecisionReport
          ? `Sync payload preview covers ${input.syncPayloadPreview.summary.pending_count} pending rows and permission decisions flag ${input.permissionDecisionReport.summary.needs_confirmation} local actions for manual confirmation. Disposable replay has its own local confirmation receipt, empty-fixture package, harness preflight, and disabled runner skeleton before any empty-data replay.`
          : input.syncPayloadPreview
            ? `Sync payload preview covers ${input.syncPayloadPreview.summary.pending_count} pending rows without page text or file bytes.`
            : "No local sync payload preview is available.",
      required_action:
        "Make payload preview, replay receipts, empty-fixture packages, harness preflights, and disabled runner skeletons mandatory before cloud sync, disposable replay, AI execution, external asset loading, sharing, or bulk delete.",
    },
    {
      id: "environment-preflight",
      title: "Environment preflight",
      status:
        input.environmentPreflight &&
        input.environmentPreflight.summary.missing_required === 0
          ? "partial"
          : "blocked",
      evidence: input.environmentPreflight
        ? `${input.environmentPreflight.summary.present_required}/${input.environmentPreflight.summary.required} required environment settings are present; secret values are not exposed.`
        : "No local environment preflight result is available.",
      required_action:
        "Configure auth, database, storage, deployment, security, and observability environment variables before private beta.",
    },
    {
      id: "audit-trail",
      title: "Audit trail and retention",
      status: input.auditTrailPolicy ? "partial" : "blocked",
      evidence: input.auditTrailPolicy
        ? `Audit policy covers ${input.auditTrailPolicy.summary.events} event types and ${input.auditTrailPolicy.summary.blocked} blocked audit gates; the sync UI also exports a metadata-only audit event envelope, and server audit writes remain disabled.`
        : "No audit trail policy exists for auth, sync, restore, AI, permission, file, export, or admin actions.",
      required_action:
        "Implement authenticated audit_events writes only after envelope redaction, retention, owner-only audit export, and incident review are proven before private beta.",
    },
    {
      id: "deployment-gates",
      title: "Deployment gates",
      status: blockedDeploymentGates > 0 ? "blocked" : "partial",
      evidence: `${input.deploymentGates.length} deployment gates are contracted; ${blockedDeploymentGates} remain blocked.`,
      required_action:
        "Turn gates into automated checks or explicit launch checklist approvals before private beta.",
    },
    {
      id: "observability",
      title: "Monitoring and audit visibility",
      status: "blocked",
      evidence:
        "No production logs, error monitoring, audit retention, or incident workflow exists yet.",
      required_action:
        "Add audit events, error monitoring, deployment rollback, and user-visible incident recovery before launch.",
    },
  ];
}

function buildRouteChecks(): WebBetaRouteCheck[] {
  return [
    route("GET", "/", "workspace", "local-route", "Keep homepage loading locally."),
    route(
      "GET",
      "/modules",
      "module",
      "local-route",
      "Verify module hub lists all registered modules."
    ),
    route(
      "GET",
      "/modules/company-research",
      "module",
      "local-route",
      "Verify company research module remains local-first."
    ),
    route(
      "GET",
      "/modules/meetings",
      "module",
      "local-route",
      "Verify meetings module does not join calls or publish notes."
    ),
    route(
      "GET",
      "/modules/reports",
      "module",
      "local-route",
      "Verify report module keeps file previews local."
    ),
    route(
      "GET",
      "/modules/portfolio",
      "module",
      "local-route",
      "Verify portfolio module does not connect brokers."
    ),
    route(
      "GET",
      "/modules/research-graph",
      "module",
      "local-route",
      "Verify research graph renders local relation coverage and schema helpers."
    ),
    route(
      "GET",
      "/modules/ai",
      "module",
      "local-route",
      "Verify AI module remains request staging only."
    ),
    route(
      "GET",
      "/modules/sync",
      "module",
      "local-route",
      "Verify Web Beta readiness dashboard renders launch gates."
    ),
    ...WEB_BETA_API_STUBS.map((stub) =>
      route(
        stub.method,
        stub.path,
        "api",
        isCloudAlphaApiStub(stub.id) ? "cloud-alpha-gated" : "disabled-stub",
        stub.future_requirement
      )
    ),
    route(
      "POST",
      "/api/ai/run",
      "api",
      "disabled-stub",
      "Keep disabled until provider, final payload preview, retention, permission, and audit gates are enabled."
    ),
    route(
      "GET",
      "/api/web-beta/environment-preflight",
      "api",
      "local-route",
      "Return presence-only environment readiness without exposing secret values."
    ),
  ];
}

function route(
  method: WebBetaRouteCheck["method"],
  path: string,
  surface: WebBetaRouteCheck["surface"],
  status: WebBetaRouteCheck["status"],
  requiredAction: string
): WebBetaRouteCheck {
  return {
    method,
    route: path,
    surface,
    status,
    required_action: requiredAction,
  };
}

function isCloudAlphaApiStub(id: WebBetaApiStubId) {
  return (
    id === "auth-session" ||
    id === "auth-login-start" ||
    id === "auth-logout" ||
    id === "workspace-list" ||
    id === "workspace-create" ||
    id === "workspace-bootstrap"
  );
}

function summarizeLaunchChecklist(
  tracks: WebBetaLaunchTrack[],
  routes: WebBetaRouteCheck[]
) {
  return tracks.reduce(
    (summary, track) => {
      summary.tracks += 1;
      if (track.status === "ready") summary.ready += 1;
      if (track.status === "partial") summary.partial += 1;
      if (track.status === "manual-confirmation") {
        summary.manual_confirmation += 1;
      }
      if (track.status === "blocked") summary.blocked += 1;
      return summary;
    },
    {
      tracks: 0,
      ready: 0,
      partial: 0,
      manual_confirmation: 0,
      blocked: 0,
      local_routes: routes.filter((item) => item.status === "local-route")
        .length,
      disabled_stub_routes: routes.filter(
        (item) => item.status === "disabled-stub"
      ).length,
      cloud_alpha_gated_routes: routes.filter(
        (item) => item.status === "cloud-alpha-gated"
      ).length,
    }
  );
}
