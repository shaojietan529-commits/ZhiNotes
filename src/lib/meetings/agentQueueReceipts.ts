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
