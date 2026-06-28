import type { PendingCloudDatabaseSyncStatus } from "@/lib/database/accountDatabaseSync";
import type { PendingCloudPageSyncStatus } from "@/lib/pages/accountPageSync";

export type SyncManualReviewPacketStatus =
  | "clear"
  | "pending"
  | "retry-watch"
  | "review-required"
  | "sync-disabled";

export interface SyncManualReviewPacketInput {
  pageStatus: PendingCloudPageSyncStatus;
  databaseStatus: PendingCloudDatabaseSyncStatus;
  totalSyncPending: number;
  generatedAt?: string;
}

export interface SyncManualReviewDomain {
  domain: "pages" | "databases";
  label: string;
  status: SyncManualReviewPacketStatus;
  enabled: boolean;
  pending: number;
  queued: number;
  sync_log_pending: number;
  failed: number;
  failure_count_total: number;
  max_failure_count: number;
  manual_review_count: number;
  manual_review_failure_threshold: number;
  pending_sample_ids_or_keys: string[];
  failed_sample_ids_or_keys: string[];
  manual_review_sample_ids_or_keys: string[];
  oldest_pending_queued_at: string | null;
  last_attempt_at: string | null;
  last_failure_at: string | null;
  last_failure_message: string | null;
  next_action: string;
}

export interface SyncManualReviewPacket {
  format: "zhinote-sync-manual-review-packet";
  format_version: 1;
  packet_status: "metadata-only-local-review";
  packet_id: string;
  generated_at: string;
  status: SyncManualReviewPacketStatus;
  privacy_note: string;
  boundary: {
    local_packet_only: true;
    reads_queue_counts: true;
    reads_page_ids: true;
    reads_database_keys: true;
    reads_failure_counts: true;
    reads_failure_messages: true;
    reads_page_body_text: false;
    reads_page_yjs: false;
    reads_database_row_values: false;
    reads_comment_bodies: false;
    reads_file_names: false;
    reads_file_bytes: false;
    reads_secret_values: false;
    sends_network_requests: false;
    writes_server_data: false;
    uploads_workspace_data: false;
    clears_local_cache: false;
    mutates_local_cache_records: false;
    enables_sync: false;
    enables_ai: false;
    includes_only_counts_ids_keys_timestamps_and_error_messages: true;
  };
  summary: {
    manual_review_required: boolean;
    page_manual_review_count: number;
    database_manual_review_count: number;
    total_manual_review_count: number;
    page_failed_count: number;
    database_failed_count: number;
    total_failed_count: number;
    page_max_failure_count: number;
    database_max_failure_count: number;
    total_sync_log_pending: number;
    can_retry_before_owner_review: boolean;
    cache_rebuild_should_wait: boolean;
  };
  domains: SyncManualReviewDomain[];
  owner_actions: string[];
  excluded_payload_classes: string[];
}

export function buildSyncManualReviewPacket(
  input: SyncManualReviewPacketInput
): SyncManualReviewPacket {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const pageDomain = buildPageDomain(input.pageStatus);
  const databaseDomain = buildDatabaseDomain(input.databaseStatus);
  const totalManualReviewCount =
    input.pageStatus.manualReviewCount + input.databaseStatus.manualReviewCount;
  const totalFailedCount = input.pageStatus.failed + input.databaseStatus.failed;
  const status = getPacketStatus({
    pageDomain,
    databaseDomain,
    totalManualReviewCount,
    totalFailedCount,
  });
  const hash = stableHash({
    generated_at: generatedAt,
    status,
    page: pageDomain,
    database: databaseDomain,
    total_sync_log_pending: input.totalSyncPending,
  });

  return {
    format: "zhinote-sync-manual-review-packet",
    format_version: 1,
    packet_status: "metadata-only-local-review",
    packet_id: `sync-manual-review:${hash}`,
    generated_at: generatedAt,
    status,
    privacy_note:
      "Generated locally from sync queue metadata only. This packet contains counts, page ids, database/field/row/view keys, timestamps, failure counts, and recent failure messages. It does not read or export page body text, page Yjs data, database row values, comments, file names, file bytes, secrets, holdings, trading plans, prompts, tokens, cookies, or credentials; it does not send network requests, upload workspace data, clear local cache, or enable sync/AI.",
    boundary: {
      local_packet_only: true,
      reads_queue_counts: true,
      reads_page_ids: true,
      reads_database_keys: true,
      reads_failure_counts: true,
      reads_failure_messages: true,
      reads_page_body_text: false,
      reads_page_yjs: false,
      reads_database_row_values: false,
      reads_comment_bodies: false,
      reads_file_names: false,
      reads_file_bytes: false,
      reads_secret_values: false,
      sends_network_requests: false,
      writes_server_data: false,
      uploads_workspace_data: false,
      clears_local_cache: false,
      mutates_local_cache_records: false,
      enables_sync: false,
      enables_ai: false,
      includes_only_counts_ids_keys_timestamps_and_error_messages: true,
    },
    summary: {
      manual_review_required: totalManualReviewCount > 0,
      page_manual_review_count: input.pageStatus.manualReviewCount,
      database_manual_review_count: input.databaseStatus.manualReviewCount,
      total_manual_review_count: totalManualReviewCount,
      page_failed_count: input.pageStatus.failed,
      database_failed_count: input.databaseStatus.failed,
      total_failed_count: totalFailedCount,
      page_max_failure_count: input.pageStatus.maxFailureCount,
      database_max_failure_count: input.databaseStatus.maxFailureCount,
      total_sync_log_pending: input.totalSyncPending,
      can_retry_before_owner_review: totalManualReviewCount === 0,
      cache_rebuild_should_wait:
        totalManualReviewCount > 0 ||
        totalFailedCount > 0 ||
        input.totalSyncPending > 0,
    },
    domains: [pageDomain, databaseDomain],
    owner_actions: buildOwnerActions({
      totalManualReviewCount,
      totalFailedCount,
      totalSyncPending: input.totalSyncPending,
    }),
    excluded_payload_classes: [
      "page_body_text",
      "page_yjs_content",
      "database_row_values",
      "comment_bodies",
      "file_names",
      "file_bytes",
      "backup_payloads",
      "holdings",
      "trading_plans",
      "client_information",
      "ai_prompt_text",
      "model_raw_output",
      "tokens",
      "cookies",
      "secret_values",
      "signed_urls",
      "cloud_connection_strings",
    ],
  };
}

function buildPageDomain(
  status: PendingCloudPageSyncStatus
): SyncManualReviewDomain {
  const pending = status.pending + status.queued;
  const domainStatus = getDomainStatus({
    enabled: status.enabled,
    pending,
    failed: status.failed,
    manualReviewCount: status.manualReviewCount,
  });
  return {
    domain: "pages",
    label: "页面同步",
    status: domainStatus,
    enabled: status.enabled,
    pending: status.pending,
    queued: status.queued,
    sync_log_pending: 0,
    failed: status.failed,
    failure_count_total: status.failureCountTotal,
    max_failure_count: status.maxFailureCount,
    manual_review_count: status.manualReviewCount,
    manual_review_failure_threshold: status.manualReviewFailureThreshold,
    pending_sample_ids_or_keys: status.pendingSampleIds,
    failed_sample_ids_or_keys: status.failedSampleIds,
    manual_review_sample_ids_or_keys: status.manualReviewSampleIds,
    oldest_pending_queued_at: status.oldestPendingQueuedAt,
    last_attempt_at: status.lastAttemptAt,
    last_failure_at: status.lastFailureAt,
    last_failure_message: status.lastFailureMessage,
    next_action: getDomainNextAction(domainStatus, "page id"),
  };
}

function buildDatabaseDomain(
  status: PendingCloudDatabaseSyncStatus
): SyncManualReviewDomain {
  const pending = status.pending + status.queued + status.syncLogPending;
  const domainStatus = getDomainStatus({
    enabled: status.enabled,
    pending,
    failed: status.failed,
    manualReviewCount: status.manualReviewCount,
  });
  return {
    domain: "databases",
    label: "数据库同步",
    status: domainStatus,
    enabled: status.enabled,
    pending: status.pending,
    queued: status.queued,
    sync_log_pending: status.syncLogPending,
    failed: status.failed,
    failure_count_total: status.failureCountTotal,
    max_failure_count: status.maxFailureCount,
    manual_review_count: status.manualReviewCount,
    manual_review_failure_threshold: status.manualReviewFailureThreshold,
    pending_sample_ids_or_keys: status.pendingSampleKeys,
    failed_sample_ids_or_keys: status.failedSampleKeys,
    manual_review_sample_ids_or_keys: status.manualReviewSampleKeys,
    oldest_pending_queued_at: status.oldestPendingQueuedAt,
    last_attempt_at: status.lastAttemptAt,
    last_failure_at: status.lastFailureAt,
    last_failure_message: status.lastFailureMessage,
    next_action: getDomainNextAction(
      domainStatus,
      "database/field/row/view key"
    ),
  };
}

function getDomainStatus(input: {
  enabled: boolean;
  pending: number;
  failed: number;
  manualReviewCount: number;
}): SyncManualReviewPacketStatus {
  if (!input.enabled) return "sync-disabled";
  if (input.manualReviewCount > 0) return "review-required";
  if (input.failed > 0) return "retry-watch";
  if (input.pending > 0) return "pending";
  return "clear";
}

function getPacketStatus(input: {
  pageDomain: SyncManualReviewDomain;
  databaseDomain: SyncManualReviewDomain;
  totalManualReviewCount: number;
  totalFailedCount: number;
}): SyncManualReviewPacketStatus {
  if (input.totalManualReviewCount > 0) return "review-required";
  if (input.totalFailedCount > 0) return "retry-watch";
  if (
    input.pageDomain.status === "sync-disabled" ||
    input.databaseDomain.status === "sync-disabled"
  ) {
    return "sync-disabled";
  }
  if (
    input.pageDomain.status === "pending" ||
    input.databaseDomain.status === "pending"
  ) {
    return "pending";
  }
  return "clear";
}

function getDomainNextAction(
  status: SyncManualReviewPacketStatus,
  sampleLabel: string
) {
  if (status === "review-required") {
    return `Stop blind retries, inspect the metadata-only ${sampleLabel} sample and recent failure message, then decide whether to fix auth/network/config before retrying.`;
  }
  if (status === "retry-watch") {
    return "Retry once from the Sync UI and export a fresh packet if the failure repeats.";
  }
  if (status === "pending") {
    return "Let the queue drain or trigger manual retry before cache rebuild or device handoff.";
  }
  if (status === "sync-disabled") {
    return "Enable sync from the Account page only after owner confirmation.";
  }
  return "No action required for this domain.";
}

function buildOwnerActions(input: {
  totalManualReviewCount: number;
  totalFailedCount: number;
  totalSyncPending: number;
}) {
  if (input.totalManualReviewCount > 0) {
    return [
      "Review manual_review_sample_ids_or_keys and last_failure_message.",
      "Do not clear local cache or rebuild from cloud until repeated failures are understood.",
      "Retry only after auth, network, route, or schema cause is identified.",
    ];
  }
  if (input.totalFailedCount > 0) {
    return [
      "Run one manual retry from the Sync UI.",
      "If failure_count_total increases, export a fresh manual review packet.",
    ];
  }
  if (input.totalSyncPending > 0) {
    return [
      "Let pending sync_log rows drain before cache rebuild or cross-device handoff.",
    ];
  }
  return ["No manual sync review is required right now."];
}

function stableHash(value: unknown) {
  const source = stableStringify(value);
  let hash = 5381;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 33) ^ source.charCodeAt(index);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
