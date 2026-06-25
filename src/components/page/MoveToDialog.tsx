"use client";

import { useEffect, useRef, useState } from "react";
import { listMoveTargetPageMetadata } from "@/lib/db/local/queries";
import { displayPageTitle } from "@/lib/pages/displayTitle";
import type { Page } from "@/lib/utils/types";

interface MoveToDialogProps {
  pageId: string;
  onMove: (targetId: string | null) => void;
  onClose: () => void;
}

export default function MoveToDialog({
  pageId,
  onMove,
  onClose,
}: MoveToDialogProps) {
  const [query, setQuery] = useState("");
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(
      () => {
        setLoading(true);
        listMoveTargetPageMetadata({ pageId, query, limit: 30 })
          .then((targets) => {
            if (!cancelled) setPages(targets);
          })
          .catch(() => {
            if (!cancelled) setPages([]);
          })
          .finally(() => {
            if (!cancelled) setLoading(false);
          });
      },
      query.trim() ? 160 : 0
    );
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [pageId, query]);

  useEffect(() => {
    inputRef.current?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[20vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
            移动到
          </h3>
          <input
            ref={inputRef}
            type="text"
            placeholder="搜索页面..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
          />
        </div>

        <div className="max-h-72 overflow-y-auto py-1">
          <button
            type="button"
            onClick={() => onMove(null)}
            className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <span className="text-base">📂</span>
            <span className="font-medium">根目录（顶层）</span>
          </button>

          {pages.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onMove(p.id)}
              className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <span className="text-base">{p.icon || "\u{1F4C4}"}</span>
              <span className="truncate">{displayPageTitle(p.title)}</span>
            </button>
          ))}

          {pages.length === 0 && (
            <p className="px-4 py-3 text-center text-xs text-zinc-400">
              {loading ? "正在搜索..." : "没有匹配的页面"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
