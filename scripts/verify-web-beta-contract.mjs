#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

const files = {
  packageJson: "package.json",
  envExample: ".env.example",
  webAlphaReceiptVerifier: "scripts/verify-web-alpha-handoff-receipt.mjs",
  apiStubs: "src/lib/sync/webBetaApiStubs.ts",
  contract: "src/lib/sync/webBetaContract.ts",
  deploymentTarget: "src/lib/sync/webBetaDeploymentTarget.ts",
  webAlphaHandoffBundle: "src/lib/sync/webAlphaHandoffBundle.ts",
  webAlphaLaunchDecisionReceipt:
    "src/lib/sync/webAlphaLaunchDecisionReceipt.ts",
  privateFileStoragePolicy: "src/lib/sync/privateFileStoragePolicy.ts",
  filePresignApiStub: "src/lib/sync/filePresignApiStub.ts",
  filePresignRoute: "src/app/api/files/presign/route.ts",
  smokeTestPlan: "src/lib/sync/webBetaSmokeTestPlan.ts",
  smokeTestVerifier: "scripts/verify-web-beta-smoke-tests.mjs",
  replayHarnessVerifier: "scripts/verify-replay-harness-safety.mjs",
  environmentPreflight: "src/lib/sync/webBetaEnvironmentPreflight.ts",
  launchChecklist: "src/lib/sync/webBetaLaunchChecklist.ts",
  routePreflight: "src/lib/sync/webBetaRoutePreflight.ts",
  conflictResolution: "src/lib/sync/syncConflictResolution.ts",
  remoteBaselineRequest: "src/lib/sync/remoteBaselineRequest.ts",
  remoteBaselineStaging: "src/lib/sync/remoteBaselineStaging.ts",
  remoteBaselineStageSchema: "src/lib/sync/remoteBaselineStageSchema.ts",
  remoteBaselineStageReplay: "src/lib/sync/remoteBaselineStageReplay.ts",
  remoteBaselineReplayFixture: "src/lib/sync/remoteBaselineReplayFixture.ts",
  remoteBaselineReplayHarness: "src/lib/sync/remoteBaselineReplayHarness.ts",
  remoteBaselineReplayRunner: "src/lib/sync/remoteBaselineReplayRunner.ts",
  syncOptInGate: "src/lib/sync/syncOptInGate.ts",
  workspaceIdentity: "src/lib/sync/workspaceIdentity.ts",
  accountSessionBoundary: "src/lib/security/accountSessionBoundary.ts",
  auditEventEnvelope: "src/lib/security/auditEventEnvelope.ts",
  auditEventsApiStub: "src/lib/security/auditEventsApiStub.ts",
  auditEventsRoute: "src/app/api/audit/events/route.ts",
  permissionCheckEnvelope: "src/lib/security/permissionCheckEnvelope.ts",
  permissionCheckApiStub: "src/lib/security/permissionCheckApiStub.ts",
  permissionCheckRequestValidator:
    "src/lib/security/permissionCheckRequestValidator.ts",
  permissionServerTestMatrix: "src/lib/security/permissionServerTestMatrix.ts",
  permissionServerReadiness: "src/lib/security/permissionServerReadiness.ts",
  permissionCheckRoute: "src/app/api/permissions/check/route.ts",
  typedConfirmation: "src/lib/security/typedConfirmation.ts",
  highRiskActionRegistry: "src/lib/security/highRiskActionRegistry.ts",
  webBetaReadiness: "src/lib/sync/webBetaReadiness.ts",
  webBetaStageGate: "src/lib/sync/webBetaStageGate.ts",
  webBetaNextActions: "src/lib/sync/webBetaNextActions.ts",
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

function assertSourceExcludes(sourceLabel, source, forbiddenSnippet, message) {
  if (source.includes(forbiddenSnippet)) {
    fail(`${sourceLabel} must not include ${forbiddenSnippet}: ${message}`);
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
  const packageJson = readProjectFile(files.packageJson);
  const envExample = readProjectFile(files.envExample);
  const webAlphaReceiptVerifier = readProjectFile(files.webAlphaReceiptVerifier);
  const apiStubs = readProjectFile(files.apiStubs);
  const contract = readProjectFile(files.contract);
  const deploymentTarget = readProjectFile(files.deploymentTarget);
  const webAlphaHandoffBundle = readProjectFile(files.webAlphaHandoffBundle);
  const webAlphaLaunchDecisionReceipt = readProjectFile(
    files.webAlphaLaunchDecisionReceipt
  );
  const privateFileStoragePolicy = readProjectFile(files.privateFileStoragePolicy);
  const filePresignApiStub = readProjectFile(files.filePresignApiStub);
  const filePresignRoute = readProjectFile(files.filePresignRoute);
  const smokeTestPlan = readProjectFile(files.smokeTestPlan);
  const smokeTestVerifier = readProjectFile(files.smokeTestVerifier);
  const replayHarnessVerifier = readProjectFile(files.replayHarnessVerifier);
  const environmentPreflight = readProjectFile(files.environmentPreflight);
  const launchChecklist = readProjectFile(files.launchChecklist);
  const routePreflight = readProjectFile(files.routePreflight);
  const conflictResolution = readProjectFile(files.conflictResolution);
  const remoteBaselineRequest = readProjectFile(files.remoteBaselineRequest);
  const remoteBaselineStaging = readProjectFile(files.remoteBaselineStaging);
  const remoteBaselineStageSchema = readProjectFile(
    files.remoteBaselineStageSchema
  );
  const remoteBaselineStageReplay = readProjectFile(
    files.remoteBaselineStageReplay
  );
  const remoteBaselineReplayFixture = readProjectFile(
    files.remoteBaselineReplayFixture
  );
  const remoteBaselineReplayHarness = readProjectFile(
    files.remoteBaselineReplayHarness
  );
  const remoteBaselineReplayRunner = readProjectFile(
    files.remoteBaselineReplayRunner
  );
  const syncOptInGate = readProjectFile(files.syncOptInGate);
  const workspaceIdentity = readProjectFile(files.workspaceIdentity);
  const accountSessionBoundary = readProjectFile(files.accountSessionBoundary);
  const auditEventEnvelope = readProjectFile(files.auditEventEnvelope);
  const auditEventsApiStub = readProjectFile(files.auditEventsApiStub);
  const auditEventsRoute = readProjectFile(files.auditEventsRoute);
  const permissionCheckEnvelope = readProjectFile(files.permissionCheckEnvelope);
  const permissionCheckApiStub = readProjectFile(files.permissionCheckApiStub);
  const permissionCheckRequestValidator = readProjectFile(
    files.permissionCheckRequestValidator
  );
  const permissionServerTestMatrix = readProjectFile(
    files.permissionServerTestMatrix
  );
  const permissionServerReadiness = readProjectFile(
    files.permissionServerReadiness
  );
  const permissionCheckRoute = readProjectFile(files.permissionCheckRoute);
  const typedConfirmation = readProjectFile(files.typedConfirmation);
  const highRiskActionRegistry = readProjectFile(files.highRiskActionRegistry);
  const webBetaReadiness = readProjectFile(files.webBetaReadiness);
  const webBetaStageGate = readProjectFile(files.webBetaStageGate);
  const webBetaNextActions = readProjectFile(files.webBetaNextActions);
  const syncShell = readProjectFile(files.syncShell);
  const migration = readProjectFile(files.migration);

  const requiredEnvKeys = extractQuotedValues(environmentPreflight, "key");
  const envExampleKeys = extractEnvExampleKeys(envExample);
  assertAllPresent(".env.example", requiredEnvKeys, envExampleKeys);

  for (const [label, source] of [
    [files.packageJson, packageJson],
    [files.envExample, envExample],
    [files.apiStubs, apiStubs],
    [files.contract, contract],
    [files.deploymentTarget, deploymentTarget],
    [files.smokeTestPlan, smokeTestPlan],
    [files.smokeTestVerifier, smokeTestVerifier],
    [files.webAlphaLaunchDecisionReceipt, webAlphaLaunchDecisionReceipt],
    [files.replayHarnessVerifier, replayHarnessVerifier],
    [files.environmentPreflight, environmentPreflight],
    [files.launchChecklist, launchChecklist],
    [files.routePreflight, routePreflight],
    [files.conflictResolution, conflictResolution],
    [files.remoteBaselineRequest, remoteBaselineRequest],
    [files.remoteBaselineStaging, remoteBaselineStaging],
    [files.remoteBaselineStageSchema, remoteBaselineStageSchema],
    [files.remoteBaselineStageReplay, remoteBaselineStageReplay],
    [files.remoteBaselineReplayFixture, remoteBaselineReplayFixture],
    [files.remoteBaselineReplayHarness, remoteBaselineReplayHarness],
    [files.remoteBaselineReplayRunner, remoteBaselineReplayRunner],
    [files.syncOptInGate, syncOptInGate],
    [files.workspaceIdentity, workspaceIdentity],
    [files.accountSessionBoundary, accountSessionBoundary],
    [files.auditEventEnvelope, auditEventEnvelope],
    [files.auditEventsApiStub, auditEventsApiStub],
    [files.permissionCheckEnvelope, permissionCheckEnvelope],
    [files.permissionCheckApiStub, permissionCheckApiStub],
    [files.permissionCheckRequestValidator, permissionCheckRequestValidator],
    [files.permissionServerTestMatrix, permissionServerTestMatrix],
    [files.permissionServerReadiness, permissionServerReadiness],
    [files.permissionCheckRoute, permissionCheckRoute],
    [files.typedConfirmation, typedConfirmation],
    [files.highRiskActionRegistry, highRiskActionRegistry],
    [files.webBetaReadiness, webBetaReadiness],
    [files.webBetaStageGate, webBetaStageGate],
    [files.webBetaNextActions, webBetaNextActions],
    [files.syncShell, syncShell],
  ]) {
    assertNoLegacySingularEnv(source, label);
  }

  for (const [file, source, snippet, message] of [
    [
      files.packageJson,
      packageJson,
      '"verify:replay-harness": "node scripts/verify-replay-harness-safety.mjs"',
      "Package scripts must expose replay harness safety verification.",
    ],
    [
      files.smokeTestPlan,
      smokeTestPlan,
      "npm run verify:replay-harness",
      "Smoke test plan must require replay harness safety verification.",
    ],
    [
      files.smokeTestVerifier,
      smokeTestVerifier,
      '"verify:replay-harness"',
      "Smoke verifier must check replay harness safety script presence.",
    ],
    [
      files.replayHarnessVerifier,
      replayHarnessVerifier,
      "Replay harness safety verification passed",
      "Replay harness verifier must expose a clear pass signal.",
    ],
    [
      files.replayHarnessVerifier,
      replayHarnessVerifier,
      "Local harness and fixture must not start network calls.",
      "Replay harness verifier must block network execution in harness and fixture.",
    ],
    [
      files.replayHarnessVerifier,
      replayHarnessVerifier,
      "Local harness and fixture must not read secrets or env values.",
      "Replay harness verifier must block env/secret reads in harness and fixture.",
    ],
    [
      files.replayHarnessVerifier,
      replayHarnessVerifier,
      "Replay route must remain a disabled Web Beta stub.",
      "Replay harness verifier must keep replay route disabled.",
    ],
  ]) {
    assertSourceIncludes(file, source, snippet, message);
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
    } else if (stub.id === "file-presign") {
      assertRouteGuard(
        routeFile,
        "buildFilePresignApiDisabledResponse",
        routeLabel
      );
    } else if (stub.id === "audit-events") {
      assertRouteGuard(
        routeFile,
        "buildAuditEventsApiDisabledResponse",
        routeLabel
      );
    } else if (stub.id === "permission-check") {
      assertRouteGuard(
        routeFile,
        "buildPermissionCheckApiDisabledResponse",
        routeLabel
      );
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
    files.auditEventEnvelope,
    auditEventEnvelope,
    'format: "zhinote-audit-event-envelope-contract"',
    "Audit event envelope must expose a stable export format."
  );
  assertSourceIncludes(
    files.auditEventEnvelope,
    auditEventEnvelope,
    "buildAuditEventEnvelopeContract",
    "Audit event envelope must expose a reusable builder."
  );
  for (const [snippet, message] of [
    [
      'contract_status: "local-redaction-envelope-only"',
      "Audit event envelope must remain local redaction-only.",
    ],
    [
      "can_export_envelope_now: true",
      "Audit event envelope may only be exported locally.",
    ],
    [
      "can_record_server_audit_event_now: false",
      "Audit event envelope must not record server audit events.",
    ],
    [
      "can_read_request_body_now: false",
      "Audit event envelope must not read request bodies.",
    ],
    [
      "can_write_audit_events_table_now: false",
      "Audit event envelope must not write audit_events.",
    ],
    [
      "can_upload_workspace_data_now: false",
      "Audit event envelope must not upload workspace data.",
    ],
    [
      'disabled_endpoint: "/api/audit/events"',
      "Audit event envelope must keep audit endpoint disabled.",
    ],
    [
      "metadata_only_envelope: true",
      "Audit event envelope must stay metadata-only.",
    ],
    [
      "endpoint_disabled: true",
      "Audit event envelope must preserve disabled endpoint boundary.",
    ],
    [
      "reads_request_body: false",
      "Audit event envelope must not read request bodies.",
    ],
    [
      "reads_page_body_text: false",
      "Audit event envelope must not read page bodies.",
    ],
    [
      "reads_database_row_values: false",
      "Audit event envelope must not read database values.",
    ],
    [
      "reads_comment_bodies: false",
      "Audit event envelope must not read comment bodies.",
    ],
    [
      "reads_file_bytes: false",
      "Audit event envelope must not read file bytes.",
    ],
    [
      "reads_prompt_text: false",
      "Audit event envelope must not read prompt text.",
    ],
    [
      "reads_model_raw_output: false",
      "Audit event envelope must not read raw AI output.",
    ],
    [
      "reads_secret_values: false",
      "Audit event envelope must not read secrets.",
    ],
    [
      "exposes_secret_values: false",
      "Audit event envelope must not expose secrets.",
    ],
    [
      "writes_server_audit_log: false",
      "Audit event envelope must not write server audit logs.",
    ],
    [
      "writes_workspace_data: false",
      "Audit event envelope must not write workspace data.",
    ],
    [
      "uploads_workspace_data: false",
      "Audit event envelope must not upload workspace data.",
    ],
    [
      "requires_authenticated_actor: true",
      "Audit event envelope must require authenticated actor.",
    ],
    [
      "requires_workspace_membership: true",
      "Audit event envelope must require workspace membership.",
    ],
    [
      "requires_permission_decision: true",
      "Audit event envelope must require permission decision.",
    ],
    [
      "requires_redaction_before_write: true",
      "Audit event envelope must require redaction before writes.",
    ],
    [
      "requires_retention_policy: true",
      "Audit event envelope must require retention policy.",
    ],
    [
      "event_id",
      "Audit event envelope must include allowed event id.",
    ],
    [
      "metadata_counts",
      "Audit event envelope must include count-only metadata.",
    ],
    [
      "metadata_hashes",
      "Audit event envelope must include hash-only metadata.",
    ],
    [
      "permission_decision_id",
      "Audit event envelope must link permission decisions.",
    ],
    [
      "confirmation_receipt_id",
      "Audit event envelope must link confirmations.",
    ],
    [
      "retention_class",
      "Audit event envelope must include retention class.",
    ],
    [
      "page_body_text",
      "Audit event envelope must forbid page body text.",
    ],
    [
      "database_cell_values",
      "Audit event envelope must forbid database values.",
    ],
    [
      "comment_body",
      "Audit event envelope must forbid comment bodies.",
    ],
    [
      "file_bytes",
      "Audit event envelope must forbid file bytes.",
    ],
    [
      "backup_payload",
      "Audit event envelope must forbid backup payloads.",
    ],
    [
      "prompt_text",
      "Audit event envelope must forbid prompt text.",
    ],
    [
      "model_raw_output",
      "Audit event envelope must forbid raw AI output.",
    ],
    ["token", "Audit event envelope must forbid tokens."],
    ["cookie", "Audit event envelope must forbid cookies."],
    [
      "signed_download_url",
      "Audit event envelope must forbid signed URLs.",
    ],
    [
      "raw_request_body",
      "Audit event envelope must forbid raw request bodies.",
    ],
    [
      "environment_value",
      "Audit event envelope must forbid environment values.",
    ],
    [
      "endpoint-disabled",
      "Audit event envelope must include endpoint disabled redaction check.",
    ],
    [
      "allowed-field-envelope",
      "Audit event envelope must include allowed-field check.",
    ],
    [
      "permission-decision-link",
      "Audit event envelope must include permission decision check.",
    ],
    [
      "content-field-denylist",
      "Audit event envelope must include content denylist check.",
    ],
  ]) {
    assertSourceIncludes(files.auditEventEnvelope, auditEventEnvelope, snippet, message);
  }
  assertSourceIncludes(
    files.auditEventsApiStub,
    auditEventsApiStub,
    'format: "zhinote-audit-events-api-disabled"',
    "Audit events API guard must expose a stable disabled response format."
  );
  assertSourceIncludes(
    files.auditEventsApiStub,
    auditEventsApiStub,
    "buildAuditEventsApiDisabledResponse",
    "Audit events API guard must expose a reusable disabled response builder."
  );
  for (const [snippet, message] of [
    ['api_id: "audit-events"', "Audit events API guard must identify the audit-events route."],
    ['path: "/api/audit/events"', "Audit events API guard must bind to /api/audit/events."],
    ['method: "POST"', "Audit events API guard must document POST."],
    ['stub_status: "disabled-local-stub"', "Audit events API guard must stay disabled."],
    ["can_record_server_audit_events_now: false", "Audit events API guard must not record server audit events."],
    ["can_read_request_body_now: false", "Audit events API guard must not read request bodies."],
    ["can_read_event_payload_now: false", "Audit events API guard must not read event payloads."],
    ["can_write_audit_events_table_now: false", "Audit events API guard must not write audit_events."],
    ["can_write_server_audit_log_now: false", "Audit events API guard must not write server audit logs."],
    ["can_read_page_body_text_now: false", "Audit events API guard must not read page text."],
    ["can_read_database_values_now: false", "Audit events API guard must not read database values."],
    ["can_read_file_bytes_now: false", "Audit events API guard must not read file bytes."],
    ["can_read_prompt_text_now: false", "Audit events API guard must not read prompts."],
    ["can_upload_workspace_data_now: false", "Audit events API guard must not upload workspace data."],
    ["can_expose_secret_values_now: false", "Audit events API guard must not expose secrets."],
    ["no_request_argument: true", "Audit events API guard must not accept a request argument."],
    ["reads_request_body: false", "Audit events API guard must keep body reads disabled."],
    ["metadata_only_request: true", "Audit events API guard must keep the future request metadata-only."],
    ["accepts_event_payload: false", "Audit events API guard must not accept event payloads now."],
    ["executes_actions: false", "Audit events API guard must not execute actions."],
    ["writes_audit_events_table: false", "Audit events API guard must not write audit_events table."],
    ["writes_server_audit_log: false", "Audit events API guard must not write server logs."],
    ["writes_workspace_data: false", "Audit events API guard must not write workspace data."],
    ["uploads_workspace_data: false", "Audit events API guard must not upload workspace data."],
    ["reads_block_text: false", "Audit events API guard must not read block text."],
    ["reads_database_row_values: false", "Audit events API guard must not read database row values."],
    ["reads_comment_bodies: false", "Audit events API guard must not read comment bodies."],
    ["reads_backup_payload: false", "Audit events API guard must not read backups."],
    ["reads_model_raw_output: false", "Audit events API guard must not read raw AI output."],
    ["reads_secret_values: false", "Audit events API guard must not read secrets."],
    ["records_signed_urls: false", "Audit events API guard must not record signed URLs."],
    ["requires_authenticated_actor_before_enablement: true", "Audit events API guard must require authenticated actors."],
    ["requires_workspace_membership_before_enablement: true", "Audit events API guard must require workspace membership."],
    ["requires_permission_decision_before_enablement: true", "Audit events API guard must require permission decision linkage."],
    ["requires_redaction_before_enablement: true", "Audit events API guard must require redaction."],
    ["requires_retention_policy_before_enablement: true", "Audit events API guard must require retention policy."],
    ["requires_tamper_resistant_storage_before_enablement: true", "Audit events API guard must require tamper-resistant storage."],
    ["requires_owner_audit_export_before_enablement: true", "Audit events API guard must require owner audit export."],
    ['schema_status: "planned-metadata-only"', "Audit events API guard must expose metadata-only request schema."],
    ['schema_status: "planned-receipt-only"', "Audit events API guard must expose receipt-only response schema."],
    ["http_status: 501", "Audit events API guard must keep the disabled HTTP status explicit."],
    ["returns_recorded_event_id: false", "Audit events API guard must not return a recorded event id now."],
    ["returns_audit_payload: false", "Audit events API guard must not return audit payloads."],
    ["returns_sensitive_payload: false", "Audit events API guard must not return sensitive payloads."],
    ["writes_audit_event: false", "Audit events API guard must not write events."],
  ]) {
    assertSourceIncludes(files.auditEventsApiStub, auditEventsApiStub, snippet, message);
  }
  for (const snippet of [
    "buildWebBetaApiStubResponse(\"audit-events\")",
    "workspace_id",
    "actor_user_id",
    "device_id",
    "event_type",
    "resource_type",
    "resource_id",
    "operation_status",
    "metadata_counts",
    "metadata_hashes",
    "changed_field_names",
    "permission_decision_id",
    "confirmation_receipt_id",
    "redaction_profile",
    "retention_class",
    "client_event_id",
    "occurred_at",
    "page_body_text",
    "block_text",
    "database_cell_values",
    "comment_body",
    "file_bytes",
    "backup_payload",
    "prompt_text",
    "model_raw_output",
    "token",
    "cookie",
    "password",
    "secret_values",
    "signed_upload_url",
    "signed_download_url",
    "public_url",
    "raw_request_body",
    "environment_value",
    "local_file_path",
    "sql_text",
    'format: "zhinote-audit-events-api-validator-fixtures"',
    'validator_status: "not-executing-route"',
    '"metadata-sync-event"',
    '"high-risk-confirmation-event"',
    '"page-text-blocked"',
    '"file-backup-bytes-blocked"',
    '"ai-payload-blocked"',
    '"secret-url-blocked"',
    '"authenticated-actor"',
    '"workspace-membership"',
    '"metadata-only-schema-validation"',
    '"permission-decision-link"',
    '"retention-policy"',
    '"tamper-resistant-storage"',
    '"owner-audit-export"',
  ]) {
    assertSourceIncludes(
      files.auditEventsApiStub,
      auditEventsApiStub,
      snippet,
      "Audit events API guard must preserve metadata schema, fixtures, and enablement gates."
    );
  }
  assertSourceIncludes(
    files.auditEventsRoute,
    auditEventsRoute,
    "buildAuditEventsApiDisabledResponse",
    "Audit events route must return the dedicated disabled response."
  );
  assertSourceIncludes(
    files.auditEventsRoute,
    auditEventsRoute,
    "WEB_BETA_API_STUB_HTTP_STATUS",
    "Audit events route must keep the disabled Web Beta HTTP status."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "buildAuditEventsApiDisabledResponse",
    "Sync UI must build the audit events API guard."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "handleExportAuditEventsApiGuard",
    "Sync UI must export the audit events API guard."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "Audit events API guard",
    "Sync UI must render the audit events API guard panel."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "Export audit API guard",
    "Sync UI must render the audit events API guard export button."
  );
  assertSourceIncludes(
    files.permissionCheckEnvelope,
    permissionCheckEnvelope,
    'format: "zhinote-permission-check-envelope-contract"',
    "Permission check envelope must expose a stable export format."
  );
  assertSourceIncludes(
    files.permissionCheckEnvelope,
    permissionCheckEnvelope,
    "buildPermissionCheckEnvelopeContract",
    "Permission check envelope must expose a reusable builder."
  );
  for (const [snippet, message] of [
    [
      'contract_status: "local-permission-envelope-only"',
      "Permission check envelope must remain local-only.",
    ],
    [
      "can_export_permission_envelope_now: true",
      "Permission check envelope may only be exported locally.",
    ],
    [
      "can_enforce_permissions_now: false",
      "Permission check envelope must not enforce permissions.",
    ],
    [
      "can_read_request_body_now: false",
      "Permission check envelope must not read request bodies.",
    ],
    [
      "can_create_users_now: false",
      "Permission check envelope must not create users.",
    ],
    [
      "can_grant_access_now: false",
      "Permission check envelope must not grant access.",
    ],
    [
      "can_revoke_access_now: false",
      "Permission check envelope must not revoke access.",
    ],
    [
      "can_write_server_audit_log_now: false",
      "Permission check envelope must not write audit logs.",
    ],
    [
      "can_upload_workspace_data_now: false",
      "Permission check envelope must not upload workspace data.",
    ],
    [
      'disabled_endpoint: "/api/permissions/check"',
      "Permission check envelope must keep permission endpoint disabled.",
    ],
    [
      "metadata_only_request: true",
      "Permission check envelope must stay metadata-only.",
    ],
    [
      "reads_request_body: false",
      "Permission check envelope must not read request bodies.",
    ],
    [
      "creates_users: false",
      "Permission check envelope must not create users.",
    ],
    [
      "grants_access: false",
      "Permission check envelope must not grant access.",
    ],
    [
      "revokes_access: false",
      "Permission check envelope must not revoke access.",
    ],
    [
      "reads_page_body_text: false",
      "Permission check envelope must not read page bodies.",
    ],
    [
      "reads_database_row_values: false",
      "Permission check envelope must not read database values.",
    ],
    [
      "reads_comment_bodies: false",
      "Permission check envelope must not read comment bodies.",
    ],
    [
      "reads_file_bytes: false",
      "Permission check envelope must not read file bytes.",
    ],
    [
      "reads_prompt_text: false",
      "Permission check envelope must not read prompt text.",
    ],
    [
      "reads_secret_values: false",
      "Permission check envelope must not read secrets.",
    ],
    [
      "exposes_secret_values: false",
      "Permission check envelope must not expose secrets.",
    ],
    [
      "writes_server_audit_log: false",
      "Permission check envelope must not write audit logs.",
    ],
    [
      "writes_workspace_data: false",
      "Permission check envelope must not write workspace data.",
    ],
    [
      "uploads_workspace_data: false",
      "Permission check envelope must not upload workspace data.",
    ],
    [
      "requires_authenticated_actor: true",
      "Permission check envelope must require authenticated actor.",
    ],
    [
      "requires_workspace_membership: true",
      "Permission check envelope must require workspace membership.",
    ],
    [
      "requires_role_membership_lookup: true",
      "Permission check envelope must require role lookup.",
    ],
    [
      "requires_high_risk_confirmation: true",
      "Permission check envelope must require high-risk confirmation.",
    ],
    [
      "requires_audit_event_envelope: true",
      "Permission check envelope must require audit envelope.",
    ],
    ["request_id", "Permission check envelope must include request id."],
    ["actor_user_id", "Permission check envelope must include actor id."],
    ["actor_role_id", "Permission check envelope must include actor role."],
    ["resource_type", "Permission check envelope must include resource type."],
    ["action_id", "Permission check envelope must include action id."],
    [
      "confirmation_receipt_id",
      "Permission check envelope must include confirmation receipt id.",
    ],
    [
      "audit_event_envelope_id",
      "Permission check envelope must link audit envelope.",
    ],
    ["decision_id", "Permission check envelope must include decision id."],
    ["allowed", "Permission check envelope must include allow result."],
    [
      "decision_status",
      "Permission check envelope must include decision status.",
    ],
    [
      "page_body_text",
      "Permission check envelope must forbid page body text.",
    ],
    [
      "database_cell_values",
      "Permission check envelope must forbid database values.",
    ],
    [
      "comment_body",
      "Permission check envelope must forbid comment bodies.",
    ],
    [
      "file_bytes",
      "Permission check envelope must forbid file bytes.",
    ],
    [
      "backup_payload",
      "Permission check envelope must forbid backup payload.",
    ],
    [
      "prompt_text",
      "Permission check envelope must forbid prompt text.",
    ],
    [
      "model_raw_output",
      "Permission check envelope must forbid raw AI output.",
    ],
    ["token", "Permission check envelope must forbid tokens."],
    ["cookie", "Permission check envelope must forbid cookies."],
    [
      "signed_download_url",
      "Permission check envelope must forbid signed URLs.",
    ],
    [
      "raw_request_body",
      "Permission check envelope must forbid raw request bodies.",
    ],
    [
      "environment_value",
      "Permission check envelope must forbid environment values.",
    ],
    [
      "owner-cloud-sync-check",
      "Permission check envelope must include owner cloud sync scenario.",
    ],
    [
      "researcher-cloud-sync-deny",
      "Permission check envelope must include researcher denial scenario.",
    ],
    [
      "viewer-ai-run-deny",
      "Permission check envelope must include viewer AI denial scenario.",
    ],
    [
      "endpoint-disabled",
      "Permission check envelope must include endpoint disabled gate.",
    ],
    [
      "role-membership-lookup",
      "Permission check envelope must include role membership gate.",
    ],
    [
      "audit-envelope-before-result",
      "Permission check envelope must include audit envelope gate.",
    ],
  ]) {
    assertSourceIncludes(
      files.permissionCheckEnvelope,
      permissionCheckEnvelope,
      snippet,
      message
    );
  }
  assertSourceIncludes(
    files.permissionCheckEnvelope,
    permissionCheckEnvelope,
    "buildPermissionCheckRequestFields",
    "Permission check envelope must export reusable request fields for the route stub."
  );
  assertSourceIncludes(
    files.permissionCheckEnvelope,
    permissionCheckEnvelope,
    "buildPermissionCheckResponseFields",
    "Permission check envelope must export reusable response fields for the route stub."
  );
  assertSourceIncludes(
    files.permissionCheckEnvelope,
    permissionCheckEnvelope,
    "buildPermissionCheckForbiddenFields",
    "Permission check envelope must export reusable forbidden fields for the route stub."
  );
  assertSourceIncludes(
    files.permissionCheckApiStub,
    permissionCheckApiStub,
    'format: "zhinote-permission-check-api-disabled"',
    "Permission check API stub must expose a stable disabled response format."
  );
  assertSourceIncludes(
    files.permissionCheckApiStub,
    permissionCheckApiStub,
    "buildPermissionCheckApiDisabledResponse",
    "Permission check API stub must expose a reusable disabled response builder."
  );
  for (const [snippet, message] of [
    [
      'api_id: "permission-check"',
      "Permission check API stub must identify the permission-check route.",
    ],
    [
      'path: "/api/permissions/check"',
      "Permission check API stub must bind to /api/permissions/check.",
    ],
    [
      'method: "POST"',
      "Permission check API stub must document the POST method.",
    ],
    [
      'stub_status: "disabled-local-stub"',
      "Permission check API stub must stay disabled by default.",
    ],
    [
      "can_enforce_permissions_now: false",
      "Permission check API stub must not enforce permissions.",
    ],
    [
      "can_read_request_body_now: false",
      "Permission check API stub must not read request bodies.",
    ],
    [
      "can_create_users_now: false",
      "Permission check API stub must not create users.",
    ],
    [
      "can_grant_access_now: false",
      "Permission check API stub must not grant access.",
    ],
    [
      "can_revoke_access_now: false",
      "Permission check API stub must not revoke access.",
    ],
    [
      "can_write_server_audit_log_now: false",
      "Permission check API stub must not write audit logs.",
    ],
    [
      "can_upload_workspace_data_now: false",
      "Permission check API stub must not upload workspace data.",
    ],
    [
      'base_stub: buildWebBetaApiStubResponse("permission-check")',
      "Permission check API stub must remain tied to the global disabled API stub registry.",
    ],
    [
      "no_request_argument: true",
      "Permission check API stub must document that the route does not accept a request object.",
    ],
    [
      "reads_request_body: false",
      "Permission check API stub must keep body reads disabled.",
    ],
    [
      "metadata_only_request: true",
      "Permission check API stub must keep the planned request metadata-only.",
    ],
    [
      "executes_actions: false",
      "Permission check API stub must not execute protected actions.",
    ],
    [
      "reads_page_body_text: false",
      "Permission check API stub must not read page body text.",
    ],
    [
      "reads_database_row_values: false",
      "Permission check API stub must not read database values.",
    ],
    [
      "reads_comment_bodies: false",
      "Permission check API stub must not read comment bodies.",
    ],
    [
      "reads_file_bytes: false",
      "Permission check API stub must not read file bytes.",
    ],
    [
      "reads_prompt_text: false",
      "Permission check API stub must not read prompt text.",
    ],
    [
      "reads_secret_values: false",
      "Permission check API stub must not read secrets.",
    ],
    [
      "schema_status: \"planned-metadata-only\"",
      "Permission check API stub must expose planned metadata-only request schema status.",
    ],
    [
      "allowed_fields: buildPermissionCheckRequestFields()",
      "Permission check API stub must reuse permission envelope request fields.",
    ],
    [
      "forbidden_fields: buildPermissionCheckForbiddenFields()",
      "Permission check API stub must reuse permission envelope forbidden fields.",
    ],
    [
      "schema_status: \"planned-decision-only\"",
      "Permission check API stub must expose planned decision-only response schema status.",
    ],
    [
      "allowed_fields: buildPermissionCheckResponseFields()",
      "Permission check API stub must reuse permission envelope response fields.",
    ],
    [
      "http_status: 501",
      "Permission check API stub must keep the disabled HTTP status explicit.",
    ],
    [
      "returns_permission_result: false",
      "Permission check API stub must not return executable permission results.",
    ],
    [
      "returns_allow_decision: false",
      "Permission check API stub must not return allow decisions.",
    ],
    [
      "returns_deny_decision: false",
      "Permission check API stub must not return deny decisions.",
    ],
    [
      "authenticated-actor",
      "Permission check API stub must include authenticated actor gate.",
    ],
    [
      "workspace-membership",
      "Permission check API stub must include workspace membership gate.",
    ],
    [
      "metadata-only-schema-validation",
      "Permission check API stub must include metadata-only schema validation gate.",
    ],
    [
      "high-risk-confirmation",
      "Permission check API stub must include high-risk confirmation gate.",
    ],
    [
      "audit-event-envelope",
      "Permission check API stub must include audit event gate.",
    ],
  ]) {
    assertSourceIncludes(
      files.permissionCheckApiStub,
      permissionCheckApiStub,
      snippet,
      message
    );
  }
  assertSourceIncludes(
    files.permissionCheckRequestValidator,
    permissionCheckRequestValidator,
    'format: "zhinote-permission-check-request-validation"',
    "Permission check request validator must expose a stable validation format."
  );
  assertSourceIncludes(
    files.permissionCheckRequestValidator,
    permissionCheckRequestValidator,
    "validatePermissionCheckMetadataRequest",
    "Permission check request validator must expose a reusable metadata-only validator."
  );
  assertSourceIncludes(
    files.permissionCheckRequestValidator,
    permissionCheckRequestValidator,
    "buildPermissionCheckValidatorReport",
    "Permission check request validator must expose a local fixture report."
  );
  assertSourceIncludes(
    files.permissionCheckRequestValidator,
    permissionCheckRequestValidator,
    "PERMISSION_CHECK_REQUEST_VALIDATOR_FIXTURES",
    "Permission check request validator must keep fixed local fixtures."
  );
  for (const [snippet, message] of [
    [
      "metadata-only-accepted",
      "Permission check request validator must accept metadata-only fixture shape.",
    ],
    [
      "rejected-forbidden-payload",
      "Permission check request validator must reject private payload fields.",
    ],
    [
      "rejected-unknown-field",
      "Permission check request validator must reject unknown top-level fields.",
    ],
    [
      "rejected-invalid-shape",
      "Permission check request validator must reject missing or invalid metadata.",
    ],
    [
      "can_execute_permission_now: false",
      "Permission check request validator must not execute permissions.",
    ],
    [
      "echoes_values: false",
      "Permission check request validator must not echo request values.",
    ],
    [
      "stores_raw_request: false",
      "Permission check request validator must not store raw requests.",
    ],
    [
      "reads_page_body_text: false",
      "Permission check request validator must not read page text.",
    ],
    [
      "reads_database_row_values: false",
      "Permission check request validator must not read database values.",
    ],
    [
      "reads_comment_bodies: false",
      "Permission check request validator must not read comments.",
    ],
    [
      "reads_file_bytes: false",
      "Permission check request validator must not read file bytes.",
    ],
    [
      "reads_prompt_text: false",
      "Permission check request validator must not read prompt text.",
    ],
    [
      "reads_secret_values: false",
      "Permission check request validator must not read secrets.",
    ],
    [
      "exposes_secret_values: false",
      "Permission check request validator must not expose secrets.",
    ],
    [
      "uploads_workspace_data: false",
      "Permission check request validator must not upload workspace data.",
    ],
    [
      "returns_raw_values: false",
      "Permission check request validator must not return raw values.",
    ],
    [
      "page-body-text-blocked",
      "Permission check request validator must include page text rejection fixture.",
    ],
    [
      "nested-prompt-text-blocked",
      "Permission check request validator must include nested prompt rejection fixture.",
    ],
    [
      "token-blocked",
      "Permission check request validator must include token rejection fixture.",
    ],
    [
      "unknown-payload-field-blocked",
      "Permission check request validator must include unknown payload rejection fixture.",
    ],
    [
      "missing-actor-blocked",
      "Permission check request validator must include missing actor rejection fixture.",
    ],
    [
      "collectForbiddenFieldPaths",
      "Permission check request validator must inspect nested field names.",
    ],
    [
      "buildPermissionCheckRequestFields",
      "Permission check request validator must reuse the envelope request field list.",
    ],
    [
      "buildPermissionCheckForbiddenFields",
      "Permission check request validator must reuse the envelope forbidden field list.",
    ],
  ]) {
    assertSourceIncludes(
      files.permissionCheckRequestValidator,
      permissionCheckRequestValidator,
      snippet,
      message
    );
  }
  assertSourceIncludes(
    files.permissionCheckApiStub,
    permissionCheckApiStub,
    "buildPermissionCheckValidatorReport",
    "Permission check API stub must include the local validator report."
  );
  assertSourceIncludes(
    files.permissionCheckApiStub,
    permissionCheckApiStub,
    "local_validator_report",
    "Permission check API stub must expose local validator fixture results."
  );
  assertSourceIncludes(
    files.permissionServerTestMatrix,
    permissionServerTestMatrix,
    'format: "zhinote-server-permission-enforcement-test-matrix"',
    "Permission server test matrix must expose a stable matrix format."
  );
  assertSourceIncludes(
    files.permissionServerTestMatrix,
    permissionServerTestMatrix,
    "buildPermissionServerTestMatrix",
    "Permission server test matrix must expose a reusable builder."
  );
  for (const [snippet, message] of [
    [
      'matrix_status: "local-server-test-contract-only"',
      "Permission server test matrix must remain local-only.",
    ],
    [
      "can_run_server_permission_tests_now: false",
      "Permission server test matrix must not run server tests yet.",
    ],
    [
      "can_enforce_permissions_now: false",
      "Permission server test matrix must not enforce permissions.",
    ],
    [
      "can_read_request_body_now: false",
      "Permission server test matrix must not read request bodies.",
    ],
    [
      "no_server_execution: true",
      "Permission server test matrix must not execute server behavior.",
    ],
    [
      "metadata_only_request: true",
      "Permission server test matrix must use metadata-only request fixtures.",
    ],
    [
      "stores_raw_request: false",
      "Permission server test matrix must not store raw request values.",
    ],
    [
      "returns_raw_values: false",
      "Permission server test matrix must not return raw values.",
    ],
    [
      "reads_page_body_text: false",
      "Permission server test matrix must not read page text.",
    ],
    [
      "reads_database_row_values: false",
      "Permission server test matrix must not read database values.",
    ],
    [
      "reads_comment_bodies: false",
      "Permission server test matrix must not read comments.",
    ],
    [
      "reads_file_bytes: false",
      "Permission server test matrix must not read file bytes.",
    ],
    [
      "reads_prompt_text: false",
      "Permission server test matrix must not read prompt text.",
    ],
    [
      "reads_secret_values: false",
      "Permission server test matrix must not read secrets.",
    ],
    [
      "writes_server_audit_log: false",
      "Permission server test matrix must not write audit logs.",
    ],
    [
      "uploads_workspace_data: false",
      "Permission server test matrix must not upload workspace data.",
    ],
    [
      "owner-cloud-sync-confirmed",
      "Permission server test matrix must include owner cloud sync confirmation case.",
    ],
    [
      "researcher-cloud-sync-denied",
      "Permission server test matrix must include researcher cloud sync denial case.",
    ],
    [
      "viewer-export-page-read-only",
      "Permission server test matrix must include viewer read-only export case.",
    ],
    [
      "viewer-edit-portfolio-denied",
      "Permission server test matrix must include viewer portfolio denial case.",
    ],
    [
      "viewer-ai-run-denied",
      "Permission server test matrix must include viewer AI denial case.",
    ],
    [
      "researcher-ai-run-confirmed",
      "Permission server test matrix must include researcher AI confirmation case.",
    ],
    [
      "owner-admin-confirmed",
      "Permission server test matrix must include owner admin confirmation case.",
    ],
    [
      "page-body-payload-rejected",
      "Permission server test matrix must include page body payload rejection case.",
    ],
    [
      "prompt-payload-rejected",
      "Permission server test matrix must include prompt payload rejection case.",
    ],
    [
      "validatePermissionCheckMetadataRequest",
      "Permission server test matrix must reuse metadata-only request validation.",
    ],
    [
      "evaluatePermissionDecision",
      "Permission server test matrix must reuse local permission decisions.",
    ],
    [
      "expected_http_status_after_enablement",
      "Permission server test matrix must define future HTTP expectations.",
    ],
    [
      "allow-after-confirmation",
      "Permission server test matrix must cover confirmation-based allows.",
    ],
    [
      "reject-request",
      "Permission server test matrix must cover request rejection.",
    ],
  ]) {
    assertSourceIncludes(
      files.permissionServerTestMatrix,
      permissionServerTestMatrix,
      snippet,
      message
    );
  }
  assertSourceIncludes(
    files.permissionCheckApiStub,
    permissionCheckApiStub,
    "buildPermissionServerTestMatrix",
    "Permission check API stub must include the local server test matrix."
  );
  assertSourceIncludes(
    files.permissionCheckApiStub,
    permissionCheckApiStub,
    "local_server_test_matrix",
    "Permission check API stub must expose the local server test matrix."
  );
  assertSourceIncludes(
    files.permissionServerReadiness,
    permissionServerReadiness,
    'format: "zhinote-server-permission-readiness-report"',
    "Permission server readiness report must expose a stable format."
  );
  assertSourceIncludes(
    files.permissionServerReadiness,
    permissionServerReadiness,
    "buildPermissionServerReadinessReport",
    "Permission server readiness report must expose a reusable builder."
  );
  for (const [snippet, message] of [
    [
      'report_status: "local-readiness-report-only"',
      "Permission server readiness report must remain local-only.",
    ],
    [
      'readiness_verdict: "not-ready"',
      "Permission server readiness report must not claim readiness.",
    ],
    [
      "can_enable_permission_endpoint_now: false",
      "Permission server readiness report must not enable the permission endpoint.",
    ],
    [
      "can_run_server_permission_tests_now: false",
      "Permission server readiness report must not run server permission tests.",
    ],
    [
      "can_enforce_permissions_now: false",
      "Permission server readiness report must not enforce permissions.",
    ],
    [
      "can_read_request_body_now: false",
      "Permission server readiness report must not read request bodies.",
    ],
    [
      "no_server_execution: true",
      "Permission server readiness report must not execute server behavior.",
    ],
    [
      "reads_request_body: false",
      "Permission server readiness report must not read request bodies.",
    ],
    [
      "stores_raw_request: false",
      "Permission server readiness report must not store raw requests.",
    ],
    [
      "returns_raw_values: false",
      "Permission server readiness report must not return raw values.",
    ],
    [
      "reads_page_body_text: false",
      "Permission server readiness report must not read page text.",
    ],
    [
      "reads_database_row_values: false",
      "Permission server readiness report must not read database values.",
    ],
    [
      "reads_comment_bodies: false",
      "Permission server readiness report must not read comments.",
    ],
    [
      "reads_file_bytes: false",
      "Permission server readiness report must not read file bytes.",
    ],
    [
      "reads_prompt_text: false",
      "Permission server readiness report must not read prompt text.",
    ],
    [
      "reads_secret_values: false",
      "Permission server readiness report must not read secrets.",
    ],
    [
      "writes_server_audit_log: false",
      "Permission server readiness report must not write audit logs.",
    ],
    [
      "uploads_workspace_data: false",
      "Permission server readiness report must not upload workspace data.",
    ],
    [
      "metadata-validator",
      "Permission server readiness report must include metadata validator gate.",
    ],
    [
      "server-matrix-coverage",
      "Permission server readiness report must include server matrix gate.",
    ],
    [
      "authenticated-actor",
      "Permission server readiness report must include authenticated actor gate.",
    ],
    [
      "workspace-membership",
      "Permission server readiness report must include workspace membership gate.",
    ],
    [
      "audit-envelope-linkage",
      "Permission server readiness report must include audit envelope linkage gate.",
    ],
    [
      "high-risk-confirmation",
      "Permission server readiness report must include high-risk confirmation gate.",
    ],
    [
      "input.validatorReport.summary.failed === 0",
      "Permission server readiness report must require validator fixtures to pass.",
    ],
    [
      "input.serverTestMatrix.summary.cases >= 9",
      "Permission server readiness report must require server matrix coverage.",
    ],
  ]) {
    assertSourceIncludes(
      files.permissionServerReadiness,
      permissionServerReadiness,
      snippet,
      message
    );
  }
  assertSourceIncludes(
    files.permissionCheckApiStub,
    permissionCheckApiStub,
    "buildPermissionServerReadinessReport",
    "Permission check API stub must include the local server readiness report."
  );
  assertSourceIncludes(
    files.permissionCheckApiStub,
    permissionCheckApiStub,
    "local_server_readiness_report",
    "Permission check API stub must expose the local server readiness report."
  );
  assertSourceIncludes(
    files.permissionCheckRoute,
    permissionCheckRoute,
    "buildPermissionCheckApiDisabledResponse",
    "Permission check route must use the dedicated disabled permission response."
  );
  assertSourceIncludes(
    files.permissionCheckRoute,
    permissionCheckRoute,
    "WEB_BETA_API_STUB_HTTP_STATUS",
    "Permission check route must keep the disabled Web Beta HTTP status."
  );
  assertSourceIncludes(
    files.permissionCheckRoute,
    permissionCheckRoute,
    "export async function POST()",
    "Permission check route must not accept a Request argument while disabled."
  );
  assertSourceExcludes(
    files.permissionCheckRoute,
    permissionCheckRoute,
    ".json()",
    "Permission check route must not parse request bodies while disabled."
  );
  assertSourceExcludes(
    files.permissionCheckRoute,
    permissionCheckRoute,
    "NextRequest",
    "Permission check route must not accept NextRequest while disabled."
  );
  assertSourceIncludes(
    files.smokeTestVerifier,
    smokeTestVerifier,
    "buildPermissionCheckApiDisabledResponse",
    "Smoke tests must require the dedicated permission check disabled response."
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
    files.privateFileStoragePolicy,
    privateFileStoragePolicy,
    'format: "zhinote-private-file-storage-policy"',
    "Private file storage policy must expose a stable export format."
  );
  assertSourceIncludes(
    files.privateFileStoragePolicy,
    privateFileStoragePolicy,
    "buildPrivateFileStoragePolicyReport",
    "Private file storage policy must expose a reusable builder."
  );
  assertSourceIncludes(
    files.privateFileStoragePolicy,
    privateFileStoragePolicy,
    'policy_status: "local-policy-only"',
    "Private file storage policy must remain local-only."
  );
  assertSourceIncludes(
    files.privateFileStoragePolicy,
    privateFileStoragePolicy,
    "file_sync_can_start_now: false",
    "Private file storage policy must not enable file sync."
  );
  for (const [snippet, message] of [
    [
      "reads_file_metadata_counts: true",
      "Private file storage policy may read local file counts.",
    ],
    [
      "reads_file_kind_summary: true",
      "Private file storage policy may read local file kind summaries.",
    ],
    [
      "reads_environment_presence: true",
      "Private file storage policy may read environment presence metadata.",
    ],
    [
      "reads_file_names: false",
      "Private file storage policy must not read file names.",
    ],
    [
      "reads_file_bytes: false",
      "Private file storage policy must not read file bytes.",
    ],
    [
      "reads_page_body_text: false",
      "Private file storage policy must not read page text.",
    ],
    [
      "creates_storage_buckets: false",
      "Private file storage policy must not create buckets.",
    ],
    [
      "creates_signed_urls: false",
      "Private file storage policy must not create signed URLs.",
    ],
    [
      "connects_cloud_services: false",
      "Private file storage policy must not connect cloud services.",
    ],
    [
      "writes_server_data: false",
      "Private file storage policy must not write server data.",
    ],
    [
      "uploads_files: false",
      "Private file storage policy must not upload files.",
    ],
    [
      "exposes_secret_values: false",
      "Private file storage policy must not expose secrets.",
    ],
    [
      "requires_owner_confirmation_before_file_sync: true",
      "Private file storage policy must require owner confirmation before file sync.",
    ],
  ]) {
    assertSourceIncludes(files.privateFileStoragePolicy, privateFileStoragePolicy, snippet, message);
  }
  for (const snippet of [
    "SUPABASE_STORAGE_BUCKET",
    "/api/files/presign",
    "private-source-files",
    "private-preview-artifacts",
    "signed_url_ttl_minutes",
    "public_access_forbidden: true",
    "file_bytes",
    "signed_download_url",
    "signed_upload_url",
    "public_url",
    '"private-bucket-policy"',
    '"signed-url-expiry"',
    '"checksum-and-size"',
    '"permission-and-audit"',
    '"owner-file-sync-confirmation"',
  ]) {
    assertSourceIncludes(
      files.privateFileStoragePolicy,
      privateFileStoragePolicy,
      snippet,
      "Private file storage policy must preserve storage gates and forbidden payload fields."
    );
  }
  assertSourceIncludes(
    files.launchChecklist,
    launchChecklist,
    "privateFileStoragePolicy",
    "Launch checklist must consume the private file storage policy."
  );
  assertSourceIncludes(
    files.launchChecklist,
    launchChecklist,
    "file sync cannot start",
    "Launch checklist must keep file sync disabled after policy drafting."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "buildPrivateFileStoragePolicyReport",
    "Sync UI must build the private file storage policy."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "handleExportPrivateFileStoragePolicy",
    "Sync UI must export the private file storage policy."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "私有文件存储政策",
    "Sync UI must render the private file storage policy panel."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "Export storage policy",
    "Sync UI must render the private file storage policy export button."
  );
  assertSourceIncludes(
    files.filePresignApiStub,
    filePresignApiStub,
    'format: "zhinote-file-presign-api-disabled"',
    "File presign API guard must expose a stable disabled response format."
  );
  assertSourceIncludes(
    files.filePresignApiStub,
    filePresignApiStub,
    "buildFilePresignApiDisabledResponse",
    "File presign API guard must expose a reusable disabled response builder."
  );
  for (const [snippet, message] of [
    ['api_id: "file-presign"', "File presign API guard must identify the file-presign route."],
    ['path: "/api/files/presign"', "File presign API guard must bind to /api/files/presign."],
    ['method: "POST"', "File presign API guard must document POST."],
    ['stub_status: "disabled-local-stub"', "File presign API guard must stay disabled."],
    ["can_create_signed_urls_now: false", "File presign API guard must not create signed URLs."],
    ["can_create_signed_upload_url_now: false", "File presign API guard must not create upload URLs."],
    ["can_create_signed_download_url_now: false", "File presign API guard must not create download URLs."],
    ["can_read_request_body_now: false", "File presign API guard must not read request bodies."],
    ["can_read_file_metadata_now: false", "File presign API guard must not read file metadata yet."],
    ["can_read_file_bytes_now: false", "File presign API guard must not read file bytes."],
    ["can_upload_files_now: false", "File presign API guard must not upload files."],
    ["can_expose_public_urls_now: false", "File presign API guard must not expose public URLs."],
    ["can_connect_storage_now: false", "File presign API guard must not connect storage."],
    ["can_write_audit_events_now: false", "File presign API guard must not write audit events."],
    ["no_request_argument: true", "File presign API guard must not accept a request argument."],
    ["reads_request_body: false", "File presign API guard must keep body reads disabled."],
    ["metadata_only_request: true", "File presign API guard must keep the future request metadata-only."],
    ["executes_actions: false", "File presign API guard must not execute actions."],
    ["reads_file_metadata: false", "File presign API guard must not read metadata in the disabled route."],
    ["reads_file_names: false", "File presign API guard must not read file names."],
    ["reads_file_bytes: false", "File presign API guard must not read file bytes."],
    ["reads_page_body_text: false", "File presign API guard must not read page text."],
    ["reads_database_row_values: false", "File presign API guard must not read database values."],
    ["reads_prompt_text: false", "File presign API guard must not read prompt text."],
    ["reads_secret_values: false", "File presign API guard must not read secrets."],
    ["creates_signed_urls: false", "File presign API guard must not create signed URLs."],
    ["creates_public_urls: false", "File presign API guard must not create public URLs."],
    ["connects_storage_service: false", "File presign API guard must not connect storage service."],
    ["uploads_files: false", "File presign API guard must not upload files."],
    ["writes_server_audit_log: false", "File presign API guard must not write audit logs."],
    ["uploads_workspace_data: false", "File presign API guard must not upload workspace data."],
    ["requires_private_bucket_before_enablement: true", "File presign API guard must require private bucket policy."],
    ["requires_authenticated_actor_before_enablement: true", "File presign API guard must require authenticated actors."],
    ["requires_workspace_membership_before_enablement: true", "File presign API guard must require workspace membership."],
    ["requires_permission_check_before_enablement: true", "File presign API guard must require permission checks."],
    ["requires_checksum_before_enablement: true", "File presign API guard must require checksums."],
    ["requires_owner_confirmation_before_enablement: true", "File presign API guard must require owner confirmation."],
    ["requires_audit_event_envelope_before_enablement: true", "File presign API guard must require audit envelopes."],
    ['schema_status: "planned-metadata-only"', "File presign API guard must expose metadata-only request schema."],
    ['schema_status: "planned-no-url-body"', "File presign API guard must expose a no-URL response schema."],
    ["http_status: 501", "File presign API guard must keep the disabled HTTP status explicit."],
    ["returns_signed_upload_url: false", "File presign API guard must not return signed upload URLs."],
    ["returns_signed_download_url: false", "File presign API guard must not return signed download URLs."],
    ["returns_public_url: false", "File presign API guard must not return public URLs."],
    ["returns_storage_credentials: false", "File presign API guard must not return storage credentials."],
    ["returns_file_bytes: false", "File presign API guard must not return file bytes."],
  ]) {
    assertSourceIncludes(files.filePresignApiStub, filePresignApiStub, snippet, message);
  }
  for (const snippet of [
    "buildWebBetaApiStubResponse(\"file-presign\")",
    "workspace_id",
    "file_id",
    "storage_key",
    "operation",
    "file_kind",
    "mime_type",
    "size_bytes",
    "sha256",
    "requested_ttl_seconds",
    "confirmation_receipt_id",
    "permission_decision_id",
    "audit_envelope_id",
    "file_bytes",
    "data_url",
    "base64",
    "signed_upload_url",
    "signed_download_url",
    "public_url",
    "file_text",
    "page_body_text",
    "database_cell_values",
    "prompt_text",
    "token",
    "cookie",
    "secret",
    "request_body_raw",
    'format: "zhinote-file-presign-validator-fixtures"',
    'validator_status: "not-executing-route"',
    '"metadata-upload-request"',
    '"file-bytes-blocked"',
    '"signed-url-blocked"',
    '"authenticated-workspace-membership"',
    '"private-bucket-policy"',
    '"checksum-and-size-validation"',
    '"server-permission-check"',
    '"metadata-only-audit-envelope"',
    '"owner-file-sync-confirmation"',
  ]) {
    assertSourceIncludes(
      files.filePresignApiStub,
      filePresignApiStub,
      snippet,
      "File presign API guard must preserve metadata schema, fixtures, and enablement gates."
    );
  }
  assertSourceIncludes(
    files.filePresignRoute,
    filePresignRoute,
    "buildFilePresignApiDisabledResponse",
    "File presign route must return the dedicated disabled response."
  );
  assertSourceIncludes(
    files.filePresignRoute,
    filePresignRoute,
    "WEB_BETA_API_STUB_HTTP_STATUS",
    "File presign route must keep the disabled Web Beta HTTP status."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "buildFilePresignApiDisabledResponse",
    "Sync UI must build the file presign API guard."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "handleExportFilePresignApiGuard",
    "Sync UI must export the file presign API guard."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "File presign API guard",
    "Sync UI must render the file presign API guard panel."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "Export file presign guard",
    "Sync UI must render the file presign guard export button."
  );
  assertSourceIncludes(
    files.webBetaStageGate,
    webBetaStageGate,
    'format: "zhinote-web-beta-stage-gate"',
    "Web Beta stage gate must expose a stable export format."
  );
  assertSourceIncludes(
    files.webBetaStageGate,
    webBetaStageGate,
    "buildWebBetaStageGateReport",
    "Web Beta stage gate must expose a reusable builder."
  );
  assertSourceIncludes(
    files.webBetaStageGate,
    webBetaStageGate,
    'gate_status: "local-stage-gate-only"',
    "Web Beta stage gate must remain a local-only report."
  );
  assertSourceIncludes(
    files.webBetaStageGate,
    webBetaStageGate,
    'launch_verdict: "not-ready"',
    "Web Beta stage gate must not claim launch readiness."
  );
  for (const [snippet, message] of [
    [
      "local_app_can_continue_now: true",
      "Stage gate must preserve local app continuity.",
    ],
    [
      "web_beta_can_launch_now: false",
      "Stage gate must not allow Web Beta launch.",
    ],
    [
      "cloud_sync_can_start_now: false",
      "Stage gate must not allow cloud sync.",
    ],
    [
      "reads_page_body_text: false",
      "Stage gate must not read page body text.",
    ],
    ["reads_file_bytes: false", "Stage gate must not read file bytes."],
    [
      "reads_secret_values: false",
      "Stage gate must not read secret values.",
    ],
    [
      "connects_cloud_services: false",
      "Stage gate must not connect cloud services.",
    ],
    ["deploys_app: false", "Stage gate must not deploy the app."],
    ["creates_accounts: false", "Stage gate must not create accounts."],
    [
      "writes_workspace_data: false",
      "Stage gate must not write workspace data.",
    ],
    ["writes_server_data: false", "Stage gate must not write server data."],
    [
      "uploads_workspace_data: false",
      "Stage gate must not upload workspace data.",
    ],
    ["enables_sync: false", "Stage gate must not enable sync."],
    ["enables_ai: false", "Stage gate must not enable AI execution."],
    [
      "requires_owner_confirmation_before_cloud: true",
      "Stage gate must require owner confirmation before cloud work.",
    ],
  ]) {
    assertSourceIncludes(files.webBetaStageGate, webBetaStageGate, snippet, message);
  }
  for (const gateId of [
    "local-workbench",
    "auth-session",
    "cloud-database",
    "private-file-storage",
    "sync-push-pull",
    "backup-restore",
    "permissions-audit",
    "deployment-release",
    "owner-beta-decision",
  ]) {
    assertSourceIncludes(
      files.webBetaStageGate,
      webBetaStageGate,
      `"${gateId}"`,
      `Stage gate ${gateId} must remain available.`
    );
  }
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "buildWebBetaStageGateReport",
    "Sync UI must build the Web Beta stage gate report."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "handleExportWebBetaStageGate",
    "Sync UI must export the Web Beta stage gate report."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "Web Beta 阶段门禁",
    "Sync UI must render the Web Beta stage gate panel."
  );
  for (const [snippet, message] of [
    [
      'format: "zhinote-web-beta-next-action-plan"',
      "Next action plan must expose a stable export format.",
    ],
    [
      "WebBetaNextActionOwner",
      "Next action plan must assign action ownership.",
    ],
    [
      "WebBetaNextActionExecutionPath",
      "Next action plan must classify local-first, cloud-required, and owner-decision paths.",
    ],
    [
      "WebBetaNextActionCloudDependency",
      "Next action plan must classify cloud dependencies.",
    ],
    [
      "can_start_locally",
      "Next action plan must say whether work can start locally.",
    ],
    [
      "verification_commands",
      "Next action plan must attach local verification commands.",
    ],
    [
      "completion_evidence",
      "Next action plan must list completion evidence.",
    ],
    [
      "forbidden_until_confirmed",
      "Next action plan must list forbidden actions before confirmation.",
    ],
    [
      "DEFAULT_FORBIDDEN_ACTIONS",
      "Next action plan must preserve default no-cloud/no-upload constraints.",
    ],
  ]) {
    assertSourceIncludes(files.webBetaNextActions, webBetaNextActions, snippet, message);
  }
  for (const [snippet, message] of [
    [
      "NextActionOwnerPill",
      "Sync UI must render owner labels for next actions.",
    ],
    [
      "NextActionExecutionPathPill",
      "Sync UI must render execution path labels for next actions.",
    ],
    [
      "NextActionCloudDependencyPill",
      "Sync UI must render cloud dependency labels for next actions.",
    ],
    [
      "Verification",
      "Sync UI must render verification commands for next actions.",
    ],
    [
      "Completion evidence",
      "Sync UI must render completion evidence for next actions.",
    ],
    [
      "Forbidden before confirmation",
      "Sync UI must render forbidden-before-confirmation boundaries.",
    ],
    [
      "summary.local_first",
      "Sync UI must summarize local-first next actions.",
    ],
  ]) {
    assertSourceIncludes(files.syncShell, syncShell, snippet, message);
  }
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
    files.webAlphaHandoffBundle,
    webAlphaHandoffBundle,
    'format: "zhinote-web-alpha-handoff-bundle"',
    "Web Alpha handoff bundle must expose a stable export format."
  );
  assertSourceIncludes(
    files.webAlphaHandoffBundle,
    webAlphaHandoffBundle,
    "buildWebAlphaHandoffBundle",
    "Web Alpha handoff bundle must expose a reusable builder."
  );
  for (const [snippet, message] of [
    [
      'bundle_status: "local-handoff-bundle-only"',
      "Handoff bundle must remain local-only.",
    ],
    [
      'release_verdict: "not-ready"',
      "Handoff bundle must not mark Web Alpha ready.",
    ],
    [
      "web_alpha_can_be_shared_now: false",
      "Handoff bundle must not approve sharing a preview.",
    ],
    [
      "cloud_sync_can_start_now: false",
      "Handoff bundle must not start cloud sync.",
    ],
    ["local_bundle_only: true", "Handoff bundle must stay local-only."],
    [
      "reads_launch_contracts: true",
      "Handoff bundle must read launch contract metadata.",
    ],
    [
      "reads_route_contracts: true",
      "Handoff bundle must read route contract metadata.",
    ],
    [
      "reads_smoke_test_plan: true",
      "Handoff bundle must read smoke plan metadata.",
    ],
    [
      "reads_page_body_text: false",
      "Handoff bundle must not read page body text.",
    ],
    [
      "reads_database_row_values: false",
      "Handoff bundle must not read database row values.",
    ],
    [
      "reads_file_bytes: false",
      "Handoff bundle must not read file bytes.",
    ],
    [
      "reads_secret_values: false",
      "Handoff bundle must not read secret values.",
    ],
    [
      "sends_network_requests: false",
      "Handoff bundle must not send network requests.",
    ],
    ["deploys_app: false", "Handoff bundle must not deploy the app."],
    [
      "connects_cloud_services: false",
      "Handoff bundle must not connect cloud services.",
    ],
    [
      "uploads_workspace_data: false",
      "Handoff bundle must not upload workspace data.",
    ],
    ["enables_sync: false", "Handoff bundle must not enable sync."],
    ["enables_ai: false", "Handoff bundle must not enable AI."],
    [
      "requires_owner_confirmation_before_preview: true",
      "Handoff bundle must require owner confirmation before preview.",
    ],
    [
      "requires_owner_confirmation_before_cloud: true",
      "Handoff bundle must require owner confirmation before cloud actions.",
    ],
    [
      "command_bundle",
      "Handoff bundle must include required local verification commands.",
    ],
    [
      "owner_decisions",
      "Handoff bundle must include owner decision gates.",
    ],
    [
      "excluded_payload_classes",
      "Handoff bundle must list private payload classes excluded from export.",
    ],
    [
      "npm run verify:web-beta:smoke",
      "Handoff bundle must include the Web Beta smoke verifier command.",
    ],
    [
      "verification_receipt_runner",
      "Handoff bundle must expose the one-command verification receipt runner.",
    ],
    [
      "npm run verify:web-alpha",
      "Handoff bundle must cite the Web Alpha verification receipt command.",
    ],
    [
      "holdings",
      "Handoff bundle must exclude holdings from handoff payloads.",
    ],
    [
      "trading_plans",
      "Handoff bundle must exclude trading plans from handoff payloads.",
    ],
  ]) {
    assertSourceIncludes(
      files.webAlphaHandoffBundle,
      webAlphaHandoffBundle,
      snippet,
      message
    );
  }
  assertSourceIncludes(
    files.packageJson,
    packageJson,
    '"verify:web-alpha"',
    "package.json must expose the Web Alpha verification receipt command."
  );
  assertSourceIncludes(
    files.webAlphaReceiptVerifier,
    webAlphaReceiptVerifier,
    'format: "zhinote-web-alpha-verification-receipt"',
    "Web Alpha receipt verifier must expose a stable receipt format."
  );
  assertSourceIncludes(
    files.webAlphaReceiptVerifier,
    webAlphaReceiptVerifier,
    "Web Alpha verification receipt passed",
    "Web Alpha receipt verifier must print a clear pass result."
  );
  for (const [snippet, message] of [
    [
      'release_verdict: status === "passed" ? "locally-verified-not-launched" : "failed"',
      "Receipt must distinguish local verification from launch approval.",
    ],
    [
      "web_alpha_can_be_shared_now: false",
      "Receipt must not approve preview sharing.",
    ],
    [
      "cloud_sync_can_start_now: false",
      "Receipt must not approve cloud sync.",
    ],
    [
      "local_receipt_only: true",
      "Receipt must remain local-only.",
    ],
    [
      "runs_local_commands: true",
      "Receipt verifier must identify that it runs local commands.",
    ],
    [
      "sends_network_requests: false",
      "Receipt verifier must not send network requests.",
    ],
    [
      "deploys_app: false",
      "Receipt verifier must not deploy the app.",
    ],
    [
      "connects_cloud_services: false",
      "Receipt verifier must not connect cloud services.",
    ],
    [
      "uploads_workspace_data: false",
      "Receipt verifier must not upload workspace data.",
    ],
    [
      "reads_page_body_text: false",
      "Receipt verifier must not read page bodies.",
    ],
    [
      "reads_database_row_values: false",
      "Receipt verifier must not read database row values.",
    ],
    [
      "reads_file_bytes: false",
      "Receipt verifier must not read file bytes.",
    ],
    [
      "reads_secret_values: false",
      "Receipt verifier must not read secrets.",
    ],
    [
      "enables_sync: false",
      "Receipt verifier must not enable sync.",
    ],
    [
      "enables_ai: false",
      "Receipt verifier must not enable AI.",
    ],
    [
      "shell: false",
      "Receipt verifier must run commands without shell interpolation.",
    ],
    [
      "npm run lint",
      "Receipt verifier must run lint.",
    ],
    [
      "npm run verify:web-beta",
      "Receipt verifier must run Web Beta contract verification.",
    ],
    [
      "npm run verify:web-beta:smoke",
      "Receipt verifier must run Web Beta smoke verification.",
    ],
    [
      "npm run verify:replay-harness",
      "Receipt verifier must run replay harness safety verification.",
    ],
    [
      "npm run build",
      "Receipt verifier must run production build.",
    ],
  ]) {
    assertSourceIncludes(
      files.webAlphaReceiptVerifier,
      webAlphaReceiptVerifier,
      snippet,
      message
    );
  }
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "buildWebAlphaHandoffBundle",
    "Sync UI must build the Web Alpha handoff bundle."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "handleExportWebAlphaHandoffBundle",
    "Sync UI must export the Web Alpha handoff bundle."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "Web Alpha handoff bundle",
    "Sync UI must render the Web Alpha handoff bundle panel."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "Export handoff bundle",
    "Sync UI must expose the handoff bundle export button."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "verification_receipt_runner",
    "Sync UI must render the Web Alpha verification receipt runner."
  );
  assertSourceIncludes(
    files.webAlphaLaunchDecisionReceipt,
    webAlphaLaunchDecisionReceipt,
    'format: "zhinote-web-alpha-launch-decision-receipt"',
    "Web Alpha launch decision receipt must expose a stable export format."
  );
  assertSourceIncludes(
    files.webAlphaLaunchDecisionReceipt,
    webAlphaLaunchDecisionReceipt,
    "buildWebAlphaLaunchDecisionReceipt",
    "Web Alpha launch decision receipt must expose a reusable builder."
  );
  for (const [snippet, message] of [
    [
      'receipt_status: "local-launch-decision-only"',
      "Launch decision receipt must stay local-only.",
    ],
    [
      'release_verdict: "no-go"',
      "Launch decision receipt must not approve preview launch.",
    ],
    [
      'decision: "continue-local-build-no-preview"',
      "Launch decision receipt must distinguish local progress from preview approval.",
    ],
    [
      "web_alpha_preview_can_be_shared_now: false",
      "Launch decision receipt must not approve preview sharing.",
    ],
    [
      "cloud_sync_can_start_now: false",
      "Launch decision receipt must not approve cloud sync.",
    ],
    [
      "local_receipt_only: true",
      "Launch decision receipt must be local-only.",
    ],
    [
      "reads_handoff_bundle: true",
      "Launch decision receipt must read handoff metadata.",
    ],
    [
      "reads_stage_gate_metadata: true",
      "Launch decision receipt must read stage gate metadata.",
    ],
    [
      "reads_next_action_plan: true",
      "Launch decision receipt must read next-action metadata.",
    ],
    [
      "reads_environment_metadata: true",
      "Launch decision receipt must read environment metadata.",
    ],
    [
      "reads_page_body_text: false",
      "Launch decision receipt must not read page body text.",
    ],
    [
      "reads_database_row_values: false",
      "Launch decision receipt must not read database row values.",
    ],
    [
      "reads_file_bytes: false",
      "Launch decision receipt must not read file bytes.",
    ],
    [
      "reads_secret_values: false",
      "Launch decision receipt must not read secrets.",
    ],
    [
      "reads_holding_details: false",
      "Launch decision receipt must not read holding details.",
    ],
    [
      "reads_trading_plans: false",
      "Launch decision receipt must not read trading plans.",
    ],
    [
      "sends_network_requests: false",
      "Launch decision receipt must not send network requests.",
    ],
    ["deploys_app: false", "Launch decision receipt must not deploy the app."],
    [
      "connects_cloud_services: false",
      "Launch decision receipt must not connect cloud services.",
    ],
    [
      "uploads_workspace_data: false",
      "Launch decision receipt must not upload workspace data.",
    ],
    ["enables_sync: false", "Launch decision receipt must not enable sync."],
    ["enables_ai: false", "Launch decision receipt must not enable AI."],
    [
      "forbidden_actions_before_owner_approval",
      "Launch decision receipt must list forbidden actions before owner approval.",
    ],
    [
      "share_web_alpha_preview",
      "Launch decision receipt must forbid preview sharing before owner approval.",
    ],
    [
      "enable_sync_push",
      "Launch decision receipt must forbid sync push before owner approval.",
    ],
    [
      "enable_ai_execution",
      "Launch decision receipt must forbid AI execution before owner approval.",
    ],
    [
      "excluded_payload_classes",
      "Launch decision receipt must carry excluded private payload classes.",
    ],
  ]) {
    assertSourceIncludes(
      files.webAlphaLaunchDecisionReceipt,
      webAlphaLaunchDecisionReceipt,
      snippet,
      message
    );
  }
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "buildWebAlphaLaunchDecisionReceipt",
    "Sync UI must build the Web Alpha launch decision receipt."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "handleExportWebAlphaLaunchDecisionReceipt",
    "Sync UI must export the Web Alpha launch decision receipt."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "Web Alpha launch decision receipt",
    "Sync UI must render the Web Alpha launch decision panel."
  );
  assertSourceIncludes(
    files.syncShell,
    syncShell,
    "Export launch decision",
    "Sync UI must expose the launch decision export button."
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
    files.remoteBaselineStageSchema,
    remoteBaselineStageSchema,
    'format: "zhinote-remote-baseline-stage-schema-contract"',
    "Remote baseline stage schema must expose a stable export format."
  );
  assertSourceIncludes(
    files.remoteBaselineStageSchema,
    remoteBaselineStageSchema,
    "buildRemoteBaselineStageSchemaContract",
    "Remote baseline stage schema must expose a reusable builder."
  );
  for (const [snippet, message] of [
    [
      "can_create_stage_schema_now: false",
      "Remote baseline stage schema must not create schema yet.",
    ],
    [
      "can_persist_cursor_proof_now: false",
      "Remote baseline stage schema must not persist cursor proof.",
    ],
    [
      "can_apply_sql_now: false",
      "Remote baseline stage schema must not apply SQL.",
    ],
    [
      "can_stage_remote_metadata_now: false",
      "Remote baseline stage schema must not stage remote metadata.",
    ],
    [
      "can_apply_staged_rows_now: false",
      "Remote baseline stage schema must not apply staged rows.",
    ],
    [
      'disabled_apply_path: "/api/cloud/migrations/apply"',
      "Remote baseline stage schema must keep migration apply disabled.",
    ],
    [
      "creates_database_migration: false",
      "Remote baseline stage schema must not create migrations.",
    ],
    ["applies_sql: false", "Remote baseline stage schema must not apply SQL."],
    [
      "connects_cloud_database: false",
      "Remote baseline stage schema must not connect cloud database.",
    ],
    [
      "writes_server_data: false",
      "Remote baseline stage schema must not write server data.",
    ],
    [
      "writes_workspace_data: false",
      "Remote baseline stage schema must not write workspace data.",
    ],
    [
      "uploads_workspace_data: false",
      "Remote baseline stage schema must not upload workspace data.",
    ],
    [
      "reads_remote_data: false",
      "Remote baseline stage schema must not read remote data.",
    ],
    [
      "reads_page_body_text: false",
      "Remote baseline stage schema must not read page bodies.",
    ],
    [
      "reads_database_row_values: false",
      "Remote baseline stage schema must not read database row values.",
    ],
    [
      "reads_comment_bodies: false",
      "Remote baseline stage schema must not read comment bodies.",
    ],
    [
      "reads_file_bytes: false",
      "Remote baseline stage schema must not read file bytes.",
    ],
    [
      "permits_payload_columns: false",
      "Remote baseline stage schema must not permit payload columns.",
    ],
    [
      "persists_cursor_proof: false",
      "Remote baseline stage schema must not persist cursor proof.",
    ],
    [
      "stages_remote_rows: false",
      "Remote baseline stage schema must not stage remote rows.",
    ],
    [
      "acknowledges_remote_rows: false",
      "Remote baseline stage schema must not acknowledge remote rows.",
    ],
    [
      "applies_remote_changes: false",
      "Remote baseline stage schema must not apply remote changes.",
    ],
    [
      "requires_owner_confirmation_before_apply: true",
      "Remote baseline stage schema must require owner confirmation.",
    ],
    [
      "requires_disposable_database_replay: true",
      "Remote baseline stage schema must require disposable database replay.",
    ],
    [
      "requires_rls_workspace_scope: true",
      "Remote baseline stage schema must require RLS workspace scope.",
    ],
    [
      "requires_payload_column_denylist: true",
      "Remote baseline stage schema must require payload denylist.",
    ],
    [
      "requires_cursor_monotonicity_proof: true",
      "Remote baseline stage schema must require cursor monotonicity proof.",
    ],
    [
      "requires_idempotency_proof: true",
      "Remote baseline stage schema must require idempotency proof.",
    ],
    [
      "requires_audit_event_before_stage: true",
      "Remote baseline stage schema must require audit event.",
    ],
    [
      "requires_permission_check_before_stage: true",
      "Remote baseline stage schema must require permission check.",
    ],
    [
      'table_name: "remote_baseline_stage"',
      "Remote baseline stage schema must define the stage table.",
    ],
    [
      'table_name: "remote_baseline_cursor_proof"',
      "Remote baseline stage schema must define cursor proof table.",
    ],
    [
      "remote_baseline_stage_status_check",
      "Remote baseline stage schema must define stage status check.",
    ],
    [
      "remote_baseline_stage_no_payload_columns",
      "Remote baseline stage schema must define payload column denylist.",
    ],
    [
      "remote_baseline_cursor_batch_unique",
      "Remote baseline stage schema must define cursor idempotency uniqueness.",
    ],
    [
      "idx_remote_baseline_stage_workspace_cursor",
      "Remote baseline stage schema must define workspace cursor index.",
    ],
    [
      "page_body_text",
      "Remote baseline stage schema must explicitly forbid page body text.",
    ],
    [
      "database_cell_values",
      "Remote baseline stage schema must explicitly forbid database values.",
    ],
    [
      "comment_body",
      "Remote baseline stage schema must explicitly forbid comment bodies.",
    ],
    [
      "file_bytes",
      "Remote baseline stage schema must explicitly forbid file bytes.",
    ],
    [
      "signed_download_url",
      "Remote baseline stage schema must explicitly forbid signed download URLs.",
    ],
  ]) {
    assertSourceIncludes(
      files.remoteBaselineStageSchema,
      remoteBaselineStageSchema,
      snippet,
      message
    );
  }
  for (const gateId of [
    "stage-schema-draft",
    "cursor-proof-draft",
    "payload-column-denylist",
    "rls-workspace-scope",
    "permission-check-before-stage",
    "audit-event-before-stage",
    "migration-apply-disabled",
    "rollback-before-apply",
  ]) {
    assertSourceIncludes(
      files.remoteBaselineStageSchema,
      remoteBaselineStageSchema,
      `"${gateId}"`,
      `Remote baseline stage schema gate ${gateId} must remain available.`
    );
  }
  assertSourceIncludes(
    files.remoteBaselineStageReplay,
    remoteBaselineStageReplay,
    'format: "zhinote-remote-baseline-stage-replay-contract"',
    "Remote baseline stage replay must expose a stable export format."
  );
  assertSourceIncludes(
    files.remoteBaselineStageReplay,
    remoteBaselineStageReplay,
    "buildRemoteBaselineStageReplayContract",
    "Remote baseline stage replay must expose a reusable builder."
  );
  for (const [snippet, message] of [
    ["can_run_replay_now: false", "Remote baseline stage replay must not run replay."],
    [
      "can_connect_disposable_database_now: false",
      "Remote baseline stage replay must not connect disposable database.",
    ],
    ["can_apply_sql_now: false", "Remote baseline stage replay must not apply SQL."],
    [
      "can_write_server_data_now: false",
      "Remote baseline stage replay must not write server data.",
    ],
    [
      "can_stage_remote_metadata_now: false",
      "Remote baseline stage replay must not stage remote metadata.",
    ],
    [
      'disabled_apply_path: "/api/cloud/migrations/apply"',
      "Remote baseline stage replay must keep migration apply disabled.",
    ],
    [
      'disabled_replay_endpoint: "/api/sync/replay-test"',
      "Remote baseline stage replay must keep replay endpoint disabled.",
    ],
    [
      "uses_disposable_data_only: true",
      "Remote baseline stage replay must use disposable data only.",
    ],
    [
      "creates_disposable_database: false",
      "Remote baseline stage replay must not create disposable database.",
    ],
    [
      "connects_cloud_database: false",
      "Remote baseline stage replay must not connect cloud database.",
    ],
    ["applies_sql: false", "Remote baseline stage replay must not apply SQL."],
    [
      "writes_server_data: false",
      "Remote baseline stage replay must not write server data.",
    ],
    [
      "writes_workspace_data: false",
      "Remote baseline stage replay must not write workspace data.",
    ],
    [
      "uploads_workspace_data: false",
      "Remote baseline stage replay must not upload workspace data.",
    ],
    [
      "reads_remote_data: false",
      "Remote baseline stage replay must not read remote data.",
    ],
    [
      "reads_page_body_text: false",
      "Remote baseline stage replay must not read page bodies.",
    ],
    [
      "reads_database_row_values: false",
      "Remote baseline stage replay must not read database row values.",
    ],
    [
      "reads_comment_bodies: false",
      "Remote baseline stage replay must not read comment bodies.",
    ],
    [
      "reads_file_bytes: false",
      "Remote baseline stage replay must not read file bytes.",
    ],
    [
      "stages_remote_rows: false",
      "Remote baseline stage replay must not stage remote rows.",
    ],
    [
      "acknowledges_remote_rows: false",
      "Remote baseline stage replay must not acknowledge remote rows.",
    ],
    [
      "applies_remote_changes: false",
      "Remote baseline stage replay must not apply remote changes.",
    ],
    [
      "requires_owner_confirmation_before_replay: true",
      "Remote baseline stage replay must require owner confirmation.",
    ],
    [
      "requires_empty_workspace_fixture: true",
      "Remote baseline stage replay must require empty workspace fixture.",
    ],
    [
      "requires_payload_denylist_assertion: true",
      "Remote baseline stage replay must require payload denylist assertion.",
    ],
    [
      "requires_rls_workspace_isolation_proof: true",
      "Remote baseline stage replay must require RLS proof.",
    ],
    [
      "requires_cursor_monotonicity_proof: true",
      "Remote baseline stage replay must require cursor monotonicity proof.",
    ],
    [
      "requires_idempotency_replay_proof: true",
      "Remote baseline stage replay must require idempotency proof.",
    ],
    [
      "requires_down_migration_rollback_proof: true",
      "Remote baseline stage replay must require rollback proof.",
    ],
    [
      "requires_audit_event_before_replay: true",
      "Remote baseline stage replay must require audit event.",
    ],
    [
      "requires_permission_check_before_replay: true",
      "Remote baseline stage replay must require permission check.",
    ],
    [
      "workspace-read-isolation",
      "Remote baseline stage replay must include workspace read isolation proof.",
    ],
    [
      "workspace-write-isolation",
      "Remote baseline stage replay must include workspace write isolation proof.",
    ],
    [
      "cursor-proof-isolation",
      "Remote baseline stage replay must include cursor proof isolation proof.",
    ],
    [
      "payload-denylist-schema-check",
      "Remote baseline stage replay must include payload denylist scenario.",
    ],
    [
      "cursor-monotonicity",
      "Remote baseline stage replay must include cursor monotonicity scenario.",
    ],
    [
      "idempotent-batch-replay",
      "Remote baseline stage replay must include idempotency scenario.",
    ],
    [
      "down-migration-rollback",
      "Remote baseline stage replay must include down migration rollback scenario.",
    ],
    [
      "page_body_text",
      "Remote baseline stage replay must explicitly forbid page body text.",
    ],
    [
      "database_cell_values",
      "Remote baseline stage replay must explicitly forbid database values.",
    ],
    [
      "comment_body",
      "Remote baseline stage replay must explicitly forbid comment bodies.",
    ],
    [
      "file_bytes",
      "Remote baseline stage replay must explicitly forbid file bytes.",
    ],
    [
      "signed_download_url",
      "Remote baseline stage replay must explicitly forbid signed download URLs.",
    ],
  ]) {
    assertSourceIncludes(
      files.remoteBaselineStageReplay,
      remoteBaselineStageReplay,
      snippet,
      message
    );
  }
  for (const gateId of [
    "owner-confirmation-before-replay",
    "disposable-database-available",
    "schema-sql-reviewed",
    "payload-denylist-proof",
    "rls-policy-proof",
    "cursor-proof-replay",
    "permission-check-before-replay",
    "audit-event-before-replay",
    "rollback-proof",
  ]) {
    assertSourceIncludes(
      files.remoteBaselineStageReplay,
      remoteBaselineStageReplay,
      `"${gateId}"`,
      `Remote baseline stage replay gate ${gateId} must remain available.`
    );
  }
  for (const [file, source, snippet, message] of [
    [
      files.typedConfirmation,
      typedConfirmation,
      '| "remote-baseline-stage-replay"',
      "Typed confirmation must reserve remote baseline stage replay as a high-risk action.",
    ],
    [
      files.highRiskActionRegistry,
      highRiskActionRegistry,
      '"remote-baseline-stage-replay": "ENABLE DISPOSABLE REPLAY"',
      "High-risk registry must require a typed phrase before disposable replay.",
    ],
    [
      files.highRiskActionRegistry,
      highRiskActionRegistry,
      'disabled_endpoint: "/api/sync/replay-test"',
      "High-risk registry must keep disposable replay endpoint disabled.",
    ],
    [
      files.highRiskActionRegistry,
      highRiskActionRegistry,
      "zhinote-remote-baseline-replay-confirmation",
      "High-risk registry must expose a local replay confirmation receipt prefix.",
    ],
  ]) {
    assertSourceIncludes(file, source, snippet, message);
  }
  assertSourceIncludes(
    files.remoteBaselineReplayFixture,
    remoteBaselineReplayFixture,
    'format: "zhinote-remote-baseline-replay-fixture-package"',
    "Remote baseline replay fixture must expose a stable export format."
  );
  assertSourceIncludes(
    files.remoteBaselineReplayFixture,
    remoteBaselineReplayFixture,
    "buildRemoteBaselineReplayFixturePackage",
    "Remote baseline replay fixture must expose a reusable builder."
  );
  for (const [snippet, message] of [
    [
      'package_status: "local-empty-fixture-package-only"',
      "Remote baseline replay fixture must stay local-only.",
    ],
    [
      "can_export_fixture_now: true",
      "Remote baseline replay fixture must allow local export.",
    ],
    [
      "can_run_replay_now: false",
      "Remote baseline replay fixture must not run replay.",
    ],
    [
      "can_connect_database_now: false",
      "Remote baseline replay fixture must not connect databases.",
    ],
    [
      "can_apply_sql_now: false",
      "Remote baseline replay fixture must not apply SQL.",
    ],
    [
      "can_stage_remote_rows_now: false",
      "Remote baseline replay fixture must not stage remote rows.",
    ],
    [
      "can_upload_workspace_data_now: false",
      "Remote baseline replay fixture must not upload workspace data.",
    ],
    [
      'disabled_replay_endpoint: "/api/sync/replay-test"',
      "Remote baseline replay fixture must keep replay endpoint disabled.",
    ],
    [
      "empty_workspace_fixture: true",
      "Remote baseline replay fixture must use empty workspace fixtures.",
    ],
    [
      "metadata_only_fixture: true",
      "Remote baseline replay fixture must remain metadata-only.",
    ],
    [
      "creates_database: false",
      "Remote baseline replay fixture must not create databases.",
    ],
    [
      "starts_network_request: false",
      "Remote baseline replay fixture must not start network requests.",
    ],
    [
      "reads_page_body_text: false",
      "Remote baseline replay fixture must not read page body text.",
    ],
    [
      "reads_database_row_values: false",
      "Remote baseline replay fixture must not read database values.",
    ],
    [
      "reads_comment_bodies: false",
      "Remote baseline replay fixture must not read comment bodies.",
    ],
    [
      "reads_file_bytes: false",
      "Remote baseline replay fixture must not read file bytes.",
    ],
    [
      "includes_page_body_text: false",
      "Remote baseline replay fixture must not include page body text.",
    ],
    [
      "includes_database_row_values: false",
      "Remote baseline replay fixture must not include database values.",
    ],
    [
      "includes_comment_bodies: false",
      "Remote baseline replay fixture must not include comment bodies.",
    ],
    [
      "includes_file_bytes: false",
      "Remote baseline replay fixture must not include file bytes.",
    ],
    [
      "includes_tokens: false",
      "Remote baseline replay fixture must not include tokens.",
    ],
    [
      "includes_cookies: false",
      "Remote baseline replay fixture must not include cookies.",
    ],
    [
      "stage_seed_rows: 0",
      "Remote baseline replay fixture must export zero stage seed rows.",
    ],
    [
      "cursor_proof_seed_rows: 0",
      "Remote baseline replay fixture must export zero cursor proof seed rows.",
    ],
    [
      "requires_owner_confirmation_receipt: true",
      "Remote baseline replay fixture must require owner confirmation receipt.",
    ],
    [
      "requires_phrase_match_before_real_replay: true",
      "Remote baseline replay fixture must require phrase match before real replay.",
    ],
    [
      "fixture-workspace-a-empty",
      "Remote baseline replay fixture must include workspace A empty fixture.",
    ],
    [
      "fixture-workspace-b-empty",
      "Remote baseline replay fixture must include workspace B empty fixture.",
    ],
    [
      "payload_column_denylist",
      "Remote baseline replay fixture must export payload denylist.",
    ],
    [
      "owner-confirmation-receipt",
      "Remote baseline replay fixture must validate owner confirmation receipt.",
    ],
    [
      "empty-workspace-fixtures",
      "Remote baseline replay fixture must validate empty workspace fixtures.",
    ],
    [
      "empty-fixture-users",
      "Remote baseline replay fixture must validate anonymous fixture users.",
    ],
    [
      "zero-stage-seed-rows",
      "Remote baseline replay fixture must validate zero stage rows.",
    ],
    [
      "zero-cursor-proof-seed-rows",
      "Remote baseline replay fixture must validate zero cursor rows.",
    ],
    [
      "payload-column-denylist",
      "Remote baseline replay fixture must validate payload denylist.",
    ],
    [
      "replay-endpoint-disabled",
      "Remote baseline replay fixture must validate disabled replay endpoint.",
    ],
  ]) {
    assertSourceIncludes(
      files.remoteBaselineReplayFixture,
      remoteBaselineReplayFixture,
      snippet,
      message
    );
  }
  assertSourceIncludes(
    files.remoteBaselineReplayHarness,
    remoteBaselineReplayHarness,
    'format: "zhinote-remote-baseline-replay-harness-preflight"',
    "Remote baseline replay harness must expose a stable export format."
  );
  assertSourceIncludes(
    files.remoteBaselineReplayHarness,
    remoteBaselineReplayHarness,
    "buildRemoteBaselineReplayHarnessPreflight",
    "Remote baseline replay harness must expose a reusable builder."
  );
  for (const [snippet, message] of [
    [
      'preflight_status: "local-harness-preflight-only"',
      "Remote baseline replay harness must stay local-only.",
    ],
    [
      "can_run_harness_now: false",
      "Remote baseline replay harness must not run harness.",
    ],
    [
      "can_connect_database_now: false",
      "Remote baseline replay harness must not connect databases.",
    ],
    [
      "can_apply_sql_now: false",
      "Remote baseline replay harness must not apply SQL.",
    ],
    [
      "can_write_server_data_now: false",
      "Remote baseline replay harness must not write server data.",
    ],
    [
      "can_stage_remote_rows_now: false",
      "Remote baseline replay harness must not stage remote rows.",
    ],
    [
      "can_upload_workspace_data_now: false",
      "Remote baseline replay harness must not upload workspace data.",
    ],
    [
      'disabled_replay_endpoint: "/api/sync/replay-test"',
      "Remote baseline replay harness must keep replay endpoint disabled.",
    ],
    [
      'disabled_apply_path: "/api/cloud/migrations/apply"',
      "Remote baseline replay harness must keep migration apply disabled.",
    ],
    [
      "local_preflight_only: true",
      "Remote baseline replay harness must remain local preflight only.",
    ],
    [
      "dry_run_only: true",
      "Remote baseline replay harness must remain dry-run only.",
    ],
    [
      "uses_empty_fixture_package: true",
      "Remote baseline replay harness must depend on empty fixture package.",
    ],
    [
      "starts_network_request: false",
      "Remote baseline replay harness must not start network requests.",
    ],
    [
      "creates_disposable_database: false",
      "Remote baseline replay harness must not create disposable database.",
    ],
    [
      "connects_cloud_database: false",
      "Remote baseline replay harness must not connect cloud database.",
    ],
    [
      "reads_page_body_text: false",
      "Remote baseline replay harness must not read page bodies.",
    ],
    [
      "reads_database_row_values: false",
      "Remote baseline replay harness must not read database values.",
    ],
    [
      "reads_comment_bodies: false",
      "Remote baseline replay harness must not read comment bodies.",
    ],
    [
      "reads_file_bytes: false",
      "Remote baseline replay harness must not read file bytes.",
    ],
    [
      "stages_remote_rows: false",
      "Remote baseline replay harness must not stage remote rows.",
    ],
    [
      "acknowledges_remote_rows: false",
      "Remote baseline replay harness must not acknowledge remote rows.",
    ],
    [
      "requires_owner_confirmation_receipt: true",
      "Remote baseline replay harness must require owner confirmation receipt.",
    ],
    [
      "requires_empty_fixture_package: true",
      "Remote baseline replay harness must require empty fixture package.",
    ],
    [
      "requires_payload_denylist: true",
      "Remote baseline replay harness must require payload denylist.",
    ],
    [
      "requires_permission_check_stub: true",
      "Remote baseline replay harness must require permission check stub.",
    ],
    [
      "requires_redacted_audit_event: true",
      "Remote baseline replay harness must require redacted audit event.",
    ],
    [
      "requires_rls_assertion_plan: true",
      "Remote baseline replay harness must require RLS assertion plan.",
    ],
    [
      "requires_rollback_assertion_plan: true",
      "Remote baseline replay harness must require rollback assertion plan.",
    ],
    [
      "load-empty-fixture-package",
      "Remote baseline replay harness must include fixture loading step.",
    ],
    [
      "verify-owner-receipt",
      "Remote baseline replay harness must include owner receipt verification step.",
    ],
    [
      "review-stage-schema-sql",
      "Remote baseline replay harness must include schema SQL review step.",
    ],
    [
      "plan-up-down-replay",
      "Remote baseline replay harness must include up/down replay plan.",
    ],
    [
      "plan-rls-isolation",
      "Remote baseline replay harness must include RLS isolation plan.",
    ],
    [
      "plan-cursor-idempotency",
      "Remote baseline replay harness must include cursor idempotency plan.",
    ],
    [
      "plan-rollback-proof",
      "Remote baseline replay harness must include rollback proof plan.",
    ],
    [
      "fixture-has-zero-payload",
      "Remote baseline replay harness must assert zero fixture payload.",
    ],
    [
      "denylist-covers-private-content",
      "Remote baseline replay harness must assert denylist coverage.",
    ],
    [
      "permission-check-not-live",
      "Remote baseline replay harness must keep permission checks non-live.",
    ],
    [
      "audit-event-not-live",
      "Remote baseline replay harness must keep audit events non-live.",
    ],
    [
      "disposable-database-gate",
      "Remote baseline replay harness must keep disposable database gate.",
    ],
    [
      "network-disabled-gate",
      "Remote baseline replay harness must keep network disabled gate.",
    ],
    [
      "rollback-before-apply-gate",
      "Remote baseline replay harness must keep rollback before apply gate.",
    ],
  ]) {
    assertSourceIncludes(
      files.remoteBaselineReplayHarness,
      remoteBaselineReplayHarness,
      snippet,
      message
    );
  }
  assertSourceIncludes(
    files.remoteBaselineReplayRunner,
    remoteBaselineReplayRunner,
    'format: "zhinote-remote-baseline-replay-runner-skeleton"',
    "Remote baseline replay runner must expose a stable export format."
  );
  assertSourceIncludes(
    files.remoteBaselineReplayRunner,
    remoteBaselineReplayRunner,
    "buildRemoteBaselineReplayRunnerSkeleton",
    "Remote baseline replay runner must expose a reusable builder."
  );
  for (const [snippet, message] of [
    [
      'runner_status: "disabled-runner-skeleton-only"',
      "Remote baseline replay runner must stay disabled.",
    ],
    [
      "can_export_runner_skeleton_now: true",
      "Remote baseline replay runner may only be exported locally.",
    ],
    [
      "can_run_runner_now: false",
      "Remote baseline replay runner must not run.",
    ],
    [
      "can_connect_database_now: false",
      "Remote baseline replay runner must not connect databases.",
    ],
    [
      "can_create_disposable_database_now: false",
      "Remote baseline replay runner must not create disposable databases.",
    ],
    [
      "can_apply_sql_now: false",
      "Remote baseline replay runner must not apply SQL.",
    ],
    [
      "can_start_network_request_now: false",
      "Remote baseline replay runner must not start network requests.",
    ],
    [
      "can_write_server_data_now: false",
      "Remote baseline replay runner must not write server data.",
    ],
    [
      "can_stage_remote_rows_now: false",
      "Remote baseline replay runner must not stage remote rows.",
    ],
    [
      "can_acknowledge_remote_rows_now: false",
      "Remote baseline replay runner must not acknowledge rows.",
    ],
    [
      "can_upload_workspace_data_now: false",
      "Remote baseline replay runner must not upload workspace data.",
    ],
    [
      'disabled_replay_endpoint: "/api/sync/replay-test"',
      "Remote baseline replay runner must keep replay endpoint disabled.",
    ],
    [
      'disabled_apply_path: "/api/cloud/migrations/apply"',
      "Remote baseline replay runner must keep migration apply disabled.",
    ],
    [
      "local_skeleton_only: true",
      "Remote baseline replay runner must remain a local skeleton.",
    ],
    [
      "runner_disabled_by_default: true",
      "Remote baseline replay runner must stay disabled by default.",
    ],
    [
      "export_only: true",
      "Remote baseline replay runner must stay export-only.",
    ],
    [
      "starts_network_request: false",
      "Remote baseline replay runner must not start network requests.",
    ],
    [
      "creates_disposable_database: false",
      "Remote baseline replay runner must not create disposable databases.",
    ],
    [
      "connects_cloud_database: false",
      "Remote baseline replay runner must not connect cloud database.",
    ],
    [
      "reads_page_body_text: false",
      "Remote baseline replay runner must not read page bodies.",
    ],
    [
      "reads_database_row_values: false",
      "Remote baseline replay runner must not read database values.",
    ],
    [
      "reads_comment_bodies: false",
      "Remote baseline replay runner must not read comment bodies.",
    ],
    [
      "reads_file_bytes: false",
      "Remote baseline replay runner must not read file bytes.",
    ],
    [
      "includes_tokens: false",
      "Remote baseline replay runner must not include tokens.",
    ],
    [
      "includes_cookies: false",
      "Remote baseline replay runner must not include cookies.",
    ],
    [
      "stages_remote_rows: false",
      "Remote baseline replay runner must not stage rows.",
    ],
    [
      "acknowledges_remote_rows: false",
      "Remote baseline replay runner must not acknowledge rows.",
    ],
    [
      "uses_production_workspace: false",
      "Remote baseline replay runner must not use production workspace data.",
    ],
    [
      "reads_environment_values: false",
      "Remote baseline replay runner must not read environment values.",
    ],
    [
      "uses_runtime_secrets: false",
      "Remote baseline replay runner must not use runtime secrets.",
    ],
    [
      "requires_owner_confirmation_receipt: true",
      "Remote baseline replay runner must require owner confirmation.",
    ],
    [
      "requires_empty_fixture_package: true",
      "Remote baseline replay runner must require empty fixture package.",
    ],
    [
      "requires_payload_denylist: true",
      "Remote baseline replay runner must require payload denylist.",
    ],
    [
      "requires_permission_check_stub: true",
      "Remote baseline replay runner must require permission check stub.",
    ],
    [
      "requires_redacted_audit_event: true",
      "Remote baseline replay runner must require redacted audit event.",
    ],
    [
      "requires_rls_assertion_plan: true",
      "Remote baseline replay runner must require RLS proof plan.",
    ],
    [
      "requires_rollback_assertion_plan: true",
      "Remote baseline replay runner must require rollback proof plan.",
    ],
    [
      "requires_owner_approval_to_enable: true",
      "Remote baseline replay runner must require owner approval before enablement.",
    ],
    [
      "export-runner-skeleton",
      "Remote baseline replay runner must keep local export entrypoint.",
    ],
    [
      "verify-replay-harness",
      "Remote baseline replay runner must keep safety verifier entrypoint.",
    ],
    [
      "open-disposable-database-connection",
      "Remote baseline replay runner must keep database connection blocked.",
    ],
    [
      "apply-up-sql",
      "Remote baseline replay runner must keep SQL apply blocked.",
    ],
    [
      "run-rls-isolation",
      "Remote baseline replay runner must keep RLS proof blocked.",
    ],
    [
      "run-cursor-idempotency",
      "Remote baseline replay runner must keep cursor proof blocked.",
    ],
    [
      "run-down-migration-rollback",
      "Remote baseline replay runner must keep rollback blocked.",
    ],
    [
      "private-payload-denylist",
      "Remote baseline replay runner must keep payload denylist refusal.",
    ],
  ]) {
    assertSourceIncludes(
      files.remoteBaselineReplayRunner,
      remoteBaselineReplayRunner,
      snippet,
      message
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
  for (const [snippet, message] of [
    [
      "buildRemoteBaselineStageSchemaContract",
      "Sync UI must build the remote baseline stage schema contract.",
    ],
    [
      "handleExportRemoteBaselineStageSchema",
      "Sync UI must export the remote baseline stage schema contract.",
    ],
    [
      "Remote baseline stage schema and cursor proof",
      "Sync UI must render the remote baseline stage schema panel.",
    ],
    [
      "Export stage schema",
      "Sync UI must expose the remote baseline stage schema export action.",
    ],
    [
      "RemoteBaselineStageSchemaTableCard",
      "Sync UI must render stage schema table draft.",
    ],
    [
      "RemoteBaselineCursorProofCard",
      "Sync UI must render cursor proof draft.",
    ],
    [
      "RemoteBaselineStageSchemaGateRow",
      "Sync UI must render schema proof gates.",
    ],
    [
      "RemoteBaselineStageSchemaSqlRow",
      "Sync UI must render schema SQL draft rows.",
    ],
    [
      "Final schema enablement",
      "Sync UI must render final schema enablement conditions.",
    ],
  ]) {
    assertSourceIncludes(files.syncShell, syncShell, snippet, message);
  }
  for (const [snippet, message] of [
    [
      "buildRemoteBaselineStageReplayContract",
      "Sync UI must build the remote baseline stage replay contract.",
    ],
    [
      "handleExportRemoteBaselineStageReplay",
      "Sync UI must export the remote baseline stage replay contract.",
    ],
    [
      "Remote baseline disposable replay and RLS proof",
      "Sync UI must render the remote baseline stage replay panel.",
    ],
    [
      "Export stage replay",
      "Sync UI must expose the remote baseline stage replay export action.",
    ],
    [
      "RemoteBaselineStageReplayScenarioRow",
      "Sync UI must render replay scenarios.",
    ],
    [
      "RemoteBaselineStageReplayGateRow",
      "Sync UI must render replay gates.",
    ],
    [
      "RemoteBaselineRlsProofRow",
      "Sync UI must render RLS proof rows.",
    ],
    [
      "RemoteBaselineRollbackProofRow",
      "Sync UI must render rollback proof rows.",
    ],
    [
      "Final replay enablement",
      "Sync UI must render final replay enablement conditions.",
    ],
    [
      "remoteBaselineReplayConfirmationReceipt",
      "Sync UI must build a disposable replay confirmation receipt.",
    ],
    [
      "handleExportRemoteBaselineReplayConfirmationReceipt",
      "Sync UI must export the disposable replay confirmation receipt.",
    ],
    [
      "Disposable replay owner confirmation receipt",
      "Sync UI must render the disposable replay confirmation panel.",
    ],
    [
      "Export replay receipt",
      "Sync UI must expose the disposable replay receipt export action.",
    ],
    [
      "remote-baseline-replay-confirmation",
      "Sync UI must track disposable replay receipt export state separately.",
    ],
    [
      'getHighRiskRequiredPhrase(\n          "remote-baseline-stage-replay"',
      "Sync UI must read the disposable replay confirmation phrase from the registry.",
    ],
    [
      "buildRemoteBaselineReplayFixturePackage",
      "Sync UI must build the disposable replay empty-fixture package.",
    ],
    [
      "handleExportRemoteBaselineReplayFixturePackage",
      "Sync UI must export the disposable replay empty-fixture package.",
    ],
    [
      "Empty-fixture replay package",
      "Sync UI must render the disposable replay empty-fixture panel.",
    ],
    [
      "Export empty fixture",
      "Sync UI must expose the disposable replay empty-fixture export action.",
    ],
    [
      "RemoteBaselineReplayFixtureValidationRow",
      "Sync UI must render empty-fixture validation rows.",
    ],
    [
      "remote-baseline-replay-fixture",
      "Sync UI must track empty-fixture export state separately.",
    ],
    [
      "payload_column_denylist",
      "Sync UI must render payload denylist from the empty-fixture package.",
    ],
    [
      "buildRemoteBaselineReplayHarnessPreflight",
      "Sync UI must build the disposable replay harness preflight.",
    ],
    [
      "handleExportRemoteBaselineReplayHarnessPreflight",
      "Sync UI must export the disposable replay harness preflight.",
    ],
    [
      "Disposable replay harness preflight",
      "Sync UI must render the disposable replay harness preflight panel.",
    ],
    [
      "Export harness preflight",
      "Sync UI must expose the disposable replay harness export action.",
    ],
    [
      "RemoteBaselineReplayHarnessStepRow",
      "Sync UI must render harness step rows.",
    ],
    [
      "RemoteBaselineReplayHarnessAssertionRow",
      "Sync UI must render harness assertion rows.",
    ],
    [
      "RemoteBaselineReplayHarnessGateRow",
      "Sync UI must render harness gate rows.",
    ],
    [
      "remote-baseline-replay-harness",
      "Sync UI must track harness export state separately.",
    ],
    [
      "buildRemoteBaselineReplayRunnerSkeleton",
      "Sync UI must build the disabled replay runner skeleton.",
    ],
    [
      "handleExportRemoteBaselineReplayRunnerSkeleton",
      "Sync UI must export the disabled replay runner skeleton.",
    ],
    [
      "Disabled replay runner skeleton",
      "Sync UI must render the disabled replay runner panel.",
    ],
    [
      "Export runner skeleton",
      "Sync UI must expose the disabled replay runner export action.",
    ],
    [
      "RemoteBaselineReplayRunnerEntryPointRow",
      "Sync UI must render replay runner entrypoint rows.",
    ],
    [
      "RemoteBaselineReplayRunnerPhaseRow",
      "Sync UI must render replay runner phase rows.",
    ],
    [
      "RemoteBaselineReplayRunnerRefusalRow",
      "Sync UI must render replay runner refusal rows.",
    ],
    [
      "remote-baseline-replay-runner",
      "Sync UI must track runner skeleton export state separately.",
    ],
  ]) {
    assertSourceIncludes(files.syncShell, syncShell, snippet, message);
  }
  for (const [snippet, message] of [
    [
      "buildAuditEventEnvelopeContract",
      "Sync UI must build the audit event envelope contract.",
    ],
    [
      "handleExportAuditEventEnvelope",
      "Sync UI must export the audit event envelope contract.",
    ],
    [
      "Audit event envelope",
      "Sync UI must render the audit event envelope panel.",
    ],
    [
      "Export audit envelope",
      "Sync UI must expose the audit envelope export action.",
    ],
    [
      "AuditEnvelopeTemplateRow",
      "Sync UI must render audit envelope template rows.",
    ],
    [
      "AuditEnvelopeRedactionCheckRow",
      "Sync UI must render audit envelope redaction rows.",
    ],
    [
      "AuditEnvelopeGateRow",
      "Sync UI must render audit envelope gates.",
    ],
    [
      "audit-envelope",
      "Sync UI must track audit envelope export state separately.",
    ],
  ]) {
    assertSourceIncludes(files.syncShell, syncShell, snippet, message);
  }
  for (const [snippet, message] of [
    [
      "buildPermissionCheckEnvelopeContract",
      "Sync UI must build the permission check envelope contract.",
    ],
    [
      "buildPermissionCheckValidatorReport",
      "Sync UI must build the permission check validator report.",
    ],
    [
      "buildPermissionServerTestMatrix",
      "Sync UI must build the permission server test matrix.",
    ],
    [
      "handleExportPermissionCheckEnvelope",
      "Sync UI must export the permission check envelope contract.",
    ],
    [
      "Permission check envelope",
      "Sync UI must render the permission check envelope panel.",
    ],
    [
      "Export permission envelope",
      "Sync UI must expose the permission envelope export action.",
    ],
    [
      "PermissionCheckScenarioRow",
      "Sync UI must render permission check scenario rows.",
    ],
    [
      "PermissionCheckGateRow",
      "Sync UI must render permission check gates.",
    ],
    [
      "PermissionCheckFieldRow",
      "Sync UI must render permission check fields.",
    ],
    [
      "Permission request validator",
      "Sync UI must render the permission check request validator panel.",
    ],
    [
      "PermissionCheckValidatorFixtureRow",
      "Sync UI must render permission check validator fixture rows.",
    ],
    [
      "Validator cases",
      "Sync UI must render permission validator coverage metric.",
    ],
    [
      "Server permission test matrix",
      "Sync UI must render the server permission test matrix panel.",
    ],
    [
      "PermissionServerMatrixCaseRow",
      "Sync UI must render server permission matrix case rows.",
    ],
    [
      "Server cases",
      "Sync UI must render server permission matrix coverage metric.",
    ],
    [
      "buildPermissionServerReadinessReport",
      "Sync UI must build the server permission readiness report.",
    ],
    [
      "Server permission readiness",
      "Sync UI must render the server permission readiness panel.",
    ],
    [
      "PermissionServerReadinessGateRow",
      "Sync UI must render server permission readiness gates.",
    ],
    [
      "Ready gates",
      "Sync UI must render server permission readiness metrics.",
    ],
    [
      "permission-check-envelope",
      "Sync UI must track permission envelope export state separately.",
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
    private_file_storage_policy_checks: 45,
    file_presign_api_guard_checks: 86,
    audit_events_api_guard_checks: 83,
    smoke_test_plan_checks: 16,
    smoke_test_verifier_checks: 5,
    replay_harness_safety_script_checks: 7,
    conflict_resolution_checks: 50,
    remote_baseline_checks: 43,
    remote_baseline_staging_checks: 49,
    remote_baseline_stage_schema_checks: 55,
    remote_baseline_stage_replay_checks: 67,
    remote_baseline_replay_fixture_checks: 48,
    remote_baseline_replay_harness_checks: 54,
    remote_baseline_replay_runner_checks: 52,
    audit_event_envelope_checks: 52,
    permission_check_envelope_checks: 68,
    permission_check_api_stub_checks: 46,
    permission_check_request_validator_checks: 28,
    permission_server_test_matrix_checks: 32,
    permission_server_readiness_checks: 29,
    web_beta_stage_gate_checks: 35,
    web_alpha_launch_decision_checks: 39,
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
