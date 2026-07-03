"use client";

import { useCallback, useEffect, useState } from "react";
import {
  drainPendingFileEmbedSyncQueue,
  FILE_EMBED_SYNC_QUEUE_EVENT,
  FILE_EMBED_SYNC_QUEUE_STORAGE_KEY,
  getPendingFileEmbedSyncStatus,
  type DrainFileEmbedSyncQueueResult,
  type PendingFileEmbedSyncStatus,
} from "@/lib/files/fileEmbedSyncQueue";

const FILE_EMBED_STATUS_REFRESH_INTERVAL_MS = 10 * 1000;

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
      if (event.key !== FILE_EMBED_SYNC_QUEUE_STORAGE_KEY) return;
      refresh();
    };
    window.addEventListener("focus", handleForeground);
    window.addEventListener("online", handleForeground);
    window.addEventListener(FILE_EMBED_SYNC_QUEUE_EVENT, handleQueue);
    window.addEventListener("storage", handleStorage);
    document.addEventListener("visibilitychange", handleVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleForeground);
      window.removeEventListener("online", handleForeground);
      window.removeEventListener(FILE_EMBED_SYNC_QUEUE_EVENT, handleQueue);
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisible);
    };
  }, [refresh]);

  return { status, refresh, syncNow };
}
