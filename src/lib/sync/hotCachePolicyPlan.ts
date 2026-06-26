import type {
  PageModuleCounts,
  SyncLogSummary,
} from "@/lib/db/local/queries";
import type { StoredPageFile } from "@/lib/files/localStore";
import { parsePageProperties } from "@/lib/pages/pageProperties";
import type { Database, Page } from "@/lib/utils/types";

export type HotCachePolicyStatus =
  | "default-on"
  | "user-selectable"
  | "never-evict"
  | "planned";

export interface HotCachePolicyPlanInput {
  pages: Page[];
  deletedPages: Page[];
  databases: Database[];
  files: StoredPageFile[];
  pageModuleCounts: Record<string, PageModuleCounts>;
  syncSummary: SyncLogSummary | null;
  now?: string;
}

export interface HotCachePolicy {
  id: string;
  title: string;
  status: HotCachePolicyStatus;
  cloud_source: string;
  local_behavior: string;
  eviction_rule: string;
  eligible_count: number;
  estimated_local_records: number;
  reason: string;
  excluded_private_fields: string[];
}

export interface HotCachePolicyPlan {
  format: "zhinote-hot-cache-policy-plan";
  format_version: 1;
  plan_status: "local-policy-only";
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
    mutates_local_cache: false;
  };
  summary: {
    policies: number;
    default_on: number;
    user_selectable: number;
    never_evict: number;
    planned: number;
    current_local_metadata_records: number;
    estimated_default_hot_records: number;
    pending_sync_rows: number;
    policy_hash: string;
  };
  policies: HotCachePolicy[];
}

export function buildHotCachePolicyPlan(
  input: HotCachePolicyPlanInput
): HotCachePolicyPlan {
  const now = input.now ? new Date(input.now) : new Date();
  const recent30Cutoff = addDays(now, -30).toISOString();
  const recent90Cutoff = addDays(now, -90).toISOString();
  const activePages = input.pages.filter((page) => !page.deleted_at);
  const recent30Pages = activePages.filter((page) =>
    isAtOrAfter(page.updated_at, recent30Cutoff)
  );
  const recent90Pages = activePages.filter((page) =>
    isAtOrAfter(page.updated_at, recent90Cutoff)
  );
  const currentMonthPages = activePages.filter((page) =>
    isSameMonth(page.updated_at, now)
  );
  const currentMonthMeetingPages = activePages.filter((page) =>
    isCurrentMonthMeetingPage(page, now)
  );
  const projectPages = activePages.filter(isProjectMetadataPage);
  const pageModuleRows = Object.values(input.pageModuleCounts);
  const commentCount = pageModuleRows.reduce(
    (total, counts) => total + counts.pageComments + counts.blockComments,
    0
  );
  const wikiLinkCount = pageModuleRows.reduce(
    (total, counts) => total + counts.outgoingLinks + counts.backlinks,
    0
  );
  const localMetadataRecords =
    activePages.length +
    input.deletedPages.length +
    input.databases.length +
    input.files.length +
    commentCount +
    wikiLinkCount;

  const policies: HotCachePolicy[] = [
    {
      id: "pending-sync-never-evict",
      title: "待上传变更永不清理",
      status: "never-evict",
      cloud_source: "sync_log pending rows",
      local_behavior: "离线或失败时继续保留，直到云端确认 synced",
      eviction_rule: "禁止自动清理；只能在同步成功、用户确认或恢复流程完成后移除",
      eligible_count: input.syncSummary?.pending ?? 0,
      estimated_local_records: input.syncSummary?.pending ?? 0,
      reason:
        "这是本地级输入体验的安全底线：先响应用户输入，再后台补传，但未上传编辑不能丢。",
      excluded_private_fields: [
        "changed row payload",
        "page body",
        "database values",
        "file bytes",
      ],
    },
    {
      id: "recent-30-days",
      title: "最近 30 天自动热缓存",
      status: "default-on",
      cloud_source: "pages manifest + updated_at cursor",
      local_behavior: "登录后后台预取最近活跃页面 metadata，正文按打开时补齐",
      eviction_rule: "超过 30 天且不是收藏/项目/重点公司时可降级为 metadata-only",
      eligible_count: recent30Pages.length,
      estimated_local_records: recent30Pages.length,
      reason: "保证最常打开的页面、每日纪要和会议切换接近本地速度。",
      excluded_private_fields: [
        "page body",
        "page title in export",
        "page raw id",
        "database values",
      ],
    },
    {
      id: "recent-90-days-metadata",
      title: "最近 90 天 metadata 缓存",
      status: "default-on",
      cloud_source: "cloud metadata manifest",
      local_behavior: "列表、搜索入口和日历先显示 metadata，再按需拉正文",
      eviction_rule: "超过 90 天且未被用户固定时可从本地移除",
      eligible_count: recent90Pages.length,
      estimated_local_records: recent90Pages.length,
      reason: "减少刷新后的空白等待，让列表先出现，再后台补内容。",
      excluded_private_fields: ["page body", "file bytes", "comment body"],
    },
    {
      id: "current-month-daily-notes",
      title: "当前月份每日纪要",
      status: "user-selectable",
      cloud_source: "daily note date index",
      local_behavior: "当前月日历格子优先从本地 metadata 呈现",
      eviction_rule: "跨月后保留最近月份，旧月份按用户选择缓存",
      eligible_count: currentMonthPages.length,
      estimated_local_records: currentMonthPages.length,
      reason:
        "每日纪要是高频入口，当前月应该避免刷新后长时间空白；后续需要云端日期索引做精确筛选。",
      excluded_private_fields: ["daily note body", "raw page id", "title"],
    },
    {
      id: "current-month-meetings",
      title: "当前月份会议日历",
      status: "user-selectable",
      cloud_source: "meeting page date metadata index",
      local_behavior: "会议日历先显示当前月 metadata，会议正文和入会凭证按打开时读取",
      eviction_rule: "跨月后保留最近月份，旧会议按用户选择缓存",
      eligible_count: currentMonthMeetingPages.length,
      estimated_local_records: currentMonthMeetingPages.length,
      reason:
        "会议日历是投研日程入口，当前月会议应优先显示，但不能预取入会凭证。",
      excluded_private_fields: [
        "meeting body",
        "join url",
        "meeting id",
        "meeting passcode",
        "transcript text",
      ],
    },
    {
      id: "active-databases",
      title: "打开过的数据库视图",
      status: "user-selectable",
      cloud_source: "database manifest + view cursor",
      local_behavior: "字段、视图和最近打开行 metadata 常驻；行值按需分页",
      eviction_rule: "未固定且 30 天未打开的数据库降级为 schema-only",
      eligible_count: input.databases.length,
      estimated_local_records: input.databases.length,
      reason: "数据库如果每次都等云端，会直接影响投研表格和公司列表体验。",
      excluded_private_fields: [
        "row cell values",
        "database description",
        "view private filters",
      ],
    },
    {
      id: "recent-file-previews",
      title: "最近文件预览 metadata",
      status: input.files.length > 0 ? "user-selectable" : "planned",
      cloud_source: "private file manifest",
      local_behavior: "只缓存文件类型、大小、预览状态；原文件按打开时下载",
      eviction_rule: "大文件默认不常驻，除非用户固定到本地",
      eligible_count: input.files.length,
      estimated_local_records: input.files.length,
      reason: "文件通常体积大，热缓存策略必须先保护成本和隐私。",
      excluded_private_fields: ["file bytes", "file text", "signed url"],
    },
    {
      id: "favorite-pages",
      title: "收藏页面和重点公司",
      status: "planned",
      cloud_source: "workspaces.settings.page_favorites + future module_settings",
      local_behavior: "用户主动固定后，跨设备同步热缓存偏好",
      eviction_rule: "用户取消固定前不自动清理",
      eligible_count: 0,
      estimated_local_records: 0,
      reason: "收藏页面已进入云端 workspace settings；重点公司、项目 pin 仍需纳入云端设置主库。",
      excluded_private_fields: ["free-form preference values", "private notes"],
    },
    {
      id: "current-projects",
      title: "当前项目",
      status: "user-selectable",
      cloud_source:
        "pages manifest icon/title metadata + future module_settings current_project pins",
      local_behavior: "项目页 metadata 和项目入口常驻；项目正文和关联页面按打开时补齐",
      eviction_rule: "未固定且 30 天未打开的项目页可降级为 metadata-only",
      eligible_count: projectPages.length,
      estimated_local_records: projectPages.length,
      reason:
        "投研项目通常串联公司、会议和数据库；项目页入口先出现，用户切换任务时不应等待云端。",
      excluded_private_fields: [
        "project page body",
        "linked page bodies",
        "database row values",
      ],
    },
    {
      id: "comments-on-open-pages",
      title: "打开页面的评论线程",
      status: "planned",
      cloud_source: "cloud comments table",
      local_behavior: "只在打开页面时缓存相关评论，不在列表页批量预取",
      eviction_rule: "关闭页面一段时间后可保留 unresolved metadata，正文按需重拉",
      eligible_count: commentCount,
      estimated_local_records: 0,
      reason: "评论正文敏感且变化频繁，必须等云端评论表和权限检查完成后再缓存。",
      excluded_private_fields: ["comment body", "author private info"],
    },
  ];

  const estimatedDefaultHotRecords = policies
    .filter(
      (policy) =>
        policy.status === "default-on" || policy.status === "never-evict"
    )
    .reduce((total, policy) => total + policy.estimated_local_records, 0);

  return {
    format: "zhinote-hot-cache-policy-plan",
    format_version: 1,
    plan_status: "local-policy-only",
    architecture_target: "cloud-master-local-hot-cache",
    privacy_boundary:
      "This plan uses metadata counts and watermarks only. It does not read page bodies, database row values, comment bodies, file bytes, file text, or secret values; it does not write server data or mutate local cache.",
    boundary: {
      reads_page_body_text: false,
      reads_page_yjs: false,
      reads_database_row_values: false,
      reads_comment_bodies: false,
      reads_file_bytes: false,
      reads_file_text: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      mutates_local_cache: false,
    },
    summary: {
      policies: policies.length,
      default_on: countByStatus(policies, "default-on"),
      user_selectable: countByStatus(policies, "user-selectable"),
      never_evict: countByStatus(policies, "never-evict"),
      planned: countByStatus(policies, "planned"),
      current_local_metadata_records: localMetadataRecords,
      estimated_default_hot_records: estimatedDefaultHotRecords,
      pending_sync_rows: input.syncSummary?.pending ?? 0,
      policy_hash: stableHash(
        policies.map((policy) => ({
          id: policy.id,
          status: policy.status,
          eligible_count: policy.eligible_count,
          estimated_local_records: policy.estimated_local_records,
        }))
      ),
    },
    policies,
  };
}

function countByStatus(
  policies: HotCachePolicy[],
  status: HotCachePolicyStatus
): number {
  return policies.filter((policy) => policy.status === status).length;
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

function isCurrentMonthMeetingPage(page: Page, now: Date): boolean {
  const dateKey = readMeetingDateKey(page);
  return Boolean(
    dateKey &&
      dateKey.startsWith(
        `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(
          2,
          "0"
        )}-`
      )
  );
}

function readMeetingDateKey(page: Page): string {
  const properties = parsePageProperties(page.properties);
  const hasMeetingMetadata = properties.some((property) =>
    MEETING_METADATA_PROPERTY_NAMES.has(property.name)
  );
  if (!hasMeetingMetadata) return "";
  const date = properties.find((property) => property.name === "日期")?.value;
  return typeof date === "string" && /^\d{4}-\d{2}-\d{2}/.test(date)
    ? date.slice(0, 10)
    : "";
}

function isProjectMetadataPage(page: Page): boolean {
  const title = page.title || "";
  return (
    page.icon === "PRJ" ||
    title.startsWith("投研项目：") ||
    title.endsWith("项目简报")
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
