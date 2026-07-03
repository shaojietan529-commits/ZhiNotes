import { NextResponse } from "next/server";
import {
  ackMeetingAgentJobs,
  authorizeMeetingAgent,
  getMeetingAgentQueueConfig,
  MeetingAgentQueueTimeoutError,
} from "@/lib/meetings/agentQueue";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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

  let body: { job_ids?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const jobIds = Array.isArray(body.job_ids)
    ? body.job_ids.filter((item): item is string => typeof item === "string")
    : [];
  try {
    const acknowledged = await ackMeetingAgentJobs(config.kv, jobIds);
    return NextResponse.json({ acknowledged });
  } catch (error) {
    if (error instanceof MeetingAgentQueueTimeoutError) {
      return NextResponse.json(
        {
          error: "zhihui-agent-queue-timeout",
          message:
            "ZhiHui 云端任务队列确认超时；runner 可稍后重试，不会清空未确认任务。",
          timeout_ms: error.timeoutMs,
        },
        { status: error.status }
      );
    }
    return NextResponse.json(
      {
        error: "zhihui-agent-queue-ack-failed",
        message:
          "ZhiHui 云端任务队列确认失败；runner 可稍后重试，不会清空未确认任务。",
      },
      { status: 502 }
    );
  }
}
