import assert from "node:assert/strict";
import { test } from "node:test";
import { createDemo, readDemo, moveSection, valuation, STORAGE_KEY } from "../src/components/company-board-preview/model.ts";
import { FUNDAMENTALS, FUNDAMENTAL_METRICS, DEMO_QUARTERS, formatFundamental, yearOverYear } from "../src/components/company-board-preview/fundamentalsData.ts";
import { CURRENCIES, REPORT_CURRENCY, displayCurrency, convertMoney, formatMoney, parseFxQuote, isFxStale, FX_HOUR, FX_MAX_AGE } from "../src/components/company-board-preview/currency.ts";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { NVIDIA } from "../src/lib/company-research/companies.ts";
import { readThesisDraft, thesisDraftKey } from "../src/components/company-board-preview/research-draft.ts";
const FIXTURE_RATES = { USD: 1, CNY: 7, EUR: .9, JPY: 150, TWD: 32, KRW: 1400 };

test("NVIDIA identity contains only public metadata, not fictional financials or private scopes", () => {
  assert.equal(NVIDIA.id, "NASDAQ-NVDA");
  assert.equal(NVIDIA.ticker, "NVDA");
  assert.equal(NVIDIA.exchange, "NASDAQ");
  assert.deepEqual(Object.keys(NVIDIA).sort(), ["exchange", "id", "legalName", "name", "publicSources", "ticker"]);
  for (const source of NVIDIA.publicSources) {
    const url = new URL(source.url);
    assert.equal(url.protocol, "https:");
    assert.ok(["investor.nvidia.com", "nvidianews.nvidia.com"].includes(url.hostname));
  }
});

test("real company thesis drafts are bounded and isolated from demo and other companies", () => {
  const raw = JSON.stringify({ version: 1, companyId: NVIDIA.id, thesis: "my thesis" });
  assert.equal(readThesisDraft(raw, NVIDIA.id), "my thesis");
  assert.equal(readThesisDraft(raw, "OTHER"), "");
  assert.equal(readThesisDraft(JSON.stringify(createDemo()), NVIDIA.id), "");
  for (const raw of [null, "null", "bad json", "[]", '{"version":2}']) assert.equal(readThesisDraft(raw, NVIDIA.id), "");
  assert.equal(readThesisDraft(JSON.stringify({ version: 1, companyId: NVIDIA.id, thesis: "a".repeat(17000) }), NVIDIA.id).length, 16000);
  assert.notEqual(thesisDraftKey(NVIDIA.id), STORAGE_KEY);
  assert.notEqual(thesisDraftKey(NVIDIA.id), thesisDraftKey("OTHER"));
});

test("fresh fixtures do not share mutable data and have all ten sections", () => {
  const a = createDemo(), b = createDemo();
  a.notes[0].title = "changed"; a.sections[0].hidden = true;
  assert.notEqual(a.notes[0].title, b.notes[0].title);
  assert.equal(b.sections.length, 10); assert.equal(b.sections[0].hidden, false);
  assert.ok(STORAGE_KEY.includes("demo"));
});
test("older layouts gain target valuation once without losing order, hidden sections or notes", () => {
  const d = createDemo(); d.sections = d.sections.filter(section => section.kind !== "target");
  d.sections[0].hidden = true; d.sections[1].title = "custom market title"; d.notes[0].body = "keep notes";
  const restored = readDemo(JSON.stringify(d));
  assert.deepEqual(restored.sections.filter(section => section.kind !== "target"), d.sections);
  assert.deepEqual(restored.notes, d.notes);
  assert.equal(restored.sections.filter(section => section.kind === "target").length, 1);
  restored.sections.find(section => section.kind === "target").hidden = true;
  assert.deepEqual(readDemo(JSON.stringify(restored)), restored);
  while (d.sections.length < 30) d.sections.push({ id: d.sections.length === 9 ? "target" : `custom-${d.sections.length}`, kind: "custom", title: "keep", text: "user text", hidden: false, wide: false });
  const full = readDemo(JSON.stringify(d));
  assert.equal(full.sections.length, 31);
  assert.equal(full.sections.filter(section => section.kind === "target").length, 1);
  assert.deepEqual(full.sections.filter(section => section.kind !== "target"), d.sections);
  assert.deepEqual(readDemo(JSON.stringify(full)), full);
});
test("section moves preserve identities and do not mutate original", () => {
  const sections = createDemo().sections;
  const moved = moveSection(sections, "thesis", "market");
  assert.equal(moved[0].id, "market"); assert.equal(moved[1].id, "thesis");
  assert.equal(sections[0].id, "thesis");
  assert.equal(moveSection(sections, "missing", "market"), sections);
});
test("saved demo values round trip; malformed and incompatible records recover", () => {
  const d = createDemo(); d.eps = 5; d.sections[0].title = "判断";
  assert.deepEqual(readDemo(JSON.stringify(d)), d);
  for (const raw of [null, "invalid", "null", JSON.stringify({ ...d, pe: -1 }), JSON.stringify({ ...d, notes: [{}] }), JSON.stringify({ ...d, sections: [d.sections[0], d.sections[0]] }), JSON.stringify({ ...d, version: 2 })]) {
    assert.deepEqual(readDemo(raw), createDemo());
  }
});
test("fundamental view persists and older saved boards retain user edits", () => {
  const d = createDemo(); d.fundamentalsView = "quarterly"; d.thesis[0] = "saved judgment";
  assert.deepEqual(readDemo(JSON.stringify(d)), d);
  const old = { ...d }; delete old.fundamentalsView;
  const restored = readDemo(JSON.stringify(old));
  assert.equal(restored.fundamentalsView, "annual");
  assert.equal(restored.thesis[0], "saved judgment");
  assert.deepEqual(restored.sections, d.sections);
  assert.equal(readDemo(JSON.stringify({ ...d, fundamentalsView: "invalid" })).fundamentalsView, "annual");
});
test("manual thesis is blank for a new demo and legacy edited judgments are migrated without loss", () => {
  const original = createDemo();
  assert.equal(original.investmentThesis, "");
  delete original.investmentThesis;
  assert.equal(readDemo(JSON.stringify(original)).investmentThesis, "");
  original.thesis = ["my original thesis", "my divergence", "my falsifier"];
  const restored = readDemo(JSON.stringify(original));
  for (const text of original.thesis) assert.ok(restored.investmentThesis.includes(text));
  assert.deepEqual(restored.thesis, original.thesis);
  restored.investmentThesis = "";
  assert.equal(readDemo(JSON.stringify(restored)).investmentThesis, "");
  restored.investmentThesis = "only manually written content";
  assert.equal(readDemo(JSON.stringify(restored)).investmentThesis, restored.investmentThesis);
});
test("currency defaults to the report currency, persists, and upgrades older records without resetting data", () => {
  assert.equal(createDemo().currency, "original");
  for (const { code } of CURRENCIES) {
    const d = createDemo(); d.currency = code; d.eps = 7; d.thesis[0] = "keep";
    assert.deepEqual(readDemo(JSON.stringify(d)), d);
    assert.equal(displayCurrency(code, "USD"), code);
    delete d.currency;
    const restored = readDemo(JSON.stringify(d));
    assert.equal(restored.currency, "original"); assert.equal(restored.eps, 7); assert.equal(restored.thesis[0], "keep");
  }
  assert.equal(readDemo(JSON.stringify({ ...createDemo(), currency: "invalid" })).currency, "original");
  assert.equal(displayCurrency("original"), REPORT_CURRENCY);
  assert.equal(displayCurrency("original", "USD"), "USD");
});
test("quoted currency conversion is reversible and never invents a missing rate", () => {
  const format = (value, to) => formatMoney(value, to, "CNY", 2, FIXTURE_RATES);
  const convert = (value, from, to) => convertMoney(value, from, to, FIXTURE_RATES);
  assert.deepEqual(CURRENCIES.map(c => c.code), ["USD", "CNY", "EUR", "JPY", "TWD", "KRW"]);
  assert.equal(format(28.6, "USD"), "4.09");
  assert.equal(format(25.9, "USD"), "3.70");
  assert.equal(format(28.6, "EUR"), "3.68");
  assert.equal(format(28.6, "JPY"), "612.86");
  assert.equal(format(28.6, "TWD"), "130.74");
  assert.equal(format(28.6, "KRW"), "5,720.00");
  assert.equal(format(28.6, "CNY"), "28.60");
  assert.equal(convert(1, "USD", "JPY"), 150);
  assert.equal(convert(1, "USD", "CNY"), 7);
  assert.equal(formatMoney(28.6, "USD"), "—");
  assert.equal(formatMoney(28.6, "CNY"), "28.60");
  assert.equal(formatMoney(NaN, "USD"), "—");
  for (const from of CURRENCIES) for (const to of CURRENCIES) for (const value of [0, -7, .1, 2.4, 25.9, 2860000000]) {
    const converted = convert(value, from.code, to.code);
    const back = convert(converted, to.code, from.code);
    assert.ok(Math.abs(back - value) <= Math.max(1, Math.abs(value)) * 1e-12);
    if (value > 0) assert.ok(Math.abs(converted / convert(1, from.code, to.code) - value) < Math.max(1, value) * 1e-12);
  }
});
test("FX parser requires six valid rates and a plausible provider timestamp, not the fetch time", () => {
  const now = Date.now(), timestamp = Math.floor(now / 1000);
  const valid = { base: "USD", timestamp, rates: FIXTURE_RATES };
  assert.deepEqual(parseFxQuote({ ...valid, extra: "discard", rates: { ...FIXTURE_RATES, GBP: .7 } }, now), valid);
  for (const bad of [null, {}, { ...valid, base: "CNY" }, { ...valid, timestamp: timestamp * 1000 }, { ...valid, timestamp: timestamp + 3600 }, { ...valid, timestamp: timestamp - FX_MAX_AGE / 1000 - 1 }, { ...valid, rates: { ...FIXTURE_RATES, USD: 2 } }]) assert.throws(() => parseFxQuote(bad, now));
  for (const { code } of CURRENCIES) for (const bad of [null, undefined, "7", 0, -1, NaN, Infinity, 1e10]) assert.throws(() => parseFxQuote({ ...valid, rates: { ...FIXTURE_RATES, [code]: bad } }, now));
  assert.equal(isFxStale(valid, now), false);
  assert.equal(isFxStale(valid, now + 3 * FX_HOUR), true);
  assert.doesNotThrow(() => parseFxQuote(valid, now + 3 * FX_HOUR));
});
test("public FX route deduplicates concurrent requests, strips extra data, caches hourly and backs off failures", async () => {
  const source = await readFile(new URL("../src/app/preview/company-board/exchange-rates/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /cookies\(|authorization|process\.env|upstash|@\/lib\/db|@\/lib\/account/i);
  const compiled = ts.transpileModule(source.replace("@/components/company-board-preview/currency", new URL("../src/components/company-board-preview/currency.ts", import.meta.url).href), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const originalFetch = globalThis.fetch;
  let count = 0, fail = false;
  globalThis.fetch = async (url, options) => {
    count++;
    assert.equal(url, "https://api.exchangerate.fun/latest?base=USD");
    assert.equal(options.next.revalidate, 3600);
    assert.equal(options.credentials, "omit");
    assert.equal(options.redirect, "error");
    assert.ok(options.signal instanceof AbortSignal);
    await new Promise(resolve => setTimeout(resolve, 10));
    return fail ? new Response("bad", { status: 502 }) : Response.json({ base: "USD", timestamp: Math.floor(Date.now() / 1000), rates: { ...FIXTURE_RATES, GBP: .8 }, ignored: true });
  };
  try {
    const { GET } = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));
    const a = GET(), b = GET();
    const ra = await a, rb = await b;
    assert.equal(count, 1); assert.equal(ra.status, 200);
    assert.match(ra.headers.get("Cache-Control"), /s-maxage=3600/);
    assert.deepEqual(await ra.json(), await rb.json());
    fail = true;
    const unavailable = await GET();
    assert.equal(unavailable.status, 503);
    assert.equal(unavailable.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(await unavailable.json(), { error: "FX_UNAVAILABLE" });
    assert.equal((await GET()).status, 503);
    assert.equal(count, 2);
  } finally { globalThis.fetch = originalFetch; }
});
test("fundamentals expose five full years plus YTD and six consecutive standalone quarters", () => {
  assert.deepEqual(FUNDAMENTALS.annual.map(p => p.id), ["2021", "2022", "2023", "2024", "2025", "2026-ytd"]);
  assert.deepEqual(FUNDAMENTALS.quarterly.map(p => p.id), ["2025-q2", "2025-q3", "2025-q4", "2026-q1", "2026-q2", "2026-q3"]);
  assert.deepEqual(FUNDAMENTAL_METRICS.map(m => m.key), ["revenue", "revenueYoy", "netProfit", "netProfitYoy", "grossMargin", "capex", "fixedAssets", "inventoryDays"]);
  for (const p of [...FUNDAMENTALS.annual, ...FUNDAMENTALS.quarterly]) {
    assert.equal(Object.keys(p.values).length, 8);
    for (const value of Object.values(p.values)) assert.ok(Number.isFinite(value));
  }
});
test("YTD compares like periods and uses weighted margins and end-period asset balances", () => {
  const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
  const annual = FUNDAMENTALS.annual.at(-2).values;
  close(annual.revenue, 28.6); close(annual.netProfit, 7.68); close(annual.grossMargin, 41.8);
  const ytd = FUNDAMENTALS.annual.at(-1).values;
  close(ytd.revenue, 25.9); close(ytd.netProfit, 6.784); close(ytd.capex, 2.62); close(ytd.fixedAssets, 9.9);
  close(ytd.revenueYoy, (25.9 / 19.2 - 1) * 100);
  close(ytd.netProfitYoy, (6.784 / 4.92 - 1) * 100);
  close(ytd.grossMargin, 11.106 / 25.9 * 100);
  close(ytd.inventoryDays, ((2.8 + 3.1) / 2) / (25.9 - 11.106) * 273);
  const q3 = FUNDAMENTALS.quarterly.at(-1).values;
  close(q3.revenue, 9.4); close(q3.netProfit, 2.528); close(q3.capex, .96);
  close(q3.revenueYoy, (9.4 / 7.3 - 1) * 100);
  close(q3.netProfitYoy, (2.528 / 1.97 - 1) * 100);
  close(q3.inventoryDays, ((3.05 + 3.1) / 2) / (9.4 - 4.089) * 92);
  for (const p of FUNDAMENTALS.quarterly) {
    const [year, q] = p.id.split("-q").map(Number);
    const prior = DEMO_QUARTERS.find(p => p.year === year - 1 && p.quarter === q);
    close(p.values.revenueYoy, (p.values.revenue / prior.revenue - 1) * 100);
  }
  assert.equal(formatFundamental(ytd.revenueYoy, "yoy"), "+34.9%");
  assert.equal(formatFundamental(q3.revenue, "amount"), "9.40");
  assert.equal(formatFundamental(null, "yoy"), "—");
  assert.equal(yearOverYear(1, 0), null); assert.equal(yearOverYear(1, undefined), null);
});
test("valuation distinguishes implied earnings from the editable scenario", () => {
  const m = valuation(25, 4.1);
  assert.ok(Math.abs(m.impliedEps - 3.456) < 1e-10);
  assert.ok(Math.abs(m.impliedGrowth - 20) < 1e-10);
  assert.ok(Math.abs(m.target - 102.5) < 1e-10);
  assert.equal(valuation(30, 5).target, 150);
  assert.ok(Number.isFinite(valuation(NaN, Infinity).target));
});
test("standalone preview keeps business data local and permits only its dedicated public FX feed", async () => {
  const page = await readFile(new URL("../src/app/preview/company-board/page.tsx", import.meta.url), "utf8");
  assert.ok(!page.includes("DatabaseProvider"));
  for (const file of ["CompanyBoardPreview.tsx", "MarketChart.tsx", "Fundamentals.tsx", "fundamentalsData.ts", "currency.ts", "model.ts"]) {
    const source = await readFile(new URL(`../src/components/company-board-preview/${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /fetch\(|\/api\/|indexedDB|@\/stores|@\/lib\/account|@\/lib\/db|@\/hooks/);
  }
  const fx = await readFile(new URL("../src/components/company-board-preview/useExchangeRates.ts", import.meta.url), "utf8");
  assert.doesNotMatch(fx, /\/api\/|indexedDB|@\/stores|@\/lib\/account|@\/lib\/db/);
  assert.equal((fx.match(/fetch\(/g) ?? []).length, 1);
  assert.match(fx, /credentials: "omit"/);
  assert.match(fx, /referrerPolicy: "no-referrer"/);
});
