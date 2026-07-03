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

export interface SyncHandoffReadinessGate {
  id: string;
  title: string;
  status: SyncHandoffReadinessGateStatus;
  evidence: string;
  next_action: string;
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
  };
  summary: {
    ready_for_cross_device_handoff: boolean;
    safe_to_open_other_device: boolean;
    ready_for_cloud_cache_read: boolean;
    cloud_workspace_linked: boolean;
    page_sync_enabled: boolean;
    database_sync_enabled: boolean;
    file_sync_enabled: boolean;
    workspace_fingerprint: string | null;
    device_fingerprint: string | null;
    cloud_workspace_fingerprint: string | null;
    page_pending_rows: number;
    page_in_memory_queued_rows: number;
    database_pending_rows: number;
    database_in_memory_queued_rows: number;
    database_sync_log_pending_rows: number;
    file_pending_rows: number;
    total_sync_log_pending_rows: number;
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
  owner_actions: string[];
  next_action: string;
}

export function buildSyncHandoffReadinessReceipt(
  input: SyncHandoffReadinessReceiptInput
): SyncHandoffReadinessReceipt {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const pagePendingRows = input.pageStatus.pending + input.pageStatus.queued;
  const databasePendingRows =
    input.databaseStatus.pending +
    input.databaseStatus.queued +
    input.databaseStatus.syncLogPending;
  const filePendingRows = input.fileStatus.pending;
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
  const hasPending =
    pagePendingRows > 0 ||
    databasePendingRows > 0 ||
    filePendingRows > 0 ||
    input.totalSyncPending > 0;
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
  const status = getHandoffStatus({
    cloudWorkspaceLinked,
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
    pageSyncEnabled,
    databaseSyncEnabled,
    fileSyncEnabled,
    pagePendingRows,
    databasePendingRows,
    filePendingRows,
    totalSyncPending: input.totalSyncPending,
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
  const receiptHash = stableHash({
    generated_at: generatedAt,
    status,
    workspace_fingerprint: workspaceFingerprint,
    device_fingerprint: deviceFingerprint,
    cloud_workspace_fingerprint: cloudWorkspaceFingerprint,
    page_pending_rows: pagePendingRows,
    database_pending_rows: databasePendingRows,
    file_pending_rows: filePendingRows,
    total_sync_log_pending_rows: input.totalSyncPending,
    failed_rows: failedRows,
    manual_review_rows: manualReviewRows,
    oldest_pending_queued_at: oldestPendingQueuedAt,
    gates: gates.map((gate) => ({ id: gate.id, status: gate.status })),
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
      "Generated locally to decide whether this browser can safely hand work to another device. It records only counts, sync flags, hashed workspace/device fingerprints, queue timestamps, and gate statuses. It does not read or export page ids, database keys, page bodies, Yjs payloads, database values, comments, file names, file bytes, failure messages, secrets, tokens, credentials, raw workspace ids, or raw cache dumps; it does not send network requests, upload workspace data, clear local cache, mutate local cache records, or enable sync/AI.",
    boundary: {
      local_receipt_only: true,
      reads_queue_counts: true,
      reads_sync_enabled_flags: true,
      reads_workspace_link_metadata: true,
      reads_failure_counts: true,
      reads_queue_timestamps: true,
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
    },
    summary: {
      ready_for_cross_device_handoff: status === "ready",
      safe_to_open_other_device: status === "ready",
      ready_for_cloud_cache_read: status === "ready",
      cloud_workspace_linked: cloudWorkspaceLinked,
      page_sync_enabled: pageSyncEnabled,
      database_sync_enabled: databaseSyncEnabled,
      file_sync_enabled: fileSyncEnabled,
      workspace_fingerprint: workspaceFingerprint,
      device_fingerprint: deviceFingerprint,
      cloud_workspace_fingerprint: cloudWorkspaceFingerprint,
      page_pending_rows: pagePendingRows,
      page_in_memory_queued_rows: input.pageStatus.queued,
      database_pending_rows: input.databaseStatus.pending,
      database_in_memory_queued_rows: input.databaseStatus.queued,
      database_sync_log_pending_rows: input.databaseStatus.syncLogPending,
      file_pending_rows: filePendingRows,
      total_sync_log_pending_rows: input.totalSyncPending,
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
    owner_actions: buildOwnerActions(status),
    next_action: getNextAction(status),
  };
}

function buildGates(input: {
  cloudWorkspaceLinked: boolean;
  pageSyncEnabled: boolean;
  databaseSyncEnabled: boolean;
  fileSyncEnabled: boolean;
  pagePendingRows: number;
  databasePendingRows: number;
  filePendingRows: number;
  totalSyncPending: number;
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
      status: input.cloudWorkspaceLinked ? "pass" : "block",
      evidence: input.cloudWorkspaceLinked
        ? "本地 workspace 已有 linked-alpha 云工作区元数据。"
        : "本地 workspace 仍是 local-only，没有云端主库接力目标。",
      next_action: input.cloudWorkspaceLinked
        ? "继续检查同步域和 pending 队列。"
        : "先登录并连接云工作区，再生成新的接力收据。",
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
      title: "页面 pending 队列已清空",
      status: input.pagePendingRows > 0 ? "block" : "pass",
      evidence: `页面 pending + 内存批次 ${input.pagePendingRows} 条。`,
      next_action:
        input.pagePendingRows > 0
          ? "先补传页面队列；未上传页面不能在其他设备可靠出现。"
          : "页面待上传队列为空。",
    },
    {
      id: "database-pending-drained",
      title: "数据库 pending 队列已清空",
      status: input.databasePendingRows > 0 ? "block" : "pass",
      evidence: `数据库 pending + 内存批次 + sync_log ${input.databasePendingRows} 条。`,
      next_action:
        input.databasePendingRows > 0
          ? "先补传数据库队列；未上传数据库修改不能在其他设备可靠出现。"
          : "数据库待上传队列为空。",
    },
    {
      id: "file-pending-drained",
      title: "文件 pending 队列已清空",
      status: input.filePendingRows > 0 ? "block" : "pass",
      evidence: `文件 pending ${input.filePendingRows} 条。`,
      next_action:
        input.filePendingRows > 0
          ? "先补传文件队列；未上传文件或报告不能在其他设备可靠出现。"
          : "文件待上传队列为空。",
    },
    {
      id: "full-domain-sync-log-drained",
      title: "全域 sync_log 已清空",
      status: input.totalSyncPending > 0 ? "block" : "pass",
      evidence: `全域 sync_log pending ${input.totalSyncPending} 条。`,
      next_action:
        input.totalSyncPending > 0
          ? "先让所有 pending sync_log 行上传或进入人工处理。"
          : "全域 sync_log 没有待上传行。",
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
  pageSyncEnabled: boolean;
  databaseSyncEnabled: boolean;
  fileSyncEnabled: boolean;
  hasPending: boolean;
  hasStalePending: boolean;
  failedRows: number;
  manualReviewRows: number;
}): SyncHandoffReadinessStatus {
  if (!input.cloudWorkspaceLinked) return "blocked-local-only";
  if (!input.pageSyncEnabled || !input.databaseSyncEnabled || !input.fileSyncEnabled) {
    return "blocked-sync-disabled";
  }
  if (input.manualReviewRows > 0) return "blocked-manual-review";
  if (input.failedRows > 0) return "blocked-failed";
  if (input.hasStalePending) return "blocked-stale-pending";
  if (input.hasPending) return "blocked-pending";
  return "ready";
}

function getNextAction(status: SyncHandoffReadinessStatus): string {
  switch (status) {
    case "ready":
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

function buildOwnerActions(status: SyncHandoffReadinessStatus) {
  if (status === "ready") {
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
