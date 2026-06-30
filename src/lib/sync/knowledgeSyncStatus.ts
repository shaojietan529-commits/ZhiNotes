export const KNOWLEDGE_SYNC_STATUS_EVENT = "zhinote:knowledge-sync-status";
export const KNOWLEDGE_SYNC_MANUAL_REVIEW_FAILURE_THRESHOLD = 3;

export type KnowledgeSyncTableName =
  | "wiki_links"
  | "page_comments"
  | "block_comments"
  | "page_versions";

export interface KnowledgeSyncEntryLike {
  tableName: string;
  rowId: string;
  status: string;
  attemptCount: number;
  timestamp: string;
  lastAttemptAt: string | null;
  nextRetryAt: string | null;
  lastError: string | null;
}

export interface KnowledgeCloudSyncStatus {
  enabled: boolean;
  totalPending: number;
  waiting: number;
  inFlight: number;
  failed: number;
  manualReviewCount: number;
  manualReviewFailureThreshold: number;
  wikiLinksPending: number;
  pageCommentsPending: number;
  blockCommentsPending: number;
  pageVersionsPending: number;
  oldestPendingAt: string | null;
  lastChangeAt: string | null;
  lastAttemptAt: string | null;
  lastFailureAt: string | null;
  lastFailureMessage: string | null;
  sampleRowIds: string[];
  manualReviewSampleRowIds: string[];
  boundary: {
    reads_sync_log_metadata: true;
    reads_wiki_link_targets: false;
    reads_comment_bodies: false;
    reads_block_comment_bodies: false;
    reads_version_snapshots: false;
    reads_page_body_text: false;
    reads_database_row_values: false;
    reads_file_bytes: false;
    uploads_workspace_data: false;
    mutates_sync_log: false;
  };
}

const KNOWLEDGE_SYNC_STATUS_BOUNDARY: KnowledgeCloudSyncStatus["boundary"] = {
  reads_sync_log_metadata: true,
  reads_wiki_link_targets: false,
  reads_comment_bodies: false,
  reads_block_comment_bodies: false,
  reads_version_snapshots: false,
  reads_page_body_text: false,
  reads_database_row_values: false,
  reads_file_bytes: false,
  uploads_workspace_data: false,
  mutates_sync_log: false,
};

export function isKnowledgeSyncTableName(
  value: string
): value is KnowledgeSyncTableName {
  return (
    value === "wiki_links" ||
    value === "page_comments" ||
    value === "block_comments" ||
    value === "page_versions"
  );
}

export function buildEmptyKnowledgeCloudSyncStatus(
  enabled = true
): KnowledgeCloudSyncStatus {
  return {
    enabled,
    totalPending: 0,
    waiting: 0,
    inFlight: 0,
    failed: 0,
    manualReviewCount: 0,
    manualReviewFailureThreshold:
      KNOWLEDGE_SYNC_MANUAL_REVIEW_FAILURE_THRESHOLD,
    wikiLinksPending: 0,
    pageCommentsPending: 0,
    blockCommentsPending: 0,
    pageVersionsPending: 0,
    oldestPendingAt: null,
    lastChangeAt: null,
    lastAttemptAt: null,
    lastFailureAt: null,
    lastFailureMessage: null,
    sampleRowIds: [],
    manualReviewSampleRowIds: [],
    boundary: KNOWLEDGE_SYNC_STATUS_BOUNDARY,
  };
}

export function summarizeKnowledgeCloudSyncStatus(
  entries: KnowledgeSyncEntryLike[],
  enabled = true
): KnowledgeCloudSyncStatus {
  const knowledgeEntries = entries.filter((entry) =>
    isKnowledgeSyncTableName(entry.tableName)
  );
  if (knowledgeEntries.length === 0) {
    return buildEmptyKnowledgeCloudSyncStatus(enabled);
  }

  let waiting = 0;
  let inFlight = 0;
  let failed = 0;
  let manualReviewCount = 0;
  let wikiLinksPending = 0;
  let pageCommentsPending = 0;
  let blockCommentsPending = 0;
  let pageVersionsPending = 0;
  let oldestPendingAt: string | null = null;
  let lastChangeAt: string | null = null;
  let lastAttemptAt: string | null = null;
  let lastFailureAt: string | null = null;
  let lastFailureMessage: string | null = null;
  const sampleRowIds: string[] = [];
  const manualReviewSampleRowIds: string[] = [];

  for (const entry of knowledgeEntries) {
    if (entry.tableName === "wiki_links") wikiLinksPending += 1;
    if (entry.tableName === "page_comments") pageCommentsPending += 1;
    if (entry.tableName === "block_comments") blockCommentsPending += 1;
    if (entry.tableName === "page_versions") pageVersionsPending += 1;

    if (entry.status === "failed") {
      failed += 1;
      if (
        entry.attemptCount >= KNOWLEDGE_SYNC_MANUAL_REVIEW_FAILURE_THRESHOLD
      ) {
        manualReviewCount += 1;
        if (manualReviewSampleRowIds.length < 4) {
          manualReviewSampleRowIds.push(entry.rowId);
        }
      }
      if (!lastFailureAt || entry.timestamp > lastFailureAt) {
        lastFailureAt = entry.timestamp;
        lastFailureMessage = entry.lastError;
      }
    } else if (entry.status === "in_flight") {
      inFlight += 1;
    } else {
      waiting += 1;
    }

    if (sampleRowIds.length < 6) sampleRowIds.push(entry.rowId);
    if (!oldestPendingAt || entry.timestamp < oldestPendingAt) {
      oldestPendingAt = entry.timestamp;
    }
    if (!lastChangeAt || entry.timestamp > lastChangeAt) {
      lastChangeAt = entry.timestamp;
    }
    if (
      entry.lastAttemptAt &&
      (!lastAttemptAt || entry.lastAttemptAt > lastAttemptAt)
    ) {
      lastAttemptAt = entry.lastAttemptAt;
    }
  }

  return {
    enabled,
    totalPending: knowledgeEntries.length,
    waiting,
    inFlight,
    failed,
    manualReviewCount,
    manualReviewFailureThreshold:
      KNOWLEDGE_SYNC_MANUAL_REVIEW_FAILURE_THRESHOLD,
    wikiLinksPending,
    pageCommentsPending,
    blockCommentsPending,
    pageVersionsPending,
    oldestPendingAt,
    lastChangeAt,
    lastAttemptAt,
    lastFailureAt,
    lastFailureMessage,
    sampleRowIds,
    manualReviewSampleRowIds,
    boundary: KNOWLEDGE_SYNC_STATUS_BOUNDARY,
  };
}

export function emitKnowledgeSyncStatusEvent(
  detail?: KnowledgeCloudSyncStatus
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<KnowledgeCloudSyncStatus | undefined>(
      KNOWLEDGE_SYNC_STATUS_EVENT,
      { detail }
    )
  );
}
