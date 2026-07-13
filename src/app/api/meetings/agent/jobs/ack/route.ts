import { NextResponse } from "next/server";
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
      acknowledged: ackResult.acknowledged,
      missing: ackResult.missing,
      status: ackResult.missing.length > 0 ? "partial" : "acknowledged",
      queueAction:
        ackResult.missing.length > 0
          ? "acknowledged_existing_jobs_with_missing_ids"
          : "acknowledged_existing_jobs",
      unconfirmedJobsPreserved: ackResult.missing.length > 0,
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
}: {
  code: string;
  error: string;
  message?: string;
  retryable: boolean;
  details?: Record<string, unknown> | null;
}) {
  const manualReviewRequired = details?.manual_review_required === true;
  return {
    ok: false,
    code,
    error,
    message: message ?? error,
    retryable,
    details,
    failureStatus: manualReviewRequired
      ? "manual_review"
      : retryable
        ? "failed_retryable"
        : "failed_final",
    manualReviewRequired,
    nextAction: manualReviewRequired
      ? "manual_review"
      : retryable
        ? "retry"
        : "fix_input_or_configuration",
    ...ackFailureBoundary,
  };
}
