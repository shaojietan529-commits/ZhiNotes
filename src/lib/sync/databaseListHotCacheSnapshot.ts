import type { Database } from "@/lib/utils/types";

const DATABASE_LIST_HOT_CACHE_KEY =
  "zhinote.databaseList.hotCacheSnapshot.v1";
const DATABASE_LIST_HOT_CACHE_FRESH_MS = 24 * 60 * 60 * 1000;
const DATABASE_LIST_HOT_CACHE_STALE_MS = 7 * 24 * 60 * 60 * 1000;
const DATABASE_LIST_HOT_CACHE_MAX_DATABASES = 300;

export interface DatabaseListHotCacheSnapshotDatabase {
  id: string;
  owner_id: string;
  parent_page_id: string | null;
  title: string;
  icon: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DatabaseListHotCacheSnapshot {
  format: "zhinote-database-list-hot-cache-snapshot";
  format_version: 1;
  route_target: "global-database-list";
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
    reads_database_field_configs: false;
    reads_database_view_configs: false;
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
    databases: number;
    parent_linked_databases: number;
  };
  databases: DatabaseListHotCacheSnapshotDatabase[];
}

export function readDatabaseListHotCacheSnapshot(): DatabaseListHotCacheSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DATABASE_LIST_HOT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DatabaseListHotCacheSnapshot>;
    if (!isDatabaseListHotCacheSnapshotShape(parsed)) return null;
    if (isExpiredDatabaseListHotCacheSnapshot(parsed)) return null;
    return withDatabaseListHotCacheSnapshotFreshness(parsed);
  } catch {
    return null;
  }
}

export function writeDatabaseListHotCacheSnapshot(input: {
  databases: Database[];
  source: DatabaseListHotCacheSnapshot["source"];
}): DatabaseListHotCacheSnapshot | null {
  if (typeof window === "undefined") return null;
  const selectedDatabases = selectDatabaseListHotCacheDatabases(input.databases);
  if (selectedDatabases.length === 0) {
    clearDatabaseListHotCacheSnapshot();
    return null;
  }

  const snapshotDatabases = selectedDatabases.map(toSnapshotDatabase);
  const snapshot: DatabaseListHotCacheSnapshot = {
    format: "zhinote-database-list-hot-cache-snapshot",
    format_version: 1,
    route_target: "global-database-list",
    architecture_target: "cloud-master-local-hot-cache",
    source: input.source,
    cached_at: new Date().toISOString(),
    privacy_boundary:
      "This snapshot stores database-list metadata for fast first paint only: ids, titles, icons, descriptions, parent page ids, and timestamps. It does not store fields, views, row values, formulas, rollups, page bodies, comments, files, tokens, or raw cache dumps. It does not enter sync_log and is not a cloud source of truth.",
    boundary: {
      reads_page_body_text: false,
      reads_page_yjs: false,
      reads_database_row_values: false,
      reads_database_field_configs: false,
      reads_database_view_configs: false,
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
      databases: snapshotDatabases.length,
      parent_linked_databases: snapshotDatabases.filter(
        (database) => database.parent_page_id !== null
      ).length,
    },
    databases: snapshotDatabases,
  };

  try {
    if (!shouldWriteDatabaseListHotCacheSnapshot(snapshot)) return snapshot;
    window.localStorage.setItem(
      DATABASE_LIST_HOT_CACHE_KEY,
      JSON.stringify(snapshot)
    );
    return snapshot;
  } catch {
    return null;
  }
}

export function databaseListHotCacheSnapshotDatabaseToDatabase(
  database: DatabaseListHotCacheSnapshotDatabase
): Database {
  return {
    id: database.id,
    owner_id: database.owner_id,
    parent_page_id: database.parent_page_id,
    title: database.title,
    icon: database.icon,
    description: database.description,
    created_at: database.created_at,
    updated_at: database.updated_at,
    deleted_at: database.deleted_at,
    sync_version: 0,
  };
}

function selectDatabaseListHotCacheDatabases(databases: Database[]): Database[] {
  return databases
    .filter((database) => !database.deleted_at)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, DATABASE_LIST_HOT_CACHE_MAX_DATABASES);
}

function toSnapshotDatabase(
  database: Database
): DatabaseListHotCacheSnapshotDatabase {
  return {
    id: database.id,
    owner_id: database.owner_id,
    parent_page_id: database.parent_page_id,
    title: database.title,
    icon: database.icon,
    description: database.description,
    created_at: database.created_at,
    updated_at: database.updated_at,
    deleted_at: database.deleted_at,
  };
}

function shouldWriteDatabaseListHotCacheSnapshot(
  snapshot: DatabaseListHotCacheSnapshot
): boolean {
  const current = readDatabaseListHotCacheSnapshotForWrite();
  if (!current) return true;
  if (isStaleDatabaseListHotCacheSnapshot(current)) return true;
  return (
    buildDatabaseListHotCacheSnapshotSignature(current) !==
    buildDatabaseListHotCacheSnapshotSignature(snapshot)
  );
}

function readDatabaseListHotCacheSnapshotForWrite(): DatabaseListHotCacheSnapshot | null {
  try {
    const raw = window.localStorage.getItem(DATABASE_LIST_HOT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DatabaseListHotCacheSnapshot>;
    if (!isDatabaseListHotCacheSnapshotShape(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function clearDatabaseListHotCacheSnapshot(): void {
  try {
    window.localStorage.removeItem(DATABASE_LIST_HOT_CACHE_KEY);
  } catch {
    // This is only a rebuildable first-paint cache.
  }
}

function buildDatabaseListHotCacheSnapshotSignature(
  snapshot: DatabaseListHotCacheSnapshot
): string {
  return JSON.stringify(stableDatabaseListHotCacheSnapshotValue(snapshot));
}

function stableDatabaseListHotCacheSnapshotValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stableDatabaseListHotCacheSnapshotValue(item));
  }
  if (!value || typeof value !== "object") return value;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    if (key === "cached_at" || key === "stale") continue;
    const nextValue = (value as Record<string, unknown>)[key];
    if (typeof nextValue !== "undefined") {
      result[key] = stableDatabaseListHotCacheSnapshotValue(nextValue);
    }
  }
  return result;
}

function isDatabaseListHotCacheSnapshotShape(
  value: Partial<DatabaseListHotCacheSnapshot>
): value is DatabaseListHotCacheSnapshot {
  return (
    value.format === "zhinote-database-list-hot-cache-snapshot" &&
    value.format_version === 1 &&
    value.route_target === "global-database-list" &&
    value.architecture_target === "cloud-master-local-hot-cache" &&
    typeof value.cached_at === "string" &&
    Array.isArray(value.databases)
  );
}

function isExpiredDatabaseListHotCacheSnapshot(
  value: DatabaseListHotCacheSnapshot
): boolean {
  return (
    Date.now() - Date.parse(value.cached_at) >
    DATABASE_LIST_HOT_CACHE_STALE_MS
  );
}

function isStaleDatabaseListHotCacheSnapshot(
  value: DatabaseListHotCacheSnapshot
): boolean {
  const ageMs = Date.now() - Date.parse(value.cached_at);
  return ageMs > DATABASE_LIST_HOT_CACHE_FRESH_MS;
}

function withDatabaseListHotCacheSnapshotFreshness(
  snapshot: DatabaseListHotCacheSnapshot
): DatabaseListHotCacheSnapshot {
  return {
    ...snapshot,
    stale: isStaleDatabaseListHotCacheSnapshot(snapshot),
  };
}
