import type { CloudNativeFluidityReport } from "@/lib/sync/cloudNativeFluidityReport";
import type { CloudSourceOfTruthPlan } from "@/lib/sync/cloudSourceOfTruthPlan";
import type { SyncHandoffReadinessReceipt } from "@/lib/sync/syncHandoffReadinessReceipt";
import type { WebBetaAutonomyQueue } from "@/lib/sync/webBetaAutonomyQueue";
import type { WebLaunchWorkbenchPacket } from "@/lib/sync/webLaunchWorkbench";

export type WebBetaTimelineStageStatus =
  | "in-progress"
  | "blocked"
  | "owner-decision"
  | "future";

export interface WebBetaTimelineStage {
  id:
    | "local-fluency"
    | "cloud-source-of-truth"
    | "private-beta-hardening"
    | "investment-workflows-v1"
    | "notion-parity-polish";
  title: string;
  status: WebBetaTimelineStageStatus;
  target_range: string;
  critical_path: boolean;
  can_continue_locally: boolean;
  needs_owner_decision: boolean;
  needs_cloud_setup: boolean;
  current_evidence: string;
  next_action: string;
  target_section_id: string;
}

export interface WebBetaTimelineEstimate {
  format: "zhinote-web-beta-timeline-estimate";
  format_version: 1;
  estimate_status: "local-planning-estimate-only";
  architecture_target: "cloud-master-local-hot-cache";
  generated_at: string;
  private_beta_range: "2-4 weeks";
  full_platform_v1_range: "8-12 weeks";
  can_claim_web_beta_ready_now: false;
  can_claim_full_platform_ready_now: false;
  can_enable_cloud_sync_now: false;
  privacy_boundary: string;
  boundary: {
    local_estimate_only: true;
    reads_workbench_metadata: true;
    reads_cloud_source_of_truth_metadata: true;
    reads_fluidity_metadata: true;
    reads_handoff_readiness_metadata: true;
    reads_autonomy_queue_metadata: true;
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_file_names: false;
    reads_file_bytes: false;
    reads_secret_values: false;
    reads_tokens_or_cookies: false;
    reads_holdings_or_trading_plans: false;
    sends_network_requests: false;
    connects_cloud_services: false;
    deploys_app: false;
    writes_workspace_data: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    enables_sync: false;
    enables_ai: false;
  };
  summary: {
    stages: number;
    blocked: number;
    owner_decision: number;
    local_can_continue: number;
    cloud_setup_needed: number;
    workbench_blocked_stages: number;
    p0_actions: number;
    cloud_master_blocked_domains: number;
    source_of_truth_needs_cloud_runtime: number;
    fluidity_blockers: number;
    handoff_ready: boolean;
    local_autonomy_items: number;
  };
  stages: WebBetaTimelineStage[];
  next_action: string;
  required_verification_commands: string[];
}

export function buildWebBetaTimelineEstimate(input: {
  workbench: WebLaunchWorkbenchPacket;
  cloudSourceOfTruthPlan: CloudSourceOfTruthPlan;
  cloudNativeFluidityReport: CloudNativeFluidityReport;
  handoffReadiness: SyncHandoffReadinessReceipt;
  autonomyQueue: WebBetaAutonomyQueue;
  generatedAt?: string;
}): WebBetaTimelineEstimate {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const stages = buildStages(input);
  const blocked = stages.filter((stage) => stage.status === "blocked").length;
  const ownerDecision = stages.filter(
    (stage) => stage.status === "owner-decision"
  ).length;
  const localCanContinue = stages.filter(
    (stage) => stage.can_continue_locally
  ).length;
  const cloudSetupNeeded = stages.filter(
    (stage) => stage.needs_cloud_setup
  ).length;
  const requiredVerificationCommands = unique([
    ...input.workbench.required_verification_commands,
    ...input.autonomyQueue.required_verification_commands,
    "npm run verify:web-beta",
    "npm run verify:web-beta:smoke",
    "npm run verify:route-smoke",
    "npm run lint",
    "npm run build",
  ]);

  return {
    format: "zhinote-web-beta-timeline-estimate",
    format_version: 1,
    estimate_status: "local-planning-estimate-only",
    architecture_target: "cloud-master-local-hot-cache",
    generated_at: generatedAt,
    private_beta_range: "2-4 weeks",
    full_platform_v1_range: "8-12 weeks",
    can_claim_web_beta_ready_now: false,
    can_claim_full_platform_ready_now: false,
    can_enable_cloud_sync_now: false,
    privacy_boundary:
      "Generated locally from Web launch workbench metadata, cloud source-of-truth domain counts, cloud-native fluidity gates, sync handoff readiness, and local autonomy queue counts. This estimate does not read page bodies, database row values, file names, file bytes, secrets, tokens, cookies, holdings, trading plans, cloud data, or credentials; it does not send network requests, deploy the app, connect cloud services, write server data, upload workspace data, enable sync, or enable AI.",
    boundary: {
      local_estimate_only: true,
      reads_workbench_metadata: true,
      reads_cloud_source_of_truth_metadata: true,
      reads_fluidity_metadata: true,
      reads_handoff_readiness_metadata: true,
      reads_autonomy_queue_metadata: true,
      reads_page_body_text: false,
      reads_database_row_values: false,
      reads_file_names: false,
      reads_file_bytes: false,
      reads_secret_values: false,
      reads_tokens_or_cookies: false,
      reads_holdings_or_trading_plans: false,
      sends_network_requests: false,
      connects_cloud_services: false,
      deploys_app: false,
      writes_workspace_data: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      enables_sync: false,
      enables_ai: false,
    },
    summary: {
      stages: stages.length,
      blocked,
      owner_decision: ownerDecision,
      local_can_continue: localCanContinue,
      cloud_setup_needed: cloudSetupNeeded,
      workbench_blocked_stages: input.workbench.summary.blocked_stages,
      p0_actions: input.workbench.summary.p0_actions,
      cloud_master_blocked_domains:
        input.cloudSourceOfTruthPlan.summary.blocked,
      source_of_truth_needs_cloud_runtime:
        input.cloudSourceOfTruthPlan.summary.needs_cloud_runtime,
      fluidity_blockers: input.cloudNativeFluidityReport.summary.blockers,
      handoff_ready:
        input.handoffReadiness.summary.ready_for_cross_device_handoff,
      local_autonomy_items: input.autonomyQueue.summary.continue_locally,
    },
    stages,
    next_action: getNextAction({
      blocked,
      ownerDecision,
      localCanContinue,
      cloudSetupNeeded,
      p0Actions: input.workbench.summary.p0_actions,
    }),
    required_verification_commands: requiredVerificationCommands,
  };
}

function buildStages(input: {
  workbench: WebLaunchWorkbenchPacket;
  cloudSourceOfTruthPlan: CloudSourceOfTruthPlan;
  cloudNativeFluidityReport: CloudNativeFluidityReport;
  handoffReadiness: SyncHandoffReadinessReceipt;
  autonomyQueue: WebBetaAutonomyQueue;
}): WebBetaTimelineStage[] {
  const localFluencyBlocked =
    input.cloudNativeFluidityReport.summary.blockers > 0 &&
    input.cloudNativeFluidityReport.summary.performance_samples > 0;
  const cloudBlocked =
    input.cloudSourceOfTruthPlan.summary.blocked > 0 ||
    input.cloudSourceOfTruthPlan.summary.needs_cloud_runtime > 0 ||
    !input.handoffReadiness.summary.ready_for_cross_device_handoff;
  const betaHardeningBlocked =
    input.workbench.summary.blocked_stages > 0 ||
    input.workbench.summary.p0_actions > 0;

  return [
    {
      id: "local-fluency",
      title: "本地级输入和打开速度",
      status: localFluencyBlocked ? "blocked" : "in-progress",
      target_range: "3-5 days",
      critical_path: true,
      can_continue_locally: true,
      needs_owner_decision: false,
      needs_cloud_setup: false,
      current_evidence: `${input.cloudNativeFluidityReport.summary.performance_samples} 个本地性能样本，${input.cloudNativeFluidityReport.summary.hot_cache_route_targets} 个热缓存路由，${input.cloudNativeFluidityReport.summary.blockers} 个流畅度阻塞。`,
      next_action:
        "继续压缩 /daily、/schedule、page open 和 database row open 的首屏路径，避免大批量导入后整页等待。",
      target_section_id: "cloud-native-fluidity-report",
    },
    {
      id: "cloud-source-of-truth",
      title: "云端主库 + 本地热缓存",
      status: cloudBlocked ? "blocked" : "in-progress",
      target_range: "1.5-2.5 weeks",
      critical_path: true,
      can_continue_locally: input.autonomyQueue.summary.continue_locally > 0,
      needs_owner_decision: input.workbench.summary.owner_decisions > 0,
      needs_cloud_setup: true,
      current_evidence: `${input.cloudSourceOfTruthPlan.summary.cloud_master_ready} 个数据域云主库就绪，${input.cloudSourceOfTruthPlan.summary.needs_cloud_runtime} 个数据域需要云运行时，跨设备 handoff=${input.handoffReadiness.summary.ready_for_cross_device_handoff}.`,
      next_action:
        "先把页面、数据库和 workspace settings 的 ACK/冲突/恢复证明跑通，再把本地缓存降级为可重建副本。",
      target_section_id: "cloud-source-of-truth-plan",
    },
    {
      id: "private-beta-hardening",
      title: "Private Beta 稳定性和安全门禁",
      status: betaHardeningBlocked ? "blocked" : "owner-decision",
      target_range: "1 week",
      critical_path: true,
      can_continue_locally: input.autonomyQueue.summary.continue_locally > 0,
      needs_owner_decision: true,
      needs_cloud_setup: true,
      current_evidence: `${input.workbench.summary.blocked_stages} 个上线阶段阻塞，${input.workbench.summary.p0_actions} 个 P0 动作，${input.workbench.summary.disabled_api_stubs} 个 API 仍是 disabled stub。`,
      next_action:
        "完成 route smoke、环境变量、权限、备份恢复、审计和 owner review 后，才进入 Web Beta。",
      target_section_id: "web-launch-workbench",
    },
    {
      id: "investment-workflows-v1",
      title: "投研工作流 v1",
      status: "in-progress",
      target_range: "4-8 weeks",
      critical_path: false,
      can_continue_locally: true,
      needs_owner_decision: false,
      needs_cloud_setup: false,
      current_evidence:
        "公司、会议、报告、组合、项目和研究图谱模块已有工作台，但还需要把真实投研模板继续打磨成主流程。",
      next_action:
        "围绕公司主页、会议纪要、报告库、产业链图谱和组合跟踪继续补模板、链接和复盘入口。",
      target_section_id: "web-launch-workbench",
    },
    {
      id: "notion-parity-polish",
      title: "Notion 细节对齐和编辑器 polish",
      status: "future",
      target_range: "3-6 months",
      critical_path: false,
      can_continue_locally: true,
      needs_owner_decision: false,
      needs_cloud_setup: false,
      current_evidence:
        "基础 block/page/database 能力已具备，但完整 Notion 级块编辑、数据库视图和协作体验仍是长期任务。",
      next_action:
        "等 Web Beta 和核心投研流程稳定后，再系统补齐高级快捷键、协作评论、复杂数据库视图和权限细节。",
      target_section_id: "web-beta-stage-gate",
    },
  ];
}

function getNextAction(input: {
  blocked: number;
  ownerDecision: number;
  localCanContinue: number;
  cloudSetupNeeded: number;
  p0Actions: number;
}) {
  if (input.p0Actions > 0 || input.blocked > 0) {
    return "优先处理 P0 和阻塞阶段；本地仍可继续做流畅度、同步证明和投研模块打磨，但不能宣布 Web Beta 已就绪。";
  }
  if (input.ownerDecision > 0 || input.cloudSetupNeeded > 0) {
    return "工程侧本地任务可以继续，云端连接、正式同步和上线动作需要 owner 复核。";
  }
  if (input.localCanContinue > 0) {
    return "继续推进本地可完成的批次，并在每个批次后跑 verify:web-beta、lint、build。";
  }
  return "等待新的产品任务或 owner 决策。";
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}
