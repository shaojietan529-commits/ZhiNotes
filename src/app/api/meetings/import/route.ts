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

const IMPORT_FAILURE_RECEIPT_FRESHNESS_WINDOW_MS = 30_000;
const failureBoundary = {
  source: "zhihui-meeting-import",
  accountSessionUnaffected: true,
  localUseCanContinue: true,
  rawMeetingContentEchoed: false,
};

function importJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

function importFailureReceiptFreshness(now = new Date()) {
  return {
    receiptGeneratedAt: now.toISOString(),
    receiptStaleAfter: new Date(
      now.getTime() + IMPORT_FAILURE_RECEIPT_FRESHNESS_WINDOW_MS
    ).toISOString(),
    receiptFreshnessWindowMs: IMPORT_FAILURE_RECEIPT_FRESHNESS_WINDOW_MS,
  };
}

export async function POST(request: Request) {
  const config = getMeetingAgentQueueConfig();
  if (config.status !== "ok") {
    return importJson(
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
    return importJson(
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
    return importJson(
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
    return importJson({
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
      importReceipt: result.importReceipt,
      accountEmail: result.accountEmail,
      ...failureBoundary,
    });
  } catch (error) {
    if (error instanceof MeetingImportError) {
      return importJson(
        importFailurePayload({
          code: error.code,
          error: error.message,
          retryable: error.retryable,
          details: error.details ?? null,
        }),
        { status: error.status }
      );
    }
    return importJson(
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
  const writeStatus = manualReviewRequired
    ? "manual_review_required"
    : retryable
      ? "unknown_retryable"
      : "not_completed";
  const syncStatus = manualReviewRequired
    ? "manual_review_required"
    : retryable
      ? "retryable_unknown"
      : "failed_not_completed";
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
  const failureReceipt = importFailureReceipt({
    code,
    retryable,
    manualReviewRequired,
    writeStatus,
    syncStatus,
    failureStatus,
    nextAction,
  });

  return {
    ok: false,
    code,
    error,
    retryable,
    details,
    syncStatus,
    cloudWriteStatus: writeStatus,
    calendarWriteStatus: writeStatus,
    partialCloudWritePossible: retryable && !manualReviewRequired,
    requiresUserConfirmation: manualReviewRequired,
    highRiskWriteGated: true,
    failureStatus,
    manualReviewRequired,
    nextAction,
    importFailureReceipt: failureReceipt,
    ...failureBoundary,
  };
}

function importFailureReceipt({
  code,
  retryable,
  manualReviewRequired,
  writeStatus,
  syncStatus,
  failureStatus,
  nextAction,
}: {
  code: string;
  retryable: boolean;
  manualReviewRequired: boolean;
  writeStatus: string;
  syncStatus: string;
  failureStatus: string;
  nextAction: string;
}) {
  return {
    schema: "zhinote.zhihui.import.failure.receipt.v1",
    source: failureBoundary.source,
    operation: "import_meeting_artifact",
    ...importFailureReceiptFreshness(),
    status: failureStatus,
    failureCode: code,
    retryable,
    syncStatus,
    cloudWriteStatus: writeStatus,
    calendarWriteStatus: writeStatus,
    partialCloudWritePossible: retryable && !manualReviewRequired,
    requiresUserConfirmation: manualReviewRequired,
    manualReviewRequired,
    highRiskWriteGated: true,
    nextAction,
    localUseCanContinue: true,
    accountSessionUnaffected: true,
    rawMeetingContentEchoed: false,
    metadataOnly: true,
  };
}
