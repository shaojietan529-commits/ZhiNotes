import type {
  SyncAckLedgerTableId,
  SyncAckRetryLedgerContract,
} from "@/lib/sync/syncAckRetryLedgerContract";
import type { SyncReplayTestPlan } from "@/lib/sync/syncReplayTestPlan";

export type SyncAckLedgerReplayPreflightStatus =
  | "local-fixture-ready"
  | "manual-confirmation"
  | "blocked";

export interface SyncAckLedgerReplayFixture {
  id: string;
  table: SyncAckLedgerTableId;
  purpose: string;
  rows: number;
  allowed_fields: string[];
  forbidden_payloads: string[];
}

export interface SyncAckLedgerReplayAssertion {
  id: string;
  title: string;
  status: SyncAckLedgerReplayPreflightStatus;
  assertion: string;
  evidence: string;
  failure_condition: string;
}

export interface SyncAckLedgerReplayRefusal {
  id: string;
  refused_action: string;
  status: "blocked";
  evidence: string;
  required_before_enablement: string;
}

export interface SyncAckLedgerReplayPreflight {
  format: "zhinote-sync-ack-ledger-replay-preflight";
  format_version: 1;
  preflight_status: "local-fixture-only";
  can_run_replay_now: false;
  disabled_endpoint: "/api/sync/replay-test";
  architecture_target: "cloud-master-local-hot-cache";
  privacy_note: string;
  boundary: {
    local_fixture_only: true;
    uses_disposable_workspace_only: true;
    uses_synthetic_rows_only: true;
    reads_route_disabled_guards: true;
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_comment_bodies: false;
    reads_file_bytes: false;
    reads_secret_values: false;
    sends_network_requests: false;
    connects_cloud_services: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    mutates_local_sync_log: false;
    marks_local_rows_synced: false;
  };
  summary: {
    fixtures: number;
    assertions: number;
    blocked_refusals: number;
    replay_scenarios_linked: number;
    can_prove_server_ack_now: false;
    can_prove_retry_idempotency_now: false;
    next_action: string;
  };
  fixture_identity: {
    workspace_id: "disposable-workspace-fixture";
    device_id: "disposable-device-fixture";
    actor_user_id: "disposable-user-fixture";
    local_batch_id: "fixture-batch-001";
    idempotency_key: "fixture-idempotency-001";
  };
  fixtures: SyncAckLedgerReplayFixture[];
  assertions: SyncAckLedgerReplayAssertion[];
  refusals: SyncAckLedgerReplayRefusal[];
}

const FIXTURE_ROWS_BY_TABLE: Record<SyncAckLedgerTableId, number> = {
  sync_batches: 1,
  sync_row_acks: 2,
  sync_retry_events: 3,
  sync_dead_letters: 1,
  sync_ack_cursors: 1,
};

const LINKED_REPLAY_SCENARIO_IDS = new Set(["server-ack", "retry-idempotency"]);

export function buildSyncAckLedgerReplayPreflight({
  ackLedgerContract,
  replayTestPlan,
}: {
  ackLedgerContract: SyncAckRetryLedgerContract;
  replayTestPlan: SyncReplayTestPlan;
}): SyncAckLedgerReplayPreflight {
  const fixtures = ackLedgerContract.server_ledger_tables.map((table) => ({
    id: `${table.table}-fixture`,
    table: table.table,
    purpose: table.purpose,
    rows: FIXTURE_ROWS_BY_TABLE[table.table],
    allowed_fields: table.allowed_fields,
    forbidden_payloads: table.forbidden_payloads,
  }));
  const assertions = buildAssertions(ackLedgerContract);
  const refusals = buildRefusals();
  const linkedScenarios = replayTestPlan.scenarios.filter((scenario) =>
    LINKED_REPLAY_SCENARIO_IDS.has(scenario.id)
  );

  return {
    format: "zhinote-sync-ack-ledger-replay-preflight",
    format_version: 1,
    preflight_status: "local-fixture-only",
    can_run_replay_now: false,
    disabled_endpoint: "/api/sync/replay-test",
    architecture_target: "cloud-master-local-hot-cache",
    privacy_note:
      "本地预检包只定义一次性工作区 fixture 和断言；它不会读取页面正文、数据库行值、评论正文、文件字节或密钥，不会连接云端、发送网络请求、上传工作区数据、写 server、修改 sync_log 或把本地行标成 synced。",
    boundary: {
      local_fixture_only: true,
      uses_disposable_workspace_only: true,
      uses_synthetic_rows_only: true,
      reads_route_disabled_guards: true,
      reads_page_body_text: false,
      reads_database_row_values: false,
      reads_comment_bodies: false,
      reads_file_bytes: false,
      reads_secret_values: false,
      sends_network_requests: false,
      connects_cloud_services: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      mutates_local_sync_log: false,
      marks_local_rows_synced: false,
    },
    summary: {
      fixtures: fixtures.length,
      assertions: assertions.length,
      blocked_refusals: refusals.length,
      replay_scenarios_linked: linkedScenarios.length,
      can_prove_server_ack_now: false,
      can_prove_retry_idempotency_now: false,
      next_action:
        "Owner confirmation is required before running any disposable replay. Keep live sync push disabled until the fixture proves ack cursor, idempotency, retry, dead-letter, permission, audit, and rollback behavior.",
    },
    fixture_identity: {
      workspace_id: "disposable-workspace-fixture",
      device_id: "disposable-device-fixture",
      actor_user_id: "disposable-user-fixture",
      local_batch_id: "fixture-batch-001",
      idempotency_key: "fixture-idempotency-001",
    },
    fixtures,
    assertions,
    refusals,
  };
}

function buildAssertions(
  ackLedgerContract: SyncAckRetryLedgerContract
): SyncAckLedgerReplayAssertion[] {
  return [
    {
      id: "idempotency-key-replay",
      title: "Idempotency key prevents duplicate batches",
      status: "local-fixture-ready",
      assertion:
        "Replaying the same workspace_id, device_id, local_batch_id, and idempotency_key must return the same batch identity instead of creating duplicate remote rows.",
      evidence: ackLedgerContract.retry_policy.retry_idempotency_scope,
      failure_condition:
        "A second replay attempt creates a second accepted batch for the same fixture identity.",
    },
    {
      id: "row-ack-before-local-synced",
      title: "Row ack gates local synced status",
      status: "local-fixture-ready",
      assertion:
        "A local sync row remains pending until a matching sync_row_acks record is durable and accepted.",
      evidence: ackLedgerContract.local_apply_policy.mark_synced_only_after_row_ack
        ? "mark_synced_only_after_row_ack is required."
        : "Local apply policy is missing the row ack gate.",
      failure_condition:
        "Any local row is cleared before its remote commit id, ack status, checksum, and acked_at evidence exist.",
    },
    {
      id: "ack-cursor-advances-after-count-match",
      title: "Ack cursor advances only after counts match",
      status: "local-fixture-ready",
      assertion:
        "The device ack cursor can advance only when expected accepted rows match durable ack rows for the fixture batch.",
      evidence: ackLedgerContract.ack_policy.requires_count_match
        ? "Count match is part of the ack policy."
        : "Ack policy is missing count matching.",
      failure_condition:
        "The cursor advances while an expected accepted fixture row is absent, rejected, or unmatched by checksum.",
    },
    {
      id: "retry-limit-to-dead-letter",
      title: "Retry cap routes failed rows to dead-letter",
      status: "local-fixture-ready",
      assertion:
        "After the configured retry limit, the fixture row must stop automatic retry and enter sync_dead_letters.",
      evidence: `max_attempts_before_dead_letter=${ackLedgerContract.retry_policy.max_attempts_before_dead_letter}`,
      failure_condition:
        "A fixture row keeps retrying automatically after the configured attempt cap.",
    },
    {
      id: "dead-letter-manual-review",
      title: "Dead-letter rows require manual review",
      status: "manual-confirmation",
      assertion:
        "Dead-letter recovery must require owner review before skip, replay, or local resolution.",
      evidence: ackLedgerContract.retry_policy.dead_letter_requires_manual_review
        ? "Manual review is required by retry policy."
        : "Retry policy does not require manual review.",
      failure_condition:
        "A dead-letter row is silently retried, skipped, or marked resolved without an owner-visible decision.",
    },
    {
      id: "metadata-only-fixtures",
      title: "Fixtures stay metadata-only",
      status: "local-fixture-ready",
      assertion:
        "Replay fixtures can reference ids, counts, status, timestamps, table names, and hashes only.",
      evidence:
        "The preflight boundary denies page body text, database row values, comment bodies, file bytes, and secret values.",
      failure_condition:
        "Fixture material includes private note text, cell values, comment text, uploaded file bytes, cookies, tokens, or backup payloads.",
    },
    {
      id: "rollback-fixture-reset",
      title: "Disposable workspace can reset cleanly",
      status: "blocked",
      assertion:
        "A replay run is acceptable only when all fixture ledger rows can be dropped or reset without touching the real workspace.",
      evidence:
        "No disposable replay runner is active yet; /api/sync/replay-test remains disabled.",
      failure_condition:
        "A failed run leaves fixture rows mixed with live workspace rows or cannot restore the starting state.",
    },
  ];
}

function buildRefusals(): SyncAckLedgerReplayRefusal[] {
  return [
    {
      id: "refuse-live-workspace",
      refused_action: "Run replay against a real workspace",
      status: "blocked",
      evidence:
        "This preflight is local-fixture-only and uses disposable-workspace-fixture identities.",
      required_before_enablement:
        "Create an isolated disposable cloud workspace and prove it cannot read or write live user data.",
    },
    {
      id: "refuse-real-sync-push",
      refused_action: "Enable /api/sync/push from this preflight",
      status: "blocked",
      evidence:
        "The preflight can_run_replay_now value is false and the replay endpoint remains disabled.",
      required_before_enablement:
        "Pass disposable replay, permission, audit, owner confirmation, and rollback proof first.",
    },
    {
      id: "refuse-mark-local-synced",
      refused_action: "Mark local sync rows as synced",
      status: "blocked",
      evidence:
        "The boundary forbids mutating local sync_log and marking local rows synced.",
      required_before_enablement:
        "Require durable remote row acknowledgements and an advanced ack cursor.",
    },
    {
      id: "refuse-read-private-payload",
      refused_action: "Read private note, database, comment, file, or secret payloads",
      status: "blocked",
      evidence:
        "Fixture rows use synthetic metadata only and forbidden payload lists come from the ledger contract.",
      required_before_enablement:
        "Keep payload parsing out of replay preflight; owner-gated content upload must be implemented separately.",
    },
    {
      id: "refuse-cloud-connection",
      refused_action: "Connect cloud services while building this report",
      status: "blocked",
      evidence:
        "The boundary forbids network requests, cloud service connections, server writes, and workspace uploads.",
      required_before_enablement:
        "Use a separate, owner-confirmed disposable replay runner for cloud proof.",
    },
  ];
}
