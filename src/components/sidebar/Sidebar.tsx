"use client";

import { useRouter } from "next/navigation";
import { usePages } from "@/hooks/usePages";
import { createPage } from "@/lib/db/local/queries";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { formatRelativeDate } from "@/lib/utils/dates";
import QuickSearch from "./QuickSearch";

export default function Sidebar() {
  const router = useRouter();
  const { pages, refresh } = usePages();
  const currentPageId = useWorkspaceStore((s) => s.currentPageId);
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
          ZhiNotes
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

      {/* Page list */}
      <nav className="flex-1 overflow-y-auto px-2">
        {pages.length === 0 ? (
          <p className="px-3 py-4 text-xs text-zinc-400 text-center">
            No pages yet. Create your first page!
          </p>
        ) : (
          <ul className="space-y-0.5">
            {pages.map((page) => (
              <li key={page.id}>
                <button
                  onClick={() => router.push(`/page/${page.id}`)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-left transition-colors ${
                    currentPageId === page.id
                      ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                      : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  <span className="shrink-0 w-5 text-center">
                    {page.icon || "📄"}
                  </span>
                  <span className="truncate flex-1">
                    {page.title || "Untitled"}
                  </span>
                  <span className="text-[10px] text-zinc-400 shrink-0">
                    {formatRelativeDate(page.updated_at)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </nav>
    </aside>
  );
}
