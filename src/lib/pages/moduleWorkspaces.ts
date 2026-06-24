import {
  createPage,
  getAllPageMetadata,
  getPage,
  updatePage,
} from "@/lib/db/local/queries";

// The three top-level "big category" surfaces are each backed by a singleton
// root page. Their descendant pages provide all the content, so every node is a
// real local page (no new tables, no cloud, no migrations).

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

function storageKey(key: ModuleWorkspaceKey) {
  return `zhinote.moduleRoot.${key}`;
}

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

// Concurrent callers (e.g. React strict-mode double effects, or two
// components mounting together) must share one lookup, otherwise both can
// miss the stored id and each create a duplicate root page.
const inFlightRootLookups = new Map<ModuleWorkspaceKey, Promise<string>>();

// Find (or create) the singleton root page for a module workspace.
// Resilient to a cleared localStorage: it will re-adopt an existing root page
// that matches the known title before creating a brand new one.
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

  // Try to adopt an existing top-level page with the current or legacy title.
  // Pick the smallest id deterministically so every device converges on the
  // same root when duplicates exist (page cloud sync merges the rest).
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
}

export function rememberModuleRootId(key: ModuleWorkspaceKey, id: string) {
  rememberRoot(key, id);
}

// Build a YYYY-MM-DD key from a Date in local time (not UTC), so calendar
// days line up with the user's wall clock.
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
