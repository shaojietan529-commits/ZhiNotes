import {
  applyRemotePageMetadata,
  createPage,
  getAllPageMetadata,
  getPage,
  updatePage,
  type RemotePageRecord,
} from "@/lib/db/local/queries";
import { checkAccountCloudSyncGate } from "@/lib/account/accountCloudSyncGate";

// The top-level module surfaces are each backed by a singleton page. Their
// descendant pages provide all the content, so every node stays a real page.
// The browser keeps a local root-id cache, but a missing cache can be rebuilt
// from account cloud metadata before falling back to the rebuildable local cache.

export type ModuleWorkspaceKey =
  | "daily"
  | "industry-chain"
  | "meeting-schedule"
  | "knowledge-base";

interface ModuleWorkspaceDef {
  key: ModuleWorkspaceKey;
  title: string;
  legacyTitles?: string[];
  icon: string;
  route: string;
  label: string;
}

export const MODULE_WORKSPACES: Record<ModuleWorkspaceKey, ModuleWorkspaceDef> = {
  daily: {
    key: "daily",
    title: "每日纪要",
    icon: "📅",
    route: "/daily",
    label: "每日纪要",
  },
  "industry-chain": {
    key: "industry-chain",
    title: "产业链研究",
    icon: "🧭",
    route: "/industry-chain",
    label: "产业链研究",
  },
  "meeting-schedule": {
    key: "meeting-schedule",
    title: "ZhiHui",
    legacyTitles: ["会议日程"],
    icon: "🗓️",
    route: "/schedule",
    label: "ZhiHui",
  },
  "knowledge-base": {
    key: "knowledge-base",
    title: "知识库",
    icon: "📚",
    route: "/knowledge-base",
    label: "知识库",
  },
};

export const MODULE_WORKSPACE_LIST = Object.values(MODULE_WORKSPACES);
export const MODULE_ROOT_IDS_EVENT = "zhinote:module-root-ids";

function storageKey(key: ModuleWorkspaceKey) {
  return `zhinote.moduleRoot.${key}`;
}

const PAGE_SYNC_ENABLED_KEY = "zhinote.pagesync.enabled";
const CLOUD_MODULE_ROOT_CACHE_MS = 30 * 1000;
const CLOUD_MODULE_ROOT_REQUEST_TIMEOUT_MS = 3500;

let cloudModuleRootLookupInFlight:
  | Promise<Map<ModuleWorkspaceKey, RemotePageRecord>>
  | null = null;
let cloudModuleRootLookupCache:
  | { cachedAt: number; roots: Map<ModuleWorkspaceKey, RemotePageRecord> }
  | null = null;

// Synchronously read the known root page ids from localStorage. Used by the
// page tree to hide these special roots from the generic "页面" list.
export function getModuleRootIdsSync(): string[] {
  if (typeof window === "undefined") return [];
  return MODULE_WORKSPACE_LIST.map((def) =>
    window.localStorage.getItem(storageKey(def.key))
  ).filter((id): id is string => Boolean(id));
}

export function getModuleRootIdSync(key: ModuleWorkspaceKey): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(storageKey(key));
}

export async function findLocalModuleRootId(
  key: ModuleWorkspaceKey
): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const def = MODULE_WORKSPACES[key];
  const stored = window.localStorage.getItem(storageKey(key));
  if (stored) {
    const existing = await getPage(stored).catch(() => null);
    if (existing) {
      rememberRoot(key, existing.id);
      return existing.id;
    }
  }

  const localTitleSet = new Set([def.title, ...(def.legacyTitles ?? [])]);
  const allPages = await getAllPageMetadata();

  const adopted = allPages
    .filter((page) => page.parent_id === null && localTitleSet.has(page.title ?? ""))
    .sort((a, b) => (a.id < b.id ? -1 : 1))[0];
  if (!adopted) return null;
  rememberRoot(key, adopted.id);
  return adopted.id;
}

// Concurrent callers (e.g. React strict-mode double effects, or two
// components mounting together) must share one lookup, otherwise both can
// miss the stored id and each create a duplicate root page.
const inFlightRootLookups = new Map<ModuleWorkspaceKey, Promise<string>>();

// Find (or create) the singleton root page for a module workspace.
// Resilient to a cleared localStorage: it first asks the account cloud for the
// canonical root, then falls back to local cache adoption before creating one.
export function getModuleRootId(key: ModuleWorkspaceKey): Promise<string> {
  let pending = inFlightRootLookups.get(key);
  if (!pending) {
    pending = resolveModuleRootId(key);
    inFlightRootLookups.set(key, pending);
    void pending.finally(() => inFlightRootLookups.delete(key));
  }
  return pending;
}

async function resolveModuleRootId(key: ModuleWorkspaceKey): Promise<string> {
  const def = MODULE_WORKSPACES[key];
  const stored =
    typeof window !== "undefined"
      ? window.localStorage.getItem(storageKey(key))
      : null;

  if (stored) {
    const existing = await getPage(stored);
    if (existing) {
      if (existing.title !== def.title) {
        await updatePage(existing.id, { title: def.title });
      }
      return existing.id;
    }
  }

  const cloudRoot = await findCloudModuleRoot(key);
  if (cloudRoot) {
    try {
      await applyRemotePageMetadata([cloudRoot]);
    } catch {
      // Local SQLite is only a rebuildable cache. Even if this write fails,
      // remembering the cloud root avoids creating a duplicate local root.
    }
    rememberRoot(key, cloudRoot.id);
    return cloudRoot.id;
  }

  // Offline/local-only fallback: adopt an existing top-level page with the
  // current or legacy title. Pick the smallest id deterministically so the
  // local cache converges when duplicates exist.
  const titleSet = new Set([def.title, ...(def.legacyTitles ?? [])]);
  const allPages = await getAllPageMetadata();
  const adopted = allPages
    .filter((page) => page.parent_id === null && titleSet.has(page.title ?? ""))
    .sort((a, b) => (a.id < b.id ? -1 : 1))[0];
  if (adopted) {
    if (adopted.title !== def.title) {
      await updatePage(adopted.id, { title: def.title });
    }
    rememberRoot(key, adopted.id);
    return adopted.id;
  }

  const created = await createPage({ title: def.title, icon: def.icon });
  rememberRoot(key, created.id);
  return created.id;
}

function rememberRoot(key: ModuleWorkspaceKey, id: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(key), id);
  window.dispatchEvent(new CustomEvent(MODULE_ROOT_IDS_EVENT));
}

export function rememberModuleRootId(key: ModuleWorkspaceKey, id: string) {
  rememberRoot(key, id);
}

async function findCloudModuleRoot(
  key: ModuleWorkspaceKey
): Promise<RemotePageRecord | null> {
  const roots = await fetchCloudModuleRoots();
  return roots.get(key) ?? null;
}

async function fetchCloudModuleRoots(): Promise<
  Map<ModuleWorkspaceKey, RemotePageRecord>
> {
  if (typeof window === "undefined") return new Map();
  if (window.localStorage.getItem(PAGE_SYNC_ENABLED_KEY) === "false") {
    return new Map();
  }
  const accountGate = await checkAccountCloudSyncGate();
  if (accountGate.status !== "ready") {
    return new Map();
  }
  if (
    cloudModuleRootLookupCache &&
    Date.now() - cloudModuleRootLookupCache.cachedAt < CLOUD_MODULE_ROOT_CACHE_MS
  ) {
    return cloudModuleRootLookupCache.roots;
  }
  if (!cloudModuleRootLookupInFlight) {
    cloudModuleRootLookupInFlight = runCloudModuleRootLookup().finally(() => {
      cloudModuleRootLookupInFlight = null;
    });
  }
  const roots = await cloudModuleRootLookupInFlight;
  cloudModuleRootLookupCache = { cachedAt: Date.now(), roots };
  return roots;
}

async function runCloudModuleRootLookup(): Promise<
  Map<ModuleWorkspaceKey, RemotePageRecord>
> {
  try {
    const res = await fetchCloudModuleRootLookup();
    if (!res.ok) return new Map();
    const json = (await res.json().catch(() => ({}))) as { pages?: unknown };
    const pages = Array.isArray(json.pages)
      ? (json.pages as RemotePageRecord[])
      : [];
    const roots = new Map<ModuleWorkspaceKey, RemotePageRecord>();
    for (const def of MODULE_WORKSPACE_LIST) {
      const titleSet = new Set([def.title, ...(def.legacyTitles ?? [])]);
      const root = pages
        .filter(
          (page) =>
            !page.deleted_at &&
            page.parent_id === null &&
            titleSet.has(page.title ?? "")
        )
        .sort((a, b) => (a.id < b.id ? -1 : 1))[0];
      if (root) roots.set(def.key, root);
    }
    return roots;
  } catch {
    return new Map();
  }
}

async function fetchCloudModuleRootLookup(): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    CLOUD_MODULE_ROOT_REQUEST_TIMEOUT_MS
  );
  try {
    return await fetch("/api/pages/account-sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "module-roots" }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

// Build a YYYY-MM-DD key from a Date in local time (not UTC), so calendar
// days line up with the user's wall clock.
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
