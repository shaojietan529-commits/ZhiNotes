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
const validatorPath = "src/lib/sync/cloudManifestCompareResponseValidator.ts";

const expectedFixtureIds = [
  "metadata-only-response-accepted",
  "workspace-content-response-rejected",
  "file-and-backup-response-rejected",
  "credential-response-rejected",
  "nested-forbidden-response-rejected",
  "missing-ids-response-rejected",
  "invalid-domain-summary-rejected",
  "missing-required-response-rejected",
];

const requiredBoundaryFalseFlags = [
  "reads_page_body_text",
  "reads_database_row_values",
  "reads_comment_bodies",
  "reads_version_snapshots",
  "reads_file_names",
  "reads_file_bytes",
  "reads_secret_values",
  "sends_network_requests",
  "connects_cloud_services",
  "writes_server_data",
  "uploads_workspace_data",
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
  const validatorExports = evaluateTsModule(validatorPath, {
    "@/lib/sync/cloudManifestCompareApiStub": compareExports,
    "@/lib/sync/cloudManifestDomainContract": domainExports,
  });

  const reportBuilder =
    validatorExports.buildCloudManifestCompareResponseValidatorReport;
  const validator = validatorExports.validateCloudManifestCompareResponse;

  if (typeof reportBuilder !== "function") {
    fail("buildCloudManifestCompareResponseValidatorReport must be exported.");
    printReceipt(null, "failed");
    process.exit(1);
  }
  if (typeof validator !== "function") {
    fail("validateCloudManifestCompareResponse must be exported.");
    printReceipt(null, "failed");
    process.exit(1);
  }

  const report = reportBuilder();
  verifyReport(report, compareExports);
  verifyDirectValidation(validator, compareExports);

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
    "zhinote-cloud-manifest-compare-response-validator-report",
    "Validator report must expose a stable report format."
  );
  assertEqual(
    report?.report_status,
    "local-fixture-report-only",
    "Validator report must stay local fixture only."
  );
  assertEqual(
    report?.validator_status,
    "metadata-only-local-validator",
    "Validator report must identify the metadata-only local validator."
  );
  assertBoolean(
    report?.cloud_compare_can_apply_now,
    false,
    "cloud_compare_can_apply_now"
  );
  assertBoolean(
    report?.cache_rebuild_can_start_now,
    false,
    "cache_rebuild_can_start_now"
  );
  assertBoolean(report?.cloud_sync_can_start_now, false, "cloud_sync_can_start_now");
  assertBoundary(report?.boundary);

  const fixtures = Array.isArray(report?.fixtures) ? report.fixtures : [];
  assertEqual(
    report?.summary?.fixtures,
    fixtures.length,
    "Fixture count must match."
  );
  assertEqual(
    report?.summary?.accepted,
    fixtures.filter((fixture) => fixture.actual_status === "accepted").length,
    "Accepted count must match fixtures."
  );
  assertEqual(
    report?.summary?.rejected,
    fixtures.filter((fixture) => fixture.actual_status === "rejected").length,
    "Rejected count must match fixtures."
  );
  const fixtureIds = fixtures.map((fixture) => fixture.id);
  for (const id of expectedFixtureIds) {
    if (!fixtureIds.includes(id)) fail(`Missing validator fixture ${id}.`);
  }
  if (new Set(fixtureIds).size !== fixtureIds.length) {
    fail("Validator fixture ids must be unique.");
  }
  for (const fixture of fixtures) {
    assertEqual(
      fixture.actual_status,
      fixture.expected_status,
      `${fixture.id} actual status must match expected.`
    );
    if (fixture.actual_status === "rejected" && fixture.issue_count <= 0) {
      fail(`${fixture.id} rejected fixture must have issues.`);
    }
  }

  const forbiddenFields = compareExports
    .buildCloudManifestCompareForbiddenResponseFields()
    .map((field) => field.field);
  const coveredForbiddenFields = unique(
    fixtures.flatMap((fixture) => fixture.forbidden_field_names)
  );
  assertEqual(
    report?.summary?.forbidden_fields_covered,
    coveredForbiddenFields.length,
    "Forbidden field coverage count must match fixture coverage."
  );
  for (const field of forbiddenFields) {
    if (!coveredForbiddenFields.includes(field)) {
      fail(`Validator fixtures must cover forbidden response field ${field}.`);
    }
  }
  assertEqual(
    report?.summary?.forbidden_fields,
    forbiddenFields.length,
    "Report forbidden field count must match compare schema."
  );
}

function verifyDirectValidation(validator, compareExports) {
  const acceptedResponse = {
    format: "zhinote-cloud-manifest-compare-result",
    api_id: "cloud-manifest-compare",
    decision_status: "requires-review",
    compare_receipt_id: "compare-demo",
    domain_summaries: [
      {
        domain_id: "pages",
        local_count: 1,
        remote_count: 1,
        local_watermark: "local-watermark-demo",
        remote_watermark: "remote-watermark-demo",
        manifest_hash_match: true,
        diff_status: "matched",
        missing_ids_count: 0,
        extra_ids_count: 0,
      },
    ],
    local_watermark: "local-watermark-demo",
    remote_watermark: "remote-watermark-demo",
    required_gates: ["owner-review"],
    reason_codes: ["owner-review-required"],
  };

  const accepted = validator(acceptedResponse);
  assertEqual(
    accepted.validation_status,
    "accepted",
    "Metadata-only synthetic response must be accepted."
  );
  assertBoolean(
    accepted.safe_to_apply_cloud_compare_now,
    false,
    "Accepted validation must still not approve cloud compare application."
  );
  assertBoolean(
    accepted.can_rebuild_cache_now,
    false,
    "Accepted validation must still not approve cache rebuild."
  );
  assertBoundary(accepted.boundary);

  const secretMarker = "DO_NOT_RETURN_THIS_PRIVATE_RESPONSE_MARKER";
  const rejected = validator({
    ...acceptedResponse,
    domain_summaries: [
      {
        ...acceptedResponse.domain_summaries[0],
        page_body_text: secretMarker,
      },
    ],
    token: secretMarker,
  });
  assertEqual(
    rejected.validation_status,
    "rejected",
    "Forbidden synthetic response must be rejected."
  );
  if (!rejected.forbidden_field_names.includes("page_body_text")) {
    fail("Rejected response must report nested page_body_text as forbidden.");
  }
  if (!rejected.forbidden_field_names.includes("token")) {
    fail("Rejected response must report token as forbidden.");
  }
  const serializedRejected = JSON.stringify(rejected);
  if (serializedRejected.includes(secretMarker)) {
    fail("Validation result must not return raw forbidden response values.");
  }

  const forbiddenFields = compareExports
    .buildCloudManifestCompareForbiddenResponseFields()
    .map((field) => field.field);
  for (const field of forbiddenFields) {
    const result = validator({
      ...acceptedResponse,
      [field]: secretMarker,
    });
    assertEqual(
      result.validation_status,
      "rejected",
      `Response with forbidden field ${field} must be rejected.`
    );
    if (!result.forbidden_field_names.includes(field)) {
      fail(`Response with forbidden field ${field} must report the field name.`);
    }
    if (JSON.stringify(result).includes(secretMarker)) {
      fail(`Validation result for ${field} must not return raw field value.`);
    }
  }
}

function assertBoundary(boundary) {
  if (!boundary || typeof boundary !== "object") {
    fail("Boundary must be an object.");
    return;
  }
  assertBoolean(boundary.validates_shape_only, true, "validates_shape_only");
  assertBoolean(boundary.returns_raw_values, false, "returns_raw_values");
  assertBoolean(
    boundary.permits_manifest_counts_only,
    true,
    "permits_manifest_counts_only"
  );
  assertBoolean(
    boundary.permits_ids_only_after_owner_review,
    false,
    "permits_ids_only_after_owner_review"
  );
  for (const flag of requiredBoundaryFalseFlags) {
    assertBoolean(boundary[flag], false, `boundary.${flag}`);
  }
}

function printReceipt(report, status) {
  const receipt = {
    format: "zhinote-cloud-manifest-response-validator-verification-receipt",
    format_version: 1,
    receipt_status: status,
    source_files: [compareStubPath, domainContractPath, validatorPath],
    local_app_can_continue_now: status === "passed",
    web_beta_can_launch_now: false,
    cache_rebuild_can_start_now: false,
    cloud_sync_can_start_now: false,
    privacy_note:
      "Generated locally by evaluating the cloud manifest compare response validator and synthetic fixtures in memory. It returns field names and issue codes only; it does not return raw values, page bodies, database rows, comments, version snapshots, file names, file bytes, secrets, missing ids, remote manifests, signed URLs, or cloud data. It does not send network requests, connect cloud services, write server data, upload workspace data, rebuild cache, enable sync, or enable AI.",
    boundary: {
      local_receipt_only: true,
      evaluates_validator_in_memory: true,
      returns_raw_values: false,
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
      returns_missing_ids: false,
      rebuilds_cache: false,
      enables_sync: false,
      enables_ai: false,
    },
    summary: {
      fixtures: report?.summary?.fixtures ?? null,
      accepted: report?.summary?.accepted ?? null,
      rejected: report?.summary?.rejected ?? null,
      forbidden_fields_covered:
        report?.summary?.forbidden_fields_covered ?? null,
      failures: failures.length,
    },
    failures,
  };

  const label =
    status === "passed"
      ? "Cloud manifest response validator verification passed"
      : "Cloud manifest response validator verification failed";
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

function unique(values) {
  return [...new Set(values)];
}

function fail(message) {
  failures.push(message);
}

run();
