"use client";

import {
  useCallback,
  useRef,
  useState,
  useEffect,
  type DragEvent,
  type PointerEvent,
  type MouseEvent,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createPage, createDatabase, getAllDatabases } from "@/lib/db/local/queries";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { usePages } from "@/hooks/usePages";
import type { Database } from "@/lib/utils/types";
import QuickSearch from "./QuickSearch";
import PageTree from "./PageTree";
import TrashPages from "./TrashPages";
import FavoritePages from "./FavoritePages";
import {
  exportWorkspaceBackup,
  exportWorkspaceMarkdown,
  exportWorkspaceZip,
} from "@/lib/export/workspaceBackup";
import { PLATFORM_MODULES } from "@/lib/modules/registry";
import { MODULE_WORKSPACE_LIST } from "@/lib/pages/moduleWorkspaces";
import { ZhiNoteLogo, ZhiNoteMark } from "@/components/brand/ZhiNoteLogo";
import { usePageCloudSync } from "@/hooks/usePageCloudSync";
import {
  ACCOUNT_PROFILE_UPDATED_EVENT,
  type ClientAccountInfo,
} from "@/lib/account/clientProfile";

const SIDEBAR_PRIMARY_ORDER_KEY = "zhinote.sidebar.primaryOrder.v1";

interface SidebarPrimaryItem {
  id: string;
  href: string;
  icon: string;
  label: string;
}

interface SidebarPrimaryPointerDrag {
  itemId: string;
  pointerId: number;
  startX: number;
  startY: number;
  hasMoved: boolean;
}

const DEFAULT_PRIMARY_ITEMS: SidebarPrimaryItem[] = [
  ...MODULE_WORKSPACE_LIST.map((workspace) => ({
    id: workspace.key,
    href: workspace.route,
    icon: workspace.icon,
    label: workspace.label,
  })),
  {
    id: "portfolio",
    href: "/portfolio",
    icon: "💼",
    label: "组合管理",
  },
];

function applySidebarPrimaryOrder(order: unknown): SidebarPrimaryItem[] {
  const byId = new Map(DEFAULT_PRIMARY_ITEMS.map((item) => [item.id, item]));
  const ordered: SidebarPrimaryItem[] = [];
  if (Array.isArray(order)) {
    for (const id of order) {
      if (typeof id !== "string") continue;
      const item = byId.get(id);
      if (!item || ordered.some((existing) => existing.id === item.id)) {
        continue;
      }
      ordered.push(item);
    }
  }
  for (const item of DEFAULT_PRIMARY_ITEMS) {
    if (!ordered.some((existing) => existing.id === item.id)) {
      ordered.push(item);
    }
  }
  return ordered;
}

function moveSidebarPrimaryItem(
  items: SidebarPrimaryItem[],
  draggedId: string,
  targetId: string
): SidebarPrimaryItem[] {
  if (draggedId === targetId) return items;
  const draggedIndex = items.findIndex((item) => item.id === draggedId);
  const targetIndex = items.findIndex((item) => item.id === targetId);
  if (draggedIndex < 0 || targetIndex < 0) return items;
  const next = [...items];
  const [dragged] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, dragged);
  return next;
}

function persistSidebarPrimaryOrder(items: SidebarPrimaryItem[]) {
  window.localStorage.setItem(
    SIDEBAR_PRIMARY_ORDER_KEY,
    JSON.stringify(items.map((item) => item.id))
  );
}

export default function Sidebar() {
  const router = useRouter();
  const { refresh } = usePages();
  const sidebarOpen = useWorkspaceStore((s) => s.sidebarOpen);
  const toggleSidebar = useWorkspaceStore((s) => s.toggleSidebar);
  const dbReady = useWorkspaceStore((s) => s.dbReady);
  const [databases, setDatabases] = useState<Database[]>([]);
  const [backupRunning, setBackupRunning] = useState(false);
  const [markdownExportRunning, setMarkdownExportRunning] = useState(false);
  const [zipExportRunning, setZipExportRunning] = useState(false);
  const [modulesOpen, setModulesOpen] = useState(false);
  const [accountLabel, setAccountLabel] = useState("账号");
  const [primaryItems, setPrimaryItems] = useState(DEFAULT_PRIMARY_ITEMS);
  const [draggedPrimaryId, setDraggedPrimaryId] = useState<string | null>(null);
  const [dragOverPrimaryId, setDragOverPrimaryId] = useState<string | null>(
    null
  );
  const primaryPointerDragRef = useRef<SidebarPrimaryPointerDrag | null>(null);
  const suppressPrimaryClickRef = useRef(false);
  const pageSync = usePageCloudSync();
  const sidebarModules = PLATFORM_MODULES.filter(
    (module) => module.route && module.route !== "/"
  );

  const refreshAccountLabel = useCallback(async () => {
    try {
      const res = await fetch("/api/account/me", { cache: "no-store" });
      if (!res.ok) {
        setAccountLabel("账号");
        return;
      }
      const data = await res.json();
      if (data.authenticated && data.account) {
        const account = data.account as ClientAccountInfo;
        setAccountLabel(account.display_name || "账号");
        return;
      }
      setAccountLabel("账号");
    } catch {
      setAccountLabel("账号");
    }
  }, []);

  useEffect(() => {
    if (dbReady) {
      getAllDatabases().then(setDatabases);
    }
  }, [dbReady]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SIDEBAR_PRIMARY_ORDER_KEY);
      setPrimaryItems(applySidebarPrimaryOrder(raw ? JSON.parse(raw) : null));
    } catch {
      setPrimaryItems(DEFAULT_PRIMARY_ITEMS);
    }
  }, []);

  useEffect(() => {
    void refreshAccountLabel();
    window.addEventListener(
      ACCOUNT_PROFILE_UPDATED_EVENT,
      refreshAccountLabel
    );
    return () => {
      window.removeEventListener(
        ACCOUNT_PROFILE_UPDATED_EVENT,
        refreshAccountLabel
      );
    };
  }, [refreshAccountLabel]);

  const refreshDatabases = async () => {
    setDatabases(await getAllDatabases());
  };

  const handleNewPage = async () => {
    try {
      const page = await createPage();
      await refresh();
      router.push(`/page/${page.id}`);
    } catch (err) {
      console.error("[Zhinote] Failed to create page:", err);
    }
  };

  const handleNewDatabase = async () => {
    try {
      const db = await createDatabase({ title: "未命名数据库" });
      await refreshDatabases();
      router.push(`/database/${db.id}`);
    } catch (err) {
      console.error("[Zhinote] Failed to create database:", err);
    }
  };

  const handleExportBackup = async () => {
    setBackupRunning(true);
    try {
      await exportWorkspaceBackup();
    } catch (err) {
      console.error("[Zhinote] Failed to export workspace backup:", err);
      window.alert("备份失败，请查看控制台详情。");
    } finally {
      setBackupRunning(false);
    }
  };

  const handleExportWorkspaceMarkdown = async () => {
    setMarkdownExportRunning(true);
    try {
      await exportWorkspaceMarkdown();
    } catch (err) {
      console.error("[Zhinote] Failed to export workspace Markdown:", err);
      window.alert("Markdown 导出失败，请查看控制台详情。");
    } finally {
      setMarkdownExportRunning(false);
    }
  };

  const handleExportWorkspaceZip = async () => {
    setZipExportRunning(true);
    try {
      await exportWorkspaceZip();
    } catch (err) {
      console.error("[Zhinote] Failed to export workspace ZIP:", err);
      window.alert("ZIP 导出失败，请查看控制台详情。");
    } finally {
      setZipExportRunning(false);
    }
  };

  const handlePrimaryDragStart = (
    e: DragEvent,
    itemId: string
  ) => {
    setDraggedPrimaryId(itemId);
    setDragOverPrimaryId(itemId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("application/x-zhinote-sidebar-primary", itemId);
    e.dataTransfer.setData("text/plain", itemId);
  };

  const handlePrimaryDragOver = (e: DragEvent, targetId: string) => {
    if (!draggedPrimaryId || draggedPrimaryId === targetId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverPrimaryId(targetId);
    setPrimaryItems((items) =>
      moveSidebarPrimaryItem(items, draggedPrimaryId, targetId)
    );
  };

  const handlePrimaryDrop = (e: DragEvent) => {
    e.preventDefault();
    setPrimaryItems((items) => {
      persistSidebarPrimaryOrder(items);
      return items;
    });
    setDraggedPrimaryId(null);
    setDragOverPrimaryId(null);
  };

  const handlePrimaryDragEnd = () => {
    setPrimaryItems((items) => {
      persistSidebarPrimaryOrder(items);
      return items;
    });
    setDraggedPrimaryId(null);
    setDragOverPrimaryId(null);
  };

  const handlePrimaryPointerDown = (
    e: PointerEvent<HTMLElement>,
    itemId: string
  ) => {
    if (e.button !== 0) return;
    primaryPointerDragRef.current = {
      itemId,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      hasMoved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePrimaryPointerMove = (e: PointerEvent<HTMLElement>) => {
    const drag = primaryPointerDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    const distance = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
    if (distance < 6 && !drag.hasMoved) return;

    drag.hasMoved = true;
    suppressPrimaryClickRef.current = true;
    setDraggedPrimaryId(drag.itemId);

    const target = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest<HTMLElement>("[data-sidebar-primary-id]");
    const targetId = target?.dataset.sidebarPrimaryId;
    if (!targetId || targetId === drag.itemId) return;

    setDragOverPrimaryId(targetId);
    setPrimaryItems((items) =>
      moveSidebarPrimaryItem(items, drag.itemId, targetId)
    );
  };

  const handlePrimaryPointerUp = (e: PointerEvent<HTMLElement>) => {
    const drag = primaryPointerDragRef.current;
    if (drag?.pointerId === e.pointerId) {
      primaryPointerDragRef.current = null;
      setPrimaryItems((items) => {
        persistSidebarPrimaryOrder(items);
        return items;
      });
      setDraggedPrimaryId(null);
      setDragOverPrimaryId(null);
    }
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handlePrimaryClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!suppressPrimaryClickRef.current) return;
    e.preventDefault();
    suppressPrimaryClickRef.current = false;
  };

  if (!sidebarOpen) {
    return (
      <button
        onClick={toggleSidebar}
        className="fixed top-4 left-4 z-50 rounded-lg border border-transparent p-1.5 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
        title="打开侧边栏"
      >
        <ZhiNoteMark className="h-8 w-8" />
      </button>
    );
  }

  return (
    <aside className="w-64 h-screen flex flex-col bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2.5 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => router.push("/modules")}
          className="rounded-md p-1 transition-colors hover:bg-white/5"
          title="打开模块中心"
        >
          <ZhiNoteLogo className="h-9 w-[150px]" />
        </button>
        <button
          onClick={toggleSidebar}
          className="p-1 rounded text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
          title="收起侧边栏"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <QuickSearch />
      </div>

      {/* New page + New database buttons */}
      <div className="px-3 pb-2 flex gap-1">
        <button
          onClick={handleNewPage}
          className="flex-1 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          页面
        </button>
        <button
          onClick={handleNewDatabase}
          className="flex-1 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
        >
          <span className="text-xs">🗄️</span>
          数据库
        </button>
      </div>

      {/* Primary workspaces (the three big categories + portfolio) */}
      <div className="px-2 pb-2">
        {primaryItems.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            prefetch
            draggable
            data-sidebar-primary-id={item.id}
            onPointerDown={(e) => handlePrimaryPointerDown(e, item.id)}
            onPointerMove={handlePrimaryPointerMove}
            onPointerUp={handlePrimaryPointerUp}
            onPointerCancel={handlePrimaryPointerUp}
            onClick={handlePrimaryClick}
            onDragStart={(e) => handlePrimaryDragStart(e, item.id)}
            onDragOver={(e) => handlePrimaryDragOver(e, item.id)}
            onDrop={handlePrimaryDrop}
            onDragEnd={handlePrimaryDragEnd}
            className={`group mt-0.5 flex w-full cursor-grab items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-zinc-700 transition-colors active:cursor-grabbing dark:text-zinc-200 ${
              draggedPrimaryId === item.id
                ? "bg-zinc-200 opacity-60 ring-1 ring-zinc-300 dark:bg-zinc-800 dark:ring-zinc-700"
                : dragOverPrimaryId === item.id
                  ? "bg-zinc-100 ring-1 ring-zinc-300 dark:bg-zinc-800 dark:ring-zinc-700"
                  : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
            title="拖动调整左侧栏顺序"
          >
            <span
              className="shrink-0 text-zinc-300 transition-colors group-hover:text-zinc-500 dark:text-zinc-600 dark:group-hover:text-zinc-400"
              aria-hidden="true"
            >
              ⋮⋮
            </span>
            <span className="shrink-0 text-base">{item.icon}</span>
            <span className="truncate">{item.label}</span>
          </Link>
        ))}
      </div>

      {/* Secondary modules, collapsed by default */}
      <div className="px-2 pb-3">
        <button
          type="button"
          onClick={() => setModulesOpen((value) => !value)}
          className="flex w-full items-center justify-between rounded-md px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          <span>备选模块</span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`transition-transform ${modulesOpen ? "rotate-90" : ""}`}
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
        {modulesOpen && (
          <div className="mt-1">
            <Link
              href="/modules"
              className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-zinc-200 text-[9px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                模块
              </span>
              <span className="truncate">模块中心</span>
            </Link>
            {sidebarModules.map((module) => (
              <Link
                key={module.id}
                href={module.route || "/modules"}
                className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-zinc-200 text-[9px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {module.icon}
                </span>
                <span className="truncate">{module.shortTitle}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Page tree */}
      <nav className="flex-1 overflow-y-auto px-2">
        {/* Databases section */}
        {databases.length > 0 && (
          <div className="mb-3">
            <p className="px-3 py-1 text-[10px] uppercase tracking-wider text-zinc-400 font-medium">
              数据库
            </p>
            <ul className="space-y-0.5">
              {databases.map((db) => (
                <li key={db.id}>
                  <button
                    onClick={() => router.push(`/database/${db.id}`)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-left text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <span className="shrink-0">{db.icon || "🗄️"}</span>
                    <span className="truncate">{db.title || "未命名"}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <FavoritePages />

        {/* Pages section */}
        <p className="px-3 py-1 text-[10px] uppercase tracking-wider text-zinc-400 font-medium">
          页面
        </p>
        <PageTree />
        <TrashPages />
      </nav>
      <div className="border-t border-zinc-200 px-2 py-1.5 dark:border-zinc-800">
        <Link
          href="/account"
          prefetch
          className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          <span className="shrink-0 text-base">👤</span>
          <span className="truncate">{accountLabel}</span>
          {pageSync.state !== "disabled" && (
            <span
              className="ml-auto shrink-0 text-[10px]"
              title={
                pageSync.state === "synced"
                  ? `页面已同步${pageSync.lastSyncAt ? ` · ${new Date(pageSync.lastSyncAt).toLocaleTimeString("zh-CN")}` : ""}`
                  : pageSync.state === "syncing"
                    ? "页面同步中…"
                    : pageSync.state === "signed-out"
                      ? "页面同步：未登录"
                      : "页面同步出错"
              }
            >
              {pageSync.state === "synced"
                ? "☁️"
                : pageSync.state === "syncing"
                  ? "⏳"
                  : "⚠️"}
            </span>
          )}
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-1 border-t border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <button
          type="button"
          onClick={handleExportWorkspaceMarkdown}
          disabled={markdownExportRunning}
          className="flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-800 disabled:cursor-wait disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          title="下载所有活跃页面为一个 Markdown 文件"
        >
          {markdownExportRunning ? "导出中..." : "导出 MD"}
        </button>
        <button
          type="button"
          onClick={handleExportWorkspaceZip}
          disabled={zipExportRunning}
          className="flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-800 disabled:cursor-wait disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          title="下载活跃页面和上传文件为本地 ZIP"
        >
          {zipExportRunning ? "导出中..." : "导出 ZIP"}
        </button>
        <button
          type="button"
          onClick={handleExportBackup}
          disabled={backupRunning}
          className="flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-800 disabled:cursor-wait disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          title="下载当前工作区的本地 JSON 备份"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3v12" />
            <path d="m7 10 5 5 5-5" />
            <path d="M5 21h14" />
          </svg>
          {backupRunning ? "备份中..." : "备份"}
        </button>
      </div>
    </aside>
  );
}
