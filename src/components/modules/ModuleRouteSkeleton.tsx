type ModuleRouteSkeletonProps = {
  icon: string;
  title: string;
  subtitle: string;
  primaryActionLabel?: string;
};

export default function ModuleRouteSkeleton({
  icon,
  title,
  subtitle,
  primaryActionLabel,
}: ModuleRouteSkeletonProps) {
  return (
    <div className="flex min-h-screen bg-white text-zinc-950 dark:bg-[#050505] dark:text-zinc-100">
      <aside className="hidden w-64 shrink-0 border-r border-zinc-200 bg-zinc-50/90 p-4 dark:border-zinc-800 dark:bg-zinc-950/90 md:block">
        <div className="mb-8 h-9 w-36 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="mb-7 h-11 rounded-lg bg-zinc-200/80 dark:bg-zinc-800/80" />
        <div className="space-y-3">
          {["每日纪要", "ZhiHui", "知识库", "产业链研究"].map((label) => (
            <div
              key={label}
              className="flex h-9 items-center gap-3 rounded-md px-2"
            >
              <div className="h-5 w-5 rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-3.5 w-24 rounded bg-zinc-200 dark:bg-zinc-800" />
            </div>
          ))}
        </div>
      </aside>
      <main className="flex-1 px-5 py-8 md:px-14 md:py-12">
        <section className="mx-auto max-w-7xl animate-pulse">
          <h1 className="sr-only">{title}</h1>
          <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-3 flex items-center gap-3">
                <span className="text-3xl" aria-hidden="true">
                  {icon}
                </span>
                <div>
                  <div className="h-8 w-40 rounded bg-zinc-200 dark:bg-zinc-800" />
                  <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                    {subtitle}
                  </p>
                </div>
              </div>
              <div className="ml-11 flex flex-wrap gap-2 text-xs text-zinc-500 dark:text-zinc-500">
                <span className="rounded-full border border-zinc-200 px-2 py-1 dark:border-zinc-800">
                  先显示本地热缓存
                </span>
                <span className="rounded-full border border-zinc-200 px-2 py-1 dark:border-zinc-800">
                  后台刷新云端索引
                </span>
              </div>
            </div>
            {primaryActionLabel ? (
              <div className="h-10 w-28 rounded-md bg-zinc-200 dark:bg-zinc-800">
                <span className="sr-only">{primaryActionLabel}</span>
              </div>
            ) : null}
          </div>
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800">
            {Array.from({ length: 35 }).map((_, index) => (
              <div
                key={index}
                className="min-h-24 bg-zinc-50 p-3 dark:bg-zinc-950 md:min-h-32"
              >
                <div className="ml-auto h-4 w-5 rounded bg-zinc-200 dark:bg-zinc-800" />
                {index % 4 === 0 ? (
                  <div className="mt-5 h-6 rounded bg-zinc-200/90 dark:bg-zinc-800/90" />
                ) : null}
                {index % 9 === 0 ? (
                  <div className="mt-2 h-6 w-3/4 rounded bg-zinc-200/70 dark:bg-zinc-800/70" />
                ) : null}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
