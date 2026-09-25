// Runs the real client modules against synthetic storage and a fake network.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = new URL("../", import.meta.url);
const now = "2026-09-25T04:00:00.000Z";
const record = (id) => ({
  id, type: "database", parent_id: null, title: "Synthetic sync test",
  icon: null, cover_url: null, content_text: "test", properties: null,
  position: 0, depth: 0, created_at: now, updated_at: now, deleted_at: null,
});

function fixture(domain, options = {}) {
  const prefix = `zhinote.${domain === "page" ? "page" : "database"}sync.`;
  const queueKey = prefix + (domain === "page" ? "pendingPushIds" : "pendingPushKeys");
  const key = (row) => domain === "page" ? row.id : `${row.type}:${row.id}`;
  const storage = options.storage ?? new Map();
  const requests = [];
  const local = { records: options.records ?? [], readError: false };
  const readRows = async () => {
    if (local.readError) throw new Error("Synthetic local read failure");
    return local.records;
  };
  const emptyLog = async () => ({ entries: [], records: [] });
  const queries = {
    getPagesForSyncByIds: readRows,
    getDatabaseRecordsForSyncByKeys: readRows,
    getRemoteDatabaseRecordKey: (row) => `${row.type}:${row.id}`,
    getPendingPageSyncRecords: emptyLog,
    getPendingDatabaseSyncRecords: emptyLog,
    markPageSyncLogEntriesSynced: async () => 0,
    markDatabaseSyncLogEntriesSynced: async () => 0,
    getPageSyncLogPendingCounts: async () => ({ pending: 0, failed: 0, manualReview: 0 }),
    getDatabaseSyncLogPendingCounts: async () => ({ pending: 0, failed: 0, manualReview: 0 }),
  };
  const localStorage = {
    getItem: (name) => storage.get(name) ?? null,
    setItem: (name, value) => storage.set(name, String(value)),
    removeItem: (name) => storage.delete(name),
  };
  const dependencies = {
    "@/lib/db/local/queries": queries,
    "@/lib/pages/moduleWorkspaces": { MODULE_WORKSPACE_LIST: [] },
    "@/lib/pages/pageProperties": {},
    "@/lib/pages/pageUpdateBus": { emitPagesUpdated: () => {} },
    "@/lib/database/databaseUpdateBus": { emitDatabasesUpdated: () => {} },
    "@/lib/account/accountCloudSyncGate": {
      checkAccountCloudSyncGate: async () => ({ status: options.gate ?? "ready" }),
    },
  };
  const sandbox = {
    exports: {}, Date, URL, TextEncoder, AbortController,
    setTimeout: () => 1, clearTimeout: () => {},
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    window: { localStorage, sessionStorage: localStorage, dispatchEvent: () => {} },
    require: (name) => {
      assert.ok(name in dependencies, `Unexpected dependency ${name}`);
      return dependencies[name];
    },
    fetch: async (_url, init) => {
      const body = JSON.parse(init.body);
      requests.push(body);
      if (options.networkError) throw new Error("Synthetic network failure");
      const sent = body.pages ?? body.records;
      const accepted = sent.map(key);
      const ack = {
        format: `zhinote-${domain}-cloud-ack-receipt`, format_version: 1,
        ack_status: "acknowledged", generated_at: now,
        requested_count: sent.length, accepted_count: sent.length,
        skipped_count: 0, rejected_count: 0, index_count: sent.length, index_deleted: 0,
        remote_watermark: "server-after-other-device-change", remote_cursor: "server-latest",
        boundary: {
          metadata_only: true, reads_page_body_text: false,
          reads_database_row_values: false, reads_file_bytes: false,
          account_scoped: true, stores_only_authenticated_account_copy: true,
          uses_raw_browser_storage_dump: false,
        },
      };
      return { ok: true, status: 200, json: async () => ({ accepted, skipped: [], rejected: [],
        ...(options.noAck ? {} : { ack }),
      }) };
    },
  };
  const path = domain === "page" ? "src/lib/pages/accountPageSync.ts" : "src/lib/database/accountDatabaseSync.ts";
  const source = process.env.SYNC_TEST_REV
    ? execFileSync("git", ["show", `${process.env.SYNC_TEST_REV}:${path}`], { cwd: root, encoding: "utf8" })
    : readFileSync(new URL(path, root), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code + (domain === "page"
    ? "\nexports.flush = flushPendingCloudPushes;"
    : "\nexports.flush = flushPendingCloudDatabasePushes;"), sandbox, { filename: path });
  return {
    api: sandbox.exports, storage, local, requests, queueKey,
    pending: () => JSON.parse(storage.get(queueKey) ?? "[]"),
    meta: () => JSON.parse(storage.get(prefix + "pendingPushMeta") ?? "{}"),
    enqueue: (ids) => storage.set(queueKey, JSON.stringify(ids)),
    prefix,
  };
}

for (const domain of ["page", "database"]) {
  const id = domain === "page" ? "missing" : "database:missing";
  test(`${domain}: missing local records stay pending across reload and do not become cloud skips`, async () => {
    const f = fixture(domain);
    f.enqueue([id]);
    const result = await f.api.flush();
    assert.deepEqual(f.pending(), [id]);
    assert.equal(f.meta()[id].failureCount, 1);
    assert.ok(f.meta()[id].lastError);
    assert.equal(result.skipped, 0);
    assert.equal(result.skippedKeys?.length ?? 0, 0);
    assert.equal(f.requests.length, 0);
    const reloaded = fixture(domain, { storage: f.storage });
    assert.deepEqual(reloaded.pending(), [id]);
    reloaded.local.records = [record("missing")];
    await reloaded.api.flush();
    assert.deepEqual(reloaded.pending(), []);
    assert.equal(reloaded.requests.length, 1);
  });

  test(`${domain}: a missing record does not block a healthy record`, async () => {
    const f = fixture(domain, { records: [record("healthy")] });
    f.enqueue([id, domain === "page" ? "healthy" : "database:healthy"]);
    await f.api.flush();
    assert.equal(f.requests.length, 1);
    assert.deepEqual(f.pending(), [id]);
    assert.equal(f.meta()[id].failureCount, 1);
  });

  for (const failure of ["noAck", "networkError"]) {
    test(`${domain}: ${failure} cannot clear pending`, async () => {
      const f = fixture(domain, { records: [record("missing")], [failure]: true });
      f.enqueue([id]);
      const result = await f.api.flush();
      assert.equal(result.status, "error");
      assert.deepEqual(f.pending(), [id]);
      assert.ok(f.meta()[id].lastError);
    });
  }
}

test("page: local eviction markers never upload or silently clear pending", async () => {
  const f = fixture("page", { records: [{ ...record("evicted"),
    title: "", content_text: null, sync_version: -1,
    updated_at: "1970-01-01T00:00:00.000Z", deleted_at: "1970-01-01T00:00:00.000Z",
  }] });
  f.enqueue(["evicted"]);
  await f.api.flush();
  assert.deepEqual(f.pending(), ["evicted"]);
  assert.equal(f.requests.length, 0);
  assert.ok(f.meta().evicted.lastError);
});

test("page: upload ACK must not skip unread changes from another device", async () => {
  const f = fixture("page", { records: [record("edited")] });
  f.storage.set(f.prefix + "remoteCursor", "last-downloaded");
  f.storage.set(f.prefix + "remoteWatermark", "last-downloaded-summary");
  f.enqueue(["edited"]);
  const result = await f.api.flush();
  assert.equal(result.status, "ok");
  assert.deepEqual(f.pending(), []);
  assert.equal(f.storage.get(f.prefix + "remoteCursor"), "last-downloaded");
  assert.equal(f.storage.get(f.prefix + "remoteWatermark"), "last-downloaded-summary");
});
