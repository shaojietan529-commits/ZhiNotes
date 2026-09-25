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
  const controls = { failContentRead: false, gate: "ready", failWritePrefix: null, beforeGate: null };
  const tabStorage = new Map();
  const sessionStorage = {
    getItem: (key) => tabStorage.get(key) ?? null,
    setItem: (key, value) => tabStorage.set(key, String(value)),
    removeItem: (key) => tabStorage.delete(key),
  };
  const modules = new Map();
  const localStorage = {
    getItem(key) {
      if (controls.failContentRead && key.startsWith("zhinote.portfolio.") && !key.includes("sync.")) throw new Error("Synthetic read error");
      return storage.get(key) ?? null;
    },
    setItem: (key, value) => {
      if (controls.failWritePrefix && key.startsWith(controls.failWritePrefix)) throw new Error("Synthetic full storage");
      storage.set(key, String(value));
    },
    removeItem: (key) => storage.delete(key),
  };
  function load(name, parent = path.join(root, "src/entry.ts")) {
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
      Date: FixedDate, crypto: webcrypto, AbortController, setTimeout, clearTimeout, Event,
      CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
      window: { localStorage, sessionStorage, dispatchEvent: () => {} },
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
  const store = load("@/lib/portfolio/portfolioStore");
  const queue = load("@/lib/portfolio/portfolioSyncStatus");
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
    for (let i = 0; i < 20 && !requests.length; i++) await Promise.resolve();
    assert.ok(requests.length);
    return requests.at(-1);
  };
  const scope = load("@/lib/portfolio/portfolioStorageScope");
  return { store, queue, seed, waitForRequest, requests, controls, storage, load, session, setAccount,
    key: scope.portfolioStorageKey, scope: scope.getPortfolioStorageScope };
}

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
    for (let i = 0; i < 20; i++) await Promise.resolve();
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
  f.controls.failWritePrefix = f.key("zhinote.portfolio.allocation");
  request.reply({ revision: "d".repeat(64) });
  await resolving;
  assert.equal(f.queue.hasUnsyncedPortfolioChanges(), true);
  assert.equal(f.queue.getPendingPortfolioCloudSyncStatus().lastAckAt, null);
  const backup = JSON.parse(f.storage.get(f.key("zhinote.portfolio.conflict.review.v1.synthetic-review")));
  assert.equal(backup.review.local.tagMap.SAMPLE, "original");
  assert.equal(backup.review.cloud.allocation, 250);
  assert.equal((await f.queue.drainPendingPortfolioCloudSync()).status, "manual_review");
});

test("portfolio: failure to persist a cleared status cannot report successful synchronization", async () => {
  const f = fixture(); f.seed();
  const uploading = f.queue.drainPendingPortfolioCloudSync();
  const request = await f.waitForRequest();
  f.controls.failWritePrefix = f.key("zhinote.portfolio.sync.status.v1");
  request.reply();
  await assert.rejects(uploading, /full storage/);
  assert.equal(f.queue.hasUnsyncedPortfolioChanges(), true);
  assert.equal(f.queue.getPendingPortfolioCloudSyncStatus().lastAckAt, null);
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
  for (let i = 0; i < 20; i++) await Promise.resolve();
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
  for (let i = 0; i < 20; i++) await Promise.resolve();
  assert.equal(f.requests[2].body.data.tagMap.SAMPLE, "original");
  assert.equal(f.requests[2].body.data.tagMap.ONLY_B, undefined);
  f.requests[2].reply();
  assert.equal((await resumed).status, "ok");
});

test("scoped cache: base, conflict, decision and passcode never cross accounts or anonymous mode", async () => {
  const f = conflictFixture();
  f.resolution.stagePortfolioConflictResolution(f.review, f.choices);
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
  f.store.saveTagMap({ LEGACY: "unowned data" }, "legacy");
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
  for (let i = 0; i < 20; i++) await Promise.resolve();
  assert.equal(f.requests[1].body.data.tagMap.LEGACY, "unowned data");
  assert.equal(Object.keys(f.store.loadTagMap()).length, 0, "target stays unchanged before ACK");
  f.requests[1].reply();
  assert.equal((await uploading).status, "ok");
  assert.equal(f.store.loadTagMap().LEGACY, "unowned data");
  assert.equal(f.store.readPortfolioLocalFingerprint("legacy"), legacyBefore);
  assert.equal(resolution.hasUnreviewedLegacyPortfolio(), false);
  f.store.saveTagMap({ LEGACY: "new input from an older tab" }, "legacy");
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
    f.store.saveTagMap({ LEGACY: "original" }, "legacy");
    const reviewing = resolution.prepareLegacyPortfolioReview();
    (await f.waitForRequest()).reply({ json: { data: null, version: { scope: "a".repeat(64), revision: null } } });
    const review = await reviewing;
    f.store.saveTagMap({ NEW: "later input" }, changedScope);
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
