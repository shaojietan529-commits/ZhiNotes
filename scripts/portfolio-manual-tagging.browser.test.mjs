// Only synthetic accounts and in-memory cloud data; every business API is intercepted.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const target = new URL(process.env.PORTFOLIO_TEST_URL ?? "http://127.0.0.1:3026");
const origin = target.origin;
const production = process.env.PORTFOLIO_PUBLIC_ASSETS === "1" &&
  ["https://zhi-note.com", "https://www.zhi-note.com"].includes(origin);
const preview = process.env.PORTFOLIO_PREVIEW_ASSETS === "1" && target.protocol === "https:" &&
  /^zhi-notes-[a-z0-9]+-zhinote\.vercel\.app$/.test(target.hostname);
assert.ok(!target.username && !target.password &&
  (["127.0.0.1", "localhost"].includes(target.hostname) || production || preview));
// Only the isolated context receives the temporary preview link. Never persist its cookies.
const access = new URLSearchParams();
if (preview && target.searchParams.has("_vercel_share")) access.set("_vercel_share", target.searchParams.get("_vercel_share"));
const entry = `${origin}/portfolio${access.size ? `?${access}` : ""}`;
const artifacts = resolve(production ? ".local/manual-tagging-production-verification" :
  preview ? ".local/manual-tagging-preview-verification" : ".local/manual-tagging-verification");
const now = "2026-10-26T00:00:00.000Z";
const position = (ticker, nmv) => ({
  key: `${ticker} US`, ticker, name: `Synthetic ${ticker}`, nmv, gmv: Math.abs(nmv),
  pnlDaily: 0, pnlMtd: 0, pnlYtd: 0, pnlItd: 0, priceChange1dPct: 0,
  country: "US", sector: "Synthetic",
});
const initial = {
  snapshot: { importedAt: now, sourceName: "synthetic-manual-tags.xlsx", positions: [
    position("READY", 30), position("ALPHA", 20), position("ZETA", 10),
    position("SHORT", -20), position("DONE", -10),
  ] },
  tagMap: { "READY US": "Existing label", "DONE US": "Existing short label" },
  aiExposureMap: { "ALPHA US": 0.5 }, allocation: 100, maxNetPct: 12,
  lastEmailMessageId: null, updatedAt: now,
};
const versionOf = (data) => ({ scope: "a".repeat(64),
  revision: createHash("sha256").update(JSON.stringify(data)).digest("hex") });

async function fixture(viewport, data = initial) {
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome" });
  const context = await browser.newContext({ viewport, serviceWorkers: "block" });
  let cloud = structuredClone(data);
  let aiCalls = 0;
  const errors = [];
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin) return route.abort();
    const json = (body, status = 200) => route.fulfill({ status, json: body });
    if (url.pathname === "/api/account/me") return json({ authenticated: true,
      account: { id: "synthetic", email_hint: "s***@example.invalid", display_name: "Synthetic", createdAt: now } });
    if (url.pathname === "/api/account/sync-events") return route.fulfill({ status: 204 });
    if (url.pathname.startsWith("/api/ai/")) {
      aiCalls++;
      return json({ error: "AI is forbidden in manual tagging" }, 501);
    }
    if (url.pathname === "/api/portfolio/account-sync") {
      const body = request.postDataJSON();
      assert.equal(body.expectedAccountId, "synthetic");
      const reply = (data, status) => json({ accountId: "synthetic", ...data }, status);
      if (body.action === "shares") return reply({ members: [], sharedWithMe: [] });
      if (body.action === "pull") return reply({ data: cloud, version: versionOf(cloud) });
      if (body.action === "push") {
        if (body.base?.revision !== versionOf(cloud).revision && JSON.stringify(body.data) !== JSON.stringify(cloud)) {
          return reply({ code: "portfolio-conflict", error: "Synthetic conflict", data: cloud, version: versionOf(cloud) }, 409);
        }
        cloud = structuredClone(body.data);
        return reply({ tagMap: cloud.tagMap, ack: { format: "zhinote-portfolio-cloud-ack-receipt",
          format_version: 2, request_id: body.requestId, ...versionOf(cloud),
          ack_status: "acknowledged", accepted: true, updated_at: cloud.updatedAt } });
      }
      return json({ error: "Unexpected synthetic action" }, 400);
    }
    if (url.pathname.startsWith("/api/")) return json({ error: "Isolated synthetic test" }, 501);
    if (request.method() === "GET" && (url.pathname === "/portfolio" ||
      url.pathname.startsWith("/_next/static/") || url.pathname === "/favicon.ico" ||
      url.pathname.startsWith("/brand/") || (preview && access.size > 0 && url.pathname.startsWith("/_vercel/")))) return route.continue();
    return route.abort();
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.setDefaultTimeout(15000);
  const next = page.getByTitle("定位下一个未打标的 Tag", { exact: true });
  try {
    await page.goto(entry);
    await next.waitFor();
    await page.getByRole("button", { name: /账号已同步/ }).waitFor();
  } catch (error) {
    const ui = await page.locator("main").innerText().catch(() => "Unavailable");
    await browser.close();
    const message = error.message.replace(/([?&]_vercel_share=)[^\s"&]+/g, "$1[redacted]");
    throw new Error(`${message}\nSynthetic UI: ${ui}\nErrors: ${JSON.stringify(errors)}`);
  }
  return { browser, page, next, cloud: () => cloud, aiCalls: () => aiCalls, errors };
}

async function until(check) {
  const deadline = Date.now() + 15000;
  while (!await check()) {
    assert.ok(Date.now() < deadline, "Timed out waiting for manual tagging");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

async function focusedInput(page, key) {
  const input = page.getByLabel(`${key} Tag`, { exact: true });
  await input.waitFor();
  await until(() => input.evaluate((node) => node === document.activeElement));
  const box = await input.boundingBox();
  const viewport = page.viewportSize();
  assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width &&
    box.y + box.height <= viewport.height, "The next input must be visible without manual scrolling");
  return input;
}

for (const [name, viewport] of Object.entries({ desktop: { width: 1440, height: 1000 }, mobile: { width: 390, height: 844 } })) {
  test(`manual tagging follows sorted rows through Long and Short on ${name}`, { timeout: 90000 }, async () => {
    const f = await fixture(viewport);
    try {
      const { page, next } = f;
      if (name === "mobile") await page.getByTitle("收起侧边栏", { exact: true }).click();
      assert.match(await next.textContent(), /3/);
      assert.equal(await page.getByRole("button", { name: /AI 打标/ }).count(), 0);
      const long = page.getByText("Total Long GMV", { exact: true }).locator("..");
      const short = page.getByText("Total Short GMV", { exact: true }).locator("..");
      for (const card of [long, short]) {
        assert.match(await card.innerText(), /下限 44%/);
        assert.match(await card.innerText(), /上限 56%/);
      }
      assert.match(await long.innerText(), /超限 4\.0%/);
      assert.match(await short.innerText(), /低于下限 14\.0%/);
      await mkdir(artifacts, { recursive: true });
      await page.screenshot({ path: resolve(artifacts, `${name}-gmv-limits.png`), fullPage: true });
      // Descending ticker order differs from the default position-size order.
      await page.getByRole("button", { name: /^Ticker/ }).first().click();
      await next.click();
      let input = await focusedInput(page, "ZETA US");
      await input.press("Enter");
      assert.equal(await input.inputValue(), "");
      await mkdir(artifacts, { recursive: true });
      await page.screenshot({ path: resolve(artifacts, `${name}-next-tag.png`) });
      for (const [key, label, nextKey] of [
        ["ZETA US", "Manual Zeta", "ALPHA US"],
        ["ALPHA US", "Manual Alpha", "SHORT US"],
        ["SHORT US", "Manual Short", null],
      ]) {
        input = await focusedInput(page, key);
        await input.fill(label);
        await input.press("Enter");
        if (nextKey) await focusedInput(page, nextKey);
      }
      await until(() => next.isDisabled());
      assert.equal(await next.textContent(), "打标已完成");
      await until(() => f.cloud().tagMap["SHORT US"] === "Manual Short");
      assert.deepEqual(f.cloud().tagMap, { ...initial.tagMap,
        "ZETA US": "Manual Zeta", "ALPHA US": "Manual Alpha", "SHORT US": "Manual Short" });
      assert.deepEqual(f.cloud().aiExposureMap, initial.aiExposureMap);
      await page.reload();
      await page.getByRole("button", { name: "打标已完成", exact: true }).waitFor();
      assert.equal(await page.locator('button[data-portfolio-tag-key="ZETA US"]').textContent(), "Manual Zeta");
      assert.equal(await page.locator('input[list="zhinote-portfolio-tags"]').count(), 0);
      assert.equal(f.aiCalls(), 0);
      assert.deepEqual(f.errors, []);
    } finally { await f.browser.close(); }
  });
}

test("manual tagging preserves drafts on failure, respects IME, and does not steal focus on blur", { timeout: 90000 }, async () => {
  const f = await fixture({ width: 1440, height: 1000 });
  try {
    const { page, next } = f;
    await page.getByRole("button", { name: "持仓分析", exact: true }).click();
    await next.click();
    let input = await focusedInput(page, "ALPHA US");
    await input.fill("Draft to cancel");
    await input.press("Escape");
    assert.equal(await page.locator('input[list="zhinote-portfolio-tags"]').count(), 0);
    assert.match(await next.textContent(), /3/);
    // Clicking again skips the cancelled item and wraps after the Short table.
    await next.click();
    await focusedInput(page, "ZETA US");
    await next.click();
    await focusedInput(page, "SHORT US");
    await next.click();
    input = await focusedInput(page, "ALPHA US");
    await input.fill("Manual input");
    await input.dispatchEvent("keydown", { key: "Enter", code: "Enter", isComposing: true });
    assert.equal(await input.inputValue(), "Manual input");
    assert.equal(f.cloud().tagMap["ALPHA US"], undefined);
    await page.evaluate(() => {
      window.syntheticFailPortfolioSave = true;
      const put = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (...args) {
        if (window.syntheticFailPortfolioSave && this.name === "accounts") {
          throw new DOMException("Synthetic full storage", "QuotaExceededError");
        }
        return put.apply(this, args);
      };
    });
    await input.press("Enter");
    await page.getByText("标签未保存，请重试。", { exact: true }).waitFor();
    await focusedInput(page, "ALPHA US");
    assert.equal(await input.inputValue(), "Manual input");
    assert.match(await next.textContent(), /3/);
    await page.evaluate(() => { window.syntheticFailPortfolioSave = false; });
    await input.press("Enter");
    input = await focusedInput(page, "ZETA US");
    await input.fill("Blur saved");
    await page.getByRole("button", { name: "持仓分析", exact: true }).click();
    await until(() => f.cloud().tagMap["ZETA US"] === "Blur saved");
    assert.equal(await page.locator('input[list="zhinote-portfolio-tags"]').count(), 0);
    assert.match(await next.textContent(), /1/);
    await next.click();
    await focusedInput(page, "SHORT US");
    assert.equal(f.aiCalls(), 0);
    assert.deepEqual(f.errors, []);
  } finally { await f.browser.close(); }
});

test("Long and Short both include 44% and 56%, independent of the net limit", { timeout: 90000 }, async () => {
  for (const [longPct, shortPct, longStatus, shortStatus] of [
    [43, 57, "低于下限 1.0%", "超限 1.0%"],
    [44, 56, "可用 12.0%", "可用 0.0%"],
    [50, 50, "可用 6.0%", "可用 6.0%"],
    [56, 44, "可用 0.0%", "可用 12.0%"],
    [57, 43, "超限 1.0%", "低于下限 1.0%"],
  ]) {
    const data = structuredClone(initial);
    data.allocation = 88_500_000;
    data.maxNetPct = 20;
    data.snapshot.positions = [position("LONG", data.allocation * longPct / 100),
      position("SHORT", -data.allocation * shortPct / 100)];
    const f = await fixture({ width: 1440, height: 1000 }, data);
    try {
      for (const [label, status] of [["Total Long GMV", longStatus], ["Total Short GMV", shortStatus]]) {
        const card = f.page.getByText(label, { exact: true }).locator("..");
        assert.match(await card.innerText(), /下限 44%/);
        assert.match(await card.innerText(), /上限 56%/);
        assert.equal(await card.getByText(status, { exact: true }).count(), 1,
          `${label} at ${longPct}/${shortPct}: ${await card.innerText()}`);
      }
      const net = f.page.getByTitle("点击修改最大净敞口", { exact: true });
      assert.equal(await net.textContent(), "±20%");
      assert.deepEqual(f.cloud(), data, "Changing display limits must not write portfolio data");
      assert.deepEqual(f.errors, []);
    } finally { await f.browser.close(); }
  }
});
