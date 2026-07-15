import type { CloudSyncControlPlane } from "@/lib/sync/cloudSyncControlPlane";
import type { CloudUploadReliabilityReport } from "@/lib/sync/cloudUploadReliabilityReport";
import type { TwoDayUsabilityGate } from "@/lib/sync/twoDayUsabilityGate";

export type TwoDeviceSyncSmokeStepStatus = "ready" | "wait" | "blocked";

export type TwoDeviceSyncSmokeSurface =
  | "account"
  | "page"
  | "daily"
  | "zhihui"
  | "database"
  | "file"
  | "handoff";

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
    can_keep_using_now: boolean;
    can_switch_devices_now: boolean;
  };
  next_action: string;
  steps: TwoDeviceSyncSmokeStep[];
  final_owner_receipt_template: string[];
}

export function buildTwoDeviceSyncSmokeRunbook(input: {
  gate: TwoDayUsabilityGate;
  controlPlane: CloudSyncControlPlane;
  reliability: CloudUploadReliabilityReport;
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
  const crossDeviceReady =
    canSwitchDevices && !waitingForDrain && !failedOrManual && !authRetryActive;

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
        : input.controlPlane.next_action || input.gate.next_48h_action,
    }),
  ];

  const ready = steps.filter((item) => item.status === "ready").length;
  const wait = steps.filter((item) => item.status === "wait").length;
  const blocked = steps.filter((item) => item.status === "blocked").length;
  const coreSurfacesReady =
    canKeepUsing &&
    reliability.cloud_workspace_linked &&
    reliability.page_sync_enabled &&
    reliability.database_sync_enabled &&
    reliability.file_sync_enabled;
  const readyToRun = coreSurfacesReady && wait === 0 && blocked === 0;

  return {
    format: "zhinote-two-device-sync-smoke-runbook",
    format_version: 1,
    report_status: "metadata-only-owner-runbook",
    generated_at: generatedAt,
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
      can_keep_using_now: canKeepUsing,
      can_switch_devices_now: canSwitchDevices,
    },
    next_action: getNextAction({ readyToRun, wait, blocked, input }),
    steps,
    final_owner_receipt_template: [
      "设备 A / 设备 B 使用同一账号和 workspace。",
      "Page、每日纪要、ZhiHui、数据库、文件元数据至少各跑一条测试样本。",
      "测试结束时 pending=0、failed=0、manual review=0、auth retry=无。",
      "两端刷新后都能看到对方最后一次编辑。",
    ],
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

function getNextAction(input: {
  readyToRun: boolean;
  wait: number;
  blocked: number;
  input: {
    gate: TwoDayUsabilityGate;
    controlPlane: CloudSyncControlPlane;
    reliability: CloudUploadReliabilityReport;
  };
}) {
  if (input.readyToRun && input.wait === 0) {
    return "可以开始真实两端 smoke：先跑 Page / Daily / ZhiHui / Database，再做最终交接。";
  }
  if (input.readyToRun) {
    return "可以准备两端 smoke，但先让 pending 清零，避免把旧队列误认为新测试失败。";
  }
  if (input.blocked > 0) {
    return input.input.controlPlane.next_action;
  }
  return input.input.gate.next_48h_action;
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
