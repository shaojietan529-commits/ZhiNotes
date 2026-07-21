import { NextResponse } from "next/server";
import {
  getAccountConfig,
  getSessionAccount,
  readSessionToken,
} from "@/lib/account/server";
import {
  buildRebalanceWorkbook,
  type RebalanceExportTrade,
  type RebalanceTradeAction,
} from "@/lib/portfolio/buildRebalanceWorkbook";
import { sendMailboxMessage } from "@/lib/portfolio/graphMail";

export const dynamic = "force-dynamic";

// Where confirmed rebalance instructions are emailed. The owner asked for this
// fixed recipient; change here if the desk address changes.
const RECIPIENT = "Rtan@keystone-investors.com";

const VALID_ACTIONS = new Set<RebalanceTradeAction>([
  "buy",
  "sell",
  "sellshort",
  "buytocover",
]);

interface ExportBody {
  trades?: unknown;
  clientDate?: unknown; // "YYYY-MM-DD" or "YYYYMMDD"
  send?: unknown;
}

function toDateNum(clientDate: unknown): number {
  if (typeof clientDate === "string") {
    const digits = clientDate.replace(/-/g, "");
    if (/^\d{8}$/.test(digits)) return Number(digits);
  }
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return Number(`${y}${m}${day}`);
}

function parseTrades(raw: unknown): RebalanceExportTrade[] {
  if (!Array.isArray(raw)) return [];
  const out: RebalanceExportTrade[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const ticker = typeof r.ticker === "string" ? r.ticker.trim() : "";
    const action = r.action as RebalanceTradeAction;
    const amountK =
      typeof r.amountK === "number" && Number.isFinite(r.amountK)
        ? r.amountK
        : 0;
    if (!ticker || !VALID_ACTIONS.has(action) || amountK <= 0) continue;
    out.push({
      ticker,
      action,
      amountK,
      unwind: r.unwind === true,
    });
  }
  return out;
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
  const account = token ? await getSessionAccount(config, token) : null;
  if (!account) {
    return NextResponse.json({ error: "auth-required" }, { status: 401 });
  }

  let body: ExportBody;
  try {
    body = (await request.json()) as ExportBody;
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }

  const trades = parseTrades(body.trades);
  if (trades.length === 0) {
    return NextResponse.json(
      { error: "no-trades", message: "没有已确认的调仓指令可导出" },
      { status: 400 }
    );
  }

  const dateNum = toDateNum(body.clientDate);

  let built;
  try {
    built = buildRebalanceWorkbook(trades, dateNum);
  } catch {
    return NextResponse.json(
      { error: "build-failed", message: "生成 Excel 失败" },
      { status: 500 }
    );
  }

  const fileBase64 = Buffer.from(built.buffer).toString("base64");
  const send = body.send === true;
  let emailed = false;
  let emailError: string | null = null;

  if (send) {
    const result = await sendMailboxMessage({
      to: [RECIPIENT],
      subject: `Roger Tan Idea ${dateNum}`,
      text: `附件为 ${dateNum} 调仓指令，共 ${built.tradeCount} 笔。\n\n— 由 ZhiNotes 组合管理自动生成`,
      attachments: [{ filename: built.filename, contentBase64: fileBase64 }],
    });
    emailed = result.status === "sent";
    if (result.status === "unconfigured") {
      emailError = "邮箱未配置（需要 MS_GRAPH_CLIENT_ID / MS_GRAPH_REFRESH_TOKEN）";
    } else if (result.status === "auth_failed") {
      emailError =
        "邮箱授权缺少发送权限（Mail.Send），请用带 Mail.Send 的授权重新生成 refresh token";
    } else if (result.status === "send_failed") {
      emailError = `发送失败（${result.code}），请稍后重试`;
    }
  }

  return NextResponse.json({
    ok: true,
    emailed,
    emailError,
    recipient: send ? RECIPIENT : null,
    filename: built.filename,
    tradeCount: built.tradeCount,
    date: dateNum,
    fileBase64,
  });
}
