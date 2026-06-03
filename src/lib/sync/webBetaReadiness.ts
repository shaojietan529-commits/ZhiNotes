import { DEPLOYMENT_GATES } from "@/lib/sync/webBetaContract";
import type { PageFileKind } from "@/lib/files/localStore";
import type { SyncLogSummary } from "@/lib/db/local/queries";
import type { LocalWorkspaceIdentity } from "@/lib/sync/workspaceIdentity";
import type { SyncPayloadPreview } from "@/lib/sync/syncPayloadPreview";
import type { SyncConflictReviewReport } from "@/lib/sync/syncConflictReview";
import type { RestoreRollbackPlan } from "@/lib/sync/restoreRollbackPlan";
import type { RestoreWritebackContract } from "@/lib/sync/restoreWritebackContract";
import { WEB_BETA_API_STUBS } from "@/lib/sync/webBetaApiStubs";
import type { CloudSchemaMigrationPlan } from "@/lib/sync/cloudSchemaMigrationPlan";
import type { WebBetaLaunchChecklist } from "@/lib/sync/webBetaLaunchChecklist";
import type { WebBetaEnvironmentPreflight } from "@/lib/sync/webBetaEnvironmentPreflight";
import type { AuditTrailPolicy } from "@/lib/security/auditTrailPolicy";
import type { PermissionDecisionReport } from "@/lib/security/permissionDecision";
import type { AccountSessionBoundary } from "@/lib/security/accountSessionBoundary";
import type { CloudMigrationSqlDraft } from "@/lib/sync/cloudMigrationSqlDraft";
import type { SyncReplayTestPlan } from "@/lib/sync/syncReplayTestPlan";
import type { WebBetaDeploymentTarget } from "@/lib/sync/webBetaDeploymentTarget";

export type WebBetaReadinessStatus =
  | "ready"
  | "partial"
  | "manual-confirmation"
  | "blocked";

export interface WebBetaReadinessInput {
  activePages: number;
  deletedPages: number;
  databases: number;
  uploadedFiles: number;
  fileKinds: Array<{
    kind: PageFileKind;
    count: number;
  }>;
  syncSummary: SyncLogSummary | null;
  restorePreviewLoaded: boolean;
  workspaceIdentity: LocalWorkspaceIdentity | null;
  syncPayloadPreview: SyncPayloadPreview | null;
  conflictReview: SyncConflictReviewReport | null;
  restoreRollbackPlan: RestoreRollbackPlan | null;
  restoreWritebackContract: RestoreWritebackContract | null;
  cloudSchemaMigrationPlan: CloudSchemaMigrationPlan | null;
  webBetaLaunchChecklist: WebBetaLaunchChecklist | null;
  environmentPreflight: WebBetaEnvironmentPreflight | null;
  auditTrailPolicy: AuditTrailPolicy | null;
  permissionDecisionReport: PermissionDecisionReport | null;
  accountSessionBoundary: AccountSessionBoundary | null;
  cloudMigrationSqlDraft: CloudMigrationSqlDraft | null;
  syncReplayTestPlan: SyncReplayTestPlan | null;
  deploymentTarget: WebBetaDeploymentTarget | null;
}

export interface WebBetaReadinessGate {
  id: string;
  title: string;
  status: WebBetaReadinessStatus;
  category: "local" | "cloud" | "security" | "recovery" | "conflict";
  evidence: string;
  nextAction: string;
}

export interface WebBetaReadinessReport {
  format: "zhinote-web-beta-readiness-report";
  format_version: 1;
  report_status: "local-only";
  launch_verdict: "not-ready";
  privacy_note: string;
  local_scope: {
    active_pages: number;
    deleted_pages: number;
    databases: number;
    uploaded_files: number;
    file_kinds: WebBetaReadinessInput["fileKinds"];
    sync_log_rows: number;
    pending_sync_rows: number;
    workspace_id: string | null;
    device_id: string | null;
    cloud_status: LocalWorkspaceIdentity["cloud_status"] | "missing";
    cloud_workspace_id: string | null;
    cloud_role: LocalWorkspaceIdentity["cloud_role"] | null;
    cloud_bootstrap_checked_at: string | null;
    cloud_bootstrap_module_count: number | null;
    cloud_sync_push_enabled: boolean;
    cloud_sync_pull_enabled: boolean;
    cloud_link_proof_status: "present" | "missing";
    workspace_identity_status: "present" | "missing";
    sync_payload_preview_status: "present" | "missing";
    conflict_review_status: "present" | "missing";
    restore_rollback_plan_status: "present" | "missing";
    restore_writeback_contract_status: "present" | "missing";
    cloud_schema_migration_plan_status: "present" | "missing";
    web_beta_launch_checklist_status: "present" | "missing";
    environment_preflight_status: "present" | "missing";
    audit_trail_policy_status: "present" | "missing";
    permission_decision_report_status: "present" | "missing";
    account_session_boundary_status: "present" | "missing";
    cloud_migration_sql_draft_status: "present" | "missing";
    sync_replay_test_plan_status: "present" | "missing";
    deployment_target_status: "present" | "missing";
    disabled_api_stubs: number;
  };
  summary: {
    total_gates: number;
    ready: number;
    partial: number;
    manual_confirmation: number;
    blocked: number;
  };
  gates: WebBetaReadinessGate[];
}

export function buildWebBetaReadinessReport(
  input: WebBetaReadinessInput
): WebBetaReadinessReport {
  const syncRows = input.syncSummary?.total ?? 0;
  const pendingRows = input.syncSummary?.pending ?? 0;
  const syncTables = input.syncSummary?.tables.length ?? 0;
  const cloudGateCount = DEPLOYMENT_GATES.filter(
    (gate) => gate.status === "blocked"
  ).length;
  const linked = input.workspaceIdentity?.cloud_status === "linked-alpha";
  const hasCloudLinkProof = Boolean(
    linked &&
      input.workspaceIdentity?.cloud_bootstrap_checked_at &&
      typeof input.workspaceIdentity.cloud_bootstrap_module_count === "number" &&
      !input.workspaceIdentity.cloud_sync_push_enabled &&
      !input.workspaceIdentity.cloud_sync_pull_enabled
  );

  const gates: WebBetaReadinessGate[] = [
    {
      id: "local-export-coverage",
      title: "Local export coverage",
      status: "ready",
      category: "local",
      evidence:
        "Backup JSON, workspace ZIP, Markdown export, sync queue export, sync replay test plan export, restore rollback plan export, restore write-back contract export, permission policy export, permission decision export, account session boundary export, environment preflight export, cloud schema migration plan export, cloud migration SQL draft export, launch checklist export, contract export, and readiness export are available locally.",
      nextAction:
        "Keep this as the escape hatch before any user opts into beta sync.",
    },
    {
      id: "local-data-foundation",
      title: "Local data foundation",
      status: "ready",
      category: "local",
      evidence: `${input.activePages} active pages, ${input.deletedPages} trash pages, ${input.databases} databases, and ${input.uploadedFiles} uploaded files are visible from the browser-local workspace.`,
      nextAction:
        "Continue using the local workspace as the source of truth until cloud opt-in is explicit.",
    },
    {
      id: "local-workspace-identity",
      title: "Local workspace and device identity",
      status: input.workspaceIdentity ? "partial" : "blocked",
      category: "local",
      evidence: input.workspaceIdentity
        ? `Local workspace ${input.workspaceIdentity.workspace_id} and device ${input.workspaceIdentity.device_id} are available for future sync metadata.`
        : "No local workspace identity is available, so future sync batches cannot be tied to a stable local workspace/device.",
      nextAction:
        "Keep this identity local until the user explicitly opts into account login and cloud sync.",
    },
    {
      id: "cloud-link-proof",
      title: "Cloud workspace link proof",
      status: hasCloudLinkProof ? "partial" : "blocked",
      category: "cloud",
      evidence: hasCloudLinkProof
        ? `Local workspace is linked to cloud workspace ${input.workspaceIdentity?.cloud_workspace_id} as ${input.workspaceIdentity?.cloud_role}; bootstrap proof ${input.workspaceIdentity?.cloud_bootstrap_checked_at} records ${input.workspaceIdentity?.cloud_bootstrap_module_count} modules and push/pull disabled.`
        : linked
          ? "Local workspace has a cloud workspace id, but no valid bootstrap proof with push/pull disabled is recorded."
          : "Local workspace is not linked to a cloud workspace and has no bootstrap membership proof.",
      nextAction:
        "Run Cloud Alpha session check, workspace bootstrap, and local link receipt before any future cloud sync opt-in.",
    },
    {
      id: "account-session-boundary",
      title: "Account session boundary",
      status: input.accountSessionBoundary ? "partial" : "blocked",
      category: "cloud",
      evidence: input.accountSessionBoundary
        ? `A local account/session boundary covers ${input.accountSessionBoundary.summary.phases} phases, ${input.accountSessionBoundary.summary.gates} gates, and ${input.accountSessionBoundary.local_evidence.auth_disabled_routes} disabled auth routes; no account can be created.`
        : "No local account/session boundary exists for login, session read, workspace bootstrap, logout, revoke, or local-to-cloud link decisions.",
      nextAction:
        "Choose auth provider, secure session storage, workspace membership checks, and local-to-cloud owner confirmation before beta login.",
    },
    {
      id: "sync-queue-instrumentation",
      title: "Sync queue instrumentation",
      status: "partial",
      category: "local",
      evidence:
        syncRows > 0
          ? `${syncRows} sync_log rows across ${syncTables} local tables; ${pendingRows} rows are pending.`
          : "sync_log exists and the export path is available, but this workspace currently has no queued rows.",
      nextAction:
        "Build server push/pull replay and acknowledgement before treating queue visibility as real sync.",
    },
    {
      id: "disabled-api-stubs",
      title: "Disabled Web Beta API stubs",
      status: "partial",
      category: "cloud",
      evidence: `${WEB_BETA_API_STUBS.length} local API routes now return disabled Web Beta stubs, so accidental auth, sync, restore, file, and permission calls have an explicit no-op boundary.`,
      nextAction:
        "Replace each disabled stub only after auth, cloud storage, permission checks, audit logs, and rollback paths are implemented.",
    },
    {
      id: "restore-safety",
      title: "Restore safety",
      status:
        input.restoreRollbackPlan?.plan_status === "preview-loaded" &&
        input.restoreWritebackContract
          ? "partial"
          : "manual-confirmation",
      category: "recovery",
      evidence: input.restoreRollbackPlan && input.restoreWritebackContract
        ? `Rollback plan status is ${input.restoreRollbackPlan.plan_status}; write-back contract covers ${input.restoreWritebackContract.summary.stages} stages, ${input.restoreWritebackContract.summary.gates} gates, and disabled endpoint ${input.restoreWritebackContract.disabled_endpoint}.`
        : input.restoreRollbackPlan
          ? `A local rollback plan is available with status ${input.restoreRollbackPlan.plan_status}; restore write-back contract is still missing.`
        : input.restorePreviewLoaded
          ? "A local backup file has been dry-run previewed in this session; restore write-back is still disabled."
          : "Restore dry-run preview is available, but no restore package has been selected in this session.",
      nextAction:
        "Require fresh rollback backup export and a second confirmation screen before restore write-back is enabled.",
    },
    {
      id: "restore-writeback-contract",
      title: "Restore write-back contract",
      status: input.restoreWritebackContract ? "partial" : "blocked",
      category: "recovery",
      evidence: input.restoreWritebackContract
        ? `Local restore write-back contract is present; ${input.restoreWritebackContract.summary.blocked} stages and ${input.restoreWritebackContract.summary.gate_blocked} gates remain blocked while /api/backup/restore-apply is disabled.`
        : "No restore write-back contract is attached to this readiness report.",
      nextAction:
        "Keep restore apply disabled until rollback snapshot, permission check, sync replay safety, audit event, second confirmation, and failure recovery proof exist.",
    },
    {
      id: "permission-policy",
      title: "Permission policy draft",
      status: input.permissionDecisionReport ? "partial" : "blocked",
      category: "security",
      evidence: input.permissionDecisionReport
        ? `Owner, Researcher, and Viewer decisions cover ${input.permissionDecisionReport.summary.matrix_decisions} role/resource/action combinations and ${input.permissionDecisionReport.summary.high_risk_scenarios} high-risk scenarios, but /api/permissions/check remains disabled.`
        : "Owner, Researcher, and Viewer roles are modeled locally, but no permission decision report is available.",
      nextAction:
        "Move role checks to authenticated server endpoints before private beta.",
    },
    {
      id: "high-risk-confirmations",
      title: "High-risk action confirmations",
      status: input.syncPayloadPreview ? "partial" : "manual-confirmation",
      category: "security",
      evidence: input.syncPayloadPreview
        ? `A local sync payload preview is available for ${input.syncPayloadPreview.summary.pending_count} pending rows; it is metadata-only and requires confirmation.`
        : "Cloud sync, restore, AI execution, external assets, sharing, bulk delete, and broker import are listed as explicit confirmation actions.",
      nextAction:
        "Make payload preview a required confirmation screen before enabling any cloud push.",
    },
    {
      id: "environment-preflight",
      title: "Environment preflight",
      status:
        input.environmentPreflight &&
        input.environmentPreflight.summary.missing_required === 0
          ? "partial"
          : "blocked",
      category: "cloud",
      evidence: input.environmentPreflight
        ? `${input.environmentPreflight.summary.present_required}/${input.environmentPreflight.summary.required} required environment settings are present; secret values are not exposed.`
        : "No local environment preflight result is available.",
      nextAction:
        "Configure auth, database, storage, deployment, security, and observability environment variables before private beta.",
    },
    {
      id: "cloud-auth",
      title: "Cloud auth and workspace identity",
      status: "blocked",
      category: "cloud",
      evidence: hasCloudLinkProof
        ? "Cloud Alpha can record account/workspace link metadata after bootstrap proof, but session refresh, server-side role enforcement, and sync membership checks are still incomplete."
        : input.accountSessionBoundary
          ? "A local account/session boundary exists, but login, session refresh, workspace membership, and server-side role enforcement remain disabled."
        : input.workspaceIdentity
          ? "A local anonymous workspace/device identity exists, but no login, session refresh, workspace membership, or server-side role enforcement exists yet."
          : "No login, session refresh, workspace membership, server-side role enforcement, or local identity exists yet.",
      nextAction:
        "Choose and implement the account layer before any cloud workspace can be launched.",
    },
    {
      id: "cloud-schema",
      title: "Cloud database schema",
      status: input.cloudSchemaMigrationPlan ? "partial" : "blocked",
      category: "cloud",
      evidence: input.cloudSchemaMigrationPlan && input.cloudMigrationSqlDraft
        ? `A local cloud schema migration plan covers ${input.cloudSchemaMigrationPlan.summary.contracted_tables} contracted tables, and a SQL draft includes ${input.cloudMigrationSqlDraft.summary.statements} DDL statements; no migrations are applied.`
        : input.cloudSchemaMigrationPlan
          ? `A local cloud schema migration plan covers ${input.cloudSchemaMigrationPlan.summary.contracted_tables} contracted tables and ${input.cloudSchemaMigrationPlan.summary.blocked_steps} blocked migration steps; no real migrations are created.`
        : "Cloud tables are contracted, but migrations, rollback, and remote persistence are not implemented.",
      nextAction:
        "Create versioned migrations for users, workspaces, pages, databases, files, sync_log, permissions, and audit events.",
    },
    {
      id: "cloud-migration-sql-draft",
      title: "Cloud migration SQL draft",
      status: input.cloudMigrationSqlDraft ? "partial" : "blocked",
      category: "cloud",
      evidence: input.cloudMigrationSqlDraft
        ? `A local SQL draft includes ${input.cloudMigrationSqlDraft.summary.statements} statements and ${input.cloudMigrationSqlDraft.summary.blocked} blocked apply gates; /api/cloud/migrations/apply remains disabled.`
        : "No local SQL migration draft exists for the contracted cloud schema.",
      nextAction:
        "Review SQL, prove rollback on a disposable database, and keep migration apply disabled until owner approval and deployment gates pass.",
    },
    {
      id: "sync-api",
      title: "Sync push/pull API",
      status: "blocked",
      category: "cloud",
      evidence: input.syncReplayTestPlan
        ? `A local sync replay test plan covers ${input.syncReplayTestPlan.summary.scenarios} scenarios and ${input.syncReplayTestPlan.summary.blocked} blocked replay gates; push/pull routes remain disabled.`
        : "API routes are contracted and disabled local stubs exist, but no real server endpoints, cursors, retries, or acknowledgements exist.",
      nextAction:
        "Implement push, pull, bootstrap, permission check, restore preview, and private file URL endpoints.",
    },
    {
      id: "sync-replay-test-plan",
      title: "Sync replay test plan",
      status: input.syncReplayTestPlan ? "partial" : "blocked",
      category: "cloud",
      evidence: input.syncReplayTestPlan
        ? `Replay test plan covers push preview, server ack, pull cursor, conflict baseline, retry/idempotency, high-risk gates, and rollback; /api/sync/replay-test remains disabled.`
        : "No local sync replay test plan exists for push/pull, ack, retry, conflict, and rollback behavior.",
      nextAction:
        "Run replay only after auth, permission checks, payload confirmation, audit events, conflict UI, rollback proof, and disposable test data exist.",
    },
    {
      id: "conflict-resolution",
      title: "Conflict resolution UI",
      status: input.conflictReview ? "partial" : "blocked",
      category: "conflict",
      evidence: input.conflictReview
        ? `A local conflict review scaffold covers ${input.conflictReview.summary.surfaces} surfaces, and sync UI now keeps side-by-side review plus remote baseline request, staging, schema/cursor proof, and disposable replay/RLS proof planning local-only. It still does not read remote data or merge changes.`
        : "Conflict policies exist for pages, database rows, files, comments, permissions, and restore, but no review UI is implemented.",
      nextAction:
        "Run disposable replay/RLS proof on empty workspace fixtures, prove rollback, and require owner confirmation before supporting multi-device editing.",
    },
    {
      id: "private-file-storage",
      title: "Private file storage",
      status: "blocked",
      category: "security",
      evidence:
        input.uploadedFiles > 0
          ? `${input.uploadedFiles} local files exist and would need private buckets, signed URLs, checksums, and size limits before sync.`
          : "No local files are uploaded in this workspace, but file sync still needs private storage before beta.",
      nextAction:
        "Do not sync HTML reports, PDFs, Excel, Word, PPT, archives, or notebooks until private storage is configured.",
    },
    {
      id: "web-beta-launch-checklist",
      title: "Web Beta launch checklist",
      status: input.webBetaLaunchChecklist ? "partial" : "blocked",
      category: "security",
      evidence: input.webBetaLaunchChecklist
        ? `A local launch checklist covers ${input.webBetaLaunchChecklist.summary.tracks} tracks and ${input.webBetaLaunchChecklist.summary.blocked} blocked launch items; it does not deploy or connect cloud services.`
        : "No local launch checklist exists yet.",
      nextAction:
        "Turn each checklist item into an automated check, owner approval, or private beta launch gate.",
    },
    {
      id: "audit-trail-policy",
      title: "Audit trail policy",
      status: input.auditTrailPolicy ? "partial" : "blocked",
      category: "security",
      evidence: input.auditTrailPolicy
        ? `A local audit policy covers ${input.auditTrailPolicy.summary.events} event types and ${input.auditTrailPolicy.summary.required_before_private_beta} audit gates; server audit writes remain disabled.`
        : "No local audit trail policy exists for auth, export, restore, sync, sharing, permission, file, AI, or admin actions.",
      nextAction:
        "Implement authenticated audit_events writes, redaction, retention, owner-only audit export, and incident review before private beta.",
    },
    {
      id: "deployment-target-contract",
      title: "Deployment target contract",
      status: input.deploymentTarget ? "partial" : "blocked",
      category: "cloud",
      evidence: input.deploymentTarget
        ? `Deployment target selects ${input.deploymentTarget.selected_strategy.first_web_alpha} for the first Web Alpha, ${input.deploymentTarget.selected_strategy.cloud_backend} for cloud data, and ${input.deploymentTarget.summary.blocked} blocked deployment items remain.`
        : "No deployment target contract exists for Web Alpha hosting, cloud backend, edge layer, secrets, or rollback.",
      nextAction:
        "Use the target contract to decide provider setup, preview deployment, secrets, rollback, and owner confirmation before going live.",
    },
    {
      id: "deployment-gate-contract",
      title: "Deployment gate contract",
      status: "partial",
      category: "security",
      evidence: `${DEPLOYMENT_GATES.length} deployment gates are documented; ${cloudGateCount} are currently marked blocked by design.`,
      nextAction:
        "Turn each deployment gate into an automated test, migration check, or manual launch checklist item.",
    },
  ];

  const summary = summarizeGates(gates);

  return {
    format: "zhinote-web-beta-readiness-report",
    format_version: 1,
    report_status: "local-only",
    launch_verdict: "not-ready",
    privacy_note:
      "Generated locally. This report reads local counts and readiness contracts only; it does not create accounts, connect cloud services, upload notes, sync files, restore backups, or share workspace data.",
    local_scope: {
      active_pages: input.activePages,
      deleted_pages: input.deletedPages,
      databases: input.databases,
      uploaded_files: input.uploadedFiles,
      file_kinds: input.fileKinds,
      sync_log_rows: syncRows,
      pending_sync_rows: pendingRows,
      workspace_id: input.workspaceIdentity?.workspace_id ?? null,
      device_id: input.workspaceIdentity?.device_id ?? null,
      cloud_status: input.workspaceIdentity?.cloud_status ?? "missing",
      cloud_workspace_id: input.workspaceIdentity?.cloud_workspace_id ?? null,
      cloud_role: input.workspaceIdentity?.cloud_role ?? null,
      cloud_bootstrap_checked_at:
        input.workspaceIdentity?.cloud_bootstrap_checked_at ?? null,
      cloud_bootstrap_module_count:
        input.workspaceIdentity?.cloud_bootstrap_module_count ?? null,
      cloud_sync_push_enabled: Boolean(
        input.workspaceIdentity?.cloud_sync_push_enabled
      ),
      cloud_sync_pull_enabled: Boolean(
        input.workspaceIdentity?.cloud_sync_pull_enabled
      ),
      cloud_link_proof_status: hasCloudLinkProof ? "present" : "missing",
      workspace_identity_status: input.workspaceIdentity ? "present" : "missing",
      sync_payload_preview_status: input.syncPayloadPreview
        ? "present"
        : "missing",
      conflict_review_status: input.conflictReview ? "present" : "missing",
      restore_rollback_plan_status: input.restoreRollbackPlan
        ? "present"
        : "missing",
      restore_writeback_contract_status: input.restoreWritebackContract
        ? "present"
        : "missing",
      cloud_schema_migration_plan_status: input.cloudSchemaMigrationPlan
        ? "present"
        : "missing",
      web_beta_launch_checklist_status: input.webBetaLaunchChecklist
        ? "present"
        : "missing",
      environment_preflight_status: input.environmentPreflight
        ? "present"
        : "missing",
      audit_trail_policy_status: input.auditTrailPolicy
        ? "present"
        : "missing",
      permission_decision_report_status: input.permissionDecisionReport
        ? "present"
        : "missing",
      account_session_boundary_status: input.accountSessionBoundary
        ? "present"
        : "missing",
      cloud_migration_sql_draft_status: input.cloudMigrationSqlDraft
        ? "present"
        : "missing",
      sync_replay_test_plan_status: input.syncReplayTestPlan
        ? "present"
        : "missing",
      deployment_target_status: input.deploymentTarget ? "present" : "missing",
      disabled_api_stubs: WEB_BETA_API_STUBS.length,
    },
    summary,
    gates,
  };
}

function summarizeGates(gates: WebBetaReadinessGate[]) {
  return gates.reduce(
    (summary, gate) => {
      summary.total_gates += 1;
      if (gate.status === "ready") summary.ready += 1;
      if (gate.status === "partial") summary.partial += 1;
      if (gate.status === "manual-confirmation") {
        summary.manual_confirmation += 1;
      }
      if (gate.status === "blocked") summary.blocked += 1;
      return summary;
    },
    {
      total_gates: 0,
      ready: 0,
      partial: 0,
      manual_confirmation: 0,
      blocked: 0,
    }
  );
}
