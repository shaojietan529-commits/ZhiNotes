"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getPendingKnowledgeSyncLogEntries } from "@/lib/db/local/queries";
import {
  buildEmptyKnowledgeCloudSyncStatus,
  KNOWLEDGE_SYNC_STATUS_EVENT,
  summarizeKnowledgeCloudSyncStatus,
  type KnowledgeCloudSyncStatus,
} from "@/lib/sync/knowledgeSyncStatus";
import { useWorkspaceStore } from "@/stores/workspaceStore";

const KNOWLEDGE_STATUS_REFRESH_INTERVAL_MS = 6 * 1000;

export function useKnowledgeCloudSyncStatus() {
  const dbReady = useWorkspaceStore((s) => s.dbReady);
  const [status, setStatus] = useState<KnowledgeCloudSyncStatus>(
    buildEmptyKnowledgeCloudSyncStatus(false)
  );
  const runningRef = useRef(false);
  const rerunAfterCurrentRefreshRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!dbReady) {
      setStatus(buildEmptyKnowledgeCloudSyncStatus(false));
      return;
    }
    if (runningRef.current) {
      rerunAfterCurrentRefreshRef.current = true;
      return;
    }
    runningRef.current = true;
    try {
      const entries = await getPendingKnowledgeSyncLogEntries();
      setStatus(summarizeKnowledgeCloudSyncStatus(entries, true));
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
      setStatus(buildEmptyKnowledgeCloudSyncStatus(false));
      return;
    }
    void refresh();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, KNOWLEDGE_STATUS_REFRESH_INTERVAL_MS);
    const handleForeground = () => void refresh();
    const handleVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const handleStatus = (event: Event) => {
      const detail = (event as CustomEvent<KnowledgeCloudSyncStatus | undefined>)
        .detail;
      if (detail) {
        setStatus(detail);
        return;
      }
      void refresh();
    };
    window.addEventListener("focus", handleForeground);
    window.addEventListener("online", handleForeground);
    window.addEventListener(KNOWLEDGE_SYNC_STATUS_EVENT, handleStatus);
    document.addEventListener("visibilitychange", handleVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleForeground);
      window.removeEventListener("online", handleForeground);
      window.removeEventListener(KNOWLEDGE_SYNC_STATUS_EVENT, handleStatus);
      document.removeEventListener("visibilitychange", handleVisible);
    };
  }, [dbReady, refresh]);

  return { status, refresh };
}
