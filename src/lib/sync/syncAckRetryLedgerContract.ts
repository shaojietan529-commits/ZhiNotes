import type { SyncPullApiDisabledResponse } from "@/lib/sync/syncPullApiStub";
import type { SyncPushApiDisabledResponse } from "@/lib/sync/syncPushApiStub";
import type { LocalWorkspaceIdentity } from "@/lib/sync/workspaceIdentity";

export type SyncAckLedgerTableId =
  | "sync_batches"
  | "sync_row_acks"
  | "sync_retry_events"
  | "sync_dead_letters"
  | "sync_ack_cursors";

export type SyncAckLedgerGateStatus = "pass" | "blocked";

export interface SyncAckRetryLedgerTable {
  table: SyncAckLedgerTableId;
  purpose: string;
  allowed_fields: string[];
  forbidden_payloads: string[];
  retention_rule: string;
}

export interface SyncAckRetryLedgerGate {
  id: string;
  title: string;
  status: SyncAckLedgerGateStatus;
  evidence: string;
  required_before_enablement: string;
}

export interface SyncAckRetryLedgerContractInput {
  syncPushApiGuard: SyncPushApiDisabledResponse;
  syncPullApiGuard: SyncPullApiDisabledResponse;
  totalSyncPending: number;
  totalSyncFailed?: number;
  totalSyncManualReview?: number;
  workspaceIdentity: LocalWorkspaceIdentity | null;
}

export interface SyncAckRetryLedgerContract {
  format: "zhinote-sync-ack-retry-ledger-contract";
  format_version: 1;
  contract_status: "local-contract-only";
  architecture_target: "cloud-master-local-hot-cache";
  can_enable_sync_push_now: false;
  can_mark_local_rows_synced_now: false;
  privacy_note: string;
  boundary: {
    local_contract_only: true;
    reads_route_disabled_guards: true;
    reads_pending_counts: true;
    reads_workspace_link_metadata: true;
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
  server_ledger_tables: SyncAckRetryLedgerTable[];
  ack_policy: {
    can_mark_local_synced_without_remote_ack: false;
    requires_durable_remote_ack: true;
    requires_idempotency_key: true;
    requires_remote_commit_id: true;
    requires_ack_cursor: true;
    requires_count_match: true;
    requires_payload_hash_match: true;
    requires_permission_decision: true;
    requires_audit_event: true;
  };
  retry_policy: {
    max_attempts_before_dead_letter: 3;
    retry_delays_ms: [60000, 300000, 1800000];
    dead_letter_requires_manual_review: true;
    retry_idempotency_scope: "workspace_id + device_id + local_batch_id + idempotency_key";
  };
  local_apply_policy: {
    keep_pending_on_network_error: true;
    keep_pending_on_server_5xx: true;
    mark_synced_only_after_row_ack: true;
    failed_rows_keep_next_retry_at: true;
    dead_letter_rows_require_manual_review: true;
    clear_pending_only_when_ack_cursor_advances: true;
  };
  enablement_gates: SyncAckRetryLedgerGate[];
  summary: {
    total_sync_pending: number;
    total_sync_failed: number;
    total_sync_manual_review: number;
    push_route_enabled: false;
    pull_route_enabled: false;
    cloud_workspace_linked: boolean;
    ledger_tables: number;
    blocked_gates: number;
    manual_review_required: boolean;
    next_action: string;
  };
}

const FORBIDDEN_LEDGER_PAYLOADS = [
  "page_body_text",
  "database_cell_values",
  "comment_body",
  "file_bytes",
  "backup_payload",
  "secret_values",
  "token",
  "cookie",
];

export function buildSyncAckRetryLedgerContract({
  syncPushApiGuard,
  syncPullApiGuard,
  totalSyncPending,
  totalSyncFailed = 0,
  totalSyncManualReview = 0,
  workspaceIdentity,
}: SyncAckRetryLedgerContractInput): SyncAckRetryLedgerContract {
  const enablementGates = buildEnablementGates({
    syncPushApiGuard,
    syncPullApiGuard,
    workspaceIdentity,
  });
  const blockedGates = enablementGates.filter(
    (gate) => gate.status === "blocked"
  ).length;

  return {
    format: "zhinote-sync-ack-retry-ledger-contract",
    format_version: 1,
    contract_status: "local-contract-only",
    architecture_target: "cloud-master-local-hot-cache",
    can_enable_sync_push_now: false,
    can_mark_local_rows_synced_now: false,
    privacy_note:
      "Local contract only. It reads disabled route guards, pending counts, and workspace link metadata; it does not read private content, send network requests, connect cloud services, write server data, upload workspace data, mutate sync_log, or mark rows synced.",
    boundary: {
      local_contract_only: true,
      reads_route_disabled_guards: true,
      reads_pending_counts: true,
      reads_workspace_link_metadata: true,
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
    server_ledger_tables: buildServerLedgerTables(),
    ack_policy: {
      can_mark_local_synced_without_remote_ack: false,
      requires_durable_remote_ack: true,
      requires_idempotency_key: true,
      requires_remote_commit_id: true,
      requires_ack_cursor: true,
      requires_count_match: true,
      requires_payload_hash_match: true,
      requires_permission_decision: true,
      requires_audit_event: true,
    },
    retry_policy: {
      max_attempts_before_dead_letter: 3,
      retry_delays_ms: [60000, 300000, 1800000],
      dead_letter_requires_manual_review: true,
      retry_idempotency_scope:
        "workspace_id + device_id + local_batch_id + idempotency_key",
    },
    local_apply_policy: {
      keep_pending_on_network_error: true,
      keep_pending_on_server_5xx: true,
      mark_synced_only_after_row_ack: true,
      failed_rows_keep_next_retry_at: true,
      dead_letter_rows_require_manual_review: true,
      clear_pending_only_when_ack_cursor_advances: true,
    },
    enablement_gates: enablementGates,
    summary: {
      total_sync_pending: totalSyncPending,
      total_sync_failed: totalSyncFailed,
      total_sync_manual_review: totalSyncManualReview,
      push_route_enabled: false,
      pull_route_enabled: false,
      cloud_workspace_linked: Boolean(workspaceIdentity?.cloud_workspace_id),
      ledger_tables: 5,
      blocked_gates: blockedGates,
      manual_review_required:
        blockedGates > 0 ||
        totalSyncPending > 0 ||
        totalSyncFailed > 0 ||
        totalSyncManualReview > 0,
      next_action:
        "Create durable server ledger tables, prove idempotent replay in a disposable workspace, and get owner confirmation before enabling sync push or marking any local sync_log row as synced.",
    },
  };
}

function buildServerLedgerTables(): SyncAckRetryLedgerTable[] {
  return [
    table(
      "sync_batches",
      "One row per reviewed local upload batch. This is the envelope that makes retries idempotent.",
      [
        "workspace_id",
        "actor_user_id",
        "device_id",
        "local_batch_id",
        "idempotency_key",
        "payload_preview_id",
        "operation_counts",
        "table_names",
        "payload_hash",
        "created_at",
        "status",
      ],
      "Keep batch metadata for audit and duplicate-write prevention."
    ),
    table(
      "sync_row_acks",
      "One row per accepted or rejected local sync_log row after durable remote write.",
      [
        "batch_id",
        "local_sync_log_row_id",
        "table_name",
        "row_id",
        "operation",
        "ack_status",
        "remote_commit_id",
        "acked_at",
        "checksum",
      ],
      "Keep row acknowledgements until local devices have advanced the ack cursor."
    ),
    table(
      "sync_retry_events",
      "Retry history for transient network, auth, and server errors.",
      [
        "batch_id",
        "local_sync_log_row_id",
        "attempt",
        "retry_after",
        "reason_code",
        "last_error_code",
        "created_at",
      ],
      "Keep enough retry history to explain why a row is still pending."
    ),
    table(
      "sync_dead_letters",
      "Rows that should stop automatic retry and wait for manual review.",
      [
        "batch_id",
        "local_sync_log_row_id",
        "table_name",
        "row_id",
        "reason_code",
        "final_error_code",
        "manual_review_required",
        "created_at",
      ],
      "Keep until the owner resolves, skips, or replays the failed row."
    ),
    table(
      "sync_ack_cursors",
      "Device-level cursor that proves local pending rows can be cleared.",
      [
        "workspace_id",
        "device_id",
        "last_ack_cursor",
        "last_remote_commit_id",
        "updated_at",
      ],
      "Keep the latest cursor per workspace and device."
    ),
  ];
}

function buildEnablementGates({
  syncPushApiGuard,
  syncPullApiGuard,
  workspaceIdentity,
}: Pick<
  SyncAckRetryLedgerContractInput,
  "syncPushApiGuard" | "syncPullApiGuard" | "workspaceIdentity"
>): SyncAckRetryLedgerGate[] {
  return [
    {
      id: "push-route-disabled",
      title: "Sync push route remains disabled",
      status: syncPushApiGuard.can_push_now ? "blocked" : "pass",
      evidence: syncPushApiGuard.stub_status,
      required_before_enablement:
        "Keep /api/sync/push disabled until the server ack ledger exists.",
    },
    {
      id: "pull-route-disabled",
      title: "Sync pull route remains disabled",
      status: syncPullApiGuard.can_pull_now ? "blocked" : "pass",
      evidence: syncPullApiGuard.stub_status,
      required_before_enablement:
        "Keep /api/sync/pull disabled until remote baseline staging and cursor review exist.",
    },
    {
      id: "server-ledger-missing",
      title: "Durable server ledger tables",
      status: "blocked",
      evidence:
        "No server-side sync_batches, sync_row_acks, sync_retry_events, sync_dead_letters, or sync_ack_cursors tables are active yet.",
      required_before_enablement:
        "Create ledger tables with RLS, indexes, audit events, and retention rules before accepting upload batches.",
    },
    {
      id: "disposable-replay-proof",
      title: "Disposable replay proof",
      status: "blocked",
      evidence:
        "No disposable workspace proof has shown idempotent retry, duplicate prevention, dead-letter handling, and rollback.",
      required_before_enablement:
        "Run repeatable push/retry/dead-letter replay fixtures against disposable cloud data.",
    },
    {
      id: "owner-confirmation",
      title: "Owner confirmation",
      status: "blocked",
      evidence: workspaceIdentity?.cloud_workspace_id
        ? "Workspace is linked, but first live push still needs explicit owner confirmation."
        : "No linked cloud workspace is available for reviewed first push.",
      required_before_enablement:
        "Require typed owner confirmation for the first live cloud push and for any recovery replay.",
    },
    {
      id: "permission-and-audit",
      title: "Permission and audit envelope",
      status: "blocked",
      evidence:
        "Permission decision and audit event envelopes are contracts only; they are not durable server evidence yet.",
      required_before_enablement:
        "Attach a server permission decision and audit event id to every accepted batch before ack.",
    },
  ];
}

function table(
  tableId: SyncAckLedgerTableId,
  purpose: string,
  allowedFields: string[],
  retentionRule: string
): SyncAckRetryLedgerTable {
  return {
    table: tableId,
    purpose,
    allowed_fields: allowedFields,
    forbidden_payloads: FORBIDDEN_LEDGER_PAYLOADS,
    retention_rule: retentionRule,
  };
}
