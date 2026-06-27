import { DEFAULT_OWNER_ID } from "@/lib/utils/id";
import type { Page } from "@/lib/utils/types";

const DAILY_HOT_CACHE_PREFIX = "zhinote.daily.hotCacheSnapshot.";
const DAILY_HOT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const DAILY_HOT_CACHE_MAX_PAGES = 500;
const DAILY_HOT_CACHE_OVERLAP_MAX_SNAPSHOTS = 6;

type DailyHotCacheSnapshotInputPage = Page & { dailyDateKey?: string };

export interface DailyHotCacheSnapshotPage {
  id: string;
  parent_id: string | null;
  title: string;
  icon: string | null;
  cover_url: string | null;
  properties: string | null;
  daily_date_key: string;
  position: number;
  depth: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DailyHotCacheSnapshot {
  format: "zhinote-daily-hot-cache-snapshot";
  format_version: 1;
  route_target: "/daily";
  architecture_target: "cloud-master-local-hot-cache";
  source:
    | "local-metadata"
    | "local-fallback-metadata"
    | "cloud-metadata"
    | "optimistic-local";
  root_id: string | null;
  start_date: string;
  end_date: string;
  cached_at: string;
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
  };
  summary: {
    pages: number;
    range_pages: number;
  };
  pages: DailyHotCacheSnapshotPage[];
}

export function readDailyHotCacheSnapshot(
  startDate: string,
  endDate: string
): DailyHotCacheSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(
      dailyHotCacheSnapshotKey(startDate, endDate)
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DailyHotCacheSnapshot>;
    if (!isValidDailyHotCacheSnapshot(parsed, startDate, endDate)) return null;
    if (Date.now() - Date.parse(parsed.cached_at) > DAILY_HOT_CACHE_TTL_MS) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function readDailyHotCacheSnapshotsForRange(
  startDate: string,
  endDate: string
): DailyHotCacheSnapshot[] {
  if (typeof window === "undefined") return [];
  const snapshots: DailyHotCacheSnapshot[] = [];
  try {
    const storage = window.localStorage;
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key?.startsWith(DAILY_HOT_CACHE_PREFIX)) continue;
      const raw = storage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as Partial<DailyHotCacheSnapshot>;
      if (!isDailyHotCacheSnapshotShape(parsed)) continue;
      if (isExpiredDailyHotCacheSnapshot(parsed)) {
        storage.removeItem(key);
        continue;
      }
      if (!rangesOverlap(parsed.start_date, parsed.end_date, startDate, endDate)) {
        continue;
      }
      snapshots.push(parsed);
    }
  } catch {
    return snapshots;
  }

  return snapshots
    .sort((a, b) => b.cached_at.localeCompare(a.cached_at))
    .slice(0, DAILY_HOT_CACHE_OVERLAP_MAX_SNAPSHOTS);
}

export function writeDailyHotCacheSnapshot(input: {
  startDate: string;
  endDate: string;
  rootId: string | null;
  pages: DailyHotCacheSnapshotInputPage[];
  source: DailyHotCacheSnapshot["source"];
}): DailyHotCacheSnapshot | null {
  if (typeof window === "undefined") return null;
  const snapshotPages = input.pages
    .filter((page) =>
      isDailyHotCacheInputPagePossiblyInRange(
        page,
        input.startDate,
        input.endDate
      )
    )
    .map(toSnapshotPage)
    .filter((page): page is DailyHotCacheSnapshotPage => Boolean(page))
    .filter((page) =>
      isDailyHotCacheSnapshotPageInRange(page, input.startDate, input.endDate)
    )
    .slice(0, DAILY_HOT_CACHE_MAX_PAGES);
  if (snapshotPages.length === 0) return null;

  const snapshot: DailyHotCacheSnapshot = {
    format: "zhinote-daily-hot-cache-snapshot",
    format_version: 1,
    route_target: "/daily",
    architecture_target: "cloud-master-local-hot-cache",
    source: input.source,
    root_id: input.rootId,
    start_date: input.startDate,
    end_date: input.endDate,
    cached_at: new Date().toISOString(),
    privacy_boundary:
      "This snapshot stores daily-note metadata for fast first paint only: ids, titles, icons, date keys, hierarchy, ordering, and timestamps. It does not store page bodies, editor state, database row values, comments, files, tokens, or raw cache dumps. It does not enter sync_log and is not a cloud source of truth.",
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
    },
    summary: {
      pages: snapshotPages.length,
      range_pages: snapshotPages.length,
    },
    pages: snapshotPages,
  };

  try {
    window.localStorage.setItem(
      dailyHotCacheSnapshotKey(input.startDate, input.endDate),
      JSON.stringify(snapshot)
    );
    return snapshot;
  } catch {
    return null;
  }
}

export function dailyHotCacheSnapshotPageToPage(
  page: DailyHotCacheSnapshotPage
): Page {
  return {
    id: page.id,
    owner_id: DEFAULT_OWNER_ID,
    parent_id: page.parent_id,
    database_id: null,
    title: page.title,
    icon: page.icon,
    cover_url: page.cover_url,
    content_yjs: null,
    content_text: null,
    properties: page.properties,
    position: page.position,
    depth: page.depth,
    created_at: page.created_at,
    updated_at: page.updated_at,
    deleted_at: page.deleted_at,
    sync_version: 0,
  };
}

function dailyHotCacheSnapshotKey(startDate: string, endDate: string): string {
  return `${DAILY_HOT_CACHE_PREFIX}${startDate}:${endDate}:v1`;
}

function toSnapshotPage(
  page: DailyHotCacheSnapshotInputPage
): DailyHotCacheSnapshotPage | null {
  const dateKey = page.dailyDateKey || readDateKeyFromProperties(page.properties);
  if (!dateKey) return null;
  return {
    id: page.id,
    parent_id: page.parent_id,
    title: page.title,
    icon: page.icon,
    cover_url: page.cover_url,
    properties: page.properties,
    daily_date_key: dateKey,
    position: page.position,
    depth: page.depth,
    created_at: page.created_at,
    updated_at: page.updated_at,
    deleted_at: page.deleted_at,
  };
}

function isDailyHotCacheSnapshotPageInRange(
  page: DailyHotCacheSnapshotPage,
  startDate: string,
  endDate: string
): boolean {
  return page.daily_date_key >= startDate && page.daily_date_key <= endDate;
}

function isDailyHotCacheInputPagePossiblyInRange(
  page: DailyHotCacheSnapshotInputPage,
  startDate: string,
  endDate: string
): boolean {
  if (!page.dailyDateKey) return true;
  return page.dailyDateKey >= startDate && page.dailyDateKey <= endDate;
}

function readDateKeyFromProperties(properties: string | null): string {
  if (!properties) return "";
  try {
    const parsed = JSON.parse(properties);
    if (!Array.isArray(parsed)) return "";
    const date = parsed.find(
      (item) =>
        item &&
        typeof item === "object" &&
        "name" in item &&
        item.name === "日期" &&
        "value" in item &&
        typeof item.value === "string"
    ) as { value?: string } | undefined;
    return date?.value && /^\d{4}-\d{2}-\d{2}/.test(date.value)
      ? date.value.slice(0, 10)
      : "";
  } catch {
    return "";
  }
}

function isValidDailyHotCacheSnapshot(
  value: Partial<DailyHotCacheSnapshot>,
  startDate: string,
  endDate: string
): value is DailyHotCacheSnapshot {
  return (
    isDailyHotCacheSnapshotShape(value) &&
    value.start_date === startDate &&
    value.end_date === endDate
  );
}

function isDailyHotCacheSnapshotShape(
  value: Partial<DailyHotCacheSnapshot>
): value is DailyHotCacheSnapshot {
  return (
    value.format === "zhinote-daily-hot-cache-snapshot" &&
    value.format_version === 1 &&
    value.route_target === "/daily" &&
    typeof value.start_date === "string" &&
    typeof value.end_date === "string" &&
    typeof value.cached_at === "string" &&
    Array.isArray(value.pages)
  );
}

function isExpiredDailyHotCacheSnapshot(
  value: DailyHotCacheSnapshot
): boolean {
  return Date.now() - Date.parse(value.cached_at) > DAILY_HOT_CACHE_TTL_MS;
}

function rangesOverlap(
  leftStart: string,
  leftEnd: string,
  rightStart: string,
  rightEnd: string
): boolean {
  return leftStart <= rightEnd && rightStart <= leftEnd;
}
