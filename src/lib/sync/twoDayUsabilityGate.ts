import type { CloudNativeFluidityReport } from "@/lib/sync/cloudNativeFluidityReport";
import type { CloudSyncControlPlane } from "@/lib/sync/cloudSyncControlPlane";
import type { CloudUploadReliabilityReport } from "@/lib/sync/cloudUploadReliabilityReport";
import type { SyncAckLedgerServerReadiness } from "@/lib/sync/syncAckLedgerServerReadiness";
import type { PendingDomainCoverageReport } from "@/lib/sync/syncPendingDomainRegistry";

const ACCOUNT_SYNC_BRIDGE_REQUIRED_DOMAIN_COUNT = 5;

export type TwoDayUsabilityVerdict =
  | "ready-for-cross-device-beta"
  | "usable-while-sync-drains"
  | "p0-blocked";

export type TwoDayDeliveryAnswer = "yes-scoped-beta" | "not-safe-yet";

export type TwoDayUsabilityGateStatus = "pass" | "warn" | "block";

export type TwoDayUsabilityDecisionMode =
  | "ready-for-owner-smoke"
  | "drain-before-handoff"
  | "continue-local-use"
  | "p0-blocked";

export interface TwoDayUsabilityGateInput {
  cloudSyncControlPlane: CloudSyncControlPlane;
  cloudUploadReliabilityReport: CloudUploadReliabilityReport;
  cloudNativeFluidityReport: CloudNativeFluidityReport;
  pendingDomainCoverage: PendingDomainCoverageReport;
  ackLedgerServerReadiness: SyncAckLedgerServerReadiness;
  accountSyncBridgeProbe?: {
    status: "not-run" | "ready" | "blocked" | "partial";
    readable_domains: number;
    blocked_domains: number;
    checked_at: string | null;
    expires_at: string | null;
  } | null;
  generatedAt?: string;
}

export interface TwoDayUsabilityGateItem {
  id:
    | "local-use-not-blocked"
    | "cross-device-handoff"
    | "cloud-workspace-and-core-sync"
    | "queue-clear-or-draining"
    | "auth-retry-clear"
    | "account-sync-bridge-probe"
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
    queue_handoff_ready: boolean;
    handoff_blocked_by_queue_or_receipt: boolean;
    handoff_blocked_by_account_bridge_probe: boolean;
    handoff_readiness_status: CloudSyncControlPlane["summary"]["handoff_readiness_status"];
    handoff_sync_outcome_evidence_status:
      CloudSyncControlPlane["summary"]["handoff_sync_outcome_evidence_status"];
    handoff_stale_required_outcome_domains: number;
    sync_domain_coverage_complete: boolean;
    ack_ledger_ready: boolean;
    ack_ledger_remaining_blockers: number;
    ack_ledger_next_action: string;
    account_sync_bridge_probe_status:
      | "not-run"
      | "ready"
      | "blocked"
      | "partial";
    account_sync_bridge_probe_fresh: boolean;
    account_sync_bridge_readable_domains: number;
    account_sync_bridge_blocked_domains: number;
    account_sync_bridge_checked_at: string | null;
    account_sync_bridge_expires_at: string | null;
    performance_samples: number;
  };
  primary_blocker: TwoDayUsabilityGateItem | null;
  primary_warning: TwoDayUsabilityGateItem | null;
  user_decision: {
    mode: TwoDayUsabilityDecisionMode;
    headline: string;
    detail: string;
    primary_risk: string;
    next_action: string;
    safe_actions: string[];
    blocked_actions: string[];
  };
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
  const accountBridgeProbe = input.accountSyncBridgeProbe ?? null;
  const accountBridgeProbeStatus = accountBridgeProbe?.status ?? "not-run";
  const accountBridgeProbeReadableDomains =
    accountBridgeProbe?.readable_domains ?? 0;
  const accountBridgeProbeBlockedDomains =
    accountBridgeProbe?.blocked_domains ?? 0;
  const accountBridgeProbeFresh = isFreshAccountBridgeProbe(
    accountBridgeProbe,
    generatedAt
  );
  const accountBridgeProbeReady =
    Boolean(accountBridgeProbe) &&
    accountBridgeProbeStatus === "ready" &&
    accountBridgeProbeReadableDomains ===
      ACCOUNT_SYNC_BRIDGE_REQUIRED_DOMAIN_COUNT &&
    accountBridgeProbeFresh;
  const ackLedgerReady =
    input.ackLedgerServerReadiness.can_query_server_ledger_now &&
    input.ackLedgerServerReadiness.summary.remaining_blockers === 0;
  const canKeepUsingNow =
    plane.can_keep_typing_now && reliability.safe_to_keep_typing;
  const queueHandoffReady =
    plane.can_switch_device_now && reliability.safe_to_switch_device_now;
  const canSwitchDevicesNow = queueHandoffReady && accountBridgeProbeReady;
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
    canSwitchDevicesNow: queueHandoffReady,
    allPlatformSyncMinimumReady,
    plane,
    reliability,
    fluidity,
    coverage,
    accountBridgeProbeStatus,
    accountBridgeProbeFresh,
    accountBridgeProbeReady,
    accountBridgeProbeReadableDomains,
    accountBridgeProbeBlockedDomains,
    accountBridgeProbeCheckedAt: accountBridgeProbe?.checked_at ?? null,
    accountBridgeProbeExpiresAt: accountBridgeProbe?.expires_at ?? null,
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
  const nextBestAction =
    primaryBlocker?.next_action ??
    primaryWarning?.next_action ??
    "保持 P0 冻结，只修阻断可用性的同步、登录和性能问题；然后跑真实两设备 smoke。";

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
      safe_to_switch_device_now: canSwitchDevicesNow,
      queue_handoff_ready: queueHandoffReady,
      handoff_blocked_by_queue_or_receipt: !queueHandoffReady,
      handoff_blocked_by_account_bridge_probe: !accountBridgeProbeReady,
      handoff_readiness_status: plane.summary.handoff_readiness_status,
      handoff_sync_outcome_evidence_status:
        plane.summary.handoff_sync_outcome_evidence_status,
      handoff_stale_required_outcome_domains:
        plane.summary.handoff_stale_required_outcome_domains,
      sync_domain_coverage_complete: coverage.coverageComplete,
      ack_ledger_ready: ackLedgerReady,
      ack_ledger_remaining_blockers:
        input.ackLedgerServerReadiness.summary.remaining_blockers,
      ack_ledger_next_action:
        input.ackLedgerServerReadiness.summary.next_action,
      account_sync_bridge_probe_status: accountBridgeProbeStatus,
      account_sync_bridge_probe_fresh: accountBridgeProbeFresh,
      account_sync_bridge_readable_domains: accountBridgeProbeReadableDomains,
      account_sync_bridge_blocked_domains: accountBridgeProbeBlockedDomains,
      account_sync_bridge_checked_at: accountBridgeProbe?.checked_at ?? null,
      account_sync_bridge_expires_at: accountBridgeProbe?.expires_at ?? null,
      performance_samples: fluidity.performance_samples,
    },
    primary_blocker: primaryBlocker,
    primary_warning: primaryWarning,
    user_decision: buildUserDecision({
      allPlatformSyncMinimumReady,
      blockers,
      canKeepUsingNow,
      canSwitchDevicesNow,
      nextBestAction,
      primaryBlocker,
      primaryWarning,
      reliability,
      verdict,
    }),
    next_best_action: nextBestAction,
    evidence_required_before_claim: [
      "同步中心显示 pending、failed、manual review 全部清零。",
      "账号认证退避为无，临时接口失败不会自动登出任一设备。",
      "账号同步桥只读检查显示页面、每日纪要、会议、数据库、组合管理五个核心 metadata 域均可读。",
      "页面、每日纪要、ZhiHui、数据库、知识库附属、组合管理、文件元数据至少各完成一条真实两设备样本。",
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

function buildUserDecision(input: {
  allPlatformSyncMinimumReady: boolean;
  blockers: number;
  canKeepUsingNow: boolean;
  canSwitchDevicesNow: boolean;
  nextBestAction: string;
  primaryBlocker: TwoDayUsabilityGateItem | null;
  primaryWarning: TwoDayUsabilityGateItem | null;
  reliability: CloudUploadReliabilityReport["summary"];
  verdict: TwoDayUsabilityVerdict;
}): TwoDayUsabilityGate["user_decision"] {
  const queueSummary = `${input.reliability.total_waiting_rows} 待上传 / ${input.reliability.failed_rows} 失败 / ${input.reliability.manual_review_rows} 人工处理`;
  const primaryRisk =
    input.primaryBlocker?.evidence ??
    input.primaryWarning?.evidence ??
    "暂无 P0 阻断；继续保持小步验证。";

  if (!input.canKeepUsingNow || input.verdict === "p0-blocked") {
    return {
      mode: "p0-blocked",
      headline: "先处理 P0 阻断，再继续扩展功能",
      detail: `当前不能把它当作稳定同步版本使用。队列状态：${queueSummary}。`,
      primary_risk: primaryRisk,
      next_action: input.nextBestAction,
      safe_actions: [
        "可以查看已有页面和同步中心状态。",
        "可以导出本地验收清单或手动备份。",
      ],
      blocked_actions: [
        "不要切换到另一台设备继续写。",
        "不要清缓存、重建缓存或批量覆盖云端。",
        "不要声称 48 小时 scoped sync beta 已经可用。",
      ],
    };
  }

  if (
    input.allPlatformSyncMinimumReady &&
    input.canSwitchDevicesNow &&
    input.blockers === 0
  ) {
    return {
      mode: "ready-for-owner-smoke",
      headline: "可以开始真实两设备验收",
      detail:
        "核心同步状态达到最低可测条件；下一步用两台真实登录设备跑 Page、每日纪要、ZhiHui、数据库、知识库附属、组合管理和文件元数据 smoke。",
      primary_risk: primaryRisk,
      next_action: input.nextBestAction,
      safe_actions: [
        "可以按同步中心 runbook 做两设备测试。",
        "可以记录脱敏 owner evidence。",
        "可以在 pending 清零后做一次短时间设备交接。",
      ],
      blocked_actions: [
        "owner evidence 填完前，不要宣称完整全平台同步通过。",
        "不要用真实私密正文、数据库行值或文件内容当测试样本。",
      ],
    };
  }

  if (
    input.reliability.total_waiting_rows > 0 ||
    input.reliability.failed_rows > 0 ||
    input.reliability.manual_review_rows > 0 ||
    input.reliability.auth_retry_active ||
    !input.canSwitchDevicesNow
  ) {
    return {
      mode: "drain-before-handoff",
      headline: "可以继续本机写作，但先别换设备",
      detail: `本地输入会先保存；云端还需要补传、重试或人工复核。队列状态：${queueSummary}。`,
      primary_risk: primaryRisk,
      next_action: input.nextBestAction,
      safe_actions: [
        "可以继续在当前设备写页面、每日纪要和会议。",
        "可以等后台补传或手动重试 pending 队列。",
        "可以查看同步中心确认哪些域仍在等待。",
      ],
      blocked_actions: [
        "pending、failed、manual review 清零前，不要把另一台设备当作最新版本。",
        "账号退避恢复前，不要清缓存或重建本地热缓存。",
        "不要把本地显示正常误判为云端已经 ACK。",
      ],
    };
  }

  return {
    mode: "continue-local-use",
    headline: "可以稳定使用当前设备",
    detail:
      "本地输入和核心页面可继续使用；下一步仍要收集真实两设备证据，才能确认跨设备同步。",
    primary_risk: primaryRisk,
    next_action: input.nextBestAction,
    safe_actions: [
      "可以继续正常写作和查看每日纪要。",
      "可以打开同步中心准备两设备 smoke。",
    ],
    blocked_actions: [
      "没有 owner smoke 前，不要声称全平台同步已经完成。",
      "不要开启 AI、批量恢复或文件大对象上传作为默认后台动作。",
    ],
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
  accountBridgeProbeStatus: "not-run" | "ready" | "blocked" | "partial";
  accountBridgeProbeFresh: boolean;
  accountBridgeProbeReady: boolean;
  accountBridgeProbeReadableDomains: number;
  accountBridgeProbeBlockedDomains: number;
  accountBridgeProbeCheckedAt: string | null;
  accountBridgeProbeExpiresAt: string | null;
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
      id: "account-sync-bridge-probe",
      title: "账号同步桥可读性",
      status: input.accountBridgeProbeReady
        ? "pass"
        : input.accountBridgeProbeStatus === "blocked"
          ? "block"
          : "warn",
      evidence: accountBridgeProbeEvidence(input),
      nextAction: input.accountBridgeProbeReady
        ? "继续跑真实两设备 smoke，并保留 owner receipt。"
        : input.accountBridgeProbeStatus === "not-run"
          ? "先在同步中心运行“只读检查账号同步桥”，确认核心 metadata 域能被当前账号读到。"
          : input.accountBridgeProbeStatus === "ready" &&
              !input.accountBridgeProbeFresh
            ? "重新运行只读检查账号同步桥，拿到未过期回执后再切换设备。"
            : "先处理不可读域的登录、同步开关或云接口状态；本地输入和 pending 队列继续保留。",
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

function accountBridgeProbeEvidence(input: {
  accountBridgeProbeStatus: "not-run" | "ready" | "blocked" | "partial";
  accountBridgeProbeFresh: boolean;
  accountBridgeProbeReady: boolean;
  accountBridgeProbeReadableDomains: number;
  accountBridgeProbeBlockedDomains: number;
  accountBridgeProbeCheckedAt: string | null;
  accountBridgeProbeExpiresAt: string | null;
}) {
  const receiptWindow = `检查时间 ${input.accountBridgeProbeCheckedAt ?? "无"}；过期时间 ${
    input.accountBridgeProbeExpiresAt ?? "无"
  }。`;

  if (input.accountBridgeProbeReady) {
    return `页面、每日纪要、会议、数据库和组合管理五个核心 metadata 域均已通过只读检查，且回执仍在有效期内。${receiptWindow}`;
  }
  if (input.accountBridgeProbeStatus === "not-run") {
    return "账号同步桥还没有运行只读检查；不能声称真实两设备同步已准备好。";
  }
  if (
    input.accountBridgeProbeStatus === "ready" &&
    !input.accountBridgeProbeFresh
  ) {
    return `账号同步桥回执已过期或时间无效；不能作为换设备证据。${receiptWindow}`;
  }
  if (
    input.accountBridgeProbeStatus === "ready" &&
    input.accountBridgeProbeReadableDomains !==
      ACCOUNT_SYNC_BRIDGE_REQUIRED_DOMAIN_COUNT
  ) {
    return `账号同步桥只读检查只有 ${input.accountBridgeProbeReadableDomains}/${ACCOUNT_SYNC_BRIDGE_REQUIRED_DOMAIN_COUNT} 域可读，仍有 ${input.accountBridgeProbeBlockedDomains} 个域不可读。${receiptWindow}`;
  }
  return `账号同步桥只读检查为 ${input.accountBridgeProbeStatus}：${input.accountBridgeProbeReadableDomains} 个域可读，${input.accountBridgeProbeBlockedDomains} 个域不可读。${receiptWindow}`;
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

function isFreshAccountBridgeProbe(
  probe: TwoDayUsabilityGateInput["accountSyncBridgeProbe"],
  generatedAt: string
) {
  if (!probe?.checked_at || !probe.expires_at) return false;
  const checkedAt = Date.parse(probe.checked_at);
  const expiresAt = Date.parse(probe.expires_at);
  const now = Date.parse(generatedAt);
  return (
    !Number.isNaN(checkedAt) &&
    !Number.isNaN(expiresAt) &&
    !Number.isNaN(now) &&
    checkedAt <= now &&
    expiresAt > now
  );
}
