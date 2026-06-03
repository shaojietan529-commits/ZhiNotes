"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { createPage } from "@/lib/db/local/queries";
import { usePages } from "@/hooks/usePages";
import type { Page } from "@/lib/utils/types";

interface PageTreeItemProps {
  page: Page;
  allPages: Page[];
  level: number;
  currentPageId: string | null;
  onNavigate: (id: string) => void;
  onRefresh: () => void;
}

function PageTreeItem({
  page,
  allPages,
  level,
  currentPageId,
  onNavigate,
  onRefresh,
}: PageTreeItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const children = allPages.filter((p) => p.parent_id === page.id);
  const hasChildren = children.length > 0;

  const handleAddChild = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const child = await createPage({ parentId: page.id });
    onRefresh();
    setExpanded(true);
    onNavigate(child.id);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  return (
    <li>
      <div
        className={`group flex items-center gap-0.5 py-1 pr-2 rounded-md text-sm cursor-pointer transition-colors ${
          currentPageId === page.id
            ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
            : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        }`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => onNavigate(page.id)}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        {/* Expand/collapse toggle */}
        <button
          onClick={handleToggle}
          className={`w-5 h-5 flex items-center justify-center shrink-0 rounded hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors ${
            hasChildren ? "visible" : "invisible"
          }`}
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

        {/* Icon */}
        <span className="shrink-0 w-5 text-center text-sm">
          {page.icon || "📄"}
        </span>

        {/* Title */}
        <span className="truncate flex-1 ml-1">
          {page.title || "未命名"}
        </span>

        {/* Actions (visible on hover) */}
        {showActions && (
          <button
            onClick={handleAddChild}
            className="shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            title="添加子页面"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        )}
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <ul>
          {children.map((child) => (
            <PageTreeItem
              key={child.id}
              page={child}
              allPages={allPages}
              level={level + 1}
              currentPageId={currentPageId}
              onNavigate={onNavigate}
              onRefresh={onRefresh}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function PageTree() {
  const router = useRouter();
  const { pages, refresh } = usePages();
  const currentPageId = useWorkspaceStore((s) => s.currentPageId);

  // Top-level pages (no parent)
  const rootPages = pages.filter((p) => p.parent_id === null);

  const handleNavigate = useCallback(
    (id: string) => {
      router.push(`/page/${id}`);
    },
    [router]
  );

  if (pages.length === 0) {
    return (
      <p className="px-3 py-4 text-xs text-zinc-400 text-center">
        还没有页面，先创建一个页面。
      </p>
    );
  }

  return (
    <ul className="space-y-0.5">
      {rootPages.map((page) => (
        <PageTreeItem
          key={page.id}
          page={page}
          allPages={pages}
          level={0}
          currentPageId={currentPageId}
          onNavigate={handleNavigate}
          onRefresh={refresh}
        />
      ))}
    </ul>
  );
}
