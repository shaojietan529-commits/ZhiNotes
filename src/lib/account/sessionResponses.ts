import { NextResponse } from "next/server";

export const ACCOUNT_SESSION_UNCONFIRMED_REASON = "session-unconfirmed";
export const ACCOUNT_SESSION_UNCONFIRMED_MESSAGE =
  "登录状态暂时无法确认；不会清除当前登录，请稍后重试。";
export const ACCOUNT_SESSION_UNCONFIRMED_RETRY_AFTER_SECONDS = 120;

export interface AccountSessionUnconfirmedPayload {
  error: string;
  reason: typeof ACCOUNT_SESSION_UNCONFIRMED_REASON;
  retry_after_seconds: typeof ACCOUNT_SESSION_UNCONFIRMED_RETRY_AFTER_SECONDS;
  retryable: true;
  keeps_session_cookie: true;
}

export function accountSessionUnconfirmedPayload(
  message: string = ACCOUNT_SESSION_UNCONFIRMED_MESSAGE
): AccountSessionUnconfirmedPayload {
  return {
    error: message,
    reason: ACCOUNT_SESSION_UNCONFIRMED_REASON,
    retry_after_seconds: ACCOUNT_SESSION_UNCONFIRMED_RETRY_AFTER_SECONDS,
    retryable: true,
    keeps_session_cookie: true,
  };
}

export function accountSessionUnconfirmedHeaders(): Record<string, string> {
  return {
    "Cache-Control": "no-store, max-age=0",
    "Retry-After": String(ACCOUNT_SESSION_UNCONFIRMED_RETRY_AFTER_SECONDS),
    "X-Zhinote-Keeps-Session-Cookie": "true",
    "X-Zhinote-Session-State": ACCOUNT_SESSION_UNCONFIRMED_REASON,
  };
}

export function accountSessionUnconfirmedResponse(
  message: string = ACCOUNT_SESSION_UNCONFIRMED_MESSAGE
): NextResponse {
  return NextResponse.json(accountSessionUnconfirmedPayload(message), {
    status: 503,
    headers: accountSessionUnconfirmedHeaders(),
  });
}
