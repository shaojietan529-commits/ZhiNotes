"use client";

import {
  getPageMetadata,
  listPageMetadata,
} from "@/lib/db/local/queries";
import type { Page } from "@/lib/utils/types";

interface ListScopedPageMetadataOptions {
  includeRoot?: boolean;
  includeDescendants?: boolean;
}

export async function listScopedPageMetadata(
  rootId: string,
  options: ListScopedPageMetadataOptions = {}
): Promise<Page[]> {
  const includeRoot = options.includeRoot ?? false;
  const includeDescendants = options.includeDescendants ?? true;
  const pages: Page[] = [];

  if (includeRoot) {
    const root = await getPageMetadata(rootId);
    if (root) pages.push(root);
  }

  const directChildren = await listPageMetadata(rootId);
  pages.push(...directChildren);
  if (!includeDescendants) return pages;

  const queue = [...directChildren];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    const children = await listPageMetadata(current.id);
    pages.push(...children);
    queue.push(...children);
  }

  return dedupePages(pages);
}

export function mergePageMetadata(current: Page[], incoming: Page[]): Page[] {
  return sortPageMetadata(dedupePages([...current, ...incoming]));
}

export function sortPageMetadata(pages: Page[]): Page[] {
  return [...pages].sort((a, b) => {
    if (a.parent_id === b.parent_id) {
      const position = (a.position ?? 0) - (b.position ?? 0);
      if (position !== 0) return position;
    }
    const updated = (b.updated_at || "").localeCompare(a.updated_at || "");
    if (updated !== 0) return updated;
    return a.id.localeCompare(b.id);
  });
}

function dedupePages(pages: Page[]): Page[] {
  const byId = new Map<string, Page>();
  for (const page of pages) {
    if (page.deleted_at) {
      byId.delete(page.id);
    } else {
      byId.set(page.id, page);
    }
  }
  return [...byId.values()];
}
