import { WEB_BETA_API_STUBS } from "@/lib/sync/webBetaApiStubs";
import type { WebBetaApiStubId } from "@/lib/sync/webBetaApiStubs";
import type {
  WebBetaLaunchChecklist,
  WebBetaRouteCheck,
} from "@/lib/sync/webBetaLaunchChecklist";

export type WebBetaRoutePreflightStatus =
  | "covered"
  | "status-mismatch"
  | "missing";

export interface WebBetaExpectedRoute {
  method: WebBetaRouteCheck["method"];
  route: string;
  surface: WebBetaRouteCheck["surface"];
  expected_status: WebBetaRouteCheck["status"];
  required_action: string;
}

export interface WebBetaRoutePreflightCheck extends WebBetaExpectedRoute {
  id: string;
  preflight_status: WebBetaRoutePreflightStatus;
  actual_status: WebBetaRouteCheck["status"] | null;
  evidence: string;
  privacy_boundary: string;
}

export interface WebBetaRoutePreflightReport {
  format: "zhinote-web-beta-route-preflight";
  format_version: 1;
  preflight_status: "local-route-contract-only";
  launch_verdict: "not-ready";
  privacy_note: string;
  boundary: {
    local_contract_only: true;
    sends_network_requests: false;
    connects_cloud_services: false;
    creates_accounts: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    reads_page_body_text: false;
    reads_file_bytes: false;
  };
  summary: {
    expected_routes: number;
    covered: number;
    status_mismatch: number;
    missing: number;
    workspace_routes: number;
    module_routes: number;
    api_routes: number;
    local_routes: number;
    disabled_stubs: number;
    cloud_alpha_gated: number;
    environment_checks: number;
  };
  checks: WebBetaRoutePreflightCheck[];
}

const LOCAL_WORKSPACE_AND_MODULE_ROUTES: WebBetaExpectedRoute[] = [
  localRoute("/", "workspace", "Keep homepage loading locally."),
  localRoute("/modules", "module", "Verify module hub lists registered modules."),
  localRoute(
    "/modules/company-research",
    "module",
    "Verify company research module remains local-first."
  ),
  localRoute(
    "/modules/meetings",
    "module",
    "Verify meetings module does not join calls or publish notes."
  ),
  localRoute(
    "/modules/reports",
    "module",
    "Verify report module keeps file previews local."
  ),
  localRoute(
    "/modules/portfolio",
    "module",
    "Verify portfolio module does not connect brokers."
  ),
  localRoute(
    "/modules/research-graph",
    "module",
    "Verify research graph renders local relation coverage."
  ),
  localRoute(
    "/modules/ai",
    "module",
    "Verify AI module remains request staging only."
  ),
  localRoute(
    "/modules/sync",
    "module",
    "Verify Web Beta readiness dashboard renders launch gates."
  ),
];

const EXTRA_API_ROUTES: WebBetaExpectedRoute[] = [
  {
    method: "POST",
    route: "/api/ai/run",
    surface: "api",
    expected_status: "disabled-stub",
    required_action:
      "Keep disabled until provider, final payload preview, retention, permission, and audit gates are enabled.",
  },
  {
    method: "GET",
    route: "/api/web-beta/environment-preflight",
    surface: "api",
    expected_status: "local-route",
    required_action:
      "Return presence-only environment readiness without exposing secret values.",
  },
];

export function buildWebBetaRoutePreflightReport(
  launchChecklist: WebBetaLaunchChecklist
): WebBetaRoutePreflightReport {
  const expectedRoutes = [
    ...LOCAL_WORKSPACE_AND_MODULE_ROUTES,
    ...WEB_BETA_API_STUBS.map(stubToExpectedRoute),
    ...EXTRA_API_ROUTES,
  ];
  const checklistRoutes = new Map(
    launchChecklist.routes.map((item) => [routeKey(item), item])
  );
  const checks = expectedRoutes.map((expected) =>
    buildCheck(expected, checklistRoutes.get(routeKey(expected)) ?? null)
  );

  return {
    format: "zhinote-web-beta-route-preflight",
    format_version: 1,
    preflight_status: "local-route-contract-only",
    launch_verdict: "not-ready",
    privacy_note:
      "Generated locally from route contracts and launch checklist metadata. This preflight does not send network requests, connect cloud services, create accounts, write server data, upload workspace data, read page bodies, or read file bytes.",
    boundary: {
      local_contract_only: true,
      sends_network_requests: false,
      connects_cloud_services: false,
      creates_accounts: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      reads_page_body_text: false,
      reads_file_bytes: false,
    },
    summary: summarizeChecks(checks),
    checks,
  };
}

function localRoute(
  route: string,
  surface: WebBetaRouteCheck["surface"],
  requiredAction: string
): WebBetaExpectedRoute {
  return {
    method: "GET",
    route,
    surface,
    expected_status: "local-route",
    required_action: requiredAction,
  };
}

function stubToExpectedRoute(
  stub: (typeof WEB_BETA_API_STUBS)[number]
): WebBetaExpectedRoute {
  return {
    method: stub.method,
    route: stub.path,
    surface: "api" as const,
    expected_status: isCloudAlphaApiStub(stub.id)
      ? "cloud-alpha-gated"
      : "disabled-stub",
    required_action: stub.future_requirement,
  };
}

function buildCheck(
  expected: WebBetaExpectedRoute,
  actual: WebBetaRouteCheck | null
): WebBetaRoutePreflightCheck {
  const preflightStatus: WebBetaRoutePreflightStatus = !actual
    ? "missing"
    : actual.status === expected.expected_status
      ? "covered"
      : "status-mismatch";

  return {
    ...expected,
    id: routeKey(expected),
    preflight_status: preflightStatus,
    actual_status: actual?.status ?? null,
    evidence: actual
      ? `${expected.method} ${expected.route} is present in the launch checklist as ${actual.status}.`
      : `${expected.method} ${expected.route} is missing from the launch checklist.`,
    privacy_boundary:
      "Route preflight uses route names, methods, expected statuses, and launch checklist metadata only; it does not include private content or secrets.",
  };
}

function summarizeChecks(checks: WebBetaRoutePreflightCheck[]) {
  return {
    expected_routes: checks.length,
    covered: checks.filter((check) => check.preflight_status === "covered")
      .length,
    status_mismatch: checks.filter(
      (check) => check.preflight_status === "status-mismatch"
    ).length,
    missing: checks.filter((check) => check.preflight_status === "missing")
      .length,
    workspace_routes: checks.filter((check) => check.surface === "workspace")
      .length,
    module_routes: checks.filter((check) => check.surface === "module").length,
    api_routes: checks.filter((check) => check.surface === "api").length,
    local_routes: checks.filter(
      (check) => check.expected_status === "local-route"
    ).length,
    disabled_stubs: checks.filter(
      (check) => check.expected_status === "disabled-stub"
    ).length,
    cloud_alpha_gated: checks.filter(
      (check) => check.expected_status === "cloud-alpha-gated"
    ).length,
    environment_checks: checks.filter((check) =>
      check.route.includes("environment-preflight")
    ).length,
  };
}

function routeKey(route: Pick<WebBetaRouteCheck, "method" | "route">) {
  return `${route.method}:${route.route}`;
}

function isCloudAlphaApiStub(id: WebBetaApiStubId) {
  return (
    id === "auth-session" ||
    id === "auth-login-start" ||
    id === "auth-logout" ||
    id === "workspace-list" ||
    id === "workspace-create" ||
    id === "workspace-bootstrap"
  );
}
