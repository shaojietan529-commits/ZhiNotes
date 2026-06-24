"use client";

// Runs account database cloud sync in the background while the app is open.
// It uses the local sync_log as a low-cost pending queue, pulls cloud changes
// by cursor, and lets only one visible tab hold the polling lease.

import { useCallback, useEffect, useRef, useState } from "react";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import {
  DATABASE_SYNC_CONFIG_EVENT,
  getLastDatabaseSyncAt,
  isDatabaseSyncEnabled,
  reconcileDatabaseSync,
} from "@/lib/database/accountDatabaseSync";
import {
  emitDatabasesUpdated,
  getDatabaseUpdateClientId,
} from "@/lib/database/databaseUpdateBus";

const SYNC_INTERVAL_MS = 10 * 1000;
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
  window.localStorage.setItem(
    LEASE_KEY,
    JSON.stringify({ owner, until: now + LEASE_TTL_MS })
  );
  try {
    const confirmed = JSON.parse(
      window.localStorage.getItem(LEASE_KEY) ?? "{}"
    ) as { owner?: string };
    return confirmed.owner === owner;
  } catch {
    return true;
  }
}

export function useDatabaseCloudSync() {
  const dbReady = useWorkspaceStore((s) => s.dbReady);
  const [state, setState] = useState<DatabaseCloudSyncState>("disabled");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const runningRef = useRef(false);

  const runSync = useCallback(
    async (options: { forceLease?: boolean; quick?: boolean } = {}) => {
      if (!isDatabaseSyncEnabled()) {
        setState("disabled");
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
          setState("synced");
          setLastSyncAt(getLastDatabaseSyncAt());
          if (result.pulled > 0) {
            emitDatabasesUpdated("cloud-pull", result.pulled);
          } else if (result.pushed > 0) {
            emitDatabasesUpdated("cloud-push", result.pushed);
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
    },
    []
  );

  useEffect(() => {
    if (!dbReady) return;
    void runSync({ quick: true });
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
    window.addEventListener(DATABASE_SYNC_CONFIG_EVENT, handleConfig);
    window.addEventListener("focus", handleForeground);
    window.addEventListener("online", handleForeground);
    document.addEventListener("visibilitychange", handleVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener(DATABASE_SYNC_CONFIG_EVENT, handleConfig);
      window.removeEventListener("focus", handleForeground);
      window.removeEventListener("online", handleForeground);
      document.removeEventListener("visibilitychange", handleVisible);
    };
  }, [dbReady, runSync]);

  return { state, lastSyncAt, syncNow: runSync };
}
