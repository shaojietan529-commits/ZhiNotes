"use client";

import { useMemo } from "react";
import type { DatabaseField, DatabaseRow, Page } from "@/lib/utils/types";
import { formatRelativeDate } from "@/lib/utils/dates";
import { getDatabaseFieldDisplayName } from "@/lib/database/display";
import { formatDatabaseNumberValue } from "@/lib/database/numberValues";
import { stringifyRelationValue } from "@/lib/database/relationValues";
import {
  getDatabaseSystemFieldDateKey,
  getDatabaseSystemFieldValue,
  isDatabaseSystemField,
  isDatabaseSystemTimeField,
} from "@/lib/database/systemFields";

interface TimelineViewProps {
  fields: DatabaseField[];
  rows: (DatabaseRow & { page: Page })[];
  onAddRow: () => void;
  onUpdateRow: (rowId: string, fieldValues: Record<string, unknown>) => void;
  onDeleteRow: (rowId: string) => void;
  onOpenRow: (pageId: string) => void;
  relationPages: Page[];
}

interface TimelineRow {
  row: DatabaseRow & { page: Page };
  dateValue: string;
  label: string;
}

export default function TimelineView({
  fields,
  rows,
  onAddRow,
  onDeleteRow,
  onOpenRow,
  relationPages,
}: TimelineViewProps) {
  const dateField =
    fields.find((field) => field.field_type === "date") ||
    fields.find(isDatabaseSystemTimeField);

  const timelineRows = useMemo(() => {
    if (!dateField) return [];

    return rows
      .map((row): TimelineRow => {
        const values = parseFieldValues(row.field_values);
        const dateValue = isDatabaseSystemField(dateField)
          ? getDatabaseSystemFieldDateKey(row, dateField)
          : String(values[dateField.id] ?? "");
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

  return (
    <div>
      {timelineRows.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-400">还没有行。</p>
      ) : (
        <ol className="relative space-y-3 border-l border-zinc-200 pl-4 dark:border-zinc-700">
          {timelineRows.map(({ row, label, dateValue }) => {
            const fieldValues = parseFieldValues(row.field_values);
            const extraFields = getTimelineDisplayFields(
              fields,
              dateField,
              row,
              fieldValues
            );

            return (
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
                  {extraFields.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {extraFields.map((field) => {
                        const value = isDatabaseSystemField(field)
                          ? getDatabaseSystemFieldValue(row, field)
                          : fieldValues[field.id];
                        const labelText = formatTimelineFieldValue(
                          field,
                          value,
                          relationPages
                        );
                        if (!labelText) return null;

                        return (
                          <span
                            key={field.id}
                            className="max-w-full truncate rounded bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300"
                            title={`${getDatabaseFieldDisplayName(field)}: ${labelText}`}
                          >
                            <span className="text-zinc-400">
                              {getDatabaseFieldDisplayName(field)}:
                            </span>{" "}
                            {labelText}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </article>
              </li>
            );
          })}
        </ol>
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

function getTimelineDisplayFields(
  fields: DatabaseField[],
  dateField: DatabaseField,
  row: DatabaseRow & { page: Page },
  fieldValues: Record<string, unknown>
) {
  return fields
    .filter((field) => {
      if (field.id === dateField.id) return false;
      if (field.position === 0 && field.name === "Name") return false;
      const value = isDatabaseSystemField(field)
        ? getDatabaseSystemFieldValue(row, field)
        : fieldValues[field.id];
      return value !== undefined && value !== null && value !== "";
    })
    .slice(0, 4);
}

function formatTimelineFieldValue(
  field: DatabaseField,
  value: unknown,
  relationPages: Page[]
) {
  if (field.field_type === "relation") {
    return stringifyRelationValue(value, relationPages);
  }

  if (field.field_type === "checkbox") {
    return value ? "是" : "否";
  }

  if (field.field_type === "number") {
    return formatDatabaseNumberValue(value, field);
  }

  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean).join(", ");
  }

  if (isDatabaseSystemField(field)) {
    if (!value) return "";
    return isDatabaseSystemTimeField(field)
      ? formatRelativeDate(String(value))
      : String(value);
  }

  return String(value ?? "").trim();
}

function parseFieldValues(fieldValues: string) {
  try {
    return JSON.parse(fieldValues || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}
