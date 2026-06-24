"use client";

import { useState, useEffect, useCallback } from "react";
import {
  applyRemotePages,
  getPage,
  createPage,
  updatePage,
  deletePage,
  type RemotePageRecord,
} from "@/lib/db/local/queries";
import {
  fetchCloudPageById,
  queueCloudPageDelete,
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
  const upsertPages = useWorkspaceStore((s) => s.upsertPages);
  const pageRevision = usePageRecordRevision(pageId);

  const load = useCallback(async () => {
    if (!pageId || !dbReady) {
      setPage(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    let localPage: Page | null = null;
    try {
      localPage = await getPage(pageId);
    } catch {
      localPage = null;
    }

    if (localPage) {
      upsertPages([localPage]);
      setPage(localPage);
      setLoading(false);
    }

    const cloud = await fetchCloudPageById(pageId);
    if (cloud.status === "ok" && cloud.pages.length > 0) {
      const remoteRecord = cloud.pages[0];
      if (remoteIsAtLeastAsFresh(remoteRecord, localPage)) {
        const hydrated = await hydrateRemotePageIntoLocalCache(remoteRecord);
        if (hydrated) upsertPages([hydrated]);
        setPage(hydrated);
      } else if (localPage) {
        queueCloudPagePush(localPage);
      }
    } else if (!localPage) {
      setPage(null);
    }

    setLoading(false);
  }, [pageId, dbReady, upsertPages]);

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
    let snapshot = page;
    if (!snapshot) {
      try {
        snapshot = await getPage(pageId);
      } catch {
        snapshot = null;
      }
    }
    const deletedAt = new Date().toISOString();
    try {
      await deletePage(pageId);
    } finally {
      if (snapshot) queueCloudPageDelete(snapshot, deletedAt);
      setPage(null);
    }
  }, [pageId, page]);

  return { page, loading, reload: load, update, remove };
}

async function deletePageWithCloud(id: string): Promise<void> {
  let snapshot: Page | null = null;
  try {
    snapshot = await getPage(id);
  } catch {
    snapshot = null;
  }
  const deletedAt = new Date().toISOString();
  try {
    await deletePage(id);
  } finally {
    if (snapshot) queueCloudPageDelete(snapshot, deletedAt);
  }
}

export { createPage, deletePageWithCloud as deletePage };

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

async function hydrateRemotePageIntoLocalCache(
  record: RemotePageRecord
): Promise<Page | null> {
  try {
    await applyRemotePages([record]);
    return await getPage(record.id);
  } catch {
    // Local cache can fail after quota / SQLite issues. The cloud record still
    // renders so reading is not blocked by a broken browser cache.
    if (record.deleted_at) return null;
    return remoteRecordToPage(record);
  }
}

function remoteIsAtLeastAsFresh(
  remote: RemotePageRecord,
  local: Page | null
): boolean {
  if (!local) return true;
  return remote.updated_at >= local.updated_at;
}
