#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

const files = {
  packageJson: "package.json",
  smokeTestPlan: "src/lib/sync/webBetaSmokeTestPlan.ts",
  syncShell: "src/components/modules/SyncShell.tsx",
  environmentPreflightRoute:
    "src/app/api/web-beta/environment-preflight/route.ts",
};

const requiredPageRoutes = [
  "src/app/page.tsx",
  "src/app/(workspace)/modules/page.tsx",
  "src/app/(workspace)/modules/sync/page.tsx",
  "src/app/(workspace)/modules/reports/page.tsx",
  "src/app/(workspace)/modules/company-research/page.tsx",
  "src/app/(workspace)/modules/ai/page.tsx",
  "src/app/(workspace)/modules/portfolio/page.tsx",
  "src/app/(workspace)/modules/meetings/page.tsx",
  "src/app/auth/callback/page.tsx",
];

const gatedOrDisabledApiRoutes = [
  {
    path: "src/app/api/auth/login/start/route.ts",
    guard: 'cloudNotConfiguredResponse("auth-login-start")',
  },
  {
    path: "src/app/api/auth/logout/route.ts",
    guard: 'cloudNotConfiguredResponse("auth-logout")',
  },
  {
    path: "src/app/api/auth/session/route.ts",
    guard: 'cloudNotConfiguredResponse("auth-session")',
  },
  {
    path: "src/app/api/workspaces/route.ts",
    guard: 'cloudNotConfiguredResponse("workspace-list")',
  },
  {
    path: "src/app/api/workspaces/[workspaceId]/bootstrap/route.ts",
    guard: 'cloudNotConfiguredResponse("workspace-bootstrap")',
  },
  {
    path: "src/app/api/sync/push/route.ts",
    guard: 'buildWebBetaApiStubResponse("sync-push")',
  },
  {
    path: "src/app/api/sync/pull/route.ts",
    guard: 'buildWebBetaApiStubResponse("sync-pull")',
  },
  {
    path: "src/app/api/files/presign/route.ts",
    guard: "buildFilePresignApiDisabledResponse",
  },
  {
    path: "src/app/api/permissions/check/route.ts",
    guard: "buildPermissionCheckApiDisabledResponse",
  },
  {
    path: "src/app/api/audit/events/route.ts",
    guard: "buildAuditEventsApiDisabledResponse",
  },
  {
    path: "src/app/api/backup/restore-apply/route.ts",
    guard: 'buildWebBetaApiStubResponse("restore-apply")',
  },
  {
    path: "src/app/api/ai/run/route.ts",
    guard: "buildAiRunDisabledResponse",
  },
];

const smokeCaseIds = [
  "local-verification-bundle",
  "route-contract-coverage",
  "sync-dashboard-preview",
  "auth-callback-empty-state",
  "cloud-alpha-disabled-defaults",
  "environment-preflight-secret-boundary",
  "supabase-disposable-project",
  "private-file-storage-remains-disabled",
  "cloudflare-edge-staging",
  "rollback-and-incident-path",
  "observability-privacy-check",
  "mobile-and-narrow-layout",
];

const requiredBoundarySnippets = [
  "local_plan_only: true",
  "runs_tests: false",
  "sends_network_requests: false",
  "deploys_app: false",
  "creates_accounts: false",
  "connects_cloud_services: false",
  "writes_server_data: false",
  "uploads_workspace_data: false",
  "reads_page_body_text: false",
  "reads_file_bytes: false",
  "exposes_secret_values: false",
  "requires_owner_confirmation_before_preview: true",
];

const failures = [];

function readProjectFile(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!existsSync(absolutePath)) {
    failures.push(`Missing file: ${relativePath}`);
    return "";
  }
  return readFileSync(absolutePath, "utf8");
}

function assertIncludes(sourceLabel, source, snippet, message) {
  if (!source.includes(snippet)) {
    failures.push(`${sourceLabel} missing ${snippet}: ${message}`);
  }
}

function assertFileExists(relativePath, message) {
  if (!existsSync(path.join(root, relativePath))) {
    failures.push(`${message}: ${relativePath}`);
  }
}

function run() {
  const packageJson = JSON.parse(readProjectFile(files.packageJson));
  const smokeTestPlan = readProjectFile(files.smokeTestPlan);
  const syncShell = readProjectFile(files.syncShell);
  const environmentPreflightRoute = readProjectFile(
    files.environmentPreflightRoute
  );

  const scripts = packageJson.scripts ?? {};
  for (const scriptName of [
    "lint",
    "build",
    "verify:web-beta",
    "verify:replay-harness",
  ]) {
    if (typeof scripts[scriptName] !== "string") {
      failures.push(`package.json missing script ${scriptName}`);
    }
  }

  for (const routeFile of requiredPageRoutes) {
    assertFileExists(routeFile, "Smoke route check missing page route");
  }

  for (const { path: routeFile, guard } of gatedOrDisabledApiRoutes) {
    const source = readProjectFile(routeFile);
    assertIncludes(
      routeFile,
      source,
      guard,
      "Smoke test requires high-risk API routes to stay disabled or cloud-gated by default."
    );
  }

  for (const smokeCaseId of smokeCaseIds) {
    assertIncludes(
      files.smokeTestPlan,
      smokeTestPlan,
      `id: "${smokeCaseId}"`,
      "Smoke test plan must keep every preview review case."
    );
  }

  for (const snippet of requiredBoundarySnippets) {
    assertIncludes(
      files.smokeTestPlan,
      smokeTestPlan,
      snippet,
      "Smoke test plan must preserve local-only privacy boundaries."
    );
  }

  assertIncludes(
    files.smokeTestPlan,
    smokeTestPlan,
    "npm run lint, npm run verify:web-beta, npm run verify:replay-harness, and npm run build all pass",
    "Smoke test plan must require the local verification bundle."
  );
  assertIncludes(
    files.smokeTestPlan,
    smokeTestPlan,
    "With cloud flags false",
    "Smoke test plan must explicitly verify disabled cloud defaults."
  );
  assertIncludes(
    files.smokeTestPlan,
    smokeTestPlan,
    "Do not upload HTML reports, PDFs, Excel, Word, PPT, notebooks, archives, or file bytes",
    "Smoke test plan must protect private file uploads."
  );
  assertIncludes(
    files.smokeTestPlan,
    smokeTestPlan,
    "Cloudflare cache bypass, auth callback redirects, TLS, WAF, rate limits, and rollback",
    "Smoke test plan must cover Cloudflare staging behavior."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "Smoke test plan",
    "Sync UI must render the smoke test plan panel."
  );
  assertIncludes(
    files.syncShell,
    syncShell,
    "Export smoke test plan",
    "Sync UI must expose smoke test plan export."
  );
  assertIncludes(
    files.environmentPreflightRoute,
    environmentPreflightRoute,
    "buildWebBetaEnvironmentPreflight",
    "Environment preflight route must keep presence-only checks wired."
  );

  const summary = {
    smoke_cases: smokeCaseIds.length,
    page_routes_checked: requiredPageRoutes.length,
    gated_or_disabled_api_routes_checked: gatedOrDisabledApiRoutes.length,
    boundary_checks: requiredBoundarySnippets.length,
  };

  if (failures.length > 0) {
    console.error("Web Beta smoke test verification failed");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("Web Beta smoke test verification passed");
  console.log(JSON.stringify(summary, null, 2));
}

run();
