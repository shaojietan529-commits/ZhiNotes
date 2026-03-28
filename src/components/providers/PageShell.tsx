"use client";

import { useCallback, useEffect, useState } from "react";
import DatabaseProvider from "./DatabaseProvider";
import Sidebar from "@/components/sidebar/Sidebar";
import Editor from "@/components/editor/Editor";
import DateDisplay from "@/components/shared/DateDisplay";
import Breadcrumb from "@/components/shared/Breadcrumb";
import IconPicker from "@/components/shared/IconPicker";
import { usePage } from "@/hooks/usePage";
import { usePages } from "@/hooks/usePages";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useRouter } from "next/navigation";
import { createPage } from "@/lib/db/local/queries";

export default function PageShell({ pageId }: { pageId: string }) {
  return (
    <DatabaseProvider>
      <PageContent pageId={pageId} />
    </DatabaseProvider>
  );
}

function PageContent({ pageId }: { pageId: string }) {
  const router = useRouter();
  const { page, loading, update, remove } = usePage(pageId);
  const { refresh } = usePages();
  const setCurrentPageId = useWorkspaceStore((s) => s.setCurrentPageId);
  const [title, setTitle] = useState("");

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
    async (text: string) => {
      await update({ content_text: text });
      refresh();
    },
    [update, refresh]
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
    const child = await createPage({ parentId: pageId });
    await refresh();
    router.push(`/page/${child.id}`);
  }, [pageId, refresh, router]);

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
                  onClick={handleDelete}
                  className="text-xs text-zinc-400 hover:text-red-500 transition-colors"
                  title="Delete page"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>

          {/* Editor */}
          <Editor
            pageId={pageId}
            initialContent={page.content_text}
            onUpdate={handleContentUpdate}
          />
        </div>
      </main>
    </div>
  );
}
