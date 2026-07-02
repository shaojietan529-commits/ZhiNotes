"use client";

import dynamic from "next/dynamic";

const SyncModule = dynamic(() => import("@/components/modules/SyncShell"), {
  ssr: false,
  loading: () => <ModuleSkeleton />,
});

export default function SyncRoute() {
  return <SyncModule />;
}

function ModuleSkeleton() {
  return (
    <div className="flex h-screen">
      <div className="w-64 shrink-0 border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900" />
      <main className="flex-1 px-8 py-10">
        <div className="mx-auto max-w-4xl animate-pulse">
          <p className="mb-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">
            同步中心
          </p>
          <div className="mb-6 h-7 w-40 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-44 rounded-xl bg-zinc-100 dark:bg-zinc-800/40" />
            <div className="h-44 rounded-xl bg-zinc-100 dark:bg-zinc-800/40" />
          </div>
        </div>
      </main>
    </div>
  );
}
