import { parsePageProperties } from "@/lib/pages/pageProperties";
import type { Page } from "@/lib/utils/types";

export type WebBetaHotDataStatus =
  | "ready"
  | "partial"
  | "manual-confirmation"
  | "blocked";

type PageCacheMetadata = Pick<
  Page,
  "id" | "title" | "icon" | "properties" | "created_at" | "updated_at"
>;

export interface WebBetaHotDataPolicy {
  id: string;
  title: string;
  status: WebBetaHotDataStatus;
  cloud_source: string;
  local_cache_scope: string;
  update_trigger: string;
  eviction_rule: string;
  eligible_count: number;
  route_targets: string[];
  estimated_metadata_records: number;
  reason: string;
  included_metadata_fields: string[];
  excluded_private_fields: string[];
}

export interface WebBetaHotDataPlanInput {
  activePages: PageCacheMetadata[];
  favoritePageIds: string[];
  now?: Date;
}

export interface WebBetaHotDataPlan {
  format: "zhinote-web-beta-hot-data-plan";
  format_version: 1;
  plan_status: "local-cache-plan-only";
  launch_verdict: "not-ready";
  privacy_note: string;
  boundary: {
    local_plan_only: true;
    sends_network_requests: false;
    connects_cloud_services: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    reads_page_body_text: false;
    reads_page_content_yjs: false;
    reads_file_bytes: false;
    stores_meeting_credentials: false;
    requires_owner_confirmation_before_cloud_sync: true;
  };
  summary: {
    policies: number;
    ready: number;
    partial: number;
    manual_confirmation: number;
    blocked: number;
    candidate_pages: number;
    route_targets: number;
    metadata_records: number;
  };
  policies: WebBetaHotDataPolicy[];
}

const CURRENT_MONTH_DAILY_ROUTE_TARGET_LIMIT = 45;
const CURRENT_MONTH_MEETING_ROUTE_TARGET_LIMIT = 60;
const FAVORITE_PAGE_ROUTE_TARGET_LIMIT = 80;
const RECENT_PAGE_ROUTE_TARGET_LIMIT = 50;

const MEETING_METADATA_PROPERTY_NAMES = new Set([
  "会议痕迹",
  "时间状态",
  "录制状态",
  "录制链路",
  "会议优先级",
  "录制任务",
  "转写模型",
  "组织者",
  "平台",
]);

const PAGE_METADATA_FIELDS = [
  "page.id",
  "page.title",
  "page.icon",
  "page.created_at",
  "page.updated_at",
  "page.properties.date",
];

const EXCLUDED_PRIVATE_FIELDS = [
  "page.content_text",
  "page.content_yjs",
  "file.bytes",
  "comment.body",
  "database.field_values",
  "meeting.body",
  "meeting.join_url",
  "meeting.id",
  "meeting.passcode",
  "meeting.transcript",
  "ai.prompt_text",
  "secret.values",
];

export function buildWebBetaHotDataPlan(
  input: WebBetaHotDataPlanInput
): WebBetaHotDataPlan {
  const now = input.now ?? new Date();
  const currentMonthKey = buildLocalMonthKey(now);
  const favorites = new Set(input.favoritePageIds);
  const meetingPages = input.activePages.filter((page) =>
    isCurrentMonthMeetingPage(page, currentMonthKey)
  );
  const dailyPages = input.activePages.filter(
    (page) =>
      !hasMeetingMetadata(page) && isCurrentMonthDailyPage(page, currentMonthKey)
  );
  const favoritePages = input.activePages.filter((page) =>
    favorites.has(page.id)
  );
  const recentPages = [...input.activePages]
    .sort((a, b) => readTime(b.updated_at) - readTime(a.updated_at))
    .slice(0, RECENT_PAGE_ROUTE_TARGET_LIMIT);

  const policies: WebBetaHotDataPolicy[] = [
    buildPolicy({
      id: "current-month-daily",
      title: "当前月份每日纪要",
      status: "partial",
      cloudSource: "daily page date metadata index",
      localCacheScope:
        "预热 /daily 和当前月纪要页面路由；页面正文按打开时再加载",
      updateTrigger:
        "登录后、刷新后、跨日、跨月、远端 metadata cursor 变化后重新计算",
      evictionRule:
        "保留当前月和上一个月 metadata；更早月份只保留用户打开或收藏过的页面",
      pages: dailyPages,
      routeTargets: ["/daily", ...buildPageRouteTargets(dailyPages, CURRENT_MONTH_DAILY_ROUTE_TARGET_LIMIT)],
      reason:
        "每日纪要是投研入口，应先显示日期和标题，避免刷新后空白等待。",
    }),
    buildPolicy({
      id: "current-month-meetings",
      title: "当前月份会议日历",
      status: "partial",
      cloudSource: "meeting page date metadata index",
      localCacheScope:
        "预热 /schedule 和当前月会议页面路由；会议正文和入会凭证按打开时再加载",
      updateTrigger:
        "会议导入、远端 metadata cursor 变化、当前月切换和页面日期属性变化后重新计算",
      evictionRule:
        "保留当前月会议 metadata；跨月后只保留最近打开、收藏或仍未完成的会议",
      pages: meetingPages,
      routeTargets: ["/schedule", ...buildPageRouteTargets(meetingPages, CURRENT_MONTH_MEETING_ROUTE_TARGET_LIMIT)],
      reason:
        "会议日历需要像本地日历一样快速显示，但不能预取入会链接、会议号、密码或转写正文。",
    }),
    buildPolicy({
      id: "favorite-pages",
      title: "收藏页面",
      status: "ready",
      cloudSource: "favorite page id list plus page metadata",
      localCacheScope:
        "预热收藏页面路由、标题、图标和更新时间；正文按打开时再加载",
      updateTrigger:
        "收藏变更、登录后、刷新后和远端 metadata cursor 变化后重新计算",
      evictionRule: "收藏页面 metadata 常驻；取消收藏后降级为最近页面规则",
      pages: favoritePages,
      routeTargets: buildPageRouteTargets(favoritePages, FAVORITE_PAGE_ROUTE_TARGET_LIMIT),
      reason:
        "收藏页面通常是用户最常打开的投研工作台，应该优先进入本地热数据集合。",
    }),
    buildPolicy({
      id: "recent-pages",
      title: "最近更新页面",
      status: "ready",
      cloudSource: "page updated_at metadata index",
      localCacheScope:
        "预热最近更新页面路由、标题、图标和更新时间；正文按打开时再加载",
      updateTrigger:
        "页面保存、远端 metadata cursor 变化、登录后和刷新后重新计算",
      evictionRule:
        "保留最近 50 个页面 metadata；超过上限且未收藏、未打开的页面可淘汰",
      pages: recentPages,
      routeTargets: buildPageRouteTargets(recentPages, RECENT_PAGE_ROUTE_TARGET_LIMIT),
      reason:
        "最近编辑内容最可能被连续打开，预热 metadata 和路由能减少页面切换等待。",
    }),
  ];

  return {
    format: "zhinote-web-beta-hot-data-plan",
    format_version: 1,
    plan_status: "local-cache-plan-only",
    launch_verdict: "not-ready",
    privacy_note:
      "Generated locally from page metadata and local favorite ids. This plan does not read page bodies, Yjs content, file bytes, comments, database row values, meeting credentials, transcripts, prompts, tokens, or secret values.",
    boundary: {
      local_plan_only: true,
      sends_network_requests: false,
      connects_cloud_services: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      reads_page_body_text: false,
      reads_page_content_yjs: false,
      reads_file_bytes: false,
      stores_meeting_credentials: false,
      requires_owner_confirmation_before_cloud_sync: true,
    },
    summary: summarizePolicies(policies, input.activePages.length),
    policies,
  };
}

function buildPolicy(input: {
  id: string;
  title: string;
  status: WebBetaHotDataStatus;
  cloudSource: string;
  localCacheScope: string;
  updateTrigger: string;
  evictionRule: string;
  pages: PageCacheMetadata[];
  routeTargets: string[];
  reason: string;
}): WebBetaHotDataPolicy {
  return {
    id: input.id,
    title: input.title,
    status: input.status,
    cloud_source: input.cloudSource,
    local_cache_scope: input.localCacheScope,
    update_trigger: input.updateTrigger,
    eviction_rule: input.evictionRule,
    eligible_count: input.pages.length,
    route_targets: input.routeTargets,
    estimated_metadata_records: input.pages.length,
    reason: input.reason,
    included_metadata_fields: PAGE_METADATA_FIELDS,
    excluded_private_fields: EXCLUDED_PRIVATE_FIELDS,
  };
}

function summarizePolicies(
  policies: WebBetaHotDataPolicy[],
  candidatePages: number
) {
  return policies.reduce(
    (summary, policy) => {
      summary.policies += 1;
      summary.candidate_pages = candidatePages;
      summary.route_targets += policy.route_targets.length;
      summary.metadata_records += policy.estimated_metadata_records;
      if (policy.status === "ready") summary.ready += 1;
      if (policy.status === "partial") summary.partial += 1;
      if (policy.status === "manual-confirmation") summary.manual_confirmation += 1;
      if (policy.status === "blocked") summary.blocked += 1;
      return summary;
    },
    {
      policies: 0,
      ready: 0,
      partial: 0,
      manual_confirmation: 0,
      blocked: 0,
      candidate_pages: candidatePages,
      route_targets: 0,
      metadata_records: 0,
    }
  );
}

function buildPageRouteTargets(
  pages: PageCacheMetadata[],
  limit: number
): string[] {
  return pages
    .slice(0, limit)
    .map((page) => `/page/${encodeURIComponent(page.id)}`);
}

function isCurrentMonthDailyPage(
  page: PageCacheMetadata,
  currentMonthKey: string
): boolean {
  const dateKey = readPageDateKey(page);
  if (dateKey.startsWith(currentMonthKey)) return true;
  return Boolean(
    page.icon === "📅" &&
      normalizeDateKey(page.title).startsWith(currentMonthKey)
  );
}

function isCurrentMonthMeetingPage(
  page: PageCacheMetadata,
  currentMonthKey: string
): boolean {
  return hasMeetingMetadata(page) && readPageDateKey(page).startsWith(currentMonthKey);
}

function hasMeetingMetadata(page: PageCacheMetadata): boolean {
  const properties = parsePageProperties(page.properties);
  return properties.some((property) =>
    MEETING_METADATA_PROPERTY_NAMES.has(property.name)
  );
}

function readPageDateKey(page: PageCacheMetadata): string {
  const properties = parsePageProperties(page.properties);
  const dateValue = properties.find((property) => property.name === "日期")?.value;
  return normalizeDateKey(dateValue) || normalizeDateKey(page.title);
}

function normalizeDateKey(value: string | undefined): string {
  if (!value) return "";
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? "";
}

function buildLocalMonthKey(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function readTime(value: string): number {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}
