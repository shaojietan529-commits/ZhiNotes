"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocalFirstPageNavigation } from "@/hooks/useLocalFirstPageNavigation";
import {
  getDeletedPageCount,
  getDeletedPages,
  restorePage,
} from "@/lib/db/local/queries";
import type { Page } from "@/lib/utils/types";
import { formatRelativeDate } from "@/lib/utils/dates";
import { useWorkspaceStore } from "@/stores/workspaceStore";

const SIDEBAR_TRASH_VISIBLE_LIMIT = 40;

export default function TrashPages() {
  const openPage = useLocalFirstPageNavigation();
  const activePageCount = useWorkspaceStore((s) => s.pages.length);
  const upsertPages = useWorkspaceStore((s) => s.upsertPages);
  const [pages, setPages] = useState<Page[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [countLoading, setCountLoading] = useState(true);
  const [pagesLoading, setPagesLoading] = useState(false);

  const refreshCount = useCallback(async () => {
    setCountLoading(true);
    const count = await getDeletedPageCount();
    setPageCount(count);
    setCountLoading(false);
    if (count === 0) {
      setPages([]);
      setOpen(false);
    }
  }, []);

  const loadPages = useCallback(async () => {
    setPagesLoading(true);
    const rows = await getDeletedPages();
    setPages(rows);
    setPageCount(rows.length);
    setPagesLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void refreshCount();
    });
  }, [activePageCount, refreshCount]);

  useEffect(() => {
    if (!open || pageCount === 0) return;
    queueMicrotask(() => {
      void loadPages();
    });
  }, [activePageCount, loadPages, open, pageCount]);

  const handleRestore = useCallback(
    async (pageId: string) => {
      const restored = await restorePage(pageId);
      if (restored) upsertPages([restored]);
      if (open) {
        await loadPages();
      } else {
        await refreshCount();
      }
      if (restored) openPage(restored, { source: "trash-restore-open" });
    },
    [loadPages, open, openPage, refreshCount, upsertPages]
  );

  if (countLoading || pageCount === 0) return null;
  const visibleTrashPages = open
    ? pages.slice(0, SIDEBAR_TRASH_VISIBLE_LIMIT)
    : [];
  const hiddenTrashCount = Math.max(
    0,
    Math.max(pageCount, pages.length) - visibleTrashPages.length
  );

  return (
    <div className="mt-3 border-t border-zinc-200 pt-2 dark:border-zinc-800">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
      >
        <span>回收站</span>
        <span className="rounded-full bg-zinc-200 px-1.5 text-[10px] text-zinc-500 dark:bg-zinc-800">
          {pageCount}
        </span>
      </button>

      {open && pagesLoading && pages.length === 0 && (
        <p className="px-3 py-1.5 text-[11px] leading-4 text-zinc-400 dark:text-zinc-500">
          正在读取回收站页面…
        </p>
      )}

      {open && pages.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {visibleTrashPages.map((page) => (
            <li key={page.id} className="px-2">
              <div className="rounded-md px-2 py-1.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <div className="flex items-center gap-2">
                  <span className="shrink-0">{page.icon || "📄"}</span>
                  <span className="min-w-0 flex-1 truncate text-zinc-600 dark:text-zinc-300">
                    {page.title || "未命名"}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="truncate text-[10px] text-zinc-400">
                    已删除 {page.deleted_at ? formatRelativeDate(page.deleted_at) : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRestore(page.id)}
                    className="shrink-0 text-[10px] text-blue-500 hover:text-blue-600"
                  >
                    恢复
                  </button>
                </div>
              </div>
            </li>
          ))}
          {hiddenTrashCount > 0 && (
            <li className="px-3 py-1.5 text-[11px] leading-4 text-zinc-400 dark:text-zinc-500">
              已折叠 {hiddenTrashCount} 个回收站页面；需要时可用搜索或同步中心定位。
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
