#!/usr/bin/env node

// Verifies the multi-account email-code login contract:
// - Everything stays inactive (501) until RESEND_API_KEY +
//   ZHINOTES_ACCOUNT_ALLOWED_EMAILS + KV are configured.
// - Verification codes are stored only as salted hashes, single-use,
//   short-lived, attempt-limited, and send-rate-limited.
// - Sessions are httpOnly cookies backed by revocable KV records.
// - No route or helper logs emails/codes; responses only carry masked emails.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const errors = [];
const check = (cond, msg) => {
  if (!cond) errors.push(msg);
};
const read = (rel) => {
  const full = path.join(root, rel);
  if (!existsSync(full)) {
    errors.push(`缺少文件 ${rel}`);
    return "";
  }
  return readFileSync(full, "utf8");
};

// 1. Server helper: gating, hashing, limits
const server = read("src/lib/account/server.ts");
for (const token of [
  "getAccountConfig",
  "ZHINOTES_ACCOUNT_ALLOWED_EMAILS",
  "RESEND_API_KEY",
  "createHash",
  "timingSafeEqual",
  "MAX_VERIFY_ATTEMPTS",
  "MAX_SENDS_PER_WINDOW",
  "CODE_TTL_SECONDS",
  "SESSION_TTL_SECONDS",
]) {
  check(server.includes(token), `server.ts 缺少 ${token}`);
}
check(
  !server.includes("console.log"),
  "server.ts 不应该有 console.log（避免泄露邮箱/验证码）"
);

// 2. Routes: all gated, none log, cookie httpOnly
const routes = [
  "src/app/api/account/login/start/route.ts",
  "src/app/api/account/login/verify/route.ts",
  "src/app/api/account/me/route.ts",
  "src/app/api/account/logout/route.ts",
];
for (const rel of routes) {
  const src = read(rel);
  check(src.includes("getAccountConfig"), `${rel} 缺少 getAccountConfig 门控`);
  check(!src.includes("console."), `${rel} 不应该写日志`);
}
const start = read(routes[0]);
check(start.includes("501"), "login/start 未配置时应返回 501");
check(start.includes("maskEmail"), "login/start 响应应使用掩码邮箱");
const verify = read(routes[1]);
check(verify.includes("httpOnly: true"), "verify 的会话 cookie 必须 httpOnly");
check(verify.includes("maskEmail"), "verify 响应应使用掩码邮箱");
const me = read(routes[2]);
check(me.includes("maskEmail"), "me 响应应使用掩码邮箱");
check(me.includes("display_name"), "me 响应应包含账号用户名 display_name");
check(me.includes("export async function PATCH"), "me route 应支持修改用户名");
check(
  me.includes("normalizeDisplayName"),
  "me route 修改用户名前必须做长度和空值校验"
);

// 3. Login page: unconfigured state, no auto-send
const shell = read("src/components/modules/AccountShell.tsx");
const accountClientSession = read("src/lib/account/clientSession.ts");
check(shell.includes("unconfigured"), "AccountShell 缺少未配置状态");
const effectBodies = shell.match(/useEffect\(\(\) => \{[\s\S]*?\}, \[/g) ?? [];
check(effectBodies.length > 0, "AccountShell 缺少会话检查 useEffect");
for (const body of effectBodies) {
  check(
    !body.includes("login/start") && !body.includes("handleSendCode"),
    "AccountShell 不应该在加载时自动发验证码"
  );
}
check(
  shell.includes("fetchAccountSession({ force: true })") &&
    shell.includes("clearAccountSessionCache"),
  "AccountShell 应通过共享账号状态 helper 检查会话，并在登录/改名/退出后清缓存"
);
check(
  accountClientSession.includes("/api/account/me") &&
    accountClientSession.includes("accountSessionInFlight") &&
    accountClientSession.includes("cachedAccountSession") &&
    accountClientSession.includes("ACCOUNT_SESSION_RETRY_BACKOFF_MS") &&
    accountClientSession.includes("clearAccountSessionCache"),
  "账号状态查询应集中到共享 helper，支持短缓存、in-flight 去重和未配置退避"
);
const page = read("src/app/(workspace)/account/page.tsx");
check(page.includes("AccountShell"), "/account 路由缺少 AccountShell");

// 4. Owner doc exists
const doc = read("docs/multi-account-china-access.md");
check(doc.includes("ZHINOTES_ACCOUNT_ALLOWED_EMAILS"), "文档缺少环境变量说明");

// 5. Account-scoped portfolio sync: session-gated, share allowlist enforced
const accountSync = read("src/app/api/portfolio/account-sync/route.ts");
for (const token of [
  "getAccountConfig",
  "readSessionToken",
  "getSessionAccount",
  "501",
  "401",
  "allowedEmails.has",
  "readOnly",
]) {
  check(accountSync.includes(token), `account-sync route 缺少 ${token}`);
}
check(!accountSync.includes("console."), "account-sync route 不应该写日志");

// 6. Shell: viewing a shared portfolio is read-only and never pushes
const board = read("src/components/modules/PortfolioBoardShell.tsx");
check(
  board.includes("fetchAccountSession"),
  "PortfolioBoardShell 应复用共享账号状态 helper，避免重复检查会话"
);
check(
  board.includes("if (viewingOwner) return;"),
  "查看共享持仓时不应触发云端 push"
);
check(
  (board.match(/if \(viewingOwnerRef\.current\) return;/g) ?? []).length >= 6,
  "查看共享持仓时导入/打标/修改操作应全部禁用"
);

// 7. Page cloud sync: session-gated route, opt-in client toggle, no logging
const pageSyncRoute = read("src/app/api/pages/account-sync/route.ts");
for (const token of [
  "getAccountConfig",
  "readSessionToken",
  "getSessionAccount",
  "501",
  "401",
  "MAX_PAYLOAD_BYTES",
]) {
  check(pageSyncRoute.includes(token), `pages account-sync route 缺少 ${token}`);
}
check(
  !pageSyncRoute.includes("console."),
  "pages account-sync route 不应该写日志"
);
check(
  pageSyncRoute.includes("existing.u >= record.updated_at"),
  "pages account-sync push 必须拒绝旧数据覆盖新数据"
);
check(
  pageSyncRoute.includes('body.action === "changes-since"') &&
    pageSyncRoute.includes("getPageChangesSince"),
  "pages account-sync route 应提供按游标增量拉取 changes-since"
);
check(
  pageSyncRoute.includes('body.action === "metadata-changes-since"') &&
    pageSyncRoute.includes("pages: result.pages.map(toMetadataRecord)") &&
    pageSyncRoute.includes("function toMetadataRecord"),
  "pages account-sync route 应提供轻量 metadata 增量拉取，页面列表不能拉正文和大封面"
);
check(
  pageSyncRoute.includes("summary?: IndexSummary") &&
    pageSyncRoute.includes("stringifyPageChangeCursor(maxUpdatedAt, maxUpdatedId)"),
  "pages account-sync route 的增量游标应包含 updated_at 和 page id，避免同时间戳重复拉取"
);
check(
  pageSyncRoute.includes("entry.u === cursor.updatedAt && entry.id > cursor.id"),
  "pages account-sync route 增量过滤应使用 updated_at + page id 做稳定排序"
);
check(
  pageSyncRoute.includes("CHANGE_LOG_KEY_PREFIX") &&
    pageSyncRoute.includes("CHANGE_LOG_LIMIT") &&
    pageSyncRoute.includes("readChangeLog") &&
    pageSyncRoute.includes("appendChangeLog"),
  "pages account-sync route 应维护有界 change log，避免常规增量拉取扫描完整 index"
);
check(
  pageSyncRoute.includes('source: "change-log"') &&
    pageSyncRoute.includes('source: "index"') &&
    pageSyncRoute.includes("const canUseChangeLog"),
  "changes-since 应优先使用 change log，并保留旧账号/过期游标的 index fallback"
);
check(
  pageSyncRoute.includes("await appendChangeLog(config, me, changeLogEntries)") &&
    pageSyncRoute.includes("await appendChangeLog(config, email, changeLogEntries)"),
  "页面 push 和服务端修复路径都应写入 change log"
);
check(
  pageSyncRoute.includes("updateCalendarCachesForPageWrites") &&
    pageSyncRoute.includes("readDailyCalendarCacheSnapshot") &&
    pageSyncRoute.includes("readMeetingCalendarCacheSnapshot") &&
    pageSyncRoute.includes("previousSummary") &&
    pageSyncRoute.includes("cursor: summary.cursor"),
  "页面写入后应增量维护每日/会议日历缓存，避免下次打开重新扫描完整页面索引"
);
check(
  pageSyncRoute.includes("MEETING_CALENDAR_CACHE_KEY_PREFIX") &&
    pageSyncRoute.includes("readMeetingCalendarCache") &&
    pageSyncRoute.includes("selectMeetingCalendarMetadata") &&
    pageSyncRoute.includes("getMeetingCalendarMetadata("),
  "会议日历 metadata 应维护按 watermark 失效的云端索引缓存"
);
check(
  pageSyncRoute.includes('body.action === "meeting-calendar-metadata"') &&
    pageSyncRoute.includes("startDate") &&
    pageSyncRoute.includes("endDate") &&
    pageSyncRoute.includes("recentLimit") &&
    pageSyncRoute.includes("toMeetingMetadataRecord"),
  "会议日历 metadata 应支持按当前日历窗口和 recentLimit 返回轻量页面"
);
check(
  pageSyncRoute.includes("interface PageMetadataResult") &&
    pageSyncRoute.includes("async function getPageMetadata") &&
    pageSyncRoute.includes('body.action === "metadata"'),
  "pages account-sync route 应提供全局页面 metadata，用于空本地缓存时恢复侧栏列表"
);
check(
  pageSyncRoute.includes("MODULE_ROOT_TITLES") &&
    pageSyncRoute.includes("async function getModuleRootMetadata") &&
    pageSyncRoute.includes('body.action === "module-roots"') &&
    pageSyncRoute.includes("page.parent_id === null") &&
    pageSyncRoute.includes("MODULE_ROOT_TITLES.has(page.title"),
  "pages account-sync route 应提供模块根页面轻量 metadata，模块入口恢复不能向浏览器返回全量页面列表"
);
check(
  pageSyncRoute.includes("cover_url: null") &&
    pageSyncRoute.includes("content_text: null"),
  "全局页面 metadata 不应返回正文或大封面，正文应按需拉取"
);

const pageSyncClient = read("src/lib/pages/accountPageSync.ts");
const databaseSyncClient = read("src/lib/database/accountDatabaseSync.ts");
const syncDashboardShell = read("src/components/modules/SyncShell.tsx");
const reconcilePageSyncBody = pageSyncClient.slice(
  pageSyncClient.indexOf("export async function reconcilePageSync")
);
check(
  pageSyncClient.includes("if (!isPageSyncEnabled())"),
  "reconcile 必须在开关关闭时直接返回（关闭后不上传）"
);
check(
  pageSyncClient.includes('!== "false"'),
  "页面同步默认开启（opt-out）：仅显式 false 才关闭"
);
check(
  !pageSyncClient.includes("console.log"),
  "页面同步客户端不应该 console.log（避免泄露页面内容）"
);
check(
  pageSyncClient.includes("rebuildPageCacheFromCloud"),
  "页面同步客户端应提供从云端重建本机页面缓存的入口"
);
check(
  pageSyncClient.includes("clearLocalPageCacheExceptIds") &&
    pageSyncClient.includes("const prune = await clearLocalPageCacheExceptIds(ids)") &&
    pageSyncClient.includes("pruned: prune.cleared") &&
    pageSyncClient.includes("preservedLocalPrivate: prune.preservedLocalPrivate"),
  "重建本机页面缓存应按云端 manifest 修剪本机多余页面缓存，并报告被保护的本地私有页面"
);
check(
  pageSyncClient.includes("isLocalCacheEvictionTombstone") &&
    pageSyncClient.includes("clearPendingCloudPushIds([...missing, ...evicted])") &&
    !pageSyncClient.includes("const toPush: Page[]") &&
    !pageSyncClient.includes("if (!remote && isLocalCacheEvictionTombstone(page)) continue;"),
  "被云端 manifest 驱逐的本机缓存页不能再通过 pending push 或 reconcile 反向污染云端"
);
check(
  pageSyncClient.includes("clearAllPendingCloudPushesForCacheRebuild") &&
    pageSyncClient.includes("if (queuedCloudPushTimer)") &&
    pageSyncClient.includes("queuedCloudPush = new Map()") &&
    pageSyncClient.includes("setPendingCloudPushIds([])") &&
    pageSyncClient.indexOf("clearAllPendingCloudPushesForCacheRebuild()") <
      pageSyncClient.indexOf("const prune = await clearLocalPageCacheExceptIds(ids)"),
  "重建页面缓存前必须取消本机待上传队列，避免被清理的旧缓存重新污染云端主库"
);
check(
  pageSyncClient.includes("clearPageSyncRuntimeCachesForCacheRebuild") &&
    pageSyncClient.includes("metadataDeltaGeneration += 1") &&
    pageSyncClient.includes("lastMetadataDeltaResult = null") &&
    pageSyncClient.includes("pageLookupInFlight.clear()") &&
    pageSyncClient.includes("pageLookupCache.clear()") &&
    pageSyncClient.includes("generation === metadataDeltaGeneration") &&
    pageSyncClient.indexOf("clearPageSyncRuntimeCachesForCacheRebuild()") <
      pageSyncClient.indexOf("const prune = await clearLocalPageCacheExceptIds(ids)"),
  "重建页面缓存前必须清理短期云端查找/metadata 快照，旧 in-flight 请求不能复用为重建后的缓存"
);
check(
  pageSyncClient.includes("REMOTE_CURSOR_KEY") &&
    pageSyncClient.includes("fetchCloudPageChangesSince") &&
    pageSyncClient.includes("pullIncrementalCloudChanges"),
  "页面同步客户端应保存远端游标并优先使用 changes-since 增量拉取"
);
check(
  pageSyncClient.includes("memoryRemoteCursor") &&
    pageSyncClient.includes("memoryRemoteWatermark") &&
    pageSyncClient.includes("readSyncStorage") &&
    pageSyncClient.includes("writeSyncStorage") &&
    pageSyncClient.includes("readSyncStorage(REMOTE_CURSOR_KEY) ?? memoryRemoteCursor") &&
    pageSyncClient.includes("readSyncStorage(REMOTE_WATERMARK_KEY) ?? memoryRemoteWatermark"),
  "页面同步游标/水位必须有内存兜底，localStorage 不可用时当前 tab 仍应继续增量同步"
);
check(
  pageSyncClient.includes("getLocalPageSyncSummary") &&
    pageSyncClient.includes("restoreCursorFromLocalMetadata") &&
    pageSyncClient.includes("localSummary.watermark !== remoteSummary.watermark") &&
    pageSyncClient.includes("localSummary.cursor !== remoteSummary.cursor") &&
    pageSyncClient.indexOf("restoreCursorFromLocalMetadata(summary)") <
      pageSyncClient.indexOf("const metadata = await syncCloudPageMetadataDelta"),
  "页面同步客户端在 localStorage 游标丢失但本地 metadata 与云端摘要一致时，应恢复增量游标而不是强制重拉全部 metadata"
);
check(
  pageSyncClient.includes("fastForwardMetadataDeltaFromLocalCursor") &&
    pageSyncClient.includes("comparePageChangeCursorStrings") &&
    pageSyncClient.includes("fetchCloudPageMetadataChangesSince(nextCursor)") &&
    pageSyncClient.includes("parsePageChangeCursorString") &&
    pageSyncClient.indexOf("fastForwardMetadataDeltaFromLocalCursor(") <
      pageSyncClient.indexOf("const cloud = await fetchCloudPageMetadata()"),
  "localStorage 游标丢失但本地缓存有较旧 cursor 时，应先用 metadata-changes-since 快进，不能直接退回全量 metadata"
);
check(
  pageSyncClient.includes("setRemoteCursor(summary.cursor)") &&
    pageSyncClient.includes("setRemoteWatermark(changes.summary.watermark)"),
  "页面同步客户端应在增量/摘要同步后更新云端游标和水位"
);
check(
  pageSyncClient.includes("emitPagesUpdated(") &&
    pageSyncClient.includes("toPageUpdatePayloads(changes.pages)") &&
    pageSyncClient.includes("toPageUpdatePayloads(pages)") &&
    pageSyncClient.includes("const pulledPages: RemotePageRecord[] = []") &&
    pageSyncClient.includes("toPageUpdatePayloads(pulledPages)") &&
    pageSyncClient.indexOf("toPageUpdatePayloads(changes.pages)") >
      pageSyncClient.indexOf("const changes = await fetchCloudPageChangesSince"),
  "云端拉取后的跨 tab 通知必须携带轻量页面 metadata，其他 tab 不能因只收到数量而全量刷新"
);
check(
  pageSyncClient.includes("PENDING_PUSH_IDS_KEY") &&
    pageSyncClient.includes("markPendingCloudPush(record.id)") &&
    pageSyncClient.includes("flushPendingCloudPushes"),
  "页面同步客户端应维护只含 page id 的待上传队列，用于失败后重试云端写回"
);
const pushCloudPagesBody = pageSyncClient.slice(
  pageSyncClient.indexOf("export async function pushCloudPages"),
  pageSyncClient.indexOf("async function pushCloudRecordsInBatches")
);
check(
  pushCloudPagesBody.includes("markPendingCloudPushRecords(records);") &&
    pushCloudPagesBody.includes("if (!isPageSyncEnabled())") &&
    pushCloudPagesBody.indexOf("markPendingCloudPushRecords(records);") <
      pushCloudPagesBody.indexOf("if (!isPageSyncEnabled())") &&
    pushCloudPagesBody.includes("clearPendingCloudPushIds([...accepted, ...skipped])"),
  "直接 pushCloudPages 必须先登记 pending id，再尝试云端上传；成功或被远端跳过后才清理 pending"
);
check(
  pageSyncClient.includes("getPagesForSyncByIds") &&
    pageSyncClient.includes("pages = await getPagesForSyncByIds(ids)") &&
    pageSyncClient.indexOf("pages = await getPagesForSyncByIds(ids)") <
      pageSyncClient.indexOf("const localById = new Map(pages.map"),
  "待上传队列补发必须按 page id 精确读取，短轮询不能为了 pending push 扫描全部本地页面"
);
check(
  pageSyncClient.includes("void pushCloudRecordsInBatches(batch)") &&
    pageSyncClient.includes("clearPendingCloudPushIds([...result.accepted, ...result.skipped])"),
  "页面同步客户端的防抖上传成功或被远端跳过后应清理待上传 id"
);
check(
  pageSyncClient.includes("const pendingPush = await flushPendingCloudPushes()") &&
    pageSyncClient.includes("const pushed = pendingPush.pushed") &&
    pageSyncClient.includes("const local = await getAllPageMetadata()") &&
    pageSyncClient.includes("only flushPendingCloudPushes may") &&
    !pageSyncClient.includes("const localAfter =") &&
    !pageSyncClient.includes("const toPush: Page[]") &&
    !pageSyncClient.includes("pendingPush.pushed + pushResult.accepted"),
  "reconcile 每轮同步应先补发待上传页面；本地页面表只是缓存，不能全量扫描后按 updated_at 自动推上云"
);
check(
  pageSyncClient.includes("readSyncStorage(PENDING_PUSH_IDS_KEY)") &&
    pageSyncClient.includes("readSyncStorage(PENDING_PUSH_META_KEY)") &&
    !pageSyncClient.includes("zhinote.pagesync.pendingPushRecords"),
  "待上传重试队列只能保存 page id 和排队时间，不能把页面正文复制进 localStorage"
);
check(
  pageSyncClient.includes("export interface PendingCloudPageSyncStatus") &&
    pageSyncClient.includes("export function getPendingCloudPageSyncStatus") &&
    pageSyncClient.includes("pending: pendingIds.length") &&
    pageSyncClient.includes("queued: queuedCloudPush.size") &&
    pageSyncClient.includes("oldestPendingQueuedAt") &&
    pageSyncClient.includes("pendingSampleIds: pendingIds.slice(0, 5)") &&
    pageSyncClient.includes("lastSyncAt: getLastPageSyncAt()"),
  "页面同步客户端应暴露只读 pending 上传状态、最早排队时间和样本 id，供同步页展示和补传前后对账"
);
check(
  syncDashboardShell.includes("页面 pending 上传队列") &&
    syncDashboardShell.includes("只保存 page id 和排队时间，不保存页面正文") &&
    syncDashboardShell.includes("最早排队") &&
    syncDashboardShell.includes("样本 page id") &&
    syncDashboardShell.includes("补传页面队列") &&
    syncDashboardShell.includes("reconcilePageSync({ quick: true })") &&
    syncDashboardShell.includes("普通同步只会补传 pending queue 里的页面"),
  "同步页应展示页面 pending 上传队列并提供 quick 增量补传，不能暗示全量上传本地缓存"
);
check(
  databaseSyncClient.includes("export interface PendingCloudDatabaseSyncStatus") &&
    databaseSyncClient.includes("export async function getPendingCloudDatabaseSyncStatus") &&
    databaseSyncClient.includes("const pending = await getPendingDatabaseSyncRecords(1000)") &&
    databaseSyncClient.includes("pending: getPendingCloudDatabasePushKeys().length") &&
    databaseSyncClient.includes("queued: queuedCloudDatabasePush.size") &&
    databaseSyncClient.includes("syncLogPending") &&
    databaseSyncClient.includes("lastSyncAt: getLastDatabaseSyncAt()"),
  "数据库同步客户端应暴露只读 pending 上传状态，供同步页展示 cloud key、本地 sync_log 和内存批次"
);
check(
  syncDashboardShell.includes("数据库 pending 上传队列") &&
    syncDashboardShell.includes("不展示或导出数据库行值") &&
    syncDashboardShell.includes("补传数据库队列") &&
    syncDashboardShell.includes("reconcileDatabaseSync({ quick: true })") &&
    syncDashboardShell.includes("普通同步只会补传") &&
    syncDashboardShell.includes("不会把本地数据库缓存全量上传"),
  "同步页应展示数据库 pending 上传队列并提供 quick 增量补传，不能暗示全量上传本地数据库缓存"
);
check(
  syncDashboardShell.includes("全域 pending 变更分布") &&
    syncDashboardShell.includes("buildPendingDomainRows") &&
    syncDashboardShell.includes("只读取 sync_log 的表名、计数和时间戳") &&
    syncDashboardShell.includes("不读取页面正文、评论正文、数据库值、文件") &&
    syncDashboardShell.includes("普通同步仍只上传这些 pending 行指向的明确变更"),
  "同步页应按全域数据面展示 pending 分布，并保持 metadata-only 与 pending-only 边界"
);
check(
  pageSyncClient.includes("export async function getCloudPageManifestSummary") &&
    pageSyncClient.includes("export async function getCloudDailyManifestSummary") &&
    pageSyncClient.includes("export async function getCloudMeetingManifestSummary") &&
    pageSyncClient.includes('call({ action: "summary" })') &&
    databaseSyncClient.includes(
      "export async function getCloudDatabaseManifestSummary"
    ) &&
    databaseSyncClient.includes('call({ action: "summary" })') &&
    syncDashboardShell.includes("核心域云端 manifest 对账") &&
    syncDashboardShell.includes("只读检查核心域") &&
    syncDashboardShell.includes("getLocalPageSyncSummary") &&
    syncDashboardShell.includes("getLocalDailySyncSummary") &&
    syncDashboardShell.includes("getLocalMeetingSyncSummary") &&
    syncDashboardShell.includes("getLocalDatabaseSyncSummary") &&
    syncDashboardShell.includes("getCloudPageManifestSummary") &&
    syncDashboardShell.includes("getCloudDailyManifestSummary") &&
    syncDashboardShell.includes("getCloudMeetingManifestSummary") &&
    syncDashboardShell.includes("getCloudDatabaseManifestSummary") &&
    syncDashboardShell.includes("页面、每日纪要、会议和数据库这四个") &&
    syncDashboardShell.includes("不读取页面正文、数据库值、评论正文或文件字节") &&
    syncDashboardShell.includes("不会上传或清理本机缓存"),
  "同步页应提供页面、每日纪要、会议和数据库的核心域云端 manifest metadata-only 对账，只读 count/watermark/pending，不读取正文或上传/清缓存"
);
check(
  pageSyncClient.includes("fetchCloudPageMetadata") &&
    pageSyncClient.includes('call({ action: "metadata" })') &&
    pageSyncClient.includes("setRemoteCursor(summary.cursor)"),
  "页面同步客户端应能拉取云端 metadata，并同步远端游标"
);
check(
  pageSyncClient.includes("syncCloudPageMetadataDelta") &&
    pageSyncClient.includes('action: "metadata-changes-since"') &&
    pageSyncClient.includes("METADATA_DELTA_THROTTLE_MS") &&
    pageSyncClient.includes("metadataDeltaInFlight") &&
    pageSyncClient.includes("fullRefresh?: boolean") &&
    pageSyncClient.includes("requireLocalCacheCoverage?: boolean") &&
    pageSyncClient.includes("options.requireLocalCacheCoverage") &&
    pageSyncClient.includes(": getRemoteCursor()"),
  "页面同步客户端应提供节流、去重的轻量 metadata 增量同步入口，并允许本地缓存恢复时绕过旧 cursor 做云端 metadata 全量兜底"
);
const metadataDeltaBody = pageSyncClient.slice(
  pageSyncClient.indexOf("async function runCloudPageMetadataDelta"),
  pageSyncClient.indexOf("export async function pushCloudPages")
);
check(
  metadataDeltaBody.includes('call({ action: "summary" })') &&
    metadataDeltaBody.includes("restoreCursorFromLocalMetadata(summary)") &&
    metadataDeltaBody.indexOf("restoreCursorFromLocalMetadata(summary)") <
      metadataDeltaBody.indexOf("fetchCloudPageMetadata()"),
  "metadata 增量同步在 localStorage 游标丢失时，应先用本地 metadata 摘要恢复游标，再允许全量 metadata 兜底"
);
check(
  pageSyncClient.includes("QUICK_INCREMENTAL_BATCH_LIMIT") &&
    reconcilePageSyncBody.includes("batches < QUICK_INCREMENTAL_BATCH_LIMIT"),
  "quick 页面同步每轮应限制增量批次数，避免大批量导入时单次心跳拉完所有正文"
);
check(
  reconcilePageSyncBody.includes("const metadata = await syncCloudPageMetadataDelta") &&
    reconcilePageSyncBody.includes("force: true") &&
    reconcilePageSyncBody.indexOf("const metadata = await syncCloudPageMetadataDelta") <
      reconcilePageSyncBody.indexOf('const manifestRes = await call({ action: "manifest" })'),
  "quick 页面同步冷启动必须先走 metadata 增量预热，不能直接退回拉完整页面正文"
);
check(
  pageSyncClient.includes("cache failures should not block cloud-backed page lists"),
  "页面 metadata 增量同步应允许本机缓存写入失败时继续用云端列表渲染"
);

const usePagesHook = read("src/hooks/usePages.ts");
const filesShell = read("src/components/modules/FilesShell.tsx");
const pageImportPlanPanel = read("src/components/modules/PageImportPlanPanel.tsx");
check(
  usePagesHook.includes("syncCloudPageMetadataDelta") &&
    usePagesHook.includes("renderLocalPagesSnapshot") &&
    usePagesHook.includes("await renderLocalPagesSnapshot()") &&
    usePagesHook.includes("loadPagesSnapshot(") &&
    usePagesHook.includes("metadataFirstContent ? false : includeContent") &&
    usePagesHook.includes("setPages(all);") &&
    usePagesHook.includes("force: false") &&
    usePagesHook.includes("requireLocalCacheCoverage: false") &&
    usePagesHook.includes("mergeMetadataForCount(all, cloudPages)") &&
    usePagesHook.includes("const needsCloudCoverageRecovery =") &&
    usePagesHook.includes("!cloudSnapshotAuthoritative") &&
    usePagesHook.includes("(!localSnapshotLoaded || all.length === 0)") &&
    usePagesHook.includes("force: true") &&
    usePagesHook.includes("requireLocalCacheCoverage: true") &&
    usePagesHook.includes("localSnapshotLoaded") &&
    !usePagesHook.includes("fullRefresh: all.length === 0 || !localSnapshotLoaded") &&
    usePagesHook.includes("The browser database is only a rebuildable hot cache") &&
    usePagesHook.includes("setPages(cloudPages)") &&
    usePagesHook.includes("Cloud metadata refresh is best effort") &&
    usePagesHook.includes("cloudSnapshotAuthoritative = true") &&
    usePagesHook.includes("includeContent && !localSnapshotLoaded && all.length === 0") &&
    usePagesHook.indexOf("await renderLocalPagesSnapshot()") <
      usePagesHook.indexOf("const cloud = await syncCloudPageMetadataDelta") &&
    !usePagesHook.includes("fetchCloudPageMetadata"),
  "usePages 应先显示本地热缓存，再用云端 metadata 增量校正；includeContent 只能在本地缓存不可读时用云端 metadata 兜底"
);
check(
  usePagesHook.includes("autoLoad?: boolean") &&
    usePagesHook.includes("const autoLoad = options.autoLoad ?? true") &&
    usePagesHook.includes("if (!autoLoad) return;") &&
    usePagesHook.includes("}, [autoLoad, refresh]") &&
    usePagesHook.includes("}, [autoLoad, dbReady, includeContent, refresh, upsertPages]"),
  "usePages 应支持手动刷新模式，避免只需要 refresh 的入口挂载时读取全量页面 metadata"
);
check(
  usePagesHook.includes("remoteMetadataToPage") &&
    usePagesHook.includes("content_text: null"),
  "usePages 云端 metadata 本地写入失败时仍应能用无正文页面列表渲染侧栏"
);
check(
  shell.includes("usePages({ autoLoad: false })") &&
    filesShell.includes("usePages({ autoLoad: false })") &&
    pageImportPlanPanel.includes("usePages({ autoLoad: false })"),
  "AccountShell/FilesShell/PageImportPlanPanel 只需要手动 refresh 时不应自动读取全量页面 metadata"
);

const dailyNotesShell = read("src/components/modules/DailyNotesShell.tsx");
check(
  dailyNotesShell.includes("const storedDailyRootId = getModuleRootIdSync(\"daily\")") &&
    dailyNotesShell.includes("const cachedCloud = includeCloud") &&
    dailyNotesShell.includes("const cloudMetadataPromise = includeCloud") &&
    dailyNotesShell.indexOf("readCachedDailyCloudMetadata(startDate, endDate)") <
      dailyNotesShell.indexOf("const localMetadata = await listDailyPageMetadataForCalendar") &&
    dailyNotesShell.indexOf("const localMetadata = await listDailyPageMetadataForCalendar") <
      dailyNotesShell.indexOf("const cloud = await cloudMetadataPromise") &&
    dailyNotesShell.includes("publishNotes(Array.from(byId.values()))") &&
    dailyNotesShell.includes("void ensureDailyDateIndexBackfilled()") &&
    !dailyNotesShell.includes("await ensureDailyDateIndexBackfilled()") &&
    dailyNotesShell.includes("fetchDailyCloudMetadata({") &&
    dailyNotesShell.includes("HOT_CACHE_PREFERENCES_SETTING_KEY") &&
    dailyNotesShell.includes("parseHotCachePreferences") &&
    dailyNotesShell.includes("metadataRecentLimitForHotCachePreferences") &&
    dailyNotesShell.includes("recentLimit: recentMetadataLimit") &&
    dailyNotesShell.includes("rebuildPageDateKeyIndex") &&
    !dailyNotesShell.includes("getAllPageMetadata"),
  "DailyNotesShell 首屏应本地/缓存优先，recent metadata 窗口按热缓存偏好有界扩大；回退本机时只能走日期索引，不能扫描本机全量页面"
);
check(
  dailyNotesShell.indexOf("seedDailyNoteForImmediateOpen(optimisticNote)") <
    dailyNotesShell.indexOf("persistOptimisticDailyNote") &&
    dailyNotesShell.indexOf("rememberPendingPageDraft(optimisticNote)") <
      dailyNotesShell.indexOf("upsertPages([optimisticNote])") &&
    dailyNotesShell.indexOf("upsertPages([optimisticNote])") <
      dailyNotesShell.indexOf("writeOptimisticDailyHotCache") &&
    dailyNotesShell.indexOf("writeOptimisticDailyHotCache") <
      dailyNotesShell.indexOf("seedDailyNoteForImmediateOpen(optimisticNote)") &&
    dailyNotesShell.indexOf("seedDailyNoteForImmediateOpen(optimisticNote)") <
      dailyNotesShell.indexOf("setPeekInitialPage(optimisticNote)") &&
    dailyNotesShell.indexOf("setPeekInitialPage(optimisticNote)") <
      dailyNotesShell.indexOf("setPeekPageId(optimisticNote.id)") &&
    dailyNotesShell.indexOf("setPeekPageId(optimisticNote.id)") <
      dailyNotesShell.indexOf("persistOptimisticDailyNote") &&
    dailyNotesShell.includes("useLocalFirstPageNavigation") &&
    dailyNotesShell.includes("const pageRoute = `/page/${optimisticNote.id}`") &&
    dailyNotesShell.includes("router.prefetch(pageRoute)") &&
    dailyNotesShell.includes("setPeekInitialPage(optimisticNote)") &&
    dailyNotesShell.includes("setPeekPageId(optimisticNote.id)") &&
    dailyNotesShell.includes("setOpeningDraft({ pageId: optimisticNote.id, dateKey })") &&
    dailyNotesShell.includes("data-testid={`daily-opening-note-${key}`}") &&
    dailyNotesShell.includes("title: dateKey") &&
    dailyNotesShell.includes("<PagePeekModal") &&
    dailyNotesShell.includes("initialPage={peekInitialPage}") &&
    dailyNotesShell.includes("openDailyNoteFullPageById") &&
    dailyNotesShell.includes("openDailyNoteFullPage(note, \"daily-open\")") &&
    dailyNotesShell.includes('router.prefetch("/page/zhinote-route-prefetch")') &&
    dailyNotesShell.includes("applyRemotePages([pageToRemoteRecord(note)])") &&
    dailyNotesShell.includes("openNotePage") &&
    dailyNotesShell.includes("后台会加入账号云端上传队列") &&
    dailyNotesShell.includes("applyRemotePages(records)") &&
    dailyNotesShell.includes("return queueDailyCloudRecords(records)") &&
    dailyNotesShell.includes("queueCloudPagePush(record)") &&
    !dailyNotesShell.includes("createPageWithCloud"),
  "DailyNotesShell 点击 + 应立即弹出乐观草稿页面，后台加入云端上传队列；已有纪要仍可用 peek 预览，完整页打开仍走本地优先"
);
check(
  dailyNotesShell.includes("expandedDateKeys") &&
    dailyNotesShell.includes("visibleNoteLimitByDate") &&
    dailyNotesShell.includes("toggleDateExpansion") &&
    dailyNotesShell.includes("showMoreNotesForDate") &&
    dailyNotesShell.includes("DAILY_CALENDAR_EXPAND_BATCH") &&
    dailyNotesShell.includes("const visibleLimit = isExpanded") &&
    dailyNotesShell.includes("const visibleNotes = dayNotes.slice(0, visibleLimit)") &&
    dailyNotesShell.includes("Math.min(totalCount, currentLimit + DAILY_CALENDAR_EXPAND_BATCH)") &&
    dailyNotesShell.includes("再显示 ${nextBatchCount} 条") &&
    dailyNotesShell.includes("dayNotes.length > DAILY_CALENDAR_VISIBLE_LIMIT") &&
    !dailyNotesShell.includes("hiddenNotes.map"),
  "DailyNotesShell 月历单元格应只渲染可见条目，更多纪要必须点击后分批展开"
);

const meetingScheduleShell = read("src/components/modules/MeetingScheduleShell.tsx");
const meetingScheduleOpensCreatedPageRoute =
  meetingScheduleShell.includes("const pageRoute = `/page/${result.page.id}`") ||
  meetingScheduleShell.includes("const pageRoute = `/page/${page.id}`");
check(
  !meetingScheduleShell.includes('from "@/hooks/usePages"') &&
    !meetingScheduleShell.includes("usePages(") &&
    !meetingScheduleShell.includes("await refresh()") &&
    !meetingScheduleShell.includes("void refresh()") &&
    meetingScheduleShell.includes("upsertMeetingInView(updatedPage)") &&
    meetingScheduleShell.includes("writeOptimisticMeetingHotCache(updatedPage, rootId)"),
  "MeetingScheduleShell 创建、导入和状态更新应局部刷新会议日历与热缓存，不能挂 usePages 或全局页面 refresh"
);
check(
  meetingScheduleShell.includes("readCachedMeetingCloudMetadata(startDate, endDate)") &&
    meetingScheduleShell.includes("const includeCloud = opts?.includeCloud !== false") &&
    meetingScheduleShell.includes("const cachedCloud = includeCloud") &&
    meetingScheduleShell.includes("const cloudPromise = includeCloud") &&
    meetingScheduleShell.includes("if (!cloudPromise) return") &&
    meetingScheduleShell.includes("scheduleMetadataCacheWarmup") &&
    meetingScheduleShell.includes("requestIdleCallback") &&
    meetingScheduleShell.includes("syncCloudPageMetadataDelta().catch") &&
    !meetingScheduleShell.includes("syncCloudPageMetadataDelta({ force: true })") &&
    !meetingScheduleShell.includes("reconcilePageSync") &&
    meetingScheduleShell.includes("loadMeetingCloudMetadata({") &&
    meetingScheduleShell.includes("HOT_CACHE_PREFERENCES_SETTING_KEY") &&
    meetingScheduleShell.includes("parseHotCachePreferences") &&
    meetingScheduleShell.includes("metadataRecentLimitForHotCachePreferences") &&
    meetingScheduleShell.includes("recentLimit: recentMetadataLimit") &&
    meetingScheduleShell.indexOf("mergeMeetingPages([], cloud.pages") <
      meetingScheduleShell.indexOf("getModuleRootId(\"meeting-schedule\")"),
  "MeetingScheduleShell 首屏应先读云端当前日历窗口，再回退本机缓存；recent metadata 窗口按热缓存偏好有界扩大，全局 metadata 同步只能空闲后台预热"
);
check(
  meetingScheduleShell.includes("MEETING_CLOUD_CACHE_PREFIX") &&
    meetingScheduleShell.includes("writeCachedMeetingCloudMetadata") &&
    meetingScheduleShell.includes("retainedCloudPages") &&
    meetingScheduleShell.includes("const localPageIds = new Set") &&
    meetingScheduleShell.includes("Meeting schedule local cache load failed"),
  "MeetingScheduleShell 云端会议 metadata 应只把轻量窗口结果作为本机可重建缓存"
);
check(
  meetingScheduleShell.includes("upsertMeetingInView(finalPage)") &&
    (meetingScheduleShell.includes("persistOptimisticMeetingPage(rootId, finalPage, upsertPages)") ||
      meetingScheduleShell.includes("resolvedRootId,\n            finalPage,\n            upsertPages")) &&
    meetingScheduleShell.includes("observedPageRevisionRef") &&
    meetingScheduleShell.includes("void load({ includeCloud: true })") &&
    meetingScheduleShell.includes("void load({ includeCloud: false })") &&
    meetingScheduleShell.includes("await load({ includeCloud: false })") &&
    meetingScheduleShell.includes("return queueMeetingCloudRecords(records)") &&
    meetingScheduleShell.includes("function queueMeetingCloudRecords") &&
    meetingScheduleShell.includes("queueCloudPagePush(record)") &&
    !meetingScheduleShell.includes("const result = await pushCloudPages(records)") &&
    meetingScheduleShell.includes("disabled={intakeLoading || !intakeText.trim()}") &&
    !meetingScheduleShell.includes("): Promise<CreateMeetingResult> =>") &&
    meetingScheduleShell.includes("): CreateMeetingResult =>") &&
    meetingScheduleShell.includes("const result = createMeetingPage(form") &&
    meetingScheduleShell.includes("const result = createMeetingPage(draft") &&
    !meetingScheduleShell.includes("disabled={intakeLoading || !rootId || !intakeText.trim()}") &&
    !meetingScheduleShell.includes('rootId ? "导入" : "加载中..."') &&
    !meetingScheduleShell.includes("await load();") &&
    !meetingScheduleShell.includes("void load().catch(() => undefined);") &&
    !meetingScheduleShell.includes("}, [dbReady, load, pageRevision]);"),
  "MeetingScheduleShell 新导入和本地 revision 刷新应保留乐观结果，并只做本地 metadata 刷新；会议保存必须加入统一云端上传队列，不能在后台直接等待云端 push"
);
check(
  meetingScheduleShell.includes('router.prefetch("/page/zhinote-route-prefetch")') &&
    meetingScheduleShell.includes("creatingMeetingDateKey") &&
    meetingScheduleShell.includes('importSource: "手动创建"') &&
    meetingScheduleOpensCreatedPageRoute &&
    meetingScheduleShell.includes("router.prefetch(pageRoute)") &&
    meetingScheduleShell.includes("useLocalFirstPageNavigation") &&
    meetingScheduleShell.includes('openPage(page, { source: "meeting-create" })') &&
    meetingScheduleShell.indexOf("const pageRoute = `/page/${") <
      meetingScheduleShell.indexOf(
        'openPage(page, { source: "meeting-create" })'
      ) &&
    meetingScheduleShell.includes("后台会继续保存到账号云端"),
  "MeetingScheduleShell 手动创建会议应有即时创建状态，成功后直接进入完整会议页面并后台同步"
);
check(
  meetingScheduleShell.includes("MEETING_CALENDAR_VISIBLE_LIMIT") &&
    meetingScheduleShell.includes("MEETING_CALENDAR_EXPAND_BATCH") &&
    meetingScheduleShell.includes("expandedMeetingDateKeys") &&
    meetingScheduleShell.includes("visibleMeetingLimitByDate") &&
    meetingScheduleShell.includes("toggleMeetingDateExpansion") &&
    meetingScheduleShell.includes("showMoreMeetingsForDate") &&
    meetingScheduleShell.includes("revealMeetingOnCalendar") &&
    meetingScheduleShell.includes("pendingCalendarFocusDateKeyRef") &&
    meetingScheduleShell.includes("requestAnimationFrame") &&
    meetingScheduleShell.includes("MEETING_CALENDAR_REVEAL_BUFFER") &&
    meetingScheduleShell.includes("revealMeetingOnCalendar(optimisticPage)") &&
    meetingScheduleShell.includes("revealMeetingOnCalendar(finalPage)") &&
    meetingScheduleShell.includes("const visibleLimit = isExpanded") &&
    meetingScheduleShell.includes("const visibleMeetings = dayMeetings.slice(0, visibleLimit)") &&
    meetingScheduleShell.includes("Math.min(totalCount, currentLimit + MEETING_CALENDAR_EXPAND_BATCH)") &&
    meetingScheduleShell.includes("再显示 ${nextBatchCount} 场") &&
    meetingScheduleShell.includes("dayMeetings.length > MEETING_CALENDAR_VISIBLE_LIMIT") &&
    !meetingScheduleShell.includes("{dayMeetings.map"),
  "MeetingScheduleShell 月历单元格应只渲染可见会议，更多会议必须点击后分批展开"
);

const usePageHook = read("src/hooks/usePage.ts");
check(
  usePageHook.includes("const cloud = await fetchCloudPageById(pageId)") &&
    usePageHook.includes("remoteIsAtLeastAsFresh(remoteRecord, localPage)") &&
    usePageHook.includes("hydrateRemotePageIntoLocalCache(remoteRecord)"),
  "usePage 打开页面时应拉取云端正文快照，并在云端不旧于本地时回填本地缓存"
);
check(
  usePageHook.includes("setPage(localPage)") &&
    usePageHook.includes("} else {\n      setPage(null);\n    }") &&
    usePageHook.includes("readLocalFirstPageSeed") &&
    usePageHook.includes("if (!dbReady)") &&
    usePageHook.includes("setLoading(!localPage)") &&
    usePageHook.includes("setLoading(false)") &&
    usePageHook.includes("schedulePageCloudHydration(pageId, localPage, setPage, upsertPages)") &&
    usePageHook.includes("requestIdleCallback(run") &&
    usePageHook.includes("PAGE_CLOUD_HYDRATION_IDLE_MS") &&
    !usePageHook.includes("cloudPagePromise") &&
    usePageHook.includes("queueCloudPagePush(localPage)"),
  "usePage 应先显示当前页本地缓存；云端正文只做 idle 后台回填，没有当前页元数据时才等云端查找，并在发现本地较新时补发云端上传"
);
check(
  usePageHook.includes("pageToRemoteRecord(optimistic)") &&
    usePageHook.includes("setPage(optimistic)") &&
    usePageHook.includes("upsertPages([optimistic])") &&
    usePageHook.includes("rememberPendingPageDraft(optimistic)") &&
    usePageHook.includes("queueCloudPagePush(record)") &&
    usePageHook.includes("void persistOptimisticPageToLocalCache(record, upsertPages)") &&
    usePageHook.includes("clearPendingPageDraft(record.id)") &&
    usePageHook.includes("hydrateRemotePageIntoLocalCache(record)") &&
    !usePageHook.includes("await pushCloudPages([record])"),
  "usePage 编辑保存应先更新本机热缓存和临时草稿并登记 pending 队列；云端上传和本地 SQLite 回填都不能阻塞输入"
);
check(
  !usePageHook.includes("updatePage(pageId, updates)") &&
    !usePageHook.includes("Parameters<typeof updatePage>"),
  "usePage 编辑保存不能回退到本地数据库优先"
);

const pageCloudSyncHook = read("src/hooks/usePageCloudSync.ts");
const databaseCloudSyncHook = read("src/hooks/useDatabaseCloudSync.ts");
check(
  (pageCloudSyncHook.match(/runSync\(\{ quick: true \}/g) ?? []).length >= 4,
  "页面云同步 hook 的加载、轮询、前台恢复和编辑后同步应默认走 quick 增量"
);
check(
  pageCloudSyncHook.includes("INITIAL_SYNC_DELAY_MS") &&
    pageCloudSyncHook.includes("initialSyncTimer") &&
    pageCloudSyncHook.includes("window.clearTimeout(initialSyncTimer)"),
  "页面云同步首轮应短暂延后，避免和页面 metadata 预热并发重复请求"
);
check(
  !pageCloudSyncHook.includes("initialSyncDoneRef") &&
    !pageCloudSyncHook.includes("quick: initialSyncDoneRef.current"),
  "页面云同步 hook 不应等首次全量同步后才启用 quick 增量"
);
check(
  pageCloudSyncHook.includes("window.addEventListener(\"focus\", handleForeground)") &&
    pageCloudSyncHook.includes("window.addEventListener(\"online\", handleForeground)"),
  "页面云同步 hook 的聚焦和联网恢复应使用增量前台同步"
);
check(
  pageCloudSyncHook.includes("handleConfig = () => void runSync({ quick: true, forceLease: true })"),
  "页面同步配置变化也应走 quick 增量；完整校验应只保留给账户页手动同步"
);
check(
  pageCloudSyncHook.includes("localStorage is only a cross-tab coordination cache") &&
    pageCloudSyncHook.includes("return true;"),
  "页面同步短轮询 lease 失败时不能阻止当前 tab 云端同步"
);
check(
  pageCloudSyncHook.includes("AUTH_RETRY_BACKOFF_MS") &&
    pageCloudSyncHook.includes("authRetryAfterRef") &&
    pageCloudSyncHook.includes('result.status === "unauthenticated"') &&
    pageCloudSyncHook.includes('result.status === "unconfigured"'),
  "页面同步在未登录/未配置时应短期退避，避免多端或本地开发环境持续空转轮询"
);
check(
  pageCloudSyncHook.includes("getPendingCloudPageSyncStatus") &&
    pageCloudSyncHook.includes("pendingStatus") &&
    pageCloudSyncHook.includes("refreshPendingStatus") &&
    pageCloudSyncHook.includes("return { state, lastSyncAt, pendingStatus, syncNow: runSync }"),
  "页面云同步 hook 应把 pending 队列计数暴露给侧边栏，保证本地未上传输入可见"
);
check(
  pageCloudSyncHook.includes("PAGE_SYNC_STATUS_EVENT") &&
    pageCloudSyncHook.includes("window.addEventListener(PAGE_SYNC_STATUS_EVENT, handleStatus)") &&
    pageCloudSyncHook.includes("window.removeEventListener(PAGE_SYNC_STATUS_EVENT, handleStatus)") &&
    pageCloudSyncHook.includes('event.key?.startsWith("zhinote.pagesync.")') &&
    pageCloudSyncHook.includes("CustomEvent<PendingCloudPageSyncStatus>"),
  "页面云同步 hook 应监听 pending/status 事件和跨 tab storage 变化，避免本地输入进入上传队列后 UI 等轮询才更新"
);
check(
  databaseCloudSyncHook.includes("getPendingCloudDatabaseSyncStatus") &&
    databaseCloudSyncHook.includes("pendingStatus") &&
    databaseCloudSyncHook.includes("syncLogPending") &&
    databaseCloudSyncHook.includes("refreshPendingStatus") &&
    databaseCloudSyncHook.includes("return { state, lastSyncAt, pendingStatus, syncNow: runSync }"),
  "数据库云同步 hook 应把 cloud key 队列和 sync_log pending 计数暴露给侧边栏"
);
check(
  databaseCloudSyncHook.includes("DATABASE_SYNC_STATUS_EVENT") &&
    databaseCloudSyncHook.includes("window.addEventListener(DATABASE_SYNC_STATUS_EVENT, handleStatus)") &&
    databaseCloudSyncHook.includes("window.removeEventListener(DATABASE_SYNC_STATUS_EVENT, handleStatus)") &&
    databaseCloudSyncHook.includes('event.key?.startsWith("zhinote.databasesync.")') &&
    databaseCloudSyncHook.includes("CustomEvent<PendingCloudDatabaseSyncStatus>"),
  "数据库云同步 hook 应监听 pending/status 事件和跨 tab storage 变化，避免数据库本地变更进入上传队列后 UI 等轮询才更新"
);
check(
  pageCloudSyncHook.includes("LOCAL_CACHE_RECOVERY_EVENT") &&
    pageCloudSyncHook.includes("LOCAL_CACHE_RECOVERY_SIGNAL_KEY") &&
    pageCloudSyncHook.includes("getLocalCacheRecoverySignal") &&
    pageCloudSyncHook.includes("recoverLocalCacheFromCloud") &&
    pageCloudSyncHook.includes("seenLocalCacheRecoverySignalRef") &&
    pageCloudSyncHook.includes("syncCloudPageMetadataDelta({") &&
    pageCloudSyncHook.includes("force: true") &&
    pageCloudSyncHook.includes("fullRefresh: true") &&
    pageCloudSyncHook.includes("window.addEventListener(LOCAL_CACHE_RECOVERY_EVENT") &&
    pageCloudSyncHook.includes("handleLocalCacheRecoveryStorage") &&
    pageCloudSyncHook.includes("event.key === LOCAL_CACHE_RECOVERY_SIGNAL_KEY") &&
    pageCloudSyncHook.includes('window.addEventListener("storage", handleLocalCacheRecoveryStorage)') &&
    pageCloudSyncHook.includes('window.removeEventListener("storage", handleLocalCacheRecoveryStorage)') &&
    pageCloudSyncHook.includes("void recoverLocalCacheFromCloud()"),
  "页面同步应在本地 SQLite 缓存重置/降级后强制从云端 metadata 恢复本机页面缓存"
);
check(
  pageSyncClient.includes("AUTH_RETRY_BACKOFF_MS") &&
    pageSyncClient.includes('AUTH_RETRY_KEY = "zhinote.pagesync.authRetry.v1"') &&
    pageSyncClient.includes("authRetryProbeInFlight") &&
    pageSyncClient.includes("__zhinotePageSyncAuthRetryProbe") &&
    pageSyncClient.includes("getAuthRetryProbe") &&
    pageSyncClient.includes("setAuthRetryProbe") &&
    pageSyncClient.includes("waitForAuthRetryProbe") &&
    pageSyncClient.includes("startAuthRetryProbe") &&
    pageSyncClient.includes("shouldBackOffAuthRetry") &&
    pageSyncClient.includes("readStoredAuthRetryStatus") &&
    pageSyncClient.includes("JSON.stringify({ status, until: authRetryAfter })") &&
    pageSyncClient.includes("removeSyncStorage(AUTH_RETRY_KEY)") &&
    pageSyncClient.includes("rememberAuthRetryStatus(result.status)") &&
    pageSyncClient.includes("throttled: true"),
  "页面 metadata 增量同步在未登录/未配置时应跨刷新退避，避免页面列表刷新反复请求云端"
);
check(
  databaseSyncClient.includes("AUTH_RETRY_BACKOFF_MS") &&
    databaseSyncClient.includes('AUTH_RETRY_KEY = "zhinote.databasesync.authRetry.v1"') &&
    databaseSyncClient.includes("authRetryProbeInFlight") &&
    databaseSyncClient.includes("__zhinoteDatabaseSyncAuthRetryProbe") &&
    databaseSyncClient.includes("getAuthRetryProbe") &&
    databaseSyncClient.includes("setAuthRetryProbe") &&
    databaseSyncClient.includes("waitForAuthRetryProbe") &&
    databaseSyncClient.includes("startAuthRetryProbe") &&
    databaseSyncClient.includes("shouldBackOffAuthRetry") &&
    databaseSyncClient.includes("readStoredAuthRetryStatus") &&
    databaseSyncClient.includes("JSON.stringify({ status, until: authRetryAfter })") &&
    databaseSyncClient.includes("removeSyncStorage(AUTH_RETRY_KEY)"),
  "数据库同步在未登录/未配置时应跨刷新退避并合并并发探测，避免数据库 metadata 刷新反复请求云端"
);
check(
  pageSyncClient.includes("PAGE_LOOKUP_CACHE_MS") &&
    pageSyncClient.includes("PAGE_LOOKUP_CACHE_LIMIT") &&
    pageSyncClient.includes("pageLookupInFlight") &&
    pageSyncClient.includes("pageLookupCache") &&
    pageSyncClient.includes("cloudPageLookupCacheKey") &&
    pageSyncClient.includes("readCloudPageLookupCache") &&
    pageSyncClient.includes("rememberCloudPageLookupResult"),
  "页面正文云端读取应有短缓存和 in-flight 去重，避免同一页面打开时重复拉取"
);
check(
  !pageCloudSyncHook.includes("usePages") &&
    !pageCloudSyncHook.includes("refresh({ reason: \"cloud-pull\" })") &&
    !pageCloudSyncHook.includes("useWorkspaceStore((s) => s.pages)") &&
    !pageCloudSyncHook.includes("firstEditRun"),
  "页面云同步 hook 不应在每次云端拉取后再触发 usePages 或监听整个 pages store；本地写入走防抖上传队列，后台同步只做拉取和失败兜底"
);
check(
  pageSyncClient.includes("pulledPages.length > 0 ? toPageUpdatePayloads(pulledPages) : undefined") &&
    pageSyncClient.includes("pullIncrementalCloudChanges"),
  "页面同步客户端应在增量/修复写入本机缓存后优先广播轻量页面 payload，而不是让同步 hook 再读一遍页面列表"
);
check(
  pageSyncClient.includes("DAILY_IMPORT_REPAIR_SIGNATURE_KEY") &&
    pageSyncClient.includes("getDailyImportRepairSignature") &&
    pageSyncClient.includes("isDailyImportRepairChecked") &&
    pageSyncClient.includes("rememberDailyImportRepairChecked") &&
    pageSyncClient.includes("if (!options.force && isDailyImportRepairChecked(beforeSignature))") &&
    pageSyncClient.includes("repairDailyImportPlacement({ force: true })") &&
    pageSyncClient.includes("repairDailyImportPlacement({ force: pulled > 0 })"),
  "每日纪要导入归档修复应按本机页面索引签名跳过重复全量扫描；重建缓存或云端拉到新页面时才强制复查"
);

check(
  usePageHook.includes("fetchCloudPageById"),
  "usePage 应在打开页面时从账号云端拉取页面"
);
check(
  usePageHook.includes("applyRemotePages([record])"),
  "usePage 从云端拉到页面后应写回本机页面缓存"
);
check(
  usePageHook.includes("hydrateRemotePageIntoLocalCache"),
  "usePage 应封装云端页面回填本机缓存逻辑"
);
check(
  usePageHook.includes("upsertPages([hydrated])") &&
    usePageHook.includes("applyCloudPageLookup"),
  "usePage 云端拉取后应更新前端页面索引，避免依赖全量刷新"
);
check(
  usePageHook.includes("reading is not blocked by a broken browser cache"),
  "usePage 本机缓存写入失败时仍应允许读取云端页面"
);

const pageShell = read("src/components/providers/PageShell.tsx");
const pageRoute = read("src/app/(workspace)/page/[pageId]/page.tsx");
const pageRouteLoading = read("src/app/(workspace)/page/[pageId]/loading.tsx");
const pageRouteSkeleton = read("src/components/page/PageRouteSkeleton.tsx");
check(
  pageShell.includes("usePages({ autoLoad: false })"),
  "PageShell 打开完整页面时不能为了 refresh 方法自动读取全量页面 metadata"
);
check(
  pageRoute.includes("PageRouteSkeleton") &&
    pageRouteLoading.includes("PageRouteSkeleton") &&
    pageShell.includes("PageRouteSkeleton") &&
    pageRoute.includes("readPageRouteHandoff") &&
    pageRoute.includes("PageRouteLoadingSkeleton") &&
    pageRouteSkeleton.includes("preview?:") &&
    pageRouteSkeleton.includes('data-testid="page-route-preview-title"'),
  "页面动态路由、动态组件 fallback、单页缓存读取等待态都必须显示同一个页面骨架，并在完整页面加载前显示本地交接的标题/图标，避免点击后空白或只转圈"
);
check(
  pageRouteSkeleton.includes("本地缓存会先加载") &&
    pageRouteSkeleton.includes("云端同步在后台继续") &&
    pageRouteSkeleton.includes("已接收页面，正在加载编辑器") &&
    pageRouteSkeleton.includes("animate-pulse"),
  "页面打开骨架必须说明本地缓存优先、云端后台同步，并保持轻量骨架反馈"
);
const pageSimpleUpdateBody = pageShell.slice(
  pageShell.indexOf("const handleTitleChange"),
  pageShell.indexOf("const handleSaveVersion")
);
const pageVisualUpdateBody = pageShell.slice(
  pageShell.indexOf("const handleIconChange"),
  pageShell.indexOf("const handleToggleLock")
);
check(
  pageSimpleUpdateBody.includes("await update({ title: newTitle })") &&
    pageSimpleUpdateBody.includes("await update({ properties: stringifyPageProperties(next) })") &&
    pageSimpleUpdateBody.includes("await update({ content_text: html })") &&
    !pageSimpleUpdateBody.includes("refresh()") &&
    pageVisualUpdateBody.includes("await update({ icon })") &&
    pageVisualUpdateBody.includes("await update({ cover_url: dataUrl })") &&
    !pageVisualUpdateBody.includes("refresh()"),
  "PageShell 标题/属性/正文/图标/封面更新应依赖 usePage 的单页 upsert，不能触发全量页面 metadata 刷新"
);
const pageStructureMutationBody = pageShell.slice(
  pageShell.indexOf("const handlePastePage"),
  pageShell.indexOf("const pageStructure")
);
check(
  pageStructureMutationBody.includes("collectMovedPageSnapshots(pages, moved)") &&
    pageStructureMutationBody.includes("upsertPages([child])") &&
    pageStructureMutationBody.includes("upsertPages([updatedDuplicate ?? duplicate])") &&
    pageStructureMutationBody.includes("await remove()") &&
    !pageStructureMutationBody.includes("await refresh()") &&
    !pageShell.includes("const { refresh } = usePages({ autoLoad: false })"),
  "PageShell 粘贴/移动/删除/创建子页面/复制页面必须局部 upsert，不能在大批量页面后触发全量 metadata 刷新"
);
check(
  pageShell.includes("useVersions(pageId, {") &&
    pageShell.includes("enabled: shouldLoadVersions") &&
    pageShell.includes("showHistory || showInfo"),
  "PageShell 不应在打开页面时默认加载全部版本正文，历史/信息面板应按需加载"
);
check(
  pageShell.includes("if (!showInfo || !page) return null") &&
    pageShell.includes("showInfo && pageStructure && pageInfo"),
  "PageShell 不应在打开页面首屏默认解析完整正文生成投研结构"
);
check(
  pageShell.includes("scheduleEditorMount") &&
    pageShell.includes("scheduleDeferredMount") &&
    pageShell.includes("return scheduleEditorMount(() => {\n      void loadEditorModule();\n      setEditorMounted(true);") &&
    pageShell.includes("requestIdleCallback(callback, { timeout: 300 })") &&
    pageShell.includes("if (loading && !page)") &&
    pageShell.includes("editorMounted ?") &&
    pageShell.includes("PageBodySkeleton"),
  "PageShell 应快速挂载正文编辑器，同时延后评论、反链、子页面等周边重组件"
);

const useVersionsHook = read("src/hooks/useVersions.ts");
check(
  useVersionsHook.includes("interface UseVersionsOptions") &&
    useVersionsHook.includes("enabled?: boolean") &&
    useVersionsHook.includes("force?: boolean") &&
    useVersionsHook.includes("const shouldLoad = enabled || loadOptions.force === true"),
  "useVersions 应支持按需加载和强制刷新，避免页面首屏读取所有版本正文"
);

const pagePeekModal = read("src/components/page/PagePeekModal.tsx");
check(
  pagePeekModal.includes('dynamic(() => import("@/components/editor/Editor")') &&
    pagePeekModal.includes("schedulePeekEditorMount") &&
    pagePeekModal.includes("schedulePeekIdleTask(callback, 40)") &&
    pagePeekModal.includes("schedulePeekIdleTask(callback, 60)") &&
    pagePeekModal.includes("schedulePeekIdleTask") &&
    pagePeekModal.includes("isOptimisticDraft") &&
    pagePeekModal.includes("setMountedEditorPageId(pageId)") &&
    pagePeekModal.includes("childPagesEnabled") &&
    pagePeekModal.includes("PeekEditorSkeleton"),
  "PagePeekModal 应动态加载、让新建空白草稿即时进入编辑器，并推迟子页面查询，避免点击 + 时被编辑器初始化或本地索引查询阻塞"
);
const lazyPagePeekModal = read("src/components/page/LazyPagePeekModal.tsx");
const knowledgeBaseShell = read("src/components/modules/KnowledgeBaseShell.tsx");
check(
  lazyPagePeekModal.includes('dynamic(() => import("@/components/page/PagePeekModal")') &&
    dailyNotesShell.includes('@/components/page/LazyPagePeekModal') &&
    dailyNotesShell.includes("setPeekPageId(note.id)") &&
    dailyNotesShell.includes("window.setTimeout(() =>") &&
    dailyNotesShell.includes("current === dateKey ? null : current") &&
    !dailyNotesShell.includes("fetchCloudPageById") &&
    dailyNotesShell.includes("setPeekInitialPage(optimisticNote)") &&
    dailyNotesShell.includes("setPeekPageId(optimisticNote.id)") &&
    !dailyNotesShell.includes('openPage(optimisticNote, { source: "daily-create" })') &&
    dailyNotesShell.includes("openDailyNoteFullPageById") &&
    dailyNotesShell.includes("openDailyNoteFullPage(note, \"daily-open\")") &&
    knowledgeBaseShell.includes('@/components/page/LazyPagePeekModal'),
  "每日纪要 + 应直接弹出新页面并快速释放按钮；已有纪要仍可直接加载页面弹窗壳预览；知识库仍可懒加载弹窗"
);

const localQueries = read("src/lib/db/local/queries.ts");
const localSchema = read("src/lib/db/local/schema.ts");
const localClient = read("src/lib/db/local/client.ts");
const localPageSyncSummaryBody = localQueries.slice(
  localQueries.indexOf("export async function getLocalPageSyncSummary"),
  localQueries.indexOf("export async function clearLocalPageCacheForIds")
);
check(
  localQueries.includes("clearLocalPageCacheForIds"),
  "local queries 应提供按云端页面 id 清理本机页面缓存的 helper"
);
check(
  localQueries.includes("export async function getLocalDailySyncSummary") &&
    localQueries.includes("export async function getLocalMeetingSyncSummary") &&
    localQueries.includes("LOCAL_SYNC_SUMMARY_START_DATE") &&
    localQueries.includes("MEETING_METADATA_PROPERTY_NAMES") &&
    localQueries.includes("NULL AS content_yjs, NULL AS content_text"),
  "local queries 应提供每日纪要和会议的本地 metadata-only summary，不能读取正文做对账"
);
check(
  localPageSyncSummaryBody.includes("SELECT id, updated_at, deleted_at") &&
    localPageSyncSummaryBody.includes("WHERE sync_version != -1") &&
    !localPageSyncSummaryBody.includes("content_text") &&
    !localPageSyncSummaryBody.includes("content_yjs"),
  "local queries 应提供只读 metadata 的本机页面同步摘要，用于恢复游标，不能为摘要读取正文"
);
check(
  localQueries.includes("clearLocalPageCacheExceptIds") &&
    localQueries.includes("sync_version = -1") &&
    localQueries.includes("sync_version = 1") &&
    localQueries.includes("getLocalPrivatePageIds") &&
    localQueries.includes("database_rows") &&
    localQueries.includes("parent_page_id"),
  "local queries 应能按云端 manifest 修剪普通页面缓存、回填时恢复缓存标记，同时保护本地数据库私有页面"
);
check(
  localQueries.includes("content_yjs = NULL") &&
    localQueries.includes("content_text = NULL"),
  "本机页面缓存清理应同时清理编辑器正文缓存"
);
check(
  localSchema.includes("status        TEXT NOT NULL DEFAULT 'pending'") &&
    localSchema.includes("attempt_count INTEGER NOT NULL DEFAULT 0") &&
    localSchema.includes("next_retry_at TEXT") &&
    localSchema.includes("last_error    TEXT") &&
    localSchema.includes("payload_hash  TEXT") &&
    localSchema.includes("idx_synclog_retry"),
  "sync_log schema 应记录 pending 状态、尝试次数、错误、下次重试时间和 payload 指纹，支持可追踪/可重试同步"
);
check(
  localClient.includes("ensureColumn(db, \"sync_log\", \"status\"") &&
    localClient.includes("ensureColumn(db, \"sync_log\", \"attempt_count\"") &&
    localClient.includes("ensureColumn(db, \"sync_log\", \"next_retry_at\"") &&
    localClient.includes("ensureColumn(db, \"sync_log\", \"last_error\"") &&
    localClient.includes("ensureColumn(db, \"sync_log\", \"payload_hash\"") &&
    localClient.includes("idx_synclog_retry"),
  "本地缓存迁移只能给 sync_log 补列/补索引，不能要求用户清空旧缓存"
);
check(
  localClient.includes("CREATE_TABLES_WITHOUT_LATE_MIGRATION_INDEXES") &&
    localClient.includes("idx_synclog_retry") &&
    localClient.indexOf("CREATE_TABLES_WITHOUT_LATE_MIGRATION_INDEXES") <
      localClient.indexOf("ensureColumn(db, \"sync_log\", \"status\"") &&
    localClient.indexOf("ensureColumn(db, \"sync_log\", \"status\"") <
      localClient.indexOf("ensureIndex(\n    db,\n    \"idx_synclog_retry\""),
  "旧本地缓存缺少 sync_log.status 时，初始化必须先跳过依赖补列的索引，补列后再创建索引，避免整库重置"
);
check(
  localQueries.includes("buildSyncChangePayloadHash") &&
    localQueries.includes("status, attempt_count, payload_hash, source") &&
    localQueries.includes("markDatabaseSyncLogEntriesAttempted") &&
    localQueries.includes("markDatabaseSyncLogEntriesFailed") &&
    localQueries.includes("status = 'failed'") &&
    localQueries.includes("next_retry_at = ?") &&
    localQueries.includes("WHERE synced = 0") &&
    localQueries.includes("status != 'synced'") &&
    localQueries.includes("last_error as lastError"),
  "sync_log queries 应以 metadata-only 方式支持 attempt/failed/retry，不存正文 payload 且不重试已 synced 行"
);
check(
  databaseSyncClient.includes("markDatabaseSyncLogEntriesAttempted") &&
    databaseSyncClient.includes("markDatabaseSyncLogEntriesFailed") &&
    databaseSyncClient.includes("pendingLogIds") &&
    databaseSyncClient.includes("result.message ?? result.status"),
  "数据库 pending 上传失败时应保留 sync_log 并记录失败原因，成功后才标记 synced"
);
check(
  localQueries.includes("markWorkspaceSettingSyncLogEntriesAttempted") &&
    localQueries.includes("markWorkspaceSettingSyncLogEntriesFailed") &&
    localQueries.includes("markWorkspaceSettingSyncLogEntriesStatus") &&
    localQueries.includes("table_name = 'workspace_settings'") &&
    localQueries.includes("status = 'in_flight'") &&
    localQueries.includes("status = 'failed'"),
  "workspace_settings pending 上传也应记录上传中/失败待重试状态"
);
check(
  syncDashboardShell.includes("markWorkspaceSettingSyncLogEntriesAttempted") &&
    syncDashboardShell.includes("markWorkspaceSettingSyncLogEntriesFailed") &&
    syncDashboardShell.includes("failedKeys") &&
    syncDashboardShell.includes("failedMessages.join(\"; \")"),
  "同步页手动上传 workspace settings 时应把失败原因写回 sync_log"
);
check(
  syncDashboardShell.includes("formatSyncLogStatus") &&
    syncDashboardShell.includes("失败待重试") &&
    syncDashboardShell.includes("下次重试") &&
    syncDashboardShell.includes("row.failed") &&
    syncDashboardShell.includes("row.inFlight") &&
    syncDashboardShell.includes("table.failed") &&
    syncDashboardShell.includes("table.inFlight"),
  "同步页应展示全域 pending 的失败/上传中状态，方便定位多端同步卡顿"
);
check(
  localQueries.includes("export async function getBacklinks") &&
    localQueries.includes("NULL AS content_yjs, NULL AS content_text") &&
    !localQueries.includes("SELECT p.* FROM pages p"),
  "反链查询应只返回页面 metadata，打开页面时不能为了引用列表读取来源页面正文"
);

const accountShell = read("src/components/modules/AccountShell.tsx");
check(
  accountShell.includes("window.confirm"),
  "开启页面云同步前必须有确认弹窗"
);
check(
  accountShell.includes("按账号云端 manifest 重建本机页面缓存") &&
    accountShell.includes("本机多余缓存") &&
    accountShell.includes("保留本地数据库私有页面"),
  "AccountShell 重建缓存文案应明确云端主库、普通本地缓存清理和本地私有数据库保护"
);
check(
  accountShell.includes("setPageSyncEnabled"),
  "AccountShell 缺少页面同步开关"
);
check(accountShell.includes("用户名"), "AccountShell 缺少用户名编辑入口");
check(
  accountShell.includes("display_name"),
  "AccountShell 应读取和保存 display_name"
);
check(
  accountShell.includes("重建本机页面缓存"),
  "AccountShell 应提供重建本机页面缓存按钮"
);
check(
  accountShell.includes("数据库云同步") &&
    accountShell.includes("setDatabaseSyncEnabled") &&
    accountShell.includes("上传待同步变更") &&
    accountShell.includes("重建本机数据库缓存") &&
    accountShell.includes("数据库会按账号云端主库同步"),
  "AccountShell 应提供独立的数据库云同步开关、确认边界和本机缓存重建入口"
);
check(
  accountShell.includes("云端数据不会删除") &&
    accountShell.includes("数据库表格、本地文件、评论、版本历史不会上传或删除"),
  "重建本机页面缓存前必须解释云端数据和本地私有数据边界"
);
check(
  syncDashboardShell.includes("本机缓存重建入口") &&
    syncDashboardShell.includes("云端 manifest 是重建来源") &&
    syncDashboardShell.includes("不会把本地缓存全量上传") &&
    syncDashboardShell.includes("本地 pending 变更未清空前不建议重建") &&
    syncDashboardShell.includes("保留本地数据库私有页面") &&
    syncDashboardShell.includes("router.push(\"/account\")"),
  "同步页应提供缓存重建安全入口：先展示 pending 风险，再跳转账号页确认重建，不能在同步页直接清缓存"
);

const sidebar = read("src/components/sidebar/Sidebar.tsx");
check(
  sidebar.includes("fetchAccountSession"),
  "Sidebar 应通过共享账号状态 helper 读取当前账号资料"
);
check(
  sidebar.includes("accountLabel"),
  "Sidebar 应显示登录用户名，而不是固定显示账号"
);
check(
  sidebar.includes("pageSyncPendingTotal") &&
    sidebar.includes("databaseSyncPendingTotal") &&
    sidebar.includes("普通同步只补传 pending queue") &&
    sidebar.includes("pageSync.pendingStatus.pending") &&
    sidebar.includes("databaseSync.pendingStatus.syncLogPending"),
  "Sidebar 账号行应显示页面/数据库 pending 同步计数，让本地未上传输入在全局可见"
);

if (errors.length > 0) {
  console.error("verify:account 失败：");
  for (const err of errors) console.error(`  - ${err}`);
  process.exit(1);
}
console.log(
  "verify:account 通过 ✓ （门控、哈希、限流、httpOnly、掩码邮箱、页面同步默认开启但需登录）"
);
