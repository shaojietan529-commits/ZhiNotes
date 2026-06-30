"use client";

import {
  readPendingPageDraft,
  rememberPendingPageDraft,
} from "@/lib/pages/pendingPageDrafts";
import {
  readPageRouteHandoff,
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
  const store = useWorkspaceStore.getState();
  if (shouldUpsertLocalFirstNavigationSeed(page, source)) {
    store.upsertPages([page]);
  }
  if (shouldRememberNavigationPendingDraft(page, source)) {
    rememberPendingPageDraft(page);
  }
  rememberPageRouteHandoff(page, source);
}

function shouldUpsertLocalFirstNavigationSeed(
  page: Page,
  source: PageRouteHandoffSource
): boolean {
  if (source.endsWith("-create")) return true;
  const existing = useWorkspaceStore.getState().getPageById(page.id);
  return !existing || !hasSameLocalFirstPageMetadata(existing, page);
}

function hasSameLocalFirstPageMetadata(existing: Page, incoming: Page): boolean {
  return (
    existing.id === incoming.id &&
    existing.owner_id === incoming.owner_id &&
    existing.parent_id === incoming.parent_id &&
    existing.database_id === incoming.database_id &&
    existing.title === incoming.title &&
    existing.icon === incoming.icon &&
    existing.cover_url === incoming.cover_url &&
    existing.properties === incoming.properties &&
    existing.position === incoming.position &&
    existing.depth === incoming.depth &&
    existing.created_at === incoming.created_at &&
    existing.updated_at === incoming.updated_at &&
    existing.deleted_at === incoming.deleted_at &&
    existing.sync_version === incoming.sync_version
  );
}

function shouldRememberNavigationPendingDraft(
  _page: Page,
  source: PageRouteHandoffSource
): boolean {
  return source.endsWith("-create");
}

export function resolveLocalFirstPageNavigationSeed(
  target: LocalFirstPageNavigationTarget
): Page | null {
  return typeof target === "string"
    ? (readPendingPageDraft(target) ??
        useWorkspaceStore.getState().getPageById(target) ??
        readPageRouteHandoff(target) ??
        null)
    : target;
}

export function dispatchLocalFirstPageNavigation(
  target: LocalFirstPageNavigationTarget,
  options: LocalFirstPageNavigationOptions = {}
): boolean {
  if (typeof window === "undefined") return false;
  const page = resolveLocalFirstPageNavigationSeed(target);
  if (page) {
    warmPageShellModule();
    prepareLocalFirstPageNavigation(page, options.source ?? "page-open");
  }
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

export function openLocalFirstPageRoute(
  target: LocalFirstPageNavigationTarget,
  options: LocalFirstPageNavigationOptions = {}
): void {
  const handled = dispatchLocalFirstPageNavigation(target, options);
  if (handled || typeof window === "undefined") return;
  const pageId = typeof target === "string" ? target : target.id;
  const href = `/page/${pageId}`;
  if (options.replace) {
    window.location.replace(href);
  } else {
    window.location.assign(href);
  }
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
