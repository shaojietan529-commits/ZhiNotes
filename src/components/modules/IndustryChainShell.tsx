"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/sidebar/Sidebar";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { usePages } from "@/hooks/usePages";
import { createPage, updatePage } from "@/lib/db/local/queries";
import { getModuleRootId } from "@/lib/pages/moduleWorkspaces";
import { displayPageTitle } from "@/lib/pages/displayTitle";
import type { Page } from "@/lib/utils/types";

export default function IndustryChainShell() {
  const router = useRouter();
  const dbReady = useWorkspaceStore((s) => s.dbReady);
  const { pages, refresh } = usePages();
  const [rootId, setRootId] = useState<string | null>(null);

  useEffect(() => {
    if (!dbReady) return;
    queueMicrotask(() => {
      void getModuleRootId("industry-chain").then(setRootId);
    });
  }, [dbReady]);

  // Top-level sectors are the direct children of the root page.
  const sectors = useMemo(
    () => (rootId ? pages.filter((p) => p.parent_id === rootId) : []),
    [pages, rootId]
  );

  const addChild = useCallback(
    async (parentId: string, navigate: boolean) => {
      const child = await createPage({ parentId, title: "未命名分类" });
      await refresh();
      if (navigate) router.push(`/page/${child.id}`);
    },
    [refresh, router]
  );

  const renameNode = useCallback(
    async (id: string, title: string) => {
      await updatePage(id, { title });
      await refresh();
    },
    [refresh]
  );

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-8 py-10">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                <span>🧭</span> 产业链研究
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                分级化的产业链看板。每个节点都是一个页面，可展开、增删、点进去看内容。
              </p>
            </div>
            {rootId && (
              <button
                type="button"
                onClick={() => void addChild(rootId, false)}
                className="shrink-0 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                + 新建一级分类
              </button>
            )}
          </div>

          {!rootId ? (
            <div className="py-16 text-center text-sm text-zinc-400">
              正在加载产业链看板…
            </div>
          ) : sectors.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-300 py-16 text-center dark:border-zinc-700">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                还没有分类。先建一个一级分类，比如「科技」「医药」「制造」。
              </p>
              <button
                type="button"
                onClick={() => void addChild(rootId, true)}
                className="mt-3 rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-800 dark:border-zinc-600 dark:text-zinc-300 dark:hover:text-zinc-100"
              >
                + 创建第一个分类
              </button>
            </div>
          ) : (
            <ul className="space-y-1">
              {sectors.map((sector) => (
                <ChainNode
                  key={sector.id}
                  node={sector}
                  allPages={pages}
                  level={0}
                  onOpen={(id) => router.push(`/page/${id}`)}
                  onAddChild={(id) => void addChild(id, false)}
                  onRename={(id, title) => void renameNode(id, title)}
                />
              ))}
            </ul>
          )}

          <p className="mt-8 text-xs leading-5 text-zinc-400">
            提示：单击节点进入页面，双击节点就地重命名；删除和添加内容在节点页面里完成
            （右上角 ••• 菜单）。这里的看板负责浏览、重命名和快速展开整条产业链。
          </p>
        </div>
      </main>
    </div>
  );
}

function ChainNode({
  node,
  allPages,
  level,
  onOpen,
  onAddChild,
  onRename,
}: {
  node: Page;
  allPages: Page[];
  level: number;
  onOpen: (id: string) => void;
  onAddChild: (id: string) => void;
  onRename: (id: string, title: string) => void;
}) {
  const [expanded, setExpanded] = useState(level < 1);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(node.title);
  const children = allPages.filter((p) => p.parent_id === node.id);
  const hasChildren = children.length > 0;

  const commitRename = () => {
    setRenaming(false);
    const next = draft.trim();
    if (next && next !== node.title) onRename(node.id, next);
    else setDraft(node.title);
  };

  // Soften the background by depth so the hierarchy reads at a glance.
  const tint =
    level === 0
      ? "bg-zinc-100 dark:bg-zinc-800/70"
      : level === 1
        ? "bg-zinc-50 dark:bg-zinc-800/40"
        : "bg-white dark:bg-zinc-900";

  return (
    <li>
      <div
        className={`group flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1.5 transition-colors dark:border-zinc-800 ${tint}`}
        style={{ marginLeft: `${level * 20}px` }}
      >
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-700 ${
            hasChildren ? "visible" : "invisible"
          }`}
          title={expanded ? "折叠" : "展开"}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`transition-transform ${expanded ? "rotate-90" : ""}`}
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        <span className="shrink-0">{node.icon || "📄"}</span>

        {renaming ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") {
                setDraft(node.title);
                setRenaming(false);
              }
            }}
            className="min-w-0 flex-1 rounded bg-white px-1 py-0.5 text-sm text-zinc-800 outline-none ring-1 ring-zinc-300 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-600"
          />
        ) : (
          <button
            type="button"
            onClick={() => onOpen(node.id)}
            onDoubleClick={(e) => {
              e.preventDefault();
              setDraft(node.title);
              setRenaming(true);
            }}
            className={`min-w-0 flex-1 truncate text-left text-sm transition-colors hover:text-blue-600 dark:hover:text-blue-400 ${
              level === 0
                ? "font-semibold text-zinc-800 dark:text-zinc-100"
                : "text-zinc-700 dark:text-zinc-200"
            }`}
            title={`${displayPageTitle(node.title)}（点击进入，双击重命名）`}
          >
            {displayPageTitle(node.title)}
          </button>
        )}

        {hasChildren && (
          <span className="shrink-0 rounded-full bg-zinc-200 px-1.5 text-[10px] text-zinc-500 dark:bg-zinc-700 dark:text-zinc-300">
            {children.length}
          </span>
        )}

        <button
          type="button"
          onClick={() => {
            onAddChild(node.id);
            setExpanded(true);
          }}
          className="shrink-0 rounded px-1.5 text-xs text-zinc-400 opacity-0 transition-opacity hover:text-zinc-700 group-hover:opacity-100 dark:hover:text-zinc-200"
          title="添加下级分类"
        >
          + 下级
        </button>
      </div>

      {expanded && hasChildren && (
        <ul className="mt-1 space-y-1">
          {children.map((child) => (
            <ChainNode
              key={child.id}
              node={child}
              allPages={allPages}
              level={level + 1}
              onOpen={onOpen}
              onAddChild={onAddChild}
              onRename={onRename}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
