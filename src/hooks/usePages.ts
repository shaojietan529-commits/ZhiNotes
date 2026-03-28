"use client";

import { useEffect, useCallback } from "react";
import { getAllPages } from "@/lib/db/local/queries";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export function usePages() {
  const dbReady = useWorkspaceStore((s) => s.dbReady);
  const pages = useWorkspaceStore((s) => s.pages);
  const setPages = useWorkspaceStore((s) => s.setPages);

  const refresh = useCallback(async () => {
    if (!dbReady) return;
    const all = await getAllPages();
    setPages(all);
  }, [dbReady, setPages]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { pages, refresh };
}
