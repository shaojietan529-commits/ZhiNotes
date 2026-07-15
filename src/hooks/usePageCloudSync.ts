"use client";

// Runs account page cloud sync in the background while the app is open so
// both domains stay in step in near-real-time: on load, on a short interval,
// whenever the tab regains focus/visibility, and on manual triggers. Local
// page writes already use a debounced cloud push queue; this hook is the
// cross-device pull and offline-retry safety net.

import { useCallback, useEffect, useRef, useState } from "react";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import {
  checkAccountCloudSyncGate,
  type AccountCloudSyncGateStatus,
} from "@/lib/account/accountCloudSyncGate";
import { ACCOUNT_PROFILE_UPDATED_EVENT } from "@/lib/account/clientProfile";
import {
  ACCOUNT_SESSION_EXPLICIT_LOGOUT_STORAGE_KEY,
  ACCOUNT_SESSION_LAST_AUTHENTICATED_STORAGE_KEY,
} from "@/lib/account/clientSession";
import {
  getLocalCacheRecoverySignal,
  LOCAL_CACHE_RECOVERY_EVENT,
  LOCAL_CACHE_RECOVERY_SIGNAL_KEY,
} from "@/lib/db/local/client";
import {
  SYNC_LOG_STATUS_EVENT,
  SYNC_LOG_STATUS_STORAGE_KEY,
} from "@/lib/db/local/queries";
import {
  isPageSyncEnabled,
  reconcilePageSync,
  getLastPageSyncAt,
  getPendingCloudPageSyncStatusWithSyncLog,
  PAGE_SYNC_CONFIG_EVENT,
  PAGE_SYNC_STATUS_EVENT,
  recordPageSyncAuthRetryStatus,
  syncCloudPageMetadataDelta,
  type PendingCloudPageSyncStatus,
  type PageSyncStatus,
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
const INTERACTIVE_AUTH_RETRY_RECHECK_BACKOFF_MS = 10 * 1000;
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
  syncLogPending: 0,
  syncLogRetryable: 0,
  syncLogDeferred: 0,
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
  lastOutcome: null,
};

export type PageCloudSyncState =
  | "disabled"
  | "syncing"
  | "synced"
  | "signed-out"
  | "error";

interface PageCloudSyncRunOptions {
  quick?: boolean;
  forceLease?: boolean;
  forceAccountGate?: boolean;
  includeManualReview?: boolean;
}

function shouldForceAccountGateForPendingStatus(
  status: PendingCloudPageSyncStatus | null | undefined
): boolean {
  if (!status?.enabled) return false;
  if (status.pending + status.queued + (status.syncLogPending ?? 0) <= 0) {
    return false;
  }
  return Boolean(status.authRetryStatus);
}

function getRetryStateFromAccountGate(
  status: AccountCloudSyncGateStatus
): PageCloudSyncState {
  return status === "signed-out" ? "signed-out" : "error";
}

function getAuthRetryStatusFromAccountGate(
  status: AccountCloudSyncGateStatus
): PageSyncStatus {
  if (status === "signed-out") return "unauthenticated";
  if (status === "unconfigured") return "unconfigured";
  if (status === "unconfirmed") return "unconfirmed";
  return "error";
}

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
  const rerunAfterCurrentSyncRef =
    useRef<PageCloudSyncRunOptions | null>(null);
  const authRetryAfterRef = useRef(0);
  const authRetryStateRef = useRef<PageCloudSyncState>("signed-out");
  const interactiveAuthRetryRecheckAfterRef = useRef(0);
  const seenLocalCacheRecoverySignalRef = useRef<string | null>(null);
  const recoveringLocalCacheSignalRef = useRef<string | null>(null);
  const pendingStatusRefreshGenerationRef = useRef(0);
  const mountedRef = useRef(false);

  const setStateIfMounted = useCallback((nextState: PageCloudSyncState) => {
    if (!mountedRef.current) return;
    setState(nextState);
  }, []);

  const setLastSyncAtIfMounted = useCallback((nextLastSyncAt: string | null) => {
    if (!mountedRef.current) return;
    setLastSyncAt(nextLastSyncAt);
  }, []);

  const setPendingStatusIfMounted = useCallback(
    (nextStatus: PendingCloudPageSyncStatus) => {
      if (!mountedRef.current) return;
      setPendingStatus(nextStatus);
    },
    []
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      pendingStatusRefreshGenerationRef.current += 1;
      rerunAfterCurrentSyncRef.current = null;
    };
  }, []);

  const refreshPendingStatus = useCallback(() => {
    const generation = pendingStatusRefreshGenerationRef.current + 1;
    pendingStatusRefreshGenerationRef.current = generation;
    void getPendingCloudPageSyncStatusWithSyncLog().then((status) => {
      if (pendingStatusRefreshGenerationRef.current !== generation) return;
      setPendingStatusIfMounted(status);
    });
  }, [setPendingStatusIfMounted]);

  const gateAccountSync = useCallback(async (force = false) => {
    if (!mountedRef.current) return false;
    const accountGate = await checkAccountCloudSyncGate({ force });
    if (!mountedRef.current) return false;
    if (accountGate.status === "ready") {
      authRetryAfterRef.current = 0;
      authRetryStateRef.current = "signed-out";
      recordPageSyncAuthRetryStatus("ok");
      return true;
    }
    authRetryAfterRef.current = Date.now() + AUTH_RETRY_BACKOFF_MS;
    authRetryStateRef.current = getRetryStateFromAccountGate(
      accountGate.status
    );
    recordPageSyncAuthRetryStatus(
      getAuthRetryStatusFromAccountGate(accountGate.status)
    );
    if (mountedRef.current) setState(authRetryStateRef.current);
    refreshPendingStatus();
    return false;
  }, [refreshPendingStatus]);

  const shouldForceAccountGateForInteractiveRetry = useCallback(() => {
    const now = Date.now();
    if (now >= authRetryAfterRef.current) return false;
    if (now < interactiveAuthRetryRecheckAfterRef.current) return false;
    interactiveAuthRetryRecheckAfterRef.current =
      now + INTERACTIVE_AUTH_RETRY_RECHECK_BACKOFF_MS;
    return true;
  }, []);

  const runSync = useCallback(async (options: PageCloudSyncRunOptions = {}) => {
    if (!mountedRef.current) return;
    if (!isPageSyncEnabled()) {
      setStateIfMounted("disabled");
      refreshPendingStatus();
      return;
    }
    if (runningRef.current) {
      const pendingRerun = rerunAfterCurrentSyncRef.current;
      rerunAfterCurrentSyncRef.current = {
        quick: options.quick ?? pendingRerun?.quick ?? true,
        forceLease: Boolean(options.forceLease || pendingRerun?.forceLease),
        forceAccountGate: Boolean(
          options.forceAccountGate || pendingRerun?.forceAccountGate
        ),
        includeManualReview: Boolean(
          options.includeManualReview || pendingRerun?.includeManualReview
        ),
      };
      refreshPendingStatus();
      return;
    }
    if (!options.forceAccountGate && Date.now() < authRetryAfterRef.current) {
      setStateIfMounted(authRetryStateRef.current);
      refreshPendingStatus();
      return;
    }
    const accountReady = await gateAccountSync(Boolean(options.forceAccountGate));
    if (!mountedRef.current) return;
    if (!accountReady) return;
    if (!claimSyncLease(options.forceLease)) {
      const last = getLastPageSyncAt();
      if (last) {
        setStateIfMounted("synced");
        setLastSyncAtIfMounted(last);
      }
      refreshPendingStatus();
      return;
    }
    if (runningRef.current) return;
    runningRef.current = true;
    setStateIfMounted("syncing");
    refreshPendingStatus();
    try {
      const result = await reconcilePageSync({
        quick: options.quick,
        includeManualReview: options.includeManualReview,
        forceAccountGate: options.forceAccountGate,
      });
      if (!mountedRef.current) return;
      if (result.status === "ok") {
        authRetryAfterRef.current = 0;
        authRetryStateRef.current = "signed-out";
        recordPageSyncAuthRetryStatus("ok");
        setStateIfMounted("synced");
        setLastSyncAtIfMounted(getLastPageSyncAt());
      } else if (result.status === "unauthenticated") {
        authRetryAfterRef.current = Date.now() + AUTH_RETRY_BACKOFF_MS;
        authRetryStateRef.current = "error";
        recordPageSyncAuthRetryStatus("unauthenticated");
        setStateIfMounted("error");
      } else if (result.status === "unconfigured") {
        authRetryAfterRef.current = Date.now() + AUTH_RETRY_BACKOFF_MS;
        authRetryStateRef.current = "error";
        recordPageSyncAuthRetryStatus("unconfigured");
        setStateIfMounted("error");
      } else if (result.status === "unconfirmed") {
        authRetryAfterRef.current = Date.now() + AUTH_RETRY_BACKOFF_MS;
        authRetryStateRef.current = "error";
        recordPageSyncAuthRetryStatus("unconfirmed");
        setStateIfMounted("error");
      } else if (result.status === "disabled") {
        authRetryAfterRef.current = 0;
        authRetryStateRef.current = "signed-out";
        recordPageSyncAuthRetryStatus("disabled");
        setStateIfMounted("disabled");
      } else {
        authRetryAfterRef.current = 0;
        authRetryStateRef.current = "error";
        recordPageSyncAuthRetryStatus("error");
        setStateIfMounted("error");
      }
    } catch {
      if (!mountedRef.current) return;
      authRetryAfterRef.current = Date.now() + AUTH_RETRY_BACKOFF_MS;
      authRetryStateRef.current = "error";
      recordPageSyncAuthRetryStatus("error");
      setStateIfMounted("error");
    } finally {
      runningRef.current = false;
      refreshPendingStatus();
      const pendingRerun = rerunAfterCurrentSyncRef.current;
      rerunAfterCurrentSyncRef.current = null;
      if (pendingRerun && isPageSyncEnabled() && mountedRef.current) {
        window.setTimeout(() => {
          void runSync({
            quick: pendingRerun.quick ?? true,
            forceLease: pendingRerun.forceLease,
            forceAccountGate: pendingRerun.forceAccountGate,
            includeManualReview: pendingRerun.includeManualReview,
          });
        }, 0);
      }
    }
  }, [
    gateAccountSync,
    refreshPendingStatus,
    setLastSyncAtIfMounted,
    setStateIfMounted,
  ]);

  const recoverLocalCacheFromCloud = useCallback(async () => {
    if (!mountedRef.current) return;
    const signal = getLocalCacheRecoverySignal();
    if (
      !signal ||
      seenLocalCacheRecoverySignalRef.current === signal.id ||
      recoveringLocalCacheSignalRef.current === signal.id
    ) {
      return;
    }
    if (!isPageSyncEnabled()) return;
    recoveringLocalCacheSignalRef.current = signal.id;
    try {
      const accountReady = await gateAccountSync(true);
      if (!mountedRef.current) return;
      if (!accountReady) return;
      const result = await syncCloudPageMetadataDelta({
        force: true,
        fullRefresh: true,
      });
      if (!mountedRef.current) return;
      if (result.status === "ok") {
        seenLocalCacheRecoverySignalRef.current = signal.id;
        authRetryAfterRef.current = 0;
        authRetryStateRef.current = "signed-out";
        recordPageSyncAuthRetryStatus("ok");
        setStateIfMounted("synced");
        setLastSyncAtIfMounted(getLastPageSyncAt());
        void runSync({ quick: true, forceLease: true });
      } else if (result.status === "unauthenticated") {
        authRetryAfterRef.current = Date.now() + AUTH_RETRY_BACKOFF_MS;
        authRetryStateRef.current = "error";
        recordPageSyncAuthRetryStatus("unauthenticated");
        setStateIfMounted("error");
      } else if (result.status === "unconfigured") {
        authRetryAfterRef.current = Date.now() + AUTH_RETRY_BACKOFF_MS;
        authRetryStateRef.current = "error";
        recordPageSyncAuthRetryStatus("unconfigured");
        setStateIfMounted("error");
      } else if (result.status === "unconfirmed") {
        authRetryAfterRef.current = Date.now() + AUTH_RETRY_BACKOFF_MS;
        authRetryStateRef.current = "error";
        recordPageSyncAuthRetryStatus("unconfirmed");
        setStateIfMounted("error");
      } else if (result.status === "disabled") {
        authRetryStateRef.current = "signed-out";
        recordPageSyncAuthRetryStatus("disabled");
        setStateIfMounted("disabled");
      } else {
        authRetryStateRef.current = "error";
        recordPageSyncAuthRetryStatus("error");
        setStateIfMounted("error");
      }
      refreshPendingStatus();
    } catch {
      if (!mountedRef.current) return;
      authRetryAfterRef.current = Date.now() + AUTH_RETRY_BACKOFF_MS;
      authRetryStateRef.current = "error";
      recordPageSyncAuthRetryStatus("error");
      setStateIfMounted("error");
      refreshPendingStatus();
    } finally {
      if (recoveringLocalCacheSignalRef.current === signal.id) {
        recoveringLocalCacheSignalRef.current = null;
      }
    }
  }, [
    gateAccountSync,
    refreshPendingStatus,
    runSync,
    setLastSyncAtIfMounted,
    setStateIfMounted,
  ]);

  useEffect(() => {
    if (!dbReady) return;
    let editSyncTimer: number | undefined;
    let pendingStatusSyncTimer: number | undefined;
    const schedulePendingStatusSync = (
      options: { forceAccountGate?: boolean } = {}
    ) => {
      if (pendingStatusSyncTimer !== undefined) {
        window.clearTimeout(pendingStatusSyncTimer);
      }
      pendingStatusSyncTimer = window.setTimeout(() => {
        void runSync({
          quick: true,
          forceLease: Boolean(options.forceAccountGate),
          forceAccountGate: Boolean(options.forceAccountGate),
        });
      }, PENDING_STATUS_SYNC_DELAY_MS);
    };
    const refreshStatusAndScheduleIfNeeded = () => {
      void getPendingCloudPageSyncStatusWithSyncLog().then((status) => {
        setPendingStatusIfMounted(status);
        const totalPending =
          status.pending + status.queued + (status.syncLogPending ?? 0);
        if (status.enabled && totalPending > 0) {
          schedulePendingStatusSync({
            forceAccountGate: shouldForceAccountGateForPendingStatus(status),
          });
        }
      });
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
    const handleConfig = () =>
      void runSync({ quick: true, forceLease: true, forceAccountGate: true });
    // Switching back to a tab (the user's two-domain workflow) pulls the
    // latest immediately. The visible tab takes over the short lease instead
    // of waiting for a hidden tab's lease to expire.
    const handleVisible = () => {
      if (document.visibilityState === "visible") {
        void runSync({
          quick: true,
          forceLease: true,
          forceAccountGate: shouldForceAccountGateForInteractiveRetry(),
        });
      }
    };
    const handleForeground = () => {
      void runSync({
        quick: true,
        forceLease: true,
        forceAccountGate: shouldForceAccountGateForInteractiveRetry(),
      });
    };
    const handleOnline = () => {
      void runSync({ quick: true, forceLease: true, forceAccountGate: true });
    };
    const handleAccountProfileUpdated = () => {
      void runSync({ quick: true, forceLease: true, forceAccountGate: true });
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
      if (event.key === ACCOUNT_SESSION_LAST_AUTHENTICATED_STORAGE_KEY) {
        void runSync({
          quick: true,
          forceLease: true,
          forceAccountGate: true,
        });
        return;
      }
      if (
        event.key === ACCOUNT_SESSION_LAST_AUTHENTICATED_STORAGE_KEY ||
        event.key === ACCOUNT_SESSION_EXPLICIT_LOGOUT_STORAGE_KEY
      ) {
        void runSync({
          quick: true,
          forceLease: true,
          forceAccountGate: true,
        });
        return;
      }
      if (event.key === LOCAL_CACHE_RECOVERY_SIGNAL_KEY && event.newValue) {
        void recoverLocalCacheFromCloud();
      }
      if (event.key?.startsWith("zhinote.pagesync.")) {
        void getPendingCloudPageSyncStatusWithSyncLog().then((nextStatus) => {
          setPendingStatusIfMounted(nextStatus);
          if (PAGE_PENDING_STORAGE_KEYS.has(event.key ?? "")) {
            schedulePendingStatusSync({
              forceAccountGate:
                shouldForceAccountGateForPendingStatus(nextStatus),
            });
          }
        });
      }
      if (event.key === SYNC_LOG_STATUS_STORAGE_KEY) {
        refreshStatusAndScheduleIfNeeded();
      }
    };
    const handleStatus = (event: Event) => {
      const detail = (event as CustomEvent<PendingCloudPageSyncStatus>).detail;
      if (detail) {
        setPendingStatusIfMounted(detail);
        const totalPending =
          detail.pending + detail.queued + (detail.syncLogPending ?? 0);
        if (detail.enabled && totalPending > 0) {
          schedulePendingStatusSync({
            forceAccountGate:
              shouldForceAccountGateForPendingStatus(detail),
          });
        }
      } else {
        refreshPendingStatus();
      }
    };
    const handleSyncLogStatus = () => refreshStatusAndScheduleIfNeeded();
    window.addEventListener(PAGE_SYNC_CONFIG_EVENT, handleConfig);
    window.addEventListener(PAGE_SYNC_STATUS_EVENT, handleStatus);
    window.addEventListener(SYNC_LOG_STATUS_EVENT, handleSyncLogStatus);
    window.addEventListener(PAGE_LOCAL_UPDATE_EVENT, handleLocalPageUpdate);
    window.addEventListener(
      ACCOUNT_PROFILE_UPDATED_EVENT,
      handleAccountProfileUpdated
    );
    window.addEventListener(LOCAL_CACHE_RECOVERY_EVENT, handleLocalCacheRecovery);
    window.addEventListener("storage", handleLocalCacheRecoveryStorage);
    window.addEventListener("focus", handleForeground);
    window.addEventListener("online", handleOnline);
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
      window.removeEventListener(SYNC_LOG_STATUS_EVENT, handleSyncLogStatus);
      window.removeEventListener(PAGE_LOCAL_UPDATE_EVENT, handleLocalPageUpdate);
      window.removeEventListener(
        ACCOUNT_PROFILE_UPDATED_EVENT,
        handleAccountProfileUpdated
      );
      window.removeEventListener(
        LOCAL_CACHE_RECOVERY_EVENT,
        handleLocalCacheRecovery
      );
      window.removeEventListener("storage", handleLocalCacheRecoveryStorage);
      window.removeEventListener("focus", handleForeground);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisible);
    };
  }, [
    dbReady,
    recoverLocalCacheFromCloud,
    refreshPendingStatus,
    runSync,
    shouldForceAccountGateForInteractiveRetry,
    setPendingStatusIfMounted,
  ]);

  return { state, lastSyncAt, pendingStatus, syncNow: runSync };
}
