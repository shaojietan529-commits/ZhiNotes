"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocalFirstPageNavigation } from "@/hooks/useLocalFirstPageNavigation";
import {
  PAGE_PROPERTY_TYPES,
  createPageProperty,
  getPagePropertyTypeIcon,
  joinTagsValue,
  parseTagsValue,
  removePageProperty,
  updatePageProperty,
  type PageProperty,
  type PagePropertyType,
} from "@/lib/pages/pageProperties";
import { getPage } from "@/lib/db/local/queries";
import { findIndustryChainPageId } from "@/lib/pages/industryChainSearch";

const PAGE_PROPERTY_AI_TAG_REQUEST_TIMEOUT_MS = 12000;

export interface PagePropertiesProps {
  properties: PageProperty[];
  disabled?: boolean;
  pageId?: string;
  onChange: (next: PageProperty[]) => void;
}

async function fetchAiAnalyzeTagsWithTimeout(content: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(),
    PAGE_PROPERTY_AI_TAG_REQUEST_TIMEOUT_MS
  );
  try {
    return await fetch("/api/ai/analyze-tags", {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({ content }),
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

// Notion-style properties block shown directly under the page title.
export default function PageProperties({
  properties,
  disabled = false,
  pageId,
  onChange,
}: PagePropertiesProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);

  const hasTagsProperties = properties.some((p) => p.type === "tags");

  const handleAiAnalyze = useCallback(async () => {
    if (!pageId || aiLoading) return;
    setAiLoading(true);
    try {
      const page = await getPage(pageId);
      const content = page?.content_text ?? "";
      if (!content.replace(/<[^>]*>/g, "").trim()) {
        window.alert("页面内容为空，无法识别相关标签。");
        return;
      }

      const res = await fetchAiAnalyzeTagsWithTimeout(content);

      if (res.status === 501) {
        window.alert(
          "AI 功能尚未配置。请在 Vercel 项目设置 → Environment Variables 中添加 ANTHROPIC_API_KEY。"
        );
        return;
      }

      if (!res.ok) {
        window.alert("AI 识别失败，请稍后重试。");
        return;
      }

      const data: { companies?: string[]; industries?: string[] } =
        await res.json();
      let next = [...properties];

      const companyProp = next.find((p) => p.name === "相关公司");
      if (companyProp && data.companies?.length) {
        const existing = parseTagsValue(companyProp.value);
        const merged = [...new Set([...existing, ...data.companies])];
        next = updatePageProperty(next, companyProp.id, {
          value: joinTagsValue(merged),
        });
      }

      const industryProp = next.find((p) => p.name === "相关行业");
      if (industryProp && data.industries?.length) {
        const existing = parseTagsValue(industryProp.value);
        const merged = [...new Set([...existing, ...data.industries])];
        next = updatePageProperty(next, industryProp.id, {
          value: joinTagsValue(merged),
        });
      }

      onChange(next);
    } catch (error) {
      window.alert(
        isAbortError(error)
          ? "AI 识别请求超时；本地页面没有变化，可稍后重试。"
          : "AI 识别出错，请检查网络连接。"
      );
    } finally {
      setAiLoading(false);
    }
  }, [pageId, aiLoading, properties, onChange]);

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
        <div className="mt-1 flex items-center gap-2">
          <div ref={addRef} className="relative">
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
          {hasTagsProperties && pageId && (
            <button
              type="button"
              onClick={() => void handleAiAnalyze()}
              disabled={aiLoading}
              className="flex items-center gap-1 rounded px-2 py-1 text-sm text-zinc-400 transition-colors hover:bg-violet-50 hover:text-violet-600 disabled:opacity-50 dark:hover:bg-violet-950/40 dark:hover:text-violet-400"
            >
              {aiLoading ? (
                <>
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border border-zinc-300 border-t-violet-500" />
                  识别中…
                </>
              ) : (
                <>✨ AI 识别</>
              )}
            </button>
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

  if (property.type === "tags") {
    return (
      <TagsValueEditor
        property={property}
        disabled={disabled}
        onChange={onChange}
      />
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

const TAG_COLORS = [
  "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
];

function tagColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

function TagsValueEditor({
  property,
  disabled,
  onChange,
}: {
  property: PageProperty;
  disabled: boolean;
  onChange: (patch: Partial<Omit<PageProperty, "id">>) => void;
}) {
  const router = useRouter();
  const openPage = useLocalFirstPageNavigation();
  const [draft, setDraft] = useState("");
  const [navigating, setNavigating] = useState<string | null>(null);
  const tags = parseTagsValue(property.value);

  const addTag = () => {
    const next = draft.trim();
    if (!next || tags.includes(next)) {
      setDraft("");
      return;
    }
    onChange({ value: joinTagsValue([...tags, next]) });
    setDraft("");
  };

  const removeTag = (tag: string) => {
    onChange({ value: joinTagsValue(tags.filter((t) => t !== tag)) });
  };

  const handleTagClick = async (tag: string) => {
    setNavigating(tag);
    try {
      const pageId = await findIndustryChainPageId(tag);
      if (pageId) {
        openPage(pageId, { source: "page-property-open" });
      } else {
        router.push("/industry-chain");
      }
    } finally {
      setNavigating(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 py-0.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${tagColor(tag)}`}
        >
          <button
            type="button"
            onClick={() => void handleTagClick(tag)}
            disabled={navigating === tag}
            className="hover:underline"
            title={`跳转到产业链：${tag}`}
          >
            {navigating === tag ? "…" : tag}
          </button>
          {!disabled && (
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="ml-0.5 opacity-60 hover:opacity-100"
              title="移除"
            >
              ×
            </button>
          )}
        </span>
      ))}
      {!disabled && (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag();
            }
          }}
          onBlur={addTag}
          placeholder={tags.length === 0 ? "输入标签…" : "+"}
          className="min-w-[60px] max-w-[120px] flex-shrink bg-transparent px-1 py-0.5 text-sm text-zinc-700 outline-none placeholder:text-zinc-300 dark:text-zinc-200 dark:placeholder:text-zinc-600"
        />
      )}
      {tags.length === 0 && disabled && (
        <span className="text-sm text-zinc-300 dark:text-zinc-600">空</span>
      )}
    </div>
  );
}
