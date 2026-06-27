"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { warmModuleRoute as warmModuleRouteShell } from "@/lib/modules/localFirstModuleNavigation";

interface LocalFirstModuleNavigationOptions {
  replace?: boolean;
}

export function useLocalFirstModuleNavigation() {
  const router = useRouter();

  const warmModuleRoute = useCallback(
    (route: string) => {
      warmModuleRouteShell(route);
      try {
        router.prefetch(route);
      } catch {
        // Prefetch is a speed hint. The warm module shell keeps navigation
        // responsive even if Next cannot prefetch the route at this moment.
      }
    },
    [router]
  );

  const openModuleRoute = useCallback(
    (route: string, options: LocalFirstModuleNavigationOptions = {}) => {
      warmModuleRoute(route);
      if (options.replace) {
        router.replace(route);
      } else {
        router.push(route);
      }
    },
    [router, warmModuleRoute]
  );

  return { openModuleRoute, warmModuleRoute };
}
