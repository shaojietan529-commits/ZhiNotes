// Native browser storage only; isolated origins, synthetic accounts, no real APIs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const sources = Object.fromEntries(["portfolioLocalDatabase", "portfolioStorageScope"].map((name) => [name,
  ts.transpileModule(readFileSync(new URL(`../src/lib/portfolio/${name}.ts`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
]));

async function fixture(t) {
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome" });
  t.after(() => browser.close());
  const context = await browser.newContext();
  await context.route("**/*", (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Synthetic portfolio storage</title>" }));
  await context.addInitScript((sources) => {
    window.syntheticAccountId = "synthetic-a";
    const modules = {};
    const require = (name) => {
      if (name === "@/lib/account/clientSession") return { getLastAuthenticatedAccount: () =>
        window.syntheticAccountId ? { id: window.syntheticAccountId } : null };
      if (name === "./portfolioAccountContext") return { capturePortfolioAccountContext: () => ({ accountId: window.syntheticAccountId }) };
      const key = name.replace(/^\.\//, "");
      if (!modules[key]) {
        const loadedModule = { exports: {} };
        new Function("require", "module", "exports", sources[key])(require, loadedModule, loadedModule.exports);
        modules[key] = loadedModule.exports;
      }
      return modules[key];
    };
    window.backend = require("./portfolioLocalDatabase");
    window.persistence = require("./portfolioStorageScope");
    window.rawRecord = async (scope, edit) => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open("zhinote-portfolio", 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      try {
        return await new Promise((resolve, reject) => {
          const tx = db.transaction("accounts", edit ? "readwrite" : "readonly");
          const store = tx.objectStore("accounts");
          const request = store.get(scope);
          let record;
          request.onsuccess = () => {
            record = request.result;
            if (edit) {
              record = edit(record);
              if (record === undefined) store.delete(scope); else store.put(record, scope);
            }
          };
          tx.oncomplete = () => resolve(record);
          tx.onabort = () => reject(tx.error);
        });
      } finally { db.close(); }
    };
  }, sources);
  const page = await context.newPage();
  await page.goto("http://portfolio-storage.test/");
  return { page, context };
}

test("native migration: scoped content, queue and recovery copied; originals and other accounts untouched", { timeout: 30000 }, async (t) => {
  const { page } = await fixture(t);
  const result = await page.evaluate(async () => {
    const p = window.persistence, db = window.backend;
    const scope = p.getPortfolioStorageScope(), key = (name) => `zhinote.portfolio.${name}`;
    const values = Object.fromEntries(db.PORTFOLIO_LOCAL_VALUE_KEYS.map((name) => [name, null]));
    values[key("tags.v1")] = JSON.stringify({ SAMPLE: "confirmed" });
    values[key("sync.status.v1")] = "synthetic-pending-record";
    localStorage.setItem(p.portfolioStorageKey(key("state.v2"), scope), JSON.stringify({ format: 2, values }));
    localStorage.setItem(p.portfolioStorageKey(key("tags.v1"), scope), JSON.stringify({ SAMPLE: "older" }));
    localStorage.setItem(p.portfolioStorageKey(key("conflict.review.v1.synthetic"), scope), "synthetic-recovery-copy");
    localStorage.setItem(p.portfolioStorageKey(key("syncPasscode.v1"), scope), "synthetic-passcode");
    localStorage.setItem(key("tags.v1"), JSON.stringify({ UNOWNED: "review-first" }));
    localStorage.setItem(p.portfolioStorageKey(key("tags.v1"), "account:synthetic-b"), JSON.stringify({ OTHER: "only-b" }));
    const originals = Object.fromEntries(Object.entries(localStorage));
    await p.hydratePortfolioStorage(scope);
    const record = await window.rawRecord(scope);
    const oldKeysUnchanged = Object.entries(originals).every(([name, value]) => localStorage.getItem(name) === value);
    window.syntheticAccountId = "synthetic-b";
    await p.hydratePortfolioStorage();
    const bTags = JSON.parse(p.portfolioStorage().getItem(key("tags.v1")));
    return { record, oldKeysUnchanged, bTags, passcodeCopied: JSON.stringify(record).includes("synthetic-passcode") };
  });
  assert.equal(result.oldKeysUnchanged, true);
  assert.equal(result.passcodeCopied, false);
  assert.equal(result.record.values["zhinote.portfolio.tags.v1"], '{"SAMPLE":"confirmed"}');
  assert.equal(result.record.values["zhinote.portfolio.sync.status.v1"], "synthetic-pending-record");
  assert.equal(result.record.values["zhinote.portfolio.conflict.review.v1.synthetic"], "synthetic-recovery-copy");
  assert.deepEqual(result.bTags, { OTHER: "only-b" });
  assert.ok(!JSON.stringify(result.record).includes("UNOWNED"));
});

test("native abort after put success rolls back content and queue, preserves memory, emits no success", { timeout: 30000 }, async (t) => {
  const { page } = await fixture(t);
  const result = await page.evaluate(async () => {
    const p = window.persistence, scope = p.getPortfolioStorageScope();
    await p.hydratePortfolioStorage(scope);
    const before = JSON.stringify(await window.rawRecord(scope));
    let notified = 0, putSucceeded = false, rejected = false;
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      const request = put.apply(this, args);
      request.addEventListener("success", () => { putSucceeded = true; this.transaction.abort(); });
      return request;
    };
    window.addEventListener(p.PORTFOLIO_STORAGE_EVENT, () => { notified++; });
    try {
      await p.withPortfolioStorageLock(scope, () => {
        p.portfolioStorage().setItem("zhinote.portfolio.tags.v1", '{"SAMPLE":"unsaved"}');
        p.portfolioStorage().setItem("zhinote.portfolio.sync.status.v1", "unsaved-pending");
        p.afterPortfolioStorageCommit(scope, () => { notified++; });
      });
    } catch { rejected = true; }
    IDBObjectStore.prototype.put = put;
    return { putSucceeded, rejected, notified, diskUnchanged: before === JSON.stringify(await window.rawRecord(scope)),
      memoryUnchanged: before === JSON.stringify(window.backend.cachedPortfolioRecord(scope)) };
  });
  assert.deepEqual(result, { putSucceeded: true, rejected: true, notified: 0, diskUnchanged: true, memoryUnchanged: true });
});

test("native reload never reimports a late old-client write over newer saved work", { timeout: 30000 }, async (t) => {
  const { page } = await fixture(t);
  await page.evaluate(async () => {
    const p = window.persistence, scope = p.getPortfolioStorageScope(), tagKey = "zhinote.portfolio.tags.v1";
    localStorage.setItem(p.portfolioStorageKey(tagKey, scope), '{"SAMPLE":"old original"}');
    await p.hydratePortfolioStorage();
    await p.withPortfolioStorageLock(scope, () => p.portfolioStorage().setItem(tagKey, '{"SAMPLE":"new store"}'));
    localStorage.setItem(p.portfolioStorageKey(tagKey, scope), '{"SAMPLE":"late older client"}');
  });
  await page.reload();
  const result = await page.evaluate(async () => {
    const p = window.persistence, scope = p.getPortfolioStorageScope(), tagKey = "zhinote.portfolio.tags.v1";
    await p.hydratePortfolioStorage();
    const record = await window.rawRecord(scope);
    return { current: p.portfolioStorage().getItem(tagKey), source: record.legacySource[tagKey],
      lateLegacy: localStorage.getItem(p.portfolioStorageKey(tagKey, scope)) };
  });
  assert.deepEqual(result, { current: '{"SAMPLE":"new store"}', source: '{"SAMPLE":"old original"}',
    lateLegacy: '{"SAMPLE":"late older client"}' });
});

for (const useLocks of [true, false]) {
  test(`native two-tab updates: all 200 changes survive with Web Locks ${useLocks ? "enabled" : "unavailable"}`, { timeout: 60000 }, async (t) => {
    const { page, context } = await fixture(t);
    const other = await context.newPage();
    await other.goto("http://portfolio-storage.test/");
    await page.evaluate(() => window.persistence.hydratePortfolioStorage());
    await other.evaluate(() => window.persistence.hydratePortfolioStorage());
    const increment = async (page, field) => page.evaluate(async ({ field, useLocks }) => {
      if (!useLocks) Object.defineProperty(navigator, "locks", { configurable: true, value: undefined });
      const p = window.persistence, scope = p.getPortfolioStorageScope();
      for (let i = 0; i < 100; i++) await p.withPortfolioStorageLock(scope, () => {
        const store = p.portfolioStorage();
        const tags = JSON.parse(store.getItem("zhinote.portfolio.tags.v1") ?? "{}");
        tags[field] = (tags[field] ?? 0) + 1;
        store.setItem("zhinote.portfolio.tags.v1", JSON.stringify(tags));
        store.setItem("zhinote.portfolio.sync.status.v1", String((tags.a ?? 0) + (tags.b ?? 0)));
      });
    }, { field, useLocks });
    // Deliberate test concurrency: distinct tabs compete for the same native record.
    await Promise.all([increment(page, "a"), increment(other, "b")]);
    const result = await page.evaluate(async () => {
      await window.persistence.hydratePortfolioStorage();
      const record = await window.rawRecord("account:synthetic-a");
      return { tags: JSON.parse(record.values["zhinote.portfolio.tags.v1"]), pending: record.values["zhinote.portfolio.sync.status.v1"] };
    });
    assert.deepEqual(result, { tags: { a: 100, b: 100 }, pending: "200" });
    await other.reload();
    assert.equal(await other.evaluate(async () => {
      await window.persistence.hydratePortfolioStorage();
      return window.persistence.portfolioStorage().getItem("zhinote.portfolio.sync.status.v1");
    }), "200");
  });
}

test("native invalid/missing records cannot silently import old values or erase the cached copy", { timeout: 30000 }, async (t) => {
  const { page } = await fixture(t);
  const results = await page.evaluate(async () => {
    const p = window.persistence, scope = p.getPortfolioStorageScope();
    await p.hydratePortfolioStorage();
    const original = await window.rawRecord(scope);
    const results = [];
    for (const bad of [{ ...original, values: {} }, { ...original, scope: "account:other" }, undefined]) {
      await window.rawRecord(scope, () => bad);
      let readRejected = false, writeRejected = false, called = false;
      try { await p.hydratePortfolioStorage(); } catch { readRejected = true; }
      try { await p.withPortfolioStorageLock(scope, () => { called = true; }); } catch { writeRejected = true; }
      results.push({ readRejected, writeRejected, called, diskUnchanged: JSON.stringify(await window.rawRecord(scope)) === JSON.stringify(bad),
        memoryUnchanged: JSON.stringify(window.backend.cachedPortfolioRecord(scope)) === JSON.stringify(original) });
      await window.rawRecord(scope, () => original);
    }
    return results;
  });
  for (const result of results) assert.deepEqual(result, { readRejected: true, writeRejected: true, called: false, diskUnchanged: true, memoryUnchanged: true });
});

test("native failed open can retry; malformed old cache remains intact and is not adopted", { timeout: 30000 }, async (t) => {
  const { page } = await fixture(t);
  const result = await page.evaluate(async () => {
    const p = window.persistence, scope = p.getPortfolioStorageScope();
    const open = IDBFactory.prototype.open;
    IDBFactory.prototype.open = () => { throw new DOMException("Synthetic storage disabled", "SecurityError"); };
    let openRejected = false, malformedRejected = false;
    try { await p.hydratePortfolioStorage(); } catch { openRejected = true; }
    IDBFactory.prototype.open = open;
    const oldKey = p.portfolioStorageKey("zhinote.portfolio.state.v2", scope);
    localStorage.setItem(oldKey, "synthetic-corrupt-record");
    try { await p.hydratePortfolioStorage(); } catch { malformedRejected = true; }
    const untouched = localStorage.getItem(oldKey) === "synthetic-corrupt-record" && await window.rawRecord(scope) === undefined;
    localStorage.removeItem(oldKey); // Only the isolated synthetic fixture is repaired.
    await p.hydratePortfolioStorage();
    return { openRejected, malformedRejected, untouched, ready: p.isPortfolioStorageReady(scope) };
  });
  assert.deepEqual(result, { openRejected: true, malformedRejected: true, untouched: true, ready: true });
});
