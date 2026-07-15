import { NextResponse } from "next/server";
import {
  getAccountConfig,
  getSessionAccount,
  kvGet,
  kvSet,
  readSessionToken,
} from "@/lib/account/server";
import { accountSessionUnconfirmedResponse } from "@/lib/account/sessionResponses";

export const dynamic = "force-dynamic";

const FILE_KEY_PREFIX = "zhinotes:filesync:";

// Vercel KV (Upstash) has a ~1 MB value limit. A data-URL for a 500 KB
// binary is ~670 KB after base64, plus JSON envelope ≈ 700 KB — safe.
// We cap at 500 KB of raw file size to stay well within that budget.
const MAX_RAW_FILE_BYTES = 500 * 1024;

interface PushBody {
  action: "push";
  fileId: string;
  fileName: string;
  mimeType: string;
  kind: string;
  size: number;
  dataUrl: string;
  textContent?: string;
}

interface PullBody {
  action: "pull";
  fileId: string;
}

export async function POST(request: Request) {
  const config = getAccountConfig();
  if (!config) {
    return NextResponse.json(
      { error: "account-not-configured" },
      { status: 501 }
    );
  }

  const token = readSessionToken(request);
  if (!token) {
    return NextResponse.json({ error: "auth-required" }, { status: 401 });
  }
  let account: Awaited<ReturnType<typeof getSessionAccount>>;
  try {
    account = await getSessionAccount(config, token);
  } catch {
    return accountSessionUnconfirmedResponse(
      "文件云同步暂时无法确认账号；文件已保存在本地，请稍后重试。"
    );
  }
  if (!account) {
    return accountSessionUnconfirmedResponse(
      "文件云同步暂时无法确认账号；文件已保存在本地，请稍后重试。"
    );
  }
  const email = account.email;

  let body: PushBody | PullBody;
  try {
    body = (await request.json()) as PushBody | PullBody;
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }

  if (body.action === "push") {
    const { fileId, fileName, mimeType, kind, size, dataUrl, textContent } =
      body as PushBody;
    if (!fileId || !dataUrl) {
      return NextResponse.json({ error: "missing-fields" }, { status: 400 });
    }
    if (size > MAX_RAW_FILE_BYTES) {
      return NextResponse.json(
        {
          error: "file-too-large",
          message: `文件过大 (${(size / 1024).toFixed(0)} KB)，云端限制 ${MAX_RAW_FILE_BYTES / 1024} KB。文件已保存在本地。`,
          maxBytes: MAX_RAW_FILE_BYTES,
        },
        { status: 413 }
      );
    }
    const record = JSON.stringify({
      fileId,
      fileName,
      mimeType,
      kind,
      size,
      dataUrl,
      textContent: textContent ?? null,
    });
    try {
      await kvSet(config.kv, `${FILE_KEY_PREFIX}${email}:${fileId}`, record);
    } catch {
      return accountSessionUnconfirmedResponse(
        "文件云同步暂时无法写入云端；文件已保存在本地，请稍后重试。"
      );
    }
    return NextResponse.json({ ok: true, synced: true });
  }

  if (body.action === "pull") {
    const { fileId } = body as PullBody;
    if (!fileId) {
      return NextResponse.json({ error: "missing-fileId" }, { status: 400 });
    }
    let raw: string | null;
    try {
      raw = await kvGet(config.kv, `${FILE_KEY_PREFIX}${email}:${fileId}`);
    } catch {
      return accountSessionUnconfirmedResponse(
        "文件云同步暂时无法读取云端；本地文件不受影响，请稍后重试。"
      );
    }
    if (!raw) {
      return NextResponse.json({ found: false });
    }
    try {
      const record = JSON.parse(raw) as Record<string, unknown>;
      return NextResponse.json({ found: true, ...record });
    } catch {
      return NextResponse.json({ found: false });
    }
  }

  return NextResponse.json({ error: "unknown-action" }, { status: 400 });
}
