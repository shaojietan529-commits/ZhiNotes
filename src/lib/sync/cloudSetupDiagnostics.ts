import type { ZhiNotesCloudSession } from "@/lib/cloud/clientSession";
import type { SyncLogSummary } from "@/lib/db/local/queries";
import type { PendingCloudDatabaseSyncStatus } from "@/lib/database/accountDatabaseSync";
import type { PendingFileEmbedSyncStatus } from "@/lib/files/fileEmbedSyncQueue";
import type { PendingCloudPageSyncStatus } from "@/lib/pages/accountPageSync";
import type { WebBetaEnvironmentPreflight } from "@/lib/sync/webBetaEnvironmentPreflight";
import type {
  CloudWorkspaceBootstrapProof,
  LocalWorkspaceIdentity,
} from "@/lib/sync/workspaceIdentity";

export type CloudSetupDiagnosticStatus =
  | "ready-for-owner-smoke"
  | "blocked-environment"
  | "blocked-writes-disabled"
  | "blocked-session"
  | "blocked-workspace"
  | "blocked-bootstrap"
  | "blocked-sync-disabled"
  | "blocked-local-queues"
  | "watch";

export type CloudSetupDiagnosticGateStatus = "pass" | "warn" | "block";

export interface CloudSetupDiagnosticGate {
  id:
    | "environment"
    | "write-gate"
    | "session"
    | "workspace-link"
    | "bootstrap-proof"
    | "sync-domain-toggles"
    | "local-queues";
  title: string;
  status: CloudSetupDiagnosticGateStatus;
  evidence: string;
  next_action: string;
}

export interface CloudSetupDiagnostics {
  format: "zhinote-cloud-setup-diagnostics";
  format_version: 1;
  generated_at: string;
  status: CloudSetupDiagnosticStatus;
  first_blocker: CloudSetupDiagnosticGate | null;
  can_keep_typing_now: true;
  cloud_data_can_sync_now: boolean;
  ready_for_owner_smoke: boolean;
  summary: {
    environment_required_active: number;
    environment_required_total: number;
    environment_missing_or_inactive_required: number;
    cloud_writes_enabled: boolean;
    session_present: boolean;
    workspace_linked: boolean;
    bootstrap_recorded: boolean;
    page_sync_enabled: boolean;
    database_sync_enabled: boolean;
    file_sync_queue_visible: boolean;
    total_pending_rows: number;
    total_failed_rows: number;
    total_manual_review_rows: number;
  };
  gates: CloudSetupDiagnosticGate[];
  next_actions: string[];
  privacy_note: string;
  boundary: {
    local_diagnostic_only: true;
    checks_env_presence_only: true;
    reads_session_metadata: true;
    reads_workspace_link_metadata: true;
    reads_queue_counts: true;
    reads_page_body_text: false;
    reads_database_values: false;
    reads_file_names: false;
    reads_file_bytes: false;
    reads_secret_values: false;
    reads_tokens_or_cookies: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    enables_cloud_sync: false;
    enables_ai: false;
  };
}

export interface BuildCloudSetupDiagnosticsInput {
  environmentPreflight: WebBetaEnvironmentPreflight | null;
  environmentPreflightError?: string | null;
  cloudSession: ZhiNotesCloudSession | null;
  workspaceIdentity: LocalWorkspaceIdentity | null;
  bootstrapProof: CloudWorkspaceBootstrapProof | null;
  pageStatus: PendingCloudPageSyncStatus;
  databaseStatus: PendingCloudDatabaseSyncStatus;
  fileStatus: PendingFileEmbedSyncStatus;
  syncSummary: SyncLogSummary | null;
  generatedAt?: string;
}

export function buildCloudSetupDiagnostics(
  input: BuildCloudSetupDiagnosticsInput
): CloudSetupDiagnostics {
  const environment = summarizeEnvironment(input.environmentPreflight);
  const cloudWritesEnabled = isEnvironmentCheckActive(
    input.environmentPreflight,
    "ZHINOTES_ALLOW_CLOUD_WRITES"
  );
  const sessionPresent = Boolean(input.cloudSession?.accessToken);
  const workspaceLinked = Boolean(
    input.workspaceIdentity?.cloud_status === "linked-alpha" &&
      input.workspaceIdentity.cloud_workspace_id
  );
  const bootstrapRecorded = Boolean(
    input.workspaceIdentity?.cloud_bootstrap_checked_at ||
      input.bootstrapProof?.checked_at
  );
  const pageQueuePending =
    input.pageStatus.pending +
    input.pageStatus.queued +
    input.pageStatus.syncLogPending;
  const databaseQueuePending =
    input.databaseStatus.pending +
    input.databaseStatus.queued +
    input.databaseStatus.syncLogPending;
  const fileQueuePending = input.fileStatus.pending;
  const classifiedPending =
    pageQueuePending + databaseQueuePending + fileQueuePending;
  const unclassifiedPending = Math.max(
    (input.syncSummary?.pending ?? 0) - classifiedPending,
    0
  );
  const totalPendingRows = classifiedPending + unclassifiedPending;
  const totalFailedRows = Math.max(
    input.pageStatus.failed +
      input.databaseStatus.failed +
      input.fileStatus.failed,
    input.syncSummary?.failed ?? 0
  );
  const totalManualReviewRows = Math.max(
    input.pageStatus.manualReviewCount +
      input.databaseStatus.manualReviewCount +
      input.fileStatus.manualReviewCount,
    input.syncSummary?.manualReview ?? 0
  );
  const syncDomainsEnabled =
    input.pageStatus.enabled &&
    input.databaseStatus.enabled &&
    input.fileStatus.enabled;

  const gates: CloudSetupDiagnosticGate[] = [
    {
      id: "environment",
      title: "云端基础配置",
      status:
        environment.missingOrInactiveRequired > 0 ||
        input.environmentPreflightError
          ? "block"
          : "pass",
      evidence: input.environmentPreflightError
        ? `环境预检失败：${input.environmentPreflightError}`
        : `${environment.activeRequired}/${environment.requiredTotal} 个必需配置已启用`,
      next_action:
        environment.missingOrInactiveRequired > 0 ||
        input.environmentPreflightError
          ? "先补齐云端环境变量；本地写作和 pending 队列不受影响。"
          : "云端基础配置已通过，可以继续检查登录和工作区。",
    },
    {
      id: "write-gate",
      title: "云端写入开关",
      status: cloudWritesEnabled ? "pass" : "block",
      evidence: cloudWritesEnabled
        ? "ZHINOTES_ALLOW_CLOUD_WRITES=true"
        : "云端写入开关未启用或未配置",
      next_action: cloudWritesEnabled
        ? "可继续做账号、工作区和同步元数据动作。"
        : "需要启用写入开关后才能创建工作区或上传同步队列；当前仍可本地写作。",
    },
    {
      id: "session",
      title: "云端登录会话",
      status: sessionPresent ? "pass" : "block",
      evidence: sessionPresent
        ? "当前浏览器保存了云端 session 元数据"
        : "当前浏览器没有可用云端 session",
      next_action: sessionPresent
        ? "会话存在，下一步检查 workspace 绑定。"
        : "重新登录账号；临时会话失败不能清空本地数据或 pending 队列。",
    },
    {
      id: "workspace-link",
      title: "本地 workspace 绑定",
      status: workspaceLinked ? "pass" : "block",
      evidence: workspaceLinked
        ? `已绑定 ${input.workspaceIdentity?.cloud_workspace_id}`
        : "本地 workspace 仍是 local-only",
      next_action: workspaceLinked
        ? "workspace 已绑定，继续确认启动检查证明。"
        : "在同步中心选择云端 workspace，完成启动检查后再连接本地 workspace。",
    },
    {
      id: "bootstrap-proof",
      title: "启动检查证明",
      status: bootstrapRecorded ? "pass" : "block",
      evidence: bootstrapRecorded
        ? input.workspaceIdentity?.cloud_bootstrap_checked_at ||
          input.bootstrapProof?.checked_at ||
          "已记录"
        : "没有 workspace membership/bootstrap 证明",
      next_action: bootstrapRecorded
        ? "启动检查已记录，继续确认同步域开关。"
        : "先运行启动检查，确认当前账号能访问该云端 workspace。",
    },
    {
      id: "sync-domain-toggles",
      title: "核心同步域",
      status: syncDomainsEnabled ? "pass" : "block",
      evidence: `页面 ${input.pageStatus.enabled ? "开" : "关"} / 数据库 ${
        input.databaseStatus.enabled ? "开" : "关"
      } / 文件队列 ${input.fileStatus.enabled ? "可见" : "不可见"}`,
      next_action: syncDomainsEnabled
        ? "核心域同步开关可见，继续检查队列。"
        : "先保持本地可写；需要显式启用核心域后才允许跨设备同步确认。",
    },
    {
      id: "local-queues",
      title: "待上传队列",
      status:
        totalFailedRows > 0 || totalManualReviewRows > 0
          ? "block"
          : totalPendingRows > 0
            ? "warn"
            : "pass",
      evidence: `待上传 ${totalPendingRows} 条 / 失败 ${totalFailedRows} 条 / 人工处理 ${totalManualReviewRows} 条`,
      next_action:
        totalFailedRows > 0 || totalManualReviewRows > 0
          ? "先处理失败或人工复核队列；不要重建本地缓存或切换设备接力。"
          : totalPendingRows > 0
            ? "可以继续写作，但换设备前先等待上传 ACK 或手动重试。"
            : "本地队列已清零，可以进入两设备 smoke test。",
    },
  ];

  const firstBlocker =
    gates.find((gate) => gate.status === "block") ??
    gates.find((gate) => gate.status === "warn") ??
    null;
  const readyForOwnerSmoke =
    environment.missingOrInactiveRequired === 0 &&
    cloudWritesEnabled &&
    sessionPresent &&
    workspaceLinked &&
    bootstrapRecorded &&
    syncDomainsEnabled &&
    totalPendingRows === 0 &&
    totalFailedRows === 0 &&
    totalManualReviewRows === 0;
  const status = getDiagnosticStatus({
    firstBlocker,
    readyForOwnerSmoke,
  });

  return {
    format: "zhinote-cloud-setup-diagnostics",
    format_version: 1,
    generated_at: input.generatedAt ?? new Date().toISOString(),
    status,
    first_blocker: firstBlocker,
    can_keep_typing_now: true,
    cloud_data_can_sync_now:
      environment.missingOrInactiveRequired === 0 &&
      cloudWritesEnabled &&
      sessionPresent &&
      workspaceLinked &&
      bootstrapRecorded &&
      syncDomainsEnabled &&
      totalFailedRows === 0 &&
      totalManualReviewRows === 0,
    ready_for_owner_smoke: readyForOwnerSmoke,
    summary: {
      environment_required_active: environment.activeRequired,
      environment_required_total: environment.requiredTotal,
      environment_missing_or_inactive_required:
        environment.missingOrInactiveRequired,
      cloud_writes_enabled: cloudWritesEnabled,
      session_present: sessionPresent,
      workspace_linked: workspaceLinked,
      bootstrap_recorded: bootstrapRecorded,
      page_sync_enabled: input.pageStatus.enabled,
      database_sync_enabled: input.databaseStatus.enabled,
      file_sync_queue_visible: input.fileStatus.enabled,
      total_pending_rows: totalPendingRows,
      total_failed_rows: totalFailedRows,
      total_manual_review_rows: totalManualReviewRows,
    },
    gates,
    next_actions: buildNextActions(gates),
    privacy_note:
      "Generated in the browser from metadata only. It explains why cloud sync cannot yet be trusted without reading note body text, database values, file names, file bytes, secret values, tokens, or cookies. It does not write server data, upload workspace data, enable sync, or enable AI.",
    boundary: {
      local_diagnostic_only: true,
      checks_env_presence_only: true,
      reads_session_metadata: true,
      reads_workspace_link_metadata: true,
      reads_queue_counts: true,
      reads_page_body_text: false,
      reads_database_values: false,
      reads_file_names: false,
      reads_file_bytes: false,
      reads_secret_values: false,
      reads_tokens_or_cookies: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      enables_cloud_sync: false,
      enables_ai: false,
    },
  };
}

function summarizeEnvironment(preflight: WebBetaEnvironmentPreflight | null) {
  return {
    activeRequired: preflight?.summary.active_required ?? 0,
    requiredTotal: preflight?.summary.required ?? 0,
    missingOrInactiveRequired: preflight
      ? preflight.summary.inactive_required
      : 1,
  };
}

function isEnvironmentCheckActive(
  preflight: WebBetaEnvironmentPreflight | null,
  key: string
) {
  return Boolean(preflight?.checks.some((check) => check.key === key && check.active));
}

function getDiagnosticStatus(input: {
  firstBlocker: CloudSetupDiagnosticGate | null;
  readyForOwnerSmoke: boolean;
}): CloudSetupDiagnosticStatus {
  if (input.readyForOwnerSmoke) return "ready-for-owner-smoke";
  if (!input.firstBlocker) return "watch";

  const statusByGate: Record<
    CloudSetupDiagnosticGate["id"],
    CloudSetupDiagnosticStatus
  > = {
    environment: "blocked-environment",
    "write-gate": "blocked-writes-disabled",
    session: "blocked-session",
    "workspace-link": "blocked-workspace",
    "bootstrap-proof": "blocked-bootstrap",
    "sync-domain-toggles": "blocked-sync-disabled",
    "local-queues": "blocked-local-queues",
  };
  return statusByGate[input.firstBlocker.id];
}

function buildNextActions(gates: CloudSetupDiagnosticGate[]) {
  const actionable = gates.filter((gate) => gate.status !== "pass");
  return (actionable.length > 0 ? actionable : gates.slice(-1)).map(
    (gate) => gate.next_action
  );
}
