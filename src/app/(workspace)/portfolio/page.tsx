"use client";

import dynamic from "next/dynamic";

const PortfolioBoardModule = dynamic(
  () => import("@/components/modules/PortfolioBoardShell"),
  { ssr: false, loading: () => <ModuleSkeleton /> }
);

export default function PortfolioBoardRoute() {
  return <PortfolioBoardModule />;
}

function ModuleSkeleton() {
  return (
    <div className="flex h-screen">
      <div className="w-64 shrink-0 border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900" />
      <main className="flex-1 px-8 py-10">
        <div className="mx-auto max-w-6xl animate-pulse">
          <div className="mb-6 h-7 w-40 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="mb-6 grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-zinc-100 dark:bg-zinc-800/40" />
            ))}
          </div>
          <div className="h-64 rounded-xl bg-zinc-100 dark:bg-zinc-800/40" />
        </div>
      </main>
    </div>
  );
}
