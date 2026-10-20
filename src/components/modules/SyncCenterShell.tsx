"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { AlertCircle, ArrowRight, CheckCircle2, Cloud, Loader2, RefreshCw, WifiOff } from "lucide-react";
import Sidebar from "@/components/sidebar/Sidebar";
import { useAccountCloudSyncCoordinator } from "@/hooks/useAccountCloudSyncCoordinator";
import { buildSyncOverview, type SyncOverviewDomain } from "@/lib/sync/syncOverview";
import { useWorkspaceStore } from "@/stores/workspaceStore";

const AdvancedDiagnostics = dynamic(
  () => import("./SyncShell").then((module) => module.SyncDashboard),
  { ssr: false, loading: () => <p className="p-6 text-sm text-zinc-500">正在加载诊断…</p> }
);

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}
function readOnline() { return navigator.onLine; }
function serverOnline() { return true; }
function isAdvancedHash() {
  return typeof window !== "undefined" && Boolean(window.location.hash)
    && !/^#sync-(overview|domain-)/.test(window.location.hash);
}
function timeLabel(value?: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "暂无记录";
  return new Date(value).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function SyncCenterShell() {
  const sync = useAccountCloudSyncCoordinator();
  const online = useSyncExternalStore(subscribeOnline, readOnline, serverOnline);
  const sidebarOpen = useWorkspaceStore((state) => state.sidebarOpen);
  const [advanced, setAdvanced] = useState(isAdvancedHash);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState(false);
  useEffect(() => {
    const onHash = () => setAdvanced(isAdvancedHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const global = sync.globalSyncLog.status;
  const domains: SyncOverviewDomain[] = [
    ...([
      ["pages", "页面", sync.pageSync, sync.pagePendingTotal],
      ["databases", "数据库", sync.databaseSync, sync.databasePendingTotal],
    ] as const).map(([id, label, domain, pending]) => ({
      id, label, pending, failed: domain.pendingStatus.failed,
      manualReview: domain.pendingStatus.manualReviewCount,
      enabled: domain.pendingStatus.enabled,
      known: domain.pendingStatus.initialized && domain.pendingStatus.uniquePending !== undefined,
      syncing: domain.state === "syncing",
      auth: domain.pendingStatus.authRetryStatus
        ?? (domain.state === "signed-out" ? "unauthenticated" : domain.state === "error" ? "unconfirmed" : null),
      lastConfirmedAt: domain.lastSyncAt,
      oldestPendingAt: domain.pendingStatus.oldestPendingQueuedAt,
      failureMessage: domain.pendingStatus.lastFailureMessage,
    })),
    {
      id: "portfolio", label: "组合数据", pending: sync.portfolioPendingTotal,
      failed: sync.portfolioSync.status.failed, manualReview: sync.portfolioSync.status.manualReviewCount,
      enabled: Boolean(sync.portfolioSync.status.mode), known: true,
      syncing: sync.portfolioSync.status.queueState === "syncing",
      auth: sync.portfolioSync.status.authRetryStatus,
      readError: Boolean(sync.portfolioSync.status.storageError),
      lastConfirmedAt: sync.portfolioSync.status.lastAckAt,
      oldestPendingAt: sync.portfolioSync.status.lastQueuedAt,
      failureMessage: sync.portfolioSync.status.lastFailureMessage,
    },
    ...([
      ["settings", "偏好设置", sync.settingsSync],
      ["knowledge", "评论、版本与链接", sync.knowledgeSync],
    ] as const).map(([id, label, domain]) => ({
      id, label, pending: domain.status.totalPending, failed: domain.status.failed,
      manualReview: domain.status.manualReviewCount, enabled: domain.status.enabled,
      known: domain.health.initialized,
      readError: domain.health.readError, syncing: domain.status.inFlight > 0,
      oldestPendingAt: domain.status.oldestPendingAt,
      failureMessage: domain.status.lastFailureMessage,
    })),
    {
      id: "files", label: "文件附件", pending: sync.filePendingTotal,
      failed: sync.fileSync.status.failed, manualReview: sync.fileSync.status.manualReviewCount,
      enabled: sync.fileSync.status.enabled, known: true,
      auth: sync.fileSync.status.authRetryStatus,
      oldestPendingAt: sync.fileSync.status.oldestPendingQueuedAt,
      failureMessage: sync.fileSync.status.lastFailureMessage,
    },
    {
      id: "other", label: "其他记录", pending: sync.globalSyncLogExtraPendingTotal,
      failed: sync.globalSyncLogExtraFailedTotal, manualReview: sync.globalSyncLogExtraManualReviewTotal,
      enabled: true, known: global.initialized, readError: global.readError,
    },
  ];
  const overview = buildSyncOverview(domains, online);
  const requiresAction = overview.state === "attention" || overview.state === "signed-out";
  const Icon = !online ? WifiOff : requiresAction ? AlertCircle
    : overview.state === "idle" ? CheckCircle2 : Cloud;

  async function retry() {
    setRetrying(true);
    setRetryError(false);
    try {
      // Keep files and manual-review records behind their existing approval gates.
      await sync.syncNow({ includeFileSync: false, includeManualReview: false });
    } catch {
      setRetryError(true);
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar accountSync={sync} onOpenSyncCenter={() => setAdvanced(false)} />
      <main className={`min-w-0 flex-1 overflow-y-auto bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 ${sidebarOpen ? "max-md:hidden" : ""}`}>
        <header className="border-b border-zinc-200 px-4 pt-6 dark:border-zinc-800 sm:px-8">
          <div className="mx-auto max-w-5xl">
            <div className={`flex min-h-9 items-center ${sidebarOpen ? "" : "pl-12"}`}>
              <h1 className="text-xl font-semibold">云同步与权限</h1>
            </div>
            <nav aria-label="同步视图" className="mt-5 flex gap-6">
              {[[false, "同步状态"], [true, "高级诊断"]].map(([value, label]) => (
                <button key={String(value)} aria-current={advanced === value ? "page" : undefined}
                  onClick={() => setAdvanced(value as boolean)}
                  className={`border-b-2 pb-3 text-sm ${advanced === value ? "border-emerald-600 font-medium" : "border-transparent text-zinc-500"}`}>{label}</button>
              ))}
            </nav>
          </div>
        </header>
        {advanced ? <AdvancedDiagnostics /> : (
          <div id="sync-overview" className="mx-auto max-w-5xl px-4 py-6 sm:px-8" data-testid="sync-overview" data-state={overview.state}>
            <section aria-label="账号同步状态" className="border-b border-zinc-200 pb-6 dark:border-zinc-800">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <Icon size={24} className={`mt-0.5 shrink-0 ${requiresAction ? "text-amber-600" : "text-emerald-600"}`} />
                  <div>
                    <h2 className="text-lg font-medium" role="status">{overview.label}</h2>
                    <p className="mt-1 text-sm text-zinc-500" data-testid="sync-pending-total">
                      {overview.countsKnown ? `${overview.pending} 项待上传` : "待上传数量核对中"}
                    </p>
                  </div>
                </div>
                <button onClick={() => void retry()} disabled={!online || retrying}
                  className="inline-flex items-center gap-2 rounded border border-zinc-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-zinc-700">
                  {retrying ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  {retrying ? "正在检查" : "重试普通同步"}
                </button>
              </div>
              <div className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-sm text-zinc-500">
                <span>云端通知：{!online ? "离线" : sync.realtimeState === "connected" ? "已连接" : sync.realtimeState === "connecting" ? "连接中，定时检查仍开启" : "定时检查"}</span>
                <span>最近一次成功：{timeLabel(sync.lastSyncAt)}</span>
              </div>
              {retryError && <p role="alert" className="mt-3 text-sm text-amber-700">本次检查未完成，本地记录未改动。</p>}
            </section>
            <section aria-label="待上传分类" className="pt-5">
              <h2 className="mb-3 text-base font-medium">待上传分类</h2>
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {overview.rows.filter((row) => row.id !== "other" || row.pending || row.failed || row.manualReview || !row.known || row.readError).map((row) => (
                  <div key={row.id} id={`sync-domain-${row.id}`} data-testid={`sync-domain-${row.id}`} className="grid gap-3 py-4 sm:grid-cols-[8rem_1fr_auto]">
                    <div>
                      <h3 className="text-sm font-medium">{row.label}</h3>
                      <p className="mt-1 text-sm tabular-nums text-zinc-500">{row.known && !row.readError ? `${row.pending} 项待上传` : "数量待确认"}</p>
                    </div>
                    <div className="min-w-0 text-sm">
                      <p className={row.state === "attention" || row.state === "signed-out" ? "text-amber-700 dark:text-amber-400" : "text-zinc-600 dark:text-zinc-300"}>{row.statusLabel}</p>
                      <p className="mt-1 break-words text-zinc-500">{row.detail}</p>
                      {row.pending > 0 && row.oldestPendingAt && <p className="mt-1 text-xs text-zinc-500">最早待上传：{timeLabel(row.oldestPendingAt)}</p>}
                      {row.lastConfirmedAt && <p className="mt-1 text-xs text-zinc-500">最近成功：{timeLabel(row.lastConfirmedAt)}</p>}
                    </div>
                    <div className="flex items-start">
                      {row.state === "signed-out" ? (
                        <Link href="/account" className="inline-flex items-center gap-1 text-sm text-sky-700 dark:text-sky-400">检查登录<ArrowRight size={15} /></Link>
                      ) : row.id === "portfolio" && (row.manualReview > 0 || row.state === "disabled") ? (
                        <Link href="/portfolio" className="inline-flex items-center gap-1 text-sm text-sky-700 dark:text-sky-400">查看组合<ArrowRight size={15} /></Link>
                      ) : row.state === "attention" || row.state === "disabled" ? (
                        <button onClick={() => setAdvanced(true)} className="inline-flex items-center gap-1 text-sm text-sky-700 dark:text-sky-400">查看详情<ArrowRight size={15} /></button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
