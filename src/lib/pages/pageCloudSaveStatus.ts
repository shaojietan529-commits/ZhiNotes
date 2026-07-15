import type {
  CloudPageSyncItemStatus,
  PendingCloudPageSyncStatus,
} from "@/lib/pages/accountPageSync";

export type PageCloudSaveStatusId =
  | "local-only"
  | "offline-buffer"
  | "current-page-needs-review"
  | "current-page-failed"
  | "global-page-needs-review"
  | "global-page-failed"
  | "current-page-pending"
  | "global-page-pending"
  | "cloud-confirmed"
  | "local-saved";

export type PageCloudSaveStatusTone =
  | "neutral"
  | "warning"
  | "danger"
  | "success";

export interface PageCloudSaveStatusInput {
  currentPagePending: boolean;
  currentPageSyncStatus?: CloudPageSyncItemStatus | null;
  pageId: string;
  status: PendingCloudPageSyncStatus;
}

export interface PageCloudSaveStatusView {
  id: PageCloudSaveStatusId;
  label: string;
  title: string;
  tone: PageCloudSaveStatusTone;
  aria_label: string;
  sync_center_target: "/modules/sync#page-pending-upload-queue";
  total_pending_rows: number;
  failed_rows: number;
  manual_review_rows: number;
  can_claim_cloud_confirmed: boolean;
  blocks_cache_rebuild: boolean;
  opens_sync_center: true;
  privacy_boundary: string;
}

export function buildPageCloudSaveStatus(
  input: PageCloudSaveStatusInput
): PageCloudSaveStatusView {
  const totalPending = input.status.pending + input.status.queued;
  const pageState = input.currentPageSyncStatus?.state ?? null;
  const currentPagePending =
    input.currentPagePending ||
    pageState === "queued" ||
    pageState === "pending";
  const pageFailed =
    pageState === "failed" ||
    (!input.currentPageSyncStatus &&
      input.status.failedSampleIds.includes(input.pageId));
  const pageManualReview =
    pageState === "manual-review" ||
    (!input.currentPageSyncStatus &&
      input.status.manualReviewSampleIds.includes(input.pageId));
  const syncedAt = formatSyncTime(input.status.lastSyncAt);
  const cloudConfirmed =
    input.status.enabled &&
    totalPending === 0 &&
    input.status.failed === 0 &&
    input.status.manualReviewCount === 0 &&
    Boolean(syncedAt);

  const base = {
    total_pending_rows: totalPending,
    failed_rows: input.status.failed,
    manual_review_rows: input.status.manualReviewCount,
    can_claim_cloud_confirmed: cloudConfirmed,
    opens_sync_center: true as const,
    sync_center_target: "/modules/sync#page-pending-upload-queue" as const,
    privacy_boundary:
      "Page save status is computed locally from queue counts, page id membership in pending/failure samples, auth retry state, and last sync timestamps. It never reads page body text, editor state, database row values, comments, files, secrets, tokens, cookies, or remote data. It does not read page body text, does not send network requests, does not upload data, does not write server data, does not acknowledge remote rows, does not mark local rows synced, and does not clear cache.",
  };

  if (pageManualReview) {
    return view({
      ...base,
      id: "current-page-needs-review",
      label: "当前页需处理",
      title:
        "当前页面已在本机保存，但云端同步超过重试阈值；点击打开同步中心处理。",
      tone: "danger",
      blocksCacheRebuild: true,
    });
  }

  if (pageFailed) {
    return view({
      ...base,
      id: "current-page-failed",
      label: "当前页同步失败",
      title:
        "当前页面已在本机保存，但最近一次云端同步失败；点击打开同步中心重试。",
      tone: "danger",
      blocksCacheRebuild: true,
    });
  }

  if (input.status.manualReviewCount > 0) {
    return view({
      ...base,
      id: "global-page-needs-review",
      label: `页面需处理 ${input.status.manualReviewCount}`,
      title:
        "有页面同步记录超过重试阈值；点击打开同步中心处理，处理前不要清缓存或切设备。",
      tone: "danger",
      blocksCacheRebuild: true,
    });
  }

  if (input.status.failed > 0) {
    return view({
      ...base,
      id: "global-page-failed",
      label: `页面同步失败 ${input.status.failed}`,
      title:
        "有页面云同步失败记录；点击打开同步中心查看原因并重试。",
      tone: "danger",
      blocksCacheRebuild: true,
    });
  }

  if (currentPagePending) {
    return view({
      ...base,
      id: "current-page-pending",
      label: "当前页待云同步",
      title:
        "当前页面已经在本机保存，并进入云端待上传队列；点击打开同步中心查看补传状态。",
      tone: "warning",
      blocksCacheRebuild: true,
    });
  }

  if (totalPending > 0) {
    return view({
      ...base,
      id: "global-page-pending",
      label: input.status.queued > 0
        ? `同步排队 ${totalPending}`
        : `等待云同步 ${totalPending}`,
      title: `已有 ${totalPending} 个页面变更进入本地待上传队列；点击打开同步中心处理补传。`,
      tone: "warning",
      blocksCacheRebuild: true,
    });
  }

  if (!input.status.enabled) {
    return view({
      ...base,
      id: "local-only",
      label: "本地已保存",
      title: "页面同步已关闭；点击打开同步中心查看设置。",
      tone: "neutral",
      blocksCacheRebuild: false,
    });
  }

  if (input.status.authRetryStatus) {
    const authRetryDetail = formatAuthRetryDetail(
      input.status.authRetryStatus,
      input.status.authRetryUntil
    );
    return view({
      ...base,
      id: "offline-buffer",
      label: "本地缓冲",
      title:
        `页面已在本机保存；当前云端暂不可确认，会稍后自动重试，不会因此登出。${authRetryDetail}`,
      tone: "warning",
      blocksCacheRebuild: true,
    });
  }

  if (syncedAt) {
    return view({
      ...base,
      id: "cloud-confirmed",
      label: `云端已同步 ${syncedAt.shortLabel}`,
      title: `最近一次页面云同步时间：${syncedAt.longLabel}；点击打开同步中心。`,
      tone: "success",
      blocksCacheRebuild: false,
    });
  }

  return view({
    ...base,
    id: "local-saved",
    label: "本地已保存",
    title: "页面已在本机保存；点击打开同步中心查看队列。",
    tone: "neutral",
    blocksCacheRebuild: false,
  });
}

function view(input: {
  id: PageCloudSaveStatusId;
  label: string;
  title: string;
  tone: PageCloudSaveStatusTone;
  total_pending_rows: number;
  failed_rows: number;
  manual_review_rows: number;
  can_claim_cloud_confirmed: boolean;
  blocksCacheRebuild: boolean;
  opens_sync_center: true;
  sync_center_target: "/modules/sync#page-pending-upload-queue";
  privacy_boundary: string;
}): PageCloudSaveStatusView {
  return {
    id: input.id,
    label: input.label,
    title: input.title,
    tone: input.tone,
    aria_label: `${input.label}，打开同步中心的页面 pending 上传队列`,
    sync_center_target: input.sync_center_target,
    total_pending_rows: input.total_pending_rows,
    failed_rows: input.failed_rows,
    manual_review_rows: input.manual_review_rows,
    can_claim_cloud_confirmed: input.can_claim_cloud_confirmed,
    blocks_cache_rebuild: input.blocksCacheRebuild,
    opens_sync_center: input.opens_sync_center,
    privacy_boundary: input.privacy_boundary,
  };
}

function formatSyncTime(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return {
    shortLabel: date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    longLabel: date.toLocaleString("zh-CN"),
  };
}

function formatAuthRetryDetail(
  status: PendingCloudPageSyncStatus["authRetryStatus"],
  until: string | null
) {
  if (!status) return "";
  const statusLabel = formatAuthRetryStatus(status);
  const retryAt = formatSyncTime(until);
  const retryLabel = retryAt ? `下次自动重试约 ${retryAt.shortLabel}` : null;
  return ` 原因：${[statusLabel, retryLabel].filter(Boolean).join("；")}。`;
}

function formatAuthRetryStatus(
  status: PendingCloudPageSyncStatus["authRetryStatus"]
) {
  if (status === "unauthenticated") return "账号待重新确认";
  if (status === "unconfigured") return "云同步暂未配置";
  if (status === "unconfirmed") return "账号状态暂未确认";
  if (status === "error") return "云端或网络暂不可确认";
  return "云端暂不可确认";
}
