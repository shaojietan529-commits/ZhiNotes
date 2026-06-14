import { NextResponse } from "next/server";
import {
  accountMissingEnv,
  getAccountConfig,
  getSessionAccount,
  readSessionToken,
} from "@/lib/account/server";
import {
  isValidPageSyncId,
  readPageSyncIndex,
  readPageSyncPage,
  sanitizePageSyncRecord,
  upsertPageSyncRecords,
  type PageSyncRecord,
} from "@/lib/pages/accountPageStore";

export const dynamic = "force-dynamic";

// Account-scoped page cloud sync. Each signed-in account owns one cloud
// copy of its page tree, keyed by email, so the same workspace appears on
// every domain/device that signs in with that account. Local-first stays
// the default: nothing is uploaded until the owner turns the sync toggle
// on in /account (client-side gate), and this route additionally requires
// a valid session on every call.
//
// Storage layout (same KV store as portfolio sync):
//   zhinotes:pagesync:index:{email}        → { [pageId]: { u, d } }
//   zhinotes:pagesync:page:{email}:{id}    → full page record JSON
// Last-write-wins by updated_at; the server never overwrites a newer copy
// with an older one, so a stale device cannot roll back edits.

const MAX_PAYLOAD_BYTES = 950 * 1024;
const MAX_PUSH_RECORDS = 100;
const MAX_PULL_IDS = 50;

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

  const token = readSessionToken(request);
  if (!token) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  let bodyText: string;
  try {
    bodyText = await request.text();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (bodyText.length > MAX_PAYLOAD_BYTES) {
    return NextResponse.json({ error: "数据过大" }, { status: 413 });
  }

  let body: { action?: string; ids?: unknown; pages?: unknown };
  try {
    body = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  try {
    const account = await getSessionAccount(config, token);
    if (!account) {
      return NextResponse.json(
        { error: "登录已过期，请重新登录。" },
        { status: 401 }
      );
    }
    const me = account.email;

    if (body.action === "manifest") {
      const index = await readPageSyncIndex(config, me);
      return NextResponse.json({ index });
    }

    if (body.action === "pull") {
      if (!Array.isArray(body.ids)) {
        return NextResponse.json({ error: "缺少 ids" }, { status: 400 });
      }
      const ids = body.ids.filter(isValidPageSyncId).slice(0, MAX_PULL_IDS);
      const pages: PageSyncRecord[] = [];
      for (const id of ids) {
        const record = await readPageSyncPage(config, me, id);
        if (record) pages.push(record);
      }
      return NextResponse.json({ pages });
    }

    if (body.action === "push") {
      if (!Array.isArray(body.pages)) {
        return NextResponse.json({ error: "缺少 pages" }, { status: 400 });
      }
      if (body.pages.length > MAX_PUSH_RECORDS) {
        return NextResponse.json({ error: "单次推送过多" }, { status: 400 });
      }
      const records = body.pages
        .map(sanitizePageSyncRecord)
        .filter((record): record is PageSyncRecord => Boolean(record));
      const { accepted, skipped } = await upsertPageSyncRecords(
        config,
        me,
        records
      );
      return NextResponse.json({ ok: true, accepted, skipped });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch {
    return NextResponse.json(
      { error: "云端存储读写失败，请稍后重试。" },
      { status: 502 }
    );
  }
}
