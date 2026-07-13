import { NextResponse } from "next/server";
import {
  authorizeMeetingAgent,
  getMeetingAgentQueueConfig,
} from "@/lib/meetings/agentQueue";
import { buildMeetingAgentQueueReceiptTiming } from "@/lib/meetings/agentQueueReceipts";
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

type GlossaryFailureNextAction =
  | "configure_environment"
  | "check_agent_token"
  | "retry";

function glossaryJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

export async function GET(request: Request) {
  const config = getMeetingAgentQueueConfig();
  if (config.status !== "ok") {
    return glossaryJson(
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
    return glossaryJson(
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
    return glossaryJson(payload);
  } catch {
    return glossaryJson(
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
  nextAction: GlossaryFailureNextAction;
  details?: Record<string, unknown> | null;
}) {
  const receiptTiming = buildMeetingAgentQueueReceiptTiming({
    pollMode: retryable ? "retry" : "none",
  });
  return {
    ok: false,
    code,
    error,
    retryable,
    details,
    syncStatus: retryable ? "glossary_failed_retryable" : "glossary_not_started",
    glossaryReadStatus: retryable ? "failed_retryable" : "not_started",
    syncCenterStatus: retryable
      ? "glossary_failed_retryable"
      : "glossary_not_started",
    pendingWriteCount: 0,
    failedWriteCount: 0,
    localPendingWrite: false,
    safeToContinueLocalUse: true,
    pendingGlossaryReadCount: 0,
    failedGlossaryReadCount: retryable ? 1 : 0,
    manualReviewGlossaryCount: 0,
    safeToRefreshCaches: true,
    cacheRefreshStatus: "safe",
    cacheRefreshBlockedBy: [],
    manualReviewRequired: false,
    requiresUserConfirmation: false,
    nextAction,
    ...receiptTiming,
    ...glossaryFailureRecoveryFields({ retryable, nextAction }),
    privacy: {
      raw_page_text_returned: false,
      raw_meeting_credentials_returned: false,
      terms_only: true,
    },
    ...glossaryFailureBoundary,
  };
}

function glossaryFailureRecoveryFields({
  retryable,
  nextAction,
}: {
  retryable: boolean;
  nextAction: GlossaryFailureNextAction;
}) {
  return {
    glossaryRecoveryRequired: true,
    glossaryRecoveryStatus: glossaryFailureRecoveryStatus({
      retryable,
      nextAction,
    }),
    glossaryRecoveryNextAction: nextAction,
  };
}

function glossaryFailureRecoveryStatus({
  retryable,
  nextAction,
}: {
  retryable: boolean;
  nextAction: GlossaryFailureNextAction;
}) {
  if (retryable) return "retry_later";
  if (nextAction === "configure_environment") return "configuration_required";
  if (nextAction === "check_agent_token") return "agent_token_required";
  return "failed_not_started";
}
