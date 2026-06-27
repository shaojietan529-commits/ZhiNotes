"use client";

import dynamic from "next/dynamic";

let pagePeekModalPromise:
  | Promise<typeof import("@/components/page/PagePeekModal")>
  | null = null;

function loadPagePeekModal() {
  if (!pagePeekModalPromise) {
    pagePeekModalPromise = import("@/components/page/PagePeekModal").catch(
      (error) => {
        pagePeekModalPromise = null;
        throw error;
      }
    );
  }
  return pagePeekModalPromise;
}

export function warmPagePeekModal() {
  void loadPagePeekModal().catch(() => undefined);
}

const LazyPagePeekModal = dynamic(loadPagePeekModal, {
  ssr: false,
  loading: () => (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/25 p-4"
      role="presentation"
    >
      <div
        className="flex h-[85vh] w-[82vw] flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-950"
        role="dialog"
        aria-label="页面弹窗加载中"
      >
        <div className="flex justify-end border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
          <div className="h-7 w-28 rounded bg-zinc-100 dark:bg-zinc-800" />
        </div>
        <div className="flex-1 px-10 py-8">
          <div className="mx-auto w-full max-w-4xl">
            <div className="mb-6 h-8 w-72 rounded bg-zinc-100 dark:bg-zinc-800" />
            <div className="mb-8 h-20 rounded border border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40" />
            <div className="space-y-3">
              <div className="h-3 w-full max-w-2xl rounded bg-zinc-100 dark:bg-zinc-800" />
              <div className="h-3 w-10/12 max-w-2xl rounded bg-zinc-100 dark:bg-zinc-800" />
              <div className="h-3 w-7/12 max-w-2xl rounded bg-zinc-100 dark:bg-zinc-800" />
            </div>
            <p className="mt-5 text-xs text-zinc-400">正在打开页面…</p>
          </div>
        </div>
      </div>
    </div>
  ),
});

export default LazyPagePeekModal;
