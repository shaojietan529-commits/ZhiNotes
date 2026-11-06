import { after, NextResponse } from "next/server";
import { getAccountIdentityConfig, getSessionAccount, readSessionToken } from "@/lib/account/server";
import { actionSchema, configuration, monthlyBudget } from "@/lib/company-research/contract";
import { ResearchRedis } from "@/lib/company-research/storage";
import { ResearchError, ResearchService } from "@/lib/company-research/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { "Cache-Control": "private, no-store" } });

async function service(request: Request, companyId: string) {
  const config = getAccountIdentityConfig();
  const token = readSessionToken(request);
  if (!config || !token) throw new ResearchError(401, "请先在同一网站登录账号。");
  const account = await getSessionAccount(config, token);
  if (!account) throw new ResearchError(401, "账号会话未确认，请重新登录。");
  const research = configuration(account.email, process.env);
  const company = research.companies.find(item => item.id === companyId);
  if (!company) throw new ResearchError(404, "尚未绑定此账号的真实公司与研究资料范围。");
  return new ResearchService({ store: new ResearchRedis(config.kv), accountId: account.id, email: account.email, company,
    apiKey: process.env.ANTHROPIC_API_KEY, enabled: process.env.COMPANY_RESEARCH_ENABLED === "1",
    notionToken: research.notionTokenEnv ? process.env[research.notionTokenEnv] : undefined,
    monthlyBudgetUsd: monthlyBudget(process.env) });
}
function failed(error: unknown) {
  return error instanceof ResearchError ? json({ error: error.message }, error.status) : json({ error: "研究服务暂时不可用，未自动重试。" }, 503);
}
async function smallBody(request: Request): Promise<string> {
  const reader = request.body?.getReader();
  if (!reader) throw new ResearchError(400, "请求格式无效。");
  const decoder = new TextDecoder();
  let length = 0, text = "";
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) return text + decoder.decode();
      length += chunk.value.byteLength;
      if (length > 4096) { await reader.cancel(); throw new ResearchError(413, "请求过大。"); }
      text += decoder.decode(chunk.value, { stream: true });
    }
  } finally { reader.releaseLock(); }
}
export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("companyId") ?? "";
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id) || id.toUpperCase() === "DEMO") return json({ error: "虚构样板不能进行真实研究。" }, 400);
    return json(await (await service(request, id)).snapshot());
  } catch (error) { return failed(error); }
}
export async function POST(request: Request) {
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin) return json({ error: "请从同一网站提交。" }, 403);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return json({ error: "请求格式无效。" }, 415);
    const raw = await smallBody(request);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return json({ error: "请求格式无效。" }, 400); }
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) return json({ error: "需要明确确认资料范围与外发内容。" }, 400);
    const input = parsed.data;
    if (input.companyId.toUpperCase() === "DEMO") return json({ error: "虚构样板不能进行真实研究。" }, 400);
    const research = await service(request, input.companyId);
    if (input.action === "prepare") return json(await research.prepare());
    const accepted = await research.start(input.draftId, input.digest);
    if (accepted.run) after(accepted.run);
    return json(accepted.snapshot, accepted.run ? 202 : 200);
  } catch (error) { return failed(error); }
}
