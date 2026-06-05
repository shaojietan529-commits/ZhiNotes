import type { WebBetaDeploymentTarget } from "@/lib/sync/webBetaDeploymentTarget";
import type { WebBetaEnvironmentPreflight } from "@/lib/sync/webBetaEnvironmentPreflight";
import type { WebBetaReadinessReport } from "@/lib/sync/webBetaReadiness";
import type { WebBetaRoutePreflightReport } from "@/lib/sync/webBetaRoutePreflight";

export type WebBetaSmokeTestPhase =
  | "pre-deploy"
  | "preview-routes"
  | "auth"
  | "cloud-metadata"
  | "data-safety"
  | "rollback"
  | "observability";

export type WebBetaSmokeTestMode = "automated" | "manual";
export type WebBetaSmokeTestStatus =
  | "ready-to-run"
  | "manual-confirmation"
  | "blocked";

export interface WebBetaSmokeTestPlanInput {
  deploymentTarget: WebBetaDeploymentTarget;
  routePreflight: WebBetaRoutePreflightReport;
  readinessReport: WebBetaReadinessReport;
  environmentPreflight: WebBetaEnvironmentPreflight | null;
}

export interface WebBetaSmokeTestCase {
  id: string;
  phase: WebBetaSmokeTestPhase;
  mode: WebBetaSmokeTestMode;
  status: WebBetaSmokeTestStatus;
  title: string;
  evidence: string;
  pass_condition: string;
  failure_response: string;
  privacy_boundary: string;
}

export interface WebBetaSmokeTestPlan {
  format: "zhinote-web-beta-smoke-test-plan";
  format_version: 1;
  plan_status: "local-smoke-test-plan-only";
  launch_verdict: "not-ready";
  privacy_note: string;
  boundary: {
    local_plan_only: true;
    runs_tests: false;
    sends_network_requests: false;
    deploys_app: false;
    creates_accounts: false;
    connects_cloud_services: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    reads_page_body_text: false;
    reads_file_bytes: false;
    exposes_secret_values: false;
    requires_owner_confirmation_before_preview: true;
  };
  target: {
    app_host: WebBetaDeploymentTarget["selected_strategy"]["first_web_alpha"];
    cloud_backend: WebBetaDeploymentTarget["selected_strategy"]["cloud_backend"];
    edge_layer: WebBetaDeploymentTarget["selected_strategy"]["edge_layer"];
  };
  summary: {
    cases: number;
    automated: number;
    manual: number;
    ready_to_run: number;
    manual_confirmation: number;
    blocked: number;
    route_preflight_missing: number;
    route_preflight_status_mismatch: number;
    missing_required_environment: number | null;
    blocked_readiness_gates: number;
    blocked_deployment_items: number;
  };
  cases: WebBetaSmokeTestCase[];
}

export function buildWebBetaSmokeTestPlan(
  input: WebBetaSmokeTestPlanInput
): WebBetaSmokeTestPlan {
  const cases = buildSmokeTestCases(input);

  return {
    format: "zhinote-web-beta-smoke-test-plan",
    format_version: 1,
    plan_status: "local-smoke-test-plan-only",
    launch_verdict: "not-ready",
    privacy_note:
      "Generated locally. This smoke test plan does not run tests, send network requests, deploy the app, create accounts, connect cloud services, write server data, upload workspace data, read page bodies, read file bytes, or expose secret values.",
    boundary: {
      local_plan_only: true,
      runs_tests: false,
      sends_network_requests: false,
      deploys_app: false,
      creates_accounts: false,
      connects_cloud_services: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      reads_page_body_text: false,
      reads_file_bytes: false,
      exposes_secret_values: false,
      requires_owner_confirmation_before_preview: true,
    },
    target: {
      app_host: input.deploymentTarget.selected_strategy.first_web_alpha,
      cloud_backend: input.deploymentTarget.selected_strategy.cloud_backend,
      edge_layer: input.deploymentTarget.selected_strategy.edge_layer,
    },
    summary: summarizeSmokeTests(input, cases),
    cases,
  };
}

function buildSmokeTestCases(
  input: WebBetaSmokeTestPlanInput
): WebBetaSmokeTestCase[] {
  const routesCovered =
    input.routePreflight.summary.missing === 0 &&
    input.routePreflight.summary.status_mismatch === 0;
  const requiredEnvMissing =
    input.environmentPreflight?.summary.missing_required ?? null;
  const envReady = requiredEnvMissing === 0;
  const blockedDeploymentItems = input.deploymentTarget.summary.blocked;

  return [
    {
      id: "local-verification-bundle",
      phase: "pre-deploy",
      mode: "automated",
      status: "ready-to-run",
      title: "Local verification bundle",
      evidence:
        "Run lint, verify:web-beta, verify:replay-harness, and production build before any preview deployment is reviewed; verify:web-beta checks the audit event envelope, permission check envelope, permission request validator fixtures, server permission test matrix, server permission readiness report, and replay harness verification checks the disabled runner skeleton.",
      pass_condition:
        "npm run lint, npm run verify:web-beta, npm run verify:replay-harness, and npm run build all pass on the deployment branch.",
      failure_response:
        "Do not create or promote a preview deployment until the failing command is fixed and rerun.",
      privacy_boundary:
        "Commands inspect code and local contracts only; they must not read private note text, file bytes, secrets, or cloud data.",
    },
    {
      id: "route-contract-coverage",
      phase: "pre-deploy",
      mode: "automated",
      status: routesCovered ? "ready-to-run" : "blocked",
      title: "Route contract coverage",
      evidence: `${input.routePreflight.summary.covered}/${input.routePreflight.summary.expected_routes} expected routes are covered; ${input.routePreflight.summary.missing} missing and ${input.routePreflight.summary.status_mismatch} mismatched.`,
      pass_condition:
        "Every workspace page, module page, disabled API stub, Cloud Alpha metadata route, and environment preflight route matches the route preflight contract.",
      failure_response:
        "Fix missing or mismatched routes before preview deployment review.",
      privacy_boundary:
        "Route checks use route names and expected statuses only; they must not include page bodies, database rows, files, tokens, or secrets.",
    },
    {
      id: "sync-dashboard-preview",
      phase: "preview-routes",
      mode: "manual",
      status: "ready-to-run",
      title: "Sync dashboard preview",
      evidence:
        "The Sync dashboard is the owner-facing control room for Web Beta readiness, deployment target, route preflight, and next actions.",
      pass_condition:
        "Open /modules/sync on the preview URL and confirm readiness, deployment target, launch checklist, route preflight, smoke test plan, and next actions render without console errors.",
      failure_response:
        "Treat the preview as failed; fix the panel render path before any cloud enable flags are changed.",
      privacy_boundary:
        "Manual review checks visible contract metadata only and must not upload or paste private workspace content.",
    },
    {
      id: "auth-callback-empty-state",
      phase: "auth",
      mode: "manual",
      status: "ready-to-run",
      title: "Auth callback empty state",
      evidence:
        "/auth/callback exists as a local route and must handle empty or invalid callback state without leaking tokens.",
      pass_condition:
        "Open /auth/callback without a token and confirm it returns to a safe local state without exposing token fragments or errors with secret values.",
      failure_response:
        "Do not enable Supabase redirects until empty, invalid, and successful callback states are verified.",
      privacy_boundary:
        "The check must use empty or disposable auth state only, not a personal production account token.",
    },
    {
      id: "cloud-alpha-disabled-defaults",
      phase: "cloud-metadata",
      mode: "manual",
      status: "ready-to-run",
      title: "Cloud Alpha disabled defaults",
      evidence:
        "Cloud Alpha controls are guarded by environment and write flags; local pages and files remain in the browser.",
      pass_condition:
        "With cloud flags false, login, workspace create, bootstrap, sync push, file presign, audit, permissions, and restore write-back stay disabled or return safe gated responses.",
      failure_response:
        "Stop preview review and restore disabled defaults before sharing the preview URL.",
      privacy_boundary:
        "Disabled-state checks must not send email addresses, workspace data, file bytes, note text, or database rows to Supabase.",
    },
    {
      id: "environment-preflight-secret-boundary",
      phase: "pre-deploy",
      mode: "automated",
      status: input.environmentPreflight ? "ready-to-run" : "blocked",
      title: "Environment preflight secret boundary",
      evidence: input.environmentPreflight
        ? `${input.environmentPreflight.summary.present_required}/${input.environmentPreflight.summary.required} required environment settings are present in presence-only output.`
        : "No environment preflight output is loaded.",
      pass_condition:
        "The environment preflight endpoint returns present/missing status only and never returns Supabase keys, DSNs, tokens, URLs with user state, cookies, or connection strings.",
      failure_response:
        "Remove secret-bearing fields from responses and exports before preview deployment continues.",
      privacy_boundary:
        "Presence checks may mention key names but must never expose values.",
    },
    {
      id: "supabase-disposable-project",
      phase: "cloud-metadata",
      mode: "manual",
      status: envReady ? "manual-confirmation" : "blocked",
      title: "Supabase disposable project smoke",
      evidence: envReady
        ? "Required environment settings are present, but disposable project replay still needs owner review."
        : requiredEnvMissing === null
          ? "Environment preflight has not loaded, so disposable project replay cannot start."
          : `${requiredEnvMissing} required environment settings are missing.`,
      pass_condition:
        "On a disposable Supabase project, migrations, RLS, magic-link login, workspace create, workspace list, and bootstrap work without uploading local notes or files.",
      failure_response:
        "Delete disposable test data, keep production cloud writes disabled, and fix migration/auth/bootstrap issues.",
      privacy_boundary:
        "Use disposable accounts and empty workspaces only; do not upload private research content, holdings, files, or database rows.",
    },
    {
      id: "private-file-storage-remains-disabled",
      phase: "data-safety",
      mode: "manual",
      status: "blocked",
      title: "Private file storage remains disabled",
      evidence:
        "Private storage policy, signed URL expiry, upload size limits, checksums, and file audit events are not fully implemented.",
      pass_condition:
        "Preview review confirms file sync and presign routes stay disabled until private bucket policy and audit gates are proven.",
      failure_response:
        "Disable file routes and remove any public storage configuration before continuing.",
      privacy_boundary:
        "Do not upload HTML reports, PDFs, Excel, Word, PPT, notebooks, archives, or file bytes during this smoke test.",
    },
    {
      id: "cloudflare-edge-staging",
      phase: "preview-routes",
      mode: "manual",
      status: "manual-confirmation",
      title: "Cloudflare edge staging",
      evidence:
        "Cloudflare is currently planned as DNS/CDN/WAF, not the first app runtime.",
      pass_condition:
        "On a staging domain, Cloudflare cache bypass, auth callback redirects, TLS, WAF, rate limits, and rollback are confirmed without changing the app runtime.",
      failure_response:
        "Keep DNS pointed at the stable provider and do not enable Cloudflare proxying for production.",
      privacy_boundary:
        "Edge logs and security events must avoid note text, file bytes, prompt text, signed URLs, tokens, and secret values.",
    },
    {
      id: "rollback-and-incident-path",
      phase: "rollback",
      mode: "manual",
      status: blockedDeploymentItems > 0 ? "blocked" : "manual-confirmation",
      title: "Rollback and incident path",
      evidence: `${blockedDeploymentItems} deployment target items are still blocked.`,
      pass_condition:
        "Preview rollback, database migration rollback, Cloudflare rollback, incident owner, support message, and local export escape hatch are all documented and tested.",
      failure_response:
        "Do not promote the preview to private beta until rollback steps are proven end to end.",
      privacy_boundary:
        "Incident notes should cite route/status/timestamp metadata only, not private note bodies, holdings, files, prompts, or secrets.",
    },
    {
      id: "observability-privacy-check",
      phase: "observability",
      mode: "manual",
      status: "blocked",
      title: "Observability privacy check",
      evidence:
        "Audit policy exists locally, but live error monitoring, uptime checks, and server audit writes are not fully enabled.",
      pass_condition:
        "Error monitoring, uptime checks, audit retention, redaction, and owner-only audit export work without collecting private research payloads.",
      failure_response:
        "Disable monitoring sinks or reduce sampled fields before preview review continues.",
      privacy_boundary:
        "Monitoring and audit rows must exclude page bodies, file bytes, prompt text, signed URLs, tokens, and secret values.",
    },
    {
      id: "mobile-and-narrow-layout",
      phase: "preview-routes",
      mode: "manual",
      status: "ready-to-run",
      title: "Mobile and narrow layout smoke",
      evidence:
        "The platform is browser-based and must remain usable in narrow desktop and mobile review surfaces.",
      pass_condition:
        "Open /modules, /modules/sync, /modules/projects, /modules/reports, /modules/company-research, and a page route at narrow width and confirm controls do not overlap.",
      failure_response:
        "Fix layout overflow before inviting beta testers to the preview URL.",
      privacy_boundary:
        "Use empty or sample local workspace data for layout review.",
    },
  ];
}

function summarizeSmokeTests(
  input: WebBetaSmokeTestPlanInput,
  cases: WebBetaSmokeTestCase[]
) {
  return {
    cases: cases.length,
    automated: cases.filter((testCase) => testCase.mode === "automated")
      .length,
    manual: cases.filter((testCase) => testCase.mode === "manual").length,
    ready_to_run: cases.filter(
      (testCase) => testCase.status === "ready-to-run"
    ).length,
    manual_confirmation: cases.filter(
      (testCase) => testCase.status === "manual-confirmation"
    ).length,
    blocked: cases.filter((testCase) => testCase.status === "blocked").length,
    route_preflight_missing: input.routePreflight.summary.missing,
    route_preflight_status_mismatch:
      input.routePreflight.summary.status_mismatch,
    missing_required_environment:
      input.environmentPreflight?.summary.missing_required ?? null,
    blocked_readiness_gates: input.readinessReport.summary.blocked,
    blocked_deployment_items: input.deploymentTarget.summary.blocked,
  };
}
