"use client";

import { useCallback, useState, useRef, useEffect, useMemo } from "react";
import {
  ICON_CATEGORIES,
  searchIcons,
} from "@/lib/icons/iconCatalog";

export interface IconPickerProps {
  currentIcon: string | null;
  onSelect: (icon: string) => void;
  // Optional: clears the icon back to none (Notion-style "Remove" action).
  onRemove?: () => void;
  disabled?: boolean;
}

export default function IconPicker({
  currentIcon,
  onSelect,
  onRemove,
  disabled = false,
}: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(ICON_CATEGORIES[0]!.id);
  const ref = useRef<HTMLDivElement>(null);

  const closePicker = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveCategory(ICON_CATEGORIES[0]!.id);
  }, []);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        closePicker();
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [closePicker, open]);

  const searching = query.trim().length > 0;
  const results = useMemo(() => (searching ? searchIcons(query) : []), [
    searching,
    query,
  ]);
  const categoryIcons =
    ICON_CATEGORIES.find((category) => category.id === activeCategory)?.icons ??
    [];
  const shownIcons = searching ? results : categoryIcons;

  const choose = (icon: string) => {
    onSelect(icon);
    closePicker();
  };

  return (
    <div className="relative" ref={ref}>
      {currentIcon ? (
        <button
          onClick={() => {
            if (disabled) return;
            if (open) closePicker();
            else setOpen(true);
          }}
          disabled={disabled}
          className="text-3xl hover:bg-zinc-100 disabled:cursor-default disabled:hover:bg-transparent dark:hover:bg-zinc-800 dark:disabled:hover:bg-transparent rounded-md p-1 transition-colors"
          title="更换图标"
        >
          {currentIcon}
        </button>
      ) : (
        // Notion-style: a page with no icon shows no glyph — just a subtle
        // "添加图标" affordance instead of a placeholder document icon.
        !disabled && (
          <button
            onClick={() => {
              if (open) closePicker();
              else setOpen(true);
            }}
            className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-zinc-300 transition-all hover:bg-zinc-100 hover:text-zinc-500 dark:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            title="添加图标"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M9 10h.01M15 10h.01M9 15c.8.7 1.9 1 3 1s2.2-.3 3-1" />
            </svg>
            添加图标
          </button>
        )
      )}

      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-[320px] rounded-lg border border-zinc-200 bg-white p-2 shadow-xl dark:border-zinc-700 dark:bg-zinc-800">
          {/* Search + remove */}
          <div className="mb-2 flex items-center gap-1.5">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索图标（中英文）…"
              className="min-w-0 flex-1 rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-sm text-zinc-800 outline-none placeholder-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            {currentIcon && onRemove && (
              <button
                type="button"
                onClick={() => {
                  onRemove();
                  setOpen(false);
                }}
                className="shrink-0 rounded-md px-2 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-red-500 dark:hover:bg-zinc-700"
                title="移除图标"
              >
                移除
              </button>
            )}
          </div>

          {/* Category tabs (hidden while searching) */}
          {!searching && (
            <div className="mb-2 flex flex-wrap gap-1">
              {ICON_CATEGORIES.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setActiveCategory(category.id)}
                  className={`rounded-md px-2 py-1 text-xs transition-colors ${
                    activeCategory === category.id
                      ? "bg-zinc-900 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                  }`}
                >
                  {category.label}
                </button>
              ))}
            </div>
          )}

          {/* Icon grid */}
          {shownIcons.length === 0 ? (
            <p className="px-1 py-6 text-center text-xs text-zinc-400">
              没有匹配的图标
            </p>
          ) : (
            <div className="grid max-h-56 grid-cols-8 gap-0.5 overflow-y-auto">
              {shownIcons.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => choose(emoji)}
                  className={`flex h-8 w-8 items-center justify-center rounded text-lg transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-700 ${
                    currentIcon === emoji ? "bg-zinc-200 dark:bg-zinc-600" : ""
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
