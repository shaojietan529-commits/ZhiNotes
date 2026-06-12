import { NextResponse } from "next/server";
import { maskEmail } from "@/lib/cloud/api";
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  accountDisplayName,
  accountMissingEnv,
  getAccountConfig,
  getSessionAccount,
  normalizeDisplayName,
  readSessionToken,
  updateAccountDisplayName,
} from "@/lib/account/server";

export const dynamic = "force-dynamic";

// Who am I? Validates the session cookie and refreshes its 90-day expiry.
export async function GET(request: Request) {
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

  const token = readSessionToken(request);
  if (!token) {
    return NextResponse.json({ authenticated: false, account: null });
  }

  try {
    const account = await getSessionAccount(config, token);
    if (!account) {
      const response = NextResponse.json({
        authenticated: false,
        account: null,
      });
      response.cookies.delete(SESSION_COOKIE_NAME);
      return response;
    }
    const response = NextResponse.json({
      authenticated: true,
      account: {
        id: account.id,
        email_hint: maskEmail(account.email),
        display_name: accountDisplayName(account),
        createdAt: account.createdAt,
      },
    });
    // Slide the cookie expiry alongside the KV session expiry.
    response.cookies.set(SESSION_COOKIE_NAME, token, {
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

export async function PATCH(request: Request) {
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

  const token = readSessionToken(request);
  if (!token) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  let body: { display_name?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const displayName = normalizeDisplayName(body.display_name);
  if (!displayName) {
    return NextResponse.json(
      { error: "用户名不能为空，最多 32 个字符。" },
      { status: 400 }
    );
  }

  try {
    const account = await getSessionAccount(config, token);
    if (!account) {
      const response = NextResponse.json({ error: "登录已过期，请重新登录。" }, { status: 401 });
      response.cookies.delete(SESSION_COOKIE_NAME);
      return response;
    }

    const nextAccount = await updateAccountDisplayName(
      config,
      account,
      displayName
    );
    const response = NextResponse.json({
      status: "ok",
      account: {
        id: nextAccount.id,
        email_hint: maskEmail(nextAccount.email),
        display_name: accountDisplayName(nextAccount),
        createdAt: nextAccount.createdAt,
      },
    });
    response.cookies.set(SESSION_COOKIE_NAME, token, {
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
