"use client";

import { useCallback, useEffect, useState } from "react";
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

const FILE_EMBED_STATUS_REFRESH_INTERVAL_MS = 10 * 1000;
const FILE_EMBED_ACCOUNT_RECOVERY_RETRY_LIMIT = 5;

function hasRetryableFileEmbedWork(status: PendingFileEmbedSyncStatus) {
  return status.pending + status.failed > 0;
}

export function useFileEmbedCloudSyncStatus() {
  const [status, setStatus] = useState<PendingFileEmbedSyncStatus>(() =>
    getPendingFileEmbedSyncStatus()
  );

  const refresh = useCallback(() => {
    setStatus(getPendingFileEmbedSyncStatus());
  }, []);

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

  useEffect(() => {
    const refreshAndMaybeRetry = () => {
      const nextStatus = getPendingFileEmbedSyncStatus();
      setStatus(nextStatus);
      if (!hasRetryableFileEmbedWork(nextStatus)) return;
      void syncNow({ limit: FILE_EMBED_ACCOUNT_RECOVERY_RETRY_LIMIT });
    };
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, FILE_EMBED_STATUS_REFRESH_INTERVAL_MS);
    const handleForeground = () => refresh();
    const handleVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const handleQueue = (event: Event) => {
      const detail = (event as CustomEvent<PendingFileEmbedSyncStatus>).detail;
      if (detail) {
        setStatus(detail);
        return;
      }
      refresh();
    };
    const handleStorage = (event: StorageEvent) => {
      if (
        event.key === ACCOUNT_SESSION_LAST_AUTHENTICATED_STORAGE_KEY &&
        event.newValue
      ) {
        refreshAndMaybeRetry();
        return;
      }
      if (
        event.key !== FILE_EMBED_SYNC_QUEUE_STORAGE_KEY &&
        event.key !== FILE_EMBED_SYNC_AUTH_RETRY_STORAGE_KEY
      ) {
        return;
      }
      refresh();
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
    };
  }, [refresh, syncNow]);

  return { status, refresh, syncNow };
}
