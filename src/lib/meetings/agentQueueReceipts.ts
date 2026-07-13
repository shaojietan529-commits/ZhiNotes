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
  return {
    pendingWriteCount: 0,
    failedWriteCount: 0,
    localPendingWrite: false,
    pendingAgentJobCount: queueDepth,
    pendingRunnerAckCount: queueDepth,
    failedAgentJobCount: 0,
    agentQueuePending: queueDepth > 0,
    safeToContinueLocalUse: true,
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
