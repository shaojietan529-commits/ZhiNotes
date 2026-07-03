"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import {
  getAllPageMetadata,
  getAllPages,
  getWorkspaceSetting,
  listHotCachePageMetadata,
  listPagesForContentHydration,
  listPagesForPriorityContentHydration,
  type RemotePageRecord,
} from "@/lib/db/local/queries";
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
import {
  pageListHotCacheSnapshotPageToPage,
  readPageListHotCacheSnapshot,
  writePageListHotCacheSnapshot,
} from "@/lib/sync/pageListHotCacheSnapshot";
import {
  createPageListLoadStatus,
  type PageListLoadPhase,
  type PageListLoadStatusState,
} from "@/lib/sync/pageListLoadStatus";
import type { Page } from "@/lib/utils/types";

const loadPageAccountSyncModule = () => import("@/lib/pages/accountPageSync");

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
        const mergedPages = mergeFullMetadataWithCurrentStore(metadataPages);
        setPages(mergedPages);
        writePageListHotCacheSnapshot({
          pages: mergedPages,
          source: "local-metadata",
        });
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
      !isPageListHotCacheFirstPaintPage(current) &&
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

function isPageListHotCacheFirstPaintPage(page: Page): boolean {
  return (
    page.sync_version === 0 &&
    page.content_text === null &&
    page.content_yjs === null &&
    page.properties === null
  );
}

function countPageListRootPages(pages: Page[]): number {
  return pages.filter((page) => !page.deleted_at && page.parent_id === null)
    .length;
}

function createPageListStatusFromPages(
  phase: PageListLoadPhase,
  pages: Page[],
  input: Partial<PageListLoadStatusState> = {}
): PageListLoadStatusState {
  return createPageListLoadStatus({
    phase,
    visiblePages: pages.filter((page) => !page.deleted_at).length,
    visibleRootPages: countPageListRootPages(pages),
    ...input,
  });
}

function schedulePageListLoadStatusUpdate(
  setStatus: (status: PageListLoadStatusState) => void,
  status: PageListLoadStatusState
): void {
  if (typeof window === "undefined") {
    setStatus(status);
    return;
  }
  window.setTimeout(() => setStatus(status), 0);
}

function mergeCloudMetadataWithPendingLocalPages(
  cloudMetadata: Page[],
  isPendingSync: (pageId: string) => boolean
): Page[] {
  const currentPages = useWorkspaceStore.getState().pages;
  const byId = new Map(cloudMetadata.map((page) => [page.id, page]));
  for (const current of currentPages) {
    const cloud = byId.get(current.id);
    if (!cloud) {
      if (isPendingSync(current.id)) {
        byId.set(current.id, current);
      }
      continue;
    }
    const preferred = isPendingSync(current.id) ? current : cloud;
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
  const refreshRequestRef = useRef(0);
  const browserHotCacheBootstrappedRef = useRef(false);
  const [pageListLoadStatus, setPageListLoadStatus] = useState(() =>
    createPageListStatusFromPages("booting", pages, {
      backgroundActive: true,
      message: "侧边栏会先显示本地页面 metadata，再后台校正云端目录。",
    })
  );

  const upsertPageSnapshots = useCallback(
    (incomingPages: Page[], reason: PageUpdateReason = "cloud-push") => {
      if (incomingPages.length === 0) return;
      upsertPages(incomingPages);
      const nextPages = useWorkspaceStore.getState().pages;
      writePageListHotCacheSnapshot({
        pages: nextPages,
        source: "optimistic-local",
      });
      setPageListLoadStatus(
        createPageListStatusFromPages("optimistic-local", nextPages, {
          backgroundActive: true,
          message: "页面列表已先本地更新，云端同步在后台继续。",
        })
      );
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
    const requestId = ++refreshRequestRef.current;
    const isCurrentRefresh = () => refreshRequestRef.current === requestId;
    let all: Page[] = [];
    let localSnapshotLoaded = false;
    let cloudSnapshotAuthoritative = false;
    const currentPages = useWorkspaceStore.getState().pages;
    setPageListLoadStatus(
      createPageListStatusFromPages("booting", currentPages, {
        backgroundActive: true,
        message:
          currentPages.length > 0
            ? "页面列表已保留当前本地内容，正在刷新 metadata。"
            : "正在读取页面 metadata，先查本地热缓存。",
      })
    );

    const renderLocalPagesSnapshot = async (): Promise<boolean> => {
      try {
        if (!includeContent || metadataFirstContent) {
          const hotPages = await loadHotCachePageMetadataSnapshot();
          if (hotPages.length > 0) {
            all = hotPages;
            localSnapshotLoaded = true;
            if (!isCurrentRefresh()) return false;
            setPages(hotPages);
            writePageListHotCacheSnapshot({
              pages: hotPages,
              source: "hot-cache-metadata",
            });
            setPageListLoadStatus(
              createPageListStatusFromPages("local-hot-cache", hotPages, {
                backgroundActive: true,
                message:
                  "已先显示常用页面 metadata，完整页面目录和云端校正在后台继续。",
              })
            );
            scheduleDeferredMetadataHydration(setPages);
            return true;
          }
        }
        all = await loadPagesSnapshot(
          metadataFirstContent ? false : includeContent
        );
        localSnapshotLoaded = true;
        if (!isCurrentRefresh()) return false;
        setPages(all);
        writePageListHotCacheSnapshot({
          pages: all,
          source: "local-metadata",
        });
        setPageListLoadStatus(
          createPageListStatusFromPages("local-index", all, {
            backgroundActive: true,
            message: "本地页面 metadata 已显示，云端校正在后台继续。",
          })
        );
        return true;
      } catch {
        // The browser database is only a rebuildable hot cache. If it cannot
        // be read, keep the workspace usable through cloud metadata below.
        setPageListLoadStatus(
          createPageListStatusFromPages("cloud-checking", all, {
            cloudLoading: true,
            backgroundActive: true,
            message: "本地页面缓存暂不可读，正在尝试用云端 metadata 兜底。",
          })
        );
        return false;
      }
    };

    // Page lists should feel local: render the rebuildable hot cache first,
    // then let the cloud ledger correct metadata in the background.
    await renderLocalPagesSnapshot();
    if (!isCurrentRefresh()) return;

    const applyCloudMetadataDelta = async (cloudOptions: {
      force: boolean;
      requireLocalCacheCoverage: boolean;
    }) => {
      setPageListLoadStatus(
        createPageListStatusFromPages("cloud-checking", all, {
          cloudLoading: true,
          backgroundActive: true,
          message: "本地页面列表已可用，正在后台校正云端 metadata。",
        })
      );
      try {
        const {
          isCloudPagePendingSync,
          syncCloudPageMetadataDelta,
        } = await loadPageAccountSyncModule();
        const cloud = await syncCloudPageMetadataDelta(cloudOptions);
        if (!isCurrentRefresh()) return;
        if (cloud.status === "ok") {
          const cloudPages = cloud.pages.map(remoteMetadataToPage);
          if (cloud.fullRefresh && (!includeContent || metadataFirstContent)) {
            all = mergeCloudMetadataWithPendingLocalPages(
              cloudPages,
              isCloudPagePendingSync
            );
            cloudSnapshotAuthoritative = true;
            setPages(all);
            writePageListHotCacheSnapshot({
              pages: all,
              source: "cloud-metadata",
            });
          } else if (cloudPages.length > 0) {
            if (localSnapshotLoaded) {
              all = mergeMetadataForCount(all, cloudPages);
              setPages(all);
              writePageListHotCacheSnapshot({
                pages: all,
                source: "cloud-metadata",
              });
            } else {
              all = cloudPages;
              setPages(cloudPages);
              writePageListHotCacheSnapshot({
                pages: cloudPages,
                source: "cloud-metadata",
              });
            }
          }
          setPageListLoadStatus(
            createPageListStatusFromPages("cloud-ready", all, {
              message:
                cloud.pages.length > 0
                  ? "页面列表已和云端 metadata 对齐。"
                  : "云端本轮没有新的页面 metadata，当前本地列表继续使用。",
            })
          );
          return;
        }
        setPageListLoadStatus(
          createPageListStatusFromPages(
            cloud.status === "error" ? "cloud-error" : "local-only",
            all,
            {
              message:
                cloud.message ??
                "云端页面目录暂不可用，本地页面列表继续可用。",
            }
          )
        );
      } catch {
        // Cloud metadata refresh is best effort. If the network or auth layer
        // is unavailable, the already-rendered local hot cache remains usable.
        if (!isCurrentRefresh()) return;
        setPageListLoadStatus(
          createPageListStatusFromPages("cloud-error", all, {
            message: "云端页面 metadata 本轮校正失败，本地页面列表继续可用。",
          })
        );
      }
    };

    const hasUsableLocalFirstPaint = localSnapshotLoaded && all.length > 0;
    if (hasUsableLocalFirstPaint) {
      scheduleIdleTask(() => {
        void applyCloudMetadataDelta({
          force: false,
          requireLocalCacheCoverage: false,
        });
      }, 700);
    } else {
      await applyCloudMetadataDelta({
        force: false,
        requireLocalCacheCoverage: false,
      });
    }

    const needsCloudCoverageRecovery =
      (!includeContent || metadataFirstContent) &&
      !cloudSnapshotAuthoritative &&
      (!localSnapshotLoaded || all.length === 0);
    if (needsCloudCoverageRecovery) {
      await applyCloudMetadataDelta({
        force: true,
        requireLocalCacheCoverage: true,
      });
    }

    if (includeContent && !localSnapshotLoaded && all.length === 0) {
      await applyCloudMetadataDelta({
        force: true,
        requireLocalCacheCoverage: true,
      });
    }

    if (!isCurrentRefresh()) return;
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
    if (browserHotCacheBootstrappedRef.current) return;
    browserHotCacheBootstrappedRef.current = true;
    if (useWorkspaceStore.getState().pages.length > 0) return;
    const snapshot = readPageListHotCacheSnapshot();
    if (!snapshot || snapshot.pages.length === 0) return;
    const snapshotPages = snapshot.pages.map(pageListHotCacheSnapshotPageToPage);
    setPages(snapshotPages);
    schedulePageListLoadStatusUpdate(
      setPageListLoadStatus,
      createPageListStatusFromPages("hot-cache", snapshotPages, {
        backgroundActive: true,
        staleCache: Boolean(snapshot.stale),
        message: snapshot.stale
          ? "已先显示较早的浏览器页面 metadata，后台会刷新到最新。"
          : "已先显示浏览器页面 metadata，后台会继续校正。",
      })
    );
  }, [autoLoad, setPages]);

  useEffect(() => {
    if (!autoLoad) return;
    const timer = window.setTimeout(() => {
      void refresh({ broadcast: false });
    }, 0);
    return () => window.clearTimeout(timer);
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
    pageListLoadStatus,
    refresh,
    hydrateContentInBackground,
    upsertPages: upsertPageSnapshots,
  };
}
