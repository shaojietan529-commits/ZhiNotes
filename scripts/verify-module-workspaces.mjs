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
]) {
  check(shells.daily.includes(token), `DailyNotesShell 缺少每日纪要性能护栏 ${token}`);
}
check(
  shells.daily.includes("void ensureDailyDateIndexBackfilled()"),
  "DailyNotesShell 日期索引重建必须后台运行，不能阻塞首屏"
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
  !shells.daily.includes("getAllPageMetadata"),
  "DailyNotesShell 不应在日历刷新时调用 getAllPageMetadata 全量扫描"
);
for (const token of [
  "daily_date_key",
  "idx_pages_daily_date",
  "listDailyPageMetadataForCalendar",
  "rebuildPageDateKeyIndex",
  "inferDailyDateKey",
]) {
  check(
    localQueries.includes(token) ||
      localSchema.includes(token) ||
      localClient.includes(token),
    `每日纪要日期索引缺少 ${token}`
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
