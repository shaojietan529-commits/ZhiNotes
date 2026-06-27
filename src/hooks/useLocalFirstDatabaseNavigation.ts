"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { warmDatabaseShellModule } from "@/lib/database/localFirstDatabaseNavigation";

interface LocalFirstDatabaseNavigationOptions {
  replace?: boolean;
}

export function useLocalFirstDatabaseNavigation() {
  const router = useRouter();

  return useCallback(
    (databaseId: string, options: LocalFirstDatabaseNavigationOptions = {}) => {
      warmDatabaseShellModule();
      const href = `/database/${databaseId}`;
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

