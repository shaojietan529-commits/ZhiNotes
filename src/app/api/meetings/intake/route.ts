import { NextResponse } from "next/server";
import {
  extractFirstMeetingUrl,
  parseMeetingInviteInput,
  type FetchedMeetingLinkText,
} from "@/lib/meetings/meetingInviteIntake";

export const dynamic = "force-dynamic";

const MAX_INPUT_CHARS = 20_000;
const MAX_FETCH_CHARS = 250_000;
const FETCH_TIMEOUT_MS = 5_000;
const intakeFailureBoundary = {
  source: "zhihui-meeting-intake",
  accountSessionUnaffected: true,
  localUseCanContinue: true,
  localMeetingDataUnaffected: true,
  localCalendarDataUnaffected: true,
  rawInviteEchoed: false,
  fetchedPageTextEchoed: false,
};
const intakeContinuityReceipt = {
  accountSessionUnaffected: true,
  localUseCanContinue: true,
  localMeetingDataUnaffected: true,
  localCalendarDataUnaffected: true,
  rawInviteEchoed: false,
  fetchedPageTextEchoed: false,
};

export async function POST(req: Request) {
  let body: { input?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      intakeFailurePayload({
        code: "invalid_json",
        error: "invalid JSON",
        retryable: false,
      }),
      { status: 400 }
    );
  }

  const input = typeof body.input === "string" ? body.input.trim() : "";
  if (!input) {
    return NextResponse.json(
      intakeFailurePayload({
        code: "meeting_intake_empty_input",
        error: "请输入会议邀请或入会链接。",
        retryable: false,
      }),
      { status: 400 }
    );
  }
  if (input.length > MAX_INPUT_CHARS) {
    return NextResponse.json(
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

  return NextResponse.json({
    meeting: parsed.meeting,
    fetched: Boolean(fetched),
    status: "parsed",
    nextAction: "review_and_save_to_calendar",
    ...intakeContinuityReceipt,
    privacy: {
      storesRawInvite: false,
      rawInviteEchoed: false,
      fetchedPageTextEchoed: false,
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
    ...intakeFailureBoundary,
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

    const raw = (await res.text()).slice(0, MAX_FETCH_CHARS);
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
