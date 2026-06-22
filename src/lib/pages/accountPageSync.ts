"use client";

// Account-scoped page cloud sync engine (client side).
//
// Off by default: nothing is uploaded until the owner flips the toggle on
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
  applyRemotePages,
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
export const PAGE_SYNC_CONFIG_EVENT = "zhinote:pagesync-config";

const PULL_BATCH = 40;
const PUSH_BATCH_RECORDS = 50;
const PUSH_BATCH_BYTES = 800 * 1024;
// Covers stored as data URLs can be multi-MB; skip oversized ones rather
// than failing the whole page push.
const MAX_COVER_CHARS = 300 * 1024;

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

interface IndexEntry {
  u: string;
  d: 0 | 1;
}

interface IndexSummary {
  count: number;
  deleted: number;
  maxUpdatedAt: string;
  watermark: string;
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

function summarizeIndex(index: Record<string, IndexEntry>): IndexSummary {
  let count = 0;
  let deleted = 0;
  let maxUpdatedAt = "";
  for (const entry of Object.values(index)) {
    count += 1;
    if (entry.d === 1) deleted += 1;
    if (entry.u > maxUpdatedAt) maxUpdatedAt = entry.u;
  }
  return {
    count,
    deleted,
    maxUpdatedAt,
    watermark: `${count}:${deleted}:${maxUpdatedAt}`,
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
  };
}

function getRemoteWatermark(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REMOTE_WATERMARK_KEY);
}

function setRemoteWatermark(watermark: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REMOTE_WATERMARK_KEY, watermark);
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
    if (options.quick) {
      const summaryRes = await call({ action: "summary" });
      if (!summaryRes.ok) {
        return {
          status: summaryRes.status,
          pulled: 0,
          pushed: 0,
          message: summaryRes.message,
        };
      }
      const summary = normalizeSummary(summaryRes.json.summary);
      if (summary && summary.watermark === getRemoteWatermark()) {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
        }
        return { status: "ok", pulled: 0, pushed: 0, skipped: true };
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
    setRemoteWatermark(summarizeIndex(index).watermark);

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
    let pushed = 0;
    let batch: RemotePageRecord[] = [];
    let batchBytes = 0;
    const flush = async (): Promise<PageSyncStatus | null> => {
      if (batch.length === 0) return null;
      const res = await call({ action: "push", pages: batch });
      batch = [];
      batchBytes = 0;
      if (!res.ok) return res.status;
      pushed += Array.isArray(res.json.accepted)
        ? res.json.accepted.length
        : 0;
      return null;
    };

    for (const page of toPush) {
      const record = toRecord(page);
      const size = JSON.stringify(record).length;
      if (
        batch.length >= PUSH_BATCH_RECORDS ||
        (batchBytes + size > PUSH_BATCH_BYTES && batch.length > 0)
      ) {
        const failed = await flush();
        if (failed) return { status: failed, pulled, pushed, repaired };
      }
      if (size > PUSH_BATCH_BYTES) continue; // single page too large — skip
      batch.push(record);
      batchBytes += size;
    }
    const failed = await flush();
    if (failed) return { status: failed, pulled, pushed, repaired };

    if (typeof window !== "undefined") {
      window.localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    }
    return { status: "ok", pulled, pushed, repaired };
  } finally {
    reconcileRunning = false;
  }
}
