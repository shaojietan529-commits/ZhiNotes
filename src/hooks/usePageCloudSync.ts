"use client";

// Runs account page cloud sync in the background while the app is open:
// once on load, then on a fixed interval, plus manual triggers. Stays
// completely inert until the owner enables the toggle on /account.

import { useCallback, useEffect, useRef, useState } from "react";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { usePages } from "@/hooks/usePages";
import {
  isPageSyncEnabled,
  reconcilePageSync,
  getLastPageSyncAt,
  PAGE_SYNC_CONFIG_EVENT,
} from "@/lib/pages/accountPageSync";

const SYNC_INTERVAL_MS = 60 * 1000;

export type PageCloudSyncState =
  | "disabled"
  | "syncing"
  | "synced"
  | "signed-out"
  | "error";

export function usePageCloudSync() {
  const dbReady = useWorkspaceStore((s) => s.dbReady);
  const { refresh } = usePages();
  // Start as "disabled" on both server and client so SSR hydration matches;
  // the first effect run flips it based on the real localStorage flag.
  const [state, setState] = useState<PageCloudSyncState>("disabled");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const runningRef = useRef(false);

  const runSync = useCallback(async () => {
    if (!isPageSyncEnabled()) {
      setState("disabled");
      return;
    }
    if (runningRef.current) return;
    runningRef.current = true;
    setState("syncing");
    try {
      const result = await reconcilePageSync();
      if (result.status === "ok") {
        setState("synced");
        setLastSyncAt(getLastPageSyncAt());
        if (result.pulled > 0) {
          await refresh();
        }
      } else if (
        result.status === "unauthenticated" ||
        result.status === "unconfigured"
      ) {
        setState("signed-out");
      } else if (result.status === "disabled") {
        setState("disabled");
      } else {
        setState("error");
      }
    } finally {
      runningRef.current = false;
    }
  }, [refresh]);

  useEffect(() => {
    if (!dbReady) return;
    void runSync();
    const interval = window.setInterval(() => void runSync(), SYNC_INTERVAL_MS);
    const handleConfig = () => void runSync();
    window.addEventListener(PAGE_SYNC_CONFIG_EVENT, handleConfig);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener(PAGE_SYNC_CONFIG_EVENT, handleConfig);
    };
  }, [dbReady, runSync]);

  return { state, lastSyncAt, syncNow: runSync };
}
