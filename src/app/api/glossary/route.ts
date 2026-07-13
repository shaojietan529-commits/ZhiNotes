import { NextResponse } from "next/server";
import {
  authorizeMeetingAgent,
  getMeetingAgentQueueConfig,
} from "@/lib/meetings/agentQueue";
import { buildZhiHuiGlossary } from "@/lib/meetings/glossary";

export const dynamic = "force-dynamic";

const glossaryFailureBoundary = {
  source: "zhihui-glossary",
  accountSessionUnaffected: true,
  localUseCanContinue: true,
  localMeetingDataUnaffected: true,
  cloudWriteStatus: "not_started",
  localCacheWriteStatus: "not_started",
  rawPageTextEchoed: false,
  rawMeetingCredentialsEchoed: false,
  termsReturned: false,
  highRiskWriteGated: true,
};

export async function GET(request: Request) {
  const config = getMeetingAgentQueueConfig();
  if (config.status !== "ok") {
    return NextResponse.json(
      glossaryFailurePayload({
        code: "zhihui_glossary_not_configured",
        error: "ZhiHui agent glossary not configured",
        retryable: false,
        nextAction: "configure_environment",
        details: { missing_env: config.missing },
      }),
      { status: 501 }
    );
  }
  if (!authorizeMeetingAgent(request, config.agentToken)) {
    return NextResponse.json(
      glossaryFailurePayload({
        code: "zhihui_agent_unauthorized",
        error: "unauthorized",
        retryable: false,
        nextAction: "check_agent_token",
      }),
      { status: 401 }
    );
  }

  try {
    const payload = await buildZhiHuiGlossary({
      kv: config.kv,
      requestUrl: new URL(request.url),
    });
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(
      glossaryFailurePayload({
        code: "zhihui_glossary_fetch_failed",
        error: "ZhiHui glossary fetch failed",
        retryable: true,
        nextAction: "retry",
      }),
      { status: 502 }
    );
  }
}

function glossaryFailurePayload({
  code,
  error,
  retryable,
  nextAction,
  details = null,
}: {
  code: string;
  error: string;
  retryable: boolean;
  nextAction: "configure_environment" | "check_agent_token" | "retry";
  details?: Record<string, unknown> | null;
}) {
  return {
    ok: false,
    code,
    error,
    retryable,
    details,
    syncStatus: retryable ? "glossary_failed_retryable" : "glossary_not_started",
    glossaryReadStatus: retryable ? "failed_retryable" : "not_started",
    manualReviewRequired: false,
    requiresUserConfirmation: false,
    nextAction,
    privacy: {
      raw_page_text_returned: false,
      raw_meeting_credentials_returned: false,
      terms_only: true,
    },
    ...glossaryFailureBoundary,
  };
}
