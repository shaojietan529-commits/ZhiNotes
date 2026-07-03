"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { IconPickerProps } from "@/components/shared/IconPicker";
import type { PagePropertiesProps } from "@/components/page/PageProperties";
import { usePage } from "@/hooks/usePage";
import { usePageRevision } from "@/hooks/usePageRevision";
import { displayPageTitle } from "@/lib/pages/displayTitle";
import { getPageMetadata, listPageMetadata } from "@/lib/db/local/queries";
import {
  parsePageProperties,
  stringifyPageProperties,
  type PageProperty,
} from "@/lib/pages/pageProperties";
import {
  getLocalPerformanceNow,
  recordLocalPerformanceSnapshot,
} from "@/lib/performance/localPerformance";
import {
  describePageBodyHydrationStatus,
  getPageBodyHydrationStatus,
  publishPageBodyHydrationStatus,
  subscribePageBodyHydrationStatus,
} from "@/lib/pages/pageBodyHydrationStatus";
import { readPageRouteHandoff } from "@/lib/pages/pageRouteHandoff";
import { prepareLocalFirstPageNavigation } from "@/lib/pages/localFirstPageNavigation";
import {
  readPendingPageDraft,
  rememberPendingPageDraft,
} from "@/lib/pages/pendingPageDrafts";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { Page } from "@/lib/utils/types";

const Editor = dynamic(() => import("@/components/editor/Editor"), {
  ssr: false,
  loading: () => <PeekEditorSkeleton label="正在载入编辑器…" />,
});
const IconPicker = dynamic<IconPickerProps>(
  () => import("@/components/shared/IconPicker"),
  {
    ssr: false,
    loading: () => <PeekIconPickerSkeleton />,
  }
);
const PageProperties = dynamic<PagePropertiesProps>(
  () => import("@/components/page/PageProperties"),
  {
    ssr: false,
    loading: () => <PeekPropertiesSkeleton />,
  }
);

const PEEK_METADATA_ONLY_CONTENT_DELAY_MS = 260;
const PEEK_METADATA_ONLY_CONTENT_IDLE_TIMEOUT_MS = 700;
const PEEK_LARGE_BODY_HTML_CHARS = 180 * 1024;
const PEEK_LARGE_BODY_EDITOR_DELAY_MS = 260;
const PEEK_LARGE_BODY_EDITOR_IDLE_TIMEOUT_MS = 1600;
const PEEK_LOCAL_SEED_RETRY_DELAYS_MS = [80, 240, 600];
const PEEK_TITLE_SAVE_DEBOUNCE_MS = 420;
const loadPageAccountSyncModule = () => import("@/lib/pages/accountPageSync");

export interface PagePeekModalProps {
  pageId: string;
  initialPage?: Page | null;
  onClose: () => void;
  onOpenFull: (pageId: string) => void;
  onReady?: (pageId: string) => void;
  onChanged?: () => void;
}

function getInitialPeekPage(
  pageId: string,
  initialPage?: Page | null
): Page | null {
  if (initialPage?.id === pageId) return initialPage;
  return readLocalFirstPeekSeed(pageId);
}

function readLocalFirstPeekSeed(pageId: string): Page | null {
  return (
    readPendingPageDraft(pageId) ??
    useWorkspaceStore.getState().getPageById(pageId) ??
    readPageRouteHandoff(pageId) ??
    null
  );
}

function applyPeekMetadataSnapshot(
  page: Page | null,
  setFallbackPage: (page: Page | null) => void,
  setTitle: (title: string) => void,
  setProperties: (properties: PageProperty[]) => void
) {
  setFallbackPage(page);
  setTitle(page?.title ?? "");
  setProperties(page ? parsePageProperties(page.properties) : []);
}

// A center modal that shows a page (title + properties + body) fully editable,
// without leaving the current view — Notion's "peek" behaviour.
export default function PagePeekModal({
  pageId,
  initialPage,
  onClose,
  onOpenFull,
  onReady,
  onChanged,
}: PagePeekModalProps) {
  const upsertPages = useWorkspaceStore((s) => s.upsertPages);
  const initialPeekPage = getInitialPeekPage(pageId, initialPage);
  const [fallbackPage, setFallbackPage] = useState<Page | null>(
    () => initialPeekPage
  );
  const [metadataLoading, setMetadataLoading] = useState(
    () => !initialPeekPage
  );
  const [editorLoadRequested, setEditorLoadRequested] = useState(false);
  const { page, loading, update } = usePage(pageId, {
    enabled: editorLoadRequested,
    surface: "peek",
  });
  const [title, setTitle] = useState(() => initialPeekPage?.title ?? "");
  const [properties, setProperties] = useState<PageProperty[]>(() =>
    initialPeekPage ? parsePageProperties(initialPeekPage.properties) : []
  );
  const [bodyHydrationStatus, setBodyHydrationStatus] = useState(() =>
    getPageBodyHydrationStatus(pageId)
  );
  const [renderedPeekPageId, setRenderedPeekPageId] = useState(pageId);
  const previousPageIdRef = useRef(pageId);
  const peekOpenStartedAtRef = useRef(getLocalPerformanceNow());
  const peekOpenStartedAtIsoRef = useRef(new Date().toISOString());
  const recordedPeekPerformancePageIdRef = useRef<string | null>(null);
  const readyNotifiedPageIdRef = useRef<string | null>(null);
  const titleSaveTimerRef = useRef<number | null>(null);
  const pendingTitleRef = useRef<string | null>(null);
  const isSwitchingPeekPage = renderedPeekPageId !== pageId;
  const currentLoadedPage = page?.id === pageId ? page : null;
  const currentFallbackPage = fallbackPage?.id === pageId ? fallbackPage : null;
  const currentInitialPage = initialPage?.id === pageId ? initialPage : null;
  const localFirstSeedPage = currentFallbackPage ?? currentInitialPage;
  const hasInitialEditableBody = localFirstSeedPage?.content_text != null;
  const isOptimisticDraft = localFirstSeedPage?.content_text === "";
  const effectivePage =
    currentLoadedPage ?? currentFallbackPage ?? currentInitialPage ?? null;
  const pageBodyHtmlLength = effectivePage?.content_text?.length ?? 0;
  const hasLargeBodyForPeek = isLargePeekBodyForEditor(
    effectivePage?.content_text
  );
  const isMetadataOnlyPeek =
    Boolean(effectivePage) &&
    effectivePage?.content_text == null &&
    !isOptimisticDraft;
  const bodyLoading =
    editorLoadRequested &&
    loading &&
    Boolean(effectivePage) &&
    effectivePage?.content_text == null &&
    !hasInitialEditableBody;
  const hasEffectivePage = Boolean(effectivePage);
  const [mountedEditorPageId, setMountedEditorPageId] = useState<string | null>(
    null
  );
  const [childPagesReadyPageId, setChildPagesReadyPageId] = useState<
    string | null
  >(null);
  const editorMounted = mountedEditorPageId === pageId;
  const childPagesEnabled = editorMounted && childPagesReadyPageId === pageId;
  const bodyHydrationLabel =
    describePageBodyHydrationStatus(bodyHydrationStatus);
  const latestPeekSaveRef = useRef({
    basePage: effectivePage,
    update,
    upsertPages,
    onChanged,
  });

  useEffect(() => {
    latestPeekSaveRef.current = {
      basePage: effectivePage,
      update,
      upsertPages,
      onChanged,
    };
  }, [effectivePage, onChanged, update, upsertPages]);

  useEffect(() => {
    if (previousPageIdRef.current === pageId) return;
    previousPageIdRef.current = pageId;
    peekOpenStartedAtRef.current = getLocalPerformanceNow();
    peekOpenStartedAtIsoRef.current = new Date().toISOString();
    recordedPeekPerformancePageIdRef.current = null;
    readyNotifiedPageIdRef.current = null;
    queueMicrotask(() => {
      const nextInitial = getInitialPeekPage(pageId, initialPage);
      applyPeekMetadataSnapshot(
        nextInitial,
        setFallbackPage,
        setTitle,
        setProperties
      );
      setMetadataLoading(!nextInitial);
      setEditorLoadRequested(false);
      setMountedEditorPageId(null);
      setChildPagesReadyPageId(null);
      setRenderedPeekPageId(pageId);
    });
  }, [initialPage, pageId]);

  useEffect(() => {
    let cancelled = false;
    const refreshLocalPeekSeed = () => {
      if (cancelled) return;
      const nextInitial = getInitialPeekPage(pageId, initialPage);
      if (!nextInitial) return;
      applyPeekMetadataSnapshot(
        nextInitial,
        setFallbackPage,
        setTitle,
        setProperties
      );
      setMetadataLoading(false);
    };
    refreshLocalPeekSeed();
    queueMicrotask(refreshLocalPeekSeed);
    const retryTimers = PEEK_LOCAL_SEED_RETRY_DELAYS_MS.map((delay) =>
      window.setTimeout(refreshLocalPeekSeed, delay)
    );
    return () => {
      cancelled = true;
      retryTimers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [initialPage, pageId]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setBodyHydrationStatus(getPageBodyHydrationStatus(pageId));
      }
    });
    const unsubscribe = subscribePageBodyHydrationStatus(pageId, setBodyHydrationStatus);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [pageId]);

  useEffect(() => {
    if (initialPage?.id === pageId || fallbackPage?.id === pageId) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setMetadataLoading(true);
    });
    void getPageMetadata(pageId)
      .then((metadata) => {
        if (cancelled) return;
        if (metadata) {
          applyPeekMetadataSnapshot(
            metadata,
            setFallbackPage,
            setTitle,
            setProperties
          );
          upsertPages([metadata]);
        } else {
          setEditorLoadRequested(true);
        }
      })
      .catch(() => {
        if (!cancelled) setEditorLoadRequested(true);
      })
      .finally(() => {
        if (!cancelled) setMetadataLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fallbackPage?.id, initialPage, pageId, upsertPages]);

  useEffect(() => {
    if (!page) return;
    queueMicrotask(() => {
      applyPeekMetadataSnapshot(page, setFallbackPage, setTitle, setProperties);
    });
  }, [page]);

  useEffect(() => {
    if (!effectivePage) return;
    publishPageBodyHydrationStatus({
      pageId,
      phase:
        effectivePage.content_text == null ? "metadata-ready" : "local-body-ready",
      surface: "peek",
      metadataOnly: effectivePage.content_text == null,
    });
    queueMicrotask(() => {
      setTitle(effectivePage.title);
      setProperties(parsePageProperties(effectivePage.properties));
    });
  }, [effectivePage, pageId]);

  useEffect(() => {
    if (!effectivePage || metadataLoading) return;
    if (readyNotifiedPageIdRef.current !== pageId) {
      readyNotifiedPageIdRef.current = pageId;
      onReady?.(pageId);
    }
    if (recordedPeekPerformancePageIdRef.current === pageId) return;
    recordedPeekPerformancePageIdRef.current = pageId;
    const durationMs = getLocalPerformanceNow() - peekOpenStartedAtRef.current;
    recordLocalPerformanceSnapshot({
      kind: "page-peek",
      label: "页面预览",
      route: "/page/[pageId]#peek",
      status: getPeekOpenPerformanceStatus(effectivePage),
      startedAt: peekOpenStartedAtIsoRef.current,
      durationMs,
      localFirstMs: durationMs,
      backgroundMs: 0,
      counts: {
        metadata_only: effectivePage.content_text == null ? 1 : 0,
        has_content_html:
          typeof effectivePage.content_text === "string" &&
          effectivePage.content_text.length > 0
            ? 1
            : 0,
        body_html_chars: effectivePage.content_text?.length ?? 0,
        large_body_editor_deferred: isLargePeekBodyForEditor(
          effectivePage.content_text
        )
          ? 1
          : 0,
        has_cover: effectivePage.cover_url ? 1 : 0,
        optimistic_draft: isOptimisticDraft ? 1 : 0,
        property_count: parsePageProperties(effectivePage.properties).length,
      },
    });
  }, [effectivePage, isOptimisticDraft, metadataLoading, onReady, pageId]);

  const handleOpenFullPage = useCallback(() => {
    const seed = effectivePage ?? getInitialPeekPage(pageId, initialPage);
    if (seed) prepareLocalFirstPageNavigation(seed, "page-open");
    onOpenFull(pageId);
  }, [effectivePage, initialPage, onOpenFull, pageId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      // Cmd+Enter (mac) / Ctrl+Enter — jump to the full page view.
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        handleOpenFullPage();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleOpenFullPage, onClose]);

  useEffect(() => {
    if (!hasEffectivePage || editorMounted) return;
    if (isOptimisticDraft) {
      queueMicrotask(() => {
        setEditorLoadRequested(true);
        setMountedEditorPageId(pageId);
      });
      return;
    }
    if (
      effectivePage?.content_text != null ||
      (editorLoadRequested && !loading)
    ) {
      return schedulePeekEditorMount(() => {
        setMountedEditorPageId(pageId);
      }, hasLargeBodyForPeek);
    }
    if (!editorLoadRequested) {
      return schedulePeekContentLoad(() => {
        setEditorLoadRequested(true);
      }, isMetadataOnlyPeek);
    }
  }, [
    editorLoadRequested,
    editorMounted,
    effectivePage?.content_text,
    hasLargeBodyForPeek,
    hasEffectivePage,
    isOptimisticDraft,
    isMetadataOnlyPeek,
    loading,
    pageId,
  ]);

  useEffect(() => {
    if (!editorMounted) return;
    return schedulePeekIdleTask(() => {
      setChildPagesReadyPageId(pageId);
    }, 900);
  }, [editorMounted, pageId]);

  const persistPeekTitleNow = useCallback(
    async (next: string) => {
      const latest = latestPeekSaveRef.current;
      await persistPeekUpdate({
        basePage: latest.basePage,
        updates: { title: next },
        update: latest.update,
        setFallbackPage,
        upsertPages: latest.upsertPages,
      });
      latest.onChanged?.();
    },
    []
  );

  const flushPeekTitleSave = useCallback(async () => {
    if (titleSaveTimerRef.current !== null) {
      window.clearTimeout(titleSaveTimerRef.current);
      titleSaveTimerRef.current = null;
    }
    const next = pendingTitleRef.current;
    pendingTitleRef.current = null;
    if (next === null) return;
    await persistPeekTitleNow(next);
  }, [persistPeekTitleNow]);

  const schedulePeekTitleSave = useCallback(
    (next: string) => {
      pendingTitleRef.current = next;
      if (titleSaveTimerRef.current !== null) {
        window.clearTimeout(titleSaveTimerRef.current);
      }
      titleSaveTimerRef.current = window.setTimeout(() => {
        titleSaveTimerRef.current = null;
        void flushPeekTitleSave();
      }, PEEK_TITLE_SAVE_DEBOUNCE_MS);
    },
    [flushPeekTitleSave]
  );

  useEffect(() => {
    return () => {
      if (titleSaveTimerRef.current !== null) {
        window.clearTimeout(titleSaveTimerRef.current);
        titleSaveTimerRef.current = null;
      }
      const next = pendingTitleRef.current;
      pendingTitleRef.current = null;
      if (next !== null) void persistPeekTitleNow(next);
    };
  }, [pageId, persistPeekTitleNow]);

  const handleTitleChange = useCallback(
    (next: string) => {
      setTitle(next);
      schedulePeekTitleSave(next);
    },
    [schedulePeekTitleSave]
  );

  const handlePropertiesChange = useCallback(
    async (next: PageProperty[]) => {
      setProperties(next);
      await persistPeekUpdate({
        basePage: effectivePage,
        updates: { properties: stringifyPageProperties(next) },
        update,
        setFallbackPage,
        upsertPages,
      });
      onChanged?.();
    },
    [effectivePage, update, upsertPages, onChanged]
  );

  const handleIconChange = useCallback(
    async (icon: string) => {
      await persistPeekUpdate({
        basePage: effectivePage,
        updates: { icon },
        update,
        setFallbackPage,
        upsertPages,
      });
      onChanged?.();
    },
    [effectivePage, update, upsertPages, onChanged]
  );

  const handleIconRemove = useCallback(async () => {
    await persistPeekUpdate({
      basePage: effectivePage,
      updates: { icon: null },
      update,
      setFallbackPage,
      upsertPages,
    });
    onChanged?.();
  }, [effectivePage, update, upsertPages, onChanged]);

  const handleContentUpdate = useCallback(
    async (html: string) => {
      await persistPeekUpdate({
        basePage: effectivePage,
        updates: { content_text: html },
        update,
        setFallbackPage,
        upsertPages,
      });
      onChanged?.();
    },
    [effectivePage, update, upsertPages, onChanged]
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/25 p-4"
      onMouseDown={onClose}
      role="presentation"
      data-testid="page-peek-modal"
      data-local-seed-state={hasEffectivePage ? "ready" : "loading"}
      data-optimistic-draft={isOptimisticDraft}
      data-editor-mounted={editorMounted}
      data-body-loading={bodyLoading}
      data-metadata-loading={metadataLoading}
    >
      <div
        className="flex h-[85vh] w-[82vw] flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-950"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-label="页面弹窗"
      >
        <header className="flex items-center justify-end gap-1 border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
          <button
            type="button"
            onClick={handleOpenFullPage}
            className="rounded px-2 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            title="打开完整页面（⌘+回车）"
          >
            打开完整页面 ↗ <span className="ml-1 text-[10px] text-zinc-400">⌘⏎</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            aria-label="关闭"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-10 py-6">
          {(loading || metadataLoading || isSwitchingPeekPage) &&
          !effectivePage ? (
            <PeekMetadataRecoveryShell
              pageId={pageId}
              initialPage={initialPage}
              onOpenFullPage={handleOpenFullPage}
            />
          ) : (
            <div className="mx-auto w-full max-w-4xl">
              <div className="mb-3 flex items-start gap-2">
                <IconPicker
                  currentIcon={effectivePage?.icon ?? null}
                  onSelect={handleIconChange}
                  onRemove={handleIconRemove}
                />
                <input
                  type="text"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  onBlur={() => void flushPeekTitleSave()}
                  placeholder="新页面"
                  autoFocus={!effectivePage?.title}
                  className="mt-1 w-full border-none bg-transparent text-2xl font-bold text-zinc-900 outline-none placeholder-zinc-300 dark:text-zinc-100 dark:placeholder-zinc-600"
                />
              </div>

              <PageProperties
                properties={properties}
                pageId={pageId}
                onChange={handlePropertiesChange}
              />

              <div className="my-3 border-t border-zinc-100 dark:border-zinc-800" />

              {bodyLoading ? (
                <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 px-4 py-6 text-sm text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/40">
                  {bodyHydrationLabel ??
                    (isMetadataOnlyPeek
                      ? "标题和属性已先显示，正在从本地缓存补齐正文…"
                      : "正在按需加载正文…")}
                </div>
              ) : editorMounted ? (
                <Editor
                  pageId={pageId}
                  initialContent={effectivePage?.content_text ?? null}
                  editable
                  onUpdate={handleContentUpdate}
                />
              ) : (
                <PeekEditorSkeleton
                  label={
                    isMetadataOnlyPeek
                      ? bodyHydrationLabel ??
                        "标题和属性已先显示，正在排队补齐正文和编辑器…"
                      : hasLargeBodyForPeek
                        ? `正文较长（约 ${formatApproxPeekBodySize(pageBodyHtmlLength)}），弹窗已先显示标题和属性，编辑器正在空闲时段准备…`
                        : "正在准备编辑器…"
                  }
                />
              )}

              {childPagesEnabled ? (
                <PeekChildPages pageId={pageId} onOpen={onOpenFull} />
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PeekMetadataRecoveryShell({
  pageId,
  initialPage,
  onOpenFullPage,
}: {
  pageId: string;
  initialPage?: Page | null;
  onOpenFullPage: () => void;
}) {
  const seed = getInitialPeekPage(pageId, initialPage);
  const title = seed ? displayPageTitle(seed.title) : "正在打开页面";
  const propertyCount = seed ? parsePageProperties(seed.properties).length : 0;
  const isOptimisticDraft = seed?.content_text === "";

  return (
    <div
      className="mx-auto w-full max-w-4xl py-10"
      data-testid="page-peek-metadata-recovery-shell"
      data-local-seed-state={seed ? "ready" : "loading"}
      data-optimistic-draft={isOptimisticDraft}
    >
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-lg dark:bg-zinc-800">
          {seed?.icon || "📄"}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {title}
          </h2>
          <p className="mt-1 text-xs text-zinc-400">
            {seed
              ? `已先显示本地页面信息 · ${propertyCount} 个属性`
              : "本地标题和属性还在读取。可以等待弹窗补齐，也可以直接进入完整页面继续。"}
          </p>
        </div>
      </div>
      <div className="mb-6 rounded border border-zinc-100 bg-zinc-50 px-4 py-3 text-xs text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/40">
        {isOptimisticDraft
          ? "新页面已在本机创建，完整编辑器正在载入。"
          : "弹窗会先读取轻量 metadata，再按需加载正文，避免大批量导入后的页面打开被长正文拖慢。"}
      </div>
      <button
        type="button"
        onClick={onOpenFullPage}
        className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        打开完整页面继续编辑 ↗
      </button>
      <PeekEditorSkeleton
        label={seed ? "正在准备编辑器…" : "正在准备本地页面壳和编辑器…"}
      />
    </div>
  );
}

function schedulePeekEditorMount(
  callback: () => void,
  largeBody = false
): () => void {
  if (!largeBody) return schedulePeekIdleTask(callback, 40);
  return schedulePeekIdleTask(callback, PEEK_LARGE_BODY_EDITOR_IDLE_TIMEOUT_MS, {
    delay: PEEK_LARGE_BODY_EDITOR_DELAY_MS,
  });
}

function schedulePeekContentLoad(
  callback: () => void,
  metadataOnly = false
): () => void {
  if (!metadataOnly) return schedulePeekIdleTask(callback, 60);
  return schedulePeekIdleTask(
    callback,
    PEEK_METADATA_ONLY_CONTENT_IDLE_TIMEOUT_MS,
    { delay: PEEK_METADATA_ONLY_CONTENT_DELAY_MS }
  );
}

function schedulePeekIdleTask(
  callback: () => void,
  timeout = 350,
  options: { delay?: number } = {}
): () => void {
  const maybeWindow = window as Window & {
    requestIdleCallback?: (
      cb: () => void,
      options?: { timeout?: number }
    ) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  const delay = Math.max(0, options.delay ?? 0);
  let timer: number | null = null;
  let idleId: number | null = null;
  const requestTask = () => {
    if (maybeWindow.requestIdleCallback) {
      idleId = maybeWindow.requestIdleCallback(callback, { timeout });
      return;
    }
    timer = window.setTimeout(callback, Math.min(timeout, 120));
  };
  if (delay > 0) {
    timer = window.setTimeout(() => {
      timer = null;
      requestTask();
    }, delay);
  } else {
    requestTask();
  }
  return () => {
    if (idleId !== null) maybeWindow.cancelIdleCallback?.(idleId);
    if (timer !== null) window.clearTimeout(timer);
  };
}

function PeekEditorSkeleton({ label }: { label: string }) {
  return (
    <div className="min-h-[180px] rounded-lg border border-zinc-200 bg-zinc-50/70 px-4 py-5 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="mb-4 h-3 w-36 rounded bg-zinc-200/80 dark:bg-zinc-800" />
      <div className="space-y-3">
        <div className="h-3 w-full max-w-2xl rounded bg-zinc-200/70 dark:bg-zinc-800/80" />
        <div className="h-3 w-10/12 max-w-2xl rounded bg-zinc-200/60 dark:bg-zinc-800/70" />
        <div className="h-3 w-7/12 max-w-2xl rounded bg-zinc-200/50 dark:bg-zinc-800/60" />
      </div>
      <p className="mt-5 text-xs text-zinc-400">{label}</p>
    </div>
  );
}

function isLargePeekBodyForEditor(content: string | null | undefined): boolean {
  return (content?.length ?? 0) > PEEK_LARGE_BODY_HTML_CHARS;
}

function getPeekOpenPerformanceStatus(
  page: Page
): "local-draft-ready" | "metadata-ready" | "content-ready" {
  if (page.content_text === "") return "local-draft-ready";
  if (page.content_text == null) return "metadata-ready";
  return "content-ready";
}

function formatApproxPeekBodySize(length: number): string {
  if (length <= 0) return "0 KB";
  const kilobytes = Math.max(1, Math.round(length / 1024));
  if (kilobytes < 1024) return `${kilobytes} KB`;
  return `${(kilobytes / 1024).toFixed(1)} MB`;
}

function PeekIconPickerSkeleton() {
  return (
    <div
      className="mt-1 h-8 w-20 shrink-0 rounded-md bg-zinc-100 dark:bg-zinc-800"
      aria-hidden="true"
    />
  );
}

function PeekPropertiesSkeleton() {
  return (
    <div
      className="mb-6 space-y-2"
      aria-label="属性面板加载中"
      role="status"
    >
      <div className="flex items-center gap-2">
        <div className="h-4 w-28 rounded bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-4 w-48 rounded bg-zinc-100 dark:bg-zinc-800" />
      </div>
      <div className="flex items-center gap-2">
        <div className="h-4 w-28 rounded bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-4 w-36 rounded bg-zinc-100 dark:bg-zinc-800" />
      </div>
    </div>
  );
}

type PeekPageUpdates = Partial<
  Pick<Page, "title" | "icon" | "content_text" | "properties">
>;

async function persistPeekUpdate({
  basePage,
  updates,
  update,
  setFallbackPage,
  upsertPages,
}: {
  basePage: Page | null;
  updates: PeekPageUpdates;
  update: (updates: PeekPageUpdates) => Promise<Page | null>;
  setFallbackPage: (page: Page) => void;
  upsertPages: (pages: Page[]) => void;
}) {
  if (!basePage) return null;
  try {
    const updated = await update(updates);
    if (updated) {
      setFallbackPage(updated);
      upsertPages([updated]);
      return updated;
    }
  } catch {
    // Fall through to account-cloud persistence. This keeps the peek editor
    // usable when the browser's local SQLite/localStorage database is slow or
    // temporarily failing after a large import.
  }

  const nextPage: Page = {
    ...basePage,
    ...updates,
    updated_at: new Date().toISOString(),
  };
  setFallbackPage(nextPage);
  upsertPages([nextPage]);
  rememberPendingPageDraft(nextPage);
  // Queueing is best-effort; the local editor state remains visible and the
  // next page-sync cycle can still pick up pending changes.
  void pushPeekCloudPage(nextPage).catch(() => undefined);
  return nextPage;
}

async function pushPeekCloudPage(page: Page) {
  const { pageToRemoteRecord, queueCloudPagePush } =
    await loadPageAccountSyncModule();
  queueCloudPagePush(pageToRemoteRecord(page));
}

function PeekChildPages({
  pageId,
  onOpen,
}: {
  pageId: string;
  onOpen: (id: string) => void;
}) {
  const dbReady = useWorkspaceStore((s) => s.dbReady);
  const pageRevision = usePageRevision();
  const [children, setChildren] = useState<Page[]>([]);

  useEffect(() => {
    if (!dbReady) {
      queueMicrotask(() => setChildren([]));
      return;
    }
    let cancelled = false;
    void listPageMetadata(pageId)
      .then((rows) => {
        if (!cancelled) setChildren(rows);
      })
      .catch(() => {
        if (!cancelled) setChildren([]);
      });
    return () => {
      cancelled = true;
    };
  }, [dbReady, pageId, pageRevision]);

  if (children.length === 0) return null;
  return (
    <div className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <h3 className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          子页面 · {children.length}
        </h3>
      </div>
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {children.map((child) => (
          <li key={child.id}>
            <button
              type="button"
              onClick={() => onOpen(child.id)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800/60"
            >
              <span className="shrink-0">{child.icon || "📄"}</span>
              <span className="truncate">{displayPageTitle(child.title)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
