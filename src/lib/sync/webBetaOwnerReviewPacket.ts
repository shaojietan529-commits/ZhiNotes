import type { WebBetaEnvironmentPreflight } from "@/lib/sync/webBetaEnvironmentPreflight";
import type {
  WebBetaNextAction,
  WebBetaNextActionPlan,
  WebBetaNextActionPriority,
  WebBetaNextActionStatus,
} from "@/lib/sync/webBetaNextActions";
import type { WebBetaSmokeTestPlan } from "@/lib/sync/webBetaSmokeTestPlan";
import type { WebBetaStageGateReport } from "@/lib/sync/webBetaStageGate";

export type WebBetaOwnerReviewAnswer = "yes" | "no";
export type WebBetaOwnerReviewStatus =
  | "local-only"
  | "blocked"
  | "owner-review";

export interface WebBetaOwnerReviewPacketInput {
  stageGate: WebBetaStageGateReport;
  nextActionPlan: WebBetaNextActionPlan;
  smokeTestPlan: WebBetaSmokeTestPlan;
  environmentPreflight: WebBetaEnvironmentPreflight | null;
}

export interface WebBetaOwnerReviewQuestion {
  id: string;
  question: string;
  answer: WebBetaOwnerReviewAnswer;
  status: WebBetaOwnerReviewStatus;
  evidence: string;
  owner_prompt: string;
  required_before_go: string;
}

export interface WebBetaOwnerReviewBlocker {
  id: string;
  source: string;
  title: string;
  priority: WebBetaNextActionPriority;
  status: WebBetaNextActionStatus;
  evidence: string;
  required_action: string;
  verification_commands: string[];
  completion_evidence: string[];
  forbidden_until_confirmed: string[];
}

export interface WebBetaOwnerReviewLocalWorkItem {
  id: string;
  phase: WebBetaNextAction["phase"];
  title: string;
  priority: WebBetaNextActionPriority;
  status: WebBetaNextActionStatus;
  can_start_locally: true;
  verification_commands: string[];
  completion_evidence: string[];
}

export interface WebBetaOwnerReviewPacket {
  format: "zhinote-web-beta-owner-review-packet";
  format_version: 1;
  packet_status: "local-owner-review-only";
  launch_verdict: "not-ready";
  owner_review_status: "rehearsal-only";
  decision: "continue-local-build-no-beta";
  local_app_can_continue_now: true;
  web_beta_can_launch_now: false;
  cloud_sync_can_start_now: false;
  privacy_note: string;
  boundary: {
    local_packet_only: true;
    reads_stage_gate_metadata: true;
    reads_next_action_plan: true;
    reads_smoke_test_plan: true;
    reads_environment_metadata: true;
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_file_names: false;
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
    requires_owner_confirmation_before_web_beta: true;
    requires_owner_confirmation_before_cloud_sync: true;
  };
  summary: {
    review_questions: number;
    yes: number;
    no: number;
    p0_blockers: number;
    p1_actions: number;
    p2_actions: number;
    owner_decisions: number;
    local_first_ready: number;
    cloud_required: number;
    blocked_by_missing_cloud: number;
    missing_required_environment: number | null;
    blocked_stage_gates: number;
    p0_stage_blockers: number;
    blocked_smoke_cases: number;
    manual_smoke_cases: number;
    verification_commands: number;
    completion_evidence_required: number;
    forbidden_actions: number;
  };
  review_questions: WebBetaOwnerReviewQuestion[];
  p0_blockers: WebBetaOwnerReviewBlocker[];
  local_first_work: WebBetaOwnerReviewLocalWorkItem[];
  required_verification_commands: string[];
  completion_evidence_required: string[];
  forbidden_actions_before_owner_approval: string[];
  excluded_payload_classes: string[];
}

const OWNER_REVIEW_COMMANDS = [
  "npm run verify:web-beta:full",
  "npm run lint",
  "npm run verify:account",
  "npm run verify:module-workspaces",
  "npm run verify:web-beta",
  "npm run verify:web-beta:smoke",
  "npm run verify:route-smoke",
  "npm run verify:replay-harness",
  "npm run build",
];

const OWNER_FORBIDDEN_ACTIONS = [
  "share_web_beta_preview",
  "deploy_to_public_url",
  "connect_cloud_database",
  "apply_cloud_migrations",
  "enable_sync_push",
  "enable_sync_pull",
  "upload_workspace_data",
  "enable_file_presign",
  "enable_restore_writeback",
  "enable_ai_execution",
  "write_audit_events_to_cloud",
  "invite_external_users",
];

const EXCLUDED_PAYLOAD_CLASSES = [
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

export function buildWebBetaOwnerReviewPacket(
  input: WebBetaOwnerReviewPacketInput
): WebBetaOwnerReviewPacket {
  const reviewQuestions = buildReviewQuestions(input);
  const p0Blockers = buildP0Blockers(input.nextActionPlan);
  const localFirstWork = buildLocalFirstWork(input.nextActionPlan);
  const requiredVerificationCommands = buildRequiredVerificationCommands(input);
  const completionEvidenceRequired = buildCompletionEvidenceRequired(input);
  const forbiddenActions = buildForbiddenActions(input.nextActionPlan);
  const yes = reviewQuestions.filter((question) => question.answer === "yes")
    .length;
  const no = reviewQuestions.length - yes;

  return {
    format: "zhinote-web-beta-owner-review-packet",
    format_version: 1,
    packet_status: "local-owner-review-only",
    launch_verdict: "not-ready",
    owner_review_status: "rehearsal-only",
    decision: "continue-local-build-no-beta",
    local_app_can_continue_now: true,
    web_beta_can_launch_now: false,
    cloud_sync_can_start_now: false,
    privacy_note:
      "Generated locally from Web Beta stage gates, next actions, smoke test metadata, and environment presence status. This owner review packet is a rehearsal-only launch review artifact. It does not read page body text, database row values, file names, file bytes, secret values, holdings, trading plans, cloud data, AI prompts, tokens, or credentials; it does not deploy the app, create accounts, connect cloud services, upload workspace data, enable sync, or enable AI.",
    boundary: {
      local_packet_only: true,
      reads_stage_gate_metadata: true,
      reads_next_action_plan: true,
      reads_smoke_test_plan: true,
      reads_environment_metadata: true,
      reads_page_body_text: false,
      reads_database_row_values: false,
      reads_file_names: false,
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
      requires_owner_confirmation_before_web_beta: true,
      requires_owner_confirmation_before_cloud_sync: true,
    },
    summary: {
      review_questions: reviewQuestions.length,
      yes,
      no,
      p0_blockers: p0Blockers.length,
      p1_actions: input.nextActionPlan.summary.p1,
      p2_actions: input.nextActionPlan.summary.p2,
      owner_decisions: input.nextActionPlan.summary.needs_owner_decision,
      local_first_ready: localFirstWork.length,
      cloud_required: input.nextActionPlan.summary.cloud_required,
      blocked_by_missing_cloud:
        input.nextActionPlan.summary.blocked_by_missing_cloud,
      missing_required_environment:
        input.environmentPreflight?.summary.missing_required ?? null,
      blocked_stage_gates: input.stageGate.summary.blocked,
      p0_stage_blockers: input.stageGate.summary.p0_blockers,
      blocked_smoke_cases: input.smokeTestPlan.summary.blocked,
      manual_smoke_cases: input.smokeTestPlan.summary.manual,
      verification_commands: requiredVerificationCommands.length,
      completion_evidence_required: completionEvidenceRequired.length,
      forbidden_actions: forbiddenActions.length,
    },
    review_questions: reviewQuestions,
    p0_blockers: p0Blockers,
    local_first_work: localFirstWork,
    required_verification_commands: requiredVerificationCommands,
    completion_evidence_required: completionEvidenceRequired,
    forbidden_actions_before_owner_approval: forbiddenActions,
    excluded_payload_classes: EXCLUDED_PAYLOAD_CLASSES,
  };
}

function buildReviewQuestions(
  input: WebBetaOwnerReviewPacketInput
): WebBetaOwnerReviewQuestion[] {
  const missingEnvironment =
    input.environmentPreflight?.summary.missing_required ?? null;
  const environmentReady = missingEnvironment === 0;
  const p0Actions = input.nextActionPlan.summary.p0;

  return [
    {
      id: "continue-local-build",
      question: "Can local ZhiNotes work continue now?",
      answer: "yes",
      status: "local-only",
      evidence:
        "Local modules, exports, readiness reports, disabled API stubs, and verification scripts remain available without cloud writes.",
      owner_prompt:
        "Keep building locally while Web Beta blockers are cleared.",
      required_before_go:
        "No owner cloud approval is required for local-only development.",
    },
    {
      id: "launch-web-beta",
      question: "Can a private Web Beta launch now?",
      answer: "no",
      status: "blocked",
      evidence: `${input.stageGate.summary.p0_blockers} P0 stage blockers, ${p0Actions} P0 next actions, ${input.smokeTestPlan.summary.blocked} blocked smoke cases, and ${input.nextActionPlan.summary.needs_owner_decision} owner decisions remain.`,
      owner_prompt:
        "Do not share or promote a beta URL until P0/P1 evidence is complete.",
      required_before_go:
        "Clear P0/P1 blockers, run the verification command bundle, confirm rollback/support path, and record owner approval.",
    },
    {
      id: "start-cloud-sync",
      question: "Can real cloud sync start now?",
      answer: "no",
      status: "blocked",
      evidence:
        "Cloud sync push/pull, private file storage, server permissions, audit writes, replay proof, and rollback evidence remain disabled or incomplete.",
      owner_prompt:
        "Keep local workspace data as the source of truth until sync opt-in is explicitly approved.",
      required_before_go:
        "Require owner approval, server permission enforcement, audit writes, payload preview, conflict review, private storage, disposable replay, and rollback proof.",
    },
    {
      id: "environment-ready",
      question: "Are required cloud environment settings ready for review?",
      answer: environmentReady ? "yes" : "no",
      status: environmentReady ? "owner-review" : "blocked",
      evidence:
        missingEnvironment === null
          ? "No environment preflight output is loaded."
          : `${input.environmentPreflight?.summary.present_required}/${input.environmentPreflight?.summary.required} required environment settings are present; values are not exposed.`,
      owner_prompt:
        "Review environment presence only; never paste or export secret values.",
      required_before_go:
        "Auth, database, storage, app URL, allowed origin, audit, security, and rollback settings must pass presence-only preflight.",
    },
    {
      id: "owner-review-ready",
      question: "Is the owner go/no-go review ready to be made?",
      answer: "no",
      status: "owner-review",
      evidence: `${input.nextActionPlan.summary.verification_commands} distinct verification commands and ${input.nextActionPlan.summary.needs_owner_decision} owner-decision actions are still represented in the plan.`,
      owner_prompt:
        "Use this packet as a rehearsal checklist, not as launch approval.",
      required_before_go:
        "Attach verification output, completion evidence, support process, incident response, and final scope before changing this to a real go/no-go decision.",
    },
  ];
}

function buildP0Blockers(
  nextActionPlan: WebBetaNextActionPlan
): WebBetaOwnerReviewBlocker[] {
  return nextActionPlan.actions
    .filter((action) => action.priority === "p0")
    .map((action) => ({
      id: action.id,
      source: action.source,
      title: action.title,
      priority: action.priority,
      status: action.status,
      evidence: action.evidence,
      required_action: action.required_action,
      verification_commands: action.verification_commands,
      completion_evidence: action.completion_evidence,
      forbidden_until_confirmed: action.forbidden_until_confirmed,
    }));
}

function buildLocalFirstWork(
  nextActionPlan: WebBetaNextActionPlan
): WebBetaOwnerReviewLocalWorkItem[] {
  return nextActionPlan.actions
    .filter((action) => action.can_start_locally)
    .filter((action) => action.execution_path === "local-first")
    .slice(0, 6)
    .map((action) => ({
      id: action.id,
      phase: action.phase,
      title: action.title,
      priority: action.priority,
      status: action.status,
      can_start_locally: true,
      verification_commands: action.verification_commands,
      completion_evidence: action.completion_evidence,
    }));
}

function buildRequiredVerificationCommands(
  input: WebBetaOwnerReviewPacketInput
) {
  return unique([
    ...OWNER_REVIEW_COMMANDS,
    ...input.nextActionPlan.actions.flatMap(
      (action) => action.verification_commands
    ),
  ]);
}

function buildCompletionEvidenceRequired(
  input: WebBetaOwnerReviewPacketInput
) {
  const p0AndOwnerActions = input.nextActionPlan.actions.filter(
    (action) =>
      action.priority === "p0" || action.execution_path === "owner-decision"
  );

  return unique([
    ...p0AndOwnerActions.flatMap((action) => action.completion_evidence),
    ...input.smokeTestPlan.cases
      .filter((testCase) => testCase.status !== "ready-to-run")
      .map((testCase) => testCase.pass_condition),
  ]).slice(0, 18);
}

function buildForbiddenActions(nextActionPlan: WebBetaNextActionPlan) {
  return unique([
    ...OWNER_FORBIDDEN_ACTIONS,
    ...nextActionPlan.actions.flatMap(
      (action) => action.forbidden_until_confirmed
    ),
  ]);
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}
