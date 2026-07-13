import { NextResponse } from "next/server";
import {
  extractFirstMeetingUrl,
  parseMeetingInviteInput,
  type FetchedMeetingLinkText,
} from "@/lib/meetings/meetingInviteIntake";
import { readBoundedJsonBody } from "@/lib/meetings/requestBody";

export const dynamic = "force-dynamic";

const MAX_INTAKE_REQUEST_BYTES = 128 * 1024;
const MAX_INPUT_CHARS = 20_000;
const MAX_FETCH_BYTES = 350_000;
const MAX_FETCH_CHARS = 250_000;
const FETCH_TIMEOUT_MS = 5_000;
const INTAKE_RECEIPT_FRESHNESS_WINDOW_MS = 30_000;
const intakeFailureBoundary = {
  source: "zhihui-meeting-intake",
  accountSessionUnaffected: true,
  localUseCanContinue: true,
  localMeetingDataUnaffected: true,
  localCalendarDataUnaffected: true,
  syncStatus: "not_started",
  cloudWriteStatus: "not_started",
  calendarWriteStatus: "not_started",
  highRiskWriteGated: true,
  rawInviteEchoed: false,
  fetchedPageTextEchoed: false,
  rawMeetingCredentialsEchoed: false,
  payloadEchoedInReceipt: false,
  metadataOnly: true,
};
const intakeContinuityReceipt = {
  accountSessionUnaffected: true,
  localUseCanContinue: true,
  localMeetingDataUnaffected: true,
  localCalendarDataUnaffected: true,
  rawInviteEchoed: false,
  fetchedPageTextEchoed: false,
  rawMeetingCredentialsEchoed: false,
  payloadEchoedInReceipt: false,
};
const intakeReceiptBase = {
  schema: "zhinote.zhihui.intake.receipt.v1",
  source: "zhihui-meeting-intake",
  operation: "parse_meeting_invite",
  metadataOnly: true,
  cloudWriteStatus: "not_started",
  calendarWriteStatus: "not_started",
  localWriteStatus: "not_started",
  highRiskWriteGated: true,
  ...intakeContinuityReceipt,
};

function intakeJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

function intakeRequestTooLarge() {
  return intakeJson(
    intakeFailurePayload({
      code: "meeting_intake_input_too_large",
      error: "会议邀请内容太长，请删掉无关正文后再导入。",
      retryable: false,
      details: {
        max_chars: MAX_INPUT_CHARS,
        max_request_bytes: MAX_INTAKE_REQUEST_BYTES,
      },
    }),
    { status: 413 }
  );
}

function intakeReceiptFreshness(now = new Date()) {
  return {
    receiptGeneratedAt: now.toISOString(),
    receiptStaleAfter: new Date(
      now.getTime() + INTAKE_RECEIPT_FRESHNESS_WINDOW_MS
    ).toISOString(),
    receiptFreshnessWindowMs: INTAKE_RECEIPT_FRESHNESS_WINDOW_MS,
  };
}

type IntakeReceiptTimingFieldsInput = {
  receiptGeneratedAt: string;
  receiptStaleAfter: string;
  receiptFreshnessWindowMs: number;
};

function intakeReceiptTimingFields(receipt: IntakeReceiptTimingFieldsInput) {
  return {
    receiptGeneratedAt: receipt.receiptGeneratedAt,
    receiptStaleAfter: receipt.receiptStaleAfter,
    receiptFreshnessWindowMs: receipt.receiptFreshnessWindowMs,
  };
}

function intakeReviewVisibilityFields() {
  return {
    pendingIntakeReviewCount: 1,
    failedIntakeCount: 0,
    manualReviewIntakeCount: 0,
    safeToRefreshCaches: false,
    syncCenterStatus: "local_review_required",
  };
}

function intakeFailureVisibilityFields({
  retryable,
  manualReviewRequired,
}: {
  retryable: boolean;
  manualReviewRequired: boolean;
}) {
  return {
    pendingIntakeReviewCount: 0,
    failedIntakeCount: manualReviewRequired ? 0 : 1,
    manualReviewIntakeCount: manualReviewRequired ? 1 : 0,
    safeToRefreshCaches: false,
    syncCenterStatus: intakeFailureSyncCenterStatus({
      retryable,
      manualReviewRequired,
    }),
  };
}

function intakeFailureSyncCenterStatus({
  retryable,
  manualReviewRequired,
}: {
  retryable: boolean;
  manualReviewRequired: boolean;
}) {
  if (manualReviewRequired) return "manual_review_required";
  if (retryable) return "retry_later";
  return "failed_not_completed";
}

export async function POST(req: Request) {
  const bodyRead = await readBoundedJsonBody(req, MAX_INTAKE_REQUEST_BYTES);
  if (!bodyRead.ok) {
    if (bodyRead.reason === "payload_too_large") {
      return intakeRequestTooLarge();
    }
    return intakeJson(
      intakeFailurePayload({
        code: "invalid_json",
        error: "invalid JSON",
        retryable: false,
      }),
      { status: 400 }
    );
  }
  const body =
    bodyRead.value && typeof bodyRead.value === "object"
      ? (bodyRead.value as { input?: unknown })
      : {};

  const input = typeof body.input === "string" ? body.input.trim() : "";
  if (!input) {
    return intakeJson(
      intakeFailurePayload({
        code: "meeting_intake_empty_input",
        error: "请输入会议邀请或入会链接。",
        retryable: false,
      }),
      { status: 400 }
    );
  }
  if (input.length > MAX_INPUT_CHARS) {
    return intakeJson(
      intakeFailurePayload({
        code: "meeting_intake_input_too_large",
        error: "会议邀请内容太长，请删掉无关正文后再导入。",
        retryable: false,
        details: { max_chars: MAX_INPUT_CHARS },
      }),
      { status: 413 }
    );
  }

  const url = extractFirstMeetingUrl(input);
  let fetched: FetchedMeetingLinkText | null = null;
  let fetchWarning = "";

  if (url) {
    const fetchResult = await fetchMeetingLinkText(url);
    if ("fetched" in fetchResult) {
      fetched = fetchResult.fetched;
    } else {
      fetchWarning = fetchResult.warning;
    }
  }

  const parsed = parseMeetingInviteInput(input, fetched);
  if (fetchWarning) parsed.meeting.warnings.push(fetchWarning);
  const intakeReceipt = intakeSuccessReceipt({
    fetched: Boolean(fetched),
    fetchAttempted: Boolean(url),
    warningCount: parsed.meeting.warnings.length,
    confidence: parsed.meeting.confidence,
    returnsJoinUrlForCalendarStorage: Boolean(parsed.meeting.joinUrl),
    returnsMeetingPasscodeForCalendarStorage: Boolean(
      parsed.meeting.passcode
    ),
  });

  return intakeJson({
    ok: true,
    meeting: parsed.meeting,
    fetched: Boolean(fetched),
    status: "parsed",
    nextAction: "review_and_save_to_calendar",
    syncStatus: "local_review_required",
    cloudWriteStatus: "not_started",
    calendarWriteStatus: "not_started",
    requiresUserConfirmation: true,
    manualReviewRequired: false,
    parseStatus: intakeReceipt.parseStatus,
    fetchedPageReadStatus: intakeReceipt.fetchedPageReadStatus,
    warningCount: intakeReceipt.warningCount,
    confidence: intakeReceipt.confidence,
    pendingWriteCount: 0,
    failedWriteCount: 0,
    localPendingWrite: false,
    safeToContinueLocalUse: true,
    highRiskWriteGated: true,
    ...intakeReviewVisibilityFields(),
    ...intakeReceiptTimingFields(intakeReceipt),
    intakeReceipt,
    ...intakeContinuityReceipt,
    privacy: {
      storesRawInvite: false,
      rawInviteEchoed: false,
      fetchedPageTextEchoed: false,
      rawMeetingCredentialsEchoed: false,
      payloadEchoedInReceipt: false,
      returnsJoinUrlForCalendarStorage: Boolean(parsed.meeting.joinUrl),
      returnsMeetingPasscodeForCalendarStorage: Boolean(parsed.meeting.passcode),
    },
  });
}

function intakeFailurePayload({
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
  const intakeReceipt = intakeFailureReceipt({
    code,
    retryable,
    manualReviewRequired,
  });
  const visibilityFields = intakeFailureVisibilityFields({
    retryable,
    manualReviewRequired,
  });
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
    requiresUserConfirmation: manualReviewRequired,
    parseStatus: intakeReceipt.parseStatus,
    pendingWriteCount: 0,
    failedWriteCount: 0,
    localPendingWrite: false,
    safeToContinueLocalUse: true,
    ...visibilityFields,
    nextAction: manualReviewRequired
      ? "manual_review"
      : retryable
        ? "retry"
        : "fix_input_or_configuration",
    ...intakeReceiptTimingFields(intakeReceipt),
    ...intakeFailureBoundary,
    intakeReceipt,
  };
}

function intakeSuccessReceipt({
  fetched,
  fetchAttempted,
  warningCount,
  confidence,
  returnsJoinUrlForCalendarStorage,
  returnsMeetingPasscodeForCalendarStorage,
}: {
  fetched: boolean;
  fetchAttempted: boolean;
  warningCount: number;
  confidence: string;
  returnsJoinUrlForCalendarStorage: boolean;
  returnsMeetingPasscodeForCalendarStorage: boolean;
}) {
  return {
    ...intakeReceiptBase,
    ...intakeReceiptFreshness(),
    parseStatus: "completed",
    syncStatus: "local_review_required",
    fetchedPageReadStatus: fetched
      ? "completed"
      : fetchAttempted
        ? "skipped_or_failed_warning"
        : "not_started",
    warningCount,
    confidence,
    requiresUserConfirmation: true,
    nextAction: "review_and_save_to_calendar",
    returnsJoinUrlForCalendarStorage,
    returnsMeetingPasscodeForCalendarStorage,
    ...intakeReviewVisibilityFields(),
  };
}

function intakeFailureReceipt({
  code,
  retryable,
  manualReviewRequired,
}: {
  code: string;
  retryable: boolean;
  manualReviewRequired: boolean;
}) {
  return {
    ...intakeReceiptBase,
    ...intakeReceiptFreshness(),
    parseStatus: manualReviewRequired
      ? "manual_review_required"
      : retryable
        ? "failed_retryable"
        : "failed_final",
    syncStatus: "not_started",
    failureCode: code,
    retryable,
    manualReviewRequired,
    requiresUserConfirmation: manualReviewRequired,
    nextAction: manualReviewRequired
      ? "manual_review"
      : retryable
        ? "retry"
        : "fix_input_or_configuration",
    ...intakeFailureVisibilityFields({
      retryable,
      manualReviewRequired,
    }),
  };
}

async function fetchMeetingLinkText(
  urlValue: string
): Promise<{ fetched: FetchedMeetingLinkText } | { warning: string }> {
  const parsed = parsePublicHttpUrl(urlValue);
  if (!parsed) {
    return { warning: "链接不是可读取的公开 http/https 地址，已跳过网页读取。" };
  }
  if (isBlockedHost(parsed.hostname)) {
    return { warning: "链接指向本机或内网地址，出于安全原因已跳过网页读取。" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(parsed.toString(), {
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        accept: "text/html,text/plain;q=0.9,*/*;q=0.2",
        "user-agent": "ZhiHui-Meeting-Intake/1.0",
      },
    });

    if (!res.ok) {
      return { warning: "链接页面暂时无法读取，已优先使用粘贴内容解析。" };
    }

    const contentType = res.headers.get("content-type")?.toLowerCase() ?? "";
    if (
      contentType &&
      !contentType.includes("text/html") &&
      !contentType.includes("text/plain")
    ) {
      return { warning: "链接返回的不是网页文本，已跳过网页读取。" };
    }

    const contentLength = Number(res.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_FETCH_BYTES) {
      return { warning: "链接页面太大，已跳过网页读取，优先使用粘贴内容解析。" };
    }

    const pageText = await readBoundedResponseText(res, MAX_FETCH_BYTES);
    if (!pageText.ok) {
      return { warning: "链接页面太大，已跳过网页读取，优先使用粘贴内容解析。" };
    }

    const raw = pageText.text.slice(0, MAX_FETCH_CHARS);
    const extracted = extractReadablePageText(raw, contentType);
    return {
      fetched: {
        url: parsed.toString(),
        host: parsed.hostname,
        title: extracted.title,
        description: extracted.description,
        text: extracted.text,
      },
    };
  } catch {
    return { warning: "链接读取超时或失败，已优先使用粘贴内容解析。" };
  } finally {
    clearTimeout(timer);
  }
}

async function readBoundedResponseText(response: Response, maxBytes: number) {
  if (!response.body) {
    return { ok: true as const, text: "", bytesRead: 0 };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      bytesRead += value.byteLength;
      if (bytesRead > maxBytes) {
        await reader.cancel();
        return { ok: false as const, bytesRead };
      }

      text += decoder.decode(value, { stream: true });
    }

    text += decoder.decode();
    return { ok: true as const, text, bytesRead };
  } finally {
    reader.releaseLock();
  }
}

function parsePublicHttpUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

function isBlockedHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".local")) return true;
  if (host === "::1" || host.startsWith("fc") || host.startsWith("fd")) return true;

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;

  const parts = ipv4.slice(1).map(Number);
  if (parts.some((part) => part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function extractReadablePageText(raw: string, contentType: string) {
  if (!contentType.includes("text/html")) {
    return { title: "", description: "", text: normalizeForPrompt(raw) };
  }

  const title = decodeHtmlEntity(
    raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ""
  );
  const description = decodeHtmlEntity(
    raw.match(
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i
    )?.[1] ??
      raw.match(
        /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i
      )?.[1] ??
      ""
  );

  const text = normalizeForPrompt(
    decodeHtmlEntity(
      raw
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
        .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
        .replace(/<[^>]+>/g, " ")
    )
  );

  return { title: normalizeForPrompt(title), description, text };
}

function normalizeForPrompt(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 8_000);
}

function decodeHtmlEntity(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) => {
      const value = Number(code);
      return Number.isFinite(value) ? String.fromCodePoint(value) : "";
    });
}
