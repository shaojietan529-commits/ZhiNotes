"use client";

import { useState, useMemo } from "react";
import type { DatabaseField, DatabaseRow } from "@/lib/utils/types";
import type { Page } from "@/lib/utils/types";
import {
  getDatabaseSystemFieldDateKey,
  isDatabaseSystemField,
} from "@/lib/database/systemFields";

interface CalendarViewProps {
  fields: DatabaseField[];
  rows: (DatabaseRow & { page: Page })[];
  onAddRow: () => void;
  onUpdateRow: (rowId: string, fieldValues: Record<string, unknown>) => void;
  onDeleteRow: (rowId: string) => void;
  onOpenRow: (pageId: string) => void;
}

export default function CalendarView({
  fields,
  rows,
  onOpenRow,
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const dateField =
    fields.find((field) => field.field_type === "date") ||
    fields.find(isDatabaseSystemField);

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
      const fieldValues: Record<string, unknown> =
        typeof row.field_values === "string"
          ? JSON.parse(row.field_values || "{}")
          : row.field_values || {};
      const dateVal = isDatabaseSystemField(dateField)
        ? getDatabaseSystemFieldDateKey(row, dateField)
        : (fieldValues[dateField.id] as string);
      if (dateVal) {
        if (!map[dateVal]) map[dateVal] = [];
        map[dateVal].push(row);
      }
    }
    return map;
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
                    <button
                      key={row.id}
                      onClick={() => onOpenRow(row.page_id)}
                      className="w-full text-left text-[10px] px-1 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900 truncate mb-0.5"
                    >
                      {row.page?.title || "未命名页面"}
                    </button>
                  ))}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
