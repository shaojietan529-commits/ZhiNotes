type DatabaseRouteSkeletonProps = {
  compact?: boolean;
  message?: string;
};

function DatabaseGridSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/70">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="border-r border-zinc-200 px-3 py-3 last:border-r-0 dark:border-zinc-800"
          >
            <div className="h-3 w-20 rounded bg-zinc-200 dark:bg-zinc-800" />
          </div>
        ))}
      </div>
      {Array.from({ length: 8 }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="grid grid-cols-[1.4fr_1fr_1fr_1fr] border-b border-zinc-100 last:border-b-0 dark:border-zinc-900"
        >
          {Array.from({ length: 4 }).map((__, cellIndex) => (
            <div
              key={cellIndex}
              className="border-r border-zinc-100 px-3 py-3 last:border-r-0 dark:border-zinc-900"
            >
              <div
                className={[
                  "h-3 rounded bg-zinc-200/80 dark:bg-zinc-800/80",
                  cellIndex === 0
                    ? rowIndex % 2 === 0
                      ? "w-44"
                      : "w-32"
                    : rowIndex % 3 === 0
                      ? "w-24"
                      : "w-16",
                ].join(" ")}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function DatabaseBodySkeleton({
  message = "正在打开数据库，本地热缓存会先加载，云端索引在后台继续。",
}: {
  message?: string;
}) {
  return (
    <section className="animate-pulse" aria-live="polite">
      <p className="mb-5 text-xs text-zinc-500 dark:text-zinc-400">
        {message}
      </p>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="h-8 w-8 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-8 w-56 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-9 w-24 rounded bg-zinc-200 dark:bg-zinc-800" />
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {["表格", "列表", "看板", "日历"].map((label) => (
          <div
            key={label}
            className="h-8 w-16 rounded-md bg-zinc-100 dark:bg-zinc-900"
          >
            <span className="sr-only">{label}</span>
          </div>
        ))}
      </div>
      <DatabaseGridSkeleton />
    </section>
  );
}

export default function DatabaseRouteSkeleton({
  compact = false,
  message,
}: DatabaseRouteSkeletonProps) {
  if (compact) {
    return <DatabaseBodySkeleton message={message} />;
  }

  return (
    <div className="flex min-h-screen bg-white text-zinc-950 dark:bg-[#050505] dark:text-zinc-100">
      <aside className="hidden w-64 shrink-0 border-r border-zinc-200 bg-zinc-50/90 p-4 dark:border-zinc-800 dark:bg-zinc-950/90 md:block">
        <div className="mb-8 h-9 w-36 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="mb-7 h-11 rounded-lg bg-zinc-200/80 dark:bg-zinc-800/80" />
        <div className="space-y-3">
          {Array.from({ length: 7 }).map((_, index) => (
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
        <div className="mx-auto max-w-5xl">
          <DatabaseBodySkeleton message={message} />
        </div>
      </main>
    </div>
  );
}
