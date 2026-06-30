#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import vm from "node:vm";
import ts from "typescript";

const root = process.cwd();
const webBetaStubPath = "src/lib/sync/webBetaApiStubs.ts";
const domainContractPath = "src/lib/sync/cloudManifestDomainContract.ts";
const compareStubPath = "src/lib/sync/cloudManifestCompareApiStub.ts";
const requestValidatorPath =
  "src/lib/sync/cloudManifestCompareRequestValidator.ts";
const responseValidatorPath =
  "src/lib/sync/cloudManifestCompareResponseValidator.ts";
const handshakeGatePath =
  "src/lib/sync/cloudManifestCompareHandshakeGate.ts";

const requiredCheckIds = [
  "request-validator-before-cloud",
  "response-validator-before-cache",
  "disabled-api-guard",
  "owner-review-before-missing-ids",
  "no-cache-rebuild-before-validated-response",
];

const requiredBoundaryFalseFlags = [
  "reads_route_response_over_http",
  "sends_network_requests",
  "connects_cloud_services",
  "reads_remote_manifest",
  "reads_workspace_content",
  "writes_server_data",
  "uploads_workspace_data",
  "reads_page_body_text",
  "reads_database_row_values",
  "reads_comment_bodies",
  "reads_version_snapshots",
  "reads_file_names",
  "reads_file_bytes",
  "reads_secret_values",
  "returns_raw_values",
  "returns_missing_ids",
  "rebuilds_cache",
  "enables_sync",
  "enables_ai",
];

const failures = [];

function run() {
  const webBetaExports = evaluateTsModule(webBetaStubPath);
  const domainExports = evaluateTsModule(domainContractPath);
  const compareExports = evaluateTsModule(compareStubPath, {
    "@/lib/sync/webBetaApiStubs": webBetaExports,
    "@/lib/sync/cloudManifestDomainContract": domainExports,
  });
  const requestValidatorExports = evaluateTsModule(requestValidatorPath, {
    "@/lib/sync/cloudManifestCompareApiStub": compareExports,
    "@/lib/sync/cloudManifestDomainContract": domainExports,
  });
  const responseValidatorExports = evaluateTsModule(responseValidatorPath, {
    "@/lib/sync/cloudManifestCompareApiStub": compareExports,
    "@/lib/sync/cloudManifestDomainContract": domainExports,
  });
  const handshakeExports = evaluateTsModule(handshakeGatePath, {
    "@/lib/sync/cloudManifestCompareApiStub": compareExports,
    "@/lib/sync/cloudManifestCompareRequestValidator": requestValidatorExports,
    "@/lib/sync/cloudManifestCompareResponseValidator": responseValidatorExports,
  });

  const builder =
    handshakeExports.buildCloudManifestCompareHandshakeGateReport;
  if (typeof builder !== "function") {
    fail("buildCloudManifestCompareHandshakeGateReport must be exported.");
    printReceipt(null, "failed");
    process.exit(1);
  }

  const report = builder();
  verifyReport(report, compareExports);

  if (failures.length > 0) {
    printReceipt(report, "failed");
    process.exit(1);
  }

  printReceipt(report, "passed");
}

function evaluateTsModule(modulePath, dependencyMap = {}) {
  const source = readFileSync(path.join(root, modulePath), "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: modulePath,
    reportDiagnostics: true,
  });

  const diagnostics = transpiled.diagnostics ?? [];
  if (diagnostics.length > 0) {
    for (const diagnostic of diagnostics) {
      fail(
        `${modulePath} TypeScript transpile diagnostic ${diagnostic.code}: ${diagnostic.messageText}`
      );
    }
  }

  const exportsObject = {};
  const moduleObject = { exports: exportsObject };
  const context = vm.createContext({
    Date,
    Number,
    Object,
    Set,
    exports: exportsObject,
    module: moduleObject,
    require: (moduleId) => {
      if (moduleId in dependencyMap) return dependencyMap[moduleId];
      throw new Error(`${modulePath} attempted to require ${moduleId}.`);
    },
  });

  new vm.Script(transpiled.outputText, {
    filename: modulePath,
  }).runInContext(context);

  return moduleObject.exports;
}

function verifyReport(report, compareExports) {
  assertEqual(
    report?.format,
    "zhinote-cloud-manifest-compare-handshake-gate",
    "Handshake gate must expose a stable format."
  );
  assertEqual(
    report?.gate_status,
    "local-handshake-gate-only",
    "Handshake gate must stay local only."
  );
  assertBoolean(
    report?.compare_handshake_can_start_now,
    false,
    "compare_handshake_can_start_now"
  );
  assertBoolean(
    report?.cloud_compare_can_execute_now,
    false,
    "cloud_compare_can_execute_now"
  );
  assertBoolean(
    report?.cache_rebuild_can_start_now,
    false,
    "cache_rebuild_can_start_now"
  );
  assertBoolean(report?.cloud_sync_can_start_now, false, "cloud_sync_can_start_now");
  assertBoundary(report?.boundary);

  const checks = Array.isArray(report?.checks) ? report.checks : [];
  assertEqual(report?.summary?.checks, checks.length, "Check count must match.");
  assertEqual(
    report?.summary?.blocked_checks,
    checks.filter((check) => check.status === "blocked").length,
    "Blocked check count must match."
  );
  assertEqual(
    report?.summary?.ready_for_owner_review_checks,
    checks.filter((check) => check.status === "ready-for-owner-review").length,
    "Owner-review check count must match."
  );

  const checkIds = checks.map((check) => check.id);
  for (const id of requiredCheckIds) {
    if (!checkIds.includes(id)) fail(`Missing handshake check ${id}.`);
  }
  if (new Set(checkIds).size !== checkIds.length) {
    fail("Handshake check ids must be unique.");
  }
  if (!checks.some((check) => check.status === "blocked")) {
    fail("Handshake gate must keep at least one blocked check.");
  }
  if (!checks.some((check) => check.status === "ready-for-owner-review")) {
    fail("Handshake gate must expose owner review prep checks.");
  }

  const forbiddenRequestFields = compareExports
    .buildCloudManifestCompareForbiddenFields()
    .map((field) => field.field);
  const forbiddenResponseFields = compareExports
    .buildCloudManifestCompareForbiddenResponseFields()
    .map((field) => field.field);
  assertEqual(
    report?.summary?.request_forbidden_fields_covered,
    forbiddenRequestFields.length,
    "Handshake gate must carry full request forbidden field coverage."
  );
  assertEqual(
    report?.summary?.response_forbidden_fields_covered,
    forbiddenResponseFields.length,
    "Handshake gate must carry full response forbidden field coverage."
  );
  if (report?.summary?.api_guard_enablement_gates < 7) {
    fail("Handshake gate must carry all API enablement gates.");
  }
  if (report?.summary?.request_rejections < 1) {
    fail("Handshake gate must include request rejection fixtures.");
  }
  if (report?.summary?.response_rejections < 1) {
    fail("Handshake gate must include response rejection fixtures.");
  }
}

function assertBoundary(boundary) {
  if (!boundary || typeof boundary !== "object") {
    fail("Boundary must be an object.");
    return;
  }
  assertBoolean(boundary.local_report_only, true, "local_report_only");
  assertBoolean(
    boundary.uses_synthetic_fixtures_only,
    true,
    "uses_synthetic_fixtures_only"
  );
  assertBoolean(
    boundary.requires_owner_review_before_enablement,
    true,
    "requires_owner_review_before_enablement"
  );
  for (const flag of requiredBoundaryFalseFlags) {
    assertBoolean(boundary[flag], false, `boundary.${flag}`);
  }
}

function printReceipt(report, status) {
  const receipt = {
    format: "zhinote-cloud-manifest-handshake-gate-verification-receipt",
    format_version: 1,
    receipt_status: status,
    source_files: [
      compareStubPath,
      requestValidatorPath,
      responseValidatorPath,
      handshakeGatePath,
    ],
    local_app_can_continue_now: status === "passed",
    web_beta_can_launch_now: false,
    compare_handshake_can_start_now: false,
    cache_rebuild_can_start_now: false,
    cloud_sync_can_start_now: false,
    privacy_note:
      "Generated locally by evaluating the cloud manifest compare handshake gate with synthetic fixture reports and the disabled API guard in memory. It does not read route responses, send network requests, connect cloud services, read remote manifests, read workspace content, write server data, upload workspace data, rebuild cache, enable sync, or enable AI.",
    boundary: {
      local_receipt_only: true,
      evaluates_gate_in_memory: true,
      reads_route_response_over_http: false,
      sends_network_requests: false,
      connects_cloud_services: false,
      reads_remote_manifest: false,
      reads_workspace_content: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      reads_page_body_text: false,
      reads_database_row_values: false,
      reads_comment_bodies: false,
      reads_version_snapshots: false,
      reads_file_names: false,
      reads_file_bytes: false,
      reads_secret_values: false,
      returns_raw_values: false,
      returns_missing_ids: false,
      rebuilds_cache: false,
      enables_sync: false,
      enables_ai: false,
    },
    summary: {
      request_fixtures: report?.summary?.request_fixtures ?? null,
      response_fixtures: report?.summary?.response_fixtures ?? null,
      checks: report?.summary?.checks ?? null,
      blocked_checks: report?.summary?.blocked_checks ?? null,
      failures: failures.length,
    },
    failures,
  };

  const label =
    status === "passed"
      ? "Cloud manifest handshake gate verification passed"
      : "Cloud manifest handshake gate verification failed";
  console.log(label);
  console.log(JSON.stringify(receipt, null, 2));
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    fail(`${message} Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}.`);
  }
}

function assertBoolean(actual, expected, label) {
  if (actual !== expected) fail(`${label} must be ${expected}.`);
}

function fail(message) {
  failures.push(message);
}

run();
