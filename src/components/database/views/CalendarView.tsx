"use client";

import { useState, useMemo } from "react";
import type { DatabaseField, DatabaseRow } from "@/lib/utils/types";
import type { Page } from "@/lib/utils/types";
import {
  getDatabaseSystemFieldDateKey,
  isDatabaseSystemField,
  isDatabaseSystemTimeField,
} from "@/lib/database/systemFields";

interface CalendarViewProps {
  fields: DatabaseField[];
  rows: (DatabaseRow & { page: Page })[];
  onAddRow: () => void;
  onUpdateRow: (rowId: string, fieldValues: Record<string, unknown>) => void;
  onDeleteRow: (rowId: string) => void;
  onDuplicateRow: (rowId: string) => void;
  onOpenRow: (pageId: string) => void;
  onPrimeRow?: (pageId: string) => void;
  dateFieldId?: string;
}

export default function CalendarView({
  fields,
  rows,
  onDeleteRow,
  onDuplicateRow,
  onOpenRow,
  onPrimeRow,
  dateFieldId = "",
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const selectedDateField = fields.find(
    (field) =>
      field.id === dateFieldId &&
      (field.field_type === "date" || isDatabaseSystemTimeField(field))
  );
  const dateField =
    selectedDateField ||
    fields.find((field) => field.field_type === "date") ||
    fields.find(isDatabaseSystemTimeField);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const dayNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const monthNames = [
    "一月", "二月", "三月", "四月", "五月", "六月",
    "七月", "八月", "九月", "十月", "十一月", "十二月",
  ];

  // Map rows to dates
  const rowsByDate = useMemo(() => {
    const map: Record<string, (DatabaseRow & { page: Page })[]> = {};
    if (!dateField) return map;

    for (const row of rows) {
      const dateVal = getCalendarRowDateValue(row, dateField);
      if (dateVal) {
        if (!map[dateVal]) map[dateVal] = [];
        map[dateVal].push(row);
      }
    }
    return map;
  }, [rows, dateField]);
  const rowsWithoutDate = useMemo(() => {
    if (!dateField) return [];
    return rows.filter((row) => !getCalendarRowDateValue(row, dateField));
  }, [rows, dateField]);

  const prevMonth = () =>
    setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () =>
    setCurrentDate(new Date(year, month + 1, 1));
  const today = () => setCurrentDate(new Date());

  if (!dateField) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-zinc-400 mb-2">
          日历视图需要一个日期字段。
        </p>
        <p className="text-xs text-zinc-400">
          请先添加日期字段，再使用日历视图。
        </p>
      </div>
    );
  }

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div>
      {/* Navigation */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {year}年{monthNames[month]}
          </h3>
          <button
            onClick={nextMonth}
            className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
        <button
          onClick={today}
          className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700"
        >
          今天
        </button>
      </div>
      <p className="mb-2 text-[11px] text-zinc-400">
        日期字段：{dateField.name}
      </p>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-zinc-200 dark:bg-zinc-700 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700">
        {/* Day headers */}
        {dayNames.map((day) => (
          <div
            key={day}
            className="bg-zinc-50 dark:bg-zinc-900 px-2 py-1.5 text-[10px] font-medium text-zinc-500 text-center"
          >
            {day}
          </div>
        ))}

        {/* Day cells */}
        {cells.map((day, i) => {
          const dateStr = day
            ? `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
            : null;
          const dayRows = dateStr ? rowsByDate[dateStr] || [] : [];
          const isToday =
            day !== null &&
            new Date().toISOString().slice(0, 10) === dateStr;

          return (
            <div
              key={i}
              className={`bg-white dark:bg-zinc-800 min-h-[80px] p-1 ${
                day === null ? "bg-zinc-50 dark:bg-zinc-900" : ""
              }`}
            >
              {day !== null && (
                <>
                  <div
                    className={`text-xs mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                      isToday
                        ? "bg-blue-500 text-white font-bold"
                        : "text-zinc-500"
                    }`}
                  >
                    {day}
                  </div>
                  {dayRows.map((row) => (
                    <div
                      key={row.id}
                      className="group/event mb-0.5 flex items-center gap-0.5 rounded bg-blue-50 px-1 py-0.5 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
                    >
                      <button
                        type="button"
                        onPointerEnter={() => onPrimeRow?.(row.page_id)}
                        onPointerDown={() => onPrimeRow?.(row.page_id)}
                        onFocus={() => onPrimeRow?.(row.page_id)}
                        onClick={() => onOpenRow(row.page_id)}
                        className="min-w-0 flex-1 truncate text-left text-[10px] hover:text-blue-800 dark:hover:text-blue-200"
                      >
                        {row.page?.title || "未命名页面"}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDuplicateRow(row.id)}
                        className="hidden shrink-0 text-[10px] text-blue-400 hover:text-blue-800 group-hover/event:inline dark:text-blue-500 dark:hover:text-blue-200"
                        title="复制行：只复制本地字段值，不复制页面正文"
                      >
                        复制
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>
          );
        })}
      </div>
      {rowsWithoutDate.length > 0 && (
        <section className="mt-3 rounded-lg border border-dashed border-zinc-200 bg-zinc-50/60 p-2 dark:border-zinc-700 dark:bg-zinc-900/60">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h4 className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
              无日期
            </h4>
            <span className="text-[11px] text-zinc-400">
              {rowsWithoutDate.length} 行
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {rowsWithoutDate.map((row) => (
              <span
                key={row.id}
                className="group/event inline-flex max-w-full items-center gap-1 rounded bg-white px-2 py-1 text-xs text-zinc-600 shadow-sm dark:bg-zinc-800 dark:text-zinc-300"
              >
                <button
                  type="button"
                  onPointerEnter={() => onPrimeRow?.(row.page_id)}
                  onPointerDown={() => onPrimeRow?.(row.page_id)}
                  onFocus={() => onPrimeRow?.(row.page_id)}
                  onClick={() => onOpenRow(row.page_id)}
                  className="min-w-0 truncate text-left hover:text-blue-600 dark:hover:text-blue-300"
                >
                  {row.page?.title || "未命名页面"}
                </button>
                <button
                  type="button"
                  onClick={() => onDuplicateRow(row.id)}
                  className="hidden shrink-0 text-[10px] text-zinc-400 hover:text-zinc-700 group-hover/event:inline dark:hover:text-zinc-100"
                  title="复制行：只复制本地字段值，不复制页面正文"
                >
                  复制
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteRow(row.id)}
                  className="hidden shrink-0 text-[10px] text-zinc-400 hover:text-red-500 group-hover/event:inline"
                  title="删除行"
                >
                  删除
                </button>
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function getCalendarRowDateValue(
  row: DatabaseRow & { page: Page },
  dateField: DatabaseField
) {
  if (isDatabaseSystemField(dateField)) {
    return getDatabaseSystemFieldDateKey(row, dateField);
  }
  const fieldValues: Record<string, unknown> =
    typeof row.field_values === "string"
      ? JSON.parse(row.field_values || "{}")
      : row.field_values || {};
  return String(fieldValues[dateField.id] ?? "");
}
