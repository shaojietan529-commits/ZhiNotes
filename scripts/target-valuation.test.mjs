import assert from "node:assert/strict";
import { test } from "node:test";
import { CAP_UNITS, NVIDIA_SHARE_BASIS, DEMO_SHARE_BASIS, calculateTarget, createTargetDraft, parseTargetNumber, readTargetDraft, targetDraftKey } from "../src/components/company-board-preview/target-valuation.ts";
import { convertMoney } from "../src/components/company-board-preview/currency.ts";

test("price and market cap convert in both directions without changing the authoritative amount", () => {
  const shares = NVIDIA_SHARE_BASIS.shares;
  assert.deepEqual(calculateTarget("price", 200, shares), { price: 200, marketCap: 4.82e12, overflow: false });
  assert.deepEqual(calculateTarget("marketCap", 6.025e12, shares), { price: 250, marketCap: 6.025e12, overflow: false });
  assert.deepEqual(calculateTarget("marketCap", 6.025e12, 20e9), { price: 301.25, marketCap: 6.025e12, overflow: false });
  assert.equal(calculateTarget("price", 200, 20e9).price, 200);
  assert.equal(calculateTarget("price", 100, DEMO_SHARE_BASIS.shares).marketCap, 32e9);
});

test("blank, zero, invalid shares and extreme input never yield misleading targets", () => {
  for (const source of ["price", "marketCap"]) {
    assert.deepEqual(calculateTarget(source, null, 100), { price: null, marketCap: null, overflow: false });
    assert.deepEqual(calculateTarget(source, 0, 100), { price: 0, marketCap: 0, overflow: false });
    for (const amount of [-1, NaN, Infinity]) assert.equal(calculateTarget(source, amount, 100).overflow, true);
    for (const shares of [null, 0, -1, NaN, Infinity]) {
      const result = calculateTarget(source, 100, shares);
      assert.equal(result[source], 100);
      assert.equal(result[source === "price" ? "marketCap" : "price"], null);
    }
  }
  assert.equal(calculateTarget("price", 1e300, 1e20).overflow, true);
  assert.equal(calculateTarget("marketCap", Number.MIN_VALUE, 1e20).overflow, true);
});

test("decimal parser accepts incomplete decimal typing, rejects negative and nonnumeric input", () => {
  for (const value of ["", " "]) assert.equal(parseTargetNumber(value), null);
  for (const [text, number] of [["0", 0], [".25", .25], ["250.", 250], ["6.025", 6.025], ["1e3", 1000]]) assert.equal(parseTargetNumber(text), number);
  for (const value of ["-1", "NaN", "Infinity", "1e999", "0x10", "abc", ".", "1,2"]) assert.ok(Number.isNaN(parseTargetNumber(value)));
});

test("currency and market cap units scale the display without altering the quote-currency target", () => {
  const rates = { USD: 1, CNY: 7, EUR: .9, JPY: 150, TWD: 32, KRW: 1400 };
  const marketCap = 6.025e12;
  assert.equal(marketCap / CAP_UNITS.trillion.scale, 6.025);
  assert.equal(marketCap / CAP_UNITS.hundredMillion.scale, 60250);
  const price = calculateTarget("marketCap", marketCap, NVIDIA_SHARE_BASIS.shares).price;
  assert.equal(convertMoney(price, "USD", "CNY", rates), 1750);
  for (const currency of Object.keys(rates)) {
    assert.ok(Math.abs(convertMoney(convertMoney(price, "USD", currency, rates), currency, "USD", rates) - price) < 1e-9);
  }
});

test("target drafts persist per company, default to empty and reject incompatible or corrupt data", () => {
  const d = { ...createTargetDraft("NASDAQ-NVDA", "trillion"), source: "marketCap", amount: 6.025e12, currency: "CNY", shareMode: "custom", customShares: 20e9 };
  assert.deepEqual(readTargetDraft(JSON.stringify(d), d.companyId, "trillion"), d);
  assert.equal(readTargetDraft(JSON.stringify(d), "DEMO").amount, null);
  assert.notEqual(targetDraftKey(d.companyId), targetDraftKey("DEMO"));
  assert.equal(createTargetDraft("NEW").amount, null);
  for (const raw of [null, "null", "[]", "invalid", ...[{ amount: -1 }, { amount: "250" }, { version: 2 }, { customShares: 0 }, { customShares: -10 }, { capUnit: "invalid" }, { currency: "invalid" }, { source: "invalid" }, { shareMode: "invalid" }].map(patch => JSON.stringify({ ...d, ...patch }))]) {
    assert.deepEqual(readTargetDraft(raw, d.companyId, "trillion"), createTargetDraft(d.companyId, "trillion"));
  }
  assert.equal(NVIDIA_SHARE_BASIS.currency, "USD");
  assert.equal(NVIDIA_SHARE_BASIS.asOf, "2026-08-21");
  assert.equal(new URL(NVIDIA_SHARE_BASIS.url).hostname, "www.sec.gov");
});
