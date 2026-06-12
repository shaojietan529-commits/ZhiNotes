import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Server proxy for Microsoft's device-code sign-in (the token endpoints do not
// allow browser CORS). Used only by the one-time email setup wizard. Tokens
// are returned to the owner's browser for manual copy — never stored or
// logged here.

const BASE = "https://login.microsoftonline.com/consumers/oauth2/v2.0";
const SCOPE = "https://graph.microsoft.com/Mail.Read offline_access";

export async function POST(req: Request) {
  let body: { action?: string; clientId?: string; deviceCode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const clientId =
    typeof body.clientId === "string" ? body.clientId.trim() : "";
  if (!clientId) {
    return NextResponse.json({ error: "缺少 Client ID" }, { status: 400 });
  }

  if (body.action === "start") {
    const res = await fetch(`${BASE}/devicecode`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, scope: SCOPE }),
    });
    const data = await res.json();
    if (typeof data.device_code !== "string") {
      // Surface Microsoft's own error code so the owner can tell apart a
      // wrong Client ID, a missing "Allow public client flows" toggle, or
      // an unsupported account type. Error codes are diagnostic only.
      const detail =
        typeof data.error_description === "string"
          ? data.error_description.split("\n")[0].split(" Trace ID")[0]
          : typeof data.error === "string"
            ? data.error
            : "";
      let hint =
        "请检查 Client ID 是否正确、应用是否开启了 Allow public client flows。";
      if (detail.includes("AADSTS700016")) {
        hint =
          "找不到这个应用。多半是注册时账户类型没有选 “Personal Microsoft accounts only”，或者应用刚注册还在生效中（等 2-3 分钟再试）。";
      } else if (detail.includes("AADSTS7000218")) {
        hint =
          "应用还没开启 Allow public client flows。去 portal.azure.com → 你的应用 → Authentication → 页面底部 Allow public client flows 切换为 Yes 并保存，然后重试。";
      } else if (detail.includes("AADSTS900023") || detail.includes("AADSTS90002")) {
        hint = "Client ID 格式不对或应用不存在，请重新复制 Application (client) ID。";
      }
      return NextResponse.json(
        {
          error: `获取登录码失败：${hint}`,
          detail,
        },
        { status: 502 }
      );
    }
    return NextResponse.json({
      verificationUri: data.verification_uri,
      userCode: data.user_code,
      deviceCode: data.device_code,
      interval: data.interval ?? 5,
      expiresIn: data.expires_in ?? 900,
    });
  }

  if (body.action === "poll") {
    const deviceCode =
      typeof body.deviceCode === "string" ? body.deviceCode : "";
    if (!deviceCode) {
      return NextResponse.json({ error: "缺少 device code" }, { status: 400 });
    }
    const res = await fetch(`${BASE}/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code: deviceCode,
      }),
    });
    const data = await res.json();
    if (typeof data.refresh_token === "string") {
      return NextResponse.json({
        status: "ok",
        refreshToken: data.refresh_token,
      });
    }
    if (data.error === "authorization_pending" || data.error === "slow_down") {
      return NextResponse.json({ status: "pending" });
    }
    return NextResponse.json({
      status: "error",
      error: data.error_description ?? data.error ?? "授权失败",
    });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
