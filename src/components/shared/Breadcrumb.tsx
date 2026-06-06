"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getPage } from "@/lib/db/local/queries";
import type { Page } from "@/lib/utils/types";

interface BreadcrumbProps {
  pageId: string;
}

export default function Breadcrumb({ pageId }: BreadcrumbProps) {
  const router = useRouter();
  const [path, setPath] = useState<Page[]>([]);

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

  if (path.length === 0) return null;

  const trail = buildNotionBreadcrumbTrail(path);

  return (
    <nav
      aria-label="页面层级"
      className="mb-5 flex min-w-0 flex-wrap items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400"
    >
      {trail.map((item, index) => (
        <span key={item.key} className="flex min-w-0 items-center gap-1">
          {index > 0 && (
            <span className="text-zinc-300 dark:text-zinc-700">/</span>
          )}
          {item.kind === "ellipsis" ? (
            <span
              className="rounded px-1.5 py-1 text-zinc-400 dark:text-zinc-500"
              title="中间层级已折叠"
            >
              ...
            </span>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (item.page.id !== pageId) router.push(`/page/${item.page.id}`);
              }}
              aria-current={item.page.id === pageId ? "page" : undefined}
              className={`flex min-w-0 max-w-[11rem] items-center gap-1 rounded px-1.5 py-1 transition-colors ${
                item.page.id === pageId
                  ? "font-medium text-zinc-800 dark:text-zinc-100"
                  : "hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              }`}
              title={item.page.title || "未命名页面"}
            >
              <span className="shrink-0">{item.page.icon || "📄"}</span>
              <span className="truncate">
                {item.page.title || "未命名页面"}
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
  | { kind: "ellipsis"; key: "ellipsis" };

function buildNotionBreadcrumbTrail(path: Page[]): BreadcrumbTrailItem[] {
  if (path.length <= 3) {
    return path.map((page): BreadcrumbTrailItem => ({
      kind: "page",
      key: page.id,
      page,
    }));
  }

  const root = path[0]!;
  const previous = path[path.length - 2]!;
  const current = path[path.length - 1]!;

  return [
    { kind: "page", key: root.id, page: root },
    { kind: "ellipsis", key: "ellipsis" },
    { kind: "page", key: previous.id, page: previous },
    { kind: "page", key: current.id, page: current },
  ];
}
