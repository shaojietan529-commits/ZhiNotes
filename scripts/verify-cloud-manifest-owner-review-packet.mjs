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
const ownerReviewPacketPath =
  "src/lib/sync/cloudManifestCompareOwnerReviewPacket.ts";

const requiredDecisionIds = [
  "continue-local-prep",
  "return-id-only-diff",
  "run-cloud-manifest-compare",
  "rebuild-cache-from-cloud-manifest",
  "enable-cloud-sync",
];

const requiredForbiddenActions = [
  "run_cloud_manifest_compare",
  "return_missing_ids",
  "rebuild_cache_from_cloud_manifest",
  "enable_sync_push",
  "enable_sync_pull",
  "connect_cloud_database",
  "upload_workspace_data",
  "write_server_data",
];

const requiredExcludedPayloadClasses = [
  "page_body_text",
  "database_row_values",
  "comment_bodies",
  "file_bytes",
  "raw_response_values",
  "remote_row_ids",
  "missing_ids",
  "secret_values",
  "cloud_connection_strings",
];

const requiredBoundaryFalseFlags = [
  "reads_route_response_over_http",
  "sends_network_requests",
  "connects_cloud_services",
  "reads_remote_manifest",
  "reads_workspace_content",
  "reads_page_body_text",
  "reads_database_row_values",
  "reads_comment_bodies",
  "reads_version_snapshots",
  "reads_file_names",
  "reads_file_bytes",
  "reads_secret_values",
  "writes_server_data",
  "uploads_workspace_data",
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
  const ownerReviewExports = evaluateTsModule(ownerReviewPacketPath, {
    "@/lib/sync/cloudManifestCompareHandshakeGate": handshakeExports,
  });

  const builder =
    ownerReviewExports.buildCloudManifestCompareOwnerReviewPacket;
  if (typeof builder !== "function") {
    fail("buildCloudManifestCompareOwnerReviewPacket must be exported.");
    printReceipt(null, "failed");
    process.exit(1);
  }

  const packet = builder();
  verifyPacket(packet);

  if (failures.length > 0) {
    printReceipt(packet, "failed");
    process.exit(1);
  }

  printReceipt(packet, "passed");
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
    Array,
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

function verifyPacket(packet) {
  assertEqual(
    packet?.format,
    "zhinote-cloud-manifest-compare-owner-review-packet",
    "Owner review packet must expose a stable format."
  );
  assertEqual(
    packet?.packet_status,
    "local-owner-review-only",
    "Owner review packet must stay local-only."
  );
  assertEqual(
    packet?.compare_verdict,
    "not-ready",
    "Owner review packet must keep compare not ready."
  );
  assertEqual(
    packet?.decision,
    "continue-local-prep-no-cloud-compare",
    "Owner review packet must continue local prep only."
  );
  assertEqual(
    packet?.required_confirmation_phrase,
    "APPROVE CLOUD MANIFEST ID-ONLY COMPARE",
    "Owner review packet must expose the exact confirmation phrase."
  );
  assertBoolean(packet?.can_export_packet_now, true, "can_export_packet_now");
  assertBoolean(
    packet?.can_request_owner_review_now,
    true,
    "can_request_owner_review_now"
  );
  assertBoolean(
    packet?.can_run_cloud_manifest_compare_now,
    false,
    "can_run_cloud_manifest_compare_now"
  );
  assertBoolean(
    packet?.can_return_missing_ids_now,
    false,
    "can_return_missing_ids_now"
  );
  assertBoolean(
    packet?.can_rebuild_cache_now,
    false,
    "can_rebuild_cache_now"
  );
  assertBoolean(
    packet?.can_enable_cloud_sync_now,
    false,
    "can_enable_cloud_sync_now"
  );
  assertBoundary(packet?.boundary);

  const decisions = Array.isArray(packet?.decisions) ? packet.decisions : [];
  const decisionIds = decisions.map((decision) => decision.id);
  for (const id of requiredDecisionIds) {
    if (!decisionIds.includes(id)) fail(`Missing owner decision ${id}.`);
  }
  if (new Set(decisionIds).size !== decisionIds.length) {
    fail("Owner review decision ids must be unique.");
  }
  if (!decisions.some((decision) => decision.answer === "yes")) {
    fail("Owner review packet must allow local-only prep.");
  }
  if (!decisions.some((decision) => decision.answer === "no")) {
    fail("Owner review packet must block risky actions.");
  }
  if (!decisions.some((decision) => decision.status === "blocked")) {
    fail("Owner review packet must keep blocked decisions.");
  }
  assertEqual(
    packet?.summary?.decisions,
    decisions.length,
    "Owner review decision count must match."
  );
  assertEqual(
    packet?.summary?.yes,
    decisions.filter((decision) => decision.answer === "yes").length,
    "Owner review yes count must match."
  );
  assertEqual(
    packet?.summary?.no,
    decisions.filter((decision) => decision.answer === "no").length,
    "Owner review no count must match."
  );

  const checklist = Array.isArray(packet?.checklist) ? packet.checklist : [];
  assertEqual(
    packet?.summary?.checklist_items,
    checklist.length,
    "Owner review checklist count must match."
  );
  if (!checklist.some((item) => item.status === "local-ready")) {
    fail("Owner review checklist must expose local-ready items.");
  }
  if (!checklist.some((item) => item.status === "blocked")) {
    fail("Owner review checklist must expose blocked items.");
  }

  for (const action of requiredForbiddenActions) {
    if (!packet?.forbidden_actions_before_owner_approval?.includes(action)) {
      fail(`Missing forbidden action ${action}.`);
    }
  }
  for (const payloadClass of requiredExcludedPayloadClasses) {
    if (!packet?.excluded_payload_classes?.includes(payloadClass)) {
      fail(`Missing excluded payload class ${payloadClass}.`);
    }
  }
  if (!packet?.required_verification_commands?.includes("npm run build")) {
    fail("Owner review packet must require production build verification.");
  }
  if (
    !packet?.required_verification_commands?.includes(
      "npm run verify:cloud-manifest-owner-review"
    )
  ) {
    fail("Owner review packet must require its verifier command.");
  }
}

function assertBoundary(boundary) {
  if (!boundary || typeof boundary !== "object") {
    fail("Boundary must be an object.");
    return;
  }
  assertBoolean(boundary.local_packet_only, true, "local_packet_only");
  assertBoolean(
    boundary.reads_handshake_gate_metadata,
    true,
    "reads_handshake_gate_metadata"
  );
  assertBoolean(
    boundary.uses_synthetic_fixtures_only,
    true,
    "uses_synthetic_fixtures_only"
  );
  assertBoolean(
    boundary.requires_owner_confirmation_before_compare,
    true,
    "requires_owner_confirmation_before_compare"
  );
  assertBoolean(
    boundary.requires_separate_enabled_route,
    true,
    "requires_separate_enabled_route"
  );
  for (const flag of requiredBoundaryFalseFlags) {
    assertBoolean(boundary[flag], false, `boundary.${flag}`);
  }
}

function printReceipt(packet, status) {
  const receipt = {
    format: "zhinote-cloud-manifest-owner-review-verification-receipt",
    format_version: 1,
    receipt_status: status,
    source_files: [handshakeGatePath, ownerReviewPacketPath],
    local_app_can_continue_now: status === "passed",
    web_beta_can_launch_now: false,
    cloud_sync_can_start_now: false,
    can_run_cloud_manifest_compare_now: false,
    can_return_missing_ids_now: false,
    can_rebuild_cache_now: false,
    privacy_note:
      "Generated locally by evaluating the cloud manifest compare owner review packet in memory. It does not read route responses, send network requests, connect cloud services, read remote manifests, read workspace content, write server data, upload workspace data, return missing ids, rebuild cache, enable sync, or enable AI.",
    boundary: {
      local_receipt_only: true,
      evaluates_packet_in_memory: true,
      reads_route_response_over_http: false,
      sends_network_requests: false,
      connects_cloud_services: false,
      reads_remote_manifest: false,
      reads_workspace_content: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      returns_missing_ids: false,
      rebuilds_cache: false,
      enables_sync: false,
      enables_ai: false,
    },
    summary: {
      decisions: packet?.summary?.decisions ?? null,
      checklist_items: packet?.summary?.checklist_items ?? null,
      forbidden_actions: packet?.summary?.forbidden_actions ?? null,
      excluded_payload_classes:
        packet?.summary?.excluded_payload_classes ?? null,
      failures: failures.length,
    },
    failures,
  };

  const label =
    status === "passed"
      ? "Cloud manifest owner review packet verification passed"
      : "Cloud manifest owner review packet verification failed";
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
