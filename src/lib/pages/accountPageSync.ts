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
import type { Page } from "@/lib/utils/types";

const ENABLED_KEY = "zhinote.pagesync.enabled";
const LAST_SYNC_KEY = "zhinote.pagesync.lastSyncAt";
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
  message?: string;
}

interface IndexEntry {
  u: string;
  d: 0 | 1;
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

let reconcileRunning = false;

export async function reconcilePageSync(): Promise<ReconcileResult> {
  if (!isPageSyncEnabled()) {
    return { status: "disabled", pulled: 0, pushed: 0 };
  }
  if (reconcileRunning) {
    return { status: "ok", pulled: 0, pushed: 0 };
  }
  reconcileRunning = true;
  try {
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
        return { status: res.status, pulled, pushed: 0, message: res.message };
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

    // Recompute against fresh local state: the pull and the root merge may
    // both have changed pages since the first snapshot.
    const localAfter = pulled > 0 ? await getAllPagesForSync() : local;
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
        if (failed) return { status: failed, pulled, pushed };
      }
      if (size > PUSH_BATCH_BYTES) continue; // single page too large — skip
      batch.push(record);
      batchBytes += size;
    }
    const failed = await flush();
    if (failed) return { status: failed, pulled, pushed };

    if (typeof window !== "undefined") {
      window.localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    }
    return { status: "ok", pulled, pushed };
  } finally {
    reconcileRunning = false;
  }
}
