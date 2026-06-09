import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 501 }
    );
  }

  let body: { content?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const content = typeof body.content === "string" ? body.content : "";
  const plainText = content.replace(/<[^>]*>/g, "").trim();
  if (!plainText) {
    return NextResponse.json({ companies: [], industries: [] });
  }

  const prompt = `分析以下投资研究笔记，提取最相关的公司和行业。

规则：
- 只返回笔记中有实质性讨论的公司，不要包含仅仅提及一下的
- 最多返回3个公司和3个行业
- 如果相关的不足3个，只返回真正相关的
- 中国公司用中文名，外国公司用英文名
- 行业用标准行业/板块名称（如：半导体、新能源、消费电子、医药生物等）
- 只返回JSON，不要任何其他文字

返回格式：
{"companies":["公司1","公司2"],"industries":["行业1","行业2"]}

笔记内容：
${plainText.slice(0, 4000)}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 256,
        messages: [{ role: "user", content: prompt }],
      }),
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
      return NextResponse.json({ companies: [], industries: [] });
    }

    const result = JSON.parse(match[0]);
    return NextResponse.json({
      companies: Array.isArray(result.companies)
        ? result.companies.filter((v: unknown) => typeof v === "string").slice(0, 3)
        : [],
      industries: Array.isArray(result.industries)
        ? result.industries.filter((v: unknown) => typeof v === "string").slice(0, 3)
        : [],
    });
  } catch {
    return NextResponse.json({ error: "AI analysis error" }, { status: 500 });
  }
}
