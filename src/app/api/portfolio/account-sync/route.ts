import { NextResponse } from "next/server";
import {
  accountIdentityMissingEnv,
  getAccountIdentityConfig,
  getSessionAccount,
  kvGet,
  kvSet,
  normalizeEmail,
  readSessionToken,
  type AccountIdentityConfig,
} from "@/lib/account/server";
import { accountSessionUnconfirmedResponse } from "@/lib/account/sessionResponses";
import { portfolioCloudEnvelope, writeVersionedPortfolio } from "@/lib/portfolio/portfolioVersionedStore";
import {
  PORTFOLIO_ACCOUNT_DATA_KEY_PREFIX,
  PORTFOLIO_ACCOUNT_METADATA_KEY_PREFIX,
  PORTFOLIO_ACCOUNT_SHARED_WITH_KEY_PREFIX,
  PORTFOLIO_ACCOUNT_SHARE_KEY_PREFIX,
} from "@/lib/portfolio/accountSyncKeys";

export const dynamic = "force-dynamic";

// Account-scoped portfolio cloud sync. Each signed-in account owns one
// cloud copy keyed by its email, and can share read-only access with
// other allowlisted emails. Account and passcode routes share the same
// atomic versioned write boundary.

const MAX_SHARE_MEMBERS = 20;

async function readEmailList(
  config: AccountIdentityConfig,
  key: string
): Promise<string[]> {
  const raw = await kvGet(config.kv, key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string");
    }
  } catch {
    // corrupt list — treat as empty
  }
  return [];
}

async function writeEmailList(
  config: AccountIdentityConfig,
  key: string,
  list: string[]
): Promise<void> {
  await kvSet(config.kv, key, JSON.stringify(list));
}

export async function POST(request: Request) {
  const config = getAccountIdentityConfig();
  if (!config) {
    return NextResponse.json(
      {
        error: "account system not configured",
        missing_env: accountIdentityMissingEnv(),
      },
      { status: 501 }
    );
  }

  const token = readSessionToken(request);
  if (!token) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  let body: {
    action?: string;
    data?: unknown;
    email?: unknown;
    from?: unknown;
    protocol?: unknown;
    requestId?: unknown;
    base?: unknown;
    expectedAccountId?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  try {
    const account = await getSessionAccount(config, token);
    if (!account) {
      return accountSessionUnconfirmedResponse(
        "组合同步暂时无法确认账号；本地组合数据已保留，请稍后重试。"
      );
    }
    if (typeof body.expectedAccountId !== "string" || !body.expectedAccountId) {
      return NextResponse.json({ code: "account-refresh-required", error: "请刷新页面后重新确认组合同步账号。" }, { status: 428 });
    }
    if (body.expectedAccountId !== account.id) {
      // Reject before reading portfolio/share data, including an unbased push
      // into an empty account. A session cookie alone cannot identify intent.
      return NextResponse.json({ code: "account-changed", error: "登录账号已改变，未执行旧账号的组合请求。" }, { status: 409 });
    }
    const respond = (payload: Record<string, unknown>, status = 200) =>
      NextResponse.json({ ...payload, accountId: account.id }, { status });
    const me = account.email;

    if (body.action === "pull") {
      const from = normalizeEmail(body.from);
      if (from && from !== me) {
        // Reading someone else's portfolio requires being on their list.
        const members = await readEmailList(
          config,
          `${PORTFOLIO_ACCOUNT_SHARE_KEY_PREFIX}${from}`
        );
        if (!members.includes(me)) {
          return NextResponse.json(
            { error: "对方没有把持仓共享给你。" },
            { status: 403 }
          );
        }
        const raw = await kvGet(
          config.kv,
          `${PORTFOLIO_ACCOUNT_DATA_KEY_PREFIX}${from}`
        );
        return respond({
          data: raw ? JSON.parse(raw) : null,
          readOnly: true,
        });
      }
      const raw = await kvGet(
        config.kv,
        `${PORTFOLIO_ACCOUNT_DATA_KEY_PREFIX}${me}`
      );
      return respond(portfolioCloudEnvelope(raw, `${PORTFOLIO_ACCOUNT_DATA_KEY_PREFIX}${me}`));
    }

    if (body.action === "push") {
      const result = await writeVersionedPortfolio(config.kv,
        `${PORTFOLIO_ACCOUNT_DATA_KEY_PREFIX}${me}`, body,
        { key: `${PORTFOLIO_ACCOUNT_METADATA_KEY_PREFIX}${me}`, owner: me });
      return respond(result.body, result.status);
    }

    if (body.action === "shares") {
      const [members, sharedWithMe] = await Promise.all([
        readEmailList(config, `${PORTFOLIO_ACCOUNT_SHARE_KEY_PREFIX}${me}`),
        readEmailList(config, `${PORTFOLIO_ACCOUNT_SHARED_WITH_KEY_PREFIX}${me}`),
      ]);
      return respond({ members, sharedWithMe });
    }

    if (body.action === "share-add") {
      const email = normalizeEmail(body.email);
      if (!email) {
        return NextResponse.json({ error: "请输入有效邮箱。" }, { status: 400 });
      }
      if (email === me) {
        return NextResponse.json(
          { error: "不需要共享给自己。" },
          { status: 400 }
        );
      }
      if (!config.allowedEmails.has(email)) {
        return NextResponse.json(
          {
            error:
              "该邮箱不在登录白名单里。请先把它加到 ZHINOTES_ACCOUNT_ALLOWED_EMAILS，对方才能登录查看。",
          },
          { status: 400 }
        );
      }
      const members = await readEmailList(
        config,
        `${PORTFOLIO_ACCOUNT_SHARE_KEY_PREFIX}${me}`
      );
      if (members.includes(email)) {
        return respond({ members });
      }
      if (members.length >= MAX_SHARE_MEMBERS) {
        return NextResponse.json(
          { error: "共享人数已达上限。" },
          { status: 400 }
        );
      }
      const nextMembers = [...members, email];
      const reverse = await readEmailList(
        config,
        `${PORTFOLIO_ACCOUNT_SHARED_WITH_KEY_PREFIX}${email}`
      );
      await Promise.all([
        writeEmailList(
          config,
          `${PORTFOLIO_ACCOUNT_SHARE_KEY_PREFIX}${me}`,
          nextMembers
        ),
        reverse.includes(me)
          ? Promise.resolve()
          : writeEmailList(
              config,
              `${PORTFOLIO_ACCOUNT_SHARED_WITH_KEY_PREFIX}${email}`,
              [...reverse, me]
            ),
      ]);
      return respond({ members: nextMembers });
    }

    if (body.action === "share-remove") {
      const email = normalizeEmail(body.email);
      if (!email) {
        return NextResponse.json({ error: "请输入有效邮箱。" }, { status: 400 });
      }
      const members = await readEmailList(
        config,
        `${PORTFOLIO_ACCOUNT_SHARE_KEY_PREFIX}${me}`
      );
      const nextMembers = members.filter((item) => item !== email);
      const reverse = await readEmailList(
        config,
        `${PORTFOLIO_ACCOUNT_SHARED_WITH_KEY_PREFIX}${email}`
      );
      await Promise.all([
        writeEmailList(
          config,
          `${PORTFOLIO_ACCOUNT_SHARE_KEY_PREFIX}${me}`,
          nextMembers
        ),
        writeEmailList(
          config,
          `${PORTFOLIO_ACCOUNT_SHARED_WITH_KEY_PREFIX}${email}`,
          reverse.filter((item) => item !== me)
        ),
      ]);
      return respond({ members: nextMembers });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch {
    return accountSessionUnconfirmedResponse(
      "组合同步云端读写暂时失败；本地组合数据已保留，会稍后重试。"
    );
  }
}
