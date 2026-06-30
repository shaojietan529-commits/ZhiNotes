"use client";

export interface LocalFirstDatabaseNavigationOptions {
  replace?: boolean;
}

interface LocalFirstDatabaseNavigationEventDetail
  extends LocalFirstDatabaseNavigationOptions {
  databaseId: string;
  handled: boolean;
}

const LOCAL_FIRST_DATABASE_NAVIGATION_EVENT =
  "zhinote.localFirstDatabaseNavigation.v1";

let databaseShellWarmupPromise: Promise<unknown> | null = null;

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
  const href = `/database/${databaseId}`;
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
    handler(detail.databaseId, { replace: detail.replace });
  };
  window.addEventListener(LOCAL_FIRST_DATABASE_NAVIGATION_EVENT, listener);
  return () =>
    window.removeEventListener(LOCAL_FIRST_DATABASE_NAVIGATION_EVENT, listener);
}
