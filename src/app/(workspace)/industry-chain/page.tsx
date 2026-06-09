"use client";

import dynamic from "next/dynamic";

const IndustryChainModule = dynamic(
  () => import("@/components/modules/IndustryChainShell"),
  { ssr: false, loading: () => <ModuleSkeleton /> }
);

export default function IndustryChainRoute() {
  return <IndustryChainModule />;
}

function ModuleSkeleton() {
  return (
    <div className="flex h-screen">
      <div className="w-64 shrink-0 border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900" />
      <main className="flex-1 px-8 py-10">
        <div className="mx-auto max-w-4xl animate-pulse">
          <div className="mb-6 h-7 w-40 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-zinc-100 dark:bg-zinc-800/40" />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
