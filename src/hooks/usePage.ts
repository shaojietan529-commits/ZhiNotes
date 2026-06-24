"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getPage,
  createPage,
  updatePage,
  deletePage,
  type RemotePageRecord,
} from "@/lib/db/local/queries";
import {
  fetchCloudPageById,
  queueCloudPagePush,
} from "@/lib/pages/accountPageSync";
import { DEFAULT_OWNER_ID } from "@/lib/utils/id";
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
    let p: Page | null = null;
    try {
      p = await getPage(pageId);
    } catch {
      p = null;
    }
    if (!p || p.content_text === null) {
      const cloud = await fetchCloudPageById(pageId);
      if (cloud.status === "ok" && cloud.pages.length > 0) {
        p = remoteRecordToPage(cloud.pages[0]);
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
      try {
        const updated = await updatePage(pageId, updates);
        if (updated) {
          setPage(updated);
          queueCloudPagePush(updated);
        }
        return updated;
      } catch {
        if (!page) return null;
        const fallback: Page = {
          ...page,
          ...updates,
          updated_at: new Date().toISOString(),
        };
        setPage(fallback);
        queueCloudPagePush(fallback);
        return fallback;
      }
    },
    [pageId, page]
  );

  const remove = useCallback(async () => {
    if (!pageId) return;
    await deletePage(pageId);
    setPage(null);
  }, [pageId]);

  return { page, loading, reload: load, update, remove };
}

export { createPage, deletePage };

function remoteRecordToPage(record: RemotePageRecord): Page {
  return {
    id: record.id,
    owner_id: DEFAULT_OWNER_ID,
    parent_id: record.parent_id,
    database_id: null,
    title: record.title,
    icon: record.icon,
    cover_url: record.cover_url,
    content_yjs: null,
    content_text: record.content_text,
    properties: record.properties,
    position: record.position,
    depth: record.depth,
    created_at: record.created_at,
    updated_at: record.updated_at,
    deleted_at: record.deleted_at,
    sync_version: 1,
  };
}
