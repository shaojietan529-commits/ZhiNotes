#!/usr/bin/env node

// Verifies the primary workspace surfaces contract:
// - Each is backed by a singleton page root with a rebuildable local id cache.
// - Routes and shells exist and stay local (no external fetch/upload/AI/recording).
// - Sidebar promotes the three categories and demotes others to 备选模块.
// - Page tree hides the module roots from the generic page list.

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

// 1. Module workspace helper
const helper = read("src/lib/pages/moduleWorkspaces.ts");
for (const token of [
  "getModuleRootId",
  "findLocalModuleRootId",
  "getModuleRootIdsSync",
  "MODULE_ROOT_IDS_EVENT",
  "MODULE_WORKSPACE_LIST",
  "fetchCloudModuleRoots",
  "runCloudModuleRootLookup",
  "applyRemotePageMetadata",
  "CLOUD_MODULE_ROOT_CACHE_MS",
  'fetch("/api/pages/account-sync"',
  'body: JSON.stringify({ action: "module-roots" })',
  "toDateKey",
  "每日纪要",
  "产业链研究",
  "ZhiHui",
  "知识库",
  "legacyTitles",
]) {
  check(helper.includes(token), `moduleWorkspaces 缺少 ${token}`);
}

// 2. Routes
for (const route of [
  "src/app/(workspace)/daily/page.tsx",
  "src/app/(workspace)/industry-chain/page.tsx",
  "src/app/(workspace)/schedule/page.tsx",
  "src/app/(workspace)/knowledge-base/page.tsx",
]) {
  check(existsSync(path.join(root, route)), `缺少路由 ${route}`);
}

// 3. Shells exist + local-only
const shells = {
  daily: read("src/components/modules/DailyNotesShell.tsx"),
  chain: read("src/components/modules/IndustryChainShell.tsx"),
  schedule: read("src/components/modules/MeetingScheduleShell.tsx"),
  knowledge: read("src/components/modules/KnowledgeBaseShell.tsx"),
};
const localQueries = read("src/lib/db/local/queries.ts");
const localSchema = read("src/lib/db/local/schema.ts");
const localClient = read("src/lib/db/local/client.ts");
const syncShell = read("src/components/modules/SyncShell.tsx");
const usePageHook = read("src/hooks/usePage.ts");
const usePagesHook = read("src/hooks/usePages.ts");
const workspaceStore = read("src/stores/workspaceStore.ts");
const pageBodyHydrationStatus = read(
  "src/lib/pages/pageBodyHydrationStatus.ts"
);
const pagePeekModal = read("src/components/page/PagePeekModal.tsx");
const lazyPagePeekModal = read("src/components/page/LazyPagePeekModal.tsx");
const pageShell = read("src/components/providers/PageShell.tsx");
const pageCloudSaveStatus = read("src/lib/pages/pageCloudSaveStatus.ts");
const dailyCalendarLoadStatus = read("src/lib/sync/dailyCalendarLoadStatus.ts");
const meetingCalendarLoadStatus = read(
  "src/lib/sync/meetingCalendarLoadStatus.ts"
);
const editorSource = read("src/components/editor/Editor.tsx");
const blockCommentsSource = read("src/components/shared/BlockComments.tsx");
const commentSidePanelSource = read(
  "src/components/shared/CommentSidePanel.tsx"
);
const blockCommentEventsSource = read(
  "src/components/shared/blockCommentEvents.ts"
);
const pendingPageDrafts = read("src/lib/pages/pendingPageDrafts.ts");
const localFirstPageNavigationUtil = read(
  "src/lib/pages/localFirstPageNavigation.ts"
);
const sidebarSource = read("src/components/sidebar/Sidebar.tsx");
const lazyQuickSearchSource = read("src/components/sidebar/LazyQuickSearch.tsx");
const quickSearchSource = read("src/components/sidebar/QuickSearch.tsx");
const favoritePagesSource = read("src/components/sidebar/FavoritePages.tsx");
const trashPagesSource = read("src/components/sidebar/TrashPages.tsx");
const moduleDashboardSource = read("src/components/modules/ModuleDashboard.tsx");
const pageTreeSource = read("src/components/sidebar/PageTree.tsx");
const pageContextMenuSource = read("src/components/page/PageContextMenu.tsx");
const lazyPageContextMenuSource = read(
  "src/components/page/LazyPageContextMenu.tsx"
);
const pageUpdateBus = read("src/lib/pages/pageUpdateBus.ts");
const accountPageSync = read("src/lib/pages/accountPageSync.ts");
const cloudPageMutationsSource = read("src/lib/pages/cloudPageMutations.ts");
const databaseCloudMutationsSource = read(
  "src/lib/database/cloudDatabaseMutations.ts"
);
const scopedPageMetadata = read("src/lib/pages/scopedPageMetadata.ts");
const industryCompanyLinks = read("src/lib/pages/industryChainCompanyLinks.ts");
const forbidden = ["XMLHttpRequest", "enables_ai", "getUserMedia"];
for (const [name, source] of Object.entries(shells)) {
  for (const token of forbidden) {
    check(!source.includes(token), `${name} shell 不得包含高风险调用 ${token}`);
  }
}
for (const [name, source] of Object.entries(shells)) {
  if (name === "schedule") {
    const fetchCalls = Array.from(
      source.matchAll(/(?<![A-Za-z0-9_$])fetch\(\s*["'`]([^"'`]+)["'`]/g)
    ).map((match) => match[1]);
    const allowedScheduleFetches = new Set([
      "/api/meetings/intake",
      "/api/pages/account-sync",
      "/api/meetings/agent/jobs",
    ]);
    check(
      fetchCalls.length > 0 &&
        fetchCalls.every((url) => allowedScheduleFetches.has(url)),
      "schedule shell 只能调用已批准的同源接口 /api/meetings/intake, /api/pages/account-sync, /api/meetings/agent/jobs"
    );
  } else {
    check(!/\bfetch\s*\(/.test(source), `${name} shell 不得包含 fetch(`);
  }
}

// Daily: calendar + per-day add + Notion-style template
for (const token of ["buildMonthGrid", "addNote", "日期", "要点", "Summary"]) {
  check(shells.daily.includes(token), `DailyNotesShell 缺少 ${token}`);
}
for (const token of [
  "listDailyPageMetadataForCalendar",
  "rebuildPageDateKeyIndex",
  "seedDailyNoteForImmediateOpen",
  "useLocalFirstPageNavigation",
  'router.prefetch("/page/zhinote-route-prefetch")',
  "const pageRoute = `/page/${optimisticNote.id}`",
  "router.prefetch(pageRoute)",
  "DAILY_CREATE_OPEN_MODE_SETTING_KEY",
  "DEFAULT_DAILY_CREATE_OPEN_MODE",
  'data-testid="daily-create-open-mode"',
  'openPage(optimisticNote, { source: "daily-create" })',
  "@/components/page/LazyPagePeekModal",
  "warmPagePeekModal();",
  "setPeekInitialPage(optimisticNote)",
  "setPeekPageId(optimisticNote.id)",
  "<PagePeekModal",
  "onReady={handlePeekReady}",
  "rememberPendingPageDraft(optimisticNote)",
  "openNotePage",
  "DAILY_DATE_INDEX_BACKFILL_KEY",
  "getModuleRootIdSync",
  "loadRequestRef",
  "observedPageRevisionRef",
  "applyRemotePages",
  "DAILY_DATE_INDEX_BACKFILL_BATCH",
  "DAILY_DATE_INDEX_BACKFILL_MAX_PASSES",
  "DAILY_CLOUD_CACHE_FRESH_MS = 24 * 60 * 60 * 1000",
  "DAILY_CLOUD_CACHE_STALE_MS = 7 * 24 * 60 * 60 * 1000",
  "type CachedDailyCloudMetadataResult",
  "cached_cloud_stale",
  "较早缓存的云端每日纪要目录",
  "if (!cachedCloud.stale)",
  "waitForDailyBackfillIdle",
  "DAILY_CALENDAR_EXPAND_BATCH",
  "visibleNoteLimitByDate",
  "showMoreNotesForDate",
  "const calendarIndexes = useMemo(",
  "buildDailyCalendarIndexes(notes, calendarDateKeys)",
  "function buildDailyCalendarIndexes(",
  "const notesById = calendarIndexes.notesById",
  "const inCalendarNote = notesById.get(pageId)",
  "selectDailyNotesForCalendarRender(",
  "DAILY_RENDER_RECENT_BUFFER_LIMIT",
  "const deferredRecentNotes = useDeferredValue(calendarIndexes.recentNotes)",
  "deferredRecentNotes.slice(0, DAILY_RECENT_VISIBLE_LIMIT)",
  "function addRecentDailyNoteCandidate(",
  "notesRenderFingerprintRef",
  "publishDailyCalendarRenderSelection(",
  "function publishDailyCalendarRenderSelection(",
  "dailyNotesRenderFingerprint(notes)",
  "fingerprintRef.current === nextFingerprint",
  "startTransition(() =>",
  "setNotes(notes)",
  "setDailyNoteCountByDate(countsByDate)",
  "type DailyCalendarLoadOptions",
  "const cloudLoadingRef = useRef(false)",
  "cloudLoadingRef.current = cloudLoading",
  "interruptCloud?: boolean",
  "preserveVisibleNotes?: boolean",
  "const interruptCloud = opts?.interruptCloud ?? includeCloud",
  "!interruptCloud && loadRequestRef.current > 0",
  "seedVisibleDailyNotesForBackgroundRefresh(",
  "function seedVisibleDailyNotesForBackgroundRefresh(",
  "interruptCloud: false",
  "preserveVisibleNotes: true",
  "includeUnindexedFallback: false",
  "includeUnindexedFallback: true",
  'source: "local-fallback-metadata"',
  "buildDailyCalendarLoadStatusView",
  "createDailyCalendarLoadStatus",
  "DailyCalendarLoadStatusStrip",
  'data-testid="daily-calendar-load-status"',
  "dailyCalendarEmptyLoadHint",
  'data-testid="daily-calendar-empty-load-hint"',
  "data-load-phase={view.phase}",
  "data-load-step={step.id}",
  "formatDailyCloudMetadataFailureMessage",
  "云端每日纪要索引本轮读取失败；当前先显示本机/热缓存内容，稍后刷新会自动重试。",
  'publishCalendarStatus("cloud-checking"',
  'phase: "cloud-ready"',
  'phase: "optimistic-draft"',
]) {
  check(shells.daily.includes(token), `DailyNotesShell 缺少每日纪要性能护栏 ${token}`);
}
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
    !dailyCalendarLoadStatus.includes("fetch(") &&
    !dailyCalendarLoadStatus.includes("localStorage"),
  "每日纪要加载状态条必须只使用阶段和计数 metadata，不能读取正文、请求网络或写缓存"
);
for (const token of [
  "buildMeetingCalendarLoadStatusView",
  "createMeetingCalendarLoadStatus",
  "MeetingCalendarLoadStatusStrip",
  'data-testid="meeting-calendar-load-status"',
  "meetingCalendarEmptyLoadHint",
  'data-testid="meeting-calendar-empty-load-hint"',
  "data-load-phase={view.phase}",
  "data-load-step={step.id}",
  'publishCalendarStatus("cloud-checking"',
  'publishLoadStatus("cloud-ready"',
  'publishCalendarStatus("optimistic-draft"',
]) {
  check(
    shells.schedule.includes(token),
    `MeetingScheduleShell 缺少会议日历性能护栏 ${token}`
  );
}
check(
  meetingCalendarLoadStatus.includes("MeetingCalendarLoadPhase") &&
    meetingCalendarLoadStatus.includes("buildMeetingCalendarLoadStatusView") &&
    meetingCalendarLoadStatus.includes("visibleMeetings") &&
    meetingCalendarLoadStatus.includes("visibleDays") &&
    meetingCalendarLoadStatus.includes("热缓存") &&
    meetingCalendarLoadStatus.includes("本地索引") &&
    meetingCalendarLoadStatus.includes("云端校正") &&
    meetingCalendarLoadStatus.includes("Meeting calendar load status is metadata-only") &&
    meetingCalendarLoadStatus.includes("does not read meeting body text") &&
    meetingCalendarLoadStatus.includes("join URLs") &&
    meetingCalendarLoadStatus.includes("does not send network requests") &&
    meetingCalendarLoadStatus.includes("does not write server data") &&
    !meetingCalendarLoadStatus.includes("content_text") &&
    !meetingCalendarLoadStatus.includes("joinUrl") &&
    !meetingCalendarLoadStatus.includes("meetingId") &&
    !meetingCalendarLoadStatus.includes("entry.passcode") &&
    !meetingCalendarLoadStatus.includes("fetch(") &&
    !meetingCalendarLoadStatus.includes("localStorage"),
  "会议日历加载状态条必须只使用阶段和计数 metadata，不能读取正文、会议链接、请求网络或写缓存"
);
check(
  shells.daily.includes('await findLocalModuleRootId("daily")') &&
    shells.daily.includes("DAILY_INITIAL_CLOUD_RECHECK_DELAY_MS") &&
    shells.daily.includes("DAILY_INITIAL_CLOUD_RECHECK_IDLE_TIMEOUT_MS") &&
    shells.daily.includes("void load({\n        includeCloud: false,\n        interruptCloud: false,\n        preserveVisibleNotes: true,\n      });") &&
    shells.daily.includes("cancelCloudRecheck = scheduleDailyIdleTask(() => {\n        void load({\n          includeCloud: true,\n          preserveVisibleNotes: true,\n        });\n      }, DAILY_INITIAL_CLOUD_RECHECK_IDLE_TIMEOUT_MS);") &&
    shells.daily.includes(
      'const dailyRootId = localDailyRootId ?? (await getModuleRootId("daily"))'
    ) &&
    shells.daily.indexOf('await findLocalModuleRootId("daily")') <
      shells.daily.indexOf(
        'const dailyRootId = localDailyRootId ?? (await getModuleRootId("daily"))'
      ),
  "DailyNotesShell 必须先用本地 root 元数据快速显示日历，再后台确认云端 canonical root"
);
check(
  shells.daily.includes("void ensureDailyDateIndexBackfilled()"),
  "DailyNotesShell 日期索引重建必须后台运行，不能阻塞首屏"
);
check(
  shells.daily.indexOf("includeUnindexedFallback: false") <
    shells.daily.indexOf("const fallbackMetadata = await listDailyPageMetadataForCalendar") &&
    shells.daily.indexOf("const fallbackMetadata = await listDailyPageMetadataForCalendar") <
      shells.daily.indexOf("includeUnindexedFallback: true") &&
    shells.daily.indexOf("includeUnindexedFallback: true") <
      shells.daily.indexOf("await ensureDailyDateIndexBackfilled()"),
  "DailyNotesShell 首屏必须跳过未索引导入 fallback，并在后台空闲时先补齐 fallback 再重建日期索引"
);
check(
  shells.daily.includes("rebuildPageDateKeyIndex({") &&
    shells.daily.includes("limit: DAILY_DATE_INDEX_BACKFILL_BATCH") &&
    shells.daily.includes("includeRemaining: false") &&
    shells.daily.includes("isDailyDateIndexBackfillDone") &&
    shells.daily.includes("markDailyDateIndexBackfillDone"),
  "DailyNotesShell 日期索引重建必须分批、可记忆完成状态，不能刷新时反复全量扫描"
);
check(
  helper.includes("getModuleRootIdSync"),
  "moduleWorkspaces 必须提供同步 root id 读取，避免新增时扫全量页面"
);
const storedRootLookupIndex = helper.indexOf(
  "const existing = await getPage(stored).catch(() => null);"
);
const localRootFallbackScanIndex = helper.indexOf(
  "const localTitleSet = new Set([def.title, ...(def.legacyTitles ?? [])]);"
);
check(
  storedRootLookupIndex !== -1 &&
    localRootFallbackScanIndex !== -1 &&
    storedRootLookupIndex < localRootFallbackScanIndex &&
    helper.slice(storedRootLookupIndex, localRootFallbackScanIndex).includes(
      "rememberRoot(key, existing.id)"
    ),
  "findLocalModuleRootId 必须先用已缓存 root id 单页查询快速命中，找不到时才扫全量页面兜底"
);
check(
  helper.includes("const cloudRoot = await findCloudModuleRoot(key)") &&
    helper.includes("await applyRemotePageMetadata([cloudRoot])") &&
    helper.includes("rememberRoot(key, cloudRoot.id)") &&
    helper.indexOf("const cloudRoot = await findCloudModuleRoot(key)") <
      helper.indexOf("const titleSet = new Set") &&
    helper.indexOf("const cloudRoot = await findCloudModuleRoot(key)") <
      helper.indexOf("const created = await createPage"),
  "moduleWorkspaces 本地 root 缓存缺失时必须先从账号云端轻量 module-roots 认领 root，再用本地缓存兜底，不能直接创建重复 root"
);
check(
  helper.includes("cloudModuleRootLookupInFlight") &&
    helper.includes("cloudModuleRootLookupCache") &&
    helper.includes("checkAccountCloudSyncGate") &&
    helper.includes('accountGate.status !== "ready"') &&
    helper.includes("Date.now() - cloudModuleRootLookupCache.cachedAt") &&
    helper.includes('window.localStorage.getItem(PAGE_SYNC_ENABLED_KEY) === "false"'),
  "moduleWorkspaces 云端 root 认领必须共享 in-flight 请求，先过账号 gate，并尊重页面同步本地关闭开关"
);
check(
  helper.includes("window.dispatchEvent(new CustomEvent(MODULE_ROOT_IDS_EVENT))"),
  "moduleWorkspaces 写入 root id 缓存后必须广播本地事件，避免侧边栏等 UI 等到刷新才更新"
);
check(
  !usePageHook.includes("setLoading(localPage.content_text == null)") &&
    usePageHook.includes("const [initialLocalFirstPageSeed] = useState<Page | null>(() => {") &&
    usePageHook.includes("const [page, setPage] = useState<Page | null>(() => {") &&
    usePageHook.includes("const [loading, setLoading] = useState(() => {") &&
    usePageHook.includes("const loadRequestRef = useRef(0);") &&
    usePageHook.includes("const visiblePageRef = useRef<Page | null>(initialLocalFirstPageSeed)") &&
    usePageHook.includes("visiblePageRef.current?.id === pageId") &&
    usePageHook.includes("const requestId = ++loadRequestRef.current;") &&
    usePageHook.includes("if (!isCurrentLoad()) return;") &&
    usePageHook.includes("loadRequestRef.current += 1;") &&
    usePageHook.indexOf("return readLocalFirstPageSeed(pageId);") <
      usePageHook.indexOf("const load = useCallback(async () => {") &&
    usePageHook.includes("if (localPage) {") &&
    usePageHook.includes("readLocalFirstPageSeed") &&
    usePageHook.includes("if (!dbReady)") &&
    usePageHook.includes("setLoadingForCurrentLoad(!localPage)") &&
    usePageHook.includes("setLoadingForCurrentLoad(false);") &&
    usePageHook.includes("schedulePageCloudHydration(\n        pageId,\n        () =>") &&
    usePageHook.includes("visiblePageRef.current?.id === pageId") &&
    usePageHook.includes("readPageRouteHandoffSource(pageId)") &&
    usePageHook.includes("getPageLocalBodyHydrationPriority") &&
    usePageHook.includes("localBodyHydrationPriority") &&
    usePageHook.includes("PAGE_INTERACTIVE_LOCAL_BODY_HYDRATION_DELAY_MS = 24") &&
    usePageHook.includes("PAGE_INTERACTIVE_LOCAL_BODY_HYDRATION_IDLE_MS = 80") &&
    usePageHook.includes('priority === "interactive"') &&
    usePageHook.includes("const pageLocalBodyHydrationQueue = new Map<") &&
    usePageHook.includes("queuePageLocalBodyHydration({") &&
    usePageHook.includes("while (pageLocalBodyHydrationQueue.get(key) === state)") &&
    usePageHook.includes("pageLocalBodyHydrationQueue.delete(key);") &&
    usePageHook.includes("function pageLocalBodyHydrationQueueKey(") &&
    usePageHook.includes("const latestLocalPage = getLocalPage();") &&
    usePageHook.includes("applyCloudPageLookup(cloud, latestLocalPage, setPage, upsertPages)") &&
    usePageHook.includes("requestIdleCallback(run") &&
    usePageHook.includes("PAGE_CLOUD_HYDRATION_IDLE_MS") &&
    usePageHook.includes("const pageCloudHydrationQueue = new Map<string, PageCloudHydrationState>()") &&
    usePageHook.includes("queuePageCloudHydration({") &&
    usePageHook.includes("const existing = pageCloudHydrationQueue.get(key);") &&
    usePageHook.includes("existing.rerun = true;") &&
    usePageHook.includes("void drainPageCloudHydrationQueue(key, state);") &&
    usePageHook.includes("while (pageCloudHydrationQueue.get(key) === state)") &&
    usePageHook.includes("if (!state.rerun) break;") &&
    usePageHook.includes("pageCloudHydrationQueue.delete(key);") &&
    usePageHook.includes("function pageCloudHydrationQueueKey(") &&
    usePageHook.includes(
      'const loadPageAccountSyncModule = () => import("@/lib/pages/accountPageSync")'
    ) &&
    usePageHook.includes("fetchCloudPageByIdWithAccountSync") &&
    usePageHook.includes("queueCloudPagePushWithAccountSync") &&
    !usePageHook.includes("import {\n  fetchCloudPageById") &&
    usePageHook.includes("publishPageBodyHydrationStatus") &&
    usePageHook.includes('phase: "local-body-requested"') &&
    usePageHook.includes('phase: "cloud-body-requested"') &&
    usePageHook.includes('"cloud-body-ready"') &&
    !usePageHook.includes("cloudPagePromise"),
  "usePage 必须把 metadata/handoff 当作可首屏打开状态，云端正文 idle 后台补齐，用最新可见页面快照比较后再回填，并发布本地正文补齐状态"
);
check(
  pageBodyHydrationStatus.includes("local_browser_memory_only: true") &&
    pageBodyHydrationStatus.includes("stores_page_body_text: false") &&
    pageBodyHydrationStatus.includes("uploads_workspace_data: false") &&
    pageBodyHydrationStatus.includes("subscribePageBodyHydrationStatus") &&
    pageBodyHydrationStatus.includes("describePageBodyHydrationStatus"),
  "pageBodyHydrationStatus 必须只在当前浏览器内发布正文补齐状态，不存正文、不上传数据，并提供页面级订阅与统一文案"
);
check(
  usePageHook.includes("options: UsePageOptions") &&
    usePageHook.includes("enabled = options.enabled ?? true"),
  "usePage 必须支持延后加载正文，避免 peek 弹窗打开时立即拉取大正文"
);
check(
  usePageHook.includes("readPendingPageDraft(pageId)") &&
    usePageHook.indexOf("readPendingPageDraft(pageId)") <
      usePageHook.indexOf("useWorkspaceStore.getState().getPageById(pageId)") &&
    pendingPageDrafts.includes("PENDING_PAGE_DRAFT_TTL_MS") &&
    pendingPageDrafts.includes("PENDING_PAGE_DRAFT_MAX_CHARS") &&
    pendingPageDrafts.includes("PENDING_PAGE_DRAFT_DEBOUNCE_CHARS") &&
    pendingPageDrafts.includes("PENDING_PAGE_DRAFT_STORAGE_WRITE_DELAY_MS") &&
    pendingPageDrafts.includes("pendingPageDraftSessionWrites") &&
    pendingPageDrafts.includes("rememberPendingPageDraftInSessionStorageSoon") &&
    pendingPageDrafts.includes("flushPendingPageDraftSessionStorageWrites") &&
    pendingPageDrafts.includes('window.addEventListener("pagehide"') &&
    pendingPageDrafts.includes('document.addEventListener("visibilitychange"') &&
    pendingPageDrafts.includes("window.sessionStorage.setItem") &&
    pendingPageDrafts.includes("window.sessionStorage.removeItem") &&
    pendingPageDrafts.includes("session_storage_only: true") &&
    pendingPageDrafts.includes("stores_page_body_html: true") &&
    pendingPageDrafts.includes("uploads_workspace_data: false") &&
    pendingPageDrafts.includes("enters_sync_log: false") &&
    !pendingPageDrafts.includes("window.localStorage"),
  "usePage 必须优先读取新建页面的内存/同标签页短时恢复草稿；草稿不得写入 localStorage、云端或同步日志"
);
check(
  localFirstPageNavigationUtil.includes("resolveLocalFirstPageNavigationSeed") &&
    localFirstPageNavigationUtil.includes("readPendingPageDraft(target) ??") &&
    localFirstPageNavigationUtil.includes("readPageRouteHandoff(target) ??") &&
    localFirstPageNavigationUtil.indexOf("readPendingPageDraft(target) ??") <
      localFirstPageNavigationUtil.indexOf(
        "useWorkspaceStore.getState().getPageById(target)"
      ) &&
    localFirstPageNavigationUtil.indexOf(
      "useWorkspaceStore.getState().getPageById(target)"
    ) <
      localFirstPageNavigationUtil.indexOf("readPageRouteHandoff(target) ??"),
  "localFirstPageNavigation 必须让 openPage(pageId) 先查本地草稿、内存和路由交接，再退回纯 id 跳转"
);
check(
    pageShell.includes("const loadEditorModule = () => import(\"@/components/editor/Editor\")") &&
    pageShell.includes("const loadPageMutationModule = () =>\n  import(\"@/lib/pages/cloudPageMutations\")") &&
    pageShell.includes('const loadPageVersioningModule = () => import("@/lib/comparison/versioning")') &&
    pageShell.includes('const loadPageExportModule = () => import("@/lib/export/pageExport")') &&
    pageShell.includes("const loadPageResearchStructureModule = () =>") &&
    pageShell.includes("const loadPageSnapshotUpdatesModule = () =>") &&
    !pageShell.includes('from "@/lib/comparison/versioning"') &&
    !pageShell.includes('from "@/lib/export/pageExport"') &&
    !pageShell.includes('from "@/lib/pages/pageSnapshotUpdates"') &&
    pageShell.includes("const Editor = dynamic(loadEditorModule") &&
    pageShell.includes("loading: () => <PageBodySkeleton />") &&
    !pageShell.includes("import Editor from \"@/components/editor/Editor\"") &&
    !pageShell.includes('from "@/lib/pages/cloudPageMutations"') &&
    pageShell.includes("return scheduleEditorMount(() => {\n      void loadEditorModule();\n      setEditorMounted(true);") &&
    pageShell.includes("PAGE_EDITOR_IDLE_TIMEOUT_MS = 120") &&
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
    pageShell.includes("hasLargeBodyForEditor\n        ? PAGE_LARGE_BODY_EDITOR_DELAY_MS") &&
    pageShell.includes("hasLargeBodyForEditor\n        ? PAGE_LARGE_BODY_EDITOR_IDLE_TIMEOUT_MS") &&
    pageShell.includes("delay,\n      timeout,") &&
    pageShell.includes("optimisticDraft={isOptimisticPageDraft}") &&
    pageShell.includes("largeBody={hasLargeBodyForEditor}") &&
    pageShell.includes("getPageOpenPerformanceStatus(") &&
    pageShell.includes('"local-draft-ready"') &&
    pageShell.includes("新页面已在本机创建，标题和属性可以先确认，编辑器正在准备") &&
    pageShell.includes("正文较长（约 ${formatApproxBodySize(contentLength)}）") &&
    pageShell.includes("isLargePageBodyForEditor(content") &&
    pageShell.includes("标题和属性已先显示，正在从本地缓存补齐正文和编辑器") &&
    pageShell.includes('data-testid="page-body-hydration-status"') &&
    pageShell.includes("subscribePageBodyHydrationStatus(pageId, setBodyHydrationStatus)") &&
    pageShell.includes("describePageBodyHydrationStatus(bodyHydrationStatus)") &&
    pageShell.includes("PAGE_COMMENTS_IDLE_TIMEOUT_MS = 700") &&
    pageShell.includes("PAGE_CHILD_TREE_IDLE_TIMEOUT_MS = 1200") &&
    pageShell.includes("PAGE_REFERENCES_IDLE_TIMEOUT_MS = 1800") &&
    pageShell.includes("PAGE_LARGE_BODY_COMMENTS_IDLE_TIMEOUT_MS = 2200") &&
    pageShell.includes("PAGE_LARGE_BODY_CHILD_TREE_IDLE_TIMEOUT_MS = 3000") &&
    pageShell.includes("PAGE_LARGE_BODY_REFERENCES_IDLE_TIMEOUT_MS = 3800") &&
    pageShell.includes("const largeBodyPreviewMode =") &&
    pageShell.includes("const pageCommentsMountTimeout = showComments") &&
    pageShell.includes("const childTreeMountTimeout = largeBodyPreviewMode") &&
    pageShell.includes("const pageReferencesMountTimeout = largeBodyPreviewMode") &&
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
    !pageShell.includes('from "@/hooks/usePages"') &&
    !pageShell.includes("usePages({") &&
    pageShell.includes('status: "large-body-preview-ready"') &&
    pageShell.includes("preview_blocks: activePreview.blocks.length") &&
    pageShell.includes("aria-busy={openingEditor}") &&
    pageShell.includes("const upsertPages = useWorkspaceStore((s) => s.upsertPages)"),
  "PageShell 必须动态加载并在页面首屏后空闲预热编辑器，完整页面先显示标题和属性，不能让编辑器大包阻塞首屏"
);
check(
  blockCommentEventsSource.includes("BLOCK_COMMENTS_CHANGED_EVENT") &&
    blockCommentEventsSource.includes("INLINE_COMMENT_DELETED_EVENT") &&
    blockCommentEventsSource.includes("INLINE_COMMENT_SELECTED_EVENT") &&
    blockCommentsSource.includes("export interface BlockCommentsProps") &&
    blockCommentsSource.includes("@/components/shared/blockCommentEvents") &&
    commentSidePanelSource.includes("@/components/shared/blockCommentEvents") &&
    editorSource.includes("@/components/shared/blockCommentEvents"),
  "块评论事件常量必须从轻量文件导入，完整页面和编辑器不应为了事件名提前加载 BlockComments 重组件"
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
  "PageShell 正文输入应先合并保存最新正文，wiki 链接重建和自动版本快照应延迟到编辑停顿后执行"
);
check(
  pageShell.includes(
    "collectMovedPageSnapshots(useWorkspaceStore.getState().pages, moved)"
  ) &&
    pageShell.includes("upsertPages([child])") &&
    pageShell.includes("const optimisticDuplicate =") &&
    pageShell.includes("upsertPages([optimisticDuplicate])") &&
    pageShell.includes('openPage(optimisticDuplicate, { source: "duplicate-page-create" })') &&
    pageShell.indexOf('openPage(optimisticDuplicate, { source: "duplicate-page-create" })') <
      pageShell.indexOf("await updateWikiLinks(duplicate.id") &&
    !pageShell.includes("const { refresh } = usePages({ autoLoad: false })") &&
    !pageShell.includes("await refresh()"),
  "PageShell 页面粘贴/移动/创建子页面/复制后必须局部 upsert；复制页应先打开乐观副本，再后台写正文链接，不能触发全量 metadata 刷新"
);
check(
  !pageShell.includes("const pages = useWorkspaceStore((s) => s.pages)") &&
    !pageShell.includes('from "@/hooks/usePages"') &&
    !pageShell.includes("usePages({") &&
    pageShell.includes(
      "collectMovedPageSnapshots(useWorkspaceStore.getState().pages, moved)"
    ),
  "PageShell 完整页首屏不应订阅全量 pages；移动/剪切时再读取当前快照即可"
);
check(
  accountPageSync.includes('export const PAGE_SYNC_STATUS_EVENT = "zhinote:pagesync-status"') &&
    accountPageSync.includes("getPendingCloudPageSyncStatus") &&
    accountPageSync.includes("export function isCloudPagePendingSync") &&
    accountPageSync.includes("emitPageSyncStatusChanged();") &&
    pageShell.includes("PAGE_SYNC_STATUS_EVENT") &&
    pageShell.includes('PAGE_SYNC_STORAGE_KEY_PREFIX = "zhinote.pagesync."') &&
    pageShell.includes(
      'const loadPageAccountSyncModule = () => import("@/lib/pages/accountPageSync")'
    ) &&
    pageShell.includes("EMPTY_PAGE_SYNC_STATUS") &&
    pageShell.includes(
      "const { getPendingCloudPageSyncStatus, isCloudPagePendingSync } ="
    ) &&
    !pageShell.includes("import {\n  getPendingCloudPageSyncStatus") &&
    pageShell.includes("getPendingCloudPageSyncStatus") &&
    pageShell.includes("isCloudPagePendingSync(pageId)") &&
    pageShell.includes("function isPageSyncStorageEvent(") &&
    pageShell.includes("event.key.startsWith(PAGE_SYNC_STORAGE_KEY_PREFIX)") &&
    pageShell.includes('window.addEventListener("storage", handleStorageRefresh)') &&
    pageShell.includes("currentPagePendingSync") &&
    pageShell.includes("PageSyncStatusBadge") &&
    pageShell.includes("buildPageCloudSaveStatus") &&
    pageShell.includes("data-sync-status") &&
    pageShell.includes("data-blocks-cache-rebuild") &&
    pageShell.includes("router.push(target)") &&
    pageShell.includes('data-testid="page-sync-status-badge"') &&
    pageShell.includes("data-sync-target={status.sync_center_target}") &&
    pageShell.includes("aria-label={status.aria_label}") &&
    pageCloudSaveStatus.includes("current-page-needs-review") &&
    pageCloudSaveStatus.includes("current-page-failed") &&
    pageCloudSaveStatus.includes("global-page-failed") &&
    pageCloudSaveStatus.includes("当前页待云同步") &&
    pageCloudSaveStatus.includes("cloud-confirmed") &&
    pageCloudSaveStatus.includes("blocks_cache_rebuild") &&
    pageCloudSaveStatus.includes("sync_center_target") &&
    pageCloudSaveStatus.includes("/modules/sync#page-pending-upload-queue") &&
    pageCloudSaveStatus.includes("does not read page body text") &&
    pageCloudSaveStatus.includes("等待云同步") &&
    syncShell.includes('id="page-pending-upload-queue"') &&
    syncShell.includes('data-testid="page-pending-upload-queue"'),
  "PageShell 必须显示当前页/全局只读页面同步状态 badge，并提供到同步中心的队列查看入口"
);
check(
  pageTreeSource.includes("SIDEBAR_PAGE_TREE_ROOT_LIMIT") &&
    pageTreeSource.includes("SIDEBAR_PAGE_TREE_INITIAL_ROOT_LIMIT") &&
    pageTreeSource.includes("SIDEBAR_PAGE_TREE_CHILD_LIMIT") &&
    pageTreeSource.includes("SIDEBAR_PAGE_TREE_INITIAL_CHILD_LIMIT") &&
    pageTreeSource.includes("SIDEBAR_PAGE_TREE_IDLE_EXPAND_DELAY_MS") &&
    pageTreeSource.includes("scheduleSidebarPageTreeIdleTask") &&
    pageTreeSource.includes("childrenByParent") &&
    pageTreeSource.includes("visibleRootPages") &&
    pageTreeSource.includes("visibleChildren") &&
    pageTreeSource.includes("hiddenRootCount") &&
    pageTreeSource.includes("hiddenChildCount") &&
    pageTreeSource.includes("getTopLevelPageId") &&
    pageTreeSource.includes("getCurrentPagePathIds") &&
    pageTreeSource.includes("page.id === currentPageId") &&
    pageTreeSource.includes("currentPathIds.has(page.id)") &&
    pageTreeSource.includes("setExpanded(true)") &&
    pageTreeSource.includes("children.slice(0, childVisibleLimit)") &&
    pageTreeSource.includes("visibleChildren.map((child)") &&
    pageTreeSource.includes("已折叠 {hiddenChildCount} 个子页面") &&
    pageTreeSource.includes("isInHiddenModuleSubtree") &&
    pageTreeSource.includes("collectHiddenModuleSubtreeIds") &&
    pageTreeSource.includes("hiddenModuleSubtreeIds.has(page.id)") &&
    pageTreeSource.includes("visiting.has(page.id)") &&
    pageTreeSource.includes("useDeferredValue(pages)") &&
    pageTreeSource.includes("childVisibleLimit") &&
    pageTreeSource.includes("setRootVisibleLimit") &&
    pageTreeSource.includes("显示更多") &&
    pageTreeSource.includes("isDescendant(page.id, draggedId, pagesById)") &&
    pageTreeSource.includes("onPageMutated([child])") &&
    pageTreeSource.includes("collectMovedPageSnapshots(pages, movedPage)") &&
    pageTreeSource.includes("onPageMutated={upsertPages}") &&
    !pageTreeSource.includes("{children.map((child)") &&
    !pageTreeSource.includes("new Map(allPages.map") &&
    !pageTreeSource.includes("allPages={pages}") &&
    !pageTreeSource.includes("function getSiblings") &&
    !pageTreeSource.includes("onChanged={() => refresh()}") &&
    !pageTreeSource.includes("await refresh()"),
  "Sidebar PageTree 必须用 parent 索引、根/子页面渲染上限、按需显示更多、当前路径保留/自动展开和局部 upsert，避免 Notion 批量导入后拖慢全站"
);
check(
  pageContextMenuSource.includes("usePages({ autoLoad: false })") &&
    pageContextMenuSource.includes("upsertPages([duplicate])") &&
    pageContextMenuSource.includes("upsertPages(collectMovedPageSnapshots(pages, moved))") &&
    pageContextMenuSource.includes("deleted_at: deletedAt") &&
    !pageContextMenuSource.includes("await refresh()"),
  "PageContextMenu 复制/粘贴/移动/删除必须局部 upsert，不能依赖调用方全量刷新"
);
check(
  cloudPageMutationsSource.includes(
    'const loadPageAccountSyncModule = () => import("@/lib/pages/accountPageSync")'
  ) &&
    cloudPageMutationsSource.includes(
      "void queuePageCloudPush(page).catch(() => undefined)"
    ) &&
    cloudPageMutationsSource.includes(
      "Local page create failed; using cloud draft fallback"
    ) &&
    cloudPageMutationsSource.includes("createCloudDraftFallbackPage") &&
    cloudPageMutationsSource.includes('import { rememberPendingPageDraft } from "@/lib/pages/pendingPageDrafts"') &&
    cloudPageMutationsSource.includes("rememberPendingPageDraft(page)") &&
    cloudPageMutationsSource.includes("owner_id: DEFAULT_OWNER_ID") &&
    cloudPageMutationsSource.includes("sync_version: 0") &&
    cloudPageMutationsSource.includes("queuePageCloudDelete") &&
    pageContextMenuSource.includes(
      'const loadPageAccountSyncModule = () => import("@/lib/pages/accountPageSync")'
    ) &&
    pageContextMenuSource.includes("queuePageContextMenuCloudDelete") &&
    databaseCloudMutationsSource.includes(
      'const loadPageAccountSyncModule = () => import("@/lib/pages/accountPageSync")'
    ) &&
    databaseCloudMutationsSource.includes("queueDatabasePageCloudPush") &&
    !cloudPageMutationsSource.includes(
      'from "@/lib/pages/accountPageSync"'
    ) &&
    !pageContextMenuSource.includes('from "@/lib/pages/accountPageSync"') &&
    !databaseCloudMutationsSource.includes(
      'from "@/lib/pages/accountPageSync"'
    ),
  "页面/数据库 mutation 和右键菜单必须按需加载账号页面同步队列，不能拖慢模块首屏和右键菜单打开"
);
check(
  pageContextMenuSource.includes("export interface PageContextMenuProps") &&
    lazyPageContextMenuSource.includes("function loadPageContextMenu()") &&
    lazyPageContextMenuSource.includes("export function warmPageContextMenu()") &&
    lazyPageContextMenuSource.includes('import("@/components/page/PageContextMenu")') &&
    lazyPageContextMenuSource.includes("dynamic<PageContextMenuProps>(loadPageContextMenu") &&
    pageTreeSource.includes("@/components/page/LazyPageContextMenu") &&
    shells.daily.includes("@/components/page/LazyPageContextMenu") &&
    shells.schedule.includes("@/components/page/LazyPageContextMenu") &&
    shells.knowledge.includes("@/components/page/LazyPageContextMenu") &&
    shells.chain.includes("@/components/page/LazyPageContextMenu") &&
    !pageTreeSource.includes("@/components/page/PageContextMenu") &&
    !shells.daily.includes("@/components/page/PageContextMenu") &&
    !shells.schedule.includes("@/components/page/PageContextMenu") &&
    !shells.knowledge.includes("@/components/page/PageContextMenu") &&
    !shells.chain.includes("@/components/page/PageContextMenu"),
  "PageContextMenu 必须通过 LazyPageContextMenu 按右键意图加载，不能拖慢侧边栏、每日、会议、知识库、产业链首屏"
);
check(
  !sidebarSource.includes("usePages") &&
    sidebarSource.includes('import LazyQuickSearch from "./LazyQuickSearch"') &&
    sidebarSource.includes("<LazyQuickSearch />") &&
    !sidebarSource.includes('import QuickSearch from "./QuickSearch"') &&
    lazyQuickSearchSource.includes("dynamic<QuickSearchProps>") &&
    lazyQuickSearchSource.includes('() => import("./QuickSearch")') &&
    lazyQuickSearchSource.includes("preloadQuickSearch") &&
    lazyQuickSearchSource.includes("loadQuickSearch(true)") &&
    lazyQuickSearchSource.includes('event.key.toLowerCase() !== "k"') &&
    lazyQuickSearchSource.includes("isEditorTarget(event.target)") &&
    lazyQuickSearchSource.includes("initialOpen={initialOpen}") &&
    sidebarSource.includes('await import(\n        "@/lib/export/workspaceBackup"') &&
    quickSearchSource.includes('await import(\n        "@/lib/export/workspaceBackup"') &&
    !sidebarSource.includes('from "@/lib/export/workspaceBackup"') &&
    !quickSearchSource.includes('from "@/lib/export/workspaceBackup"') &&
    sidebarSource.includes('await import("@/lib/pages/cloudPageMutations")') &&
    sidebarSource.includes('await import("@/lib/database/cloudDatabaseMutations")') &&
    quickSearchSource.includes('await import("@/lib/pages/cloudPageMutations")') &&
    quickSearchSource.includes('await import("@/lib/database/cloudDatabaseMutations")') &&
    pageTreeSource.includes('await import("@/lib/pages/cloudPageMutations")') &&
    shells.daily.includes('await import(\n        "@/lib/pages/cloudPageMutations"') &&
    shells.knowledge.includes(
      'const loadPageMutationModule = () => import("@/lib/pages/cloudPageMutations")'
    ) &&
    shells.chain.includes(
      'const loadPageMutationModule = () => import("@/lib/pages/cloudPageMutations")'
    ) &&
    shells.schedule.includes(
      'const loadPageMutationModule = () => import("@/lib/pages/cloudPageMutations")'
    ) &&
    shells.schedule.includes(
      'const loadPageAccountSyncModule = () => import("@/lib/pages/accountPageSync")'
    ) &&
    !sidebarSource.includes('from "@/lib/pages/cloudPageMutations"') &&
    !sidebarSource.includes('from "@/lib/database/cloudDatabaseMutations"') &&
    !quickSearchSource.includes('from "@/lib/pages/cloudPageMutations"') &&
    !quickSearchSource.includes('from "@/lib/database/cloudDatabaseMutations"') &&
    !pageTreeSource.includes('from "@/lib/pages/cloudPageMutations"') &&
    !shells.daily.includes('from "@/lib/pages/cloudPageMutations"') &&
    !shells.knowledge.includes('from "@/lib/pages/cloudPageMutations"') &&
    !shells.chain.includes('from "@/lib/pages/cloudPageMutations"') &&
    !shells.schedule.includes('from "@/lib/pages/cloudPageMutations"') &&
    !shells.schedule.includes('from "@/lib/pages/accountPageSync"') &&
    sidebarSource.includes('openPage(page, { source: "sidebar-create" })') &&
    !quickSearchSource.includes("const { pages, refresh } = usePages()") &&
    quickSearchSource.includes("const pages = useWorkspaceStore((s) => s.pages)") &&
    quickSearchSource.includes("export interface QuickSearchProps") &&
    quickSearchSource.includes("initialOpen = false") &&
    quickSearchSource.includes("usePages({ autoLoad: false })") &&
    quickSearchSource.includes("upsertPages([page])") &&
    quickSearchSource.includes("upsertPages([result.page])") &&
    quickSearchSource.includes("const primeQuickSearchPageOpen = useCallback") &&
    quickSearchSource.includes('prepareLocalFirstPageNavigation(page, "quick-search-open")') &&
    quickSearchSource.includes("router.prefetch(`/page/${page.id}`)") &&
    quickSearchSource.includes("primeQuickSearchPageOpen(entry.page)") &&
    quickSearchSource.includes("handleEntryPrewarm(selectedEntry)") &&
    quickSearchSource.includes("onPointerDown={onPrewarm}") &&
    quickSearchSource.includes("QUICK_SEARCH_METADATA_SCAN_LIMIT") &&
    quickSearchSource.includes("searchPageMetadataSnapshot(pages, trimmedValue)") &&
    quickSearchSource.includes("searchPageMetadataFromLocalDb(") &&
    !quickSearchSource.includes("await refresh()") &&
    !favoritePagesSource.includes("usePages") &&
    favoritePagesSource.includes("useWorkspaceStore((s) => s.pagesById)") &&
    favoritePagesSource.includes("SIDEBAR_FAVORITE_VISIBLE_LIMIT") &&
    favoritePagesSource.includes("visibleFavoritePages.map((page)") &&
    favoritePagesSource.includes("已折叠 {hiddenFavoriteCount} 个收藏页面") &&
    !trashPagesSource.includes("usePages") &&
    trashPagesSource.includes("activePageCount") &&
    trashPagesSource.includes("upsertPages([restored])") &&
    trashPagesSource.includes("SIDEBAR_TRASH_VISIBLE_LIMIT") &&
    trashPagesSource.includes("visibleTrashPages.map((page)") &&
    trashPagesSource.includes("已折叠 {hiddenTrashCount} 个回收站页面"),
  "Sidebar/QuickSearch/FavoritePages/TrashPages 不应各自挂 usePages 或在创建页面后阻塞全量 metadata 刷新，收藏和回收站也必须限制一次性渲染数量"
);
check(
  moduleDashboardSource.includes("countActivePages") &&
    moduleDashboardSource.includes("countActiveDatabases") &&
    moduleDashboardSource.includes("refreshWorkspaceCounts") &&
    moduleDashboardSource.includes("subscribePagesUpdated") &&
    moduleDashboardSource.includes("subscribeDatabasesUpdated") &&
    moduleDashboardSource.includes("scheduleCountRefresh") &&
    moduleDashboardSource.includes("upsertPages([page])") &&
    moduleDashboardSource.includes("setPageCount((count) => count + 1)") &&
    moduleDashboardSource.includes("setDatabaseCount((count) => count + 1)") &&
    moduleDashboardSource.includes("const loadPageMutationModule = () =>") &&
    moduleDashboardSource.includes(
      'import("@/lib/pages/cloudPageMutations")'
    ) &&
    moduleDashboardSource.includes("const loadDatabaseMutationModule = () =>") &&
    moduleDashboardSource.includes(
      'import("@/lib/database/cloudDatabaseMutations")'
    ) &&
    moduleDashboardSource.includes("const loadModuleStarterActions = () =>") &&
    moduleDashboardSource.includes('import("@/lib/modules/actions")') &&
    !moduleDashboardSource.includes('from "@/hooks/usePages"') &&
    !moduleDashboardSource.includes('from "@/hooks/useDatabases"') &&
    !moduleDashboardSource.includes('from "@/lib/pages/cloudPageMutations"') &&
    !moduleDashboardSource.includes(
      'from "@/lib/database/cloudDatabaseMutations"'
    ) &&
    !moduleDashboardSource.includes('from "@/lib/modules/actions"') &&
    !moduleDashboardSource.includes("await refresh()") &&
    !moduleDashboardSource.includes("await refreshDatabases()"),
  "ModuleDashboard 只应读取轻量页面/数据库数量，创建后本地乐观更新，不能为了模块中心首屏或 starter 扫全量页面/数据库列表"
);
check(
    usePagesHook.includes("const cloudPages = cloud.pages.map(remoteMetadataToPage)") &&
    usePagesHook.includes("renderLocalPagesSnapshot") &&
    usePagesHook.includes("await renderLocalPagesSnapshot()") &&
    usePagesHook.includes("metadataFirstContent ? false : includeContent") &&
    usePagesHook.includes("mergeMetadataForCount(all, cloudPages)") &&
    usePagesHook.includes("setPages(cloudPages)") &&
    usePagesHook.includes("force: false") &&
    usePagesHook.includes("requireLocalCacheCoverage: false") &&
    usePagesHook.includes("const needsCloudCoverageRecovery =") &&
    usePagesHook.includes("!cloudSnapshotAuthoritative") &&
    usePagesHook.includes("(!localSnapshotLoaded || all.length === 0)") &&
    usePagesHook.includes("force: true") &&
    usePagesHook.includes("requireLocalCacheCoverage: true") &&
    usePagesHook.includes("cloudSnapshotAuthoritative = true") &&
    usePagesHook.includes("const refreshRequestRef = useRef(0)") &&
    usePagesHook.includes("const isCurrentRefresh = () => refreshRequestRef.current === requestId") &&
    usePagesHook.includes("const hasUsableLocalFirstPaint = localSnapshotLoaded && all.length > 0") &&
    usePagesHook.includes("void applyCloudMetadataDelta({") &&
    usePagesHook.includes("includeContent && !localSnapshotLoaded && all.length === 0") &&
    usePagesHook.indexOf("await renderLocalPagesSnapshot()") <
      usePagesHook.indexOf("const cloud = await syncCloudPageMetadataDelta") &&
    !usePagesHook.includes("fullRefresh: all.length === 0 || !localSnapshotLoaded") &&
    !usePagesHook.includes("applyRemotePageMetadata") &&
    usePagesHook.includes("autoLoad?: boolean") &&
    usePagesHook.includes("autoHydrateContent?: boolean") &&
    usePagesHook.includes("metadataFirstContent && autoHydrateContent"),
  "usePages 必须先显示本地热缓存，再用云端 metadata delta 校正；includeContent 模块只在本地缓存不可读时用云端 metadata 兜底"
);
check(
  workspaceStore.includes("canPatchPagesWithoutResort") &&
    workspaceStore.includes("patchPagesWithoutResort") &&
    workspaceStore.includes("hasWorkspaceOrderChange") &&
    workspaceStore.includes("if (pages.length === 0) return {};") &&
    workspaceStore.includes("pagesById: Map<string, Page>;") &&
    workspaceStore.includes("pagesById: indexPagesById(nextPages)") &&
    workspaceStore.includes("getPageById: (id) => get().pagesById.get(id)"),
  "Workspace store 必须为正文补齐/云端字段回填保留 no-resort upsert 快路径，并维护全局 page id 索引，避免大批量导入后每次小更新/打开都扫描全量页面"
);
check(
  usePageHook.includes("useWorkspaceStore.getState().getPageById(pageId)") &&
    pageTreeSource.includes("const pagesById = useWorkspaceStore((s) => s.pagesById)") &&
    favoritePagesSource.includes("const pagesById = useWorkspaceStore((s) => s.pagesById)") &&
    quickSearchSource.includes("getPageById(pageId)") &&
    shells.knowledge.includes("const pagesById = useWorkspaceStore((s) => s.pagesById)") &&
    shells.chain.includes("const pagesById = useWorkspaceStore((s) => s.pagesById)"),
  "页面打开、左侧页面树、收藏、快速搜索、知识库和产业链必须复用 workspace page id 索引，保持大库交互流畅"
);
check(
  pageUpdateBus.includes("PageUpdatePayload") &&
    pageUpdateBus.includes("emitPageSnapshotsUpdated") &&
    pageUpdateBus.includes('PAGE_LOCAL_UPDATE_EVENT = "zhinote:pages-local-updated"') &&
    pageUpdateBus.includes("new CustomEvent<PageUpdateMessage>(PAGE_LOCAL_UPDATE_EVENT") &&
    accountPageSync.includes("toPageUpdatePayloads") &&
    accountPageSync.includes("toPageUpdatePayloads(pulledPages)") &&
    usePagesHook.includes("message.pages?.length") &&
    !usePagesHook.includes('if (message.reason === "cloud-pull" && message.pages?.length)') &&
    usePagesHook.includes("emitPageSnapshotsUpdated(reason, incomingPages)") &&
    usePagesHook.includes("upsertPages(message.pages.map(remoteMetadataToPage))") &&
    !usePagesHook.includes("!includeContent &&\n        message.reason === \"cloud-pull\""),
  "页面多端同步事件必须携带轻量 metadata payload；当前标签页也要收到本地事件用于防抖同步，includeContent 模块不能全量重读正文"
);
check(
  pagePeekModal.includes("getPageMetadata") &&
    pagePeekModal.includes("getInitialPeekPage") &&
    pagePeekModal.includes("const initialPeekPage = getInitialPeekPage(pageId, initialPage)") &&
    pagePeekModal.includes("useState(() => initialPeekPage?.title ?? \"\")") &&
    pagePeekModal.includes("applyPeekMetadataSnapshot") &&
    pagePeekModal.includes("useWorkspaceStore.getState().getPageById(pageId)") &&
    pagePeekModal.includes("editorLoadRequested") &&
    pagePeekModal.includes("schedulePeekContentLoad") &&
    pagePeekModal.includes("PEEK_METADATA_ONLY_CONTENT_DELAY_MS = 260") &&
    pagePeekModal.includes("PEEK_METADATA_ONLY_CONTENT_IDLE_TIMEOUT_MS = 700") &&
    pagePeekModal.includes("PEEK_LARGE_BODY_HTML_CHARS = 180 * 1024") &&
    pagePeekModal.includes("PEEK_LARGE_BODY_EDITOR_DELAY_MS = 260") &&
    pagePeekModal.includes("PEEK_LARGE_BODY_EDITOR_IDLE_TIMEOUT_MS = 1600") &&
    pagePeekModal.includes("const isMetadataOnlyPeek =") &&
    pagePeekModal.includes("const hasLargeBodyForPeek = isLargePeekBodyForEditor(") &&
    pagePeekModal.includes("schedulePeekContentLoad(() => {\n        setEditorLoadRequested(true);\n      }, isMetadataOnlyPeek)") &&
    pagePeekModal.includes("schedulePeekEditorMount(() => {\n        setMountedEditorPageId(pageId);\n      }, hasLargeBodyForPeek)") &&
    pagePeekModal.includes("标题和属性已先显示，正在从本地缓存补齐正文") &&
    pagePeekModal.includes("标题和属性已先显示，正在排队补齐正文和编辑器") &&
    pagePeekModal.includes("弹窗已先显示标题和属性，编辑器正在空闲时段准备") &&
    pagePeekModal.includes("large_body_editor_deferred") &&
    pagePeekModal.includes("isLargePeekBodyForEditor(content") &&
    pagePeekModal.includes("enabled: editorLoadRequested") &&
    pagePeekModal.includes('surface: "peek"') &&
    pagePeekModal.includes("subscribePageBodyHydrationStatus(pageId, setBodyHydrationStatus)") &&
    pagePeekModal.includes("bodyHydrationLabel ??") &&
    pagePeekModal.includes("dynamic<IconPickerProps>(") &&
    pagePeekModal.includes('() => import("@/components/shared/IconPicker")') &&
    pagePeekModal.includes("dynamic<PagePropertiesProps>(") &&
    pagePeekModal.includes('() => import("@/components/page/PageProperties")') &&
    pagePeekModal.includes("PeekIconPickerSkeleton") &&
    pagePeekModal.includes("PeekPropertiesSkeleton") &&
    pagePeekModal.includes(
      'const loadPageAccountSyncModule = () => import("@/lib/pages/accountPageSync")'
    ) &&
    pagePeekModal.includes("rememberPendingPageDraft(nextPage)") &&
    pagePeekModal.includes("void pushPeekCloudPage(nextPage).catch(() => undefined)") &&
    pagePeekModal.includes("{childPagesEnabled ? (") &&
    shells.knowledge.includes("const peekPage = useMemo") &&
    shells.knowledge.includes("initialPage={peekPage}"),
  "PagePeekModal 必须优先显示已有页面元数据，再按需加载正文和编辑器"
);
check(
  !shells.daily.includes("getAllPageMetadata"),
  "DailyNotesShell 不应在日历刷新时调用 getAllPageMetadata 全量扫描"
);
check(
  scopedPageMetadata.includes("listScopedPageMetadata") &&
    scopedPageMetadata.includes("listPageMetadataByParentIds([rootId])") &&
    scopedPageMetadata.includes("currentLevelParentIds") &&
    scopedPageMetadata.includes(
      "listPageMetadataByParentIds(currentLevelParentIds)"
    ) &&
    scopedPageMetadata.includes("mergePageMetadata"),
  "scopedPageMetadata 必须按层批量读取 root-scoped 页面元数据，避免模块入口逐节点或全局扫页面"
);
check(
  localQueries.includes("export async function listPageMetadataByParentIds") &&
    localQueries.includes("const batchSize = 80") &&
    localQueries.includes("WHERE parent_id IN (${placeholders}) AND deleted_at IS NULL"),
  "local queries 必须提供按 parentId 批量读取 page metadata 的接口，减少知识库/产业链多层级加载往返"
);
check(
  shells.knowledge.includes("listScopedPageMetadata") &&
    shells.knowledge.includes("mergeScopedPages") &&
    shells.knowledge.includes("upsertWorkspacePages(incoming)") &&
    shells.knowledge.includes("buildIndustryCompanyLinkPathIndex") &&
    shells.knowledge.includes("industryLinksByCompanyId.get(card.id)") &&
    shells.knowledge.includes("产业链位置") &&
    shells.knowledge.includes("继续链入") &&
    shells.knowledge.includes("onOpenIndustryParent={openKnowledgePage}") &&
    shells.knowledge.includes("mergeScopedPages([page])") &&
    shells.knowledge.includes("mergeScopedPages([updatedLinkPage ?? linkPage])") &&
    shells.knowledge.includes("onChanged={() => void loadScopedPages()}") &&
    shells.knowledge.includes(
      'const loadPageMutationModule = () => import("@/lib/pages/cloudPageMutations")'
    ) &&
    !shells.knowledge.includes('from "@/lib/pages/cloudPageMutations"') &&
    !shells.knowledge.includes('from "@/hooks/usePages"') &&
    !shells.knowledge.includes("usePages(") &&
    !shells.knowledge.includes("await refresh()"),
  "KnowledgeBaseShell 必须按知识库/产业链 root 读取 scoped metadata，并在新建/链接/移动后本地合并，不能触发全局页面刷新"
);
check(
  industryCompanyLinks.includes(
    "export function buildIndustryCompanyLinkPathIndex"
  ) &&
    industryCompanyLinks.includes("Map<string, IndustryCompanyLinkPath[]>") &&
    industryCompanyLinks.includes("parentPath") &&
    industryCompanyLinks.includes("buildIndustryParentPath") &&
    industryCompanyLinks.includes("while (currentId && currentId !== industryRootId"),
  "industryChainCompanyLinks 必须提供公司页到产业链路径的索引，方便知识库直接显示已链入层级"
);
check(
  shells.knowledge.includes("@/components/page/LazyPagePeekModal") &&
    shells.knowledge.includes("warmPagePeekModal();") &&
    shells.knowledge.includes("onPrimeOpen={warmPagePeekModal}") &&
    shells.knowledge.includes("onPointerEnter={onPrimeOpen}") &&
    shells.knowledge.includes("onFocus={onPrimeOpen}"),
  "KnowledgeBaseShell 公司页卡片必须预热 lazy peek 弹窗，让知识库/产业链引用页面点击更快打开"
);
check(
  shells.chain.includes("listScopedPageMetadata") &&
    shells.chain.includes("mergeScopedPages") &&
    shells.chain.includes("upsertWorkspacePages(incoming)") &&
    shells.chain.includes("includeDescendants: false") &&
    shells.chain.includes("mergeScopedPages([child])") &&
    shells.chain.includes("mergeScopedPages([updatedLinkPage ?? linkPage])") &&
    shells.chain.includes("CompanyChainCoveragePanel") &&
    shells.chain.includes("unlinkedCompanyCandidates") &&
    shells.chain.includes("linkedCompanyCount") &&
    shells.chain.includes("buildIndustryParentOptions") &&
    shells.chain.includes("IndustryParentPickerDialog") &&
    shells.chain.includes("createCompanyLinkUnderParent") &&
    shells.chain.includes("知识库公司页 → 产业链层级") &&
    shells.chain.includes("这里只创建引用节点，不复制公司页正文") &&
    shells.chain.includes("onChanged={() => void loadScopedPages()}") &&
    shells.chain.includes(
      'const loadPageMutationModule = () => import("@/lib/pages/cloudPageMutations")'
    ) &&
    !shells.chain.includes('from "@/lib/pages/cloudPageMutations"') &&
    !shells.chain.includes('from "@/hooks/usePages"') &&
    !shells.chain.includes("usePages(") &&
    !shells.chain.includes("await refresh()"),
  "IndustryChainShell 必须只读取产业链树和知识库公司候选 scoped metadata，创建/链接后本地合并，不能触发全局页面刷新"
);
for (const token of [
  "seedDailyNoteForImmediateOpen",
  "const pageRoute = `/page/${optimisticNote.id}`",
  "warmPageRoute();",
  "router.prefetch(pageRoute)",
  "type OpeningDailyDraft",
  "setOpeningDraft({ pageId: optimisticNote.id, dateKey })",
  "title: dateKey",
  "data-testid={`daily-opening-note-${key}`}",
  'data-testid="daily-opening-draft-banner"',
  "没有跳转？打开页面",
  "hydrateDailyDateKey(key);\n                    warmPageRoute();",
  "const warmDailyPeekOpen = useCallback",
  "const warmDailyCreateOpenPath = useCallback",
  "onPointerEnter={warmDailyCreateOpenPath}",
  "const addNoteOnPointerDown = useCallback",
  "onPointerDown={(event) => addNoteOnPointerDown(event, todayKey)}",
  "onPointerDown={(event) => addNoteOnPointerDown(event, key)}",
  "onFocus={warmDailyCreateOpenPath}",
  "setPeekInitialPage(toDailyNoteSeed(seededNote, note));",
  'import("@/components/providers/PageShell")',
  "setPeekInitialPage(optimisticNote)",
  "setPeekPageId(optimisticNote.id)",
  "每日纪要已弹出",
  "openPage(note, { source })",
  'openPage(pageId, { source: "daily-open" })',
  "rememberPendingPageDraft(optimisticNote)",
  "upsertPages([optimisticNote])",
  "scheduleDailyIdleTask(() => {\n        writeOptimisticDailyHotCache({",
  "cachedHotSnapshot,\n        startDate,\n        endDate",
  "currentNotes: collectVisibleDailyNotesForHotCache(notesByDate)",
  "writeOptimisticDailyHotCache",
  "applyRemotePages([pageToRemoteRecord(note)])",
  "queueCloudPagePush(record)",
  "openNotePage",
]) {
  check(
    shells.daily.includes(token),
    `DailyNotesShell 新建纪要应直接弹出编辑页面，已有纪要仍可轻量预览，缺少 ${token}`
  );
}
check(
  !shells.daily.includes("DAILY_VISIBLE_CONTENT_WARMUP") &&
    !shells.daily.includes("collectVisibleDailyContentWarmupCandidates") &&
    !shells.daily.includes("warmDailyNoteContent") &&
    !shells.daily.includes("onMouseEnter={() => warmDailyNoteContent(note)}"),
  "DailyNotesShell 日历路径只能预热页面壳和 metadata；正文必须在 peek/full page 打开后按需补齐，不能 hover 或首屏批量预热正文"
);
check(
  shells.daily.indexOf("rememberPendingPageDraft(optimisticNote)") <
    shells.daily.indexOf("upsertPages([optimisticNote])") &&
    shells.daily.indexOf("upsertPages([optimisticNote])") <
      shells.daily.indexOf("setPeekInitialPage(optimisticNote)") &&
    shells.daily.indexOf("setPeekInitialPage(optimisticNote)") <
      shells.daily.indexOf("setPeekPageId(optimisticNote.id)") &&
    shells.daily.indexOf('openPage(optimisticNote, { source: "daily-create" })') <
      shells.daily.indexOf("writeOptimisticDailyHotCache") &&
    shells.daily.indexOf("setPeekPageId(optimisticNote.id)") <
      shells.daily.indexOf("writeOptimisticDailyHotCache") &&
    shells.daily.indexOf("writeOptimisticDailyHotCache") <
      shells.daily.indexOf("seedDailyNoteForImmediateOpen(optimisticNote)") &&
    shells.daily.includes("window.setTimeout(() =>") &&
    shells.daily.includes("current === dateKey ? null : current") &&
    shells.daily.indexOf("setPeekPageId(optimisticNote.id)") <
      shells.daily.indexOf("persistOptimisticDailyNote"),
  "DailyNotesShell 新增纪要必须先登记草稿和轻量缓存，再直接进入完整页面，快速释放 + 按钮并后台持久化"
);
check(
  shells.daily.includes("await applyRemotePages(records)") &&
    shells.daily.indexOf("await applyRemotePages(records)") <
      shells.daily.indexOf("return queueDailyCloudRecords(records)") &&
    shells.daily.includes("upsertPages(localPages)"),
  "DailyNotesShell 后台保存每日纪要必须先写本地可重建缓存和 pending queue 记录，再让账号同步后台上传"
);
check(
  shells.daily.includes("@/components/page/LazyPagePeekModal") &&
    shells.daily.includes("warmPagePeekModal();") &&
    shells.daily.includes("const warmDailyPeekOpen = useCallback") &&
    shells.daily.includes("warmDailyPeekOpen();") &&
    shells.daily.includes("onPointerEnter={warmDailyCreateOpenPath}") &&
    shells.daily.includes("const addNoteOnPointerDown = useCallback") &&
    shells.daily.includes("onPointerDown={(event) => addNoteOnPointerDown(event, todayKey)}") &&
    shells.daily.includes("onPointerDown={(event) => addNoteOnPointerDown(event, key)}") &&
    shells.daily.includes("onFocus={warmDailyCreateOpenPath}") &&
    !shells.daily.includes("const warmPageRoute = useCallback(() => {\n    warmPagePeekModal();") &&
    !shells.daily.includes("@/components/page/PagePeekModal") &&
    pagePeekModal.includes('dynamic(() => import("@/components/editor/Editor")') &&
    pagePeekModal.includes("readPendingPageDraft(pageId)") &&
    pagePeekModal.includes("readPageRouteHandoff(pageId)") &&
    pagePeekModal.includes("PEEK_METADATA_ONLY_CONTENT_DELAY_MS") &&
    lazyPagePeekModal.includes("function warmPagePeekEditor()") &&
    lazyPagePeekModal.includes('import("@/components/editor/Editor")') &&
    lazyPagePeekModal.includes("warmPagePeekEditor();") &&
    lazyPagePeekModal.includes("LocalFirstPeekLoadingShell") &&
    lazyPagePeekModal.includes("readLocalFirstLoadingSeed") &&
    lazyPagePeekModal.includes("readPendingPageDraft(pageId)") &&
    lazyPagePeekModal.includes("readPageRouteHandoff(pageId)") &&
    lazyPagePeekModal.includes("onReady?.(pageId)") &&
    lazyPagePeekModal.includes('status: seed ? "local-shell-ready" : "local-shell-loading"') &&
    lazyPagePeekModal.includes("新页面已在本机创建，完整编辑器正在载入。") &&
    lazyPagePeekModal.includes("打开完整页面继续编辑 ↗") &&
    lazyPagePeekModal.includes("已先显示本地页面信息") &&
    pagePeekModal.includes("onReady?: (pageId: string) => void") &&
    pagePeekModal.includes("onReady?.(pageId)") &&
    pagePeekModal.includes("const localFirstSeedPage = currentFallbackPage ?? currentInitialPage") &&
    pagePeekModal.includes("const isOptimisticDraft = localFirstSeedPage?.content_text === \"\"") &&
    pagePeekModal.includes("initialPage={initialPage}") &&
    pagePeekModal.includes("PeekMetadataRecoveryShell") &&
    pagePeekModal.includes("新页面已在本机创建，完整编辑器正在载入。") &&
    pagePeekModal.includes("已先显示本地页面信息") &&
    pagePeekModal.includes("打开完整页面继续编辑 ↗") &&
    pagePeekModal.includes("避免大批量导入后的页面打开被长正文拖慢") &&
    shells.daily.includes("const handlePeekReady = useCallback") &&
    shells.daily.includes("onReady={handlePeekReady}") &&
    shells.daily.includes("const creatingDateKeyRef = useRef<string | null>(null)") &&
    shells.daily.includes("const addNoteOnMouseDown = useCallback") &&
    shells.daily.includes("onMouseDown={(event) => addNoteOnMouseDown(event, todayKey)}") &&
    shells.daily.includes("onMouseDown={(event) => addNoteOnMouseDown(event, key)}") &&
    shells.daily.indexOf('primeDailyNoteOpen(note, "daily-open");') <
      shells.daily.indexOf("setOpeningNoteId(note.id);") &&
    shells.daily.includes('onPointerDown={() =>') &&
    shells.daily.includes('primeDailyNoteOpen(note, "daily-open")') &&
    shells.daily.includes('onFocus={() => primeDailyNoteOpen(note, "daily-open")}') &&
    !shells.daily.includes("fetchCloudPageById") &&
    !shells.daily.includes("scheduleDailyPeekPreload") &&
    !shells.daily.includes('import("@/components/editor/Editor")'),
  "DailyNotesShell 应通过懒加载 PagePeekModal、动态编辑器和本地壳打开纪要，保证日历打开路径不预拉正文"
);
check(
  shells.daily.includes("const visibleLimit = isExpanded") &&
    shells.daily.includes("const visibleNotes = dayNotes.slice(0, visibleLimit)") &&
    shells.daily.includes("Math.min(totalCount, currentLimit + DAILY_CALENDAR_EXPAND_BATCH)") &&
    shells.daily.includes("DAILY_CALENDAR_MANUAL_DAY_LOAD_LIMIT") &&
    shells.daily.includes("const [loadingMoreDateKey, setLoadingMoreDateKey]") &&
    shells.daily.includes("const loadMoreNotesForDate = useCallback") &&
    shells.daily.includes("const targetRangeLimit = Math.min") &&
    shells.daily.includes("currentLoadedCount + DAILY_CALENDAR_MANUAL_DAY_LOAD_LIMIT") &&
    shells.daily.includes("rangeLimit: targetRangeLimit") &&
    shells.daily.includes("正在补齐…") &&
    shells.daily.includes("点击补齐") &&
    shells.daily.includes("再显示 ${nextBatchCount} 条") &&
    !shells.daily.includes("? dayNotes\n                : dayNotes.slice"),
  "DailyNotesShell 展开某一天时也必须分批渲染；超大单日只能按当天补齐 metadata，不能一次性把大批量导入纪要全部挂到 DOM"
);
check(
  shells.daily.includes("DAILY_CALENDAR_INITIAL_HYDRATED_DAY_LIMIT") &&
    shells.daily.includes("DAILY_CALENDAR_HYDRATION_BATCH") &&
    shells.daily.includes("buildOccupiedDailyCalendarHydrationKeys(") &&
    shells.daily.includes("const occupiedDateKeys = buildOccupiedDailyCalendarHydrationKeys") &&
    shells.daily.includes("for (const dateKey of occupiedDateKeys)") &&
    shells.daily.includes("return changed ? next : current;") &&
    !shells.daily.includes("const revealNextOccupiedBatch = () =>") &&
    !shells.daily.includes("DAILY_CALENDAR_OCCUPIED_HYDRATION_BATCH") &&
    shells.daily.includes("const [hydratedDateKeys, setHydratedDateKeys]") &&
    shells.daily.includes("buildInitialDailyCalendarHydrationKeys(") &&
    shells.daily.includes("const remainingDateKeys = allDateKeys.filter") &&
    shells.daily.includes("const revealNextBatch = () =>") &&
    shells.daily.includes("!isDateHydrated && dayTotalCount > 0") &&
    shells.daily.includes("点开查看") &&
    shells.daily.includes("hydrateDailyDateKey(key);") &&
    shells.daily.includes("isDateHydrated && visibleNotes.map") &&
    shells.daily.includes("isDateHydrated && dayTotalCount > DAILY_CALENDAR_VISIBLE_LIMIT"),
  "DailyNotesShell 大批量每日纪要必须立即显示有内容日期的轻量 metadata，但单日详情和空白日期仍按小批次激活，避免首屏一次性挂载大量按钮"
);
check(
  shells.schedule.includes("MEETING_CALENDAR_EXPAND_BATCH") &&
    shells.schedule.includes("MEETING_CALENDAR_MANUAL_DAY_LOAD_LIMIT") &&
    shells.schedule.includes("MEETING_UPCOMING_VISIBLE_LIMIT") &&
    shells.schedule.includes("MEETING_NOTES_VISIBLE_LIMIT") &&
    shells.schedule.includes("getUpcomingMeetingEntries(") &&
    shells.schedule.includes("getRecentCompletedMeetingEntries(") &&
    shells.schedule.includes("function getRecentCompletedMeetingEntries(") &&
    shells.schedule.includes("MEETING_CALENDAR_REVEAL_BUFFER") &&
    shells.schedule.includes("visibleMeetingLimitByDate") &&
    shells.schedule.includes("const [loadingMoreMeetingDateKey, setLoadingMoreMeetingDateKey]") &&
    shells.schedule.includes("showMoreMeetingsForDate") &&
    shells.schedule.includes("loadMoreMeetingsForDate") &&
    shells.schedule.includes("rangeLimit: targetRangeLimit") &&
    shells.schedule.includes("revealMeetingOnCalendar") &&
    shells.schedule.includes("pendingCalendarFocusDateKeyRef") &&
    shells.schedule.includes("requestAnimationFrame") &&
    shells.schedule.includes("type MeetingCalendarLoadOptions") &&
    shells.schedule.includes(
      "const interruptCloud = opts?.interruptCloud ?? includeCloud"
    ) &&
    shells.schedule.includes("!interruptCloud && loadRequestRef.current > 0") &&
    shells.schedule.includes("preserveVisibleMeetings") &&
    shells.schedule.includes(
      "retainVisibleMeetingPagesForBackgroundRefresh"
    ) &&
    shells.schedule.includes("const mergedMeetings = mergeMeetingPages(") &&
    shells.schedule.includes("const nextMeetings = selection.pages") &&
    shells.schedule.includes("publishMeetingCalendarRenderSelection(") &&
    shells.schedule.includes("startTransition(() => {\n    if (!shouldPublish()) return;") &&
    shells.schedule.includes("setMeetings(pages)") &&
    shells.schedule.includes("setExpandedMeetingDateKeys((current) =>") &&
    shells.schedule.includes("setVisibleMeetingLimitByDate((limits) =>") &&
    shells.schedule.includes("buildOccupiedMeetingCalendarHydrationKeys") &&
    shells.schedule.includes("const occupiedDateKeys = buildOccupiedMeetingCalendarHydrationKeys") &&
    shells.schedule.includes("for (const dateKey of occupiedDateKeys)") &&
    shells.schedule.includes("return changed ? next : current;") &&
    !shells.schedule.includes("const revealNextOccupiedBatch = () =>") &&
    !shells.schedule.includes("MEETING_CALENDAR_OCCUPIED_HYDRATION_BATCH") &&
    shells.schedule.includes("revealMeetingOnCalendar(optimisticPage)") &&
    shells.schedule.includes("revealMeetingOnCalendar(finalPage)") &&
    shells.schedule.includes("const visibleLimit = isExpanded") &&
    shells.schedule.includes("const visibleMeetings = dayMeetings.slice(0, visibleLimit)") &&
    shells.schedule.includes("Math.min(totalCount, currentLimit + MEETING_CALENDAR_EXPAND_BATCH)") &&
    shells.schedule.includes("再显示 ${nextBatchCount} 场") &&
    shells.schedule.includes("点击补齐 ${visibleMeetings.length}/${dayTotalCount} 场") &&
    shells.schedule.includes("正在补齐…") &&
    shells.schedule.includes("dayMeetings.length > MEETING_CALENDAR_VISIBLE_LIMIT") &&
    !shells.schedule.includes(".sort((a, b) => a.dateKey.localeCompare(b.dateKey))\n      .slice(0, 8)") &&
    !shells.schedule.includes(".sort((a, b) =>\n          (b.page.updated_at || \"\").localeCompare(a.page.updated_at || \"\")\n        )\n        .slice(0, 20)") &&
    !shells.schedule.includes("? dayMeetings\n                : dayMeetings.slice"),
  "MeetingScheduleShell 应立即显示有会议日期的轻量 metadata；展开某一天时仍必须分批渲染，不能一次性把大批量导入会议全部挂到 DOM"
);
for (const token of [
  "daily_date_key",
  "idx_pages_daily_date",
  "listDailyPageMetadataForCalendar",
  "rebuildPageDateKeyIndex",
  "inferDailyDateKey",
  "DAILY_CALENDAR_FALLBACK_SCAN_LIMIT",
  "DAILY_CALENDAR_TARGETED_FALLBACK_LIMIT",
  "DAILY_CALENDAR_CHILD_FALLBACK_LIMIT",
  "DAILY_RECENT_CANDIDATE_MULTIPLIER",
  "isDailyScopePage",
  "includeRemaining?: boolean",
  "dailyDateCandidateWhere",
  "buildDailyRangeSearchTokens",
  "inferDailyDateKeyInRange",
  "resolveMonthDayInRange",
  "ENGLISH_MONTH_INDEX",
  "DAILY_RANGE_SEARCH_TOKEN_LIMIT",
  "includeUnindexedFallback?: boolean",
  "if (includeUnindexedFallback)",
  "dailyFastScopeWhere",
  "daily_date_key IS NULL",
]) {
  check(
    localQueries.includes(token) ||
      localSchema.includes(token) ||
      localClient.includes(token),
    `每日纪要日期索引缺少 ${token}`
  );
}
check(
  !localQueries.includes("WITH RECURSIVE daily_descendants") &&
    localQueries.includes("p.daily_date_key >= ?") &&
    localQueries.includes("p.daily_date_key <= ?") &&
    localQueries.includes('${includeUnindexedFallback ? "" : `AND ${dailyFastScopeWhere("p")}`}') &&
    localQueries.includes("addIfDailyScope(row)") &&
    localQueries.includes("targetedFallbackRows") &&
    localQueries.includes("dateParentIdsForChildren") &&
    localQueries.includes("SELECT parent_id FROM pages WHERE id = ?"),
  "每日纪要月历首屏应先按日期索引取候选，再用当前月份 token 和日期父页子节点做 bounded metadata fallback，不能递归展开整棵每日纪要树"
);
check(
  localQueries.includes("listMeetingPageMetadataForCalendar({") &&
    localQueries.includes("rangeLimit?: number") &&
    localQueries.includes("const boundedRangeLimit =") &&
    localQueries.includes("${boundedRangeLimit === null ? \"\" : \"LIMIT ?\"}") &&
    localQueries.includes(": [startDate, endDate, rootId, boundedRangeLimit]"),
  "会议日历单日补齐应支持 rangeLimit 下推到本地 metadata 查询，不能为某一天补齐而扫描完整会议目录"
);
for (const token of [
  "installLocalSchema(db)",
  "Local SQLite cache schema failed",
  "using rebuildable in-memory cache",
  "CREATE_TABLES_WITHOUT_LATE_MIGRATION_INDEXES",
  "resetPersistentLocalCache",
  "LOCAL_CACHE_BYPASS_KEY",
  "LOCAL_CACHE_RECOVERY_EVENT",
  "LOCAL_CACHE_RECOVERY_SIGNAL_KEY",
  "LOCAL_CACHE_RECOVERY_SIGNAL_TTL_MS",
  "markLocalCacheNeedsCloudRecovery",
  "getLocalCacheRecoverySignal",
  "parseLocalCacheRecoverySignal",
  "isLocalCacheRecoverySignalExpired",
  "clearLocalCacheRecoverySignal",
  "Date.now() - createdAt > LOCAL_CACHE_RECOVERY_SIGNAL_TTL_MS",
  "window.localStorage.removeItem(LOCAL_CACHE_RECOVERY_SIGNAL_KEY)",
  "persistent-cache-reset",
  "persistent-cache-bypass",
  "persistent-cache-bypassed",
  "wrapRawDb(createMemoryDb())",
]) {
  check(
    localClient.includes(token),
    `本地 SQLite 缓存初始化应在 schema 失败时退回可重建临时缓存，缺少 ${token}`
  );
}

// Industry chain: every node is a page, expandable, inline rename
for (const token of ["ChainNode", "onAddChild", "onRename", "onDoubleClick"]) {
  check(shells.chain.includes(token), `IndustryChainShell 缺少 ${token}`);
}

// Meeting schedule: manual add + properties + explicit safety boundary
for (const token of [
  "buildMonthGrid",
  "新建会议",
  "会议信息输入",
  "导入",
  "会议详情",
  "会议密码",
  "录制设备",
  "组织者",
  "平台",
  "不会自动开麦克风",
]) {
  check(shells.schedule.includes(token), `MeetingScheduleShell 缺少 ${token}`);
}
const meetingScheduleOpensCreatedPageRoute =
  shells.schedule.includes("const pageRoute = `/page/${page.id}`") ||
  shells.schedule.includes("const pageRoute = `/page/${result.page.id}`") ||
  shells.schedule.includes("const pageRoute = `/page/${seededPage.id}`");
check(
  shells.schedule.includes('router.prefetch("/page/zhinote-route-prefetch")') &&
    shells.schedule.includes("creatingMeetingDateKey") &&
    shells.schedule.includes("pageShellWarmupRef") &&
    shells.schedule.includes("useLocalFirstPageNavigation") &&
    shells.schedule.includes("warmMeetingPageRoute") &&
    shells.schedule.includes("const warmMeetingPeekOpen = useCallback") &&
    shells.schedule.includes("warmMeetingPeekOpen();") &&
    shells.schedule.includes("onPointerEnter={warmMeetingPeekOpen}") &&
    shells.schedule.includes("onPointerDown={warmMeetingPeekOpen}") &&
    shells.schedule.includes("const creatingMeetingDateKeyRef = useRef<string | null>(null)") &&
    shells.schedule.includes("creatingMeetingDateKeyRef.current = dateKey") &&
    shells.schedule.includes("const addMeetingOnPointerDown = useCallback") &&
    shells.schedule.includes("const addMeetingOnMouseDown = useCallback") &&
    shells.schedule.includes("onPointerDown={(event) => addMeetingOnPointerDown(event, key)}") &&
    shells.schedule.includes("onMouseDown={(event) => addMeetingOnMouseDown(event, key)}") &&
    shells.schedule.includes("onFocus={warmMeetingPeekOpen}") &&
    shells.schedule.includes("const [openingDraft, setOpeningDraft]") &&
    shells.schedule.includes("const [openingMeetingId, setOpeningMeetingId]") &&
    shells.schedule.includes("setOpeningDraft({") &&
    shells.schedule.includes("setOpeningMeetingId(optimisticPage.id);") &&
    shells.schedule.includes("const clearFailedLocalMeetingCreate = () =>") &&
    shells.schedule.includes("current.filter((item) => item.id !== optimisticPage.id)") &&
    shells.schedule.includes("新建会议时本地草稿准备失败，会议日历仍保留现有内容。") &&
    shells.schedule.includes("已有会议和本地缓存没有被删除，可以稍后重试。") &&
    shells.schedule.includes("void seedMeetingPageForImmediateOpen(optimisticPage);") &&
    shells.schedule.includes("data-testid={`meeting-opening-page-${key}`}") &&
    shells.schedule.includes('data-testid="meeting-opening-draft-banner"') &&
    shells.schedule.includes("openingMeetingId === entry.page.id") &&
    shells.schedule.includes("onReady={handlePeekReady}") &&
    !shells.schedule.includes("const warmMeetingPageRoute = useCallback(() => {\n    warmPagePeekModal();") &&
    shells.schedule.includes("prepareMeetingPageOpen") &&
    shells.schedule.includes('import("@/components/providers/PageShell")') &&
    shells.schedule.includes("const primeMeetingEntryPage = useCallback") &&
    shells.schedule.includes("const seededPage = getMeetingPagePrimeSeed(page)") &&
    shells.schedule.includes('rememberPageRouteHandoff(seededPage, "meeting-open")') &&
    shells.schedule.includes("function getMeetingPagePrimeSeed(page: Page)") &&
    shells.schedule.includes('if (seededPage.content_text === "") return seededPage;') &&
    shells.schedule.includes("content_text: null") &&
    shells.schedule.includes("content_yjs: null") &&
    shells.schedule.includes("primeMeetingEntryPage(entry.page)") &&
    shells.schedule.includes("onPrimeOpen={() => primeMeetingEntryPage(selectedMeeting.page)}") &&
    shells.schedule.includes('importSource: "手动创建"') &&
    shells.schedule.includes("openCreatedMeetingPage") &&
    meetingScheduleOpensCreatedPageRoute &&
    shells.schedule.includes("router.prefetch(pageRoute)") &&
    shells.schedule.includes("openPage(page, { source })") &&
    shells.schedule.includes("prepareMeetingPageOpen(page, source)") &&
    shells.schedule.includes('prepareMeetingPageOpen(page, "meeting-create")') &&
    shells.schedule.includes("setPeekInitialPage(page)") &&
    shells.schedule.includes("setPeekPageId(page.id)") &&
    shells.schedule.includes('status: "meeting-create-local-shell-requested"') &&
    shells.schedule.includes("local_handoff_seeded: 1") &&
    shells.schedule.includes("let seededPage = page") &&
    shells.schedule.includes("seededPage = getMeetingPageOpenSeed(page)") &&
    shells.schedule.includes("Meeting page local prepare failed") &&
    shells.schedule.includes("打开会议页时本地预热失败，已继续打开页面；会议数据没有被删除。") &&
    shells.schedule.includes("Meeting page local prime failed") &&
    shells.schedule.includes("会议详情本地预热失败，已保留当前日历内容；仍可继续打开会议页。") &&
    shells.schedule.includes("rememberPendingPageDraft(seededPage)") &&
    shells.schedule.includes("rememberPageRouteHandoff(seededPage, source)") &&
    !shells.schedule.includes("const warmMeetingPageContent = useCallback") &&
    !shells.schedule.includes("onMouseEnter={() => warmMeetingPageContent(entry.page)}") &&
    !shells.schedule.includes("warmMeetingPageContent(") &&
    !shells.schedule.includes("MEETING_VISIBLE_CONTENT_WARMUP") &&
    !shells.schedule.includes("collectVisibleMeetingContentWarmupCandidates") &&
    shells.schedule.includes("const openMeetingDetail = useCallback") &&
    shells.schedule.includes('openPage(pageId, { source: "meeting-open" })') &&
    shells.schedule.includes("const entriesById = useMemo(() =>") &&
    shells.schedule.includes("entriesById.get(pageId)?.page") &&
    shells.schedule.includes("readPendingPageDraft(pageId) ??") &&
    shells.schedule.includes("readPageRouteHandoff(pageId) ??") &&
    shells.schedule.includes("openCreatedMeetingPage(result.page)") &&
    shells.schedule.includes("): CreateMeetingResult =>") &&
    shells.schedule.includes("const result = createMeetingPage(form") &&
    shells.schedule.includes("const result = createMeetingPage(draft") &&
    shells.schedule.includes("return queueMeetingCloudRecords(records)") &&
    shells.schedule.includes("function queueMeetingCloudRecords") &&
    shells.schedule.includes("queueCloudPagePush(record)") &&
    !shells.schedule.includes("const result = await pushCloudPages(records)") &&
    !shells.schedule.includes("): Promise<CreateMeetingResult> =>") &&
    shells.schedule.includes("后台会继续保存到账号云端") &&
    shells.schedule.includes('data-testid="meeting-intake-import-button"') &&
    shells.schedule.includes("disabled={intakeLoading || !intakeText.trim()}") &&
    !shells.schedule.includes("disabled={intakeLoading || !rootId || !intakeText.trim()}") &&
    !shells.schedule.includes('rootId ? "导入" : "加载中..."'),
  "MeetingScheduleShell 手动创建和导入会议应直接进入本地优先流程，导入按钮不能等待模块根页面先加载；会议页和 root 保存必须走统一云端上传队列；日历和 hover 只能预热页面壳/路由，不能提前读取会议正文"
);
check(
  shells.schedule.includes("listDailyPageMetadataForCalendar({") &&
    shells.schedule.includes("startDate: dateKeys[0]") &&
    shells.schedule.includes("endDate: dateKeys[dateKeys.length - 1]") &&
    shells.schedule.includes("completedMeetingDailyLinkKeyRef") &&
    shells.schedule.includes("scheduleMeetingIdleTask(() =>") &&
    shells.schedule.includes("linkCompletedMeetingsToDaily(notesToLink)") &&
    !shells.schedule.includes("const dailyPages = await listPages(dailyRootId)") &&
    !shells.schedule.includes("const dailyPages = await listPageMetadata(dailyRootId)"),
  "MeetingScheduleShell 关联每日纪要时应按日期范围读 metadata，并在浏览器空闲时去重执行，不能扫描完整每日根或读取所有正文"
);
check(
  shells.schedule.includes("localPagesForMerge = await listMeetingPageMetadataForCalendar({") &&
    shells.schedule.includes("const meetingCalendarRenderFingerprintRef = useRef(\"\")") &&
    shells.schedule.includes("publishMeetingCalendarRenderSelection(") &&
    shells.schedule.includes("function publishMeetingCalendarRenderSelection(") &&
    shells.schedule.includes("meetingPagesRenderFingerprint(pages)") &&
    shells.schedule.includes("meetingDateCountsFingerprint(countsByDate)") &&
    shells.schedule.includes("fingerprintRef.current === nextFingerprint") &&
    shells.schedule.includes("MEETING_INITIAL_CLOUD_RECHECK_DELAY_MS") &&
    shells.schedule.includes("MEETING_INITIAL_CLOUD_RECHECK_IDLE_TIMEOUT_MS") &&
    shells.schedule.includes("void load({\n        includeCloud: false,\n        interruptCloud: false,\n        preserveVisibleMeetings: true,\n      });") &&
    shells.schedule.includes("cancelCloudRecheck = scheduleMeetingIdleTask(() => {\n        void load({\n          includeCloud: true,\n          preserveVisibleMeetings: true,\n        });\n      }, MEETING_INITIAL_CLOUD_RECHECK_IDLE_TIMEOUT_MS);") &&
    !shells.schedule.includes("localPagesForMerge = await listPages(id)") &&
    !shells.schedule.includes("localPagesForMerge = await listPageMetadata(id)") &&
    !shells.schedule.includes("import { listPages"),
  "MeetingScheduleShell 日历首屏应按日期范围只读本地会议 metadata，云端校正延后到空闲任务，不能为渲染日历扫描完整会议根或读取正文"
);
check(
  !shells.schedule.includes('from "@/hooks/usePages"') &&
    !shells.schedule.includes("usePages(") &&
    !shells.schedule.includes("await refresh()") &&
    !shells.schedule.includes("void refresh()"),
  "MeetingScheduleShell 创建、导入和状态更新后必须局部更新日历与热缓存，不能触发全局页面刷新"
);

// 4. Sidebar promotes the primary workspaces, demotes the rest to 备选模块, and lets
// owner reorder the primary sidebar items locally.
const sidebar = read("src/components/sidebar/Sidebar.tsx");
for (const token of ["MODULE_WORKSPACE_LIST", "备选模块"]) {
  check(sidebar.includes(token), `Sidebar 缺少 ${token}`);
}
for (const token of [
  "SIDEBAR_PRIMARY_ORDER_KEY",
  "DEFAULT_PRIMARY_ITEMS",
  "handlePrimaryPointerDown",
  "handlePrimaryPointerMove",
  "handlePrimaryPointerEnd",
  "data-sidebar-primary-id",
  "SIDEBAR_PRIMARY_CUSTOMIZATION_KEY",
  "editingPrimaryItem",
  "handlePrimaryEditSave",
  "handlePrimaryEditReset",
  "组合管理",
]) {
  check(sidebar.includes(token), `Sidebar 缺少主导航拖拽排序能力 ${token}`);
}
// HTML5 drag-and-drop must stay off the primary Links: a native anchor drag
// cancels pointer events mid-gesture and breaks the reorder interaction.
check(
  !sidebar.includes("handlePrimaryDragStart"),
  "Sidebar 主导航应使用指针拖拽，不应再挂 HTML5 drag 处理器"
);

// 5. Page tree hides module roots
const pageTree = read("src/components/sidebar/PageTree.tsx");
check(
  pageTree.includes("getModuleRootIdsSync") &&
    pageTree.includes("MODULE_ROOT_IDS_EVENT") &&
    pageTree.includes("setModuleRootIds(new Set(getModuleRootIdsSync()))") &&
    pageTree.includes('event.key?.startsWith("zhinote.moduleRoot.")') &&
    pageTree.includes("collectHiddenModuleSubtreeIds") &&
    pageTree.includes("hiddenModuleSubtreeIds.has(page.id)") &&
    !pageTree.includes("useMemo(() => new Set(getModuleRootIdsSync()), [])"),
  "PageTree 必须隐藏模块根页面及其子树，并在云端认领 root id 后无需刷新即可更新"
);

if (errors.length > 0) {
  console.error("Module workspaces verification FAILED:");
  for (const err of errors) console.error(`  - ${err}`);
  process.exit(1);
}

console.log("Module workspaces verification passed");
console.log(
  JSON.stringify(
    {
      workspaces: 4,
      routes: 4,
      cloud_root_recovery: true,
      sidebar_promoted: true,
      page_tree_hides_roots: true,
    },
    null,
    2
  )
);
