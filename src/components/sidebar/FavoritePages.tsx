"use client";

import { useMemo } from "react";
import { useLocalFirstPageNavigation } from "@/hooks/useLocalFirstPageNavigation";
import { usePageFavorites } from "@/hooks/usePageFavorites";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { Page } from "@/lib/utils/types";

const SIDEBAR_FAVORITE_VISIBLE_LIMIT = 24;

export default function FavoritePages() {
  const openPage = useLocalFirstPageNavigation();
  const pagesById = useWorkspaceStore((s) => s.pagesById);
  const currentPageId = useWorkspaceStore((s) => s.currentPageId);
  const { favoriteIds, setFavorite } = usePageFavorites();

  const favoritePages = useMemo(
    () =>
      favoriteIds
        .map((id) => pagesById.get(id))
        .filter((page): page is Page => Boolean(page)),
    [favoriteIds, pagesById]
  );
  const visibleFavoritePages = useMemo(() => {
    const visible = favoritePages.slice(0, SIDEBAR_FAVORITE_VISIBLE_LIMIT);
    const currentFavorite = currentPageId
      ? favoritePages.find((page) => page.id === currentPageId)
      : null;
    if (
      currentFavorite &&
      !visible.some((page) => page.id === currentFavorite.id)
    ) {
      visible.splice(SIDEBAR_FAVORITE_VISIBLE_LIMIT - 1, 1, currentFavorite);
    }
    return visible;
  }, [currentPageId, favoritePages]);
  const hiddenFavoriteCount = Math.max(
    0,
    favoritePages.length - visibleFavoritePages.length
  );

  if (favoritePages.length === 0) return null;

  return (
    <div className="mb-3">
      <p className="px-3 py-1 text-[10px] uppercase tracking-wider text-zinc-400 font-medium">
        收藏
      </p>
      <ul className="space-y-0.5">
        {visibleFavoritePages.map((page) => (
          <li key={page.id}>
            <div
              className={`group flex items-center gap-1 rounded-md transition-colors ${
                currentPageId === page.id
                  ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100"
                  : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              <button
                type="button"
                onClick={() => openPage(page, { source: "favorite-open" })}
                className="flex min-w-0 flex-1 items-center gap-2 px-3 py-1.5 text-left text-sm"
              >
                <span className="shrink-0 w-5 text-center text-sm">
                  {page.icon || "📄"}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {page.title || "未命名"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setFavorite(page.id, false)}
                className="mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded text-zinc-300 opacity-0 transition-colors hover:text-zinc-600 group-hover:opacity-100 dark:text-zinc-600 dark:hover:text-zinc-200"
                title="取消收藏"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </li>
        ))}
      </ul>
      {hiddenFavoriteCount > 0 && (
        <p className="px-3 py-1 text-[11px] leading-4 text-zinc-400 dark:text-zinc-500">
          已折叠 {hiddenFavoriteCount} 个收藏页面；用搜索快速打开。
        </p>
      )}
    </div>
  );
}
