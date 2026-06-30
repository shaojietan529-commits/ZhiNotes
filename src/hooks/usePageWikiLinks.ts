"use client";

import { useEffect, useMemo, useState } from "react";
import {
  listWikiLinksBySourcePageIds,
  type WikiLinkRecord,
} from "@/lib/db/local/queries";
import type { Page } from "@/lib/utils/types";

export function usePageWikiLinks(pages: Page[]): WikiLinkRecord[] {
  const [wikiLinks, setWikiLinks] = useState<WikiLinkRecord[]>([]);
  const pageIdKey = useMemo(
    () =>
      pages
        .map((page) => page.id)
        .sort()
        .join("\0"),
    [pages]
  );
  const pageIds = useMemo(
    () => (pageIdKey ? pageIdKey.split("\0") : []),
    [pageIdKey]
  );

  useEffect(() => {
    let cancelled = false;

    if (pageIds.length === 0) {
      return () => {
        cancelled = true;
      };
    }

    void listWikiLinksBySourcePageIds(pageIds)
      .then((nextWikiLinks) => {
        if (!cancelled) setWikiLinks(nextWikiLinks);
      })
      .catch((err) => {
        console.error("[Zhinote] Failed to load page wiki links:", err);
        if (!cancelled) setWikiLinks([]);
      });

    return () => {
      cancelled = true;
    };
  }, [pageIdKey, pageIds]);

  return pageIds.length === 0 ? [] : wikiLinks;
}
