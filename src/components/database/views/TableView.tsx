"use client";

import { useState } from "react";
import type { DatabaseField, DatabaseRow } from "@/lib/utils/types";
import type { Page } from "@/lib/utils/types";
import { formatRelativeDate } from "@/lib/utils/dates";
import RelationFieldEditor from "@/components/database/RelationFieldEditor";
import { getDatabaseFieldDisplayName } from "@/lib/database/display";
import {
  getDatabaseFieldDescription,
  getFieldOptions,
} from "@/lib/database/fields";
import { evaluateDatabaseFormula } from "@/lib/database/formula";
import { evaluateDatabaseRollup } from "@/lib/database/rollup";
import {
  normalizeMultiSelectValue,
  toggleMultiSelectValue,
} from "@/lib/database/multiSelectValues";
import { formatDatabaseNumberValue } from "@/lib/database/numberValues";
import { stringifyRelationValue } from "@/lib/database/relationValues";
import {
  getDatabaseSystemFieldValue,
  isDatabaseSystemField,
  isDatabaseSystemTimeField,
} from "@/lib/database/systemFields";

interface TableViewProps {
  fields: DatabaseField[];
  rows: (DatabaseRow & { page: Page })[];
  onAddRow: () => void;
  onUpdateRow: (rowId: string, fieldValues: Record<string, unknown>) => void;
  onDeleteRow: (rowId: string) => void;
  onDuplicateRow: (rowId: string) => void;
  onMoveRow: (rowId: string, direction: "up" | "down") => void;
  onOpenRow: (pageId: string) => void;
  onOpenPage: (pageId: string) => void;
  relationPages: Page[];
  focusPageId?: string;
  focusPage?: Page | null;
  showAddRow?: boolean;
  canMoveRows?: boolean;
}

interface TableColumnSummary {
  primary: string;
  detail: string;
  title: string;
}

export default function TableView({
  fields,
  rows,
  onAddRow,
  onUpdateRow,
  onDeleteRow,
  onDuplicateRow,
  onMoveRow,
  onOpenRow,
  onOpenPage,
  relationPages,
  focusPageId,
  focusPage,
  showAddRow = true,
  canMoveRows = true,
}: TableViewProps) {
  const columnSummaries = fields.map((field) =>
    buildTableColumnSummary(field, rows, fields, relationPages)
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-700">
            <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 w-8">
              #
            </th>
            {fields.map((field) => {
              const fieldDescription = getDatabaseFieldDescription(field);
              const fieldName = getDatabaseFieldDisplayName(field);
              return (
                <th
                  key={field.id}
                  title={fieldDescription || fieldName}
                  className="text-left px-3 py-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 min-w-[140px]"
                >
                  <span className="inline-flex max-w-[16rem] items-center gap-1 align-middle">
                    <span className="truncate">{fieldName}</span>
                    {fieldDescription && (
                      <span
                        aria-label="字段说明"
                        className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-[9px] font-semibold text-zinc-400 dark:border-zinc-600"
                      >
                        i
                      </span>
                    )}
                  </span>
                </th>
              );
            })}
            <th className="text-left px-3 py-2 text-xs font-medium text-zinc-400 w-20">
              创建
            </th>
            <th className="w-32" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <TableRow
              key={row.id}
              row={row}
              index={index + 1}
              fields={fields}
              onUpdate={(fieldValues) => onUpdateRow(row.id, fieldValues)}
              onDelete={() => onDeleteRow(row.id)}
              onDuplicate={() => onDuplicateRow(row.id)}
              onMoveUp={() => onMoveRow(row.id, "up")}
              onMoveDown={() => onMoveRow(row.id, "down")}
              canMoveUp={canMoveRows && index > 0}
              canMoveDown={canMoveRows && index < rows.length - 1}
              onOpen={() => onOpenRow(row.page_id)}
              onOpenPage={onOpenPage}
              relationPages={relationPages}
              focusPage={focusPage}
              focused={row.page_id === focusPageId}
            />
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-zinc-200 bg-zinc-50/80 text-[11px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-400">
            <td className="px-3 py-2 font-medium">汇总</td>
            {fields.map((field, index) => {
              const summary = columnSummaries[index];
              return (
                <td key={field.id} className="px-3 py-2" title={summary.title}>
                  <div className="flex min-w-[8rem] flex-col gap-0.5">
                    <span className="font-medium text-zinc-600 dark:text-zinc-300">
                      {summary.primary}
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      {summary.detail}
                    </span>
                  </div>
                </td>
              );
            })}
            <td className="px-3 py-2 font-medium">{rows.length} 行</td>
            <td className="px-1 py-2" />
          </tr>
        </tfoot>
      </table>

      {showAddRow && (
        <button
          onClick={onAddRow}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 border-t border-zinc-200 dark:border-zinc-700 transition-colors"
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

function TableRow({
  row,
  index,
  fields,
  onUpdate,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  onOpen,
  onOpenPage,
  relationPages,
  focusPage,
  focused,
}: {
  row: DatabaseRow & { page: Page };
  index: number;
  fields: DatabaseField[];
  onUpdate: (fieldValues: Record<string, unknown>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onOpen: () => void;
  onOpenPage: (pageId: string) => void;
  relationPages: Page[];
  focusPage?: Page | null;
  focused: boolean;
}) {
  const fieldValues: Record<string, unknown> =
    typeof row.field_values === "string"
      ? JSON.parse(row.field_values || "{}")
      : row.field_values || {};

  const handleCellChange = (fieldId: string, value: unknown) => {
    onUpdate({ ...fieldValues, [fieldId]: value });
  };

  return (
    <tr
      className={`group border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900 ${
        focused
          ? "bg-blue-50 ring-1 ring-inset ring-blue-200 dark:bg-blue-950/30 dark:ring-blue-900"
          : ""
      }`}
    >
      <td className="px-3 py-1.5 text-zinc-400 text-xs">{index}</td>
      {fields.map((field, i) => (
        <td key={field.id} className="px-3 py-1.5">
          {i === 0 ? (
            // First field (Name) — clickable to open page
            <button
              onClick={onOpen}
              className="text-left text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              {row.page?.title || "未命名页面"}
            </button>
          ) : (
            <CellEditor
              field={field}
              fields={fields}
              row={row}
              value={fieldValues[field.id]}
              relationPages={relationPages}
              focusPage={focusPage}
              onOpenPage={onOpenPage}
              onChange={(val) => handleCellChange(field.id, val)}
            />
          )}
        </td>
      ))}
      <td className="px-3 py-1.5 text-xs text-zinc-400">
        {formatRelativeDate(row.created_at)}
      </td>
      <td className="px-1 py-1.5">
        <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            className="rounded px-1 py-0.5 text-xs text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:cursor-default disabled:opacity-35 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            title="上移行：只调整本地手动排序，不改字段值"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            className="rounded px-1 py-0.5 text-xs text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:cursor-default disabled:opacity-35 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            title="下移行：只调整本地手动排序，不改字段值"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onDuplicate}
            className="rounded px-1.5 py-0.5 text-xs text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            title="复制行：只复制本地字段值，不复制页面正文"
          >
            复制
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded px-1 py-0.5 text-xs text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950"
            title="删除行"
          >
            x
          </button>
        </div>
      </td>
    </tr>
  );
}

function buildTableColumnSummary(
  field: DatabaseField,
  rows: (DatabaseRow & { page: Page })[],
  fields: DatabaseField[],
  relationPages: Page[]
): TableColumnSummary {
  if (rows.length === 0) {
    return {
      primary: "0 行",
      detail: "没有可见行",
      title: "列摘要只基于当前视图可见行本地计算。",
    };
  }

  if (field.position === 0 || field.name === "Name") {
    const namedRows = rows.filter((row) => row.page?.title?.trim()).length;
    return {
      primary: `${namedRows}/${rows.length} 有标题`,
      detail: `${rows.length - namedRows} 个空标题`,
      title: "标题摘要只读取当前可见行的本地页面标题。",
    };
  }

  if (field.field_type === "checkbox") {
    const checkedRows = rows.filter((row) =>
      Boolean(getTableSummaryRawValue(row, field, fields, relationPages))
    ).length;
    const percent = Math.round((checkedRows / rows.length) * 100);
    return {
      primary: `${checkedRows}/${rows.length} 已勾选`,
      detail: `${percent}% 完成`,
      title: "Checkbox 摘要只根据当前可见行本地计算。",
    };
  }

  if (
    field.field_type === "number" ||
    field.field_type === "formula" ||
    field.field_type === "rollup"
  ) {
    const numericValues = rows
      .map((row) =>
        toTableSummaryNumber(
          getTableSummaryRawValue(row, field, fields, relationPages)
        )
      )
      .filter((value): value is number => Number.isFinite(value));

    if (numericValues.length > 0) {
      const sum = numericValues.reduce((total, value) => total + value, 0);
      const average = sum / numericValues.length;
      return {
        primary: `Σ ${formatTableSummaryNumber(sum, field)}`,
        detail: `平均 ${formatTableSummaryNumber(average, field)} · ${
          numericValues.length
        }/${rows.length}`,
        title:
          "数字摘要只基于当前可见行本地计算，不会写入任何数据库值。",
      };
    }
  }

  const labels = rows.flatMap((row) =>
    getTableSummaryLabels(
      getTableSummaryRawValue(row, field, fields, relationPages),
      field,
      relationPages
    )
  );
  const filledRows = rows.filter(
    (row) =>
      getTableSummaryLabels(
        getTableSummaryRawValue(row, field, fields, relationPages),
        field,
        relationPages
      ).length > 0
  ).length;
  const uniqueCount = new Set(labels.map((label) => label.toLowerCase())).size;

  if (
    field.field_type === "date" ||
    field.field_type === "created_time" ||
    field.field_type === "last_edited_time"
  ) {
    return {
      primary: `${filledRows}/${rows.length} 有日期`,
      detail: `${rows.length - filledRows} 个空值`,
      title: "日期摘要只基于当前可见行本地计算。",
    };
  }

  return {
    primary: `${uniqueCount} 个唯一`,
    detail: `${filledRows}/${rows.length} 有值`,
    title: "列摘要只基于当前视图可见行本地计算。",
  };
}

function getTableSummaryRawValue(
  row: DatabaseRow & { page: Page },
  field: DatabaseField,
  fields: DatabaseField[],
  relationPages: Page[]
) {
  if (isDatabaseSystemField(field)) {
    return getDatabaseSystemFieldValue(row, field);
  }

  const fieldValues = parseFieldValues(row.field_values);
  if (field.field_type === "formula") {
    return evaluateDatabaseFormula(field, fields, row, fieldValues).value;
  }
  if (field.field_type === "rollup") {
    return evaluateDatabaseRollup(
      field,
      fields,
      fieldValues,
      relationPages
    ).value;
  }
  return fieldValues[field.id];
}

function getTableSummaryLabels(
  value: unknown,
  field: DatabaseField,
  relationPages: Page[]
) {
  if (value === null || value === undefined || value === "") return [];

  if (field.field_type === "multi_select") {
    return normalizeMultiSelectValue(value);
  }

  if (field.field_type === "relation") {
    return splitTableSummaryLabels(stringifyRelationValue(value, relationPages));
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => splitTableSummaryLabels(String(item)));
  }

  if (typeof value === "boolean") {
    return [value ? "是" : "否"];
  }

  return splitTableSummaryLabels(String(value));
}

function splitTableSummaryLabels(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toTableSummaryNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return Number(value);
  return Number.NaN;
}

function formatTableSummaryNumber(value: number, field: DatabaseField) {
  return formatDatabaseNumberValue(value, field) || String(value);
}

function CellEditor({
  field,
  fields,
  row,
  value,
  onChange,
  onOpenPage,
  relationPages,
  focusPage,
}: {
  field: DatabaseField;
  fields: DatabaseField[];
  row: DatabaseRow & { page: Page };
  value: unknown;
  onChange: (value: unknown) => void;
  onOpenPage: (pageId: string) => void;
  relationPages: Page[];
  focusPage?: Page | null;
}) {
  const [editing, setEditing] = useState(false);

  if (field.field_type === "formula") {
    const fieldValues = parseFieldValues(row.field_values);
    const result = evaluateDatabaseFormula(field, fields, row, fieldValues);
    return (
      <span
        className={`text-sm ${
          result.status === "ready"
            ? "font-medium text-zinc-700 dark:text-zinc-300"
            : "text-amber-600 dark:text-amber-300"
        }`}
        title={result.detail}
      >
        {result.label}
      </span>
    );
  }

  if (field.field_type === "rollup") {
    const fieldValues = parseFieldValues(row.field_values);
    const result = evaluateDatabaseRollup(
      field,
      fields,
      fieldValues,
      relationPages
    );
    return (
      <span
        className={`text-sm ${
          result.status === "ready" || result.status === "empty"
            ? "font-medium text-zinc-700 dark:text-zinc-300"
            : "text-amber-600 dark:text-amber-300"
        }`}
        title={result.detail}
      >
        {result.label}
      </span>
    );
  }

  if (isDatabaseSystemField(field)) {
    const systemValue = getDatabaseSystemFieldValue(row, field);
    return (
      <span
        className="text-sm text-zinc-500 dark:text-zinc-400"
        title={systemValue || undefined}
      >
        {systemValue
          ? isDatabaseSystemTimeField(field)
            ? formatRelativeDate(systemValue)
            : systemValue
          : "—"}
      </span>
    );
  }

  if (field.field_type === "checkbox") {
    return (
      <input
        type="checkbox"
        checked={!!value}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-zinc-300"
      />
    );
  }

  if (field.field_type === "select" || field.field_type === "status") {
    const config = field.config ? JSON.parse(field.config) : {};
    const options: string[] = config.options || [];
    return (
      <select
        value={(value as string) || ""}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm bg-transparent border-none outline-none text-zinc-700 dark:text-zinc-300 w-full"
      >
        <option value="">—</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  if (field.field_type === "multi_select") {
    const options: string[] = getFieldOptions(field);
    const selected = normalizeMultiSelectValue(value);
    return (
      <div className="flex max-w-[18rem] flex-wrap gap-1">
        {options.length === 0 && <span className="text-sm text-zinc-400">—</span>}
        {options.map((option) => {
          const active = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(toggleMultiSelectValue(value, option))}
              className={`rounded px-1.5 py-0.5 text-xs ${
                active
                  ? "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-200"
                  : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    );
  }

  if (field.field_type === "date") {
    return (
      <input
        type="date"
        value={(value as string) || ""}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm bg-transparent border-none outline-none text-zinc-700 dark:text-zinc-300"
      />
    );
  }

  if (field.field_type === "number") {
    if (editing) {
      return (
        <input
          type="number"
          value={(value as number) ?? ""}
          onChange={(e) =>
            onChange(e.target.value ? Number(e.target.value) : null)
          }
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => e.key === "Enter" && setEditing(false)}
          autoFocus
          className="text-sm bg-transparent border-none outline-none text-zinc-700 dark:text-zinc-300 w-full"
          placeholder="—"
        />
      );
    }
    const formattedNumber = formatDatabaseNumberValue(value, field);
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-left text-sm text-zinc-700 dark:text-zinc-300"
      >
        {formattedNumber || <span className="text-zinc-400">—</span>}
      </button>
    );
  }

  if (
    field.field_type === "url" ||
    field.field_type === "email" ||
    field.field_type === "phone"
  ) {
    const inputType =
      field.field_type === "email"
        ? "email"
        : field.field_type === "phone"
          ? "tel"
          : "url";
    const placeholder =
      field.field_type === "email"
        ? "name@example.com"
        : field.field_type === "phone"
          ? "+65..."
          : "https://...";

    if (editing) {
      return (
        <input
          type={inputType}
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setEditing(false)}
          autoFocus
          className="text-sm bg-transparent border-none outline-none text-zinc-700 dark:text-zinc-300 w-full"
          placeholder={placeholder}
        />
      );
    }
    const linkValue = value as string;
    if (linkValue) {
      const href =
        field.field_type === "email"
          ? `mailto:${linkValue}`
          : field.field_type === "phone"
            ? `tel:${linkValue}`
            : linkValue;
      return (
        <a
          href={href}
          target={field.field_type === "url" ? "_blank" : undefined}
          rel={field.field_type === "url" ? "noopener noreferrer" : undefined}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={() => setEditing(true)}
          className="text-sm text-blue-500 hover:underline truncate block max-w-[200px]"
        >
          {linkValue}
        </a>
      );
    }
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-sm text-zinc-400"
      >
        —
      </button>
    );
  }

  if (field.field_type === "relation") {
    return (
      <RelationFieldEditor
        value={value}
        pages={relationPages}
        onOpenPage={onOpenPage}
        onChange={onChange}
        preferredPage={focusPage}
      />
    );
  }

  // Default: text
  if (editing) {
    return (
      <input
        type="text"
        value={(value as string) || ""}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => e.key === "Enter" && setEditing(false)}
        autoFocus
        className="text-sm bg-transparent border-none outline-none text-zinc-700 dark:text-zinc-300 w-full"
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="text-sm text-zinc-700 dark:text-zinc-300 text-left w-full"
    >
      {(value as string) || <span className="text-zinc-400">—</span>}
    </button>
  );
}

function parseFieldValues(fieldValues: string) {
  try {
    return JSON.parse(fieldValues || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}
