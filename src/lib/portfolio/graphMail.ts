// Send mail from the configured ZhiNote mailbox via Microsoft Graph.
//
// The same mailbox that receives Roger's position reports (see
// /api/portfolio/email-position) is used to send rebalance instructions back
// out. Reading uses the Mail.Read scope; sending needs Mail.Send. If the stored
// refresh token was minted without Mail.Send, token acquisition for the send
// scope fails and the caller surfaces an actionable "re-authorize" message.
//
// Nothing is logged: tokens, recipients, and message bodies never hit logs.

const GRAPH = "https://graph.microsoft.com/v1.0";
const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

type TokenResult = { token: string } | { error: "unconfigured" | "auth_failed" };

async function getSendAccessToken(): Promise<TokenResult> {
  const clientId = process.env.MS_GRAPH_CLIENT_ID;
  const refreshToken = process.env.MS_GRAPH_REFRESH_TOKEN;
  if (!clientId || !refreshToken) return { error: "unconfigured" };

  const res = await fetch(
    "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        scope: "https://graph.microsoft.com/Mail.Send offline_access",
      }),
    }
  );
  if (!res.ok) return { error: "auth_failed" };
  const data = (await res.json().catch(() => ({}))) as {
    access_token?: unknown;
  };
  if (typeof data.access_token !== "string") return { error: "auth_failed" };
  return { token: data.access_token };
}

export interface SendMailAttachment {
  filename: string;
  contentBase64: string;
  contentType?: string;
}

export type SendMailResult =
  | { status: "sent" }
  | { status: "unconfigured" }
  | { status: "auth_failed" }
  | { status: "send_failed"; code: number };

export async function sendMailboxMessage(params: {
  to: string[];
  subject: string;
  text: string;
  attachments?: SendMailAttachment[];
}): Promise<SendMailResult> {
  const auth = await getSendAccessToken();
  if ("error" in auth) {
    return auth.error === "unconfigured"
      ? { status: "unconfigured" }
      : { status: "auth_failed" };
  }

  const message = {
    subject: params.subject,
    body: { contentType: "Text", content: params.text },
    toRecipients: params.to.map((address) => ({
      emailAddress: { address },
    })),
    attachments: (params.attachments ?? []).map((att) => ({
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: att.filename,
      contentType: att.contentType ?? XLSX_CONTENT_TYPE,
      contentBytes: att.contentBase64,
    })),
  };

  const res = await fetch(`${GRAPH}/me/sendMail`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${auth.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ message, saveToSentItems: true }),
  });

  if (res.status === 202 || res.ok) return { status: "sent" };
  if (res.status === 401 || res.status === 403) return { status: "auth_failed" };
  return { status: "send_failed", code: res.status };
}
