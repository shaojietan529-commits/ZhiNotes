// Run against a local server only. Fresh browser, synthetic content, all APIs intercepted.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { createHash } from "node:crypto";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const base = process.env.PORTFOLIO_TEST_URL ?? "http://127.0.0.1:3007";
assert.ok(["127.0.0.1", "localhost"].includes(new URL(base).hostname));
const now = "2026-09-25T04:00:00.000Z";
const scopedPrefix = "zhinote.portfolio.scoped.v1.account%3Asynthetic.";
const versionOf = (data) => ({ scope: "a".repeat(64), revision: createHash("sha256").update(JSON.stringify(data)).digest("hex") });
const initial = {
  snapshot: { importedAt: now, sourceName: "synthetic.xlsx", positions: [{
    key: "SAMPLE US", ticker: "SAMPLE", name: "Synthetic position", nmv: 10, gmv: 10,
    pnlDaily: 0, pnlMtd: 0, pnlYtd: 0, pnlItd: 0, priceChange1dPct: 0,
    country: "US", sector: "Synthetic",
  }] },
  tagMap: { "SAMPLE US": "original" }, allocation: 100, maxNetPct: 12,
  lastEmailMessageId: null, updatedAt: now,
};

async function installPortfolioStorageProbe(context) {
  await context.addInitScript(() => {
    window.readSyntheticPortfolio = (prefix, suffix) => {
      const state = localStorage.getItem(`${prefix}state.v2`);
      return state === null ? localStorage.getItem(`${prefix}${suffix}`)
        : JSON.parse(state).values[`zhinote.portfolio.${suffix}`];
    };
  });
}

test("portfolio UI: instant editing, late ACK, interrupted-save recovery, and no status-ping upload loop", { timeout: 120000 }, async () => {
  const browser = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await installPortfolioStorageProbe(context);
    let cloud = structuredClone(initial);
    const uploads = [], held = [], errors = [];
    let holdUploads = true;
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== new URL(base).origin) return route.abort();
      const json = (body, status = 200) => route.fulfill({ status, json: {
        ...(url.pathname === "/api/portfolio/account-sync" ? { accountId: "synthetic" } : {}), ...body,
      } });
      if (url.pathname === "/api/account/me") {
        return json({ authenticated: true, account: { id: "synthetic", email_hint: "s***@example.invalid",
          display_name: "Synthetic test", createdAt: now } });
      }
      if (url.pathname === "/api/portfolio/account-sync") {
        const body = route.request().postDataJSON();
        assert.equal(body.expectedAccountId, "synthetic");
        if (body.action === "shares") return json({ members: [], sharedWithMe: [] });
        if (body.action === "pull") return json({ data: cloud, version: versionOf(cloud) });
        if (body.action === "push") {
          uploads.push(body.data);
          if (body.base?.revision !== versionOf(cloud).revision && JSON.stringify(body.data) !== JSON.stringify(cloud)) {
            return json({ code: "portfolio-conflict", error: "Synthetic conflict: both versions retained", data: cloud, version: versionOf(cloud) }, 409);
          }
          cloud = body.data;
          const reply = async () => {
            await json({ tagMap: body.data.tagMap, ack: {
              format: "zhinote-portfolio-cloud-ack-receipt", format_version: 2,
              request_id: body.requestId, ...versionOf(body.data),
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
    await context.addInitScript(({ data, prefix }) => {
      if (localStorage.getItem("synthetic-portfolio-seeded")) return;
      localStorage.setItem("synthetic-portfolio-seeded", "true");
      for (const [key, value] of Object.entries({
        "snapshot": JSON.stringify(data.snapshot), "tags": JSON.stringify(data.tagMap),
        "allocation": String(data.allocation), "maxNetPct": String(data.maxNetPct), "updatedAt": data.updatedAt,
      })) localStorage.setItem(`${prefix}${key}.v1`, value);
    }, { data: initial, prefix: scopedPrefix });
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
    await page.evaluate((prefix) => {
      window.syntheticFailPortfolioSave = true;
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (window.syntheticFailPortfolioSave && key === `${prefix}state.v2`) throw new DOMException("Synthetic full storage", "QuotaExceededError");
        return setItem.call(this, key, value);
      };
    }, scopedPrefix);
    await tag.click();
    const failedInput = page.locator('input[list="zhinote-portfolio-tags"]');
    await failedInput.fill("first edit");
    await failedInput.press("Enter");
    await page.getByText(/本次修改未保存/).waitFor();
    assert.equal(await failedInput.inputValue(), "first edit", "failed saves keep the editor draft available for retry");
    assert.equal(await page.evaluate((prefix) => JSON.parse(window.readSyntheticPortfolio(prefix, "tags.v1"))["SAMPLE US"], scopedPrefix), "original");
    assert.equal(uploads.length, 0);
    await page.evaluate(() => { window.syntheticFailPortfolioSave = false; });
    await failedInput.press("Enter");
    assert.equal(await tag.textContent(), "first edit");
    await until(() => uploads.length === 1);
    await editTag("newer edit");
    // A focus-triggered pull may return newer remote data, but cannot replace pending input.
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await held.shift()();
    await page.waitForFunction((prefix) => JSON.parse(window.readSyntheticPortfolio(prefix, "sync.status.v1"))?.pending === 1, scopedPrefix);
    assert.equal(await tag.textContent(), "newer edit");
    holdUploads = false;
    // A second debounce may have fired before the first reply; the queue must retry regardless.
    for (const reply of held.splice(0)) await reply();
    await page.waitForFunction((prefix) => JSON.parse(window.readSyntheticPortfolio(prefix, "sync.status.v1"))?.queueState === "synced", scopedPrefix, { timeout: 20000 });
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
    // The confirmed server revision wins even when another device's clock is behind.
    cloud = { ...cloud, tagMap: {}, updatedAt: "2020-01-01T00:00:00.000Z" };
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await page.waitForFunction((prefix) => Object.keys(JSON.parse(window.readSyntheticPortfolio(prefix, "tags.v1"))).length === 0, scopedPrefix);
    assert.equal(await tag.textContent(), "未分类");
    assert.equal(uploads.length, 2, "remote deletion must not be unioned back or uploaded again");
    holdUploads = true;
    await editTag("saved before reload");
    cloud = { ...cloud, tagMap: { "SAMPLE US": "another device" }, updatedAt: "2099-01-01T00:00:00.000Z" };
    await page.reload();
    await tag.waitFor();
    assert.equal(await tag.textContent(), "saved before reload");
    await until(() => uploads.length === 3);
    assert.equal(uploads[2].tagMap["SAMPLE US"], "saved before reload");
    await page.waitForFunction((prefix) => JSON.parse(window.readSyntheticPortfolio(prefix, "sync.status.v1"))?.queueState === "manual_review", scopedPrefix);
    assert.equal(await tag.textContent(), "saved before reload");
    assert.equal(cloud.tagMap["SAMPLE US"], "another device");
    const backup = await page.evaluate((prefix) => {
      const key = Object.keys(localStorage).find((key) => key.startsWith(`${prefix}conflict.v2`));
      return key ? JSON.parse(localStorage.getItem(key)) : null;
    }, scopedPrefix);
    assert.equal(backup.local.tagMap["SAMPLE US"], "saved before reload");
    assert.equal(backup.cloud.tagMap["SAMPLE US"], "another device");
    await page.getByRole("button", { name: "处理同步冲突", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "处理组合同步冲突" });
    await dialog.getByText("标签 · SAMPLE US", { exact: true }).waitFor();
    assert.equal(await dialog.getByRole("button", { name: "确认并同步" }).isDisabled(), true);
    await page.setViewportSize({ width: 390, height: 844 });
    const bounds = await dialog.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.width <= 390 && bounds.y >= 0 && bounds.height <= 844);
    assert.equal(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth), true, "mobile dialog must not overflow horizontally");
    if (process.env.PORTFOLIO_TEST_SCREENSHOT) await page.screenshot({ path: process.env.PORTFOLIO_TEST_SCREENSHOT.replace(".png", "-conflict-mobile.png") });
    await page.setViewportSize({ width: 1440, height: 1000 });
    if (process.env.PORTFOLIO_TEST_SCREENSHOT) await page.screenshot({ path: process.env.PORTFOLIO_TEST_SCREENSHOT.replace(".png", "-conflict-desktop.png") });
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    assert.equal(uploads.length, 3, "cancelled review must not upload");
    assert.equal(await tag.textContent(), "saved before reload");
    await page.getByRole("button", { name: "处理同步冲突", exact: true }).click();
    await dialog.getByText("标签 · SAMPLE US", { exact: true }).waitFor();
    await dialog.getByRole("radio", { name: "保留云端", exact: true }).check();
    cloud = { ...cloud, allocation: 250 };
    await dialog.getByRole("button", { name: "确认并同步" }).click();
    await until(() => uploads.length === 4);
    await dialog.getByRole("alert").waitFor();
    assert.equal(await tag.textContent(), "saved before reload", "stale decision must not replace local content");
    await dialog.getByRole("button", { name: "重新读取差异" }).click();
    await dialog.getByText("资金规模", { exact: true }).waitFor();
    await dialog.getByRole("button", { name: "全部选云端" }).click();
    await dialog.getByRole("button", { name: "确认并同步" }).click();
    await until(() => uploads.length === 5);
    assert.equal(await tag.textContent(), "saved before reload", "selection cannot replace local contents before cloud ACK");
    await held.shift()();
    await dialog.waitFor({ state: "hidden" });
    assert.equal(await tag.textContent(), "another device");
    await page.getByRole("button", { name: "账号已同步" }).waitFor();
    await page.reload();
    await page.getByRole("button", { name: "账号已同步" }).waitFor();
    assert.equal(await tag.textContent(), "another device");
    assert.equal(uploads.length, 5, "confirmed resolution must not re-upload on refresh");

    await editTag("before interrupted save");
    cloud = { ...cloud, allocation: 300, tagMap: { "SAMPLE US": "remote recovery" } };
    await until(() => uploads.length === 6);
    await page.waitForFunction((prefix) => JSON.parse(window.readSyntheticPortfolio(prefix, "sync.status.v1"))?.queueState === "manual_review", scopedPrefix);
    await page.getByRole("button", { name: "处理同步冲突", exact: true }).click();
    await dialog.getByText("资金规模", { exact: true }).waitFor();
    await dialog.getByRole("button", { name: "全部选云端" }).click();
    await dialog.getByRole("button", { name: "确认并同步" }).click();
    await until(() => held.length === 1);
    await page.evaluate((prefix) => {
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === `${prefix}state.v2` && JSON.parse(value).values["zhinote.portfolio.allocation.v1"] === "300") throw new DOMException("Synthetic interrupted write", "QuotaExceededError");
        return setItem.call(this, key, value);
      };
    }, scopedPrefix);
    await held.shift()();
    await dialog.getByRole("alert").waitFor();
    assert.equal(await page.evaluate((prefix) => JSON.parse(window.readSyntheticPortfolio(prefix, "sync.resolution.v1.account")).state, scopedPrefix), "queued");
    assert.equal(await page.evaluate((prefix) => window.readSyntheticPortfolio(prefix, "allocation.v1"), scopedPrefix), "250");
    // Simulate an interrupted journal from an older release. Atomic commits
    // cannot create a partially applied portfolio, but must still recover it.
    await page.evaluate((prefix) => {
      const record = JSON.parse(localStorage.getItem(`${prefix}state.v2`));
      const key = "zhinote.portfolio.sync.resolution.v1.account";
      const journal = JSON.parse(record.values[key]);
      journal.state = "applying";
      record.values[key] = JSON.stringify(journal);
      record.values["zhinote.portfolio.tags.v1"] = JSON.stringify(journal.data.tagMap);
      localStorage.setItem(`${prefix}state.v2`, JSON.stringify(record));
    }, scopedPrefix);
    await page.reload();
    await page.getByRole("button", { name: "处理同步冲突", exact: true }).click();
    await dialog.getByRole("button", { name: "全部选保存前" }).waitFor();
    await dialog.getByText("上次保存未完成。保存前副本、本机当前内容与云端版本均已保留。", { exact: true }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth), true, "three-way recovery must fit mobile");
    if (process.env.PORTFOLIO_TEST_SCREENSHOT) await page.screenshot({ path: process.env.PORTFOLIO_TEST_SCREENSHOT.replace(".png", "-recovery-mobile.png") });
    await page.setViewportSize({ width: 1440, height: 1000 });
    if (process.env.PORTFOLIO_TEST_SCREENSHOT) await page.screenshot({ path: process.env.PORTFOLIO_TEST_SCREENSHOT.replace(".png", "-recovery-desktop.png") });
    const currentTag = await tag.textContent();
    await dialog.getByRole("button", { name: "全部选保存前" }).click();
    await dialog.getByRole("button", { name: "确认并同步" }).click();
    await until(() => held.length === 1);
    assert.equal(await tag.textContent(), currentTag, "recovery cannot replace content before ACK");
    await held.shift()();
    await dialog.waitFor({ state: "hidden" });
    await page.getByRole("button", { name: "账号已同步" }).waitFor();
    assert.equal(await tag.textContent(), "before interrupted save");
    assert.equal(cloud.allocation, 250);
    const afterRecovery = uploads.length;
    await page.reload();
    await page.getByRole("button", { name: "账号已同步" }).waitFor();
    assert.equal(await tag.textContent(), "before interrupted save");
    assert.equal(uploads.length, afterRecovery);

    await page.evaluate((prefix) => {
      const key = `${prefix}state.v2`, oldValue = localStorage.getItem(key);
      const record = JSON.parse(oldValue);
      record.values["zhinote.portfolio.sync.status.v1"] = "synthetic broken queue";
      const newValue = JSON.stringify(record);
      localStorage.setItem(key, newValue);
      window.dispatchEvent(new StorageEvent("storage", { key, oldValue, newValue }));
      window.dispatchEvent(new Event("focus"));
    }, scopedPrefix);
    await page.getByRole("button", { name: "处理同步冲突", exact: true }).click();
    await dialog.getByText("内容已一致，等待云端确认。", { exact: true }).waitFor();
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate((prefix) => window.readSyntheticPortfolio(prefix, "sync.status.v1"), scopedPrefix), "synthetic broken queue", "opening/cancelling review must retain raw damaged state");
    assert.equal(uploads.length, afterRecovery);
    await page.getByRole("button", { name: "处理同步冲突", exact: true }).click();
    await dialog.getByText("内容已一致，等待云端确认。", { exact: true }).waitFor();
    await dialog.getByRole("button", { name: "确认并同步" }).click();
    await until(() => held.length === 1);
    assert.equal(await page.evaluate((prefix) => Object.keys(localStorage).some((key) =>
      key.startsWith(`${prefix}conflict.review.v1.`) && JSON.parse(localStorage.getItem(key)).review?.queueSnapshot === "synthetic broken queue"), scopedPrefix), true);
    assert.equal(await tag.textContent(), "before interrupted save");
    await held.shift()();
    await dialog.waitFor({ state: "hidden" });
    await page.getByRole("button", { name: "账号已同步" }).waitFor();
    assert.equal(uploads.length, afterRecovery + 1);
    if (process.env.PORTFOLIO_TEST_SCREENSHOT) await page.screenshot({ path: process.env.PORTFOLIO_TEST_SCREENSHOT });
    assert.deepEqual(errors, []);
    console.log("Verified isolated editing, late ACK, cloud deletion, conflict/recovery review on desktop/mobile, damaged queue repair and clean reload.");
  } finally { await browser.close(); }
});

test("portfolio UI: account A/B/A, delayed ACK and explicit legacy ownership review", { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await installPortfolioStorageProbe(context);
    let activeId = "account-a", hold = true;
    const clouds = new Map(["account-a", "account-b"].map((id) => [id, { ...structuredClone(initial), tagMap: { "SAMPLE US": id } }]));
    const uploads = [], replies = [], errors = [], emailCalls = [];
    const account = () => ({ id: activeId, email_hint: "s***@example.invalid", display_name: activeId, createdAt: now });
    const version = (id, data) => ({ ...versionOf(data), scope: createHash("sha256").update(id).digest("hex") });
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== new URL(base).origin) return route.abort();
      const id = activeId;
      const json = (data, status = 200) => route.fulfill({ status, json: data });
      if (url.pathname === "/api/account/me") return json({ authenticated: true, account: account() });
      if (url.pathname === "/api/portfolio/email-position") {
        assert.equal(route.request().headers()["x-zhinote-account-id"], id);
        emailCalls.push(id);
        return json({ error: "Synthetic mailbox disabled" }, 403);
      }
      if (url.pathname === "/api/portfolio/account-sync") {
        const body = route.request().postDataJSON();
        assert.equal(body.expectedAccountId, id);
        const cloud = clouds.get(id);
        if (body.action === "shares") return json({ accountId: id, members: [], sharedWithMe: [] });
        if (body.action === "pull") return json({ accountId: id, data: cloud, version: version(id, cloud) });
        if (body.action === "push") {
          uploads.push({ id, data: body.data });
          if (body.base?.revision !== version(id, cloud).revision && JSON.stringify(cloud) !== JSON.stringify(body.data)) {
            return json({ accountId: id, code: "portfolio-conflict", data: cloud, version: version(id, cloud), error: "Synthetic conflict" }, 409);
          }
          clouds.set(id, body.data);
          const reply = () => json({ accountId: id, tagMap: body.data.tagMap, ack: {
            format: "zhinote-portfolio-cloud-ack-receipt", format_version: 2, request_id: body.requestId,
            ...version(id, body.data), accepted: true, ack_status: "acknowledged", updated_at: body.data.updatedAt,
          } });
          if (hold) { replies.push(reply); return; }
          return reply();
        }
      }
      if (url.pathname.startsWith("/api/")) return json({ error: "isolated test" }, 501);
      return route.continue();
    });
    await context.addInitScript((data) => {
      if (localStorage.getItem("synthetic-legacy-seeded")) return;
      localStorage.setItem("synthetic-legacy-seeded", "true");
      localStorage.setItem("zhinote.portfolio.snapshot.v1", JSON.stringify(data.snapshot));
      localStorage.setItem("zhinote.portfolio.tags.v1", JSON.stringify({ "SAMPLE US": "unowned legacy" }));
    }, initial);
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${base}/portfolio`);
    const tag = page.getByTitle("点击修改标签", { exact: true });
    const synced = page.getByRole("button", { name: "账号已同步" });
    await synced.waitFor();
    assert.equal(await tag.textContent(), "account-a");
    assert.equal(uploads.length, 0, "unowned legacy data must not be adopted automatically");
    const status = (id) => page.evaluate((id) => JSON.parse(window.readSyntheticPortfolio(`zhinote.portfolio.scoped.v1.${encodeURIComponent(`account:${id}`)}.`, "sync.status.v1")), id);
    async function edit(value) {
      await tag.click();
      const input = page.locator('input[list="zhinote-portfolio-tags"]');
      await input.fill(value); await input.press("Enter");
      assert.equal(await tag.textContent(), value);
    }
    async function switchTo(id) {
      activeId = id;
      // Another tab changes local identity while this tab still remembers A.
      // The app must confirm the server session before remounting its cache.
      await page.evaluate((info) => {
        const key = "zhinote:account-session-last-authenticated:v1";
        const value = JSON.stringify({ account: info, storedAt: Date.now() });
        localStorage.setItem(key, value);
        window.dispatchEvent(new StorageEvent("storage", { key, newValue: value }));
      }, account());
    }
    await edit("A pending");
    await until(() => replies.length === 1);
    await switchTo("account-b");
    await synced.waitFor();
    await page.waitForFunction(() => document.querySelector('[title="点击修改标签"]')?.textContent === "account-b");
    await replies.shift()();
    assert.equal((await status("account-a")).pending, 1);
    assert.equal((await status("account-b"))?.pending ?? 0, 0);
    assert.equal(await tag.textContent(), "account-b");
    hold = false;
    await edit("B edit");
    await until(() => uploads.some((upload) => upload.id === "account-b"));
    await synced.waitFor();
    await switchTo("account-a");
    await synced.waitFor();
    await page.waitForFunction(() => document.querySelector('[title="点击修改标签"]')?.textContent === "A pending");
    assert.equal((await status("account-a")).pending, 0);
    assert.equal(clouds.get("account-b").tagMap["SAMPLE US"], "B edit");
    for (const upload of uploads) assert.notEqual(upload.data.tagMap["SAMPLE US"], "unowned legacy");
    const beforeReview = uploads.length;
    const legacyButton = page.getByRole("button", { name: "核对旧版组合", exact: true });
    page.once("dialog", (dialog) => dialog.dismiss());
    await legacyButton.click();
    assert.equal(await page.getByRole("dialog").count(), 0);
    page.once("dialog", (dialog) => dialog.accept());
    await legacyButton.click();
    const dialog = page.getByRole("dialog", { name: "核对旧版本机组合" });
    await dialog.getByText("标签 · SAMPLE US", { exact: true }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth), true);
    if (process.env.PORTFOLIO_TEST_SCREENSHOT) await page.screenshot({ path: process.env.PORTFOLIO_TEST_SCREENSHOT.replace(".png", "-legacy-mobile.png") });
    await dialog.getByRole("button", { name: "全部选本机" }).click();
    hold = true;
    await dialog.getByRole("button", { name: "确认并同步" }).click();
    await until(() => replies.length === 1);
    assert.equal(await tag.textContent(), "A pending", "ownership decision does not replace current data before ACK");
    assert.equal(uploads.length, beforeReview + 1);
    await replies.shift()();
    await dialog.waitFor({ state: "hidden" });
    assert.equal(await tag.textContent(), "unowned legacy");
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("zhinote.portfolio.tags.v1"))["SAMPLE US"]), "unowned legacy");
    assert.equal(await legacyButton.count(), 0, "confirmed ownership is remembered for this account");
    assert.equal(clouds.get("account-b").tagMap["SAMPLE US"], "B edit");
    // A stale per-tab identity on boot also needs confirmation, even without
    // receiving another storage event after mounting the board.
    await page.evaluate(() => sessionStorage.setItem("zhinote:account-session-last-authenticated:v1",
      JSON.stringify({ account: { id: "account-b" }, storedAt: Date.now() })));
    await page.reload();
    await synced.waitFor();
    assert.equal(await tag.textContent(), "unowned legacy");
    assert.deepEqual(errors, []);
    assert.ok(emailCalls.length > 0);
  } finally { await browser.close(); }
});

test("email setup UI: same-account refresh survives; switched account cannot display a late token", { timeout: 45000 }, async () => {
  const browser = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  try {
    const context = await browser.newContext();
    const replies = [], errors = [];
    let activeId = "account-a", polls = 0;
    const info = () => ({ id: activeId, email_hint: "s***@example.invalid", display_name: activeId, createdAt: now });
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== new URL(base).origin) return route.abort();
      if (url.pathname === "/api/account/me") return route.fulfill({ json: { authenticated: true, account: info() } });
      if (url.pathname === "/api/portfolio/email-setup") {
        const id = activeId;
        assert.equal(route.request().headers()["x-zhinote-account-id"], id);
        if (route.request().postDataJSON().action === "start") return route.fulfill({ json: {
          accountId: id, userCode: "SYNTHETIC-CODE", deviceCode: "synthetic-device", verificationUri: "https://example.invalid", interval: 5,
        } });
        polls++;
        replies.push(() => route.fulfill({ json: { accountId: id, status: "ok", refreshToken: "synthetic-private-token" } }));
        return;
      }
      if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 501, json: { error: "isolated" } });
      return route.continue();
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${base}/portfolio/email-setup`);
    await page.getByPlaceholder("粘贴 Application (client) ID").fill("synthetic-client");
    await page.getByRole("button", { name: "开始授权", exact: true }).click();
    await page.getByText("SYNTHETIC-CODE", { exact: true }).waitFor();
    const notify = () => page.evaluate((account) => {
      const key = "zhinote:account-session-last-authenticated:v1";
      const newValue = JSON.stringify({ account, storedAt: Date.now() });
      localStorage.setItem(key, newValue);
      window.dispatchEvent(new StorageEvent("storage", { key, newValue }));
    }, info());
    await notify();
    await page.getByText("SYNTHETIC-CODE", { exact: true }).waitFor();
    await until(() => replies.length === 1);
    activeId = "account-b";
    await notify();
    await page.getByText("SYNTHETIC-CODE", { exact: true }).waitFor({ state: "hidden" });
    await replies.shift()();
    await page.getByRole("button", { name: "开始授权", exact: true }).waitFor();
    assert.equal(await page.getByText(/授权成功/).count(), 0);
    assert.equal(await page.evaluate(() => JSON.stringify(localStorage).includes("synthetic-private-token")), false);
    assert.equal(polls, 1);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

for (const mode of ["account", "passcode"]) {
  test(`portfolio ${mode} UI: late clean pulls cannot undo a newer pull, confirmed edit, or initial-sync edit`, { timeout: 90000 }, async () => {
    const browser = await chromium.launch({ headless: true,
      ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
    try {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      await installPortfolioStorageProbe(context);
      const prefix = mode === "account" ? scopedPrefix : "zhinote.portfolio.scoped.v1.local.";
      const apiPath = mode === "account" ? "/api/portfolio/account-sync" : "/api/portfolio/sync";
      if (mode === "passcode") await context.addInitScript((prefix) => {
        localStorage.setItem(`${prefix}syncPasscode.v1`, "synthetic-passcode");
      }, prefix);
      let cloud = structuredClone(initial), holdNextPull = false;
      const held = [], uploads = [], errors = [];
      await context.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (url.origin !== new URL(base).origin) return route.abort();
        const json = (body, status = 200) => route.fulfill({ status, json: { accountId: "synthetic", ...body } });
        if (url.pathname === "/api/account/me") return json(mode === "passcode" ? { authenticated: false } : { authenticated: true, account: {
          id: "synthetic", email_hint: "s***@example.invalid", display_name: "Synthetic", createdAt: now,
        } });
        if (url.pathname === apiPath) {
          const body = route.request().postDataJSON();
          if (body.action === "pull") {
            const copy = structuredClone(cloud);
            const reply = (status = 200) => json(status === 200 ? { data: copy, version: versionOf(copy) }
              : { error: "Synthetic late failure" }, status);
            if (holdNextPull) { holdNextPull = false; held.push(reply); return; }
            return reply();
          }
          if (body.action === "push") {
            uploads.push(body.data);
            if (JSON.stringify(body.data) !== JSON.stringify(cloud)) {
              assert.equal(body.base?.revision, versionOf(cloud).revision, "local edits keep their confirmed baseline");
            }
            cloud = body.data;
            return json({ tagMap: cloud.tagMap, ack: {
              format: "zhinote-portfolio-cloud-ack-receipt", format_version: 2,
              request_id: body.requestId, ...versionOf(cloud), ack_status: "acknowledged",
              accepted: true, updated_at: cloud.updatedAt,
            } });
          }
        }
        if (url.pathname.startsWith("/api/")) return json({ error: "isolated" }, 501);
        return route.continue();
      });
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      const tag = page.getByTitle("点击修改标签", { exact: true });
      const synced = page.getByRole("button", { name: /已同步/ });
      const focus = () => page.evaluate(() => window.dispatchEvent(new Event("focus")));
      const expectTag = async (text) => page.waitForFunction((value) =>
        document.querySelector('[title="点击修改标签"]')?.textContent === value, text);
      const edit = async (text) => {
        await tag.click();
        const input = page.locator('input[list="zhinote-portfolio-tags"]');
        await input.fill(text); await input.press("Enter");
        await expectTag(text);
      };
      const release = async (status = 200) => {
        const response = page.waitForResponse((r) => r.url().endsWith(apiPath) &&
          r.request().postDataJSON().action === "pull" && r.status() === status);
        await held.shift()(status);
        await (await response).finished();
        // Let the fetch continuation and React state update run, not only HTTP completion.
        await page.waitForTimeout(200);
      };
      await page.goto(`${base}/portfolio`);
      await synced.waitFor(); await expectTag("original");
      holdNextPull = true; await focus(); await until(() => held.length === 1);
      cloud = { ...cloud, tagMap: { "SAMPLE US": "newer remote" } };
      await focus(); await expectTag("newer remote");
      await release();
      assert.equal(await tag.textContent(), "newer remote", "a slower older pull must not roll back a newer pull");
      assert.equal(uploads.length, 0);

      for (const lateStatus of [200, 403]) {
        holdNextPull = true; await focus(); await until(() => held.length === 1);
        const text = `confirmed edit ${lateStatus}`;
        await edit(text); await synced.waitFor();
        assert.equal(cloud.tagMap["SAMPLE US"], text);
        const saved = await page.evaluate((prefix) => localStorage.getItem(`${prefix}state.v2`), prefix);
        await release(lateStatus);
        assert.equal(await tag.textContent(), text, "a cleared queue is not permission to apply a pre-edit response");
        assert.equal(await synced.count(), 1, "a late failure cannot regress confirmed status");
        assert.equal(await page.evaluate((prefix) => localStorage.getItem(`${prefix}state.v2`), prefix), saved);
      }

      // A real second browser tab shares localStorage, not the first tab's refs.
      holdNextPull = true; await focus(); await until(() => held.length === 1);
      const second = await context.newPage();
      second.on("pageerror", (error) => errors.push(error.message));
      await second.goto(`${base}/portfolio`);
      await second.getByRole("button", { name: /已同步/ }).waitFor();
      await second.getByTitle("点击修改标签", { exact: true }).click();
      const secondInput = second.locator('input[list="zhinote-portfolio-tags"]');
      await secondInput.fill("confirmed in another tab"); await secondInput.press("Enter");
      await second.getByRole("button", { name: /已同步/ }).waitFor();
      await expectTag("confirmed in another tab");
      await release();
      assert.equal(await tag.textContent(), "confirmed in another tab", "an old pull cannot overwrite another tab's confirmed edit");
      assert.equal(cloud.tagMap["SAMPLE US"], "confirmed in another tab");
      await second.close();

      holdNextPull = true; await page.reload(); await until(() => held.length === 1);
      await edit("edit during initial pull");
      await release();
      await synced.waitFor();
      assert.equal(cloud.tagMap["SAMPLE US"], "edit during initial pull");
      assert.equal(await tag.textContent(), "edit during initial pull");
      const count = uploads.length;
      await page.reload(); await synced.waitFor();
      assert.equal(await tag.textContent(), "edit during initial pull");
      assert.equal(uploads.length, count, "a confirmed reload must stay quiet");
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}

async function until(check) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > 20000) throw new Error("Expected synthetic request did not arrive");
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}
