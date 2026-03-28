"use client";

import DatabaseProvider from "./DatabaseProvider";
import Sidebar from "@/components/sidebar/Sidebar";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { usePages } from "@/hooks/usePages";

export default function AppShell() {
  return (
    <DatabaseProvider>
      <AppContent />
    </DatabaseProvider>
  );
}

function AppContent() {
  const { pages } = usePages();
  const sidebarOpen = useWorkspaceStore((s) => s.sidebarOpen);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main
        className={`flex-1 flex items-center justify-center overflow-y-auto ${
          sidebarOpen ? "" : "pl-0"
        }`}
      >
        <div className="max-w-2xl text-center px-8">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
            Zhinote
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mb-6">
            Your offline-first knowledge management system
          </p>
          {pages.length === 0 ? (
            <p className="text-sm text-zinc-400">
              Create your first page using the sidebar to get started.
            </p>
          ) : (
            <p className="text-sm text-zinc-400">
              Select a page from the sidebar, or create a new one.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
