"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getPendingAccountModuleSettingSyncLogEntries,
  getPendingWorkspaceSettingSyncLogEntries,
} from "@/lib/db/local/queries";
import {
  buildEmptySettingsCloudSyncStatus,
  SETTINGS_SYNC_STATUS_EVENT,
  SETTINGS_SYNC_STATUS_STORAGE_KEY,
  summarizeSettingsCloudSyncStatus,
  type SettingsCloudSyncStatus,
} from "@/lib/sync/settingsSyncStatus";
import { claimVisibleRefreshLease } from "@/lib/sync/visibleRefreshLease";
import { useWorkspaceStore } from "@/stores/workspaceStore";

const SETTINGS_STATUS_REFRESH_INTERVAL_MS = 6 * 1000;
const SETTINGS_STATUS_REFRESH_LEASE_KEY =
  "zhinote.settingssync.statusLeaderLease.v1";
const SETTINGS_STATUS_REFRESH_LEASE_TTL_MS = 14 * 1000;

export function useSettingsCloudSyncStatus() {
  const dbReady = useWorkspaceStore((s) => s.dbReady);
  const [status, setStatus] = useState<SettingsCloudSyncStatus>(
    buildEmptySettingsCloudSyncStatus(false)
  );
  const runningRef = useRef(false);
  const rerunAfterCurrentRefreshRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!dbReady) {
      setStatus(buildEmptySettingsCloudSyncStatus(false));
      return;
    }
    if (runningRef.current) {
      rerunAfterCurrentRefreshRef.current = true;
      return;
    }
    runningRef.current = true;
    try {
      const [workspaceEntries, accountModuleEntries] = await Promise.all([
        getPendingWorkspaceSettingSyncLogEntries(),
        getPendingAccountModuleSettingSyncLogEntries(),
      ]);
      setStatus(
        summarizeSettingsCloudSyncStatus(
          [...workspaceEntries, ...accountModuleEntries],
          true
        )
      );
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
      setStatus(buildEmptySettingsCloudSyncStatus(false));
      return;
    }
    void refresh();
    const interval = window.setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        claimVisibleRefreshLease(
          SETTINGS_STATUS_REFRESH_LEASE_KEY,
          SETTINGS_STATUS_REFRESH_LEASE_TTL_MS
        )
      ) {
        void refresh();
      }
    }, SETTINGS_STATUS_REFRESH_INTERVAL_MS);
    const handleForeground = () => void refresh();
    const handleVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const handleStatus = (event: Event) => {
      const detail = (event as CustomEvent<SettingsCloudSyncStatus | undefined>)
        .detail;
      if (detail) {
        setStatus(detail);
        return;
      }
      void refresh();
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== SETTINGS_SYNC_STATUS_STORAGE_KEY) return;
      void refresh();
    };
    window.addEventListener("focus", handleForeground);
    window.addEventListener("online", handleForeground);
    window.addEventListener(SETTINGS_SYNC_STATUS_EVENT, handleStatus);
    window.addEventListener("storage", handleStorage);
    document.addEventListener("visibilitychange", handleVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleForeground);
      window.removeEventListener("online", handleForeground);
      window.removeEventListener(SETTINGS_SYNC_STATUS_EVENT, handleStatus);
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisible);
    };
  }, [dbReady, refresh]);

  return { status, refresh };
}
