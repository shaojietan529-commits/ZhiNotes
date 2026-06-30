#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import process from "node:process";

const HOST = "127.0.0.1";
const EXISTING_DEV_PORT = 3000;
const ROUTE_PATH =
  "/api/cloud/manifest/compare?workspaceId=zhinote-route-guard-test&includeMissingIds=true";
const ROUTE_SOURCE_PATH = "src/app/api/cloud/manifest/compare/route.ts";
const START_TIMEOUT_MS = 30_000;
const REQUEST_TIMEOUT_MS = 10_000;
const LOG_LIMIT = 16_000;

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
  "database_cell_values",
  "comment_body",
  "version_snapshot",
  "file_bytes",
  "raw_local_manifest",
  "raw_remote_manifest",
  "token",
  "cookie",
  "secret_values",
  "overwrite_cloud",
  "overwrite_local",
  "delete_remote",
  "delete_local",
];

const requiredForbiddenResponseFields = [
  "page_body_text",
  "database_cell_values",
  "comment_body",
  "version_snapshot",
  "file_bytes",
  "token",
  "cookie",
  "secret_values",
];

const failures = [];

async function main() {
  verifyRouteSource();

  const existingServer = await findExistingDevServer();
  const port = existingServer?.port ?? (await findFreePort());
  const baseUrl = existingServer?.baseUrl ?? `http://${HOST}:${port}`;
  const child = existingServer ? null : startNextDev(port);
  let output = "";
  const appendOutput = (chunk) => {
    output = `${output}${chunk.toString()}`;
    if (output.length > LOG_LIMIT) output = output.slice(-LOG_LIMIT);
  };
  child?.stdout.on("data", appendOutput);
  child?.stderr.on("data", appendOutput);

  try {
    await waitForRoute(`${baseUrl}/daily`, START_TIMEOUT_MS);
    const result = await requestRoute(`${baseUrl}${ROUTE_PATH}`);
    verifyRouteResult(result);

    if (failures.length > 0) {
      printReceipt(result, "failed", existingServer ? "existing-next-dev-http" : "next-dev-http", port);
      process.exitCode = 1;
      return;
    }

    printReceipt(result, "passed", existingServer ? "existing-next-dev-http" : "next-dev-http", port);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push(message);
    console.error("verify:cloud-manifest-route failed:", message);
    if (output.trim()) {
      console.error("\n--- next dev output ---");
      console.error(output.trim());
    }
    printReceipt(null, "failed", existingServer ? "existing-next-dev-http" : "next-dev-http", port);
    process.exitCode = 1;
  } finally {
    if (child) await stopChild(child);
  }
}

function verifyRouteSource() {
  const source = readFileSync(path.join(process.cwd(), ROUTE_SOURCE_PATH), "utf8");
  assertIncludes(
    source,
    "export async function GET()",
    "Manifest compare route GET handler must accept no request argument."
  );
  for (const forbiddenSnippet of [
    "searchParams",
    "cookies(",
    "headers(",
    "request.json",
    "request.text",
    "request.formData",
  ]) {
    assertExcludes(
      source,
      forbiddenSnippet,
      `Manifest compare route source must not inspect ${forbiddenSnippet}.`
    );
  }
}

function verifyRouteResult(result) {
  assertEqual(result.statusCode, 501, "Manifest compare route must return HTTP 501 while disabled.");
  const contentType = result.headers["content-type"] ?? "";
  if (!String(contentType).includes("application/json")) {
    failures.push(`Manifest compare route returned unexpected content-type: ${contentType}`);
  }
  assertExcludes(
    result.body,
    "zhinote-route-guard-test",
    "Disabled route must not echo query workspace ids."
  );
  assertExcludes(
    result.body,
    "includeMissingIds",
    "Disabled route must not echo query option names."
  );

  let body = null;
  try {
    body = JSON.parse(result.body);
  } catch (error) {
    failures.push(
      `Manifest compare route must return JSON: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return;
  }

  assertEqual(
    body?.format,
    "zhinote-cloud-manifest-compare-api-disabled",
    "Route response must expose disabled manifest compare format."
  );
  assertEqual(body?.format_version, 1, "Route response format version must be stable.");
  assertEqual(body?.api_id, "cloud-manifest-compare", "Route response API id must match.");
  assertEqual(body?.method, "GET", "Route response method must be GET.");
  assertEqual(
    body?.stub_status,
    "disabled-local-stub",
    "Route response must stay disabled."
  );
  for (const flag of requiredTopLevelFalseFlags) {
    assertBoolean(body?.[flag], false, flag);
  }
  for (const flag of requiredBoundaryFalseFlags) {
    assertBoolean(body?.boundary?.[flag], false, `boundary.${flag}`);
  }
  for (const flag of requiredBoundaryTrueFlags) {
    assertBoolean(body?.boundary?.[flag], true, `boundary.${flag}`);
  }

  verifyBaseStub(body?.base_stub);
  verifySchemaFields(
    body?.request_schema?.forbidden_fields,
    requiredForbiddenRequestFields,
    "request_schema.forbidden_fields"
  );
  verifySchemaFields(
    body?.response_schema?.forbidden_fields,
    requiredForbiddenResponseFields,
    "response_schema.forbidden_fields"
  );
  assertEqual(
    body?.local_validator_report?.validator_status,
    "not-executing-route",
    "Route response validator report must not execute cloud compare."
  );
  assertEqual(
    body?.domain_contract_report?.format,
    "zhinote-cloud-manifest-domain-contract-report",
    "Route response must include cloud manifest domain contract report."
  );
  assertBoolean(
    body?.domain_contract_report?.boundary?.connects_cloud_services,
    false,
    "domain_contract_report.boundary.connects_cloud_services"
  );
  assertBoolean(
    body?.domain_contract_report?.boundary?.uploads_workspace_data,
    false,
    "domain_contract_report.boundary.uploads_workspace_data"
  );
  verifyDisabledResponseContract(body?.disabled_response_contract);
}

function verifyBaseStub(baseStub) {
  assertEqual(baseStub?.format, "zhinote-web-beta-api-stub", "Base stub format must match.");
  assertEqual(baseStub?.api_id, "cloud-manifest-compare", "Base stub API id must match.");
  for (const [field, expected] of [
    ["can_accept_workspace_data", false],
    ["reads_request_body", false],
    ["writes_server_data", false],
    ["uploads_data", false],
  ]) {
    assertBoolean(baseStub?.[field], expected, `base_stub.${field}`);
  }
}

function verifySchemaFields(fields, expectedFields, label) {
  if (!Array.isArray(fields) || fields.length === 0) {
    failures.push(`${label} must be a non-empty array.`);
    return;
  }
  const names = fields.map((field) => field.field);
  for (const expected of expectedFields) {
    if (!names.includes(expected)) failures.push(`${label} missing ${expected}.`);
  }
  for (const field of fields) {
    assertEqual(field.status, "forbidden", `${label}.${field.field}.status`);
    if (typeof field.reason !== "string" || field.reason.trim().length === 0) {
      failures.push(`${label}.${field.field}.reason must be non-empty.`);
    }
  }
}

function verifyDisabledResponseContract(contract) {
  assertEqual(contract?.http_status, 501, "Disabled response contract status must be 501.");
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

async function findExistingDevServer() {
  const baseUrl = `http://${HOST}:${EXISTING_DEV_PORT}`;
  try {
    const result = await requestRoute(`${baseUrl}/daily`, 1_000);
    const contentType = result.headers["content-type"] ?? "";
    if (
      result.statusCode === 200 &&
      String(contentType).includes("text/html") &&
      result.body.includes("ZhiNote")
    ) {
      return { baseUrl, port: EXISTING_DEV_PORT };
    }
  } catch {
    // No reusable local app server; this verifier will start its own.
  }
  return null;
}

function startNextDev(port) {
  const nextBin = path.join(
    process.cwd(),
    "node_modules",
    ".bin",
    process.platform === "win32" ? "next.cmd" : "next"
  );
  return spawn(nextBin, ["dev", "--hostname", HOST, "--port", String(port)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, HOST, () => {
      const address = server.address();
      const port =
        typeof address === "object" && address ? address.port : undefined;
      server.close(() => {
        if (port) resolve(port);
        else reject(new Error("Could not allocate a local route-test port"));
      });
    });
  });
}

async function waitForRoute(url, timeoutMs) {
  const startedAt = Date.now();
  let lastError = null;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const result = await requestRoute(url, 2_000);
      if (result.statusCode === 200) return;
      lastError = new Error(`status ${result.statusCode}`);
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }
  const detail = lastError instanceof Error ? lastError.message : "unknown";
  throw new Error(`Timed out waiting for local route readiness: ${detail}`);
}

function requestRoute(url, timeoutMs = REQUEST_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const startedAt = performance.now();
    const req = http.get(url, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body = `${body}${chunk}`;
      });
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body,
          durationMs: performance.now() - startedAt,
        });
      });
    });
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Request timed out after ${timeoutMs}ms: ${url}`));
    });
    req.on("error", reject);
  });
}

function printReceipt(result, status, mode, port) {
  const receipt = {
    format: "zhinote-cloud-manifest-route-disabled-verification-receipt",
    format_version: 1,
    receipt_status: status,
    mode,
    host: HOST,
    port,
    route: ROUTE_PATH,
    route_source: ROUTE_SOURCE_PATH,
    http_status: result?.statusCode ?? null,
    duration_ms: result ? Math.round(result.durationMs) : null,
    local_app_can_continue_now: status === "passed",
    web_beta_can_launch_now: false,
    cloud_sync_can_start_now: false,
    privacy_note:
      "Generated locally by requesting only the disabled cloud manifest compare API route from a local Next.js server. It does not read browser storage, page bodies, database rows, file bytes, cookies, credentials, remote manifests, or cloud data; it does not write server data, upload workspace data, enable sync, or enable AI.",
    boundary: {
      local_receipt_only: true,
      uses_localhost_http: true,
      sends_external_network_requests: false,
      reads_browser_storage: false,
      reads_query_values: false,
      echoes_query_values: false,
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
      enables_sync: false,
      enables_ai: false,
    },
    summary: {
      top_level_false_flags: requiredTopLevelFalseFlags.length,
      boundary_false_flags: requiredBoundaryFalseFlags.length,
      boundary_true_flags: requiredBoundaryTrueFlags.length,
      forbidden_request_fields: requiredForbiddenRequestFields.length,
      forbidden_response_fields: requiredForbiddenResponseFields.length,
      failures: failures.length,
    },
    failures,
  };

  const label =
    status === "passed"
      ? "Cloud manifest route disabled verification passed"
      : "Cloud manifest route disabled verification failed";
  console.log(label);
  console.log(JSON.stringify(receipt, null, 2));
}

function assertIncludes(source, snippet, message) {
  if (!source.includes(snippet)) failures.push(message);
}

function assertExcludes(source, snippet, message) {
  if (source.includes(snippet)) failures.push(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    failures.push(
      `${message} Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}.`
    );
  }
}

function assertBoolean(actual, expected, label) {
  if (actual !== expected) failures.push(`${label} must be ${expected}.`);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stopChild(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve();
      return;
    }
    const forceTimer = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL");
      }
    }, 2_000);
    child.once("exit", () => {
      clearTimeout(forceTimer);
      resolve();
    });
    child.kill("SIGTERM");
  });
}

await main();
