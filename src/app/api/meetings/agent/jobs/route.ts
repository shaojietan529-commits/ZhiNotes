import { NextResponse } from "next/server";
import {
  getAccountConfig,
  getSessionAccount,
  readSessionToken,
} from "@/lib/account/server";
import {
  authorizeMeetingAgent,
  enqueueMeetingAgentJob,
  getMeetingAgentQueueConfig,
  listMeetingAgentJobs,
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

export async function GET(request: Request) {
  const config = getMeetingAgentQueueConfig();
  if (config.status !== "ok") {
    return NextResponse.json(
      { error: "ZhiHui agent queue not configured", missing_env: config.missing },
      { status: 501 }
    );
  }
  if (!authorizeMeetingAgent(request, config.agentToken)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? "25");
  try {
    const jobs = await listMeetingAgentJobs(
      config.kv,
      Number.isFinite(limit) ? limit : 25
    );
    return NextResponse.json({
      jobs,
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
      {
        error: "ZhiHui 云端任务队列未配置。",
        missing_env: queueConfig.missing,
      },
      { status: 501 }
    );
  }

  const accountConfig = getAccountConfig();
  if (!accountConfig) {
    return NextResponse.json(
      { error: "账号系统未配置，不能从页面创建录制任务。" },
      { status: 501 }
    );
  }
  const token = readSessionToken(request);
  if (!token) {
    return NextResponse.json({ error: "请先登录 ZhiNote。" }, { status: 401 });
  }
  const account = await getSessionAccount(accountConfig, token);
  if (!account) {
    return NextResponse.json({ error: "登录已过期，请重新登录。" }, { status: 401 });
  }

  let body: { meeting?: unknown; runNow?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const parsed = parseMeeting(body.meeting);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const job = await enqueueMeetingAgentJob(queueConfig.kv, {
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
      job_id: job.id,
      status: "queued",
      run_now: body.runNow === true,
    });
  } catch (error) {
    return meetingAgentQueueErrorResponse(error);
  }
}

function meetingAgentQueueErrorResponse(error: unknown) {
  if (error instanceof MeetingAgentQueueTimeoutError) {
    return NextResponse.json(
      {
        error: "zhihui-agent-queue-timeout",
        message:
          "ZhiHui 云端任务队列请求超时；会议页和日历本地数据不受影响，可稍后重试接入 runner。",
        timeout_ms: error.timeoutMs,
      },
      { status: error.status }
    );
  }

  return NextResponse.json(
    {
      error: "zhihui-agent-queue-failed",
      message:
        "ZhiHui 云端任务队列暂时不可用；会议页和日历本地数据不受影响。",
    },
    { status: 502 }
  );
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
