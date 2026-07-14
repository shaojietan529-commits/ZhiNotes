import { ACCOUNT_SESSION_UNCONFIRMED_REASON } from "@/lib/account/sessionResponses";
import {
  getDevelopmentExperimentalRoutes,
  getDevelopmentOwnerGatedActions,
  getDevelopmentStableUseRoutes,
} from "@/lib/sync/developmentStabilityPlan";
import {
  buildPendingDomainCoverageReport,
  getPendingDomainCatalog,
  type PendingDomainRow,
} from "@/lib/sync/syncPendingDomainRegistry";

export interface StableUseMonitoredSyncDomain {
  id: string;
  label: string;
  detail: string;
  table_names: string[];
  table_prefixes: string[];
}

export interface StableUseSyncDomainCoverage {
  coverage_source: "static-pending-domain-catalog";
  registered_domain_count: number;
  visible_registered_domain_count: number;
  active_registered_domain_count: number;
  unmatched_table_domain_count: number;
  missing_registered_domain_ids: string[];
  coverage_complete: boolean;
}

export interface StableUseAccountSessionPolicy {
  session_uncertainty_reason: typeof ACCOUNT_SESSION_UNCONFIRMED_REASON;
  retryable_session_uncertainty: true;
  keeps_session_cookie_on_uncertainty: true;
  explicit_logout_required_to_clear_session: true;
  sync_failure_can_clear_session: false;
  local_input_can_continue_during_uncertainty: true;
  user_facing_copy: string;
}

export interface StableUseHotCacheSafetyPolicy {
  architecture_target: "cloud-master-local-hot-cache";
  local_hot_cache_role: "rebuildable-speed-layer";
  source_of_truth: "cloud-master";
  first_paint_strategy: "local-metadata-first-then-background-cloud-refresh";
  cache_rebuild_requires_pending_clear: true;
  cache_rebuild_requires_failed_clear: true;
  cache_rebuild_requires_manual_review_clear: true;
  cache_rebuild_requires_owner_confirmation: true;
  pending_rows_never_evicted: true;
  local_hot_cache_can_be_only_source_of_truth: false;
  stores_private_payload_by_default: false;
  warmup_can_upload_data: false;
  user_facing_copy: string;
}

export interface StableUseDevelopmentLanePolicy {
  development_channel: "private-alpha-stable-use";
  stable_use_lane: "route-smoke-protected";
  experimental_lane: "owner-gated-or-staging-first";
  production_interruptions_should_be_batched: true;
  experimental_changes_go_to_staging_first: true;
  stable_use_routes_require_p0_gate: true;
  high_risk_actions_require_owner_gate: true;
  web_beta_launch_requires_owner_gate: true;
  real_cloud_sync_requires_owner_gate: true;
  ai_execution_requires_owner_gate: true;
  bulk_import_apply_requires_owner_gate: true;
  restore_writeback_requires_owner_gate: true;
  stable_use_route_count: number;
  experimental_route_count: number;
  owner_gated_action_count: number;
  user_facing_copy: string;
}

export interface StableUseBulkImportFirstPaintPolicy {
  policy_status: "metadata-first-visible-shell";
  applies_to_surfaces: Array<
    "/daily" | "/schedule" | "sidebar-page-list" | "/page/[pageId]"
  >;
  calendar_window_strategy: "six-week-current-month-range";
  max_calendar_cells_first_paint: 42;
  daily_calendar_uses_metadata_status: true;
  meeting_calendar_uses_metadata_status: true;
  page_list_uses_metadata_status: true;
  page_body_hydration_deferred: true;
  imported_content_backfill_batched: true;
  visible_shell_before_cloud_check: true;
  background_cloud_refresh_can_block_first_paint: false;
  bulk_import_apply_requires_owner_gate: true;
  cache_rebuild_requires_clear_queues: true;
  route_smoke_budget_ms: 5000;
  user_facing_copy: string;
}

export interface StableUseHealthResponse {
  format: "zhinote-stable-use-health";
  format_version: 1;
  health_status: "stable-use-active";
  checked_at: string;
  user_can_continue_now: true;
  active_development_can_continue: true;
  local_input_policy: "local-first-then-pending-queue";
  sync_failure_policy: "retry-visible-not-sign-out";
  cloud_sync_can_be_enabled_by_health_check: false;
  web_beta_launch_approved_by_health_check: false;
  production_cutover_approved_by_health_check: false;
  cache_rebuild_approved_by_health_check: false;
  stable_use_routes: string[];
  experimental_routes: string[];
  owner_gated_actions: string[];
  monitored_sync_domains: StableUseMonitoredSyncDomain[];
  sync_domain_coverage: StableUseSyncDomainCoverage;
  account_session_policy: StableUseAccountSessionPolicy;
  hot_cache_safety_policy: StableUseHotCacheSafetyPolicy;
  development_lane_policy: StableUseDevelopmentLanePolicy;
  bulk_import_first_paint_policy: StableUseBulkImportFirstPaintPolicy;
  required_before_shipping_changes: string[];
  boundary: {
    deployment_health_metadata_only: true;
    reads_browser_storage: false;
    reads_sync_queue_counts: false;
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_file_names: false;
    reads_file_bytes: false;
    reads_secret_values: false;
    reads_tokens_or_cookies: false;
    sends_external_network_requests: false;
    writes_server_data: false;
    writes_workspace_data: false;
    uploads_workspace_data: false;
    clears_local_cache: false;
    enables_sync: false;
    enables_ai: false;
  };
  privacy_note: string;
}

const STABLE_USE_HEALTH_BOUNDARY: StableUseHealthResponse["boundary"] = {
  deployment_health_metadata_only: true,
  reads_browser_storage: false,
  reads_sync_queue_counts: false,
  reads_page_body_text: false,
  reads_database_row_values: false,
  reads_file_names: false,
  reads_file_bytes: false,
  reads_secret_values: false,
  reads_tokens_or_cookies: false,
  sends_external_network_requests: false,
  writes_server_data: false,
  writes_workspace_data: false,
  uploads_workspace_data: false,
  clears_local_cache: false,
  enables_sync: false,
  enables_ai: false,
};

const STABLE_USE_ACCOUNT_SESSION_POLICY: StableUseAccountSessionPolicy = {
  session_uncertainty_reason: ACCOUNT_SESSION_UNCONFIRMED_REASON,
  retryable_session_uncertainty: true,
  keeps_session_cookie_on_uncertainty: true,
  explicit_logout_required_to_clear_session: true,
  sync_failure_can_clear_session: false,
  local_input_can_continue_during_uncertainty: true,
  user_facing_copy:
    "登录状态暂时无法确认时保持本地可用；只有明确退出登录才清除会话。",
};

const STABLE_USE_HOT_CACHE_SAFETY_POLICY: StableUseHotCacheSafetyPolicy = {
  architecture_target: "cloud-master-local-hot-cache",
  local_hot_cache_role: "rebuildable-speed-layer",
  source_of_truth: "cloud-master",
  first_paint_strategy: "local-metadata-first-then-background-cloud-refresh",
  cache_rebuild_requires_pending_clear: true,
  cache_rebuild_requires_failed_clear: true,
  cache_rebuild_requires_manual_review_clear: true,
  cache_rebuild_requires_owner_confirmation: true,
  pending_rows_never_evicted: true,
  local_hot_cache_can_be_only_source_of_truth: false,
  stores_private_payload_by_default: false,
  warmup_can_upload_data: false,
  user_facing_copy:
    "本地热缓存只负责加速首屏；pending、failed 或 manual review 清零并确认前，不能重建或清理缓存。",
};

const STABLE_USE_BULK_IMPORT_FIRST_PAINT_POLICY: StableUseBulkImportFirstPaintPolicy =
  {
    policy_status: "metadata-first-visible-shell",
    applies_to_surfaces: [
      "/daily",
      "/schedule",
      "sidebar-page-list",
      "/page/[pageId]",
    ],
    calendar_window_strategy: "six-week-current-month-range",
    max_calendar_cells_first_paint: 42,
    daily_calendar_uses_metadata_status: true,
    meeting_calendar_uses_metadata_status: true,
    page_list_uses_metadata_status: true,
    page_body_hydration_deferred: true,
    imported_content_backfill_batched: true,
    visible_shell_before_cloud_check: true,
    background_cloud_refresh_can_block_first_paint: false,
    bulk_import_apply_requires_owner_gate: true,
    cache_rebuild_requires_clear_queues: true,
    route_smoke_budget_ms: 5000,
    user_facing_copy:
      "大批量导入后，日历、侧边栏和页面列表必须先显示 metadata 壳；正文补齐、云端校正和索引回填只能后台分批进行，不能挡住首屏。",
  };

function buildStableUseDevelopmentLanePolicy(input: {
  stableUseRoutes: string[];
  experimentalRoutes: string[];
  ownerGatedActions: string[];
}): StableUseDevelopmentLanePolicy {
  return {
    development_channel: "private-alpha-stable-use",
    stable_use_lane: "route-smoke-protected",
    experimental_lane: "owner-gated-or-staging-first",
    production_interruptions_should_be_batched: true,
    experimental_changes_go_to_staging_first: true,
    stable_use_routes_require_p0_gate: true,
    high_risk_actions_require_owner_gate: true,
    web_beta_launch_requires_owner_gate: true,
    real_cloud_sync_requires_owner_gate: true,
    ai_execution_requires_owner_gate: true,
    bulk_import_apply_requires_owner_gate: true,
    restore_writeback_requires_owner_gate: true,
    stable_use_route_count: input.stableUseRoutes.length,
    experimental_route_count: input.experimentalRoutes.length,
    owner_gated_action_count: input.ownerGatedActions.length,
    user_facing_copy:
      "稳定使用区可以继续写作和查看资料；实验功能必须先本地或 staging 验证，进入线上前需要 owner gate。",
  };
}

export function buildStableUseHealthResponse(input: {
  checkedAt?: string;
} = {}): StableUseHealthResponse {
  const stableUseRoutes = getDevelopmentStableUseRoutes();
  const experimentalRoutes = getDevelopmentExperimentalRoutes();
  const ownerGatedActions = getDevelopmentOwnerGatedActions();
  const monitoredSyncDomains = getPendingDomainCatalog();
  const syncDomainCoverage = buildPendingDomainCoverageReport(
    monitoredSyncDomains.map(
      (domain): PendingDomainRow => ({
        id: domain.id,
        label: domain.label,
        detail: domain.detail,
        nextAction: "健康检查只验证静态同步域覆盖，不读取本地队列。",
        pending: 0,
        failed: 0,
        inFlight: 0,
        manualReview: 0,
        total: 0,
        lastChangeAt: null,
        tableNames: domain.tableNames,
      })
    )
  );

  return {
    format: "zhinote-stable-use-health",
    format_version: 1,
    health_status: "stable-use-active",
    checked_at: input.checkedAt ?? new Date().toISOString(),
    user_can_continue_now: true,
    active_development_can_continue: true,
    local_input_policy: "local-first-then-pending-queue",
    sync_failure_policy: "retry-visible-not-sign-out",
    cloud_sync_can_be_enabled_by_health_check: false,
    web_beta_launch_approved_by_health_check: false,
    production_cutover_approved_by_health_check: false,
    cache_rebuild_approved_by_health_check: false,
    stable_use_routes: stableUseRoutes,
    experimental_routes: experimentalRoutes,
    owner_gated_actions: ownerGatedActions,
    monitored_sync_domains: monitoredSyncDomains.map((domain) => ({
      id: domain.id,
      label: domain.label,
      detail: domain.detail,
      table_names: domain.tableNames,
      table_prefixes: domain.tablePrefixes,
    })),
    sync_domain_coverage: {
      coverage_source: "static-pending-domain-catalog",
      registered_domain_count: syncDomainCoverage.registeredDomainCount,
      visible_registered_domain_count:
        syncDomainCoverage.visibleRegisteredDomainCount,
      active_registered_domain_count:
        syncDomainCoverage.activeRegisteredDomainCount,
      unmatched_table_domain_count: syncDomainCoverage.unmatchedTableDomainCount,
      missing_registered_domain_ids:
        syncDomainCoverage.missingRegisteredDomainIds,
      coverage_complete: syncDomainCoverage.coverageComplete,
    },
    account_session_policy: STABLE_USE_ACCOUNT_SESSION_POLICY,
    hot_cache_safety_policy: STABLE_USE_HOT_CACHE_SAFETY_POLICY,
    development_lane_policy: buildStableUseDevelopmentLanePolicy({
      stableUseRoutes,
      experimentalRoutes,
      ownerGatedActions,
    }),
    bulk_import_first_paint_policy:
      STABLE_USE_BULK_IMPORT_FIRST_PAINT_POLICY,
    required_before_shipping_changes: [
      "Run the focused verifier for the changed surface.",
      "Run npm run verify:route-smoke for stable route, sidebar, module, account, Daily, ZhiHui, or sync-center changes.",
      "Run npm run verify:stable-use-health before deployment or handoff.",
      "Run npm run lint and npm run build before push or preview review.",
      "git pull --rebase before git push; never force push.",
    ],
    boundary: STABLE_USE_HEALTH_BOUNDARY,
    privacy_note:
      "This health response is deployment metadata plus the static sync-domain taxonomy, static coverage report, static account-session uncertainty policy, static hot-cache safety policy, static development-lane policy, and static bulk-import first-paint policy only. It does not read browser storage, local sync queues, page body text, database row values, file names, file bytes, secrets, tokens, cookies, or cloud payload bodies; it does not send external network requests, write server data, upload workspace data, clear cache, enable sync, or enable AI.",
  };
}
