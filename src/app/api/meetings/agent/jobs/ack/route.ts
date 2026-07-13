import { NextResponse } from "next/server";
import { buildMeetingAgentQueueReceiptTiming } from "@/lib/meetings/agentQueueReceipts";
import {
  ackMeetingAgentJobs,
  authorizeMeetingAgent,
  getMeetingAgentQueueConfig,
  MeetingAgentQueueFailureError,
  MeetingAgentQueueTimeoutError,
} from "@/lib/meetings/agentQueue";

export const dynamic = "force-dynamic";

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

export async function POST(request: Request) {
  const config = getMeetingAgentQueueConfig();
  if (config.status !== "ok") {
    return NextResponse.json(
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
    return NextResponse.json(
      ackFailurePayload({
        code: "zhihui_agent_unauthorized",
        error: "unauthorized",
        retryable: false,
      }),
      { status: 401 }
    );
  }

  let body: { job_ids?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      ackFailurePayload({
        code: "invalid_json",
        error: "invalid JSON",
        retryable: false,
      }),
      { status: 400 }
    );
  }

  const jobIds = Array.isArray(body.job_ids)
    ? body.job_ids.filter((item): item is string => typeof item === "string")
    : [];
  try {
    const ackResult = await ackMeetingAgentJobs(config.kv, jobIds);
    return NextResponse.json({
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
      queueReceipt: queueAckReceipt(ackResult, jobIds.length),
      ...ackContinuityReceipt,
    });
  } catch (error) {
    if (error instanceof MeetingAgentQueueTimeoutError) {
      return NextResponse.json(
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
      return NextResponse.json(
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
    return NextResponse.json(
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
