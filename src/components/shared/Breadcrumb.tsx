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
  const [ancestors, setAncestors] = useState<Page[]>([]);

  useEffect(() => {
    async function loadAncestors() {
      const chain: Page[] = [];
      let currentId: string | null = pageId;

      // Walk up the parent chain
      while (currentId) {
        const page = await getPage(currentId);
        if (!page) break;
        chain.unshift(page);
        currentId = page.parent_id;
      }

      // Remove the current page from the chain (it's shown as the title)
      if (chain.length > 0) chain.pop();
      setAncestors(chain);
    }

    loadAncestors();
  }, [pageId]);

  if (ancestors.length === 0) return null;

  return (
    <nav className="flex items-center gap-1 text-xs text-zinc-400 mb-4 flex-wrap">
      <button
        onClick={() => router.push("/")}
        className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
      >
        Home
      </button>
      {ancestors.map((ancestor) => (
        <span key={ancestor.id} className="flex items-center gap-1">
          <span className="text-zinc-300 dark:text-zinc-600">/</span>
          <button
            onClick={() => router.push(`/page/${ancestor.id}`)}
            className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors max-w-[150px] truncate"
          >
            {ancestor.icon ? `${ancestor.icon} ` : ""}
            {ancestor.title || "Untitled"}
          </button>
        </span>
      ))}
    </nav>
  );
}
