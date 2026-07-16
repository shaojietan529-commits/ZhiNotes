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
  getDatabaseSyncLogPendingCounts,
  getLocalDatabaseSyncSummary,
  getPendingDatabaseSyncRecords,
  getRemoteDatabaseRecordKey,
  markDatabaseSyncLogEntriesAttempted,
  markDatabaseSyncLogEntriesFailed,
  markDatabaseSyncLogEntriesSynced,
  type RemoteDatabaseRecord,
} from "@/lib/db/local/queries";
import {
  emitDatabasesUpdated,
  type DatabaseUpdatePayload,
} from "@/lib/database/databaseUpdateBus";
import {
  checkAccountCloudSyncGate,
  type AccountCloudSyncGateStatus,
} from "@/lib/account/accountCloudSyncGate";
import type { Database } from "@/lib/utils/types";

const ENABLED_KEY = "zhinote.databasesync.enabled";
const LAST_SYNC_KEY = "zhinote.databasesync.lastSyncAt";
const REMOTE_CURSOR_KEY = "zhinote.databasesync.remoteCursor";
const PENDING_PUSH_KEYS_KEY = "zhinote.databasesync.pendingPushKeys";
const PENDING_PUSH_META_KEY = "zhinote.databasesync.pendingPushMeta";
const AUTH_RETRY_KEY = "zhinote.databasesync.authRetry.v1";
const LAST_OUTCOME_KEY = "zhinote.databasesync.lastOutcome.v1";
const LOCAL_DATABASE_BASELINE_UPLOAD_SIGNATURE_KEY =
  "zhinote.databasesync.localBaselineUploadSignature.v1";
export const DATABASE_SYNC_STORAGE_KEY_PREFIX = "zhinote.databasesync.";
const INCREMENTAL_PULL_LIMIT = 100;
const QUICK_INCREMENTAL_BATCH_LIMIT = 3;
const PULL_BATCH = 80;
const PUSH_BATCH_RECORDS = 80;
const PUSH_BATCH_BYTES = 800 * 1024;
const CLOUD_DATABASE_PUSH_DEBOUNCE_MS = 1000;
const ACCOUNT_DATABASE_SYNC_REQUEST_TIMEOUT_MS = 12000;
const AUTH_RETRY_BACKOFF_MS = 2 * 60 * 1000;
const METADATA_DELTA_THROTTLE_MS = 2500;
const AUTH_RETRY_PROBE_WINDOW_KEY = "__zhinoteDatabaseSyncAuthRetryProbe";
const EMPTY_CLOUD_DATABASE_ACK_MESSAGE =
  "云端没有返回任何数据库 ACK，已保留本地待上传状态并稍后重试。";
const PARTIAL_CLOUD_DATABASE_ACK_MESSAGE =
  "云端只确认了部分数据库记录，未确认的记录已保留在 pending queue 并稍后重试。";

let queuedCloudDatabasePush = new Map<string, CloudDatabaseRecord>();
let queuedCloudDatabasePushTimer: ReturnType<typeof setTimeout> | null = null;
let databaseMetadataDeltaInFlight: Promise<CloudDatabaseMetadataDeltaResult> | null = null;
let lastDatabaseMetadataDeltaAt = 0;
let lastDatabaseMetadataDeltaResult: CloudDatabaseMetadataDeltaResult | null = null;
let databaseMetadataDeltaGeneration = 0;
let authRetryAfter = 0;
let authRetryStatus: DatabaseSyncStatus | null = null;
let authRetryProbeInFlight: Promise<AuthRetryProbeStatus> | null = null;
let memoryDatabaseRemoteCursor = "";
let memoryLastDatabaseSyncAt: string | null = null;
let memoryLastDatabaseSyncOutcome: DatabaseSyncLastOutcome | null = null;

export const DATABASE_SYNC_CONFIG_EVENT = "zhinote:databasesync-config";
export const DATABASE_SYNC_STATUS_EVENT = "zhinote:databasesync-status";

export type DatabaseSyncStatus =
  | "ok"
  | "unauthenticated"
  | "unconfigured"
  | "unconfirmed"
  | "disabled"
  | "error";

export type DatabaseSyncRecordType = "database" | "field" | "row" | "view";

export type DatabaseSyncOutcomeSource =
  | "direct-push"
  | "pending-push"
  | "sync-log-push"
  | "baseline-upload"
  | "reconcile";

export type CloudDatabaseRecord = RemoteDatabaseRecord;
type AuthRetryProbeStatus = DatabaseSyncStatus | "ok";
type AuthRetryProbeWindow = Window & {
  [AUTH_RETRY_PROBE_WINDOW_KEY]?: Promise<AuthRetryProbeStatus>;
};

function getAuthRetryStatusFromAccountGate(
  status: AccountCloudSyncGateStatus
): DatabaseSyncStatus {
  if (status === "signed-out") return "unauthenticated";
  if (status === "unconfigured") return "unconfigured";
  if (status === "unconfirmed") return "unconfirmed";
  return "error";
}

function getAccountGateDatabaseSyncMessage(
  status: AccountCloudSyncGateStatus
): string {
  if (status === "signed-out") {
    return "当前未登录，请登录后再同步数据库；本地输入已保留。";
  }
  if (status === "unconfigured") {
    return "数据库云同步账号系统未配置；本地输入已保留。";
  }
  if (status === "unconfirmed") {
    return "账号登录状态暂时无法确认，本地输入已保留，会稍后重试。";
  }
  return "账号云端暂时无法确认，本地输入已保留，会稍后重试。";
}

export interface DatabaseSyncIndexSummary {
  count: number;
  deleted: number;
  maxUpdatedAt: string;
  watermark: string;
  cursor: string;
}

export interface CloudDatabaseManifestSummaryResult {
  status: DatabaseSyncStatus;
  summary: DatabaseSyncIndexSummary | null;
  message?: string;
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

export interface DatabaseSyncLastOutcome {
  status: DatabaseSyncStatus;
  source: DatabaseSyncOutcomeSource;
  at: string;
  pulled: number;
  pushed: number;
  accepted: number;
  skipped: number;
  pendingAfter: number;
  message: string | null;
}

export interface PendingCloudDatabaseSyncStatus {
  enabled: boolean;
  pending: number;
  queued: number;
  syncLogPending: number;
  syncLogRetryable: number;
  syncLogDeferred: number;
  failed: number;
  failureCountTotal: number;
  maxFailureCount: number;
  manualReviewCount: number;
  manualReviewFailureThreshold: number;
  manualReviewSampleKeys: string[];
  oldestPendingQueuedAt: string | null;
  lastAttemptAt: string | null;
  lastFailureAt: string | null;
  lastFailureMessage: string | null;
  pendingSampleKeys: string[];
  failedSampleKeys: string[];
  authRetryStatus: DatabaseSyncStatus | null;
  authRetryUntil: string | null;
  lastSyncAt: string | null;
  lastOutcome: DatabaseSyncLastOutcome | null;
}

interface PendingCloudDatabasePushMetaEntry {
  queuedAt: string;
  lastAttemptAt?: string;
  lastFailureAt?: string;
  lastError?: string;
  failureCount?: number;
}

type PendingCloudDatabasePushMeta = Record<
  string,
  PendingCloudDatabasePushMetaEntry
>;
const PENDING_CLOUD_DATABASE_MANUAL_REVIEW_FAILURE_COUNT = 3;
const MISSING_DATABASE_SYNC_LOG_RECORD_MESSAGE =
  "数据库同步日志指向的本地数据库记录不存在，已保留为待处理。";

export interface DatabaseReconcileResult {
  status: DatabaseSyncStatus;
  pulled: number;
  pushed: number;
  skipped: number;
  bootstrapped?: number;
  records?: CloudDatabaseRecord[];
  message?: string;
}

export interface DatabaseReconcileOptions {
  quick?: boolean;
  includeManualReview?: boolean;
  forceAccountGate?: boolean;
}

interface FlushPendingCloudDatabasePushOptions {
  includeManualReview?: boolean;
}

export interface SyncCloudDatabaseByIdOptions {
  startOffset?: number;
  maxBatches?: number;
  collectRecords?: boolean;
}

interface SyncCloudDatabaseMetadataOptions {
  force?: boolean;
  restoreLocalCursor?: boolean;
  fullRefresh?: boolean;
  requireLocalCacheCoverage?: boolean;
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
  emitDatabaseSyncStatusChanged();
}

function emitDatabaseSyncStatusChanged(): void {
  if (typeof window === "undefined") return;
  void getPendingCloudDatabaseSyncStatus()
    .then((status) => {
      window.dispatchEvent(
        new CustomEvent(DATABASE_SYNC_STATUS_EVENT, { detail: status })
      );
    })
    .catch(() => {
      window.dispatchEvent(new CustomEvent(DATABASE_SYNC_STATUS_EVENT));
    });
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

export function getLastDatabaseSyncOutcome(): DatabaseSyncLastOutcome | null {
  const stored = normalizeDatabaseSyncLastOutcome(
    readSyncStorage(LAST_OUTCOME_KEY)
  );
  if (stored) {
    memoryLastDatabaseSyncOutcome = stored;
    return stored;
  }
  return memoryLastDatabaseSyncOutcome;
}

function setLastDatabaseSyncAtNow(): void {
  const iso = new Date().toISOString();
  memoryLastDatabaseSyncAt = iso;
  writeSyncStorage(LAST_SYNC_KEY, iso);
  emitDatabaseSyncStatusChanged();
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

async function fastForwardDatabaseMetadataDeltaFromLocalCursor(
  remoteSummary: DatabaseSyncIndexSummary
): Promise<CloudDatabaseMetadataDeltaResult | null> {
  let localSummary: Awaited<ReturnType<typeof getLocalDatabaseSyncSummary>>;
  try {
    localSummary = await getLocalDatabaseSyncSummary();
  } catch {
    return null;
  }
  if (!localSummary.cursor) return null;

  if (
    localSummary.watermark === remoteSummary.watermark &&
    localSummary.cursor === remoteSummary.cursor
  ) {
    setRemoteCursor(remoteSummary.cursor);
    setLastDatabaseSyncAtNow();
    return {
      status: "ok",
      pulled: 0,
      total: remoteSummary.count,
      records: [],
      fullRefresh: false,
    };
  }

  if (
    compareDatabaseChangeCursorStrings(localSummary.cursor, remoteSummary.cursor) >=
    0
  ) {
    return null;
  }

  let nextCursor = localSummary.cursor;
  let hasMore = false;
  let pulled = 0;
  const pulledDatabaseRecords: CloudDatabaseRecord[] = [];
  let cacheWriteFailed = false;
  let batches = 0;

  do {
    const changes = await fetchCloudDatabaseChangesSince(nextCursor);
    if (changes.status !== "ok") {
      return {
        status: changes.status,
        pulled,
        total: pulled,
        records: pulledDatabaseRecords,
        fullRefresh: false,
        cacheWriteFailed,
        message: changes.message,
      };
    }
    if (changes.records.length > 0) {
      try {
        await applyRemoteDatabaseRecords(changes.records);
      } catch {
        cacheWriteFailed = true;
      }
      pulled += changes.records.length;
      pulledDatabaseRecords.push(...toDatabaseUpdatePayloads(changes.records));
    }
    setRemoteCursor(changes.cursor);
    nextCursor = changes.cursor;
    hasMore = changes.hasMore;
    batches += 1;
  } while (hasMore && batches < QUICK_INCREMENTAL_BATCH_LIMIT);

  if (pulledDatabaseRecords.length > 0) {
    emitDatabasesUpdated(
      "cloud-pull",
      pulledDatabaseRecords.length,
      pulledDatabaseRecords
    );
  }
  setLastDatabaseSyncAtNow();
  return {
    status: "ok",
    pulled,
    total: pulled,
    records: pulledDatabaseRecords,
    fullRefresh: false,
    cacheWriteFailed,
  };
}

function parseDatabaseChangeCursorString(cursor: string): {
  updatedAt: string;
  key: string;
} {
  if (!cursor) return { updatedAt: "", key: "" };
  try {
    const parsed = JSON.parse(cursor) as {
      updatedAt?: unknown;
      key?: unknown;
    };
    if (
      typeof parsed.updatedAt === "string" &&
      typeof parsed.key === "string"
    ) {
      return { updatedAt: parsed.updatedAt, key: parsed.key };
    }
  } catch {
    // Older cursors stored only updated_at.
  }
  return { updatedAt: cursor, key: "" };
}

function compareDatabaseChangeCursorStrings(left: string, right: string): number {
  const leftCursor = parseDatabaseChangeCursorString(left);
  const rightCursor = parseDatabaseChangeCursorString(right);
  return (
    leftCursor.updatedAt.localeCompare(rightCursor.updatedAt) ||
    leftCursor.key.localeCompare(rightCursor.key)
  );
}

async function shouldRecoverDatabaseMetadataCoverageBeforeIncrementalPull(
  remoteCursor: string
): Promise<boolean> {
  try {
    const localSummary = await getLocalDatabaseSyncSummary();
    if (localSummary.count === 0 || !localSummary.cursor) return true;
    return compareDatabaseChangeCursorStrings(localSummary.cursor, remoteCursor) < 0;
  } catch {
    return true;
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
  if (uniqueKeys.length === 0) {
    removeSyncStorage(PENDING_PUSH_KEYS_KEY);
    removeSyncStorage(PENDING_PUSH_META_KEY);
    emitDatabaseSyncStatusChanged();
    return;
  }
  writeSyncStorage(PENDING_PUSH_KEYS_KEY, JSON.stringify(uniqueKeys));
  prunePendingCloudDatabasePushMetaToKeys(uniqueKeys);
  emitDatabaseSyncStatusChanged();
}

function getPendingCloudDatabasePushMeta(): PendingCloudDatabasePushMeta {
  try {
    const parsed = JSON.parse(readSyncStorage(PENDING_PUSH_META_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const next: PendingCloudDatabasePushMeta = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (
        !isValidRecordKey(key) ||
        !value ||
        typeof value !== "object" ||
        Array.isArray(value)
      ) {
        continue;
      }
      const queuedAt = (value as { queuedAt?: unknown }).queuedAt;
      const lastAttemptAt = (value as { lastAttemptAt?: unknown })
        .lastAttemptAt;
      const lastFailureAt = (value as { lastFailureAt?: unknown })
        .lastFailureAt;
      const lastError = (value as { lastError?: unknown }).lastError;
      const failureCount = (value as { failureCount?: unknown }).failureCount;
      if (
        typeof queuedAt === "string" &&
        !Number.isNaN(Date.parse(queuedAt))
      ) {
        next[key] = {
          queuedAt,
          ...(typeof lastAttemptAt === "string" &&
          !Number.isNaN(Date.parse(lastAttemptAt))
            ? { lastAttemptAt }
            : {}),
          ...(typeof lastFailureAt === "string" &&
          !Number.isNaN(Date.parse(lastFailureAt))
            ? { lastFailureAt }
            : {}),
          ...(typeof lastError === "string" && lastError.trim()
            ? { lastError: lastError.slice(0, 220) }
            : {}),
          ...(typeof failureCount === "number" && failureCount > 0
            ? { failureCount: Math.min(Math.floor(failureCount), 999) }
            : {}),
        };
      }
    }
    return next;
  } catch {
    return {};
  }
}

function setPendingCloudDatabasePushMeta(
  meta: PendingCloudDatabasePushMeta
): void {
  const next: PendingCloudDatabasePushMeta = {};
  for (const [key, value] of Object.entries(meta)) {
    if (
      isValidRecordKey(key) &&
      typeof value.queuedAt === "string" &&
      !Number.isNaN(Date.parse(value.queuedAt))
    ) {
      next[key] = {
        queuedAt: value.queuedAt,
        ...(value.lastAttemptAt ? { lastAttemptAt: value.lastAttemptAt } : {}),
        ...(value.lastFailureAt ? { lastFailureAt: value.lastFailureAt } : {}),
        ...(value.lastError ? { lastError: value.lastError.slice(0, 220) } : {}),
        ...(value.failureCount ? { failureCount: value.failureCount } : {}),
      };
    }
  }
  if (Object.keys(next).length === 0) {
    removeSyncStorage(PENDING_PUSH_META_KEY);
    return;
  }
  writeSyncStorage(PENDING_PUSH_META_KEY, JSON.stringify(next));
}

function prunePendingCloudDatabasePushMetaToKeys(keys: string[]): void {
  const allowedKeys = new Set(keys.filter(isValidRecordKey));
  if (allowedKeys.size === 0) {
    removeSyncStorage(PENDING_PUSH_META_KEY);
    return;
  }
  const next: PendingCloudDatabasePushMeta = {};
  for (const [key, value] of Object.entries(getPendingCloudDatabasePushMeta())) {
    if (allowedKeys.has(key)) next[key] = value;
  }
  setPendingCloudDatabasePushMeta(next);
}

function markPendingCloudDatabasePushKey(key: string): void {
  if (!isValidRecordKey(key)) return;
  const nextKeys = [...getPendingCloudDatabasePushKeys(), key];
  setPendingCloudDatabasePushKeys(nextKeys);
  const pendingMeta = getPendingCloudDatabasePushMeta();
  if (!pendingMeta[key]) {
    setPendingCloudDatabasePushMeta({
      ...pendingMeta,
      [key]: { queuedAt: new Date().toISOString() },
    });
    emitDatabaseSyncStatusChanged();
  }
}

function markPendingCloudDatabasePushRecords(
  records: CloudDatabaseRecord[]
): void {
  for (const record of records) {
    markPendingCloudDatabasePushKey(getRemoteDatabaseRecordKey(record));
  }
}

function clearPendingCloudDatabasePushKeys(keys: string[]): void {
  if (keys.length === 0) return;
  const acknowledged = new Set(keys.filter(isValidRecordKey));
  if (acknowledged.size === 0) return;
  setPendingCloudDatabasePushKeys(
    getPendingCloudDatabasePushKeys().filter((key) => !acknowledged.has(key))
  );
}

function clearAllPendingCloudDatabasePushesForCacheRebuild(): void {
  if (queuedCloudDatabasePushTimer) {
    clearTimeout(queuedCloudDatabasePushTimer);
    queuedCloudDatabasePushTimer = null;
  }
  queuedCloudDatabasePush = new Map();
  setPendingCloudDatabasePushKeys([]);
  emitDatabaseSyncStatusChanged();
}

function clearDatabaseSyncRuntimeCachesForCacheRebuild(): void {
  databaseMetadataDeltaGeneration += 1;
  databaseMetadataDeltaInFlight = null;
  lastDatabaseMetadataDeltaResult = null;
  lastDatabaseMetadataDeltaAt = 0;
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
  const accountGate = await checkAccountCloudSyncGate();
  if (accountGate.status === "unconfigured") {
    rememberAuthRetryStatus("unconfigured");
    return { ok: false, status: "unconfigured" };
  }
  if (accountGate.status === "signed-out") {
    rememberAuthRetryStatus("unauthenticated");
    return { ok: false, status: "unauthenticated" };
  }
  if (accountGate.status === "unconfirmed") {
    rememberAuthRetryStatus("unconfirmed");
    return {
      ok: false,
      status: "unconfirmed",
      message: "账号登录状态暂时无法确认，本地输入已保留，会稍后重试。",
    };
  }
  if (accountGate.status === "error") {
    rememberAuthRetryStatus("error");
    return {
      ok: false,
      status: "error",
      message: "账号云端暂时无法确认，本地输入已保留，会稍后重试。",
    };
  }
  const probedStatus = await waitForAuthRetryProbe();
  if (probedStatus) {
    return { ok: false, status: probedStatus };
  }
  const finishAuthRetryProbe = startAuthRetryProbe();
  let probeStatus: AuthRetryProbeStatus = "ok";
  try {
    const res = await fetchAccountDatabaseSync(body);
    if (res.status === 501) {
      probeStatus = "unconfigured";
      rememberAuthRetryStatus("unconfigured");
      return { ok: false, status: "unconfigured" };
    }
    if (res.status === 401) {
      probeStatus = "error";
      rememberAuthRetryStatus("error");
      return {
        ok: false,
        status: "error",
        message:
          "数据库同步接口暂时无法确认账号权限；已保留本地输入并稍后重试。",
      };
    }
    const json = await res.json().catch(() => ({}));
    if (
      res.status === 503 &&
      (json.reason === "session-unconfirmed" || json.retryable)
    ) {
      probeStatus = "unconfirmed";
      rememberAuthRetryStatus("unconfirmed");
      return {
        ok: false,
        status: "unconfirmed",
        message:
          typeof json.message === "string"
            ? json.message
            : typeof json.error === "string"
              ? json.error
              : "数据库同步接口暂时无法确认账号权限；已保留本地输入并稍后重试。",
      };
    }
    if (!res.ok) {
      rememberAuthRetryStatus("error");
      return {
        ok: false,
        status: "error",
        message: typeof json.error === "string" ? json.error : undefined,
      };
    }
    rememberAuthRetryStatus("ok");
    return { ok: true, json };
  } catch (error) {
    probeStatus = "error";
    rememberAuthRetryStatus("error");
    return {
      ok: false,
      status: "error",
      message: isAbortError(error)
        ? "数据库同步请求超时；本地输入已保留，会稍后重试。"
        : "网络错误",
    };
  } finally {
    finishAuthRetryProbe(probeStatus);
  }
}

async function fetchAccountDatabaseSync(
  body: Record<string, unknown>
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    ACCOUNT_DATABASE_SYNC_REQUEST_TIMEOUT_MS
  );
  try {
    return await fetch("/api/databases/account-sync", {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

export async function getCloudDatabaseManifestSummary(): Promise<CloudDatabaseManifestSummaryResult> {
  const res = await call({ action: "summary" });
  if (!res.ok) {
    return { status: res.status, summary: null, message: res.message };
  }
  const summary = normalizeSummary(res.json.summary);
  if (!summary) {
    return {
      status: "error",
      summary: null,
      message: "云端数据库 manifest summary 格式无效",
    };
  }
  return { status: "ok", summary };
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
  const forcedAuthRetryRecovery =
    await recoverAuthRetryForForcedDatabaseMetadataSync(
      Boolean(options.force)
    );
  if (forcedAuthRetryRecovery) return forcedAuthRetryRecovery;
  if (shouldBackOffAuthRetry()) {
    return {
      status: authRetryStatus ?? "unauthenticated",
      pulled: 0,
      total: 0,
      records: [],
      fullRefresh: false,
    };
  }

  const requiresFreshCoverage =
    Boolean(options.fullRefresh) || Boolean(options.requireLocalCacheCoverage);
  if (!options.force && !requiresFreshCoverage) {
    if (databaseMetadataDeltaInFlight) return databaseMetadataDeltaInFlight;
    if (
      lastDatabaseMetadataDeltaResult &&
      Date.now() - lastDatabaseMetadataDeltaAt < METADATA_DELTA_THROTTLE_MS
    ) {
      return lastDatabaseMetadataDeltaResult;
    }
  }

  const generation = databaseMetadataDeltaGeneration;
  databaseMetadataDeltaInFlight = runCloudDatabaseMetadataDelta(options);
  try {
    const result = await databaseMetadataDeltaInFlight;
    if (generation === databaseMetadataDeltaGeneration) {
      lastDatabaseMetadataDeltaResult = result;
      lastDatabaseMetadataDeltaAt = Date.now();
    }
    return result;
  } finally {
    if (generation === databaseMetadataDeltaGeneration) {
      databaseMetadataDeltaInFlight = null;
    }
  }
}

async function runCloudDatabaseMetadataDelta(
  options: SyncCloudDatabaseMetadataOptions
): Promise<CloudDatabaseMetadataDeltaResult> {
  let cursor =
    options.fullRefresh || options.requireLocalCacheCoverage
      ? ""
      : getRemoteCursor();

  if ((options.restoreLocalCursor || options.requireLocalCacheCoverage) && !cursor) {
    const summaryRes = await call({ action: "summary" });
    if (summaryRes.ok) {
      const summary = normalizeSummary(summaryRes.json.summary);
      if (summary && (await restoreCursorFromLocalDatabaseMetadata(summary))) {
        cursor = getRemoteCursor();
      } else if (summary) {
        const fastForward =
          await fastForwardDatabaseMetadataDeltaFromLocalCursor(summary);
        if (fastForward) return fastForward;
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

  if (cursor) {
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

async function recoverAuthRetryForForcedDatabaseMetadataSync(
  force: boolean
): Promise<CloudDatabaseMetadataDeltaResult | null> {
  if (!force || !shouldBackOffAuthRetry()) return null;
  const accountGate = await checkAccountCloudSyncGate({ force: true });
  if (accountGate.status === "ready") {
    rememberAuthRetryStatus("ok");
    return null;
  }
  const status = getAuthRetryStatusFromAccountGate(accountGate.status);
  rememberAuthRetryStatus(status);
  return {
    status,
    pulled: 0,
    total: 0,
    records: [],
    fullRefresh: false,
    message: getAccountGateDatabaseSyncMessage(accountGate.status),
  };
}

function shouldBackOffAuthRetry(): boolean {
  const stored = readStoredAuthRetryStatus();
  if (stored) return true;
  return authRetryStatus !== null && Date.now() < authRetryAfter;
}

async function waitForAuthRetryProbe(): Promise<DatabaseSyncStatus | null> {
  const probe = getAuthRetryProbe();
  if (!probe) return null;
  const status = await probe.catch((): AuthRetryProbeStatus => "ok");
  return status === "unauthenticated" ||
    status === "unconfigured" ||
    status === "unconfirmed" ||
    status === "error"
    ? status
    : null;
}

function startAuthRetryProbe(): (status: AuthRetryProbeStatus) => void {
  if (getAuthRetryProbe()) return () => {};
  let settle: (status: AuthRetryProbeStatus) => void = () => {};
  const probe = new Promise<AuthRetryProbeStatus>((resolve) => {
    settle = resolve;
  });
  setAuthRetryProbe(probe);
  return (status: AuthRetryProbeStatus) => {
    if (getAuthRetryProbe() === probe) setAuthRetryProbe(null);
    settle(status);
  };
}

function getAuthRetryProbe(): Promise<AuthRetryProbeStatus> | null {
  if (authRetryProbeInFlight) return authRetryProbeInFlight;
  if (typeof window === "undefined") return null;
  return (window as AuthRetryProbeWindow)[AUTH_RETRY_PROBE_WINDOW_KEY] ?? null;
}

function setAuthRetryProbe(
  probe: Promise<AuthRetryProbeStatus> | null
): void {
  authRetryProbeInFlight = probe;
  if (typeof window === "undefined") return;
  const target = window as AuthRetryProbeWindow;
  if (probe) {
    target[AUTH_RETRY_PROBE_WINDOW_KEY] = probe;
  } else {
    delete target[AUTH_RETRY_PROBE_WINDOW_KEY];
  }
}

function rememberAuthRetryStatus(status: DatabaseSyncStatus): void {
  const previousStatus = authRetryStatus;
  const previousUntil = authRetryAfter;
  if (
    status === "unauthenticated" ||
    status === "unconfigured" ||
    status === "unconfirmed" ||
    status === "error"
  ) {
    authRetryStatus = status;
    authRetryAfter = Date.now() + AUTH_RETRY_BACKOFF_MS;
    writeSyncStorage(
      AUTH_RETRY_KEY,
      JSON.stringify({ status, until: authRetryAfter })
    );
    if (previousStatus !== authRetryStatus || previousUntil !== authRetryAfter) {
      emitDatabaseSyncStatusChanged();
    }
    return;
  }
  if (status === "ok" || status === "disabled") {
    authRetryStatus = null;
    authRetryAfter = 0;
    removeSyncStorage(AUTH_RETRY_KEY);
    if (previousStatus !== authRetryStatus || previousUntil !== authRetryAfter) {
      emitDatabaseSyncStatusChanged();
    }
  }
}

function readStoredAuthRetryStatus(): DatabaseSyncStatus | null {
  try {
    const parsed = JSON.parse(readSyncStorage(AUTH_RETRY_KEY) ?? "null") as {
      status?: unknown;
      until?: unknown;
    } | null;
    if (!parsed || typeof parsed.until !== "number" || parsed.until <= Date.now()) {
      authRetryStatus = null;
      authRetryAfter = 0;
      removeSyncStorage(AUTH_RETRY_KEY);
      return null;
    }
    if (
      parsed.status !== "unauthenticated" &&
      parsed.status !== "unconfigured" &&
      parsed.status !== "unconfirmed" &&
      parsed.status !== "error"
    ) {
      authRetryStatus = null;
      authRetryAfter = 0;
      removeSyncStorage(AUTH_RETRY_KEY);
      return null;
    }
    authRetryStatus = parsed.status;
    authRetryAfter = parsed.until;
    return parsed.status;
  } catch {
    authRetryStatus = null;
    authRetryAfter = 0;
    removeSyncStorage(AUTH_RETRY_KEY);
    return null;
  }
}

export function recordDatabaseSyncAuthRetryStatus(
  status: DatabaseSyncStatus
): void {
  rememberAuthRetryStatus(status);
}

function getAuthRetrySnapshot(): {
  status: DatabaseSyncStatus | null;
  until: string | null;
} {
  const stored = readStoredAuthRetryStatus();
  const activeStatus =
    stored ??
    (authRetryStatus !== null && Date.now() < authRetryAfter
      ? authRetryStatus
      : null);
  if (!activeStatus) {
    authRetryStatus = null;
    authRetryAfter = 0;
    return { status: null, until: null };
  }
  return {
    status: activeStatus,
    until: new Date(authRetryAfter).toISOString(),
  };
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
  databaseId: string,
  options: SyncCloudDatabaseByIdOptions = {}
): Promise<{
  status: DatabaseSyncStatus;
  pulled: number;
  total: number;
  records: CloudDatabaseRecord[];
  nextOffset: number | null;
  hasMore: boolean;
  cacheWriteFailed?: boolean;
  message?: string;
}> {
  if (!isDatabaseSyncEnabled()) {
    return {
      status: "disabled",
      pulled: 0,
      total: 0,
      records: [],
      nextOffset: null,
      hasMore: false,
    };
  }
  let offset = Math.max(0, options.startOffset ?? 0);
  let pulled = 0;
  let total = 0;
  let hasMore = false;
  let nextOffset: number | null = null;
  let cacheWriteFailed = false;
  const records: CloudDatabaseRecord[] = [];
  const maxBatches = Math.max(1, options.maxBatches ?? Number.POSITIVE_INFINITY);
  const collectRecords = options.collectRecords !== false;
  let batches = 0;

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
        nextOffset,
        hasMore,
        cacheWriteFailed,
        message: result.message,
      };
    }
    total = result.total;
    if (result.records.length > 0) {
      if (collectRecords) records.push(...result.records);
      try {
        await applyRemoteDatabaseRecords(result.records);
      } catch {
        cacheWriteFailed = true;
      }
      pulled += result.records.length;
    }
    hasMore = result.hasMore && result.nextOffset !== null;
    nextOffset = hasMore ? result.nextOffset : null;
    if (hasMore) {
      const safeNextOffset = result.nextOffset ?? offset + result.records.length;
      if (safeNextOffset <= offset) {
        return {
          status: "error",
          pulled,
          total,
          records,
          nextOffset: safeNextOffset,
          hasMore,
          cacheWriteFailed,
          message: "云端数据库分页游标没有前进，已停止本次拉取。",
        };
      }
      offset = safeNextOffset;
    }
    batches += 1;
  } while (hasMore && batches < maxBatches);

  return {
    status: "ok",
    pulled,
    total,
    records,
    nextOffset,
    hasMore,
    cacheWriteFailed,
  };
}

export async function pushCloudDatabaseRecords(
  records: CloudDatabaseRecord[]
): Promise<PushCloudDatabasesResult> {
  if (records.length === 0) {
    recordDatabaseSyncOutcome({
      status: "ok",
      source: "direct-push",
      pulled: 0,
      pushed: 0,
      accepted: 0,
      skipped: 0,
      pendingAfter: getPendingCloudDatabasePushKeys().length,
    });
    return { status: "ok", accepted: [], skipped: [] };
  }
  markPendingCloudDatabasePushRecords(records);
  markPendingCloudDatabasePushAttemptRecords(records);
  emitDatabaseSyncStatusChanged();
  const res = await call({ action: "push", records });
  if (!res.ok) {
    markPendingCloudDatabasePushFailedRecords(records, res.status, res.message);
    emitDatabaseSyncStatusChanged();
    recordDatabaseSyncOutcome({
      status: res.status,
      source: "direct-push",
      pulled: 0,
      pushed: 0,
      accepted: 0,
      skipped: 0,
      pendingAfter: getPendingCloudDatabasePushKeys().length,
      message: res.message,
    });
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
  if (records.length > 0 && acknowledgedKeys.length === 0) {
    markPendingCloudDatabasePushFailedRecords(
      records,
      "error",
      EMPTY_CLOUD_DATABASE_ACK_MESSAGE
    );
    emitDatabaseSyncStatusChanged();
    recordDatabaseSyncOutcome({
      status: "error",
      source: "direct-push",
      pulled: 0,
      pushed: 0,
      accepted: 0,
      skipped: 0,
      pendingAfter: getPendingCloudDatabasePushKeys().length,
      message: EMPTY_CLOUD_DATABASE_ACK_MESSAGE,
    });
    return {
      status: "error",
      accepted: [],
      skipped: [],
      message: EMPTY_CLOUD_DATABASE_ACK_MESSAGE,
    };
  }
  const acknowledgedKeySet = new Set(acknowledgedKeys);
  const unacknowledgedRecords = records.filter((record) => {
    const key = getRemoteDatabaseRecordKey(record);
    return isValidRecordKey(key) && !acknowledgedKeySet.has(key);
  });
  if (unacknowledgedRecords.length > 0) {
    markPendingCloudDatabasePushFailedRecords(
      unacknowledgedRecords,
      "error",
      PARTIAL_CLOUD_DATABASE_ACK_MESSAGE
    );
    emitDatabaseSyncStatusChanged();
  }
  clearPendingCloudDatabasePushKeys(acknowledgedKeys);
  setLastDatabaseSyncAtNow();
  recordDatabaseSyncOutcome({
    status: unacknowledgedRecords.length > 0 ? "error" : "ok",
    source: "direct-push",
    pulled: 0,
    pushed: accepted.length,
    accepted: accepted.length,
    skipped: skipped.length,
    pendingAfter: getPendingCloudDatabasePushKeys().length,
    message:
      unacknowledgedRecords.length > 0
        ? PARTIAL_CLOUD_DATABASE_ACK_MESSAGE
        : null,
  });
  return {
    status: unacknowledgedRecords.length > 0 ? "error" : "ok",
    accepted,
    skipped,
    message:
      unacknowledgedRecords.length > 0
        ? PARTIAL_CLOUD_DATABASE_ACK_MESSAGE
        : undefined,
  };
}

function markPendingCloudDatabasePushAttemptRecords(
  records: CloudDatabaseRecord[]
): void {
  const attemptedAt = new Date().toISOString();
  const meta = getPendingCloudDatabasePushMeta();
  const next: PendingCloudDatabasePushMeta = { ...meta };
  for (const record of records) {
    const key = getRemoteDatabaseRecordKey(record);
    if (!isValidRecordKey(key)) continue;
    const previous = meta[key];
    next[key] = {
      ...previous,
      queuedAt: previous?.queuedAt ?? attemptedAt,
      lastAttemptAt: attemptedAt,
    };
  }
  setPendingCloudDatabasePushMeta(next);
}

function markPendingCloudDatabasePushFailedRecords(
  records: CloudDatabaseRecord[],
  status: DatabaseSyncStatus,
  message?: string
): void {
  const failedAt = new Date().toISOString();
  const meta = getPendingCloudDatabasePushMeta();
  const next: PendingCloudDatabasePushMeta = { ...meta };
  const reason = normalizePendingCloudDatabasePushError(status, message);
  for (const record of records) {
    const key = getRemoteDatabaseRecordKey(record);
    const previous = meta[key];
    if (!isValidRecordKey(key)) continue;
    next[key] = {
      ...previous,
      queuedAt: previous?.queuedAt ?? failedAt,
      lastAttemptAt: failedAt,
      lastFailureAt: failedAt,
      lastError: reason,
      failureCount: Math.min((previous.failureCount ?? 0) + 1, 999),
    };
  }
  setPendingCloudDatabasePushMeta(next);
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
  emitDatabaseSyncStatusChanged();
  if (queuedCloudDatabasePushTimer) clearTimeout(queuedCloudDatabasePushTimer);
  queuedCloudDatabasePushTimer = setTimeout(() => {
    const batch = [...queuedCloudDatabasePush.values()];
    queuedCloudDatabasePush = new Map();
    queuedCloudDatabasePushTimer = null;
    emitDatabaseSyncStatusChanged();
    void pushCloudDatabaseRecordsInBatches(batch).finally(() => {
      emitDatabaseSyncStatusChanged();
    });
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

export async function flushPendingCloudDatabasePushes(
  options: FlushPendingCloudDatabasePushOptions = {}
): Promise<PushLocalDatabasesResult> {
  if (!isDatabaseSyncEnabled()) {
    recordDatabaseSyncOutcome({
      status: "disabled",
      source: "pending-push",
      pulled: 0,
      pushed: 0,
      accepted: 0,
      skipped: 0,
      pendingAfter: getPendingCloudDatabasePushKeys().length,
    });
    return { status: "disabled", pushed: 0, skipped: 0, total: 0 };
  }
  const keys = getPendingCloudDatabasePushKeys();
  if (keys.length === 0) {
    recordDatabaseSyncOutcome({
      status: "ok",
      source: "pending-push",
      pulled: 0,
      pushed: 0,
      accepted: 0,
      skipped: 0,
      pendingAfter: 0,
    });
    return { status: "ok", pushed: 0, skipped: 0, total: 0 };
  }
  const pendingMeta = getPendingCloudDatabasePushMeta();
  const retryableKeys = options.includeManualReview
    ? keys
    : keys.filter(
        (key) =>
          (pendingMeta[key]?.failureCount ?? 0) <
          PENDING_CLOUD_DATABASE_MANUAL_REVIEW_FAILURE_COUNT
      );
  if (retryableKeys.length === 0) {
    recordDatabaseSyncOutcome({
      status: "ok",
      source: "pending-push",
      pulled: 0,
      pushed: 0,
      accepted: 0,
      skipped: 0,
      pendingAfter: keys.length,
    });
    return { status: "ok", pushed: 0, skipped: 0, total: keys.length };
  }
  const records = await getDatabaseRecordsForSyncByKeys(retryableKeys);
  const foundKeys = new Set(records.map(getRemoteDatabaseRecordKey));
  const missingKeys = retryableKeys.filter((key) => !foundKeys.has(key));
  clearPendingCloudDatabasePushKeys(missingKeys);
  if (records.length === 0) {
    recordDatabaseSyncOutcome({
      status: "ok",
      source: "pending-push",
      pulled: 0,
      pushed: 0,
      accepted: 0,
      skipped: missingKeys.length,
      pendingAfter: getPendingCloudDatabasePushKeys().length,
    });
    return {
      status: "ok",
      pushed: 0,
      skipped: 0,
      total: retryableKeys.length,
      acceptedKeys: [],
      skippedKeys: missingKeys,
    };
  }
  const result = await pushCloudDatabaseRecordsInBatches(records);
  const next = {
    ...result,
    total: keys.length,
    skippedKeys: [...(result.skippedKeys ?? []), ...missingKeys],
  };
  recordDatabaseSyncOutcome({
    status: next.status,
    source: "pending-push",
    pulled: 0,
    pushed: next.pushed,
    accepted: next.acceptedKeys?.length ?? next.pushed,
    skipped: next.skipped,
    pendingAfter: getPendingCloudDatabasePushKeys().length,
    message: next.message ?? null,
  });
  return next;
}

export async function getPendingCloudDatabaseSyncStatus(): Promise<PendingCloudDatabaseSyncStatus> {
  let syncLogPending = 0;
  let syncLogRetryable = 0;
  let syncLogDeferred = 0;
  try {
    const [pending, counts] = await Promise.all([
      getPendingDatabaseSyncRecords(1000),
      getDatabaseSyncLogPendingCounts(),
    ]);
    syncLogRetryable = pending.entries.length;
    syncLogPending = Math.max(counts.total, syncLogRetryable);
    syncLogDeferred = Math.max(0, syncLogPending - syncLogRetryable);
  } catch {
    syncLogPending = 0;
    syncLogRetryable = 0;
    syncLogDeferred = 0;
  }
  const pendingKeys = getPendingCloudDatabasePushKeys();
  const pendingMeta = getPendingCloudDatabasePushMeta();
  const authRetry = getAuthRetrySnapshot();
  const failedKeys = pendingKeys.filter((key) =>
    Boolean(pendingMeta[key]?.lastError)
  );
  const failureCounts = pendingKeys.map(
    (key) => pendingMeta[key]?.failureCount ?? 0
  );
  const failureCountTotal = failureCounts.reduce((sum, count) => sum + count, 0);
  const maxFailureCount =
    failureCounts.length > 0 ? Math.max(...failureCounts) : 0;
  const manualReviewKeys = failedKeys.filter(
    (key) =>
      (pendingMeta[key]?.failureCount ?? 0) >=
      PENDING_CLOUD_DATABASE_MANUAL_REVIEW_FAILURE_COUNT
  );
  const manualReviewSampleKeys = manualReviewKeys.slice(0, 5);
  const oldestPendingQueuedAt = pendingKeys.reduce<string | null>(
    (oldest, key) => {
      const queuedAt = pendingMeta[key]?.queuedAt ?? null;
      if (!queuedAt) return oldest;
      if (!oldest) return queuedAt;
      return Date.parse(queuedAt) < Date.parse(oldest) ? queuedAt : oldest;
    },
    null
  );
  const lastAttemptAt = newestIso(
    pendingKeys.map((key) => pendingMeta[key]?.lastAttemptAt ?? null)
  );
  const latestFailedKey = failedKeys
    .map((key) => ({ key, failedAt: pendingMeta[key]?.lastFailureAt ?? "" }))
    .sort((left, right) => right.failedAt.localeCompare(left.failedAt))[0]?.key;
  return {
    enabled: isDatabaseSyncEnabled(),
    pending: pendingKeys.length,
    queued: queuedCloudDatabasePush.size,
    syncLogPending,
    syncLogRetryable,
    syncLogDeferred,
    failed: failedKeys.length,
    failureCountTotal,
    maxFailureCount,
    manualReviewCount: manualReviewKeys.length,
    manualReviewFailureThreshold:
      PENDING_CLOUD_DATABASE_MANUAL_REVIEW_FAILURE_COUNT,
    manualReviewSampleKeys,
    oldestPendingQueuedAt,
    lastAttemptAt,
    lastFailureAt: latestFailedKey
      ? pendingMeta[latestFailedKey]?.lastFailureAt ?? null
      : null,
    lastFailureMessage: latestFailedKey
      ? pendingMeta[latestFailedKey]?.lastError ?? null
      : null,
    pendingSampleKeys: pendingKeys.slice(0, 5),
    failedSampleKeys: failedKeys.slice(0, 5),
    authRetryStatus: authRetry.status,
    authRetryUntil: authRetry.until,
    lastSyncAt: getLastDatabaseSyncAt(),
    lastOutcome: getLastDatabaseSyncOutcome(),
  };
}

async function pushCloudDatabaseRecordsInBatches(
  records: CloudDatabaseRecord[]
): Promise<PushLocalDatabasesResult> {
  let pushed = 0;
  let skipped = 0;
  const acceptedKeys: string[] = [];
  const skippedKeys: string[] = [];
  const oversizedKeys: string[] = [];
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
      if (result) {
        pushed += result.accepted.length;
        skipped += result.skipped.length;
        acceptedKeys.push(...result.accepted);
        skippedKeys.push(...result.skipped);
        if (result.status !== "ok") {
          await markAcknowledgedDatabaseSyncKeys([
            ...acceptedKeys,
            ...skippedKeys,
          ]);
          return {
            status: result.status,
            pushed,
            skipped,
            total: records.length,
            acceptedKeys,
            skippedKeys,
            message: result.message,
          };
        }
      }
    }
    if (size > PUSH_BATCH_BYTES) {
      const key = getRemoteDatabaseRecordKey(record);
      oversizedKeys.push(key);
      markPendingCloudDatabasePushFailedRecords(
        [record],
        "error",
        `单条数据库记录 ${formatSyncBytes(size)} 超过本地云同步单批上限 ${formatSyncBytes(
          PUSH_BATCH_BYTES
        )}；请拆分字段/行值或减少过大的本地记录后重试。`
      );
      emitDatabaseSyncStatusChanged();
      continue;
    }
    batch.push(record);
    batchBytes += size;
  }

  const result = await flush();
  if (result) {
    pushed += result.accepted.length;
    skipped += result.skipped.length;
    acceptedKeys.push(...result.accepted);
    skippedKeys.push(...result.skipped);
    if (result.status !== "ok") {
      await markAcknowledgedDatabaseSyncKeys([...acceptedKeys, ...skippedKeys]);
      return {
        status: result.status,
        pushed,
        skipped,
        total: records.length,
        acceptedKeys,
        skippedKeys,
        message: result.message,
      };
    }
  }
  await markAcknowledgedDatabaseSyncKeys([...acceptedKeys, ...skippedKeys]);
  if (oversizedKeys.length > 0) {
    return {
      status: "error",
      pushed,
      skipped,
      total: records.length,
      acceptedKeys,
      skippedKeys,
      message: `${oversizedKeys.length} 条数据库记录超过云同步单批上限，已保留在 pending queue 并标记失败原因。`,
    };
  }
  return {
    status: "ok",
    pushed,
    skipped,
    total: records.length,
    acceptedKeys,
    skippedKeys,
  };
}

async function uploadLocalDatabaseBaselineIfNeeded(): Promise<PushLocalDatabasesResult> {
  if (!isDatabaseSyncEnabled()) {
    recordDatabaseSyncOutcome({
      status: "disabled",
      source: "baseline-upload",
      pulled: 0,
      pushed: 0,
      accepted: 0,
      skipped: 0,
      pendingAfter: getPendingCloudDatabasePushKeys().length,
    });
    return { status: "disabled", pushed: 0, skipped: 0, total: 0 };
  }
  const summary = await getLocalDatabaseSyncSummary();
  const signature = `${summary.count}:${summary.deleted}:${summary.cursor}:${summary.watermark}`;
  if (
    summary.count === 0 ||
    readSyncStorage(LOCAL_DATABASE_BASELINE_UPLOAD_SIGNATURE_KEY) === signature
  ) {
    recordDatabaseSyncOutcome({
      status: "ok",
      source: "baseline-upload",
      pulled: 0,
      pushed: 0,
      accepted: 0,
      skipped: 0,
      pendingAfter: getPendingCloudDatabasePushKeys().length,
    });
    return { status: "ok", pushed: 0, skipped: 0, total: 0 };
  }
  const records = await getAllDatabaseRecordsForSync();
  if (records.length === 0) {
    writeSyncStorage(LOCAL_DATABASE_BASELINE_UPLOAD_SIGNATURE_KEY, signature);
    recordDatabaseSyncOutcome({
      status: "ok",
      source: "baseline-upload",
      pulled: 0,
      pushed: 0,
      accepted: 0,
      skipped: 0,
      pendingAfter: getPendingCloudDatabasePushKeys().length,
    });
    return { status: "ok", pushed: 0, skipped: 0, total: 0 };
  }

  const result = await pushCloudDatabaseRecordsInBatches(records);
  if (result.status !== "ok") {
    recordDatabaseSyncOutcome({
      status: result.status,
      source: "baseline-upload",
      pulled: 0,
      pushed: result.pushed,
      accepted: result.acceptedKeys?.length ?? result.pushed,
      skipped: result.skipped,
      pendingAfter: getPendingCloudDatabasePushKeys().length,
      message: result.message ?? null,
    });
    return result;
  }
  writeSyncStorage(LOCAL_DATABASE_BASELINE_UPLOAD_SIGNATURE_KEY, signature);
  setLastDatabaseSyncAtNow();
  recordDatabaseSyncOutcome({
    status: "ok",
    source: "baseline-upload",
    pulled: 0,
    pushed: result.pushed,
    accepted: result.acceptedKeys?.length ?? result.pushed,
    skipped: result.skipped,
    pendingAfter: getPendingCloudDatabasePushKeys().length,
  });
  return result;
}

export async function pushPendingLocalDatabaseChangesToCloud(): Promise<PushLocalDatabasesResult> {
  if (!isDatabaseSyncEnabled()) {
    recordDatabaseSyncOutcome({
      status: "disabled",
      source: "sync-log-push",
      pulled: 0,
      pushed: 0,
      accepted: 0,
      skipped: 0,
      pendingAfter: getPendingCloudDatabasePushKeys().length,
    });
    return { status: "disabled", pushed: 0, skipped: 0, total: 0 };
  }
  const pending = await getPendingDatabaseSyncRecords(200);
  if (pending.entries.length === 0) {
    recordDatabaseSyncOutcome({
      status: "ok",
      source: "sync-log-push",
      pulled: 0,
      pushed: 0,
      accepted: 0,
      skipped: 0,
      pendingAfter: getPendingCloudDatabasePushKeys().length,
    });
    return { status: "ok", pushed: 0, skipped: 0, total: pending.entries.length };
  }
  const pendingLogIds = pending.entries.map((entry) => entry.logId);
  const foundKeys = new Set(pending.records.map(getRemoteDatabaseRecordKey));
  const missingLogIds = pending.entries
    .filter((entry) => !foundKeys.has(entry.key))
    .map((entry) => entry.logId);
  if (pending.records.length === 0) {
    await markDatabaseSyncLogEntriesFailed(
      missingLogIds,
      MISSING_DATABASE_SYNC_LOG_RECORD_MESSAGE
    );
    emitDatabaseSyncStatusChanged();
    const next: PushLocalDatabasesResult = {
      status: "error",
      pushed: 0,
      skipped: 0,
      total: pending.entries.length,
      message: MISSING_DATABASE_SYNC_LOG_RECORD_MESSAGE,
    };
    recordDatabaseSyncOutcome({
      status: next.status,
      source: "sync-log-push",
      pulled: 0,
      pushed: 0,
      accepted: 0,
      skipped: 0,
      pendingAfter: getPendingCloudDatabasePushKeys().length,
      message: next.message ?? null,
    });
    return next;
  }
  await markDatabaseSyncLogEntriesAttempted(pendingLogIds);
  emitDatabaseSyncStatusChanged();
  let result: PushLocalDatabasesResult;
  try {
    result = await pushCloudDatabaseRecordsInBatches(pending.records);
  } catch (error) {
    const message =
      error instanceof Error
        ? `database sync_log push interrupted: ${error.message}`
        : "database sync_log push interrupted";
    await markDatabaseSyncLogEntriesFailed(pendingLogIds, message);
    emitDatabaseSyncStatusChanged();
    const next: PushLocalDatabasesResult = {
      status: "error",
      pushed: 0,
      skipped: 0,
      total: pending.entries.length,
      message,
    };
    recordDatabaseSyncOutcome({
      status: next.status,
      source: "sync-log-push",
      pulled: 0,
      pushed: 0,
      accepted: 0,
      skipped: 0,
      pendingAfter: getPendingCloudDatabasePushKeys().length,
      message: next.message ?? null,
    });
    return next;
  }
  if (result.status !== "ok") {
    const acknowledged = new Set([
      ...(result.acceptedKeys ?? []),
      ...(result.skippedKeys ?? []),
    ]);
    const acknowledgedLogIds = pending.entries
      .filter((entry) => acknowledged.has(entry.key))
      .map((entry) => entry.logId);
    const marked = await markDatabaseSyncLogEntriesSynced(acknowledgedLogIds);
    const failedLogIds = pending.entries
      .filter((entry) => !acknowledged.has(entry.key) && foundKeys.has(entry.key))
      .map((entry) => entry.logId);
    await markDatabaseSyncLogEntriesFailed(
      failedLogIds,
      result.message ?? result.status
    );
    await markDatabaseSyncLogEntriesFailed(
      missingLogIds,
      MISSING_DATABASE_SYNC_LOG_RECORD_MESSAGE
    );
    emitDatabaseSyncStatusChanged();
    const next: PushLocalDatabasesResult = { ...result, marked };
    recordDatabaseSyncOutcome({
      status: next.status,
      source: "sync-log-push",
      pulled: 0,
      pushed: next.pushed,
      accepted: next.acceptedKeys?.length ?? next.pushed,
      skipped: next.skipped,
      pendingAfter: getPendingCloudDatabasePushKeys().length,
      message: next.message ?? null,
    });
    return next;
  }
  const acknowledged = new Set([
    ...(result.acceptedKeys ?? []),
    ...(result.skippedKeys ?? []),
  ]);
  const marked = await markDatabaseSyncLogEntriesSynced(
    pending.entries
      .filter((entry) => acknowledged.has(entry.key))
      .map((entry) => entry.logId)
  );
  emitDatabaseSyncStatusChanged();
  if (missingLogIds.length > 0) {
    await markDatabaseSyncLogEntriesFailed(
      missingLogIds,
      MISSING_DATABASE_SYNC_LOG_RECORD_MESSAGE
    );
    emitDatabaseSyncStatusChanged();
    const next: PushLocalDatabasesResult = {
      status: "error",
      pushed: result.pushed,
      skipped: result.skipped,
      total: pending.entries.length,
      marked,
      acceptedKeys: result.acceptedKeys,
      skippedKeys: result.skippedKeys,
      message: MISSING_DATABASE_SYNC_LOG_RECORD_MESSAGE,
    };
    recordDatabaseSyncOutcome({
      status: next.status,
      source: "sync-log-push",
      pulled: 0,
      pushed: next.pushed,
      accepted: next.acceptedKeys?.length ?? next.pushed,
      skipped: next.skipped,
      pendingAfter: getPendingCloudDatabasePushKeys().length,
      message: next.message ?? null,
    });
    return next;
  }
  const next: PushLocalDatabasesResult = {
    status: "ok",
    pushed: result.pushed,
    skipped: result.skipped,
    total: pending.entries.length,
    marked,
  };
  recordDatabaseSyncOutcome({
    status: next.status,
    source: "sync-log-push",
    pulled: 0,
    pushed: next.pushed,
    accepted: result.acceptedKeys?.length ?? next.pushed,
    skipped: next.skipped,
    pendingAfter: getPendingCloudDatabasePushKeys().length,
  });
  return next;
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
  const result = await reconcileDatabaseSyncCore(options);
  return recordReconcileDatabaseSyncOutcome(result);
}

async function reconcileDatabaseSyncCore(
  options: DatabaseReconcileOptions = {}
): Promise<DatabaseReconcileResult> {
  if (!isDatabaseSyncEnabled()) {
    return { status: "disabled", pulled: 0, pushed: 0, skipped: 0 };
  }
  if (options.forceAccountGate) {
    const accountGate = await checkAccountCloudSyncGate({ force: true });
    if (accountGate.status !== "ready") {
      const status = getAuthRetryStatusFromAccountGate(accountGate.status);
      rememberAuthRetryStatus(status);
      return {
        status,
        pulled: 0,
        pushed: 0,
        skipped: 0,
        message: getAccountGateDatabaseSyncMessage(accountGate.status),
      };
    }
    rememberAuthRetryStatus("ok");
  }
  const queuedPush = await flushPendingCloudDatabasePushes({
    includeManualReview: options.includeManualReview,
  });
  if (queuedPush.status !== "ok") {
    return {
      status: queuedPush.status,
      pulled: 0,
      pushed: queuedPush.pushed,
      skipped: queuedPush.skipped,
      message: queuedPush.message,
    };
  }
  const baselineUpload = await uploadLocalDatabaseBaselineIfNeeded();
  const initialPushed = queuedPush.pushed + baselineUpload.pushed;
  const initialSkipped = queuedPush.skipped + baselineUpload.skipped;
  const bootstrapped =
    baselineUpload.total > 0 ? baselineUpload.total : undefined;
  if (baselineUpload.status !== "ok") {
    return {
      status: baselineUpload.status,
      pulled: 0,
      pushed: initialPushed,
      skipped: initialSkipped,
      bootstrapped,
      message: baselineUpload.message,
    };
  }

  let cursor = getRemoteCursor();
  let prePullPulled = 0;
  const prePullRecords: CloudDatabaseRecord[] = [];
  if (
    cursor &&
    (await shouldRecoverDatabaseMetadataCoverageBeforeIncrementalPull(cursor))
  ) {
    const metadata = await syncCloudDatabaseMetadataDelta({
      force: true,
      requireLocalCacheCoverage: true,
    });
    if (metadata.status !== "ok") {
      return {
        status: metadata.status,
        pulled: metadata.pulled,
        pushed: initialPushed,
        skipped: initialSkipped,
        bootstrapped,
        records: metadata.records,
        message: metadata.message,
      };
    }
    cursor = getRemoteCursor();
    prePullPulled = metadata.pulled;
    prePullRecords.push(...metadata.records);
  }
  if (!cursor) {
    const summaryRes = await call({ action: "summary" });
    if (!summaryRes.ok) {
      return {
        status: summaryRes.status,
        pulled: 0,
        pushed: initialPushed,
        skipped: initialSkipped,
        bootstrapped,
        message: summaryRes.message,
      };
    }
    const summary = normalizeSummary(summaryRes.json.summary);
    if (summary && (await restoreCursorFromLocalDatabaseMetadata(summary))) {
      cursor = getRemoteCursor();
      if (!cursor) {
        const push = await pushPendingLocalDatabaseChangesToCloud();
        if (push.status !== "ok") {
          return {
            status: push.status,
            pulled: 0,
            pushed: initialPushed + push.pushed,
            skipped: initialSkipped + push.skipped,
            bootstrapped,
            message: push.message,
          };
        }
        return {
          status: "ok",
          pulled: 0,
          pushed: initialPushed + push.pushed,
          skipped: initialSkipped + push.skipped,
          bootstrapped,
        };
      }
    } else {
      const fastForward = summary
        ? await fastForwardDatabaseMetadataDeltaFromLocalCursor(summary)
        : null;
      if (fastForward) {
        if (fastForward.status !== "ok") {
          return {
            status: fastForward.status,
            pulled: fastForward.pulled,
            pushed: initialPushed,
            skipped: initialSkipped,
            bootstrapped,
            records: fastForward.records,
            message: fastForward.message,
          };
        }
        cursor = getRemoteCursor();
        prePullPulled = fastForward.pulled;
        prePullRecords.push(...fastForward.records);
      }
      if (!cursor) {
        const metadata = await syncCloudDatabaseMetadata();
        if (metadata.status !== "ok") {
          return {
            status: metadata.status,
            pulled: 0,
            pushed: initialPushed,
            skipped: initialSkipped,
            bootstrapped,
            message: metadata.message,
          };
        }
        const push = await pushPendingLocalDatabaseChangesToCloud();
        if (push.status !== "ok") {
          return {
            status: push.status,
            pulled: metadata.pulled,
            pushed: initialPushed + push.pushed,
            skipped: initialSkipped + push.skipped,
            bootstrapped,
            message: push.message,
          };
        }
        return {
          status: "ok",
          pulled: metadata.pulled,
          pushed: initialPushed + push.pushed,
          skipped: initialSkipped + push.skipped,
          bootstrapped,
          records: metadata.records,
        };
      }
    }
  }

  const pull = await syncCloudDatabaseDelta(
    options.quick ? { maxBatches: QUICK_INCREMENTAL_BATCH_LIMIT } : {}
  );
  if (pull.status !== "ok") {
    return {
      status: pull.status,
      pulled: prePullPulled + pull.pulled,
      pushed: initialPushed,
      skipped: initialSkipped,
      bootstrapped,
      records: [...prePullRecords, ...(pull.records ?? [])],
      message: pull.message,
    };
  }
  const push = await pushPendingLocalDatabaseChangesToCloud();
  if (push.status !== "ok") {
    return {
      status: push.status,
      pulled: prePullPulled + pull.pulled,
      pushed: initialPushed + push.pushed,
      skipped: initialSkipped + push.skipped,
      bootstrapped,
      message: push.message,
    };
  }
  return {
    status: "ok",
    pulled: prePullPulled + pull.pulled,
    pushed: initialPushed + push.pushed,
    skipped: initialSkipped + push.skipped,
    bootstrapped,
    records: [...prePullRecords, ...(pull.records ?? [])],
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
  clearAllPendingCloudDatabasePushesForCacheRebuild();
  clearDatabaseSyncRuntimeCachesForCacheRebuild();
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

function normalizePendingCloudDatabasePushError(
  status: DatabaseSyncStatus,
  message?: string
): string {
  const detail = message?.trim();
  const raw = detail ? `${status}: ${detail}` : status;
  return raw.slice(0, 220);
}

function formatSyncBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
}

function newestIso(values: Array<string | null | undefined>): string | null {
  let newest: string | null = null;
  for (const value of values) {
    if (!value || Number.isNaN(Date.parse(value))) continue;
    if (!newest || value > newest) newest = value;
  }
  return newest;
}

function normalizeDatabaseSyncLastOutcome(
  value: string | DatabaseSyncLastOutcome | null | undefined
): DatabaseSyncLastOutcome | null {
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  const source = (parsed as { source?: unknown }).source;
  const status = (parsed as { status?: unknown }).status;
  const at = (parsed as { at?: unknown }).at;
  if (
    source !== "direct-push" &&
    source !== "pending-push" &&
    source !== "sync-log-push" &&
    source !== "baseline-upload" &&
    source !== "reconcile"
  ) {
    return null;
  }
  if (
    status !== "ok" &&
    status !== "unauthenticated" &&
    status !== "unconfigured" &&
    status !== "unconfirmed" &&
    status !== "disabled" &&
    status !== "error"
  ) {
    return null;
  }
  if (typeof at !== "string" || Number.isNaN(Date.parse(at))) return null;

  const pulled = normalizeNonNegativeCount(
    (parsed as { pulled?: unknown }).pulled
  );
  const pushed = normalizeNonNegativeCount(
    (parsed as { pushed?: unknown }).pushed
  );
  const accepted = normalizeNonNegativeCount(
    (parsed as { accepted?: unknown }).accepted
  );
  const skipped = normalizeNonNegativeCount(
    (parsed as { skipped?: unknown }).skipped
  );
  const pendingAfter = normalizeNonNegativeCount(
    (parsed as { pendingAfter?: unknown }).pendingAfter
  );
  const message = (parsed as { message?: unknown }).message;
  return {
    status,
    source,
    at,
    pulled,
    pushed,
    accepted,
    skipped,
    pendingAfter,
    message:
      typeof message === "string" && message.trim()
        ? message.trim().slice(0, 220)
        : null,
  };
}

function normalizeNonNegativeCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}

function recordDatabaseSyncOutcome(
  outcome: Omit<DatabaseSyncLastOutcome, "at" | "message"> & {
    at?: string;
    message?: string | null;
  }
): void {
  const next: DatabaseSyncLastOutcome = {
    ...outcome,
    at: outcome.at ?? new Date().toISOString(),
    message:
      typeof outcome.message === "string" && outcome.message.trim()
        ? outcome.message.trim().slice(0, 220)
        : null,
  };
  memoryLastDatabaseSyncOutcome = next;
  writeSyncStorage(LAST_OUTCOME_KEY, JSON.stringify(next));
}

function recordReconcileDatabaseSyncOutcome(
  result: DatabaseReconcileResult
): DatabaseReconcileResult {
  recordDatabaseSyncOutcome({
    status: result.status,
    source: "reconcile",
    pulled: result.pulled,
    pushed: result.pushed,
    accepted: result.pushed,
    skipped: result.skipped,
    pendingAfter: getPendingCloudDatabasePushKeys().length,
    message: result.message ?? null,
  });
  emitDatabaseSyncStatusChanged();
  return result;
}
