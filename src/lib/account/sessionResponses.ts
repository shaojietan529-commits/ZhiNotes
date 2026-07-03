import { NextResponse } from "next/server";

export const ACCOUNT_SESSION_UNCONFIRMED_REASON = "session-unconfirmed";
export const ACCOUNT_SESSION_UNCONFIRMED_MESSAGE =
  "登录状态暂时无法确认；不会清除当前登录，请稍后重试。";

export interface AccountSessionUnconfirmedPayload {
  error: string;
  reason: typeof ACCOUNT_SESSION_UNCONFIRMED_REASON;
  retryable: true;
  keeps_session_cookie: true;
}

export function accountSessionUnconfirmedPayload(
  message: string = ACCOUNT_SESSION_UNCONFIRMED_MESSAGE
): AccountSessionUnconfirmedPayload {
  return {
    error: message,
    reason: ACCOUNT_SESSION_UNCONFIRMED_REASON,
    retryable: true,
    keeps_session_cookie: true,
  };
}

export function accountSessionUnconfirmedResponse(
  message: string = ACCOUNT_SESSION_UNCONFIRMED_MESSAGE
): NextResponse {
  return NextResponse.json(accountSessionUnconfirmedPayload(message), {
    status: 503,
  });
}
