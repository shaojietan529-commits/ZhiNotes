import { DEFAULT_OWNER_ID } from "@/lib/utils/id";
import type { Page } from "@/lib/utils/types";

const PAGE_LIST_HOT_CACHE_KEY = "zhinote.pageList.hotCacheSnapshot.v1";
const PAGE_LIST_HOT_CACHE_FRESH_MS = 24 * 60 * 60 * 1000;
const PAGE_LIST_HOT_CACHE_STALE_MS = 7 * 24 * 60 * 60 * 1000;
const PAGE_LIST_HOT_CACHE_MAX_PAGES = 500;
const PAGE_LIST_HOT_CACHE_ROOT_LIMIT = 160;

export interface PageListHotCacheSnapshotPage {
  id: string;
  parent_id: string | null;
  database_id: string | null;
  title: string;
  icon: string | null;
  cover_url: string | null;
  position: number;
  depth: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface PageListHotCacheSnapshot {
  format: "zhinote-page-list-hot-cache-snapshot";
  format_version: 1;
  route_target: "global-page-list";
  architecture_target: "cloud-master-local-hot-cache";
  source:
    | "hot-cache-metadata"
    | "local-metadata"
    | "cloud-metadata"
    | "optimistic-local";
  cached_at: string;
  stale?: boolean;
  privacy_boundary: string;
  boundary: {
    reads_page_body_text: false;
    reads_page_yjs: false;
    reads_database_row_values: false;
    reads_comment_bodies: false;
    reads_file_bytes: false;
    reads_file_text: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    enters_sync_log: false;
    stores_source_of_truth: false;
    records_metadata_only: true;
    stores_page_properties: false;
  };
  summary: {
    pages: number;
    root_pages: number;
    recent_pages: number;
  };
  pages: PageListHotCacheSnapshotPage[];
}

export function readPageListHotCacheSnapshot(): PageListHotCacheSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PAGE_LIST_HOT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PageListHotCacheSnapshot>;
    if (!isPageListHotCacheSnapshotShape(parsed)) return null;
    if (isExpiredPageListHotCacheSnapshot(parsed)) return null;
    return withPageListHotCacheSnapshotFreshness(parsed);
  } catch {
    return null;
  }
}

export function writePageListHotCacheSnapshot(input: {
  pages: Page[];
  source: PageListHotCacheSnapshot["source"];
}): PageListHotCacheSnapshot | null {
  if (typeof window === "undefined") return null;
  const selectedPages = selectPageListHotCachePages(input.pages);
  if (selectedPages.length === 0) return null;

  const rootPages = selectedPages.filter((page) => page.parent_id === null).length;
  const snapshotPages = selectedPages.map(toSnapshotPage);
  const snapshot: PageListHotCacheSnapshot = {
    format: "zhinote-page-list-hot-cache-snapshot",
    format_version: 1,
    route_target: "global-page-list",
    architecture_target: "cloud-master-local-hot-cache",
    source: input.source,
    cached_at: new Date().toISOString(),
    privacy_boundary:
      "This snapshot stores page-list metadata for fast first paint only: ids, titles, icons, covers, hierarchy, ordering, database ids, and timestamps. It does not store page bodies, editor state, page properties, database row values, comments, files, tokens, or raw cache dumps. It does not enter sync_log and is not a cloud source of truth.",
    boundary: {
      reads_page_body_text: false,
      reads_page_yjs: false,
      reads_database_row_values: false,
      reads_comment_bodies: false,
      reads_file_bytes: false,
      reads_file_text: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      enters_sync_log: false,
      stores_source_of_truth: false,
      records_metadata_only: true,
      stores_page_properties: false,
    },
    summary: {
      pages: snapshotPages.length,
      root_pages: rootPages,
      recent_pages: Math.max(0, snapshotPages.length - rootPages),
    },
    pages: snapshotPages,
  };

  try {
    if (!shouldWritePageListHotCacheSnapshot(snapshot)) return snapshot;
    window.localStorage.setItem(PAGE_LIST_HOT_CACHE_KEY, JSON.stringify(snapshot));
    return snapshot;
  } catch {
    return null;
  }
}

export function pageListHotCacheSnapshotPageToPage(
  page: PageListHotCacheSnapshotPage
): Page {
  return {
    id: page.id,
    owner_id: DEFAULT_OWNER_ID,
    parent_id: page.parent_id,
    database_id: page.database_id,
    title: page.title,
    icon: page.icon,
    cover_url: page.cover_url,
    content_yjs: null,
    content_text: null,
    properties: null,
    position: page.position,
    depth: page.depth,
    created_at: page.created_at,
    updated_at: page.updated_at,
    deleted_at: page.deleted_at,
    sync_version: 0,
  };
}

function selectPageListHotCachePages(pages: Page[]): Page[] {
  const byId = new Map(
    pages
      .filter((page) => !page.deleted_at)
      .map((page) => [page.id, page] as const)
  );
  const selected = new Map<string, Page>();

  const addWithAncestors = (page: Page | undefined): void => {
    let current = page;
    let guard = 0;
    while (current && guard < 32) {
      selected.set(current.id, current);
      current = current.parent_id ? byId.get(current.parent_id) : undefined;
      guard += 1;
    }
  };

  const rootPages = [...byId.values()]
    .filter((page) => page.parent_id === null)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .slice(0, PAGE_LIST_HOT_CACHE_ROOT_LIMIT);
  for (const page of rootPages) addWithAncestors(page);

  const recentPages = [...byId.values()]
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, PAGE_LIST_HOT_CACHE_MAX_PAGES);
  for (const page of recentPages) {
    addWithAncestors(page);
    if (selected.size >= PAGE_LIST_HOT_CACHE_MAX_PAGES) break;
  }

  return [...selected.values()].slice(0, PAGE_LIST_HOT_CACHE_MAX_PAGES);
}

function toSnapshotPage(page: Page): PageListHotCacheSnapshotPage {
  return {
    id: page.id,
    parent_id: page.parent_id,
    database_id: page.database_id,
    title: page.title,
    icon: page.icon,
    cover_url: page.cover_url,
    position: page.position,
    depth: page.depth,
    created_at: page.created_at,
    updated_at: page.updated_at,
    deleted_at: page.deleted_at,
  };
}

function shouldWritePageListHotCacheSnapshot(
  snapshot: PageListHotCacheSnapshot
): boolean {
  const current = readPageListHotCacheSnapshotForWrite();
  if (!current) return true;
  if (isStalePageListHotCacheSnapshot(current)) return true;
  return (
    buildPageListHotCacheSnapshotSignature(current) !==
    buildPageListHotCacheSnapshotSignature(snapshot)
  );
}

function readPageListHotCacheSnapshotForWrite(): PageListHotCacheSnapshot | null {
  try {
    const raw = window.localStorage.getItem(PAGE_LIST_HOT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PageListHotCacheSnapshot>;
    if (!isPageListHotCacheSnapshotShape(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function buildPageListHotCacheSnapshotSignature(
  snapshot: PageListHotCacheSnapshot
): string {
  return JSON.stringify(stablePageListHotCacheSnapshotValue(snapshot));
}

function stablePageListHotCacheSnapshotValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stablePageListHotCacheSnapshotValue(item));
  }
  if (!value || typeof value !== "object") return value;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    if (key === "cached_at" || key === "stale") continue;
    const nextValue = (value as Record<string, unknown>)[key];
    if (typeof nextValue !== "undefined") {
      result[key] = stablePageListHotCacheSnapshotValue(nextValue);
    }
  }
  return result;
}

function isPageListHotCacheSnapshotShape(
  value: Partial<PageListHotCacheSnapshot>
): value is PageListHotCacheSnapshot {
  return (
    value.format === "zhinote-page-list-hot-cache-snapshot" &&
    value.format_version === 1 &&
    value.route_target === "global-page-list" &&
    value.architecture_target === "cloud-master-local-hot-cache" &&
    typeof value.cached_at === "string" &&
    Array.isArray(value.pages)
  );
}

function isExpiredPageListHotCacheSnapshot(
  value: PageListHotCacheSnapshot
): boolean {
  return Date.now() - Date.parse(value.cached_at) > PAGE_LIST_HOT_CACHE_STALE_MS;
}

function isStalePageListHotCacheSnapshot(
  value: PageListHotCacheSnapshot
): boolean {
  const ageMs = Date.now() - Date.parse(value.cached_at);
  return ageMs > PAGE_LIST_HOT_CACHE_FRESH_MS;
}

function withPageListHotCacheSnapshotFreshness(
  snapshot: PageListHotCacheSnapshot
): PageListHotCacheSnapshot {
  return {
    ...snapshot,
    stale: isStalePageListHotCacheSnapshot(snapshot),
  };
}
