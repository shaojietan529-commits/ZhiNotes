"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getDeletedPages, restorePage } from "@/lib/db/local/queries";
import type { Page } from "@/lib/utils/types";
import { formatRelativeDate } from "@/lib/utils/dates";
import { usePages } from "@/hooks/usePages";

export default function TrashPages() {
  const router = useRouter();
  const { pages: activePages, refresh } = usePages();
  const [pages, setPages] = useState<Page[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const rows = await getDeletedPages();
    setPages(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [activePages.length, load]);

  const handleRestore = useCallback(
    async (pageId: string) => {
      const restored = await restorePage(pageId);
      await refresh();
      await load();
      if (restored) router.push(`/page/${restored.id}`);
    },
    [load, refresh, router]
  );

  if (loading || pages.length === 0) return null;

  return (
    <div className="mt-3 border-t border-zinc-200 pt-2 dark:border-zinc-800">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
      >
        <span>回收站</span>
        <span className="rounded-full bg-zinc-200 px-1.5 text-[10px] text-zinc-500 dark:bg-zinc-800">
          {pages.length}
        </span>
      </button>

      {open && (
        <ul className="mt-1 space-y-0.5">
          {pages.map((page) => (
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
        </ul>
      )}
    </div>
  );
}
