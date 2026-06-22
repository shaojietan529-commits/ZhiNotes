import { NextResponse } from "next/server";
import {
  accountMissingEnv,
  getAccountConfig,
  getSessionAccount,
  kvGet,
  kvSet,
  readSessionToken,
  type AccountConfig,
} from "@/lib/account/server";

export const dynamic = "force-dynamic";

// Account-scoped page cloud sync. Each signed-in account owns one cloud
// copy of its page tree, keyed by email, so the same workspace appears on
// every domain/device that signs in with that account. Local-first stays
// the default: nothing is uploaded until the owner turns the sync toggle
// on in /account (client-side gate), and this route additionally requires
// a valid session on every call.
//
// Storage layout (same KV store as portfolio sync):
//   zhinotes:pagesync:index:{email}        → { [pageId]: { u, d } }
//   zhinotes:pagesync:page:{email}:{id}    → full page record JSON
// Last-write-wins by updated_at; the server never overwrites a newer copy
// with an older one, so a stale device cannot roll back edits.

const INDEX_KEY_PREFIX = "zhinotes:pagesync:index:";
const PAGE_KEY_PREFIX = "zhinotes:pagesync:page:";
const MAX_PAYLOAD_BYTES = 950 * 1024;
const MAX_PUSH_RECORDS = 100;
const MAX_PULL_IDS = 50;

interface IndexEntry {
  u: string; // updated_at
  d: 0 | 1; // deleted tombstone
}

interface IndexSummary {
  count: number;
  deleted: number;
  maxUpdatedAt: string;
  watermark: string;
}

interface PageRecord {
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

function isValidId(value: unknown): value is string {
  return (
    typeof value === "string" && value.length > 0 && value.length <= 64 &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

function sanitizeRecord(value: unknown): PageRecord | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (!isValidId(raw.id)) return null;
  if (typeof raw.updated_at !== "string" || !raw.updated_at) return null;
  if (typeof raw.created_at !== "string" || !raw.created_at) return null;
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  return {
    id: raw.id,
    parent_id: isValidId(raw.parent_id) ? raw.parent_id : null,
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

async function readIndex(
  config: AccountConfig,
  email: string
): Promise<Record<string, IndexEntry>> {
  const raw = await kvGet(config.kv, `${INDEX_KEY_PREFIX}${email}`);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, IndexEntry>;
    }
  } catch {
    // corrupt index — per-page keys remain the source of truth and the
    // next push rebuilds the touched entries
  }
  return {};
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

export async function POST(request: Request) {
  const config = getAccountConfig();
  if (!config) {
    return NextResponse.json(
      {
        error: "account system not configured",
        missing_env: accountMissingEnv(),
      },
      { status: 501 }
    );
  }

  const token = readSessionToken(request);
  if (!token) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  let bodyText: string;
  try {
    bodyText = await request.text();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (bodyText.length > MAX_PAYLOAD_BYTES) {
    return NextResponse.json({ error: "数据过大" }, { status: 413 });
  }

  let body: { action?: string; ids?: unknown; pages?: unknown };
  try {
    body = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  try {
    const account = await getSessionAccount(config, token);
    if (!account) {
      return NextResponse.json(
        { error: "登录已过期，请重新登录。" },
        { status: 401 }
      );
    }
    const me = account.email;

    if (body.action === "manifest") {
      const index = await readIndex(config, me);
      return NextResponse.json({ index });
    }

    if (body.action === "summary") {
      const index = await readIndex(config, me);
      return NextResponse.json({ summary: summarizeIndex(index) });
    }

    if (body.action === "pull") {
      if (!Array.isArray(body.ids)) {
        return NextResponse.json({ error: "缺少 ids" }, { status: 400 });
      }
      const ids = body.ids.filter(isValidId).slice(0, MAX_PULL_IDS);
      const pages: PageRecord[] = [];
      for (const id of ids) {
        const raw = await kvGet(config.kv, `${PAGE_KEY_PREFIX}${me}:${id}`);
        if (!raw) continue;
        try {
          const record = sanitizeRecord(JSON.parse(raw));
          if (record) pages.push(record);
        } catch {
          // skip corrupt record
        }
      }
      return NextResponse.json({ pages });
    }

    if (body.action === "push") {
      if (!Array.isArray(body.pages)) {
        return NextResponse.json({ error: "缺少 pages" }, { status: 400 });
      }
      if (body.pages.length > MAX_PUSH_RECORDS) {
        return NextResponse.json({ error: "单次推送过多" }, { status: 400 });
      }
      const index = await readIndex(config, me);
      const accepted: string[] = [];
      const skipped: string[] = [];

      for (const item of body.pages) {
        const record = sanitizeRecord(item);
        if (!record) continue;
        const existing = index[record.id];
        // Never let an older copy overwrite a newer one.
        if (existing && existing.u >= record.updated_at) {
          skipped.push(record.id);
          continue;
        }
        await kvSet(
          config.kv,
          `${PAGE_KEY_PREFIX}${me}:${record.id}`,
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
          `${INDEX_KEY_PREFIX}${me}`,
          JSON.stringify(index)
        );
      }
      return NextResponse.json({ ok: true, accepted, skipped });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch {
    return NextResponse.json(
      { error: "云端存储读写失败，请稍后重试。" },
      { status: 502 }
    );
  }
}
