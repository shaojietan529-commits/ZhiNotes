"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ACCOUNT_PROFILE_UPDATED_EVENT } from "@/lib/account/clientProfile";
import { ACCOUNT_SESSION_CHANGED_EVENT, isAccountSessionStorageKey } from "@/lib/account/clientSession";
import { getPortfolioStorageScope, hydratePortfolioStorage, isPortfolioStorageReady, subscribePortfolioStorage } from "@/lib/portfolio/portfolioStorageScope";
import {
  drainPendingPortfolioCloudSync,
  getPendingPortfolioCloudSyncStatus,
  PORTFOLIO_SYNC_STATUS_EVENT,
  PORTFOLIO_SYNC_STATUS_PING_STORAGE_KEY,
  type DrainPortfolioCloudSyncResult,
  type PortfolioCloudSyncStatus,
} from "@/lib/portfolio/portfolioSyncStatus";
import { claimVisibleRefreshLease } from "@/lib/sync/visibleRefreshLease";

const PORTFOLIO_STATUS_REFRESH_INTERVAL_MS = 8 * 1000;
const PORTFOLIO_AUTO_RETRY_DELAY_MS = 1_500;
const PORTFOLIO_AUTO_RETRY_MIN_INTERVAL_MS = 8_000;
const PORTFOLIO_AUTO_RETRY_LEASE_KEY =
  "zhinote.portfoliosync.autoRetryLeaderLease.v1";
const PORTFOLIO_AUTO_RETRY_LEASE_TTL_MS = 20 * 1000;

function hasRetryablePortfolioWork(status: PortfolioCloudSyncStatus) {
  return (
    status.mode !== null &&
    status.manualReviewCount === 0 &&
    (status.pending > 0 || status.failed > 0)
  );
}

export function usePortfolioCloudSyncStatus() {
  const [status, setStatus] = useState<PortfolioCloudSyncStatus>(() =>
    getPendingPortfolioCloudSyncStatus()
  );
  const mountedRef = useRef(false);
  const autoRetryTimerRef = useRef<number | null>(null);
  const autoRetryRunningRef = useRef(false);
  const lastAutoRetryAtRef = useRef(0);

  const setStatusIfMounted = useCallback(
    (nextStatus: PortfolioCloudSyncStatus) => {
      if (!mountedRef.current) return;
      setStatus(nextStatus);
    },
    []
  );

  const refresh = useCallback(() => {
    setStatusIfMounted(getPendingPortfolioCloudSyncStatus());
  }, [setStatusIfMounted]);

  const syncNow = useCallback(async (): Promise<DrainPortfolioCloudSyncResult> => {
    const result = await drainPendingPortfolioCloudSync();
    refresh();
    return result;
  }, [refresh]);

  const scheduleAutoRetry = useCallback(
    (inputStatus: PortfolioCloudSyncStatus, delayMs = 0) => {
      if (!hasRetryablePortfolioWork(inputStatus)) return;
      if (inputStatus.authRetryStatus && inputStatus.authRetryUntil) {
        const retryAt = new Date(inputStatus.authRetryUntil).getTime();
        if (Number.isFinite(retryAt) && retryAt > Date.now()) return;
      }
      if (autoRetryRunningRef.current) return;
      if (
        !claimVisibleRefreshLease(
          PORTFOLIO_AUTO_RETRY_LEASE_KEY,
          PORTFOLIO_AUTO_RETRY_LEASE_TTL_MS
        )
      ) {
        return;
      }
      if (autoRetryTimerRef.current !== null) {
        window.clearTimeout(autoRetryTimerRef.current);
      }
      const elapsedMs = Date.now() - lastAutoRetryAtRef.current;
      const minDelayMs = Math.max(
        PORTFOLIO_AUTO_RETRY_MIN_INTERVAL_MS - elapsedMs,
        0
      );
      autoRetryTimerRef.current = window.setTimeout(() => {
        autoRetryTimerRef.current = null;
        if (!mountedRef.current) return;
        const nextStatus = getPendingPortfolioCloudSyncStatus();
        setStatusIfMounted(nextStatus);
        if (!hasRetryablePortfolioWork(nextStatus)) return;
        autoRetryRunningRef.current = true;
        lastAutoRetryAtRef.current = Date.now();
        void syncNow()
          .catch(() => {
            setStatusIfMounted(getPendingPortfolioCloudSyncStatus());
          })
          .finally(() => {
            autoRetryRunningRef.current = false;
            setStatusIfMounted(getPendingPortfolioCloudSyncStatus());
          });
      }, Math.max(delayMs, minDelayMs));
    },
    [setStatusIfMounted, syncNow]
  );

  useEffect(() => {
    mountedRef.current = true;
    let disposed = false;
    let subscribedScope: string | null = null;
    let unsubscribeStorage: (() => void) | undefined;
    const refreshAndMaybeRetry = () => {
      if (disposed) return;
      try {
        const scope = getPortfolioStorageScope();
        if (subscribedScope !== scope) {
          unsubscribeStorage?.();
          subscribedScope = scope;
          unsubscribeStorage = subscribePortfolioStorage(scope, refreshAndMaybeRetry);
          void hydratePortfolioStorage(scope).then(refreshAndMaybeRetry).catch(() => refresh());
        }
        if (!isPortfolioStorageReady(scope)) return;
      } catch { refresh(); return; }
      const nextStatus = getPendingPortfolioCloudSyncStatus();
      setStatusIfMounted(nextStatus);
      scheduleAutoRetry(nextStatus, PORTFOLIO_AUTO_RETRY_DELAY_MS);
    };
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") refreshAndMaybeRetry();
    }, PORTFOLIO_STATUS_REFRESH_INTERVAL_MS);
    const handleForeground = () => refreshAndMaybeRetry();
    const handleVisible = () => {
      if (document.visibilityState === "visible") refreshAndMaybeRetry();
    };
    // A notification may belong to the previous account. Always read the
    // currently selected account's status rather than applying event data.
    const handleStatus = () => refreshAndMaybeRetry();
    const handleStorage = (event: StorageEvent) => {
      if (isAccountSessionStorageKey(event.key) || event.key === null) {
        refreshAndMaybeRetry();
        return;
      }
      if (event.key === PORTFOLIO_SYNC_STATUS_PING_STORAGE_KEY) {
        try { void hydratePortfolioStorage().then(refreshAndMaybeRetry).catch(refresh); } catch { refresh(); }
      }
    };
    const handleAccountProfileUpdated = () => refreshAndMaybeRetry();
    refreshAndMaybeRetry();
    window.addEventListener("focus", handleForeground);
    window.addEventListener("online", handleForeground);
    window.addEventListener(PORTFOLIO_SYNC_STATUS_EVENT, handleStatus);
    window.addEventListener(ACCOUNT_SESSION_CHANGED_EVENT, handleStatus);
    window.addEventListener("storage", handleStorage);
    window.addEventListener(
      ACCOUNT_PROFILE_UPDATED_EVENT,
      handleAccountProfileUpdated
    );
    document.addEventListener("visibilitychange", handleVisible);
    return () => {
      disposed = true;
      mountedRef.current = false;
      unsubscribeStorage?.();
      autoRetryRunningRef.current = false;
      window.clearInterval(interval);
      if (autoRetryTimerRef.current !== null) {
        window.clearTimeout(autoRetryTimerRef.current);
        autoRetryTimerRef.current = null;
      }
      window.removeEventListener("focus", handleForeground);
      window.removeEventListener("online", handleForeground);
      window.removeEventListener(PORTFOLIO_SYNC_STATUS_EVENT, handleStatus);
      window.removeEventListener(ACCOUNT_SESSION_CHANGED_EVENT, handleStatus);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(
        ACCOUNT_PROFILE_UPDATED_EVENT,
        handleAccountProfileUpdated
      );
      document.removeEventListener("visibilitychange", handleVisible);
    };
  }, [refresh, scheduleAutoRetry, setStatusIfMounted]);

  return { status, refresh, syncNow };
}
