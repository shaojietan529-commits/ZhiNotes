import type { WebBetaDeploymentTarget } from "@/lib/sync/webBetaDeploymentTarget";
import type { WebBetaEnvironmentPreflight } from "@/lib/sync/webBetaEnvironmentPreflight";
import type { WebBetaLaunchChecklist } from "@/lib/sync/webBetaLaunchChecklist";
import type { WebBetaNextActionPlan } from "@/lib/sync/webBetaNextActions";
import type { WebBetaRoutePreflightReport } from "@/lib/sync/webBetaRoutePreflight";
import type { WebBetaSmokeTestPlan } from "@/lib/sync/webBetaSmokeTestPlan";
import type { WebBetaStageGateReport } from "@/lib/sync/webBetaStageGate";

export type WebAlphaHandoffStatus =
  | "ready"
  | "partial"
  | "manual-confirmation"
  | "blocked";

export interface WebAlphaHandoffBundleInput {
  deploymentTarget: WebBetaDeploymentTarget;
  launchChecklist: WebBetaLaunchChecklist;
  routePreflight: WebBetaRoutePreflightReport;
  stageGate: WebBetaStageGateReport;
  smokeTestPlan: WebBetaSmokeTestPlan;
  nextActionPlan: WebBetaNextActionPlan;
  environmentPreflight: WebBetaEnvironmentPreflight | null;
}

export interface WebAlphaHandoffSourceReport {
  id: string;
  title: string;
  format: string;
  status: WebAlphaHandoffStatus;
  evidence: string;
}

export interface WebAlphaHandoffItem {
  id: string;
  title: string;
  status: WebAlphaHandoffStatus;
  evidence: string;
  owner_review: string;
  required_before_preview: string;
  source: string;
}

export interface WebAlphaHandoffCommand {
  id: string;
  command: string;
  status: "ready-to-run";
  required_before_preview: true;
  purpose: string;
  privacy_boundary: string;
}

export interface WebAlphaHandoffDecision {
  id: string;
  question: string;
  default_answer: "yes" | "no";
  required_before: "preview-share" | "cloud-write" | "cloud-sync";
  rationale: string;
}

export interface WebAlphaHandoffBundle {
  format: "zhinote-web-alpha-handoff-bundle";
  format_version: 1;
  bundle_status: "local-handoff-bundle-only";
  release_verdict: "not-ready";
  local_app_can_continue_now: true;
  web_alpha_can_be_shared_now: false;
  cloud_sync_can_start_now: false;
  privacy_note: string;
  boundary: {
    local_bundle_only: true;
    reads_launch_contracts: true;
    reads_route_contracts: true;
    reads_smoke_test_plan: true;
    reads_environment_metadata: true;
    reads_next_action_plan: true;
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_file_bytes: false;
    reads_secret_values: false;
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
  target: {
    app_host: WebBetaDeploymentTarget["selected_strategy"]["first_web_alpha"];
    cloud_backend: WebBetaDeploymentTarget["selected_strategy"]["cloud_backend"];
    edge_layer: WebBetaDeploymentTarget["selected_strategy"]["edge_layer"];
  };
  summary: {
    source_reports: number;
    handoff_items: number;
    commands: number;
    decisions: number;
    ready: number;
    partial: number;
    manual_confirmation: number;
    blocked: number;
    p0_actions: number;
    p1_actions: number;
    owner_decisions: number;
    route_gaps: number;
    smoke_cases: number;
    blocked_smoke_cases: number;
    missing_required_environment: number | null;
  };
  source_reports: WebAlphaHandoffSourceReport[];
  handoff_items: WebAlphaHandoffItem[];
  command_bundle: WebAlphaHandoffCommand[];
  owner_decisions: WebAlphaHandoffDecision[];
  excluded_payload_classes: string[];
}

export function buildWebAlphaHandoffBundle(
  input: WebAlphaHandoffBundleInput
): WebAlphaHandoffBundle {
  const sourceReports = buildSourceReports(input);
  const handoffItems = buildHandoffItems(input);
  const commandBundle = buildCommandBundle();
  const ownerDecisions = buildOwnerDecisions();

  return {
    format: "zhinote-web-alpha-handoff-bundle",
    format_version: 1,
    bundle_status: "local-handoff-bundle-only",
    release_verdict: "not-ready",
    local_app_can_continue_now: true,
    web_alpha_can_be_shared_now: false,
    cloud_sync_can_start_now: false,
    privacy_note:
      "Generated locally from Web Beta readiness reports, launch contracts, route preflight, smoke test plan, and next actions. This bundle is a handoff summary only. It does not read page body text, database row values, file bytes, secret values, holdings, trading plans, cloud data, AI prompts, tokens, or credentials; it does not deploy the app, create accounts, connect cloud services, write server data, upload workspace data, enable sync, or enable AI.",
    boundary: {
      local_bundle_only: true,
      reads_launch_contracts: true,
      reads_route_contracts: true,
      reads_smoke_test_plan: true,
      reads_environment_metadata: true,
      reads_next_action_plan: true,
      reads_page_body_text: false,
      reads_database_row_values: false,
      reads_file_bytes: false,
      reads_secret_values: false,
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
    target: {
      app_host: input.deploymentTarget.selected_strategy.first_web_alpha,
      cloud_backend: input.deploymentTarget.selected_strategy.cloud_backend,
      edge_layer: input.deploymentTarget.selected_strategy.edge_layer,
    },
    summary: summarizeBundle(input, sourceReports, handoffItems),
    source_reports: sourceReports,
    handoff_items: handoffItems,
    command_bundle: commandBundle,
    owner_decisions: ownerDecisions,
    excluded_payload_classes: [
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
    ],
  };
}

function buildSourceReports(
  input: WebAlphaHandoffBundleInput
): WebAlphaHandoffSourceReport[] {
  const routeGaps =
    input.routePreflight.summary.missing +
    input.routePreflight.summary.status_mismatch;

  return [
    {
      id: "stage-gate",
      title: "Web Beta stage gate",
      format: input.stageGate.format,
      status: input.stageGate.summary.blocked > 0 ? "blocked" : "partial",
      evidence: `${input.stageGate.summary.stages} stage gates, ${input.stageGate.summary.blocked} blocked, ${input.stageGate.summary.p0_blockers} P0 blockers.`,
    },
    {
      id: "launch-checklist",
      title: "Web Beta launch checklist",
      format: input.launchChecklist.format,
      status: input.launchChecklist.summary.blocked > 0 ? "blocked" : "partial",
      evidence: `${input.launchChecklist.summary.tracks} launch tracks and ${input.launchChecklist.summary.blocked} blocked tracks.`,
    },
    {
      id: "deployment-target",
      title: "Deployment target",
      format: input.deploymentTarget.format,
      status: input.deploymentTarget.summary.blocked > 0 ? "blocked" : "partial",
      evidence: `${input.deploymentTarget.selected_strategy.first_web_alpha} + ${input.deploymentTarget.selected_strategy.cloud_backend}; ${input.deploymentTarget.summary.blocked} deployment items blocked.`,
    },
    {
      id: "route-preflight",
      title: "Route and API preflight",
      format: input.routePreflight.format,
      status: routeGaps > 0 ? "blocked" : "ready",
      evidence: `${input.routePreflight.summary.covered}/${input.routePreflight.summary.expected_routes} expected routes covered; ${routeGaps} gaps.`,
    },
    {
      id: "smoke-test-plan",
      title: "Smoke test plan",
      format: input.smokeTestPlan.format,
      status: input.smokeTestPlan.summary.blocked > 0 ? "blocked" : "partial",
      evidence: `${input.smokeTestPlan.summary.cases} smoke cases; ${input.smokeTestPlan.summary.blocked} blocked cases.`,
    },
    {
      id: "next-actions",
      title: "Web Beta next actions",
      format: input.nextActionPlan.format,
      status: input.nextActionPlan.summary.p0 > 0 ? "partial" : "ready",
      evidence: `${input.nextActionPlan.summary.actions} next actions; ${input.nextActionPlan.summary.p0} P0 and ${input.nextActionPlan.summary.needs_owner_decision} owner decisions.`,
    },
    {
      id: "environment-preflight",
      title: "Environment preflight",
      format: input.environmentPreflight?.format ?? "not-loaded",
      status:
        input.environmentPreflight?.summary.missing_required === 0
          ? "ready"
          : "blocked",
      evidence: input.environmentPreflight
        ? `${input.environmentPreflight.summary.present_required}/${input.environmentPreflight.summary.required} required environment settings present; values are not exposed.`
        : "Environment preflight is not loaded.",
    },
  ];
}

function buildHandoffItems(
  input: WebAlphaHandoffBundleInput
): WebAlphaHandoffItem[] {
  const routeGaps =
    input.routePreflight.summary.missing +
    input.routePreflight.summary.status_mismatch;
  const missingEnv = input.environmentPreflight?.summary.missing_required ?? null;

  return [
    {
      id: "local-app-continuation",
      title: "Continue local-first product work",
      status: "ready",
      evidence:
        "Stage gate says local_app_can_continue_now is true; local notes, modules, backups, and planning reports remain usable.",
      owner_review:
        "No owner approval is needed for continued local-only development.",
      required_before_preview:
        "Keep local data as source of truth until preview, auth, and rollback gates pass.",
      source: "stage-gate.local-workbench",
    },
    {
      id: "private-preview-share",
      title: "Share a private Web Alpha preview",
      status:
        input.stageGate.summary.p0_blockers > 0 || routeGaps > 0
          ? "blocked"
          : "manual-confirmation",
      evidence: `${input.stageGate.summary.p0_blockers} P0 blockers and ${routeGaps} route gaps remain.`,
      owner_review:
        "Owner must approve preview scope, allowed users, disabled cloud writes, and rollback path before sharing any hosted URL.",
      required_before_preview:
        "Run command bundle, review route preflight, review smoke plan, and confirm cloud writes remain disabled.",
      source: "stage-gate + route-preflight + smoke-test-plan",
    },
    {
      id: "environment-and-secrets",
      title: "Configure production-like environment",
      status: missingEnv === 0 ? "manual-confirmation" : "blocked",
      evidence:
        missingEnv === null
          ? "Environment preflight has not loaded."
          : `${missingEnv} required environment settings are missing.`,
      owner_review:
        "Owner must configure environment values in the provider UI without pasting secrets into ZhiNotes exports.",
      required_before_preview:
        "Environment preflight must show required settings present while still returning presence-only output.",
      source: "environment-preflight",
    },
    {
      id: "disabled-cloud-defaults",
      title: "Keep cloud write defaults disabled",
      status: "partial",
      evidence: `${input.launchChecklist.local_evidence.disabled_api_stubs} guarded or disabled API stubs are included in launch evidence.`,
      owner_review:
        "Before preview, confirm auth, workspace, sync, file presign, audit, permission, restore apply, and AI routes cannot transmit private workspace data by default.",
      required_before_preview:
        "Cloud write flags stay off; disabled routes return metadata-only guarded responses.",
      source: "launch-checklist + web-beta-api-stubs",
    },
    {
      id: "local-verification-commands",
      title: "Run local verification command bundle",
      status: "ready",
      evidence:
        "Smoke test plan requires lint, verify:web-beta, verify:replay-harness, and production build before preview review.",
      owner_review:
        "Review command output before sharing a preview URL or changing cloud flags.",
      required_before_preview:
        "All command bundle checks pass on the deployment branch.",
      source: "smoke-test-plan.local-verification-bundle",
    },
    {
      id: "p0-build-scope",
      title: "Clear P0 Web Beta build scope",
      status: input.nextActionPlan.summary.p0 > 0 ? "blocked" : "partial",
      evidence: `${input.nextActionPlan.summary.p0} P0 actions and ${input.nextActionPlan.summary.p1} P1 actions remain in the local next-action plan.`,
      owner_review:
        "Use P0/P1 actions as the build queue before declaring Web Alpha shareable.",
      required_before_preview:
        "At minimum, account/session, environment, migrations, server permissions, and private file storage blockers are resolved or explicitly scoped out.",
      source: "web-beta-next-actions",
    },
    {
      id: "cloud-sync-boundary",
      title: "Do not start cloud sync from this bundle",
      status: "blocked",
      evidence:
        "Stage gate keeps cloud_sync_can_start_now false and sync push/pull remain disabled until payload, permission, conflict, audit, remote baseline, storage, and rollback gates pass.",
      owner_review:
        "Cloud sync requires a separate owner confirmation with payload preview and destination summary.",
      required_before_preview:
        "No local pages, files, databases, backups, or sync queue rows are uploaded during handoff review.",
      source: "stage-gate.sync-push-pull",
    },
    {
      id: "owner-go-no-go",
      title: "Owner go/no-go decision",
      status: "manual-confirmation",
      evidence:
        "The handoff bundle can summarize current readiness, but launch remains not-ready until blocked gates are resolved and owner review is complete.",
      owner_review:
        "Owner must approve preview audience, data boundary, rollback owner, support path, and residual risk.",
      required_before_preview:
        "Record explicit go/no-go after evidence is reviewed.",
      source: "stage-gate.owner-beta-decision",
    },
  ];
}

function buildCommandBundle(): WebAlphaHandoffCommand[] {
  return [
    command(
      "lint",
      "npm run lint",
      "Catch TypeScript/React/ESLint issues before preview review."
    ),
    command(
      "verify-web-beta",
      "npm run verify:web-beta",
      "Check Web Beta contracts, guarded routes, migrations, and Sync UI wiring."
    ),
    command(
      "verify-web-beta-smoke",
      "npm run verify:web-beta:smoke",
      "Check preview smoke-plan coverage and disabled high-risk API defaults."
    ),
    command(
      "verify-replay-harness",
      "npm run verify:replay-harness",
      "Prove disposable replay harness stays disabled and empty-fixture only."
    ),
    command(
      "production-build",
      "npm run build",
      "Create the optimized Next.js build before any preview deployment review."
    ),
  ];
}

function buildOwnerDecisions(): WebAlphaHandoffDecision[] {
  return [
    {
      id: "share-private-preview",
      question: "Can a private Web Alpha preview URL be shared?",
      default_answer: "no",
      required_before: "preview-share",
      rationale:
        "Preview sharing needs command checks, route smoke review, disabled cloud writes, rollback path, and owner approval.",
    },
    {
      id: "enable-cloud-writes",
      question: "Can cloud write flags be enabled?",
      default_answer: "no",
      required_before: "cloud-write",
      rationale:
        "Cloud writes need auth/session, permissions, audit events, environment, rollback, and disposable replay proof.",
    },
    {
      id: "start-cloud-sync",
      question: "Can local workspace sync start?",
      default_answer: "no",
      required_before: "cloud-sync",
      rationale:
        "Cloud sync can transmit private research content later, so it needs a separate payload preview, destination summary, and typed confirmation.",
    },
    {
      id: "upload-private-files",
      question: "Can reports and Office/PDF files be uploaded?",
      default_answer: "no",
      required_before: "cloud-sync",
      rationale:
        "File upload requires private buckets, signed URL expiry, checksums, file audit events, permissions, and owner confirmation.",
    },
  ];
}

function summarizeBundle(
  input: WebAlphaHandoffBundleInput,
  sourceReports: WebAlphaHandoffSourceReport[],
  handoffItems: WebAlphaHandoffItem[]
) {
  const rows = [...sourceReports, ...handoffItems];

  return {
    source_reports: sourceReports.length,
    handoff_items: handoffItems.length,
    commands: 5,
    decisions: 4,
    ready: rows.filter((row) => row.status === "ready").length,
    partial: rows.filter((row) => row.status === "partial").length,
    manual_confirmation: rows.filter(
      (row) => row.status === "manual-confirmation"
    ).length,
    blocked: rows.filter((row) => row.status === "blocked").length,
    p0_actions: input.nextActionPlan.summary.p0,
    p1_actions: input.nextActionPlan.summary.p1,
    owner_decisions: input.nextActionPlan.summary.needs_owner_decision,
    route_gaps:
      input.routePreflight.summary.missing +
      input.routePreflight.summary.status_mismatch,
    smoke_cases: input.smokeTestPlan.summary.cases,
    blocked_smoke_cases: input.smokeTestPlan.summary.blocked,
    missing_required_environment:
      input.environmentPreflight?.summary.missing_required ?? null,
  };
}

function command(
  id: string,
  commandText: string,
  purpose: string
): WebAlphaHandoffCommand {
  return {
    id,
    command: commandText,
    status: "ready-to-run",
    required_before_preview: true,
    purpose,
    privacy_boundary:
      "Runs against code and local contract metadata only; it must not read private note text, file bytes, secrets, or cloud data.",
  };
}
