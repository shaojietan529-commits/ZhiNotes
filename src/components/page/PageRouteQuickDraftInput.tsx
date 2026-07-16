"use client";

import { useCallback, useEffect, useState } from "react";
import { readPageRouteHandoff } from "@/lib/pages/pageRouteHandoff";
import {
  readPendingPageDraft,
  rememberPendingPageDraft,
} from "@/lib/pages/pendingPageDrafts";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { Page } from "@/lib/utils/types";

const PAGE_ROUTE_QUICK_DRAFT_RETRY_DELAYS_MS = [80, 160, 360];

type PageRouteQuickDraftInputProps = {
  pageId: string;
  initialPage?: Page | null;
};

export default function PageRouteQuickDraftInput({
  pageId,
  initialPage,
}: PageRouteQuickDraftInputProps) {
  const upsertPages = useWorkspaceStore((s) => s.upsertPages);
  const [seed, setSeed] = useState<Page | null>(() =>
    readQuickDraftSeed(pageId, initialPage)
  );
  const [quickDraft, setQuickDraft] = useState(() => ({
    pageId,
    text: "",
    touched: false,
  }));
  const quickDraftText = quickDraft.pageId === pageId ? quickDraft.text : "";
  const quickDraftTouched =
    quickDraft.pageId === pageId ? quickDraft.touched : false;
  const isOptimisticDraft = seed?.content_text === "";
  const canUseQuickDraft = Boolean(seed) && (isOptimisticDraft || quickDraftTouched);

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
    let cancelled = false;
    const refreshSeed = () => {
      if (cancelled) return;
      setSeed(readQuickDraftSeed(pageId, initialPage));
    };
    refreshSeed();
    queueMicrotask(refreshSeed);
    const timers = PAGE_ROUTE_QUICK_DRAFT_RETRY_DELAYS_MS.map((delay) =>
      window.setTimeout(refreshSeed, delay)
    );
    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [initialPage, pageId]);

  if (!canUseQuickDraft) return null;

  return (
    <div
      data-quick-draft-active={canUseQuickDraft}
      className="mb-5 rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <textarea
        data-testid="page-route-quick-draft-input"
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
  );
}

function readQuickDraftSeed(pageId: string, initialPage?: Page | null): Page | null {
  return (
    readPendingPageDraft(pageId) ??
    (initialPage?.id === pageId ? initialPage : null) ??
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
