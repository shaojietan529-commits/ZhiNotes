"use client";

import { useState, useEffect, useCallback } from "react";
import {
  applyRemotePages,
  getPage,
  createPage,
  deletePage,
  type RemotePageRecord,
} from "@/lib/db/local/queries";
import {
  fetchCloudPageById,
  pageToRemoteRecord,
  pushCloudPages,
  queueCloudPageDelete,
  queueCloudPagePush,
} from "@/lib/pages/accountPageSync";
import {
  clearPendingPageDraft,
  readPendingPageDraft,
} from "@/lib/pages/pendingPageDrafts";
import { DEFAULT_OWNER_ID } from "@/lib/utils/id";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { usePageRecordRevision } from "@/hooks/usePageRevision";
import type { Page } from "@/lib/utils/types";

type PageUpdates = Partial<
  Pick<
    Page,
    | "title"
    | "icon"
    | "cover_url"
    | "content_text"
    | "properties"
    | "parent_id"
    | "position"
    | "depth"
  >
>;

interface UsePageOptions {
  enabled?: boolean;
}

export function usePage(
  pageId: string | null,
  options: UsePageOptions = {}
) {
  const enabled = options.enabled ?? true;
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const dbReady = useWorkspaceStore((s) => s.dbReady);
  const upsertPages = useWorkspaceStore((s) => s.upsertPages);
  const pageRevision = usePageRecordRevision(pageId);

  const load = useCallback(async () => {
    if (!enabled || !pageId || !dbReady) {
      setPage(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    let localPage =
      readPendingPageDraft(pageId) ??
      useWorkspaceStore.getState().pages.find((item) => item.id === pageId) ??
      null;
    if (localPage) {
      setPage(localPage);
      setLoading(localPage.content_text == null);
    } else {
      setPage(null);
    }
    try {
      const storedPage = await getPage(pageId);
      if (storedPage) {
        localPage = storedPage;
        clearPendingPageDraft(pageId);
      }
    } catch {
      // Keep the in-memory page if IndexedDB is slow or temporarily failing.
    }

    if (localPage) {
      upsertPages([localPage]);
      setPage(localPage);
      setLoading(localPage.content_text == null);
    }

    if (localPage?.content_text != null) {
      void refreshPageFromCloud(pageId, localPage, setPage, upsertPages);
      setLoading(false);
      return;
    }

    try {
      const cloud = await fetchCloudPageById(pageId);
      if (cloud.status === "ok" && cloud.pages.length > 0) {
        const remoteRecord = cloud.pages[0];
        if (remoteIsAtLeastAsFresh(remoteRecord, localPage)) {
          const hydrated = await hydrateRemotePageIntoLocalCache(remoteRecord);
          clearPendingPageDraft(pageId);
          if (hydrated) upsertPages([hydrated]);
          setPage(hydrated);
        } else if (localPage) {
          queueCloudPagePush(localPage);
        }
      } else if (!localPage) {
        setPage(null);
      }
    } catch {
      if (!localPage) setPage(null);
    } finally {
      setLoading(false);
    }
  }, [enabled, pageId, dbReady, upsertPages]);

  useEffect(() => {
    queueMicrotask(() => {
      load();
    });
  }, [load, pageRevision]);

  const update = useCallback(
    async (updates: PageUpdates) => {
      if (!pageId) return null;
      let basePage = page;
      if (!basePage) {
        try {
          basePage = await getPage(pageId);
        } catch {
          basePage = null;
        }
      }
      if (!basePage) return null;

      const optimistic: Page = {
        ...basePage,
        ...updates,
        updated_at: new Date().toISOString(),
      };
      const record = pageToRemoteRecord(optimistic);

      setPage(optimistic);
      upsertPages([optimistic]);

      let shouldHydrateOptimisticRecord = true;
      try {
        const pushed = await pushCloudPages([record]);
        if (pushed.status !== "ok") {
          queueCloudPagePush(record);
        } else if (pushed.skipped.includes(record.id)) {
          shouldHydrateOptimisticRecord = false;
          void load();
        }
      } catch {
        queueCloudPagePush(record);
      }

      if (shouldHydrateOptimisticRecord) {
        const hydrated = await hydrateRemotePageIntoLocalCache(record);
        if (hydrated) {
          setPage(hydrated);
          upsertPages([hydrated]);
        }
        return hydrated ?? optimistic;
      }
      return optimistic;
    },
    [pageId, page, upsertPages, load]
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

async function refreshPageFromCloud(
  pageId: string,
  localPage: Page,
  setPage: (page: Page | null) => void,
  upsertPages: (pages: Page[]) => void
): Promise<void> {
  try {
    const cloud = await fetchCloudPageById(pageId);
    if (cloud.status !== "ok" || cloud.pages.length === 0) return;
    const remoteRecord = cloud.pages[0];
    if (remoteIsAtLeastAsFresh(remoteRecord, localPage)) {
      const hydrated = await hydrateRemotePageIntoLocalCache(remoteRecord);
      if (!hydrated) {
        setPage(null);
        return;
      }
      upsertPages([hydrated]);
      setPage(hydrated);
      return;
    }
    queueCloudPagePush(localPage);
  } catch {
    // Local content is already visible; a cloud refresh failure should not
    // block reading or editing.
  }
}

function remoteIsAtLeastAsFresh(
  remote: RemotePageRecord,
  local: Page | null
): boolean {
  if (!local) return true;
  return remote.updated_at >= local.updated_at;
}
