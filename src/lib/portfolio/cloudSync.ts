// Client helpers for portfolio cloud sync. The passcode lives in this
// browser's localStorage; all devices entering the same passcode share one
// cloud copy of the portfolio data.

import type { PortfolioSnapshot, TagMap } from "./positionReport";

export interface CloudPortfolioData {
  snapshot: PortfolioSnapshot | null;
  tagMap: TagMap;
  allocation: number;
  // Optional: older cloud payloads may not carry this field.
  maxNetPct?: number;
  lastEmailMessageId: string | null;
  updatedAt: string;
}

const PASSCODE_KEY = "zhinote.portfolio.syncPasscode.v1";

export function loadSyncPasscode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(PASSCODE_KEY);
  } catch {
    return null;
  }
}

export function saveSyncPasscode(code: string) {
  window.localStorage.setItem(PASSCODE_KEY, code);
}

export function clearSyncPasscode() {
  window.localStorage.removeItem(PASSCODE_KEY);
}

export type SyncResult<T> =
  | { status: "ok"; data: T }
  | { status: "unconfigured" }
  | { status: "unauthorized" }
  | { status: "error" };

export async function pullCloudData(
  passcode: string
): Promise<SyncResult<CloudPortfolioData | null>> {
  try {
    const res = await fetch("/api/portfolio/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "pull", passcode }),
    });
    if (res.status === 501) return { status: "unconfigured" };
    if (res.status === 403) return { status: "unauthorized" };
    if (!res.ok) return { status: "error" };
    const data = await res.json();
    return { status: "ok", data: data.data ?? null };
  } catch {
    return { status: "error" };
  }
}

// On success returns the server-merged tag map (cloud union of all devices).
export async function pushCloudData(
  passcode: string,
  data: CloudPortfolioData
): Promise<SyncResult<TagMap | null>> {
  try {
    const res = await fetch("/api/portfolio/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "push", passcode, data }),
    });
    if (res.status === 501) return { status: "unconfigured" };
    if (res.status === 403) return { status: "unauthorized" };
    if (!res.ok) return { status: "error" };
    const result = await res.json();
    return {
      status: "ok",
      data:
        result.tagMap && typeof result.tagMap === "object"
          ? (result.tagMap as TagMap)
          : null,
    };
  } catch {
    return { status: "error" };
  }
}
