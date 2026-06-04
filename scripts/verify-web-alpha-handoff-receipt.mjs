#!/usr/bin/env node

import { spawn } from "node:child_process";
import process from "node:process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const verificationCommands = [
  {
    id: "lint",
    command: "npm run lint",
    args: ["run", "lint"],
    purpose: "Catch TypeScript, React, and ESLint issues before preview review.",
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
      "Check preview smoke-plan coverage and disabled high-risk API defaults.",
  },
  {
    id: "verify-replay-harness",
    command: "npm run verify:replay-harness",
    args: ["run", "verify:replay-harness"],
    purpose:
      "Prove disposable replay harness stays disabled and empty-fixture only.",
  },
  {
    id: "production-build",
    command: "npm run build",
    args: ["run", "build"],
    purpose:
      "Create the optimized Next.js build before private preview review.",
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
  console.log(`\n[web-alpha] Running ${item.command}`);

  return new Promise((resolve) => {
    const child = spawn(npmCommand, item.args, {
      cwd: process.cwd(),
      env: process.env,
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
    format: "zhinote-web-alpha-verification-receipt",
    format_version: 1,
    receipt_status: status,
    release_verdict: status === "passed" ? "locally-verified-not-launched" : "failed",
    local_app_can_continue_now: true,
    web_alpha_can_be_shared_now: false,
    cloud_sync_can_start_now: false,
    privacy_note:
      "Generated locally by running code and contract checks. This receipt does not deploy the app, create accounts, connect cloud services, write server data, upload workspace data, read page body text, read database row values, read file bytes, read secret values, enable sync, or enable AI.",
    boundary: {
      local_receipt_only: true,
      runs_local_commands: true,
      sends_network_requests: false,
      deploys_app: false,
      creates_accounts: false,
      connects_cloud_services: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      reads_page_body_text: false,
      reads_database_row_values: false,
      reads_file_bytes: false,
      reads_secret_values: false,
      enables_sync: false,
      enables_ai: false,
      requires_owner_confirmation_before_preview: true,
      requires_owner_confirmation_before_cloud: true,
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
      "Approve private preview audience and data boundary.",
      "Confirm cloud writes remain disabled by default.",
      "Confirm no local pages, files, databases, backups, or sync queue rows are uploaded during preview review.",
      "Require a separate payload preview and typed confirmation before any cloud sync.",
    ],
  };

  const label =
    status === "passed"
      ? "Web Alpha verification receipt passed"
      : "Web Alpha verification receipt failed";
  console.log(`\n${label}`);
  console.log(JSON.stringify(receipt, null, 2));
}

void run();
