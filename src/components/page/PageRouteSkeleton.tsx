type PageRouteSkeletonProps = {
  message?: string;
};

export default function PageRouteSkeleton({
  message = "正在打开页面，本地缓存会先加载，云端同步在后台继续。",
}: PageRouteSkeletonProps) {
  return (
    <div className="flex min-h-screen bg-white text-zinc-950 dark:bg-[#050505] dark:text-zinc-100">
      <aside className="hidden w-64 shrink-0 border-r border-zinc-200 bg-zinc-50/90 p-4 dark:border-zinc-800 dark:bg-zinc-950/90 md:block">
        <div className="mb-8 h-9 w-36 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="mb-7 h-11 rounded-lg bg-zinc-200/80 dark:bg-zinc-800/80" />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="flex h-9 items-center gap-3 rounded-md px-2"
            >
              <div className="h-5 w-5 rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-3.5 w-24 rounded bg-zinc-200 dark:bg-zinc-800" />
            </div>
          ))}
        </div>
      </aside>
      <main className="flex-1 px-5 py-8 md:px-14 md:py-12">
        <section className="mx-auto max-w-3xl animate-pulse" aria-live="polite">
          <p className="mb-5 text-xs text-zinc-500 dark:text-zinc-400">
            {message}
          </p>
          <div className="mb-5 h-4 w-52 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="mb-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-9 w-72 max-w-full rounded bg-zinc-200 dark:bg-zinc-800" />
          </div>
          <div className="mb-7 grid gap-3 sm:grid-cols-2">
            <div className="h-8 rounded bg-zinc-100 dark:bg-zinc-900" />
            <div className="h-8 rounded bg-zinc-100 dark:bg-zinc-900" />
          </div>
          <div className="min-h-[260px] rounded-md border border-zinc-100 bg-zinc-50/60 px-4 py-5 dark:border-zinc-800 dark:bg-zinc-900/30">
            <div className="mb-4 h-3 w-40 rounded bg-zinc-200/80 dark:bg-zinc-800" />
            <div className="space-y-3">
              <div className="h-3 w-full rounded bg-zinc-200/70 dark:bg-zinc-800/80" />
              <div className="h-3 w-11/12 rounded bg-zinc-200/60 dark:bg-zinc-800/70" />
              <div className="h-3 w-4/5 rounded bg-zinc-200/50 dark:bg-zinc-800/60" />
              <div className="h-3 w-2/3 rounded bg-zinc-200/50 dark:bg-zinc-800/60" />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
