"use client";

import { useCallback, useEffect, useState } from "react";
import { getWorkspaceSetting, upsertWorkspaceSetting } from "@/lib/db/local/queries";
import {
  PAGE_FAVORITES_SETTING_KEY,
  normalizePageFavoriteIds,
  parsePageFavoritesWorkspaceSetting,
} from "@/lib/sync/pageFavoritesWorkspaceSettings";

const STORAGE_KEY = "zhinote.page.favorites";
const FAVORITES_CHANGED_EVENT = "zhinote:favorites-changed";

function normalizeFavoriteIds(ids: unknown): string[] {
  return normalizePageFavoriteIds(ids);
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
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // localStorage is a fast cache only; workspace_settings remains durable.
  }
  window.dispatchEvent(new Event(FAVORITES_CHANGED_EVENT));
  void upsertWorkspaceSetting(
    PAGE_FAVORITES_SETTING_KEY,
    { favorite_page_ids: normalized },
    "local-page-favorites-ui"
  ).catch((error) => {
    console.warn("[Zhinote] Failed to persist page favorites setting:", error);
  });
}

export function usePageFavorites() {
  const [favoriteIds, setFavoriteIdsState] = useState<string[]>([]);

  const refreshFavoriteIds = useCallback(() => {
    setFavoriteIdsState(readFavoriteIds());
  }, []);

  useEffect(() => {
    queueMicrotask(refreshFavoriteIds);
    let cancelled = false;

    async function hydrateFromWorkspaceSettings() {
      try {
        const setting = await getWorkspaceSetting(PAGE_FAVORITES_SETTING_KEY);
        const cloudReadyIds =
          parsePageFavoritesWorkspaceSetting(setting).favorite_page_ids;
        if (cancelled) return;

        if (cloudReadyIds.length > 0 || setting) {
          setFavoriteIdsState(cloudReadyIds);
          try {
            window.localStorage.setItem(
              STORAGE_KEY,
              JSON.stringify(cloudReadyIds)
            );
          } catch {
            // The localStorage cache is optional.
          }
          return;
        }

        const legacyIds = readFavoriteIds();
        if (legacyIds.length > 0) {
          await upsertWorkspaceSetting(
            PAGE_FAVORITES_SETTING_KEY,
            { favorite_page_ids: legacyIds },
            "legacy-page-favorites-localStorage"
          );
        }
      } catch (error) {
        console.warn("[Zhinote] Failed to hydrate page favorites:", error);
      }
    }

    void hydrateFromWorkspaceSettings();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) refreshFavoriteIds();
    };
    const handleFavoritesChanged = () => refreshFavoriteIds();

    window.addEventListener("storage", handleStorage);
    window.addEventListener(FAVORITES_CHANGED_EVENT, handleFavoritesChanged);
    return () => {
      cancelled = true;
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
