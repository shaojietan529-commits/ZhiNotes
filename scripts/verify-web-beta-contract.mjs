#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

const files = {
  envExample: ".env.example",
  apiStubs: "src/lib/sync/webBetaApiStubs.ts",
  contract: "src/lib/sync/webBetaContract.ts",
  deploymentTarget: "src/lib/sync/webBetaDeploymentTarget.ts",
  smokeTestPlan: "src/lib/sync/webBetaSmokeTestPlan.ts",
  smokeTestVerifier: "scripts/verify-web-beta-smoke-tests.mjs",
  environmentPreflight: "src/lib/sync/webBetaEnvironmentPreflight.ts",
  launchChecklist: "src/lib/sync/webBetaLaunchChecklist.ts",
  routePreflight: "src/lib/sync/webBetaRoutePreflight.ts",
  conflictResolution: "src/lib/sync/syncConflictResolution.ts",
  remoteBaselineRequest: "src/lib/sync/remoteBaselineRequest.ts",
  remoteBaselineStaging: "src/lib/sync/remoteBaselineStaging.ts",
  syncOptInGate: "src/lib/sync/syncOptInGate.ts",
  workspaceIdentity: "src/lib/sync/workspaceIdentity.ts",
  accountSessionBoundary: "src/lib/security/accountSessionBoundary.ts",
  webBetaReadiness: "src/lib/sync/webBetaReadiness.ts",
  syncShell: "src/components/modules/SyncShell.tsx",
  migration: "supabase/migrations/0001_zhinotes_cloud_foundation.sql",
};

const failures = [];
const warnings = [];
const contractTablePhysicalTables = {
  comments: ["page_comments", "block_comments"],
};

function readProjectFile(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!existsSync(absolutePath)) {
    failures.push(`Missing file: ${relativePath}`);
    return "";
  }
  return readFileSync(absolutePath, "utf8");
}

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function unique(values) {
  return [...new Set(values)];
}

function extractQuotedValues(source, propertyName) {
  const pattern = new RegExp(`${propertyName}:\\s*"([^"]+)"`, "g");
  return unique([...source.matchAll(pattern)].map((match) => match[1]));
}

function extractEnvExampleKeys(source) {
  return unique(
    source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => line.split("=")[0]?.trim())
      .filter(Boolean)
  );
}

function extractApiStubs(source) {
  const entries = [];
  const entryPattern = /\{\s*id:\s*"([^"]+)"[\s\S]*?method:\s*"([^"]+)"[\s\S]*?path:\s*"([^"]+)"/g;
  let match;

  while ((match = entryPattern.exec(source))) {
    entries.push({
      id: match[1],
      method: match[2],
      path: match[3],
    });
  }

  return entries;
}

function extractRouteCalls(source) {
  const routePattern =
    /route\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"/g;
  return [...source.matchAll(routePattern)].map((match) => ({
    method: match[1],
    route: match[2],
    surface: match[3],
    status: match[4],
  }));
}

function normalizeRoutePath(routePath) {
  return routePath.split("?")[0].replace(/:([A-Za-z0-9_]+)/g, "[$1]");
}

function routeFileForApiPath(apiPath) {
  return path.join("src/app", normalizeRoutePath(apiPath), "route.ts");
}

function routeFileForPagePath(pagePath) {
  if (pagePath === "/") return "src/app/page.tsx";
  return path.join("src/app/(workspace)", pagePath, "page.tsx");
}

function assertRouteExport(routeFile, method, routeLabel) {
  const source = readProjectFile(routeFile);
  if (!source) return;
  if (!new RegExp(`export\\s+async\\s+function\\s+${method}\\b`).test(source)) {
    fail(`${routeLabel} is missing export async function ${method} in ${routeFile}`);
  }
}

function assertRouteGuard(routeFile, expectedSnippet, routeLabel) {
  const source = readProjectFile(routeFile);
  if (!source) return;
  if (!source.includes(expectedSnippet)) {
    fail(`${routeLabel} is missing guard/snippet ${expectedSnippet} in ${routeFile}`);
  }
}

function assertSourceIncludes(sourceLabel, source, expectedSnippet, message) {
  if (!source.includes(expectedSnippet)) {
    fail(`${sourceLabel} missing ${expectedSnippet}: ${message}`);
  }
}

function assertAllPresent(label, expected, actual, formatMissing) {
  const actualSet = new Set(actual);
  for (const item of expected) {
    if (!actualSet.has(item)) {
      fail(`${label} missing ${formatMissing ? formatMissing(item) : item}`);
    }
  }
}

function assertNoLegacySingularEnv(source, sourceLabel) {
  const legacyMatches = source.match(/\bZHINOTE_[A-Z0-9_]+\b/g) ?? [];
  for (const key of unique(legacyMatches)) {
    fail(`${sourceLabel} still references legacy singular env key ${key}`);
  }
}

function assertMigrationTables(expectedTables, migrationSql) {
  const normalizedSql = migrationSql.toLowerCase();
  for (const tableName of expectedTables) {
    const physicalTables = contractTablePhysicalTables[tableName] ?? [tableName];
    for (const physicalTable of physicalTables) {
      const statement = `create table if not exists public.${physicalTable.toLowerCase()}`;
      if (!normalizedSql.includes(statement)) {
        fail(`Migration missing ${statement}`);
      }
    }
  }
}

function run() {
  const envExample = readProjectFile(files.envExample);
  const apiStubs = readProjectFile(files.apiStubs);
  const contract = readProjectFile(files.contract);
  const deploymentTarget = readProjectFile(files.deploymentTarget);
  const smokeTestPlan = readProjectFile(files.smokeTestPlan);
  const smokeTestVerifier = readProjectFile(files.smokeTestVerifier);
  const environmentPreflight = readProjectFile(files.environmentPreflight);
  const launchChecklist = readProjectFile(files.launchChecklist);
  const routePreflight = readProjectFile(files.routePreflight);
  const conflictResolution = readProjectFile(files.conflictResolution);
  const remoteBaselineRequest = readProjectFile(files.remoteBaselineRequest);
  const remoteBaselineStaging = readProjectFile(files.remoteBaselineStaging);
  const syncOptInGate = readProjectFile(files.syncOptInGate);
  const workspaceIdentity = readProjectFile(files.workspaceIdentity);
  const accountSessionBoundary = readProjectFile(files.accountSessionBoundary);
  const webBetaReadiness = readProjectFile(files.webBetaReadiness);
  const syncShell = readProjectFile(files.syncShell);
  const migration = readProjectFile(files.migration);

  const requiredEnvKeys = extractQuotedValues(environmentPreflight, "key");
  const envExampleKeys = extractEnvExampleKeys(envExample);
  assertAllPresent(".env.example", requiredEnvKeys, envExampleKeys);

  for (const [label, source] of [
    [files.envExample, envExample],
    [files.apiStubs, apiStubs],
    [files.contract, contract],
    [files.deploymentTarget, deploymentTarget],
    [files.smokeTestPlan, smokeTestPlan],
    [files.smokeTestVerifier, smokeTestVerifier],
    [files.environmentPreflight, environmentPreflight],
    [files.launchChecklist, launchChecklist],
    [files.routePreflight, routePreflight],
    [files.conflictResolution, conflictResolution],
    [files.remoteBaselineRequest, remoteBaselineRequest],
    [files.remoteBaselineStaging, remoteBaselineStaging],
    [files.syncOptInGate, syncOptInGate],
    [files.workspaceIdentity, workspaceIdentity],
    [files.accountSessionBoundary, accountSessionBoundary],
    [files.webBetaReadiness, webBetaReadiness],
    [files.syncShell, syncShell],
  ]) {
    assertNoLegacySingularEnv(source, label);
  }

  const apiStubRows = extractApiStubs(apiStubs);
  const routeCalls = extractRouteCalls(launchChecklist);
  if (!launchChecklist.includes("WEB_BETA_API_STUBS.map")) {
    fail("Launch checklist must derive Web Beta API route checks from WEB_BETA_API_STUBS.map");
  }
  if (!routePreflight.includes("WEB_BETA_API_STUBS.map")) {
    fail("Route preflight must derive Web Beta API route checks from WEB_BETA_API_STUBS.map");
  }

  for (const stub of apiStubRows) {
    const routeFile = routeFileForApiPath(stub.path);
    const routeLabel = `${stub.method} ${stub.path}`;
    assertRouteExport(routeFile, stub.method, routeLabel);

    if (isCloudAlphaStub(stub.id)) {
      assertRouteGuard(routeFile, `cloudNotConfiguredResponse("${stub.id}")`, routeLabel);
    } else {
      assertRouteGuard(
        routeFile,
        `buildWebBetaApiStubResponse("${stub.id}")`,
        routeLabel
      );
    }
  }

  assertRouteExport("src/app/api/ai/run/route.ts", "POST", "POST /api/ai/run");
  assertRouteGuard(
    "src/app/api/ai/run/route.ts",
    "buildAiRunDisabledResponse",
    "POST /api/ai/run"
  );
  assertRouteExport(
    "src/app/api/web-beta/environment-preflight/route.ts",
    "GET",
    "GET /api/web-beta/environment-preflight"
  );
  assertRouteGuard(
    "src/app/api/web-beta/environment-preflight/route.ts",
    "buildWebBetaEnvironmentPreflight",
    "GET /api/web-beta/environment-preflight"
  );
  assertSourceIncludes(
    files.workspaceIdentity,
    workspaceIdentity,
    "validateBootstrapProof(input)",
    "Local cloud workspace linking must validate bootstrap proof."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "!bootstrapProofMatchesSelection",
    "Sync UI must disable local cloud linking without a matching bootstrap proof."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "buildLocalWorkspaceCloudLinkReceipt",
    "Sync UI must export metadata-only cloud link receipts."
  );
  assertSourceIncludes(
    files.syncOptInGate,
    syncOptInGate,
    'id: "bootstrap-proof"',
    "Sync opt-in gate must include bootstrap membership proof."
  );
  assertSourceIncludes(
    files.syncOptInGate,
    syncOptInGate,
    "cloud_bootstrap_checked_at",
    "Sync opt-in gate must expose bootstrap proof metadata."
  );
  assertSourceIncludes(
    files.accountSessionBoundary,
    accountSessionBoundary,
    "bootstrap_checked_at",
    "Account/session boundary must include bootstrap proof evidence."
  );
  assertSourceIncludes(
    files.webBetaReadiness,
    webBetaReadiness,
    'id: "cloud-link-proof"',
    "Web Beta readiness must include cloud link proof gate."
  );
  assertSourceIncludes(
    files.deploymentTarget,
    deploymentTarget,
    'first_web_alpha: "vercel-nextjs"',
    "Deployment target must keep the current Next.js app host decision explicit."
  );
  assertSourceIncludes(
    files.deploymentTarget,
    deploymentTarget,
    'cloud_backend: "supabase-cloud"',
    "Deployment target must identify Supabase as the first cloud backend."
  );
  assertSourceIncludes(
    files.deploymentTarget,
    deploymentTarget,
    'edge_layer: "cloudflare-dns-cdn-waf"',
    "Deployment target must preserve Cloudflare as the planned edge layer."
  );
  assertSourceIncludes(
    files.deploymentTarget,
    deploymentTarget,
    'id: "cloudflare-pages"',
    "Deployment target must track Cloudflare Pages as a future/runtime compatibility option."
  );
  assertSourceIncludes(
    files.deploymentTarget,
    deploymentTarget,
    'id: "cloudflare-workers"',
    "Deployment target must track Cloudflare Workers as a future/runtime compatibility option."
  );
  for (const [snippet, message] of [
    ["deploys_app: false", "Deployment target must not deploy the app."],
    [
      "creates_cloud_resources: false",
      "Deployment target must not create cloud resources.",
    ],
    [
      "connects_cloud_services: false",
      "Deployment target must not connect cloud services.",
    ],
    [
      "uploads_workspace_data: false",
      "Deployment target must not upload workspace data.",
    ],
    [
      "requires_owner_confirmation_before_deploy: true",
      "Deployment target must require owner confirmation before deploy.",
    ],
  ]) {
    assertSourceIncludes(files.deploymentTarget, deploymentTarget, snippet, message);
  }
  assertSourceIncludes(
    files.contract,
    contract,
    "web_beta_deployment_target",
    "Web Beta contract export must include the deployment target."
  );
  assertSourceIncludes(
    files.webBetaReadiness,
    webBetaReadiness,
    'id: "deployment-target-contract"',
    "Web Beta readiness must include deployment target readiness."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "buildWebBetaDeploymentTarget",
    "Sync UI must build the deployment target contract."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "handleExportWebBetaDeploymentTarget",
    "Sync UI must export the deployment target contract."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "Deployment target",
    "Sync UI must render the deployment target panel."
  );
  assertSourceIncludes(
    files.smokeTestPlan,
    smokeTestPlan,
    'format: "zhinote-web-beta-smoke-test-plan"',
    "Smoke test plan must expose a stable export format."
  );
  for (const [snippet, message] of [
    ["runs_tests: false", "Smoke test plan must not run tests."],
    [
      "sends_network_requests: false",
      "Smoke test plan must not send network requests.",
    ],
    ["deploys_app: false", "Smoke test plan must not deploy the app."],
    [
      "creates_accounts: false",
      "Smoke test plan must not create accounts.",
    ],
    [
      "connects_cloud_services: false",
      "Smoke test plan must not connect cloud services.",
    ],
    [
      "uploads_workspace_data: false",
      "Smoke test plan must not upload workspace data.",
    ],
    [
      "exposes_secret_values: false",
      "Smoke test plan must not expose secret values.",
    ],
    [
      "requires_owner_confirmation_before_preview: true",
      "Smoke test plan must require owner confirmation before preview.",
    ],
    [
      'id: "cloud-alpha-disabled-defaults"',
      "Smoke test plan must check disabled cloud defaults.",
    ],
    [
      'id: "private-file-storage-remains-disabled"',
      "Smoke test plan must keep private file storage disabled until proven.",
    ],
    [
      'id: "cloudflare-edge-staging"',
      "Smoke test plan must include Cloudflare edge staging review.",
    ],
  ]) {
    assertSourceIncludes(files.smokeTestPlan, smokeTestPlan, snippet, message);
  }
  assertSourceIncludes(
    files.contract,
    contract,
    "web_beta_smoke_test_plan",
    "Web Beta contract export must include the smoke test plan."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "buildWebBetaSmokeTestPlan",
    "Sync UI must build the smoke test plan."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "handleExportWebBetaSmokeTestPlan",
    "Sync UI must export the smoke test plan."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "Smoke test plan",
    "Sync UI must render the smoke test plan panel."
  );
  assertSourceIncludes(
    files.smokeTestVerifier,
    smokeTestVerifier,
    "Web Beta smoke test verification passed",
    "Smoke test verifier must expose a pass/fail CLI result."
  );
  assertSourceIncludes(
    files.smokeTestVerifier,
    smokeTestVerifier,
    "gatedOrDisabledApiRoutes",
    "Smoke test verifier must check high-risk API route guards."
  );
  assertSourceIncludes(
    files.smokeTestVerifier,
    smokeTestVerifier,
    "requiredBoundarySnippets",
    "Smoke test verifier must check local-only privacy boundaries."
  );
  assertSourceIncludes(
    files.conflictResolution,
    conflictResolution,
    'format: "zhinote-sync-conflict-resolution-contract"',
    "Sync conflict resolution must expose a stable export format."
  );
  assertSourceIncludes(
    files.conflictResolution,
    conflictResolution,
    "buildSyncConflictResolutionContract",
    "Sync conflict resolution must expose a reusable builder."
  );
  assertSourceIncludes(
    files.conflictResolution,
    conflictResolution,
    "can_apply_resolution_now: false",
    "Sync conflict resolution must not allow applying resolutions."
  );
  for (const [snippet, message] of [
    ["local_contract_only: true", "Conflict resolution must be local-only."],
    ["reads_remote_data: false", "Conflict resolution must not read remote data."],
    ["reads_page_body_text: false", "Conflict resolution must not read page bodies."],
    [
      "reads_database_row_values: false",
      "Conflict resolution must not read database row values.",
    ],
    ["reads_comment_bodies: false", "Conflict resolution must not read comment bodies."],
    ["reads_file_bytes: false", "Conflict resolution must not read file bytes."],
    ["merges_changes: false", "Conflict resolution must not merge changes."],
    [
      "applies_remote_changes: false",
      "Conflict resolution must not apply remote changes.",
    ],
    [
      "writes_workspace_data: false",
      "Conflict resolution must not write workspace data.",
    ],
    ["updates_permissions: false", "Conflict resolution must not update permissions."],
    ["runs_restore: false", "Conflict resolution must not run restore."],
    [
      "uploads_workspace_data: false",
      "Conflict resolution must not upload workspace data.",
    ],
    [
      "connects_cloud_services: false",
      "Conflict resolution must not connect cloud services.",
    ],
    [
      "acknowledges_remote_rows: false",
      "Conflict resolution must not acknowledge remote rows.",
    ],
    [
      "requires_side_by_side_review: true",
      "Conflict resolution must require side-by-side review.",
    ],
    [
      "requires_owner_confirmation_before_apply: true",
      "Conflict resolution must require owner confirmation before apply.",
    ],
    [
      "requires_audit_event_before_apply: true",
      "Conflict resolution must require audit before apply.",
    ],
    [
      "requires_rollback_snapshot_before_apply: true",
      "Conflict resolution must require rollback snapshot before apply.",
    ],
  ]) {
    assertSourceIncludes(files.conflictResolution, conflictResolution, snippet, message);
  }
  for (const actionId of [
    "keep-local",
    "accept-remote",
    "manual-merge",
    "append-only",
    "keep-both",
    "skip-and-flag",
  ]) {
    assertSourceIncludes(
      files.conflictResolution,
      conflictResolution,
      `"${actionId}"`,
      `Conflict resolution action ${actionId} must remain available.`
    );
  }
  for (const gateId of [
    "remote-baseline-loaded",
    "side-by-side-review-ui",
    "permission-check-before-apply",
    "rollback-snapshot-before-apply",
    "audit-event-before-apply",
    "disabled-apply-path",
  ]) {
    assertSourceIncludes(
      files.conflictResolution,
      conflictResolution,
      `id: "${gateId}"`,
      `Conflict resolution gate ${gateId} must remain available.`
    );
  }
  for (const [snippet, message] of [
    [
      'status: "local-side-by-side-preview-only"',
      "Conflict review UI must expose a local side-by-side preview status.",
    ],
    ['route: "/modules/sync"', "Conflict review UI must live in the sync module."],
    [
      "can_select_actions_now: false",
      "Conflict review UI must not allow action selection yet.",
    ],
    [
      "can_apply_actions_now: false",
      "Conflict review UI must not allow apply yet.",
    ],
    [
      "uses_placeholder_evidence: true",
      "Conflict review UI must use placeholder evidence only.",
    ],
    [
      "action_buttons_disabled: true",
      "Conflict review UI action buttons must remain disabled.",
    ],
    ['lane_order: ["base", "local", "remote"]', "Conflict review UI must keep base/local/remote lane order."],
    [
      "buildSideBySideReviewUi",
      "Conflict resolution builder must include side-by-side review UI planning.",
    ],
    [
      "buildSurfaceReviewUi",
      "Conflict resolution builder must create review surfaces.",
    ],
    [
      "buildReviewActionButton",
      "Conflict resolution builder must create disabled review action buttons.",
    ],
  ]) {
    assertSourceIncludes(files.conflictResolution, conflictResolution, snippet, message);
  }
  assertSourceIncludes(
    files.remoteBaselineRequest,
    remoteBaselineRequest,
    'format: "zhinote-remote-baseline-request-contract"',
    "Remote baseline request must expose a stable export format."
  );
  assertSourceIncludes(
    files.remoteBaselineRequest,
    remoteBaselineRequest,
    "buildRemoteBaselineRequestContract",
    "Remote baseline request must expose a reusable builder."
  );
  for (const [snippet, message] of [
    [
      "can_request_remote_baseline_now: false",
      "Remote baseline request must not be enabled yet.",
    ],
    [
      "can_stage_remote_rows_now: false",
      "Remote baseline request must not stage remote rows yet.",
    ],
    [
      "can_apply_remote_rows_now: false",
      "Remote baseline request must not apply remote rows.",
    ],
    [
      "starts_network_request: false",
      "Remote baseline request must not start network requests.",
    ],
    [
      "connects_cloud_services: false",
      "Remote baseline request must not connect cloud services.",
    ],
    [
      "reads_remote_data: false",
      "Remote baseline request must not read remote data.",
    ],
    [
      "reads_page_body_text: false",
      "Remote baseline request must not read page bodies.",
    ],
    [
      "reads_database_row_values: false",
      "Remote baseline request must not read database row values.",
    ],
    [
      "reads_comment_bodies: false",
      "Remote baseline request must not read comment bodies.",
    ],
    [
      "reads_file_bytes: false",
      "Remote baseline request must not read file bytes.",
    ],
    [
      "stages_remote_rows: false",
      "Remote baseline request must not stage remote rows.",
    ],
    [
      "acknowledges_remote_rows: false",
      "Remote baseline request must not acknowledge remote rows.",
    ],
    [
      "applies_remote_changes: false",
      "Remote baseline request must not apply remote changes.",
    ],
    [
      "writes_workspace_data: false",
      "Remote baseline request must not write workspace data.",
    ],
    [
      "uploads_workspace_data: false",
      "Remote baseline request must not upload workspace data.",
    ],
    [
      "requires_authenticated_session: true",
      "Remote baseline request must require authenticated session before enablement.",
    ],
    [
      "requires_workspace_membership: true",
      "Remote baseline request must require workspace membership.",
    ],
    [
      "requires_side_by_side_review_staging: true",
      "Remote baseline request must require side-by-side staging.",
    ],
    [
      "requires_permission_check_before_fetch: true",
      "Remote baseline request must require permission check.",
    ],
    [
      "requires_audit_event_before_fetch: true",
      "Remote baseline request must require audit event.",
    ],
    [
      "requires_owner_confirmation_before_apply: true",
      "Remote baseline request must require owner confirmation before apply.",
    ],
    [
      'endpoint: "/api/sync/pull"',
      "Remote baseline request must target the disabled sync pull endpoint.",
    ],
    [
      'query_mode: "baseline"',
      "Remote baseline request must use baseline query mode.",
    ],
    [
      'response_handling: "stage-for-review-only"',
      "Remote baseline response must be staged for review only.",
    ],
    [
      "page_body_text",
      "Remote baseline request must explicitly forbid page body text.",
    ],
    [
      "database_cell_values",
      "Remote baseline request must explicitly forbid database cell values.",
    ],
    [
      "comment_body",
      "Remote baseline request must explicitly forbid comment bodies.",
    ],
    [
      "file_bytes",
      "Remote baseline request must explicitly forbid file bytes.",
    ],
    [
      "signed_download_url",
      "Remote baseline request must explicitly forbid signed download URLs.",
    ],
  ]) {
    assertSourceIncludes(files.remoteBaselineRequest, remoteBaselineRequest, snippet, message);
  }
  for (const gateId of [
    "cloud-workspace-link",
    "auth-session-boundary",
    "sync-pull-endpoint-disabled",
    "remote-cursor-contract",
    "side-by-side-staging-target",
    "permission-check-before-fetch",
    "audit-event-before-fetch",
    "owner-confirmation-before-apply",
  ]) {
    assertSourceIncludes(
      files.remoteBaselineRequest,
      remoteBaselineRequest,
      `id: "${gateId}"`,
      `Remote baseline gate ${gateId} must remain available.`
    );
  }
  assertSourceIncludes(
    files.remoteBaselineStaging,
    remoteBaselineStaging,
    'format: "zhinote-remote-baseline-staging-contract"',
    "Remote baseline staging must expose a stable export format."
  );
  assertSourceIncludes(
    files.remoteBaselineStaging,
    remoteBaselineStaging,
    "buildRemoteBaselineStagingContract",
    "Remote baseline staging must expose a reusable builder."
  );
  for (const [snippet, message] of [
    [
      "can_stage_remote_metadata_now: false",
      "Remote baseline staging must not stage metadata yet.",
    ],
    [
      "can_persist_stage_store_now: false",
      "Remote baseline staging must not persist a stage store.",
    ],
    [
      "can_apply_staged_rows_now: false",
      "Remote baseline staging must not apply staged rows.",
    ],
    [
      'disabled_source_endpoint: "/api/sync/pull"',
      "Remote baseline staging must use the disabled sync pull endpoint.",
    ],
    [
      'disabled_stage_table: "remote_baseline_stage"',
      "Remote baseline staging must name the disabled stage table.",
    ],
    [
      "uses_placeholder_metadata: true",
      "Remote baseline staging must use placeholder metadata only.",
    ],
    [
      "starts_network_request: false",
      "Remote baseline staging must not start network requests.",
    ],
    [
      "connects_cloud_services: false",
      "Remote baseline staging must not connect cloud services.",
    ],
    [
      "reads_remote_data: false",
      "Remote baseline staging must not read remote data.",
    ],
    [
      "reads_page_body_text: false",
      "Remote baseline staging must not read page bodies.",
    ],
    [
      "reads_database_row_values: false",
      "Remote baseline staging must not read database row values.",
    ],
    [
      "reads_comment_bodies: false",
      "Remote baseline staging must not read comment bodies.",
    ],
    [
      "reads_file_bytes: false",
      "Remote baseline staging must not read file bytes.",
    ],
    [
      "persists_stage_store: false",
      "Remote baseline staging must not persist stage data.",
    ],
    [
      "stages_remote_rows: false",
      "Remote baseline staging must not stage remote rows.",
    ],
    [
      "acknowledges_remote_rows: false",
      "Remote baseline staging must not acknowledge remote rows.",
    ],
    [
      "applies_remote_changes: false",
      "Remote baseline staging must not apply remote changes.",
    ],
    [
      "writes_workspace_data: false",
      "Remote baseline staging must not write workspace data.",
    ],
    [
      "uploads_workspace_data: false",
      "Remote baseline staging must not upload workspace data.",
    ],
    [
      "requires_remote_baseline_request_contract: true",
      "Remote baseline staging must require the request contract.",
    ],
    [
      "requires_cursor_proof: true",
      "Remote baseline staging must require cursor proof.",
    ],
    [
      "requires_side_by_side_review_surface: true",
      "Remote baseline staging must require side-by-side review surface.",
    ],
    [
      "requires_permission_check_before_stage: true",
      "Remote baseline staging must require permission check.",
    ],
    [
      "requires_audit_event_before_stage: true",
      "Remote baseline staging must require audit event.",
    ],
    [
      "requires_rollback_snapshot_before_apply: true",
      "Remote baseline staging must require rollback before apply.",
    ],
    [
      "requires_owner_confirmation_before_apply: true",
      "Remote baseline staging must require owner confirmation before apply.",
    ],
    [
      'staging_table: "remote_baseline_stage"',
      "Remote baseline staging must route to the planned stage table.",
    ],
    [
      'target_review_lane: "remote"',
      "Remote baseline staging must target the Remote review lane.",
    ],
    [
      "page_body_text",
      "Remote baseline staging must explicitly forbid page body text.",
    ],
    [
      "database_cell_values",
      "Remote baseline staging must explicitly forbid database values.",
    ],
    [
      "comment_body",
      "Remote baseline staging must explicitly forbid comment bodies.",
    ],
    [
      "file_bytes",
      "Remote baseline staging must explicitly forbid file bytes.",
    ],
    [
      "signed_download_url",
      "Remote baseline staging must explicitly forbid signed download URLs.",
    ],
  ]) {
    assertSourceIncludes(files.remoteBaselineStaging, remoteBaselineStaging, snippet, message);
  }
  for (const gateId of [
    "baseline-request-contract",
    "stage-store-schema",
    "cursor-proof-before-stage",
    "permission-check-before-stage",
    "audit-event-before-stage",
    "side-by-side-remote-lane",
    "rollback-before-apply",
    "owner-confirmation-before-apply",
  ]) {
    assertSourceIncludes(
      files.remoteBaselineStaging,
      remoteBaselineStaging,
      `id: "${gateId}"`,
      `Remote baseline staging gate ${gateId} must remain available.`
    );
  }
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "buildSyncConflictResolutionContract",
    "Sync UI must build the conflict resolution contract."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "handleExportSyncConflictResolution",
    "Sync UI must export the conflict resolution contract."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "Conflict resolution contract",
    "Sync UI must render the conflict resolution panel."
  );
  for (const [snippet, message] of [
    [
      "handleExportSyncConflictReviewUi",
      "Sync UI must export the side-by-side conflict review UI contract.",
    ],
    [
      "Side-by-side conflict review",
      "Sync UI must render the side-by-side conflict review preview.",
    ],
    [
      "Export review UI",
      "Sync UI must expose the review UI export action.",
    ],
    [
      "ResolutionReviewSurfaceRow",
      "Sync UI must render per-surface conflict review rows.",
    ],
    [
      "ResolutionReviewLaneCard",
      "Sync UI must render base/local/remote lane cards.",
    ],
    [
      "Apply disabled",
      "Sync UI must keep conflict apply disabled in the preview.",
    ],
  ]) {
    assertSourceIncludes(files.syncShell, syncShell, snippet, message);
  }
  for (const [snippet, message] of [
    [
      "buildRemoteBaselineRequestContract",
      "Sync UI must build the remote baseline request contract.",
    ],
    [
      "handleExportRemoteBaselineRequest",
      "Sync UI must export the remote baseline request contract.",
    ],
    [
      "Remote baseline request contract",
      "Sync UI must render the remote baseline request panel.",
    ],
    [
      "Export baseline request",
      "Sync UI must expose the remote baseline export action.",
    ],
    [
      "RemoteBaselineSurfaceRow",
      "Sync UI must render remote baseline surface rows.",
    ],
    [
      "RemoteBaselineGateRow",
      "Sync UI must render remote baseline gates.",
    ],
    [
      "RemoteBaselineFieldRow",
      "Sync UI must render remote baseline field boundaries.",
    ],
  ]) {
    assertSourceIncludes(files.syncShell, syncShell, snippet, message);
  }
  for (const [snippet, message] of [
    [
      "buildRemoteBaselineStagingContract",
      "Sync UI must build the remote baseline staging contract.",
    ],
    [
      "handleExportRemoteBaselineStaging",
      "Sync UI must export the remote baseline staging contract.",
    ],
    [
      "Remote baseline staging contract",
      "Sync UI must render the remote baseline staging panel.",
    ],
    [
      "Export baseline staging",
      "Sync UI must expose the remote baseline staging export action.",
    ],
    [
      "RemoteBaselineStageStoreCard",
      "Sync UI must render the remote baseline stage store boundary.",
    ],
    [
      "RemoteBaselineStageSurfaceRow",
      "Sync UI must render remote-lane surface staging rows.",
    ],
    [
      "RemoteBaselineStageGateRow",
      "Sync UI must render remote baseline staging gates.",
    ],
    [
      "RemoteBaselineStageFieldRow",
      "Sync UI must render remote baseline staging field boundaries.",
    ],
  ]) {
    assertSourceIncludes(files.syncShell, syncShell, snippet, message);
  }

  const expectedPageRoutes = routeCalls.filter(
    (route) => route.surface === "workspace" || route.surface === "module"
  );
  for (const route of expectedPageRoutes) {
    const pageFile = routeFileForPagePath(route.route);
    if (!existsSync(path.join(root, pageFile))) {
      fail(`${route.method} ${route.route} is missing page file ${pageFile}`);
    }
  }

  const contractTables = extractQuotedValues(contract, "tableName");
  assertMigrationTables(contractTables, migration);

  const migrationTables = unique(
    [...migration.matchAll(/create table if not exists public\.([a-z0-9_]+)/gi)].map(
      (match) => match[1]
    )
  );
  const missingFromContract = migrationTables.filter(
    (tableName) =>
      !contractTables.includes(tableName) &&
      !["database_fields", "database_rows", "database_views", "wiki_links", "page_comments", "block_comments"].includes(
        tableName
      )
  );
  if (missingFromContract.length > 0) {
    warn(
      `Migration has tables not named in CLOUD_SCHEMA_TABLES: ${missingFromContract.join(
        ", "
      )}`
    );
  }

  const summary = {
    env_requirements: requiredEnvKeys.length,
    api_stubs: apiStubRows.length,
    page_routes: expectedPageRoutes.length,
    migration_contract_tables: contractTables.length,
    migration_tables: migrationTables.length,
    link_proof_contract_checks: 7,
    deployment_target_checks: 16,
    smoke_test_plan_checks: 16,
    smoke_test_verifier_checks: 3,
    conflict_resolution_checks: 50,
    remote_baseline_checks: 43,
    remote_baseline_staging_checks: 49,
    warnings: warnings.length,
  };

  if (failures.length > 0) {
    console.error("Web Beta contract verification failed");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    if (warnings.length > 0) {
      console.error("Warnings:");
      for (const warning of warnings) {
        console.error(`- ${warning}`);
      }
    }
    process.exit(1);
  }

  console.log("Web Beta contract verification passed");
  console.log(JSON.stringify(summary, null, 2));
  if (warnings.length > 0) {
    console.log("Warnings:");
    for (const warning of warnings) {
      console.log(`- ${warning}`);
    }
  }
}

function isCloudAlphaStub(id) {
  return (
    id === "auth-session" ||
    id === "auth-login-start" ||
    id === "auth-logout" ||
    id === "workspace-list" ||
    id === "workspace-create" ||
    id === "workspace-bootstrap"
  );
}

run();
