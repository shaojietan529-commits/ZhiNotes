"use client";

import {
  clearSyncPasscode,
  loadSyncPasscode,
  pushCloudData,
  type CloudPortfolioData,
} from "@/lib/portfolio/cloudSync";
import {
  accountPushCloud,
  type AccountSyncResult,
} from "@/lib/portfolio/accountSync";
import {
  DEFAULT_MAX_NET_PCT,
  loadAllocation,
  loadDataUpdatedAt,
  loadLastEmailMessageId,
  loadMaxNetPct,
  loadSnapshot,
  loadTagMap,
  saveDataUpdatedAt,
  saveTagMap,
} from "@/lib/portfolio/portfolioStore";

export const PORTFOLIO_SYNC_STATUS_STORAGE_KEY =
  "zhinote.portfolio.sync.status.v1";
export const PORTFOLIO_SYNC_STATUS_EVENT = "zhinote:portfolio-sync-status";
export const PORTFOLIO_SYNC_STATUS_PING_STORAGE_KEY =
  "zhinote.portfolio.sync.status.ping.v1";
export const PORTFOLIO_SYNC_MANUAL_REVIEW_FAILURE_THRESHOLD = 3;
const PORTFOLIO_SYNC_AUTH_RETRY_BACKOFF_MS = 2 * 60 * 1000;

export type PortfolioSyncMode = "account" | "passcode" | null;
export type PortfolioSyncQueueState =
  | "off"
  | "pending"
  | "syncing"
  | "synced"
  | "failed"
  | "manual_review";
export type PortfolioAuthRetryStatus =
  | "unauthenticated"
  | "unconfigured"
  | "unconfirmed"
  | null;

export interface PortfolioCloudSyncStatus {
  enabled: true;
  mode: PortfolioSyncMode;
  queueState: PortfolioSyncQueueState;
  pending: number;
  inFlight: number;
  failed: number;
  manualReviewCount: number;
  failureCountTotal: number;
  maxFailureCount: number;
  manualReviewFailureThreshold: number;
  lastQueuedAt: string | null;
  lastAttemptAt: string | null;
  lastAckAt: string | null;
  lastFailureAt: string | null;
  lastFailureMessage: string | null;
  authRetryStatus: PortfolioAuthRetryStatus;
  authRetryUntil: string | null;
  lastOutcome: PortfolioCloudSyncLastOutcome | null;
  storesPortfolioContent: false;
}

export interface PortfolioCloudSyncLastOutcome {
  status: "ok" | "failed" | "deferred" | "manual_review" | "disabled";
  source: "portfolio-cloud-sync";
  at: string;
  mode: PortfolioSyncMode;
  pendingAfter: number;
  message: string | null;
}

export interface DrainPortfolioCloudSyncResult {
  status: "ok" | "failed" | "deferred" | "disabled" | "manual_review";
  attempted: number;
  synced: number;
  failed: number;
  manualReview: number;
  authDeferred: number;
  pendingAfter: number;
  message?: string;
}

function buildEmptyPortfolioCloudSyncStatus(
  mode: PortfolioSyncMode = null
): PortfolioCloudSyncStatus {
  return {
    enabled: true,
    mode,
    queueState: mode ? "synced" : "off",
    pending: 0,
    inFlight: 0,
    failed: 0,
    manualReviewCount: 0,
    failureCountTotal: 0,
    maxFailureCount: 0,
    manualReviewFailureThreshold:
      PORTFOLIO_SYNC_MANUAL_REVIEW_FAILURE_THRESHOLD,
    lastQueuedAt: null,
    lastAttemptAt: null,
    lastAckAt: null,
    lastFailureAt: null,
    lastFailureMessage: null,
    authRetryStatus: null,
    authRetryUntil: null,
    lastOutcome: null,
    storesPortfolioContent: false,
  };
}

export function getPendingPortfolioCloudSyncStatus(): PortfolioCloudSyncStatus {
  if (typeof window === "undefined") return buildEmptyPortfolioCloudSyncStatus();
  try {
    return normalizePortfolioCloudSyncStatus(
      window.localStorage.getItem(PORTFOLIO_SYNC_STATUS_STORAGE_KEY)
    );
  } catch {
    return buildEmptyPortfolioCloudSyncStatus();
  }
}

export function markPortfolioCloudSyncPending(
  mode: PortfolioSyncMode,
  reason = "local-change"
): void {
  const now = new Date().toISOString();
  const previous = getPendingPortfolioCloudSyncStatus();
  writePortfolioCloudSyncStatus({
    ...previous,
    mode,
    queueState: "pending",
    pending: 1,
    inFlight: 0,
    failed: 0,
    manualReviewCount: 0,
    lastQueuedAt: now,
    lastFailureMessage: null,
    authRetryStatus: null,
    authRetryUntil: null,
    lastOutcome: {
      status: "deferred",
      source: "portfolio-cloud-sync",
      at: now,
      mode,
      pendingAfter: 1,
      message: `组合本地变更已进入待上传队列：${reason}。`,
    },
    storesPortfolioContent: false,
  });
}

export function markPortfolioCloudSyncAttempt(mode: PortfolioSyncMode): void {
  const previous = getPendingPortfolioCloudSyncStatus();
  writePortfolioCloudSyncStatus({
    ...previous,
    mode,
    queueState: "syncing",
    pending: 1,
    inFlight: 1,
    failed: 0,
    manualReviewCount: 0,
    lastAttemptAt: new Date().toISOString(),
    authRetryStatus: null,
    authRetryUntil: null,
    storesPortfolioContent: false,
  });
}

export function markPortfolioCloudSyncAck(mode: PortfolioSyncMode): void {
  const now = new Date().toISOString();
  const next: PortfolioCloudSyncStatus = {
    ...getPendingPortfolioCloudSyncStatus(),
    mode,
    queueState: mode ? "synced" : "off",
    pending: 0,
    inFlight: 0,
    failed: 0,
    manualReviewCount: 0,
    failureCountTotal: 0,
    maxFailureCount: 0,
    lastAckAt: now,
    lastFailureAt: null,
    lastFailureMessage: null,
    authRetryStatus: null,
    authRetryUntil: null,
    lastOutcome: {
      status: "ok",
      source: "portfolio-cloud-sync",
      at: now,
      mode,
      pendingAfter: 0,
      message: "组合云同步已收到 ACK。",
    },
    storesPortfolioContent: false,
  };
  writePortfolioCloudSyncStatus(next);
}

export function markPortfolioCloudSyncFailure(
  mode: PortfolioSyncMode,
  message: string,
  options: {
    retryable?: boolean;
    authRetryStatus?: Exclude<PortfolioAuthRetryStatus, null>;
  } = {}
): void {
  const previous = getPendingPortfolioCloudSyncStatus();
  const now = new Date().toISOString();
  const authRetryStatus = options.authRetryStatus ?? null;
  const failureCount = authRetryStatus
    ? previous.failureCountTotal
    : previous.failureCountTotal + 1;
  const retryable = options.retryable ?? true;
  const manualReview =
    !authRetryStatus &&
    (!retryable ||
      failureCount >= PORTFOLIO_SYNC_MANUAL_REVIEW_FAILURE_THRESHOLD);
  const next: PortfolioCloudSyncStatus = {
    ...previous,
    mode,
    queueState: authRetryStatus
      ? "pending"
      : manualReview
        ? "manual_review"
        : "failed",
    pending: authRetryStatus ? 1 : 0,
    inFlight: 0,
    failed: authRetryStatus || manualReview ? 0 : 1,
    manualReviewCount: manualReview ? 1 : 0,
    failureCountTotal: failureCount,
    maxFailureCount: Math.max(previous.maxFailureCount, failureCount),
    lastFailureAt: now,
    lastFailureMessage: message,
    authRetryStatus,
    authRetryUntil: authRetryStatus
      ? new Date(Date.now() + PORTFOLIO_SYNC_AUTH_RETRY_BACKOFF_MS).toISOString()
      : null,
    lastOutcome: {
      status: authRetryStatus ? "deferred" : manualReview ? "manual_review" : "failed",
      source: "portfolio-cloud-sync",
      at: now,
      mode,
      pendingAfter: authRetryStatus ? 1 : 0,
      message,
    },
    storesPortfolioContent: false,
  };
  writePortfolioCloudSyncStatus(next);
}

export function markPortfolioCloudSyncOff(): void {
  const now = new Date().toISOString();
  writePortfolioCloudSyncStatus({
    ...buildEmptyPortfolioCloudSyncStatus(null),
    lastOutcome: {
      status: "disabled",
      source: "portfolio-cloud-sync",
      at: now,
      mode: null,
      pendingAfter: 0,
      message: "这台设备已关闭组合同步。",
    },
  });
}

export async function drainPendingPortfolioCloudSync(
  options: { mode?: PortfolioSyncMode } = {}
): Promise<DrainPortfolioCloudSyncResult> {
  const snapshotStatus = getPendingPortfolioCloudSyncStatus();
  const mode = options.mode ?? snapshotStatus.mode;
  if (mode !== "account" && mode !== "passcode") {
    setPortfolioCloudSyncOutcome("disabled", mode, 0, "组合同步未开启。");
    return {
      status: "disabled",
      attempted: 0,
      synced: 0,
      failed: 0,
      manualReview: 0,
      authDeferred: 0,
      pendingAfter: 0,
      message: "组合同步未开启。",
    };
  }
  if (
    snapshotStatus.manualReviewCount > 0 ||
    snapshotStatus.queueState === "manual_review"
  ) {
    return {
      status: "manual_review",
      attempted: 0,
      synced: 0,
      failed: 0,
      manualReview: 1,
      authDeferred: 0,
      pendingAfter: snapshotStatus.pending,
      message: "组合队列已进入人工处理，先确认失败原因。",
    };
  }
  markPortfolioCloudSyncAttempt(mode);
  const now = new Date().toISOString();
  saveDataUpdatedAt(now);
  const data = buildPortfolioCloudData(now);
  const result =
    mode === "account"
      ? await accountPushCloud(data)
      : await pushCloudData(loadSyncPasscode() ?? "", data);
  if (result.status === "ok") {
    const serverTags = result.data;
    if (serverTags) saveTagMap(serverTags);
    markPortfolioCloudSyncAck(mode);
    return {
      status: "ok",
      attempted: 1,
      synced: 1,
      failed: 0,
      manualReview: 0,
      authDeferred: 0,
      pendingAfter: 0,
    };
  }
  const failure = classifyPortfolioCloudSyncFailure(result);
  if (result.status === "unauthorized") clearSyncPasscode();
  markPortfolioCloudSyncFailure(mode, failure.message, {
    retryable: failure.retryable,
    authRetryStatus: failure.authRetryStatus ?? undefined,
  });
  const nextStatus = getPendingPortfolioCloudSyncStatus();
  return {
    status: failure.authRetryStatus ? "deferred" : "failed",
    attempted: 1,
    synced: 0,
    failed: failure.authRetryStatus ? 0 : 1,
    manualReview: nextStatus.manualReviewCount,
    authDeferred: failure.authRetryStatus ? 1 : 0,
    pendingAfter: nextStatus.pending,
    message: failure.message,
  };
}

export function emitPortfolioCloudSyncStatusEvent(
  detail?: PortfolioCloudSyncStatus
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<PortfolioCloudSyncStatus | undefined>(
      PORTFOLIO_SYNC_STATUS_EVENT,
      { detail }
    )
  );
  try {
    // Cross-tab hint only: this stores a timestamp/status pointer, never positions or tags.
    window.localStorage.setItem(
      PORTFOLIO_SYNC_STATUS_PING_STORAGE_KEY,
      String(Date.now())
    );
  } catch {
    // Same-tab event still refreshes status when storage is unavailable.
  }
}

function buildPortfolioCloudData(updatedAt: string): CloudPortfolioData {
  return {
    snapshot: loadSnapshot(),
    tagMap: loadTagMap(),
    allocation: loadAllocation(),
    maxNetPct: loadMaxNetPct() || DEFAULT_MAX_NET_PCT,
    lastEmailMessageId: loadLastEmailMessageId(),
    updatedAt: loadDataUpdatedAt() || updatedAt,
  };
}

function classifyPortfolioCloudSyncFailure(
  result: AccountSyncResult<unknown> | { status: "unauthorized" | "error" | "unconfigured" }
): {
  message: string;
  retryable: boolean;
  authRetryStatus: Exclude<PortfolioAuthRetryStatus, null> | null;
} {
  if (result.status === "unauthenticated") {
    return {
      message: "账号暂未确认；组合数据仍保留在本地，会稍后重试。",
      retryable: true,
      authRetryStatus: "unauthenticated",
    };
  }
  if (result.status === "unconfigured") {
    return {
      message: "组合同步云端未配置；本地组合数据已保留，配置完成后再补传。",
      retryable: true,
      authRetryStatus: "unconfigured",
    };
  }
  if (result.status === "forbidden" || result.status === "unauthorized") {
    return {
      message: "组合同步权限校验失败；本地组合数据已保留，需要人工确认。",
      retryable: false,
      authRetryStatus: null,
    };
  }
  return {
    message:
      "组合云同步暂时失败；本地组合数据已保留，会稍后继续补传。",
    retryable: true,
    authRetryStatus: null,
  };
}

function setPortfolioCloudSyncOutcome(
  status: PortfolioCloudSyncLastOutcome["status"],
  mode: PortfolioSyncMode,
  pendingAfter: number,
  message: string | null
) {
  const now = new Date().toISOString();
  const previous = getPendingPortfolioCloudSyncStatus();
  writePortfolioCloudSyncStatus({
    ...previous,
    lastOutcome: {
      status,
      source: "portfolio-cloud-sync",
      at: now,
      mode,
      pendingAfter,
      message,
    },
  });
}

function writePortfolioCloudSyncStatus(
  status: PortfolioCloudSyncStatus
): void {
  if (typeof window === "undefined") return;
  const normalized = normalizePortfolioCloudSyncStatus(status);
  try {
    window.localStorage.setItem(
      PORTFOLIO_SYNC_STATUS_STORAGE_KEY,
      JSON.stringify(normalized)
    );
  } catch {
    // The visible page badge still updates through the same-tab event.
  }
  emitPortfolioCloudSyncStatusEvent(normalized);
}

function normalizePortfolioCloudSyncStatus(
  raw: string | PortfolioCloudSyncStatus | null
): PortfolioCloudSyncStatus {
  if (!raw) return buildEmptyPortfolioCloudSyncStatus();
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return buildEmptyPortfolioCloudSyncStatus();
    }
  }
  if (!parsed || typeof parsed !== "object") {
    return buildEmptyPortfolioCloudSyncStatus();
  }
  const candidate = parsed as Partial<PortfolioCloudSyncStatus>;
  const mode = normalizeMode(candidate.mode);
  const queueState = normalizeQueueState(candidate.queueState, mode);
  const pending = safeCount(candidate.pending);
  const failed = safeCount(candidate.failed);
  const manualReviewCount = safeCount(candidate.manualReviewCount);
  const inFlight = safeCount(candidate.inFlight);
  return {
    enabled: true,
    mode,
    queueState,
    pending,
    inFlight,
    failed,
    manualReviewCount,
    failureCountTotal: safeCount(candidate.failureCountTotal),
    maxFailureCount: safeCount(candidate.maxFailureCount),
    manualReviewFailureThreshold:
      PORTFOLIO_SYNC_MANUAL_REVIEW_FAILURE_THRESHOLD,
    lastQueuedAt: normalizeNullableString(candidate.lastQueuedAt),
    lastAttemptAt: normalizeNullableString(candidate.lastAttemptAt),
    lastAckAt: normalizeNullableString(candidate.lastAckAt),
    lastFailureAt: normalizeNullableString(candidate.lastFailureAt),
    lastFailureMessage: normalizeNullableString(candidate.lastFailureMessage),
    authRetryStatus: normalizeAuthRetryStatus(candidate.authRetryStatus),
    authRetryUntil: normalizeNullableString(candidate.authRetryUntil),
    lastOutcome: normalizeLastOutcome(candidate.lastOutcome, mode),
    storesPortfolioContent: false,
  };
}

function normalizeMode(value: unknown): PortfolioSyncMode {
  return value === "account" || value === "passcode" ? value : null;
}

function normalizeQueueState(
  value: unknown,
  mode: PortfolioSyncMode
): PortfolioSyncQueueState {
  if (
    value === "pending" ||
    value === "syncing" ||
    value === "synced" ||
    value === "failed" ||
    value === "manual_review"
  ) {
    return value;
  }
  return mode ? "synced" : "off";
}

function normalizeAuthRetryStatus(value: unknown): PortfolioAuthRetryStatus {
  return value === "unauthenticated" ||
    value === "unconfigured" ||
    value === "unconfirmed"
    ? value
    : null;
}

function normalizeLastOutcome(
  value: unknown,
  mode: PortfolioSyncMode
): PortfolioCloudSyncLastOutcome | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<PortfolioCloudSyncLastOutcome>;
  const status =
    candidate.status === "ok" ||
    candidate.status === "failed" ||
    candidate.status === "deferred" ||
    candidate.status === "manual_review" ||
    candidate.status === "disabled"
      ? candidate.status
      : null;
  if (!status) return null;
  return {
    status,
    source: "portfolio-cloud-sync",
    at: normalizeNullableString(candidate.at) ?? new Date().toISOString(),
    mode: normalizeMode(candidate.mode) ?? mode,
    pendingAfter: safeCount(candidate.pendingAfter),
    message: normalizeNullableString(candidate.message),
  };
}

function normalizeNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function safeCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : 0;
}
