"use client";

import { useState } from "react";
import type { Page } from "@/lib/utils/types";
import {
  getRelationPages,
  normalizeRelationValue,
} from "@/lib/database/relationValues";

interface RelationFieldEditorProps {
  value: unknown;
  pages: Page[];
  onChange: (value: string[]) => void;
  onOpenPage?: (pageId: string) => void;
  placeholder?: string;
  preferredPage?: Page | null;
}

export default function RelationFieldEditor({
  value,
  pages,
  onChange,
  onOpenPage,
  placeholder = "搜索页面",
  preferredPage,
}: RelationFieldEditorProps) {
  const [query, setQuery] = useState("");
  const selectedIds = normalizeRelationValue(value);
  const selectedRelations = getRelationPages(value, pages);
  const normalizedQuery = query.trim().toLowerCase();
  const canAddPreferredPage =
    Boolean(preferredPage) && !selectedIds.includes(preferredPage?.id ?? "");

  const suggestions = normalizedQuery
    ? pages
      .filter((page) => !selectedIds.includes(page.id))
      .filter((page) =>
        `${page.title} ${page.content_text ?? ""}`
          .toLowerCase()
          .includes(normalizedQuery)
      )
      .slice(0, 6)
    : [];

  const addRelation = (pageId: string) => {
    onChange([...selectedIds, pageId]);
    setQuery("");
  };

  const removeRelation = (pageId: string) => {
    onChange(selectedIds.filter((id) => id !== pageId));
  };

  return (
    <div className="min-w-[180px] space-y-1">
      {selectedRelations.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedRelations.map(({ id, page }) => (
            <span
              key={id}
              className="inline-flex max-w-full items-center gap-1 rounded-md bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-950 dark:text-blue-300"
            >
              <button
                type="button"
                onClick={() => onOpenPage?.(id)}
                className="max-w-[140px] truncate hover:underline"
                title={page?.title || id}
              >
                {page?.icon ? `${page.icon} ` : ""}
                {page?.title || "缺失页面"}
              </button>
              <button
                type="button"
                onClick={() => removeRelation(id)}
                className="text-blue-400 hover:text-blue-700 dark:hover:text-blue-200"
                title="移除关联"
              >
                x
              </button>
            </span>
          ))}
        </div>
      )}
      {preferredPage && canAddPreferredPage && (
        <button
          type="button"
          onClick={() => addRelation(preferredPage.id)}
          className="flex max-w-full items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-left text-xs text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
          title={preferredPage.title || preferredPage.id}
        >
          <span className="shrink-0">+</span>
          <span className="truncate">
            添加正在补全页面：{preferredPage.icon ? `${preferredPage.icon} ` : ""}
            {preferredPage.title || "未命名页面"}
          </span>
        </button>
      )}
      <div className="relative">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          className="w-full rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-500"
        />
        {normalizedQuery && (
          <div className="absolute left-0 top-full z-40 mt-1 max-h-44 w-64 overflow-y-auto rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            {suggestions.length > 0 ? (
              suggestions.map((page) => (
                <button
                  key={page.id}
                  type="button"
                  onClick={() => addRelation(page.id)}
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <span className="shrink-0">{page.icon || "📄"}</span>
                  <span className="min-w-0 truncate">
                    {page.title || "未命名页面"}
                  </span>
                </button>
              ))
            ) : (
              <div className="px-2 py-1.5 text-xs text-zinc-400">
                没有匹配页面
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
