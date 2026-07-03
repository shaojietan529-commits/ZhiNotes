import { NextResponse } from "next/server";
import {
  authorizeMeetingAgent,
  getMeetingAgentQueueConfig,
} from "@/lib/meetings/agentQueue";
import {
  importMeetingArtifactToPages,
  MeetingImportError,
} from "@/lib/meetings/meetingImportPages";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const config = getMeetingAgentQueueConfig();
  if (config.status !== "ok") {
    return NextResponse.json(
      { error: "ZhiHui meeting import not configured", missing_env: config.missing },
      { status: 501 }
    );
  }
  if (!authorizeMeetingAgent(request, config.agentToken)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  try {
    const result = await importMeetingArtifactToPages(config.kv, payload);
    return NextResponse.json({
      ok: true,
      id: result.importId,
      url: result.url,
      minutesPageId: result.minutesPageId,
      meetingPageId: result.meetingPageId,
      dailyPageId: result.dailyPageId,
      minutesPageUrl: result.minutesPageUrl,
      meetingPageUrl: result.meetingPageUrl,
      placement: "daily-and-zhihui",
      meeting: result.meeting,
      calendar: result.calendar,
      accountEmail: result.accountEmail,
    });
  } catch (error) {
    if (error instanceof MeetingImportError) {
      return NextResponse.json(
        { error: error.message, details: error.details ?? null },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: "ZhiHui meeting import failed" },
      { status: 502 }
    );
  }
}
