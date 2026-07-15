"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getPendingKnowledgeSyncLogEntries } from "@/lib/db/local/queries";
import {
  buildEmptyKnowledgeCloudSyncStatus,
  KNOWLEDGE_SYNC_STATUS_EVENT,
  KNOWLEDGE_SYNC_STATUS_STORAGE_KEY,
  summarizeKnowledgeCloudSyncStatus,
  type KnowledgeCloudSyncStatus,
} from "@/lib/sync/knowledgeSyncStatus";
import { claimVisibleRefreshLease } from "@/lib/sync/visibleRefreshLease";
import { useWorkspaceStore } from "@/stores/workspaceStore";

const KNOWLEDGE_STATUS_REFRESH_INTERVAL_MS = 6 * 1000;
const KNOWLEDGE_STATUS_REFRESH_LEASE_KEY =
  "zhinote.knowledgesync.statusLeaderLease.v1";
const KNOWLEDGE_STATUS_REFRESH_LEASE_TTL_MS = 14 * 1000;

export function useKnowledgeCloudSyncStatus() {
  const dbReady = useWorkspaceStore((s) => s.dbReady);
  const [status, setStatus] = useState<KnowledgeCloudSyncStatus>(
    buildEmptyKnowledgeCloudSyncStatus(false)
  );
  const lastGoodStatusRef = useRef<KnowledgeCloudSyncStatus>(
    buildEmptyKnowledgeCloudSyncStatus(false)
  );
  const mountedRef = useRef(false);
  const runningRef = useRef(false);
  const rerunAfterCurrentRefreshRef = useRef(false);

  const setStatusIfMounted = useCallback(
    (nextStatus: KnowledgeCloudSyncStatus) => {
      if (!mountedRef.current) return;
      setStatus(nextStatus);
    },
    []
  );

  const refresh = useCallback(async () => {
    if (!dbReady) {
      const disabledStatus = buildEmptyKnowledgeCloudSyncStatus(false);
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
      const entries = await getPendingKnowledgeSyncLogEntries();
      const nextStatus = summarizeKnowledgeCloudSyncStatus(entries, true);
      lastGoodStatusRef.current = nextStatus;
      setStatusIfMounted(nextStatus);
    } catch {
      const fallbackStatus = lastGoodStatusRef.current.enabled
        ? lastGoodStatusRef.current
        : buildEmptyKnowledgeCloudSyncStatus(true);
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
      const disabledStatus = buildEmptyKnowledgeCloudSyncStatus(false);
      lastGoodStatusRef.current = disabledStatus;
      setStatus(disabledStatus);
      return () => {
        mountedRef.current = false;
      };
    }
    void refresh();
    const interval = window.setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        claimVisibleRefreshLease(
          KNOWLEDGE_STATUS_REFRESH_LEASE_KEY,
          KNOWLEDGE_STATUS_REFRESH_LEASE_TTL_MS
        )
      ) {
        void refresh();
      }
    }, KNOWLEDGE_STATUS_REFRESH_INTERVAL_MS);
    const handleForeground = () => void refresh();
    const handleVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const handleStatus = (event: Event) => {
      const detail = (event as CustomEvent<KnowledgeCloudSyncStatus | undefined>)
        .detail;
      if (detail) {
        lastGoodStatusRef.current = detail;
        setStatusIfMounted(detail);
        return;
      }
      void refresh();
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== KNOWLEDGE_SYNC_STATUS_STORAGE_KEY) return;
      void refresh();
    };
    window.addEventListener("focus", handleForeground);
    window.addEventListener("online", handleForeground);
    window.addEventListener(KNOWLEDGE_SYNC_STATUS_EVENT, handleStatus);
    window.addEventListener("storage", handleStorage);
    document.addEventListener("visibilitychange", handleVisible);
    return () => {
      mountedRef.current = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", handleForeground);
      window.removeEventListener("online", handleForeground);
      window.removeEventListener(KNOWLEDGE_SYNC_STATUS_EVENT, handleStatus);
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisible);
    };
  }, [dbReady, refresh, setStatusIfMounted]);

  return { status, refresh };
}
