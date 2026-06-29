import {
  createPageProperty,
  parsePageProperties,
  stringifyPageProperties,
} from "@/lib/pages/pageProperties";
import { DEFAULT_OWNER_ID } from "@/lib/utils/id";
import type { Page } from "@/lib/utils/types";

const MEETING_HOT_CACHE_PREFIX = "zhinote.meeting.hotCacheSnapshot.";
const MEETING_HOT_CACHE_INDEX_KEY = "zhinote.meeting.hotCacheSnapshot.index.v1";
const MEETING_HOT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MEETING_HOT_CACHE_MAX_PAGES = 500;
const MEETING_HOT_CACHE_OVERLAP_MAX_SNAPSHOTS = 6;
const MEETING_HOT_CACHE_INDEX_MAX_ENTRIES = 120;

const SAFE_MEETING_PROPERTY_NAMES = new Set([
  "日期",
  "时间",
  "平台",
  "组织者",
  "导入来源",
  "解析置信度",
  "录制设备",
  "默认回退设备",
  "转写模型",
  "会议优先级",
  "录制任务",
  "会议痕迹",
  "时间状态",
  "录制状态",
  "录制链路",
]);

export interface MeetingHotCacheSnapshotPage {
  id: string;
  parent_id: string | null;
  title: string;
  icon: string | null;
  cover_url: string | null;
  properties: string | null;
  meeting_date_key: string;
  position: number;
  depth: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface MeetingHotCacheSnapshot {
  format: "zhinote-meeting-hot-cache-snapshot";
  format_version: 1;
  route_target: "/schedule";
  architecture_target: "cloud-master-local-hot-cache";
  source: "local-metadata" | "cloud-metadata" | "optimistic-local";
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
    stores_join_url: false;
    stores_meeting_id: false;
    stores_passcode: false;
  };
  summary: {
    pages: number;
    range_pages: number;
  };
  pages: MeetingHotCacheSnapshotPage[];
}

interface MeetingHotCacheSnapshotIndexEntry {
  key: string;
  start_date: string;
  end_date: string;
  cached_at: string;
  source: MeetingHotCacheSnapshot["source"];
  root_id: string | null;
  pages: number;
  range_pages: number;
}

interface MeetingHotCacheSnapshotIndex {
  format: "zhinote-meeting-hot-cache-snapshot-index";
  format_version: 1;
  route_target: "/schedule";
  architecture_target: "cloud-master-local-hot-cache";
  updated_at: string;
  privacy_boundary: string;
  boundary: MeetingHotCacheSnapshot["boundary"] & {
    scans_local_storage_keys: false;
  };
  summary: {
    entries: number;
    overlapping_range_lookup: true;
  };
  entries: MeetingHotCacheSnapshotIndexEntry[];
}

export function readMeetingHotCacheSnapshot(
  startDate: string,
  endDate: string
): MeetingHotCacheSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(
      meetingHotCacheSnapshotKey(startDate, endDate)
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MeetingHotCacheSnapshot>;
    if (!isValidMeetingHotCacheSnapshot(parsed, startDate, endDate)) {
      return null;
    }
    if (Date.now() - Date.parse(parsed.cached_at) > MEETING_HOT_CACHE_TTL_MS) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function readMeetingHotCacheSnapshotsForRange(
  startDate: string,
  endDate: string
): MeetingHotCacheSnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const storage = window.localStorage;
    const index = readMeetingHotCacheSnapshotIndex(storage);
    if (!index) return [];

    const snapshots: MeetingHotCacheSnapshot[] = [];
    for (const entry of index.entries) {
      if (!rangesOverlap(entry.start_date, entry.end_date, startDate, endDate)) {
        continue;
      }
      const raw = storage.getItem(entry.key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as Partial<MeetingHotCacheSnapshot>;
      if (!isMeetingHotCacheSnapshotShape(parsed)) continue;
      if (isExpiredMeetingHotCacheSnapshot(parsed)) continue;
      if (!rangesOverlap(parsed.start_date, parsed.end_date, startDate, endDate)) {
        continue;
      }
      snapshots.push(parsed);
    }

    return snapshots
      .sort((a, b) => b.cached_at.localeCompare(a.cached_at))
      .slice(0, MEETING_HOT_CACHE_OVERLAP_MAX_SNAPSHOTS);
  } catch {
    return [];
  }
}

export function writeMeetingHotCacheSnapshot(input: {
  startDate: string;
  endDate: string;
  rootId: string | null;
  pages: Page[];
  source: MeetingHotCacheSnapshot["source"];
}): MeetingHotCacheSnapshot | null {
  if (typeof window === "undefined") return null;
  const snapshotPages = input.pages
    .map(toSnapshotPage)
    .filter((page): page is MeetingHotCacheSnapshotPage => Boolean(page))
    .slice(0, MEETING_HOT_CACHE_MAX_PAGES);
  if (snapshotPages.length === 0) return null;

  const snapshot: MeetingHotCacheSnapshot = {
    format: "zhinote-meeting-hot-cache-snapshot",
    format_version: 1,
    route_target: "/schedule",
    architecture_target: "cloud-master-local-hot-cache",
    source: input.source,
    root_id: input.rootId,
    start_date: input.startDate,
    end_date: input.endDate,
    cached_at: new Date().toISOString(),
    privacy_boundary:
      "This snapshot stores meeting-calendar metadata for fast first paint only: ids, titles, icons, date/time labels, display properties, hierarchy, ordering, and timestamps. It does not store page bodies, editor state, join URLs, meeting ids, passcodes, database row values, comments, files, tokens, or raw cache dumps. It does not enter sync_log and is not a cloud source of truth.",
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
      stores_join_url: false,
      stores_meeting_id: false,
      stores_passcode: false,
    },
    summary: {
      pages: snapshotPages.length,
      range_pages: snapshotPages.filter(
        (page) =>
          page.meeting_date_key >= input.startDate &&
          page.meeting_date_key <= input.endDate
      ).length,
    },
    pages: snapshotPages,
  };

  try {
    const key = meetingHotCacheSnapshotKey(input.startDate, input.endDate);
    window.localStorage.setItem(key, JSON.stringify(snapshot));
    writeMeetingHotCacheSnapshotIndex(window.localStorage, snapshot, key);
    return snapshot;
  } catch {
    return null;
  }
}

export function meetingHotCacheSnapshotPageToPage(
  page: MeetingHotCacheSnapshotPage
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

function meetingHotCacheSnapshotKey(startDate: string, endDate: string): string {
  return `${MEETING_HOT_CACHE_PREFIX}${startDate}:${endDate}:v1`;
}

function readMeetingHotCacheSnapshotIndex(
  storage: Storage
): MeetingHotCacheSnapshotIndex | null {
  try {
    const raw = storage.getItem(MEETING_HOT_CACHE_INDEX_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MeetingHotCacheSnapshotIndex>;
    if (!isMeetingHotCacheSnapshotIndexShape(parsed)) return null;
    const entries = parsed.entries
      .filter(isMeetingHotCacheSnapshotIndexEntry)
      .filter((entry) => !isExpiredMeetingHotCacheEntry(entry))
      .slice(0, MEETING_HOT_CACHE_INDEX_MAX_ENTRIES);
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

function writeMeetingHotCacheSnapshotIndex(
  storage: Storage,
  snapshot: MeetingHotCacheSnapshot,
  key: string
): void {
  try {
    const current = readMeetingHotCacheSnapshotIndex(storage);
    const entries = [
      toMeetingHotCacheSnapshotIndexEntry(snapshot, key),
      ...(current?.entries ?? []).filter((entry) => entry.key !== key),
    ]
      .filter((entry) => !isExpiredMeetingHotCacheEntry(entry))
      .sort((a, b) => b.cached_at.localeCompare(a.cached_at))
      .slice(0, MEETING_HOT_CACHE_INDEX_MAX_ENTRIES);

    const index: MeetingHotCacheSnapshotIndex = {
      format: "zhinote-meeting-hot-cache-snapshot-index",
      format_version: 1,
      route_target: "/schedule",
      architecture_target: "cloud-master-local-hot-cache",
      updated_at: new Date().toISOString(),
      privacy_boundary:
        "This index stores only meeting hot-cache snapshot keys, date ranges, counts, timestamps, and source labels so /schedule can find overlapping browser cache snapshots without scanning every localStorage key. It does not store meeting bodies, join URLs, meeting ids, passcodes, file text, tokens, or raw cache dumps. It does not enter sync_log and is not a cloud source of truth.",
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
        stores_join_url: false,
        stores_meeting_id: false,
        stores_passcode: false,
        scans_local_storage_keys: false,
      },
      summary: {
        entries: entries.length,
        overlapping_range_lookup: true,
      },
      entries,
    };
    storage.setItem(MEETING_HOT_CACHE_INDEX_KEY, JSON.stringify(index));
  } catch {
    // The exact range snapshot remains usable; the index only speeds up
    // overlapping-range first paint after refreshes and month changes.
  }
}

function toMeetingHotCacheSnapshotIndexEntry(
  snapshot: MeetingHotCacheSnapshot,
  key: string
): MeetingHotCacheSnapshotIndexEntry {
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

function toSnapshotPage(page: Page): MeetingHotCacheSnapshotPage | null {
  const properties = sanitizeMeetingProperties(page.properties);
  const dateKey = readDateKeyFromProperties(properties);
  if (!dateKey) return null;
  return {
    id: page.id,
    parent_id: page.parent_id,
    title: page.title,
    icon: page.icon,
    cover_url: page.cover_url,
    properties,
    meeting_date_key: dateKey,
    position: page.position,
    depth: page.depth,
    created_at: page.created_at,
    updated_at: page.updated_at,
    deleted_at: page.deleted_at,
  };
}

function sanitizeMeetingProperties(properties: string | null): string | null {
  const safe = parsePageProperties(properties)
    .filter((property) => SAFE_MEETING_PROPERTY_NAMES.has(property.name))
    .map((property) => ({
      ...createPageProperty(property.type, property.name),
      value: property.value,
      options: property.options,
    }));
  return safe.length > 0 ? stringifyPageProperties(safe) : null;
}

function readDateKeyFromProperties(properties: string | null): string {
  if (!properties) return "";
  const date = parsePageProperties(properties).find(
    (property) => property.name === "日期"
  )?.value;
  return date && /^\d{4}-\d{2}-\d{2}/.test(date) ? date.slice(0, 10) : "";
}

function isValidMeetingHotCacheSnapshot(
  value: Partial<MeetingHotCacheSnapshot>,
  startDate: string,
  endDate: string
): value is MeetingHotCacheSnapshot {
  return (
    isMeetingHotCacheSnapshotShape(value) &&
    value.start_date === startDate &&
    value.end_date === endDate
  );
}

function isMeetingHotCacheSnapshotShape(
  value: Partial<MeetingHotCacheSnapshot>
): value is MeetingHotCacheSnapshot {
  return (
    value.format === "zhinote-meeting-hot-cache-snapshot" &&
    value.format_version === 1 &&
    value.route_target === "/schedule" &&
    typeof value.start_date === "string" &&
    typeof value.end_date === "string" &&
    typeof value.cached_at === "string" &&
    Array.isArray(value.pages)
  );
}

function isMeetingHotCacheSnapshotIndexShape(
  value: Partial<MeetingHotCacheSnapshotIndex>
): value is MeetingHotCacheSnapshotIndex {
  return (
    value.format === "zhinote-meeting-hot-cache-snapshot-index" &&
    value.format_version === 1 &&
    value.route_target === "/schedule" &&
    value.architecture_target === "cloud-master-local-hot-cache" &&
    typeof value.updated_at === "string" &&
    Array.isArray(value.entries)
  );
}

function isMeetingHotCacheSnapshotIndexEntry(
  value: Partial<MeetingHotCacheSnapshotIndexEntry>
): value is MeetingHotCacheSnapshotIndexEntry {
  return (
    typeof value.key === "string" &&
    value.key.startsWith(MEETING_HOT_CACHE_PREFIX) &&
    typeof value.start_date === "string" &&
    typeof value.end_date === "string" &&
    typeof value.cached_at === "string" &&
    typeof value.pages === "number" &&
    typeof value.range_pages === "number" &&
    (value.source === "local-metadata" ||
      value.source === "cloud-metadata" ||
      value.source === "optimistic-local") &&
    (typeof value.root_id === "string" || value.root_id === null)
  );
}

function isExpiredMeetingHotCacheSnapshot(
  value: MeetingHotCacheSnapshot
): boolean {
  return Date.now() - Date.parse(value.cached_at) > MEETING_HOT_CACHE_TTL_MS;
}

function isExpiredMeetingHotCacheEntry(
  value: Pick<MeetingHotCacheSnapshotIndexEntry, "cached_at">
): boolean {
  return Date.now() - Date.parse(value.cached_at) > MEETING_HOT_CACHE_TTL_MS;
}

function rangesOverlap(
  leftStart: string,
  leftEnd: string,
  rightStart: string,
  rightEnd: string
): boolean {
  return leftStart <= rightEnd && rightStart <= leftEnd;
}
