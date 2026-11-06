import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const origin = process.env.TEST_ORIGIN ?? "http://127.0.0.1:3026";
assert.equal(new URL(origin).hostname, "127.0.0.1");
const artifacts = new URL("../.local/company-board-preview/", import.meta.url);
const path = "/preview/company-board/nvda";
const key = "zhinote:company-target-valuation:v1:NASDAQ-NVDA";

test("targets convert locally, persist separately, follow currency, validate input, and fit desktop/mobile", { timeout: 120000 }, async () => {
  await mkdir(artifacts, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const forbidden = [], errors = [];
  let fxRequests = 0;
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, serviceWorkers: "block" });
    await context.route("**/*", route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin || url.pathname.startsWith("/api/")) { forbidden.push(url.pathname); return route.abort(); }
      if (url.pathname === "/preview/company-board/exchange-rates") {
        fxRequests++;
        return route.fulfill({ json: { base: "USD", timestamp: Math.floor(Date.now() / 1000), rates: { USD: 1, CNY: 7, EUR: .9, JPY: 150, TWD: 32, KRW: 1400 } } });
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(origin + path);
    const panel = page.getByTestId("target-valuation");
    const price = panel.getByRole("textbox", { name: "目标价", exact: true });
    const cap = panel.getByRole("textbox", { name: "目标市值", exact: true });
    const shares = panel.getByRole("textbox", { name: "目标估值股本", exact: true });
    await price.waitFor();
    await page.waitForFunction(() => !document.querySelector('input[aria-label="目标价"]').disabled);
    assert.equal(await price.inputValue(), ""); assert.equal(await cap.inputValue(), "");
    assert.equal(await shares.inputValue(), "241");
    assert.equal(fxRequests, 0);
    await price.fill("200");
    assert.equal(await cap.inputValue(), "4.82");
    await cap.fill("6.025");
    assert.equal(await price.inputValue(), "250");
    await panel.getByLabel("目标估值股本口径").selectOption("custom");
    await shares.fill("200");
    assert.equal(await cap.inputValue(), "6.025"); assert.equal(await price.inputValue(), "301.25");
    await shares.fill("0");
    assert.equal(await price.inputValue(), ""); assert.equal(await cap.inputValue(), "6.025");
    await panel.getByRole("alert").getByText("请填写大于 0 的股本，才能换算。", { exact: true }).waitFor();
    await panel.getByLabel("目标估值股本口径").selectOption("reported");
    assert.equal(await price.inputValue(), "250");
    await panel.getByLabel("目标市值单位").selectOption("hundredMillion");
    assert.equal(await cap.inputValue(), "60250");
    await panel.getByLabel("目标市值单位").selectOption("trillion");
    await panel.getByLabel("目标估值币种").selectOption("CNY");
    await page.waitForFunction(() => document.querySelector('input[aria-label="目标价"]').value === "1750");
    assert.equal(await cap.inputValue(), "42.175");
    await price.fill("1751"); await price.fill("1750");
    await price.press("Tab");
    assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).amount, key), 250);
    const before = await page.evaluate(key => localStorage.getItem(key), key);
    await cap.focus(); await cap.press("Tab");
    assert.equal(await page.evaluate(key => localStorage.getItem(key), key), before, "focus alone must not round saved values");
    await page.reload();
    await page.waitForFunction(() => document.querySelector('input[aria-label="目标价"]').value === "1750");
    assert.equal(await cap.inputValue(), "42.175");
    assert.equal(fxRequests, 1, "no FX request per target input, same-session reload uses cache");
    await price.fill(""); assert.equal(await cap.inputValue(), "");
    await price.fill("0"); assert.equal(await cap.inputValue(), "0");
    await price.fill("-1"); assert.equal(await cap.inputValue(), "");
    assert.equal(await panel.getByRole("alert").textContent(), "请输入有效的非负金额。");
    await price.fill("1e300"); assert.equal(await cap.inputValue(), "");
    assert.equal(await panel.getByRole("alert").textContent(), "金额超出可计算范围，请调小输入值。");
    await price.fill("1750"); await price.press("Tab");

    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await panel.scrollIntoViewIfNeeded();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.querySelector("main").scrollWidth > document.querySelector("main").clientWidth + 1), false);
      const a = await price.boundingBox(), b = await cap.boundingBox();
      assert.ok(a && b && (a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y));
      await page.screenshot({ path: new URL(`target-valuation-${width}.png`, artifacts).pathname });
    }

    await page.goto(origin + "/preview/company-board");
    await price.fill("100"); assert.equal(await cap.inputValue(), "320");
    await price.press("Tab");
    await page.getByLabel("显示币种", { exact: true }).selectOption("USD");
    await page.waitForFunction(() => Math.abs(Number(document.querySelector('input[aria-label="目标价"]').value) - 100 / 7) < 1e-8);
    await price.fill("20"); assert.ok(Math.abs(Number(await cap.inputValue()) - 64) < 1e-8);
    await price.press("Tab");
    await panel.scrollIntoViewIfNeeded();
    await page.screenshot({ path: new URL("target-valuation-demo-mobile.png", artifacts).pathname });
    await page.goto(origin + path);
    await page.waitForFunction(() => document.querySelector('input[aria-label="目标价"]').value === "1750");
    assert.equal(await cap.inputValue(), "42.175");
    assert.deepEqual(forbidden, []); assert.deepEqual(errors, []);

    await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException("Test storage denied", "QuotaExceededError"); }; });
    await price.fill("1400"); assert.equal(await cap.inputValue(), "33.74");
    await panel.getByText("无法保留本次输入，刷新后可能丢失。", { exact: true }).waitFor();
    console.log(JSON.stringify({ conversions: "both directions", persistence: "isolated local only", fxRequests, businessRequests: 0, responsiveWidths: [1440, 768, 390], artifacts: artifacts.pathname }));
  } finally { await browser.close(); }
});
