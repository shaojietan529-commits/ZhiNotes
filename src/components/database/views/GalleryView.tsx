"use client";

import type { DatabaseField, DatabaseRow, Page } from "@/lib/utils/types";
import { formatRelativeDate } from "@/lib/utils/dates";
import { stringifyMultiSelectValue } from "@/lib/database/multiSelectValues";
import { stringifyRelationValue } from "@/lib/database/relationValues";

interface GalleryViewProps {
  fields: DatabaseField[];
  rows: (DatabaseRow & { page: Page })[];
  onAddRow: () => void;
  onUpdateRow: (rowId: string, fieldValues: Record<string, unknown>) => void;
  onDeleteRow: (rowId: string) => void;
  onOpenRow: (pageId: string) => void;
  relationPages: Page[];
}

export default function GalleryView({
  fields,
  rows,
  onAddRow,
  onDeleteRow,
  onOpenRow,
  relationPages,
}: GalleryViewProps) {
  return (
    <div>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-400">还没有行。</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => {
            const fieldValues = parseFieldValues(row.field_values);
            const extraFields = fields.slice(1, 5).filter((field) => {
              const value = fieldValues[field.id];
              return value !== undefined && value !== null && value !== "";
            });

            return (
              <article
                key={row.id}
                className="group overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900"
              >
                <button
                  type="button"
                  onClick={() => onOpenRow(row.page_id)}
                  className="block w-full text-left"
                >
                  {row.page?.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={row.page.cover_url}
                      alt=""
                      className="h-28 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-24 items-center justify-center bg-zinc-50 text-3xl dark:bg-zinc-800">
                      {row.page?.icon || "□"}
                    </div>
                  )}
                  <div className="p-3">
                    <h3 className="line-clamp-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {row.page?.title || "未命名页面"}
                    </h3>
                    <p className="mt-1 text-[11px] text-zinc-400">
                      {formatRelativeDate(row.created_at)}
                    </p>
                    {extraFields.length > 0 && (
                      <dl className="mt-3 space-y-1">
                        {extraFields.map((field) => {
                          const value = fieldValues[field.id];
                          const label =
                            field.field_type === "relation"
                              ? stringifyRelationValue(value, relationPages)
                              : field.field_type === "multi_select"
                                ? stringifyMultiSelectValue(value)
                              : String(value);
                          if (!label) return null;
                          return (
                            <div key={field.id} className="flex gap-2 text-xs">
                              <dt className="w-20 shrink-0 truncate text-zinc-400">
                                {field.name}
                              </dt>
                              <dd className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-300">
                                {label}
                              </dd>
                            </div>
                          );
                        })}
                      </dl>
                    )}
                  </div>
                </button>
                <div className="flex justify-end border-t border-zinc-100 px-3 py-2 opacity-0 transition-opacity group-hover:opacity-100 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => onDeleteRow(row.id)}
                    className="text-xs text-zinc-400 hover:text-red-500"
                    title="删除行"
                  >
                    删除
                  </button>
                </div>
              </article>
            );
          })}
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

function parseFieldValues(fieldValues: string) {
  try {
    return JSON.parse(fieldValues || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}
