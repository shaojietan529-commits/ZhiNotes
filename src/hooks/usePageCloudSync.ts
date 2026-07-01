"use client";

// Runs account page cloud sync in the background while the app is open so
// both domains stay in step in near-real-time: on load, on a short interval,
// whenever the tab regains focus/visibility, and on manual triggers. Local
// page writes already use a debounced cloud push queue; this hook is the
// cross-device pull and offline-retry safety net.

import { useCallback, useEffect, useRef, useState } from "react";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { checkAccountCloudSyncGate } from "@/lib/account/accountCloudSyncGate";
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
import {
  getPageUpdateClientId,
  PAGE_LOCAL_UPDATE_EVENT,
  type PageUpdateMessage,
} from "@/lib/pages/pageUpdateBus";

// Background heartbeat. Short enough to feel live, long enough to stay well
// within KV rate limits because only one visible tab holds the sync lease.
const SYNC_INTERVAL_MS = 8 * 1000;
const INITIAL_SYNC_DELAY_MS = 800;
const EDIT_DEBOUNCE_MS = 4 * 1000;
const PENDING_STATUS_SYNC_DELAY_MS = 1200;
const AUTH_RETRY_BACKOFF_MS = 2 * 60 * 1000;
const LEASE_KEY = "zhinote.pagesync.leaderLease.v1";
const LEASE_TTL_MS = 18 * 1000;
const PAGE_PENDING_STORAGE_KEYS = new Set([
  "zhinote.pagesync.pendingPushIds",
  "zhinote.pagesync.pendingPushMeta",
]);

const EMPTY_PAGE_PENDING_STATUS: PendingCloudPageSyncStatus = {
  enabled: false,
  pending: 0,
  queued: 0,
  failed: 0,
  failureCountTotal: 0,
  maxFailureCount: 0,
  manualReviewCount: 0,
  manualReviewFailureThreshold: 3,
  manualReviewSampleIds: [],
  oldestPendingQueuedAt: null,
  lastAttemptAt: null,
  lastFailureAt: null,
  lastFailureMessage: null,
  pendingSampleIds: [],
  failedSampleIds: [],
  authRetryStatus: null,
  authRetryUntil: null,
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
  const rerunAfterCurrentSyncRef = useRef<
    { quick?: boolean; forceLease?: boolean } | null
  >(null);
  const authRetryAfterRef = useRef(0);
  const authRetryStateRef = useRef<PageCloudSyncState>("signed-out");
  const seenLocalCacheRecoverySignalRef = useRef<string | null>(null);

  const refreshPendingStatus = useCallback(() => {
    setPendingStatus(getPendingCloudPageSyncStatus());
  }, []);

  const gateAccountSync = useCallback(async (force = false) => {
    const accountGate = await checkAccountCloudSyncGate({ force });
    if (accountGate.status === "ready") {
      authRetryAfterRef.current = 0;
      authRetryStateRef.current = "signed-out";
      return true;
    }
    authRetryAfterRef.current = Date.now() + AUTH_RETRY_BACKOFF_MS;
    authRetryStateRef.current =
      accountGate.status === "error" ? "error" : "signed-out";
    setState(authRetryStateRef.current);
    refreshPendingStatus();
    return false;
  }, [refreshPendingStatus]);

  const runSync = useCallback(async (options: { quick?: boolean; forceLease?: boolean } = {}) => {
    if (!isPageSyncEnabled()) {
      setState("disabled");
      refreshPendingStatus();
      return;
    }
    if (runningRef.current) {
      const pendingRerun = rerunAfterCurrentSyncRef.current;
      rerunAfterCurrentSyncRef.current = {
        quick: options.quick ?? pendingRerun?.quick ?? true,
        forceLease: Boolean(options.forceLease || pendingRerun?.forceLease),
      };
      refreshPendingStatus();
      return;
    }
    if (!options.forceLease && Date.now() < authRetryAfterRef.current) {
      setState(authRetryStateRef.current);
      refreshPendingStatus();
      return;
    }
    const accountReady = await gateAccountSync(Boolean(options.forceLease));
    if (!accountReady) return;
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
        authRetryStateRef.current = "signed-out";
        setState("synced");
        setLastSyncAt(getLastPageSyncAt());
      } else if (
        result.status === "unauthenticated" ||
        result.status === "unconfigured"
      ) {
        authRetryAfterRef.current = Date.now() + AUTH_RETRY_BACKOFF_MS;
        authRetryStateRef.current = "signed-out";
        setState("signed-out");
      } else if (result.status === "disabled") {
        authRetryAfterRef.current = 0;
        authRetryStateRef.current = "signed-out";
        setState("disabled");
      } else {
        authRetryAfterRef.current = 0;
        authRetryStateRef.current = "error";
        setState("error");
      }
    } finally {
      runningRef.current = false;
      refreshPendingStatus();
      const pendingRerun = rerunAfterCurrentSyncRef.current;
      rerunAfterCurrentSyncRef.current = null;
      if (pendingRerun && isPageSyncEnabled()) {
        window.setTimeout(() => {
          void runSync({
            quick: pendingRerun.quick ?? true,
            forceLease: pendingRerun.forceLease,
          });
        }, 0);
      }
    }
  }, [gateAccountSync, refreshPendingStatus]);

  const recoverLocalCacheFromCloud = useCallback(async () => {
    const signal = getLocalCacheRecoverySignal();
    if (!signal || seenLocalCacheRecoverySignalRef.current === signal.id) {
      return;
    }
    seenLocalCacheRecoverySignalRef.current = signal.id;
    if (!isPageSyncEnabled()) return;
    const accountReady = await gateAccountSync(true);
    if (!accountReady) return;
    const result = await syncCloudPageMetadataDelta({
      force: true,
      fullRefresh: true,
    });
    if (result.status === "ok") {
      authRetryAfterRef.current = 0;
      authRetryStateRef.current = "signed-out";
      setState("synced");
      setLastSyncAt(getLastPageSyncAt());
      void runSync({ quick: true, forceLease: true });
    } else if (
      result.status === "unauthenticated" ||
      result.status === "unconfigured"
    ) {
      authRetryAfterRef.current = Date.now() + AUTH_RETRY_BACKOFF_MS;
      authRetryStateRef.current = "signed-out";
      setState("signed-out");
    } else if (result.status === "disabled") {
      authRetryStateRef.current = "signed-out";
      setState("disabled");
    } else {
      authRetryStateRef.current = "error";
      setState("error");
    }
    refreshPendingStatus();
  }, [gateAccountSync, refreshPendingStatus, runSync]);

  useEffect(() => {
    if (!dbReady) return;
    let editSyncTimer: number | undefined;
    let pendingStatusSyncTimer: number | undefined;
    const schedulePendingStatusSync = () => {
      if (pendingStatusSyncTimer !== undefined) {
        window.clearTimeout(pendingStatusSyncTimer);
      }
      pendingStatusSyncTimer = window.setTimeout(() => {
        void runSync({ quick: true });
      }, PENDING_STATUS_SYNC_DELAY_MS);
    };
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
    // latest immediately. The visible tab takes over the short lease instead
    // of waiting for a hidden tab's lease to expire.
    const handleVisible = () => {
      if (document.visibilityState === "visible") {
        void runSync({ quick: true, forceLease: true });
      }
    };
    const handleForeground = () => {
      void runSync({ quick: true, forceLease: true });
    };
    const handleLocalPageUpdate = (event: Event) => {
      const message = (event as CustomEvent<PageUpdateMessage>).detail;
      if (
        message?.reason !== "local-refresh" &&
        message?.reason !== "cloud-push"
      ) {
        return;
      }
      if (editSyncTimer !== undefined) window.clearTimeout(editSyncTimer);
      editSyncTimer = window.setTimeout(() => {
        void runSync({ quick: true });
      }, EDIT_DEBOUNCE_MS);
    };
    const handleLocalCacheRecovery = () => void recoverLocalCacheFromCloud();
    const handleLocalCacheRecoveryStorage = (event: StorageEvent) => {
      if (event.key === LOCAL_CACHE_RECOVERY_SIGNAL_KEY && event.newValue) {
        void recoverLocalCacheFromCloud();
      }
      if (event.key?.startsWith("zhinote.pagesync.")) {
        refreshPendingStatus();
        if (PAGE_PENDING_STORAGE_KEYS.has(event.key ?? "")) {
          schedulePendingStatusSync();
        }
      }
    };
    const handleStatus = (event: Event) => {
      const detail = (event as CustomEvent<PendingCloudPageSyncStatus>).detail;
      if (detail) {
        setPendingStatus(detail);
        const totalPending = detail.pending + detail.queued;
        if (detail.enabled && totalPending > 0) {
          schedulePendingStatusSync();
        }
      } else {
        refreshPendingStatus();
      }
    };
    window.addEventListener(PAGE_SYNC_CONFIG_EVENT, handleConfig);
    window.addEventListener(PAGE_SYNC_STATUS_EVENT, handleStatus);
    window.addEventListener(PAGE_LOCAL_UPDATE_EVENT, handleLocalPageUpdate);
    window.addEventListener(LOCAL_CACHE_RECOVERY_EVENT, handleLocalCacheRecovery);
    window.addEventListener("storage", handleLocalCacheRecoveryStorage);
    window.addEventListener("focus", handleForeground);
    window.addEventListener("online", handleForeground);
    document.addEventListener("visibilitychange", handleVisible);
    return () => {
      if (editSyncTimer !== undefined) window.clearTimeout(editSyncTimer);
      if (pendingStatusSyncTimer !== undefined) {
        window.clearTimeout(pendingStatusSyncTimer);
      }
      window.clearTimeout(initialSyncTimer);
      window.clearInterval(interval);
      window.removeEventListener(PAGE_SYNC_CONFIG_EVENT, handleConfig);
      window.removeEventListener(PAGE_SYNC_STATUS_EVENT, handleStatus);
      window.removeEventListener(PAGE_LOCAL_UPDATE_EVENT, handleLocalPageUpdate);
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
