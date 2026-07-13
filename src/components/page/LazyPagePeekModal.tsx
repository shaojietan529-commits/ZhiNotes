"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { PagePeekModalProps } from "@/components/page/PagePeekModal";
import { displayPageTitle } from "@/lib/pages/displayTitle";
import {
  getLocalPerformanceNow,
  recordLocalPerformanceSnapshot,
} from "@/lib/performance/localPerformance";
import { readPageRouteHandoff } from "@/lib/pages/pageRouteHandoff";
import { prepareLocalFirstPageNavigation } from "@/lib/pages/localFirstPageNavigation";
import {
  readPendingPageDraft,
  rememberPendingPageDraft,
} from "@/lib/pages/pendingPageDrafts";
import { parsePageProperties } from "@/lib/pages/pageProperties";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { Page } from "@/lib/utils/types";

let pagePeekModalPromise:
  | Promise<typeof import("@/components/page/PagePeekModal")>
  | null = null;
let pagePeekEditorPromise:
  | Promise<typeof import("@/components/editor/Editor")>
  | null = null;
let pagePeekModalLoaded = false;
const LAZY_PEEK_LOCAL_SEED_RETRY_DELAYS_MS = [80, 160, 360, 900];

function loadPagePeekModal() {
  if (!pagePeekModalPromise) {
    pagePeekModalPromise = import("@/components/page/PagePeekModal")
      .then((module) => {
        pagePeekModalLoaded = true;
        return module;
      })
      .catch((error) => {
        pagePeekModalPromise = null;
        pagePeekModalLoaded = false;
        throw error;
      });
  }
  return pagePeekModalPromise;
}

function warmPagePeekEditor() {
  if (!pagePeekEditorPromise) {
    pagePeekEditorPromise = import("@/components/editor/Editor").catch(
      (error) => {
        pagePeekEditorPromise = null;
        throw error;
      }
    );
  }
  void pagePeekEditorPromise.catch(() => undefined);
}

export function warmPagePeekModal() {
  void loadPagePeekModal().catch(() => undefined);
  warmPagePeekEditor();
}

const LazyPagePeekModalInner = dynamic(loadPagePeekModal, {
  ssr: false,
  loading: () => null,
});

export default function LazyPagePeekModal(props: PagePeekModalProps) {
  const [ready, setReady] = useState(() => pagePeekModalLoaded);

  useEffect(() => {
    let cancelled = false;
    void loadPagePeekModal()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, [props.pageId]);

  if (!ready) {
    return <LocalFirstPeekLoadingShell {...props} />;
  }

  return <LazyPagePeekModalInner {...props} />;
}

function LocalFirstPeekLoadingShell({
  pageId,
  initialPage,
  onClose,
  onOpenFull,
  onReady,
  readyOnLocalShell = true,
}: PagePeekModalProps) {
  const openedAtRef = useRef(getLocalPerformanceNow());
  const openedAtIsoRef = useRef(new Date().toISOString());
  const readyNotifiedRef = useRef<string | null>(null);
  const upsertPages = useWorkspaceStore((s) => s.upsertPages);
  const [seed, setSeed] = useState<Page | null>(() =>
    readLocalFirstLoadingSeed(pageId, initialPage)
  );
  const [quickDraft, setQuickDraft] = useState(() => ({
    pageId,
    text: "",
    touched: false,
  }));
  const quickDraftText = quickDraft.pageId === pageId ? quickDraft.text : "";
  const quickDraftTouched =
    quickDraft.pageId === pageId ? quickDraft.touched : false;
  const title = seed ? displayPageTitle(seed.title) : "正在打开页面";
  const propertyCount = seed ? parsePageProperties(seed.properties).length : 0;
  const isOptimisticDraft = seed?.content_text === "";
  const canUseQuickDraft = Boolean(seed) && (isOptimisticDraft || quickDraftTouched);
  const localSeedState = seed ? "ready" : "loading";
  const openFullFromLoadingShell = useCallback(() => {
    if (seed) prepareLocalFirstPageNavigation(seed, "page-open");
    onOpenFull(pageId);
  }, [onOpenFull, pageId, seed]);
  const handleQuickDraftChange = useCallback(
    (value: string) => {
      if (!seed) return;
      setQuickDraft({ pageId, text: value, touched: true });
      const nextPage: Page = {
        ...seed,
        content_text: quickDraftTextToHtml(value),
        updated_at: new Date().toISOString(),
      };
      setSeed(nextPage);
      upsertPages([nextPage]);
      rememberPendingPageDraft(nextPage);
    },
    [pageId, seed, upsertPages]
  );

  useEffect(() => {
    openedAtRef.current = getLocalPerformanceNow();
    openedAtIsoRef.current = new Date().toISOString();
    readyNotifiedRef.current = null;
  }, [pageId]);

  useEffect(() => {
    let cancelled = false;
    const refreshLocalSeed = () => {
      if (cancelled) return;
      setSeed(readLocalFirstLoadingSeed(pageId, initialPage));
    };
    refreshLocalSeed();
    queueMicrotask(refreshLocalSeed);
    const retryTimer = window.setTimeout(refreshLocalSeed, 120);
    const retryTimers = [
      retryTimer,
      ...LAZY_PEEK_LOCAL_SEED_RETRY_DELAYS_MS.map((delay) =>
        window.setTimeout(refreshLocalSeed, delay)
      ),
    ];
    return () => {
      cancelled = true;
      retryTimers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [initialPage, pageId]);

  useEffect(() => {
    if (!seed) return;
    if (readyNotifiedRef.current === pageId) return;
    readyNotifiedRef.current = pageId;
    if (readyOnLocalShell) {
      onReady?.(pageId);
    }
    const durationMs = getLocalPerformanceNow() - openedAtRef.current;
    recordLocalPerformanceSnapshot({
      kind: "page-peek",
      label: "页面预览本地壳",
      route: "/page/[pageId]#peek",
      status: seed ? "local-shell-ready" : "local-shell-loading",
      startedAt: openedAtIsoRef.current,
      durationMs,
      localFirstMs: durationMs,
      backgroundMs: 0,
      counts: {
        local_shell: 1,
        has_seed: seed ? 1 : 0,
        optimistic_draft: isOptimisticDraft ? 1 : 0,
        property_count: propertyCount,
      },
    });
  }, [
    isOptimisticDraft,
    onReady,
    pageId,
    propertyCount,
    readyOnLocalShell,
    seed,
  ]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/25 p-4"
      role="presentation"
      onMouseDown={onClose}
    >
      <div
        data-testid="page-peek-loading-shell"
        data-local-seed-state={localSeedState}
        data-local-first-stage={seed ? "metadata-visible" : "metadata-loading"}
        data-optimistic-draft={isOptimisticDraft}
        className="flex h-[85vh] w-[82vw] flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-950"
        role="dialog"
        aria-label="页面弹窗"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-end gap-1 border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
          <button
            type="button"
            onClick={openFullFromLoadingShell}
            className="rounded px-2 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            title="打开完整页面"
          >
            打开完整页面 ↗
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            aria-label="关闭"
          >
            ✕
          </button>
        </header>
        <div className="flex-1 px-10 py-8">
          <div className="mx-auto w-full max-w-4xl">
            <div
              data-testid="page-peek-local-first-status"
              className="mb-5 inline-flex flex-wrap items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-[11px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-400"
            >
              <span className="font-medium text-zinc-700 dark:text-zinc-200">
                {seed ? "本地已接收" : "读取本地缓存"}
              </span>
              <span>弹窗壳已打开</span>
              <span>编辑器加载中</span>
            </div>
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-lg dark:bg-zinc-800">
                {seed?.icon || "📄"}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                  {title}
                </h2>
                <p className="mt-1 text-xs text-zinc-400">
                  {seed
                    ? `已先显示本地页面信息 · ${propertyCount} 个属性`
                    : "正在读取本地页面信息…"}
                </p>
              </div>
            </div>
            <div className="mb-8 rounded border border-zinc-100 bg-zinc-50 px-4 py-3 text-xs text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/40">
              {isOptimisticDraft
                ? "新页面已在本机创建，完整编辑器正在载入。"
                : "完整编辑器正在载入，页面标题和属性会先保持可见。"}
            </div>
            {canUseQuickDraft ? (
              <div
                className="mb-6 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
                data-quick-draft-active={canUseQuickDraft}
              >
                <textarea
                  data-testid="page-peek-quick-draft-input"
                  value={quickDraftText}
                  onChange={(event) => handleQuickDraftChange(event.target.value)}
                  autoFocus
                  placeholder="可以先输入，正式编辑器加载后会接手这段内容..."
                  className="min-h-28 w-full resize-y bg-transparent text-sm leading-6 text-zinc-800 outline-none placeholder-zinc-400 dark:text-zinc-100 dark:placeholder-zinc-600"
                />
                <div className="mt-2 text-xs text-zinc-400">
                  快速输入已暂存在本机草稿，不会阻塞云同步。
                </div>
              </div>
            ) : null}
            {isOptimisticDraft ? (
              <div className="mb-6 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={openFullFromLoadingShell}
                  className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                >
                  打开完整页面继续编辑 ↗
                </button>
                <span className="text-xs text-zinc-400">
                  弹窗编辑器会继续在后台准备。
                </span>
              </div>
            ) : null}
            <div className="space-y-3">
              <div className="h-3 w-full max-w-2xl rounded bg-zinc-100 dark:bg-zinc-800" />
              <div className="h-3 w-10/12 max-w-2xl rounded bg-zinc-100 dark:bg-zinc-800" />
              <div className="h-3 w-7/12 max-w-2xl rounded bg-zinc-100 dark:bg-zinc-800" />
            </div>
            <p className="mt-5 text-xs text-zinc-400">正在准备编辑器…</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function readLocalFirstLoadingSeed(
  pageId: string,
  initialPage?: Page | null
): Page | null {
  if (initialPage?.id === pageId) return initialPage;
  return (
    readPendingPageDraft(pageId) ??
    useWorkspaceStore.getState().getPageById(pageId) ??
    readPageRouteHandoff(pageId) ??
    null
  );
}

function quickDraftTextToHtml(value: string): string {
  const normalized = value.replace(/\r\n?/g, "\n");
  if (!normalized.trim()) return "";
  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => {
      const lines = paragraph
        .split("\n")
        .map((line) => escapeQuickDraftHtml(line) || "<br>")
        .join("<br>");
      return `<p>${lines}</p>`;
    })
    .join("");
}

function escapeQuickDraftHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
