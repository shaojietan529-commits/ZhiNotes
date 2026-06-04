import type { SyncOptInGateReport } from "@/lib/sync/syncOptInGate";
import type { WebBetaDeploymentTarget } from "@/lib/sync/webBetaDeploymentTarget";
import type { WebBetaEnvironmentPreflight } from "@/lib/sync/webBetaEnvironmentPreflight";
import type { WebBetaLaunchChecklist } from "@/lib/sync/webBetaLaunchChecklist";
import type {
  WebBetaNextAction,
  WebBetaNextActionPlan,
  WebBetaNextActionPriority,
  WebBetaNextActionStatus,
} from "@/lib/sync/webBetaNextActions";
import type { WebBetaOwnerReviewPacket } from "@/lib/sync/webBetaOwnerReviewPacket";
import type { WebBetaRoutePreflightReport } from "@/lib/sync/webBetaRoutePreflight";
import type {
  WebBetaStageGate,
  WebBetaStageGateReport,
  WebBetaStageGateStatus,
} from "@/lib/sync/webBetaStageGate";

export type WebLaunchWorkbenchLaneId =
  | "local-continuity"
  | "account-cloud"
  | "schema-storage"
  | "sync-conflict"
  | "backup-recovery"
  | "security-permission"
  | "deployment-release"
  | "owner-decision";

export interface WebLaunchWorkbenchLane {
  id: WebLaunchWorkbenchLaneId;
  title: string;
  description: string;
  route: string;
  stage_count: number;
  action_count: number;
  p0_count: number;
  blocked_count: number;
  privacy_boundary: string;
}

export interface WebLaunchWorkbenchAction {
  id: string;
  lane_id: WebLaunchWorkbenchLaneId;
  title: string;
  priority: WebBetaNextActionPriority;
  status: WebBetaNextActionStatus;
  source: string;
  owner: WebBetaNextAction["owner"];
  execution_path: WebBetaNextAction["execution_path"];
  cloud_dependency: WebBetaNextAction["cloud_dependency"];
  evidence: string;
  next_action: string;
  unlocks: string;
  route: string;
  can_start_locally: boolean;
  requires_owner_decision: boolean;
  requires_cloud_dependency: boolean;
  writes_workspace_data: false;
  writes_server_data: false;
  uploads_workspace_data: false;
  deploys_app: false;
  connects_cloud_services: false;
  privacy_boundary: string;
  verification_commands: string[];
  completion_evidence: string[];
  forbidden_until_confirmed: string[];
}

export interface WebLaunchWorkbenchStage {
  id: WebBetaStageGate["id"];
  lane_id: WebLaunchWorkbenchLaneId;
  order: number;
  title: string;
  status: WebBetaStageGateStatus;
  current_state: string;
  missing_before_web_beta: string;
  next_action: string;
  source: string;
}

export interface WebLaunchWorkbenchPacket {
  format: "zhinote-web-launch-workbench-packet";
  format_version: 1;
  packet_status: "local-web-launch-workbench-only";
  launch_verdict: "not-ready";
  local_app_can_continue_now: true;
  web_beta_can_launch_now: false;
  cloud_sync_can_start_now: false;
  privacy_note: string;
  boundary: {
    local_packet_only: true;
    reads_stage_gate_metadata: true;
    reads_next_action_plan: true;
    reads_owner_review_packet: true;
    reads_launch_checklist_summary: true;
    reads_route_preflight_summary: true;
    reads_environment_metadata: true;
    reads_deployment_target_metadata: true;
    reads_sync_opt_in_gate: true;
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_file_names: false;
    reads_file_bytes: false;
    reads_secret_values: false;
    reads_tokens_or_cookies: false;
    reads_holdings_or_trading_plans: false;
    connects_cloud_services: false;
    creates_accounts: false;
    deploys_app: false;
    writes_workspace_data: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    enables_sync: false;
    enables_ai: false;
    requires_owner_confirmation_before_web_beta: true;
    requires_owner_confirmation_before_cloud_sync: true;
  };
  summary: {
    lanes: number;
    stages: number;
    blocked_stages: number;
    p0_stage_blockers: number;
    next_actions: number;
    p0_actions: number;
    p1_actions: number;
    p2_actions: number;
    ready_to_build: number;
    local_first_actions: number;
    owner_decisions: number;
    cloud_required_actions: number;
    missing_required_environment: number | null;
    route_mismatch_or_missing: number;
    disabled_api_stubs: number;
    sync_opt_in_blocked: number;
    owner_review_questions: number;
    forbidden_actions: number;
  };
  lanes: WebLaunchWorkbenchLane[];
  stages: WebLaunchWorkbenchStage[];
  actions: WebLaunchWorkbenchAction[];
  launch_sequence: Array<{
    order: number;
    title: string;
    status: WebBetaStageGateStatus;
    route: string;
    target_section_id: string;
    evidence: string;
    completion_signal: string;
  }>;
  owner_decision_summary: {
    decision: WebBetaOwnerReviewPacket["decision"];
    review_questions: number;
    yes: number;
    no: number;
    p0_blockers: number;
    local_first_ready: number;
  };
  excluded_payload_classes: string[];
  forbidden_actions_before_owner_approval: string[];
  required_verification_commands: string[];
}

const LANE_META: Record<
  WebLaunchWorkbenchLaneId,
  Omit<
    WebLaunchWorkbenchLane,
    "stage_count" | "action_count" | "p0_count" | "blocked_count"
  >
> = {
  "local-continuity": {
    id: "local-continuity",
    title: "本地连续使用",
    description: "确认本地工作台、备份、模块和离线数据仍是当前 source of truth。",
    route: "/modules/sync",
    privacy_boundary:
      "只读取本地模块和数量级 metadata，不读取页面正文、数据库 row values 或文件内容。",
  },
  "account-cloud": {
    id: "account-cloud",
    title: "账号和云工作区",
    description: "登录、session、workspace membership 和本地到云端链接的门禁。",
    route: "/modules/sync",
    privacy_boundary:
      "只读取账号/环境状态 metadata，不读取 email 正文、密码、token、cookie 或 secret 值。",
  },
  "schema-storage": {
    id: "schema-storage",
    title: "云数据库和私有文件",
    description: "Supabase schema、RLS、migration、private storage 和 signed URL。",
    route: "/modules/sync",
    privacy_boundary:
      "不会创建云资源、应用 migration、生成 signed URL 或上传文件。",
  },
  "sync-conflict": {
    id: "sync-conflict",
    title: "同步和冲突",
    description: "Push/pull、remote baseline、cursor、replay 和 conflict review。",
    route: "/modules/sync",
    privacy_boundary:
      "只读取 sync gate summary，不读取远端数据、不上传队列、不确认 sync rows。",
  },
  "backup-recovery": {
    id: "backup-recovery",
    title: "备份恢复",
    description: "Backup、restore dry-run、restore write-back、rollback 和二次确认。",
    route: "/modules/sync",
    privacy_boundary:
      "不会执行 restore apply、覆盖页面、删除数据或写 workspace。",
  },
  "security-permission": {
    id: "security-permission",
    title: "权限和审计",
    description: "Server-side permission、high-risk confirmation、audit event 和 retention。",
    route: "/modules/sync",
    privacy_boundary:
      "不会写 audit event，不导出页面正文、文件 bytes、token、secret 或敏感投研细节。",
  },
  "deployment-release": {
    id: "deployment-release",
    title: "部署和发布",
    description: "Vercel、Supabase、Cloudflare、环境变量、route preflight 和 smoke tests。",
    route: "/modules/sync",
    privacy_boundary:
      "不会部署 app、连接 cloud provider、读取 secret values 或公开链接。",
  },
  "owner-decision": {
    id: "owner-decision",
    title: "Owner 决策",
    description: "把 P0 blocker、本地可做事项、云依赖和上线决定拆清楚。",
    route: "/modules/sync",
    privacy_boundary:
      "只导出 owner review metadata，不导出私人内容、持仓、交易计划或客户信息。",
  },
};

const WEB_LAUNCH_FORBIDDEN_ACTIONS = [
  "deploy_to_public_or_private_web_beta",
  "create_cloud_accounts",
  "connect_supabase_project",
  "apply_cloud_migrations",
  "enable_sync_push",
  "enable_sync_pull",
  "upload_workspace_data",
  "upload_file_bytes",
  "enable_file_presign",
  "enable_restore_writeback",
  "write_server_audit_events",
  "invite_external_users",
  "enable_ai_execution",
  "read_or_export_secret_values",
  "read_or_export_page_body_text",
  "read_or_export_database_row_values",
  "read_or_export_file_names",
  "read_or_export_holdings_or_trading_plans",
];

const WEB_LAUNCH_EXCLUDED_PAYLOAD_CLASSES = [
  "page_body_text",
  "database_row_values",
  "comment_bodies",
  "file_names",
  "file_bytes",
  "backup_payloads",
  "holdings",
  "trading_plans",
  "client_information",
  "ai_prompt_text",
  "model_raw_output",
  "tokens",
  "cookies",
  "secret_values",
  "signed_urls",
  "cloud_connection_strings",
];

export function buildWebLaunchWorkbenchPacket(input: {
  stageGate: WebBetaStageGateReport;
  nextActionPlan: WebBetaNextActionPlan;
  ownerReviewPacket: WebBetaOwnerReviewPacket;
  launchChecklist: WebBetaLaunchChecklist;
  routePreflight: WebBetaRoutePreflightReport;
  environmentPreflight: WebBetaEnvironmentPreflight | null;
  deploymentTarget: WebBetaDeploymentTarget;
  syncOptInGate: SyncOptInGateReport;
}): WebLaunchWorkbenchPacket {
  const stages = buildStages(input.stageGate);
  const actions = buildActions(input.nextActionPlan);
  const lanes = buildLanes(stages, actions);
  const routeMismatchOrMissing =
    input.routePreflight.summary.missing +
    input.routePreflight.summary.status_mismatch;
  const requiredVerificationCommands = unique([
    ...input.ownerReviewPacket.required_verification_commands,
    "npm run verify:web-beta",
    "npm run verify:web-beta:smoke",
    "npm run lint",
    "npm run build",
  ]);

  return {
    format: "zhinote-web-launch-workbench-packet",
    format_version: 1,
    packet_status: "local-web-launch-workbench-only",
    launch_verdict: "not-ready",
    local_app_can_continue_now: true,
    web_beta_can_launch_now: false,
    cloud_sync_can_start_now: false,
    privacy_note:
      "Generated locally from Web Beta stage gate, next action, owner review, launch checklist, route preflight, environment presence, deployment target, and sync opt-in metadata. This web launch workbench does not read page body text, database row values, file names, file bytes, secret values, tokens, cookies, holdings, trading plans, client information, cloud data, or credentials; it does not connect cloud services, create accounts, deploy the app, write workspace data, write server data, upload workspace data, enable sync, or enable AI.",
    boundary: {
      local_packet_only: true,
      reads_stage_gate_metadata: true,
      reads_next_action_plan: true,
      reads_owner_review_packet: true,
      reads_launch_checklist_summary: true,
      reads_route_preflight_summary: true,
      reads_environment_metadata: true,
      reads_deployment_target_metadata: true,
      reads_sync_opt_in_gate: true,
      reads_page_body_text: false,
      reads_database_row_values: false,
      reads_file_names: false,
      reads_file_bytes: false,
      reads_secret_values: false,
      reads_tokens_or_cookies: false,
      reads_holdings_or_trading_plans: false,
      connects_cloud_services: false,
      creates_accounts: false,
      deploys_app: false,
      writes_workspace_data: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      enables_sync: false,
      enables_ai: false,
      requires_owner_confirmation_before_web_beta: true,
      requires_owner_confirmation_before_cloud_sync: true,
    },
    summary: {
      lanes: lanes.length,
      stages: stages.length,
      blocked_stages: input.stageGate.summary.blocked,
      p0_stage_blockers: input.stageGate.summary.p0_blockers,
      next_actions: input.nextActionPlan.summary.actions,
      p0_actions: input.nextActionPlan.summary.p0,
      p1_actions: input.nextActionPlan.summary.p1,
      p2_actions: input.nextActionPlan.summary.p2,
      ready_to_build: input.nextActionPlan.summary.ready_to_build,
      local_first_actions: input.nextActionPlan.summary.local_first,
      owner_decisions: input.nextActionPlan.summary.needs_owner_decision,
      cloud_required_actions: input.nextActionPlan.summary.cloud_required,
      missing_required_environment:
        input.environmentPreflight?.summary.missing_required ?? null,
      route_mismatch_or_missing: routeMismatchOrMissing,
      disabled_api_stubs: input.launchChecklist.local_evidence.disabled_api_stubs,
      sync_opt_in_blocked: input.syncOptInGate.summary.blocked,
      owner_review_questions: input.ownerReviewPacket.summary.review_questions,
      forbidden_actions: WEB_LAUNCH_FORBIDDEN_ACTIONS.length,
    },
    lanes,
    stages,
    actions,
    launch_sequence: buildLaunchSequence(input),
    owner_decision_summary: {
      decision: input.ownerReviewPacket.decision,
      review_questions: input.ownerReviewPacket.summary.review_questions,
      yes: input.ownerReviewPacket.summary.yes,
      no: input.ownerReviewPacket.summary.no,
      p0_blockers: input.ownerReviewPacket.summary.p0_blockers,
      local_first_ready: input.ownerReviewPacket.summary.local_first_ready,
    },
    excluded_payload_classes: WEB_LAUNCH_EXCLUDED_PAYLOAD_CLASSES,
    forbidden_actions_before_owner_approval: WEB_LAUNCH_FORBIDDEN_ACTIONS,
    required_verification_commands: requiredVerificationCommands,
  };
}

function buildStages(
  stageGate: WebBetaStageGateReport
): WebLaunchWorkbenchStage[] {
  return stageGate.gates.map((gate, index) => ({
    id: gate.id,
    lane_id: laneForStage(gate),
    order: index + 1,
    title: gate.title,
    status: gate.status,
    current_state: gate.current_state,
    missing_before_web_beta: gate.missing_before_web_beta,
    next_action: gate.next_action,
    source: gate.source,
  }));
}

function buildActions(
  nextActionPlan: WebBetaNextActionPlan
): WebLaunchWorkbenchAction[] {
  return nextActionPlan.actions.map((action) => ({
    id: action.id,
    lane_id: laneForAction(action),
    title: action.title,
    priority: action.priority,
    status: action.status,
    source: action.source,
    owner: action.owner,
    execution_path: action.execution_path,
    cloud_dependency: action.cloud_dependency,
    evidence: action.evidence,
    next_action: action.required_action,
    unlocks: action.unlocks,
    route: "/modules/sync",
    can_start_locally: action.can_start_locally,
    requires_owner_decision: action.execution_path === "owner-decision",
    requires_cloud_dependency: action.cloud_dependency !== "none",
    writes_workspace_data: false,
    writes_server_data: false,
    uploads_workspace_data: false,
    deploys_app: false,
    connects_cloud_services: false,
    privacy_boundary: LANE_META[laneForAction(action)].privacy_boundary,
    verification_commands: action.verification_commands,
    completion_evidence: action.completion_evidence,
    forbidden_until_confirmed: action.forbidden_until_confirmed,
  }));
}

function buildLanes(
  stages: WebLaunchWorkbenchStage[],
  actions: WebLaunchWorkbenchAction[]
): WebLaunchWorkbenchLane[] {
  return Object.values(LANE_META).map((lane) => {
    const laneStages = stages.filter((stage) => stage.lane_id === lane.id);
    const laneActions = actions.filter((action) => action.lane_id === lane.id);
    return {
      ...lane,
      stage_count: laneStages.length,
      action_count: laneActions.length,
      p0_count: laneActions.filter((action) => action.priority === "p0").length,
      blocked_count:
        laneStages.filter((stage) => stage.status === "blocked").length +
        laneActions.filter((action) => action.status === "blocked-by-missing-cloud")
          .length,
    };
  });
}

function buildLaunchSequence(input: {
  stageGate: WebBetaStageGateReport;
  deploymentTarget: WebBetaDeploymentTarget;
  syncOptInGate: SyncOptInGateReport;
}) {
  return [
    {
      order: 1,
      title: "继续本地优先工作",
      status: "ready" as const,
      route: "/modules",
      target_section_id: "module-hub",
      evidence:
        "Local app can continue now; notes, modules, backups, and local planning reports remain usable.",
      completion_signal:
        "本地笔记、文件、数据库和投研模块继续作为 source of truth。",
    },
    {
      order: 2,
      title: "清理 Web Beta P0 blocker",
      status:
        input.stageGate.summary.p0_blockers > 0
          ? ("blocked" as const)
          : ("manual-confirmation" as const),
      route: "/modules/sync",
      target_section_id: "web-beta-stage-gate",
      evidence: `${input.stageGate.summary.p0_blockers} P0 blockers and ${input.stageGate.summary.blocked} blocked stage gates remain.`,
      completion_signal:
        "Auth/session、cloud schema、sync、restore、permission、audit、environment 和 route gates 有证据通过。",
    },
    {
      order: 3,
      title: "确认部署目标和环境",
      status:
        input.deploymentTarget.summary.blocked > 0
          ? ("blocked" as const)
          : ("manual-confirmation" as const),
      route: "/modules/sync",
      target_section_id: "web-beta-deployment-target",
      evidence: `First target is ${input.deploymentTarget.selected_strategy.first_web_alpha}; ${input.deploymentTarget.summary.blocked} deployment tracks remain blocked.`,
      completion_signal:
        "Vercel/Supabase/Cloudflare 角色、环境变量、preview origin、rollback 和 smoke tests 完成 owner review。",
    },
    {
      order: 4,
      title: "Owner 批准 Web Beta 和云同步",
      status: "blocked" as const,
      route: "/modules/sync",
      target_section_id: "web-beta-owner-review",
      evidence: `Web Beta launch is false; cloud sync opt-in has ${input.syncOptInGate.summary.blocked} blocked gates and can_start_cloud_sync is false.`,
      completion_signal:
        "Owner 明确批准 Web Beta、cloud sync first push、外部用户邀请和数据上传边界。",
    },
  ];
}

function laneForStage(gate: WebBetaStageGate): WebLaunchWorkbenchLaneId {
  if (gate.id === "local-workbench") return "local-continuity";
  if (gate.id === "auth-session" || gate.id === "cloud-database") {
    return "account-cloud";
  }
  if (gate.id === "private-file-storage") return "schema-storage";
  if (gate.id === "sync-push-pull") return "sync-conflict";
  if (gate.id === "backup-restore") return "backup-recovery";
  if (gate.id === "permissions-audit") return "security-permission";
  if (gate.id === "deployment-release") return "deployment-release";
  return "owner-decision";
}

function laneForAction(action: WebBetaNextAction): WebLaunchWorkbenchLaneId {
  if (action.phase === "account") return "account-cloud";
  if (action.phase === "cloud-schema") return "schema-storage";
  if (action.phase === "sync") return "sync-conflict";
  if (action.phase === "recovery") return "backup-recovery";
  if (action.phase === "permissions") return "security-permission";
  if (action.phase === "deployment") return "deployment-release";
  return "owner-decision";
}

function unique(values: string[]) {
  return [...new Set(values)];
}
