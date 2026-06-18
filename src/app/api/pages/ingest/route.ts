import { NextResponse } from "next/server";
import {
  getAccountConfig,
  getSessionAccount,
  kvGet,
  kvSet,
  readSessionToken,
  type AccountConfig,
} from "@/lib/account/server";
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

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

const INDEX_KEY_PREFIX = "zhinotes:pagesync:index:";
const PAGE_KEY_PREFIX = "zhinotes:pagesync:page:";

// Max content size: ~800 KB of HTML (leaves room in the 1 MB KV limit)
const MAX_CONTENT_BYTES = 800 * 1024;

interface IngestBody {
  title: string;
  content: string; // HTML string
  icon?: string;
  parentId?: string;
  source?: string; // "claude" | "web-clipper" | "api"
  url?: string; // original URL (for web clips)
}

interface IndexEntry {
  u: string; // updated_at
  d: 0 | 1; // deleted
}

function getBearerToken(request: Request): string | null {
  const value = request.headers.get("authorization") ?? "";
  const [scheme, ...rest] = value.split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer") return null;
  const token = rest.join(" ").trim();
  return token || null;
}

async function authenticateRequest(
  config: AccountConfig,
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
  config: AccountConfig,
  key: string
): Promise<string | null> {
  if (!key || key.length < 10) return null;
  const email = await kvGet(config.kv, `zhinotes:apikey:${key}`);
  if (!email || !email.includes("@")) return null;
  return email;
}

export async function POST(request: Request) {
  const config = getAccountConfig();
  if (!config) {
    return corsJson({ error: "account-not-configured" }, { status: 501 });
  }

  const auth = await authenticateRequest(config, request);
  if (!auth) {
    return corsJson({ error: "auth-required" }, { status: 401 });
  }
  const { email } = auth;

  let body: IngestBody;
  try {
    body = (await request.json()) as IngestBody;
  } catch {
    return corsJson({ error: "invalid-json" }, { status: 400 });
  }

  const { title, content, icon, parentId, source, url } = body;

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

  // Build the page record
  const pageId = generateId();
  const now = new Date().toISOString();

  // Build properties: source tag + optional URL
  const properties: Record<string, { type: string; value: string }> = {};
  if (source) {
    properties["来源"] = { type: "select", value: source };
  }
  if (url) {
    properties["链接"] = { type: "url", value: url };
  }

  const pageRecord = {
    id: pageId,
    parent_id: parentId && typeof parentId === "string" ? parentId : null,
    title: title.slice(0, 500),
    icon: icon && typeof icon === "string" ? icon.slice(0, 4) : null,
    cover_url: null,
    content_text: content,
    properties: Object.keys(properties).length > 0
      ? JSON.stringify(properties)
      : null,
    position: Date.now(),
    depth: parentId ? 1 : 0,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };

  // Write the page to KV
  await kvSet(
    config.kv,
    `${PAGE_KEY_PREFIX}${email}:${pageId}`,
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
  });
}

// GET: generate/retrieve API key for the current session
export async function GET(request: Request) {
  const config = getAccountConfig();
  if (!config) {
    return corsJson({ error: "account-not-configured" }, { status: 501 });
  }

  const token = readSessionToken(request);
  const account = token ? await getSessionAccount(config, token) : null;
  if (!account) {
    return corsJson({ error: "auth-required" }, { status: 401 });
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
