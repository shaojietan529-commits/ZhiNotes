"use client";

import { useEffect, useCallback } from "react";
import { getAllPageMetadata, getAllPages } from "@/lib/db/local/queries";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import {
  emitPagesUpdated,
  subscribePagesUpdated,
  type PageUpdateReason,
} from "@/lib/pages/pageUpdateBus";

interface UsePagesOptions {
  includeContent?: boolean;
}

interface RefreshOptions {
  broadcast?: boolean;
  reason?: PageUpdateReason;
}

export function usePages(options: UsePagesOptions = {}) {
  const includeContent = options.includeContent ?? false;
  const dbReady = useWorkspaceStore((s) => s.dbReady);
  const pages = useWorkspaceStore((s) => s.pages);
  const setPages = useWorkspaceStore((s) => s.setPages);

  const refresh = useCallback(async (options: RefreshOptions = {}) => {
    if (!dbReady) return;
    const all = includeContent ? await getAllPages() : await getAllPageMetadata();
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
