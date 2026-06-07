"use client";

import { useCallback, useEffect, useState } from "react";
import Editor from "@/components/editor/Editor";
import IconPicker from "@/components/shared/IconPicker";
import PageProperties from "@/components/page/PageProperties";
import { usePage } from "@/hooks/usePage";
import { usePages } from "@/hooks/usePages";
import {
  parsePageProperties,
  stringifyPageProperties,
  type PageProperty,
} from "@/lib/pages/pageProperties";

interface PagePeekModalProps {
  pageId: string;
  onClose: () => void;
  onOpenFull: (pageId: string) => void;
  onChanged?: () => void;
}

// A center modal that shows a page (title + properties + body) fully editable,
// without leaving the current view — Notion's "peek" behaviour.
export default function PagePeekModal({
  pageId,
  onClose,
  onOpenFull,
  onChanged,
}: PagePeekModalProps) {
  const { page, loading, update } = usePage(pageId);
  const { refresh } = usePages();
  const [title, setTitle] = useState("");
  const [properties, setProperties] = useState<PageProperty[]>([]);

  useEffect(() => {
    if (!page) return;
    queueMicrotask(() => {
      setTitle(page.title);
      setProperties(parsePageProperties(page.properties));
    });
  }, [page]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleTitleChange = useCallback(
    async (next: string) => {
      setTitle(next);
      await update({ title: next });
      refresh();
      onChanged?.();
    },
    [update, refresh, onChanged]
  );

  const handlePropertiesChange = useCallback(
    async (next: PageProperty[]) => {
      setProperties(next);
      await update({ properties: stringifyPageProperties(next) });
      refresh();
      onChanged?.();
    },
    [update, refresh, onChanged]
  );

  const handleIconChange = useCallback(
    async (icon: string) => {
      await update({ icon });
      refresh();
      onChanged?.();
    },
    [update, refresh, onChanged]
  );

  const handleContentUpdate = useCallback(
    async (html: string) => {
      await update({ content_text: html });
      refresh();
      onChanged?.();
    },
    [update, refresh, onChanged]
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/30 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[calc(100vh-3rem)] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-950"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-label="页面弹窗"
      >
        <header className="flex items-center justify-end gap-1 border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => onOpenFull(pageId)}
            className="rounded px-2 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            title="打开完整页面"
          >
            打开完整页面 ↗
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

        <div className="flex-1 overflow-y-auto px-8 py-6">
          {loading || !page ? (
            <div className="py-16 text-center text-sm text-zinc-400">
              正在加载页面…
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-start gap-2">
                <IconPicker currentIcon={page.icon} onSelect={handleIconChange} />
                <input
                  type="text"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="未命名页面"
                  className="mt-1 w-full border-none bg-transparent text-2xl font-bold text-zinc-900 outline-none placeholder-zinc-300 dark:text-zinc-100 dark:placeholder-zinc-600"
                />
              </div>

              <PageProperties
                properties={properties}
                onChange={handlePropertiesChange}
              />

              <div className="my-3 border-t border-zinc-100 dark:border-zinc-800" />

              <Editor
                pageId={pageId}
                initialContent={page.content_text}
                editable
                onUpdate={handleContentUpdate}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
