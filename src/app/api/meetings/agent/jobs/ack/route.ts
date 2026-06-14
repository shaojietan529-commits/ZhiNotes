import { NextResponse } from "next/server";
import {
  ackMeetingAgentJobs,
  authorizeMeetingAgent,
  getMeetingAgentQueueConfig,
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
  const acknowledged = await ackMeetingAgentJobs(config.kv, jobIds);
  return NextResponse.json({ acknowledged });
}
