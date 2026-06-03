import { NextResponse } from "next/server";
import { requestSupabaseAuth } from "@/lib/cloud/supabaseRest";
import {
  badRequestResponse,
  cloudNotConfiguredResponse,
  maskEmail,
  requireCloudWritesResponse,
  supabaseErrorResponse,
} from "@/lib/cloud/api";
import { getZhiNotesCloudConfig, isAllowedAuthRedirect } from "@/lib/cloud/config";

export const dynamic = "force-dynamic";

interface LoginStartBody {
  email?: unknown;
  redirectTo?: unknown;
}

export async function POST(request: Request) {
  const disabled = cloudNotConfiguredResponse("auth-login-start");
  if (disabled) return disabled;

  const writesDisabled = requireCloudWritesResponse("auth-login-start");
  if (writesDisabled) return writesDisabled;

  let body: LoginStartBody;
  try {
    body = (await request.json()) as LoginStartBody;
  } catch {
    return badRequestResponse("请求体需要是 JSON。");
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!isValidEmail(email)) {
    return badRequestResponse("请输入有效邮箱。");
  }

  const config = getZhiNotesCloudConfig();
  const redirectTo =
    typeof body.redirectTo === "string" && body.redirectTo.trim()
      ? body.redirectTo.trim()
      : `${config.appUrl.replace(/\/+$/, "")}/auth/callback`;

  if (!isAllowedAuthRedirect(redirectTo)) {
    return badRequestResponse("登录跳转地址不在允许列表里。");
  }

  try {
    const path = `/otp?redirect_to=${encodeURIComponent(redirectTo)}`;
    await requestSupabaseAuth(path, {
      method: "POST",
      body: JSON.stringify({
        email,
        create_user: true,
      }),
    });

    return NextResponse.json({
      format: "zhinote-cloud-auth-login-start",
      status: "magic-link-requested",
      email_hint: maskEmail(email),
      redirect_to: redirectTo,
      privacy_note:
        "邮箱只会发送给已配置的 Supabase Auth，用于 private alpha 登录；不会读取或上传本地笔记、文件或数据库。",
    });
  } catch (error) {
    return supabaseErrorResponse(error);
  }
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
