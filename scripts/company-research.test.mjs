import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const require = createRequire(import.meta.url);
const base = new URL("../src/lib/company-research/", import.meta.url);
const modules = new Map();
async function moduleUrl(name) {
  if (modules.has(name)) return modules.get(name);
  let source = ts.transpileModule(await readFile(new URL(`${name}.ts`, base), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const [, specifier] of source.matchAll(/from "([^"]+)"/g)) {
    if (specifier.startsWith("node:")) continue;
    const resolved = specifier.startsWith("./") ? await moduleUrl(specifier.slice(2)) : pathToFileURL(require.resolve(specifier)).href;
    source = source.replaceAll(`from "${specifier}"`, `from "${resolved}"`);
  }
  const url = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
  modules.set(name, url); return url;
}
const { configuration, validateFindings, companySchema, safePublicUrl, JOB_MS } = await import(await moduleUrl("contract"));
const { ResearchService } = await import(await moduleUrl("service"));
const { readSources } = await import(await moduleUrl("sources"));
const { generateResearch, estimateUsd } = await import(await moduleUrl("provider"));
const { ResearchRedis } = await import(await moduleUrl("storage"));

const company = { id: "synthetic-company", name: "Synthetic Test Company", ticker: "SYNTH", exchange: "TEST", publicDomains: ["example.com"], zhinotePageIds: [], notionPageIds: [] };
const point = { text: "Synthetic evidence based point", category: "alpha", basis: "inference", sourceIds: ["p-1"] };
const source = { id: "p-1", kind: "public", title: "Synthetic source", url: "https://example.com/filing", date: null, dateKind: "unknown" };
const result = { companyId: company.id, generatedAt: "2026-11-04T00:00:00Z", bull: [point], bear: [point], sources: [source], warnings: [] };

// Model the atomic store boundary in memory. No account storage, credentials, or paid provider calls.
class MemoryStore {
  values = new Map();
  expires = new Map();
  reads = [];
  time = Date.now();
  expire() { for (const [key, time] of this.expires) if (time <= this.time) { this.values.delete(key); this.expires.delete(key); } }
  async get(key) { this.expire(); this.reads.push(key); return this.values.has(key) ? structuredClone(this.values.get(key)) : null; }
  async put(key, value, seconds) { this.values.set(key, structuredClone(value)); this.expires.set(key, this.time + seconds * 1000); }
  async eval(script, k, a) {
    this.expire();
    if (script.includes("research-prepare-v1")) {
      if (this.values.has(k[0])) return 0;
      this.values.set(k[0], 1); this.expires.set(k[0], this.time + 60000); return 1;
    }
    if (script.includes("research-claim-v1")) {
      if (this.values.has(k[3])) return ["duplicate", JSON.stringify(this.values.get(k[3]))];
      if (this.values.has(k[0])) return ["busy", JSON.stringify(this.values.get(k[0]))];
      if (this.values.has(k[5])) return ["cooldown", ""];
      const spent = this.values.get(k[2]) ?? 0;
      if (spent + Number(a[2]) > Number(a[3])) return ["budget", ""];
      for (const key of [k[0], k[1], k[3]]) this.values.set(key, JSON.parse(a[0]));
      this.expires.set(k[0], this.time + Number(a[4]) * 1000);
      this.values.set(k[4], JSON.parse(a[1])); this.values.set(k[2], spent + Number(a[2]));
      this.values.set(k[5], 1); this.expires.set(k[5], this.time + 60000);
      return ["claimed", a[0]];
    }
    if (script.includes("research-finish-v1")) {
      const job = this.values.get(k[0]);
      if (!job || job.status !== "running" || this.values.get(k[1]) !== JSON.parse(a[0])) return 0;
      this.values.set(k[0], JSON.parse(a[1]));
      if (a[2]) this.values.set(k[2], JSON.parse(a[2]));
      this.values.set(k[3], (this.values.get(k[3]) ?? 0) + Number(a[3]));
      if (this.values.get(k[4]) === JSON.parse(a[0])) this.values.delete(k[4]);
      return 1;
    }
    throw new Error("unexpected script");
  }
}
function setup(overrides = {}) {
  const store = overrides.store ?? new MemoryStore(); let calls = 0;
  const service = new ResearchService({ store, accountId: "synthetic-account", email: "synthetic@example.test", company,
    enabled: true, apiKey: "synthetic-not-a-key", monthlyBudgetUsd: 20, now: () => store.time,
    read: async () => ({ sources: [], warnings: ["synthetic-only"] }),
    generate: async options => { calls++; options.onUsage({ inputTokens: 1000, outputTokens: 500, searches: 2 }); return structuredClone(result); }, ...overrides });
  return { service, store, calls: () => calls };
}
test("company scopes are account-specific and invalid configuration fails closed", () => {
  const env = { COMPANY_RESEARCH_ACCOUNTS_JSON: JSON.stringify({ "a@example.test": { companies: [company] } }) };
  assert.equal(configuration("A@example.test", env).companies.length, 1);
  assert.equal(configuration("b@example.test", env).companies.length, 0);
  assert.equal(configuration("a@example.test", { COMPANY_RESEARCH_ACCOUNTS_JSON: "not json" }).companies.length, 0);
  assert.throws(() => companySchema.parse({ ...company, id: "DEMO" }));
  assert.throws(() => companySchema.parse({ ...company, publicDomains: ["https://example.com"] }));
});
test("findings require valid citations, alpha and at most one macro point in total", () => {
  assert.deepEqual(validateFindings({ bull: [point], bear: [point] }, [source]), { bull: [point], bear: [point] });
  assert.throws(() => validateFindings({ bull: [point], bear: [{ ...point, sourceIds: ["invented"] }] }, [source]));
  assert.throws(() => validateFindings({ bull: [{ ...point, category: "macro" }], bear: [{ ...point, category: "macro" }] }, [source]));
  assert.throws(() => validateFindings({ bull: Array(6).fill(point), bear: [point] }, [source]));
  for (const url of ["javascript:alert(1)", "http://example.com", "https://localhost/", "https://x:y@example.com", "https://127.0.0.1"]) assert.equal(safePublicUrl(url), null);
});
test("consent preview has an expiry and does not call AI or include Investment Thesis", async () => {
  const { service, calls, store } = setup();
  const preview = await service.prepare();
  assert.equal(calls(), 0); assert.match(preview.outbound, /privateExcerpts/);
  assert.equal(preview.expiresAt, store.time + 600000);
  await assert.rejects(service.start(preview.id, "wrong"), /预览已失效/);
  await assert.rejects(service.prepare(), /稍后/);
  store.time += 600001;
  await assert.rejects(service.start(preview.id, preview.digest), /预览已失效/);
});
test("concurrent starts share one cloud job and a second device reads its saved result", async () => {
  const { service, calls, store } = setup();
  const preview = await service.prepare();
  const first = service.start(preview.id, preview.digest), second = service.start(preview.id, preview.digest);
  const a = await first, b = await second;
  assert.equal(Boolean(a.run) + Boolean(b.run), 1);
  assert.equal(a.snapshot.job.id, b.snapshot.job.id);
  assert.equal(calls(), 0);
  await (a.run ?? b.run)();
  const device = setup({ store }).service;
  const saved = await device.snapshot();
  assert.equal(saved.job.status, "complete"); assert.deepEqual(saved.result, result);
  assert.equal(saved.job.estimatedUsd, .0235); assert.equal(calls(), 1);
  const replay = await service.start(preview.id, preview.digest);
  assert.equal(replay.run, undefined);
  assert.equal((await setup({ store, accountId: "another-account" }).service.snapshot()).result, null);
  const budget = [...store.values.entries()].find(([key]) => key.includes(":budget:"))[1];
  assert.equal(budget, 23500);
});
test("monthly reservation stops extra jobs; provider failure keeps old results and never retries", async () => {
  const { service, store } = setup({ monthlyBudgetUsd: .5 });
  const preview = await service.prepare();
  await assert.rejects(service.start(preview.id, preview.digest), /额度不足/);
  let attempts = 0;
  const fail = setup({ store, monthlyBudgetUsd: 20, generate: async () => { attempts++; throw new Error("provider secret must not leak"); } });
  const accepted = await fail.service.start(preview.id, preview.digest);
  const resultKey = [...store.values.keys()].find(key => key.includes(":current:" )).replace(":current:", ":result:");
  await store.put(resultKey, result, 10000);
  await accepted.run();
  const failed = await fail.service.snapshot();
  assert.equal(failed.job.status, "failed"); assert.deepEqual(failed.result, result);
  assert.doesNotMatch(JSON.stringify(failed), /provider secret/); assert.equal(attempts, 1);
  assert.equal([...store.values.entries()].find(([key]) => key.includes(":budget:"))[1], 1000000);
});
test("server interruption expires visibly without rerunning and scope revocation invalidates preview", async () => {
  const { service, store, calls } = setup();
  const preview = await service.prepare();
  await assert.rejects(setup({ store, company: { ...company, zhinotePageIds: ["changed-scope"] } }).service.start(preview.id, preview.digest), /授权范围/);
  await service.start(preview.id, preview.digest);
  store.time += JOB_MS + 1;
  assert.equal((await service.snapshot()).job.status, "failed"); assert.equal(calls(), 0);
});
test("disabled provider never reads private sources", async () => {
  let reads = 0;
  const { service } = setup({ enabled: false, read: async () => { reads++; throw new Error("should not read"); } });
  await assert.rejects(service.prepare(), /尚未启用/); assert.equal(reads, 0);
});
test("source reads are explicit account IDs only; partial Notion content is disclosed", async () => {
  const store = new MemoryStore();
  await store.put("zhinotes:pagesync:page:synthetic@example.test:allowed", { id: "allowed", title: "Synthetic note", content_text: "sensitive fixture", updated_at: "2026-11-01", deleted_at: null }, 1000);
  const notionId = "11111111-1111-1111-1111-111111111111";
  let calls = 0;
  const collected = await readSources({ ...company, zhinotePageIds: ["allowed", "missing"], notionPageIds: [notionId] }, "synthetic@example.test", store, "synthetic-only", async (url, options) => {
    calls++; assert.equal(url, `https://api.notion.com/v1/blocks/${notionId}/children?page_size=100`); assert.equal(options.headers["Notion-Version"], "2025-09-03");
    return Response.json({ has_more: true, results: [{ id: "block", type: "paragraph", has_children: true, paragraph: { rich_text: [{ plain_text: "synthetic notion excerpt" }] } }] });
  });
  assert.equal(collected.sources.length, 2); assert.equal(calls, 1);
  assert.match(collected.warnings.join(" "), /读取失败/); assert.match(collected.warnings.join(" "), /顶层文字摘录/);
  assert.ok(store.reads.every(key => key.startsWith("zhinotes:pagesync:page:synthetic@example.test:")));
  assert.equal(collected.sources[0].dateKind, "modified");
});
test("provider isolates private excerpts from web search, bounds tools, validates output and meters usage", async () => {
  const requests = [], usage = [];
  const generated = await generateResearch({ company, sources: [{ ...source, id: "z-note", kind: "zhinote", text: "PRIVATE_SYNTHETIC_TEXT" }], warnings: [], asOf: "2026-11-04", apiKey: "fake", signal: new AbortController().signal,
    onUsage: value => usage.push(value), http: async (url, options) => {
      assert.equal(url, "https://api.anthropic.com/v1/messages");
      const body = JSON.parse(options.body); requests.push(body);
      if (requests.length === 1) return Response.json({ stop_reason: "end_turn", content: [{ type: "text", text: "synthetic", citations: [{ type: "web_search_result_location", url: source.url, title: source.title, cited_text: "Synthetic evidence excerpt" }] }], usage: { input_tokens: 100, output_tokens: 100, server_tool_use: { web_search_requests: 2 } } });
      return Response.json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: "submit_research", input: { bull: [point], bear: [point] } }], usage: { input_tokens: 200, output_tokens: 300 } });
    } });
  assert.equal(requests.length, 2); assert.equal(requests[0].tools[0].max_uses, 3);
  assert.doesNotMatch(JSON.stringify(requests[0]), /PRIVATE_SYNTHETIC_TEXT/);
  assert.match(JSON.stringify(requests[1]), /PRIVATE_SYNTHETIC_TEXT/);
  assert.equal(requests[1].tools.length, 1); assert.equal(requests[1].tools[0].name, "submit_research");
  assert.equal(generated.bull[0].sourceIds[0], "p-1");
  assert.equal(generated.sources[0].date, null);
  assert.equal(estimateUsd(usage.reduce((a, b) => ({ inputTokens: a.inputTokens + b.inputTokens, outputTokens: a.outputTokens + b.outputTokens, searches: a.searches + b.searches }))), .0223);
});
test("provider refuses fabricated or absent public citations instead of publishing a fresh-looking result", async () => {
  await assert.rejects(generateResearch({ company, sources: [], warnings: [], asOf: "2026-11-04", apiKey: "fake", signal: new AbortController().signal, onUsage: () => {},
    http: async () => Response.json({ stop_reason: "end_turn", content: [{ type: "text", text: "no search" }], usage: { input_tokens: 1, output_tokens: 1 } }) }), /no-public-evidence/);
});
test("Redis REST boundary uses bounded requests and never logs raw errors or tokens", async () => {
  const original = globalThis.fetch; const commands = [];
  globalThis.fetch = async (url, options) => { assert.equal(url, "https://redis.example.test"); assert.ok(options.signal); commands.push(JSON.parse(options.body)); return Response.json({ result: commands.length === 1 ? JSON.stringify({ fixture: true }) : "OK" }); };
  try {
    const store = new ResearchRedis({ url: "https://redis.example.test", token: "synthetic-only" });
    assert.deepEqual(await store.get("synthetic"), { fixture: true }); await store.put("synthetic", { fixture: false }, 600);
    assert.deepEqual(commands[1], ["SET", "synthetic", '{"fixture":false}', "EX", 600]);
  } finally { globalThis.fetch = original; }
});
test("HTTP routes enforce session, same-origin consent and body limits before any source/provider access", async () => {
  const encoded = code => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
  const accountStub = encoded(`export const getAccountIdentityConfig = () => null; export const readSessionToken = () => null; export const getSessionAccount = async () => { throw new Error('must not read'); };`);
  const nextStub = encoded(`export const NextResponse = { json: (body, init) => Response.json(body, init) }; export const after = () => { throw new Error('must not schedule'); };`);
  let compiled = ts.transpileModule(await readFile(new URL("../src/app/api/company-research/route.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const [specifier, resolved] of [
    ["next/server", nextStub], ["@/lib/account/server", accountStub],
    ["@/lib/company-research/contract", await moduleUrl("contract")],
    ["@/lib/company-research/storage", await moduleUrl("storage")],
    ["@/lib/company-research/service", await moduleUrl("service")],
  ]) compiled = compiled.replaceAll(`from "${specifier}"`, `from "${resolved}"`);
  const { GET, POST } = await import(encoded(compiled));
  const url = "https://research.example.test/api/company-research";
  const post = (body, origin = "https://research.example.test") => POST(new Request(url, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) }));
  assert.equal((await GET(new Request(url + "?companyId=DEMO"))).status, 400);
  assert.equal((await GET(new Request(url + "?companyId=synthetic-company"))).status, 401);
  assert.equal((await post({ action: "prepare", companyId: company.id, allowRead: true }, "https://attacker.example.test")).status, 403);
  assert.equal((await post({ action: "prepare", companyId: company.id })).status, 400);
  assert.equal((await post({ action: "prepare", companyId: company.id, allowRead: true })).status, 401);
  assert.equal((await post({ action: "prepare", companyId: "DEMO", allowRead: true })).status, 400);
  assert.equal((await post("{" )).status, 400);
  assert.equal((await post("x".repeat(5000))).status, 413);
  const response = await GET(new Request(url + "?companyId=synthetic-company"));
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
});
