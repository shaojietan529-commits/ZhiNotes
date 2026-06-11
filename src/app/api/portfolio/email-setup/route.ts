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
      return NextResponse.json(
        {
          error:
            "获取登录码失败，请检查 Client ID 是否正确、应用是否开启了 Allow public client flows。",
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
