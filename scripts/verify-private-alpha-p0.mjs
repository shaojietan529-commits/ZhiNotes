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
      "Check account/session stability, transient-error fallback, and sync gates.",
  },
  {
    id: "verify-local-use-readiness",
    command: "npm run verify:local-use-readiness",
    args: ["run", "verify:local-use-readiness"],
    purpose:
      "Check local input continuity, pending/failed/manual review visibility, and cache rebuild blockers.",
  },
  {
    id: "verify-module-workspaces",
    command: "npm run verify:module-workspaces",
    args: ["run", "verify:module-workspaces"],
    purpose:
      "Check modular workspace roots and sidebar-safe module entrypoints.",
  },
  {
    id: "verify-modules",
    command: "npm run verify:modules",
    args: ["run", "verify:modules"],
    purpose:
      "Check module registry contracts, module center stable-use status, starter boundaries, and project progress snapshot.",
  },
  {
    id: "verify-database",
    command: "npm run verify:database",
    args: ["run", "verify:database"],
    purpose:
      "Check database views, import/export, local-first workbench, and destructive-action confirmations.",
  },
  {
    id: "verify-button-actions",
    command: "npm run verify:button-actions",
    args: ["run", "verify:button-actions"],
    purpose:
      "Check local-only reversible database button action runner boundaries.",
  },
  {
    id: "verify-editor",
    command: "npm run verify:editor",
    args: ["run", "verify:editor"],
    purpose:
      "Check Notion-style editor shortcuts, slash commands, child-page creation, and local-only export commands.",
  },
  {
    id: "verify-file-preview",
    command: "npm run verify:file-preview",
    args: ["run", "verify:file-preview"],
    purpose:
      "Check file preview/import readiness gates and local-only format workflow boundaries.",
  },
  {
    id: "verify-zhihui-glossary",
    command: "npm run verify:zhihui-glossary",
    args: ["run", "verify:zhihui-glossary"],
    purpose:
      "Check ZhiHui glossary privacy boundaries and sync-page read path.",
  },
  {
    id: "verify-meeting-intake",
    command: "npm run verify:meeting-intake",
    args: ["run", "verify:meeting-intake"],
    purpose:
      "Check synthetic ZhiHui meeting invite date/time parsing so imported meetings land on the expected calendar day.",
  },
  {
    id: "verify-meeting-import",
    command: "npm run verify:meeting-import",
    args: ["run", "verify:meeting-import"],
    purpose:
      "Check synthetic ZhiHui meeting artifact imports write page index records, metadata-only change logs, and calendar visibility receipts.",
  },
  {
    id: "verify-web-beta-smoke",
    command: "npm run verify:web-beta:smoke",
    args: ["run", "verify:web-beta:smoke"],
    purpose:
      "Check local-first Daily/ZhiHui smoke contracts and disabled high-risk defaults.",
  },
  {
    id: "verify-route-smoke",
    command: "npm run verify:route-smoke",
    args: ["run", "verify:route-smoke"],
    purpose:
      "Request local public route shells only for Daily, ZhiHui, account, sync center, module hub, database, report, file, company research, meeting, project, research graph, knowledge base, industry chain, portfolio, and page routes.",
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
  console.log(`\n[private-alpha:p0] Running ${item.command}`);

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
    format: "zhinote-private-alpha-p0-verification-receipt",
    format_version: 1,
    receipt_status: status,
    stable_use_verdict:
      status === "passed"
        ? "private-alpha-p0-stable-use-gates-passed-not-launched"
        : "private-alpha-p0-stable-use-gates-failed",
    local_app_can_continue_now: status === "passed",
    web_beta_can_launch_now: false,
    cloud_sync_can_start_now: false,
    privacy_note:
      "Generated locally by running fast Private Alpha P0 checks. This receipt does not deploy the app, create accounts, connect cloud services, write server data, upload workspace data, read page body text, read database row values, read file bytes, read secret values, enable sync, or enable AI. The route smoke step may make localhost-only HTTP requests to public route shells.",
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
      enables_sync: false,
      enables_ai: false,
      requires_owner_confirmation_before_web_beta: true,
      requires_owner_confirmation_before_cloud_sync: true,
    },
    p0_coverage: [
      "account session does not collapse on transient failures",
      "local input continuity, pending/failed/manual review visibility, and cache rebuild blockers stay mirrored in sidebar and sync center",
      "module workspace roots stay routable and extensible",
      "module center stable-use status and registry-backed module contracts stay visible",
      "database views, import/export, and local-only button actions stay inside safe local boundaries",
      "editor shortcuts, page creation, file preview, and ZhiHui glossary privacy contracts stay intact",
      "synthetic ZhiHui meeting invite parser cases continue to land on the expected calendar day",
      "synthetic ZhiHui meeting imports write metadata-only change logs and calendar visibility receipts",
      "Daily and ZhiHui local-first smoke contracts stay intact",
      "core account, sync, module, database, report, file, company research, meeting, project, research graph, knowledge, industry, calendar, portfolio, and page route shells respond before deeper data hydration",
    ],
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
      "Use this fast gate after small account, sync, Daily, ZhiHui, sidebar, or route changes.",
      "Run lint and build before shipping or pushing larger UI/runtime changes.",
      "Keep Web Beta launch, cloud sync enablement, private preview sharing, and production deployment behind separate owner confirmation.",
    ],
  };

  const label =
    status === "passed"
      ? "Private Alpha P0 verification receipt passed"
      : "Private Alpha P0 verification receipt failed";
  console.log(`\n${label}`);
  console.log(JSON.stringify(receipt, null, 2));
}

void run();
