"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import DatabaseProvider from "@/components/providers/DatabaseProvider";
import Sidebar from "@/components/sidebar/Sidebar";
import SideBySideDiff from "./SideBySideDiff";
import { useLocalFirstPageNavigation } from "@/hooks/useLocalFirstPageNavigation";
import { usePage } from "@/hooks/usePage";
import { usePages } from "@/hooks/usePages";
import { useVersions } from "@/hooks/useVersions";
import { updatePageWithCloud } from "@/lib/pages/cloudPageMutations";
import { manualSnapshot } from "@/lib/comparison/versioning";
import { formatRelativeDate } from "@/lib/utils/dates";
import type { PageVersion } from "@/lib/utils/types";

const CURRENT = "current";

export default function CompareShell({ pageId }: { pageId: string }) {
  return (
    <DatabaseProvider>
      <CompareContent pageId={pageId} />
    </DatabaseProvider>
  );
}

function CompareContent({ pageId }: { pageId: string }) {
  const openPage = useLocalFirstPageNavigation();
  const searchParams = useSearchParams();
  const { page, loading } = usePage(pageId);
  const { upsertPages } = usePages({ autoLoad: false });
  const { versions, loading: versionsLoading, refresh } = useVersions(pageId);

  const [fromId, setFromId] = useState<string | null>(null);
  const [toId, setToId] = useState<string>(CURRENT);

  // Initialize selection once versions are loaded.
  useEffect(() => {
    if (versionsLoading || versions.length === 0) return;
    const requested = searchParams.get("from");
    queueMicrotask(() => {
      if (requested && versions.some((v) => v.id === requested)) {
        setFromId(requested);
      } else {
        // Default: the most recent saved version vs current live content
        setFromId(versions[0].id);
      }
    });
  }, [versionsLoading, versions, searchParams]);

  const resolveHtml = useCallback(
    (id: string | null): string => {
      if (!id) return "";
      if (id === CURRENT) return page?.content_text || "";
      return versions.find((v) => v.id === id)?.content_text || "";
    },
    [page, versions]
  );

  const resolveLabel = useCallback(
    (id: string | null): string => {
      if (!id) return "";
      if (id === CURRENT) return "当前页面";
      const v = versions.find((x) => x.id === id);
      return v
        ? `v${v.version_num} · ${formatRelativeDate(v.created_at)}`
        : "未知版本";
    },
    [versions]
  );

  const handleRestore = useCallback(
    async (version: PageVersion) => {
      if (!page) return;
      const ok = window.confirm(
        `要把这个页面恢复到 v${version.version_num} 吗？当前内容会先保存为一个新版本，方便回退。`
      );
      if (!ok) return;
      // Snapshot current content so the restore is reversible
      await manualSnapshot(
        pageId,
        page.title,
        page.content_text || "",
        "恢复前"
      );
      const restoredPage = await updatePageWithCloud(pageId, {
        content_text: version.content_text || "",
      });
      if (restoredPage) {
        upsertPages([restoredPage]);
      }
      await manualSnapshot(
        pageId,
        page.title,
        version.content_text || "",
        `从 v${version.version_num} 恢复`
      );
      await refresh();
      openPage(restoredPage ?? page ?? pageId, { source: "compare-return" });
    },
    [openPage, page, pageId, refresh, upsertPages]
  );

  const fromVersion = useMemo(
    () => (fromId && fromId !== CURRENT ? versions.find((v) => v.id === fromId) : null),
    [fromId, versions]
  );

  if (loading || versionsLoading) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-8 py-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <button
                onClick={() => openPage(page ?? pageId, { source: "compare-return" })}
                className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 mb-1"
              >
                ← 返回页面
              </button>
              <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                {page?.icon ? `${page.icon} ` : ""}
                版本对比 - {page?.title || "未命名页面"}
              </h1>
            </div>
          </div>

          {versions.length === 0 ? (
            <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg px-4 py-10 text-center text-sm text-zinc-400">
              还没有可对比的保存版本。编辑页面或手动保存一个版本后再回来查看。
            </div>
          ) : (
            <>
              {/* Version pickers */}
              <div className="flex items-center gap-3 mb-5 flex-wrap">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-zinc-400">从</label>
                  <select
                    value={fromId ?? ""}
                    onChange={(e) => setFromId(e.target.value)}
                    className="text-sm px-2 py-1 border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 outline-none"
                  >
                    {versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {resolveLabel(v.id)}
                      </option>
                    ))}
                  </select>
                </div>
                <span className="text-zinc-300 dark:text-zinc-600">→</span>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-zinc-400">到</label>
                  <select
                    value={toId}
                    onChange={(e) => setToId(e.target.value)}
                    className="text-sm px-2 py-1 border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 outline-none"
                  >
                    <option value={CURRENT}>当前页面</option>
                    {versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {resolveLabel(v.id)}
                      </option>
                    ))}
                  </select>
                </div>
                {fromVersion && (
                  <button
                    onClick={() => handleRestore(fromVersion)}
                    className="ml-auto text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    恢复“{resolveLabel(fromId)}”
                  </button>
                )}
              </div>

              {/* Diff */}
              <SideBySideDiff
                oldHtml={resolveHtml(fromId)}
                newHtml={resolveHtml(toId)}
                oldLabel={resolveLabel(fromId)}
                newLabel={resolveLabel(toId)}
              />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
