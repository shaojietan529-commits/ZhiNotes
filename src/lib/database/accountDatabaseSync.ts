"use client";

// Client helper for account-scoped database cloud sync.
//
// Database sync is default-off. This keeps existing local databases private
// until an owner-facing migration/toggle explicitly enables it, while still
// letting the app use the stage-three incremental cloud ledger when approved.

const ENABLED_KEY = "zhinote.databasesync.enabled";
const LAST_SYNC_KEY = "zhinote.databasesync.lastSyncAt";
const REMOTE_CURSOR_KEY = "zhinote.databasesync.remoteCursor";
const INCREMENTAL_PULL_LIMIT = 100;

export const DATABASE_SYNC_CONFIG_EVENT = "zhinote:databasesync-config";

export type DatabaseSyncStatus =
  | "ok"
  | "unauthenticated"
  | "unconfigured"
  | "disabled"
  | "error";

export type DatabaseSyncRecordType = "database" | "field" | "row" | "view";

export interface CloudDatabaseRecord {
  type: DatabaseSyncRecordType;
  id: string;
  database_id: string | null;
  parent_page_id: string | null;
  page_id: string | null;
  owner_id: string;
  title: string | null;
  icon: string | null;
  description: string | null;
  name: string | null;
  field_type: string | null;
  view_type: string | null;
  config: string | null;
  field_values: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DatabaseSyncIndexSummary {
  count: number;
  deleted: number;
  maxUpdatedAt: string;
  watermark: string;
  cursor: string;
}

export interface CloudDatabaseChangesResult {
  status: DatabaseSyncStatus;
  records: CloudDatabaseRecord[];
  count: number;
  totalChanged: number;
  cursor: string;
  hasMore: boolean;
  summary?: DatabaseSyncIndexSummary;
  message?: string;
}

export interface CloudDatabaseLookupResult {
  status: DatabaseSyncStatus;
  records: CloudDatabaseRecord[];
  message?: string;
}

export interface PushCloudDatabasesResult {
  status: DatabaseSyncStatus;
  accepted: string[];
  skipped: string[];
  message?: string;
}

export function isDatabaseSyncEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(ENABLED_KEY) === "true";
}

export function setDatabaseSyncEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ENABLED_KEY, String(enabled));
  window.dispatchEvent(new CustomEvent(DATABASE_SYNC_CONFIG_EVENT));
}

export function getLastDatabaseSyncAt(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(LAST_SYNC_KEY);
}

function setLastDatabaseSyncAtNow(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
}

function getRemoteCursor(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(REMOTE_CURSOR_KEY) ?? "";
}

function setRemoteCursor(cursor: string): void {
  if (typeof window === "undefined" || !cursor) return;
  window.localStorage.setItem(REMOTE_CURSOR_KEY, cursor);
}

function isValidRecordKey(value: string): boolean {
  if (value.length < 3 || value.length > 140) return false;
  const [type, id, extra] = value.split(":");
  return (
    !extra &&
    ["database", "field", "row", "view"].includes(type) &&
    id.length > 0 &&
    id.length <= 64 &&
    /^[A-Za-z0-9_-]+$/.test(id)
  );
}

function normalizeSummary(value: unknown): DatabaseSyncIndexSummary | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (
    typeof raw.count !== "number" ||
    typeof raw.deleted !== "number" ||
    typeof raw.maxUpdatedAt !== "string" ||
    typeof raw.watermark !== "string" ||
    typeof raw.cursor !== "string"
  ) {
    return null;
  }
  return {
    count: raw.count,
    deleted: raw.deleted,
    maxUpdatedAt: raw.maxUpdatedAt,
    watermark: raw.watermark,
    cursor: raw.cursor,
  };
}

async function call(body: Record<string, unknown>): Promise<
  | { ok: true; json: Record<string, unknown> }
  | { ok: false; status: DatabaseSyncStatus; message?: string }
> {
  if (!isDatabaseSyncEnabled()) {
    return { ok: false, status: "disabled" };
  }
  try {
    const res = await fetch("/api/databases/account-sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 501) return { ok: false, status: "unconfigured" };
    if (res.status === 401) return { ok: false, status: "unauthenticated" };
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        status: "error",
        message: typeof json.error === "string" ? json.error : undefined,
      };
    }
    return { ok: true, json };
  } catch {
    return { ok: false, status: "error", message: "网络错误" };
  }
}

export async function fetchCloudDatabaseRecordsByKeys(
  keys: string[]
): Promise<CloudDatabaseLookupResult> {
  const uniqueKeys = Array.from(new Set(keys.filter(isValidRecordKey)));
  if (uniqueKeys.length === 0) {
    return { status: "ok", records: [] };
  }
  const res = await call({ action: "pull", keys: uniqueKeys });
  if (!res.ok) {
    return { status: res.status, records: [], message: res.message };
  }
  const records = Array.isArray(res.json.records)
    ? (res.json.records as CloudDatabaseRecord[])
    : [];
  setLastDatabaseSyncAtNow();
  return { status: "ok", records };
}

export async function fetchCloudDatabaseChangesSince(
  since = getRemoteCursor(),
  limit = INCREMENTAL_PULL_LIMIT
): Promise<CloudDatabaseChangesResult> {
  const res = await call({ action: "changes-since", since, limit });
  if (!res.ok) {
    return {
      status: res.status,
      records: [],
      count: 0,
      totalChanged: 0,
      cursor: since,
      hasMore: false,
      message: res.message,
    };
  }
  const summary = normalizeSummary(res.json.summary);
  const cursor = typeof res.json.cursor === "string" ? res.json.cursor : since;
  if (cursor) setRemoteCursor(cursor);
  setLastDatabaseSyncAtNow();
  return {
    status: "ok",
    records: Array.isArray(res.json.records)
      ? (res.json.records as CloudDatabaseRecord[])
      : [],
    count: typeof res.json.count === "number" ? res.json.count : 0,
    totalChanged:
      typeof res.json.totalChanged === "number" ? res.json.totalChanged : 0,
    cursor,
    hasMore: Boolean(res.json.hasMore),
    summary: summary ?? undefined,
  };
}

export async function pushCloudDatabaseRecords(
  records: CloudDatabaseRecord[]
): Promise<PushCloudDatabasesResult> {
  const res = await call({ action: "push", records });
  if (!res.ok) {
    return {
      status: res.status,
      accepted: [],
      skipped: [],
      message: res.message,
    };
  }
  const accepted = Array.isArray(res.json.accepted)
    ? (res.json.accepted as string[])
    : [];
  const skipped = Array.isArray(res.json.skipped)
    ? (res.json.skipped as string[])
    : [];
  setLastDatabaseSyncAtNow();
  return { status: "ok", accepted, skipped };
}
