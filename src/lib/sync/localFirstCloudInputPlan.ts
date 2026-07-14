import type { PendingCloudDatabaseSyncStatus } from "@/lib/database/accountDatabaseSync";
import type { SyncLogSummary } from "@/lib/db/local/queries";
import type { PendingFileEmbedSyncStatus } from "@/lib/files/fileEmbedSyncQueue";
import type { PendingCloudPageSyncStatus } from "@/lib/pages/accountPageSync";
import type {
  CloudNativeFluidityGateStatus,
  CloudNativeFluidityReport,
} from "@/lib/sync/cloudNativeFluidityReport";
import type { SyncPushApiDisabledResponse } from "@/lib/sync/syncPushApiStub";
import type { SyncUploadDrainReceipt } from "@/lib/sync/syncUploadDrainReceipt";

export type LocalFirstCloudInputVerdict =
  | "ready-to-buffer"
  | "needs-account-cloud"
  | "needs-drain"
  | "blocked";

export type LocalFirstCloudInputGateStatus =
  | "pass"
  | "warn"
  | "block";

export interface LocalFirstCloudInputPlanInput {
  pageStatus: PendingCloudPageSyncStatus;
  databaseStatus: PendingCloudDatabaseSyncStatus;
  fileStatus: PendingFileEmbedSyncStatus;
  syncSummary: SyncLogSummary | null;
  cloudNativeFluidityReport: CloudNativeFluidityReport;
  syncPushApiGuard: SyncPushApiDisabledResponse;
  lastDrainReceipt: SyncUploadDrainReceipt | null;
  generatedAt?: string;
}

export interface LocalFirstCloudInputGate {
  id: string;
  title: string;
  status: LocalFirstCloudInputGateStatus;
  evidence: string;
  user_visible_state: string;
  required_before_full_cloud: string;
}

export interface LocalFirstCloudInputUiState {
  id:
    | "local-saved"
    | "waiting-cloud"
    | "cloud-confirmed"
    | "needs-review"
    | "offline-buffer";
  label: string;
  when_to_show: string;
  copy: string;
  blocks_navigation: boolean;
  blocks_cache_rebuild: boolean;
}

export interface LocalFirstCloudInputPlan {
  format: "zhinote-local-first-cloud-input-plan";
  format_version: 1;
  report_status: "metadata-only-local-input-plan";
  architecture_target: "cloud-master-local-optimistic-input";
  generated_at: string;
  verdict: LocalFirstCloudInputVerdict;
  can_confirm_local_save_immediately: true;
  can_queue_background_upload: boolean;
  can_claim_cloud_confirmed_now: boolean;
  can_enable_full_realtime_cloud_now: false;
  can_write_server_data_now: false;
  can_upload_workspace_data_now: false;
  privacy_boundary: string;
  boundary: {
    local_planning_only: true;
    reads_queue_counts: true;
    reads_queue_timestamps: true;
    reads_failure_counts: true;
    reads_last_sync_timestamps: true;
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
    acknowledges_remote_rows: false;
    marks_local_rows_synced: false;
    clears_local_cache: false;
    enables_sync_push_api: false;
  };
  summary: {
    gates: number;
    passed: number;
    warnings: number;
    blockers: number;
    page_waiting_rows: number;
    database_waiting_rows: number;
    file_waiting_rows: number;
    sync_log_pending_rows: number;
    failed_rows: number;
    manual_review_rows: number;
    total_waiting_rows: number;
    cloud_domains_enabled: number;
    cloud_domains_required: 2;
    cloud_confirmed_domains: number;
    last_drain_safe_to_switch_device: boolean;
    fluidity_gate_status: CloudNativeFluidityGateStatus;
  };
  gates: LocalFirstCloudInputGate[];
  ui_states: LocalFirstCloudInputUiState[];
  recommended_write_flow: string[];
  next_action: string;
}

export function buildLocalFirstCloudInputPlan(
  input: LocalFirstCloudInputPlanInput
): LocalFirstCloudInputPlan {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const pageWaitingRows =
    input.pageStatus.pending +
    input.pageStatus.queued +
    (input.pageStatus.syncLogPending ?? 0);
  const databaseWaitingRows =
    input.databaseStatus.pending +
    input.databaseStatus.queued +
    (input.databaseStatus.syncLogPending ?? 0);
  const fileWaitingRows = input.fileStatus.pending;
  const syncLogPendingRows = input.syncSummary?.pending ?? 0;
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
  const totalWaitingRows =
    pageWaitingRows + databaseWaitingRows + fileWaitingRows + syncLogPendingRows;
  const cloudDomainsEnabled =
    (input.pageStatus.enabled ? 1 : 0) +
    (input.databaseStatus.enabled ? 1 : 0);
  const cloudConfirmedDomains =
    (input.pageStatus.enabled &&
    pageWaitingRows === 0 &&
    input.pageStatus.failed === 0 &&
    input.pageStatus.lastSyncAt
      ? 1
      : 0) +
    (input.databaseStatus.enabled &&
    databaseWaitingRows === 0 &&
    input.databaseStatus.failed === 0 &&
    input.databaseStatus.lastSyncAt
      ? 1
      : 0);
  const lastDrainSafeToSwitchDevice =
    input.lastDrainReceipt?.summary.safe_to_switch_device_now ?? false;
  const gates = buildGates({
    pageWaitingRows,
    databaseWaitingRows,
    fileWaitingRows,
    syncLogPendingRows,
    failedRows,
    manualReviewRows,
    totalWaitingRows,
    cloudDomainsEnabled,
    cloudConfirmedDomains,
    lastDrainSafeToSwitchDevice,
    input,
  });
  const passed = gates.filter((gate) => gate.status === "pass").length;
  const warnings = gates.filter((gate) => gate.status === "warn").length;
  const blockers = gates.filter((gate) => gate.status === "block").length;
  const canQueueBackgroundUpload =
    cloudDomainsEnabled === 2 && manualReviewRows === 0;
  const canClaimCloudConfirmedNow =
    cloudConfirmedDomains === 2 &&
    totalWaitingRows === 0 &&
    failedRows === 0 &&
    manualReviewRows === 0;

  return {
    format: "zhinote-local-first-cloud-input-plan",
    format_version: 1,
    report_status: "metadata-only-local-input-plan",
    architecture_target: "cloud-master-local-optimistic-input",
    generated_at: generatedAt,
    verdict: getVerdict({
      cloudDomainsEnabled,
      failedRows,
      manualReviewRows,
      totalWaitingRows,
    }),
    can_confirm_local_save_immediately: true,
    can_queue_background_upload: canQueueBackgroundUpload,
    can_claim_cloud_confirmed_now: canClaimCloudConfirmedNow,
    can_enable_full_realtime_cloud_now: false,
    can_write_server_data_now: false,
    can_upload_workspace_data_now: false,
    privacy_boundary:
      "This plan is generated locally from sync queue counts, timestamps, failure counts, last sync timestamps, the cloud-native fluidity report, the disabled sync push API guard, and the latest upload drain receipt. It does not read page bodies, editor state, database values, comments, files, secrets, tokens, or cookies. It does not send network requests, upload workspace data, write server data, acknowledge remote rows, mark local rows synced, clear cache, or enable sync push.",
    boundary: {
      local_planning_only: true,
      reads_queue_counts: true,
      reads_queue_timestamps: true,
      reads_failure_counts: true,
      reads_last_sync_timestamps: true,
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
      acknowledges_remote_rows: false,
      marks_local_rows_synced: false,
      clears_local_cache: false,
      enables_sync_push_api: false,
    },
    summary: {
      gates: gates.length,
      passed,
      warnings,
      blockers,
      page_waiting_rows: pageWaitingRows,
      database_waiting_rows: databaseWaitingRows,
      file_waiting_rows: fileWaitingRows,
      sync_log_pending_rows: syncLogPendingRows,
      failed_rows: failedRows,
      manual_review_rows: manualReviewRows,
      total_waiting_rows: totalWaitingRows,
      cloud_domains_enabled: cloudDomainsEnabled,
      cloud_domains_required: 2,
      cloud_confirmed_domains: cloudConfirmedDomains,
      last_drain_safe_to_switch_device: lastDrainSafeToSwitchDevice,
      fluidity_gate_status:
        input.cloudNativeFluidityReport.summary.web_beta_sync_gate_status,
    },
    gates,
    ui_states: buildUiStates(),
    recommended_write_flow: [
      "Accept the edit into local state immediately and show 本地已保存.",
      "Append or update the explicit pending queue entry without blocking typing or navigation.",
      "Run background upload when account cloud sync is enabled and auth is healthy.",
      "Keep the row in pending state until a durable cloud acknowledgement is recorded.",
      "Show 云端已确认 only after page, database, file, sync_log waiting rows, failed rows, and manual review rows are all zero.",
      "Block cache rebuild and device handoff when failed/manual-review rows exist.",
    ],
    next_action: getNextAction({
      cloudDomainsEnabled,
      failedRows,
      manualReviewRows,
      totalWaitingRows,
      canClaimCloudConfirmedNow,
    }),
  };
}

function buildGates(input: {
  pageWaitingRows: number;
  databaseWaitingRows: number;
  fileWaitingRows: number;
  syncLogPendingRows: number;
  failedRows: number;
  manualReviewRows: number;
  totalWaitingRows: number;
  cloudDomainsEnabled: number;
  cloudConfirmedDomains: number;
  lastDrainSafeToSwitchDevice: boolean;
  input: LocalFirstCloudInputPlanInput;
}): LocalFirstCloudInputGate[] {
  return [
    gate(
      "local-ack-first",
      "输入先本地确认",
      "pass",
      "本计划要求编辑动作先进入本地 state/local queue，再异步排队上传。",
      "立即显示“本地已保存”，避免打字和点击被云端请求阻塞。",
      "所有编辑入口都要把 local ack 和 cloud ack 分成两个状态。"
    ),
    gate(
      "page-cloud-queue-enabled",
      "页面上传队列开启",
      input.input.pageStatus.enabled ? "pass" : "block",
      input.input.pageStatus.enabled
        ? `页面队列开启，等待 ${input.pageWaitingRows} 条，lastSyncAt ${input.input.pageStatus.lastSyncAt ?? "暂无"}。`
        : "页面同步关闭；笔记、每日纪要、会议和公司页无法稳定进入云端主库。",
      input.input.pageStatus.enabled
        ? "页面编辑可以进入后台上传队列。"
        : "只能显示“本地已保存，云同步关闭”。",
      "账号页必须保持页面同步开启，且关闭时不能提示云端已确认。"
    ),
    gate(
      "database-cloud-queue-enabled",
      "数据库上传队列开启",
      input.input.databaseStatus.enabled ? "pass" : "block",
      input.input.databaseStatus.enabled
        ? `数据库队列开启，等待 ${input.databaseWaitingRows} 条，lastSyncAt ${input.input.databaseStatus.lastSyncAt ?? "暂无"}。`
        : "数据库同步关闭；投研表、tracker、视图和字段无法稳定进入云端主库。",
      input.input.databaseStatus.enabled
        ? "数据库变更可以进入后台上传队列。"
        : "只能显示“本地已保存，数据库云同步关闭”。",
      "账号页必须保持数据库同步开启，且关闭时不能提示云端已确认。"
    ),
    gate(
      "file-embed-queue-visible",
      "文件嵌入队列可见",
      input.input.fileStatus.enabled ? "pass" : "block",
      input.input.fileStatus.enabled
        ? `文件队列可见，等待 ${input.fileWaitingRows} 条，最近失败 ${input.input.fileStatus.lastFailureAt ?? "暂无"}。`
        : "文件嵌入队列不可用；HTML、PDF、Word、Excel 等附件不会可靠进入云端确认口径。",
      input.input.fileStatus.enabled
        ? "文件和报告可以进入后台上传队列观察。"
        : "只能显示“本地已保存，文件队列不可确认”。",
      "文件队列必须保持可见，且 pending/failed/manual review 未清零时不能提示云端已确认。"
    ),
    gate(
      "pending-queue-preserved",
      "等待上传队列受保护",
      input.totalWaitingRows === 0 ? "pass" : "warn",
      input.totalWaitingRows === 0
        ? "当前没有等待上传的本地记录。"
        : `当前仍有 ${input.totalWaitingRows} 条等待上传/确认记录。`,
      input.totalWaitingRows === 0
        ? "可以显示“云端已确认”。"
        : "显示“本地已保存，等待云端同步”，并禁止清缓存。",
      "等待上传队列未清零前不能重建本地缓存、切设备或删除本地缓存。"
    ),
    gate(
      "failed-rows-empty",
      "失败记录清零",
      input.failedRows === 0 ? "pass" : "block",
      input.failedRows === 0
        ? "页面、数据库和文件没有失败记录。"
        : `当前有 ${input.failedRows} 条失败记录。`,
      input.failedRows === 0
        ? "无需展示错误状态。"
        : "展示“需要处理”，保留本地记录并允许导出处理包。",
      "失败记录必须先补传、重试或人工处理。"
    ),
    gate(
      "manual-review-empty",
      "人工处理队列清零",
      input.manualReviewRows === 0 ? "pass" : "block",
      input.manualReviewRows === 0
        ? "没有超过重试阈值的记录。"
        : `当前有 ${input.manualReviewRows} 条记录需要人工处理。`,
      input.manualReviewRows === 0
        ? "不用打断正常输入。"
        : "在侧栏或同步页显示人工处理入口，不要静默丢弃。",
      "人工处理队列必须清零后才能宣称全域上云稳定。"
    ),
    gate(
      "generic-push-api-disabled",
      "通用 push API 仍关闭",
      input.input.syncPushApiGuard.can_push_now ? "block" : "warn",
      `/api/sync/push can_push_now=${input.input.syncPushApiGuard.can_push_now}；当前仍是 disabled local stub。`,
      "页面/数据库现有账号同步可继续用，但统一模块化 push API 还不能宣称上线。",
      "全模块云同步需要启用受权限、审计、幂等和回滚保护的统一 push API。"
    ),
    gate(
      "fluidity-gate-visible",
      "流畅度门禁可见",
      mapFluidityStatus(
        input.input.cloudNativeFluidityReport.summary
          .web_beta_sync_gate_status
      ),
      `Cloud Native Fluidity gate = ${input.input.cloudNativeFluidityReport.summary.web_beta_sync_gate_status}.`,
      "输入体验由本地 ack 和热缓存兜底，云端补齐在后台发生。",
      "首屏、页面打开和正文补齐指标需要持续采样。"
    ),
    gate(
      "latest-drain-receipt",
      "最近补传回执可用",
      input.lastDrainSafeToSwitchDevice ? "pass" : "warn",
      input.input.lastDrainReceipt
        ? `最近补传回执 safe_to_switch_device_now=${input.lastDrainSafeToSwitchDevice}.`
        : "当前还没有最近补传回执。",
      input.lastDrainSafeToSwitchDevice
        ? "可以提示当前设备切换风险较低。"
        : "仍应提示“本地已保存，云端确认待观察”。",
      "切换设备前需要最近一次补传回执证明队列已清空。"
    ),
  ];
}

function buildUiStates(): LocalFirstCloudInputUiState[] {
  return [
    {
      id: "local-saved",
      label: "本地已保存",
      when_to_show: "编辑已经进入本地状态或本地 pending queue，但还没有云端确认。",
      copy: "本地已保存，正在后台同步。",
      blocks_navigation: false,
      blocks_cache_rebuild: true,
    },
    {
      id: "waiting-cloud",
      label: "等待云端同步",
      when_to_show: "存在 pending、queued 或 sync_log pending 记录。",
      copy: "本地已保存，等待云端确认。",
      blocks_navigation: false,
      blocks_cache_rebuild: true,
    },
    {
      id: "cloud-confirmed",
      label: "云端已确认",
      when_to_show:
        "页面和数据库同步都开启，页面/数据库/文件/sync_log 等待、失败、人工处理记录均为 0，且有 lastSyncAt。",
      copy: "云端已确认。",
      blocks_navigation: false,
      blocks_cache_rebuild: false,
    },
    {
      id: "needs-review",
      label: "需要处理",
      when_to_show: "存在 failed 或 manual review 记录。",
      copy: "本地已保存，但云端同步需要处理。",
      blocks_navigation: false,
      blocks_cache_rebuild: true,
    },
    {
      id: "offline-buffer",
      label: "本地缓冲",
      when_to_show: "未登录、未配置、认证重试、云端暂不可确认或同步关闭。",
      copy: "本地已保存，云端确认恢复后自动重试。",
      blocks_navigation: false,
      blocks_cache_rebuild: true,
    },
  ];
}

function getVerdict(input: {
  cloudDomainsEnabled: number;
  failedRows: number;
  manualReviewRows: number;
  totalWaitingRows: number;
}): LocalFirstCloudInputVerdict {
  if (input.failedRows > 0 || input.manualReviewRows > 0) return "blocked";
  if (input.cloudDomainsEnabled < 2) return "needs-account-cloud";
  if (input.totalWaitingRows > 0) return "needs-drain";
  return "ready-to-buffer";
}

function getNextAction(input: {
  cloudDomainsEnabled: number;
  failedRows: number;
  manualReviewRows: number;
  totalWaitingRows: number;
  canClaimCloudConfirmedNow: boolean;
}) {
  if (input.failedRows > 0 || input.manualReviewRows > 0) {
    return "先处理失败/人工处理记录；这些记录没有解决前，不能清缓存、切设备或宣称云端已确认。";
  }
  if (input.cloudDomainsEnabled < 2) {
    return "先在账号页开启页面和数据库同步；本地输入仍可继续，但状态只能显示本地已保存。";
  }
  if (input.totalWaitingRows > 0) {
    return "继续让后台补传队列；UI 应显示本地已保存，等待云端同步。";
  }
  if (input.canClaimCloudConfirmedNow) {
    return "队列已清空，可以显示云端已确认；下一步推进统一模块化 push API 的真实启用门禁。";
  }
  return "继续收集 lastSyncAt 和补传回执，避免把本地保存误标成云端确认。";
}

function mapFluidityStatus(
  status: CloudNativeFluidityGateStatus
): LocalFirstCloudInputGateStatus {
  if (status === "pass") return "pass";
  if (status === "warn") return "warn";
  return "block";
}

function gate(
  id: string,
  title: string,
  status: LocalFirstCloudInputGateStatus,
  evidence: string,
  userVisibleState: string,
  requiredBeforeFullCloud: string
): LocalFirstCloudInputGate {
  return {
    id,
    title,
    status,
    evidence,
    user_visible_state: userVisibleState,
    required_before_full_cloud: requiredBeforeFullCloud,
  };
}
