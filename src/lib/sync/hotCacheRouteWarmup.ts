import type { HotCachePreferences } from "@/lib/sync/hotCacheSelectionSettings";

export interface HotCacheRouteWarmupReceipt {
  attempted: number;
  failed: number;
  routeTargets: string[];
  boundary: {
    reads_page_body_text: false;
    reads_page_yjs: false;
    reads_database_row_values: false;
    reads_comment_bodies: false;
    reads_file_bytes: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    enters_sync_log: false;
    prefetches_routes_only: true;
  };
}

export function getHotCacheRouteTargets(
  preferences: HotCachePreferences
): string[] {
  const routeTargets = new Set<string>([
    "/modules/notes",
    "/modules/sync",
    "/page/zhinote-route-prefetch",
  ]);
  if (preferences.keepCurrentMonthDailyNotes) routeTargets.add("/daily");
  if (preferences.keepCurrentMonthMeetings) routeTargets.add("/schedule");
  if (
    preferences.keepActiveDatabases ||
    preferences.pinnedDatabaseIds.length > 0
  ) {
    routeTargets.add("/modules/databases");
  }
  if (preferences.keepRecentFilePreviews) routeTargets.add("/modules/files");
  if (preferences.keepFavoritePages) routeTargets.add("/knowledge-base");
  if (preferences.keepCurrentProjects) routeTargets.add("/modules/projects");
  return [...routeTargets];
}

export function prefetchHotCacheRoutes(
  prefetch: (routeTarget: string) => void,
  preferences: HotCachePreferences
): HotCacheRouteWarmupReceipt {
  const routeTargets = getHotCacheRouteTargets(preferences);
  let failed = 0;
  for (const routeTarget of routeTargets) {
    try {
      prefetch(routeTarget);
    } catch {
      failed += 1;
    }
  }
  return {
    attempted: routeTargets.length,
    failed,
    routeTargets,
    boundary: {
      reads_page_body_text: false,
      reads_page_yjs: false,
      reads_database_row_values: false,
      reads_comment_bodies: false,
      reads_file_bytes: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      enters_sync_log: false,
      prefetches_routes_only: true,
    },
  };
}
