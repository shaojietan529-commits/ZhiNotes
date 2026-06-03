import type { Page } from "@/lib/utils/types";

export function normalizeRelationValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return uniqueStrings(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) return uniqueStrings(parsed);
    } catch {
      return uniqueStrings([trimmed]);
    }
    return uniqueStrings([trimmed]);
  }

  return [];
}

export function getRelationPages(value: unknown, pages: Page[]) {
  const ids = normalizeRelationValue(value);
  const byId = new Map(pages.map((page) => [page.id, page]));

  return ids.map((id) => ({
    id,
    page: byId.get(id) ?? null,
  }));
}

export function stringifyRelationValue(value: unknown, pages: Page[]) {
  return getRelationPages(value, pages)
    .map(({ id, page }) => page?.title || id)
    .join(", ");
}

function uniqueStrings(values: unknown[]) {
  return Array.from(
    new Set(
      values.filter(
        (item): item is string => typeof item === "string" && item.length > 0
      )
    )
  );
}
