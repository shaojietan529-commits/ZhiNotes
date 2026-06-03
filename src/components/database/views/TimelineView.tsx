"use client";

import { useMemo } from "react";
import type { DatabaseField, DatabaseRow, Page } from "@/lib/utils/types";
import { formatRelativeDate } from "@/lib/utils/dates";

interface TimelineViewProps {
  fields: DatabaseField[];
  rows: (DatabaseRow & { page: Page })[];
  onAddRow: () => void;
  onUpdateRow: (rowId: string, fieldValues: Record<string, unknown>) => void;
  onDeleteRow: (rowId: string) => void;
  onOpenRow: (pageId: string) => void;
}

interface TimelineRow {
  row: DatabaseRow & { page: Page };
  dateValue: string;
  label: string;
}

export default function TimelineView({
  fields,
  rows,
  onDeleteRow,
  onOpenRow,
}: TimelineViewProps) {
  const dateField = fields.find((field) => field.field_type === "date");

  const timelineRows = useMemo(() => {
    if (!dateField) return [];

    return rows
      .map((row): TimelineRow => {
        const values = parseFieldValues(row.field_values);
        const dateValue = String(values[dateField.id] ?? "");
        return {
          row,
          dateValue,
          label: dateValue || "无日期",
        };
      })
      .sort((left, right) => {
        if (!left.dateValue && !right.dateValue) return left.row.position - right.row.position;
        if (!left.dateValue) return 1;
        if (!right.dateValue) return -1;
        return left.dateValue.localeCompare(right.dateValue);
      });
  }, [rows, dateField]);

  if (!dateField) {
    return (
      <div className="py-8 text-center">
        <p className="mb-2 text-sm text-zinc-400">
          时间线视图需要一个日期字段。
        </p>
        <p className="text-xs text-zinc-400">
          请先添加日期字段，再使用时间线视图。
        </p>
      </div>
    );
  }

  if (timelineRows.length === 0) {
    return <p className="py-8 text-center text-sm text-zinc-400">还没有行。</p>;
  }

  return (
    <ol className="relative space-y-3 border-l border-zinc-200 pl-4 dark:border-zinc-700">
      {timelineRows.map(({ row, label, dateValue }) => (
        <li key={row.id} className="relative">
          <span className="absolute -left-[21px] top-2 h-2.5 w-2.5 rounded-full border border-white bg-zinc-300 dark:border-zinc-900 dark:bg-zinc-600" />
          <article className="group rounded-md border border-zinc-200 bg-white px-3 py-2 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => onOpenRow(row.page_id)}
                className="min-w-0 truncate text-left text-sm font-medium text-zinc-900 hover:text-blue-600 dark:text-zinc-100 dark:hover:text-blue-400"
              >
                {row.page?.icon ? `${row.page.icon} ` : ""}
                {row.page?.title || "未命名页面"}
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
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
              <span className="rounded bg-zinc-100 px-2 py-0.5 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {label}
              </span>
              {dateValue && <span>{formatRelativeDate(dateValue)}</span>}
            </div>
          </article>
        </li>
      ))}
    </ol>
  );
}

function parseFieldValues(fieldValues: string) {
  try {
    return JSON.parse(fieldValues || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}
