"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  queueCloudPageDelete,
  queueCloudPagePush,
  type CloudPageLookupResult,
} from "@/lib/pages/accountPageSync";
import {
  clearPendingPageDraft,
  rememberPendingPageDraft,
  readPendingPageDraft,
} from "@/lib/pages/pendingPageDrafts";
import {
  clearPageRouteHandoff,
  readPageRouteHandoff,
} from "@/lib/pages/pageRouteHandoff";
import { emitPageSnapshotsUpdated } from "@/lib/pages/pageUpdateBus";
import { DEFAULT_OWNER_ID } from "@/lib/utils/id";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { usePageRecordRevision } from "@/hooks/usePageRevision";
import type { Page } from "@/lib/utils/types";

const PAGE_CLOUD_HYDRATION_IDLE_MS = 700;

interface OptimisticPageLocalCachePersistState {
  latest: RemotePageRecord;
  running: boolean;
}

const optimisticPageLocalCachePersistQueue = new Map<
  string,
  OptimisticPageLocalCachePersistState
>();

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
  const [initialLocalFirstPageSeed] = useState<Page | null>(() => {
    if (!enabled || !pageId) return null;
    return readLocalFirstPageSeed(pageId);
  });
  const [page, setPage] = useState<Page | null>(() => {
    return initialLocalFirstPageSeed;
  });
  const [loading, setLoading] = useState(() => {
    if (!enabled || !pageId) return false;
    return !initialLocalFirstPageSeed;
  });
  const dbReady = useWorkspaceStore((s) => s.dbReady);
  const upsertPages = useWorkspaceStore((s) => s.upsertPages);
  const pageRevision = usePageRecordRevision(pageId);
  const loadRequestRef = useRef(0);
  const visiblePageRef = useRef<Page | null>(initialLocalFirstPageSeed);

  const load = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    const isCurrentLoad = () => loadRequestRef.current === requestId;
    const setPageForCurrentLoad = (next: Page | null) => {
      if (isCurrentLoad()) {
        visiblePageRef.current = next;
        setPage(next);
      }
    };
    const setLoadingForCurrentLoad = (next: boolean) => {
      if (isCurrentLoad()) setLoading(next);
    };

    if (!enabled || !pageId) {
      setPageForCurrentLoad(null);
      setLoadingForCurrentLoad(false);
      return;
    }
    let localPage =
      visiblePageRef.current?.id === pageId
        ? visiblePageRef.current
        : readLocalFirstPageSeed(pageId);
    if (localPage) {
      upsertPages([localPage]);
      setPageForCurrentLoad(localPage);
      setLoadingForCurrentLoad(false);
    } else {
      setPageForCurrentLoad(null);
      setLoadingForCurrentLoad(true);
    }

    if (!dbReady) {
      setLoadingForCurrentLoad(!localPage);
      return;
    }

    try {
      const storedPage = await getPage(pageId);
      if (!isCurrentLoad()) return;
      if (storedPage) {
        localPage = storedPage;
        clearPendingPageDraft(pageId);
        clearPageRouteHandoff(pageId);
      }
    } catch {
      // Keep the in-memory page if IndexedDB is slow or temporarily failing.
    }

    if (localPage) {
      upsertPages([localPage]);
      setPageForCurrentLoad(localPage);
      setLoadingForCurrentLoad(false);
      schedulePageCloudHydration(
        pageId,
        () =>
          visiblePageRef.current?.id === pageId
            ? visiblePageRef.current
            : localPage,
        setPageForCurrentLoad,
        upsertPages
      );
      return;
    }

    try {
      const cloud = await fetchCloudPageById(pageId);
      if (!isCurrentLoad()) return;
      const cloudApplied = await applyCloudPageLookup(
        cloud,
        localPage,
        setPageForCurrentLoad,
        upsertPages
      );
      if (!isCurrentLoad()) return;
      if (cloudApplied) {
        clearPendingPageDraft(pageId);
        clearPageRouteHandoff(pageId);
      } else if (!localPage) {
        setPageForCurrentLoad(null);
      }
    } catch {
      if (!localPage) setPageForCurrentLoad(null);
    } finally {
      setLoadingForCurrentLoad(false);
    }
  }, [enabled, pageId, dbReady, upsertPages]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
      loadRequestRef.current += 1;
    };
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

      visiblePageRef.current = optimistic;
      setPage(optimistic);
      upsertPages([optimistic]);
      emitPageSnapshotsUpdated("cloud-push", [optimistic]);
      rememberPendingPageDraft(optimistic);

      queueCloudPagePush(record);
      queueOptimisticPageLocalCachePersist(record, upsertPages);
      return optimistic;
    },
    [pageId, page, upsertPages]
  );

  const remove = useCallback(async () => {
    if (!pageId) return null;
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
      if (snapshot) {
        const deletedSnapshot = {
          ...snapshot,
          deleted_at: deletedAt,
          updated_at: deletedAt,
        };
        upsertPages([deletedSnapshot]);
        emitPageSnapshotsUpdated("cloud-push", [deletedSnapshot]);
      }
      visiblePageRef.current = null;
      setPage(null);
    }
    return snapshot
      ? {
          ...snapshot,
          deleted_at: deletedAt,
          updated_at: deletedAt,
        }
      : null;
  }, [pageId, page, upsertPages]);

  return { page, loading, reload: load, update, remove };
}

function readLocalFirstPageSeed(pageId: string): Page | null {
  return (
    readPendingPageDraft(pageId) ??
    readPageRouteHandoff(pageId) ??
    useWorkspaceStore.getState().getPageById(pageId) ??
    null
  );
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

function queueOptimisticPageLocalCachePersist(
  record: RemotePageRecord,
  upsertPages: (pages: Page[]) => void
): void {
  const queued = optimisticPageLocalCachePersistQueue.get(record.id);
  if (queued) {
    queued.latest = record;
    return;
  }
  optimisticPageLocalCachePersistQueue.set(record.id, {
    latest: record,
    running: false,
  });
  void drainOptimisticPageLocalCachePersistQueue(record.id, upsertPages);
}

async function drainOptimisticPageLocalCachePersistQueue(
  pageId: string,
  upsertPages: (pages: Page[]) => void
): Promise<void> {
  const queued = optimisticPageLocalCachePersistQueue.get(pageId);
  if (!queued || queued.running) return;

  queued.running = true;
  try {
    while (optimisticPageLocalCachePersistQueue.get(pageId) === queued) {
      const record = queued.latest;
      const hydrated = await hydrateRemotePageIntoLocalCache(record);
      const stillQueued = optimisticPageLocalCachePersistQueue.get(pageId);
      if (stillQueued !== queued) return;
      if (queued.latest !== record) continue;

      if (hydrated) {
        clearPendingPageDraft(record.id);
        upsertPages([hydrated]);
      }
      optimisticPageLocalCachePersistQueue.delete(pageId);
      return;
    }
  } finally {
    const current = optimisticPageLocalCachePersistQueue.get(pageId);
    if (current) {
      current.running = false;
      void drainOptimisticPageLocalCachePersistQueue(pageId, upsertPages);
    }
  }
}

async function refreshPageFromCloud(
  pageId: string,
  getLocalPage: () => Page | null,
  setPage: (page: Page | null) => void,
  upsertPages: (pages: Page[]) => void
): Promise<void> {
  try {
    const cloud = await fetchCloudPageById(pageId);
    const latestLocalPage = getLocalPage();
    await applyCloudPageLookup(cloud, latestLocalPage, setPage, upsertPages);
  } catch {
    // Local content is already visible; a cloud refresh failure should not
    // block reading or editing.
  }
}

function schedulePageCloudHydration(
  pageId: string,
  getLocalPage: () => Page | null,
  setPage: (page: Page | null) => void,
  upsertPages: (pages: Page[]) => void
): void {
  const run = () => {
    void refreshPageFromCloud(pageId, getLocalPage, setPage, upsertPages);
  };
  if (typeof window === "undefined") {
    run();
    return;
  }
  const maybeWindow = window as Window & {
    requestIdleCallback?: (
      callback: () => void,
      options?: { timeout?: number }
    ) => number;
  };
  if (maybeWindow.requestIdleCallback) {
    maybeWindow.requestIdleCallback(run, {
      timeout: PAGE_CLOUD_HYDRATION_IDLE_MS,
    });
    return;
  }
  window.setTimeout(run, Math.min(PAGE_CLOUD_HYDRATION_IDLE_MS, 160));
}

async function applyCloudPageLookup(
  cloud: CloudPageLookupResult | null,
  localPage: Page | null,
  setPage: (page: Page | null) => void,
  upsertPages: (pages: Page[]) => void
): Promise<boolean> {
  if (!cloud || cloud.status !== "ok" || cloud.pages.length === 0) {
    return false;
  }
  const remoteRecord = cloud.pages[0];
  if (remoteIsAtLeastAsFresh(remoteRecord, localPage)) {
    const hydrated = await hydrateRemotePageIntoLocalCache(remoteRecord);
    if (!hydrated) {
      setPage(null);
      return true;
    }
    upsertPages([hydrated]);
    setPage(hydrated);
    return true;
  }
  if (localPage) {
    queueCloudPagePush(localPage);
    return true;
  }
  return false;
}

function remoteIsAtLeastAsFresh(
  remote: RemotePageRecord,
  local: Page | null
): boolean {
  if (!local) return true;
  return remote.updated_at >= local.updated_at;
}
