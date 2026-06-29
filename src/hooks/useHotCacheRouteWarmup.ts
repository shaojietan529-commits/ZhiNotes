"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getWorkspaceSetting } from "@/lib/db/local/queries";
import {
  DEFAULT_HOT_CACHE_PREFERENCES,
  HOT_CACHE_PREFERENCES_CHANGED_EVENT,
  HOT_CACHE_PREFERENCES_CHANGED_STORAGE_KEY,
  HOT_CACHE_PREFERENCES_SETTING_KEY,
  parseHotCachePreferences,
} from "@/lib/sync/hotCacheSelectionSettings";
import { prefetchHotCacheRoutes } from "@/lib/sync/hotCacheRouteWarmup";
import { useWorkspaceStore } from "@/stores/workspaceStore";

let lastWarmupKey: string | null = null;
let warmupInFlight = false;

function scheduleHotCacheIdleTask(callback: () => void, timeout = 1800): void {
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
  window.setTimeout(callback, Math.min(timeout, 800));
}

export function useHotCacheRouteWarmup() {
  const router = useRouter();
  const dbReady = useWorkspaceStore((state) => state.dbReady);

  useEffect(() => {
    if (!dbReady) return;
    let cancelled = false;

    const runWarmup = () => {
      if (warmupInFlight) return;
      warmupInFlight = true;
      void getWorkspaceSetting(HOT_CACHE_PREFERENCES_SETTING_KEY)
        .catch(() => null)
        .then((setting) => {
          if (cancelled) return;
          const preferences = setting
            ? parseHotCachePreferences(setting)
            : DEFAULT_HOT_CACHE_PREFERENCES;
          const warmupKey = JSON.stringify(preferences);
          if (warmupKey === lastWarmupKey) return;
          prefetchHotCacheRoutes(
            (routeTarget) => router.prefetch(routeTarget),
            preferences
          );
          lastWarmupKey = warmupKey;
        })
        .finally(() => {
          warmupInFlight = false;
        });
    };

    const scheduleWarmup = () => {
      scheduleHotCacheIdleTask(runWarmup);
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === HOT_CACHE_PREFERENCES_CHANGED_STORAGE_KEY) {
        lastWarmupKey = null;
        scheduleWarmup();
      }
    };

    scheduleWarmup();
    window.addEventListener(HOT_CACHE_PREFERENCES_CHANGED_EVENT, scheduleWarmup);
    window.addEventListener("storage", handleStorage);
    return () => {
      cancelled = true;
      window.removeEventListener(
        HOT_CACHE_PREFERENCES_CHANGED_EVENT,
        scheduleWarmup
      );
      window.removeEventListener("storage", handleStorage);
    };
  }, [dbReady, router]);
}
