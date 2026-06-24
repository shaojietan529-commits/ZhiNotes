"use client";

import { useCallback, useEffect, useState } from "react";
import Editor from "@/components/editor/Editor";
import IconPicker from "@/components/shared/IconPicker";
import PageProperties from "@/components/page/PageProperties";
import { usePage } from "@/hooks/usePage";
import { usePages } from "@/hooks/usePages";
import { displayPageTitle } from "@/lib/pages/displayTitle";
import {
  parsePageProperties,
  stringifyPageProperties,
  type PageProperty,
} from "@/lib/pages/pageProperties";
import type { Page } from "@/lib/utils/types";

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
  const { refresh } = usePages();
  const [fallbackPage, setFallbackPage] = useState<Page | null>(
    initialPage ?? null
  );
  const [title, setTitle] = useState("");
  const [properties, setProperties] = useState<PageProperty[]>([]);
  const effectivePage = page ?? fallbackPage;

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

  const handleTitleChange = useCallback(
    async (next: string) => {
      setTitle(next);
      await persistPeekUpdate({
        basePage: effectivePage,
        updates: { title: next },
        update,
        setFallbackPage,
      });
      refresh();
      onChanged?.();
    },
    [effectivePage, update, refresh, onChanged]
  );

  const handlePropertiesChange = useCallback(
    async (next: PageProperty[]) => {
      setProperties(next);
      await persistPeekUpdate({
        basePage: effectivePage,
        updates: { properties: stringifyPageProperties(next) },
        update,
        setFallbackPage,
      });
      refresh();
      onChanged?.();
    },
    [effectivePage, update, refresh, onChanged]
  );

  const handleIconChange = useCallback(
    async (icon: string) => {
      await persistPeekUpdate({
        basePage: effectivePage,
        updates: { icon },
        update,
        setFallbackPage,
      });
      refresh();
      onChanged?.();
    },
    [effectivePage, update, refresh, onChanged]
  );

  const handleIconRemove = useCallback(async () => {
    await persistPeekUpdate({
      basePage: effectivePage,
      updates: { icon: null },
      update,
      setFallbackPage,
    });
    refresh();
    onChanged?.();
  }, [effectivePage, update, refresh, onChanged]);

  const handleContentUpdate = useCallback(
    async (html: string) => {
      await persistPeekUpdate({
        basePage: effectivePage,
        updates: { content_text: html },
        update,
        setFallbackPage,
      });
      refresh();
      onChanged?.();
    },
    [effectivePage, update, refresh, onChanged]
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

              <Editor
                pageId={pageId}
                initialContent={effectivePage?.content_text ?? null}
                editable
                onUpdate={handleContentUpdate}
              />

              <PeekChildPages pageId={pageId} onOpen={onOpenFull} />
            </div>
          )}
        </div>
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
}: {
  basePage: Page | null;
  updates: PeekPageUpdates;
  update: (updates: PeekPageUpdates) => Promise<Page | null>;
  setFallbackPage: (page: Page) => void;
}) {
  if (!basePage) return null;
  try {
    const updated = await update(updates);
    if (updated) {
      setFallbackPage(updated);
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
  await pushPeekCloudPage(nextPage).catch(() => undefined);
  return nextPage;
}

async function pushPeekCloudPage(page: Page) {
  await fetch("/api/pages/account-sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "push",
      pages: [
        {
          id: page.id,
          parent_id: page.parent_id ?? null,
          title: page.title ?? "",
          icon: page.icon ?? null,
          cover_url: page.cover_url ?? null,
          content_text: page.content_text ?? null,
          properties: page.properties ?? null,
          position: page.position ?? 0,
          depth: page.depth ?? 0,
          created_at: page.created_at,
          updated_at: page.updated_at,
          deleted_at: page.deleted_at ?? null,
        },
      ],
    }),
  });
}

function PeekChildPages({
  pageId,
  onOpen,
}: {
  pageId: string;
  onOpen: (id: string) => void;
}) {
  const { pages } = usePages();
  const children = pages.filter((p) => p.parent_id === pageId);
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
