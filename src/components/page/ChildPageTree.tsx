"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { usePages } from "@/hooks/usePages";
import { createPage } from "@/lib/db/local/queries";
import { getModuleRootId } from "@/lib/pages/moduleWorkspaces";
import { displayPageTitle } from "@/lib/pages/displayTitle";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { Page } from "@/lib/utils/types";

// Depth-cycled accent colors so each level of the chain reads distinctly.
const LEVEL_DOTS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-purple-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
] as const;

const LEVEL_HOVERS = [
  "hover:text-blue-600 dark:hover:text-blue-400",
  "hover:text-emerald-600 dark:hover:text-emerald-400",
  "hover:text-purple-600 dark:hover:text-purple-400",
  "hover:text-amber-600 dark:hover:text-amber-400",
  "hover:text-rose-600 dark:hover:text-rose-400",
  "hover:text-cyan-600 dark:hover:text-cyan-400",
] as const;

// Shown inside an industry-chain page: a Notion-style tree of all sub-pages,
// so a sector's whole downstream structure is visible from its main page.
export default function ChildPageTree({ pageId }: { pageId: string }) {
  const router = useRouter();
  const dbReady = useWorkspaceStore((s) => s.dbReady);
  const { pages, refresh } = usePages();
  const [chainRootId, setChainRootId] = useState<string | null>(null);

  useEffect(() => {
    if (!dbReady) return;
    queueMicrotask(() => {
      void getModuleRootId("industry-chain").then(setChainRootId);
    });
  }, [dbReady]);

  // Only render on pages that live inside the industry-chain workspace.
  const inChain = useMemo(() => {
    if (!chainRootId) return false;
    const byId = new Map(pages.map((p) => [p.id, p]));
    let cursor: string | null = pageId;
    while (cursor) {
      if (cursor === chainRootId) return true;
      cursor = byId.get(cursor)?.parent_id ?? null;
    }
    return false;
  }, [pages, pageId, chainRootId]);

  const children = useMemo(
    () => pages.filter((p) => p.parent_id === pageId),
    [pages, pageId]
  );

  const addChild = useCallback(
    async (parentId: string) => {
      const child = await createPage({ parentId, title: "未命名分类" });
      await refresh();
      router.push(`/page/${child.id}`);
    },
    [refresh, router]
  );

  if (!inChain || pageId === chainRootId) return null;

  return (
    <section className="my-6 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-2">
          <span className="text-sm">🧭</span>
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
            产业链层级
          </h2>
          {children.length > 0 && (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              {countDescendants(pages, pageId)} 项
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => void addChild(pageId)}
          className="rounded-md px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          title="添加下级分类"
        >
          + 下级
        </button>
      </div>

      {children.length === 0 ? (
        <button
          type="button"
          onClick={() => void addChild(pageId)}
          className="w-full px-4 py-4 text-left text-xs text-zinc-400 transition-colors hover:bg-zinc-100/60 hover:text-zinc-600 dark:hover:bg-zinc-800/40 dark:hover:text-zinc-300"
        >
          还没有下级分类，点这里创建第一个（如：上游材料、中游制造、下游应用…）
        </button>
      ) : (
        <ul className="space-y-0.5 px-3 py-2">
          {children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              allPages={pages}
              level={0}
              onOpen={(id) => router.push(`/page/${id}`)}
              onAddChild={(id) => void addChild(id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function countDescendants(pages: Page[], id: string): number {
  const kids = pages.filter((p) => p.parent_id === id);
  return kids.reduce((sum, kid) => sum + 1 + countDescendants(pages, kid.id), 0);
}

function TreeNode({
  node,
  allPages,
  level,
  onOpen,
  onAddChild,
}: {
  node: Page;
  allPages: Page[];
  level: number;
  onOpen: (id: string) => void;
  onAddChild: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(level < 2);
  const children = allPages.filter((p) => p.parent_id === node.id);
  const hasChildren = children.length > 0;
  const dot = LEVEL_DOTS[level % LEVEL_DOTS.length];
  const hover = LEVEL_HOVERS[level % LEVEL_HOVERS.length];

  return (
    <li>
      <div className="group flex items-center gap-1.5 rounded-md px-1.5 py-1.5 transition-colors hover:bg-white dark:hover:bg-zinc-800/60">
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

        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
        {node.icon && <span className="shrink-0 text-sm">{node.icon}</span>}

        <button
          type="button"
          onClick={() => onOpen(node.id)}
          className={`min-w-0 flex-1 truncate text-left text-sm text-zinc-700 transition-colors dark:text-zinc-200 ${
            level === 0 ? "font-medium" : ""
          } ${hover}`}
          title={displayPageTitle(node.title)}
        >
          {displayPageTitle(node.title)}
        </button>

        {hasChildren && (
          <span className="shrink-0 rounded-full bg-zinc-100 px-1.5 text-[10px] text-zinc-500 dark:bg-zinc-700 dark:text-zinc-300">
            {children.length}
          </span>
        )}

        <button
          type="button"
          onClick={() => onAddChild(node.id)}
          className="shrink-0 rounded px-1.5 text-xs text-zinc-400 opacity-0 transition-opacity hover:text-zinc-700 group-hover:opacity-100 dark:hover:text-zinc-200"
          title="添加下级分类"
        >
          + 下级
        </button>
      </div>

      {expanded && hasChildren && (
        <ul className="ml-[10px] space-y-0.5 border-l border-zinc-200 pl-2.5 dark:border-zinc-700/70">
          {children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              allPages={allPages}
              level={level + 1}
              onOpen={onOpen}
              onAddChild={onAddChild}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
