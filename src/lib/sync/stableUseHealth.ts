import { ACCOUNT_SESSION_UNCONFIRMED_REASON } from "@/lib/account/sessionResponses";
import {
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
  owner_gated_actions: string[];
  monitored_sync_domains: StableUseMonitoredSyncDomain[];
  sync_domain_coverage: StableUseSyncDomainCoverage;
  account_session_policy: StableUseAccountSessionPolicy;
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

export function buildStableUseHealthResponse(input: {
  checkedAt?: string;
} = {}): StableUseHealthResponse {
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
    stable_use_routes: getDevelopmentStableUseRoutes(),
    owner_gated_actions: getDevelopmentOwnerGatedActions(),
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
    required_before_shipping_changes: [
      "Run the focused verifier for the changed surface.",
      "Run npm run verify:route-smoke for stable route, sidebar, module, account, Daily, ZhiHui, or sync-center changes.",
      "Run npm run verify:stable-use-health before deployment or handoff.",
      "Run npm run lint and npm run build before push or preview review.",
      "git pull --rebase before git push; never force push.",
    ],
    boundary: STABLE_USE_HEALTH_BOUNDARY,
    privacy_note:
      "This health response is deployment metadata plus the static sync-domain taxonomy, static coverage report, and static account-session uncertainty policy only. It does not read browser storage, local sync queues, page body text, database row values, file names, file bytes, secrets, tokens, cookies, or cloud payload bodies; it does not send external network requests, write server data, upload workspace data, clear cache, enable sync, or enable AI.",
  };
}
