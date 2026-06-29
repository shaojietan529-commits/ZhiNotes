"use client";

// Email-code login surface for the multi-account system. Shows a clear
// "not configured" state until the owner enables Resend + the allowlist,
// so this page is safe to ship ahead of the cloud rollout.

import { useCallback, useEffect, useMemo, useState } from "react";
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
  forcePullDailyCloudPages,
  getLastPageSyncAt,
  getPendingCloudPageSyncStatus,
  isPageSyncEnabled,
  reconcilePageSync,
  rebuildPageCacheFromCloud,
  setPageSyncEnabled,
  type PendingCloudPageSyncStatus,
} from "@/lib/pages/accountPageSync";
import {
  notifyAccountProfileUpdated,
  type ClientAccountInfo,
} from "@/lib/account/clientProfile";
import {
  clearAccountSessionCache,
  fetchAccountSession,
} from "@/lib/account/clientSession";
import {
  DATABASE_SYNC_STATUS_EVENT,
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
  buildCloudUploadReliabilityReport,
  type CloudUploadReliabilityGateStatus,
  type CloudUploadReliabilityReport,
  type CloudUploadReliabilityStatus,
} from "@/lib/sync/cloudUploadReliabilityReport";
import {
  getSyncLogSummary,
  getWorkspaceSetting,
  upsertWorkspaceSetting,
  type SyncLogSummary,
} from "@/lib/db/local/queries";
import {
  DEFAULT_HOT_CACHE_PREFERENCES,
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

function getPageCacheRebuildPendingBlocker(): string | null {
  const status = getPendingCloudPageSyncStatus();
  const pending = status.pending + status.queued;
  if (pending === 0) return null;
  return `页面仍有 ${pending} 条待上传/内存排队变更。为避免未上传输入在重建本机缓存时被隐藏，请先点击“立即同步”，确认页面 pending 清零后再重建。`;
}

async function getDatabaseCacheRebuildPendingBlocker(): Promise<string | null> {
  const status = await getPendingCloudDatabaseSyncStatus();
  const pending = status.pending + status.queued + status.syncLogPending;
  if (pending === 0) return null;
  return `数据库仍有 ${pending} 条待上传变更（cloud key ${status.pending} 条、内存排队 ${status.queued} 条、本地 sync_log ${status.syncLogPending} 条）。为避免本机新输入被云端旧 manifest 隐藏，请先“上传待同步变更”或“立即同步数据库”，确认 pending 清零后再重建。`;
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

  useEffect(() => {
    setPageSyncOn(isPageSyncEnabled());
    setPageSyncLastAt(getLastPageSyncAt());
    setDatabaseSyncOn(isDatabaseSyncEnabled());
    setDatabaseSyncLastAt(getLastDatabaseSyncAt());
  }, []);

  const refreshCloudUploadReliability = useCallback(async () => {
    const [databaseStatus, localSyncSummary] = await Promise.all([
      getPendingCloudDatabaseSyncStatus(),
      getSyncLogSummary().catch(() => null),
    ]);
    setPagePendingStatus(getPendingCloudPageSyncStatus());
    setDatabasePendingStatus(databaseStatus);
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
    window.addEventListener(PAGE_SYNC_STATUS_EVENT, handleSyncStatus);
    window.addEventListener(DATABASE_SYNC_STATUS_EVENT, handleSyncStatus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener(PAGE_SYNC_STATUS_EVENT, handleSyncStatus);
      window.removeEventListener(DATABASE_SYNC_STATUS_EVENT, handleSyncStatus);
    };
  }, [phase, refreshCloudUploadReliability]);

  const cloudUploadReliabilityReport = useMemo(() => {
    if (!pagePendingStatus || !databasePendingStatus) return null;
    return buildCloudUploadReliabilityReport({
      pageStatus: pagePendingStatus,
      databaseStatus: databasePendingStatus,
      syncSummary,
      workspaceIdentity,
    });
  }, [
    databasePendingStatus,
    pagePendingStatus,
    syncSummary,
    workspaceIdentity,
  ]);

  const refreshHotCachePreferences = useCallback(async () => {
    const setting = await getWorkspaceSetting(HOT_CACHE_PREFERENCES_SETTING_KEY);
    setHotCacheSettingSaved(Boolean(setting));
    setHotCachePreferences(parseHotCachePreferences(setting));
  }, []);

  useEffect(() => {
    if (phase !== "signed-in") return;
    void refreshHotCachePreferences();
  }, [phase, refreshHotCachePreferences]);

  const setSignedInAccount = useCallback((nextAccount: ClientAccountInfo) => {
    setAccount(nextAccount);
    setDisplayNameInput(nextAccount.display_name);
    notifyAccountProfileUpdated();
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const session = await fetchAccountSession({ force: true });
      if (session.status === "unconfigured") {
        setPhase("unconfigured");
        return;
      }
      if (session.status === "error") {
        setPhase("error");
        return;
      }
      if (session.authenticated && session.account) {
        setSignedInAccount(session.account);
        setPhase("signed-in");
      } else {
        setPhase("email");
      }
    } catch {
      setPhase("error");
    }
  }, [setSignedInAccount]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  // Load sharing lists once signed in.
  useEffect(() => {
    if (phase !== "signed-in") return;
    void fetchShares().then((result) => {
      if (result.status === "ok") {
        setShareMembers(result.data.members);
        setSharedWithMe(result.data.sharedWithMe);
      }
    });
    // Load existing API key
    void fetch("/api/pages/ingest?action=current")
      .then((r) => r.json())
      .then((d) => { if (d.ok) setApiKey(d.apiKey); })
      .catch(() => {});
  }, [phase]);

  async function handleShareAdd() {
    const email = shareInput.trim().toLowerCase();
    if (!email.includes("@")) return;
    setShareBusy(true);
    setShareNotice(null);
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
    setShareBusy(false);
  }

  async function handleShareRemove(email: string) {
    setShareBusy(true);
    setShareNotice(null);
    const result = await removeShareEmail(email);
    if (result.status === "ok") {
      setShareMembers(result.data);
    } else {
      setShareNotice("移除失败，请稍后重试。");
    }
    setShareBusy(false);
  }

  async function handlePageSyncRun() {
    setPageSyncBusy(true);
    setPageSyncNotice(null);
    const result = await reconcilePageSync();
    if (result.status === "ok") {
      setPageSyncLastAt(getLastPageSyncAt());
      setPageSyncNotice(
        `同步完成：拉取 ${result.pulled} 页，修复归档 ${result.repaired ?? 0} 页，推送 ${result.pushed} 页。`
      );
    } else if (result.status === "unauthenticated") {
      setPageSyncNotice("登录已过期，请重新登录后再同步。");
    } else if (result.status === "disabled") {
      setPageSyncNotice("请先打开页面云同步开关。");
    } else {
      setPageSyncNotice(result.message ?? "同步失败，请稍后重试。");
    }
    setPageSyncBusy(false);
    void refreshCloudUploadReliability();
  }

  async function handleDailyRepairRun() {
    setDailyRepairBusy(true);
    setPageSyncNotice(null);
    try {
      const res = await fetch("/api/pages/account-sync", {
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
    } catch {
      setPageSyncNotice("网络错误，未能修复每日纪要归档。");
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
        setPageSyncNotice("登录已过期，请重新登录后再拉取每日纪要。");
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
    const pendingBlocker = getPageCacheRebuildPendingBlocker();
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
        setPageSyncNotice("登录已过期，请重新登录后再重建本机缓存。");
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
      const result = await reconcileDatabaseSync();
      if (result.status === "ok") {
        setDatabaseSyncLastAt(getLastDatabaseSyncAt());
        setDatabaseSyncNotice(
          `数据库同步完成：拉取 ${result.pulled} 条，推送 ${result.pushed} 条，远端跳过 ${result.skipped} 条。`
        );
      } else if (result.status === "unauthenticated") {
        setDatabaseSyncNotice("登录已过期，请重新登录后再同步数据库。");
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
        setDatabaseSyncNotice("登录已过期，请重新登录后再上传数据库。");
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
    const pendingBlocker = await getDatabaseCacheRebuildPendingBlocker();
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
        setDatabaseSyncNotice("登录已过期，请重新登录后再重建数据库缓存。");
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
      const res = await fetch("/api/account/login/start", {
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
    } catch {
      setNotice("网络错误，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify() {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/account/login/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice(data.error ?? "验证失败，请稍后重试。");
        return;
      }
      clearAccountSessionCache();
      setSignedInAccount(data.account as ClientAccountInfo);
      setCode("");
      setPhase("signed-in");
    } catch {
      setNotice("网络错误，请稍后重试。");
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
      const res = await fetch("/api/account/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ display_name: displayName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setProfileNotice(data.error ?? "用户名保存失败，请稍后重试。");
        return;
      }
      clearAccountSessionCache();
      setSignedInAccount(data.account as ClientAccountInfo);
      setProfileNotice("用户名已保存。");
    } catch {
      setProfileNotice("网络错误，请稍后重试。");
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
    const receipt = prefetchHotCacheRoutes(
      (routeTarget) => router.prefetch(routeTarget),
      preferences
    );
    setHotCacheRouteWarmupNotice(
      receipt.failed > 0
        ? `已尝试预热 ${receipt.attempted} 个入口，其中 ${receipt.failed} 个暂时失败；这只影响首次打开速度，不影响数据。`
        : `已预热 ${receipt.attempted} 个常用入口。只做 route prefetch，不读取正文、不上传、不写 sync_log。`
    );
    setHotCacheRouteWarmupBusy(false);
    return receipt;
  }

  async function handleGenerateApiKey() {
    setApiKeyBusy(true);
    setApiKeyNotice(null);
    try {
      const res = await fetch("/api/pages/ingest?action=generate");
      const data = await res.json();
      if (res.ok && data.ok) {
        setApiKey(data.apiKey);
        setApiKeyNotice("已生成新密钥（旧密钥已失效）。");
      } else {
        setApiKeyNotice(data.error ?? "生成失败。");
      }
    } catch {
      setApiKeyNotice("网络错误。");
    } finally {
      setApiKeyBusy(false);
    }
  }

  async function handleLogout() {
    setBusy(true);
    try {
      await fetch("/api/account/logout", { method: "POST" });
    } catch {
      // Cookie may already be gone; fall through to the signed-out view.
    } finally {
      setAccount(null);
      setDisplayNameInput("");
      clearAccountSessionCache();
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
                      已登录：{account.display_name}
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
                      pageCacheRebuildBusy
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

              {pageSyncNotice && (
                <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
                  {pageSyncNotice}
                </p>
              )}

              <p className="mt-3 text-[11px] leading-5 text-zinc-400">
                页面同步本身不上传：数据库表格、本地文件、评论、版本历史。同步走你自己的
                Upstash 云存储，只有登录此账号的浏览器能读取。冲突时保留较新的修改。
                本机页面缓存可随时重建，不会删除云端真数据；但重建前会重新检查页面
                pending queue，未上传输入清零前会被拦截。数据库表格由下方独立同步面板管理。
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
                      databaseCacheRebuildBusy
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

              {databaseSyncNotice && (
                <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
                  {databaseSyncNotice}
                </p>
              )}

              <p className="mt-3 text-[11px] leading-5 text-zinc-400">
                这相当于把数据库主账本放到云端保险柜，本机只保留复印件。复印件坏了可以清掉重拉；
                手动上传只会提交本机明确记录过的待同步修改，不会把整份本机缓存覆盖到云端。
                重建前会重新检查 database pending queue 和本地 sync_log，未上传数据库变更清零前会被拦截。
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

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <AccountCloudUploadReliabilityFact
          label="待上传"
          value={String(report.summary.total_waiting_rows)}
          detail={`${report.summary.page_waiting_rows} 页面 · ${report.summary.database_waiting_rows} 数据库 · ${report.summary.sync_log_pending_rows} sync_log`}
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
