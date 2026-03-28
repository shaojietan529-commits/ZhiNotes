"use client";

import { useState } from "react";
import type { DatabaseField, DatabaseRow } from "@/lib/utils/types";
import type { Page } from "@/lib/utils/types";
import { formatRelativeDate } from "@/lib/utils/dates";

interface TableViewProps {
  fields: DatabaseField[];
  rows: (DatabaseRow & { page: Page })[];
  onAddRow: () => void;
  onUpdateRow: (rowId: string, fieldValues: Record<string, unknown>) => void;
  onDeleteRow: (rowId: string) => void;
  onOpenRow: (pageId: string) => void;
}

export default function TableView({
  fields,
  rows,
  onAddRow,
  onUpdateRow,
  onDeleteRow,
  onOpenRow,
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
                {field.name}
              </th>
            ))}
            <th className="text-left px-3 py-2 text-xs font-medium text-zinc-400 w-20">
              Created
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
        New row
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
}: {
  row: DatabaseRow & { page: Page };
  index: number;
  fields: DatabaseField[];
  onUpdate: (fieldValues: Record<string, unknown>) => void;
  onDelete: () => void;
  onOpen: () => void;
}) {
  const fieldValues: Record<string, unknown> =
    typeof row.field_values === "string"
      ? JSON.parse(row.field_values || "{}")
      : row.field_values || {};

  const handleCellChange = (fieldId: string, value: unknown) => {
    onUpdate({ ...fieldValues, [fieldId]: value });
  };

  return (
    <tr className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 group">
      <td className="px-3 py-1.5 text-zinc-400 text-xs">{index}</td>
      {fields.map((field, i) => (
        <td key={field.id} className="px-3 py-1.5">
          {i === 0 ? (
            // First field (Name) — clickable to open page
            <button
              onClick={onOpen}
              className="text-left text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              {row.page?.title || "Untitled"}
            </button>
          ) : (
            <CellEditor
              field={field}
              value={fieldValues[field.id]}
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
          title="Delete row"
        >
          x
        </button>
      </td>
    </tr>
  );
}

function CellEditor({
  field,
  value,
  onChange,
}: {
  field: DatabaseField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const [editing, setEditing] = useState(false);

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

  if (field.field_type === "select") {
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
    return (
      <input
        type="number"
        value={(value as number) ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        className="text-sm bg-transparent border-none outline-none text-zinc-700 dark:text-zinc-300 w-full"
        placeholder="—"
      />
    );
  }

  if (field.field_type === "url") {
    if (editing) {
      return (
        <input
          type="url"
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setEditing(false)}
          autoFocus
          className="text-sm bg-transparent border-none outline-none text-zinc-700 dark:text-zinc-300 w-full"
          placeholder="https://..."
        />
      );
    }
    const url = value as string;
    if (url) {
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={() => setEditing(true)}
          className="text-sm text-blue-500 hover:underline truncate block max-w-[200px]"
        >
          {url}
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
