// Fresh browser profiles; every business API is intercepted. No real account or content.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const origin = new URL(process.env.SYNC_TEST_URL ?? "http://127.0.0.1:3026").origin;
const production = process.env.SYNC_TEST_PRODUCTION_ALLOWED === "true";
assert.ok(production
  ? ["https://zhi-note.com", "https://www.zhi-note.com"].includes(origin)
  : ["127.0.0.1", "localhost"].includes(new URL(origin).hostname));
const artifacts = new URL(production
  ? "../.local/sync-status-production-verification/overview/"
  : "../.local/sync-status-verification/", import.meta.url);
mkdirSync(artifacts, { recursive: true });
const until = async (check) => {
  const deadline = Date.now() + 25000;
  while (!await check()) {
    assert.ok(Date.now() < deadline, "Timed out waiting for synthetic sync status");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
};

test("sync overview: counts, privacy, retry, offline, login, advanced view and responsive layout", { timeout: 120000 }, async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const errors = [], requests = [];
  async function device({ pending = 0, enabled = false, width = 1440 } = {}) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, serviceWorkers: "block" });
    await context.route("**/*", async (route) => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname.startsWith("/api/")) {
        requests.push(url.pathname);
        if (url.pathname === "/api/account/me") {
          return route.fulfill({ json: { authenticated: false, account: null } });
        }
        return route.fulfill({ status: 501, json: { error: "Synthetic isolation", code: "unconfigured" } });
      }
      if (request.method() === "GET" && (url.pathname === "/modules/sync" ||
        url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/brand/source/") ||
        url.pathname === "/favicon.ico")) return route.continue();
      return route.abort();
    });
    await context.addInitScript(({ pending, enabled }) => {
      // Only initialize once, so a reload tests retention rather than reseeding.
      if (sessionStorage.getItem("synthetic-seeded")) return;
      sessionStorage.setItem("synthetic-seeded", "true");
      localStorage.setItem("zhinote.pagesync.enabled", String(enabled));
      localStorage.setItem("zhinote.databasesync.enabled", String(enabled));
      localStorage.setItem("zhinote.pagesync.pendingPushIds", JSON.stringify(
        Array.from({ length: pending }, (_, i) => `synthetic-page-${i}`)
      ));
    }, { pending, enabled });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${origin}/modules/sync`);
    await page.getByTestId("sync-overview").waitFor({ state: "attached" });
    if (width < 768) await page.getByTitle("收起侧边栏", { exact: true }).click();
    await page.getByTestId("sync-overview").waitFor();
    await until(async () => !/核对中/.test(await page.getByTestId("sync-pending-total").innerText()));
    return { context, page };
  }
  try {
    const { page } = await device({ pending: 50 });
    assert.equal(await page.getByTestId("sync-pending-total").innerText(), "50 项待上传");
    assert.match(await page.getByTestId("sync-domain-pages").innerText(), /50 项待上传/);
    assert.equal(await page.getByTestId("sidebar-sync-status").getAttribute("data-sync-pending-total"), "50");
    assert.equal(await page.getByRole("heading", { name: "高级诊断", exact: true }).count(), 0);
    assert.ok(!requests.includes("/api/web-beta/environment-preflight"), "advanced checks must not run on entry");
    await page.getByRole("button", { name: "重试普通同步", exact: true }).click();
    await page.getByRole("button", { name: "重试普通同步", exact: true }).waitFor();
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("zhinote.pagesync.pendingPushIds")).length), 50);
    assert.ok(!requests.includes("/api/files/embed-sync"), "normal retry cannot upload files");
    await page.reload();
    await until(async () => (await page.getByTestId("sync-pending-total").innerText()) === "50 项待上传");
    await page.screenshot({ path: new URL("desktop.png", artifacts).pathname, fullPage: true });
    await page.getByRole("button", { name: "高级诊断", exact: true }).click();
    await page.getByRole("heading", { name: "高级诊断", exact: true }).waitFor();
    await page.getByTestId("account-cloud-sync-coordinator").click();
    await page.getByTestId("sync-overview").waitFor();
    await page.getByRole("button", { name: "高级诊断", exact: true }).click();
    await page.getByRole("heading", { name: "高级诊断", exact: true }).waitFor();
    await page.getByRole("button", { name: "同步状态", exact: true }).click();
    await page.getByTestId("sync-overview").waitFor();

    const mobile = await device({ width: 390 });
    await mobile.page.screenshot({ path: new URL("mobile.png", artifacts).pathname, fullPage: true });
    assert.equal(await mobile.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const header = await mobile.page.getByRole("heading", { name: "云同步与权限", exact: true }).boundingBox();
    const toggle = await mobile.page.getByRole("button", { name: /^打开侧边栏；/ }).boundingBox();
    assert.ok(header.x >= toggle.x + toggle.width, "collapsed sidebar toggle must not overlap heading");
    await mobile.context.setOffline(true);
    await until(async () => (await mobile.page.getByTestId("sync-domain-settings").innerText()).includes("离线"));
    assert.equal(await mobile.page.getByRole("button", { name: "重试普通同步", exact: true }).isDisabled(), true);
    await mobile.context.setOffline(false);
    await until(async () => !(await mobile.page.getByTestId("sync-domain-settings").innerText()).includes("离线"));

    const signedOut = await device({ enabled: true });
    await signedOut.page.getByRole("link", { name: "检查登录", exact: true }).first().waitFor();
    assert.equal(await signedOut.page.getByTestId("sync-overview").getAttribute("data-state"), "signed-out");
    assert.deepEqual(errors, []);
    writeFileSync(new URL("result.json", artifacts), JSON.stringify({
      passed: true, scope: "synthetic-isolated-browser-only", realAccountsRead: false,
      origin, productionAssets: production, allBusinessApisIntercepted: true,
      productionWrites: false, physicalTwoDeviceAcceptance: false,
      tests: ["deduplicated-counts", "no-eager-advanced-checks", "safe-retry",
        "refresh-retention", "advanced-navigation", "desktop-mobile-layout", "offline-recovery", "signed-out"],
    }, null, 2));
  } finally {
    await browser.close();
  }
});
