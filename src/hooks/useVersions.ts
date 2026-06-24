"use client";

import { useState, useEffect, useCallback } from "react";
import { getVersions } from "@/lib/db/local/queries";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { PageVersion } from "@/lib/utils/types";

interface UseVersionsOptions {
  enabled?: boolean;
}

interface RefreshVersionsOptions {
  force?: boolean;
}

export function useVersions(
  pageId: string | null,
  options: UseVersionsOptions = {}
) {
  const [versions, setVersions] = useState<PageVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const dbReady = useWorkspaceStore((s) => s.dbReady);
  const enabled = options.enabled ?? true;

  const load = useCallback(async (loadOptions: RefreshVersionsOptions = {}) => {
    const shouldLoad = enabled || loadOptions.force === true;
    if (!pageId || !dbReady || !shouldLoad) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const v = await getVersions(pageId);
    setVersions(v);
    setLoading(false);
  }, [pageId, dbReady, enabled]);

  useEffect(() => {
    queueMicrotask(() => {
      setVersions([]);
    });
  }, [pageId]);

  useEffect(() => {
    if (!enabled) {
      queueMicrotask(() => {
        setLoading(false);
      });
      return;
    }
    queueMicrotask(() => {
      load();
    });
  }, [enabled, load]);

  return { versions, loading, refresh: load };
}
