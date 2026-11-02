// Fresh Edge profiles, synthetic identities, every business API intercepted.
// Requires a local production build server; never targets a real account.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { test } from "node:test";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const base = process.env.TEST_ORIGIN ?? "http://127.0.0.1:3057";
assert.equal(new URL(base).hostname, "127.0.0.1");
const key = "zhinote:account-session-last-authenticated:v1";
const logoutKey = "zhinote:account-session-explicit-logout:v1";
const artifacts = new URL("../.local/page-responsiveness-verification/", import.meta.url);
const evidence = [];

for (const serviceStatus of [501, 429, 503]) {
  test(`two idle tabs stay bounded with sync service HTTP ${serviceStatus}`, { timeout: 60000 }, async () => {
    const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? "msedge", headless: true });
    const calls = [], errors = [];
    let account = { id: "synthetic-a", email_hint: "s***@example.invalid", display_name: "Synthetic A", createdAt: "2026-10-28" };
    try {
      const context = await browser.newContext({ serviceWorkers: "block" });
      await context.addInitScript(() => {
        const interval = window.setInterval;
        const timers = [];
        window.setInterval = (...args) => { const id = interval(...args); timers.push(id); return id; };
        window.__pauseTestPolling = () => timers.forEach(id => clearInterval(id));
      });
      await context.route("**/*", async route => {
        const req = route.request(), url = new URL(req.url());
        if (url.origin !== base) return route.abort();
        if (url.pathname.startsWith("/api/")) {
          calls.push({ path: url.pathname, at: Date.now() });
          if (calls.length > 100) {
            errors.push("Request storm exceeded test budget");
            return route.abort();
          }
          if (url.pathname === "/api/account/me") return route.fulfill({ json: { authenticated: !!account, account } });
          if (url.pathname === "/api/account/sync-events") return route.fulfill({ status: 204 });
          return route.fulfill({ status: serviceStatus, headers: { "retry-after": "120" }, json: { error: "Synthetic unavailable service", code: "unconfigured" } });
        }
        if (req.method() === "GET" && (url.pathname === "/modules/sync" || url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/brand/"))) return route.continue();
        return route.abort();
      });
      const a = await context.newPage(); a.on("pageerror", e => errors.push(e.message));
      await a.goto(base + "/modules/sync");
      await a.getByText("Synthetic A", { exact: true }).waitFor();
      await a.waitForTimeout(2500);
      const start = calls.length;
      const b = await context.newPage(); b.on("pageerror", e => errors.push(e.message));
      await b.goto(base + "/modules/sync");
      await b.getByText("Synthetic A", { exact: true }).waitFor();
      await b.waitForTimeout(4000);
      const counts = {};
      for (const call of calls.slice(start)) counts[call.path] = (counts[call.path] ?? 0) + 1;
      assert.ok((counts["/api/account/me"] ?? 0) <= 8, JSON.stringify(counts));
      assert.ok((counts["/api/pages/account-sync"] ?? 0) <= 8, JSON.stringify(counts));
      assert.ok((counts["/api/databases/account-sync"] ?? 0) <= 8, JSON.stringify(counts));
      // Leave normal polling enabled for the idle/storm observation, then
      // pause it so the renewal assertion measures only storage events.
      await a.evaluate(() => window.__pauseTestPolling());
      await b.evaluate(() => window.__pauseTestPolling());
      await b.waitForTimeout(300);
      const beforeRenewal = calls.length;
      await a.evaluate(key => {
        const record = JSON.parse(localStorage.getItem(key));
        for (let i = 0; i < 50; i++) localStorage.setItem(key, JSON.stringify({ ...record, storedAt: Date.now() + i }));
      }, key);
      await b.waitForTimeout(1000);
      assert.equal(calls.length, beforeRenewal, JSON.stringify(calls.slice(beforeRenewal)));

      // Identity and explicit logout events still reach the other tab.
      account = { ...account, id: "synthetic-b", display_name: "Synthetic B" };
      const beforeSwitch = calls.length;
      await a.evaluate(({ key, account }) => localStorage.setItem(key, JSON.stringify({ storedAt: Date.now(), account })), { key, account });
      await b.getByText("Synthetic B", { exact: true }).waitFor();
      assert.ok(calls.slice(beforeSwitch).some(call => call.path === "/api/account/me"));
      account = null;
      const beforeLogout = calls.length;
      await a.evaluate(({ key, logoutKey }) => {
        localStorage.removeItem(key);
        localStorage.setItem(logoutKey, JSON.stringify({ loggedOutAt: Date.now() }));
      }, { key, logoutKey });
      await b.getByText("Synthetic B", { exact: true }).waitFor({ state: "hidden" });
      assert.ok(calls.slice(beforeLogout).some(call => call.path === "/api/account/me"));
      assert.deepEqual(errors, []);
      evidence.push({ serviceStatus, twoTabFourSecondCounts: counts, periodicPollingPausedForRenewalAssertion: true, renewalRequests: 0, accountSwitch: true, logout: true });
      console.log(JSON.stringify(evidence.at(-1)));
    } finally {
      await browser.close();
      await mkdir(artifacts, { recursive: true });
      await writeFile(new URL("session-tabs.json", artifacts), JSON.stringify({ syntheticOnly: true, realBusinessRequests: 0, evidence, errors }, null, 2));
    }
  });
}
