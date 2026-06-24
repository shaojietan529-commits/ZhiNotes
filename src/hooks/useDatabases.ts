"use client";

import { useCallback, useEffect, useState } from "react";
import { getAllDatabases } from "@/lib/db/local/queries";
import { syncCloudDatabaseMetadata } from "@/lib/database/accountDatabaseSync";
import {
  emitDatabasesUpdated,
  subscribeDatabasesUpdated,
} from "@/lib/database/databaseUpdateBus";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { Database } from "@/lib/utils/types";

interface RefreshDatabaseOptions {
  broadcast?: boolean;
}

export function useDatabases() {
  const dbReady = useWorkspaceStore((s) => s.dbReady);
  const [databases, setDatabases] = useState<Database[]>([]);

  const refresh = useCallback(
    async (options: RefreshDatabaseOptions = {}) => {
      if (!dbReady) return [];
      let all: Database[] = [];
      try {
        all = await getAllDatabases();
      } catch {
        // Treat local SQLite as a cache: if it is cold or temporarily broken,
        // still attempt cloud metadata below instead of blocking navigation.
      }
      setDatabases(all);

      try {
        const cloud = await syncCloudDatabaseMetadata();
        if (cloud.status === "ok") {
          try {
            all = await getAllDatabases();
          } catch {
            all = [];
          }
          setDatabases(all);
          if (cloud.pulled > 0 && options.broadcast !== false) {
            emitDatabasesUpdated("cloud-pull", cloud.pulled);
          }
        }
      } catch {
        // The local database list is already visible. Cloud metadata refresh is
        // best effort so a broken browser cache or missing cloud config cannot
        // block navigation.
      }

      return all;
    },
    [dbReady]
  );

  useEffect(() => {
    queueMicrotask(() => {
      void refresh({ broadcast: false });
    });
  }, [refresh]);

  useEffect(() => {
    if (!dbReady) return;
    let timer: number | null = null;
    const unsubscribe = subscribeDatabasesUpdated(() => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void refresh({ broadcast: false });
      }, 120);
    });
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      unsubscribe();
    };
  }, [dbReady, refresh]);

  return { databases, refresh };
}
