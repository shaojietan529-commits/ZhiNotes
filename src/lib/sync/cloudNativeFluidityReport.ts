import type { PendingCloudDatabaseSyncStatus } from "@/lib/database/accountDatabaseSync";
import type { PendingFileEmbedSyncStatus } from "@/lib/files/fileEmbedSyncQueue";
import type { PendingCloudPageSyncStatus } from "@/lib/pages/accountPageSync";
import type { LocalPerformanceSnapshot } from "@/lib/performance/localPerformance";
import type { CacheRebuildPreflightReceipt } from "@/lib/sync/cacheRebuildPreflightReceipt";
import type { CloudMasterReconcileReport } from "@/lib/sync/cloudMasterReconcile";
import type { HotCacheLocalIndexSummary } from "@/lib/sync/hotCacheLocalIndex";
import type { HotCacheWarmupPlan } from "@/lib/sync/hotCacheWarmupPlan";
import type { SyncLogSummary } from "@/lib/db/local/queries";

export type CloudNativeFluidityVerdict = "ready" | "partial" | "blocked";
export type CloudNativeFluidityGateStatus = "pass" | "warn" | "block";

export interface CloudNativeFluidityReportInput {
  pageStatus: PendingCloudPageSyncStatus;
  databaseStatus: PendingCloudDatabaseSyncStatus;
  fileStatus: PendingFileEmbedSyncStatus;
  syncSummary: SyncLogSummary | null;
  cloudMasterReconcile: CloudMasterReconcileReport;
  hotCacheWarmupPlan: HotCacheWarmupPlan;
  hotCacheLocalIndexSummary: HotCacheLocalIndexSummary | null;
  performanceSnapshots: LocalPerformanceSnapshot[];
  cacheRebuildPreflightReceipt: CacheRebuildPreflightReceipt;
  generatedAt?: string;
}

export interface CloudNativeFluidityGate {
  id: string;
  title: string;
  status: CloudNativeFluidityGateStatus;
  evidence: string;
  target: string;
  next_action: string;
}

export interface CloudNativeFluidityMetric {
  id: string;
  title: string;
  value: number | null;
  unit: "ms" | "rows" | "routes" | "samples" | "jobs";
  target: string;
  status: CloudNativeFluidityGateStatus;
}

export interface CloudNativeFluidityWebBetaSyncGate {
  id: "web-beta-sync-fluidity-gate";
  title: string;
  status: CloudNativeFluidityGateStatus;
  can_request_owner_review_now: boolean;
  can_enable_cloud_source_of_truth_now: false;
  blocking_reasons: string[];
  warning_reasons: string[];
  evidence: string[];
  required_before_owner_review: string[];
  next_action: string;
}

export interface CloudNativeFluidityReport {
  format: "zhinote-cloud-native-fluidity-report";
  format_version: 1;
  report_status: "metadata-only-local-health-check";
  architecture_target: "cloud-master-local-hot-cache";
  generated_at: string;
  verdict: CloudNativeFluidityVerdict;
  privacy_boundary: string;
  boundary: {
    local_health_check_only: true;
    reads_page_body_text: false;
    reads_page_yjs: false;
    reads_database_row_values: false;
    reads_comment_bodies: false;
    reads_file_bytes: false;
    reads_file_text: false;
    reads_secret_values: false;
    sends_network_requests: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    mutates_local_cache_records: false;
    clears_local_cache: false;
    includes_raw_workspace_content: false;
  };
  summary: {
    gates: number;
    passed: number;
    warnings: number;
    blockers: number;
    page_pending_rows: number;
    database_pending_rows: number;
    page_failed_rows: number;
    database_failed_rows: number;
    file_pending_rows: number;
    file_failed_rows: number;
    file_manual_review_rows: number;
    deduplicated_pending_rows: number;
    sync_log_pending_rows: number;
    sync_log_covered_pending_rows: number;
    sync_log_unclassified_pending_rows: number;
    sync_log_failed_rows: number;
    sync_log_manual_review_rows: number;
    hot_cache_ready_jobs: number;
    hot_cache_route_targets: number;
    hot_cache_index_rows: number;
    performance_samples: number;
    average_local_first_ms: number | null;
    average_page_open_ms: number | null;
    average_database_row_open_ms: number | null;
    average_page_body_hydration_ms: number | null;
    web_beta_sync_gate_status: CloudNativeFluidityGateStatus;
    web_beta_sync_blockers: number;
    web_beta_sync_warnings: number;
    can_request_owner_review_now: boolean;
  };
  gates: CloudNativeFluidityGate[];
  metrics: CloudNativeFluidityMetric[];
  web_beta_sync_gate: CloudNativeFluidityWebBetaSyncGate;
  next_action: string;
}

const LOCAL_FIRST_TARGET_MS = 800;
const PAGE_OPEN_TARGET_MS = 1200;
const DATABASE_ROW_OPEN_TARGET_MS = 1200;
const PAGE_BODY_HYDRATION_TARGET_MS = 1500;
const MIN_PERFORMANCE_SAMPLES = 3;

export function buildCloudNativeFluidityReport(
  input: CloudNativeFluidityReportInput
): CloudNativeFluidityReport {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const pagePendingRows =
    input.pageStatus.pending +
    input.pageStatus.queued +
    (input.pageStatus.syncLogPending ?? 0);
  const databasePendingRows =
    input.databaseStatus.pending +
    input.databaseStatus.queued +
    (input.databaseStatus.syncLogPending ?? 0);
  const filePendingRows = input.fileStatus.pending;
  const syncLogCoveredPendingRows =
    (input.pageStatus.syncLogPending ?? 0) +
    (input.databaseStatus.syncLogPending ?? 0);
  const syncLogUnclassifiedPendingRows = Math.max(
    (input.syncSummary?.pending ?? 0) - syncLogCoveredPendingRows,
    0
  );
  const failedRows = Math.max(
    input.pageStatus.failed + input.databaseStatus.failed + input.fileStatus.failed,
    input.syncSummary?.failed ?? 0
  );
  const manualReviewRows = Math.max(
    input.pageStatus.manualReviewCount +
      input.databaseStatus.manualReviewCount +
      input.fileStatus.manualReviewCount,
    input.syncSummary?.manualReview ?? 0
  );
  const totalPendingRows =
    pagePendingRows +
    databasePendingRows +
    filePendingRows +
    syncLogUnclassifiedPendingRows;
  const hotCacheIndexRows = input.hotCacheLocalIndexSummary?.summary.rows ?? 0;
  const hotCacheRouteTargets = input.hotCacheWarmupPlan.summary.route_targets;
  const hotCacheReadyJobs = input.hotCacheWarmupPlan.summary.ready;
  const localFirstAverageMs = calculateAverageLocalFirstMs(
    input.performanceSnapshots
  );
  const averagePageOpenMs = averageDurationMs(
    input.performanceSnapshots,
    "page-open"
  );
  const averageDatabaseRowOpenMs = averageDurationMs(
    input.performanceSnapshots,
    "database-row-open"
  );
  const averagePageBodyHydrationMs = averageDurationMs(
    input.performanceSnapshots,
    "page-body-hydration"
  );

  const gates: CloudNativeFluidityGate[] = [
    {
      id: "cloud-workspace-linked",
      title: "云端主库已连接",
      status: input.cloudMasterReconcile.summary.cloud_workspace_linked
        ? "pass"
        : "block",
      evidence: input.cloudMasterReconcile.summary.cloud_workspace_linked
        ? "本机已绑定云 workspace，可以把云端作为最终主库。"
        : "当前还没有云 workspace 绑定证据，系统只能停留在本地优先。",
      target: "所有真实数据最终以云端 workspace 为主，本地只是热缓存。",
      next_action: input.cloudMasterReconcile.summary.cloud_workspace_linked
        ? "继续观察同步队列和本地热缓存。"
        : "先在云同步页登录并连接 workspace，再谈全域上云。",
    },
    {
      id: "page-sync-enabled",
      title: "页面同步已启用",
      status: input.pageStatus.enabled ? "pass" : "block",
      evidence: input.pageStatus.enabled
        ? `页面 pending ${pagePendingRows} 条，lastSyncAt ${input.pageStatus.lastSyncAt ?? "暂无"}。`
        : "页面同步当前关闭；笔记、每日纪要、会议和公司页不能稳定进入云端主库。",
      target: "Page 是知识库底座，必须先具备后台上传和拉取能力。",
      next_action: input.pageStatus.enabled
        ? "保持页面同步开启，优先清理 pending。"
        : "在账号页开启页面同步，并保留 owner gate。",
    },
    {
      id: "database-sync-enabled",
      title: "数据库同步已启用",
      status: input.databaseStatus.enabled ? "pass" : "block",
      evidence: input.databaseStatus.enabled
        ? `数据库 pending ${databasePendingRows} 条，lastSyncAt ${input.databaseStatus.lastSyncAt ?? "暂无"}。`
        : "数据库同步当前关闭；投研表格和 tracker 仍不能全域上云。",
      target: "数据库字段、视图和行值需要进入云端主库，本地按需缓存。",
      next_action: input.databaseStatus.enabled
        ? "保持数据库同步开启，继续观察失败重试。"
        : "在账号页开启数据库同步，并确认隐私边界。",
    },
    {
      id: "pending-queue-visible",
      title: "待上传队列可见且受保护",
      status:
        totalPendingRows === 0 && failedRows === 0 && manualReviewRows === 0
          ? "pass"
          : "warn",
      evidence:
        manualReviewRows > 0
          ? `当前共有 ${manualReviewRows} 条记录需要人工处理；这些异常未清空前不能切换到云端主库。`
          : failedRows > 0
          ? `当前共有 ${failedRows} 条待上传记录带失败回执；最近失败：${input.pageStatus.lastFailureMessage ?? input.databaseStatus.lastFailureMessage ?? input.fileStatus.lastFailureMessage ?? "未记录原因"}。`
          : totalPendingRows === 0
          ? "当前没有待上传队列，云端和本地更容易对齐。"
          : `当前共有 ${totalPendingRows} 条待上传/排队记录；这是本地级输入体验的缓冲区，不应被清理。`,
      target: "输入先写本地，再进入 pending queue，云端确认前不能丢。",
      next_action:
        totalPendingRows === 0
          ? manualReviewRows > 0 || failedRows > 0
            ? "先处理失败回执和人工处理项，再继续做云端 manifest 对账和缓存重建预检。"
            : "可以继续做云端 manifest 对账和缓存重建预检。"
          : manualReviewRows > 0
            ? "先导出处理包并处理人工处理项；不要在人工处理未确认前重建缓存。"
          : failedRows > 0
            ? "先查看失败回执并等待后台重试；不要在失败 pending 未确认前重建缓存。"
          : "先让后台同步补传；pending 未清零前不要重建本地缓存。",
    },
    {
      id: "hot-cache-index-ready",
      title: "本地热缓存索引已建立",
      status:
        hotCacheRouteTargets === 0
          ? "warn"
          : hotCacheIndexRows > 0
            ? "pass"
            : "warn",
      evidence:
        hotCacheIndexRows > 0
          ? `本地热缓存索引已有 ${hotCacheIndexRows} 行，覆盖 ${input.hotCacheLocalIndexSummary?.summary.distinct_route_targets ?? 0} 个入口。`
          : `预热计划有 ${hotCacheRouteTargets} 个 route target，但本机还没有热缓存索引记录。`,
      target: "常用入口先从本地 metadata 显示，正文和行值按打开时补齐。",
      next_action:
        hotCacheIndexRows > 0
          ? "继续保留索引，只把它当作可重建缓存，不当作主库。"
          : "在同步页运行“预热本机入口”，建立 metadata-only 索引。",
    },
    {
      id: "performance-samples-present",
      title: "本地流畅度样本足够",
      status:
        input.performanceSnapshots.length >= MIN_PERFORMANCE_SAMPLES
          ? "pass"
          : "warn",
      evidence: `当前只有 ${input.performanceSnapshots.length} 条本机耗时样本，目标至少 ${MIN_PERFORMANCE_SAMPLES} 条。`,
      target: "用真实打开日历、页面、peek 的样本判断是否接近本地级体验。",
      next_action:
        input.performanceSnapshots.length >= MIN_PERFORMANCE_SAMPLES
          ? "继续观察平均首屏和页面打开耗时。"
          : "多打开几次每日纪要、会议日历和页面，让系统收集本机耗时。",
    },
    {
      id: "local-first-target",
      title: "首屏达到本地级目标",
      status: getTimingGateStatus(localFirstAverageMs, LOCAL_FIRST_TARGET_MS),
      evidence:
        localFirstAverageMs === null
          ? "还没有可计算的首屏耗时样本。"
          : `平均首屏 ${Math.round(localFirstAverageMs)}ms，目标 ${LOCAL_FIRST_TARGET_MS}ms 以内。`,
      target: "日历和列表先显示本地 metadata，后台再做云端补齐。",
      next_action:
        localFirstAverageMs === null
          ? "先收集更多本机流畅度样本。"
          : localFirstAverageMs <= LOCAL_FIRST_TARGET_MS
            ? "首屏达标，下一步看页面打开和云端补齐。"
            : "优先扩大当前月/最近页面热缓存，并减少首屏同步阻塞。",
    },
    {
      id: "page-open-target",
      title: "页面打开耗时达标",
      status: getTimingGateStatus(averagePageOpenMs, PAGE_OPEN_TARGET_MS),
      evidence:
        averagePageOpenMs === null
          ? "还没有页面打开耗时样本。"
          : `页面打开平均 ${Math.round(averagePageOpenMs)}ms，目标 ${PAGE_OPEN_TARGET_MS}ms 以内。`,
      target: "打开页面像本地文档一样快，云端同步在后台完成。",
      next_action:
        averagePageOpenMs === null
          ? "打开几个真实页面，让系统记录页面打开耗时。"
          : averagePageOpenMs <= PAGE_OPEN_TARGET_MS
            ? "页面打开达标，继续扩展数据库/文件热缓存。"
            : "检查页面正文加载是否等待云端，必要时增加本地页面正文热缓存策略。",
    },
    {
      id: "database-row-open-target",
      title: "数据库行打开耗时达标",
      status: getTimingGateStatus(
        averageDatabaseRowOpenMs,
        DATABASE_ROW_OPEN_TARGET_MS
      ),
      evidence:
        averageDatabaseRowOpenMs === null
          ? "还没有数据库行打开耗时样本。"
          : `数据库行打开平均 ${Math.round(averageDatabaseRowOpenMs)}ms，目标 ${DATABASE_ROW_OPEN_TARGET_MS}ms 以内。`,
      target:
        "从数据库、日历、看板或 relation 助手打开 row 页面时先显示本地 metadata，再后台补齐正文。",
      next_action:
        averageDatabaseRowOpenMs === null
          ? "从真实数据库视图打开几条 row 页面，让系统记录数据库行打开耗时。"
          : averageDatabaseRowOpenMs <= DATABASE_ROW_OPEN_TARGET_MS
            ? "数据库行打开达标，继续扩大数据库热缓存和云端 row 同步覆盖。"
            : "优先检查数据库 row route handoff、页面草稿预热和 row 正文 hydration。",
    },
    {
      id: "page-body-hydration-target",
      title: "页面正文补齐耗时达标",
      status: getTimingGateStatus(
        averagePageBodyHydrationMs,
        PAGE_BODY_HYDRATION_TARGET_MS
      ),
      evidence:
        averagePageBodyHydrationMs === null
          ? "还没有页面正文补齐耗时样本。"
          : `页面正文补齐平均 ${Math.round(averagePageBodyHydrationMs)}ms，目标 ${PAGE_BODY_HYDRATION_TARGET_MS}ms 以内。`,
      target:
        "页面标题和属性应先显示；正文从本地热缓存或云端补齐时，过程要可见且不能阻塞基础交互。",
      next_action:
        averagePageBodyHydrationMs === null
          ? "打开几个真实页面，尤其是导入纪要后的长页面，让系统记录正文补齐耗时。"
          : averagePageBodyHydrationMs <= PAGE_BODY_HYDRATION_TARGET_MS
            ? "正文补齐达标，下一步继续优化长文编辑器和日历大量条目渲染。"
            : "优先检查页面正文是否频繁落到云端补齐；常用页面应进入本地正文热缓存或在打开前预热。",
    },
    {
      id: "cache-rebuild-safe",
      title: "本地缓存重建有安全门",
      status:
        input.cacheRebuildPreflightReceipt.summary.blockers > 0
          ? "warn"
          : "pass",
      evidence: `缓存重建预检 blockers ${input.cacheRebuildPreflightReceipt.summary.blockers} 个，warnings ${input.cacheRebuildPreflightReceipt.summary.warnings} 个。`,
      target: "本地缓存可从云端主库重建，但 pending 未清零前不能覆盖本机新输入。",
      next_action:
        input.cacheRebuildPreflightReceipt.summary.blockers > 0
          ? "先处理预检 blocker，再允许账号页执行重建。"
          : "保留预检收据；真实重建仍走账号页二次确认。",
    },
  ];

  const blockers = gates.filter((gate) => gate.status === "block").length;
  const warnings = gates.filter((gate) => gate.status === "warn").length;
  const verdict: CloudNativeFluidityVerdict =
    blockers > 0 ? "blocked" : warnings > 0 ? "partial" : "ready";
  const webBetaSyncGate = buildWebBetaSyncGate({
    gates,
    pagePendingRows,
    databasePendingRows,
    filePendingRows,
    syncLogPendingRows: syncLogUnclassifiedPendingRows,
    pageFailedRows: input.pageStatus.failed,
    databaseFailedRows: input.databaseStatus.failed,
    fileFailedRows: input.fileStatus.failed,
    fileManualReviewRows: input.fileStatus.manualReviewCount,
    syncLogFailedRows: input.syncSummary?.failed ?? 0,
    syncLogManualReviewRows: input.syncSummary?.manualReview ?? 0,
    totalManualReviewRows: manualReviewRows,
    hotCacheIndexRows,
    hotCacheRouteTargets,
    performanceSamples: input.performanceSnapshots.length,
    averageLocalFirstMs: localFirstAverageMs,
    averagePageOpenMs,
    averagePageBodyHydrationMs,
    cacheRebuildBlockers: input.cacheRebuildPreflightReceipt.summary.blockers,
  });

  return {
    format: "zhinote-cloud-native-fluidity-report",
    format_version: 1,
    report_status: "metadata-only-local-health-check",
    architecture_target: "cloud-master-local-hot-cache",
    generated_at: generatedAt,
    verdict,
    privacy_boundary:
      "This health check combines sync status, pending counts, hot cache metadata, and local timing samples only. It does not read page bodies, database row values, comment bodies, files, secrets, tokens, raw workspace content, or remote data; it does not send network requests, upload data, write server data, clear cache, or mutate workspace records.",
    boundary: {
      local_health_check_only: true,
      reads_page_body_text: false,
      reads_page_yjs: false,
      reads_database_row_values: false,
      reads_comment_bodies: false,
      reads_file_bytes: false,
      reads_file_text: false,
      reads_secret_values: false,
      sends_network_requests: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      mutates_local_cache_records: false,
      clears_local_cache: false,
      includes_raw_workspace_content: false,
    },
    summary: {
      gates: gates.length,
      passed: gates.filter((gate) => gate.status === "pass").length,
      warnings,
      blockers,
      page_pending_rows: pagePendingRows,
      database_pending_rows: databasePendingRows,
      page_failed_rows: input.pageStatus.failed,
      database_failed_rows: input.databaseStatus.failed,
      file_pending_rows: filePendingRows,
      file_failed_rows: input.fileStatus.failed,
      file_manual_review_rows: input.fileStatus.manualReviewCount,
      deduplicated_pending_rows: totalPendingRows,
      sync_log_pending_rows: input.syncSummary?.pending ?? 0,
      sync_log_covered_pending_rows: syncLogCoveredPendingRows,
      sync_log_unclassified_pending_rows: syncLogUnclassifiedPendingRows,
      sync_log_failed_rows: input.syncSummary?.failed ?? 0,
      sync_log_manual_review_rows: input.syncSummary?.manualReview ?? 0,
      hot_cache_ready_jobs: hotCacheReadyJobs,
      hot_cache_route_targets: hotCacheRouteTargets,
      hot_cache_index_rows: hotCacheIndexRows,
      performance_samples: input.performanceSnapshots.length,
      average_local_first_ms: roundMetric(localFirstAverageMs),
      average_page_open_ms: roundMetric(averagePageOpenMs),
      average_database_row_open_ms: roundMetric(averageDatabaseRowOpenMs),
      average_page_body_hydration_ms: roundMetric(averagePageBodyHydrationMs),
      web_beta_sync_gate_status: webBetaSyncGate.status,
      web_beta_sync_blockers: webBetaSyncGate.blocking_reasons.length,
      web_beta_sync_warnings: webBetaSyncGate.warning_reasons.length,
      can_request_owner_review_now:
        webBetaSyncGate.can_request_owner_review_now,
    },
    gates,
    metrics: [
      metric("page-pending", "页面 pending", pagePendingRows, "rows", "0 条为最佳", pagePendingRows === 0 ? "pass" : "warn"),
      metric("database-pending", "数据库 pending", databasePendingRows, "rows", "0 条为最佳", databasePendingRows === 0 ? "pass" : "warn"),
      metric("file-pending", "文件 pending", filePendingRows, "rows", "0 条为最佳", filePendingRows === 0 ? "pass" : "warn"),
      metric("page-failed-ack", "页面失败回执", input.pageStatus.failed, "rows", "0 条为最佳", input.pageStatus.failed === 0 ? "pass" : "warn"),
      metric("database-failed-ack", "数据库失败回执", input.databaseStatus.failed, "rows", "0 条为最佳", input.databaseStatus.failed === 0 ? "pass" : "warn"),
      metric("file-failed-ack", "文件失败回执", input.fileStatus.failed, "rows", "0 条为最佳", input.fileStatus.failed === 0 ? "pass" : "warn"),
      metric("hot-cache-routes", "可预热入口", hotCacheRouteTargets, "routes", "大于 0 且已写索引", hotCacheIndexRows > 0 ? "pass" : "warn"),
      metric("hot-cache-index", "热缓存索引", hotCacheIndexRows, "routes", "运行预热后应大于 0", hotCacheIndexRows > 0 ? "pass" : "warn"),
      metric("performance-samples", "耗时样本", input.performanceSnapshots.length, "samples", `${MIN_PERFORMANCE_SAMPLES}+`, input.performanceSnapshots.length >= MIN_PERFORMANCE_SAMPLES ? "pass" : "warn"),
      metric(
        "local-first",
        "平均首屏",
        roundMetric(localFirstAverageMs),
        "ms",
        `<=${LOCAL_FIRST_TARGET_MS}ms`,
        getTimingGateStatus(localFirstAverageMs, LOCAL_FIRST_TARGET_MS)
      ),
      metric("page-open", "页面打开", roundMetric(averagePageOpenMs), "ms", `<=${PAGE_OPEN_TARGET_MS}ms`, getTimingGateStatus(averagePageOpenMs, PAGE_OPEN_TARGET_MS)),
      metric("database-row-open", "数据库行打开", roundMetric(averageDatabaseRowOpenMs), "ms", `<=${DATABASE_ROW_OPEN_TARGET_MS}ms`, getTimingGateStatus(averageDatabaseRowOpenMs, DATABASE_ROW_OPEN_TARGET_MS)),
      metric("page-body-hydration", "页面正文补齐", roundMetric(averagePageBodyHydrationMs), "ms", `<=${PAGE_BODY_HYDRATION_TARGET_MS}ms`, getTimingGateStatus(averagePageBodyHydrationMs, PAGE_BODY_HYDRATION_TARGET_MS)),
      metric("ready-jobs", "Ready jobs", hotCacheReadyJobs, "jobs", "越多代表可预热范围越明确", hotCacheReadyJobs > 0 ? "pass" : "warn"),
    ],
    web_beta_sync_gate: webBetaSyncGate,
    next_action: getNextAction(verdict, gates),
  };
}

function buildWebBetaSyncGate(input: {
  gates: CloudNativeFluidityGate[];
  pagePendingRows: number;
  databasePendingRows: number;
  filePendingRows: number;
  syncLogPendingRows: number;
  pageFailedRows: number;
  databaseFailedRows: number;
  fileFailedRows: number;
  fileManualReviewRows: number;
  syncLogFailedRows: number;
  syncLogManualReviewRows: number;
  totalManualReviewRows: number;
  hotCacheIndexRows: number;
  hotCacheRouteTargets: number;
  performanceSamples: number;
  averageLocalFirstMs: number | null;
  averagePageOpenMs: number | null;
  averagePageBodyHydrationMs: number | null;
  cacheRebuildBlockers: number;
}): CloudNativeFluidityWebBetaSyncGate {
  const failedRows = Math.max(
    input.pageFailedRows + input.databaseFailedRows + input.fileFailedRows,
    input.syncLogFailedRows
  );
  const pendingRows =
    input.pagePendingRows +
    input.databasePendingRows +
    input.filePendingRows +
    input.syncLogPendingRows;
  const gateBlockers = input.gates
    .filter((gate) => gate.status === "block")
    .map((gate) => `${gate.title}: ${gate.next_action}`);
  const gateWarnings = input.gates
    .filter((gate) => gate.status === "warn")
    .map((gate) => `${gate.title}: ${gate.next_action}`);
  const blockingReasons = unique([
    ...gateBlockers,
    ...(failedRows > 0
      ? [
          `仍有 ${failedRows} 条页面/数据库/文件失败回执，真实云端主库启用前必须先确认重试或人工处理。`,
        ]
      : []),
    ...(input.totalManualReviewRows > 0
      ? [
          `仍有 ${input.totalManualReviewRows} 条页面/数据库/文件/sync_log 人工处理项，Web Beta 前必须先处理。`,
        ]
      : []),
    ...(input.cacheRebuildBlockers > 0
      ? [
          `缓存重建预检仍有 ${input.cacheRebuildBlockers} 个 blocker，不能把本地缓存当作可安全重建。`,
        ]
      : []),
  ]);
  const warningReasons = unique([
    ...gateWarnings,
    ...(pendingRows > 0
      ? [
          `还有 ${pendingRows} 条 pending/queued 本地变更；这不是数据丢失，但 Web Beta 前需要看到稳定 ACK。`,
        ]
      : []),
  ]).filter((reason) => !blockingReasons.includes(reason));
  const status: CloudNativeFluidityGateStatus =
    blockingReasons.length > 0
      ? "block"
      : warningReasons.length > 0
        ? "warn"
        : "pass";

  return {
    id: "web-beta-sync-fluidity-gate",
    title: "Web Beta 同步流畅度门禁",
    status,
    can_request_owner_review_now: status === "pass",
    can_enable_cloud_source_of_truth_now: false,
    blocking_reasons: blockingReasons,
    warning_reasons: warningReasons,
    evidence: [
      `页面 pending ${input.pagePendingRows} / failed ${input.pageFailedRows}`,
      `数据库 pending ${input.databasePendingRows} / failed ${input.databaseFailedRows}`,
      `文件 pending ${input.filePendingRows} / failed ${input.fileFailedRows} / manual ${input.fileManualReviewRows}`,
      `sync_log 额外 pending ${input.syncLogPendingRows} / failed ${input.syncLogFailedRows} / manual ${input.syncLogManualReviewRows}`,
      `热缓存索引 ${input.hotCacheIndexRows} 行 / ${input.hotCacheRouteTargets} 个可预热入口`,
      `本机耗时样本 ${input.performanceSamples} 条，首屏 ${formatGateMs(input.averageLocalFirstMs)}，页面打开 ${formatGateMs(input.averagePageOpenMs)}，正文补齐 ${formatGateMs(input.averagePageBodyHydrationMs)}`,
    ],
    required_before_owner_review: [
      "云 workspace 已绑定，页面和数据库同步都开启。",
      "页面/数据库/文件失败回执为 0，pending 队列能稳定收到 ACK。",
      "常用入口热缓存索引已建立，刷新后先显示 metadata。",
      "本机首屏、页面打开和正文补齐耗时达到目标，或有清楚的优化剩余项。",
      "缓存重建预检没有 blocker，真实启用仍需 owner 二次确认。",
    ],
    next_action:
      status === "block"
        ? blockingReasons[0] ?? "先处理同步阻断项。"
        : status === "warn"
          ? warningReasons[0] ?? "继续收集本机样本并观察 ACK。"
          : "同步流畅度可以进入 owner review；真实云端主库启用仍保持关闭，等待 owner 明确确认。",
  };
}

function metric(
  id: string,
  title: string,
  value: number | null,
  unit: CloudNativeFluidityMetric["unit"],
  target: string,
  status: CloudNativeFluidityGateStatus
): CloudNativeFluidityMetric {
  return { id, title, value, unit, target, status };
}

function getTimingGateStatus(
  averageMs: number | null,
  targetMs: number
): CloudNativeFluidityGateStatus {
  if (averageMs === null) return "warn";
  return averageMs <= targetMs ? "pass" : "warn";
}

function calculateAverageLocalFirstMs(
  snapshots: LocalPerformanceSnapshot[]
): number | null {
  const values = snapshots
    .map((snapshot) => snapshot.local_first_ms)
    .filter((value): value is number => typeof value === "number");
  return average(values);
}

function averageDurationMs(
  snapshots: LocalPerformanceSnapshot[],
  kind: LocalPerformanceSnapshot["kind"]
): number | null {
  return average(
    snapshots
      .filter((snapshot) => snapshot.kind === kind)
      .map((snapshot) => snapshot.duration_ms)
  );
}

function average(values: number[]): number | null {
  const finiteValues = values.filter((value) => Number.isFinite(value));
  if (finiteValues.length === 0) return null;
  return finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length;
}

function roundMetric(value: number | null): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(value);
}

function formatGateMs(value: number | null): string {
  return value === null ? "暂无" : `${Math.round(value)}ms`;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function getNextAction(
  verdict: CloudNativeFluidityVerdict,
  gates: CloudNativeFluidityGate[]
): string {
  const firstBlocker = gates.find((gate) => gate.status === "block");
  if (firstBlocker) return firstBlocker.next_action;
  const firstWarning = gates.find((gate) => gate.status === "warn");
  if (firstWarning) return firstWarning.next_action;
  if (verdict === "ready") {
    return "当前本机输入流畅度和云端主库边界都达标；下一步扩展文件、评论和版本历史的云端主库。";
  }
  return "继续补齐云端主库、热缓存和本地性能样本。";
}
