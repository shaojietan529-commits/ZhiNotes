#!/usr/bin/env node

import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import process from "node:process";

const HOST = "127.0.0.1";
const EXISTING_DEV_PORT = 3000;
const ROUTES = [
  {
    path: "/daily",
    label: "daily calendar",
    expectedStatus: 200,
    expectedText: "每日纪要",
  },
  {
    path: "/schedule",
    label: "meeting calendar",
    expectedStatus: 200,
    expectedText: "ZhiHui",
  },
  {
    path: "/account",
    label: "account shell",
    expectedStatus: 200,
    expectedText: "account",
  },
  {
    path: "/modules/sync",
    label: "sync center shell",
    expectedStatus: 200,
    expectedText: "modules/sync",
  },
  {
    path: "/modules",
    label: "module hub shell",
    expectedStatus: 200,
    expectedText: "ZhiNote",
  },
  {
    path: "/modules/databases",
    label: "database module shell",
    expectedStatus: 200,
    expectedText: "ZhiNote",
  },
  {
    path: "/knowledge-base",
    label: "knowledge base shell",
    expectedStatus: 200,
    expectedText: "ZhiNote",
  },
  {
    path: "/industry-chain",
    label: "industry chain shell",
    expectedStatus: 200,
    expectedText: "ZhiNote",
  },
  {
    path: "/portfolio",
    label: "portfolio board",
    expectedStatus: 200,
    expectedText: "ZhiNote",
  },
  {
    path: "/page/zhinote-route-prefetch",
    label: "page route shell",
    expectedStatus: 200,
    expectedText: "页面",
  },
];
const START_TIMEOUT_MS = 30_000;
const REQUEST_TIMEOUT_MS = 10_000;
const LOG_LIMIT = 16_000;

async function main() {
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
      if (route.expectedText && !result.body.includes(route.expectedText)) {
        throw new Error(
          `${route.label} did not include expected route marker: ${route.expectedText}`
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
          mode: existingServer ? "existing-next-dev-http" : "next-dev-http",
          host: HOST,
          port,
          routes: results,
          privacyBoundary:
            "This check requests only public route shells from a local Next.js server, reusing an already-running local dev server when available or starting a temporary one otherwise. It does not read browser storage, page bodies, database rows, file bytes, cookies, credentials, or cloud data.",
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
    if (child) await stopChild(child);
  }
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
    // No reusable local app server; the smoke test will start its own.
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
