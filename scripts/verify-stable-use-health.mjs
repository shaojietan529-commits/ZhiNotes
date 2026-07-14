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
  assertIncludes(healthSource, "ACCOUNT_SESSION_UNCONFIRMED_REASON", "health response must use the shared account session uncertainty reason");
  assertIncludes(healthSource, "getDevelopmentStableUseRoutes()", "health response must use shared stable-use route catalog");
  assertIncludes(healthSource, "getDevelopmentExperimentalRoutes()", "health response must use shared experimental route catalog");
  assertIncludes(healthSource, "getDevelopmentOwnerGatedActions()", "health response must use shared owner-gated action catalog");
  assertIncludes(healthSource, "getPendingDomainCatalog()", "health response must use the shared pending-domain catalog");
  assertIncludes(healthSource, "buildPendingDomainCoverageReport", "health response must use the shared pending-domain coverage report");
  assertIncludes(healthSource, "monitored_sync_domains", "health response must expose monitored sync domains");
  assertIncludes(healthSource, "sync_domain_coverage", "health response must expose sync-domain coverage");
  assertIncludes(healthSource, "account_session_policy", "health response must expose account session uncertainty policy");
  assertIncludes(healthSource, "retryable_session_uncertainty: true", "account session uncertainty must be retryable");
  assertIncludes(healthSource, "keeps_session_cookie_on_uncertainty: true", "account session uncertainty must keep the session cookie");
  assertIncludes(healthSource, "explicit_logout_required_to_clear_session: true", "account session policy must require explicit logout before clearing session");
  assertIncludes(healthSource, "sync_failure_can_clear_session: false", "sync failure must not be allowed to clear session state");
  assertIncludes(healthSource, "local_input_can_continue_during_uncertainty: true", "local input must remain available during session uncertainty");
  assertIncludes(healthSource, "local_use_policy", "account session policy must expose local-use behavior for stable-use checks");
  assertIncludes(healthSource, "local_input_can_continue: true", "local-use policy must keep local input available");
  assertIncludes(healthSource, "upload_block_does_not_block_writing: true", "upload blocks must not block local writing");
  assertIncludes(healthSource, "hot_cache_safety_policy", "health response must expose hot cache safety policy");
  assertIncludes(healthSource, 'architecture_target: "cloud-master-local-hot-cache"', "hot cache policy must preserve the cloud-master/local-hot-cache target");
  assertIncludes(healthSource, 'local_hot_cache_role: "rebuildable-speed-layer"', "hot cache policy must keep local cache as a rebuildable speed layer");
  assertIncludes(healthSource, 'source_of_truth: "cloud-master"', "hot cache policy must keep cloud as source of truth");
  assertIncludes(healthSource, 'first_paint_strategy: "local-metadata-first-then-background-cloud-refresh"', "hot cache policy must preserve metadata-first paint");
  assertIncludes(healthSource, "cache_rebuild_requires_pending_clear: true", "hot cache rebuild must require pending queue clearance");
  assertIncludes(healthSource, "cache_rebuild_requires_failed_clear: true", "hot cache rebuild must require failed queue clearance");
  assertIncludes(healthSource, "cache_rebuild_requires_manual_review_clear: true", "hot cache rebuild must require manual-review clearance");
  assertIncludes(healthSource, "cache_rebuild_requires_owner_confirmation: true", "hot cache rebuild must require owner confirmation");
  assertIncludes(healthSource, "pending_rows_never_evicted: true", "pending rows must never be evicted by hot cache policy");
  assertIncludes(healthSource, "local_hot_cache_can_be_only_source_of_truth: false", "local hot cache must never be the only source of truth");
  assertIncludes(healthSource, "stores_private_payload_by_default: false", "hot cache policy must not store private payload by default");
  assertIncludes(healthSource, "warmup_can_upload_data: false", "hot cache warmup must not upload data");
  assertIncludes(healthSource, "experimental_routes", "health response must expose experimental route catalog");
  assertIncludes(healthSource, "development_lane_policy", "health response must expose development lane policy");
  assertIncludes(healthSource, 'development_channel: "private-alpha-stable-use"', "development lane policy must preserve the private alpha stable-use channel");
  assertIncludes(healthSource, 'stable_use_lane: "route-smoke-protected"', "development lane policy must keep stable routes route-smoke protected");
  assertIncludes(healthSource, 'experimental_lane: "owner-gated-or-staging-first"', "development lane policy must keep experiments owner-gated or staging-first");
  assertIncludes(healthSource, "production_interruptions_should_be_batched: true", "development lane policy must batch production interruptions");
  assertIncludes(healthSource, "experimental_changes_go_to_staging_first: true", "development lane policy must send experiments to staging first");
  assertIncludes(healthSource, "stable_use_routes_require_p0_gate: true", "stable-use routes must require the P0 gate");
  assertIncludes(healthSource, "high_risk_actions_require_owner_gate: true", "high-risk actions must require owner gate");
  assertIncludes(healthSource, "web_beta_launch_requires_owner_gate: true", "Web Beta launch must require owner gate");
  assertIncludes(healthSource, "real_cloud_sync_requires_owner_gate: true", "real cloud sync must require owner gate");
  assertIncludes(healthSource, "ai_execution_requires_owner_gate: true", "AI execution must require owner gate");
  assertIncludes(healthSource, "bulk_import_apply_requires_owner_gate: true", "bulk import apply must require owner gate");
  assertIncludes(healthSource, "restore_writeback_requires_owner_gate: true", "restore writeback must require owner gate");
  assertIncludes(healthSource, "bulk_import_first_paint_policy", "health response must expose bulk-import first-paint policy");
  assertIncludes(healthSource, 'policy_status: "metadata-first-visible-shell"', "bulk-import first-paint policy must keep a visible metadata shell");
  assertIncludes(healthSource, 'calendar_window_strategy: "six-week-current-month-range"', "bulk-import first-paint policy must keep a bounded calendar window");
  assertIncludes(healthSource, "max_calendar_cells_first_paint: 42", "bulk-import first-paint policy must cap the first-paint calendar grid");
  assertIncludes(healthSource, "daily_calendar_uses_metadata_status: true", "bulk-import first-paint policy must require Daily metadata status");
  assertIncludes(healthSource, "meeting_calendar_uses_metadata_status: true", "bulk-import first-paint policy must require meeting metadata status");
  assertIncludes(healthSource, "page_list_uses_metadata_status: true", "bulk-import first-paint policy must require page-list metadata status");
  assertIncludes(healthSource, "page_body_hydration_deferred: true", "bulk-import first-paint policy must defer page body hydration");
  assertIncludes(healthSource, "imported_content_backfill_batched: true", "bulk-import first-paint policy must batch imported content backfill");
  assertIncludes(healthSource, "visible_shell_before_cloud_check: true", "bulk-import first-paint policy must show the shell before cloud checks");
  assertIncludes(healthSource, "background_cloud_refresh_can_block_first_paint: false", "bulk-import first-paint policy must not let cloud refresh block first paint");
  assertIncludes(healthSource, "route_smoke_budget_ms: 5000", "bulk-import first-paint policy must preserve the route smoke budget");
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
    !Array.isArray(body?.experimental_routes) ||
    body.experimental_routes.length < 3 ||
    !body.experimental_routes.includes("/modules/ai")
  ) {
    failures.push("experimental_routes must list the experimental route catalog");
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
  const accountPolicy = body?.account_session_policy ?? {};
  assertEqual(
    accountPolicy.session_uncertainty_reason,
    "session-unconfirmed",
    "account_session_policy.session_uncertainty_reason"
  );
  assertEqual(
    accountPolicy.retryable_session_uncertainty,
    true,
    "account_session_policy.retryable_session_uncertainty"
  );
  assertEqual(
    accountPolicy.keeps_session_cookie_on_uncertainty,
    true,
    "account_session_policy.keeps_session_cookie_on_uncertainty"
  );
  assertEqual(
    accountPolicy.explicit_logout_required_to_clear_session,
    true,
    "account_session_policy.explicit_logout_required_to_clear_session"
  );
  assertEqual(
    accountPolicy.sync_failure_can_clear_session,
    false,
    "account_session_policy.sync_failure_can_clear_session"
  );
  assertEqual(
    accountPolicy.local_input_can_continue_during_uncertainty,
    true,
    "account_session_policy.local_input_can_continue_during_uncertainty"
  );
  const localUsePolicy = accountPolicy.local_use_policy ?? {};
  assertEqual(
    localUsePolicy.local_input_can_continue,
    true,
    "account_session_policy.local_use_policy.local_input_can_continue"
  );
  assertEqual(
    localUsePolicy.sync_failure_can_clear_session,
    false,
    "account_session_policy.local_use_policy.sync_failure_can_clear_session"
  );
  assertEqual(
    localUsePolicy.explicit_logout_required_to_clear_session,
    true,
    "account_session_policy.local_use_policy.explicit_logout_required_to_clear_session"
  );
  assertEqual(
    localUsePolicy.upload_block_does_not_block_writing,
    true,
    "account_session_policy.local_use_policy.upload_block_does_not_block_writing"
  );
  const accountPolicyCopy = String(accountPolicy.user_facing_copy ?? "");
  if (
    !accountPolicyCopy.includes("明确退出登录") ||
    !accountPolicyCopy.includes("不能阻止本地写作")
  ) {
    failures.push(
      "account_session_policy.user_facing_copy must explain that only explicit logout clears the session and upload failures cannot block local writing"
    );
  }
  const hotCachePolicy = body?.hot_cache_safety_policy ?? {};
  assertEqual(
    hotCachePolicy.architecture_target,
    "cloud-master-local-hot-cache",
    "hot_cache_safety_policy.architecture_target"
  );
  assertEqual(
    hotCachePolicy.local_hot_cache_role,
    "rebuildable-speed-layer",
    "hot_cache_safety_policy.local_hot_cache_role"
  );
  assertEqual(
    hotCachePolicy.source_of_truth,
    "cloud-master",
    "hot_cache_safety_policy.source_of_truth"
  );
  assertEqual(
    hotCachePolicy.first_paint_strategy,
    "local-metadata-first-then-background-cloud-refresh",
    "hot_cache_safety_policy.first_paint_strategy"
  );
  assertEqual(
    hotCachePolicy.cache_rebuild_requires_pending_clear,
    true,
    "hot_cache_safety_policy.cache_rebuild_requires_pending_clear"
  );
  assertEqual(
    hotCachePolicy.cache_rebuild_requires_failed_clear,
    true,
    "hot_cache_safety_policy.cache_rebuild_requires_failed_clear"
  );
  assertEqual(
    hotCachePolicy.cache_rebuild_requires_manual_review_clear,
    true,
    "hot_cache_safety_policy.cache_rebuild_requires_manual_review_clear"
  );
  assertEqual(
    hotCachePolicy.cache_rebuild_requires_owner_confirmation,
    true,
    "hot_cache_safety_policy.cache_rebuild_requires_owner_confirmation"
  );
  assertEqual(
    hotCachePolicy.pending_rows_never_evicted,
    true,
    "hot_cache_safety_policy.pending_rows_never_evicted"
  );
  assertEqual(
    hotCachePolicy.local_hot_cache_can_be_only_source_of_truth,
    false,
    "hot_cache_safety_policy.local_hot_cache_can_be_only_source_of_truth"
  );
  assertEqual(
    hotCachePolicy.stores_private_payload_by_default,
    false,
    "hot_cache_safety_policy.stores_private_payload_by_default"
  );
  assertEqual(
    hotCachePolicy.warmup_can_upload_data,
    false,
    "hot_cache_safety_policy.warmup_can_upload_data"
  );
  if (!String(hotCachePolicy.user_facing_copy ?? "").includes("pending")) {
    failures.push(
      "hot_cache_safety_policy.user_facing_copy must explain pending queue protection"
    );
  }
  const developmentLanePolicy = body?.development_lane_policy ?? {};
  assertEqual(
    developmentLanePolicy.development_channel,
    "private-alpha-stable-use",
    "development_lane_policy.development_channel"
  );
  assertEqual(
    developmentLanePolicy.stable_use_lane,
    "route-smoke-protected",
    "development_lane_policy.stable_use_lane"
  );
  assertEqual(
    developmentLanePolicy.experimental_lane,
    "owner-gated-or-staging-first",
    "development_lane_policy.experimental_lane"
  );
  assertEqual(
    developmentLanePolicy.production_interruptions_should_be_batched,
    true,
    "development_lane_policy.production_interruptions_should_be_batched"
  );
  assertEqual(
    developmentLanePolicy.experimental_changes_go_to_staging_first,
    true,
    "development_lane_policy.experimental_changes_go_to_staging_first"
  );
  assertEqual(
    developmentLanePolicy.stable_use_routes_require_p0_gate,
    true,
    "development_lane_policy.stable_use_routes_require_p0_gate"
  );
  assertEqual(
    developmentLanePolicy.high_risk_actions_require_owner_gate,
    true,
    "development_lane_policy.high_risk_actions_require_owner_gate"
  );
  assertEqual(
    developmentLanePolicy.web_beta_launch_requires_owner_gate,
    true,
    "development_lane_policy.web_beta_launch_requires_owner_gate"
  );
  assertEqual(
    developmentLanePolicy.real_cloud_sync_requires_owner_gate,
    true,
    "development_lane_policy.real_cloud_sync_requires_owner_gate"
  );
  assertEqual(
    developmentLanePolicy.ai_execution_requires_owner_gate,
    true,
    "development_lane_policy.ai_execution_requires_owner_gate"
  );
  assertEqual(
    developmentLanePolicy.bulk_import_apply_requires_owner_gate,
    true,
    "development_lane_policy.bulk_import_apply_requires_owner_gate"
  );
  assertEqual(
    developmentLanePolicy.restore_writeback_requires_owner_gate,
    true,
    "development_lane_policy.restore_writeback_requires_owner_gate"
  );
  assertEqual(
    developmentLanePolicy.stable_use_route_count,
    Array.isArray(body?.stable_use_routes) ? body.stable_use_routes.length : 0,
    "development_lane_policy.stable_use_route_count"
  );
  assertEqual(
    developmentLanePolicy.experimental_route_count,
    Array.isArray(body?.experimental_routes) ? body.experimental_routes.length : 0,
    "development_lane_policy.experimental_route_count"
  );
  assertEqual(
    developmentLanePolicy.owner_gated_action_count,
    Array.isArray(body?.owner_gated_actions) ? body.owner_gated_actions.length : 0,
    "development_lane_policy.owner_gated_action_count"
  );
  if (!String(developmentLanePolicy.user_facing_copy ?? "").includes("实验")) {
    failures.push(
      "development_lane_policy.user_facing_copy must explain experimental feature gating"
    );
  }
  const bulkImportFirstPaintPolicy = body?.bulk_import_first_paint_policy ?? {};
  assertEqual(
    bulkImportFirstPaintPolicy.policy_status,
    "metadata-first-visible-shell",
    "bulk_import_first_paint_policy.policy_status"
  );
  if (
    !Array.isArray(bulkImportFirstPaintPolicy.applies_to_surfaces) ||
    !bulkImportFirstPaintPolicy.applies_to_surfaces.includes("/daily") ||
    !bulkImportFirstPaintPolicy.applies_to_surfaces.includes("/schedule") ||
    !bulkImportFirstPaintPolicy.applies_to_surfaces.includes("sidebar-page-list")
  ) {
    failures.push(
      "bulk_import_first_paint_policy.applies_to_surfaces must include Daily, ZhiHui, and sidebar page list"
    );
  }
  assertEqual(
    bulkImportFirstPaintPolicy.calendar_window_strategy,
    "six-week-current-month-range",
    "bulk_import_first_paint_policy.calendar_window_strategy"
  );
  assertEqual(
    bulkImportFirstPaintPolicy.max_calendar_cells_first_paint,
    42,
    "bulk_import_first_paint_policy.max_calendar_cells_first_paint"
  );
  assertEqual(
    bulkImportFirstPaintPolicy.daily_calendar_uses_metadata_status,
    true,
    "bulk_import_first_paint_policy.daily_calendar_uses_metadata_status"
  );
  assertEqual(
    bulkImportFirstPaintPolicy.meeting_calendar_uses_metadata_status,
    true,
    "bulk_import_first_paint_policy.meeting_calendar_uses_metadata_status"
  );
  assertEqual(
    bulkImportFirstPaintPolicy.page_list_uses_metadata_status,
    true,
    "bulk_import_first_paint_policy.page_list_uses_metadata_status"
  );
  assertEqual(
    bulkImportFirstPaintPolicy.page_body_hydration_deferred,
    true,
    "bulk_import_first_paint_policy.page_body_hydration_deferred"
  );
  assertEqual(
    bulkImportFirstPaintPolicy.imported_content_backfill_batched,
    true,
    "bulk_import_first_paint_policy.imported_content_backfill_batched"
  );
  assertEqual(
    bulkImportFirstPaintPolicy.visible_shell_before_cloud_check,
    true,
    "bulk_import_first_paint_policy.visible_shell_before_cloud_check"
  );
  assertEqual(
    bulkImportFirstPaintPolicy.background_cloud_refresh_can_block_first_paint,
    false,
    "bulk_import_first_paint_policy.background_cloud_refresh_can_block_first_paint"
  );
  assertEqual(
    bulkImportFirstPaintPolicy.bulk_import_apply_requires_owner_gate,
    true,
    "bulk_import_first_paint_policy.bulk_import_apply_requires_owner_gate"
  );
  assertEqual(
    bulkImportFirstPaintPolicy.cache_rebuild_requires_clear_queues,
    true,
    "bulk_import_first_paint_policy.cache_rebuild_requires_clear_queues"
  );
  assertEqual(
    bulkImportFirstPaintPolicy.route_smoke_budget_ms,
    5000,
    "bulk_import_first_paint_policy.route_smoke_budget_ms"
  );
  if (!String(bulkImportFirstPaintPolicy.user_facing_copy ?? "").includes("首屏")) {
    failures.push(
      "bulk_import_first_paint_policy.user_facing_copy must explain first-paint protection"
    );
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
    experimental_routes: Array.isArray(result?.body?.experimental_routes)
      ? result.body.experimental_routes.length
      : 0,
    owner_gated_actions: Array.isArray(result?.body?.owner_gated_actions)
      ? result.body.owner_gated_actions.length
      : 0,
    monitored_sync_domains: Array.isArray(result?.body?.monitored_sync_domains)
      ? result.body.monitored_sync_domains.length
      : 0,
    sync_domain_coverage_complete:
      result?.body?.sync_domain_coverage?.coverage_complete ?? null,
    account_session_uncertainty_retryable:
      result?.body?.account_session_policy?.retryable_session_uncertainty ??
      null,
    account_session_uncertainty_keeps_cookie:
      result?.body?.account_session_policy?.keeps_session_cookie_on_uncertainty ??
      null,
    sync_failure_can_clear_session:
      result?.body?.account_session_policy?.sync_failure_can_clear_session ??
      null,
    local_input_can_continue:
      result?.body?.account_session_policy?.local_use_policy
        ?.local_input_can_continue ?? null,
    upload_block_does_not_block_writing:
      result?.body?.account_session_policy?.local_use_policy
        ?.upload_block_does_not_block_writing ?? null,
    hot_cache_source_of_truth:
      result?.body?.hot_cache_safety_policy?.source_of_truth ?? null,
    hot_cache_rebuild_requires_pending_clear:
      result?.body?.hot_cache_safety_policy
        ?.cache_rebuild_requires_pending_clear ?? null,
    hot_cache_can_be_only_source_of_truth:
      result?.body?.hot_cache_safety_policy
        ?.local_hot_cache_can_be_only_source_of_truth ?? null,
    development_lane_stable_routes_require_p0_gate:
      result?.body?.development_lane_policy?.stable_use_routes_require_p0_gate ??
      null,
    development_lane_experimental_staging_first:
      result?.body?.development_lane_policy
        ?.experimental_changes_go_to_staging_first ?? null,
    development_lane_owner_gate_required:
      result?.body?.development_lane_policy
        ?.high_risk_actions_require_owner_gate ?? null,
    bulk_import_first_paint_status:
      result?.body?.bulk_import_first_paint_policy?.policy_status ?? null,
    bulk_import_first_paint_calendar_cells:
      result?.body?.bulk_import_first_paint_policy
        ?.max_calendar_cells_first_paint ?? null,
    bulk_import_background_can_block_first_paint:
      result?.body?.bulk_import_first_paint_policy
        ?.background_cloud_refresh_can_block_first_paint ?? null,
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
