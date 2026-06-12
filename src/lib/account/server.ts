// Server-side helpers for the multi-account email-code login system.
// Storage is the project's Redis/KV store (same one the portfolio sync
// uses); emails go out through Resend. Everything stays inactive (501)
// until the owner sets RESEND_API_KEY and ZHINOTES_ACCOUNT_ALLOWED_EMAILS,
// so deploying this code changes nothing by itself.
//
// Privacy: verification codes are stored only as salted SHA-256 hashes,
// raw emails are never logged, and responses only carry masked emails.

import { createHash, randomBytes, randomUUID, timingSafeEqual } from "crypto";

const CODE_KEY_PREFIX = "zhinotes:account:code:";
const USER_KEY_PREFIX = "zhinotes:account:user:";
const SESSION_KEY_PREFIX = "zhinotes:account:session:";
const SEND_LIMIT_KEY_PREFIX = "zhinotes:account:sendlimit:";

export const SESSION_COOKIE_NAME = "zhinote_session";
export const SESSION_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days
const CODE_TTL_SECONDS = 10 * 60; // 10 minutes
const MAX_VERIFY_ATTEMPTS = 5;
const MAX_SENDS_PER_WINDOW = 3;
const SEND_WINDOW_SECONDS = 10 * 60;

export interface AccountRecord {
  id: string;
  email: string;
  createdAt: string;
  displayName?: string;
}

export interface KvEnv {
  url: string;
  token: string;
}

function kvEnv(): KvEnv | null {
  const url =
    process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

export interface AccountConfig {
  kv: KvEnv;
  resendApiKey: string;
  emailFrom: string;
  allowedEmails: Set<string>;
}

// Returns null (→ caller responds 501) until the owner configures the
// email service and the login allowlist.
export function getAccountConfig(): AccountConfig | null {
  const kv = kvEnv();
  const resendApiKey = process.env.RESEND_API_KEY ?? "";
  const allowlistRaw = process.env.ZHINOTES_ACCOUNT_ALLOWED_EMAILS ?? "";
  const allowedEmails = new Set(
    allowlistRaw
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter((item) => item.includes("@"))
  );
  if (!kv || !resendApiKey || allowedEmails.size === 0) return null;
  return {
    kv,
    resendApiKey,
    emailFrom:
      process.env.ZHINOTES_ACCOUNT_EMAIL_FROM ??
      "ZhiNotes <onboarding@resend.dev>",
    allowedEmails,
  };
}

export function accountMissingEnv(): string[] {
  const missing: string[] = [];
  if (!kvEnv()) missing.push("KV_REST_API_URL / KV_REST_API_TOKEN");
  if (!process.env.RESEND_API_KEY) missing.push("RESEND_API_KEY");
  if (!(process.env.ZHINOTES_ACCOUNT_ALLOWED_EMAILS ?? "").includes("@")) {
    missing.push("ZHINOTES_ACCOUNT_ALLOWED_EMAILS");
  }
  return missing;
}

export async function kvGet(env: KvEnv, key: string): Promise<string | null> {
  const res = await fetch(`${env.url}/get/${encodeURIComponent(key)}`, {
    headers: { authorization: `Bearer ${env.token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("kv get failed");
  const data = await res.json();
  return typeof data.result === "string" ? data.result : null;
}

async function kvSetEx(
  env: KvEnv,
  key: string,
  seconds: number,
  value: string
): Promise<void> {
  const res = await fetch(
    `${env.url}/setex/${encodeURIComponent(key)}/${seconds}`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${env.token}` },
      body: value,
    }
  );
  if (!res.ok) throw new Error("kv setex failed");
}

export async function kvSet(
  env: KvEnv,
  key: string,
  value: string
): Promise<void> {
  const res = await fetch(`${env.url}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.token}` },
    body: value,
  });
  if (!res.ok) throw new Error("kv set failed");
}

export async function kvDel(env: KvEnv, key: string): Promise<void> {
  const res = await fetch(`${env.url}/del/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.token}` },
  });
  if (!res.ok) throw new Error("kv del failed");
}

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return null;
  }
  return email;
}

export function normalizeDisplayName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const displayName = value.trim().replace(/\s+/g, " ");
  if (displayName.length < 1 || displayName.length > 32) return null;
  return displayName;
}

export function defaultDisplayNameForEmail(email: string): string {
  const localPart = email.split("@")[0]?.trim();
  const cleaned = localPart
    ?.replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "ZhiNote 用户";
  return cleaned.slice(0, 32);
}

export function accountDisplayName(account: AccountRecord): string {
  return (
    normalizeDisplayName(account.displayName) ??
    defaultDisplayNameForEmail(account.email)
  );
}

function hashCode(email: string, code: string): string {
  return createHash("sha256")
    .update(`zhinotes-account-code:${email}:${code}`)
    .digest("hex");
}

function hashesMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

// Throttle code emails so a stranger cannot drain the email quota or spam
// an inbox. Returns false when the window is exhausted.
async function consumeSendBudget(
  config: AccountConfig,
  email: string
): Promise<boolean> {
  const key = `${SEND_LIMIT_KEY_PREFIX}${email}`;
  const now = Date.now();
  let count = 0;
  let resetAt = now + SEND_WINDOW_SECONDS * 1000;
  const raw = await kvGet(config.kv, key);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed.resetAt === "number" && parsed.resetAt > now) {
        count = typeof parsed.count === "number" ? parsed.count : 0;
        resetAt = parsed.resetAt;
      }
    } catch {
      // corrupt counter — start a fresh window
    }
  }
  if (count >= MAX_SENDS_PER_WINDOW) return false;
  const ttl = Math.max(60, Math.ceil((resetAt - now) / 1000));
  await kvSetEx(
    config.kv,
    key,
    ttl,
    JSON.stringify({ count: count + 1, resetAt })
  );
  return true;
}

export type SendCodeResult =
  | { status: "sent" }
  | { status: "not-allowed" }
  | { status: "rate-limited" }
  | { status: "email-failed" };

export async function sendLoginCode(
  config: AccountConfig,
  email: string
): Promise<SendCodeResult> {
  if (!config.allowedEmails.has(email)) return { status: "not-allowed" };
  if (!(await consumeSendBudget(config, email))) {
    return { status: "rate-limited" };
  }

  const code = String(randomBytes(4).readUInt32BE(0) % 1_000_000).padStart(
    6,
    "0"
  );
  await kvSetEx(
    config.kv,
    `${CODE_KEY_PREFIX}${email}`,
    CODE_TTL_SECONDS,
    JSON.stringify({ hash: hashCode(email, code), attempts: 0 })
  );

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.resendApiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: config.emailFrom,
      to: [email],
      subject: "ZhiNotes 登录验证码",
      text: `你的 ZhiNotes 登录验证码是：${code}\n\n10 分钟内有效。如果不是你本人操作，请忽略这封邮件。`,
    }),
  });
  if (!res.ok) {
    await kvDel(config.kv, `${CODE_KEY_PREFIX}${email}`);
    return { status: "email-failed" };
  }
  return { status: "sent" };
}

export type VerifyCodeResult =
  | { status: "ok"; account: AccountRecord; sessionToken: string }
  | { status: "invalid-code" }
  | { status: "expired" }
  | { status: "too-many-attempts" };

export async function verifyLoginCode(
  config: AccountConfig,
  email: string,
  code: string
): Promise<VerifyCodeResult> {
  if (!config.allowedEmails.has(email)) return { status: "invalid-code" };
  const codeKey = `${CODE_KEY_PREFIX}${email}`;
  const raw = await kvGet(config.kv, codeKey);
  if (!raw) return { status: "expired" };

  let record: { hash?: string; attempts?: number };
  try {
    record = JSON.parse(raw);
  } catch {
    await kvDel(config.kv, codeKey);
    return { status: "expired" };
  }
  const attempts = typeof record.attempts === "number" ? record.attempts : 0;
  if (attempts >= MAX_VERIFY_ATTEMPTS) {
    await kvDel(config.kv, codeKey);
    return { status: "too-many-attempts" };
  }

  if (
    typeof record.hash !== "string" ||
    !hashesMatch(record.hash, hashCode(email, code))
  ) {
    await kvSetEx(
      config.kv,
      codeKey,
      CODE_TTL_SECONDS,
      JSON.stringify({ hash: record.hash, attempts: attempts + 1 })
    );
    return { status: "invalid-code" };
  }

  // Code accepted — single use.
  await kvDel(config.kv, codeKey);

  const account = await ensureAccount(config, email);
  const sessionToken = randomBytes(32).toString("hex");
  await kvSetEx(
    config.kv,
    `${SESSION_KEY_PREFIX}${sessionToken}`,
    SESSION_TTL_SECONDS,
    JSON.stringify({ accountId: account.id, email: account.email })
  );
  return { status: "ok", account, sessionToken };
}

async function ensureAccount(
  config: AccountConfig,
  email: string
): Promise<AccountRecord> {
  const userKey = `${USER_KEY_PREFIX}${email}`;
  const raw = await kvGet(config.kv, userKey);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed.id === "string" && typeof parsed.email === "string") {
        return parsed as AccountRecord;
      }
    } catch {
      // corrupt record — recreate below
    }
  }
  const account: AccountRecord = {
    id: randomUUID(),
    email,
    createdAt: new Date().toISOString(),
    displayName: defaultDisplayNameForEmail(email),
  };
  await kvSet(config.kv, userKey, JSON.stringify(account));
  return account;
}

export async function updateAccountDisplayName(
  config: AccountConfig,
  account: AccountRecord,
  displayName: string
): Promise<AccountRecord> {
  const nextAccount: AccountRecord = {
    ...account,
    displayName,
  };
  await kvSet(
    config.kv,
    `${USER_KEY_PREFIX}${account.email}`,
    JSON.stringify(nextAccount)
  );
  return nextAccount;
}

export function readSessionToken(request: Request): string | null {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE_NAME) {
      const value = rest.join("=").trim();
      return /^[a-f0-9]{64}$/.test(value) ? value : null;
    }
  }
  return null;
}

// Looks up the session and slides its expiry forward, so active users
// never get logged out.
export async function getSessionAccount(
  config: AccountConfig,
  sessionToken: string
): Promise<AccountRecord | null> {
  const sessionKey = `${SESSION_KEY_PREFIX}${sessionToken}`;
  const raw = await kvGet(config.kv, sessionKey);
  if (!raw) return null;
  let session: { accountId?: string; email?: string };
  try {
    session = JSON.parse(raw);
  } catch {
    return null;
  }
  const email = normalizeEmail(session.email);
  if (!email || !config.allowedEmails.has(email)) return null;
  const userRaw = await kvGet(config.kv, `${USER_KEY_PREFIX}${email}`);
  if (!userRaw) return null;
  try {
    const account = JSON.parse(userRaw) as AccountRecord;
    if (account.id !== session.accountId) return null;
    await kvSetEx(config.kv, sessionKey, SESSION_TTL_SECONDS, raw);
    return account;
  } catch {
    return null;
  }
}

export async function deleteSession(
  config: AccountConfig,
  sessionToken: string
): Promise<void> {
  await kvDel(config.kv, `${SESSION_KEY_PREFIX}${sessionToken}`);
}
