import { NextResponse } from "next/server";
import {
  authorizeMeetingAgent,
  getMeetingAgentQueueConfig,
} from "@/lib/meetings/agentQueue";
import {
  importMeetingArtifactToPages,
  MeetingImportError,
} from "@/lib/meetings/meetingImportPages";
import { readBoundedJsonBody } from "@/lib/meetings/requestBody";

export const dynamic = "force-dynamic";

const MAX_IMPORT_REQUEST_BYTES = 2_000_000;
const IMPORT_FAILURE_RECEIPT_FRESHNESS_WINDOW_MS = 30_000;
const failureBoundary = {
  source: "zhihui-meeting-import",
  accountSessionUnaffected: true,
  localUseCanContinue: true,
  rawMeetingContentEchoed: false,
  rawMeetingCredentialsEchoed: false,
  payloadEchoedInReceipt: false,
  metadataOnly: true,
};

function importJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

function importPayloadTooLarge() {
  return importJson(
    importFailurePayload({
      code: "meeting_import_payload_too_large",
      error: "ZhiHui meeting import payload is too large",
      retryable: false,
      details: { max_bytes: MAX_IMPORT_REQUEST_BYTES },
    }),
    { status: 413 }
  );
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

type ImportReceiptTimingFieldsInput = {
  receiptGeneratedAt: string;
  receiptStaleAfter: string;
  receiptFreshnessWindowMs: number;
};

function importReceiptTimingFields(receipt: ImportReceiptTimingFieldsInput) {
  return {
    receiptGeneratedAt: receipt.receiptGeneratedAt,
    receiptStaleAfter: receipt.receiptStaleAfter,
    receiptFreshnessWindowMs: receipt.receiptFreshnessWindowMs,
  };
}

type ImportCalendarRefreshFieldsInput = {
  source: string;
  dateKey: string;
  affectedCalendars: string[];
  metadataActions: string[];
  changedPageIds: string[];
  changeLogEntries: number;
  previousCursor: string;
  nextCursor: string;
  dailyCalendarVisible: boolean;
  meetingCalendarVisible: boolean;
  requiresMetadataRefresh: boolean;
  metadataRefreshReason: string;
  metadataRefreshMode: string;
  fullCacheRebuildRequired: boolean;
};

function importCalendarRefreshFields(
  calendar: ImportCalendarRefreshFieldsInput
) {
  return {
    calendarRefreshSource: calendar.source,
    calendarDateKey: calendar.dateKey,
    affectedCalendars: calendar.affectedCalendars,
    metadataActions: calendar.metadataActions,
    changedPageIds: calendar.changedPageIds,
    changeLogEntries: calendar.changeLogEntries,
    previousCursor: calendar.previousCursor,
    nextCursor: calendar.nextCursor,
    dailyCalendarVisible: calendar.dailyCalendarVisible,
    meetingCalendarVisible: calendar.meetingCalendarVisible,
    metadataRefreshRequired: calendar.requiresMetadataRefresh,
    metadataRefreshReason: calendar.metadataRefreshReason,
    metadataRefreshMode: calendar.metadataRefreshMode,
    fullCacheRebuildRequired: calendar.fullCacheRebuildRequired,
  };
}

function importSuccessClearanceFields() {
  return {
    importStatus: "completed",
    pendingWriteCount: 0,
    failedWriteCount: 0,
    localPendingWrite: false,
    pendingImportCount: 0,
    failedImportCount: 0,
    manualReviewImportCount: 0,
    manualReviewRequired: false,
    requiresUserConfirmation: false,
    partialCloudWritePossible: false,
    highRiskWriteGated: true,
    safeToContinueLocalUse: true,
    safeToRefreshCaches: true,
    cacheRefreshStatus: "safe",
    cacheRefreshBlockedBy: [],
    syncCenterStatus: "idle",
  };
}

function importSuccessStatusFields(calendar: ImportCalendarRefreshFieldsInput) {
  return {
    operation: "import_meeting_artifact",
    importCompletionStatus: "completed",
    calendarRefreshStatus: calendar.requiresMetadataRefresh
      ? "metadata_refresh_required"
      : "metadata_refresh_not_required",
    calendarRefreshNextAction: calendar.requiresMetadataRefresh
      ? "refresh_calendar_metadata"
      : "none",
    calendarVisibilityStatus:
      calendar.dailyCalendarVisible && calendar.meetingCalendarVisible
        ? "visible_after_metadata_refresh"
        : "metadata_refresh_required",
    cloudWriteAttempted: true,
    calendarWriteAttempted: true,
  };
}

function importFailureVisibilityFields({
  retryable,
  manualReviewRequired,
  partialCloudWritePossible,
  failureStatus,
}: {
  retryable: boolean;
  manualReviewRequired: boolean;
  partialCloudWritePossible: boolean;
  failureStatus: string;
}) {
  const cacheRefresh = importFailureCacheRefreshFields({
    retryable,
    manualReviewRequired,
    partialCloudWritePossible,
  });
  return {
    importStatus: failureStatus,
    pendingWriteCount: partialCloudWritePossible ? 1 : 0,
    failedWriteCount:
      !partialCloudWritePossible && !manualReviewRequired ? 1 : 0,
    localPendingWrite: false,
    pendingImportCount: partialCloudWritePossible ? 1 : 0,
    failedImportCount:
      !partialCloudWritePossible && !manualReviewRequired ? 1 : 0,
    manualReviewImportCount: manualReviewRequired ? 1 : 0,
    safeToContinueLocalUse: true,
    ...cacheRefresh,
    syncCenterStatus: importFailureSyncCenterStatus({
      retryable,
      manualReviewRequired,
      partialCloudWritePossible,
    }),
  };
}

function importFailureStatusFields({
  manualReviewRequired,
  partialCloudWritePossible,
  failureStatus,
  nextAction,
}: {
  manualReviewRequired: boolean;
  partialCloudWritePossible: boolean;
  failureStatus: string;
  nextAction: string;
}) {
  return {
    operation: "import_meeting_artifact",
    importCompletionStatus: failureStatus,
    calendarRefreshStatus: manualReviewRequired
      ? "blocked_manual_review"
      : partialCloudWritePossible
        ? "blocked_retryable_unknown"
        : "not_started",
    calendarRefreshNextAction: nextAction,
    calendarVisibilityStatus: manualReviewRequired
      ? "unknown_manual_review_required"
      : partialCloudWritePossible
        ? "unknown_retryable"
        : "not_visible_import_failed",
    cloudWriteAttempted: partialCloudWritePossible,
    calendarWriteAttempted: partialCloudWritePossible,
  };
}

function importFailureSyncCenterStatus({
  retryable,
  manualReviewRequired,
  partialCloudWritePossible,
}: {
  retryable: boolean;
  manualReviewRequired: boolean;
  partialCloudWritePossible: boolean;
}) {
  if (manualReviewRequired) return "manual_review_required";
  if (partialCloudWritePossible) return "retryable_unknown";
  if (retryable) return "retry_later";
  return "failed_not_completed";
}

function importFailureCacheRefreshFields({
  retryable,
  manualReviewRequired,
  partialCloudWritePossible,
}: {
  retryable: boolean;
  manualReviewRequired: boolean;
  partialCloudWritePossible: boolean;
}) {
  const cacheRefreshBlockedBy = [
    ...(manualReviewRequired ? ["manual_review_required"] : []),
    ...(partialCloudWritePossible ? ["partial_cloud_write_possible"] : []),
    ...(retryable ? ["retry_later"] : []),
    ...(!retryable && !manualReviewRequired && !partialCloudWritePossible
      ? ["failed_not_completed"]
      : []),
  ];
  return {
    safeToRefreshCaches: false,
    cacheRefreshStatus: importFailureCacheRefreshStatus({
      retryable,
      manualReviewRequired,
      partialCloudWritePossible,
    }),
    cacheRefreshBlockedBy,
  };
}

function importFailureCacheRefreshStatus({
  retryable,
  manualReviewRequired,
  partialCloudWritePossible,
}: {
  retryable: boolean;
  manualReviewRequired: boolean;
  partialCloudWritePossible: boolean;
}) {
  if (manualReviewRequired) return "blocked_manual_review";
  if (partialCloudWritePossible) return "blocked_retryable_unknown";
  if (retryable) return "blocked_retry_later";
  return "blocked_failed_not_completed";
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

  const bodyRead = await readBoundedJsonBody(request, MAX_IMPORT_REQUEST_BYTES);
  if (!bodyRead.ok) {
    if (bodyRead.reason === "payload_too_large") {
      return importPayloadTooLarge();
    }
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
    const result = await importMeetingArtifactToPages(config.kv, bodyRead.value);
    const importReceiptTiming = importReceiptTimingFields(
      result.importReceipt
    );
    const calendarRefresh = importCalendarRefreshFields(result.calendar);
    const importStatus = importSuccessStatusFields(result.calendar);
    return importJson({
      ok: true,
      id: result.importId,
      status: "imported",
      nextAction: "refresh_calendar_metadata",
      syncStatus: "cloud_page_index_updated",
      cloudWriteStatus: "completed",
      calendarWriteStatus: "completed",
      ...importStatus,
      ...importSuccessClearanceFields(),
      ...calendarRefresh,
      ...importReceiptTiming,
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
  const partialCloudWritePossible = retryable && !manualReviewRequired;
  const visibilityFields = importFailureVisibilityFields({
    retryable,
    manualReviewRequired,
    partialCloudWritePossible,
    failureStatus,
  });
  const importStatus = importFailureStatusFields({
    manualReviewRequired,
    partialCloudWritePossible,
    failureStatus,
    nextAction,
  });
  const failureReceipt = importFailureReceipt({
    code,
    retryable,
    manualReviewRequired,
    writeStatus,
    syncStatus,
    failureStatus,
    nextAction,
    partialCloudWritePossible,
  });
  const receiptTiming = importReceiptTimingFields(failureReceipt);

  return {
    ok: false,
    ...importStatus,
    code,
    error,
    retryable,
    details,
    syncStatus,
    cloudWriteStatus: writeStatus,
    calendarWriteStatus: writeStatus,
    partialCloudWritePossible,
    requiresUserConfirmation: manualReviewRequired,
    highRiskWriteGated: true,
    failureStatus,
    manualReviewRequired,
    ...visibilityFields,
    nextAction,
    ...receiptTiming,
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
  partialCloudWritePossible,
}: {
  code: string;
  retryable: boolean;
  manualReviewRequired: boolean;
  writeStatus: string;
  syncStatus: string;
  failureStatus: string;
  nextAction: string;
  partialCloudWritePossible: boolean;
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
    partialCloudWritePossible,
    requiresUserConfirmation: manualReviewRequired,
    manualReviewRequired,
    highRiskWriteGated: true,
    ...importFailureVisibilityFields({
      retryable,
      manualReviewRequired,
      partialCloudWritePossible,
      failureStatus,
    }),
    nextAction,
    localUseCanContinue: true,
    accountSessionUnaffected: true,
    rawMeetingContentEchoed: false,
    metadataOnly: true,
  };
}
