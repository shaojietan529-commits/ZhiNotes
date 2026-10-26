// Synthetic positions only; all business APIs and external origins are intercepted.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const base = new URL(process.env.PORTFOLIO_TEST_URL ?? "http://127.0.0.1:3026");
const production = process.env.PORTFOLIO_PUBLIC_ASSETS === "1" &&
  ["https://zhi-note.com", "https://www.zhi-note.com"].includes(base.origin);
assert.ok(!base.username && !base.password &&
  (["localhost", "127.0.0.1"].includes(base.hostname) || production));
const artifacts = resolve(production ? `.local/rebalance-close-production-verification/${base.hostname}` :
  ".local/rebalance-close-verification");
const now = "2026-10-26T00:00:00.000Z";
const position = (ticker, nmv) => ({
  key: `${ticker} US`, ticker, name: `Synthetic ${ticker}`, nmv, gmv: Math.abs(nmv),
  pnlDaily: 0, pnlMtd: 0, pnlYtd: 0, pnlItd: 0, priceChange1dPct: 0,
  country: "US", sector: "Synthetic",
});
const initial = {
  snapshot: { importedAt: now, sourceName: "synthetic-rebalance.xlsx", positions: [
    position("LONG", 1234567.89), position("SHORT", -765432.1), position("ZERO", 0),
  ] },
  tagMap: {}, aiExposureMap: {}, allocation: 10000000, maxNetPct: 12,
  lastEmailMessageId: null, updatedAt: now,
};
const version = { scope: "a".repeat(64),
  revision: createHash("sha256").update(JSON.stringify(initial)).digest("hex") };

for (const [name, viewport] of Object.entries({ desktop: { width: 1440, height: 1000 }, mobile: { width: 390, height: 844 } })) {
  test(`close-position drafts set exact full amounts and closing directions on ${name}`, { timeout: 90000 }, async () => {
    const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome" });
    try {
      const context = await browser.newContext({ viewport, serviceWorkers: "block" });
      const forbidden = [], errors = [];
      await context.route("**/*", async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.origin !== base.origin) return route.abort();
        const json = (body, status = 200) => route.fulfill({ status, json: body });
        if (url.pathname === "/api/account/me") return json({ authenticated: true,
          account: { id: "synthetic", email_hint: "s***@example.invalid", display_name: "Synthetic", createdAt: now } });
        if (url.pathname === "/api/account/sync-events") return route.fulfill({ status: 204 });
        if (url.pathname === "/api/portfolio/account-sync") {
          const body = request.postDataJSON();
          assert.equal(body.expectedAccountId, "synthetic");
          if (body.action === "shares") return json({ accountId: "synthetic", members: [], sharedWithMe: [] });
          if (body.action === "pull") return json({ accountId: "synthetic", data: initial, version });
          forbidden.push(`portfolio:${body.action}`);
        }
        if (url.pathname === "/api/portfolio/rebalance-export" || url.pathname.startsWith("/api/ai/")) forbidden.push(url.pathname);
        if (url.pathname.startsWith("/api/")) return json({ error: "Blocked synthetic test" }, 501);
        if (request.method() === "GET" && (url.pathname === "/portfolio" || url.pathname.startsWith("/_next/static/") ||
          url.pathname.startsWith("/brand/") || url.pathname === "/favicon.ico")) return route.continue();
        return route.abort();
      });
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${base.origin}/portfolio`);
      await page.getByRole("button", { name: /账号已同步/ }).waitFor();
      if (name === "mobile") await page.getByTitle("收起侧边栏", { exact: true }).click();
      await page.getByRole("button", { name: "调仓模拟", exact: true }).click();
      const section = page.locator("section").filter({ has: page.getByRole("heading", { name: "调仓输入", exact: true }) });
      const row = (key) => section.locator("tbody tr").filter({ has: page.getByText(key, { exact: true }) });
      const amount = (key) => row(key).getByLabel(`${key} 交易金额 ($k)`, { exact: true });
      const action = (key) => row(key).getByLabel(`${key} 交易方向`, { exact: true });
      const close = (key) => row(key).getByRole("button", { name: `${key} 清仓`, exact: true });

      assert.equal(await close("ZERO US").isDisabled(), true);
      assert.equal(await row("ZERO US").getByTitle("确认调仓", { exact: true }).isDisabled(), true);
      await amount("SHORT US").fill("12.34");
      await action("SHORT US").selectOption("sellshort");
      await action("LONG US").selectOption("buy");
      await amount("LONG US").fill("9");
      await close("LONG US").click();
      assert.equal(await amount("LONG US").inputValue(), "1234.56789");
      assert.equal(await amount("LONG US").evaluate((input) => input.checkValidity()), true);
      assert.equal(await action("LONG US").inputValue(), "sell");
      assert.equal(await amount("SHORT US").inputValue(), "12.34", "other drafts are unchanged");
      assert.equal(await action("SHORT US").inputValue(), "sellshort");
      assert.equal(await row("LONG US").getByText("已清仓", { exact: true }).count(), 0, "prefill does not confirm");
      assert.equal(await section.getByTitle("取消调仓", { exact: true }).count(), 0);
      assert.equal(await section.getByRole("button", { name: /导出并发送/ }).count(), 0);

      // The amount remains editable; repeated clicks replace the draft, never add trades.
      await amount("LONG US").fill("100");
      await close("LONG US").click();
      await close("LONG US").click();
      assert.equal(await amount("LONG US").inputValue(), "1234.56789");
      const inputBox = await amount("LONG US").boundingBox();
      const buttonBox = await close("LONG US").boundingBox();
      assert.ok(inputBox && buttonBox && buttonBox.x >= inputBox.x + inputBox.width &&
        Math.abs(inputBox.y - buttonBox.y) < 4, "close button stays next to the amount without overlap");
      await mkdir(artifacts, { recursive: true });
      await page.screenshot({ path: resolve(artifacts, `${name}-close-draft.png`) });
      await row("LONG US").getByTitle("确认调仓", { exact: true }).click();
      await row("LONG US").getByText("已清仓", { exact: true }).waitFor();
      assert.equal(await row("LONG US").locator("td").nth(6).innerText(), "1,234.56789");
      await row("LONG US").getByTitle("取消调仓", { exact: true }).click();
      assert.equal(await row("LONG US").getByText("已清仓", { exact: true }).count(), 0);
      await close("LONG US").click();
      assert.equal(await amount("LONG US").inputValue(), "1234.56789");
      await row("LONG US").getByTitle("确认调仓", { exact: true }).click();
      await row("LONG US").getByText("已清仓", { exact: true }).waitFor();

      await close("SHORT US").click();
      assert.equal(await amount("SHORT US").inputValue(), "765.4321");
      assert.equal(await action("SHORT US").inputValue(), "buytocover");
      await row("SHORT US").getByTitle("确认调仓", { exact: true }).click();
      await row("SHORT US").getByText("已清仓", { exact: true }).waitFor();
      assert.equal(await section.getByText("已清仓", { exact: true }).count(), 2);
      await section.getByText("2 笔交易", { exact: true }).waitFor();
      await page.waitForTimeout(2200);
      assert.deepEqual(forbidden, [], "simulation must not upload, call AI, or send trading instructions");
      assert.deepEqual(errors, []);
      await page.reload();
      await page.getByRole("button", { name: /账号已同步/ }).waitFor();
      await page.getByRole("button", { name: "调仓模拟", exact: true }).click();
      assert.equal(await section.getByText("已清仓", { exact: true }).count(), 0, "simulation never changes actual positions");
      await close("LONG US").click();
      assert.equal(await amount("LONG US").inputValue(), "1234.56789");
      assert.deepEqual(forbidden, []);
    } finally { await browser.close(); }
  });
}
