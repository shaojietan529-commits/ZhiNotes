#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const files = {
  readiness: "src/lib/sync/accountLocalUseReadiness.ts",
  accountCoordinator: "src/hooks/useAccountCloudSyncCoordinator.ts",
  sidebar: "src/components/sidebar/Sidebar.tsx",
  syncShell: "src/components/modules/SyncShell.tsx",
  settingsCloudDrain: "src/lib/sync/settingsCloudDrain.ts",
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
const accountCoordinator = readProjectFile(files.accountCoordinator);
const sidebar = readProjectFile(files.sidebar);
const syncShell = readProjectFile(files.syncShell);
const settingsCloudDrain = readProjectFile(files.settingsCloudDrain);
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
    readiness.includes('"files"') &&
    readiness.includes('"settings"') &&
    readiness.includes('"knowledge"') &&
    readiness.includes('"portfolio"') &&
    readiness.includes("filePendingTotal") &&
    readiness.includes("portfolioPendingTotal") &&
    readiness.includes("portfolioFailedTotal") &&
    readiness.includes("portfolioManualReviewTotal") &&
    readiness.includes("portfolioQueueBlocksCloudHandoff") &&
    readiness.includes("otherPendingTotal") &&
    readiness.includes("otherFailedTotal") &&
    readiness.includes("otherManualReviewTotal") &&
    readiness.includes("fileFailedTotal") &&
    readiness.includes("fileManualReviewTotal") &&
    readiness.includes("fileQueueBlocksCloudHandoff") &&
    readiness.includes("队列分布：") &&
    readiness.includes("文件队列：") &&
    readiness.includes("组合队列：") &&
    readiness.includes("其他队列：") &&
    readiness.includes("其他失败") &&
    readiness.includes("其他需确认"),
  "本地可用性规则必须显式拆分文件、组合和其他全域队列，并把 pending/failed/manual review 纳入云端交接和缓存重建保护"
);
check(
  readiness.includes("fileSyncEnabled?: boolean") &&
    readiness.includes("settingsSyncEnabled?: boolean") &&
    readiness.includes("knowledgeSyncEnabled?: boolean") &&
    readiness.includes("portfolioSyncEnabled?: boolean") &&
    readiness.includes('label: "文件 / 报告 metadata"') &&
    readiness.includes('label: "设置 / 侧边栏 / 模块配置"') &&
    readiness.includes('label: "知识库双链 / 评论 / 版本"') &&
    readiness.includes('label: "组合管理"') &&
    readiness.includes("核心同步域未全部就绪") &&
    readiness.includes("页面、数据库、文件 metadata、设置、知识库和组合同步域都已就绪"),
  "本地可用性门禁必须把阶段 1 的页面/数据库/文件/设置/知识库/组合六个核心云同步域都列为设备交接前置条件"
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
    readiness.includes('detail: withQueueDetail(\n        "账号或网络暂时不可确认；本地输入已保留，后台会低频重试。"') &&
    readiness.includes("本地输入已保留，后台会低频重试") &&
    readiness.includes("账号重试：") &&
    readiness.includes("先继续本地使用"),
  "云端暂不可确认时必须保持本地可用、提示低频重试，并显示具体账号重试域"
);
check(
  readiness.includes('status: "local-only"') &&
    readiness.includes("cacheRebuildBlocked: false") &&
    readiness.includes("云同步未开启"),
  "云同步未开启时必须明确本地模式，且不能误报为缓存重建阻断"
);
check(
  readiness.includes('status: "ready"') &&
    readiness.includes("cloudHandoffReady: handoffBlockers.length === 0") &&
    readiness.includes("deviceHandoffReady: handoffBlockers.length === 0") &&
    readiness.includes("当前没有 pending、failed 或 manual review 队列"),
  "只有 pending/failed/manual review 全清零且无账号/核心域 handoff blocker 时才能声明云端交接就绪"
);

check(
  accountCoordinator.includes("const accountUncertainByAuthRetry = Boolean(authRetryDomainLabel)") &&
    accountCoordinator.includes("const syncErrorWithoutAuthRetry =") &&
    accountCoordinator.includes('accountUncertainByAuthRetry\n                ? "checking"') &&
    accountCoordinator.includes('fileSync.status.authRetryStatus ? "文件" : null') &&
    accountCoordinator.includes('portfolioSync.status.authRetryStatus ? "组合" : null') &&
    accountCoordinator.includes("fileSync.status.authRetryUntil") &&
    accountCoordinator.includes("portfolioSync.status.authRetryUntil") &&
    accountCoordinator.includes("fileSyncEnabled: fileSync.status.enabled") &&
    accountCoordinator.includes("settingsSyncEnabled: settingsSync.status.enabled") &&
    accountCoordinator.includes("knowledgeSyncEnabled: knowledgeSync.status.enabled") &&
    accountCoordinator.includes("portfolioSyncEnabled: portfolioSync.status.enabled"),
  "全局同步总控必须把文件、设置、知识库和组合状态纳入云端不确定状态和设备交接门禁；auth retry 显示为检查/排队，不能误报已同步或硬错误"
);

for (const snippet of [
  "accountSync.localUseReadiness",
  'data-testid="sidebar-sync-status"',
  'data-testid="account-cloud-sync-coordinator"',
  'data-testid="account-local-use-readiness-badge"',
  "data-local-input-can-continue",
  "data-cloud-handoff-ready",
  "data-cache-rebuild-blocked",
  "data-safe-to-switch-device-now",
  'data-testid="account-safe-to-switch-device-badge"',
  "data-file-queue-total",
  "data-file-pending-total",
  "data-file-failed-total",
  "data-file-manual-review-total",
  "data-portfolio-queue-total",
  "data-portfolio-pending-total",
  "data-portfolio-failed-total",
  "data-portfolio-manual-review-total",
  "先别重建缓存",
  "本地可写",
  "可换设备",
  "先等同步",
]) {
  check(sidebar.includes(snippet), `侧边栏缺少本地可用性提示：${snippet}`);
}

for (const snippet of [
  'import { useKnowledgeCloudSyncStatus } from "@/hooks/useKnowledgeCloudSyncStatus"',
  'import { useSettingsCloudSyncStatus } from "@/hooks/useSettingsCloudSyncStatus"',
  "const settingsCloudSync = useSettingsCloudSyncStatus()",
  "const knowledgeCloudSync = useKnowledgeCloudSyncStatus()",
  "settingsSyncEnabled: settingsCloudSyncStatus.enabled",
  "knowledgeSyncEnabled: knowledgeCloudSyncStatus.enabled",
  "buildAccountLocalUseReadiness",
  "SyncOperationalStatusStrip",
  "SyncLocalUseReadinessPanel",
  'data-testid="sync-operational-status-strip"',
  'data-testid="sync-operational-domain-matrix"',
  'data-testid="sync-local-use-readiness-panel"',
  'data-testid="sync-sidebar-readiness-mirror"',
  'data-testid="sync-file-queue-readiness-note"',
  "getPendingDomainStatus",
  "formatPendingDomainStatus",
  "PendingDomainCountPill",
  "data-domain-pending",
  "data-domain-failed",
  "data-domain-manual-review",
  "data-domain-in-flight",
  "data-local-input-can-continue",
  "data-cloud-handoff-ready",
  "data-cache-rebuild-blocked",
  "data-safe-to-switch-device-now",
  'data-testid="sync-safe-to-switch-device-badge"',
  "data-file-queue-total",
  "data-file-pending-total",
  "data-file-failed-total",
  "data-file-manual-review-total",
  "data-portfolio-queue-total",
  "data-portfolio-pending-total",
  "data-portfolio-failed-total",
  "data-portfolio-manual-review-total",
  "fileSyncEnabled: syncLocalUseQueueSnapshot.fileSyncEnabled",
  "settingsSyncEnabled: syncLocalUseQueueSnapshot.settingsSyncEnabled",
  "knowledgeSyncEnabled: syncLocalUseQueueSnapshot.knowledgeSyncEnabled",
  "portfolioSyncEnabled: syncLocalUseQueueSnapshot.portfolioSyncEnabled",
  'data-testid="sync-portfolio-queue-readiness-note"',
  "当前使用安全",
  "可以继续写",
  "可换设备",
  "先等同步",
  "补传待上传",
  "查看详细队列",
  "全域同步状态矩阵",
  "文件队列已计入本地可用性和缓存重建保护",
  "不读取页面正文、数据库行值、文件 bytes",
]) {
  check(syncShell.includes(snippet), `同步中心缺少本地可用性提示：${snippet}`);
}
check(
  !syncShell.includes("settingsSyncEnabled: syncSummary !== null") &&
    !syncShell.includes("knowledgeSyncEnabled: syncSummary !== null"),
  "同步中心必须使用设置/知识库真实状态 hook；不能用 syncSummary 是否存在代替云同步域启用状态"
);

for (const snippet of [
  "validateSettingsCloudAckReceipt",
  "INVALID_SETTINGS_CLOUD_ACK_MESSAGE",
  "!receipt.format.startsWith(\"zhinote-\")",
  "!receipt.format.endsWith(\"settings-cloud-receipt\")",
  "receipt.workspace_id !== input.workspaceId",
  "receipt.setting_key !== input.payload.setting_key",
  "summary.acknowledges_pending_row !==",
  "input.payload.client_pending_row_id",
  "syncRule.local_pending_table !== \"sync_log\"",
  "syncRule.local_pending_row_id !== input.payload.client_pending_row_id",
  "syncRule.cloud_wins_except_unsynced_local_setting !== true",
  "receipt.table_name !== input.payload.table_name",
  "receipt.module_id !== input.payload.module_id",
]) {
  check(
    settingsCloudDrain.includes(snippet),
    `设置同步清 pending 前必须校验云端 ACK：${snippet}`
  );
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
