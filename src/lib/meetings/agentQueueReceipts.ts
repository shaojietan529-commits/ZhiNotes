export const MEETING_AGENT_QUEUE_RECEIPT_STALE_AFTER_MS = 30_000;

export const MEETING_AGENT_QUEUE_POLL_INTERVAL_MS = {
  active: 4_000,
  idle: 12_000,
  retry: 30_000,
  manual_review: null,
  none: null,
} as const;

export type MeetingAgentQueuePollMode =
  keyof typeof MEETING_AGENT_QUEUE_POLL_INTERVAL_MS;

export type MeetingAgentQueueSyncCenterStatus =
  | "idle"
  | "agent_jobs_pending"
  | "attention_recommended"
  | "manual_review_required"
  | "retryable_unknown"
  | "retry_later"
  | "failed_not_completed"
  | "not_started";

export type MeetingAgentQueueCacheRefreshStatus =
  | "safe"
  | "blocked_pending_agent_jobs"
  | "blocked_attention_required"
  | "blocked_manual_review"
  | "blocked_retryable_unknown"
  | "blocked_retry_later"
  | "blocked_failed_not_completed"
  | "blocked_not_started";

export function buildMeetingAgentQueueReceiptTiming({
  now = new Date(),
  pollMode,
}: {
  now?: Date;
  pollMode: MeetingAgentQueuePollMode;
}) {
  const recommendedNextPollMs = MEETING_AGENT_QUEUE_POLL_INTERVAL_MS[pollMode];
  return {
    receiptGeneratedAt: now.toISOString(),
    receiptStaleAfter: new Date(
      now.getTime() + MEETING_AGENT_QUEUE_RECEIPT_STALE_AFTER_MS
    ).toISOString(),
    receiptFreshnessWindowMs: MEETING_AGENT_QUEUE_RECEIPT_STALE_AFTER_MS,
    pollMode,
    recommendedNextPollMs,
    recommendedNextPollAt:
      recommendedNextPollMs === null
        ? null
        : new Date(now.getTime() + recommendedNextPollMs).toISOString(),
  };
}

export function buildMeetingAgentQueuePendingStatus({
  queueDepth,
  attentionRequired = false,
  manualReviewRequired = false,
}: {
  queueDepth: number;
  attentionRequired?: boolean;
  manualReviewRequired?: boolean;
}) {
  const cacheRefresh = queueCacheRefreshState({
    queueDepth,
    attentionRequired,
    manualReviewRequired,
  });
  return {
    pendingWriteCount: 0,
    failedWriteCount: 0,
    localPendingWrite: false,
    pendingAgentJobCount: queueDepth,
    pendingRunnerAckCount: queueDepth,
    failedAgentJobCount: 0,
    agentQueuePending: queueDepth > 0,
    safeToContinueLocalUse: true,
    ...cacheRefresh,
    syncCenterStatus: queueSyncCenterStatus({
      queueDepth,
      attentionRequired,
      manualReviewRequired,
    }),
  };
}

export function buildMeetingAgentQueueFailureStatus({
  retryable,
  queueWriteAttempted,
  partialQueueWritePossible,
  manualReviewRequired,
}: {
  retryable: boolean;
  queueWriteAttempted: boolean;
  partialQueueWritePossible: boolean;
  manualReviewRequired: boolean;
}) {
  const cacheRefresh = queueFailureCacheRefreshState({
    retryable,
    queueWriteAttempted,
    partialQueueWritePossible,
    manualReviewRequired,
  });
  return {
    pendingWriteCount: partialQueueWritePossible ? 1 : 0,
    failedWriteCount:
      queueWriteAttempted && !partialQueueWritePossible ? 1 : 0,
    localPendingWrite: false,
    pendingAgentJobCount: 0,
    pendingRunnerAckCount: 0,
    failedAgentJobCount:
      manualReviewRequired || retryable || queueWriteAttempted ? 1 : 0,
    agentQueuePending: false,
    safeToContinueLocalUse: true,
    ...cacheRefresh,
    syncCenterStatus: queueFailureSyncCenterStatus({
      retryable,
      queueWriteAttempted,
      partialQueueWritePossible,
      manualReviewRequired,
    }),
  };
}

function queueSyncCenterStatus({
  queueDepth,
  attentionRequired,
  manualReviewRequired,
}: {
  queueDepth: number;
  attentionRequired: boolean;
  manualReviewRequired: boolean;
}): MeetingAgentQueueSyncCenterStatus {
  if (manualReviewRequired) return "manual_review_required";
  if (attentionRequired) return "attention_recommended";
  if (queueDepth > 0) return "agent_jobs_pending";
  return "idle";
}

function queueCacheRefreshState({
  queueDepth,
  attentionRequired,
  manualReviewRequired,
}: {
  queueDepth: number;
  attentionRequired: boolean;
  manualReviewRequired: boolean;
}) {
  const cacheRefreshBlockedBy = [
    ...(queueDepth > 0 ? ["pending_agent_jobs"] : []),
    ...(attentionRequired ? ["attention_required"] : []),
    ...(manualReviewRequired ? ["manual_review_required"] : []),
  ];
  return {
    safeToRefreshCaches: cacheRefreshBlockedBy.length === 0,
    cacheRefreshStatus: queueCacheRefreshStatus({
      queueDepth,
      attentionRequired,
      manualReviewRequired,
    }),
    cacheRefreshBlockedBy,
  };
}

function queueCacheRefreshStatus({
  queueDepth,
  attentionRequired,
  manualReviewRequired,
}: {
  queueDepth: number;
  attentionRequired: boolean;
  manualReviewRequired: boolean;
}): MeetingAgentQueueCacheRefreshStatus {
  if (manualReviewRequired) return "blocked_manual_review";
  if (attentionRequired) return "blocked_attention_required";
  if (queueDepth > 0) return "blocked_pending_agent_jobs";
  return "safe";
}

function queueFailureSyncCenterStatus({
  retryable,
  queueWriteAttempted,
  partialQueueWritePossible,
  manualReviewRequired,
}: {
  retryable: boolean;
  queueWriteAttempted: boolean;
  partialQueueWritePossible: boolean;
  manualReviewRequired: boolean;
}): MeetingAgentQueueSyncCenterStatus {
  if (manualReviewRequired) return "manual_review_required";
  if (partialQueueWritePossible) return "retryable_unknown";
  if (retryable) return "retry_later";
  if (queueWriteAttempted) return "failed_not_completed";
  return "not_started";
}

function queueFailureCacheRefreshState({
  retryable,
  queueWriteAttempted,
  partialQueueWritePossible,
  manualReviewRequired,
}: {
  retryable: boolean;
  queueWriteAttempted: boolean;
  partialQueueWritePossible: boolean;
  manualReviewRequired: boolean;
}) {
  const cacheRefreshBlockedBy = [
    ...(manualReviewRequired ? ["manual_review_required"] : []),
    ...(partialQueueWritePossible ? ["partial_queue_write_possible"] : []),
    ...(retryable ? ["retry_later"] : []),
    ...(queueWriteAttempted && !partialQueueWritePossible
      ? ["failed_not_completed"]
      : []),
    ...(!manualReviewRequired &&
    !partialQueueWritePossible &&
    !retryable &&
    !queueWriteAttempted
      ? ["queue_not_started"]
      : []),
  ];
  return {
    safeToRefreshCaches: false,
    cacheRefreshStatus: queueFailureCacheRefreshStatus({
      retryable,
      queueWriteAttempted,
      partialQueueWritePossible,
      manualReviewRequired,
    }),
    cacheRefreshBlockedBy,
  };
}

function queueFailureCacheRefreshStatus({
  retryable,
  queueWriteAttempted,
  partialQueueWritePossible,
  manualReviewRequired,
}: {
  retryable: boolean;
  queueWriteAttempted: boolean;
  partialQueueWritePossible: boolean;
  manualReviewRequired: boolean;
}): MeetingAgentQueueCacheRefreshStatus {
  if (manualReviewRequired) return "blocked_manual_review";
  if (partialQueueWritePossible) return "blocked_retryable_unknown";
  if (retryable) return "blocked_retry_later";
  if (queueWriteAttempted) return "blocked_failed_not_completed";
  return "blocked_not_started";
}
