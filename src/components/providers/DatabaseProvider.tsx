"use client";

import { useSyncExternalStore } from "react";
import { useLocalDb } from "@/hooks/useLocalDb";

export default function DatabaseProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { dbReady } = useLocalDb();
  const mounted = useSyncExternalStore(
    subscribeToClientMount,
    getClientMountedSnapshot,
    getServerMountedSnapshot
  );

  if (!dbReady) {
    if (!mounted) return null;
    return (
      <div className="flex h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <aside className="hidden w-64 shrink-0 border-r border-zinc-200 bg-zinc-50/80 px-5 py-5 dark:border-zinc-800 dark:bg-zinc-900/70 sm:block">
          <div className="text-xl font-semibold tracking-normal">
            <span className="text-blue-500">Zhi</span>Note
          </div>
          <div className="mt-8 h-9 rounded-md bg-zinc-200/70 dark:bg-zinc-800" />
          <div className="mt-7 space-y-3">
            <div className="h-5 w-32 rounded bg-zinc-200/70 dark:bg-zinc-800" />
            <div className="h-5 w-28 rounded bg-zinc-200/60 dark:bg-zinc-800/80" />
            <div className="h-5 w-36 rounded bg-zinc-200/60 dark:bg-zinc-800/80" />
            <div className="h-5 w-24 rounded bg-zinc-200/60 dark:bg-zinc-800/80" />
          </div>
        </aside>
        <main className="flex flex-1 items-center justify-center px-6">
          <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-zinc-50 px-5 py-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="h-5 w-28 rounded bg-zinc-200 dark:bg-zinc-800" />
            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
              正在打开 Zhinote...
            </p>
          </div>
        </main>
      </div>
    );
  }

  return <>{children}</>;
}

function subscribeToClientMount(onStoreChange: () => void) {
  const timer = window.setTimeout(onStoreChange, 0);
  return () => window.clearTimeout(timer);
}

function getClientMountedSnapshot() {
  return true;
}

function getServerMountedSnapshot() {
  return false;
}
