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
  includeManualReview?: boolean;
}

export type AccountLocalUseReadinessStatus =
  | "ready"
  | "local-only"
  | "checking"
  | "syncing"
  | "pending-upload"
  | "needs-review"
  | "signed-out"
  | "cloud-uncertain";

export interface AccountLocalUseReadiness {
  status: AccountLocalUseReadinessStatus;
  localInputCanContinue: true;
  cloudHandoffReady: boolean;
  cacheRebuildBlocked: boolean;
  label: string;
  detail: string;
  nextAction: string;
  boundary: {
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_file_bytes: false;
    uploads_workspace_data: false;
    mutates_workspace_data: false;
  };
}

const LOCAL_USE_READINESS_BOUNDARY: AccountLocalUseReadiness["boundary"] = {
  reads_page_body_text: false,
  reads_database_row_values: false,
  reads_file_bytes: false,
  uploads_workspace_data: false,
  mutates_workspace_data: false,
};

function formatLastSyncTime(value: string | null) {
  if (!value) return null;
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return null;
  return timestamp.toLocaleTimeString("zh-CN");
}

export function buildAccountLocalUseReadiness(input: {
  state: AccountCloudSyncCoordinatorState;
  pendingTotal: number;
  failedTotal: number;
  manualReviewTotal: number;
  retryableFailedTotal: number;
  enabledDomainCount: number;
}): AccountLocalUseReadiness {
  const base = {
    localInputCanContinue: true,
    boundary: LOCAL_USE_READINESS_BOUNDARY,
  } as const;

  if (input.failedTotal > 0 || input.manualReviewTotal > 0) {
    const failedPart =
      input.retryableFailedTotal > 0
        ? `${input.retryableFailedTotal} 项可重试失败`
        : null;
    const manualPart =
      input.manualReviewTotal > 0
        ? `${input.manualReviewTotal} 项需要人工确认`
        : null;
    const detail = [failedPart, manualPart].filter(Boolean).join("，");
    return {
      ...base,
      status: "needs-review",
      cloudHandoffReady: false,
      cacheRebuildBlocked: true,
      label: "可继续写作，先处理同步队列",
      detail: detail || "同步队列需要处理；本地输入仍保留。",
      nextAction:
        "打开同步中心处理 failed / manual review，清零前不要重建本地缓存或做云端交接。",
    };
  }

  if (input.pendingTotal > 0) {
    return {
      ...base,
      status: "pending-upload",
      cloudHandoffReady: false,
      cacheRebuildBlocked: true,
      label: "可继续写作，等待上传",
      detail: `${input.pendingTotal} 项本地变更已保留，正在等待后台上传或手动同步。`,
      nextAction:
        "继续写作可以；重建本地缓存或切换云端主库前，先让 pending 队列清零。",
    };
  }

  if (input.state === "signed-out") {
    return {
      ...base,
      status: "signed-out",
      cloudHandoffReady: false,
      cacheRebuildBlocked: true,
      label: "可继续本地写作，登录后同步",
      detail: "当前无法确认账号；本地输入不会因此被清空。",
      nextAction: "登录后再上传本地队列或执行云端缓存重建。",
    };
  }

  if (input.state === "error") {
    return {
      ...base,
      status: "cloud-uncertain",
      cloudHandoffReady: false,
      cacheRebuildBlocked: true,
      label: "可继续写作，云端暂不可确认",
      detail: "账号或网络暂时不可确认；本地输入已保留，稍后重试。",
      nextAction: "先继续本地使用；等云端状态恢复后再做同步交接或缓存重建。",
    };
  }

  if (input.state === "checking") {
    return {
      ...base,
      status: "checking",
      cloudHandoffReady: false,
      cacheRebuildBlocked: true,
      label: "可继续写作，正在检查同步状态",
      detail: "同步域已开启但仍在检查；不要在检查完成前重建本地缓存。",
      nextAction: "等待检查完成，或打开同步中心查看详情。",
    };
  }

  if (input.state === "syncing") {
    return {
      ...base,
      status: "syncing",
      cloudHandoffReady: false,
      cacheRebuildBlocked: true,
      label: "可继续写作，正在同步",
      detail: "后台正在补传本地队列；输入仍然本地优先保存。",
      nextAction: "等待同步完成后再做缓存重建或云端交接。",
    };
  }

  if (input.enabledDomainCount === 0 || input.state === "disabled") {
    return {
      ...base,
      status: "local-only",
      cloudHandoffReady: false,
      cacheRebuildBlocked: false,
      label: "可本地使用，云同步未开启",
      detail: "当前内容按本地优先方式使用；云端不会自动接管。",
      nextAction: "需要多端同步时，先在账号页开启对应同步域。",
    };
  }

  return {
    ...base,
    status: "ready",
    cloudHandoffReady: true,
    cacheRebuildBlocked: false,
    label: "可继续写作，云端交接已就绪",
    detail: "当前没有 pending、failed 或 manual review 队列。",
    nextAction: "可以继续本地使用；如需重建缓存，仍按账号页确认流程执行。",
  };
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
    syncNow,
  };
}
