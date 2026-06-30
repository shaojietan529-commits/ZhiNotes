import type { Page } from "@/lib/utils/types";

type SearchablePageMetadata = Pick<Page, "title" | "icon" | "properties">;

export function buildPageMetadataSearchText(
  page: SearchablePageMetadata
): string {
  return [page.title, page.icon, page.properties]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function pageMetadataMatches(
  page: SearchablePageMetadata,
  terms: string[]
): boolean {
  const searchable = buildPageMetadataSearchText(page);
  return terms.some((term) => searchable.includes(term.toLowerCase()));
}
