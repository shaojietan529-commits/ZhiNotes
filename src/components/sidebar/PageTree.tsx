"use client";

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
  useDeferredValue,
} from "react";
import { useLocalFirstPageNavigation } from "@/hooks/useLocalFirstPageNavigation";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import {
  getNextPosition,
} from "@/lib/db/local/queries";
import { displayPageTitle } from "@/lib/pages/displayTitle";
import {
  getModuleRootIdsSync,
  MODULE_ROOT_IDS_EVENT,
} from "@/lib/pages/moduleWorkspaces";
import { collectMovedPageSnapshots } from "@/lib/pages/pageSnapshotUpdates";
import { usePages } from "@/hooks/usePages";
import type { Page } from "@/lib/utils/types";
import PageContextMenu from "@/components/page/LazyPageContextMenu";

type DropTarget = {
  pageId: string;
  position: "before" | "inside" | "after";
};

const SIDEBAR_PAGE_TREE_INITIAL_ROOT_LIMIT = 36;
const SIDEBAR_PAGE_TREE_ROOT_LIMIT = 80;
const SIDEBAR_PAGE_TREE_INITIAL_CHILD_LIMIT = 20;
const SIDEBAR_PAGE_TREE_CHILD_LIMIT = 40;
const SIDEBAR_PAGE_TREE_IDLE_EXPAND_DELAY_MS = 900;
const EMPTY_PAGE_TREE_CHILDREN: Page[] = [];

function shouldSkipSidebarTreePage(
  page: Page,
  moduleRootIds: Set<string>
): boolean {
  return moduleRootIds.has(page.id);
}

function scheduleSidebarPageTreeIdleTask(
  callback: () => void,
  timeout = SIDEBAR_PAGE_TREE_IDLE_EXPAND_DELAY_MS
): () => void {
  if (typeof window === "undefined") return () => undefined;
  const maybeWindow = window as Window & {
    requestIdleCallback?: (
      cb: () => void,
      options?: { timeout?: number }
    ) => number;
    cancelIdleCallback?: (handle: number) => void;
  };
  if (maybeWindow.requestIdleCallback) {
    const handle = maybeWindow.requestIdleCallback(callback, { timeout });
    return () => maybeWindow.cancelIdleCallback?.(handle);
  }
  const timer = window.setTimeout(callback, timeout);
  return () => window.clearTimeout(timer);
}

function isDescendant(
  pageId: string,
  ancestorId: string,
  pagesById: Map<string, Page>
): boolean {
  let current = pagesById.get(pageId);
  while (current) {
    if (current.id === ancestorId) return true;
    current = current.parent_id ? pagesById.get(current.parent_id) : undefined;
  }
  return false;
}

interface PageTreeItemProps {
  page: Page;
  pagesById: Map<string, Page>;
  childrenByParent: Map<string | null, Page[]>;
  level: number;
  currentPageId: string | null;
  currentPathIds: Set<string>;
  onNavigate: (id: string, page?: Page) => void;
  onPageMutated: (pages: Page[]) => void;
  draggedId: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  dropTarget: DropTarget | null;
  onDropTargetChange: (target: DropTarget | null) => void;
  onContextMenu: (pageId: string, x: number, y: number) => void;
}

function PageTreeItem({
  page,
  pagesById,
  childrenByParent,
  level,
  currentPageId,
  currentPathIds,
  onNavigate,
  onPageMutated,
  draggedId,
  onDragStart,
  onDragEnd,
  dropTarget,
  onDropTargetChange,
  onContextMenu,
}: PageTreeItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [childVisibleLimit, setChildVisibleLimit] = useState(
    SIDEBAR_PAGE_TREE_INITIAL_CHILD_LIMIT
  );
  const rowRef = useRef<HTMLDivElement>(null);

  const children = childrenByParent.get(page.id) ?? EMPTY_PAGE_TREE_CHILDREN;
  const hasChildren = children.length > 0;
  const visibleChildren = useMemo(() => {
    if (children.length <= childVisibleLimit) return children;
    const visible = children.slice(0, childVisibleLimit);
    const childOnCurrentPath = children.find((child) =>
      currentPathIds.has(child.id)
    );
    if (
      childOnCurrentPath &&
      !visible.some((child) => child.id === childOnCurrentPath.id)
    ) {
      visible.splice(
        Math.max(0, Math.min(childVisibleLimit, visible.length) - 1),
        1,
        childOnCurrentPath
      );
    }
    return visible;
  }, [childVisibleLimit, children, currentPathIds]);
  const hiddenChildCount = Math.max(0, children.length - visibleChildren.length);
  const title = displayPageTitle(page.title);

  const isDragged = draggedId === page.id;
  const isCutSource =
    useWorkspaceStore.getState().pageClipboard?.pageId === page.id &&
    useWorkspaceStore.getState().pageClipboard?.mode === "cut";

  const handleAddChild = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const { createOptimisticPageWithCloud } = await import("@/lib/pages/cloudPageMutations");
    const child = createOptimisticPageWithCloud({ parentId: page.id });
    onPageMutated([child]);
    setExpanded(true);
    onNavigate(child.id, child);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", page.id);
    onDragStart(page.id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedId || draggedId === page.id) return;
    if (isDescendant(page.id, draggedId, pagesById)) return;

    const rect = rowRef.current?.getBoundingClientRect();
    if (!rect) return;

    const y = e.clientY - rect.top;
    const ratio = y / rect.height;
    let position: "before" | "inside" | "after";
    if (ratio < 0.25) position = "before";
    else if (ratio > 0.75) position = "after";
    else position = "inside";

    onDropTargetChange({ pageId: page.id, position });
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (
      rowRef.current &&
      !rowRef.current.contains(e.relatedTarget as Node)
    ) {
      if (dropTarget?.pageId === page.id) {
        onDropTargetChange(null);
      }
    }
  };

  const isDropBefore =
    dropTarget?.pageId === page.id && dropTarget.position === "before";
  const isDropInside =
    dropTarget?.pageId === page.id && dropTarget.position === "inside";
  const isDropAfter =
    dropTarget?.pageId === page.id && dropTarget.position === "after";

  // Notion behaviour: hovering "inside" a collapsed page during a drag
  // auto-expands it after a short pause, so you can drop into nested levels.
  useEffect(() => {
    if (!isDropInside || !hasChildren || expanded) return;
    const timer = window.setTimeout(() => setExpanded(true), 600);
    return () => window.clearTimeout(timer);
  }, [isDropInside, hasChildren, expanded]);

  useEffect(() => {
    if (!expanded || !hasChildren) return;
    if (childVisibleLimit >= SIDEBAR_PAGE_TREE_CHILD_LIMIT) return;
    return scheduleSidebarPageTreeIdleTask(() => {
      setChildVisibleLimit((limit) =>
        Math.max(
          limit,
          Math.min(children.length, SIDEBAR_PAGE_TREE_CHILD_LIMIT)
        )
      );
    });
  }, [childVisibleLimit, children.length, expanded, hasChildren]);

  useEffect(() => {
    if (!hasChildren || page.id === currentPageId || !currentPathIds.has(page.id)) {
      return;
    }
    setExpanded(true);
  }, [currentPageId, currentPathIds, hasChildren, page.id]);

  return (
    <li className="relative">
      {/* Drop indicator line — before */}
      {isDropBefore && (
        <div className="absolute left-2 right-2 top-0 h-0.5 bg-blue-500 rounded-full pointer-events-none z-10" />
      )}

      <div
        ref={rowRef}
        className={`group flex items-center gap-0.5 py-1 pr-2 rounded-md text-sm cursor-pointer transition-colors ${
          currentPageId === page.id
            ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
            : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        } ${isDragged ? "opacity-40" : ""} ${isCutSource ? "opacity-50" : ""} ${
          isDropInside
            ? "ring-2 ring-blue-400 ring-inset rounded-md"
            : ""
        }`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => onNavigate(page.id)}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu(page.id, e.clientX, e.clientY);
        }}
        draggable
        onDragStart={handleDragStart}
        onDragEnd={onDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
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
          {page.icon || "\u{1F4C4}"}
        </span>

        {/* Title */}
        <span className="truncate flex-1 ml-1">{title}</span>

        {/* Actions (visible on hover) */}
        {showActions && (
          <button
            onClick={handleAddChild}
            className="shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            title="添加子页面"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        )}

      </div>

      {/* Drop indicator line — after */}
      {isDropAfter && (
        <div className="absolute left-2 right-2 bottom-0 h-0.5 bg-blue-500 rounded-full pointer-events-none z-10" />
      )}

      {/* Children */}
      {expanded && hasChildren && (
        <ul>
          {visibleChildren.map((child) => (
            <PageTreeItem
              key={child.id}
              page={child}
              pagesById={pagesById}
              childrenByParent={childrenByParent}
              level={level + 1}
              currentPageId={currentPageId}
              currentPathIds={currentPathIds}
              onNavigate={onNavigate}
              onPageMutated={onPageMutated}
              draggedId={draggedId}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              dropTarget={dropTarget}
              onDropTargetChange={onDropTargetChange}
              onContextMenu={onContextMenu}
            />
          ))}
          {hiddenChildCount > 0 && (
            <li
              data-testid="sidebar-page-tree-child-windowing-status"
              data-visible-child-pages={visibleChildren.length}
              data-child-page-count={children.length}
              data-hidden-child-count={hiddenChildCount}
              data-local-first-windowing="true"
              className="flex items-center justify-between gap-2 px-2 py-1 text-[11px] leading-4 text-zinc-400 dark:text-zinc-500"
              style={{ paddingLeft: `${(level + 1) * 16 + 32}px` }}
            >
              <span className="min-w-0 truncate">
                先显示 {visibleChildren.length}/{children.length} 个子页面，已折叠 {hiddenChildCount} 个子页面
              </span>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setChildVisibleLimit((limit) =>
                    Math.min(
                      children.length,
                      limit + SIDEBAR_PAGE_TREE_CHILD_LIMIT
                    )
                  );
                }}
                className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                显示更多
              </button>
            </li>
          )}
        </ul>
      )}
    </li>
  );
}

export default function PageTree() {
  const openPage = useLocalFirstPageNavigation();
  const { pages, upsertPages } = usePages();
  const treePages = useDeferredValue(pages);
  const dbReady = useWorkspaceStore((s) => s.dbReady);
  const currentPageId = useWorkspaceStore((s) => s.currentPageId);
  const pagesById = useWorkspaceStore((s) => s.pagesById);
  const [rootVisibleLimit, setRootVisibleLimit] = useState(
    SIDEBAR_PAGE_TREE_INITIAL_ROOT_LIMIT
  );
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    pageId: string;
    x: number;
    y: number;
  } | null>(null);

  const [moduleRootIds, setModuleRootIds] = useState<Set<string>>(
    () => new Set(getModuleRootIdsSync())
  );

  useEffect(() => {
    const refreshModuleRootIds = () => {
      setModuleRootIds(new Set(getModuleRootIdsSync()));
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key?.startsWith("zhinote.moduleRoot.")) {
        refreshModuleRootIds();
      }
    };
    window.addEventListener(MODULE_ROOT_IDS_EVENT, refreshModuleRootIds);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(MODULE_ROOT_IDS_EVENT, refreshModuleRootIds);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const childrenByParent = useMemo(() => {
    const grouped = new Map<string | null, Page[]>();
    for (const page of treePages) {
      // Skip module roots at the index boundary. Their descendants stay grouped
      // under the skipped root id, so they are unreachable without recursively
      // scanning every imported page on each sidebar refresh.
      if (shouldSkipSidebarTreePage(page, moduleRootIds)) continue;
      const list = grouped.get(page.parent_id) ?? [];
      list.push(page);
      grouped.set(page.parent_id, list);
    }
    for (const list of grouped.values()) {
      list.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    }
    return grouped;
  }, [moduleRootIds, treePages]);
  const rootPages = useMemo(
    () =>
      (childrenByParent.get(null) ?? []).filter(
        (page) => !moduleRootIds.has(page.id)
      ),
    [childrenByParent, moduleRootIds]
  );
  const visibleRootPages = useMemo(() => {
    const visible = rootPages.slice(0, rootVisibleLimit);
    const currentRootId = currentPageId
      ? getTopLevelPageId(currentPageId, pagesById)
      : null;
    if (
      currentRootId &&
      rootPages.some((page) => page.id === currentRootId) &&
      !visible.some((page) => page.id === currentRootId)
    ) {
      const currentRoot = pagesById.get(currentRootId);
      if (currentRoot) {
        visible.unshift(currentRoot);
        visible.splice(rootVisibleLimit);
      }
    }
    return visible;
  }, [currentPageId, pagesById, rootPages, rootVisibleLimit]);
  const hiddenRootCount = Math.max(0, rootPages.length - visibleRootPages.length);
  const currentPathIds = useMemo(
    () => getCurrentPagePathIds(currentPageId, pagesById),
    [currentPageId, pagesById]
  );

  useEffect(() => {
    if (rootVisibleLimit >= SIDEBAR_PAGE_TREE_ROOT_LIMIT) return;
    return scheduleSidebarPageTreeIdleTask(() => {
      setRootVisibleLimit((limit) =>
        Math.max(limit, Math.min(rootPages.length, SIDEBAR_PAGE_TREE_ROOT_LIMIT))
      );
    });
  }, [rootPages.length, rootVisibleLimit]);

  const handleNavigate = useCallback(
    (id: string, page?: Page) => {
      openPage(page ?? pagesById.get(id) ?? id, { source: "sidebar-open" });
    },
    [openPage, pagesById]
  );

  const handleDragEnd = useCallback(async () => {
    if (!draggedId || !dropTarget) {
      setDraggedId(null);
      setDropTarget(null);
      return;
    }

    const targetPage = pagesById.get(dropTarget.pageId);
    if (!targetPage) {
      setDraggedId(null);
      setDropTarget(null);
      return;
    }

    if (isDescendant(targetPage.id, draggedId, pagesById)) {
      setDraggedId(null);
      setDropTarget(null);
      return;
    }

    try {
      const { movePageWithCloud } = await import("@/lib/pages/cloudPageMutations");
      let movedPage: Page | null = null;
      if (dropTarget.position === "inside") {
        const pos = await getNextPosition(targetPage.id);
        movedPage = await movePageWithCloud(draggedId, targetPage.id, pos);
      } else {
        const parentId = targetPage.parent_id;
        const siblings =
          childrenByParent.get(parentId) ?? EMPTY_PAGE_TREE_CHILDREN;
        const targetIndex = siblings.findIndex(
          (p) => p.id === targetPage.id
        );
        const insertIndex =
          dropTarget.position === "before" ? targetIndex : targetIndex + 1;

        const prevPos =
          insertIndex > 0 ? (siblings[insertIndex - 1]?.position ?? 0) : 0;
        const nextPos =
          insertIndex < siblings.length
            ? (siblings[insertIndex]?.position ?? prevPos + 2)
            : prevPos + 2;
        const newPosition =
          insertIndex === 0 ? prevPos - 1 : (prevPos + nextPos) / 2;

        movedPage = await movePageWithCloud(draggedId, parentId, newPosition);
      }
      if (movedPage) {
        upsertPages(collectMovedPageSnapshots(pages, movedPage));
      }
    } catch (err) {
      console.error("[ZhiNote] Failed to move page:", err);
    }

    setDraggedId(null);
    setDropTarget(null);
  }, [childrenByParent, draggedId, dropTarget, pages, pagesById, upsertPages]);

  const handleRootDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (draggedId) {
        setDropTarget(null);
      }
    },
    [draggedId]
  );

  const handleRootDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      if (!draggedId) return;

      try {
        const { movePageWithCloud } = await import("@/lib/pages/cloudPageMutations");
        const pos = await getNextPosition(null);
        const movedPage = await movePageWithCloud(draggedId, null, pos);
        if (movedPage) {
          upsertPages(collectMovedPageSnapshots(pages, movedPage));
        }
      } catch (err) {
        console.error("[ZhiNote] Failed to move page to root:", err);
      }

      setDraggedId(null);
      setDropTarget(null);
    },
    [draggedId, pages, upsertPages]
  );

  const handleContextMenu = useCallback(
    (pageId: string, x: number, y: number) => {
      setContextMenu({ pageId, x, y });
    },
    []
  );

  if (pages.length === 0) {
    return (
      <p
        data-testid="sidebar-page-tree-empty-state"
        data-local-cache-ready={String(dbReady)}
        data-local-first-windowing="true"
        className="px-3 py-4 text-center text-xs text-zinc-400"
      >
        {dbReady
          ? "还没有页面，先创建一个页面。"
          : "正在准备本地缓存，页面会先从热缓存显示。"}
      </p>
    );
  }

  return (
    <>
      <ul
        className="space-y-0.5"
        onDragOver={handleRootDragOver}
        onDrop={handleRootDrop}
      >
        {visibleRootPages.map((page) => (
          <PageTreeItem
            key={page.id}
            page={page}
            pagesById={pagesById}
            childrenByParent={childrenByParent}
            level={0}
            currentPageId={currentPageId}
            currentPathIds={currentPathIds}
            onNavigate={handleNavigate}
            onPageMutated={upsertPages}
            draggedId={draggedId}
            onDragStart={setDraggedId}
            onDragEnd={handleDragEnd}
            dropTarget={dropTarget}
            onDropTargetChange={setDropTarget}
            onContextMenu={handleContextMenu}
          />
        ))}
      </ul>

      {hiddenRootCount > 0 && (
        <div
          data-testid="sidebar-page-tree-windowing-status"
          data-visible-root-pages={visibleRootPages.length}
          data-root-page-count={rootPages.length}
          data-hidden-root-count={hiddenRootCount}
          data-local-first-windowing="true"
          className="flex items-center justify-between gap-2 px-3 py-2 text-[11px] leading-4 text-zinc-400 dark:text-zinc-500"
        >
          <span className="min-w-0 truncate">
            先显示 {visibleRootPages.length}/{rootPages.length} 个页面，已折叠 {hiddenRootCount} 个旧页面
          </span>
          <button
            type="button"
            onClick={() =>
              setRootVisibleLimit((limit) =>
                Math.min(rootPages.length, limit + SIDEBAR_PAGE_TREE_ROOT_LIMIT)
              )
            }
            className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            显示更多
          </button>
        </div>
      )}

      {contextMenu && (
        <PageContextMenu
          pageId={contextMenu.pageId}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onOpen={(id) => {
            setContextMenu(null);
            handleNavigate(id);
          }}
          onOpenFull={(id) => {
            setContextMenu(null);
            handleNavigate(id);
          }}
        />
      )}
    </>
  );
}

function getCurrentPagePathIds(
  pageId: string | null,
  pagesById: Map<string, Page>
): Set<string> {
  const path = new Set<string>();
  let current = pageId ? pagesById.get(pageId) ?? null : null;
  while (current) {
    path.add(current.id);
    current = current.parent_id ? pagesById.get(current.parent_id) ?? null : null;
  }
  return path;
}

function getTopLevelPageId(
  pageId: string,
  pagesById: Map<string, Page>
): string | null {
  let current = pagesById.get(pageId) ?? null;
  let topLevel = current;
  while (current?.parent_id) {
    current = pagesById.get(current.parent_id) ?? null;
    if (current) topLevel = current;
  }
  return topLevel?.parent_id === null ? topLevel.id : null;
}
