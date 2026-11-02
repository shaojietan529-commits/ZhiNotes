// Local production build, fresh synthetic profiles, no real business requests.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { test } from "node:test";
import { CREATE_TABLES_SQL } from "../src/lib/db/local/schema.ts";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const origin = process.env.TEST_ORIGIN ?? "http://127.0.0.1:3057";
assert.equal(new URL(origin).hostname, "127.0.0.1");
const artifacts = new URL("../.local/page-responsiveness-verification/", import.meta.url);

test("Edge: long-document hover, nested blocks, insertion, drag, navigation and mobile", { timeout: 120000 }, async () => {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? "msedge", headless: true });
  const errors = [], results = [];
  let passed = false;
  try {
    await mkdir(artifacts, { recursive: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: "block" });
    await context.route("**/*", async route => {
      const req = route.request(), url = new URL(req.url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname === "/__test_seed") return route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Synthetic</title>" });
      if (url.pathname.startsWith("/__test_assets/")) {
        const name = url.pathname.split("/").at(-1);
        if (!["index.mjs", "sqlite3.wasm"].includes(name)) return route.abort();
        return route.fulfill({ contentType: name.endsWith("wasm") ? "application/wasm" : "text/javascript",
          body: await readFile(new URL(`../node_modules/@sqlite.org/sqlite-wasm/dist/${name}`, import.meta.url)) });
      }
      if (url.pathname.startsWith("/api/")) {
        if (url.pathname === "/api/account/me") return route.fulfill({ json: { authenticated: false, account: null } });
        return route.fulfill({ status: 501, json: { error: "Synthetic isolation" } });
      }
      if (req.method() === "GET" && (url.pathname.startsWith("/page/hover-test-") || url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/brand/"))) return route.continue();
      return route.abort();
    });
    const page = await context.newPage();
    page.on("pageerror", e => errors.push(e.message));
    await page.goto(origin + "/__test_seed");
    await page.evaluate(async schema => {
      const { default: init } = await import("/__test_assets/index.mjs");
      const sqlite = await init(), db = new sqlite.oo1.JsStorageDb("local");
      db.exec(schema);
      const now = "2026-10-28T00:00:00Z";
      db.exec({ sql: "INSERT INTO users (id,name,created_at,updated_at) VALUES (?,?,?,?)", bind: ["solo-user", "Synthetic", now, now] });
      for (let i = 0; i < 2; i++) db.exec({ sql: "INSERT INTO pages (id,owner_id,title,content_text,properties,position,depth,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
        bind: [`hover-test-${i}`, "solo-user", `Synthetic hover ${i}`, `<p>Synthetic ${i}</p>`, "{}", i, 0, now, now] });
      db.close();
      localStorage.setItem("zhinote.pagesync.enabled", "false");
      localStorage.setItem("zhinote.databasesync.enabled", "false");
    }, CREATE_TABLES_SQL);
    await page.goto(origin + "/page/hover-test-0");
    await page.locator(".tiptap[contenteditable]").waitFor();
    await page.waitForTimeout(1000);
    for (const count of [100, 8000]) {
      await page.evaluate(count => document.querySelector(".tiptap").editor.commands.setContent(
        Array.from({ length: count }, (_, i) => `<p>Line ${i}</p>`).join("")), count);
      await page.waitForTimeout(800);
      const measured = await page.evaluate(async count => {
        const dom = document.querySelector(".tiptap");
        const originalRect = Element.prototype.getBoundingClientRect, originalFrame = window.requestAnimationFrame;
        let rectCalls = 0; const frames = [], tasks = [];
        const observer = new PerformanceObserver(list => tasks.push(...list.getEntries().map(e => e.duration)));
        observer.observe({ type: "longtask" });
        Element.prototype.getBoundingClientRect = function(...args) { rectCalls++; return Reflect.apply(originalRect, this, args); };
        window.requestAnimationFrame = fn => originalFrame.call(window, time => {
          const start = performance.now(), before = rectCalls;
          fn(time);
          if (rectCalls > before) frames.push({ ms: performance.now() - start, rectCalls: rectCalls - before });
        });
        const frame = () => new Promise(resolve => originalFrame.call(window, resolve));
        try {
          for (let i = 0; i < 8; i++) {
            const target = dom.children[[0, Math.floor(count / 2), count - 1][i % 3]];
            for (let burst = 0; burst < 10; burst++) target.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
            await frame(); await frame();
          }
          return { count, frames, tasks };
        } finally {
          Element.prototype.getBoundingClientRect = originalRect;
          window.requestAnimationFrame = originalFrame;
          observer.disconnect();
        }
      }, count);
      assert.equal(measured.frames.length, 8);
      assert.ok(measured.frames.every(f => f.rectCalls <= 3), JSON.stringify(measured));
      assert.ok(measured.frames.every(f => f.ms < 30), JSON.stringify(measured));
      results.push(measured);
    }

    await page.evaluate(() => {
      const p = text => ({ type: "paragraph", content: [{ type: "text", text }] });
      document.querySelector(".tiptap").editor.commands.setContent({ type: "doc", content: [
        p("First block"), p("Second block"),
        { type: "bulletList", content: [{ type: "listItem", content: [p("Outer list"), { type: "bulletList", content: [{ type: "listItem", content: [p("Nested list")] }] }] }] },
        { type: "taskList", content: [{ type: "taskItem", attrs: { checked: false }, content: [p("Task item")] }] },
        { type: "blockquote", content: [p("Quote")] },
        { type: "columnLayout", content: [{ type: "columnBlock", content: [p("Column A")] }, { type: "columnBlock", content: [p("Column B")] }] },
        { type: "table", content: [{ type: "tableRow", content: [{ type: "tableCell", content: [p("Table cell")] }] }] },
        { type: "calloutBlock", content: [p("Callout text")] },
        { type: "horizontalRule" }, p("Last block"),
      ] });
    });
    await page.waitForTimeout(800);
    const targets = await page.evaluate(() => {
      const dom = document.querySelector(".tiptap"), editor = dom.editor, expected = [];
      editor.state.doc.descendants((node, pos, parent) => {
        if (!node.isBlock || node.type.name === "columnBlock" ||
          (!["listItem", "taskItem"].includes(node.type.name) && !["doc", "columnBlock"].includes(parent.type.name))) return;
        expected.push({ pos, type: node.type.name });
      });
      return expected;
    });
    for (const target of targets) {
      const expectedPos = await page.evaluate(pos => {
        const editor = document.querySelector(".tiptap").editor;
        const element = editor.view.nodeDOM(pos);
        const candidates = [];
        editor.state.doc.descendants((node, at, parent) => {
          if (!node.isBlock || node.type.name === "columnBlock" ||
            (!["listItem", "taskItem"].includes(node.type.name) && !["doc", "columnBlock"].includes(parent.type.name))) return;
          const candidate = editor.view.nodeDOM(at);
          if (candidate?.contains(element)) { const rect = candidate.getBoundingClientRect(); candidates.push({ pos: at, area: rect.width * rect.height }); }
        });
        element.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
        return candidates.sort((a, b) => a.area - b.area)[0].pos;
      }, target.pos);
      try {
        await page.waitForFunction(pos => document.querySelector(".zhinote-block-insert-handle")?.dataset.blockPos === String(pos), expectedPos, { timeout: 2000 });
      } catch (error) {
        const details = await page.evaluate(pos => {
          const editor = document.querySelector(".tiptap").editor;
          const target = editor.view.nodeDOM(pos), mapped = editor.view.posAtDOM(target, 0);
          const resolved = editor.state.doc.resolve(mapped);
          return { mapped, depth: resolved.depth, parent: resolved.parent.type.name,
            after: resolved.nodeAfter?.type.name, before: resolved.nodeBefore?.type.name,
            selected: document.querySelector(".zhinote-block-insert-handle")?.dataset.blockPos };
        }, target.pos);
        throw new Error(JSON.stringify({ target, expectedPos, details }), { cause: error });
      }
    }
    // Actual pointer input and insert menu, not only synthetic event dispatch.
    await page.locator(".tiptap > p").first().hover();
    await page.getByRole("button", { name: "打开块插入菜单", exact: true }).click();
    await page.locator(".zhinote-block-insert-menu-item").filter({ hasText: "一级章节标题" }).click();
    assert.equal(await page.locator(".tiptap > h1").count(), 1);
    // Drag a paragraph below another paragraph using the existing handle.
    await page.evaluate(() => document.querySelector(".tiptap").editor.commands.setContent("<p>Drag A</p><p>Drag B</p><p>Drag C</p>"));
    await page.locator(".tiptap > p").first().hover();
    await page.waitForFunction(() => document.querySelector(".zhinote-block-drag-handle")?.dataset.blockPos === "0");
    const handle = page.getByRole("button", { name: "拖拽块", exact: true });
    const source = await handle.boundingBox(), destination = await page.locator(".tiptap > p").last().boundingBox();
    await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
    await page.mouse.down();
    await page.mouse.move(destination.x + 30, destination.y + destination.height - 2, { steps: 5 });
    await page.mouse.up();
    await page.waitForFunction(() => document.querySelector(".tiptap > p:last-child")?.textContent === "Drag A");
    await page.screenshot({ path: new URL("editor-desktop.png", artifacts).pathname });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByTitle("收起侧边栏", { exact: true }).click();
    await page.locator(".tiptap > p").first().hover();
    assert.ok(await handle.isVisible());
    await page.screenshot({ path: new URL("editor-mobile.png", artifacts).pathname });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole("button", { name: /^打开侧边栏/ }).click();
    for (const id of [1, 0]) {
      await page.locator("aside").getByText(`Synthetic hover ${id}`, { exact: true }).click();
      await page.waitForURL(`**/page/hover-test-${id}`);
      await page.locator(".tiptap[contenteditable]").waitFor();
    }
    assert.deepEqual(errors, []);
    passed = true;
    console.log(JSON.stringify({ hover: results, nestedTargets: targets.length, insertion: true, drag: true, navigation: true, mobile: true }));
  } finally {
    await browser.close();
    await writeFile(new URL("editor.json", artifacts), JSON.stringify({ passed, syntheticOnly: true, realBusinessRequests: 0, results, errors }, null, 2));
  }
});
