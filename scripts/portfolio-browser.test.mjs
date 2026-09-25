// Run against a local server only. Fresh browser, synthetic content, all APIs intercepted.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const base = process.env.PORTFOLIO_TEST_URL ?? "http://127.0.0.1:3007";
assert.ok(["127.0.0.1", "localhost"].includes(new URL(base).hostname));
const now = "2026-09-25T04:00:00.000Z";
const initial = {
  snapshot: { importedAt: now, sourceName: "synthetic.xlsx", positions: [{
    key: "SAMPLE US", ticker: "SAMPLE", name: "Synthetic position", nmv: 10, gmv: 10,
    pnlDaily: 0, pnlMtd: 0, pnlYtd: 0, pnlItd: 0, priceChange1dPct: 0,
    country: "US", sector: "Synthetic",
  }] },
  tagMap: { "SAMPLE US": "original" }, allocation: 100, maxNetPct: 12,
  lastEmailMessageId: null, updatedAt: now,
};

test("portfolio UI: instant editing, late ACK safety, reload, and no status-ping upload loop", { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    let cloud = structuredClone(initial);
    const uploads = [], held = [], errors = [];
    let holdUploads = true;
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== new URL(base).origin) return route.abort();
      const json = (body, status = 200) => route.fulfill({ status, json: body });
      if (url.pathname === "/api/account/me") {
        return json({ authenticated: true, account: { id: "synthetic", email_hint: "s***@example.invalid",
          display_name: "Synthetic test", createdAt: now } });
      }
      if (url.pathname === "/api/portfolio/account-sync") {
        const body = route.request().postDataJSON();
        if (body.action === "shares") return json({ members: [], sharedWithMe: [] });
        if (body.action === "pull") return json({ data: cloud });
        if (body.action === "push") {
          uploads.push(body.data);
          const reply = async () => {
            cloud = body.data;
            await json({ tagMap: body.data.tagMap, ack: {
              format: "zhinote-portfolio-cloud-ack-receipt", format_version: 1,
              ack_status: "acknowledged", accepted: true, updated_at: body.data.updatedAt,
            } });
          };
          if (holdUploads) { held.push(reply); return; }
          return reply();
        }
      }
      if (url.pathname.startsWith("/api/")) return json({ error: "isolated test" }, 501);
      return route.continue();
    });
    await context.addInitScript((data) => {
      if (localStorage.getItem("synthetic-portfolio-seeded")) return;
      localStorage.setItem("synthetic-portfolio-seeded", "true");
      for (const [key, value] of Object.entries({
        "snapshot": JSON.stringify(data.snapshot), "tags": JSON.stringify(data.tagMap),
        "allocation": String(data.allocation), "maxNetPct": String(data.maxNetPct), "updatedAt": data.updatedAt,
      })) localStorage.setItem(`zhinote.portfolio.${key}.v1`, value);
    }, initial);
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (/Cannot update a component|hydration|Maximum update depth/i.test(message.text())) {
        errors.push(message.text());
      }
    });
    await page.goto(`${base}/portfolio`);
    const tag = page.getByTitle("点击修改标签", { exact: true });
    await tag.waitFor();
    await page.getByRole("button", { name: "账号已同步" }).waitFor();
    assert.equal(uploads.length, 0, "clean initial pull must not upload");
    async function editTag(value) {
      await tag.click();
      const input = page.locator('input[list="zhinote-portfolio-tags"]');
      await input.fill(value);
      await input.press("Enter");
      assert.equal(await tag.textContent(), value);
    }
    await editTag("first edit");
    await until(() => uploads.length === 1);
    await editTag("newer edit");
    // A focus-triggered pull may return newer remote data, but cannot replace pending input.
    cloud = { ...initial, tagMap: { "SAMPLE US": "remote conflict" }, updatedAt: "2099-01-01T00:00:00.000Z" };
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await held.shift()();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("zhinote.portfolio.sync.status.v1")).pending === 1);
    assert.equal(await tag.textContent(), "newer edit");
    holdUploads = false;
    // A second debounce may have fired before the first reply; the queue must retry regardless.
    for (const reply of held.splice(0)) await reply();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("zhinote.portfolio.sync.status.v1")).queueState === "synced", null, { timeout: 20000 });
    assert.equal(cloud.tagMap["SAMPLE US"], "newer edit");
    assert.equal(uploads.length, 2);
    await page.evaluate(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "zhinote.portfolio.sync.status.ping.v1", newValue: "synthetic" }));
    });
    await new Promise((resolve) => setTimeout(resolve, 2200));
    assert.equal(uploads.length, 2, "status notification must not produce a write loop");
    await page.reload();
    await tag.waitFor();
    await page.getByRole("button", { name: "账号已同步" }).waitFor();
    assert.equal(await tag.textContent(), "newer edit");
    assert.equal(uploads.length, 2, "reload must not re-upload already confirmed data");
    holdUploads = true;
    await editTag("saved before reload");
    cloud = { ...cloud, tagMap: { "SAMPLE US": "another device" }, updatedAt: "2099-01-01T00:00:00.000Z" };
    await page.reload();
    await tag.waitFor();
    assert.equal(await tag.textContent(), "saved before reload");
    await until(() => uploads.length === 3);
    assert.equal(uploads[2].tagMap["SAMPLE US"], "saved before reload");
    await held.shift()();
    await page.getByRole("button", { name: "账号已同步" }).waitFor();
    if (process.env.PORTFOLIO_TEST_SCREENSHOT) await page.screenshot({ path: process.env.PORTFOLIO_TEST_SCREENSHOT });
    assert.deepEqual(errors, []);
    console.log("Verified isolated browser editing, late ACK, pending reload and clean reload; 3 uploads for 3 revisions.");
  } finally { await browser.close(); }
});

async function until(check) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > 20000) throw new Error("Expected synthetic request did not arrive");
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}
