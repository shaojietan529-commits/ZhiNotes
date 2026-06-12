// Client helpers for account-scoped portfolio cloud sync. Used when the
// browser is signed in (session cookie); devices that are not signed in
// keep using the passcode-based cloudSync helpers.

import type { CloudPortfolioData } from "./cloudSync";
import type { TagMap } from "./positionReport";

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
    const res = await fetch("/api/portfolio/account-sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 501) return { status: "unconfigured" };
    if (res.status === 401) return { status: "unauthenticated" };
    if (res.status === 403) return { status: "forbidden" };
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        status: "error",
        message: typeof json.error === "string" ? json.error : undefined,
      };
    }
    return { status: "ok", data: pick(json) };
  } catch {
    return { status: "error" };
  }
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
