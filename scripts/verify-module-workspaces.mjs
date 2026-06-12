#!/usr/bin/env node

// Verifies the three primary workspace surfaces contract:
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
  "会议日程",
]) {
  check(helper.includes(token), `moduleWorkspaces 缺少 ${token}`);
}

// 2. Routes
for (const route of [
  "src/app/(workspace)/daily/page.tsx",
  "src/app/(workspace)/industry-chain/page.tsx",
  "src/app/(workspace)/schedule/page.tsx",
]) {
  check(existsSync(path.join(root, route)), `缺少路由 ${route}`);
}

// 3. Shells exist + local-only
const shells = {
  daily: read("src/components/modules/DailyNotesShell.tsx"),
  chain: read("src/components/modules/IndustryChainShell.tsx"),
  schedule: read("src/components/modules/MeetingScheduleShell.tsx"),
};
const forbidden = ["XMLHttpRequest", "enables_ai", "getUserMedia"];
for (const [name, source] of Object.entries(shells)) {
  for (const token of forbidden) {
    check(!source.includes(token), `${name} shell 不得包含高风险调用 ${token}`);
  }
}
for (const [name, source] of Object.entries(shells)) {
  if (name === "schedule") {
    const fetchMatches = source.match(/fetch\(/g) ?? [];
    check(
      fetchMatches.length <= 1 && source.includes('fetch("/api/meetings/intake"'),
      "schedule shell 只能调用同源会议解析接口 /api/meetings/intake"
    );
  } else {
    check(!source.includes("fetch("), `${name} shell 不得包含 fetch(`);
  }
}

// Daily: calendar + per-day add + Notion-style template
for (const token of ["buildMonthGrid", "addNote", "日期", "要点", "Summary"]) {
  check(shells.daily.includes(token), `DailyNotesShell 缺少 ${token}`);
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
  "导入会议日历",
  "会议详情",
  "会议密码",
  "录制设备",
  "组织者",
  "平台",
  "不会自动开麦克风",
]) {
  check(shells.schedule.includes(token), `MeetingScheduleShell 缺少 ${token}`);
}

// 4. Sidebar promotes the three, demotes the rest to 备选模块
const sidebar = read("src/components/sidebar/Sidebar.tsx");
for (const token of ["MODULE_WORKSPACE_LIST", "备选模块"]) {
  check(sidebar.includes(token), `Sidebar 缺少 ${token}`);
}

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
      workspaces: 3,
      routes: 3,
      local_only: true,
      sidebar_promoted: true,
      page_tree_hides_roots: true,
    },
    null,
    2
  )
);
