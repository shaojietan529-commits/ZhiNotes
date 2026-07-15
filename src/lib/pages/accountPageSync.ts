"use client";

// Account-scoped page cloud sync engine (client side).
//
// On by default for signed-in browsers, with a local opt-out switch on
// /account (stored in localStorage). When enabled and signed in, reconcile
// treats the account cloud as the source of truth and:
//   - pulls remote pages that are newer or missing locally
//   - uploads the local browser's first signed-in baseline once, so existing
//     notes from the first device can appear on other signed-in devices
//   - pushes later explicit local edits/deletes recorded in the pending queue
// Conflicts resolve through explicit writes; the browser page table is only a
// rebuildable cache, so a stale local row must not auto-promote itself to cloud.
//
// Only page fields sync: title, body HTML, hierarchy, position, icon,
// properties, cover. Databases, files, comments and versions stay local.

import {
  applyRemotePageMetadata,
  applyRemotePages,
  clearLocalPageCacheExceptIds,
  clearLocalPageCacheForIds,
  getAllPageMetadata,
  getAllPagesForSync,
  getPagesForSyncByIds,
  getPageSyncLogPendingCounts,
  getPendingPageSyncRecords,
  getLocalPageSyncSummary,
  getNextPosition,
  markPageSyncLogEntriesAttempted,
  markPageSyncLogEntriesFailed,
  markPageSyncLogEntriesSynced,
  movePage,
  deletePage,
  updatePage,
  type RemotePageRecord,
} from "@/lib/db/local/queries";
import { MODULE_WORKSPACE_LIST } from "@/lib/pages/moduleWorkspaces";
import {
  createPageProperty,
  parsePageProperties,
  stringifyPageProperties,
} from "@/lib/pages/pageProperties";
import {
  emitPagesUpdated,
  type PageUpdatePayload,
} from "@/lib/pages/pageUpdateBus";
import {
  checkAccountCloudSyncGate,
  type AccountCloudSyncGateStatus,
} from "@/lib/account/accountCloudSyncGate";
import type { Page } from "@/lib/utils/types";

const ENABLED_KEY = "zhinote.pagesync.enabled";
const LAST_SYNC_KEY = "zhinote.pagesync.lastSyncAt";
const REMOTE_WATERMARK_KEY = "zhinote.pagesync.remoteWatermark";
const REMOTE_CURSOR_KEY = "zhinote.pagesync.remoteCursor";
const PENDING_PUSH_IDS_KEY = "zhinote.pagesync.pendingPushIds";
const PENDING_PUSH_META_KEY = "zhinote.pagesync.pendingPushMeta";
const AUTH_RETRY_KEY = "zhinote.pagesync.authRetry.v1";
const LOCAL_BASELINE_UPLOAD_SIGNATURE_KEY =
  "zhinote.pagesync.localBaselineUploadSignature.v1";
export const PAGE_SYNC_STORAGE_KEY_PREFIX = "zhinote.pagesync.";
const DAILY_IMPORT_REPAIR_SIGNATURE_KEY =
  "zhinote.pagesync.dailyImportRepairSignature.v1";
export const PAGE_SYNC_CONFIG_EVENT = "zhinote:pagesync-config";
export const PAGE_SYNC_STATUS_EVENT = "zhinote:pagesync-status";

const PULL_BATCH = 40;
const PUSH_BATCH_RECORDS = 50;
const PUSH_BATCH_BYTES = 800 * 1024;
const INCREMENTAL_PULL_LIMIT = 50;
const QUICK_INCREMENTAL_BATCH_LIMIT = 3;
const METADATA_DELTA_THROTTLE_MS = 2500;
const PAGE_LOOKUP_CACHE_MS = 4000;
const PAGE_LOOKUP_CACHE_LIMIT = 60;
const ACCOUNT_PAGE_SYNC_REQUEST_TIMEOUT_MS = 12000;
const ACCOUNT_PAGE_SYNC_METADATA_REQUEST_TIMEOUT_MS = 3200;
const AUTH_RETRY_BACKOFF_MS = 2 * 60 * 1000;
const AUTH_RETRY_PROBE_WINDOW_KEY = "__zhinotePageSyncAuthRetryProbe";
// Covers stored as data URLs can be multi-MB; skip oversized ones rather
// than failing the whole page push.
const MAX_COVER_CHARS = 300 * 1024;
const CLOUD_PUSH_DEBOUNCE_MS = 1000;
let queuedCloudPush = new Map<string, RemotePageRecord>();
let queuedCloudPushTimer: ReturnType<typeof setTimeout> | null = null;
let metadataDeltaInFlight: Promise<CloudPageMetadataDeltaResult> | null = null;
let lastMetadataDeltaAt = 0;
let lastMetadataDeltaResult: CloudPageMetadataDeltaResult | null = null;
let metadataDeltaGeneration = 0;
const pageLookupInFlight = new Map<string, Promise<CloudPageLookupResult>>();
const pageLookupCache = new Map<
  string,
  { cachedAt: number; result: CloudPageLookupResult }
>();
let authRetryAfter = 0;
let authRetryStatus: PageSyncStatus | null = null;
let authRetryProbeInFlight: Promise<AuthRetryProbeStatus> | null = null;
let memoryRemoteWatermark: string | null = null;
let memoryRemoteCursor: string | null = null;
let memoryLastPageSyncAt: string | null = null;
let memoryDailyImportRepairSignature: string | null = null;

export function isPageSyncEnabled(): boolean {
  if (typeof window === "undefined") return false;
  // On by default (opt-out): the owner asked for both domains to stay in
  // sync automatically, so only an explicit "false" disables it. Sync still
  // does nothing unless the browser is signed in to the account.
  return readSyncStorage(ENABLED_KEY) !== "false";
}

export function setPageSyncEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  authRetryStatus = null;
  authRetryAfter = 0;
  writeSyncStorage(ENABLED_KEY, String(enabled));
  window.dispatchEvent(new CustomEvent(PAGE_SYNC_CONFIG_EVENT));
  emitPageSyncStatusChanged();
}

export function getLastPageSyncAt(): string | null {
  return readSyncStorage(LAST_SYNC_KEY) ?? memoryLastPageSyncAt;
}

export type PageSyncStatus =
  | "ok"
  | "unauthenticated"
  | "unconfigured"
  | "unconfirmed"
  | "disabled"
  | "error";

export interface ReconcileResult {
  status: PageSyncStatus;
  pulled: number;
  pushed: number;
  bootstrapped?: number;
  repaired?: number;
  message?: string;
  skipped?: boolean;
}

export interface PendingCloudPageSyncStatus {
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
  manualReviewSampleIds: string[];
  oldestPendingQueuedAt: string | null;
  lastAttemptAt: string | null;
  lastFailureAt: string | null;
  lastFailureMessage: string | null;
  pendingSampleIds: string[];
  failedSampleIds: string[];
  authRetryStatus: PageSyncStatus | null;
  authRetryUntil: string | null;
  lastSyncAt: string | null;
}

export type CloudPageSyncItemState =
  | "synced"
  | "queued"
  | "pending"
  | "failed"
  | "manual-review";

export interface CloudPageSyncItemStatus {
  pageId: string;
  state: CloudPageSyncItemState;
  pending: boolean;
  queued: boolean;
  failed: boolean;
  manualReview: boolean;
  failureCount: number;
  lastAttemptAt: string | null;
  lastFailureAt: string | null;
  lastFailureMessage: string | null;
  authRetryStatus: PageSyncStatus | null;
  authRetryUntil: string | null;
}

interface PendingCloudPushMetaEntry {
  queuedAt: string;
  lastAttemptAt?: string;
  lastFailureAt?: string;
  lastError?: string;
  failureCount?: number;
}

type PendingCloudPushMeta = Record<string, PendingCloudPushMetaEntry>;
const PENDING_CLOUD_PAGE_MANUAL_REVIEW_FAILURE_COUNT = 3;
type AuthRetryProbeStatus = PageSyncStatus | "ok";
type AuthRetryProbeWindow = Window & {
  [AUTH_RETRY_PROBE_WINDOW_KEY]?: Promise<AuthRetryProbeStatus>;
};

function getAuthRetryStatusFromAccountGate(
  status: AccountCloudSyncGateStatus
): PageSyncStatus {
  if (status === "signed-out") return "unauthenticated";
  if (status === "unconfigured") return "unconfigured";
  if (status === "unconfirmed") return "unconfirmed";
  return "error";
}

function getAccountGatePageSyncMessage(
  status: AccountCloudSyncGateStatus
): string {
  if (status === "signed-out") {
    return "当前未登录，请登录后再同步页面；本地输入已保留。";
  }
  if (status === "unconfigured") {
    return "页面云同步账号系统未配置；本地输入已保留。";
  }
  if (status === "unconfirmed") {
    return "账号登录状态暂时无法确认，本地输入已保留，会稍后重试。";
  }
  return "账号云端暂时无法确认，本地输入已保留，会稍后重试。";
}

export interface PullCloudPageResult {
  status: PageSyncStatus;
  pulled: number;
  message?: string;
}

export interface PullDailyCloudResult {
  status: PageSyncStatus;
  pulled: number;
  total: number;
  failed?: number;
  failedReason?: string;
  scanned?: number;
  message?: string;
}

export interface RebuildPageCacheResult {
  status: PageSyncStatus;
  cleared: number;
  pruned: number;
  pulled: number;
  total: number;
  repaired?: number;
  preservedLocalPrivate?: number;
  message?: string;
}

export interface CloudPageLookupResult {
  status: PageSyncStatus;
  pages: RemotePageRecord[];
  message?: string;
}

export interface CloudPageMetadataResult {
  status: PageSyncStatus;
  pages: RemotePageRecord[];
  total: number;
  scanned?: number;
  message?: string;
}

export interface CloudPageMetadataDeltaResult {
  status: PageSyncStatus;
  pulled: number;
  pages: RemotePageRecord[];
  fullRefresh: boolean;
  throttled?: boolean;
  message?: string;
}

export interface CloudPageChangesResult {
  status: PageSyncStatus;
  pages: RemotePageRecord[];
  count: number;
  totalChanged: number;
  cursor: string;
  hasMore: boolean;
  summary?: IndexSummary;
  message?: string;
}

export interface PushCloudPagesResult {
  status: PageSyncStatus;
  accepted: string[];
  skipped: string[];
  message?: string;
}

export interface PushLocalPagesResult {
  status: PageSyncStatus;
  pushed: number;
  skipped: number;
  total: number;
  marked?: number;
  acceptedIds?: string[];
  skippedIds?: string[];
  message?: string;
}

export interface DailyCloudMetadataResult {
  status: PageSyncStatus;
  pages: RemotePageRecord[];
  total: number;
  rootId?: string | null;
  matched?: number;
  rangeCount?: number;
  recentCount?: number;
  scanned?: number;
  cached?: boolean;
  watermark?: string;
  message?: string;
}

export interface MeetingCloudMetadataResult {
  status: PageSyncStatus;
  pages: RemotePageRecord[];
  total: number;
  rootId?: string | null;
  matched?: number;
  rangeCount?: number;
  recentCount?: number;
  scanned?: number;
  cached?: boolean;
  watermark?: string;
  message?: string;
}

interface DailyCloudMetadataOptions {
  startDate?: string;
  endDate?: string;
  recentLimit?: number;
}

interface MeetingCloudMetadataOptions {
  startDate?: string;
  endDate?: string;
  recentLimit?: number;
}

interface AccountPageSyncCallOptions {
  timeoutMs?: number;
  timeoutMessage?: string;
  softTimeout?: boolean;
}

interface IndexEntry {
  u: string;
  d: 0 | 1;
}

interface IndexSummary {
  count: number;
  deleted: number;
  maxUpdatedAt: string;
  watermark: string;
  cursor: string;
}

export interface CloudPageManifestSummaryResult {
  status: PageSyncStatus;
  summary: IndexSummary | null;
  message?: string;
}

export interface CloudPageDomainManifestSummaryResult {
  status: PageSyncStatus;
  summary: IndexSummary | null;
  rootId?: string | null;
  matched?: number;
  scanned?: number;
  cached?: boolean;
  message?: string;
}

interface ReconcileOptions {
  quick?: boolean;
  includeManualReview?: boolean;
  forceAccountGate?: boolean;
}

interface FlushPendingCloudPushOptions {
  includeManualReview?: boolean;
}

const CLOUD_DOMAIN_SUMMARY_START_DATE = "2000-01-01";
const CLOUD_DOMAIN_SUMMARY_END_DATE = "2099-12-31";

async function call(
  body: Record<string, unknown>,
  options: AccountPageSyncCallOptions = {}
): Promise<
  | { ok: true; json: Record<string, unknown> }
  | { ok: false; status: PageSyncStatus; message?: string }
> {
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
    const res = await fetchAccountPageSync(body, options.timeoutMs);
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
          "页面同步接口暂时无法确认账号权限；已保留本地输入并稍后重试。",
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
              : "页面同步接口暂时无法确认账号权限；已保留本地输入并稍后重试。",
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
    const timedOut = isAbortError(error);
    if (!timedOut || !options.softTimeout) {
      probeStatus = "error";
      rememberAuthRetryStatus("error");
    }
    return {
      ok: false,
      status: "error",
      message: timedOut
        ? (options.timeoutMessage ??
          "页面同步请求超时；本地输入已保留，会稍后重试。")
        : "网络错误",
    };
  } finally {
    finishAuthRetryProbe(probeStatus);
  }
}

async function fetchAccountPageSync(
  body: Record<string, unknown>,
  timeoutMs = ACCOUNT_PAGE_SYNC_REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch("/api/pages/account-sync", {
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

function isValidRemotePageId(value: string): boolean {
  return value.length > 0 && value.length <= 64 && /^[A-Za-z0-9_-]+$/.test(value);
}

export async function pullCloudPagesByIds(
  ids: string[]
): Promise<PullCloudPageResult> {
  if (!isPageSyncEnabled()) {
    return { status: "disabled", pulled: 0 };
  }
  const uniqueIds = Array.from(new Set(ids.filter(isValidRemotePageId)));
  if (uniqueIds.length === 0) {
    return { status: "ok", pulled: 0 };
  }
  const res = await call({ action: "pull", ids: uniqueIds });
  if (!res.ok) {
    return { status: res.status, pulled: 0, message: res.message };
  }
  const pages = Array.isArray(res.json.pages)
    ? (res.json.pages as RemotePageRecord[])
    : [];
  if (pages.length > 0) {
    await applyRemotePages(pages);
    setLastPageSyncAtNow();
    emitPagesUpdated("cloud-pull", pages.length, toPageUpdatePayloads(pages));
  }
  return { status: "ok", pulled: pages.length };
}

export async function pullCloudPageById(
  id: string
): Promise<PullCloudPageResult> {
  return pullCloudPagesByIds([id]);
}

export async function fetchCloudPagesByIds(
  ids: string[]
): Promise<CloudPageLookupResult> {
  if (!isPageSyncEnabled()) {
    return { status: "disabled", pages: [] };
  }
  const uniqueIds = Array.from(new Set(ids.filter(isValidRemotePageId)));
  if (uniqueIds.length === 0) {
    return { status: "ok", pages: [] };
  }
  const cacheKey = cloudPageLookupCacheKey(uniqueIds);
  const cached = readCloudPageLookupCache(cacheKey);
  if (cached) return cached;
  const inFlight = pageLookupInFlight.get(cacheKey);
  if (inFlight) return inFlight;

  const request = runFetchCloudPagesByIds(uniqueIds).finally(() => {
    pageLookupInFlight.delete(cacheKey);
  });
  pageLookupInFlight.set(cacheKey, request);
  const result = await request;
  rememberCloudPageLookupResult(cacheKey, result);
  return result;
}

async function runFetchCloudPagesByIds(
  uniqueIds: string[]
): Promise<CloudPageLookupResult> {
  const res = await call({ action: "pull", ids: uniqueIds });
  if (!res.ok) {
    return { status: res.status, pages: [], message: res.message };
  }
  const pages = Array.isArray(res.json.pages)
    ? (res.json.pages as RemotePageRecord[])
    : [];
  return { status: "ok", pages };
}

function cloudPageLookupCacheKey(ids: string[]): string {
  return ids.slice().sort().join("\n");
}

function readCloudPageLookupCache(
  key: string
): CloudPageLookupResult | null {
  const cached = pageLookupCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.cachedAt > PAGE_LOOKUP_CACHE_MS) {
    pageLookupCache.delete(key);
    return null;
  }
  return cached.result;
}

function rememberCloudPageLookupResult(
  key: string,
  result: CloudPageLookupResult
): void {
  if (result.status !== "ok") return;
  pageLookupCache.set(key, { cachedAt: Date.now(), result });
  while (pageLookupCache.size > PAGE_LOOKUP_CACHE_LIMIT) {
    const oldestKey = pageLookupCache.keys().next().value;
    if (!oldestKey) break;
    pageLookupCache.delete(oldestKey);
  }
}

export async function fetchCloudPageById(
  id: string
): Promise<CloudPageLookupResult> {
  return fetchCloudPagesByIds([id]);
}

export async function getCloudPageManifestSummary(): Promise<CloudPageManifestSummaryResult> {
  if (!isPageSyncEnabled()) {
    return { status: "disabled", summary: null };
  }
  const res = await call({ action: "summary" });
  if (!res.ok) {
    return { status: res.status, summary: null, message: res.message };
  }
  const summary = normalizeSummary(res.json.summary);
  if (!summary) {
    return {
      status: "error",
      summary: null,
      message: "云端页面 manifest summary 格式无效",
    };
  }
  return { status: "ok", summary };
}

function summarizeRemotePageMetadataRecords(
  records: RemotePageRecord[]
): IndexSummary {
  let deleted = 0;
  let maxUpdatedAt = "";
  let maxUpdatedId = "";
  for (const record of records) {
    if (record.deleted_at) deleted += 1;
    const updatedAt = record.updated_at || "";
    if (
      updatedAt > maxUpdatedAt ||
      (updatedAt === maxUpdatedAt && record.id > maxUpdatedId)
    ) {
      maxUpdatedAt = updatedAt;
      maxUpdatedId = record.id;
    }
  }
  return {
    count: records.length,
    deleted,
    maxUpdatedAt,
    watermark: `${records.length}:${deleted}:${maxUpdatedAt}`,
    cursor: maxUpdatedAt
      ? JSON.stringify({ updatedAt: maxUpdatedAt, id: maxUpdatedId })
      : "",
  };
}

export async function getCloudDailyManifestSummary(): Promise<CloudPageDomainManifestSummaryResult> {
  const result = await fetchDailyCloudMetadata({
    startDate: CLOUD_DOMAIN_SUMMARY_START_DATE,
    endDate: CLOUD_DOMAIN_SUMMARY_END_DATE,
    recentLimit: 0,
  });
  if (result.status !== "ok") {
    return {
      status: result.status,
      summary: null,
      message: result.message,
    };
  }
  return {
    status: "ok",
    summary: summarizeRemotePageMetadataRecords(result.pages),
    rootId: result.rootId,
    matched: result.matched,
    scanned: result.scanned,
    cached: result.cached,
  };
}

export async function getCloudMeetingManifestSummary(): Promise<CloudPageDomainManifestSummaryResult> {
  const result = await fetchMeetingCloudMetadata({
    startDate: CLOUD_DOMAIN_SUMMARY_START_DATE,
    endDate: CLOUD_DOMAIN_SUMMARY_END_DATE,
    recentLimit: 0,
  });
  if (result.status !== "ok") {
    return {
      status: result.status,
      summary: null,
      message: result.message,
    };
  }
  return {
    status: "ok",
    summary: summarizeRemotePageMetadataRecords(result.pages),
    rootId: result.rootId,
    matched: result.matched,
    scanned: result.scanned,
    cached: result.cached,
  };
}

export async function fetchCloudPageMetadata(): Promise<CloudPageMetadataResult> {
  if (!isPageSyncEnabled()) {
    return { status: "disabled", pages: [], total: 0 };
  }
  const res = await call({ action: "metadata" });
  if (!res.ok) {
    return {
      status: res.status,
      pages: [],
      total: 0,
      message: res.message,
    };
  }
  const pages = Array.isArray(res.json.pages)
    ? (res.json.pages as RemotePageRecord[])
    : [];
  const summary = normalizeSummary(res.json.summary);
  if (summary) {
    setRemoteWatermark(summary.watermark);
    setRemoteCursor(summary.cursor);
  }
  setLastPageSyncAtNow();
  return {
    status: "ok",
    pages,
    total: typeof res.json.count === "number" ? res.json.count : pages.length,
    scanned: typeof res.json.scanned === "number" ? res.json.scanned : undefined,
  };
}

export async function fetchCloudPageChangesSince(
  since: string,
  limit = INCREMENTAL_PULL_LIMIT
): Promise<CloudPageChangesResult> {
  if (!isPageSyncEnabled()) {
    return {
      status: "disabled",
      pages: [],
      count: 0,
      totalChanged: 0,
      cursor: since,
      hasMore: false,
    };
  }
  const res = await call({ action: "changes-since", since, limit });
  if (!res.ok) {
    return {
      status: res.status,
      pages: [],
      count: 0,
      totalChanged: 0,
      cursor: since,
      hasMore: false,
      message: res.message,
    };
  }
  return {
    status: "ok",
    pages: Array.isArray(res.json.pages)
      ? (res.json.pages as RemotePageRecord[])
      : [],
    count: typeof res.json.count === "number" ? res.json.count : 0,
    totalChanged:
      typeof res.json.totalChanged === "number" ? res.json.totalChanged : 0,
    cursor: typeof res.json.cursor === "string" ? res.json.cursor : since,
    hasMore: Boolean(res.json.hasMore),
    summary: normalizeSummary(res.json.summary) ?? undefined,
  };
}

async function fetchCloudPageMetadataChangesSince(
  since: string,
  limit = INCREMENTAL_PULL_LIMIT
): Promise<CloudPageChangesResult> {
  if (!isPageSyncEnabled()) {
    return {
      status: "disabled",
      pages: [],
      count: 0,
      totalChanged: 0,
      cursor: since,
      hasMore: false,
    };
  }
  const res = await call({ action: "metadata-changes-since", since, limit });
  if (!res.ok) {
    return {
      status: res.status,
      pages: [],
      count: 0,
      totalChanged: 0,
      cursor: since,
      hasMore: false,
      message: res.message,
    };
  }
  return {
    status: "ok",
    pages: Array.isArray(res.json.pages)
      ? (res.json.pages as RemotePageRecord[])
      : [],
    count: typeof res.json.count === "number" ? res.json.count : 0,
    totalChanged:
      typeof res.json.totalChanged === "number" ? res.json.totalChanged : 0,
    cursor: typeof res.json.cursor === "string" ? res.json.cursor : since,
    hasMore: Boolean(res.json.hasMore),
    summary: normalizeSummary(res.json.summary) ?? undefined,
  };
}

export async function syncCloudPageMetadataDelta(
  options: {
    force?: boolean;
    fullRefresh?: boolean;
    requireLocalCacheCoverage?: boolean;
  } = {}
): Promise<CloudPageMetadataDeltaResult> {
  if (!isPageSyncEnabled()) {
    return { status: "disabled", pulled: 0, pages: [], fullRefresh: false };
  }
  const forcedAuthRetryRecovery = await recoverAuthRetryForForcedMetadataSync(
    Boolean(options.force)
  );
  if (forcedAuthRetryRecovery) return forcedAuthRetryRecovery;
  if (shouldBackOffAuthRetry()) {
    return {
      status: authRetryStatus ?? "unauthenticated",
      pulled: 0,
      pages: [],
      fullRefresh: false,
      throttled: true,
    };
  }
  const requiresFreshCoverage =
    Boolean(options.fullRefresh) || Boolean(options.requireLocalCacheCoverage);
  if (!options.force && !requiresFreshCoverage) {
    if (metadataDeltaInFlight) return metadataDeltaInFlight;
    if (
      lastMetadataDeltaResult &&
      Date.now() - lastMetadataDeltaAt < METADATA_DELTA_THROTTLE_MS
    ) {
      return { ...lastMetadataDeltaResult, throttled: true };
    }
  }

  const generation = metadataDeltaGeneration;
  metadataDeltaInFlight = runCloudPageMetadataDelta(options);
  try {
    const result = await metadataDeltaInFlight;
    rememberAuthRetryStatus(result.status);
    if (generation === metadataDeltaGeneration) {
      lastMetadataDeltaResult = result;
      lastMetadataDeltaAt = Date.now();
    }
    return result;
  } finally {
    if (generation === metadataDeltaGeneration) {
      metadataDeltaInFlight = null;
    }
  }
}

async function recoverAuthRetryForForcedMetadataSync(
  force: boolean
): Promise<CloudPageMetadataDeltaResult | null> {
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
    pages: [],
    fullRefresh: false,
    throttled: true,
    message: getAccountGatePageSyncMessage(accountGate.status),
  };
}

function shouldBackOffAuthRetry(): boolean {
  const stored = readStoredAuthRetryStatus();
  if (stored) return true;
  return authRetryStatus !== null && Date.now() < authRetryAfter;
}

async function waitForAuthRetryProbe(): Promise<PageSyncStatus | null> {
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

function rememberAuthRetryStatus(status: PageSyncStatus): void {
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
      emitPageSyncStatusChanged();
    }
    return;
  }
  if (status === "ok" || status === "disabled") {
    authRetryStatus = null;
    authRetryAfter = 0;
    removeSyncStorage(AUTH_RETRY_KEY);
    if (previousStatus !== authRetryStatus || previousUntil !== authRetryAfter) {
      emitPageSyncStatusChanged();
    }
  }
}

function readStoredAuthRetryStatus(): PageSyncStatus | null {
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

export function recordPageSyncAuthRetryStatus(status: PageSyncStatus): void {
  rememberAuthRetryStatus(status);
}

function getAuthRetrySnapshot(): {
  status: PageSyncStatus | null;
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

async function runCloudPageMetadataDelta(
  options: { fullRefresh?: boolean; requireLocalCacheCoverage?: boolean } = {}
): Promise<CloudPageMetadataDeltaResult> {
  let nextCursor =
    options.fullRefresh || options.requireLocalCacheCoverage
      ? null
      : getRemoteCursor();
  if (!nextCursor) {
    const summaryRes = await call({ action: "summary" });
    if (summaryRes.ok) {
      const summary = normalizeSummary(summaryRes.json.summary);
      if (summary && (await restoreCursorFromLocalMetadata(summary))) {
        nextCursor = summary.cursor;
      } else if (summary) {
        const fastForward = await fastForwardMetadataDeltaFromLocalCursor(
          summary
        );
        if (fastForward) return fastForward;
      }
    } else if (
      summaryRes.status === "unauthenticated" ||
      summaryRes.status === "unconfigured"
    ) {
      return {
        status: summaryRes.status,
        pulled: 0,
        pages: [],
        fullRefresh: false,
        message: summaryRes.message,
      };
    }
  }

  if (!nextCursor) {
    const cloud = await fetchCloudPageMetadata();
    if (cloud.status !== "ok") {
      return {
        status: cloud.status,
        pulled: 0,
        pages: [],
        fullRefresh: true,
        message: cloud.message,
      };
    }
    if (cloud.pages.length > 0) {
      try {
        await applyRemotePageMetadata(cloud.pages);
        emitPagesUpdated(
          "cloud-pull",
          cloud.pages.length,
          toPageUpdatePayloads(cloud.pages)
        );
      } catch {
        // The caller can still render the returned metadata snapshot. Browser
        // cache failures should not block cloud-backed page lists.
      }
    }
    return {
      status: "ok",
      pulled: cloud.pages.length,
      pages: cloud.pages,
      fullRefresh: true,
    };
  }

  let hasMore = false;
  let pulled = 0;
  const pulledPages: RemotePageRecord[] = [];
  // Keep UI-triggered refresh bounded. The background sync hook continues
  // converging if a very large import has more changes after this pass.
  let batches = 0;
  do {
    const changes = await fetchCloudPageMetadataChangesSince(nextCursor);
    if (changes.status !== "ok") {
      return {
        status: changes.status,
        pulled,
        pages: pulledPages,
        fullRefresh: false,
        message: changes.message,
      };
    }
    if (changes.pages.length > 0) {
      try {
        await applyRemotePageMetadata(changes.pages);
      } catch {
        // Keep going: usePages can render the returned metadata directly if
        // the local cache cannot be rebuilt on this device.
      }
      pulled += changes.pages.length;
      pulledPages.push(...changes.pages);
    }
    if (changes.summary) {
      setRemoteWatermark(changes.summary.watermark);
    }
    setRemoteCursor(changes.cursor);
    nextCursor = changes.cursor;
    hasMore = changes.hasMore;
    batches += 1;
  } while (hasMore && batches < 3);

  if (pulled > 0) {
    emitPagesUpdated("cloud-pull", pulled, toPageUpdatePayloads(pulledPages));
  }
  setLastPageSyncAtNow();
  return {
    status: "ok",
    pulled,
    pages: pulledPages,
    fullRefresh: false,
  };
}

export async function pushCloudPages(
  records: RemotePageRecord[]
): Promise<PushCloudPagesResult> {
  markPendingCloudPushRecords(records);
  markPendingCloudPushAttemptRecords(records);
  emitPageSyncStatusChanged();
  if (!isPageSyncEnabled()) {
    return { status: "disabled", accepted: [], skipped: [] };
  }
  const res = await call({ action: "push", pages: records });
  if (!res.ok) {
    markPendingCloudPushFailedRecords(records, res.status, res.message);
    emitPageSyncStatusChanged();
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
  const acknowledgedIds = [...accepted, ...skipped];
  clearPendingCloudPushIds(acknowledgedIds);
  void markAcknowledgedPageSyncIds(acknowledgedIds).catch(() => {
    // Keep the upload success path non-blocking; the next status refresh will
    // surface any unacknowledged local sync_log rows.
  });
  if (acknowledgedIds.length > 0) setLastPageSyncAtNow();
  return {
    status: "ok",
    accepted,
    skipped,
  };
}

async function pushCloudRecordsInBatches(
  records: RemotePageRecord[]
): Promise<{
  status: PageSyncStatus;
  accepted: number;
  skipped: number;
  acceptedIds: string[];
  skippedIds: string[];
  message?: string;
}> {
  let accepted = 0;
  let skipped = 0;
  const acceptedIds: string[] = [];
  const skippedIds: string[] = [];
  let oversized = 0;
  let batch: RemotePageRecord[] = [];
  let batchBytes = 0;

  const flush = async (): Promise<PushCloudPagesResult | null> => {
    if (batch.length === 0) return null;
    const current = batch;
    batch = [];
    batchBytes = 0;
    return pushCloudPages(current);
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
          accepted,
          skipped,
          acceptedIds,
          skippedIds,
          message: result.message,
        };
      }
      if (result) {
        clearPendingCloudPushIds([...result.accepted, ...result.skipped]);
        accepted += result.accepted.length;
        skipped += result.skipped.length;
        acceptedIds.push(...result.accepted);
        skippedIds.push(...result.skipped);
      }
    }
    if (size > PUSH_BATCH_BYTES) {
      oversized += 1;
      markPendingCloudPushFailedRecords(
        [record],
        "error",
        `单条页面记录 ${formatSyncBytes(size)} 超过本地云同步单批上限 ${formatSyncBytes(
          PUSH_BATCH_BYTES
        )}；请拆分页面内容或移除过大的内嵌资源后重试。`
      );
      emitPageSyncStatusChanged();
      continue;
    }
    batch.push(record);
    batchBytes += size;
  }

  const result = await flush();
  if (result && result.status !== "ok") {
    return {
      status: result.status,
      accepted,
      skipped,
      acceptedIds,
      skippedIds,
      message: result.message,
    };
  }
  if (result) {
    clearPendingCloudPushIds([...result.accepted, ...result.skipped]);
    accepted += result.accepted.length;
    skipped += result.skipped.length;
    acceptedIds.push(...result.accepted);
    skippedIds.push(...result.skipped);
  }
  if (oversized > 0) {
    return {
      status: "error",
      accepted,
      skipped,
      acceptedIds,
      skippedIds,
      message: `${oversized} 条页面记录超过云同步单批上限，已保留在 pending queue 并标记失败原因。`,
    };
  }
  return { status: "ok", accepted, skipped, acceptedIds, skippedIds };
}

export async function forcePullDailyCloudPages(): Promise<PullDailyCloudResult> {
  if (!isPageSyncEnabled()) {
    return { status: "disabled", pulled: 0, total: 0 };
  }
  const manifestRes = await call({ action: "daily-metadata" });
  if (!manifestRes.ok) {
    return {
      status: manifestRes.status,
      pulled: 0,
      total: 0,
      message: manifestRes.message,
    };
  }

  const ids = Array.isArray(manifestRes.json.ids)
    ? manifestRes.json.ids.filter((id): id is string => isValidRemotePageId(id))
    : [];
  const pages = Array.isArray(manifestRes.json.pages)
    ? (manifestRes.json.pages as RemotePageRecord[])
    : [];
  if (typeof window !== "undefined" && typeof manifestRes.json.rootId === "string") {
    window.localStorage.setItem("zhinote.moduleRoot.daily", manifestRes.json.rootId);
  }

  let pulled = 0;
  const pulledPages: RemotePageRecord[] = [];
  let failed = 0;
  let failedReason: string | undefined;
  try {
    await applyRemotePageMetadata(pages);
    pulled = pages.length;
    pulledPages.push(...pages);
  } catch {
    for (const page of pages) {
      try {
        await applyRemotePageMetadata([page]);
        pulled += 1;
        pulledPages.push(page);
      } catch (error) {
        failed += 1;
        if (!failedReason) {
          failedReason =
            error instanceof Error ? error.message : "未知本机写入错误";
        }
      }
    }
  }

  setLastPageSyncAtNow();
  if (pulled > 0) {
    emitPagesUpdated("cloud-pull", pulled, toPageUpdatePayloads(pulledPages));
  }

  return {
    status: "ok",
    pulled,
    total: ids.length,
    failed,
    failedReason,
    scanned:
      typeof manifestRes.json.scanned === "number"
        ? manifestRes.json.scanned
        : undefined,
  };
}

export async function fetchDailyCloudMetadata(
  options: DailyCloudMetadataOptions = {}
): Promise<DailyCloudMetadataResult> {
  if (!isPageSyncEnabled()) {
    return { status: "disabled", pages: [], total: 0 };
  }
  const res = await call(
    {
      action:
        options.startDate || options.endDate
          ? "daily-calendar-metadata"
          : "daily-metadata",
      ...(options.startDate ? { startDate: options.startDate } : {}),
      ...(options.endDate ? { endDate: options.endDate } : {}),
      ...(typeof options.recentLimit === "number"
        ? { recentLimit: options.recentLimit }
        : {}),
    },
    {
      timeoutMs: ACCOUNT_PAGE_SYNC_METADATA_REQUEST_TIMEOUT_MS,
      timeoutMessage:
        "云端每日纪要索引读取较慢；已先使用本地缓存，稍后自动重试。",
      softTimeout: true,
    }
  );
  if (!res.ok) {
    return {
      status: res.status,
      pages: [],
      total: 0,
      message: res.message,
    };
  }
  const pages = Array.isArray(res.json.pages)
    ? (res.json.pages as RemotePageRecord[])
    : [];
  return {
    status: "ok",
    pages,
    total: typeof res.json.count === "number" ? res.json.count : pages.length,
    rootId: typeof res.json.rootId === "string" ? res.json.rootId : null,
    matched: typeof res.json.matched === "number" ? res.json.matched : undefined,
    rangeCount:
      typeof res.json.rangeCount === "number" ? res.json.rangeCount : undefined,
    recentCount:
      typeof res.json.recentCount === "number" ? res.json.recentCount : undefined,
    scanned: typeof res.json.scanned === "number" ? res.json.scanned : undefined,
    cached: typeof res.json.cached === "boolean" ? res.json.cached : undefined,
    watermark:
      typeof res.json.watermark === "string" ? res.json.watermark : undefined,
  };
}

export async function fetchMeetingCloudMetadata(
  options: MeetingCloudMetadataOptions = {}
): Promise<MeetingCloudMetadataResult> {
  if (!isPageSyncEnabled()) {
    return { status: "disabled", pages: [], total: 0 };
  }
  const res = await call(
    {
      action: "meeting-calendar-metadata",
      ...(options.startDate ? { startDate: options.startDate } : {}),
      ...(options.endDate ? { endDate: options.endDate } : {}),
      ...(typeof options.recentLimit === "number"
        ? { recentLimit: options.recentLimit }
        : {}),
    },
    {
      timeoutMs: ACCOUNT_PAGE_SYNC_METADATA_REQUEST_TIMEOUT_MS,
      timeoutMessage:
        "云端会议日历索引读取较慢；已先使用本地缓存，稍后自动重试。",
      softTimeout: true,
    }
  );
  if (!res.ok) {
    return {
      status: res.status,
      pages: [],
      total: 0,
      message: res.message,
    };
  }
  const pages = Array.isArray(res.json.pages)
    ? (res.json.pages as RemotePageRecord[])
    : [];
  return {
    status: "ok",
    pages,
    total: typeof res.json.count === "number" ? res.json.count : pages.length,
    rootId: typeof res.json.rootId === "string" ? res.json.rootId : null,
    matched: typeof res.json.matched === "number" ? res.json.matched : undefined,
    rangeCount:
      typeof res.json.rangeCount === "number" ? res.json.rangeCount : undefined,
    recentCount:
      typeof res.json.recentCount === "number" ? res.json.recentCount : undefined,
    scanned: typeof res.json.scanned === "number" ? res.json.scanned : undefined,
    cached: typeof res.json.cached === "boolean" ? res.json.cached : undefined,
    watermark:
      typeof res.json.watermark === "string" ? res.json.watermark : undefined,
  };
}

function toRecord(page: Page): RemotePageRecord {
  const cover =
    page.cover_url && page.cover_url.length > MAX_COVER_CHARS
      ? null
      : (page.cover_url ?? null);
  return {
    id: page.id,
    parent_id: page.parent_id ?? null,
    title: page.title ?? "",
    icon: page.icon ?? null,
    cover_url: cover,
    content_text: page.content_text ?? null,
    properties: page.properties ?? null,
    position: page.position ?? 0,
    depth: page.depth ?? 0,
    created_at: page.created_at,
    updated_at: page.updated_at,
    deleted_at: page.deleted_at ?? null,
  };
}

export function pageToRemoteRecord(page: Page): RemotePageRecord {
  return toRecord(page);
}

export function queueCloudPagePush(
  page: Page | RemotePageRecord,
  delayMs = CLOUD_PUSH_DEBOUNCE_MS
): void {
  const record = "owner_id" in page ? pageToRemoteRecord(page) : page;
  const wasQueued = queuedCloudPush.has(record.id);
  const pendingChanged = markPendingCloudPush(record.id);
  queuedCloudPush.set(record.id, record);
  if (pendingChanged || !wasQueued) emitPageSyncStatusChanged();
  if (queuedCloudPushTimer) clearTimeout(queuedCloudPushTimer);
  queuedCloudPushTimer = setTimeout(() => {
    const batch = [...queuedCloudPush.values()];
    queuedCloudPush = new Map();
    queuedCloudPushTimer = null;
    emitPageSyncStatusChanged();
    if (batch.length > 0) {
      void pushCloudRecordsInBatches(batch);
    }
  }, delayMs);
}

export function queueCloudPageDelete(
  page: Page | RemotePageRecord,
  deletedAt = new Date().toISOString()
): void {
  const tombstone =
    "owner_id" in page
      ? pageToRemoteRecord({
          ...page,
          deleted_at: deletedAt,
          updated_at: deletedAt,
        })
      : {
          ...page,
          deleted_at: deletedAt,
          updated_at: deletedAt,
        };
  queueCloudPagePush(tombstone);
}

async function flushPendingCloudPushes(
  options: FlushPendingCloudPushOptions = {}
): Promise<{
  status: PageSyncStatus;
  pushed: number;
  pending: number;
  message?: string;
}> {
  const ids = getPendingCloudPushIds();
  if (ids.length === 0) {
    return { status: "ok", pushed: 0, pending: 0 };
  }
  const pendingMeta = getPendingCloudPushMeta();
  const retryableIds = options.includeManualReview
    ? ids
    : ids.filter(
        (id) =>
          (pendingMeta[id]?.failureCount ?? 0) <
          PENDING_CLOUD_PAGE_MANUAL_REVIEW_FAILURE_COUNT
      );
  if (retryableIds.length === 0) {
    return { status: "ok", pushed: 0, pending: ids.length };
  }

  let pages: Page[];
  try {
    pages = await getPagesForSyncByIds(retryableIds);
  } catch (error) {
    return {
      status: "ok",
      pushed: 0,
      pending: getPendingCloudPushIds().length,
      message: error instanceof Error ? error.message : "本地缓存读取失败",
    };
  }

  const localById = new Map(pages.map((page) => [page.id, page]));
  const records: RemotePageRecord[] = [];
  const missing: string[] = [];
  const evicted: string[] = [];
  for (const id of retryableIds) {
    const page = localById.get(id);
    if (page) {
      if (isLocalCacheEvictionTombstone(page)) {
        evicted.push(id);
        continue;
      }
      records.push(toRecord(page));
    } else {
      missing.push(id);
    }
  }
  clearPendingCloudPushIds([...missing, ...evicted]);
  if (records.length === 0) {
    return { status: "ok", pushed: 0, pending: getPendingCloudPushIds().length };
  }

  const result = await pushCloudRecordsInBatches(records);
  if (result.status !== "ok") {
    return {
      status: result.status,
      pushed: result.accepted,
      pending: getPendingCloudPushIds().length,
      message: result.message,
    };
  }
  return {
    status: "ok",
    pushed: result.accepted,
    pending: getPendingCloudPushIds().length,
  };
}

async function markAcknowledgedPageSyncIds(ids: string[]): Promise<number> {
  const acknowledged = new Set(ids.filter(isValidRemotePageId));
  if (acknowledged.size === 0) return 0;
  const pending = await getPendingPageSyncRecords(1000);
  return markPageSyncLogEntriesSynced(
    pending.entries
      .filter((entry) => acknowledged.has(entry.pageId))
      .map((entry) => entry.logId)
  );
}

export async function pushPendingLocalPageChangesToCloud(): Promise<PushLocalPagesResult> {
  if (!isPageSyncEnabled()) {
    return { status: "disabled", pushed: 0, skipped: 0, total: 0 };
  }
  const pending = await getPendingPageSyncRecords(200);
  if (pending.entries.length === 0) {
    return { status: "ok", pushed: 0, skipped: 0, total: 0 };
  }
  const recordIds = new Set(pending.records.map((record) => record.id));
  const missingLogIds = pending.entries
    .filter((entry) => !recordIds.has(entry.pageId))
    .map((entry) => entry.logId);
  if (pending.records.length === 0) {
    await markPageSyncLogEntriesFailed(
      missingLogIds,
      "页面同步日志指向的本地页面记录不存在，已保留为待处理。"
    );
    emitPageSyncStatusChanged();
    return {
      status: "error",
      pushed: 0,
      skipped: 0,
      total: pending.entries.length,
      message: "页面同步日志指向的本地页面记录不存在，已保留为待处理。",
    };
  }

  const pendingLogIds = pending.entries.map((entry) => entry.logId);
  await markPageSyncLogEntriesAttempted(pendingLogIds);
  emitPageSyncStatusChanged();

  const result = await pushCloudRecordsInBatches(pending.records.map(toRecord));
  const acknowledged = new Set([...result.acceptedIds, ...result.skippedIds]);
  const acknowledgedLogIds = pending.entries
    .filter((entry) => acknowledged.has(entry.pageId))
    .map((entry) => entry.logId);
  const marked = await markPageSyncLogEntriesSynced(acknowledgedLogIds);
  if (missingLogIds.length > 0) {
    await markPageSyncLogEntriesFailed(
      missingLogIds,
      "页面同步日志指向的本地页面记录不存在，已保留为待处理。"
    );
  }
  const missingMessage =
    missingLogIds.length > 0
      ? "部分页面同步日志指向的本地页面记录不存在，已保留为待处理。"
      : undefined;

  if (result.status !== "ok") {
    const failedLogIds = pending.entries
      .filter(
        (entry) =>
          !acknowledged.has(entry.pageId) && recordIds.has(entry.pageId)
      )
      .map((entry) => entry.logId);
    await markPageSyncLogEntriesFailed(
      failedLogIds,
      result.message ?? result.status
    );
    emitPageSyncStatusChanged();
    return {
      status: result.status,
      pushed: result.accepted,
      skipped: result.skipped,
      total: pending.entries.length,
      marked,
      acceptedIds: result.acceptedIds,
      skippedIds: result.skippedIds,
      message: result.message ?? missingMessage,
    };
  }

  emitPageSyncStatusChanged();
  if (missingLogIds.length > 0) {
    return {
      status: "error",
      pushed: result.accepted,
      skipped: result.skipped,
      total: pending.entries.length,
      marked,
      acceptedIds: result.acceptedIds,
      skippedIds: result.skippedIds,
      message: missingMessage,
    };
  }
  return {
    status: "ok",
    pushed: result.accepted,
    skipped: result.skipped,
    total: pending.entries.length,
    marked,
    acceptedIds: result.acceptedIds,
    skippedIds: result.skippedIds,
  };
}

function summarizeIndex(index: Record<string, IndexEntry>): IndexSummary {
  let count = 0;
  let deleted = 0;
  let maxUpdatedAt = "";
  let maxUpdatedId = "";
  for (const [id, entry] of Object.entries(index)) {
    count += 1;
    if (entry.d === 1) deleted += 1;
    if (
      entry.u > maxUpdatedAt ||
      (entry.u === maxUpdatedAt && id > maxUpdatedId)
    ) {
      maxUpdatedAt = entry.u;
      maxUpdatedId = id;
    }
  }
  return {
    count,
    deleted,
    maxUpdatedAt,
    watermark: `${count}:${deleted}:${maxUpdatedAt}`,
    cursor: stringifyPageChangeCursor(maxUpdatedAt, maxUpdatedId),
  };
}

function normalizeSummary(value: unknown): IndexSummary | null {
  if (!value || typeof value !== "object") return null;
  const summary = value as Partial<IndexSummary>;
  if (typeof summary.watermark !== "string") return null;
  return {
    count: typeof summary.count === "number" ? summary.count : 0,
    deleted: typeof summary.deleted === "number" ? summary.deleted : 0,
    maxUpdatedAt:
      typeof summary.maxUpdatedAt === "string" ? summary.maxUpdatedAt : "",
    watermark: summary.watermark,
    cursor:
      typeof summary.cursor === "string"
        ? summary.cursor
        : stringifyPageChangeCursor(
            typeof summary.maxUpdatedAt === "string" ? summary.maxUpdatedAt : "",
            "~"
          ),
  };
}

function toPageUpdatePayload(record: RemotePageRecord): PageUpdatePayload {
  return {
    id: record.id,
    parent_id: record.parent_id,
    title: record.title,
    icon: record.icon,
    cover_url: record.cover_url,
    content_text: null,
    properties: record.properties,
    position: record.position,
    depth: record.depth,
    created_at: record.created_at,
    updated_at: record.updated_at,
    deleted_at: record.deleted_at,
  };
}

function toPageUpdatePayloads(
  records: RemotePageRecord[]
): PageUpdatePayload[] {
  return records.map(toPageUpdatePayload);
}

function stringifyPageChangeCursor(updatedAt: string, id: string): string {
  if (!updatedAt) return "";
  return JSON.stringify({ updatedAt, id });
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
    // The cloud account is the source of truth; blocked localStorage should not
    // stop this tab from continuing with in-memory cursors.
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

function getRemoteWatermark(): string | null {
  return readSyncStorage(REMOTE_WATERMARK_KEY) ?? memoryRemoteWatermark;
}

function setRemoteWatermark(watermark: string) {
  memoryRemoteWatermark = watermark;
  writeSyncStorage(REMOTE_WATERMARK_KEY, watermark);
}

function getRemoteCursor(): string | null {
  return readSyncStorage(REMOTE_CURSOR_KEY) ?? memoryRemoteCursor;
}

function setRemoteCursor(cursor: string) {
  if (!cursor) return;
  memoryRemoteCursor = cursor;
  writeSyncStorage(REMOTE_CURSOR_KEY, cursor);
}

function setLastPageSyncAtNow() {
  const iso = new Date().toISOString();
  memoryLastPageSyncAt = iso;
  writeSyncStorage(LAST_SYNC_KEY, iso);
  emitPageSyncStatusChanged();
}

async function restoreCursorFromLocalMetadata(
  remoteSummary: IndexSummary
): Promise<boolean> {
  try {
    const localSummary = await getLocalPageSyncSummary();
    if (
      localSummary.watermark !== remoteSummary.watermark ||
      localSummary.cursor !== remoteSummary.cursor
    ) {
      return false;
    }
    setRemoteWatermark(remoteSummary.watermark);
    setRemoteCursor(remoteSummary.cursor);
    setLastPageSyncAtNow();
    return true;
  } catch {
    return false;
  }
}

async function fastForwardMetadataDeltaFromLocalCursor(
  remoteSummary: IndexSummary
): Promise<CloudPageMetadataDeltaResult | null> {
  let localSummary: Awaited<ReturnType<typeof getLocalPageSyncSummary>>;
  try {
    localSummary = await getLocalPageSyncSummary();
  } catch {
    return null;
  }
  if (!localSummary.cursor) return null;

  if (
    localSummary.watermark === remoteSummary.watermark &&
    localSummary.cursor === remoteSummary.cursor
  ) {
    setRemoteWatermark(remoteSummary.watermark);
    setRemoteCursor(remoteSummary.cursor);
    setLastPageSyncAtNow();
    return { status: "ok", pulled: 0, pages: [], fullRefresh: false };
  }

  if (
    comparePageChangeCursorStrings(localSummary.cursor, remoteSummary.cursor) >=
    0
  ) {
    return null;
  }

  let nextCursor = localSummary.cursor;
  let hasMore = false;
  let pulled = 0;
  const pulledPages: RemotePageRecord[] = [];
  let batches = 0;
  do {
    const changes = await fetchCloudPageMetadataChangesSince(nextCursor);
    if (changes.status !== "ok") {
      return {
        status: changes.status,
        pulled,
        pages: pulledPages,
        fullRefresh: false,
        message: changes.message,
      };
    }
    if (changes.pages.length > 0) {
      try {
        await applyRemotePageMetadata(changes.pages);
      } catch {
        // The caller can still merge returned metadata into in-memory state.
      }
      pulled += changes.pages.length;
      pulledPages.push(...changes.pages);
    }
    if (changes.summary) setRemoteWatermark(changes.summary.watermark);
    setRemoteCursor(changes.cursor);
    nextCursor = changes.cursor;
    hasMore = changes.hasMore;
    batches += 1;
  } while (hasMore && batches < 3);

  if (pulled > 0) {
    emitPagesUpdated("cloud-pull", pulled, toPageUpdatePayloads(pulledPages));
  }
  setLastPageSyncAtNow();
  return {
    status: "ok",
    pulled,
    pages: pulledPages,
    fullRefresh: false,
  };
}

function parsePageChangeCursorString(cursor: string): {
  updatedAt: string;
  id: string;
} {
  if (!cursor) return { updatedAt: "", id: "" };
  try {
    const parsed = JSON.parse(cursor) as {
      updatedAt?: unknown;
      id?: unknown;
    };
    if (
      typeof parsed.updatedAt === "string" &&
      typeof parsed.id === "string"
    ) {
      return { updatedAt: parsed.updatedAt, id: parsed.id };
    }
  } catch {
    // Older cursors stored only updated_at.
  }
  return { updatedAt: cursor, id: "" };
}

function comparePageChangeCursorStrings(left: string, right: string): number {
  const leftCursor = parsePageChangeCursorString(left);
  const rightCursor = parsePageChangeCursorString(right);
  return (
    leftCursor.updatedAt.localeCompare(rightCursor.updatedAt) ||
    leftCursor.id.localeCompare(rightCursor.id)
  );
}

async function shouldRecoverPageMetadataCoverageBeforeIncrementalPull(
  remoteCursor: string
): Promise<boolean> {
  try {
    const localSummary = await getLocalPageSyncSummary();
    if (localSummary.count === 0 || !localSummary.cursor) return true;
    return comparePageChangeCursorStrings(localSummary.cursor, remoteCursor) < 0;
  } catch {
    return true;
  }
}

function getPendingCloudPushIds(): string[] {
  try {
    const parsed = JSON.parse(readSyncStorage(PENDING_PUSH_IDS_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return Array.from(
      new Set(
        parsed.filter(
          (id): id is string => typeof id === "string" && isValidRemotePageId(id)
        )
      )
    );
  } catch {
    return [];
  }
}

function setPendingCloudPushIds(ids: string[]): void {
  const next = Array.from(new Set(ids.filter(isValidRemotePageId)));
  if (next.length === 0) {
    removeSyncStorage(PENDING_PUSH_IDS_KEY);
    removeSyncStorage(PENDING_PUSH_META_KEY);
    return;
  }
  writeSyncStorage(PENDING_PUSH_IDS_KEY, JSON.stringify(next));
  prunePendingCloudPushMetaToIds(next);
}

function getPendingCloudPushMeta(): PendingCloudPushMeta {
  try {
    const parsed = JSON.parse(readSyncStorage(PENDING_PUSH_META_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const next: PendingCloudPushMeta = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (
        !isValidRemotePageId(id) ||
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
        next[id] = {
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

function setPendingCloudPushMeta(meta: PendingCloudPushMeta): void {
  const next: PendingCloudPushMeta = {};
  for (const [id, value] of Object.entries(meta)) {
    if (
      isValidRemotePageId(id) &&
      typeof value.queuedAt === "string" &&
      !Number.isNaN(Date.parse(value.queuedAt))
    ) {
      next[id] = {
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

function prunePendingCloudPushMetaToIds(ids: string[]): void {
  const allowedIds = new Set(ids.filter(isValidRemotePageId));
  if (allowedIds.size === 0) {
    removeSyncStorage(PENDING_PUSH_META_KEY);
    return;
  }
  const next: PendingCloudPushMeta = {};
  for (const [id, value] of Object.entries(getPendingCloudPushMeta())) {
    if (allowedIds.has(id)) next[id] = value;
  }
  setPendingCloudPushMeta(next);
}

function markPendingCloudPush(id: string): boolean {
  if (!isValidRemotePageId(id)) return false;
  const pendingIds = getPendingCloudPushIds();
  const wasPending = pendingIds.includes(id);
  if (!wasPending) {
    setPendingCloudPushIds([...pendingIds, id]);
  }
  const meta = getPendingCloudPushMeta();
  if (wasPending && meta[id]) return false;
  if (!meta[id]) {
    setPendingCloudPushMeta({
      ...meta,
      [id]: { queuedAt: new Date().toISOString() },
    });
    return true;
  }
  return !wasPending;
}

function markPendingCloudPushRecords(records: RemotePageRecord[]): void {
  for (const record of records) {
    markPendingCloudPush(record.id);
  }
}

function markPendingCloudPushAttemptRecords(records: RemotePageRecord[]): void {
  const attemptedAt = new Date().toISOString();
  const meta = getPendingCloudPushMeta();
  const next: PendingCloudPushMeta = { ...meta };
  for (const record of records) {
    if (!isValidRemotePageId(record.id)) continue;
    const previous = meta[record.id];
    next[record.id] = {
      ...previous,
      queuedAt: previous?.queuedAt ?? attemptedAt,
      lastAttemptAt: attemptedAt,
    };
  }
  setPendingCloudPushMeta(next);
}

function markPendingCloudPushFailedRecords(
  records: RemotePageRecord[],
  status: PageSyncStatus,
  message?: string
): void {
  const failedAt = new Date().toISOString();
  const meta = getPendingCloudPushMeta();
  const next: PendingCloudPushMeta = { ...meta };
  const reason = normalizePendingCloudPushError(status, message);
  for (const record of records) {
    if (!isValidRemotePageId(record.id)) continue;
    const previous = meta[record.id];
    next[record.id] = {
      ...previous,
      queuedAt: previous?.queuedAt ?? failedAt,
      lastAttemptAt: failedAt,
      lastFailureAt: failedAt,
      lastError: reason,
      failureCount: Math.min((previous?.failureCount ?? 0) + 1, 999),
    };
  }
  setPendingCloudPushMeta(next);
}

function clearPendingCloudPushIds(ids: string[]): void {
  if (ids.length === 0) return;
  const cleared = new Set(ids.filter(isValidRemotePageId));
  if (cleared.size === 0) return;
  setPendingCloudPushIds(
    getPendingCloudPushIds().filter((id) => !cleared.has(id))
  );
  emitPageSyncStatusChanged();
}

export function getPendingCloudPageSyncStatus(): PendingCloudPageSyncStatus {
  const pendingIds = getPendingCloudPushIds();
  const pendingMeta = getPendingCloudPushMeta();
  const authRetry = getAuthRetrySnapshot();
  const failedIds = pendingIds.filter((id) => Boolean(pendingMeta[id]?.lastError));
  const failureCounts = pendingIds.map(
    (id) => pendingMeta[id]?.failureCount ?? 0
  );
  const failureCountTotal = failureCounts.reduce((sum, count) => sum + count, 0);
  const maxFailureCount =
    failureCounts.length > 0 ? Math.max(...failureCounts) : 0;
  const manualReviewIds = failedIds.filter(
    (id) =>
      (pendingMeta[id]?.failureCount ?? 0) >=
      PENDING_CLOUD_PAGE_MANUAL_REVIEW_FAILURE_COUNT
  );
  const manualReviewSampleIds = manualReviewIds.slice(0, 5);
  const oldestPendingQueuedAt = pendingIds.reduce<string | null>((oldest, id) => {
    const queuedAt = pendingMeta[id]?.queuedAt ?? null;
    if (!queuedAt) return oldest;
    if (!oldest) return queuedAt;
    return Date.parse(queuedAt) < Date.parse(oldest) ? queuedAt : oldest;
  }, null);
  const lastAttemptAt = newestIso(
    pendingIds.map((id) => pendingMeta[id]?.lastAttemptAt ?? null)
  );
  const latestFailedId = failedIds
    .map((id) => ({ id, failedAt: pendingMeta[id]?.lastFailureAt ?? "" }))
    .sort((left, right) => right.failedAt.localeCompare(left.failedAt))[0]?.id;

  return {
    enabled: isPageSyncEnabled(),
    pending: pendingIds.length,
    queued: queuedCloudPush.size,
    syncLogPending: 0,
    syncLogRetryable: 0,
    syncLogDeferred: 0,
    failed: failedIds.length,
    failureCountTotal,
    maxFailureCount,
    manualReviewCount: manualReviewIds.length,
    manualReviewFailureThreshold:
      PENDING_CLOUD_PAGE_MANUAL_REVIEW_FAILURE_COUNT,
    manualReviewSampleIds,
    oldestPendingQueuedAt,
    lastAttemptAt,
    lastFailureAt: latestFailedId
      ? pendingMeta[latestFailedId]?.lastFailureAt ?? null
      : null,
    lastFailureMessage: latestFailedId
      ? pendingMeta[latestFailedId]?.lastError ?? null
      : null,
    pendingSampleIds: pendingIds.slice(0, 5),
    failedSampleIds: failedIds.slice(0, 5),
    authRetryStatus: authRetry.status,
    authRetryUntil: authRetry.until,
    lastSyncAt: getLastPageSyncAt(),
  };
}

export async function getPendingCloudPageSyncStatusWithSyncLog(): Promise<PendingCloudPageSyncStatus> {
  const status = getPendingCloudPageSyncStatus();
  try {
    const [pending, counts] = await Promise.all([
      getPendingPageSyncRecords(1000),
      getPageSyncLogPendingCounts(),
    ]);
    const retryable = pending.entries.length;
    const total = Math.max(counts.total, retryable);
    return {
      ...status,
      syncLogPending: total,
      syncLogRetryable: retryable,
      syncLogDeferred: Math.max(0, total - retryable),
    };
  } catch {
    return status;
  }
}

export function isCloudPagePendingSync(pageId: string): boolean {
  if (!isValidRemotePageId(pageId)) return false;
  return queuedCloudPush.has(pageId) || getPendingCloudPushIds().includes(pageId);
}

export function getCloudPageSyncItemStatus(
  pageId: string
): CloudPageSyncItemStatus {
  const authRetry = getAuthRetrySnapshot();
  if (!isValidRemotePageId(pageId)) {
    return {
      pageId,
      state: "synced",
      pending: false,
      queued: false,
      failed: false,
      manualReview: false,
      failureCount: 0,
      lastAttemptAt: null,
      lastFailureAt: null,
      lastFailureMessage: null,
      authRetryStatus: authRetry.status,
      authRetryUntil: authRetry.until,
    };
  }

  const pending = getPendingCloudPushIds().includes(pageId);
  const queued = queuedCloudPush.has(pageId);
  const meta = getPendingCloudPushMeta()[pageId];
  const failureCount = meta?.failureCount ?? 0;
  const failed = pending && Boolean(meta?.lastError);
  const manualReview =
    failed && failureCount >= PENDING_CLOUD_PAGE_MANUAL_REVIEW_FAILURE_COUNT;
  const state: CloudPageSyncItemState = manualReview
    ? "manual-review"
    : failed
      ? "failed"
      : queued
        ? "queued"
        : pending
          ? "pending"
          : "synced";

  return {
    pageId,
    state,
    pending,
    queued,
    failed,
    manualReview,
    failureCount,
    lastAttemptAt: meta?.lastAttemptAt ?? null,
    lastFailureAt: meta?.lastFailureAt ?? null,
    lastFailureMessage: meta?.lastError ?? null,
    authRetryStatus: authRetry.status,
    authRetryUntil: authRetry.until,
  };
}

function emitPageSyncStatusChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(PAGE_SYNC_STATUS_EVENT, {
      detail: getPendingCloudPageSyncStatus(),
    })
  );
}

function normalizePendingCloudPushError(
  status: PageSyncStatus,
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

function clearAllPendingCloudPushesForCacheRebuild(): void {
  if (queuedCloudPushTimer) {
    clearTimeout(queuedCloudPushTimer);
    queuedCloudPushTimer = null;
  }
  queuedCloudPush = new Map();
  setPendingCloudPushIds([]);
  emitPageSyncStatusChanged();
}

async function uploadLocalPageBaselineIfNeeded(): Promise<{
  status: PageSyncStatus;
  pushed: number;
  skipped: number;
  total: number;
  message?: string;
}> {
  if (!isPageSyncEnabled()) {
    return { status: "disabled", pushed: 0, skipped: 0, total: 0 };
  }

  const summary = await getLocalPageSyncSummary();
  const signature = `${summary.count}:${summary.deleted}:${summary.cursor}:${summary.watermark}`;
  if (
    summary.count === 0 ||
    readSyncStorage(LOCAL_BASELINE_UPLOAD_SIGNATURE_KEY) === signature
  ) {
    return { status: "ok", pushed: 0, skipped: 0, total: 0 };
  }

  let pages: Page[];
  try {
    pages = await getAllPagesForSync();
  } catch (error) {
    return {
      status: "error",
      pushed: 0,
      skipped: 0,
      total: 0,
      message: error instanceof Error ? error.message : "本地页面基线读取失败",
    };
  }

  const records = pages.filter((page) => !isLocalCacheEvictionTombstone(page)).map(toRecord);
  if (records.length === 0) {
    writeSyncStorage(LOCAL_BASELINE_UPLOAD_SIGNATURE_KEY, signature);
    return { status: "ok", pushed: 0, skipped: 0, total: 0 };
  }

  const result = await pushCloudRecordsInBatches(records);
  if (result.status !== "ok") {
    return {
      status: result.status,
      pushed: result.accepted,
      skipped: result.skipped,
      total: records.length,
      message: result.message,
    };
  }

  writeSyncStorage(LOCAL_BASELINE_UPLOAD_SIGNATURE_KEY, signature);
  setLastPageSyncAtNow();
  return {
    status: "ok",
    pushed: result.accepted,
    skipped: result.skipped,
    total: records.length,
  };
}

function clearPageSyncRuntimeCachesForCacheRebuild(): void {
  metadataDeltaGeneration += 1;
  metadataDeltaInFlight = null;
  lastMetadataDeltaResult = null;
  lastMetadataDeltaAt = 0;
  pageLookupInFlight.clear();
  pageLookupCache.clear();
}

function getPropertyValue(page: Page, name: string): string {
  return (
    parsePageProperties(page.properties).find((property) => property.name === name)
      ?.value ?? ""
  );
}

function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function formatInferredDate(
  yearText: string,
  monthText: string,
  dayText: string
): string | null {
  let year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return null;
  }
  if (yearText.length === 2) year += year >= 70 ? 1900 : 2000;
  if (
    year < 2000 ||
    year > 2099 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function inferDateFromTitle(title: string): string | null {
  const compact = title.match(
    /(?:^|[^0-9])([0-9]{2})([01][0-9])([0-3][0-9])(?:[^0-9]|$)/
  );
  if (compact) return formatInferredDate(compact[1], compact[2], compact[3]);

  const shortSeparated = title.match(
    /(?:^|[^0-9])([0-9]{2})[-/.年]([0-9]{1,2})[-/.月]([0-9]{1,2})(?:日)?(?:[^0-9]|$)/
  );
  if (shortSeparated) {
    return formatInferredDate(
      shortSeparated[1],
      shortSeparated[2],
      shortSeparated[3]
    );
  }

  const separated = title.match(
    /(?:^|[^0-9])([0-9]{4})[-/.年]([0-9]{1,2})[-/.月]([0-9]{1,2})(?:日)?(?:[^0-9]|$)/
  );
  if (separated) {
    return formatInferredDate(separated[1], separated[2], separated[3]);
  }
  return null;
}

function getDailyDateKey(page: Page): string | null {
  const existing = getPropertyValue(page, "日期");
  if (isDateKey(existing)) return existing;
  return inferDateFromTitle(page.title ?? "");
}

function isModuleWorkspaceRoot(page: Page): boolean {
  if (page.parent_id !== null) return false;
  return MODULE_WORKSPACE_LIST.some((def) => {
    const titles = new Set([
      def.title,
      ...((def as { legacyTitles?: string[] }).legacyTitles ?? []),
    ]);
    return titles.has(page.title ?? "");
  });
}

function shouldRepairDailyImportPage(page: Page): boolean {
  if (page.deleted_at || page.parent_id !== null || isModuleWorkspaceRoot(page)) {
    return false;
  }
  const source = getPropertyValue(page, "来源");
  return source === "notion-daily-import" || isDateKey(getPropertyValue(page, "日期"));
}

function withDailyDateProperty(page: Page, dateKey: string): string {
  const properties = parsePageProperties(page.properties);
  const existing = properties.find((property) => property.name === "日期");
  if (existing) {
    existing.type = "date";
    existing.value = dateKey;
  } else {
    properties.unshift({
      ...createPageProperty("date", "日期"),
      value: dateKey,
    });
  }
  return stringifyPageProperties(properties);
}

function isLocalCacheEvictionTombstone(page: Page): boolean {
  return (
    page.sync_version === -1 &&
    page.deleted_at === "1970-01-01T00:00:00.000Z" &&
    page.updated_at === "1970-01-01T00:00:00.000Z" &&
    page.parent_id === null &&
    (page.title ?? "") === "" &&
    page.icon === null &&
    page.cover_url === null &&
    page.content_text === null &&
    page.properties === null &&
    (page.position ?? 0) === 0 &&
    (page.depth ?? 0) === 0
  );
}

// The three workspace roots are singletons identified by title. After the
// first two-device sync each side has its own root page for e.g. 每日纪要,
// so duplicates appear. Converge deterministically: keep the root with the
// smallest id, move the other root's children under it, soft-delete the
// duplicate. Both devices apply the same rule, so they end up identical.
async function mergeModuleRoots(): Promise<boolean> {
  const all = await getAllPagesForSync();
  const active = all.filter((p) => !p.deleted_at);
  let changed = false;

  for (const def of MODULE_WORKSPACE_LIST) {
    const titleSet = new Set([def.title, ...((def as { legacyTitles?: string[] }).legacyTitles ?? [])]);
    const roots = active
      .filter((p) => p.parent_id === null && titleSet.has(p.title ?? ""))
      .sort((a, b) => (a.id < b.id ? -1 : 1));
    if (roots.length === 0) continue;

    const canonical = roots[0];
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        `zhinote.moduleRoot.${def.key}`,
        canonical.id
      );
    }
    if (canonical.title !== def.title) {
      await updatePage(canonical.id, { title: def.title });
      changed = true;
    }
    if (roots.length === 1) continue;
    for (const duplicate of roots.slice(1)) {
      const children = active.filter((p) => p.parent_id === duplicate.id);
      for (const child of children) {
        const pos = await getNextPosition(canonical.id);
        await movePage(child.id, canonical.id, pos);
      }
      await deletePage(duplicate.id);
      changed = true;
    }
  }
  return changed;
}

interface DailyImportRepairOptions {
  force?: boolean;
}

async function getDailyImportRepairSignature(): Promise<string> {
  const summary = await getLocalPageSyncSummary();
  return `${summary.count}:${summary.deleted}:${summary.cursor}:${summary.watermark}`;
}

function isDailyImportRepairChecked(signature: string | null): boolean {
  if (!signature) return false;
  return (
    memoryDailyImportRepairSignature === signature ||
    readSyncStorage(DAILY_IMPORT_REPAIR_SIGNATURE_KEY) === signature
  );
}

function rememberDailyImportRepairChecked(signature: string | null): void {
  if (!signature) return;
  memoryDailyImportRepairSignature = signature;
  writeSyncStorage(DAILY_IMPORT_REPAIR_SIGNATURE_KEY, signature);
}

async function repairDailyImportPlacement(
  options: DailyImportRepairOptions = {}
): Promise<number> {
  const beforeSignature = await getDailyImportRepairSignature().catch(
    () => null
  );
  if (!options.force && isDailyImportRepairChecked(beforeSignature)) {
    return 0;
  }
  const all = await getAllPagesForSync();
  const active = all.filter((p) => !p.deleted_at);
  const dailyRoots = active
    .filter((p) => p.parent_id === null && p.title === "每日纪要")
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  const dailyRoot = dailyRoots[0];
  if (!dailyRoot) return 0;

  let repaired = 0;
  for (const page of active.filter(shouldRepairDailyImportPage)) {
    if (page.id === dailyRoot.id) continue;
    const dateKey = getDailyDateKey(page);
    if (!dateKey) continue;
    const nextProperties = withDailyDateProperty(page, dateKey);
    if (nextProperties !== (page.properties ?? "")) {
      await updatePage(page.id, { properties: nextProperties });
    }
    const position = await getNextPosition(dailyRoot.id);
    await movePage(page.id, dailyRoot.id, position);
    repaired += 1;
  }
  const afterSignature =
    repaired > 0
      ? await getDailyImportRepairSignature().catch(() => beforeSignature)
      : beforeSignature;
  rememberDailyImportRepairChecked(afterSignature);
  return repaired;
}

export async function rebuildPageCacheFromCloud(): Promise<RebuildPageCacheResult> {
  if (!isPageSyncEnabled()) {
    return {
      status: "disabled",
      cleared: 0,
      pruned: 0,
      pulled: 0,
      total: 0,
    };
  }

  const manifestRes = await call({ action: "manifest" });
  if (!manifestRes.ok) {
    return {
      status: manifestRes.status,
      cleared: 0,
      pruned: 0,
      pulled: 0,
      total: 0,
      message: manifestRes.message,
    };
  }

  const index = (manifestRes.json.index ?? {}) as Record<string, IndexEntry>;
  const ids = Object.keys(index).filter(isValidRemotePageId);
  let cleared = 0;
  let pulled = 0;
  const pulledPages: RemotePageRecord[] = [];
  clearAllPendingCloudPushesForCacheRebuild();
  clearPageSyncRuntimeCachesForCacheRebuild();
  const prune = await clearLocalPageCacheExceptIds(ids);
  cleared += prune.cleared;

  for (let i = 0; i < ids.length; i += PULL_BATCH) {
    const batchIds = ids.slice(i, i + PULL_BATCH);
    const res = await call({ action: "pull", ids: batchIds });
    if (!res.ok) {
      return {
        status: res.status,
        cleared,
        pruned: prune.cleared,
        pulled,
        total: ids.length,
        preservedLocalPrivate: prune.preservedLocalPrivate,
        message: res.message,
      };
    }
    const pages = Array.isArray(res.json.pages)
      ? (res.json.pages as RemotePageRecord[])
      : [];
    const pulledIds = pages.map((page) => page.id).filter(isValidRemotePageId);
    cleared += await clearLocalPageCacheForIds(pulledIds);
    if (pages.length > 0) {
      await applyRemotePages(pages);
      pulled += pages.length;
      pulledPages.push(...pages);
    }
  }

  if (pulled > 0) {
    await mergeModuleRoots();
  }
  const repaired = await repairDailyImportPlacement({ force: true });
  const summary = summarizeIndex(index);
  setRemoteWatermark(summary.watermark);
  setRemoteCursor(summary.cursor);
  setLastPageSyncAtNow();
  if (pulled > 0 || cleared > 0 || repaired > 0) {
    emitPagesUpdated(
      "cloud-pull",
      pulled || cleared || repaired,
      pulledPages.length > 0 ? toPageUpdatePayloads(pulledPages) : undefined
    );
  }

  return {
    status: "ok",
    cleared,
    pruned: prune.cleared,
    pulled,
    total: ids.length,
    repaired,
    preservedLocalPrivate: prune.preservedLocalPrivate,
  };
}

async function pullIncrementalCloudChanges(
  since: string
): Promise<
  | { ok: true; pulled: number; cursor: string; hasMore: boolean }
  | { ok: false; status: PageSyncStatus; message?: string }
> {
  const changes = await fetchCloudPageChangesSince(
    since,
    INCREMENTAL_PULL_LIMIT
  );
  if (changes.status !== "ok") {
    return {
      ok: false,
      status: changes.status,
      message: changes.message,
    };
  }
  if (changes.pages.length > 0) {
    await applyRemotePages(changes.pages);
    emitPagesUpdated(
      "cloud-pull",
      changes.pages.length,
      toPageUpdatePayloads(changes.pages)
    );
  }
  if (changes.summary) {
    setRemoteWatermark(changes.summary.watermark);
  }
  setRemoteCursor(changes.cursor);
  return {
    ok: true,
    pulled: changes.pages.length,
    cursor: changes.cursor,
    hasMore: changes.hasMore,
  };
}

let reconcileRunning = false;

export async function reconcilePageSync(
  options: ReconcileOptions = {}
): Promise<ReconcileResult> {
  if (!isPageSyncEnabled()) {
    return { status: "disabled", pulled: 0, pushed: 0 };
  }
  if (reconcileRunning) {
    return { status: "ok", pulled: 0, pushed: 0 };
  }
  reconcileRunning = true;
  try {
    if (options.forceAccountGate) {
      const accountGate = await checkAccountCloudSyncGate({ force: true });
      if (accountGate.status !== "ready") {
        const status = getAuthRetryStatusFromAccountGate(accountGate.status);
        rememberAuthRetryStatus(status);
        return {
          status,
          pulled: 0,
          pushed: 0,
          message: getAccountGatePageSyncMessage(accountGate.status),
        };
      }
      rememberAuthRetryStatus("ok");
    }
    const pendingPush = await flushPendingCloudPushes({
      includeManualReview: options.includeManualReview,
    });
    if (
      pendingPush.status === "unauthenticated" ||
      pendingPush.status === "unconfigured" ||
      pendingPush.status === "disabled" ||
      pendingPush.status === "error"
    ) {
      return {
        status: pendingPush.status,
        pulled: 0,
        pushed: pendingPush.pushed,
        message: pendingPush.message,
      };
    }
    const pendingSyncLogPush = await pushPendingLocalPageChangesToCloud();
    if (
      pendingSyncLogPush.status === "unauthenticated" ||
      pendingSyncLogPush.status === "unconfigured" ||
      pendingSyncLogPush.status === "disabled" ||
      pendingSyncLogPush.status === "error"
    ) {
      return {
        status: pendingSyncLogPush.status,
        pulled: 0,
        pushed: pendingPush.pushed + pendingSyncLogPush.pushed,
        message: pendingSyncLogPush.message,
      };
    }
    const baselineUpload = await uploadLocalPageBaselineIfNeeded();
    const initialPushed =
      pendingPush.pushed + pendingSyncLogPush.pushed + baselineUpload.pushed;
    const bootstrapped =
      baselineUpload.total > 0 ? baselineUpload.total : undefined;
    if (baselineUpload.status !== "ok") {
      return {
        status: baselineUpload.status,
        pulled: 0,
        pushed: initialPushed,
        bootstrapped,
        message: baselineUpload.message,
      };
    }

    if (options.quick) {
      const cursor = getRemoteCursor();
      if (cursor) {
        if (await shouldRecoverPageMetadataCoverageBeforeIncrementalPull(cursor)) {
          const metadata = await syncCloudPageMetadataDelta({
            force: true,
            requireLocalCacheCoverage: true,
          });
          return {
            status: metadata.status,
            pulled: metadata.pulled,
            pushed: initialPushed,
            bootstrapped,
            skipped: metadata.pulled === 0 && initialPushed === 0,
            message: metadata.message,
          };
        }
        let pulled = 0;
        const pushed = initialPushed;
        let nextCursor = cursor;
        let hasMore = false;
        let batches = 0;
        do {
          const result = await pullIncrementalCloudChanges(nextCursor);
          if (!result.ok) {
            return {
              status: result.status,
              pulled,
              pushed,
              message: result.message,
            };
          }
          pulled += result.pulled;
          nextCursor = result.cursor;
          hasMore = result.hasMore;
          batches += 1;
        } while (hasMore && batches < QUICK_INCREMENTAL_BATCH_LIMIT);
        setLastPageSyncAtNow();
        return {
          status: "ok",
          pulled,
          pushed,
          bootstrapped,
          skipped: pulled === 0 && pushed === 0,
        };
      } else {
        const summaryRes = await call({ action: "summary" });
        if (!summaryRes.ok) {
          return {
            status: summaryRes.status,
            pulled: 0,
            pushed: initialPushed,
            bootstrapped,
            message: summaryRes.message,
          };
        }
        const summary = normalizeSummary(summaryRes.json.summary);
        if (summary && summary.watermark === getRemoteWatermark()) {
          setRemoteCursor(summary.cursor);
          setLastPageSyncAtNow();
          return {
            status: "ok",
            pulled: 0,
            pushed: initialPushed,
            bootstrapped,
            skipped: initialPushed === 0,
          };
        }
        if (summary && (await restoreCursorFromLocalMetadata(summary))) {
          return {
            status: "ok",
            pulled: 0,
            pushed: initialPushed,
            bootstrapped,
            skipped: initialPushed === 0,
          };
        }
        const metadata = await syncCloudPageMetadataDelta({ force: true });
        return {
          status: metadata.status,
          pulled: metadata.pulled,
          pushed: initialPushed,
          bootstrapped,
          skipped: metadata.pulled === 0 && initialPushed === 0,
          message: metadata.message,
        };
      }
    }

    const manifestRes = await call({ action: "manifest" });
    if (!manifestRes.ok) {
      return {
        status: manifestRes.status,
        pulled: 0,
        pushed: initialPushed,
        bootstrapped,
        message: manifestRes.message,
      };
    }
    const index = (manifestRes.json.index ?? {}) as Record<string, IndexEntry>;
    const summary = summarizeIndex(index);
    setRemoteWatermark(summary.watermark);
    setRemoteCursor(summary.cursor);

    const local = await getAllPageMetadata();
    const localById = new Map(local.map((p) => [p.id, p]));

    const toPull: string[] = [];
    const pulledPages: RemotePageRecord[] = [];
    for (const [id, entry] of Object.entries(index)) {
      const mine = localById.get(id);
      if (!mine || entry.u > mine.updated_at) toPull.push(id);
    }

    // Pull first so last-write-wins applies before we decide what to push.
    let pulled = 0;
    for (let i = 0; i < toPull.length; i += PULL_BATCH) {
      const ids = toPull.slice(i, i + PULL_BATCH);
      const res = await call({ action: "pull", ids });
      if (!res.ok) {
        return {
          status: res.status,
          pulled,
          pushed: initialPushed,
          bootstrapped,
          repaired: 0,
          message: res.message,
        };
      }
      const pages = Array.isArray(res.json.pages)
        ? (res.json.pages as RemotePageRecord[])
        : [];
      if (pages.length > 0) {
        await applyRemotePages(pages);
        pulled += pages.length;
        pulledPages.push(...pages);
      }
    }

    if (pulled > 0) {
      await mergeModuleRoots();
    }
    const repaired = await repairDailyImportPlacement({ force: pulled > 0 });

    const pushed = initialPushed;

    setLastPageSyncAtNow();
    if (pulled > 0 || repaired > 0) {
      emitPagesUpdated(
        "cloud-pull",
        pulled || repaired,
        pulledPages.length > 0 ? toPageUpdatePayloads(pulledPages) : undefined
      );
    }
    return { status: "ok", pulled, pushed, bootstrapped, repaired };
  } finally {
    reconcileRunning = false;
  }
}
