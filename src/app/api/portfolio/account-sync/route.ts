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

export const dynamic = "force-dynamic";

// Account-scoped portfolio cloud sync. Each signed-in account owns one
// cloud copy keyed by its email, and can share read-only access with
// other allowlisted emails. The passcode-based /api/portfolio/sync route
// stays untouched for devices that are not signed in.

const DATA_KEY_PREFIX = "zhinotes:portfolio:data:acct:";
const SHARE_KEY_PREFIX = "zhinotes:portfolio:share:"; // emails I shared to
const SHARED_WITH_KEY_PREFIX = "zhinotes:portfolio:sharedwith:"; // owners who shared to me
const MAX_PAYLOAD_BYTES = 1024 * 1024;
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
    const me = account.email;

    if (body.action === "pull") {
      const from = normalizeEmail(body.from);
      if (from && from !== me) {
        // Reading someone else's portfolio requires being on their list.
        const members = await readEmailList(
          config,
          `${SHARE_KEY_PREFIX}${from}`
        );
        if (!members.includes(me)) {
          return NextResponse.json(
            { error: "对方没有把持仓共享给你。" },
            { status: 403 }
          );
        }
        const raw = await kvGet(config.kv, `${DATA_KEY_PREFIX}${from}`);
        return NextResponse.json({
          data: raw ? JSON.parse(raw) : null,
          readOnly: true,
        });
      }
      const raw = await kvGet(config.kv, `${DATA_KEY_PREFIX}${me}`);
      return NextResponse.json({ data: raw ? JSON.parse(raw) : null });
    }

    if (body.action === "push") {
      if (!body.data || typeof body.data !== "object") {
        return NextResponse.json({ error: "缺少数据" }, { status: 400 });
      }
      const incoming = body.data as Record<string, unknown>;

      // Same server-side tag union as the passcode route: a stale device
      // can never wipe labels added elsewhere.
      const incomingTags =
        incoming.tagMap && typeof incoming.tagMap === "object"
          ? (incoming.tagMap as Record<string, string>)
          : {};
      let mergedTags = incomingTags;
      const existingRaw = await kvGet(config.kv, `${DATA_KEY_PREFIX}${me}`);
      if (existingRaw) {
        try {
          const existing = JSON.parse(existingRaw);
          if (existing?.tagMap && typeof existing.tagMap === "object") {
            mergedTags = { ...existing.tagMap, ...incomingTags };
          }
        } catch {
          // corrupt existing payload — overwrite it
        }
      }
      incoming.tagMap = mergedTags;

      const serialized = JSON.stringify(incoming);
      if (serialized.length > MAX_PAYLOAD_BYTES) {
        return NextResponse.json({ error: "数据过大" }, { status: 413 });
      }
      await kvSet(config.kv, `${DATA_KEY_PREFIX}${me}`, serialized);
      return NextResponse.json({
        ok: true,
        tagMap: mergedTags,
        ack: {
          format: "zhinote-portfolio-cloud-ack-receipt",
          format_version: 1,
          ack_status: "acknowledged",
          accepted: true,
          owner: me,
          updated_at:
            typeof incoming.updatedAt === "string" ? incoming.updatedAt : null,
        },
      });
    }

    if (body.action === "shares") {
      const [members, sharedWithMe] = await Promise.all([
        readEmailList(config, `${SHARE_KEY_PREFIX}${me}`),
        readEmailList(config, `${SHARED_WITH_KEY_PREFIX}${me}`),
      ]);
      return NextResponse.json({ members, sharedWithMe });
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
      const members = await readEmailList(config, `${SHARE_KEY_PREFIX}${me}`);
      if (members.includes(email)) {
        return NextResponse.json({ members });
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
        `${SHARED_WITH_KEY_PREFIX}${email}`
      );
      await Promise.all([
        writeEmailList(config, `${SHARE_KEY_PREFIX}${me}`, nextMembers),
        reverse.includes(me)
          ? Promise.resolve()
          : writeEmailList(config, `${SHARED_WITH_KEY_PREFIX}${email}`, [
              ...reverse,
              me,
            ]),
      ]);
      return NextResponse.json({ members: nextMembers });
    }

    if (body.action === "share-remove") {
      const email = normalizeEmail(body.email);
      if (!email) {
        return NextResponse.json({ error: "请输入有效邮箱。" }, { status: 400 });
      }
      const members = await readEmailList(config, `${SHARE_KEY_PREFIX}${me}`);
      const nextMembers = members.filter((item) => item !== email);
      const reverse = await readEmailList(
        config,
        `${SHARED_WITH_KEY_PREFIX}${email}`
      );
      await Promise.all([
        writeEmailList(config, `${SHARE_KEY_PREFIX}${me}`, nextMembers),
        writeEmailList(
          config,
          `${SHARED_WITH_KEY_PREFIX}${email}`,
          reverse.filter((item) => item !== me)
        ),
      ]);
      return NextResponse.json({ members: nextMembers });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch {
    return accountSessionUnconfirmedResponse(
      "组合同步云端读写暂时失败；本地组合数据已保留，会稍后重试。"
    );
  }
}
