import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";

export const dynamic = "force-dynamic";

// Owner-gated cloud sync for the portfolio module. Data is stored in the
// project's Redis/KV store, protected by a passcode the owner sets on first
// use (only a SHA-256 hash of the passcode is stored). Payloads are never
// logged. Inactive (501) until the KV store is connected in Vercel.

const AUTH_KEY = "zhinotes:portfolio:auth:v1";
const DATA_KEY = "zhinotes:portfolio:data:v1";
const MAX_PAYLOAD_BYTES = 1024 * 1024;

function kvEnv(): { url: string; token: string } | null {
  const url =
    process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

async function kvGet(
  env: { url: string; token: string },
  key: string
): Promise<string | null> {
  const res = await fetch(`${env.url}/get/${key}`, {
    headers: { authorization: `Bearer ${env.token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("kv get failed");
  const data = await res.json();
  return typeof data.result === "string" ? data.result : null;
}

async function kvSet(
  env: { url: string; token: string },
  key: string,
  value: string
): Promise<void> {
  const res = await fetch(`${env.url}/set/${key}`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.token}` },
    body: value,
  });
  if (!res.ok) throw new Error("kv set failed");
}

function hashPasscode(passcode: string): string {
  return createHash("sha256").update(`zhinotes-sync:${passcode}`).digest("hex");
}

function hashesMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export async function POST(req: Request) {
  const env = kvEnv();
  if (!env) {
    return NextResponse.json(
      { error: "cloud storage not configured" },
      { status: 501 }
    );
  }

  let body: { action?: string; passcode?: string; data?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const passcode =
    typeof body.passcode === "string" ? body.passcode.trim() : "";
  if (passcode.length < 6 || passcode.length > 128) {
    return NextResponse.json({ error: "无效的同步密码" }, { status: 400 });
  }

  try {
    const incomingHash = hashPasscode(passcode);
    const storedHash = await kvGet(env, AUTH_KEY);
    if (!storedHash) {
      // First device claims the store by setting the passcode.
      await kvSet(env, AUTH_KEY, incomingHash);
    } else if (!hashesMatch(storedHash, incomingHash)) {
      return NextResponse.json({ error: "同步密码不正确" }, { status: 403 });
    }

    if (body.action === "pull") {
      const raw = await kvGet(env, DATA_KEY);
      return NextResponse.json({ data: raw ? JSON.parse(raw) : null });
    }

    if (body.action === "push") {
      if (!body.data || typeof body.data !== "object") {
        return NextResponse.json({ error: "缺少数据" }, { status: 400 });
      }
      const incoming = body.data as Record<string, unknown>;

      // Server-side tag union: a device pushing a stale/empty tag map can
      // never wipe labels added elsewhere. Incoming values win per stock.
      const incomingTags =
        incoming.tagMap && typeof incoming.tagMap === "object"
          ? (incoming.tagMap as Record<string, string>)
          : {};
      let mergedTags = incomingTags;
      const existingRaw = await kvGet(env, DATA_KEY);
      if (existingRaw) {
        try {
          const existing = JSON.parse(existingRaw);
          if (existing?.tagMap && typeof existing.tagMap === "object") {
            mergedTags = { ...existing.tagMap, ...incomingTags };
          }
        } catch {
          // corrupt existing payload — overwrite it
        }
      }
      incoming.tagMap = mergedTags;

      const serialized = JSON.stringify(incoming);
      if (serialized.length > MAX_PAYLOAD_BYTES) {
        return NextResponse.json({ error: "数据过大" }, { status: 413 });
      }
      await kvSet(env, DATA_KEY, serialized);
      return NextResponse.json({ ok: true, tagMap: mergedTags });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch {
    return NextResponse.json(
      { error: "云端存储读写失败，请稍后重试。" },
      { status: 502 }
    );
  }
}
