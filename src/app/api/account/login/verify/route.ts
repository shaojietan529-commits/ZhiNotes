import { NextResponse } from "next/server";
import { maskEmail } from "@/lib/cloud/api";
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  accountDisplayName,
  accountMissingEnv,
  getAccountConfig,
  normalizeEmail,
  verifyLoginCode,
} from "@/lib/account/server";

export const dynamic = "force-dynamic";

// Step 2 of email-code login: exchange the 6-digit code for a long-lived
// httpOnly session cookie (90 days, slides forward on activity).
export async function POST(request: Request) {
  const config = getAccountConfig();
  if (!config) {
    return NextResponse.json(
      {
        error: "account system not configured",
        missing_env: accountMissingEnv(),
      },
      { status: 501 }
    );
  }

  let body: { email?: unknown; code?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const email = normalizeEmail(body.email);
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!email || !/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { error: "请输入邮箱和 6 位数字验证码。" },
      { status: 400 }
    );
  }

  try {
    const result = await verifyLoginCode(config, email, code);
    if (result.status === "expired") {
      return NextResponse.json(
        { error: "验证码已过期，请重新获取。" },
        { status: 403 }
      );
    }
    if (result.status === "too-many-attempts") {
      return NextResponse.json(
        { error: "尝试次数过多，请重新获取验证码。" },
        { status: 403 }
      );
    }
    if (result.status === "invalid-code") {
      return NextResponse.json({ error: "验证码不正确。" }, { status: 403 });
    }

    const response = NextResponse.json({
      status: "signed-in",
      account: {
        id: result.account.id,
        email_hint: maskEmail(result.account.email),
        display_name: accountDisplayName(result.account),
        createdAt: result.account.createdAt,
      },
    });
    response.cookies.set(SESSION_COOKIE_NAME, result.sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });
    return response;
  } catch {
    return NextResponse.json(
      { error: "云端存储读写失败，请稍后重试。" },
      { status: 502 }
    );
  }
}
