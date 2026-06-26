import type { SyncLogSummary } from "@/lib/db/local/queries";
import type { StoredPageFile } from "@/lib/files/localStore";
import { parsePageProperties } from "@/lib/pages/pageProperties";
import type { HotCachePreferences } from "@/lib/sync/hotCacheSelectionSettings";
import type { Database, Page } from "@/lib/utils/types";

const ACTIVE_DATABASE_ROUTE_TARGET_LIMIT = 12;
const FAVORITE_PAGE_ROUTE_TARGET_LIMIT = 12;
const CURRENT_PROJECT_ROUTE_TARGET_LIMIT = 12;

export type HotCacheWarmupJobStatus =
  | "ready"
  | "preference-off"
  | "planned"
  | "blocked";

export interface HotCacheWarmupPlanInput {
  pages: Page[];
  databases: Database[];
  files: StoredPageFile[];
  preferences: HotCachePreferences;
  favoriteIds: string[];
  syncSummary: SyncLogSummary | null;
  now?: string;
}

export interface HotCacheWarmupJob {
  id: string;
  title: string;
  status: HotCacheWarmupJobStatus;
  preference_key: keyof HotCachePreferences | "always";
  cloud_source: string;
  local_target: string;
  candidate_count: number;
  estimated_metadata_records: number;
  route_targets: string[];
  action: string;
  reason: string;
  blocked_reason: string | null;
  excluded_private_fields: string[];
}

export interface HotCacheWarmupPlan {
  format: "zhinote-hot-cache-warmup-plan";
  format_version: 1;
  plan_status: "metadata-only-route-warmup";
  architecture_target: "cloud-master-local-hot-cache";
  privacy_boundary: string;
  boundary: {
    reads_page_body_text: false;
    reads_page_yjs: false;
    reads_database_row_values: false;
    reads_comment_bodies: false;
    reads_file_bytes: false;
    reads_file_text: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    mutates_local_cache_records: false;
    prefetches_routes_only: true;
  };
  summary: {
    jobs: number;
    ready: number;
    preference_off: number;
    planned: number;
    blocked: number;
    route_targets: number;
    estimated_metadata_records: number;
    pending_rows_protected: number;
    recent_days: 30 | 90;
    plan_hash: string;
  };
  jobs: HotCacheWarmupJob[];
}

export function buildHotCacheWarmupPlan(
  input: HotCacheWarmupPlanInput
): HotCacheWarmupPlan {
  const now = input.now ? new Date(input.now) : new Date();
  const activePages = input.pages.filter((page) => !page.deleted_at);
  const recentCutoff = addDays(now, -input.preferences.recentDays).toISOString();
  const recentPages = activePages.filter((page) =>
    isAtOrAfter(page.updated_at, recentCutoff)
  );
  const currentMonthDailyPages = activePages.filter((page) =>
    isCurrentMonthDailyPage(page, now)
  );
  const favoriteIdSet = new Set(input.favoriteIds);
  const favoritePages = activePages.filter((page) => favoriteIdSet.has(page.id));
  const projectPages = activePages.filter(isProjectMetadataPage);
  const activeDatabaseRouteTargets =
    input.preferences.keepActiveDatabases
      ? buildActiveDatabaseRouteTargets(input.databases)
      : [];
  const favoritePageRouteTargets = input.preferences.keepFavoritePages
    ? buildFavoritePageRouteTargets(favoritePages)
    : [];
  const currentProjectRouteTargets = input.preferences.keepCurrentProjects
    ? buildCurrentProjectRouteTargets(projectPages)
    : [];
  const pendingRows = input.syncSummary?.pending ?? 0;

  const jobs: HotCacheWarmupJob[] = [
    {
      id: "protect-pending-queue",
      title: "保护待上传队列",
      status: "ready",
      preference_key: "always",
      cloud_source: "sync_log pending rows",
      local_target: "pending queue remains local until cloud ack",
      candidate_count: pendingRows,
      estimated_metadata_records: pendingRows,
      route_targets: ["/modules/sync"],
      action: "预热同步页，优先显示 pending 状态和失败重试入口。",
      reason: "本地级输入体验的底线是未上传内容不能丢。",
      blocked_reason: null,
      excluded_private_fields: ["changed row payload", "page body"],
    },
    {
      id: "recent-pages-metadata",
      title: `最近 ${input.preferences.recentDays} 天页面 metadata`,
      status: "ready",
      preference_key: "always",
      cloud_source: "pages manifest updated_at cursor",
      local_target: "local page metadata cache",
      candidate_count: recentPages.length,
      estimated_metadata_records: recentPages.length,
      route_targets: ["/modules/notes", "/page/zhinote-route-prefetch"],
      action: "预热页面路由和笔记模块，列表先显示 metadata，正文按打开时补齐。",
      reason: "最近内容是最常切换的区域，应避免刷新后空白等待。",
      blocked_reason: null,
      excluded_private_fields: ["page body", "raw page id", "page title export"],
    },
    {
      id: "current-month-daily-notes",
      title: "当前月份每日纪要",
      status: input.preferences.keepCurrentMonthDailyNotes
        ? "ready"
        : "preference-off",
      preference_key: "keepCurrentMonthDailyNotes",
      cloud_source: "daily date metadata index",
      local_target: "daily calendar metadata cache",
      candidate_count: input.preferences.keepCurrentMonthDailyNotes
        ? currentMonthDailyPages.length
        : 0,
      estimated_metadata_records: input.preferences.keepCurrentMonthDailyNotes
        ? currentMonthDailyPages.length
        : 0,
      route_targets: input.preferences.keepCurrentMonthDailyNotes
        ? ["/daily"]
        : [],
      action: "预热每日纪要入口和当前月 metadata，日历先显示格子和纪要条。",
      reason: "每日纪要是高频入口，应该优先接近本地速度。",
      blocked_reason: input.preferences.keepCurrentMonthDailyNotes
        ? null
        : "用户未选择当前月份每日纪要常驻本地。",
      excluded_private_fields: ["daily note body", "raw page id", "title"],
    },
    {
      id: "active-database-views",
      title: "打开过的数据库视图",
      status: input.preferences.keepActiveDatabases ? "ready" : "preference-off",
      preference_key: "keepActiveDatabases",
      cloud_source: "database manifest + view cursor",
      local_target: "database schema and view metadata cache",
      candidate_count: input.preferences.keepActiveDatabases
        ? input.databases.length
        : 0,
      estimated_metadata_records: input.preferences.keepActiveDatabases
        ? input.databases.length
        : 0,
      route_targets: input.preferences.keepActiveDatabases
        ? ["/modules/databases", ...activeDatabaseRouteTargets]
        : [],
      action:
        "预热数据库模块入口和最近打开的数据库详情路由，字段和视图 metadata 优先可见，行值继续按需加载。",
      reason: "投研表格如果每次等待云端，会直接影响记录和比较效率。",
      blocked_reason: input.preferences.keepActiveDatabases
        ? null
        : "用户未选择数据库视图常驻本地。",
      excluded_private_fields: ["row cell values", "database description"],
    },
    {
      id: "recent-file-preview-metadata",
      title: "最近文件预览 metadata",
      status: input.preferences.keepRecentFilePreviews
        ? "ready"
        : "preference-off",
      preference_key: "keepRecentFilePreviews",
      cloud_source: "private file manifest",
      local_target: "file preview metadata cache",
      candidate_count: input.preferences.keepRecentFilePreviews
        ? input.files.length
        : 0,
      estimated_metadata_records: input.preferences.keepRecentFilePreviews
        ? input.files.length
        : 0,
      route_targets: input.preferences.keepRecentFilePreviews
        ? ["/modules/files"]
        : [],
      action: "预热文件模块入口，只保留类型、大小和预览状态，原文件按打开时处理。",
      reason: "文件体积大，预热必须先保护成本和隐私。",
      blocked_reason: input.preferences.keepRecentFilePreviews
        ? null
        : "用户未选择最近文件预览 metadata 常驻本地。",
      excluded_private_fields: ["file bytes", "file text", "signed url"],
    },
    {
      id: "favorite-pages",
      title: "收藏页面和重点公司",
      status: input.preferences.keepFavoritePages
        ? favoritePages.length > 0
          ? "ready"
          : "blocked"
        : "preference-off",
      preference_key: "keepFavoritePages",
      cloud_source: "workspaces.settings.page_favorites + local workspace_settings",
      local_target: "pinned page metadata cache",
      candidate_count: input.preferences.keepFavoritePages
        ? favoritePages.length
        : 0,
      estimated_metadata_records: input.preferences.keepFavoritePages
        ? favoritePages.length
        : 0,
      route_targets: input.preferences.keepFavoritePages
        ? ["/knowledge-base", "/modules/company-research", ...favoritePageRouteTargets]
        : [],
      action:
        "预热知识库、公司研究入口和收藏页面详情路由，metadata 优先可见，正文按打开时补齐。",
      reason: "主动固定的研究对象比普通最近内容更重要。",
      blocked_reason:
        input.preferences.keepFavoritePages && favoritePages.length === 0
          ? "当前浏览器还没有可匹配的收藏页面 metadata。"
          : input.preferences.keepFavoritePages
            ? null
            : "用户未选择收藏页面和重点公司常驻本地。",
      excluded_private_fields: [
        "page body",
        "page title export",
        "free-form preference values",
      ],
    },
    {
      id: "current-projects",
      title: "当前项目",
      status: input.preferences.keepCurrentProjects
        ? projectPages.length > 0
          ? "ready"
          : "blocked"
        : "preference-off",
      preference_key: "keepCurrentProjects",
      cloud_source:
        "pages manifest icon/title metadata + future module_settings current_project pins",
      local_target: "project workspace metadata cache",
      candidate_count: input.preferences.keepCurrentProjects
        ? projectPages.length
        : 0,
      estimated_metadata_records: input.preferences.keepCurrentProjects
        ? projectPages.length
        : 0,
      route_targets: input.preferences.keepCurrentProjects
        ? [
            "/modules/projects",
            "/modules/research-graph",
            ...currentProjectRouteTargets,
          ]
        : [],
      action:
        "预热项目、研究图谱入口和当前项目页路由，metadata 优先可见，项目正文按打开时补齐。",
      reason:
        "当前项目通常跨页面、会议和公司；项目入口先出现，切换研究任务时不应等待云端。",
      blocked_reason:
        input.preferences.keepCurrentProjects && projectPages.length === 0
          ? "当前浏览器还没有可匹配的项目页 metadata。"
          : input.preferences.keepCurrentProjects
            ? null
            : "用户未选择当前项目常驻本地。",
      excluded_private_fields: ["project free text", "linked page bodies"],
    },
  ];

  const readyJobs = jobs.filter((job) => job.status === "ready");
  const routeTargets = new Set(readyJobs.flatMap((job) => job.route_targets));
  const estimatedMetadataRecords = readyJobs.reduce(
    (total, job) => total + job.estimated_metadata_records,
    0
  );

  return {
    format: "zhinote-hot-cache-warmup-plan",
    format_version: 1,
    plan_status: "metadata-only-route-warmup",
    architecture_target: "cloud-master-local-hot-cache",
    privacy_boundary:
      "The warmup plan uses metadata counts, user preference booleans, and route targets only. It does not read page bodies, database row values, comment bodies, file bytes, or file text; route prefetch does not upload workspace data or mutate cache records.",
    boundary: {
      reads_page_body_text: false,
      reads_page_yjs: false,
      reads_database_row_values: false,
      reads_comment_bodies: false,
      reads_file_bytes: false,
      reads_file_text: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      mutates_local_cache_records: false,
      prefetches_routes_only: true,
    },
    summary: {
      jobs: jobs.length,
      ready: countByStatus(jobs, "ready"),
      preference_off: countByStatus(jobs, "preference-off"),
      planned: countByStatus(jobs, "planned"),
      blocked: countByStatus(jobs, "blocked"),
      route_targets: routeTargets.size,
      estimated_metadata_records: estimatedMetadataRecords,
      pending_rows_protected: pendingRows,
      recent_days: input.preferences.recentDays,
      plan_hash: stableHash(
        jobs.map((job) => ({
          id: job.id,
          status: job.status,
          candidate_count: job.candidate_count,
          routes: job.route_targets,
        }))
      ),
    },
    jobs,
  };
}

function buildActiveDatabaseRouteTargets(databases: Database[]): string[] {
  return databases
    .filter((database) => !database.deleted_at)
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
    .slice(0, ACTIVE_DATABASE_ROUTE_TARGET_LIMIT)
    .map((database) => `/database/${encodeURIComponent(database.id)}`);
}

function buildFavoritePageRouteTargets(pages: Page[]): string[] {
  return pages
    .filter((page) => !page.deleted_at)
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
    .slice(0, FAVORITE_PAGE_ROUTE_TARGET_LIMIT)
    .map((page) => `/page/${encodeURIComponent(page.id)}`);
}

function buildCurrentProjectRouteTargets(pages: Page[]): string[] {
  return pages
    .filter((page) => !page.deleted_at)
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
    .slice(0, CURRENT_PROJECT_ROUTE_TARGET_LIMIT)
    .map((page) => `/page/${encodeURIComponent(page.id)}`);
}

function isProjectMetadataPage(page: Page): boolean {
  const title = page.title || "";
  return (
    page.icon === "PRJ" ||
    title.startsWith("投研项目：") ||
    title.endsWith("项目简报")
  );
}

function isCurrentMonthDailyPage(page: Page, now: Date): boolean {
  const dateKey = readDailyDateKey(page);
  if (dateKey) {
    return dateKey.startsWith(
      `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(
        2,
        "0"
      )}-`
    );
  }
  return isSameMonth(page.updated_at, now);
}

function readDailyDateKey(page: Page): string {
  const props = parsePageProperties(page.properties);
  const dateProperty = props.find((property) => property.name === "日期");
  const value = dateProperty?.value;
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)
    ? value.slice(0, 10)
    : "";
}

function countByStatus(
  jobs: HotCacheWarmupJob[],
  status: HotCacheWarmupJobStatus
): number {
  return jobs.filter((job) => job.status === status).length;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function isAtOrAfter(value: string | null, cutoff: string): boolean {
  if (!value) return false;
  const timestamp = Date.parse(value);
  const cutoffTimestamp = Date.parse(cutoff);
  return Number.isFinite(timestamp) && timestamp >= cutoffTimestamp;
}

function isSameMonth(value: string | null, now: Date): boolean {
  if (!value) return false;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return false;
  return (
    date.getUTCFullYear() === now.getUTCFullYear() &&
    date.getUTCMonth() === now.getUTCMonth()
  );
}

function stableHash(value: unknown): string {
  const source = stableStringify(value);
  let hash = 0x811c9dc5;

  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}
