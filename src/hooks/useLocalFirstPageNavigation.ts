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

const LOCAL_FIRST_ROUTE_FALLBACK_MS = 1200;
let localFirstRouteAttempt = 0;

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
      scheduleLocalFirstRouteFallback(href, Boolean(options.replace));
      if (options.replace) {
        router.replace(href);
      } else {
        router.push(href);
      }
    },
    [router]
  );
}

function scheduleLocalFirstRouteFallback(href: string, replace: boolean): void {
  if (typeof window === "undefined") return;
  const attempt = ++localFirstRouteAttempt;
  const startedPath = window.location.pathname;
  window.setTimeout(() => {
    if (attempt !== localFirstRouteAttempt) return;
    if (window.location.pathname === href) return;
    if (window.location.pathname !== startedPath) return;
    if (replace) {
      window.location.replace(href);
    } else {
      window.location.assign(href);
    }
  }, LOCAL_FIRST_ROUTE_FALLBACK_MS);
}
