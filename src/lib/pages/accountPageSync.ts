"use client";

// Account-scoped page cloud sync engine (client side).
//
// On by default for signed-in browsers, with a local opt-out switch on
// /account (stored in localStorage). When enabled and signed in, reconcile
// compares the local page tree with the account's cloud copy and:
//   - pulls remote pages that are newer or missing locally
//   - pushes local pages that are newer or missing remotely
// Conflicts resolve last-write-wins by updated_at. Tombstones (deleted_at)
// propagate both ways so deletions follow the account too.
//
// Only page fields sync: title, body HTML, hierarchy, position, icon,
// properties, cover. Databases, files, comments and versions stay local.

import {
  applyRemotePageMetadata,
  applyRemotePages,
  clearLocalPageCacheForIds,
  getAllPagesForSync,
  getNextPosition,
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
import { emitPagesUpdated } from "@/lib/pages/pageUpdateBus";
import type { Page } from "@/lib/utils/types";

const ENABLED_KEY = "zhinote.pagesync.enabled";
const LAST_SYNC_KEY = "zhinote.pagesync.lastSyncAt";
const REMOTE_WATERMARK_KEY = "zhinote.pagesync.remoteWatermark";
const REMOTE_CURSOR_KEY = "zhinote.pagesync.remoteCursor";
const PENDING_PUSH_IDS_KEY = "zhinote.pagesync.pendingPushIds";
export const PAGE_SYNC_CONFIG_EVENT = "zhinote:pagesync-config";

const PULL_BATCH = 40;
const PUSH_BATCH_RECORDS = 50;
const PUSH_BATCH_BYTES = 800 * 1024;
const INCREMENTAL_PULL_LIMIT = 50;
const METADATA_DELTA_THROTTLE_MS = 2500;
// Covers stored as data URLs can be multi-MB; skip oversized ones rather
// than failing the whole page push.
const MAX_COVER_CHARS = 300 * 1024;
const CLOUD_PUSH_DEBOUNCE_MS = 1000;
let queuedCloudPush = new Map<string, RemotePageRecord>();
let queuedCloudPushTimer: ReturnType<typeof setTimeout> | null = null;
let metadataDeltaInFlight: Promise<CloudPageMetadataDeltaResult> | null = null;
let lastMetadataDeltaAt = 0;
let lastMetadataDeltaResult: CloudPageMetadataDeltaResult | null = null;

export function isPageSyncEnabled(): boolean {
  if (typeof window === "undefined") return false;
  // On by default (opt-out): the owner asked for both domains to stay in
  // sync automatically, so only an explicit "false" disables it. Sync still
  // does nothing unless the browser is signed in to the account.
  return window.localStorage.getItem(ENABLED_KEY) !== "false";
}

export function setPageSyncEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ENABLED_KEY, String(enabled));
  window.dispatchEvent(new CustomEvent(PAGE_SYNC_CONFIG_EVENT));
}

export function getLastPageSyncAt(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(LAST_SYNC_KEY);
}

export type PageSyncStatus =
  | "ok"
  | "unauthenticated"
  | "unconfigured"
  | "disabled"
  | "error";

export interface ReconcileResult {
  status: PageSyncStatus;
  pulled: number;
  pushed: number;
  repaired?: number;
  message?: string;
  skipped?: boolean;
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
  pulled: number;
  total: number;
  repaired?: number;
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

interface DailyCloudMetadataOptions {
  startDate?: string;
  endDate?: string;
  recentLimit?: number;
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

interface ReconcileOptions {
  quick?: boolean;
}

async function call(body: Record<string, unknown>): Promise<
  | { ok: true; json: Record<string, unknown> }
  | { ok: false; status: PageSyncStatus; message?: string }
> {
  try {
    const res = await fetch("/api/pages/account-sync", {
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
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    }
    emitPagesUpdated("cloud-pull", pages.length);
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
  const res = await call({ action: "pull", ids: uniqueIds });
  if (!res.ok) {
    return { status: res.status, pages: [], message: res.message };
  }
  const pages = Array.isArray(res.json.pages)
    ? (res.json.pages as RemotePageRecord[])
    : [];
  return { status: "ok", pages };
}

export async function fetchCloudPageById(
  id: string
): Promise<CloudPageLookupResult> {
  return fetchCloudPagesByIds([id]);
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
  options: { force?: boolean } = {}
): Promise<CloudPageMetadataDeltaResult> {
  if (!isPageSyncEnabled()) {
    return { status: "disabled", pulled: 0, pages: [], fullRefresh: false };
  }
  if (!options.force) {
    if (metadataDeltaInFlight) return metadataDeltaInFlight;
    if (
      lastMetadataDeltaResult &&
      Date.now() - lastMetadataDeltaAt < METADATA_DELTA_THROTTLE_MS
    ) {
      return { ...lastMetadataDeltaResult, throttled: true };
    }
  }

  metadataDeltaInFlight = runCloudPageMetadataDelta();
  try {
    const result = await metadataDeltaInFlight;
    lastMetadataDeltaResult = result;
    lastMetadataDeltaAt = Date.now();
    return result;
  } finally {
    metadataDeltaInFlight = null;
  }
}

async function runCloudPageMetadataDelta(): Promise<CloudPageMetadataDeltaResult> {
  const cursor = getRemoteCursor();
  if (!cursor) {
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
        emitPagesUpdated("cloud-pull", cloud.pages.length);
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

  let nextCursor = cursor;
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
    emitPagesUpdated("cloud-pull", pulled);
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
  if (!isPageSyncEnabled()) {
    return { status: "disabled", accepted: [], skipped: [] };
  }
  const res = await call({ action: "push", pages: records });
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
  clearPendingCloudPushIds([...accepted, ...skipped]);
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
  message?: string;
}> {
  let accepted = 0;
  let skipped = 0;
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
          message: result.message,
        };
      }
      if (result) {
        clearPendingCloudPushIds([...result.accepted, ...result.skipped]);
        accepted += result.accepted.length;
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
      accepted,
      skipped,
      message: result.message,
    };
  }
  if (result) {
    clearPendingCloudPushIds([...result.accepted, ...result.skipped]);
    accepted += result.accepted.length;
    skipped += result.skipped.length;
  }
  return { status: "ok", accepted, skipped };
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
  let failed = 0;
  let failedReason: string | undefined;
  try {
    await applyRemotePageMetadata(pages);
    pulled = pages.length;
  } catch {
    for (const page of pages) {
      try {
        await applyRemotePageMetadata([page]);
        pulled += 1;
      } catch (error) {
        failed += 1;
        if (!failedReason) {
          failedReason =
            error instanceof Error ? error.message : "未知本机写入错误";
        }
      }
    }
  }

  if (typeof window !== "undefined") {
    window.localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  }
  if (pulled > 0) {
    emitPagesUpdated("cloud-pull", pulled);
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
  const res = await call({
    action: options.startDate || options.endDate
      ? "daily-calendar-metadata"
      : "daily-metadata",
    ...(options.startDate ? { startDate: options.startDate } : {}),
    ...(options.endDate ? { endDate: options.endDate } : {}),
    ...(typeof options.recentLimit === "number"
      ? { recentLimit: options.recentLimit }
      : {}),
  });
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
  markPendingCloudPush(record.id);
  queuedCloudPush.set(record.id, record);
  if (queuedCloudPushTimer) clearTimeout(queuedCloudPushTimer);
  queuedCloudPushTimer = setTimeout(() => {
    const batch = [...queuedCloudPush.values()];
    queuedCloudPush = new Map();
    queuedCloudPushTimer = null;
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

async function flushPendingCloudPushes(): Promise<{
  status: PageSyncStatus;
  pushed: number;
  pending: number;
  message?: string;
}> {
  const ids = getPendingCloudPushIds();
  if (ids.length === 0) {
    return { status: "ok", pushed: 0, pending: 0 };
  }

  let pages: Page[];
  try {
    pages = await getAllPagesForSync();
  } catch (error) {
    return {
      status: "ok",
      pushed: 0,
      pending: ids.length,
      message: error instanceof Error ? error.message : "本地缓存读取失败",
    };
  }

  const localById = new Map(pages.map((page) => [page.id, page]));
  const records: RemotePageRecord[] = [];
  const missing: string[] = [];
  for (const id of ids) {
    const page = localById.get(id);
    if (page) {
      records.push(toRecord(page));
    } else {
      missing.push(id);
    }
  }
  clearPendingCloudPushIds(missing);
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

function stringifyPageChangeCursor(updatedAt: string, id: string): string {
  if (!updatedAt) return "";
  return JSON.stringify({ updatedAt, id });
}

function getRemoteWatermark(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REMOTE_WATERMARK_KEY);
}

function setRemoteWatermark(watermark: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REMOTE_WATERMARK_KEY, watermark);
}

function getRemoteCursor(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REMOTE_CURSOR_KEY);
}

function setRemoteCursor(cursor: string) {
  if (typeof window === "undefined" || !cursor) return;
  window.localStorage.setItem(REMOTE_CURSOR_KEY, cursor);
}

function setLastPageSyncAtNow() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
}

function getPendingCloudPushIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(PENDING_PUSH_IDS_KEY) ?? "[]"
    );
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
  if (typeof window === "undefined") return;
  const next = Array.from(new Set(ids.filter(isValidRemotePageId)));
  if (next.length === 0) {
    window.localStorage.removeItem(PENDING_PUSH_IDS_KEY);
    return;
  }
  window.localStorage.setItem(PENDING_PUSH_IDS_KEY, JSON.stringify(next));
}

function markPendingCloudPush(id: string): void {
  if (!isValidRemotePageId(id)) return;
  setPendingCloudPushIds([...getPendingCloudPushIds(), id]);
}

function clearPendingCloudPushIds(ids: string[]): void {
  if (ids.length === 0) return;
  const cleared = new Set(ids.filter(isValidRemotePageId));
  if (cleared.size === 0) return;
  setPendingCloudPushIds(
    getPendingCloudPushIds().filter((id) => !cleared.has(id))
  );
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

async function repairDailyImportPlacement(): Promise<number> {
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
  return repaired;
}

export async function rebuildPageCacheFromCloud(): Promise<RebuildPageCacheResult> {
  if (!isPageSyncEnabled()) {
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

  const index = (manifestRes.json.index ?? {}) as Record<string, IndexEntry>;
  const ids = Object.keys(index).filter(isValidRemotePageId);
  let cleared = 0;
  let pulled = 0;

  for (let i = 0; i < ids.length; i += PULL_BATCH) {
    const batchIds = ids.slice(i, i + PULL_BATCH);
    const res = await call({ action: "pull", ids: batchIds });
    if (!res.ok) {
      return {
        status: res.status,
        cleared,
        pulled,
        total: ids.length,
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
    }
  }

  if (pulled > 0) {
    await mergeModuleRoots();
  }
  const repaired = await repairDailyImportPlacement();
  const summary = summarizeIndex(index);
  setRemoteWatermark(summary.watermark);
  setRemoteCursor(summary.cursor);
  setLastPageSyncAtNow();
  if (pulled > 0 || cleared > 0 || repaired > 0) {
    emitPagesUpdated("cloud-pull", pulled || cleared || repaired);
  }

  return {
    status: "ok",
    cleared,
    pulled,
    total: ids.length,
    repaired,
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
    emitPagesUpdated("cloud-pull", changes.pages.length);
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
    const pendingPush = await flushPendingCloudPushes();
    if (
      pendingPush.status === "unauthenticated" ||
      pendingPush.status === "unconfigured" ||
      pendingPush.status === "disabled"
    ) {
      return {
        status: pendingPush.status,
        pulled: 0,
        pushed: pendingPush.pushed,
        message: pendingPush.message,
      };
    }

    if (options.quick) {
      const cursor = getRemoteCursor();
      if (cursor) {
        let pulled = 0;
        const pushed = pendingPush.pushed;
        let nextCursor = cursor;
        let hasMore = false;
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
        } while (hasMore);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
        }
        return {
          status: "ok",
          pulled,
          pushed,
          skipped: pulled === 0 && pushed === 0,
        };
      } else {
        const summaryRes = await call({ action: "summary" });
        if (!summaryRes.ok) {
          return {
            status: summaryRes.status,
            pulled: 0,
            pushed: pendingPush.pushed,
            message: summaryRes.message,
          };
        }
        const summary = normalizeSummary(summaryRes.json.summary);
        if (summary && summary.watermark === getRemoteWatermark()) {
          setRemoteCursor(summary.cursor);
          if (typeof window !== "undefined") {
            window.localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
          }
          return {
            status: "ok",
            pulled: 0,
            pushed: pendingPush.pushed,
            skipped: pendingPush.pushed === 0,
          };
        }
      }
    }

    const manifestRes = await call({ action: "manifest" });
    if (!manifestRes.ok) {
      return {
        status: manifestRes.status,
        pulled: 0,
        pushed: 0,
        message: manifestRes.message,
      };
    }
    const index = (manifestRes.json.index ?? {}) as Record<string, IndexEntry>;
    const summary = summarizeIndex(index);
    setRemoteWatermark(summary.watermark);
    setRemoteCursor(summary.cursor);

    const local = await getAllPagesForSync();
    const localById = new Map(local.map((p) => [p.id, p]));

    const toPull: string[] = [];
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
          pushed: 0,
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
      }
    }

    if (pulled > 0) {
      await mergeModuleRoots();
    }
    const repaired = await repairDailyImportPlacement();

    // Recompute against fresh local state: the pull and the root merge may
    // both have changed pages since the first snapshot.
    const localAfter =
      pulled > 0 || repaired > 0 ? await getAllPagesForSync() : local;
    const toPush: Page[] = [];
    for (const page of localAfter) {
      const remote = index[page.id];
      if (!remote || page.updated_at > remote.u) toPush.push(page);
    }

    // Push in size-capped batches.
    const pushResult = await pushCloudRecordsInBatches(toPush.map(toRecord));
    const pushed = pendingPush.pushed + pushResult.accepted;
    if (pushResult.status !== "ok") {
      return {
        status: pushResult.status,
        pulled,
        pushed,
        repaired,
        message: pushResult.message,
      };
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    }
    return { status: "ok", pulled, pushed, repaired };
  } finally {
    reconcileRunning = false;
  }
}
