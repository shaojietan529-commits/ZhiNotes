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

const requiredTopLevelFalseFlags = [
  "can_compare_manifest_now",
  "can_read_query_now",
  "can_connect_cloud_now",
  "can_read_remote_manifest_now",
  "can_read_workspace_content_now",
  "can_write_server_data_now",
  "can_upload_workspace_data_now",
];

const requiredBoundaryFalseFlags = [
  "reads_query",
  "connects_cloud_services",
  "reads_remote_manifest",
  "reads_workspace_content",
  "reads_page_body_text",
  "reads_database_row_values",
  "reads_comment_bodies",
  "reads_file_bytes",
  "reads_secret_values",
  "writes_server_data",
  "writes_workspace_data",
  "uploads_workspace_data",
  "deletes_local_rows",
  "overwrites_local_cache",
  "returns_manifest_counts",
  "returns_missing_ids",
  "returns_workspace_content",
];

const requiredBoundaryTrueFlags = [
  "no_request_argument",
  "endpoint_disabled",
  "requires_authenticated_session_before_enablement",
  "requires_workspace_membership_before_enablement",
  "requires_metadata_only_manifest_before_enablement",
  "requires_permission_check_before_enablement",
  "requires_audit_event_before_enablement",
  "requires_rate_limit_before_enablement",
  "requires_owner_review_before_migration",
];

const requiredForbiddenRequestFields = [
  "page_body_text",
  "block_text",
  "database_cell_values",
  "comment_body",
  "version_snapshot",
  "file_bytes",
  "backup_payload",
  "raw_local_manifest",
  "raw_remote_manifest",
  "signed_upload_url",
  "signed_download_url",
  "local_file_path",
  "token",
  "cookie",
  "password",
  "secret_values",
  "apply_migration",
  "overwrite_cloud",
  "overwrite_local",
  "delete_remote",
  "delete_local",
];

const requiredForbiddenResponseFields = [
  "page_body_text",
  "block_text",
  "database_cell_values",
  "comment_body",
  "version_snapshot",
  "file_bytes",
  "backup_payload",
  "signed_upload_url",
  "signed_download_url",
  "token",
  "cookie",
  "secret_values",
];

const requiredFixtureIds = [
  "metadata-manifest-compare-request",
  "workspace-content-blocked",
  "file-and-backup-payload-blocked",
  "credential-fields-blocked",
  "write-and-delete-actions-blocked",
];

const requiredGateIds = [
  "authenticated-session",
  "workspace-membership",
  "metadata-only-manifest",
  "permission-check",
  "audit-event",
  "rate-limit",
  "owner-review",
];

const failures = [];

function run() {
  const webBetaExports = evaluateTsModule(webBetaStubPath);
  const domainExports = evaluateTsModule(domainContractPath);
  const compareExports = evaluateTsModule(compareStubPath, {
    "@/lib/sync/webBetaApiStubs": webBetaExports,
    "@/lib/sync/cloudManifestDomainContract": domainExports,
  });

  const builder = compareExports.buildCloudManifestCompareApiDisabledResponse;
  if (typeof builder !== "function") {
    fail("buildCloudManifestCompareApiDisabledResponse must be exported.");
    printReceipt(null, "failed");
    process.exit(1);
  }
  assertEqual(
    builder.length,
    0,
    "Disabled manifest compare builder must not accept a request argument."
  );

  const response = builder();
  verifyResponse(response);

  if (failures.length > 0) {
    printReceipt(response, "failed");
    process.exit(1);
  }

  printReceipt(response, "passed");
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

function verifyResponse(response) {
  assertEqual(
    response?.format,
    "zhinote-cloud-manifest-compare-api-disabled",
    "Cloud manifest compare API guard must expose a stable disabled format."
  );
  assertEqual(response?.format_version, 1, "Format version must be stable.");
  assertEqual(
    response?.api_id,
    "cloud-manifest-compare",
    "API id must identify cloud manifest compare."
  );
  assertEqual(
    response?.path,
    "/api/cloud/manifest/compare?workspaceId=:workspaceId",
    "API path must stay bound to the manifest compare route."
  );
  assertEqual(response?.method, "GET", "Manifest compare must stay GET.");
  assertEqual(
    response?.stub_status,
    "disabled-local-stub",
    "Manifest compare API guard must stay disabled."
  );

  for (const flag of requiredTopLevelFalseFlags) {
    assertBoolean(response?.[flag], false, flag);
  }

  verifyBaseStub(response?.base_stub);
  verifyBoundary(response?.boundary);
  verifyRequestSchema(response?.request_schema);
  verifyResponseSchema(response?.response_schema);
  verifyValidatorReport(response?.local_validator_report);
  verifyDomainContractReport(response?.domain_contract_report);
  verifyDisabledResponseContract(response?.disabled_response_contract);
  verifyEnablementGates(response?.enablement_gates);
}

function verifyBaseStub(baseStub) {
  assertEqual(
    baseStub?.format,
    "zhinote-web-beta-api-stub",
    "Base Web Beta stub must be included."
  );
  assertEqual(
    baseStub?.api_id,
    "cloud-manifest-compare",
    "Base Web Beta stub must match manifest compare."
  );
  assertEqual(
    baseStub?.stub_status,
    "disabled-local-stub",
    "Base Web Beta stub must stay disabled."
  );
  for (const [field, expected] of [
    ["can_accept_workspace_data", false],
    ["reads_request_body", false],
    ["writes_server_data", false],
    ["uploads_data", false],
  ]) {
    assertBoolean(baseStub?.[field], expected, `base_stub.${field}`);
  }
}

function verifyBoundary(boundary) {
  if (!boundary || typeof boundary !== "object") {
    fail("Boundary must be an object.");
    return;
  }
  for (const flag of requiredBoundaryFalseFlags) {
    assertBoolean(boundary[flag], false, `boundary.${flag}`);
  }
  for (const flag of requiredBoundaryTrueFlags) {
    assertBoolean(boundary[flag], true, `boundary.${flag}`);
  }
}

function verifyRequestSchema(requestSchema) {
  assertEqual(
    requestSchema?.schema_status,
    "planned-query-metadata-only",
    "Request schema must stay planned metadata-only."
  );
  assertNonEmptyArray(
    requestSchema?.allowed_fields,
    "request_schema.allowed_fields"
  );
  assertForbiddenFields(
    requestSchema?.forbidden_fields,
    requiredForbiddenRequestFields,
    "request_schema.forbidden_fields"
  );
}

function verifyResponseSchema(responseSchema) {
  assertEqual(
    responseSchema?.schema_status,
    "planned-manifest-summary-only",
    "Response schema must stay planned manifest-summary-only."
  );
  assertFieldIncluded(
    responseSchema?.allowed_fields,
    "domain_contract_report",
    "response_schema.allowed_fields"
  );
  assertForbiddenFields(
    responseSchema?.forbidden_fields,
    requiredForbiddenResponseFields,
    "response_schema.forbidden_fields"
  );
}

function verifyValidatorReport(report) {
  assertEqual(
    report?.format,
    "zhinote-cloud-manifest-compare-api-validator-fixtures",
    "Validator report must expose a stable fixture format."
  );
  assertEqual(
    report?.report_status,
    "local-fixture-report-only",
    "Validator report must stay local fixture only."
  );
  assertEqual(
    report?.validator_status,
    "not-executing-route",
    "Validator report must not execute the route."
  );

  const fixtures = Array.isArray(report?.fixtures) ? report.fixtures : [];
  assertEqual(
    report?.summary?.fixtures,
    fixtures.length,
    "Validator summary fixture count must match fixture list."
  );
  assertEqual(
    report?.summary?.accepted,
    fixtures.filter((fixture) => fixture.actual_status === "accepted").length,
    "Validator accepted count must match fixture list."
  );
  assertEqual(
    report?.summary?.rejected,
    fixtures.filter((fixture) => fixture.actual_status === "rejected").length,
    "Validator rejected count must match fixture list."
  );
  assertEqual(
    report?.summary?.forbidden_payload_rejections,
    fixtures.filter(
      (fixture) =>
        fixture.actual_status === "rejected" &&
        fixture.contains_forbidden_payload
    ).length,
    "Validator forbidden payload rejection count must match fixture list."
  );

  const fixtureIds = fixtures.map((fixture) => fixture.id);
  for (const id of requiredFixtureIds) {
    if (!fixtureIds.includes(id)) fail(`Validator fixtures missing ${id}.`);
  }
  if (new Set(fixtureIds).size !== fixtureIds.length) {
    fail("Validator fixture ids must be unique.");
  }

  for (const fixture of fixtures) {
    assertEqual(
      fixture.actual_status,
      fixture.expected_status,
      `${fixture.id} actual status must match expected status.`
    );
    if (
      fixture.actual_status === "rejected" &&
      fixture.contains_forbidden_payload !== true
    ) {
      fail(`${fixture.id} rejected fixture must mark forbidden payload.`);
    }
    assertNonEmptyString(fixture.reason, `${fixture.id}.reason`);
  }

  const coveredForbiddenFields = unique(
    fixtures.flatMap((fixture) => fixture.forbidden_field_names ?? [])
  );
  assertEqual(
    report?.summary?.forbidden_fields_covered,
    coveredForbiddenFields.length,
    "Validator forbidden field coverage count must match fixture fields."
  );
  for (const field of requiredForbiddenRequestFields) {
    if (!coveredForbiddenFields.includes(field)) {
      fail(`Validator fixtures must cover forbidden request field ${field}.`);
    }
  }
}

function verifyDomainContractReport(report) {
  assertEqual(
    report?.format,
    "zhinote-cloud-manifest-domain-contract-report",
    "Disabled response must include the domain contract report."
  );
  assertEqual(
    report?.report_status,
    "metadata-only-local-contract",
    "Domain contract report must stay metadata-only local contract."
  );
  assertBoolean(
    report?.boundary?.local_contract_only,
    true,
    "domain_contract_report.boundary.local_contract_only"
  );
  assertBoolean(
    report?.boundary?.connects_cloud_services,
    false,
    "domain_contract_report.boundary.connects_cloud_services"
  );
  assertBoolean(
    report?.boundary?.uploads_workspace_data,
    false,
    "domain_contract_report.boundary.uploads_workspace_data"
  );
  assertBoolean(
    report?.summary?.can_compare_cloud_now,
    false,
    "domain_contract_report.summary.can_compare_cloud_now"
  );
}

function verifyDisabledResponseContract(contract) {
  assertEqual(
    contract?.http_status,
    501,
    "Disabled response contract must use Web Beta disabled HTTP status."
  );
  for (const field of [
    "returns_manifest_report",
    "returns_missing_ids",
    "returns_page_body_text",
    "returns_database_row_values",
    "returns_comment_bodies",
    "returns_file_bytes",
    "writes_server_data",
    "uploads_workspace_data",
  ]) {
    assertBoolean(contract?.[field], false, `disabled_response_contract.${field}`);
  }
  assertBoolean(
    contract?.returns_required_review,
    true,
    "disabled_response_contract.returns_required_review"
  );
}

function verifyEnablementGates(gates) {
  assertNonEmptyArray(gates, "enablement_gates");
  const ids = gates.map((gate) => gate.id);
  for (const id of requiredGateIds) {
    if (!ids.includes(id)) fail(`Enablement gates missing ${id}.`);
  }
  for (const gate of gates) {
    assertNonEmptyString(gate.title, `${gate.id}.title`);
    assertNonEmptyString(
      gate.required_before_enablement,
      `${gate.id}.required_before_enablement`
    );
  }
}

function assertForbiddenFields(fields, expectedFields, label) {
  assertNonEmptyArray(fields, label);
  for (const field of fields ?? []) {
    assertEqual(field.status, "forbidden", `${label}.${field.field}.status`);
    assertNonEmptyString(field.reason, `${label}.${field.field}.reason`);
  }
  const names = (fields ?? []).map((field) => field.field);
  for (const expected of expectedFields) {
    if (!names.includes(expected)) fail(`${label} missing ${expected}.`);
  }
}

function assertFieldIncluded(fields, fieldName, label) {
  assertNonEmptyArray(fields, label);
  const names = (fields ?? []).map((field) => field.field);
  if (!names.includes(fieldName)) fail(`${label} missing ${fieldName}.`);
}

function printReceipt(response, status) {
  const receipt = {
    format: "zhinote-cloud-manifest-api-guard-verification-receipt",
    format_version: 1,
    receipt_status: status,
    source_files: [webBetaStubPath, domainContractPath, compareStubPath],
    local_app_can_continue_now: status === "passed",
    web_beta_can_launch_now: false,
    cloud_sync_can_start_now: false,
    privacy_note:
      "Generated locally by evaluating disabled cloud manifest compare builders in memory. It does not read query values, connect cloud services, send network requests, read remote manifests, read workspace content, write server data, upload workspace data, read page bodies, read database values, read comments, read version snapshots, read file names, read file bytes, read secrets, enable sync, or enable AI.",
    boundary: {
      local_receipt_only: true,
      evaluates_disabled_response_builder_in_memory: true,
      sends_network_requests: false,
      connects_cloud_services: false,
      reads_query_values: false,
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
      enables_sync: false,
      enables_ai: false,
    },
    summary: {
      top_level_false_flags: requiredTopLevelFalseFlags.length,
      boundary_false_flags: requiredBoundaryFalseFlags.length,
      boundary_true_flags: requiredBoundaryTrueFlags.length,
      request_forbidden_fields:
        response?.request_schema?.forbidden_fields?.length ?? null,
      response_forbidden_fields:
        response?.response_schema?.forbidden_fields?.length ?? null,
      validator_fixtures: response?.local_validator_report?.summary?.fixtures ?? null,
      enablement_gates: response?.enablement_gates?.length ?? null,
      failures: failures.length,
    },
    failures,
  };

  const label =
    status === "passed"
      ? "Cloud manifest API guard verification passed"
      : "Cloud manifest API guard verification failed";
  console.log(label);
  console.log(JSON.stringify(receipt, null, 2));
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    fail(`${message} Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}.`);
  }
}

function assertBoolean(actual, expected, label) {
  if (actual !== expected) {
    fail(`${label} must be ${expected}.`);
  }
}

function assertNonEmptyArray(value, label) {
  if (!Array.isArray(value) || value.length === 0) {
    fail(`${label} must be a non-empty array.`);
  }
}

function assertNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(`${label} must be a non-empty string.`);
  }
}

function unique(values) {
  return [...new Set(values)];
}

function fail(message) {
  failures.push(message);
}

run();
