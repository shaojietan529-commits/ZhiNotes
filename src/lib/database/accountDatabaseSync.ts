"use client";

// Client helper for account-scoped database cloud sync.
//
// Database sync is default-on for signed-in browsers. The cloud copy is the
// account database ledger; local SQLite is only a rebuildable cache and can be
// opted out from /account when needed.

import {
  applyRemoteDatabaseRecords,
  clearLocalDatabaseCacheExceptKeys,
  getAllDatabaseRecordsForSync,
  getDatabaseRecordsForSyncByKeys,
  getLocalDatabaseSyncSummary,
  getPendingDatabaseSyncRecords,
  getRemoteDatabaseRecordKey,
  markDatabaseSyncLogEntriesSynced,
  type RemoteDatabaseRecord,
} from "@/lib/db/local/queries";
import {
  emitDatabasesUpdated,
  type DatabaseUpdatePayload,
} from "@/lib/database/databaseUpdateBus";
import type { Database } from "@/lib/utils/types";

const ENABLED_KEY = "zhinote.databasesync.enabled";
const LAST_SYNC_KEY = "zhinote.databasesync.lastSyncAt";
const REMOTE_CURSOR_KEY = "zhinote.databasesync.remoteCursor";
const PENDING_PUSH_KEYS_KEY = "zhinote.databasesync.pendingPushKeys";
const AUTH_RETRY_KEY = "zhinote.databasesync.authRetry.v1";
const INCREMENTAL_PULL_LIMIT = 100;
const QUICK_INCREMENTAL_BATCH_LIMIT = 3;
const PULL_BATCH = 80;
const PUSH_BATCH_RECORDS = 80;
const PUSH_BATCH_BYTES = 800 * 1024;
const CLOUD_DATABASE_PUSH_DEBOUNCE_MS = 1000;
const AUTH_RETRY_BACKOFF_MS = 2 * 60 * 1000;
const METADATA_DELTA_THROTTLE_MS = 2500;

let queuedCloudDatabasePush = new Map<string, CloudDatabaseRecord>();
let queuedCloudDatabasePushTimer: ReturnType<typeof setTimeout> | null = null;
let databaseMetadataDeltaInFlight: Promise<CloudDatabaseMetadataDeltaResult> | null = null;
let lastDatabaseMetadataDeltaAt = 0;
let lastDatabaseMetadataDeltaResult: CloudDatabaseMetadataDeltaResult | null = null;
let authRetryAfter = 0;
let authRetryStatus: DatabaseSyncStatus | null = null;
let memoryDatabaseRemoteCursor = "";
let memoryLastDatabaseSyncAt: string | null = null;

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

export interface CloudDatabaseMetadataResult {
  status: DatabaseSyncStatus;
  records: CloudDatabaseRecord[];
  count: number;
  total: number;
  summary?: DatabaseSyncIndexSummary;
  message?: string;
}

export interface CloudDatabaseMetadataDeltaResult {
  status: DatabaseSyncStatus;
  pulled: number;
  total: number;
  records: CloudDatabaseRecord[];
  fullRefresh: boolean;
  cacheWriteFailed?: boolean;
  message?: string;
}

export interface CloudDatabaseRecordsResult {
  status: DatabaseSyncStatus;
  records: CloudDatabaseRecord[];
  count: number;
  total: number;
  offset: number;
  nextOffset: number | null;
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
  marked?: number;
  acceptedKeys?: string[];
  skippedKeys?: string[];
  message?: string;
}

export interface DatabaseReconcileResult {
  status: DatabaseSyncStatus;
  pulled: number;
  pushed: number;
  skipped: number;
  records?: CloudDatabaseRecord[];
  message?: string;
}

export interface DatabaseReconcileOptions {
  quick?: boolean;
}

interface SyncCloudDatabaseMetadataOptions {
  restoreLocalCursor?: boolean;
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
  return readSyncStorage(ENABLED_KEY) !== "false";
}

export function setDatabaseSyncEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  authRetryStatus = null;
  authRetryAfter = 0;
  writeSyncStorage(ENABLED_KEY, String(enabled));
  window.dispatchEvent(new CustomEvent(DATABASE_SYNC_CONFIG_EVENT));
}

function readSyncStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSyncStorage(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Cloud records are authoritative; browser storage is only a cache.
  }
}

function removeSyncStorage(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Best-effort cache cleanup only.
  }
}

export function getLastDatabaseSyncAt(): string | null {
  return readSyncStorage(LAST_SYNC_KEY) ?? memoryLastDatabaseSyncAt;
}

function setLastDatabaseSyncAtNow(): void {
  const iso = new Date().toISOString();
  memoryLastDatabaseSyncAt = iso;
  writeSyncStorage(LAST_SYNC_KEY, iso);
}

function getRemoteCursor(): string {
  return readSyncStorage(REMOTE_CURSOR_KEY) ?? memoryDatabaseRemoteCursor;
}

function setRemoteCursor(cursor: string): void {
  if (!cursor) return;
  memoryDatabaseRemoteCursor = cursor;
  writeSyncStorage(REMOTE_CURSOR_KEY, cursor);
}

async function restoreCursorFromLocalDatabaseMetadata(
  remoteSummary: DatabaseSyncIndexSummary
): Promise<boolean> {
  try {
    const localSummary = await getLocalDatabaseSyncSummary();
    if (
      localSummary.watermark !== remoteSummary.watermark ||
      localSummary.cursor !== remoteSummary.cursor
    ) {
      return false;
    }
    setRemoteCursor(remoteSummary.cursor);
    setLastDatabaseSyncAtNow();
    return true;
  } catch {
    return false;
  }
}

function getPendingCloudDatabasePushKeys(): string[] {
  try {
    const parsed = JSON.parse(
      readSyncStorage(PENDING_PUSH_KEYS_KEY) ?? "[]"
    ) as unknown;
    if (!Array.isArray(parsed)) return [];
    return Array.from(
      new Set(parsed.filter((key): key is string => isValidRecordKey(key)))
    );
  } catch {
    return [];
  }
}

function setPendingCloudDatabasePushKeys(keys: string[]): void {
  const uniqueKeys = Array.from(new Set(keys.filter(isValidRecordKey)));
  writeSyncStorage(PENDING_PUSH_KEYS_KEY, JSON.stringify(uniqueKeys));
}

function markPendingCloudDatabasePushKey(key: string): void {
  if (!isValidRecordKey(key)) return;
  setPendingCloudDatabasePushKeys([...getPendingCloudDatabasePushKeys(), key]);
}

function clearPendingCloudDatabasePushKeys(keys: string[]): void {
  if (keys.length === 0) return;
  const acknowledged = new Set(keys.filter(isValidRecordKey));
  if (acknowledged.size === 0) return;
  setPendingCloudDatabasePushKeys(
    getPendingCloudDatabasePushKeys().filter((key) => !acknowledged.has(key))
  );
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

function isValidDatabaseId(value: string): boolean {
  return value.length > 0 && value.length <= 64 && /^[A-Za-z0-9_-]+$/.test(value);
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
  if (shouldBackOffAuthRetry()) {
    return {
      ok: false,
      status: authRetryStatus ?? "unauthenticated",
    };
  }
  try {
    const res = await fetch("/api/databases/account-sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 501) {
      rememberAuthRetryStatus("unconfigured");
      return { ok: false, status: "unconfigured" };
    }
    if (res.status === 401) {
      rememberAuthRetryStatus("unauthenticated");
      return { ok: false, status: "unauthenticated" };
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        status: "error",
        message: typeof json.error === "string" ? json.error : undefined,
      };
    }
    rememberAuthRetryStatus("ok");
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

export async function fetchCloudDatabaseRecordsByDatabaseId(
  databaseId: string,
  offset = 0,
  limit = PULL_BATCH
): Promise<CloudDatabaseRecordsResult> {
  if (!isValidDatabaseId(databaseId)) {
    return {
      status: "error",
      records: [],
      count: 0,
      total: 0,
      offset,
      nextOffset: null,
      hasMore: false,
      message: "databaseId 无效",
    };
  }
  const res = await call({
    action: "database-records",
    databaseId,
    offset,
    limit,
  });
  if (!res.ok) {
    return {
      status: res.status,
      records: [],
      count: 0,
      total: 0,
      offset,
      nextOffset: null,
      hasMore: false,
      message: res.message,
    };
  }
  const summary = normalizeSummary(res.json.summary);
  if (summary?.cursor) setRemoteCursor(summary.cursor);
  setLastDatabaseSyncAtNow();
  const records = Array.isArray(res.json.records)
    ? (res.json.records as CloudDatabaseRecord[])
    : [];
  return {
    status: "ok",
    records,
    count: typeof res.json.count === "number" ? res.json.count : records.length,
    total: typeof res.json.total === "number" ? res.json.total : records.length,
    offset: typeof res.json.offset === "number" ? res.json.offset : offset,
    nextOffset:
      typeof res.json.nextOffset === "number" ? res.json.nextOffset : null,
    hasMore: Boolean(res.json.hasMore),
    summary: summary ?? undefined,
  };
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

export async function fetchCloudDatabaseMetadata(
  limit = PULL_BATCH
): Promise<CloudDatabaseMetadataResult> {
  const res = await call({ action: "database-metadata", limit });
  if (!res.ok) {
    return {
      status: res.status,
      records: [],
      count: 0,
      total: 0,
      message: res.message,
    };
  }
  const summary = normalizeSummary(res.json.summary);
  if (summary?.cursor) setRemoteCursor(summary.cursor);
  setLastDatabaseSyncAtNow();
  const records = Array.isArray(res.json.records)
    ? (res.json.records as CloudDatabaseRecord[])
    : [];
  return {
    status: "ok",
    records,
    count: typeof res.json.count === "number" ? res.json.count : records.length,
    total: typeof res.json.total === "number" ? res.json.total : records.length,
    summary: summary ?? undefined,
  };
}

export async function syncCloudDatabaseMetadata(
  options: SyncCloudDatabaseMetadataOptions = {}
): Promise<{
  status: DatabaseSyncStatus;
  pulled: number;
  total: number;
  records: CloudDatabaseRecord[];
  cacheWriteFailed?: boolean;
  message?: string;
}> {
  if (!isDatabaseSyncEnabled()) {
    return { status: "disabled", pulled: 0, total: 0, records: [] };
  }
  if (shouldBackOffAuthRetry()) {
    return {
      status: authRetryStatus ?? "unauthenticated",
      pulled: 0,
      total: 0,
      records: [],
    };
  }
  if (options.restoreLocalCursor && !getRemoteCursor()) {
    const summaryRes = await call({ action: "summary" });
    if (summaryRes.ok) {
      const summary = normalizeSummary(summaryRes.json.summary);
      if (summary && (await restoreCursorFromLocalDatabaseMetadata(summary))) {
        return {
          status: "ok",
          pulled: 0,
          total: summary.count,
          records: [],
        };
      }
    } else if (
      summaryRes.status === "unauthenticated" ||
      summaryRes.status === "unconfigured"
    ) {
      rememberAuthRetryStatus(summaryRes.status);
      return {
        status: summaryRes.status,
        pulled: 0,
        total: 0,
        records: [],
        message: summaryRes.message,
      };
    }
  }
  const metadata = await fetchCloudDatabaseMetadata();
  rememberAuthRetryStatus(metadata.status);
  if (metadata.status !== "ok") {
    return {
      status: metadata.status,
      pulled: 0,
      total: 0,
      records: [],
      message: metadata.message,
    };
  }
  let cacheWriteFailed = false;
  if (metadata.records.length > 0) {
    try {
      await applyRemoteDatabaseRecords(metadata.records);
    } catch {
      cacheWriteFailed = true;
    }
  }
  return {
    status: "ok",
    pulled: metadata.records.length,
    total: metadata.total,
    records: metadata.records,
    cacheWriteFailed,
  };
}

export async function syncCloudDatabaseMetadataDelta(
  options: SyncCloudDatabaseMetadataOptions = {}
): Promise<CloudDatabaseMetadataDeltaResult> {
  if (!isDatabaseSyncEnabled()) {
    return {
      status: "disabled",
      pulled: 0,
      total: 0,
      records: [],
      fullRefresh: false,
    };
  }
  if (shouldBackOffAuthRetry()) {
    return {
      status: authRetryStatus ?? "unauthenticated",
      pulled: 0,
      total: 0,
      records: [],
      fullRefresh: false,
    };
  }

  if (databaseMetadataDeltaInFlight) return databaseMetadataDeltaInFlight;
  if (
    lastDatabaseMetadataDeltaResult &&
    Date.now() - lastDatabaseMetadataDeltaAt < METADATA_DELTA_THROTTLE_MS
  ) {
    return lastDatabaseMetadataDeltaResult;
  }

  databaseMetadataDeltaInFlight = runCloudDatabaseMetadataDelta(options);
  try {
    const result = await databaseMetadataDeltaInFlight;
    lastDatabaseMetadataDeltaResult = result;
    lastDatabaseMetadataDeltaAt = Date.now();
    return result;
  } finally {
    databaseMetadataDeltaInFlight = null;
  }
}

async function runCloudDatabaseMetadataDelta(
  options: SyncCloudDatabaseMetadataOptions
): Promise<CloudDatabaseMetadataDeltaResult> {
  if (options.restoreLocalCursor && !getRemoteCursor()) {
    const summaryRes = await call({ action: "summary" });
    if (summaryRes.ok) {
      const summary = normalizeSummary(summaryRes.json.summary);
      if (summary && (await restoreCursorFromLocalDatabaseMetadata(summary))) {
        return {
          status: "ok",
          pulled: 0,
          total: summary.count,
          records: [],
          fullRefresh: false,
        };
      }
    } else if (
      summaryRes.status === "unauthenticated" ||
      summaryRes.status === "unconfigured"
    ) {
      rememberAuthRetryStatus(summaryRes.status);
      return {
        status: summaryRes.status,
        pulled: 0,
        total: 0,
        records: [],
        fullRefresh: false,
        message: summaryRes.message,
      };
    }
  }

  if (getRemoteCursor()) {
    const delta = await syncCloudDatabaseDelta({
      maxBatches: QUICK_INCREMENTAL_BATCH_LIMIT,
    });
    rememberAuthRetryStatus(delta.status);
    return {
      status: delta.status,
      pulled: delta.pulled,
      total: delta.pulled,
      records: delta.records ?? [],
      fullRefresh: false,
      message: delta.message,
    };
  }

  const metadata = await syncCloudDatabaseMetadata(options);
  return {
    status: metadata.status,
    pulled: metadata.pulled,
    total: metadata.total,
    records: metadata.records,
    fullRefresh: true,
    cacheWriteFailed: metadata.cacheWriteFailed,
    message: metadata.message,
  };
}

function shouldBackOffAuthRetry(): boolean {
  const stored = readStoredAuthRetryStatus();
  if (stored) return true;
  return authRetryStatus !== null && Date.now() < authRetryAfter;
}

function rememberAuthRetryStatus(status: DatabaseSyncStatus): void {
  if (status === "unauthenticated" || status === "unconfigured") {
    authRetryStatus = status;
    authRetryAfter = Date.now() + AUTH_RETRY_BACKOFF_MS;
    writeSyncStorage(
      AUTH_RETRY_KEY,
      JSON.stringify({ status, until: authRetryAfter })
    );
    return;
  }
  if (status === "ok" || status === "disabled") {
    authRetryStatus = null;
    authRetryAfter = 0;
    removeSyncStorage(AUTH_RETRY_KEY);
  }
}

function readStoredAuthRetryStatus(): DatabaseSyncStatus | null {
  try {
    const parsed = JSON.parse(readSyncStorage(AUTH_RETRY_KEY) ?? "null") as {
      status?: unknown;
      until?: unknown;
    } | null;
    if (!parsed || typeof parsed.until !== "number" || parsed.until <= Date.now()) {
      removeSyncStorage(AUTH_RETRY_KEY);
      return null;
    }
    if (
      parsed.status !== "unauthenticated" &&
      parsed.status !== "unconfigured"
    ) {
      removeSyncStorage(AUTH_RETRY_KEY);
      return null;
    }
    authRetryStatus = parsed.status;
    authRetryAfter = parsed.until;
    return parsed.status;
  } catch {
    removeSyncStorage(AUTH_RETRY_KEY);
    return null;
  }
}

export function cloudDatabaseMetadataToDatabases(
  records: CloudDatabaseRecord[]
): Database[] {
  return records
    .filter((record) => record.type === "database" && !record.deleted_at)
    .map((record) => ({
      id: record.id,
      owner_id: record.owner_id,
      parent_page_id: record.parent_page_id,
      title: record.title || "未命名数据库",
      icon: record.icon,
      description: record.description,
      created_at: record.created_at,
      updated_at: record.updated_at,
      deleted_at: record.deleted_at,
      sync_version: 1,
    }))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

function toDatabaseUpdatePayloads(
  records: CloudDatabaseRecord[]
): DatabaseUpdatePayload[] {
  return records.filter(
    (record): record is DatabaseUpdatePayload => record.type === "database"
  );
}

export async function syncCloudDatabaseById(
  databaseId: string
): Promise<{
  status: DatabaseSyncStatus;
  pulled: number;
  total: number;
  records: CloudDatabaseRecord[];
  cacheWriteFailed?: boolean;
  message?: string;
}> {
  if (!isDatabaseSyncEnabled()) {
    return { status: "disabled", pulled: 0, total: 0, records: [] };
  }
  let offset = 0;
  let pulled = 0;
  let total = 0;
  let hasMore = false;
  let cacheWriteFailed = false;
  const records: CloudDatabaseRecord[] = [];

  do {
    const result = await fetchCloudDatabaseRecordsByDatabaseId(
      databaseId,
      offset,
      PULL_BATCH
    );
    if (result.status !== "ok") {
      return {
        status: result.status,
        pulled,
        total,
        records,
        cacheWriteFailed,
        message: result.message,
      };
    }
    total = result.total;
    if (result.records.length > 0) {
      records.push(...result.records);
      try {
        await applyRemoteDatabaseRecords(result.records);
      } catch {
        cacheWriteFailed = true;
      }
      pulled += result.records.length;
    }
    hasMore = result.hasMore && result.nextOffset !== null;
    if (hasMore) {
      const nextOffset = result.nextOffset ?? offset + result.records.length;
      if (nextOffset <= offset) {
        return {
          status: "error",
          pulled,
          total,
          records,
          cacheWriteFailed,
          message: "云端数据库分页游标没有前进，已停止本次拉取。",
        };
      }
      offset = nextOffset;
    }
  } while (hasMore);

  return { status: "ok", pulled, total, records, cacheWriteFailed };
}

export async function pushCloudDatabaseRecords(
  records: CloudDatabaseRecord[]
): Promise<PushCloudDatabasesResult> {
  if (records.length === 0) {
    return { status: "ok", accepted: [], skipped: [] };
  }
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
  const acknowledgedKeys = [...accepted, ...skipped];
  clearPendingCloudDatabasePushKeys(acknowledgedKeys);
  setLastDatabaseSyncAtNow();
  return { status: "ok", accepted, skipped };
}

async function markAcknowledgedDatabaseSyncKeys(keys: string[]): Promise<void> {
  const acknowledged = new Set(keys.filter(isValidRecordKey));
  if (acknowledged.size === 0) return;
  const pending = await getPendingDatabaseSyncRecords(1000);
  await markDatabaseSyncLogEntriesSynced(
    pending.entries
      .filter((entry) => acknowledged.has(entry.key))
      .map((entry) => entry.logId)
  );
}

export function queueCloudDatabaseRecords(
  records: CloudDatabaseRecord[],
  delayMs = CLOUD_DATABASE_PUSH_DEBOUNCE_MS
): void {
  if (!isDatabaseSyncEnabled()) return;
  for (const record of records) {
    const key = getRemoteDatabaseRecordKey(record);
    if (!isValidRecordKey(key)) continue;
    markPendingCloudDatabasePushKey(key);
    queuedCloudDatabasePush.set(key, record);
  }
  if (queuedCloudDatabasePush.size === 0) return;
  if (queuedCloudDatabasePushTimer) clearTimeout(queuedCloudDatabasePushTimer);
  queuedCloudDatabasePushTimer = setTimeout(() => {
    const batch = [...queuedCloudDatabasePush.values()];
    queuedCloudDatabasePush = new Map();
    queuedCloudDatabasePushTimer = null;
    void pushCloudDatabaseRecordsInBatches(batch);
  }, delayMs);
}

export async function queueCloudDatabaseRecordsForKeys(
  keys: string[],
  delayMs = CLOUD_DATABASE_PUSH_DEBOUNCE_MS
): Promise<void> {
  if (!isDatabaseSyncEnabled()) return;
  const records = await getDatabaseRecordsForSyncByKeys(keys);
  queueCloudDatabaseRecords(records, delayMs);
}

export async function flushPendingCloudDatabasePushes(): Promise<PushLocalDatabasesResult> {
  if (!isDatabaseSyncEnabled()) {
    return { status: "disabled", pushed: 0, skipped: 0, total: 0 };
  }
  const keys = getPendingCloudDatabasePushKeys();
  if (keys.length === 0) {
    return { status: "ok", pushed: 0, skipped: 0, total: 0 };
  }
  const records = await getDatabaseRecordsForSyncByKeys(keys);
  const foundKeys = new Set(records.map(getRemoteDatabaseRecordKey));
  const missingKeys = keys.filter((key) => !foundKeys.has(key));
  clearPendingCloudDatabasePushKeys(missingKeys);
  if (records.length === 0) {
    return {
      status: "ok",
      pushed: 0,
      skipped: 0,
      total: keys.length,
      acceptedKeys: [],
      skippedKeys: missingKeys,
    };
  }
  const result = await pushCloudDatabaseRecordsInBatches(records);
  return {
    ...result,
    total: keys.length,
    skippedKeys: [...(result.skippedKeys ?? []), ...missingKeys],
  };
}

async function pushCloudDatabaseRecordsInBatches(
  records: CloudDatabaseRecord[]
): Promise<PushLocalDatabasesResult> {
  let pushed = 0;
  let skipped = 0;
  const acceptedKeys: string[] = [];
  const skippedKeys: string[] = [];
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
        acceptedKeys.push(...result.accepted);
        skippedKeys.push(...result.skipped);
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
    acceptedKeys.push(...result.accepted);
    skippedKeys.push(...result.skipped);
  }
  await markAcknowledgedDatabaseSyncKeys([...acceptedKeys, ...skippedKeys]);
  return {
    status: "ok",
    pushed,
    skipped,
    total: records.length,
    acceptedKeys,
    skippedKeys,
  };
}

export async function pushLocalDatabasesToCloud(): Promise<PushLocalDatabasesResult> {
  if (!isDatabaseSyncEnabled()) {
    return { status: "disabled", pushed: 0, skipped: 0, total: 0 };
  }
  const pending = await getPendingDatabaseSyncRecords(1000);
  const records = await getAllDatabaseRecordsForSync();
  const result = await pushCloudDatabaseRecordsInBatches(records);
  if (result.status !== "ok") return result;
  const acknowledged = new Set([
    ...(result.acceptedKeys ?? []),
    ...(result.skippedKeys ?? []),
  ]);
  const marked = await markDatabaseSyncLogEntriesSynced(
    pending.entries
      .filter((entry) => acknowledged.has(entry.key))
      .map((entry) => entry.logId)
  );
  return { ...result, marked };
}

export async function pushPendingLocalDatabaseChangesToCloud(): Promise<PushLocalDatabasesResult> {
  if (!isDatabaseSyncEnabled()) {
    return { status: "disabled", pushed: 0, skipped: 0, total: 0 };
  }
  const pending = await getPendingDatabaseSyncRecords(200);
  if (pending.entries.length === 0 || pending.records.length === 0) {
    return { status: "ok", pushed: 0, skipped: 0, total: pending.entries.length };
  }
  const result = await pushCloudDatabaseRecordsInBatches(pending.records);
  if (result.status !== "ok") return result;
  const acknowledged = new Set([
    ...(result.acceptedKeys ?? []),
    ...(result.skippedKeys ?? []),
  ]);
  const marked = await markDatabaseSyncLogEntriesSynced(
    pending.entries
      .filter((entry) => acknowledged.has(entry.key))
      .map((entry) => entry.logId)
  );
  return {
    status: "ok",
    pushed: result.pushed,
    skipped: result.skipped,
    total: pending.entries.length,
    marked,
  };
}

export async function syncCloudDatabaseDelta(
  options: { maxBatches?: number } = {}
): Promise<{
  status: DatabaseSyncStatus;
  pulled: number;
  records?: CloudDatabaseRecord[];
  message?: string;
}> {
  if (!isDatabaseSyncEnabled()) {
    return { status: "disabled", pulled: 0 };
  }

  let cursor = getRemoteCursor();
  let pulled = 0;
  let batches = 0;
  const maxBatches = Math.max(1, options.maxBatches ?? Number.POSITIVE_INFINITY);
  const pulledDatabaseRecords: CloudDatabaseRecord[] = [];
  let hasMore = false;
  do {
    const changes = await fetchCloudDatabaseChangesSince(
      cursor,
      INCREMENTAL_PULL_LIMIT
    );
    if (changes.status !== "ok") {
      return {
        status: changes.status,
        pulled,
        records: pulledDatabaseRecords,
        message: changes.message,
      };
    }
    if (changes.records.length > 0) {
      await applyRemoteDatabaseRecords(changes.records);
      pulled += changes.records.length;
      pulledDatabaseRecords.push(...toDatabaseUpdatePayloads(changes.records));
    }
    if (changes.hasMore && changes.cursor === cursor) {
      return {
        status: "error",
        pulled,
        records: pulledDatabaseRecords,
        message: "云端数据库增量游标没有前进，已停止本次拉取。",
      };
    }
    cursor = changes.cursor;
    hasMore = changes.hasMore;
    batches += 1;
  } while (hasMore && batches < maxBatches);

  return { status: "ok", pulled, records: pulledDatabaseRecords };
}

export async function reconcileDatabaseSync(
  options: DatabaseReconcileOptions = {}
): Promise<DatabaseReconcileResult> {
  if (!isDatabaseSyncEnabled()) {
    return { status: "disabled", pulled: 0, pushed: 0, skipped: 0 };
  }
  const queuedPush = await flushPendingCloudDatabasePushes();
  if (queuedPush.status !== "ok") {
    return {
      status: queuedPush.status,
      pulled: 0,
      pushed: queuedPush.pushed,
      skipped: queuedPush.skipped,
      message: queuedPush.message,
    };
  }

  const cursor = getRemoteCursor();
  if (options.quick && !cursor) {
    const summaryRes = await call({ action: "summary" });
    if (!summaryRes.ok) {
      return {
        status: summaryRes.status,
        pulled: 0,
        pushed: queuedPush.pushed,
        skipped: queuedPush.skipped,
        message: summaryRes.message,
      };
    }
    const summary = normalizeSummary(summaryRes.json.summary);
    if (summary && (await restoreCursorFromLocalDatabaseMetadata(summary))) {
      const push = await pushPendingLocalDatabaseChangesToCloud();
      if (push.status !== "ok") {
        return {
          status: push.status,
          pulled: 0,
          pushed: push.pushed,
          skipped: push.skipped,
          message: push.message,
        };
      }
      return {
        status: "ok",
        pulled: 0,
        pushed: queuedPush.pushed + push.pushed,
        skipped: queuedPush.skipped + push.skipped,
      };
    }
    const metadata = await syncCloudDatabaseMetadata();
    if (metadata.status !== "ok") {
      return {
        status: metadata.status,
        pulled: 0,
        pushed: queuedPush.pushed,
        skipped: queuedPush.skipped,
        message: metadata.message,
      };
    }
    const push = await pushPendingLocalDatabaseChangesToCloud();
    if (push.status !== "ok") {
      return {
        status: push.status,
        pulled: metadata.pulled,
        pushed: push.pushed,
        skipped: push.skipped,
        message: push.message,
      };
    }
    return {
      status: "ok",
      pulled: metadata.pulled,
      pushed: queuedPush.pushed + push.pushed,
      skipped: queuedPush.skipped + push.skipped,
      records: metadata.records,
    };
  }

  const pull = await syncCloudDatabaseDelta(
    options.quick ? { maxBatches: QUICK_INCREMENTAL_BATCH_LIMIT } : {}
  );
  if (pull.status !== "ok") {
    return {
      status: pull.status,
      pulled: pull.pulled,
      pushed: queuedPush.pushed,
      skipped: queuedPush.skipped,
      records: pull.records,
      message: pull.message,
    };
  }
  const push = await pushPendingLocalDatabaseChangesToCloud();
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
      pushed: queuedPush.pushed + push.pushed,
      skipped: queuedPush.skipped + push.skipped,
      records: pull.records,
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
  if (pulled > 0 || prune.cleared > 0) {
    emitDatabasesUpdated("cloud-pull", pulled || prune.cleared);
  }
  return {
    status: "ok",
    cleared: prune.cleared,
    pulled,
    total: keys.length,
  };
}
