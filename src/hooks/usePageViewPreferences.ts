"use client";

import { useCallback, useEffect, useState } from "react";
import { getWorkspaceSetting, upsertWorkspaceSetting } from "@/lib/db/local/queries";
import {
  PAGE_VIEW_PREFERENCES_SETTING_KEY,
  getDefaultPageViewPreferences,
  normalizeChildTreeViewModes,
  normalizeLockedPageIds,
  parsePageViewPreferencesWorkspaceSetting,
  type PageViewPreferencesWorkspaceSettingValue,
} from "@/lib/sync/pageViewPreferencesWorkspaceSettings";

export type ChildTreeViewMode = "list" | "calendar";

export const PAGE_VIEW_PREFERENCES_CHANGED_EVENT =
  "zhinote:page-view-preferences-changed";

export const PAGE_WIDE_LOCAL_STORAGE_KEY = "zhinote.page.wide";
export const PAGE_COMMENTS_PANEL_LOCAL_STORAGE_KEY =
  "zhinote.page.comments-panel";

export function pageLockedLocalStorageKey(pageId: string) {
  return `zhinote.page.locked.${pageId}`;
}

export function childTreeViewModeLocalStorageKey(pageId: string) {
  return `zhinote.childtree.view.${pageId}`;
}

export function readLegacyPageViewPreferences(
  pageIds: string[] = []
): PageViewPreferencesWorkspaceSettingValue {
  if (typeof window === "undefined") return getDefaultPageViewPreferences();

  const lockedPageIds = new Set<string>();
  const childTreeViewModes: Record<string, ChildTreeViewMode> = {};
  for (const pageId of pageIds) {
    if (
      window.localStorage.getItem(pageLockedLocalStorageKey(pageId)) === "true"
    ) {
      lockedPageIds.add(pageId);
    }
    const childTreeMode = window.localStorage.getItem(
      childTreeViewModeLocalStorageKey(pageId)
    );
    if (childTreeMode === "list" || childTreeMode === "calendar") {
      childTreeViewModes[pageId] = childTreeMode;
    }
  }

  return {
    wide_page:
      window.localStorage.getItem(PAGE_WIDE_LOCAL_STORAGE_KEY) === "true",
    comments_panel_open:
      window.localStorage.getItem(PAGE_COMMENTS_PANEL_LOCAL_STORAGE_KEY) ===
      "true",
    locked_page_ids: normalizeLockedPageIds([...lockedPageIds]),
    child_tree_view_modes: normalizeChildTreeViewModes(childTreeViewModes),
  };
}

export function writePageViewPreferencesFastCache(
  preferences: PageViewPreferencesWorkspaceSettingValue,
  knownPageIds: string[] = [],
  options: { notify?: boolean } = {}
) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      PAGE_WIDE_LOCAL_STORAGE_KEY,
      String(preferences.wide_page)
    );
    window.localStorage.setItem(
      PAGE_COMMENTS_PANEL_LOCAL_STORAGE_KEY,
      String(preferences.comments_panel_open)
    );

    const lockedSet = new Set(preferences.locked_page_ids);
    for (const pageId of knownPageIds) {
      window.localStorage.setItem(
        pageLockedLocalStorageKey(pageId),
        String(lockedSet.has(pageId))
      );
    }
    for (const pageId of preferences.locked_page_ids) {
      window.localStorage.setItem(pageLockedLocalStorageKey(pageId), "true");
    }
    for (const pageId of knownPageIds) {
      window.localStorage.removeItem(childTreeViewModeLocalStorageKey(pageId));
    }
    for (const [pageId, mode] of Object.entries(
      preferences.child_tree_view_modes
    )) {
      window.localStorage.setItem(childTreeViewModeLocalStorageKey(pageId), mode);
    }
  } catch {
    // localStorage is only a fast boot cache and migration source.
  }

  if (options.notify !== false) {
    window.dispatchEvent(
      new CustomEvent(PAGE_VIEW_PREFERENCES_CHANGED_EVENT, {
        detail: { preferences },
      })
    );
  }
}

export async function readPageViewPreferencesSetting(): Promise<PageViewPreferencesWorkspaceSettingValue> {
  const setting = await getWorkspaceSetting(PAGE_VIEW_PREFERENCES_SETTING_KEY);
  return parsePageViewPreferencesWorkspaceSetting(setting);
}

export async function upsertPageViewPreferencesSetting(
  next: PageViewPreferencesWorkspaceSettingValue,
  source: string
) {
  return upsertWorkspaceSetting(
    PAGE_VIEW_PREFERENCES_SETTING_KEY,
    next,
    source
  );
}

export async function migrateLegacyPageViewPreferences(
  pageIds: string[] = [],
  source = "legacy-page-view-localStorage"
) {
  const setting = await getWorkspaceSetting(PAGE_VIEW_PREFERENCES_SETTING_KEY);
  if (setting) {
    return parsePageViewPreferencesWorkspaceSetting(setting);
  }

  const legacy = readLegacyPageViewPreferences(pageIds);
  if (
    legacy.wide_page ||
    legacy.comments_panel_open ||
    legacy.locked_page_ids.length > 0 ||
    Object.keys(legacy.child_tree_view_modes).length > 0
  ) {
    await upsertPageViewPreferencesSetting(legacy, source);
  }
  return legacy;
}

export function usePageViewPreferences(pageId: string) {
  const [preferences, setPreferences] = useState(() =>
    readLegacyPageViewPreferences([pageId])
  );

  useEffect(() => {
    let cancelled = false;
    const legacy = readLegacyPageViewPreferences([pageId]);
    queueMicrotask(() => {
      if (!cancelled) setPreferences(legacy);
    });

    async function hydrateFromWorkspaceSettings() {
      try {
        const setting = await getWorkspaceSetting(PAGE_VIEW_PREFERENCES_SETTING_KEY);
        const cloudReadyPreferences = parsePageViewPreferencesWorkspaceSetting(setting);

        if (cancelled) return;

        if (setting) {
          setPreferences(cloudReadyPreferences);
          writePageViewPreferencesFastCache(cloudReadyPreferences, [pageId], {
            notify: false,
          });
          return;
        }

        if (
          legacy.wide_page ||
          legacy.comments_panel_open ||
          legacy.locked_page_ids.length > 0 ||
          Object.keys(legacy.child_tree_view_modes).length > 0
        ) {
          await upsertPageViewPreferencesSetting(
            legacy,
            "legacy-page-view-localStorage"
          );
        }
      } catch (error) {
        console.warn("[Zhinote] Failed to hydrate page view preferences:", error);
      }
    }

    void hydrateFromWorkspaceSettings();

    const handleChanged = (event: Event) => {
      const preferencesFromEvent = (
        event as CustomEvent<{
          preferences?: PageViewPreferencesWorkspaceSettingValue;
        }>
      ).detail?.preferences;
      if (preferencesFromEvent) {
        setPreferences(preferencesFromEvent);
        return;
      }
      void readPageViewPreferencesSetting()
        .then((next) => {
          if (!cancelled) setPreferences(next);
        })
        .catch(() => undefined);
    };
    window.addEventListener(PAGE_VIEW_PREFERENCES_CHANGED_EVENT, handleChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(
        PAGE_VIEW_PREFERENCES_CHANGED_EVENT,
        handleChanged
      );
    };
  }, [pageId]);

  const persistPatch = useCallback(
    (patch: Partial<PageViewPreferencesWorkspaceSettingValue>, source: string) => {
      setPreferences((current) => {
        const next = {
          ...current,
          ...patch,
          locked_page_ids: patch.locked_page_ids
            ? normalizeLockedPageIds(patch.locked_page_ids)
            : current.locked_page_ids,
          child_tree_view_modes: patch.child_tree_view_modes
            ? normalizeChildTreeViewModes(patch.child_tree_view_modes)
            : current.child_tree_view_modes,
        };
        writePageViewPreferencesFastCache(next, [pageId]);
        void upsertPageViewPreferencesSetting(next, source).catch((error) => {
          console.warn(
            "[Zhinote] Failed to persist page view preferences:",
            error
          );
        });
        return next;
      });
    },
    [pageId]
  );

  const setLocked = useCallback(
    (nextLocked: boolean) => {
      setPreferences((current) => {
        const lockedSet = new Set(current.locked_page_ids);
        if (nextLocked) {
          lockedSet.add(pageId);
        } else {
          lockedSet.delete(pageId);
        }
        const next = {
          ...current,
          locked_page_ids: normalizeLockedPageIds([...lockedSet]),
        };
        writePageViewPreferencesFastCache(next, [pageId]);
        void upsertPageViewPreferencesSetting(
          next,
          "local-page-view-lock-ui"
        ).catch((error) => {
          console.warn(
            "[Zhinote] Failed to persist page lock preference:",
            error
          );
        });
        return next;
      });
    },
    [pageId]
  );

  const setWidePage = useCallback(
    (wide_page: boolean) =>
      persistPatch({ wide_page }, "local-page-view-width-ui"),
    [persistPatch]
  );

  const setCommentsPanelOpen = useCallback(
    (comments_panel_open: boolean) =>
      persistPatch(
        { comments_panel_open },
        "local-page-view-comments-panel-ui"
      ),
    [persistPatch]
  );

  const setChildTreeViewMode = useCallback(
    (targetPageId: string, mode: ChildTreeViewMode) => {
      setPreferences((current) => {
        const next = {
          ...current,
          child_tree_view_modes: normalizeChildTreeViewModes({
            ...current.child_tree_view_modes,
            [targetPageId]: mode,
          }),
        };
        writePageViewPreferencesFastCache(next, [pageId, targetPageId]);
        void upsertPageViewPreferencesSetting(
          next,
          "local-child-tree-view-mode-ui"
        ).catch((error) => {
          console.warn(
            "[Zhinote] Failed to persist child tree view preference:",
            error
          );
        });
        return next;
      });
    },
    [pageId]
  );

  return {
    locked: preferences.locked_page_ids.includes(pageId),
    widePage: preferences.wide_page,
    commentsPanelOpen: preferences.comments_panel_open,
    childTreeViewMode: preferences.child_tree_view_modes[pageId] ?? "calendar",
    childTreeViewModes: preferences.child_tree_view_modes,
    setLocked,
    setWidePage,
    setCommentsPanelOpen,
    setChildTreeViewMode,
    toggleLock: () => setLocked(!preferences.locked_page_ids.includes(pageId)),
    toggleWidePage: () => setWidePage(!preferences.wide_page),
    toggleCommentsPanelOpen: () =>
      setCommentsPanelOpen(!preferences.comments_panel_open),
  };
}
