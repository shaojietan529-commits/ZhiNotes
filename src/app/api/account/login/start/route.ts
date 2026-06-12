import { NextResponse } from "next/server";
import { maskEmail } from "@/lib/cloud/api";
import {
  accountMissingEnv,
  getAccountConfig,
  normalizeEmail,
  sendLoginCode,
} from "@/lib/account/server";

export const dynamic = "force-dynamic";

// Step 1 of email-code login: send a 6-digit code to an allowlisted email.
// Inactive (501) until the owner configures Resend and the allowlist.
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

  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const email = normalizeEmail(body.email);
  if (!email) {
    return NextResponse.json({ error: "请输入有效邮箱。" }, { status: 400 });
  }

  try {
    const result = await sendLoginCode(config, email);
    if (result.status === "not-allowed") {
      // Same shape as a success so the endpoint doesn't reveal which
      // emails are on the allowlist; no code is actually sent.
      return NextResponse.json({ status: "sent", email_hint: maskEmail(email) });
    }
    if (result.status === "rate-limited") {
      return NextResponse.json(
        { error: "验证码发送太频繁，请 10 分钟后再试。" },
        { status: 429 }
      );
    }
    if (result.status === "email-failed") {
      return NextResponse.json(
        { error: "验证码邮件发送失败，请稍后重试。" },
        { status: 502 }
      );
    }
    return NextResponse.json({ status: "sent", email_hint: maskEmail(email) });
  } catch {
    return NextResponse.json(
      { error: "云端存储读写失败，请稍后重试。" },
      { status: 502 }
    );
  }
}
