"use client";

import { useState, useEffect } from "react";
import { useLocalFirstPageNavigation } from "@/hooks/useLocalFirstPageNavigation";
import { getBacklinks } from "@/lib/db/local/queries";
import type { Page } from "@/lib/utils/types";
import { formatRelativeDate } from "@/lib/utils/dates";

interface BacklinksProps {
  pageId: string;
}

type ReferencePage = Page & { mentionExcerpt?: string };

const REFERENCE_LABELS = {
  backlinks: "反向链接",
  unlinkedMentions: "未链接提及",
} as const;

export default function Backlinks({ pageId }: BacklinksProps) {
  const openPage = useLocalFirstPageNavigation();
  const [links, setLinks] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const backlinks = await getBacklinks(pageId);
      if (cancelled) return;

      setLinks(backlinks);
      setLoading(false);
    }
    load();

    return () => {
      cancelled = true;
    };
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
          引用
        </h3>
        <span className="text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded-full px-1.5">
          {links.length}
        </span>
      </div>
      {links.length > 0 && (
        <ReferenceSection
          title={REFERENCE_LABELS.backlinks}
          pages={links}
          onNavigate={(page) => openPage(page, { source: "backlink-open" })}
        />
      )}
    </div>
  );
}

function ReferenceSection({
  title,
  pages,
  onNavigate,
}: {
  title: string;
  pages: ReferencePage[];
  onNavigate: (page: ReferencePage) => void;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="mb-1 px-1 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
        {title}
      </p>
      <ul className="space-y-1">
        {pages.map((page) => (
          <li key={page.id}>
            <button
              onClick={() => onNavigate(page)}
              className="group flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              <span className="shrink-0">{page.icon || "📄"}</span>
              <span className="flex-1 truncate text-zinc-700 group-hover:text-zinc-900 dark:text-zinc-300 dark:group-hover:text-zinc-100">
                {page.title || "未命名页面"}
              </span>
              <span className="shrink-0 text-[10px] text-zinc-400">
                {formatRelativeDate(page.updated_at)}
              </span>
            </button>
            {page.mentionExcerpt && (
              <p className="ml-10 mr-3 -mt-1 truncate pb-1 text-xs text-zinc-400">
                {page.mentionExcerpt}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
