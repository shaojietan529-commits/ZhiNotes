"use client";

// Email-code login surface for the multi-account system. Shows a clear
// "not configured" state until the owner enables Resend + the allowlist,
// so this page is safe to ship ahead of the cloud rollout.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/sidebar/Sidebar";
import {
  addShareEmail,
  fetchShares,
  removeShareEmail,
} from "@/lib/portfolio/accountSync";
import {
  PAGE_SYNC_STATUS_EVENT,
  PAGE_SYNC_STORAGE_KEY_PREFIX,
  forcePullDailyCloudPages,
  getLastPageSyncAt,
  getPendingCloudPageSyncStatusWithSyncLog,
  isPageSyncEnabled,
  reconcilePageSync,
  rebuildPageCacheFromCloud,
  setPageSyncEnabled,
  type PendingCloudPageSyncStatus,
} from "@/lib/pages/accountPageSync";
import {
  notifyAccountProfileUpdated,
  formatClientAccountLabel,
  type ClientAccountInfo,
} from "@/lib/account/clientProfile";
import {
  ACCOUNT_SESSION_LAST_AUTHENTICATED_STORAGE_KEY,
  clearAccountSessionCache,
  clearAccountSessionRuntimeCache,
  fetchAccountSession,
  getLastAuthenticatedAccount,
  rememberLastAuthenticatedAccount,
} from "@/lib/account/clientSession";
import {
  DATABASE_SYNC_STATUS_EVENT,
  DATABASE_SYNC_STORAGE_KEY_PREFIX,
  getLastDatabaseSyncAt,
  getPendingCloudDatabaseSyncStatus,
  isDatabaseSyncEnabled,
  pushPendingLocalDatabaseChangesToCloud,
  rebuildDatabaseCacheFromCloud,
  reconcileDatabaseSync,
  setDatabaseSyncEnabled,
  type PendingCloudDatabaseSyncStatus,
} from "@/lib/database/accountDatabaseSync";
import {
  FILE_EMBED_SYNC_QUEUE_EVENT,
  FILE_EMBED_SYNC_QUEUE_STORAGE_KEY,
  getPendingFileEmbedSyncStatus,
  type PendingFileEmbedSyncStatus,
} from "@/lib/files/fileEmbedSyncQueue";
import {
  buildCloudUploadReliabilityReport,
  type CloudUploadReliabilityGateStatus,
  type CloudUploadReliabilityReport,
  type CloudUploadReliabilityStatus,
} from "@/lib/sync/cloudUploadReliabilityReport";
import {
  getSyncLogSummary,
  getWorkspaceSetting,
  SYNC_LOG_STATUS_EVENT,
  SYNC_LOG_STATUS_STORAGE_KEY,
  upsertWorkspaceSetting,
  type SyncLogSummary,
} from "@/lib/db/local/queries";
import {
  KNOWLEDGE_SYNC_STATUS_EVENT,
  KNOWLEDGE_SYNC_STATUS_STORAGE_KEY,
} from "@/lib/sync/knowledgeSyncStatus";
import {
  SETTINGS_SYNC_STATUS_EVENT,
  SETTINGS_SYNC_STATUS_STORAGE_KEY,
} from "@/lib/sync/settingsSyncStatus";
import {
  DEFAULT_HOT_CACHE_PREFERENCES,
  HOT_CACHE_PREFERENCES_CHANGED_EVENT,
  HOT_CACHE_PREFERENCES_CHANGED_STORAGE_KEY,
  HOT_CACHE_PREFERENCES_SETTING_KEY,
  metadataRecentLimitForHotCachePreferences,
  normalizeHotCachePreferences,
  notifyHotCachePreferencesChanged,
  parseHotCachePreferences,
  type HotCachePreferences,
} from "@/lib/sync/hotCacheSelectionSettings";
import {
  getHotCacheRouteTargets,
  prefetchHotCacheRoutes,
} from "@/lib/sync/hotCacheRouteWarmup";
import {
  readLocalWorkspaceIdentity,
  type LocalWorkspaceIdentity,
} from "@/lib/sync/workspaceIdentity";
import { usePages } from "@/hooks/usePages";

type Phase =
  | "loading"
  | "unconfigured"
  | "email"
  | "code"
  | "signed-in"
  | "error";

type AccountCloudCoverageStatus = "cloud-ready" | "partial" | "local-only";

const ACCOUNT_ACTION_REQUEST_TIMEOUT_MS = 12000;

const accountCloudCoverageRows: {
  id: string;
  title: string;
  status: AccountCloudCoverageStatus;
  scope: string;
  boundary: string;
  next: string;
}[] = [
  {
    id: "pages",
    title: "页面 / 每日纪要 / 会议安排",
    status: "cloud-ready",
    scope: "标题、正文、层级、属性、封面已接入账号云同步。",
    boundary: "本机只是可重建热缓存；pending、failed、manual review 未清零前不能重建。",
    next: "继续压低首屏等待时间，并把每日纪要/会议入口保持 metadata-first。",
  },
  {
    id: "databases",
    title: "数据库",
    status: "cloud-ready",
    scope: "数据库结构、字段、视图和行值已接入账号云同步。",
    boundary: "只上传明确进入 pending queue / sync_log 的变更，不用整份本机缓存覆盖云端。",
    next: "继续做按需加载和冲突复核，让大表打开时更接近本地速度。",
  },
  {
    id: "settings",
    title: "账号 / 模块设置",
    status: "partial",
    scope: "用户名、账号偏好、模块配置等白名单设置可进入待上传计划。",
    boundary: "非白名单本地配置不会被自动上传；恢复前先检查本地 pending。",
    next: "把常用设置补齐到统一 settings 队列，减少多设备配置漂移。",
  },
  {
    id: "files-comments-versions-ai",
    title: "文件 / 评论 / 版本 / AI 输出",
    status: "partial",
    scope: "文件嵌入已有独立上传队列；评论正文、版本快照和 AI 输出仍按本地或显式确认边界处理。",
    boundary: "文件队列只在账号页和同步中心展示元数据状态；失败清零前会阻断缓存重建。",
    next: "下一步需要云表、权限、容量策略和二次确认后，才能纳入全域云端主库。",
  },
];

async function fetchAccountActionWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(),
    ACCOUNT_ACTION_REQUEST_TIMEOUT_MS
  );
  try {
    return await fetch(input, {
      ...init,
      cache: init?.cache ?? "no-store",
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

function getAccountActionFailureMessage(
  error: unknown,
  timeoutMessage: string,
  fallbackMessage: string
) {
  return error instanceof Error && error.name === "AbortError"
    ? timeoutMessage
    : fallbackMessage;
}

async function getPageCacheRebuildPendingBlocker(): Promise<string | null> {
  return getPageCacheRebuildBlockerFromStatus(
    await getPendingCloudPageSyncStatusWithSyncLog()
  );
}

function getPageCacheRebuildBlockerFromStatus(
  status: PendingCloudPageSyncStatus
): string | null {
  const pending = status.pending + status.queued + (status.syncLogPending ?? 0);
  if (
    pending === 0 &&
    status.failed === 0 &&
    status.manualReviewCount === 0
  ) {
    return null;
  }
  return `页面缓存重建已拦截：仍有 ${pending} 条待上传/内存排队/sync_log 变更、${status.failed} 条失败记录、${status.manualReviewCount} 条需要人工处理。为避免未上传或失败输入在重建本机缓存时被隐藏，请先点击“立即同步”，确认页面 pending、failed、manual review 都清零后再重建。`;
}

async function getDatabaseCacheRebuildPendingBlocker(): Promise<string | null> {
  return getDatabaseCacheRebuildBlockerFromStatus(
    await getPendingCloudDatabaseSyncStatus()
  );
}

function getFileEmbedCacheRebuildPendingBlocker(): string | null {
  return getFileEmbedCacheRebuildBlockerFromStatus(
    getPendingFileEmbedSyncStatus()
  );
}

function getFileEmbedCacheRebuildBlockerFromStatus(
  status: PendingFileEmbedSyncStatus
): string | null {
  const pending = status.pending;
  if (
    pending === 0 &&
    status.failed === 0 &&
    status.manualReviewCount === 0
  ) {
    return null;
  }
  return `全域缓存重建已拦截：文件上传队列仍有 ${pending} 个待上传文件、${status.failed} 个失败、${status.manualReviewCount} 个需要人工处理。文件仍保存在本机；为避免重建本地缓存时误判云端已完整，请先到同步中心处理文件 pending / failed / manual review。`;
}

function getDatabaseCacheRebuildBlockerFromStatus(
  status: PendingCloudDatabaseSyncStatus
): string | null {
  const syncLogPending = status.syncLogPending ?? 0;
  const pending = status.pending + status.queued + syncLogPending;
  if (
    pending === 0 &&
    status.failed === 0 &&
    status.manualReviewCount === 0
  ) {
    return null;
  }
  return `数据库缓存重建已拦截：仍有 ${pending} 条待上传变更（cloud key ${status.pending} 条、内存排队 ${status.queued} 条、本地 sync_log ${syncLogPending} 条）、${status.failed} 条失败记录、${status.manualReviewCount} 条需要人工处理。为避免本机新输入被云端旧 manifest 隐藏，请先“上传待同步变更”或“立即同步数据库”，确认 pending、failed、manual review 都清零后再重建。`;
}

function isAccountCloudUploadStatusStorageEvent(event: StorageEvent): boolean {
  return (
    Boolean(event.key?.startsWith(PAGE_SYNC_STORAGE_KEY_PREFIX)) ||
    Boolean(event.key?.startsWith(DATABASE_SYNC_STORAGE_KEY_PREFIX)) ||
    event.key === FILE_EMBED_SYNC_QUEUE_STORAGE_KEY ||
    event.key === SYNC_LOG_STATUS_STORAGE_KEY ||
    event.key === SETTINGS_SYNC_STATUS_STORAGE_KEY ||
    event.key === KNOWLEDGE_SYNC_STATUS_STORAGE_KEY
  );
}

export default function AccountShell() {
  const router = useRouter();
  const { refresh: refreshPages } = usePages({ autoLoad: false });
  const [phase, setPhase] = useState<Phase>("loading");
  const [account, setAccount] = useState<ClientAccountInfo | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  // Portfolio sharing: emails I shared with / owners who shared with me.
  const [shareMembers, setShareMembers] = useState<string[]>([]);
  const [sharedWithMe, setSharedWithMe] = useState<string[]>([]);
  const [shareInput, setShareInput] = useState("");
  const [shareBusy, setShareBusy] = useState(false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  // Page cloud sync: on by default for signed-in browsers, with local opt-out.
  const [pageSyncOn, setPageSyncOn] = useState(false);
  const [pageSyncBusy, setPageSyncBusy] = useState(false);
  const [dailyRepairBusy, setDailyRepairBusy] = useState(false);
  const [dailyPullBusy, setDailyPullBusy] = useState(false);
  const [pageCacheRebuildBusy, setPageCacheRebuildBusy] = useState(false);
  const [pageSyncNotice, setPageSyncNotice] = useState<string | null>(null);
  const [pageSyncLastAt, setPageSyncLastAt] = useState<string | null>(null);
  // Database cloud sync: separate owner gate because row values are private.
  const [databaseSyncOn, setDatabaseSyncOn] = useState(false);
  const [databaseSyncBusy, setDatabaseSyncBusy] = useState(false);
  const [databasePushBusy, setDatabasePushBusy] = useState(false);
  const [databaseCacheRebuildBusy, setDatabaseCacheRebuildBusy] = useState(false);
  const [databaseSyncNotice, setDatabaseSyncNotice] = useState<string | null>(null);
  const [databaseSyncLastAt, setDatabaseSyncLastAt] = useState<string | null>(null);
  const [pagePendingStatus, setPagePendingStatus] =
    useState<PendingCloudPageSyncStatus | null>(null);
  const [databasePendingStatus, setDatabasePendingStatus] =
    useState<PendingCloudDatabaseSyncStatus | null>(null);
  const [fileEmbedPendingStatus, setFileEmbedPendingStatus] =
    useState<PendingFileEmbedSyncStatus | null>(null);
  const [syncSummary, setSyncSummary] = useState<SyncLogSummary | null>(null);
  const [workspaceIdentity, setWorkspaceIdentity] =
    useState<LocalWorkspaceIdentity | null>(null);
  const [hotCachePreferences, setHotCachePreferences] =
    useState<HotCachePreferences>(DEFAULT_HOT_CACHE_PREFERENCES);
  const [hotCacheSettingSaved, setHotCacheSettingSaved] = useState(false);
  const [hotCachePreferenceBusy, setHotCachePreferenceBusy] = useState(false);
  const [hotCachePreferenceNotice, setHotCachePreferenceNotice] = useState<
    string | null
  >(null);
  const [hotCacheRouteWarmupBusy, setHotCacheRouteWarmupBusy] = useState(false);
  const [hotCacheRouteWarmupNotice, setHotCacheRouteWarmupNotice] = useState<
    string | null
  >(null);
  // API Key for external tools (Claude, web clipper extension)
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [apiKeyBusy, setApiKeyBusy] = useState(false);
  const [apiKeyNotice, setApiKeyNotice] = useState<string | null>(null);
  const accountShellMountedRef = useRef(true);
  const refreshSessionRequestRef = useRef(0);

  useEffect(() => {
    accountShellMountedRef.current = true;
    return () => {
      accountShellMountedRef.current = false;
      refreshSessionRequestRef.current += 1;
    };
  }, []);

  useEffect(() => {
    setPageSyncOn(isPageSyncEnabled());
    setPageSyncLastAt(getLastPageSyncAt());
    setDatabaseSyncOn(isDatabaseSyncEnabled());
    setDatabaseSyncLastAt(getLastDatabaseSyncAt());
  }, []);

  const refreshCloudUploadReliability = useCallback(async () => {
    const [pageStatus, databaseStatus, localSyncSummary] = await Promise.all([
      getPendingCloudPageSyncStatusWithSyncLog(),
      getPendingCloudDatabaseSyncStatus(),
      getSyncLogSummary().catch(() => null),
    ]);
    if (!accountShellMountedRef.current) return;
    setPagePendingStatus(pageStatus);
    setDatabasePendingStatus(databaseStatus);
    setFileEmbedPendingStatus(getPendingFileEmbedSyncStatus());
    setSyncSummary(localSyncSummary);
    setWorkspaceIdentity(readLocalWorkspaceIdentity());
  }, []);

  useEffect(() => {
    if (phase !== "signed-in") return;
    void refreshCloudUploadReliability();
    const interval = window.setInterval(() => {
      void refreshCloudUploadReliability();
    }, 5000);
    const handleSyncStatus = () => {
      void refreshCloudUploadReliability();
    };
    const handleStorage = (event: StorageEvent) => {
      if (isAccountCloudUploadStatusStorageEvent(event)) {
        void refreshCloudUploadReliability();
      }
    };
    window.addEventListener(PAGE_SYNC_STATUS_EVENT, handleSyncStatus);
    window.addEventListener(DATABASE_SYNC_STATUS_EVENT, handleSyncStatus);
    window.addEventListener(SETTINGS_SYNC_STATUS_EVENT, handleSyncStatus);
    window.addEventListener(KNOWLEDGE_SYNC_STATUS_EVENT, handleSyncStatus);
    window.addEventListener(FILE_EMBED_SYNC_QUEUE_EVENT, handleSyncStatus);
    window.addEventListener(SYNC_LOG_STATUS_EVENT, handleSyncStatus);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener(PAGE_SYNC_STATUS_EVENT, handleSyncStatus);
      window.removeEventListener(DATABASE_SYNC_STATUS_EVENT, handleSyncStatus);
      window.removeEventListener(SETTINGS_SYNC_STATUS_EVENT, handleSyncStatus);
      window.removeEventListener(KNOWLEDGE_SYNC_STATUS_EVENT, handleSyncStatus);
      window.removeEventListener(FILE_EMBED_SYNC_QUEUE_EVENT, handleSyncStatus);
      window.removeEventListener(SYNC_LOG_STATUS_EVENT, handleSyncStatus);
      window.removeEventListener("storage", handleStorage);
    };
  }, [phase, refreshCloudUploadReliability]);

  const cloudUploadReliabilityReport = useMemo(() => {
    if (!pagePendingStatus || !databasePendingStatus || !fileEmbedPendingStatus) {
      return null;
    }
    return buildCloudUploadReliabilityReport({
      pageStatus: pagePendingStatus,
      databaseStatus: databasePendingStatus,
      fileStatus: fileEmbedPendingStatus,
      syncSummary,
      workspaceIdentity,
    });
  }, [
    databasePendingStatus,
    fileEmbedPendingStatus,
    pagePendingStatus,
    syncSummary,
    workspaceIdentity,
  ]);

  const pageCacheRebuildGateNotice = useMemo(() => {
    if (!pagePendingStatus) {
      return "正在检查页面 pending、failed、manual review 状态，检查完成前不允许重建本机页面缓存。";
    }
    if (!fileEmbedPendingStatus) {
      return "正在检查文件上传 pending、failed、manual review 状态，检查完成前不允许重建本机页面缓存。";
    }
    return (
      getPageCacheRebuildBlockerFromStatus(pagePendingStatus) ??
      getFileEmbedCacheRebuildBlockerFromStatus(fileEmbedPendingStatus)
    );
  }, [fileEmbedPendingStatus, pagePendingStatus]);

  const databaseCacheRebuildGateNotice = useMemo(() => {
    if (!databasePendingStatus) {
      return "正在检查数据库 pending、failed、manual review 状态，检查完成前不允许重建本机数据库缓存。";
    }
    if (!fileEmbedPendingStatus) {
      return "正在检查文件上传 pending、failed、manual review 状态，检查完成前不允许重建本机数据库缓存。";
    }
    return (
      getDatabaseCacheRebuildBlockerFromStatus(databasePendingStatus) ??
      getFileEmbedCacheRebuildBlockerFromStatus(fileEmbedPendingStatus)
    );
  }, [databasePendingStatus, fileEmbedPendingStatus]);

  const refreshHotCachePreferences = useCallback(async () => {
    const setting = await getWorkspaceSetting(HOT_CACHE_PREFERENCES_SETTING_KEY);
    if (!accountShellMountedRef.current) return;
    setHotCacheSettingSaved(Boolean(setting));
    setHotCachePreferences(parseHotCachePreferences(setting));
  }, []);

  useEffect(() => {
    if (phase !== "signed-in") return;
    void refreshHotCachePreferences();
  }, [phase, refreshHotCachePreferences]);

  useEffect(() => {
    if (phase !== "signed-in") return;
    const handleHotCachePreferencesChanged = (event: Event) => {
      const detail = (
        event as CustomEvent<{ preferences?: Partial<HotCachePreferences> }>
      ).detail;
      if (detail?.preferences) {
        setHotCacheSettingSaved(true);
        setHotCachePreferences(normalizeHotCachePreferences(detail.preferences));
        return;
      }
      void refreshHotCachePreferences();
    };
    const handleHotCachePreferencesStorage = (event: StorageEvent) => {
      if (event.key === HOT_CACHE_PREFERENCES_CHANGED_STORAGE_KEY) {
        void refreshHotCachePreferences();
      }
    };
    window.addEventListener(
      HOT_CACHE_PREFERENCES_CHANGED_EVENT,
      handleHotCachePreferencesChanged
    );
    window.addEventListener("storage", handleHotCachePreferencesStorage);
    return () => {
      window.removeEventListener(
        HOT_CACHE_PREFERENCES_CHANGED_EVENT,
        handleHotCachePreferencesChanged
      );
      window.removeEventListener("storage", handleHotCachePreferencesStorage);
    };
  }, [phase, refreshHotCachePreferences]);

  const setSignedInAccount = useCallback((nextAccount: ClientAccountInfo) => {
    rememberLastAuthenticatedAccount(nextAccount);
    if (!accountShellMountedRef.current) return;
    setAccount(nextAccount);
    setDisplayNameInput(nextAccount.display_name);
    notifyAccountProfileUpdated();
  }, []);

  const showStoredAccountFallback = useCallback((message: string) => {
    if (!accountShellMountedRef.current) return false;
    const lastAuthenticatedAccount = getLastAuthenticatedAccount();
    if (!lastAuthenticatedAccount) return false;
    setAccount(lastAuthenticatedAccount);
    setDisplayNameInput(lastAuthenticatedAccount.display_name);
    setPhase("signed-in");
    setNotice(message);
    return true;
  }, []);

  const refreshSession = useCallback(async () => {
    const requestId = refreshSessionRequestRef.current + 1;
    refreshSessionRequestRef.current = requestId;
    showStoredAccountFallback(
      "正在确认账号云端状态；本机已先保留最近一次登录状态，本地输入可继续保存。"
    );
    try {
      const session = await fetchAccountSession({ force: true });
      if (
        !accountShellMountedRef.current ||
        refreshSessionRequestRef.current !== requestId
      ) {
        return;
      }
      if (session.authenticated && session.account) {
        setSignedInAccount(session.account);
        setPhase("signed-in");
        if (session.stale) {
          setNotice(
            "账号会话暂时无法向云端确认，已保留最近一次登录状态；本地输入可继续保存，同步会稍后重试。"
          );
        } else {
          setNotice(null);
        }
        return;
      }
      if (session.status === "unconfigured") {
        setPhase("unconfigured");
        return;
      }
      if (session.status === "unconfirmed" || session.status === "error") {
        if (
          showStoredAccountFallback(
            "账号会话暂时无法向云端确认，已保留最近一次登录状态；本地输入可继续保存，同步会稍后重试。"
          )
        ) {
          return;
        }
        setPhase("error");
        return;
      }
      setPhase("email");
    } catch {
      if (
        !accountShellMountedRef.current ||
        refreshSessionRequestRef.current !== requestId
      ) {
        return;
      }
      if (
        showStoredAccountFallback(
          "账号检查暂时失败，已保留最近一次登录状态；本地输入可继续保存，同步会稍后重试。"
        )
      ) {
        return;
      }
      setPhase("error");
    }
  }, [setSignedInAccount, showStoredAccountFallback]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    const handleAccountSessionStorage = (event: StorageEvent) => {
      if (event.key === ACCOUNT_SESSION_LAST_AUTHENTICATED_STORAGE_KEY) {
        void refreshSession();
      }
    };
    window.addEventListener("storage", handleAccountSessionStorage);
    return () => {
      window.removeEventListener("storage", handleAccountSessionStorage);
    };
  }, [refreshSession]);

  // Load sharing lists once signed in.
  useEffect(() => {
    if (phase !== "signed-in") return;
    let cancelled = false;
    void fetchShares().then((result) => {
      if (cancelled || !accountShellMountedRef.current) return;
      if (result.status === "ok") {
        setShareMembers(result.data.members);
        setSharedWithMe(result.data.sharedWithMe);
      }
    });
    // Load existing API key
    void fetchAccountActionWithTimeout("/api/pages/ingest?action=current")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !accountShellMountedRef.current) return;
        if (d.ok) setApiKey(d.apiKey);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [phase]);

  async function handleShareAdd() {
    const email = shareInput.trim().toLowerCase();
    if (!email.includes("@")) return;
    setShareBusy(true);
    setShareNotice(null);
    try {
      const result = await addShareEmail(email);
      if (result.status === "ok") {
        setShareMembers(result.data);
        setShareInput("");
        setShareNotice("已共享。对方登录后在组合管理页可以切换查看你的持仓。");
      } else {
        setShareNotice(
          result.status === "error" && result.message
            ? result.message
            : "共享失败，请稍后重试。"
        );
      }
    } catch {
      setShareNotice("共享失败，请稍后重试。");
    } finally {
      setShareBusy(false);
    }
  }

  async function handleShareRemove(email: string) {
    setShareBusy(true);
    setShareNotice(null);
    try {
      const result = await removeShareEmail(email);
      if (result.status === "ok") {
        setShareMembers(result.data);
      } else {
        setShareNotice("移除失败，请稍后重试。");
      }
    } catch {
      setShareNotice("移除失败，请稍后重试。");
    } finally {
      setShareBusy(false);
    }
  }

  async function handlePageSyncRun() {
    setPageSyncBusy(true);
    setPageSyncNotice(null);
    try {
      const result = await reconcilePageSync({
        includeManualReview: true,
        forceAccountGate: true,
      });
      if (result.status === "ok") {
        setPageSyncLastAt(getLastPageSyncAt());
        const bootstrapText =
          result.bootstrapped && result.bootstrapped > 0
            ? `，补种本机基线 ${result.bootstrapped} 页`
            : "";
        setPageSyncNotice(
          `同步完成：拉取 ${result.pulled} 页，修复归档 ${result.repaired ?? 0} 页，推送 ${result.pushed} 页${bootstrapText}。`
        );
      } else if (result.status === "unauthenticated") {
        setPageSyncNotice("当前未登录，请登录后再同步。");
      } else if (result.status === "disabled") {
        setPageSyncNotice("请先打开页面云同步开关。");
      } else {
        setPageSyncNotice(result.message ?? "同步失败，请稍后重试。");
      }
    } catch {
      setPageSyncNotice(
        "同步失败，请稍后重试。本地输入仍保留在本机和待上传队列中。"
      );
    } finally {
      setPageSyncBusy(false);
      void refreshCloudUploadReliability();
    }
  }

  async function handleDailyRepairRun() {
    setDailyRepairBusy(true);
    setPageSyncNotice(null);
    try {
      const res = await fetchAccountActionWithTimeout("/api/pages/account-sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "repair-daily-imports" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setPageSyncNotice(
          typeof data.error === "string"
            ? data.error
            : "每日纪要归档修复失败，请稍后重试。"
        );
        return;
      }

      const repaired =
        typeof data.repaired === "number" ? data.repaired : 0;
      const skippedNoDate =
        typeof data.skippedNoDate === "number" ? data.skippedNoDate : 0;
      if (data.skippedNoRoot) {
        setPageSyncNotice("没有找到“每日纪要”根页面，请先打开一次每日纪要模块。");
        return;
      }
      setPageSyncNotice(
        `云端修复完成：归档 ${repaired} 页，缺少日期跳过 ${skippedNoDate} 页。正在同步到本机…`
      );
      await handlePageSyncRun();
    } catch (error) {
      setPageSyncNotice(
        getAccountActionFailureMessage(
          error,
          "每日纪要归档修复请求超时；本地页面和待同步队列未改变，可稍后重试。",
          "网络错误，未能修复每日纪要归档。"
        )
      );
    } finally {
      setDailyRepairBusy(false);
      void refreshCloudUploadReliability();
    }
  }

  async function handleDailyForcePullRun() {
    setDailyPullBusy(true);
    setPageSyncNotice(null);
    try {
      const result = await forcePullDailyCloudPages();
      if (result.status === "ok") {
        setPageSyncLastAt(getLastPageSyncAt());
        const failedText = result.failed ? `，失败 ${result.failed} 页` : "";
        const reasonText =
          result.failed && result.failedReason
            ? ` 首个失败原因：${result.failedReason}`
            : "";
        setPageSyncNotice(
          `每日纪要索引已从云端拉取：更新 ${result.pulled}/${result.total} 页${failedText}。${reasonText}请回到“每日纪要”查看；打开单篇纪要时会自动拉取正文。`
        );
      } else if (result.status === "unauthenticated") {
        setPageSyncNotice("当前未登录，请登录后再拉取每日纪要。");
      } else if (result.status === "disabled") {
        setPageSyncNotice("请先打开页面云同步开关。");
      } else {
        setPageSyncNotice(result.message ?? "每日纪要云端拉取失败，请稍后重试。");
      }
    } catch {
      setPageSyncNotice("本机写入失败，未能完成每日纪要拉取。");
    } finally {
      setDailyPullBusy(false);
      void refreshCloudUploadReliability();
    }
  }

  async function handlePageCacheRebuildRun() {
    const pendingBlocker =
      (await getPageCacheRebuildPendingBlocker()) ??
      getFileEmbedCacheRebuildPendingBlocker();
    if (pendingBlocker) {
      setPageSyncNotice(pendingBlocker);
      void refreshCloudUploadReliability();
      return;
    }
    const ok = window.confirm(
      "这会按账号云端 manifest 重建本机页面缓存：本机多出来、未同步到云端的普通页面缓存会被清空并隐藏；云端数据不会删除；数据库表格、本地文件、评论、版本历史不会上传或删除。继续吗？"
    );
    if (!ok) return;

    setPageCacheRebuildBusy(true);
    setPageSyncNotice(null);
    try {
      const result = await rebuildPageCacheFromCloud();
      if (result.status === "ok") {
        setPageSyncLastAt(getLastPageSyncAt());
        await refreshPages({ broadcast: false, reason: "cloud-pull" });
        const preservedText =
          result.preservedLocalPrivate && result.preservedLocalPrivate > 0
            ? `，保留本地数据库私有页面 ${result.preservedLocalPrivate} 页`
            : "";
        setPageSyncNotice(
          `本机页面缓存已按云端主库重建：清理 ${result.cleared} 条（其中本机多余缓存 ${result.pruned} 条），拉取 ${result.pulled}/${result.total} 页，修复归档 ${result.repaired ?? 0} 页${preservedText}。`
        );
      } else if (result.status === "unauthenticated") {
        setPageSyncNotice("当前未登录，请登录后再重建本机缓存。");
      } else if (result.status === "disabled") {
        setPageSyncNotice("请先打开页面云同步开关。");
      } else {
        setPageSyncNotice(result.message ?? "本机缓存重建失败，请稍后重试。");
      }
    } catch {
      setPageSyncNotice("本机写入失败，未能完成页面缓存重建。");
    } finally {
      setPageCacheRebuildBusy(false);
      void refreshCloudUploadReliability();
    }
  }

  function handlePageSyncToggle() {
    const next = !pageSyncOn;
    if (next) {
      const ok = window.confirm(
        "开启后，本浏览器的页面（标题、正文、层级、属性、封面）会上传到你账号的云端存储，并和其他登录了同一账号的浏览器双向同步。数据库表格、本地文件不会上传。确定开启吗？"
      );
      if (!ok) return;
    }
    setPageSyncEnabled(next);
    setPageSyncOn(next);
    setPageSyncNotice(
      next ? "已开启。首次同步会在后台自动进行。" : "已关闭。云端已有数据保留，不再继续同步。"
    );
    void refreshCloudUploadReliability();
    if (next) {
      void handlePageSyncRun();
    }
  }

  async function handleDatabaseSyncRun() {
    setDatabaseSyncBusy(true);
    setDatabaseSyncNotice(null);
    try {
      const result = await reconcileDatabaseSync({
        includeManualReview: true,
        forceAccountGate: true,
      });
      if (result.status === "ok") {
        setDatabaseSyncLastAt(getLastDatabaseSyncAt());
        const bootstrapText =
          result.bootstrapped && result.bootstrapped > 0
            ? `，补种本机基线 ${result.bootstrapped} 条`
            : "";
        setDatabaseSyncNotice(
          `数据库同步完成：拉取 ${result.pulled} 条，推送 ${result.pushed} 条，远端跳过 ${result.skipped} 条${bootstrapText}。`
        );
      } else if (result.status === "unauthenticated") {
        setDatabaseSyncNotice("当前未登录，请登录后再同步数据库。");
      } else if (result.status === "disabled") {
        setDatabaseSyncNotice("请先打开数据库云同步开关。");
      } else {
        setDatabaseSyncNotice(result.message ?? "数据库同步失败，请稍后重试。");
      }
    } catch {
      setDatabaseSyncNotice("本机数据库读写失败，未能完成同步。");
    } finally {
      setDatabaseSyncBusy(false);
      void refreshCloudUploadReliability();
    }
  }

  async function handleDatabasePushRun() {
    setDatabasePushBusy(true);
    setDatabaseSyncNotice(null);
    try {
      const result = await pushPendingLocalDatabaseChangesToCloud();
      if (result.status === "ok") {
        setDatabaseSyncLastAt(getLastDatabaseSyncAt());
        setDatabaseSyncNotice(
          `待同步数据库变更已上传：推送 ${result.pushed}/${result.total} 条，远端跳过 ${result.skipped} 条较旧记录。`
        );
      } else if (result.status === "unauthenticated") {
        setDatabaseSyncNotice("当前未登录，请登录后再上传数据库。");
      } else if (result.status === "disabled") {
        setDatabaseSyncNotice("请先打开数据库云同步开关。");
      } else {
        setDatabaseSyncNotice(result.message ?? "数据库上传失败，请稍后重试。");
      }
    } catch {
      setDatabaseSyncNotice("本机数据库读取失败，未能上传。");
    } finally {
      setDatabasePushBusy(false);
      void refreshCloudUploadReliability();
    }
  }

  async function handleDatabaseCacheRebuildRun() {
    const pendingBlocker =
      (await getDatabaseCacheRebuildPendingBlocker()) ??
      getFileEmbedCacheRebuildPendingBlocker();
    if (pendingBlocker) {
      setDatabaseSyncNotice(pendingBlocker);
      void refreshCloudUploadReliability();
      return;
    }
    const ok = window.confirm(
      "这会按账号云端 manifest 重建本机数据库缓存：本机多出来、未同步到云端的数据库、字段、视图和行会被隐藏；云端数据不会删除；页面、本地文件、评论、版本历史不会上传或删除。继续吗？"
    );
    if (!ok) return;

    setDatabaseCacheRebuildBusy(true);
    setDatabaseSyncNotice(null);
    try {
      const result = await rebuildDatabaseCacheFromCloud();
      if (result.status === "ok") {
        setDatabaseSyncLastAt(getLastDatabaseSyncAt());
        setDatabaseSyncNotice(
          `本机数据库缓存已按云端主库重建：清理 ${result.cleared} 条，拉取 ${result.pulled}/${result.total} 条。`
        );
      } else if (result.status === "unauthenticated") {
        setDatabaseSyncNotice("当前未登录，请登录后再重建数据库缓存。");
      } else if (result.status === "disabled") {
        setDatabaseSyncNotice("请先打开数据库云同步开关。");
      } else {
        setDatabaseSyncNotice(result.message ?? "数据库缓存重建失败，请稍后重试。");
      }
    } catch {
      setDatabaseSyncNotice("本机数据库写入失败，未能完成缓存重建。");
    } finally {
      setDatabaseCacheRebuildBusy(false);
      void refreshCloudUploadReliability();
    }
  }

  function handleDatabaseSyncToggle() {
    const next = !databaseSyncOn;
    if (next) {
      const ok = window.confirm(
        "开启后，数据库会按账号云端主库同步；本机新产生且进入待同步队列的数据库修改会上传到云端，并和其他登录同一账号的浏览器同步。确定开启吗？"
      );
      if (!ok) return;
    }
    setDatabaseSyncEnabled(next);
    setDatabaseSyncOn(next);
    setDatabaseSyncNotice(
      next
        ? "已开启。正在按云端主库同步，并上传本机待同步变更。"
        : "已关闭。云端已有数据库数据保留，不再继续同步。"
    );
    void refreshCloudUploadReliability();
    if (next) {
      void handleDatabaseSyncRun();
    }
  }

  async function handleSendCode() {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetchAccountActionWithTimeout("/api/account/login/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice(data.error ?? "发送失败，请稍后重试。");
        return;
      }
      setPhase("code");
      setNotice("验证码已发送（如果该邮箱在受邀名单内），请查收邮件。");
    } catch (error) {
      setNotice(
        getAccountActionFailureMessage(
          error,
          "发送验证码请求超时，请稍后重试；当前页面数据不受影响。",
          "网络错误，请稍后重试。"
        )
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify() {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetchAccountActionWithTimeout("/api/account/login/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice(data.error ?? "验证失败，请稍后重试。");
        return;
      }
      clearAccountSessionRuntimeCache();
      setSignedInAccount(data.account as ClientAccountInfo);
      setCode("");
      setPhase("signed-in");
    } catch (error) {
      setNotice(
        getAccountActionFailureMessage(
          error,
          "验证登录请求超时，请稍后重试；不会清除当前本地数据。",
          "网络错误，请稍后重试。"
        )
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDisplayNameSave() {
    const displayName = displayNameInput.trim().replace(/\s+/g, " ");
    if (!displayName) {
      setProfileNotice("用户名不能为空。");
      return;
    }
    setProfileBusy(true);
    setProfileNotice(null);
    try {
      const res = await fetchAccountActionWithTimeout("/api/account/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ display_name: displayName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setProfileNotice(data.error ?? "用户名保存失败，请稍后重试。");
        return;
      }
      clearAccountSessionRuntimeCache();
      setSignedInAccount(data.account as ClientAccountInfo);
      setProfileNotice("用户名已保存。");
    } catch (error) {
      setProfileNotice(
        getAccountActionFailureMessage(
          error,
          "用户名保存请求超时；当前登录状态已保留，可稍后重试。",
          "网络错误，请稍后重试。"
        )
      );
    } finally {
      setProfileBusy(false);
    }
  }

  async function handleHotCachePreferencesChange(
    patch: Partial<HotCachePreferences>
  ) {
    const previous = hotCachePreferences;
    const next = normalizeHotCachePreferences({
      ...hotCachePreferences,
      ...patch,
    });
    setHotCachePreferences(next);
    setHotCachePreferenceBusy(true);
    setHotCachePreferenceNotice(null);
    try {
      await upsertWorkspaceSetting(
        HOT_CACHE_PREFERENCES_SETTING_KEY,
        next,
        "account-hot-cache-preferences"
      );
      setHotCacheSettingSaved(true);
      notifyHotCachePreferencesChanged(next);
      setHotCachePreferenceNotice(
        "已保存。本机入口会按这个选择保持热缓存；设置会进入待同步队列。"
      );
      handleHotCacheRouteWarmup(next);
      void refreshCloudUploadReliability();
    } catch {
      setHotCachePreferences(previous);
      setHotCachePreferenceNotice("保存失败，本机缓存策略未改变。");
    } finally {
      setHotCachePreferenceBusy(false);
    }
  }

  function handleHotCacheRouteWarmup(
    preferences: HotCachePreferences = hotCachePreferences
  ) {
    setHotCacheRouteWarmupBusy(true);
    setHotCacheRouteWarmupNotice(null);
    try {
      const receipt = prefetchHotCacheRoutes(
        (routeTarget) => router.prefetch(routeTarget),
        preferences
      );
      setHotCacheRouteWarmupNotice(
        receipt.failed > 0
          ? `已尝试预热 ${receipt.attempted} 个入口，其中 ${receipt.failed} 个暂时失败；这只影响首次打开速度，不影响数据。`
          : `已预热 ${receipt.attempted} 个常用入口。只做 route prefetch，不读取正文、不上传、不写 sync_log。`
      );
      return receipt;
    } catch {
      setHotCacheRouteWarmupNotice(
        "预热入口失败；这只影响首次打开速度，不影响数据，也不会上传或改写本地内容。"
      );
      return null;
    } finally {
      setHotCacheRouteWarmupBusy(false);
    }
  }

  async function handleGenerateApiKey() {
    setApiKeyBusy(true);
    setApiKeyNotice(null);
    try {
      const res = await fetchAccountActionWithTimeout(
        "/api/pages/ingest?action=generate"
      );
      const data = await res.json();
      if (res.ok && data.ok) {
        setApiKey(data.apiKey);
        setApiKeyNotice("已生成新密钥（旧密钥已失效）。");
      } else {
        setApiKeyNotice(data.error ?? "生成失败。");
      }
    } catch (error) {
      setApiKeyNotice(
        getAccountActionFailureMessage(
          error,
          "生成密钥请求超时；旧密钥和本地数据未改变，可稍后重试。",
          "网络错误。"
        )
      );
    } finally {
      setApiKeyBusy(false);
    }
  }

  async function handleLogout() {
    setBusy(true);
    try {
      await fetchAccountActionWithTimeout("/api/account/logout", {
        method: "POST",
      });
    } catch {
      // Cookie may already be gone; fall through to the signed-out view.
    } finally {
      setAccount(null);
      setDisplayNameInput("");
      clearAccountSessionCache({ clearLastAuthenticated: true });
      notifyAccountProfileUpdated();
      setNotice(null);
      setPhase("email");
      setBusy(false);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-zinc-50/40 dark:bg-zinc-950">
        <div className="mx-auto max-w-2xl px-8 py-10">
          <h1 className="flex items-center gap-2.5 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            <span className="text-3xl">👤</span> 账号
          </h1>
          <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
            邮箱验证码登录。只在新设备上需要验证一次，之后 90
            天内自动保持登录；持续使用会自动续期。
          </p>

          <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            {phase === "loading" && (
              <p className="text-sm text-zinc-500">正在检查登录状态…</p>
            )}

            {phase === "unconfigured" && (
              <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  账号系统尚未开通
                </p>
                <p>
                  需要管理员在部署平台配置邮件服务（RESEND_API_KEY）和受邀邮箱名单
                  （ZHINOTES_ACCOUNT_ALLOWED_EMAILS）后才会生效。配置前本页面不会
                  发送任何邮件，也不会写入任何云端数据。
                </p>
              </div>
            )}

            {phase === "error" && (
              <div className="space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
                <p>无法检查登录状态，请稍后重试。</p>
                <button
                  onClick={() => void refreshSession()}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  重试
                </button>
              </div>
            )}

            {phase === "email" && (
              <div className="space-y-4">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  邮箱
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && email && !busy) {
                        void handleSendCode();
                      }
                    }}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </label>
                <button
                  onClick={() => void handleSendCode()}
                  disabled={busy || !email.includes("@")}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                >
                  {busy ? "发送中…" : "发送验证码"}
                </button>
                <p className="text-xs text-zinc-400">
                  仅受邀邮箱可以登录。验证码 10 分钟内有效。
                </p>
              </div>
            )}

            {phase === "code" && (
              <div className="space-y-4">
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  验证码已发送到 <span className="font-medium">{email}</span>
                </p>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  6 位验证码
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(e) =>
                      setCode(e.target.value.replace(/\D/g, ""))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && code.length === 6 && !busy) {
                        void handleVerify();
                      }
                    }}
                    placeholder="000000"
                    autoComplete="one-time-code"
                    className="mt-1.5 w-40 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-center font-mono text-lg tracking-widest text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void handleVerify()}
                    disabled={busy || code.length !== 6}
                    className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                  >
                    {busy ? "验证中…" : "登录"}
                  </button>
                  <button
                    onClick={() => {
                      setCode("");
                      setNotice(null);
                      setPhase("email");
                    }}
                    disabled={busy}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    换个邮箱
                  </button>
                </div>
              </div>
            )}

            {phase === "signed-in" && account && (
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-lg dark:bg-emerald-900/40">
                    ✓
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      已登录：{formatClientAccountLabel(account)}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {account.email_hint} · 注册于{" "}
                      {new Date(account.createdAt).toLocaleDateString("zh-CN")}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                  <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    用户名
                    <div className="mt-1.5 flex items-center gap-2">
                      <input
                        type="text"
                        value={displayNameInput}
                        onChange={(e) => setDisplayNameInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !profileBusy) {
                            void handleDisplayNameSave();
                          }
                        }}
                        maxLength={32}
                        placeholder="输入你想显示的名字"
                        className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                      />
                      <button
                        onClick={() => void handleDisplayNameSave()}
                        disabled={
                          profileBusy ||
                          displayNameInput.trim() === account.display_name
                        }
                        className="shrink-0 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                      >
                        {profileBusy ? "保存中…" : "保存"}
                      </button>
                    </div>
                  </label>
                  <p className="mt-2 text-[11px] leading-5 text-zinc-400">
                    保存后，左侧栏会显示这个用户名；每个邮箱账号可以有自己的用户名。
                  </p>
                  {profileNotice && (
                    <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                      {profileNotice}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => void handleLogout()}
                  disabled={busy}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  退出登录
                </button>
              </div>
            )}

            {notice && (
              <p className="mt-4 text-sm text-amber-600 dark:text-amber-400">
                {notice}
              </p>
            )}
          </div>

          {phase === "signed-in" && (
            <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                持仓共享
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                把你的组合管理数据共享给指定邮箱（只读）。对方需要在登录白名单内。
              </p>

              <div className="mt-4 flex items-center gap-2">
                <input
                  type="email"
                  value={shareInput}
                  onChange={(e) => setShareInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !shareBusy) void handleShareAdd();
                  }}
                  placeholder="friend@example.com"
                  className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
                <button
                  onClick={() => void handleShareAdd()}
                  disabled={shareBusy || !shareInput.includes("@")}
                  className="rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                >
                  共享
                </button>
              </div>

              {shareNotice && (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                  {shareNotice}
                </p>
              )}

              {shareMembers.length > 0 && (
                <ul className="mt-4 space-y-1.5">
                  {shareMembers.map((email) => (
                    <li
                      key={email}
                      className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200"
                    >
                      <span className="truncate">{email}</span>
                      <button
                        onClick={() => void handleShareRemove(email)}
                        disabled={shareBusy}
                        className="ml-3 shrink-0 text-xs text-zinc-400 hover:text-rose-500"
                      >
                        移除
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {sharedWithMe.length > 0 && (
                <div className="mt-5 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    共享给我的持仓
                  </p>
                  <ul className="mt-2 space-y-1">
                    {sharedWithMe.map((email) => (
                      <li
                        key={email}
                        className="text-sm text-zinc-600 dark:text-zinc-300"
                      >
                        {email} —— 在组合管理页右上角可切换查看
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {phase === "signed-in" && cloudUploadReliabilityReport && (
            <AccountCloudUploadReliabilityCard
              report={cloudUploadReliabilityReport}
              onRefresh={() => void refreshCloudUploadReliability()}
            />
          )}

          {phase === "signed-in" && (
            <AccountHotCachePreferenceCard
              preferences={hotCachePreferences}
              hasSavedSetting={hotCacheSettingSaved}
              busy={hotCachePreferenceBusy}
              notice={hotCachePreferenceNotice}
              warmupBusy={hotCacheRouteWarmupBusy}
              warmupNotice={hotCacheRouteWarmupNotice}
              onChange={(patch) => void handleHotCachePreferencesChange(patch)}
              onWarmup={() => handleHotCacheRouteWarmup()}
            />
          )}

          {phase === "signed-in" && (
            <AccountCloudCoverageCard
              pageSyncOn={pageSyncOn}
              databaseSyncOn={databaseSyncOn}
              pagePendingStatus={pagePendingStatus}
              databasePendingStatus={databasePendingStatus}
              fileEmbedPendingStatus={fileEmbedPendingStatus}
              syncSummary={syncSummary}
              onOpenSyncCenter={() =>
                router.push("/modules/sync#cloud-source-of-truth-plan")
              }
            />
          )}

          {phase === "signed-in" && (
            <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    页面云同步
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">
                    默认开启：云端是页面主库，本机浏览器只是可重建缓存。页面与会议安排
                    （标题、正文、层级、属性、封面）跟随账号同步，登录同一账号的两个域名
                    / 多台设备会自动保持一致。切换标签页或几秒内即会自动对齐，也可手动同步。
                  </p>
                </div>
                <button
                  onClick={handlePageSyncToggle}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                    pageSyncOn
                      ? "bg-emerald-500"
                      : "bg-zinc-300 dark:bg-zinc-700"
                  }`}
                  role="switch"
                  aria-checked={pageSyncOn}
                  title={pageSyncOn ? "关闭页面云同步" : "开启页面云同步"}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                      pageSyncOn ? "left-[22px]" : "left-0.5"
                    }`}
                  />
                </button>
              </div>

              {pageSyncOn && (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => void handlePageSyncRun()}
                    disabled={
                      pageSyncBusy ||
                      dailyRepairBusy ||
                      dailyPullBusy ||
                      pageCacheRebuildBusy
                    }
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    {pageSyncBusy ? "同步中…" : "立即同步"}
                  </button>
                  <button
                    onClick={() => void handleDailyRepairRun()}
                    disabled={
                      pageSyncBusy ||
                      dailyRepairBusy ||
                      dailyPullBusy ||
                      pageCacheRebuildBusy
                    }
                    className="rounded-lg border border-amber-300 px-3 py-1.5 text-sm text-amber-700 hover:bg-amber-50 disabled:opacity-40 dark:border-amber-700/70 dark:text-amber-300 dark:hover:bg-amber-900/20"
                  >
                    {dailyRepairBusy ? "修复中…" : "修复每日纪要归档"}
                  </button>
                  <button
                    onClick={() => void handleDailyForcePullRun()}
                    disabled={
                      pageSyncBusy ||
                      dailyRepairBusy ||
                      dailyPullBusy ||
                      pageCacheRebuildBusy
                    }
                    className="rounded-lg border border-sky-300 px-3 py-1.5 text-sm text-sky-700 hover:bg-sky-50 disabled:opacity-40 dark:border-sky-700/70 dark:text-sky-300 dark:hover:bg-sky-900/20"
                  >
                    {dailyPullBusy ? "拉取中…" : "强制拉取每日纪要"}
                  </button>
                  <button
                    onClick={() => void handlePageCacheRebuildRun()}
                    disabled={
                      pageSyncBusy ||
                      dailyRepairBusy ||
                      dailyPullBusy ||
                      pageCacheRebuildBusy ||
                      Boolean(pageCacheRebuildGateNotice)
                    }
                    className="rounded-lg border border-violet-300 px-3 py-1.5 text-sm text-violet-700 hover:bg-violet-50 disabled:opacity-40 dark:border-violet-700/70 dark:text-violet-300 dark:hover:bg-violet-900/20"
                  >
                    {pageCacheRebuildBusy ? "重建中…" : "重建本机页面缓存"}
                  </button>
                  {pageSyncLastAt && (
                    <span className="text-xs text-zinc-400">
                      上次同步：
                      {new Date(pageSyncLastAt).toLocaleString("zh-CN")}
                    </span>
                  )}
                </div>
              )}

              <AccountCacheRebuildGateNotice
                testId="account-page-cache-rebuild-gate"
                label="页面缓存重建门禁"
                blocker={pageCacheRebuildGateNotice}
                readyText="页面 pending、failed、manual review 均为 0，可以进入二次确认。"
              />

              {pageSyncNotice && (
                <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
                  {pageSyncNotice}
                </p>
              )}

              <p className="mt-3 text-[11px] leading-5 text-zinc-400">
                页面同步本身不上传：数据库表格、本地文件、评论、版本历史。同步走你自己的
                Upstash 云存储，只有登录此账号的浏览器能读取。冲突时保留较新的修改。
                本机页面缓存可随时重建，不会删除云端真数据；但重建前会重新检查页面
                pending queue、文件上传队列、失败记录和人工处理记录，未上传或失败输入清零前会被拦截。
                数据库表格由下方独立同步面板管理。
              </p>
            </div>
          )}

          {phase === "signed-in" && (
            <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    数据库云同步
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">
                    默认开启：云端作为数据库主库，本机浏览器只做可重建缓存。同步范围包括
                    数据库结构、字段、视图和行值。需要时可以暂停同步、上传本机待同步变更，
                    或按云端主库重建本机数据库缓存。
                  </p>
                </div>
                <button
                  onClick={handleDatabaseSyncToggle}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                    databaseSyncOn
                      ? "bg-emerald-500"
                      : "bg-zinc-300 dark:bg-zinc-700"
                  }`}
                  role="switch"
                  aria-checked={databaseSyncOn}
                  title={databaseSyncOn ? "关闭数据库云同步" : "开启数据库云同步"}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                      databaseSyncOn ? "left-[22px]" : "left-0.5"
                    }`}
                  />
                </button>
              </div>

              {databaseSyncOn && (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => void handleDatabaseSyncRun()}
                    disabled={
                      databaseSyncBusy ||
                      databasePushBusy ||
                      databaseCacheRebuildBusy
                    }
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    {databaseSyncBusy ? "同步中…" : "立即同步数据库"}
                  </button>
                  <button
                    onClick={() => void handleDatabasePushRun()}
                    disabled={
                      databaseSyncBusy ||
                      databasePushBusy ||
                      databaseCacheRebuildBusy
                    }
                    className="rounded-lg border border-sky-300 px-3 py-1.5 text-sm text-sky-700 hover:bg-sky-50 disabled:opacity-40 dark:border-sky-700/70 dark:text-sky-300 dark:hover:bg-sky-900/20"
                  >
                    {databasePushBusy ? "上传中…" : "上传待同步变更"}
                  </button>
                  <button
                    onClick={() => void handleDatabaseCacheRebuildRun()}
                    disabled={
                      databaseSyncBusy ||
                      databasePushBusy ||
                      databaseCacheRebuildBusy ||
                      Boolean(databaseCacheRebuildGateNotice)
                    }
                    className="rounded-lg border border-violet-300 px-3 py-1.5 text-sm text-violet-700 hover:bg-violet-50 disabled:opacity-40 dark:border-violet-700/70 dark:text-violet-300 dark:hover:bg-violet-900/20"
                  >
                    {databaseCacheRebuildBusy ? "重建中…" : "重建本机数据库缓存"}
                  </button>
                  {databaseSyncLastAt && (
                    <span className="text-xs text-zinc-400">
                      上次数据库同步：
                      {new Date(databaseSyncLastAt).toLocaleString("zh-CN")}
                    </span>
                  )}
                </div>
              )}

              <AccountCacheRebuildGateNotice
                testId="account-database-cache-rebuild-gate"
                label="数据库缓存重建门禁"
                blocker={databaseCacheRebuildGateNotice}
                readyText="数据库 pending、failed、manual review 均为 0，可以进入二次确认。"
              />

              {databaseSyncNotice && (
                <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
                  {databaseSyncNotice}
                </p>
              )}

              <p className="mt-3 text-[11px] leading-5 text-zinc-400">
                这相当于把数据库主账本放到云端保险柜，本机只保留复印件。复印件坏了可以清掉重拉；
                手动上传只会提交本机明确记录过的待同步修改，不会把整份本机缓存覆盖到云端。
                重建前会重新检查 database pending queue、本地 sync_log、文件上传队列、失败记录和人工处理记录，
                未上传或失败的数据库变更清零前会被拦截。
              </p>
            </div>
          )}

          {phase === "signed-in" && (
            <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                API 密钥
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                用于外部工具（如 Claude、浏览器扩展）通过 API 保存内容到 ZhiNotes。
              </p>

              {apiKey ? (
                <div className="mt-3 flex items-center gap-2">
                  <code className="flex-1 truncate rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                    {apiKey}
                  </code>
                  <button
                    onClick={() => {
                      void navigator.clipboard.writeText(apiKey);
                      setApiKeyNotice("已复制到剪贴板。");
                      setTimeout(() => setApiKeyNotice(null), 2000);
                    }}
                    className="shrink-0 rounded-lg border border-zinc-300 px-3 py-2 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    复制
                  </button>
                </div>
              ) : (
                <p className="mt-3 text-xs text-zinc-500">尚未生成密���。</p>
              )}

              <button
                onClick={() => void handleGenerateApiKey()}
                disabled={apiKeyBusy}
                className="mt-3 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {apiKeyBusy
                  ? "生成中…"
                  : apiKey
                    ? "重新生成（旧密钥失效）"
                    : "生成 API 密钥"}
              </button>

              {apiKeyNotice && (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                  {apiKeyNotice}
                </p>
              )}

              <p className="mt-3 text-[11px] leading-5 text-zinc-400">
                使用方法：POST /api/pages/ingest，Header 加上 Authorization: Bearer
                你的密钥，Body 传 {`{title, content}`}。保存的内容默认进入「每日纪要」
                当天那一栏；浏览器扩展可在设置里填入此密钥。
              </p>
            </div>
          )}

          <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            <p className="font-medium text-zinc-900 dark:text-zinc-100">
              账号能做什么
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>登录后，组合管理的数据自动跟随账号云同步，任何设备登录都能看到同一份。</li>
              <li>可以把持仓共享给指定邮箱（只读），对方登录后即可查看。</li>
              <li>页面与会议安排默认实时云同步，登录同一账号的设备自动保持一致，可随时关闭。</li>
              <li>数据库云同步默认开启，数据库结构和行值跟随账号同步，本机缓存可随时重建。</li>
              <li>生成 API 密钥后，可用外部工具（Claude 等）或浏览器扩展一键保存内容到 ZhiNotes。</li>
              <li>本地文件、评论、版本历史仍只存在本机浏览器，不会上传。</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}

function AccountCloudCoverageCard({
  pageSyncOn,
  databaseSyncOn,
  pagePendingStatus,
  databasePendingStatus,
  fileEmbedPendingStatus,
  syncSummary,
  onOpenSyncCenter,
}: {
  pageSyncOn: boolean;
  databaseSyncOn: boolean;
  pagePendingStatus: PendingCloudPageSyncStatus | null;
  databasePendingStatus: PendingCloudDatabaseSyncStatus | null;
  fileEmbedPendingStatus: PendingFileEmbedSyncStatus | null;
  syncSummary: SyncLogSummary | null;
  onOpenSyncCenter: () => void;
}) {
  const pagePending = pagePendingStatus
    ? pagePendingStatus.pending +
      pagePendingStatus.queued +
      (pagePendingStatus.syncLogPending ?? 0)
    : null;
  const databasePending = databasePendingStatus
    ? databasePendingStatus.pending +
      databasePendingStatus.queued +
      (databasePendingStatus.syncLogPending ?? 0)
    : null;
  const filePending = fileEmbedPendingStatus
    ? fileEmbedPendingStatus.pending +
      fileEmbedPendingStatus.failed +
      fileEmbedPendingStatus.manualReviewCount
    : null;
  const globalPending = syncSummary?.pending ?? null;

  return (
    <div
      data-testid="account-cloud-coverage-map"
      className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            全域云端覆盖
          </p>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-400">
            目标状态是云端主库 + 本地热缓存：真实数据以云端为准，常用内容按你的选择留在本机提速。
            这张表只展示同步边界和队列状态，不读取正文、表格值或文件字节，也不会上传。
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenSyncCenter}
          className="w-fit rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          打开同步中心
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <AccountCloudCoverageMetric
          label="页面队列"
          value={
            pagePending === null
              ? "检查中"
              : pageSyncOn
                ? `${pagePending} 条`
                : "已关闭"
          }
          detail="pending + 内存排队"
        />
        <AccountCloudCoverageMetric
          label="数据库队列"
          value={
            databasePending === null
              ? "检查中"
              : databaseSyncOn
                ? `${databasePending} 条`
                : "已关闭"
          }
          detail="cloud key + sync_log"
        />
        <AccountCloudCoverageMetric
          label="全域 sync_log"
          value={globalPending === null ? "检查中" : `${globalPending} 条`}
          detail="其他待上传设置/关系"
        />
        <AccountCloudCoverageMetric
          label="文件队列"
          value={filePending === null ? "检查中" : `${filePending} 个`}
          detail="pending / failed / 人工"
        />
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        {accountCloudCoverageRows.map((row) => (
          <article
            key={row.id}
            className="rounded-lg border border-zinc-100 p-3 text-xs dark:border-zinc-800"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
                  {row.title}
                </h3>
                <p className="mt-1 leading-5 text-zinc-500 dark:text-zinc-400">
                  {row.scope}
                </p>
              </div>
              <AccountCloudCoveragePill status={row.status} />
            </div>
            <p className="mt-2 leading-5 text-zinc-400">{row.boundary}</p>
            <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
              下一步：{row.next}
            </p>
          </article>
        ))}
      </div>

      <p className="mt-4 text-[11px] leading-5 text-zinc-400">
        读法：绿色代表已经以云端为主库；黄色代表只接入白名单或 metadata；灰色代表仍需你明确确认后才会上云。
        如果这里还有 pending、failed 或人工处理项，先处理队列，再判断是否需要重建本机缓存。
      </p>
    </div>
  );
}

function AccountCloudCoverageMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <p className="text-[11px] text-zinc-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {value}
      </p>
      <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
        {detail}
      </p>
    </div>
  );
}

function AccountCloudCoveragePill({
  status,
}: {
  status: AccountCloudCoverageStatus;
}) {
  const label: Record<AccountCloudCoverageStatus, string> = {
    "cloud-ready": "云端主库",
    partial: "部分接入",
    "local-only": "仍在本地",
  };
  const classes: Record<AccountCloudCoverageStatus, string> = {
    "cloud-ready":
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    partial:
      "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    "local-only": "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  };

  return (
    <span
      className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-medium ${classes[status]}`}
    >
      {label[status]}
    </span>
  );
}

function AccountCacheRebuildGateNotice({
  testId,
  label,
  blocker,
  readyText,
}: {
  testId: string;
  label: string;
  blocker: string | null;
  readyText: string;
}) {
  return (
    <div
      data-testid={testId}
      data-cache-rebuild-ready={blocker ? "false" : "true"}
      className={`mt-4 rounded-lg border p-3 text-xs ${
        blocker
          ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700/70 dark:bg-amber-950/20 dark:text-amber-200"
          : "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700/70 dark:bg-emerald-950/20 dark:text-emerald-200"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{label}</span>
        <span className="rounded-full border border-current px-2 py-0.5 text-[11px]">
          {blocker ? "未通过" : "已通过"}
        </span>
      </div>
      <p className="mt-2 leading-5">{blocker ?? readyText}</p>
    </div>
  );
}

function AccountCloudUploadReliabilityCard({
  report,
  onRefresh,
}: {
  report: CloudUploadReliabilityReport;
  onRefresh: () => void;
}) {
  const primaryBlocker = report.gates.find((gate) => gate.status === "block");
  const primaryWarning = report.gates.find((gate) => gate.status === "warn");
  const primaryGate = primaryBlocker ?? primaryWarning ?? report.gates[0] ?? null;

  return (
    <section
      data-testid="account-cloud-upload-reliability"
      data-cloud-upload-status={report.status}
      className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
      title={report.privacy_boundary}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              本地输入上云健康
            </p>
            <AccountCloudUploadReliabilityStatusPill status={report.status} />
          </div>
          <p className="mt-1 text-xs leading-5 text-zinc-400">
            只读队列账本 · 不触发上传 · safe_to_switch_device_now:{" "}
            {report.summary.safe_to_switch_device_now ? "true" : "false"}
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="w-fit rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          刷新状态
        </button>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <AccountCloudUploadReliabilityFact
          label="待上传"
          value={String(report.summary.total_waiting_rows)}
          detail={`${report.summary.page_waiting_rows} 页面 · ${report.summary.database_waiting_rows} 数据库 · ${report.summary.file_waiting_rows} 文件 · ${report.summary.sync_log_pending_rows} sync_log`}
        />
        <AccountCloudUploadReliabilityFact
          label="失败"
          value={String(report.summary.failed_rows)}
          detail={`${report.summary.manual_review_rows} 条需要人工复核`}
        />
        <AccountCloudUploadReliabilityFact
          label="最早排队"
          value={report.summary.oldest_pending_age_label}
          detail={report.summary.oldest_pending_queued_at ?? "暂无待上传"}
        />
        <AccountCloudUploadReliabilityFact
          label="账号重试"
          value={report.summary.auth_retry_active ? "等待重试" : "无"}
          detail={report.summary.auth_retry_state_label}
        />
        <AccountCloudUploadReliabilityFact
          label="继续输入"
          value={report.summary.safe_to_keep_typing ? "可以" : "先处理"}
          detail={report.summary.local_input_buffered ? "本机仍先保存" : "本机缓冲异常"}
        />
        <AccountCloudUploadReliabilityFact
          label="切换设备"
          value={report.summary.safe_to_switch_device_now ? "可以" : "等待"}
          detail="pending 清零后最稳"
        />
      </div>

      {primaryGate ? (
        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50/70 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-950/50">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              当前重点：{primaryGate.title}
            </span>
            <AccountCloudUploadReliabilityGatePill status={primaryGate.status} />
          </div>
          <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
            {primaryGate.evidence}
          </p>
          <p className="mt-1 leading-5 text-zinc-400">
            下一步：{primaryGate.next_action}
          </p>
        </div>
      ) : null}

      <p className="mt-3 text-[11px] leading-5 text-zinc-400">
        {report.next_action}
      </p>
    </section>
  );
}

function AccountHotCachePreferenceCard({
  preferences,
  hasSavedSetting,
  busy,
  notice,
  warmupBusy,
  warmupNotice,
  onChange,
  onWarmup,
}: {
  preferences: HotCachePreferences;
  hasSavedSetting: boolean;
  busy: boolean;
  notice: string | null;
  warmupBusy: boolean;
  warmupNotice: string | null;
  onChange: (patch: Partial<HotCachePreferences>) => void;
  onWarmup: () => void;
}) {
  const metadataWindow = metadataRecentLimitForHotCachePreferences(preferences);
  const enabledCount = countEnabledHotCachePreferences(preferences);
  const routeTargetCount = getHotCacheRouteTargets(preferences).length;
  const handleRecentDaysChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onChange({ recentDays: event.target.value === "90" ? 90 : 30 });
  };

  return (
    <section
      data-testid="account-hot-cache-preferences"
      data-hot-cache-recent-days={preferences.recentDays}
      data-hot-cache-metadata-window={metadataWindow}
      data-hot-cache-saved-setting={hasSavedSetting ? "true" : "false"}
      className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            选择性本地缓存
          </p>
          <p className="mt-1 text-xs leading-5 text-zinc-400">
            云端是主库，本机只保留你选中的常用入口副本。这里只保存偏好
            metadata，不读取正文、文件或行值，不清理本地缓存。
          </p>
        </div>
        <span className="w-fit rounded-md bg-zinc-100 px-2.5 py-1 text-[11px] text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
          {hasSavedSetting ? "已自定义" : "默认策略"}
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <AccountCloudUploadReliabilityFact
          label="最近范围"
          value={`${preferences.recentDays} 天`}
          detail="影响常用入口优先级"
        />
        <AccountCloudUploadReliabilityFact
          label="Metadata 窗口"
          value={`${metadataWindow} 条`}
          detail="只拉轻量列表，不拉全文"
        />
        <AccountCloudUploadReliabilityFact
          label="开启项目"
          value={`${enabledCount}/7`}
          detail={`指定数据库 ${preferences.pinnedDatabaseIds.length} 个`}
        />
      </div>

      <div
        data-testid="account-hot-cache-route-warmup"
        data-hot-cache-route-targets={routeTargetCount}
        className="mt-4 flex flex-col gap-2 rounded-lg border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-950/40 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <p className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
            常用入口预热
          </p>
          <p className="mt-1 text-[11px] leading-5 text-zinc-400">
            按当前选择预热 {routeTargetCount} 个入口。只做 route prefetch，不读取正文、不上传、不写 sync_log。
          </p>
        </div>
        <button
          type="button"
          onClick={onWarmup}
          disabled={warmupBusy}
          className="w-fit shrink-0 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-white disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          {warmupBusy ? "预热中…" : "预热入口"}
        </button>
      </div>

      <label className="mt-4 block text-xs font-medium text-zinc-600 dark:text-zinc-300">
        最近内容范围
        <select
          value={String(preferences.recentDays)}
          onChange={handleRecentDaysChange}
          disabled={busy}
          className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        >
          <option value="30">最近 30 天</option>
          <option value="90">最近 90 天</option>
        </select>
      </label>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <AccountHotCachePreferenceCheckbox
          label="当前月每日纪要"
          checked={preferences.keepCurrentMonthDailyNotes}
          disabled={busy}
          onChange={(checked) =>
            onChange({ keepCurrentMonthDailyNotes: checked })
          }
        />
        <AccountHotCachePreferenceCheckbox
          label="当前月会议"
          checked={preferences.keepCurrentMonthMeetings}
          disabled={busy}
          onChange={(checked) =>
            onChange({ keepCurrentMonthMeetings: checked })
          }
        />
        <AccountHotCachePreferenceCheckbox
          label="打开过的数据库"
          checked={preferences.keepActiveDatabases}
          disabled={busy}
          onChange={(checked) => onChange({ keepActiveDatabases: checked })}
        />
        <AccountHotCachePreferenceCheckbox
          label="最近文件预览 metadata"
          checked={preferences.keepRecentFilePreviews}
          disabled={busy}
          onChange={(checked) =>
            onChange({ keepRecentFilePreviews: checked })
          }
        />
        <AccountHotCachePreferenceCheckbox
          label="收藏页面"
          checked={preferences.keepFavoritePages}
          disabled={busy}
          onChange={(checked) => onChange({ keepFavoritePages: checked })}
        />
        <AccountHotCachePreferenceCheckbox
          label="当前项目"
          checked={preferences.keepCurrentProjects}
          disabled={busy}
          onChange={(checked) => onChange({ keepCurrentProjects: checked })}
        />
      </div>

      <p className="mt-3 text-[11px] leading-5 text-zinc-400">
        指定数据库仍在同步中心管理。账号页只放最常用的缓存选择，避免把低频高级设置挤进主流程。
      </p>

      {notice ? (
        <p className="mt-3 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-amber-600 dark:bg-zinc-950 dark:text-amber-400">
          {notice}
        </p>
      ) : null}
      {warmupNotice ? (
        <p className="mt-2 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
          {warmupNotice}
        </p>
      ) : null}
    </section>
  );
}

function AccountHotCachePreferenceCheckbox({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50/70 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-200">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-zinc-300 text-zinc-900 disabled:opacity-50 dark:border-zinc-700"
      />
    </label>
  );
}

function countEnabledHotCachePreferences(
  preferences: HotCachePreferences
): number {
  return [
    preferences.keepCurrentMonthDailyNotes,
    preferences.keepCurrentMonthMeetings,
    preferences.keepActiveDatabases,
    preferences.keepRecentFilePreviews,
    preferences.keepFavoritePages,
    preferences.keepCurrentProjects,
    preferences.pinnedDatabaseIds.length > 0,
  ].filter(Boolean).length;
}

function AccountCloudUploadReliabilityFact({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/40">
      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">
        {label}
      </p>
      <p className="mt-1 text-base font-semibold text-zinc-900 dark:text-zinc-100">
        {value}
      </p>
      <p className="mt-1 truncate text-[11px] text-zinc-400" title={detail}>
        {detail}
      </p>
    </div>
  );
}

function AccountCloudUploadReliabilityStatusPill({
  status,
}: {
  status: CloudUploadReliabilityStatus;
}) {
  const labels: Record<CloudUploadReliabilityStatus, string> = {
    ready: "可靠",
    watch: "观察中",
    "needs-attention": "需处理",
    blocked: "阻断",
  };
  const className =
    status === "ready"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
      : status === "watch"
        ? "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
        : status === "needs-attention"
          ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
          : "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300";

  return (
    <span className={`rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[status]}
    </span>
  );
}

function AccountCloudUploadReliabilityGatePill({
  status,
}: {
  status: CloudUploadReliabilityGateStatus;
}) {
  const labels: Record<CloudUploadReliabilityGateStatus, string> = {
    pass: "通过",
    warn: "提醒",
    block: "阻断",
  };
  const className =
    status === "pass"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
      : status === "warn"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300";

  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${className}`}>
      {labels[status]}
    </span>
  );
}
