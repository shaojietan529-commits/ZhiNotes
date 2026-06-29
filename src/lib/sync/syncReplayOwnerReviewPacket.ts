import type { SyncAckLedgerReplayEnablement } from "@/lib/sync/syncAckLedgerReplayEnablement";
import type { SyncReplayTestApiDisabledResponse } from "@/lib/sync/syncReplayTestApiStub";
import type { SyncReplayTestPlan } from "@/lib/sync/syncReplayTestPlan";

export type SyncReplayOwnerReviewStatus =
  | "local-ready"
  | "owner-decision"
  | "blocked";

export interface SyncReplayOwnerReviewDecision {
  id: string;
  title: string;
  status: SyncReplayOwnerReviewStatus;
  answer: "yes" | "no";
  evidence: string;
  owner_prompt: string;
  required_before_replay: string;
}

export interface SyncReplayOwnerReviewChecklistItem {
  id: string;
  title: string;
  status: SyncReplayOwnerReviewStatus;
  source: string;
  evidence: string;
  required_before_replay: string;
}

export interface SyncReplayOwnerReviewPacket {
  format: "zhinote-sync-replay-owner-review-packet";
  format_version: 1;
  packet_status: "local-owner-review-only";
  replay_verdict: "not-ready";
  decision: "continue-local-prep-no-cloud-replay";
  required_confirmation_phrase: "APPROVE DISPOSABLE SYNC REPLAY ONLY";
  can_export_packet_now: true;
  can_request_owner_review_now: true;
  can_run_disposable_cloud_replay_now: false;
  can_run_production_replay_now: false;
  can_enable_sync_push_now: false;
  can_mark_local_rows_synced_now: false;
  privacy_note: string;
  boundary: {
    local_packet_only: true;
    reads_replay_plan_metadata: true;
    reads_api_guard_metadata: true;
    reads_ack_enablement_metadata: true;
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_comment_bodies: false;
    reads_file_bytes: false;
    reads_backup_payload: false;
    reads_secret_values: false;
    reads_environment_values: false;
    sends_network_requests: false;
    connects_cloud_services: false;
    creates_disposable_workspace: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    mutates_local_sync_log: false;
    marks_local_rows_synced: false;
    enables_sync_push: false;
    touches_production_workspace: false;
    requires_owner_confirmation_before_replay: true;
    requires_separate_enabled_runner: true;
  };
  local_evidence: {
    replay_plan_status: SyncReplayTestPlan["plan_status"];
    replay_api_status: SyncReplayTestApiDisabledResponse["stub_status"];
    ack_enablement_status: SyncAckLedgerReplayEnablement["enablement_status"];
    replay_scenarios: number;
    replay_blocked_gates: number;
    api_allowed_request_fields: number;
    api_forbidden_request_fields: number;
    ack_enablement_gates: number;
    ack_enablement_blocked: number;
  };
  summary: {
    decisions: number;
    yes: number;
    no: number;
    checklist_items: number;
    local_ready: number;
    owner_decision: number;
    blocked: number;
    forbidden_actions: number;
    excluded_payload_classes: number;
    required_verification_commands: number;
  };
  decisions: SyncReplayOwnerReviewDecision[];
  checklist: SyncReplayOwnerReviewChecklistItem[];
  required_verification_commands: string[];
  forbidden_actions_before_owner_approval: string[];
  excluded_payload_classes: string[];
}

const REQUIRED_VERIFICATION_COMMANDS = [
  "npm run verify:web-beta:smoke",
  "npm run verify:web-beta",
  "npm run verify:route-smoke",
  "npm run lint",
  "npm run build",
];

const FORBIDDEN_ACTIONS_BEFORE_OWNER_APPROVAL = [
  "run_disposable_cloud_replay",
  "run_production_replay",
  "connect_cloud_database",
  "create_disposable_workspace",
  "apply_cloud_migrations",
  "enable_sync_push",
  "enable_sync_pull",
  "upload_workspace_data",
  "acknowledge_sync_rows",
  "mark_local_rows_synced",
  "write_server_data",
  "touch_production_workspace",
];

const EXCLUDED_PAYLOAD_CLASSES = [
  "page_body_text",
  "database_row_values",
  "comment_bodies",
  "file_bytes",
  "backup_payloads",
  "sync_log_payloads",
  "raw_request_bodies",
  "tokens",
  "cookies",
  "passwords",
  "secret_values",
  "cloud_connection_strings",
  "production_workspace_rows",
];

export function buildSyncReplayOwnerReviewPacket({
  replayTestPlan,
  replayApiGuard,
  ackReplayEnablement,
}: {
  replayTestPlan: SyncReplayTestPlan;
  replayApiGuard: SyncReplayTestApiDisabledResponse;
  ackReplayEnablement: SyncAckLedgerReplayEnablement;
}): SyncReplayOwnerReviewPacket {
  const decisions = buildDecisions({
    replayTestPlan,
    replayApiGuard,
    ackReplayEnablement,
  });
  const checklist = buildChecklist({
    replayTestPlan,
    replayApiGuard,
    ackReplayEnablement,
  });
  const statuses = checklist.map((item) => item.status);

  return {
    format: "zhinote-sync-replay-owner-review-packet",
    format_version: 1,
    packet_status: "local-owner-review-only",
    replay_verdict: "not-ready",
    decision: "continue-local-prep-no-cloud-replay",
    required_confirmation_phrase: "APPROVE DISPOSABLE SYNC REPLAY ONLY",
    can_export_packet_now: true,
    can_request_owner_review_now: true,
    can_run_disposable_cloud_replay_now: false,
    can_run_production_replay_now: false,
    can_enable_sync_push_now: false,
    can_mark_local_rows_synced_now: false,
    privacy_note:
      "Generated locally from sync replay plan metadata, replay API guard metadata, and ack/retry enablement metadata. This owner review packet does not read page text, database row values, comments, files, backups, secrets, environment values, tokens, cookies, production workspace data, or cloud data; it does not send network requests, connect cloud services, create workspaces, upload data, write server data, mutate sync_log, mark rows synced, or enable sync.",
    boundary: {
      local_packet_only: true,
      reads_replay_plan_metadata: true,
      reads_api_guard_metadata: true,
      reads_ack_enablement_metadata: true,
      reads_page_body_text: false,
      reads_database_row_values: false,
      reads_comment_bodies: false,
      reads_file_bytes: false,
      reads_backup_payload: false,
      reads_secret_values: false,
      reads_environment_values: false,
      sends_network_requests: false,
      connects_cloud_services: false,
      creates_disposable_workspace: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      mutates_local_sync_log: false,
      marks_local_rows_synced: false,
      enables_sync_push: false,
      touches_production_workspace: false,
      requires_owner_confirmation_before_replay: true,
      requires_separate_enabled_runner: true,
    },
    local_evidence: {
      replay_plan_status: replayTestPlan.plan_status,
      replay_api_status: replayApiGuard.stub_status,
      ack_enablement_status: ackReplayEnablement.enablement_status,
      replay_scenarios: replayTestPlan.summary.scenarios,
      replay_blocked_gates: replayTestPlan.summary.blocked,
      api_allowed_request_fields:
        replayApiGuard.request_schema.allowed_fields.length,
      api_forbidden_request_fields:
        replayApiGuard.request_schema.forbidden_fields.length,
      ack_enablement_gates: ackReplayEnablement.summary.gates,
      ack_enablement_blocked: ackReplayEnablement.summary.blocked,
    },
    summary: {
      decisions: decisions.length,
      yes: decisions.filter((decision) => decision.answer === "yes").length,
      no: decisions.filter((decision) => decision.answer === "no").length,
      checklist_items: checklist.length,
      local_ready: statuses.filter((status) => status === "local-ready").length,
      owner_decision: statuses.filter((status) => status === "owner-decision")
        .length,
      blocked: statuses.filter((status) => status === "blocked").length,
      forbidden_actions: FORBIDDEN_ACTIONS_BEFORE_OWNER_APPROVAL.length,
      excluded_payload_classes: EXCLUDED_PAYLOAD_CLASSES.length,
      required_verification_commands: REQUIRED_VERIFICATION_COMMANDS.length,
    },
    decisions,
    checklist,
    required_verification_commands: REQUIRED_VERIFICATION_COMMANDS,
    forbidden_actions_before_owner_approval:
      FORBIDDEN_ACTIONS_BEFORE_OWNER_APPROVAL,
    excluded_payload_classes: EXCLUDED_PAYLOAD_CLASSES,
  };
}

function buildDecisions({
  replayTestPlan,
  replayApiGuard,
  ackReplayEnablement,
}: {
  replayTestPlan: SyncReplayTestPlan;
  replayApiGuard: SyncReplayTestApiDisabledResponse;
  ackReplayEnablement: SyncAckLedgerReplayEnablement;
}): SyncReplayOwnerReviewDecision[] {
  return [
    {
      id: "continue-local-prep",
      title: "Continue local replay preparation",
      status: "local-ready",
      answer: "yes",
      evidence:
        "Local replay plan, replay API guard, ack/retry preflight, synthetic proof, and enablement package can be exported without cloud access.",
      owner_prompt:
        "Continue building local safety contracts and UI before any cloud execution.",
      required_before_replay:
        "No owner approval is needed for local-only preparation.",
    },
    {
      id: "run-disposable-cloud-replay",
      title: "Run disposable cloud replay now",
      status: "owner-decision",
      answer: "no",
      evidence: `${replayTestPlan.summary.blocked} replay gates and ${ackReplayEnablement.summary.blocked} ack enablement gates remain; replay API status is ${replayApiGuard.stub_status}.`,
      owner_prompt:
        "Do not run replay until the disposable workspace, RLS, permission, audit, rollback, and zero-private-payload gates are proven.",
      required_before_replay:
        "Owner must type the required phrase after reviewing scope, destination, stop conditions, rollback, and proof artifacts.",
    },
    {
      id: "run-production-replay",
      title: "Run production replay now",
      status: "blocked",
      answer: "no",
      evidence:
        "Production replay is explicitly refused by the replay API guard and ack/retry enablement package.",
      owner_prompt:
        "Production replay is out of scope until disposable replay is complete and a separate launch decision exists.",
      required_before_replay:
        "Finish disposable replay proof, private beta review, rollback drills, and a separate production go decision.",
    },
  ];
}

function buildChecklist({
  replayTestPlan,
  replayApiGuard,
  ackReplayEnablement,
}: {
  replayTestPlan: SyncReplayTestPlan;
  replayApiGuard: SyncReplayTestApiDisabledResponse;
  ackReplayEnablement: SyncAckLedgerReplayEnablement;
}): SyncReplayOwnerReviewChecklistItem[] {
  return [
    checklistItem(
      "disabled-api-confirmed",
      "Replay API remains disabled",
      replayApiGuard.can_run_replay_now ? "blocked" : "local-ready",
      "syncReplayTestApiGuard",
      `Route ${replayApiGuard.path} returns ${replayApiGuard.stub_status} and can_run_replay_now=${replayApiGuard.can_run_replay_now}.`,
      "Keep route disabled until owner approval and an enabled disposable runner exist."
    ),
    checklistItem(
      "no-request-body",
      "Disabled API does not read request bodies",
      replayApiGuard.can_read_request_body_now ? "blocked" : "local-ready",
      "syncReplayTestApiGuard",
      `can_read_request_body_now=${replayApiGuard.can_read_request_body_now}.`,
      "Keep disabled route bodyless; future enabled route must validate metadata-only fields."
    ),
    checklistItem(
      "owner-confirmation",
      "Owner confirmation is required",
      "owner-decision",
      "syncReplayOwnerReviewPacket",
      "Required phrase is disposable-replay scoped and case-sensitive in the exported packet.",
      "Owner must review scope and type the required phrase in a future confirmation receipt."
    ),
    checklistItem(
      "disposable-workspace",
      "Disposable workspace only",
      replayApiGuard.boundary.requires_disposable_workspace_before_enablement
        ? "owner-decision"
        : "blocked",
      "syncReplayTestApiGuard",
      "Replay guard requires a disposable workspace before enablement.",
      "Create and verify an isolated disposable workspace before any replay attempt."
    ),
    checklistItem(
      "rls-permission-audit",
      "RLS, permission, and audit proof",
      ackReplayEnablement.prerequisites.requires_rls_assertion &&
      ackReplayEnablement.prerequisites.requires_permission_check &&
      ackReplayEnablement.prerequisites.requires_audit_event
        ? "owner-decision"
        : "blocked",
      "syncAckLedgerReplayEnablement",
      "Ack/retry enablement requires RLS, permission, and audit evidence.",
      "Prove row-level isolation, server permission checks, and redacted audit events."
    ),
    checklistItem(
      "rollback-proof",
      "Rollback proof",
      ackReplayEnablement.prerequisites.requires_rollback_proof
        ? "owner-decision"
        : "blocked",
      "syncAckLedgerReplayEnablement",
      "Ack/retry enablement requires rollback proof before replay.",
      "Prove all disposable fixture rows can be reset or dropped after failure."
    ),
    checklistItem(
      "zero-private-payload",
      "Zero private payload",
      replayApiGuard.boundary.requires_zero_private_payload_before_enablement &&
      ackReplayEnablement.prerequisites.requires_zero_private_payload
        ? "owner-decision"
        : "blocked",
      "syncReplayTestApiGuard + syncAckLedgerReplayEnablement",
      "Replay guard and ack enablement both require zero private payload evidence.",
      "Show the request contains metadata ids, counts, table names, statuses, timestamps, and hashes only."
    ),
    checklistItem(
      "replay-plan-blockers",
      "Replay plan blockers",
      replayTestPlan.summary.blocked === 0 ? "local-ready" : "blocked",
      "syncReplayTestPlan",
      `${replayTestPlan.summary.blocked} replay gates remain blocked.`,
      "Clear replay plan blocked gates or keep replay disabled."
    ),
  ];
}

function checklistItem(
  id: string,
  title: string,
  status: SyncReplayOwnerReviewStatus,
  source: string,
  evidence: string,
  requiredBeforeReplay: string
): SyncReplayOwnerReviewChecklistItem {
  return {
    id,
    title,
    status,
    source,
    evidence,
    required_before_replay: requiredBeforeReplay,
  };
}
