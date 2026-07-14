import type { PendingCloudDatabaseSyncStatus } from "@/lib/database/accountDatabaseSync";
import type { PendingFileEmbedSyncStatus } from "@/lib/files/fileEmbedSyncQueue";
import type { PendingCloudPageSyncStatus } from "@/lib/pages/accountPageSync";
import type { CloudMasterReconcileReport } from "@/lib/sync/cloudMasterReconcile";
import type { CoreManifestCompareReceipt } from "@/lib/sync/coreManifestCompareReceipt";
import type { LocalMetadataManifestReport } from "@/lib/sync/localMetadataManifest";

export type CacheRebuildPreflightStatus =
  | "ready"
  | "needs-manifest-check"
  | "blocked-cloud-workspace"
  | "blocked-disabled"
  | "blocked-pending"
  | "blocked-sync-review"
  | "blocked-manifest-mismatch";

export type CacheRebuildPreflightGateStatus = "pass" | "warn" | "block";

export interface CacheRebuildPreflightReceiptInput {
  pageStatus: PendingCloudPageSyncStatus;
  databaseStatus: PendingCloudDatabaseSyncStatus;
  fileStatus: PendingFileEmbedSyncStatus;
  totalSyncPending: number;
  totalSyncFailed?: number;
  totalSyncManualReview?: number;
  cloudMasterReconcile: CloudMasterReconcileReport;
  localMetadataManifest: LocalMetadataManifestReport;
  coreManifestReceipt: CoreManifestCompareReceipt | null;
  generatedAt?: string;
}

export interface CacheRebuildPreflightGate {
  id: string;
  title: string;
  status: CacheRebuildPreflightGateStatus;
  evidence: string;
  next_action: string;
}

export interface CacheRebuildPreflightReceipt {
  format: "zhinote-cache-rebuild-preflight-receipt";
  format_version: 1;
  receipt_status: "metadata-only-dry-run";
  architecture_target: "cloud-master-local-hot-cache";
  receipt_id: string;
  generated_at: string;
  status: CacheRebuildPreflightStatus;
  privacy_boundary: string;
  boundary: {
    reads_page_body_text: false;
    reads_page_yjs: false;
    reads_database_row_values: false;
    reads_comment_bodies: false;
    reads_file_bytes: false;
    reads_file_text: false;
    reads_secret_values: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    clears_local_cache: false;
    mutates_local_cache_records: false;
    exports_raw_workspace_ids: false;
    includes_raw_workspace_content: false;
    includes_only_counts_watermarks_hashes_and_gates: true;
  };
  summary: {
    cloud_workspace_linked: boolean;
    page_sync_enabled: boolean;
    database_sync_enabled: boolean;
    file_sync_enabled: boolean;
    page_pending_rows: number;
    page_in_memory_queued_rows: number;
    database_pending_rows: number;
    database_in_memory_queued_rows: number;
    database_sync_log_pending_rows: number;
    file_pending_rows: number;
    file_failed_rows: number;
    file_manual_review_rows: number;
    total_sync_log_pending_rows: number;
    total_sync_log_failed_rows: number;
    total_sync_log_manual_review_rows: number;
    blockers: number;
    warnings: number;
    local_manifest_hash: string;
    core_manifest_receipt_id: string | null;
    core_manifest_status: CoreManifestCompareReceipt["status"] | "not-run";
    receipt_hash: string;
  };
  gates: CacheRebuildPreflightGate[];
  confirmation_policy: {
    requires_account_page_confirmation: true;
    sync_page_must_not_directly_rebuild_cache: true;
    ready_preflight_required_before_rebuild: true;
    cloud_manifest_is_source_of_truth: true;
    local_pending_edits_block_rebuild: true;
    local_failed_or_manual_review_blocks_rebuild: true;
  };
  next_action: string;
}

export function buildCacheRebuildPreflightReceipt(
  input: CacheRebuildPreflightReceiptInput
): CacheRebuildPreflightReceipt {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const pagePendingRows =
    input.pageStatus.pending +
    input.pageStatus.queued +
    (input.pageStatus.syncLogPending ?? 0);
  const databasePendingRows =
    input.databaseStatus.pending +
    input.databaseStatus.queued +
    (input.databaseStatus.syncLogPending ?? 0);
  const filePendingRows = input.fileStatus.pending;
  const hasPending =
    pagePendingRows > 0 ||
    databasePendingRows > 0 ||
    filePendingRows > 0 ||
    input.totalSyncPending > 0;
  const failedRows = Math.max(
    input.pageStatus.failed +
      input.databaseStatus.failed +
      input.fileStatus.failed,
    input.totalSyncFailed ?? 0
  );
  const manualReviewRows = Math.max(
    input.pageStatus.manualReviewCount +
      input.databaseStatus.manualReviewCount +
      input.fileStatus.manualReviewCount,
    input.totalSyncManualReview ?? 0
  );
  const hasSyncReview = failedRows > 0 || manualReviewRows > 0;
  const cloudWorkspaceLinked =
    input.cloudMasterReconcile.summary.cloud_workspace_linked;
  const coreManifestStatus = input.coreManifestReceipt?.status ?? "not-run";

  const gates: CacheRebuildPreflightGate[] = [
    {
      id: "cloud-workspace-linked",
      title: "云工作区已连接",
      status: cloudWorkspaceLinked ? "pass" : "block",
      evidence: cloudWorkspaceLinked
        ? "cloud master reconcile 已确认本机连接到云工作区。"
        : "当前没有云工作区连接证据，本机缓存不能安全按云端主库重建。",
      next_action: cloudWorkspaceLinked
        ? "保持云工作区连接，继续检查 manifest 和 pending 队列。"
        : "先登录并连接云工作区，再重新生成预检收据。",
    },
    {
      id: "sync-enabled",
      title: "页面、数据库和文件同步已启用",
      status:
        input.pageStatus.enabled &&
        input.databaseStatus.enabled &&
        input.fileStatus.enabled
          ? "pass"
          : "block",
      evidence: `页面同步：${input.pageStatus.enabled ? "开启" : "关闭"}；数据库同步：${input.databaseStatus.enabled ? "开启" : "关闭"}；文件同步：${input.fileStatus.enabled ? "开启" : "关闭"}。`,
      next_action:
        input.pageStatus.enabled &&
        input.databaseStatus.enabled &&
        input.fileStatus.enabled
          ? "继续检查待上传队列。"
          : "先在账号页开启页面/数据库/文件同步，并确认隐私边界。",
    },
    {
      id: "pending-queues-empty",
      title: "本地待上传队列已清空",
      status: hasPending ? "block" : "pass",
      evidence: `页面 pending ${pagePendingRows} 条；数据库 pending ${databasePendingRows} 条；文件 pending ${filePendingRows} 条；全局 sync_log pending ${input.totalSyncPending} 条。`,
      next_action: hasPending
        ? "先补传或明确处理待上传变更；pending 未清空前不要清理本地缓存。"
        : "待上传队列为空，可以继续检查 manifest 对账结果。",
    },
    {
      id: "sync-review-clear",
      title: "失败和人工处理队列已清空",
      status: hasSyncReview ? "block" : "pass",
      evidence: `失败 ${failedRows} 条；人工处理 ${manualReviewRows} 条；文件 failed ${input.fileStatus.failed} 条，manual review ${input.fileStatus.manualReviewCount} 条；全局 sync_log failed ${input.totalSyncFailed ?? 0} 条，manual review ${input.totalSyncManualReview ?? 0} 条。`,
      next_action: hasSyncReview
        ? "先补传失败队列或导出处理包；失败/人工处理未清空前不要重建本地缓存。"
        : "没有失败或人工处理队列，可以继续检查 manifest 对账结果。",
    },
    {
      id: "core-manifest-compared",
      title: "核心域云端 manifest 已对账",
      status: input.coreManifestReceipt
        ? input.coreManifestReceipt.status === "matched"
          ? "pass"
          : "block"
        : "warn",
      evidence: input.coreManifestReceipt
        ? `核心 manifest 收据 ${input.coreManifestReceipt.receipt_id}，状态 ${input.coreManifestReceipt.status}。`
        : "还没有本次核心 manifest 对账收据。",
      next_action: input.coreManifestReceipt
        ? input.coreManifestReceipt.status === "matched"
          ? "保留对账收据，进入账号页二次确认。"
          : "先处理 manifest mismatch、blocked 或 needs-sync 后再重建。"
        : "先运行同步页的“只读检查核心域”，再导出/更新预检收据。",
    },
    {
      id: "metadata-boundary",
      title: "预检只包含 metadata",
      status: "pass",
      evidence: `本地 manifest hash ${input.localMetadataManifest.summary.manifest_hash}；不包含正文、数据库值、评论正文或文件字节。`,
      next_action:
        "这张收据只作为安全证明；真实重建仍必须在账号页确认弹窗中执行。",
    },
  ];

  const blockers = gates.filter((gate) => gate.status === "block").length;
  const warnings = gates.filter((gate) => gate.status === "warn").length;
  const status = getPreflightStatus({
    cloudWorkspaceLinked,
    pageSyncEnabled: input.pageStatus.enabled,
    databaseSyncEnabled: input.databaseStatus.enabled,
    fileSyncEnabled: input.fileStatus.enabled,
    hasPending,
    hasSyncReview,
    coreManifestReceipt: input.coreManifestReceipt,
  });
  const hashInput = {
    generated_at: generatedAt,
    status,
    cloud_workspace_linked: cloudWorkspaceLinked,
    page_sync_enabled: input.pageStatus.enabled,
    database_sync_enabled: input.databaseStatus.enabled,
    file_sync_enabled: input.fileStatus.enabled,
    page_pending_rows: pagePendingRows,
    database_pending_rows: databasePendingRows,
    file_pending_rows: filePendingRows,
    file_failed_rows: input.fileStatus.failed,
    file_manual_review_rows: input.fileStatus.manualReviewCount,
    total_sync_log_pending_rows: input.totalSyncPending,
    total_sync_log_failed_rows: input.totalSyncFailed ?? 0,
    total_sync_log_manual_review_rows: input.totalSyncManualReview ?? 0,
    local_manifest_hash: input.localMetadataManifest.summary.manifest_hash,
    core_manifest_receipt_id: input.coreManifestReceipt?.receipt_id ?? null,
    core_manifest_status: coreManifestStatus,
    gates: gates.map((gate) => ({
      id: gate.id,
      status: gate.status,
    })),
  };
  const receiptHash = stableHash(hashInput);

  return {
    format: "zhinote-cache-rebuild-preflight-receipt",
    format_version: 1,
    receipt_status: "metadata-only-dry-run",
    architecture_target: "cloud-master-local-hot-cache",
    receipt_id: `cache-rebuild-preflight:${receiptHash}`,
    generated_at: generatedAt,
    status,
    privacy_boundary:
      "This dry-run receipt records only counts, booleans, hashes, gate statuses, and optional core manifest receipt id. It does not read or export page bodies, database values, comments, file bytes, file text, secrets, tokens, raw workspace ids, or raw cache dumps. It does not write server data, upload workspace data, clear local cache, or mutate local cache records.",
    boundary: {
      reads_page_body_text: false,
      reads_page_yjs: false,
      reads_database_row_values: false,
      reads_comment_bodies: false,
      reads_file_bytes: false,
      reads_file_text: false,
      reads_secret_values: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      clears_local_cache: false,
      mutates_local_cache_records: false,
      exports_raw_workspace_ids: false,
      includes_raw_workspace_content: false,
      includes_only_counts_watermarks_hashes_and_gates: true,
    },
    summary: {
      cloud_workspace_linked: cloudWorkspaceLinked,
      page_sync_enabled: input.pageStatus.enabled,
      database_sync_enabled: input.databaseStatus.enabled,
      file_sync_enabled: input.fileStatus.enabled,
      page_pending_rows: pagePendingRows,
      page_in_memory_queued_rows: input.pageStatus.queued,
      database_pending_rows: input.databaseStatus.pending,
      database_in_memory_queued_rows: input.databaseStatus.queued,
      database_sync_log_pending_rows: input.databaseStatus.syncLogPending ?? 0,
      file_pending_rows: filePendingRows,
      file_failed_rows: input.fileStatus.failed,
      file_manual_review_rows: input.fileStatus.manualReviewCount,
      total_sync_log_pending_rows: input.totalSyncPending,
      total_sync_log_failed_rows: input.totalSyncFailed ?? 0,
      total_sync_log_manual_review_rows: input.totalSyncManualReview ?? 0,
      blockers,
      warnings,
      local_manifest_hash: input.localMetadataManifest.summary.manifest_hash,
      core_manifest_receipt_id: input.coreManifestReceipt?.receipt_id ?? null,
      core_manifest_status: coreManifestStatus,
      receipt_hash: receiptHash,
    },
    gates,
    confirmation_policy: {
      requires_account_page_confirmation: true,
      sync_page_must_not_directly_rebuild_cache: true,
      ready_preflight_required_before_rebuild: true,
      cloud_manifest_is_source_of_truth: true,
      local_pending_edits_block_rebuild: true,
      local_failed_or_manual_review_blocks_rebuild: true,
    },
    next_action: getNextAction(status),
  };
}

function getPreflightStatus(input: {
  cloudWorkspaceLinked: boolean;
  pageSyncEnabled: boolean;
  databaseSyncEnabled: boolean;
  fileSyncEnabled: boolean;
  hasPending: boolean;
  hasSyncReview: boolean;
  coreManifestReceipt: CoreManifestCompareReceipt | null;
}): CacheRebuildPreflightStatus {
  if (!input.cloudWorkspaceLinked) return "blocked-cloud-workspace";
  if (
    !input.pageSyncEnabled ||
    !input.databaseSyncEnabled ||
    !input.fileSyncEnabled
  ) {
    return "blocked-disabled";
  }
  if (input.hasPending) return "blocked-pending";
  if (input.hasSyncReview) return "blocked-sync-review";
  if (!input.coreManifestReceipt) return "needs-manifest-check";
  if (input.coreManifestReceipt.status !== "matched") {
    return "blocked-manifest-mismatch";
  }
  return "ready";
}

function getNextAction(status: CacheRebuildPreflightStatus): string {
  switch (status) {
    case "ready":
      return "预检 ready：可进入账号页二次确认，再按云端 manifest 重建本机缓存。";
    case "needs-manifest-check":
      return "先在同步页运行只读核心域 manifest 对账，再重新导出预检收据。";
    case "blocked-cloud-workspace":
      return "先登录并连接云工作区；没有云主库证据时不能重建本机缓存。";
    case "blocked-disabled":
      return "先开启页面/数据库/文件同步，并确认隐私边界。";
    case "blocked-pending":
      return "先补传或处理本地 pending 变更；未上传输入不能被缓存重建隐藏。";
    case "blocked-sync-review":
      return "先处理失败回执或人工处理队列；这些异常未清空前不能重建本机缓存。";
    case "blocked-manifest-mismatch":
      return "先处理核心 manifest mismatch/blocked/needs-sync；对账不一致时不能重建。";
  }
}

function stableHash(value: unknown): string {
  const text = stableStringify(value);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
