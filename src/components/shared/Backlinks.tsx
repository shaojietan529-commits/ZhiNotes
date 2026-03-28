"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getBacklinks } from "@/lib/db/local/queries";
import type { Page } from "@/lib/utils/types";
import { formatRelativeDate } from "@/lib/utils/dates";

interface BacklinksProps {
  pageId: string;
}

export default function Backlinks({ pageId }: BacklinksProps) {
  const router = useRouter();
  const [links, setLinks] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const backlinks = await getBacklinks(pageId);
      setLinks(backlinks);
      setLoading(false);
    }
    load();
  }, [pageId]);

  if (loading) return null;
  if (links.length === 0) return null;

  return (
    <div className="mt-10 pt-6 border-t border-zinc-200 dark:border-zinc-700">
      <div className="flex items-center gap-2 mb-3">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-zinc-400"
        >
          <path d="M9 17H7A5 5 0 017 7h2M15 7h2a5 5 0 010 10h-2M8 12h8" />
        </svg>
        <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Backlinks
        </h3>
        <span className="text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded-full px-1.5">
          {links.length}
        </span>
      </div>
      <ul className="space-y-1">
        {links.map((page) => (
          <li key={page.id}>
            <button
              onClick={() => router.push(`/page/${page.id}`)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors group"
            >
              <span className="shrink-0">{page.icon || "📄"}</span>
              <span className="truncate flex-1 text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-100">
                {page.title || "Untitled"}
              </span>
              <span className="text-[10px] text-zinc-400 shrink-0">
                {formatRelativeDate(page.updated_at)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
