"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type MutableRefObject,
} from "react";
import {
  applyRemotePages,
  getPage,
  getPageMetadata,
  createPage,
  deletePage,
  type RemotePageRecord,
} from "@/lib/db/local/queries";
import type { CloudPageLookupResult } from "@/lib/pages/accountPageSync";
import {
  clearPendingPageDraft,
  rememberPendingPageDraft,
  readPendingPageDraft,
} from "@/lib/pages/pendingPageDrafts";
import {
  clearPageRouteHandoff,
  readPageRouteHandoff,
  readPageRouteHandoffSource,
  type PageRouteHandoffSource,
} from "@/lib/pages/pageRouteHandoff";
import {
  publishPageBodyHydrationStatus,
  type PageBodyHydrationPhase,
  type PageBodyHydrationSurface,
} from "@/lib/pages/pageBodyHydrationStatus";
import {
  emitPageSnapshotsUpdated,
  subscribePagesUpdated,
  type PageUpdatePayload,
} from "@/lib/pages/pageUpdateBus";
import { DEFAULT_OWNER_ID } from "@/lib/utils/id";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { usePageRecordRevision } from "@/hooks/usePageRevision";
import type { Page } from "@/lib/utils/types";

const PAGE_CLOUD_HYDRATION_IDLE_MS = 700;
const PAGE_LOCAL_BODY_HYDRATION_IDLE_MS = 220;
const PAGE_INTERACTIVE_LOCAL_BODY_HYDRATION_DELAY_MS = 24;
const PAGE_INTERACTIVE_LOCAL_BODY_HYDRATION_IDLE_MS = 80;
const MAX_REMOTE_COVER_CHARS = 300 * 1024;
const loadPageAccountSyncModule = () => import("@/lib/pages/accountPageSync");

type PageLocalBodyHydrationPriority = "background" | "interactive";

interface OptimisticPageLocalCachePersistState {
  latest: RemotePageRecord;
  running: boolean;
}

const optimisticPageLocalCachePersistQueue = new Map<
  string,
  OptimisticPageLocalCachePersistState
>();

interface PageCloudHydrationJob {
  pageId: string;
  getLocalPage: () => Page | null;
  setPage: (page: Page | null) => void;
  upsertPages: (pages: Page[]) => void;
  surface: PageBodyHydrationSurface;
}

interface PageLocalBodyHydrationJob extends PageCloudHydrationJob {
  isCurrentLoad: () => boolean;
}

interface PageLocalBodyHydrationState {
  latest: PageLocalBodyHydrationJob;
  rerun: boolean;
}

interface PageCloudHydrationState {
  latest: PageCloudHydrationJob;
  rerun: boolean;
}

const pageLocalBodyHydrationQueue = new Map<
  string,
  PageLocalBodyHydrationState
>();
const pageCloudHydrationQueue = new Map<string, PageCloudHydrationState>();

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
  surface?: PageBodyHydrationSurface;
}

export function usePage(
  pageId: string | null,
  options: UsePageOptions = {}
) {
  const enabled = options.enabled ?? true;
  const surface = options.surface ?? "full-page";
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
    const localBodyHydrationPriority = getPageLocalBodyHydrationPriority(
      readPageRouteHandoffSource(pageId)
    );
    let localPage =
      visiblePageRef.current?.id === pageId
        ? visiblePageRef.current
        : readLocalFirstPageSeed(pageId);
    if (localPage) {
      upsertPages([localPage]);
      setPageForCurrentLoad(localPage);
      setLoadingForCurrentLoad(false);
      publishPageBodyHydrationForSnapshot(
        localPage,
        localPage.content_text == null ? "metadata-ready" : "local-body-ready",
        surface
      );
    } else {
      setPageForCurrentLoad(null);
      setLoadingForCurrentLoad(true);
    }

    if (!dbReady) {
      setLoadingForCurrentLoad(!localPage);
      return;
    }

    if (!localPage) {
      try {
        localPage = await getPageMetadata(pageId);
        if (!isCurrentLoad()) return;
        if (localPage) {
          upsertPages([localPage]);
          setPageForCurrentLoad(localPage);
          setLoadingForCurrentLoad(false);
          publishPageBodyHydrationForSnapshot(
            localPage,
            "metadata-ready",
            surface
          );
        }
      } catch {
        // Keep the route skeleton visible while cloud lookup gets a chance.
      }
    }

    if (localPage) {
      if (localPage.content_text == null) {
        schedulePageLocalBodyHydration(
          pageId,
          isCurrentLoad,
          () =>
            visiblePageRef.current?.id === pageId
              ? visiblePageRef.current
              : localPage,
          setPageForCurrentLoad,
          upsertPages,
          surface,
          localBodyHydrationPriority
        );
        return;
      }
      schedulePageCloudHydration(
        pageId,
        () =>
          visiblePageRef.current?.id === pageId
            ? visiblePageRef.current
            : localPage,
        setPageForCurrentLoad,
        upsertPages,
        surface
      );
      return;
    }

    try {
      publishPageBodyHydrationStatus({
        pageId,
        phase: "cloud-body-requested",
        surface,
        metadataOnly: true,
      });
      const cloud = await fetchCloudPageByIdWithAccountSync(pageId);
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
        const latest =
          visiblePageRef.current?.id === pageId ? visiblePageRef.current : null;
        if (latest) {
          publishPageBodyHydrationForSnapshot(
            latest,
            latest.content_text == null ? "empty-ready" : "cloud-body-ready",
            surface
          );
        }
      } else if (!localPage) {
        setPageForCurrentLoad(null);
        publishPageBodyHydrationStatus({
          pageId,
          phase: "unavailable",
          surface,
          metadataOnly: true,
        });
      }
    } catch {
      if (!localPage) {
        setPageForCurrentLoad(null);
        publishPageBodyHydrationStatus({
          pageId,
          phase: "unavailable",
          surface,
          metadataOnly: true,
        });
      }
    } finally {
      setLoadingForCurrentLoad(false);
    }
  }, [enabled, pageId, dbReady, upsertPages, surface]);

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

  useEffect(() => {
    if (!enabled || !pageId || !dbReady) return;
    let localReloadTimer: number | null = null;
    let fallbackReloadTimer: number | null = null;
    const scheduleLocalReload = () => {
      if (localReloadTimer !== null) window.clearTimeout(localReloadTimer);
      if (fallbackReloadTimer !== null) window.clearTimeout(fallbackReloadTimer);
      localReloadTimer = window.setTimeout(() => {
        void load();
      }, 120);
      fallbackReloadTimer = window.setTimeout(() => {
        void load();
      }, 900);
    };
    const unsubscribe = subscribePagesUpdated((message) => {
      const matchedPayload = message.pages?.find((item) => item.id === pageId);
      if (matchedPayload) {
        applyCrossTabPageMetadata(
          matchedPayload,
          visiblePageRef,
          setPage,
          upsertPages
        );
        scheduleLocalReload();
        return;
      }
      if (!message.pages || message.pages.length === 0) {
        scheduleLocalReload();
      }
    });
    return () => {
      if (localReloadTimer !== null) window.clearTimeout(localReloadTimer);
      if (fallbackReloadTimer !== null) window.clearTimeout(fallbackReloadTimer);
      unsubscribe();
    };
  }, [enabled, pageId, dbReady, load, upsertPages]);

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
      if (Object.prototype.hasOwnProperty.call(updates, "content_text")) {
        publishPageBodyHydrationForSnapshot(
          optimistic,
          optimistic.content_text == null ? "empty-ready" : "local-body-ready",
          surface
        );
      }

      void queueCloudPagePushWithAccountSync(record);
      queueOptimisticPageLocalCachePersist(record, upsertPages);
      return optimistic;
    },
    [pageId, page, upsertPages, surface]
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
      if (snapshot) void queueCloudPageDeleteWithAccountSync(snapshot, deletedAt);
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
    readPageRouteHandoff(pageId) ??
    readPendingPageDraft(pageId) ??
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
    if (snapshot) void queueCloudPageDeleteWithAccountSync(snapshot, deletedAt);
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

function pageUpdatePayloadToPage(
  payload: PageUpdatePayload,
  current: Page | null
): Page {
  return {
    id: payload.id,
    owner_id: current?.owner_id ?? DEFAULT_OWNER_ID,
    parent_id: payload.parent_id,
    database_id: current?.database_id ?? null,
    title: payload.title,
    icon: payload.icon,
    cover_url: payload.cover_url,
    content_yjs: current?.content_yjs ?? null,
    content_text: current?.content_text ?? null,
    properties: payload.properties,
    position: payload.position,
    depth: payload.depth,
    created_at: payload.created_at,
    updated_at: payload.updated_at,
    deleted_at: payload.deleted_at,
    sync_version: current?.sync_version ?? 1,
  };
}

function applyCrossTabPageMetadata(
  payload: PageUpdatePayload,
  visiblePageRef: MutableRefObject<Page | null>,
  setPage: (page: Page | null) => void,
  upsertPages: (pages: Page[]) => void
): void {
  const current = visiblePageRef.current;
  if (payload.deleted_at) {
    visiblePageRef.current = null;
    setPage(null);
    upsertPages([pageUpdatePayloadToPage(payload, current)]);
    return;
  }
  const nextPage = pageUpdatePayloadToPage(payload, current);
  visiblePageRef.current = nextPage;
  setPage(nextPage);
  upsertPages([nextPage]);
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
  upsertPages: (pages: Page[]) => void,
  surface: PageBodyHydrationSurface
): Promise<void> {
  publishPageBodyHydrationStatus({
    pageId,
    phase: "cloud-body-requested",
    surface,
    metadataOnly: getLocalPage()?.content_text == null,
  });
  try {
    const cloud = await fetchCloudPageByIdWithAccountSync(pageId);
    const latestLocalPage = getLocalPage();
    const cloudApplied = await applyCloudPageLookup(cloud, latestLocalPage, setPage, upsertPages);
    const latest = getLocalPage();
    if (cloudApplied && latest) {
      publishPageBodyHydrationForSnapshot(
        latest,
        latest.content_text == null ? "empty-ready" : "cloud-body-ready",
        surface
      );
    } else if (!cloudApplied && latest?.content_text == null) {
      publishPageBodyHydrationStatus({
        pageId,
        phase: "unavailable",
        surface,
        metadataOnly: true,
      });
    }
  } catch {
    // Local content is already visible; a cloud refresh failure should not
    // block reading or editing.
    if (getLocalPage()?.content_text == null) {
      publishPageBodyHydrationStatus({
        pageId,
        phase: "unavailable",
        surface,
        metadataOnly: true,
      });
    }
  }
}

function schedulePageLocalBodyHydration(
  pageId: string,
  isCurrentLoad: () => boolean,
  getLocalPage: () => Page | null,
  setPage: (page: Page | null) => void,
  upsertPages: (pages: Page[]) => void,
  surface: PageBodyHydrationSurface,
  priority: PageLocalBodyHydrationPriority = "background"
): void {
  const run = () => {
    queuePageLocalBodyHydration({
      pageId,
      isCurrentLoad,
      surface,
      getLocalPage,
      setPage,
      upsertPages,
    });
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
  if (priority === "interactive") {
    window.setTimeout(() => {
      if (maybeWindow.requestIdleCallback) {
        maybeWindow.requestIdleCallback(run, {
          timeout: PAGE_INTERACTIVE_LOCAL_BODY_HYDRATION_IDLE_MS,
        });
        return;
      }
      run();
    }, PAGE_INTERACTIVE_LOCAL_BODY_HYDRATION_DELAY_MS);
    return;
  }
  if (maybeWindow.requestIdleCallback) {
    maybeWindow.requestIdleCallback(run, {
      timeout: PAGE_LOCAL_BODY_HYDRATION_IDLE_MS,
    });
    return;
  }
  window.setTimeout(run, Math.min(PAGE_LOCAL_BODY_HYDRATION_IDLE_MS, 80));
}

function getPageLocalBodyHydrationPriority(
  source: PageRouteHandoffSource | null
): PageLocalBodyHydrationPriority {
  return source ? "interactive" : "background";
}

function queuePageLocalBodyHydration(job: PageLocalBodyHydrationJob): void {
  const key = pageLocalBodyHydrationQueueKey(job.pageId, job.surface);
  const existing = pageLocalBodyHydrationQueue.get(key);
  if (existing) {
    existing.latest = job;
    existing.rerun = true;
    return;
  }

  const state: PageLocalBodyHydrationState = {
    latest: job,
    rerun: false,
  };
  pageLocalBodyHydrationQueue.set(key, state);
  void drainPageLocalBodyHydrationQueue(key, state);
}

async function drainPageLocalBodyHydrationQueue(
  key: string,
  state: PageLocalBodyHydrationState
): Promise<void> {
  try {
    while (pageLocalBodyHydrationQueue.get(key) === state) {
      const job = state.latest;
      state.rerun = false;
      await refreshPageBodyFromLocalCache(
        job.pageId,
        job.isCurrentLoad,
        job.getLocalPage,
        job.setPage,
        job.upsertPages,
        job.surface
      );
      if (!state.rerun) break;
    }
  } finally {
    if (pageLocalBodyHydrationQueue.get(key) === state) {
      pageLocalBodyHydrationQueue.delete(key);
    }
  }
}

function pageLocalBodyHydrationQueueKey(
  pageId: string,
  surface: PageBodyHydrationSurface
): string {
  return `${surface}:${pageId}`;
}

async function refreshPageBodyFromLocalCache(
  pageId: string,
  isCurrentLoad: () => boolean,
  getLocalPage: () => Page | null,
  setPage: (page: Page | null) => void,
  upsertPages: (pages: Page[]) => void,
  surface: PageBodyHydrationSurface
): Promise<void> {
  publishPageBodyHydrationStatus({
    pageId,
    phase: "local-body-requested",
    surface,
    metadataOnly: true,
  });
  try {
    const storedPage = await getPage(pageId);
    if (!isCurrentLoad()) return;
    if (storedPage) {
      clearPendingPageDraft(pageId);
      clearPageRouteHandoff(pageId);
      upsertPages([storedPage]);
      setPage(storedPage);
      publishPageBodyHydrationForSnapshot(
        storedPage,
        storedPage.content_text == null ? "metadata-ready" : "local-body-ready",
        surface
      );
      schedulePageCloudHydration(
        pageId,
        getLocalPage,
        setPage,
        upsertPages,
        surface
      );
      return;
    }
  } catch {
    // Local body hydration is a speed path. Cloud fallback still runs below.
  }
  if (!isCurrentLoad()) return;
  schedulePageCloudHydration(
    pageId,
    getLocalPage,
    setPage,
    upsertPages,
    surface
  );
}

function schedulePageCloudHydration(
  pageId: string,
  getLocalPage: () => Page | null,
  setPage: (page: Page | null) => void,
  upsertPages: (pages: Page[]) => void,
  surface: PageBodyHydrationSurface
): void {
  const run = () => {
    queuePageCloudHydration({
      pageId,
      getLocalPage,
      setPage,
      upsertPages,
      surface,
    });
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

function queuePageCloudHydration(job: PageCloudHydrationJob): void {
  const key = pageCloudHydrationQueueKey(job.pageId, job.surface);
  const existing = pageCloudHydrationQueue.get(key);
  if (existing) {
    existing.latest = job;
    existing.rerun = true;
    return;
  }

  const state: PageCloudHydrationState = {
    latest: job,
    rerun: false,
  };
  pageCloudHydrationQueue.set(key, state);
  void drainPageCloudHydrationQueue(key, state);
}

async function drainPageCloudHydrationQueue(
  key: string,
  state: PageCloudHydrationState
): Promise<void> {
  try {
    while (pageCloudHydrationQueue.get(key) === state) {
      const job = state.latest;
      state.rerun = false;
      await refreshPageFromCloud(
        job.pageId,
        job.getLocalPage,
        job.setPage,
        job.upsertPages,
        job.surface
      );
      if (!state.rerun) break;
    }
  } finally {
    if (pageCloudHydrationQueue.get(key) === state) {
      pageCloudHydrationQueue.delete(key);
    }
  }
}

function pageCloudHydrationQueueKey(
  pageId: string,
  surface: PageBodyHydrationSurface
): string {
  return `${surface}:${pageId}`;
}

function publishPageBodyHydrationForSnapshot(
  page: Page,
  phase: PageBodyHydrationPhase,
  surface: PageBodyHydrationSurface
): void {
  publishPageBodyHydrationStatus({
    pageId: page.id,
    phase,
    surface,
    metadataOnly: page.content_text == null,
  });
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
    void queueCloudPagePushWithAccountSync(localPage);
    return true;
  }
  return false;
}

function pageToRemoteRecord(page: Page): RemotePageRecord {
  const coverUrl =
    page.cover_url && page.cover_url.length > MAX_REMOTE_COVER_CHARS
      ? null
      : (page.cover_url ?? null);
  return {
    id: page.id,
    parent_id: page.parent_id ?? null,
    title: page.title ?? "",
    icon: page.icon ?? null,
    cover_url: coverUrl,
    content_text: page.content_text ?? null,
    properties: page.properties ?? null,
    position: page.position ?? 0,
    depth: page.depth ?? 0,
    created_at: page.created_at,
    updated_at: page.updated_at,
    deleted_at: page.deleted_at ?? null,
  };
}

async function fetchCloudPageByIdWithAccountSync(
  pageId: string
): Promise<CloudPageLookupResult | null> {
  const { fetchCloudPageById } = await loadPageAccountSyncModule();
  return fetchCloudPageById(pageId);
}

async function queueCloudPagePushWithAccountSync(
  page: RemotePageRecord | Page
): Promise<void> {
  const { queueCloudPagePush } = await loadPageAccountSyncModule();
  queueCloudPagePush(page);
}

async function queueCloudPageDeleteWithAccountSync(
  page: Page,
  deletedAt: string
): Promise<void> {
  const { queueCloudPageDelete } = await loadPageAccountSyncModule();
  queueCloudPageDelete(page, deletedAt);
}

function remoteIsAtLeastAsFresh(
  remote: RemotePageRecord,
  local: Page | null
): boolean {
  if (!local) return true;
  return remote.updated_at >= local.updated_at;
}
