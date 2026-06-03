import type { AuditTrailPolicy } from "@/lib/security/auditTrailPolicy";
import type { PermissionDecisionReport } from "@/lib/security/permissionDecision";
import type { SyncConflictReviewReport } from "@/lib/sync/syncConflictReview";
import type { SyncPayloadPreview } from "@/lib/sync/syncPayloadPreview";
import type { LocalWorkspaceIdentity } from "@/lib/sync/workspaceIdentity";

export type SyncReplayTestStatus =
  | "planned"
  | "manual-confirmation"
  | "blocked";

export interface SyncReplayTestPlanInput {
  workspaceIdentity: LocalWorkspaceIdentity | null;
  syncPayloadPreview: SyncPayloadPreview;
  conflictReview: SyncConflictReviewReport;
  permissionDecisionReport: PermissionDecisionReport | null;
  auditTrailPolicy: AuditTrailPolicy | null;
}

export interface SyncReplayScenario {
  id: string;
  title: string;
  status: SyncReplayTestStatus;
  endpoint: string;
  evidence: string;
  expected_result: string;
  required_action: string;
  privacy_boundary: string;
}

export interface SyncReplayGate {
  id: string;
  title: string;
  status: SyncReplayTestStatus;
  evidence: string;
  required_action: string;
}

export interface SyncReplayTestPlan {
  format: "zhinote-sync-replay-test-plan";
  format_version: 1;
  plan_status: "local-test-plan-only";
  can_run_replay_now: false;
  disabled_endpoint: "/api/sync/replay-test";
  privacy_note: string;
  boundary: {
    local_test_plan_only: true;
    reads_remote_data: false;
    reads_page_body_text: false;
    reads_file_bytes: false;
    connects_cloud: false;
    uploads_workspace_data: false;
    writes_workspace_data: false;
    acknowledges_remote_rows: false;
    requires_owner_confirmation_before_replay: true;
  };
  local_evidence: {
    workspace_id: string | null;
    device_id: string | null;
    pending_count: number;
    included_count: number;
    high_risk_tables: number;
    conflict_surfaces: number;
  };
  summary: {
    scenarios: number;
    planned: number;
    manual_confirmation: number;
    blocked: number;
    conflict_surfaces_needing_baseline: number;
    permission_checks_required: number;
  };
  scenarios: SyncReplayScenario[];
  gates: SyncReplayGate[];
}

export function buildSyncReplayTestPlan(
  input: SyncReplayTestPlanInput
): SyncReplayTestPlan {
  const scenarios = buildScenarios(input);
  const gates = buildGates(input);

  return {
    format: "zhinote-sync-replay-test-plan",
    format_version: 1,
    plan_status: "local-test-plan-only",
    can_run_replay_now: false,
    disabled_endpoint: "/api/sync/replay-test",
    privacy_note:
      "Generated locally. This replay plan does not read remote data, read page text, read file bytes, connect cloud services, upload workspace data, write workspace data, or acknowledge remote rows.",
    boundary: {
      local_test_plan_only: true,
      reads_remote_data: false,
      reads_page_body_text: false,
      reads_file_bytes: false,
      connects_cloud: false,
      uploads_workspace_data: false,
      writes_workspace_data: false,
      acknowledges_remote_rows: false,
      requires_owner_confirmation_before_replay: true,
    },
    local_evidence: {
      workspace_id: input.workspaceIdentity?.workspace_id ?? null,
      device_id: input.workspaceIdentity?.device_id ?? null,
      pending_count: input.syncPayloadPreview.summary.pending_count,
      included_count: input.syncPayloadPreview.summary.included_count,
      high_risk_tables: input.syncPayloadPreview.summary.high_risk_tables,
      conflict_surfaces: input.conflictReview.summary.surfaces,
    },
    summary: {
      scenarios: scenarios.length,
      planned: scenarios.filter((scenario) => scenario.status === "planned")
        .length,
      manual_confirmation: scenarios.filter(
        (scenario) => scenario.status === "manual-confirmation"
      ).length,
      blocked: gates.filter((gate) => gate.status === "blocked").length,
      conflict_surfaces_needing_baseline:
        input.conflictReview.summary.needs_remote_baseline,
      permission_checks_required:
        input.permissionDecisionReport?.summary.needs_confirmation ?? 0,
    },
    scenarios,
    gates,
  };
}

function buildScenarios(
  input: SyncReplayTestPlanInput
): SyncReplayScenario[] {
  const pending = input.syncPayloadPreview.summary.pending_count;
  const included = input.syncPayloadPreview.summary.included_count;
  const highRisk = input.syncPayloadPreview.summary.high_risk_tables;
  const conflictsNeedingBaseline =
    input.conflictReview.summary.needs_remote_baseline;
  const manualOnlyConflicts = input.conflictReview.summary.manual_only;

  return [
    {
      id: "push-batch-preview",
      title: "Push batch payload preview",
      status: pending > 0 ? "manual-confirmation" : "planned",
      endpoint: "/api/sync/push",
      evidence:
        pending > 0
          ? `${pending} pending sync rows exist; ${included} are included in the local metadata preview.`
          : "No pending sync rows are currently available for replay planning.",
      expected_result:
        "Server receives only the confirmed metadata batch after permission, payload, and audit gates pass.",
      required_action:
        "Require sync payload preview, owner/user confirmation, server permission check, and audit event before any push replay can run.",
      privacy_boundary:
        "Replay input uses table names, row ids, operations, changed field names, and counts only; no page text or file bytes.",
    },
    {
      id: "server-ack",
      title: "Server acknowledgement",
      status: "blocked",
      endpoint: "/api/sync/push",
      evidence:
        "No server persistence or remote acknowledgement table exists yet.",
      expected_result:
        "Each pushed row receives a durable remote acknowledgement and local sync_log status only changes after ack.",
      required_action:
        "Implement durable server write, idempotency key, remote ack timestamp, retry state, and rollback behavior.",
      privacy_boundary:
        "Acknowledgement should store ids, status, timestamps, and checksums, not research payload text.",
    },
    {
      id: "pull-cursor",
      title: "Pull by cursor",
      status: "blocked",
      endpoint: "/api/sync/pull",
      evidence:
        "Pull route is a disabled stub and no remote cursor baseline exists.",
      expected_result:
        "Client fetches remote changes after the last cursor and stages them for conflict review before applying writes.",
      required_action:
        "Implement workspace-scoped cursor, remote latest fetch, local dirty row detection, and rollback snapshot.",
      privacy_boundary:
        "Pull replay plan does not fetch remote rows or inspect local page bodies.",
    },
    {
      id: "conflict-baseline",
      title: "Conflict baseline review",
      status:
        conflictsNeedingBaseline > 0
          ? "manual-confirmation"
          : "planned",
      endpoint: "/api/sync/pull",
      evidence: `${conflictsNeedingBaseline} conflict surfaces need remote baseline; ${manualOnlyConflicts} surfaces are manual-only.`,
      expected_result:
        "Conflicts are staged into review UI instead of silently overwriting local research.",
      required_action:
        "Fetch remote baseline only after auth, then route page, database, file, comment, permission, and restore conflicts to review.",
      privacy_boundary:
        "This plan references conflict surfaces only and does not include page text, row values, comment bodies, or file bytes.",
    },
    {
      id: "retry-idempotency",
      title: "Retry and idempotency",
      status: "blocked",
      endpoint: "/api/sync/push",
      evidence:
        "No batch id, idempotency key, retry limit, or dead-letter queue exists yet.",
      expected_result:
        "Network failures can retry without duplicate remote rows or lost local pending rows.",
      required_action:
        "Add sync batch ids, idempotency keys, retry caps, dead-letter status, and user-visible failure recovery.",
      privacy_boundary:
        "Retry metadata should include ids, counts, and statuses only.",
    },
    {
      id: "high-risk-table-gate",
      title: "High-risk table gate",
      status: highRisk > 0 ? "manual-confirmation" : "planned",
      endpoint: "/api/sync/push",
      evidence: `${highRisk} high-risk tables are present in the current sync payload preview.`,
      expected_result:
        "High-risk content surfaces require visible confirmation before the first beta upload.",
      required_action:
        "Show table risk labels, changed fields, and excluded content boundaries before enabling sync replay.",
      privacy_boundary:
        "High-risk gate remains metadata-only and excludes body, snapshot, comment, row value, and file byte content.",
    },
    {
      id: "rollback-after-replay",
      title: "Rollback after replay",
      status: "blocked",
      endpoint: "/api/sync/replay-test",
      evidence:
        "No replay runner, disposable cloud database, or rollback proof exists.",
      expected_result:
        "A failed replay can restore local sync status and remote test data to the pre-run checkpoint.",
      required_action:
        "Run replay only on disposable beta data, require rollback snapshot, and prove down-path before private beta.",
      privacy_boundary:
        "Rollback plan should use test metadata and checksums, not private research payloads.",
    },
  ];
}

function buildGates(input: SyncReplayTestPlanInput): SyncReplayGate[] {
  return [
    {
      id: "disabled-replay-api",
      title: "Replay API remains disabled",
      status: "blocked",
      evidence:
        "/api/sync/replay-test is a local disabled stub and cannot run replay.",
      required_action:
        "Keep replay disabled until server sync, permissions, audit events, rollback, and conflict UI are implemented.",
    },
    {
      id: "workspace-identity",
      title: "Workspace and device identity",
      status: input.workspaceIdentity ? "planned" : "blocked",
      evidence: input.workspaceIdentity
        ? `Local workspace ${input.workspaceIdentity.workspace_id} and device ${input.workspaceIdentity.device_id} are available for future replay metadata.`
        : "No local workspace/device identity is available.",
      required_action:
        "Require authenticated workspace membership before any replay uses local identity in a cloud call.",
    },
    {
      id: "permission-decision",
      title: "Server permission decision",
      status: input.permissionDecisionReport
        ? "manual-confirmation"
        : "blocked",
      evidence: input.permissionDecisionReport
        ? `Local permission decisions flag ${input.permissionDecisionReport.summary.needs_confirmation} actions for manual confirmation, but server enforcement is disabled.`
        : "No permission decision report is attached to the replay plan.",
      required_action:
        "Move sync action checks to /api/permissions/check before push, pull, retry, conflict apply, or rollback can execute.",
    },
    {
      id: "audit-event",
      title: "Replay audit events",
      status: input.auditTrailPolicy ? "manual-confirmation" : "blocked",
      evidence: input.auditTrailPolicy
        ? `Audit policy covers ${input.auditTrailPolicy.summary.events} event types, but server audit writes remain disabled.`
        : "No audit policy is attached to the replay plan.",
      required_action:
        "Write redacted audit events for replay start, preview approval, push, pull, ack, conflict, retry, rollback, and failure.",
    },
    {
      id: "conflict-ui",
      title: "Conflict UI route",
      status:
        input.conflictReview.summary.needs_remote_baseline > 0
          ? "manual-confirmation"
          : "planned",
      evidence: `${input.conflictReview.summary.needs_remote_baseline} surfaces need a remote baseline before replay can be safe.`,
      required_action:
        "Route remote/local conflicts into a review screen before any pulled change writes to local workspace data.",
    },
  ];
}
