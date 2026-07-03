// Client helpers for account-scoped portfolio cloud sync. Used when the
// browser is signed in (session cookie); devices that are not signed in
// keep using the passcode-based cloudSync helpers.

import { checkAccountCloudSyncGate } from "@/lib/account/accountCloudSyncGate";
import type { CloudPortfolioData } from "./cloudSync";
import type { TagMap } from "./positionReport";

const ACCOUNT_PORTFOLIO_SYNC_REQUEST_TIMEOUT_MS = 12000;

export type AccountSyncResult<T> =
  | { status: "ok"; data: T }
  | { status: "unauthenticated" }
  | { status: "unconfigured" }
  | { status: "forbidden" }
  | { status: "error"; message?: string };

async function call<T>(
  body: Record<string, unknown>,
  pick: (json: Record<string, unknown>) => T
): Promise<AccountSyncResult<T>> {
  try {
    const accountGate = await checkAccountCloudSyncGate();
    if (accountGate.status === "unconfigured") return { status: "unconfigured" };
    if (accountGate.status === "signed-out") return { status: "unauthenticated" };
    if (accountGate.status === "error") {
      return {
        status: "error",
        message:
          "账号状态暂时无法确认；组合数据仍保留在本地，稍后可重试。",
      };
    }
    const res = await fetchAccountPortfolioSync(body);
    if (res.status === 501) return { status: "unconfigured" };
    if (res.status === 401) {
      return {
        status: "error",
        message:
          "组合同步接口暂时无法确认账号权限；本地组合数据未删除，请稍后重试。",
      };
    }
    if (res.status === 403) return { status: "forbidden" };
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        status: "error",
        message: typeof json.error === "string" ? json.error : undefined,
      };
    }
    return { status: "ok", data: pick(json) };
  } catch (error) {
    return {
      status: "error",
      message: isAbortError(error)
        ? "组合同步请求超时；本地组合数据已保留，会稍后重试。"
        : undefined,
    };
  }
}

async function fetchAccountPortfolioSync(
  body: Record<string, unknown>
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    ACCOUNT_PORTFOLIO_SYNC_REQUEST_TIMEOUT_MS
  );
  try {
    return await fetch("/api/portfolio/account-sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
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

export function accountPullCloud(
  from?: string
): Promise<AccountSyncResult<CloudPortfolioData | null>> {
  return call({ action: "pull", from }, (json) =>
    json.data ? (json.data as CloudPortfolioData) : null
  );
}

// On success returns the server-merged tag map (cloud union of all devices).
export function accountPushCloud(
  data: CloudPortfolioData
): Promise<AccountSyncResult<TagMap | null>> {
  return call({ action: "push", data }, (json) =>
    json.tagMap && typeof json.tagMap === "object"
      ? (json.tagMap as TagMap)
      : null
  );
}

export interface ShareInfo {
  members: string[]; // emails I shared my portfolio with
  sharedWithMe: string[]; // owners who shared their portfolio with me
}

export function fetchShares(): Promise<AccountSyncResult<ShareInfo>> {
  return call({ action: "shares" }, (json) => ({
    members: Array.isArray(json.members) ? (json.members as string[]) : [],
    sharedWithMe: Array.isArray(json.sharedWithMe)
      ? (json.sharedWithMe as string[])
      : [],
  }));
}

export function addShareEmail(
  email: string
): Promise<AccountSyncResult<string[]>> {
  return call({ action: "share-add", email }, (json) =>
    Array.isArray(json.members) ? (json.members as string[]) : []
  );
}

export function removeShareEmail(
  email: string
): Promise<AccountSyncResult<string[]>> {
  return call({ action: "share-remove", email }, (json) =>
    Array.isArray(json.members) ? (json.members as string[]) : []
  );
}
