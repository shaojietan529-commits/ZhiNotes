"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import DatabaseProvider from "./DatabaseProvider";
import Sidebar from "@/components/sidebar/Sidebar";
import Editor from "@/components/editor/Editor";
import type { EditorRef } from "@/components/editor/Editor";
import DateDisplay from "@/components/shared/DateDisplay";
import Breadcrumb from "@/components/shared/Breadcrumb";
import IconPicker from "@/components/shared/IconPicker";
import PagePositionTree from "@/components/shared/SubPageTree";
import Backlinks from "@/components/shared/Backlinks";
import PageComments from "@/components/shared/PageComments";
import BlockComments from "@/components/shared/BlockComments";
import { usePage } from "@/hooks/usePage";
import { usePages } from "@/hooks/usePages";
import { useVersions } from "@/hooks/useVersions";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useRouter } from "next/navigation";
import {
  createPage,
  updatePage as updatePageRecord,
  updateWikiLinks,
} from "@/lib/db/local/queries";
import { maybeSnapshot, manualSnapshot } from "@/lib/comparison/versioning";
import HoverSummary from "@/components/comparison/HoverSummary";
import VersionHistoryPanel from "@/components/comparison/VersionHistoryPanel";
import type { PageVersion } from "@/lib/utils/types";
import {
  exportPageAsHtml,
  exportPageAsMarkdown,
} from "@/lib/export/pageExport";
import { usePageFavorites } from "@/hooks/usePageFavorites";
import {
  PAGE_LOCAL_COMMAND_EVENT,
  type PageLocalCommand,
} from "@/lib/pageLocalCommands";

export default function PageShell({ pageId }: { pageId: string }) {
  return (
    <DatabaseProvider>
      <PageContent pageId={pageId} />
    </DatabaseProvider>
  );
}

function PageContent({ pageId }: { pageId: string }) {
  const router = useRouter();
  const editorRef = useRef<EditorRef>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const { page, loading, update, remove } = usePage(pageId);
  const { refresh } = usePages();
  const { versions, refresh: refreshVersions } = useVersions(pageId);
  const setCurrentPageId = useWorkspaceStore((s) => s.setCurrentPageId);
  const [title, setTitle] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [locked, setLocked] = useState(false);
  const [widePage, setWidePage] = useState(false);
  const { isFavorite, toggleFavorite } = usePageFavorites();
  const favorite = isFavorite(pageId);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    setCurrentPageId(pageId);
    return () => setCurrentPageId(null);
  }, [pageId, setCurrentPageId]);

  useEffect(() => {
    if (!page) return;
    queueMicrotask(() => {
      setTitle(page.title);
    });
  }, [page]);

  useEffect(() => {
    queueMicrotask(() => {
      const value = window.localStorage.getItem(`zhinote.page.locked.${pageId}`);
      setLocked(value === "true");
    });
  }, [pageId]);

  useEffect(() => {
    queueMicrotask(() => {
      const value = window.localStorage.getItem("zhinote.page.wide");
      setWidePage(value === "true");
    });
  }, []);

  const handleTitleChange = useCallback(
    async (newTitle: string) => {
      if (locked) return;
      setTitle(newTitle);
      await update({ title: newTitle });
      refresh();
    },
    [locked, update, refresh]
  );

  const handleContentUpdate = useCallback(
    async (html: string, text: string, linkedPageIds: string[]) => {
      await update({ content_text: html });
      // Update wiki link relationships in the database
      await updateWikiLinks(pageId, linkedPageIds);
      // Capture an automatic version snapshot when changes are significant
      const created = await maybeSnapshot(pageId, title || "未命名页面", html);
      if (created) refreshVersions();
      refresh();
    },
    [update, refresh, refreshVersions, pageId, title]
  );

  const handleSaveVersion = useCallback(async () => {
    const html = editorRef.current?.getHTML() ?? page?.content_text ?? "";
    const label = window.prompt(
      "给这个版本命名（可选，例如：Q3 earnings update）："
    );
    // A null return means the user cancelled the prompt
    if (label === null) return;
    await manualSnapshot(pageId, title || "未命名页面", html, label);
    await refreshVersions();
    setShowHistory(true);
  }, [pageId, title, page, refreshVersions]);

  const handleExportHtml = useCallback(() => {
    const html = editorRef.current?.getHTML() ?? page?.content_text ?? "";
    exportPageAsHtml(title || "未命名页面", html);
  }, [page, title]);

  const handleExportMarkdown = useCallback(() => {
    const html = editorRef.current?.getHTML() ?? page?.content_text ?? "";
    exportPageAsMarkdown(title || "未命名页面", html);
  }, [page, title]);

  const handleCopyPageLink = useCallback(async () => {
    const url = `${window.location.origin}/page/${pageId}`;
    try {
      await window.navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Copy page link:", url);
    }
  }, [pageId]);

  const handlePrintPdf = useCallback(() => {
    window.print();
  }, []);

  useEffect(() => {
    const handlePageLocalCommand = (event: Event) => {
      const command = (event as CustomEvent<{ command?: PageLocalCommand }>).detail
        ?.command;
      if (!command) return;

      if (command === "info") {
        setShowInfo(true);
        return;
      }
      if (command === "history") {
        setShowHistory(true);
        return;
      }
      if (command === "copy-link") {
        void handleCopyPageLink();
        return;
      }
      if (command === "print-pdf") {
        handlePrintPdf();
      }
    };

    window.addEventListener(PAGE_LOCAL_COMMAND_EVENT, handlePageLocalCommand);
    return () =>
      window.removeEventListener(PAGE_LOCAL_COMMAND_EVENT, handlePageLocalCommand);
  }, [handleCopyPageLink, handlePrintPdf]);

  const handleCompareVersion = useCallback(
    (version: PageVersion) => {
      router.push(`/page/${pageId}/compare?from=${version.id}`);
    },
    [router, pageId]
  );

  const handleRestoreVersion = useCallback(
    async (version: PageVersion) => {
      const ok = window.confirm(
        `是否将页面恢复到 v${version.version_num}？当前内容会先保存为一个版本。`
      );
      if (!ok) return;
      const currentHtml = editorRef.current?.getHTML() ?? page?.content_text ?? "";
      await manualSnapshot(pageId, title || "未命名页面", currentHtml, "恢复前");
      const restored = version.content_text || "";
      await update({ content_text: restored });
      editorRef.current?.setContent(restored);
      await manualSnapshot(
        pageId,
        title || "未命名页面",
        restored,
        `从 v${version.version_num} 恢复`
      );
      await refreshVersions();
      refresh();
    },
    [pageId, title, page, update, refreshVersions, refresh]
  );

  const handleIconChange = useCallback(
    async (icon: string) => {
      if (locked) return;
      await update({ icon });
      refresh();
    },
    [locked, update, refresh]
  );

  const handleCoverUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      if (locked) return;
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        window.alert("Please choose an image file for the cover.");
        return;
      }

      const dataUrl = await readFileAsDataUrl(file);
      await update({ cover_url: dataUrl });
      refresh();
    },
    [locked, update, refresh]
  );

  const handleCoverUrl = useCallback(async () => {
    if (locked) return;
    const url = window.prompt("Cover image URL:", page?.cover_url ?? "");
    if (url === null) return;
    await update({ cover_url: url.trim() });
    refresh();
  }, [locked, page, update, refresh]);

  const handleRemoveCover = useCallback(async () => {
    if (locked) return;
    await update({ cover_url: "" });
    refresh();
  }, [locked, update, refresh]);

  const handleToggleLock = useCallback(() => {
    setLocked((current) => {
      const next = !current;
      window.localStorage.setItem(`zhinote.page.locked.${pageId}`, String(next));
      return next;
    });
  }, [pageId]);

  const handleToggleWidth = useCallback(() => {
    setWidePage((current) => {
      const next = !current;
      window.localStorage.setItem("zhinote.page.wide", String(next));
      return next;
    });
  }, []);

  const handleToggleFavorite = useCallback(() => {
    toggleFavorite(pageId);
  }, [pageId, toggleFavorite]);

  const handleDelete = useCallback(async () => {
    if (locked) return;
    const ok = window.confirm(
      `要把“${title || page?.title || "未命名页面"}”移到回收站吗？之后可以从侧边栏回收站恢复。`
    );
    if (!ok) return;
    await remove();
    await refresh();
    router.push("/");
  }, [locked, page, remove, refresh, router, title]);

  const handleAddSubPage = useCallback(async () => {
    if (locked) return;
    try {
      const child = await createPage({ parentId: pageId });
      await refresh();
      // Insert a link to the sub-page in the parent editor
      const html = editorRef.current?.insertSubPageLink(child.id, child.title);
      // Save immediately before navigating away (don't wait for debounce)
      if (html) {
        await update({ content_text: html });
      }
      router.push(`/page/${child.id}`);
    } catch (err) {
      console.error("[Zhinote] Failed to create sub-page:", err);
    }
  }, [locked, pageId, refresh, router, update]);

  const handleDuplicatePage = useCallback(async () => {
    if (!page) return;
    const html = editorRef.current?.getHTML() ?? page.content_text ?? "";
    const duplicate = await createPage({
      title: `${title || page.title || "未命名页面"} 副本`,
      parentId: page.parent_id,
      icon: page.icon ?? undefined,
    });
    await updatePageRecord(duplicate.id, {
      cover_url: page.cover_url ?? "",
      content_text: html,
    });
    await updateWikiLinks(duplicate.id, extractLinkedPageIdsFromHtml(html));
    await refresh();
    router.push(`/page/${duplicate.id}`);
  }, [page, refresh, router, title]);

  if (loading) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
        </main>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-zinc-500 mb-4">Page not found</p>
            <button
              onClick={() => router.push("/")}
              className="text-sm text-blue-500 hover:underline"
            >
              Go home
            </button>
          </div>
        </main>
      </div>
    );
  }

  const pageInfo = getPageInfoStats(page.content_text ?? "");

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className={`${widePage ? "max-w-6xl" : "max-w-3xl"} mx-auto px-8 py-10`}>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleCoverUpload}
          />

          {/* Page cover */}
          {page.cover_url ? (
            <div className="-mx-2 mb-6 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900">
              <div className="group relative h-44">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={page.cover_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
                <div className="absolute right-3 top-3 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                  {!locked && (
                    <>
                      <button
                        type="button"
                        onClick={() => coverInputRef.current?.click()}
                        className="rounded bg-white/90 px-2 py-1 text-xs text-zinc-600 shadow-sm hover:bg-white hover:text-zinc-900 dark:bg-zinc-900/90 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                      >
                        Upload
                      </button>
                      <button
                        type="button"
                        onClick={handleCoverUrl}
                        className="rounded bg-white/90 px-2 py-1 text-xs text-zinc-600 shadow-sm hover:bg-white hover:text-zinc-900 dark:bg-zinc-900/90 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                      >
                        URL
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveCover}
                        className="rounded bg-white/90 px-2 py-1 text-xs text-zinc-600 shadow-sm hover:bg-white hover:text-red-500 dark:bg-zinc-900/90 dark:text-zinc-300 dark:hover:bg-zinc-900"
                      >
                        Remove
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : !locked ? (
            <div className="mb-3 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                Add cover
              </button>
              <button
                type="button"
                onClick={handleCoverUrl}
                className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                Cover URL
              </button>
            </div>
          ) : null}

          {/* Breadcrumb */}
          <Breadcrumb pageId={pageId} />

          {/* Page header */}
          <div className="mb-6">
            <div className="flex items-start gap-2">
              <IconPicker
                currentIcon={page.icon}
                onSelect={handleIconChange}
                disabled={locked}
              />
              <h1 className="zhinote-print-title">
                {title || page.title || "未命名页面"}
              </h1>
              <input
                type="text"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                disabled={locked}
                placeholder="未命名页面"
                className="zhinote-title-input w-full text-3xl font-bold bg-transparent border-none outline-none text-zinc-900 disabled:cursor-default dark:text-zinc-100 placeholder-zinc-300 dark:placeholder-zinc-600 mt-1"
              />
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <DateDisplay
                createdAt={page.created_at}
                updatedAt={page.updated_at}
              />
              <div className="zhinote-page-actions flex flex-wrap items-center gap-2 sm:justify-end sm:gap-3">
                <button
                  onClick={handleToggleFavorite}
                  className={`flex items-center gap-1 text-xs transition-colors ${
                    favorite
                      ? "text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
                      : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  }`}
                  title={favorite ? "Remove from favorites" : "Add to favorites"}
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill={favorite ? "currentColor" : "none"}
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="m12 2 3.1 6.4 7 .9-5.1 4.9 1.3 6.9L12 17.8 5.7 21.1l1.3-6.9L1.9 9.3l7-.9L12 2Z" />
                  </svg>
                  {favorite ? "Favorited" : "Favorite"}
                </button>
                <button
                  onClick={handleAddSubPage}
                  disabled={locked}
                  className="text-xs text-zinc-400 hover:text-zinc-600 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:text-zinc-300 transition-colors"
                  title="Add sub-page"
                >
                  + Sub-page
                </button>
                <button
                  onClick={handleToggleLock}
                  className={`text-xs transition-colors ${
                    locked
                      ? "text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
                      : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  }`}
                  title={locked ? "Unlock page editing" : "Lock page editing"}
                >
                  {locked ? "Locked" : "Lock"}
                </button>
                <button
                  onClick={handleToggleWidth}
                  className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                  title={widePage ? "Use normal page width" : "Use wide page width"}
                >
                  {widePage ? "Narrow" : "Wide"}
                </button>
                <button
                  onClick={() => setShowInfo((current) => !current)}
                  className={`text-xs transition-colors ${
                    showInfo
                      ? "text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                      : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  }`}
                  title="View local page information"
                >
                  Info
                </button>
                <button
                  onClick={handleSaveVersion}
                  className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                  title="Save a named version snapshot"
                >
                  📌 Save version
                </button>
                <button
                  onClick={handleExportHtml}
                  className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                  title="Download this page as HTML"
                >
                  HTML
                </button>
                <button
                  onClick={handleExportMarkdown}
                  className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                  title="Download this page as Markdown"
                >
                  MD
                </button>
                <button
                  onClick={handlePrintPdf}
                  className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                  title="Print or save this page as PDF"
                >
                  PDF
                </button>
                <button
                  onClick={handleCopyPageLink}
                  className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                  title="Copy local page link"
                >
                  Copy link
                </button>
                <button
                  onClick={handleDuplicatePage}
                  className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                  title="Duplicate this page"
                >
                  Duplicate
                </button>
                <div className="group relative">
                  <button
                    onClick={() => setShowHistory((s) => !s)}
                    className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                    title="View version history"
                  >
                    🕘 History
                    {versions.length > 0 && (
                      <span className="ml-1 text-zinc-300 dark:text-zinc-600">
                        ({versions.length})
                      </span>
                    )}
                  </button>
                  <HoverSummary versions={versions} />
                </div>
                <button
                  onClick={handleDelete}
                  disabled={locked}
                  className="text-xs text-zinc-400 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                  title="Delete page"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>

          {/* Sub-page tree */}
          <PagePositionTree pageId={pageId} />

          {showInfo && (
            <PageInfoPanel
              createdAt={page.created_at}
              favorite={favorite}
              hasCover={Boolean(page.cover_url)}
              icon={page.icon}
              locked={locked}
              pageId={pageId}
              stats={pageInfo}
              title={title || page.title || "未命名页面"}
              updatedAt={page.updated_at}
              versionsCount={versions.length}
              widePage={widePage}
            />
          )}

          {/* Version history panel (toggled) */}
          {showHistory && (
            <VersionHistoryPanel
              versions={versions}
              onCompare={handleCompareVersion}
              onRestore={handleRestoreVersion}
              onClose={() => setShowHistory(false)}
            />
          )}

          {/* Editor - now loads/saves HTML */}
          <Editor
            ref={editorRef}
            pageId={pageId}
            initialContent={page.content_text}
            editable={!locked}
            onUpdate={handleContentUpdate}
          />

          <BlockComments pageId={pageId} disabled={locked} />

          <PageComments pageId={pageId} disabled={locked} />

          {/* Backlinks - pages that link to this page */}
          <Backlinks pageId={pageId} pageTitle={title || page.title || ""} />
        </div>
      </main>
    </div>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function extractLinkedPageIdsFromHtml(html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return Array.from(doc.querySelectorAll("[data-type='mention'][data-id]"))
    .map((element) => element.getAttribute("data-id"))
    .filter((id): id is string => Boolean(id));
}

interface PageInfoStats {
  blockCount: number;
  characterCount: number;
  codeBlockCount: number;
  fileBlockCount: number;
  linkCount: number;
  tableCount: number;
  wordCount: number;
}

function PageInfoPanel({
  createdAt,
  favorite,
  hasCover,
  icon,
  locked,
  pageId,
  stats,
  title,
  updatedAt,
  versionsCount,
  widePage,
}: {
  createdAt: string;
  favorite: boolean;
  hasCover: boolean;
  icon: string | null;
  locked: boolean;
  pageId: string;
  stats: PageInfoStats;
  title: string;
  updatedAt: string;
  versionsCount: number;
  widePage: boolean;
}) {
  return (
    <section className="mb-6 rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-950/60">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
          页面信息
        </h2>
        <span className="truncate text-xs text-zinc-400">{pageId}</span>
      </div>
      <dl className="grid gap-x-5 gap-y-2 sm:grid-cols-2">
        <PageInfoItem label="标题" value={title} />
        <PageInfoItem label="图标" value={icon || "无"} />
        <PageInfoItem label="创建时间" value={formatInfoDate(createdAt)} />
        <PageInfoItem label="更新时间" value={formatInfoDate(updatedAt)} />
        <PageInfoItem label="词数" value={String(stats.wordCount)} />
        <PageInfoItem label="字符数" value={String(stats.characterCount)} />
        <PageInfoItem label="块数量" value={String(stats.blockCount)} />
        <PageInfoItem label="链接" value={String(stats.linkCount)} />
        <PageInfoItem label="表格" value={String(stats.tableCount)} />
        <PageInfoItem label="代码块" value={String(stats.codeBlockCount)} />
        <PageInfoItem label="文件" value={String(stats.fileBlockCount)} />
        <PageInfoItem label="版本" value={String(versionsCount)} />
        <PageInfoItem label="收藏" value={favorite ? "是" : "否"} />
        <PageInfoItem label="锁定" value={locked ? "是" : "否"} />
        <PageInfoItem label="宽页面" value={widePage ? "是" : "否"} />
        <PageInfoItem label="封面" value={hasCover ? "是" : "否"} />
      </dl>
    </section>
  );
}

function PageInfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] items-baseline gap-3">
      <dt className="text-xs text-zinc-400">{label}</dt>
      <dd className="min-w-0 truncate text-xs text-zinc-700 dark:text-zinc-200">
        {value}
      </dd>
    </div>
  );
}

function getPageInfoStats(html: string): PageInfoStats {
  if (typeof DOMParser === "undefined") {
    return {
      blockCount: 0,
      characterCount: 0,
      codeBlockCount: 0,
      fileBlockCount: 0,
      linkCount: 0,
      tableCount: 0,
      wordCount: 0,
    };
  }

  const doc = new DOMParser().parseFromString(html || "", "text/html");
  const text = doc.body.textContent?.trim() ?? "";
  const words = text.match(/[\p{L}\p{N}_'-]+/gu) ?? [];

  return {
    blockCount: doc.body.querySelectorAll(
      "p,h1,h2,h3,li,blockquote,pre,table,[data-type]"
    ).length,
    characterCount: text.replace(/\s+/g, "").length,
    codeBlockCount: doc.body.querySelectorAll("pre").length,
    fileBlockCount: doc.body.querySelectorAll("[data-type='file-preview']").length,
    linkCount: doc.body.querySelectorAll("a[href]").length,
    tableCount: doc.body.querySelectorAll("table").length,
    wordCount: words.length,
  };
}

function formatInfoDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
