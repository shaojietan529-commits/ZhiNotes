"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ACCOUNT_PROFILE_UPDATED_EVENT } from "@/lib/account/clientProfile";
import { ACCOUNT_SESSION_LAST_AUTHENTICATED_STORAGE_KEY } from "@/lib/account/clientSession";
import {
  drainPendingFileEmbedSyncQueue,
  FILE_EMBED_SYNC_AUTH_RETRY_STORAGE_KEY,
  FILE_EMBED_SYNC_QUEUE_EVENT,
  FILE_EMBED_SYNC_QUEUE_STORAGE_KEY,
  getPendingFileEmbedSyncStatus,
  type DrainFileEmbedSyncQueueResult,
  type PendingFileEmbedSyncStatus,
} from "@/lib/files/fileEmbedSyncQueue";
import { claimVisibleRefreshLease } from "@/lib/sync/visibleRefreshLease";

const FILE_EMBED_STATUS_REFRESH_INTERVAL_MS = 10 * 1000;
const FILE_EMBED_ACCOUNT_RECOVERY_RETRY_LIMIT = 5;
const FILE_EMBED_FOREGROUND_RETRY_LIMIT = 2;
const FILE_EMBED_QUEUE_RETRY_DELAY_MS = 1200;
const FILE_EMBED_AUTO_RETRY_MIN_INTERVAL_MS = 8000;
const FILE_EMBED_AUTO_RETRY_LEASE_KEY =
  "zhinote.fileembedsync.autoRetryLeaderLease.v1";
const FILE_EMBED_AUTO_RETRY_LEASE_TTL_MS = 20 * 1000;

function hasRetryableFileEmbedWork(status: PendingFileEmbedSyncStatus) {
  return status.pending + status.failed > 0;
}

export function useFileEmbedCloudSyncStatus() {
  const [status, setStatus] = useState<PendingFileEmbedSyncStatus>(() =>
    getPendingFileEmbedSyncStatus()
  );
  const autoRetryTimerRef = useRef<number | null>(null);
  const autoRetryRunningRef = useRef(false);
  const lastAutoRetryAtRef = useRef(0);
  const mountedRef = useRef(false);

  const setStatusIfMounted = useCallback(
    (nextStatus: PendingFileEmbedSyncStatus) => {
      if (!mountedRef.current) return;
      setStatus(nextStatus);
    },
    []
  );

  const refresh = useCallback(() => {
    setStatusIfMounted(getPendingFileEmbedSyncStatus());
  }, [setStatusIfMounted]);

  const syncNow = useCallback(
    async (options: {
      includeManualReview?: boolean;
      limit?: number;
    } = {}): Promise<DrainFileEmbedSyncQueueResult> => {
      const result = await drainPendingFileEmbedSyncQueue(options);
      refresh();
      return result;
    },
    [refresh]
  );

  const scheduleAutoRetry = useCallback(
    (
      inputStatus: PendingFileEmbedSyncStatus,
      options: { delayMs?: number; forceAuthRetry?: boolean; limit?: number } = {}
    ) => {
      if (!hasRetryableFileEmbedWork(inputStatus)) return;
      if (inputStatus.authRetryStatus && !options.forceAuthRetry) return;
      if (autoRetryRunningRef.current) return;
      if (
        !claimVisibleRefreshLease(
          FILE_EMBED_AUTO_RETRY_LEASE_KEY,
          FILE_EMBED_AUTO_RETRY_LEASE_TTL_MS
        )
      ) {
        return;
      }
      if (autoRetryTimerRef.current !== null) {
        window.clearTimeout(autoRetryTimerRef.current);
      }
      const elapsedMs = Date.now() - lastAutoRetryAtRef.current;
      const minDelayMs = Math.max(
        FILE_EMBED_AUTO_RETRY_MIN_INTERVAL_MS - elapsedMs,
        0
      );
      const delayMs = Math.max(options.delayMs ?? 0, minDelayMs);
      autoRetryTimerRef.current = window.setTimeout(() => {
        autoRetryTimerRef.current = null;
        if (!mountedRef.current) return;
        const currentStatus = getPendingFileEmbedSyncStatus();
        setStatusIfMounted(currentStatus);
        if (!hasRetryableFileEmbedWork(currentStatus)) return;
        if (currentStatus.authRetryStatus && !options.forceAuthRetry) return;
        if (
          !claimVisibleRefreshLease(
            FILE_EMBED_AUTO_RETRY_LEASE_KEY,
            FILE_EMBED_AUTO_RETRY_LEASE_TTL_MS
          )
        ) {
          return;
        }
        autoRetryRunningRef.current = true;
        lastAutoRetryAtRef.current = Date.now();
        void syncNow({
          includeManualReview: false,
          limit: options.limit ?? FILE_EMBED_FOREGROUND_RETRY_LIMIT,
        })
          .catch(() => {
            setStatusIfMounted(getPendingFileEmbedSyncStatus());
          })
          .finally(() => {
            autoRetryRunningRef.current = false;
            setStatusIfMounted(getPendingFileEmbedSyncStatus());
          });
      }, delayMs);
    },
    [setStatusIfMounted, syncNow]
  );

  useEffect(() => {
    mountedRef.current = true;
    const refreshAndMaybeRetry = () => {
      const nextStatus = getPendingFileEmbedSyncStatus();
      setStatusIfMounted(nextStatus);
      if (!hasRetryableFileEmbedWork(nextStatus)) return;
      scheduleAutoRetry(nextStatus, {
        forceAuthRetry: true,
        limit: FILE_EMBED_ACCOUNT_RECOVERY_RETRY_LIMIT,
      });
    };
    const refreshAndMaybeForegroundRetry = () => {
      const nextStatus = getPendingFileEmbedSyncStatus();
      setStatusIfMounted(nextStatus);
      scheduleAutoRetry(nextStatus, {
        limit: FILE_EMBED_FOREGROUND_RETRY_LIMIT,
      });
    };
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        refreshAndMaybeForegroundRetry();
      }
    }, FILE_EMBED_STATUS_REFRESH_INTERVAL_MS);
    const handleForeground = () => refreshAndMaybeForegroundRetry();
    const handleVisible = () => {
      if (document.visibilityState === "visible") {
        refreshAndMaybeForegroundRetry();
      }
    };
    const handleQueue = (event: Event) => {
      const detail = (event as CustomEvent<PendingFileEmbedSyncStatus>).detail;
      if (detail) {
        setStatusIfMounted(detail);
        scheduleAutoRetry(detail, {
          delayMs: FILE_EMBED_QUEUE_RETRY_DELAY_MS,
          limit: FILE_EMBED_FOREGROUND_RETRY_LIMIT,
        });
        return;
      }
      refreshAndMaybeForegroundRetry();
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === ACCOUNT_SESSION_LAST_AUTHENTICATED_STORAGE_KEY) {
        if (event.newValue) {
          refreshAndMaybeRetry();
        } else {
          refreshAndMaybeForegroundRetry();
        }
        return;
      }
      if (
        event.key !== FILE_EMBED_SYNC_QUEUE_STORAGE_KEY &&
        event.key !== FILE_EMBED_SYNC_AUTH_RETRY_STORAGE_KEY
      ) {
        return;
      }
      refreshAndMaybeForegroundRetry();
    };
    const handleAccountProfileUpdated = () => {
      refreshAndMaybeRetry();
    };
    window.addEventListener("focus", handleForeground);
    window.addEventListener("online", handleForeground);
    window.addEventListener(FILE_EMBED_SYNC_QUEUE_EVENT, handleQueue);
    window.addEventListener("storage", handleStorage);
    window.addEventListener(
      ACCOUNT_PROFILE_UPDATED_EVENT,
      handleAccountProfileUpdated
    );
    document.addEventListener("visibilitychange", handleVisible);
    return () => {
      mountedRef.current = false;
      autoRetryRunningRef.current = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", handleForeground);
      window.removeEventListener("online", handleForeground);
      window.removeEventListener(FILE_EMBED_SYNC_QUEUE_EVENT, handleQueue);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(
        ACCOUNT_PROFILE_UPDATED_EVENT,
        handleAccountProfileUpdated
      );
      document.removeEventListener("visibilitychange", handleVisible);
      if (autoRetryTimerRef.current !== null) {
        window.clearTimeout(autoRetryTimerRef.current);
        autoRetryTimerRef.current = null;
      }
    };
  }, [refresh, scheduleAutoRetry, setStatusIfMounted]);

  return { status, refresh, syncNow };
}
