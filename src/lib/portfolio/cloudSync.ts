// Client helpers for portfolio cloud sync. The passcode lives in this
// browser's localStorage; all devices entering the same passcode share one
// cloud copy of the portfolio data.

import type { PortfolioSnapshot, TagMap } from "./positionReport";
import {
  acceptPortfolioCloudVersion, createPortfolioPushGuard, parsePortfolioCloudVersion,
  retainPortfolioConflict, type PortfolioCloudVersion, type PortfolioPushGuard,
} from "./portfolioSyncRevision";

export interface CloudPortfolioData {
  snapshot: PortfolioSnapshot | null;
  tagMap: TagMap;
  allocation: number;
  // Optional: older cloud payloads may not carry this field.
  maxNetPct?: number;
  lastEmailMessageId: string | null;
  updatedAt: string;
}

export function portfolioCloudAckConfirmsPush(value: unknown, data: CloudPortfolioData, guard: PortfolioPushGuard): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const ack = value as Record<string, unknown>;
  return ack.format === "zhinote-portfolio-cloud-ack-receipt" &&
    ack.format_version === 2 && ack.ack_status === "acknowledged" &&
    ack.request_id === guard.requestId &&
    parsePortfolioCloudVersion(ack) !== null && typeof ack.revision === "string" &&
    (!guard.base || ack.scope === guard.base.scope) &&
    ack.accepted === true && typeof data.updatedAt === "string" &&
    ack.updated_at === data.updatedAt;
}

const PASSCODE_KEY = "zhinote.portfolio.syncPasscode.v1";
const PORTFOLIO_PASSCODE_SYNC_REQUEST_TIMEOUT_MS = 12000;

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
  | { status: "ok"; data: T; version?: PortfolioCloudVersion }
  | { status: "unconfigured" }
  | { status: "unauthorized" }
  | { status: "error"; message?: string; retryable?: boolean };

export async function pullCloudData(
  passcode: string
): Promise<SyncResult<CloudPortfolioData | null>> {
  try {
    const res = await fetchPortfolioPasscodeSync({ action: "pull", passcode });
    if (res.status === 501) return { status: "unconfigured" };
    if (res.status === 403) return { status: "unauthorized" };
    if (!res.ok) return { status: "error" };
    const data = await res.json();
    const version = parsePortfolioCloudVersion(data.version);
    if (!version) return { status: "error", message: "云端版本暂时无法确认，请稍后重试。" };
    return { status: "ok", data: data.data ?? null, version };
  } catch {
    return { status: "error" };
  }
}

// Returns only the labels confirmed by this version-bound cloud receipt.
export async function pushCloudData(
  passcode: string,
  data: CloudPortfolioData,
  reviewedVersion?: PortfolioCloudVersion
): Promise<SyncResult<TagMap | null>> {
  try {
    const localGuard = createPortfolioPushGuard("passcode");
    if (reviewedVersion && localGuard.base && reviewedVersion.scope !== localGuard.base.scope) {
      return { status: "error", retryable: false, message: "同步空间已改变，未上传冲突处理结果。" };
    }
    const guard = reviewedVersion ? { ...localGuard, base: reviewedVersion } : localGuard;
    const res = await fetchPortfolioPasscodeSync({
      action: "push",
      passcode,
      data,
      ...guard,
    });
    if (res.status === 501) return { status: "unconfigured" };
    if (res.status === 403) return { status: "unauthorized" };
    const result = await res.json();
    if (!res.ok) {
      if (res.status === 409 && result.code === "portfolio-conflict") retainPortfolioConflict("passcode", data, result);
      return { status: "error", message: result.error, retryable: res.status !== 409 && res.status !== 428 };
    }
    if (!portfolioCloudAckConfirmsPush(result.ack, data, guard)) return { status: "error" };
    const version = parsePortfolioCloudVersion(result.ack)!;
    if (!acceptPortfolioCloudVersion("passcode", localGuard, version)) return { status: "error" };
    return {
      status: "ok",
      data: data.tagMap,
    };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : undefined };
  }
}

async function fetchPortfolioPasscodeSync(
  body: Record<string, unknown>
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    PORTFOLIO_PASSCODE_SYNC_REQUEST_TIMEOUT_MS
  );
  try {
    return await fetch("/api/portfolio/sync", {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}
