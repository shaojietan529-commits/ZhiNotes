import type { CloudNativeFluidityReport } from "@/lib/sync/cloudNativeFluidityReport";
import type { CloudSyncControlPlane } from "@/lib/sync/cloudSyncControlPlane";
import type { CloudUploadReliabilityReport } from "@/lib/sync/cloudUploadReliabilityReport";
import type { SyncAckLedgerServerReadiness } from "@/lib/sync/syncAckLedgerServerReadiness";
import type { PendingDomainCoverageReport } from "@/lib/sync/syncPendingDomainRegistry";

export type TwoDayUsabilityVerdict =
  | "ready-for-cross-device-beta"
  | "usable-while-sync-drains"
  | "p0-blocked";

export type TwoDayDeliveryAnswer = "yes-scoped-beta" | "not-safe-yet";

export type TwoDayUsabilityGateStatus = "pass" | "warn" | "block";

export interface TwoDayUsabilityGateInput {
  cloudSyncControlPlane: CloudSyncControlPlane;
  cloudUploadReliabilityReport: CloudUploadReliabilityReport;
  cloudNativeFluidityReport: CloudNativeFluidityReport;
  pendingDomainCoverage: PendingDomainCoverageReport;
  ackLedgerServerReadiness: SyncAckLedgerServerReadiness;
  generatedAt?: string;
}

export interface TwoDayUsabilityGateItem {
  id:
    | "local-use-not-blocked"
    | "cross-device-handoff"
    | "cloud-workspace-and-core-sync"
    | "queue-clear-or-draining"
    | "auth-retry-clear"
    | "sync-domain-coverage"
    | "ack-ledger-readiness"
    | "first-paint-fluidity";
  title: string;
  status: TwoDayUsabilityGateStatus;
  evidence: string;
  next_action: string;
}

export interface TwoDayUsabilityGate {
  format: "zhinote-two-day-usability-gate";
  format_version: 1;
  report_status: "metadata-only-p0-usability-gate";
  target_window_hours: 48;
  generated_at: string;
  verdict: TwoDayUsabilityVerdict;
  can_keep_using_now: boolean;
  can_switch_devices_now: boolean;
  all_platform_sync_minimum_ready: boolean;
  two_day_delivery_answer: TwoDayDeliveryAnswer;
  can_target_two_day_sync_beta: boolean;
  can_claim_full_notion_parity_now: false;
  privacy_boundary: string;
  boundary: {
    local_readiness_gate_only: true;
    reads_queue_counts: true;
    reads_queue_timestamps: true;
    reads_failure_messages: true;
    reads_auth_retry_state: true;
    reads_performance_metadata: true;
    reads_sync_domain_catalog: true;
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_comment_bodies: false;
    reads_file_names: false;
    reads_file_bytes: false;
    reads_secret_values: false;
    sends_network_requests: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    clears_local_cache: false;
    enables_ai: false;
  };
  summary: {
    blockers: number;
    warnings: number;
    pass: number;
    total_waiting_rows: number;
    failed_rows: number;
    manual_review_rows: number;
    auth_retry_active: boolean;
    cloud_workspace_linked: boolean;
    page_sync_enabled: boolean;
    database_sync_enabled: boolean;
    file_sync_enabled: boolean;
    safe_to_keep_typing: boolean;
    safe_to_switch_device_now: boolean;
    sync_domain_coverage_complete: boolean;
    ack_ledger_ready: boolean;
    ack_ledger_remaining_blockers: number;
    ack_ledger_next_action: string;
    performance_samples: number;
  };
  primary_blocker: TwoDayUsabilityGateItem | null;
  primary_warning: TwoDayUsabilityGateItem | null;
  next_best_action: string;
  evidence_required_before_claim: string[];
  gates: TwoDayUsabilityGateItem[];
  scoped_sync_beta_surfaces: string[];
  two_day_acceleration_rules: string[];
  not_in_two_day_scope: string[];
  non_goals_for_48h: string[];
  next_24h_action: string;
  next_48h_action: string;
}

export function buildTwoDayUsabilityGate(
  input: TwoDayUsabilityGateInput
): TwoDayUsabilityGate {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const reliability = input.cloudUploadReliabilityReport.summary;
  const plane = input.cloudSyncControlPlane;
  const fluidity = input.cloudNativeFluidityReport.summary;
  const coverage = input.pendingDomainCoverage;
  const ackLedgerReady =
    input.ackLedgerServerReadiness.can_query_server_ledger_now &&
    input.ackLedgerServerReadiness.summary.remaining_blockers === 0;
  const canKeepUsingNow =
    plane.can_keep_typing_now && reliability.safe_to_keep_typing;
  const canSwitchDevicesNow =
    plane.can_switch_device_now && reliability.safe_to_switch_device_now;
  const allPlatformSyncMinimumReady =
    canSwitchDevicesNow &&
    coverage.coverageComplete &&
    reliability.cloud_workspace_linked &&
    reliability.page_sync_enabled &&
    reliability.database_sync_enabled &&
    reliability.file_sync_enabled;
  const canTargetTwoDaySyncBeta = canKeepUsingNow;
  const twoDayDeliveryAnswer: TwoDayDeliveryAnswer = canTargetTwoDaySyncBeta
    ? "yes-scoped-beta"
    : "not-safe-yet";

  const gates = buildGateItems({
    canKeepUsingNow,
    canSwitchDevicesNow,
    allPlatformSyncMinimumReady,
    plane,
    reliability,
    fluidity,
    coverage,
    ackLedgerServerReadiness: input.ackLedgerServerReadiness,
  });
  const blockers = gates.filter((gate) => gate.status === "block").length;
  const warnings = gates.filter((gate) => gate.status === "warn").length;
  const passed = gates.filter((gate) => gate.status === "pass").length;
  const primaryBlocker = gates.find((gate) => gate.status === "block") ?? null;
  const primaryWarning = gates.find((gate) => gate.status === "warn") ?? null;
  const verdict: TwoDayUsabilityVerdict =
    allPlatformSyncMinimumReady && blockers === 0
      ? "ready-for-cross-device-beta"
      : canKeepUsingNow && blockers === 0
        ? "usable-while-sync-drains"
        : "p0-blocked";

  return {
    format: "zhinote-two-day-usability-gate",
    format_version: 1,
    report_status: "metadata-only-p0-usability-gate",
    target_window_hours: 48,
    generated_at: generatedAt,
    verdict,
    can_keep_using_now: canKeepUsingNow,
    can_switch_devices_now: canSwitchDevicesNow,
    all_platform_sync_minimum_ready: allPlatformSyncMinimumReady,
    two_day_delivery_answer: twoDayDeliveryAnswer,
    can_target_two_day_sync_beta: canTargetTwoDaySyncBeta,
    can_claim_full_notion_parity_now: false,
    privacy_boundary:
      "Generated locally from sync queue counts, auth retry state, cross-device handoff readiness, sync-domain coverage, and route performance metadata. It does not read page bodies, database row values, comments, file names, file bytes, secrets, tokens, cookies, or raw workspace content; it does not send network requests, upload workspace data, write server data, clear cache, or enable AI.",
    boundary: {
      local_readiness_gate_only: true,
      reads_queue_counts: true,
      reads_queue_timestamps: true,
      reads_failure_messages: true,
      reads_auth_retry_state: true,
      reads_performance_metadata: true,
      reads_sync_domain_catalog: true,
      reads_page_body_text: false,
      reads_database_row_values: false,
      reads_comment_bodies: false,
      reads_file_names: false,
      reads_file_bytes: false,
      reads_secret_values: false,
      sends_network_requests: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      clears_local_cache: false,
      enables_ai: false,
    },
    summary: {
      blockers,
      warnings,
      pass: passed,
      total_waiting_rows: reliability.total_waiting_rows,
      failed_rows: reliability.failed_rows,
      manual_review_rows: reliability.manual_review_rows,
      auth_retry_active: reliability.auth_retry_active,
      cloud_workspace_linked: reliability.cloud_workspace_linked,
      page_sync_enabled: reliability.page_sync_enabled,
      database_sync_enabled: reliability.database_sync_enabled,
      file_sync_enabled: reliability.file_sync_enabled,
      safe_to_keep_typing: reliability.safe_to_keep_typing,
      safe_to_switch_device_now: reliability.safe_to_switch_device_now,
      sync_domain_coverage_complete: coverage.coverageComplete,
      ack_ledger_ready: ackLedgerReady,
      ack_ledger_remaining_blockers:
        input.ackLedgerServerReadiness.summary.remaining_blockers,
      ack_ledger_next_action:
        input.ackLedgerServerReadiness.summary.next_action,
      performance_samples: fluidity.performance_samples,
    },
    primary_blocker: primaryBlocker,
    primary_warning: primaryWarning,
    next_best_action:
      primaryBlocker?.next_action ??
      primaryWarning?.next_action ??
      "保持 P0 冻结，只修阻断可用性的同步、登录和性能问题；然后跑真实两设备 smoke。",
    evidence_required_before_claim: [
      "同步中心显示 pending、failed、manual review 全部清零。",
      "账号认证退避为无，临时接口失败不会自动登出任一设备。",
      "页面、每日纪要、ZhiHui、数据库、文件元数据至少各完成一条真实两设备样本。",
      "设备 B 刷新后能看到设备 A 的新增和编辑结果。",
      "ACK ledger 服务端就绪报告显示 remaining_blockers=0 且可以查询 server ledger。",
      "remote ACK cursor 或等价 ACK ledger 证明本地 rows 已被云端确认。",
    ],
    gates,
    scoped_sync_beta_surfaces: [
      "账号会话稳定：临时云端失败不能自动登出。",
      "页面 / 每日纪要 / ZhiHui 会议日历复用现有页面账号同步和 metadata-first 热缓存。",
      "数据库 schema、视图和行记录复用现有数据库账号同步队列。",
      "同步中心展示 pending、failed、manual review、认证退避和跨设备 handoff 状态。",
      "真实两设备 smoke 覆盖创建、编辑、刷新、换设备继续写。",
    ],
    two_day_acceleration_rules: [
      "复用已存在的 /api/pages/account-sync 与 /api/databases/account-sync，不为了统一入口重写同步内核。",
      "只修 P0 可用性：账号、队列、ACK、首屏、日历和页面打开；暂停非阻断型 polish。",
      "文件大对象、AI、批量恢复、自动冲突合并继续 gated，不进入默认后台上传。",
      "每个有效改动都跑 P0 verifier、build、commit、push，避免线上版本漂移。",
    ],
    not_in_two_day_scope: [
      "完整 Notion 功能和多人实时协作 parity。",
      "所有 Office/PDF/HTML 文件的大对象云存储与原生编辑。",
      "复杂冲突的自动合并、权限分享、审计后台和恢复写回全自动化。",
      "把统一 /api/sync/push 和 /api/sync/pull 直接切成生产写入入口。",
    ],
    non_goals_for_48h: [
      "不把 48 小时目标定义成完整 Notion 功能对齐。",
      "不在 P0 阻塞未清前开启 AI、批量恢复写回或清本地缓存。",
      "不把本地热缓存当成唯一真实数据源；云端 ACK 前只显示本地已保存。",
    ],
    next_24h_action: getNextAction("24h", gates, reliability),
    next_48h_action: getNextAction("48h", gates, reliability),
  };
}

function buildGateItems(input: {
  canKeepUsingNow: boolean;
  canSwitchDevicesNow: boolean;
  allPlatformSyncMinimumReady: boolean;
  plane: CloudSyncControlPlane;
  reliability: CloudUploadReliabilityReport["summary"];
  fluidity: CloudNativeFluidityReport["summary"];
  coverage: PendingDomainCoverageReport;
  ackLedgerServerReadiness: SyncAckLedgerServerReadiness;
}): TwoDayUsabilityGateItem[] {
  const ackLedgerReady =
    input.ackLedgerServerReadiness.can_query_server_ledger_now &&
    input.ackLedgerServerReadiness.summary.remaining_blockers === 0;

  return [
    gate({
      id: "local-use-not-blocked",
      title: "继续使用不被打断",
      status: input.canKeepUsingNow ? "pass" : "block",
      evidence: input.canKeepUsingNow
        ? "本地输入可以即时保存，云同步失败不会阻止继续写。"
        : "当前控制面不建议继续输入；需要先处理人工复核或严重队列状态。",
      nextAction: input.canKeepUsingNow
        ? "继续使用，同时保持同步队列可见。"
        : "先处理人工复核、失败队列或账号状态，再恢复稳定使用。",
    }),
    gate({
      id: "cross-device-handoff",
      title: "跨设备交接",
      status: input.canSwitchDevicesNow
        ? "pass"
        : input.reliability.total_waiting_rows > 0 ||
            input.reliability.auth_retry_active
          ? "warn"
          : "block",
      evidence: input.canSwitchDevicesNow
        ? "当前队列、ACK 和 handoff 状态支持切换设备。"
        : `当前仍有 ${input.reliability.total_waiting_rows} 条等待上云；认证退避：${
            input.reliability.auth_retry_active ? "有" : "无"
          }。`,
      nextAction: input.canSwitchDevicesNow
        ? "可以做真实多端 smoke test。"
        : "先让 pending 清零，并确认账号退避恢复后再把其他设备当作最新版本。",
    }),
    gate({
      id: "cloud-workspace-and-core-sync",
      title: "云 workspace 与核心同步域",
      status:
        input.reliability.cloud_workspace_linked &&
        input.reliability.page_sync_enabled &&
        input.reliability.database_sync_enabled &&
        input.reliability.file_sync_enabled
          ? "pass"
          : "block",
      evidence: `云 workspace ${
        input.reliability.cloud_workspace_linked ? "已绑定" : "未绑定"
      }；页面 ${enabledLabel(input.reliability.page_sync_enabled)} / 数据库 ${enabledLabel(
        input.reliability.database_sync_enabled
      )} / 文件 ${enabledLabel(input.reliability.file_sync_enabled)}。`,
      nextAction:
        "优先完成账号页的 workspace 绑定，并开启页面、数据库、文件三个核心上云队列。",
    }),
    gate({
      id: "queue-clear-or-draining",
      title: "待上传和失败队列",
      status:
        input.reliability.manual_review_rows > 0 ||
        input.reliability.failed_rows > 0
          ? "block"
          : input.reliability.total_waiting_rows > 0
            ? "warn"
            : "pass",
      evidence: `${input.reliability.total_waiting_rows} 待上传 / ${input.reliability.failed_rows} 失败 / ${input.reliability.manual_review_rows} 人工处理。`,
      nextAction:
        input.reliability.failed_rows > 0 ||
        input.reliability.manual_review_rows > 0
          ? "先补传失败队列或导出人工复核包。"
          : input.reliability.total_waiting_rows > 0
            ? "运行补传全部，让后台队列清零。"
            : "保持队列清零，再做跨设备测试。",
    }),
    gate({
      id: "auth-retry-clear",
      title: "账号认证退避",
      status: input.reliability.auth_retry_active ? "warn" : "pass",
      evidence: input.reliability.auth_retry_state_label,
      nextAction: input.reliability.auth_retry_active
        ? "本地可继续写；等待账号自动重试恢复，期间不要清缓存或切设备。"
        : "保持临时账号失败不登出的策略。",
    }),
    gate({
      id: "sync-domain-coverage",
      title: "同步状态覆盖",
      status: input.coverage.coverageComplete
        ? input.coverage.unmatchedTableDomainCount > 0
          ? "warn"
          : "pass"
        : "block",
      evidence: `${input.coverage.visibleRegisteredDomainCount}/${input.coverage.registeredDomainCount} 个注册同步域可见；未匹配表 ${input.coverage.unmatchedTableDomainCount} 个。`,
      nextAction: input.coverage.coverageComplete
        ? "继续把新增模块接入统一 pending-domain registry。"
        : `补齐缺失同步域：${input.coverage.missingRegisteredDomainIds.join(
            " / "
          )}。`,
    }),
    gate({
      id: "ack-ledger-readiness",
      title: "ACK 账本可证明云端确认",
      status: ackLedgerReady ? "pass" : "warn",
      evidence: ackLedgerReady
        ? "ACK ledger 服务端就绪，可以用 durable ACK cursor 证明本地 rows 已被云端确认。"
        : `ACK ledger 仍有 ${input.ackLedgerServerReadiness.summary.remaining_blockers} 个阻塞/确认项；当前 scoped beta 可继续推进，但不能声称完整全平台同步通过。`,
      nextAction: ackLedgerReady
        ? "继续跑真实两设备 smoke，并保留 ACK cursor 证据。"
        : input.ackLedgerServerReadiness.summary.next_action,
    }),
    gate({
      id: "first-paint-fluidity",
      title: "刷新后首屏流畅度",
      status:
        input.fluidity.performance_samples >= 3
          ? input.fluidity.web_beta_sync_gate_status === "block"
            ? "warn"
            : "pass"
          : "warn",
      evidence: `已有 ${input.fluidity.performance_samples} 个性能样本；本地首屏平均 ${
        input.fluidity.average_local_first_ms ?? "暂无"
      }ms。`,
      nextAction:
        input.fluidity.performance_samples >= 3
          ? "继续压低 Daily、ZhiHui 和页面打开耗时。"
          : "继续采集 Daily、ZhiHui、页面打开性能样本，确认大批量导入后仍先显示 metadata。",
    }),
  ];
}

function gate(input: {
  id: TwoDayUsabilityGateItem["id"];
  title: string;
  status: TwoDayUsabilityGateStatus;
  evidence: string;
  nextAction: string;
}): TwoDayUsabilityGateItem {
  return {
    id: input.id,
    title: input.title,
    status: input.status,
    evidence: input.evidence,
    next_action: input.nextAction,
  };
}

function getNextAction(
  window: "24h" | "48h",
  gates: TwoDayUsabilityGateItem[],
  reliability: CloudUploadReliabilityReport["summary"]
) {
  const firstBlocker = gates.find((gate) => gate.status === "block");
  const firstWarning = gates.find((gate) => gate.status === "warn");
  if (firstBlocker) return firstBlocker.next_action;
  if (window === "24h" && reliability.total_waiting_rows > 0) {
    return "先补传全部待上传队列，拿到可重复的 ACK / pending 清零证据。";
  }
  if (firstWarning) return firstWarning.next_action;
  if (window === "48h") {
    return "用两个真实登录设备做创建、编辑、刷新、换设备继续写的 smoke test。";
  }
  return "保持 P0 冻结，只修阻断可用性的同步、登录和性能问题。";
}

function enabledLabel(enabled: boolean) {
  return enabled ? "开启" : "关闭";
}
