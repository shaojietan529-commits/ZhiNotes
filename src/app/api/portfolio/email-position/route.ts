import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Owner-gated email-to-portfolio relay. Reads the latest position report
// attachment from the configured mailbox and returns the file bytes to the
// browser, where parsing and storage happen locally. Nothing is persisted
// server-side; tokens and message bodies are never logged.

const ALLOWED_SENDER = "rtan@keystone-investors.com";
const FILENAME_KEYWORD = "roger pos";
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
const GRAPH = "https://graph.microsoft.com/v1.0";
const PORTFOLIO_EMAIL_POSITION_REQUEST_TIMEOUT_MS = 8000;

class PortfolioEmailPositionRequestTimeoutError extends Error {
  status = 504;
  timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`Portfolio email position request timed out after ${timeoutMs}ms`);
    this.name = "PortfolioEmailPositionRequestTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

async function fetchPortfolioEmailPositionRequestWithTimeout(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1]
): Promise<Response> {
  const controller = new AbortController();
  let didTimeout = false;
  const timeout = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, PORTFOLIO_EMAIL_POSITION_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (didTimeout) {
      throw new PortfolioEmailPositionRequestTimeoutError(
        PORTFOLIO_EMAIL_POSITION_REQUEST_TIMEOUT_MS
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function portfolioEmailPositionTimeoutResponse(timeoutMs: number) {
  return NextResponse.json(
    {
      error: "portfolio-email-position-timeout",
      message: "组合邮件导入请求超时；本地组合数据不受影响，可稍后重试。",
      timeout_ms: timeoutMs,
    },
    { status: 504 }
  );
}

async function getAccessToken(): Promise<
  | { token: string }
  | { error: "unconfigured" | "auth_failed" }
  | { error: "timeout"; timeoutMs: number }
> {
  const clientId = process.env.MS_GRAPH_CLIENT_ID;
  const refreshToken = process.env.MS_GRAPH_REFRESH_TOKEN;
  if (!clientId || !refreshToken) return { error: "unconfigured" };

  let res: Response;
  try {
    res = await fetchPortfolioEmailPositionRequestWithTimeout(
      "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          scope: "https://graph.microsoft.com/Mail.Read offline_access",
        }),
        cache: "no-store",
      }
    );
  } catch (error) {
    if (error instanceof PortfolioEmailPositionRequestTimeoutError) {
      return { error: "timeout", timeoutMs: error.timeoutMs };
    }
    throw error;
  }
  if (!res.ok) return { error: "auth_failed" };
  const data = await res.json();
  if (typeof data.access_token !== "string") return { error: "auth_failed" };
  return { token: data.access_token };
}

interface GraphMessage {
  id: string;
  receivedDateTime: string;
  hasAttachments: boolean;
}

interface GraphAttachmentMeta {
  id: string;
  name?: string;
  size?: number;
  "@odata.type"?: string;
}

function isPositionFileName(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes(FILENAME_KEYWORD) &&
    (lower.endsWith(".xls") || lower.endsWith(".xlsx"))
  );
}

export async function GET() {
  const auth = await getAccessToken();
  if ("error" in auth) {
    if (auth.error === "unconfigured") {
      return NextResponse.json(
        { error: "email integration not configured" },
        { status: 501 }
      );
    }
    if (auth.error === "timeout") {
      return portfolioEmailPositionTimeoutResponse(auth.timeoutMs);
    }
    return NextResponse.json(
      { error: "邮箱授权已失效，请重新生成 refresh token 并更新环境变量。" },
      { status: 502 }
    );
  }

  const headers = { authorization: `Bearer ${auth.token}` };

  // Graph requires $orderby properties to also appear in $filter.
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const filter = `receivedDateTime ge ${since} and from/emailAddress/address eq '${ALLOWED_SENDER}'`;
  const listUrl =
    `${GRAPH}/me/messages?$filter=${encodeURIComponent(filter)}` +
    `&$orderby=receivedDateTime%20desc&$top=20` +
    `&$select=id,receivedDateTime,hasAttachments`;

  let listRes: Response;
  try {
    listRes = await fetchPortfolioEmailPositionRequestWithTimeout(listUrl, {
      headers,
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof PortfolioEmailPositionRequestTimeoutError) {
      return portfolioEmailPositionTimeoutResponse(error.timeoutMs);
    }
    throw error;
  }
  if (!listRes.ok) {
    return NextResponse.json(
      { error: "读取邮箱失败，请稍后重试。" },
      { status: 502 }
    );
  }
  const listData = await listRes.json();
  const messages: GraphMessage[] = Array.isArray(listData.value)
    ? listData.value
    : [];

  for (const message of messages) {
    if (!message.hasAttachments) continue;

    let metaRes: Response;
    try {
      metaRes = await fetchPortfolioEmailPositionRequestWithTimeout(
        `${GRAPH}/me/messages/${message.id}/attachments?$select=id,name,size`,
        { headers, cache: "no-store" }
      );
    } catch (error) {
      if (error instanceof PortfolioEmailPositionRequestTimeoutError) {
        return portfolioEmailPositionTimeoutResponse(error.timeoutMs);
      }
      throw error;
    }
    if (!metaRes.ok) continue;
    const metaData = await metaRes.json();
    const attachments: GraphAttachmentMeta[] = Array.isArray(metaData.value)
      ? metaData.value
      : [];

    const target = attachments.find(
      (att) =>
        typeof att.name === "string" &&
        isPositionFileName(att.name) &&
        (att.size ?? 0) <= MAX_ATTACHMENT_BYTES
    );
    if (!target) continue;

    let fileRes: Response;
    try {
      fileRes = await fetchPortfolioEmailPositionRequestWithTimeout(
        `${GRAPH}/me/messages/${message.id}/attachments/${target.id}`,
        { headers, cache: "no-store" }
      );
    } catch (error) {
      if (error instanceof PortfolioEmailPositionRequestTimeoutError) {
        return portfolioEmailPositionTimeoutResponse(error.timeoutMs);
      }
      throw error;
    }
    if (!fileRes.ok) continue;
    const fileData = await fileRes.json();
    if (typeof fileData.contentBytes !== "string") continue;

    return NextResponse.json({
      found: true,
      messageId: message.id,
      fileName: target.name,
      receivedAt: message.receivedDateTime,
      contentBase64: fileData.contentBytes,
    });
  }

  return NextResponse.json({ found: false });
}
