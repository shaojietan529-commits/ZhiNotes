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

const failureBoundary = {
  source: "zhihui-meeting-import",
  accountSessionUnaffected: true,
  localUseCanContinue: true,
  rawMeetingContentEchoed: false,
};

export async function POST(request: Request) {
  const config = getMeetingAgentQueueConfig();
  if (config.status !== "ok") {
    return NextResponse.json(
      importFailurePayload({
        code: "zhihui_meeting_import_not_configured",
        error: "ZhiHui meeting import not configured",
        retryable: false,
        details: { missing_env: config.missing },
      }),
      { status: 501 }
    );
  }
  if (!authorizeMeetingAgent(request, config.agentToken)) {
    return NextResponse.json(
      importFailurePayload({
        code: "zhihui_agent_unauthorized",
        error: "unauthorized",
        retryable: false,
      }),
      { status: 401 }
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      importFailurePayload({
        code: "invalid_json",
        error: "invalid JSON",
        retryable: false,
      }),
      { status: 400 }
    );
  }

  try {
    const result = await importMeetingArtifactToPages(config.kv, payload);
    return NextResponse.json({
      ok: true,
      id: result.importId,
      status: "imported",
      nextAction: "refresh_calendar_metadata",
      syncStatus: "cloud_page_index_updated",
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
      ...failureBoundary,
    });
  } catch (error) {
    if (error instanceof MeetingImportError) {
      return NextResponse.json(
        importFailurePayload({
          code: error.code,
          error: error.message,
          retryable: error.retryable,
          details: error.details ?? null,
        }),
        { status: error.status }
      );
    }
    return NextResponse.json(
      importFailurePayload({
        code: "zhihui_meeting_import_failed",
        error: "ZhiHui meeting import failed",
        retryable: true,
      }),
      { status: 502 }
    );
  }
}

function importFailurePayload({
  code,
  error,
  retryable,
  details = null,
}: {
  code: string;
  error: string;
  retryable: boolean;
  details?: Record<string, unknown> | null;
}) {
  const manualReviewRequired = details?.manual_review_required === true;
  return {
    ok: false,
    code,
    error,
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
    ...failureBoundary,
  };
}
