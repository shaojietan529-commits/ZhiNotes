import type { PendingCloudDatabaseSyncStatus } from "@/lib/database/accountDatabaseSync";
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
    sync_log_pending_rows: number;
    hot_cache_ready_jobs: number;
    hot_cache_route_targets: number;
    hot_cache_index_rows: number;
    performance_samples: number;
    average_local_first_ms: number | null;
    average_page_open_ms: number | null;
  };
  gates: CloudNativeFluidityGate[];
  metrics: CloudNativeFluidityMetric[];
  next_action: string;
}

const LOCAL_FIRST_TARGET_MS = 800;
const PAGE_OPEN_TARGET_MS = 1200;
const MIN_PERFORMANCE_SAMPLES = 3;

export function buildCloudNativeFluidityReport(
  input: CloudNativeFluidityReportInput
): CloudNativeFluidityReport {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const pagePendingRows = input.pageStatus.pending + input.pageStatus.queued;
  const databasePendingRows =
    input.databaseStatus.pending +
    input.databaseStatus.queued +
    input.databaseStatus.syncLogPending;
  const totalPendingRows =
    pagePendingRows + databasePendingRows + (input.syncSummary?.pending ?? 0);
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
      status: totalPendingRows === 0 ? "pass" : "warn",
      evidence:
        totalPendingRows === 0
          ? "当前没有待上传队列，云端和本地更容易对齐。"
          : `当前共有 ${totalPendingRows} 条待上传/排队记录；这是本地级输入体验的缓冲区，不应被清理。`,
      target: "输入先写本地，再进入 pending queue，云端确认前不能丢。",
      next_action:
        totalPendingRows === 0
          ? "可以继续做云端 manifest 对账和缓存重建预检。"
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
      sync_log_pending_rows: input.syncSummary?.pending ?? 0,
      hot_cache_ready_jobs: hotCacheReadyJobs,
      hot_cache_route_targets: hotCacheRouteTargets,
      hot_cache_index_rows: hotCacheIndexRows,
      performance_samples: input.performanceSnapshots.length,
      average_local_first_ms: roundMetric(localFirstAverageMs),
      average_page_open_ms: roundMetric(averagePageOpenMs),
    },
    gates,
    metrics: [
      metric("page-pending", "页面 pending", pagePendingRows, "rows", "0 条为最佳", pagePendingRows === 0 ? "pass" : "warn"),
      metric("database-pending", "数据库 pending", databasePendingRows, "rows", "0 条为最佳", databasePendingRows === 0 ? "pass" : "warn"),
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
      metric("ready-jobs", "Ready jobs", hotCacheReadyJobs, "jobs", "越多代表可预热范围越明确", hotCacheReadyJobs > 0 ? "pass" : "warn"),
    ],
    next_action: getNextAction(verdict, gates),
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
