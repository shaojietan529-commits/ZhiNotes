"use client";

// Coordinates the domain sync hooks into one account-level signal. The page
// and database hooks still own their own queues, leases, and API calls; this
// layer gives the shell a single "is my work safely synced?" status and a
// coalesced quick-sync trigger for future modules to join.

import { useCallback, useEffect, useMemo } from "react";
import { useDatabaseCloudSync } from "@/hooks/useDatabaseCloudSync";
import { useKnowledgeCloudSyncStatus } from "@/hooks/useKnowledgeCloudSyncStatus";
import { usePageCloudSync } from "@/hooks/usePageCloudSync";
import { useSettingsCloudSyncStatus } from "@/hooks/useSettingsCloudSyncStatus";

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
  const settingsSync = useSettingsCloudSyncStatus();
  const knowledgeSync = useKnowledgeCloudSyncStatus();

  const pageSyncNow = pageSync.syncNow;
  const databaseSyncNow = databaseSync.syncNow;
  const refreshSettingsSyncStatus = settingsSync.refresh;
  const refreshKnowledgeSyncStatus = knowledgeSync.refresh;
  const syncNow = useCallback(
    async (options: AccountCloudSyncCoordinatorOptions = {}) => {
      await Promise.allSettled([
        pageSyncNow({ quick: true, forceLease: options.forceLease }),
        databaseSyncNow({ quick: true, forceLease: options.forceLease }),
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
  const pendingTotal =
    pagePendingTotal +
    databasePendingTotal +
    settingsPendingTotal +
    knowledgePendingTotal;
  const failedTotal =
    pageSync.pendingStatus.failed +
    databaseSync.pendingStatus.failed +
    settingsSync.status.failed +
    knowledgeSync.status.failed;
  const manualReviewTotal =
    pageSync.pendingStatus.manualReviewCount +
    databaseSync.pendingStatus.manualReviewCount +
    settingsSync.status.manualReviewCount +
    knowledgeSync.status.manualReviewCount;
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
    (knowledgeVisibleSyncWork ? 1 : 0);
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
      failedTotal > 0 ? `${failedTotal} 项待重试` : null,
      manualReviewTotal > 0 ? `${manualReviewTotal} 项需要人工确认` : null,
      pagePendingTotal > 0 ? `页面 ${pagePendingTotal}` : null,
      databasePendingTotal > 0 ? `数据库 ${databasePendingTotal}` : null,
      settingsPendingTotal > 0
        ? `设置 ${settingsPendingTotal}（同步中心处理）`
        : null,
      knowledgePendingTotal > 0
        ? `知识库附属 ${knowledgePendingTotal}（评论/版本/链接待云端回放）`
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
    failedTotal,
    knowledgePendingTotal,
    lastSyncAt,
    manualReviewTotal,
    pagePendingTotal,
    pendingTotal,
    settingsPendingTotal,
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
    settingsPendingTotal,
    knowledgePendingTotal,
    pendingTotal,
    failedTotal,
    manualReviewTotal,
    enabledDomainCount,
    lastSyncAt,
    knowledgeSync,
    settingsSync,
    syncNow,
  };
}
