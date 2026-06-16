"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import Sidebar from "@/components/sidebar/Sidebar";
import Editor from "@/components/editor/Editor";
import type { EditorRef } from "@/components/editor/Editor";
import Breadcrumb from "@/components/shared/Breadcrumb";
import IconPicker from "@/components/shared/IconPicker";
import Backlinks from "@/components/shared/Backlinks";
import PageComments from "@/components/shared/PageComments";
import BlockComments, {
  BLOCK_COMMENTS_CHANGED_EVENT,
  INLINE_COMMENT_SELECTED_EVENT,
} from "@/components/shared/BlockComments";
import CommentSidePanel from "@/components/shared/CommentSidePanel";
import PageProperties from "@/components/page/PageProperties";
import PageActionsMenu from "@/components/page/PageActionsMenu";
import ChildPageTree from "@/components/page/ChildPageTree";
import {
  parsePageProperties,
  stringifyPageProperties,
  type PageProperty,
} from "@/lib/pages/pageProperties";
import { usePage } from "@/hooks/usePage";
import { usePages } from "@/hooks/usePages";
import { useVersions } from "@/hooks/useVersions";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useRouter } from "next/navigation";
import {
  createPage,
  updatePage as updatePageRecord,
  updateWikiLinks,
  movePage,
  getNextPosition,
  duplicatePageDeep,
  getBlockComments,
} from "@/lib/db/local/queries";
import MoveToDialog from "@/components/page/MoveToDialog";
import { maybeSnapshot, manualSnapshot } from "@/lib/comparison/versioning";
import VersionHistoryPanel from "@/components/comparison/VersionHistoryPanel";
import type { PageVersion } from "@/lib/utils/types";
import {
  buildPageHtmlDocument,
  buildPageMarkdownDocument,
  exportPageAsHtml,
  exportPageAsMarkdown,
} from "@/lib/export/pageExport";
import { usePageFavorites } from "@/hooks/usePageFavorites";
import {
  PAGE_LOCAL_COMMAND_EVENT,
  type PageLocalCommand,
} from "@/lib/pageLocalCommands";
import {
  buildPageResearchStructureReport,
  type PageResearchStructureAction,
  type PageResearchStructureGate,
  type PageResearchStructureReport,
  type PageResearchStructureSignal,
  type PageResearchStructureStatus,
} from "@/lib/pages/pageResearchStructure";

export default function PageShell({ pageId }: { pageId: string }) {
  return <PageContent pageId={pageId} />;
}

function PageContent({ pageId }: { pageId: string }) {
  const router = useRouter();
  const editorRef = useRef<EditorRef>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const copyNoticeTimeoutRef = useRef<number | null>(null);
  const { page, loading, update, remove } = usePage(pageId);
  const { refresh } = usePages();
  const { versions, refresh: refreshVersions } = useVersions(pageId);
  const setCurrentPageId = useWorkspaceStore((s) => s.setCurrentPageId);
  const [title, setTitle] = useState("");
  const [properties, setProperties] = useState<PageProperty[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [locked, setLocked] = useState(false);
  const [widePage, setWidePage] = useState(false);
  const { isFavorite, toggleFavorite } = usePageFavorites();
  const favorite = isFavorite(pageId);
  const [showInfo, setShowInfo] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const pageClipboard = useWorkspaceStore((s) => s.pageClipboard);
  const setPageClipboard = useWorkspaceStore((s) => s.setPageClipboard);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const [exportingPageStructure, setExportingPageStructure] = useState(false);
  const [applyingResearchActionId, setApplyingResearchActionId] =
    useState<string | null>(null);

  useEffect(() => {
    setCurrentPageId(pageId);
    return () => setCurrentPageId(null);
  }, [pageId, setCurrentPageId]);

  useEffect(() => {
    if (!page) return;
    queueMicrotask(() => {
      setTitle(page.title);
      setProperties(parsePageProperties(page.properties));
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

  // Remember whether the right-hand comment panel is open across pages/sessions.
  useEffect(() => {
    queueMicrotask(() => {
      const value = window.localStorage.getItem("zhinote.page.comments-panel");
      setShowComments(value === "true");
    });
  }, []);

  const handleToggleComments = useCallback(() => {
    setShowComments((current) => {
      const next = !current;
      window.localStorage.setItem(
        "zhinote.page.comments-panel",
        next ? "true" : "false"
      );
      return next;
    });
  }, []);

  // Keep a live count of text comments so the toolbar button can show a badge.
  useEffect(() => {
    let cancelled = false;
    const refreshCount = async () => {
      const rows = await getBlockComments(pageId);
      if (!cancelled) setCommentCount(rows.length);
    };
    queueMicrotask(() => void refreshCount());
    const handleChanged = () => void refreshCount();
    window.addEventListener(BLOCK_COMMENTS_CHANGED_EVENT, handleChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(BLOCK_COMMENTS_CHANGED_EVENT, handleChanged);
    };
  }, [pageId]);

  // Clicking commented text should reveal the panel so the comment is visible.
  useEffect(() => {
    const handleSelected = () => {
      setShowComments(true);
      window.localStorage.setItem("zhinote.page.comments-panel", "true");
    };
    window.addEventListener(INLINE_COMMENT_SELECTED_EVENT, handleSelected);
    return () =>
      window.removeEventListener(INLINE_COMMENT_SELECTED_EVENT, handleSelected);
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

  const handlePropertiesChange = useCallback(
    async (next: PageProperty[]) => {
      if (locked) return;
      setProperties(next);
      await update({ properties: stringifyPageProperties(next) });
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
      "给这个版本命名（可选，例如：Q3 业绩更新）："
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

  const showCopyNotice = useCallback((message: string) => {
    setCopyNotice(message);
    if (copyNoticeTimeoutRef.current !== null) {
      window.clearTimeout(copyNoticeTimeoutRef.current);
    }
    copyNoticeTimeoutRef.current = window.setTimeout(() => {
      setCopyNotice(null);
      copyNoticeTimeoutRef.current = null;
    }, 1800);
  }, []);

  useEffect(() => {
    return () => {
      if (copyNoticeTimeoutRef.current !== null) {
        window.clearTimeout(copyNoticeTimeoutRef.current);
      }
    };
  }, []);

  const handleCopyPageMarkdown = useCallback(async () => {
    const html = editorRef.current?.getHTML() ?? page?.content_text ?? "";
    const markdown = buildPageMarkdownDocument(title || "未命名页面", html);
    const copied = await copyTextToClipboard(markdown, "复制页面 Markdown：");
    showCopyNotice(copied ? "已复制 Markdown" : "请在弹窗中手动复制 Markdown");
  }, [page, showCopyNotice, title]);

  const handleCopyPageHtml = useCallback(async () => {
    const html = editorRef.current?.getHTML() ?? page?.content_text ?? "";
    const exportedHtml = buildPageHtmlDocument(title || "未命名页面", html);
    const copied = await copyTextToClipboard(exportedHtml, "复制页面 HTML：");
    showCopyNotice(copied ? "已复制 HTML" : "请在弹窗中手动复制 HTML");
  }, [page, showCopyNotice, title]);

  const handleCopyPageLink = useCallback(async () => {
    const url = `${window.location.origin}/page/${pageId}`;
    try {
      await window.navigator.clipboard.writeText(url);
      showCopyNotice("已复制页面链接");
    } catch {
      window.prompt("复制页面链接：", url);
    }
  }, [pageId, showCopyNotice]);

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
      if (command === "export-html") {
        handleExportHtml();
        return;
      }
      if (command === "export-markdown") {
        handleExportMarkdown();
        return;
      }
      if (command === "copy-link") {
        void handleCopyPageLink();
        return;
      }
      if (command === "copy-markdown") {
        void handleCopyPageMarkdown();
        return;
      }
      if (command === "copy-html") {
        void handleCopyPageHtml();
        return;
      }
      if (command === "print-pdf") {
        handlePrintPdf();
      }
    };

    window.addEventListener(PAGE_LOCAL_COMMAND_EVENT, handlePageLocalCommand);
    return () =>
      window.removeEventListener(PAGE_LOCAL_COMMAND_EVENT, handlePageLocalCommand);
  }, [
    handleCopyPageHtml,
    handleCopyPageLink,
    handleCopyPageMarkdown,
    handleExportHtml,
    handleExportMarkdown,
    handlePrintPdf,
  ]);

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

  const handleIconRemove = useCallback(async () => {
    if (locked) return;
    await update({ icon: null });
    refresh();
  }, [locked, update, refresh]);

  const handleCoverUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      if (locked) return;
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        window.alert("请选择图片文件作为页面封面。");
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
    const url = window.prompt("封面图片 URL：", page?.cover_url ?? "");
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

  const handleCutPage = useCallback(() => {
    setPageClipboard({ pageId, mode: "cut" });
  }, [pageId, setPageClipboard]);

  const handleCopyPage = useCallback(() => {
    setPageClipboard({ pageId, mode: "copy" });
  }, [pageId, setPageClipboard]);

  const handlePastePage = useCallback(async () => {
    if (!pageClipboard) return;
    if (pageClipboard.mode === "cut") {
      const pos = await getNextPosition(pageId);
      await movePage(pageClipboard.pageId, pageId, pos);
      setPageClipboard(null);
    } else {
      await duplicatePageDeep(pageClipboard.pageId, pageId);
    }
    await refresh();
  }, [pageClipboard, pageId, setPageClipboard, refresh]);

  const handleMoveTo = useCallback(
    async (targetId: string | null) => {
      const pos = await getNextPosition(targetId);
      await movePage(pageId, targetId, pos);
      setShowMoveDialog(false);
      await refresh();
    },
    [pageId, refresh]
  );

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
            <p className="text-zinc-500 mb-4">页面未找到</p>
            <button
              onClick={() => router.push("/")}
              className="text-sm text-blue-500 hover:underline"
            >
              返回首页
            </button>
          </div>
        </main>
      </div>
    );
  }

  const pageStructure = buildPageResearchStructureReport({
    html: page.content_text ?? "",
    title: title || page.title || "未命名页面",
    metadata: {
      favorite,
      hasCover: Boolean(page.cover_url),
      locked,
      versionsCount: versions.length,
      widePage,
    },
  });
  const pageInfo = getPageInfoStats(pageStructure);
  const handleExportPageStructure = () => {
    setExportingPageStructure(true);
    try {
      downloadJsonFile(
        `zhinote-page-research-structure-${fileSafeTimestamp()}.json`,
        {
          format: "zhinote-page-research-structure-export",
          format_version: 1,
          export_status: "local-page-structure-export-only",
          exported_at: new Date().toISOString(),
          page: {
            local_page_id: pageId,
            page_title_included: false,
            page_body_included: false,
          },
          boundary: {
            local_export_only: true,
            includes_page_title: false,
            includes_page_body_text: false,
            includes_linked_page_bodies: false,
            includes_database_row_values: false,
            includes_file_bytes: false,
            includes_tokens_or_credentials: false,
            uploads_data: false,
            connects_cloud_services: false,
            enables_ai: false,
            writes_workspace_data: false,
          },
          report: pageStructure,
        }
      );
    } catch (err) {
      console.error("[Zhinote] Failed to export page research structure:", err);
      window.alert("页面投研结构报告导出失败，请查看控制台。");
    } finally {
      setExportingPageStructure(false);
    }
  };
  const handleApplyResearchAction = async (
    action: PageResearchStructureAction
  ) => {
    if (locked || !action.insert_html.trim()) return;
    setApplyingResearchActionId(action.id);
    try {
      const html = editorRef.current?.appendHtml(action.insert_html);
      if (!html) return;
      await update({ content_text: html });
      await updateWikiLinks(pageId, extractLinkedPageIdsFromHtml(html));
      const created = await maybeSnapshot(
        pageId,
        title || page.title || "未命名页面",
        html
      );
      if (created) await refreshVersions();
      refresh();
    } catch (err) {
      console.error("[Zhinote] Failed to insert research action block:", err);
      window.alert("插入建议结构块失败，请查看控制台。");
    } finally {
      setApplyingResearchActionId(null);
    }
  };

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
                        上传
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
                        移除
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {/* Top bar: nav + breadcrumb on the left, favorite + actions on the right */}
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                title="后退"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
              <button
                type="button"
                onClick={() => router.forward()}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                title="前进"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
              </button>
              <Breadcrumb pageId={pageId} />
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleToggleFavorite}
                className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
                  favorite
                    ? "text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                    : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                }`}
                title={favorite ? "取消收藏" : "添加到收藏"}
              >
                <svg
                  width="15"
                  height="15"
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
              </button>
              <button
                onClick={handleToggleComments}
                className={`relative flex h-7 w-7 items-center justify-center rounded transition-colors ${
                  showComments
                    ? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                    : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                }`}
                title={showComments ? "隐藏评论区" : "显示评论区"}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                {commentCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-medium text-white">
                    {commentCount}
                  </span>
                )}
              </button>
              <PageActionsMenu
                locked={locked}
                widePage={widePage}
                versionsCount={versions.length}
                onAddSubPage={handleAddSubPage}
                onAddCover={() => coverInputRef.current?.click()}
                onToggleLock={handleToggleLock}
                onToggleWidth={handleToggleWidth}
                onSaveVersion={handleSaveVersion}
                onToggleHistory={() => setShowHistory((s) => !s)}
                onToggleInfo={() => setShowInfo((current) => !current)}
                onDuplicate={handleDuplicatePage}
                onCopyLink={() => void handleCopyPageLink()}
                onMoveTo={() => setShowMoveDialog(true)}
                onCut={handleCutPage}
                onCopy={handleCopyPage}
                onPaste={pageClipboard ? () => void handlePastePage() : undefined}
                onExportHtml={handleExportHtml}
                onExportMarkdown={handleExportMarkdown}
                onCopyMarkdown={() => void handleCopyPageMarkdown()}
                onCopyHtml={() => void handleCopyPageHtml()}
                onPrintPdf={handlePrintPdf}
                onDelete={handleDelete}
              />
            </div>
          </div>

          {/* Page header: icon + title */}
          <div className="mb-3">
            <div className="flex items-start gap-2">
              <IconPicker
                currentIcon={page.icon}
                onSelect={handleIconChange}
                onRemove={handleIconRemove}
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
                placeholder="新页面"
                className="zhinote-title-input w-full text-3xl font-bold bg-transparent border-none outline-none text-zinc-900 disabled:cursor-default dark:text-zinc-100 placeholder-zinc-300 dark:placeholder-zinc-600 mt-1"
              />
            </div>
            {copyNotice && (
              <span className="mt-1 inline-block text-xs text-emerald-600 dark:text-emerald-400">
                {copyNotice}
              </span>
            )}
          </div>

          {/* Properties (Notion-style, directly under the title) */}
          <PageProperties
            properties={properties}
            disabled={locked}
            pageId={pageId}
            onChange={handlePropertiesChange}
          />

          {showInfo && (
            <PageInfoPanel
              createdAt={page.created_at}
              favorite={favorite}
              hasCover={Boolean(page.cover_url)}
              icon={page.icon}
              locked={locked}
              pageId={pageId}
              researchStructure={pageStructure}
              applyingResearchActionId={applyingResearchActionId}
              exportingResearchStructure={exportingPageStructure}
              onApplyResearchAction={handleApplyResearchAction}
              onExportResearchStructure={handleExportPageStructure}
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

          {/* Page-level comments sit between properties and the body */}
          <PageComments pageId={pageId} disabled={locked} />

          {/* Industry-chain pages show their sub-page hierarchy up front */}
          <ChildPageTree pageId={pageId} />

          <div className="my-4 border-t border-zinc-100 dark:border-zinc-800" />

          {/* Editor - now loads/saves HTML */}
          <Editor
            ref={editorRef}
            pageId={pageId}
            initialContent={page.content_text}
            editable={!locked}
            onUpdate={handleContentUpdate}
          />

          {/* When the comment panel is open, text comments live there instead
              of stacking at the bottom — avoids showing them twice. */}
          {!showComments && <BlockComments pageId={pageId} disabled={locked} />}

          {/* Backlinks - pages that link to this page */}
          <Backlinks pageId={pageId} pageTitle={title || page.title || ""} />
        </div>

        {showMoveDialog && (
          <MoveToDialog
            pageId={pageId}
            onMove={handleMoveTo}
            onClose={() => setShowMoveDialog(false)}
          />
        )}
      </main>

      {showComments && (
        <CommentSidePanel
          pageId={pageId}
          disabled={locked}
          onClose={handleToggleComments}
        />
      )}
    </div>
  );
}

async function copyTextToClipboard(value: string, promptLabel: string) {
  try {
    if (!window.navigator.clipboard?.writeText) {
      throw new Error("Clipboard API unavailable");
    }
    await window.navigator.clipboard.writeText(value);
    return true;
  } catch {
    window.prompt(promptLabel, value);
    return false;
  }
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
  applyingResearchActionId,
  createdAt,
  exportingResearchStructure,
  favorite,
  hasCover,
  icon,
  locked,
  onApplyResearchAction,
  onExportResearchStructure,
  pageId,
  researchStructure,
  stats,
  title,
  updatedAt,
  versionsCount,
  widePage,
}: {
  applyingResearchActionId: string | null;
  createdAt: string;
  exportingResearchStructure: boolean;
  favorite: boolean;
  hasCover: boolean;
  icon: string | null;
  locked: boolean;
  onApplyResearchAction: (action: PageResearchStructureAction) => void;
  onExportResearchStructure: () => void;
  pageId: string;
  researchStructure: PageResearchStructureReport;
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
      <PageResearchStructurePanel
        applyingActionId={applyingResearchActionId}
        exporting={exportingResearchStructure}
        locked={locked}
        onApplyAction={onApplyResearchAction}
        onExport={onExportResearchStructure}
        report={researchStructure}
      />
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

function PageResearchStructurePanel({
  applyingActionId,
  exporting,
  locked,
  onApplyAction,
  onExport,
  report,
}: {
  applyingActionId: string | null;
  exporting: boolean;
  locked: boolean;
  onApplyAction: (action: PageResearchStructureAction) => void;
  onExport: () => void;
  report: PageResearchStructureReport;
}) {
  return (
    <div className="mt-4 border-t border-zinc-200 pt-3 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            投研结构
          </h3>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            本地页面结构体检，不读取关联页面或数据库行值。
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onExport}
            disabled={exporting}
            className="rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-500 transition-colors hover:border-zinc-300 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-200"
            title="导出本地页面结构报告，不包含页面正文"
          >
            {exporting ? "导出中" : "导出结构报告"}
          </button>
          <PageResearchStructureStatusPill status={report.structure_status} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {report.signals.map((signal) => (
          <PageResearchStructureSignalPill key={signal.id} signal={signal} />
        ))}
      </div>

      <div className="mt-3 divide-y divide-zinc-200 rounded border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {report.gates.map((gate) => (
          <PageResearchStructureGateRow key={gate.id} gate={gate} />
        ))}
      </div>

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between gap-3">
          <div className="text-xs text-zinc-400">下一步队列</div>
          <div className="text-[11px] text-zinc-400">
            {report.next_actions.length} suggested
          </div>
        </div>
        <div className="divide-y divide-zinc-200 rounded border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {report.next_actions.slice(0, 5).map((action) => (
            <PageResearchStructureActionRow
              key={action.id}
              action={action}
              applying={applyingActionId === action.id}
              disabled={locked}
              onApply={onApplyAction}
            />
          ))}
        </div>
      </div>

      {report.outline.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-xs text-zinc-400">页面目录</div>
          <div className="flex flex-wrap gap-1.5">
            {report.outline.map((item) => (
              <span
                key={item.id}
                className="max-w-full truncate rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                title={item.title}
              >
                H{item.level} {item.title}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="mt-3 text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">
        {report.privacy_note}
      </p>
    </div>
  );
}

function PageResearchStructureActionRow({
  action,
  applying,
  disabled,
  onApply,
}: {
  action: PageResearchStructureAction;
  applying: boolean;
  disabled: boolean;
  onApply: (action: PageResearchStructureAction) => void;
}) {
  const priorityClass =
    action.priority === "high"
      ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300"
      : action.priority === "medium"
        ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300"
        : "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300";

  return (
    <div className="px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-xs font-medium text-zinc-700 dark:text-zinc-200">
            {action.label}
          </div>
          <p className="mt-1 text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">
            {action.detail}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${priorityClass}`}
        >
          {action.priority}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 truncate text-[11px] text-zinc-400">
          建议块：{action.suggested_block}
        </div>
        <button
          type="button"
          onClick={() => onApply(action)}
          disabled={disabled || applying}
          className="shrink-0 rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-500 transition-colors hover:border-zinc-300 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-200"
          title={
            disabled
              ? "页面锁定时不能插入结构块"
              : "在当前页面底部插入本地结构块"
          }
        >
          {applying ? "插入中" : "插入结构块"}
        </button>
      </div>
    </div>
  );
}

function PageResearchStructureStatusPill({
  status,
}: {
  status: PageResearchStructureStatus;
}) {
  const labels: Record<PageResearchStructureStatus, string> = {
    ready: "结构完整",
    "needs-structure": "待补结构",
    thin: "内容偏薄",
    empty: "空页面",
  };
  const className =
    status === "ready"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300"
      : status === "needs-structure"
        ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300"
        : "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300";

  return (
    <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] ${className}`}>
      {labels[status]}
    </span>
  );
}

function PageResearchStructureSignalPill({
  signal,
}: {
  signal: PageResearchStructureSignal;
}) {
  const className =
    signal.status === "ready"
      ? "border-emerald-200 bg-white text-emerald-700 dark:border-emerald-900/70 dark:bg-zinc-950 dark:text-emerald-300"
      : signal.status === "review"
        ? "border-amber-200 bg-white text-amber-700 dark:border-amber-900/70 dark:bg-zinc-950 dark:text-amber-300"
        : "border-zinc-200 bg-white text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400";

  return (
    <span
      className={`rounded-full border px-2 py-1 text-[11px] ${className}`}
      title={signal.detail}
    >
      {signal.label}: {signal.value}
    </span>
  );
}

function PageResearchStructureGateRow({
  gate,
}: {
  gate: PageResearchStructureGate;
}) {
  const dotClass =
    gate.status === "ready"
      ? "bg-emerald-500"
      : gate.status === "review"
        ? "bg-amber-500"
        : "bg-zinc-300 dark:bg-zinc-700";

  return (
    <div className="flex gap-3 px-3 py-2">
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <div className="truncate text-xs font-medium text-zinc-700 dark:text-zinc-200">
            {gate.label}
          </div>
          <div className="shrink-0 text-[11px] text-zinc-400">{gate.evidence}</div>
        </div>
        <p className="mt-1 text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">
          {gate.detail}
        </p>
      </div>
    </div>
  );
}

function getPageInfoStats(
  report: PageResearchStructureReport
): PageInfoStats {
  const { summary } = report;
  return {
    blockCount: summary.blocks,
    characterCount: summary.characters,
    codeBlockCount: summary.code_blocks,
    fileBlockCount: summary.file_blocks,
    linkCount: summary.links,
    tableCount: summary.tables,
    wordCount: summary.words,
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

function downloadJsonFile(fileName: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function fileSafeTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}
