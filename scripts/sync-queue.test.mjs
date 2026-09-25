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
  const events = [];
  const local = options.local ?? { records: options.records ?? [], entries: options.entries ?? [], readError: false };
  const readRows = async (keys) => {
    if (local.readError) throw new Error("Synthetic local read failure");
    return structuredClone(local.records.filter((row) => !keys || keys.includes(key(row))));
  };
  const pendingLog = async (_limit, keys) => ({
    entries: structuredClone(local.entries.filter((entry) => !keys || keys.includes(entry.pageId ?? entry.key))),
    records: await readRows(keys),
  });
  const acknowledgeLog = async (ids) => {
    local.entries = local.entries.filter((entry) => !ids.includes(entry.logId));
    await options.duringLocalAck?.(local);
    return ids.length;
  };
  const queries = {
    applyRemotePages: async (rows) => rows.filter((row) => !local.entries.some((entry) => entry.pageId === row.id)),
    getPagesForSyncByIds: readRows,
    getDatabaseRecordsForSyncByKeys: readRows,
    getRemoteDatabaseRecordKey: (row) => `${row.type}:${row.id}`,
    getPendingPageSyncRecords: pendingLog,
    getPendingDatabaseSyncRecords: pendingLog,
    markPageSyncLogEntriesSynced: acknowledgeLog,
    markDatabaseSyncLogEntriesSynced: acknowledgeLog,
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
    "@/lib/pages/pageUpdateBus": { emitPagesUpdated: (...args) => events.push(args) },
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
      if (body.action === "pull") {
        return { ok: true, status: 200, json: async () => ({ pages: options.cloudRows ?? [] }) };
      }
      await options.duringRequest?.(local, body, requests.length);
      if (options.networkError) throw new Error("Synthetic network failure");
      const sent = body.pages ?? body.records;
      const accepted = options.accepted ?? sent.map(key);
      const ack = {
        format: `zhinote-${domain}-cloud-ack-receipt`, format_version: 1,
        ack_status: "acknowledged", generated_at: now,
        requested_count: sent.length, accepted_count: accepted.length,
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
    api: sandbox.exports, storage, local, requests, events, queueKey,
    pending: () => JSON.parse(storage.get(queueKey) ?? "[]"),
    meta: () => JSON.parse(storage.get(prefix + "pendingPushMeta") ?? "{}"),
    enqueue: (ids) => storage.set(queueKey, JSON.stringify(ids)),
    prefix,
  };
}

for (const domain of ["page", "database"]) {
  const id = domain === "page" ? "missing" : "database:missing";
  const entry = (logId) => ({ logId, ...(domain === "page" ? { pageId: "missing" } : { key: id }) });
  const push = (f, rows) => domain === "page" ? f.api.pushCloudPages(rows) : f.api.pushCloudDatabaseRecords(rows);

  for (const change of ["rename", "delete", "body"]) {
    test(`${domain}: late ACK cannot consume a concurrent ${change}; next retry uploads it`, async () => {
      const original = record("missing");
      const next = { ...original, ...(change === "rename" ? { title: "New name" }
        : change === "delete" ? { deleted_at: now } : { content_text: "New text", field_values: '{"x":2}' }) };
      const f = fixture(domain, {
        records: [original], entries: [entry(1)],
        duringRequest(local, _body, count) {
          if (count !== 1) return;
          // Same timestamp deliberately: the payload, not the wall clock, identifies this revision.
          local.records = [next];
          local.entries.push(entry(2));
        },
      });
      f.enqueue([id]);
      await f.api.flush();
      assert.deepEqual(f.pending(), [id]);
      assert.deepEqual(f.local.entries, [entry(2)]);
      await f.api.flush();
      assert.deepEqual(f.pending(), []);
      assert.deepEqual(f.local.entries, []);
      const sent = f.requests[1].pages ?? f.requests[1].records;
      assert.equal(sent[0].title, next.title);
      assert.equal(sent[0].deleted_at, next.deleted_at);
    });
  }

  test(`${domain}: an already stale queued snapshot cannot ACK a newer durable edit`, async () => {
    const f = fixture(domain, { records: [{ ...record("missing"), title: "Already edited" }], entries: [entry(1)] });
    await push(f, [record("missing")]);
    assert.deepEqual(f.local.entries, [entry(1)]);
    assert.deepEqual(f.pending(), [id]);
  });

  test(`${domain}: newer request ACK arriving before an older tab ACK stays authoritative`, async () => {
    let release;
    let sent;
    const started = new Promise((resolve) => { sent = resolve; });
    const held = new Promise((resolve) => { release = resolve; });
    const older = fixture(domain, {
      records: [record("missing")], entries: [entry(1)],
      async duringRequest() { sent(); await held; },
    });
    const uploading = push(older, [record("missing")]);
    await started;
    older.local.records = [{ ...record("missing"), title: "Newest revision" }];
    older.local.entries.push(entry(2));
    const newer = fixture(domain, { local: older.local, storage: older.storage });
    await newer.api.flush();
    assert.deepEqual(newer.pending(), []);
    assert.deepEqual(newer.local.entries, []);
    release();
    await uploading;
    assert.deepEqual(older.pending(), []);
    assert.deepEqual(older.local.entries, []);
    assert.equal(older.local.records[0].title, "Newest revision");
  });

  test(`${domain}: local read failure after cloud ACK cannot retire the retry pointer`, async () => {
    const f = fixture(domain, { records: [record("missing")], entries: [entry(1)],
      duringRequest(local) { local.readError = true; },
    });
    await push(f, [record("missing")]);
    assert.deepEqual(f.pending(), [id]);
  });

  test(`${domain}: duplicate ACK identifiers do not confirm an omitted record`, async () => {
    const other = domain === "page" ? "other" : "database:other";
    const f = fixture(domain, { records: [record("missing"), record("other")], accepted: [id, id] });
    const result = await push(f, f.local.records);
    assert.equal(result.status, "error");
    assert.deepEqual(f.pending(), [id, other]);
  });

  test(`${domain}: edits during local ACK persistence remain pending`, async () => {
    const f = fixture(domain, {
      records: [record("missing")], entries: [entry(1)],
      duringLocalAck(local) {
        local.records = [{ ...record("missing"), title: "Edited during ACK" }];
        local.entries.push(entry(2));
      },
    });
    await push(f, [record("missing")]);
    assert.deepEqual(f.local.entries, [entry(2)]);
    assert.deepEqual(f.pending(), [id]);
  });

  test(`${domain}: a forged ACK for another pending record cannot clear either record`, async () => {
    const other = domain === "page" ? "other" : "database:other";
    const f = fixture(domain, { records: [record("missing"), record("other")], accepted: [other] });
    f.enqueue([id, other]);
    const result = await push(f, [record("missing")]);
    assert.equal(result.status, "error");
    assert.deepEqual(f.pending(), [id, other]);
  });

  test(`${domain}: partial ACK clears only the confirmed revision`, async () => {
    const other = domain === "page" ? "other" : "database:other";
    const otherEntry = { logId: 2, ...(domain === "page" ? { pageId: "other" } : { key: other }) };
    const f = fixture(domain, { records: [record("missing"), record("other")],
      entries: [entry(1), otherEntry], accepted: [id],
    });
    const result = await push(f, f.local.records);
    assert.equal(result.status, "error");
    assert.deepEqual(f.pending(), [other]);
    assert.deepEqual(f.local.entries, [otherEntry]);
  });

  test(`${domain}: reconnect retries the latest durable version after network failure`, async () => {
    const f = fixture(domain, { records: [record("missing")], entries: [entry(1)], networkError: true });
    f.enqueue([id]);
    await f.api.flush();
    assert.deepEqual(f.local.entries, [entry(1)]);
    const recovered = fixture(domain, { storage: f.storage, records: [{ ...record("missing"), title: "Offline edit" }], entries: [entry(1), entry(2)] });
    // The online/session probe clears the bounded network backoff before retry.
    recovered.api[domain === "page" ? "recordPageSyncAuthRetryStatus" : "recordDatabaseSyncAuthRetryStatus"]("ok");
    await recovered.api.flush();
    assert.deepEqual(recovered.pending(), []);
    assert.deepEqual(recovered.local.entries, []);
    const sent = recovered.requests[0].pages ?? recovered.requests[0].records;
    assert.equal(sent[0].title, "Offline edit");
  });

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

test("page: cross-tab notifications exclude cloud rows rejected by the pending-edit guard", async () => {
  const f = fixture("page", { entries: [{ logId: 1, pageId: "editing" }],
    cloudRows: [record("editing"), record("clean")],
  });
  const result = await f.api.pullCloudPagesByIds(["editing", "clean"]);
  assert.equal(result.pulled, 1);
  assert.equal(f.events.length, 1);
  assert.deepEqual(Array.from(f.events[0][2], (row) => row.id), ["clean"]);
});
