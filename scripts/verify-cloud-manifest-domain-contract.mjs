#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import vm from "node:vm";
import ts from "typescript";

const root = process.cwd();
const contractPath = "src/lib/sync/cloudManifestDomainContract.ts";
const expectedDomainIds = [
  "pages",
  "daily-notes",
  "meetings",
  "databases",
  "files",
  "comments",
  "versions",
  "settings-permissions",
];
const requiredForbiddenFields = [
  "page_body_text",
  "database_cell_values",
  "comment_body",
  "version_snapshot",
  "file_bytes",
  "prompt_text",
  "token",
  "secret_values",
];

const failures = [];

function run() {
  const source = readFileSync(path.join(root, contractPath), "utf8");
  const exportsObject = evaluateContractModule(source);
  const builder = exportsObject.buildCloudManifestDomainContractReport;

  if (typeof builder !== "function") {
    fail("buildCloudManifestDomainContractReport must be exported.");
    printReceipt(null, "failed");
    process.exit(1);
  }

  const report = builder();
  verifyReport(report);

  if (failures.length > 0) {
    printReceipt(report, "failed");
    process.exit(1);
  }

  printReceipt(report, "passed");
}

function evaluateContractModule(source) {
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: contractPath,
    reportDiagnostics: true,
  });

  const diagnostics = transpiled.diagnostics ?? [];
  if (diagnostics.length > 0) {
    for (const diagnostic of diagnostics) {
      fail(
        `TypeScript transpile diagnostic ${diagnostic.code}: ${diagnostic.messageText}`
      );
    }
  }

  const exportsObject = {};
  const context = vm.createContext({
    exports: exportsObject,
    module: { exports: exportsObject },
  });
  new vm.Script(transpiled.outputText, {
    filename: contractPath,
  }).runInContext(context);

  return exportsObject;
}

function verifyReport(report) {
  assertEqual(
    report?.format,
    "zhinote-cloud-manifest-domain-contract-report",
    "Report must expose the stable cloud manifest domain contract format."
  );
  assertEqual(
    report?.report_status,
    "metadata-only-local-contract",
    "Report must stay metadata-only and local."
  );
  assertEqual(
    report?.architecture_target,
    "cloud-master-local-hot-cache",
    "Report must target cloud-master/local-hot-cache architecture."
  );
  assertBoolean(report?.boundary?.local_contract_only, true, "local contract");
  assertBoolean(
    report?.boundary?.reads_manifest_shape_only,
    true,
    "manifest shape read"
  );

  for (const [field, expected] of [
    ["reads_page_body_text", false],
    ["reads_database_row_values", false],
    ["reads_comment_bodies", false],
    ["reads_version_snapshots", false],
    ["reads_file_names", false],
    ["reads_file_bytes", false],
    ["reads_secret_values", false],
    ["sends_network_requests", false],
    ["connects_cloud_services", false],
    ["writes_server_data", false],
    ["uploads_workspace_data", false],
    ["mutates_local_cache", false],
    ["clears_local_cache", false],
    ["enables_sync", false],
    ["enables_ai", false],
  ]) {
    assertBoolean(report?.boundary?.[field], expected, `boundary.${field}`);
  }

  assertBoolean(
    report?.summary?.can_compare_cloud_now,
    false,
    "cloud compare must remain disabled"
  );
  assertBoolean(
    report?.summary?.can_rebuild_cache_now,
    false,
    "cache rebuild must remain disabled"
  );
  assertBoolean(
    report?.summary?.can_upload_workspace_data_now,
    false,
    "workspace upload must remain disabled"
  );

  const contracts = Array.isArray(report?.contracts) ? report.contracts : [];
  assertEqual(
    report?.summary?.domains,
    expectedDomainIds.length,
    "Summary domain count must match expected coverage."
  );
  assertEqual(
    contracts.length,
    expectedDomainIds.length,
    "Contract list must include every required domain."
  );

  const ids = contracts.map((contract) => contract.id);
  for (const id of expectedDomainIds) {
    if (!ids.includes(id)) fail(`Missing cloud manifest domain ${id}.`);
  }
  if (new Set(ids).size !== ids.length) {
    fail("Cloud manifest domain ids must be unique.");
  }

  for (const contract of contracts) {
    verifyDomainContract(contract);
  }

  const countedFields = contracts.flatMap((contract) => [
    ...contract.cloud_manifest_fields,
    ...contract.local_manifest_fields,
    ...contract.forbidden_manifest_fields,
  ]);
  assertEqual(
    report?.summary?.required_fields,
    countedFields.filter((field) => field.status === "required").length,
    "Required field count must match contracts."
  );
  assertEqual(
    report?.summary?.optional_fields,
    countedFields.filter((field) => field.status === "optional").length,
    "Optional field count must match contracts."
  );
  assertEqual(
    report?.summary?.forbidden_fields,
    countedFields.filter((field) => field.status === "forbidden").length,
    "Forbidden field count must match contracts."
  );
}

function verifyDomainContract(contract) {
  if (!contract || typeof contract !== "object") {
    fail("Domain contract must be an object.");
    return;
  }
  if (!expectedDomainIds.includes(contract.id)) {
    fail(`Unexpected cloud manifest domain id ${String(contract.id)}.`);
  }
  assertNonEmptyArray(
    contract.cloud_table_scope,
    `${contract.id}.cloud_table_scope`
  );
  assertNonEmptyString(
    contract.local_cache_scope,
    `${contract.id}.local_cache_scope`
  );
  assertNonEmptyArray(
    contract.cloud_manifest_fields,
    `${contract.id}.cloud_manifest_fields`
  );
  assertNonEmptyArray(
    contract.local_manifest_fields,
    `${contract.id}.local_manifest_fields`
  );
  assertNonEmptyArray(
    contract.forbidden_manifest_fields,
    `${contract.id}.forbidden_manifest_fields`
  );
  assertNonEmptyArray(contract.diff_kinds, `${contract.id}.diff_kinds`);
  assertNonEmptyString(
    contract.pending_queue_rule,
    `${contract.id}.pending_queue_rule`
  );
  assertNonEmptyString(
    contract.cache_rebuild_rule,
    `${contract.id}.cache_rebuild_rule`
  );

  const ownerGates = Array.isArray(contract.owner_review_required_before)
    ? contract.owner_review_required_before
    : [];
  for (const gate of ["cloud-manifest-compare-enable", "cache-rebuild-from-cloud"]) {
    if (!ownerGates.includes(gate)) {
      fail(`${contract.id} must require owner gate ${gate}.`);
    }
  }

  const forbiddenFields = new Set(
    contract.forbidden_manifest_fields.map((field) => field.field)
  );
  for (const field of requiredForbiddenFields) {
    if (!forbiddenFields.has(field)) {
      fail(`${contract.id} must forbid ${field}.`);
    }
  }

  for (const field of [
    ...contract.cloud_manifest_fields,
    ...contract.local_manifest_fields,
    ...contract.forbidden_manifest_fields,
  ]) {
    verifyFieldContract(contract.id, field);
  }
}

function verifyFieldContract(domainId, field) {
  if (!field || typeof field !== "object") {
    fail(`${domainId} includes a non-object field contract.`);
    return;
  }
  assertNonEmptyString(field.field, `${domainId}.field`);
  assertNonEmptyString(field.reason, `${domainId}.${field.field}.reason`);
  if (!["required", "optional", "forbidden"].includes(field.status)) {
    fail(`${domainId}.${field.field} has invalid status ${field.status}.`);
  }
}

function printReceipt(report, status) {
  const receipt = {
    format: "zhinote-cloud-manifest-domain-contract-verification-receipt",
    format_version: 1,
    receipt_status: status,
    source_file: contractPath,
    local_app_can_continue_now: status === "passed",
    web_beta_can_launch_now: false,
    cloud_sync_can_start_now: false,
    privacy_note:
      "Generated locally by evaluating the cloud manifest domain contract builder in memory. It does not connect cloud services, send network requests, write server data, upload workspace data, read page bodies, read database values, read comments, read version snapshots, read file names, read file bytes, read secrets, enable sync, or enable AI.",
    boundary: {
      local_receipt_only: true,
      evaluates_contract_builder_in_memory: true,
      sends_network_requests: false,
      connects_cloud_services: false,
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
      expected_domains: expectedDomainIds.length,
      actual_domains: report?.summary?.domains ?? null,
      required_fields: report?.summary?.required_fields ?? null,
      optional_fields: report?.summary?.optional_fields ?? null,
      forbidden_fields: report?.summary?.forbidden_fields ?? null,
      failures: failures.length,
    },
    failures,
  };

  const label =
    status === "passed"
      ? "Cloud manifest domain contract verification passed"
      : "Cloud manifest domain contract verification failed";
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

function fail(message) {
  failures.push(message);
}

run();
