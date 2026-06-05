import type { WorkspaceRestorePreview } from "@/lib/export/workspaceRestore";
import type { AuditTrailPolicy } from "@/lib/security/auditTrailPolicy";
import type { PermissionDecisionReport } from "@/lib/security/permissionDecision";
import type { RestoreRollbackPlan } from "@/lib/sync/restoreRollbackPlan";
import type { SyncReplayTestPlan } from "@/lib/sync/syncReplayTestPlan";
import type { LocalWorkspaceIdentity } from "@/lib/sync/workspaceIdentity";

export type RestoreWritebackStatus =
  | "planned"
  | "manual-confirmation"
  | "blocked";

export interface RestoreWritebackContractInput {
  workspaceIdentity: LocalWorkspaceIdentity | null;
  restorePreview: WorkspaceRestorePreview | null;
  restoreRollbackPlan: RestoreRollbackPlan | null;
  syncReplayTestPlan: SyncReplayTestPlan | null;
  permissionDecisionReport: PermissionDecisionReport | null;
  auditTrailPolicy: AuditTrailPolicy | null;
}

export interface RestoreWritebackStage {
  id: string;
  title: string;
  status: RestoreWritebackStatus;
  evidence: string;
  required_action: string;
  privacy_boundary: string;
}

export interface RestoreWritebackGate {
  id: string;
  title: string;
  status: RestoreWritebackStatus;
  evidence: string;
  required_action: string;
}

export interface RestoreWritebackScope {
  id: string;
  label: string;
  current_count: number;
  restore_count: number | null;
  risk: "low" | "medium" | "high";
  write_status: "disabled";
}

export interface RestoreWritebackContract {
  format: "zhinote-restore-writeback-contract";
  format_version: 1;
  contract_status: "local-contract-only";
  can_restore_now: false;
  disabled_endpoint: "/api/backup/restore-apply";
  privacy_note: string;
  boundary: {
    local_contract_only: true;
    writes_workspace_data: false;
    overwrites_pages: false;
    deletes_rows: false;
    uploads_workspace_data: false;
    connects_cloud: false;
    reads_file_bytes: false;
    runs_restore: false;
    requires_rollback_snapshot: true;
    requires_permission_check: true;
    requires_audit_event: true;
    requires_second_confirmation: true;
  };
  local_evidence: {
    workspace_id: string | null;
    device_id: string | null;
    restore_preview_loaded: boolean;
    restore_preview_valid: boolean;
    restore_rollback_plan_status: RestoreRollbackPlan["plan_status"] | null;
    restore_scopes: number;
    restore_scopes_previewed: number;
    sync_replay_blocked_gates: number;
    permission_confirmations_required: number;
    audit_events_planned: number;
  };
  summary: {
    stages: number;
    planned: number;
    manual_confirmation: number;
    blocked: number;
    gates: number;
    gate_blocked: number;
    scopes: number;
    scopes_previewed: number;
  };
  stages: RestoreWritebackStage[];
  gates: RestoreWritebackGate[];
  scopes: RestoreWritebackScope[];
}

export function buildRestoreWritebackContract(
  input: RestoreWritebackContractInput
): RestoreWritebackContract {
  const scopes = buildScopes(input.restoreRollbackPlan);
  const stages = buildStages(input);
  const gates = buildGates(input);

  return {
    format: "zhinote-restore-writeback-contract",
    format_version: 1,
    contract_status: "local-contract-only",
    can_restore_now: false,
    disabled_endpoint: "/api/backup/restore-apply",
    privacy_note:
      "本地生成。这个恢复写入合同不会恢复、覆盖、删除、上传、同步、写入本地工作区数据、连接云服务、读取远端数据或读取文件 bytes。",
    boundary: {
      local_contract_only: true,
      writes_workspace_data: false,
      overwrites_pages: false,
      deletes_rows: false,
      uploads_workspace_data: false,
      connects_cloud: false,
      reads_file_bytes: false,
      runs_restore: false,
      requires_rollback_snapshot: true,
      requires_permission_check: true,
      requires_audit_event: true,
      requires_second_confirmation: true,
    },
    local_evidence: {
      workspace_id: input.workspaceIdentity?.workspace_id ?? null,
      device_id: input.workspaceIdentity?.device_id ?? null,
      restore_preview_loaded: Boolean(input.restorePreview),
      restore_preview_valid: Boolean(input.restorePreview?.valid),
      restore_rollback_plan_status:
        input.restoreRollbackPlan?.plan_status ?? null,
      restore_scopes: scopes.length,
      restore_scopes_previewed: scopes.filter(
        (scope) => scope.restore_count !== null
      ).length,
      sync_replay_blocked_gates: input.syncReplayTestPlan?.summary.blocked ?? 0,
      permission_confirmations_required:
        input.permissionDecisionReport?.summary.needs_confirmation ?? 0,
      audit_events_planned: input.auditTrailPolicy?.summary.events ?? 0,
    },
    summary: summarizeContract(stages, gates, scopes),
    stages,
    gates,
    scopes,
  };
}

function buildStages(
  input: RestoreWritebackContractInput
): RestoreWritebackStage[] {
  const hasPreview = Boolean(input.restorePreview);
  const previewValid = Boolean(input.restorePreview?.valid);
  const hasRollbackPlan = Boolean(input.restoreRollbackPlan);
  const pendingSyncRows =
    input.restoreRollbackPlan?.local_scope.pendingSyncRows ?? 0;

  return [
    {
      id: "select-backup",
      title: "选择备份包",
      status: hasPreview ? "planned" : "manual-confirmation",
      evidence: hasPreview
        ? "已选择一个本地备份包用于干跑预览。"
        : "这个浏览器会话还没有选择本地备份包。",
      required_action:
        "备份选择必须保持为本地文件步骤，预览或写入前都需要用户明确意图。",
      privacy_boundary:
        "备份选择停留在浏览器内，不上传备份包。",
    },
    {
      id: "validate-format",
      title: "验证恢复格式",
      status: previewValid
        ? "planned"
        : hasPreview
          ? "blocked"
          : "manual-confirmation",
      evidence: input.restorePreview
        ? `${input.restorePreview.format ?? "未知"} v${input.restorePreview.formatVersion ?? "未知"}，包含 ${input.restorePreview.issues.length} 个问题和 ${input.restorePreview.warnings.length} 个警告。`
        : "还没有验证备份格式。",
      required_action:
        "只有支持的 ZhiNotes 备份格式才能进入可信恢复范围。",
      privacy_boundary:
        "格式验证只读取本地 JSON metadata，不写入工作区数据。",
    },
    {
      id: "export-rollback-snapshot",
      title: "导出回滚快照",
      status: hasRollbackPlan ? "manual-confirmation" : "blocked",
      evidence: hasRollbackPlan
        ? `回滚计划状态为 ${input.restoreRollbackPlan?.plan_status}；写入前仍需要新的回滚备份。`
        : "这个写入合同还没有附加回滚计划。",
      required_action:
        "恢复写入启用前，必须立即生成一份新的当前工作区备份。",
      privacy_boundary:
        "回滚导出是本地下载，不应上传工作区数据。",
    },
    {
      id: "review-scope",
      title: "审阅恢复范围",
      status: previewValid ? "manual-confirmation" : "blocked",
      evidence: previewValid
        ? `所选备份包含 ${input.restorePreview?.counts.activePages ?? 0} 个活跃页面、${input.restorePreview?.counts.databases ?? 0} 个数据库和 ${input.restorePreview?.counts.uploadedFiles ?? 0} 个上传文件。`
        : "有效备份预览存在之前，恢复范围不能进入审阅。",
      required_action:
        "启用任何写入路由前，必须展示每个恢复范围并要求可见确认。",
      privacy_boundary:
        "范围审阅只使用计数和标签，不暴露页面正文或文件 bytes。",
    },
    {
      id: "clear-sync-risk",
      title: "清理待同步风险",
      status: pendingSyncRows > 0 ? "manual-confirmation" : "planned",
      evidence:
        pendingSyncRows > 0
          ? `${pendingSyncRows} 条待同步行可能与恢复写入冲突。`
          : "本地回滚计划没有报告待同步行。",
      required_action:
        "向未来可能同步的工作区恢复数据前，先导出或解决同步队列 metadata。",
      privacy_boundary:
        "同步风险审阅只使用队列 metadata，不包含笔记正文或文件内容。",
    },
    {
      id: "second-confirmation",
      title: "第二次确认",
      status: "manual-confirmation",
      evidence:
        "恢复写入属于高风险动作，不能通过单次点击执行。",
      required_action:
        "加入专门确认页面，显示备份来源、回滚快照、范围、权限决定和审计事件。",
      privacy_boundary:
        "确认页面默认只显示恢复 metadata。",
    },
    {
      id: "apply-writeback-disabled",
      title: "应用写入已禁用",
      status: "blocked",
      evidence:
        "/api/backup/restore-apply 被有意禁用，不能写入工作区数据。",
      required_action:
        "在回滚、权限、审计、冲突处理和失败恢复被证明前，保持恢复应用禁用。",
      privacy_boundary:
        "禁用的应用路由不得读取请求体、恢复数据、覆盖页面、删除行或上传任何内容。",
    },
    {
      id: "post-restore-audit",
      title: "Post-restore audit",
      status: "blocked",
      evidence: input.auditTrailPolicy
        ? `审计策略覆盖 ${input.auditTrailPolicy.summary.events} 类事件，但服务端审计写入仍保持禁用。`
        : "这个写入合同还没有附加审计策略。",
      required_action:
        "只有在已认证审计事件存在后，才记录已脱敏的恢复审计 metadata。",
      privacy_boundary:
        "审计行应存储 id、计数、checksum 和确认时间戳，而不是完整备份 payload。",
    },
  ];
}

function buildGates(
  input: RestoreWritebackContractInput
): RestoreWritebackGate[] {
  return [
    {
      id: "disabled-apply-api",
      title: "恢复应用 API 保持禁用",
      status: "blocked",
      evidence:
        "/api/backup/restore-apply 是禁用的本地 stub，不能执行恢复写入。",
      required_action:
        "只有在 owner 确认、回滚证明、权限检查、审计事件和失败恢复都实现后才能启用。",
    },
    {
      id: "rollback-snapshot",
      title: "需要回滚快照",
      status: input.restoreRollbackPlan ? "manual-confirmation" : "blocked",
      evidence: input.restoreRollbackPlan
        ? `回滚计划包含 ${input.restoreRollbackPlan.summary.steps} 个步骤和 ${input.restoreRollbackPlan.summary.high_risk_scopes} 个高风险范围。`
        : "没有可用的回滚计划。",
      required_action:
        "写入前必须立即生成一份新的当前工作区备份。",
    },
    {
      id: "permission-check",
      title: "需要权限检查",
      status: input.permissionDecisionReport
        ? "manual-confirmation"
        : "blocked",
      evidence: input.permissionDecisionReport
        ? `/api/permissions/check 保持禁用；${input.permissionDecisionReport.summary.needs_confirmation} 个本地决定需要确认。`
        : "没有可用的权限决定报告。",
      required_action:
        "Beta 恢复前，把恢复权限决定迁移到已认证的服务端检查。",
    },
    {
      id: "sync-replay-safe",
      title: "需要同步回放安全证明",
      status: "blocked",
      evidence: input.syncReplayTestPlan
        ? `同步回放计划还有 ${input.syncReplayTestPlan.summary.blocked} 个阻塞 gate，暂时不能运行回放。`
        : "没有可用的同步回放安全计划。",
      required_action:
        "恢复与同步交互前，先证明 push、pull、ack、冲突、重试和回滚行为。",
    },
    {
      id: "audit-event",
      title: "需要恢复审计事件",
      status: "blocked",
      evidence: input.auditTrailPolicy
        ? `Private beta 前仍需要 ${input.auditTrailPolicy.summary.required_before_private_beta} 个审计 gate。`
        : "没有可用的审计轨迹策略。",
      required_action:
        "恢复应用启用前，先创建已认证、已脱敏的服务端审计事件。",
    },
    {
      id: "failure-recovery",
      title: "Failure recovery proof required",
      status: "blocked",
      evidence:
        "No restore write-back runner, partial failure checkpoint, or rollback proof exists yet.",
      required_action:
        "Build disposable restore replay, checkpointing, and failed-restore rollback proof before enabling apply.",
    },
  ];
}

function buildScopes(
  plan: RestoreRollbackPlan | null
): RestoreWritebackScope[] {
  return (
    plan?.scopes.map<RestoreWritebackScope>((scope) => ({
      id: scope.id,
      label: scope.label,
      current_count: scope.current_count,
      restore_count: scope.restore_count,
      risk: scope.risk,
      write_status: "disabled",
    })) ?? []
  );
}

function summarizeContract(
  stages: RestoreWritebackStage[],
  gates: RestoreWritebackGate[],
  scopes: RestoreWritebackScope[]
) {
  return {
    stages: stages.length,
    planned: stages.filter((stage) => stage.status === "planned").length,
    manual_confirmation: stages.filter(
      (stage) => stage.status === "manual-confirmation"
    ).length,
    blocked: stages.filter((stage) => stage.status === "blocked").length,
    gates: gates.length,
    gate_blocked: gates.filter((gate) => gate.status === "blocked").length,
    scopes: scopes.length,
    scopes_previewed: scopes.filter((scope) => scope.restore_count !== null)
      .length,
  };
}
