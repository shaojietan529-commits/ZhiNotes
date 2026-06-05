"use client";

import type { DatabaseField, DatabaseRow } from "@/lib/utils/types";
import type { Page } from "@/lib/utils/types";
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

interface ListViewProps {
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

export default function ListView({
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
}: ListViewProps) {
  return (
    <div>
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-400 py-6 text-center">
          还没有行。
        </p>
      ) : (
        <ul className="space-y-1">
          {rows.map((row, index) => {
            const fieldValues: Record<string, unknown> =
              typeof row.field_values === "string"
                ? JSON.parse(row.field_values || "{}")
                : row.field_values || {};

            // Show first 3 non-Name fields as properties
            const extraFields = fields.slice(1, 4);

            return (
              <li
                key={row.id}
                className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-900 group transition-colors"
              >
                <button
                  onClick={() => onOpenRow(row.page_id)}
                  className="flex-1 flex items-center gap-2 text-left"
                >
                  <span className="shrink-0">{row.page?.icon || "📄"}</span>
                  <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                    {row.page?.title || "未命名页面"}
                  </span>
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
                        <span
                          key={field.id}
                          title={result.detail}
                          className="text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded px-1.5 py-0.5"
                        >
                          {result.label}
                        </span>
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
                        <span
                          key={field.id}
                          title={result.detail}
                          className="text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded px-1.5 py-0.5"
                        >
                          {result.label}
                        </span>
                      );
                    }
                    const val = isDatabaseSystemField(field)
                      ? getDatabaseSystemFieldValue(row, field)
                      : fieldValues[field.id];
                    if (val === undefined || val === null || val === "") return null;
                    const label =
                      isDatabaseSystemField(field)
                        ? isDatabaseSystemTimeField(field)
                          ? formatRelativeDate(String(val))
                          : String(val)
                      : field.field_type === "relation"
                        ? stringifyRelationValue(val, relationPages)
                        : field.field_type === "multi_select"
                          ? stringifyMultiSelectValue(val)
                        : field.field_type === "number"
                          ? formatDatabaseNumberValue(val, field)
                        : String(val);
                    if (!label) return null;
                    return (
                      <span
                        key={field.id}
                        className="text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded px-1.5 py-0.5"
                      >
                        {label}
                      </span>
                    );
                  })}
                </button>
                <span className="text-[10px] text-zinc-400 shrink-0">
                  {formatRelativeDate(row.created_at)}
                </span>
                <button
                  type="button"
                  disabled={!canMoveRows || index === 0}
                  onClick={() => onMoveRow(row.id, "up")}
                  className="opacity-0 transition-opacity text-xs text-zinc-400 hover:text-zinc-700 disabled:cursor-default disabled:opacity-30 group-hover:opacity-100 dark:hover:text-zinc-200"
                  title="上移行：只调整本地手动排序，不改字段值"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={!canMoveRows || index === rows.length - 1}
                  onClick={() => onMoveRow(row.id, "down")}
                  className="opacity-0 transition-opacity text-xs text-zinc-400 hover:text-zinc-700 disabled:cursor-default disabled:opacity-30 group-hover:opacity-100 dark:hover:text-zinc-200"
                  title="下移行：只调整本地手动排序，不改字段值"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => onDuplicateRow(row.id)}
                  className="opacity-0 transition-opacity text-xs text-zinc-400 hover:text-zinc-700 group-hover:opacity-100 dark:hover:text-zinc-200"
                  title="复制行：只复制本地字段值，不复制页面正文"
                >
                  复制
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteRow(row.id)}
                  className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 text-xs transition-opacity"
                  title="删除行"
                >
                  x
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {showAddRow && (
        <button
          onClick={onAddRow}
          className="w-full flex items-center gap-2 px-3 py-2 mt-1 text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-md transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          新建行
        </button>
      )}
    </div>
  );
}
