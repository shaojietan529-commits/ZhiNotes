import type { HighRiskConfirmationReceipt } from "@/lib/security/typedConfirmation";
import type { RemoteBaselineReplayFixturePackage } from "@/lib/sync/remoteBaselineReplayFixture";
import type { RemoteBaselineReplayHarnessPreflight } from "@/lib/sync/remoteBaselineReplayHarness";
import type { RemoteBaselineReplayRunnerSkeleton } from "@/lib/sync/remoteBaselineReplayRunner";
import type { SyncReplayOwnerReviewPacket } from "@/lib/sync/syncReplayOwnerReviewPacket";
import type { SyncReplayTestApiDisabledResponse } from "@/lib/sync/syncReplayTestApiStub";

export type SyncReplayEnablementGateStatus =
  | "local-ready"
  | "owner-confirmation"
  | "blocked";

export interface SyncReplayEnablementGateInput {
  ownerReviewPacket: SyncReplayOwnerReviewPacket;
  confirmationReceipt: HighRiskConfirmationReceipt;
  replayApiGuard: SyncReplayTestApiDisabledResponse;
  fixturePackage: RemoteBaselineReplayFixturePackage;
  harnessPreflight: RemoteBaselineReplayHarnessPreflight;
  runnerSkeleton: RemoteBaselineReplayRunnerSkeleton;
}

export interface SyncReplayEnablementGateItem {
  id: string;
  title: string;
  status: SyncReplayEnablementGateStatus;
  source: string;
  evidence: string;
  required_before_replay: string;
}

export interface SyncReplayEnablementGate {
  format: "zhinote-sync-replay-enablement-gate";
  format_version: 1;
  gate_status: "local-disabled-enablement-gate";
  replay_decision: "blocked-local-prep-only";
  can_export_gate_now: true;
  can_run_disposable_cloud_replay_now: false;
  can_enable_replay_api_now: false;
  can_connect_cloud_now: false;
  can_create_disposable_database_now: false;
  can_apply_sql_now: false;
  can_write_server_data_now: false;
  can_upload_workspace_data_now: false;
  privacy_note: string;
  boundary: {
    local_gate_only: true;
    reads_owner_review_metadata: true;
    reads_confirmation_metadata: true;
    reads_api_guard_metadata: true;
    reads_fixture_metadata: true;
    reads_harness_metadata: true;
    reads_runner_metadata: true;
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_comment_bodies: false;
    reads_file_bytes: false;
    reads_backup_payload: false;
    reads_secret_values: false;
    sends_network_requests: false;
    connects_cloud_services: false;
    creates_disposable_database: false;
    applies_sql: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    mutates_local_sync_log: false;
    marks_local_rows_synced: false;
    enables_replay_api: false;
    enables_sync_push: false;
    touches_production_workspace: false;
  };
  local_evidence: {
    required_phrase: string;
    confirmation_required_phrase: string;
    confirmation_status: HighRiskConfirmationReceipt["status"];
    phrases_aligned: boolean;
    confirmation_phrase_matches: boolean;
    replay_api_disabled: boolean;
    fixture_empty_workspaces: number;
    fixture_stage_seed_rows: 0;
    fixture_cursor_seed_rows: 0;
    fixture_confirmation_phrase_matches: boolean;
    harness_can_run_now: false;
    harness_blocked: number;
    runner_can_run_now: false;
    runner_blocked: number;
    runner_manual_confirmation: number;
  };
  summary: {
    gates: number;
    local_ready: number;
    owner_confirmation: number;
    blocked: number;
    blocked_actions: number;
    next_required_controls: number;
  };
  gates: SyncReplayEnablementGateItem[];
  blocked_actions: string[];
  next_required_controls: string[];
}

const BLOCKED_ACTIONS = [
  "run_disposable_cloud_replay",
  "enable_replay_api",
  "connect_cloud_database",
  "create_disposable_database",
  "apply_sql",
  "write_server_data",
  "upload_workspace_data",
  "stage_remote_rows",
  "acknowledge_remote_rows",
  "mark_local_rows_synced",
  "enable_sync_push",
  "touch_production_workspace",
];

const NEXT_REQUIRED_CONTROLS = [
  "Owner exports a matching local confirmation receipt.",
  "Disposable database is created outside production only after explicit approval.",
  "Replay route remains disabled until permission, audit, RLS, idempotency, and rollback proof all pass.",
  "Empty fixture package remains zero private payload: no page text, database values, comments, files, tokens, or cookies.",
  "Runner emits redacted audit metadata only and never uploads workspace payloads.",
  "Rollback path is proven before any future apply path can be enabled.",
];

export function buildSyncReplayEnablementGate(
  input: SyncReplayEnablementGateInput
): SyncReplayEnablementGate {
  const gates = buildGates(input);
  const statuses = gates.map((gate) => gate.status);

  return {
    format: "zhinote-sync-replay-enablement-gate",
    format_version: 1,
    gate_status: "local-disabled-enablement-gate",
    replay_decision: "blocked-local-prep-only",
    can_export_gate_now: true,
    can_run_disposable_cloud_replay_now: false,
    can_enable_replay_api_now: false,
    can_connect_cloud_now: false,
    can_create_disposable_database_now: false,
    can_apply_sql_now: false,
    can_write_server_data_now: false,
    can_upload_workspace_data_now: false,
    privacy_note:
      "Generated locally from owner review metadata, local confirmation metadata, replay API guard metadata, empty fixture metadata, harness metadata, and runner metadata. This gate does not read page text, database row values, comments, files, backups, secrets, tokens, cookies, remote data, or cloud data; it does not send network requests, connect cloud services, create databases, apply SQL, upload data, write server data, mutate sync_log, mark rows synced, enable replay, or enable sync.",
    boundary: {
      local_gate_only: true,
      reads_owner_review_metadata: true,
      reads_confirmation_metadata: true,
      reads_api_guard_metadata: true,
      reads_fixture_metadata: true,
      reads_harness_metadata: true,
      reads_runner_metadata: true,
      reads_page_body_text: false,
      reads_database_row_values: false,
      reads_comment_bodies: false,
      reads_file_bytes: false,
      reads_backup_payload: false,
      reads_secret_values: false,
      sends_network_requests: false,
      connects_cloud_services: false,
      creates_disposable_database: false,
      applies_sql: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      mutates_local_sync_log: false,
      marks_local_rows_synced: false,
      enables_replay_api: false,
      enables_sync_push: false,
      touches_production_workspace: false,
    },
    local_evidence: {
      required_phrase: input.ownerReviewPacket.required_confirmation_phrase,
      confirmation_required_phrase: input.confirmationReceipt.required_phrase,
      confirmation_status: input.confirmationReceipt.status,
      phrases_aligned: isPhraseAligned(input),
      confirmation_phrase_matches:
        input.confirmationReceipt.typed_phrase_matches,
      replay_api_disabled: !input.replayApiGuard.can_run_replay_now,
      fixture_empty_workspaces: input.fixturePackage.summary.fixture_workspaces,
      fixture_stage_seed_rows: input.fixturePackage.summary.stage_seed_rows,
      fixture_cursor_seed_rows:
        input.fixturePackage.summary.cursor_proof_seed_rows,
      fixture_confirmation_phrase_matches:
        input.fixturePackage.local_evidence.confirmation_phrase_matches,
      harness_can_run_now: input.harnessPreflight.can_run_harness_now,
      harness_blocked: input.harnessPreflight.summary.blocked,
      runner_can_run_now: input.runnerSkeleton.can_run_runner_now,
      runner_blocked: input.runnerSkeleton.summary.blocked,
      runner_manual_confirmation:
        input.runnerSkeleton.summary.manual_confirmation,
    },
    summary: {
      gates: gates.length,
      local_ready: statuses.filter((status) => status === "local-ready").length,
      owner_confirmation: statuses.filter(
        (status) => status === "owner-confirmation"
      ).length,
      blocked: statuses.filter((status) => status === "blocked").length,
      blocked_actions: BLOCKED_ACTIONS.length,
      next_required_controls: NEXT_REQUIRED_CONTROLS.length,
    },
    gates,
    blocked_actions: BLOCKED_ACTIONS,
    next_required_controls: NEXT_REQUIRED_CONTROLS,
  };
}

function buildGates(
  input: SyncReplayEnablementGateInput
): SyncReplayEnablementGateItem[] {
  return [
    gate(
      "owner-review-packet-present",
      "Owner review packet present",
      input.ownerReviewPacket.packet_status === "local-owner-review-only"
        ? "local-ready"
        : "blocked",
      "syncReplayOwnerReviewPacket",
      `Owner review packet status is ${input.ownerReviewPacket.packet_status}.`,
      "Keep owner review packet exportable and local-only."
    ),
    gate(
      "confirmation-phrase-aligned",
      "Confirmation phrase aligned",
      isPhraseAligned(input) ? "local-ready" : "blocked",
      "syncReplayOwnerReviewPacket + remoteBaselineReplayConfirmationReceipt",
      `Owner packet phrase and confirmation receipt phrase ${
        isPhraseAligned(input) ? "match" : "do not match"
      }.`,
      "Use the same required phrase across owner packet, high-risk registry, and replay receipt."
    ),
    gate(
      "owner-confirmation-matches",
      "Owner confirmation receipt matches",
      input.confirmationReceipt.typed_phrase_matches
        ? "local-ready"
        : "owner-confirmation",
      "remoteBaselineReplayConfirmationReceipt",
      `Confirmation status is ${input.confirmationReceipt.status}; phrase match is ${input.confirmationReceipt.typed_phrase_matches}.`,
      "Owner must type the exact phrase and export a matching local receipt before any disposable replay."
    ),
    gate(
      "replay-api-disabled",
      "Replay API remains disabled",
      "blocked",
      "syncReplayTestApiGuard",
      `/api/sync/replay-test can_run_replay_now=${input.replayApiGuard.can_run_replay_now}.`,
      "Keep disabled until disposable database, permission, audit, RLS, idempotency, rollback, and owner approval are proven."
    ),
    gate(
      "empty-fixture-only",
      "Empty fixture only",
      input.fixturePackage.summary.stage_seed_rows === 0 &&
        input.fixturePackage.summary.cursor_proof_seed_rows === 0
        ? "local-ready"
        : "blocked",
      "remoteBaselineReplayFixturePackage",
      `${input.fixturePackage.summary.fixture_workspaces} fixture workspaces; ${input.fixturePackage.summary.stage_seed_rows} stage rows; ${input.fixturePackage.summary.cursor_proof_seed_rows} cursor rows.`,
      "Fixture package must stay empty and metadata-only before replay runner enablement."
    ),
    gate(
      "harness-disabled",
      "Harness remains disabled",
      "blocked",
      "remoteBaselineReplayHarnessPreflight",
      `Harness can_run_harness_now=${input.harnessPreflight.can_run_harness_now}; blocked gates=${input.harnessPreflight.summary.blocked}.`,
      "Harness can only run after disposable database, payload denylist, RLS, audit, and rollback proofs exist."
    ),
    gate(
      "runner-disabled",
      "Runner remains disabled",
      "blocked",
      "remoteBaselineReplayRunnerSkeleton",
      `Runner can_run_runner_now=${input.runnerSkeleton.can_run_runner_now}; blocked reasons=${input.runnerSkeleton.summary.blocked}.`,
      "Runner must remain a skeleton until an enabled API, disposable database, and proof artifacts exist."
    ),
    gate(
      "zero-private-payload",
      "Zero private payload",
      input.fixturePackage.boundary.includes_page_body_text ||
      input.fixturePackage.boundary.includes_database_row_values ||
      input.fixturePackage.boundary.includes_comment_bodies ||
      input.fixturePackage.boundary.includes_file_bytes
        ? "blocked"
        : "local-ready",
      "remoteBaselineReplayFixturePackage",
      "Fixture boundary excludes page text, database values, comment bodies, and file bytes.",
      "Keep payload denylist active and fail any future replay that includes private payload classes."
    ),
  ];
}

function isPhraseAligned(input: SyncReplayEnablementGateInput) {
  return (
    input.ownerReviewPacket.required_confirmation_phrase ===
    input.confirmationReceipt.required_phrase
  );
}

function gate(
  id: string,
  title: string,
  status: SyncReplayEnablementGateStatus,
  source: string,
  evidence: string,
  requiredBeforeReplay: string
): SyncReplayEnablementGateItem {
  return {
    id,
    title,
    status,
    source,
    evidence,
    required_before_replay: requiredBeforeReplay,
  };
}
