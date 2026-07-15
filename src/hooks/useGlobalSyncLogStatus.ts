"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getSyncLogSummary,
  SYNC_LOG_STATUS_EVENT,
  SYNC_LOG_STATUS_STORAGE_KEY,
  type SyncLogSummary,
} from "@/lib/db/local/queries";
import { claimVisibleRefreshLease } from "@/lib/sync/visibleRefreshLease";
import { useWorkspaceStore } from "@/stores/workspaceStore";

const GLOBAL_SYNC_LOG_STATUS_REFRESH_INTERVAL_MS = 6 * 1000;
const GLOBAL_SYNC_LOG_STATUS_REFRESH_LEASE_KEY =
  "zhinote.synclog.statusLeaderLease.v1";
const GLOBAL_SYNC_LOG_STATUS_REFRESH_LEASE_TTL_MS = 14 * 1000;
const GLOBAL_SYNC_LOG_STATUS_FAST_REFRESH_DELAYS_MS = [
  250,
  900,
  1_800,
  3_200,
] as const;

export interface GlobalSyncLogStatus {
  enabled: boolean;
  pending: number;
  failed: number;
  inFlight: number;
  manualReviewCount: number;
  lastChangeAt: string | null;
  tableCount: number;
  boundary: {
    reads_sync_log_metadata: true;
    reads_sync_log_payloads: false;
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_comment_bodies: false;
    reads_file_bytes: false;
    uploads_workspace_data: false;
    mutates_sync_log: false;
  };
}

const GLOBAL_SYNC_LOG_STATUS_BOUNDARY: GlobalSyncLogStatus["boundary"] = {
  reads_sync_log_metadata: true,
  reads_sync_log_payloads: false,
  reads_page_body_text: false,
  reads_database_row_values: false,
  reads_comment_bodies: false,
  reads_file_bytes: false,
  uploads_workspace_data: false,
  mutates_sync_log: false,
};

function buildEmptyGlobalSyncLogStatus(enabled = true): GlobalSyncLogStatus {
  return {
    enabled,
    pending: 0,
    failed: 0,
    inFlight: 0,
    manualReviewCount: 0,
    lastChangeAt: null,
    tableCount: 0,
    boundary: GLOBAL_SYNC_LOG_STATUS_BOUNDARY,
  };
}

function summarizeGlobalSyncLogStatus(
  summary: SyncLogSummary,
  enabled = true
): GlobalSyncLogStatus {
  return {
    enabled,
    pending: summary.pending,
    failed: summary.failed,
    inFlight: summary.inFlight,
    manualReviewCount: summary.manualReview,
    lastChangeAt: summary.lastChangeAt,
    tableCount: summary.tables.filter((table) => table.pending > 0).length,
    boundary: GLOBAL_SYNC_LOG_STATUS_BOUNDARY,
  };
}

export function useGlobalSyncLogStatus() {
  const dbReady = useWorkspaceStore((s) => s.dbReady);
  const [status, setStatus] = useState<GlobalSyncLogStatus>(
    buildEmptyGlobalSyncLogStatus(false)
  );
  const lastGoodStatusRef = useRef<GlobalSyncLogStatus>(
    buildEmptyGlobalSyncLogStatus(false)
  );
  const mountedRef = useRef(false);
  const runningRef = useRef(false);
  const rerunAfterCurrentRefreshRef = useRef(false);

  const setStatusIfMounted = useCallback((nextStatus: GlobalSyncLogStatus) => {
    if (!mountedRef.current) return;
    setStatus(nextStatus);
  }, []);

  const refresh = useCallback(async () => {
    if (!dbReady) {
      const disabledStatus = buildEmptyGlobalSyncLogStatus(false);
      lastGoodStatusRef.current = disabledStatus;
      setStatusIfMounted(disabledStatus);
      return;
    }
    if (runningRef.current) {
      rerunAfterCurrentRefreshRef.current = true;
      return;
    }
    runningRef.current = true;
    try {
      const summary = await getSyncLogSummary();
      const nextStatus = summarizeGlobalSyncLogStatus(summary, true);
      lastGoodStatusRef.current = nextStatus;
      setStatusIfMounted(nextStatus);
    } catch {
      const fallbackStatus = lastGoodStatusRef.current.enabled
        ? lastGoodStatusRef.current
        : buildEmptyGlobalSyncLogStatus(true);
      setStatusIfMounted(fallbackStatus);
    } finally {
      runningRef.current = false;
      if (rerunAfterCurrentRefreshRef.current) {
        rerunAfterCurrentRefreshRef.current = false;
        void refresh();
      }
    }
  }, [dbReady, setStatusIfMounted]);

  useEffect(() => {
    mountedRef.current = true;
    if (!dbReady) {
      const disabledStatus = buildEmptyGlobalSyncLogStatus(false);
      lastGoodStatusRef.current = disabledStatus;
      setStatus(disabledStatus);
      return () => {
        mountedRef.current = false;
      };
    }
    let fastRefreshTimers: number[] = [];
    const clearFastRefreshBurst = () => {
      for (const timer of fastRefreshTimers) {
        window.clearTimeout(timer);
      }
      fastRefreshTimers = [];
    };
    const scheduleFastRefreshBurst = () => {
      clearFastRefreshBurst();
      fastRefreshTimers = GLOBAL_SYNC_LOG_STATUS_FAST_REFRESH_DELAYS_MS.map(
        (delay) =>
          window.setTimeout(() => {
            if (
              document.visibilityState === "visible" &&
              claimVisibleRefreshLease(
                GLOBAL_SYNC_LOG_STATUS_REFRESH_LEASE_KEY,
                GLOBAL_SYNC_LOG_STATUS_REFRESH_LEASE_TTL_MS
              )
            ) {
              void refresh();
            }
          }, delay)
      );
    };
    const refreshNowAndThen = () => {
      void refresh();
      scheduleFastRefreshBurst();
    };
    void refresh();
    scheduleFastRefreshBurst();
    const interval = window.setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        claimVisibleRefreshLease(
          GLOBAL_SYNC_LOG_STATUS_REFRESH_LEASE_KEY,
          GLOBAL_SYNC_LOG_STATUS_REFRESH_LEASE_TTL_MS
        )
      ) {
        void refresh();
      }
    }, GLOBAL_SYNC_LOG_STATUS_REFRESH_INTERVAL_MS);
    const handleForeground = () => refreshNowAndThen();
    const handleVisible = () => {
      if (document.visibilityState === "visible") refreshNowAndThen();
    };
    const handleStatus = () => refreshNowAndThen();
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== SYNC_LOG_STATUS_STORAGE_KEY) return;
      refreshNowAndThen();
    };
    window.addEventListener("focus", handleForeground);
    window.addEventListener("online", handleForeground);
    window.addEventListener(SYNC_LOG_STATUS_EVENT, handleStatus);
    window.addEventListener("storage", handleStorage);
    document.addEventListener("visibilitychange", handleVisible);
    return () => {
      mountedRef.current = false;
      clearFastRefreshBurst();
      window.clearInterval(interval);
      window.removeEventListener("focus", handleForeground);
      window.removeEventListener("online", handleForeground);
      window.removeEventListener(SYNC_LOG_STATUS_EVENT, handleStatus);
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisible);
    };
  }, [dbReady, refresh]);

  return { status, refresh };
}
