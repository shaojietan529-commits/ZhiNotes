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
  local_use_policy: {
    local_input_can_continue: true;
    sync_failure_can_clear_session: false;
    explicit_logout_required_to_clear_session: true;
    upload_block_does_not_block_writing: true;
  };
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

export interface StableUseTwoDaySyncPolicy {
  target_window_hours: 48;
  delivery_status: "private-alpha-sync-stabilization";
  can_claim_full_platform_sync_from_health_check: false;
  can_claim_two_device_sync_without_owner_smoke: false;
  health_check_can_claim_scoped_sync_ready: false;
  scoped_owner_evidence_supported: true;
  scoped_owner_evidence_source: "sync-center-two-device-smoke-owner-receipt";
  scoped_owner_evidence_route: "/modules/sync#two-device-sync-smoke-runbook";
  scoped_owner_evidence_requires_runbook_ready: true;
  cloud_master_requires_real_ack: true;
  local_hot_cache_can_mask_cloud_failure: false;
  minimum_stable_surfaces: Array<
    | "page"
    | "daily"
    | "zhihui"
    | "database"
    | "file-metadata"
    | "settings"
    | "knowledge"
    | "portfolio"
  >;
  must_stay_usable_while_developing: true;
  local_input_must_continue_during_cloud_uncertainty: true;
  pending_failed_manual_review_must_be_visible: true;
  cache_rebuild_requires_queue_clearance: true;
  owner_smoke_required_before_full_sync_claim: true;
  device_handoff_requires_successful_required_receipts: true;
  device_handoff_requires_required_receipts_pending_after_zero: true;
  failed_required_receipt_blocks_device_handoff: true;
  uncleared_required_receipt_blocks_device_handoff: true;
  stale_required_receipt_blocks_device_handoff: true;
  user_facing_copy: string;
}

export interface StableUseAccountSyncPreflightPolicy {
  policy_status: "metadata-only-scoped-core-preflight";
  preflight_route: "/api/account/sync-preflight";
  sync_center_route: "/modules/sync#account-sync-preflight";
  required_metadata_domain_count: 5;
  required_metadata_domains: Array<
    | "page-cloud-index"
    | "daily-cloud-metadata"
    | "meeting-cloud-metadata"
    | "database-cloud-index"
    | "portfolio-cloud-metadata"
  >;
  page_metadata_required: true;
  daily_metadata_required: true;
  zhihui_metadata_required: true;
  database_metadata_required: true;
  portfolio_metadata_required: true;
  ready_requires_all_required_domains_readable: true;
  stale_or_partial_receipt_blocks_device_handoff: true;
  metadata_only: true;
  can_read_page_body_text: false;
  can_read_database_row_values: false;
  can_upload_workspace_data: false;
  can_clear_local_cache: false;
  can_enable_sync: false;
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
  two_day_sync_policy: StableUseTwoDaySyncPolicy;
  account_sync_preflight_policy: StableUseAccountSyncPreflightPolicy;
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
  local_use_policy: {
    local_input_can_continue: true,
    sync_failure_can_clear_session: false,
    explicit_logout_required_to_clear_session: true,
    upload_block_does_not_block_writing: true,
  },
  user_facing_copy:
    "登录状态暂时无法确认时保持本地可用；同步或上传失败只能影响云端上传状态，不能阻止本地写作；只有明确退出登录才清除会话。",
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

const STABLE_USE_TWO_DAY_SYNC_POLICY: StableUseTwoDaySyncPolicy = {
  target_window_hours: 48,
  delivery_status: "private-alpha-sync-stabilization",
  can_claim_full_platform_sync_from_health_check: false,
  can_claim_two_device_sync_without_owner_smoke: false,
  health_check_can_claim_scoped_sync_ready: false,
  scoped_owner_evidence_supported: true,
  scoped_owner_evidence_source: "sync-center-two-device-smoke-owner-receipt",
  scoped_owner_evidence_route: "/modules/sync#two-device-sync-smoke-runbook",
  scoped_owner_evidence_requires_runbook_ready: true,
  cloud_master_requires_real_ack: true,
  local_hot_cache_can_mask_cloud_failure: false,
  minimum_stable_surfaces: [
    "page",
    "daily",
    "zhihui",
    "database",
    "file-metadata",
    "settings",
    "knowledge",
    "portfolio",
  ],
  must_stay_usable_while_developing: true,
  local_input_must_continue_during_cloud_uncertainty: true,
  pending_failed_manual_review_must_be_visible: true,
  cache_rebuild_requires_queue_clearance: true,
  owner_smoke_required_before_full_sync_claim: true,
  device_handoff_requires_successful_required_receipts: true,
  device_handoff_requires_required_receipts_pending_after_zero: true,
  failed_required_receipt_blocks_device_handoff: true,
  uncleared_required_receipt_blocks_device_handoff: true,
  stale_required_receipt_blocks_device_handoff: true,
  user_facing_copy:
    "48 小时目标是私有 beta 可稳定使用：写作先本地保存，页面/每日纪要/ZhiHui/数据库/文件元数据/设置/知识库/组合管理的同步状态必须可见；health check 只提供 scoped 验收入口，不能直接宣称 scoped 或完整同步 ready；页面/数据库必需回执必须 ok 且 pendingAfter=0，失败回执、pendingAfter 未清或过期回执都不能换设备；只有同步中心 runbook 显示 ready、真实两设备 smoke 跑通并且 pending、failed、manual review 清零后，才能声称全平台同步可用。",
};

const STABLE_USE_ACCOUNT_SYNC_PREFLIGHT_POLICY: StableUseAccountSyncPreflightPolicy =
  {
    policy_status: "metadata-only-scoped-core-preflight",
    preflight_route: "/api/account/sync-preflight",
    sync_center_route: "/modules/sync#account-sync-preflight",
    required_metadata_domain_count: 5,
    required_metadata_domains: [
      "page-cloud-index",
      "daily-cloud-metadata",
      "meeting-cloud-metadata",
      "database-cloud-index",
      "portfolio-cloud-metadata",
    ],
    page_metadata_required: true,
    daily_metadata_required: true,
    zhihui_metadata_required: true,
    database_metadata_required: true,
    portfolio_metadata_required: true,
    ready_requires_all_required_domains_readable: true,
    stale_or_partial_receipt_blocks_device_handoff: true,
    metadata_only: true,
    can_read_page_body_text: false,
    can_read_database_row_values: false,
    can_upload_workspace_data: false,
    can_clear_local_cache: false,
    can_enable_sync: false,
    user_facing_copy:
      "两设备同步验收前，必须先在同步中心跑 metadata-only 账号同步预检；Page、每日纪要、ZhiHui、数据库、组合管理五个核心域全部可读，且回执未过期，才允许继续做真实双设备 smoke。",
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
    two_day_sync_policy: STABLE_USE_TWO_DAY_SYNC_POLICY,
    account_sync_preflight_policy: STABLE_USE_ACCOUNT_SYNC_PREFLIGHT_POLICY,
    required_before_shipping_changes: [
      "Run the focused verifier for the changed surface.",
      "Run npm run verify:route-smoke for stable route, sidebar, module, account, Daily, ZhiHui, or sync-center changes.",
      "Run npm run verify:stable-use-health before deployment or handoff.",
      "Run npm run lint and npm run build before push or preview review.",
      "git pull --rebase before git push; never force push.",
    ],
    boundary: STABLE_USE_HEALTH_BOUNDARY,
    privacy_note:
      "This health response is deployment metadata plus the static sync-domain taxonomy, static coverage report, static account-session uncertainty policy, static hot-cache safety policy, static development-lane policy, static bulk-import first-paint policy, static two-day sync stabilization policy, and static account sync preflight policy only. It does not read browser storage, local sync queues, page body text, database row values, file names, file bytes, secrets, tokens, cookies, or cloud payload bodies; it does not send external network requests, write server data, upload workspace data, clear cache, enable sync, or enable AI.",
  };
}
