"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import DatabaseProvider from "./DatabaseProvider";
import Sidebar from "@/components/sidebar/Sidebar";
import Editor from "@/components/editor/Editor";
import type { EditorRef } from "@/components/editor/Editor";
import DateDisplay from "@/components/shared/DateDisplay";
import Breadcrumb from "@/components/shared/Breadcrumb";
import IconPicker from "@/components/shared/IconPicker";
import PagePositionTree from "@/components/shared/SubPageTree";
import Backlinks from "@/components/shared/Backlinks";
import { usePage } from "@/hooks/usePage";
import { usePages } from "@/hooks/usePages";
import { useVersions } from "@/hooks/useVersions";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useRouter } from "next/navigation";
import { updateWikiLinks } from "@/lib/db/local/queries";
import { createPage } from "@/lib/db/local/queries";
import { maybeSnapshot, manualSnapshot } from "@/lib/comparison/versioning";
import HoverSummary from "@/components/comparison/HoverSummary";
import VersionHistoryPanel from "@/components/comparison/VersionHistoryPanel";
import type { PageVersion } from "@/lib/utils/types";

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
  const { page, loading, update, remove } = usePage(pageId);
  const { refresh } = usePages();
  const { versions, refresh: refreshVersions } = useVersions(pageId);
  const setCurrentPageId = useWorkspaceStore((s) => s.setCurrentPageId);
  const [title, setTitle] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    setCurrentPageId(pageId);
    return () => setCurrentPageId(null);
  }, [pageId, setCurrentPageId]);

  useEffect(() => {
    if (page) setTitle(page.title);
  }, [page]);

  const handleTitleChange = useCallback(
    async (newTitle: string) => {
      setTitle(newTitle);
      await update({ title: newTitle });
      refresh();
    },
    [update, refresh]
  );

  const handleContentUpdate = useCallback(
    async (html: string, text: string, linkedPageIds: string[]) => {
      await update({ content_text: html });
      // Update wiki link relationships in the database
      await updateWikiLinks(pageId, linkedPageIds);
      // Capture an automatic version snapshot when changes are significant
      const created = await maybeSnapshot(pageId, title || "Untitled", html);
      if (created) refreshVersions();
      refresh();
    },
    [update, refresh, refreshVersions, pageId, title]
  );

  const handleSaveVersion = useCallback(async () => {
    const html = editorRef.current?.getHTML() ?? page?.content_text ?? "";
    const label = window.prompt(
      "Name this version (optional, e.g. “Q3 earnings update”):"
    );
    // A null return means the user cancelled the prompt
    if (label === null) return;
    await manualSnapshot(pageId, title || "Untitled", html, label);
    await refreshVersions();
    setShowHistory(true);
  }, [pageId, title, page, refreshVersions]);

  const handleCompareVersion = useCallback(
    (version: PageVersion) => {
      router.push(`/page/${pageId}/compare?from=${version.id}`);
    },
    [router, pageId]
  );

  const handleRestoreVersion = useCallback(
    async (version: PageVersion) => {
      const ok = window.confirm(
        `Restore this page to v${version.version_num}? Your current content will be saved as a version first.`
      );
      if (!ok) return;
      const currentHtml = editorRef.current?.getHTML() ?? page?.content_text ?? "";
      await manualSnapshot(pageId, title || "Untitled", currentHtml, "Before restore");
      const restored = version.content_text || "";
      await update({ content_text: restored });
      editorRef.current?.setContent(restored);
      await manualSnapshot(
        pageId,
        title || "Untitled",
        restored,
        `Restored from v${version.version_num}`
      );
      await refreshVersions();
      refresh();
    },
    [pageId, title, page, update, refreshVersions, refresh]
  );

  const handleIconChange = useCallback(
    async (icon: string) => {
      await update({ icon });
      refresh();
    },
    [update, refresh]
  );

  const handleDelete = useCallback(async () => {
    await remove();
    await refresh();
    router.push("/");
  }, [remove, refresh, router]);

  const handleAddSubPage = useCallback(async () => {
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
  }, [pageId, refresh, router, update]);

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

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-10">
          {/* Breadcrumb */}
          <Breadcrumb pageId={pageId} />

          {/* Page header */}
          <div className="mb-6">
            <div className="flex items-start gap-2">
              <IconPicker
                currentIcon={page.icon}
                onSelect={handleIconChange}
              />
              <input
                type="text"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Untitled"
                className="w-full text-3xl font-bold bg-transparent border-none outline-none text-zinc-900 dark:text-zinc-100 placeholder-zinc-300 dark:placeholder-zinc-600 mt-1"
              />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <DateDisplay
                createdAt={page.created_at}
                updatedAt={page.updated_at}
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={handleAddSubPage}
                  className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                  title="Add sub-page"
                >
                  + Sub-page
                </button>
                <button
                  onClick={handleSaveVersion}
                  className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                  title="Save a named version snapshot"
                >
                  📌 Save version
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
                  className="text-xs text-zinc-400 hover:text-red-500 transition-colors"
                  title="Delete page"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>

          {/* Sub-page tree */}
          <PagePositionTree pageId={pageId} />

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
            onUpdate={handleContentUpdate}
          />

          {/* Backlinks - pages that link to this page */}
          <Backlinks pageId={pageId} />
        </div>
      </main>
    </div>
  );
}
