"use client";

import { ACCOUNT_REMOTE_CHANGE_EVENT, type RemoteChange } from "@/lib/sync/realtimeProtocol";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Sidebar from "@/components/sidebar/Sidebar";
import PortfolioConflictDialog from "./PortfolioConflictDialog";
import AiExposureInput from "./AiExposureInput";
import { ArrowRight } from "lucide-react";
import {
  buildExposures,
  positionAiExposure,
  type AiExposureMap,
  parseBookTagRows,
  parsePositionRows,
  type ExposureRow,
  type PortfolioPosition,
  type PortfolioSnapshot,
  type TagMap,
} from "@/lib/portfolio/positionReport";
import {
  bindPortfolioStore,
  readLocalPortfolioData,
  readPortfolioLocalFingerprint,
  DEFAULT_GMV_ALLOCATION,
  DEFAULT_MAX_NET_PCT,
} from "@/lib/portfolio/portfolioStore";
import {
  pullCloudData,
  type CloudPortfolioData,
} from "@/lib/portfolio/cloudSync";
import * as passcodeCloud from "@/lib/portfolio/cloudSync";
import {
  accountPullCloud,
  fetchShares,
} from "@/lib/portfolio/accountSync";
import { PORTFOLIO_CONFLICT_EVENT, type PortfolioCloudVersion } from "@/lib/portfolio/portfolioSyncRevision";
import {
  hasUnsyncedPortfolioChanges,
  markPortfolioCloudSyncFailure,
} from "@/lib/portfolio/portfolioSyncStatus";
import {
  ACCOUNT_SESSION_CHANGED_EVENT,
  ACCOUNT_SESSION_LAST_AUTHENTICATED_STORAGE_KEY,
  clearAccountSessionRuntimeCache,
  isAccountSessionStorageKey,
  fetchAccountSession,
  getLastAuthenticatedAccount,
} from "@/lib/account/clientSession";
import { ACCOUNT_PROFILE_UPDATED_EVENT, formatClientAccountLabel } from "@/lib/account/clientProfile";
import { hasUnreviewedLegacyPortfolio, readPortfolioConflictResolution } from "@/lib/portfolio/portfolioConflictResolution";
import { batchPortfolioStorage, getPortfolioStorageScope, hydratePortfolioStorage, isPortfolioScopeCurrent, isPortfolioStorageReady, subscribePortfolioStorage, readPortfolioStorageCheckpoint, withPortfolioStorageLock, type PortfolioStorageScope } from "@/lib/portfolio/portfolioStorageScope";
import * as portfolioQueue from "@/lib/portfolio/portfolioSyncStatus";
import * as portfolioRevision from "@/lib/portfolio/portfolioSyncRevision";

type BoardTab = "positions" | "analysis" | "rebalance";
type SyncStatus = "off" | "syncing" | "synced" | "error";
type SyncMode = "account" | "passcode" | null;
type NoticeTone = "info" | "warning";
type PortfolioPull = { isCurrent: () => boolean; isUnchanged: () => boolean };

function readSyncErrorMessage(result: unknown): string | null {
  if (!result || typeof result !== "object" || !("message" in result)) {
    return null;
  }
  const message = result.message;
  return typeof message === "string" && message.trim()
    ? message
    : null;
}

function markPortfolioFailureForScope(
  mode: Exclude<SyncMode, null>,
  result: { status: string },
  fallbackMessage: string,
  scope: PortfolioStorageScope
) {
  // A failed pull is not a local edit and must not create upload work.
  if (!hasUnsyncedPortfolioChanges(scope)) return;
  const message = readSyncErrorMessage(result) ?? fallbackMessage;
  if (result.status === "unconfigured") {
    markPortfolioCloudSyncFailure(mode, message, {
      authRetryStatus: "unconfigured",
      scope,
    });
    return;
  }
  if (result.status === "unauthenticated") {
    markPortfolioCloudSyncFailure(mode, message, {
      authRetryStatus: "unauthenticated",
      scope,
    });
    return;
  }
  if (result.status === "forbidden" || result.status === "unauthorized") {
    markPortfolioCloudSyncFailure(mode, message, { retryable: false, scope });
    return;
  }
  markPortfolioCloudSyncFailure(mode, message, { scope });
}

const PORTFOLIO_AUTO_PULL_MS = 15 * 1000;
const MIN_SIDE_GMV_PCT = 44;
const MAX_SIDE_GMV_PCT = 56;
const PORTFOLIO_ACTION_REQUEST_TIMEOUT_MS = 12000;

function isPortfolioSyncActive(mode: SyncMode, code: string | null) {
  return mode === "account" || (mode === "passcode" && Boolean(code));
}

function getPortfolioSyncDescription(
  mode: SyncMode,
  code: string | null,
  status: SyncStatus
) {
  if (mode === "account") {
    if (status === "syncing") {
      return "数据先保存在本机浏览器，正在同步到你的登录账号。";
    }
    if (status === "error") {
      return "数据已保存在本机浏览器，账号云同步暂时失败，会自动重试。";
    }
    return "数据先保存在本机浏览器，并自动同步到你的登录账号。";
  }
  if (mode === "passcode" && code) {
    if (status === "syncing") {
      return "数据先保存在本机浏览器，正在通过同步密码同步到云端。";
    }
    if (status === "error") {
      return "数据已保存在本机浏览器，同步密码云同步暂时失败，会自动重试。";
    }
    return "数据先保存在本机浏览器，并通过同步密码同步到云端。";
  }
  return "未开启同步时，数据只保存在本机浏览器。";
}

function getPortfolioImportNotice(
  count: number,
  mode: SyncMode,
  code: string | null
) {
  const suffix = isPortfolioSyncActive(mode, code)
    ? "已先保存在本机，后台会自动同步到云端。"
    : "当前未开启同步，仅保存在本机浏览器。";
  return `已导入 ${count} 条持仓（${suffix}）`;
}

class PortfolioActionRequestTimeoutError extends Error {
  timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`Portfolio action request timed out after ${timeoutMs}ms`);
    this.name = "PortfolioActionRequestTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

async function fetchPortfolioActionWithTimeout(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1]
): Promise<Response> {
  const controller = new AbortController();
  let didTimeout = false;
  const timeout = window.setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, PORTFOLIO_ACTION_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (didTimeout) {
      throw new PortfolioActionRequestTimeoutError(
        PORTFOLIO_ACTION_REQUEST_TIMEOUT_MS
      );
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function portfolioScopeSnapshot(): PortfolioStorageScope | "checking" {
  try { return getPortfolioStorageScope(); } catch { return "checking"; }
}

function subscribePortfolioAccount(callback: () => void) {
  let active = true;
  let confirmationNeeded = false;
  let confirmationGeneration = 0;
  const changed = () => { if (active) callback(); };
  const confirmAccount = () => {
    const generation = ++confirmationGeneration;
    confirmationNeeded = true;
    void fetchAccountSession({ force: true }).then((session) => {
      if (!active || generation !== confirmationGeneration) return;
      confirmationNeeded = session.status !== "ok" || Boolean(session.stale);
      changed();
    }).catch(changed);
  };
  const retry = () => {
    if (confirmationNeeded || portfolioScopeSnapshot() === "checking") confirmAccount();
  };
  const storage = (event: StorageEvent) => {
    if (!isAccountSessionStorageKey(event.key) && event.key !== null) return;
    changed();
    const scope = portfolioScopeSnapshot();
    if (scope === "checking" || (scope === "local" &&
        event.key === ACCOUNT_SESSION_LAST_AUTHENTICATED_STORAGE_KEY && event.newValue)) {
      // A tab-local logout marker can outlive another tab's new login.
      // Discard old probes, then confirm ownership before entering that account.
      clearAccountSessionRuntimeCache();
      confirmAccount();
    } else if (scope === "local") {
      confirmationNeeded = false;
      confirmationGeneration++;
    }
  };
  window.addEventListener("focus", retry);
  window.addEventListener("online", retry);
  window.addEventListener("storage", storage);
  window.addEventListener(ACCOUNT_SESSION_CHANGED_EVENT, changed);
  window.addEventListener(ACCOUNT_PROFILE_UPDATED_EVENT, changed);
  retry();
  return () => {
    active = false;
    window.removeEventListener("focus", retry);
    window.removeEventListener("online", retry);
    window.removeEventListener("storage", storage);
    window.removeEventListener(ACCOUNT_SESSION_CHANGED_EVENT, changed);
    window.removeEventListener(ACCOUNT_PROFILE_UPDATED_EVENT, changed);
  };
}

export default function PortfolioBoardShell() {
  const scope = useSyncExternalStore(subscribePortfolioAccount, portfolioScopeSnapshot, () => "checking" as const);
  if (scope === "checking") return <div className="flex min-h-screen"><Sidebar /><main className="flex-1 p-8">
    <p role="status">正在确认组合账号…</p>
    <button type="button" className="mt-3 text-sm underline" onClick={() => { void fetchAccountSession({ force: true }); }}>重新确认账号</button>
  </main></div>;
  return <PortfolioStorageGate key={scope} scope={scope} />;
}

function PortfolioStorageGate({ scope }: { scope: PortfolioStorageScope }) {
  const [ready, setReady] = useState(() => isPortfolioStorageReady(scope));
  const [failure, setFailure] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let current = true;
    void hydratePortfolioStorage(scope).then(() => {
      if (current) { setReady(true); setFailure(null); }
    }).catch((error) => { if (current) setFailure(error instanceof Error ? error.message : "组合本机数据暂时无法读取，原数据已保留。"); });
    return () => { current = false; };
  }, [scope, retry]);
  if (failure || !ready) return <div className="flex min-h-screen"><Sidebar /><main className="min-w-0 flex-1 p-8">
    <p role={failure ? "alert" : "status"}>{failure ?? "正在读取组合本机数据…"}</p>
    {failure && <button type="button" className="mt-3 text-sm underline" onClick={() => setRetry((n) => n + 1)}>重新读取</button>}
  </main></div>;
  return <ScopedPortfolioBoard scope={scope} />;
}

function ScopedPortfolioBoard({ scope }: { scope: PortfolioStorageScope }) {
  const store = useMemo(() => bindPortfolioStore(scope), [scope]);
  const { loadSyncPasscode, saveSyncPasscode, clearSyncPasscode } = useMemo(() => ({
    loadSyncPasscode: () => passcodeCloud.loadSyncPasscode(scope),
    saveSyncPasscode: (code: string) => passcodeCloud.saveSyncPasscode(code, scope),
    clearSyncPasscode: () => passcodeCloud.clearSyncPasscode(scope),
  }), [scope]);
  const { loadSnapshot, loadTagMap, loadAiExposureMap, loadAllocation, loadMaxNetPct, loadLastEmailMessageId, loadDataUpdatedAt,
    saveSnapshot, saveTagMap, saveAiExposureMap, saveAllocation, saveMaxNetPct, saveLastEmailMessageId, saveDataUpdatedAt } = store;
  const mountedRef = useRef(false);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  const isCurrent = useCallback(() => mountedRef.current && isPortfolioScopeCurrent(scope), [scope]);
  const { getPendingPortfolioCloudSyncStatus, hasUnsyncedPortfolioChanges, markPortfolioCloudSyncPending,
    markPortfolioCloudSyncOff, drainPendingPortfolioCloudSync, readPortfolioCloudBase, rememberPortfolioCloudBase, readActivePortfolioConflict } = useMemo(() => ({
      getPendingPortfolioCloudSyncStatus: () => portfolioQueue.getPendingPortfolioCloudSyncStatus(scope),
      hasUnsyncedPortfolioChanges: () => portfolioQueue.hasUnsyncedPortfolioChanges(scope),
      markPortfolioCloudSyncPending: (mode: SyncMode, reason?: string) => withPortfolioStorageLock(scope, () => portfolioQueue.markPortfolioCloudSyncPending(mode, reason, scope)),
      markPortfolioCloudSyncOff: () => withPortfolioStorageLock(scope, () => portfolioQueue.markPortfolioCloudSyncOff(scope)),
      drainPendingPortfolioCloudSync: (options: { mode?: SyncMode }) => portfolioQueue.drainPendingPortfolioCloudSync({ ...options, scope }),
      readPortfolioCloudBase: (mode: Exclude<SyncMode, null>) => portfolioRevision.readPortfolioCloudBase(mode, scope),
      rememberPortfolioCloudBase: (mode: Exclude<SyncMode, null>, version: PortfolioCloudVersion) => portfolioRevision.rememberPortfolioCloudBase(mode, version, scope),
      readActivePortfolioConflict: (mode: Exclude<SyncMode, null>) => portfolioRevision.readActivePortfolioConflict(mode, scope),
    }), [scope]);
  const markPortfolioFailureFromSyncResult = useCallback(async (mode: Exclude<SyncMode, null>, result: { status: string }, fallback: string) => {
    if (!isCurrent()) return;
    const checkpoint = readPortfolioStorageCheckpoint(scope);
    await withPortfolioStorageLock(scope, () => {
      if (readPortfolioStorageCheckpoint(scope) === checkpoint) markPortfolioFailureForScope(mode, result, fallback, scope);
    });
  }, [isCurrent, scope]);
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [tagMap, setTagMap] = useState<TagMap>({});
  const [aiExposureMap, setAiExposureMap] = useState<AiExposureMap>({});
  const [allocation, setAllocation] = useState<number>(DEFAULT_GMV_ALLOCATION);
  const [maxNetPct, setMaxNetPct] = useState<number>(DEFAULT_MAX_NET_PCT);
  const [tab, setTab] = useState<BoardTab>("positions");
  const [importError, setImportError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<NoticeTone>("info");
  const [tagNavigation, setTagNavigation] = useState<{ afterKey: string | null } | null>(null);
  const handledTagNavigationRef = useRef<typeof tagNavigation>(null);
  const guidedTagKeyRef = useRef<string | null>(null);
  const positionTablesRef = useRef<HTMLDivElement>(null);
  const [emailChecking, setEmailChecking] = useState(false);
  const [syncPasscode, setSyncPasscode] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("off");
  const [hasConflict, setHasConflict] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [legacyReview, setLegacyReview] = useState(false);
  const [hasLegacy, setHasLegacy] = useState(false);
  useEffect(() => {
    queueMicrotask(() => {
      if (!isCurrent()) return;
      try { setHasLegacy(hasUnreviewedLegacyPortfolio(scope)); }
      catch { setImportError("暂时无法读取旧版组合缓存；原始数据未修改。"); }
    });
  }, [scope, isCurrent]);
  // Signed-in browsers sync against the account; others use the passcode.
  const [syncMode, setSyncMode] = useState<SyncMode>(null);
  // Owners (emails) who shared their portfolio with this account.
  const [sharedWithMe, setSharedWithMe] = useState<string[]>([]);
  // Non-null while viewing someone else's shared portfolio (read-only).
  const [viewingOwner, setViewingOwner] = useState<string | null>(null);
  // Expanded exposure rows live here (not in ExposureTable) so they survive
  // switching between the 当前持仓 / 持仓分析 tabs.
  const [expandedTagRows, setExpandedTagRows] = useState<Set<string>>(
    () => new Set()
  );
  const [expandedCountryRows, setExpandedCountryRows] = useState<Set<string>>(
    () => new Set()
  );
  const posInputRef = useRef<HTMLInputElement>(null);
  const bookInputRef = useRef<HTMLInputElement>(null);
  const syncReadyRef = useRef(false);
  const lastPayloadRef = useRef<string | null>(null);
  const pushTimerRef = useRef<number | null>(null);
  const pushRetryTimerRef = useRef<number | null>(null);
  const syncModeRef = useRef<SyncMode>(null);
  const viewingOwnerRef = useRef<string | null>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const initialSyncInFlightRef = useRef(false);
  const pullSequenceRef = useRef(0);
  const [pushRetryVersion, setPushRetryVersion] = useState(0);
  const queueLocalPortfolioChange = useCallback(async (edit: (current: CloudPortfolioData) => Partial<CloudPortfolioData>) => {
    if (!isCurrent() || viewingOwnerRef.current) return null;
    try {
      const mode = syncModeRef.current;
      const next = await withPortfolioStorageLock(scope, () => {
        if (!isCurrent() || viewingOwnerRef.current || syncModeRef.current !== mode) throw new Error("组合视图已改变，未继续保存旧输入。");
        return portfolioQueue.commitPortfolioLocalEdit(mode, edit, scope);
      });
      if (!isCurrent()) return null;
      setImportError(null);
      if (mode) setSyncStatus("syncing");
      return next;
    } catch (error) {
      setImportError(`本次修改未保存，请保留输入并重试；上一份完整组合仍在本机。${error instanceof Error ? error.message : "请检查浏览器存储空间。"}`);
      return null;
    }
  }, [isCurrent, scope]);
  // Own local data, stashed while viewing a shared portfolio.
  const viewStashRef = useRef<{
    snapshot: PortfolioSnapshot | null;
    tagMap: TagMap;
    aiExposureMap: AiExposureMap;
    allocation: number;
    maxNetPct: number;
  } | null>(null);

  useEffect(() => {
    const refresh = () => {
      try {
        const status = getPendingPortfolioCloudSyncStatus();
        setHasConflict(Boolean(syncMode && (readActivePortfolioConflict(syncMode) || readPortfolioConflictResolution(syncMode, scope) ||
          status.manualReviewCount > 0)));
        if (!isCurrent() || viewingOwnerRef.current || !syncMode || status.mode !== syncMode) return;
        if (status.failed || status.manualReviewCount) setSyncStatus("error");
        else if (status.pending || status.inFlight) setSyncStatus("syncing");
        else if (status.queueState === "synced") setSyncStatus("synced");
      }
      catch { setHasConflict(true); }
    };
    const unsubscribe = subscribePortfolioStorage(scope, refresh);
    queueMicrotask(refresh);
    window.addEventListener(PORTFOLIO_CONFLICT_EVENT, refresh);
    window.addEventListener(portfolioQueue.PORTFOLIO_SYNC_STATUS_EVENT, refresh);
    return () => {
      window.removeEventListener(PORTFOLIO_CONFLICT_EVENT, refresh);
      window.removeEventListener(portfolioQueue.PORTFOLIO_SYNC_STATUS_EVENT, refresh);
      unsubscribe();
    };
  }, [syncMode, readActivePortfolioConflict, getPendingPortfolioCloudSyncStatus, isCurrent, scope]);

  useEffect(() => {
    queueMicrotask(async () => {
      if (!isCurrent()) return;
      setSnapshot(loadSnapshot());
      setTagMap(loadTagMap());
      setAiExposureMap(loadAiExposureMap());
      setAllocation(loadAllocation());
      setMaxNetPct(loadMaxNetPct());
      // Signed in → account sync takes over; otherwise legacy passcode mode.
      try {
        const session = await fetchAccountSession();
        if (!isCurrent()) return;
        if (session.authenticated) {
          syncModeRef.current = "account";
          setSyncMode("account");
          void runInitialSync(null, false);
          void fetchShares().then((shares) => {
            if (isCurrent() && shares.status === "ok") {
              setSharedWithMe(shares.data.sharedWithMe);
            }
          });
          return;
        }
      } catch {
        // offline or account system unconfigured — fall through
      }
      if (!isCurrent()) return;
      const code = loadSyncPasscode();
      if (code) {
        syncModeRef.current = "passcode";
        setSyncMode("passcode");
        setSyncPasscode(code);
        void runInitialSync(code, false);
        return;
      }
      if (!hasUnsyncedPortfolioChanges()) {
        try {
          await withPortfolioStorageLock(scope, () => {
            if (!hasUnsyncedPortfolioChanges()) portfolioQueue.markPortfolioCloudSyncOff(scope);
          });
        } catch { if (isCurrent()) setImportError("本机保存暂不可用；组合与待上传记录已保留。"); }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- cloud sync -----------------------------------------------------------
  // Cloud versions, not device timestamps, decide whether a write is safe.

  const corePayload = (
    snap: PortfolioSnapshot | null,
    tags: TagMap,
    alloc: number,
    maxNet: number,
    aiExposure: AiExposureMap
  ) =>
    JSON.stringify({
      snapshot: snap,
      tagMap: tags,
      aiExposureMap: aiExposure,
      allocation: alloc,
      maxNetPct: maxNet,
    });

  const showNotice = useCallback(
    (message: string, tone: NoticeTone = "info") => {
      if (noticeTimerRef.current !== null) {
        window.clearTimeout(noticeTimerRef.current);
      }
      setNoticeTone(tone);
      setNotice(message);
      noticeTimerRef.current = window.setTimeout(() => {
        noticeTimerRef.current = null;
        setNotice(null);
      }, 4000);
    },
    []
  );

  useEffect(
    () => () => {
      if (noticeTimerRef.current !== null) {
        window.clearTimeout(noticeTimerRef.current);
      }
      if (pushTimerRef.current !== null) {
        window.clearTimeout(pushTimerRef.current);
      }
      if (pushRetryTimerRef.current !== null) {
        window.clearTimeout(pushRetryTimerRef.current);
      }
    },
    []
  );

  const schedulePortfolioPushRetry = useCallback(() => {
    if (pushRetryTimerRef.current !== null) {
      window.clearTimeout(pushRetryTimerRef.current);
    }
    pushRetryTimerRef.current = window.setTimeout(() => {
      pushRetryTimerRef.current = null;
      if (!isCurrent() || viewingOwnerRef.current) return;
      const mode = syncModeRef.current;
      const code = syncPasscode ?? loadSyncPasscode();
      if (!isPortfolioSyncActive(mode, code) || !syncReadyRef.current) return;
      lastPayloadRef.current = null;
      setSnapshot(loadSnapshot());
      setTagMap(loadTagMap());
      setAiExposureMap(loadAiExposureMap());
      setAllocation(loadAllocation());
      setMaxNetPct(loadMaxNetPct());
      setPushRetryVersion((version) => version + 1);
    }, 5000);
  }, [syncPasscode, isCurrent, loadAllocation, loadMaxNetPct, loadSnapshot, loadSyncPasscode, loadTagMap, loadAiExposureMap]);

  const beginOwnPortfolioPull = useCallback((mode: Exclude<SyncMode, null>, code: string | null): PortfolioPull => {
    const sequence = ++pullSequenceRef.current;
    const checkpoint = readPortfolioStorageCheckpoint(scope);
    const isCurrentRequest = () => isCurrent() && !viewingOwnerRef.current && syncModeRef.current === mode &&
      pullSequenceRef.current === sequence && (mode !== "passcode" || loadSyncPasscode() === code);
    return {
      isCurrent: isCurrentRequest,
      isUnchanged: () => isCurrentRequest() && readPortfolioStorageCheckpoint(scope) === checkpoint,
    };
  }, [isCurrent, loadSyncPasscode, scope]);

  const applyCleanCloudPortfolio = useCallback(async (cloud: CloudPortfolioData, version: PortfolioCloudVersion, mode: Exclude<SyncMode, null>, pull: PortfolioPull) => {
    if (!pull.isUnchanged()) return false;
    const applied = await withPortfolioStorageLock(scope, () => batchPortfolioStorage(scope, () => {
      if (!pull.isUnchanged()) return false;
      readLocalPortfolioData(scope);
      if (hasUnsyncedPortfolioChanges()) throw new Error("本机存在待确认修改，未用云端覆盖。");
      saveSnapshot(cloud.snapshot);
      saveTagMap(cloud.tagMap);
      saveAiExposureMap(cloud.aiExposureMap ?? {});
      saveAllocation(cloud.allocation);
      saveMaxNetPct(cloud.maxNetPct ?? DEFAULT_MAX_NET_PCT);
      saveLastEmailMessageId(cloud.lastEmailMessageId ?? null);
      saveDataUpdatedAt(cloud.updatedAt);
      rememberPortfolioCloudBase(mode, version);
      return true;
    }));
    if (!applied) return false;
    if (!isCurrent()) return false;
    lastPayloadRef.current = corePayload(cloud.snapshot, cloud.tagMap, cloud.allocation, cloud.maxNetPct ?? DEFAULT_MAX_NET_PCT, cloud.aiExposureMap ?? {});
    setSnapshot(cloud.snapshot);
    setTagMap(cloud.tagMap);
    setAiExposureMap(cloud.aiExposureMap ?? {});
    setAllocation(cloud.allocation);
    setMaxNetPct(cloud.maxNetPct ?? DEFAULT_MAX_NET_PCT);
    setSyncStatus("synced");
    return true;
  }, [isCurrent, rememberPortfolioCloudBase, saveAllocation, saveDataUpdatedAt, saveLastEmailMessageId, saveMaxNetPct, saveSnapshot, saveTagMap, saveAiExposureMap, scope, hasUnsyncedPortfolioChanges]);

  const runInitialSync = useCallback(
    async function initialize(code: string | null, manual: boolean, retryStale = true) {
      if (!isCurrent() || initialSyncInFlightRef.current || viewingOwnerRef.current) return;
      initialSyncInFlightRef.current = true;
      let pull: PortfolioPull | undefined;
      let needsFreshPull = false;
      try {
        setSyncStatus("syncing");
        const accountMode = syncModeRef.current === "account";
        const activeMode: Exclude<SyncMode, null> = accountMode
          ? "account"
          : "passcode";
        pull = beginOwnPortfolioPull(activeMode, code);
        const result = accountMode
          ? await accountPullCloud()
          : await pullCloudData(code ?? "");
        if (!pull.isCurrent()) return;
        if (!pull.isUnchanged()) { needsFreshPull = true; return; }
        if (result.status === "unconfigured") {
          setSyncStatus("off");
          await markPortfolioFailureFromSyncResult(
            activeMode,
            result,
            "组合同步云端未配置；本地组合数据已保留，配置完成后再补传。"
          );
          if (manual) {
            window.alert(
              "云端存储还没有开通。请在 Vercel 项目里：Storage → Create Database → 选 Redis（Upstash）→ 连接到 zhi-notes 项目，然后 Redeploy 一次。"
            );
          }
          return;
        }
        if (result.status === "unauthenticated" || result.status === "forbidden") {
          setSyncStatus("error");
          await markPortfolioFailureFromSyncResult(
            activeMode,
            result,
            "组合同步暂时无法确认账号；本地组合数据已保留，会稍后重试。"
          );
          schedulePortfolioPushRetry();
          return;
        }
        if (result.status === "unauthorized") {
          setSyncStatus("error");
          await markPortfolioFailureFromSyncResult(
            activeMode,
            result,
            "同步密码不正确：云端已有数据，请输入当初设置的同一个密码。"
          );
          clearSyncPasscode();
          setSyncPasscode(null);
          window.alert("同步密码不正确：云端已有数据，请输入当初设置的同一个密码。");
          return;
        }
        if (result.status === "error") {
          setSyncStatus("error");
          const message = readSyncErrorMessage(result);
          await markPortfolioFailureFromSyncResult(
            activeMode,
            result,
            message ??
              "组合云同步暂时失败；本机组合数据已保留，可继续使用，稍后会自动重试。"
          );
          showNotice(
            message ??
              "组合云同步暂时失败；本机组合数据已保留，可继续使用，稍后会自动重试。",
            "warning"
          );
          return;
        }

        const cloud = result.data;
        if (viewingOwnerRef.current || syncModeRef.current !== activeMode) return;
        const version = result.version;
        if (!version) throw new Error("云端未返回组合版本；已保留本机数据。");
        const base = readPortfolioCloudBase(activeMode);
        if (base && base.scope !== version.scope) throw new Error("账号或同步空间已改变；本机组合已保留，请先确认账号。");
        const hadPending = hasUnsyncedPortfolioChanges();
        if (!manual && getPendingPortfolioCloudSyncStatus().manualReviewCount > 0) {
          syncReadyRef.current = true;
          setSyncStatus("error");
          return;
        }
        const localUpdated = loadDataUpdatedAt();
        const local = readLocalPortfolioData(scope);
        const localSnapshot = local.snapshot;
        const localTags = local.tagMap;
        const localAlloc = local.allocation;
        const localMaxNet = local.maxNetPct ?? DEFAULT_MAX_NET_PCT;

        const localPayload = corePayload(localSnapshot, localTags, localAlloc, localMaxNet, local.aiExposureMap ?? {});
        const sameContent = cloud && localPayload === corePayload(
          cloud.snapshot, cloud.tagMap, cloud.allocation, cloud.maxNetPct ?? DEFAULT_MAX_NET_PCT, cloud.aiExposureMap ?? {}
        ) && loadLastEmailMessageId() === (cloud.lastEmailMessageId ?? null);
        const localEmpty = !localUpdated && !localSnapshot && Object.keys(localTags).length === 0 &&
          Object.keys(local.aiExposureMap ?? {}).length === 0 &&
          localAlloc === DEFAULT_GMV_ALLOCATION && localMaxNet === DEFAULT_MAX_NET_PCT;
        if (!hadPending && cloud && (base || sameContent || localEmpty)) {
          if (!await applyCleanCloudPortfolio(cloud, version, activeMode, pull)) { needsFreshPull = true; return; }
          syncReadyRef.current = true;
          return;
        }
        if (!hadPending && !cloud && localEmpty) {
          const currentPull = pull;
          const applied = await withPortfolioStorageLock(scope, () => batchPortfolioStorage(scope, () => {
            if (!currentPull.isUnchanged() || hasUnsyncedPortfolioChanges()) return false;
            saveAiExposureMap({});
            rememberPortfolioCloudBase(activeMode, version);
            return true;
          }));
          if (!applied) { needsFreshPull = true; return; }
          lastPayloadRef.current = localPayload;
          syncReadyRef.current = true;
          setSyncStatus("synced");
          return;
        }
        // Pending or unbased legacy input must not adopt a pull as its baseline:
        // doing so would authorize it to overwrite edits made on another device.
        if (local.aiExposureMap === undefined) {
          const currentPull = pull;
          const initialized = await withPortfolioStorageLock(scope, () => {
            if (!currentPull.isUnchanged()) return false;
            // This browser has never edited the new field. Retain existing cloud
            // coefficients without authorizing older edits to other fields.
            saveAiExposureMap(cloud?.aiExposureMap ?? {});
            return true;
          });
          if (!initialized) { needsFreshPull = true; return; }
        }
        lastPayloadRef.current = localPayload;
        if (!hadPending) await markPortfolioCloudSyncPending(activeMode, "initial-local-data");
        const pushed = await drainPendingPortfolioCloudSync({ mode: activeMode });
        if (!isCurrent() || viewingOwnerRef.current || syncModeRef.current !== activeMode) return;
        if (pushed.status === "ok") {
          const serverTags = loadTagMap();
          lastPayloadRef.current = corePayload(loadSnapshot(), serverTags, loadAllocation(), loadMaxNetPct(), loadAiExposureMap());
          setTagMap(serverTags);
          setAiExposureMap(loadAiExposureMap());
          setSyncStatus("synced");
        } else if (pushed.status === "deferred") {
          setSyncStatus(hasUnsyncedPortfolioChanges() ? "syncing" : "synced");
          if (hasUnsyncedPortfolioChanges()) schedulePortfolioPushRetry();
        } else {
          setSyncStatus("error");
          lastPayloadRef.current = null;
          if (pushed.status !== "manual_review") schedulePortfolioPushRetry();
          const message = readSyncErrorMessage(pushed);
          showNotice(
            message ?? "组合云同步上传暂时失败；本机组合数据已保留，稍后会继续补传。",
            "warning"
          );
        }
        syncReadyRef.current = true;
      } catch (error) {
        if (!isCurrent() || (pull && !pull.isCurrent())) return;
        setSyncStatus("error");
        showNotice(error instanceof Error ? error.message : "组合版本暂时无法确认；本地数据已保留。", "warning");
      } finally {
        initialSyncInFlightRef.current = false;
        // Retry an invalidated startup read once without waiting for the polling
        // interval. Continuous edits still fall back to the normal retry cycle.
        if (needsFreshPull && retryStale && pull?.isCurrent()) void initialize(code, false, false);
      }
    },
    [applyCleanCloudPortfolio, beginOwnPortfolioPull, schedulePortfolioPushRetry, showNotice, clearSyncPasscode, drainPendingPortfolioCloudSync,
      getPendingPortfolioCloudSyncStatus, hasUnsyncedPortfolioChanges, isCurrent, loadAllocation, loadDataUpdatedAt,
      loadLastEmailMessageId, loadMaxNetPct, loadSnapshot, loadTagMap, loadAiExposureMap, saveAiExposureMap, markPortfolioCloudSyncPending,
      markPortfolioFailureFromSyncResult, readPortfolioCloudBase, rememberPortfolioCloudBase, scope]
  );

  const applyRemotePortfolio = useCallback(
    async (cloud: CloudPortfolioData | null, version: PortfolioCloudVersion | undefined, mode: Exclude<SyncMode, null>, pull: PortfolioPull) => {
      if (!pull.isUnchanged()) return;
      if (hasUnsyncedPortfolioChanges()) {
        const pending = getPendingPortfolioCloudSyncStatus();
        setSyncStatus(pending.failed || pending.manualReviewCount ? "error" : "syncing");
        return;
      }
      try {
        const base = readPortfolioCloudBase(mode);
        if (!version || !base || base.scope !== version.scope) return;
        if (!cloud) {
          if (base.revision !== null) throw new Error("云端组合暂时为空；本机数据已保留，请重试确认。");
          return;
        }
        await applyCleanCloudPortfolio(cloud, version, mode, pull);
      } catch (error) {
        setSyncStatus("error");
        showNotice(error instanceof Error ? error.message : "组合读取失败；本地数据已保留。", "warning");
      }
    },
    [applyCleanCloudPortfolio, showNotice, getPendingPortfolioCloudSyncStatus, hasUnsyncedPortfolioChanges, readPortfolioCloudBase]
  );

  const pullLatestPortfolio = useCallback(async () => {
    if (!isCurrent() || viewingOwnerRef.current || !syncReadyRef.current) return;
    const mode = syncModeRef.current;
    const code = mode === "passcode" ? loadSyncPasscode() : null;
    if (!mode || (mode === "passcode" && !code)) return;
    let pull: PortfolioPull | undefined;
    try {
      pull = beginOwnPortfolioPull(mode, code);
      const result = mode === "account" ? await accountPullCloud() : await pullCloudData(code!);
      // Check failures too: a pre-edit failure must not regress a later ACK or
      // clear a passcode that the user replaced while this request was pending.
      if (!pull.isUnchanged()) return;
      if (result.status === "ok") {
        await applyRemotePortfolio(result.data, result.version, mode, pull);
      } else if (result.status === "unauthenticated" || result.status === "forbidden") {
        setSyncStatus("error");
        await markPortfolioFailureFromSyncResult(
          mode,
          result,
          "组合同步暂时无法确认账号；本地组合数据已保留，会稍后重试。"
        );
        schedulePortfolioPushRetry();
      } else if (result.status === "unauthorized") {
        clearSyncPasscode();
        setSyncPasscode(null);
        setSyncMode(null);
        syncModeRef.current = null;
        setSyncStatus("off");
        await markPortfolioFailureFromSyncResult(mode, result, "同步密码校验失败；本地组合数据已保留，需要人工确认。");
      } else if (result.status === "error") {
        setSyncStatus("error");
        const message = readSyncErrorMessage(result);
        await markPortfolioFailureFromSyncResult(
          mode,
          result,
          message ??
            "组合云同步暂时无法拉取最新数据；当前显示的是本机缓存，稍后会自动重试。"
        );
        showNotice(
          message ??
            "组合云同步暂时无法拉取最新数据；当前显示的是本机缓存，稍后会自动重试。",
          "warning"
        );
      }
    } catch (error) {
      if (!isCurrent() || (pull && !pull.isCurrent())) return;
      setSyncStatus("error");
      showNotice(error instanceof Error ? error.message : "组合读取失败；本地数据已保留。", "warning");
    }
  }, [applyRemotePortfolio, beginOwnPortfolioPull, schedulePortfolioPushRetry, showNotice, clearSyncPasscode, isCurrent, loadSyncPasscode, markPortfolioFailureFromSyncResult]);

  useEffect(() => {
    const pullIfVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (!syncReadyRef.current && !viewingOwnerRef.current) {
        const mode = syncModeRef.current;
        if (mode === "account") {
          void runInitialSync(null, false);
          return;
        }
        const code = syncPasscode ?? loadSyncPasscode();
        if (mode === "passcode" && code) {
          void runInitialSync(code, false);
          return;
        }
      }
      void pullLatestPortfolio();
    };
    const interval = window.setInterval(pullIfVisible, PORTFOLIO_AUTO_PULL_MS);
    const onRemoteChange = (event: Event) => {
      const change = (event as CustomEvent<RemoteChange>).detail;
      if (change?.accountId === getLastAuthenticatedAccount()?.id &&
          (change.domain === "portfolio" || change.domain === "all") &&
          syncModeRef.current === "account") pullIfVisible();
    };
    window.addEventListener(ACCOUNT_REMOTE_CHANGE_EVENT, onRemoteChange);
    window.addEventListener("focus", pullIfVisible);
    window.addEventListener("online", pullIfVisible);
    document.addEventListener("visibilitychange", pullIfVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener(ACCOUNT_REMOTE_CHANGE_EVENT, onRemoteChange);
      window.removeEventListener("focus", pullIfVisible);
      window.removeEventListener("online", pullIfVisible);
      document.removeEventListener("visibilitychange", pullIfVisible);
    };
  }, [pullLatestPortfolio, runInitialSync, syncPasscode, loadSyncPasscode]);

  useEffect(() => {
    let fingerprint = readPortfolioLocalFingerprint(scope);
    const handleStorage = () => {
      if (!isCurrent() || viewingOwnerRef.current) return;
      const nextFingerprint = readPortfolioLocalFingerprint(scope);
      if (nextFingerprint === fingerprint) return;
      fingerprint = nextFingerprint;
      const nextSnapshot = loadSnapshot();
      const nextTags = loadTagMap();
      const nextAiExposure = loadAiExposureMap();
      const nextAllocation = loadAllocation();
      const nextMaxNet = loadMaxNetPct();
      setSnapshot(nextSnapshot);
      setTagMap(nextTags);
      setAiExposureMap(nextAiExposure);
      setAllocation(nextAllocation);
      setMaxNetPct(nextMaxNet);
      lastPayloadRef.current = hasUnsyncedPortfolioChanges()
        ? null
        : corePayload(nextSnapshot, nextTags, nextAllocation, nextMaxNet, nextAiExposure);
    };
    return subscribePortfolioStorage(scope, handleStorage);
  }, [hasUnsyncedPortfolioChanges, isCurrent, loadAllocation, loadMaxNetPct, loadSnapshot, loadTagMap, loadAiExposureMap, scope, store]);

  // Push local changes to the cloud (debounced) once initial sync completed.
  useEffect(() => {
    // Never push while viewing someone else's shared portfolio.
    if (!isCurrent() || viewingOwner) return;
    const active =
      syncMode === "account" || (syncMode === "passcode" && syncPasscode);
    if (!active || !syncReadyRef.current) return;
    const payload = corePayload(snapshot, tagMap, allocation, maxNetPct, aiExposureMap);
    // Durable edits already enqueue themselves; rendering remote data is not a
    // local edit and must not recreate an upload after another tab's ACK.
    if (!hasUnsyncedPortfolioChanges()) { lastPayloadRef.current = payload; return; }
    if (pushTimerRef.current) window.clearTimeout(pushTimerRef.current);
    setSyncStatus("syncing");
    pushTimerRef.current = window.setTimeout(() => {
      pushTimerRef.current = null;
      const modeAtPush = syncModeRef.current;
      if (!isCurrent() || !modeAtPush || viewingOwnerRef.current) return;
      lastPayloadRef.current = payload;
      void drainPendingPortfolioCloudSync({ mode: modeAtPush }).then((result) => {
        if (!isCurrent() || viewingOwnerRef.current || syncModeRef.current !== modeAtPush) return;
        if (result.status === "ok") {
          const serverTags = loadTagMap();
          lastPayloadRef.current = corePayload(loadSnapshot(), serverTags, loadAllocation(), loadMaxNetPct(), loadAiExposureMap());
          setTagMap(serverTags);
          setAiExposureMap(loadAiExposureMap());
          setSyncStatus("synced");
        } else if (result.status === "deferred") {
          setSyncStatus(hasUnsyncedPortfolioChanges() ? "syncing" : "synced");
          if (hasUnsyncedPortfolioChanges()) schedulePortfolioPushRetry();
        } else {
          setSyncStatus("error");
          lastPayloadRef.current = null;
          if (result.status !== "manual_review") schedulePortfolioPushRetry();
          const message = readSyncErrorMessage(result);
          showNotice(
            message ?? "组合云同步上传暂时失败；本机修改已保存，稍后会自动重试。",
            "warning"
          );
        }
      }).catch(() => {
        if (!isCurrent() || viewingOwnerRef.current || syncModeRef.current !== modeAtPush) return;
        setSyncStatus("error");
        showNotice("无法保存同步状态；待上传记录仍保留，请检查本机存储空间。", "warning");
      });
    }, 500);
    return () => {
      if (pushTimerRef.current !== null) window.clearTimeout(pushTimerRef.current);
    };
  }, [
    snapshot,
    tagMap,
    aiExposureMap,
    allocation,
    maxNetPct,
    syncPasscode,
    syncMode,
    viewingOwner,
    pushRetryVersion,
    schedulePortfolioPushRetry,
    showNotice,
    drainPendingPortfolioCloudSync, hasUnsyncedPortfolioChanges, isCurrent, loadAllocation,
    loadMaxNetPct, loadSnapshot, loadTagMap, loadAiExposureMap,
  ]);

  const handleEnableSync = useCallback(async () => {
    if (!isCurrent() || scope !== "local") return;
    const code = window.prompt(
      "设置一个云同步密码（至少 6 位）。\n所有设备输入同一个密码即可共享持仓数据。请使用专门的密码，不要复用其他账号密码。"
    );
    if (!code) return;
    const trimmed = code.trim();
    if (trimmed.length < 6) {
      window.alert("密码至少需要 6 位。");
      return;
    }
    try {
      saveSyncPasscode(trimmed);
      syncModeRef.current = "passcode";
      setSyncMode("passcode");
      setSyncPasscode(trimmed);
      await markPortfolioCloudSyncPending("passcode", "enable-passcode-sync");
      if (!isCurrent() || loadSyncPasscode() !== trimmed) return;
      await runInitialSync(trimmed, true);
    } catch {
      if (!isCurrent()) return;
      setSyncStatus("error");
      setImportError("同步设置未完成；本机组合与待上传记录已保留，请重试。");
    }
  }, [runInitialSync, isCurrent, markPortfolioCloudSyncPending, saveSyncPasscode, loadSyncPasscode, scope]);

  const handleSyncChipClick = useCallback(async () => {
    if (!isCurrent()) return;
    if (hasConflict && !viewingOwnerRef.current) {
      setLegacyReview(false);
      setConflictOpen(true);
      return;
    }
    if (syncModeRef.current === "account") {
      if (syncStatus === "error") {
        void runInitialSync(null, true);
        return;
      }
      window.alert(
        "账号云同步已开启：持仓数据自动保存到你的登录账号，任何设备登录同一账号都能看到。"
      );
      return;
    }
    if (!syncPasscode) return;
    if (syncStatus === "error") {
      void runInitialSync(syncPasscode, true);
      return;
    }
    const off = window.confirm(
      "要在这台设备上关闭云同步吗？云端数据会保留，本机数据也保留，只是不再互相同步。"
    );
    if (off) {
      clearSyncPasscode();
      setSyncPasscode(null);
      setSyncMode(null);
      syncModeRef.current = null;
      setSyncStatus("off");
      syncReadyRef.current = false;
      try { await markPortfolioCloudSyncOff(); }
      catch { if (isCurrent()) setImportError("同步设置未保存；本机组合与待上传记录已保留，请重试。"); }
    }
  }, [hasConflict, syncPasscode, syncStatus, runInitialSync, clearSyncPasscode, isCurrent, markPortfolioCloudSyncOff]);

  const handleAllocationChange = useCallback(async (value: number, expected: number) => {
    if (!isCurrent() || viewingOwnerRef.current || !Number.isFinite(value) || value <= 0) return false;
    if (!await queueLocalPortfolioChange((current) => {
      if (current.allocation !== expected && current.allocation !== value) throw new Error("资金规模已在另一处修改；请核对新值后重试。");
      return { allocation: value };
    })) return false;
    setAllocation(value);
    return true;
  }, [queueLocalPortfolioChange, isCurrent]);

  const handleMaxNetChange = useCallback(async (value: number, expected: number) => {
    if (!isCurrent() || viewingOwnerRef.current || !Number.isFinite(value) || value <= 0 || value > 100) return false;
    if (!await queueLocalPortfolioChange((current) => {
      if ((current.maxNetPct ?? DEFAULT_MAX_NET_PCT) !== expected && current.maxNetPct !== value) throw new Error("净敞口上限已在另一处修改；请核对新值后重试。");
      return { maxNetPct: value };
    })) return false;
    setMaxNetPct(value);
    return true;
  }, [queueLocalPortfolioChange, isCurrent]);

  // Switch between my own portfolio and a friend's shared one (read-only).
  // The friend's data only lives in component state — local storage keeps
  // my own data untouched the whole time.
  const handleViewOwnerChange = useCallback(
    async (owner: string) => {
      if (!isCurrent()) return;
      if (!owner) {
        const stash = viewStashRef.current;
        if (stash) {
          setSnapshot(stash.snapshot);
          setTagMap(stash.tagMap);
          setAiExposureMap(stash.aiExposureMap);
          setAllocation(stash.allocation);
          setMaxNetPct(stash.maxNetPct);
          // Restoring my own data is not a change — skip the next push.
          lastPayloadRef.current = corePayload(
            stash.snapshot,
            stash.tagMap,
            stash.allocation,
            stash.maxNetPct,
            stash.aiExposureMap
          );
        }
        viewStashRef.current = null;
        viewingOwnerRef.current = null;
        setViewingOwner(null);
        return;
      }
      const result = await accountPullCloud(owner);
      if (!isCurrent()) return;
      if (result.status !== "ok" || !result.data) {
        showNotice("无法读取对方的云端持仓（对方可能还没有同步过数据）。");
        return;
      }
      if (!viewingOwnerRef.current) {
        viewStashRef.current = { snapshot, tagMap, aiExposureMap, allocation, maxNetPct };
      }
      viewingOwnerRef.current = owner;
      setViewingOwner(owner);
      const cloud = result.data;
      setSnapshot(cloud.snapshot ?? null);
      setTagMap(cloud.tagMap ?? {});
      setAiExposureMap(cloud.aiExposureMap ?? {});
      if (cloud.allocation > 0) setAllocation(cloud.allocation);
      if (cloud.maxNetPct && cloud.maxNetPct > 0) setMaxNetPct(cloud.maxNetPct);
    },
    [snapshot, tagMap, aiExposureMap, allocation, maxNetPct, showNotice, isCurrent]
  );

  // ----- file imports --------------------------------------------------------
  // Files are parsed locally first; synced accounts/passcodes then upload only
  // the normalized portfolio snapshot in the background.

  const handleImportPositions = useCallback(
    async (file: File) => {
      if (!isCurrent() || viewingOwnerRef.current) return;
      setImportError(null);
      try {
        const XLSX = await import("xlsx");
        const buffer = await file.arrayBuffer();
        if (!isCurrent() || viewingOwnerRef.current) return;
        const workbook = XLSX.read(buffer);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
        const result = parsePositionRows(rows, file.name);
        if ("error" in result) {
          setImportError(result.error);
          return;
        }
        if (!await queueLocalPortfolioChange(() => ({ snapshot: result.snapshot }))) return;
        setSnapshot(result.snapshot);
        showNotice(
          getPortfolioImportNotice(
            result.snapshot.positions.length,
            syncModeRef.current,
            loadSyncPasscode()
          )
        );
      } catch (err) {
        console.error("[Zhinote] Failed to import position report:", err);
        setImportError("文件解析失败，请确认是 .xls / .xlsx 持仓报告。");
      }
    },
    [showNotice, queueLocalPortfolioChange, isCurrent, loadSyncPasscode]
  );

  const handleImportBookTags = useCallback(
    async (file: File) => {
      if (!isCurrent() || viewingOwnerRef.current) return;
      setImportError(null);
      try {
        const XLSX = await import("xlsx");
        const buffer = await file.arrayBuffer();
        if (!isCurrent() || viewingOwnerRef.current) return;
        const workbook = XLSX.read(buffer);
        const sheets = workbook.SheetNames.map((name) => ({
          name,
          rows: XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], {
            header: 1,
          }),
        }));
        const imported = parseBookTagRows(sheets);
        const count = Object.keys(imported).length;
        if (count === 0) {
          setImportError(
            "没有在文件里找到 Ticker → Tags 映射（需要 Tags 列）。"
          );
          return;
        }
        // Imported book tags fill gaps but never overwrite manual edits.
        const saved = await queueLocalPortfolioChange((current) => ({ tagMap: { ...imported, ...current.tagMap } }));
        if (!saved) return;
        setTagMap(saved.tagMap);
        showNotice(`已从 Book 导入 ${count} 个标签映射`);
      } catch (err) {
        console.error("[Zhinote] Failed to import book tags:", err);
        setImportError("Book 文件解析失败，请确认格式。");
      }
    },
    [showNotice, queueLocalPortfolioChange, isCurrent]
  );

  // ----- email auto-import ----------------------------------------------------
  // Asks the server to relay the newest "Roger Pos" attachment from the
  // configured mailbox; parsing and storage stay in this browser.

  const handleEmailCheck = useCallback(
    async (auto: boolean) => {
      if (!isCurrent() || viewingOwnerRef.current) return;
      if (!scope.startsWith("account:")) {
        if (!auto) setImportError("请先登录持仓邮箱所属账号。");
        return;
      }
      if (emailChecking) return;
      setEmailChecking(true);
      try {
        const res = await fetchPortfolioActionWithTimeout(
          "/api/portfolio/email-position",
          { headers: { "x-zhinote-account-id": scope.slice("account:".length) }, cache: "no-store" }
        );
        if (!isCurrent() || viewingOwnerRef.current) return;
        if (res.status === 501) {
          const data = await res.json().catch(() => null);
          if (!isCurrent()) return;
          if (data?.code === "email-owner-unconfigured") {
            if (!auto) setImportError(data.error);
            return;
          }
          if (!auto) {
            const go = window.confirm(
              "邮箱自动导入还没有授权。要打开授权设置页吗？（一次性设置，约 10 分钟）"
            );
            if (go) window.location.assign("/portfolio/email-setup");
          }
          return;
        }
        if (!res.ok) {
          if (!auto) {
            const data = await res.json().catch(() => null);
            setImportError(data?.error ?? "读取邮箱失败，请稍后重试。");
          }
          return;
        }
        const data: {
          accountId?: string;
          found?: boolean;
          messageId?: string;
          fileName?: string;
          receivedAt?: string;
          contentBase64?: string;
        } = await res.json();
        if (!isCurrent() || viewingOwnerRef.current) return;
        if (data.accountId !== scope.slice("account:".length)) {
          if (!auto) setImportError("邮箱返回的账号不一致，未导入任何内容。");
          return;
        }
        if (!data.found || !data.messageId || !data.contentBase64) {
          if (!auto) showNotice("邮箱里最近 30 天没有找到 Roger Pos 持仓邮件。");
          return;
        }
        if (data.messageId === loadLastEmailMessageId()) {
          if (!auto) {
            showNotice(`邮箱里最新的持仓（${data.fileName}）已经导入过了。`);
          }
          return;
        }

        const bytes = Uint8Array.from(atob(data.contentBase64), (c) =>
          c.charCodeAt(0)
        );
        const XLSX = await import("xlsx");
        if (!isCurrent() || viewingOwnerRef.current) return;
        const workbook = XLSX.read(bytes);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
        const result = parsePositionRows(rows, data.fileName ?? "邮件附件");
        if ("error" in result) {
          if (!auto) setImportError(`邮件附件解析失败：${result.error}`);
          return;
        }
        if (!await queueLocalPortfolioChange(() => ({ snapshot: result.snapshot, lastEmailMessageId: data.messageId }))) return;
        setSnapshot(result.snapshot);
        const synced = isPortfolioSyncActive(
          syncModeRef.current,
          loadSyncPasscode()
        );
        showNotice(
          `已从邮箱自动导入 ${data.fileName}（${result.snapshot.positions.length} 条持仓，收件 ${formatImportTime(data.receivedAt ?? "")}）。${
            synced
              ? "已先保存在本机，后台会自动同步到云端。"
              : "当前未开启同步，仅保存在本机浏览器。"
          }`
        );
      } catch (err) {
        console.error("[Zhinote] Email position check failed:", err);
        if (err instanceof PortfolioActionRequestTimeoutError) {
          if (!auto) {
            setImportError("邮箱持仓检查请求超时；本地组合数据已保留，可稍后重试。");
          }
          return;
        }
        if (!auto) setImportError("检查邮箱持仓时出错，请稍后重试。");
      } finally {
        setEmailChecking(false);
      }
    },
    [emailChecking, showNotice, queueLocalPortfolioChange, isCurrent, loadLastEmailMessageId, loadSyncPasscode, scope]
  );

  // On open, quietly look for a newer position email and import it.
  useEffect(() => {
    const timer = window.setTimeout(() => void handleEmailCheck(true), 800);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- tags ---------------------------------------------------------------

  const tagOf = useCallback(
    (position: PortfolioPosition) => tagMap[position.key] ?? "",
    [tagMap]
  );

  const knownTags = useMemo(() => {
    const set = new Set<string>();
    for (const tag of Object.values(tagMap)) if (tag) set.add(tag);
    return [...set].sort();
  }, [tagMap]);

  const handleTagChange = useCallback(async (key: string, tag: string, expected: string) => {
    if (!isCurrent() || viewingOwnerRef.current) return false;
    const saved = await queueLocalPortfolioChange((current) => {
      if ((current.tagMap[key] ?? "") !== expected && current.tagMap[key] !== tag.trim()) throw new Error("此标签已在另一处修改；请核对新值后重试。");
      const next = { ...current.tagMap };
      if (tag.trim()) next[key] = tag.trim();
      else delete next[key];
      return { tagMap: next };
    });
    if (!saved) return false;
    setTagMap(saved.tagMap);
    return true;
  }, [queueLocalPortfolioChange, isCurrent]);

  const untagged = useMemo(
    () =>
      snapshot
        ? snapshot.positions.filter((position) => !tagMap[position.key]?.trim())
        : [],
    [snapshot, tagMap]
  );

  const handleNextUntagged = useCallback(() => {
    if (!isCurrent() || viewingOwnerRef.current) return;
    setTab("positions");
    setTagNavigation({ afterKey: guidedTagKeyRef.current });
  }, [isCurrent]);

  const handleTagCommitted = useCallback((key: string) => {
    if (!isCurrent() || viewingOwnerRef.current || guidedTagKeyRef.current !== key) return;
    setTagNavigation({ afterKey: key });
  }, [isCurrent]);

  useEffect(() => {
    if (tab !== "positions" || viewingOwner) {
      guidedTagKeyRef.current = null;
      handledTagNavigationRef.current = tagNavigation;
      return;
    }
    if (!tagNavigation || handledTagNavigationRef.current === tagNavigation || !isCurrent()) return;
    handledTagNavigationRef.current = tagNavigation;
    // Read the rendered order so navigation follows both tables' current sorting.
    const editors = Array.from(positionTablesRef.current?.querySelectorAll<HTMLButtonElement | HTMLInputElement>("[data-portfolio-tag-key]") ?? []);
    const cursor = editors.findIndex((editor) => editor.dataset.portfolioTagKey === tagNavigation.afterKey);
    const ordered = [...editors.slice(cursor + 1), ...editors.slice(0, cursor + 1)];
    const next = ordered.find((editor) => !tagMap[editor.dataset.portfolioTagKey!]?.trim() && !editor.disabled);
    guidedTagKeyRef.current = next?.dataset.portfolioTagKey ?? null;
    if (next instanceof HTMLButtonElement) next.click();
    else if (next) next.focus();
    else if (editors.length > 0) showNotice("所有持仓已完成打标");
  }, [tagNavigation, tab, viewingOwner, tagMap, isCurrent, showNotice]);

  const handleAiExposureChange = useCallback(async (key: string, value: number | undefined, expected: number | undefined) => {
    if (value !== undefined && (!Number.isFinite(value) || value < -1 || value > 1)) return false;
    const saved = await queueLocalPortfolioChange((current) => {
      if (current.aiExposureMap === undefined && syncModeRef.current) {
        throw new Error("请先完成云端 AI Exposure 读取或处理同步冲突，再填写数值。");
      }
      const existing = current.aiExposureMap?.[key];
      if (existing !== expected && existing !== value) throw new Error("AI Exposure 已在另一处修改；请核对新值后重试。");
      const next: AiExposureMap = { ...current.aiExposureMap };
      if (value === undefined) delete next[key];
      else Object.defineProperty(next, key, { value, enumerable: true, writable: true, configurable: true });
      return { aiExposureMap: next };
    });
    if (!saved) return false;
    setAiExposureMap(saved.aiExposureMap ?? {});
    return true;
  }, [queueLocalPortfolioChange]);

  // ----- derived numbers ------------------------------------------------------

  const longs = useMemo(
    () =>
      snapshot
        ? snapshot.positions
            .filter((p) => p.nmv >= 0)
            .sort((a, b) => b.nmv - a.nmv)
        : [],
    [snapshot]
  );
  const shorts = useMemo(
    () =>
      snapshot
        ? snapshot.positions
            .filter((p) => p.nmv < 0)
            .sort((a, b) => a.nmv - b.nmv)
        : [],
    [snapshot]
  );

  const totalLongGmv = useMemo(
    () => longs.reduce((sum, p) => sum + p.nmv, 0),
    [longs]
  );
  const totalShortGmv = useMemo(
    () => shorts.reduce((sum, p) => sum + -p.nmv, 0),
    [shorts]
  );
  const totalNmv = totalLongGmv - totalShortGmv;
  const totalAiExposure = useMemo(() => snapshot?.positions.reduce(
    (sum, position) => sum + positionAiExposure(position, aiExposureMap), 0
  ) ?? 0, [snapshot, aiExposureMap]);

  const tagExposures = useMemo(
    () =>
      snapshot
        ? buildExposures(snapshot.positions, (p) => tagMap[p.key] || "未分类", aiExposureMap)
        : null,
    [snapshot, tagMap, aiExposureMap]
  );
  const countryExposures = useMemo(
    () =>
      snapshot ? buildExposures(snapshot.positions, (p) => p.country, aiExposureMap) : null,
    [snapshot, aiExposureMap]
  );
  const syncDescription = hasConflict ? "存在待确认的同步冲突，本机和云端版本均已保留。" : getPortfolioSyncDescription(
    syncMode,
    syncPasscode,
    syncStatus
  );

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      {conflictOpen && syncMode && !viewingOwner && <PortfolioConflictDialog mode={syncMode} scope={scope} legacy={legacyReview}
        onClose={() => setConflictOpen(false)}
        onUpdated={(result) => {
          if (!isCurrent()) return;
          setHasLegacy(hasUnreviewedLegacyPortfolio(scope));
          setSnapshot(loadSnapshot()); setTagMap(loadTagMap()); setAllocation(loadAllocation()); setMaxNetPct(loadMaxNetPct());
          setAiExposureMap(loadAiExposureMap());
          lastPayloadRef.current = corePayload(loadSnapshot(), loadTagMap(), loadAllocation(), loadMaxNetPct(), loadAiExposureMap());
          setSyncStatus(result.status === "ok" ? "synced" : "error");
        }} />}
      <main className="min-w-0 flex-1 overflow-y-auto bg-zinc-50/40 dark:bg-zinc-950">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-8">
          {hasLegacy && !viewingOwner && <div className="mb-5 flex flex-wrap items-center gap-3 border-l-2 border-amber-500 pl-3 text-sm">
            <span>旧版本机组合尚未确认归属，原始数据已保留。</span>
            <button type="button" className="underline underline-offset-4 disabled:opacity-50" disabled={syncMode !== "account"}
              onClick={() => {
                if (!isCurrent()) return;
                const owner = formatClientAccountLabel(getLastAuthenticatedAccount());
                if (!window.confirm(`确认旧版本机组合属于当前账号「${owner}」？接下来逐项核对，最终确认前不会上传或替换数据。`)) return;
                setLegacyReview(true); setConflictOpen(true);
              }}>核对旧版组合</button>
          </div>}
          {/* Header */}
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="flex items-center gap-2.5 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                <span className="text-3xl">💼</span> 组合管理
              </h1>
              <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                每日导入持仓报告，实时监控组合。{syncDescription}
              </p>
              {snapshot && (
                <p className="mt-1 text-xs text-zinc-400">
                  最近导入：{formatImportTime(snapshot.importedAt)} ·{" "}
                  {snapshot.sourceName} · {snapshot.positions.length} 条持仓
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={posInputRef}
                type="file"
                accept=".xls,.xlsx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void handleImportPositions(file);
                }}
              />
              <input
                ref={bookInputRef}
                type="file"
                accept=".xls,.xlsx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void handleImportBookTags(file);
                }}
              />
              {syncMode === "account" && sharedWithMe.length > 0 && (
                <select
                  value={viewingOwner ?? ""}
                  onChange={(e) => void handleViewOwnerChange(e.target.value)}
                  title="切换查看朋友共享给你的持仓（只读）"
                  className="rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-sm text-zinc-600 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                >
                  <option value="">我的持仓</option>
                  {sharedWithMe.map((owner) => (
                    <option key={owner} value={owner}>
                      {owner} 的持仓
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={() =>
                  syncMode === "account" || syncPasscode
                    ? handleSyncChipClick()
                    : void handleEnableSync()
                }
                title={
                  syncMode === "account"
                    ? "账号云同步已开启，数据跟随登录账号"
                    : syncPasscode
                      ? "云同步已开启，点击管理"
                      : "开启后持仓数据保存到云端，可跨设备使用"
                }
                className={`rounded-lg border px-3.5 py-2 text-sm shadow-sm transition-colors ${
                  syncStatus === "error"
                    ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
                    : syncMode === "account" || syncPasscode
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                }`}
              >
                {syncMode !== "account" && !syncPasscode
                  ? "☁️ 开启云同步"
                  : hasConflict && !viewingOwner
                    ? "处理同步冲突"
                  : syncStatus === "syncing"
                    ? "☁️ 同步中…"
                    : syncStatus === "error"
                      ? "☁️ 同步失败，点击重试"
                      : syncMode === "account"
                        ? "☁️ 账号已同步"
                        : "☁️ 已同步"}
              </button>
              {!viewingOwner && (
                <>
                  <button
                    type="button"
                    onClick={() => posInputRef.current?.click()}
                    className="rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-zinc-700 active:scale-95 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                  >
                    导入持仓报告
                  </button>
                  <button
                    type="button"
                    onClick={() => bookInputRef.current?.click()}
                    className="rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm text-zinc-600 shadow-sm transition-colors hover:border-zinc-400 hover:text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
                  >
                    导入 Book 标签
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleEmailCheck(false)}
                    disabled={emailChecking}
                    title="从 zhinote1@outlook.com 邮箱获取最新的 Roger Pos 持仓文件"
                    className="rounded-lg border border-sky-200 bg-sky-50 px-3.5 py-2 text-sm text-sky-700 shadow-sm transition-colors hover:border-sky-300 disabled:opacity-50 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300"
                  >
                    {emailChecking ? "检查邮箱中…" : "📧 检查邮箱持仓"}
                  </button>
                  <button
                    type="button"
                    onClick={handleNextUntagged}
                    disabled={untagged.length === 0}
                    title="定位下一个未打标的 Tag"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm text-zinc-600 shadow-sm transition-colors hover:border-zinc-400 disabled:cursor-default disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                  >
                    <ArrowRight size={16} aria-hidden="true" className="shrink-0" />
                    {untagged.length > 0 ? `下一个未打标（${untagged.length}）` : "打标已完成"}
                  </button>
                </>
              )}
            </div>
          </div>

          {viewingOwner && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300">
              <span>
                正在查看 {viewingOwner} 的持仓（只读），不会影响你自己的数据。
              </span>
              <button
                type="button"
                onClick={() => void handleViewOwnerChange("")}
                className="font-medium underline-offset-2 hover:underline"
              >
                返回我的持仓
              </button>
            </div>
          )}

          {importError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
              {importError}
            </div>
          )}
          {notice && (
            <div
              className={`mb-4 rounded-lg border px-4 py-2.5 text-sm ${
                noticeTone === "warning"
                  ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
              }`}
            >
              {notice}
            </div>
          )}

          {!snapshot ? (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-white py-20 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
              <div className="mb-3 text-4xl">📊</div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                还没有持仓数据。点右上角「导入持仓报告」选择每日的 Roger Pos
                文件。
              </p>
              <p className="mt-1.5 text-xs text-zinc-400">
                文件在浏览器本地解析；导入后先保存到本机，开启账号或同步密码后再后台同步。
              </p>
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <AllocationCard
                  allocation={allocation}
                  usedGmv={totalLongGmv + totalShortGmv}
                  onChange={handleAllocationChange}
                />
                <StatCard
                  label="Total Long GMV"
                  value={formatAllocPct(totalLongGmv, allocation)}
                  sub={formatMoney(totalLongGmv)}
                  tone="long"
                  limit={{
                    usedPct:
                      allocation > 0 ? (totalLongGmv / allocation) * 100 : 0,
                    minPct: MIN_SIDE_GMV_PCT,
                    maxPct: MAX_SIDE_GMV_PCT,
                  }}
                />
                <StatCard
                  label="Total Short GMV"
                  value={formatAllocPct(totalShortGmv, allocation)}
                  sub={formatMoney(totalShortGmv)}
                  tone="short"
                  limit={{
                    usedPct:
                      allocation > 0 ? (totalShortGmv / allocation) * 100 : 0,
                    minPct: MIN_SIDE_GMV_PCT,
                    maxPct: MAX_SIDE_GMV_PCT,
                  }}
                />
                <NetExposureCard
                  netPct={allocation > 0 ? (totalNmv / allocation) * 100 : 0}
                  netMoney={formatSignedMoney(totalNmv)}
                  maxNetPct={maxNetPct}
                  onMaxNetChange={handleMaxNetChange}
                />
                <StatCard
                  label="Total AI Exposure"
                  value={formatSignedAllocPct(totalAiExposure, allocation)}
                  sub={`${formatSignedMoney(totalAiExposure)} · 已填 ${snapshot.positions.filter((p) => Object.hasOwn(aiExposureMap, p.key)).length}/${snapshot.positions.length}`}
                  tone={totalAiExposure >= 0 ? "long" : "short"}
                />
              </div>

              {/* Tabs */}
              <div className="mb-4 flex items-center gap-1 border-b border-zinc-200 dark:border-zinc-800">
                <TabButton
                  active={tab === "positions"}
                  onClick={() => setTab("positions")}
                >
                  当前持仓
                </TabButton>
                <TabButton
                  active={tab === "analysis"}
                  onClick={() => setTab("analysis")}
                >
                  持仓分析
                </TabButton>
                <TabButton
                  active={tab === "rebalance"}
                  onClick={() => setTab("rebalance")}
                >
                  调仓模拟
                </TabButton>
              </div>

              {tab === "positions" ? (
                <div ref={positionTablesRef} className="space-y-8">
                  <PositionTable
                    title="Long"
                    tone="long"
                    positions={longs}
                    subtotal={totalLongGmv}
                    allocation={allocation}
                    tagOf={tagOf}
                    knownTags={knownTags}
                    onTagChange={handleTagChange}
                    onTagCommitted={handleTagCommitted}
                    aiExposureMap={aiExposureMap}
                    onAiExposureChange={handleAiExposureChange}
                    readOnly={!!viewingOwner}
                  />
                  <PositionTable
                    title="Short"
                    tone="short"
                    positions={shorts}
                    subtotal={totalShortGmv}
                    allocation={allocation}
                    tagOf={tagOf}
                    knownTags={knownTags}
                    onTagChange={handleTagChange}
                    onTagCommitted={handleTagCommitted}
                    aiExposureMap={aiExposureMap}
                    onAiExposureChange={handleAiExposureChange}
                    readOnly={!!viewingOwner}
                  />
                </div>
              ) : tab === "analysis" ? (
                <div className="space-y-8">
                  {tagExposures && (
                    <ExposureTable
                      title="按 Tag"
                      icon="🏷️"
                      exposures={tagExposures}
                      aiExposureMap={aiExposureMap}
                      allocation={allocation}
                      expanded={expandedTagRows}
                      onExpandedChange={setExpandedTagRows}
                    />
                  )}
                  {countryExposures && (
                    <ExposureTable
                      title="按 Country"
                      icon="🌏"
                      exposures={countryExposures}
                      aiExposureMap={aiExposureMap}
                      allocation={allocation}
                      expanded={expandedCountryRows}
                      onExpandedChange={setExpandedCountryRows}
                    />
                  )}
                </div>
              ) : (
                <RebalanceSimulator
                  positions={snapshot?.positions ?? []}
                  allocation={allocation}
                  tagOf={tagOf}
                />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

// ----- presentational pieces ---------------------------------------------------

function StatCard({
  label,
  value,
  sub,
  tone,
  limit,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: "long" | "short";
  // Long and Short use the same allocation band, independently of the net limit.
  limit?: { usedPct: number; minPct: number; maxPct: number };
}) {
  // Ignore floating-point noise exactly at either boundary.
  const over = limit ? limit.usedPct - limit.maxPct > 1e-9 : false;
  const under = limit ? limit.minPct - limit.usedPct > 1e-9 : false;
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-5 py-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-400">
        {label}
      </div>
      <div
        className={`mt-1 text-2xl font-bold tabular-nums ${
          tone === "long"
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-rose-600 dark:text-rose-400"
        }`}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 text-xs font-medium tabular-nums text-zinc-400">
          {sub}
        </div>
      )}
      {limit && (
        <div className="mt-1.5 space-y-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-xs tabular-nums text-zinc-400">
            <span>下限 {limit.minPct.toFixed(0)}%</span>
            <span>上限 {limit.maxPct.toFixed(0)}%</span>
          </div>
          <div
            className={`text-xs font-semibold tabular-nums ${
              over
                ? "text-rose-600 dark:text-rose-400"
                : under
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-zinc-600 dark:text-zinc-300"
            }`}
          >
            {over
              ? `超限 ${(limit.usedPct - limit.maxPct).toFixed(1)}%`
              : under
                ? `低于下限 ${(limit.minPct - limit.usedPct).toFixed(1)}%`
                : `可用 ${Math.max(0, limit.maxPct - limit.usedPct).toFixed(1)}%`}
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200/80 ring-1 ring-inset ring-zinc-300/60 dark:bg-zinc-700 dark:ring-zinc-600/60">
            <div
              className={`h-full rounded-full transition-all ${
                over ? "bg-rose-500" : under ? "bg-amber-500" : "bg-emerald-500"
              }`}
              style={{
                width: `${Math.min(
                  limit.maxPct > 0
                    ? (limit.usedPct / limit.maxPct) * 100
                    : 0,
                  100
                )}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// GMV allocation is the denominator for all % metrics. Click the number to
// edit; the value is stored locally in the browser only.
function AllocationCard({
  allocation,
  usedGmv,
  onChange,
}: {
  allocation: number;
  usedGmv: number;
  onChange: (value: number, expected: number) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const startEdit = () => {
    editBaseRef.current = allocation;
    setDraft((allocation / 1_000_000).toFixed(1));
    setEditing(true);
  };

  const editBaseRef = useRef(allocation);
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const commit = async () => {
    if (savingRef.current) return;
    savingRef.current = true; setSaving(true);
    try {
      const parsed = Number(draft.replace(/[,\s]/g, ""));
      if (Number.isFinite(parsed) && parsed > 0 && !await onChange(parsed * 1_000_000, editBaseRef.current)) return;
      setEditing(false);
    } finally { savingRef.current = false; setSaving(false); }
  };

  const usedPct = allocation > 0 ? (usedGmv / allocation) * 100 : 0;
  const overBudget = usedPct > 100;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-5 py-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-400">
        GMV Allocation
      </div>
      {editing ? (
        <div className="mt-1 flex items-baseline gap-1">
          <span className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">
            $
          </span>
          <input
            autoFocus
            inputMode="decimal"
            readOnly={saving}
            aria-busy={saving}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (savingRef.current) return;
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setEditing(false);
            }}
            className="w-20 rounded border border-zinc-300 bg-white px-1 text-2xl font-bold tabular-nums text-zinc-800 outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <span className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">
            M
          </span>
        </div>
      ) : (
        <button
          type="button"
          onClick={startEdit}
          title="点击修改 GMV allocation"
          className="mt-1 rounded text-2xl font-bold tabular-nums text-zinc-800 transition-colors hover:text-zinc-500 dark:text-zinc-100 dark:hover:text-zinc-300"
        >
          {formatMoney(allocation)}
        </button>
      )}
      {usedGmv > 0 && (
        <div className="mt-1.5 space-y-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs text-zinc-400">Used</span>
            <span
              className={`text-xs font-semibold tabular-nums ${
                overBudget
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-zinc-600 dark:text-zinc-300"
              }`}
            >
              {formatMoney(usedGmv)}
              <span className="ml-1">({usedPct.toFixed(1)}%)</span>
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200/80 ring-1 ring-inset ring-zinc-300/60 dark:bg-zinc-700 dark:ring-zinc-600/60">
            <div
              className={`h-full rounded-full transition-all ${
                overBudget
                  ? "bg-rose-500"
                  : "bg-emerald-500"
              }`}
              style={{ width: `${Math.min(usedPct, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// NMV card with an editable max net exposure (click the ±x% to change).
// This setting does not change the fixed Long/Short GMV bands.
function NetExposureCard({
  netPct,
  netMoney,
  maxNetPct,
  onMaxNetChange,
}: {
  netPct: number;
  netMoney: string;
  maxNetPct: number;
  onMaxNetChange: (value: number, expected: number) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const startEdit = () => {
    editBaseRef.current = maxNetPct;
    setDraft(maxNetPct.toFixed(0));
    setEditing(true);
  };

  const editBaseRef = useRef(maxNetPct);
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const commit = async () => {
    if (savingRef.current) return;
    savingRef.current = true; setSaving(true);
    try {
      const parsed = Number(draft.replace(/[%\s,]/g, ""));
      if (Number.isFinite(parsed) && parsed > 0 && parsed <= 100 && !await onMaxNetChange(parsed, editBaseRef.current)) return;
      setEditing(false);
    } finally { savingRef.current = false; setSaving(false); }
  };

  const usedAbs = Math.abs(netPct);
  const over = usedAbs > maxNetPct;
  const sign = netPct > 0 ? "+" : netPct < 0 ? "-" : "";

  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-5 py-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-400">
        NMV（净敞口）
      </div>
      <div
        className={`mt-1 text-2xl font-bold tabular-nums ${
          netPct >= 0
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-rose-600 dark:text-rose-400"
        }`}
      >
        {sign}
        {usedAbs.toFixed(1)}%
      </div>
      <div className="mt-0.5 text-xs font-medium tabular-nums text-zinc-400">
        {netMoney}
      </div>
      <div className="mt-1.5 space-y-1">
        <div className="flex items-baseline justify-between gap-2 text-xs tabular-nums">
          <span className="text-zinc-400">
            最大净敞口{" "}
            {editing ? (
              <span className="inline-flex items-baseline">
                ±
                <input
                  autoFocus
                  inputMode="decimal"
                  readOnly={saving}
                  aria-busy={saving}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commit}
                  onKeyDown={(e) => {
                    if (savingRef.current) return;
                    if (e.key === "Enter") commit();
                    if (e.key === "Escape") setEditing(false);
                  }}
                  className="w-8 rounded border border-zinc-300 bg-white px-0.5 text-xs tabular-nums text-zinc-800 outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                />
                %
              </span>
            ) : (
              <button
                type="button"
                onClick={startEdit}
                title="点击修改最大净敞口"
                className="rounded font-semibold text-zinc-600 underline decoration-dotted underline-offset-2 transition-colors hover:text-zinc-400 dark:text-zinc-300 dark:hover:text-zinc-400"
              >
                ±{maxNetPct.toFixed(0)}%
              </button>
            )}
          </span>
          <span
            className={`font-semibold ${
              over
                ? "text-rose-600 dark:text-rose-400"
                : "text-zinc-600 dark:text-zinc-300"
            }`}
          >
            {over
              ? `超限 ${(usedAbs - maxNetPct).toFixed(1)}%`
              : `可用 ${(maxNetPct - usedAbs).toFixed(1)}%`}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200/80 ring-1 ring-inset ring-zinc-300/60 dark:bg-zinc-700 dark:ring-zinc-600/60">
          <div
            className={`h-full rounded-full transition-all ${
              over ? "bg-rose-500" : "bg-emerald-500"
            }`}
            style={{
              width: `${Math.min(
                maxNetPct > 0 ? (usedAbs / maxNetPct) * 100 : 0,
                100
              )}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rebalance Simulator
// ---------------------------------------------------------------------------

type TradeAction = "buy" | "sell" | "sellshort" | "buytocover";

interface TradeEntry {
  id: string;
  positionKey: string; // existing position key, or "" for new
  ticker: string; // display only for new positions
  name: string; // display only for new positions
  action: TradeAction;
  amountK: number; // in $k
}

const TRADE_ACTIONS: { value: TradeAction; label: string }[] = [
  { value: "buy", label: "Buy" },
  { value: "sell", label: "Sell" },
  { value: "sellshort", label: "Sell Short" },
  { value: "buytocover", label: "Buy to Cover" },
];

function tradeNmvDelta(action: TradeAction, amountK: number): number {
  const dollars = amountK * 1000;
  switch (action) {
    case "buy":
      return dollars;
    case "sell":
      return -dollars;
    case "sellshort":
      return -dollars;
    case "buytocover":
      return dollars;
  }
}

let tradeIdCounter = 0;
function nextTradeId() {
  return `t_${++tradeIdCounter}_${Date.now()}`;
}

function RebalanceSimulator({
  positions,
  allocation,
  tagOf,
}: {
  positions: PortfolioPosition[];
  allocation: number;
  tagOf: (p: PortfolioPosition) => string;
}) {
  const [trades, setTrades] = useState<TradeEntry[]>([]);
  const [newTicker, setNewTicker] = useState("");
  const [newName, setNewName] = useState("");
  const [newAction, setNewAction] = useState<TradeAction>("buy");
  const [newAmountK, setNewAmountK] = useState("");
  const [inlineInputs, setInlineInputs] = useState<
    Record<string, { action: TradeAction; amountK: string }>
  >({});

  const positionsByKey = useMemo(() => {
    const map = new Map<string, PortfolioPosition>();
    for (const p of positions) map.set(p.key, p);
    return map;
  }, [positions]);

  // Compute post-trade snapshot
  const projected = useMemo(() => {
    // Start with copies of current positions
    const nmvMap = new Map<string, number>();
    const metaMap = new Map<
      string,
      { name: string; country: string; sector: string }
    >();
    for (const p of positions) {
      nmvMap.set(p.key, p.nmv);
      metaMap.set(p.key, {
        name: p.name,
        country: p.country,
        sector: p.sector,
      });
    }

    // Apply trades
    for (const trade of trades) {
      const key = trade.positionKey || trade.ticker.toUpperCase();
      if (!key) continue;
      const delta = tradeNmvDelta(trade.action, trade.amountK);
      nmvMap.set(key, (nmvMap.get(key) ?? 0) + delta);
      if (!metaMap.has(key)) {
        metaMap.set(key, {
          name: trade.name || key,
          country: "",
          sector: "",
        });
      }
    }

    // Remove positions that zeroed out
    for (const [key, nmv] of nmvMap) {
      if (Math.abs(nmv) < 0.5) nmvMap.delete(key);
    }

    // Build projected position list
    const projPositions: {
      key: string;
      name: string;
      nmv: number;
      prevNmv: number;
      delta: number;
      isNew: boolean;
    }[] = [];

    const allKeys = new Set([
      ...positions.map((p) => p.key),
      ...nmvMap.keys(),
    ]);
    for (const key of allKeys) {
      const prevNmv = positionsByKey.get(key)?.nmv ?? 0;
      const newNmv = nmvMap.get(key) ?? 0;
      if (Math.abs(newNmv) < 0.5 && Math.abs(prevNmv) < 0.5) continue;
      projPositions.push({
        key,
        name: metaMap.get(key)?.name ?? key,
        nmv: newNmv,
        prevNmv,
        delta: newNmv - prevNmv,
        isNew: !positionsByKey.has(key),
      });
    }

    projPositions.sort(
      (a, b) => Math.abs(b.nmv) - Math.abs(a.nmv)
    );

    const projLong = projPositions
      .filter((p) => p.nmv > 0)
      .reduce((sum, p) => sum + p.nmv, 0);
    const projShort = projPositions
      .filter((p) => p.nmv < 0)
      .reduce((sum, p) => sum + -p.nmv, 0);
    const projNet = projLong - projShort;

    const curLong = positions
      .filter((p) => p.nmv >= 0)
      .reduce((sum, p) => sum + p.nmv, 0);
    const curShort = positions
      .filter((p) => p.nmv < 0)
      .reduce((sum, p) => sum + -p.nmv, 0);
    const curNet = curLong - curShort;

    return {
      positions: projPositions,
      projLong,
      projShort,
      projNet,
      curLong,
      curShort,
      curNet,
    };
  }, [positions, trades, positionsByKey]);

  const handleClosePosition = (posKey: string) => {
    const p = positionsByKey.get(posKey);
    if (!p || !Number.isFinite(p.nmv) || p.nmv === 0) return;
    setInlineInputs((prev) => ({
      ...prev,
      [posKey]: {
        action: p.nmv > 0 ? "sell" : "buytocover",
        // Avoid binary floating-point tails when converting dollars to $k.
        amountK: String(Number((Math.abs(p.nmv) / 1000).toPrecision(15))),
      },
    }));
  };

  const handleConfirmTrade = (posKey: string) => {
    const p = positionsByKey.get(posKey);
    if (!p) return;
    const defaultAction: TradeAction =
      p.nmv >= 0 ? "sell" : "buytocover";
    const inline = inlineInputs[posKey] ?? {
      action: defaultAction,
      amountK: "",
    };
    const amountK = parseFloat(inline.amountK) || 0;
    if (amountK <= 0) return;
    setTrades((prev) => [
      ...prev.filter((t) => t.positionKey !== posKey),
      {
        id: nextTradeId(),
        positionKey: posKey,
        ticker: p.ticker,
        name: p.name,
        action: inline.action,
        amountK,
      },
    ]);
    setInlineInputs((prev) => {
      const next = { ...prev };
      delete next[posKey];
      return next;
    });
  };

  const handleCancelTrade = (posKey: string) => {
    setTrades((prev) => prev.filter((t) => t.positionKey !== posKey));
  };

  const handleAddNewPosition = () => {
    const ticker = newTicker.trim().toUpperCase();
    if (!ticker) return;
    setTrades((prev) => [
      ...prev,
      {
        id: nextTradeId(),
        positionKey: "",
        ticker,
        name: newName.trim() || ticker,
        action: newAction,
        amountK: parseFloat(newAmountK) || 0,
      },
    ]);
    setNewTicker("");
    setNewName("");
    setNewAction("buy");
    setNewAmountK("");
  };

  const updateTrade = (id: string, patch: Partial<TradeEntry>) => {
    setTrades((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch } : t))
    );
  };

  const removeTrade = (id: string) => {
    setTrades((prev) => prev.filter((t) => t.id !== id));
  };

  const activeTrades = trades.filter((t) => t.amountK > 0);

  // Per-position post-trade NMV, for the inline 调整后 columns.
  const projectedByKey = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of projected.positions) map.set(p.key, p.nmv);
    return map;
  }, [projected]);

  // ---- Export & email the confirmed rebalance instructions ----
  const [exportConfirm, setExportConfirm] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportNotice, setExportNotice] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  const localDateKey = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const downloadBase64Xlsx = (base64: string, filename: string) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const handleExportAndSend = async () => {
    if (activeTrades.length === 0) return;
    setExportBusy(true);
    setExportNotice(null);
    // Build the export payload. For existing positions, a post-trade NMV that
    // has vanished from the projection means the position was fully unwound.
    const payload = activeTrades.map((t) => {
      let unwind = false;
      if (t.positionKey) {
        const post = projectedByKey.get(t.positionKey);
        unwind = post === undefined || Math.abs(post) < 0.5;
      }
      return {
        ticker: t.positionKey || t.ticker,
        action: t.action,
        amountK: t.amountK,
        unwind,
      };
    });
    try {
      const res = await fetchPortfolioActionWithTimeout(
        "/api/portfolio/rebalance-export",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            trades: payload,
            clientDate: localDateKey(),
            send: true,
          }),
        }
      );
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        emailed?: boolean;
        emailError?: string | null;
        recipient?: string;
        filename?: string;
        tradeCount?: number;
        fileBase64?: string;
        message?: string;
        error?: string;
      };
      if (res.ok && json.ok && json.fileBase64 && json.filename) {
        downloadBase64Xlsx(json.fileBase64, json.filename);
        if (json.emailed) {
          setExportNotice({
            kind: "success",
            text: `已发送 ${json.tradeCount} 笔调仓指令到 ${json.recipient}，并下载副本`,
          });
        } else {
          setExportNotice({
            kind: "error",
            text: `文件已下载，但邮件发送失败：${json.emailError || "请检查邮箱配置后重试"}`,
          });
        }
      } else {
        const msg =
          res.status === 401
            ? "请先登录账号再导出"
            : res.status === 501
              ? "邮箱服务未配置，无法发送"
              : json.message || json.error || "导出失败";
        setExportNotice({ kind: "error", text: msg });
      }
    } catch {
      setExportNotice({ kind: "error", text: "网络错误，导出失败" });
    } finally {
      setExportBusy(false);
      setExportConfirm(false);
    }
  };

  // Totals for the footer (gross + net, current vs post-trade).
  const curGross = projected.curLong + projected.curShort;
  const projGross = projected.projLong + projected.projShort;

  return (
    <div className="space-y-6">
      {/* ---- Current positions with trade inputs ---- */}
      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="text-base">📊</span>
            <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              调仓输入
            </h2>
            {activeTrades.length > 0 && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                {activeTrades.length} 笔交易
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {activeTrades.length > 0 && !exportConfirm && (
              <button
                type="button"
                onClick={() => {
                  setExportNotice(null);
                  setExportConfirm(true);
                }}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
              >
                📤 导出并发送调仓指令
              </button>
            )}
            {exportConfirm && (
              <div className="flex items-center gap-2 rounded-md bg-emerald-50 px-2.5 py-1.5 dark:bg-emerald-950/30">
                <span className="text-xs text-emerald-800 dark:text-emerald-300">
                  发送 {activeTrades.length} 笔到 Rtan@keystone-investors.com？
                </span>
                <button
                  type="button"
                  onClick={handleExportAndSend}
                  disabled={exportBusy}
                  className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {exportBusy ? "发送中…" : "确认发送"}
                </button>
                <button
                  type="button"
                  onClick={() => setExportConfirm(false)}
                  disabled={exportBusy}
                  className="rounded px-2 py-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                >
                  取消
                </button>
              </div>
            )}
            {trades.length > 0 && (
              <button
                type="button"
                onClick={() => setTrades([])}
                className="text-xs text-zinc-400 hover:text-rose-500"
              >
                清空全部
              </button>
            )}
          </div>
        </div>

        {exportNotice && (
          <div
            className={`border-b px-4 py-2 text-xs ${
              exportNotice.kind === "success"
                ? "border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
                : "border-rose-100 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300"
            }`}
          >
            {exportNotice.kind === "success" ? "✓ " : "✗ "}
            {exportNotice.text}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left text-[11px] uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
                <th className="px-4 py-2">Ticker</th>
                <th className="px-3 py-2">名称</th>
                <th className="px-3 py-2">Tag</th>
                <th className="px-3 py-2 text-right">当前仓位</th>
                <th className="px-3 py-2 text-right">% Alloc</th>
                <th className="px-3 py-2 text-center">操作</th>
                <th className="px-3 py-2 text-right">金额 ($k)</th>
                <th className="px-3 py-2 text-right">调整后</th>
                <th className="px-3 py-2 text-right">调整后 %</th>
                <th className="w-14 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => {
                const confirmedTrade = trades.find(
                  (t) => t.positionKey === p.key
                );
                const defaultAction: TradeAction =
                  p.nmv >= 0 ? "sell" : "buytocover";
                const inline = inlineInputs[p.key] ?? {
                  action: defaultAction,
                  amountK: "",
                };
                const postNmv =
                  projectedByKey.get(p.key) ?? p.nmv;
                const changed =
                  Math.abs(postNmv - p.nmv) > 0.5;
                const closed =
                  Math.abs(postNmv) < 0.5 && changed;

                return (
                  <tr
                    key={p.key}
                    className={`border-b border-zinc-50 hover:bg-zinc-50/80 dark:border-zinc-800/50 dark:hover:bg-zinc-800/40 ${
                      confirmedTrade
                        ? "bg-blue-50/30 dark:bg-blue-950/20"
                        : ""
                    }`}
                  >
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                      {p.key}
                    </td>
                    <td className="max-w-40 truncate px-3 py-2 text-zinc-800 dark:text-zinc-100">
                      {p.name}
                    </td>
                    <td className="px-3 py-2 text-xs text-zinc-500">
                      {tagOf(p)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-300">
                      {formatSignedMoney(p.nmv)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-300">
                      {formatAllocPct(Math.abs(p.nmv), allocation)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {confirmedTrade ? (
                        <span className="inline-block rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                          {TRADE_ACTIONS.find(
                            (a) =>
                              a.value === confirmedTrade.action
                          )?.label ?? confirmedTrade.action}
                        </span>
                      ) : (
                        <select
                          aria-label={`${p.key} 交易方向`}
                          value={inline.action}
                          onChange={(e) => {
                            const cur =
                              inlineInputs[p.key] ?? {
                                action: defaultAction,
                                amountK: "",
                              };
                            setInlineInputs((prev) => ({
                              ...prev,
                              [p.key]: {
                                ...cur,
                                action:
                                  e.target
                                    .value as TradeAction,
                              },
                            }));
                          }}
                          className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800"
                        >
                          {TRADE_ACTIONS.map((a) => (
                            <option
                              key={a.value}
                              value={a.value}
                            >
                              {a.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {confirmedTrade ? (
                        <span className="text-xs font-medium tabular-nums text-zinc-700 dark:text-zinc-200">
                          {confirmedTrade.amountK.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                        </span>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <input
                            type="number"
                            aria-label={`${p.key} 交易金额 ($k)`}
                            min="0"
                            step="any"
                            value={inline.amountK}
                            onChange={(e) => {
                              const cur =
                                inlineInputs[p.key] ?? {
                                  action: defaultAction,
                                  amountK: "",
                                };
                              setInlineInputs((prev) => ({
                                ...prev,
                                [p.key]: {
                                  ...cur,
                                  amountK: e.target.value,
                                },
                              }));
                            }}
                            placeholder="0"
                            className="w-32 shrink-0 rounded border border-zinc-200 bg-white px-2 py-1 text-right text-xs tabular-nums dark:border-zinc-700 dark:bg-zinc-800"
                          />
                          <button
                            type="button"
                            aria-label={`${p.key} 清仓`}
                            title="按当前全部仓位填入平仓金额"
                            onClick={() => handleClosePosition(p.key)}
                            disabled={!Number.isFinite(p.nmv) || p.nmv === 0}
                            className="h-7 w-12 shrink-0 whitespace-nowrap rounded border border-zinc-200 text-xs text-zinc-600 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-30 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                          >
                            清仓
                          </button>
                        </div>
                      )}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-medium tabular-nums ${
                        changed
                          ? "text-zinc-900 dark:text-zinc-50"
                          : "text-zinc-400 dark:text-zinc-500"
                      }`}
                    >
                      {closed
                        ? "已清仓"
                        : changed
                          ? formatSignedMoney(postNmv)
                          : "—"}
                    </td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums ${
                        changed
                          ? "text-zinc-700 dark:text-zinc-200"
                          : "text-zinc-400 dark:text-zinc-500"
                      }`}
                    >
                      {closed
                        ? "—"
                        : changed
                          ? formatAllocPct(
                              Math.abs(postNmv),
                              allocation
                            )
                          : "—"}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {confirmedTrade ? (
                        <button
                          type="button"
                          onClick={() =>
                            handleCancelTrade(p.key)
                          }
                          className="whitespace-nowrap rounded px-1.5 py-0.5 text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30"
                          title="取消调仓"
                        >
                          取消
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            handleConfirmTrade(p.key)
                          }
                          disabled={
                            !inline.amountK ||
                            parseFloat(inline.amountK) <=
                              0
                          }
                          className="whitespace-nowrap rounded px-1.5 py-0.5 text-xs text-blue-600 hover:bg-blue-50 disabled:opacity-30 dark:text-blue-400 dark:hover:bg-blue-900/30"
                          title="确认调仓"
                        >
                          确认
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-zinc-200 bg-zinc-50/80 font-semibold dark:border-zinc-700 dark:bg-zinc-800/40">
                <td className="px-4 py-2.5 text-zinc-700 dark:text-zinc-200">
                  总仓位 (Gross)
                </td>
                <td colSpan={2} />
                <td className="px-3 py-2.5 text-right tabular-nums text-zinc-700 dark:text-zinc-200">
                  {formatMoney(curGross)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-zinc-700 dark:text-zinc-200">
                  {formatAllocPct(curGross, allocation)}
                </td>
                <td colSpan={2} />
                <td
                  className={`px-3 py-2.5 text-right tabular-nums ${
                    Math.abs(projGross - curGross) > 0.5
                      ? "text-zinc-900 dark:text-zinc-50"
                      : "text-zinc-400 dark:text-zinc-500"
                  }`}
                >
                  {formatMoney(projGross)}
                </td>
                <td
                  className={`px-3 py-2.5 text-right tabular-nums ${
                    Math.abs(projGross - curGross) > 0.5
                      ? "text-zinc-700 dark:text-zinc-200"
                      : "text-zinc-400 dark:text-zinc-500"
                  }`}
                >
                  {formatAllocPct(projGross, allocation)}
                </td>
                <td />
              </tr>
              <tr className="bg-zinc-50/80 text-xs dark:bg-zinc-800/40">
                <td className="px-4 py-2 text-zinc-500 dark:text-zinc-400">
                  净仓位 (Net)
                </td>
                <td colSpan={2} />
                <td className="px-3 py-2 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                  {formatSignedMoney(projected.curNet)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                  {formatSignedAllocPct(projected.curNet, allocation)}
                </td>
                <td colSpan={2} />
                <td
                  className={`px-3 py-2 text-right tabular-nums ${
                    Math.abs(projected.projNet - projected.curNet) > 0.5
                      ? "text-zinc-700 dark:text-zinc-200"
                      : "text-zinc-400 dark:text-zinc-500"
                  }`}
                >
                  {formatSignedMoney(projected.projNet)}
                </td>
                <td
                  className={`px-3 py-2 text-right tabular-nums ${
                    Math.abs(projected.projNet - projected.curNet) > 0.5
                      ? "text-zinc-700 dark:text-zinc-200"
                      : "text-zinc-400 dark:text-zinc-500"
                  }`}
                >
                  {formatSignedAllocPct(projected.projNet, allocation)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        {/* New position input */}
        <div className="border-t border-zinc-200 bg-zinc-50/60 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
          <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            新仓位
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={newTicker}
              onChange={(e) => setNewTicker(e.target.value)}
              placeholder="Ticker (如 AAPL US)"
              className="w-36 rounded border border-zinc-200 bg-white px-2.5 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-800"
            />
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="公司名（选填）"
              className="w-32 rounded border border-zinc-200 bg-white px-2.5 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-800"
            />
            <select
              value={newAction}
              onChange={(e) =>
                setNewAction(e.target.value as TradeAction)
              }
              className="rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-800"
            >
              {TRADE_ACTIONS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={newAmountK}
                onChange={(e) => setNewAmountK(e.target.value)}
                placeholder="$k"
                className="w-20 rounded border border-zinc-200 bg-white px-2.5 py-1.5 text-right text-xs tabular-nums dark:border-zinc-700 dark:bg-zinc-800"
              />
              <span className="text-[10px] text-zinc-400">$k</span>
            </div>
            <button
              type="button"
              onClick={handleAddNewPosition}
              disabled={!newTicker.trim()}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              添加
            </button>
          </div>
          {/* Show new-position trades */}
          {trades.filter((t) => !t.positionKey).length > 0 && (
            <div className="mt-3 space-y-1.5">
              {trades
                .filter((t) => !t.positionKey)
                .map((trade) => (
                  <div
                    key={trade.id}
                    className="flex items-center gap-3 rounded-lg bg-white px-3 py-2 text-xs dark:bg-zinc-800"
                  >
                    <span className="font-mono font-medium text-zinc-700 dark:text-zinc-200">
                      {trade.ticker}
                    </span>
                    <span className="text-zinc-500">{trade.name}</span>
                    <select
                      value={trade.action}
                      onChange={(e) =>
                        updateTrade(trade.id, {
                          action: e.target.value as TradeAction,
                        })
                      }
                      className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      {TRADE_ACTIONS.map((a) => (
                        <option key={a.value} value={a.value}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={trade.amountK || ""}
                        onChange={(e) =>
                          updateTrade(trade.id, {
                            amountK: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-20 rounded border border-zinc-200 bg-white px-2 py-1 text-right tabular-nums dark:border-zinc-700 dark:bg-zinc-900"
                      />
                      <span className="text-zinc-400">$k</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeTrade(trade.id)}
                      className="ml-auto text-zinc-400 hover:text-rose-500"
                    >
                      ✕
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>
      </section>

      {/* ---- Post-trade summary comparison ---- */}
      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            <span>📈</span> 仓位对比
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-px bg-zinc-100 sm:grid-cols-4 dark:bg-zinc-800">
          <CompareCell
            label="Long GMV"
            before={projected.curLong}
            after={projected.projLong}
            allocation={allocation}
          />
          <CompareCell
            label="Short GMV"
            before={projected.curShort}
            after={projected.projShort}
            allocation={allocation}
          />
          <CompareCell
            label="Net Exposure"
            before={projected.curNet}
            after={projected.projNet}
            allocation={allocation}
            signed
          />
          <CompareCell
            label="Gross Exposure"
            before={projected.curLong + projected.curShort}
            after={projected.projLong + projected.projShort}
            allocation={allocation}
          />
        </div>
      </section>

      {/* ---- Projected position list ---- */}
      {activeTrades.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              <span>📋</span> 调仓后持仓明细
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left text-[11px] uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
                  <th className="px-4 py-2">Ticker</th>
                  <th className="px-3 py-2">名称</th>
                  <th className="px-3 py-2 text-right">调仓前</th>
                  <th className="px-3 py-2 text-right">变动</th>
                  <th className="px-3 py-2 text-right">调仓后</th>
                  <th className="px-3 py-2 text-right">% Alloc</th>
                </tr>
              </thead>
              <tbody>
                {projected.positions
                  .filter((p) => Math.abs(p.delta) > 0.5 || p.isNew)
                  .map((p) => (
                    <tr
                      key={p.key}
                      className={`border-b border-zinc-50 last:border-0 dark:border-zinc-800/50 ${
                        p.isNew
                          ? "bg-emerald-50/40 dark:bg-emerald-950/20"
                          : Math.abs(p.nmv) < 0.5
                            ? "bg-rose-50/40 dark:bg-rose-950/20"
                            : ""
                      }`}
                    >
                      <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                        {p.key}
                        {p.isNew && (
                          <span className="ml-1.5 rounded bg-emerald-100 px-1 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                            新
                          </span>
                        )}
                      </td>
                      <td className="max-w-40 truncate px-3 py-2 text-zinc-800 dark:text-zinc-100">
                        {p.name}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                        {Math.abs(p.prevNmv) > 0.5
                          ? formatSignedMoney(p.prevNmv)
                          : "—"}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-medium tabular-nums ${pnlColor(p.delta)}`}
                      >
                        {formatSignedMoney(p.delta)}
                      </td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums text-zinc-800 dark:text-zinc-100">
                        {Math.abs(p.nmv) > 0.5
                          ? formatSignedMoney(p.nmv)
                          : "已清仓"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-300">
                        {Math.abs(p.nmv) > 0.5
                          ? formatAllocPct(Math.abs(p.nmv), allocation)
                          : "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function CompareCell({
  label,
  before,
  after,
  allocation,
  signed,
}: {
  label: string;
  before: number;
  after: number;
  allocation: number;
  signed?: boolean;
}) {
  const delta = after - before;
  const hasDelta = Math.abs(delta) > 0.5;
  const fmt = signed ? formatSignedAllocPct : formatAllocPct;
  const fmtMoney = signed ? formatSignedMoney : formatMoney;
  return (
    <div className="bg-white p-4 dark:bg-zinc-900">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold tabular-nums text-zinc-800 dark:text-zinc-100">
        {signed
          ? formatSignedAllocPct(after, allocation)
          : formatAllocPct(after, allocation)}
      </p>
      <p className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
        {fmtMoney(signed ? after : Math.abs(after))}
      </p>
      {hasDelta && (
        <p
          className={`mt-1 text-xs font-medium tabular-nums ${pnlColor(delta)}`}
        >
          {formatSignedMoney(delta)} ({fmt(Math.abs(delta), allocation)})
        </p>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
          : "border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
      }`}
    >
      {children}
    </button>
  );
}

// Column sort accessors. Numbers sort numerically; strings sort with
// localeCompare. First header click sorts high→low, second low→high.
const POSITION_SORT_ACCESSORS = {
  ticker: (p: PortfolioPosition) => p.key,
  name: (p: PortfolioPosition) => p.name,
  size: (p: PortfolioPosition) => Math.abs(p.nmv),
  pnlDaily: (p: PortfolioPosition) => p.pnlDaily,
  pnlMtd: (p: PortfolioPosition) => p.pnlMtd,
  pnlYtd: (p: PortfolioPosition) => p.pnlYtd,
  pnlItd: (p: PortfolioPosition) => p.pnlItd,
  change1d: (p: PortfolioPosition) => p.priceChange1dPct,
  country: (p: PortfolioPosition) => p.country,
} as const;

type PositionSortKey = keyof typeof POSITION_SORT_ACCESSORS | "tag" | "aiExposure";

function PositionTable({
  title,
  tone,
  positions,
  subtotal,
  allocation,
  tagOf,
  knownTags,
  onTagChange,
  onTagCommitted,
  aiExposureMap,
  onAiExposureChange,
  readOnly,
}: {
  title: string;
  tone: "long" | "short";
  positions: PortfolioPosition[];
  subtotal: number;
  allocation: number;
  tagOf: (position: PortfolioPosition) => string;
  knownTags: string[];
  onTagChange: (key: string, tag: string, expected: string) => Promise<boolean>;
  onTagCommitted: (key: string) => void;
  aiExposureMap: AiExposureMap;
  onAiExposureChange: (key: string, value: number | undefined, expected: number | undefined) => Promise<boolean>;
  readOnly: boolean;
}) {
  const toneBar = tone === "long" ? "bg-emerald-500" : "bg-rose-500";
  const toneText =
    tone === "long"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-rose-600 dark:text-rose-400";

  const [sortKey, setSortKey] = useState<PositionSortKey | null>(null);
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const handleSort = (key: PositionSortKey) => {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sorted = useMemo(() => {
    if (!sortKey) return positions;
    const accessor =
      sortKey === "tag"
        ? tagOf
        : sortKey === "aiExposure" ? (position: PortfolioPosition) => aiExposureMap[position.key] ?? 0
        : POSITION_SORT_ACCESSORS[sortKey];
    const flip = sortDir === "desc" ? -1 : 1;
    return [...positions].sort((a, b) => {
      const va = accessor(a);
      const vb = accessor(b);
      const cmp =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb));
      return cmp * flip;
    });
  }, [positions, sortKey, sortDir, tagOf, aiExposureMap]);

  return (
    <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${toneBar}`} />
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            {title}
          </h2>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            {positions.length} 只
          </span>
        </div>
        <div className={`text-sm font-bold tabular-nums ${toneText}`}>
          Total {title} GMV：{formatAllocPct(subtotal, allocation)}
          <span className="ml-1.5 font-medium opacity-70">
            ({formatMoney(subtotal)})
          </span>
        </div>
      </div>
      {positions.length === 0 ? (
        <p className="px-4 py-6 text-sm text-zinc-400">没有 {title} 持仓。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left text-[11px] uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
                <SortableTh
                  label="Ticker"
                  sortKey="ticker"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                  className="px-4 py-2"
                />
                <SortableTh
                  label="名称"
                  sortKey="name"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                />
                <SortableTh
                  label="% Alloc"
                  sortKey="size"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                  align="right"
                />
                <SortableTh
                  label="仓位 ($)"
                  sortKey="size"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                  align="right"
                />
                <SortableTh
                  label="Daily PnL"
                  sortKey="pnlDaily"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                  align="right"
                />
                <SortableTh
                  label="MTD PnL"
                  sortKey="pnlMtd"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                  align="right"
                />
                <SortableTh
                  label="YTD PnL"
                  sortKey="pnlYtd"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                  align="right"
                />
                <SortableTh
                  label="ITD PnL"
                  sortKey="pnlItd"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                  align="right"
                />
                <SortableTh
                  label="1D %"
                  sortKey="change1d"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                  align="right"
                />
                <SortableTh
                  label="Country"
                  sortKey="country"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                />
                <SortableTh
                  label="Tag"
                  sortKey="tag"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                />
                <SortableTh label="AI Exposure" sortKey="aiExposure" activeKey={sortKey}
                  dir={sortDir} onSort={handleSort} align="right" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((position) => (
                <tr
                  key={position.key}
                  className="border-b border-zinc-50 transition-colors last:border-0 hover:bg-zinc-50/80 dark:border-zinc-800/50 dark:hover:bg-zinc-800/40"
                >
                  <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                    {position.key}
                  </td>
                  <td className="max-w-44 truncate px-3 py-2 text-zinc-800 dark:text-zinc-100">
                    {position.name}
                  </td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums text-zinc-800 dark:text-zinc-100">
                    {formatAllocPct(Math.abs(position.nmv), allocation)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                    {formatMoney(Math.abs(position.nmv))}
                  </td>
                  <PnlCell value={position.pnlDaily} />
                  <PnlCell value={position.pnlMtd} />
                  <PnlCell value={position.pnlYtd} />
                  <PnlCell value={position.pnlItd} />
                  <td
                    className={`px-3 py-2 text-right tabular-nums ${pnlColor(position.priceChange1dPct)}`}
                  >
                    {formatPct(position.priceChange1dPct)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">
                    {position.country}
                  </td>
                  <td className="px-3 py-2">
                    <TagEditor
                      stockKey={position.key}
                      value={tagOf(position)}
                      knownTags={knownTags}
                      onChange={(tag, expected) => onTagChange(position.key, tag, expected)}
                      onCommitted={() => onTagCommitted(position.key)}
                      readOnly={readOnly}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <AiExposureInput stockKey={position.key} value={aiExposureMap[position.key]}
                      readOnly={readOnly} onChange={(value, expected) => onAiExposureChange(position.key, value, expected)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SortableTh<K extends string>({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  align,
  className,
}: {
  label: string;
  sortKey: K;
  activeKey: K | null;
  dir: "desc" | "asc";
  onSort: (key: K) => void;
  align?: "right";
  className?: string;
}) {
  const active = activeKey === sortKey;
  return (
    <th
      className={`${className ?? "px-3 py-2"} font-medium ${
        align === "right" ? "text-right" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        title="点击排序"
        className={`inline-flex items-center gap-0.5 uppercase tracking-wide transition-colors hover:text-zinc-700 dark:hover:text-zinc-200 ${
          active ? "text-zinc-700 dark:text-zinc-200" : ""
        }`}
      >
        {label}
        <span className="w-3 text-[9px]">
          {active ? (dir === "desc" ? "▼" : "▲") : ""}
        </span>
      </button>
    </th>
  );
}

function PnlCell({ value }: { value: number }) {
  return (
    <td className={`px-3 py-2 text-right tabular-nums ${pnlColor(value)}`}>
      {formatSignedMoney(value)}
    </td>
  );
}

function TagEditor({
  stockKey,
  value,
  knownTags,
  onChange,
  onCommitted,
  readOnly,
}: {
  stockKey: string;
  value: string;
  knownTags: string[];
  onChange: (tag: string, expected: string) => Promise<boolean>;
  onCommitted: () => void;
  readOnly: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing || readOnly) return;
    inputRef.current?.scrollIntoView({ block: "center", inline: "center" });
    inputRef.current?.focus({ preventScroll: true });
  }, [editing, readOnly]);

  useEffect(() => {
    if (!editing) queueMicrotask(() => setDraft(value));
  }, [value, editing]);

  const editBaseRef = useRef(value);
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const commit = async (advance = false) => {
    if (readOnly || savingRef.current) return;
    // An empty Enter keeps this item open rather than silently skipping it.
    if (advance && !draft.trim()) return;
    savingRef.current = true; setSaving(true);
    try {
      if (draft.trim() !== value && !await onChange(draft, editBaseRef.current)) {
        setError("标签未保存，请重试。");
        return;
      }
      setError(null);
      setEditing(false);
      if (advance) onCommitted();
    } catch {
      setError("标签未保存，请重试。");
    } finally { savingRef.current = false; setSaving(false); }
  };

  if (editing && !readOnly) {
    return (
      <span>
        <span className="mb-1 block max-w-28 break-words text-[11px] text-zinc-500 dark:text-zinc-400">{stockKey}</span>
        <input
          ref={inputRef}
          data-portfolio-tag-key={stockKey}
          aria-label={`${stockKey} Tag`}
          aria-invalid={!!error}
          list="zhinote-portfolio-tags"
          readOnly={saving}
          aria-busy={saving}
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setError(null); }}
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            if (savingRef.current || e.nativeEvent.isComposing || e.keyCode === 229) return;
            if (e.key === "Enter") { e.preventDefault(); void commit(true); }
            if (e.key === "Escape") {
              e.preventDefault();
              setError(null);
              setDraft(value);
              setEditing(false);
            }
          }}
          className="w-28 rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-xs text-zinc-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <datalist id="zhinote-portfolio-tags">
          {knownTags.map((tag) => (
            <option key={tag} value={tag} />
          ))}
        </datalist>
        {error && <span role="alert" className="mt-1 block text-xs text-rose-600 dark:text-rose-400">{error}</span>}
      </span>
    );
  }

  return (
    <button
      type="button"
      data-portfolio-tag-key={stockKey}
      disabled={readOnly}
      onClick={() => { editBaseRef.current = value; setDraft(value); setError(null); setEditing(true); }}
      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs transition-colors ${
        value
          ? "bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-950"
          : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-700"
      }`}
      title="点击修改标签"
    >
      {value || "未分类"}
    </button>
  );
}

type ExposureSortKey = "label" | "long" | "short" | "net" | "gross" | "aiExposure";

function ExposureTable({
  title,
  icon,
  exposures,
  aiExposureMap,
  allocation,
  expanded,
  onExpandedChange,
}: {
  title: string;
  icon: string;
  allocation: number;
  aiExposureMap: AiExposureMap;
  exposures: {
    rows: ExposureRow[];
    totalGross: number;
  };
  expanded: Set<string>;
  onExpandedChange: (next: Set<string>) => void;
}) {
  const { rows } = exposures;
  const totalLong = rows.reduce((sum, row) => sum + row.long, 0);
  const totalShort = rows.reduce((sum, row) => sum + row.short, 0);
  const totalAi = rows.reduce((sum, row) => sum + row.aiExposure, 0);
  const maxGross = rows.reduce((max, row) => Math.max(max, row.gross), 0);

  const [sortKey, setSortKey] = useState<ExposureSortKey | null>(null);
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const handleSort = (key: ExposureSortKey) => {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const flip = sortDir === "desc" ? -1 : 1;
    return [...rows].sort((a, b) => {
      const cmp =
        sortKey === "label"
          ? a.label.localeCompare(b.label)
          : a[sortKey] - b[sortKey];
      return cmp * flip;
    });
  }, [rows, sortKey, sortDir]);

  const toggle = (label: string) => {
    const next = new Set(expanded);
    if (next.has(label)) next.delete(label);
    else next.add(label);
    onExpandedChange(next);
  };

  // Divider class between the % group and $ group
  const divCls =
    "border-l border-zinc-200 dark:border-zinc-700";

  return (
    <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <span>{icon}</span>
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
          {title}
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {/* Group header row */}
            <tr className="text-[10px] uppercase tracking-widest text-zinc-300 dark:text-zinc-600">
              <th />
              <th
                colSpan={5}
                className="border-b border-zinc-100 px-3 pb-0.5 pt-2 text-center font-medium dark:border-zinc-800"
              >
                % of Allocation
              </th>
              <th
                colSpan={5}
                className={`border-b border-zinc-100 px-3 pb-0.5 pt-2 text-center font-medium dark:border-zinc-800 ${divCls}`}
              >
                Dollar
              </th>
              <th />
            </tr>
            {/* Column header row */}
            <tr className="border-b border-zinc-100 text-left text-[11px] uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
              <SortableTh
                label={title.replace("按 ", "")}
                sortKey="label"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                className="px-4 py-2"
              />
              <SortableTh
                label="Long"
                sortKey="long"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                align="right"
              />
              <SortableTh
                label="Short"
                sortKey="short"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                align="right"
              />
              <SortableTh
                label="Net"
                sortKey="net"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                align="right"
              />
              <SortableTh
                label="Gross"
                sortKey="gross"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                align="right"
              />
              <SortableTh label="AI Exposure" sortKey="aiExposure" activeKey={sortKey}
                dir={sortDir} onSort={handleSort} align="right" />
              <SortableTh
                label="Long"
                sortKey="long"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                align="right"
                className={`px-3 py-2 ${divCls}`}
              />
              <SortableTh
                label="Short"
                sortKey="short"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                align="right"
              />
              <SortableTh
                label="Net"
                sortKey="net"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                align="right"
              />
              <SortableTh
                label="Gross"
                sortKey="gross"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                align="right"
              />
              <SortableTh label="AI Exposure" sortKey="aiExposure" activeKey={sortKey}
                dir={sortDir} onSort={handleSort} align="right" />
              <th className="w-[14%] px-3 py-2 font-medium">L / S</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => {
              const barScale = maxGross > 0 ? row.gross / maxGross : 0;
              const longShare = row.gross > 0 ? row.long / row.gross : 0;
              const isOpen = expanded.has(row.label);
              const sorted = isOpen
                ? [...row.positions].sort((a, b) => {
                    const aLong = a.nmv >= 0;
                    const bLong = b.nmv >= 0;
                    if (aLong !== bLong) return aLong ? -1 : 1;
                    return Math.abs(b.nmv) - Math.abs(a.nmv);
                  })
                : [];
              return (
                <Fragment key={row.label}>
                  <tr
                    onClick={() => toggle(row.label)}
                    className="cursor-pointer border-b border-zinc-50 transition-colors last:border-0 hover:bg-zinc-50/80 dark:border-zinc-800/50 dark:hover:bg-zinc-800/40"
                  >
                    <td className="px-4 py-2 font-medium text-zinc-800 dark:text-zinc-100">
                      <span className="mr-1.5 inline-block w-3 text-[10px] text-zinc-400">
                        {isOpen ? "▼" : "▶"}
                      </span>
                      {row.label}
                      <span className="ml-1.5 text-[11px] font-normal text-zinc-400">
                        ({row.positions.length})
                      </span>
                    </td>
                    {/* — % group — */}
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatAllocPct(row.long, allocation)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-rose-600 dark:text-rose-400">
                      {formatAllocPct(row.short, allocation)}
                    </td>
                    <td
                      className={`whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums ${pnlColor(row.net)}`}
                    >
                      {formatSignedAllocPct(row.net, allocation)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-700 dark:text-zinc-200">
                      {formatAllocPct(row.gross, allocation)}
                    </td>
                    {/* — $ group — */}
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-700 dark:text-zinc-200">
                      {formatSignedAllocPct(row.aiExposure, allocation)}
                    </td>
                    <td className={`whitespace-nowrap px-3 py-2 text-right tabular-nums text-emerald-600/70 dark:text-emerald-400/70 ${divCls}`}>
                      {formatMoney(row.long)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-rose-600/70 dark:text-rose-400/70">
                      {formatMoney(row.short)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                      {formatSignedMoney(row.net)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                      {formatMoney(row.gross)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                      {formatSignedMoney(row.aiExposure)}
                    </td>
                    <td className="px-3 py-2">
                      <div
                        className="flex h-2.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
                        style={{ width: `${Math.max(barScale * 100, 4)}%` }}
                        title={`Long ${formatAllocPct(row.long, allocation)} / Short ${formatAllocPct(row.short, allocation)}`}
                      >
                        <div
                          className="bg-emerald-500"
                          style={{ width: `${longShare * 100}%` }}
                        />
                        <div
                          className="bg-rose-500"
                          style={{ width: `${(1 - longShare) * 100}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                  {isOpen &&
                    sorted.map((p, i) => (
                      <tr
                        key={p.key}
                        className={`border-b border-zinc-50/50 bg-zinc-50/50 dark:border-zinc-800/30 dark:bg-zinc-800/20 ${
                          i > 0 && p.nmv < 0 && sorted[i - 1].nmv >= 0
                            ? "border-t border-t-zinc-200 dark:border-t-zinc-700"
                            : ""
                        }`}
                      >
                        <td
                          className={`py-1.5 pl-10 pr-3 font-mono text-xs ${
                            p.nmv >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {p.ticker}
                          <span className="ml-1.5 font-sans opacity-80">
                            {p.name}
                          </span>
                        </td>
                        {/* — % group — */}
                        <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-xs text-emerald-600 dark:text-emerald-400">
                          {p.nmv >= 0
                            ? formatAllocPct(p.nmv, allocation)
                            : ""}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-xs text-rose-600 dark:text-rose-400">
                          {p.nmv < 0
                            ? formatAllocPct(-p.nmv, allocation)
                            : ""}
                        </td>
                        <td
                          className={`whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-xs ${pnlColor(p.nmv)}`}
                        >
                          {formatSignedAllocPct(p.nmv, allocation)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-xs text-zinc-700 dark:text-zinc-200">
                          {formatAllocPct(Math.abs(p.nmv), allocation)}
                        </td>
                        {/* — $ group — */}
                        <td className="whitespace-nowrap px-3 py-1.5 text-right text-xs tabular-nums text-zinc-700 dark:text-zinc-200">
                          {formatSignedAllocPct(positionAiExposure(p, aiExposureMap), allocation)}
                        </td>
                        <td className={`whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-xs text-emerald-600/70 dark:text-emerald-400/70 ${divCls}`}>
                          {p.nmv >= 0 ? formatMoney(p.nmv) : ""}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-xs text-rose-600/70 dark:text-rose-400/70">
                          {p.nmv < 0 ? formatMoney(-p.nmv) : ""}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-xs text-zinc-500 dark:text-zinc-400">
                          {formatSignedMoney(p.nmv)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-xs text-zinc-500 dark:text-zinc-400">
                          {formatMoney(Math.abs(p.nmv))}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-right text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                          {formatSignedMoney(positionAiExposure(p, aiExposureMap))}
                        </td>
                        <td className="px-3 py-1.5">
                          <div
                            className={`h-1.5 rounded-full ${
                              p.nmv >= 0 ? "bg-emerald-500" : "bg-rose-500"
                            }`}
                            style={{
                              width: `${Math.max(
                                maxGross > 0
                                  ? (Math.abs(p.nmv) / maxGross) * 100
                                  : 0,
                                2
                              )}%`,
                            }}
                            title={`${p.nmv >= 0 ? "Long" : "Short"} ${formatAllocPct(Math.abs(p.nmv), allocation)}`}
                          />
                        </td>
                      </tr>
                    ))}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-zinc-200 bg-zinc-50/60 font-medium dark:border-zinc-700 dark:bg-zinc-800/40">
              <td className="px-4 py-2 text-zinc-700 dark:text-zinc-200">
                Total
              </td>
              {/* — % group — */}
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatAllocPct(totalLong, allocation)}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-rose-600 dark:text-rose-400">
                {formatAllocPct(totalShort, allocation)}
              </td>
              <td
                className={`whitespace-nowrap px-3 py-2 text-right tabular-nums ${pnlColor(totalLong - totalShort)}`}
              >
                {formatSignedAllocPct(totalLong - totalShort, allocation)}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-700 dark:text-zinc-200">
                {formatAllocPct(totalLong + totalShort, allocation)}
              </td>
              {/* — $ group — */}
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-700 dark:text-zinc-200">
                {formatSignedAllocPct(totalAi, allocation)}
              </td>
              <td className={`whitespace-nowrap px-3 py-2 text-right tabular-nums text-emerald-600/70 dark:text-emerald-400/70 ${divCls}`}>
                {formatMoney(totalLong)}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-rose-600/70 dark:text-rose-400/70">
                {formatMoney(totalShort)}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                {formatSignedMoney(totalLong - totalShort)}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                {formatMoney(totalLong + totalShort)}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                {formatSignedMoney(totalAi)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

// ----- formatting ----------------------------------------------------------------

function formatMoney(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  return `$${value.toFixed(0)}`;
}

function formatSignedMoney(value: number): string {
  const formatted = formatMoney(Math.abs(value));
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
}

function formatAllocPct(value: number, allocation: number): string {
  if (allocation <= 0) return "—";
  return `${((value / allocation) * 100).toFixed(1)}%`;
}

function formatSignedAllocPct(value: number, allocation: number): string {
  if (allocation <= 0) return "—";
  const pct = (value / allocation) * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function formatPct(value: number): string {
  if (value === 0) return "0.0%";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function pnlColor(value: number): string {
  if (value > 0) return "text-emerald-600 dark:text-emerald-400";
  if (value < 0) return "text-rose-600 dark:text-rose-400";
  return "text-zinc-400";
}

function formatImportTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}
