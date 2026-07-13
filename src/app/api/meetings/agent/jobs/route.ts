import { NextResponse } from "next/server";
import {
  getAccountConfig,
  getSessionAccount,
  readSessionToken,
} from "@/lib/account/server";
import { accountSessionUnconfirmedPayload } from "@/lib/account/sessionResponses";
import {
  authorizeMeetingAgent,
  enqueueMeetingAgentJob,
  getMeetingAgentQueueConfig,
  listMeetingAgentJobs,
  MeetingAgentQueueFailureError,
  MeetingAgentQueueTimeoutError,
} from "@/lib/meetings/agentQueue";

export const dynamic = "force-dynamic";

const JOB_TYPE = "meeting_recording_request";
const PLATFORMS = new Set([
  "腾讯会议",
  "Zoom",
  "Webex",
  "进门财经",
  "久谦论坛",
  "Teams",
  "Google Meet",
  "其他",
]);
const RECORDING_DEVICES = new Set(["MacBook Pro", "Mac Mini"]);
const TRANSCRIPTION_MODELS = new Set(["qwen", "gpt"]);
const MEETING_PRIORITIES = new Set(["default", "high"]);
const queueFailureBoundary = {
  source: "zhihui-agent-queue",
  accountSessionUnaffected: true,
  localUseCanContinue: true,
  localMeetingDataUnaffected: true,
  rawMeetingContentEchoed: false,
};
const queueContinuityReceipt = {
  accountSessionUnaffected: true,
  localUseCanContinue: true,
  localMeetingDataUnaffected: true,
};
const queueReceiptBase = {
  schema: "zhinote.zhihui.agent.queue.receipt.v1",
  source: "zhihui-agent-queue",
  metadataOnly: true,
  rawMeetingContentEchoed: false,
  rawMeetingCredentialsEchoed: false,
  payloadEchoedInReceipt: false,
  ...queueContinuityReceipt,
};

export async function GET(request: Request) {
  const config = getMeetingAgentQueueConfig();
  if (config.status !== "ok") {
    return NextResponse.json(
      queueFailurePayload({
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
      queueFailurePayload({
        code: "zhihui_agent_unauthorized",
        error: "unauthorized",
        retryable: false,
      }),
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? "25");
  try {
    const queueResult = await listMeetingAgentJobs(
      config.kv,
      Number.isFinite(limit) ? limit : 25
    );
    return NextResponse.json({
      ok: true,
      status: "ready",
      nextAction: queueResult.jobs.length > 0 ? "dispatch_available_jobs" : "poll_later",
      syncStatus: "agent_queue_index_read",
      jobs: queueResult.jobs,
      queueDepth: queueResult.queueDepth,
      maxQueueItems: queueResult.maxQueueItems,
      requestedLimit: queueResult.requestedLimit,
      effectiveLimit: queueResult.effectiveLimit,
      availableQueueSlots: queueResult.availableQueueSlots,
      returnedJobs: queueResult.returnedJobs,
      hasMore: queueResult.hasMore,
      queueAlmostFull: queueResult.queueAlmostFull,
      queueReceipt: queueListReceipt(queueResult),
      ...queueContinuityReceipt,
      privacy: {
        requires_agent_token: true,
        payload_may_include_meeting_credentials: true,
      },
    });
  } catch (error) {
    return meetingAgentQueueErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const queueConfig = getMeetingAgentQueueConfig();
  if (queueConfig.status !== "ok") {
    return NextResponse.json(
      queueFailurePayload({
        code: "zhihui_agent_queue_not_configured",
        error: "ZhiHui 云端任务队列未配置。",
        retryable: false,
        details: { missing_env: queueConfig.missing },
      }),
      { status: 501 }
    );
  }

  const accountConfig = getAccountConfig();
  if (!accountConfig) {
    return NextResponse.json(
      queueFailurePayload({
        code: "account_system_not_configured",
        error: "账号系统未配置，不能从页面创建录制任务。",
        retryable: false,
      }),
      { status: 501 }
    );
  }
  const token = readSessionToken(request);
  if (!token) {
    return NextResponse.json(
      queueFailurePayload({
        code: "account_session_required",
        error: "请先登录 ZhiNote。",
        retryable: false,
      }),
      { status: 401 }
    );
  }
  const account = await getSessionAccount(accountConfig, token);
  if (!account) {
    const sessionUnconfirmed = accountSessionUnconfirmedPayload(
      "会议录制任务暂时无法确认账号；不会登出，请稍后重试。"
    );
    return NextResponse.json(
      {
        ...queueFailurePayload({
          code: "account_session_unconfirmed",
          error: sessionUnconfirmed.error,
          retryable: sessionUnconfirmed.retryable,
          details: {
            reason: sessionUnconfirmed.reason,
            keeps_session_cookie: sessionUnconfirmed.keeps_session_cookie,
          },
        }),
        reason: sessionUnconfirmed.reason,
        keeps_session_cookie: sessionUnconfirmed.keeps_session_cookie,
      },
      { status: 503 }
    );
  }

  let body: { meeting?: unknown; runNow?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      queueFailurePayload({
        code: "invalid_json",
        error: "invalid JSON",
        retryable: false,
      }),
      { status: 400 }
    );
  }

  const parsed = parseMeeting(body.meeting);
  if ("error" in parsed) {
    return NextResponse.json(
      queueFailurePayload({
        code: "invalid_meeting_payload",
        error: parsed.error,
        retryable: false,
      }),
      { status: 400 }
    );
  }

  try {
    const enqueueResult = await enqueueMeetingAgentJob(queueConfig.kv, {
      job_type: JOB_TYPE,
      payload: {
        schema: "zhinote.zhihui.meeting-recording-request.v1",
        source: {
          type: "zhinote_schedule_page",
          account_id: account.id,
          account_email_hash_only: true,
        },
        meeting: parsed.meeting,
        target_runner_id: runnerIdForRecordingDevice(parsed.meeting.recording_device),
        fallback_runner_id: runnerIdForRecordingDevice(parsed.meeting.fallback_device),
        priority: parsed.meeting.priority,
        routing: {
          target_runner_id: runnerIdForRecordingDevice(
            parsed.meeting.recording_device
          ),
          fallback_runner_id: runnerIdForRecordingDevice(
            parsed.meeting.fallback_device
          ),
          meeting_account_key: meetingAccountKey(parsed.meeting.platform),
        },
        run_now: body.runNow === true,
      },
    });

    return NextResponse.json({
      ok: true,
      job_id: enqueueResult.job.id,
      status: enqueueResult.deduplicated ? "already_queued" : "queued",
      nextAction: enqueueResult.deduplicated
        ? "wait_for_existing_job"
        : "wait_for_runner_ack",
      syncStatus: "agent_queue_updated",
      queueAction: enqueueResult.deduplicated ? "reused_existing_job" : "created_job",
      deduplicated: enqueueResult.deduplicated,
      run_now: body.runNow === true,
      queueDepth: enqueueResult.queueDepth,
      maxQueueItems: enqueueResult.maxQueueItems,
      availableQueueSlots: enqueueResult.availableQueueSlots,
      queueAlmostFull: enqueueResult.queueAlmostFull,
      queueReceipt: queueEnqueueReceipt(enqueueResult, {
        runNow: body.runNow === true,
      }),
      ...queueContinuityReceipt,
    });
  } catch (error) {
    return meetingAgentQueueErrorResponse(error, { queueWriteAttempted: true });
  }
}

function queueListReceipt(queueResult: {
  queueDepth: number;
  maxQueueItems: number;
  requestedLimit: number;
  effectiveLimit: number;
  availableQueueSlots: number;
  returnedJobs: number;
  hasMore: boolean;
  queueAlmostFull: boolean;
}) {
  return {
    ...queueReceiptBase,
    operation: "list",
    queueAction: "read_available_jobs",
    queueReadStatus: "completed",
    queueWriteStatus: "not_started",
    requestedLimit: queueResult.requestedLimit,
    effectiveLimit: queueResult.effectiveLimit,
    returnedJobs: queueResult.returnedJobs,
    hasMore: queueResult.hasMore,
    queueDepth: queueResult.queueDepth,
    maxQueueItems: queueResult.maxQueueItems,
    availableQueueSlots: queueResult.availableQueueSlots,
    queueAlmostFull: queueResult.queueAlmostFull,
    nextAction:
      queueResult.returnedJobs > 0 ? "dispatch_available_jobs" : "poll_later",
  };
}

function queueEnqueueReceipt(
  enqueueResult: {
    job: { id: string };
    deduplicated: boolean;
    queueDepth: number;
    maxQueueItems: number;
    availableQueueSlots: number;
    queueAlmostFull: boolean;
  },
  { runNow }: { runNow: boolean }
) {
  return {
    ...queueReceiptBase,
    operation: "enqueue",
    queueAction: enqueueResult.deduplicated
      ? "reused_existing_job"
      : "created_job",
    queueReadStatus: "completed",
    queueWriteStatus: enqueueResult.deduplicated
      ? "not_needed_existing_job"
      : "completed",
    jobId: enqueueResult.job.id,
    deduplicated: enqueueResult.deduplicated,
    runNow,
    queueDepth: enqueueResult.queueDepth,
    maxQueueItems: enqueueResult.maxQueueItems,
    availableQueueSlots: enqueueResult.availableQueueSlots,
    queueAlmostFull: enqueueResult.queueAlmostFull,
    nextAction: enqueueResult.deduplicated
      ? "wait_for_existing_job"
      : "wait_for_runner_ack",
  };
}

function meetingAgentQueueErrorResponse(
  error: unknown,
  { queueWriteAttempted = false }: { queueWriteAttempted?: boolean } = {}
) {
  if (error instanceof MeetingAgentQueueTimeoutError) {
    return NextResponse.json(
      queueFailurePayload({
        code: "zhihui_agent_queue_timeout",
        error: "zhihui-agent-queue-timeout",
        message:
          "ZhiHui 云端任务队列请求超时；会议页和日历本地数据不受影响，可稍后重试接入 runner。",
        retryable: true,
        details: { timeout_ms: error.timeoutMs },
        queueWriteAttempted,
      }),
      { status: error.status }
    );
  }
  if (error instanceof MeetingAgentQueueFailureError) {
    return NextResponse.json(
      queueFailurePayload({
        code: error.code,
        error: error.code,
        message: error.message,
        retryable: error.retryable,
        details: error.details,
        queueWriteAttempted,
      }),
      { status: error.status }
    );
  }

  return NextResponse.json(
    queueFailurePayload({
      code: "zhihui_agent_queue_failed",
      error: "zhihui-agent-queue-failed",
      message:
        "ZhiHui 云端任务队列暂时不可用；会议页和日历本地数据不受影响。",
      retryable: true,
      queueWriteAttempted,
    }),
    { status: 502 }
  );
}

function queueFailurePayload({
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
  return {
    ok: false,
    code,
    error,
    message: message ?? error,
    retryable,
    details,
    syncStatus: manualReviewRequired
      ? "manual_review_required"
      : partialQueueWritePossible
        ? "retryable_unknown"
        : queueWriteAttempted
          ? "failed_not_completed"
          : "failed_not_started",
    queueWriteStatus,
    queueWriteAttempted,
    partialQueueWritePossible,
    requiresUserConfirmation: manualReviewRequired,
    highRiskWriteGated: true,
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
    ...queueFailureBoundary,
  };
}

function parseMeeting(value: unknown):
  | {
      meeting: {
        page_id: string;
        title: string;
        topic: string;
        organizer: string;
        platform: string;
        date: string;
        time: string;
        join_url: string;
        meeting_id: string;
        passcode: string;
        recording_device: string;
        fallback_device: string;
        priority: string;
        transcription_model: string;
      };
    }
  | { error: string } {
  if (!value || typeof value !== "object") {
    return { error: "缺少会议信息。" };
  }
  const raw = value as Record<string, unknown>;
  const pageId = text(raw.pageId, 160);
  const topic = text(raw.topic, 400);
  const title = text(raw.title, 500) || topic;
  const organizer = text(raw.organizer, 200);
  const platform = text(raw.platform, 80);
  const date = text(raw.date, 20);
  const time = text(raw.time, 40);
  const joinUrl = text(raw.joinUrl, 2000);
  const meetingId = text(raw.meetingId, 80);
  const passcode = text(raw.passcode, 120);
  const recordingDevice = text(raw.recordingDevice, 40) || "MacBook Pro";
  const fallbackDevice = text(raw.fallbackDevice, 40) || "MacBook Pro";
  const priority = normalizeMeetingPriority(
    text(raw.meetingPriority, 20) || text(raw.priority, 20)
  );
  const transcriptionModel = normalizeTranscriptionModel(
    text(raw.transcriptionModel, 20) || "qwen"
  );

  if (!pageId) return { error: "缺少会议页面 ID。" };
  if (!topic) return { error: "缺少会议主题。" };
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { error: "缺少有效会议日期。" };
  }
  if (!time) return { error: "缺少会议时间。" };
  if (!platform || !PLATFORMS.has(platform)) {
    return { error: "缺少有效会议平台。" };
  }
  if (!joinUrl && !meetingId) {
    return { error: "缺少入会链接或会议号，不能开始自动录制。" };
  }
  if (joinUrl && !isHttpUrl(joinUrl)) {
    return { error: "入会链接不是有效 http/https 地址。" };
  }
  if (!RECORDING_DEVICES.has(recordingDevice)) {
    return { error: "录制设备无效。" };
  }
  if (!RECORDING_DEVICES.has(fallbackDevice)) {
    return { error: "备用录制设备无效。" };
  }
  if (!MEETING_PRIORITIES.has(priority)) {
    return { error: "会议优先级无效。" };
  }
  if (!TRANSCRIPTION_MODELS.has(transcriptionModel)) {
    return { error: "转写模型无效。" };
  }

  return {
    meeting: {
      page_id: pageId,
      title,
      topic,
      organizer,
      platform,
      date,
      time,
      join_url: joinUrl,
      meeting_id: meetingId,
      passcode,
      recording_device: recordingDevice,
      fallback_device: fallbackDevice,
      priority,
      transcription_model: transcriptionModel,
    },
  };
}

function text(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, maxLength)
    : "";
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeTranscriptionModel(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("gpt") || normalized.includes("openai")) return "gpt";
  if (
    normalized.includes("qwen") ||
    normalized.includes("通义") ||
    normalized.includes("千问")
  ) {
    return "qwen";
  }
  return normalized;
}

function runnerIdForRecordingDevice(device: string) {
  return device === "Mac Mini" ? "macmini" : "macbook";
}

function normalizeMeetingPriority(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "high" || normalized === "priority" || normalized === "优先") {
    return "high";
  }
  return "default";
}

function meetingAccountKey(platform: string) {
  return `platform-${platform
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown"}`;
}
