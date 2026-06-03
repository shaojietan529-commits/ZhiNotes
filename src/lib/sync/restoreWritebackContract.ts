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
      "Generated locally. This restore write-back contract does not restore, overwrite, delete, upload, sync, write local workspace data, connect cloud services, read remote data, or read file bytes.",
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
      title: "Select backup package",
      status: hasPreview ? "planned" : "manual-confirmation",
      evidence: hasPreview
        ? "A local backup package has been selected for dry-run preview."
        : "No local backup package has been selected in this browser session.",
      required_action:
        "Keep backup selection as a local file step and require user intent before any preview or write-back.",
      privacy_boundary:
        "Backup selection stays in the browser and does not upload the package.",
    },
    {
      id: "validate-format",
      title: "Validate restore format",
      status: previewValid
        ? "planned"
        : hasPreview
          ? "blocked"
          : "manual-confirmation",
      evidence: input.restorePreview
        ? `${input.restorePreview.format ?? "unknown"} v${input.restorePreview.formatVersion ?? "unknown"} with ${input.restorePreview.issues.length} issues and ${input.restorePreview.warnings.length} warnings.`
        : "Backup format has not been validated yet.",
      required_action:
        "Accept only supported ZhiNotes backup formats before restore scope can be trusted.",
      privacy_boundary:
        "Format validation reads local JSON metadata only and does not write workspace data.",
    },
    {
      id: "export-rollback-snapshot",
      title: "Export rollback snapshot",
      status: hasRollbackPlan ? "manual-confirmation" : "blocked",
      evidence: hasRollbackPlan
        ? `Rollback plan status is ${input.restoreRollbackPlan?.plan_status}; a fresh rollback backup is still required before write-back.`
        : "No rollback plan is attached to this write-back contract.",
      required_action:
        "Require a fresh current-workspace backup immediately before restore write-back can be enabled.",
      privacy_boundary:
        "Rollback export is a local download and should not upload workspace data.",
    },
    {
      id: "review-scope",
      title: "Review restore scope",
      status: previewValid ? "manual-confirmation" : "blocked",
      evidence: previewValid
        ? `${input.restorePreview?.counts.activePages ?? 0} active pages, ${input.restorePreview?.counts.databases ?? 0} databases, and ${input.restorePreview?.counts.uploadedFiles ?? 0} uploaded files are included in the selected backup.`
        : "Restore scope is not eligible for review until a valid backup preview exists.",
      required_action:
        "Show each restore scope and require visible acceptance before any write-back route is enabled.",
      privacy_boundary:
        "Scope review uses counts and labels only; it does not expose page bodies or file bytes.",
    },
    {
      id: "clear-sync-risk",
      title: "Clear pending sync risk",
      status: pendingSyncRows > 0 ? "manual-confirmation" : "planned",
      evidence:
        pendingSyncRows > 0
          ? `${pendingSyncRows} pending sync rows may conflict with restore write-back.`
          : "No pending sync rows are reported by the local rollback plan.",
      required_action:
        "Export or resolve sync queue metadata before restoring data into a workspace that may later sync.",
      privacy_boundary:
        "Sync risk review uses queue metadata only and excludes note text or file content.",
    },
    {
      id: "second-confirmation",
      title: "Second confirmation",
      status: "manual-confirmation",
      evidence:
        "Restore write-back is high-risk and must not run from a single click.",
      required_action:
        "Add a dedicated confirmation screen showing backup source, rollback snapshot, scope, permission decision, and audit event.",
      privacy_boundary:
        "Confirmation should display restore metadata only by default.",
    },
    {
      id: "apply-writeback-disabled",
      title: "Apply write-back disabled",
      status: "blocked",
      evidence:
        "/api/backup/restore-apply is intentionally disabled and cannot write workspace data.",
      required_action:
        "Keep restore apply disabled until rollback, permissions, audit, conflict, and failure recovery are proven.",
      privacy_boundary:
        "The disabled apply route must not read request bodies, restore data, overwrite pages, delete rows, or upload anything.",
    },
    {
      id: "post-restore-audit",
      title: "Post-restore audit",
      status: "blocked",
      evidence: input.auditTrailPolicy
        ? `Audit policy covers ${input.auditTrailPolicy.summary.events} event types, but server audit writes remain disabled.`
        : "No audit policy is attached to this write-back contract.",
      required_action:
        "Record redacted restore audit metadata only after authenticated audit events exist.",
      privacy_boundary:
        "Audit rows should store ids, counts, checksums, and confirmation timestamps, not the full backup payload.",
    },
  ];
}

function buildGates(
  input: RestoreWritebackContractInput
): RestoreWritebackGate[] {
  return [
    {
      id: "disabled-apply-api",
      title: "Restore apply API remains disabled",
      status: "blocked",
      evidence:
        "/api/backup/restore-apply is a disabled local stub and cannot run restore write-back.",
      required_action:
        "Enable only after owner confirmation, rollback proof, permission checks, audit events, and failure recovery are implemented.",
    },
    {
      id: "rollback-snapshot",
      title: "Rollback snapshot required",
      status: input.restoreRollbackPlan ? "manual-confirmation" : "blocked",
      evidence: input.restoreRollbackPlan
        ? `Rollback plan has ${input.restoreRollbackPlan.summary.steps} steps and ${input.restoreRollbackPlan.summary.high_risk_scopes} high-risk scopes.`
        : "No rollback plan is available.",
      required_action:
        "Require a fresh backup of the current workspace immediately before write-back.",
    },
    {
      id: "permission-check",
      title: "Permission check required",
      status: input.permissionDecisionReport
        ? "manual-confirmation"
        : "blocked",
      evidence: input.permissionDecisionReport
        ? `/api/permissions/check remains disabled; ${input.permissionDecisionReport.summary.needs_confirmation} local decisions require confirmation.`
        : "No permission decision report is available.",
      required_action:
        "Move restore permission decisions to authenticated server checks before beta restore.",
    },
    {
      id: "sync-replay-safe",
      title: "Sync replay safety required",
      status: "blocked",
      evidence: input.syncReplayTestPlan
        ? `Sync replay plan has ${input.syncReplayTestPlan.summary.blocked} blocked gates and cannot run replay yet.`
        : "No sync replay safety plan is available.",
      required_action:
        "Prove push, pull, acknowledgement, conflict, retry, and rollback behavior before restore can interact with sync.",
    },
    {
      id: "audit-event",
      title: "Restore audit event required",
      status: "blocked",
      evidence: input.auditTrailPolicy
        ? `${input.auditTrailPolicy.summary.required_before_private_beta} audit gates remain required before private beta.`
        : "No audit trail policy is available.",
      required_action:
        "Create authenticated, redacted server audit events before restore apply can be enabled.",
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
