#!/usr/bin/env node

import { spawn } from "node:child_process";
import process from "node:process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const verificationCommands = [
  {
    id: "verify-account",
    command: "npm run verify:account",
    args: ["run", "verify:account"],
    purpose:
      "Check login/session contracts, account sync guards, and local cache rebuild gates.",
  },
  {
    id: "verify-module-workspaces",
    command: "npm run verify:module-workspaces",
    args: ["run", "verify:module-workspaces"],
    purpose:
      "Check the modular workspace roots that make ZhiNotes extensible.",
  },
  {
    id: "verify-web-beta",
    command: "npm run verify:web-beta",
    args: ["run", "verify:web-beta"],
    purpose:
      "Check Web Beta contracts, guarded routes, migrations, and Sync UI wiring.",
  },
  {
    id: "verify-web-beta-smoke",
    command: "npm run verify:web-beta:smoke",
    args: ["run", "verify:web-beta:smoke"],
    purpose:
      "Check preview smoke-plan coverage, hot-cache policy, and disabled cloud defaults.",
  },
  {
    id: "verify-cloud-manifest",
    command: "npm run verify:cloud-manifest",
    args: ["run", "verify:cloud-manifest"],
    purpose:
      "Evaluate the metadata-only cloud manifest domain contract for every sync domain.",
  },
  {
    id: "verify-cloud-manifest-api",
    command: "npm run verify:cloud-manifest-api",
    args: ["run", "verify:cloud-manifest-api"],
    purpose:
      "Evaluate the disabled cloud manifest compare API response and schema guard.",
  },
  {
    id: "verify-cloud-manifest-route",
    command: "npm run verify:cloud-manifest-route",
    args: ["run", "verify:cloud-manifest-route"],
    purpose:
      "Request the disabled cloud manifest compare route and verify its HTTP response guard.",
  },
  {
    id: "verify-route-smoke",
    command: "npm run verify:route-smoke",
    args: ["run", "verify:route-smoke"],
    purpose:
      "Request public local route shells only, without reading browser storage or private content.",
  },
  {
    id: "verify-replay-harness",
    command: "npm run verify:replay-harness",
    args: ["run", "verify:replay-harness"],
    purpose:
      "Prove disposable replay harness stays disabled and empty-fixture only.",
  },
  {
    id: "lint",
    command: "npm run lint",
    args: ["run", "lint"],
    purpose: "Catch TypeScript, React, and ESLint issues before owner review.",
  },
  {
    id: "production-build",
    command: "npm run build",
    args: ["run", "build"],
    purpose: "Create the optimized Next.js build before private beta review.",
  },
];

async function run() {
  const startedAt = new Date();
  const results = [];

  for (const item of verificationCommands) {
    const result = await runCommand(item);
    results.push(result);
    if (result.status !== "passed") {
      printReceipt(startedAt, results, "failed");
      process.exit(1);
    }
  }

  printReceipt(startedAt, results, "passed");
}

function runCommand(item) {
  const startedAt = new Date();
  console.log(`\n[web-beta:full] Running ${item.command}`);

  return new Promise((resolve) => {
    const child = spawn(npmCommand, item.args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NEXT_TELEMETRY_DISABLED: "1",
      },
      stdio: "inherit",
      shell: false,
    });

    child.on("close", (code, signal) => {
      const finishedAt = new Date();
      resolve({
        id: item.id,
        command: item.command,
        purpose: item.purpose,
        status: code === 0 ? "passed" : "failed",
        exit_code: code,
        signal,
        started_at: startedAt.toISOString(),
        finished_at: finishedAt.toISOString(),
        duration_ms: finishedAt.getTime() - startedAt.getTime(),
      });
    });

    child.on("error", (error) => {
      const finishedAt = new Date();
      resolve({
        id: item.id,
        command: item.command,
        purpose: item.purpose,
        status: "failed",
        exit_code: null,
        signal: null,
        started_at: startedAt.toISOString(),
        finished_at: finishedAt.toISOString(),
        duration_ms: finishedAt.getTime() - startedAt.getTime(),
        error: error.message,
      });
    });
  });
}

function printReceipt(startedAt, results, status) {
  const finishedAt = new Date();
  const receipt = {
    format: "zhinote-web-beta-full-verification-receipt",
    format_version: 1,
    receipt_status: status,
    release_verdict:
      status === "passed"
        ? "web-beta-local-gates-passed-not-launched"
        : "web-beta-local-gates-failed",
    local_app_can_continue_now: status === "passed",
    web_beta_can_launch_now: false,
    cloud_sync_can_start_now: false,
    privacy_note:
      "Generated locally by running Web Beta gate commands. This receipt does not deploy the app, create accounts, connect cloud services, write server data, upload workspace data, read page body text, read database row values, read file bytes, read secret values, enable sync, or enable AI. The route smoke step may make localhost-only HTTP requests to public route shells.",
    boundary: {
      local_receipt_only: true,
      runs_local_commands: true,
      uses_localhost_http_for_route_smoke: true,
      sends_external_network_requests: false,
      deploys_app: false,
      creates_accounts: false,
      connects_cloud_services: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      reads_page_body_text: false,
      reads_database_row_values: false,
      reads_file_names: false,
      reads_file_bytes: false,
      reads_secret_values: false,
      reads_holding_details: false,
      reads_trading_plans: false,
      enables_sync: false,
      enables_ai: false,
      requires_owner_confirmation_before_web_beta: true,
      requires_owner_confirmation_before_cloud_sync: true,
    },
    summary: {
      commands: results.length,
      passed: results.filter((result) => result.status === "passed").length,
      failed: results.filter((result) => result.status === "failed").length,
      duration_ms: finishedAt.getTime() - startedAt.getTime(),
    },
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    commands: results,
    next_required_owner_decisions: [
      "Approve private beta audience and preview URL exposure.",
      "Confirm cloud writes remain disabled until payload preview and typed confirmation pass.",
      "Confirm no local pages, files, databases, backups, holdings, or sync queue rows are uploaded during this verification.",
      "Confirm cloud manifest checks remain metadata-only before any cloud compare or cache rebuild.",
      "Confirm cloud manifest compare API remains disabled and returns guard metadata only.",
      "Confirm the real cloud manifest compare route returns disabled guard JSON and does not echo query values.",
      "Require a separate disposable cloud replay before any production sync enablement.",
    ],
  };

  const label =
    status === "passed"
      ? "Web Beta full verification receipt passed"
      : "Web Beta full verification receipt failed";
  console.log(`\n${label}`);
  console.log(JSON.stringify(receipt, null, 2));
}

void run();
