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
  shell.includes("/api/account/me"),
  "AccountShell 应该只在加载时检查会话状态"
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
  pageSyncRoute.includes("cover_url: null") &&
    pageSyncRoute.includes("content_text: null"),
  "全局页面 metadata 不应返回正文或大封面，正文应按需拉取"
);

const pageSyncClient = read("src/lib/pages/accountPageSync.ts");
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
  pageSyncClient.includes("clearLocalPageCacheForIds"),
  "重建本机页面缓存前应先清理本机已同步页面缓存"
);
check(
  pageSyncClient.includes("REMOTE_CURSOR_KEY") &&
    pageSyncClient.includes("fetchCloudPageChangesSince") &&
    pageSyncClient.includes("pullIncrementalCloudChanges"),
  "页面同步客户端应保存远端游标并优先使用 changes-since 增量拉取"
);
check(
  pageSyncClient.includes("setRemoteCursor(summary.cursor)") &&
    pageSyncClient.includes("setRemoteWatermark(changes.summary.watermark)"),
  "页面同步客户端应在增量/摘要同步后更新云端游标和水位"
);
check(
  pageSyncClient.includes("PENDING_PUSH_IDS_KEY") &&
    pageSyncClient.includes("markPendingCloudPush(record.id)") &&
    pageSyncClient.includes("flushPendingCloudPushes"),
  "页面同步客户端应维护只含 page id 的待上传队列，用于失败后重试云端写回"
);
check(
  pageSyncClient.includes("void pushCloudRecordsInBatches(batch)") &&
    pageSyncClient.includes("clearPendingCloudPushIds([...result.accepted, ...result.skipped])"),
  "页面同步客户端的防抖上传成功或被远端跳过后应清理待上传 id"
);
check(
  pageSyncClient.includes("const pendingPush = await flushPendingCloudPushes()") &&
    pageSyncClient.includes("const pushed = pendingPush.pushed") &&
    pageSyncClient.includes("pendingPush.pushed + pushResult.accepted"),
  "reconcile 每轮同步应先补发待上传页面，并把补发数量计入同步结果"
);
check(
  pageSyncClient.includes("window.localStorage.getItem(PENDING_PUSH_IDS_KEY)") &&
    !pageSyncClient.includes("zhinote.pagesync.pendingPushRecords"),
  "待上传重试队列只能保存 page id，不能把页面正文复制进 localStorage"
);
check(
  pageSyncClient.includes("fetchCloudPageMetadata") &&
    pageSyncClient.includes('call({ action: "metadata" })') &&
    pageSyncClient.includes("setRemoteCursor(summary.cursor)"),
  "页面同步客户端应能拉取云端 metadata，并同步远端游标"
);

const usePagesHook = read("src/hooks/usePages.ts");
check(
  usePagesHook.includes("fetchCloudPageMetadata") &&
    usePagesHook.includes("applyRemotePageMetadata(cloud.pages)") &&
    usePagesHook.includes("all.length === 0"),
  "usePages 本地列表为空时应从云端 metadata 恢复页面列表"
);
check(
  usePagesHook.includes("remoteMetadataToPage") &&
    usePagesHook.includes("content_text: null"),
  "usePages 云端 metadata 本地写入失败时仍应能用无正文页面列表渲染侧栏"
);

const dailyNotesShell = read("src/components/modules/DailyNotesShell.tsx");
check(
  dailyNotesShell.indexOf("readCachedDailyCloudMetadata(startDate, endDate)") <
    dailyNotesShell.indexOf("getAllPageMetadata()") &&
    dailyNotesShell.includes("const cloudById = new Map<string, DailyNote>()") &&
    dailyNotesShell.includes("fetchDailyCloudMetadata({") &&
    dailyNotesShell.includes("recentLimit: 12"),
  "DailyNotesShell 首屏应优先显示云端当前日历窗口，不应先扫描本机全量页面"
);
check(
  dailyNotesShell.indexOf("setPeekPageId(optimisticNote.id)") <
    dailyNotesShell.indexOf("persistOptimisticDailyNote") &&
    dailyNotesShell.includes("后台保存到账号云端") &&
    !dailyNotesShell.includes("createPageWithCloud"),
  "DailyNotesShell 点击 + 应立即打开乐观草稿，再后台保存到云端"
);

const meetingScheduleShell = read("src/components/modules/MeetingScheduleShell.tsx");
check(
  meetingScheduleShell.includes("readCachedMeetingCloudMetadata(startDate, endDate)") &&
    meetingScheduleShell.includes("loadMeetingCloudMetadata({") &&
    meetingScheduleShell.includes("recentLimit: 12") &&
    meetingScheduleShell.indexOf("mergeMeetingPages([], cloud.pages") <
      meetingScheduleShell.indexOf("getModuleRootId(\"meeting-schedule\")"),
  "MeetingScheduleShell 首屏应先读云端当前日历窗口，再回退本机缓存"
);
check(
  meetingScheduleShell.includes("MEETING_CLOUD_CACHE_PREFIX") &&
    meetingScheduleShell.includes("writeCachedMeetingCloudMetadata") &&
    meetingScheduleShell.includes("Meeting schedule local cache load failed"),
  "MeetingScheduleShell 云端会议 metadata 应只把轻量窗口结果作为本机可重建缓存"
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
    usePageHook.includes("setLoading(false)") &&
    usePageHook.includes("queueCloudPagePush(localPage)"),
  "usePage 应先显示本地缓存保证可用，并在发现本地较新时补发云端上传"
);
check(
  usePageHook.includes("pageToRemoteRecord(optimistic)") &&
    usePageHook.includes("await pushCloudPages([record])") &&
    usePageHook.includes("queueCloudPagePush(record)") &&
    usePageHook.includes("hydrateRemotePageIntoLocalCache(record)"),
  "usePage 编辑保存应先写账号云端，再把同一份云端记录回填为本机可重建缓存"
);
check(
  !usePageHook.includes("updatePage(pageId, updates)") &&
    !usePageHook.includes("Parameters<typeof updatePage>"),
  "usePage 编辑保存不能回退到本地数据库优先"
);

const pageCloudSyncHook = read("src/hooks/usePageCloudSync.ts");
check(
  (pageCloudSyncHook.match(/runSync\(\{ quick: true \}/g) ?? []).length >= 4,
  "页面云同步 hook 的加载、轮询、前台恢复和编辑后同步应默认走 quick 增量"
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
  pageCloudSyncHook.includes("handleConfig = () => void runSync({ quick: false, forceLease: true })"),
  "只有同步配置变化时才应保留强制全量校验"
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
  usePageHook.includes("if (hydrated) upsertPages([hydrated])"),
  "usePage 云端拉取后应更新前端页面索引，避免依赖全量刷新"
);
check(
  usePageHook.includes("reading is not blocked by a broken browser cache"),
  "usePage 本机缓存写入失败时仍应允许读取云端页面"
);

const pageShell = read("src/components/providers/PageShell.tsx");
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
  pageShell.includes("scheduleDeferredMount") &&
    pageShell.includes("editorMounted ?") &&
    pageShell.includes("PageBodySkeleton"),
  "PageShell 应延迟挂载正文编辑器，先显示可交互页面壳"
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
    pagePeekModal.includes("PeekEditorSkeleton"),
  "PagePeekModal 应动态加载并延迟挂载编辑器，避免点击 + 时被编辑器初始化阻塞"
);
const lazyPagePeekModal = read("src/components/page/LazyPagePeekModal.tsx");
const knowledgeBaseShell = read("src/components/modules/KnowledgeBaseShell.tsx");
check(
  lazyPagePeekModal.includes('dynamic(() => import("@/components/page/PagePeekModal")') &&
    dailyNotesShell.includes('@/components/page/LazyPagePeekModal') &&
    knowledgeBaseShell.includes('@/components/page/LazyPagePeekModal'),
  "每日纪要和知识库应通过 LazyPagePeekModal 按需加载页面弹窗"
);

const localQueries = read("src/lib/db/local/queries.ts");
check(
  localQueries.includes("clearLocalPageCacheForIds"),
  "local queries 应提供按云端页面 id 清理本机页面缓存的 helper"
);
check(
  localQueries.includes("content_yjs = NULL") &&
    localQueries.includes("content_text = NULL"),
  "本机页面缓存清理应同时清理编辑器正文缓存"
);

const accountShell = read("src/components/modules/AccountShell.tsx");
check(
  accountShell.includes("window.confirm"),
  "开启页面云同步前必须有确认弹窗"
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
  accountShell.includes("云端数据不会删除") &&
    accountShell.includes("数据库表格、本地文件、评论、版本历史不会上传或删除"),
  "重建本机页面缓存前必须解释云端数据和本地私有数据边界"
);

const sidebar = read("src/components/sidebar/Sidebar.tsx");
check(
  sidebar.includes("/api/account/me"),
  "Sidebar 应读取当前账号资料"
);
check(
  sidebar.includes("accountLabel"),
  "Sidebar 应显示登录用户名，而不是固定显示账号"
);

if (errors.length > 0) {
  console.error("verify:account 失败：");
  for (const err of errors) console.error(`  - ${err}`);
  process.exit(1);
}
console.log(
  "verify:account 通过 ✓ （门控、哈希、限流、httpOnly、掩码邮箱、页面同步默认开启但需登录）"
);
