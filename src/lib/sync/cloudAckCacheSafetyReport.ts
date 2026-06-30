import type { CacheRebuildPreflightReceipt } from "@/lib/sync/cacheRebuildPreflightReceipt";
import type { CloudSourceOfTruthPlan } from "@/lib/sync/cloudSourceOfTruthPlan";
import type { LocalFirstCloudInputPlan } from "@/lib/sync/localFirstCloudInputPlan";
import type { SyncAckLedgerReplayEnablement } from "@/lib/sync/syncAckLedgerReplayEnablement";
import type { SyncAckRetryLedgerContract } from "@/lib/sync/syncAckRetryLedgerContract";
import type { SyncUploadDrainReceipt } from "@/lib/sync/syncUploadDrainReceipt";

export type CloudAckCacheSafetyVerdict =
  | "local-saved-only"
  | "waiting-cloud-ack"
  | "needs-manual-review"
  | "durable-ack-required"
  | "cache-preflight-ready"
  | "blocked";

export type CloudAckCacheSafetyGateStatus = "pass" | "warn" | "block";

export interface CloudAckCacheSafetyReportInput {
  localFirstCloudInputPlan: LocalFirstCloudInputPlan;
  cloudSourceOfTruthPlan: CloudSourceOfTruthPlan;
  lastDrainReceipt: SyncUploadDrainReceipt | null;
  cacheRebuildPreflightReceipt: CacheRebuildPreflightReceipt;
  syncAckRetryLedgerContract: SyncAckRetryLedgerContract;
  syncAckLedgerReplayEnablement: SyncAckLedgerReplayEnablement;
  generatedAt?: string;
}

export interface CloudAckCacheSafetyGate {
  id: string;
  title: string;
  status: CloudAckCacheSafetyGateStatus;
  evidence: string;
  required_before_cloud_confirmed: string;
  required_before_cache_clear: string;
}

export interface CloudAckCacheDisplayState {
  id:
    | "local-saved"
    | "waiting-cloud-ack"
    | "cloud-confirmed"
    | "device-handoff"
    | "cache-clear";
  label: string;
  can_show_now: boolean;
  reason: string;
}

export interface CloudAckCacheSafetyReport {
  format: "zhinote-cloud-ack-cache-safety-report";
  format_version: 1;
  report_status: "metadata-only-ack-cache-gate";
  architecture_target: "cloud-master-user-selected-local-copy";
  generated_at: string;
  verdict: CloudAckCacheSafetyVerdict;
  can_show_local_saved_now: true;
  can_show_waiting_cloud_now: boolean;
  can_show_cloud_confirmed_now: boolean;
  can_switch_device_now: boolean;
  can_queue_cache_rebuild_confirmation_now: boolean;
  can_clear_local_cache_now: false;
  can_write_server_data_now: false;
  can_upload_workspace_data_now: false;
  can_mark_local_rows_synced_now: false;
  privacy_boundary: string;
  boundary: {
    local_report_only: true;
    reads_queue_counts: true;
    reads_failure_counts: true;
    reads_last_drain_receipt_status: true;
    reads_ack_gate_status: true;
    reads_cache_preflight_status: true;
    reads_source_of_truth_domain_counts: true;
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
    mutates_local_cache: false;
    clears_local_cache: false;
    mutates_local_sync_log: false;
    marks_local_rows_synced: false;
    enables_sync_push: false;
    enables_ai: false;
  };
  summary: {
    gates: number;
    passed: number;
    warnings: number;
    blockers: number;
    total_waiting_rows: number;
    failed_rows: number;
    manual_review_rows: number;
    last_drain_safe_to_switch_device: boolean;
    local_plan_cloud_confirmed: boolean;
    durable_ack_ledger_ready: boolean;
    cache_preflight_status: CacheRebuildPreflightReceipt["status"];
    cache_preflight_blockers: number;
    source_of_truth_blocked_domains: number;
    source_of_truth_needs_cloud_runtime: number;
    cloud_clear_blocked_by_design: true;
  };
  gates: CloudAckCacheSafetyGate[];
  display_states: CloudAckCacheDisplayState[];
  next_action: string;
}

export function buildCloudAckCacheSafetyReport(
  input: CloudAckCacheSafetyReportInput
): CloudAckCacheSafetyReport {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const totalWaitingRows =
    input.localFirstCloudInputPlan.summary.total_waiting_rows;
  const failedRows = input.localFirstCloudInputPlan.summary.failed_rows;
  const manualReviewRows =
    input.localFirstCloudInputPlan.summary.manual_review_rows;
  const lastDrainSafeToSwitchDevice =
    input.lastDrainReceipt?.summary.safe_to_switch_device_now ?? false;
  const localPlanCloudConfirmed =
    input.localFirstCloudInputPlan.can_claim_cloud_confirmed_now;
  const durableAckLedgerReady =
    isTrue(input.syncAckRetryLedgerContract.can_enable_sync_push_now) &&
    isTrue(input.syncAckRetryLedgerContract.can_mark_local_rows_synced_now) &&
    isTrue(input.syncAckLedgerReplayEnablement.can_enable_sync_push_now) &&
    isTrue(input.syncAckLedgerReplayEnablement.can_mark_local_rows_synced_now);
  const canShowCloudConfirmedNow =
    localPlanCloudConfirmed &&
    lastDrainSafeToSwitchDevice &&
    durableAckLedgerReady;
  const canSwitchDeviceNow =
    canShowCloudConfirmedNow &&
    input.cacheRebuildPreflightReceipt.summary.blockers === 0;
  const canQueueCacheRebuildConfirmationNow =
    canSwitchDeviceNow && input.cacheRebuildPreflightReceipt.status === "ready";
  const canShowWaitingCloudNow =
    totalWaitingRows > 0 ||
    failedRows > 0 ||
    manualReviewRows > 0 ||
    !canShowCloudConfirmedNow;
  const gates = buildGates({
    input,
    totalWaitingRows,
    failedRows,
    manualReviewRows,
    lastDrainSafeToSwitchDevice,
    localPlanCloudConfirmed,
    durableAckLedgerReady,
  });
  const passed = gates.filter((gate) => gate.status === "pass").length;
  const warnings = gates.filter((gate) => gate.status === "warn").length;
  const blockers = gates.filter((gate) => gate.status === "block").length;
  const verdict = getVerdict({
    blockers,
    totalWaitingRows,
    failedRows,
    manualReviewRows,
    durableAckLedgerReady,
    canQueueCacheRebuildConfirmationNow,
  });

  return {
    format: "zhinote-cloud-ack-cache-safety-report",
    format_version: 1,
    report_status: "metadata-only-ack-cache-gate",
    architecture_target: "cloud-master-user-selected-local-copy",
    generated_at: generatedAt,
    verdict,
    can_show_local_saved_now: true,
    can_show_waiting_cloud_now: canShowWaitingCloudNow,
    can_show_cloud_confirmed_now: canShowCloudConfirmedNow,
    can_switch_device_now: canSwitchDeviceNow,
    can_queue_cache_rebuild_confirmation_now: canQueueCacheRebuildConfirmationNow,
    can_clear_local_cache_now: false,
    can_write_server_data_now: false,
    can_upload_workspace_data_now: false,
    can_mark_local_rows_synced_now: false,
    privacy_boundary:
      "This report is generated locally from queue counts, failure counts, the latest upload drain receipt status, ack/replay gate statuses, cache rebuild preflight status, and source-of-truth domain counts. It does not read page bodies, editor state, database values, comments, files, secrets, tokens, cookies, or remote data. It does not send network requests, write server data, upload workspace data, mutate local cache, clear cache, mutate sync_log, mark local rows synced, enable sync push, or enable AI.",
    boundary: {
      local_report_only: true,
      reads_queue_counts: true,
      reads_failure_counts: true,
      reads_last_drain_receipt_status: true,
      reads_ack_gate_status: true,
      reads_cache_preflight_status: true,
      reads_source_of_truth_domain_counts: true,
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
      mutates_local_cache: false,
      clears_local_cache: false,
      mutates_local_sync_log: false,
      marks_local_rows_synced: false,
      enables_sync_push: false,
      enables_ai: false,
    },
    summary: {
      gates: gates.length,
      passed,
      warnings,
      blockers,
      total_waiting_rows: totalWaitingRows,
      failed_rows: failedRows,
      manual_review_rows: manualReviewRows,
      last_drain_safe_to_switch_device: lastDrainSafeToSwitchDevice,
      local_plan_cloud_confirmed: localPlanCloudConfirmed,
      durable_ack_ledger_ready: durableAckLedgerReady,
      cache_preflight_status: input.cacheRebuildPreflightReceipt.status,
      cache_preflight_blockers:
        input.cacheRebuildPreflightReceipt.summary.blockers,
      source_of_truth_blocked_domains:
        input.cloudSourceOfTruthPlan.summary.blocked,
      source_of_truth_needs_cloud_runtime:
        input.cloudSourceOfTruthPlan.summary.needs_cloud_runtime,
      cloud_clear_blocked_by_design: true,
    },
    gates,
    display_states: buildDisplayStates({
      canShowWaitingCloudNow,
      canShowCloudConfirmedNow,
      canSwitchDeviceNow,
      canQueueCacheRebuildConfirmationNow,
      totalWaitingRows,
      durableAckLedgerReady,
    }),
    next_action: getNextAction(verdict),
  };
}

function buildGates(input: {
  input: CloudAckCacheSafetyReportInput;
  totalWaitingRows: number;
  failedRows: number;
  manualReviewRows: number;
  lastDrainSafeToSwitchDevice: boolean;
  localPlanCloudConfirmed: boolean;
  durableAckLedgerReady: boolean;
}): CloudAckCacheSafetyGate[] {
  return [
    gate({
      id: "local-save-visible",
      title: "本地保存状态可立即显示",
      status: input.input.localFirstCloudInputPlan.can_confirm_local_save_immediately
        ? "pass"
        : "block",
      evidence: input.input.localFirstCloudInputPlan
        .can_confirm_local_save_immediately
        ? "本地写入采用 optimistic local-first，输入不等待云端 ACK。"
        : "本地保存状态缺少明确策略。",
      requiredBeforeCloudConfirmed:
        "本地保存只能说明浏览器本地已接收，不能替代云端 ACK。",
      requiredBeforeCacheClear:
        "本地保存状态不能作为清理本地缓存的依据。",
    }),
    gate({
      id: "pending-queues-drained",
      title: "待上传队列已清空",
      status:
        input.totalWaitingRows === 0 &&
        input.failedRows === 0 &&
        input.manualReviewRows === 0
          ? "pass"
          : input.manualReviewRows > 0 || input.failedRows > 0
            ? "block"
            : "warn",
      evidence: `等待 ${input.totalWaitingRows} 条；失败 ${input.failedRows} 条；人工处理 ${input.manualReviewRows} 条。`,
      requiredBeforeCloudConfirmed:
        "所有 pending、failed 和 manual-review 行必须归零。",
      requiredBeforeCacheClear:
        "任何待上传或失败记录都必须阻止清理本地缓存。",
    }),
    gate({
      id: "latest-drain-safe",
      title: "最近补传结果允许切换设备",
      status: input.lastDrainSafeToSwitchDevice ? "pass" : "warn",
      evidence: input.input.lastDrainReceipt
        ? `最近补传收据状态 ${input.input.lastDrainReceipt.status}；safe_to_switch_device_now=${input.lastDrainSafeToSwitchDevice ? "true" : "false"}。`
        : "当前还没有最近一次补传收据。",
      requiredBeforeCloudConfirmed:
        "最近一次补传收据必须证明页面和数据库队列已经安全清空。",
      requiredBeforeCacheClear:
        "没有 safe_to_switch_device_now 的补传收据时，不应进入清缓存确认。",
    }),
    gate({
      id: "durable-ack-ledger-ready",
      title: "耐久 ACK 账本已就绪",
      status: input.durableAckLedgerReady ? "pass" : "block",
      evidence: input.durableAckLedgerReady
        ? "ACK/replay enablement 已允许启用 sync push 并标记本地行已同步。"
        : "ACK/replay enablement 仍是 owner-gated disabled，不能把本地行标记为云端已确认。",
      requiredBeforeCloudConfirmed:
        "必须有 durable remote ack、ack cursor、remote commit id、count/hash match、permission decision 和 audit event。",
      requiredBeforeCacheClear:
        "本地缓存清理必须等待 ACK cursor 推进，不能只依赖本地 lastSyncAt。",
    }),
    gate({
      id: "cloud-confirmed-display",
      title: "云端已确认文案可显示",
      status:
        input.localPlanCloudConfirmed && input.durableAckLedgerReady
          ? "pass"
          : input.localPlanCloudConfirmed
            ? "warn"
            : "block",
      evidence: input.localPlanCloudConfirmed
        ? "本地计划认为等待、失败、人工处理队列已归零。"
        : "本地计划还不能声明云端已确认。",
      requiredBeforeCloudConfirmed:
        "UI 只有在本地计划和耐久 ACK 账本都通过时，才显示“云端已确认”。",
      requiredBeforeCacheClear:
        "云端确认文案本身仍不是清缓存指令，只是进入预检的前置条件。",
    }),
    gate({
      id: "cache-rebuild-preflight-ready",
      title: "本地热缓存重建预检",
      status:
        input.input.cacheRebuildPreflightReceipt.status === "ready"
          ? "pass"
          : input.input.cacheRebuildPreflightReceipt.status ===
              "needs-manifest-check"
            ? "warn"
            : "block",
      evidence: `预检状态 ${input.input.cacheRebuildPreflightReceipt.status}；blockers ${input.input.cacheRebuildPreflightReceipt.summary.blockers}。`,
      requiredBeforeCloudConfirmed:
        "云端确认不要求立即清缓存，但应暴露预检状态给用户。",
      requiredBeforeCacheClear:
        "只有 ready 预检收据加账号页二次确认，才允许进入真实缓存重建流程。",
    }),
    gate({
      id: "local-cache-clear-guard",
      title: "同步页禁止直接清本地缓存",
      status: "pass",
      evidence:
        "当前报告将 can_clear_local_cache_now 固定为 false；同步页只允许导出证明，不执行清理。",
      requiredBeforeCloudConfirmed:
        "云端确认状态和缓存清理动作保持分离。",
      requiredBeforeCacheClear:
        "真实清理必须走账号页确认、ready 预检、云端 manifest 和回滚策略。",
    }),
  ];
}

function gate(input: {
  id: string;
  title: string;
  status: CloudAckCacheSafetyGateStatus;
  evidence: string;
  requiredBeforeCloudConfirmed: string;
  requiredBeforeCacheClear: string;
}): CloudAckCacheSafetyGate {
  return {
    id: input.id,
    title: input.title,
    status: input.status,
    evidence: input.evidence,
    required_before_cloud_confirmed: input.requiredBeforeCloudConfirmed,
    required_before_cache_clear: input.requiredBeforeCacheClear,
  };
}

function buildDisplayStates(input: {
  canShowWaitingCloudNow: boolean;
  canShowCloudConfirmedNow: boolean;
  canSwitchDeviceNow: boolean;
  canQueueCacheRebuildConfirmationNow: boolean;
  totalWaitingRows: number;
  durableAckLedgerReady: boolean;
}): CloudAckCacheDisplayState[] {
  return [
    {
      id: "local-saved",
      label: "本地已保存",
      can_show_now: true,
      reason: "输入先写入本地状态，保证编辑手感接近本地软件。",
    },
    {
      id: "waiting-cloud-ack",
      label: "等待云端确认",
      can_show_now: input.canShowWaitingCloudNow,
      reason:
        input.totalWaitingRows > 0
          ? "仍有待上传队列，必须继续显示等待状态。"
          : "耐久 ACK 账本未完成前，仍不能直接显示云端已确认。",
    },
    {
      id: "cloud-confirmed",
      label: "云端已确认",
      can_show_now: input.canShowCloudConfirmedNow,
      reason: input.durableAckLedgerReady
        ? "本地队列、补传收据和耐久 ACK 全部通过。"
        : "缺少 durable ACK/replay enablement，避免误导用户。",
    },
    {
      id: "device-handoff",
      label: "可切换设备",
      can_show_now: input.canSwitchDeviceNow,
      reason:
        "只有云端确认和缓存预检都通过，才适合提示换设备继续工作。",
    },
    {
      id: "cache-clear",
      label: "可清本地缓存",
      can_show_now: false,
      reason: input.canQueueCacheRebuildConfirmationNow
        ? "同步页仍不能直接清缓存；需要跳转账号页二次确认。"
        : "预检或 ACK 仍未满足，禁止清理本地缓存。",
    },
  ];
}

function getVerdict(input: {
  blockers: number;
  totalWaitingRows: number;
  failedRows: number;
  manualReviewRows: number;
  durableAckLedgerReady: boolean;
  canQueueCacheRebuildConfirmationNow: boolean;
}): CloudAckCacheSafetyVerdict {
  if (input.failedRows > 0 || input.manualReviewRows > 0) {
    return "needs-manual-review";
  }
  if (input.totalWaitingRows > 0) return "waiting-cloud-ack";
  if (input.canQueueCacheRebuildConfirmationNow) return "cache-preflight-ready";
  if (!input.durableAckLedgerReady) return "durable-ack-required";
  if (input.blockers > 0) return "blocked";
  return "local-saved-only";
}

function getNextAction(verdict: CloudAckCacheSafetyVerdict): string {
  switch (verdict) {
    case "waiting-cloud-ack":
      return "继续后台补传 pending 队列；等待归零前只显示本地已保存或等待云端确认。";
    case "needs-manual-review":
      return "先处理失败或人工 review 记录；这些记录不能被清缓存或跨设备切换掩盖。";
    case "durable-ack-required":
      return "下一步优先完成 durable ACK 账本、ack cursor 和 replay proof；完成前不要显示云端已确认。";
    case "cache-preflight-ready":
      return "可进入账号页二次确认缓存重建，但同步页仍不直接清理本地缓存。";
    case "blocked":
      return "先处理阻塞门禁，再重新生成 ACK/缓存安全报告。";
    case "local-saved-only":
      return "当前只能保证本地已保存；继续补齐云端 ACK 和缓存预检链路。";
  }
}

function isTrue(value: boolean): boolean {
  return value === true;
}
