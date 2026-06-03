"use client";

import DatabaseProvider from "@/components/providers/DatabaseProvider";
import Sidebar from "@/components/sidebar/Sidebar";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import ModuleDashboard from "./ModuleDashboard";

export default function ModuleHubShell() {
  return (
    <DatabaseProvider>
      <ModuleHubContent />
    </DatabaseProvider>
  );
}

function ModuleHubContent() {
  const sidebarOpen = useWorkspaceStore((s) => s.sidebarOpen);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main
        className={`flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950 ${
          sidebarOpen ? "" : "pl-0"
        }`}
      >
        <ModuleDashboard />
      </main>
    </div>
  );
}
