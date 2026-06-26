"use client";

import { useEffect, useCallback } from "react";
import {
  getAllPageMetadata,
  getAllPages,
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
import type { Page } from "@/lib/utils/types";

interface UsePagesOptions {
  includeContent?: boolean;
  deferContent?: boolean;
  autoLoad?: boolean;
}

interface RefreshOptions {
  broadcast?: boolean;
  reason?: PageUpdateReason;
}

let metadataSnapshotInFlight: Promise<Page[]> | null = null;
let contentSnapshotInFlight: Promise<Page[]> | null = null;
let deferredContentHydrationScheduled = false;
let deferredContentHydrationInFlight: Promise<void> | null = null;

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
    deferredContentHydrationInFlight = loadPagesSnapshot(true)
      .then((contentPages) => {
        useWorkspaceStore.getState().upsertPages(contentPages);
      })
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

export function usePages(options: UsePagesOptions = {}) {
  const includeContent = options.includeContent ?? false;
  const deferContent = options.deferContent ?? false;
  const metadataFirstContent = includeContent && deferContent;
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

  const refresh = useCallback(async (options: RefreshOptions = {}) => {
    if (!dbReady) return;
    let all: Page[] = [];
    let localSnapshotLoaded = false;
    let cloudPages: Page[] = [];
    let cloudSnapshotAuthoritative = false;

    const renderLocalPagesSnapshot = async (): Promise<boolean> => {
      try {
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

    if (metadataFirstContent) {
      scheduleDeferredContentHydration();
    }
  }, [dbReady, includeContent, metadataFirstContent, setPages]);

  useEffect(() => {
    if (!autoLoad) return;
    refresh({ broadcast: false });
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

  return { pages, refresh, upsertPages: upsertPageSnapshots };
}
