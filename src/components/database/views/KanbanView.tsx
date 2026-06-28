"use client";

import { useMemo } from "react";
import type { DatabaseField, DatabaseRow } from "@/lib/utils/types";
import type { Page } from "@/lib/utils/types";
import { getDatabaseFieldDisplayName } from "@/lib/database/display";
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
import { formatRelativeDate } from "@/lib/utils/dates";

interface KanbanViewProps {
  fields: DatabaseField[];
  rows: (DatabaseRow & { page: Page })[];
  onAddRow: () => void;
  onUpdateRow: (rowId: string, fieldValues: Record<string, unknown>) => void;
  onDeleteRow: (rowId: string) => void;
  onDuplicateRow: (rowId: string) => void;
  onOpenRow: (pageId: string) => void;
  onPrimeRow?: (pageId: string) => void;
  relationPages: Page[];
  groupFieldId?: string;
}

export default function KanbanView({
  fields,
  rows,
  onDeleteRow,
  onDuplicateRow,
  onOpenRow,
  onPrimeRow,
  relationPages,
  groupFieldId = "",
}: KanbanViewProps) {
  // Use the saved view grouping field when it is board-friendly, then fall back.
  const savedGroupField = fields.find(
    (field) => field.id === groupFieldId && isKanbanGroupField(field)
  );
  const groupField =
    savedGroupField ||
    fields.find((field) => field.field_type === "status") ||
    fields.find((field) => field.field_type === "select") ||
    fields.find((field) => field.field_type === "checkbox");

  const columns = useMemo(() => {
    if (!groupField) return [];
    if (groupField.field_type === "checkbox") {
      return ["false", "true"];
    }
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
      const val = groupField
        ? getKanbanGroupValue(fieldValues[groupField.id], groupField)
        : "";
      if (!groups[val]) groups[val] = [];
      groups[val].push(row);
    }
    return groups;
  }, [rows, columns, groupField]);

  if (!groupField) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-zinc-400 mb-2">
          看板视图需要一个状态、单选或复选框字段。
        </p>
        <p className="text-xs text-zinc-400">
          请先添加可分组字段，再使用看板视图。
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
              {getKanbanColumnLabel(col, groupField)}
            </span>
            <span className="text-xs text-zinc-400">
              {groupedRows[col]?.length || 0}
            </span>
          </div>

          {/* Cards */}
          <div className="p-2 space-y-2 min-h-[100px]">
            {(groupedRows[col] || []).map((row) => {
              const fieldValues = parseKanbanFieldValues(row.field_values);
              const cardFields = getKanbanCardFields(
                fields,
                groupField,
                row,
                fieldValues,
                relationPages
              );

              return (
                <div
                  key={row.id}
                  className="bg-white dark:bg-zinc-800 rounded-md border border-zinc-200 dark:border-zinc-700 p-3 hover:shadow-sm transition-shadow group"
                >
                  <button
                    type="button"
                    onPointerEnter={() => onPrimeRow?.(row.page_id)}
                    onPointerDown={() => onPrimeRow?.(row.page_id)}
                    onFocus={() => onPrimeRow?.(row.page_id)}
                    onClick={() => onOpenRow(row.page_id)}
                    className="text-sm font-medium text-zinc-900 dark:text-zinc-100 text-left w-full hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    {row.page?.title || "未命名页面"}
                  </button>
                  {cardFields.length > 0 && (
                    <dl className="mt-2 space-y-1">
                      {cardFields.map(({ field, label }) => (
                        <div key={field.id} className="flex gap-2 text-[11px]">
                          <dt className="w-16 shrink-0 truncate text-zinc-400">
                            {getDatabaseFieldDisplayName(field)}
                          </dt>
                          <dd
                            className="min-w-0 flex-1 truncate text-zinc-600 dark:text-zinc-300"
                            title={label}
                          >
                            {label}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-zinc-400">
                      {row.page?.icon || "📄"}
                    </span>
                    <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => onDuplicateRow(row.id)}
                        className="text-[10px] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                        title="复制行：只复制本地字段值，不复制页面正文"
                      >
                        复制
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteRow(row.id)}
                        className="text-[10px] text-zinc-400 hover:text-red-500"
                        title="删除行"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function isKanbanGroupField(field: DatabaseField) {
  return (
    field.field_type === "status" ||
    field.field_type === "select" ||
    field.field_type === "checkbox"
  );
}

function getKanbanGroupValue(value: unknown, field: DatabaseField) {
  if (field.field_type === "checkbox") {
    return value ? "true" : "false";
  }
  return typeof value === "string" ? value : "";
}

function getKanbanColumnLabel(value: string, field: DatabaseField) {
  if (field.field_type === "checkbox") {
    return value === "true" ? "已勾选" : "未勾选";
  }
  return value || "无状态";
}

function getKanbanCardFields(
  fields: DatabaseField[],
  groupField: DatabaseField,
  row: DatabaseRow & { page: Page },
  fieldValues: Record<string, unknown>,
  relationPages: Page[]
) {
  return fields
    .filter((field) => {
      if (field.id === groupField.id) return false;
      if (field.position === 0 || field.name === "Name") return false;
      return Boolean(
        formatKanbanFieldValue(field, fields, row, fieldValues, relationPages)
      );
    })
    .slice(0, 3)
    .map((field) => ({
      field,
      label: formatKanbanFieldValue(
        field,
        fields,
        row,
        fieldValues,
        relationPages
      ),
    }))
    .filter((item): item is { field: DatabaseField; label: string } =>
      Boolean(item.label)
    );
}

function formatKanbanFieldValue(
  field: DatabaseField,
  fields: DatabaseField[],
  row: DatabaseRow & { page: Page },
  fieldValues: Record<string, unknown>,
  relationPages: Page[]
) {
  if (field.field_type === "formula") {
    return evaluateDatabaseFormula(field, fields, row, fieldValues).label;
  }
  if (field.field_type === "rollup") {
    return evaluateDatabaseRollup(field, fields, fieldValues, relationPages).label;
  }

  const value = isDatabaseSystemField(field)
    ? getDatabaseSystemFieldValue(row, field)
    : fieldValues[field.id];

  if (value === undefined || value === null || value === "") return "";
  if (field.field_type === "relation") {
    return stringifyRelationValue(value, relationPages);
  }
  if (field.field_type === "multi_select") {
    return stringifyMultiSelectValue(value);
  }
  if (field.field_type === "number") {
    return formatDatabaseNumberValue(value, field);
  }
  if (field.field_type === "checkbox") {
    return value ? "是" : "否";
  }
  if (isDatabaseSystemTimeField(field)) {
    return formatRelativeDate(String(value));
  }
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean).join(", ");
  }
  return String(value);
}

function parseKanbanFieldValues(fieldValues: string) {
  try {
    return JSON.parse(fieldValues || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}
