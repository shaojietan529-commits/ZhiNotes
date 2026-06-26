"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { rememberPendingPageDraft } from "@/lib/pages/pendingPageDrafts";
import {
  rememberPageRouteHandoff,
  type PageRouteHandoffSource,
} from "@/lib/pages/pageRouteHandoff";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { Page } from "@/lib/utils/types";

interface LocalFirstPageNavigationOptions {
  source?: PageRouteHandoffSource;
  replace?: boolean;
}

export function useLocalFirstPageNavigation() {
  const router = useRouter();
  const upsertPages = useWorkspaceStore((s) => s.upsertPages);

  return useCallback(
    (
      target: Page | string,
      options: LocalFirstPageNavigationOptions = {}
    ) => {
      const pageId = typeof target === "string" ? target : target.id;
      const page =
        typeof target === "string"
          ? useWorkspaceStore
              .getState()
              .pages.find((candidate) => candidate.id === target) ?? null
          : target;

      if (page) {
        upsertPages([page]);
        rememberPendingPageDraft(page);
        rememberPageRouteHandoff(page, options.source ?? "page-open");
        try {
          router.prefetch(`/page/${page.id}`);
        } catch {
          // Prefetch is only a speed hint. The local draft and route handoff
          // already give the page route enough metadata for first paint.
        }
      }

      const href = `/page/${pageId}`;
      if (options.replace) {
        router.replace(href);
      } else {
        router.push(href);
      }
    },
    [router, upsertPages]
  );
}
