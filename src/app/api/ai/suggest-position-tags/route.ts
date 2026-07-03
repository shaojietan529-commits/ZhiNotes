import { NextResponse } from "next/server";
import {
  AnthropicRequestTimeoutError,
  buildAnthropicTimeoutBody,
  fetchAnthropicMessagesWithTimeout,
} from "@/lib/ai/anthropicRequest";

export const dynamic = "force-dynamic";

interface StockInput {
  key: string;
  name: string;
}

// Suggest an industry tag per stock based on its main business. Only called
// after the user explicitly confirms sending stock names to the AI service.
export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 501 }
    );
  }

  let body: { stocks?: unknown; availableTags?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const stocks: StockInput[] = Array.isArray(body.stocks)
    ? body.stocks
        .filter(
          (entry): entry is Record<string, unknown> =>
            Boolean(entry) && typeof entry === "object"
        )
        .map((entry) => ({
          key: typeof entry.key === "string" ? entry.key : "",
          name: typeof entry.name === "string" ? entry.name : "",
        }))
        .filter((entry) => entry.key && entry.name)
        .slice(0, 100)
    : [];

  const availableTags: string[] = Array.isArray(body.availableTags)
    ? body.availableTags.filter(
        (tag): tag is string => typeof tag === "string" && Boolean(tag.trim())
      )
    : [];

  if (stocks.length === 0) {
    return NextResponse.json({ tags: {} });
  }

  const tagInstruction =
    availableTags.length > 0
      ? `优先从这些已有标签里选择：${availableTags.join("、")}。只有当公司主业明显不属于任何已有标签时，才创建一个简短的新标签。`
      : "为每家公司创建一个简短的行业标签（如：光通信、存储、PCB、消费电子、设备材料等粒度）。";

  const stockList = stocks
    .map((stock) => `${stock.key}: ${stock.name}`)
    .join("\n");

  const prompt = `你是投资行业分析助手。根据每家公司的主营业务，给它分配一个行业标签。

${tagInstruction}

只返回JSON对象，key是股票代码，value是标签，不要任何其他文字。
格式：{"000660 KS":"存储","300408 CH":"被动元器件"}

股票列表：
${stockList}`;

  try {
    const res = await fetchAnthropicMessagesWithTimeout(apiKey, {
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "AI service returned an error" },
        { status: 502 }
      );
    }

    const data = await res.json();
    const responseText: string = data.content?.[0]?.text ?? "";
    const match = responseText.match(/\{[\s\S]*\}/);
    if (!match) {
      return NextResponse.json({ tags: {} });
    }

    const parsed = JSON.parse(match[0]);
    const tags: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string" && value.trim()) {
        tags[key] = value.trim();
      }
    }
    return NextResponse.json({ tags });
  } catch (error) {
    if (error instanceof AnthropicRequestTimeoutError) {
      return NextResponse.json(buildAnthropicTimeoutBody(error), {
        status: error.status,
      });
    }
    return NextResponse.json({ error: "AI analysis error" }, { status: 500 });
  }
}
