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
import { getPageUpdateClientId } from "@/lib/pages/pageUpdateBus";

// Background heartbeat. Short enough to feel live, long enough to stay well
// within KV rate limits because only one visible tab holds the sync lease.
const SYNC_INTERVAL_MS = 8 * 1000;
// Debounce after a local page change before pushing, so a burst of edits
// (typing, drag) collapses into one sync.
const EDIT_DEBOUNCE_MS = 4 * 1000;
const LEASE_KEY = "zhinote.pagesync.leaderLease.v1";
const LEASE_TTL_MS = 18 * 1000;

export type PageCloudSyncState =
  | "disabled"
  | "syncing"
  | "synced"
  | "signed-out"
  | "error";

function claimSyncLease(force = false): boolean {
  if (typeof window === "undefined") return false;
  const now = Date.now();
  const owner = getPageUpdateClientId();
  if (!force) {
    try {
      const raw = window.localStorage.getItem(LEASE_KEY);
      const lease = raw ? (JSON.parse(raw) as { owner?: string; until?: number }) : null;
      if (
        lease?.owner &&
        lease.owner !== owner &&
        typeof lease.until === "number" &&
        lease.until > now
      ) {
        return false;
      }
    } catch {
      // Bad lease data should not block sync.
    }
  }
  const nextLease = JSON.stringify({ owner, until: now + LEASE_TTL_MS });
  window.localStorage.setItem(LEASE_KEY, nextLease);
  try {
    const confirmed = JSON.parse(
      window.localStorage.getItem(LEASE_KEY) ?? "{}"
    ) as { owner?: string };
    return confirmed.owner === owner;
  } catch {
    return true;
  }
}

export function usePageCloudSync() {
  const dbReady = useWorkspaceStore((s) => s.dbReady);
  const pages = useWorkspaceStore((s) => s.pages);
  const { refresh } = usePages();
  // Start as "disabled" on both server and client so SSR hydration matches;
  // the first effect run flips it based on the real localStorage flag.
  const [state, setState] = useState<PageCloudSyncState>("disabled");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const runningRef = useRef(false);
  const initialSyncDoneRef = useRef(false);

  const runSync = useCallback(async (options: { quick?: boolean; forceLease?: boolean } = {}) => {
    if (!isPageSyncEnabled()) {
      setState("disabled");
      return;
    }
    if (!claimSyncLease(options.forceLease)) {
      const last = getLastPageSyncAt();
      if (last) {
        setState("synced");
        setLastSyncAt(last);
      }
      return;
    }
    if (runningRef.current) return;
    runningRef.current = true;
    setState("syncing");
    try {
      const result = await reconcilePageSync({ quick: options.quick });
      if (result.status === "ok") {
        initialSyncDoneRef.current = true;
        setState("synced");
        setLastSyncAt(getLastPageSyncAt());
        if (result.pulled > 0 || (result.repaired ?? 0) > 0) {
          await refresh({ reason: "cloud-pull" });
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
    void runSync({ quick: false });
    // Only poll while the tab is visible; returning to a hidden tab re-syncs
    // via the visibility/focus handlers below, so background tabs stay quiet.
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void runSync({ quick: initialSyncDoneRef.current });
      }
    }, SYNC_INTERVAL_MS);
    const handleConfig = () => void runSync({ quick: false, forceLease: true });
    // Switching back to a tab (the user's two-domain workflow) pulls the
    // latest immediately, so edits made on the other domain show up at once.
    const handleVisible = () => {
      if (document.visibilityState === "visible") {
        void runSync({ quick: initialSyncDoneRef.current });
      }
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
