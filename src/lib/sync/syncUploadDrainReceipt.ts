import type { PendingCloudDatabaseSyncStatus } from "@/lib/database/accountDatabaseSync";
import type { PendingFileEmbedSyncStatus } from "@/lib/files/fileEmbedSyncQueue";
import type { PendingCloudPageSyncStatus } from "@/lib/pages/accountPageSync";

export type SyncUploadDrainStatus =
  | "ready"
  | "pending"
  | "needs-attention"
  | "blocked";

export interface SyncUploadDrainResultSnapshot {
  status: string;
  pushed: number;
  pulled: number;
  skipped?: number;
  message?: string;
}

export interface SyncUploadDrainReceiptInput {
  beforePageStatus: PendingCloudPageSyncStatus;
  beforeDatabaseStatus: PendingCloudDatabaseSyncStatus;
  beforeFileStatus: PendingFileEmbedSyncStatus;
  beforeSyncLogPending: number;
  afterPageStatus: PendingCloudPageSyncStatus;
  afterDatabaseStatus: PendingCloudDatabaseSyncStatus;
  afterFileStatus: PendingFileEmbedSyncStatus;
  afterSyncLogPending: number;
  pageResult: SyncUploadDrainResultSnapshot;
  databaseResult: SyncUploadDrainResultSnapshot;
  fileResult: SyncUploadDrainResultSnapshot;
  generatedAt?: string;
}

export interface SyncUploadDrainDomainReceipt {
  domain: "pages" | "databases" | "files";
  label: string;
  enabled: boolean;
  result_status: string;
  pushed: number;
  pulled: number;
  skipped: number;
  waiting_rows_before: number;
  waiting_rows_after: number;
  failed_rows_after: number;
  manual_review_rows_after: number;
  queue_cleared: boolean;
  last_failure_message_after: string | null;
  message: string | null;
}

export interface SyncUploadDrainReceipt {
  format: "zhinote-sync-upload-drain-receipt";
  format_version: 1;
  receipt_status: "metadata-only-upload-drain-result";
  generated_at: string;
  status: SyncUploadDrainStatus;
  privacy_boundary: string;
  boundary: {
    local_receipt_only: true;
    triggered_upload_from_pending_queue: true;
    uploads_only_explicit_pending_rows: true;
    reads_queue_counts: true;
    reads_queue_timestamps: true;
    reads_failure_counts: true;
    reads_failure_messages: true;
    reads_page_body_text_for_receipt: false;
    reads_database_row_values_for_receipt: false;
    reads_comment_bodies_for_receipt: false;
    reads_file_bytes_for_receipt: false;
    exports_raw_workspace_content: false;
    clears_local_cache: false;
    rebuilds_local_cache: false;
    enables_sync: false;
    enables_ai: false;
  };
  summary: {
    attempted_domains: number;
    pushed_records: number;
    pulled_records: number;
    skipped_records: number;
    waiting_rows_before: number;
    waiting_rows_after: number;
    failed_rows_after: number;
    manual_review_rows_after: number;
    sync_log_pending_after: number;
    file_waiting_rows_after: number;
    file_failed_rows_after: number;
    file_manual_review_rows_after: number;
    queue_reduced: boolean;
    safe_to_switch_device_now: boolean;
    blockers: number;
    warnings: number;
  };
  domains: SyncUploadDrainDomainReceipt[];
  next_action: string;
}

export function buildSyncUploadDrainReceipt(
  input: SyncUploadDrainReceiptInput
): SyncUploadDrainReceipt {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const pageBefore = getPageWaitingRows(input.beforePageStatus);
  const pageAfter = getPageWaitingRows(input.afterPageStatus);
  const databaseBefore = getDatabaseWaitingRows(input.beforeDatabaseStatus);
  const databaseAfter = getDatabaseWaitingRows(input.afterDatabaseStatus);
  const fileBefore = getFileWaitingRows(input.beforeFileStatus);
  const fileAfter = getFileWaitingRows(input.afterFileStatus);
  const waitingBefore =
    pageBefore +
    databaseBefore +
    fileBefore +
    Math.max(0, input.beforeSyncLogPending);
  const waitingAfter =
    pageAfter +
    databaseAfter +
    fileAfter +
    Math.max(0, input.afterSyncLogPending);
  const failedRowsAfter =
    input.afterPageStatus.failed +
    input.afterDatabaseStatus.failed +
    input.afterFileStatus.failed;
  const manualReviewRowsAfter =
    input.afterPageStatus.manualReviewCount +
    input.afterDatabaseStatus.manualReviewCount +
    input.afterFileStatus.manualReviewCount;
  const pushedRecords =
    input.pageResult.pushed +
    input.databaseResult.pushed +
    input.fileResult.pushed;
  const pulledRecords =
    input.pageResult.pulled +
    input.databaseResult.pulled +
    input.fileResult.pulled;
  const skippedRecords =
    (input.pageResult.skipped ?? 0) +
    (input.databaseResult.skipped ?? 0) +
    (input.fileResult.skipped ?? 0);
  const domains: SyncUploadDrainDomainReceipt[] = [
    {
      domain: "pages",
      label: "页面",
      enabled: input.afterPageStatus.enabled,
      result_status: input.pageResult.status,
      pushed: input.pageResult.pushed,
      pulled: input.pageResult.pulled,
      skipped: input.pageResult.skipped ?? 0,
      waiting_rows_before: pageBefore,
      waiting_rows_after: pageAfter,
      failed_rows_after: input.afterPageStatus.failed,
      manual_review_rows_after: input.afterPageStatus.manualReviewCount,
      queue_cleared: pageAfter === 0 && input.afterPageStatus.failed === 0,
      last_failure_message_after: input.afterPageStatus.lastFailureMessage,
      message: input.pageResult.message ?? null,
    },
    {
      domain: "databases",
      label: "数据库",
      enabled: input.afterDatabaseStatus.enabled,
      result_status: input.databaseResult.status,
      pushed: input.databaseResult.pushed,
      pulled: input.databaseResult.pulled,
      skipped: input.databaseResult.skipped ?? 0,
      waiting_rows_before: databaseBefore,
      waiting_rows_after: databaseAfter,
      failed_rows_after: input.afterDatabaseStatus.failed,
      manual_review_rows_after: input.afterDatabaseStatus.manualReviewCount,
      queue_cleared:
        databaseAfter === 0 && input.afterDatabaseStatus.failed === 0,
      last_failure_message_after: input.afterDatabaseStatus.lastFailureMessage,
      message: input.databaseResult.message ?? null,
    },
    {
      domain: "files",
      label: "文件",
      enabled: input.afterFileStatus.enabled,
      result_status: input.fileResult.status,
      pushed: input.fileResult.pushed,
      pulled: input.fileResult.pulled,
      skipped: input.fileResult.skipped ?? 0,
      waiting_rows_before: fileBefore,
      waiting_rows_after: fileAfter,
      failed_rows_after: input.afterFileStatus.failed,
      manual_review_rows_after: input.afterFileStatus.manualReviewCount,
      queue_cleared:
        fileAfter === 0 &&
        input.afterFileStatus.failed === 0 &&
        input.afterFileStatus.manualReviewCount === 0,
      last_failure_message_after: input.afterFileStatus.lastFailureMessage,
      message: input.fileResult.message ?? null,
    },
  ];
  const disabledDomains = domains.filter((domain) => !domain.enabled).length;
  const blockedStatuses = domains.filter(
    (domain) =>
      domain.result_status !== "ok" && domain.result_status !== "disabled"
  ).length;
  const blockers =
    disabledDomains + blockedStatuses + (manualReviewRowsAfter > 0 ? 1 : 0);
  const warnings =
    (waitingAfter > 0 ? 1 : 0) + (failedRowsAfter > 0 ? 1 : 0);
  const safeToSwitchDeviceNow =
    blockers === 0 &&
    warnings === 0 &&
    waitingAfter === 0 &&
    failedRowsAfter === 0 &&
    manualReviewRowsAfter === 0;
  const status = getStatus({
    blockers,
    warnings,
    safeToSwitchDeviceNow,
  });

  return {
    format: "zhinote-sync-upload-drain-receipt",
    format_version: 1,
    receipt_status: "metadata-only-upload-drain-result",
    generated_at: generatedAt,
    status,
    privacy_boundary:
      "This receipt is generated locally after a user-triggered pending-queue upload attempt. It summarizes page/database/file queue counts, timestamps, failure counts, failure messages, and the action result. The upload action only uses explicit pending rows from existing sync queues; the receipt itself does not read or export page bodies, database row values, comments, file bytes, secrets, tokens, or raw workspace content. It does not clear or rebuild local cache, enable sync, or enable AI.",
    boundary: {
      local_receipt_only: true,
      triggered_upload_from_pending_queue: true,
      uploads_only_explicit_pending_rows: true,
      reads_queue_counts: true,
      reads_queue_timestamps: true,
      reads_failure_counts: true,
      reads_failure_messages: true,
      reads_page_body_text_for_receipt: false,
      reads_database_row_values_for_receipt: false,
      reads_comment_bodies_for_receipt: false,
      reads_file_bytes_for_receipt: false,
      exports_raw_workspace_content: false,
      clears_local_cache: false,
      rebuilds_local_cache: false,
      enables_sync: false,
      enables_ai: false,
    },
    summary: {
      attempted_domains: domains.length,
      pushed_records: pushedRecords,
      pulled_records: pulledRecords,
      skipped_records: skippedRecords,
      waiting_rows_before: waitingBefore,
      waiting_rows_after: waitingAfter,
      failed_rows_after: failedRowsAfter,
      manual_review_rows_after: manualReviewRowsAfter,
      sync_log_pending_after: Math.max(0, input.afterSyncLogPending),
      file_waiting_rows_after: fileAfter,
      file_failed_rows_after: input.afterFileStatus.failed,
      file_manual_review_rows_after: input.afterFileStatus.manualReviewCount,
      queue_reduced: waitingAfter < waitingBefore,
      safe_to_switch_device_now: safeToSwitchDeviceNow,
      blockers,
      warnings,
    },
    domains,
    next_action: getNextAction({
      disabledDomains,
      blockedStatuses,
      failedRowsAfter,
      manualReviewRowsAfter,
      waitingAfter,
      safeToSwitchDeviceNow,
    }),
  };
}

function getPageWaitingRows(status: PendingCloudPageSyncStatus): number {
  return status.pending + status.queued;
}

function getDatabaseWaitingRows(
  status: PendingCloudDatabaseSyncStatus
): number {
  return status.pending + status.queued + status.syncLogPending;
}

function getFileWaitingRows(status: PendingFileEmbedSyncStatus): number {
  return status.pending;
}

function getStatus(input: {
  blockers: number;
  warnings: number;
  safeToSwitchDeviceNow: boolean;
}): SyncUploadDrainStatus {
  if (input.safeToSwitchDeviceNow) return "ready";
  if (input.blockers > 0) return "blocked";
  if (input.warnings > 0) return "needs-attention";
  return "pending";
}

function getNextAction(input: {
  disabledDomains: number;
  blockedStatuses: number;
  failedRowsAfter: number;
  manualReviewRowsAfter: number;
  waitingAfter: number;
  safeToSwitchDeviceNow: boolean;
}): string {
  if (input.safeToSwitchDeviceNow) {
    return "补传后页面、数据库、文件队列已清空，当前适合切换设备或继续推进本地热缓存重建。";
  }
  if (input.disabledDomains > 0) {
    return "先到账号页确认页面、数据库和文件同步都已开启；关闭的域不会进入自动上云。";
  }
  if (input.blockedStatuses > 0) {
    return "补传动作未完全成功，先检查登录、网络、云端配置和最近失败原因。";
  }
  if (input.manualReviewRowsAfter > 0) {
    return "存在反复失败的记录，导出处理包并按 page id、database key 或 file id 做人工排查。";
  }
  if (input.failedRowsAfter > 0) {
    return "仍有失败回执，先查看最近失败原因；不要在失败未清理前重建本地缓存。";
  }
  if (input.waitingAfter > 0) {
    return "仍有待上传记录，保持页面打开等待后台重试，或稍后再次运行补传全部。";
  }
  return "继续观察队列状态。";
}
