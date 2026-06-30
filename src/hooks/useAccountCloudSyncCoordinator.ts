"use client";

// Coordinates the domain sync hooks into one account-level signal. The page
// and database hooks still own their own queues, leases, and API calls; this
// layer gives the shell a single "is my work safely synced?" status and a
// coalesced quick-sync trigger for future modules to join.

import { useCallback, useEffect, useMemo } from "react";
import { useDatabaseCloudSync } from "@/hooks/useDatabaseCloudSync";
import { usePageCloudSync } from "@/hooks/usePageCloudSync";

const COORDINATOR_PENDING_DRAIN_DELAY_MS = 900;

export type AccountCloudSyncCoordinatorState =
  | "disabled"
  | "syncing"
  | "synced"
  | "queued"
  | "attention"
  | "signed-out"
  | "error";

export interface AccountCloudSyncCoordinatorOptions {
  forceLease?: boolean;
}

function formatLastSyncTime(value: string | null) {
  if (!value) return null;
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return null;
  return timestamp.toLocaleTimeString("zh-CN");
}

export function useAccountCloudSyncCoordinator() {
  const pageSync = usePageCloudSync();
  const databaseSync = useDatabaseCloudSync();

  const pageSyncNow = pageSync.syncNow;
  const databaseSyncNow = databaseSync.syncNow;
  const syncNow = useCallback(
    async (options: AccountCloudSyncCoordinatorOptions = {}) => {
      await Promise.allSettled([
        pageSyncNow({ quick: true, forceLease: options.forceLease }),
        databaseSyncNow({ quick: true, forceLease: options.forceLease }),
      ]);
    },
    [databaseSyncNow, pageSyncNow]
  );

  const pagePendingTotal =
    pageSync.pendingStatus.pending + pageSync.pendingStatus.queued;
  const databasePendingTotal =
    databaseSync.pendingStatus.pending +
    databaseSync.pendingStatus.queued +
    databaseSync.pendingStatus.syncLogPending;
  const pendingTotal = pagePendingTotal + databasePendingTotal;
  const failedTotal =
    pageSync.pendingStatus.failed + databaseSync.pendingStatus.failed;
  const manualReviewTotal =
    pageSync.pendingStatus.manualReviewCount +
    databaseSync.pendingStatus.manualReviewCount;
  const enabledDomainCount =
    (pageSync.pendingStatus.enabled || pageSync.state !== "disabled" ? 1 : 0) +
    (databaseSync.pendingStatus.enabled || databaseSync.state !== "disabled"
      ? 1
      : 0);
  const lastSyncAt =
    [pageSync.lastSyncAt, databaseSync.lastSyncAt]
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;

  const state: AccountCloudSyncCoordinatorState =
    enabledDomainCount === 0
      ? "disabled"
      : pageSync.state === "error" || databaseSync.state === "error"
        ? "error"
        : manualReviewTotal > 0 || failedTotal > 0
          ? "attention"
          : pageSync.state === "signed-out" || databaseSync.state === "signed-out"
            ? "signed-out"
            : pageSync.state === "syncing" || databaseSync.state === "syncing"
              ? "syncing"
              : pendingTotal > 0
                ? "queued"
                : "synced";

  const title = useMemo(() => {
    if (state === "disabled") return "账号云同步未开启";
    const details = [
      pendingTotal > 0 ? `${pendingTotal} 项待上传` : null,
      failedTotal > 0 ? `${failedTotal} 项待重试` : null,
      manualReviewTotal > 0 ? `${manualReviewTotal} 项需要人工确认` : null,
      pagePendingTotal > 0 ? `页面 ${pagePendingTotal}` : null,
      databasePendingTotal > 0 ? `数据库 ${databasePendingTotal}` : null,
      lastSyncAt ? `最近同步 ${formatLastSyncTime(lastSyncAt)}` : null,
    ].filter(Boolean);
    if (state === "syncing") return `账号云同步中${details.length ? `：${details.join("，")}` : ""}`;
    if (state === "queued") return `后台正在补传本地输入${details.length ? `：${details.join("，")}` : ""}`;
    if (state === "attention") return `账号云同步需要处理${details.length ? `：${details.join("，")}` : ""}`;
    if (state === "signed-out") return "账号云同步需要登录后继续";
    if (state === "error") return `账号云同步出错${details.length ? `：${details.join("，")}` : ""}`;
    return `账号云同步已完成${details.length ? `：${details.join("，")}` : ""}`;
  }, [
    databasePendingTotal,
    failedTotal,
    lastSyncAt,
    manualReviewTotal,
    pagePendingTotal,
    pendingTotal,
    state,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (
      enabledDomainCount === 0 ||
      pendingTotal <= 0 ||
      state === "syncing" ||
      state === "signed-out"
    ) {
      return;
    }
    const timer = window.setTimeout(() => {
      void syncNow();
    }, COORDINATOR_PENDING_DRAIN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [enabledDomainCount, pendingTotal, state, syncNow]);

  return {
    state,
    title,
    pageSync,
    databaseSync,
    pagePendingTotal,
    databasePendingTotal,
    pendingTotal,
    failedTotal,
    manualReviewTotal,
    enabledDomainCount,
    lastSyncAt,
    syncNow,
  };
}
