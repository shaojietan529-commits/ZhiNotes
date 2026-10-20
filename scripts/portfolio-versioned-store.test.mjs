// Executes both real routes and their shared write boundary. Redis is an
// isolated atomic in-memory simulation, not production or physical A/B proof.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const nativeRequire = createRequire(import.meta.url);
const initial = { snapshot: { positions: [] }, tagMap: { A: "original", B: "delete me" },
  allocation: 100, maxNetPct: 12, lastEmailMessageId: null, updatedAt: "2026-09-25T04:00:00.000Z" };
const compiled = new Map();

function fixture(mode) {
  const values = new Map(), modules = new Map();
  const controls = { failWrite: false, beforeEval: null, accountId: "synthetic", reads: 0, notifications: [] };
  const config = { kv: { url: "https://synthetic.invalid", token: "synthetic" }, allowedEmails: new Set() };
  class Redis {
    async get(key) { return values.get(key) ?? null; }
    async eval(script, keys, args) {
      assert.equal(script, load("@/lib/portfolio/portfolioVersionedStore").PORTFOLIO_COMPARE_AND_SET);
      if (controls.beforeEval) { const run = controls.beforeEval; controls.beforeEval = null; await run(); }
      if (controls.failWrite) throw new Error("Synthetic write failure");
      const actual = values.get(keys[0]) ?? "";
      if (actual !== args[0] && actual !== args[1]) return [0, actual];
      values.set(keys[0], args[1]);
      if (keys.length > 1) values.set(keys[1], args[2]);
      return [1, args[1]];
    }
  }
  function load(name, parent = path.join(root, "src/entry.ts")) {
    if (name === "@/lib/sync/accountRealtimeServer") return {
      publishAccountChange: async (_kv, id, domain) => {
        assert.ok(values.has("zhinotes:portfolio:data:acct:test@example.invalid"), "notify only after persistence");
        controls.notifications.push({ id, domain });
      },
    };
    if (name === "@upstash/redis") return { Redis };
    if (name === "@/lib/account/server") return {
      accountIdentityMissingEnv: () => [], getAccountIdentityConfig: () => config,
      getSessionAccount: async () => ({ id: controls.accountId, email: "test@example.invalid" }),
      readSessionToken: () => "synthetic-session", normalizeEmail: (email) => email ?? "",
      kvGet: async (_, key) => { controls.reads++; return values.get(key) ?? null; },
      kvSet: async (_, key, value) => values.set(key, value),
    };
    if (!name.startsWith("@/") && !name.startsWith(".")) return nativeRequire(name);
    const file = name.startsWith("@/") ? path.join(root, "src", name.slice(2)) + ".ts"
      : path.resolve(path.dirname(parent), name) + ".ts";
    if (modules.has(file)) return modules.get(file).exports;
    const loaded = { exports: {} }; modules.set(file, loaded);
    if (!compiled.has(file)) compiled.set(file, ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText);
    vm.runInNewContext(compiled.get(file), {
      exports: loaded.exports, module: loaded, require: (dependency) => load(dependency, file),
      Buffer, Date, AbortController, AbortSignal, setTimeout, clearTimeout,
      process: { env: { KV_REST_API_URL: config.kv.url, KV_REST_API_TOKEN: config.kv.token } },
      fetch: async (url, init) => {
        const [, command, key] = new URL(url).pathname.split("/");
        if (command === "get") return Response.json({ result: values.get(key) ?? null });
        assert.equal(command, "set");
        values.set(key, init.body); return Response.json({ result: "OK" });
      },
    }, { filename: file });
    return loaded.exports;
  }
  const route = load(`@/app/api/portfolio/${mode === "account" ? "account-sync" : "sync"}/route`);
  const key = mode === "account" ? "zhinotes:portfolio:data:acct:test@example.invalid" : "zhinotes:portfolio:data:v1";
  const send = async (body) => {
    const res = await route.POST(new Request("https://synthetic.invalid/api/portfolio/sync", {
      method: "POST", body: JSON.stringify({ passcode: "synthetic-only", expectedAccountId: "synthetic", ...body }),
    }));
    return { status: res.status, body: await res.json() };
  };
  const pull = () => send({ action: "pull" });
  const push = (data, base = null, requestId = "test-request") => send({ action: "push", protocol: 2, requestId, base, data });
  return { values, key, controls, pull, push, send };
}

test("account: a cookie changed to another account rejects all old requests before reading or writing", async () => {
  const f = fixture("account");
  f.controls.accountId = "account-b";
  for (const action of ["push", "pull", "shares", "share-add", "share-remove"]) {
    const result = await f.send({ action, protocol: 2, requestId: "old-account-request", base: null,
      data: initial, email: "synthetic@example.invalid" });
    assert.equal(result.status, 409);
    assert.equal(result.body.code, "account-changed");
    for (const field of ["data", "members", "sharedWithMe", "accountId", "ack"]) assert.equal(result.body[field], undefined);
  }
  assert.equal(f.controls.reads, 0);
  assert.equal(f.values.size, 0, "even an empty B account cannot accept an unbased A upload");
});

test("account: only committed writes notify; rejected conflicts and failed writes stay quiet", async () => {
  const f = fixture("account");
  assert.equal((await f.push(initial)).status, 200);
  assert.deepEqual(f.controls.notifications, [{ id: "synthetic", domain: "portfolio" }]);
  assert.equal((await f.push({ ...initial, allocation: 200 })).status, 409);
  assert.equal(f.controls.notifications.length, 1);
  const { body: current } = await f.pull();
  f.controls.failWrite = true;
  assert.notEqual((await f.push({ ...initial, allocation: 300 }, current.version)).status, 200);
  assert.equal(f.controls.notifications.length, 1);
});

test("account: all reads and writes require identity intent; success echoes confirmed identity", async () => {
  const f = fixture("account");
  for (const expectedAccountId of [undefined, null, "", 1]) {
    for (const action of ["push", "pull", "shares", "share-add", "share-remove"]) {
      const result = await f.send({ action, expectedAccountId, data: initial });
      assert.equal(result.status, 428);
      assert.equal(result.body.ack, undefined);
    }
  }
  assert.equal(f.controls.reads, 0);
  assert.equal(f.values.size, 0);
  for (const result of [await f.push(initial), await f.pull(), await f.send({ action: "shares" })]) {
    assert.equal(result.status, 200);
    assert.equal(result.body.accountId, "synthetic");
  }
});

for (const mode of ["account", "passcode"]) {
  test(`${mode}: AI Exposure range validation, roundtrip, old-client protection and explicit clearing`, async () => {
    const f = fixture(mode);
    assert.equal((await f.push(initial)).status, 200, "old documents remain readable/writable before adoption");
    const base = (await f.pull()).body.version;
    for (const values of [null, [], { A: "1" }, { A: 1.1 }, { A: -1.1 }, { A: null }]) {
      assert.equal((await f.push({ ...initial, aiExposureMap: values }, base)).status, 400);
    }
    const updated = { ...initial, aiExposureMap: { A: 1, B: -1, C: 0, D: 0.1234 } };
    assert.equal((await f.push(updated, base)).status, 200);
    const read = (await f.pull()).body;
    assert.deepEqual(read.data.aiExposureMap, updated.aiExposureMap);
    assert.equal((await f.push({ ...initial, allocation: 200 }, read.version)).status, 428);
    assert.deepEqual((await f.pull()).body.data.aiExposureMap, updated.aiExposureMap);
    assert.equal((await f.push({ ...updated, aiExposureMap: {} }, read.version)).status, 200);
    assert.deepEqual((await f.pull()).body.data.aiExposureMap, {});
    assert.equal((await f.push(updated, read.version)).status, 409, "stale device cannot restore cleared coefficients");
  });

  test(`${mode}: durable versioned ACK and idempotent retry; no ACK on failed write`, async () => {
    const f = fixture(mode);
    const first = await f.push(initial);
    assert.equal(first.status, 200);
    assert.equal(first.body.ack.format_version, 2);
    assert.equal(first.body.ack.request_id, "test-request");
    assert.deepEqual(JSON.parse(f.values.get(f.key)), initial);
    assert.equal((await f.push(initial)).status, 200, "lost ACK replay is safe");
    f.controls.failWrite = true;
    const failed = await f.push({ ...initial, allocation: 200 }, first.body.version);
    assert.ok(failed.status >= 500);
    assert.equal(failed.body.ack, undefined);
    assert.equal(JSON.parse(f.values.get(f.key)).allocation, 100);
  });

  test(`${mode}: stale and unbased devices cannot overwrite; cloud tag deletion stays deleted`, async () => {
    const f = fixture(mode);
    const first = await f.push(initial);
    const edited = { ...initial, allocation: 200, tagMap: { A: "device A" } };
    assert.equal((await f.push(edited, first.body.version)).status, 200);
    for (const base of [first.body.version, null]) {
      const stale = await f.push({ ...initial, tagMap: { A: "device B", B: "stale tag" } }, base);
      assert.equal(stale.status, 409);
      assert.equal(stale.body.ack, undefined);
      assert.deepEqual(stale.body.data, edited);
    }
    assert.deepEqual((await f.pull()).body.data, edited);
  });

  test(`${mode}: compare-and-set rejects a competing write after the server read`, async () => {
    const f = fixture(mode);
    const first = await f.push(initial);
    f.controls.beforeEval = async () => {
      assert.equal((await f.push({ ...initial, allocation: 300 }, first.body.version, "winner")).status, 200);
    };
    const loser = await f.push({ ...initial, allocation: 200 }, first.body.version, "loser");
    assert.equal(loser.status, 409);
    assert.equal(loser.body.data.allocation, 300);
    assert.equal(JSON.parse(f.values.get(f.key)).allocation, 300);
  });

  test(`${mode}: old clients, foreign scope and corrupt cloud content cannot bypass protection`, async () => {
    const f = fixture(mode);
    assert.equal((await f.send({ action: "push", data: initial })).status, 428);
    const first = await f.push(initial);
    const foreign = await f.push({ ...initial, allocation: 200 }, { ...first.body.version, scope: "f".repeat(64) });
    assert.equal(foreign.status, 409);
    assert.equal(foreign.body.data, undefined, "wrong-scope write must not disclose the new account portfolio");
    f.values.set(f.key, "corrupt-json");
    assert.ok((await f.push(initial, first.body.version)).status >= 500);
    assert.equal(f.values.get(f.key), "corrupt-json");
  });

  test(`${mode}: payload bound is UTF-8 bytes, not character count`, async () => {
    const f = fixture(mode);
    assert.equal((await f.push({ ...initial, tagMap: { A: "测".repeat(360000) } })).status, 413);
    assert.equal(f.values.has(f.key), false);
  });
}
