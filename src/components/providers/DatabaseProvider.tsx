"use client";

import { useLocalDb } from "@/hooks/useLocalDb";

export default function DatabaseProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { dbReady } = useLocalDb();

  if (!dbReady) {
    return (
      <div className="flex items-center justify-center h-screen bg-white dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
          <p className="text-sm text-zinc-500">Loading ZhiNotes...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
