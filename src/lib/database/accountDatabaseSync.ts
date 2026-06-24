"use client";

// Client helper for account-scoped database cloud sync.
//
// Database sync is default-off. This keeps existing local databases private
// until an owner-facing migration/toggle explicitly enables it, while still
// letting the app use the stage-three incremental cloud ledger when approved.

import {
  applyRemoteDatabaseRecords,
  clearLocalDatabaseCacheExceptKeys,
  getAllDatabaseRecordsForSync,
  type RemoteDatabaseRecord,
} from "@/lib/db/local/queries";

const ENABLED_KEY = "zhinote.databasesync.enabled";
const LAST_SYNC_KEY = "zhinote.databasesync.lastSyncAt";
const REMOTE_CURSOR_KEY = "zhinote.databasesync.remoteCursor";
const INCREMENTAL_PULL_LIMIT = 100;
const PULL_BATCH = 80;
const PUSH_BATCH_RECORDS = 80;
const PUSH_BATCH_BYTES = 800 * 1024;

export const DATABASE_SYNC_CONFIG_EVENT = "zhinote:databasesync-config";

export type DatabaseSyncStatus =
  | "ok"
  | "unauthenticated"
  | "unconfigured"
  | "disabled"
  | "error";

export type DatabaseSyncRecordType = "database" | "field" | "row" | "view";

export type CloudDatabaseRecord = RemoteDatabaseRecord;

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

export interface PushLocalDatabasesResult {
  status: DatabaseSyncStatus;
  pushed: number;
  skipped: number;
  total: number;
  message?: string;
}

export interface DatabaseReconcileResult {
  status: DatabaseSyncStatus;
  pulled: number;
  pushed: number;
  skipped: number;
  message?: string;
}

export interface RebuildDatabaseCacheResult {
  status: DatabaseSyncStatus;
  cleared: number;
  pulled: number;
  total: number;
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

async function pushCloudDatabaseRecordsInBatches(
  records: CloudDatabaseRecord[]
): Promise<PushLocalDatabasesResult> {
  let pushed = 0;
  let skipped = 0;
  let batch: CloudDatabaseRecord[] = [];
  let batchBytes = 0;

  const flush = async (): Promise<PushCloudDatabasesResult | null> => {
    if (batch.length === 0) return null;
    const current = batch;
    batch = [];
    batchBytes = 0;
    return pushCloudDatabaseRecords(current);
  };

  for (const record of records) {
    const size = JSON.stringify(record).length;
    if (
      batch.length >= PUSH_BATCH_RECORDS ||
      (batchBytes + size > PUSH_BATCH_BYTES && batch.length > 0)
    ) {
      const result = await flush();
      if (result && result.status !== "ok") {
        return {
          status: result.status,
          pushed,
          skipped,
          total: records.length,
          message: result.message,
        };
      }
      if (result) {
        pushed += result.accepted.length;
        skipped += result.skipped.length;
      }
    }
    if (size > PUSH_BATCH_BYTES) continue;
    batch.push(record);
    batchBytes += size;
  }

  const result = await flush();
  if (result && result.status !== "ok") {
    return {
      status: result.status,
      pushed,
      skipped,
      total: records.length,
      message: result.message,
    };
  }
  if (result) {
    pushed += result.accepted.length;
    skipped += result.skipped.length;
  }
  return { status: "ok", pushed, skipped, total: records.length };
}

export async function pushLocalDatabasesToCloud(): Promise<PushLocalDatabasesResult> {
  if (!isDatabaseSyncEnabled()) {
    return { status: "disabled", pushed: 0, skipped: 0, total: 0 };
  }
  const records = await getAllDatabaseRecordsForSync();
  return pushCloudDatabaseRecordsInBatches(records);
}

export async function syncCloudDatabaseDelta(): Promise<{
  status: DatabaseSyncStatus;
  pulled: number;
  message?: string;
}> {
  if (!isDatabaseSyncEnabled()) {
    return { status: "disabled", pulled: 0 };
  }

  let cursor = getRemoteCursor();
  let pulled = 0;
  let batches = 0;
  let hasMore = false;
  do {
    const changes = await fetchCloudDatabaseChangesSince(
      cursor,
      INCREMENTAL_PULL_LIMIT
    );
    if (changes.status !== "ok") {
      return { status: changes.status, pulled, message: changes.message };
    }
    if (changes.records.length > 0) {
      await applyRemoteDatabaseRecords(changes.records);
      pulled += changes.records.length;
    }
    cursor = changes.cursor;
    hasMore = changes.hasMore;
    batches += 1;
  } while (hasMore && batches < 3);

  return { status: "ok", pulled };
}

export async function reconcileDatabaseSync(): Promise<DatabaseReconcileResult> {
  if (!isDatabaseSyncEnabled()) {
    return { status: "disabled", pulled: 0, pushed: 0, skipped: 0 };
  }
  const pull = await syncCloudDatabaseDelta();
  if (pull.status !== "ok") {
    return {
      status: pull.status,
      pulled: pull.pulled,
      pushed: 0,
      skipped: 0,
      message: pull.message,
    };
  }
  const push = await pushLocalDatabasesToCloud();
  if (push.status !== "ok") {
    return {
      status: push.status,
      pulled: pull.pulled,
      pushed: push.pushed,
      skipped: push.skipped,
      message: push.message,
    };
  }
  return {
    status: "ok",
    pulled: pull.pulled,
    pushed: push.pushed,
    skipped: push.skipped,
  };
}

export async function rebuildDatabaseCacheFromCloud(): Promise<RebuildDatabaseCacheResult> {
  if (!isDatabaseSyncEnabled()) {
    return { status: "disabled", cleared: 0, pulled: 0, total: 0 };
  }
  const manifestRes = await call({ action: "manifest" });
  if (!manifestRes.ok) {
    return {
      status: manifestRes.status,
      cleared: 0,
      pulled: 0,
      total: 0,
      message: manifestRes.message,
    };
  }
  const index =
    manifestRes.json.index && typeof manifestRes.json.index === "object"
      ? (manifestRes.json.index as Record<string, unknown>)
      : {};
  const keys = Object.keys(index).filter(isValidRecordKey);
  const prune = await clearLocalDatabaseCacheExceptKeys(keys);
  let pulled = 0;
  for (let i = 0; i < keys.length; i += PULL_BATCH) {
    const result = await fetchCloudDatabaseRecordsByKeys(
      keys.slice(i, i + PULL_BATCH)
    );
    if (result.status !== "ok") {
      return {
        status: result.status,
        cleared: prune.cleared,
        pulled,
        total: keys.length,
        message: result.message,
      };
    }
    if (result.records.length > 0) {
      await applyRemoteDatabaseRecords(result.records);
      pulled += result.records.length;
    }
  }
  setLastDatabaseSyncAtNow();
  return {
    status: "ok",
    cleared: prune.cleared,
    pulled,
    total: keys.length,
  };
}
