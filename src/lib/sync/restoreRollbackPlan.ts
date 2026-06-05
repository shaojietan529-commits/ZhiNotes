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
      title: "选择本地备份",
      status: hasPreview ? "ready" : "pending",
      evidence: hasPreview
        ? "已选择一个本地备份包用于干跑预览。"
        : "本次会话还没有选择备份包。",
      required_action: "先选择本地 ZhiNotes 备份 JSON，才能规划恢复。",
    },
    {
      id: "validate-backup",
      title: "验证备份格式",
      status:
        planStatus === "preview-loaded"
          ? "ready"
          : planStatus === "invalid-backup"
            ? "blocked"
            : "pending",
      evidence: preview
        ? `${preview.format ?? "未知"} v${preview.formatVersion ?? "未知"}，包含 ${preview.issues.length} 个问题和 ${preview.warnings.length} 个警告。`
        : "还没有检查备份格式。",
      required_action:
        "只有 zhinote-workspace-backup 格式版本 1 应进入恢复规划。",
    },
    {
      id: "export-rollback",
      title: "导出当前工作区回滚备份",
      status: "manual-confirmation",
      evidence:
        "本地备份 JSON 导出功能已经存在，但写入前必须立即创建回滚快照。",
      required_action:
        "启用恢复写入前，先下载并保留一份最新当前工作区备份。",
    },
    {
      id: "review-scope",
      title: "审阅恢复范围",
      status: preview?.valid ? "ready" : "pending",
      evidence: preview?.valid
        ? `所选备份包含 ${preview.counts.activePages} 个活跃页面、${preview.counts.databases} 个数据库和 ${preview.counts.uploadedFiles} 个上传文件。`
        : "备份预览有效之前，不能信任恢复范围。",
      required_action:
        "审阅活跃页面、回收站页面、版本、评论、数据库、文件、收藏和锁定页面。",
    },
    {
      id: "clear-sync-risk",
      title: "清理待同步风险",
      status: hasPendingSync ? "manual-confirmation" : "ready",
      evidence: hasPendingSync
        ? `${input.syncSummary?.pending ?? 0} 条本地同步行待处理，可能与恢复冲突。`
        : "当前没有待处理同步行。",
      required_action:
        "启用恢复写入前，先解决或导出同步队列 metadata。",
    },
    {
      id: "second-confirmation",
      title: "要求第二次确认",
      status: "blocked",
      evidence:
        "当前 app 中恢复写入被有意禁用。",
      required_action:
        "任何恢复写入、覆盖或删除工作区数据之前，都要加入专门确认页面。",
    },
  ];
}

function buildScopes(input: RestoreRollbackPlanInput): RestoreScopeRow[] {
  const preview = input.restorePreview;
  return [
    scope(
      "active-pages",
      "活跃页面",
      input.localScope.activePages,
      preview?.counts.activePages ?? null,
      "high"
    ),
    scope(
      "trash-pages",
      "回收站页面",
      input.localScope.deletedPages,
      preview?.counts.deletedPages ?? null,
      "medium"
    ),
    scope(
      "page-versions",
      "页面版本",
      0,
      preview?.counts.pageVersions ?? null,
      "high"
    ),
    scope(
      "page-comments",
      "页面评论",
      0,
      preview?.counts.pageComments ?? null,
      "high"
    ),
    scope(
      "block-comments",
      "块评论",
      0,
      preview?.counts.blockComments ?? null,
      "high"
    ),
    scope(
      "databases",
      "数据库",
      input.localScope.databases,
      preview?.counts.databases ?? null,
      "high"
    ),
    scope(
      "database-rows",
      "数据库行",
      0,
      preview?.counts.databaseRows ?? null,
      "high"
    ),
    scope(
      "uploaded-files",
      "上传文件",
      input.localScope.uploadedFiles,
      preview?.counts.uploadedFiles ?? null,
      "high"
    ),
    scope(
      "favorites",
      "收藏页面",
      0,
      preview?.counts.favoritePages ?? null,
      "low"
    ),
    scope(
      "locked-pages",
      "锁定页面",
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
