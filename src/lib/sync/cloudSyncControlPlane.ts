import type { PendingCloudDatabaseSyncStatus } from "@/lib/database/accountDatabaseSync";
import type { PendingCloudPageSyncStatus } from "@/lib/pages/accountPageSync";
import type { CloudAckCacheSafetyReport } from "@/lib/sync/cloudAckCacheSafetyReport";
import type { CloudUploadReliabilityReport } from "@/lib/sync/cloudUploadReliabilityReport";
import type { HotCacheWarmupPlan } from "@/lib/sync/hotCacheWarmupPlan";
import type { HotCacheWarmupReceipt } from "@/lib/sync/hotCacheWarmupReceipt";
import type { LocalFirstCloudInputPlan } from "@/lib/sync/localFirstCloudInputPlan";
import type { SyncHandoffReadinessReceipt } from "@/lib/sync/syncHandoffReadinessReceipt";
import type { SyncUploadDrainReceipt } from "@/lib/sync/syncUploadDrainReceipt";
import type { SyncLogSummary } from "@/lib/db/local/queries";

export type CloudSyncControlPlaneVerdict =
  | "ready-for-local-speed-input"
  | "needs-cloud-workspace-link"
  | "drain-pending-first"
  | "blocked-by-failures"
  | "manual-review-required"
  | "ready-for-device-handoff";

export type CloudSyncControlPlaneDecisionStatus =
  | "go"
  | "watch"
  | "block";

export type CloudSyncControlPlaneAction =
  | "continue-typing"
  | "run-background-drain"
  | "open-manual-review"
  | "warm-selected-cache"
  | "block-cache-rebuild"
  | "allow-device-handoff";

export interface CloudSyncControlPlaneInput {
  pageStatus: PendingCloudPageSyncStatus;
  databaseStatus: PendingCloudDatabaseSyncStatus;
  syncSummary: SyncLogSummary | null;
  localFirstCloudInputPlan: LocalFirstCloudInputPlan;
  cloudUploadReliabilityReport: CloudUploadReliabilityReport;
  cloudAckCacheSafetyReport: CloudAckCacheSafetyReport;
  handoffReadinessReceipt: SyncHandoffReadinessReceipt;
  hotCacheWarmupPlan: HotCacheWarmupPlan;
  hotCacheWarmupReceipt: HotCacheWarmupReceipt | null;
  lastDrainReceipt: SyncUploadDrainReceipt | null;
  generatedAt?: string;
}

export interface CloudSyncControlDecision {
  id:
    | "local-input"
    | "background-drain"
    | "cloud-confirmation"
    | "hot-cache"
    | "cache-rebuild"
    | "device-handoff";
  title: string;
  status: CloudSyncControlPlaneDecisionStatus;
  user_visible_state: string;
  evidence: string;
  next_action: string;
  blocks_typing: boolean;
  blocks_navigation: boolean;
  blocks_cache_rebuild: boolean;
  blocks_device_handoff: boolean;
}

export interface CloudSyncControlInstruction {
  order: number;
  action: CloudSyncControlPlaneAction;
  label: string;
  trigger: string;
  execution: string;
  owner_visible_copy: string;
  blocks_user_input: boolean;
  requires_owner_confirmation: boolean;
}

export interface CloudSyncControlPlane {
  format: "zhinote-cloud-sync-control-plane";
  format_version: 1;
  plane_status: "metadata-only-local-sync-control";
  architecture_target: "cloud-master-local-hot-cache";
  generated_at: string;
  verdict: CloudSyncControlPlaneVerdict;
  local_input_should_feel_native: true;
  can_keep_typing_now: boolean;
  should_run_background_drain_now: boolean;
  can_claim_cloud_confirmed_now: boolean;
  can_warm_selected_hot_cache_now: boolean;
  can_rebuild_local_cache_now: boolean;
  can_switch_device_now: boolean;
  can_write_server_data_now: false;
  can_upload_workspace_data_now: false;
  can_clear_local_cache_now: false;
  privacy_boundary: string;
  boundary: {
    local_control_plane_only: true;
    reads_queue_counts: true;
    reads_queue_timestamps: true;
    reads_failure_counts: true;
    reads_failure_messages: true;
    reads_last_sync_timestamps: true;
    reads_handoff_hashes: true;
    reads_hot_cache_route_counts: true;
    reads_page_ids: false;
    reads_database_keys: false;
    reads_page_body_text: false;
    reads_page_yjs: false;
    reads_database_row_values: false;
    reads_comment_bodies: false;
    reads_file_names: false;
    reads_file_bytes: false;
    reads_secret_values: false;
    reads_tokens_or_cookies: false;
    sends_network_requests: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    mutates_local_cache: false;
    clears_local_cache: false;
    marks_local_rows_synced: false;
    enables_sync_push: false;
    enables_sync_pull: false;
    enables_ai: false;
  };
  summary: {
    decisions: number;
    go: number;
    watch: number;
    blocked: number;
    page_waiting_rows: number;
    database_waiting_rows: number;
    sync_log_pending_rows: number;
    total_waiting_rows: number;
    failed_rows: number;
    manual_review_rows: number;
    cloud_workspace_linked: boolean;
    page_sync_enabled: boolean;
    database_sync_enabled: boolean;
    oldest_pending_age_label: string;
    last_drain_safe_to_switch_device: boolean;
    hot_cache_ready_jobs: number;
    hot_cache_pending_rows_protected: number;
  };
  decisions: CloudSyncControlDecision[];
  instructions: CloudSyncControlInstruction[];
  owner_visible_banner: string;
  next_action: string;
}

export function buildCloudSyncControlPlane(
  input: CloudSyncControlPlaneInput
): CloudSyncControlPlane {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const pageWaitingRows = input.pageStatus.pending + input.pageStatus.queued;
  const databaseWaitingRows =
    input.databaseStatus.pending +
    input.databaseStatus.queued +
    input.databaseStatus.syncLogPending;
  const syncLogPendingRows = input.syncSummary?.pending ?? 0;
  const totalWaitingRows =
    pageWaitingRows + databaseWaitingRows + syncLogPendingRows;
  const failedRows = input.pageStatus.failed + input.databaseStatus.failed;
  const manualReviewRows =
    input.pageStatus.manualReviewCount +
    input.databaseStatus.manualReviewCount;
  const cloudWorkspaceLinked =
    input.handoffReadinessReceipt.summary.cloud_workspace_linked;
  const pageSyncEnabled = input.pageStatus.enabled;
  const databaseSyncEnabled = input.databaseStatus.enabled;
  const lastDrainSafeToSwitchDevice =
    input.lastDrainReceipt?.summary.safe_to_switch_device_now ?? false;
  const hotCacheReadyJobs = input.hotCacheWarmupPlan.jobs.filter(
    (job) => job.status === "ready"
  ).length;
  const canClaimCloudConfirmedNow =
    input.cloudAckCacheSafetyReport.can_show_cloud_confirmed_now &&
    input.cloudUploadReliabilityReport.summary.safe_to_switch_device_now &&
    input.localFirstCloudInputPlan.can_claim_cloud_confirmed_now;
  const canSwitchDeviceNow =
    input.handoffReadinessReceipt.summary.ready_for_cross_device_handoff &&
    canClaimCloudConfirmedNow;
  const canWarmSelectedHotCacheNow =
    hotCacheReadyJobs > 0 && input.cloudAckCacheSafetyReport.summary.blockers === 0;
  const shouldRunBackgroundDrainNow =
    totalWaitingRows > 0 &&
    failedRows === 0 &&
    manualReviewRows === 0 &&
    pageSyncEnabled &&
    databaseSyncEnabled;
  const canKeepTypingNow =
    input.localFirstCloudInputPlan.can_confirm_local_save_immediately &&
    manualReviewRows === 0;
  const canRebuildLocalCacheNow =
    input.cloudAckCacheSafetyReport.can_queue_cache_rebuild_confirmation_now &&
    input.handoffReadinessReceipt.summary.ready_for_cloud_cache_read;
  const decisions = buildDecisions({
    input,
    pageWaitingRows,
    databaseWaitingRows,
    syncLogPendingRows,
    totalWaitingRows,
    failedRows,
    manualReviewRows,
    cloudWorkspaceLinked,
    pageSyncEnabled,
    databaseSyncEnabled,
    lastDrainSafeToSwitchDevice,
    hotCacheReadyJobs,
    canKeepTypingNow,
    shouldRunBackgroundDrainNow,
    canClaimCloudConfirmedNow,
    canWarmSelectedHotCacheNow,
    canRebuildLocalCacheNow,
    canSwitchDeviceNow,
  });
  const go = decisions.filter((decision) => decision.status === "go").length;
  const watch = decisions.filter((decision) => decision.status === "watch").length;
  const blocked = decisions.filter(
    (decision) => decision.status === "block"
  ).length;
  const verdict = getVerdict({
    cloudWorkspaceLinked,
    totalWaitingRows,
    failedRows,
    manualReviewRows,
    canSwitchDeviceNow,
  });

  return {
    format: "zhinote-cloud-sync-control-plane",
    format_version: 1,
    plane_status: "metadata-only-local-sync-control",
    architecture_target: "cloud-master-local-hot-cache",
    generated_at: generatedAt,
    verdict,
    local_input_should_feel_native: true,
    can_keep_typing_now: canKeepTypingNow,
    should_run_background_drain_now: shouldRunBackgroundDrainNow,
    can_claim_cloud_confirmed_now: canClaimCloudConfirmedNow,
    can_warm_selected_hot_cache_now: canWarmSelectedHotCacheNow,
    can_rebuild_local_cache_now: canRebuildLocalCacheNow,
    can_switch_device_now: canSwitchDeviceNow,
    can_write_server_data_now: false,
    can_upload_workspace_data_now: false,
    can_clear_local_cache_now: false,
    privacy_boundary:
      "Generated locally from page/database pending queues, sync_log counts, last drain receipt, handoff readiness, hot-cache plan, cloud ACK/cache safety, and upload reliability metadata. It does not read or export page ids, database keys, page bodies, Yjs payloads, database row values, comments, file names, file bytes, secrets, tokens, cookies, credentials, or raw workspace content. It does not send network requests, upload workspace data, write server data, mutate local cache, clear local cache, mark local rows synced, enable sync push/pull, or enable AI.",
    boundary: {
      local_control_plane_only: true,
      reads_queue_counts: true,
      reads_queue_timestamps: true,
      reads_failure_counts: true,
      reads_failure_messages: true,
      reads_last_sync_timestamps: true,
      reads_handoff_hashes: true,
      reads_hot_cache_route_counts: true,
      reads_page_ids: false,
      reads_database_keys: false,
      reads_page_body_text: false,
      reads_page_yjs: false,
      reads_database_row_values: false,
      reads_comment_bodies: false,
      reads_file_names: false,
      reads_file_bytes: false,
      reads_secret_values: false,
      reads_tokens_or_cookies: false,
      sends_network_requests: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      mutates_local_cache: false,
      clears_local_cache: false,
      marks_local_rows_synced: false,
      enables_sync_push: false,
      enables_sync_pull: false,
      enables_ai: false,
    },
    summary: {
      decisions: decisions.length,
      go,
      watch,
      blocked,
      page_waiting_rows: pageWaitingRows,
      database_waiting_rows: databaseWaitingRows,
      sync_log_pending_rows: syncLogPendingRows,
      total_waiting_rows: totalWaitingRows,
      failed_rows: failedRows,
      manual_review_rows: manualReviewRows,
      cloud_workspace_linked: cloudWorkspaceLinked,
      page_sync_enabled: pageSyncEnabled,
      database_sync_enabled: databaseSyncEnabled,
      oldest_pending_age_label:
        input.handoffReadinessReceipt.summary.oldest_pending_age_label,
      last_drain_safe_to_switch_device: lastDrainSafeToSwitchDevice,
      hot_cache_ready_jobs: hotCacheReadyJobs,
      hot_cache_pending_rows_protected:
        input.hotCacheWarmupPlan.summary.pending_rows_protected,
    },
    decisions,
    instructions: buildInstructions({
      shouldRunBackgroundDrainNow,
      canWarmSelectedHotCacheNow,
      canRebuildLocalCacheNow,
      canSwitchDeviceNow,
      failedRows,
      manualReviewRows,
    }),
    owner_visible_banner: getOwnerVisibleBanner(verdict),
    next_action: getNextAction(verdict),
  };
}

function buildDecisions(input: {
  input: CloudSyncControlPlaneInput;
  pageWaitingRows: number;
  databaseWaitingRows: number;
  syncLogPendingRows: number;
  totalWaitingRows: number;
  failedRows: number;
  manualReviewRows: number;
  cloudWorkspaceLinked: boolean;
  pageSyncEnabled: boolean;
  databaseSyncEnabled: boolean;
  lastDrainSafeToSwitchDevice: boolean;
  hotCacheReadyJobs: number;
  canKeepTypingNow: boolean;
  shouldRunBackgroundDrainNow: boolean;
  canClaimCloudConfirmedNow: boolean;
  canWarmSelectedHotCacheNow: boolean;
  canRebuildLocalCacheNow: boolean;
  canSwitchDeviceNow: boolean;
}): CloudSyncControlDecision[] {
  return [
    decision({
      id: "local-input",
      title: "输入体验",
      status: input.canKeepTypingNow ? "go" : "watch",
      userVisibleState: input.canKeepTypingNow
        ? "本地已保存，后台同步"
        : "本地已保存，但同步需要处理",
      evidence: input.input.localFirstCloudInputPlan.next_action,
      nextAction: input.canKeepTypingNow
        ? "继续打字和跳转；不要等待云端请求完成。"
        : "先处理失败或人工处理队列，避免同一批输入长期卡在待上传。",
      blocksTyping: !input.canKeepTypingNow,
      blocksNavigation: false,
      blocksCacheRebuild: true,
      blocksDeviceHandoff: true,
    }),
    decision({
      id: "background-drain",
      title: "后台补传",
      status:
        input.manualReviewRows > 0 || input.failedRows > 0
          ? "block"
          : input.shouldRunBackgroundDrainNow
            ? "go"
            : input.totalWaitingRows > 0
              ? "watch"
              : "go",
      userVisibleState: input.shouldRunBackgroundDrainNow
        ? "应该补传 pending queue"
        : input.totalWaitingRows > 0
          ? "等待登录/配置/退避恢复"
          : "暂无待补传",
      evidence: `${input.pageWaitingRows} 页面 · ${input.databaseWaitingRows} 数据库 · ${input.syncLogPendingRows} sync_log。`,
      nextAction: input.shouldRunBackgroundDrainNow
        ? "运行普通补传；只补传明确排队的本地修改。"
        : input.totalWaitingRows > 0
          ? "检查账号云同步、认证退避和最近失败原因。"
          : "保持队列可见，继续监听新输入。",
      blocksTyping: false,
      blocksNavigation: false,
      blocksCacheRebuild: input.totalWaitingRows > 0,
      blocksDeviceHandoff: input.totalWaitingRows > 0,
    }),
    decision({
      id: "cloud-confirmation",
      title: "云端确认",
      status: input.canClaimCloudConfirmedNow ? "go" : "watch",
      userVisibleState: input.canClaimCloudConfirmedNow
        ? "云端已确认"
        : "本地已保存，等待云端确认",
      evidence: input.input.cloudAckCacheSafetyReport.next_action,
      nextAction: input.canClaimCloudConfirmedNow
        ? "可以把状态显示为云端已确认。"
        : "继续区分本地保存和云端 ACK，不要提前显示云端已确认。",
      blocksTyping: false,
      blocksNavigation: false,
      blocksCacheRebuild: !input.canClaimCloudConfirmedNow,
      blocksDeviceHandoff: !input.canClaimCloudConfirmedNow,
    }),
    decision({
      id: "hot-cache",
      title: "常用内容热缓存",
      status: input.canWarmSelectedHotCacheNow ? "go" : "watch",
      userVisibleState: input.canWarmSelectedHotCacheNow
        ? "可预热常用入口"
        : "只保留现有热缓存",
      evidence: `${input.hotCacheReadyJobs} 个 ready job；最近收据 ${
        input.input.hotCacheWarmupReceipt?.summary.prefetched_jobs ?? 0
      } 个 job 已预热。`,
      nextAction: input.canWarmSelectedHotCacheNow
        ? "可以执行 route prefetch；不读取正文、不上传、不写 sync_log。"
        : "先清理 ACK/cache blocker，再预热选中的常用入口。",
      blocksTyping: false,
      blocksNavigation: false,
      blocksCacheRebuild: false,
      blocksDeviceHandoff: false,
    }),
    decision({
      id: "cache-rebuild",
      title: "本地缓存重建",
      status: input.canRebuildLocalCacheNow ? "go" : "block",
      userVisibleState: input.canRebuildLocalCacheNow
        ? "可以进入二次确认"
        : "禁止重建本地缓存",
      evidence: `cache gate=${input.input.cloudAckCacheSafetyReport.verdict}; handoff=${input.input.handoffReadinessReceipt.status}.`,
      nextAction: input.canRebuildLocalCacheNow
        ? "只在二次确认后按云端 manifest 重建本地缓存。"
        : "pending、失败、人工处理或 ACK 证明未完成前不能清缓存。",
      blocksTyping: false,
      blocksNavigation: false,
      blocksCacheRebuild: !input.canRebuildLocalCacheNow,
      blocksDeviceHandoff: !input.canRebuildLocalCacheNow,
    }),
    decision({
      id: "device-handoff",
      title: "跨设备切换",
      status: input.canSwitchDeviceNow ? "go" : "block",
      userVisibleState: input.canSwitchDeviceNow ? "可以切换设备" : "暂不建议切设备",
      evidence: `handoff=${input.input.handoffReadinessReceipt.status}; lastDrainSafe=${input.lastDrainSafeToSwitchDevice}.`,
      nextAction: input.canSwitchDeviceNow
        ? "可以在另一台设备打开同一账号。"
        : "等 pending、failed、manual review 清零，并确认 durable ACK。",
      blocksTyping: false,
      blocksNavigation: false,
      blocksCacheRebuild: !input.canSwitchDeviceNow,
      blocksDeviceHandoff: !input.canSwitchDeviceNow,
    }),
  ];
}

function buildInstructions(input: {
  shouldRunBackgroundDrainNow: boolean;
  canWarmSelectedHotCacheNow: boolean;
  canRebuildLocalCacheNow: boolean;
  canSwitchDeviceNow: boolean;
  failedRows: number;
  manualReviewRows: number;
}): CloudSyncControlInstruction[] {
  return [
    {
      order: 1,
      action: "continue-typing",
      label: "先让输入落本地",
      trigger: "任何 page/database/settings 编辑发生时。",
      execution: "立即写本地状态和 pending queue，不等待云端请求。",
      owner_visible_copy: "本地已保存，正在后台同步。",
      blocks_user_input: false,
      requires_owner_confirmation: false,
    },
    {
      order: 2,
      action:
        input.failedRows > 0 || input.manualReviewRows > 0
          ? "open-manual-review"
          : "run-background-drain",
      label: "再补传 pending queue",
      trigger: input.shouldRunBackgroundDrainNow
        ? "页面和数据库同步开启，且存在待补传记录。"
        : "待补传记录为空、同步未开启，或存在失败/人工处理记录。",
      execution: "只处理显式 pending rows；不做全量上传。",
      owner_visible_copy:
        input.failedRows > 0 || input.manualReviewRows > 0
          ? "同步需要处理。"
          : "等待云端确认。",
      blocks_user_input: false,
      requires_owner_confirmation: false,
    },
    {
      order: 3,
      action: "warm-selected-cache",
      label: "预热常用入口",
      trigger: input.canWarmSelectedHotCacheNow
        ? "热缓存计划有 ready job，且 ACK/cache gate 没有 blocker。"
        : "热缓存仍被 pending、ACK 或配置状态限制。",
      execution: "只执行 route prefetch 和 metadata 索引，不读取正文或文件。",
      owner_visible_copy: "常用入口正在预热。",
      blocks_user_input: false,
      requires_owner_confirmation: false,
    },
    {
      order: 4,
      action: input.canRebuildLocalCacheNow
        ? "allow-device-handoff"
        : "block-cache-rebuild",
      label: "最后才允许清缓存/切设备",
      trigger: input.canSwitchDeviceNow
        ? "pending、failed、manual review 清零，且 durable ACK 证明通过。"
        : "仍有 pending、失败、人工处理或 ACK 证明不足。",
      execution: "缓存重建必须走二次确认；当前控制面本身不清缓存。",
      owner_visible_copy: input.canSwitchDeviceNow
        ? "可以切换设备。"
        : "暂不建议切换设备或重建缓存。",
      blocks_user_input: false,
      requires_owner_confirmation: true,
    },
  ];
}

function getVerdict(input: {
  cloudWorkspaceLinked: boolean;
  totalWaitingRows: number;
  failedRows: number;
  manualReviewRows: number;
  canSwitchDeviceNow: boolean;
}): CloudSyncControlPlaneVerdict {
  if (input.manualReviewRows > 0) return "manual-review-required";
  if (input.failedRows > 0) return "blocked-by-failures";
  if (!input.cloudWorkspaceLinked) return "needs-cloud-workspace-link";
  if (input.canSwitchDeviceNow) return "ready-for-device-handoff";
  if (input.totalWaitingRows > 0) return "drain-pending-first";
  return "ready-for-local-speed-input";
}

function getOwnerVisibleBanner(verdict: CloudSyncControlPlaneVerdict): string {
  switch (verdict) {
    case "ready-for-device-handoff":
      return "当前队列和 ACK 状态支持跨设备继续使用。";
    case "drain-pending-first":
      return "本地输入可继续，但请先让后台补传队列清零。";
    case "needs-cloud-workspace-link":
      return "本地输入会先保存；连接云 workspace 后才能证明进入云端主库。";
    case "blocked-by-failures":
      return "存在失败同步记录；不要清缓存或切设备。";
    case "manual-review-required":
      return "存在需要人工处理的同步记录；先导出复核包。";
    case "ready-for-local-speed-input":
      return "输入可以保持本地级速度，云端确认仍按 ACK gate 展示。";
  }
}

function getNextAction(verdict: CloudSyncControlPlaneVerdict): string {
  switch (verdict) {
    case "ready-for-device-handoff":
      return "可以继续推进 Web Beta 的跨设备 smoke test 和云端主数据验证。";
    case "drain-pending-first":
      return "运行补传全部本地输入；补传后重新检查控制面。";
    case "needs-cloud-workspace-link":
      return "先登录并连接云 workspace；没有链接时只能保证本地保存。";
    case "blocked-by-failures":
      return "先查看最近失败原因并重试；失败未清零前禁止缓存重建。";
    case "manual-review-required":
      return "导出人工复核包，处理超过重试阈值的记录。";
    case "ready-for-local-speed-input":
      return "继续保持本地优先输入，同时推进统一 push/pull API 的真实启用门禁。";
  }
}

function decision(input: {
  id: CloudSyncControlDecision["id"];
  title: string;
  status: CloudSyncControlPlaneDecisionStatus;
  userVisibleState: string;
  evidence: string;
  nextAction: string;
  blocksTyping: boolean;
  blocksNavigation: boolean;
  blocksCacheRebuild: boolean;
  blocksDeviceHandoff: boolean;
}): CloudSyncControlDecision {
  return {
    id: input.id,
    title: input.title,
    status: input.status,
    user_visible_state: input.userVisibleState,
    evidence: input.evidence,
    next_action: input.nextAction,
    blocks_typing: input.blocksTyping,
    blocks_navigation: input.blocksNavigation,
    blocks_cache_rebuild: input.blocksCacheRebuild,
    blocks_device_handoff: input.blocksDeviceHandoff,
  };
}
