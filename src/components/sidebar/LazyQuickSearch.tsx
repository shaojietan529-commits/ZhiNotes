"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { QuickSearchProps } from "./QuickSearch";

const QuickSearch = dynamic<QuickSearchProps>(() => import("./QuickSearch"), {
  ssr: false,
  loading: () => <QuickSearchTrigger disabled label="加载搜索..." />,
});

export default function LazyQuickSearch() {
  const [loaded, setLoaded] = useState(false);
  const [initialOpen, setInitialOpen] = useState(false);
  const preloadRef = useRef<Promise<unknown> | null>(null);

  const preloadQuickSearch = useCallback(() => {
    if (!preloadRef.current) {
      preloadRef.current = import("./QuickSearch");
    }
    return preloadRef.current;
  }, []);

  const loadQuickSearch = useCallback(
    (open: boolean) => {
      setInitialOpen(open);
      setLoaded(true);
      void preloadQuickSearch();
    },
    [preloadQuickSearch]
  );

  useEffect(() => {
    if (loaded) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") {
        return;
      }
      if (isEditorTarget(event.target)) return;
      event.preventDefault();
      loadQuickSearch(true);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [loadQuickSearch, loaded]);

  if (loaded) {
    return <QuickSearch initialOpen={initialOpen} />;
  }

  return (
    <QuickSearchTrigger
      onClick={() => loadQuickSearch(true)}
      onFocus={preloadQuickSearch}
      onPointerEnter={preloadQuickSearch}
    />
  );
}

interface QuickSearchTriggerProps {
  disabled?: boolean;
  label?: string;
  onClick?: () => void;
  onFocus?: () => void;
  onPointerEnter?: () => void;
}

function QuickSearchTrigger({
  disabled = false,
  label = "搜索...",
  onClick,
  onFocus,
  onPointerEnter,
}: QuickSearchTriggerProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      onFocus={onFocus}
      onPointerEnter={onPointerEnter}
      disabled={disabled}
      className="flex w-full items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:border-zinc-300 disabled:cursor-wait disabled:opacity-70 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-zinc-600"
      aria-label="打开搜索"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
      </svg>
      <span className="flex-1 text-left">{label}</span>
      <kbd className="rounded border border-zinc-200 px-1 text-[10px] text-zinc-300 dark:border-zinc-700 dark:text-zinc-600">
        &#8984;K
      </kbd>
    </button>
  );
}

function isEditorTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest(".ProseMirror") || target.isContentEditable);
}
