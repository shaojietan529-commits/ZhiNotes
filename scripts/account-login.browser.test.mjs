// Isolated profiles and synthetic API responses only; never sends a real email.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const origin = new URL(process.env.LOGIN_TEST_URL ?? "http://127.0.0.1:3026").origin;
const production = process.env.LOGIN_TEST_PRODUCTION_ALLOWED === "true";
assert.ok(production
  ? ["https://zhi-note.com", "https://www.zhi-note.com"].includes(origin)
  : ["127.0.0.1", "localhost"].includes(new URL(origin).hostname));
const artifacts = new URL(production
  ? "../.local/account-login-production-verification/"
  : "../.local/account-login-verification/", import.meta.url);
mkdirSync(artifacts, { recursive: true });

for (const width of [1440, 390]) {
  test(`login failure categories and recovery at ${width}px`, { timeout: 90000 }, async () => {
    const browser = await chromium.launch({ channel: "chrome", headless: true });
    let reply = { status: 502, body: "<html>upstream unavailable</html>", contentType: "text/html" };
    let sends = 0;
    const errors = [];
    try {
      const context = await browser.newContext({ viewport: { width, height: 950 }, serviceWorkers: "block" });
      await context.route("**/*", async (route) => {
        const request = route.request(), url = new URL(request.url());
        if (url.origin !== origin) return route.abort();
        if (url.pathname === "/api/account/me") return route.fulfill({ json: { authenticated: false, account: null } });
        if (url.pathname === "/api/account/login/start") {
          assert.equal(request.postDataJSON().email, "synthetic@example.invalid");
          sends++;
          return route.fulfill(reply);
        }
        if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 501, json: { error: "Synthetic isolation" } });
        if (request.method() === "GET" && (url.pathname === "/account" || url.pathname.startsWith("/_next/static/") ||
          url.pathname.startsWith("/brand/source/") || url.pathname === "/favicon.ico")) return route.continue();
        return route.abort();
      });
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${origin}/account`);
      if (width < 768) await page.getByTitle("收起侧边栏", { exact: true }).click();
      await page.getByPlaceholder("you@example.com").fill("synthetic@example.invalid");
      for (const [status, payload, expected] of [
        [502, null, "登录服务暂时不可用（502）"],
        [403, null, "登录请求被访问检查拦截"],
        [429, null, "验证码请求过于频繁"],
        [200, null, "验证码发送未获确认（200）"],
        [502, { error: "云端账号存储暂不可用，验证码尚未发送。" }, "云端账号存储暂不可用"],
      ]) {
        reply = payload ? { status, json: payload } : { status, body: "<html>unavailable</html>", contentType: "text/html" };
        const before = sends;
        await page.getByRole("button", { name: "发送验证码", exact: true }).click();
        await page.getByText(expected, { exact: false }).waitFor();
        assert.equal(sends, before + 1);
        assert.equal(await page.getByPlaceholder("000000").count(), 0);
      }
      await page.screenshot({ path: new URL(`failure-${width}.png`, artifacts).pathname, fullPage: true });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      reply = { status: 200, json: { status: "sent", email_hint: "s***@example.invalid" } };
      await page.getByRole("button", { name: "发送验证码", exact: true }).click();
      await page.getByPlaceholder("000000").waitFor();
      assert.deepEqual(errors, []);
      writeFileSync(new URL(`result-${width}.json`, artifacts), JSON.stringify({
        passed: true, width, scope: "synthetic-isolated-browser-only", origin,
        productionAssets: production, allBusinessApisIntercepted: true,
        realEmailsSent: 0, realAccountsRead: false, productionWrites: false,
      }, null, 2));
    } finally { await browser.close(); }
  });
}
