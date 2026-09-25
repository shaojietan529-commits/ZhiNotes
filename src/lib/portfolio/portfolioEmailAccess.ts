import { NextResponse } from "next/server";
import { getAccountIdentityConfig, getSessionAccount, normalizeEmail, readSessionToken } from "@/lib/account/server";
import { accountSessionUnconfirmedResponse } from "@/lib/account/sessionResponses";

// The configured Graph mailbox is a single-owner integration, not an account
// mailbox. Never infer its owner from the first member of the login allowlist.
export async function requirePortfolioEmailOwner(request: Request) {
  const config = getAccountIdentityConfig();
  const owner = normalizeEmail(process.env.ZHINOTES_PORTFOLIO_EMAIL_OWNER_EMAIL);
  if (!config || !owner || !config.allowedEmails.has(owner)) {
    return { response: NextResponse.json({ code: "email-owner-unconfigured", error: "邮箱所属账号尚未配置，请联系管理员；手动导入不受影响。" }, { status: 501 }) };
  }
  const token = readSessionToken(request);
  if (!token) return { response: NextResponse.json({ error: "请先登录。" }, { status: 401 }) };
  try {
    const account = await getSessionAccount(config, token);
    if (!account) return { response: accountSessionUnconfirmedResponse() };
    const expected = request.headers.get("x-zhinote-account-id");
    if (!expected) return { response: NextResponse.json({ code: "account-refresh-required", error: "请刷新页面后重新确认邮箱所属账号。" }, { status: 428 }) };
    if (expected !== account.id) return { response: NextResponse.json({ code: "account-changed", error: "登录账号已改变，未读取邮箱。" }, { status: 409 }) };
    if (normalizeEmail(account.email) !== owner) {
      return { response: NextResponse.json({ error: "当前账号无权访问此持仓邮箱。" }, { status: 403 }) };
    }
    return { account };
  } catch {
    return { response: accountSessionUnconfirmedResponse() };
  }
}
