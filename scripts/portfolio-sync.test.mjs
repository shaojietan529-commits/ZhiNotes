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
  const controls = { failContentRead: false, gate: "ready" };
  const modules = new Map();
  const localStorage = {
    getItem(key) {
      if (controls.failContentRead && !key.includes("sync.")) throw new Error("Synthetic read error");
      return storage.get(key) ?? null;
    },
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  };
  function load(name, parent = path.join(root, "src/entry.ts")) {
    if (name === "@/lib/account/accountCloudSyncGate") {
      return { checkAccountCloudSyncGate: async () => ({ status: controls.gate }) };
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
      Date: FixedDate, crypto: webcrypto, AbortController, setTimeout, clearTimeout,
      CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
      window: { localStorage, dispatchEvent: () => {} },
      fetch: async (url, init) => new Promise((resolve, reject) => {
        const body = JSON.parse(init.body);
        requests.push({ url, body, reject, reply: (options = {}) => resolve(Response.json({
          tagMap: options.tags ?? body.data.tagMap,
          ...(options.noAck ? {} : { ack: {
            format: "zhinote-portfolio-cloud-ack-receipt", format_version: 2,
            ack_status: "acknowledged", accepted: true,
            request_id: options.requestId ?? body.requestId,
            scope: options.scope ?? "a".repeat(64), revision: options.revision ?? "b".repeat(64),
            updated_at: options.updatedAt ?? body.data.updatedAt,
          } }),
        }, { status: options.status ?? 200 })) });
      }),
    }, { filename: file });
    return loadedModule.exports;
  }
  const store = load("@/lib/portfolio/portfolioStore");
  const queue = load("@/lib/portfolio/portfolioSyncStatus");
  const seed = (mode = "account") => {
    store.saveSnapshot({ importedAt: now, fileName: "synthetic.xlsx", positions: [] });
    store.saveTagMap({ SAMPLE: "original" });
    store.saveAllocation(100);
    store.saveMaxNetPct(12);
    store.saveDataUpdatedAt(now);
    if (mode === "passcode") load("@/lib/portfolio/cloudSync").saveSyncPasscode("synthetic-only");
    queue.markPortfolioCloudSyncPending(mode);
  };
  const waitForRequest = async () => {
    for (let i = 0; i < 20 && !requests.length; i++) await Promise.resolve();
    assert.ok(requests.length);
    return requests.at(-1);
  };
  return { store, queue, seed, waitForRequest, requests, controls, storage, load };
}

test("portfolio: exact ACK clears only the uploaded local revision and applies merged labels", async () => {
  const f = fixture(); f.seed();
  const uploading = f.queue.drainPendingPortfolioCloudSync();
  (await f.waitForRequest()).reply({ tags: { SAMPLE: "original", EXTRA: "server" } });
  assert.equal((await uploading).status, "ok");
  assert.equal(f.queue.hasUnsyncedPortfolioChanges(), false);
  assert.equal(f.store.loadTagMap().EXTRA, "server");
  assert.equal(f.queue.getPendingPortfolioCloudSyncStatus().queueState, "synced");
  const savedStatus = f.storage.get("zhinote.portfolio.sync.status.v1");
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
    for (let i = 0; i < 10; i++) await Promise.resolve();
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
    const statusAfterNewAck = storage.get("zhinote.portfolio.sync.status.v1");
    if (lateFailure) oldRequest.reject(new Error("Synthetic network failure"));
    else oldRequest.reply({ tags: { SAMPLE: "stale result" } });
    assert.equal((await first).status, "deferred");
    assert.equal(a.store.loadTagMap().SAMPLE, "second tab");
    assert.equal(storage.get("zhinote.portfolio.sync.status.v1"), statusAfterNewAck);
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
  for (let i = 0; i < 10; i++) await Promise.resolve();
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
  assert.equal((await uploading).status, "failed");
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

test("portfolio: status pings are not data changes; legacy pending state still blocks pulls", () => {
  const f = fixture();
  for (const key of ["zhinote.portfolio.sync.status.v1", "zhinote.portfolio.sync.status.ping.v1", null]) {
    assert.equal(f.store.isPortfolioDataStorageKey(key), false);
  }
  assert.equal(f.store.isPortfolioDataStorageKey("zhinote.portfolio.tags.v1"), true);
  for (const [field, queueState] of [["pending", "pending"], ["inFlight", "syncing"], ["failed", "failed"], ["manualReviewCount", "manual_review"]]) {
    f.storage.set("zhinote.portfolio.sync.status.v1", JSON.stringify({ mode: "account", queueState, [field]: 1 }));
    assert.equal(f.queue.hasUnsyncedPortfolioChanges(), true);
  }
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
  const backup = JSON.parse([...f.storage].find(([key]) => key.startsWith("zhinote.portfolio.conflict.v2"))[1]);
  assert.equal(backup.local.tagMap.SAMPLE, "local");
  assert.equal(backup.cloud.tagMap.SAMPLE, "remote");
});
