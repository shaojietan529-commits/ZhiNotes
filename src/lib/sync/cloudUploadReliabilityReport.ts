import type { PendingCloudDatabaseSyncStatus } from "@/lib/database/accountDatabaseSync";
import type { SyncLogSummary } from "@/lib/db/local/queries";
import type { PendingCloudPageSyncStatus } from "@/lib/pages/accountPageSync";
import type { LocalWorkspaceIdentity } from "@/lib/sync/workspaceIdentity";

export type CloudUploadReliabilityStatus =
  | "ready"
  | "watch"
  | "needs-attention"
  | "blocked";
export type CloudUploadReliabilityGateStatus = "pass" | "warn" | "block";

export interface CloudUploadReliabilityReportInput {
  pageStatus: PendingCloudPageSyncStatus;
  databaseStatus: PendingCloudDatabaseSyncStatus;
  syncSummary: SyncLogSummary | null;
  workspaceIdentity: LocalWorkspaceIdentity | null;
  generatedAt?: string;
}

export interface CloudUploadReliabilityGate {
  id: string;
  title: string;
  status: CloudUploadReliabilityGateStatus;
  evidence: string;
  owner_visible_reason: string;
  next_action: string;
}

export interface CloudUploadReliabilityReport {
  format: "zhinote-cloud-upload-reliability-report";
  format_version: 1;
  report_status: "metadata-only-local-sync-assurance";
  architecture_target: "cloud-master-local-hot-cache";
  generated_at: string;
  status: CloudUploadReliabilityStatus;
  privacy_boundary: string;
  boundary: {
    local_report_only: true;
    reads_queue_counts: true;
    reads_queue_timestamps: true;
    reads_failure_counts: true;
    reads_failure_messages: true;
    reads_workspace_link_metadata: true;
    reads_page_ids: false;
    reads_database_keys: false;
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
    mutates_local_cache_records: false;
    clears_local_cache: false;
    enables_sync: false;
    enables_ai: false;
    includes_raw_workspace_content: false;
  };
  summary: {
    cloud_workspace_linked: boolean;
    page_sync_enabled: boolean;
    database_sync_enabled: boolean;
    local_input_buffered: boolean;
    safe_to_keep_typing: boolean;
    safe_to_switch_device_now: boolean;
    page_waiting_rows: number;
    database_waiting_rows: number;
    sync_log_pending_rows: number;
    total_waiting_rows: number;
    failed_rows: number;
    manual_review_rows: number;
    oldest_pending_queued_at: string | null;
    oldest_pending_age_ms: number | null;
    oldest_pending_age_label: string;
    page_last_sync_at: string | null;
    database_last_sync_at: string | null;
    blockers: number;
    warnings: number;
  };
  gates: CloudUploadReliabilityGate[];
  next_action: string;
}

const STALE_PENDING_MS = 30 * 60 * 1000;
const CRITICAL_PENDING_MS = 6 * 60 * 60 * 1000;

export function buildCloudUploadReliabilityReport(
  input: CloudUploadReliabilityReportInput
): CloudUploadReliabilityReport {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const pageWaitingRows = input.pageStatus.pending + input.pageStatus.queued;
  const databaseWaitingRows =
    input.databaseStatus.pending +
    input.databaseStatus.queued +
    input.databaseStatus.syncLogPending;
  const syncLogPendingRows = input.syncSummary?.pending ?? 0;
  const totalWaitingRows =
    pageWaitingRows + databaseWaitingRows + syncLogPendingRows;
  const failedRows = Math.max(
    input.pageStatus.failed + input.databaseStatus.failed,
    input.syncSummary?.failed ?? 0
  );
  const manualReviewRows = Math.max(
    input.pageStatus.manualReviewCount + input.databaseStatus.manualReviewCount,
    input.syncSummary?.manualReview ?? 0
  );
  const oldestPendingQueuedAt = getOldestTimestamp([
    input.pageStatus.oldestPendingQueuedAt,
    input.databaseStatus.oldestPendingQueuedAt,
  ]);
  const oldestPendingAgeMs = getAgeMs(oldestPendingQueuedAt, generatedAt);
  const cloudWorkspaceLinked =
    input.workspaceIdentity?.cloud_status === "linked-alpha";
  const pageSyncEnabled = input.pageStatus.enabled;
  const databaseSyncEnabled = input.databaseStatus.enabled;
  const hasStalePending =
    totalWaitingRows > 0 &&
    oldestPendingAgeMs !== null &&
    oldestPendingAgeMs >= STALE_PENDING_MS;
  const hasCriticalPending =
    totalWaitingRows > 0 &&
    oldestPendingAgeMs !== null &&
    oldestPendingAgeMs >= CRITICAL_PENDING_MS;

  const gates = buildGates({
    cloudWorkspaceLinked,
    pageSyncEnabled,
    databaseSyncEnabled,
    pageWaitingRows,
    databaseWaitingRows,
    syncLogPendingRows,
    totalWaitingRows,
    failedRows,
    manualReviewRows,
    hasStalePending,
    hasCriticalPending,
    oldestPendingQueuedAt,
    oldestPendingAgeLabel: formatAge(oldestPendingAgeMs),
    pageLastFailure: input.pageStatus.lastFailureMessage,
    databaseLastFailure: input.databaseStatus.lastFailureMessage,
  });
  const blockers = gates.filter((gate) => gate.status === "block").length;
  const warnings = gates.filter((gate) => gate.status === "warn").length;
  const status = getStatus({ blockers, warnings, totalWaitingRows });

  return {
    format: "zhinote-cloud-upload-reliability-report",
    format_version: 1,
    report_status: "metadata-only-local-sync-assurance",
    architecture_target: "cloud-master-local-hot-cache",
    generated_at: generatedAt,
    status,
    privacy_boundary:
      "Generated locally from sync queue metadata. It reads only sync flags, queue counts, timestamps, failure counts, recent failure messages, and workspace link metadata. It does not read or export page ids, database keys, page bodies, Yjs payloads, database row values, comments, file names, file bytes, secrets, tokens, cookies, or raw workspace content; it does not send network requests, upload workspace data, write server data, clear local cache, or enable sync/AI.",
    boundary: {
      local_report_only: true,
      reads_queue_counts: true,
      reads_queue_timestamps: true,
      reads_failure_counts: true,
      reads_failure_messages: true,
      reads_workspace_link_metadata: true,
      reads_page_ids: false,
      reads_database_keys: false,
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
      mutates_local_cache_records: false,
      clears_local_cache: false,
      enables_sync: false,
      enables_ai: false,
      includes_raw_workspace_content: false,
    },
    summary: {
      cloud_workspace_linked: cloudWorkspaceLinked,
      page_sync_enabled: pageSyncEnabled,
      database_sync_enabled: databaseSyncEnabled,
      local_input_buffered: true,
      safe_to_keep_typing: pageSyncEnabled || databaseSyncEnabled,
      safe_to_switch_device_now:
        blockers === 0 && totalWaitingRows === 0 && failedRows === 0,
      page_waiting_rows: pageWaitingRows,
      database_waiting_rows: databaseWaitingRows,
      sync_log_pending_rows: syncLogPendingRows,
      total_waiting_rows: totalWaitingRows,
      failed_rows: failedRows,
      manual_review_rows: manualReviewRows,
      oldest_pending_queued_at: oldestPendingQueuedAt,
      oldest_pending_age_ms: oldestPendingAgeMs,
      oldest_pending_age_label: formatAge(oldestPendingAgeMs),
      page_last_sync_at: input.pageStatus.lastSyncAt,
      database_last_sync_at: input.databaseStatus.lastSyncAt,
      blockers,
      warnings,
    },
    gates,
    next_action: getNextAction(status, {
      cloudWorkspaceLinked,
      totalWaitingRows,
      failedRows,
      manualReviewRows,
      hasCriticalPending,
    }),
  };
}

function buildGates(input: {
  cloudWorkspaceLinked: boolean;
  pageSyncEnabled: boolean;
  databaseSyncEnabled: boolean;
  pageWaitingRows: number;
  databaseWaitingRows: number;
  syncLogPendingRows: number;
  totalWaitingRows: number;
  failedRows: number;
  manualReviewRows: number;
  hasStalePending: boolean;
  hasCriticalPending: boolean;
  oldestPendingQueuedAt: string | null;
  oldestPendingAgeLabel: string;
  pageLastFailure: string | null;
  databaseLastFailure: string | null;
}): CloudUploadReliabilityGate[] {
  return [
    {
      id: "cloud-workspace-linked",
      title: "云 workspace 已连接",
      status: input.cloudWorkspaceLinked ? "pass" : "block",
      evidence: input.cloudWorkspaceLinked
        ? "当前本机已绑定云 workspace。"
        : "当前本机还没有云 workspace 绑定证据。",
      owner_visible_reason: "没有云 workspace 时，本地输入只能先留在本机。",
      next_action: input.cloudWorkspaceLinked
        ? "继续观察待上传队列和最近失败。"
        : "在同步页完成登录、workspace bootstrap 和本地 workspace 绑定。",
    },
    {
      id: "page-sync-enabled",
      title: "页面输入可进入上云队列",
      status: input.pageSyncEnabled ? "pass" : "block",
      evidence: input.pageSyncEnabled
        ? `页面待上传 ${input.pageWaitingRows} 条。`
        : "页面同步关闭，笔记、每日纪要和会议页不会自动上云。",
      owner_visible_reason: "Page 是知识库底座，必须保持待上传队列可见。",
      next_action: input.pageSyncEnabled
        ? "保持输入本地优先，等待后台补传。"
        : "打开账号页开启页面同步。",
    },
    {
      id: "database-sync-enabled",
      title: "数据库输入可进入上云队列",
      status: input.databaseSyncEnabled ? "pass" : "block",
      evidence: input.databaseSyncEnabled
        ? `数据库待上传 ${input.databaseWaitingRows} 条，其中 sync_log ${input.syncLogPendingRows} 条。`
        : "数据库同步关闭，投研表格和 tracker 不会自动上云。",
      owner_visible_reason: "数据库变更需要按 key 和 sync_log 对账，不能静默丢失。",
      next_action: input.databaseSyncEnabled
        ? "保持数据库同步开启，观察失败和人工复核阈值。"
        : "打开账号页开启数据库同步。",
    },
    {
      id: "pending-queue-durable",
      title: "待上传队列保留中",
      status:
        input.totalWaitingRows === 0
          ? "pass"
          : input.hasCriticalPending
            ? "block"
            : input.hasStalePending
              ? "warn"
              : "pass",
      evidence:
        input.totalWaitingRows === 0
          ? "当前没有待上传队列。"
          : `当前 ${input.totalWaitingRows} 条等待上云，最早排队 ${input.oldestPendingAgeLabel}。`,
      owner_visible_reason:
        "待上传队列是本地级输入体验的缓冲账本，云端确认前不能清理。",
      next_action:
        input.totalWaitingRows === 0
          ? "可以放心继续使用或切换设备。"
          : input.hasCriticalPending
            ? "先手动补传；如果继续失败，导出人工复核包。"
            : "继续等待后台补传，暂时不要重建本地缓存。",
    },
    {
      id: "failure-reasons-visible",
      title: "失败原因可见",
      status:
        input.manualReviewRows > 0
          ? "block"
          : input.failedRows > 0
            ? "warn"
            : "pass",
      evidence:
        input.failedRows === 0
          ? "当前没有失败待上传记录。"
          : `失败 ${input.failedRows} 条；最近原因：${
              input.pageLastFailure ?? input.databaseLastFailure ?? "未记录"
            }。`,
      owner_visible_reason:
        "失败不能变成黑箱；超大记录、认证退避或网络错误必须留在队列里说明原因。",
      next_action:
        input.manualReviewRows > 0
          ? "导出人工复核包，优先处理重复失败记录。"
          : input.failedRows > 0
            ? "先手动补传失败队列，观察最近失败原因是否清除。"
            : "继续保持失败原因可见和 pending 队列保护。",
    },
  ];
}

function getStatus(input: {
  blockers: number;
  warnings: number;
  totalWaitingRows: number;
}): CloudUploadReliabilityStatus {
  if (input.blockers > 0) return "blocked";
  if (input.warnings > 0) return "needs-attention";
  if (input.totalWaitingRows > 0) return "watch";
  return "ready";
}

function getNextAction(
  status: CloudUploadReliabilityStatus,
  input: {
    cloudWorkspaceLinked: boolean;
    totalWaitingRows: number;
    failedRows: number;
    manualReviewRows: number;
    hasCriticalPending: boolean;
  }
) {
  if (!input.cloudWorkspaceLinked) {
    return "先完成云 workspace 绑定；本地输入仍会保留，但不能证明已进入云端主库。";
  }
  if (input.manualReviewRows > 0) {
    return "先导出人工复核包，处理重复失败的页面或数据库记录。";
  }
  if (input.failedRows > 0) {
    return "先手动补传失败队列，确认失败原因消失。";
  }
  if (input.hasCriticalPending) {
    return "待上传队列已等待过久，先补传队列，不要重建缓存或切换设备。";
  }
  if (input.totalWaitingRows > 0) {
    return "可以继续输入；等 pending 清零后再进行跨设备交接或缓存重建。";
  }
  if (status === "ready") {
    return "当前输入上云链路健康，可以继续推进云端主库和选择性本地缓存。";
  }
  return "继续观察队列状态和最近失败原因。";
}

function getOldestTimestamp(values: Array<string | null | undefined>) {
  let oldest: string | null = null;
  for (const value of values) {
    if (!value || Number.isNaN(Date.parse(value))) continue;
    if (!oldest || Date.parse(value) < Date.parse(oldest)) oldest = value;
  }
  return oldest;
}

function getAgeMs(timestamp: string | null, nowIso: string): number | null {
  if (!timestamp) return null;
  const timestampMs = Date.parse(timestamp);
  const nowMs = Date.parse(nowIso);
  if (Number.isNaN(timestampMs) || Number.isNaN(nowMs)) return null;
  return Math.max(0, nowMs - timestampMs);
}

function formatAge(ageMs: number | null) {
  if (ageMs === null) return "无";
  const minutes = Math.floor(ageMs / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} 小时`;
  return `${Math.floor(hours / 24)} 天`;
}
