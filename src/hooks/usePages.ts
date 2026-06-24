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
  emitPagesUpdated,
  subscribePagesUpdated,
  type PageUpdateMessage,
  type PageUpdateReason,
} from "@/lib/pages/pageUpdateBus";
import { DEFAULT_OWNER_ID } from "@/lib/utils/id";
import type { Page } from "@/lib/utils/types";

interface UsePagesOptions {
  includeContent?: boolean;
  autoLoad?: boolean;
}

interface RefreshOptions {
  broadcast?: boolean;
  reason?: PageUpdateReason;
}

let metadataSnapshotInFlight: Promise<Page[]> | null = null;
let contentSnapshotInFlight: Promise<Page[]> | null = null;

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

export function usePages(options: UsePagesOptions = {}) {
  const includeContent = options.includeContent ?? false;
  const autoLoad = options.autoLoad ?? true;
  const dbReady = useWorkspaceStore((s) => s.dbReady);
  const pages = useWorkspaceStore((s) => s.pages);
  const setPages = useWorkspaceStore((s) => s.setPages);
  const upsertPages = useWorkspaceStore((s) => s.upsertPages);

  const refresh = useCallback(async (options: RefreshOptions = {}) => {
    if (!dbReady) return;
    let all: Page[] = [];
    let localSnapshotLoaded = false;
    try {
      all = await loadPagesSnapshot(includeContent);
      localSnapshotLoaded = true;
      setPages(all);
    } catch {
      // The browser database is only a rebuildable cache. If it cannot be
      // read, keep the workspace usable by falling back to cloud metadata.
    }

    if (!includeContent || !localSnapshotLoaded) {
      try {
        const cloud = await syncCloudPageMetadataDelta({
          force: all.length === 0 || !localSnapshotLoaded,
        });
        if (cloud.status === "ok" && cloud.pages.length > 0) {
          const cloudPages = cloud.pages.map(remoteMetadataToPage);
          if (localSnapshotLoaded) {
            upsertPages(cloudPages);
          } else {
            all = cloudPages;
            setPages(cloudPages);
          }
        }
      } catch {
        // Local pages are already visible when available. Cloud metadata
        // refresh is best effort and should never block the current view.
      }
    }

    if (options.broadcast !== false) {
      emitPagesUpdated(options.reason ?? "local-refresh", all.length);
    }
  }, [dbReady, includeContent, setPages, upsertPages]);

  useEffect(() => {
    if (!autoLoad) return;
    refresh({ broadcast: false });
  }, [autoLoad, refresh]);

  useEffect(() => {
    if (!autoLoad) return;
    if (!dbReady) return;
    let timer: number | null = null;
    const unsubscribe = subscribePagesUpdated((message: PageUpdateMessage) => {
      if (
        !includeContent &&
        message.reason === "cloud-pull" &&
        message.pages?.length
      ) {
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

  return { pages, refresh };
}
