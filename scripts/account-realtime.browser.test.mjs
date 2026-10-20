// Real Next routes and isolated Chrome contexts, backed only by an in-memory
// synthetic Redis REST/PubSub simulator. This is NOT physical-device proof.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createRequire } from "node:module";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const root = new URL("../", import.meta.url).pathname;
const artifacts = new URL("../.local/realtime-verification/", import.meta.url);
const accountId = "synthetic-realtime", email = "sync@example.invalid", token = "a".repeat(64);
const now = "2026-10-20T00:00:00.000Z";
const dataKey = `zhinotes:portfolio:data:acct:${email}`;
const note = { id: "synthetic-realtime-note", parent_id: null, title: "Synthetic realtime note", icon: null,
  cover_url: null, content_text: "<p>Synthetic original text</p>", properties: null,
  position: 0, depth: 0, created_at: now, updated_at: now, deleted_at: null };
const seed = {
  snapshot: { importedAt: now, sourceName: "synthetic.xlsx", positions: [
    { key: "ALPHA US", ticker: "ALPHA", name: "Synthetic", nmv: 40, gmv: 40,
      country: "US", sector: "Synthetic", pnlDaily: 0, pnlMtd: 0, pnlYtd: 0, pnlItd: 0, priceChange1dPct: 0 },
  ] }, tagMap: { "ALPHA US": "Initial" }, aiExposureMap: { "ALPHA US": 0 },
  allocation: 100, maxNetPct: 12, lastEmailMessageId: null, updatedAt: now,
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const until = async (fn, message, timeout = 20000) => {
  const deadline = Date.now() + timeout;
  while (!await fn()) { assert.ok(Date.now() < deadline, message); await sleep(50); }
};

test("two isolated foreground clients: push, notification, read, refresh, reconnect and account isolation", { timeout: 120000 }, async () => {
  const values = new Map([
    [`zhinotes:account:session:${token}`, JSON.stringify({ accountId, email })],
    [`zhinotes:account:user:${email}`, JSON.stringify({ id: accountId, email, displayName: "Synthetic", createdAt: now })],
    [dataKey, JSON.stringify(seed)],
    [`zhinotes:pagesync:page:${email}:${note.id}`, JSON.stringify(note)],
    [`zhinotes:pagesync:index:${email}`, JSON.stringify({ [note.id]: { u: now, d: 0 } })],
    [`zhinotes:pagesync:changes:${email}`, JSON.stringify([{ id: note.id, u: now, d: 0 }])],
  ]);
  const subscribers = new Map();
  let published = 0, dropNotifications = false;
  const kv = createServer(async (req, res) => {
    try {
      const parts = new URL(req.url, "http://localhost").pathname.split("/").slice(1).map(decodeURIComponent);
      if (parts[0] === "subscribe") {
        const channel = parts[1];
        const clients = subscribers.get(channel) ?? new Set();
        subscribers.set(channel, clients); clients.add(res);
        res.writeHead(200, { "content-type": "text/event-stream" });
        res.write(`data: subscribe,${channel},1\n\n`);
        req.on("close", () => clients.delete(res));
        return;
      }
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks).toString();
      const pipeline = parts[0] === "pipeline";
      const commands = pipeline ? JSON.parse(body) : [parts[0] ? parts : JSON.parse(body)];
      const results = commands.map(command => {
      const op = command[0].toLowerCase();
      let result;
      if (op === "get") result = values.get(command[1]) ?? null;
      else if (op === "set" || op === "setex") {
        values.set(command[1], parts[0] && !pipeline ? body : command.at(-1)); result = "OK";
      } else if (op === "publish") {
        const clients = subscribers.get(command[1]) ?? new Set();
        published++;
        if (!dropNotifications) for (const client of clients) client.write(`data: message,${command[1]},${command[2]}\n\n`);
        result = clients.size;
      } else if (op === "eval") {
        const keyCount = Number(command[2]);
        const keys = command.slice(3, 3 + keyCount), args = command.slice(3 + keyCount);
        assert.match(command[1], /local current = redis.call/);
        const current = values.get(keys[0]) ?? "";
        if (current !== args[0] && current !== args[1]) result = [0, current];
        else {
          values.set(keys[0], args[1]);
          if (keys[1]) values.set(keys[1], args[2]);
          result = [1, args[1]];
        }
      } else throw new Error(`Unexpected synthetic KV operation: ${op}`);
      const encode = value => typeof value === "string" ? Buffer.from(value).toString("base64")
        : Array.isArray(value) ? value.map(encode) : value;
      return { result: req.headers["upstash-encoding"] === "base64" ? encode(result) : result };
      });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(pipeline ? results : results[0]));
    } catch (error) { res.writeHead(500); res.end(JSON.stringify({ error: error.message })); }
  });
  await new Promise(resolve => kv.listen(0, "127.0.0.1", resolve));
  const portProbe = createServer();
  await new Promise(resolve => portProbe.listen(0, "127.0.0.1", resolve));
  const port = portProbe.address().port;
  await new Promise(resolve => portProbe.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(port)], {
    cwd: root, stdio: ["ignore", "pipe", "pipe"],
    env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "production",
      KV_REST_API_URL: `http://127.0.0.1:${kv.address().port}`, KV_REST_API_TOKEN: "synthetic-only",
      ZHINOTES_ACCOUNT_ALLOWED_EMAILS: email, ZHINOTES_REALTIME_SYNC_ENABLED: "true" },
  });
  let logs = ""; server.stdout.on("data", value => logs += value); server.stderr.on("data", value => logs += value);
  let browser;
  const errors = [];
  const noteUploads = [];
  mkdirSync(artifacts, { recursive: true });
  rmSync(new URL("result.json", artifacts), { force: true });
  try {
    await until(async () => { try { return (await fetch(origin)).ok; } catch { return false; } }, "Next server did not start");
    browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome" });
    async function device(viewport = { width: 1440, height: 1000 }) {
      const context = await browser.newContext({ viewport, serviceWorkers: "block" });
      await context.addCookies([{ name: "zhinote_session", value: token, url: origin }]);
      // Remove fallback polling to prove delivery came from the notification.
      await context.addInitScript(() => {
        const interval = window.setInterval;
        window.setInterval = (fn, ms, ...args) => interval(fn, [8000, 10000, 15000].includes(ms) ? 3600000 : ms, ...args);
      });
      await context.route("**/*", async route => {
        const url = new URL(route.request().url());
        if (url.origin !== origin) return route.abort();
        if (url.pathname.startsWith("/api/") &&
            !["/api/account/me", "/api/account/sync-events", "/api/portfolio/account-sync", "/api/pages/account-sync"].includes(url.pathname)) {
          return route.fulfill({ status: 501, json: { error: "Synthetic isolation" } });
        }
        return route.continue();
      });
      const page = await context.newPage();
      page.on("request", request => {
        if (new URL(request.url()).pathname !== "/api/pages/account-sync" || request.method() !== "POST") return;
        const body = request.postDataJSON();
        if (body?.action === "push" && body.pages?.some(row => row.id === note.id)) {
          noteUploads.push({ width: viewport.width, page: body.pages.find(row => row.id === note.id) });
        }
      });
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(`${origin}/portfolio`);
      await page.getByRole("button", { name: /账号已同步/ }).waitFor({ timeout: 20000 });
      return { page, context };
    }
    const a = await device(), b = await device({ width: 390, height: 844 });
    await until(() => [...subscribers.values()].reduce((n, set) => n + set.size, 0) >= 2, "Both clients must subscribe");
    const input = page => page.getByRole("spinbutton", { name: "ALPHA US AI Exposure", exact: true });
    const latencies = [];
    for (const value of ["0.25", "0.5", "-0.25"]) {
      const started = Date.now();
      await input(a.page).fill(value); await input(a.page).press("Enter");
      await until(async () => await input(b.page).inputValue() === value, "Change must arrive without polling or focus", 8000);
      latencies.push(Date.now() - started);
      await a.page.getByRole("button", { name: /账号已同步/ }).waitFor();
    }
    assert.ok(published >= 3);
    await a.page.getByTitle("点击修改标签", { exact: true }).first().click();
    const tagInput = a.page.locator('input[list="zhinote-portfolio-tags"]').first();
    await tagInput.fill("Synthetic new tag"); await tagInput.press("Enter");
    await until(async () => await b.page.getByTitle("点击修改标签", { exact: true }).first().textContent() === "Synthetic new tag",
      "New tag must appear without polling or refresh", 8000);
    await b.page.reload();
    await b.page.getByRole("button", { name: /账号已同步/ }).waitFor();
    assert.equal(await input(b.page).inputValue(), "-0.25", "cloud value survives reload");
    assert.equal(await b.page.getByTitle("点击修改标签", { exact: true }).first().textContent(), "Synthetic new tag");

    // Drop one hint, then reconnect: ready must trigger catch-up.
    dropNotifications = true;
    await input(a.page).fill("0.75"); await input(a.page).press("Enter");
    await until(() => JSON.parse(values.get(dataKey)).aiExposureMap["ALPHA US"] === 0.75, "Synthetic save");
    dropNotifications = false;
    for (const clients of subscribers.values()) for (const client of clients) client.end();
    await until(async () => await input(b.page).inputValue() === "0.75", "Reconnect catches up a lost event", 8000);

    const foreignStatus = await a.page.evaluate(async () =>
      (await fetch("/api/account/sync-events?accountId=synthetic-b")).status);
    assert.equal(foreignStatus, 409);
    const collapse = b.page.getByRole("button", { name: /收起侧边栏/ });
    if (await collapse.isVisible()) await collapse.click();
    await input(b.page).scrollIntoViewIfNeeded();
    assert.ok(await b.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await a.page.screenshot({ path: new URL("desktop.png", artifacts).pathname, fullPage: true });
    await b.page.screenshot({ path: new URL("mobile.png", artifacts).pathname, fullPage: true });
    // A concurrent offline edit must not overwrite either version.
    await b.context.setOffline(true);
    await input(b.page).fill("-1"); await input(b.page).press("Enter");
    await input(a.page).fill("1"); await input(a.page).press("Enter");
    await until(() => JSON.parse(values.get(dataKey)).aiExposureMap["ALPHA US"] === 1, "Online edit saved");
    await b.context.setOffline(false);
    await b.page.getByRole("button", { name: "处理同步冲突", exact: true }).waitFor({ timeout: 20000 });
    assert.equal(await input(b.page).inputValue(), "-1", "local conflict draft retained");
    assert.equal(JSON.parse(values.get(dataKey)).aiExposureMap["ALPHA US"], 1, "cloud version retained");
    await a.page.goto(`${origin}/page/${note.id}`);
    await b.page.goto(`${origin}/page/${note.id}`);
    const editorA = a.page.locator(".tiptap[contenteditable=true]");
    const editorB = b.page.locator(".tiptap[contenteditable=true]");
    await editorA.waitFor(); await editorB.waitFor();
    await until(async () => (await editorB.textContent()).includes("Synthetic original text"), "Remote note body hydrated");
    await editorA.fill("Synthetic updated text");
    const noteKey = `zhinotes:pagesync:page:${email}:${note.id}`;
    await until(() => JSON.parse(values.get(noteKey)).content_text?.includes("Synthetic updated text"), "Note committed");
    const savedNote = JSON.parse(values.get(noteKey));
    await until(async () => (await editorB.textContent()).includes("Synthetic updated text"), "Open clean editor follows remote save", 10000);
    await sleep(1500);
    assert.deepEqual(JSON.parse(values.get(noteKey)), savedNote, "Receiving a remote note must not create a new edit");
    // Existing reconciliation can resend an unchanged snapshot. It must never
    // turn editor hydration into a fresh revision with a new timestamp/body.
    for (const upload of noteUploads.filter(upload => upload.width === 390)) {
      assert.ok(upload.page.updated_at <= savedNote.updated_at);
      if (upload.page.updated_at === savedNote.updated_at) assert.equal(upload.page.content_text, savedNote.content_text);
    }
    await b.page.reload();
    await until(async () => (await editorB.textContent()).includes("Synthetic updated text"), "Note survives reload");
    await b.page.screenshot({ path: new URL("note-mobile.png", artifacts).pathname, fullPage: true });
    assert.deepEqual(errors, []);
    const report = { environment: "local production build + synthetic Redis + two isolated Chrome contexts",
      physicalDevices: false, production: false, fallbackPollingDisabled: true, latenciesMs: latencies,
      reconnectCatchUp: true, refreshPersistence: true, newTagHandoff: true, concurrentOfflineEditProtected: true,
      cleanOpenEditorRefresh: true, remoteEditorCreatesNoRevision: true, accountIsolation: true, notificationPublishes: published };
    writeFileSync(new URL("result.json", artifacts), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } catch (error) {
    console.log(JSON.stringify({ syntheticNoteUploads: noteUploads }));
    if (browser) for (const [i, context] of browser.contexts().entries()) {
      for (const page of context.pages()) {
        await page.screenshot({ path: new URL(`failure-${i}.png`, artifacts).pathname }).catch(() => {});
        console.log((await page.locator("main").innerText().catch(() => "")).slice(0, 4000));
      }
    }
    console.log(logs);
    throw error;
  } finally {
    await browser?.close();
    for (const clients of subscribers.values()) for (const client of clients) client.end();
    const stopped = once(server, "exit");
    server.kill("SIGTERM");
    const shutdownTimeout = setTimeout(() => server.kill("SIGKILL"), 5000);
    await stopped;
    clearTimeout(shutdownTimeout);
    kv.closeAllConnections();
    await new Promise(resolve => kv.close(resolve));
  }
});
