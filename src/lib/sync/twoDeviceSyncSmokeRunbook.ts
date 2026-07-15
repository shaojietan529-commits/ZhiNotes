import type { CloudSyncControlPlane } from "@/lib/sync/cloudSyncControlPlane";
import type { CloudUploadReliabilityReport } from "@/lib/sync/cloudUploadReliabilityReport";
import type { SyncAckLedgerServerReadiness } from "@/lib/sync/syncAckLedgerServerReadiness";
import type { SyncAckRetryLedgerContract } from "@/lib/sync/syncAckRetryLedgerContract";
import type { TwoDayUsabilityGate } from "@/lib/sync/twoDayUsabilityGate";

export type TwoDeviceSyncSmokeStepStatus = "ready" | "wait" | "blocked";

export type TwoDeviceSyncSmokeSurface =
  | "account"
  | "sync"
  | "page"
  | "daily"
  | "zhihui"
  | "database"
  | "file"
  | "handoff";

export type TwoDeviceSyncSmokeAccountBridgeProbeStatus =
  | "not-run"
  | "ready"
  | "blocked"
  | "partial";

export interface TwoDeviceSyncSmokeAccountBridgeProbe {
  status: TwoDeviceSyncSmokeAccountBridgeProbeStatus;
  readable_domains: number;
  blocked_domains: number;
  checked_at: string | null;
  expires_at: string | null;
}

export interface TwoDeviceSyncSmokeStep {
  id: string;
  surface: TwoDeviceSyncSmokeSurface;
  title: string;
  status: TwoDeviceSyncSmokeStepStatus;
  device_a_action: string;
  device_b_action: string;
  pass_criteria: string;
  evidence_needed: string;
  current_blocker: string | null;
}

export interface TwoDeviceSyncSmokeRunbook {
  format: "zhinote-two-device-sync-smoke-runbook";
  format_version: 1;
  report_status: "metadata-only-owner-runbook";
  generated_at: string;
  ready_to_run_scoped_smoke_now: boolean;
  ready_to_run_real_smoke_now: boolean;
  ready_to_claim_two_device_sync_passed: false;
  boundary: {
    owner_runbook_only: true;
    reads_queue_counts: true;
    reads_sync_flags: true;
    reads_auth_retry_state: true;
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_file_names: false;
    reads_file_bytes: false;
    sends_network_requests: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    clears_local_cache: false;
  };
  summary: {
    steps: number;
    ready: number;
    wait: number;
    blocked: number;
    pending_rows: number;
    failed_rows: number;
    manual_review_rows: number;
    auth_retry_active: boolean;
    sync_domain_coverage_complete: boolean;
    ack_ledger_ready: boolean;
    ack_ledger_blocked_gates: number;
    ack_ledger_contract_blocked_gates: number;
    ack_ledger_server_readiness_remaining_blockers: number;
    ack_ledger_server_readiness_next_action: string;
    sync_push_route_enabled: boolean;
    sync_pull_route_enabled: boolean;
    account_sync_bridge_probe_status: TwoDeviceSyncSmokeAccountBridgeProbeStatus;
    account_sync_bridge_probe_ready: boolean;
    account_sync_bridge_readable_domains: number;
    account_sync_bridge_blocked_domains: number;
    account_sync_bridge_checked_at: string | null;
    account_sync_bridge_expires_at: string | null;
    scoped_core_sync_ready: boolean;
    scoped_core_sync_claim_blocked: boolean;
    full_platform_sync_claim_blocked: boolean;
    can_keep_using_now: boolean;
    can_switch_devices_now: boolean;
  };
  next_action: string;
  steps: TwoDeviceSyncSmokeStep[];
  final_owner_receipt_template: string[];
}

export interface TwoDeviceSyncSmokeOwnerReceipt {
  format: "zhinote-two-device-sync-smoke-owner-receipt";
  format_version: 1;
  receipt_status: "owner-evidence-required";
  generated_at: string;
  source_runbook_generated_at: string;
  ready_to_collect_scoped_owner_evidence: boolean;
  ready_to_collect_owner_evidence: boolean;
  can_claim_two_device_sync_passed_now: false;
  boundary: {
    owner_fills_results: true;
    reads_queue_counts: true;
    reads_sync_flags: true;
    reads_auth_retry_state: true;
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_file_names: false;
    reads_file_bytes: false;
    sends_network_requests: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    clears_local_cache: false;
    stores_private_content: false;
  };
  summary: TwoDeviceSyncSmokeRunbook["summary"] & {
    runbook_ready_to_run: boolean;
    scoped_runbook_ready_to_run: boolean;
    runbook_ready_to_claim_passed: false;
  };
  owner_evidence_fields: Array<{
    id: string;
    label: string;
    placeholder: string;
    required: boolean;
    privacy_note: string;
  }>;
  checklist: Array<{
    id: string;
    surface: TwoDeviceSyncSmokeSurface;
    title: string;
    runbook_status: TwoDeviceSyncSmokeStepStatus;
    owner_result: "not-recorded";
    pass_criteria: string;
    evidence_needed: string;
    current_blocker: string | null;
  }>;
  final_pass_claim_requirements: string[];
  next_action: string;
}

export function buildTwoDeviceSyncSmokeRunbook(input: {
  gate: TwoDayUsabilityGate;
  controlPlane: CloudSyncControlPlane;
  reliability: CloudUploadReliabilityReport;
  ackRetryLedger: SyncAckRetryLedgerContract;
  ackLedgerServerReadiness: SyncAckLedgerServerReadiness;
  accountSyncBridgeProbe?: TwoDeviceSyncSmokeAccountBridgeProbe | null;
  generatedAt?: string;
}): TwoDeviceSyncSmokeRunbook {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const reliability = input.reliability.summary;
  const failedOrManual =
    reliability.failed_rows > 0 || reliability.manual_review_rows > 0;
  const waitingForDrain = reliability.total_waiting_rows > 0;
  const authRetryActive = reliability.auth_retry_active;
  const canKeepUsing = input.gate.can_keep_using_now;
  const canSwitchDevices = input.gate.can_switch_devices_now;
  const syncDomainCoverageGate = input.gate.gates.find(
    (gate) => gate.id === "sync-domain-coverage"
  );
  const syncDomainCoverageComplete =
    input.gate.summary.sync_domain_coverage_complete;
  const ackLedgerReady = isAckLedgerReady({
    contract: input.ackRetryLedger,
    serverReadiness: input.ackLedgerServerReadiness,
  });
  const ackLedgerBlockedGateCount =
    input.ackRetryLedger.summary.blocked_gates +
    input.ackLedgerServerReadiness.summary.remaining_blockers;
  const accountBridgeProbe = input.accountSyncBridgeProbe ?? null;
  const accountBridgeProbeStatus = accountBridgeProbe?.status ?? "not-run";
  const accountBridgeProbeReady =
    Boolean(accountBridgeProbe) &&
    accountBridgeProbeStatus === "ready" &&
    accountBridgeProbe?.readable_domains === 4 &&
    isFreshAccountBridgeProbe(accountBridgeProbe, generatedAt);
  const crossDeviceReady =
    canSwitchDevices &&
    accountBridgeProbeReady &&
    syncDomainCoverageComplete &&
    ackLedgerReady &&
    !waitingForDrain &&
    !failedOrManual &&
    !authRetryActive;

  const steps: TwoDeviceSyncSmokeStep[] = [
    step({
      id: "same-account-session",
      surface: "account",
      title: "同一账号两端登录",
      status: canKeepUsing && !authRetryActive ? "ready" : "wait",
      deviceA:
        "设备 A 打开 /account 和 /modules/sync，确认用户名、workspace、同步状态可见。",
      deviceB:
        "设备 B 用同一账号打开 /account，确认不会因为临时接口失败被自动登出。",
      pass:
        "两端都显示同一账号和 workspace；临时失败只显示账号暂不可确认，不清 session。",
      evidence:
        "账号页截图或同步中心状态：账号正常 / 无 auth retry / 本地可写。",
      blocker: authRetryActive
        ? input.reliability.summary.auth_retry_state_label
        : null,
    }),
    step({
      id: "account-sync-bridge-probe",
      surface: "sync",
      title: "账号同步桥 metadata 可读",
      status: accountBridgeProbeReady ? "ready" : "blocked",
      deviceA:
        "设备 A 在 /modules/sync 运行“只读检查账号同步桥”，确认页面、每日纪要、会议、数据库四个 metadata 域均可读。",
      deviceB:
        "设备 B 用同一账号打开 /modules/sync，也能复核同一组核心 metadata 域；检查回执必须未过期。",
      pass:
        "账号同步桥显示 4/4 域可读，检查时间和过期时间可见，且过期回执不能作为同步可用证据。",
      evidence:
        "同步桥回执：status=ready、readable_domains=4、checked_at/expires_at 未过期。",
      blocker: accountBridgeProbeReady
        ? null
        : accountBridgeProbeBlocker(accountBridgeProbe, generatedAt),
    }),
    step({
      id: "sync-domain-coverage-check",
      surface: "sync",
      title: "同步域覆盖检查",
      status: syncDomainCoverageComplete ? "ready" : "blocked",
      deviceA:
        "设备 A 打开 /modules/sync，确认同步中心能看到页面、数据库、文件、设置、知识库附属和其他 sync_log 队列。",
      deviceB:
        "设备 B 打开 /modules/sync，确认同一账号下同步域覆盖状态一致，不只看页面/数据库两个队列。",
      pass:
        "同步域覆盖为 complete；没有被隐藏的 pending / failed / manual review 域。",
      evidence:
        "同步中心 coverage 截图或导出的 handoff receipt：coverageComplete=true。",
      blocker:
        syncDomainCoverageComplete
          ? null
          : syncDomainCoverageGate?.next_action ??
            "同步域覆盖未完整；先补齐可见队列后再做真实两端 smoke。",
    }),
    step({
      id: "ack-ledger-readiness",
      surface: "sync",
      title: "统一 ACK / retry 账本门禁",
      status: ackLedgerReady ? "ready" : "blocked",
      deviceA:
        "设备 A 打开同步中心，确认 /api/sync/push 和 /api/sync/pull 只有在服务端 ACK/retry ledger 通过后才启用。",
      deviceB:
        "设备 B 确认同一 workspace 下不会因为本地队列清零就提前把远端未确认的数据当成已同步。",
      pass:
        "服务端存在 durable ACK ledger；sync_log 只在 remote ACK cursor 前进后标记 synced；push/pull route 都已通过 owner-gated 启用。",
      evidence:
        "ack/retry 账本导出：blocked_gates=0、push_route_enabled=true、pull_route_enabled=true、remote ACK cursor evidence 可复核。",
      blocker: ackLedgerReady
        ? null
        : ackLedgerBlocker({
            contract: input.ackRetryLedger,
            serverReadiness: input.ackLedgerServerReadiness,
          }),
    }),
    step({
      id: "page-note-sync",
      surface: "page",
      title: "笔记 Page 创建和编辑",
      status: syncStepStatus({
        enabled: reliability.page_sync_enabled,
        failedOrManual,
        waitingForDrain,
        canKeepUsing,
      }),
      deviceA:
        "设备 A 新建一页普通笔记，输入一行测试内容，等待同步中心 pending 清零。",
      deviceB:
        "设备 B 刷新页面列表或搜索，打开同一 Page，确认标题和内容可见。",
      pass:
        "设备 B 看到设备 A 创建/编辑的 Page；设备 A 期间输入没有卡住。",
      evidence:
        "Page id、设备 A 本地保存状态、pending 清零时间、设备 B 可见截图。",
      blocker: coreSyncBlocker("页面", reliability.page_sync_enabled, input),
    }),
    step({
      id: "daily-note-sync",
      surface: "daily",
      title: "每日纪要按日期同步",
      status: syncStepStatus({
        enabled: reliability.page_sync_enabled,
        failedOrManual,
        waitingForDrain,
        canKeepUsing,
      }),
      deviceA:
        "设备 A 在 /daily 当天格子新增或编辑一条每日纪要，等待日历 metadata 更新。",
      deviceB:
        "设备 B 打开 /daily 同一月份，确认对应日期先显示 metadata，再能打开正文。",
      pass:
        "两端同一日期都有同一条纪要；刷新后日历不长时间空白。",
      evidence:
        "日期、纪要标题、pending 清零时间、设备 B 日历可见截图。",
      blocker: coreSyncBlocker("每日纪要", reliability.page_sync_enabled, input),
    }),
    step({
      id: "zhihui-meeting-sync",
      surface: "zhihui",
      title: "ZhiHui 会议导入和日历同步",
      status: syncStepStatus({
        enabled: reliability.page_sync_enabled,
        failedOrManual,
        waitingForDrain,
        canKeepUsing,
      }),
      deviceA:
        "设备 A 在 /schedule 导入一条合成会议或新建会议，确认会议日历出现。",
      deviceB:
        "设备 B 打开 /schedule 同一月份，确认会议卡片出现在正确日期。",
      pass:
        "会议不会只留在设备 A；导入失败不会登出账号，日历能 metadata-first 显示。",
      evidence:
        "会议日期/标题、导入小票、设备 B 日历可见截图。",
      blocker: coreSyncBlocker("ZhiHui", reliability.page_sync_enabled, input),
    }),
    step({
      id: "database-row-sync",
      surface: "database",
      title: "数据库字段和行同步",
      status: syncStepStatus({
        enabled: reliability.database_sync_enabled,
        failedOrManual,
        waitingForDrain,
        canKeepUsing,
      }),
      deviceA:
        "设备 A 在数据库新增一行或修改一个非敏感测试字段，等待数据库 pending 清零。",
      deviceB:
        "设备 B 打开同一数据库，确认行、字段和视图状态一致。",
      pass:
        "数据库 row/key 不丢失；设备 B 能看到设备 A 的测试变更。",
      evidence:
        "database id、测试行标题、pending 清零时间、设备 B 可见截图。",
      blocker: coreSyncBlocker("数据库", reliability.database_sync_enabled, input),
    }),
    step({
      id: "file-report-metadata-sync",
      surface: "file",
      title: "文件 / 报告元数据同步",
      status: syncStepStatus({
        enabled: reliability.file_sync_enabled,
        failedOrManual,
        waitingForDrain,
        canKeepUsing,
      }),
      deviceA:
        "设备 A 添加一个小型测试附件或报告元数据，不用真实私密文件做 smoke。",
      deviceB:
        "设备 B 确认文件卡片或报告元数据可见；文件 bytes 未通过前不得声称原生文件同步完成。",
      pass:
        "至少文件/报告索引状态一致；失败会进入可见 pending/failed/manual review。",
      evidence:
        "测试文件元数据、队列状态、设备 B 文件卡片可见截图。",
      blocker: coreSyncBlocker("文件", reliability.file_sync_enabled, input),
    }),
    step({
      id: "final-device-handoff",
      surface: "handoff",
      title: "最终跨设备交接",
      status: crossDeviceReady ? "ready" : waitingForDrain ? "wait" : "blocked",
      deviceA:
        "设备 A 确认 pending、failed、manual review 全清零，账号退避为无。",
      deviceB:
        "设备 B 刷新 /daily、/schedule、一个 Page、一个数据库，继续编辑一条测试内容。",
      pass:
        "设备 B 能继续工作，设备 A 重新打开后也能看到设备 B 的测试变更。",
      evidence:
        "handoff receipt、pending=0、failed=0、manual=0、双向编辑截图。",
      blocker: crossDeviceReady
        ? null
        : ackLedgerReady
          ? input.controlPlane.next_action || input.gate.next_48h_action
          : ackLedgerBlocker({
              contract: input.ackRetryLedger,
              serverReadiness: input.ackLedgerServerReadiness,
            }),
    }),
  ];

  const ready = steps.filter((item) => item.status === "ready").length;
  const wait = steps.filter((item) => item.status === "wait").length;
  const blocked = steps.filter((item) => item.status === "blocked").length;
  const scopedCoreSurfacesReady =
    canKeepUsing &&
    accountBridgeProbeReady &&
    syncDomainCoverageComplete &&
    reliability.cloud_workspace_linked &&
    reliability.page_sync_enabled &&
    reliability.database_sync_enabled &&
    reliability.file_sync_enabled;
  const scopedWorkflowBlocked = steps.filter(
    (item) =>
      item.status === "blocked" &&
      item.id !== "ack-ledger-readiness" &&
      item.id !== "final-device-handoff"
  ).length;
  const readyToRunScoped =
    scopedCoreSurfacesReady &&
    scopedWorkflowBlocked === 0 &&
    !waitingForDrain &&
    !failedOrManual &&
    !authRetryActive;
  const coreSurfacesReady = scopedCoreSurfacesReady && ackLedgerReady;
  const readyToRun = coreSurfacesReady && wait === 0 && blocked === 0;

  return {
    format: "zhinote-two-device-sync-smoke-runbook",
    format_version: 1,
    report_status: "metadata-only-owner-runbook",
    generated_at: generatedAt,
    ready_to_run_scoped_smoke_now: readyToRunScoped,
    ready_to_run_real_smoke_now: readyToRun,
    ready_to_claim_two_device_sync_passed: false,
    boundary: {
      owner_runbook_only: true,
      reads_queue_counts: true,
      reads_sync_flags: true,
      reads_auth_retry_state: true,
      reads_page_body_text: false,
      reads_database_row_values: false,
      reads_file_names: false,
      reads_file_bytes: false,
      sends_network_requests: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      clears_local_cache: false,
    },
    summary: {
      steps: steps.length,
      ready,
      wait,
      blocked,
      pending_rows: reliability.total_waiting_rows,
      failed_rows: reliability.failed_rows,
      manual_review_rows: reliability.manual_review_rows,
      auth_retry_active: reliability.auth_retry_active,
      sync_domain_coverage_complete: syncDomainCoverageComplete,
      ack_ledger_ready: ackLedgerReady,
      ack_ledger_blocked_gates: ackLedgerBlockedGateCount,
      ack_ledger_contract_blocked_gates:
        input.ackRetryLedger.summary.blocked_gates,
      ack_ledger_server_readiness_remaining_blockers:
        input.ackLedgerServerReadiness.summary.remaining_blockers,
      ack_ledger_server_readiness_next_action:
        input.ackLedgerServerReadiness.summary.next_action,
      sync_push_route_enabled: input.ackRetryLedger.summary.push_route_enabled,
      sync_pull_route_enabled: input.ackRetryLedger.summary.pull_route_enabled,
      account_sync_bridge_probe_status: accountBridgeProbeStatus,
      account_sync_bridge_probe_ready: accountBridgeProbeReady,
      account_sync_bridge_readable_domains:
        accountBridgeProbe?.readable_domains ?? 0,
      account_sync_bridge_blocked_domains:
        accountBridgeProbe?.blocked_domains ?? 4,
      account_sync_bridge_checked_at: accountBridgeProbe?.checked_at ?? null,
      account_sync_bridge_expires_at: accountBridgeProbe?.expires_at ?? null,
      scoped_core_sync_ready: readyToRunScoped,
      scoped_core_sync_claim_blocked: !readyToRunScoped,
      full_platform_sync_claim_blocked: !ackLedgerReady,
      can_keep_using_now: canKeepUsing,
      can_switch_devices_now: canSwitchDevices,
    },
    next_action: getNextAction({ readyToRun, wait, blocked, input }),
    steps,
    final_owner_receipt_template: [
      "设备 A / 设备 B 使用同一账号和 workspace。",
      "账号同步桥只读检查为 ready，页面、每日纪要、会议、数据库四个 metadata 域均可读，且回执未过期。",
      "同步中心显示 sync-domain coverage complete，所有 pending / failed / manual review 域都可见。",
      "48 小时 scoped beta 可以先验收 Page、每日纪要、ZhiHui、数据库和文件元数据；这不等于完整全平台同步通过。",
      "统一 ACK / retry ledger 和服务端 readiness 已通过：/api/sync/push 和 /api/sync/pull 已 owner-gated 启用，且 remote ACK cursor 可复核。",
      "Page、每日纪要、ZhiHui、数据库、文件元数据至少各跑一条测试样本。",
      "测试结束时 pending=0、failed=0、manual review=0、auth retry=无。",
      "两端刷新后都能看到对方最后一次编辑。",
    ],
  };
}

export function buildTwoDeviceSyncSmokeOwnerReceipt(input: {
  runbook: TwoDeviceSyncSmokeRunbook;
  generatedAt?: string;
}): TwoDeviceSyncSmokeOwnerReceipt {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const runbook = input.runbook;

  return {
    format: "zhinote-two-device-sync-smoke-owner-receipt",
    format_version: 1,
    receipt_status: "owner-evidence-required",
    generated_at: generatedAt,
    source_runbook_generated_at: runbook.generated_at,
    ready_to_collect_scoped_owner_evidence:
      runbook.ready_to_run_scoped_smoke_now,
    ready_to_collect_owner_evidence: runbook.ready_to_run_real_smoke_now,
    can_claim_two_device_sync_passed_now: false,
    boundary: {
      owner_fills_results: true,
      reads_queue_counts: true,
      reads_sync_flags: true,
      reads_auth_retry_state: true,
      reads_page_body_text: false,
      reads_database_row_values: false,
      reads_file_names: false,
      reads_file_bytes: false,
      sends_network_requests: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      clears_local_cache: false,
      stores_private_content: false,
    },
    summary: {
      ...runbook.summary,
      runbook_ready_to_run: runbook.ready_to_run_real_smoke_now,
      scoped_runbook_ready_to_run: runbook.ready_to_run_scoped_smoke_now,
      runbook_ready_to_claim_passed:
        runbook.ready_to_claim_two_device_sync_passed,
    },
    owner_evidence_fields: [
      {
        id: "device-a",
        label: "设备 A",
        placeholder: "例如：MacBook / Chrome / zhi-note.com",
        required: true,
        privacy_note: "只填设备和浏览器，不填正文、文件名或账号验证码。",
      },
      {
        id: "device-b",
        label: "设备 B",
        placeholder: "例如：Windows / Edge / zhi-note.com",
        required: true,
        privacy_note: "只填设备和浏览器，不填正文、文件名或账号验证码。",
      },
      {
        id: "workspace-account",
        label: "账号和 workspace",
        placeholder: "确认两端同一账号、同一 workspace。",
        required: true,
        privacy_note: "可以写脱敏邮箱，不写登录码、cookie 或 token。",
      },
      {
        id: "account-sync-bridge-probe",
        label: "账号同步桥检查回执",
        placeholder:
          "记录 status=ready、4/4 域可读、checked_at/expires_at 未过期。",
        required: true,
        privacy_note:
          "只写 metadata 检查状态和时间，不写正文、数据库行值、文件名、cookie 或 token。",
      },
      {
        id: "test-sample-ids",
        label: "测试样本 ID",
        placeholder: "Page / Daily / ZhiHui / Database / File metadata 的非敏感 ID。",
        required: true,
        privacy_note: "只写 ID 或脱敏标题，不粘贴正文、数据库行值或文件内容。",
      },
      {
        id: "pending-drain-time",
        label: "pending 清零时间",
        placeholder: "例如：设备 A 输入后 8 秒清零，设备 B 刷新后可见。",
        required: true,
        privacy_note: "只写时间和状态，不写私密内容。",
      },
      {
        id: "ack-ledger-evidence",
        label: "ACK 账本证据",
        placeholder:
          "确认 blocked_gates=0、push/pull 已启用、remote ACK cursor 已前进。",
        required: true,
        privacy_note:
          "只写同步状态和 cursor 证据，不粘贴正文、数据库行值、文件内容或密钥。",
      },
      {
        id: "screenshots-or-notes",
        label: "截图或说明",
        placeholder: "记录截图文件名或一句话说明；截图由 owner 自己保管。",
        required: false,
        privacy_note: "导出的 JSON 不嵌入截图，也不上传截图。",
      },
    ],
    checklist: runbook.steps.map((step) => ({
      id: step.id,
      surface: step.surface,
      title: step.title,
      runbook_status: step.status,
      owner_result: "not-recorded",
      pass_criteria: step.pass_criteria,
      evidence_needed: step.evidence_needed,
      current_blocker: step.current_blocker,
    })),
    final_pass_claim_requirements: [
      "owner 手动完成 checklist 中每一项，并把 owner_result 从 not-recorded 改为 pass。",
      "同步中心显示 pending=0、failed=0、manual review=0。",
      "账号退避为无；临时接口失败没有导致任一设备被登出。",
      "账号同步桥回执未过期，且页面、每日纪要、会议、数据库四个 metadata 域均可读。",
      "sync-domain coverage complete，所有同步域都有可见队列状态。",
      "如果只验收 48 小时 scoped beta，只能声称 Page、每日纪要、ZhiHui、数据库和文件元数据的核心交接通过，不能声称完整全平台同步通过。",
      "统一 /api/sync/push 和 /api/sync/pull 已由 owner-gated 启用，并有 durable ACK ledger 与 remote ACK cursor 证据。",
      "本地 sync_log rows 只在 remote ACK cursor 前进后标记 synced，不能用本地队列清零替代云端确认。",
      "设备 A 创建/编辑后设备 B 可见；设备 B 再编辑后设备 A 可见。",
      "没有使用真实私密正文、数据库行值、文件 bytes 或验证码作为验收样本。",
    ],
    next_action: runbook.ready_to_run_real_smoke_now
      ? "用两台真实设备跑 checklist，然后由 owner 填写这张结果收据；未填前不能声称两设备同步已通过。"
      : runbook.ready_to_run_scoped_smoke_now
        ? "可以先跑 48 小时 scoped beta smoke：Page、每日纪要、ZhiHui、数据库和文件元数据；完成前仍不能声称完整全平台同步通过。"
      : runbook.next_action,
  };
}

function syncStepStatus(input: {
  enabled: boolean;
  failedOrManual: boolean;
  waitingForDrain: boolean;
  canKeepUsing: boolean;
}): TwoDeviceSyncSmokeStepStatus {
  if (!input.enabled || input.failedOrManual || !input.canKeepUsing) {
    return "blocked";
  }
  if (input.waitingForDrain) return "wait";
  return "ready";
}

function coreSyncBlocker(
  label: string,
  enabled: boolean,
  input: {
    controlPlane: CloudSyncControlPlane;
    reliability: CloudUploadReliabilityReport;
  }
) {
  const summary = input.reliability.summary;
  if (!enabled) return `${label}同步未开启。`;
  if (summary.manual_review_rows > 0) return "仍有 manual review，需要先处理。";
  if (summary.failed_rows > 0) return "仍有 failed rows，需要先重试或复核。";
  if (summary.total_waiting_rows > 0) return "仍有 pending，先等待或补传清零。";
  return input.controlPlane.next_action;
}

function isFreshAccountBridgeProbe(
  probe: TwoDeviceSyncSmokeAccountBridgeProbe,
  generatedAt: string
): boolean {
  if (!probe.expires_at || !probe.checked_at) return false;
  const expiresAt = Date.parse(probe.expires_at);
  const checkedAt = Date.parse(probe.checked_at);
  const now = Date.parse(generatedAt);
  return (
    !Number.isNaN(expiresAt) &&
    !Number.isNaN(checkedAt) &&
    !Number.isNaN(now) &&
    checkedAt <= now &&
    expiresAt > now
  );
}

function accountBridgeProbeBlocker(
  probe: TwoDeviceSyncSmokeAccountBridgeProbe | null,
  generatedAt: string
): string {
  if (!probe) {
    return "还没有有效的账号同步桥回执；先在同步中心运行“只读检查账号同步桥”。";
  }
  if (!isFreshAccountBridgeProbe(probe, generatedAt)) {
    return "账号同步桥回执已过期或时间无效；重新运行只读检查后再开始两设备 smoke。";
  }
  if (probe.status !== "ready") {
    return `账号同步桥状态为 ${probe.status}，${probe.readable_domains}/4 域可读；先处理不可读域。`;
  }
  if (probe.readable_domains !== 4) {
    return `账号同步桥只读检查只有 ${probe.readable_domains}/4 域可读，仍有 ${probe.blocked_domains} 个域不可读。`;
  }
  return "账号同步桥回执不完整；重新运行只读检查。";
}

function getNextAction(input: {
  readyToRun: boolean;
  wait: number;
  blocked: number;
  input: {
    gate: TwoDayUsabilityGate;
    controlPlane: CloudSyncControlPlane;
    reliability: CloudUploadReliabilityReport;
    ackRetryLedger: SyncAckRetryLedgerContract;
    ackLedgerServerReadiness: SyncAckLedgerServerReadiness;
  };
}) {
  if (input.readyToRun && input.wait === 0) {
    return "可以开始真实两端 smoke：先跑 Page / Daily / ZhiHui / Database，再做最终交接。";
  }
  if (input.readyToRun) {
    return "可以准备两端 smoke，但先让 pending 清零，避免把旧队列误认为新测试失败。";
  }
  if (
    input.input.gate.can_target_two_day_sync_beta &&
    input.input.reliability.summary.cloud_workspace_linked &&
    input.input.gate.summary.account_sync_bridge_probe_status === "ready" &&
    input.input.gate.summary.account_sync_bridge_readable_domains === 4 &&
    input.input.reliability.summary.page_sync_enabled &&
    input.input.reliability.summary.database_sync_enabled &&
    input.input.reliability.summary.file_sync_enabled &&
    !input.input.reliability.summary.auth_retry_active &&
    input.input.reliability.summary.total_waiting_rows === 0 &&
    input.input.reliability.summary.failed_rows === 0 &&
    input.input.reliability.summary.manual_review_rows === 0
  ) {
    return "可以先跑 48 小时 scoped beta smoke：Page、每日纪要、ZhiHui、数据库和文件元数据；完整全平台同步仍等待 ACK ledger。";
  }
  if (input.blocked > 0) {
    return isAckLedgerReady({
      contract: input.input.ackRetryLedger,
      serverReadiness: input.input.ackLedgerServerReadiness,
    })
      ? input.input.controlPlane.next_action
      : ackLedgerBlocker({
          contract: input.input.ackRetryLedger,
          serverReadiness: input.input.ackLedgerServerReadiness,
        });
  }
  return input.input.gate.next_48h_action;
}

function isAckLedgerReady(input: {
  contract: SyncAckRetryLedgerContract;
  serverReadiness: SyncAckLedgerServerReadiness;
}) {
  return (
    input.contract.can_enable_sync_push_now &&
    input.contract.can_mark_local_rows_synced_now &&
    input.contract.summary.push_route_enabled &&
    input.contract.summary.pull_route_enabled &&
    input.contract.summary.blocked_gates === 0 &&
    input.serverReadiness.can_query_server_ledger_now &&
    input.serverReadiness.summary.remaining_blockers === 0
  );
}

function ackLedgerBlocker(input: {
  contract: SyncAckRetryLedgerContract;
  serverReadiness: SyncAckLedgerServerReadiness;
}) {
  const contractGateIds = input.contract.enablement_gates
    .filter((gate) => gate.status === "blocked")
    .map((gate) => gate.id)
    .join(", ");
  const serverReadinessGateIds = input.serverReadiness.gates
    .filter((gate) => gate.status !== "pass")
    .map((gate) => gate.id)
    .join(", ");
  const contractBlockedSummary = contractGateIds
    ? `contract blocked gates: ${contractGateIds}`
    : `contract blocked gates: ${input.contract.summary.blocked_gates}`;
  const serverReadinessBlockedSummary = serverReadinessGateIds
    ? `server readiness gates: ${serverReadinessGateIds}`
    : `server readiness blockers: ${input.serverReadiness.summary.remaining_blockers}`;

  return `统一 ACK/retry ledger 还没通过，不能声称全平台两端同步已验收；${contractBlockedSummary}；${serverReadinessBlockedSummary}。${input.serverReadiness.summary.next_action || input.contract.summary.next_action}`;
}

function step(input: {
  id: string;
  surface: TwoDeviceSyncSmokeSurface;
  title: string;
  status: TwoDeviceSyncSmokeStepStatus;
  deviceA: string;
  deviceB: string;
  pass: string;
  evidence: string;
  blocker: string | null;
}): TwoDeviceSyncSmokeStep {
  return {
    id: input.id,
    surface: input.surface,
    title: input.title,
    status: input.status,
    device_a_action: input.deviceA,
    device_b_action: input.deviceB,
    pass_criteria: input.pass,
    evidence_needed: input.evidence,
    current_blocker: input.blocker,
  };
}
