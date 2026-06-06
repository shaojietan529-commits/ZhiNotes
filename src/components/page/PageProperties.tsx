"use client";

import { useEffect, useRef, useState } from "react";
import {
  PAGE_PROPERTY_TYPES,
  createPageProperty,
  getPagePropertyTypeIcon,
  removePageProperty,
  updatePageProperty,
  type PageProperty,
  type PagePropertyType,
} from "@/lib/pages/pageProperties";

interface PagePropertiesProps {
  properties: PageProperty[];
  disabled?: boolean;
  onChange: (next: PageProperty[]) => void;
}

// Notion-style properties block shown directly under the page title.
export default function PageProperties({
  properties,
  disabled = false,
  onChange,
}: PagePropertiesProps) {
  const [showAdd, setShowAdd] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showAdd) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        addRef.current?.contains(event.target)
      ) {
        return;
      }
      setShowAdd(false);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [showAdd]);

  const handleAdd = (type: PagePropertyType) => {
    onChange([...properties, createPageProperty(type)]);
    setShowAdd(false);
  };

  if (properties.length === 0 && disabled) return null;

  return (
    <div className="mb-6">
      <div className="flex flex-col">
        {properties.map((property) => (
          <PropertyRow
            key={property.id}
            property={property}
            disabled={disabled}
            onChange={(patch) =>
              onChange(updatePageProperty(properties, property.id, patch))
            }
            onRemove={() => onChange(removePageProperty(properties, property.id))}
          />
        ))}
      </div>

      {!disabled && (
        <div ref={addRef} className="relative mt-1">
          <button
            type="button"
            onClick={() => setShowAdd((value) => !value)}
            className="flex items-center gap-1.5 rounded px-1.5 py-1 text-sm text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <span className="text-base leading-none">+</span> 添加属性
          </button>
          {showAdd && (
            <div className="absolute left-0 top-9 z-30 w-44 overflow-hidden rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              {PAGE_PROPERTY_TYPES.map((entry) => (
                <button
                  key={entry.value}
                  type="button"
                  onClick={() => handleAdd(entry.value)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                >
                  <span className="w-4 text-center text-zinc-400">
                    {entry.icon}
                  </span>
                  {entry.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PropertyRow({
  property,
  disabled,
  onChange,
  onRemove,
}: {
  property: PageProperty;
  disabled: boolean;
  onChange: (patch: Partial<Omit<PageProperty, "id">>) => void;
  onRemove: () => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(property.name);

  useEffect(() => {
    queueMicrotask(() => setNameDraft(property.name));
  }, [property.name]);

  const commitName = () => {
    setEditingName(false);
    const next = nameDraft.trim();
    if (next && next !== property.name) onChange({ name: next });
    else setNameDraft(property.name);
  };

  return (
    <div className="group flex items-start gap-2 py-1">
      {/* Label cell */}
      <div className="flex w-40 shrink-0 items-center gap-1.5 pt-1.5 text-sm text-zinc-400">
        <span className="w-4 shrink-0 text-center text-xs">
          {getPagePropertyTypeIcon(property.type)}
        </span>
        {editingName && !disabled ? (
          <input
            autoFocus
            value={nameDraft}
            onChange={(event) => setNameDraft(event.target.value)}
            onBlur={commitName}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitName();
              if (event.key === "Escape") {
                setNameDraft(property.name);
                setEditingName(false);
              }
            }}
            className="min-w-0 flex-1 rounded bg-zinc-100 px-1 py-0.5 text-sm text-zinc-700 outline-none dark:bg-zinc-800 dark:text-zinc-200"
          />
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setEditingName(true)}
            className="min-w-0 flex-1 truncate rounded px-1 py-0.5 text-left transition-colors hover:bg-zinc-100 disabled:cursor-default disabled:hover:bg-transparent dark:hover:bg-zinc-800"
            title={property.name}
          >
            {property.name}
          </button>
        )}
      </div>

      {/* Value cell */}
      <div className="min-w-0 flex-1">
        <PropertyValueEditor
          property={property}
          disabled={disabled}
          onChange={onChange}
        />
      </div>

      {/* Remove */}
      {!disabled && (
        <button
          type="button"
          onClick={onRemove}
          className="mt-1 shrink-0 px-1 text-xs text-zinc-300 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
          title="删除属性"
        >
          ✕
        </button>
      )}
    </div>
  );
}

function PropertyValueEditor({
  property,
  disabled,
  onChange,
}: {
  property: PageProperty;
  disabled: boolean;
  onChange: (patch: Partial<Omit<PageProperty, "id">>) => void;
}) {
  const inputClass =
    "w-full rounded px-1.5 py-1 text-sm text-zinc-800 outline-none transition-colors hover:bg-zinc-100 focus:bg-zinc-100 disabled:cursor-default disabled:hover:bg-transparent dark:text-zinc-100 dark:hover:bg-zinc-800 dark:focus:bg-zinc-800 placeholder:text-zinc-300 dark:placeholder:text-zinc-600";

  if (property.type === "checkbox") {
    const checked = property.value === "true";
    return (
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) =>
          onChange({ value: event.target.checked ? "true" : "false" })
        }
        className="mt-1.5 h-4 w-4 cursor-pointer accent-zinc-700 disabled:cursor-default dark:accent-zinc-300"
      />
    );
  }

  if (property.type === "date") {
    return (
      <input
        type="date"
        value={property.value}
        disabled={disabled}
        onChange={(event) => onChange({ value: event.target.value })}
        className={inputClass}
      />
    );
  }

  if (property.type === "number") {
    return (
      <input
        type="number"
        value={property.value}
        disabled={disabled}
        placeholder="空"
        onChange={(event) => onChange({ value: event.target.value })}
        className={inputClass}
      />
    );
  }

  if (property.type === "url") {
    return (
      <div className="flex items-center gap-2">
        <input
          type="url"
          value={property.value}
          disabled={disabled}
          placeholder="空"
          onChange={(event) => onChange({ value: event.target.value })}
          className={inputClass}
        />
        {property.value && (
          <a
            href={property.value}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-xs text-blue-500 hover:underline"
          >
            打开
          </a>
        )}
      </div>
    );
  }

  if (property.type === "select") {
    return (
      <SelectValueEditor
        property={property}
        disabled={disabled}
        onChange={onChange}
      />
    );
  }

  // text
  return (
    <input
      type="text"
      value={property.value}
      disabled={disabled}
      placeholder="空"
      onChange={(event) => onChange({ value: event.target.value })}
      className={inputClass}
    />
  );
}

function SelectValueEditor({
  property,
  disabled,
  onChange,
}: {
  property: PageProperty;
  disabled: boolean;
  onChange: (patch: Partial<Omit<PageProperty, "id">>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const options = property.options ?? [];

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && ref.current?.contains(event.target)) {
        return;
      }
      setOpen(false);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const pick = (option: string) => {
    onChange({ value: option });
    setOpen(false);
  };

  const addOption = () => {
    const next = draft.trim();
    if (!next) return;
    const nextOptions = options.includes(next) ? options : [...options, next];
    onChange({ options: nextOptions, value: next });
    setDraft("");
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center rounded px-1.5 py-1 text-left text-sm transition-colors hover:bg-zinc-100 disabled:cursor-default disabled:hover:bg-transparent dark:hover:bg-zinc-800"
      >
        {property.value ? (
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
            {property.value}
          </span>
        ) : (
          <span className="text-sm text-zinc-300 dark:text-zinc-600">空</span>
        )}
      </button>
      {open && !disabled && (
        <div className="absolute left-0 top-9 z-30 w-48 overflow-hidden rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {options.length > 0 && (
            <div className="max-h-40 overflow-y-auto">
              {options.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => pick(option)}
                  className="flex w-full items-center px-3 py-1.5 text-left text-sm text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">
                    {option}
                  </span>
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-1 border-t border-zinc-100 px-2 py-1.5 dark:border-zinc-800">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") addOption();
              }}
              placeholder="新建选项..."
              className="min-w-0 flex-1 bg-transparent px-1 text-sm text-zinc-700 outline-none dark:text-zinc-200"
            />
            <button
              type="button"
              onClick={addOption}
              disabled={!draft.trim()}
              className="shrink-0 rounded px-1.5 py-0.5 text-xs text-zinc-400 hover:text-zinc-700 disabled:opacity-40 dark:hover:text-zinc-200"
            >
              添加
            </button>
          </div>
          {property.value && (
            <button
              type="button"
              onClick={() => pick("")}
              className="w-full border-t border-zinc-100 px-3 py-1.5 text-left text-xs text-zinc-400 hover:text-zinc-600 dark:border-zinc-800 dark:hover:text-zinc-300"
            >
              清除
            </button>
          )}
        </div>
      )}
    </div>
  );
}
