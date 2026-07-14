import {
  getDevelopmentOwnerGatedActions,
  getDevelopmentStableUseRoutes,
} from "@/lib/sync/developmentStabilityPlan";

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

export function buildStableUseHealthResponse(input: {
  checkedAt?: string;
} = {}): StableUseHealthResponse {
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
    required_before_shipping_changes: [
      "Run the focused verifier for the changed surface.",
      "Run npm run verify:route-smoke for stable route, sidebar, module, account, Daily, ZhiHui, or sync-center changes.",
      "Run npm run verify:stable-use-health before deployment or handoff.",
      "Run npm run lint and npm run build before push or preview review.",
      "git pull --rebase before git push; never force push.",
    ],
    boundary: STABLE_USE_HEALTH_BOUNDARY,
    privacy_note:
      "This health response is deployment metadata only. It does not read browser storage, local sync queues, page body text, database row values, file names, file bytes, secrets, tokens, cookies, or cloud payload bodies; it does not send external network requests, write server data, upload workspace data, clear cache, enable sync, or enable AI.",
  };
}
