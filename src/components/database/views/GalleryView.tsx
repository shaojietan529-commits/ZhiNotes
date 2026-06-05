"use client";

import type { DatabaseField, DatabaseRow, Page } from "@/lib/utils/types";
import { formatRelativeDate } from "@/lib/utils/dates";
import { evaluateDatabaseFormula } from "@/lib/database/formula";
import { evaluateDatabaseRollup } from "@/lib/database/rollup";
import { stringifyMultiSelectValue } from "@/lib/database/multiSelectValues";
import { formatDatabaseNumberValue } from "@/lib/database/numberValues";
import { stringifyRelationValue } from "@/lib/database/relationValues";
import {
  getDatabaseSystemFieldValue,
  isDatabaseSystemField,
  isDatabaseSystemTimeField,
} from "@/lib/database/systemFields";

interface GalleryViewProps {
  fields: DatabaseField[];
  rows: (DatabaseRow & { page: Page })[];
  onAddRow: () => void;
  onUpdateRow: (rowId: string, fieldValues: Record<string, unknown>) => void;
  onDeleteRow: (rowId: string) => void;
  onDuplicateRow: (rowId: string) => void;
  onMoveRow: (rowId: string, direction: "up" | "down") => void;
  onOpenRow: (pageId: string) => void;
  relationPages: Page[];
  showAddRow?: boolean;
  canMoveRows?: boolean;
}

export default function GalleryView({
  fields,
  rows,
  onAddRow,
  onDeleteRow,
  onDuplicateRow,
  onMoveRow,
  onOpenRow,
  relationPages,
  showAddRow = true,
  canMoveRows = true,
}: GalleryViewProps) {
  return (
    <div>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-400">还没有行。</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row, index) => {
            const fieldValues = parseFieldValues(row.field_values);
            const extraFields = fields.slice(1, 5).filter((field) => {
              if (field.field_type === "formula") {
                return Boolean(
                  evaluateDatabaseFormula(field, fields, row, fieldValues).label
                );
              }
              if (field.field_type === "rollup") {
                return Boolean(
                  evaluateDatabaseRollup(
                    field,
                    fields,
                    fieldValues,
                    relationPages
                  ).label
                );
              }
              const value = isDatabaseSystemField(field)
                ? getDatabaseSystemFieldValue(row, field)
                : fieldValues[field.id];
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
                          if (field.field_type === "formula") {
                            const result = evaluateDatabaseFormula(
                              field,
                              fields,
                              row,
                              fieldValues
                            );
                            if (!result.label) return null;
                            return (
                              <div key={field.id} className="flex gap-2 text-xs">
                                <dt className="w-20 shrink-0 truncate text-zinc-400">
                                  {field.name}
                                </dt>
                                <dd
                                  className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-300"
                                  title={result.detail}
                                >
                                  {result.label}
                                </dd>
                              </div>
                            );
                          }
                          if (field.field_type === "rollup") {
                            const result = evaluateDatabaseRollup(
                              field,
                              fields,
                              fieldValues,
                              relationPages
                            );
                            if (!result.label) return null;
                            return (
                              <div key={field.id} className="flex gap-2 text-xs">
                                <dt className="w-20 shrink-0 truncate text-zinc-400">
                                  {field.name}
                                </dt>
                                <dd
                                  className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-300"
                                  title={result.detail}
                                >
                                  {result.label}
                                </dd>
                              </div>
                            );
                          }
                          const value = isDatabaseSystemField(field)
                            ? getDatabaseSystemFieldValue(row, field)
                            : fieldValues[field.id];
                          const label =
                            isDatabaseSystemField(field)
                              ? isDatabaseSystemTimeField(field)
                                ? formatRelativeDate(String(value))
                                : String(value)
                            : field.field_type === "relation"
                              ? stringifyRelationValue(value, relationPages)
                              : field.field_type === "multi_select"
                                ? stringifyMultiSelectValue(value)
                              : field.field_type === "number"
                                ? formatDatabaseNumberValue(value, field)
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
                <div className="flex justify-end gap-2 border-t border-zinc-100 px-3 py-2 opacity-0 transition-opacity group-hover:opacity-100 dark:border-zinc-800">
                  <button
                    type="button"
                    disabled={!canMoveRows || index === 0}
                    onClick={() => onMoveRow(row.id, "up")}
                    className="text-xs text-zinc-400 hover:text-zinc-700 disabled:cursor-default disabled:opacity-30 dark:hover:text-zinc-200"
                    title="上移行：只调整本地手动排序，不改字段值"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={!canMoveRows || index === rows.length - 1}
                    onClick={() => onMoveRow(row.id, "down")}
                    className="text-xs text-zinc-400 hover:text-zinc-700 disabled:cursor-default disabled:opacity-30 dark:hover:text-zinc-200"
                    title="下移行：只调整本地手动排序，不改字段值"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => onDuplicateRow(row.id)}
                    className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                    title="复制行：只复制本地字段值，不复制页面正文"
                  >
                    复制
                  </button>
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
      {showAddRow && (
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
      )}
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
