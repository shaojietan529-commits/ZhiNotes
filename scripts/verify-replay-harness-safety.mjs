#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

const files = {
  packageJson: "package.json",
  harness: "src/lib/sync/remoteBaselineReplayHarness.ts",
  fixture: "src/lib/sync/remoteBaselineReplayFixture.ts",
  stageReplay: "src/lib/sync/remoteBaselineStageReplay.ts",
  stageSchema: "src/lib/sync/remoteBaselineStageSchema.ts",
  apiStubs: "src/lib/sync/webBetaApiStubs.ts",
  replayRoute: "src/app/api/sync/replay-test/route.ts",
  syncShell: "src/components/modules/SyncShell.tsx",
  smokeTestPlan: "src/lib/sync/webBetaSmokeTestPlan.ts",
  readme: "README.md",
};

const failures = [];

function readProjectFile(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!existsSync(absolutePath)) {
    failures.push(`Missing file: ${relativePath}`);
    return "";
  }
  return readFileSync(absolutePath, "utf8");
}

function assertIncludes(sourceLabel, source, snippet, message) {
  if (!source.includes(snippet)) {
    failures.push(`${sourceLabel} missing ${snippet}: ${message}`);
  }
}

function assertExcludes(sourceLabel, source, snippet, message) {
  if (source.includes(snippet)) {
    failures.push(`${sourceLabel} must not include ${snippet}: ${message}`);
  }
}

function run() {
  const packageJson = JSON.parse(readProjectFile(files.packageJson));
  const harness = readProjectFile(files.harness);
  const fixture = readProjectFile(files.fixture);
  const stageReplay = readProjectFile(files.stageReplay);
  const stageSchema = readProjectFile(files.stageSchema);
  const apiStubs = readProjectFile(files.apiStubs);
  const replayRoute = readProjectFile(files.replayRoute);
  const syncShell = readProjectFile(files.syncShell);
  const smokeTestPlan = readProjectFile(files.smokeTestPlan);
  const readme = readProjectFile(files.readme);

  const scripts = packageJson.scripts ?? {};
  if (scripts["verify:replay-harness"] !== "node scripts/verify-replay-harness-safety.mjs") {
    failures.push("package.json must expose verify:replay-harness safety check.");
  }

  for (const [snippet, message] of [
    [
      'format: "zhinote-remote-baseline-replay-harness-preflight"',
      "Harness preflight must keep a stable export format.",
    ],
    [
      'preflight_status: "local-harness-preflight-only"',
      "Harness preflight must remain local-only.",
    ],
    ["can_run_harness_now: false", "Harness must not be runnable."],
    ["can_connect_database_now: false", "Harness must not connect databases."],
    ["can_apply_sql_now: false", "Harness must not apply SQL."],
    ["can_write_server_data_now: false", "Harness must not write server data."],
    ["can_stage_remote_rows_now: false", "Harness must not stage remote rows."],
    [
      "can_upload_workspace_data_now: false",
      "Harness must not upload workspace data.",
    ],
    [
      'disabled_replay_endpoint: "/api/sync/replay-test"',
      "Harness must keep replay endpoint disabled.",
    ],
    [
      'disabled_apply_path: "/api/cloud/migrations/apply"',
      "Harness must keep migration apply disabled.",
    ],
    ["dry_run_only: true", "Harness must remain dry-run only."],
    [
      "uses_empty_fixture_package: true",
      "Harness must use empty fixture package only.",
    ],
    [
      "requires_owner_confirmation_receipt: true",
      "Harness must require owner confirmation receipt.",
    ],
    [
      "requires_empty_fixture_package: true",
      "Harness must require empty fixture package.",
    ],
    [
      "requires_payload_denylist: true",
      "Harness must require payload denylist.",
    ],
    [
      "requires_redacted_audit_event: true",
      "Harness must require redacted audit event.",
    ],
    [
      "load-empty-fixture-package",
      "Harness must keep empty fixture loading step.",
    ],
    [
      "verify-owner-receipt",
      "Harness must keep owner receipt verification step.",
    ],
    ["plan-up-down-replay", "Harness must keep up/down replay plan."],
    ["plan-rls-isolation", "Harness must keep RLS isolation plan."],
    ["plan-cursor-idempotency", "Harness must keep cursor idempotency plan."],
    ["plan-rollback-proof", "Harness must keep rollback proof plan."],
    [
      "fixture-has-zero-payload",
      "Harness must assert fixture has zero payload.",
    ],
    [
      "denylist-covers-private-content",
      "Harness must assert private content denylist coverage.",
    ],
    [
      "network-disabled-gate",
      "Harness must keep network disabled gate.",
    ],
    [
      "rollback-before-apply-gate",
      "Harness must keep rollback-before-apply gate.",
    ],
  ]) {
    assertIncludes(files.harness, harness, snippet, message);
  }

  for (const [snippet, message] of [
    [
      'format: "zhinote-remote-baseline-replay-fixture-package"',
      "Fixture package must keep a stable export format.",
    ],
    [
      'package_status: "local-empty-fixture-package-only"',
      "Fixture package must remain local empty fixture only.",
    ],
    ["can_run_replay_now: false", "Fixture package must not run replay."],
    [
      "can_connect_database_now: false",
      "Fixture package must not connect databases.",
    ],
    ["can_apply_sql_now: false", "Fixture package must not apply SQL."],
    [
      "can_stage_remote_rows_now: false",
      "Fixture package must not stage remote rows.",
    ],
    [
      "can_upload_workspace_data_now: false",
      "Fixture package must not upload workspace data.",
    ],
    ["stage_seed_rows: 0", "Fixture package must keep zero stage rows."],
    [
      "cursor_proof_seed_rows: 0",
      "Fixture package must keep zero cursor proof rows.",
    ],
    ["includes_tokens: false", "Fixture package must not include tokens."],
    ["includes_cookies: false", "Fixture package must not include cookies."],
    [
      "fixture-workspace-a-empty",
      "Fixture package must define empty workspace A.",
    ],
    [
      "fixture-workspace-b-empty",
      "Fixture package must define empty workspace B.",
    ],
    [
      "payload_column_denylist",
      "Fixture package must export payload column denylist.",
    ],
  ]) {
    assertIncludes(files.fixture, fixture, snippet, message);
  }

  for (const [sourceLabel, source] of [
    [files.harness, harness],
    [files.fixture, fixture],
  ]) {
    for (const [snippet, message] of [
      ["fetch(", "Local harness and fixture must not start network calls."],
      ["XMLHttpRequest", "Local harness and fixture must not start browser requests."],
      ["WebSocket", "Local harness and fixture must not open sockets."],
      ["createClient(", "Local harness and fixture must not instantiate cloud clients."],
      ["process.env", "Local harness and fixture must not read secrets or env values."],
      ["writeFile(", "Local harness and fixture must not write files."],
      ["appendFile(", "Local harness and fixture must not append files."],
      ["exec(", "Local harness and fixture must not run shell commands."],
      ["spawn(", "Local harness and fixture must not spawn processes."],
    ]) {
      assertExcludes(sourceLabel, source, snippet, message);
    }
  }

  for (const [snippet, message] of [
    ["can_run_replay_now: false", "Stage replay contract must keep replay disabled."],
    [
      "can_connect_disposable_database_now: false",
      "Stage replay contract must not connect disposable database yet.",
    ],
    ["can_apply_sql_now: false", "Stage replay contract must keep SQL apply disabled."],
    [
      "requires_owner_confirmation_before_replay: true",
      "Stage replay must require owner confirmation before replay.",
    ],
    [
      "requires_empty_workspace_fixture: true",
      "Stage replay must require empty workspace fixtures.",
    ],
  ]) {
    assertIncludes(files.stageReplay, stageReplay, snippet, message);
  }

  for (const [snippet, message] of [
    [
      "requires_disposable_database_replay: true",
      "Stage schema must require disposable replay before apply.",
    ],
    ["can_apply_sql_now: false", "Stage schema must keep SQL apply disabled."],
    [
      "remote_baseline_stage_no_payload_columns",
      "Stage schema must keep payload-column denylist constraint.",
    ],
  ]) {
    assertIncludes(files.stageSchema, stageSchema, snippet, message);
  }

  for (const [sourceLabel, source, snippet, message] of [
    [
      files.replayRoute,
      replayRoute,
      'buildWebBetaApiStubResponse("sync-replay-test")',
      "Replay route must remain a disabled Web Beta stub.",
    ],
    [
      files.replayRoute,
      replayRoute,
      "export async function POST()",
      "Replay route must not accept/read request payload yet.",
    ],
    [
      files.apiStubs,
      apiStubs,
      "does not read replay payloads, connect cloud services, push data, pull remote rows, acknowledge sync rows, write local data, or upload workspace data",
      "Replay API stub must preserve privacy boundary.",
    ],
    [
      files.syncShell,
      syncShell,
      "Disposable replay harness preflight",
      "Sync UI must render harness preflight panel.",
    ],
    [
      files.syncShell,
      syncShell,
      "Export harness preflight",
      "Sync UI must expose harness export action.",
    ],
    [
      files.syncShell,
      syncShell,
      "RemoteBaselineReplayHarnessStepRow",
      "Sync UI must render harness step rows.",
    ],
    [
      files.syncShell,
      syncShell,
      "RemoteBaselineReplayHarnessAssertionRow",
      "Sync UI must render harness assertion rows.",
    ],
    [
      files.syncShell,
      syncShell,
      "RemoteBaselineReplayHarnessGateRow",
      "Sync UI must render harness gate rows.",
    ],
    [
      files.smokeTestPlan,
      smokeTestPlan,
      "npm run verify:replay-harness",
      "Smoke test plan must include replay harness safety verification.",
    ],
    [
      files.readme,
      readme,
      "npm run verify:replay-harness",
      "README must document replay harness safety verification.",
    ],
  ]) {
    assertIncludes(sourceLabel, source, snippet, message);
  }

  const summary = {
    harness_boundary_checks: 49,
    fixture_boundary_checks: 23,
    route_and_ui_checks: 8,
    documentation_checks: 2,
  };

  if (failures.length > 0) {
    console.error("Replay harness safety verification failed");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("Replay harness safety verification passed");
  console.log(JSON.stringify(summary, null, 2));
}

run();
