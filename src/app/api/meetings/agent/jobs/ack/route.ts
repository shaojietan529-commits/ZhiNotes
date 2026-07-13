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
const MAX_ACK_LEASE_ID_CHARS = 160;
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

type AckReceiptTimingFieldsInput = {
  receiptGeneratedAt: string;
  receiptStaleAfter: string;
  receiptFreshnessWindowMs: number;
  pollMode: string;
  recommendedNextPollMs: number | null;
  recommendedNextPollAt: string | null;
};

function ackReceiptTimingFields(receipt: AckReceiptTimingFieldsInput) {
  return {
    receiptGeneratedAt: receipt.receiptGeneratedAt,
    receiptStaleAfter: receipt.receiptStaleAfter,
    receiptFreshnessWindowMs: receipt.receiptFreshnessWindowMs,
    pollMode: receipt.pollMode,
    recommendedNextPollMs: receipt.recommendedNextPollMs,
    recommendedNextPollAt: receipt.recommendedNextPollAt,
  };
}

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
      ? (bodyRead.value as {
          job_ids?: unknown;
          job_leases?: unknown;
          lease_ids?: unknown;
        })
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
  const normalizedAckLeases = normalizeAckJobLeases(
    body.job_leases ?? body.lease_ids,
    normalizedAck.jobIds
  );
  if (!normalizedAckLeases.ok) {
    return ackJson(
      ackFailurePayload({
        code: normalizedAckLeases.code,
        error: normalizedAckLeases.error,
        retryable: false,
        details: normalizedAckLeases.details,
      }),
      { status: normalizedAckLeases.status }
    );
  }

  try {
    const ackResult = await ackMeetingAgentJobs(config.kv, normalizedAck.jobIds, {
      jobLeases: normalizedAckLeases.jobLeases,
    });
    const acknowledgedCount = ackResult.acknowledged.length;
    const missingCount = ackResult.missing.length;
    const leaseMismatchCount = ackResult.leaseMismatched.length;
    const unconfirmedJobCount = missingCount + leaseMismatchCount;
    const hasUnconfirmedJobs = unconfirmedJobCount > 0;
    const ackHealth = queueAckHealth({
      queueAlmostFull: ackResult.queueAlmostFull,
      hasUnconfirmedJobs,
    });
    const queueReceipt = queueAckReceipt(
      ackResult,
      normalizedAck.requestedAckCount,
      normalizedAckLeases.requestedLeaseCount,
      ackHealth
    );
    return ackJson({
      ok: true,
      acknowledged: ackResult.acknowledged,
      missing: ackResult.missing,
      leaseMismatched: ackResult.leaseMismatched,
      requestedAckCount: normalizedAck.requestedAckCount,
      requestedLeaseCount: normalizedAckLeases.requestedLeaseCount,
      acknowledgedCount,
      missingCount,
      leaseMismatchCount,
      unconfirmedJobCount,
      status: hasUnconfirmedJobs ? "partial" : "acknowledged",
      nextAction:
        hasUnconfirmedJobs
          ? "review_missing_or_lease_mismatched_jobs"
          : "poll_for_next_jobs",
      syncStatus: "agent_queue_acknowledged",
      queueAction:
        hasUnconfirmedJobs
          ? "acknowledged_existing_jobs_with_missing_or_lease_mismatched_ids"
          : "acknowledged_existing_jobs",
      ackContract: "lease_aware",
      manualReviewRequired: hasUnconfirmedJobs,
      unconfirmedJobsPreserved: hasUnconfirmedJobs,
      queueDepth: ackResult.queueDepth,
      maxQueueItems: ackResult.maxQueueItems,
      availableQueueSlots: ackResult.availableQueueSlots,
      queueAlmostFull: ackResult.queueAlmostFull,
      queueHealth: ackHealth.queueHealth,
      attentionRequired: ackHealth.attentionRequired,
      attentionReason: ackHealth.attentionReason,
      reclaimableLeaseCount: ackHealth.reclaimableLeaseCount,
      ...ackReceiptTimingFields(queueReceipt),
      queueReceipt,
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

function normalizeAckJobLeases(
  jobLeases: unknown,
  jobIds: string[]
):
  | {
      ok: true;
      jobLeases: Record<string, string>;
      requestedLeaseCount: number;
      duplicateAckLeasesDropped: number;
    }
  | {
      ok: false;
      code: "invalid_ack_job_leases";
      error: string;
      status: number;
      details: Record<string, unknown>;
    } {
  if (jobLeases == null) {
    return {
      ok: true,
      jobLeases: {},
      requestedLeaseCount: 0,
      duplicateAckLeasesDropped: 0,
    };
  }

  const allowedJobIds = new Set(jobIds);
  const entries: Array<{ jobId: unknown; leaseId: unknown }> = [];
  let nonObjectAckLeases = 0;

  if (Array.isArray(jobLeases)) {
    for (const item of jobLeases) {
      if (!item || typeof item !== "object") {
        nonObjectAckLeases += 1;
        continue;
      }
      const row = item as { job_id?: unknown; jobId?: unknown; lease_id?: unknown; leaseId?: unknown };
      entries.push({
        jobId: row.job_id ?? row.jobId,
        leaseId: row.lease_id ?? row.leaseId,
      });
    }
  } else if (typeof jobLeases === "object") {
    for (const [jobId, leaseId] of Object.entries(
      jobLeases as Record<string, unknown>
    )) {
      entries.push({ jobId, leaseId });
    }
  } else {
    return invalidAckJobLeases({ requestedLeaseItems: 1, nonObjectAckLeases: 1 });
  }

  const normalized: Record<string, string> = {};
  let nonStringAckLeaseJobIds = 0;
  let nonStringAckLeaseIds = 0;
  let invalidAckLeaseJobIds = 0;
  let invalidAckLeaseIds = 0;
  let oversizedAckLeaseJobIds = 0;
  let oversizedAckLeaseIds = 0;
  let unknownAckLeaseJobIds = 0;
  let duplicateAckLeasesDropped = 0;

  for (const entry of entries) {
    if (typeof entry.jobId !== "string") {
      nonStringAckLeaseJobIds += 1;
      continue;
    }
    if (typeof entry.leaseId !== "string") {
      nonStringAckLeaseIds += 1;
      continue;
    }
    const jobId = entry.jobId.trim();
    const leaseId = entry.leaseId.trim();
    if (!jobId || !leaseId) {
      if (!jobId) invalidAckLeaseJobIds += 1;
      if (!leaseId) invalidAckLeaseIds += 1;
      continue;
    }
    if (jobId.length > MAX_ACK_JOB_ID_CHARS) {
      oversizedAckLeaseJobIds += 1;
      continue;
    }
    if (leaseId.length > MAX_ACK_LEASE_ID_CHARS) {
      oversizedAckLeaseIds += 1;
      continue;
    }
    if (!ACK_JOB_ID_PATTERN.test(jobId)) {
      invalidAckLeaseJobIds += 1;
      continue;
    }
    if (!ACK_JOB_ID_PATTERN.test(leaseId)) {
      invalidAckLeaseIds += 1;
      continue;
    }
    if (!allowedJobIds.has(jobId)) {
      unknownAckLeaseJobIds += 1;
      continue;
    }
    if (normalized[jobId]) {
      duplicateAckLeasesDropped += 1;
      continue;
    }
    normalized[jobId] = leaseId;
  }

  const invalidCount =
    nonObjectAckLeases +
    nonStringAckLeaseJobIds +
    nonStringAckLeaseIds +
    invalidAckLeaseJobIds +
    invalidAckLeaseIds +
    oversizedAckLeaseJobIds +
    oversizedAckLeaseIds +
    unknownAckLeaseJobIds;
  if (invalidCount > 0) {
    return invalidAckJobLeases({
      requestedLeaseItems: Array.isArray(jobLeases)
        ? jobLeases.length
        : entries.length,
      nonObjectAckLeases,
      nonStringAckLeaseJobIds,
      nonStringAckLeaseIds,
      invalidAckLeaseJobIds,
      invalidAckLeaseIds,
      oversizedAckLeaseJobIds,
      oversizedAckLeaseIds,
      unknownAckLeaseJobIds,
      duplicateAckLeasesDropped,
    });
  }

  return {
    ok: true,
    jobLeases: normalized,
    requestedLeaseCount: Object.keys(normalized).length,
    duplicateAckLeasesDropped,
  };
}

function invalidAckJobLeases({
  requestedLeaseItems,
  nonObjectAckLeases = 0,
  nonStringAckLeaseJobIds = 0,
  nonStringAckLeaseIds = 0,
  invalidAckLeaseJobIds = 0,
  invalidAckLeaseIds = 0,
  oversizedAckLeaseJobIds = 0,
  oversizedAckLeaseIds = 0,
  unknownAckLeaseJobIds = 0,
  duplicateAckLeasesDropped = 0,
}: {
  requestedLeaseItems: number;
  nonObjectAckLeases?: number;
  nonStringAckLeaseJobIds?: number;
  nonStringAckLeaseIds?: number;
  invalidAckLeaseJobIds?: number;
  invalidAckLeaseIds?: number;
  oversizedAckLeaseJobIds?: number;
  oversizedAckLeaseIds?: number;
  unknownAckLeaseJobIds?: number;
  duplicateAckLeasesDropped?: number;
}) {
  return {
    ok: false as const,
    code: "invalid_ack_job_leases" as const,
    error: "invalid ACK job leases",
    status: 400,
    details: {
      max_ack_job_id_chars: MAX_ACK_JOB_ID_CHARS,
      max_ack_lease_id_chars: MAX_ACK_LEASE_ID_CHARS,
      allowed_ack_lease_id_pattern: ACK_JOB_ID_PATTERN.source,
      requested_ack_lease_items: requestedLeaseItems,
      non_object_ack_leases: nonObjectAckLeases,
      non_string_ack_lease_job_ids: nonStringAckLeaseJobIds,
      non_string_ack_lease_ids: nonStringAckLeaseIds,
      invalid_ack_lease_job_ids: invalidAckLeaseJobIds,
      invalid_ack_lease_ids: invalidAckLeaseIds,
      oversized_ack_lease_job_ids: oversizedAckLeaseJobIds,
      oversized_ack_lease_ids: oversizedAckLeaseIds,
      unknown_ack_lease_job_ids: unknownAckLeaseJobIds,
      duplicate_ack_leases_dropped: duplicateAckLeasesDropped,
      raw_ack_job_leases_echoed: false,
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
  const receiptTiming = ackReceiptTimingFields(failureReceipt);

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
    ...receiptTiming,
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
    leaseMismatched: string[];
    queueDepth: number;
    maxQueueItems: number;
    availableQueueSlots: number;
    queueAlmostFull: boolean;
  },
  requestedAckCount: number,
  requestedLeaseCount: number,
  ackHealth = queueAckHealth({
    queueAlmostFull: ackResult.queueAlmostFull,
    hasUnconfirmedJobs:
      ackResult.missing.length + ackResult.leaseMismatched.length > 0,
  })
) {
  const acknowledgedCount = ackResult.acknowledged.length;
  const missingCount = ackResult.missing.length;
  const leaseMismatchCount = ackResult.leaseMismatched.length;
  const preservedCount = missingCount + leaseMismatchCount;
  return {
    ...ackReceiptBase,
    ...buildMeetingAgentQueueReceiptTiming({
      pollMode: preservedCount > 0 ? "manual_review" : "idle",
    }),
    queueAction:
      preservedCount > 0
        ? "acknowledged_existing_jobs_with_missing_or_lease_mismatched_ids"
        : "acknowledged_existing_jobs",
    queueReadStatus: "completed",
    queueWriteStatus:
      acknowledgedCount > 0 ? "completed" : "not_needed_no_matching_jobs",
    requestedAckCount,
    requestedLeaseCount,
    acknowledgedCount,
    missingCount,
    leaseMismatchCount,
    acknowledgedJobIds: ackResult.acknowledged,
    missingJobIds: ackResult.missing,
    leaseMismatchedJobIds: ackResult.leaseMismatched,
    unconfirmedJobsPreserved: preservedCount > 0,
    queueDepth: ackResult.queueDepth,
    maxQueueItems: ackResult.maxQueueItems,
    availableQueueSlots: ackResult.availableQueueSlots,
    queueAlmostFull: ackResult.queueAlmostFull,
    queueHealth: ackHealth.queueHealth,
    attentionRequired: ackHealth.attentionRequired,
    attentionReason: ackHealth.attentionReason,
    reclaimableLeaseCount: ackHealth.reclaimableLeaseCount,
    manualReviewRequired: preservedCount > 0,
    nextAction:
      preservedCount > 0
        ? "review_missing_or_lease_mismatched_jobs"
        : "poll_for_next_jobs",
  };
}

function queueAckHealth({
  queueAlmostFull,
  hasUnconfirmedJobs,
}: {
  queueAlmostFull: boolean;
  hasUnconfirmedJobs: boolean;
}) {
  const attentionReason = hasUnconfirmedJobs
    ? "ack_unconfirmed_jobs_preserved"
    : queueAlmostFull
      ? "queue_almost_full"
      : null;
  return {
    queueHealth: attentionReason ? "attention_recommended" : "healthy",
    attentionRequired: attentionReason !== null,
    attentionReason,
    reclaimableLeaseCount: 0,
  };
}
