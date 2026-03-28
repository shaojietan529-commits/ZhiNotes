"use client";

import { useEffect } from "react";
import { getDb } from "@/lib/db/local/client";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export function useLocalDb() {
  const dbReady = useWorkspaceStore((s) => s.dbReady);
  const setDbReady = useWorkspaceStore((s) => s.setDbReady);

  useEffect(() => {
    if (dbReady) return;

    getDb()
      .then(() => {
        setDbReady(true);
        console.log("[Zhinote] Database ready");
      })
      .catch((err) => {
        console.error("[Zhinote] Failed to initialize database:", err);
      });
  }, [dbReady, setDbReady]);

  return { dbReady };
}
