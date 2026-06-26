#!/usr/bin/env node

import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import process from "node:process";

const HOST = "127.0.0.1";
const ROUTES = [
  {
    path: "/daily",
    label: "daily calendar",
    expectedStatus: 200,
  },
  {
    path: "/page/zhinote-route-prefetch",
    label: "page route shell",
    expectedStatus: 200,
  },
];
const START_TIMEOUT_MS = 30_000;
const REQUEST_TIMEOUT_MS = 10_000;
const LOG_LIMIT = 16_000;

async function main() {
  const port = await findFreePort();
  const baseUrl = `http://${HOST}:${port}`;
  const child = startNextDev(port);
  let output = "";
  const appendOutput = (chunk) => {
    output = `${output}${chunk.toString()}`;
    if (output.length > LOG_LIMIT) output = output.slice(-LOG_LIMIT);
  };
  child.stdout.on("data", appendOutput);
  child.stderr.on("data", appendOutput);

  try {
    await waitForRoute(`${baseUrl}/daily`, START_TIMEOUT_MS);
    const results = [];
    for (const route of ROUTES) {
      const result = await requestRoute(`${baseUrl}${route.path}`);
      if (result.statusCode !== route.expectedStatus) {
        throw new Error(
          `${route.label} returned ${result.statusCode}, expected ${route.expectedStatus}`
        );
      }
      const contentType = result.headers["content-type"] ?? "";
      if (!String(contentType).includes("text/html")) {
        throw new Error(
          `${route.label} returned unexpected content-type: ${contentType}`
        );
      }
      results.push({
        route: route.path,
        status: result.statusCode,
        durationMs: Math.round(result.durationMs),
      });
    }
    console.log("Route smoke verification passed");
    console.log(
      JSON.stringify(
        {
          mode: "next-dev-http",
          host: HOST,
          port,
          routes: results,
          privacyBoundary:
            "This check requests only public route shells from a temporary local dev server. It does not read browser storage, page bodies, database rows, file bytes, cookies, credentials, or cloud data.",
        },
        null,
        2
      )
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("verify:route-smoke failed:", message);
    if (output.trim()) {
      console.error("\n--- next dev output ---");
      console.error(output.trim());
    }
    process.exitCode = 1;
  } finally {
    await stopChild(child);
  }
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
        else reject(new Error("Could not allocate a local smoke-test port"));
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
      res.resume();
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
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

main();
