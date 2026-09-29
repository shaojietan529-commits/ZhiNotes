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
  loadTagMap,
  readLocalPortfolioData,
  readPortfolioLocalFingerprint,
  saveDataUpdatedAt,
  saveTagMap,
} from "@/lib/portfolio/portfolioStore";
import { clearActivePortfolioConflict, createPortfolioPushGuard, readActivePortfolioConflict } from "./portfolioSyncRevision";
import { capturePortfolioAccountContext, isPortfolioAccountContextCurrent, type PortfolioAccountContext } from "./portfolioAccountContext";
import { afterPortfolioStorageCommit, batchPortfolioStorage, getPortfolioStorageScope, isPortfolioScopeCurrent, portfolioStorage, withPortfolioStorageLock, type PortfolioStorageScope } from "./portfolioStorageScope";
import {
  finishPortfolioConflictResolution, readPortfolioConflictResolution, saveLocalPortfolioData,
  stagePortfolioConflictResolution,
  PORTFOLIO_LEGACY_REVIEWED_KEY,
  type PortfolioConflictChoice, type PortfolioConflictResolution, type PortfolioConflictReview,
} from "./portfolioConflictResolution";

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
  pendingRevision: string | null;
  attemptId: string | null;
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
  storageError?: boolean;
}

export interface PortfolioCloudSyncAttempt {
  mode: PortfolioSyncMode;
  pendingRevision: string | null;
  attemptId: string;
  localFingerprint: string;
  accountContext: PortfolioAccountContext | null;
  storageScope: PortfolioStorageScope;
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
    pendingRevision: null,
    attemptId: null,
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

export function getPendingPortfolioCloudSyncStatus(scope?: PortfolioStorageScope): PortfolioCloudSyncStatus {
  if (typeof window === "undefined") return buildEmptyPortfolioCloudSyncStatus();
  try {
    return normalizePortfolioCloudSyncStatus(
      portfolioStorage(scope).getItem(PORTFOLIO_SYNC_STATUS_STORAGE_KEY)
    );
  } catch {
    // Unknown queue state must block both uploads and clean pulls. Never write
    // this synthetic status over the raw record needed for explicit recovery.
    return { ...buildEmptyPortfolioCloudSyncStatus(), queueState: "manual_review",
      pending: 1, failed: 1, manualReviewCount: 1, storageError: true,
      lastFailureMessage: "本机同步记录无法读取；原始记录已保留，请重新核对后恢复。" };
  }
}

export function markPortfolioCloudSyncPending(
  mode: PortfolioSyncMode,
  reason = "local-change",
  scope = getPortfolioStorageScope()
): void {
  const now = new Date().toISOString();
  let previous = getPendingPortfolioCloudSyncStatus(scope);
  if (previous.storageError && reason === "conflict-resolution" && mode) {
    const staged = readPortfolioConflictResolution(mode, scope);
    if (staged?.state === "queued" && staged.review.queueSnapshot !== undefined &&
        staged.review.queueSnapshot === portfolioStorage(scope).getItem(PORTFOLIO_SYNC_STATUS_STORAGE_KEY)) {
      // Only an explicit staged review can replace unreadable queue metadata.
      // Its immutable recovery record already holds the original raw value.
      previous = buildEmptyPortfolioCloudSyncStatus(mode);
    }
  }
  const needsReview = mode && readActivePortfolioConflict(mode, scope) && reason !== "conflict-resolution";
  writePortfolioCloudSyncStatus({
    ...previous,
    mode,
    queueState: needsReview ? "manual_review" : "pending",
    pendingRevision: crypto.randomUUID(),
    attemptId: null,
    pending: 1,
    inFlight: 0,
    failed: 0,
    manualReviewCount: needsReview ? 1 : 0,
    failureCountTotal: reason === "conflict-resolution" ? 0 : previous.failureCountTotal,
    maxFailureCount: reason === "conflict-resolution" ? 0 : previous.maxFailureCount,
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
  }, scope);
}

export function commitPortfolioLocalEdit(
  mode: PortfolioSyncMode,
  edit: (current: CloudPortfolioData) => Partial<CloudPortfolioData>,
  scope = getPortfolioStorageScope()
): CloudPortfolioData {
  return batchPortfolioStorage(scope, () => {
    const current = readLocalPortfolioData(scope);
    const next = { ...current, ...edit(current), updatedAt: new Date().toISOString() };
    saveLocalPortfolioData(next, scope);
    readLocalPortfolioData(scope);
    markPortfolioCloudSyncPending(mode, "local-change", scope);
    return next;
  });
}

export function markPortfolioCloudSyncAttempt(mode: PortfolioSyncMode, scope = getPortfolioStorageScope()): PortfolioCloudSyncAttempt {
  const previous = getPendingPortfolioCloudSyncStatus(scope);
  const attempt: PortfolioCloudSyncAttempt = {
    mode,
    pendingRevision: previous.pendingRevision,
    attemptId: crypto.randomUUID(),
    localFingerprint: readPortfolioLocalFingerprint(scope),
    accountContext: mode === "account" ? capturePortfolioAccountContext() : null,
    storageScope: scope,
  };
  writePortfolioCloudSyncStatus({
    ...previous,
    mode,
    queueState: "syncing",
    attemptId: attempt.attemptId,
    pending: 1,
    inFlight: 1,
    failed: 0,
    manualReviewCount: 0,
    lastAttemptAt: new Date().toISOString(),
    authRetryStatus: null,
    authRetryUntil: null,
    storesPortfolioContent: false,
  }, scope);
  return attempt;
}

export function isPortfolioCloudSyncAttemptCurrent(attempt: PortfolioCloudSyncAttempt): boolean {
  if (!isPortfolioScopeCurrent(attempt.storageScope)) return false;
  if (attempt.accountContext && !isPortfolioAccountContextCurrent(attempt.accountContext)) return false;
  const current = getPendingPortfolioCloudSyncStatus(attempt.storageScope);
  return current.mode === attempt.mode &&
    current.pendingRevision === attempt.pendingRevision &&
    current.attemptId === attempt.attemptId;
}

export function hasUnsyncedPortfolioChanges(scope = getPortfolioStorageScope()): boolean {
  const state = getPendingPortfolioCloudSyncStatus(scope);
  return state.pending > 0 || state.inFlight > 0 || state.failed > 0 ||
    state.manualReviewCount > 0;
}

export function markPortfolioCloudSyncAck(
  mode: PortfolioSyncMode,
  attempt: PortfolioCloudSyncAttempt,
  serverTags: ReturnType<typeof loadTagMap> | null = null,
  resolution?: PortfolioConflictResolution
): boolean {
  if (mode !== attempt.mode || !isPortfolioCloudSyncAttemptCurrent(attempt)) return false;
  return batchPortfolioStorage(attempt.storageScope, () => applyPortfolioCloudSyncAck(mode, attempt, serverTags, resolution));
}

function applyPortfolioCloudSyncAck(
  mode: PortfolioSyncMode,
  attempt: PortfolioCloudSyncAttempt,
  serverTags: ReturnType<typeof loadTagMap> | null,
  resolution?: PortfolioConflictResolution
): boolean {
  if (!isPortfolioCloudSyncAttemptCurrent(attempt)) return false;
  const scope = attempt.storageScope;
  if (readPortfolioLocalFingerprint(scope) !== attempt.localFingerprint) {
    markPortfolioCloudSyncPending(mode, "local-change-during-upload", scope);
    return false;
  }
  // No await between comparing the local revision and applying this receipt.
  if (resolution && mode) {
    const stored = readPortfolioConflictResolution(mode, scope);
    if (stored?.review.id !== resolution.review.id) return false;
    saveLocalPortfolioData(resolution.data, scope);
  }
  if (serverTags) saveTagMap(serverTags, scope);
  const now = new Date().toISOString();
  const next: PortfolioCloudSyncStatus = {
    ...getPendingPortfolioCloudSyncStatus(scope),
    mode,
    queueState: mode ? "synced" : "off",
    attemptId: null,
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
  if (resolution && mode) {
    if (resolution.review.legacyFingerprint) portfolioStorage(scope).setItem(PORTFOLIO_LEGACY_REVIEWED_KEY, resolution.review.legacyFingerprint);
    finishPortfolioConflictResolution(mode, resolution.review.id, scope);
    clearActivePortfolioConflict(mode, resolution.review.version, scope);
  }
  writePortfolioCloudSyncStatus(next, scope);
  return true;
}

export async function submitPortfolioConflictResolution(
  review: PortfolioConflictReview,
  choices: Record<string, PortfolioConflictChoice>
): Promise<DrainPortfolioCloudSyncResult> {
  await withPortfolioStorageLock(review.storageScope, () => batchPortfolioStorage(review.storageScope, () => {
    if (getPendingPortfolioCloudSyncStatus(review.storageScope).inFlight > 0) throw new Error("上一笔上传仍在确认，请稍后重试。");
    stagePortfolioConflictResolution(review, choices);
    markPortfolioCloudSyncPending(review.mode, "conflict-resolution", review.storageScope);
  }));
  return drainPendingPortfolioCloudSync({ mode: review.mode, scope: review.storageScope });
}

export function markPortfolioCloudSyncFailure(
  mode: PortfolioSyncMode,
  message: string,
  options: {
    retryable?: boolean;
    authRetryStatus?: Exclude<PortfolioAuthRetryStatus, null>;
    attempt?: PortfolioCloudSyncAttempt;
    scope?: PortfolioStorageScope;
  } = {}
): void {
  if (options.attempt && !isPortfolioCloudSyncAttemptCurrent(options.attempt)) return;
  const scope = options.attempt?.storageScope ?? options.scope ?? getPortfolioStorageScope();
  const previous = getPendingPortfolioCloudSyncStatus(scope);
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
    attemptId: null,
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
  writePortfolioCloudSyncStatus(next, scope);
}

export function markPortfolioCloudSyncOff(scope = getPortfolioStorageScope()): void {
  const previous = getPendingPortfolioCloudSyncStatus(scope);
  if (previous.storageError) throw new Error("同步记录无法读取，未清除待上传状态。");
  const now = new Date().toISOString();
  writePortfolioCloudSyncStatus({
    ...previous,
    mode: null,
    queueState: "off",
    attemptId: null,
    inFlight: 0,
    lastOutcome: {
      status: "disabled",
      source: "portfolio-cloud-sync",
      at: now,
      mode: null,
      pendingAfter: previous.pending,
      message: "这台设备已关闭组合同步，未确认上传的修改仍保留。",
    },
  }, scope);
}

const portfolioDrains = new Map<string, Promise<DrainPortfolioCloudSyncResult>>();

export function drainPendingPortfolioCloudSync(
  options: { mode?: PortfolioSyncMode; scope?: PortfolioStorageScope } = {}
): Promise<DrainPortfolioCloudSyncResult> {
  const scope = options.scope ?? getPortfolioStorageScope();
  const mode = options.mode ?? getPendingPortfolioCloudSyncStatus(scope).mode;
  if (!isPortfolioScopeCurrent(scope)) return drainPortfolioCloudSync({ mode, scope });
  const key = JSON.stringify([scope, mode]);
  const existing = portfolioDrains.get(key);
  if (existing) return existing;
  const drain = drainPortfolioCloudSync({ mode, scope }).finally(() => {
    if (portfolioDrains.get(key) === drain) portfolioDrains.delete(key);
  });
  portfolioDrains.set(key, drain);
  return drain;
}

async function drainPortfolioCloudSync(
  options: { mode: PortfolioSyncMode; scope: PortfolioStorageScope }
): Promise<DrainPortfolioCloudSyncResult> {
  const scope = options.scope;
  if (!isPortfolioScopeCurrent(scope) || (options.mode === "account" && !scope.startsWith("account:")) ||
      (options.mode === "passcode" && scope !== "local")) {
    return { status: "deferred", attempted: 0, synced: 0, failed: 0, manualReview: 0, authDeferred: 1,
      pendingAfter: getPendingPortfolioCloudSyncStatus(scope).pending, message: "组合所属账号暂不可确认，未上传其他账号的本机数据。" };
  }
  const mode = options.mode ?? getPendingPortfolioCloudSyncStatus(scope).mode;
  let attempt: PortfolioCloudSyncAttempt | undefined;
  let submittedPasscode: string | null = null;
  let result: Awaited<ReturnType<typeof accountPushCloud>> | Awaited<ReturnType<typeof pushCloudData>>;
  try {
    // Take the payload, revision and attempt from the same locked snapshot.
    // Release before networking so another tab can save immediately.
    const prepared = await withPortfolioStorageLock(scope, () => {
      const status = getPendingPortfolioCloudSyncStatus(scope);
      const stop = (result: DrainPortfolioCloudSyncResult) => ({ kind: "stopped" as const, result });
      if (status.storageError || status.manualReviewCount > 0 || status.queueState === "manual_review") return stop({
        status: "manual_review", attempted: 0, synced: 0, failed: 0, manualReview: 1,
        authDeferred: 0, pendingAfter: status.pending, message: status.lastFailureMessage ?? "组合队列已进入人工处理，先确认失败原因。",
      });
      if (mode !== "account" && mode !== "passcode") {
        setPortfolioCloudSyncOutcome("disabled", mode, status.pending, "组合同步未开启。", scope);
        return stop({ status: "disabled", attempted: 0, synced: 0, failed: 0, manualReview: 0,
          authDeferred: 0, pendingAfter: status.pending, message: "组合同步未开启。" });
      }
      if (!hasUnsyncedPortfolioChanges(scope)) return stop({ status: "deferred", attempted: 0,
        synced: 0, failed: 0, manualReview: 0, authDeferred: 0, pendingAfter: 0 });
      const resolution = readPortfolioConflictResolution(mode, scope);
      if (resolution && (resolution.state !== "queued" || readPortfolioLocalFingerprint(scope) !== resolution.review.fingerprint)) {
        markPortfolioCloudSyncFailure(mode, "处理期间本机有新修改或保存被中断；原始版本仍保留，请重新读取差异。", { retryable: false, scope });
        return stop({ status: "manual_review", attempted: 0, synced: 0, failed: 0, manualReview: 1, authDeferred: 0, pendingAfter: 1 });
      }
      const data = resolution?.data ?? readLocalPortfolioData(scope);
      return batchPortfolioStorage(scope, () => {
        if (!resolution) saveDataUpdatedAt(data.updatedAt, scope);
        return { kind: "ready" as const, data, resolution, mode,
          attempt: markPortfolioCloudSyncAttempt(mode, scope), guard: createPortfolioPushGuard(mode, scope),
          passcode: loadSyncPasscode(scope) };
      });
    });
    if (prepared.kind === "stopped") return prepared.result;
    const { data, resolution, guard } = prepared;
    attempt = prepared.attempt;
    submittedPasscode = prepared.passcode;
    result = mode === "account"
      ? await accountPushCloud(data, resolution?.review.version, scope, guard)
      : await pushCloudData(submittedPasscode ?? "", data, resolution?.review.version, scope, guard);
    if (result.status === "ok") {
      const receipt = result;
      const uploadedAttempt = attempt;
      const cleared = await withPortfolioStorageLock(scope, () => markPortfolioCloudSyncAck(mode, uploadedAttempt, receipt.data, resolution ?? undefined));
      const current = getPendingPortfolioCloudSyncStatus(scope);
      return {
        status: cleared ? "ok" : "deferred",
        attempted: 1,
        synced: 1,
        failed: 0,
        manualReview: current.manualReviewCount,
        authDeferred: 0,
        pendingAfter: current.pending,
      };
    }
  } catch {
    result = { status: "error", message: "无法确认本机组合版本；本地数据仍保留，未清除待上传状态。" };
  }
  const failure = classifyPortfolioCloudSyncFailure(result);
  try {
    return await withPortfolioStorageLock(scope, () => {
      // Recheck after waiting for the lock: an edit/ACK may have won meanwhile.
      if ((attempt && !isPortfolioCloudSyncAttemptCurrent(attempt)) ||
          (mode === "passcode" && attempt && loadSyncPasscode(scope) !== submittedPasscode)) {
        const current = getPendingPortfolioCloudSyncStatus(scope);
        return { status: current.storageError ? "manual_review" : "deferred", attempted: 1, synced: 0, failed: 0,
          manualReview: current.manualReviewCount, authDeferred: 0, pendingAfter: current.pending };
      }
      if (result.status === "unauthorized") clearSyncPasscode(scope);
      markPortfolioCloudSyncFailure(mode, failure.message, {
        retryable: failure.retryable, authRetryStatus: failure.authRetryStatus ?? undefined, attempt, scope,
      });
      const nextStatus = getPendingPortfolioCloudSyncStatus(scope);
      return {
        status: failure.authRetryStatus ? "deferred" : nextStatus.manualReviewCount > 0 ? "manual_review" : "failed",
        attempted: 1, synced: 0, failed: failure.authRetryStatus ? 0 : 1, manualReview: nextStatus.manualReviewCount,
        authDeferred: failure.authRetryStatus ? 1 : 0, pendingAfter: nextStatus.pending, message: failure.message,
      };
    });
  } catch {
    const current = getPendingPortfolioCloudSyncStatus(scope);
    return { status: isPortfolioScopeCurrent(scope) ? "manual_review" : "deferred", attempted: attempt ? 1 : 0,
      synced: 0, failed: 0, manualReview: current.manualReviewCount, authDeferred: 0,
      pendingAfter: current.pending, message: "本机保存暂不可用；原始数据和待上传记录仍保留，请重试。" };
  }
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
      ("message" in result && typeof result.message === "string" ? result.message : null) ??
      "组合云同步暂时失败；本地组合数据已保留，会稍后继续补传。",
    retryable: !("retryable" in result && result.retryable === false),
    authRetryStatus: null,
  };
}

function setPortfolioCloudSyncOutcome(
  status: PortfolioCloudSyncLastOutcome["status"],
  mode: PortfolioSyncMode,
  pendingAfter: number,
  message: string | null,
  scope: PortfolioStorageScope
) {
  const now = new Date().toISOString();
  const previous = getPendingPortfolioCloudSyncStatus(scope);
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
  }, scope);
}

function writePortfolioCloudSyncStatus(
  status: PortfolioCloudSyncStatus,
  scope: PortfolioStorageScope
): void {
  if (typeof window === "undefined") return;
  if (status.storageError) throw new Error("同步记录无法读取，未覆盖原始记录。");
  const normalized = normalizePortfolioCloudSyncStatus(status);
  portfolioStorage(scope).setItem(
    PORTFOLIO_SYNC_STATUS_STORAGE_KEY,
    JSON.stringify(normalized)
  );
  afterPortfolioStorageCommit(scope, () => emitPortfolioCloudSyncStatusEvent(normalized));
}

function normalizePortfolioCloudSyncStatus(
  raw: string | PortfolioCloudSyncStatus | null
): PortfolioCloudSyncStatus {
  if (raw === null) return buildEmptyPortfolioCloudSyncStatus();
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    parsed = JSON.parse(raw);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid portfolio queue");
  }
  const candidate = parsed as Partial<PortfolioCloudSyncStatus>;
  if ((candidate.mode !== undefined && candidate.mode !== null && candidate.mode !== "account" && candidate.mode !== "passcode") ||
      (candidate.queueState !== undefined && !["off", "pending", "syncing", "synced", "failed", "manual_review"].includes(candidate.queueState)) ||
      [candidate.pending, candidate.failed, candidate.inFlight, candidate.manualReviewCount].some((value) => value !== undefined &&
        (typeof value !== "number" || !Number.isInteger(value) || value < 0)) ||
      !["queueState", "pending"].some((key) => Object.hasOwn(candidate, key))) throw new Error("Invalid portfolio queue");
  const mode = normalizeMode(candidate.mode);
  const queueState = normalizeQueueState(candidate.queueState, mode);
  const pending = Math.max(safeCount(candidate.pending), ["pending", "syncing", "failed", "manual_review"].includes(queueState) ? 1 : 0);
  const failed = safeCount(candidate.failed);
  const manualReviewCount = Math.max(safeCount(candidate.manualReviewCount), queueState === "manual_review" ? 1 : 0);
  const inFlight = safeCount(candidate.inFlight);
  return {
    enabled: true,
    mode,
    queueState,
    pendingRevision: normalizeNullableString(candidate.pendingRevision),
    attemptId: normalizeNullableString(candidate.attemptId),
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
