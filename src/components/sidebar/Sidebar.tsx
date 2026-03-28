"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createPage, createDatabase, getAllDatabases } from "@/lib/db/local/queries";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { usePages } from "@/hooks/usePages";
import type { Database } from "@/lib/utils/types";
import QuickSearch from "./QuickSearch";
import PageTree from "./PageTree";

export default function Sidebar() {
  const router = useRouter();
  const { refresh } = usePages();
  const sidebarOpen = useWorkspaceStore((s) => s.sidebarOpen);
  const toggleSidebar = useWorkspaceStore((s) => s.toggleSidebar);
  const dbReady = useWorkspaceStore((s) => s.dbReady);
  const [databases, setDatabases] = useState<Database[]>([]);

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
      const db = await createDatabase({ title: "Untitled Database" });
      await refreshDatabases();
      router.push(`/database/${db.id}`);
    } catch (err) {
      console.error("[Zhinote] Failed to create database:", err);
    }
  };

  if (!sidebarOpen) {
    return (
      <button
        onClick={toggleSidebar}
        className="fixed top-4 left-4 z-50 p-2 bg-white dark:bg-zinc-900 rounded-lg shadow-md border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        title="Open sidebar"
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
          title="Close sidebar"
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
          Page
        </button>
        <button
          onClick={handleNewDatabase}
          className="flex-1 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
        >
          <span className="text-xs">🗄️</span>
          Database
        </button>
      </div>

      {/* Page tree */}
      <nav className="flex-1 overflow-y-auto px-2">
        {/* Databases section */}
        {databases.length > 0 && (
          <div className="mb-3">
            <p className="px-3 py-1 text-[10px] uppercase tracking-wider text-zinc-400 font-medium">
              Databases
            </p>
            <ul className="space-y-0.5">
              {databases.map((db) => (
                <li key={db.id}>
                  <button
                    onClick={() => router.push(`/database/${db.id}`)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-left text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <span className="shrink-0">{db.icon || "🗄️"}</span>
                    <span className="truncate">{db.title || "Untitled"}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Pages section */}
        <p className="px-3 py-1 text-[10px] uppercase tracking-wider text-zinc-400 font-medium">
          Pages
        </p>
        <PageTree />
      </nav>
    </aside>
  );
}
