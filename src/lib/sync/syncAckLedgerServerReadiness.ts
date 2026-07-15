import type { CloudMigrationSqlDraft } from "@/lib/sync/cloudMigrationSqlDraft";
import type { SyncAckLedgerReplayEnablement } from "@/lib/sync/syncAckLedgerReplayEnablement";
import type {
  SyncAckLedgerTableId,
  SyncAckRetryLedgerContract,
} from "@/lib/sync/syncAckRetryLedgerContract";
import type { SyncPullApiDisabledResponse } from "@/lib/sync/syncPullApiStub";
import type { SyncPushApiDisabledResponse } from "@/lib/sync/syncPushApiStub";

export type SyncAckLedgerServerReadinessStatus =
  | "pass"
  | "manual-confirmation"
  | "blocked";

export interface SyncAckLedgerServerReadinessGate {
  id: string;
  title: string;
  status: SyncAckLedgerServerReadinessStatus;
  evidence: string;
  required_before_enablement: string;
}

export interface SyncAckLedgerServerReadiness {
  format: "zhinote-sync-ack-ledger-server-readiness";
  format_version: 1;
  readiness_status: "local-readiness-only";
  architecture_target: "cloud-master-local-hot-cache";
  can_enable_sync_push_now: false;
  can_mark_local_rows_synced_now: false;
  can_query_server_ledger_now: false;
  can_apply_migration_now: false;
  privacy_note: string;
  boundary: {
    local_readiness_only: true;
    reads_sql_draft_metadata: true;
    reads_route_disabled_guards: true;
    reads_replay_enablement_gates: true;
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_comment_bodies: false;
    reads_file_bytes: false;
    reads_secret_values: false;
    sends_network_requests: false;
    connects_cloud_services: false;
    applies_sql: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    mutates_local_sync_log: false;
    marks_local_rows_synced: false;
  };
  summary: {
    ledger_tables_required: number;
    ledger_sql_tables_drafted: number;
    route_guards_disabled: number;
    local_replay_ready_gates: number;
    manual_confirmation_gates: number;
    blocked_gates: number;
    remaining_blockers: number;
    next_action: string;
  };
  ledger_tables: Array<{
    table: SyncAckLedgerTableId;
    sql_drafted: boolean;
    contract_fields: number;
    privacy_boundary: string;
  }>;
  gates: SyncAckLedgerServerReadinessGate[];
}

export function buildSyncAckLedgerServerReadiness({
  ackLedgerContract,
  replayEnablement,
  cloudMigrationSqlDraft,
  syncPushApiGuard,
  syncPullApiGuard,
}: {
  ackLedgerContract: SyncAckRetryLedgerContract;
  replayEnablement: SyncAckLedgerReplayEnablement;
  cloudMigrationSqlDraft: CloudMigrationSqlDraft;
  syncPushApiGuard: SyncPushApiDisabledResponse;
  syncPullApiGuard: SyncPullApiDisabledResponse;
}): SyncAckLedgerServerReadiness {
  const draftedTableNames = new Set(
    cloudMigrationSqlDraft.statements.map((statement) => statement.table_name)
  );
  const ledgerTables = ackLedgerContract.server_ledger_tables.map((table) => ({
    table: table.table,
    sql_drafted: draftedTableNames.has(table.table),
    contract_fields: table.allowed_fields.length,
    privacy_boundary:
      "metadata-only ledger row; no page bodies, database values, comments, file bytes, tokens, cookies, or secrets.",
  }));
  const ledgerSqlTablesDrafted = ledgerTables.filter(
    (table) => table.sql_drafted
  ).length;
  const gates = buildReadinessGates({
    ackLedgerContract,
    replayEnablement,
    cloudMigrationSqlDraft,
    syncPushApiGuard,
    syncPullApiGuard,
    ledgerSqlTablesDrafted,
  });
  const manualConfirmationGates = gates.filter(
    (gate) => gate.status === "manual-confirmation"
  ).length;
  const blockedGates = gates.filter((gate) => gate.status === "blocked").length;

  return {
    format: "zhinote-sync-ack-ledger-server-readiness",
    format_version: 1,
    readiness_status: "local-readiness-only",
    architecture_target: "cloud-master-local-hot-cache",
    can_enable_sync_push_now: false,
    can_mark_local_rows_synced_now: false,
    can_query_server_ledger_now: false,
    can_apply_migration_now: false,
    privacy_note:
      "Local readiness report only. It compares the ack/retry ledger contract, SQL draft metadata, disabled push/pull route guards, and replay enablement gates. It does not read private content, send network requests, connect cloud services, apply SQL, write server data, upload workspace data, mutate sync_log, or mark rows synced.",
    boundary: {
      local_readiness_only: true,
      reads_sql_draft_metadata: true,
      reads_route_disabled_guards: true,
      reads_replay_enablement_gates: true,
      reads_page_body_text: false,
      reads_database_row_values: false,
      reads_comment_bodies: false,
      reads_file_bytes: false,
      reads_secret_values: false,
      sends_network_requests: false,
      connects_cloud_services: false,
      applies_sql: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      mutates_local_sync_log: false,
      marks_local_rows_synced: false,
    },
    summary: {
      ledger_tables_required: ackLedgerContract.server_ledger_tables.length,
      ledger_sql_tables_drafted: ledgerSqlTablesDrafted,
      route_guards_disabled: [
        !syncPushApiGuard.can_push_now,
        !syncPullApiGuard.can_pull_now,
      ].filter(Boolean).length,
      local_replay_ready_gates: replayEnablement.summary.local_ready,
      manual_confirmation_gates: manualConfirmationGates,
      blocked_gates: blockedGates,
      remaining_blockers: blockedGates + manualConfirmationGates,
      next_action:
        blockedGates > 0
          ? "先补 disposable cloud replay、RLS、permission、audit 和 rollback 证据；完成前保持 /api/sync/push 与 /api/sync/pull 关闭。"
          : "等待 owner 明确确认一次性云端演练范围后，才可以进入 disposable workspace replay。",
    },
    ledger_tables: ledgerTables,
    gates,
  };
}

function buildReadinessGates({
  ackLedgerContract,
  replayEnablement,
  cloudMigrationSqlDraft,
  syncPushApiGuard,
  syncPullApiGuard,
  ledgerSqlTablesDrafted,
}: {
  ackLedgerContract: SyncAckRetryLedgerContract;
  replayEnablement: SyncAckLedgerReplayEnablement;
  cloudMigrationSqlDraft: CloudMigrationSqlDraft;
  syncPushApiGuard: SyncPushApiDisabledResponse;
  syncPullApiGuard: SyncPullApiDisabledResponse;
  ledgerSqlTablesDrafted: number;
}): SyncAckLedgerServerReadinessGate[] {
  const ledgerTableCount = ackLedgerContract.server_ledger_tables.length;

  return [
    gate({
      id: "ledger-sql-draft-complete",
      title: "ACK ledger SQL draft complete",
      status: ledgerSqlTablesDrafted === ledgerTableCount ? "pass" : "blocked",
      evidence: `${ledgerSqlTablesDrafted}/${ledgerTableCount} ack ledger tables are present in the local SQL draft.`,
      required:
        "All sync_batches, sync_row_acks, sync_retry_events, sync_dead_letters, and sync_ack_cursors SQL drafts must exist before migration review.",
    }),
    gate({
      id: "migration-apply-still-owner-gated",
      title: "Migration apply remains owner-gated",
      status: cloudMigrationSqlDraft.can_apply_migrations
        ? "blocked"
        : "manual-confirmation",
      evidence: cloudMigrationSqlDraft.can_apply_migrations
        ? "Migration apply is unexpectedly enabled."
        : "Migration apply is disabled and still requires owner confirmation.",
      required:
        "Owner must approve cloud migration scope, rollback, and disposable replay before any SQL apply.",
    }),
    gate({
      id: "push-pull-routes-still-disabled",
      title: "Sync push/pull routes remain disabled",
      status:
        !syncPushApiGuard.can_push_now && !syncPullApiGuard.can_pull_now
          ? "pass"
          : "blocked",
      evidence: `/api/sync/push can_push_now=${syncPushApiGuard.can_push_now}; /api/sync/pull can_pull_now=${syncPullApiGuard.can_pull_now}.`,
      required:
        "Keep push/pull disabled until durable ACK rows, ack cursor, permission, audit, and replay proof are complete.",
    }),
    gate({
      id: "local-replay-proof-mapped",
      title: "Local replay proof is mapped to cloud gates",
      status: replayEnablement.summary.local_ready >= 5 ? "pass" : "blocked",
      evidence: `${replayEnablement.summary.local_ready} local replay gates are ready; ${replayEnablement.summary.blocked} gates remain blocked.`,
      required:
        "Local idempotency, ack cursor, retry, dead-letter, and rollback proof must map cleanly to disposable cloud replay gates.",
    }),
    gate({
      id: "disposable-cloud-replay-required",
      title: "Disposable cloud replay is still required",
      status: replayEnablement.can_run_disposable_cloud_replay_now
        ? "pass"
        : "blocked",
      evidence: replayEnablement.can_run_disposable_cloud_replay_now
        ? "Disposable cloud replay is allowed."
        : "Disposable cloud replay remains disabled by design.",
      required:
        "Run only against an isolated disposable workspace after owner confirmation; never against production data first.",
    }),
    gate({
      id: "no-local-synced-before-ack",
      title: "Local synced state waits for remote ACK cursor",
      status:
        ackLedgerContract.local_apply_policy.mark_synced_only_after_row_ack &&
        ackLedgerContract.local_apply_policy.clear_pending_only_when_ack_cursor_advances
          ? "pass"
          : "blocked",
      evidence:
        "Contract requires row ACK before synced and requires ack cursor movement before clearing pending.",
      required:
        "Do not mark local sync_log rows synced until durable sync_row_acks and sync_ack_cursors prove server commit.",
    }),
    gate({
      id: "production-sync-still-refused",
      title: "Production sync remains refused",
      status:
        !replayEnablement.can_run_production_replay_now &&
        !replayEnablement.can_enable_sync_push_now
          ? "pass"
          : "blocked",
      evidence: `production_replay=${replayEnablement.can_run_production_replay_now}; sync_push=${replayEnablement.can_enable_sync_push_now}.`,
      required:
        "Production sync must remain refused until disposable replay, owner confirmation, and real route implementation are complete.",
    }),
  ];
}

function gate(input: {
  id: string;
  title: string;
  status: SyncAckLedgerServerReadinessStatus;
  evidence: string;
  required: string;
}): SyncAckLedgerServerReadinessGate {
  return {
    id: input.id,
    title: input.title,
    status: input.status,
    evidence: input.evidence,
    required_before_enablement: input.required,
  };
}
