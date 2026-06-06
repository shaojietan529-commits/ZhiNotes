import { createPage, getAllPages, getPage } from "@/lib/db/local/queries";

// The three top-level "big category" surfaces are each backed by a singleton
// root page. Their descendant pages provide all the content, so every node is a
// real local page (no new tables, no cloud, no migrations).

export type ModuleWorkspaceKey =
  | "daily"
  | "industry-chain"
  | "meeting-schedule";

interface ModuleWorkspaceDef {
  key: ModuleWorkspaceKey;
  title: string;
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
    title: "会议日程",
    icon: "🗓️",
    route: "/schedule",
    label: "会议日程",
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

// Find (or create) the singleton root page for a module workspace.
// Resilient to a cleared localStorage: it will re-adopt an existing root page
// that matches the known title before creating a brand new one.
export async function getModuleRootId(
  key: ModuleWorkspaceKey
): Promise<string> {
  const def = MODULE_WORKSPACES[key];
  const stored =
    typeof window !== "undefined"
      ? window.localStorage.getItem(storageKey(key))
      : null;

  if (stored) {
    const existing = await getPage(stored);
    if (existing) return existing.id;
  }

  // Try to adopt an existing top-level page with the same title.
  const allPages = await getAllPages();
  const adopted = allPages.find(
    (page) => page.parent_id === null && page.title === def.title
  );
  if (adopted) {
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

// Build a YYYY-MM-DD key from a Date in local time (not UTC), so calendar
// days line up with the user's wall clock.
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
