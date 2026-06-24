"use client";

import { useEffect, useCallback } from "react";
import {
  applyRemotePageMetadata,
  getAllPageMetadata,
  getAllPages,
  type RemotePageRecord,
} from "@/lib/db/local/queries";
import { fetchCloudPageMetadata } from "@/lib/pages/accountPageSync";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import {
  emitPagesUpdated,
  subscribePagesUpdated,
  type PageUpdateReason,
} from "@/lib/pages/pageUpdateBus";
import { DEFAULT_OWNER_ID } from "@/lib/utils/id";
import type { Page } from "@/lib/utils/types";

interface UsePagesOptions {
  includeContent?: boolean;
}

interface RefreshOptions {
  broadcast?: boolean;
  reason?: PageUpdateReason;
}

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

export function usePages(options: UsePagesOptions = {}) {
  const includeContent = options.includeContent ?? false;
  const dbReady = useWorkspaceStore((s) => s.dbReady);
  const pages = useWorkspaceStore((s) => s.pages);
  const setPages = useWorkspaceStore((s) => s.setPages);

  const refresh = useCallback(async (options: RefreshOptions = {}) => {
    if (!dbReady) return;
    let all = includeContent ? await getAllPages() : await getAllPageMetadata();
    if (!includeContent && all.length === 0) {
      const cloud = await fetchCloudPageMetadata();
      if (cloud.status === "ok" && cloud.pages.length > 0) {
        try {
          await applyRemotePageMetadata(cloud.pages);
          all = await getAllPageMetadata();
        } catch {
          all = cloud.pages
            .filter((page) => !page.deleted_at)
            .map(remoteMetadataToPage);
        }
      }
    }
    setPages(all);
    if (options.broadcast !== false) {
      emitPagesUpdated(options.reason ?? "local-refresh", all.length);
    }
  }, [dbReady, includeContent, setPages]);

  useEffect(() => {
    refresh({ broadcast: false });
  }, [refresh]);

  useEffect(() => {
    if (!dbReady) return;
    let timer: number | null = null;
    const unsubscribe = subscribePagesUpdated(() => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void refresh({ broadcast: false, reason: "cross-tab" });
      }, 120);
    });
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      unsubscribe();
    };
  }, [dbReady, refresh]);

  return { pages, refresh };
}
