import { DEFAULT_OWNER_ID } from "@/lib/utils/id";
import type { Page } from "@/lib/utils/types";

const PAGE_ROUTE_HANDOFF_PREFIX = "zhinote.page.routeHandoff.";
const PAGE_ROUTE_HANDOFF_TTL_MS = 2 * 60 * 1000;
const PAGE_ROUTE_HANDOFF_MAX_ITEMS = 20;

interface PageRouteHandoffPage {
  id: string;
  owner_id: string;
  parent_id: string | null;
  database_id: string | null;
  title: string;
  icon: string | null;
  cover_url: string | null;
  properties: string | null;
  position: number;
  depth: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_version: number;
}

interface PageRouteHandoff {
  format: "zhinote-page-route-handoff";
  format_version: 1;
  route_target: "/page/[pageId]";
  architecture_target: "cloud-master-local-route-handoff";
  source:
    | "daily-create"
    | "daily-open"
    | "meeting-create"
    | "meeting-open"
    | "database-row-create"
    | "database-row-open"
    | "page-open";
  cached_at: string;
  expires_at: string;
  privacy_boundary: string;
  boundary: {
    stores_page_body_text: false;
    stores_page_yjs: false;
    reads_database_row_values: false;
    reads_comment_bodies: false;
    reads_file_bytes: false;
    reads_file_text: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    enters_sync_log: false;
    stores_source_of_truth: false;
    records_metadata_only: true;
  };
  page: PageRouteHandoffPage;
}

export function rememberPageRouteHandoff(
  page: Page,
  source: PageRouteHandoff["source"] = "page-open"
): void {
  if (typeof window === "undefined") return;
  const now = Date.now();
  const handoff: PageRouteHandoff = {
    format: "zhinote-page-route-handoff",
    format_version: 1,
    route_target: "/page/[pageId]",
    architecture_target: "cloud-master-local-route-handoff",
    source,
    cached_at: new Date(now).toISOString(),
    expires_at: new Date(now + PAGE_ROUTE_HANDOFF_TTL_MS).toISOString(),
    privacy_boundary:
      "This handoff is a short-lived route transition cache for fast page first paint. It stores page metadata only and never stores page body HTML/text, Yjs editor state, database row values, comments, files, credentials, or raw cache dumps. It does not enter sync_log, does not upload, and is never a cloud source of truth.",
    boundary: {
      stores_page_body_text: false,
      stores_page_yjs: false,
      reads_database_row_values: false,
      reads_comment_bodies: false,
      reads_file_bytes: false,
      reads_file_text: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      enters_sync_log: false,
      stores_source_of_truth: false,
      records_metadata_only: true,
    },
    page: toHandoffPage(page),
  };

  try {
    prunePageRouteHandoffs(now);
    window.sessionStorage.setItem(
      pageRouteHandoffKey(page.id),
      JSON.stringify(handoff)
    );
  } catch {
    // Route handoff is only a local speed hint. Navigation still works through
    // in-memory store, local cache, or cloud fetch when sessionStorage fails.
  }
}

export function readPageRouteHandoff(pageId: string): Page | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(pageRouteHandoffKey(pageId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PageRouteHandoff>;
    if (!isValidPageRouteHandoff(parsed, pageId)) {
      window.sessionStorage.removeItem(pageRouteHandoffKey(pageId));
      return null;
    }
    if (Date.parse(parsed.expires_at) < Date.now()) {
      window.sessionStorage.removeItem(pageRouteHandoffKey(pageId));
      return null;
    }
    return handoffPageToPage(parsed.page);
  } catch {
    return null;
  }
}

export function clearPageRouteHandoff(pageId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(pageRouteHandoffKey(pageId));
  } catch {
    // Best-effort local cache cleanup.
  }
}

function pageRouteHandoffKey(pageId: string): string {
  return `${PAGE_ROUTE_HANDOFF_PREFIX}${pageId}:v1`;
}

function toHandoffPage(page: Page): PageRouteHandoffPage {
  return {
    id: page.id,
    owner_id: page.owner_id || DEFAULT_OWNER_ID,
    parent_id: page.parent_id,
    database_id: page.database_id,
    title: page.title,
    icon: page.icon,
    cover_url: page.cover_url,
    properties: page.properties,
    position: page.position,
    depth: page.depth,
    created_at: page.created_at,
    updated_at: page.updated_at,
    deleted_at: page.deleted_at,
    sync_version: page.sync_version,
  };
}

function handoffPageToPage(page: PageRouteHandoffPage): Page {
  return {
    ...page,
    content_yjs: null,
    content_text: null,
  };
}

function isValidPageRouteHandoff(
  value: Partial<PageRouteHandoff>,
  pageId: string
): value is PageRouteHandoff {
  return (
    value.format === "zhinote-page-route-handoff" &&
    value.format_version === 1 &&
    value.route_target === "/page/[pageId]" &&
    value.page?.id === pageId &&
    typeof value.expires_at === "string"
  );
}

function prunePageRouteHandoffs(now: number): void {
  const entries: Array<{ key: string; expiresAt: number }> = [];
  const storage = window.sessionStorage;
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key?.startsWith(PAGE_ROUTE_HANDOFF_PREFIX)) continue;
    try {
      const value = JSON.parse(storage.getItem(key) || "{}") as {
        expires_at?: string;
      };
      const expiresAt = Date.parse(value.expires_at || "");
      if (!Number.isFinite(expiresAt) || expiresAt < now) {
        storage.removeItem(key);
      } else {
        entries.push({ key, expiresAt });
      }
    } catch {
      storage.removeItem(key);
    }
  }

  entries
    .sort((a, b) => a.expiresAt - b.expiresAt)
    .slice(0, Math.max(0, entries.length - PAGE_ROUTE_HANDOFF_MAX_ITEMS))
    .forEach((entry) => storage.removeItem(entry.key));
}
