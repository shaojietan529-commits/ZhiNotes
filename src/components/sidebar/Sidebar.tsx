"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  const sidebarModules = PLATFORM_MODULES.filter(
    (module) => module.route && module.route !== "/"
  );

  useEffect(() => {
    if (dbReady) {
      getAllDatabases().then(setDatabases);
    }
  }, [dbReady]);

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

  if (!sidebarOpen) {
    return (
      <button
        onClick={toggleSidebar}
        className="fixed top-4 left-4 z-50 p-2 bg-white dark:bg-zinc-900 rounded-lg shadow-md border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        title="打开侧边栏"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 12h18M3 6h18M3 18h18" />
        </svg>
      </button>
    );
  }

  return (
    <aside className="w-64 h-screen flex flex-col bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Zhinote
        </h1>
        <button
          onClick={toggleSidebar}
          className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-zinc-500"
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

      <div className="px-2 pb-3">
        <p className="px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
          平台
        </p>
        <button
          type="button"
          onClick={() => router.push("/modules")}
          className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-zinc-200 text-[9px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            模块
          </span>
          <span className="truncate">模块中心</span>
        </button>
        {sidebarModules.map((module) => (
          <button
            key={module.id}
            type="button"
            onClick={() => {
              if (module.route) router.push(module.route);
            }}
            className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-zinc-200 text-[9px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {module.icon}
            </span>
            <span className="truncate">{module.shortTitle}</span>
          </button>
        ))}
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
      <div className="grid grid-cols-3 gap-1 border-t border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <button
          type="button"
          onClick={handleExportWorkspaceMarkdown}
          disabled={markdownExportRunning}
          className="flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-800 disabled:cursor-wait disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          title="下载所有活跃页面为一个 Markdown 文件"
        >
          MD all
        </button>
        <button
          type="button"
          onClick={handleExportWorkspaceZip}
          disabled={zipExportRunning}
          className="flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-800 disabled:cursor-wait disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          title="下载活跃页面和上传文件为本地 ZIP"
        >
          {zipExportRunning ? "ZIP..." : "ZIP"}
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
