"use client";

import type { DatabaseField, DatabaseRow, Page } from "@/lib/utils/types";
import { formatRelativeDate } from "@/lib/utils/dates";

interface FeedViewProps {
  fields: DatabaseField[];
  rows: (DatabaseRow & { page: Page })[];
  onAddRow: () => void;
  onUpdateRow: (rowId: string, fieldValues: Record<string, unknown>) => void;
  onDeleteRow: (rowId: string) => void;
  onOpenRow: (pageId: string) => void;
}

export default function FeedView({
  rows,
  onAddRow,
  onDeleteRow,
  onOpenRow,
}: FeedViewProps) {
  const sortedRows = [...rows].sort((left, right) =>
    String(right.page?.updated_at || right.updated_at).localeCompare(
      String(left.page?.updated_at || left.updated_at)
    )
  );

  return (
    <div>
      {sortedRows.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-400">还没有行。</p>
      ) : (
        <div className="space-y-3">
          {sortedRows.map((row) => (
            <article
              key={row.id}
              className="group rounded-md border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => onOpenRow(row.page_id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <h3 className="truncate text-sm font-semibold text-zinc-900 hover:text-blue-600 dark:text-zinc-100 dark:hover:text-blue-400">
                    {row.page?.icon ? `${row.page.icon} ` : ""}
                    {row.page?.title || "未命名页面"}
                  </h3>
                  <p className="mt-1 text-xs text-zinc-400">
                    更新于 {formatRelativeDate(row.page?.updated_at || row.updated_at)}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteRow(row.id)}
                  className="opacity-0 text-xs text-zinc-400 transition-opacity hover:text-red-500 group-hover:opacity-100"
                  title="删除行"
                >
                  删除
                </button>
              </div>
              {row.page?.content_text && (
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                  {stripHtml(row.page.content_text)}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={onAddRow}
        className="mt-3 flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        新建行
      </button>
    </div>
  );
}

function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
