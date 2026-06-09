"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";

const PageView = dynamic(() => import("@/components/providers/PageShell"), {
  ssr: false,
  loading: () => <PageSkeleton />,
});

export default function PageRoute() {
  const params = useParams();
  const pageId = params.pageId as string;
  return <PageView pageId={pageId} />;
}

function PageSkeleton() {
  return (
    <div className="flex h-screen">
      <div className="w-64 shrink-0 border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900" />
      <main className="flex-1 px-8 py-10">
        <div className="mx-auto max-w-3xl animate-pulse">
          <div className="mb-4 h-4 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="mb-3 h-8 w-64 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="mb-6 space-y-2">
            <div className="h-4 w-40 rounded bg-zinc-100 dark:bg-zinc-800/60" />
            <div className="h-4 w-36 rounded bg-zinc-100 dark:bg-zinc-800/60" />
          </div>
          <div className="space-y-3">
            <div className="h-4 w-full rounded bg-zinc-100 dark:bg-zinc-800/60" />
            <div className="h-4 w-5/6 rounded bg-zinc-100 dark:bg-zinc-800/60" />
            <div className="h-4 w-4/6 rounded bg-zinc-100 dark:bg-zinc-800/60" />
          </div>
        </div>
      </main>
    </div>
  );
}
