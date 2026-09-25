// Real routes, validators and drain, with synthetic accounts and in-memory Redis.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const nativeRequire = createRequire(import.meta.url);
const compiled = new Map();
const favoriteKey = "page.favorites.v1";
const payload = (ids = ["synthetic-page"]) => ({
  setting_key: favoriteKey, client_pending_row_id: favoriteKey, favorite_page_ids: ids,
});

function loader(overrides = {}, globals = {}) {
  const modules = new Map();
  function load(name, parent = path.join(root, "src/entry.ts")) {
    if (name in overrides) return overrides[name];
    if (!name.startsWith("@/") && !name.startsWith(".")) return nativeRequire(name);
    const file = name.startsWith("@/")
      ? path.join(root, "src", name.slice(2)) + ".ts"
      : path.resolve(path.dirname(parent), name) + ".ts";
    const alias = "@/" + path.relative(path.join(root, "src"), file).replace(/\.ts$/, "");
    if (alias in overrides) return overrides[alias];
    if (modules.has(file)) return modules.get(file).exports;
    const loadedModule = { exports: {} };
    modules.set(file, loadedModule);
    if (!compiled.has(file)) compiled.set(file, ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText);
    vm.runInNewContext(compiled.get(file), {
      exports: loadedModule.exports, module: loadedModule, require: (dependency) => load(dependency, file),
      Request, Response, URL, TextEncoder, TextDecoder, AbortController, AbortSignal,
      Event, Date, setTimeout, clearTimeout, console, ...globals,
    }, { filename: file });
    return loadedModule.exports;
  }
  return load;
}

function serverFixture() {
  const hashes = new Map();
  const controls = { failWrite: false, failRead: false, sessionUnavailable: false };
  let writes = 0;
  class Redis {
    async hgetall(key) {
      if (controls.failRead) throw new Error("Synthetic read failure");
      return structuredClone(hashes.get(key) ?? {});
    }
    async hset(key, fields) {
      if (controls.failWrite) throw new Error("Synthetic write failure");
      hashes.set(key, { ...hashes.get(key), ...structuredClone(fields) });
      writes++;
      return Object.keys(fields).length;
    }
  }
  const load = loader({
    "@upstash/redis": { Redis },
    "@/lib/account/server": {
      getAccountIdentityConfig: () => ({ kv: { url: "https://synthetic.invalid", token: "synthetic" } }),
      readSessionToken: (request) => request.headers.get("x-test-account"),
      getSessionAccount: async (_config, id) => controls.sessionUnavailable ? null : ({ id }),
    },
    "@/lib/cloud/config": { getCloudReadiness: () => ({ enabled: false, allowWrites: false, missing: [] }) },
  });
  const route = load("@/app/api/workspaces/[workspaceId]/settings/route");
  async function request(method = "GET", body, account = "alpha", workspace = `account-${account}`, origin) {
    const headers = { "Content-Type": "application/json" };
    if (account) headers["x-test-account"] = account;
    if (origin) headers.origin = origin;
    return route[method](new Request(`https://synthetic.invalid/api/workspaces/${workspace}/settings`, {
      method, headers, ...(body ? { body: JSON.stringify(body) } : {}),
    }), { params: Promise.resolve({ workspaceId: workspace }) });
  }
  return { request, controls, hashes, load, writes: () => writes };
}

test("settings route: existing email account writes with ACK and reads back without Supabase login", async () => {
  const f = serverFixture();
  const response = await f.request("PATCH", payload());
  assert.equal(response.status, 200);
  const ack = await response.json();
  assert.equal(ack.workspace_id, "account-alpha");
  assert.equal(ack.summary.acknowledges_pending_row, favoriteKey);
  const read = await (await f.request()).json();
  assert.deepEqual(read.page_favorites.favorite_page_ids, ["synthetic-page"]);
  assert.equal(f.writes(), 1);
});

test("settings route: rejects unauthenticated, cross-account, cross-origin and invalid writes", async () => {
  const f = serverFixture();
  assert.equal((await f.request("PATCH", payload(), null, "account-alpha")).status, 401);
  assert.equal((await f.request("PATCH", payload(), "beta", "account-alpha")).status, 404);
  assert.equal((await f.request("PATCH", payload(), "alpha", "account-alpha", "https://other.invalid")).status, 403);
  assert.equal((await f.request("PATCH", { ...payload(), content_text: "not allowed" })).status, 400);
  assert.equal(f.writes(), 0);
  // Existing Supabase workspaces still honor the cloud configuration gate.
  assert.notEqual((await f.request("PATCH", payload(), "alpha", "00000000-0000-4000-8000-000000000001")).status, 200);
});

test("settings route: write failure produces no ACK; transient session failure keeps login", async () => {
  const f = serverFixture();
  f.controls.failWrite = true;
  const response = await f.request("PATCH", payload());
  assert.equal(response.status, 500);
  assert.equal((await response.json()).summary, undefined);
  f.controls.sessionUnavailable = true;
  const retry = await f.request();
  assert.equal(retry.status, 503);
  assert.equal((await retry.json()).keeps_session_cookie, true);
  assert.equal(retry.headers.get("set-cookie"), null);
});

test("settings store: concurrent independent fields survive and accounts stay isolated", async () => {
  const f = serverFixture();
  const { openAccountSettings } = f.load("@/lib/account/settingsStore");
  const req = new Request("https://synthetic.invalid", { headers: { "x-test-account": "alpha" } });
  const a = await openAccountSettings(req, "account-alpha");
  const b = await openAccountSettings(req, "account-alpha");
  assert.ok(a.ok && b.ok);
  await a.save({ page_favorites: { favorite_page_ids: ["one"] } });
  await b.save({ calendar_view_state: { daily_view_month: "2026-09" } });
  const merged = await openAccountSettings(req, "account-alpha");
  assert.equal(merged.workspace.settings.page_favorites.favorite_page_ids[0], "one");
  assert.equal(merged.workspace.settings.calendar_view_state.daily_view_month, "2026-09");
  await assert.rejects(() => a.save(JSON.parse('{"__proto__":{"polluted":true}}')), /Invalid setting path/);
  assert.equal((await (await f.request("GET", undefined, "beta")).json()).page_favorites.setting_found, false);
});

function clientFixture(server, options = {}) {
  let pending = options.empty ? [] : [{ id: 1, tableName: "workspace_settings", rowId: favoriteKey, status: "pending", synced: 0, attemptCount: 0 }];
  let settings = options.empty ? [] : [{ key: favoriteKey, valueJson: JSON.stringify({ favorite_page_ids: ["from-a"] }) }];
  const marked = [], events = [];
  const queries = {
    getPendingWorkspaceSettingSyncLogEntries: async () => pending.map((row) => ({ ...row })),
    getPendingAccountModuleSettingSyncLogEntries: async () => [],
    listWorkspaceSettings: async () => settings.map((row) => ({ ...row })),
    listAccountSettings: async () => [], listModuleSettings: async () => [],
    markWorkspaceSettingSyncLogEntriesAttempted: async () => 0,
    markWorkspaceSettingSyncLogEntriesFailed: async () => 0,
    markWorkspaceSettingSyncLogEntriesSynced: async (keys, max) => {
      marked.push(max);
      const before = pending.length;
      pending = pending.filter((row) => row.id > max || !keys.includes(row.rowId));
      return before - pending.length;
    },
    applyRemoteWorkspaceSettings: async ({ settings: rows }) => {
      assert.equal(pending.length, 0, "never replace unsynced input");
      settings = rows.map((row) => ({ key: row.key, valueJson: JSON.stringify(row.value) }));
    },
    applyRemoteAccountModuleSettings: async () => {},
  };
  const load = loader({
    "@/lib/db/local/queries": queries,
    "@/lib/account/clientSession": { fetchAccountSession: async () => ({ status: "ok", authenticated: true, stale: !!options.stale, account: { id: "alpha" } }) },
    "@/lib/cloud/clientSession": { ensureFreshCloudSession: async () => { throw new Error("Unnecessary second login"); } },
    "@/lib/sync/workspaceIdentity": { readLocalWorkspaceIdentity: () => null },
  }, {
    window: { setTimeout, clearTimeout, dispatchEvent: (event) => events.push(event.type) },
    fetch: async (_url, init) => {
      const method = init.method ?? "GET";
      const response = await server.request(method, init.body && JSON.parse(init.body));
      if (method === "PATCH" && options.editDuringRequest) {
        pending.push({ ...pending[0], id: 2 });
        settings = [{ key: favoriteKey, valueJson: JSON.stringify({ favorite_page_ids: ["newer-input"] }) }];
      }
      return method === "PATCH" && options.noAck ? Response.json({}) : response;
    },
  });
  return { sync: load("@/lib/sync/settingsCloudDrain").drainPendingSettingsCloudSync,
    pending: () => pending, settings: () => settings, marked, events };
}

test("settings drain: synthetic A uploads; clean B pulls with no local pending; repeat pull is quiet", async () => {
  const server = serverFixture();
  const a = clientFixture(server);
  assert.equal((await a.sync()).synced, 1);
  assert.equal(a.pending().length, 0);
  const b = clientFixture(server, { empty: true });
  assert.equal((await b.sync()).status, "ok");
  assert.deepEqual(JSON.parse(b.settings()[0].valueJson), { favorite_page_ids: ["from-a"] });
  assert.equal(b.events.length, 1);
  await b.sync();
  assert.equal(b.events.length, 1);
  assert.equal(server.writes(), 1);
});

test("settings drain: edits arriving during upload survive an older ACK and pull", async () => {
  const f = clientFixture(serverFixture(), { editDuringRequest: true });
  await f.sync();
  assert.deepEqual(f.marked, [1]);
  assert.equal(f.pending()[0].id, 2);
  assert.deepEqual(JSON.parse(f.settings()[0].valueJson).favorite_page_ids, ["newer-input"]);
});

for (const option of ["noAck", "stale"]) {
  test(`settings drain: ${option} never clears pending`, async () => {
    const server = serverFixture();
    const f = clientFixture(server, { [option]: true });
    await f.sync();
    assert.equal(f.pending().length, 1);
    assert.equal(f.marked.length, 0);
    if (option === "stale") assert.equal(server.writes(), 0);
  });
}

test("settings SQL: only log entries included in the acknowledged snapshot are cleared", async () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(`CREATE TABLE sync_log (id INTEGER PRIMARY KEY, table_name TEXT, row_id TEXT,
      synced INTEGER, status TEXT, last_attempt_at TEXT, next_retry_at TEXT, last_error TEXT)`);
    const adapter = { query: (sql, params = []) => db.prepare(sql).all(...params),
      run: (sql, params = []) => db.prepare(sql).run(...params) };
    const load = loader({ "@/lib/db/local/client": { getDb: async () => adapter } });
    const queries = load("@/lib/db/local/queries");
    for (const [table, method] of [
      ["workspace_settings", "markWorkspaceSettingSyncLogEntriesSynced"],
      ["account_settings", "markAccountSettingSyncLogEntriesSynced"],
      ["module_settings", "markModuleSettingSyncLogEntriesSynced"],
    ]) {
      db.exec("DELETE FROM sync_log");
      for (const id of [1, 2]) db.prepare("INSERT INTO sync_log VALUES (?, ?, 'setting', 0, 'pending', NULL, NULL, NULL)").run(id, table);
      assert.equal(await queries[method](["setting"], 1), 1);
      assert.equal(db.prepare("SELECT synced FROM sync_log WHERE id = 2").get().synced, 0);
    }
  } finally { db.close(); }
});
