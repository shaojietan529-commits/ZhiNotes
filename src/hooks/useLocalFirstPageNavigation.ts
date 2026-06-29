"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  prepareLocalFirstPageNavigation,
  resolveLocalFirstPageNavigationSeed,
  warmPageShellModule,
  type LocalFirstPageNavigationOptions,
} from "@/lib/pages/localFirstPageNavigation";
import type { Page } from "@/lib/utils/types";

export function useLocalFirstPageNavigation() {
  const router = useRouter();

  return useCallback(
    (
      target: Page | string,
      options: LocalFirstPageNavigationOptions = {}
    ) => {
      warmPageShellModule();
      const pageId = typeof target === "string" ? target : target.id;
      const page = resolveLocalFirstPageNavigationSeed(target);

      if (page) {
        prepareLocalFirstPageNavigation(page, options.source ?? "page-open");
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
    [router]
  );
}
