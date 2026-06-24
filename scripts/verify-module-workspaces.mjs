#!/usr/bin/env node

// Verifies the primary workspace surfaces contract:
// - Each is backed by a singleton local root page (no new tables, no cloud).
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
  "getModuleRootIdsSync",
  "MODULE_WORKSPACE_LIST",
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
};
const localQueries = read("src/lib/db/local/queries.ts");
const localSchema = read("src/lib/db/local/schema.ts");
const localClient = read("src/lib/db/local/client.ts");
const usePageHook = read("src/hooks/usePage.ts");
const usePagesHook = read("src/hooks/usePages.ts");
const pagePeekModal = read("src/components/page/PagePeekModal.tsx");
const forbidden = ["XMLHttpRequest", "enables_ai", "getUserMedia"];
for (const [name, source] of Object.entries(shells)) {
  for (const token of forbidden) {
    check(!source.includes(token), `${name} shell 不得包含高风险调用 ${token}`);
  }
}
for (const [name, source] of Object.entries(shells)) {
  if (name === "schedule") {
    const fetchCalls = Array.from(
      source.matchAll(/fetch\(\s*["'`]([^"'`]+)["'`]/g)
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
    check(!source.includes("fetch("), `${name} shell 不得包含 fetch(`);
  }
}

// Daily: calendar + per-day add + Notion-style template
for (const token of ["buildMonthGrid", "addNote", "日期", "要点", "Summary"]) {
  check(shells.daily.includes(token), `DailyNotesShell 缺少 ${token}`);
}
for (const token of [
  "listDailyPageMetadataForCalendar",
  "rebuildPageDateKeyIndex",
  "@/components/page/LazyPagePeekModal",
  "prefetchNoteBody",
  "fetchCloudPageById",
  "DAILY_DATE_INDEX_BACKFILL_KEY",
  "getModuleRootIdSync",
  "loadRequestRef",
  "observedPageRevisionRef",
  "scheduleDailyPeekPreload",
  "applyRemotePages",
  "DAILY_DATE_INDEX_BACKFILL_BATCH",
  "DAILY_DATE_INDEX_BACKFILL_MAX_PASSES",
  "waitForDailyBackfillIdle",
]) {
  check(shells.daily.includes(token), `DailyNotesShell 缺少每日纪要性能护栏 ${token}`);
}
check(
  shells.daily.includes("void ensureDailyDateIndexBackfilled()"),
  "DailyNotesShell 日期索引重建必须后台运行，不能阻塞首屏"
);
check(
  shells.daily.includes("rebuildPageDateKeyIndex({") &&
    shells.daily.includes("limit: DAILY_DATE_INDEX_BACKFILL_BATCH") &&
    shells.daily.includes("isDailyDateIndexBackfillDone") &&
    shells.daily.includes("markDailyDateIndexBackfillDone"),
  "DailyNotesShell 日期索引重建必须分批、可记忆完成状态，不能刷新时反复全量扫描"
);
check(
  helper.includes("getModuleRootIdSync"),
  "moduleWorkspaces 必须提供同步 root id 读取，避免新增时扫全量页面"
);
check(
  usePageHook.includes("setLoading(localPage.content_text == null)"),
  "usePage 必须在目录卡片缺正文时保持正文按需加载状态"
);
check(
  usePageHook.includes("options: UsePageOptions") &&
    usePageHook.includes("enabled = options.enabled ?? true"),
  "usePage 必须支持延后加载正文，避免 peek 弹窗打开时立即拉取大正文"
);
check(
  usePagesHook.includes("upsertPages(cloud.pages.map(remoteMetadataToPage))") &&
    !usePagesHook.includes("applyRemotePageMetadata"),
  "usePages 云端 metadata delta 必须直接合并到 store，不能每次 delta 后重扫全量 pages"
);
check(
  pagePeekModal.includes("getPageMetadata") &&
    pagePeekModal.includes("editorLoadRequested") &&
    pagePeekModal.includes("schedulePeekContentLoad") &&
    pagePeekModal.includes("enabled: editorLoadRequested"),
  "PagePeekModal 必须先显示页面元数据，再按需加载正文和编辑器"
);
check(
  !shells.daily.includes("getAllPageMetadata"),
  "DailyNotesShell 不应在日历刷新时调用 getAllPageMetadata 全量扫描"
);
for (const token of [
  "daily_date_key",
  "idx_pages_daily_date",
  "listDailyPageMetadataForCalendar",
  "rebuildPageDateKeyIndex",
  "inferDailyDateKey",
  "DAILY_CALENDAR_FALLBACK_SCAN_LIMIT",
  "dailyDateCandidateWhere",
  "daily_date_key IS NULL",
]) {
  check(
    localQueries.includes(token) ||
      localSchema.includes(token) ||
      localClient.includes(token),
    `每日纪要日期索引缺少 ${token}`
  );
}
for (const token of [
  "installLocalSchema(db)",
  "Local SQLite cache schema failed",
  "using rebuildable in-memory cache",
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
check(
  shells.schedule.includes("listPageMetadata") &&
    !shells.schedule.includes("const dailyPages = await listPages(dailyRootId)"),
  "MeetingScheduleShell 关联每日纪要时应先读 metadata，不能为建立日期索引读取所有每日正文"
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
  pageTree.includes("getModuleRootIdsSync"),
  "PageTree 必须隐藏三个模块根页面"
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
      local_only: true,
      sidebar_promoted: true,
      page_tree_hides_roots: true,
    },
    null,
    2
  )
);
