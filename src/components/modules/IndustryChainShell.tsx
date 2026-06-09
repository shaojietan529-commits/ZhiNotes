"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/sidebar/Sidebar";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { usePages } from "@/hooks/usePages";
import { createPage, updatePage } from "@/lib/db/local/queries";
import { getModuleRootId } from "@/lib/pages/moduleWorkspaces";
import { displayPageTitle } from "@/lib/pages/displayTitle";
import PageContextMenu from "@/components/page/PageContextMenu";
import type { Page } from "@/lib/utils/types";

// A rotating palette so each top-level sector reads as its own color family.
// The same hue cascades down its descendants, so the eye can trace a branch
// from root to leaf at a glance.
const SECTOR_THEMES = [
  {
    accent: "bg-blue-500",
    chip: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
    rootBg:
      "bg-gradient-to-r from-blue-50 to-white border-blue-200 dark:from-blue-950/40 dark:to-zinc-900 dark:border-blue-900/50",
    hover: "hover:text-blue-600 dark:hover:text-blue-400",
  },
  {
    accent: "bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    rootBg:
      "bg-gradient-to-r from-emerald-50 to-white border-emerald-200 dark:from-emerald-950/40 dark:to-zinc-900 dark:border-emerald-900/50",
    hover: "hover:text-emerald-600 dark:hover:text-emerald-400",
  },
  {
    accent: "bg-purple-500",
    chip: "bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300",
    rootBg:
      "bg-gradient-to-r from-purple-50 to-white border-purple-200 dark:from-purple-950/40 dark:to-zinc-900 dark:border-purple-900/50",
    hover: "hover:text-purple-600 dark:hover:text-purple-400",
  },
  {
    accent: "bg-amber-500",
    chip: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
    rootBg:
      "bg-gradient-to-r from-amber-50 to-white border-amber-200 dark:from-amber-950/40 dark:to-zinc-900 dark:border-amber-900/50",
    hover: "hover:text-amber-600 dark:hover:text-amber-400",
  },
  {
    accent: "bg-rose-500",
    chip: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
    rootBg:
      "bg-gradient-to-r from-rose-50 to-white border-rose-200 dark:from-rose-950/40 dark:to-zinc-900 dark:border-rose-900/50",
    hover: "hover:text-rose-600 dark:hover:text-rose-400",
  },
  {
    accent: "bg-cyan-500",
    chip: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300",
    rootBg:
      "bg-gradient-to-r from-cyan-50 to-white border-cyan-200 dark:from-cyan-950/40 dark:to-zinc-900 dark:border-cyan-900/50",
    hover: "hover:text-cyan-600 dark:hover:text-cyan-400",
  },
] as const;

type SectorTheme = (typeof SECTOR_THEMES)[number];

export default function IndustryChainShell() {
  const router = useRouter();
  const dbReady = useWorkspaceStore((s) => s.dbReady);
  const { pages, refresh } = usePages();
  const [rootId, setRootId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    pageId: string;
    x: number;
    y: number;
  } | null>(null);

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

  // Count every descendant of a node so the root cards can show their scale.
  const countDescendants = useCallback(
    (id: string): number => {
      const children = pages.filter((p) => p.parent_id === id);
      return children.reduce(
        (sum, child) => sum + 1 + countDescendants(child.id),
        0
      );
    },
    [pages]
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
      <main className="flex-1 overflow-y-auto bg-zinc-50/40 dark:bg-zinc-950">
        <div className="mx-auto max-w-4xl px-8 py-10">
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <h1 className="flex items-center gap-2.5 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                <span className="text-3xl">🧭</span> 产业链研究
              </h1>
              <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                分级化的产业链看板。每个节点都是一个页面，可展开、增删、点进去看内容。
              </p>
            </div>
            {rootId && (
              <button
                type="button"
                onClick={() => void addChild(rootId, false)}
                className="shrink-0 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-zinc-700 hover:shadow active:scale-95 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
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
            <div className="rounded-xl border border-dashed border-zinc-300 bg-white py-16 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
              <div className="mb-3 text-4xl">🌱</div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                还没有分类。先建一个一级分类，比如「科技」「医药」「制造」。
              </p>
              <button
                type="button"
                onClick={() => void addChild(rootId, true)}
                className="mt-4 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-600 shadow-sm transition-colors hover:border-zinc-400 hover:text-zinc-800 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
              >
                + 创建第一个分类
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {sectors.map((sector, index) => (
                <SectorCard
                  key={sector.id}
                  sector={sector}
                  allPages={pages}
                  theme={SECTOR_THEMES[index % SECTOR_THEMES.length]}
                  descendantCount={countDescendants(sector.id)}
                  onOpen={(id) => router.push(`/page/${id}`)}
                  onAddChild={(id) => void addChild(id, false)}
                  onRename={(id, title) => void renameNode(id, title)}
                  onContextMenu={(id, x, y) =>
                    setContextMenu({ pageId: id, x, y })
                  }
                />
              ))}
            </div>
          )}

          <p className="mt-8 text-xs leading-5 text-zinc-400">
            提示：单击节点进入页面，双击节点就地重命名；删除和添加内容在节点页面里完成
            （右上角 ••• 菜单）。这里的看板负责浏览、重命名和快速展开整条产业链。
          </p>
        </div>
      </main>

      {contextMenu && (
        <PageContextMenu
          pageId={contextMenu.pageId}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onOpen={(id) => router.push(`/page/${id}`)}
          onOpenFull={(id) => router.push(`/page/${id}`)}
          onChanged={() => void refresh()}
        />
      )}
    </div>
  );
}

// Each top-level sector is rendered as a colored card containing its tree.
function SectorCard({
  sector,
  allPages,
  theme,
  descendantCount,
  onOpen,
  onAddChild,
  onRename,
  onContextMenu,
}: {
  sector: Page;
  allPages: Page[];
  theme: SectorTheme;
  descendantCount: number;
  onOpen: (id: string) => void;
  onAddChild: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onContextMenu: (id: string, x: number, y: number) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(sector.title);
  const children = allPages.filter((p) => p.parent_id === sector.id);
  const hasChildren = children.length > 0;

  const commitRename = () => {
    setRenaming(false);
    const next = draft.trim();
    if (next && next !== sector.title) onRename(sector.id, next);
    else setDraft(sector.title);
  };

  return (
    <section className="group/card overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
      {/* Sector header */}
      <div className={`flex items-center gap-2.5 border-b px-3 py-3 ${theme.rootBg}`}>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/60 dark:hover:bg-zinc-800 ${
            hasChildren ? "visible" : "invisible"
          }`}
          title={expanded ? "折叠" : "展开"}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className={`transition-transform ${expanded ? "rotate-90" : ""}`}
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${theme.accent}`} />
        <span className="shrink-0 text-lg">{sector.icon || "📂"}</span>

        {renaming ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") {
                setDraft(sector.title);
                setRenaming(false);
              }
            }}
            className="min-w-0 flex-1 rounded bg-white px-1.5 py-0.5 text-base font-semibold text-zinc-800 outline-none ring-1 ring-zinc-300 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-600"
          />
        ) : (
          <button
            type="button"
            onClick={() => onOpen(sector.id)}
            onDoubleClick={(e) => {
              e.preventDefault();
              setDraft(sector.title);
              setRenaming(true);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              onContextMenu(sector.id, e.clientX, e.clientY);
            }}
            className={`min-w-0 flex-1 truncate text-left text-base font-semibold text-zinc-800 transition-colors dark:text-zinc-100 ${theme.hover}`}
            title={`${displayPageTitle(sector.title)}（点击进入，双击重命名）`}
          >
            {displayPageTitle(sector.title)}
          </button>
        )}

        {descendantCount > 0 && (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${theme.chip}`}
          >
            {descendantCount} 项
          </span>
        )}

        <button
          type="button"
          onClick={() => {
            onAddChild(sector.id);
            setExpanded(true);
          }}
          className="shrink-0 rounded-md px-2 py-1 text-xs text-zinc-400 opacity-0 transition-all hover:bg-white/60 hover:text-zinc-700 group-hover/card:opacity-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          title="添加下级分类"
        >
          + 下级
        </button>
      </div>

      {/* Sector body */}
      {expanded && (
        <div className="px-3 py-2">
          {hasChildren ? (
            <ul className="space-y-0.5">
              {children.map((child) => (
                <ChainNode
                  key={child.id}
                  node={child}
                  allPages={allPages}
                  theme={theme}
                  level={1}
                  onOpen={onOpen}
                  onAddChild={onAddChild}
                  onRename={onRename}
                  onContextMenu={onContextMenu}
                />
              ))}
            </ul>
          ) : (
            <button
              type="button"
              onClick={() => onAddChild(sector.id)}
              className="w-full rounded-md px-2 py-2 text-left text-xs text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-600 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-300"
            >
              + 添加下级分类（如：半导体、消费电子…）
            </button>
          )}
        </div>
      )}
    </section>
  );
}

// A recursive sub-node (level >= 1). Uses a left guide line and the inherited
// sector color for its connector dot so branches stay visually linked.
function ChainNode({
  node,
  allPages,
  theme,
  level,
  onOpen,
  onAddChild,
  onRename,
  onContextMenu,
}: {
  node: Page;
  allPages: Page[];
  theme: SectorTheme;
  level: number;
  onOpen: (id: string) => void;
  onAddChild: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onContextMenu: (id: string, x: number, y: number) => void;
}) {
  const [expanded, setExpanded] = useState(level < 2);
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

  return (
    <li>
      <div className="group/node flex items-center gap-1.5 rounded-md px-1.5 py-1.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-700 ${
            hasChildren ? "visible" : "invisible"
          }`}
          title={expanded ? "折叠" : "展开"}
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className={`transition-transform ${expanded ? "rotate-90" : ""}`}
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            level === 1 ? theme.accent : "bg-zinc-300 dark:bg-zinc-600"
          }`}
        />
        {node.icon && <span className="shrink-0 text-sm">{node.icon}</span>}

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
            onContextMenu={(e) => {
              e.preventDefault();
              onContextMenu(node.id, e.clientX, e.clientY);
            }}
            className={`min-w-0 flex-1 truncate text-left text-sm text-zinc-700 transition-colors dark:text-zinc-200 ${
              level === 1 ? "font-medium" : ""
            } ${theme.hover}`}
            title={`${displayPageTitle(node.title)}（点击进入，双击重命名）`}
          >
            {displayPageTitle(node.title)}
          </button>
        )}

        {hasChildren && (
          <span className="shrink-0 rounded-full bg-zinc-100 px-1.5 text-[10px] text-zinc-500 dark:bg-zinc-700 dark:text-zinc-300">
            {children.length}
          </span>
        )}

        <button
          type="button"
          onClick={() => {
            onAddChild(node.id);
            setExpanded(true);
          }}
          className="shrink-0 rounded px-1.5 text-xs text-zinc-400 opacity-0 transition-opacity hover:text-zinc-700 group-hover/node:opacity-100 dark:hover:text-zinc-200"
          title="添加下级分类"
        >
          + 下级
        </button>
      </div>

      {expanded && hasChildren && (
        <ul className="ml-[10px] space-y-0.5 border-l border-zinc-200 pl-2.5 dark:border-zinc-700/70">
          {children.map((child) => (
            <ChainNode
              key={child.id}
              node={child}
              allPages={allPages}
              theme={theme}
              level={level + 1}
              onOpen={onOpen}
              onAddChild={onAddChild}
              onRename={onRename}
              onContextMenu={onContextMenu}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
