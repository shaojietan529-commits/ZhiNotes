"use client";

// Runs account database cloud sync in the background while the app is open.
// It uses the local sync_log as a low-cost pending queue, pulls cloud changes
// by cursor, and lets only one visible tab hold the polling lease.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getLocalCacheRecoverySignal,
  LOCAL_CACHE_RECOVERY_EVENT,
} from "@/lib/db/local/client";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import {
  DATABASE_SYNC_CONFIG_EVENT,
  getLastDatabaseSyncAt,
  isDatabaseSyncEnabled,
  reconcileDatabaseSync,
  syncCloudDatabaseMetadataDelta,
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
const AUTH_RETRY_BACKOFF_MS = 2 * 60 * 1000;
const LEASE_KEY = "zhinote.databasesync.leaderLease.v1";
const LEASE_TTL_MS = 22 * 1000;

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
  const runningRef = useRef(false);
  const authRetryAfterRef = useRef(0);
  const seenLocalCacheRecoverySignalRef = useRef<string | null>(null);

  const runSync = useCallback(
    async (options: { forceLease?: boolean; quick?: boolean } = {}) => {
      if (!isDatabaseSyncEnabled()) {
        setState("disabled");
        return;
      }
      if (!options.forceLease && Date.now() < authRetryAfterRef.current) {
        setState("signed-out");
        return;
      }
      if (!claimSyncLease(options.forceLease)) {
        const last = getLastDatabaseSyncAt();
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
        const result = await reconcileDatabaseSync({ quick: options.quick });
        if (result.status === "ok") {
          authRetryAfterRef.current = 0;
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
      }
    },
    []
  );

  const recoverLocalCacheFromCloud = useCallback(async () => {
    const signal = getLocalCacheRecoverySignal();
    if (!signal || seenLocalCacheRecoverySignalRef.current === signal.id) {
      return;
    }
    seenLocalCacheRecoverySignalRef.current = signal.id;
    if (!isDatabaseSyncEnabled()) return;
    const result = await syncCloudDatabaseMetadataDelta({
      fullRefresh: true,
    });
    if (result.status === "ok") {
      setState("synced");
      setLastSyncAt(getLastDatabaseSyncAt());
      if (result.pulled > 0) {
        emitDatabasesUpdated("cloud-pull", result.pulled, result.records);
      }
      void runSync({ forceLease: true, quick: true });
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
  }, [runSync]);

  useEffect(() => {
    if (!dbReady) return;
    let editSyncTimer: number | undefined;
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
      if (document.visibilityState === "visible") void runSync({ quick: true });
    };
    const handleForeground = () => void runSync({ quick: true });
    const handleLocalCacheRecovery = () => void recoverLocalCacheFromCloud();
    const handleLocalDatabaseUpdate = (event: Event) => {
      const message = (event as CustomEvent<DatabaseUpdateMessage>).detail;
      if (message?.reason !== "local-refresh") return;
      if (editSyncTimer !== undefined) window.clearTimeout(editSyncTimer);
      editSyncTimer = window.setTimeout(() => {
        void runSync({ quick: true });
      }, EDIT_DEBOUNCE_MS);
    };
    window.addEventListener(DATABASE_SYNC_CONFIG_EVENT, handleConfig);
    window.addEventListener(LOCAL_CACHE_RECOVERY_EVENT, handleLocalCacheRecovery);
    window.addEventListener(
      DATABASE_LOCAL_UPDATE_EVENT,
      handleLocalDatabaseUpdate
    );
    window.addEventListener("focus", handleForeground);
    window.addEventListener("online", handleForeground);
    document.addEventListener("visibilitychange", handleVisible);
    return () => {
      if (editSyncTimer !== undefined) window.clearTimeout(editSyncTimer);
      window.clearTimeout(initialSyncTimer);
      window.clearInterval(interval);
      window.removeEventListener(DATABASE_SYNC_CONFIG_EVENT, handleConfig);
      window.removeEventListener(
        LOCAL_CACHE_RECOVERY_EVENT,
        handleLocalCacheRecovery
      );
      window.removeEventListener(
        DATABASE_LOCAL_UPDATE_EVENT,
        handleLocalDatabaseUpdate
      );
      window.removeEventListener("focus", handleForeground);
      window.removeEventListener("online", handleForeground);
      document.removeEventListener("visibilitychange", handleVisible);
    };
  }, [dbReady, recoverLocalCacheFromCloud, runSync]);

  return { state, lastSyncAt, syncNow: runSync };
}
