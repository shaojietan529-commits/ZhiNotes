#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import process from "node:process";

const HOST = "127.0.0.1";
const ROUTE_PATH = "/api/stable-use/health";
const ROUTE_SOURCE_PATH = "src/app/api/stable-use/health/route.ts";
const HEALTH_SOURCE_PATH = "src/lib/sync/stableUseHealth.ts";
const START_TIMEOUT_MS = 30_000;
const REQUEST_TIMEOUT_MS = 10_000;
const LOG_LIMIT = 16_000;

const requiredTopLevelFalseFlags = [
  "cloud_sync_can_be_enabled_by_health_check",
  "web_beta_launch_approved_by_health_check",
  "production_cutover_approved_by_health_check",
  "cache_rebuild_approved_by_health_check",
];

const requiredBoundaryFalseFlags = [
  "reads_browser_storage",
  "reads_sync_queue_counts",
  "reads_page_body_text",
  "reads_database_row_values",
  "reads_file_names",
  "reads_file_bytes",
  "reads_secret_values",
  "reads_tokens_or_cookies",
  "sends_external_network_requests",
  "writes_server_data",
  "writes_workspace_data",
  "uploads_workspace_data",
  "clears_local_cache",
  "enables_sync",
  "enables_ai",
];

const failures = [];

async function main() {
  verifySourceContracts();

  const port = await findFreePort();
  const baseUrl = `http://${HOST}:${port}`;
  const child = startNextDev(port);
  let devServer = null;
  let output = "";
  const appendOutput = (chunk) => {
    output = `${output}${chunk.toString()}`;
    if (output.length > LOG_LIMIT) output = output.slice(-LOG_LIMIT);
  };
  child.stdout.on("data", appendOutput);
  child.stderr.on("data", appendOutput);

  try {
    devServer = await resolveDevServer(baseUrl, child, () => output);
    const result = await requestJson(`${devServer.baseUrl}${ROUTE_PATH}`);
    verifyRouteResult(result);
    printReceipt(
      result,
      failures.length === 0 ? "passed" : "failed",
      port,
      devServer
    );
    if (failures.length > 0) process.exitCode = 1;
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
    if (output.trim()) {
      console.error("\n--- next dev output ---");
      console.error(output.trim());
    }
    printReceipt(null, "failed", port, devServer);
    process.exitCode = 1;
  } finally {
    await stopChild(child);
  }
}

function verifySourceContracts() {
  const routeSource = readFileSync(
    path.join(process.cwd(), ROUTE_SOURCE_PATH),
    "utf8"
  );
  const healthSource = readFileSync(
    path.join(process.cwd(), HEALTH_SOURCE_PATH),
    "utf8"
  );
  assertIncludes(routeSource, "export async function GET()", "health route GET must not accept request input");
  assertIncludes(routeSource, "buildStableUseHealthResponse()", "health route must return the shared stable-use health response");
  assertNotIncludes(routeSource, "request:", "health route must not inspect request data");
  assertNotIncludes(routeSource, "cookies", "health route must not read cookies");
  assertNotIncludes(routeSource, "headers", "health route must not read headers");
  assertIncludes(healthSource, 'format: "zhinote-stable-use-health"', "health response must expose a stable format");
  assertIncludes(healthSource, 'health_status: "stable-use-active"', "health response must identify stable-use mode");
  assertIncludes(healthSource, 'local_input_policy: "local-first-then-pending-queue"', "health response must preserve local-first input policy");
  assertIncludes(healthSource, 'sync_failure_policy: "retry-visible-not-sign-out"', "health response must preserve retry-not-signout policy");
  assertIncludes(healthSource, "getDevelopmentStableUseRoutes()", "health response must use shared stable-use route catalog");
  assertIncludes(healthSource, "getDevelopmentOwnerGatedActions()", "health response must use shared owner-gated action catalog");
  assertIncludes(healthSource, "getPendingDomainCatalog()", "health response must use the shared pending-domain catalog");
  assertIncludes(healthSource, "buildPendingDomainCoverageReport", "health response must use the shared pending-domain coverage report");
  assertIncludes(healthSource, "monitored_sync_domains", "health response must expose monitored sync domains");
  assertIncludes(healthSource, "sync_domain_coverage", "health response must expose sync-domain coverage");
  assertIncludes(healthSource, 'coverage_source: "static-pending-domain-catalog"', "health response must mark coverage as static metadata");
  assertIncludes(healthSource, "git pull --rebase before git push; never force push.", "health response must preserve safe push guidance");
  for (const flag of requiredTopLevelFalseFlags) {
    assertIncludes(healthSource, `${flag}: false`, `${flag} must be false in source`);
  }
  for (const flag of requiredBoundaryFalseFlags) {
    assertIncludes(healthSource, `${flag}: false`, `${flag} must be false in source`);
  }
}

function verifyRouteResult(result) {
  if (result.statusCode !== 200) {
    failures.push(`Expected HTTP 200, received ${result.statusCode}`);
    return;
  }
  const body = result.body;
  assertEqual(body?.format, "zhinote-stable-use-health", "format");
  assertEqual(body?.format_version, 1, "format_version");
  assertEqual(body?.health_status, "stable-use-active", "health_status");
  assertEqual(body?.user_can_continue_now, true, "user_can_continue_now");
  assertEqual(
    body?.active_development_can_continue,
    true,
    "active_development_can_continue"
  );
  assertEqual(
    body?.local_input_policy,
    "local-first-then-pending-queue",
    "local_input_policy"
  );
  assertEqual(
    body?.sync_failure_policy,
    "retry-visible-not-sign-out",
    "sync_failure_policy"
  );
  for (const flag of requiredTopLevelFalseFlags) {
    assertEqual(body?.[flag], false, flag);
  }
  const boundary = body?.boundary ?? {};
  assertEqual(
    boundary.deployment_health_metadata_only,
    true,
    "boundary.deployment_health_metadata_only"
  );
  for (const flag of requiredBoundaryFalseFlags) {
    assertEqual(boundary?.[flag], false, `boundary.${flag}`);
  }
  if (!Array.isArray(body?.stable_use_routes) || body.stable_use_routes.length < 10) {
    failures.push("stable_use_routes must list the stable-use route catalog");
  }
  if (
    !Array.isArray(body?.owner_gated_actions) ||
    !body.owner_gated_actions.includes("enable_sync_push") ||
    !body.owner_gated_actions.includes("cache_rebuild_from_cloud")
  ) {
    failures.push("owner_gated_actions must include sync push and cache rebuild gates");
  }
  const monitoredSyncDomains = body?.monitored_sync_domains ?? [];
  if (!Array.isArray(monitoredSyncDomains) || monitoredSyncDomains.length < 8) {
    failures.push("monitored_sync_domains must list the stable pending-domain catalog");
  }
  for (const id of [
    "pages",
    "databases",
    "comments",
    "versions",
    "files",
    "settings",
    "permissions",
    "audit",
  ]) {
    if (!monitoredSyncDomains.some((domain) => domain?.id === id)) {
      failures.push(`monitored_sync_domains missing ${id}`);
    }
  }
  if (
    !monitoredSyncDomains.some(
      (domain) =>
        domain?.id === "pages" &&
        domain?.table_names?.includes("pages") &&
        domain?.table_prefixes?.includes("daily_")
    )
  ) {
    failures.push("monitored_sync_domains must include page and daily-note metadata");
  }
  if (
    !monitoredSyncDomains.some(
      (domain) =>
        domain?.id === "settings" &&
        domain?.table_names?.includes("sidebar_items") &&
        domain?.table_prefixes?.includes("sidebar_")
    )
  ) {
    failures.push("monitored_sync_domains must include sidebar/module settings metadata");
  }
  const coverage = body?.sync_domain_coverage ?? {};
  assertEqual(
    coverage.coverage_source,
    "static-pending-domain-catalog",
    "sync_domain_coverage.coverage_source"
  );
  assertEqual(
    coverage.registered_domain_count,
    8,
    "sync_domain_coverage.registered_domain_count"
  );
  assertEqual(
    coverage.visible_registered_domain_count,
    8,
    "sync_domain_coverage.visible_registered_domain_count"
  );
  assertEqual(
    coverage.active_registered_domain_count,
    0,
    "sync_domain_coverage.active_registered_domain_count"
  );
  assertEqual(
    coverage.unmatched_table_domain_count,
    0,
    "sync_domain_coverage.unmatched_table_domain_count"
  );
  assertEqual(
    coverage.coverage_complete,
    true,
    "sync_domain_coverage.coverage_complete"
  );
  if (
    !Array.isArray(coverage.missing_registered_domain_ids) ||
    coverage.missing_registered_domain_ids.length !== 0
  ) {
    failures.push("sync_domain_coverage must report no missing registered domains");
  }
  if (
    !Array.isArray(body?.required_before_shipping_changes) ||
    !body.required_before_shipping_changes.some((item) =>
      String(item).includes("verify:stable-use-health")
    )
  ) {
    failures.push("required_before_shipping_changes must include verify:stable-use-health");
  }
}

function assertIncludes(source, snippet, message) {
  if (!source.includes(snippet)) failures.push(message);
}

function assertNotIncludes(source, snippet, message) {
  if (source.includes(snippet)) failures.push(message);
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    failures.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

async function waitForRoute(url, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const result = await requestText(url, 1_000);
      if (
        result.statusCode === 200 &&
        String(result.headers["content-type"] ?? "").includes("text/html")
      ) {
        return;
      }
    } catch {
      // Keep polling until Next dev is ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function resolveDevServer(tempBaseUrl, child, getOutput) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < START_TIMEOUT_MS) {
    const activeServer = parseActiveSameProjectDevServer(getOutput());
    if (activeServer) {
      await waitForRoute(`${activeServer.baseUrl}/daily`, 5_000);
      return {
        baseUrl: activeServer.baseUrl,
        mode: "active-same-project-dev-server",
        ownsProcess: false,
        activePid: activeServer.pid,
      };
    }

    try {
      const result = await requestText(`${tempBaseUrl}/daily`, 1_000);
      if (
        result.statusCode === 200 &&
        String(result.headers["content-type"] ?? "").includes("text/html")
      ) {
        return {
          baseUrl: tempBaseUrl,
          mode: "temporary-dev-server",
          ownsProcess: true,
          activePid: child.pid ?? null,
        };
      }
    } catch {
      // Keep polling until Next dev is ready or reports an active same-project server.
    }

    if (child.exitCode !== null || child.signalCode !== null) {
      const activeServerAfterExit = parseActiveSameProjectDevServer(getOutput());
      if (activeServerAfterExit) {
        await waitForRoute(`${activeServerAfterExit.baseUrl}/daily`, 5_000);
        return {
          baseUrl: activeServerAfterExit.baseUrl,
          mode: "active-same-project-dev-server",
          ownsProcess: false,
          activePid: activeServerAfterExit.pid,
        };
      }
      throw new Error(
        "Next dev exited before the stable-use health route was ready"
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for ${tempBaseUrl}/daily`);
}

function parseActiveSameProjectDevServer(output) {
  const text = stripAnsi(output);
  const markerIndex = text.indexOf("Another next dev server is already running");
  if (markerIndex < 0) {
    return null;
  }
  const activeServerText = text.slice(markerIndex);

  const localMatch = activeServerText.match(/Local:\s+(http:\/\/[^\s]+)/);
  const dirMatch = activeServerText.match(/Dir:\s+(.+)/);
  if (!localMatch || !dirMatch) return null;

  const activeDir = path.resolve(dirMatch[1].trim());
  if (activeDir !== process.cwd()) {
    throw new Error(
      `Active Next dev server belongs to a different project: ${activeDir}`
    );
  }

  const pidMatch = activeServerText.match(/PID:\s+(\d+)/);
  return {
    baseUrl: localMatch[1].replace(/\/$/, ""),
    pid: pidMatch ? Number(pidMatch[1]) : null,
  };
}

function stripAnsi(value) {
  return value.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    const startedAt = performance.now();
    const req = http.get(url, { timeout: REQUEST_TIMEOUT_MS }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        try {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            durationMs: performance.now() - startedAt,
            body: JSON.parse(body),
          });
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on("timeout", () => {
      req.destroy(new Error(`Request timed out after ${REQUEST_TIMEOUT_MS}ms`));
    });
    req.on("error", reject);
  });
}

function requestText(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        resolve({ statusCode: res.statusCode, headers: res.headers, body });
      });
    });
    req.on("timeout", () => {
      req.destroy(new Error(`Request timed out after ${timeoutMs}ms`));
    });
    req.on("error", reject);
  });
}

function startNextDev(port) {
  return spawn("npm", ["run", "dev", "--", "--hostname", HOST, "--port", String(port)], {
    cwd: process.cwd(),
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, HOST, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Unable to resolve free port")));
        return;
      }
      const { port } = address;
      server.close(() => resolve(port));
    });
  });
}

function stopChild(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve();
      return;
    }
    child.once("exit", () => resolve());
    child.kill("SIGTERM");
    setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL");
      }
    }, 2_000).unref();
  });
}

function printReceipt(result, status, port, devServer) {
  const receipt = {
    format: "zhinote-stable-use-health-verification-receipt",
    format_version: 1,
    receipt_status: status,
    route: ROUTE_PATH,
    port,
    server_mode: devServer?.mode ?? null,
    server_base_url: devServer?.baseUrl ?? null,
    active_dev_pid: devServer?.activePid ?? null,
    http_status: result?.statusCode ?? null,
    duration_ms: result ? Math.round(result.durationMs) : null,
    stable_use_health_status: result?.body?.health_status ?? null,
    stable_use_routes: Array.isArray(result?.body?.stable_use_routes)
      ? result.body.stable_use_routes.length
      : 0,
    owner_gated_actions: Array.isArray(result?.body?.owner_gated_actions)
      ? result.body.owner_gated_actions.length
      : 0,
    monitored_sync_domains: Array.isArray(result?.body?.monitored_sync_domains)
      ? result.body.monitored_sync_domains.length
      : 0,
    sync_domain_coverage_complete:
      result?.body?.sync_domain_coverage?.coverage_complete ?? null,
    registered_sync_domains:
      result?.body?.sync_domain_coverage?.registered_domain_count ?? null,
    visible_registered_sync_domains:
      result?.body?.sync_domain_coverage?.visible_registered_domain_count ??
      null,
    missing_registered_sync_domains: Array.isArray(
      result?.body?.sync_domain_coverage?.missing_registered_domain_ids
    )
      ? result.body.sync_domain_coverage.missing_registered_domain_ids.length
      : null,
    failures,
    privacy_boundary:
      "This verifier starts a temporary local Next dev server when available, or reuses an already-running same-project dev server without stopping it. It requests only /daily for readiness and /api/stable-use/health for the health check. It does not read browser storage, page bodies, database rows, file names, file bytes, cookies, credentials, secrets, remote manifests, or cloud data; it does not write server data, upload workspace data, clear cache, enable sync, or enable AI.",
  };
  const label =
    status === "passed"
      ? "Stable-use health verification passed"
      : "Stable-use health verification failed";
  console.log(label);
  console.log(JSON.stringify(receipt, null, 2));
}

void main();
