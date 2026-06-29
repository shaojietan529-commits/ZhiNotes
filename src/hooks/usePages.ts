"use client";

import { useEffect, useCallback } from "react";
import {
  getAllPageMetadata,
  getAllPages,
  getWorkspaceSetting,
  listHotCachePageMetadata,
  listPagesForContentHydration,
  listPagesForPriorityContentHydration,
  type RemotePageRecord,
} from "@/lib/db/local/queries";
import { syncCloudPageMetadataDelta } from "@/lib/pages/accountPageSync";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import {
  emitPageSnapshotsUpdated,
  emitPagesUpdated,
  subscribePagesUpdated,
  type PageUpdateMessage,
  type PageUpdateReason,
} from "@/lib/pages/pageUpdateBus";
import { DEFAULT_OWNER_ID } from "@/lib/utils/id";
import {
  DEFAULT_HOT_CACHE_PREFERENCES,
  HOT_CACHE_PREFERENCES_CHANGED_EVENT,
  HOT_CACHE_PREFERENCES_CHANGED_STORAGE_KEY,
  HOT_CACHE_PREFERENCES_SETTING_KEY,
  metadataRecentLimitForHotCachePreferences,
  parseHotCachePreferences,
} from "@/lib/sync/hotCacheSelectionSettings";
import type { Page } from "@/lib/utils/types";

interface UsePagesOptions {
  includeContent?: boolean;
  deferContent?: boolean;
  autoHydrateContent?: boolean;
  autoLoad?: boolean;
}

interface RefreshOptions {
  broadcast?: boolean;
  reason?: PageUpdateReason;
}

let metadataSnapshotInFlight: Promise<Page[]> | null = null;
let contentSnapshotInFlight: Promise<Page[]> | null = null;
let hotMetadataSnapshotInFlight: Promise<Page[]> | null = null;
let deferredMetadataHydrationScheduled = false;
let deferredMetadataHydrationInFlight: Promise<void> | null = null;
let deferredContentHydrationScheduled = false;
let deferredContentHydrationInFlight: Promise<void> | null = null;
const DEFERRED_CONTENT_HYDRATION_BATCH_SIZE = 80;
const PRIORITY_CONTENT_HYDRATION_LIMIT = 80;

function remoteMetadataToPage(record: RemotePageRecord): Page {
  return {
    id: record.id,
    owner_id: DEFAULT_OWNER_ID,
    parent_id: record.parent_id,
    database_id: null,
    title: record.title,
    icon: record.icon,
    cover_url: record.cover_url,
    content_yjs: null,
    content_text: null,
    properties: record.properties,
    position: record.position,
    depth: record.depth,
    created_at: record.created_at,
    updated_at: record.updated_at,
    deleted_at: record.deleted_at,
    sync_version: 1,
  };
}

function loadPagesSnapshot(includeContent: boolean): Promise<Page[]> {
  const current = includeContent
    ? contentSnapshotInFlight
    : metadataSnapshotInFlight;
  if (current) return current;

  const promise = (includeContent ? getAllPages() : getAllPageMetadata()).finally(
    () => {
      if (includeContent) {
        if (contentSnapshotInFlight === promise) contentSnapshotInFlight = null;
      } else if (metadataSnapshotInFlight === promise) {
        metadataSnapshotInFlight = null;
      }
    }
  );

  if (includeContent) {
    contentSnapshotInFlight = promise;
  } else {
    metadataSnapshotInFlight = promise;
  }
  return promise;
}

function loadHotCachePageMetadataSnapshot(): Promise<Page[]> {
  if (hotMetadataSnapshotInFlight) return hotMetadataSnapshotInFlight;

  const promise = getWorkspaceSetting(HOT_CACHE_PREFERENCES_SETTING_KEY)
    .catch(() => null)
    .then((setting) => {
      const preferences = setting
        ? parseHotCachePreferences(setting)
        : DEFAULT_HOT_CACHE_PREFERENCES;
      return listHotCachePageMetadata({
        recentLimit: metadataRecentLimitForHotCachePreferences(preferences),
      });
    })
    .finally(() => {
      if (hotMetadataSnapshotInFlight === promise) {
        hotMetadataSnapshotInFlight = null;
      }
    });

  hotMetadataSnapshotInFlight = promise;
  return promise;
}

function scheduleIdleTask(callback: () => void, timeout = 1200): void {
  if (typeof window === "undefined") return;
  const maybeWindow = window as Window & {
    requestIdleCallback?: (
      cb: () => void,
      options?: { timeout?: number }
    ) => number;
  };
  if (maybeWindow.requestIdleCallback) {
    maybeWindow.requestIdleCallback(callback, { timeout });
    return;
  }
  window.setTimeout(callback, Math.min(timeout, 500));
}

function waitForIdle(timeout = 1200): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  return new Promise((resolve) => {
    scheduleIdleTask(() => resolve(), timeout);
  });
}

function getPriorityContentHydrationPageIds(): string[] {
  const priorityIds: string[] = [];
  const seen = new Set<string>();
  for (const page of useWorkspaceStore.getState().pages) {
    if (page.deleted_at || page.content_text !== null || seen.has(page.id)) {
      continue;
    }
    priorityIds.push(page.id);
    seen.add(page.id);
    if (priorityIds.length >= PRIORITY_CONTENT_HYDRATION_LIMIT) break;
  }
  return priorityIds;
}

function scheduleDeferredMetadataHydration(
  setPages: (pages: Page[]) => void
): void {
  if (
    deferredMetadataHydrationScheduled ||
    deferredMetadataHydrationInFlight ||
    typeof window === "undefined"
  ) {
    return;
  }
  deferredMetadataHydrationScheduled = true;
  scheduleIdleTask(() => {
    deferredMetadataHydrationScheduled = false;
    deferredMetadataHydrationInFlight = loadPagesSnapshot(false)
      .then((metadataPages) => {
        setPages(mergeFullMetadataWithCurrentStore(metadataPages));
      })
      .catch(() => {
        // The fast hot-cache metadata already rendered; full local metadata
        // hydration can retry on the next page update or refresh.
      })
      .finally(() => {
        deferredMetadataHydrationInFlight = null;
      });
  }, 900);
}

async function hydrateDeferredPageContentBatches(): Promise<void> {
  const priorityPageIds = getPriorityContentHydrationPageIds();
  if (priorityPageIds.length > 0) {
    const priorityContentPages = await listPagesForPriorityContentHydration({
      pageIds: priorityPageIds,
      limit: PRIORITY_CONTENT_HYDRATION_LIMIT,
    });
    if (priorityContentPages.length > 0) {
      useWorkspaceStore.getState().upsertPages(priorityContentPages);
      await waitForIdle(900);
    }
  }

  let offset = 0;
  while (true) {
    const contentPages = await listPagesForContentHydration({
      limit: DEFERRED_CONTENT_HYDRATION_BATCH_SIZE,
      offset,
    });
    if (contentPages.length === 0) return;
    useWorkspaceStore.getState().upsertPages(contentPages);
    if (contentPages.length < DEFERRED_CONTENT_HYDRATION_BATCH_SIZE) return;
    offset += contentPages.length;
    await waitForIdle(1400);
  }
}

function scheduleDeferredContentHydration(): void {
  if (
    deferredContentHydrationScheduled ||
    deferredContentHydrationInFlight ||
    typeof window === "undefined"
  ) {
    return;
  }
  deferredContentHydrationScheduled = true;
  scheduleIdleTask(() => {
    deferredContentHydrationScheduled = false;
    deferredContentHydrationInFlight = hydrateDeferredPageContentBatches()
      .catch(() => {
        // Full page bodies are a background enhancement. Metadata already
        // rendered, so a transient local-cache miss should not block modules.
      })
      .finally(() => {
        deferredContentHydrationInFlight = null;
      });
  });
}

function mergeMetadataForCount(base: Page[], incoming: Page[]): Page[] {
  const byId = new Map(base.map((page) => [page.id, page]));
  for (const page of incoming) {
    if (page.deleted_at) {
      byId.delete(page.id);
    } else {
      const existing = byId.get(page.id);
      byId.set(page.id, {
        ...page,
        content_text:
          page.content_text === null && existing?.content_text !== null
            ? existing?.content_text ?? null
            : page.content_text,
        content_yjs:
          page.content_yjs === null && existing?.content_yjs !== null
            ? existing?.content_yjs ?? null
            : page.content_yjs,
      });
    }
  }
  return [...byId.values()];
}

function mergeFullMetadataWithCurrentStore(localMetadata: Page[]): Page[] {
  const currentPages = useWorkspaceStore.getState().pages;
  const byId = new Map(localMetadata.map((page) => [page.id, page]));
  for (const current of currentPages) {
    const local = byId.get(current.id);
    if (!local) {
      byId.set(current.id, current);
      continue;
    }
    const currentIsNewer =
      (current.updated_at || "").localeCompare(local.updated_at || "") >= 0;
    const preferred = currentIsNewer ? current : local;
    byId.set(current.id, {
      ...preferred,
      content_text:
        preferred.content_text === null && current.content_text !== null
          ? current.content_text
          : preferred.content_text,
      content_yjs:
        preferred.content_yjs === null && current.content_yjs !== null
          ? current.content_yjs
          : preferred.content_yjs,
    });
  }
  return [...byId.values()];
}

export function usePages(options: UsePagesOptions = {}) {
  const includeContent = options.includeContent ?? false;
  const deferContent = options.deferContent ?? false;
  const metadataFirstContent = includeContent && deferContent;
  const autoHydrateContent = options.autoHydrateContent ?? true;
  const autoLoad = options.autoLoad ?? true;
  const dbReady = useWorkspaceStore((s) => s.dbReady);
  const pages = useWorkspaceStore((s) => s.pages);
  const setPages = useWorkspaceStore((s) => s.setPages);
  const upsertPages = useWorkspaceStore((s) => s.upsertPages);

  const upsertPageSnapshots = useCallback(
    (incomingPages: Page[], reason: PageUpdateReason = "cloud-push") => {
      if (incomingPages.length === 0) return;
      upsertPages(incomingPages);
      emitPageSnapshotsUpdated(reason, incomingPages);
    },
    [upsertPages]
  );

  const hydrateContentInBackground = useCallback(() => {
    if (!dbReady) return;
    scheduleDeferredContentHydration();
  }, [dbReady]);

  const refresh = useCallback(async (options: RefreshOptions = {}) => {
    if (!dbReady) return;
    let all: Page[] = [];
    let localSnapshotLoaded = false;
    let cloudPages: Page[] = [];
    let cloudSnapshotAuthoritative = false;

    const renderLocalPagesSnapshot = async (): Promise<boolean> => {
      try {
        if (!includeContent || metadataFirstContent) {
          const hotPages = await loadHotCachePageMetadataSnapshot();
          if (hotPages.length > 0) {
            all = hotPages;
            localSnapshotLoaded = true;
            setPages(hotPages);
            scheduleDeferredMetadataHydration(setPages);
            return true;
          }
        }
        all = await loadPagesSnapshot(
          metadataFirstContent ? false : includeContent
        );
        localSnapshotLoaded = true;
        setPages(all);
        return true;
      } catch {
        // The browser database is only a rebuildable hot cache. If it cannot
        // be read, keep the workspace usable through cloud metadata below.
        return false;
      }
    };

    // Page lists should feel local: render the rebuildable hot cache first,
    // then let the cloud ledger correct metadata in the background.
    await renderLocalPagesSnapshot();

    try {
      const cloud = await syncCloudPageMetadataDelta({
        force: false,
        requireLocalCacheCoverage: false,
      });
      if (cloud.status === "ok") {
        cloudPages = cloud.pages.map(remoteMetadataToPage);
        if (cloud.fullRefresh && (!includeContent || metadataFirstContent)) {
          all = cloudPages;
          cloudSnapshotAuthoritative = true;
          setPages(cloudPages);
        } else if (cloudPages.length > 0) {
          if (localSnapshotLoaded) {
            all = mergeMetadataForCount(all, cloudPages);
            setPages(all);
          } else {
            all = cloudPages;
            setPages(cloudPages);
          }
        }
      }
    } catch {
      // Cloud metadata refresh is best effort. If the network or auth layer
      // is unavailable, the already-rendered local hot cache remains usable.
    }

    const needsCloudCoverageRecovery =
      (!includeContent || metadataFirstContent) &&
      !cloudSnapshotAuthoritative &&
      (!localSnapshotLoaded || all.length === 0);
    if (needsCloudCoverageRecovery) {
      try {
        const cloud = await syncCloudPageMetadataDelta({
          force: true,
          requireLocalCacheCoverage: true,
        });
        if (
          cloud.status === "ok" &&
          (cloud.fullRefresh || cloud.pages.length > 0)
        ) {
          const cloudPages = cloud.pages.map(remoteMetadataToPage);
          all = cloudPages;
          setPages(cloudPages);
        }
      } catch {
        // If both cloud and local cache are unavailable, keep the existing
        // in-memory workspace instead of blocking navigation.
      }
    }

    if (includeContent && !localSnapshotLoaded && all.length === 0) {
      try {
        const cloud = await syncCloudPageMetadataDelta({
          force: true,
          requireLocalCacheCoverage: true,
        });
        if (cloud.status === "ok" && cloud.pages.length > 0) {
          const cloudPages = cloud.pages.map(remoteMetadataToPage);
          all = cloudPages;
          setPages(cloudPages);
        }
      } catch {
        // Include-content callers still get metadata when the rebuildable
        // browser database is temporarily unavailable.
      }
    }

    if (options.broadcast !== false) {
      emitPagesUpdated(options.reason ?? "local-refresh", all.length);
    }

    if (metadataFirstContent && autoHydrateContent) {
      scheduleDeferredContentHydration();
    }
  }, [
    autoHydrateContent,
    dbReady,
    includeContent,
    metadataFirstContent,
    setPages,
  ]);

  useEffect(() => {
    if (!autoLoad) return;
    refresh({ broadcast: false });
  }, [autoLoad, refresh]);

  useEffect(() => {
    if (!autoLoad) return;
    if (typeof window === "undefined") return;
    const handleHotCachePreferencesChanged = () => {
      void refresh({ broadcast: false, reason: "local-refresh" });
    };
    const handleHotCachePreferencesStorage = (event: StorageEvent) => {
      if (event.key === HOT_CACHE_PREFERENCES_CHANGED_STORAGE_KEY) {
        handleHotCachePreferencesChanged();
      }
    };
    window.addEventListener(
      HOT_CACHE_PREFERENCES_CHANGED_EVENT,
      handleHotCachePreferencesChanged
    );
    window.addEventListener("storage", handleHotCachePreferencesStorage);
    return () => {
      window.removeEventListener(
        HOT_CACHE_PREFERENCES_CHANGED_EVENT,
        handleHotCachePreferencesChanged
      );
      window.removeEventListener("storage", handleHotCachePreferencesStorage);
    };
  }, [autoLoad, refresh]);

  useEffect(() => {
    if (!autoLoad) return;
    if (!dbReady) return;
    let timer: number | null = null;
    const unsubscribe = subscribePagesUpdated((message: PageUpdateMessage) => {
      if (message.pages?.length) {
        upsertPages(message.pages.map(remoteMetadataToPage));
        return;
      }
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void refresh({ broadcast: false, reason: message.reason });
      }, 120);
    });
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      unsubscribe();
    };
  }, [autoLoad, dbReady, includeContent, refresh, upsertPages]);

  return {
    pages,
    refresh,
    hydrateContentInBackground,
    upsertPages: upsertPageSnapshots,
  };
}
