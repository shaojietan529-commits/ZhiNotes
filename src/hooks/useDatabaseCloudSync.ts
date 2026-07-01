"use client";

// Runs account database cloud sync in the background while the app is open.
// It uses the local sync_log as a low-cost pending queue, pulls cloud changes
// by cursor, and lets only one visible tab hold the polling lease.

import { useCallback, useEffect, useRef, useState } from "react";
import { checkAccountCloudSyncGate } from "@/lib/account/accountCloudSyncGate";
import {
  getLocalCacheRecoverySignal,
  LOCAL_CACHE_RECOVERY_EVENT,
  LOCAL_CACHE_RECOVERY_SIGNAL_KEY,
} from "@/lib/db/local/client";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import {
  DATABASE_SYNC_CONFIG_EVENT,
  DATABASE_SYNC_STATUS_EVENT,
  getLastDatabaseSyncAt,
  getPendingCloudDatabaseSyncStatus,
  isDatabaseSyncEnabled,
  reconcileDatabaseSync,
  syncCloudDatabaseMetadataDelta,
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
};

export type DatabaseCloudSyncState =
  | "disabled"
  | "syncing"
  | "synced"
  | "signed-out"
  | "error";

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
  const rerunAfterCurrentSyncRef = useRef<
    { forceLease?: boolean; quick?: boolean; includeManualReview?: boolean } | null
  >(null);
  const authRetryAfterRef = useRef(0);
  const authRetryStateRef = useRef<DatabaseCloudSyncState>("signed-out");
  const seenLocalCacheRecoverySignalRef = useRef<string | null>(null);

  const refreshPendingStatus = useCallback(async () => {
    setPendingStatus(await getPendingCloudDatabaseSyncStatus());
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
    void refreshPendingStatus();
    return false;
  }, [refreshPendingStatus]);

  const runSync = useCallback(
    async (
      options: {
        forceLease?: boolean;
        quick?: boolean;
        includeManualReview?: boolean;
      } = {}
    ) => {
      if (!isDatabaseSyncEnabled()) {
        setState("disabled");
        void refreshPendingStatus();
        return;
      }
      if (runningRef.current) {
        const pendingRerun = rerunAfterCurrentSyncRef.current;
        rerunAfterCurrentSyncRef.current = {
          forceLease: Boolean(options.forceLease || pendingRerun?.forceLease),
          quick: options.quick ?? pendingRerun?.quick ?? true,
          includeManualReview: Boolean(
            options.includeManualReview || pendingRerun?.includeManualReview
          ),
        };
        void refreshPendingStatus();
        return;
      }
      if (!options.forceLease && Date.now() < authRetryAfterRef.current) {
        setState(authRetryStateRef.current);
        void refreshPendingStatus();
        return;
      }
      const accountReady = await gateAccountSync(Boolean(options.forceLease));
      if (!accountReady) return;
      if (!claimSyncLease(options.forceLease)) {
        const last = getLastDatabaseSyncAt();
        if (last) {
          setState("synced");
          setLastSyncAt(last);
        }
        void refreshPendingStatus();
        return;
      }
      if (runningRef.current) return;
      runningRef.current = true;
      setState("syncing");
      void refreshPendingStatus();
      try {
        const result = await reconcileDatabaseSync({
          quick: options.quick,
          includeManualReview: options.includeManualReview,
        });
        if (result.status === "ok") {
          authRetryAfterRef.current = 0;
          authRetryStateRef.current = "signed-out";
          setState("synced");
          setLastSyncAt(getLastDatabaseSyncAt());
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
          authRetryStateRef.current = "signed-out";
          setState("signed-out");
        } else if (result.status === "unconfigured") {
          authRetryAfterRef.current = Date.now() + AUTH_RETRY_BACKOFF_MS;
          authRetryStateRef.current = "error";
          setState("error");
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
        void refreshPendingStatus();
        const pendingRerun = rerunAfterCurrentSyncRef.current;
        rerunAfterCurrentSyncRef.current = null;
        if (pendingRerun && isDatabaseSyncEnabled()) {
          window.setTimeout(() => {
            void runSync({
              forceLease: pendingRerun.forceLease,
              quick: pendingRerun.quick ?? true,
              includeManualReview: pendingRerun.includeManualReview,
            });
          }, 0);
        }
      }
    },
    [gateAccountSync, refreshPendingStatus]
  );

  const recoverLocalCacheFromCloud = useCallback(async () => {
    const signal = getLocalCacheRecoverySignal();
    if (!signal || seenLocalCacheRecoverySignalRef.current === signal.id) {
      return;
    }
    seenLocalCacheRecoverySignalRef.current = signal.id;
    if (!isDatabaseSyncEnabled()) return;
    const accountReady = await gateAccountSync(true);
    if (!accountReady) return;
    const result = await syncCloudDatabaseMetadataDelta({
      fullRefresh: true,
    });
    if (result.status === "ok") {
      authRetryAfterRef.current = 0;
      authRetryStateRef.current = "signed-out";
      setState("synced");
      setLastSyncAt(getLastDatabaseSyncAt());
      if (result.pulled > 0) {
        emitDatabasesUpdated("cloud-pull", result.pulled, result.records);
      }
      void runSync({ forceLease: true, quick: true });
    } else if (result.status === "unauthenticated") {
      authRetryAfterRef.current = Date.now() + AUTH_RETRY_BACKOFF_MS;
      authRetryStateRef.current = "signed-out";
      setState("signed-out");
    } else if (result.status === "unconfigured") {
      authRetryAfterRef.current = Date.now() + AUTH_RETRY_BACKOFF_MS;
      authRetryStateRef.current = "error";
      setState("error");
    } else if (result.status === "disabled") {
      authRetryStateRef.current = "signed-out";
      setState("disabled");
    } else {
      authRetryStateRef.current = "error";
      setState("error");
    }
    void refreshPendingStatus();
  }, [gateAccountSync, refreshPendingStatus, runSync]);

  useEffect(() => {
    if (!dbReady) return;
    let quickSyncTimer: number | undefined;
    const scheduleQuickSync = (delayMs: number) => {
      if (quickSyncTimer !== undefined) window.clearTimeout(quickSyncTimer);
      quickSyncTimer = window.setTimeout(() => {
        void runSync({ quick: true });
      }, delayMs);
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
    const handleConfig = () => void runSync({ forceLease: true, quick: true });
    const handleVisible = () => {
      if (document.visibilityState === "visible") {
        void runSync({ forceLease: true, quick: true });
      }
    };
    const handleForeground = () => {
      void runSync({ forceLease: true, quick: true });
    };
    const handleLocalCacheRecovery = () => void recoverLocalCacheFromCloud();
    const handleLocalCacheRecoveryStorage = (event: StorageEvent) => {
      if (event.key === LOCAL_CACHE_RECOVERY_SIGNAL_KEY && event.newValue) {
        void recoverLocalCacheFromCloud();
      }
      if (event.key?.startsWith("zhinote.databasesync.")) {
        void refreshPendingStatus();
        if (DATABASE_PENDING_STORAGE_KEYS.has(event.key ?? "")) {
          scheduleQuickSync(PENDING_STATUS_SYNC_DELAY_MS);
        }
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
        setPendingStatus(detail);
        const totalPending =
          detail.pending + detail.queued + detail.syncLogPending;
        if (detail.enabled && totalPending > 0) {
          scheduleQuickSync(PENDING_STATUS_SYNC_DELAY_MS);
        }
      } else {
        void refreshPendingStatus();
      }
    };
    window.addEventListener(DATABASE_SYNC_CONFIG_EVENT, handleConfig);
    window.addEventListener(DATABASE_SYNC_STATUS_EVENT, handleStatus);
    window.addEventListener(LOCAL_CACHE_RECOVERY_EVENT, handleLocalCacheRecovery);
    window.addEventListener("storage", handleLocalCacheRecoveryStorage);
    window.addEventListener(
      DATABASE_LOCAL_UPDATE_EVENT,
      handleLocalDatabaseUpdate
    );
    window.addEventListener("focus", handleForeground);
    window.addEventListener("online", handleForeground);
    document.addEventListener("visibilitychange", handleVisible);
    return () => {
      if (quickSyncTimer !== undefined) window.clearTimeout(quickSyncTimer);
      window.clearTimeout(initialSyncTimer);
      window.clearInterval(interval);
      window.removeEventListener(DATABASE_SYNC_CONFIG_EVENT, handleConfig);
      window.removeEventListener(DATABASE_SYNC_STATUS_EVENT, handleStatus);
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
      window.removeEventListener("online", handleForeground);
      document.removeEventListener("visibilitychange", handleVisible);
    };
  }, [dbReady, recoverLocalCacheFromCloud, refreshPendingStatus, runSync]);

  return { state, lastSyncAt, pendingStatus, syncNow: runSync };
}
