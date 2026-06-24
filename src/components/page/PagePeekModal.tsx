"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import IconPicker from "@/components/shared/IconPicker";
import PageProperties from "@/components/page/PageProperties";
import { usePage } from "@/hooks/usePage";
import { usePageRevision } from "@/hooks/usePageRevision";
import { displayPageTitle } from "@/lib/pages/displayTitle";
import { listPageMetadata } from "@/lib/db/local/queries";
import {
  parsePageProperties,
  stringifyPageProperties,
  type PageProperty,
} from "@/lib/pages/pageProperties";
import { pageToRemoteRecord, pushCloudPages } from "@/lib/pages/accountPageSync";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { Page } from "@/lib/utils/types";

const Editor = dynamic(() => import("@/components/editor/Editor"), {
  ssr: false,
  loading: () => <PeekEditorSkeleton label="正在载入编辑器…" />,
});

interface PagePeekModalProps {
  pageId: string;
  initialPage?: Page | null;
  onClose: () => void;
  onOpenFull: (pageId: string) => void;
  onChanged?: () => void;
}

// A center modal that shows a page (title + properties + body) fully editable,
// without leaving the current view — Notion's "peek" behaviour.
export default function PagePeekModal({
  pageId,
  initialPage,
  onClose,
  onOpenFull,
  onChanged,
}: PagePeekModalProps) {
  const { page, loading, update } = usePage(pageId);
  const upsertPages = useWorkspaceStore((s) => s.upsertPages);
  const [fallbackPage, setFallbackPage] = useState<Page | null>(
    initialPage ?? null
  );
  const [title, setTitle] = useState("");
  const [properties, setProperties] = useState<PageProperty[]>([]);
  const effectivePage = page ?? fallbackPage ?? initialPage ?? null;
  const bodyLoading =
    loading && Boolean(effectivePage) && effectivePage?.content_text == null;
  const hasEffectivePage = Boolean(effectivePage);
  const [mountedEditorPageId, setMountedEditorPageId] = useState<string | null>(
    null
  );
  const [childPagesReadyPageId, setChildPagesReadyPageId] = useState<
    string | null
  >(null);
  const editorMounted = mountedEditorPageId === pageId;
  const childPagesEnabled = editorMounted && childPagesReadyPageId === pageId;

  useEffect(() => {
    if (!initialPage) return;
    queueMicrotask(() => {
      setFallbackPage(initialPage);
    });
  }, [initialPage]);

  useEffect(() => {
    if (!page) return;
    queueMicrotask(() => {
      setFallbackPage(page);
    });
  }, [page]);

  useEffect(() => {
    if (!effectivePage) return;
    queueMicrotask(() => {
      setTitle(effectivePage.title);
      setProperties(parsePageProperties(effectivePage.properties));
    });
  }, [effectivePage]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      // Cmd+Enter (mac) / Ctrl+Enter — jump to the full page view.
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        onOpenFull(pageId);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onOpenFull, pageId]);

  useEffect(() => {
    if (bodyLoading || !hasEffectivePage) return;
    return schedulePeekEditorMount(() => {
      setMountedEditorPageId(pageId);
    });
  }, [bodyLoading, hasEffectivePage, pageId]);

  useEffect(() => {
    if (!editorMounted) return;
    return schedulePeekIdleTask(() => {
      setChildPagesReadyPageId(pageId);
    }, 900);
  }, [editorMounted, pageId]);

  const handleTitleChange = useCallback(
    async (next: string) => {
      setTitle(next);
      await persistPeekUpdate({
        basePage: effectivePage,
        updates: { title: next },
        update,
        setFallbackPage,
        upsertPages,
      });
      onChanged?.();
    },
    [effectivePage, update, upsertPages, onChanged]
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
            onClick={() => onOpenFull(pageId)}
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
          {loading && !effectivePage ? (
            <div className="py-16 text-center text-sm text-zinc-400">
              正在加载页面…
            </div>
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
                  正在按需加载正文…
                </div>
              ) : editorMounted ? (
                <Editor
                  pageId={pageId}
                  initialContent={effectivePage?.content_text ?? null}
                  editable
                  onUpdate={handleContentUpdate}
                />
              ) : (
                <PeekEditorSkeleton label="正在准备编辑器…" />
              )}

              <PeekChildPages
                pageId={pageId}
                enabled={childPagesEnabled}
                onOpen={onOpenFull}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function schedulePeekEditorMount(callback: () => void): () => void {
  return schedulePeekIdleTask(callback, 350);
}

function schedulePeekIdleTask(
  callback: () => void,
  timeout = 350
): () => void {
  const maybeWindow = window as Window & {
    requestIdleCallback?: (
      cb: () => void,
      options?: { timeout?: number }
    ) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (maybeWindow.requestIdleCallback && maybeWindow.cancelIdleCallback) {
    const idleId = maybeWindow.requestIdleCallback(callback, { timeout });
    return () => maybeWindow.cancelIdleCallback?.(idleId);
  }
  const timer = window.setTimeout(callback, Math.min(timeout, 120));
  return () => window.clearTimeout(timer);
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
  await pushPeekCloudPage(nextPage).catch(() => undefined);
  return nextPage;
}

async function pushPeekCloudPage(page: Page) {
  const result = await pushCloudPages([pageToRemoteRecord(page)]);
  if (result.status !== "ok") {
    throw new Error(result.message || "云端保存失败。");
  }
}

function PeekChildPages({
  pageId,
  enabled,
  onOpen,
}: {
  pageId: string;
  enabled: boolean;
  onOpen: (id: string) => void;
}) {
  const dbReady = useWorkspaceStore((s) => s.dbReady);
  const pageRevision = usePageRevision();
  const [children, setChildren] = useState<Page[]>([]);

  useEffect(() => {
    if (!enabled || !dbReady) {
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
  }, [dbReady, enabled, pageId, pageRevision]);

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
