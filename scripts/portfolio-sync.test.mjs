// Real portfolio clients and queue; all content, accounts and network are synthetic.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { webcrypto } from "node:crypto";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const nativeRequire = createRequire(import.meta.url);
const compiled = new Map();
const now = "2026-09-25T04:00:00.000Z";
class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : [now])); }
  static now() { return Date.parse(now); }
}

function fixture(storage = new Map()) {
  const requests = [];
  const controls = { failContentRead: false, failReadPrefix: null, gate: "ready", failWritePrefix: null, failWriteIf: null, beforeGate: null };
  // Existing single-thread behavior cases grant immediately. Contention is
  // exercised separately in real browser tabs using the native lock manager.
  const locks = { request: (_name, _options, callback) => Promise.resolve().then(callback) };
  const writes = [], notifications = [];
  const tabStorage = new Map();
  const sessionStorage = {
    getItem: (key) => tabStorage.get(key) ?? null,
    setItem: (key, value) => tabStorage.set(key, String(value)),
    removeItem: (key) => tabStorage.delete(key),
  };
  const modules = new Map();
  let persistenceFailure;
  const localStorage = {
    get length() { return storage.size; },
    key: (index) => [...storage.keys()][index] ?? null,
    getItem(key) {
      if (controls.failReadPrefix && key.startsWith(controls.failReadPrefix)) throw new Error("Synthetic read error");
      if (controls.failContentRead && key.startsWith("zhinote.portfolio.") && !key.includes("sync.")) throw new Error("Synthetic read error");
      return storage.get(key) ?? null;
    },
    setItem: (key, value) => {
      if (controls.failWriteIf?.(key, value)) throw new Error("Synthetic full storage");
      if (controls.failWritePrefix && key.startsWith(controls.failWritePrefix)) throw new Error("Synthetic full storage");
      storage.set(key, String(value));
      writes.push({ key, value: String(value) });
    },
    removeItem: (key) => storage.delete(key),
  };
  // Deterministic in-memory transaction adapter for queue/client unit tests.
  // Native IndexedDB isolation/abort/upgrade behavior is covered by browser tests.
  const recordFor = (scope) => {
    const prefix = `zhinote.portfolio.scoped.v1.${encodeURIComponent(scope)}.`;
    const state = localStorage.getItem(`${prefix}state.v2`);
    if (state !== null) JSON.parse(state);
    const values = Object.fromEntries([
      "snapshot.v1", "tags.v1", "allocation.v1", "maxNetPct.v1", "lastEmailMessage.v1", "updatedAt.v1",
      "sync.status.v1", "sync.base.v2.account", "sync.base.v2.passcode",
      "sync.resolution.v1.account", "sync.resolution.v1.passcode",
      "sync.conflict.v1.account", "sync.conflict.v1.passcode", "legacy-reviewed.v1",
    ].map((key) => [`zhinote.portfolio.${key}`, null]));
    for (const key of storage.keys()) {
      if (key.startsWith(prefix) && !key.endsWith("state.v2")) {
        values[`zhinote.portfolio.${key.slice(prefix.length)}`] = localStorage.getItem(key);
      }
    }
    return { format: 1, scope, revision: 1, values, legacySource: {} };
  };
  const database = {
    PORTFOLIO_LOCAL_VALUE_KEYS: Object.keys(recordFor("local").values),
    cachedPortfolioRecord: recordFor,
    readPortfolioRecord: async (scope) => recordFor(scope),
    changePortfolioRecord: (scope, change) => {
      try {
        const before = recordFor(scope);
        const next = change(before);
        if (next.record !== before) {
          const prefix = `zhinote.portfolio.scoped.v1.${encodeURIComponent(scope)}.`;
          const raw = JSON.stringify({ format: 2, values: next.record.values });
          for (const [name, value] of Object.entries(next.record.values)) {
            const key = `${prefix}${name.slice("zhinote.portfolio.".length)}`;
            if (value !== before.values[name] && controls.failWritePrefix && key.startsWith(controls.failWritePrefix)) throw new Error("Synthetic full storage");
          }
          localStorage.setItem(`${prefix}state.v2`, raw);
          for (const [name, value] of Object.entries(next.record.values)) {
            const key = `${prefix}${name.slice("zhinote.portfolio.".length)}`;
            if (value === null) storage.delete(key); else storage.set(key, value);
          }
        }
        return Promise.resolve(next.result);
      } catch (error) { persistenceFailure = error; return Promise.reject(error); }
    },
  };
  function load(name, parent = path.join(root, "src/entry.ts")) {
    if (name.endsWith("/portfolioLocalDatabase")) return database;
    if (name === "@/lib/account/accountCloudSyncGate") {
      return { checkAccountCloudSyncGate: async () => {
        if (controls.beforeGate) await controls.beforeGate();
        return { status: controls.gate };
      } };
    }
    if (!name.startsWith("@/") && !name.startsWith(".")) return nativeRequire(name);
    const file = name.startsWith("@/") ? path.join(root, "src", name.slice(2)) + ".ts"
      : path.resolve(path.dirname(parent), name) + ".ts";
    if (modules.has(file)) return modules.get(file).exports;
    const loadedModule = { exports: {} };
    modules.set(file, loadedModule);
    if (!compiled.has(file)) compiled.set(file, ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText);
    vm.runInNewContext(compiled.get(file), {
      exports: loadedModule.exports, module: loadedModule, require: (dependency) => load(dependency, file),
      Date: FixedDate, crypto: webcrypto, AbortController, setTimeout, clearTimeout, Event, navigator: { locks },
      CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
      window: { localStorage, sessionStorage, dispatchEvent: (event) => notifications.push(event.type) },
      fetch: async (url, init) => new Promise((resolve, reject) => {
        const body = init.body ? JSON.parse(init.body) : {};
        requests.push({ url, body, reject, reply: (options = {}) => resolve(Response.json({
          ...(options.noAccountId ? {} : { accountId: options.accountId ?? body.expectedAccountId }),
          ...(options.json ?? {
          tagMap: options.tags ?? body.data?.tagMap,
          ...(options.noAck ? {} : { ack: {
            format: "zhinote-portfolio-cloud-ack-receipt", format_version: 2,
            ack_status: "acknowledged", accepted: true,
            request_id: options.requestId ?? body.requestId,
            scope: options.scope ?? "a".repeat(64), revision: options.revision ?? "b".repeat(64),
            updated_at: options.updatedAt ?? body.data?.updatedAt,
          } }),
          }),
        }, { status: options.status ?? 200 })) });
      }),
    }, { filename: file });
    return loadedModule.exports;
  }
  const scope = load("@/lib/portfolio/portfolioStorageScope");
  const mutations = new Set(["batchPortfolioStorage", "commitPortfolioLocalEdit", "markPortfolioCloudSyncPending",
    "markPortfolioCloudSyncAttempt", "markPortfolioCloudSyncAck", "markPortfolioCloudSyncFailure", "markPortfolioCloudSyncOff",
    "rememberPortfolioCloudBase", "acceptPortfolioCloudVersion", "retainPortfolioConflict", "clearActivePortfolioConflict",
    "stagePortfolioConflictResolution", "writePortfolioConflictResolution", "finishPortfolioConflictResolution", "saveLocalPortfolioData"]);
  let mutationDepth = 0;
  const mutate = (fn) => {
    if (mutationDepth) return fn();
    persistenceFailure = undefined;
    let result, failure;
    let granted = false;
    const request = locks.request;
    locks.request = (_name, _options, callback) => Promise.resolve(callback());
    // Only the fixture's setup/low-level synchronous helpers run this way.
    // Async clients/drains use the real helper with ordinary deferred grants.
    const pending = scope.withPortfolioStorageLock(scope.getPortfolioStorageScope(), () => {
      granted = true;
      mutationDepth++;
      try { result = fn(); } catch (error) { failure = error; throw error; }
      finally { mutationDepth--; }
    });
    locks.request = request;
    pending.catch(() => {});
    assert.ok(granted, "fixture mutations must receive their synchronous setup lock");
    if (failure || persistenceFailure) throw failure ?? persistenceFailure;
    return result;
  };
  const expose = (module) => Object.fromEntries(Object.entries(module).map(([name, value]) => {
    if (name === "portfolioStorage") return [name, (...args) => {
      const storage = value(...args);
      return { ...storage, setItem: (...args) => mutate(() => storage.setItem(...args)),
        removeItem: (...args) => mutate(() => storage.removeItem(...args)) };
    }];
    return [name, typeof value === "function" && (mutations.has(name) || /^save(Snapshot|TagMap|Allocation|MaxNetPct|DataUpdatedAt|LastEmailMessageId)$/.test(name))
      ? (...args) => mutate(() => value(...args)) : value];
  }));
  const store = expose(load("@/lib/portfolio/portfolioStore"));
  const queue = expose(load("@/lib/portfolio/portfolioSyncStatus"));
  const session = load("@/lib/account/clientSession");
  const setAccount = (id) => session.rememberLastAuthenticatedAccount({
    id, email_hint: "synthetic@example.invalid", display_name: "Synthetic", createdAt: now,
  });
  if (!storage.has(session.ACCOUNT_SESSION_LAST_AUTHENTICATED_STORAGE_KEY) &&
      !storage.has(session.ACCOUNT_SESSION_EXPLICIT_LOGOUT_STORAGE_KEY)) setAccount("synthetic-a");
  const seed = (mode = "account") => {
    if (mode === "passcode") session.clearAccountSessionCache({ clearLastAuthenticated: true });
    store.saveSnapshot({ importedAt: now, fileName: "synthetic.xlsx", positions: [] });
    store.saveTagMap({ SAMPLE: "original" });
    store.saveAllocation(100);
    store.saveMaxNetPct(12);
    store.saveDataUpdatedAt(now);
    if (mode === "passcode") load("@/lib/portfolio/cloudSync").saveSyncPasscode("synthetic-only");
    queue.markPortfolioCloudSyncPending(mode);
  };
  const waitForRequest = async () => {
    for (let i = 0; i < 100 && !requests.length; i++) await Promise.resolve();
    assert.ok(requests.length);
    return requests.at(-1);
  };
  return { store, queue, seed, waitForRequest, requests, controls, storage, locks, load: (name) => expose(load(name)), rawLoad: load, session, setAccount,
    key: scope.portfolioStorageKey, scope: scope.getPortfolioStorageScope, persistence: expose(scope), writes, notifications };
}

test("storage lock boundary: unlocked mutations fail; a queued grant rechecks account identity", async () => {
  const f = fixture(); f.seed();
  const rawQueue = f.rawLoad("@/lib/portfolio/portfolioSyncStatus");
  const rawScope = f.rawLoad("@/lib/portfolio/portfolioStorageScope");
  const before = JSON.stringify([...f.storage]);
  assert.throws(() => rawQueue.commitPortfolioLocalEdit("account", () => ({ allocation: 999 })), /保存锁/);
  assert.equal(JSON.stringify([...f.storage]), before);
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  f.locks.request = async (_name, _options, callback) => { await gate; return callback(); };
  let called = false;
  const pending = rawScope.withPortfolioStorageLock(f.scope(), () => { called = true; });
  f.setAccount("synthetic-b");
  release();
  await assert.rejects(pending, /账号/);
  assert.equal(called, false);
  f.locks.request = undefined;
  await rawScope.withPortfolioStorageLock(f.scope(), () => { called = true; });
  assert.equal(called, true, "native database transactions do not depend on Web Locks support");
});

test("disabling sync retains pending content and invalidates an in-flight receipt until re-enabled", async () => {
  const f = fixture(); f.seed("passcode");
  const content = f.store.readPortfolioLocalFingerprint();
  const revision = f.queue.getPendingPortfolioCloudSyncStatus().pendingRevision;
  const upload = f.queue.drainPendingPortfolioCloudSync();
  const request = await f.waitForRequest();
  f.queue.markPortfolioCloudSyncOff();
  f.load("@/lib/portfolio/cloudSync").clearSyncPasscode();
  let status = f.queue.getPendingPortfolioCloudSyncStatus();
  assert.equal(status.mode, null);
  assert.equal(status.queueState, "off");
  assert.equal(status.pending, 1);
  assert.equal(status.pendingRevision, revision);
  assert.equal(status.inFlight, 0);
  assert.equal(status.attemptId, null);
  request.reply();
  assert.equal((await upload).status, "deferred");
  assert.equal(f.queue.hasUnsyncedPortfolioChanges(), true);
  assert.equal(f.store.readPortfolioLocalFingerprint(), content);
  assert.equal((await f.queue.drainPendingPortfolioCloudSync()).status, "disabled");
  assert.equal(f.requests.length, 1);
  f.load("@/lib/portfolio/cloudSync").saveSyncPasscode("synthetic-only");
  f.queue.markPortfolioCloudSyncPending("passcode", "enable-passcode-sync");
  const retry = f.queue.drainPendingPortfolioCloudSync();
  for (let i = 0; i < 100 && f.requests.length < 2; i++) await Promise.resolve();
  assert.equal(f.requests.length, 2);
  f.requests[1].reply();
  assert.equal((await retry).status, "ok");
  status = f.queue.getPendingPortfolioCloudSyncStatus();
  assert.equal(status.pending, 0);
  assert.equal(f.store.readPortfolioLocalFingerprint(), content);
});

test("portfolio: exact ACK clears only the uploaded revision without applying unsolicited labels", async () => {
  const f = fixture(); f.seed();
  const uploading = f.queue.drainPendingPortfolioCloudSync();
  (await f.waitForRequest()).reply({ tags: { SAMPLE: "original", EXTRA: "server" } });
  assert.equal((await uploading).status, "ok");
  assert.equal(f.queue.hasUnsyncedPortfolioChanges(), false);
  assert.equal(f.store.loadTagMap().EXTRA, undefined);
  assert.equal(f.queue.getPendingPortfolioCloudSyncStatus().queueState, "synced");
  const savedStatus = f.storage.get(f.key("zhinote.portfolio.sync.status.v1"));
  assert.ok(!savedStatus.includes("SAMPLE") && !savedStatus.includes("synthetic.xlsx"));
});

for (const [field, edit] of [
  ["tags", (s) => s.saveTagMap({ SAMPLE: "new input" })],
  ["allocation", (s) => s.saveAllocation(200)],
  ["max net", (s) => s.saveMaxNetPct(20)],
  ["snapshot", (s) => s.saveSnapshot({ importedAt: now, fileName: "new-synthetic.xlsx", positions: [] })],
  ["email marker", (s) => s.saveLastEmailMessageId("synthetic-message")],
]) {
  test(`portfolio: ${field} edited at the same timestamp survives a late ACK`, async () => {
    const f = fixture(); f.seed();
    const uploading = f.queue.drainPendingPortfolioCloudSync();
    const request = await f.waitForRequest();
    edit(f.store);
    f.queue.markPortfolioCloudSyncPending("account");
    const expected = f.store.readPortfolioLocalFingerprint();
    request.reply({ tags: { SAMPLE: "stale result" } });
    assert.equal((await uploading).status, "deferred");
    assert.equal(f.store.readPortfolioLocalFingerprint(), expected);
    assert.equal(f.queue.getPendingPortfolioCloudSyncStatus().pending, 1);
    const retry = f.queue.drainPendingPortfolioCloudSync();
    await new Promise(setImmediate);
    f.requests.at(-1).reply();
    assert.equal((await retry).status, "ok");
    assert.equal(f.queue.hasUnsyncedPortfolioChanges(), false);
  });
}

test("portfolio: even an edit made before its React effect runs blocks an old ACK", async () => {
  const f = fixture(); f.seed();
  const uploading = f.queue.drainPendingPortfolioCloudSync();
  const request = await f.waitForRequest();
  f.store.saveTagMap({ SAMPLE: "not yet queued by UI" });
  request.reply();
  assert.equal((await uploading).status, "deferred");
  assert.equal(f.store.loadTagMap().SAMPLE, "not yet queued by UI");
  assert.equal(f.queue.getPendingPortfolioCloudSyncStatus().pending, 1);
});

for (const lateFailure of [false, true]) {
  test(`portfolio: two tabs, newer ACK then old ${lateFailure ? "failure" : "ACK"} cannot regress data/status`, async () => {
    const storage = new Map();
    const a = fixture(storage), b = fixture(storage); a.seed();
    const first = a.queue.drainPendingPortfolioCloudSync();
    const oldRequest = await a.waitForRequest();
    b.store.saveTagMap({ SAMPLE: "second tab" });
    b.queue.markPortfolioCloudSyncPending("account");
    const second = b.queue.drainPendingPortfolioCloudSync();
    (await b.waitForRequest()).reply();
    assert.equal((await second).status, "ok");
    const statusAfterNewAck = storage.get(a.key("zhinote.portfolio.sync.status.v1"));
    if (lateFailure) oldRequest.reject(new Error("Synthetic network failure"));
    else oldRequest.reply({ tags: { SAMPLE: "stale result" } });
    assert.equal((await first).status, "deferred");
    assert.equal(a.store.loadTagMap().SAMPLE, "second tab");
    assert.equal(storage.get(a.key("zhinote.portfolio.sync.status.v1")), statusAfterNewAck);
  });
}

test("portfolio: auto push and manual drain share one request, then retry latest contents", async () => {
  const f = fixture(); f.seed();
  const first = f.queue.drainPendingPortfolioCloudSync();
  const duplicate = f.queue.drainPendingPortfolioCloudSync({ mode: "account" });
  assert.equal(first, duplicate);
  const request = await f.waitForRequest();
  assert.equal(f.requests.length, 1);
  f.store.saveAllocation(300);
  f.queue.markPortfolioCloudSyncPending("account");
  request.reply();
  await first;
  const next = f.queue.drainPendingPortfolioCloudSync();
  await new Promise(setImmediate);
  assert.equal(f.requests[1].body.data.allocation, 300);
  assert.equal(f.requests[1].body.data.updatedAt, now, "retry does not invent a newer edit timestamp");
  f.requests[1].reply();
  assert.equal((await next).status, "ok");
});

test("portfolio: local read failure after cloud ACK retains retryable work", async () => {
  const f = fixture(); f.seed();
  const uploading = f.queue.drainPendingPortfolioCloudSync();
  const request = await f.waitForRequest();
  f.controls.failContentRead = true;
  request.reply();
  assert.equal((await uploading).status, "manual_review");
  assert.equal(f.queue.getPendingPortfolioCloudSyncStatus().lastAckAt, null);
  assert.equal(f.queue.hasUnsyncedPortfolioChanges(), true);
});

for (const mode of ["account", "passcode"]) {
  for (const ackIssue of ["missing", "wrong-version"]) {
    test(`portfolio ${mode}: ${ackIssue} ACK cannot clear queued data`, async () => {
      const f = fixture(); f.seed(mode);
      const uploading = f.queue.drainPendingPortfolioCloudSync();
      (await f.waitForRequest()).reply(ackIssue === "missing" ? { noAck: true } : { updatedAt: "different-version" });
      assert.equal((await uploading).status, "failed");
      assert.equal(f.queue.getPendingPortfolioCloudSyncStatus().lastAckAt, null);
      assert.equal(f.queue.hasUnsyncedPortfolioChanges(), true);
      assert.equal(f.store.loadTagMap().SAMPLE, "original");
    });
  }
}

test("portfolio: transient account confirmation error preserves local pending and does not send", async () => {
  const f = fixture(); f.seed();
  f.controls.gate = "unconfirmed";
  await f.queue.drainPendingPortfolioCloudSync();
  assert.equal(f.requests.length, 0);
  assert.equal(f.queue.hasUnsyncedPortfolioChanges(), true);
  assert.equal(f.store.loadTagMap().SAMPLE, "original");
});

test("account boundary: request carries the intended identity and rejects an unbound response", async () => {
  for (const invalidReply of [{ noAccountId: true }, { accountId: "synthetic-b" }]) {
    const f = fixture(); f.seed();
    const uploading = f.queue.drainPendingPortfolioCloudSync();
    const request = await f.waitForRequest();
    assert.equal(request.body.expectedAccountId, "synthetic-a");
    request.reply(invalidReply);
    assert.equal((await uploading).status, "failed");
    assert.equal(f.queue.hasUnsyncedPortfolioChanges("account:synthetic-a"), true);
    assert.equal(f.load("@/lib/portfolio/portfolioSyncRevision").readPortfolioCloudBase("account"), null);
  }
});

for (const response of ["ack", "conflict", "network-error"]) {
  test(`account boundary: ${response} for A cannot mutate B after a same-tab account switch`, async () => {
    const f = fixture(); f.seed();
    const uploading = f.queue.drainPendingPortfolioCloudSync();
    const request = await f.waitForRequest();
    f.setAccount("synthetic-b");
    // B may have the same local values and pending revision. Identity must
    // still invalidate A's attempt, independently of content comparisons.
    const protectedState = new Map(f.storage);
    if (response === "network-error") request.reject(new Error("Synthetic offline"));
    else if (response === "conflict") request.reply({ status: 409, json: {
      code: "portfolio-conflict", data: { allocation: 999 }, version: { scope: "a".repeat(64), revision: "c".repeat(64) },
    } });
    else request.reply();
    assert.equal((await uploading).status, "deferred");
    assert.deepEqual(f.storage, protectedState, "no new baseline, conflict, status or content for another identity");
    assert.equal(f.queue.hasUnsyncedPortfolioChanges("account:synthetic-a"), true);
    assert.equal(f.queue.hasUnsyncedPortfolioChanges(), false, "A's queue is not B's queue");
  });
}

test("account boundary: session confirmation that changes identity cannot send an old payload", async () => {
  const f = fixture(); f.seed();
  f.controls.beforeGate = () => f.setAccount("synthetic-b");
  const result = await f.queue.drainPendingPortfolioCloudSync();
  assert.equal(result.status, "deferred");
  assert.equal(f.requests.length, 0);
  assert.equal(f.store.loadTagMap("account:synthetic-a").SAMPLE, "original");
  assert.equal(f.queue.hasUnsyncedPortfolioChanges("account:synthetic-a"), true);
});

test("account boundary: another tab's switch blocks stale sessionStorage and late reads", async () => {
  const storage = new Map();
  const a = fixture(storage), b = fixture(storage); a.seed();
  const first = a.load("@/lib/portfolio/accountSync").accountPullCloud();
  const request = await a.waitForRequest();
  b.setAccount("synthetic-b");
  const protectedState = new Map(storage);
  request.reply({ json: { data: { allocation: 999 }, version: { scope: "a".repeat(64), revision: "c".repeat(64) } } });
  const result = await first;
  assert.equal(result.status, "error");
  assert.equal(result.code, "account-changed");
  assert.equal(result.data, undefined);
  assert.deepEqual(storage, protectedState);
  const next = await a.load("@/lib/portfolio/accountSync").accountPullCloud();
  assert.equal(next.status, "error");
  assert.equal(a.requests.length, 1, "stale tab must not send using either account's identity");
});

test("account boundary: explicit logout preserves pending and prevents late ACK or new requests", async () => {
  const f = fixture(); f.seed();
  const uploading = f.queue.drainPendingPortfolioCloudSync();
  const request = await f.waitForRequest();
  f.session.clearAccountSessionCache({ clearLastAuthenticated: true });
  const protectedState = new Map(f.storage);
  request.reply();
  assert.equal((await uploading).status, "deferred");
  assert.deepEqual(f.storage, protectedState);
  const next = await f.load("@/lib/portfolio/accountSync").accountPullCloud();
  assert.equal(next.status, "error");
  assert.equal(f.requests.length, 1);
});

test("account boundary: profile refresh for the same account does not invalidate its upload", async () => {
  const f = fixture(); f.seed();
  const uploading = f.queue.drainPendingPortfolioCloudSync();
  const request = await f.waitForRequest();
  f.session.rememberLastAuthenticatedAccount({ id: "synthetic-a", email_hint: "x***@example.invalid",
    display_name: "Updated name", createdAt: now });
  request.reply();
  assert.equal((await uploading).status, "ok");
  assert.equal(f.queue.hasUnsyncedPortfolioChanges(), false);
});

test("account boundary: the queue checks identity again before applying a received ACK", () => {
  const f = fixture(); f.seed();
  const attempt = f.queue.markPortfolioCloudSyncAttempt("account");
  f.setAccount("synthetic-b");
  const protectedState = new Map(f.storage);
  assert.equal(f.queue.markPortfolioCloudSyncAck("account", attempt, { SAMPLE: "old response" }), false);
  assert.deepEqual(f.storage, protectedState);
});

test("portfolio: status pings are not data changes; legacy pending state still blocks pulls", () => {
  const f = fixture();
  for (const key of ["zhinote.portfolio.sync.status.v1", "zhinote.portfolio.sync.status.ping.v1", null]) {
    assert.equal(f.store.isPortfolioDataStorageKey(key), false);
  }
  assert.equal(f.store.isPortfolioDataStorageKey(f.key("zhinote.portfolio.tags.v1")), true);
  assert.equal(f.store.isPortfolioDataStorageKey("zhinote.portfolio.tags.v1"), false);
  for (const [field, queueState] of [["pending", "pending"], ["inFlight", "syncing"], ["failed", "failed"], ["manualReviewCount", "manual_review"]]) {
    f.storage.set(f.key("zhinote.portfolio.sync.status.v1"), JSON.stringify({ mode: "account", queueState, [field]: 1 }));
    assert.equal(f.queue.hasUnsyncedPortfolioChanges(), true);
  }
  f.storage.set(f.key("zhinote.portfolio.sync.status.v1"), JSON.stringify({ mode: "account", queueState: "manual_review" }));
  assert.equal(f.queue.getPendingPortfolioCloudSyncStatus().manualReviewCount, 1, "legacy manual state must still expose the recovery entry");
});

test("portfolio: another request's ACK cannot confirm this request", async () => {
  const f = fixture(); f.seed();
  const uploading = f.queue.drainPendingPortfolioCloudSync();
  (await f.waitForRequest()).reply({ requestId: "different-request" });
  assert.equal((await uploading).status, "failed");
  assert.equal(f.queue.hasUnsyncedPortfolioChanges(), true);
});

test("portfolio: a late ACK cannot regress another tab's cloud baseline", async () => {
  const f = fixture();
  const versions = f.load("@/lib/portfolio/portfolioSyncRevision");
  const initial = { scope: "a".repeat(64), revision: "b".repeat(64) };
  versions.rememberPortfolioCloudBase("account", initial);
  const old = versions.createPortfolioPushGuard("account");
  const newer = { scope: initial.scope, revision: "c".repeat(64) };
  versions.rememberPortfolioCloudBase("account", newer);
  assert.equal(versions.acceptPortfolioCloudVersion("account", old, initial), false);
  assert.equal(versions.readPortfolioCloudBase("account").revision, newer.revision);
});

test("portfolio: retaining a conflict does not apply remote data or change the upload baseline", () => {
  const f = fixture(); f.seed();
  const versions = f.load("@/lib/portfolio/portfolioSyncRevision");
  const fingerprint = f.store.readPortfolioLocalFingerprint();
  versions.retainPortfolioConflict("account", { tagMap: { SAMPLE: "local" } }, {
    data: { tagMap: { SAMPLE: "remote" } }, version: { scope: "a".repeat(64), revision: "c".repeat(64) },
  });
  assert.equal(f.store.readPortfolioLocalFingerprint(), fingerprint);
  assert.equal(versions.readPortfolioCloudBase("account"), null);
  assert.equal(f.queue.hasUnsyncedPortfolioChanges(), true);
  const backup = JSON.parse([...f.storage].find(([key]) => key.startsWith(f.key("zhinote.portfolio.conflict.v2")))[1]);
  assert.equal(backup.local.tagMap.SAMPLE, "local");
  assert.equal(backup.cloud.tagMap.SAMPLE, "remote");
});

function conflictFixture(mode = "account") {
  const f = fixture(); f.seed(mode);
  const resolution = f.load("@/lib/portfolio/portfolioConflictResolution");
  const versions = f.load("@/lib/portfolio/portfolioSyncRevision");
  const local = resolution.readLocalPortfolioData();
  const cloud = { ...local, tagMap: { REMOTE: "only in cloud" }, allocation: 250 };
  const version = { scope: "a".repeat(64), revision: "c".repeat(64) };
  versions.rememberPortfolioCloudBase(mode, { scope: version.scope, revision: "b".repeat(64) });
  versions.retainPortfolioConflict(mode, local, { data: cloud, version });
  f.queue.markPortfolioCloudSyncFailure(mode, "synthetic conflict", { retryable: false });
  const review = { id: "synthetic-review", mode, storageScope: f.scope(), local, cloud, version,
    fingerprint: f.store.readPortfolioLocalFingerprint(), fields: resolution.portfolioConflictFields(local, cloud) };
  const choices = Object.fromEntries(review.fields.map((field) => [field.id, "cloud"]));
  return { ...f, resolution, versions, review, choices };
}

for (const mode of ["account", "passcode"]) {
  test(`${mode}: mixed conflict decisions change no local data before ACK, then converge`, async () => {
    const f = conflictFixture(mode);
    const choices = { ...f.choices, "tag:SAMPLE": "local" };
    const resolving = f.queue.submitPortfolioConflictResolution(f.review, choices);
    const request = await f.waitForRequest();
    assert.equal(f.store.readPortfolioLocalFingerprint(), f.review.fingerprint);
    assert.equal(request.body.base.revision, f.review.version.revision);
    assert.equal(request.body.data.tagMap.SAMPLE, "original");
    assert.equal(request.body.data.tagMap.REMOTE, "only in cloud");
    assert.equal(request.body.data.allocation, 250);
    request.reply({ revision: "d".repeat(64) });
    assert.equal((await resolving).status, "ok");
    assert.equal(f.store.loadAllocation(), 250);
    assert.equal(f.store.loadTagMap().SAMPLE, "original");
    assert.equal(f.store.loadTagMap().REMOTE, "only in cloud");
    assert.equal(f.queue.hasUnsyncedPortfolioChanges(), false);
    assert.equal(f.versions.readActivePortfolioConflict(mode), null);
    assert.equal(f.resolution.readPortfolioConflictResolution(mode), null);
    assert.ok(f.storage.has(f.key("zhinote.portfolio.conflict.review.v1.synthetic-review")), "recovery copies remain after success");
  });

  test(`${mode}: deletion choice survives network failure and retry without changing local prematurely`, async () => {
    const f = conflictFixture(mode);
    const resolving = f.queue.submitPortfolioConflictResolution(f.review, f.choices);
    const request = await f.waitForRequest();
    const payload = JSON.stringify(request.body.data);
    request.reject(new Error("Synthetic offline"));
    assert.equal((await resolving).status, "failed");
    assert.equal(f.store.readPortfolioLocalFingerprint(), f.review.fingerprint);
    assert.equal(f.queue.hasUnsyncedPortfolioChanges(), true);
    const retry = f.queue.drainPendingPortfolioCloudSync();
    await new Promise(setImmediate);
    const second = f.requests.at(-1);
    assert.equal(JSON.stringify(second.body.data), payload);
    second.reply({ revision: "d".repeat(64) });
    assert.equal((await retry).status, "ok");
    assert.equal(f.store.loadTagMap().SAMPLE, undefined);
    assert.equal(f.store.loadTagMap().REMOTE, "only in cloud");
  });
}

test("conflicts: unselected field, later edit and full storage cannot replace originals", async () => {
  const f = conflictFixture();
  await assert.rejects(() => f.queue.submitPortfolioConflictResolution(f.review, {}), /每一项/);
  f.controls.failWritePrefix = f.key("zhinote.portfolio.conflict.review");
  await assert.rejects(() => f.queue.submitPortfolioConflictResolution(f.review, f.choices), /full storage/);
  f.controls.failWritePrefix = null;
  f.store.saveAllocation(999);
  await assert.rejects(() => f.queue.submitPortfolioConflictResolution(f.review, f.choices), /本机内容已变化/);
  assert.equal(f.requests.length, 0);
  assert.equal(f.store.loadAllocation(), 999);
});

test("conflicts: edits during resolution upload survive its ACK and require a fresh review", async () => {
  const f = conflictFixture();
  const resolving = f.queue.submitPortfolioConflictResolution(f.review, f.choices);
  const request = await f.waitForRequest();
  f.store.saveTagMap({ SAMPLE: "edited while resolving" });
  f.queue.markPortfolioCloudSyncPending("account");
  request.reply({ revision: "d".repeat(64) });
  assert.equal((await resolving).status, "deferred");
  assert.equal(f.store.loadTagMap().SAMPLE, "edited while resolving");
  assert.equal(f.queue.hasUnsyncedPortfolioChanges(), true);
  assert.equal((await f.queue.drainPendingPortfolioCloudSync()).status, "manual_review");
  assert.equal(f.requests.length, 1);
});

test("conflicts: cloud changes again during review, retaining new conflict without applying choices", async () => {
  const f = conflictFixture();
  const resolving = f.queue.submitPortfolioConflictResolution(f.review, f.choices);
  const request = await f.waitForRequest();
  request.reply({ status: 409, json: { code: "portfolio-conflict", error: "Synthetic newer cloud",
    version: { ...f.review.version, revision: "e".repeat(64) }, data: { ...f.review.cloud, allocation: 1000 } } });
  assert.equal((await resolving).status, "manual_review");
  assert.equal(f.store.readPortfolioLocalFingerprint(), f.review.fingerprint);
  assert.equal(f.versions.readActivePortfolioConflict("account").revision, "e".repeat(64));
  assert.equal(f.queue.hasUnsyncedPortfolioChanges(), true);
});

test("conflicts: actual fresh pull rejects another account and detects local edits during read", async () => {
  for (const kind of ["account", "edit"]) {
    const f = conflictFixture();
    const loading = f.resolution.preparePortfolioConflictReview("account");
    const request = await f.waitForRequest();
    if (kind === "edit") f.store.saveAllocation(777);
    request.reply({ json: { data: f.review.cloud,
      version: { ...f.review.version, scope: kind === "account" ? "f".repeat(64) : f.review.version.scope } } });
    await assert.rejects(loading, kind === "account" ? /账号/ : /新修改/);
    assert.equal(f.queue.hasUnsyncedPortfolioChanges(), true);
  }
});

test("conflicts: malformed local cache cannot become an empty merge decision", () => {
  const f = conflictFixture();
  f.storage.set(f.key("zhinote.portfolio.tags.v1"), "not-json");
  assert.throws(() => f.resolution.readLocalPortfolioData());
  f.storage.set(f.key("zhinote.portfolio.tags.v1"), JSON.stringify(["bad-shape"]));
  assert.throws(() => f.resolution.readLocalPortfolioData(), /格式异常/);
});

test("conflicts: refresh retains the selected payload for retry after a lost ACK", async () => {
  const f = conflictFixture();
  const resolving = f.queue.submitPortfolioConflictResolution(f.review, f.choices);
  const request = await f.waitForRequest();
  request.reject(new Error("Synthetic lost ACK after cloud commit"));
  await resolving;
  const reloaded = fixture(f.storage);
  const retry = reloaded.queue.drainPendingPortfolioCloudSync();
  const next = await reloaded.waitForRequest();
  assert.equal(JSON.stringify(next.body.data), JSON.stringify(request.body.data));
  assert.equal(next.body.base.revision, f.review.version.revision);
  next.reply({ revision: "d".repeat(64) });
  assert.equal((await retry).status, "ok");
  assert.equal(reloaded.store.loadAllocation(), 250);
  assert.equal(reloaded.queue.hasUnsyncedPortfolioChanges(), false);
});

test("conflicts: local application failure after ACK retains pending and the immutable recovery pair", async () => {
  const f = conflictFixture();
  const resolving = f.queue.submitPortfolioConflictResolution(f.review, f.choices);
  const request = await f.waitForRequest();
  f.controls.failWritePrefix = f.key("zhinote.portfolio.state.v2");
  request.reply({ revision: "d".repeat(64) });
  await resolving;
  assert.equal(f.queue.hasUnsyncedPortfolioChanges(), true);
  assert.equal(f.queue.getPendingPortfolioCloudSyncStatus().lastAckAt, null);
  const backup = JSON.parse(f.storage.get(f.key("zhinote.portfolio.conflict.review.v1.synthetic-review")));
  assert.equal(backup.review.local.tagMap.SAMPLE, "original");
  assert.equal(backup.review.cloud.allocation, 250);
  assert.equal(f.store.loadAllocation(), 100, "a failed atomic apply cannot partially replace the old portfolio");
  f.controls.failWritePrefix = null;
  const retry = f.queue.drainPendingPortfolioCloudSync();
  await new Promise(setImmediate);
  f.requests.at(-1).reply({ revision: "d".repeat(64) });
  assert.equal((await retry).status, "ok");
  assert.equal(f.store.loadAllocation(), 250);
});

test("portfolio: failure to persist a cleared status cannot report successful synchronization", async () => {
  const f = fixture(); f.seed();
  const uploading = f.queue.drainPendingPortfolioCloudSync();
  const request = await f.waitForRequest();
  f.controls.failWriteIf = (key, value) => key === f.key("zhinote.portfolio.state.v2") &&
    JSON.parse(JSON.parse(value).values["zhinote.portfolio.sync.status.v1"]).queueState === "synced";
  request.reply();
  assert.equal((await uploading).status, "failed");
  assert.equal(f.queue.hasUnsyncedPortfolioChanges(), true);
  assert.equal(f.queue.getPendingPortfolioCloudSyncStatus().lastAckAt, null);
});

test("unreadable queue: blocks clean pulls, uploads and implicit resets without altering raw records", async () => {
  for (const raw of ["not-json", "null", "[]", "{}", "", '{"mode":"account"}', '{"mode":"account","pending":-1}', '{"mode":"account","queueState":"unknown"}']) {
    const f = fixture(); f.seed();
    const key = f.key("zhinote.portfolio.sync.status.v1");
    f.storage.set(key, raw);
    const content = f.store.readPortfolioLocalFingerprint();
    assert.equal(f.queue.hasUnsyncedPortfolioChanges(), true);
    assert.equal(f.queue.getPendingPortfolioCloudSyncStatus().storageError, true);
    assert.equal((await f.queue.drainPendingPortfolioCloudSync({ mode: "account" })).status, "manual_review");
    assert.throws(() => f.queue.markPortfolioCloudSyncPending("account"), /原始/);
    assert.throws(() => f.queue.markPortfolioCloudSyncOff(), /无法读取/);
    assert.equal(f.storage.get(key), raw);
    assert.equal(f.store.readPortfolioLocalFingerprint(), content);
    assert.equal(f.requests.length, 0);
  }
  const f = fixture(); f.seed();
  const key = f.key("zhinote.portfolio.sync.status.v1"), before = f.storage.get(key);
  f.controls.failReadPrefix = key;
  assert.equal((await f.queue.drainPendingPortfolioCloudSync({ mode: "account" })).status, "manual_review");
  assert.equal(f.queue.hasUnsyncedPortfolioChanges(), true);
  f.controls.failReadPrefix = null;
  assert.equal(f.storage.get(key), before);
  const retry = f.queue.drainPendingPortfolioCloudSync();
  (await f.waitForRequest()).reply();
  assert.equal((await retry).status, "ok");
});

test("unreadable content: ordinary uploads never turn corrupted values into empty/default data", async () => {
  for (const [name, raw] of [["tags", "broken"], ["tags", "[]"], ["tags", '{"SAMPLE":123}'],
    ["allocation", "NaN"], ["snapshot", '{"positions":null}'], ["maxNetPct", "999"], ["updatedAt", "bad-date"]]) {
    const f = fixture(); f.seed();
    f.storage.set(f.key(`zhinote.portfolio.${name}.v1`), raw);
    const before = f.store.readPortfolioLocalFingerprint();
    assert.throws(() => f.store.readLocalPortfolioData());
    await f.queue.drainPendingPortfolioCloudSync();
    assert.equal(f.requests.length, 0);
    assert.equal(f.store.readPortfolioLocalFingerprint(), before);
    assert.equal(f.queue.hasUnsyncedPortfolioChanges(), true);
  }
  const f = fixture(); f.seed();
  const key = f.key("zhinote.portfolio.updatedAt.v1"), before = "2025-01-01T00:00:00.000Z";
  f.storage.set(key, before);
  f.controls.failReadPrefix = key;
  await f.queue.drainPendingPortfolioCloudSync();
  assert.equal(f.requests.length, 0);
  assert.equal(f.storage.get(key), before, "failed timestamp read must not synthesize a newer edit");
  assert.equal(f.queue.hasUnsyncedPortfolioChanges(), true);
});

test("queue repair: explicit review retains malformed metadata and waits for ACK", async () => {
  const f = conflictFixture();
  const key = f.key("zhinote.portfolio.sync.status.v1");
  f.storage.set(key, "broken-queue");
  const preparing = f.resolution.preparePortfolioConflictReview("account");
  (await f.waitForRequest()).reply({ json: { data: f.review.cloud, version: f.review.version } });
  const review = await preparing;
  assert.equal(f.storage.get(key), "broken-queue", "opening or cancelling review cannot reset metadata");
  const applying = f.queue.submitPortfolioConflictResolution(review, Object.fromEntries(review.fields.map((field) => [field.id, "cloud"])));
  await new Promise(setImmediate);
  const backup = JSON.parse(f.storage.get(f.key(`zhinote.portfolio.conflict.review.v1.${review.id}`)));
  assert.equal(backup.review.queueSnapshot, "broken-queue");
  assert.equal(f.store.loadAllocation(), 100);
  f.requests.at(-1).reply({ revision: "d".repeat(64) });
  assert.equal((await applying).status, "ok");
  assert.equal(f.store.loadAllocation(), 250);
  assert.equal(f.queue.hasUnsyncedPortfolioChanges(), false);
});

test("legacy interrupted apply: refresh and mixed original/current/cloud recovery preserve newer input until ACK", async () => {
  const f = conflictFixture();
  // Earlier releases could leave this multi-key journal mid-apply. New commits
  // are atomic, but existing interrupted records must still be recoverable.
  const staged = f.resolution.stagePortfolioConflictResolution(f.review, f.choices);
  f.resolution.writePortfolioConflictResolution({ ...staged, state: "applying" });
  f.store.saveTagMap(staged.data.tagMap);
  const g = fixture(f.storage);
  assert.equal((await g.queue.drainPendingPortfolioCloudSync()).status, "manual_review");
  g.store.saveTagMap({ SAMPLE: "new input after interruption", LATER: "keep me" });
  g.queue.markPortfolioCloudSyncPending("account");
  const resolution = g.load("@/lib/portfolio/portfolioConflictResolution");
  const preparing = resolution.preparePortfolioConflictReview("account");
  (await g.waitForRequest()).reply({ json: { data: staged.data, version: { ...f.review.version, revision: "d".repeat(64) } } });
  const review = await preparing;
  assert.equal(review.recoveryOriginal.allocation, 100);
  assert.equal(review.local.tagMap.SAMPLE, "new input after interruption");
  assert.equal(review.cloud.tagMap.REMOTE, "only in cloud");
  const choices = Object.fromEntries(review.fields.map((field) => [field.id,
    field.id === "allocation" ? "original" : field.id === "tag:REMOTE" ? "cloud" : "local"]));
  const before = g.store.readPortfolioLocalFingerprint();
  const applying = g.queue.submitPortfolioConflictResolution(review, choices);
  await new Promise(setImmediate);
  const upload = g.requests.at(-1);
  assert.equal(upload.body.data.allocation, 100);
  assert.equal(upload.body.data.tagMap.SAMPLE, "new input after interruption");
  assert.equal(upload.body.data.tagMap.LATER, "keep me");
  assert.equal(upload.body.data.tagMap.REMOTE, "only in cloud");
  assert.equal(g.store.readPortfolioLocalFingerprint(), before);
  upload.reply({ revision: "e".repeat(64) });
  assert.equal((await applying).status, "ok");
  assert.equal(resolution.readPortfolioConflictResolution("account"), null);
  assert.equal(g.queue.hasUnsyncedPortfolioChanges(), false);
  assert.equal(g.store.loadTagMap().LATER, "keep me");
  assert.ok(g.storage.has(g.key("zhinote.portfolio.conflict.review.v1.synthetic-review")));
});

test("atomic local edit: one backend commit contains content, timestamp and pending; reload can retry", async () => {
  const f = fixture(); f.seed();
  f.writes.length = 0;
  const edited = f.queue.commitPortfolioLocalEdit("account", (current) => ({
    snapshot: { ...current.snapshot, fileName: "new-synthetic.xlsx" },
    tagMap: { ...current.tagMap, EXTRA: "new input" }, allocation: 220, lastEmailMessageId: "synthetic-mail-id",
  }));
  const commits = f.writes.filter(({ key }) => key === f.key("zhinote.portfolio.state.v2"));
  assert.equal(commits.length, 1);
  assert.ok(f.writes.every(({ key }) => key.endsWith("state.v2") || key.endsWith("sync.status.ping.v1") || key.endsWith("local-commit.v1")));
  const g = fixture(f.storage);
  assert.equal(JSON.stringify(g.store.readLocalPortfolioData()), JSON.stringify(edited));
  assert.equal(g.queue.hasUnsyncedPortfolioChanges(), true);
  const upload = g.queue.drainPendingPortfolioCloudSync();
  const request = await g.waitForRequest();
  assert.equal(request.body.data.allocation, 220);
  assert.equal(request.body.data.lastEmailMessageId, "synthetic-mail-id");
  request.reply();
  assert.equal((await upload).status, "ok");
  assert.equal(g.queue.hasUnsyncedPortfolioChanges(), false);
  g.queue.commitPortfolioLocalEdit("account", (current) => ({ snapshot: { ...current.snapshot, fileName: "manual-synthetic.xlsx" } }));
  assert.equal(g.store.loadLastEmailMessageId(), "synthetic-mail-id", "manual report replacement preserves mail deduplication");
});

test("atomic local edit: quota failure leaves the complete previous version and emits no saved notification", () => {
  for (const promoted of [false, true]) {
    const f = fixture(); f.seed();
    if (promoted) f.queue.commitPortfolioLocalEdit("account", () => ({ allocation: 125 }));
    const before = new Map(f.storage), fingerprint = f.store.readPortfolioLocalFingerprint();
    f.notifications.length = 0;
    f.controls.failWritePrefix = f.key("zhinote.portfolio.state.v2");
    assert.throws(() => f.queue.commitPortfolioLocalEdit("account", () => ({ tagMap: { NEW: "unsaved" }, allocation: 200 })), /full storage/);
    assert.deepEqual(f.storage, before);
    assert.equal(f.store.readPortfolioLocalFingerprint(), fingerprint);
    assert.deepEqual(f.notifications, []);
    const reloaded = fixture(f.storage);
    assert.equal(reloaded.store.readPortfolioLocalFingerprint(), fingerprint);
    f.controls.failWritePrefix = null;
    f.queue.commitPortfolioLocalEdit("account", () => ({ allocation: 200 }));
    assert.equal(f.store.loadAllocation(), 200);
  }
});

test("atomic local edit: older ACK cannot clear a later committed edit, status changes are not data changes", async () => {
  const f = fixture(); f.seed();
  const key = f.key("zhinote.portfolio.state.v2");
  f.queue.commitPortfolioLocalEdit("account", () => ({ allocation: 200 }));
  const before = f.storage.get(key);
  const first = f.queue.drainPendingPortfolioCloudSync();
  const request = await f.waitForRequest();
  assert.equal(f.store.hasPortfolioDataStorageChange({ key, oldValue: before, newValue: f.storage.get(key) }), false);
  f.queue.commitPortfolioLocalEdit("account", () => ({ allocation: 300 }));
  assert.equal(f.store.hasPortfolioDataStorageChange({ key, oldValue: before, newValue: f.storage.get(key) }), true);
  request.reply();
  assert.equal((await first).status, "deferred");
  assert.equal(f.store.loadAllocation(), 300);
  assert.equal(f.queue.hasUnsyncedPortfolioChanges(), true);
});

test("atomic cache: cloud content and baseline commit together, failure or corrupt state never falls back to stale keys", () => {
  const f = fixture(); f.seed();
  const versions = f.load("@/lib/portfolio/portfolioSyncRevision");
  const resolution = f.load("@/lib/portfolio/portfolioConflictResolution");
  const before = f.store.readPortfolioLocalFingerprint();
  const cloud = { ...f.store.readLocalPortfolioData(), allocation: 400, tagMap: { REMOTE: "cloud" } };
  const version = { scope: "a".repeat(64), revision: "b".repeat(64) };
  const apply = () => f.persistence.batchPortfolioStorage(f.scope(), () => {
    resolution.saveLocalPortfolioData(cloud);
    versions.rememberPortfolioCloudBase("account", version);
  });
  f.controls.failWritePrefix = f.key("zhinote.portfolio.state.v2");
  assert.throws(apply, /full storage/);
  assert.equal(f.store.readPortfolioLocalFingerprint(), before);
  assert.equal(versions.readPortfolioCloudBase("account"), null);
  f.controls.failWritePrefix = null;
  apply();
  const g = fixture(f.storage);
  assert.equal(g.store.loadAllocation(), 400);
  assert.equal(g.load("@/lib/portfolio/portfolioSyncRevision").readPortfolioCloudBase("account").revision, version.revision);
  f.storage.set(f.key("zhinote.portfolio.state.v2"), "broken atomic record");
  assert.throws(() => f.store.readLocalPortfolioData());
  assert.equal(f.queue.hasUnsyncedPortfolioChanges(), true);
  assert.throws(() => f.queue.commitPortfolioLocalEdit("account", () => ({ allocation: 700 })));
  assert.equal(f.storage.get(f.key("zhinote.portfolio.state.v2")), "broken atomic record");
});

test("atomic edit: unreadable queue or thrown edit callback leaves all persisted fields untouched", () => {
  const f = fixture(); f.seed();
  f.storage.set(f.key("zhinote.portfolio.sync.status.v1"), "damaged queue");
  const before = new Map(f.storage);
  assert.throws(() => f.queue.commitPortfolioLocalEdit("account", () => ({ allocation: 700 })));
  assert.deepEqual(f.storage, before);
  assert.throws(() => f.queue.commitPortfolioLocalEdit("account", () => { throw new Error("Synthetic aborted edit"); }), /aborted/);
  assert.deepEqual(f.storage, before);
});

test("pull checkpoint: content, queue, baseline and conflict changes invalidate a read, including another tab", async () => {
  const f = fixture(); f.seed();
  const read = () => f.persistence.readPortfolioStorageCheckpoint(f.scope());
  let checkpoint = read();
  f.persistence.batchPortfolioStorage(f.scope(), () => {});
  assert.equal(read(), checkpoint, "adopting unchanged legacy values is not an edit");
  const tab = fixture(f.storage);
  tab.store.saveAllocation(200);
  assert.notEqual(read(), checkpoint, "another tab's persisted state is read without waiting for its event");
  for (const [key, value] of [
    ["zhinote.portfolio.sync.base.v2.account", JSON.stringify({ scope: "a".repeat(64), revision: "b".repeat(64) })],
    ["zhinote.portfolio.sync.conflict.v1.account", JSON.stringify({ scope: "a".repeat(64), revision: "c".repeat(64) })],
    ["zhinote.portfolio.sync.resolution.v1.account", JSON.stringify({ id: "synthetic-review" })],
  ]) {
    checkpoint = read();
    tab.persistence.portfolioStorage(tab.scope()).setItem(key, value);
    assert.notEqual(read(), checkpoint, `${key} invalidates a read even when content is unchanged`);
  }
  checkpoint = read();
  f.queue.markPortfolioCloudSyncPending("account");
  assert.notEqual(read(), checkpoint, "a new queue revision invalidates even identical edits");
});

test("pull checkpoint: an ACK invalidates the pre-upload snapshot even after pending is clear", async () => {
  const f = fixture(); f.seed();
  const before = f.persistence.readPortfolioStorageCheckpoint(f.scope());
  const uploading = f.queue.drainPendingPortfolioCloudSync();
  (await f.waitForRequest()).reply();
  assert.equal((await uploading).status, "ok");
  assert.equal(f.queue.hasUnsyncedPortfolioChanges(), false);
  assert.notEqual(f.persistence.readPortfolioStorageCheckpoint(f.scope()), before);
});

test("pull checkpoint: checks the in-progress batch, fails closed on corruption and never crosses accounts", () => {
  const f = fixture(); f.seed();
  const scope = f.scope();
  const before = f.persistence.readPortfolioStorageCheckpoint(scope);
  assert.throws(() => f.persistence.batchPortfolioStorage(scope, () => {
    assert.equal(f.persistence.readPortfolioStorageCheckpoint(scope), before);
    f.store.saveAllocation(300);
    assert.notEqual(f.persistence.readPortfolioStorageCheckpoint(scope), before);
    throw new Error("Synthetic aborted apply");
  }), /aborted/);
  assert.equal(f.persistence.readPortfolioStorageCheckpoint(scope), before, "an aborted apply keeps the previous checkpoint");
  f.setAccount("synthetic-b");
  assert.throws(() => f.persistence.readPortfolioStorageCheckpoint(scope), /账号已改变/);
  f.setAccount("synthetic-a");
  f.storage.set(f.key("zhinote.portfolio.state.v2"), "corrupt record");
  assert.throws(() => f.persistence.readPortfolioStorageCheckpoint(scope));
});

test("scoped cache: A and B have separate queues and concurrent drains, A resumes after returning", async () => {
  const f = fixture(); f.seed();
  const aScope = f.scope();
  const aState = f.store.readPortfolioLocalFingerprint();
  const aUpload = f.queue.drainPendingPortfolioCloudSync();
  const aRequest = await f.waitForRequest();
  f.setAccount("synthetic-b");
  assert.equal(f.store.loadSnapshot(), null);
  assert.equal(Object.keys(f.store.loadTagMap()).length, 0);
  assert.equal(f.queue.hasUnsyncedPortfolioChanges(), false);
  assert.equal((await f.queue.drainPendingPortfolioCloudSync({ scope: aScope })).status, "deferred");
  assert.equal(f.requests.length, 1);
  f.seed();
  f.store.saveTagMap({ ONLY_B: "private to B" });
  const bUpload = f.queue.drainPendingPortfolioCloudSync();
  await new Promise(setImmediate);
  assert.equal(f.requests.length, 2, "B's drain is not deduplicated into A's in-flight promise");
  assert.equal(f.requests[1].body.expectedAccountId, "synthetic-b");
  assert.equal(f.requests[1].body.data.tagMap.SAMPLE, undefined);
  f.requests[1].reply();
  assert.equal((await bUpload).status, "ok");
  const bState = f.store.readPortfolioLocalFingerprint();
  aRequest.reply();
  assert.equal((await aUpload).status, "deferred");
  assert.equal(f.store.readPortfolioLocalFingerprint(), bState);
  f.setAccount("synthetic-a");
  assert.equal(f.store.readPortfolioLocalFingerprint(), aState);
  assert.equal(f.queue.hasUnsyncedPortfolioChanges(), true);
  const resumed = f.queue.drainPendingPortfolioCloudSync();
  await new Promise(setImmediate);
  assert.equal(f.requests[2].body.data.tagMap.SAMPLE, "original");
  assert.equal(f.requests[2].body.data.tagMap.ONLY_B, undefined);
  f.requests[2].reply();
  assert.equal((await resumed).status, "ok");
});

test("scoped cache: base, conflict, decision and passcode never cross accounts or anonymous mode", async () => {
  const f = conflictFixture();
  f.resolution.stagePortfolioConflictResolution(f.review, f.choices);
  await new Promise(setImmediate);
  f.setAccount("synthetic-b");
  const bState = new Map(f.storage);
  assert.equal(f.versions.readPortfolioCloudBase("account"), null);
  assert.equal(f.versions.readActivePortfolioConflict("account"), null);
  assert.equal(f.resolution.readPortfolioConflictResolution("account"), null);
  await assert.rejects(() => f.queue.submitPortfolioConflictResolution(f.review, f.choices), /账号/);
  assert.deepEqual(f.storage, bState);
  f.session.clearAccountSessionCache({ clearLastAuthenticated: true });
  assert.equal(f.store.loadSnapshot(), null);
  f.load("@/lib/portfolio/cloudSync").saveSyncPasscode("anonymous-only");
  f.setAccount("synthetic-a");
  assert.equal(f.load("@/lib/portfolio/cloudSync").loadSyncPasscode(), null);
  assert.equal(f.resolution.readPortfolioConflictResolution("account").review.id, f.review.id);
});

test("legacy cache: no automatic adoption; explicit review waits for exact ACK and preserves originals", async () => {
  const f = fixture();
  const resolution = f.load("@/lib/portfolio/portfolioConflictResolution");
  f.storage.set("zhinote.portfolio.tags.v1", JSON.stringify({ LEGACY: "unowned data" }));
  const legacyBefore = f.store.readPortfolioLocalFingerprint("legacy");
  assert.equal(Object.keys(f.store.loadTagMap()).length, 0);
  assert.equal(f.queue.hasUnsyncedPortfolioChanges(), false);
  const reviewing = resolution.prepareLegacyPortfolioReview();
  const read = await f.waitForRequest();
  read.reply({ json: { data: null, version: { scope: "a".repeat(64), revision: null } } });
  const review = await reviewing;
  assert.equal(f.queue.hasUnsyncedPortfolioChanges(), false, "opening/cancelling a review creates no upload work");
  assert.equal(Object.keys(f.store.loadTagMap()).length, 0);
  const choices = Object.fromEntries(review.fields.map((field) => [field.id, "local"]));
  const uploading = f.queue.submitPortfolioConflictResolution(review, choices);
  await new Promise(setImmediate);
  assert.equal(f.requests[1].body.data.tagMap.LEGACY, "unowned data");
  assert.equal(Object.keys(f.store.loadTagMap()).length, 0, "target stays unchanged before ACK");
  f.requests[1].reply();
  assert.equal((await uploading).status, "ok");
  assert.equal(f.store.loadTagMap().LEGACY, "unowned data");
  assert.equal(f.store.readPortfolioLocalFingerprint("legacy"), legacyBefore);
  assert.equal(resolution.hasUnreviewedLegacyPortfolio(), false);
  f.storage.set("zhinote.portfolio.tags.v1", JSON.stringify({ LEGACY: "new input from an older tab" }));
  assert.equal(resolution.hasUnreviewedLegacyPortfolio(), true, "later legacy edits still require review");
  assert.equal(f.store.loadTagMap().LEGACY, "unowned data");
  assert.equal(f.queue.hasUnsyncedPortfolioChanges(), false, "later legacy input is not uploaded implicitly");
  f.setAccount("synthetic-b");
  assert.equal(Object.keys(f.store.loadTagMap()).length, 0);
});

test("legacy cache: changed original or new target input prevents applying stale ownership decisions", async () => {
  for (const changedScope of ["legacy", "account:synthetic-a"]) {
    const f = fixture();
    const resolution = f.load("@/lib/portfolio/portfolioConflictResolution");
    f.storage.set("zhinote.portfolio.tags.v1", JSON.stringify({ LEGACY: "original" }));
    const reviewing = resolution.prepareLegacyPortfolioReview();
    (await f.waitForRequest()).reply({ json: { data: null, version: { scope: "a".repeat(64), revision: null } } });
    const review = await reviewing;
    if (changedScope === "legacy") f.storage.set("zhinote.portfolio.tags.v1", JSON.stringify({ NEW: "later input" }));
    else f.store.saveTagMap({ NEW: "later input" }, changedScope);
    await assert.rejects(() => f.queue.submitPortfolioConflictResolution(review,
      Object.fromEntries(review.fields.map((field) => [field.id, "local"]))), /变化|修改/);
    assert.equal(f.requests.length, 1);
    assert.equal(f.store.loadTagMap(changedScope).NEW, "later input");
  }
});

test("session: a shared late probe cannot restore a signed-out or switched account", async () => {
  for (const action of ["logout", "switch"]) {
    const f = fixture();
    const first = f.session.fetchAccountSession({ force: true });
    const joined = f.session.fetchAccountSession({ force: true });
    const request = await f.waitForRequest();
    assert.equal(f.requests.length, 1);
    if (action === "logout") f.session.clearAccountSessionCache({ clearLastAuthenticated: true });
    else f.setAccount("synthetic-b");
    request.reply({ json: { authenticated: true, account: { id: "synthetic-a", email_hint: "a***@example.invalid", display_name: "A", createdAt: now } } });
    for (const result of [await first, await joined]) {
      assert.equal(result.status, "unconfirmed");
      assert.equal(result.account?.id ?? null, action === "logout" ? null : "synthetic-b");
    }
    assert.equal(f.session.getLastAuthenticatedAccount()?.id ?? null, action === "logout" ? null : "synthetic-b");
  }
});
