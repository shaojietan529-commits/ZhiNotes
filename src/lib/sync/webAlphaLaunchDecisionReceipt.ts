import type {
  WebAlphaHandoffBundle,
  WebAlphaHandoffDecision,
} from "@/lib/sync/webAlphaHandoffBundle";
import type { WebBetaEnvironmentPreflight } from "@/lib/sync/webBetaEnvironmentPreflight";
import type { WebBetaNextActionPlan } from "@/lib/sync/webBetaNextActions";
import type {
  WebBetaStageGate,
  WebBetaStageGateReport,
} from "@/lib/sync/webBetaStageGate";

export type WebAlphaLaunchDecisionAnswer = "yes" | "no";

export type WebAlphaLaunchDecisionStatus =
  | "go-local-only"
  | "no-go-preview"
  | "no-go-cloud";

export interface WebAlphaLaunchDecisionReceiptInput {
  handoffBundle: WebAlphaHandoffBundle;
  stageGate: WebBetaStageGateReport;
  nextActionPlan: WebBetaNextActionPlan;
  environmentPreflight: WebBetaEnvironmentPreflight | null;
}

export interface WebAlphaLaunchDecisionQuestion {
  id: string;
  question: string;
  answer: WebAlphaLaunchDecisionAnswer;
  status: WebAlphaLaunchDecisionStatus;
  evidence: string;
  required_before_yes: string;
}

export interface WebAlphaLaunchDecisionBlocker {
  id: string;
  source: string;
  title: string;
  priority: "p0" | "p1" | "p2" | "owner";
  evidence: string;
  required_action: string;
}

export interface WebAlphaLaunchDecisionReceipt {
  format: "zhinote-web-alpha-launch-decision-receipt";
  format_version: 1;
  receipt_status: "local-launch-decision-only";
  release_verdict: "no-go";
  decision: "continue-local-build-no-preview";
  local_app_can_continue_now: true;
  web_alpha_preview_can_be_shared_now: false;
  cloud_sync_can_start_now: false;
  privacy_note: string;
  boundary: {
    local_receipt_only: true;
    reads_handoff_bundle: true;
    reads_stage_gate_metadata: true;
    reads_next_action_plan: true;
    reads_environment_metadata: true;
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_file_bytes: false;
    reads_secret_values: false;
    reads_holding_details: false;
    reads_trading_plans: false;
    sends_network_requests: false;
    deploys_app: false;
    creates_accounts: false;
    connects_cloud_services: false;
    writes_workspace_data: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    enables_sync: false;
    enables_ai: false;
    requires_owner_confirmation_before_preview: true;
    requires_owner_confirmation_before_cloud: true;
  };
  summary: {
    decision_questions: number;
    yes: number;
    no: number;
    blocked_stage_gates: number;
    p0_actions: number;
    owner_decisions: number;
    missing_required_environment: number | null;
    route_gaps: number;
    blocked_smoke_cases: number;
    verification_commands_required: number;
    top_blockers: number;
  };
  decision_questions: WebAlphaLaunchDecisionQuestion[];
  top_blockers: WebAlphaLaunchDecisionBlocker[];
  required_verification_commands: WebAlphaHandoffBundle["command_bundle"];
  required_owner_decisions: WebAlphaHandoffDecision[];
  forbidden_actions_before_owner_approval: string[];
  excluded_payload_classes: string[];
}

export function buildWebAlphaLaunchDecisionReceipt(
  input: WebAlphaLaunchDecisionReceiptInput
): WebAlphaLaunchDecisionReceipt {
  const decisionQuestions = buildDecisionQuestions(input);
  const topBlockers = buildTopBlockers(input);
  const yes = decisionQuestions.filter((question) => question.answer === "yes")
    .length;
  const no = decisionQuestions.length - yes;
  const routeGaps =
    input.handoffBundle.summary.route_gaps ??
    input.stageGate.summary.route_mismatch_or_missing;

  return {
    format: "zhinote-web-alpha-launch-decision-receipt",
    format_version: 1,
    receipt_status: "local-launch-decision-only",
    release_verdict: "no-go",
    decision: "continue-local-build-no-preview",
    local_app_can_continue_now: true,
    web_alpha_preview_can_be_shared_now: false,
    cloud_sync_can_start_now: false,
    privacy_note:
      "Generated locally from Web Alpha handoff, stage gate, next-action, and environment metadata. This receipt is a launch decision summary only. It does not read page body text, database row values, file bytes, secret values, holdings, trading plans, cloud data, AI prompts, tokens, or credentials; it does not deploy the app, create accounts, connect cloud services, upload workspace data, enable sync, or enable AI.",
    boundary: {
      local_receipt_only: true,
      reads_handoff_bundle: true,
      reads_stage_gate_metadata: true,
      reads_next_action_plan: true,
      reads_environment_metadata: true,
      reads_page_body_text: false,
      reads_database_row_values: false,
      reads_file_bytes: false,
      reads_secret_values: false,
      reads_holding_details: false,
      reads_trading_plans: false,
      sends_network_requests: false,
      deploys_app: false,
      creates_accounts: false,
      connects_cloud_services: false,
      writes_workspace_data: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      enables_sync: false,
      enables_ai: false,
      requires_owner_confirmation_before_preview: true,
      requires_owner_confirmation_before_cloud: true,
    },
    summary: {
      decision_questions: decisionQuestions.length,
      yes,
      no,
      blocked_stage_gates: input.stageGate.summary.blocked,
      p0_actions: input.nextActionPlan.summary.p0,
      owner_decisions: input.handoffBundle.summary.owner_decisions,
      missing_required_environment:
        input.environmentPreflight?.summary.missing_required ?? null,
      route_gaps: routeGaps,
      blocked_smoke_cases: input.handoffBundle.summary.blocked_smoke_cases,
      verification_commands_required:
        input.handoffBundle.command_bundle.length + 1,
      top_blockers: topBlockers.length,
    },
    decision_questions: decisionQuestions,
    top_blockers: topBlockers,
    required_verification_commands: [
      input.handoffBundle.verification_receipt_runner,
      ...input.handoffBundle.command_bundle,
    ],
    required_owner_decisions: input.handoffBundle.owner_decisions,
    forbidden_actions_before_owner_approval: [
      "share_web_alpha_preview",
      "deploy_to_public_url",
      "connect_cloud_database",
      "apply_cloud_migrations",
      "enable_sync_push",
      "enable_sync_pull",
      "upload_workspace_data",
      "enable_file_presign",
      "enable_restore_writeback",
      "enable_ai_execution",
    ],
    excluded_payload_classes: input.handoffBundle.excluded_payload_classes,
  };
}

function buildDecisionQuestions(
  input: WebAlphaLaunchDecisionReceiptInput
): WebAlphaLaunchDecisionQuestion[] {
  const missingEnv =
    input.environmentPreflight?.summary.missing_required ?? null;

  return [
    {
      id: "continue-local-work",
      question: "Can ZhiNotes local work continue now?",
      answer: "yes",
      status: "go-local-only",
      evidence:
        "The local app, modules, export reports, and disabled Web Beta guards remain usable as the source of truth.",
      required_before_yes:
        "No cloud approval is needed for continued local-only development.",
    },
    {
      id: "share-web-alpha-preview",
      question: "Can a Web Alpha preview be shared now?",
      answer: "no",
      status: "no-go-preview",
      evidence: `${input.stageGate.summary.blocked} stage gates, ${input.nextActionPlan.summary.p0} P0 actions, ${input.handoffBundle.summary.owner_decisions} owner decisions, and ${input.handoffBundle.summary.blocked_smoke_cases} blocked smoke cases remain.`,
      required_before_yes:
        "Pass local verification, clear P0 blockers, complete owner preview decision, and keep cloud sync disabled by default.",
    },
    {
      id: "start-cloud-sync",
      question: "Can real cloud sync start now?",
      answer: "no",
      status: "no-go-cloud",
      evidence:
        "Cloud sync push/pull, remote baseline replay, permissions, audit events, private file storage, and rollback proof remain disabled or unproven.",
      required_before_yes:
        "Require owner confirmation, authenticated permissions, audit writes, payload preview, conflict review, private storage, rollback proof, and disposable replay evidence.",
    },
    {
      id: "configure-cloud-environment",
      question: "Are required cloud environment settings complete?",
      answer: missingEnv === 0 ? "yes" : "no",
      status: missingEnv === 0 ? "go-local-only" : "no-go-cloud",
      evidence:
        missingEnv === null
          ? "Environment preflight is unavailable."
          : `${input.environmentPreflight?.summary.present_required}/${input.environmentPreflight?.summary.required} required settings are present; secret values are not exposed.`,
      required_before_yes:
        "Configure required auth, database, storage, app URL, allowed origin, audit, and security variables before private beta.",
    },
  ];
}

function buildTopBlockers(
  input: WebAlphaLaunchDecisionReceiptInput
): WebAlphaLaunchDecisionBlocker[] {
  const blockedStages = input.stageGate.gates
    .filter((gate) => gate.status === "blocked")
    .slice(0, 4)
    .map((gate) => fromStageGate(gate));
  const p0Actions = input.nextActionPlan.actions
    .filter((action) => action.priority === "p0")
    .slice(0, 4)
    .map<WebAlphaLaunchDecisionBlocker>((action) => ({
      id: action.id,
      source: `next-action.${action.phase}`,
      title: action.title,
      priority: "p0",
      evidence: action.evidence,
      required_action: action.required_action,
    }));
  const ownerDecisions = input.handoffBundle.owner_decisions
    .slice(0, 3)
    .map<WebAlphaLaunchDecisionBlocker>((decision) => ({
      id: decision.id,
      source: `owner-decision.${decision.required_before}`,
      title: decision.question,
      priority: "owner",
      evidence: decision.rationale,
      required_action: `Owner decision required before ${decision.required_before}.`,
    }));

  return [...blockedStages, ...p0Actions, ...ownerDecisions].slice(0, 10);
}

function fromStageGate(
  gate: WebBetaStageGate
): WebAlphaLaunchDecisionBlocker {
  return {
    id: gate.id,
    source: `stage-gate.${gate.stage_type}`,
    title: gate.title,
    priority: "p0",
    evidence: gate.current_state,
    required_action: gate.next_action,
  };
}
