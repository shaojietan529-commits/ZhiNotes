"use client";

import type { ClientAccountInfo } from "@/lib/account/clientProfile";

const ACCOUNT_SESSION_CACHE_MS = 10 * 1000;
const ACCOUNT_SESSION_RETRY_BACKOFF_MS = 2 * 60 * 1000;
const ACCOUNT_SESSION_UNCONFIGURED_STORAGE_KEY =
  "zhinote:account-session-unconfigured:v1";
export const ACCOUNT_SESSION_LAST_AUTHENTICATED_STORAGE_KEY =
  "zhinote:account-session-last-authenticated:v1";
// Match the 90-day httpOnly session cookie so transient account API failures
// do not make a valid long-lived login look signed out after one day.
const ACCOUNT_SESSION_LAST_AUTHENTICATED_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export type AccountSessionStatus = "ok" | "unconfigured" | "error";

export interface AccountSessionResult {
  status: AccountSessionStatus;
  authenticated: boolean;
  account: ClientAccountInfo | null;
  error?: string;
  stale?: boolean;
  staleReason?: string;
}

let accountSessionInFlight: Promise<AccountSessionResult> | null = null;
let cachedAccountSession: AccountSessionResult | null = null;
let cachedAccountSessionAt = 0;
let accountSessionRetryAfter = 0;

export function clearAccountSessionCache(): void {
  accountSessionInFlight = null;
  cachedAccountSession = null;
  cachedAccountSessionAt = 0;
  accountSessionRetryAfter = 0;
  clearStoredUnconfiguredAccountSession();
  clearStoredAuthenticatedAccount();
}

export function getLastAuthenticatedAccount(): ClientAccountInfo | null {
  return readStoredAuthenticatedAccount(Date.now());
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
    result.status === "unconfigured" || result.status === "error"
      ? Date.now() + ACCOUNT_SESSION_RETRY_BACKOFF_MS
      : 0;
  if (result.authenticated && result.account && !result.stale) {
    storeAuthenticatedAccount(result.account, Date.now());
  } else if (result.status === "ok" && !result.authenticated) {
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
    const res = await fetch("/api/account/me", { cache: "no-store" });
    if (res.status === 501) {
      return {
        status: "unconfigured",
        authenticated: false,
        account: null,
        error: "account system not configured",
      };
    }
    if (!res.ok) {
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
        status: "error",
        authenticated: false,
        account: null,
        error:
          typeof data.reason === "string"
            ? data.reason
            : "account session temporarily unconfirmed",
      };
    }
    return { status: "ok", authenticated: false, account: null };
  } catch {
    return {
      status: "error",
      authenticated: false,
      account: null,
      error: "network error",
    };
  }
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
  const canUseFallback =
    result.status === "error" ||
    result.status === "unconfigured" ||
    (result.status === "ok" && !result.authenticated);
  if (!canUseFallback) return result;
  const account = readStoredAuthenticatedAccount(now);
  if (!account) return result;
  return {
    ...result,
    authenticated: true,
    account,
    stale: true,
    staleReason:
      result.status === "ok"
        ? "account session could not be confirmed; explicit logout clears this fallback"
        : result.status === "unconfigured"
        ? "account system temporarily unconfigured"
        : result.error ?? "account session check temporarily unavailable",
  };
}

function storeAuthenticatedAccount(
  account: ClientAccountInfo,
  now: number
): void {
  if (typeof window === "undefined") return;
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
