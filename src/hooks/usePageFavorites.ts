"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "zhinote.page.favorites";
const FAVORITES_CHANGED_EVENT = "zhinote:favorites-changed";

function normalizeFavoriteIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];

  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const id of ids) {
    if (typeof id !== "string" || id.length === 0 || seen.has(id)) continue;
    seen.add(id);
    normalized.push(id);
  }
  return normalized;
}

function readFavoriteIds(): string[] {
  if (typeof window === "undefined") return [];

  try {
    return normalizeFavoriteIds(
      JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]")
    );
  } catch {
    return [];
  }
}

function writeFavoriteIds(ids: string[]) {
  if (typeof window === "undefined") return;

  const normalized = normalizeFavoriteIds(ids);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new Event(FAVORITES_CHANGED_EVENT));
}

export function usePageFavorites() {
  const [favoriteIds, setFavoriteIdsState] = useState<string[]>([]);

  const refreshFavoriteIds = useCallback(() => {
    setFavoriteIdsState(readFavoriteIds());
  }, []);

  useEffect(() => {
    queueMicrotask(refreshFavoriteIds);

    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) refreshFavoriteIds();
    };
    const handleFavoritesChanged = () => refreshFavoriteIds();

    window.addEventListener("storage", handleStorage);
    window.addEventListener(FAVORITES_CHANGED_EVENT, handleFavoritesChanged);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(FAVORITES_CHANGED_EVENT, handleFavoritesChanged);
    };
  }, [refreshFavoriteIds]);

  const setFavorite = useCallback((pageId: string, next: boolean) => {
    const current = readFavoriteIds();
    const withoutPage = current.filter((id) => id !== pageId);
    const nextIds = next ? [pageId, ...withoutPage] : withoutPage;
    writeFavoriteIds(nextIds);
    setFavoriteIdsState(nextIds);
  }, []);

  const toggleFavorite = useCallback(
    (pageId: string) => {
      setFavorite(pageId, !readFavoriteIds().includes(pageId));
    },
    [setFavorite]
  );

  const isFavorite = useCallback(
    (pageId: string) => favoriteIds.includes(pageId),
    [favoriteIds]
  );

  return {
    favoriteIds,
    isFavorite,
    setFavorite,
    toggleFavorite,
  };
}
