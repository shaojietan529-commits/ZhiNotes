// Isolated browser contexts and synthetic holdings only; every business API is intercepted.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const XLSX = require("xlsx");
const origin = new URL(process.env.PORTFOLIO_TEST_URL ?? "http://127.0.0.1:3017").origin;
assert.ok(["127.0.0.1", "localhost"].includes(new URL(origin).hostname));
const artifacts = new URL("../.local/ai-exposure-verification/", import.meta.url);
mkdirSync(artifacts, { recursive: true });
const now = "2026-10-09T00:00:00.000Z";
const position = (key, nmv, country) => ({ key, ticker: key.split(" ")[0], name: `Synthetic ${key}`, nmv,
  gmv: Math.abs(nmv), country, sector: "Synthetic", pnlDaily: 0, pnlMtd: 0, pnlYtd: 0, pnlItd: 0, priceChange1dPct: 0 });
const initial = { snapshot: { importedAt: now, sourceName: "synthetic.xlsx",
  positions: [position("ALPHA US", 40, "US"), position("BETA US", -20, "US"), position("GAMMA JP", 10, "JP")] },
  tagMap: { "ALPHA US": "Compute", "BETA US": "Compute", "GAMMA JP": "Other" },
  allocation: 100, maxNetPct: 12, lastEmailMessageId: null, updatedAt: now };
const version = data => ({ scope: "a".repeat(64), revision: createHash("sha256").update(JSON.stringify(data)).digest("hex") });
const until = async (check) => {
  const deadline = Date.now() + 20000;
  while (!await check()) {
    assert.ok(Date.now() < deadline, "Timed out waiting for synthetic AI Exposure state");
    await new Promise(resolve => setTimeout(resolve, 50));
  }
};

test("AI Exposure: input, totals, analysis, import retention, isolated handoff, refresh and read-only sharing", { timeout: 120000 }, async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome" });
  let cloud = structuredClone(initial);
  let pushes = 0;
  const errors = [];
  async function device(viewport = { width: 1720, height: 1100 }, oldPending = false) {
    const context = await browser.newContext({ viewport, serviceWorkers: "block" });
    await context.route("**/*", async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== origin) return route.abort();
      const json = (body, status = 200) => route.fulfill({ status, json: body });
      if (url.pathname === "/api/account/me") return json({ authenticated: true, account: {
        id: "synthetic-ai", email_hint: "s***@example.invalid", display_name: "Synthetic", createdAt: now } });
      if (url.pathname === "/api/portfolio/account-sync") {
        const body = request.postDataJSON();
        const reply = (data, status = 200) => json({ accountId: "synthetic-ai", ...data }, status);
        if (body.action === "shares") return reply({ members: [], sharedWithMe: ["synthetic-friend@example.invalid"] });
        if (body.action === "pull") return reply({ data: body.from ? { ...cloud, aiExposureMap: { "ALPHA US": -0.75 } } : cloud, version: version(cloud) });
        if (body.action === "push") {
          assert.equal(body.expectedAccountId, "synthetic-ai");
          if (body.base?.revision !== version(cloud).revision && JSON.stringify(body.data) !== JSON.stringify(cloud)) {
            return reply({ code: "portfolio-conflict", data: cloud, version: version(cloud), error: "Synthetic conflict" }, 409);
          }
          cloud = structuredClone(body.data); pushes++;
          return reply({ tagMap: cloud.tagMap, ack: { format: "zhinote-portfolio-cloud-ack-receipt", format_version: 2,
            ack_status: "acknowledged", accepted: true, request_id: body.requestId, ...version(cloud), updated_at: cloud.updatedAt } });
        }
      }
      if (url.pathname.startsWith("/api/")) return json({ error: "Synthetic isolation" }, 501);
      if (request.method() === "GET" && (url.pathname === "/portfolio" || url.pathname.startsWith("/_next/static/") ||
        url.pathname.startsWith("/brand/source/") || url.pathname === "/favicon.ico")) return route.continue();
      return route.abort();
    });
    if (oldPending) await context.addInitScript(({ data, base }) => {
      const prefix = "zhinote.portfolio.scoped.v1.account%3Asynthetic-ai.";
      const values = { "snapshot.v1": JSON.stringify(data.snapshot),
        "tags.v1": JSON.stringify({ ...data.tagMap, "ALPHA US": "Old client pending edit" }),
        "allocation.v1": String(data.allocation), "maxNetPct.v1": String(data.maxNetPct), "updatedAt.v1": data.updatedAt,
        "sync.base.v2.account": JSON.stringify(base),
        "sync.status.v1": JSON.stringify({ mode: "account", queueState: "pending", pending: 1, pendingRevision: "old-pending" }) };
      for (const [key, value] of Object.entries(values)) localStorage.setItem(prefix + key, value);
    }, { data: structuredClone(cloud), base: version(cloud) });
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${origin}/portfolio`);
    try { await page.getByRole("button", { name: /账号已同步/ }).waitFor({ timeout: 20000 }); }
    catch (error) {
      await page.screenshot({ path: new URL("startup-failure.png", artifacts).pathname, fullPage: true });
      throw new Error(`${error.message}\nSynthetic UI: ${await page.locator("main").innerText()}\nErrors: ${JSON.stringify(errors)}`);
    }
    return page;
  }
  const input = (page, key) => page.getByRole("spinbutton", { name: `${key} AI Exposure`, exact: true });
  const enter = async (page, key, value) => {
    await input(page, key).fill(value);
    await input(page, key).press("Enter");
    await until(() => cloud.aiExposureMap?.[key] === (value === "" ? undefined : Number(value)));
    await page.getByRole("button", { name: /账号已同步/ }).waitFor();
  };
  try {
    const a = await device();
    assert.equal(await input(a, "ALPHA US").inputValue(), "");
    const headers = await a.locator("section").filter({ has: a.getByRole("heading", { name: "Long", exact: true }) }).locator("thead th").allTextContents();
    assert.equal(headers.at(-2).trim(), "Tag");
    assert.equal(headers.at(-1).trim(), "AI Exposure");
    await enter(a, "ALPHA US", "1");
    await enter(a, "BETA US", "0.5");
    await enter(a, "GAMMA JP", "-1");
    const summary = a.getByText("Total AI Exposure", { exact: true }).locator("..");
    assert.match(await summary.textContent(), /\+20\.0%/);
    const beforeInvalid = pushes;
    await input(a, "ALPHA US").fill("1.1");
    await input(a, "ALPHA US").press("Enter");
    await a.getByRole("alert").filter({ hasText: "范围" }).waitFor();
    assert.equal(cloud.aiExposureMap["ALPHA US"], 1);
    assert.equal(pushes, beforeInvalid);
    await input(a, "ALPHA US").press("Escape");
    await enter(a, "ALPHA US", "0");
    assert.match(await summary.textContent(), /-20\.0%/);
    await enter(a, "ALPHA US", "");
    assert.equal(Object.hasOwn(cloud.aiExposureMap, "ALPHA US"), false);
    await enter(a, "ALPHA US", "1");
    await a.screenshot({ path: new URL("positions-desktop.png", artifacts).pathname, fullPage: true });

    await a.getByRole("button", { name: "持仓分析", exact: true }).click();
    for (const title of ["按 Tag", "按 Country"]) {
      const table = a.locator("section").filter({ has: a.getByRole("heading", { name: title, exact: true }) }).locator("table");
      const columns = await table.locator("thead tr").last().locator("th").allTextContents();
      assert.equal(columns[4].trim(), "Gross");
      assert.equal(columns[5].trim(), "AI Exposure");
      assert.equal(columns[9].trim(), "Gross");
      assert.equal(columns[10].trim(), "AI Exposure");
      assert.equal((await table.locator("tfoot td").nth(5).textContent()).trim(), "+20.0%");
      const first = table.locator("tbody tr").first();
      assert.equal((await first.locator("td").nth(5).textContent()).trim(), "+30.0%");
      await first.click();
      assert.equal((await table.locator("tbody tr").nth(1).locator("td").nth(5).textContent()).trim(), "+40.0%");
      assert.equal(await table.locator("tfoot td").count(), 12);
    }
    await a.screenshot({ path: new URL("analysis-desktop.png", artifacts).pathname, fullPage: true });
    await a.getByRole("button", { name: "当前持仓", exact: true }).click();
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
      ["Ticker", "BB Yellow Key", "Description", "NMV", "GMV", "Country"],
      ["ALPHA", "ALPHA US", "Synthetic next report", 60, 60, "US"],
    ]), "Positions");
    await a.locator('input[type="file"]').first().setInputFiles({ name: "synthetic-next.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: XLSX.write(book, { type: "buffer", bookType: "xlsx" }) });
    await until(() => cloud.snapshot.positions.length === 1);
    assert.equal(cloud.aiExposureMap["ALPHA US"], 1);
    assert.equal(cloud.aiExposureMap["BETA US"], 0.5, "exited stock retains manual coefficient");
    assert.equal(cloud.tagMap["ALPHA US"], "Compute");
    assert.match(await summary.textContent(), /\+60\.0%/);

    const b = await device();
    assert.equal(await input(b, "ALPHA US").inputValue(), "1");
    await b.reload();
    await b.getByRole("button", { name: /账号已同步/ }).waitFor();
    assert.equal(await input(b, "ALPHA US").inputValue(), "1");
    await enter(b, "ALPHA US", "-0.5");
    await a.evaluate(() => window.dispatchEvent(new Event("focus")));
    await until(async () => await input(a, "ALPHA US").inputValue() === "-0.5");
    assert.match(await summary.textContent(), /-30\.0%/);
    const select = a.locator("select").filter({ has: a.locator('option[value="synthetic-friend@example.invalid"]') });
    await select.selectOption("synthetic-friend@example.invalid");
    await until(async () => await input(a, "ALPHA US").getAttribute("readonly") !== null);
    assert.equal(await input(a, "ALPHA US").inputValue(), "-0.75");
    await select.selectOption("");
    assert.equal(await input(a, "ALPHA US").inputValue(), "-0.5");

    const mobile = await device({ width: 390, height: 844 });
    const collapse = mobile.getByRole("button", { name: /收起侧边栏/ });
    if (await collapse.isVisible()) await collapse.click();
    await input(mobile, "ALPHA US").scrollIntoViewIfNeeded();
    await enter(mobile, "ALPHA US", "0.25");
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const box = await input(mobile, "ALPHA US").boundingBox();
    assert.ok(box.width > 60 && box.x >= 0 && box.x + box.width <= 390);
    await mobile.screenshot({ path: new URL("positions-mobile.png", artifacts).pathname, fullPage: true });
    const upgraded = await device(undefined, true);
    assert.equal(cloud.aiExposureMap["ALPHA US"], 0.25, "upgrading pending old-client input cannot clear the cloud coefficient");
    assert.equal(cloud.tagMap["ALPHA US"], "Old client pending edit");
    assert.equal(await input(upgraded, "ALPHA US").inputValue(), "0.25");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
