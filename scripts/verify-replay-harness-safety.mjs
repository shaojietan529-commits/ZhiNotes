#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

const files = {
  packageJson: "package.json",
  harness: "src/lib/sync/remoteBaselineReplayHarness.ts",
  runner: "src/lib/sync/remoteBaselineReplayRunner.ts",
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
  const runner = readProjectFile(files.runner);
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
      'format: "zhinote-remote-baseline-replay-runner-skeleton"',
      "Runner skeleton must keep a stable export format.",
    ],
    [
      'runner_status: "disabled-runner-skeleton-only"',
      "Runner skeleton must remain disabled.",
    ],
    [
      "can_export_runner_skeleton_now: true",
      "Runner skeleton may only be exported locally.",
    ],
    ["can_run_runner_now: false", "Runner must not be runnable."],
    ["can_connect_database_now: false", "Runner must not connect databases."],
    [
      "can_create_disposable_database_now: false",
      "Runner must not create disposable databases.",
    ],
    ["can_apply_sql_now: false", "Runner must not apply SQL."],
    [
      "can_start_network_request_now: false",
      "Runner must not start network requests.",
    ],
    [
      "can_write_server_data_now: false",
      "Runner must not write server data.",
    ],
    [
      "can_stage_remote_rows_now: false",
      "Runner must not stage remote rows.",
    ],
    [
      "can_acknowledge_remote_rows_now: false",
      "Runner must not acknowledge remote rows.",
    ],
    [
      "can_upload_workspace_data_now: false",
      "Runner must not upload workspace data.",
    ],
    [
      'disabled_replay_endpoint: "/api/sync/replay-test"',
      "Runner must keep replay endpoint disabled.",
    ],
    [
      'disabled_apply_path: "/api/cloud/migrations/apply"',
      "Runner must keep migration apply disabled.",
    ],
    [
      "local_skeleton_only: true",
      "Runner must remain a local skeleton.",
    ],
    [
      "runner_disabled_by_default: true",
      "Runner must stay disabled by default.",
    ],
    ["export_only: true", "Runner must only support local export."],
    ["dry_run_only: true", "Runner must remain dry-run only."],
    [
      "uses_empty_fixture_package: true",
      "Runner must depend on empty fixture package.",
    ],
    [
      "starts_network_request: false",
      "Runner must not start network requests.",
    ],
    [
      "creates_disposable_database: false",
      "Runner must not create databases.",
    ],
    [
      "connects_cloud_database: false",
      "Runner must not connect cloud database.",
    ],
    ["applies_sql: false", "Runner must not apply SQL."],
    ["writes_server_data: false", "Runner must not write server data."],
    [
      "writes_workspace_data: false",
      "Runner must not write workspace data.",
    ],
    [
      "uploads_workspace_data: false",
      "Runner must not upload workspace data.",
    ],
    ["reads_remote_data: false", "Runner must not read remote data."],
    [
      "reads_page_body_text: false",
      "Runner must not read page bodies.",
    ],
    [
      "reads_database_row_values: false",
      "Runner must not read database values.",
    ],
    [
      "reads_comment_bodies: false",
      "Runner must not read comment bodies.",
    ],
    ["reads_file_bytes: false", "Runner must not read file bytes."],
    ["includes_tokens: false", "Runner must not include tokens."],
    ["includes_cookies: false", "Runner must not include cookies."],
    [
      "stages_remote_rows: false",
      "Runner must not stage remote rows.",
    ],
    [
      "acknowledges_remote_rows: false",
      "Runner must not acknowledge remote rows.",
    ],
    [
      "applies_remote_changes: false",
      "Runner must not apply remote changes.",
    ],
    [
      "uses_production_workspace: false",
      "Runner must not use production workspace data.",
    ],
    [
      "reads_environment_values: false",
      "Runner must not read environment values.",
    ],
    [
      "uses_runtime_secrets: false",
      "Runner must not use runtime secrets.",
    ],
    [
      "requires_owner_confirmation_receipt: true",
      "Runner must require owner confirmation.",
    ],
    [
      "requires_empty_fixture_package: true",
      "Runner must require empty fixtures.",
    ],
    [
      "requires_payload_denylist: true",
      "Runner must require payload denylist.",
    ],
    [
      "requires_permission_check_stub: true",
      "Runner must require permission check stub.",
    ],
    [
      "requires_redacted_audit_event: true",
      "Runner must require redacted audit event.",
    ],
    [
      "requires_rls_assertion_plan: true",
      "Runner must require RLS assertion plan.",
    ],
    [
      "requires_rollback_assertion_plan: true",
      "Runner must require rollback assertion plan.",
    ],
    [
      "requires_owner_approval_to_enable: true",
      "Runner must require owner approval before enablement.",
    ],
    [
      "export-runner-skeleton",
      "Runner must expose a local export entrypoint.",
    ],
    [
      "verify-replay-harness",
      "Runner must point to the local safety verifier.",
    ],
    [
      "disabled-replay-route",
      "Runner must keep replay route disabled.",
    ],
    [
      "disabled-migration-apply-route",
      "Runner must keep migration apply route disabled.",
    ],
    [
      "load-harness-preflight",
      "Runner must load the harness preflight first.",
    ],
    [
      "verify-fixture-zero-payload",
      "Runner must verify zero fixture payload.",
    ],
    [
      "verify-owner-confirmation",
      "Runner must verify owner confirmation.",
    ],
    [
      "open-disposable-database-connection",
      "Runner must keep disposable database connection blocked.",
    ],
    ["apply-up-sql", "Runner must keep SQL apply blocked."],
    [
      "run-rls-isolation",
      "Runner must keep RLS proof as a blocked phase.",
    ],
    [
      "run-cursor-idempotency",
      "Runner must keep cursor idempotency as a blocked phase.",
    ],
    [
      "run-down-migration-rollback",
      "Runner must keep rollback as a blocked phase.",
    ],
    [
      "emit-redacted-audit-event",
      "Runner must keep audit emission blocked.",
    ],
    [
      "missing-owner-confirmation",
      "Runner must refuse replay without owner confirmation.",
    ],
    [
      "no-disposable-database",
      "Runner must refuse database work without disposable database.",
    ],
    [
      "permission-check-disabled",
      "Runner must refuse mutation while permission checks are disabled.",
    ],
    [
      "audit-write-disabled",
      "Runner must refuse audit writes while audit is disabled.",
    ],
    [
      "private-payload-denylist",
      "Runner must preserve private payload denylist refusal.",
    ],
  ]) {
    assertIncludes(files.runner, runner, snippet, message);
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
    [files.runner, runner],
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
      files.syncShell,
      syncShell,
      "Disabled replay runner skeleton",
      "Sync UI must render runner skeleton panel.",
    ],
    [
      files.syncShell,
      syncShell,
      "Export runner skeleton",
      "Sync UI must expose runner skeleton export action.",
    ],
    [
      files.syncShell,
      syncShell,
      "RemoteBaselineReplayRunnerEntryPointRow",
      "Sync UI must render runner entrypoint rows.",
    ],
    [
      files.syncShell,
      syncShell,
      "RemoteBaselineReplayRunnerPhaseRow",
      "Sync UI must render runner phase rows.",
    ],
    [
      files.syncShell,
      syncShell,
      "RemoteBaselineReplayRunnerRefusalRow",
      "Sync UI must render runner refusal rows.",
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
    runner_boundary_checks: 74,
    fixture_boundary_checks: 23,
    route_and_ui_checks: 13,
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
