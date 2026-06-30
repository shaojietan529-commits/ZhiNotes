"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  buildLocalFirstDatabaseHref,
  warmDatabaseShellModule,
  type LocalFirstDatabaseNavigationOptions,
} from "@/lib/database/localFirstDatabaseNavigation";

export function useLocalFirstDatabaseNavigation() {
  const router = useRouter();

  return useCallback(
    (databaseId: string, options: LocalFirstDatabaseNavigationOptions = {}) => {
      warmDatabaseShellModule();
      const href = buildLocalFirstDatabaseHref(databaseId, options);
      try {
        router.prefetch(href);
      } catch {
        // Prefetch is a speed hint. The route skeleton still gives immediate
        // feedback if the database shell has to finish loading after navigation.
      }
      if (options.replace) {
        router.replace(href);
      } else {
        router.push(href);
      }
    },
    [router]
  );
}
