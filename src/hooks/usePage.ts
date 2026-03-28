"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getPage,
  createPage,
  updatePage,
  deletePage,
} from "@/lib/db/local/queries";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { Page } from "@/lib/utils/types";

export function usePage(pageId: string | null) {
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const dbReady = useWorkspaceStore((s) => s.dbReady);

  const load = useCallback(async () => {
    if (!pageId || !dbReady) {
      setPage(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const p = await getPage(pageId);
    setPage(p);
    setLoading(false);
  }, [pageId, dbReady]);

  useEffect(() => {
    load();
  }, [load]);

  const update = useCallback(
    async (
      updates: Parameters<typeof updatePage>[1]
    ) => {
      if (!pageId) return null;
      const updated = await updatePage(pageId, updates);
      if (updated) setPage(updated);
      return updated;
    },
    [pageId]
  );

  const remove = useCallback(async () => {
    if (!pageId) return;
    await deletePage(pageId);
    setPage(null);
  }, [pageId]);

  return { page, loading, reload: load, update, remove };
}

export { createPage, deletePage };
