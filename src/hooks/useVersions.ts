"use client";

import { useState, useEffect, useCallback } from "react";
import { getVersions } from "@/lib/db/local/queries";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { PageVersion } from "@/lib/utils/types";

export function useVersions(pageId: string | null) {
  const [versions, setVersions] = useState<PageVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const dbReady = useWorkspaceStore((s) => s.dbReady);

  const load = useCallback(async () => {
    if (!pageId || !dbReady) {
      setVersions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const v = await getVersions(pageId);
    setVersions(v);
    setLoading(false);
  }, [pageId, dbReady]);

  useEffect(() => {
    queueMicrotask(() => {
      load();
    });
  }, [load]);

  return { versions, loading, refresh: load };
}
