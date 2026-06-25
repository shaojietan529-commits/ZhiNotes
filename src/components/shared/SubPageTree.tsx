"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getPageMetadata, listPageMetadata } from "@/lib/db/local/queries";
import type { Page } from "@/lib/utils/types";

interface PagePositionTreeProps {
  pageId: string;
}

/**
 * Shows the current page's position in the hierarchy:
 * - Parent (if any)
 *   - Siblings (same level, current page highlighted)
 *     - Children of current page
 */
export default function PagePositionTree({ pageId }: PagePositionTreeProps) {
  const router = useRouter();
  const [data, setData] = useState<{
    parent: Page | null;
    siblings: Page[];
    children: Page[];
    grandchildren: Map<string, Page[]>;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const currentPage = await getPageMetadata(pageId);
      if (!currentPage) {
        if (!cancelled) setData(null);
        return;
      }

      const parentId = currentPage.parent_id;
      const [parent, siblings, children] = await Promise.all([
        parentId ? getPageMetadata(parentId) : Promise.resolve(null),
        listPageMetadata(parentId),
        listPageMetadata(pageId),
      ]);

      // Grandchildren (children of children)
      const grandchildren = new Map<string, Page[]>();
      const grandchildEntries = await Promise.all(
        children.map(async (child) => {
          const grandchildren = await listPageMetadata(child.id);
          return [child.id, grandchildren] as const;
        })
      );
      for (const [childId, gc] of grandchildEntries) {
        if (gc.length > 0) {
          grandchildren.set(childId, gc);
        }
      }

      if (!cancelled) setData({ parent, siblings, children, grandchildren });
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [pageId]);

  if (!data) return null;

  const { parent, siblings, children, grandchildren } = data;

  // Don't show if this is a lone top-level page with no children
  if (!parent && siblings.length <= 1 && children.length === 0) return null;

  const navigate = (id: string) => router.push(`/page/${id}`);

  return (
    <div className="mt-8 mb-4 border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-zinc-500"
        >
          <path d="M21 12H9M21 6H9M21 18H9M5 12H3M5 6H3M5 18H3" />
        </svg>
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          页面结构
        </span>
      </div>

      <div className="px-3 py-3">
        {/* Parent level */}
        {parent && (
          <div className="mb-1">
            <PageRow
              page={parent}
              level={0}
              isCurrent={false}
              isAncestor={true}
              onClick={() => navigate(parent.id)}
            />
          </div>
        )}

        {/* Siblings level (including current page) */}
        <div className={parent ? "ml-5" : ""}>
          {siblings.map((sibling) => {
            const isCurrent = sibling.id === pageId;
            return (
              <div key={sibling.id}>
                <PageRow
                  page={sibling}
                  level={0}
                  isCurrent={isCurrent}
                  isAncestor={false}
                  onClick={() => navigate(sibling.id)}
                />

                {/* Children - only show under the current page */}
                {isCurrent && children.length > 0 && (
                  <div className="ml-5">
                    {children.map((child) => {
                      const gc = grandchildren.get(child.id);
                      return (
                        <div key={child.id}>
                          <PageRow
                            page={child}
                            level={0}
                            isCurrent={false}
                            isAncestor={false}
                            childCount={gc?.length}
                            onClick={() => navigate(child.id)}
                          />
                          {/* Grandchildren */}
                          {gc && (
                            <div className="ml-5">
                              {gc.map((grandchild) => (
                                <PageRow
                                  key={grandchild.id}
                                  page={grandchild}
                                  level={0}
                                  isCurrent={false}
                                  isAncestor={false}
                                  dimmed
                                  onClick={() => navigate(grandchild.id)}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PageRow({
  page,
  level,
  isCurrent,
  isAncestor,
  dimmed,
  childCount,
  onClick,
}: {
  page: Page;
  level: number;
  isCurrent: boolean;
  isAncestor: boolean;
  dimmed?: boolean;
  childCount?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-1.5 py-1 px-2 rounded text-sm text-left transition-colors ${
        isCurrent
          ? "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-medium border border-blue-200 dark:border-blue-800"
          : isAncestor
            ? "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            : dimmed
              ? "text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs"
              : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
      }`}
      style={{ paddingLeft: `${level * 20 + 8}px` }}
    >
      {/* Connector */}
      <span className="text-zinc-300 dark:text-zinc-600 select-none text-xs w-3">
        {isCurrent ? "▸" : isAncestor ? "" : "├"}
      </span>

      {/* Icon */}
      <span className="shrink-0">{page.icon || "📄"}</span>

      {/* Title */}
      <span className="truncate flex-1">
        {page.title || "未命名页面"}
      </span>

      {/* Current page indicator */}
      {isCurrent && (
        <span className="text-[10px] text-blue-500 dark:text-blue-400 bg-blue-100 dark:bg-blue-900 rounded px-1.5 shrink-0">
          当前页
        </span>
      )}

      {/* Child count */}
      {childCount && childCount > 0 && (
        <span className="text-[10px] text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded-full px-1.5 shrink-0">
          {childCount}
        </span>
      )}
    </button>
  );
}
