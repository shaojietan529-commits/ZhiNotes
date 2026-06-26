"use client";

// Runs account page cloud sync in the background while the app is open so
// both domains stay in step in near-real-time: on load, on a short interval,
// whenever the tab regains focus/visibility, and on manual triggers. Local
// page writes already use a debounced cloud push queue; this hook is the
// cross-device pull and offline-retry safety net.

import { useCallback, useEffect, useRef, useState } from "react";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import {
  getLocalCacheRecoverySignal,
  LOCAL_CACHE_RECOVERY_EVENT,
  LOCAL_CACHE_RECOVERY_SIGNAL_KEY,
} from "@/lib/db/local/client";
import {
  isPageSyncEnabled,
  reconcilePageSync,
  getLastPageSyncAt,
  getPendingCloudPageSyncStatus,
  PAGE_SYNC_CONFIG_EVENT,
  PAGE_SYNC_STATUS_EVENT,
  syncCloudPageMetadataDelta,
  type PendingCloudPageSyncStatus,
} from "@/lib/pages/accountPageSync";
import { getPageUpdateClientId } from "@/lib/pages/pageUpdateBus";

// Background heartbeat. Short enough to feel live, long enough to stay well
// within KV rate limits because only one visible tab holds the sync lease.
const SYNC_INTERVAL_MS = 8 * 1000;
const INITIAL_SYNC_DELAY_MS = 800;
const AUTH_RETRY_BACKOFF_MS = 2 * 60 * 1000;
const LEASE_KEY = "zhinote.pagesync.leaderLease.v1";
const LEASE_TTL_MS = 18 * 1000;

const EMPTY_PAGE_PENDING_STATUS: PendingCloudPageSyncStatus = {
  enabled: false,
  pending: 0,
  queued: 0,
  oldestPendingQueuedAt: null,
  pendingSampleIds: [],
  lastSyncAt: null,
};

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
  try {
    const nextLease = JSON.stringify({ owner, until: now + LEASE_TTL_MS });
    window.localStorage.setItem(LEASE_KEY, nextLease);
    const confirmed = JSON.parse(
      window.localStorage.getItem(LEASE_KEY) ?? "{}"
    ) as { owner?: string };
    return confirmed.owner === owner;
  } catch {
    // localStorage is only a cross-tab coordination cache. If it is blocked,
    // keep syncing in this tab instead of making cloud refresh depend on it.
    return true;
  }
}

export function usePageCloudSync() {
  const dbReady = useWorkspaceStore((s) => s.dbReady);
  // Start as "disabled" on both server and client so SSR hydration matches;
  // the first effect run flips it based on the real localStorage flag.
  const [state, setState] = useState<PageCloudSyncState>("disabled");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<PendingCloudPageSyncStatus>(
    EMPTY_PAGE_PENDING_STATUS
  );
  const runningRef = useRef(false);
  const authRetryAfterRef = useRef(0);
  const seenLocalCacheRecoverySignalRef = useRef<string | null>(null);

  const refreshPendingStatus = useCallback(() => {
    setPendingStatus(getPendingCloudPageSyncStatus());
  }, []);

  const runSync = useCallback(async (options: { quick?: boolean; forceLease?: boolean } = {}) => {
    if (!isPageSyncEnabled()) {
      setState("disabled");
      refreshPendingStatus();
      return;
    }
    if (!options.forceLease && Date.now() < authRetryAfterRef.current) {
      setState("signed-out");
      refreshPendingStatus();
      return;
    }
    if (!claimSyncLease(options.forceLease)) {
      const last = getLastPageSyncAt();
      if (last) {
        setState("synced");
        setLastSyncAt(last);
      }
      refreshPendingStatus();
      return;
    }
    if (runningRef.current) return;
    runningRef.current = true;
    setState("syncing");
    refreshPendingStatus();
    try {
      const result = await reconcilePageSync({ quick: options.quick });
      if (result.status === "ok") {
        authRetryAfterRef.current = 0;
        setState("synced");
        setLastSyncAt(getLastPageSyncAt());
      } else if (
        result.status === "unauthenticated" ||
        result.status === "unconfigured"
      ) {
        authRetryAfterRef.current = Date.now() + AUTH_RETRY_BACKOFF_MS;
        setState("signed-out");
      } else if (result.status === "disabled") {
        authRetryAfterRef.current = 0;
        setState("disabled");
      } else {
        authRetryAfterRef.current = 0;
        setState("error");
      }
    } finally {
      runningRef.current = false;
      refreshPendingStatus();
    }
  }, [refreshPendingStatus]);

  const recoverLocalCacheFromCloud = useCallback(async () => {
    const signal = getLocalCacheRecoverySignal();
    if (!signal || seenLocalCacheRecoverySignalRef.current === signal.id) {
      return;
    }
    seenLocalCacheRecoverySignalRef.current = signal.id;
    if (!isPageSyncEnabled()) return;
    const result = await syncCloudPageMetadataDelta({
      force: true,
      fullRefresh: true,
    });
    if (result.status === "ok") {
      setState("synced");
      setLastSyncAt(getLastPageSyncAt());
      void runSync({ quick: true, forceLease: true });
    } else if (
      result.status === "unauthenticated" ||
      result.status === "unconfigured"
    ) {
      authRetryAfterRef.current = Date.now() + AUTH_RETRY_BACKOFF_MS;
      setState("signed-out");
    } else if (result.status === "disabled") {
      setState("disabled");
    } else {
      setState("error");
    }
    refreshPendingStatus();
  }, [refreshPendingStatus, runSync]);

  useEffect(() => {
    if (!dbReady) return;
    refreshPendingStatus();
    const initialSyncTimer = window.setTimeout(() => {
      void runSync({ quick: true });
    }, INITIAL_SYNC_DELAY_MS);
    void recoverLocalCacheFromCloud();
    // Only poll while the tab is visible; returning to a hidden tab re-syncs
    // via the visibility/focus handlers below, so background tabs stay quiet.
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void runSync({ quick: true });
      }
    }, SYNC_INTERVAL_MS);
    const handleConfig = () => void runSync({ quick: true, forceLease: true });
    // Switching back to a tab (the user's two-domain workflow) pulls the
    // latest immediately, so edits made on the other domain show up at once.
    const handleVisible = () => {
      if (document.visibilityState === "visible") {
        void runSync({ quick: true });
      }
    };
    const handleForeground = () => void runSync({ quick: true });
    const handleLocalCacheRecovery = () => void recoverLocalCacheFromCloud();
    const handleLocalCacheRecoveryStorage = (event: StorageEvent) => {
      if (event.key === LOCAL_CACHE_RECOVERY_SIGNAL_KEY && event.newValue) {
        void recoverLocalCacheFromCloud();
      }
      if (event.key?.startsWith("zhinote.pagesync.")) {
        refreshPendingStatus();
      }
    };
    const handleStatus = (event: Event) => {
      const detail = (event as CustomEvent<PendingCloudPageSyncStatus>).detail;
      if (detail) {
        setPendingStatus(detail);
      } else {
        refreshPendingStatus();
      }
    };
    window.addEventListener(PAGE_SYNC_CONFIG_EVENT, handleConfig);
    window.addEventListener(PAGE_SYNC_STATUS_EVENT, handleStatus);
    window.addEventListener(LOCAL_CACHE_RECOVERY_EVENT, handleLocalCacheRecovery);
    window.addEventListener("storage", handleLocalCacheRecoveryStorage);
    window.addEventListener("focus", handleForeground);
    window.addEventListener("online", handleForeground);
    document.addEventListener("visibilitychange", handleVisible);
    return () => {
      window.clearTimeout(initialSyncTimer);
      window.clearInterval(interval);
      window.removeEventListener(PAGE_SYNC_CONFIG_EVENT, handleConfig);
      window.removeEventListener(PAGE_SYNC_STATUS_EVENT, handleStatus);
      window.removeEventListener(
        LOCAL_CACHE_RECOVERY_EVENT,
        handleLocalCacheRecovery
      );
      window.removeEventListener("storage", handleLocalCacheRecoveryStorage);
      window.removeEventListener("focus", handleForeground);
      window.removeEventListener("online", handleForeground);
      document.removeEventListener("visibilitychange", handleVisible);
    };
  }, [dbReady, recoverLocalCacheFromCloud, refreshPendingStatus, runSync]);

  return { state, lastSyncAt, pendingStatus, syncNow: runSync };
}
