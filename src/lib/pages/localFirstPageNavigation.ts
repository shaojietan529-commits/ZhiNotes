"use client";

import { rememberPendingPageDraft } from "@/lib/pages/pendingPageDrafts";
import {
  rememberPageRouteHandoff,
  type PageRouteHandoffSource,
} from "@/lib/pages/pageRouteHandoff";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { Page } from "@/lib/utils/types";

export interface LocalFirstPageNavigationOptions {
  source?: PageRouteHandoffSource;
  replace?: boolean;
}

export type LocalFirstPageNavigationTarget = Page | string;

interface LocalFirstPageNavigationEventDetail
  extends LocalFirstPageNavigationOptions {
  target: LocalFirstPageNavigationTarget;
  handled: boolean;
}

const LOCAL_FIRST_PAGE_NAVIGATION_EVENT =
  "zhinote.localFirstPageNavigation.v1";

let pageShellWarmupPromise: Promise<unknown> | null = null;

export function warmPageShellModule(): void {
  if (!pageShellWarmupPromise) {
    pageShellWarmupPromise = import("@/components/providers/PageShell").catch(
      () => {
        pageShellWarmupPromise = null;
      }
    );
  }
}

export function prepareLocalFirstPageNavigation(
  page: Page,
  source: PageRouteHandoffSource = "page-open"
): void {
  useWorkspaceStore.getState().upsertPages([page]);
  rememberPendingPageDraft(page);
  rememberPageRouteHandoff(page, source);
}

export function dispatchLocalFirstPageNavigation(
  target: LocalFirstPageNavigationTarget,
  options: LocalFirstPageNavigationOptions = {}
): boolean {
  if (typeof window === "undefined") return false;
  const detail: LocalFirstPageNavigationEventDetail = {
    target,
    source: options.source,
    replace: options.replace,
    handled: false,
  };
  window.dispatchEvent(
    new CustomEvent(LOCAL_FIRST_PAGE_NAVIGATION_EVENT, { detail })
  );
  return detail.handled;
}

export function subscribeLocalFirstPageNavigation(
  handler: (
    target: LocalFirstPageNavigationTarget,
    options: LocalFirstPageNavigationOptions
  ) => void
): () => void {
  if (typeof window === "undefined") return () => undefined;
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<LocalFirstPageNavigationEventDetail>)
      .detail;
    if (!detail?.target) return;
    detail.handled = true;
    handler(detail.target, {
      source: detail.source,
      replace: detail.replace,
    });
  };
  window.addEventListener(LOCAL_FIRST_PAGE_NAVIGATION_EVENT, listener);
  return () =>
    window.removeEventListener(LOCAL_FIRST_PAGE_NAVIGATION_EVENT, listener);
}
