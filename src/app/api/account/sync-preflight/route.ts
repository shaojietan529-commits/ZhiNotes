import { NextResponse } from "next/server";
import {
  accountIdentityMissingEnv,
  getAccountIdentityConfig,
  getSessionAccount,
  kvGet,
  readSessionToken,
  type KvEnv,
} from "@/lib/account/server";
import {
  accountSessionUnconfirmedHeaders,
  accountSessionUnconfirmedPayload,
} from "@/lib/account/sessionResponses";
import { maskEmail } from "@/lib/cloud/api";

export const dynamic = "force-dynamic";

const PAGE_INDEX_KEY_PREFIX = "zhinotes:pagesync:index:";
const DAILY_CALENDAR_CACHE_KEY_PREFIX =
  "zhinotes:pagesync:daily-calendar-cache:";
const MEETING_CALENDAR_CACHE_KEY_PREFIX =
  "zhinotes:pagesync:meeting-calendar-cache:";
const DATABASE_INDEX_KEY_PREFIX = "zhinotes:dbsync:index:";
const CORE_METADATA_DOMAIN_REQUIRED_COUNT = 4;

type AccountSyncPreflightStatus =
  | "ready"
  | "partial"
  | "unconfigured"
  | "signed-out"
  | "unconfirmed";

type AccountSyncPreflightCheckStatus = "pass" | "blocked";

interface AccountSyncPreflightCheck {
  id: string;
  status: AccountSyncPreflightCheckStatus;
  label: string;
  detail: string;
}

interface AccountSyncPreflightPayload {
  format: "zhinote-account-sync-preflight";
  format_version: 1;
  status: AccountSyncPreflightStatus;
  generated_at: string;
  account_hint: string | null;
  boundary: {
    reads_account_session: true;
    extends_account_session_ttl: boolean;
    reads_cloud_kv_metadata: true;
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_file_bytes: false;
    uploads_workspace_data: false;
    mutates_workspace_data: false;
    clears_local_cache: false;
    enables_sync_push: false;
    enables_sync_pull: false;
  };
  summary: {
    account_session_ready: boolean;
    page_cloud_index_readable: boolean;
    daily_cloud_metadata_readable: boolean;
    meeting_cloud_metadata_readable: boolean;
    database_cloud_index_readable: boolean;
    page_cloud_records: number | null;
    daily_cloud_records: number | null;
    meeting_cloud_records: number | null;
    database_cloud_records: number | null;
    cloud_metadata_domains_ready: number;
    cloud_metadata_domains_required: typeof CORE_METADATA_DOMAIN_REQUIRED_COUNT;
    keeps_session_cookie: boolean;
    next_action: string;
  };
  checks: AccountSyncPreflightCheck[];
  missing_env?: string[];
}

interface CloudIndexSummary {
  recordCount: number;
  deletedCount: number;
  watermark: string;
}

interface CalendarMetadataCacheSummary {
  recordCount: number;
  cachePresent: boolean;
  watermark: string;
  stale: boolean;
}

export async function GET(request: Request) {
  const generatedAt = new Date().toISOString();
  const config = getAccountIdentityConfig();
  if (!config) {
    return NextResponse.json(
      buildPayload({
        status: "unconfigured",
        generatedAt,
        accountHint: null,
        checks: [
          check(
            "account-config",
            "blocked",
            "账号云同步配置",
            "账号系统或云端 KV 尚未完整配置。"
          ),
          check(
            "page-cloud-index",
            "blocked",
            "页面云端索引",
            "账号云同步配置未完成，无法读取页面云端索引。"
          ),
          check(
            "daily-cloud-metadata",
            "blocked",
            "每日纪要 metadata",
            "账号云同步配置未完成，无法读取每日纪要云端 metadata。"
          ),
          check(
            "meeting-cloud-metadata",
            "blocked",
            "ZhiHui metadata",
            "账号云同步配置未完成，无法读取会议日历云端 metadata。"
          ),
          check(
            "database-cloud-index",
            "blocked",
            "数据库云端索引",
            "账号云同步配置未完成，无法读取数据库云端索引。"
          ),
        ],
        missingEnv: accountIdentityMissingEnv(),
      }),
      { status: 501 }
    );
  }

  const token = readSessionToken(request);
  if (!token) {
    return NextResponse.json(
      buildPayload({
        status: "signed-out",
        generatedAt,
        accountHint: null,
        checks: [
          check("account-session", "blocked", "账号会话", "当前浏览器未登录。"),
          check(
            "page-cloud-index",
            "blocked",
            "页面云端索引",
            "需要登录后才能读取该账号的页面索引。"
          ),
          check(
            "daily-cloud-metadata",
            "blocked",
            "每日纪要 metadata",
            "需要登录后才能读取该账号的每日纪要 metadata。"
          ),
          check(
            "meeting-cloud-metadata",
            "blocked",
            "ZhiHui metadata",
            "需要登录后才能读取该账号的会议日历 metadata。"
          ),
          check(
            "database-cloud-index",
            "blocked",
            "数据库云端索引",
            "需要登录后才能读取该账号的数据库索引。"
          ),
        ],
      }),
      { status: 401 }
    );
  }

  let account;
  try {
    account = await getSessionAccount(config, token);
  } catch {
    return NextResponse.json(
      {
        ...accountSessionUnconfirmedPayload(
          "账号同步预检暂时无法确认登录状态；不会清除当前登录，本地输入和待上传队列已保留。"
        ),
        ...buildPayload({
          status: "unconfirmed",
          generatedAt,
          accountHint: null,
          checks: [
            check(
              "account-session",
              "blocked",
              "账号会话",
              "云端会话读取暂时失败；这不是登出。"
            ),
            check(
              "page-cloud-index",
              "blocked",
              "页面云端索引",
              "会话暂时无法确认，未读取页面索引。"
            ),
            check(
              "daily-cloud-metadata",
              "blocked",
              "每日纪要 metadata",
              "会话暂时无法确认，未读取每日纪要 metadata。"
            ),
            check(
              "meeting-cloud-metadata",
              "blocked",
              "ZhiHui metadata",
              "会话暂时无法确认，未读取会议日历 metadata。"
            ),
            check(
              "database-cloud-index",
              "blocked",
              "数据库云端索引",
              "会话暂时无法确认，未读取数据库索引。"
            ),
          ],
        }),
      },
      { status: 503, headers: accountSessionUnconfirmedHeaders() }
    );
  }

  if (!account) {
    return NextResponse.json(
      {
        ...accountSessionUnconfirmedPayload(
          "账号同步预检暂时无法确认登录状态；不会清除当前登录，本地输入和待上传队列已保留。"
        ),
        ...buildPayload({
          status: "unconfirmed",
          generatedAt,
          accountHint: null,
          checks: [
            check(
              "account-session",
              "blocked",
              "账号会话",
              "云端暂时没有确认该 session；前端应保留登录兜底状态。"
            ),
            check(
              "page-cloud-index",
              "blocked",
              "页面云端索引",
              "会话暂时无法确认，未读取页面索引。"
            ),
            check(
              "daily-cloud-metadata",
              "blocked",
              "每日纪要 metadata",
              "会话暂时无法确认，未读取每日纪要 metadata。"
            ),
            check(
              "meeting-cloud-metadata",
              "blocked",
              "ZhiHui metadata",
              "会话暂时无法确认，未读取会议日历 metadata。"
            ),
            check(
              "database-cloud-index",
              "blocked",
              "数据库云端索引",
              "会话暂时无法确认，未读取数据库索引。"
            ),
          ],
        }),
      },
      { status: 503, headers: accountSessionUnconfirmedHeaders() }
    );
  }

  const [pageIndex, dailyCache, meetingCache, databaseIndex] = await Promise.allSettled([
    readCloudIndexSummary(config.kv, `${PAGE_INDEX_KEY_PREFIX}${account.email}`),
    readCalendarMetadataCacheSummary({
      kv: config.kv,
      key: `${DAILY_CALENDAR_CACHE_KEY_PREFIX}${account.email}`,
      recordsKey: "notes",
      indexWatermark: null,
    }),
    readCalendarMetadataCacheSummary({
      kv: config.kv,
      key: `${MEETING_CALENDAR_CACHE_KEY_PREFIX}${account.email}`,
      recordsKey: "meetings",
      indexWatermark: null,
    }),
    readJsonIndex(config.kv, `${DATABASE_INDEX_KEY_PREFIX}${account.email}`),
  ]);
  const pageReadable = pageIndex.status === "fulfilled";
  const pageWatermark = pageReadable ? pageIndex.value.watermark : null;
  const dailySummary =
    dailyCache.status === "fulfilled" && pageWatermark
      ? withStaleFlag(dailyCache.value, pageWatermark)
      : dailyCache.status === "fulfilled"
        ? dailyCache.value
        : null;
  const meetingSummary =
    meetingCache.status === "fulfilled" && pageWatermark
      ? withStaleFlag(meetingCache.value, pageWatermark)
      : meetingCache.status === "fulfilled"
        ? meetingCache.value
        : null;
  const emptyPageIndex = pageReadable && pageIndex.value.recordCount === 0;
  const dailyReadable =
    pageReadable &&
    (emptyPageIndex ||
      Boolean(dailySummary?.cachePresent && !dailySummary.stale));
  const meetingReadable =
    pageReadable &&
    (emptyPageIndex ||
      Boolean(meetingSummary?.cachePresent && !meetingSummary.stale));
  const databaseReadable = databaseIndex.status === "fulfilled";
  const checks = [
    check(
      "account-session",
      "pass",
      "账号会话",
      "账号 session 可确认；预检会顺带延长 session TTL，避免活跃用户被动掉线。"
    ),
    check(
      "page-cloud-index",
      pageReadable ? "pass" : "blocked",
      "页面云端索引",
      pageReadable
        ? "页面云端索引 metadata 可读。"
        : "页面云端索引暂时不可读；本地输入应继续进入 pending 队列。"
    ),
    check(
      "daily-cloud-metadata",
      dailyReadable ? "pass" : "blocked",
      "每日纪要 metadata",
      dailyReadable
        ? `每日纪要 metadata cache 可读，识别到 ${dailySummary?.recordCount ?? 0} 条当前云端纪要清单。`
        : dailyBlockedDetail(pageReadable, dailySummary)
    ),
    check(
      "meeting-cloud-metadata",
      meetingReadable ? "pass" : "blocked",
      "ZhiHui metadata",
      meetingReadable
        ? `ZhiHui 会议日历 metadata cache 可读，识别到 ${meetingSummary?.recordCount ?? 0} 条当前云端会议清单。`
        : meetingBlockedDetail(pageReadable, meetingSummary)
    ),
    check(
      "database-cloud-index",
      databaseReadable ? "pass" : "blocked",
      "数据库云端索引",
      databaseReadable
        ? "数据库云端索引 metadata 可读。"
        : "数据库云端索引暂时不可读；本地输入应继续进入 pending 队列。"
    ),
  ];

  return NextResponse.json(
    buildPayload({
      status:
        pageReadable && dailyReadable && meetingReadable && databaseReadable
          ? "ready"
          : "partial",
      generatedAt,
      accountHint: maskEmail(account.email),
      checks,
      pageRecords:
        pageIndex.status === "fulfilled" ? pageIndex.value.recordCount : null,
      dailyRecords: dailyReadable ? (dailySummary?.recordCount ?? 0) : null,
      meetingRecords: meetingReadable ? (meetingSummary?.recordCount ?? 0) : null,
      databaseRecords:
        databaseIndex.status === "fulfilled"
          ? databaseIndex.value.recordCount
          : null,
    })
  );
}

async function readJsonIndex(
  kv: KvEnv,
  key: string
) {
  const raw = await kvGet(kv, key);
  if (!raw) return { recordCount: 0 };
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid cloud index");
  }
  return { recordCount: Object.keys(parsed).length };
}

async function readCloudIndexSummary(
  kv: KvEnv,
  key: string
): Promise<CloudIndexSummary> {
  const raw = await kvGet(kv, key);
  if (!raw) return { recordCount: 0, deletedCount: 0, watermark: "0:0:" };
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid cloud index");
  }

  let recordCount = 0;
  let deletedCount = 0;
  let maxUpdatedAt = "";
  for (const entry of Object.values(parsed as Record<string, unknown>)) {
    recordCount += 1;
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    if (record.d === 1) deletedCount += 1;
    if (typeof record.u === "string" && record.u > maxUpdatedAt) {
      maxUpdatedAt = record.u;
    }
  }
  return {
    recordCount,
    deletedCount,
    watermark: `${recordCount}:${deletedCount}:${maxUpdatedAt}`,
  };
}

async function readCalendarMetadataCacheSummary({
  kv,
  key,
  recordsKey,
  indexWatermark,
}: {
  kv: KvEnv;
  key: string;
  recordsKey: "notes" | "meetings";
  indexWatermark: string | null;
}): Promise<CalendarMetadataCacheSummary> {
  const raw = await kvGet(kv, key);
  if (!raw) {
    return {
      recordCount: 0,
      cachePresent: false,
      watermark: "",
      stale: true,
    };
  }
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid calendar metadata cache");
  }
  const record = parsed as Record<string, unknown>;
  const entries = Array.isArray(record[recordsKey]) ? record[recordsKey] : [];
  const watermark = typeof record.watermark === "string" ? record.watermark : "";
  return {
    recordCount: entries.length,
    cachePresent: true,
    watermark,
    stale: Boolean(indexWatermark && watermark !== indexWatermark),
  };
}

function withStaleFlag(
  summary: CalendarMetadataCacheSummary,
  indexWatermark: string
): CalendarMetadataCacheSummary {
  return {
    ...summary,
    stale: summary.watermark !== indexWatermark,
  };
}

function buildPayload({
  status,
  generatedAt,
  accountHint,
  checks,
  missingEnv,
  pageRecords = null,
  dailyRecords = null,
  meetingRecords = null,
  databaseRecords = null,
}: {
  status: AccountSyncPreflightStatus;
  generatedAt: string;
  accountHint: string | null;
  checks: AccountSyncPreflightCheck[];
  missingEnv?: string[];
  pageRecords?: number | null;
  dailyRecords?: number | null;
  meetingRecords?: number | null;
  databaseRecords?: number | null;
}): AccountSyncPreflightPayload {
  const pageReady = checks.some(
    (item) => item.id === "page-cloud-index" && item.status === "pass"
  );
  const dailyReady = checks.some(
    (item) => item.id === "daily-cloud-metadata" && item.status === "pass"
  );
  const meetingReady = checks.some(
    (item) => item.id === "meeting-cloud-metadata" && item.status === "pass"
  );
  const databaseReady = checks.some(
    (item) => item.id === "database-cloud-index" && item.status === "pass"
  );
  const accountSessionReady = checks.some(
    (item) => item.id === "account-session" && item.status === "pass"
  );
  const readyDomains = [
    pageReady,
    dailyReady,
    meetingReady,
    databaseReady,
  ].filter(Boolean).length;
  return {
    format: "zhinote-account-sync-preflight",
    format_version: 1,
    status,
    generated_at: generatedAt,
    account_hint: accountHint,
    boundary: {
      reads_account_session: true,
      extends_account_session_ttl: accountSessionReady,
      reads_cloud_kv_metadata: true,
      reads_page_body_text: false,
      reads_database_row_values: false,
      reads_file_bytes: false,
      uploads_workspace_data: false,
      mutates_workspace_data: false,
      clears_local_cache: false,
      enables_sync_push: false,
      enables_sync_pull: false,
    },
    summary: {
      account_session_ready: accountSessionReady,
      page_cloud_index_readable: pageReady,
      daily_cloud_metadata_readable: dailyReady,
      meeting_cloud_metadata_readable: meetingReady,
      database_cloud_index_readable: databaseReady,
      page_cloud_records: pageRecords,
      daily_cloud_records: dailyRecords,
      meeting_cloud_records: meetingRecords,
      database_cloud_records: databaseRecords,
      cloud_metadata_domains_ready: readyDomains,
      cloud_metadata_domains_required: CORE_METADATA_DOMAIN_REQUIRED_COUNT,
      keeps_session_cookie: status === "unconfirmed",
      next_action: nextAction(status, readyDomains),
    },
    checks,
    ...(missingEnv ? { missing_env: missingEnv } : {}),
  };
}

function dailyBlockedDetail(
  pageReadable: boolean,
  summary: CalendarMetadataCacheSummary | null
) {
  if (!pageReadable) {
    return "每日纪要 metadata 依赖页面云端索引；索引不可读时本地纪要继续保留并进入 pending。";
  }
  if (!summary?.cachePresent) {
    return "每日纪要 metadata cache 尚未生成；先打开每日纪要或运行同步中心账号同步桥，让云端生成可复用的轻量日历清单。";
  }
  if (summary.stale) {
    return `每日纪要 metadata cache 落后于页面云端索引；当前只看到 ${summary.recordCount} 条旧清单，需重新拉取 metadata 后再做两设备 smoke。`;
  }
  return "每日纪要 metadata cache 暂时不可确认；本地纪要继续保留并进入 pending。";
}

function meetingBlockedDetail(
  pageReadable: boolean,
  summary: CalendarMetadataCacheSummary | null
) {
  if (!pageReadable) {
    return "ZhiHui metadata 依赖页面云端索引；索引不可读时本地会议继续保留并进入 pending。";
  }
  if (!summary?.cachePresent) {
    return "ZhiHui 会议日历 metadata cache 尚未生成；先打开 ZhiHui 或运行同步中心账号同步桥，让云端生成可复用的轻量会议清单。";
  }
  if (summary.stale) {
    return `ZhiHui 会议日历 metadata cache 落后于页面云端索引；当前只看到 ${summary.recordCount} 条旧清单，需重新拉取 metadata 后再做两设备 smoke。`;
  }
  return "ZhiHui metadata cache 暂时不可确认；本地会议继续保留并进入 pending。";
}

function nextAction(status: AccountSyncPreflightStatus, readyDomains: number) {
  if (status === "ready") {
    return "账号级页面、每日纪要、ZhiHui 和数据库云端 metadata 均可读；可以继续做同步中心账号同步桥和两设备真实同步 smoke。";
  }
  if (status === "partial") {
    return `只有 ${readyDomains}/${CORE_METADATA_DOMAIN_REQUIRED_COUNT} 个核心云端 metadata 域可读；先修不可读域，期间本地输入继续保留并进入 pending。`;
  }
  if (status === "unconfigured") {
    return "先补账号/KV/邮件环境变量；未配置时不要把本地缓存当作云端主库。";
  }
  if (status === "signed-out") {
    return "先登录账号；未登录时不要清 pending，也不要重建本地缓存。";
  }
  return "这是临时无法确认状态，不是登出；保留 cookie、本地输入和 pending 队列，稍后重试。";
}

function check(
  id: string,
  status: AccountSyncPreflightCheckStatus,
  label: string,
  detail: string
): AccountSyncPreflightCheck {
  return { id, status, label, detail };
}
