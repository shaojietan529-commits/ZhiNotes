"use client";

import type { DatabaseField, DatabaseRow, Page } from "@/lib/utils/types";
import { formatRelativeDate } from "@/lib/utils/dates";
import { getDatabaseFieldDisplayName } from "@/lib/database/display";
import { getFieldOptions } from "@/lib/database/fields";
import { evaluateDatabaseFormula } from "@/lib/database/formula";
import { stringifyMultiSelectValue } from "@/lib/database/multiSelectValues";
import { formatDatabaseNumberValue } from "@/lib/database/numberValues";
import { getRelationPages } from "@/lib/database/relationValues";
import {
  getDatabaseSystemFieldValue,
  isDatabaseSystemField,
  isDatabaseSystemTimeField,
} from "@/lib/database/systemFields";

interface FeedViewProps {
  fields: DatabaseField[];
  rows: (DatabaseRow & { page: Page })[];
  onAddRow: () => void;
  onUpdateRow: (rowId: string, fieldValues: Record<string, unknown>) => void;
  onDeleteRow: (rowId: string) => void;
  onOpenRow: (pageId: string) => void;
  onOpenPage: (pageId: string) => void;
  relationPages: Page[];
}

export default function FeedView({
  fields,
  rows,
  onAddRow,
  onUpdateRow,
  onDeleteRow,
  onOpenRow,
  onOpenPage,
  relationPages,
}: FeedViewProps) {
  const sortedRows = [...rows].sort((left, right) =>
    String(right.page?.updated_at || right.updated_at).localeCompare(
      String(left.page?.updated_at || left.updated_at)
    )
  );

  return (
    <div>
      {sortedRows.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-400">还没有行。</p>
      ) : (
        <div className="space-y-3">
          {sortedRows.map((row) => (
            <FeedCard
              key={row.id}
              row={row}
              fields={fields}
              relationPages={relationPages}
              onOpenRow={onOpenRow}
              onOpenPage={onOpenPage}
              onDeleteRow={onDeleteRow}
              onUpdateRow={onUpdateRow}
            />
          ))}
        </div>
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

function FeedCard({
  row,
  fields,
  relationPages,
  onOpenRow,
  onOpenPage,
  onDeleteRow,
  onUpdateRow,
}: {
  row: DatabaseRow & { page: Page };
  fields: DatabaseField[];
  relationPages: Page[];
  onOpenRow: (pageId: string) => void;
  onOpenPage: (pageId: string) => void;
  onDeleteRow: (rowId: string) => void;
  onUpdateRow: (rowId: string, fieldValues: Record<string, unknown>) => void;
}) {
  const fieldValues = parseRowFieldValues(row.field_values);
  const feedFields = getFeedFields(fields, row, fieldValues);

  const handleFieldChange = (fieldId: string, value: unknown) => {
    const field = fields.find((item) => item.id === fieldId);
    if (field && (isDatabaseSystemField(field) || field.field_type === "formula")) {
      return;
    }
    onUpdateRow(row.id, { ...fieldValues, [fieldId]: value });
  };

  return (
    <article className="group rounded-md border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => onOpenRow(row.page_id)}
          className="min-w-0 flex-1 text-left"
        >
          <h3 className="truncate text-sm font-semibold text-zinc-900 hover:text-blue-600 dark:text-zinc-100 dark:hover:text-blue-400">
            {row.page?.icon ? `${row.page.icon} ` : ""}
            {row.page?.title || "未命名页面"}
          </h3>
          <p className="mt-1 text-xs text-zinc-400">
            更新于 {formatRelativeDate(row.page?.updated_at || row.updated_at)}
          </p>
        </button>
        <button
          type="button"
          onClick={() => onDeleteRow(row.id)}
          className="text-xs text-zinc-400 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
          title="删除行"
        >
          删除
        </button>
      </div>

      {feedFields.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {feedFields.map((field) => (
            <FeedFieldChip
              key={field.id}
              field={field}
              fields={fields}
              row={row}
              fieldValues={fieldValues}
              value={
                isDatabaseSystemField(field)
                  ? getDatabaseSystemFieldValue(row, field)
                  : fieldValues[field.id]
              }
              relationPages={relationPages}
              onOpenPage={onOpenPage}
              onChange={(value) => handleFieldChange(field.id, value)}
            />
          ))}
        </div>
      )}

      {row.page?.content_text && (
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
          {stripHtml(row.page.content_text)}
        </p>
      )}
    </article>
  );
}

function FeedFieldChip({
  field,
  fields,
  row,
  fieldValues,
  value,
  relationPages,
  onOpenPage,
  onChange,
}: {
  field: DatabaseField;
  fields: DatabaseField[];
  row: DatabaseRow & { page: Page };
  fieldValues: Record<string, unknown>;
  value: unknown;
  relationPages: Page[];
  onOpenPage: (pageId: string) => void;
  onChange: (value: unknown) => void;
}) {
  const label = getDatabaseFieldDisplayName(field);

  if (field.field_type === "formula") {
    const result = evaluateDatabaseFormula(field, fields, row, fieldValues);
    if (!result.label) return null;
    return (
      <span
        className="max-w-full truncate rounded-md bg-sky-50 px-2 py-1 text-xs text-sky-700 dark:bg-sky-950 dark:text-sky-200"
        title={result.detail}
      >
        {label}: {result.label}
      </span>
    );
  }

  if (field.field_type === "relation") {
    const related = getRelationPages(value, relationPages).slice(0, 4);
    if (related.length === 0) return null;
    return (
      <span className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs text-blue-700 dark:bg-blue-950 dark:text-blue-200">
        <span className="text-blue-400">{label}</span>
        {related.map(({ id, page }) => (
          <button
            key={id}
            type="button"
            onClick={() => onOpenPage(id)}
            className="max-w-[10rem] truncate rounded bg-white px-1.5 py-0.5 text-blue-700 hover:bg-blue-100 dark:bg-blue-900 dark:text-blue-100 dark:hover:bg-blue-800"
          >
            {page?.title || id}
          </button>
        ))}
      </span>
    );
  }

  if (field.field_type === "checkbox") {
    const checked = Boolean(value);
    return (
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`rounded-md px-2 py-1 text-xs ${
          checked
            ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-200"
            : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300"
        }`}
      >
        {label}: {checked ? "是" : "否"}
      </button>
    );
  }

  const displayValue = formatFeedFieldValue(field, value);
  if (!displayValue) return null;

  if (
    field.field_type === "url" ||
    field.field_type === "email" ||
    field.field_type === "phone"
  ) {
    const href =
      field.field_type === "email"
        ? `mailto:${String(value)}`
        : field.field_type === "phone"
          ? `tel:${String(value)}`
          : String(value);
    return (
      <a
        href={href}
        target={field.field_type === "url" ? "_blank" : undefined}
        rel={field.field_type === "url" ? "noopener noreferrer" : undefined}
        className="max-w-full truncate rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
      >
        {label}: {displayValue}
      </a>
    );
  }

  const toneClass =
    field.field_type === "status"
      ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-200"
      : field.field_type === "select"
        ? "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-200"
        : field.field_type === "multi_select"
          ? "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-200"
          : field.field_type === "date" || isDatabaseSystemTimeField(field)
            ? "bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-200"
            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-200";

  return (
    <span className={`max-w-full truncate rounded-md px-2 py-1 text-xs ${toneClass}`}>
      {label}: {displayValue}
    </span>
  );
}

function getFeedFields(
  fields: DatabaseField[],
  row: DatabaseRow & { page: Page },
  fieldValues: Record<string, unknown>
) {
  return fields
    .slice(1)
    .filter((field) => hasDisplayValue(field, fields, row, fieldValues))
    .sort(compareFeedFields)
    .slice(0, 6);
}

function hasDisplayValue(
  field: DatabaseField,
  fields: DatabaseField[],
  row: DatabaseRow & { page: Page },
  fieldValues: Record<string, unknown>
) {
  if (isDatabaseSystemField(field)) {
    return Boolean(getDatabaseSystemFieldValue(row, field));
  }
  if (field.field_type === "formula") {
    return Boolean(evaluateDatabaseFormula(field, fields, row, fieldValues).label);
  }
  if (!(field.id in fieldValues)) return false;
  const value = fieldValues[field.id];
  if (field.field_type === "checkbox") return true;
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined && String(value).trim().length > 0;
}

function compareFeedFields(left: DatabaseField, right: DatabaseField) {
  const priority: Record<string, number> = {
    status: 0,
    select: 1,
    multi_select: 2,
    date: 3,
    created_time: 4,
    last_edited_time: 5,
    unique_id: 6,
    relation: 7,
    checkbox: 8,
    number: 9,
    formula: 10,
    url: 11,
    email: 12,
    phone: 13,
    text: 14,
  };
  return (
    (priority[left.field_type] ?? 10) - (priority[right.field_type] ?? 10) ||
    left.position - right.position
  );
}

function formatFeedFieldValue(field: DatabaseField, value: unknown) {
  if (value === null || value === undefined) return "";
  if (field.field_type === "select" || field.field_type === "status") {
    const options = getFieldOptions(field);
    const selected = String(value);
    return options.includes(selected) || selected ? selected : "";
  }
  if (field.field_type === "multi_select") {
    return stringifyMultiSelectValue(value);
  }
  if (isDatabaseSystemField(field)) {
    return isDatabaseSystemTimeField(field)
      ? formatRelativeDate(String(value))
      : String(value);
  }
  if (field.field_type === "number") {
    return formatDatabaseNumberValue(value, field);
  }
  if (field.field_type === "url") {
    return formatUrlLabel(String(value));
  }
  return String(value);
}

function parseRowFieldValues(value: string) {
  try {
    const parsed = JSON.parse(value || "{}") as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function formatUrlLabel(value: string) {
  try {
    return new URL(value).hostname || value;
  } catch {
    return value;
  }
}

function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
