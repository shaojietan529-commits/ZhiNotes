import {
  kvGet,
  kvSet,
  type AccountConfig,
} from "@/lib/account/server";

export const PAGE_SYNC_INDEX_KEY_PREFIX = "zhinotes:pagesync:index:";
export const PAGE_SYNC_PAGE_KEY_PREFIX = "zhinotes:pagesync:page:";

export interface PageSyncIndexEntry {
  u: string;
  d: 0 | 1;
}

export interface PageSyncRecord {
  id: string;
  parent_id: string | null;
  title: string;
  icon: string | null;
  cover_url: string | null;
  content_text: string | null;
  properties: string | null;
  position: number;
  depth: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export function isValidPageSyncId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 64 &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

export function sanitizePageSyncRecord(value: unknown): PageSyncRecord | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (!isValidPageSyncId(raw.id)) return null;
  if (typeof raw.updated_at !== "string" || !raw.updated_at) return null;
  if (typeof raw.created_at !== "string" || !raw.created_at) return null;
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  return {
    id: raw.id,
    parent_id: isValidPageSyncId(raw.parent_id) ? raw.parent_id : null,
    title: typeof raw.title === "string" ? raw.title : "",
    icon: str(raw.icon),
    cover_url: str(raw.cover_url),
    content_text: str(raw.content_text),
    properties: str(raw.properties),
    position: typeof raw.position === "number" ? raw.position : 0,
    depth: typeof raw.depth === "number" ? raw.depth : 0,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    deleted_at: str(raw.deleted_at),
  };
}

export async function readPageSyncIndex(
  config: AccountConfig,
  email: string
): Promise<Record<string, PageSyncIndexEntry>> {
  const raw = await kvGet(config.kv, `${PAGE_SYNC_INDEX_KEY_PREFIX}${email}`);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, PageSyncIndexEntry>;
    }
  } catch {
    // corrupt index: per-page keys remain the source of truth
  }
  return {};
}

export async function readPageSyncPage(
  config: AccountConfig,
  email: string,
  id: string
): Promise<PageSyncRecord | null> {
  const raw = await kvGet(config.kv, `${PAGE_SYNC_PAGE_KEY_PREFIX}${email}:${id}`);
  if (!raw) return null;
  try {
    return sanitizePageSyncRecord(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function upsertPageSyncRecords(
  config: AccountConfig,
  email: string,
  records: PageSyncRecord[]
): Promise<{ accepted: string[]; skipped: string[] }> {
  const index = await readPageSyncIndex(config, email);
  const accepted: string[] = [];
  const skipped: string[] = [];

  for (const record of records) {
    const existing = index[record.id];
    if (existing && existing.u >= record.updated_at) {
      skipped.push(record.id);
      continue;
    }
    await kvSet(
      config.kv,
      `${PAGE_SYNC_PAGE_KEY_PREFIX}${email}:${record.id}`,
      JSON.stringify(record)
    );
    index[record.id] = {
      u: record.updated_at,
      d: record.deleted_at ? 1 : 0,
    };
    accepted.push(record.id);
  }

  if (accepted.length > 0) {
    await kvSet(
      config.kv,
      `${PAGE_SYNC_INDEX_KEY_PREFIX}${email}`,
      JSON.stringify(index)
    );
  }

  return { accepted, skipped };
}
