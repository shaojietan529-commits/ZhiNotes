import type { SyncAckRetryLedgerContract } from "@/lib/sync/syncAckRetryLedgerContract";
import type { SyncAckLedgerReplayPreflight } from "@/lib/sync/syncAckLedgerReplayPreflight";
import type { SyncAckLedgerReplayProof } from "@/lib/sync/syncAckLedgerReplayProof";

export type SyncAckLedgerReplayEnablementStatus =
  | "local-proof-ready"
  | "manual-confirmation"
  | "blocked";

export interface SyncAckLedgerReplayEnablementGate {
  id: string;
  title: string;
  status: SyncAckLedgerReplayEnablementStatus;
  evidence: string;
  required_before_enablement: string;
}

export interface SyncAckLedgerReplayEnablementMapping {
  id: string;
  local_source: string;
  disposable_cloud_gate: string;
  status: SyncAckLedgerReplayEnablementStatus;
  evidence: string;
}

export interface SyncAckLedgerReplayEnablement {
  format: "zhinote-sync-ack-ledger-replay-enablement";
  format_version: 1;
  enablement_status: "owner-gated-disabled";
  architecture_target: "cloud-master-local-hot-cache";
  disabled_endpoint: "/api/sync/replay-test";
  can_run_disposable_cloud_replay_now: false;
  can_run_production_replay_now: false;
  can_enable_sync_push_now: false;
  can_mark_local_rows_synced_now: false;
  privacy_note: string;
  boundary: {
    owner_gated_only: true;
    local_enablement_package_only: true;
    uses_preflight_fixture_identity: true;
    uses_local_synthetic_proof: true;
    reads_route_disabled_guards: true;
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_comment_bodies: false;
    reads_file_bytes: false;
    reads_secret_values: false;
    reads_environment_values: false;
    sends_network_requests: false;
    connects_cloud_services: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    writes_workspace_data: false;
    mutates_local_sync_log: false;
    marks_local_rows_synced: false;
  };
  prerequisites: {
    requires_owner_confirmation: true;
    requires_disposable_workspace: true;
    requires_rls_assertion: true;
    requires_permission_check: true;
    requires_audit_event: true;
    requires_rollback_proof: true;
    requires_zero_private_payload: true;
    requires_disabled_route_guard: true;
    requires_ack_cursor_proof: true;
    requires_retry_idempotency_proof: true;
    requires_dead_letter_review: true;
  };
  source_proofs: {
    contract_status: SyncAckRetryLedgerContract["contract_status"];
    preflight_status: SyncAckLedgerReplayPreflight["preflight_status"];
    proof_status: SyncAckLedgerReplayProof["proof_status"];
    preflight_fixtures: number;
    synthetic_events: number;
    synthetic_assertions_passed: number;
    synthetic_blocked_assertions: number;
    server_ledger_tables: number;
  };
  summary: {
    gates: number;
    local_ready: number;
    manual_confirmation: number;
    blocked: number;
    production_refusals: number;
    next_action: string;
  };
  gates: SyncAckLedgerReplayEnablementGate[];
  source_assertion_mapping: SyncAckLedgerReplayEnablementMapping[];
}

export function buildSyncAckLedgerReplayEnablement({
  ackLedgerContract,
  preflight,
  proof,
}: {
  ackLedgerContract: SyncAckRetryLedgerContract;
  preflight: SyncAckLedgerReplayPreflight;
  proof: SyncAckLedgerReplayProof;
}): SyncAckLedgerReplayEnablement {
  const gates = buildEnablementGates({
    ackLedgerContract,
    preflight,
    proof,
  });
  const sourceAssertionMapping = buildSourceAssertionMapping(proof);

  return {
    format: "zhinote-sync-ack-ledger-replay-enablement",
    format_version: 1,
    enablement_status: "owner-gated-disabled",
    architecture_target: "cloud-master-local-hot-cache",
    disabled_endpoint: "/api/sync/replay-test",
    can_run_disposable_cloud_replay_now: false,
    can_run_production_replay_now: false,
    can_enable_sync_push_now: false,
    can_mark_local_rows_synced_now: false,
    privacy_note:
      "Owner-gated enablement package only. It translates local fixture and synthetic proof results into disposable cloud replay gates; it does not read private content, read environment values, send network requests, connect cloud services, write server data, upload workspace data, mutate sync_log, or mark rows synced.",
    boundary: {
      owner_gated_only: true,
      local_enablement_package_only: true,
      uses_preflight_fixture_identity: true,
      uses_local_synthetic_proof: true,
      reads_route_disabled_guards: true,
      reads_page_body_text: false,
      reads_database_row_values: false,
      reads_comment_bodies: false,
      reads_file_bytes: false,
      reads_secret_values: false,
      reads_environment_values: false,
      sends_network_requests: false,
      connects_cloud_services: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      writes_workspace_data: false,
      mutates_local_sync_log: false,
      marks_local_rows_synced: false,
    },
    prerequisites: {
      requires_owner_confirmation: true,
      requires_disposable_workspace: true,
      requires_rls_assertion: true,
      requires_permission_check: true,
      requires_audit_event: true,
      requires_rollback_proof: true,
      requires_zero_private_payload: true,
      requires_disabled_route_guard: true,
      requires_ack_cursor_proof: true,
      requires_retry_idempotency_proof: true,
      requires_dead_letter_review: true,
    },
    source_proofs: {
      contract_status: ackLedgerContract.contract_status,
      preflight_status: preflight.preflight_status,
      proof_status: proof.proof_status,
      preflight_fixtures: preflight.summary.fixtures,
      synthetic_events: proof.summary.events,
      synthetic_assertions_passed: proof.summary.passed,
      synthetic_blocked_assertions: proof.summary.blocked,
      server_ledger_tables: ackLedgerContract.server_ledger_tables.length,
    },
    summary: {
      gates: gates.length,
      local_ready: gates.filter((gate) => gate.status === "local-proof-ready")
        .length,
      manual_confirmation: gates.filter(
        (gate) => gate.status === "manual-confirmation"
      ).length,
      blocked: gates.filter((gate) => gate.status === "blocked").length,
      production_refusals: gates.filter((gate) =>
        gate.id.includes("refused")
      ).length,
      next_action:
        "Ask the owner to approve a disposable cloud workspace, then prove RLS, permissions, audit, rollback, idempotent retry, ack cursor, and zero-private-payload gates before enabling any real sync push.",
    },
    gates,
    source_assertion_mapping: sourceAssertionMapping,
  };
}

function buildEnablementGates({
  ackLedgerContract,
  preflight,
  proof,
}: {
  ackLedgerContract: SyncAckRetryLedgerContract;
  preflight: SyncAckLedgerReplayPreflight;
  proof: SyncAckLedgerReplayProof;
}): SyncAckLedgerReplayEnablementGate[] {
  return [
    gate(
      "owner-confirmation-required",
      "Owner confirmation is required",
      "manual-confirmation",
      "Disposable replay can only start after an explicit owner decision.",
      "Owner confirms the disposable workspace, scope, expected records, rollback plan, and stop conditions."
    ),
    gate(
      "disposable-workspace-required",
      "Disposable workspace is required",
      "blocked",
      `Current fixture workspace is ${preflight.fixture_identity.workspace_id}.`,
      "Create an isolated cloud workspace that cannot read or write the real workspace."
    ),
    gate(
      "rls-assertion-required",
      "RLS assertion is required",
      "blocked",
      "No cloud row-level isolation proof has been run.",
      "Prove the disposable actor can only access disposable workspace rows and cannot cross workspace boundaries."
    ),
    gate(
      "permission-audit-required",
      "Permission and audit proof is required",
      "blocked",
      ackLedgerContract.ack_policy.requires_permission_decision &&
      ackLedgerContract.ack_policy.requires_audit_event
        ? "The ledger contract already requires permission decision and audit evidence."
        : "The ledger contract is missing permission or audit requirements.",
      "Attach a permission decision and audit event to every accepted, rejected, retried, and rolled back fixture row."
    ),
    gate(
      "rollback-proof-required",
      "Rollback proof is required",
      proof.rollback_proof.rollback_status === "pass"
        ? "local-proof-ready"
        : "blocked",
      proof.rollback_proof.evidence,
      "Repeat the rollback proof in the disposable cloud workspace and return row counts to zero."
    ),
    gate(
      "zero-private-payload-required",
      "Zero private payload proof is required",
      preflight.boundary.uses_synthetic_rows_only &&
      proof.boundary.uses_synthetic_rows_only
        ? "local-proof-ready"
        : "blocked",
      "Local preflight and proof both use synthetic metadata-only rows.",
      "Prove the cloud replay request contains ids, counts, table names, statuses, timestamps, and hashes only."
    ),
    gate(
      "ack-cursor-proof-required",
      "Ack cursor count match is required",
      proof.assertions.some(
        (assertion) =>
          assertion.id === "proof-ack-cursor-after-count-match" &&
          assertion.status === "pass"
      )
        ? "local-proof-ready"
        : "blocked",
      "Local proof checks that ack cursor can advance only after accepted row counts match.",
      "Repeat the same count-match proof against disposable cloud ledger rows."
    ),
    gate(
      "idempotent-retry-required",
      "Idempotent retry is required",
      proof.summary.duplicate_batches_created === 0
        ? "local-proof-ready"
        : "blocked",
      "Local proof creates zero duplicate batches during duplicate replay.",
      "Repeat duplicate replay in the disposable cloud workspace and prove one stable batch identity."
    ),
    gate(
      "dead-letter-review-required",
      "Dead-letter manual review is required",
      ackLedgerContract.retry_policy.dead_letter_requires_manual_review
        ? "local-proof-ready"
        : "blocked",
      "Retry policy requires manual review after the retry cap.",
      "Show the disposable cloud dead-letter row remains blocked until owner review."
    ),
    gate(
      "production-replay-refused",
      "Production replay remains refused",
      "blocked",
      "Production workspace replay is intentionally disabled while disposable proof is absent.",
      "Never run replay against production until disposable proof is complete and the owner makes a separate go decision."
    ),
  ];
}

function buildSourceAssertionMapping(
  proof: SyncAckLedgerReplayProof
): SyncAckLedgerReplayEnablementMapping[] {
  const proofIds = new Set(proof.assertions.map((assertion) => assertion.id));

  return [
    mapping(
      "map-idempotency-to-cloud-gate",
      "proof-idempotent-batch",
      "idempotent-retry-required",
      proofIds.has("proof-idempotent-batch")
    ),
    mapping(
      "map-row-ack-to-cloud-gate",
      "proof-row-ack-before-local-apply",
      "ack-cursor-proof-required",
      proofIds.has("proof-row-ack-before-local-apply")
    ),
    mapping(
      "map-retry-cap-to-cloud-gate",
      "proof-retry-cap-dead-letter",
      "dead-letter-review-required",
      proofIds.has("proof-retry-cap-dead-letter")
    ),
    mapping(
      "map-rollback-to-cloud-gate",
      "proof-rollback-zeroes-fixture",
      "rollback-proof-required",
      proofIds.has("proof-rollback-zeroes-fixture")
    ),
    mapping(
      "map-private-payload-to-cloud-gate",
      "proof-metadata-only-boundary",
      "zero-private-payload-required",
      proofIds.has("proof-metadata-only-boundary")
    ),
  ];
}

function gate(
  id: string,
  title: string,
  status: SyncAckLedgerReplayEnablementStatus,
  evidence: string,
  requiredBeforeEnablement: string
): SyncAckLedgerReplayEnablementGate {
  return {
    id,
    title,
    status,
    evidence,
    required_before_enablement: requiredBeforeEnablement,
  };
}

function mapping(
  id: string,
  localSource: string,
  disposableCloudGate: string,
  isPresent: boolean
): SyncAckLedgerReplayEnablementMapping {
  return {
    id,
    local_source: localSource,
    disposable_cloud_gate: disposableCloudGate,
    status: isPresent ? "local-proof-ready" : "blocked",
    evidence: isPresent
      ? "Local synthetic proof source exists and is ready to repeat in a disposable cloud workspace."
      : "Local synthetic proof source is missing.",
  };
}
