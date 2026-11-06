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

test("NVIDIA entry isolates drafts and demo data, stays idle, and requires explicit research consent", { timeout: 90000 }, async () => {
  await mkdir(artifacts, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const requests = [], forbidden = [], errors = [];
  let configured = false;
  const snapshot = {
    scope: { companyId: "NASDAQ-NVDA", name: "英伟达", ticker: "NVDA", exchange: "NASDAQ", zhinotePages: 1, notionPages: 1, monthlyBudgetUsd: 20, reservationUsd: 1, model: "synthetic-test-model", blockers: [] },
    job: null, result: null,
  };
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, serviceWorkers: "block" });
    await context.addInitScript(() => {
      if (!localStorage.getItem("zhinote:company-board-demo:v1")) localStorage.setItem("zhinote:company-board-demo:v1", JSON.stringify({ investmentThesis: "DEMO_ONLY_SENTINEL" }));
    });
    await context.route("**/*", route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) { forbidden.push(url.href); return route.abort(); }
      if (url.pathname === "/api/company-research") {
        const body = route.request().postDataJSON();
        requests.push({ method: route.request().method(), id: url.searchParams.get("companyId"), body });
        if (!configured) return route.fulfill({ status: 404, json: { error: "尚未绑定此账号的真实公司与研究资料范围。" } });
        if (body?.action === "prepare") return route.fulfill({ json: { id: "fixture-draft", digest: "a".repeat(64), expiresAt: new Date(Date.now() + 600000).toISOString(), outbound: "SYNTHETIC_APPROVED_EXCERPT_ONLY", warnings: [] } });
        if (body?.action === "start") return route.fulfill({ json: { ...snapshot, result: {
          companyId: "NASDAQ-NVDA", generatedAt: new Date().toISOString(), warnings: [],
          bull: [{ text: "合成测试看多观点", category: "alpha", basis: "inference", sourceIds: ["p1"] }],
          bear: [{ text: "合成测试看空观点", category: "industry", basis: "hypothesis", sourceIds: ["p1"] }],
          sources: [{ id: "p1", kind: "public", title: "合成测试来源", url: "https://example.com/synthetic", date: null, dateKind: "unknown" }],
        } } });
        return route.fulfill({ json: snapshot });
      }
      if (url.pathname.startsWith("/api/")) { forbidden.push(url.pathname); return route.abort(); }
      return route.continue();
    });
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(origin + path);
    await page.getByRole("heading", { name: "英伟达", exact: true }).waitFor();
    const edit = page.getByRole("button", { name: "编辑 Investment Thesis", exact: true });
    await edit.click();
    const thesis = "MANUAL_NVDA_THESIS_DO_NOT_SEND";
    await page.getByRole("textbox", { name: "Investment Thesis", exact: true }).fill(thesis);
    await page.getByRole("button", { name: "保存判断", exact: true }).click();
    await page.reload();
    await page.getByText(thesis, { exact: true }).waitFor();
    assert.deepEqual(requests, []);
    assert.equal(await page.getByText("DEMO_ONLY_SENTINEL", { exact: true }).count(), 0);
    assert.equal(await page.locator("canvas").count(), 0);
    assert.equal(await page.getByText("示例观点 · 非实时研究", { exact: true }).count(), 0);
    assert.equal(await page.getByRole("link", { name: "季度业绩", exact: true }).getAttribute("href"), "https://investor.nvidia.com/financial-info/quarterly-results/default.aspx");
    assert.ok(await page.locator('img[alt="ZhiNote"]').evaluate(img => img.complete && img.naturalWidth > 0));
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForTimeout(150);
      assert.equal(await page.getByRole("navigation", { name: "公司研究导航" }).count(), 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.querySelector("main").scrollWidth > document.querySelector("main").clientWidth + 1), false);
      await page.screenshot({ path: new URL(`nvidia-${width}.png`, artifacts).pathname });
    }
    await page.getByRole("button", { name: "更新", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "更新研究观点" });
    await dialog.getByRole("alert").waitFor();
    assert.equal(requests.length, 1);
    assert.equal(requests[0].method, "GET"); assert.equal(requests[0].id, "NASDAQ-NVDA");
    assert.equal(await dialog.getByRole("button", { name: "确认更新", exact: true }).count(), 0);
    await page.screenshot({ path: new URL("nvidia-gate-mobile.png", artifacts).pathname });
    configured = true;
    await dialog.getByRole("button", { name: "检查状态", exact: true }).click();
    await dialog.getByRole("button", { name: "读取指定资料并预览", exact: true }).click();
    await dialog.getByText("SYNTHETIC_APPROVED_EXCERPT_ONLY", { exact: true }).waitFor();
    const confirm = dialog.getByRole("button", { name: "确认更新", exact: true });
    assert.equal(await confirm.isDisabled(), true);
    assert.equal(requests.filter(r => r.body?.action === "start").length, 0);
    await dialog.getByRole("checkbox").check();
    await confirm.click();
    await page.getByText("合成测试看多观点", { exact: true }).waitFor();
    await page.getByText(thesis, { exact: true }).waitFor();
    assert.equal(JSON.stringify(requests).includes(thesis), false);
    assert.equal(requests.filter(r => r.body?.action === "start").length, 1);
    for (const request of requests.filter(r => r.body)) assert.equal(request.body.companyId, "NASDAQ-NVDA");
    const demoBefore = await page.evaluate(() => localStorage.getItem("zhinote:company-board-demo:v1"));
    assert.equal(JSON.parse(demoBefore).investmentThesis, "DEMO_ONLY_SENTINEL");
    await page.getByRole("link", { name: "虚构模板", exact: true }).click();
    await page.getByRole("heading", { name: "澄芯科技", exact: true }).waitFor();
    await page.getByRole("link", { name: "英伟达 · NASDAQ: NVDA", exact: true }).click();
    await page.getByText(thesis, { exact: true }).waitFor();
    assert.equal(requests.length, 4);
    assert.deepEqual(forbidden, []); assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
