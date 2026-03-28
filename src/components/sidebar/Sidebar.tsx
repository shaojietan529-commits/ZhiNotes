"use client";

import { useRouter } from "next/navigation";
import { createPage } from "@/lib/db/local/queries";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { usePages } from "@/hooks/usePages";
import QuickSearch from "./QuickSearch";
import PageTree from "./PageTree";

export default function Sidebar() {
  const router = useRouter();
  const { refresh } = usePages();
  const sidebarOpen = useWorkspaceStore((s) => s.sidebarOpen);
  const toggleSidebar = useWorkspaceStore((s) => s.toggleSidebar);

  const handleNewPage = async () => {
    const page = await createPage();
    await refresh();
    router.push(`/page/${page.id}`);
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

      {/* New page button */}
      <div className="px-3 pb-2">
        <button
          onClick={handleNewPage}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Page
        </button>
      </div>

      {/* Page tree */}
      <nav className="flex-1 overflow-y-auto px-2">
        <PageTree />
      </nav>
    </aside>
  );
}
