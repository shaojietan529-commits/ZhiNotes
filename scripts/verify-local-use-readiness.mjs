#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const files = {
  readiness: "src/lib/sync/accountLocalUseReadiness.ts",
  sidebar: "src/components/sidebar/Sidebar.tsx",
  syncShell: "src/components/modules/SyncShell.tsx",
  privateAlpha: "scripts/verify-private-alpha-p0.mjs",
  packageJson: "package.json",
};

const errors = [];
const check = (condition, message) => {
  if (!condition) errors.push(message);
};

function readProjectFile(file) {
  const fullPath = path.join(root, file);
  check(existsSync(fullPath), `${file} 不存在`);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
}

const readiness = readProjectFile(files.readiness);
const sidebar = readProjectFile(files.sidebar);
const syncShell = readProjectFile(files.syncShell);
const privateAlpha = readProjectFile(files.privateAlpha);
const packageJsonSource = readProjectFile(files.packageJson);
const packageJson = packageJsonSource ? JSON.parse(packageJsonSource) : {};

const requiredStatuses = [
  "ready",
  "local-only",
  "checking",
  "syncing",
  "pending-upload",
  "needs-review",
  "signed-out",
  "cloud-uncertain",
];

check(
  readiness.includes("export function buildAccountLocalUseReadiness"),
  "本地可用性规则必须导出 buildAccountLocalUseReadiness"
);
for (const status of requiredStatuses) {
  check(
    readiness.includes(`"${status}"`),
    `本地可用性规则缺少状态 ${status}`
  );
}

for (const boundary of [
  "reads_page_body_text: false",
  "reads_database_row_values: false",
  "reads_file_bytes: false",
  "uploads_workspace_data: false",
  "mutates_workspace_data: false",
]) {
  check(
    readiness.includes(boundary),
    `本地可用性规则必须保持 metadata-only 边界：${boundary}`
  );
}

check(
  readiness.includes("localInputCanContinue: true"),
  "所有账号/同步临时状态都必须允许继续本地输入"
);
check(
  readiness.includes("queueBreakdown: AccountLocalUseQueueBreakdown") &&
    readiness.includes("filePendingTotal") &&
    readiness.includes("fileFailedTotal") &&
    readiness.includes("fileManualReviewTotal") &&
    readiness.includes("fileQueueBlocksCloudHandoff") &&
    readiness.includes("队列分布：") &&
    readiness.includes("文件队列："),
  "本地可用性规则必须显式拆分文件队列，并把文件 pending/failed/manual review 纳入云端交接和缓存重建保护"
);
check(
  readiness.includes("input.failedTotal > 0 || input.manualReviewTotal > 0") &&
    readiness.includes('status: "needs-review"') &&
    readiness.includes("cloudHandoffReady: false") &&
    readiness.includes("cacheRebuildBlocked: true") &&
    readiness.includes("打开同步中心处理 failed / manual review"),
  "failed/manual review 必须进入 needs-review，阻断云端交接和缓存重建"
);
check(
  readiness.includes("if (input.pendingTotal > 0)") &&
    readiness.includes('status: "pending-upload"') &&
    readiness.includes("本地变更已保留") &&
    readiness.includes("pending 队列清零"),
  "pending 队列必须显示本地已保留，并阻断缓存重建直到清零"
);
check(
  readiness.includes('status: "signed-out"') &&
    readiness.includes("本地输入不会因此被清空") &&
    readiness.includes("登录后再上传本地队列"),
  "未登录或账号不可确认时必须说明本地输入不会被清空"
);
check(
  readiness.includes('status: "cloud-uncertain"') &&
    readiness.includes("本地输入已保留，稍后重试") &&
    readiness.includes("先继续本地使用"),
  "云端暂不可确认时必须保持本地可用并提示稍后重试"
);
check(
  readiness.includes('status: "local-only"') &&
    readiness.includes("cacheRebuildBlocked: false") &&
    readiness.includes("云同步未开启"),
  "云同步未开启时必须明确本地模式，且不能误报为缓存重建阻断"
);
check(
  readiness.includes('status: "ready"') &&
    readiness.includes("cloudHandoffReady: true") &&
    readiness.includes("当前没有 pending、failed 或 manual review 队列"),
  "只有 pending/failed/manual review 全清零时才能声明云端交接就绪"
);

for (const snippet of [
  "accountSync.localUseReadiness",
  'data-testid="sidebar-sync-status"',
  'data-testid="account-cloud-sync-coordinator"',
  'data-testid="account-local-use-readiness-badge"',
  "data-local-input-can-continue",
  "data-cloud-handoff-ready",
  "data-cache-rebuild-blocked",
  "data-file-queue-total",
  "data-file-pending-total",
  "data-file-failed-total",
  "data-file-manual-review-total",
  "先别重建缓存",
  "本地可写",
]) {
  check(sidebar.includes(snippet), `侧边栏缺少本地可用性提示：${snippet}`);
}

for (const snippet of [
  "buildAccountLocalUseReadiness",
  "SyncOperationalStatusStrip",
  "SyncLocalUseReadinessPanel",
  'data-testid="sync-operational-status-strip"',
  'data-testid="sync-local-use-readiness-panel"',
  'data-testid="sync-sidebar-readiness-mirror"',
  'data-testid="sync-file-queue-readiness-note"',
  "data-local-input-can-continue",
  "data-cloud-handoff-ready",
  "data-cache-rebuild-blocked",
  "data-file-queue-total",
  "data-file-pending-total",
  "data-file-failed-total",
  "data-file-manual-review-total",
  "当前使用安全",
  "可以继续写",
  "补传待上传",
  "查看详细队列",
  "文件队列已计入本地可用性和缓存重建保护",
  "不读取页面正文、数据库行值、文件 bytes",
]) {
  check(syncShell.includes(snippet), `同步中心缺少本地可用性提示：${snippet}`);
}

const scripts = packageJson.scripts ?? {};
check(
  scripts["verify:local-use-readiness"] ===
    "node scripts/verify-local-use-readiness.mjs",
  "package.json 必须暴露 verify:local-use-readiness"
);
check(
  privateAlpha.includes("verify-local-use-readiness") &&
    privateAlpha.includes("npm run verify:local-use-readiness") &&
    privateAlpha.includes("Check local input continuity"),
  "Private Alpha P0 验证必须包含本地可用性规则检查"
);

if (errors.length > 0) {
  console.error("Local-use readiness verification FAILED:");
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log("Local-use readiness verification passed");
console.log(
  JSON.stringify(
    {
      statuses: requiredStatuses.length,
      local_input_can_continue: true,
      cloud_failures_do_not_block_local_input: true,
      pending_blocks_cache_rebuild: true,
      failed_manual_review_visible: true,
      file_queue_breakdown_visible: true,
      sidebar_mirror: true,
      sync_center_mirror: true,
      metadata_only: true,
    },
    null,
    2
  )
);
