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
const sessionResponses = read("src/lib/account/sessionResponses.ts");
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
check(
  server.includes("ACCOUNT_SERVER_REQUEST_TIMEOUT_MS = 8000") &&
    server.includes("async function fetchAccountServerRequestWithTimeout") &&
    server.includes("const controller = new AbortController();") &&
    server.includes("signal: controller.signal") &&
    server.includes("clearTimeout(timeout)") &&
    server.includes("fetchAccountServerRequestWithTimeout(\n    `${env.url}/get/") &&
    server.includes("fetchAccountServerRequestWithTimeout(\n    `${env.url}/setex/") &&
    server.includes("fetchAccountServerRequestWithTimeout(\n    `${env.url}/set/") &&
    server.includes("fetchAccountServerRequestWithTimeout(\n    `${env.url}/del/") &&
    server.includes(
      'fetchAccountServerRequestWithTimeout(\n    "https://api.resend.com/emails"'
    ) &&
    (server.match(/\bfetch\(/g) ?? []).length === 1,
  "server.ts 的 KV 和 Resend 外部请求必须统一走 8 秒超时 helper，账号接口不能因外部服务慢而长期挂起"
);
check(
  sessionResponses.includes("ACCOUNT_SESSION_UNCONFIRMED_REASON") &&
    sessionResponses.includes('"session-unconfirmed"') &&
    sessionResponses.includes("retryable: true") &&
    sessionResponses.includes("keeps_session_cookie: true") &&
    sessionResponses.includes("accountSessionUnconfirmedPayload") &&
    sessionResponses.includes("status: 503") &&
    sessionResponses.includes("accountSessionUnconfirmedResponse"),
  "账号 session-unconfirmed 响应必须有共享 helper：返回 503 可重试、明确保留 cookie，避免同步接口把临时失败误判成登出"
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
const meGetTransientFailureHandler = me.slice(
  me.indexOf("  } catch {"),
  me.indexOf("export async function PATCH")
);
check(
  meGetTransientFailureHandler.includes("accountSessionUnconfirmedResponse") &&
    meGetTransientFailureHandler.includes(
      "云端存储暂时无法确认登录状态；不会清除当前登录，请稍后重试。"
    ) &&
    !meGetTransientFailureHandler.includes("cookies.delete") &&
    !meGetTransientFailureHandler.includes("response.cookies.delete"),
  "me route GET 云端临时失败必须返回可重试 session-unconfirmed，不能清除登录 cookie 或把用户踢出"
);
const meGetSessionUnconfirmedHandler = me.slice(
  me.indexOf("if (!account) {"),
  me.indexOf("const response = NextResponse.json({\n      authenticated: true")
);
check(
  meGetSessionUnconfirmedHandler.includes("accountSessionUnconfirmedResponse") &&
    !meGetSessionUnconfirmedHandler.includes("cookies.delete") &&
    !meGetSessionUnconfirmedHandler.includes("response.cookies.delete"),
  "me route GET 云端 session 暂时查不到时必须保留 cookie，交给前端 stale fallback，而不是自动登出"
);
const mePatchSessionUnconfirmedHandler = me.slice(
  me.indexOf("export async function PATCH"),
  me.indexOf("const nextAccount = await updateAccountDisplayName")
);
check(
  mePatchSessionUnconfirmedHandler.includes("accountSessionUnconfirmedResponse") &&
    mePatchSessionUnconfirmedHandler.includes("登录状态暂时无法确认；用户名没有修改，请稍后重试。") &&
    !mePatchSessionUnconfirmedHandler.includes("cookies.delete") &&
    !mePatchSessionUnconfirmedHandler.includes("response.cookies.delete"),
  "me route PATCH 云端 session 暂时查不到时只能返回可恢复错误，不能清除登录 cookie"
);
const mePatchTransientFailureHandler = me.slice(
  me.indexOf("const nextAccount = await updateAccountDisplayName"),
  me.lastIndexOf("  } catch {")
);
const mePatchTransientCatchHandler = me.slice(
  me.lastIndexOf("  } catch {"),
  me.lastIndexOf("}\n}")
);
check(
  mePatchTransientFailureHandler.includes("updateAccountDisplayName") &&
    mePatchTransientCatchHandler.includes("accountSessionUnconfirmedResponse") &&
    mePatchTransientCatchHandler.includes(
      "云端暂时无法保存用户名；不会清除当前登录，请稍后重试。"
    ) &&
    !mePatchTransientCatchHandler.includes("{ status: 502 }") &&
    !mePatchTransientCatchHandler.includes("cookies.delete") &&
    !mePatchTransientCatchHandler.includes("response.cookies.delete"),
  "me route PATCH 用户名云端保存临时失败必须返回可重试 session-unconfirmed，不能清除登录 cookie 或表现成自动登出"
);

// 3. Login page: unconfigured state, no auto-send
const shell = read("src/components/modules/AccountShell.tsx");
const accountClientSession = read("src/lib/account/clientSession.ts");
const accountClientProfile = read("src/lib/account/clientProfile.ts");
const accountCloudSyncGate = read("src/lib/account/accountCloudSyncGate.ts");
const hotCacheRouteWarmup = read("src/lib/sync/hotCacheRouteWarmup.ts");
const hotCacheRouteWarmupHook = read("src/hooks/useHotCacheRouteWarmup.ts");
const sidebarShell = read("src/components/sidebar/Sidebar.tsx");
const accountCloudSyncCoordinator = read(
  "src/hooks/useAccountCloudSyncCoordinator.ts"
);
const globalSyncLogStatusHook = read("src/hooks/useGlobalSyncLogStatus.ts");
const accountLocalUseReadiness = read(
  "src/lib/sync/accountLocalUseReadiness.ts"
);
const cloudUploadReliabilityReport = read(
  "src/lib/sync/cloudUploadReliabilityReport.ts"
);
const developmentStabilityPlan = read(
  "src/lib/sync/developmentStabilityPlan.ts"
);
const settingsCloudSyncStatusHook = read(
  "src/hooks/useSettingsCloudSyncStatus.ts"
);
const settingsSyncStatus = read("src/lib/sync/settingsSyncStatus.ts");
const knowledgeCloudSyncStatusHook = read(
  "src/hooks/useKnowledgeCloudSyncStatus.ts"
);
const knowledgeSyncStatus = read("src/lib/sync/knowledgeSyncStatus.ts");
const visibleRefreshLease = read("src/lib/sync/visibleRefreshLease.ts");
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
    shell.includes("clearAccountSessionCache") &&
    shell.includes("clearAccountSessionRuntimeCache") &&
    shell.includes("clearAccountSessionCache({ clearLastAuthenticated: true })") &&
    shell.includes("getLastAuthenticatedAccount") &&
    shell.includes("rememberLastAuthenticatedAccount") &&
    shell.includes("formatClientAccountLabel(account)"),
  "AccountShell 应通过共享账号状态 helper 检查会话，并在登录/改名/退出后刷新缓存；成功登录或改名后要重写最近登录账号兜底"
);
check(
  shell.includes("ACCOUNT_ACTION_REQUEST_TIMEOUT_MS = 12000") &&
    shell.includes("async function fetchAccountActionWithTimeout") &&
    shell.includes("const controller = new AbortController();") &&
    shell.includes('cache: init?.cache ?? "no-store"') &&
    shell.includes("signal: controller.signal") &&
    shell.includes("window.clearTimeout(timeout)") &&
    shell.includes('fetchAccountActionWithTimeout("/api/account/login/start"') &&
    shell.includes('fetchAccountActionWithTimeout("/api/account/login/verify"') &&
    shell.includes('fetchAccountActionWithTimeout("/api/account/me"') &&
    shell.includes(
      'fetchAccountActionWithTimeout("/api/pages/ingest?action=current")'
    ) &&
    shell.includes(
      'fetchAccountActionWithTimeout(\n        "/api/pages/ingest?action=generate"'
    ) &&
    shell.includes('fetchAccountActionWithTimeout("/api/account/logout"') &&
    shell.includes(
      "发送验证码请求超时，请稍后重试；当前页面数据不受影响。"
    ) &&
    shell.includes("验证登录请求超时，请稍后重试；不会清除当前本地数据。") &&
    shell.includes("用户名保存请求超时；当前登录状态已保留，可稍后重试。") &&
    shell.includes(
      "每日纪要归档修复请求超时；本地页面和待同步队列未改变，可稍后重试。"
    ) &&
    !shell.includes('await fetch("/api/account/login/start"') &&
    !shell.includes('await fetch("/api/account/login/verify"') &&
    !shell.includes('await fetch("/api/account/me"') &&
    !shell.includes('await fetch("/api/account/logout"'),
  "AccountShell 账号操作请求必须统一走 no-store 且可超时取消的 helper，接口慢或旧缓存不能让登录、改名、密钥、归档修复或退出操作长期卡住"
);
check(
  accountClientProfile.includes("export function formatClientAccountLabel") &&
    accountClientProfile.includes("account?.display_name?.trim()") &&
    accountClientProfile.includes("account?.email_hint?.trim()") &&
    accountClientProfile.indexOf("const displayName") <
      accountClientProfile.indexOf("const emailHint"),
  "账号显示名 helper 必须用户名优先、邮箱提示兜底，最后才显示“账号”，避免已登录账号因空用户名看起来像登出"
);
check(
  shell.includes("buildCloudUploadReliabilityReport") &&
    shell.includes("AccountCloudUploadReliabilityCard") &&
    shell.includes('data-testid="account-cloud-upload-reliability"') &&
    shell.includes("getSyncLogSummary().catch(() => null)") &&
    shell.includes("readLocalWorkspaceIdentity()") &&
    shell.includes("PAGE_SYNC_STATUS_EVENT") &&
    shell.includes("DATABASE_SYNC_STATUS_EVENT") &&
    shell.includes("SETTINGS_SYNC_STATUS_EVENT") &&
    shell.includes("KNOWLEDGE_SYNC_STATUS_EVENT") &&
    shell.includes("FILE_EMBED_SYNC_QUEUE_EVENT") &&
    shell.includes("SYNC_LOG_STATUS_EVENT") &&
    shell.includes("isAccountCloudUploadStatusStorageEvent") &&
    shell.includes("PAGE_SYNC_STORAGE_KEY_PREFIX") &&
    shell.includes("DATABASE_SYNC_STORAGE_KEY_PREFIX") &&
    shell.includes("FILE_EMBED_SYNC_QUEUE_STORAGE_KEY") &&
    shell.includes("event.key?.startsWith(PAGE_SYNC_STORAGE_KEY_PREFIX)") &&
    shell.includes("event.key?.startsWith(DATABASE_SYNC_STORAGE_KEY_PREFIX)") &&
    shell.includes("SETTINGS_SYNC_STATUS_STORAGE_KEY") &&
    shell.includes("KNOWLEDGE_SYNC_STATUS_STORAGE_KEY") &&
    shell.includes("SYNC_LOG_STATUS_STORAGE_KEY") &&
    shell.includes('window.addEventListener("storage", handleStorage)') &&
    shell.includes("fileEmbedPendingStatus") &&
    shell.includes("fileStatus: fileEmbedPendingStatus") &&
    shell.includes("report.summary.file_waiting_rows") &&
    shell.includes("safe_to_switch_device_now") &&
    shell.includes("账号重试") &&
    shell.includes("只读队列账本") &&
    shell.includes("不触发上传") &&
    shell.includes("pending 清零后最稳") &&
    shell.includes("refreshCloudUploadReliability"),
  "AccountShell 应在账号页显示本地输入上云健康卡，并即时响应 page/database/file/settings/knowledge/sync_log 跨标签状态，不触发上传"
);
check(
  cloudUploadReliabilityReport.includes("PendingFileEmbedSyncStatus") &&
    cloudUploadReliabilityReport.includes(
      "fileStatus: PendingFileEmbedSyncStatus"
    ) &&
    cloudUploadReliabilityReport.includes("file_sync_enabled") &&
    cloudUploadReliabilityReport.includes("file_waiting_rows") &&
    cloudUploadReliabilityReport.includes("file-embed-sync-visible") &&
    cloudUploadReliabilityReport.includes("文件嵌入队列可见") &&
    cloudUploadReliabilityReport.includes("input.fileStatus.pending") &&
    cloudUploadReliabilityReport.includes("input.fileStatus.failed") &&
    cloudUploadReliabilityReport.includes("input.fileStatus.manualReviewCount") &&
    cloudUploadReliabilityReport.includes("input.fileStatus.oldestPendingQueuedAt") &&
    cloudUploadReliabilityReport.includes("input.fileStatus.lastFailureMessage") &&
    cloudUploadReliabilityReport.includes("reads_file_names: false") &&
    cloudUploadReliabilityReport.includes("reads_file_bytes: false"),
  "本地输入上云健康报告必须把文件嵌入队列纳入待上传、失败、人工复核和切换设备判断，但仍不能读取文件名或文件字节"
);
check(
  cloudUploadReliabilityReport.includes("reads_auth_retry_state: true") &&
    cloudUploadReliabilityReport.includes("auth_retry_active") &&
    cloudUploadReliabilityReport.includes("auth_retry_domains") &&
    cloudUploadReliabilityReport.includes("auth_retry_until") &&
    cloudUploadReliabilityReport.includes("auth_retry_state_label") &&
    cloudUploadReliabilityReport.includes("account-auth-retry-visible") &&
    cloudUploadReliabilityReport.includes("临时账号确认失败不等于登出") &&
    cloudUploadReliabilityReport.includes("!authRetryActive") &&
    cloudUploadReliabilityReport.includes("syncLogCoveredPendingRows") &&
    cloudUploadReliabilityReport.includes(
      "(input.syncSummary?.pending ?? 0) - syncLogCoveredPendingRows"
    ),
  "本地输入上云健康报告应把账号认证退避作为可见黄灯：本地可继续写，但云端 ACK 前不能显示为安全切设备"
);
check(
  (shell.match(/finally \{\n      setShareBusy\(false\);\n    \}/g) ?? [])
    .length >= 2,
  "AccountShell 共享添加/移除失败时必须恢复按钮状态，不能卡在共享中"
);
check(
  shell.includes("同步失败，请稍后重试。本地输入仍保留在本机和待上传队列中。") &&
    shell.includes("finally {\n      setPageSyncBusy(false);\n      void refreshCloudUploadReliability();\n    }"),
  "AccountShell 手动页面同步异常时必须恢复按钮状态、刷新健康卡，并说明本地输入仍保留"
);
check(
  shell.includes("AccountHotCachePreferenceCard") &&
    shell.includes('data-testid="account-hot-cache-preferences"') &&
    shell.includes("HOT_CACHE_PREFERENCES_SETTING_KEY") &&
    shell.includes("DEFAULT_HOT_CACHE_PREFERENCES") &&
    shell.includes("parseHotCachePreferences") &&
    shell.includes("normalizeHotCachePreferences") &&
    shell.includes("notifyHotCachePreferencesChanged") &&
    shell.includes("HOT_CACHE_PREFERENCES_CHANGED_EVENT") &&
    shell.includes("HOT_CACHE_PREFERENCES_CHANGED_STORAGE_KEY") &&
    shell.includes("handleHotCachePreferencesChanged") &&
    shell.includes("handleHotCachePreferencesStorage") &&
    shell.includes("metadataRecentLimitForHotCachePreferences") &&
    shell.includes("getWorkspaceSetting(HOT_CACHE_PREFERENCES_SETTING_KEY)") &&
    shell.includes("upsertWorkspaceSetting(") &&
    shell.includes('"account-hot-cache-preferences"') &&
    shell.includes("getHotCacheRouteTargets") &&
    shell.includes("prefetchHotCacheRoutes") &&
    shell.includes("router.prefetch(routeTarget)") &&
    shell.includes('data-testid="account-hot-cache-route-warmup"') &&
    shell.includes("只做 route prefetch") &&
    shell.includes("不写 sync_log") &&
    shell.includes("预热入口失败；这只影响首次打开速度，不影响数据，也不会上传或改写本地内容。") &&
    shell.includes("finally {\n      setHotCacheRouteWarmupBusy(false);\n    }") &&
    shell.includes("这里只保存偏好") &&
    shell.includes("不读取正文、文件或行值") &&
    shell.includes("不清理本地缓存"),
  "AccountShell 应在账号页提供选择性本地热缓存偏好入口和 route prefetch 预热，只保存 workspace_settings metadata，不读取正文/文件/行值"
);
check(
  hotCacheRouteWarmup.includes("export function getHotCacheRouteTargets") &&
    hotCacheRouteWarmup.includes("export function prefetchHotCacheRoutes") &&
    hotCacheRouteWarmup.includes("prefetches_routes_only: true") &&
    hotCacheRouteWarmup.includes("uploads_workspace_data: false") &&
    hotCacheRouteWarmup.includes("enters_sync_log: false") &&
    !hotCacheRouteWarmup.includes("content_text") &&
    !hotCacheRouteWarmup.includes("content_yjs") &&
    !hotCacheRouteWarmup.includes("field_values"),
  "热缓存 route warmup helper 必须只做 route prefetch，不读取正文、Yjs、数据库行值或进入同步队列"
);
check(
  sidebarShell.includes("useHotCacheRouteWarmup();") &&
    hotCacheRouteWarmupHook.includes("useHotCacheRouteWarmup") &&
    hotCacheRouteWarmupHook.includes("scheduleHotCacheIdleTask") &&
    hotCacheRouteWarmupHook.includes("getWorkspaceSetting(HOT_CACHE_PREFERENCES_SETTING_KEY)") &&
    hotCacheRouteWarmupHook.includes("parseHotCachePreferences(setting)") &&
    hotCacheRouteWarmupHook.includes("prefetchHotCacheRoutes(") &&
    hotCacheRouteWarmupHook.includes("lastWarmupKey") &&
    hotCacheRouteWarmupHook.includes("HOT_CACHE_PREFERENCES_CHANGED_EVENT") &&
    hotCacheRouteWarmupHook.includes("HOT_CACHE_PREFERENCES_CHANGED_STORAGE_KEY") &&
    !hotCacheRouteWarmupHook.includes("upsertWorkspaceSetting") &&
    !hotCacheRouteWarmupHook.includes("sync_log"),
  "Sidebar 应在空闲时按热缓存偏好自动预热常用入口，且 hook 不能写设置或同步队列"
);
check(
  accountClientSession.includes("/api/account/me") &&
    accountClientSession.includes("accountSessionInFlight") &&
    accountClientSession.includes("cachedAccountSession") &&
    accountClientSession.includes("ACCOUNT_SESSION_RETRY_BACKOFF_MS") &&
    accountClientSession.includes("clearAccountSessionCache") &&
    accountClientSession.includes("clearAccountSessionRuntimeCache") &&
    accountClientSession.includes("clearLastAuthenticated") &&
    accountClientSession.includes("ACCOUNT_SESSION_LAST_AUTHENTICATED_STORAGE_KEY") &&
    accountClientSession.includes("ACCOUNT_SESSION_EXPLICIT_LOGOUT_STORAGE_KEY") &&
    accountClientSession.includes("getLastAuthenticatedAccount") &&
    accountClientSession.includes("rememberLastAuthenticatedAccount") &&
    accountClientSession.includes("withStoredAuthenticatedFallback") &&
    accountClientSession.includes('| "unconfirmed"') &&
    accountClientSession.includes("const fallbackSession = withStoredAuthenticatedFallback(") &&
    accountClientSession.includes("cachedAccountSession = fallbackSession") &&
    accountClientSession.includes("return fallbackSession") &&
    accountClientSession.includes("readStoredAuthenticatedAccountFromStorage") &&
    accountClientSession.includes("window.localStorage.setItem") &&
    accountClientSession.includes("window.localStorage.removeItem") &&
    accountClientSession.includes("staleReason") &&
    accountClientSession.includes("confirmedSignedOut?: boolean") &&
    accountClientSession.includes("confirmedSignedOut: true") &&
    accountClientSession.includes("clearStoredAuthenticatedAccount") &&
    accountClientSession.includes("storeExplicitLogoutMarker") &&
    accountClientSession.includes("clearStoredExplicitLogoutMarker") &&
    accountClientSession.includes("hasStoredExplicitLogoutMarker") &&
    accountClientSession.includes("ACCOUNT_SESSION_REQUEST_TIMEOUT_MS = 8000") &&
    accountClientSession.includes("async function fetchAccountSessionStatus") &&
    accountClientSession.includes("const controller = new AbortController();") &&
    accountClientSession.includes("signal: controller.signal") &&
    accountClientSession.includes("controller.abort()") &&
    accountClientSession.includes("clearTimeout(timeout)") &&
    accountClientSession.includes("account session check timed out") &&
    accountClientSession.includes(
      'result.status === "ok" && !result.authenticated'
    ) &&
    accountClientSession.includes("confirmedSignedOut?: boolean") &&
    accountClientSession.includes("getStoredAuthenticatedFallbackReason") &&
    accountClientSession.includes("只有手动退出登录才会清除本机账号显示"),
  "账号状态查询应集中到共享 helper，支持短缓存、in-flight 去重、未配置退避和跨标签页最近登录账号降级保护"
);
check(
  accountClientSession.includes("storeExplicitLogoutMarker(Date.now())") &&
    accountClientSession.includes("clearStoredExplicitLogoutMarker();") &&
    accountClientSession.includes("if (hasStoredExplicitLogoutMarker(now))") &&
    accountClientSession.indexOf(
      "if (hasStoredExplicitLogoutMarker(now))"
    ) < accountClientSession.indexOf("const canUseFallback =") &&
    accountClientSession.includes("ACCOUNT_SESSION_EXPLICIT_LOGOUT_TTL_MS") &&
    accountClientSession.includes("loggedOutAt"),
  "账号最近登录兜底必须尊重显式退出：临时失败保留用户名，但主动退出后不能被本机缓存拉回"
);
check(
  accountClientSession.includes(
    "const ACCOUNT_SESSION_LAST_AUTHENTICATED_TTL_MS = 90 * 24 * 60 * 60 * 1000"
  ) &&
    accountClientSession.includes(
      "do not make a valid long-lived login look signed out after one day"
    ),
  "最近登录账号兜底应匹配 90 天登录期，接口短暂失败不能在一天后显示成掉线"
);
check(
  accountClientSession.includes(
    'data.retryable || data.reason === "session-unconfirmed"'
  ) &&
    accountClientSession.includes("readAccountSessionRetryablePayload") &&
    accountClientSession.includes("res.clone().json()") &&
    accountClientSession.includes('status: "unconfirmed"') &&
    accountClientSession.includes(
      "account session temporarily unconfirmed"
    ) &&
    accountClientSession.indexOf(
      'data.retryable || data.reason === "session-unconfirmed"'
    ) <
      accountClientSession.indexOf(
        'confirmedSignedOut: true'
      ),
  "账号状态客户端必须把 /me 的可重试 session-unconfirmed 当成临时不可确认，而不是明确登出"
);
check(
  accountClientSession.includes("if (!res.ok) {\n      const retryable = await readAccountSessionRetryablePayload(res);") &&
    accountClientSession.includes("if (retryable) {\n        return {\n          status: \"unconfirmed\"") &&
    accountClientSession.includes("error: retryable.reason") &&
    accountClientSession.includes(
      "const result = withStoredAuthenticatedFallback(\n    await accountSessionInFlight,"
    ) &&
    accountClientSession.includes(
      'if (result.status === "unconfigured") {\n    storeUnconfiguredAccountSession(Date.now());'
    ) &&
    accountClientSession.includes(
      '} else if (result.confirmedSignedOut && !result.authenticated) {\n    clearStoredAuthenticatedAccount();\n  }'
    ) &&
    accountClientSession.includes("getStoredAuthenticatedFallbackReason") &&
    accountClientSession.includes(
      "只有手动退出登录才会清除本机账号显示"
    ) &&
    !accountClientSession.includes(
      'result.status === "error" && !result.authenticated'
    ) &&
    !accountClientSession.includes(
      'result.status === "unconfigured" && !result.authenticated'
    ),
  "账号状态客户端必须把非 2xx/网络错误视为临时错误，并先套用最近登录账号兜底；只有 ok 且明确未登录时才清最近登录兜底"
);
check(
  shell.includes("rememberLastAuthenticatedAccount(nextAccount)") &&
    shell.indexOf("rememberLastAuthenticatedAccount(nextAccount)") <
      shell.indexOf("notifyAccountProfileUpdated()"),
  "AccountShell 设置登录账号时必须先重写最近登录账号兜底，再通知侧栏刷新"
);
check(
  shell.includes("showStoredAccountFallback") &&
    shell.includes("const lastAuthenticatedAccount = getLastAuthenticatedAccount()") &&
    shell.includes("正在确认账号云端状态") &&
    shell.includes("本机已先保留最近一次登录状态") &&
    shell.includes("账号检查暂时失败，已保留最近一次登录状态") &&
    shell.indexOf("showStoredAccountFallback(\n      \"正在确认账号云端状态") <
      shell.indexOf("const session = await fetchAccountSession({ force: true })"),
  "AccountShell 打开账号页时应先显示本机最近登录身份，再异步确认云端 session，避免刷新/弱网时看起来自动掉线"
);
check(
  shell.includes("const accountShellMountedRef = useRef(true)") &&
    shell.includes("const refreshSessionRequestRef = useRef(0)") &&
    shell.includes("refreshSessionRequestRef.current += 1") &&
    shell.includes("const requestId = refreshSessionRequestRef.current + 1") &&
    shell.includes("refreshSessionRequestRef.current !== requestId") &&
    shell.includes("if (!accountShellMountedRef.current) return;") &&
    shell.includes("let cancelled = false") &&
    shell.includes("cancelled || !accountShellMountedRef.current"),
  "AccountShell 账号页异步 session、同步健康卡和共享/API key 初始化必须有卸载保护和请求序号，旧请求不能覆盖最新账号状态"
);
check(
  shell.includes("ACCOUNT_SESSION_LAST_AUTHENTICATED_STORAGE_KEY") &&
    shell.includes("ACCOUNT_SESSION_EXPLICIT_LOGOUT_STORAGE_KEY") &&
    shell.includes("handleAccountSessionStorage") &&
    shell.includes(
      "event.key === ACCOUNT_SESSION_LAST_AUTHENTICATED_STORAGE_KEY"
    ) &&
    shell.includes(
      "event.key === ACCOUNT_SESSION_EXPLICIT_LOGOUT_STORAGE_KEY"
    ) &&
    shell.includes('window.addEventListener("storage", handleAccountSessionStorage)') &&
    shell.includes(
      'window.removeEventListener("storage", handleAccountSessionStorage)'
    ) &&
    shell.includes("void refreshSession();"),
  "AccountShell 应监听跨标签最近登录账号缓存变化，另一个标签登录/退出/改名后自动刷新账号页状态"
);
check(
  shell.includes("session.authenticated && session.account") &&
    shell.includes("session.stale") &&
    shell.includes('session.status === "unconfirmed" || session.status === "error"') &&
    shell.includes("已保留最近一次登录状态") &&
    shell.indexOf("session.authenticated && session.account") <
      shell.indexOf('session.status === "unconfigured"'),
  "AccountShell 应先保留最近登录账号，再处理临时未配置/错误，避免账号接口短暂失败时把用户踢回登录页"
);
check(
  accountCloudSyncGate.includes("fetchAccountSession") &&
    accountCloudSyncGate.includes("account-unconfigured") &&
    accountCloudSyncGate.includes("session-unconfirmed") &&
    accountCloudSyncGate.includes('| "unconfirmed"') &&
    accountCloudSyncGate.includes(
      'session.status === "unconfigured" && session.authenticated'
    ) &&
    accountCloudSyncGate.includes(
      'session.status === "unconfirmed" && session.authenticated'
    ) &&
    accountCloudSyncGate.includes('session.status === "unconfirmed"') &&
    accountCloudSyncGate.includes("session.stale && session.authenticated") &&
    accountCloudSyncGate.includes("authenticated: session.authenticated") &&
    accountCloudSyncGate.includes("reads_page_body_text: false") &&
    accountCloudSyncGate.includes("reads_database_row_values: false") &&
    accountCloudSyncGate.includes("uploads_workspace_data: false") &&
    accountCloudSyncGate.includes("mutates_workspace_data: false") &&
    accountCloudSyncGate.includes("stores_account_email: false") &&
    accountCloudSyncGate.includes("local_input_can_continue: true") &&
    accountCloudSyncGate.includes("sync_failure_can_clear_session: false") &&
    accountCloudSyncGate.includes("explicit_logout_required_to_clear_session: true") &&
    accountCloudSyncGate.includes("upload_block_does_not_block_writing: true"),
  "账号云同步 gate 必须复用账号会话检查，临时错误时保持身份可见但同步保持可重试错误，并声明不读取/上传/修改 workspace 数据；同步门禁失败只能阻止上传，不能阻止本地写作或清除登录"
);
check(
  accountCloudSyncGate.indexOf(
    'session.status === "unconfigured" && session.authenticated'
  ) < accountCloudSyncGate.indexOf('if (session.status === "unconfigured") {'),
  "账号云同步 gate 必须先识别最近登录账号兜底，再处理真正未配置状态"
);
check(
  accountCloudSyncGate.indexOf(
    'session.status === "unconfirmed" && session.authenticated'
  ) < accountCloudSyncGate.indexOf('if (session.status === "unconfirmed") {'),
  "账号云同步 gate 必须先识别最近登录账号兜底，再把 session-unconfirmed 作为可重试账号检查错误"
);
const page = read("src/app/(workspace)/account/page.tsx");
check(page.includes("AccountShell"), "/account 路由缺少 AccountShell");

// 4. Owner doc exists
const doc = read("docs/multi-account-china-access.md");
check(doc.includes("ZHINOTES_ACCOUNT_ALLOWED_EMAILS"), "文档缺少环境变量说明");

// 5. Account-scoped portfolio sync: session-gated, share allowlist enforced
const accountSync = read("src/app/api/portfolio/account-sync/route.ts");
const portfolioAccountSyncClient = read("src/lib/portfolio/accountSync.ts");
const portfolioPasscodeSyncClient = read("src/lib/portfolio/cloudSync.ts");
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
check(
  accountSync.includes("accountSessionUnconfirmedResponse") &&
    accountSync.includes("组合同步暂时无法确认账号；本地组合数据已保留，请稍后重试。") &&
    !accountSync.includes("登录已过期，请重新登录。"),
  "portfolio account-sync route 有 cookie 但 session 暂时查不到时必须返回可重试 session-unconfirmed，不能返回登录过期"
);
check(
  portfolioAccountSyncClient.includes("checkAccountCloudSyncGate") &&
    portfolioAccountSyncClient.includes('accountGate.status === "signed-out"') &&
    portfolioAccountSyncClient.includes("组合同步接口暂时无法确认账号权限；本地组合数据未删除，请稍后重试。") &&
    !portfolioAccountSyncClient.includes('if (res.status === 401) return { status: "unauthenticated" }'),
  "portfolio account-sync client 应先复用共享账号 gate；具体同步接口 401 只能作为可重试错误，不能把组合同步误判为未登录"
);
check(
  portfolioAccountSyncClient.includes("ACCOUNT_PORTFOLIO_SYNC_REQUEST_TIMEOUT_MS = 12000") &&
    portfolioAccountSyncClient.includes("async function fetchAccountPortfolioSync") &&
    portfolioAccountSyncClient.includes("const controller = new AbortController();") &&
    portfolioAccountSyncClient.includes("signal: controller.signal") &&
    portfolioAccountSyncClient.includes("controller.abort()") &&
    portfolioAccountSyncClient.includes("clearTimeout(timeout)") &&
    portfolioAccountSyncClient.includes("组合同步请求超时；本地组合数据已保留，会稍后重试。"),
  "portfolio account-sync client 底层 fetch 必须可超时取消；超时只能进入可重试错误并明确本地组合数据已保留"
);
check(
  portfolioPasscodeSyncClient.includes("PORTFOLIO_PASSCODE_SYNC_REQUEST_TIMEOUT_MS = 12000") &&
    portfolioPasscodeSyncClient.includes("async function fetchPortfolioPasscodeSync") &&
    portfolioPasscodeSyncClient.includes("const controller = new AbortController();") &&
    portfolioPasscodeSyncClient.includes("signal: controller.signal") &&
    portfolioPasscodeSyncClient.includes("controller.abort()") &&
    portfolioPasscodeSyncClient.includes("clearTimeout(timeout)"),
  "portfolio passcode fallback sync 底层 fetch 必须可超时取消，避免旧版组合云同步卡住本地使用"
);

// 6. Shell: viewing a shared portfolio is read-only and never pushes
const board = read("src/components/modules/PortfolioBoardShell.tsx");
check(
  board.includes("fetchAccountSession"),
  "PortfolioBoardShell 应复用共享账号状态 helper，避免重复检查会话"
);
check(
  board.includes("ACCOUNT_SESSION_LAST_AUTHENTICATED_STORAGE_KEY") &&
    board.includes("handleAccountSessionStorage") &&
    board.includes(
      "event.key !== ACCOUNT_SESSION_LAST_AUTHENTICATED_STORAGE_KEY"
    ) &&
    board.includes("fetchAccountSession({ force: true })") &&
    board.includes('window.addEventListener("storage", handleAccountSessionStorage)') &&
    board.includes(
      'window.removeEventListener("storage", handleAccountSessionStorage)'
    ) &&
    board.includes('syncModeRef.current = "account"') &&
    board.includes("void runInitialSync(null, false)") &&
    board.includes("A failed account probe should not disable local portfolio editing."),
  "PortfolioBoardShell 应监听跨标签账号状态变化：登录后自动接管账号同步，临时账号探测失败不能禁用本地组合编辑"
);
check(
  board.includes("if (viewingOwner) return;"),
  "查看共享持仓时不应触发云端 push"
);
check(
  (board.match(/if \(viewingOwnerRef\.current\) return;/g) ?? []).length >= 6,
  "查看共享持仓时导入/打标/修改操作应全部禁用"
);
check(
  board.includes('type NoticeTone = "info" | "warning"') &&
    board.includes("组合云同步暂时失败；本机组合数据已保留，可继续使用，稍后会自动重试。") &&
    board.includes("组合云同步上传暂时失败；本机修改已保存，稍后会自动重试。") &&
    board.includes('noticeTone === "warning"'),
  "组合页后台同步失败必须用 warning notice 明确说明本机数据已保留且稍后会重试"
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
  pageSyncRoute.includes("accountSessionUnconfirmedResponse") &&
    pageSyncRoute.includes("页面同步暂时无法确认账号；本地输入已保留，请稍后重试。") &&
    pageSyncRoute.includes("每日纪要修复暂时无法确认账号；不会登出，请稍后重试。") &&
    pageSyncRoute.includes("页面同步云端读写暂时失败；本地输入已保留，会稍后重试。") &&
    pageSyncRoute.includes("每日纪要修复云端读写暂时失败；不会登出，请稍后重试。") &&
    !pageSyncRoute.includes("{ status: 502 }") &&
    !pageSyncRoute.includes("云端存储读写失败，请稍后重试。") &&
    !pageSyncRoute.includes("登录已过期，请重新登录。"),
  "pages account-sync route 有 cookie 但 session 暂时查不到或云端读写短暂失败时必须返回可重试 session-unconfirmed，不能返回登录过期或普通 502"
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
  pageSyncRoute.includes("refreshDailyCalendarCacheFromChangeLog") &&
    pageSyncRoute.includes("refreshMeetingCalendarCacheFromChangeLog") &&
    pageSyncRoute.includes("readChangedPageRecordsFromChangeLog") &&
    pageSyncRoute.includes("cache.cursor") &&
    pageSyncRoute.includes("changed.changedIds"),
  "每日/会议日历缓存 watermark 过期时，应优先用 change log 快进缓存，不能直接退回完整页面扫描"
);
check(
  pageSyncRoute.includes("createDailyCalendarCacheFromRecords") &&
    pageSyncRoute.includes("createMeetingCalendarCacheFromRecords") &&
    pageSyncRoute.includes("!dailyCache") &&
    pageSyncRoute.includes("!meetingCache"),
  "页面批量写入时如果日历缓存还不存在，应用本批轻量记录先建立缓存，降低导入后的首次日历冷启动成本"
);
check(
  pageSyncRoute.includes("MEETING_CALENDAR_CACHE_KEY_PREFIX") &&
    pageSyncRoute.includes("readMeetingCalendarCacheSnapshot") &&
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
const databaseSyncRoute = read("src/app/api/databases/account-sync/route.ts");
const fileEmbedSyncRoute = read("src/app/api/files/embed-sync/route.ts");
const fileEmbedSyncQueue = read("src/lib/files/fileEmbedSyncQueue.ts");
const fileEmbedSyncStatusHook = read(
  "src/hooks/useFileEmbedCloudSyncStatus.ts"
);
const filePreviewUpload = read("src/components/editor/filePreviewUpload.ts");
const pageIngestRoute = read("src/app/api/pages/ingest/route.ts");
const meetingAgentJobsRoute = read("src/app/api/meetings/agent/jobs/route.ts");
const databaseSyncClient = read("src/lib/database/accountDatabaseSync.ts");
const syncDashboardShell = read("src/components/modules/SyncShell.tsx");
const syncPendingDomainRegistry = read(
  "src/lib/sync/syncPendingDomainRegistry.ts"
);
check(
  databaseSyncRoute.includes("accountSessionUnconfirmedResponse") &&
    databaseSyncRoute.includes("数据库同步暂时无法确认账号；本地修改已保留，请稍后重试。") &&
    databaseSyncRoute.includes("数据库同步云端读写暂时失败；本地修改已保留，会稍后重试。") &&
    !databaseSyncRoute.includes("{ status: 502 }") &&
    !databaseSyncRoute.includes("云端存储读写失败，请稍后重试。") &&
    !databaseSyncRoute.includes("登录已过期，请重新登录。"),
  "databases account-sync route 有 cookie 但 session 暂时查不到或云端读写短暂失败时必须返回可重试 session-unconfirmed，不能返回登录过期或普通 502"
);
check(
  fileEmbedSyncRoute.includes("accountSessionUnconfirmedResponse") &&
    fileEmbedSyncRoute.includes(
      "try {\n    account = await getSessionAccount(config, token);"
    ) &&
    fileEmbedSyncRoute.includes("文件云同步暂时无法确认账号；文件已保存在本地，请稍后重试。") &&
    fileEmbedSyncRoute.includes("文件云同步暂时无法写入云端；文件已保存在本地，请稍后重试。") &&
    fileEmbedSyncRoute.includes("文件云同步暂时无法读取云端；本地文件不受影响，请稍后重试。") &&
    fileEmbedSyncRoute.includes('return NextResponse.json({ error: "auth-required" }, { status: 401 });') &&
    !fileEmbedSyncRoute.includes("登录已过期，请重新登录。"),
  "file embed-sync route 必须区分未登录和 session 暂时不可确认；账号、云端读写短暂失败也必须返回可重试 session-unconfirmed"
);
check(
  fileEmbedSyncQueue.includes("classifyFileEmbedCloudSyncAuthDeferral") &&
    fileEmbedSyncQueue.includes("markFileEmbedCloudSyncDeferred") &&
    fileEmbedSyncQueue.includes("authDeferred") &&
    fileEmbedSyncQueue.includes('status: "pending"') &&
    fileEmbedSyncQueue.includes("failureCount") &&
    fileEmbedSyncQueue.includes("FILE_EMBED_SYNC_AUTH_RETRY_STORAGE_KEY") &&
    filePreviewUpload.includes("classifyFileEmbedCloudSyncAuthDeferral") &&
    filePreviewUpload.includes("markFileEmbedCloudSyncDeferred"),
  "文件云同步遇到未登录、未配置或 session 暂不可确认时必须继续保留 pending，并单独记录账号重试，不能增加失败次数或推入人工处理"
);
check(
  fileEmbedSyncStatusHook.includes(
    "ACCOUNT_SESSION_LAST_AUTHENTICATED_STORAGE_KEY"
  ) &&
    fileEmbedSyncStatusHook.includes("ACCOUNT_PROFILE_UPDATED_EVENT") &&
    fileEmbedSyncStatusHook.includes("refreshAndMaybeRetry") &&
    fileEmbedSyncStatusHook.includes("FILE_EMBED_ACCOUNT_RECOVERY_RETRY_LIMIT") &&
    fileEmbedSyncStatusHook.includes("FILE_EMBED_FOREGROUND_RETRY_LIMIT") &&
    fileEmbedSyncStatusHook.includes("FILE_EMBED_AUTO_RETRY_MIN_INTERVAL_MS") &&
    fileEmbedSyncStatusHook.includes("FILE_EMBED_AUTO_RETRY_LEASE_KEY") &&
    fileEmbedSyncStatusHook.includes("FILE_EMBED_AUTO_RETRY_LEASE_TTL_MS") &&
    fileEmbedSyncStatusHook.includes("claimVisibleRefreshLease") &&
    fileEmbedSyncStatusHook.includes("const mountedRef = useRef(false)") &&
    fileEmbedSyncStatusHook.includes("setStatusIfMounted") &&
    fileEmbedSyncStatusHook.includes("mountedRef.current = false") &&
    fileEmbedSyncStatusHook.includes(
      "claimVisibleRefreshLease(\n          FILE_EMBED_AUTO_RETRY_LEASE_KEY"
    ) &&
    fileEmbedSyncStatusHook.includes(
      "if (event.key === ACCOUNT_SESSION_LAST_AUTHENTICATED_STORAGE_KEY) {"
    ) &&
    fileEmbedSyncStatusHook.includes(
      "if (event.newValue) {\n          refreshAndMaybeRetry();\n        } else {\n          refreshAndMaybeForegroundRetry();\n        }"
    ) &&
    fileEmbedSyncStatusHook.includes("scheduleAutoRetry") &&
    fileEmbedSyncStatusHook.includes("FILE_EMBED_QUEUE_RETRY_DELAY_MS"),
  "文件云同步队列必须在账号恢复、前台恢复、联网恢复和队列变化后做有上限、低频、跨 tab 合并的小批量重试，且卸载后不能继续写入 UI，避免用户登录恢复后仍长时间看不到补传进展，也避免多标签重复上传"
);
check(
  pageIngestRoute.includes("accountSessionUnconfirmedPayload") &&
    pageIngestRoute.includes("function corsSessionUnconfirmedResponse") &&
    pageIngestRoute.includes("页面导入暂时无法确认账号；不会登出，请稍后重试。") &&
    pageIngestRoute.includes("API key 管理暂时无法确认账号；不会登出，请稍后重试。") &&
    pageIngestRoute.includes("hadSessionToken") &&
    !pageIngestRoute.includes("登录已过期，请重新登录。"),
  "pages ingest route 必须保留 CORS 边界，同时把带 cookie 的临时 session 不可确认返回为可重试 session-unconfirmed"
);
check(
  meetingAgentJobsRoute.includes("accountSessionUnconfirmedPayload") &&
    meetingAgentJobsRoute.includes("sessionUnconfirmed.reason") &&
    meetingAgentJobsRoute.includes("sessionUnconfirmed.keeps_session_cookie") &&
    meetingAgentJobsRoute.includes("会议录制任务暂时无法确认账号；不会登出，请稍后重试。") &&
    !meetingAgentJobsRoute.includes("登录已过期，请重新登录。"),
  "meeting agent jobs route 有 cookie 但 session 暂时查不到时必须返回可重试 session-unconfirmed，不能返回登录过期"
);
check(
  shell.includes("当前未登录，请登录后再同步。") &&
    shell.includes("当前未登录，请登录后再拉取每日纪要。") &&
    shell.includes("当前未登录，请登录后再同步数据库。") &&
    !shell.includes("登录已过期"),
  "账号页同步操作的未登录文案不能再提示登录已过期，避免把临时同步失败解释成被登出"
);
check(
  pageSyncClient.includes(
    'export const PAGE_SYNC_STORAGE_KEY_PREFIX = "zhinote.pagesync."'
  ) &&
    databaseSyncClient.includes(
      'export const DATABASE_SYNC_STORAGE_KEY_PREFIX = "zhinote.databasesync."'
    ),
  "页面和数据库同步模块必须导出 storage key 前缀，供账号页和同步中心即时刷新跨标签队列状态"
);
check(
  pageSyncClient.includes("checkAccountCloudSyncGate") &&
    pageSyncClient.includes('accountGate.status === "unconfigured"') &&
    pageSyncClient.includes('accountGate.status === "signed-out"') &&
    pageSyncClient.includes('accountGate.status === "unconfirmed"') &&
    pageSyncClient.includes('| "unconfirmed"') &&
    pageSyncClient.includes('rememberAuthRetryStatus("unconfirmed")') &&
    pageSyncClient.includes('json.reason === "session-unconfirmed" || json.retryable') &&
    pageSyncClient.includes('typeof json.error === "string"') &&
    pageSyncClient.includes("账号登录状态暂时无法确认，本地输入已保留，会稍后重试。") &&
    pageSyncClient.includes("账号云端暂时无法确认，本地输入已保留，会稍后重试。") &&
    pageSyncClient.includes("页面同步接口暂时无法确认账号权限；已保留本地输入并稍后重试。") &&
    !pageSyncClient.includes('probeStatus = "unauthenticated";\n      rememberAuthRetryStatus("unauthenticated");') &&
    databaseSyncClient.includes("checkAccountCloudSyncGate") &&
    databaseSyncClient.includes('accountGate.status === "unconfigured"') &&
    databaseSyncClient.includes('accountGate.status === "signed-out"') &&
    databaseSyncClient.includes('accountGate.status === "unconfirmed"') &&
    databaseSyncClient.includes('| "unconfirmed"') &&
    databaseSyncClient.includes('rememberAuthRetryStatus("unconfirmed")') &&
    databaseSyncClient.includes('json.reason === "session-unconfirmed" || json.retryable') &&
    databaseSyncClient.includes('typeof json.error === "string"') &&
    databaseSyncClient.includes("账号登录状态暂时无法确认，本地输入已保留，会稍后重试。") &&
    databaseSyncClient.includes("账号云端暂时无法确认，本地输入已保留，会稍后重试。") &&
    databaseSyncClient.includes("数据库同步接口暂时无法确认账号权限；已保留本地输入并稍后重试。") &&
    !databaseSyncClient.includes('probeStatus = "unauthenticated";\n      rememberAuthRetryStatus("unauthenticated");'),
  "页面/数据库同步底层客户端应先共享账号 gate，再访问具体 account-sync 路由；具体同步接口 401 只能作为可重试错误，不能把用户踢成未登录"
);
check(
  pageSyncClient.includes("ACCOUNT_PAGE_SYNC_REQUEST_TIMEOUT_MS = 12000") &&
    pageSyncClient.includes("ACCOUNT_PAGE_SYNC_METADATA_REQUEST_TIMEOUT_MS = 3200") &&
    pageSyncClient.includes("async function fetchAccountPageSync") &&
    pageSyncClient.includes("timeoutMs = ACCOUNT_PAGE_SYNC_REQUEST_TIMEOUT_MS") &&
    pageSyncClient.includes("const controller = new AbortController();") &&
    pageSyncClient.includes('cache: "no-store"') &&
    pageSyncClient.includes("signal: controller.signal") &&
    pageSyncClient.includes("controller.abort()") &&
    pageSyncClient.includes("clearTimeout(timeout)") &&
    pageSyncClient.includes("页面同步请求超时；本地输入已保留，会稍后重试。"),
  "页面同步底层 fetch 必须实时 no-store 且可超时取消；超时只能进入可重试错误并明确本地输入已保留"
);
check(
  pageSyncClient.includes("interface AccountPageSyncCallOptions") &&
    pageSyncClient.includes("softTimeout?: boolean") &&
    pageSyncClient.includes("if (!timedOut || !options.softTimeout)") &&
    pageSyncClient.includes("timeoutMs: ACCOUNT_PAGE_SYNC_METADATA_REQUEST_TIMEOUT_MS") &&
    pageSyncClient.includes("云端每日纪要索引读取较慢；已先使用本地缓存，稍后自动重试。") &&
    pageSyncClient.includes("云端会议日历索引读取较慢；已先使用本地缓存，稍后自动重试。"),
  "Daily/ZhiHui 日历 metadata 读取必须走短超时；短超时只降级到本地缓存，不能写入账号失败退避"
);
check(
  databaseSyncClient.includes("ACCOUNT_DATABASE_SYNC_REQUEST_TIMEOUT_MS = 12000") &&
    databaseSyncClient.includes("async function fetchAccountDatabaseSync") &&
    databaseSyncClient.includes("const controller = new AbortController();") &&
    databaseSyncClient.includes('cache: "no-store"') &&
    databaseSyncClient.includes("signal: controller.signal") &&
    databaseSyncClient.includes("controller.abort()") &&
    databaseSyncClient.includes("clearTimeout(timeout)") &&
    databaseSyncClient.includes("数据库同步请求超时；本地输入已保留，会稍后重试。"),
  "数据库同步底层 fetch 必须实时 no-store 且可超时取消；超时只能进入可重试错误并明确本地输入已保留"
);
const coreManifestCompareReceipt = read(
  "src/lib/sync/coreManifestCompareReceipt.ts"
);
const cacheRebuildPreflightReceipt = read(
  "src/lib/sync/cacheRebuildPreflightReceipt.ts"
);
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
check(
  pageSyncClient.includes("const wasQueued = queuedCloudPush.has(record.id)") &&
    pageSyncClient.includes("const pendingChanged = markPendingCloudPush(record.id)") &&
    pageSyncClient.includes("if (pendingChanged || !wasQueued) emitPageSyncStatusChanged();") &&
    pageSyncClient.includes("if (wasPending && meta[id]) return false;"),
  "页面同步高频排队应复用同一 page 的 pending 记录，避免每次输入都重写 localStorage 或重复广播状态"
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
    pushCloudPagesBody.includes("const acknowledgedIds = [...accepted, ...skipped]") &&
    pushCloudPagesBody.includes("clearPendingCloudPushIds(acknowledgedIds)") &&
    pushCloudPagesBody.includes("if (acknowledgedIds.length > 0) setLastPageSyncAtNow();"),
  "直接 pushCloudPages 必须先登记 pending id，再尝试云端上传；成功或被远端跳过后才清理 pending"
);
check(
  pageSyncClient.includes("getPagesForSyncByIds") &&
    pageSyncClient.includes("pages = await getPagesForSyncByIds(retryableIds)") &&
    pageSyncClient.indexOf("pages = await getPagesForSyncByIds(retryableIds)") <
      pageSyncClient.indexOf("const localById = new Map(pages.map"),
  "待上传队列补发必须按 page id 精确读取，短轮询不能为了 pending push 扫描全部本地页面"
);
check(
  pageSyncClient.includes("void pushCloudRecordsInBatches(batch)") &&
    pageSyncClient.includes("clearPendingCloudPushIds([...result.accepted, ...result.skipped])"),
  "页面同步客户端的防抖上传成功或被远端跳过后应清理待上传 id"
);
check(
  pageSyncClient.includes("const pendingPush = await flushPendingCloudPushes({") &&
    pageSyncClient.includes("includeManualReview: options.includeManualReview") &&
    pageSyncClient.includes("forceAccountGate?: boolean") &&
    pageSyncClient.includes("if (options.forceAccountGate)") &&
    pageSyncClient.includes("checkAccountCloudSyncGate({ force: true })") &&
    pageSyncClient.includes("getAccountGatePageSyncMessage") &&
    pageSyncClient.includes("const pendingSyncLogPush = await pushPendingLocalPageChangesToCloud()") &&
    pageSyncClient.includes("const baselineUpload = await uploadLocalPageBaselineIfNeeded()") &&
    pageSyncClient.includes(
      "pendingPush.pushed + pendingSyncLogPush.pushed + baselineUpload.pushed"
    ) &&
    pageSyncClient.includes("bootstrapped?: number") &&
    pageSyncClient.includes("const local = await getAllPageMetadata()") &&
    pageSyncClient.includes("readSyncStorage(LOCAL_BASELINE_UPLOAD_SIGNATURE_KEY)") &&
    !pageSyncClient.includes("const localAfter =") &&
    !pageSyncClient.includes("const toPush: Page[]") &&
    !pageSyncClient.includes("pendingPush.pushed + pushResult.accepted"),
  "reconcile 每轮同步应先补发待上传页面和页面 sync_log，再做一次性本机基线补种；不能回到按 updated_at 猜测上传的旧路径"
);
check(
  pageSyncClient.includes("FlushPendingCloudPushOptions") &&
    pageSyncClient.includes("const retryableIds = options.includeManualReview") &&
    pageSyncClient.includes("PENDING_CLOUD_PAGE_MANUAL_REVIEW_FAILURE_COUNT") &&
    pageSyncClient.includes("retryableIds.length === 0"),
  "页面后台补传默认应跳过连续失败进入 manual review 的 page id，只有人工触发时才包含这些 dead-letter 项"
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
    pageSyncClient.includes("export async function getPendingCloudPageSyncStatusWithSyncLog") &&
    pageSyncClient.includes("export async function pushPendingLocalPageChangesToCloud") &&
    pageSyncClient.includes("syncLogPending") &&
    pageSyncClient.includes("syncLogRetryable") &&
    pageSyncClient.includes("syncLogDeferred") &&
    pageSyncClient.includes("getPageSyncLogPendingCounts()") &&
    pageSyncClient.includes("getPendingPageSyncRecords(1000)") &&
    pageSyncClient.includes("pending: pendingIds.length") &&
    pageSyncClient.includes("queued: queuedCloudPush.size") &&
    pageSyncClient.includes("oldestPendingQueuedAt") &&
    pageSyncClient.includes("pendingSampleIds: pendingIds.slice(0, 5)") &&
    pageSyncClient.includes("authRetryStatus: authRetry.status") &&
    pageSyncClient.includes("authRetryUntil: authRetry.until") &&
    pageSyncClient.includes("lastSyncAt: getLastPageSyncAt()") &&
    pageSyncClient.includes("export function isCloudPagePendingSync") &&
    pageSyncClient.includes("queuedCloudPush.has(pageId)") &&
    pageSyncClient.includes("getPendingCloudPushIds().includes(pageId)"),
  "页面同步客户端应暴露只读 pending 上传状态、sync_log pending、最早排队时间、样本 id 和当前页 pending 判断，供同步页/页面壳展示和补传前后对账"
);
check(
  syncDashboardShell.includes("页面 pending 上传队列") &&
    syncDashboardShell.includes("只保存 page id 和排队时间，不保存页面正文") &&
    syncDashboardShell.includes("最早排队") &&
    syncDashboardShell.includes("认证退避") &&
    syncDashboardShell.includes("下次自动重试") &&
    syncDashboardShell.includes("样本 page id") &&
    syncDashboardShell.includes("补传页面队列") &&
    syncDashboardShell.includes("reconcilePageSync({") &&
    syncDashboardShell.includes("includeManualReview: true") &&
    syncDashboardShell.includes("forceAccountGate: true") &&
    syncDashboardShell.includes("首次账号同步会补种本机页面基线") &&
    syncDashboardShell.includes("之后普通同步会先处理 pending queue 和已到重试时间的 sync_log") &&
    syncDashboardShell.includes("可补传 sync_log") &&
    syncDashboardShell.includes("等待退避/人工处理"),
  "同步页应展示页面 pending 上传队列并提供 quick 增量补传，同时说明首次基线补种和后续增量补传"
);
check(
  databaseSyncClient.includes("export interface PendingCloudDatabaseSyncStatus") &&
    databaseSyncClient.includes("export async function getPendingCloudDatabaseSyncStatus") &&
    databaseSyncClient.includes("PENDING_PUSH_META_KEY") &&
    databaseSyncClient.includes("getPendingCloudDatabasePushMeta") &&
    databaseSyncClient.includes("getPendingDatabaseSyncRecords(1000)") &&
    databaseSyncClient.includes("getDatabaseSyncLogPendingCounts()") &&
    databaseSyncClient.includes("pending: pendingKeys.length") &&
    databaseSyncClient.includes("queued: queuedCloudDatabasePush.size") &&
    databaseSyncClient.includes("syncLogPending") &&
    databaseSyncClient.includes("syncLogRetryable") &&
    databaseSyncClient.includes("syncLogDeferred") &&
    databaseSyncClient.includes("oldestPendingQueuedAt") &&
    databaseSyncClient.includes("pendingSampleKeys: pendingKeys.slice(0, 5)") &&
    databaseSyncClient.includes("authRetryStatus: authRetry.status") &&
    databaseSyncClient.includes("authRetryUntil: authRetry.until") &&
    databaseSyncClient.includes("lastSyncAt: getLastDatabaseSyncAt()"),
  "数据库同步客户端应暴露只读 pending 上传状态、最早排队时间和样本 key，供同步页展示 cloud key、本地 sync_log 和内存批次"
);
check(
  syncDashboardShell.includes("数据库 pending 上传队列") &&
    syncDashboardShell.includes("不展示或导出数据库行值") &&
    syncDashboardShell.includes("补传数据库队列") &&
    syncDashboardShell.includes("reconcileDatabaseSync({") &&
    syncDashboardShell.includes("includeManualReview: true") &&
    syncDashboardShell.includes("forceAccountGate: true") &&
    syncDashboardShell.includes("首次账号同步会补种本机数据库基线") &&
    syncDashboardShell.includes("之后只补传 pending queue 里的数据库变更"),
  "同步页应展示数据库 pending 上传队列并提供 quick 增量补传，同时说明首次基线补种和后续增量补传"
);
check(
  syncDashboardShell.includes("全域 pending 变更分布") &&
    syncDashboardShell.includes("buildPendingDomainRows") &&
    syncDashboardShell.includes("只读取 sync_log 的表名、计数和时间戳") &&
    syncDashboardShell.includes("不读取页面正文、评论正文、数据库值、文件") &&
    syncDashboardShell.includes("首次账号同步会补种本机页面和数据库基线") &&
    syncDashboardShell.includes("之后普通同步只上传这些"),
  "同步页应按全域数据面展示 pending 分布，并保持 metadata-only、首次基线补种与后续增量边界"
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
    syncDashboardShell.includes("不会上传或清理本机缓存") &&
    syncDashboardShell.includes("buildCoreManifestCompareReceipt") &&
    syncDashboardShell.includes("withCoreManifestCompareReceipt") &&
    syncDashboardShell.includes("导出对账收据") &&
    syncDashboardShell.includes("zhinote-core-manifest-compare-receipt") &&
    syncDashboardShell.includes("收据 ID") &&
    coreManifestCompareReceipt.includes(
      'format: "zhinote-core-manifest-compare-receipt"'
    ) &&
    coreManifestCompareReceipt.includes(
      'receipt_status: "metadata-only-local-receipt"'
    ) &&
    coreManifestCompareReceipt.includes("reads_page_body_text: false") &&
    coreManifestCompareReceipt.includes("reads_database_row_values: false") &&
    coreManifestCompareReceipt.includes("reads_comment_bodies: false") &&
    coreManifestCompareReceipt.includes("reads_file_bytes: false") &&
    coreManifestCompareReceipt.includes("uploads_workspace_data: false") &&
    coreManifestCompareReceipt.includes("overwrites_local_cache: false") &&
    coreManifestCompareReceipt.includes(
      "includes_only_counts_watermarks_and_gates: true"
    ) &&
    coreManifestCompareReceipt.includes("buildCoreManifestCompareReceipt") &&
    coreManifestCompareReceipt.includes("receipt_hash"),
  "同步页应提供页面、每日纪要、会议和数据库的核心域云端 manifest metadata-only 对账和本地收据，只读 count/watermark/pending，不读取正文或上传/清缓存"
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
    pageSyncClient.includes("const requiresFreshCoverage =") &&
    pageSyncClient.includes("!options.force && !requiresFreshCoverage") &&
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
  pageSyncClient.includes(
    "shouldRecoverPageMetadataCoverageBeforeIncrementalPull"
  ) &&
    pageSyncClient.includes("const localSummary = await getLocalPageSyncSummary()") &&
    pageSyncClient.includes("localSummary.count === 0 || !localSummary.cursor") &&
    pageSyncClient.includes(
      "comparePageChangeCursorStrings(localSummary.cursor, remoteCursor) < 0"
    ) &&
    reconcilePageSyncBody.includes("requireLocalCacheCoverage: true"),
  "quick 页面同步已有远端游标时也必须确认本地 metadata 覆盖该游标，避免冷缓存设备只拉增量导致旧页面缺失"
);
check(
  pageSyncClient.includes("cache failures should not block cloud-backed page lists"),
  "页面 metadata 增量同步应允许本机缓存写入失败时继续用云端列表渲染"
);

const usePagesHook = read("src/hooks/usePages.ts");
const pageListHotCacheSnapshot = read(
  "src/lib/sync/pageListHotCacheSnapshot.ts"
);
const filesShell = read("src/components/modules/FilesShell.tsx");
const pageImportPlanPanel = read("src/components/modules/PageImportPlanPanel.tsx");
check(
  usePagesHook.includes("syncCloudPageMetadataDelta") &&
    usePagesHook.includes("renderLocalPagesSnapshot") &&
    usePagesHook.includes("await renderLocalPagesSnapshot()") &&
    usePagesHook.includes("loadHotCachePageMetadataSnapshot") &&
    usePagesHook.includes("listHotCachePageMetadata") &&
    usePagesHook.includes("HOT_CACHE_PREFERENCES_SETTING_KEY") &&
    usePagesHook.includes("metadataRecentLimitForHotCachePreferences(preferences)") &&
    usePagesHook.includes("scheduleDeferredMetadataHydration(setPages)") &&
    usePagesHook.includes("mergeFullMetadataWithCurrentStore(metadataPages)") &&
    usePagesHook.includes("mergeCloudMetadataWithPendingLocalPages") &&
    usePagesHook.includes('const loadPageAccountSyncModule = () => import("@/lib/pages/accountPageSync")') &&
    usePagesHook.includes("} = await loadPageAccountSyncModule();") &&
    usePagesHook.includes("isPendingSync(current.id)") &&
    usePagesHook.includes("const currentIsNewer =") &&
    usePagesHook.includes("HOT_CACHE_PREFERENCES_CHANGED_EVENT") &&
    usePagesHook.includes("HOT_CACHE_PREFERENCES_CHANGED_STORAGE_KEY") &&
    usePagesHook.includes("loadPagesSnapshot(") &&
    usePagesHook.includes("metadataFirstContent ? false : includeContent") &&
    usePagesHook.includes("setPages(all);") &&
    usePagesHook.includes("force: false") &&
    usePagesHook.includes("requireLocalCacheCoverage: true") &&
    usePagesHook.includes("mergeMetadataForCount(all, cloudPages)") &&
    usePagesHook.includes("const needsCloudCoverageRecovery =") &&
    usePagesHook.includes("!cloudSnapshotAuthoritative") &&
    usePagesHook.includes("(!localSnapshotLoaded || all.length === 0)") &&
    usePagesHook.includes("force: true") &&
    usePagesHook.includes("requireLocalCacheCoverage: true") &&
    usePagesHook.includes("localSnapshotLoaded") &&
    usePagesHook.includes("const refreshRequestRef = useRef(0)") &&
    usePagesHook.includes("const isCurrentRefresh = () => refreshRequestRef.current === requestId") &&
    usePagesHook.includes("const hasUsableLocalFirstPaint = localSnapshotLoaded && all.length > 0") &&
    usePagesHook.includes("void applyCloudMetadataDelta({") &&
    !usePagesHook.includes("fullRefresh: all.length === 0 || !localSnapshotLoaded") &&
    usePagesHook.includes("The browser database is only a rebuildable hot cache") &&
    usePagesHook.includes("setPages(all)") &&
    usePagesHook.includes("Cloud metadata refresh is best effort") &&
    usePagesHook.includes("cloudSnapshotAuthoritative = true") &&
    usePagesHook.includes("includeContent && !localSnapshotLoaded && all.length === 0") &&
    usePagesHook.includes("readPageListHotCacheSnapshot") &&
    usePagesHook.includes("pageListHotCacheSnapshotPageToPage") &&
    usePagesHook.includes("writePageListHotCacheSnapshot") &&
    usePagesHook.includes("browserHotCacheBootstrappedRef") &&
    usePagesHook.includes("const incomingPages = message.pages.map(remoteMetadataToPage);") &&
    usePagesHook.includes("pages: nextPages") &&
    usePagesHook.includes('message.reason === "cloud-pull"') &&
    usePagesHook.includes('"页面列表已接收云端 metadata 更新，热缓存已同步。"') &&
    usePagesHook.includes('"页面列表已接收跨端本地 metadata 更新，热缓存已同步。"') &&
    usePagesHook.includes("isPageListHotCacheFirstPaintPage") &&
    usePagesHook.includes("!isPageListHotCacheFirstPaintPage(current)") &&
    usePagesHook.indexOf("await renderLocalPagesSnapshot()") <
      usePagesHook.indexOf("const cloud = await syncCloudPageMetadataDelta") &&
    usePagesHook.indexOf("const snapshot = readPageListHotCacheSnapshot();") <
      usePagesHook.indexOf("refresh({ broadcast: false });") &&
    !usePagesHook.includes("fetchCloudPageMetadata"),
  "usePages 应先显示浏览器页面目录热缓存，再显示本地热缓存，再用云端 metadata 增量校正；includeContent 只能在本地缓存不可读时用云端 metadata 兜底；云端 full refresh 不能隐藏本机 pending 待上传页面"
);
check(
  usePagesHook.includes("autoLoad?: boolean") &&
    usePagesHook.includes("autoHydrateContent?: boolean") &&
    usePagesHook.includes("metadataFirstContent && autoHydrateContent") &&
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
  pageListHotCacheSnapshot.includes('format: "zhinote-page-list-hot-cache-snapshot"') &&
    pageListHotCacheSnapshot.includes('route_target: "global-page-list"') &&
    pageListHotCacheSnapshot.includes("PAGE_LIST_HOT_CACHE_FRESH_MS = 24 * 60 * 60 * 1000") &&
    pageListHotCacheSnapshot.includes("PAGE_LIST_HOT_CACHE_STALE_MS = 7 * 24 * 60 * 60 * 1000") &&
    pageListHotCacheSnapshot.includes("PAGE_LIST_HOT_CACHE_MAX_PAGES = 500") &&
    pageListHotCacheSnapshot.includes("records_metadata_only: true") &&
    pageListHotCacheSnapshot.includes("stores_page_properties: false") &&
    pageListHotCacheSnapshot.includes("enters_sync_log: false") &&
    pageListHotCacheSnapshot.includes("uploads_workspace_data: false") &&
    pageListHotCacheSnapshot.includes("window.localStorage.setItem(PAGE_LIST_HOT_CACHE_KEY") &&
    pageListHotCacheSnapshot.includes("shouldWritePageListHotCacheSnapshot") &&
    pageListHotCacheSnapshot.includes("buildPageListHotCacheSnapshotSignature") &&
    pageListHotCacheSnapshot.includes("content_text: null") &&
    !pageListHotCacheSnapshot.includes("page.content_text") &&
    !pageListHotCacheSnapshot.includes("page.content_yjs") &&
    !pageListHotCacheSnapshot.includes("page.properties") &&
    !pageListHotCacheSnapshot.includes("recordSyncChange") &&
    !pageListHotCacheSnapshot.includes("INSERT INTO sync_log") &&
    !pageListHotCacheSnapshot.includes("fetch("),
  "页面目录热缓存必须是浏览器本地、metadata-only、有 24h/7d 新旧窗口、有界存储、不保存正文/属性、不进 sync_log、不上传"
);
check(
  shell.includes("usePages({ autoLoad: false })") &&
    filesShell.includes("usePages({ autoLoad: false })") &&
    pageImportPlanPanel.includes("usePages({ autoLoad: false })"),
  "AccountShell/FilesShell/PageImportPlanPanel 只需要手动 refresh 时不应自动读取全量页面 metadata"
);

const dailyNotesShell = read("src/components/modules/DailyNotesShell.tsx");
const dailyHotCacheSnapshot = read("src/lib/sync/dailyHotCacheSnapshot.ts");
const dailyCalendarLoadStatus = read("src/lib/sync/dailyCalendarLoadStatus.ts");
const dailyCreateOpenModeSettings = read(
  "src/lib/sync/dailyCreateOpenModeWorkspaceSettings.ts"
);
const meetingCalendarLoadStatus = read(
  "src/lib/sync/meetingCalendarLoadStatus.ts"
);
check(
  dailyNotesShell.includes("const storedDailyRootId = getModuleRootIdSync(\"daily\")") &&
    dailyNotesShell.includes("const cachedCloud = includeCloud") &&
    dailyNotesShell.includes("DAILY_CLOUD_CACHE_FRESH_MS = 24 * 60 * 60 * 1000") &&
    dailyNotesShell.includes("DAILY_CLOUD_CACHE_STALE_MS = 7 * 24 * 60 * 60 * 1000") &&
    dailyNotesShell.includes("type CachedDailyCloudMetadataResult") &&
    dailyNotesShell.includes("stale: cacheAgeMs > DAILY_CLOUD_CACHE_FRESH_MS") &&
    dailyNotesShell.includes("较早缓存的云端每日纪要目录") &&
    dailyNotesShell.includes("cached_cloud_stale") &&
    dailyNotesShell.includes("if (!cachedCloud.stale)") &&
    dailyNotesShell.includes("cachedHotSnapshot,\n        startDate,\n        endDate") &&
    dailyNotesShell.includes("let cloudMetadataPromise: Promise<DailyCloudMetadataResult> | null = null;") &&
    dailyNotesShell.includes("const startDailyCloudMetadataFetch = () => {") &&
    dailyNotesShell.includes("const earlyCloudMetadata = includeCloud") &&
    dailyNotesShell.includes("云端每日纪要目录先返回") &&
    dailyNotesShell.includes("formatDailyCloudMetadataFailureMessage") &&
    dailyNotesShell.includes("云端每日纪要索引本轮读取失败；当前先显示本机/热缓存内容，稍后刷新会自动重试。") &&
    dailyNotesShell.includes('cloud.status === "unconfirmed"') &&
    dailyNotesShell.includes("账号会话暂时无法确认，本地每日纪要继续可用；云端会在后台自动重试。") &&
    dailyNotesShell.includes('recordDailyPerformance("cloud-unconfirmed")') &&
    dailyNotesShell.indexOf("readCachedDailyCloudMetadata(startDate, endDate)") <
      dailyNotesShell.indexOf("const localMetadata = await listDailyPageMetadataForCalendar") &&
    dailyNotesShell.indexOf("const earlyCloudMetadata = includeCloud") <
      dailyNotesShell.indexOf("const localMetadata = await listDailyPageMetadataForCalendar") &&
    dailyNotesShell.indexOf("const earlyCloudMetadata = includeCloud") <
      dailyNotesShell.indexOf("const cloudMetadata =\n          earlyCloudMetadata ?? startDailyCloudMetadataFetch()") &&
    dailyNotesShell.indexOf("const earlyCloudMetadata = includeCloud") <
      dailyNotesShell.indexOf("const storedDailyRootId = getModuleRootIdSync(\"daily\")") &&
    dailyNotesShell.includes("publishNotes(Array.from(byId.values()), {") &&
    dailyNotesShell.includes("void ensureDailyDateIndexBackfilled()") &&
    dailyNotesShell.includes(
      'const loadPageAccountSyncModule = () => import("@/lib/pages/accountPageSync")'
    ) &&
    dailyNotesShell.includes(".then(({ fetchDailyCloudMetadata }) =>") &&
    !dailyNotesShell.includes("import {\n  fetchDailyCloudMetadata") &&
    dailyNotesShell.includes("fetchDailyCloudMetadata({") &&
    dailyNotesShell.includes("HOT_CACHE_PREFERENCES_SETTING_KEY") &&
    dailyNotesShell.includes("parseHotCachePreferences") &&
    dailyNotesShell.includes("metadataRecentLimitForHotCachePreferences") &&
    dailyNotesShell.includes("recentLimit: recentMetadataLimit") &&
    dailyNotesShell.includes("const calendarIndexes = useMemo(") &&
    dailyNotesShell.includes("buildDailyCalendarIndexes(notes, calendarDateKeys)") &&
    dailyNotesShell.includes("function buildDailyCalendarIndexes(") &&
    dailyNotesShell.includes("const notesById = calendarIndexes.notesById") &&
    dailyNotesShell.includes("selectDailyNotesForCalendarRender(") &&
    dailyNotesShell.includes("DAILY_CALENDAR_RENDER_DAY_LIMIT") &&
    dailyNotesShell.includes(
      "const [dailyNoteCountByDate, setDailyNoteCountByDate]"
    ) &&
    dailyNotesShell.includes("DAILY_RENDER_RECENT_BUFFER_LIMIT") &&
    dailyNotesShell.includes("notesRenderFingerprintRef") &&
    dailyNotesShell.includes("publishDailyCalendarRenderSelection(") &&
    dailyNotesShell.includes("function publishDailyCalendarRenderSelection(") &&
    dailyNotesShell.includes("dailyNotesRenderFingerprint(notes)") &&
    dailyNotesShell.includes("dailyNoteCountsFingerprint(countsByDate)") &&
    dailyNotesShell.includes("fingerprintRef.current === nextFingerprint") &&
    dailyNotesShell.includes("setNotes(notes)") &&
    dailyNotesShell.includes("setDailyNoteCountByDate(countsByDate)") &&
    dailyNotesShell.includes("type DailyCalendarLoadOptions") &&
    dailyNotesShell.includes("const cloudLoadingRef = useRef(false)") &&
    dailyNotesShell.includes("cloudLoadingRef.current = cloudLoading") &&
    dailyNotesShell.includes("interruptCloud?: boolean") &&
    dailyNotesShell.includes("preserveVisibleNotes?: boolean") &&
    dailyNotesShell.includes("const interruptCloud = opts?.interruptCloud ?? includeCloud") &&
    dailyNotesShell.includes("!interruptCloud && loadRequestRef.current > 0") &&
    dailyNotesShell.includes("const mountedRef = useRef(false)") &&
    dailyNotesShell.includes("mountedRef.current = false") &&
    dailyNotesShell.includes("if (!mountedRef.current) return") &&
    dailyNotesShell.includes("if (!includeCloud && interruptCloud && mountedRef.current)") &&
    dailyNotesShell.includes("seedVisibleDailyNotesForBackgroundRefresh(") &&
    dailyNotesShell.includes("function seedVisibleDailyNotesForBackgroundRefresh(") &&
    dailyNotesShell.includes("interruptCloud: false") &&
    dailyNotesShell.includes("preserveVisibleNotes: true") &&
    dailyNotesShell.includes("buildDailyCalendarLoadStatusView") &&
    dailyNotesShell.includes("createDailyCalendarLoadStatus") &&
    dailyNotesShell.includes("DailyCalendarLoadStatusStrip") &&
    dailyNotesShell.includes('data-testid="daily-calendar-load-status"') &&
    dailyNotesShell.includes('publishCalendarStatus("cloud-checking"') &&
    dailyNotesShell.includes('phase: "cloud-ready"') &&
    dailyNotesShell.includes('phase: "optimistic-draft"') &&
    dailyNotesShell.includes("const deferredRecentNotes = useDeferredValue(calendarIndexes.recentNotes)") &&
    dailyNotesShell.includes("deferredRecentNotes.slice(0, DAILY_RECENT_VISIBLE_LIMIT)") &&
    dailyNotesShell.includes("function addRecentDailyNoteCandidate(") &&
    dailyNotesShell.includes("pruneDailyCalendarDateKeySet(current, calendarDateKeys)") &&
    dailyNotesShell.includes("pruneDailyCalendarDateLimitMap(current, calendarDateKeys)") &&
    dailyNotesShell.includes("function pruneDailyCalendarDateKeySet(") &&
    dailyNotesShell.includes("function pruneDailyCalendarDateLimitMap(") &&
    dailyNotesShell.includes("rebuildPageDateKeyIndex") &&
    dailyNotesShell.includes("const DAILY_DATE_INDEX_BACKFILL_BATCH = 96") &&
    dailyNotesShell.includes("const DAILY_DATE_INDEX_BACKFILL_MAX_PASSES = 1") &&
    dailyNotesShell.includes("DAILY_DATE_INDEX_BACKFILL_RESUME_DELAY_MS") &&
    dailyNotesShell.includes("scheduleDailyDateIndexBackfillResume()") &&
    dailyNotesShell.includes("includeUnindexedFallback: false") &&
    dailyNotesShell.includes("includeUnindexedFallback: true") &&
    dailyNotesShell.includes('source: "local-fallback-metadata"') &&
    dailyNotesShell.includes("applyDailyPageUpdatePayloads(\n        dailyPayloads,") &&
    dailyNotesShell.includes("rootId: dailyRootId") &&
    dailyNotesShell.includes("message.reason === \"cloud-pull\"\n              ? \"cloud-metadata\"\n              : \"optimistic-local\"") &&
    dailyNotesShell.includes("source: hotCache.source") &&
    dailyNotesShell.includes("DAILY_LOCAL_METADATA_REFRESH_DELAY_MS") &&
    dailyNotesShell.includes("DAILY_LOCAL_METADATA_FALLBACK_DELAY_MS") &&
    dailyNotesShell.includes("DAILY_CLOUD_METADATA_RECHECK_DELAY_MS") &&
    dailyNotesShell.includes("DAILY_FOREGROUND_QUIET_WINDOW_MS = 3200") &&
    dailyNotesShell.includes("DAILY_FOREGROUND_REFRESH_MAX_DELAY_MS = 2400") &&
    dailyNotesShell.includes("const foregroundQuietUntilRef = useRef(0)") &&
    dailyNotesShell.includes("markDailyForegroundInteraction") &&
    dailyNotesShell.includes("getDailyForegroundRefreshDelay") &&
    dailyNotesShell.includes("scheduleDailyForegroundAwareRefresh") &&
    dailyNotesShell.includes("window.setTimeout(runWhenQuiet, foregroundDelay)") &&
    dailyNotesShell.includes("return scheduleDailyForegroundAwareRefresh(() => {") &&
    dailyNotesShell.includes("cancelLocalReload = scheduleDailyForegroundAwareRefresh(() => {") &&
    dailyNotesShell.includes("cancelFallbackReload = scheduleDailyForegroundAwareRefresh(() => {") &&
    dailyNotesShell.includes("cancelCloudRecheck = scheduleDailyForegroundAwareRefresh(() => {") &&
    dailyNotesShell.includes("DAILY_INITIAL_CLOUD_RECHECK_DELAY_MS") &&
    dailyNotesShell.includes("DAILY_INITIAL_CLOUD_RECHECK_IDLE_TIMEOUT_MS") &&
    dailyNotesShell.includes("const DAILY_CLOUD_METADATA_RECHECK_DELAY_MS = 900") &&
    dailyNotesShell.includes("const DAILY_INITIAL_CLOUD_RECHECK_DELAY_MS = 120") &&
    dailyNotesShell.includes("const DAILY_INITIAL_CLOUD_RECHECK_IDLE_TIMEOUT_MS = 900") &&
    dailyNotesShell.includes("void load({\n        includeCloud: false,\n        interruptCloud: false,\n        preserveVisibleNotes: true,\n      });") &&
    dailyNotesShell.includes("cancelCloudRecheck = scheduleDailyIdleTask(() => {\n        void load({\n          includeCloud: true,\n          preserveVisibleNotes: true,\n        });\n      }, DAILY_INITIAL_CLOUD_RECHECK_IDLE_TIMEOUT_MS);") &&
    dailyNotesShell.includes("}, DAILY_INITIAL_CLOUD_RECHECK_DELAY_MS);") &&
    dailyNotesShell.includes("cancelCloudRecheck?.()") &&
    dailyNotesShell.includes("let cancelLocalReload: (() => void) | null = null") &&
    dailyNotesShell.includes("let cancelCloudRecheck: (() => void) | null = null") &&
    dailyNotesShell.includes("cancelLocalReload?.()") &&
    dailyNotesShell.includes("cancelFallbackReload?.()") &&
    dailyNotesShell.indexOf("includeUnindexedFallback: false") <
      dailyNotesShell.indexOf("const fallbackMetadata = await listDailyPageMetadataForCalendar") &&
    dailyNotesShell.indexOf("const fallbackMetadata = await listDailyPageMetadataForCalendar") <
      dailyNotesShell.indexOf("includeUnindexedFallback: true") &&
    dailyNotesShell.indexOf("includeUnindexedFallback: true") <
      dailyNotesShell.indexOf("await ensureDailyDateIndexBackfilled()") &&
    !dailyNotesShell.includes("getAllPageMetadata"),
  "DailyNotesShell 首屏应本地/缓存优先，recent metadata 窗口按热缓存偏好有界扩大；首屏只能走日期索引，未索引 Notion 导入 fallback 必须后台补齐；页面卸载后后台加载不能继续写 UI"
);
check(
  dailyHotCacheSnapshot.includes("DAILY_HOT_CACHE_FRESH_MS = 24 * 60 * 60 * 1000") &&
    dailyHotCacheSnapshot.includes("DAILY_HOT_CACHE_STALE_MS = 7 * 24 * 60 * 60 * 1000") &&
    dailyHotCacheSnapshot.includes("stale?: boolean") &&
    dailyHotCacheSnapshot.includes("withDailyHotCacheSnapshotFreshness") &&
    dailyHotCacheSnapshot.includes("isStaleDailyHotCacheSnapshot(current)") &&
    dailyHotCacheSnapshot.includes('key === "cached_at" || key === "stale"'),
  "Daily hot cache 应区分 24h 新鲜窗口和 7 天旧缓存兜底窗口；旧缓存可先显示但不能影响签名对比或成为真实数据源"
);
check(
  dailyNotesShell.includes("staleHotCacheMerged") &&
    dailyNotesShell.includes("overlappingStaleHotMerged") &&
    dailyNotesShell.includes("已先显示较早的本机热缓存") &&
    dailyNotesShell.includes("已先显示较早的本机重叠热缓存"),
  "DailyNotesShell 使用旧热缓存首屏兜底时必须明确提示后台仍在校正，避免用户把旧 metadata 当成最终同步结果"
);
check(
  dailyCalendarLoadStatus.includes("DailyCalendarLoadPhase") &&
    dailyCalendarLoadStatus.includes("buildDailyCalendarLoadStatusView") &&
    dailyCalendarLoadStatus.includes("visibleNotes") &&
    dailyCalendarLoadStatus.includes("visibleDays") &&
    dailyCalendarLoadStatus.includes("热缓存") &&
    dailyCalendarLoadStatus.includes("本地索引") &&
    dailyCalendarLoadStatus.includes("后台补齐") &&
    dailyCalendarLoadStatus.includes("云端校正") &&
    dailyCalendarLoadStatus.includes("Daily calendar load status is metadata-only") &&
    dailyCalendarLoadStatus.includes("does not read page body text") &&
    dailyCalendarLoadStatus.includes("does not send network requests") &&
    dailyCalendarLoadStatus.includes("does not write server data") &&
    !dailyCalendarLoadStatus.includes("content_text") &&
    !dailyCalendarLoadStatus.includes("content_yjs") &&
    !dailyCalendarLoadStatus.includes("field_values") &&
    !dailyCalendarLoadStatus.includes("comment.body") &&
    !dailyCalendarLoadStatus.includes("file.dataUrl") &&
    !dailyCalendarLoadStatus.includes("fetch(") &&
    !dailyCalendarLoadStatus.includes("localStorage") &&
    !dailyCalendarLoadStatus.includes("recordSyncChange") &&
    !dailyCalendarLoadStatus.includes("INSERT INTO sync_log"),
  "每日纪要加载状态条必须只使用阶段、计数和来源 metadata，不能读取正文、访问浏览器缓存、请求网络或写同步队列"
);
check(
  dailyNotesShell.indexOf("seedDailyNoteForImmediateOpen(optimisticNote)") <
    dailyNotesShell.indexOf("persistOptimisticDailyNote") &&
    dailyNotesShell.includes("markDailyForegroundInteraction();") &&
    dailyNotesShell.includes("markDailyForegroundInteraction();\n      warmDailyPeekOpen();") &&
    dailyNotesShell.indexOf("rememberPendingPageDraft(optimisticNote)") <
      dailyNotesShell.indexOf("upsertPages([optimisticNote])") &&
    dailyNotesShell.indexOf("upsertPages([optimisticNote])") <
      dailyNotesShell.indexOf("void seedDailyNoteForImmediateOpen(optimisticNote);") &&
    dailyNotesShell.indexOf("void seedDailyNoteForImmediateOpen(optimisticNote);") <
      dailyNotesShell.indexOf("setPeekInitialPage(optimisticNote);") &&
    dailyNotesShell.indexOf("void seedDailyNoteForImmediateOpen(optimisticNote);") <
      dailyNotesShell.indexOf("scheduleOptimisticDailyHotCacheWrite(optimisticNote") &&
    dailyNotesShell.includes(
      "const currentNotes = collectVisibleDailyNotesForHotCache(notesByDate);"
    ) &&
    dailyNotesShell.includes(
      "setOpeningDraftAndRef({ pageId: optimisticNote.id, dateKey });\n        rememberPendingPageDraft(optimisticNote);"
    ) &&
    dailyNotesShell.includes("scheduleDailyCreateOpenWarmupAfterFeedback") &&
    dailyNotesShell.includes("const activateDailyCreate = useCallback") &&
    dailyNotesShell.includes('data-create-activation="single-entry"') &&
    dailyNotesShell.indexOf("setPeekInitialPage(optimisticNote);") <
      dailyNotesShell.indexOf("setPeekPageId(optimisticNote.id);") &&
    dailyNotesShell.indexOf("setPeekPageId(optimisticNote.id);") <
      dailyNotesShell.indexOf("persistOptimisticDailyNote") &&
    dailyNotesShell.includes("const localShellRequestedMs =\n        getLocalPerformanceNow() - createStartedAt;") &&
    dailyNotesShell.includes('status: "daily-create-local-shell-requested"') &&
    dailyNotesShell.includes("local_handoff_seeded: 1") &&
    dailyNotesShell.includes("useLocalFirstPageNavigation") &&
    dailyNotesShell.includes("const pageRoute = `/page/${optimisticNote.id}`") &&
    dailyNotesShell.includes("router.prefetch(pageRoute)") &&
    dailyNotesShell.includes("scheduleOptimisticDailyHotCacheWrite(optimisticNote") &&
    dailyNotesShell.includes("scheduleOptimisticDailyHotCacheWrite(noteForSave") &&
    dailyNotesShell.includes("pendingOptimisticDailyHotCacheWritesRef.current.get(cacheKey)?.();") &&
    dailyNotesShell.includes("pendingOptimisticDailyHotCacheWritesRef.current.clear();") &&
    dailyNotesShell.includes("setPeekInitialPage(optimisticNote);") &&
    dailyNotesShell.includes("setPeekPageId(optimisticNote.id);") &&
    dailyNotesShell.includes('openPage(optimisticNote, { source: "daily-create" })') &&
    dailyNotesShell.includes("const handleCreateFailure = (error: unknown) =>") &&
    dailyNotesShell.includes("current.filter((item) => item.id !== optimisticNote.id)") &&
    dailyNotesShell.includes("已有纪要和本地缓存没有被删除，可以稍后重试。") &&
    dailyNotesShell.includes("新建每日纪要时本地草稿准备失败，日历仍保留现有内容。") &&
    dailyNotesShell.includes("handleCreateFailure(error);\n        return;") &&
    dailyNotesShell.includes("DEFAULT_DAILY_CREATE_OPEN_MODE") &&
    dailyCreateOpenModeSettings.includes(
      'DEFAULT_DAILY_CREATE_OPEN_MODE: DailyCreateOpenMode =\n  "full-page"'
    ) &&
    dailyNotesShell.includes('"zhinote.daily.createOpenMode.v4"') &&
    dailyNotesShell.includes("点 + 即可进入一篇新纪要") &&
    dailyNotesShell.includes('data-testid="daily-create-open-mode"') &&
    dailyNotesShell.includes("open_mode_full_page: dailyCreateOpenMode === \"full-page\" ? 1 : 0") &&
    dailyNotesShell.includes("updateDailyCreateOpenMode") &&
    dailyNotesShell.includes("upsertWorkspaceSetting(") &&
    dailyNotesShell.includes("setOpeningDraftAndRef({ pageId: optimisticNote.id, dateKey })") &&
    dailyNotesShell.includes("openingDraftRef.current = resolved;") &&
    dailyNotesShell.includes("DAILY_CREATE_FEEDBACK_FRAME_TIMEOUT_MS") &&
    dailyNotesShell.includes("waitForDailyCreateFeedbackFrame") &&
    dailyNotesShell.indexOf("if (!mountedRef.current) {\n            releaseCreatingDate();\n            return;\n          }") <
      dailyNotesShell.indexOf('openPage(optimisticNote, { source: "daily-create" })') &&
    dailyNotesShell.includes("const warmDailyPeekOpen = useCallback") &&
    dailyNotesShell.includes("const warmDailyCreateOpenPath = useCallback") &&
    dailyNotesShell.includes("warmDailyPeekOpen();") &&
    dailyNotesShell.includes("DAILY_PEEK_EDITOR_WARMUP_DELAY_MS") &&
    dailyNotesShell.includes("DAILY_PEEK_EDITOR_WARMUP_IDLE_TIMEOUT_MS") &&
    dailyNotesShell.includes("const peekEditorWarmupTimer = window.setTimeout(() => {") &&
    dailyNotesShell.includes("cancelPeekEditorWarmup = scheduleDailyIdleTask(() => {") &&
    dailyNotesShell.includes("}, DAILY_PEEK_EDITOR_WARMUP_IDLE_TIMEOUT_MS)") &&
    dailyNotesShell.includes("}, DAILY_PEEK_EDITOR_WARMUP_DELAY_MS)") &&
    dailyNotesShell.includes("window.clearTimeout(peekEditorWarmupTimer)") &&
    dailyNotesShell.includes("cancelPeekEditorWarmup?.();") &&
    dailyNotesShell.includes("onPointerEnter={warmDailyCreateOpenPath}") &&
    dailyNotesShell.includes("const addNoteOnPointerDown = useCallback") &&
    dailyNotesShell.includes("onPointerDown={(event) => addNoteOnPointerDown(event, todayKey)}") &&
    dailyNotesShell.includes("onPointerDown={(event) => addNoteOnPointerDown(event, key)}") &&
    dailyNotesShell.includes("onFocus={warmDailyCreateOpenPath}") &&
    !dailyNotesShell.includes("const warmPageRoute = useCallback(() => {\n    warmPagePeekModal();") &&
    dailyNotesShell.includes("data-testid={`daily-opening-note-${key}`}") &&
    dailyNotesShell.includes('data-testid="daily-opening-draft-banner"') &&
    dailyNotesShell.includes("没有跳转？打开页面") &&
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
    dailyNotesShell.includes(".then(({ queueCloudPagePush }) =>") &&
    dailyNotesShell.includes("queueCloudPagePush(record)") &&
    !dailyNotesShell.includes("createPageWithCloud"),
  "DailyNotesShell 点击 + 应立即弹出乐观草稿 peek 页面，后台加入云端上传队列；已有纪要仍可用 peek 预览，完整页打开仍走本地优先"
);
check(
  dailyNotesShell.includes("expandedDateKeys") &&
    dailyNotesShell.includes("visibleNoteLimitByDate") &&
    dailyNotesShell.includes("toggleDateExpansion") &&
    dailyNotesShell.includes("showMoreNotesForDate") &&
    dailyNotesShell.includes("DAILY_CALENDAR_MANUAL_DAY_LOAD_LIMIT") &&
    dailyNotesShell.includes("const [loadingMoreDateKey, setLoadingMoreDateKey]") &&
    dailyNotesShell.includes("const loadMoreNotesForDate = useCallback") &&
    dailyNotesShell.includes("const targetRangeLimit = Math.min") &&
    dailyNotesShell.includes("currentLoadedCount + DAILY_CALENDAR_MANUAL_DAY_LOAD_LIMIT") &&
    dailyNotesShell.includes("rangeLimit: targetRangeLimit") &&
    dailyNotesShell.includes("正在补齐…") &&
    dailyNotesShell.includes("点击补齐") &&
    dailyNotesShell.includes("DAILY_CALENDAR_EXPAND_BATCH") &&
    dailyNotesShell.includes("DAILY_CALENDAR_RENDER_DAY_LIMIT") &&
    dailyNotesShell.includes("buildOccupiedDailyCalendarHydrationKeys(") &&
    dailyNotesShell.includes("const occupiedDateKeys = buildOccupiedDailyCalendarHydrationKeys") &&
    dailyNotesShell.includes("for (const dateKey of occupiedDateKeys)") &&
    dailyNotesShell.includes("return changed ? next : current;") &&
    !dailyNotesShell.includes("const revealNextOccupiedBatch = () =>") &&
    !dailyNotesShell.includes("DAILY_CALENDAR_OCCUPIED_HYDRATION_BATCH") &&
    dailyNotesShell.includes("const dayTotalCount =") &&
    dailyNotesShell.includes("const loadedHiddenCount = Math.max(") &&
    dailyNotesShell.includes("const isRenderCapped =") &&
    dailyNotesShell.includes("const visibleLimit = isExpanded") &&
    dailyNotesShell.includes("const visibleNotes = dayNotes.slice(0, visibleLimit)") &&
    dailyNotesShell.includes("Math.min(totalCount, currentLimit + DAILY_CALENDAR_EXPAND_BATCH)") &&
    dailyNotesShell.includes("再显示 ${nextBatchCount} 条") &&
    dailyNotesShell.includes("dayTotalCount > DAILY_CALENDAR_VISIBLE_LIMIT") &&
    dailyNotesShell.includes("已显示 ${visibleNotes.length}/${dayTotalCount} 条") &&
    dailyNotesShell.includes("为保持日历流畅") &&
    dailyNotesShell.includes("cancelScheduledBatch = scheduleDailyIdleTask(") &&
    !dailyNotesShell.includes("DAILY_VISIBLE_CONTENT_WARMUP") &&
    !dailyNotesShell.includes("collectVisibleDailyContentWarmupCandidates") &&
    !dailyNotesShell.includes("warmDailyNoteContent") &&
    !dailyNotesShell.includes("onMouseEnter={() => warmDailyNoteContent(note)}") &&
    !dailyNotesShell.includes("hiddenNotes.map"),
  "DailyNotesShell 月历单元格应只渲染可见条目，更多纪要必须点击后分批展开；有内容日期必须立即显示 metadata 以避免刷新后延迟出现；超大单日导入只能按当天补齐 metadata；正文必须在 peek/full page 打开后按需补齐，不能把全部 metadata 或正文塞进 DOM"
);

const meetingScheduleShell = read(
  "src/components/modules/MeetingScheduleShell.tsx"
);
const meetingHotCacheSnapshot = read("src/lib/sync/meetingHotCacheSnapshot.ts");
const meetingScheduleOpensCreatedPageRoute =
  meetingScheduleShell.includes("const pageRoute = `/page/${result.page.id}`") ||
  meetingScheduleShell.includes("const pageRoute = `/page/${page.id}`") ||
  meetingScheduleShell.includes("const pageRoute = `/page/${seededPage.id}`");
check(
  meetingScheduleShell.includes("buildMeetingCalendarLoadStatusView") &&
    meetingScheduleShell.includes("createMeetingCalendarLoadStatus") &&
    meetingScheduleShell.includes("MeetingCalendarLoadStatusStrip") &&
    meetingScheduleShell.includes('data-testid="meeting-calendar-load-status"') &&
    meetingScheduleShell.includes('publishCalendarStatus("cloud-checking"') &&
    meetingScheduleShell.includes('publishCalendarStatus("local-fallback"') &&
    meetingScheduleShell.includes('publishLoadStatus("cloud-ready"') &&
    meetingScheduleShell.includes('publishCalendarStatus("optimistic-draft"') &&
    meetingScheduleShell.includes("includeUnindexedFallback: false") &&
    meetingScheduleShell.includes("includeUnindexedFallback: true") &&
    meetingCalendarLoadStatus.includes("MeetingCalendarLoadPhase") &&
    meetingCalendarLoadStatus.includes('"local-fallback"') &&
    meetingCalendarLoadStatus.includes('"index-backfill"') &&
    meetingCalendarLoadStatus.includes("visibleMeetings") &&
    meetingCalendarLoadStatus.includes("visibleDays") &&
    meetingCalendarLoadStatus.includes("热缓存") &&
    meetingCalendarLoadStatus.includes("本地索引") &&
    meetingCalendarLoadStatus.includes("本地补齐") &&
    meetingCalendarLoadStatus.includes("后台补齐") &&
    meetingCalendarLoadStatus.includes("日期索引校正中") &&
    meetingCalendarLoadStatus.includes("云端校正") &&
    meetingCalendarLoadStatus.includes("Meeting calendar load status is metadata-only") &&
    meetingCalendarLoadStatus.includes("does not read meeting body text") &&
    meetingCalendarLoadStatus.includes("join URLs") &&
    meetingCalendarLoadStatus.includes("does not send network requests") &&
    meetingCalendarLoadStatus.includes("does not write server data") &&
    !meetingCalendarLoadStatus.includes("content_text") &&
    !meetingCalendarLoadStatus.includes("content_yjs") &&
    !meetingCalendarLoadStatus.includes("joinUrl") &&
    !meetingCalendarLoadStatus.includes("meetingId") &&
    !meetingCalendarLoadStatus.includes("entry.passcode") &&
    !meetingCalendarLoadStatus.includes("field_values") &&
    !meetingCalendarLoadStatus.includes("comment.body") &&
    !meetingCalendarLoadStatus.includes("file.dataUrl") &&
    !meetingCalendarLoadStatus.includes("fetch(") &&
    !meetingCalendarLoadStatus.includes("localStorage") &&
    !meetingCalendarLoadStatus.includes("recordSyncChange") &&
    !meetingCalendarLoadStatus.includes("INSERT INTO sync_log"),
  "会议日历加载状态条必须只使用阶段、计数和来源 metadata，不能读取正文、会议链接、访问浏览器缓存、请求网络或写同步队列"
);
check(
  !meetingScheduleShell.includes('from "@/hooks/usePages"') &&
    !meetingScheduleShell.includes("usePages(") &&
    !meetingScheduleShell.includes("await refresh()") &&
    !meetingScheduleShell.includes("void refresh()") &&
    meetingScheduleShell.includes("upsertMeetingInView(updatedPage)") &&
    meetingScheduleShell.includes("scheduleOptimisticMeetingHotCacheWrite(updatedPage, rootId, 160)") &&
    meetingScheduleShell.includes("applyMeetingPageUpdatePayloads(\n        meetingPayloads,") &&
    meetingScheduleShell.includes("rootId: meetingRootId") &&
    meetingScheduleShell.includes("message.reason === \"cloud-pull\"\n              ? \"cloud-metadata\"\n              : \"optimistic-local\"") &&
    meetingScheduleShell.includes("source: hotCache.source"),
  "MeetingScheduleShell 创建、导入和状态更新应局部刷新会议日历与热缓存，不能挂 usePages 或全局页面 refresh"
);
check(
  meetingScheduleShell.includes("readCachedMeetingCloudMetadata(startDate, endDate)") &&
    meetingScheduleShell.includes("const includeCloud = opts?.includeCloud !== false") &&
    meetingScheduleShell.includes("const cachedCloud = includeCloud") &&
    meetingScheduleShell.includes("const cloudPromise = includeCloud") &&
    meetingScheduleShell.includes("if (!cloudPromise) {") &&
    meetingScheduleShell.includes('recordMeetingPerformance(\n        localLoadFailed ? "local-refresh-error" : "local-refresh"') &&
    meetingScheduleShell.includes("scheduleMetadataCacheWarmup") &&
    meetingScheduleShell.includes("requestIdleCallback") &&
    meetingScheduleShell.includes(
      'const loadPageAccountSyncModule = () => import("@/lib/pages/accountPageSync")'
    ) &&
    meetingScheduleShell.includes(
      'const loadPageMutationModule = () => import("@/lib/pages/cloudPageMutations")'
    ) &&
    meetingScheduleShell.includes(".then(({ syncCloudPageMetadataDelta }) =>") &&
    meetingScheduleShell.includes("syncCloudPageMetadataDelta()") &&
    !meetingScheduleShell.includes('from "@/lib/pages/accountPageSync"') &&
    !meetingScheduleShell.includes('from "@/lib/pages/cloudPageMutations"') &&
    !meetingScheduleShell.includes("syncCloudPageMetadataDelta({ force: true })") &&
    !meetingScheduleShell.includes("reconcilePageSync") &&
    meetingScheduleShell.includes("loadMeetingCloudMetadata({") &&
    meetingScheduleShell.includes("HOT_CACHE_PREFERENCES_SETTING_KEY") &&
    meetingScheduleShell.includes("parseHotCachePreferences") &&
    meetingScheduleShell.includes("metadataRecentLimitForHotCachePreferences") &&
    meetingScheduleShell.includes("recentLimit: recentMetadataLimit") &&
    meetingScheduleShell.includes("MEETING_INITIAL_CLOUD_RECHECK_DELAY_MS") &&
    meetingScheduleShell.includes("MEETING_INITIAL_CLOUD_RECHECK_IDLE_TIMEOUT_MS") &&
    meetingScheduleShell.includes("const MEETING_INITIAL_CLOUD_RECHECK_DELAY_MS = 120") &&
    meetingScheduleShell.includes("const MEETING_INITIAL_CLOUD_RECHECK_IDLE_TIMEOUT_MS = 900") &&
    meetingScheduleShell.includes("const MEETING_EMPTY_FIRST_PAINT_FALLBACK_DELAY_MS = 120") &&
    meetingScheduleShell.includes("const MEETING_BACKGROUND_FALLBACK_RECHECK_DELAY_MS = 2200") &&
    meetingScheduleShell.includes("const MEETING_BACKGROUND_FALLBACK_IDLE_TIMEOUT_MS = 1800") &&
    meetingScheduleShell.includes("const fallbackRecheckDelayMs =\n      meetingsRef.current.length === 0\n        ? MEETING_EMPTY_FIRST_PAINT_FALLBACK_DELAY_MS\n        : MEETING_BACKGROUND_FALLBACK_RECHECK_DELAY_MS;") &&
    meetingScheduleShell.includes("const fallbackIdleTimeoutMs =\n        meetingsRef.current.length === 0\n          ? MEETING_EMPTY_FIRST_PAINT_FALLBACK_DELAY_MS\n          : MEETING_BACKGROUND_FALLBACK_IDLE_TIMEOUT_MS;") &&
    meetingScheduleShell.includes("void load({\n        includeCloud: false,\n        interruptCloud: false,\n        preserveVisibleMeetings: true,\n        includeUnindexedFallback: false,\n      });") &&
    meetingScheduleShell.includes("cancelFallbackRecheck = scheduleMeetingIdleTask(() => {\n        if (!mountedRef.current) return;\n        void load({\n          includeCloud: false,\n          interruptCloud: false,\n          preserveVisibleMeetings: true,\n          includeUnindexedFallback: true,\n        });\n      }, fallbackIdleTimeoutMs);") &&
    meetingScheduleShell.includes("cancelCloudRecheck = scheduleMeetingIdleTask(() => {\n        void load({\n          includeCloud: true,\n          preserveVisibleMeetings: true,\n          includeUnindexedFallback: false,\n        });\n      }, MEETING_INITIAL_CLOUD_RECHECK_IDLE_TIMEOUT_MS);") &&
    meetingScheduleShell.includes("}, MEETING_INITIAL_CLOUD_RECHECK_DELAY_MS);") &&
    meetingScheduleShell.includes("cancelCloudRecheck?.()") &&
    meetingScheduleShell.indexOf("publishMeetings([], cachedCloud.pages)") <
      meetingScheduleShell.indexOf("getModuleRootId(\"meeting-schedule\")"),
  "MeetingScheduleShell 首屏应先读本地/热缓存会议目录，云端当前窗口 metadata 必须延后到空闲校正；recent metadata 窗口按热缓存偏好有界扩大，全局 metadata 同步只能空闲后台预热；本地刷新也应记录流畅度快照"
);
check(
  meetingHotCacheSnapshot.includes("MEETING_HOT_CACHE_FRESH_MS = 24 * 60 * 60 * 1000") &&
    meetingHotCacheSnapshot.includes("MEETING_HOT_CACHE_STALE_MS = 7 * 24 * 60 * 60 * 1000") &&
    meetingHotCacheSnapshot.includes("stale?: boolean") &&
    meetingHotCacheSnapshot.includes("withMeetingHotCacheSnapshotFreshness") &&
    meetingHotCacheSnapshot.includes("isStaleMeetingHotCacheSnapshot(current)") &&
    meetingHotCacheSnapshot.includes('key === "cached_at" || key === "stale"'),
  "Meeting hot cache 应区分 24h 新鲜窗口和 7 天旧缓存兜底窗口；旧缓存只能作为 /schedule 首屏 metadata 占位，后台必须继续校正"
);
check(
  meetingScheduleShell.includes("staleHotCachePages") &&
    meetingScheduleShell.includes("staleHotCacheCount") &&
    meetingScheduleShell.includes("较早的浏览器热缓存已先显示"),
  "MeetingScheduleShell 使用旧热缓存首屏兜底时必须明确提示后台仍在校正，避免用户把旧会议 metadata 当成最终同步结果"
);
check(
  meetingScheduleShell.includes("MEETING_CLOUD_CACHE_PREFIX") &&
    meetingScheduleShell.includes("writeCachedMeetingCloudMetadata") &&
    meetingScheduleShell.includes("retainedVisiblePages") &&
    meetingScheduleShell.includes(
      "retainVisibleMeetingPagesForBackgroundRefresh"
    ) &&
    meetingScheduleShell.includes("const localPageIds = new Set") &&
    meetingScheduleShell.includes("Meeting schedule local cache load failed"),
  "MeetingScheduleShell 云端会议 metadata 应只把轻量窗口结果作为本机可重建缓存"
);
check(
  meetingScheduleShell.includes("function getMeetingCloudUnavailableMessage") &&
    meetingScheduleShell.includes("页面同步已关闭，本地会议日历继续可用。") &&
    meetingScheduleShell.includes("当前浏览器未登录账号，只显示本机会议日历。") &&
    meetingScheduleShell.includes("云端账号系统未配置，本地会议日历继续可用。") &&
    meetingScheduleShell.includes("账号会话暂时无法确认，本地会议日历继续可用；云端会在后台自动重试。") &&
    meetingScheduleShell.includes("云端会议目录本轮校正失败，本地会议日历继续可用。") &&
    meetingScheduleShell.includes('cloud.status === "unconfirmed"') &&
    meetingScheduleShell.includes("getMeetingCloudUnavailableMessage(cloud.status)") &&
    !meetingScheduleShell.includes("云端会议目录暂未启用或未登录，本地会议日历继续可用。"),
  "MeetingScheduleShell 云端会议目录不可用文案必须区分同步关闭、未登录、账号未配置和临时失败，不能把配置/临时问题说成掉线"
);
check(
  meetingScheduleShell.includes("upsertMeetingInView(finalPage)") &&
    (meetingScheduleShell.includes("persistOptimisticMeetingPage(rootId, finalPage, upsertPages)") ||
      meetingScheduleShell.includes("resolvedRootId,\n            finalPage,\n            upsertPages") ||
      meetingScheduleShell.includes("resolvedRootId,\n              finalPage,\n              upsertPages")) &&
    meetingScheduleShell.includes("observedPageRevisionRef") &&
    meetingScheduleShell.includes(
      "void load({\n          includeCloud: true,\n          preserveVisibleMeetings: true,\n          includeUnindexedFallback: false,\n        });"
    ) &&
    meetingScheduleShell.includes("type MeetingCalendarLoadOptions") &&
    meetingScheduleShell.includes(
      "const interruptCloud = opts?.interruptCloud ?? includeCloud"
    ) &&
    meetingScheduleShell.includes("!interruptCloud && loadRequestRef.current > 0") &&
    meetingScheduleShell.includes("const mountedRef = useRef(false)") &&
    meetingScheduleShell.includes("mountedRef.current = false") &&
    meetingScheduleShell.includes("if (!mountedRef.current) return") &&
    meetingScheduleShell.includes("interruptCloud: false") &&
    meetingScheduleShell.includes("preserveVisibleMeetings: true") &&
    meetingScheduleShell.includes("await load({\n        includeCloud: false,") &&
    meetingScheduleShell.includes("void load({\n        includeCloud: false,") &&
    meetingScheduleShell.includes("MEETING_LOCAL_METADATA_REFRESH_DELAY_MS") &&
    meetingScheduleShell.includes("MEETING_LOCAL_METADATA_FALLBACK_DELAY_MS") &&
    meetingScheduleShell.includes("MEETING_CLOUD_METADATA_RECHECK_DELAY_MS") &&
    meetingScheduleShell.includes("MEETING_FOREGROUND_QUIET_WINDOW_MS = 3200") &&
    meetingScheduleShell.includes("MEETING_FOREGROUND_REFRESH_MAX_DELAY_MS = 3600") &&
    meetingScheduleShell.includes("foregroundQuietUntilRef") &&
    meetingScheduleShell.includes("markMeetingForegroundInteraction();") &&
    meetingScheduleShell.includes("scheduleMeetingForegroundAwareRefresh") &&
    meetingScheduleShell.includes("window.setTimeout(runWhenQuiet, foregroundDelay)") &&
    meetingScheduleShell.includes("return scheduleMeetingForegroundAwareRefresh(() => {") &&
    meetingScheduleShell.includes("cancelLocalReload = scheduleMeetingForegroundAwareRefresh(() => {") &&
    meetingScheduleShell.includes("cancelFallbackReload = scheduleMeetingForegroundAwareRefresh(() => {") &&
    meetingScheduleShell.includes("cancelCloudRecheck = scheduleMeetingForegroundAwareRefresh(() => {") &&
    meetingScheduleShell.includes("let cancelLocalReload: (() => void) | null = null") &&
    meetingScheduleShell.includes("let cancelCloudRecheck: (() => void) | null = null") &&
    meetingScheduleShell.includes("cancelLocalReload?.()") &&
    meetingScheduleShell.includes("cancelFallbackReload?.()") &&
    meetingScheduleShell.includes("return queueMeetingCloudRecords(records)") &&
    meetingScheduleShell.includes("function queueMeetingCloudRecords") &&
    meetingScheduleShell.includes("queueCloudPagePush(record)") &&
    !meetingScheduleShell.includes("const result = await pushCloudPages(records)") &&
    meetingScheduleShell.includes("disabled={intakeLoading || !intakeText.trim()}") &&
    meetingScheduleShell.includes("const MEETING_INTAKE_TIMEOUT_MS = 8000") &&
    meetingScheduleShell.includes("const MEETING_AGENT_QUEUE_TIMEOUT_MS = 12000") &&
    meetingScheduleShell.includes("const controller = new AbortController();") &&
    meetingScheduleShell.includes("signal: controller.signal") &&
    meetingScheduleShell.includes("controller.abort();") &&
    meetingScheduleShell.includes("会议信息读取超时，已先保留会议痕迹。") &&
    meetingScheduleShell.includes("fetchMeetingIntakeWithTimeout(input)") &&
    meetingScheduleShell.includes("fetchMeetingIntakeWithTimeout(inputText)") &&
    meetingScheduleShell.includes("fetchMeetingAgentQueueWithTimeout({") &&
    meetingScheduleShell.includes("getMeetingAgentQueueFailureMessage(error)") &&
    meetingScheduleShell.includes(
      "录制队列接口超时；会议页和日历已保留，可稍后重试接入 runner。"
    ) &&
    meetingScheduleShell.includes("type MeetingImportReceipt") &&
    meetingScheduleShell.includes("const [intakeReceipt, setIntakeReceipt]") &&
    meetingScheduleShell.includes("buildMeetingImportReceipt(") &&
    meetingScheduleShell.includes("function MeetingImportReceiptCard") &&
    meetingScheduleShell.includes('data-testid="meeting-intake-receipt"') &&
    meetingScheduleShell.includes("data-local-calendar-visible={receipt.localCalendarVisible}") &&
    meetingScheduleShell.includes("const pendingDateKey = form.date || toDateKey(new Date());") &&
    meetingScheduleShell.includes("focusCalendarDate(pendingDateKey);") &&
    meetingScheduleShell.includes("const intakePendingDateKey = intakeLoading ? form.date || todayKey : \"\";") &&
    meetingScheduleShell.includes("const isIntakeParsingDate = intakePendingDateKey === key;") &&
    meetingScheduleShell.includes("data-testid={`meeting-intake-calendar-placeholder-${key}`}") &&
    meetingScheduleShell.includes("将写入本地日历") &&
    meetingScheduleShell.includes("这场不是今天，所以今日会议不会增加") &&
    meetingScheduleShell.includes("打开会议页 ↗") &&
    meetingScheduleShell.includes("重新识别完成，但刷新列表失败") &&
    meetingScheduleShell.includes("finally {\n      setRetryLoading(false);\n    }") &&
    !meetingScheduleShell.includes("): Promise<CreateMeetingResult> =>") &&
    meetingScheduleShell.includes("): CreateMeetingResult =>") &&
    meetingScheduleShell.includes("const result = createMeetingPage(form") &&
    meetingScheduleShell.includes("const result = createMeetingPage(draft") &&
    !meetingScheduleShell.includes("disabled={intakeLoading || !rootId || !intakeText.trim()}") &&
    !meetingScheduleShell.includes('rootId ? "导入" : "加载中..."') &&
    !meetingScheduleShell.includes("await load();") &&
    !meetingScheduleShell.includes("void load().catch(() => undefined);") &&
    !meetingScheduleShell.includes("}, [dbReady, load, pageRevision]);"),
  "MeetingScheduleShell 新导入和本地 revision 刷新应保留乐观结果，并只做本地 metadata 刷新；会议保存必须加入统一云端上传队列，前台打开窗口内刷新应后移，不能在后台直接等待云端 push；页面卸载后后台加载不能继续写 UI"
);
check(
  meetingScheduleShell.includes('router.prefetch("/page/zhinote-route-prefetch")') &&
    meetingScheduleShell.includes("@/components/page/LazyPagePeekModal") &&
    meetingScheduleShell.includes("warmPagePeekModal();") &&
    meetingScheduleShell.includes("MEETING_PEEK_EDITOR_WARMUP_DELAY_MS") &&
    meetingScheduleShell.includes("MEETING_PEEK_EDITOR_WARMUP_IDLE_TIMEOUT_MS") &&
    meetingScheduleShell.includes("const peekEditorWarmupTimer = window.setTimeout(() => {") &&
    meetingScheduleShell.includes("cancelPeekEditorWarmup = scheduleMeetingIdleTask(() => {") &&
    meetingScheduleShell.includes("}, MEETING_PEEK_EDITOR_WARMUP_IDLE_TIMEOUT_MS)") &&
    meetingScheduleShell.includes("}, MEETING_PEEK_EDITOR_WARMUP_DELAY_MS)") &&
    meetingScheduleShell.includes("window.clearTimeout(peekEditorWarmupTimer)") &&
    meetingScheduleShell.includes("cancelPeekEditorWarmup?.();") &&
    meetingScheduleShell.includes("const warmMeetingPeekOpen = useCallback") &&
    meetingScheduleShell.includes("warmMeetingPeekOpen();") &&
    meetingScheduleShell.includes("onPointerEnter={warmMeetingPeekOpen}") &&
	    meetingScheduleShell.includes("onPointerDown={warmMeetingPeekOpen}") &&
	    meetingScheduleShell.includes("onFocus={warmMeetingPeekOpen}") &&
	    meetingScheduleShell.includes("const [openingDraft, setOpeningDraft]") &&
	    meetingScheduleShell.includes("const setOpeningDraftAndRef = useCallback") &&
	    meetingScheduleShell.includes("openingDraftRef.current = resolved;") &&
	    meetingScheduleShell.includes("const [openingMeetingId, setOpeningMeetingId]") &&
	    meetingScheduleShell.includes("setOpeningDraftAndRef({") &&
	    meetingScheduleShell.includes("setOpeningMeetingId(optimisticPage.id);") &&
    meetingScheduleShell.includes("const clearFailedLocalMeetingCreate = () =>") &&
    meetingScheduleShell.includes("current.filter((item) => item.id !== optimisticPage.id)") &&
    meetingScheduleShell.includes("新建会议时本地草稿准备失败，会议日历仍保留现有内容。") &&
    meetingScheduleShell.includes("已有会议和本地缓存没有被删除，可以稍后重试。") &&
    meetingScheduleShell.indexOf('rememberPageRouteHandoff(optimisticPage, "meeting-create")') <
      meetingScheduleShell.indexOf("upsertPages([optimisticPage]);") &&
    meetingScheduleShell.indexOf("upsertPages([optimisticPage]);") <
      meetingScheduleShell.indexOf("void seedMeetingPageForImmediateOpen(optimisticPage);") &&
    meetingScheduleShell.indexOf("void seedMeetingPageForImmediateOpen(optimisticPage);") <
      meetingScheduleShell.indexOf("setPeekInitialPage(optimisticPage);") &&
    meetingScheduleShell.includes("void seedMeetingPageForImmediateOpen(optimisticPage);") &&
    meetingScheduleShell.includes("const targetDateKey = form.date || toDateKey(new Date());") &&
    meetingScheduleShell.includes("if (creatingMeetingDateKeyRef.current !== null) return;") &&
    meetingScheduleShell.includes("creatingMeetingDateKeyRef.current = targetDateKey;") &&
    meetingScheduleShell.includes("setCreatingMeetingDateKey(targetDateKey);") &&
    meetingScheduleShell.includes("creatingMeetingDateKeyRef.current === targetDateKey") &&
    meetingScheduleShell.includes("data-testid={`meeting-opening-page-${key}`}") &&
    meetingScheduleShell.includes('data-testid="meeting-opening-draft-banner"') &&
    meetingScheduleShell.includes("openingMeetingId === entry.page.id") &&
    meetingScheduleShell.includes("onReady={handlePeekReady}") &&
    !meetingScheduleShell.includes("readyOnLocalShell={false}") &&
    !meetingScheduleShell.includes("const warmMeetingPageRoute = useCallback(() => {\n    warmPagePeekModal();") &&
    !meetingScheduleShell.includes("@/components/page/PagePeekModal") &&
    meetingScheduleShell.includes("creatingMeetingDateKey") &&
    meetingScheduleShell.includes('importSource: "手动创建"') &&
    meetingScheduleOpensCreatedPageRoute &&
    meetingScheduleShell.includes("router.prefetch(pageRoute)") &&
    meetingScheduleShell.includes("useLocalFirstPageNavigation") &&
    meetingScheduleShell.includes("prepareMeetingPageOpen") &&
    meetingScheduleShell.includes("const seededPage = getMeetingPagePrimeSeed(page)") &&
    meetingScheduleShell.includes('rememberPageRouteHandoff(seededPage, "meeting-open")') &&
    meetingScheduleShell.includes("function getMeetingPagePrimeSeed(page: Page)") &&
    meetingScheduleShell.includes('if (seededPage.content_text === "") return seededPage;') &&
    meetingScheduleShell.includes('const seededPage = prepareMeetingPageOpen(page, "meeting-create");') &&
    meetingScheduleShell.includes("setPeekInitialPage(seededPage)") &&
    meetingScheduleShell.includes("setPeekPageId(seededPage.id)") &&
    meetingScheduleShell.includes('status: "meeting-create-local-shell-requested"') &&
    meetingScheduleShell.includes("local_handoff_seeded: 1") &&
    meetingScheduleShell.includes("<PagePeekModal") &&
    meetingScheduleShell.includes("initialPage={peekInitialPage}") &&
    !meetingScheduleShell.includes('openPage(page, { source: "meeting-create" })') &&
    meetingScheduleShell.includes('prepareMeetingPageOpen(page, "meeting-create")') &&
    meetingScheduleShell.includes("prepareMeetingPageOpen(page, source)") &&
    meetingScheduleShell.includes("let seededPage = page") &&
    meetingScheduleShell.includes("seededPage = getMeetingPageOpenSeed(page)") &&
    meetingScheduleShell.includes("Meeting page local prepare failed") &&
    meetingScheduleShell.includes("打开会议页时本地预热失败，已继续打开页面；会议数据没有被删除。") &&
    meetingScheduleShell.includes("Meeting page local prime failed") &&
    meetingScheduleShell.includes("会议详情本地预热失败，已保留当前日历内容；仍可继续打开会议页。") &&
    meetingScheduleShell.includes("rememberPendingPageDraft(seededPage)") &&
    meetingScheduleShell.includes("rememberPageRouteHandoff(seededPage, source)") &&
    !meetingScheduleShell.includes("const warmMeetingPageContent = useCallback") &&
    !meetingScheduleShell.includes("onMouseEnter={() => warmMeetingPageContent(entry.page)}") &&
    !meetingScheduleShell.includes("warmMeetingPageContent(") &&
    meetingScheduleShell.includes("const openMeetingDetail = useCallback") &&
    meetingScheduleShell.indexOf('prepareMeetingPageOpen(page, "meeting-create")') <
      meetingScheduleShell.indexOf("setPeekPageId(seededPage.id)") &&
    meetingScheduleShell.includes("后台会继续保存到账号云端"),
  "MeetingScheduleShell 手动创建会议应有即时创建状态，成功后同步准备本地 seed 并先弹出同页会议页面，再后台同步；完整页入口仍走本地优先，正文必须等 peek/full page 打开后按需补齐"
);
check(
    meetingScheduleShell.includes("MEETING_CALENDAR_VISIBLE_LIMIT") &&
    meetingScheduleShell.includes("MEETING_CALENDAR_EXPAND_BATCH") &&
    meetingScheduleShell.includes("MEETING_CALENDAR_RENDER_DAY_LIMIT") &&
    meetingScheduleShell.includes("MEETING_RENDER_UPCOMING_BUFFER_LIMIT") &&
    meetingScheduleShell.includes("MEETING_RENDER_COMPLETED_BUFFER_LIMIT") &&
    meetingScheduleShell.includes("MEETING_RENDER_UNDATED_REVIEW_LIMIT") &&
    meetingScheduleShell.includes("MEETING_CALENDAR_MANUAL_DAY_LOAD_LIMIT") &&
    meetingScheduleShell.includes("MEETING_CALENDAR_HYDRATION_BATCH") &&
    meetingScheduleShell.includes("hydratedMeetingDateKeys") &&
    meetingScheduleShell.includes("buildInitialMeetingCalendarHydrationKeys") &&
    meetingScheduleShell.includes("buildOccupiedMeetingCalendarHydrationKeys") &&
    meetingScheduleShell.includes("const occupiedDateKeys = buildOccupiedMeetingCalendarHydrationKeys") &&
    meetingScheduleShell.includes("for (const dateKey of occupiedDateKeys)") &&
    meetingScheduleShell.includes("return changed ? next : current;") &&
    !meetingScheduleShell.includes("const revealNextOccupiedBatch = () =>") &&
    !meetingScheduleShell.includes("MEETING_CALENDAR_OCCUPIED_HYDRATION_BATCH") &&
    meetingScheduleShell.includes("const [meetingCountByDate, setMeetingCountByDate]") &&
    meetingScheduleShell.includes("const meetingCalendarRenderFingerprintRef = useRef(\"\")") &&
    meetingScheduleShell.includes("publishMeetingCalendarRenderSelection(") &&
    meetingScheduleShell.includes("function publishMeetingCalendarRenderSelection(") &&
    meetingScheduleShell.includes("meetingPagesRenderFingerprint(pages)") &&
    meetingScheduleShell.includes("meetingDateCountsFingerprint(countsByDate)") &&
    meetingScheduleShell.includes("fingerprintRef.current === nextFingerprint") &&
    meetingScheduleShell.includes("setMeetingCountByDate(countsByDate)") &&
    meetingScheduleShell.includes("upsertMeetingPageInList(") &&
    meetingScheduleShell.includes("mergeMeetingDateCountsForLocalUpsert(") &&
    meetingScheduleShell.includes("setMeetingCountByDate((current) =>") &&
    meetingScheduleShell.includes("meetingsRef.current = nextMeetings;") &&
    meetingScheduleShell.includes("const [loadingMoreMeetingDateKey, setLoadingMoreMeetingDateKey]") &&
    meetingScheduleShell.includes("function selectMeetingPagesForCalendarRender(") &&
    meetingScheduleShell.includes("addUpcomingMeetingEntryCandidate(") &&
    meetingScheduleShell.includes("addRecentMeetingEntryCandidate(") &&
    meetingScheduleShell.includes("if (dateKey < startDate || dateKey > endDate)") &&
    meetingScheduleShell.includes("expandedMeetingDateKeys") &&
    meetingScheduleShell.includes("visibleMeetingLimitByDate") &&
    meetingScheduleShell.includes("toggleMeetingDateExpansion") &&
    meetingScheduleShell.includes("showMoreMeetingsForDate") &&
    meetingScheduleShell.includes("loadMoreMeetingsForDate") &&
    meetingScheduleShell.includes("rangeLimit: targetRangeLimit") &&
    meetingScheduleShell.includes("revealMeetingOnCalendar") &&
    meetingScheduleShell.includes("pendingCalendarFocusDateKeyRef") &&
    meetingScheduleShell.includes("requestAnimationFrame") &&
    meetingScheduleShell.includes("MEETING_CALENDAR_REVEAL_BUFFER") &&
    meetingScheduleShell.includes("revealMeetingOnCalendar(optimisticPage)") &&
    meetingScheduleShell.includes("revealMeetingOnCalendar(finalPage)") &&
    meetingScheduleShell.includes("const visibleLimit = isExpanded") &&
    meetingScheduleShell.includes("const visibleMeetings = dayMeetings.slice(0, visibleLimit)") &&
    meetingScheduleShell.includes("const dayTotalCount = Math.max(") &&
    meetingScheduleShell.includes("const loadedHiddenCount = Math.max(") &&
    meetingScheduleShell.includes("const isRenderCapped =") &&
    meetingScheduleShell.includes("Math.min(totalCount, currentLimit + MEETING_CALENDAR_EXPAND_BATCH)") &&
    meetingScheduleShell.includes("再显示 ${nextBatchCount} 场") &&
    meetingScheduleShell.includes("dayTotalCount > MEETING_CALENDAR_VISIBLE_LIMIT") &&
    meetingScheduleShell.includes("点击补齐 ${visibleMeetings.length}/${dayTotalCount} 场") &&
    meetingScheduleShell.includes("正在补齐…") &&
    meetingScheduleShell.includes("场会议，点开查看") &&
    meetingScheduleShell.includes("data-testid={`meeting-calendar-day-${key}`}") &&
    meetingScheduleShell.includes("isMeetingDateHydrated && visibleMeetings.map") &&
    meetingScheduleShell.includes("cancelScheduledBatch = scheduleMeetingIdleTask(") &&
    !meetingScheduleShell.includes("MEETING_VISIBLE_CONTENT_WARMUP") &&
    !meetingScheduleShell.includes("collectVisibleMeetingContentWarmupCandidates") &&
    !meetingScheduleShell.includes("warmMeetingPageContent") &&
    !meetingScheduleShell.includes("onMouseEnter={() => warmMeetingPageContent(entry.page)}") &&
    meetingScheduleShell.includes("为保持日历流畅") &&
    !meetingScheduleShell.includes("{dayMeetings.map"),
  "MeetingScheduleShell 月历单元格应立即显示有会议日期的轻量 metadata，只渲染可见会议，更多会议必须点击后分批展开；正文必须在 peek/full page 打开后按需补齐，不能 hover 或首屏批量预热正文；单日高 volume 会议应限量渲染并可按天补齐"
);

const usePageHook = read("src/hooks/usePage.ts");
const pendingPageDrafts = read("src/lib/pages/pendingPageDrafts.ts");
const pageBodyHydrationStatus = read(
  "src/lib/pages/pageBodyHydrationStatus.ts"
);
check(
  usePageHook.includes(
    "const cloud = await fetchCloudPageByIdWithAccountSync(pageId)"
  ) &&
    usePageHook.includes(
      "const { fetchCloudPageById } = await loadPageAccountSyncModule();"
    ) &&
    usePageHook.includes("return fetchCloudPageById(pageId);") &&
    usePageHook.includes("remoteIsAtLeastAsFresh(remoteRecord, localPage)") &&
    usePageHook.includes("hydrateRemotePageIntoLocalCache(remoteRecord)"),
  "usePage 打开页面时应拉取云端正文快照，并在云端不旧于本地时回填本地缓存"
);
check(
  usePageHook.includes("publishPageBodyHydrationStatus") &&
    usePageHook.includes('phase: "local-body-requested"') &&
    usePageHook.includes('phase: "cloud-body-requested"') &&
    usePageHook.includes('"cloud-body-ready"') &&
    pageBodyHydrationStatus.includes("local_browser_memory_only: true") &&
    pageBodyHydrationStatus.includes("stores_page_body_text: false") &&
    pageBodyHydrationStatus.includes("uploads_workspace_data: false") &&
    pageBodyHydrationStatus.includes("subscribePageBodyHydrationStatus") &&
    pageBodyHydrationStatus.includes("describePageBodyHydrationStatus"),
  "页面正文补齐状态必须只作为本地浏览器反馈存在，不能存正文、不能上传数据，并且 usePage 应发布本地/云端补齐进度"
);
check(
  usePageHook.includes("setPageForCurrentLoad(localPage)") &&
    usePageHook.includes("const [initialLocalFirstPageSeed] = useState<Page | null>(() => {") &&
    usePageHook.includes("const [page, setPage] = useState<Page | null>(() => {") &&
    usePageHook.includes("const [loading, setLoading] = useState(() => {") &&
    usePageHook.includes("const loadRequestRef = useRef(0);") &&
    usePageHook.includes("const visiblePageRef = useRef<Page | null>(initialLocalFirstPageSeed)") &&
    usePageHook.includes("const foregroundPageIdRef = useRef<string | null>(pageId);") &&
    usePageHook.includes("const foregroundQuietUntilRef = useRef(0);") &&
    usePageHook.includes("PAGE_FOREGROUND_QUIET_WINDOW_MS = 3200") &&
    usePageHook.includes("PAGE_FOREGROUND_REFRESH_MAX_DELAY_MS = 3600") &&
    usePageHook.includes("PAGE_REVISION_REFRESH_DELAY_MS = 120") &&
    usePageHook.includes("PAGE_REVISION_FALLBACK_REFRESH_DELAY_MS = 900") &&
    usePageHook.includes("foregroundPageIdRef.current = pageId") &&
    usePageHook.includes("if (foregroundPageIdRef.current !== pageId) return 0;") &&
    usePageHook.includes("getPageForegroundRefreshDelay") &&
    usePageHook.includes("schedulePageForegroundAwareRefresh") &&
    usePageHook.includes("window.setTimeout(runWhenQuiet, foregroundDelay)") &&
    usePageHook.includes("cancelRefresh = schedulePageForegroundAwareRefresh(") &&
    usePageHook.includes("cancelLocalReload = schedulePageForegroundAwareRefresh(() => {") &&
    usePageHook.includes("cancelFallbackReload = schedulePageForegroundAwareRefresh(() => {") &&
    usePageHook.includes("let cancelLocalReload: (() => void) | null = null") &&
    usePageHook.includes("let cancelFallbackReload: (() => void) | null = null") &&
    usePageHook.includes("cancelLocalReload?.()") &&
    usePageHook.includes("cancelFallbackReload?.()") &&
    usePageHook.includes("visiblePageRef.current?.id === pageId") &&
    usePageHook.includes("const requestId = ++loadRequestRef.current;") &&
    usePageHook.includes("if (!isCurrentLoad()) return;") &&
    usePageHook.includes("loadRequestRef.current += 1;") &&
    usePageHook.indexOf("return readLocalFirstPageSeed(pageId);") <
      usePageHook.indexOf("const load = useCallback(async () => {") &&
    usePageHook.includes("} else {\n      setPageForCurrentLoad(null);\n      setLoadingForCurrentLoad(true);\n    }") &&
    usePageHook.includes("readLocalFirstPageSeed") &&
    usePageHook.includes("if (!dbReady)") &&
    usePageHook.includes("setLoadingForCurrentLoad(!localPage)") &&
    usePageHook.includes("setLoadingForCurrentLoad(false)") &&
    usePageHook.includes("schedulePageCloudHydration(\n        pageId,\n        () =>") &&
    usePageHook.includes("visiblePageRef.current?.id === pageId") &&
    usePageHook.includes("readPageRouteHandoffSource(pageId)") &&
    usePageHook.includes("getPageLocalBodyHydrationPriority") &&
    usePageHook.includes("localBodyHydrationPriority") &&
    usePageHook.includes("PAGE_INTERACTIVE_LOCAL_BODY_HYDRATION_DELAY_MS = 24") &&
    usePageHook.includes("PAGE_INTERACTIVE_LOCAL_BODY_HYDRATION_IDLE_MS = 80") &&
    usePageHook.includes('priority === "interactive"') &&
    usePageHook.includes("getPageForContentHydration") &&
    usePageHook.includes("const latestLocalPage = getLocalPage();") &&
    usePageHook.includes("applyCloudPageLookup(cloud, latestLocalPage, setPage, upsertPages)") &&
    usePageHook.includes("requestIdleCallback(run") &&
    usePageHook.includes("PAGE_CLOUD_HYDRATION_IDLE_MS") &&
    usePageHook.includes("PAGE_CLOUD_BODY_STATUS_FALLBACK_MS = 3200") &&
    usePageHook.includes("scheduleCloudBodyFallbackStatus({") &&
    usePageHook.includes("cancelFallbackStatus();") &&
    usePageHook.includes("const pageCloudHydrationQueue = new Map<string, PageCloudHydrationState>()") &&
    usePageHook.includes("queuePageCloudHydration({") &&
    usePageHook.includes("const existing = pageCloudHydrationQueue.get(key);") &&
    usePageHook.includes("existing.rerun = true;") &&
    usePageHook.includes("void drainPageCloudHydrationQueue(key, state);") &&
    usePageHook.includes("while (pageCloudHydrationQueue.get(key) === state)") &&
    usePageHook.includes("if (!state.rerun) break;") &&
    usePageHook.includes("pageCloudHydrationQueue.delete(key);") &&
    usePageHook.includes("function pageCloudHydrationQueueKey(") &&
    !usePageHook.includes("cloudPagePromise") &&
    usePageHook.includes("void queueCloudPagePushWithAccountSync(localPage)") &&
    usePageHook.includes(
      'const loadPageAccountSyncModule = () => import("@/lib/pages/accountPageSync")'
    ) &&
    !usePageHook.includes("import {\n  fetchCloudPageById") &&
    !usePageHook.includes("import {\n  pageToRemoteRecord"),
  "usePage 应先显示当前页本地缓存；云端正文只做 idle 后台回填，回填前必须用当前可见页面快照比较，避免覆盖刚输入的本地内容"
);
const usePageLocalBodyHydrationBody = usePageHook.slice(
  usePageHook.indexOf("async function refreshPageBodyFromLocalCache"),
  usePageHook.indexOf("function schedulePageCloudHydration")
);
check(
  !usePageLocalBodyHydrationBody.includes("getPage(pageId)"),
  "usePage 当前页本地正文补齐应使用 content_text 投影查询，不能通过 getPage(pageId) 读取 content_yjs"
);
check(
    usePageHook.includes("pageToRemoteRecord(optimistic)") &&
    usePageHook.includes("MAX_REMOTE_COVER_CHARS = 300 * 1024") &&
    usePageHook.includes("page.cover_url.length > MAX_REMOTE_COVER_CHARS") &&
    usePageHook.includes("markPageForegroundInteraction();") &&
    usePageHook.includes("setPage(optimistic)") &&
    usePageHook.includes("upsertPages([optimistic])") &&
    usePageHook.includes('emitPageSnapshotsUpdated("cloud-push", [optimistic])') &&
    usePageHook.includes("rememberPendingPageDraft(optimistic)") &&
    usePageHook.includes("void queueCloudPagePushWithAccountSync(record)") &&
    usePageHook.includes(
      "const { queueCloudPagePush } = await loadPageAccountSyncModule();"
    ) &&
    usePageHook.includes("queueOptimisticPageLocalCachePersist(record, upsertPages)") &&
    usePageHook.includes("optimisticPageLocalCachePersistQueue") &&
    usePageHook.includes("drainOptimisticPageLocalCachePersistQueue") &&
    usePageHook.includes("if (queued.latest !== record) continue;") &&
    usePageHook.includes("clearPendingPageDraft(record.id)") &&
    usePageHook.includes("hydrateRemotePageIntoLocalCache(record)") &&
    !usePageHook.includes("await pushCloudPages([record])"),
  "usePage 编辑保存应先更新本机热缓存和临时草稿并登记 pending 队列；云端上传和本地 SQLite 回填都不能阻塞输入，且连续输入时本地缓存只落最新正文"
);
check(
  pendingPageDrafts.includes("window.sessionStorage.setItem") &&
    pendingPageDrafts.includes("window.sessionStorage.removeItem") &&
    pendingPageDrafts.includes("session_storage_only: true") &&
    pendingPageDrafts.includes("stores_page_body_html: true") &&
    pendingPageDrafts.includes("stores_page_yjs: false") &&
    pendingPageDrafts.includes("uploads_workspace_data: false") &&
    pendingPageDrafts.includes("writes_server_data: false") &&
    pendingPageDrafts.includes("enters_sync_log: false") &&
    pendingPageDrafts.includes("stores_source_of_truth: false") &&
    pendingPageDrafts.includes("PENDING_PAGE_DRAFT_MAX_CHARS") &&
    pendingPageDrafts.includes("PENDING_PAGE_DRAFT_DEBOUNCE_CHARS") &&
    pendingPageDrafts.includes("PENDING_PAGE_DRAFT_STORAGE_WRITE_DELAY_MS") &&
    pendingPageDrafts.includes("pendingPageDraftSessionWrites") &&
    pendingPageDrafts.includes("rememberPendingPageDraftInSessionStorageSoon") &&
    pendingPageDrafts.includes("shouldDebouncePendingPageDraftStorageWrite") &&
    pendingPageDrafts.includes("flushPendingPageDraftSessionStorageWrites") &&
    pendingPageDrafts.includes('window.addEventListener("pagehide"') &&
    pendingPageDrafts.includes('document.addEventListener("visibilitychange"') &&
    !pendingPageDrafts.includes("window.localStorage") &&
    !pendingPageDrafts.includes("recordSyncChange") &&
    !pendingPageDrafts.includes("queueCloudPagePush") &&
    !pendingPageDrafts.includes("pushCloudPages"),
  "pending page draft 必须只是同标签页短时恢复层：可存正文 HTML，但大正文写入 sessionStorage 必须防抖合并，不能存 Yjs、不能写云端/同步日志/localStorage"
);
check(
  !usePageHook.includes("updatePage(pageId, updates)") &&
    !usePageHook.includes("Parameters<typeof updatePage>"),
  "usePage 编辑保存不能回退到本地数据库优先"
);
check(
  usePageHook.includes("subscribePagesUpdated") &&
    usePageHook.includes("applyCrossTabPageMetadata") &&
    usePageHook.includes("pageUpdatePayloadToPage") &&
    usePageHook.includes("content_text: current?.content_text ?? null") &&
    usePageHook.includes("content_yjs: current?.content_yjs ?? null") &&
    usePageHook.includes("cancelLocalReload = schedulePageForegroundAwareRefresh(() => {") &&
    usePageHook.includes("cancelFallbackReload = schedulePageForegroundAwareRefresh(() => {") &&
    usePageHook.includes("void load();") &&
    usePageHook.includes("matchedPayload = message.pages?.find") &&
    usePageHook.includes("!message.pages || message.pages.length === 0"),
  "usePage 应监听跨标签页轻量页面更新，先刷新 metadata，再从本地热缓存重读正文；广播 payload 不能携带正文/Yjs"
);

const pageCloudSyncHook = read("src/hooks/usePageCloudSync.ts");
const databaseCloudSyncHook = read("src/hooks/useDatabaseCloudSync.ts");
check(
  pageCloudSyncHook.includes("checkAccountCloudSyncGate") &&
    pageCloudSyncHook.includes("gateAccountSync") &&
    pageCloudSyncHook.includes("forceAccountGate?: boolean") &&
    pageCloudSyncHook.includes("const accountReady = await gateAccountSync(Boolean(options.forceAccountGate))") &&
    databaseCloudSyncHook.includes("checkAccountCloudSyncGate") &&
    databaseCloudSyncHook.includes("gateAccountSync") &&
    databaseCloudSyncHook.includes("forceAccountGate?: boolean") &&
    databaseCloudSyncHook.includes("Boolean(options.forceAccountGate)"),
  "页面/数据库后台云同步应先共享账号 gate，再访问具体 account-sync 接口；租约接管和账号强制检查必须分开，避免前台切换时重复空转"
);
check(
  (pageCloudSyncHook.match(/quick: true/g) ?? []).length >= 8 &&
    pageCloudSyncHook.includes("const initialSyncTimer") &&
    pageCloudSyncHook.includes("window.setInterval") &&
    pageCloudSyncHook.includes("const handleForeground = () =>") &&
    pageCloudSyncHook.includes("EDIT_DEBOUNCE_MS"),
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
    pageCloudSyncHook.includes("window.addEventListener(\"online\", handleOnline)"),
  "页面云同步 hook 的聚焦和联网恢复应使用增量同步，但联网恢复应走独立 handler 以便显式确认账号"
);
check(
  pageCloudSyncHook.includes("handleConfig = () =>") &&
    pageCloudSyncHook.includes(
      "void runSync({ quick: true, forceLease: true, forceAccountGate: true });"
    ),
  "页面同步配置变化也应走 quick 增量；完整校验应只保留给账户页手动同步"
);
check(
  pageCloudSyncHook.includes("!options.forceAccountGate && Date.now() < authRetryAfterRef.current") &&
    pageCloudSyncHook.includes("window.addEventListener(\"online\", handleOnline)") &&
    pageCloudSyncHook.includes("window.addEventListener(\"focus\", handleForeground)") &&
    pageCloudSyncHook.includes("window.removeEventListener(\"online\", handleOnline)") &&
    pageCloudSyncHook.includes("void runSync({ quick: true, forceLease: true });"),
  "页面同步前台切换只能接管租约，不能绕过账号重试冷却；只有联网恢复/配置变化/pending 队列在 auth retry 中时才强制重新确认账号"
);
check(
  pageCloudSyncHook.includes("ACCOUNT_SESSION_LAST_AUTHENTICATED_STORAGE_KEY") &&
    pageCloudSyncHook.includes("ACCOUNT_SESSION_EXPLICIT_LOGOUT_STORAGE_KEY") &&
    pageCloudSyncHook.includes("ACCOUNT_PROFILE_UPDATED_EVENT") &&
    pageCloudSyncHook.includes(
      "event.key === ACCOUNT_SESSION_LAST_AUTHENTICATED_STORAGE_KEY ||\n        event.key === ACCOUNT_SESSION_EXPLICIT_LOGOUT_STORAGE_KEY"
    ) &&
    !pageCloudSyncHook.includes(
      "event.key === ACCOUNT_SESSION_LAST_AUTHENTICATED_STORAGE_KEY &&\n        event.newValue"
    ) &&
    pageCloudSyncHook.includes(
      'window.addEventListener(\n      ACCOUNT_PROFILE_UPDATED_EVENT,\n      handleAccountProfileUpdated\n    )'
    ) &&
    pageCloudSyncHook.includes(
      'window.removeEventListener(\n        ACCOUNT_PROFILE_UPDATED_EVENT,\n        handleAccountProfileUpdated\n      )'
    ) &&
    pageCloudSyncHook.includes(
      "const handleAccountProfileUpdated = () => {\n      void runSync({ quick: true, forceLease: true, forceAccountGate: true });\n    };"
    ) &&
    pageCloudSyncHook.includes(
      "forceAccountGate: true,\n        });\n        return;"
    ),
  "页面同步应监听跨标签账号登录/退出缓存变化和当前标签账号资料事件，并立即强制重新确认账号和接管同步租约，避免登录后仍等 auth retry 冷却"
);
check(
  pageCloudSyncHook.includes("localStorage is only a cross-tab coordination cache") &&
    pageCloudSyncHook.includes("return true;"),
  "页面同步短轮询 lease 失败时不能阻止当前 tab 云端同步"
);
check(
  pageCloudSyncHook.includes("AUTH_RETRY_BACKOFF_MS") &&
    pageCloudSyncHook.includes("authRetryAfterRef") &&
    pageCloudSyncHook.includes("authRetryStateRef") &&
    pageCloudSyncHook.includes("function getRetryStateFromAccountGate(") &&
    pageCloudSyncHook.includes("function getAuthRetryStatusFromAccountGate(") &&
    pageCloudSyncHook.includes("recordPageSyncAuthRetryStatus(") &&
    pageCloudSyncHook.includes(
      "getAuthRetryStatusFromAccountGate(accountGate.status)"
    ) &&
    pageCloudSyncHook.includes("forceAccountGate: options.forceAccountGate") &&
    pageCloudSyncHook.includes('if (status === "unconfirmed") return "unconfirmed";') &&
    pageSyncClient.includes("export function recordPageSyncAuthRetryStatus") &&
    pageSyncClient.includes('status === "error"') &&
    pageSyncClient.includes('status === "unconfirmed"') &&
    pageSyncClient.includes('rememberAuthRetryStatus("error")') &&
    pageSyncClient.includes('rememberAuthRetryStatus("unconfirmed")') &&
    pageCloudSyncHook.includes(
      'return status === "signed-out" ? "signed-out" : "error";'
    ) &&
    pageCloudSyncHook.includes(
      "authRetryStateRef.current = getRetryStateFromAccountGate("
    ) &&
    pageCloudSyncHook.includes("setState(authRetryStateRef.current)") &&
    pageCloudSyncHook.includes('result.status === "unauthenticated"') &&
    pageCloudSyncHook.includes(
      'result.status === "unauthenticated") {\n        authRetryAfterRef.current = Date.now() + AUTH_RETRY_BACKOFF_MS;\n        authRetryStateRef.current = "error";'
    ) &&
    pageCloudSyncHook.includes('result.status === "unconfigured"') &&
    pageCloudSyncHook.includes(
      'result.status === "unconfigured") {\n        authRetryAfterRef.current = Date.now() + AUTH_RETRY_BACKOFF_MS;\n        authRetryStateRef.current = "error";'
    ) &&
    pageCloudSyncHook.includes('result.status === "unconfirmed"') &&
    pageCloudSyncHook.includes(
      'result.status === "unconfirmed") {\n        authRetryAfterRef.current = Date.now() + AUTH_RETRY_BACKOFF_MS;\n        authRetryStateRef.current = "error";'
    ),
  "页面同步应短期退避；只有共享账号 gate 明确 signed-out 才能显示未登录，具体同步接口认证失败必须显示成云端暂不可确认，避免误导用户以为账号掉线"
);
check(
  pageCloudSyncHook.includes("getPendingCloudPageSyncStatus") &&
    pageCloudSyncHook.includes("getPendingCloudPageSyncStatusWithSyncLog") &&
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
    pageCloudSyncHook.includes("CustomEvent<PendingCloudPageSyncStatus>") &&
    pageCloudSyncHook.includes("PENDING_STATUS_SYNC_DELAY_MS") &&
    pageCloudSyncHook.includes("schedulePendingStatusSync") &&
    pageCloudSyncHook.includes("function shouldForceAccountGateForPendingStatus") &&
    pageCloudSyncHook.includes(
      "status.pending + status.queued + (status.syncLogPending ?? 0) <= 0"
    ) &&
    pageCloudSyncHook.includes("return Boolean(status.authRetryStatus)") &&
    pageCloudSyncHook.includes("forceLease: Boolean(options.forceAccountGate)") &&
    pageCloudSyncHook.includes("forceAccountGate: Boolean(options.forceAccountGate)") &&
    pageCloudSyncHook.includes("shouldForceAccountGateForPendingStatus(detail)") &&
    pageCloudSyncHook.includes("shouldForceAccountGateForPendingStatus(nextStatus)") &&
    pageCloudSyncHook.includes(
      "detail.pending + detail.queued + (detail.syncLogPending ?? 0)"
    ) &&
    pageCloudSyncHook.includes("PAGE_PENDING_STORAGE_KEYS") &&
    pageCloudSyncHook.includes('PAGE_PENDING_STORAGE_KEYS.has(event.key ?? "")'),
  "页面云同步 hook 应监听 pending/status 事件和跨 tab storage 变化，并在队列有待上传内容时低延迟触发 quick sync；若 pending 队列正处于账号重试状态，应有边界地重新确认账号，避免可登录状态下等完整个退避窗口"
);
check(
  pageCloudSyncHook.includes("rerunAfterCurrentSyncRef") &&
    pageCloudSyncHook.includes("if (runningRef.current)") &&
    pageCloudSyncHook.includes("rerunAfterCurrentSyncRef.current = {") &&
    pageCloudSyncHook.includes("const pendingRerun = rerunAfterCurrentSyncRef.current") &&
    pageCloudSyncHook.includes("window.setTimeout(() => {\n          void runSync({"),
  "页面云同步运行中收到新触发时应记录补跑，当前同步结束后立刻再跑，避免待上传内容等下一次心跳"
);
check(
  pageCloudSyncHook.includes("PAGE_LOCAL_UPDATE_EVENT") &&
    pageCloudSyncHook.includes("type PageUpdateMessage") &&
    pageCloudSyncHook.includes("EDIT_DEBOUNCE_MS") &&
    pageCloudSyncHook.includes("handleLocalPageUpdate") &&
    pageCloudSyncHook.includes('message?.reason !== "local-refresh"') &&
    pageCloudSyncHook.includes('message?.reason !== "cloud-push"') &&
    pageCloudSyncHook.includes("window.setTimeout(() => {\n        void runSync({ quick: true });") &&
    pageCloudSyncHook.includes("window.addEventListener(PAGE_LOCAL_UPDATE_EVENT, handleLocalPageUpdate)") &&
    pageCloudSyncHook.includes("window.removeEventListener(PAGE_LOCAL_UPDATE_EVENT, handleLocalPageUpdate)") &&
    pageCloudSyncHook.includes("window.clearTimeout(editSyncTimer)"),
  "页面本地编辑/新建应通知当前标签页后台同步，并用 4 秒防抖 quick sync 补传云端，避免等下一轮轮询"
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
  databaseCloudSyncHook.includes("pendingStatusRefreshGenerationRef") &&
    databaseCloudSyncHook.includes(
      "const generation = pendingStatusRefreshGenerationRef.current + 1"
    ) &&
    databaseCloudSyncHook.includes(
      "pendingStatusRefreshGenerationRef.current !== generation"
    ),
  "数据库云同步 pending 状态刷新应带 generation guard，避免较慢的旧查询覆盖新的队列状态"
);
check(
  databaseCloudSyncHook.includes("AUTH_RETRY_BACKOFF_MS") &&
    databaseCloudSyncHook.includes("authRetryAfterRef") &&
    databaseCloudSyncHook.includes("authRetryStateRef") &&
    databaseCloudSyncHook.includes("function getRetryStateFromAccountGate(") &&
    databaseCloudSyncHook.includes("function getAuthRetryStatusFromAccountGate(") &&
    databaseCloudSyncHook.includes("recordDatabaseSyncAuthRetryStatus(") &&
    databaseCloudSyncHook.includes(
      "getAuthRetryStatusFromAccountGate(accountGate.status)"
    ) &&
    databaseCloudSyncHook.includes("forceAccountGate: options.forceAccountGate") &&
    databaseCloudSyncHook.includes('if (status === "unconfirmed") return "unconfirmed";') &&
    databaseSyncClient.includes("export function recordDatabaseSyncAuthRetryStatus") &&
    databaseSyncClient.includes('status === "error"') &&
    databaseSyncClient.includes('status === "unconfirmed"') &&
    databaseSyncClient.includes('rememberAuthRetryStatus("error")') &&
    databaseSyncClient.includes('rememberAuthRetryStatus("unconfirmed")') &&
    databaseCloudSyncHook.includes(
      'return status === "signed-out" ? "signed-out" : "error";'
    ) &&
    databaseCloudSyncHook.includes(
      "authRetryStateRef.current = getRetryStateFromAccountGate("
    ) &&
    databaseCloudSyncHook.includes("setState(authRetryStateRef.current)") &&
    databaseCloudSyncHook.includes('result.status === "unauthenticated"') &&
    databaseCloudSyncHook.includes(
      'result.status === "unauthenticated") {\n          authRetryAfterRef.current = Date.now() + AUTH_RETRY_BACKOFF_MS;\n          authRetryStateRef.current = "error";'
    ) &&
    databaseCloudSyncHook.includes('result.status === "unconfigured"') &&
    databaseCloudSyncHook.includes(
      'result.status === "unconfigured") {\n          authRetryAfterRef.current = Date.now() + AUTH_RETRY_BACKOFF_MS;\n          authRetryStateRef.current = "error";'
    ) &&
    databaseCloudSyncHook.includes('result.status === "unconfirmed"') &&
    databaseCloudSyncHook.includes(
      'result.status === "unconfirmed") {\n          authRetryAfterRef.current = Date.now() + AUTH_RETRY_BACKOFF_MS;\n          authRetryStateRef.current = "error";'
    ),
  "数据库同步应短期退避；只有共享账号 gate 明确 signed-out 才能显示未登录，具体同步接口认证失败必须显示成云端暂不可确认，避免误导用户以为账号掉线"
);
check(
  databaseCloudSyncHook.includes("!options.forceAccountGate && Date.now() < authRetryAfterRef.current") &&
    databaseCloudSyncHook.includes("window.addEventListener(\"online\", handleOnline)") &&
    databaseCloudSyncHook.includes("window.addEventListener(\"focus\", handleForeground)") &&
    databaseCloudSyncHook.includes("window.removeEventListener(\"online\", handleOnline)") &&
    databaseCloudSyncHook.includes("void runSync({ forceLease: true, quick: true });") &&
    databaseCloudSyncHook.includes(
      "void runSync({ forceLease: true, forceAccountGate: true, quick: true });"
    ),
  "数据库同步前台切换只能接管租约，不能绕过账号重试冷却；只有联网恢复/配置变化/pending 队列在 auth retry 中时才强制重新确认账号"
);
check(
  databaseCloudSyncHook.includes("ACCOUNT_SESSION_LAST_AUTHENTICATED_STORAGE_KEY") &&
    databaseCloudSyncHook.includes("ACCOUNT_SESSION_EXPLICIT_LOGOUT_STORAGE_KEY") &&
    databaseCloudSyncHook.includes("ACCOUNT_PROFILE_UPDATED_EVENT") &&
    databaseCloudSyncHook.includes(
      "event.key === ACCOUNT_SESSION_LAST_AUTHENTICATED_STORAGE_KEY ||\n        event.key === ACCOUNT_SESSION_EXPLICIT_LOGOUT_STORAGE_KEY"
    ) &&
    !databaseCloudSyncHook.includes(
      "event.key === ACCOUNT_SESSION_LAST_AUTHENTICATED_STORAGE_KEY &&\n        event.newValue"
    ) &&
    databaseCloudSyncHook.includes(
      'window.addEventListener(\n      ACCOUNT_PROFILE_UPDATED_EVENT,\n      handleAccountProfileUpdated\n    )'
    ) &&
    databaseCloudSyncHook.includes(
      'window.removeEventListener(\n        ACCOUNT_PROFILE_UPDATED_EVENT,\n        handleAccountProfileUpdated\n      )'
    ) &&
    databaseCloudSyncHook.includes(
      "const handleAccountProfileUpdated = () => {\n      void runSync({ forceLease: true, forceAccountGate: true, quick: true });\n    };"
    ) &&
    databaseCloudSyncHook.includes(
      "forceAccountGate: true,\n          quick: true,\n        });\n        return;"
    ),
  "数据库同步应监听跨标签账号登录/退出缓存变化和当前标签账号资料事件，并立即强制重新确认账号和接管同步租约，避免登录后仍等 auth retry 冷却"
);
check(
  databaseCloudSyncHook.includes("DATABASE_SYNC_STATUS_EVENT") &&
    databaseCloudSyncHook.includes("window.addEventListener(DATABASE_SYNC_STATUS_EVENT, handleStatus)") &&
    databaseCloudSyncHook.includes("window.removeEventListener(DATABASE_SYNC_STATUS_EVENT, handleStatus)") &&
    databaseCloudSyncHook.includes("SYNC_LOG_STATUS_EVENT") &&
    databaseCloudSyncHook.includes("SYNC_LOG_STATUS_STORAGE_KEY") &&
    databaseCloudSyncHook.includes("const handleSyncLogStatus = () => refreshStatusAndScheduleIfNeeded();") &&
    databaseCloudSyncHook.includes("window.addEventListener(SYNC_LOG_STATUS_EVENT, handleSyncLogStatus)") &&
    databaseCloudSyncHook.includes("window.removeEventListener(SYNC_LOG_STATUS_EVENT, handleSyncLogStatus)") &&
    databaseCloudSyncHook.includes("event.key === SYNC_LOG_STATUS_STORAGE_KEY") &&
    databaseCloudSyncHook.includes("refreshStatusAndScheduleIfNeeded") &&
    databaseCloudSyncHook.includes('event.key?.startsWith("zhinote.databasesync.")') &&
    databaseCloudSyncHook.includes("CustomEvent<PendingCloudDatabaseSyncStatus>") &&
    databaseCloudSyncHook.includes("PENDING_STATUS_SYNC_DELAY_MS") &&
    databaseCloudSyncHook.includes("function shouldForceAccountGateForPendingStatus") &&
    databaseCloudSyncHook.includes("status.pending + status.queued + (status.syncLogPending ?? 0) <= 0") &&
    databaseCloudSyncHook.includes("return Boolean(status.authRetryStatus)") &&
    databaseCloudSyncHook.includes("forceLease: Boolean(options.forceAccountGate)") &&
    databaseCloudSyncHook.includes("forceAccountGate: Boolean(options.forceAccountGate)") &&
    databaseCloudSyncHook.includes("shouldForceAccountGateForPendingStatus(detail)") &&
    databaseCloudSyncHook.includes("shouldForceAccountGateForPendingStatus(nextStatus)") &&
    databaseCloudSyncHook.includes("detail.pending + detail.queued + (detail.syncLogPending ?? 0)") &&
    databaseCloudSyncHook.includes("DATABASE_PENDING_STORAGE_KEYS") &&
    databaseCloudSyncHook.includes('DATABASE_PENDING_STORAGE_KEYS.has(event.key ?? "")'),
  "数据库云同步 hook 应监听 pending/status 事件和跨 tab storage 变化，并在队列有待上传内容时低延迟触发 quick sync；若 pending 队列正处于账号重试状态，应有边界地重新确认账号，避免可登录状态下等完整个退避窗口"
);
check(
  databaseCloudSyncHook.includes("rerunAfterCurrentSyncRef") &&
    databaseCloudSyncHook.includes("if (runningRef.current)") &&
    databaseCloudSyncHook.includes("rerunAfterCurrentSyncRef.current = {") &&
    databaseCloudSyncHook.includes("const pendingRerun = rerunAfterCurrentSyncRef.current") &&
    databaseCloudSyncHook.includes("window.setTimeout(() => {\n            void runSync({"),
  "数据库云同步运行中收到新触发时应记录补跑，当前同步结束后立刻再跑，避免表格/数据库待上传内容等下一次心跳"
);
check(
  pageCloudSyncHook.includes("LOCAL_CACHE_RECOVERY_EVENT") &&
    pageCloudSyncHook.includes("LOCAL_CACHE_RECOVERY_SIGNAL_KEY") &&
    pageCloudSyncHook.includes("getLocalCacheRecoverySignal") &&
    pageCloudSyncHook.includes("recoverLocalCacheFromCloud") &&
    pageCloudSyncHook.includes("seenLocalCacheRecoverySignalRef") &&
    pageCloudSyncHook.includes("recoveringLocalCacheSignalRef") &&
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
const pageRecoveryStart = pageCloudSyncHook.indexOf(
  "const recoverLocalCacheFromCloud = useCallback(async () => {"
);
const pageRecoveryOkStatus = pageCloudSyncHook.indexOf(
  'if (result.status === "ok")',
  pageRecoveryStart
);
const pageRecoverySeenMark = pageCloudSyncHook.indexOf(
  "seenLocalCacheRecoverySignalRef.current = signal.id",
  pageRecoveryStart
);
check(
  pageRecoveryStart >= 0 &&
    pageRecoveryOkStatus > pageRecoveryStart &&
    pageRecoverySeenMark > pageRecoveryOkStatus &&
    pageCloudSyncHook.includes(
      "recoveringLocalCacheSignalRef.current === signal.id"
    ),
  "页面本地缓存恢复信号只能在云端恢复成功后标记已处理；临时账号/云端失败必须可重试"
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
    pageSyncClient.includes("getAuthRetrySnapshot") &&
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
    databaseSyncClient.includes("getAuthRetrySnapshot") &&
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
const pageCloudSaveStatus = read("src/lib/pages/pageCloudSaveStatus.ts");
const cloudPageMutations = read("src/lib/pages/cloudPageMutations.ts");
const pageRoute = read("src/app/(workspace)/page/[pageId]/page.tsx");
const pageRouteLoading = read("src/app/(workspace)/page/[pageId]/loading.tsx");
const pageRouteLoadingShell = read("src/components/page/PageRouteLoadingShell.tsx");
const pageRouteLocalFirstLoadingShell = read(
  "src/components/page/PageRouteLocalFirstLoadingShell.tsx"
);
const pageRouteSkeleton = read("src/components/page/PageRouteSkeleton.tsx");
check(
  !pageShell.includes('from "@/hooks/usePages"') &&
    !pageShell.includes("usePages({") &&
    pageShell.includes("const upsertPages = useWorkspaceStore((s) => s.upsertPages)"),
  "PageShell 打开完整页面时不能挂 usePages 或订阅全量 pages；局部 upsert 应直接读取 workspace store action"
);
check(
  pageRoute.includes("PageRouteLocalFirstLoadingShell") &&
    pageRouteLoading.includes("PageRouteLoadingShell") &&
    pageRouteLoadingShell.includes("PageRouteSkeleton") &&
    pageRouteLocalFirstLoadingShell.includes("PageRouteSkeleton") &&
    pageShell.includes("PageRouteSkeleton") &&
    pageRouteLocalFirstLoadingShell.includes("readPageRouteHandoff") &&
    pageRouteLocalFirstLoadingShell.includes("readPendingPageDraft") &&
    pageRouteLocalFirstLoadingShell.includes(
      "useWorkspaceStore.getState().getPageById"
    ) &&
    pageRouteLocalFirstLoadingShell.includes("readLocalFirstPageRouteSeed") &&
    pageRouteLocalFirstLoadingShell.includes("previewPage.title") &&
    pageRouteLocalFirstLoadingShell.includes("previewPage.icon") &&
    pageRouteLocalFirstLoadingShell.includes("previewPage.properties") &&
    pageRouteSkeleton.includes("preview?:") &&
    pageRouteSkeleton.includes('data-testid="page-route-preview-title"'),
  "页面动态路由、route loading、动态组件 fallback、单页缓存读取等待态都必须显示页面骨架；服务器首屏不能空白，客户端 fallback 必须在完整页面加载前显示本地交接的标题/图标"
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
  pageShell.includes("const PAGE_TITLE_SAVE_DEBOUNCE_MS = 420") &&
    pageShell.includes("const titleSaveTimerRef = useRef<number | null>(null)") &&
    pageShell.includes("const pendingTitleRef = useRef<string | null>(null)") &&
    pageShell.includes("const persistTitleNow = useCallback") &&
    pageShell.includes("await update({ title: newTitle })") &&
    pageShell.includes("const flushTitleSave = useCallback") &&
    pageShell.includes("const scheduleTitleSave = useCallback") &&
    pageShell.includes("scheduleTitleSave(newTitle)") &&
    pageShell.includes("onBlur={() => void flushTitleSave()}") &&
    pageSimpleUpdateBody.includes("await update({ properties: stringifyPageProperties(next) })") &&
    pageShell.includes("pendingEditorContentPersistRef") &&
    pageShell.includes("editorContentPersistRunningRef") &&
    pageShell.includes("while (pendingEditorContentPersistRef.current)") &&
    pageShell.includes("await pageUpdateRef.current({ content_text: pending.html })") &&
    pageSimpleUpdateBody.includes("void drainEditorContentPersistQueue();") &&
    !pageSimpleUpdateBody.includes("refresh()") &&
    pageVisualUpdateBody.includes("await update({ icon })") &&
    pageVisualUpdateBody.includes("await update({ cover_url: dataUrl })") &&
    !pageVisualUpdateBody.includes("refresh()"),
  "PageShell 标题输入必须本地即时显示并防抖保存；正文保存必须合并到后台队列；属性/正文/图标/封面更新仍依赖 usePage 的单页 upsert，不能触发全量页面 metadata 刷新"
);
const pageStructureMutationBody = pageShell.slice(
  pageShell.indexOf("const handlePastePage"),
  pageShell.indexOf("useEffect(() => {\n    if (!showInfo || !page)")
);
check(
  pageStructureMutationBody.includes(
    "collectMovedPageSnapshots(useWorkspaceStore.getState().pages, moved)"
  ) &&
    pageStructureMutationBody.includes("createOptimisticPageWithCloud") &&
    pageStructureMutationBody.includes("upsertPages([child])") &&
    pageStructureMutationBody.includes("void update({ content_text: html });") &&
    pageStructureMutationBody.indexOf(
      'openPage(child, { source: "child-page-create" })'
    ) > pageStructureMutationBody.indexOf("void update({ content_text: html });") &&
    pageStructureMutationBody.includes("const optimisticDuplicate =") &&
    pageStructureMutationBody.includes("upsertPages([optimisticDuplicate])") &&
    pageStructureMutationBody.includes(
      'openPage(optimisticDuplicate, { source: "duplicate-page-create" })'
    ) &&
    pageStructureMutationBody.indexOf(
      'openPage(optimisticDuplicate, { source: "duplicate-page-create" })'
    ) < pageStructureMutationBody.indexOf("await updateWikiLinks(duplicate.id") &&
    pageStructureMutationBody.includes("await remove()") &&
    !pageStructureMutationBody.includes("await refresh()") &&
    !pageShell.includes("const { refresh } = usePages({ autoLoad: false })"),
  "PageShell 粘贴/移动/删除/创建子页面/复制页面必须局部 upsert；创建子页面应先打开乐观页面壳并后台保存父页面链接；复制页面应先打开乐观副本，再后台写正文链接，不能在大批量页面后触发全量 metadata 刷新"
);
check(
  cloudPageMutations.includes("export async function createPageWithCloud") &&
    cloudPageMutations.includes("page = await createLocalPage(opts);") &&
    cloudPageMutations.includes('publishCreatedPageSnapshot(page, "local-metadata")') &&
    cloudPageMutations.includes(`page = createCloudDraftFallbackPage(opts);
    rememberPendingPageDraft(page);
    publishCreatedPageSnapshot(page, "optimistic-local");`) &&
    cloudPageMutations.includes("export function createOptimisticPageWithCloud") &&
    cloudPageMutations.includes("const page = createCloudDraftFallbackPage(opts);") &&
    cloudPageMutations.includes("rememberPendingPageDraft(page)") &&
    cloudPageMutations.includes("publishCreatedPageSnapshot(page, \"optimistic-local\")") &&
    cloudPageMutations.includes("void persistOptimisticCreatedPage(page, opts);") &&
    cloudPageMutations.includes("return page;") &&
    cloudPageMutations.includes("id: seed.id") &&
    cloudPageMutations.includes("getExistingOptimisticPage(seed.id)") &&
    cloudPageMutations.includes("writePageListHotCacheSnapshot") &&
    cloudPageMutations.includes("clearPendingPageDraft(seed.id)") &&
    cloudPageMutations.includes("void queuePageCloudPush(page).catch(() => undefined)") &&
    cloudPageMutations.includes("void queuePageCloudPush(seed).catch(() => undefined)"),
  "页面手动创建应同步返回本地乐观页面壳，用同一 id 后台落本地库并排队云同步；若本地插入竞态失败，应先读取已有同 id 页面，不能用空草稿覆盖用户输入"
);
check(
  !pageShell.includes("const pages = useWorkspaceStore((s) => s.pages)") &&
    !pageShell.includes('from "@/hooks/usePages"') &&
    !pageShell.includes("usePages({") &&
    pageShell.includes(
      "collectMovedPageSnapshots(useWorkspaceStore.getState().pages, moved)"
    ),
  "PageShell 打开完整页面时不应订阅全量 pages；只有剪切/移动时才临时读取当前页面快照，避免大批量导入或云端 metadata 更新拖慢当前页"
);
check(
  pageShell.includes("useVersions(pageId, {") &&
    pageShell.includes("enabled: shouldLoadVersions") &&
    pageShell.includes("const shouldLoadVersions = showHistory;") &&
    pageShell.includes("getPageVersionCount") &&
    pageShell.includes("versionCountForDisplay") &&
    !pageShell.includes("const shouldLoadVersions = showHistory || showInfo;"),
  "PageShell 不应在打开页面或打开信息面板时加载全部版本正文；只有历史面板读取版本列表，菜单/信息面板只读轻量数量"
);
check(
  pageShell.includes("if (!showInfo || !page) {\n      setPageStructure(null)") &&
    pageShell.includes("void loadPageResearchStructureModule()") &&
    pageShell.includes(".then(({ buildPageResearchStructureReport }) =>") &&
    pageShell.includes("showInfo && pageStructure && pageInfo"),
  "PageShell 不应在打开页面首屏默认解析完整正文生成投研结构"
);
check(
  pageShell.includes("scheduleEditorMount") &&
    pageShell.includes("scheduleDeferredMount") &&
    pageShell.includes("return scheduleEditorMount(() => {\n      void loadEditorModule();\n      setEditorMounted(true);") &&
    pageShell.includes('const loadPageVersioningModule = () => import("@/lib/comparison/versioning")') &&
    pageShell.includes('const loadPageExportModule = () => import("@/lib/export/pageExport")') &&
    pageShell.includes("const loadPageResearchStructureModule = () =>") &&
    pageShell.includes("const loadPageSnapshotUpdatesModule = () =>") &&
    !pageShell.includes('from "@/lib/comparison/versioning"') &&
    !pageShell.includes('from "@/lib/export/pageExport"') &&
    !pageShell.includes('from "@/lib/pages/pageSnapshotUpdates"') &&
    pageShell.includes("PAGE_EDITOR_IDLE_TIMEOUT_MS = 120") &&
    pageShell.includes("PAGE_COMMENTS_IDLE_TIMEOUT_MS = 700") &&
    pageShell.includes("PAGE_CHILD_TREE_IDLE_TIMEOUT_MS = 1200") &&
    pageShell.includes("PAGE_REFERENCES_IDLE_TIMEOUT_MS = 1800") &&
    pageShell.includes("pageCommentsMounted") &&
    pageShell.includes("childTreeMounted") &&
    pageShell.includes("pageReferencesMounted") &&
    !pageShell.includes("pagePeripheralsMounted") &&
    pageShell.includes("dynamic<IconPickerProps>(") &&
    pageShell.includes('() => import("@/components/shared/IconPicker")') &&
    pageShell.includes("PageIconPickerSkeleton") &&
    pageShell.includes("dynamic<PagePropertiesProps>(") &&
    pageShell.includes('() => import("@/components/page/PageProperties")') &&
    pageShell.includes("PagePropertiesSkeleton") &&
    pageShell.includes("dynamic<PageActionsMenuProps>(") &&
    pageShell.includes('() => import("@/components/page/PageActionsMenu")') &&
    pageShell.includes("PageActionsMenuSkeleton") &&
    pageShell.includes("dynamic<BlockCommentsProps>(") &&
    pageShell.includes('() => import("@/components/shared/BlockComments")') &&
    pageShell.includes("@/components/shared/blockCommentEvents") &&
    !pageShell.includes('import IconPicker from "@/components/shared/IconPicker"') &&
    !pageShell.includes('import PageProperties from "@/components/page/PageProperties"') &&
    !pageShell.includes('import PageActionsMenu from "@/components/page/PageActionsMenu"') &&
    !pageShell.includes('import BlockComments from "@/components/shared/BlockComments"') &&
    pageShell.includes("if (loading && !page)") &&
    pageShell.includes("editorMounted ?") &&
    pageShell.includes("PageBodySkeleton"),
  "PageShell 应快速挂载正文编辑器，同时延后评论、反链、子页面、图标/属性/菜单等周边重组件"
);
check(
  pageShell.includes("PAGE_METADATA_ONLY_EDITOR_DELAY_MS = 420") &&
    pageShell.includes("PAGE_METADATA_ONLY_EDITOR_IDLE_TIMEOUT_MS = 900") &&
    pageShell.includes("PAGE_LARGE_BODY_HTML_CHARS = 180 * 1024") &&
    pageShell.includes("PAGE_LARGE_BODY_EDITOR_DELAY_MS = 260") &&
    pageShell.includes("PAGE_LARGE_BODY_EDITOR_IDLE_TIMEOUT_MS = 1600") &&
    pageShell.includes("const hasContentForEditor = page?.content_text != null") &&
    pageShell.includes('const isOptimisticPageDraft = page?.content_text === "";') &&
    pageShell.includes("const hasLargeBodyForEditor = isLargePageBodyForEditor(page?.content_text)") &&
    pageShell.includes("mountedEditorPageIdRef.current = pageId") &&
    pageShell.includes("if (editorMounted && mountedEditorPageIdRef.current === pageId) return") &&
    pageShell.includes("if (isOptimisticPageDraft) {") &&
    pageShell.includes("optimisticDraft={isOptimisticPageDraft}") &&
    pageShell.includes("getPageOpenPerformanceStatus(") &&
    pageShell.includes('"local-draft-ready"') &&
    pageShell.includes("新页面已在本机创建，标题和属性可以先确认，编辑器正在准备") &&
    pageShell.includes("hasLargeBodyForEditor\n        ? PAGE_LARGE_BODY_EDITOR_DELAY_MS") &&
    pageShell.includes("hasLargeBodyForEditor\n        ? PAGE_LARGE_BODY_EDITOR_IDLE_TIMEOUT_MS") &&
    pageShell.includes("delay,\n      timeout,") &&
    pageShell.includes("largeBody={hasLargeBodyForEditor}") &&
    pageShell.includes("正文较长（约 ${formatApproxBodySize(contentLength)}）") &&
    pageShell.includes("isLargePageBodyForEditor(content") &&
    pageShell.includes('status: "large-body-preview-ready"') &&
    pageShell.includes("preview_blocks: activePreview.blocks.length") &&
    pageShell.includes("aria-busy={openingEditor}") &&
    pageShell.includes("标题和属性已先显示，正在从本地缓存补齐正文和编辑器") &&
    pageShell.includes('data-testid="page-body-hydration-status"') &&
    pageShell.includes("subscribePageBodyHydrationStatus(pageId, setBodyHydrationStatus)") &&
    pageShell.includes("describePageBodyHydrationStatus(bodyHydrationStatus)"),
  "PageShell 通过 metadata route handoff 打开页面时应先显示标题属性，延后重编辑器，显示正文补齐状态，并避免正文回填时重挂载当前编辑器"
);
check(
  pageShell.includes("PAGE_EDITOR_SIDE_EFFECT_DEBOUNCE_MS = 1500") &&
    pageShell.includes("pendingEditorSideEffectsRef") &&
    pageShell.includes("pendingEditorContentPersistRef") &&
    pageShell.includes("editorContentPersistRunningRef") &&
    pageShell.includes("while (pendingEditorContentPersistRef.current)") &&
    pageShell.includes("await pageUpdateRef.current({ content_text: pending.html })") &&
    pageShell.includes("void drainEditorContentPersistQueue();") &&
    pageShell.includes("flushEditorSideEffects") &&
    pageShell.includes("scheduleEditorSideEffects();") &&
    pageShell.includes("await updateWikiLinks(pageId, pending.linkedPageIds)") &&
    pageShell.includes("await maybeSnapshot(\n        pageId,\n        pending.title") &&
    pageShell.includes("cancelEditorSideEffects();"),
  "PageShell 正文保存后应合并最新正文并延迟重建 wiki 链接和自动版本快照，避免编辑输入路径被关系索引和版本比较拖慢"
);
check(
  pageShell.includes("PAGE_SYNC_STATUS_PENDING_REFRESH_MS = 5000") &&
    pageShell.includes("PAGE_SYNC_STATUS_IDLE_REFRESH_MS = 30 * 1000") &&
    pageShell.includes('PAGE_SYNC_STORAGE_KEY_PREFIX = "zhinote.pagesync."') &&
    pageShell.includes(
      'const loadPageAccountSyncModule = () => import("@/lib/pages/accountPageSync")'
    ) &&
    pageShell.includes("EMPTY_PAGE_SYNC_STATUS") &&
    pageShell.includes(
      "getCloudPageSyncItemStatus,"
    ) &&
    pageShell.includes("getCloudPageSyncItemStatus(pageId)") &&
    pageShell.includes("scheduleStatusRefresh") &&
    pageShell.includes("queueMicrotask(() =>") &&
    pageShell.includes("if (!cancelled) callback();") &&
    pageShell.includes("if (cancelled) return;") &&
    pageShell.includes("function isPageSyncStorageEvent(") &&
    pageShell.includes("event.key.startsWith(PAGE_SYNC_STORAGE_KEY_PREFIX)") &&
    pageShell.includes('window.addEventListener("storage", handleStorageRefresh)') &&
    pageShell.includes(
      'document.addEventListener("visibilitychange", handleVisibleRefresh)'
    ) &&
    !pageShell.includes("import {\n  getPendingCloudPageSyncStatus") &&
    !pageShell.includes("window.setInterval(refreshStatus, 5000)"),
  "PageShell 同步状态应在 pending 时保持 5 秒反馈、空闲时降到 30 秒，并在标签页恢复可见时刷新，避免固定 5 秒轮询拖慢页面打开"
);
const pageSaveAuthRetryIndex = pageCloudSaveStatus.indexOf(
  "if (input.status.authRetryStatus)"
);
const pageSaveLocalOnlyIndex = pageCloudSaveStatus.indexOf(
  "if (!input.status.enabled)"
);
check(
  pageSaveLocalOnlyIndex >
    pageCloudSaveStatus.indexOf("if (pageManualReview)") &&
    pageSaveLocalOnlyIndex > pageCloudSaveStatus.indexOf("if (pageFailed)") &&
    pageSaveLocalOnlyIndex >
      pageCloudSaveStatus.indexOf("if (input.status.manualReviewCount > 0)") &&
    pageSaveLocalOnlyIndex >
      pageCloudSaveStatus.indexOf("if (input.status.failed > 0)") &&
    pageSaveLocalOnlyIndex >
      pageCloudSaveStatus.indexOf("if (currentPagePending)") &&
    pageSaveLocalOnlyIndex >
      pageCloudSaveStatus.indexOf("if (totalPending > 0)") &&
    pageSaveAuthRetryIndex > pageCloudSaveStatus.indexOf("if (pageManualReview)") &&
    pageSaveAuthRetryIndex > pageCloudSaveStatus.indexOf("if (pageFailed)") &&
    pageSaveAuthRetryIndex >
      pageCloudSaveStatus.indexOf("if (input.status.manualReviewCount > 0)") &&
    pageSaveAuthRetryIndex >
      pageCloudSaveStatus.indexOf("if (input.status.failed > 0)") &&
    pageSaveAuthRetryIndex >
      pageCloudSaveStatus.indexOf("if (currentPagePending)") &&
    pageSaveAuthRetryIndex > pageCloudSaveStatus.indexOf("if (totalPending > 0)") &&
    pageSaveAuthRetryIndex > pageSaveLocalOnlyIndex &&
    pageCloudSaveStatus.includes(
      "当前云端暂不可确认，会稍后自动重试，不会因此登出"
    ),
  "PageCloudSaveStatus 必须优先显示当前页/全局 pending、failed、manual review；同步关闭和 auth retry 只能作为队列清空后的状态，避免盖住待处理数据"
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
    pagePeekModal.includes("const initialPeekPage = getInitialPeekPage(pageId, initialPage)") &&
    pagePeekModal.includes("const localFirstSeed = readLocalFirstPeekSeed(pageId);") &&
    pagePeekModal.includes("if (localFirstSeed) return localFirstSeed;") &&
    pagePeekModal.includes("const handleOpenFullPage = useCallback") &&
    pagePeekModal.includes("prepareLocalFirstPageNavigation(seed, \"page-open\")") &&
    pagePeekModal.includes("onClick={handleOpenFullPage}") &&
    pagePeekModal.includes("handleOpenFullPage();") &&
    pagePeekModal.includes("useState(() => initialPeekPage?.title ?? \"\")") &&
    pagePeekModal.includes("applyPeekMetadataSnapshot") &&
    pagePeekModal.includes("const localFirstSeedPage = currentFallbackPage ?? currentInitialPage") &&
    pagePeekModal.includes("const isOptimisticDraft = localFirstSeedPage?.content_text === \"\"") &&
    pagePeekModal.includes("initialPage={initialPage}") &&
    pagePeekModal.includes("isOptimisticDraft") &&
    pagePeekModal.includes("getPeekOpenPerformanceStatus(") &&
    pagePeekModal.includes('"local-draft-ready"') &&
    pagePeekModal.includes("PEEK_METADATA_ONLY_CONTENT_DELAY_MS = 260") &&
    pagePeekModal.includes("PEEK_METADATA_ONLY_CONTENT_IDLE_TIMEOUT_MS = 700") &&
    pagePeekModal.includes("const isMetadataOnlyPeek =") &&
    pagePeekModal.includes("schedulePeekContentLoad(() => {\n        setEditorLoadRequested(true);\n      }, isMetadataOnlyPeek)") &&
    pagePeekModal.includes("标题和属性已先显示，正在从本地缓存补齐正文") &&
    pagePeekModal.includes("标题和属性已先显示，正在排队补齐正文和编辑器") &&
    pagePeekModal.includes("PeekMetadataRecoveryShell") &&
    pagePeekModal.includes("打开完整页面继续编辑 ↗") &&
    pagePeekModal.includes("避免大批量导入后的页面打开被长正文拖慢") &&
    pagePeekModal.includes('surface: "peek"') &&
    pagePeekModal.includes("subscribePageBodyHydrationStatus(pageId, setBodyHydrationStatus)") &&
    pagePeekModal.includes("bodyHydrationLabel ??") &&
    pagePeekModal.includes('data-testid="page-peek-modal"') &&
    pagePeekModal.includes(
      'data-local-seed-state={hasEffectivePage ? "ready" : "loading"}'
    ) &&
    pagePeekModal.includes('data-testid="page-peek-metadata-recovery-shell"') &&
    pagePeekModal.includes('data-local-seed-state={seed ? "ready" : "loading"}') &&
    pagePeekModal.includes("setEditorLoadRequested(true);\n        setMountedEditorPageId(pageId)") &&
    pagePeekModal.includes("setMountedEditorPageId(pageId)") &&
    pagePeekModal.includes("childPagesEnabled") &&
    pagePeekModal.includes("dynamic<IconPickerProps>(") &&
    pagePeekModal.includes('() => import("@/components/shared/IconPicker")') &&
    pagePeekModal.includes("dynamic<PagePropertiesProps>(") &&
    pagePeekModal.includes('() => import("@/components/page/PageProperties")') &&
    pagePeekModal.includes("PeekIconPickerSkeleton") &&
    pagePeekModal.includes("PeekPropertiesSkeleton") &&
    pagePeekModal.includes(
      'const loadPageAccountSyncModule = () => import("@/lib/pages/accountPageSync")'
    ) &&
    pagePeekModal.includes("const PEEK_TITLE_SAVE_DEBOUNCE_MS = 420") &&
    pagePeekModal.includes("const titleSaveTimerRef = useRef<number | null>(null)") &&
    pagePeekModal.includes("const pendingTitleRef = useRef<string | null>(null)") &&
    pagePeekModal.includes("const persistPeekTitleNow = useCallback") &&
    pagePeekModal.includes("getCloudPageSyncItemStatus(pageId)") &&
    pagePeekModal.includes("data-cloud-sync-state={peekCloudSyncStatus.state}") &&
    pagePeekModal.includes("本地已保存，云端确认中") &&
    pagePeekModal.includes("schedulePeekTitleSave(next)") &&
    pagePeekModal.includes("onBlur={() => void flushPeekTitleSave()}") &&
    pagePeekModal.includes("rememberPendingPageDraft(nextPage)") &&
    pagePeekModal.includes("void pushPeekCloudPage(nextPage).catch(() => undefined)") &&
    pagePeekModal.includes("{childPagesEnabled ? (") &&
    pagePeekModal.includes("PeekEditorSkeleton"),
  "PagePeekModal 应让新建空白草稿即时进入编辑器，并推迟子页面查询、图标选择器和属性编辑器；标题输入必须本地即时显示并防抖保存，避免点击 + 和输入时被编辑器初始化、本地索引查询或云端队列拖慢"
);
const lazyPagePeekModal = read("src/components/page/LazyPagePeekModal.tsx");
const knowledgeBaseShell = read("src/components/modules/KnowledgeBaseShell.tsx");
check(
    lazyPagePeekModal.includes("function loadPagePeekModal()") &&
    lazyPagePeekModal.includes("export function warmPagePeekModal()") &&
    lazyPagePeekModal.includes("function warmPagePeekEditor()") &&
    lazyPagePeekModal.includes('import("@/components/editor/Editor")') &&
    lazyPagePeekModal.includes("warmPagePeekEditor();") &&
    lazyPagePeekModal.includes('import("@/components/page/PagePeekModal")') &&
    lazyPagePeekModal.includes("dynamic(loadPagePeekModal") &&
    lazyPagePeekModal.includes("LocalFirstPeekLoadingShell") &&
    lazyPagePeekModal.includes("readLocalFirstLoadingSeed") &&
    lazyPagePeekModal.includes("const [seed, setSeed] = useState<Page | null>(() =>") &&
    lazyPagePeekModal.includes("const refreshLocalSeed = () => {") &&
    lazyPagePeekModal.includes("queueMicrotask(refreshLocalSeed)") &&
    lazyPagePeekModal.includes("const retryTimer = window.setTimeout(refreshLocalSeed, 120)") &&
    lazyPagePeekModal.includes("if (!seed) return;") &&
    lazyPagePeekModal.includes("readPendingPageDraft(pageId)") &&
    lazyPagePeekModal.includes("readPageRouteHandoff(pageId)") &&
    lazyPagePeekModal.includes("const openFullFromLoadingShell = useCallback") &&
    lazyPagePeekModal.includes("prepareLocalFirstPageNavigation(seed, \"page-open\")") &&
    lazyPagePeekModal.includes("onClick={openFullFromLoadingShell}") &&
    lazyPagePeekModal.includes("rememberPendingPageDraft(nextPage)") &&
    lazyPagePeekModal.includes("upsertPages([nextPage])") &&
    lazyPagePeekModal.includes("const [quickDraft, setQuickDraft] = useState(() => ({") &&
    lazyPagePeekModal.includes("const quickDraftText = quickDraft.pageId === pageId ? quickDraft.text : \"\";") &&
    lazyPagePeekModal.includes("const quickDraftTouched =\n    quickDraft.pageId === pageId ? quickDraft.touched : false;") &&
    lazyPagePeekModal.includes("setQuickDraft({ pageId, text: value, touched: true })") &&
    lazyPagePeekModal.includes("const handleQuickDraftChange = useCallback") &&
    lazyPagePeekModal.includes("function quickDraftTextToHtml") &&
    lazyPagePeekModal.includes("function escapeQuickDraftHtml") &&
    lazyPagePeekModal.includes('data-testid="page-peek-quick-draft-input"') &&
    lazyPagePeekModal.includes("data-quick-draft-active={canUseQuickDraft}") &&
    lazyPagePeekModal.includes("快速输入已暂存在本机草稿") &&
    lazyPagePeekModal.includes("readyOnLocalShell = true") &&
    lazyPagePeekModal.includes("if (readyOnLocalShell) {\n      onReady?.(pageId);\n    }") &&
    lazyPagePeekModal.includes("onReady?.(pageId)") &&
    lazyPagePeekModal.includes('status: seed ? "local-shell-ready" : "local-shell-loading"') &&
    lazyPagePeekModal.includes("新页面已在本机创建，完整编辑器正在载入。") &&
    lazyPagePeekModal.includes("打开完整页面继续编辑 ↗") &&
    lazyPagePeekModal.includes("已先显示本地页面信息") &&
    dailyNotesShell.includes('@/components/page/LazyPagePeekModal') &&
    dailyNotesShell.includes("warmPagePeekModal();") &&
    dailyNotesShell.includes("DAILY_PEEK_EDITOR_WARMUP_DELAY_MS") &&
    dailyNotesShell.includes("DAILY_PEEK_EDITOR_WARMUP_IDLE_TIMEOUT_MS") &&
    dailyNotesShell.includes("cancelPeekEditorWarmup = scheduleDailyIdleTask(() => {") &&
    dailyNotesShell.includes("const warmDailyPeekOpen = useCallback") &&
    dailyNotesShell.includes("onPointerEnter={warmDailyCreateOpenPath}") &&
    !dailyNotesShell.includes("const warmPageRoute = useCallback(() => {\n    warmPagePeekModal();") &&
    !dailyNotesShell.includes('@/components/page/PagePeekModal') &&
    dailyNotesShell.includes("setPeekPageId(note.id)") &&
    dailyNotesShell.includes("const [openingNoteId, setOpeningNoteId]") &&
    dailyNotesShell.includes("setOpeningNoteId(note.id);") &&
    dailyNotesShell.indexOf('primeDailyNoteOpen(note, "daily-open");') <
      dailyNotesShell.indexOf("setOpeningNoteId(note.id);") &&
    dailyNotesShell.includes("const creatingDateKeyRef = useRef<string | null>(null)") &&
    dailyNotesShell.includes("const activateDailyCreate = useCallback") &&
    dailyNotesShell.includes('data-create-activation="single-entry"') &&
    dailyNotesShell.includes("scheduleDailyCreateOpenWarmupAfterFeedback") &&
    dailyNotesShell.includes("const addNoteOnMouseDown = useCallback") &&
    dailyNotesShell.includes("const addNoteOnPointerDown = useCallback") &&
    dailyNotesShell.includes("onPointerDown={(event) => addNoteOnPointerDown(event, todayKey)}") &&
    dailyNotesShell.includes("onPointerDown={(event) => addNoteOnPointerDown(event, key)}") &&
    dailyNotesShell.includes("onMouseDown={(event) => addNoteOnMouseDown(event, todayKey)}") &&
    dailyNotesShell.includes("onMouseDown={(event) => addNoteOnMouseDown(event, key)}") &&
    dailyNotesShell.includes('onPointerDown={() =>') &&
    dailyNotesShell.includes('primeDailyNoteOpen(note, "daily-open")') &&
    dailyNotesShell.includes('onFocus={() => primeDailyNoteOpen(note, "daily-open")}') &&
    !dailyNotesShell.includes("const warmDailyNoteContent = useCallback") &&
    !dailyNotesShell.includes("onMouseEnter={() => warmDailyNoteContent(note)}") &&
    dailyNotesShell.includes("setPeekInitialPage(toDailyNoteMetadataSeed(seededNote, note));") &&
    dailyNotesShell.includes("openingNoteId === note.id") &&
    dailyNotesShell.includes("正在打开纪要…") &&
    dailyNotesShell.includes("const handlePeekReady = useCallback") &&
    dailyNotesShell.includes("onReady={handlePeekReady}") &&
    pagePeekModal.includes("onReady?: (pageId: string) => void") &&
    pagePeekModal.includes("readyOnLocalShell?: boolean;") &&
    pagePeekModal.includes("readyNotifiedPageIdRef") &&
    pagePeekModal.includes("onReady?.(pageId)") &&
    dailyNotesShell.includes("window.setTimeout(() =>") &&
    dailyNotesShell.includes("current === dateKey ? null : current") &&
    !dailyNotesShell.includes("fetchCloudPageById") &&
    dailyNotesShell.includes("setPeekPageId(optimisticNote.id);") &&
    dailyNotesShell.includes('openPage(optimisticNote, { source: "daily-create" })') &&
    dailyNotesShell.includes('data-open-mode={dailyCreateOpenMode}') &&
    dailyNotesShell.includes("openDailyNoteFullPageById") &&
    dailyNotesShell.includes("openDailyNoteFullPage(note, \"daily-open\")") &&
    knowledgeBaseShell.includes('@/components/page/LazyPagePeekModal') &&
    knowledgeBaseShell.includes("warmPagePeekModal();") &&
    knowledgeBaseShell.includes("onPrimeOpen={warmPagePeekModal}"),
  "每日纪要 + 应直接弹出新页面并快速释放按钮；已有纪要和知识库都必须懒加载页面弹窗，避免拖慢日历首屏"
);

const localQueries = read("src/lib/db/local/queries.ts");
const localSchema = read("src/lib/db/local/schema.ts");
const localClient = read("src/lib/db/local/client.ts");
check(
  localQueries.includes("id?: string;") &&
    localQueries.includes("const id = opts?.id ?? generateId();") &&
    localQueries.includes("recordSyncChange("),
  "本地 createPage 应允许乐观页面壳传入稳定 id，并继续写入 sync_log，避免点击新建后出现两个页面 id"
);
check(
  localQueries.includes("export async function getBlockCommentCount") &&
    localQueries.includes("SELECT COUNT(*) as count FROM block_comments") &&
    pageShell.includes("getBlockCommentCount(pageId)") &&
    !pageShell.includes("getBlockComments(pageId)"),
  "PageShell 评论徽标应使用 block_comments 轻量 COUNT 查询，不能为了显示数量读取全部评论正文"
);
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
const localPageContentHydrationBody = localQueries.slice(
  localQueries.indexOf("export async function listPagesForContentHydration"),
  localQueries.indexOf("export async function getAllPageMetadata")
);
const localSinglePageContentHydrationBody = localQueries.slice(
  localQueries.indexOf("export async function getPageForContentHydration"),
  localQueries.indexOf("export async function createPage")
);
check(
  localQueries.includes("PAGE_CONTENT_HYDRATION_SELECT") &&
    localQueries.includes("NULL AS content_yjs, ${prefix}content_text") &&
    localQueries.includes("export async function getPageForContentHydration") &&
    localQueries.includes("export async function listPagesForPriorityContentHydration") &&
    localQueries.includes("AND id IN (${placeholders})") &&
    localPageContentHydrationBody.includes("PAGE_CONTENT_HYDRATION_SELECT") &&
    localSinglePageContentHydrationBody.includes("PAGE_CONTENT_HYDRATION_SELECT") &&
    !localPageContentHydrationBody.includes("SELECT *") &&
    !localSinglePageContentHydrationBody.includes("SELECT *"),
  "后台正文补齐应只读取 content_text，不能通过 SELECT * 把 content_yjs 二进制内容一起读入内存"
);
check(
  usePagesHook.includes("PRIORITY_CONTENT_HYDRATION_LIMIT") &&
    usePagesHook.includes("getPriorityContentHydrationPageIds") &&
    usePagesHook.includes("listPagesForPriorityContentHydration") &&
    usePagesHook.indexOf("const priorityPageIds = getPriorityContentHydrationPageIds()") <
      usePagesHook.indexOf("let offset = 0;"),
  "后台正文补齐应先补当前已显示的 metadata-only 页面，再进入 offset 全库空闲批次"
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
const pageCacheRebuildBody = accountShell.slice(
  accountShell.indexOf("async function handlePageCacheRebuildRun"),
  accountShell.indexOf("function handlePageSyncToggle")
);
const databaseCacheRebuildBody = accountShell.slice(
  accountShell.indexOf("async function handleDatabaseCacheRebuildRun"),
  accountShell.indexOf("function handleDatabaseSyncToggle")
);
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
  accountShell.includes("getPendingCloudPageSyncStatus") &&
    accountShell.includes("getPageCacheRebuildPendingBlocker") &&
    accountShell.includes("pending queue、文件上传队列、失败记录和人工处理记录") &&
    accountShell.includes("页面 pending、failed、manual review 都清零后再重建") &&
    accountShell.includes("status.failed === 0") &&
    accountShell.includes("status.manualReviewCount === 0") &&
    pageCacheRebuildBody.includes("getPageCacheRebuildPendingBlocker()") &&
    pageCacheRebuildBody.includes("getFileEmbedCacheRebuildPendingBlocker()") &&
    pageCacheRebuildBody.includes("setPageSyncNotice(pendingBlocker)") &&
    pageCacheRebuildBody.indexOf("getPageCacheRebuildPendingBlocker()") <
      pageCacheRebuildBody.indexOf("getFileEmbedCacheRebuildPendingBlocker()") &&
    pageCacheRebuildBody.indexOf("getFileEmbedCacheRebuildPendingBlocker()") <
      pageCacheRebuildBody.indexOf("window.confirm"),
  "AccountShell 重建本机页面缓存前必须先检查页面 pending、failed、manual review 和文件上传队列；未上传或失败输入清零前不能进入确认弹窗"
);
check(
  accountShell.includes("pageCacheRebuildGateNotice") &&
    accountShell.includes("getPageCacheRebuildBlockerFromStatus(pagePendingStatus)") &&
    accountShell.includes("getFileEmbedCacheRebuildBlockerFromStatus(fileEmbedPendingStatus)") &&
    accountShell.includes("account-page-cache-rebuild-gate") &&
    accountShell.includes('data-cache-rebuild-ready={blocker ? "false" : "true"}') &&
    accountShell.includes("Boolean(pageCacheRebuildGateNotice)") &&
    accountShell.includes("页面缓存重建门禁") &&
    accountShell.includes("页面 pending、failed、manual review 均为 0") &&
    accountShell.includes("正在检查文件上传 pending、failed、manual review 状态"),
  "AccountShell 页面缓存重建门禁必须在点击前可见，并在 pending/failed/manual review 未清零时禁用重建按钮"
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
  accountShell.includes('data-testid="account-cloud-coverage-map"') &&
    accountShell.includes("全域云端覆盖") &&
    accountShell.includes("云端主库 + 本地热缓存") &&
    accountShell.includes("页面 / 每日纪要 / 会议安排") &&
    accountShell.includes("数据库") &&
    accountShell.includes("账号 / 模块设置") &&
    accountShell.includes("文件 / 评论 / 版本 / AI 输出") &&
    accountShell.includes("/modules/sync#cloud-source-of-truth-plan"),
  "AccountShell 应在账号页展示全域云端覆盖地图，说明哪些数据已进云端主库、哪些仍需本地或二次确认"
);
check(
  accountShell.includes("getPendingCloudDatabaseSyncStatus") &&
    accountShell.includes("getDatabaseCacheRebuildPendingBlocker") &&
    accountShell.includes("database pending queue、本地 sync_log、文件上传队列、失败记录和人工处理记录") &&
    accountShell.includes("pending、failed、manual review 都清零后再重建") &&
    accountShell.includes("status.failed === 0") &&
    accountShell.includes("status.manualReviewCount === 0") &&
    databaseCacheRebuildBody.includes(
      "await getDatabaseCacheRebuildPendingBlocker()"
    ) &&
    databaseCacheRebuildBody.includes(
      "getFileEmbedCacheRebuildPendingBlocker()"
    ) &&
    databaseCacheRebuildBody.includes("setDatabaseSyncNotice(pendingBlocker)") &&
    databaseCacheRebuildBody.indexOf(
      "await getDatabaseCacheRebuildPendingBlocker()"
    ) <
      databaseCacheRebuildBody.indexOf(
        "getFileEmbedCacheRebuildPendingBlocker()"
      ) &&
    databaseCacheRebuildBody.indexOf(
      "getFileEmbedCacheRebuildPendingBlocker()"
    ) < databaseCacheRebuildBody.indexOf("window.confirm"),
  "AccountShell 重建本机数据库缓存前必须先检查 database pending queue、本地 sync_log、failed、manual review 和文件上传队列；未上传或失败数据库/文件变更清零前不能进入确认弹窗"
);
check(
  accountShell.includes("databaseCacheRebuildGateNotice") &&
    accountShell.includes(
      "getDatabaseCacheRebuildBlockerFromStatus(databasePendingStatus)"
    ) &&
    accountShell.includes("getFileEmbedCacheRebuildBlockerFromStatus(fileEmbedPendingStatus)") &&
    accountShell.includes("account-database-cache-rebuild-gate") &&
    accountShell.includes('data-cache-rebuild-ready={blocker ? "false" : "true"}') &&
    accountShell.includes("Boolean(databaseCacheRebuildGateNotice)") &&
    accountShell.includes("数据库缓存重建门禁") &&
    accountShell.includes("数据库 pending、failed、manual review 均为 0"),
  "AccountShell 数据库缓存重建门禁必须在点击前可见，并在 pending/failed/manual review 未清零时禁用重建按钮"
);
check(
  syncDashboardShell.includes("本机缓存重建入口") &&
    syncDashboardShell.includes("云端 manifest 是重建来源") &&
    syncDashboardShell.includes("首次账号同步会补种本机页面和数据库基线") &&
    syncDashboardShell.includes("本地 pending 变更未清空前不建议重建") &&
    syncDashboardShell.includes("buildCacheRebuildPreflightReceipt") &&
    syncDashboardShell.includes("导出重建预检收据") &&
    syncDashboardShell.includes("重建 dry-run 预检") &&
    syncDashboardShell.includes("zhinote-cache-rebuild-preflight-receipt") &&
    syncDashboardShell.includes("保留本地数据库私有页面") &&
    syncDashboardShell.includes("router.push(\"/account\")") &&
    cacheRebuildPreflightReceipt.includes(
      'format: "zhinote-cache-rebuild-preflight-receipt"'
    ) &&
    cacheRebuildPreflightReceipt.includes(
      'receipt_status: "metadata-only-dry-run"'
    ) &&
    cacheRebuildPreflightReceipt.includes("cloud_manifest_is_source_of_truth") &&
    cacheRebuildPreflightReceipt.includes("local_pending_edits_block_rebuild") &&
    cacheRebuildPreflightReceipt.includes("fileStatus: PendingFileEmbedSyncStatus") &&
    cacheRebuildPreflightReceipt.includes("file_pending_rows") &&
    cacheRebuildPreflightReceipt.includes("file_failed_rows") &&
    cacheRebuildPreflightReceipt.includes("file_manual_review_rows") &&
    cacheRebuildPreflightReceipt.includes("clears_local_cache: false") &&
    cacheRebuildPreflightReceipt.includes("uploads_workspace_data: false") &&
    cacheRebuildPreflightReceipt.includes(
      "includes_only_counts_watermarks_hashes_and_gates: true"
    ),
  "同步页应提供缓存重建安全入口和 metadata-only dry-run 预检收据：先展示 pending/manifest 风险，再跳转账号页确认重建，不能在同步页直接清缓存"
);
check(
  syncDashboardShell.includes("SyncLocalUseReadinessPanel") &&
    syncDashboardShell.includes("buildAccountLocalUseReadiness") &&
    syncDashboardShell.includes("summarizeSyncSummaryTables(syncSummary") &&
    syncDashboardShell.includes('"workspace_settings"') &&
    syncDashboardShell.includes('"page_comments"') &&
    syncDashboardShell.includes("settingsPendingTotal: settingsWaiting") &&
    syncDashboardShell.includes("knowledgePendingTotal: knowledgeWaiting") &&
    syncDashboardShell.includes("@/lib/sync/syncPendingDomainRegistry") &&
    syncDashboardShell.includes('id="sync-local-use-readiness-panel"') &&
    syncDashboardShell.includes('data-testid="sync-local-use-readiness-panel"') &&
    syncDashboardShell.includes("data-local-use-status={readiness.status}") &&
    syncDashboardShell.includes(
      "data-local-input-can-continue={String(readiness.localInputCanContinue)}"
    ) &&
    syncDashboardShell.includes(
      "data-cloud-handoff-ready={String(readiness.cloudHandoffReady)}"
    ) &&
    syncDashboardShell.includes(
      "data-cache-rebuild-blocked={String(readiness.cacheRebuildBlocked)}"
    ) &&
    syncDashboardShell.includes("pendingDomainRows={pendingDomainRows}") &&
    syncDashboardShell.includes("pendingDomainCoverage={pendingDomainCoverage}") &&
    (syncDashboardShell.includes(
      "buildPendingDomainRows(\n        syncSummary,\n        pagePendingStatus,\n        databasePendingStatus\n      )"
    ) ||
      syncDashboardShell.includes(
        "buildPendingDomainRows(\n        syncSummary,\n        pagePendingStatus,\n        databasePendingStatus,\n        fileEmbedPendingStatus\n      )"
      )) &&
    syncPendingDomainRegistry.includes("PENDING_DOMAIN_DEFINITIONS") &&
    syncPendingDomainRegistry.includes("buildPendingDomainCoverageReport") &&
    syncPendingDomainRegistry.includes("mergeCorePendingDomainRows") &&
    syncPendingDomainRegistry.includes(
      "pageStatus.pending + pageStatus.queued + syncLogPending"
    ) &&
    syncPendingDomainRegistry.includes(
      "databaseStatus.pending +\n          databaseStatus.queued +\n          syncLogPending"
    ) &&
    syncPendingDomainRegistry.includes("fileStatus.pending") &&
    syncPendingDomainRegistry.includes("file_embed_sync_queue") &&
    syncDashboardShell.includes("file-embed-pending-upload-queue") &&
    syncDashboardShell.includes(
      "data-monitored-sync-domain-count={monitoredDomainRows.length}"
    ) &&
    syncDashboardShell.includes(
      'data-monitored-sync-domain-labels={monitoredDomainLabels.join(",")}'
    ) &&
    syncDashboardShell.includes(
      "data-sync-domain-coverage-complete={String("
    ) &&
    syncDashboardShell.includes(
      "data-missing-registered-sync-domain-count={"
    ) &&
    syncDashboardShell.includes("sync-domain-coverage-warning") &&
    syncDashboardShell.includes("同步域覆盖不完整") &&
    syncDashboardShell.includes(
      "data-active-sync-domain-count={activeDomainRows.length}"
    ) &&
    syncDashboardShell.includes(
      'data-active-sync-domain-labels={activeDomainLabels.join(",")}'
    ) &&
    syncDashboardShell.includes("本地可继续使用") &&
    syncDashboardShell.includes("云端交接") &&
    syncDashboardShell.includes("缓存重建") &&
    syncDashboardShell.includes("监控同步域") &&
    syncDashboardShell.includes("monitoredDomainRows") &&
    syncDashboardShell.includes('row.id !== "other"') &&
    syncDashboardShell.includes("全域队列") &&
    syncDashboardShell.includes("暂无全域 pending") &&
    syncDashboardShell.includes("下一步：{row.nextAction}") &&
    syncPendingDomainRegistry.includes("先补传页面输入；本地写作可以继续。") &&
    syncPendingDomainRegistry.includes("先补传数据库变更；本地编辑可以继续。") &&
    syncDashboardShell.includes("补传全部本地输入") &&
    syncDashboardShell.includes("不读取页面正文、数据库行值、文件 bytes"),
  "同步中心应在上传安全总览前展示本地可继续使用、云端交接、缓存重建阻断、监控同步域、核心兜底队列和全域 pending 域分布，并保持 metadata-only 边界"
);
check(
  syncDashboardShell.includes("SyncOperationalStatusStrip") &&
    syncDashboardShell.includes('id="sync-operational-status-strip"') &&
    syncDashboardShell.includes(
      'data-testid="sync-operational-status-strip"'
    ) &&
    syncDashboardShell.includes(
      'id="sync-log-visibility-section"'
    ) &&
    syncDashboardShell.includes(
      'data-testid="sync-log-visibility-section"'
    ) &&
    syncDashboardShell.includes("当前使用安全") &&
    syncDashboardShell.includes("可以继续写") &&
    syncDashboardShell.includes("补传待上传") &&
    syncDashboardShell.includes("查看详细队列") &&
    syncDashboardShell.includes("getSidebarReadinessMirrorLabel") &&
    syncDashboardShell.includes("getSidebarReadinessMirrorDetail") &&
    syncDashboardShell.includes('data-testid="sync-sidebar-readiness-mirror"') &&
    syncDashboardShell.includes(
      'data-testid="sync-local-performance-readiness-note"'
    ) &&
    syncDashboardShell.includes(
      "data-local-performance-status={performanceDiagnosis.status}"
    ) &&
    syncDashboardShell.includes(
      "performanceDiagnosis={localPerformanceDiagnosis}"
    ) &&
    syncDashboardShell.includes("本机流畅度") &&
    syncDashboardShell.includes(
      "data-sidebar-readiness-next-action={readiness.nextAction}"
    ) &&
    syncDashboardShell.includes("左侧状态") &&
    syncDashboardShell.includes("本地可写") &&
    syncDashboardShell.includes("先别重建缓存") &&
    syncDashboardShell.includes("可云端交接") &&
    syncDashboardShell.includes("优先查看的数据域") &&
    syncDashboardShell.includes("云端交接：") &&
    syncDashboardShell.includes("getPendingDomainAction") &&
    syncDashboardShell.includes("导出复核包") &&
    syncDashboardShell.includes("补传页面") &&
    syncDashboardShell.includes("补传数据库") &&
    syncDashboardShell.includes(
      'data-testid={`sync-pending-domain-action-${row.id}`}'
    ) &&
    syncDashboardShell.includes(
      "data-pending-domain-action-label={domainAction.label}"
    ) &&
    syncDashboardShell.includes(
      "onRetryPage={() => void handleRetryPagePendingPush()}"
    ) &&
    syncDashboardShell.includes(
      "onRetryDatabase={() => void handleRetryDatabasePendingPush()}"
    ) &&
    syncDashboardShell.includes(
      "onExportManualReview={handleExportSyncManualReviewPacket}"
    ) &&
    syncDashboardShell.includes("不读取正文、数据库值或文件内容") &&
    syncDashboardShell.includes(
      "data-local-input-can-continue={String(readiness.localInputCanContinue)}"
    ) &&
    syncDashboardShell.includes(
      "data-cache-rebuild-blocked={String(readiness.cacheRebuildBlocked)}"
    ) &&
    syncDashboardShell.includes(
      "authRetryDomainLabel={syncLocalUseQueueSnapshot.authRetryDomainLabel}"
    ) &&
    syncDashboardShell.includes(
      "authRetryStatusLabel={syncLocalUseQueueSnapshot.authRetryStatusLabel}"
    ) &&
    syncDashboardShell.includes(
      "authRetryDetail={syncLocalUseQueueSnapshot.authRetryDetail}"
    ) &&
    syncDashboardShell.includes(
      'if (status === "unconfirmed") return "账号临时不可确认";'
    ) &&
    syncDashboardShell.includes("formatSyncAuthRetryStatus") &&
    syncDashboardShell.includes(
      "authRetryUntilLabel={syncLocalUseQueueSnapshot.authRetryUntilLabel}"
    ) &&
    syncDashboardShell.includes('data-testid="sync-auth-retry-local-use-note"') &&
    syncDashboardShell.includes(
      'data-auth-retry-local-input-can-continue="true"'
    ) &&
    syncDashboardShell.includes("账号会话暂时无法确认") &&
    syncDashboardShell.includes("本地输入可以继续") &&
    syncDashboardShell.includes("不会因为临时无法确认账号就自动登出") &&
    syncDashboardShell.includes(
      "data-auth-retry-active={Boolean(authRetryDomainLabel)}"
    ) &&
    syncDashboardShell.includes(
      "data-auth-retry-domains={authRetryDomainLabel}"
    ) &&
    syncDashboardShell.includes(
      "data-auth-retry-statuses={authRetryStatusLabel}"
    ) &&
    syncDashboardShell.includes(
      'data-auth-retry-until={authRetryUntilLabel ?? ""}'
    ),
  "同步中心顶部应提供 P0 使用安全状态条：一眼显示能否继续写、待上传/失败/人工处理、账号重试、缓存重建阻断和详细队列入口"
);
check(
  syncDashboardShell.indexOf("<SyncOperationalStatusStrip") >= 0 &&
    syncDashboardShell.indexOf("<CloudAlphaPanel") >= 0 &&
    syncDashboardShell.indexOf("<SyncOperationalStatusStrip") <
      syncDashboardShell.indexOf("<CloudAlphaPanel"),
  "同步中心首屏应先显示当前使用安全状态，再显示云登录/Cloud Alpha 配置，避免用户误以为必须先处理云配置才能继续写作"
);
check(
  syncDashboardShell.includes('id="cloud-alpha-panel"') &&
    syncDashboardShell.includes('data-testid="cloud-alpha-panel"'),
  "Cloud Alpha 配置面板应有稳定 test id，方便只读 UI 检查确认它排在使用安全状态之后"
);
check(
  syncDashboardShell.includes("getCloudAlphaConfigMetric") &&
    syncDashboardShell.includes("environmentPreflight={environmentPreflight}") &&
    syncDashboardShell.includes(
      "environmentPreflightError={environmentPreflightError}"
    ) &&
    syncDashboardShell.includes("只读受限") &&
    syncDashboardShell.includes("账号可试") &&
    syncDashboardShell.includes("公开布尔安全开关是否已明确打开") &&
    syncDashboardShell.includes('status === "present-disabled"'),
  "Cloud Alpha 应展示真实环境预检状态，区分变量存在、开关未打开、账号可试和完整 Beta 缺口"
);
check(
  syncDashboardShell.includes("DevelopmentStabilityPlanPanel") &&
    syncDashboardShell.includes("buildDevelopmentStabilityPlan") &&
    syncDashboardShell.includes("syncLocalUseQueueSnapshot") &&
    syncDashboardShell.includes("pagePendingStatus.authRetryStatus") &&
    syncDashboardShell.includes("databasePendingStatus.authRetryStatus") &&
    syncDashboardShell.includes("authRetryDomainLabel") &&
    syncDashboardShell.includes("authRetryUntilLabel") &&
    syncDashboardShell.includes('id="development-stability-plan-panel"') &&
    syncDashboardShell.includes(
      'data-testid="development-stability-plan-panel"'
    ) &&
    syncDashboardShell.includes(
      "data-development-channel={plan.development_channel}"
    ) &&
    syncDashboardShell.includes(
      "data-local-app-can-continue={String(plan.local_app_can_continue_now)}"
    ) &&
    syncDashboardShell.includes(
      "const operatingMode = plan.stable_use_operating_mode;"
    ) &&
    syncDashboardShell.includes(
      'data-testid="development-stability-operating-mode"'
    ) &&
    syncDashboardShell.includes(
      "data-user-can-continue-work={String(operatingMode.user_can_continue_work)}"
    ) &&
    syncDashboardShell.includes(
      "data-active-development-can-continue={String("
    ) &&
    syncDashboardShell.includes(
      "data-production-interruptions-should-be-batched={String("
    ) &&
    syncDashboardShell.includes(
      "data-experimental-changes-go-to-staging-first={String("
    ) &&
    syncDashboardShell.includes(
      "data-account-session-must-not-be-cleared-by-sync-failures={String("
    ) &&
    syncDashboardShell.includes(
      "data-sync-failures-show-retry-state-not-sign-out={String("
    ) &&
    syncDashboardShell.includes(
      "data-safe-route-count={operatingMode.safe_to_use_routes.length}"
    ) &&
    syncDashboardShell.includes("稳定使用模式") &&
    syncDashboardShell.includes("继续使用当前入口") &&
    syncDashboardShell.includes("同步失败不登出") &&
    syncDashboardShell.includes("实验改动先本地 / staging") &&
    syncDashboardShell.includes("线上变更成批进入") &&
    syncDashboardShell.includes(
      "data-route-smoke-protected-entrypoints="
    ) &&
    syncDashboardShell.includes(
      "data-stable-use-guarantees={plan.summary.stable_use_guarantees}"
    ) &&
    syncDashboardShell.includes("开发期稳定使用计划") &&
    syncDashboardShell.includes("Private Alpha 稳定使用区") &&
    syncDashboardShell.includes("交互保障") &&
    syncDashboardShell.includes(
      "const visibleStableEntrypoints = plan.stable_use_entrypoints;"
    ) &&
    syncDashboardShell.includes("稳定入口") &&
    syncDashboardShell.includes("实验区") &&
    syncDashboardShell.includes("item.guarantees.slice(0, 3)") &&
    syncDashboardShell.includes("pending / failed / manual review 计数") &&
    syncDashboardShell.includes("不读取页面正文、数据库行值、文件 names、文件 bytes"),
  "同步中心应展示开发期稳定使用计划，把稳定入口、实验区、高风险 gate 和本地可继续状态放在一个 metadata-only 卡片里"
);
check(
  syncDashboardShell.includes("SYNC_LOG_STATUS_STORAGE_KEY") &&
    syncDashboardShell.includes("SETTINGS_SYNC_STATUS_STORAGE_KEY") &&
    syncDashboardShell.includes("KNOWLEDGE_SYNC_STATUS_STORAGE_KEY") &&
    syncDashboardShell.includes("function isSyncStatusStorageEvent(") &&
    syncDashboardShell.includes("event.key === SYNC_LOG_STATUS_STORAGE_KEY") &&
    syncDashboardShell.includes("event.key === SETTINGS_SYNC_STATUS_STORAGE_KEY") &&
    syncDashboardShell.includes("event.key === KNOWLEDGE_SYNC_STATUS_STORAGE_KEY") &&
    syncDashboardShell.includes("isSyncStatusStorageEvent(event)"),
  "同步中心全域队列快照必须监听 content-free 跨 tab sync/status 时间戳，避免 settings、knowledge 或全域 sync_log 变化只能等轮询"
);
check(
  developmentStabilityPlan.includes(
    'format: "zhinote-development-stability-plan"'
  ) &&
    developmentStabilityPlan.includes(
      'development_channel: "private-alpha-stable-use"'
    ) &&
    developmentStabilityPlan.includes("stable_use_entrypoints") &&
    developmentStabilityPlan.includes("stable_use_operating_mode") &&
    developmentStabilityPlan.includes("DevelopmentStabilityOperatingMode") &&
    developmentStabilityPlan.includes("active_development_can_continue") &&
    developmentStabilityPlan.includes("production_interruptions_should_be_batched") &&
    developmentStabilityPlan.includes("experimental_changes_go_to_staging_first") &&
    developmentStabilityPlan.includes("local_input_remains_available") &&
    developmentStabilityPlan.includes("local_pending_queue_preserved_during_development") &&
    developmentStabilityPlan.includes("account_session_must_not_be_cleared_by_sync_failures") &&
    developmentStabilityPlan.includes("sync_failures_show_retry_state_not_sign_out") &&
    developmentStabilityPlan.includes("同步失败只显示重试状态，不自动登出或影响本地输入") &&
    developmentStabilityPlan.includes("safe_to_use_routes") &&
    developmentStabilityPlan.includes("blocked_without_owner_gate") &&
    developmentStabilityPlan.includes("stable_use_guarantees") &&
    developmentStabilityPlan.includes("guarded_entrypoints") &&
    developmentStabilityPlan.includes("experimental_surfaces") &&
    developmentStabilityPlan.includes("route_smoke_protected_entrypoints") &&
    developmentStabilityPlan.includes("high_risk_actions_gated") &&
    developmentStabilityPlan.includes("enable_sync_push") &&
    developmentStabilityPlan.includes("cache_rebuild_from_cloud") &&
    developmentStabilityPlan.includes("bulk_import_apply") &&
    developmentStabilityPlan.includes("ai_execution") &&
    developmentStabilityPlan.includes("reads_page_body_text: false") &&
    developmentStabilityPlan.includes("reads_database_row_values: false") &&
    developmentStabilityPlan.includes("reads_file_names: false") &&
    developmentStabilityPlan.includes("reads_file_bytes: false") &&
    developmentStabilityPlan.includes("uploads_workspace_data: false") &&
    developmentStabilityPlan.includes("clears_local_cache: false") &&
    developmentStabilityPlan.includes("enables_sync: false") &&
    developmentStabilityPlan.includes("enables_ai: false") &&
    developmentStabilityPlan.includes("接口临时失败不等于登出") &&
    developmentStabilityPlan.includes("会议导入后即时进入日历") &&
    developmentStabilityPlan.includes("pending / failed / manual review 可见") &&
    developmentStabilityPlan.includes("页面壳先显示本地 handoff") &&
    developmentStabilityPlan.includes("/daily") &&
    developmentStabilityPlan.includes("/schedule") &&
    developmentStabilityPlan.includes("/modules/databases") &&
    developmentStabilityPlan.includes("/knowledge-base") &&
    developmentStabilityPlan.includes("/industry-chain"),
  "开发期稳定使用计划必须只读 route catalog 和同步队列计数，并明确稳定入口、实验入口和高风险动作 gate"
);

const sidebar = read("src/components/sidebar/Sidebar.tsx");
check(
  accountCloudSyncCoordinator.includes("usePageCloudSync") &&
    accountCloudSyncCoordinator.includes("useDatabaseCloudSync") &&
    accountCloudSyncCoordinator.includes("useSettingsCloudSyncStatus") &&
    accountCloudSyncCoordinator.includes("useKnowledgeCloudSyncStatus") &&
    accountCloudSyncCoordinator.includes("useGlobalSyncLogStatus") &&
    accountCloudSyncCoordinator.includes("refreshGlobalSyncLogStatus") &&
    accountCloudSyncCoordinator.includes("await refreshGlobalSyncLogStatus();") &&
    accountCloudSyncCoordinator.includes("forceAccountGate?: boolean") &&
    accountCloudSyncCoordinator.includes("includeFileSync?: boolean") &&
    accountCloudSyncCoordinator.includes("options.includeFileSync ?? true") &&
    accountCloudSyncCoordinator.includes(
      "forceAccountGate: options.forceAccountGate"
    ) &&
    accountCloudSyncCoordinator.includes(
      'forceAccountGate: state === "error" || syncBlockedBySignedOut'
    ) &&
    accountCloudSyncCoordinator.includes("includeFileSync: false") &&
    accountCloudSyncCoordinator.includes("COORDINATOR_PENDING_DRAIN_DELAY_MS") &&
    accountCloudSyncCoordinator.includes(
      "COORDINATOR_ACCOUNT_UNCERTAIN_RETRY_DELAY_MS"
    ) &&
    accountCloudSyncCoordinator.includes("COORDINATOR_SIGNED_OUT_RETRY_DELAY_MS") &&
    accountCloudSyncCoordinator.includes("Promise.allSettled") &&
    accountCloudSyncCoordinator.includes("pendingTotal") &&
    accountCloudSyncCoordinator.includes("settingsPendingTotal") &&
    accountCloudSyncCoordinator.includes("knowledgePendingTotal") &&
    accountCloudSyncCoordinator.includes("globalSyncLogExtraPendingTotal") &&
    accountCloudSyncCoordinator.includes(
      "(pageSync.pendingStatus.syncLogPending ?? 0) +"
    ) &&
    accountCloudSyncCoordinator.includes("globalSyncLogExtraManualReviewTotal") &&
    accountCloudSyncCoordinator.includes("manualReviewTotal") &&
    accountCloudSyncCoordinator.includes("pageRetryableFailedTotal") &&
    accountCloudSyncCoordinator.includes("databaseRetryableFailedTotal") &&
    accountCloudSyncCoordinator.includes(
      "const fileRetryableFailedTotal = fileSync.status.failed"
    ) &&
    accountCloudSyncCoordinator.includes("settingsRetryableFailedTotal") &&
    accountCloudSyncCoordinator.includes("knowledgeRetryableFailedTotal") &&
    accountCloudSyncCoordinator.includes(
      "globalSyncLogExtraRetryableFailedTotal"
    ) &&
    !accountCloudSyncCoordinator.includes(
      "const retryableFailedTotal = Math.max(failedTotal - manualReviewTotal, 0)"
    ) &&
    accountCloudSyncCoordinator.includes("pageVisibleSyncWork") &&
    accountCloudSyncCoordinator.includes("databaseVisibleSyncWork") &&
    accountCloudSyncCoordinator.includes("settingsVisibleSyncWork") &&
    accountCloudSyncCoordinator.includes("knowledgeVisibleSyncWork") &&
    accountCloudSyncCoordinator.includes("globalSyncLogVisibleSyncWork") &&
    accountCloudSyncCoordinator.includes("pageAutoRetryableFailedTotal") &&
    accountCloudSyncCoordinator.includes("databaseAutoRetryableFailedTotal") &&
    accountCloudSyncCoordinator.includes("autoRetryableSyncWorkTotal") &&
    accountCloudSyncCoordinator.includes("retryableFailedTotal") &&
    accountCloudSyncCoordinator.includes("enabledDomainCount") &&
    accountCloudSyncCoordinator.includes("filePendingTotal") &&
    accountCloudSyncCoordinator.includes("fileFailedTotal: fileSync.status.failed") &&
    accountCloudSyncCoordinator.includes(
      "fileManualReviewTotal: fileSync.status.manualReviewCount"
    ) &&
    accountCloudSyncCoordinator.includes(
      "pageSync.pendingStatus.authRetryStatus"
    ) &&
    accountCloudSyncCoordinator.includes(
      "databaseSync.pendingStatus.authRetryStatus"
    ) &&
    accountCloudSyncCoordinator.includes("fileSync.status.authRetryStatus") &&
    accountCloudSyncCoordinator.includes("fileSync.status.authRetryUntil") &&
    accountCloudSyncCoordinator.includes("authRetryDomainLabel") &&
    accountCloudSyncCoordinator.includes("authRetryUntilLabel") &&
    accountCloudSyncCoordinator.includes("账号重试 ") &&
    accountCloudSyncCoordinator.includes("authRetryActive: Boolean(authRetryDomainLabel)") &&
    accountCloudSyncCoordinator.includes("authRetryDomainLabel,") &&
    accountCloudSyncCoordinator.includes("authRetryUntilLabel,") &&
    accountCloudSyncCoordinator.includes("buildAccountLocalUseReadiness") &&
    accountCloudSyncCoordinator.includes('"checking"') &&
    accountCloudSyncCoordinator.includes("initializingEnabledDomain") &&
    accountCloudSyncCoordinator.includes("const syncBlockedBySignedOut =") &&
    accountCloudSyncCoordinator.indexOf("pendingTotal > 0\n              ? \"queued\"") <
      accountCloudSyncCoordinator.indexOf("syncBlockedBySignedOut\n                ? \"signed-out\"") &&
    accountCloudSyncCoordinator.includes("账号云同步正在检查") &&
    accountCloudSyncCoordinator.includes("本地输入已保留，会低频检查登录状态") &&
    accountCloudSyncCoordinator.includes("账号云同步暂不可确认，低频重试；本地输入已保留") &&
    accountCloudSyncCoordinator.includes("syncNow"),
  "账号级云同步协调器应统一页面/数据库/设置/知识库附属/全域 sync_log 同步状态，区分初始化检查和已同步，并提供合并 quick sync 入口；可重试失败必须按领域计算，文件 failed 不能被其他领域 manual review 抵消"
);
check(
  sidebar.includes(
    "accountSync.syncNow({ forceLease: true, forceAccountGate: true });"
  ),
  "侧边栏手动快速同步必须强制重新确认账号状态，不能被页面/数据库同步的认证退避挡住"
);
check(
  visibleRefreshLease.includes("export function claimVisibleRefreshLease") &&
    visibleRefreshLease.includes("localOwners") &&
    visibleRefreshLease.includes("window.localStorage.getItem(storageKey)") &&
    visibleRefreshLease.includes("lease.owner !== owner") &&
    visibleRefreshLease.includes("lease.until > now") &&
    visibleRefreshLease.includes("JSON.stringify({ owner, until: now + ttlMs })") &&
    visibleRefreshLease.includes("return true;"),
  "可见 tab 状态刷新租约必须使用本地 lease 合并重复轮询；localStorage 不可用时保持当前 tab 可刷新"
);
check(
  settingsCloudSyncStatusHook.includes("claimVisibleRefreshLease") &&
    settingsCloudSyncStatusHook.includes(
      "SETTINGS_STATUS_REFRESH_LEASE_KEY"
    ) &&
    settingsCloudSyncStatusHook.includes(
      "SETTINGS_STATUS_REFRESH_LEASE_TTL_MS"
    ) &&
    settingsCloudSyncStatusHook.includes(
      "claimVisibleRefreshLease(\n          SETTINGS_STATUS_REFRESH_LEASE_KEY"
    ) &&
    settingsCloudSyncStatusHook.includes("const mountedRef = useRef(false)") &&
    settingsCloudSyncStatusHook.includes("setStatusIfMounted") &&
    settingsCloudSyncStatusHook.includes("mountedRef.current = false") &&
    knowledgeCloudSyncStatusHook.includes("claimVisibleRefreshLease") &&
    knowledgeCloudSyncStatusHook.includes(
      "KNOWLEDGE_STATUS_REFRESH_LEASE_KEY"
    ) &&
    knowledgeCloudSyncStatusHook.includes(
      "KNOWLEDGE_STATUS_REFRESH_LEASE_TTL_MS"
    ) &&
    knowledgeCloudSyncStatusHook.includes(
      "claimVisibleRefreshLease(\n          KNOWLEDGE_STATUS_REFRESH_LEASE_KEY"
    ) &&
    knowledgeCloudSyncStatusHook.includes("const mountedRef = useRef(false)") &&
    knowledgeCloudSyncStatusHook.includes("setStatusIfMounted") &&
    knowledgeCloudSyncStatusHook.includes("mountedRef.current = false"),
  "设置和知识库 sync_log 状态周期刷新必须由一个可见 tab 持有租约，且卸载后不能再写入状态，避免多 tab 重复扫本地队列或页面切换时状态抖动"
);
check(
  globalSyncLogStatusHook.includes("getSyncLogSummary") &&
    globalSyncLogStatusHook.includes(
      "GLOBAL_SYNC_LOG_STATUS_FAST_REFRESH_DELAYS_MS"
    ) &&
    globalSyncLogStatusHook.includes("claimVisibleRefreshLease") &&
    globalSyncLogStatusHook.includes(
      "GLOBAL_SYNC_LOG_STATUS_REFRESH_LEASE_KEY"
    ) &&
    globalSyncLogStatusHook.includes(
      "GLOBAL_SYNC_LOG_STATUS_REFRESH_LEASE_TTL_MS"
    ) &&
    globalSyncLogStatusHook.includes("scheduleFastRefreshBurst") &&
    globalSyncLogStatusHook.includes("clearFastRefreshBurst") &&
    globalSyncLogStatusHook.includes("refreshNowAndThen") &&
    globalSyncLogStatusHook.includes("SYNC_LOG_STATUS_EVENT") &&
    globalSyncLogStatusHook.includes("SYNC_LOG_STATUS_STORAGE_KEY") &&
    globalSyncLogStatusHook.includes('window.addEventListener("storage", handleStorage)') &&
    globalSyncLogStatusHook.includes('window.removeEventListener("storage", handleStorage)') &&
    globalSyncLogStatusHook.includes("event.key !== SYNC_LOG_STATUS_STORAGE_KEY") &&
    globalSyncLogStatusHook.includes(
      "claimVisibleRefreshLease(\n                GLOBAL_SYNC_LOG_STATUS_REFRESH_LEASE_KEY"
    ) &&
    globalSyncLogStatusHook.includes(
      "claimVisibleRefreshLease(\n          GLOBAL_SYNC_LOG_STATUS_REFRESH_LEASE_KEY"
    ) &&
    !globalSyncLogStatusHook.includes(
      "event.key !== SYNC_LOG_STATUS_STORAGE_KEY || !event.newValue"
    ) &&
    globalSyncLogStatusHook.includes("reads_sync_log_payloads: false") &&
    globalSyncLogStatusHook.includes("uploads_workspace_data: false") &&
    globalSyncLogStatusHook.includes("mutates_sync_log: false") &&
    globalSyncLogStatusHook.includes("const mountedRef = useRef(false)") &&
    globalSyncLogStatusHook.includes("setStatusIfMounted") &&
    globalSyncLogStatusHook.includes("mountedRef.current = false"),
  "全域 sync_log 状态 hook 必须只读本地队列元数据，并监听 content-free sync_log 状态事件和跨 tab 提醒；状态 key 被清空时也要刷新，避免 pending/failed 清零后 UI 卡旧状态；周期刷新和快速 burst 必须由可见 tab 租约合并，且卸载后不能再写入状态"
);
check(
  accountLocalUseReadiness.includes("localInputCanContinue: true") &&
    accountLocalUseReadiness.includes("cloudHandoffReady") &&
    accountLocalUseReadiness.includes("cacheRebuildBlocked") &&
    accountLocalUseReadiness.includes("queueBreakdown") &&
    accountLocalUseReadiness.includes("AccountLocalUseQueueBreakdown") &&
    accountLocalUseReadiness.includes("filePendingTotal") &&
    accountLocalUseReadiness.includes("fileFailedTotal") &&
    accountLocalUseReadiness.includes("fileManualReviewTotal") &&
    accountLocalUseReadiness.includes("fileQueueBlocksCloudHandoff") &&
    accountLocalUseReadiness.includes("formatAuthRetryDetail") &&
    accountLocalUseReadiness.includes("authRetryDomainLabel") &&
    accountLocalUseReadiness.includes("authRetryUntilLabel") &&
    accountLocalUseReadiness.includes("账号重试：") &&
    accountLocalUseReadiness.includes("reads_page_body_text: false") &&
    accountLocalUseReadiness.includes("reads_database_row_values: false") &&
    accountLocalUseReadiness.includes("reads_file_bytes: false") &&
    accountLocalUseReadiness.includes("uploads_workspace_data: false") &&
    accountLocalUseReadiness.includes("mutates_workspace_data: false") &&
    accountLocalUseReadiness.includes('"checking"') &&
    accountLocalUseReadiness.includes("可继续写作，先处理同步队列") &&
    accountLocalUseReadiness.includes("可继续写作，等待上传") &&
    accountLocalUseReadiness.includes("可继续写作，云端暂不可确认") &&
    accountLocalUseReadiness.includes("可继续写作，云端交接已就绪") &&
    accountLocalUseReadiness.includes("文件队列：") &&
    accountLocalUseReadiness.includes("清零前不要重建本地缓存或做云端交接"),
  "账号本地可用性判定应是共享 metadata-only 规则，侧边栏和同步中心必须复用同一套可继续输入、云端交接和缓存重建阻断口径"
);
check(
  accountCloudSyncCoordinator.includes("pageSync.pendingStatus.failed > 0") &&
    accountCloudSyncCoordinator.includes(
      "pageSync.pendingStatus.manualReviewCount > 0"
    ) &&
    accountCloudSyncCoordinator.includes("databaseSync.pendingStatus.failed > 0") &&
    accountCloudSyncCoordinator.includes(
      "databaseSync.pendingStatus.manualReviewCount > 0"
    ) &&
    accountCloudSyncCoordinator.includes("settingsSync.status.failed > 0") &&
    accountCloudSyncCoordinator.includes(
      "settingsSync.status.manualReviewCount > 0"
    ) &&
    accountCloudSyncCoordinator.includes("knowledgeSync.status.failed > 0") &&
    accountCloudSyncCoordinator.includes(
      "knowledgeSync.status.manualReviewCount > 0"
    ),
	  "账号级云同步协调器必须把 pending、failed 和 manual review 都计入可见状态，不能因同步域关闭而隐藏待处理队列"
	);
check(
  accountCloudSyncCoordinator.includes(
    "autoRetryableSyncWorkTotal <= 0"
  ) &&
    accountCloudSyncCoordinator.includes(
      "pageSync.pendingStatus.pending -"
    ) &&
    accountCloudSyncCoordinator.includes(
      "databaseSync.pendingStatus.pending -"
    ),
  "账号级云同步协调器后台自动补传只能看可自动重试队列，manual review 项必须保持可见但不能触发后台循环重试"
);
const accountCoordinatorAutoRetryEffect =
  accountCloudSyncCoordinator.match(
    /useEffect\(\(\) => \{[\s\S]*?autoRetryableSyncWorkTotal[\s\S]*?syncBlockedBySignedOut[\s\S]*?\}, \[[\s\S]*?syncBlockedBySignedOut[\s\S]*?\]\);/
  )?.[0] ?? "";
check(
  accountCoordinatorAutoRetryEffect.includes("state === \"syncing\"") &&
    !accountCoordinatorAutoRetryEffect.includes(
      "state === \"signed-out\"\n    )"
    ) &&
    accountCoordinatorAutoRetryEffect.includes(
      "syncBlockedBySignedOut\n        ? COORDINATOR_SIGNED_OUT_RETRY_DELAY_MS"
    ) &&
    accountCoordinatorAutoRetryEffect.includes(
      "state === \"error\"\n          ? COORDINATOR_ACCOUNT_UNCERTAIN_RETRY_DELAY_MS"
    ) &&
    accountCoordinatorAutoRetryEffect.includes(": COORDINATOR_PENDING_DRAIN_DELAY_MS") &&
    accountCoordinatorAutoRetryEffect.includes("includeFileSync: false") &&
    accountCoordinatorAutoRetryEffect.includes("}, retryDelayMs)"),
  "账号级云同步协调器不能把 signed-out 当成有待上传队列时的终止态；有可自动重试内容时应优先显示 queued，同时对未登录/账号不确定状态低频检查，避免本地 pending 队列卡死或高频扰动前台；文件上传不能被该后台循环带跑"
);
const accountAutoRetryableSyncWorkBlock =
  accountCloudSyncCoordinator.match(
    /const autoRetryableSyncWorkTotal =[\s\S]*?;/
  )?.[0] ?? "";
check(
  accountCloudSyncCoordinator.includes("syncCenterVisibleOnlyPendingTotal") &&
    accountAutoRetryableSyncWorkBlock.includes(
      "pageAutoRetryablePendingTotal"
    ) &&
    accountAutoRetryableSyncWorkBlock.includes(
      "databaseAutoRetryablePendingTotal"
    ) &&
    accountAutoRetryableSyncWorkBlock.includes(
      "pageAutoRetryableFailedTotal"
    ) &&
    accountAutoRetryableSyncWorkBlock.includes(
      "databaseAutoRetryableFailedTotal"
    ) &&
    !accountAutoRetryableSyncWorkBlock.includes(
      "settingsAutoRetryablePendingTotal"
    ) &&
    !accountAutoRetryableSyncWorkBlock.includes(
      "knowledgeAutoRetryablePendingTotal"
    ) &&
    !accountAutoRetryableSyncWorkBlock.includes(
      "globalSyncLogExtraPendingTotal"
    ),
  "账号级自动补传只能驱动页面/数据库当前可执行队列；设置、知识库附属和其他 sync_log 队列必须只显示并交给同步中心处理，避免后台无效循环"
);
check(
  accountCloudSyncCoordinator.indexOf("manualReviewTotal > 0 || failedTotal > 0") <
    accountCloudSyncCoordinator.indexOf(
      'pageSync.state === "error" || databaseSync.state === "error"'
    ),
  "账号级云同步协调器必须优先显示失败/人工处理队列，不能被临时接口错误盖住"
);
check(
  settingsCloudSyncStatusHook.includes(
    "getPendingWorkspaceSettingSyncLogEntries"
  ) &&
    settingsCloudSyncStatusHook.includes(
      "getPendingAccountModuleSettingSyncLogEntries"
    ) &&
    settingsCloudSyncStatusHook.includes("SETTINGS_SYNC_STATUS_EVENT") &&
    settingsCloudSyncStatusHook.includes("SETTINGS_SYNC_STATUS_STORAGE_KEY") &&
    settingsCloudSyncStatusHook.includes('window.addEventListener("storage", handleStorage)') &&
    settingsCloudSyncStatusHook.includes('window.removeEventListener("storage", handleStorage)') &&
    settingsCloudSyncStatusHook.includes("event.key !== SETTINGS_SYNC_STATUS_STORAGE_KEY") &&
    !settingsCloudSyncStatusHook.includes(
      "event.key !== SETTINGS_SYNC_STATUS_STORAGE_KEY || !event.newValue"
    ) &&
    settingsCloudSyncStatusHook.includes(
      "summarizeSettingsCloudSyncStatus"
    ) &&
    settingsCloudSyncStatusHook.includes(
      "SETTINGS_STATUS_REFRESH_INTERVAL_MS"
    ),
  "设置类云同步状态 hook 应只读 settings sync_log 元数据，并用事件/轮询刷新全局 pending 状态；状态 key 被清空时也要刷新，避免设置队列清零后 UI 卡旧状态"
);
check(
  settingsSyncStatus.includes("SETTINGS_SYNC_STATUS_EVENT") &&
    settingsSyncStatus.includes('SETTINGS_SYNC_STATUS_STORAGE_KEY =') &&
    settingsSyncStatus.includes("window.localStorage.setItem(") &&
    settingsSyncStatus.includes("never setting values or sync payloads") &&
    settingsSyncStatus.includes("reads_sync_log_metadata: true") &&
    settingsSyncStatus.includes("reads_workspace_settings_values: false") &&
    settingsSyncStatus.includes("reads_account_settings_values: false") &&
    settingsSyncStatus.includes("reads_module_settings_values: false") &&
    settingsSyncStatus.includes("uploads_workspace_data: false") &&
    settingsSyncStatus.includes("mutates_sync_log: false") &&
    settingsSyncStatus.includes("manualReviewSampleRowIds"),
  "设置类同步状态必须只暴露 sync_log metadata 计数，不能读取设置值、上传数据或修改 sync_log"
);
check(
  knowledgeCloudSyncStatusHook.includes("getPendingKnowledgeSyncLogEntries") &&
    knowledgeCloudSyncStatusHook.includes("KNOWLEDGE_SYNC_STATUS_EVENT") &&
    knowledgeCloudSyncStatusHook.includes("KNOWLEDGE_SYNC_STATUS_STORAGE_KEY") &&
    knowledgeCloudSyncStatusHook.includes('window.addEventListener("storage", handleStorage)') &&
    knowledgeCloudSyncStatusHook.includes('window.removeEventListener("storage", handleStorage)') &&
    knowledgeCloudSyncStatusHook.includes("event.key !== KNOWLEDGE_SYNC_STATUS_STORAGE_KEY") &&
    !knowledgeCloudSyncStatusHook.includes(
      "event.key !== KNOWLEDGE_SYNC_STATUS_STORAGE_KEY || !event.newValue"
    ) &&
    knowledgeCloudSyncStatusHook.includes("summarizeKnowledgeCloudSyncStatus") &&
    knowledgeCloudSyncStatusHook.includes(
      "KNOWLEDGE_STATUS_REFRESH_INTERVAL_MS"
    ),
  "知识库附属同步状态 hook 应只读评论/版本/双链 sync_log 元数据，并用事件/轮询刷新全局 pending 状态；状态 key 被清空时也要刷新，避免知识库附属队列清零后 UI 卡旧状态"
);
check(
  knowledgeSyncStatus.includes("KNOWLEDGE_SYNC_STATUS_EVENT") &&
    knowledgeSyncStatus.includes('KNOWLEDGE_SYNC_STATUS_STORAGE_KEY =') &&
    knowledgeSyncStatus.includes("window.localStorage.setItem(") &&
    knowledgeSyncStatus.includes(
      "never comment bodies, link targets, version snapshots, or sync payloads"
    ) &&
    knowledgeSyncStatus.includes("reads_sync_log_metadata: true") &&
    knowledgeSyncStatus.includes("reads_wiki_link_targets: false") &&
    knowledgeSyncStatus.includes("reads_comment_bodies: false") &&
    knowledgeSyncStatus.includes("reads_version_snapshots: false") &&
    knowledgeSyncStatus.includes("uploads_workspace_data: false") &&
    knowledgeSyncStatus.includes("mutates_sync_log: false") &&
    knowledgeSyncStatus.includes("manualReviewSampleRowIds"),
  "知识库附属同步状态必须只暴露 sync_log metadata 计数，不能读取评论正文、版本快照、双链目标、上传数据或修改 sync_log"
);
check(
  localQueries.includes("emitSettingsSyncStatusEvent") &&
    localQueries.includes("isSettingsSyncTableName(tableName)") &&
    localQueries.includes("if (marked > 0) {") &&
    localQueries.includes("emitSettingsSyncStatusEvent();"),
  "settings 写入和 ack/失败状态变化后应发出不含内容的刷新事件，让侧边栏同步计数及时更新"
);
check(
  localQueries.includes('SYNC_LOG_STATUS_EVENT = "zhinote:sync-log-status"') &&
    localQueries.includes('SYNC_LOG_STATUS_STORAGE_KEY = "zhinote:sync-log-status-updated"') &&
    localQueries.includes("export function emitSyncLogStatusEvent") &&
    localQueries.includes("window.localStorage.setItem(SYNC_LOG_STATUS_STORAGE_KEY, String(Date.now()))") &&
    localQueries.includes("Cross-tab hint only") &&
    localQueries.includes("never sync payloads or note content") &&
    localQueries.includes("emitSyncLogStatusEvent();"),
  "sync_log 新增、ack、失败和重试状态变化后应发出不含内容的全域刷新事件和跨 tab 时间戳提醒，让同步中心全域队列计数及时更新"
);
check(
  localQueries.includes("export async function getPendingPageSyncRecords") &&
    localQueries.includes("table_name = 'pages'") &&
    localQueries.includes("export async function getPageSyncLogPendingCounts") &&
    localQueries.includes("export async function getDatabaseSyncLogPendingCounts") &&
    localQueries.includes("retryable") &&
    localQueries.includes("deferred: Math.max(0, total - retryable)") &&
    localQueries.includes("export async function markPageSyncLogEntriesSynced") &&
    localQueries.includes("export async function markPageSyncLogEntriesAttempted") &&
    localQueries.includes("export async function markPageSyncLogEntriesFailed") &&
    localQueries.includes("return markSyncLogEntriesAttempted(ids)") &&
    localQueries.includes("return markSyncLogEntriesFailed(ids, error, retryDelayMs)"),
  "页面 sync_log 应有独立的待补传读取、ACK、尝试和失败标记方法，且只处理 pages 表元数据"
);
check(
  localQueries.includes("emitKnowledgeSyncStatusEvent") &&
    localQueries.includes("isKnowledgeSyncTableName(tableName)") &&
    localQueries.includes("getPendingKnowledgeSyncLogEntries") &&
    localQueries.includes(
      "table_name IN ('wiki_links', 'page_comments', 'block_comments', 'page_versions')"
    ),
  "评论、版本历史和双链写入后应发出不含内容的刷新事件，让账号同步总控能看到知识库附属 pending 队列"
);
check(
  sidebar.includes("fetchAccountSession") &&
    sidebar.includes(
      "fallbackReason?: string"
    ) &&
    sidebar.includes("fetchAccountSession({ force: options.force })") &&
    sidebar.includes("if (options.preferStored)") &&
    sidebar.includes("账号资料已在其他标签页更新，正在确认云端状态") &&
    sidebar.includes("正在确认账号云端状态，已先显示最近用户名") &&
    sidebar.includes("ACCOUNT_SESSION_LAST_AUTHENTICATED_STORAGE_KEY") &&
    sidebar.includes("ACCOUNT_SESSION_EXPLICIT_LOGOUT_STORAGE_KEY") &&
    sidebar.includes("formatClientAccountLabel") &&
    sidebar.includes("getLastAuthenticatedAccount") &&
    sidebar.includes("getLastKnownAccountLabel") &&
    sidebar.includes("const accountLabelMountedRef = useRef(true)") &&
    sidebar.includes("if (!accountLabelMountedRef.current) return;") &&
    sidebar.includes("accountLabelMountedRef.current = false") &&
    sidebar.includes('window.addEventListener("storage", handleAccountStorage)') &&
    sidebar.includes('window.addEventListener("focus", handleAccountForeground)') &&
    sidebar.includes(
      'document.addEventListener("visibilitychange", handleAccountVisible)'
    ) &&
    sidebar.includes("force: true") &&
    sidebar.includes("preferStored: true") &&
    sidebar.includes("const handleAccountProfileUpdated = () =>") &&
    sidebar.includes("const handleAccountForeground = () =>") &&
    sidebar.includes("const handleAccountVisible = () =>") &&
    sidebar.includes('document.visibilityState === "visible"') &&
    sidebar.includes(
      "event.key === ACCOUNT_SESSION_LAST_AUTHENTICATED_STORAGE_KEY"
    ) &&
    sidebar.includes(
      "event.key === ACCOUNT_SESSION_EXPLICIT_LOGOUT_STORAGE_KEY"
    ) &&
    sidebar.includes('session.status === "ok"') &&
    sidebar.includes("const lastKnownLabel = getLastKnownAccountLabel()") &&
    sidebar.includes(
      'currentLabel === "账号" ? lastKnownLabel : currentLabel'
    ) &&
    sidebar.includes("accountSessionFallback") &&
    sidebar.includes("getAccountSessionFallbackReason") &&
    sidebar.includes('status === "unconfirmed"') &&
    sidebar.includes("session.stale") &&
    sidebar.includes("session.staleReason") &&
    sidebar.includes("setAccountLabel(formatClientAccountLabel(session.account))") &&
    sidebar.includes('data-testid="account-session-stale-fallback"') &&
    sidebar.includes('data-account-session-fallback="stale"') &&
    sidebar.includes("账号云端确认中，本地可继续") &&
    sidebar.includes("本地输入可继续保存，同步会低频重试"),
  "Sidebar 应通过共享账号状态 helper 读取当前账号资料，并在接口临时失败、跨标签页缓存变化或标签页重新可见时保留/刷新最近用户名和 stale fallback"
);
check(
  sidebar.includes("accountLabel"),
  "Sidebar 应显示登录用户名，而不是固定显示账号"
);
check(
  sidebar.includes("pageSyncPendingTotal") &&
    sidebar.includes("databaseSyncPendingTotal") &&
    sidebar.includes("useAccountCloudSyncCoordinator") &&
    sidebar.includes('data-testid="sidebar-sync-status"') &&
    sidebar.includes('data-testid="account-cloud-sync-coordinator"') &&
    sidebar.includes("accountSyncShortLabel") &&
    sidebar.includes("getAccountSyncButtonLabel") &&
    sidebar.includes("accountSyncButtonLabel") &&
    sidebar.includes('const accountHasRecentIdentity = accountLabel !== "账号"') &&
    sidebar.includes("getAccountSyncButtonLabel(\n    accountSync,\n    accountHasRecentIdentity\n  )") &&
    sidebar.includes("getAccountSyncIcon(\n    accountSync,\n    accountHasRecentIdentity\n  )") &&
    sidebar.includes("getAccountSyncInlineSummary(\n    accountSync,\n    accountHasRecentIdentity\n  )") &&
    sidebar.includes('localUseReadiness.status === "pending-upload"') &&
    sidebar.includes('return hasRecentAccount ? "确认中" : "登录同步"') &&
    sidebar.includes('? "☁️"') &&
    sidebar.includes('localUseReadiness.status === "signed-out"') &&
    sidebar.includes('localUseReadiness.status === "cloud-uncertain"') &&
    sidebar.includes('"登录同步"') &&
    sidebar.includes('"确认中"') &&
    sidebar.includes('"待重试"') &&
    sidebar.includes("accountSyncAriaLabel") &&
    sidebar.includes("accountSyncInlineSummary") &&
    sidebar.includes("getAccountSyncInlineSummary") &&
    sidebar.includes("getAccountSyncDomainBreakdown") &&
    sidebar.includes("getAccountSyncDomainBreakdownItems") &&
    sidebar.includes("getAccountSyncDomainChipClass") &&
    sidebar.includes("getAccountLocalUseBadgeLabel") &&
    sidebar.includes("getAccountLocalUseBadgeClass") &&
    sidebar.includes("getAccountCacheSafetyBadgeLabel") &&
    sidebar.includes("getAccountSafeToSwitchDeviceNow") &&
    sidebar.includes("getAccountSwitchDeviceBadgeLabel") &&
    sidebar.includes("getAccountSwitchDeviceBadgeClass") &&
    sidebar.includes("accountSafeToSwitchDeviceNow") &&
    sidebar.includes("accountSyncDomainBreakdownItems") &&
    sidebar.includes("accountSyncDomainBreakdown") &&
    sidebar.includes("getAccountSyncToneClass") &&
    sidebar.includes("switch (accountSync.localUseReadiness.status)") &&
    sidebar.includes('case "needs-review":') &&
    sidebar.includes('case "pending-upload":') &&
    sidebar.includes('case "cloud-uncertain":') &&
    sidebar.includes('return "待确认";') &&
    sidebar.includes("页面同步：账号待确认") &&
    sidebar.includes("数据库同步：账号待确认") &&
    !sidebar.includes("页面同步：未登录") &&
    !sidebar.includes("数据库同步：未登录") &&
    sidebar.includes("const accountSyncToneClass = getAccountSyncToneClass(accountSync)") &&
    !sidebar.includes("const accountSyncToneClass = getAccountSyncToneClass(accountSync.state)") &&
    sidebar.includes("检查中") &&
    sidebar.includes("重试中") &&
    sidebar.includes("accountSync.localUseReadiness.label") &&
    sidebar.includes('data-testid="account-cloud-sync-inline-summary"') &&
    sidebar.includes('data-testid="account-local-use-readiness-badge"') &&
    sidebar.includes('data-testid="account-cloud-sync-domain-breakdown"') &&
    sidebar.includes("data-sync-inline-summary={accountSyncInlineSummary}") &&
    sidebar.includes("data-sync-domain-breakdown={accountSyncDomainBreakdown}") &&
    sidebar.includes("data-auth-retry-active={accountSync.authRetryActive}") &&
    sidebar.includes("data-auth-retry-domains={accountSync.authRetryDomainLabel}") &&
    sidebar.includes("data-auth-retry-until={accountSync.authRetryUntilLabel ?? \"\"}") &&
    sidebar.includes("data-account-has-recent-identity={accountHasRecentIdentity}") &&
    sidebar.includes(
      "data-local-use-next-action={accountSync.localUseReadiness.nextAction}"
    ) &&
    sidebar.includes("data-sync-domain-breakdown-count={") &&
    sidebar.includes("data-sync-domain={item.id}") &&
    sidebar.includes("data-sync-domain-count={item.count}") &&
    sidebar.includes("队列分布：") &&
    sidebar.includes("本地可写") &&
    sidebar.includes("云端就绪") &&
    sidebar.includes("先处理队列") &&
    sidebar.includes("先别重建缓存") &&
    sidebar.includes("可换设备") &&
    sidebar.includes("先等同步") &&
    sidebar.includes('data-testid="account-safe-to-switch-device-badge"') &&
    sidebar.includes("data-safe-to-switch-device-now={accountSafeToSwitchDeviceNow}") &&
    sidebar.includes("当前没有 pending、failed、manual review 或账号重试") &&
    sidebar.includes("先不要把另一台设备当作最新版本") &&
    sidebar.includes("页面 ${accountSync.pagePendingTotal}") &&
    sidebar.includes("数据库 ${accountSync.databasePendingTotal}") &&
    sidebar.includes("设置 ${accountSync.settingsPendingTotal}") &&
    sidebar.includes("知识库 ${accountSync.knowledgePendingTotal}") &&
    sidebar.includes("其他 ${accountSync.globalSyncLogExtraPendingTotal}") &&
    sidebar.includes("云端待确认，本地已保留${breakdownSuffix}") &&
    sidebar.includes("本地已保留，云端恢复后上传${breakdownSuffix}") &&
    sidebar.includes("本地已保留，登录后上传${breakdownSuffix}") &&
    sidebar.includes("账号待确认，本地可继续${breakdownSuffix}") &&
    sidebar.includes("登录后继续上传本地队列${breakdownSuffix}") &&
    sidebar.includes("accountSync.localUseReadiness.label}${breakdownSuffix}") &&
    sidebar.includes("账号或网络暂不可确认，已保留本地输入，后台低频重试") &&
    sidebar.includes("accountSyncNeedsSyncCenter") &&
    sidebar.includes("accountSyncShouldOpenSyncCenter") &&
    sidebar.includes("accountSyncShouldRecheckBeforeStatusOpen") &&
    sidebar.includes('accountSync.state === "disabled"') &&
    sidebar.includes('accountSync.state === "signed-out"') &&
    sidebar.includes('accountSync.state === "error"') &&
    sidebar.includes('"查看同步"') &&
    sidebar.includes("accountSync.pagePendingTotal > 0") &&
    sidebar.includes("accountSync.databasePendingTotal > 0") &&
    sidebar.includes("getAccountSyncCenterTarget") &&
    sidebar.includes('data-sync-action=') &&
    sidebar.includes(
      "data-sync-preopen-recheck={accountSyncShouldRecheckBeforeStatusOpen}"
    ) &&
    sidebar.includes("data-sync-visible-label={accountSyncButtonLabel}") &&
    sidebar.includes('data-sync-target={accountSyncCenterTarget}') &&
    sidebar.includes('data-testid="collapsed-sidebar-sync-status"') &&
    sidebar.includes("getCollapsedSidebarSyncBadgeLabel") &&
    sidebar.includes("getCollapsedSidebarSyncBadgeClass") &&
    sidebar.includes("打开侧边栏；同步状态：${accountSyncButtonLabel}") &&
    sidebar.includes("data-sync-pending-total={accountSync.pendingTotal}") &&
    sidebar.includes("data-sync-failed-total={accountSync.failedTotal}") &&
    sidebar.includes(
      "data-sync-manual-review-total={accountSync.manualReviewTotal}"
    ) &&
    sidebar.includes("data-local-use-status={accountSync.localUseReadiness.status}") &&
    sidebar.includes('"open-sync-center"') &&
    sidebar.includes('"quick-sync"') &&
    sidebar.includes("/modules/sync#sync-upload-safety-panel") &&
    sidebar.includes("/modules/sync#page-pending-upload-queue") &&
    sidebar.includes("/modules/sync#database-pending-upload-queue") &&
    sidebar.includes("/modules/sync#knowledge-replay-batch-plan") &&
    sidebar.includes("/modules/sync#account-module-settings-pending-plan") &&
    sidebar.includes(
      "const accountSyncActionLabel = accountSyncShouldOpenSyncCenter"
    ) &&
    sidebar.includes("openModuleRoute(accountSyncCenterTarget)") &&
    sidebar.includes(
      "if (accountSyncShouldRecheckBeforeStatusOpen)"
    ) &&
    sidebar.includes("warmModuleRoute(accountSyncCenterTarget)") &&
    sidebar.includes("data-sync-state={accountSync.state}") &&
    sidebar.includes("data-sync-pending={accountSync.pendingTotal}") &&
    sidebar.includes("data-pending-total={accountSync.pendingTotal}") &&
    sidebar.includes("data-failed-total={accountSync.failedTotal}") &&
    sidebar.includes("data-sync-failed={accountSync.failedTotal}") &&
    sidebar.includes("data-manual-review-total={accountSync.manualReviewTotal}") &&
    sidebar.includes(
      "data-sync-manual-review={accountSync.manualReviewTotal}"
    ) &&
    sidebar.includes(
      "data-settings-pending-total={accountSync.settingsPendingTotal}"
    ) &&
    sidebar.includes(
      "data-knowledge-pending-total={accountSync.knowledgePendingTotal}"
    ) &&
    sidebar.includes("accountSync.localUseReadiness") &&
    sidebar.includes("data-local-use-status={accountSync.localUseReadiness.status}") &&
    sidebar.includes("data-local-input-can-continue=") &&
    sidebar.includes("data-cloud-handoff-ready=") &&
    sidebar.includes("data-cache-rebuild-blocked=") &&
    sidebar.includes("data-safe-to-switch-device-now=") &&
    sidebar.includes("accountLocalUseTitle") &&
    sidebar.includes('pageSync.pendingStatus.enabled') &&
    sidebar.includes('databaseSync.pendingStatus.enabled') &&
    sidebar.includes("页面同步：已开启，等待后台检查") &&
    sidebar.includes("数据库同步：已开启，等待后台检查") &&
    sidebar.includes("页面同步未开启") &&
    sidebar.includes("数据库同步未开启") &&
    sidebar.includes("accountSync.pendingTotal") &&
    sidebar.includes("普通同步只补传 pending queue") &&
    sidebar.includes("pageSync.pendingStatus.pending") &&
    sidebar.includes("databaseSync.pendingStatus.syncLogPending") &&
    syncDashboardShell.includes('id="page-pending-upload-queue"') &&
    syncDashboardShell.includes('data-testid="page-pending-upload-queue"') &&
    syncDashboardShell.includes('id="database-pending-upload-queue"') &&
    syncDashboardShell.includes('data-testid="database-pending-upload-queue"'),
  "Sidebar 账号行应显示账号级云同步状态、各域 pending/失败/人工处理计数和本地可继续使用判定，让本地未上传输入在全局可见"
);

if (errors.length > 0) {
  console.error("verify:account 失败：");
  for (const err of errors) console.error(`  - ${err}`);
  process.exit(1);
}
console.log(
  "verify:account 通过 ✓ （门控、哈希、限流、httpOnly、掩码邮箱、页面同步默认开启但需登录）"
);
