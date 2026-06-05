"use client";

import { useState } from "react";
import RelationFieldEditor from "@/components/database/RelationFieldEditor";
import { getDatabaseFieldDisplayName } from "@/lib/database/display";
import type { DatabaseField, Page } from "@/lib/utils/types";

interface FormViewProps {
  fields: DatabaseField[];
  relationPages: Page[];
  onOpenPage: (pageId: string) => void;
  onCreateRow: (title: string, fieldValues: Record<string, unknown>) => void;
}

export default function FormView({
  fields,
  relationPages,
  onOpenPage,
  onCreateRow,
}: FormViewProps) {
  const [title, setTitle] = useState("");
  const [values, setValues] = useState<Record<string, unknown>>({});

  const dataFields = fields.slice(1);

  const handleSubmit = () => {
    const rowTitle = title.trim() || "未命名页面";
    onCreateRow(rowTitle, values);
    setTitle("");
    setValues({});
  };

  return (
    <div className="max-w-xl rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-500">
            {fields[0] ? getDatabaseFieldDisplayName(fields[0]) : "名称"}
          </span>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="新建行"
            className="w-full rounded border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </label>
        {dataFields.map((field) => (
          <FormField
            key={field.id}
            field={field}
            value={values[field.id]}
            relationPages={relationPages}
            onOpenPage={onOpenPage}
            onChange={(value) =>
              setValues((current) => ({ ...current, [field.id]: value }))
            }
          />
        ))}
        <button
          type="button"
          onClick={handleSubmit}
          className="rounded bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          提交
        </button>
      </div>
    </div>
  );
}

function FormField({
  field,
  value,
  onChange,
  relationPages,
  onOpenPage,
}: {
  field: DatabaseField;
  value: unknown;
  onChange: (value: unknown) => void;
  relationPages: Page[];
  onOpenPage: (pageId: string) => void;
}) {
  const label = (
    <span className="mb-1 block text-xs font-medium text-zinc-500">
      {getDatabaseFieldDisplayName(field)}
    </span>
  );

  if (field.field_type === "checkbox") {
    return (
      <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
          className="rounded border-zinc-300"
        />
        {getDatabaseFieldDisplayName(field)}
      </label>
    );
  }

  if (field.field_type === "select" || field.field_type === "status") {
    const options = getFieldOptions(field);
    return (
      <label className="block">
        {label}
        <select
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        >
          <option value="">无值</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (field.field_type === "relation") {
    return (
      <div className="block">
        {label}
        <RelationFieldEditor
          value={value}
          pages={relationPages}
          onChange={onChange}
          onOpenPage={onOpenPage}
        />
      </div>
    );
  }

  const inputType =
    field.field_type === "number"
      ? "number"
      : field.field_type === "date"
        ? "date"
        : field.field_type === "url"
          ? "url"
          : field.field_type === "email"
            ? "email"
            : field.field_type === "phone"
              ? "tel"
              : "text";

  return (
    <label className="block">
      {label}
      <input
        type={inputType}
        value={String(value ?? "")}
        onChange={(event) => {
          const nextValue =
            field.field_type === "number" && event.target.value
              ? Number(event.target.value)
              : event.target.value;
          onChange(nextValue);
        }}
        className="w-full rounded border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
      />
    </label>
  );
}

function getFieldOptions(field: DatabaseField): string[] {
  try {
    const config = field.config ? JSON.parse(field.config) : {};
    return Array.isArray(config.options)
      ? config.options.filter((option: unknown): option is string =>
          typeof option === "string"
        )
      : [];
  } catch {
    return [];
  }
}
