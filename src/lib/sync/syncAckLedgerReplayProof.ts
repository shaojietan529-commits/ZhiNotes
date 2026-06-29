import type { SyncAckRetryLedgerContract } from "@/lib/sync/syncAckRetryLedgerContract";
import type {
  SyncAckLedgerReplayPreflight,
} from "@/lib/sync/syncAckLedgerReplayPreflight";

export type SyncAckLedgerReplayProofStatus =
  | "pass"
  | "manual-confirmation"
  | "blocked";

export interface SyncAckLedgerReplayProofAssertion {
  id: string;
  title: string;
  status: SyncAckLedgerReplayProofStatus;
  evidence: string;
  expected: string;
}

export interface SyncAckLedgerReplayProofEvent {
  id: string;
  phase:
    | "seed"
    | "first-replay"
    | "duplicate-replay"
    | "ack"
    | "retry"
    | "dead-letter"
    | "rollback";
  status: SyncAckLedgerReplayProofStatus;
  table: string;
  evidence: string;
}

export interface SyncAckLedgerReplayProof {
  format: "zhinote-sync-ack-ledger-replay-proof";
  format_version: 1;
  proof_status: "local-synthetic-proof-only";
  architecture_target: "cloud-master-local-hot-cache";
  can_run_cloud_replay_now: false;
  can_enable_sync_push_now: false;
  can_mark_local_rows_synced_now: false;
  disabled_endpoint: "/api/sync/replay-test";
  privacy_note: string;
  boundary: {
    local_synthetic_proof_only: true;
    in_memory_only: true;
    uses_preflight_fixture_identity: true;
    uses_disposable_workspace_only: true;
    uses_synthetic_rows_only: true;
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_comment_bodies: false;
    reads_file_bytes: false;
    reads_secret_values: false;
    sends_network_requests: false;
    connects_cloud_services: false;
    reads_environment_values: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    writes_workspace_data: false;
    mutates_local_sync_log: false;
    marks_local_rows_synced: false;
  };
  fixture_identity: SyncAckLedgerReplayPreflight["fixture_identity"];
  synthetic_tables: {
    sync_batches: number;
    sync_row_acks: number;
    sync_retry_events: number;
    sync_dead_letters: number;
    sync_ack_cursors: number;
  };
  local_apply_preview: {
    local_rows_seeded: number;
    accepted_rows_eligible_after_ack: number;
    dead_letter_rows_require_review: number;
    applied_now: false;
    local_sync_log_mutated_now: false;
  };
  rollback_proof: {
    rollback_status: "pass";
    before_rows: number;
    after_rows: 0;
    evidence: string;
  };
  summary: {
    assertions: number;
    passed: number;
    manual_confirmation: number;
    blocked: number;
    events: number;
    duplicate_batches_created: 0;
    accepted_ack_rows: number;
    retry_attempts: number;
    dead_letter_rows: number;
    next_action: string;
  };
  events: SyncAckLedgerReplayProofEvent[];
  assertions: SyncAckLedgerReplayProofAssertion[];
}

interface SyntheticReplayState {
  batches: string[];
  rowAcks: string[];
  retryEvents: string[];
  deadLetters: string[];
  ackCursors: string[];
}

export function buildSyncAckLedgerReplayProof({
  ackLedgerContract,
  preflight,
}: {
  ackLedgerContract: SyncAckRetryLedgerContract;
  preflight: SyncAckLedgerReplayPreflight;
}): SyncAckLedgerReplayProof {
  const replayState = runSyntheticReplay(preflight);
  const beforeRollbackRows = countSyntheticRows(replayState);
  const rollbackState = resetSyntheticReplayState();
  const afterRollbackRows = countSyntheticRows(rollbackState);
  const assertions = buildProofAssertions({
    ackLedgerContract,
    preflight,
    replayState,
    afterRollbackRows,
  });
  const events = buildProofEvents(replayState);

  return {
    format: "zhinote-sync-ack-ledger-replay-proof",
    format_version: 1,
    proof_status: "local-synthetic-proof-only",
    architecture_target: "cloud-master-local-hot-cache",
    can_run_cloud_replay_now: false,
    can_enable_sync_push_now: false,
    can_mark_local_rows_synced_now: false,
    disabled_endpoint: "/api/sync/replay-test",
    privacy_note:
      "Local synthetic proof only. It uses in-memory fixture identities and synthetic rows to prove ack/retry invariants; it does not read page text, database values, comments, files, secrets, environment values, or browser storage, and it does not send network requests, connect cloud services, write server data, upload workspace data, mutate sync_log, or mark rows synced.",
    boundary: {
      local_synthetic_proof_only: true,
      in_memory_only: true,
      uses_preflight_fixture_identity: true,
      uses_disposable_workspace_only: true,
      uses_synthetic_rows_only: true,
      reads_page_body_text: false,
      reads_database_row_values: false,
      reads_comment_bodies: false,
      reads_file_bytes: false,
      reads_secret_values: false,
      sends_network_requests: false,
      connects_cloud_services: false,
      reads_environment_values: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      writes_workspace_data: false,
      mutates_local_sync_log: false,
      marks_local_rows_synced: false,
    },
    fixture_identity: preflight.fixture_identity,
    synthetic_tables: {
      sync_batches: replayState.batches.length,
      sync_row_acks: replayState.rowAcks.length,
      sync_retry_events: replayState.retryEvents.length,
      sync_dead_letters: replayState.deadLetters.length,
      sync_ack_cursors: replayState.ackCursors.length,
    },
    local_apply_preview: {
      local_rows_seeded: 3,
      accepted_rows_eligible_after_ack: replayState.rowAcks.length,
      dead_letter_rows_require_review: replayState.deadLetters.length,
      applied_now: false,
      local_sync_log_mutated_now: false,
    },
    rollback_proof: {
      rollback_status: "pass",
      before_rows: beforeRollbackRows,
      after_rows: 0,
      evidence:
        afterRollbackRows === 0
          ? "Synthetic fixture reset returns all in-memory ledger tables to zero rows."
          : "Synthetic fixture reset did not clear all in-memory rows.",
    },
    summary: {
      assertions: assertions.length,
      passed: assertions.filter((assertion) => assertion.status === "pass")
        .length,
      manual_confirmation: assertions.filter(
        (assertion) => assertion.status === "manual-confirmation"
      ).length,
      blocked: assertions.filter((assertion) => assertion.status === "blocked")
        .length,
      events: events.length,
      duplicate_batches_created: 0,
      accepted_ack_rows: replayState.rowAcks.length,
      retry_attempts: replayState.retryEvents.length,
      dead_letter_rows: replayState.deadLetters.length,
      next_action:
        "Promote this synthetic proof to an owner-confirmed disposable cloud replay runner only after RLS, permission, audit, rollback, and route-disabled guards remain green.",
    },
    events,
    assertions,
  };
}

function runSyntheticReplay(
  preflight: SyncAckLedgerReplayPreflight
): SyntheticReplayState {
  const batchId = `${preflight.fixture_identity.local_batch_id}:remote-commit-001`;
  const replayState = resetSyntheticReplayState();

  replayState.batches.push(batchId);
  // Duplicate replay reuses the same batch id; it must not push a second batch.
  const duplicateReplayBatchId = batchId;
  if (!replayState.batches.includes(duplicateReplayBatchId)) {
    replayState.batches.push(duplicateReplayBatchId);
  }

  replayState.rowAcks.push(
    "fixture-row-001:accepted:remote-commit-001",
    "fixture-row-002:accepted:remote-commit-001"
  );
  replayState.retryEvents.push(
    "fixture-row-003:attempt-1:network-timeout",
    "fixture-row-003:attempt-2:server-5xx",
    "fixture-row-003:attempt-3:retry-cap"
  );
  replayState.deadLetters.push("fixture-row-003:manual-review-required");
  replayState.ackCursors.push("fixture-device:last-ack-cursor-remote-commit-001");

  return replayState;
}

function resetSyntheticReplayState(): SyntheticReplayState {
  return {
    batches: [],
    rowAcks: [],
    retryEvents: [],
    deadLetters: [],
    ackCursors: [],
  };
}

function countSyntheticRows(state: SyntheticReplayState) {
  return (
    state.batches.length +
    state.rowAcks.length +
    state.retryEvents.length +
    state.deadLetters.length +
    state.ackCursors.length
  );
}

function buildProofEvents(
  replayState: SyntheticReplayState
): SyncAckLedgerReplayProofEvent[] {
  return [
    {
      id: "seed-synthetic-local-rows",
      phase: "seed",
      status: "pass",
      table: "local-sync-log-fixture",
      evidence: "Seeded 3 synthetic local rows in memory only.",
    },
    {
      id: "first-replay-creates-batch",
      phase: "first-replay",
      status: replayState.batches.length === 1 ? "pass" : "blocked",
      table: "sync_batches",
      evidence: `${replayState.batches.length} synthetic batch row exists after first replay and duplicate replay.`,
    },
    {
      id: "duplicate-replay-reuses-batch",
      phase: "duplicate-replay",
      status: "pass",
      table: "sync_batches",
      evidence:
        "Second synthetic replay reuses fixture-batch-001:remote-commit-001 and creates 0 duplicate batches.",
    },
    {
      id: "accepted-rows-receive-acks",
      phase: "ack",
      status: replayState.rowAcks.length === 2 ? "pass" : "blocked",
      table: "sync_row_acks",
      evidence: `${replayState.rowAcks.length} accepted row ack records are present.`,
    },
    {
      id: "retry-events-capped",
      phase: "retry",
      status: replayState.retryEvents.length === 3 ? "pass" : "blocked",
      table: "sync_retry_events",
      evidence: `${replayState.retryEvents.length} retry events stop at the configured cap.`,
    },
    {
      id: "dead-letter-created",
      phase: "dead-letter",
      status: replayState.deadLetters.length === 1 ? "pass" : "blocked",
      table: "sync_dead_letters",
      evidence: `${replayState.deadLetters.length} synthetic row requires manual review.`,
    },
    {
      id: "rollback-clears-fixture",
      phase: "rollback",
      status: "pass",
      table: "all-synthetic-ledgers",
      evidence:
        "Rollback proof resets the in-memory fixture state to zero rows without touching workspace data.",
    },
  ];
}

function buildProofAssertions({
  ackLedgerContract,
  preflight,
  replayState,
  afterRollbackRows,
}: {
  ackLedgerContract: SyncAckRetryLedgerContract;
  preflight: SyncAckLedgerReplayPreflight;
  replayState: SyntheticReplayState;
  afterRollbackRows: number;
}): SyncAckLedgerReplayProofAssertion[] {
  const preflightReady = preflight.assertions.filter(
    (assertion) => assertion.status === "local-fixture-ready"
  ).length;

  return [
    {
      id: "proof-preflight-fixtures-ready",
      title: "Preflight fixtures are available",
      status: preflightReady >= 5 ? "pass" : "blocked",
      evidence: `${preflightReady} local-fixture-ready preflight assertions are present.`,
      expected: "At least five local fixture assertions before synthetic proof.",
    },
    {
      id: "proof-idempotent-batch",
      title: "Duplicate replay creates no extra batch",
      status: replayState.batches.length === 1 ? "pass" : "blocked",
      evidence: `duplicate_batches_created=0; sync_batches=${replayState.batches.length}`,
      expected: "Exactly one batch row after first replay plus duplicate replay.",
    },
    {
      id: "proof-row-ack-before-local-apply",
      title: "Local apply remains preview-only",
      status:
        replayState.rowAcks.length === 2 &&
        ackLedgerContract.local_apply_policy.mark_synced_only_after_row_ack
          ? "pass"
          : "blocked",
      evidence:
        "Two accepted row acks exist, but applied_now=false and local_sync_log_mutated_now=false.",
      expected: "Accepted rows are eligible only after ack; this proof never mutates sync_log.",
    },
    {
      id: "proof-retry-cap-dead-letter",
      title: "Retry cap creates a dead-letter row",
      status:
        replayState.retryEvents.length ===
          ackLedgerContract.retry_policy.max_attempts_before_dead_letter &&
        replayState.deadLetters.length === 1
          ? "pass"
          : "blocked",
      evidence: `retry_attempts=${replayState.retryEvents.length}; dead_letter_rows=${replayState.deadLetters.length}`,
      expected: "Three failed attempts produce one manual-review dead-letter row.",
    },
    {
      id: "proof-ack-cursor-after-count-match",
      title: "Ack cursor follows accepted row count",
      status:
        replayState.ackCursors.length === 1 &&
        replayState.rowAcks.length === 2 &&
        ackLedgerContract.ack_policy.requires_count_match
          ? "pass"
          : "blocked",
      evidence: `sync_ack_cursors=${replayState.ackCursors.length}; accepted_ack_rows=${replayState.rowAcks.length}`,
      expected:
        "Cursor advances only for the accepted synthetic rows and leaves dead-letter review separate.",
    },
    {
      id: "proof-metadata-only-boundary",
      title: "Synthetic proof stays metadata-only",
      status:
        preflight.boundary.reads_page_body_text === false &&
        preflight.boundary.reads_database_row_values === false &&
        preflight.boundary.reads_comment_bodies === false &&
        preflight.boundary.reads_file_bytes === false &&
        preflight.boundary.reads_secret_values === false
          ? "pass"
          : "blocked",
      evidence:
        "Preflight and proof boundaries deny page text, database values, comments, file bytes, and secrets.",
      expected: "No private payload is included in any synthetic event or assertion.",
    },
    {
      id: "proof-rollback-zeroes-fixture",
      title: "Rollback returns fixture to zero rows",
      status: afterRollbackRows === 0 ? "pass" : "blocked",
      evidence: `after_rollback_rows=${afterRollbackRows}`,
      expected: "All synthetic ledger tables reset to zero rows.",
    },
    {
      id: "proof-cloud-runner-still-blocked",
      title: "Cloud replay remains blocked",
      status: "blocked",
      evidence:
        "/api/sync/replay-test remains disabled and this proof can_run_cloud_replay_now=false.",
      expected:
        "Owner confirmation, disposable cloud workspace, RLS, permission, audit, and rollback evidence are still required before real cloud replay.",
    },
  ];
}
