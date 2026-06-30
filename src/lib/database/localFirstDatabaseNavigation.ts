"use client";

export interface LocalFirstDatabaseNavigationOptions {
  replace?: boolean;
  search?: string | URLSearchParams;
  hash?: string;
}

interface LocalFirstDatabaseNavigationEventDetail
  extends LocalFirstDatabaseNavigationOptions {
  databaseId: string;
  handled: boolean;
}

const LOCAL_FIRST_DATABASE_NAVIGATION_EVENT =
  "zhinote.localFirstDatabaseNavigation.v1";

let databaseShellWarmupPromise: Promise<unknown> | null = null;

function normalizeSearch(search: LocalFirstDatabaseNavigationOptions["search"]) {
  if (!search) return "";
  const value = typeof search === "string" ? search : search.toString();
  if (!value) return "";
  return value.startsWith("?") ? value : `?${value}`;
}

function normalizeHash(hash: LocalFirstDatabaseNavigationOptions["hash"]) {
  if (!hash) return "";
  return hash.startsWith("#") ? hash : `#${hash}`;
}

export function buildLocalFirstDatabaseHref(
  databaseId: string,
  options: LocalFirstDatabaseNavigationOptions = {}
) {
  return `/database/${encodeURIComponent(databaseId)}${normalizeSearch(
    options.search
  )}${normalizeHash(options.hash)}`;
}

export function parseLocalFirstDatabaseRoute(route: string):
  | {
      databaseId: string;
      options: LocalFirstDatabaseNavigationOptions;
    }
  | null {
  let url: URL;
  try {
    url = new URL(route, "https://zhinote.local");
  } catch {
    return null;
  }
  if (!url.pathname.startsWith("/database/")) return null;
  const databaseId = decodeURIComponent(url.pathname.slice("/database/".length));
  if (!databaseId || databaseId.includes("/")) return null;
  return {
    databaseId,
    options: {
      search: url.search || undefined,
      hash: url.hash || undefined,
    },
  };
}

export function warmDatabaseShellModule(): void {
  if (!databaseShellWarmupPromise) {
    databaseShellWarmupPromise = import(
      "@/components/providers/DatabasePageShell"
    ).catch(() => {
      databaseShellWarmupPromise = null;
    });
  }
}

export function dispatchLocalFirstDatabaseNavigation(
  databaseId: string,
  options: LocalFirstDatabaseNavigationOptions = {}
): boolean {
  if (typeof window === "undefined") return false;
  warmDatabaseShellModule();
  const detail: LocalFirstDatabaseNavigationEventDetail = {
    databaseId,
    replace: options.replace,
    search: normalizeSearch(options.search) || undefined,
    hash: normalizeHash(options.hash) || undefined,
    handled: false,
  };
  window.dispatchEvent(
    new CustomEvent(LOCAL_FIRST_DATABASE_NAVIGATION_EVENT, { detail })
  );
  return detail.handled;
}

export function openLocalFirstDatabaseRoute(
  databaseId: string,
  options: LocalFirstDatabaseNavigationOptions = {}
): void {
  const handled = dispatchLocalFirstDatabaseNavigation(databaseId, options);
  if (handled || typeof window === "undefined") return;
  const href = buildLocalFirstDatabaseHref(databaseId, options);
  if (options.replace) {
    window.location.replace(href);
  } else {
    window.location.assign(href);
  }
}

export function subscribeLocalFirstDatabaseNavigation(
  handler: (
    databaseId: string,
    options: LocalFirstDatabaseNavigationOptions
  ) => void
): () => void {
  if (typeof window === "undefined") return () => undefined;
  const listener = (event: Event) => {
    const detail = (
      event as CustomEvent<LocalFirstDatabaseNavigationEventDetail>
    ).detail;
    if (!detail?.databaseId) return;
    detail.handled = true;
    handler(detail.databaseId, {
      replace: detail.replace,
      search: detail.search,
      hash: detail.hash,
    });
  };
  window.addEventListener(LOCAL_FIRST_DATABASE_NAVIGATION_EVENT, listener);
  return () =>
    window.removeEventListener(LOCAL_FIRST_DATABASE_NAVIGATION_EVENT, listener);
}
