"use client";

import { useMemo } from "react";
import type { DatabaseField, DatabaseRow } from "@/lib/utils/types";
import type { Page } from "@/lib/utils/types";

interface KanbanViewProps {
  fields: DatabaseField[];
  rows: (DatabaseRow & { page: Page })[];
  onAddRow: () => void;
  onUpdateRow: (rowId: string, fieldValues: Record<string, unknown>) => void;
  onDeleteRow: (rowId: string) => void;
  onOpenRow: (pageId: string) => void;
}

export default function KanbanView({
  fields,
  rows,
  onDeleteRow,
  onOpenRow,
}: KanbanViewProps) {
  // Use Status first, then fall back to the first Select field.
  const groupField =
    fields.find((f) => f.field_type === "status") ||
    fields.find((f) => f.field_type === "select");

  const columns = useMemo(() => {
    if (!groupField) return [];
    const config = groupField.config ? JSON.parse(groupField.config) : {};
    const options: string[] = config.options || [];
    // Keep rows without a value visible in their own column.
    return ["", ...options];
  }, [groupField]);

  const groupedRows = useMemo(() => {
    const groups: Record<string, (DatabaseRow & { page: Page })[]> = {};
    for (const col of columns) {
      groups[col] = [];
    }
    for (const row of rows) {
      const fieldValues: Record<string, unknown> =
        typeof row.field_values === "string"
          ? JSON.parse(row.field_values || "{}")
          : row.field_values || {};
      const val = groupField ? (fieldValues[groupField.id] as string) || "" : "";
      if (!groups[val]) groups[val] = [];
      groups[val].push(row);
    }
    return groups;
  }, [rows, columns, groupField]);

  if (!groupField) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-zinc-400 mb-2">
          看板视图需要一个状态或单选字段。
        </p>
        <p className="text-xs text-zinc-400">
          请先添加带选项的状态或单选字段，再使用看板视图。
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {columns.map((col) => (
        <div
          key={col}
          className="shrink-0 w-64 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700"
        >
          {/* Column header */}
          <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {col || "无状态"}
            </span>
            <span className="text-xs text-zinc-400">
              {groupedRows[col]?.length || 0}
            </span>
          </div>

          {/* Cards */}
          <div className="p-2 space-y-2 min-h-[100px]">
            {(groupedRows[col] || []).map((row) => (
              <div
                key={row.id}
                className="bg-white dark:bg-zinc-800 rounded-md border border-zinc-200 dark:border-zinc-700 p-3 hover:shadow-sm transition-shadow group"
              >
                <button
                  onClick={() => onOpenRow(row.page_id)}
                  className="text-sm font-medium text-zinc-900 dark:text-zinc-100 text-left w-full hover:text-blue-600 dark:hover:text-blue-400"
                >
                  {row.page?.title || "未命名页面"}
                </button>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-zinc-400">
                    {row.page?.icon || "📄"}
                  </span>
                  <button
                    onClick={() => onDeleteRow(row.id)}
                    className="opacity-0 group-hover:opacity-100 text-[10px] text-zinc-400 hover:text-red-500 transition-opacity"
                    title="删除行"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
