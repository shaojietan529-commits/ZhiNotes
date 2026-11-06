import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const origin = process.env.TEST_ORIGIN ?? "http://127.0.0.1:3026";
const url = new URL(origin);
assert.equal(url.origin, origin);
assert.ok(url.hostname === "127.0.0.1" ||
  (url.protocol === "https:" && ["zhi-note.com", "www.zhi-note.com"].includes(url.hostname)));
const artifacts = new URL(`../.local/company-board-release/${url.hostname}/`, import.meta.url);
const realPublicFx = process.env.COMPANY_BOARD_LIVE_FX === "1";

test("released company routes, navigation, valuation and template work without real business data", { timeout: 120000 }, async () => {
  await mkdir(artifacts, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const errors = [], business = [];
  let fxRequests = 0;
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: "block" });
    await context.route("**/*", route => {
      const request = route.request(), target = new URL(request.url());
      if (target.origin !== origin) return route.abort();
      if (target.pathname.startsWith("/api/")) {
        business.push({ path: target.pathname, method: request.method() });
        return route.fulfill({ status: 401, json: { error: "Isolated signed-out fixture" } });
      }
      if (target.pathname === "/preview/company-board/exchange-rates") {
        fxRequests++;
        if (realPublicFx) return route.continue();
        return route.fulfill({ json: { base: "USD", timestamp: Math.floor(Date.now() / 1000),
          rates: { USD: 1, CNY: 7, EUR: .9, JPY: 150, TWD: 32, KRW: 1400 } } });
      }
      assert.equal(request.method(), "GET", "Only static page/asset reads may reach the server");
      return route.continue();
    });
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(origin + "/companies");
    await page.waitForURL(origin + "/companies/nvda");
    await page.getByRole("heading", { name: "英伟达", exact: true }).waitFor();
    await page.getByRole("button", { name: "编辑 Investment Thesis", exact: true }).click();
    await page.getByRole("textbox", { name: "Investment Thesis", exact: true }).fill("SYNTHETIC_RELEASE_CHECK");
    await page.getByRole("button", { name: "保存判断", exact: true }).click();
    const target = page.getByTestId("target-valuation");
    const price = target.getByRole("textbox", { name: "目标价", exact: true });
    const cap = target.getByRole("textbox", { name: "目标市值", exact: true });
    await price.fill("200");
    assert.equal(await cap.inputValue(), "4.82");
    await cap.fill("6.025");
    assert.equal(await price.inputValue(), "250");
    await cap.press("Tab");
    await page.reload();
    await page.getByText("SYNTHETIC_RELEASE_CHECK", { exact: true }).waitFor();
    await page.waitForFunction(() => document.querySelector('input[aria-label="目标价"]').value === "250");
    assert.deepEqual(business, [], "Opening and editing the board must not call business APIs");
    assert.equal(fxRequests, 0);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.getByRole("navigation", { name: "公司研究导航" }).scrollIntoViewIfNeeded();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.querySelector("main").scrollWidth > document.querySelector("main").clientWidth + 1), false);
      await page.waitForFunction(() => {
        const img = document.querySelector('img[alt="ZhiNote"]');
        return img?.complete && img.naturalWidth > 0;
      });
      assert.ok(await page.locator('img[alt="ZhiNote"]').evaluate(img => img.complete && img.naturalWidth > 0));
      await page.screenshot({ path: new URL(`nvda-${width}.png`, artifacts).pathname });
    }
    await page.getByRole("link", { name: "虚构模板", exact: true }).click();
    await page.waitForURL(origin + "/companies/template");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByText("仅本机 · 已保存", { exact: true }).waitFor();
    const fundamentals = page.locator('[data-section="fundamentals"]');
    await fundamentals.getByRole("button", { name: "最近六季度", exact: true }).click();
    assert.equal(await fundamentals.locator("thead th").count(), 7);
    const quoteResponse = page.waitForResponse(response => new URL(response.url()).pathname === "/preview/company-board/exchange-rates");
    await page.getByLabel("显示币种", { exact: true }).selectOption("USD");
    const response = await quoteResponse;
    assert.equal(response.status(), 200);
    const quote = await response.json();
    await page.waitForFunction(() => document.querySelector('[data-testid="scenario-price"]')?.textContent?.endsWith("USD"));
    assert.equal(fxRequests, 1);
    const canvas = await page.locator("canvas").evaluate(c => {
      const data = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let pixels = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 0) pixels++;
      return pixels;
    });
    assert.ok(canvas > 500);
    await page.getByRole("heading", { name: "澄芯科技", exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: new URL("template-desktop.png", artifacts).pathname });
    await page.getByRole("link", { name: "返回工作区", exact: true }).click();
    await page.waitForURL(origin + "/knowledge-base");
    const entry = page.getByRole("link", { name: /公司看板/ });
    await entry.waitFor();
    assert.equal(await entry.getAttribute("href"), "/companies/nvda");
    await entry.click();
    await page.waitForURL(origin + "/companies/nvda");
    await page.getByText("SYNTHETIC_RELEASE_CHECK", { exact: true }).waitFor();
    assert.deepEqual(errors, []);
    await writeFile(new URL("result.json", artifacts), JSON.stringify({ passed: true, origin,
      checkedAt: new Date().toISOString(), syntheticOnly: !realPublicFx, syntheticBusinessData: true, realPublicFx,
      fxProvider: quote.provider ?? "exchangerate.fun", fxTimestamp: quote.timestamp, realBusinessRequests: 0,
      interceptedBusinessRequests: business.length, fxRequests, responsiveWidths: [1440, 390],
      targetConversions: "both-directions", localRefreshPersistence: true, navigation: true, canvasPixels: canvas }, null, 2));
  } finally { await browser.close(); }
});
