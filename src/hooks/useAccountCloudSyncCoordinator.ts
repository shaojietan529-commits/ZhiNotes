"use client";

// Coordinates the domain sync hooks into one account-level signal. The page
// and database hooks still own their own queues, leases, and API calls; this
// layer gives the shell a single "is my work safely synced?" status and a
// coalesced quick-sync trigger for future modules to join.

import { useCallback, useEffect, useMemo } from "react";
import { useDatabaseCloudSync } from "@/hooks/useDatabaseCloudSync";
import { useFileEmbedCloudSyncStatus } from "@/hooks/useFileEmbedCloudSyncStatus";
import { useGlobalSyncLogStatus } from "@/hooks/useGlobalSyncLogStatus";
import { useKnowledgeCloudSyncStatus } from "@/hooks/useKnowledgeCloudSyncStatus";
import { usePageCloudSync } from "@/hooks/usePageCloudSync";
import { useSettingsCloudSyncStatus } from "@/hooks/useSettingsCloudSyncStatus";
import { buildAccountLocalUseReadiness } from "@/lib/sync/accountLocalUseReadiness";

const COORDINATOR_PENDING_DRAIN_DELAY_MS = 900;
const COORDINATOR_SIGNED_OUT_RETRY_DELAY_MS = 30_000;

export type AccountCloudSyncCoordinatorState =
  | "disabled"
  | "checking"
  | "syncing"
  | "synced"
  | "queued"
  | "attention"
  | "signed-out"
  | "error";

export interface AccountCloudSyncCoordinatorOptions {
  forceLease?: boolean;
  includeManualReview?: boolean;
}

export type { AccountLocalUseReadiness } from "@/lib/sync/accountLocalUseReadiness";

function formatLastSyncTime(value: string | null) {
  if (!value) return null;
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return null;
  return timestamp.toLocaleTimeString("zh-CN");
}

export function useAccountCloudSyncCoordinator() {
  const pageSync = usePageCloudSync();
  const databaseSync = useDatabaseCloudSync();
  const globalSyncLog = useGlobalSyncLogStatus();
  const settingsSync = useSettingsCloudSyncStatus();
  const knowledgeSync = useKnowledgeCloudSyncStatus();
  const fileSync = useFileEmbedCloudSyncStatus();

  const pageSyncNow = pageSync.syncNow;
  const databaseSyncNow = databaseSync.syncNow;
  const refreshSettingsSyncStatus = settingsSync.refresh;
  const refreshKnowledgeSyncStatus = knowledgeSync.refresh;
  const retryFileEmbedSync = fileSync.syncNow;
  const syncNow = useCallback(
    async (options: AccountCloudSyncCoordinatorOptions = {}) => {
      await Promise.allSettled([
        pageSyncNow({
          quick: true,
          forceLease: options.forceLease,
          includeManualReview: options.includeManualReview,
        }),
        databaseSyncNow({
          quick: true,
          forceLease: options.forceLease,
          includeManualReview: options.includeManualReview,
        }),
        refreshSettingsSyncStatus(),
        refreshKnowledgeSyncStatus(),
        retryFileEmbedSync({
          includeManualReview: options.includeManualReview,
          limit: 5,
        }),
      ]);
    },
    [
      databaseSyncNow,
      pageSyncNow,
      retryFileEmbedSync,
      refreshKnowledgeSyncStatus,
      refreshSettingsSyncStatus,
    ]
  );

  const pagePendingTotal =
    pageSync.pendingStatus.pending + pageSync.pendingStatus.queued;
  const databasePendingTotal =
    databaseSync.pendingStatus.pending +
    databaseSync.pendingStatus.queued +
    databaseSync.pendingStatus.syncLogPending;
  const settingsPendingTotal = settingsSync.status.totalPending;
  const knowledgePendingTotal = knowledgeSync.status.totalPending;
  const filePendingTotal = fileSync.status.pending;
  const globalSyncLogCoveredPendingTotal =
    databaseSync.pendingStatus.syncLogPending +
    settingsPendingTotal +
    knowledgePendingTotal;
  const globalSyncLogExtraPendingTotal = Math.max(
    globalSyncLog.status.pending - globalSyncLogCoveredPendingTotal,
    0
  );
  const globalSyncLogCoveredFailedTotal =
    settingsSync.status.failed + knowledgeSync.status.failed;
  const globalSyncLogExtraFailedTotal = Math.max(
    globalSyncLog.status.failed - globalSyncLogCoveredFailedTotal,
    0
  );
  const globalSyncLogCoveredManualReviewTotal =
    settingsSync.status.manualReviewCount +
    knowledgeSync.status.manualReviewCount;
  const globalSyncLogExtraManualReviewTotal = Math.max(
    globalSyncLog.status.manualReviewCount -
      globalSyncLogCoveredManualReviewTotal,
    0
  );
  const pendingTotal =
    pagePendingTotal +
    databasePendingTotal +
    filePendingTotal +
    settingsPendingTotal +
    knowledgePendingTotal +
    globalSyncLogExtraPendingTotal;
  const failedTotal =
    pageSync.pendingStatus.failed +
    databaseSync.pendingStatus.failed +
    fileSync.status.failed +
    settingsSync.status.failed +
    knowledgeSync.status.failed +
    globalSyncLogExtraFailedTotal;
  const manualReviewTotal =
    pageSync.pendingStatus.manualReviewCount +
    databaseSync.pendingStatus.manualReviewCount +
    fileSync.status.manualReviewCount +
    settingsSync.status.manualReviewCount +
    knowledgeSync.status.manualReviewCount +
    globalSyncLogExtraManualReviewTotal;
  const retryableFailedTotal = Math.max(failedTotal - manualReviewTotal, 0);
  const pageAutoRetryablePendingTotal =
    Math.max(
      pageSync.pendingStatus.pending -
        pageSync.pendingStatus.manualReviewCount,
      0
    ) + pageSync.pendingStatus.queued;
  const databaseAutoRetryablePendingTotal =
    Math.max(
      databaseSync.pendingStatus.pending -
        databaseSync.pendingStatus.manualReviewCount,
      0
    ) +
    databaseSync.pendingStatus.queued +
    databaseSync.pendingStatus.syncLogPending;
  const settingsAutoRetryablePendingTotal = Math.max(
    settingsPendingTotal - settingsSync.status.manualReviewCount,
    0
  );
  const knowledgeAutoRetryablePendingTotal = Math.max(
    knowledgePendingTotal - knowledgeSync.status.manualReviewCount,
    0
  );
  // File bytes can be much larger than page/database deltas. Keep them visible
  // and available to explicit quick-sync, but do not run them in the 900ms
  // account-level auto-retry loop.
  const fileAutoRetryablePendingTotal = 0;
  const syncCenterVisibleOnlyPendingTotal =
    settingsAutoRetryablePendingTotal +
    knowledgeAutoRetryablePendingTotal +
    globalSyncLogExtraPendingTotal;
  const autoRetryableSyncWorkTotal =
    pageAutoRetryablePendingTotal +
    databaseAutoRetryablePendingTotal +
    fileAutoRetryablePendingTotal;
  const pageVisibleSyncWork =
    pagePendingTotal > 0 ||
    pageSync.pendingStatus.failed > 0 ||
    pageSync.pendingStatus.manualReviewCount > 0;
  const databaseVisibleSyncWork =
    databasePendingTotal > 0 ||
    databaseSync.pendingStatus.failed > 0 ||
    databaseSync.pendingStatus.manualReviewCount > 0;
  const settingsVisibleSyncWork =
    settingsPendingTotal > 0 ||
    settingsSync.status.failed > 0 ||
    settingsSync.status.manualReviewCount > 0;
  const knowledgeVisibleSyncWork =
    knowledgePendingTotal > 0 ||
    knowledgeSync.status.failed > 0 ||
    knowledgeSync.status.manualReviewCount > 0;
  const fileVisibleSyncWork =
    filePendingTotal > 0 ||
    fileSync.status.failed > 0 ||
    fileSync.status.manualReviewCount > 0;
  const globalSyncLogVisibleSyncWork =
    globalSyncLogExtraPendingTotal > 0 ||
    globalSyncLogExtraFailedTotal > 0 ||
    globalSyncLogExtraManualReviewTotal > 0;
  const enabledDomainCount =
    (pageSync.pendingStatus.enabled ||
    pageSync.state !== "disabled" ||
    pageVisibleSyncWork
      ? 1
      : 0) +
    (databaseSync.pendingStatus.enabled ||
    databaseSync.state !== "disabled" ||
    databaseVisibleSyncWork
      ? 1
      : 0) +
    (settingsVisibleSyncWork ? 1 : 0) +
    (knowledgeVisibleSyncWork ? 1 : 0) +
    (fileVisibleSyncWork ? 1 : 0) +
    (globalSyncLogVisibleSyncWork ? 1 : 0);
  const lastSyncAt =
    [pageSync.lastSyncAt, databaseSync.lastSyncAt]
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;
  const authRetryDomainLabel = [
    pageSync.pendingStatus.authRetryStatus ? "页面" : null,
    databaseSync.pendingStatus.authRetryStatus ? "数据库" : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join("/");
  const authRetryUntil =
    [
      pageSync.pendingStatus.authRetryUntil,
      databaseSync.pendingStatus.authRetryUntil,
    ]
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;
  const authRetryUntilLabel =
    formatLastSyncTime(authRetryUntil) ?? authRetryUntil;
  const authRetryDetail = authRetryDomainLabel
    ? `账号重试 ${authRetryDomainLabel}${
        authRetryUntilLabel ? `，下次 ${authRetryUntilLabel}` : ""
      }`
    : null;
  const initializingEnabledDomain =
    (pageSync.pendingStatus.enabled && pageSync.state === "disabled") ||
    (databaseSync.pendingStatus.enabled && databaseSync.state === "disabled");
  const syncBlockedBySignedOut =
    pageSync.state === "signed-out" || databaseSync.state === "signed-out";

  const state: AccountCloudSyncCoordinatorState =
    enabledDomainCount === 0
      ? "disabled"
      : manualReviewTotal > 0 || failedTotal > 0
        ? "attention"
        : pageSync.state === "error" || databaseSync.state === "error"
          ? "error"
          : pageSync.state === "syncing" || databaseSync.state === "syncing"
            ? "syncing"
            : pendingTotal > 0
              ? "queued"
              : syncBlockedBySignedOut
                ? "signed-out"
                : initializingEnabledDomain
                  ? "checking"
                  : "synced";

  const title = useMemo(() => {
    if (state === "disabled") return "账号云同步未开启";
    const details = [
      pendingTotal > 0 ? `${pendingTotal} 项待上传` : null,
      retryableFailedTotal > 0 ? `${retryableFailedTotal} 项待重试` : null,
      manualReviewTotal > 0 ? `${manualReviewTotal} 项需要人工确认` : null,
      pagePendingTotal > 0 ? `页面 ${pagePendingTotal}` : null,
      databasePendingTotal > 0 ? `数据库 ${databasePendingTotal}` : null,
      settingsPendingTotal > 0
        ? `设置 ${settingsPendingTotal}（同步中心处理）`
        : null,
      knowledgePendingTotal > 0
        ? `知识库附属 ${knowledgePendingTotal}（评论/版本/链接待云端回放）`
        : null,
      filePendingTotal > 0
        ? `文件 ${filePendingTotal}（只记录待上传元数据，文件仍在本地）`
        : null,
      globalSyncLogExtraPendingTotal > 0
        ? `其他本地队列 ${globalSyncLogExtraPendingTotal}（同步中心处理）`
        : null,
      authRetryDetail,
      syncCenterVisibleOnlyPendingTotal > 0
        ? `同步中心待处理 ${syncCenterVisibleOnlyPendingTotal}`
        : null,
      lastSyncAt ? `最近同步 ${formatLastSyncTime(lastSyncAt)}` : null,
    ].filter(Boolean);
    if (state === "checking") {
      return `账号云同步正在检查${details.length ? `：${details.join("，")}` : ""}`;
    }
    if (state === "syncing") return `账号云同步中${details.length ? `：${details.join("，")}` : ""}`;
    if (state === "queued") {
      const settingsNote =
        settingsPendingTotal > 0
          ? "；设置类变更已进入本地队列，需到同步中心执行云端上传"
          : "";
      const knowledgeNote =
        knowledgePendingTotal > 0
          ? "；评论、版本和双链变更已进入本地队列，需云端回放链路处理"
          : "";
      const accountRetryNote = syncBlockedBySignedOut
        ? "；账号未确认，本地输入已保留，会低频检查登录状态"
        : "";
      return `后台正在补传本地输入${details.length ? `：${details.join("，")}` : ""}${settingsNote}${knowledgeNote}${accountRetryNote}`;
    }
    if (state === "attention") return `账号云同步需要处理${details.length ? `：${details.join("，")}` : ""}`;
    if (state === "signed-out") {
      return pendingTotal > 0
        ? `账号云同步需要登录后继续；本地输入已保留，会低频检查登录状态${
            details.length ? `：${details.join("，")}` : ""
          }`
        : "账号云同步需要登录后继续";
    }
    if (state === "error") {
      return `账号云同步暂不可确认，稍后重试；本地输入已保留${
        details.length ? `：${details.join("，")}` : ""
      }`;
    }
    return `账号云同步已完成${details.length ? `：${details.join("，")}` : ""}`;
  }, [
    authRetryDetail,
    databasePendingTotal,
    filePendingTotal,
    globalSyncLogExtraPendingTotal,
    knowledgePendingTotal,
    lastSyncAt,
    manualReviewTotal,
    pagePendingTotal,
    pendingTotal,
    retryableFailedTotal,
    settingsPendingTotal,
    syncBlockedBySignedOut,
    syncCenterVisibleOnlyPendingTotal,
    state,
  ]);

  const localUseReadiness = useMemo(
    () =>
      buildAccountLocalUseReadiness({
        state,
        pendingTotal,
        failedTotal,
        manualReviewTotal,
        retryableFailedTotal,
        enabledDomainCount,
        pagePendingTotal,
        databasePendingTotal,
        filePendingTotal,
        settingsPendingTotal,
        knowledgePendingTotal,
        otherPendingTotal: globalSyncLogExtraPendingTotal,
        fileFailedTotal: fileSync.status.failed,
        fileManualReviewTotal: fileSync.status.manualReviewCount,
        authRetryDomainLabel,
        authRetryUntilLabel,
      }),
    [
      authRetryDomainLabel,
      authRetryUntilLabel,
      databasePendingTotal,
      enabledDomainCount,
      filePendingTotal,
      fileSync.status.failed,
      fileSync.status.manualReviewCount,
      failedTotal,
      globalSyncLogExtraPendingTotal,
      knowledgePendingTotal,
      manualReviewTotal,
      pagePendingTotal,
      pendingTotal,
      retryableFailedTotal,
      settingsPendingTotal,
      state,
    ]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (
      enabledDomainCount === 0 ||
      autoRetryableSyncWorkTotal <= 0 ||
      state === "syncing"
    ) {
      return;
    }
    const retryDelayMs =
      syncBlockedBySignedOut
        ? COORDINATOR_SIGNED_OUT_RETRY_DELAY_MS
        : COORDINATOR_PENDING_DRAIN_DELAY_MS;
    const timer = window.setTimeout(() => {
      void syncNow();
    }, retryDelayMs);
    return () => window.clearTimeout(timer);
  }, [
    autoRetryableSyncWorkTotal,
    enabledDomainCount,
    state,
    syncBlockedBySignedOut,
    syncNow,
  ]);

  return {
    state,
    title,
    pageSync,
    databaseSync,
    pagePendingTotal,
    databasePendingTotal,
    filePendingTotal,
    settingsPendingTotal,
    knowledgePendingTotal,
    globalSyncLogExtraPendingTotal,
    globalSyncLogExtraFailedTotal,
    globalSyncLogExtraManualReviewTotal,
    pendingTotal,
    failedTotal,
    manualReviewTotal,
    retryableFailedTotal,
    autoRetryableSyncWorkTotal,
    enabledDomainCount,
    lastSyncAt,
    localUseReadiness,
    knowledgeSync,
    fileSync,
    settingsSync,
    globalSyncLog,
    syncNow,
  };
}
