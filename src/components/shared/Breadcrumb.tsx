"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getPage } from "@/lib/db/local/queries";
import { displayPageTitle } from "@/lib/pages/displayTitle";
import type { Page } from "@/lib/utils/types";

interface BreadcrumbProps {
  pageId: string;
}

export default function Breadcrumb({ pageId }: BreadcrumbProps) {
  const router = useRouter();
  const collapsedMenuRef = useRef<HTMLSpanElement>(null);
  const [path, setPath] = useState<Page[]>([]);
  const [collapsedOpen, setCollapsedOpen] = useState(false);

  useEffect(() => {
    async function loadPath() {
      const chain: Page[] = [];
      let currentId: string | null = pageId;
      const visited = new Set<string>();

      // Walk up the parent chain
      while (currentId) {
        if (visited.has(currentId)) break;
        visited.add(currentId);
        const page = await getPage(currentId);
        if (!page) break;
        chain.unshift(page);
        currentId = page.parent_id;
      }

      setPath(chain);
    }

    loadPath();
  }, [pageId]);

  useEffect(() => {
    if (!collapsedOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        collapsedMenuRef.current?.contains(target)
      ) {
        return;
      }
      setCollapsedOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCollapsedOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [collapsedOpen]);

  if (path.length === 0) return null;

  const trail = buildNotionBreadcrumbTrail(path);

  return (
    <nav
      aria-label="页面层级"
      className="flex min-w-0 flex-wrap items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400"
    >
      {trail.map((item, index) => (
        <span
          key={item.key}
          ref={item.kind === "ellipsis" ? collapsedMenuRef : undefined}
          className="relative flex min-w-0 items-center gap-1"
        >
          {index > 0 && (
            <span className="text-zinc-300 dark:text-zinc-700">/</span>
          )}
          {item.kind === "ellipsis" ? (
            <>
              <button
                type="button"
                aria-expanded={collapsedOpen}
                aria-haspopup="menu"
                onClick={() => setCollapsedOpen((open) => !open)}
                className="rounded px-1.5 py-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                title="展开中间层级"
              >
                ...
              </button>
              {collapsedOpen && (
                <div
                  role="menu"
                  aria-label="已折叠的页面层级"
                  className="absolute left-0 top-full z-30 mt-1 max-h-72 w-56 overflow-y-auto rounded-md border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
                >
                  {item.hiddenPages.map((page) => (
                    <button
                      key={page.id}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setCollapsedOpen(false);
                        router.push(`/page/${page.id}`);
                      }}
                      className="flex w-full min-w-0 items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                      title={displayPageTitle(page.title)}
                    >
                      <span className="shrink-0">{page.icon || "📄"}</span>
                      <span className="truncate">
                        {displayPageTitle(page.title)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (item.page.id !== pageId) {
                  setCollapsedOpen(false);
                  router.push(`/page/${item.page.id}`);
                }
              }}
              aria-current={item.page.id === pageId ? "page" : undefined}
              className={`flex min-w-0 max-w-[11rem] items-center gap-1 rounded px-1.5 py-1 transition-colors ${
                item.page.id === pageId
                  ? "font-medium text-zinc-800 dark:text-zinc-100"
                  : "hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              }`}
              title={displayPageTitle(item.page.title)}
            >
              <span className="shrink-0">{item.page.icon || "📄"}</span>
              <span className="truncate">
                {displayPageTitle(item.page.title)}
              </span>
            </button>
          )}
        </span>
      ))}
    </nav>
  );
}

type BreadcrumbTrailItem =
  | { kind: "page"; key: string; page: Page }
  | { kind: "ellipsis"; key: "ellipsis"; hiddenPages: Page[] };

function buildNotionBreadcrumbTrail(path: Page[]): BreadcrumbTrailItem[] {
  if (path.length <= 3) {
    return path.map((page): BreadcrumbTrailItem => ({
      kind: "page",
      key: page.id,
      page,
    }));
  }

  const root = path[0]!;
  const hiddenPages = path.slice(1, -2);
  const previous = path[path.length - 2]!;
  const current = path[path.length - 1]!;

  return [
    { kind: "page", key: root.id, page: root },
    { kind: "ellipsis", key: "ellipsis", hiddenPages },
    { kind: "page", key: previous.id, page: previous },
    { kind: "page", key: current.id, page: current },
  ];
}
