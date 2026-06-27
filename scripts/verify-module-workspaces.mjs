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
const usePageHook = read("src/hooks/usePage.ts");
const usePagesHook = read("src/hooks/usePages.ts");
const pagePeekModal = read("src/components/page/PagePeekModal.tsx");
const lazyPagePeekModal = read("src/components/page/LazyPagePeekModal.tsx");
const pageShell = read("src/components/providers/PageShell.tsx");
const pendingPageDrafts = read("src/lib/pages/pendingPageDrafts.ts");
const sidebarSource = read("src/components/sidebar/Sidebar.tsx");
const quickSearchSource = read("src/components/sidebar/QuickSearch.tsx");
const favoritePagesSource = read("src/components/sidebar/FavoritePages.tsx");
const trashPagesSource = read("src/components/sidebar/TrashPages.tsx");
const moduleDashboardSource = read("src/components/modules/ModuleDashboard.tsx");
const pageTreeSource = read("src/components/sidebar/PageTree.tsx");
const pageContextMenuSource = read("src/components/page/PageContextMenu.tsx");
const pageUpdateBus = read("src/lib/pages/pageUpdateBus.ts");
const accountPageSync = read("src/lib/pages/accountPageSync.ts");
const scopedPageMetadata = read("src/lib/pages/scopedPageMetadata.ts");
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
  'openPage(optimisticNote, { source: "daily-create" })',
  "<PagePeekModal",
  "rememberPendingPageDraft(optimisticNote)",
  "openNotePage",
  "DAILY_DATE_INDEX_BACKFILL_KEY",
  "getModuleRootIdSync",
  "loadRequestRef",
  "observedPageRevisionRef",
  "applyRemotePages",
  "DAILY_DATE_INDEX_BACKFILL_BATCH",
  "DAILY_DATE_INDEX_BACKFILL_MAX_PASSES",
  "waitForDailyBackfillIdle",
  "DAILY_CALENDAR_EXPAND_BATCH",
  "visibleNoteLimitByDate",
  "showMoreNotesForDate",
]) {
  check(shells.daily.includes(token), `DailyNotesShell 缺少每日纪要性能护栏 ${token}`);
}
check(
  shells.daily.includes('await findLocalModuleRootId("daily")') &&
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
    helper.includes("Date.now() - cloudModuleRootLookupCache.cachedAt") &&
    helper.includes('window.localStorage.getItem(PAGE_SYNC_ENABLED_KEY) === "false"'),
  "moduleWorkspaces 云端 root 认领必须共享 in-flight 请求并尊重页面同步本地关闭开关"
);
check(
  helper.includes("window.dispatchEvent(new CustomEvent(MODULE_ROOT_IDS_EVENT))"),
  "moduleWorkspaces 写入 root id 缓存后必须广播本地事件，避免侧边栏等 UI 等到刷新才更新"
);
check(
  !usePageHook.includes("setLoading(localPage.content_text == null)") &&
    usePageHook.includes("if (localPage) {") &&
    usePageHook.includes("readLocalFirstPageSeed") &&
    usePageHook.includes("if (!dbReady)") &&
    usePageHook.includes("setLoading(!localPage)") &&
    usePageHook.includes("setLoading(false);") &&
    usePageHook.includes("schedulePageCloudHydration(pageId, localPage, setPage, upsertPages)") &&
    usePageHook.includes("requestIdleCallback(run") &&
    usePageHook.includes("PAGE_CLOUD_HYDRATION_IDLE_MS") &&
    !usePageHook.includes("cloudPagePromise"),
  "usePage 必须把 metadata/handoff 当作可首屏打开状态，云端正文 idle 后台补齐，不能抢在本地首屏前发云端正文查询"
);
check(
  usePageHook.includes("options: UsePageOptions") &&
    usePageHook.includes("enabled = options.enabled ?? true"),
  "usePage 必须支持延后加载正文，避免 peek 弹窗打开时立即拉取大正文"
);
check(
  usePageHook.includes("readPendingPageDraft(pageId)") &&
    usePageHook.indexOf("readPendingPageDraft(pageId)") <
      usePageHook.indexOf("useWorkspaceStore.getState().pages.find") &&
    pendingPageDrafts.includes("PENDING_PAGE_DRAFT_TTL_MS") &&
    pendingPageDrafts.includes("PENDING_PAGE_DRAFT_MAX_CHARS") &&
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
  pageShell.includes("const loadEditorModule = () => import(\"@/components/editor/Editor\")") &&
    pageShell.includes("const Editor = dynamic(loadEditorModule") &&
    pageShell.includes("loading: () => <PageBodySkeleton />") &&
    !pageShell.includes("import Editor from \"@/components/editor/Editor\"") &&
    pageShell.includes("return scheduleEditorMount(() => {\n      void loadEditorModule();\n      setEditorMounted(true);") &&
    pageShell.includes("requestIdleCallback(callback, { timeout: 300 })") &&
    pageShell.includes("usePages({ autoLoad: false })"),
  "PageShell 必须动态加载并在页面首屏后空闲预热编辑器，完整页面先显示标题和属性，不能让编辑器大包阻塞首屏"
);
check(
  pageShell.includes("collectMovedPageSnapshots(pages, moved)") &&
    pageShell.includes("upsertPages([child])") &&
    pageShell.includes("upsertPages([updatedDuplicate ?? duplicate])") &&
    !pageShell.includes("const { refresh } = usePages({ autoLoad: false })") &&
    !pageShell.includes("await refresh()"),
  "PageShell 页面粘贴/移动/创建子页面/复制后必须局部 upsert，不能触发全量页面 metadata 刷新"
);
check(
  accountPageSync.includes('export const PAGE_SYNC_STATUS_EVENT = "zhinote:pagesync-status"') &&
    accountPageSync.includes("getPendingCloudPageSyncStatus") &&
    accountPageSync.includes("export function isCloudPagePendingSync") &&
    accountPageSync.includes("emitPageSyncStatusChanged();") &&
    pageShell.includes("PAGE_SYNC_STATUS_EVENT") &&
    pageShell.includes("getPendingCloudPageSyncStatus") &&
    pageShell.includes("isCloudPagePendingSync(pageId)") &&
    pageShell.includes("currentPagePendingSync") &&
    pageShell.includes("PageSyncStatusBadge") &&
    pageShell.includes("当前页待云同步") &&
    pageShell.includes('router.push("/modules/sync")') &&
    pageShell.includes('data-testid="page-sync-status-badge"') &&
    pageShell.includes('aria-label={`${label}，打开同步中心`}') &&
    pageShell.includes("等待云同步"),
  "PageShell 必须显示当前页/全局只读页面同步状态 badge，并提供到同步中心的队列查看入口"
);
check(
  pageTreeSource.includes("SIDEBAR_PAGE_TREE_ROOT_LIMIT") &&
    pageTreeSource.includes("SIDEBAR_PAGE_TREE_CHILD_LIMIT") &&
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
    pageTreeSource.includes("children.slice(0, SIDEBAR_PAGE_TREE_CHILD_LIMIT)") &&
    pageTreeSource.includes("visibleChildren.map((child)") &&
    pageTreeSource.includes("已折叠 {hiddenChildCount} 个子页面") &&
    pageTreeSource.includes("onPageMutated([child])") &&
    pageTreeSource.includes("collectMovedPageSnapshots(pages, movedPage)") &&
    pageTreeSource.includes("onPageMutated={upsertPages}") &&
    !pageTreeSource.includes("{children.map((child)") &&
    !pageTreeSource.includes("onChanged={() => refresh()}") &&
    !pageTreeSource.includes("await refresh()"),
  "Sidebar PageTree 必须用 parent 索引、根/子页面渲染上限、当前路径保留/自动展开和局部 upsert，避免 Notion 批量导入后拖慢全站"
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
  !sidebarSource.includes("usePages") &&
    sidebarSource.includes('openPage(page, { source: "sidebar-create" })') &&
    !quickSearchSource.includes("const { pages, refresh } = usePages()") &&
    quickSearchSource.includes("const pages = useWorkspaceStore((s) => s.pages)") &&
    quickSearchSource.includes("usePages({ autoLoad: false })") &&
    quickSearchSource.includes("upsertPages([page])") &&
    quickSearchSource.includes("upsertPages([result.page])") &&
    !quickSearchSource.includes("await refresh()") &&
    !favoritePagesSource.includes("usePages") &&
    favoritePagesSource.includes("useWorkspaceStore((s) => s.pages)") &&
    !trashPagesSource.includes("usePages") &&
    trashPagesSource.includes("activePageCount") &&
    trashPagesSource.includes("upsertPages([restored])"),
  "Sidebar/QuickSearch/FavoritePages/TrashPages 不应各自挂 usePages 或在创建页面后阻塞全量 metadata 刷新"
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
    !moduleDashboardSource.includes('from "@/hooks/usePages"') &&
    !moduleDashboardSource.includes('from "@/hooks/useDatabases"') &&
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
    usePagesHook.includes("includeContent && !localSnapshotLoaded && all.length === 0") &&
    usePagesHook.indexOf("await renderLocalPagesSnapshot()") <
      usePagesHook.indexOf("const cloud = await syncCloudPageMetadataDelta") &&
    !usePagesHook.includes("fullRefresh: all.length === 0 || !localSnapshotLoaded") &&
    !usePagesHook.includes("applyRemotePageMetadata") &&
    usePagesHook.includes("autoLoad?: boolean"),
  "usePages 必须先显示本地热缓存，再用云端 metadata delta 校正；includeContent 模块只在本地缓存不可读时用云端 metadata 兜底"
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
    pagePeekModal.includes("useWorkspaceStore.getState().pages.find") &&
    pagePeekModal.includes("editorLoadRequested") &&
    pagePeekModal.includes("schedulePeekContentLoad") &&
    pagePeekModal.includes("enabled: editorLoadRequested") &&
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
    scopedPageMetadata.includes("listPageMetadata(rootId)") &&
    scopedPageMetadata.includes("listPageMetadata(current.id)") &&
    scopedPageMetadata.includes("mergePageMetadata"),
  "scopedPageMetadata 必须提供 root-scoped 页面元数据读取，避免模块入口扫全局页面"
);
check(
  shells.knowledge.includes("listScopedPageMetadata") &&
    shells.knowledge.includes("mergeScopedPages") &&
    shells.knowledge.includes("upsertWorkspacePages(incoming)") &&
    shells.knowledge.includes("mergeScopedPages([page])") &&
    shells.knowledge.includes("mergeScopedPages([updatedLinkPage ?? linkPage])") &&
    shells.knowledge.includes("onChanged={() => void loadScopedPages()}") &&
    !shells.knowledge.includes('from "@/hooks/usePages"') &&
    !shells.knowledge.includes("usePages(") &&
    !shells.knowledge.includes("await refresh()"),
  "KnowledgeBaseShell 必须按知识库/产业链 root 读取 scoped metadata，并在新建/链接/移动后本地合并，不能触发全局页面刷新"
);
check(
  shells.chain.includes("listScopedPageMetadata") &&
    shells.chain.includes("mergeScopedPages") &&
    shells.chain.includes("upsertWorkspacePages(incoming)") &&
    shells.chain.includes("includeDescendants: false") &&
    shells.chain.includes("mergeScopedPages([child])") &&
    shells.chain.includes("mergeScopedPages([updatedLinkPage ?? linkPage])") &&
    shells.chain.includes("onChanged={() => void loadScopedPages()}") &&
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
  "onPointerEnter={warmPageRoute}",
  "onFocus={warmPageRoute}",
  'import("@/components/providers/PageShell")',
  'openPage(optimisticNote, { source: "daily-create" })',
  "每日纪要已打开",
  "openPage(note, { source })",
  'openPage(pageId, { source: "daily-open" })',
  "rememberPendingPageDraft(optimisticNote)",
  "upsertPages([optimisticNote])",
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
  shells.daily.indexOf("rememberPendingPageDraft(optimisticNote)") <
    shells.daily.indexOf("upsertPages([optimisticNote])") &&
    shells.daily.indexOf("upsertPages([optimisticNote])") <
      shells.daily.indexOf("writeOptimisticDailyHotCache") &&
    shells.daily.indexOf("writeOptimisticDailyHotCache") <
      shells.daily.indexOf("seedDailyNoteForImmediateOpen(optimisticNote)") &&
    shells.daily.indexOf("seedDailyNoteForImmediateOpen(optimisticNote)") <
      shells.daily.indexOf('openPage(optimisticNote, { source: "daily-create" })') &&
    shells.daily.includes("window.setTimeout(() =>") &&
    shells.daily.includes("current === dateKey ? null : current") &&
    shells.daily.indexOf('openPage(optimisticNote, { source: "daily-create" })') <
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
    lazyPagePeekModal.includes("function loadPagePeekModal()") &&
    lazyPagePeekModal.includes("export function warmPagePeekModal()") &&
    lazyPagePeekModal.includes('import("@/components/page/PagePeekModal")') &&
    lazyPagePeekModal.includes("dynamic(loadPagePeekModal") &&
    shells.daily.includes("warmPagePeekModal();") &&
    lazyPagePeekModal.includes("正在打开页面…") &&
    !shells.daily.includes("fetchCloudPageById") &&
    !shells.daily.includes("scheduleDailyPeekPreload") &&
    !shells.daily.includes('import("@/components/editor/Editor")'),
  "DailyNotesShell 应懒加载已有纪要 peek 弹窗并提供本地壳，保证日历首屏不捆绑重编辑器，也不在日历打开路径预拉正文"
);
check(
  shells.daily.includes("const visibleLimit = isExpanded") &&
    shells.daily.includes("const visibleNotes = dayNotes.slice(0, visibleLimit)") &&
    shells.daily.includes("Math.min(totalCount, currentLimit + DAILY_CALENDAR_EXPAND_BATCH)") &&
    shells.daily.includes("再显示 ${nextBatchCount} 条") &&
    !shells.daily.includes("? dayNotes\n                : dayNotes.slice"),
  "DailyNotesShell 展开某一天时也必须分批渲染，不能一次性把大批量导入纪要全部挂到 DOM"
);
check(
  shells.schedule.includes("MEETING_CALENDAR_EXPAND_BATCH") &&
    shells.schedule.includes("MEETING_CALENDAR_REVEAL_BUFFER") &&
    shells.schedule.includes("visibleMeetingLimitByDate") &&
    shells.schedule.includes("showMoreMeetingsForDate") &&
    shells.schedule.includes("revealMeetingOnCalendar") &&
    shells.schedule.includes("pendingCalendarFocusDateKeyRef") &&
    shells.schedule.includes("requestAnimationFrame") &&
    shells.schedule.includes("setExpandedMeetingDateKeys((current) =>") &&
    shells.schedule.includes("setVisibleMeetingLimitByDate((limits) =>") &&
    shells.schedule.includes("revealMeetingOnCalendar(optimisticPage)") &&
    shells.schedule.includes("revealMeetingOnCalendar(finalPage)") &&
    shells.schedule.includes("const visibleLimit = isExpanded") &&
    shells.schedule.includes("const visibleMeetings = dayMeetings.slice(0, visibleLimit)") &&
    shells.schedule.includes("Math.min(totalCount, currentLimit + MEETING_CALENDAR_EXPAND_BATCH)") &&
    shells.schedule.includes("再显示 ${nextBatchCount} 场") &&
    shells.schedule.includes("dayMeetings.length > MEETING_CALENDAR_VISIBLE_LIMIT") &&
    !shells.schedule.includes("? dayMeetings\n                : dayMeetings.slice"),
  "MeetingScheduleShell 展开某一天时也必须分批渲染，不能一次性把大批量导入会议全部挂到 DOM"
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
    localQueries.includes("addIfDailyScope(row)") &&
    localQueries.includes("targetedFallbackRows") &&
    localQueries.includes("dateParentIdsForChildren") &&
    localQueries.includes("SELECT parent_id FROM pages WHERE id = ?"),
  "每日纪要月历首屏应先按日期索引取候选，再用当前月份 token 和日期父页子节点做 bounded metadata fallback，不能递归展开整棵每日纪要树"
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
  shells.schedule.includes("const pageRoute = `/page/${result.page.id}`");
check(
  shells.schedule.includes('router.prefetch("/page/zhinote-route-prefetch")') &&
    shells.schedule.includes("creatingMeetingDateKey") &&
    shells.schedule.includes("pageShellWarmupRef") &&
    shells.schedule.includes("useLocalFirstPageNavigation") &&
    shells.schedule.includes("warmMeetingPageRoute") &&
    shells.schedule.includes('import("@/components/providers/PageShell")') &&
    shells.schedule.includes("onPointerDown={warmMeetingPageRoute}") &&
    shells.schedule.includes('importSource: "手动创建"') &&
    shells.schedule.includes("openCreatedMeetingPage") &&
    meetingScheduleOpensCreatedPageRoute &&
    shells.schedule.includes("router.prefetch(pageRoute)") &&
    shells.schedule.includes('openPage(page, { source: "meeting-create" })') &&
    shells.schedule.includes("openPage(page, { source })") &&
    shells.schedule.includes('openPage(pageId, { source: "meeting-open" })') &&
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
  "MeetingScheduleShell 手动创建和导入会议应直接进入本地优先流程，导入按钮不能等待模块根页面先加载；会议页和 root 保存必须走统一云端上传队列"
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
    !shells.schedule.includes("localPagesForMerge = await listPages(id)") &&
    !shells.schedule.includes("localPagesForMerge = await listPageMetadata(id)") &&
    !shells.schedule.includes("import { listPages"),
  "MeetingScheduleShell 日历首屏应按日期范围只读本地会议 metadata，不能为渲染日历扫描完整会议根或读取正文"
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
    !pageTree.includes("useMemo(() => new Set(getModuleRootIdsSync()), [])"),
  "PageTree 必须隐藏模块根页面，并在云端认领 root id 后无需刷新即可更新"
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
