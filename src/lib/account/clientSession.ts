"use client";

import type { ClientAccountInfo } from "@/lib/account/clientProfile";

const ACCOUNT_SESSION_CACHE_MS = 10 * 1000;
const ACCOUNT_SESSION_RETRY_BACKOFF_MS = 2 * 60 * 1000;
const ACCOUNT_SESSION_UNCONFIGURED_STORAGE_KEY =
  "zhinote:account-session-unconfigured:v1";

export type AccountSessionStatus = "ok" | "unconfigured" | "error";

export interface AccountSessionResult {
  status: AccountSessionStatus;
  authenticated: boolean;
  account: ClientAccountInfo | null;
  error?: string;
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
      cachedAccountSession = storedUnconfigured;
      cachedAccountSessionAt = now;
      accountSessionRetryAfter = now + ACCOUNT_SESSION_RETRY_BACKOFF_MS;
      return storedUnconfigured;
    }
  }
  if (accountSessionInFlight) {
    return accountSessionInFlight;
  }

  accountSessionInFlight = runFetchAccountSession().finally(() => {
    accountSessionInFlight = null;
  });
  const result = await accountSessionInFlight;
  cachedAccountSession = result;
  cachedAccountSessionAt = Date.now();
  accountSessionRetryAfter =
    result.status === "unconfigured" || result.status === "error"
      ? Date.now() + ACCOUNT_SESSION_RETRY_BACKOFF_MS
      : 0;
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
