// Synthetic fixtures only; execute the actual helpers without a user profile or network.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { test } from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const { Schema } = require("@tiptap/pm/model");
function load(file, extra = "", globals = {}, imports = {}) {
  const loaded = { exports: {} };
  const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8") + extra;
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  vm.runInNewContext(code, { module: loaded, exports: loaded.exports,
    require: name => imports[name] ?? require(name), ...globals }, { filename: file });
  return loaded.exports;
}

const session = load("src/lib/account/clientSession.ts");
const key = session.ACCOUNT_SESSION_LAST_AUTHENTICATED_STORAGE_KEY;
const account = { id: "synthetic-a", display_name: "Synthetic", email_hint: "s***@example.invalid", createdAt: "2026-10-28" };
const stored = (storedAt, changes = {}) => JSON.stringify({ storedAt, account: { ...account, ...changes } });
const change = (oldValue, newValue, eventKey = key) => session.isAccountSessionStorageChange({ key: eventKey, oldValue, newValue });

test("session renewal does not trigger cross-tab checks; profile and identity changes do", () => {
  for (let i = 0; i < 100; i++) assert.equal(change(stored(i), stored(i + 1)), false);
  for (const field of Object.keys(account)) assert.equal(change(stored(1), stored(2, { [field]: "different" })), true);
  assert.equal(change(stored(1), stored(1)), false);
  assert.equal(change("a", "b", "unrelated-key"), false);
});

test("login, logout, storage clear and malformed session changes remain observable", () => {
  assert.equal(change(null, stored(1)), true);
  assert.equal(change(stored(1), null), true);
  assert.equal(change(null, "1", session.ACCOUNT_SESSION_EXPLICIT_LOGOUT_STORAGE_KEY), true);
  assert.equal(change("1", null, session.ACCOUNT_SESSION_EXPLICIT_LOGOUT_STORAGE_KEY), true);
  assert.equal(change(null, null, null), true);
  for (const invalid of ["{", "null", "[]", '{}', '{"account":{"id":"synthetic-a"}}']) {
    assert.equal(change(stored(1), invalid), true);
  }
});

function sessionFixture() {
  const storage = () => {
    const values = new Map();
    return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  };
  const window = new EventTarget();
  window.localStorage = storage(); window.sessionStorage = storage();
  const pending = [];
  const api = load("src/lib/account/clientSession.ts", "", {
    window, Event, AbortController, setTimeout, clearTimeout,
    fetch: () => new Promise(resolve => pending.push(resolve)),
  });
  return { api, window, pending };
}

test("one identity event invalidates old requests once across all subscribers", async () => {
  const { api, window, pending } = sessionFixture();
  api.rememberLastAuthenticatedAccount(account);
  const oldRequest = api.fetchAccountSession({ force: true });
  const next = { ...account, id: "synthetic-b" };
  const event = { key, oldValue: stored(1), newValue: stored(2, next) };
  window.localStorage.setItem(key, event.newValue);
  assert.equal(api.handleAccountSessionStorageChange(event), true);
  const fresh = api.fetchAccountSession({ force: true });
  for (let i = 0; i < 10; i++) assert.equal(api.handleAccountSessionStorageChange(event), true);
  const joined = api.fetchAccountSession({ force: true });
  assert.equal(pending.length, 2);
  pending[1](Response.json({ authenticated: true, account: next }));
  assert.equal((await fresh).account.id, next.id);
  assert.equal((await joined).account.id, next.id);
  pending[0](Response.json({ authenticated: true, account }));
  assert.notEqual((await oldRequest).account?.id, account.id);
  assert.equal(api.getLastAuthenticatedAccount().id, next.id);
});

test("explicit cross-tab logout rejects an in-flight authenticated response", async () => {
  const { api, window, pending } = sessionFixture();
  api.rememberLastAuthenticatedAccount(account);
  const oldRequest = api.fetchAccountSession({ force: true });
  const event = { key: api.ACCOUNT_SESSION_EXPLICIT_LOGOUT_STORAGE_KEY, oldValue: null, newValue: JSON.stringify({ loggedOutAt: Date.now() }) };
  window.localStorage.setItem(event.key, event.newValue);
  api.handleAccountSessionStorageChange(event);
  const fresh = api.fetchAccountSession({ force: true });
  pending[1](Response.json({ authenticated: false, account: null }));
  assert.equal((await fresh).authenticated, false);
  pending[0](Response.json({ authenticated: true, account }));
  assert.equal((await oldRequest).authenticated, false);
  assert.equal(api.getLastAuthenticatedAccount(), null);
});

test("timestamp-only events preserve the session error retry backoff", async () => {
  const { api, pending } = sessionFixture();
  api.rememberLastAuthenticatedAccount(account);
  const request = api.fetchAccountSession();
  pending[0](Response.json({ retryable: true, reason: "session-unconfirmed" }, { status: 503, headers: { "Retry-After": "120" } }));
  await request;
  assert.equal(api.handleAccountSessionStorageChange({ key, oldValue: stored(1), newValue: stored(2) }), false);
  assert.equal((await api.fetchAccountSession()).status, "unconfirmed");
  assert.equal(pending.length, 1);
});

const schema = new Schema({ nodes: {
  doc: { content: "block*" }, text: {}, paragraph: { group: "block", content: "text*" },
  bulletList: { group: "block", content: "listItem+" }, listItem: { content: "paragraph block*" },
  taskList: { group: "block", content: "taskItem+" }, taskItem: { content: "paragraph block*" },
  blockquote: { group: "block", content: "block+" }, callout: { group: "block", content: "block+" },
  columns: { group: "block", content: "columnBlock+" }, columnBlock: { content: "block+" },
  table: { group: "block", content: "tableRow+" }, tableRow: { content: "tableCell+" }, tableCell: { content: "block+" },
  divider: { group: "block", atom: true },
} });
const n = (type, ...content) => schema.nodes[type].create(null, content);
const p = text => n("paragraph", schema.text(text));
class Element extends EventTarget {
  constructor(parent = null) { super(); this.parentElement = parent; this.reads = 0; this.pos = 0; this.area = 100; }
  contains(target) { for (let el = target; el; el = el.parentElement) if (el === this) return true; return false; }
  getBoundingClientRect() { this.reads++; return { left: 10, top: 100, width: 100, height: this.area / 100 }; }
}
function editorFixture(doc) {
  const root = new Element(), elements = new Map(), stack = [];
  doc.descendants((node, pos) => {
    if (!node.isBlock) return;
    while (stack.length && stack.at(-1).end <= pos) stack.pop();
    const element = new Element(stack.at(-1)?.element ?? root);
    element.pos = pos + (node.isLeaf ? 0 : 1);
    element.area = 10000 / (stack.length + 1);
    elements.set(pos, element);
    stack.push({ end: pos + node.nodeSize, element });
  });
  let lookups = 0;
  const editor = { state: { doc }, view: { dom: root,
    posAtDOM: target => target.pos,
    nodeDOM: pos => { lookups++; return elements.get(pos); },
  } };
  return { editor, elements, root, lookups: () => lookups };
}
const exportsForTest = "\nexport { getBlockMetaFromElement, getBlockMetaByPos, getDraggableBlocks, sameVisualBlock };";
const block = load("src/components/editor/BlockDragHandleLayer.tsx", exportsForTest, { Element, HTMLElement: Element });

test("target lookup matches existing eligible-block selection for nested blocks and atom wrappers", () => {
  const doc = n("doc", p("a"), n("bulletList", n("listItem", p("b"), n("bulletList", n("listItem", p("nested"))))),
    n("taskList", n("taskItem", p("task"))), n("blockquote", p("quote")), n("callout", p("callout")),
    n("columns", n("columnBlock", p("column")), n("columnBlock", n("divider"))),
    n("table", n("tableRow", n("tableCell", p("cell")))), n("divider"));
  const f = editorFixture(doc);
  const all = block.getDraggableBlocks(f.editor);
  for (const element of f.elements.values()) {
    const inline = new Element(element); inline.pos = element.pos;
    for (const target of [element, inline]) {
      const expected = all.filter(meta => meta.element.contains(target)).sort((a, b) => a.rect.height - b.rect.height)[0];
      assert.equal(block.getBlockMetaFromElement(f.editor, target)?.pos, expected?.pos);
    }
  }
  for (const expected of all) assert.equal(block.getBlockMetaByPos(f.editor, expected.pos)?.pos, expected.pos);
  assert.equal(block.getBlockMetaByPos(f.editor, -1), null);
  assert.equal(block.getBlockMetaByPos(f.editor, doc.content.size), null);
  assert.equal(block.getBlockMetaFromElement(f.editor, new Element()), null);
  assert.equal(block.getBlockMetaFromElement(f.editor, f.root), null);
});

test("lookup and insert-menu lookup do not traverse or measure unrelated blocks in an 8000-paragraph document", () => {
  const f = editorFixture(n("doc", ...Array.from({ length: 8000 }, (_, i) => p(`Line ${i}`))));
  f.editor.state.doc.descendants = () => assert.fail("Full-document traversal on hover");
  const last = [...f.elements.entries()].at(-1);
  assert.equal(block.getBlockMetaFromElement(f.editor, last[1]).pos, last[0]);
  assert.equal(block.getBlockMetaByPos(f.editor, last[0]).pos, last[0]);
  assert.equal(f.lookups(), 2);
  assert.equal([...f.elements.values()].reduce((sum, el) => sum + el.reads, 0), 2);
});

test("list drag targets remain type-compatible and ordinary block targets stay top-level", () => {
  const f = editorFixture(n("doc", n("bulletList", n("listItem", p("list"))), n("taskList", n("taskItem", p("task"))), p("plain")));
  const all = block.getDraggableBlocks(f.editor);
  const list = all.find(meta => meta.node.type.name === "listItem");
  const task = all.find(meta => meta.node.type.name === "taskItem");
  assert.equal(block.getBlockMetaFromElement(f.editor, list.element, list).pos, list.pos);
  assert.equal(block.getBlockMetaFromElement(f.editor, task.element, list), null);
  const ordinary = all.find(meta => meta.node.type.name === "paragraph");
  assert.equal(block.getBlockMetaFromElement(f.editor, list.element, ordinary).node.type.name, "bulletList");
});

test("hover work is coalesced, unchanged visual state retained, and leave/unmount cancels queued work", () => {
  const f = editorFixture(n("doc", p("first"), p("second")));
  const effects = [], frames = new Map(); let frameId = 0, updates = 0, visual = null;
  let refIndex = 0, stateIndex = 0;
  const surface = new Element();
  const react = { useCallback: fn => fn, useEffect: fn => effects.push(fn),
    useRef: value => ({ current: refIndex++ === 0 ? { closest: () => surface } : value }),
    useState: value => { const index = stateIndex++; return [value, next => {
      if (index !== 0) return;
      const result = typeof next === "function" ? next(visual) : next;
      if (visual !== result) updates++;
      visual = result;
    }]; },
  };
  const view = load("src/components/editor/BlockDragHandleLayer.tsx", exportsForTest, {
    Element, HTMLElement: Element, window: { innerWidth: 1440, innerHeight: 900,
      requestAnimationFrame: fn => { frames.set(++frameId, fn); return frameId; },
      cancelAnimationFrame: id => frames.delete(id),
    },
  }, { react });
  view.BlockDragHandleLayer({ editor: f.editor, editable: true });
  const cleanup = effects[0]();
  const move = element => {
    const event = new Event("mousemove"); Object.defineProperty(event, "target", { value: element });
    f.root.dispatchEvent(event);
  };
  const flush = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()); };
  const [first, second] = [...f.elements.values()];
  move(first); move(second); move(second);
  assert.equal(frames.size, 1); assert.equal(f.lookups(), 0);
  flush(); assert.equal(visual.pos, 7); assert.equal(updates, 1);
  move(second); flush(); assert.equal(updates, 1);
  f.root.dispatchEvent(new Event("mouseleave"));
  assert.ok(visual, "Crossing the editor gutter should preserve the handle");
  move(first); surface.dispatchEvent(new Event("mouseleave"));
  assert.equal(frames.size, 0); assert.equal(visual, null);
  move(first); cleanup(); assert.equal(frames.size, 0);
  move(second); assert.equal(frames.size, 0);
});
