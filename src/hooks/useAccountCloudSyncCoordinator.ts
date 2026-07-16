"use client";

// Coordinates the domain sync hooks into one account-level signal. The page
// and database hooks still own their own queues, leases, and API calls; this
// layer gives the shell a single "is my work safely synced?" status and a
// coalesced quick-sync trigger for future modules to join.

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useDatabaseCloudSync } from "@/hooks/useDatabaseCloudSync";
import { useFileEmbedCloudSyncStatus } from "@/hooks/useFileEmbedCloudSyncStatus";
import { useGlobalSyncLogStatus } from "@/hooks/useGlobalSyncLogStatus";
import { useKnowledgeCloudSyncStatus } from "@/hooks/useKnowledgeCloudSyncStatus";
import { usePageCloudSync } from "@/hooks/usePageCloudSync";
import { useSettingsCloudSyncStatus } from "@/hooks/useSettingsCloudSyncStatus";
import { buildAccountLocalUseReadiness } from "@/lib/sync/accountLocalUseReadiness";

const COORDINATOR_PENDING_DRAIN_DELAY_MS = 900;
const COORDINATOR_ACCOUNT_UNCERTAIN_RETRY_DELAY_MS = 5_000;
const COORDINATOR_SIGNED_OUT_RETRY_DELAY_MS = 12_000;

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
  forceAccountGate?: boolean;
  includeManualReview?: boolean;
  includeFileSync?: boolean;
}

export type { AccountLocalUseReadiness } from "@/lib/sync/accountLocalUseReadiness";

function formatLastSyncTime(value: string | null) {
  if (!value) return null;
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return null;
  return timestamp.toLocaleTimeString("zh-CN");
}

export function useAccountCloudSyncCoordinator() {
  const mountedRef = useRef(true);
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
  const refreshGlobalSyncLogStatus = globalSyncLog.refresh;
  const retryFileEmbedSync = fileSync.syncNow;

  const syncNow = useCallback(
    async (options: AccountCloudSyncCoordinatorOptions = {}) => {
      if (!mountedRef.current) return;
      const syncJobs: Array<Promise<unknown>> = [
        pageSyncNow({
          quick: true,
          forceLease: options.forceLease,
          forceAccountGate: options.forceAccountGate,
          includeManualReview: options.includeManualReview,
        }),
        databaseSyncNow({
          quick: true,
          forceLease: options.forceLease,
          forceAccountGate: options.forceAccountGate,
          includeManualReview: options.includeManualReview,
        }),
        refreshSettingsSyncStatus(),
        refreshKnowledgeSyncStatus(),
      ];
      if (options.includeFileSync ?? true) {
        syncJobs.push(
          retryFileEmbedSync({
            includeManualReview: options.includeManualReview,
            limit: 5,
          })
        );
      }
      await Promise.allSettled(syncJobs);
      if (!mountedRef.current) return;
      await refreshGlobalSyncLogStatus();
    },
    [
      databaseSyncNow,
      pageSyncNow,
      refreshGlobalSyncLogStatus,
      retryFileEmbedSync,
      refreshKnowledgeSyncStatus,
      refreshSettingsSyncStatus,
    ]
  );

  const pagePendingTotal =
    pageSync.pendingStatus.pending +
    pageSync.pendingStatus.queued +
    (pageSync.pendingStatus.syncLogPending ?? 0);
  const databasePendingTotal =
    databaseSync.pendingStatus.pending +
    databaseSync.pendingStatus.queued +
    (databaseSync.pendingStatus.syncLogPending ?? 0);
  const settingsPendingTotal = settingsSync.status.totalPending;
  const knowledgePendingTotal = knowledgeSync.status.totalPending;
  const filePendingTotal = fileSync.status.pending;
  const globalSyncLogCoveredPendingTotal =
    (pageSync.pendingStatus.syncLogPending ?? 0) +
    (databaseSync.pendingStatus.syncLogPending ?? 0) +
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
  const pageRetryableFailedTotal = Math.max(
    pageSync.pendingStatus.failed - pageSync.pendingStatus.manualReviewCount,
    0
  );
  const databaseRetryableFailedTotal = Math.max(
    databaseSync.pendingStatus.failed -
      databaseSync.pendingStatus.manualReviewCount,
    0
  );
  const fileRetryableFailedTotal = fileSync.status.failed;
  const settingsRetryableFailedTotal = Math.max(
    settingsSync.status.failed - settingsSync.status.manualReviewCount,
    0
  );
  const knowledgeRetryableFailedTotal = Math.max(
    knowledgeSync.status.failed - knowledgeSync.status.manualReviewCount,
    0
  );
  const globalSyncLogExtraRetryableFailedTotal = Math.max(
    globalSyncLogExtraFailedTotal - globalSyncLogExtraManualReviewTotal,
    0
  );
  const retryableFailedTotal =
    pageRetryableFailedTotal +
    databaseRetryableFailedTotal +
    fileRetryableFailedTotal +
    settingsRetryableFailedTotal +
    knowledgeRetryableFailedTotal +
    globalSyncLogExtraRetryableFailedTotal;
  const pageAutoRetryablePendingTotal =
    Math.max(
      pageSync.pendingStatus.pending -
        pageSync.pendingStatus.manualReviewCount,
      0
    ) +
    pageSync.pendingStatus.queued +
    (pageSync.pendingStatus.syncLogPending ?? 0);
  const databaseAutoRetryablePendingTotal =
    Math.max(
      databaseSync.pendingStatus.pending -
        databaseSync.pendingStatus.manualReviewCount,
      0
    ) +
    databaseSync.pendingStatus.queued +
    (databaseSync.pendingStatus.syncLogPending ?? 0);
  const settingsAutoRetryablePendingTotal = Math.max(
    settingsPendingTotal - settingsSync.status.manualReviewCount,
    0
  );
  const knowledgeAutoRetryablePendingTotal = Math.max(
    knowledgePendingTotal - knowledgeSync.status.manualReviewCount,
    0
  );
  // File bytes can be much larger than page/database deltas. Keep them visible
  // and available to explicit quick-sync, but do not run them in account-level
  // auto-retry loops.
  const fileAutoRetryablePendingTotal = 0;
  const syncCenterVisibleOnlyPendingTotal =
    settingsAutoRetryablePendingTotal +
    knowledgeAutoRetryablePendingTotal +
    globalSyncLogExtraPendingTotal;
  const pageAutoRetryableFailedTotal = pageRetryableFailedTotal;
  const databaseAutoRetryableFailedTotal = databaseRetryableFailedTotal;
  const autoRetryableSyncWorkTotal =
    pageAutoRetryablePendingTotal +
    databaseAutoRetryablePendingTotal +
    pageAutoRetryableFailedTotal +
    databaseAutoRetryableFailedTotal +
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
    fileSync.status.authRetryStatus ? "文件" : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join("/");
  const authRetryUnconfiguredDomainLabel = [
    pageSync.pendingStatus.authRetryStatus === "unconfigured" ? "页面" : null,
    databaseSync.pendingStatus.authRetryStatus === "unconfigured"
      ? "数据库"
      : null,
    fileSync.status.authRetryStatus === "unconfigured" ? "文件" : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join("/");
  const authRetryUnconfirmedDomainLabel = [
    pageSync.pendingStatus.authRetryStatus === "unconfirmed" ? "页面" : null,
    databaseSync.pendingStatus.authRetryStatus === "unconfirmed"
      ? "数据库"
      : null,
    fileSync.status.authRetryStatus === "unconfirmed" ? "文件" : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join("/");
  const authRetryUntil =
    [
      pageSync.pendingStatus.authRetryUntil,
      databaseSync.pendingStatus.authRetryUntil,
      fileSync.status.authRetryUntil,
    ]
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;
  const authRetryUntilLabel =
    formatLastSyncTime(authRetryUntil) ?? authRetryUntil;
  const authRetryDetail = authRetryDomainLabel
    ? authRetryUnconfiguredDomainLabel
      ? `云端未配置 ${authRetryUnconfiguredDomainLabel}${
          authRetryUntilLabel ? `，下次检查 ${authRetryUntilLabel}` : ""
        }`
      : authRetryUnconfirmedDomainLabel
        ? `账号临时不可确认 ${authRetryUnconfirmedDomainLabel}${
            authRetryUntilLabel ? `，下次重试 ${authRetryUntilLabel}` : ""
          }`
        : `账号重试 ${authRetryDomainLabel}${
            authRetryUntilLabel ? `，下次 ${authRetryUntilLabel}` : ""
          }`
    : null;
  const initializingEnabledDomain =
    (pageSync.pendingStatus.enabled && pageSync.state === "disabled") ||
    (databaseSync.pendingStatus.enabled && databaseSync.state === "disabled");
  const syncBlockedBySignedOut =
    pageSync.state === "signed-out" || databaseSync.state === "signed-out";
  const accountUncertainByAuthRetry = Boolean(authRetryDomainLabel);
  const syncErrorWithoutAuthRetry =
    (pageSync.state === "error" && !pageSync.pendingStatus.authRetryStatus) ||
    (databaseSync.state === "error" &&
      !databaseSync.pendingStatus.authRetryStatus);

  const state: AccountCloudSyncCoordinatorState =
    enabledDomainCount === 0
      ? "disabled"
      : manualReviewTotal > 0 || failedTotal > 0
        ? "attention"
        : syncErrorWithoutAuthRetry
          ? "error"
          : pageSync.state === "syncing" || databaseSync.state === "syncing"
            ? "syncing"
            : pendingTotal > 0
              ? "queued"
            : accountUncertainByAuthRetry
                ? "checking"
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
        : authRetryUnconfiguredDomainLabel
          ? "；云端未配置，本地输入已保留，这不是登出，配置完成后再补传"
        : accountUncertainByAuthRetry
          ? "；账号临时不可确认，本地输入已保留，系统会重试"
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
      return `账号云同步暂不可确认，低频重试；本地输入已保留${
        details.length ? `：${details.join("，")}` : ""
      }`;
    }
    return `账号云同步已完成${details.length ? `：${details.join("，")}` : ""}`;
  }, [
    accountUncertainByAuthRetry,
    authRetryDetail,
    authRetryUnconfiguredDomainLabel,
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
        otherFailedTotal: globalSyncLogExtraFailedTotal,
        otherManualReviewTotal: globalSyncLogExtraManualReviewTotal,
        fileFailedTotal: fileSync.status.failed,
        fileManualReviewTotal: fileSync.status.manualReviewCount,
        pageSyncEnabled: pageSync.pendingStatus.enabled,
        databaseSyncEnabled: databaseSync.pendingStatus.enabled,
        authRetryDomainLabel,
        authRetryUnconfiguredDomainLabel,
        authRetryUnconfirmedDomainLabel,
        authRetryUntilLabel,
      }),
    [
      authRetryDomainLabel,
      authRetryUnconfiguredDomainLabel,
      authRetryUnconfirmedDomainLabel,
      authRetryUntilLabel,
      databasePendingTotal,
      enabledDomainCount,
      filePendingTotal,
      fileSync.status.failed,
      fileSync.status.manualReviewCount,
      failedTotal,
      globalSyncLogExtraFailedTotal,
      globalSyncLogExtraManualReviewTotal,
      globalSyncLogExtraPendingTotal,
      knowledgePendingTotal,
      manualReviewTotal,
      pageSync.pendingStatus.enabled,
      pagePendingTotal,
      pendingTotal,
      retryableFailedTotal,
      databaseSync.pendingStatus.enabled,
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
    const shouldForceAccountGate =
      state === "error" || syncBlockedBySignedOut || accountUncertainByAuthRetry;
    const retryDelayMs =
      syncBlockedBySignedOut
        ? COORDINATOR_SIGNED_OUT_RETRY_DELAY_MS
        : state === "error" || accountUncertainByAuthRetry
          ? COORDINATOR_ACCOUNT_UNCERTAIN_RETRY_DELAY_MS
          : COORDINATOR_PENDING_DRAIN_DELAY_MS;
    const timer = window.setTimeout(() => {
      if (!mountedRef.current) return;
      void syncNow({
        forceAccountGate: shouldForceAccountGate,
        includeFileSync: false,
      });
    }, retryDelayMs);
    return () => window.clearTimeout(timer);
  }, [
    autoRetryableSyncWorkTotal,
    accountUncertainByAuthRetry,
    enabledDomainCount,
    state,
    syncBlockedBySignedOut,
    syncNow,
  ]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    state,
    title,
    authRetryActive: Boolean(authRetryDomainLabel),
    authRetryDomainLabel,
    authRetryUnconfiguredDomainLabel,
    authRetryUnconfirmedDomainLabel,
    authRetryUntilLabel,
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
