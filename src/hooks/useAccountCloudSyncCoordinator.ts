"use client";

// Coordinates the domain sync hooks into one account-level signal. The page
// and database hooks still own their own queues, leases, and API calls; this
// layer gives the shell a single "is my work safely synced?" status and a
// coalesced quick-sync trigger for future modules to join.

import { useCallback, useEffect, useMemo } from "react";
import { useDatabaseCloudSync } from "@/hooks/useDatabaseCloudSync";
import { useGlobalSyncLogStatus } from "@/hooks/useGlobalSyncLogStatus";
import { useKnowledgeCloudSyncStatus } from "@/hooks/useKnowledgeCloudSyncStatus";
import { usePageCloudSync } from "@/hooks/usePageCloudSync";
import { useSettingsCloudSyncStatus } from "@/hooks/useSettingsCloudSyncStatus";
import { buildAccountLocalUseReadiness } from "@/lib/sync/accountLocalUseReadiness";

const COORDINATOR_PENDING_DRAIN_DELAY_MS = 900;

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

  const pageSyncNow = pageSync.syncNow;
  const databaseSyncNow = databaseSync.syncNow;
  const refreshSettingsSyncStatus = settingsSync.refresh;
  const refreshKnowledgeSyncStatus = knowledgeSync.refresh;
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
      ]);
    },
    [
      databaseSyncNow,
      pageSyncNow,
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
    settingsPendingTotal +
    knowledgePendingTotal +
    globalSyncLogExtraPendingTotal;
  const failedTotal =
    pageSync.pendingStatus.failed +
    databaseSync.pendingStatus.failed +
    settingsSync.status.failed +
    knowledgeSync.status.failed +
    globalSyncLogExtraFailedTotal;
  const manualReviewTotal =
    pageSync.pendingStatus.manualReviewCount +
    databaseSync.pendingStatus.manualReviewCount +
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
  const autoRetryableSyncWorkTotal =
    pageAutoRetryablePendingTotal +
    databaseAutoRetryablePendingTotal +
    settingsAutoRetryablePendingTotal +
    knowledgeAutoRetryablePendingTotal;
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
    (globalSyncLogVisibleSyncWork ? 1 : 0);
  const lastSyncAt =
    [pageSync.lastSyncAt, databaseSync.lastSyncAt]
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;
  const initializingEnabledDomain =
    (pageSync.pendingStatus.enabled && pageSync.state === "disabled") ||
    (databaseSync.pendingStatus.enabled && databaseSync.state === "disabled");

  const state: AccountCloudSyncCoordinatorState =
    enabledDomainCount === 0
      ? "disabled"
      : manualReviewTotal > 0 || failedTotal > 0
        ? "attention"
        : pageSync.state === "error" || databaseSync.state === "error"
          ? "error"
          : pageSync.state === "signed-out" || databaseSync.state === "signed-out"
            ? "signed-out"
            : pageSync.state === "syncing" || databaseSync.state === "syncing"
              ? "syncing"
              : pendingTotal > 0
                ? "queued"
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
      globalSyncLogExtraPendingTotal > 0
        ? `其他本地队列 ${globalSyncLogExtraPendingTotal}（同步中心处理）`
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
      return `后台正在补传本地输入${details.length ? `：${details.join("，")}` : ""}${settingsNote}${knowledgeNote}`;
    }
    if (state === "attention") return `账号云同步需要处理${details.length ? `：${details.join("，")}` : ""}`;
    if (state === "signed-out") return "账号云同步需要登录后继续";
    if (state === "error") {
      return `账号云同步暂不可确认，稍后重试；本地输入已保留${
        details.length ? `：${details.join("，")}` : ""
      }`;
    }
    return `账号云同步已完成${details.length ? `：${details.join("，")}` : ""}`;
  }, [
    databasePendingTotal,
    globalSyncLogExtraPendingTotal,
    knowledgePendingTotal,
    lastSyncAt,
    manualReviewTotal,
    pagePendingTotal,
    pendingTotal,
    retryableFailedTotal,
    settingsPendingTotal,
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
      }),
    [
      enabledDomainCount,
      failedTotal,
      manualReviewTotal,
      pendingTotal,
      retryableFailedTotal,
      state,
    ]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (
      enabledDomainCount === 0 ||
      autoRetryableSyncWorkTotal <= 0 ||
      state === "syncing" ||
      state === "signed-out"
    ) {
      return;
    }
    const timer = window.setTimeout(() => {
      void syncNow();
    }, COORDINATOR_PENDING_DRAIN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [autoRetryableSyncWorkTotal, enabledDomainCount, state, syncNow]);

  return {
    state,
    title,
    pageSync,
    databaseSync,
    pagePendingTotal,
    databasePendingTotal,
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
    settingsSync,
    globalSyncLog,
    syncNow,
  };
}
