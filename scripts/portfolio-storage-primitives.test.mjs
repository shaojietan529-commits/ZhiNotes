// Native-browser feasibility only; this does not exercise ZhiNotes or production data.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");

test("native storage feasibility: queued IndexedDB updates retain both fields and aborted transactions retain the prior record", async (t) => {
  const browser = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  try {
    const context = await browser.newContext();
    // No app, server, credentials or network. Same synthetic origin in separate tabs.
    await context.route("**/*", (route) => route.fulfill({ contentType: "text/html",
      body: "<!doctype html><title>Synthetic transaction experiment</title>" }));
    const a = await context.newPage(), b = await context.newPage(), keeper = await context.newPage();
    for (const page of [a, b, keeper]) {
      await page.goto("http://localhost:3007/synthetic-storage");
      await page.evaluate(async () => {
        window.syntheticDb = await new Promise((resolve, reject) => {
          const open = indexedDB.open("synthetic-portfolio-transactions", 1);
          open.onupgradeneeded = () => open.result.createObjectStore("state");
          open.onsuccess = () => resolve(open.result);
          open.onerror = () => reject(open.error);
        });
        window.syntheticUpdate = (kind, field, abort = false) => {
          if (kind === "localStorage") {
            const next = JSON.parse(localStorage.getItem("synthetic-state"));
            next[field]++;
            localStorage.setItem("synthetic-state", JSON.stringify(next));
            return Promise.resolve();
          }
          return new Promise((resolve, reject) => {
            const tx = window.syntheticDb.transaction("state", "readwrite");
            const store = tx.objectStore("state");
            const request = store.get("synthetic-account");
            request.onsuccess = () => {
              const next = request.result ?? { a: 0, b: 0, padding: "a".repeat(8000) };
              next[field]++;
              store.put(next, "synthetic-account");
              if (abort) tx.abort();
            };
            tx.oncomplete = () => resolve();
            tx.onabort = () => reject(tx.error ?? new Error("Synthetic intentional abort"));
          });
        };
        window.syntheticRead = () => new Promise((resolve, reject) => {
          const tx = window.syntheticDb.transaction("state", "readonly");
          const request = tx.objectStore("state").get("synthetic-account");
          tx.oncomplete = () => resolve(request.result);
          tx.onabort = () => reject(tx.error);
        });
      });
    }
    await a.evaluate(() => localStorage.setItem("synthetic-state", JSON.stringify({ a: 0, b: 0, padding: "a".repeat(8000) })));
    await b.waitForFunction(() => Boolean(localStorage.getItem("synthetic-state")));
    for (const kind of ["localStorage", "IndexedDB"]) {
      for (let index = 0; index < 100; index++) {
        await keeper.evaluate(() => {
          window.releaseSyntheticLock = null;
          void navigator.locks.request("synthetic-write", () => new Promise((resolve) => { window.releaseSyntheticLock = resolve; }));
        });
        await keeper.waitForFunction(() => Boolean(window.releaseSyntheticLock));
        for (const [page, field] of [[a, "a"], [b, "b"]]) {
          await page.evaluate(({ kind, field }) => {
            window.syntheticDone = false;
            window.syntheticError = null;
            void navigator.locks.request("synthetic-write", () => window.syntheticUpdate(kind, field))
              .then(() => { window.syntheticDone = true; }, (error) => { window.syntheticError = error.message; window.syntheticDone = true; });
          }, { kind, field });
        }
        await keeper.waitForFunction(async () => (await navigator.locks.query()).pending.length === 2);
        await keeper.evaluate(() => window.releaseSyntheticLock());
        for (const page of [a, b]) {
          await page.waitForFunction(() => window.syntheticDone);
          assert.equal(await page.evaluate(() => window.syntheticError), null);
        }
      }
      const result = await keeper.evaluate((kind) => kind === "localStorage"
        ? JSON.parse(localStorage.getItem("synthetic-state")) : window.syntheticRead(), kind);
      t.diagnostic(`${kind}: ${result.a + result.b}/200 independent updates retained`);
      // localStorage is deliberately diagnostic, not a claimed consistency gate.
      if (kind === "IndexedDB") {
        assert.equal(result.a, 100);
        assert.equal(result.b, 100);
      }
    }
    const before = await a.evaluate(() => window.syntheticRead());
    await assert.rejects(a.evaluate(() => window.syntheticUpdate("IndexedDB", "a", true)), /abort/i);
    assert.deepEqual(await b.evaluate(() => window.syntheticRead()), before);
    await a.close();
    await b.evaluate(() => window.syntheticUpdate("IndexedDB", "b"));
    const after = await keeper.evaluate(() => window.syntheticRead());
    assert.equal(after.a, 100);
    assert.equal(after.b, 101);
  } finally { await browser.close(); }
});
