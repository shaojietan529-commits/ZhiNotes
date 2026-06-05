"use client";

import { useState } from "react";
import type { DatabaseField, DatabaseRow } from "@/lib/utils/types";
import type { Page } from "@/lib/utils/types";
import { formatRelativeDate } from "@/lib/utils/dates";
import RelationFieldEditor from "@/components/database/RelationFieldEditor";
import { getDatabaseFieldDisplayName } from "@/lib/database/display";
import { getFieldOptions } from "@/lib/database/fields";
import {
  normalizeMultiSelectValue,
  toggleMultiSelectValue,
} from "@/lib/database/multiSelectValues";
import { formatDatabaseNumberValue } from "@/lib/database/numberValues";
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
  onOpenRow: (pageId: string) => void;
  onOpenPage: (pageId: string) => void;
  relationPages: Page[];
  focusPageId?: string;
  focusPage?: Page | null;
}

export default function TableView({
  fields,
  rows,
  onAddRow,
  onUpdateRow,
  onDeleteRow,
  onOpenRow,
  onOpenPage,
  relationPages,
  focusPageId,
  focusPage,
}: TableViewProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-700">
            <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 w-8">
              #
            </th>
            {fields.map((field) => (
              <th
                key={field.id}
                className="text-left px-3 py-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 min-w-[140px]"
              >
                {getDatabaseFieldDisplayName(field)}
              </th>
            ))}
            <th className="text-left px-3 py-2 text-xs font-medium text-zinc-400 w-20">
              创建
            </th>
            <th className="w-8" />
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
              onOpen={() => onOpenRow(row.page_id)}
              onOpenPage={onOpenPage}
              relationPages={relationPages}
              focusPage={focusPage}
              focused={row.page_id === focusPageId}
            />
          ))}
        </tbody>
      </table>

      {/* Add row button */}
      <button
        onClick={onAddRow}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 border-t border-zinc-200 dark:border-zinc-700 transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12h14" />
        </svg>
        新建行
      </button>
    </div>
  );
}

function TableRow({
  row,
  index,
  fields,
  onUpdate,
  onDelete,
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
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 text-xs transition-opacity"
          title="删除行"
        >
          x
        </button>
      </td>
    </tr>
  );
}

function CellEditor({
  field,
  row,
  value,
  onChange,
  onOpenPage,
  relationPages,
  focusPage,
}: {
  field: DatabaseField;
  row: DatabaseRow & { page: Page };
  value: unknown;
  onChange: (value: unknown) => void;
  onOpenPage: (pageId: string) => void;
  relationPages: Page[];
  focusPage?: Page | null;
}) {
  const [editing, setEditing] = useState(false);

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
