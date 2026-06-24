"use client";

import type { ClientAccountInfo } from "@/lib/account/clientProfile";

const ACCOUNT_SESSION_CACHE_MS = 10 * 1000;
const ACCOUNT_SESSION_RETRY_BACKOFF_MS = 2 * 60 * 1000;

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
