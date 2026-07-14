"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getSyncLogSummary,
  SYNC_LOG_STATUS_EVENT,
  SYNC_LOG_STATUS_STORAGE_KEY,
  type SyncLogSummary,
} from "@/lib/db/local/queries";
import { useWorkspaceStore } from "@/stores/workspaceStore";

const GLOBAL_SYNC_LOG_STATUS_REFRESH_INTERVAL_MS = 6 * 1000;
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
  const runningRef = useRef(false);
  const rerunAfterCurrentRefreshRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!dbReady) {
      setStatus(buildEmptyGlobalSyncLogStatus(false));
      return;
    }
    if (runningRef.current) {
      rerunAfterCurrentRefreshRef.current = true;
      return;
    }
    runningRef.current = true;
    try {
      const summary = await getSyncLogSummary();
      setStatus(summarizeGlobalSyncLogStatus(summary, true));
    } finally {
      runningRef.current = false;
      if (rerunAfterCurrentRefreshRef.current) {
        rerunAfterCurrentRefreshRef.current = false;
        void refresh();
      }
    }
  }, [dbReady]);

  useEffect(() => {
    if (!dbReady) {
      setStatus(buildEmptyGlobalSyncLogStatus(false));
      return;
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
            if (document.visibilityState === "visible") void refresh();
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
      if (document.visibilityState === "visible") void refresh();
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
