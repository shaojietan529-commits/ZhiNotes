"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAllPages } from "@/lib/db/local/queries";
import type { Page } from "@/lib/utils/types";

interface SubPageTreeProps {
  pageId: string;
}

interface TreeNode {
  page: Page;
  children: TreeNode[];
}

function buildTree(allPages: Page[], parentId: string): TreeNode[] {
  const children = allPages.filter((p) => p.parent_id === parentId);
  return children.map((child) => ({
    page: child,
    children: buildTree(allPages, child.id),
  }));
}

function TreeItem({
  node,
  level,
  onNavigate,
}: {
  node: TreeNode;
  level: number;
  onNavigate: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <li>
      <div
        className="flex items-center gap-1.5 group"
        style={{ paddingLeft: `${level * 20}px` }}
      >
        {/* Tree connector line */}
        {level > 0 && (
          <span className="text-zinc-300 dark:text-zinc-600 text-xs select-none">
            └
          </span>
        )}

        {/* Expand/collapse */}
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-4 h-4 flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 shrink-0"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`transition-transform ${expanded ? "rotate-90" : ""}`}
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        {/* Page link */}
        <button
          onClick={() => onNavigate(node.page.id)}
          className="flex items-center gap-1.5 py-1 px-1.5 rounded text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-100"
        >
          <span className="shrink-0">{node.page.icon || "📄"}</span>
          <span className="truncate max-w-[300px]">
            {node.page.title || "Untitled"}
          </span>
        </button>

        {/* Child count badge */}
        {hasChildren && (
          <span className="text-[10px] text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded-full px-1.5">
            {node.children.length}
          </span>
        )}
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <ul>
          {node.children.map((child) => (
            <TreeItem
              key={child.page.id}
              node={child}
              level={level + 1}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function SubPageTree({ pageId }: SubPageTreeProps) {
  const router = useRouter();
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const allPages = await getAllPages();
      const nodes = buildTree(allPages, pageId);
      setTree(nodes);
      setLoading(false);
    }
    load();
  }, [pageId]);

  if (loading) return null;
  if (tree.length === 0) return null;

  const totalDescendants = countDescendants(tree);

  return (
    <div className="mt-8 mb-4 border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
          </svg>
          Sub-pages
        </div>
        <span className="text-xs text-zinc-400">
          {totalDescendants} page{totalDescendants !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Tree */}
      <div className="px-3 py-2">
        <ul>
          {tree.map((node) => (
            <TreeItem
              key={node.page.id}
              node={node}
              level={0}
              onNavigate={(id) => router.push(`/page/${id}`)}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

function countDescendants(nodes: TreeNode[]): number {
  let count = 0;
  for (const node of nodes) {
    count += 1 + countDescendants(node.children);
  }
  return count;
}
