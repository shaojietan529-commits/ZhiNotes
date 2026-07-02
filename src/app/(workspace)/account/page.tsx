"use client";

import dynamic from "next/dynamic";

const AccountModule = dynamic(
  () => import("@/components/modules/AccountShell"),
  { ssr: false, loading: () => <ModuleSkeleton /> }
);

export default function AccountRoute() {
  return <AccountModule />;
}

function ModuleSkeleton() {
  return (
    <div className="flex h-screen">
      <div className="w-64 shrink-0 border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900" />
      <main className="flex-1 px-8 py-10">
        <div className="mx-auto max-w-2xl animate-pulse">
          <p className="mb-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">
            账号
          </p>
          <div className="mb-6 h-7 w-32 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-48 rounded-xl bg-zinc-100 dark:bg-zinc-800/40" />
        </div>
      </main>
    </div>
  );
}
