"use client";

import { useCallback, useEffect, useState } from "react";
import { getAllDatabases } from "@/lib/db/local/queries";
import { syncCloudDatabaseMetadata } from "@/lib/database/accountDatabaseSync";
import {
  emitDatabasesUpdated,
  subscribeDatabasesUpdated,
  type DatabaseUpdateMessage,
} from "@/lib/database/databaseUpdateBus";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { Database } from "@/lib/utils/types";
import type { CloudDatabaseRecord } from "@/lib/database/accountDatabaseSync";

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
        const cloud = await syncCloudDatabaseMetadata({
          restoreLocalCursor: all.length > 0,
        });
        if (cloud.status === "ok") {
          all = mergeDatabaseMetadata(all, cloud.records);
          if (cloud.cacheWriteFailed && all.length === 0) {
            all = mergeDatabaseMetadata([], cloud.records);
          }
          setDatabases(all);
          if (cloud.pulled > 0 && options.broadcast !== false) {
            emitDatabasesUpdated("cloud-pull", cloud.pulled, cloud.records);
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
    const unsubscribe = subscribeDatabasesUpdated(
      (message: DatabaseUpdateMessage) => {
        if (message.reason === "cloud-pull" && message.records?.length) {
          setDatabases((current) =>
            mergeDatabaseMetadata(current, message.records ?? [])
          );
          return;
        }
        if (timer !== null) window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          void refresh({ broadcast: false });
        }, 120);
      }
    );
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      unsubscribe();
    };
  }, [dbReady, refresh]);

  return { databases, refresh };
}

function mergeDatabaseMetadata(
  current: Database[],
  records: CloudDatabaseRecord[]
): Database[] {
  if (records.length === 0) return current;
  const byId = new Map(current.map((database) => [database.id, database]));
  for (const record of records) {
    if (record.type !== "database") continue;
    if (record.deleted_at) {
      byId.delete(record.id);
      continue;
    }
    byId.set(record.id, {
      id: record.id,
      owner_id: record.owner_id,
      parent_page_id: record.parent_page_id,
      title: record.title || "未命名数据库",
      icon: record.icon,
      description: record.description,
      created_at: record.created_at,
      updated_at: record.updated_at,
      deleted_at: record.deleted_at,
      sync_version: 1,
    });
  }
  return [...byId.values()].sort((a, b) =>
    b.updated_at.localeCompare(a.updated_at)
  );
}
