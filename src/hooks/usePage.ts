"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getPage,
  createPage,
  updatePage,
  deletePage,
} from "@/lib/db/local/queries";
import { pullCloudPageById } from "@/lib/pages/accountPageSync";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { usePageRecordRevision } from "@/hooks/usePageRevision";
import type { Page } from "@/lib/utils/types";

export function usePage(pageId: string | null) {
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const dbReady = useWorkspaceStore((s) => s.dbReady);
  const pageRevision = usePageRecordRevision(pageId);

  const load = useCallback(async () => {
    if (!pageId || !dbReady) {
      setPage(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    let p = await getPage(pageId);
    if (!p || p.content_text === null) {
      const pulled = await pullCloudPageById(pageId);
      if (pulled.status === "ok" && pulled.pulled > 0) {
        p = await getPage(pageId);
      }
    }
    setPage(p);
    setLoading(false);
  }, [pageId, dbReady]);

  useEffect(() => {
    queueMicrotask(() => {
      load();
    });
  }, [load, pageRevision]);

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
