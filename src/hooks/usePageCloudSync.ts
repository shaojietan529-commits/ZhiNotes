"use client";

// Runs account page cloud sync in the background while the app is open so
// both domains stay in step in near-real-time: on load, on a short interval,
// whenever the tab regains focus/visibility, after local edits settle, and
// on manual triggers. Still does nothing unless signed in to the account.

import { useCallback, useEffect, useRef, useState } from "react";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { usePages } from "@/hooks/usePages";
import {
  isPageSyncEnabled,
  reconcilePageSync,
  getLastPageSyncAt,
  PAGE_SYNC_CONFIG_EVENT,
} from "@/lib/pages/accountPageSync";

// Background heartbeat. Short enough to feel live, long enough to stay well
// within KV rate limits. Focus/visibility/edit triggers cover the rest.
const SYNC_INTERVAL_MS = 12 * 1000;
// Debounce after a local page change before pushing, so a burst of edits
// (typing, drag) collapses into one sync.
const EDIT_DEBOUNCE_MS = 4 * 1000;

export type PageCloudSyncState =
  | "disabled"
  | "syncing"
  | "synced"
  | "signed-out"
  | "error";

export function usePageCloudSync() {
  const dbReady = useWorkspaceStore((s) => s.dbReady);
  const pages = useWorkspaceStore((s) => s.pages);
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
    // Only poll while the tab is visible; returning to a hidden tab re-syncs
    // via the visibility/focus handlers below, so background tabs stay quiet.
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void runSync();
    }, SYNC_INTERVAL_MS);
    const handleConfig = () => void runSync();
    // Switching back to a tab (the user's two-domain workflow) pulls the
    // latest immediately, so edits made on the other domain show up at once.
    const handleVisible = () => {
      if (document.visibilityState === "visible") void runSync();
    };
    window.addEventListener(PAGE_SYNC_CONFIG_EVENT, handleConfig);
    window.addEventListener("focus", handleConfig);
    window.addEventListener("online", handleConfig);
    document.addEventListener("visibilitychange", handleVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener(PAGE_SYNC_CONFIG_EVENT, handleConfig);
      window.removeEventListener("focus", handleConfig);
      window.removeEventListener("online", handleConfig);
      document.removeEventListener("visibilitychange", handleVisible);
    };
  }, [dbReady, runSync]);

  // Push local edits up shortly after they settle. Reconcile is idempotent
  // (no diff → no network write), and the pull→refresh path converges, so
  // this debounced trigger cannot loop.
  const firstEditRun = useRef(true);
  useEffect(() => {
    if (!dbReady) return;
    if (firstEditRun.current) {
      firstEditRun.current = false;
      return;
    }
    const timer = window.setTimeout(() => void runSync(), EDIT_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [pages, dbReady, runSync]);

  return { state, lastSyncAt, syncNow: runSync };
}
