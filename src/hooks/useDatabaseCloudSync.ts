"use client";

// Runs account database cloud sync in the background while the app is open.
// It uses the local sync_log as a low-cost pending queue, pulls cloud changes
// by cursor, and lets only one visible tab hold the polling lease.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  checkAccountCloudSyncGate,
  type AccountCloudSyncGateStatus,
} from "@/lib/account/accountCloudSyncGate";
import { ACCOUNT_PROFILE_UPDATED_EVENT } from "@/lib/account/clientProfile";
import {
  isAccountSessionStorageKey,
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
import { useWorkspaceStore } from "@/stores/workspaceStore";
import {
  DATABASE_SYNC_CONFIG_EVENT,
  DATABASE_SYNC_STATUS_EVENT,
  getLastDatabaseSyncAt,
  getPendingCloudDatabaseSyncStatus,
  isDatabaseSyncEnabled,
  reconcileDatabaseSync,
  recordDatabaseSyncAuthRetryStatus,
  syncCloudDatabaseMetadataDelta,
  type DatabaseSyncStatus,
  type PendingCloudDatabaseSyncStatus,
} from "@/lib/database/accountDatabaseSync";
import {
  DATABASE_LOCAL_UPDATE_EVENT,
  emitDatabasesUpdated,
  getDatabaseUpdateClientId,
  type DatabaseUpdateMessage,
} from "@/lib/database/databaseUpdateBus";

const SYNC_INTERVAL_MS = 10 * 1000;
const INITIAL_SYNC_DELAY_MS = 800;
const EDIT_DEBOUNCE_MS = 4 * 1000;
const PENDING_STATUS_SYNC_DELAY_MS = 1200;
const AUTH_RETRY_BACKOFF_MS = 2 * 60 * 1000;
const INTERACTIVE_AUTH_RETRY_RECHECK_BACKOFF_MS = 10 * 1000;
const LEASE_KEY = "zhinote.databasesync.leaderLease.v1";
const LEASE_TTL_MS = 22 * 1000;
const DATABASE_PENDING_STORAGE_KEYS = new Set([
  "zhinote.databasesync.pendingPushKeys",
  "zhinote.databasesync.pendingPushMeta",
]);

const EMPTY_DATABASE_PENDING_STATUS: PendingCloudDatabaseSyncStatus = {
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
  manualReviewSampleKeys: [],
  oldestPendingQueuedAt: null,
  lastAttemptAt: null,
  lastFailureAt: null,
  lastFailureMessage: null,
  pendingSampleKeys: [],
  failedSampleKeys: [],
  authRetryStatus: null,
  authRetryUntil: null,
  lastSyncAt: null,
  lastOutcome: null,
};

export type DatabaseCloudSyncState =
  | "disabled"
  | "syncing"
  | "synced"
  | "signed-out"
  | "error";

interface DatabaseCloudSyncRunOptions {
  forceLease?: boolean;
  forceAccountGate?: boolean;
  quick?: boolean;
  includeManualReview?: boolean;
}

function shouldForceAccountGateForPendingStatus(
  status: PendingCloudDatabaseSyncStatus | null | undefined
): boolean {
  if (!status?.enabled) return false;
  if (status.pending + status.queued + (status.syncLogPending ?? 0) <= 0) {
    return false;
  }
  return Boolean(status.authRetryStatus);
}

function getRetryStateFromAccountGate(
  status: AccountCloudSyncGateStatus
): DatabaseCloudSyncState {
  return status === "signed-out" ? "signed-out" : "error";
}

function getAuthRetryStatusFromAccountGate(
  status: AccountCloudSyncGateStatus
): DatabaseSyncStatus {
  if (status === "signed-out") return "unauthenticated";
  if (status === "unconfigured") return "unconfigured";
  if (status === "unconfirmed") return "unconfirmed";
  return "error";
}

function claimSyncLease(force = false): boolean {
  if (typeof window === "undefined") return false;
  const now = Date.now();
  const owner = getDatabaseUpdateClientId();
  if (!force) {
    try {
      const raw = window.localStorage.getItem(LEASE_KEY);
      const lease = raw
        ? (JSON.parse(raw) as { owner?: string; until?: number })
        : null;
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
    window.localStorage.setItem(
      LEASE_KEY,
      JSON.stringify({ owner, until: now + LEASE_TTL_MS })
    );
    const confirmed = JSON.parse(
      window.localStorage.getItem(LEASE_KEY) ?? "{}"
    ) as { owner?: string };
    return confirmed.owner === owner;
  } catch {
    // Lease storage is only a cost-control optimization; cloud sync should
    // still run when browser localStorage is unavailable.
    return true;
  }
}

export function useDatabaseCloudSync() {
  const dbReady = useWorkspaceStore((s) => s.dbReady);
  const [state, setState] = useState<DatabaseCloudSyncState>("disabled");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] =
    useState<PendingCloudDatabaseSyncStatus>(EMPTY_DATABASE_PENDING_STATUS);
  const runningRef = useRef(false);
  const rerunAfterCurrentSyncRef =
    useRef<DatabaseCloudSyncRunOptions | null>(null);
  const authRetryAfterRef = useRef(0);
  const authRetryStateRef = useRef<DatabaseCloudSyncState>("signed-out");
  const interactiveAuthRetryRecheckAfterRef = useRef(0);
  const seenLocalCacheRecoverySignalRef = useRef<string | null>(null);
  const recoveringLocalCacheSignalRef = useRef<string | null>(null);
  const pendingStatusRefreshGenerationRef = useRef(0);
  const mountedRef = useRef(false);

  const setStateIfMounted = useCallback((nextState: DatabaseCloudSyncState) => {
    if (!mountedRef.current) return;
    setState(nextState);
  }, []);

  const setLastSyncAtIfMounted = useCallback((nextLastSyncAt: string | null) => {
    if (!mountedRef.current) return;
    setLastSyncAt(nextLastSyncAt);
  }, []);

  const setPendingStatusIfMounted = useCallback(
    (nextStatus: PendingCloudDatabaseSyncStatus) => {
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
    void getPendingCloudDatabaseSyncStatus().then((status) => {
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
      authRetryStateRef.current = "synced";
      recordDatabaseSyncAuthRetryStatus("ok");
      return true;
    }
    authRetryAfterRef.current = Date.now() + AUTH_RETRY_BACKOFF_MS;
    authRetryStateRef.current = getRetryStateFromAccountGate(
      accountGate.status
    );
    recordDatabaseSyncAuthRetryStatus(
      getAuthRetryStatusFromAccountGate(accountGate.status)
    );
    if (mountedRef.current) setState(authRetryStateRef.current);
    void refreshPendingStatus();
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

  const runSync = useCallback(
    async (
      options: DatabaseCloudSyncRunOptions = {}
    ) => {
      if (!mountedRef.current) return;
      if (!isDatabaseSyncEnabled()) {
        setStateIfMounted("disabled");
        void refreshPendingStatus();
        return;
      }
      if (runningRef.current) {
        const pendingRerun = rerunAfterCurrentSyncRef.current;
        rerunAfterCurrentSyncRef.current = {
          forceLease: Boolean(options.forceLease || pendingRerun?.forceLease),
          forceAccountGate: Boolean(
            options.forceAccountGate || pendingRerun?.forceAccountGate
          ),
          quick: options.quick ?? pendingRerun?.quick ?? true,
          includeManualReview: Boolean(
            options.includeManualReview || pendingRerun?.includeManualReview
          ),
        };
        void refreshPendingStatus();
        return;
      }
      if (!options.forceAccountGate && Date.now() < authRetryAfterRef.current) {
        setStateIfMounted(authRetryStateRef.current);
        void refreshPendingStatus();
        return;
      }
      const accountReady = await gateAccountSync(
        Boolean(options.forceAccountGate)
      );
      if (!mountedRef.current) return;
      if (!accountReady) return;
      if (!claimSyncLease(options.forceLease)) {
        const last = getLastDatabaseSyncAt();
        if (last) {
          setStateIfMounted("synced");
          setLastSyncAtIfMounted(last);
        }
        void refreshPendingStatus();
        return;
      }
      if (runningRef.current) return;
      runningRef.current = true;
      setStateIfMounted("syncing");
      void refreshPendingStatus();
      try {
        const result = await reconcileDatabaseSync({
          quick: options.quick,
          includeManualReview: options.includeManualReview,
          forceAccountGate: options.forceAccountGate,
        });
        if (!mountedRef.current) return;
        if (result.status === "ok") {
          authRetryAfterRef.current = 0;
          authRetryStateRef.current = "synced";
          recordDatabaseSyncAuthRetryStatus("ok");
          setStateIfMounted("synced");
          setLastSyncAtIfMounted(getLastDatabaseSyncAt());
          if (result.pulled > 0) {
            emitDatabasesUpdated(
              "cloud-pull",
              result.pulled,
              result.records
            );
          } else if (result.pushed > 0) {
            emitDatabasesUpdated("cloud-push", result.pushed);
          }
        } else if (result.status === "unauthenticated") {
          authRetryAfterRef.current = Date.now() + AUTH_RETRY_BACKOFF_MS;
          authRetryStateRef.current = "error";
          recordDatabaseSyncAuthRetryStatus("unauthenticated");
          setStateIfMounted("error");
        } else if (result.status === "unconfigured") {
          authRetryAfterRef.current = Date.now() + AUTH_RETRY_BACKOFF_MS;
          authRetryStateRef.current = "error";
          recordDatabaseSyncAuthRetryStatus("unconfigured");
          setStateIfMounted("error");
        } else if (result.status === "unconfirmed") {
          authRetryAfterRef.current = Date.now() + AUTH_RETRY_BACKOFF_MS;
          authRetryStateRef.current = "error";
          recordDatabaseSyncAuthRetryStatus("unconfirmed");
          setStateIfMounted("error");
        } else if (result.status === "disabled") {
          authRetryAfterRef.current = 0;
          authRetryStateRef.current = "disabled";
          recordDatabaseSyncAuthRetryStatus("disabled");
          setStateIfMounted("disabled");
        } else {
          authRetryAfterRef.current = 0;
          authRetryStateRef.current = "error";
          recordDatabaseSyncAuthRetryStatus("error");
          setStateIfMounted("error");
        }
      } catch {
        if (!mountedRef.current) return;
        authRetryAfterRef.current = Date.now() + AUTH_RETRY_BACKOFF_MS;
        authRetryStateRef.current = "error";
        recordDatabaseSyncAuthRetryStatus("error");
        setStateIfMounted("error");
      } finally {
        runningRef.current = false;
        void refreshPendingStatus();
        const pendingRerun = rerunAfterCurrentSyncRef.current;
        rerunAfterCurrentSyncRef.current = null;
        if (pendingRerun && isDatabaseSyncEnabled() && mountedRef.current) {
          window.setTimeout(() => {
            void runSync({
              forceLease: pendingRerun.forceLease,
              forceAccountGate: pendingRerun.forceAccountGate,
              quick: pendingRerun.quick ?? true,
              includeManualReview: pendingRerun.includeManualReview,
            });
          }, 0);
        }
      }
    },
    [
      gateAccountSync,
      refreshPendingStatus,
      setLastSyncAtIfMounted,
      setStateIfMounted,
    ]
  );

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
    if (!isDatabaseSyncEnabled()) return;
    recoveringLocalCacheSignalRef.current = signal.id;
    try {
      const accountReady = await gateAccountSync(true);
      if (!mountedRef.current) return;
      if (!accountReady) return;
      const result = await syncCloudDatabaseMetadataDelta({
        fullRefresh: true,
      });
      if (!mountedRef.current) return;
      if (result.status === "ok") {
        seenLocalCacheRecoverySignalRef.current = signal.id;
        authRetryAfterRef.current = 0;
        authRetryStateRef.current = "signed-out";
        recordDatabaseSyncAuthRetryStatus("ok");
        setStateIfMounted("synced");
        setLastSyncAtIfMounted(getLastDatabaseSyncAt());
        if (result.pulled > 0) {
          emitDatabasesUpdated("cloud-pull", result.pulled, result.records);
        }
        void runSync({ forceLease: true, quick: true });
      } else if (result.status === "unauthenticated") {
        authRetryAfterRef.current = Date.now() + AUTH_RETRY_BACKOFF_MS;
        authRetryStateRef.current = "error";
        recordDatabaseSyncAuthRetryStatus("unauthenticated");
        setStateIfMounted("error");
      } else if (result.status === "unconfigured") {
        authRetryAfterRef.current = Date.now() + AUTH_RETRY_BACKOFF_MS;
        authRetryStateRef.current = "error";
        recordDatabaseSyncAuthRetryStatus("unconfigured");
        setStateIfMounted("error");
      } else if (result.status === "unconfirmed") {
        authRetryAfterRef.current = Date.now() + AUTH_RETRY_BACKOFF_MS;
        authRetryStateRef.current = "error";
        recordDatabaseSyncAuthRetryStatus("unconfirmed");
        setStateIfMounted("error");
      } else if (result.status === "disabled") {
        authRetryStateRef.current = "signed-out";
        recordDatabaseSyncAuthRetryStatus("disabled");
        setStateIfMounted("disabled");
      } else {
        authRetryStateRef.current = "error";
        recordDatabaseSyncAuthRetryStatus("error");
        setStateIfMounted("error");
      }
      void refreshPendingStatus();
    } catch {
      if (!mountedRef.current) return;
      authRetryAfterRef.current = Date.now() + AUTH_RETRY_BACKOFF_MS;
      authRetryStateRef.current = "error";
      recordDatabaseSyncAuthRetryStatus("error");
      setStateIfMounted("error");
      void refreshPendingStatus();
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
    let quickSyncTimer: number | undefined;
    const scheduleQuickSync = (
      delayMs: number,
      options: { forceAccountGate?: boolean } = {}
    ) => {
      if (quickSyncTimer !== undefined) window.clearTimeout(quickSyncTimer);
      quickSyncTimer = window.setTimeout(() => {
        void runSync({
          quick: true,
          forceLease: Boolean(options.forceAccountGate),
          forceAccountGate: Boolean(options.forceAccountGate),
        });
      }, delayMs);
    };
    const refreshStatusAndScheduleIfNeeded = () => {
      void getPendingCloudDatabaseSyncStatus()
        .then((status) => {
          setPendingStatusIfMounted(status);
          const totalPending =
            status.pending + status.queued + (status.syncLogPending ?? 0);
          if (status.enabled && totalPending > 0) {
            scheduleQuickSync(PENDING_STATUS_SYNC_DELAY_MS, {
              forceAccountGate:
                shouldForceAccountGateForPendingStatus(status),
            });
          }
        })
        .catch(() => {
          void refreshPendingStatus();
        });
    };
    void refreshPendingStatus();
    const initialSyncTimer = window.setTimeout(() => {
      void runSync({ quick: true });
    }, INITIAL_SYNC_DELAY_MS);
    void recoverLocalCacheFromCloud();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void runSync({ quick: true });
      }
    }, SYNC_INTERVAL_MS);
    const handleConfig = () =>
      void runSync({ forceLease: true, forceAccountGate: true, quick: true });
    const handleVisible = () => {
      if (document.visibilityState === "visible") {
        void runSync({
          forceLease: true,
          forceAccountGate: shouldForceAccountGateForInteractiveRetry(),
          quick: true,
        });
      }
    };
    const handleForeground = () => {
      void runSync({
        forceLease: true,
        forceAccountGate: shouldForceAccountGateForInteractiveRetry(),
        quick: true,
      });
    };
    const handleOnline = () => {
      void runSync({ forceLease: true, forceAccountGate: true, quick: true });
    };
    const handleAccountProfileUpdated = () => {
      void runSync({ forceLease: true, forceAccountGate: true, quick: true });
    };
    const handleLocalCacheRecovery = () => void recoverLocalCacheFromCloud();
    const handleLocalCacheRecoveryStorage = (event: StorageEvent) => {
      if (isAccountSessionStorageKey(event.key)) {
        void runSync({
          forceLease: true,
          forceAccountGate: true,
          quick: true,
        });
        return;
      }
      if (event.key === LOCAL_CACHE_RECOVERY_SIGNAL_KEY && event.newValue) {
        void recoverLocalCacheFromCloud();
      }
      if (event.key?.startsWith("zhinote.databasesync.")) {
        void getPendingCloudDatabaseSyncStatus()
          .then((nextStatus) => {
            setPendingStatusIfMounted(nextStatus);
            if (DATABASE_PENDING_STORAGE_KEYS.has(event.key ?? "")) {
              scheduleQuickSync(PENDING_STATUS_SYNC_DELAY_MS, {
                forceAccountGate:
                  shouldForceAccountGateForPendingStatus(nextStatus),
              });
            }
          })
          .catch(() => {
            void refreshPendingStatus();
            if (DATABASE_PENDING_STORAGE_KEYS.has(event.key ?? "")) {
              scheduleQuickSync(PENDING_STATUS_SYNC_DELAY_MS);
            }
          });
      }
      if (event.key === SYNC_LOG_STATUS_STORAGE_KEY) {
        refreshStatusAndScheduleIfNeeded();
      }
    };
    const handleLocalDatabaseUpdate = (event: Event) => {
      const message = (event as CustomEvent<DatabaseUpdateMessage>).detail;
      if (message?.reason !== "local-refresh") return;
      scheduleQuickSync(EDIT_DEBOUNCE_MS);
    };
    const handleStatus = (event: Event) => {
      const detail = (event as CustomEvent<PendingCloudDatabaseSyncStatus>)
        .detail;
      if (detail) {
        setPendingStatusIfMounted(detail);
        const totalPending =
          detail.pending + detail.queued + (detail.syncLogPending ?? 0);
        if (detail.enabled && totalPending > 0) {
          scheduleQuickSync(PENDING_STATUS_SYNC_DELAY_MS, {
            forceAccountGate:
              shouldForceAccountGateForPendingStatus(detail),
          });
        }
      } else {
        void refreshPendingStatus();
      }
    };
    const handleSyncLogStatus = () => refreshStatusAndScheduleIfNeeded();
    window.addEventListener(DATABASE_SYNC_CONFIG_EVENT, handleConfig);
    window.addEventListener(DATABASE_SYNC_STATUS_EVENT, handleStatus);
    window.addEventListener(SYNC_LOG_STATUS_EVENT, handleSyncLogStatus);
    window.addEventListener(
      ACCOUNT_PROFILE_UPDATED_EVENT,
      handleAccountProfileUpdated
    );
    window.addEventListener(LOCAL_CACHE_RECOVERY_EVENT, handleLocalCacheRecovery);
    window.addEventListener("storage", handleLocalCacheRecoveryStorage);
    window.addEventListener(
      DATABASE_LOCAL_UPDATE_EVENT,
      handleLocalDatabaseUpdate
    );
    window.addEventListener("focus", handleForeground);
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisible);
    return () => {
      if (quickSyncTimer !== undefined) window.clearTimeout(quickSyncTimer);
      window.clearTimeout(initialSyncTimer);
      window.clearInterval(interval);
      window.removeEventListener(DATABASE_SYNC_CONFIG_EVENT, handleConfig);
      window.removeEventListener(DATABASE_SYNC_STATUS_EVENT, handleStatus);
      window.removeEventListener(SYNC_LOG_STATUS_EVENT, handleSyncLogStatus);
      window.removeEventListener(
        ACCOUNT_PROFILE_UPDATED_EVENT,
        handleAccountProfileUpdated
      );
      window.removeEventListener(
        LOCAL_CACHE_RECOVERY_EVENT,
        handleLocalCacheRecovery
      );
      window.removeEventListener("storage", handleLocalCacheRecoveryStorage);
      window.removeEventListener(
        DATABASE_LOCAL_UPDATE_EVENT,
        handleLocalDatabaseUpdate
      );
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
