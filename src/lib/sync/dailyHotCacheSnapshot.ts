import { DEFAULT_OWNER_ID } from "@/lib/utils/id";
import type { Page } from "@/lib/utils/types";

const DAILY_HOT_CACHE_PREFIX = "zhinote.daily.hotCacheSnapshot.";
const DAILY_HOT_CACHE_INDEX_KEY = "zhinote.daily.hotCacheSnapshot.index.v1";
const DAILY_HOT_CACHE_FRESH_MS = 24 * 60 * 60 * 1000;
const DAILY_HOT_CACHE_STALE_MS = 7 * 24 * 60 * 60 * 1000;
const DAILY_HOT_CACHE_MAX_PAGES = 500;
const DAILY_HOT_CACHE_OVERLAP_MAX_SNAPSHOTS = 6;
const DAILY_HOT_CACHE_INDEX_MAX_ENTRIES = 120;

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
  };
  summary: {
    pages: number;
    range_pages: number;
  };
  pages: DailyHotCacheSnapshotPage[];
}

interface DailyHotCacheSnapshotIndexEntry {
  key: string;
  start_date: string;
  end_date: string;
  cached_at: string;
  source: DailyHotCacheSnapshot["source"];
  root_id: string | null;
  pages: number;
  range_pages: number;
}

interface DailyHotCacheSnapshotIndex {
  format: "zhinote-daily-hot-cache-snapshot-index";
  format_version: 1;
  route_target: "/daily";
  architecture_target: "cloud-master-local-hot-cache";
  updated_at: string;
  privacy_boundary: string;
  boundary: DailyHotCacheSnapshot["boundary"] & {
    scans_local_storage_keys: false;
  };
  summary: {
    entries: number;
    overlapping_range_lookup: true;
  };
  entries: DailyHotCacheSnapshotIndexEntry[];
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
    if (isExpiredDailyHotCacheSnapshot(parsed)) return null;
    return withDailyHotCacheSnapshotFreshness(parsed);
  } catch {
    return null;
  }
}

export function readDailyHotCacheSnapshotsForRange(
  startDate: string,
  endDate: string
): DailyHotCacheSnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const storage = window.localStorage;
    const index = readDailyHotCacheSnapshotIndex(storage);
    if (!index) return [];

    const snapshots: DailyHotCacheSnapshot[] = [];
    for (const entry of index.entries) {
      if (!rangesOverlap(entry.start_date, entry.end_date, startDate, endDate)) {
        continue;
      }
      const raw = storage.getItem(entry.key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as Partial<DailyHotCacheSnapshot>;
      if (!isDailyHotCacheSnapshotShape(parsed)) continue;
      if (isExpiredDailyHotCacheSnapshot(parsed)) continue;
      if (!rangesOverlap(parsed.start_date, parsed.end_date, startDate, endDate)) {
        continue;
      }
      snapshots.push(withDailyHotCacheSnapshotFreshness(parsed));
    }

    return snapshots
      .sort((a, b) => b.cached_at.localeCompare(a.cached_at))
      .slice(0, DAILY_HOT_CACHE_OVERLAP_MAX_SNAPSHOTS);
  } catch {
    return [];
  }
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
    const key = dailyHotCacheSnapshotKey(input.startDate, input.endDate);
    if (!shouldWriteDailyHotCacheSnapshot(key, snapshot)) return snapshot;
    window.localStorage.setItem(key, JSON.stringify(snapshot));
    writeDailyHotCacheSnapshotIndex(window.localStorage, snapshot, key);
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

function shouldWriteDailyHotCacheSnapshot(
  key: string,
  snapshot: DailyHotCacheSnapshot
): boolean {
  const current = readDailyHotCacheSnapshotForWrite(key);
  if (!current) return true;
  if (isStaleDailyHotCacheSnapshot(current)) return true;
  return (
    buildDailyHotCacheSnapshotSignature(current) !==
    buildDailyHotCacheSnapshotSignature(snapshot)
  );
}

function readDailyHotCacheSnapshotForWrite(
  key: string
): DailyHotCacheSnapshot | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DailyHotCacheSnapshot>;
    if (!isDailyHotCacheSnapshotShape(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function buildDailyHotCacheSnapshotSignature(
  snapshot: DailyHotCacheSnapshot
): string {
  return JSON.stringify(stableDailyHotCacheSnapshotValue(snapshot));
}

function stableDailyHotCacheSnapshotValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stableDailyHotCacheSnapshotValue(item));
  }
  if (!value || typeof value !== "object") return value;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    if (key === "cached_at" || key === "stale") continue;
    const nextValue = (value as Record<string, unknown>)[key];
    if (typeof nextValue !== "undefined") {
      result[key] = stableDailyHotCacheSnapshotValue(nextValue);
    }
  }
  return result;
}

function dailyHotCacheSnapshotKey(startDate: string, endDate: string): string {
  return `${DAILY_HOT_CACHE_PREFIX}${startDate}:${endDate}:v1`;
}

function readDailyHotCacheSnapshotIndex(
  storage: Storage
): DailyHotCacheSnapshotIndex | null {
  try {
    const raw = storage.getItem(DAILY_HOT_CACHE_INDEX_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DailyHotCacheSnapshotIndex>;
    if (!isDailyHotCacheSnapshotIndexShape(parsed)) return null;
    const entries = parsed.entries
      .filter(isDailyHotCacheSnapshotIndexEntry)
      .filter((entry) => !isExpiredDailyHotCacheEntry(entry))
      .slice(0, DAILY_HOT_CACHE_INDEX_MAX_ENTRIES);
    return {
      ...parsed,
      entries,
      summary: {
        entries: entries.length,
        overlapping_range_lookup: true,
      },
    };
  } catch {
    return null;
  }
}

function writeDailyHotCacheSnapshotIndex(
  storage: Storage,
  snapshot: DailyHotCacheSnapshot,
  key: string
): void {
  try {
    const current = readDailyHotCacheSnapshotIndex(storage);
    const entries = [
      toDailyHotCacheSnapshotIndexEntry(snapshot, key),
      ...(current?.entries ?? []).filter((entry) => entry.key !== key),
    ]
      .filter((entry) => !isExpiredDailyHotCacheEntry(entry))
      .sort((a, b) => b.cached_at.localeCompare(a.cached_at))
      .slice(0, DAILY_HOT_CACHE_INDEX_MAX_ENTRIES);

    const index: DailyHotCacheSnapshotIndex = {
      format: "zhinote-daily-hot-cache-snapshot-index",
      format_version: 1,
      route_target: "/daily",
      architecture_target: "cloud-master-local-hot-cache",
      updated_at: new Date().toISOString(),
      privacy_boundary:
        "This index stores only daily hot-cache snapshot keys, date ranges, counts, timestamps, and source labels so /daily can find overlapping browser cache snapshots without scanning every localStorage key. It does not store page bodies, editor state, database row values, comments, files, tokens, or raw cache dumps. It does not enter sync_log and is not a cloud source of truth.",
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
        scans_local_storage_keys: false,
      },
      summary: {
        entries: entries.length,
        overlapping_range_lookup: true,
      },
      entries,
    };
    storage.setItem(DAILY_HOT_CACHE_INDEX_KEY, JSON.stringify(index));
  } catch {
    // The snapshot itself remains usable via its exact key; the index is only a
    // speed hint for overlapping-range cache lookups.
  }
}

function toDailyHotCacheSnapshotIndexEntry(
  snapshot: DailyHotCacheSnapshot,
  key: string
): DailyHotCacheSnapshotIndexEntry {
  return {
    key,
    start_date: snapshot.start_date,
    end_date: snapshot.end_date,
    cached_at: snapshot.cached_at,
    source: snapshot.source,
    root_id: snapshot.root_id,
    pages: snapshot.summary.pages,
    range_pages: snapshot.summary.range_pages,
  };
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

function isDailyHotCacheSnapshotIndexShape(
  value: Partial<DailyHotCacheSnapshotIndex>
): value is DailyHotCacheSnapshotIndex {
  return (
    value.format === "zhinote-daily-hot-cache-snapshot-index" &&
    value.format_version === 1 &&
    value.route_target === "/daily" &&
    value.architecture_target === "cloud-master-local-hot-cache" &&
    typeof value.updated_at === "string" &&
    Array.isArray(value.entries)
  );
}

function isDailyHotCacheSnapshotIndexEntry(
  value: Partial<DailyHotCacheSnapshotIndexEntry>
): value is DailyHotCacheSnapshotIndexEntry {
  return (
    typeof value.key === "string" &&
    value.key.startsWith(DAILY_HOT_CACHE_PREFIX) &&
    typeof value.start_date === "string" &&
    typeof value.end_date === "string" &&
    typeof value.cached_at === "string" &&
    typeof value.pages === "number" &&
    typeof value.range_pages === "number" &&
    (value.source === "local-metadata" ||
      value.source === "local-fallback-metadata" ||
      value.source === "cloud-metadata" ||
      value.source === "optimistic-local") &&
    (typeof value.root_id === "string" || value.root_id === null)
  );
}

function isExpiredDailyHotCacheSnapshot(
  value: DailyHotCacheSnapshot
): boolean {
  return Date.now() - Date.parse(value.cached_at) > DAILY_HOT_CACHE_STALE_MS;
}

function isStaleDailyHotCacheSnapshot(value: DailyHotCacheSnapshot): boolean {
  const ageMs = Date.now() - Date.parse(value.cached_at);
  return ageMs > DAILY_HOT_CACHE_FRESH_MS;
}

function isExpiredDailyHotCacheEntry(
  value: Pick<DailyHotCacheSnapshotIndexEntry, "cached_at">
): boolean {
  return Date.now() - Date.parse(value.cached_at) > DAILY_HOT_CACHE_STALE_MS;
}

function withDailyHotCacheSnapshotFreshness(
  snapshot: DailyHotCacheSnapshot
): DailyHotCacheSnapshot {
  return {
    ...snapshot,
    stale: isStaleDailyHotCacheSnapshot(snapshot),
  };
}

function rangesOverlap(
  leftStart: string,
  leftEnd: string,
  rightStart: string,
  rightEnd: string
): boolean {
  return leftStart <= rightEnd && rightStart <= leftEnd;
}
