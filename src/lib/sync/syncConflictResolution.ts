import type { AuditTrailPolicy } from "@/lib/security/auditTrailPolicy";
import type { PermissionDecisionReport } from "@/lib/security/permissionDecision";
import type {
  SyncConflictReviewReport,
  SyncConflictSurface,
} from "@/lib/sync/syncConflictReview";
import type { SyncReplayTestPlan } from "@/lib/sync/syncReplayTestPlan";
import type { LocalWorkspaceIdentity } from "@/lib/sync/workspaceIdentity";

export type SyncConflictResolutionStatus =
  | "planned"
  | "manual-confirmation"
  | "blocked";

export type SyncConflictResolutionActionId =
  | "keep-local"
  | "accept-remote"
  | "manual-merge"
  | "append-only"
  | "keep-both"
  | "skip-and-flag";

export type SyncConflictReviewLaneId = "base" | "local" | "remote";

export interface SyncConflictResolutionInput {
  workspaceIdentity: LocalWorkspaceIdentity | null;
  conflictReview: SyncConflictReviewReport;
  replayTestPlan: SyncReplayTestPlan;
  permissionDecisionReport: PermissionDecisionReport | null;
  auditTrailPolicy: AuditTrailPolicy | null;
}

export interface SyncConflictResolutionOption {
  id: SyncConflictResolutionActionId;
  label: string;
  status: SyncConflictResolutionStatus;
  write_status: "disabled";
  applies_to: string[];
  required_evidence: string;
  risk_note: string;
}

export interface SyncConflictResolutionSurfacePlan {
  surface_id: string;
  surface: string;
  status: SyncConflictResolutionStatus;
  severity: SyncConflictSurface["severity"];
  active_local_tables: string[];
  default_action: SyncConflictResolutionActionId;
  allowed_actions: SyncConflictResolutionActionId[];
  blocked_actions: SyncConflictResolutionActionId[];
  apply_status: "disabled";
  review_contract: string;
  privacy_boundary: string;
}

export interface SyncConflictResolutionGate {
  id: string;
  title: string;
  status: SyncConflictResolutionStatus;
  evidence: string;
  required_action: string;
}

export interface SyncConflictReviewLane {
  id: SyncConflictReviewLaneId;
  title: string;
  status: SyncConflictResolutionStatus;
  source: string;
  evidence_placeholder: string;
  privacy_boundary: string;
}

export interface SyncConflictReviewActionButton {
  id: SyncConflictResolutionActionId;
  label: string;
  enabled: false;
  disabled_reason: string;
}

export interface SyncConflictReviewSurfaceUi {
  surface_id: string;
  surface: string;
  status: SyncConflictResolutionStatus;
  severity: SyncConflictSurface["severity"];
  lanes: SyncConflictReviewLane[];
  action_buttons: SyncConflictReviewActionButton[];
  selected_action: null;
  can_apply_now: false;
  apply_disabled_reason: string;
  confirmation_required: true;
  rollback_snapshot_required: true;
  audit_event_required: true;
}

export interface SyncConflictReviewUiContract {
  status: "local-side-by-side-preview-only";
  route: "/modules/sync";
  can_select_actions_now: false;
  can_apply_actions_now: false;
  privacy_note: string;
  boundary: {
    local_ui_only: true;
    uses_placeholder_evidence: true;
    reads_remote_data: false;
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_comment_bodies: false;
    reads_file_bytes: false;
    writes_workspace_data: false;
    uploads_workspace_data: false;
    action_buttons_disabled: true;
  };
  lane_order: SyncConflictReviewLaneId[];
  surface_reviews: SyncConflictReviewSurfaceUi[];
  checklist: string[];
}

export interface SyncConflictResolutionContract {
  format: "zhinote-sync-conflict-resolution-contract";
  format_version: 1;
  contract_status: "local-resolution-contract-only";
  can_apply_resolution_now: false;
  disabled_apply_path: "/api/sync/pull";
  privacy_note: string;
  boundary: {
    local_contract_only: true;
    reads_remote_data: false;
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_comment_bodies: false;
    reads_file_bytes: false;
    merges_changes: false;
    applies_remote_changes: false;
    writes_workspace_data: false;
    updates_permissions: false;
    runs_restore: false;
    uploads_workspace_data: false;
    connects_cloud_services: false;
    acknowledges_remote_rows: false;
    requires_side_by_side_review: true;
    requires_owner_confirmation_before_apply: true;
    requires_audit_event_before_apply: true;
    requires_rollback_snapshot_before_apply: true;
  };
  local_evidence: {
    workspace_id: string | null;
    device_id: string | null;
    cloud_status: LocalWorkspaceIdentity["cloud_status"] | "missing";
    conflict_surfaces: number;
    replay_blocked_gates: number;
    permission_confirmations_required: number;
    audit_policy_events: number;
  };
  summary: {
    surfaces: number;
    options: number;
    disabled_apply_paths: number;
    blocked_gates: number;
    manual_confirmation_gates: number;
    high_severity_surfaces: number;
    remote_baseline_required: number;
    side_by_side_surfaces: number;
  };
  review_ui: SyncConflictReviewUiContract;
  options: SyncConflictResolutionOption[];
  surface_plans: SyncConflictResolutionSurfacePlan[];
  gates: SyncConflictResolutionGate[];
  final_enablement_conditions: string[];
}

export function buildSyncConflictResolutionContract(
  input: SyncConflictResolutionInput
): SyncConflictResolutionContract {
  const options = buildResolutionOptions();
  const surfacePlans = input.conflictReview.surfaces.map(buildSurfacePlan);
  const reviewUi = buildSideBySideReviewUi(surfacePlans);
  const gates = buildResolutionGates(input);

  return {
    format: "zhinote-sync-conflict-resolution-contract",
    format_version: 1,
    contract_status: "local-resolution-contract-only",
    can_apply_resolution_now: false,
    disabled_apply_path: "/api/sync/pull",
    privacy_note:
      "Generated locally. This conflict resolution contract does not read remote data, page body text, database row values, comment bodies, or file bytes. It does not merge changes, apply remote rows, write workspace data, update permissions, run restore, upload data, connect cloud services, or acknowledge remote rows.",
    boundary: {
      local_contract_only: true,
      reads_remote_data: false,
      reads_page_body_text: false,
      reads_database_row_values: false,
      reads_comment_bodies: false,
      reads_file_bytes: false,
      merges_changes: false,
      applies_remote_changes: false,
      writes_workspace_data: false,
      updates_permissions: false,
      runs_restore: false,
      uploads_workspace_data: false,
      connects_cloud_services: false,
      acknowledges_remote_rows: false,
      requires_side_by_side_review: true,
      requires_owner_confirmation_before_apply: true,
      requires_audit_event_before_apply: true,
      requires_rollback_snapshot_before_apply: true,
    },
    local_evidence: {
      workspace_id: input.workspaceIdentity?.workspace_id ?? null,
      device_id: input.workspaceIdentity?.device_id ?? null,
      cloud_status: input.workspaceIdentity?.cloud_status ?? "missing",
      conflict_surfaces: input.conflictReview.summary.surfaces,
      replay_blocked_gates: input.replayTestPlan.summary.blocked,
      permission_confirmations_required:
        input.permissionDecisionReport?.summary.needs_confirmation ?? 0,
      audit_policy_events: input.auditTrailPolicy?.summary.events ?? 0,
    },
    summary: {
      surfaces: surfacePlans.length,
      options: options.length,
      disabled_apply_paths: surfacePlans.length,
      blocked_gates: gates.filter((gate) => gate.status === "blocked").length,
      manual_confirmation_gates: gates.filter(
        (gate) => gate.status === "manual-confirmation"
      ).length,
      high_severity_surfaces: surfacePlans.filter(
        (surface) => surface.severity === "high"
      ).length,
      remote_baseline_required:
        input.conflictReview.summary.needs_remote_baseline,
      side_by_side_surfaces: reviewUi.surface_reviews.length,
    },
    review_ui: reviewUi,
    options,
    surface_plans: surfacePlans,
    gates,
    final_enablement_conditions: [
      "Authenticated workspace membership and server permission checks are enabled.",
      "Remote baseline is fetched into a side-by-side review screen without silently applying changes.",
      "Page body, database row, comment, file, permission, and restore conflicts display exact local/remote evidence before apply.",
      "Owner confirms high-risk permission and restore conflicts with a dedicated confirmation step.",
      "A rollback snapshot and redacted audit event exist before any conflict resolution writes local workspace data.",
      "Failed apply and retry behavior is proven in disposable beta sync replay tests.",
    ],
  };
}

function buildSideBySideReviewUi(
  surfacePlans: SyncConflictResolutionSurfacePlan[]
): SyncConflictReviewUiContract {
  return {
    status: "local-side-by-side-preview-only",
    route: "/modules/sync",
    can_select_actions_now: false,
    can_apply_actions_now: false,
    privacy_note:
      "Rendered locally as a side-by-side preview. It uses placeholders for base, local, and remote evidence. It does not read remote data, page text, database row values, comment bodies, or file bytes, and all action buttons remain disabled.",
    boundary: {
      local_ui_only: true,
      uses_placeholder_evidence: true,
      reads_remote_data: false,
      reads_page_body_text: false,
      reads_database_row_values: false,
      reads_comment_bodies: false,
      reads_file_bytes: false,
      writes_workspace_data: false,
      uploads_workspace_data: false,
      action_buttons_disabled: true,
    },
    lane_order: ["base", "local", "remote"],
    surface_reviews: surfacePlans.map(buildSurfaceReviewUi),
    checklist: [
      "Show base, local, and remote evidence in three lanes before any conflict action is enabled.",
      "Keep action selection disabled until remote baseline, rollback snapshot, permission check, and audit event exist.",
      "Never load page body text, row values, comment bodies, or file bytes into this preview contract.",
      "Require owner confirmation before apply, especially for permissions and restore conflicts.",
    ],
  };
}

function buildSurfaceReviewUi(
  surface: SyncConflictResolutionSurfacePlan
): SyncConflictReviewSurfaceUi {
  return {
    surface_id: surface.surface_id,
    surface: surface.surface,
    status: surface.status,
    severity: surface.severity,
    lanes: buildReviewLanes(surface),
    action_buttons: surface.allowed_actions.map((actionId) =>
      buildReviewActionButton(actionId)
    ),
    selected_action: null,
    can_apply_now: false,
    apply_disabled_reason:
      "Apply is disabled until exact base/local/remote evidence, rollback snapshot, permission check, audit event, and owner confirmation are available.",
    confirmation_required: true,
    rollback_snapshot_required: true,
    audit_event_required: true,
  };
}

function buildReviewLanes(
  surface: SyncConflictResolutionSurfacePlan
): SyncConflictReviewLane[] {
  return [
    {
      id: "base",
      title: "Base",
      status: "blocked",
      source: "Last common version",
      evidence_placeholder:
        "Base version id, checksum, updated_at, and source device will appear here after baseline fetch.",
      privacy_boundary:
        "No page text, row values, comment bodies, or file bytes are loaded into the preview.",
    },
    {
      id: "local",
      title: "Local",
      status: "manual-confirmation",
      source: surface.active_local_tables.length
        ? surface.active_local_tables.join(", ")
        : "No pending local table rows",
      evidence_placeholder:
        "Local pending metadata, version id, checksum, and affected table group will appear here.",
      privacy_boundary:
        "Local evidence is metadata-only until the user opens a dedicated review surface.",
    },
    {
      id: "remote",
      title: "Remote",
      status: "blocked",
      source: "Remote latest not fetched",
      evidence_placeholder:
        "Remote latest version id, checksum, updated_at, and author metadata will appear here after auth.",
      privacy_boundary:
        "No cloud service is contacted and no remote rows are acknowledged by this preview.",
    },
  ];
}

function buildReviewActionButton(
  id: SyncConflictResolutionActionId
): SyncConflictReviewActionButton {
  return {
    id,
    label: getActionLabel(id),
    enabled: false,
    disabled_reason:
      "Disabled until side-by-side evidence, rollback, permissions, audit, and owner confirmation gates pass.",
  };
}

function getActionLabel(id: SyncConflictResolutionActionId) {
  switch (id) {
    case "keep-local":
      return "保留本地";
    case "accept-remote":
      return "使用远端";
    case "manual-merge":
      return "手动合并";
    case "append-only":
      return "只追加";
    case "keep-both":
      return "保留两份";
    case "skip-and-flag":
      return "跳过并标记";
    default:
      return id;
  }
}

function buildResolutionOptions(): SyncConflictResolutionOption[] {
  return [
    option(
      "keep-local",
      "保留本地",
      "manual-confirmation",
      ["page-body", "database-row", "file-object", "comments"],
      "Show local pending change, remote latest metadata, and rollback snapshot before apply.",
      "Can discard remote edits; requires side-by-side review."
    ),
    option(
      "accept-remote",
      "使用远端",
      "manual-confirmation",
      ["page-body", "database-row", "file-object", "comments"],
      "Show remote latest content metadata, local pending change, and local rollback snapshot before apply.",
      "Can overwrite local research; never run automatically."
    ),
    option(
      "manual-merge",
      "手动合并",
      "manual-confirmation",
      ["page-body", "database-row"],
      "Open a review surface with local, remote, and base versions before creating a merged draft.",
      "Highest safety for research text and structured tracker values."
    ),
    option(
      "append-only",
      "只追加",
      "manual-confirmation",
      ["comments"],
      "Show comment ids, timestamps, authors, and deleted/edited flags before appending.",
      "Avoids deleting discussion history during beta."
    ),
    option(
      "keep-both",
      "保留两份",
      "manual-confirmation",
      ["file-object", "restore"],
      "Show both object metadata, checksums, and storage scope before creating a duplicate draft.",
      "Safer for files and restore scopes where overwrite is high risk."
    ),
    option(
      "skip-and-flag",
      "跳过并标记",
      "planned",
      ["page-body", "database-row", "file-object", "comments", "permissions", "restore"],
      "Keep the conflict unresolved and visible in the queue.",
      "Default escape hatch when evidence is incomplete."
    ),
  ];
}

function option(
  id: SyncConflictResolutionActionId,
  label: string,
  status: SyncConflictResolutionStatus,
  appliesTo: string[],
  requiredEvidence: string,
  riskNote: string
): SyncConflictResolutionOption {
  return {
    id,
    label,
    status,
    write_status: "disabled",
    applies_to: appliesTo,
    required_evidence: requiredEvidence,
    risk_note: riskNote,
  };
}

function buildSurfacePlan(
  surface: SyncConflictSurface
): SyncConflictResolutionSurfacePlan {
  const actions = getSurfaceActions(surface.id);
  const status: SyncConflictResolutionStatus =
    surface.status === "policy-ready" ? "planned" : "manual-confirmation";

  return {
    surface_id: surface.id,
    surface: surface.surface,
    status,
    severity: surface.severity,
    active_local_tables: surface.active_local_tables,
    default_action: actions.defaultAction,
    allowed_actions: actions.allowedActions,
    blocked_actions: actions.blockedActions,
    apply_status: "disabled",
    review_contract: getSurfaceReviewContract(surface.id),
    privacy_boundary:
      `${surface.privacy_boundary} Resolution planning stays metadata-only and does not apply writes.`,
  };
}

function getSurfaceActions(surfaceId: string): {
  defaultAction: SyncConflictResolutionActionId;
  allowedActions: SyncConflictResolutionActionId[];
  blockedActions: SyncConflictResolutionActionId[];
} {
  switch (surfaceId) {
    case "page-body":
      return {
        defaultAction: "manual-merge",
        allowedActions: ["keep-local", "accept-remote", "manual-merge", "skip-and-flag"],
        blockedActions: ["append-only", "keep-both"],
      };
    case "database-row":
      return {
        defaultAction: "manual-merge",
        allowedActions: ["keep-local", "accept-remote", "manual-merge", "skip-and-flag"],
        blockedActions: ["append-only", "keep-both"],
      };
    case "file-object":
      return {
        defaultAction: "keep-both",
        allowedActions: ["keep-local", "accept-remote", "keep-both", "skip-and-flag"],
        blockedActions: ["manual-merge", "append-only"],
      };
    case "comments":
      return {
        defaultAction: "append-only",
        allowedActions: ["keep-local", "accept-remote", "append-only", "skip-and-flag"],
        blockedActions: ["manual-merge", "keep-both"],
      };
    case "permissions":
      return {
        defaultAction: "skip-and-flag",
        allowedActions: ["skip-and-flag"],
        blockedActions: ["keep-local", "accept-remote", "manual-merge", "append-only", "keep-both"],
      };
    case "restore":
      return {
        defaultAction: "skip-and-flag",
        allowedActions: ["keep-both", "skip-and-flag"],
        blockedActions: ["keep-local", "accept-remote", "manual-merge", "append-only"],
      };
    default:
      return {
        defaultAction: "skip-and-flag",
        allowedActions: ["skip-and-flag"],
        blockedActions: ["keep-local", "accept-remote", "manual-merge", "append-only", "keep-both"],
      };
  }
}

function getSurfaceReviewContract(surfaceId: string) {
  switch (surfaceId) {
    case "page-body":
      return "Use side-by-side base/local/remote diff before writing a merged page draft.";
    case "database-row":
      return "Show same-field conflicts and only auto-preserve non-overlapping field changes after review.";
    case "file-object":
      return "Compare metadata and checksums; file bytes remain immutable until replacement confirmation.";
    case "comments":
      return "Prefer append-only ordering by timestamp; preserve deleted/edited comment recovery metadata.";
    case "permissions":
      return "Never auto-merge role, invite, or sharing changes; owner confirmation is mandatory.";
    case "restore":
      return "Never apply restore conflicts without rollback backup, scope review, and second confirmation.";
    default:
      return "Keep unresolved until a dedicated review contract exists.";
  }
}

function buildResolutionGates(
  input: SyncConflictResolutionInput
): SyncConflictResolutionGate[] {
  return [
    {
      id: "remote-baseline-loaded",
      title: "Remote baseline loaded",
      status:
        input.conflictReview.summary.needs_remote_baseline > 0
          ? "manual-confirmation"
          : "planned",
      evidence: `${input.conflictReview.summary.needs_remote_baseline} surfaces require remote latest before a resolution can be trusted.`,
      required_action:
        "Fetch remote baseline after auth and stage it for review without applying writes.",
    },
    {
      id: "side-by-side-review-ui",
      title: "Side-by-side review UI",
      status: "planned",
      evidence:
        "/modules/sync renders a local base/local/remote side-by-side preview, with placeholder evidence and disabled action buttons.",
      required_action:
        "Wire authenticated remote baseline fetch and exact local/base/remote evidence into the review surface before enabling action selection.",
    },
    {
      id: "permission-check-before-apply",
      title: "Permission check before apply",
      status: input.permissionDecisionReport
        ? "manual-confirmation"
        : "blocked",
      evidence: input.permissionDecisionReport
        ? `${input.permissionDecisionReport.summary.needs_confirmation} permission decisions still require confirmation.`
        : "No permission decision report is attached.",
      required_action:
        "Use /api/permissions/check before any conflict resolution applies local writes.",
    },
    {
      id: "rollback-snapshot-before-apply",
      title: "Rollback snapshot before apply",
      status: "blocked",
      evidence:
        "No conflict-specific rollback snapshot is captured before apply.",
      required_action:
        "Create a local rollback checkpoint for every page, database, file, comment, permission, or restore apply.",
    },
    {
      id: "audit-event-before-apply",
      title: "Audit event before apply",
      status: input.auditTrailPolicy ? "manual-confirmation" : "blocked",
      evidence: input.auditTrailPolicy
        ? `Audit policy covers ${input.auditTrailPolicy.summary.events} event types, but server audit writes remain disabled.`
        : "No audit trail policy is attached.",
      required_action:
        "Write redacted audit metadata before and after conflict resolution apply.",
    },
    {
      id: "disabled-apply-path",
      title: "Apply path remains disabled",
      status: "blocked",
      evidence:
        "/api/sync/pull and replay apply paths remain disabled stubs.",
      required_action:
        "Keep apply disabled until replay, rollback, permissions, audit, and conflict UI are proven.",
    },
  ];
}
