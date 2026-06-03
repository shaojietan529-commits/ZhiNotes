import type { WorkspaceRestorePreview } from "@/lib/export/workspaceRestore";
import type { SyncLogSummary } from "@/lib/db/local/queries";
import type { LocalWorkspaceIdentity } from "@/lib/sync/workspaceIdentity";

export type RestoreRollbackPlanStatus =
  | "waiting-for-preview"
  | "preview-loaded"
  | "invalid-backup";

export type RestoreRollbackStepStatus =
  | "ready"
  | "pending"
  | "manual-confirmation"
  | "blocked";

export type RestoreRollbackRisk = "low" | "medium" | "high";

export interface RestoreRollbackPlanInput {
  workspaceIdentity: LocalWorkspaceIdentity | null;
  restorePreview: WorkspaceRestorePreview | null;
  localScope: {
    activePages: number;
    deletedPages: number;
    databases: number;
    uploadedFiles: number;
    pendingSyncRows: number;
  };
  syncSummary: SyncLogSummary | null;
}

export interface RestoreRollbackStep {
  id: string;
  title: string;
  status: RestoreRollbackStepStatus;
  evidence: string;
  required_action: string;
}

export interface RestoreScopeRow {
  id: string;
  label: string;
  current_count: number;
  restore_count: number | null;
  risk: RestoreRollbackRisk;
  write_status: "disabled";
}

export interface RestoreRollbackPlan {
  format: "zhinote-restore-rollback-plan";
  format_version: 1;
  plan_status: RestoreRollbackPlanStatus;
  can_restore_now: false;
  privacy_note: string;
  workspace_identity: {
    workspace_id: string | null;
    device_id: string | null;
    cloud_status: LocalWorkspaceIdentity["cloud_status"] | "missing";
  };
  boundary: {
    dry_run_only: true;
    writes_workspace_data: false;
    overwrites_data: false;
    deletes_data: false;
    uploads_data: false;
    requires_second_confirmation: true;
  };
  local_scope: RestoreRollbackPlanInput["localScope"];
  backup_preview: {
    loaded: boolean;
    valid: boolean;
    format: string | null;
    format_version: number | null;
    exported_at: string | null;
    issues: string[];
    warnings: string[];
  };
  summary: {
    steps: number;
    ready: number;
    pending: number;
    manual_confirmation: number;
    blocked: number;
    high_risk_scopes: number;
  };
  steps: RestoreRollbackStep[];
  scopes: RestoreScopeRow[];
}

export function buildRestoreRollbackPlan(
  input: RestoreRollbackPlanInput
): RestoreRollbackPlan {
  const planStatus = getPlanStatus(input.restorePreview);
  const steps = buildSteps(input, planStatus);
  const scopes = buildScopes(input);
  const summary = summarizePlan(steps, scopes);

  return {
    format: "zhinote-restore-rollback-plan",
    format_version: 1,
    plan_status: planStatus,
    can_restore_now: false,
    privacy_note:
      "Generated locally. This rollback plan is dry-run only. It does not restore, overwrite, delete, upload, sync, or share workspace data.",
    workspace_identity: {
      workspace_id: input.workspaceIdentity?.workspace_id ?? null,
      device_id: input.workspaceIdentity?.device_id ?? null,
      cloud_status: input.workspaceIdentity?.cloud_status ?? "missing",
    },
    boundary: {
      dry_run_only: true,
      writes_workspace_data: false,
      overwrites_data: false,
      deletes_data: false,
      uploads_data: false,
      requires_second_confirmation: true,
    },
    local_scope: input.localScope,
    backup_preview: {
      loaded: Boolean(input.restorePreview),
      valid: Boolean(input.restorePreview?.valid),
      format: input.restorePreview?.format ?? null,
      format_version: input.restorePreview?.formatVersion ?? null,
      exported_at: input.restorePreview?.exportedAt ?? null,
      issues: input.restorePreview?.issues ?? [],
      warnings: input.restorePreview?.warnings ?? [],
    },
    summary,
    steps,
    scopes,
  };
}

function getPlanStatus(
  preview: WorkspaceRestorePreview | null
): RestoreRollbackPlanStatus {
  if (!preview) return "waiting-for-preview";
  return preview.valid ? "preview-loaded" : "invalid-backup";
}

function buildSteps(
  input: RestoreRollbackPlanInput,
  planStatus: RestoreRollbackPlanStatus
): RestoreRollbackStep[] {
  const preview = input.restorePreview;
  const hasPreview = Boolean(preview);
  const hasPendingSync = (input.syncSummary?.pending ?? 0) > 0;

  return [
    {
      id: "select-backup",
      title: "Select local backup",
      status: hasPreview ? "ready" : "pending",
      evidence: hasPreview
        ? "A local backup package has been selected for dry-run preview."
        : "No backup package has been selected in this session.",
      required_action:
        "Choose a local ZhiNotes backup JSON before any restore can be planned.",
    },
    {
      id: "validate-backup",
      title: "Validate backup format",
      status:
        planStatus === "preview-loaded"
          ? "ready"
          : planStatus === "invalid-backup"
            ? "blocked"
            : "pending",
      evidence: preview
        ? `${preview.format ?? "unknown"} v${preview.formatVersion ?? "unknown"} with ${preview.issues.length} issues and ${preview.warnings.length} warnings.`
        : "Backup format has not been checked yet.",
      required_action:
        "Only zhinote-workspace-backup format version 1 should be eligible for restore planning.",
    },
    {
      id: "export-rollback",
      title: "Export current workspace rollback",
      status: "manual-confirmation",
      evidence:
        "Local Backup JSON export exists, but a rollback snapshot must be created immediately before write-back.",
      required_action:
        "Download a fresh current-workspace backup and keep it before enabling restore write-back.",
    },
    {
      id: "review-scope",
      title: "Review restore scope",
      status: preview?.valid ? "ready" : "pending",
      evidence: preview?.valid
        ? `${preview.counts.activePages} active pages, ${preview.counts.databases} databases, and ${preview.counts.uploadedFiles} uploaded files are in the selected backup.`
        : "Restore scope cannot be trusted until the backup preview is valid.",
      required_action:
        "Review active pages, trash pages, versions, comments, databases, files, favorites, and locked pages.",
    },
    {
      id: "clear-sync-risk",
      title: "Clear pending sync risk",
      status: hasPendingSync ? "manual-confirmation" : "ready",
      evidence: hasPendingSync
        ? `${input.syncSummary?.pending ?? 0} local sync rows are pending and may conflict with restore.`
        : "No pending sync rows are currently reported.",
      required_action:
        "Resolve or export sync queue metadata before enabling restore write-back.",
    },
    {
      id: "second-confirmation",
      title: "Require second confirmation",
      status: "blocked",
      evidence:
        "Restore write-back is intentionally disabled in the current app.",
      required_action:
        "Add a dedicated confirmation screen before any restore writes, overwrites, or deletes workspace data.",
    },
  ];
}

function buildScopes(input: RestoreRollbackPlanInput): RestoreScopeRow[] {
  const preview = input.restorePreview;
  return [
    scope(
      "active-pages",
      "Active pages",
      input.localScope.activePages,
      preview?.counts.activePages ?? null,
      "high"
    ),
    scope(
      "trash-pages",
      "Trash pages",
      input.localScope.deletedPages,
      preview?.counts.deletedPages ?? null,
      "medium"
    ),
    scope(
      "page-versions",
      "Page versions",
      0,
      preview?.counts.pageVersions ?? null,
      "high"
    ),
    scope(
      "page-comments",
      "Page comments",
      0,
      preview?.counts.pageComments ?? null,
      "high"
    ),
    scope(
      "block-comments",
      "Block comments",
      0,
      preview?.counts.blockComments ?? null,
      "high"
    ),
    scope(
      "databases",
      "Databases",
      input.localScope.databases,
      preview?.counts.databases ?? null,
      "high"
    ),
    scope(
      "database-rows",
      "Database rows",
      0,
      preview?.counts.databaseRows ?? null,
      "high"
    ),
    scope(
      "uploaded-files",
      "Uploaded files",
      input.localScope.uploadedFiles,
      preview?.counts.uploadedFiles ?? null,
      "high"
    ),
    scope(
      "favorites",
      "Favorites",
      0,
      preview?.counts.favoritePages ?? null,
      "low"
    ),
    scope(
      "locked-pages",
      "Locked pages",
      0,
      preview?.counts.lockedPages ?? null,
      "medium"
    ),
  ];
}

function scope(
  id: string,
  label: string,
  currentCount: number,
  restoreCount: number | null,
  risk: RestoreRollbackRisk
): RestoreScopeRow {
  return {
    id,
    label,
    current_count: currentCount,
    restore_count: restoreCount,
    risk,
    write_status: "disabled",
  };
}

function summarizePlan(
  steps: RestoreRollbackStep[],
  scopes: RestoreScopeRow[]
) {
  return steps.reduce(
    (summary, step) => {
      summary.steps += 1;
      if (step.status === "ready") summary.ready += 1;
      if (step.status === "pending") summary.pending += 1;
      if (step.status === "manual-confirmation") {
        summary.manual_confirmation += 1;
      }
      if (step.status === "blocked") summary.blocked += 1;
      return summary;
    },
    {
      steps: 0,
      ready: 0,
      pending: 0,
      manual_confirmation: 0,
      blocked: 0,
      high_risk_scopes: scopes.filter((item) => item.risk === "high").length,
    }
  );
}
