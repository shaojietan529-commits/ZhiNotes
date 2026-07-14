import type { AccountLocalUseReadiness } from "@/lib/sync/accountLocalUseReadiness";
import type { DevelopmentStabilityPlan } from "@/lib/sync/developmentStabilityPlan";

export interface DevelopmentStabilityHandoffReceipt {
  format: "zhinote-development-stability-handoff-receipt";
  format_version: 1;
  receipt_status: "metadata-only-stable-use-handoff";
  generated_at: string;
  user_can_continue_now: true;
  active_development_can_continue: true;
  production_changes_should_be_batched: true;
  experimental_changes_go_to_staging_first: true;
  local_input_remains_available: true;
  upload_blocks_do_not_block_local_writing: true;
  cloud_sync_can_be_enabled_now: false;
  web_beta_can_launch_now: false;
  cache_rebuild_can_run_now: boolean;
  stable_use_verdict:
    | "continue-stable-use"
    | "continue-local-use-drain-queues-first"
    | "continue-local-use-cloud-uncertain";
  summary: {
    local_use_status: AccountLocalUseReadiness["status"];
    local_use_label: string;
    stable_use_entrypoints: number;
    stable_use_routes: string[];
    guarded_entrypoints: number;
    experimental_surfaces: number;
    high_risk_actions_gated: number;
    pending_total: number;
    failed_total: number;
    manual_review_total: number;
    cache_rebuild_blocked: boolean;
    owner_gated_actions: string[];
  };
  required_before_next_development_push: string[];
  blocked_without_owner_confirmation: string[];
  next_action: string;
  privacy_note: string;
  boundary: {
    metadata_only: true;
    reads_sync_queue_counts: true;
    reads_route_catalog: true;
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_file_names: false;
    reads_file_bytes: false;
    reads_secret_values: false;
    reads_tokens_or_cookies: false;
    sends_network_requests: false;
    writes_workspace_data: false;
    uploads_workspace_data: false;
    clears_local_cache: false;
    enables_sync: false;
    enables_ai: false;
  };
}

const STABLE_HANDOFF_BOUNDARY: DevelopmentStabilityHandoffReceipt["boundary"] = {
  metadata_only: true,
  reads_sync_queue_counts: true,
  reads_route_catalog: true,
  reads_page_body_text: false,
  reads_database_row_values: false,
  reads_file_names: false,
  reads_file_bytes: false,
  reads_secret_values: false,
  reads_tokens_or_cookies: false,
  sends_network_requests: false,
  writes_workspace_data: false,
  uploads_workspace_data: false,
  clears_local_cache: false,
  enables_sync: false,
  enables_ai: false,
};

export function buildDevelopmentStabilityHandoffReceipt(input: {
  plan: DevelopmentStabilityPlan;
  localUseReadiness: AccountLocalUseReadiness;
  generatedAt?: string;
}): DevelopmentStabilityHandoffReceipt {
  const { plan, localUseReadiness } = input;
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const hasQueues =
    plan.summary.pending_total > 0 ||
    plan.summary.failed_total > 0 ||
    plan.summary.manual_review_total > 0;
  const stableUseVerdict = hasQueues
    ? "continue-local-use-drain-queues-first"
    : localUseReadiness.status === "cloud-uncertain" ||
        localUseReadiness.status === "signed-out"
      ? "continue-local-use-cloud-uncertain"
      : "continue-stable-use";

  return {
    format: "zhinote-development-stability-handoff-receipt",
    format_version: 1,
    receipt_status: "metadata-only-stable-use-handoff",
    generated_at: generatedAt,
    user_can_continue_now: true,
    active_development_can_continue: true,
    production_changes_should_be_batched: true,
    experimental_changes_go_to_staging_first: true,
    local_input_remains_available: true,
    upload_blocks_do_not_block_local_writing: true,
    cloud_sync_can_be_enabled_now: false,
    web_beta_can_launch_now: false,
    cache_rebuild_can_run_now: !plan.summary.cache_rebuild_blocked,
    stable_use_verdict: stableUseVerdict,
    summary: {
      local_use_status: localUseReadiness.status,
      local_use_label: localUseReadiness.label,
      stable_use_entrypoints: plan.summary.stable_use_entrypoints,
      stable_use_routes: plan.stable_use_operating_mode.safe_to_use_routes,
      guarded_entrypoints: plan.summary.guarded_entrypoints,
      experimental_surfaces: plan.summary.experimental_surfaces,
      high_risk_actions_gated: plan.summary.high_risk_actions_gated,
      pending_total: plan.summary.pending_total,
      failed_total: plan.summary.failed_total,
      manual_review_total: plan.summary.manual_review_total,
      cache_rebuild_blocked: plan.summary.cache_rebuild_blocked,
      owner_gated_actions:
        plan.stable_use_operating_mode.blocked_without_owner_gate,
    },
    required_before_next_development_push: [
      "Run the focused verifier for the changed surface.",
      "Run npm run verify:route-smoke when stable-use routes, sidebar, Daily, ZhiHui, account, sync, or module shells changed.",
      "Run npm run lint and npm run build before pushing UI or runtime changes.",
      "Commit product changes separately from verifier-only changes when practical.",
      "git pull --rebase before git push; never force push the user's branch.",
    ],
    blocked_without_owner_confirmation: [
      ...plan.high_risk_actions_gated,
      "production_deployment_cutover",
      "cloud_sync_enablement",
      "bulk_import_apply",
      "cache_rebuild_from_cloud",
    ],
    next_action: buildHandoffNextAction(plan, localUseReadiness),
    privacy_note:
      "Generated locally from the development stability plan and sync queue counts already shown in the Sync Center. It does not read page body text, database row values, file names, file bytes, secrets, tokens, cookies, or cloud payload bodies; it does not send network requests, upload workspace data, clear cache, enable sync, enable AI, or write workspace data.",
    boundary: STABLE_HANDOFF_BOUNDARY,
  };
}

function buildHandoffNextAction(
  plan: DevelopmentStabilityPlan,
  readiness: AccountLocalUseReadiness
): string {
  if (plan.summary.failed_total > 0 || plan.summary.manual_review_total > 0) {
    return "继续使用稳定入口；先处理 failed / manual review，再做缓存重建、云端主库切换或线上发布。";
  }
  if (plan.summary.pending_total > 0) {
    return "继续本地优先输入；等待 pending 队列上传 ACK 后，再考虑缓存重建或云端交接。";
  }
  if (readiness.status === "cloud-uncertain" || readiness.status === "signed-out") {
    return "继续本地使用；账号或云端确认恢复前，不做云端主库切换、缓存重建或生产发布。";
  }
  return "可以继续稳定使用和小步开发；实验功能仍先在本地或 staging 验证，线上变更成批进入。";
}
