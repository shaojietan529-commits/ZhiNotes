import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const origin = process.env.TEST_ORIGIN ?? "http://127.0.0.1:3026";
assert.equal(new URL(origin).hostname, "127.0.0.1");
const artifacts = new URL("../.local/company-board-preview/", import.meta.url);
const fxPath = "/preview/company-board/exchange-rates";
const fixtureQuote = () => ({ base: "USD", timestamp: Math.floor(Date.now() / 1000), rates: { USD: 1, CNY: 7, EUR: .9, JPY: 150, TWD: 32, KRW: 1400 } });

test("company board: layout, notes, valuation, chain membership, persistence and responsive safety", { timeout: 120000 }, async () => {
  await mkdir(artifacts, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const errors = [], businessRequests = [], externalRequests = [];
  let passed = false;
  try {
    const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, serviceWorkers: "block" });
    await context.addInitScript(() => {
      window.__demoStorageKeys = [];
      const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
      Storage.prototype.getItem = function(key) { window.__demoStorageKeys.push(key); return get.call(this, key); };
      Storage.prototype.setItem = function(key, value) { window.__demoStorageKeys.push(key); return set.call(this, key, value); };
    });
    await context.route("**/*", route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) { externalRequests.push(url.origin); return route.abort(); }
      if (url.pathname.startsWith("/api/")) { businessRequests.push(url.pathname); return route.abort(); }
      return route.continue();
    });
    const page = await context.newPage();
    page.on("pageerror", e => errors.push(e.message));
    await page.goto(origin + "/preview/company-board");
    await page.getByText("仅本机 · 已保存", { exact: true }).waitFor();
    await page.getByRole("heading", { name: "澄芯科技", exact: true }).waitFor();
    await page.waitForTimeout(600);
    assert.equal(await page.locator("[data-section]").count(), 10);
    const canvas = await page.locator("canvas").evaluate(c => {
      const data = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let pixels = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 0) pixels++;
      return { pixels, width: c.width, height: c.height };
    });
    assert.ok(canvas.pixels > 500 && canvas.width > 100 && canvas.height > 100);
    assert.ok(await page.locator('img[alt="ZhiNote"]').evaluate(i => i.complete && i.naturalWidth > 0));
    await page.screenshot({ path: new URL("desktop.png", artifacts).pathname });
    const fundamentals = page.locator('[data-section="fundamentals"]');
    const annual = fundamentals.getByRole("button", { name: "年度 + YTD", exact: true });
    const quarters = fundamentals.getByRole("button", { name: "最近六季度", exact: true });
    assert.equal(await annual.getAttribute("aria-pressed"), "true");
    assert.equal(await fundamentals.locator("tbody tr").count(), 8);
    assert.equal(await fundamentals.locator("thead th").count(), 7);
    assert.deepEqual(await fundamentals.locator("thead th:not(:first-child)").allTextContents(), ["2021全年", "2022全年", "2023全年", "2024全年", "2025全年", "2026 YTD1–9 月"]);
    assert.equal(await fundamentals.locator('[data-metric="revenue"] td').last().textContent(), "25.90");
    assert.equal(await fundamentals.locator('[data-metric="revenueYoy"] td').last().textContent(), "+34.9%");
    await fundamentals.screenshot({ path: new URL("fundamentals-annual.png", artifacts).pathname });
    await quarters.click();
    assert.equal(await quarters.getAttribute("aria-pressed"), "true");
    assert.deepEqual(await fundamentals.locator("thead th:not(:first-child)").allTextContents(), ["2025 Q2单季", "2025 Q3单季", "2025 Q4单季", "2026 Q1单季", "2026 Q2单季", "2026 Q3单季"]);
    assert.equal(await fundamentals.locator('[data-metric="revenue"] td').last().textContent(), "9.40");
    assert.equal(await fundamentals.locator('[data-metric="revenueYoy"] td').last().textContent(), "+28.8%");
    await fundamentals.screenshot({ path: new URL("fundamentals-quarterly.png", artifacts).pathname });
    await page.reload();
    await page.getByText("仅本机 · 已保存", { exact: true }).waitFor();
    assert.equal(await quarters.getAttribute("aria-pressed"), "true");
    await annual.click();
    await page.getByRole("button", { name: "1M", exact: true }).click();
    assert.equal(await page.getByRole("button", { name: "1M", exact: true }).getAttribute("aria-pressed"), "true");
    await page.getByRole("button", { name: "6M", exact: true }).click();
    await page.getByRole("button", { name: "编辑投资判断", exact: true }).click();
    await page.getByRole("textbox", { name: "Investment Thesis", exact: true }).fill("本地样板测试判断");
    await page.getByRole("button", { name: "保存判断", exact: true }).click();
    const judgment = page.locator('[data-section="thesis"]');
    assert.equal(await judgment.locator("li").count(), 6);
    await judgment.getByRole("button", { name: "更新", exact: true }).click();
    const updateDialog = page.getByRole("dialog", { name: "更新研究观点" });
    await updateDialog.getByText("澄芯科技是虚构公司，不能进行真实公开资料检索。").waitFor();
    assert.equal(await updateDialog.getByRole("button", { name: "确认更新" }).isDisabled(), true);
    await page.screenshot({ path: new URL("research-gate-desktop.png", artifacts).pathname });
    await updateDialog.getByRole("button", { name: "关闭更新窗口" }).click();
    await judgment.getByText("本地样板测试判断", { exact: true }).waitFor();
    assert.deepEqual(businessRequests, []);
    await judgment.screenshot({ path: new URL("investment-judgment.png", artifacts).pathname });
    await page.getByRole("button", { name: "调整看板", exact: true }).click();
    await page.getByRole("button", { name: "下移投资判断", exact: true }).click();
    assert.equal(await page.locator("[data-section]").first().getAttribute("data-section"), "market");
    await page.getByRole("button", { name: "将股价与交易设为整行", exact: true }).click();
    await page.getByRole("button", { name: "隐藏基本面关键数据", exact: true }).click();
    assert.equal(await page.locator('[data-section="fundamentals"]').count(), 0);
    await page.getByRole("button", { name: "添加区块", exact: true }).click();
    await page.getByLabel("区块名称", { exact: true }).fill("催化剂日历");
    await page.getByRole("dialog").getByRole("button", { name: "添加区块", exact: true }).click();
    await page.getByRole("textbox", { name: "催化剂日历", exact: true }).fill("跟踪下一次示例财报");
    await page.getByRole("button", { name: "添加区块", exact: true }).click();
    await page.getByRole("combobox", { name: "区块类型", exact: true }).selectOption("fundamentals");
    await page.getByRole("dialog").getByRole("button", { name: "添加区块", exact: true }).click();
    assert.equal(await page.locator('[data-section="fundamentals"]').count(), 1);
    await page.getByRole("button", { name: "完成调整", exact: true }).click();
    await page.getByLabel("我的 2027E EPS", { exact: true }).fill("5");
    await page.getByTestId("scenario-price").getByText("125.00 CNY", { exact: true }).waitFor();
    await page.getByRole("button", { name: "新建笔记", exact: true }).click();
    await page.getByLabel("标题", { exact: true }).fill("模板测试记录");
    await page.getByRole("textbox", { name: "正文", exact: true }).fill("仅写入隔离浏览器的样板数据");
    await page.getByRole("button", { name: "保存笔记", exact: true }).click();
    await page.getByRole("tab", { name: /笔记与资料/ }).click();
    await page.getByLabel("搜索笔记").fill("模板测试记录");
    await page.getByRole("button", { name: /模板测试记录/ }).click();
    assert.equal(await page.getByRole("textbox", { name: "正文", exact: true }).inputValue(), "仅写入隔离浏览器的样板数据");
    await page.getByRole("button", { name: "关闭对话框", exact: true }).click();
    await page.getByRole("tab", { name: /产业链关系/ }).click();
    await page.getByRole("button", { name: "添加归属", exact: true }).click();
    await page.getByRole("combobox", { name: "产业链", exact: true }).selectOption("工业自动化");
    await page.getByRole("button", { name: "添加引用", exact: true }).click();
    await page.getByRole("button", { name: /工业自动化.*工业连接/ }).click();
    await page.getByRole("button", { name: /材料与组件.*待验证/ }).click();
    await page.getByRole("heading", { name: "材料与组件", exact: true }).waitFor();
    await page.screenshot({ path: new URL("chains.png", artifacts).pathname });
    await page.reload();
    await page.getByText("仅本机 · 已保存", { exact: true }).waitFor();
    await page.getByText("本地样板测试判断", { exact: true }).waitFor();
    assert.equal(await page.locator("[data-section]").first().getAttribute("data-section"), "market");
    assert.equal(await page.getByRole("textbox", { name: "催化剂日历" }).inputValue(), "跟踪下一次示例财报");
    assert.equal(await page.getByLabel("我的 2027E EPS").inputValue(), "5");
    await page.getByRole("button", { name: "调整看板", exact: true }).click();
    await page.getByRole("button", { name: "恢复默认布局", exact: true }).click();
    await page.getByRole("button", { name: "恢复布局", exact: true }).click();
    assert.equal(await page.locator("[data-section]").first().getAttribute("data-section"), "thesis");
    await page.getByRole("button", { name: "拖动股价与交易", exact: true }).dragTo(page.locator('[data-section="thesis"] h2'));
    assert.equal(await page.locator("[data-section]").first().getAttribute("data-section"), "market");
    await page.getByRole("button", { name: "上移投资判断", exact: true }).click();
    await page.getByRole("button", { name: "重命名催化剂日历", exact: true }).click();
    await page.getByLabel("区块名称", { exact: true }).fill("研究日历");
    await page.getByRole("button", { name: "保存名称", exact: true }).click();
    assert.equal(await page.getByRole("textbox", { name: "研究日历", exact: true }).inputValue(), "跟踪下一次示例财报");
    await page.getByRole("button", { name: "完成调整", exact: true }).click();
    const storageKeys = await page.evaluate(() => window.__demoStorageKeys);
    assert.deepEqual([...new Set(storageKeys)].filter(k => !k.startsWith("__next")).sort(), ["zhinote:company-board-demo:v1", "zhinote:company-target-valuation:v1:DEMO-CHENGXIN"].sort());
    for (const width of [390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(150);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.querySelector("main").scrollWidth > document.querySelector("main").clientWidth + 1);
      assert.equal(overflow, false, `horizontal overflow at ${width}`);
      if (width === 390) {
        await page.getByRole("button", { name: "打开导航", exact: true }).click();
        await page.getByRole("navigation", { name: "样板导航" }).getByRole("button", { name: /产业链/ }).click();
        await page.waitForTimeout(250);
        const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.querySelector("main").scrollWidth > document.querySelector("main").clientWidth + 1);
        assert.equal(mobileOverflow, false, "mobile chain overflow");
        await page.screenshot({ path: new URL("mobile-chains.png", artifacts).pathname });
        await page.getByRole("tab", { name: "研究看板", exact: true }).click();
        await page.screenshot({ path: new URL("mobile.png", artifacts).pathname });
        await judgment.getByRole("button", { name: "更新", exact: true }).click();
        await updateDialog.waitFor();
        assert.equal(await updateDialog.evaluate(el => el.scrollWidth > el.clientWidth + 1), false);
        await page.screenshot({ path: new URL("research-gate-mobile.png", artifacts).pathname });
        await updateDialog.getByRole("button", { name: "关闭更新窗口" }).click();
        await page.getByRole("button", { name: "调整看板", exact: true }).click();
        const editOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.querySelector("main").scrollWidth > document.querySelector("main").clientWidth + 1);
        assert.equal(editOverflow, false, "mobile layout tools overflow");
        await page.getByRole("button", { name: "完成调整", exact: true }).click();
        const scroll = fundamentals.getByRole("region", { name: "基本面数据表" });
        await scroll.scrollIntoViewIfNeeded();
        for (const button of [annual, quarters]) {
          await button.click();
          assert.equal(await fundamentals.locator("tbody tr").count(), 8);
          assert.equal(await fundamentals.locator("thead th").count(), 7);
          const dimensions = await scroll.evaluate(el => {
            el.scrollLeft = el.scrollWidth;
            return { scrollLeft: el.scrollLeft, width: el.clientWidth, total: el.scrollWidth, labelLeft: el.querySelector('tbody th').getBoundingClientRect().left, left: el.getBoundingClientRect().left };
          });
          assert.ok(dimensions.scrollLeft > 0 && dimensions.width < dimensions.total);
          assert.ok(Math.abs(dimensions.labelLeft - dimensions.left) < 2, "metric labels stay visible while scrolling");
          await fundamentals.screenshot({ path: new URL(`fundamentals-mobile-${await button.textContent() === "年度 + YTD" ? "annual" : "quarterly"}.png`, artifacts).pathname });
        }
      }
    }
    assert.deepEqual(errors, []); assert.deepEqual(businessRequests, []); assert.deepEqual(externalRequests, []);
    passed = true;
    console.log(JSON.stringify({ passed, sections: 10, responsiveWidths: [390, 768, 1280, 1600], canvas, businessRequests: 0, isolatedLocalPersistence: true }));
  } finally {
    await browser.close();
    await writeFile(new URL("verification.json", artifacts), JSON.stringify({ passed, errors, businessRequests, externalRequests, syntheticOnly: true, production: false }, null, 2));
  }
});

test("currency switch converts every structured amount without changing source figures or ratios", { timeout: 120000 }, async () => {
  await mkdir(artifacts, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const errors = [], forbidden = [];
  let fxRequests = 0;
  try {
    const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, serviceWorkers: "block" });
    await context.route("**/*", route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin || url.pathname.startsWith("/api/")) { forbidden.push(url.pathname); return route.abort(); }
      if (url.pathname === fxPath) { fxRequests++; return route.fulfill({ json: fixtureQuote() }); }
      return route.continue();
    });
    const page = await context.newPage();
    page.on("pageerror", e => errors.push(e.message));
    await page.goto(origin + "/preview/company-board");
    await page.getByText("仅本机 · 已保存", { exact: true }).waitFor();
    const select = page.getByRole("combobox", { name: "显示币种", exact: true });
    assert.equal(await select.inputValue(), "original");
    assert.deepEqual(await select.locator("option").evaluateAll(options => options.map(o => o.value)), ["original", "USD", "CNY", "EUR", "JPY", "TWD", "KRW"]);
    const f = page.locator('[data-section="fundamentals"]');
    const originalThesis = await page.locator('[data-section="thesis"] p').allTextContents();
    const ratios = await f.locator('[data-metric="revenueYoy"] td, [data-metric="netProfitYoy"] td, [data-metric="grossMargin"] td, [data-metric="inventoryDays"] td').allTextContents();
    const rates = { USD: 1 / 7, CNY: 1, EUR: .9 / 7, JPY: 150 / 7, TWD: 32 / 7, KRW: 200 };
    const rounded = (value, rate) => (value * rate).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    for (const [code, rate] of Object.entries(rates)) {
      await select.selectOption(code);
      await page.waitForFunction(code => document.querySelector('[data-testid="scenario-price"]')?.textContent?.endsWith(code), code);
      assert.equal(await page.getByTestId("summary-revenue").textContent(), rounded(28.6, rate));
      assert.equal(await page.getByTestId("summary-eps").textContent(), rounded(3.2, rate));
      assert.equal(await page.getByTestId("market-price").textContent(), rounded(86.4, rate));
      assert.equal(await page.getByTestId("business-total").textContent(), rounded(28.6, rate));
      assert.equal(await page.getByTestId("scenario-price").textContent(), `${rounded(102.5, rate)} ${code}`);
      assert.ok(Math.abs(Number(await page.getByLabel("我的 2027E EPS", { exact: true }).inputValue()) - 4.1 * rate) < .000001);
      assert.equal(await page.getByTestId("implied-growth").textContent(), "20.0%");
      assert.match(await page.locator("canvas").getAttribute("aria-label"), new RegExp(`${code}$`));
      const earnings = page.locator('[data-section="earnings"]');
      assert.equal(await earnings.locator("tbody tr").first().locator("td").nth(1).textContent(), rounded(21.8, rate));
      for (const [metric, value] of Object.entries({ revenue: 25.9, netProfit: 6.784, capex: 2.62, fixedAssets: 9.9 })) {
        assert.equal(await f.locator(`[data-metric="${metric}"] td`).last().textContent(), rounded(value, rate));
      }
      assert.deepEqual(await f.locator('[data-metric="revenueYoy"] td, [data-metric="netProfitYoy"] td, [data-metric="grossMargin"] td, [data-metric="inventoryDays"] td').allTextContents(), ratios);
      await f.getByRole("button", { name: "最近六季度", exact: true }).click();
      assert.equal(await f.locator('[data-metric="revenue"] td').last().textContent(), rounded(9.4, rate));
      assert.equal(await f.locator('[data-metric="revenueYoy"] td').last().textContent(), "+28.8%");
      await f.getByRole("button", { name: "年度 + YTD", exact: true }).click();
    }
    assert.deepEqual(await page.locator('[data-section="thesis"] p').allTextContents(), originalThesis);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("zhinote:company-board-demo:v1")).eps), 4.1);
    await select.selectOption("USD");
    await page.reload();
    await page.getByText("仅本机 · 已保存", { exact: true }).waitFor();
    assert.equal(await select.inputValue(), "USD");
    await page.waitForFunction(() => document.querySelector('[data-testid="scenario-price"]')?.textContent?.endsWith("USD"));
    assert.equal(fxRequests, 1, "currency switches and refresh reuse one public quote");
    assert.match(await page.getByTestId("fx-status").textContent(), /每小时更新.*非逐秒报价/);
    await page.getByLabel("我的 2027E EPS", { exact: true }).fill("1");
    assert.equal(await page.getByTestId("scenario-price").textContent(), "25.00 USD");
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("zhinote:company-board-demo:v1")).eps), 7);
    await select.selectOption("original");
    assert.equal(await page.getByLabel("我的 2027E EPS", { exact: true }).inputValue(), "7");
    assert.equal(await page.getByTestId("summary-revenue").textContent(), "28.60");
    assert.equal(await page.getByTestId("scenario-price").textContent(), "175.00 CNY");
    await page.getByLabel("我的 2027E EPS", { exact: true }).fill("4.1");
    await select.selectOption("USD");
    await select.scrollIntoViewIfNeeded();
    await page.screenshot({ path: new URL("currency-usd-desktop.png", artifacts).pathname });
    await f.screenshot({ path: new URL("currency-usd-fundamentals.png", artifacts).pathname });
    for (const width of [390, 768, 1280]) {
      await page.setViewportSize({ width, height: 950 });
      await select.selectOption("KRW");
      await select.scrollIntoViewIfNeeded();
      await page.waitForTimeout(150);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.querySelector("main").scrollWidth > document.querySelector("main").clientWidth + 1), false, `currency overflow ${width}`);
      if (width === 390) {
        await page.screenshot({ path: new URL("currency-krw-mobile.png", artifacts).pathname });
        const scroll = f.getByRole("region", { name: "基本面数据表" });
        await scroll.evaluate(el => { el.scrollLeft = el.scrollWidth; });
        await f.screenshot({ path: new URL("currency-krw-fundamentals-mobile.png", artifacts).pathname });
      }
    }
    assert.deepEqual(errors, []); assert.deepEqual(forbidden, []);
  } finally { await browser.close(); }
});

test("FX loading, backoff, refresh, editing lock and stale fallback do not corrupt native amounts", { timeout: 120000 }, async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const context = await browser.newContext({ serviceWorkers: "block" });
    await context.addCookies([{ name: "private-test-marker", value: "never-forward", url: origin }]);
    const page = await context.newPage();
    let now = Date.now(), requests = 0, mode = "hold", held;
    let nativeRate = 7;
    const errors = [], forbidden = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.clock.install({ time: new Date(now) });
    await context.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin || url.pathname.startsWith("/api/")) { forbidden.push(url.pathname); return route.abort(); }
      if (url.pathname !== fxPath) return route.continue();
      requests++;
      const headers = await route.request().allHeaders();
      assert.equal(headers.cookie, undefined); assert.equal(headers.referer, undefined);
      if (mode === "hold") { held = route; return; }
      if (mode === "fail") return route.fulfill({ status: 503, json: { error: "FX_UNAVAILABLE" } });
      return route.fulfill({ json: { ...fixtureQuote(), timestamp: Math.floor(now / 1000), rates: { ...fixtureQuote().rates, CNY: nativeRate } } });
    });
    await page.goto(origin + "/preview/company-board");
    await page.getByText("仅本机 · 已保存", { exact: true }).waitFor();
    assert.equal(requests, 0, "original currency does not fetch FX");
    const select = page.getByLabel("显示币种", { exact: true });
    const status = page.getByTestId("fx-status");
    await select.selectOption("USD");
    await status.getByText(/正在获取汇率/).waitFor();
    assert.equal(await page.getByTestId("summary-revenue").textContent(), "28.60");
    assert.match(await page.getByTestId("scenario-price").textContent(), / CNY$/);
    await select.selectOption("KRW");
    await page.evaluate(() => { for (let i = 0; i < 10; i++) window.dispatchEvent(new Event("focus")); });
    assert.equal(requests, 1);
    await held.fulfill({ status: 503, json: { error: "FX_UNAVAILABLE" } });
    await status.getByText(/获取失败/).waitFor();
    await page.evaluate(() => { for (let i = 0; i < 10; i++) window.dispatchEvent(new Event("online")); });
    assert.equal(requests, 1, "failure cannot become a tight retry loop");
    mode = "ok"; now += 61000;
    await page.clock.fastForward(61000);
    await page.waitForFunction(() => document.querySelector('[data-testid="scenario-price"]')?.textContent?.endsWith("KRW"));
    assert.equal(requests, 2);
    await select.selectOption("USD");
    const eps = page.getByLabel("我的 2027E EPS", { exact: true });
    await eps.focus();
    nativeRate = 8; now += 3600001;
    await page.clock.fastForward(3600001);
    await page.waitForFunction(() => JSON.parse(sessionStorage.getItem("zhinote:company-board-fx:v1"))?.quote.rates.CNY === 8);
    assert.equal(requests, 3);
    assert.equal(await eps.inputValue(), "0.585714", "editing retains the prior quote");
    await eps.fill("1");
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("zhinote:company-board-demo:v1")).eps), 7);
    await eps.blur();
    assert.equal(await eps.inputValue(), "0.875", "new quote applies only after editing ends");
    assert.equal(await page.getByTestId("scenario-price").textContent(), "21.88 USD");
    mode = "fail"; now += 3 * 3600000;
    await page.clock.fastForward(3 * 3600000);
    await status.getByText(/更新失败/).waitFor();
    assert.match(await status.textContent(), /较旧汇率/);
    assert.equal(await page.getByTestId("scenario-price").textContent(), "21.88 USD");
    now += 8 * 24 * 3600000;
    await page.clock.fastForward(8 * 24 * 3600000);
    await status.getByText(/暂显原币/).waitFor();
    assert.equal(await page.getByTestId("summary-revenue").textContent(), "28.60");
    assert.equal(await page.getByTestId("scenario-price").textContent(), "175.00 CNY");
    assert.deepEqual(errors, []); assert.deepEqual(forbidden, []);
  } finally { await browser.close(); }
});

test("malformed FX responses and expired caches cannot masquerade as converted amounts", { timeout: 120000 }, async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const context = await browser.newContext({ serviceWorkers: "block" });
    await context.addInitScript(quote => sessionStorage.setItem("zhinote:company-board-fx:v1", JSON.stringify({ quote, checkedAt: Date.now() })), { ...fixtureQuote(), timestamp: Math.floor(Date.now() / 1000) - 8 * 86400 });
    await context.route("**/*", route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin || url.pathname.startsWith("/api/")) return route.abort();
      if (url.pathname === fxPath) return route.fulfill({ json: { ...fixtureQuote(), rates: { USD: 1, CNY: 7 } } });
      return route.continue();
    });
    const page = await context.newPage();
    await page.goto(origin + "/preview/company-board");
    await page.getByText("仅本机 · 已保存", { exact: true }).waitFor();
    await page.getByLabel("显示币种", { exact: true }).selectOption("EUR");
    await page.getByTestId("fx-status").getByText(/获取失败/).waitFor();
    assert.equal(await page.getByTestId("summary-revenue").textContent(), "28.60");
    assert.equal(await page.getByTestId("scenario-price").textContent(), "102.50 CNY");
    assert.equal(await page.getByLabel("显示币种", { exact: true }).inputValue(), "EUR");
  } finally { await browser.close(); }
});

test("live public FX reaches the isolated board without any account or portfolio requests", { timeout: 60000, skip: process.env.COMPANY_BOARD_LIVE_FX !== "1" }, async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  let evidence;
  try {
    const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, serviceWorkers: "block" });
    const forbidden = [], errors = [];
    let requests = 0;
    await context.route("**/*", route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin || url.pathname.startsWith("/api/")) { forbidden.push(url.pathname); return route.abort(); }
      if (url.pathname === fxPath) requests++;
      return route.continue();
    });
    const page = await context.newPage();
    page.on("pageerror", e => errors.push(e.message));
    await page.goto(origin + "/preview/company-board");
    await page.getByText("仅本机 · 已保存", { exact: true }).waitFor();
    const response = page.waitForResponse(r => new URL(r.url()).pathname === fxPath);
    await page.getByLabel("显示币种", { exact: true }).selectOption("USD");
    const quote = await (await response).json();
    await page.getByTestId("fx-status").locator("time").waitFor();
    assert.equal(quote.base, "USD");
    assert.ok(Math.abs(Date.now() - quote.timestamp * 1000) < 2 * 3600000, "provider quote is recent");
    assert.equal(await page.getByTestId("summary-revenue").textContent(), (28.6 / quote.rates.CNY).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    assert.equal(await page.getByTestId("fx-status").locator("time").getAttribute("datetime"), new Date(quote.timestamp * 1000).toISOString());
    await page.screenshot({ path: new URL("currency-live-desktop.png", artifacts).pathname });
    await page.setViewportSize({ width: 390, height: 950 });
    await page.getByLabel("显示币种", { exact: true }).selectOption("KRW");
    await page.waitForFunction(() => document.querySelector("aside").getBoundingClientRect().right <= .5);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.querySelector("main").scrollWidth > document.querySelector("main").clientWidth + 1), false);
    await page.screenshot({ path: new URL("currency-live-mobile.png", artifacts).pathname });
    await page.reload();
    await page.getByTestId("fx-status").locator("time").waitFor();
    assert.equal(requests, 1);
    assert.deepEqual(errors, []); assert.deepEqual(forbidden, []);
    evidence = { passed: true, checkedAt: new Date().toISOString(), provider: "ExchangeRate.fun", quote, browserFxRequests: requests, businessRequests: 0, syntheticCompanyData: true, realPublicFx: true, production: false };
    console.log(JSON.stringify(evidence));
  } finally {
    await browser.close();
    if (evidence) await writeFile(new URL("live-fx-verification.json", artifacts), JSON.stringify(evidence, null, 2));
  }
});
