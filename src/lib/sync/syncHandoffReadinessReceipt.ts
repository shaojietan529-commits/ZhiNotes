import type { PendingCloudDatabaseSyncStatus } from "@/lib/database/accountDatabaseSync";
import type { PendingFileEmbedSyncStatus } from "@/lib/files/fileEmbedSyncQueue";
import type { PendingCloudPageSyncStatus } from "@/lib/pages/accountPageSync";
import type { LocalWorkspaceIdentity } from "@/lib/sync/workspaceIdentity";

const HANDOFF_STALE_PENDING_MS = 30 * 60 * 1000;
const HANDOFF_CRITICAL_PENDING_MS = 6 * 60 * 60 * 1000;

export type SyncHandoffReadinessStatus =
  | "ready"
  | "blocked-local-only"
  | "blocked-sync-disabled"
  | "blocked-pending"
  | "blocked-stale-pending"
  | "blocked-failed"
  | "blocked-manual-review";

export type SyncHandoffReadinessGateStatus = "pass" | "warn" | "block";

export type SyncHandoffMode =
  | "cloud-workspace"
  | "account-bridge"
  | "local-only";

export interface SyncHandoffReadinessReceiptInput {
  pageStatus: PendingCloudPageSyncStatus;
  databaseStatus: PendingCloudDatabaseSyncStatus;
  fileStatus: PendingFileEmbedSyncStatus;
  totalSyncPending: number;
  totalSyncFailed?: number;
  totalSyncManualReview?: number;
  workspaceIdentity: LocalWorkspaceIdentity | null;
  generatedAt?: string;
}

type PageLastSyncOutcome = NonNullable<PendingCloudPageSyncStatus["lastOutcome"]>;
type DatabaseLastSyncOutcome = NonNullable<
  PendingCloudDatabaseSyncStatus["lastOutcome"]
>;
type FileLastSyncOutcome = NonNullable<PendingFileEmbedSyncStatus["lastOutcome"]>;

export interface SyncHandoffReadinessGate {
  id: string;
  title: string;
  status: SyncHandoffReadinessGateStatus;
  evidence: string;
  next_action: string;
}

export type SyncHandoffReadinessNextStepStatus = "done" | "current" | "later";

export interface SyncHandoffReadinessNextStep {
  id: string;
  gate_id: string;
  label: string;
  status: SyncHandoffReadinessNextStepStatus;
  action: string;
}

export interface SyncHandoffReadinessReceipt {
  format: "zhinote-sync-handoff-readiness-receipt";
  format_version: 1;
  receipt_status: "metadata-only-local-check";
  architecture_target: "cloud-master-local-hot-cache";
  receipt_id: string;
  generated_at: string;
  status: SyncHandoffReadinessStatus;
  privacy_boundary: string;
  boundary: {
    local_receipt_only: true;
    reads_queue_counts: true;
    reads_sync_enabled_flags: true;
    reads_workspace_link_metadata: true;
    reads_failure_counts: true;
    reads_queue_timestamps: true;
    reads_page_sync_outcome_summary: true;
    reads_database_sync_outcome_summary: true;
    reads_file_sync_outcome_summary: true;
    reads_page_sync_failure_messages: false;
    reads_database_sync_failure_messages: false;
    reads_file_sync_failure_messages: false;
    reads_page_ids: false;
    reads_database_keys: false;
    reads_failure_messages: false;
    reads_page_body_text: false;
    reads_page_yjs: false;
    reads_database_row_values: false;
    reads_comment_bodies: false;
    reads_file_names: false;
    reads_file_bytes: false;
    reads_secret_values: false;
    sends_network_requests: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    clears_local_cache: false;
    mutates_local_cache_records: false;
    enables_sync: false;
    enables_ai: false;
    exports_raw_workspace_ids: false;
    includes_raw_workspace_content: false;
    includes_only_counts_booleans_hashes_timestamps_and_gates: true;
    includes_only_counts_booleans_hashes_timestamps_gates_and_steps: true;
    includes_page_sync_outcome_counts_status_source_and_timestamps: true;
    includes_database_sync_outcome_counts_status_source_and_timestamps: true;
    includes_file_sync_outcome_counts_status_source_and_timestamps: true;
  };
  summary: {
    handoff_mode: SyncHandoffMode;
    ready_for_cross_device_handoff: boolean;
    safe_to_open_other_device: boolean;
    ready_for_cloud_cache_read: boolean;
    account_bridge_ready: boolean;
    account_bridge_sync_domains_ready: boolean;
    cloud_master_ready: boolean;
    cloud_workspace_linked: boolean;
    page_sync_enabled: boolean;
    page_last_sync_outcome_status: PageLastSyncOutcome["status"] | null;
    page_last_sync_outcome_source: PageLastSyncOutcome["source"] | null;
    page_last_sync_outcome_at: string | null;
    page_last_sync_outcome_pushed: number;
    page_last_sync_outcome_pulled: number;
    page_last_sync_outcome_accepted: number;
    page_last_sync_outcome_skipped_remote_newer: number;
    page_last_sync_outcome_pending_after: number;
    database_sync_enabled: boolean;
    database_last_sync_outcome_status: DatabaseLastSyncOutcome["status"] | null;
    database_last_sync_outcome_source: DatabaseLastSyncOutcome["source"] | null;
    database_last_sync_outcome_at: string | null;
    database_last_sync_outcome_pushed: number;
    database_last_sync_outcome_pulled: number;
    database_last_sync_outcome_accepted: number;
    database_last_sync_outcome_skipped: number;
    database_last_sync_outcome_pending_after: number;
    file_sync_enabled: boolean;
    file_last_sync_outcome_status: FileLastSyncOutcome["status"] | null;
    file_last_sync_outcome_source: FileLastSyncOutcome["source"] | null;
    file_last_sync_outcome_at: string | null;
    file_last_sync_outcome_attempted: number;
    file_last_sync_outcome_synced: number;
    file_last_sync_outcome_failed: number;
    file_last_sync_outcome_manual_review: number;
    file_last_sync_outcome_missing_local_files: number;
    file_last_sync_outcome_auth_deferred: number;
    file_last_sync_outcome_pending_after: number;
    workspace_fingerprint: string | null;
    device_fingerprint: string | null;
    cloud_workspace_fingerprint: string | null;
    page_pending_rows: number;
    page_in_memory_queued_rows: number;
    page_sync_log_pending_rows: number;
    database_pending_rows: number;
    database_in_memory_queued_rows: number;
    database_sync_log_pending_rows: number;
    file_pending_rows: number;
    deduplicated_pending_rows: number;
    total_sync_log_pending_rows: number;
    total_sync_log_covered_pending_rows: number;
    total_sync_log_unclassified_pending_rows: number;
    failed_rows: number;
    manual_review_rows: number;
    oldest_pending_queued_at: string | null;
    oldest_pending_age_ms: number | null;
    oldest_pending_age_label: string;
    blockers: number;
    warnings: number;
    receipt_hash: string;
  };
  gates: SyncHandoffReadinessGate[];
  next_action_steps: SyncHandoffReadinessNextStep[];
  owner_actions: string[];
  next_action: string;
}

export function buildSyncHandoffReadinessReceipt(
  input: SyncHandoffReadinessReceiptInput
): SyncHandoffReadinessReceipt {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const pageLastOutcome = input.pageStatus.lastOutcome;
  const databaseLastOutcome = input.databaseStatus.lastOutcome;
  const fileLastOutcome = input.fileStatus.lastOutcome;
  const pageSyncLogPendingRows = input.pageStatus.syncLogPending ?? 0;
  const databaseSyncLogPendingRows = input.databaseStatus.syncLogPending ?? 0;
  const syncLogCoveredPendingRows =
    pageSyncLogPendingRows + databaseSyncLogPendingRows;
  const syncLogUnclassifiedPendingRows = Math.max(
    input.totalSyncPending - syncLogCoveredPendingRows,
    0
  );
  const pagePendingRows =
    input.pageStatus.pending +
    input.pageStatus.queued +
    pageSyncLogPendingRows;
  const databasePendingRows =
    input.databaseStatus.pending +
    input.databaseStatus.queued +
    databaseSyncLogPendingRows;
  const filePendingRows = input.fileStatus.pending;
  const deduplicatedPendingRows =
    pagePendingRows +
    databasePendingRows +
    filePendingRows +
    syncLogUnclassifiedPendingRows;
  const failedRows = Math.max(
    input.pageStatus.failed + input.databaseStatus.failed + input.fileStatus.failed,
    input.totalSyncFailed ?? 0
  );
  const manualReviewRows = Math.max(
    input.pageStatus.manualReviewCount +
      input.databaseStatus.manualReviewCount +
      input.fileStatus.manualReviewCount,
    input.totalSyncManualReview ?? 0
  );
  const oldestPendingQueuedAt = getOldestTimestamp([
    input.pageStatus.oldestPendingQueuedAt,
    input.databaseStatus.oldestPendingQueuedAt,
    input.fileStatus.oldestPendingQueuedAt,
  ]);
  const oldestPendingAgeMs = getAgeMs(oldestPendingQueuedAt, generatedAt);
  const oldestPendingAgeLabel = formatAge(oldestPendingAgeMs);
  const hasPending = deduplicatedPendingRows > 0;
  const hasStalePending =
    hasPending &&
    oldestPendingAgeMs !== null &&
    oldestPendingAgeMs >= HANDOFF_STALE_PENDING_MS;
  const hasCriticalPending =
    hasPending &&
    oldestPendingAgeMs !== null &&
    oldestPendingAgeMs >= HANDOFF_CRITICAL_PENDING_MS;
  const cloudWorkspaceLinked =
    input.workspaceIdentity?.cloud_status === "linked-alpha";
  const pageSyncEnabled = input.pageStatus.enabled;
  const databaseSyncEnabled = input.databaseStatus.enabled;
  const fileSyncEnabled = input.fileStatus.enabled;
  const accountBridgeSyncDomainsReady =
    pageSyncEnabled && databaseSyncEnabled && fileSyncEnabled;
  const accountBridgeReady =
    accountBridgeSyncDomainsReady &&
    !hasPending &&
    failedRows === 0 &&
    manualReviewRows === 0 &&
    !hasStalePending;
  const cloudMasterReady = cloudWorkspaceLinked && accountBridgeReady;
  const handoffMode: SyncHandoffMode = cloudMasterReady
    ? "cloud-workspace"
    : accountBridgeReady
      ? "account-bridge"
      : "local-only";
  const status = getHandoffStatus({
    cloudWorkspaceLinked,
    accountBridgeReady,
    pageSyncEnabled,
    databaseSyncEnabled,
    fileSyncEnabled,
    hasPending,
    hasStalePending,
    failedRows,
    manualReviewRows,
  });
  const workspaceFingerprint = input.workspaceIdentity
    ? stableHash({
        workspace_id: input.workspaceIdentity.workspace_id,
        cloud_workspace_id: input.workspaceIdentity.cloud_workspace_id ?? null,
      })
    : null;
  const deviceFingerprint = input.workspaceIdentity
    ? stableHash({ device_id: input.workspaceIdentity.device_id })
    : null;
  const cloudWorkspaceFingerprint = input.workspaceIdentity?.cloud_workspace_id
    ? stableHash({
        cloud_workspace_id: input.workspaceIdentity.cloud_workspace_id,
      })
    : null;
  const gates = buildGates({
    cloudWorkspaceLinked,
    accountBridgeReady,
    accountBridgeSyncDomainsReady,
    pageSyncEnabled,
    databaseSyncEnabled,
    fileSyncEnabled,
    pagePendingRows,
    databasePendingRows,
    filePendingRows,
    totalSyncPending: input.totalSyncPending,
    syncLogCoveredPendingRows,
    syncLogUnclassifiedPendingRows,
    deduplicatedPendingRows,
    failedRows,
    manualReviewRows,
    oldestPendingQueuedAt,
    oldestPendingAgeLabel,
    hasPending,
    hasStalePending,
    hasCriticalPending,
  });
  const blockers = gates.filter((gate) => gate.status === "block").length;
  const warnings = gates.filter((gate) => gate.status === "warn").length;
  const nextActionSteps = buildNextActionSteps(gates);
  const receiptHash = stableHash({
    generated_at: generatedAt,
    status,
    handoff_mode: handoffMode,
    account_bridge_ready: accountBridgeReady,
    account_bridge_sync_domains_ready: accountBridgeSyncDomainsReady,
    cloud_master_ready: cloudMasterReady,
    workspace_fingerprint: workspaceFingerprint,
    device_fingerprint: deviceFingerprint,
    cloud_workspace_fingerprint: cloudWorkspaceFingerprint,
    page_last_sync_outcome_status: pageLastOutcome?.status ?? null,
    page_last_sync_outcome_source: pageLastOutcome?.source ?? null,
    page_last_sync_outcome_at: pageLastOutcome?.at ?? null,
    page_last_sync_outcome_pushed: pageLastOutcome?.pushed ?? 0,
    page_last_sync_outcome_pulled: pageLastOutcome?.pulled ?? 0,
    page_last_sync_outcome_accepted: pageLastOutcome?.accepted ?? 0,
    page_last_sync_outcome_skipped_remote_newer:
      pageLastOutcome?.skippedRemoteNewer ?? 0,
    page_last_sync_outcome_pending_after: pageLastOutcome?.pendingAfter ?? 0,
    database_last_sync_outcome_status: databaseLastOutcome?.status ?? null,
    database_last_sync_outcome_source: databaseLastOutcome?.source ?? null,
    database_last_sync_outcome_at: databaseLastOutcome?.at ?? null,
    database_last_sync_outcome_pushed: databaseLastOutcome?.pushed ?? 0,
    database_last_sync_outcome_pulled: databaseLastOutcome?.pulled ?? 0,
    database_last_sync_outcome_accepted: databaseLastOutcome?.accepted ?? 0,
    database_last_sync_outcome_skipped: databaseLastOutcome?.skipped ?? 0,
    database_last_sync_outcome_pending_after:
      databaseLastOutcome?.pendingAfter ?? 0,
    file_last_sync_outcome_status: fileLastOutcome?.status ?? null,
    file_last_sync_outcome_source: fileLastOutcome?.source ?? null,
    file_last_sync_outcome_at: fileLastOutcome?.at ?? null,
    file_last_sync_outcome_attempted: fileLastOutcome?.attempted ?? 0,
    file_last_sync_outcome_synced: fileLastOutcome?.synced ?? 0,
    file_last_sync_outcome_failed: fileLastOutcome?.failed ?? 0,
    file_last_sync_outcome_manual_review: fileLastOutcome?.manualReview ?? 0,
    file_last_sync_outcome_missing_local_files:
      fileLastOutcome?.missingLocalFiles ?? 0,
    file_last_sync_outcome_auth_deferred: fileLastOutcome?.authDeferred ?? 0,
    file_last_sync_outcome_pending_after: fileLastOutcome?.pendingAfter ?? 0,
    page_pending_rows: pagePendingRows,
    page_sync_log_pending_rows: pageSyncLogPendingRows,
    database_pending_rows: databasePendingRows,
    file_pending_rows: filePendingRows,
    deduplicated_pending_rows: deduplicatedPendingRows,
    total_sync_log_pending_rows: input.totalSyncPending,
    total_sync_log_covered_pending_rows: syncLogCoveredPendingRows,
    total_sync_log_unclassified_pending_rows: syncLogUnclassifiedPendingRows,
    failed_rows: failedRows,
    manual_review_rows: manualReviewRows,
    oldest_pending_queued_at: oldestPendingQueuedAt,
    gates: gates.map((gate) => ({ id: gate.id, status: gate.status })),
    next_action_steps: nextActionSteps.map((step) => ({
      gate_id: step.gate_id,
      status: step.status,
    })),
  });

  return {
    format: "zhinote-sync-handoff-readiness-receipt",
    format_version: 1,
    receipt_status: "metadata-only-local-check",
    architecture_target: "cloud-master-local-hot-cache",
    receipt_id: `sync-handoff-readiness:${receiptHash}`,
    generated_at: generatedAt,
    status,
    privacy_boundary:
      "Generated locally to decide whether this browser can safely hand work to another device through either the full cloud workspace or the account-level sync bridge. It records only counts, sync flags, hashed workspace/device fingerprints, queue timestamps, page/database/file sync outcome status/source/counts, gate statuses, and gate-derived owner next steps. It does not read or export page ids, database keys, account emails, page bodies, Yjs payloads, database values, comments, file names, file bytes, page/database/file sync failure messages, failure messages, secrets, tokens, credentials, raw workspace ids, or raw cache dumps; it does not send network requests, upload workspace data, clear local cache, mutate local cache records, or enable sync/AI.",
    boundary: {
      local_receipt_only: true,
      reads_queue_counts: true,
      reads_sync_enabled_flags: true,
      reads_workspace_link_metadata: true,
      reads_failure_counts: true,
      reads_queue_timestamps: true,
      reads_page_sync_outcome_summary: true,
      reads_database_sync_outcome_summary: true,
      reads_file_sync_outcome_summary: true,
      reads_page_sync_failure_messages: false,
      reads_database_sync_failure_messages: false,
      reads_file_sync_failure_messages: false,
      reads_page_ids: false,
      reads_database_keys: false,
      reads_failure_messages: false,
      reads_page_body_text: false,
      reads_page_yjs: false,
      reads_database_row_values: false,
      reads_comment_bodies: false,
      reads_file_names: false,
      reads_file_bytes: false,
      reads_secret_values: false,
      sends_network_requests: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      clears_local_cache: false,
      mutates_local_cache_records: false,
      enables_sync: false,
      enables_ai: false,
      exports_raw_workspace_ids: false,
      includes_raw_workspace_content: false,
      includes_only_counts_booleans_hashes_timestamps_and_gates: true,
      includes_only_counts_booleans_hashes_timestamps_gates_and_steps: true,
      includes_page_sync_outcome_counts_status_source_and_timestamps: true,
      includes_database_sync_outcome_counts_status_source_and_timestamps: true,
      includes_file_sync_outcome_counts_status_source_and_timestamps: true,
    },
    summary: {
      handoff_mode: handoffMode,
      ready_for_cross_device_handoff: status === "ready",
      safe_to_open_other_device: status === "ready",
      ready_for_cloud_cache_read: cloudMasterReady,
      account_bridge_ready: accountBridgeReady,
      account_bridge_sync_domains_ready: accountBridgeSyncDomainsReady,
      cloud_master_ready: cloudMasterReady,
      cloud_workspace_linked: cloudWorkspaceLinked,
      page_sync_enabled: pageSyncEnabled,
      page_last_sync_outcome_status: pageLastOutcome?.status ?? null,
      page_last_sync_outcome_source: pageLastOutcome?.source ?? null,
      page_last_sync_outcome_at: pageLastOutcome?.at ?? null,
      page_last_sync_outcome_pushed: pageLastOutcome?.pushed ?? 0,
      page_last_sync_outcome_pulled: pageLastOutcome?.pulled ?? 0,
      page_last_sync_outcome_accepted: pageLastOutcome?.accepted ?? 0,
      page_last_sync_outcome_skipped_remote_newer:
        pageLastOutcome?.skippedRemoteNewer ?? 0,
      page_last_sync_outcome_pending_after: pageLastOutcome?.pendingAfter ?? 0,
      database_sync_enabled: databaseSyncEnabled,
      database_last_sync_outcome_status: databaseLastOutcome?.status ?? null,
      database_last_sync_outcome_source: databaseLastOutcome?.source ?? null,
      database_last_sync_outcome_at: databaseLastOutcome?.at ?? null,
      database_last_sync_outcome_pushed: databaseLastOutcome?.pushed ?? 0,
      database_last_sync_outcome_pulled: databaseLastOutcome?.pulled ?? 0,
      database_last_sync_outcome_accepted: databaseLastOutcome?.accepted ?? 0,
      database_last_sync_outcome_skipped: databaseLastOutcome?.skipped ?? 0,
      database_last_sync_outcome_pending_after:
        databaseLastOutcome?.pendingAfter ?? 0,
      file_sync_enabled: fileSyncEnabled,
      file_last_sync_outcome_status: fileLastOutcome?.status ?? null,
      file_last_sync_outcome_source: fileLastOutcome?.source ?? null,
      file_last_sync_outcome_at: fileLastOutcome?.at ?? null,
      file_last_sync_outcome_attempted: fileLastOutcome?.attempted ?? 0,
      file_last_sync_outcome_synced: fileLastOutcome?.synced ?? 0,
      file_last_sync_outcome_failed: fileLastOutcome?.failed ?? 0,
      file_last_sync_outcome_manual_review:
        fileLastOutcome?.manualReview ?? 0,
      file_last_sync_outcome_missing_local_files:
        fileLastOutcome?.missingLocalFiles ?? 0,
      file_last_sync_outcome_auth_deferred:
        fileLastOutcome?.authDeferred ?? 0,
      file_last_sync_outcome_pending_after:
        fileLastOutcome?.pendingAfter ?? 0,
      workspace_fingerprint: workspaceFingerprint,
      device_fingerprint: deviceFingerprint,
      cloud_workspace_fingerprint: cloudWorkspaceFingerprint,
      page_pending_rows: pagePendingRows,
      page_in_memory_queued_rows: input.pageStatus.queued,
      page_sync_log_pending_rows: pageSyncLogPendingRows,
      database_pending_rows: input.databaseStatus.pending,
      database_in_memory_queued_rows: input.databaseStatus.queued,
      database_sync_log_pending_rows: databaseSyncLogPendingRows,
      file_pending_rows: filePendingRows,
      deduplicated_pending_rows: deduplicatedPendingRows,
      total_sync_log_pending_rows: input.totalSyncPending,
      total_sync_log_covered_pending_rows: syncLogCoveredPendingRows,
      total_sync_log_unclassified_pending_rows: syncLogUnclassifiedPendingRows,
      failed_rows: failedRows,
      manual_review_rows: manualReviewRows,
      oldest_pending_queued_at: oldestPendingQueuedAt,
      oldest_pending_age_ms: oldestPendingAgeMs,
      oldest_pending_age_label: oldestPendingAgeLabel,
      blockers,
      warnings,
      receipt_hash: receiptHash,
    },
    gates,
    next_action_steps: nextActionSteps,
    owner_actions: buildOwnerActions(status, handoffMode),
    next_action: getNextAction(status, handoffMode),
  };
}

function buildGates(input: {
  cloudWorkspaceLinked: boolean;
  accountBridgeReady: boolean;
  accountBridgeSyncDomainsReady: boolean;
  pageSyncEnabled: boolean;
  databaseSyncEnabled: boolean;
  fileSyncEnabled: boolean;
  pagePendingRows: number;
  databasePendingRows: number;
  filePendingRows: number;
  totalSyncPending: number;
  syncLogCoveredPendingRows: number;
  syncLogUnclassifiedPendingRows: number;
  deduplicatedPendingRows: number;
  failedRows: number;
  manualReviewRows: number;
  oldestPendingQueuedAt: string | null;
  oldestPendingAgeLabel: string;
  hasPending: boolean;
  hasStalePending: boolean;
  hasCriticalPending: boolean;
}): SyncHandoffReadinessGate[] {
  return [
    {
      id: "cloud-workspace-linked",
      title: "云工作区已连接",
      status: input.cloudWorkspaceLinked ? "pass" : "warn",
      evidence: input.cloudWorkspaceLinked
        ? "本地 workspace 已有 linked-alpha 云工作区元数据。"
        : input.accountBridgeReady
          ? "未连接完整云工作区，但账号级同步桥接已就绪；可以短期跨设备接力，不能据此重建本地缓存。"
          : "本地 workspace 仍未连接完整云工作区；账号级同步仍可作为当前阶段的接力桥，但不能据此重建本地缓存。",
      next_action: input.cloudWorkspaceLinked
        ? "继续检查同步域和 pending 队列。"
        : input.accountBridgeReady
          ? "可以用同一 ZhiNotes 账号接力；后续仍需连接云工作区才能进入完整云主库和缓存重建。"
          : "先处理下面的同步域和 pending 队列；完整云主库上线前不要重建本地缓存。",
    },
    {
      id: "account-bridge-ready",
      title: "账号级同步桥接可接力",
      status: input.accountBridgeReady ? "pass" : "warn",
      evidence: input.accountBridgeReady
        ? "页面、数据库、文件和全域 sync_log 队列已清空，账号级同步桥可用于同账号跨设备接力。"
        : input.accountBridgeSyncDomainsReady
          ? "账号级同步域已开启，但仍需等待 pending、failed、manual review 清零。"
          : "账号级同步域未全部开启，不能保证同账号设备看到同一份数据。",
      next_action: input.accountBridgeReady
        ? "可以作为当前阶段的跨设备接力路径。"
        : "按下面的同步域和队列门禁逐项处理。",
    },
    {
      id: "page-sync-enabled",
      title: "页面同步已启用",
      status: input.pageSyncEnabled ? "pass" : "block",
      evidence: `页面同步：${input.pageSyncEnabled ? "开启" : "关闭"}。`,
      next_action: input.pageSyncEnabled
        ? "继续检查页面 pending 队列。"
        : "先到账号页开启页面同步；否则本机新写页面不会上传到云端。",
    },
    {
      id: "database-sync-enabled",
      title: "数据库同步已启用",
      status: input.databaseSyncEnabled ? "pass" : "block",
      evidence: `数据库同步：${input.databaseSyncEnabled ? "开启" : "关闭"}。`,
      next_action: input.databaseSyncEnabled
        ? "继续检查数据库 pending 队列。"
        : "先到账号页开启数据库同步；否则本机数据库修改不会上传到云端。",
    },
    {
      id: "file-embed-sync-enabled",
      title: "文件嵌入队列可见",
      status: input.fileSyncEnabled ? "pass" : "block",
      evidence: `文件嵌入队列：${input.fileSyncEnabled ? "可见" : "不可用"}。`,
      next_action: input.fileSyncEnabled
        ? "继续检查文件 pending 队列。"
        : "先恢复文件嵌入队列状态；否则文件和报告不会可靠出现在其他设备。",
    },
    {
      id: "page-pending-drained",
      title: "页面待上传队列无阻断",
      status: input.pagePendingRows > 0 ? "block" : "pass",
      evidence: `页面 pending + 内存批次 + sync_log ${input.pagePendingRows} 条。`,
      next_action:
        input.pagePendingRows > 0
          ? "先补传页面待上传队列；未上传页面不能在其他设备可靠出现。"
          : "页面待上传队列为空。",
    },
    {
      id: "database-pending-drained",
      title: "数据库待上传队列无阻断",
      status: input.databasePendingRows > 0 ? "block" : "pass",
      evidence: `数据库 pending + 内存批次 + sync_log ${input.databasePendingRows} 条。`,
      next_action:
        input.databasePendingRows > 0
          ? "先补传数据库待上传队列；未上传数据库修改不能在其他设备可靠出现。"
          : "数据库待上传队列为空。",
    },
    {
      id: "file-pending-drained",
      title: "文件 pending 队列无待上传",
      status: input.filePendingRows > 0 ? "block" : "pass",
      evidence: `文件 pending ${input.filePendingRows} 条。`,
      next_action:
        input.filePendingRows > 0
          ? "先补传文件队列；未上传文件或报告不能在其他设备可靠出现。"
          : "文件待上传队列为空。",
    },
    {
      id: "full-domain-sync-log-drained",
      title: "全域 sync_log 无额外待上传",
      status: input.syncLogUnclassifiedPendingRows > 0 ? "block" : "pass",
      evidence: `全域 sync_log 原始 pending ${input.totalSyncPending} 条，其中 ${input.syncLogCoveredPendingRows} 条已归入页面/数据库队列，额外未归类 ${input.syncLogUnclassifiedPendingRows} 条。`,
      next_action:
        input.syncLogUnclassifiedPendingRows > 0
          ? "先让未归类的 pending sync_log 行上传或进入人工处理；已归入页面/数据库的行按对应业务队列处理。"
          : "全域 sync_log 没有额外未归类待上传行。",
    },
    {
      id: "no-failed-uploads",
      title: "没有失败回执",
      status: input.failedRows > 0 ? "block" : "pass",
      evidence: `失败回执 ${input.failedRows} 条。`,
      next_action:
        input.failedRows > 0
          ? "先用同步中心补传；如果失败重复，导出处理包排查。"
          : "没有失败回执。",
    },
    {
      id: "no-manual-review",
      title: "没有人工处理项",
      status: input.manualReviewRows > 0 ? "block" : "pass",
      evidence: `人工处理项 ${input.manualReviewRows} 条。`,
      next_action:
        input.manualReviewRows > 0
          ? "先处理反复失败的元数据样本，再考虑换设备或重建缓存。"
          : "没有人工处理项。",
    },
    {
      id: "no-stale-pending",
      title: "没有长时间滞留队列",
      status: input.hasStalePending ? "block" : "pass",
      evidence: input.hasPending
        ? `最早 pending ${input.oldestPendingAgeLabel}；排队时间 ${input.oldestPendingQueuedAt ?? "未知"}。`
        : "没有 pending 队列。",
      next_action: input.hasCriticalPending
        ? "有 pending 超过 6 小时，先人工排查，不要换设备接力。"
        : input.hasStalePending
          ? "有 pending 超过 30 分钟，先补传或导出处理包排查。"
          : "没有滞留队列。",
    },
    {
      id: "metadata-only-boundary",
      title: "接力检查只包含 metadata",
      status: "pass",
      evidence: "收据只包含 counts、flags、hash、timestamps 和 gates。",
      next_action:
        "接力收据只能证明当前本机是否适合换设备；不会上传、下载或修复数据。",
    },
  ];
}

function getHandoffStatus(input: {
  cloudWorkspaceLinked: boolean;
  accountBridgeReady: boolean;
  pageSyncEnabled: boolean;
  databaseSyncEnabled: boolean;
  fileSyncEnabled: boolean;
  hasPending: boolean;
  hasStalePending: boolean;
  failedRows: number;
  manualReviewRows: number;
}): SyncHandoffReadinessStatus {
  if (!input.pageSyncEnabled || !input.databaseSyncEnabled || !input.fileSyncEnabled) {
    return "blocked-sync-disabled";
  }
  if (input.manualReviewRows > 0) return "blocked-manual-review";
  if (input.failedRows > 0) return "blocked-failed";
  if (input.hasStalePending) return "blocked-stale-pending";
  if (input.hasPending) return "blocked-pending";
  if (input.accountBridgeReady) return "ready";
  if (!input.cloudWorkspaceLinked) return "blocked-local-only";
  return "ready";
}

function getNextAction(
  status: SyncHandoffReadinessStatus,
  handoffMode: SyncHandoffMode
): string {
  switch (status) {
    case "ready":
      if (handoffMode === "account-bridge") {
        return "账号级接力 ready：可以用同一 ZhiNotes 账号在另一台设备继续；这不是完整云主库，重建本地缓存仍需先连接云工作区。";
      }
      return "接力 ready：本机没有待上传、失败或人工处理队列，可以在其他设备读取云端并按热缓存策略复制常用内容。";
    case "blocked-local-only":
      return "先登录并连接云工作区；local-only 状态下没有云端接力目标。";
    case "blocked-sync-disabled":
      return "先到账号页开启页面、数据库和文件队列同步，再重新生成接力收据。";
    case "blocked-manual-review":
      return "先导出处理包并解决反复失败项；不要在问题未确认前换设备接力。";
    case "blocked-failed":
      return "先补传失败队列；如果继续失败，导出处理包排查。";
    case "blocked-stale-pending":
      return "先处理长时间 pending 队列；滞留队列说明本地输入还没有可靠上云。";
    case "blocked-pending":
      return "先补传或等待 pending 队列清空；未上传输入不会可靠出现在另一台设备。";
  }
}

function buildOwnerActions(
  status: SyncHandoffReadinessStatus,
  handoffMode: SyncHandoffMode
) {
  if (status === "ready") {
    if (handoffMode === "account-bridge") {
      return [
        "Use the same ZhiNotes account on the other device for account-level handoff.",
        "Do not rebuild local cache from cloud until a full cloud workspace is linked.",
      ];
    }
    return [
      "Other devices may read from cloud and warm only selected hot-cache content.",
      "Keep local-first editing active; new input should still write locally first, then enqueue cloud sync.",
    ];
  }
  if (status === "blocked-local-only") {
    return ["Connect this workspace to a cloud workspace before handoff."];
  }
  if (status === "blocked-sync-disabled") {
    return [
      "Enable page, database, and file queue sync from the Account page after owner confirmation.",
    ];
  }
  if (status === "blocked-manual-review") {
    return ["Export the manual review packet and inspect repeated failure samples before handoff."];
  }
  if (status === "blocked-failed") {
    return ["Run one manual retry from the Sync UI; if it repeats, export the manual review packet."];
  }
  return [
    "Let pending queues drain or trigger manual retry.",
    "Do not rebuild local cache or switch primary device until this receipt is ready.",
  ];
}

function buildNextActionSteps(
  gates: SyncHandoffReadinessGate[]
): SyncHandoffReadinessNextStep[] {
  const actionableGates = gates.filter(
    (gate) => gate.id !== "metadata-only-boundary"
  );
  const firstBlockingGateIndex = actionableGates.findIndex(
    (gate) => gate.status === "block"
  );
  const firstWarningGateIndex = actionableGates.findIndex(
    (gate) => gate.status === "warn"
  );
  const currentGateIndex =
    firstBlockingGateIndex >= 0 ? firstBlockingGateIndex : firstWarningGateIndex;

  return actionableGates.map((gate, index) => {
    const status: SyncHandoffReadinessNextStepStatus =
      gate.status === "pass"
        ? "done"
        : index === currentGateIndex
          ? "current"
          : "later";
    return {
      id: `handoff-step-${gate.id}`,
      gate_id: gate.id,
      label: gate.title,
      status,
      action:
        status === "done"
          ? "已完成，继续检查下一项。"
          : gate.next_action,
    };
  });
}

function getOldestTimestamp(values: Array<string | null>) {
  return values.reduce<string | null>((oldest, value) => {
    if (!value) return oldest;
    if (!oldest) return value;
    const valueTime = Date.parse(value);
    const oldestTime = Date.parse(oldest);
    if (Number.isNaN(valueTime)) return oldest;
    if (Number.isNaN(oldestTime)) return value;
    return valueTime < oldestTime ? value : oldest;
  }, null);
}

function getAgeMs(value: string | null, nowIso: string) {
  if (!value) return null;
  const queuedAt = Date.parse(value);
  const now = Date.parse(nowIso);
  if (Number.isNaN(queuedAt) || Number.isNaN(now)) return null;
  return Math.max(0, now - queuedAt);
}

function formatAge(ageMs: number | null) {
  if (ageMs === null) return "暂无排队时间";
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (ageMs < minute) return "小于 1 分钟";
  if (ageMs < hour) return `${Math.floor(ageMs / minute)} 分钟`;
  if (ageMs < day) return `${(ageMs / hour).toFixed(1)} 小时`;
  return `${(ageMs / day).toFixed(1)} 天`;
}

function stableHash(value: unknown) {
  const source = stableStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
