import { createHash, randomUUID } from "node:crypto";
import { JOB_MS, MODEL, RESERVATION_USD, RETENTION_SECONDS, type ResearchCompany } from "./contract";
import { CLAIM, FINISH, type ResearchStorage } from "./storage";
import { generateResearch, estimateUsd, outboundPreview, type Usage } from "./provider";
import { readSources, type SourceExcerpt } from "./sources";
import type { ResearchJob, ResearchPreview, ResearchResult, ResearchScope, ResearchSnapshot } from "./types";

type Draft = ResearchPreview & { company: ResearchCompany; sources: SourceExcerpt[]; asOf: string; policyHash: string };
export class ResearchError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const usdUnits = (value: number) => Math.ceil(value * 1_000_000);
export type ResearchServiceOptions = {
  store: ResearchStorage; accountId: string; email: string; company: ResearchCompany;
  apiKey?: string; notionToken?: string; enabled: boolean; monthlyBudgetUsd: number;
  generate?: typeof generateResearch; read?: typeof readSources; now?: () => number;
};

export class ResearchService {
  private prefix: string;
  private now: () => number;
  constructor(private options: ResearchServiceOptions) {
    this.prefix = `zhinotes:research:v1:${hash(options.accountId)}`;
    this.now = options.now ?? Date.now;
  }
  private key(part: string) { return `${this.prefix}:${part}`; }
  private currentKey() { return this.key(`current:${this.options.company.id}`); }
  private resultKey() { return this.key(`result:${this.options.company.id}`); }
  private policyHash() { return hash(JSON.stringify({ company: this.options.company, model: MODEL, version: 1 })); }
  scope(): ResearchScope {
    const { company, apiKey, enabled, monthlyBudgetUsd } = this.options;
    return { companyId: company.id, name: company.name, ticker: company.ticker, exchange: company.exchange,
      zhinotePages: company.zhinotePageIds.length, notionPages: company.notionPageIds.length, monthlyBudgetUsd,
      reservationUsd: RESERVATION_USD, model: MODEL,
      blockers: [...(!enabled ? ["研究更新尚未启用。"] : []), ...(!apiKey ? ["AI 服务尚未配置。"] : [])] };
  }
  private assertEnabled() { if (this.scope().blockers.length) throw new ResearchError(503, this.scope().blockers.join(" ")); }
  async snapshot(): Promise<ResearchSnapshot> {
    const id = await this.options.store.get<string>(this.currentKey());
    const stored = id ? await this.options.store.get<ResearchJob>(this.key(`job:${id}`)) : null;
    const job = stored?.status === "running" && stored.deadline <= this.now() ? { ...stored, status: "failed" as const,
      error: "任务超时或服务器中断；旧观点已保留。未自动重试，费用预留需按服务商账单核对。" } : stored;
    return { scope: this.scope(), job, result: await this.options.store.get<ResearchResult>(this.resultKey()) };
  }
  async prepare(): Promise<ResearchPreview> {
    this.assertEnabled();
    // Only one preparation per account each minute; avoids whole-library scans and repeated source reads.
    const acquired = await this.options.store.eval<number>("-- research-prepare-v1\nreturn redis.call('SET', KEYS[1], '1', 'NX', 'EX', 60) and 1 or 0", [this.key("prepare")], []);
    if (!acquired) throw new ResearchError(429, "资料预览正在准备或刚刚生成，请稍后再试。");
    const { company, email, store, notionToken } = this.options;
    const evidence = await (this.options.read ?? readSources)(company, email, store, notionToken);
    const asOf = new Date(this.now()).toISOString(), id = randomUUID();
    const outbound = outboundPreview(company, evidence.sources, asOf);
    const draft: Draft = { id, digest: hash(outbound), expiresAt: this.now() + 600000, outbound, ...evidence,
      company, asOf, policyHash: this.policyHash() };
    await store.put(this.key(`draft:${id}`), draft, 600);
    return { id, digest: draft.digest, expiresAt: draft.expiresAt, outbound, warnings: draft.warnings };
  }
  async start(draftId: string, digest: string): Promise<{ snapshot: ResearchSnapshot; run?: () => Promise<void> }> {
    this.assertEnabled();
    const draft = await this.options.store.get<Draft>(this.key(`draft:${draftId}`));
    if (!draft || draft.expiresAt <= this.now() || draft.digest !== digest || draft.company.id !== this.options.company.id || draft.policyHash !== this.policyHash())
      throw new ResearchError(409, "资料预览已失效或授权范围已变化，请重新读取预览并确认。");
    const job: ResearchJob = { id: randomUUID(), companyId: draft.company.id, status: "running", startedAt: new Date(this.now()).toISOString(),
      deadline: this.now() + JOB_MS, inputTokens: 0, outputTokens: 0, searches: 0 };
    const budgetKey = this.key(`budget:${job.startedAt.slice(0, 7)}`);
    // IDs are JSON strings in Redis, so GET and Lua share a single serialization contract.
    const [status, rawId] = await this.options.store.eval<[string, string]>(CLAIM,
      [this.key("active"), this.currentKey(), budgetKey, this.key(`used:${draftId}`), this.key(`job:${job.id}`), this.key(`cooldown:${job.companyId}`)],
      [JSON.stringify(job.id), JSON.stringify(job), String(usdUnits(RESERVATION_USD)), String(usdUnits(this.options.monthlyBudgetUsd)), String(Math.ceil(JOB_MS / 1000) + 30), String(RETENTION_SECONDS)]);
    if (status === "budget") throw new ResearchError(429, "本月研究额度不足，未调用 AI。");
    if (status === "cooldown") throw new ResearchError(429, "刚刚更新过，请稍后再发起新任务。");
    if (status !== "claimed") {
      const id = JSON.parse(rawId) as string;
      const existing = await this.options.store.get<ResearchJob>(this.key(`job:${id}`));
      if (existing?.companyId !== job.companyId) throw new ResearchError(409, "此账号已有另一家公司的研究任务正在执行。");
      return { snapshot: await this.snapshot() };
    }
    return { snapshot: { ...(await this.snapshot()), job }, run: () => this.run(job, draft, budgetKey) };
  }
  private async run(job: ResearchJob, draft: Draft, budgetKey: string) {
    let result: ResearchResult | null = null, complete = false;
    const usage: Usage = { inputTokens: 0, outputTokens: 0, searches: 0 };
    try {
      result = await (this.options.generate ?? generateResearch)({ company: draft.company, sources: draft.sources, warnings: draft.warnings,
        asOf: draft.asOf, apiKey: this.options.apiKey!, signal: AbortSignal.timeout(Math.max(1, job.deadline - this.now() - 10000)),
        onUsage: next => { usage.inputTokens += next.inputTokens; usage.outputTokens += next.outputTokens; usage.searches += next.searches; } });
      if (this.now() >= job.deadline || result.companyId !== job.companyId) throw new Error("expired-result");
      complete = true;
    } catch { result = null; }
    const estimatedUsd = complete ? estimateUsd(usage) : undefined;
    const finished: ResearchJob = { ...job, ...usage, status: complete ? "complete" : "failed", finishedAt: new Date(this.now()).toISOString(),
      ...(complete ? { estimatedUsd } : { error: "本次研究未完成，旧观点已保留。未自动重试；费用预留暂不释放，避免重复扣费。" }) };
    try {
      await this.options.store.eval<number>(FINISH,
        [this.key(`job:${job.id}`), this.currentKey(), this.resultKey(), budgetKey, this.key("active")],
        [JSON.stringify(job.id), JSON.stringify(finished), result ? JSON.stringify(result) : "",
          String(complete ? usdUnits(estimatedUsd!) - usdUnits(RESERVATION_USD) : 0), String(RETENTION_SECONDS)]);
    } catch { /* A lost completion stays reserved and becomes an expired job, never an automatic paid retry. */ }
  }
}
