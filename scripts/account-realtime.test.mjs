// Synthetic-only tests of the actual notification route, stream and client.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import { test } from "node:test";
import ts from "typescript";

const root = new URL("../", import.meta.url).pathname;
const require = createRequire(import.meta.url);
function fixture(overrides = {}) {
  const cache = new Map();
  const controls = { enabled: true, id: "synthetic-a", hasToken: true, authCalls: 0, requests: [], ...overrides };
  const kv = { url: "https://synthetic.invalid", token: "test-not-a-real-token" };
  const environment = {
    Buffer, Request, Response, Headers, AbortController, AbortSignal, ReadableStream,
    TextEncoder, TextDecoder, URL, setTimeout, clearTimeout, setInterval, clearInterval,
    process: { env: { ZHINOTES_REALTIME_SYNC_ENABLED: controls.enabled ? "true" : "false" } },
    fetch: async (...args) => {
      controls.requests.push(args);
      return controls.fetch ? controls.fetch(...args) : Response.json({ result: 0 });
    },
    ...overrides.globals,
  };
  function load(name, parent = path.join(root, "src/entry.ts")) {
    if (name === "@/lib/account/server") return {
      getAccountIdentityConfig: () => ({ kv }),
      readSessionToken: () => controls.hasToken ? "synthetic-token" : null,
      getSessionAccount: async () => { controls.authCalls++; return controls.id ? { id: controls.id } : null; },
    };
    if (!name.startsWith("@/") && !name.startsWith(".")) return require(name);
    const file = (name.startsWith("@/") ? path.join(root, "src", name.slice(2)) : path.resolve(path.dirname(parent), name)) + ".ts";
    if (cache.has(file)) return cache.get(file).exports;
    const loaded = { exports: {} }; cache.set(file, loaded);
    const code = ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(code, { ...environment, module: loaded, exports: loaded.exports, require: (dependency) => load(dependency, file) }, { filename: file });
    return loaded.exports;
  }
  return { controls, kv, load };
}

function sse(values) {
  return new ReadableStream({
    start(controller) {
      for (const value of values) controller.enqueue(new TextEncoder().encode(value));
      controller.close();
    },
  });
}

test("parser tolerates split chunks, CRLF, comments, and rejects oversized input", async () => {
  const { readSseData } = fixture().load("@/lib/sync/realtimeProtocol");
  const results = [];
  for await (const value of readSseData(sse([": ping\r\n", "\r\ndata: one\r", "\n\r\ndata: two\n", "data: three\n\n"]))) results.push(value);
  assert.deepEqual(results, ["one", "two\nthree"]);
  await assert.rejects(async () => { for await (const value of readSseData(sse(["x".repeat(20_000)]))) assert.fail(value); });
});

test("route is opt-in, session-bound and rejects cross-account/cross-origin requests before subscription", async () => {
  for (const [options, query, headers, status] of [
    [{ enabled: false }, "synthetic-a", {}, 204],
    [{ hasToken: false }, "synthetic-a", {}, 401],
    [{ id: null }, "synthetic-a", {}, 401],
    [{}, "synthetic-b", {}, 409],
    [{}, "synthetic-a", { origin: "https://another.invalid" }, 403],
    [{}, "synthetic-a", { "sec-fetch-site": "cross-site" }, 403],
  ]) {
    const f = fixture(options);
    const result = await f.load("@/app/api/account/sync-events/route").GET(
      new Request(`https://app.invalid/api/account/sync-events?accountId=${query}`, { headers })
    );
    assert.equal(result.status, status);
    assert.equal(f.controls.requests.length, 0);
    assert.match(result.headers.get("cache-control"), /no-store/);
  }
});

test("server filters upstream messages and never forwards raw channel, token, or payload", async () => {
  const f = fixture();
  const channel = f.load("@/lib/sync/accountRealtimeServer").accountRealtimeChannel("synthetic-a");
  f.controls.fetch = async () => new Response(sse([
    `data: subscribe,${channel},1\n\n`,
    `data: message,other-channel,portfolio\n\n`,
    `data: message,${channel},private text is invalid\n\n`,
    `data: message,${channel},portfolio\n\n`,
  ]), { headers: { "content-type": "text/event-stream" } });
  const response = await f.load("@/app/api/account/sync-events/route").GET(
    new Request("https://app.invalid/api/account/sync-events?accountId=synthetic-a")
  );
  const text = await response.text();
  assert.match(text, /"type":"ready"/);
  assert.match(text, /"domain":"portfolio"/);
  assert.doesNotMatch(text, /private text|other-channel|test-not-a-real-token|zhinote:changes/);
  assert.equal(f.controls.requests.length, 1);
  assert.match(f.controls.requests[0][0], /\/subscribe\//);
});

test("publication contains only domain and is best effort after a committed save", async () => {
  const f = fixture();
  const { publishAccountChange } = f.load("@/lib/sync/accountRealtimeServer");
  assert.equal(await publishAccountChange(f.kv, "synthetic-a", "portfolio"), true);
  assert.equal(JSON.parse(f.controls.requests[0][1].body)[2], "portfolio");
  f.controls.fetch = async () => { throw new Error("synthetic outage"); };
  assert.equal(await publishAccountChange(f.kv, "synthetic-a", "pages"), false);
  f.controls.fetch = async () => Response.json({ error: "synthetic rejection" });
  assert.equal(await publishAccountChange(f.kv, "synthetic-a", "pages"), false);
  const off = fixture({ enabled: false });
  assert.equal(await off.load("@/lib/sync/accountRealtimeServer").publishAccountChange(off.kv, "a", "pages"), false);
  assert.equal(off.controls.requests.length, 0);
});

test("cancelling a browser stream aborts its upstream subscription", async () => {
  const f = fixture();
  let upstreamSignal;
  f.controls.fetch = async (_url, init) => {
    upstreamSignal = init.signal;
    return new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(new Error("aborted"))));
  };
  const response = await f.load("@/app/api/account/sync-events/route").GET(
    new Request("https://app.invalid/api/account/sync-events?accountId=synthetic-a")
  );
  await response.body.cancel();
  assert.equal(upstreamSignal.aborted, true);
});

test("client reconnects with catch-up and ignores another account's events", async () => {
  const { listenForAccountChanges } = fixture().load("@/lib/sync/accountRealtimeClient");
  const controller = new AbortController(), changes = [], states = [];
  let requests = 0;
  await listenForAccountChanges({
    accountId: "synthetic-a", signal: controller.signal,
    onChange: (change) => changes.push(change.domain),
    onState: (state) => states.push(state),
    delay: async () => { if (requests === 2) controller.abort(); },
    fetcher: async () => {
      requests++;
      return new Response(sse([
        'data: {"type":"change","accountId":"synthetic-a","domain":"pages"}\n\n',
        'data: {"type":"ready","accountId":"synthetic-a"}\n\n',
        'data: {"type":"ready","accountId":"synthetic-a"}\n\n',
        'data: {"type":"change","accountId":"synthetic-b","domain":"portfolio"}\n\n',
        'data: {"type":"change","accountId":"synthetic-a","domain":"portfolio"}\n\n',
      ]), { headers: { "content-type": "text/event-stream" } });
    },
  });
  assert.deepEqual(changes, ["all", "portfolio", "all", "portfolio"]);
  assert.equal(states.filter((state) => state === "connected").length, 2);
});

test("client backs off disabled endpoints, terminates on auth mismatch, never declares connected", async () => {
  const { listenForAccountChanges } = fixture().load("@/lib/sync/accountRealtimeClient");
  for (const status of [204, 401, 409, 503]) {
    const controller = new AbortController(), states = [], delays = [];
    await listenForAccountChanges({
      accountId: "synthetic-a", signal: controller.signal,
      onChange: () => assert.fail("No unconfirmed notification"),
      onState: (state) => states.push(state),
      fetcher: async () => new Response(null, { status }),
      delay: async (ms) => { delays.push(ms); controller.abort(); },
    });
    assert.ok(!states.includes("connected"));
    if (status === 204) assert.ok(delays[0] >= 300_000);
    if (status === 401 || status === 409) assert.equal(delays.length, 0);
  }
});

for (const domain of ["page", "database"]) {
  test(`${domain}: cloud pulls refresh this tab; local edits do not echo; unsubscribe removes the listener`, () => {
    const window = new EventTarget();
    window.localStorage = { setItem() {} };
    const f = fixture({ globals: { window, Event, CustomEvent } });
    const bus = f.load(`@/lib/${domain === "page" ? "pages/page" : "database/database"}UpdateBus`);
    const received = [];
    const emit = bus[domain === "page" ? "emitPagesUpdated" : "emitDatabasesUpdated"];
    const subscribe = bus[domain === "page" ? "subscribePagesUpdated" : "subscribeDatabasesUpdated"];
    const unsubscribe = subscribe(message => received.push(message.reason));
    emit("local-refresh");
    emit("cloud-push");
    emit("cloud-pull");
    assert.deepEqual(received, ["cloud-pull"]);
    unsubscribe();
    emit("cloud-pull");
    assert.equal(received.length, 1);
  });
}
