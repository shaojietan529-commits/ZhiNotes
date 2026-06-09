import { generateId } from "@/lib/utils/id";

// Notion-style page properties. These live in the local `pages.properties`
// column as a JSON string. Everything here is pure/local — no I/O, no upload.

export type PagePropertyType =
  | "text"
  | "number"
  | "date"
  | "select"
  | "checkbox"
  | "url"
  | "tags";

export interface PageProperty {
  id: string;
  name: string;
  type: PagePropertyType;
  // Stored as a string for text/number/date/select/url; "true"/"false" for checkbox.
  value: string;
  // Available choices for the "select" type. Ignored for other types.
  options?: string[];
}

export const PAGE_PROPERTY_TYPES: {
  value: PagePropertyType;
  label: string;
  icon: string;
}[] = [
  { value: "text", label: "文本", icon: "≡" },
  { value: "number", label: "数字", icon: "#" },
  { value: "date", label: "日期", icon: "📅" },
  { value: "select", label: "单选", icon: "⛓" },
  { value: "checkbox", label: "复选框", icon: "✓" },
  { value: "url", label: "链接", icon: "🔗" },
  { value: "tags", label: "标签", icon: "🏷️" },
];

export function getPagePropertyTypeLabel(type: PagePropertyType): string {
  return (
    PAGE_PROPERTY_TYPES.find((entry) => entry.value === type)?.label ?? "文本"
  );
}

export function getPagePropertyTypeIcon(type: PagePropertyType): string {
  return PAGE_PROPERTY_TYPES.find((entry) => entry.value === type)?.icon ?? "≡";
}

function isPagePropertyType(value: unknown): value is PagePropertyType {
  return PAGE_PROPERTY_TYPES.some((entry) => entry.value === value);
}

// Safely turn the stored JSON string into a typed array. Never throws.
export function parsePageProperties(raw: string | null | undefined): PageProperty[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (entry): entry is Record<string, unknown> =>
          Boolean(entry) && typeof entry === "object"
      )
      .map((entry) => {
        const type = isPagePropertyType(entry.type) ? entry.type : "text";
        const options = Array.isArray(entry.options)
          ? entry.options.filter(
              (option): option is string => typeof option === "string"
            )
          : undefined;
        return {
          id:
            typeof entry.id === "string" && entry.id ? entry.id : generateId(),
          name: typeof entry.name === "string" ? entry.name : "属性",
          type,
          value: typeof entry.value === "string" ? entry.value : "",
          ...(options && options.length > 0 ? { options } : {}),
        } satisfies PageProperty;
      });
  } catch {
    return [];
  }
}

export function stringifyPageProperties(properties: PageProperty[]): string {
  return JSON.stringify(properties);
}

export function createPageProperty(
  type: PagePropertyType = "text",
  name?: string
): PageProperty {
  return {
    id: generateId(),
    name: name?.trim() || getPagePropertyTypeLabel(type),
    type,
    value: type === "checkbox" ? "false" : "",
    ...(type === "select" ? { options: [] } : {}),
  };
}

// Returns a new array with the matching property patched. Pure (no mutation).
export function updatePageProperty(
  properties: PageProperty[],
  id: string,
  patch: Partial<Omit<PageProperty, "id">>
): PageProperty[] {
  return properties.map((property) =>
    property.id === id ? { ...property, ...patch } : property
  );
}

export function removePageProperty(
  properties: PageProperty[],
  id: string
): PageProperty[] {
  return properties.filter((property) => property.id !== id);
}

export function parseTagsValue(value: string): string[] {
  if (!value) return [];
  return value.split(",").map((t) => t.trim()).filter(Boolean);
}

export function joinTagsValue(tags: string[]): string {
  return tags.join(",");
}
