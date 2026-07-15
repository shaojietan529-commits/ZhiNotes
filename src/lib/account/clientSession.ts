"use client";

import type { ClientAccountInfo } from "@/lib/account/clientProfile";

const ACCOUNT_SESSION_CACHE_MS = 10 * 1000;
const ACCOUNT_SESSION_RETRY_BACKOFF_MS = 2 * 60 * 1000;
const ACCOUNT_SESSION_UNCONFIGURED_STORAGE_KEY =
  "zhinote:account-session-unconfigured:v1";
export const ACCOUNT_SESSION_LAST_AUTHENTICATED_STORAGE_KEY =
  "zhinote:account-session-last-authenticated:v1";
export const ACCOUNT_SESSION_EXPLICIT_LOGOUT_STORAGE_KEY =
  "zhinote:account-session-explicit-logout:v1";
const ACCOUNT_SESSION_REQUEST_TIMEOUT_MS = 8000;
// Match the 90-day httpOnly session cookie so transient account API failures
// do not make a valid long-lived login look signed out after one day.
const ACCOUNT_SESSION_LAST_AUTHENTICATED_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const ACCOUNT_SESSION_EXPLICIT_LOGOUT_TTL_MS =
  ACCOUNT_SESSION_LAST_AUTHENTICATED_TTL_MS;

export type AccountSessionStatus =
  | "ok"
  | "unconfigured"
  | "unconfirmed"
  | "error";

export interface AccountSessionResult {
  status: AccountSessionStatus;
  authenticated: boolean;
  account: ClientAccountInfo | null;
  error?: string;
  stale?: boolean;
  staleReason?: string;
  confirmedSignedOut?: boolean;
}

export function isAccountSessionStorageKey(key: string | null): boolean {
  return (
    key === ACCOUNT_SESSION_LAST_AUTHENTICATED_STORAGE_KEY ||
    key === ACCOUNT_SESSION_EXPLICIT_LOGOUT_STORAGE_KEY
  );
}

let accountSessionInFlight: Promise<AccountSessionResult> | null = null;
let cachedAccountSession: AccountSessionResult | null = null;
let cachedAccountSessionAt = 0;
let accountSessionRetryAfter = 0;

export function clearAccountSessionRuntimeCache(): void {
  accountSessionInFlight = null;
  cachedAccountSession = null;
  cachedAccountSessionAt = 0;
  accountSessionRetryAfter = 0;
  clearStoredUnconfiguredAccountSession();
}

export function clearAccountSessionCache(
  options: { clearLastAuthenticated?: boolean } = {}
): void {
  clearAccountSessionRuntimeCache();
  if (options.clearLastAuthenticated) {
    clearStoredAuthenticatedAccount();
    storeExplicitLogoutMarker(Date.now());
  }
}

export function getLastAuthenticatedAccount(): ClientAccountInfo | null {
  const now = Date.now();
  if (hasStoredExplicitLogoutMarker(now)) return null;
  return readStoredAuthenticatedAccount(now);
}

export function rememberLastAuthenticatedAccount(
  account: ClientAccountInfo
): void {
  storeAuthenticatedAccount(account, Date.now());
}

export async function fetchAccountSession(
  options: { force?: boolean } = {}
): Promise<AccountSessionResult> {
  const now = Date.now();
  if (!options.force && cachedAccountSession) {
    if (now - cachedAccountSessionAt < ACCOUNT_SESSION_CACHE_MS) {
      return cachedAccountSession;
    }
    if (
      now < accountSessionRetryAfter &&
      (cachedAccountSession.status === "unconfigured" ||
        cachedAccountSession.status === "unconfirmed" ||
        cachedAccountSession.status === "error")
    ) {
      return cachedAccountSession;
    }
  }
  if (!options.force) {
    const storedUnconfigured = readStoredUnconfiguredAccountSession(now);
    if (storedUnconfigured) {
      const fallbackSession = withStoredAuthenticatedFallback(
        storedUnconfigured,
        now
      );
      cachedAccountSession = fallbackSession;
      cachedAccountSessionAt = now;
      accountSessionRetryAfter = now + ACCOUNT_SESSION_RETRY_BACKOFF_MS;
      return fallbackSession;
    }
  }
  if (accountSessionInFlight) {
    return accountSessionInFlight;
  }

  accountSessionInFlight = runFetchAccountSession().finally(() => {
    accountSessionInFlight = null;
  });
  const result = withStoredAuthenticatedFallback(
    await accountSessionInFlight,
    Date.now()
  );
  cachedAccountSession = result;
  cachedAccountSessionAt = Date.now();
  accountSessionRetryAfter =
    result.status === "unconfigured" ||
    result.status === "unconfirmed" ||
    result.status === "error"
      ? Date.now() + ACCOUNT_SESSION_RETRY_BACKOFF_MS
      : 0;
  if (result.authenticated && result.account && !result.stale) {
    storeAuthenticatedAccount(result.account, Date.now());
  } else if (result.confirmedSignedOut && !result.authenticated) {
    clearStoredAuthenticatedAccount();
  }
  if (result.status === "unconfigured") {
    storeUnconfiguredAccountSession(Date.now());
  } else if (result.status === "ok") {
    clearStoredUnconfiguredAccountSession();
  }
  return result;
}

async function runFetchAccountSession(): Promise<AccountSessionResult> {
  try {
    const res = await fetchAccountSessionStatus();
    if (res.status === 501) {
      return {
        status: "unconfigured",
        authenticated: false,
        account: null,
        error: "account system not configured",
      };
    }
    if (!res.ok) {
      const retryable = await readAccountSessionRetryablePayload(res);
      if (retryable) {
        return {
          status: "unconfirmed",
          authenticated: false,
          account: null,
          error: retryable.reason,
        };
      }
      return {
        status: "error",
        authenticated: false,
        account: null,
        error: "account session check failed",
      };
    }
    const data = await res.json();
    if (data.authenticated && data.account) {
      return {
        status: "ok",
        authenticated: true,
        account: data.account as ClientAccountInfo,
      };
    }
    if (data.retryable || data.reason === "session-unconfirmed") {
      return {
        status: "unconfirmed",
        authenticated: false,
        account: null,
        error:
          typeof data.reason === "string"
            ? data.reason
            : "account session temporarily unconfirmed",
      };
    }
    return {
      status: "ok",
      authenticated: false,
      account: null,
      confirmedSignedOut: true,
    };
  } catch (error) {
    return {
      status: "error",
      authenticated: false,
      account: null,
      error: isAbortError(error)
        ? "account session check timed out"
        : "network error",
    };
  }
}

async function readAccountSessionRetryablePayload(
  res: Response
): Promise<{ reason: string } | null> {
  try {
    const data = await res.clone().json();
    if (data.retryable || data.reason === "session-unconfirmed") {
      return {
        reason:
          typeof data.reason === "string"
            ? data.reason
            : "account session temporarily unconfirmed",
      };
    }
  } catch {
    // Non-JSON error bodies are treated as ordinary retryable network errors.
  }
  return null;
}

async function fetchAccountSessionStatus(): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    ACCOUNT_SESSION_REQUEST_TIMEOUT_MS
  );
  try {
    return await fetch("/api/account/me", {
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

function readStoredUnconfiguredAccountSession(
  now: number
): AccountSessionResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(
      ACCOUNT_SESSION_UNCONFIGURED_STORAGE_KEY
    );
    if (!raw) return null;
    const cached = JSON.parse(raw) as { status?: string; cachedAt?: unknown };
    if (cached.status !== "unconfigured" || typeof cached.cachedAt !== "number") {
      return null;
    }
    if (now - cached.cachedAt > ACCOUNT_SESSION_RETRY_BACKOFF_MS) {
      window.sessionStorage.removeItem(ACCOUNT_SESSION_UNCONFIGURED_STORAGE_KEY);
      return null;
    }
    return {
      status: "unconfigured",
      authenticated: false,
      account: null,
      error: "account system not configured",
    };
  } catch {
    return null;
  }
}

function storeUnconfiguredAccountSession(now: number): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      ACCOUNT_SESSION_UNCONFIGURED_STORAGE_KEY,
      JSON.stringify({ status: "unconfigured", cachedAt: now })
    );
  } catch {
    // Session storage is optional; memory caching still protects this tab.
  }
}

function clearStoredUnconfiguredAccountSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(ACCOUNT_SESSION_UNCONFIGURED_STORAGE_KEY);
  } catch {
    // Ignore storage failures; account checks can still use the network path.
  }
}

function withStoredAuthenticatedFallback(
  result: AccountSessionResult,
  now: number
): AccountSessionResult {
  if (result.authenticated) {
    return result;
  }
  if (hasStoredExplicitLogoutMarker(now)) {
    return result;
  }
  const canUseFallback =
    result.status === "error" ||
    result.status === "unconfigured" ||
    result.status === "unconfirmed" ||
    (result.status === "ok" && !result.authenticated);
  if (!canUseFallback) return result;
  const account = readStoredAuthenticatedAccount(now);
  if (!account) return result;
  return {
    ...result,
    authenticated: true,
    account,
    stale: true,
    staleReason: getStoredAuthenticatedFallbackReason(result),
  };
}

function getStoredAuthenticatedFallbackReason(
  result: AccountSessionResult
): string {
  if (result.confirmedSignedOut) {
    return "当前浏览器没有确认到有效云端登录；已先显示上次登录用户名。请在账号页重新登录确认，只有手动退出登录才会清除本机账号显示。";
  }
  if (result.status === "ok") {
    return "账号云端暂不可确认；只有手动退出登录才会清除本机账号显示。";
  }
  if (result.status === "unconfigured") {
    return "账号系统暂时不可用；已显示上次登录用户名。";
  }
  if (result.status === "unconfirmed") {
    return "账号会话暂时无法确认；已显示上次登录用户名。";
  }
  if (result.error === "account session check timed out") {
    return "账号检查超时；已显示上次登录用户名，稍后会自动重试。";
  }
  return "账号云端暂不可确认；已显示上次登录用户名，稍后会自动重试。";
}

function storeAuthenticatedAccount(
  account: ClientAccountInfo,
  now: number
): void {
  if (typeof window === "undefined") return;
  clearStoredExplicitLogoutMarker();
  const payload = JSON.stringify({
    storedAt: now,
    account: {
      id: account.id,
      email_hint: account.email_hint,
      display_name: account.display_name,
      createdAt: account.createdAt,
    },
  });
  try {
    window.sessionStorage.setItem(
      ACCOUNT_SESSION_LAST_AUTHENTICATED_STORAGE_KEY,
      payload
    );
  } catch {
    // A stale UI fallback is optional; the httpOnly cookie remains authoritative.
  }
  try {
    window.localStorage.setItem(
      ACCOUNT_SESSION_LAST_AUTHENTICATED_STORAGE_KEY,
      payload
    );
  } catch {
    // Cross-tab fallback is best effort and stores no tokens or cookies.
  }
}

function readStoredAuthenticatedAccount(
  now: number
): ClientAccountInfo | null {
  if (typeof window === "undefined") return null;
  return (
    readStoredAuthenticatedAccountFromStorage(window.sessionStorage, now) ??
    readStoredAuthenticatedAccountFromStorage(window.localStorage, now)
  );
}

function readStoredAuthenticatedAccountFromStorage(
  storage: Storage,
  now: number
): ClientAccountInfo | null {
  try {
    const raw = storage.getItem(ACCOUNT_SESSION_LAST_AUTHENTICATED_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      storedAt?: unknown;
      account?: Partial<ClientAccountInfo>;
    };
    if (
      typeof parsed.storedAt !== "number" ||
      now - parsed.storedAt > ACCOUNT_SESSION_LAST_AUTHENTICATED_TTL_MS
    ) {
      storage.removeItem(ACCOUNT_SESSION_LAST_AUTHENTICATED_STORAGE_KEY);
      return null;
    }
    const account = parsed.account;
    if (
      !account ||
      typeof account.id !== "string" ||
      typeof account.email_hint !== "string" ||
      typeof account.display_name !== "string" ||
      typeof account.createdAt !== "string"
    ) {
      storage.removeItem(ACCOUNT_SESSION_LAST_AUTHENTICATED_STORAGE_KEY);
      return null;
    }
    return {
      id: account.id,
      email_hint: account.email_hint,
      display_name: account.display_name,
      createdAt: account.createdAt,
    };
  } catch {
    return null;
  }
}

function clearStoredAuthenticatedAccount(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(
      ACCOUNT_SESSION_LAST_AUTHENTICATED_STORAGE_KEY
    );
  } catch {
    // Ignore storage failures; explicit server logout still clears the cookie.
  }
  try {
    window.localStorage.removeItem(
      ACCOUNT_SESSION_LAST_AUTHENTICATED_STORAGE_KEY
    );
  } catch {
    // Ignore storage failures; explicit server logout still clears the cookie.
  }
}

function hasStoredExplicitLogoutMarker(now: number): boolean {
  if (typeof window === "undefined") return false;
  return (
    readExplicitLogoutMarkerFromStorage(window.sessionStorage, now) ||
    readExplicitLogoutMarkerFromStorage(window.localStorage, now)
  );
}

function readExplicitLogoutMarkerFromStorage(
  storage: Storage,
  now: number
): boolean {
  try {
    const raw = storage.getItem(ACCOUNT_SESSION_EXPLICIT_LOGOUT_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { loggedOutAt?: unknown };
    if (
      typeof parsed.loggedOutAt !== "number" ||
      now - parsed.loggedOutAt > ACCOUNT_SESSION_EXPLICIT_LOGOUT_TTL_MS
    ) {
      storage.removeItem(ACCOUNT_SESSION_EXPLICIT_LOGOUT_STORAGE_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function storeExplicitLogoutMarker(now: number): void {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify({ loggedOutAt: now });
  try {
    window.sessionStorage.setItem(
      ACCOUNT_SESSION_EXPLICIT_LOGOUT_STORAGE_KEY,
      payload
    );
  } catch {
    // Logout is still enforced by clearing the httpOnly cookie server-side.
  }
  try {
    window.localStorage.setItem(
      ACCOUNT_SESSION_EXPLICIT_LOGOUT_STORAGE_KEY,
      payload
    );
  } catch {
    // Cross-tab logout signaling is best effort.
  }
}

function clearStoredExplicitLogoutMarker(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(ACCOUNT_SESSION_EXPLICIT_LOGOUT_STORAGE_KEY);
  } catch {
    // Optional marker cleanup; a confirmed server session will still win.
  }
  try {
    window.localStorage.removeItem(ACCOUNT_SESSION_EXPLICIT_LOGOUT_STORAGE_KEY);
  } catch {
    // Optional marker cleanup; a confirmed server session will still win.
  }
}
