// Fresh synthetic accounts only. Every API is intercepted, including email/AI.
// The optional public-assets mode reads the published UI, never production data.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const base = process.env.PORTFOLIO_TEST_URL ?? "http://127.0.0.1:3007";
const origin = new URL(base).origin;
assert.ok(["127.0.0.1", "localhost"].includes(new URL(base).hostname) ||
  (process.env.PORTFOLIO_PUBLIC_ASSETS === "1" && origin === "https://zhi-note.com"));
const now = "2026-09-28T00:00:00.000Z";
const newKey = "SYNTHETIC US";
const scopedPrefix = "zhinote.portfolio.scoped.v1.account%3Asynthetic.";
const initial = {
  snapshot: { importedAt: now, sourceName: "synthetic-new-position.xlsx", positions: [{
    key: newKey, ticker: "SYNTHETIC", name: "Synthetic new position", nmv: 10, gmv: 10,
    pnlDaily: 0, pnlMtd: 0, pnlYtd: 0, pnlItd: 0, priceChange1dPct: 0,
    country: "US", sector: "Synthetic",
  }] },
  tagMap: {}, allocation: 100, maxNetPct: 12, lastEmailMessageId: null, updatedAt: now,
};
const versionOf = (data) => ({ scope: "a".repeat(64),
  revision: createHash("sha256").update(JSON.stringify(data)).digest("hex") });

test("new-position label entered during startup sync reaches an independent device", { timeout: 60000 }, async (t) => {
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome" });
  let cloud = structuredClone(initial);
  let firstUpload = true;
  let releaseUpload;
  let heldUpload = false;
  let versionedClient = false;
  let pushes = 0;
  const errors = [];
  async function device(seed = false) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: "block" });
    await context.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin !== origin) return route.abort();
      const json = (body, status = 200) => route.fulfill({ status, json: body });
      if (url.pathname === "/api/account/me") {
        return json({ authenticated: true, account: { id: "synthetic", email_hint: "s***@example.invalid",
          display_name: "Synthetic handoff", createdAt: now } });
      }
      if (url.pathname === "/api/portfolio/account-sync") {
        const body = request.postDataJSON();
        const modern = body.expectedAccountId === "synthetic";
        versionedClient ||= modern;
        const reply = (data, status = 200) => json({ ...(modern ? { accountId: "synthetic" } : {}), ...data }, status);
        if (body.action === "shares") return reply({ members: [], sharedWithMe: [] });
        if (body.action === "pull") return reply({ data: cloud, version: versionOf(cloud) });
        if (body.action === "push") {
          pushes++;
          if (modern && body.base?.revision !== versionOf(cloud).revision && JSON.stringify(body.data) !== JSON.stringify(cloud)) {
            return reply({ code: "portfolio-conflict", error: "Synthetic conflict", data: cloud, version: versionOf(cloud) }, 409);
          }
          cloud = structuredClone(body.data);
          const saved = structuredClone(cloud);
          if (firstUpload) {
            firstUpload = false;
            heldUpload = true;
            await new Promise((resolve) => { releaseUpload = resolve; });
          }
          return reply({ tagMap: saved.tagMap, ack: {
            format: "zhinote-portfolio-cloud-ack-receipt", format_version: modern ? 2 : 1,
            ...(modern ? { request_id: body.requestId, ...versionOf(saved) } : {}),
            ack_status: "acknowledged", accepted: true, updated_at: saved.updatedAt,
          } });
        }
        return json({ error: "Unexpected synthetic action" }, 400);
      }
      if (url.pathname.startsWith("/api/")) return json({ error: "Isolated synthetic test" }, 501);
      // Only public UI resources can leave the isolated browser context.
      if (request.method() === "GET" && (url.pathname === "/portfolio" ||
          url.pathname.startsWith("/_next/static/") || url.pathname === "/favicon.ico")) return route.continue();
      return route.abort();
    });
    if (seed) await context.addInitScript(({ data, prefix }) => {
      if (localStorage.getItem("synthetic-handoff-seeded")) return;
      localStorage.setItem("synthetic-handoff-seeded", "true");
      for (const root of ["zhinote.portfolio.", prefix]) {
        for (const [key, value] of Object.entries({
          snapshot: JSON.stringify(data.snapshot), tags: JSON.stringify(data.tagMap),
          allocation: String(data.allocation), maxNetPct: String(data.maxNetPct), updatedAt: data.updatedAt,
        })) localStorage.setItem(`${root}${key}.v1`, value);
      }
    }, { data: initial, prefix: scopedPrefix });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${origin}/portfolio`);
    await page.getByTitle("点击修改标签", { exact: true }).waitFor();
    return page;
  }
  try {
    const a = await device(true);
    const tagA = a.getByTitle("点击修改标签", { exact: true });
    // The published v1 client uploads even on a clean startup. v2 does not.
    await until(async () => heldUpload || await a.getByRole("button", { name: "账号已同步" }).isVisible());
    if (versionedClient) firstUpload = false;
    await tagA.click();
    const input = a.locator('input[list="zhinote-portfolio-tags"]');
    await input.fill("synthetic sector");
    await input.press("Enter");
    await until(async () => await tagA.textContent() === "synthetic sector");
    releaseUpload?.();
    await a.getByRole("button", { name: "账号已同步" }).waitFor();
    // Allow the normal debounce and notification-triggered retry to run.
    await new Promise((resolve) => setTimeout(resolve, 4000));
    const beforeB = cloud.tagMap[newKey] ?? null;
    const b = await device();
    await b.getByRole("button", { name: "账号已同步" }).waitFor();
    const tagB = b.getByTitle("点击修改标签", { exact: true });
    const result = { versionedClient, pushes, deviceA: await tagA.textContent(),
      acknowledgedCloudTag: beforeB, deviceB: await tagB.textContent(), pageErrors: errors.length };
    t.diagnostic(JSON.stringify(result));
    assert.equal(beforeB, "synthetic sector", "showing synced must mean the new label reached the cloud");
    assert.equal(await tagB.textContent(), "synthetic sector", "second device must not need independent tagging");
    await b.reload();
    await b.getByRole("button", { name: "账号已同步" }).waitFor();
    assert.equal(await tagB.textContent(), "synthetic sector", "received labels must survive reload");
    assert.deepEqual(errors, []);
  } finally {
    releaseUpload?.();
    await browser.close();
  }
});

async function until(check) {
  const deadline = Date.now() + 15000;
  while (!await check()) {
    assert.ok(Date.now() < deadline, "Timed out waiting for synthetic handoff");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
