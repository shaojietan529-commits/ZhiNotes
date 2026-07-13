import { NextResponse } from "next/server";
import { buildMeetingAgentQueueReceiptTiming } from "@/lib/meetings/agentQueueReceipts";
import {
  ackMeetingAgentJobs,
  authorizeMeetingAgent,
  getMeetingAgentQueueConfig,
  MeetingAgentQueueFailureError,
  MeetingAgentQueueTimeoutError,
} from "@/lib/meetings/agentQueue";
import { readBoundedJsonBody } from "@/lib/meetings/requestBody";

export const dynamic = "force-dynamic";

const MAX_ACK_REQUEST_BYTES = 32 * 1024;
const MAX_ACK_JOB_IDS = 100;
const MAX_ACK_JOB_ID_CHARS = 160;
const ACK_JOB_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const ackFailureBoundary = {
  source: "zhihui-agent-queue-ack",
  accountSessionUnaffected: true,
  localUseCanContinue: true,
  localMeetingDataUnaffected: true,
  rawMeetingContentEchoed: false,
  unconfirmedJobsPreserved: true,
};
const ackContinuityReceipt = {
  accountSessionUnaffected: true,
  localUseCanContinue: true,
  localMeetingDataUnaffected: true,
};
const ackReceiptBase = {
  schema: "zhinote.zhihui.agent.queue.receipt.v1",
  source: "zhihui-agent-queue-ack",
  operation: "ack",
  metadataOnly: true,
  rawMeetingContentEchoed: false,
  rawMeetingCredentialsEchoed: false,
  payloadEchoedInReceipt: false,
  ...ackContinuityReceipt,
};

function ackJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

function ackRequestTooLarge() {
  return ackJson(
    ackFailurePayload({
      code: "zhihui_agent_queue_ack_request_too_large",
      error: "ZhiHui agent queue ACK request payload is too large",
      retryable: false,
      details: { max_request_bytes: MAX_ACK_REQUEST_BYTES },
    }),
    { status: 413 }
  );
}

export async function POST(request: Request) {
  const config = getMeetingAgentQueueConfig();
  if (config.status !== "ok") {
    return ackJson(
      ackFailurePayload({
        code: "zhihui_agent_queue_not_configured",
        error: "ZhiHui agent queue not configured",
        retryable: false,
        details: { missing_env: config.missing },
      }),
      { status: 501 }
    );
  }
  if (!authorizeMeetingAgent(request, config.agentToken)) {
    return ackJson(
      ackFailurePayload({
        code: "zhihui_agent_unauthorized",
        error: "unauthorized",
        retryable: false,
      }),
      { status: 401 }
    );
  }

  const bodyRead = await readBoundedJsonBody(request, MAX_ACK_REQUEST_BYTES);
  if (!bodyRead.ok) {
    if (bodyRead.reason === "payload_too_large") {
      return ackRequestTooLarge();
    }
    return ackJson(
      ackFailurePayload({
        code: "invalid_json",
        error: "invalid JSON",
        retryable: false,
      }),
      { status: 400 }
    );
  }
  const body =
    bodyRead.value && typeof bodyRead.value === "object"
      ? (bodyRead.value as { job_ids?: unknown })
      : {};

  const normalizedAck = normalizeAckJobIds(body.job_ids);
  if (!normalizedAck.ok) {
    return ackJson(
      ackFailurePayload({
        code: normalizedAck.code,
        error: normalizedAck.error,
        retryable: false,
        details: normalizedAck.details,
      }),
      { status: normalizedAck.status }
    );
  }

  try {
    const ackResult = await ackMeetingAgentJobs(config.kv, normalizedAck.jobIds);
    return ackJson({
      ok: true,
      acknowledged: ackResult.acknowledged,
      missing: ackResult.missing,
      status: ackResult.missing.length > 0 ? "partial" : "acknowledged",
      nextAction:
        ackResult.missing.length > 0
          ? "review_missing_jobs"
          : "poll_for_next_jobs",
      syncStatus: "agent_queue_acknowledged",
      queueAction:
        ackResult.missing.length > 0
          ? "acknowledged_existing_jobs_with_missing_ids"
          : "acknowledged_existing_jobs",
      unconfirmedJobsPreserved: ackResult.missing.length > 0,
      queueDepth: ackResult.queueDepth,
      maxQueueItems: ackResult.maxQueueItems,
      availableQueueSlots: ackResult.availableQueueSlots,
      queueAlmostFull: ackResult.queueAlmostFull,
      queueReceipt: queueAckReceipt(ackResult, normalizedAck.requestedAckCount),
      ...ackContinuityReceipt,
    });
  } catch (error) {
    if (error instanceof MeetingAgentQueueTimeoutError) {
      return ackJson(
        ackFailurePayload({
          code: "zhihui_agent_queue_timeout",
          error: "zhihui-agent-queue-timeout",
          message:
            "ZhiHui 云端任务队列确认超时；runner 可稍后重试，不会清空未确认任务。",
          retryable: true,
          details: { timeout_ms: error.timeoutMs },
          queueWriteAttempted: true,
        }),
        { status: error.status }
      );
    }
    if (error instanceof MeetingAgentQueueFailureError) {
      return ackJson(
        ackFailurePayload({
          code: error.code,
          error: error.code,
          message: error.message,
          retryable: error.retryable,
          details: error.details,
          queueWriteAttempted: true,
        }),
        { status: error.status }
      );
    }
    return ackJson(
      ackFailurePayload({
        code: "zhihui_agent_queue_ack_failed",
        error: "zhihui-agent-queue-ack-failed",
        message:
          "ZhiHui 云端任务队列确认失败；runner 可稍后重试，不会清空未确认任务。",
        retryable: true,
        queueWriteAttempted: true,
      }),
      { status: 502 }
    );
  }
}

function normalizeAckJobIds(jobIds: unknown):
  | {
      ok: true;
      jobIds: string[];
      requestedAckCount: number;
      blankAckIdsIgnored: number;
      duplicateAckIdsDropped: number;
    }
  | {
      ok: false;
      code: "invalid_ack_job_ids" | "zhihui_agent_queue_ack_too_many_ids";
      error: string;
      status: number;
      details: Record<string, unknown>;
    } {
  if (jobIds == null) {
    return {
      ok: true,
      jobIds: [],
      requestedAckCount: 0,
      blankAckIdsIgnored: 0,
      duplicateAckIdsDropped: 0,
    };
  }
  if (!Array.isArray(jobIds)) {
    return invalidAckJobIds({
      requestedAckItems: 1,
      nonStringAckIds: 1,
    });
  }

  const seen = new Set<string>();
  const normalized: string[] = [];
  let blankAckIdsIgnored = 0;
  let duplicateAckIdsDropped = 0;
  let nonStringAckIds = 0;
  let invalidAckIds = 0;
  let oversizedAckIds = 0;

  for (const item of jobIds) {
    if (typeof item !== "string") {
      nonStringAckIds += 1;
      continue;
    }

    const jobId = item.trim();
    if (!jobId) {
      blankAckIdsIgnored += 1;
      continue;
    }
    if (jobId.length > MAX_ACK_JOB_ID_CHARS) {
      oversizedAckIds += 1;
      continue;
    }
    if (!ACK_JOB_ID_PATTERN.test(jobId)) {
      invalidAckIds += 1;
      continue;
    }
    if (seen.has(jobId)) {
      duplicateAckIdsDropped += 1;
      continue;
    }

    seen.add(jobId);
    normalized.push(jobId);
    if (normalized.length > MAX_ACK_JOB_IDS) {
      return {
        ok: false,
        code: "zhihui_agent_queue_ack_too_many_ids",
        error: "too many ACK job ids",
        status: 413,
        details: {
          max_ack_job_ids: MAX_ACK_JOB_IDS,
          requested_ack_items: jobIds.length,
          normalized_ack_ids: normalized.length,
          blank_ack_ids_ignored: blankAckIdsIgnored,
          duplicate_ack_ids_dropped: duplicateAckIdsDropped,
          invalid_ack_ids_count:
            nonStringAckIds + invalidAckIds + oversizedAckIds,
          raw_ack_job_ids_echoed: false,
        },
      };
    }
  }

  if (nonStringAckIds > 0 || invalidAckIds > 0 || oversizedAckIds > 0) {
    return invalidAckJobIds({
      requestedAckItems: jobIds.length,
      nonStringAckIds,
      invalidAckIds,
      oversizedAckIds,
      blankAckIdsIgnored,
      duplicateAckIdsDropped,
    });
  }

  return {
    ok: true,
    jobIds: normalized,
    requestedAckCount: normalized.length,
    blankAckIdsIgnored,
    duplicateAckIdsDropped,
  };
}

function invalidAckJobIds({
  requestedAckItems,
  nonStringAckIds = 0,
  invalidAckIds = 0,
  oversizedAckIds = 0,
  blankAckIdsIgnored = 0,
  duplicateAckIdsDropped = 0,
}: {
  requestedAckItems: number;
  nonStringAckIds?: number;
  invalidAckIds?: number;
  oversizedAckIds?: number;
  blankAckIdsIgnored?: number;
  duplicateAckIdsDropped?: number;
}) {
  return {
    ok: false as const,
    code: "invalid_ack_job_ids" as const,
    error: "invalid ACK job ids",
    status: 400,
    details: {
      max_ack_job_ids: MAX_ACK_JOB_IDS,
      max_ack_job_id_chars: MAX_ACK_JOB_ID_CHARS,
      allowed_ack_job_id_pattern: ACK_JOB_ID_PATTERN.source,
      requested_ack_items: requestedAckItems,
      non_string_ack_ids: nonStringAckIds,
      invalid_ack_ids: invalidAckIds,
      oversized_ack_ids: oversizedAckIds,
      blank_ack_ids_ignored: blankAckIdsIgnored,
      duplicate_ack_ids_dropped: duplicateAckIdsDropped,
      raw_ack_job_ids_echoed: false,
    },
  };
}

function ackFailurePayload({
  code,
  error,
  message,
  retryable,
  details = null,
  queueWriteAttempted = false,
}: {
  code: string;
  error: string;
  message?: string;
  retryable: boolean;
  details?: Record<string, unknown> | null;
  queueWriteAttempted?: boolean;
}) {
  const manualReviewRequired = details?.manual_review_required === true;
  const partialQueueWritePossible =
    queueWriteAttempted && retryable && !manualReviewRequired;
  const queueWriteStatus = manualReviewRequired
    ? "manual_review_required"
    : partialQueueWritePossible
      ? "unknown_retryable"
      : queueWriteAttempted
        ? "not_completed"
        : "not_started";
  const syncStatus = manualReviewRequired
    ? "manual_review_required"
    : partialQueueWritePossible
      ? "retryable_unknown"
      : queueWriteAttempted
        ? "failed_not_completed"
        : "failed_not_started";
  const failureStatus = manualReviewRequired
    ? "manual_review"
    : retryable
      ? "failed_retryable"
      : "failed_final";
  const nextAction = manualReviewRequired
    ? "manual_review"
    : retryable
      ? "retry"
      : "fix_input_or_configuration";
  const failureReceipt = ackFailureReceipt({
    code,
    retryable,
    queueWriteAttempted,
    queueWriteStatus,
    partialQueueWritePossible,
    manualReviewRequired,
    syncStatus,
    failureStatus,
    nextAction,
  });

  return {
    ok: false,
    code,
    error,
    message: message ?? error,
    retryable,
    details,
    syncStatus,
    queueWriteStatus,
    queueWriteAttempted,
    partialQueueWritePossible,
    requiresUserConfirmation: manualReviewRequired,
    highRiskWriteGated: true,
    failureStatus,
    manualReviewRequired,
    nextAction,
    ackFailureReceipt: failureReceipt,
    ...ackFailureBoundary,
  };
}

function ackFailureReceipt({
  code,
  retryable,
  queueWriteAttempted,
  queueWriteStatus,
  partialQueueWritePossible,
  manualReviewRequired,
  syncStatus,
  failureStatus,
  nextAction,
}: {
  code: string;
  retryable: boolean;
  queueWriteAttempted: boolean;
  queueWriteStatus: string;
  partialQueueWritePossible: boolean;
  manualReviewRequired: boolean;
  syncStatus: string;
  failureStatus: string;
  nextAction: string;
}) {
  return {
    ...ackReceiptBase,
    ...buildMeetingAgentQueueReceiptTiming({
      pollMode: manualReviewRequired
        ? "manual_review"
        : retryable
          ? "retry"
          : "none",
    }),
    operation: "ack_failure",
    queueAction: "ack_operation_failed",
    status: failureStatus,
    failureCode: code,
    retryable,
    syncStatus,
    queueReadStatus: queueWriteAttempted ? "unknown" : "not_started",
    queueWriteStatus,
    queueWriteAttempted,
    partialQueueWritePossible,
    requiresUserConfirmation: manualReviewRequired,
    manualReviewRequired,
    highRiskWriteGated: true,
    unconfirmedJobsPreserved: true,
    nextAction,
  };
}

function queueAckReceipt(
  ackResult: {
    acknowledged: string[];
    missing: string[];
    queueDepth: number;
    maxQueueItems: number;
    availableQueueSlots: number;
    queueAlmostFull: boolean;
  },
  requestedAckCount: number
) {
  const acknowledgedCount = ackResult.acknowledged.length;
  const missingCount = ackResult.missing.length;
  return {
    ...ackReceiptBase,
    ...buildMeetingAgentQueueReceiptTiming({
      pollMode: missingCount > 0 ? "manual_review" : "idle",
    }),
    queueAction:
      missingCount > 0
        ? "acknowledged_existing_jobs_with_missing_ids"
        : "acknowledged_existing_jobs",
    queueReadStatus: "completed",
    queueWriteStatus:
      acknowledgedCount > 0 ? "completed" : "not_needed_no_matching_jobs",
    requestedAckCount,
    acknowledgedCount,
    missingCount,
    acknowledgedJobIds: ackResult.acknowledged,
    missingJobIds: ackResult.missing,
    unconfirmedJobsPreserved: missingCount > 0,
    queueDepth: ackResult.queueDepth,
    maxQueueItems: ackResult.maxQueueItems,
    availableQueueSlots: ackResult.availableQueueSlots,
    queueAlmostFull: ackResult.queueAlmostFull,
    nextAction: missingCount > 0 ? "review_missing_jobs" : "poll_for_next_jobs",
  };
}
