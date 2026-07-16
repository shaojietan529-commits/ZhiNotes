import { NextResponse } from "next/server";
import {
  getAccountIdentityConfig,
  getSessionAccount,
  kvGet,
  kvSet,
  readSessionToken,
  type AccountIdentityConfig,
} from "@/lib/account/server";
import {
  accountSessionUnconfirmedHeaders,
  accountSessionUnconfirmedPayload,
} from "@/lib/account/sessionResponses";
import { generateId } from "@/lib/utils/id";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

function corsJson(data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    res.headers.set(key, value);
  }
  return res;
}

function corsSessionUnconfirmedResponse(message: string) {
  return corsJson(accountSessionUnconfirmedPayload(message), {
    status: 503,
    headers: accountSessionUnconfirmedHeaders(),
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

const INDEX_KEY_PREFIX = "zhinotes:pagesync:index:";
const PAGE_KEY_PREFIX = "zhinotes:pagesync:page:";
const DAILY_ROOT_CACHE_PREFIX = "zhinotes:dailyroot:";

// The 每日纪要 (daily notes) workspace root is a singleton top-level page
// identified by title. Saved clips default to landing under it, tagged with
// today's date so they group into the day's column — same shape the daily
// view uses (a 日期 property on a child of the daily root).
const DAILY_ROOT_TITLES = new Set(["每日纪要"]);

// Max content size: ~800 KB of HTML (leaves room in the 1 MB KV limit)
const MAX_CONTENT_BYTES = 800 * 1024;

// Bound how much we scan when locating the daily root on a cold cache.
const SCAN_MAX_IDS = 1200;
const SCAN_CHUNK = 24;

interface IngestBody {
  title: string;
  content: string; // HTML string
  icon?: string;
  parentId?: string;
  source?: string; // "claude" | "web-clipper" | "api"
  url?: string; // original URL (for web clips)
  clientDate?: string; // caller's local YYYY-MM-DD (for correct "today")
  placement?: "daily" | "top"; // default: daily
}

interface IndexEntry {
  u: string; // updated_at
  d: 0 | 1; // deleted
}

interface StoredPage {
  id: string;
  parent_id: string | null;
  title: string;
  deleted_at: string | null;
}

function pageKey(email: string, id: string) {
  return `${PAGE_KEY_PREFIX}${email}:${id}`;
}

function isValidDateKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getBearerToken(request: Request): string | null {
  const value = request.headers.get("authorization") ?? "";
  const [scheme, ...rest] = value.split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer") return null;
  const token = rest.join(" ").trim();
  return token || null;
}

async function authenticateRequest(
  config: AccountIdentityConfig,
  request: Request
): Promise<{ email: string } | null> {
  // Method 1: session cookie (browser extension, same origin)
  const sessionToken = readSessionToken(request);
  if (sessionToken) {
    const account = await getSessionAccount(config, sessionToken);
    if (account) return { email: account.email };
  }

  // Method 2: API key via Bearer token (external tools like Claude)
  const bearer = getBearerToken(request);
  if (bearer) {
    const apiKeyEmail = await validateApiKey(config, bearer);
    if (apiKeyEmail) return { email: apiKeyEmail };
  }

  return null;
}

async function validateApiKey(
  config: AccountIdentityConfig,
  key: string
): Promise<string | null> {
  if (!key || key.length < 10) return null;
  const email = await kvGet(config.kv, `zhinotes:apikey:${key}`);
  if (!email || !email.includes("@")) return null;
  return email;
}

function parseStoredPage(raw: string | null): StoredPage | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    if (typeof obj.id !== "string") return null;
    return {
      id: obj.id,
      parent_id: typeof obj.parent_id === "string" ? obj.parent_id : null,
      title: typeof obj.title === "string" ? obj.title : "",
      deleted_at: typeof obj.deleted_at === "string" ? obj.deleted_at : null,
    };
  } catch {
    return null;
  }
}

function isDailyRoot(page: StoredPage | null): boolean {
  return Boolean(
    page &&
      !page.deleted_at &&
      page.parent_id === null &&
      DAILY_ROOT_TITLES.has(page.title)
  );
}

// Find the 每日纪要 root page id for this account in the synced page store.
// Self-caching: a cold cache triggers a one-time scan of synced page records,
// then we remember the id so later clips only cost two KV reads. Returns null
// if the account has not synced a daily root yet (caller falls back to a
// top-level page).
async function resolveDailyRootId(
  config: AccountIdentityConfig,
  email: string
): Promise<string | null> {
  const cacheKey = `${DAILY_ROOT_CACHE_PREFIX}${email}`;

  // Fast path: trust the cache if the cached page still looks like the root.
  const cached = await kvGet(config.kv, cacheKey);
  if (cached) {
    const rec = parseStoredPage(await kvGet(config.kv, pageKey(email, cached)));
    if (rec && rec.id === cached && isDailyRoot(rec)) return cached;
  }

  // Cold/stale cache: scan the synced records for the daily root.
  const indexRaw = await kvGet(config.kv, `${INDEX_KEY_PREFIX}${email}`);
  if (!indexRaw) return null;
  let index: Record<string, IndexEntry>;
  try {
    index = JSON.parse(indexRaw) as Record<string, IndexEntry>;
  } catch {
    return null;
  }

  const ids = Object.entries(index)
    .filter(([, entry]) => entry.d === 0)
    .map(([id]) => id)
    .slice(0, SCAN_MAX_IDS);

  const matches: StoredPage[] = [];
  for (let i = 0; i < ids.length; i += SCAN_CHUNK) {
    const chunk = ids.slice(i, i + SCAN_CHUNK);
    const recs = await Promise.all(
      chunk.map((id) => kvGet(config.kv, pageKey(email, id)))
    );
    for (const raw of recs) {
      const page = parseStoredPage(raw);
      if (isDailyRoot(page)) matches.push(page!);
    }
  }
  if (matches.length === 0) return null;

  // Deterministic: smallest id, matching the client's convergence rule.
  matches.sort((a, b) => (a.id < b.id ? -1 : 1));
  const rootId = matches[0].id;
  await kvSet(config.kv, cacheKey, rootId);
  return rootId;
}

interface PageProperty {
  id: string;
  name: string;
  type: string;
  value: string;
}

function prop(type: string, name: string, value: string): PageProperty {
  return { id: generateId(), name, type, value };
}

export async function POST(request: Request) {
  const config = getAccountIdentityConfig();
  if (!config) {
    return corsJson({ error: "account-not-configured" }, { status: 501 });
  }

  const hadSessionToken = Boolean(readSessionToken(request));
  const auth = await authenticateRequest(config, request);
  if (!auth) {
    if (hadSessionToken) {
      return corsSessionUnconfirmedResponse(
        "页面导入暂时无法确认账号；不会登出，请稍后重试。"
      );
    }
    return corsJson({ error: "auth-required" }, { status: 401 });
  }
  const { email } = auth;

  let body: IngestBody;
  try {
    body = (await request.json()) as IngestBody;
  } catch {
    return corsJson({ error: "invalid-json" }, { status: 400 });
  }

  const { title, content, icon, parentId, source, url, clientDate, placement } =
    body;

  if (!title || typeof title !== "string") {
    return corsJson(
      { error: "missing-title", message: "title is required" },
      { status: 400 }
    );
  }
  if (!content || typeof content !== "string") {
    return corsJson(
      { error: "missing-content", message: "content is required" },
      { status: 400 }
    );
  }

  const contentBytes = new TextEncoder().encode(content).length;
  if (contentBytes > MAX_CONTENT_BYTES) {
    return corsJson(
      {
        error: "content-too-large",
        message: `内容过大 (${(contentBytes / 1024).toFixed(0)} KB)，限制 ${MAX_CONTENT_BYTES / 1024} KB`,
      },
      { status: 413 }
    );
  }

  // Decide where the clip lands.
  // - Explicit parentId wins.
  // - Otherwise default to the 每日纪要 root, tagged with today's date so it
  //   groups into the day's column. Falls back to a top-level page if no
  //   daily root has synced yet (or placement === "top").
  const today = isValidDateKey(clientDate)
    ? clientDate
    : new Date().toISOString().slice(0, 10);

  let resolvedParent: string | null = null;
  let landedInDaily = false;
  if (parentId && typeof parentId === "string") {
    resolvedParent = parentId;
  } else if (placement !== "top") {
    const dailyRoot = await resolveDailyRootId(config, email);
    if (dailyRoot) {
      resolvedParent = dailyRoot;
      landedInDaily = true;
    }
  }

  // Build properties array (must match the app's PageProperty[] JSON shape).
  const properties: PageProperty[] = [];
  if (placement !== "top") {
    properties.push(prop("date", "日期", today));
  }
  if (source) properties.push(prop("select", "来源", source));
  if (url) properties.push(prop("url", "链接", url));

  const pageId = generateId();
  const now = new Date().toISOString();

  const pageRecord = {
    id: pageId,
    parent_id: resolvedParent,
    title: title.slice(0, 500),
    icon: icon && typeof icon === "string" ? icon.slice(0, 4) : null,
    cover_url: null,
    content_text: content,
    properties: properties.length > 0 ? JSON.stringify(properties) : null,
    position: Date.now(),
    depth: resolvedParent ? 1 : 0,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };

  // Write the page to KV
  await kvSet(
    config.kv,
    pageKey(email, pageId),
    JSON.stringify(pageRecord)
  );

  // Update the manifest index
  const indexKey = `${INDEX_KEY_PREFIX}${email}`;
  const indexRaw = await kvGet(config.kv, indexKey);
  let index: Record<string, IndexEntry> = {};
  if (indexRaw) {
    try {
      index = JSON.parse(indexRaw) as Record<string, IndexEntry>;
    } catch {
      // corrupted index, start fresh
    }
  }
  index[pageId] = { u: now, d: 0 };
  await kvSet(config.kv, indexKey, JSON.stringify(index));

  return corsJson({
    ok: true,
    pageId,
    title: pageRecord.title,
    createdAt: now,
    placement: landedInDaily ? "daily" : "top",
    date: placement !== "top" ? today : null,
  });
}

// GET: generate/retrieve API key for the current session
export async function GET(request: Request) {
  const config = getAccountIdentityConfig();
  if (!config) {
    return corsJson({ error: "account-not-configured" }, { status: 501 });
  }

  const token = readSessionToken(request);
  if (!token) {
    return corsJson({ error: "auth-required" }, { status: 401 });
  }
  const account = await getSessionAccount(config, token);
  if (!account) {
    return corsSessionUnconfirmedResponse(
      "API key 管理暂时无法确认账号；不会登出，请稍后重试。"
    );
  }

  const action = new URL(request.url).searchParams.get("action");

  if (action === "generate") {
    // Revoke old key if exists
    const oldKey = await kvGet(
      config.kv,
      `zhinotes:apikey-owner:${account.email}`
    );
    if (oldKey) {
      await kvSet(config.kv, `zhinotes:apikey:${oldKey}`, "");
    }
    // Generate a new API key for this account
    const apiKey = generateId() + generateId(); // ~42 chars
    await kvSet(config.kv, `zhinotes:apikey:${apiKey}`, account.email);
    await kvSet(
      config.kv,
      `zhinotes:apikey-owner:${account.email}`,
      apiKey
    );
    return corsJson({ ok: true, apiKey });
  }

  if (action === "current") {
    const existing = await kvGet(
      config.kv,
      `zhinotes:apikey-owner:${account.email}`
    );
    return corsJson({
      ok: true,
      apiKey: existing || null,
    });
  }

  return corsJson({ error: "unknown-action" }, { status: 400 });
}
