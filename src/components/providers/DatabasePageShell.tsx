"use client";

import DatabaseProvider from "./DatabaseProvider";
import Sidebar from "@/components/sidebar/Sidebar";
import DatabaseShell from "@/components/database/DatabaseShell";

export default function DatabasePageShell({
  databaseId,
}: {
  databaseId: string;
}) {
  return (
    <DatabaseProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-8 py-10">
            <DatabaseShell databaseId={databaseId} />
          </div>
        </main>
      </div>
    </DatabaseProvider>
  );
}
