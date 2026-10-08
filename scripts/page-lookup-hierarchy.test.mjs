// Synthetic-only regression: real page sync/query modules and in-memory SQLite.
// Every request is intercepted; no accounts, browser data, or network are read.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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
const now = "2026-10-08T04:00:00.000Z";

function loader(overrides = {}, globals = {}) {
  const modules = new Map();
  function load(name, parent = path.join(root, "src/entry.ts")) {
    if (name in overrides) return overrides[name];
    if (!name.startsWith("@/") && !name.startsWith(".")) return nativeRequire(name);
    const base = name.startsWith("@/")
      ? path.join(root, "src", name.slice(2))
      : path.resolve(path.dirname(parent), name);
    const file = [base + ".ts", base + ".tsx"].find(existsSync);
    assert.ok(file, `Missing source module: ${name}`);
    const alias = "@/" + path.relative(path.join(root, "src"), file).replace(/\.tsx?$/, "");
    if (alias in overrides) return overrides[alias];
    if (modules.has(file)) return modules.get(file).exports;
    const loadedModule = { exports: {} };
    modules.set(file, loadedModule);
    if (!compiled.has(file)) compiled.set(file, ts.transpileModule(readFileSync(file, "utf8"), {
      fileName: file,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText);
    vm.runInNewContext(compiled.get(file), {
      exports: loadedModule.exports, module: loadedModule,
      require: (dependency) => load(dependency, file),
      Request, Response, URL, TextEncoder, TextDecoder, AbortController, AbortSignal,
      Event, CustomEvent, Date, setTimeout, clearTimeout, console, crypto, ...globals,
    }, { filename: file });
    return loadedModule.exports;
  }
  return load;
}

function record(id, parentId = null, extras = {}) {
  return {
    id, parent_id: parentId, title: `Synthetic ${id}`, icon: null, cover_url: null,
    content_text: `<p>Synthetic body ${id}</p>`, properties: null, position: 0,
    depth: 0, created_at: now, updated_at: now, deleted_at: null, ...extras,
  };
}

function chain() {
  return [record("minutes", "daily", { depth: 2 }),
    record("daily", "root", { depth: 1 }), record("root")];
}

function fixture(t, records = chain(), options = {}) {
  const db = new DatabaseSync(":memory:");
  t.after(() => db.close());
  const storage = new Map();
  const window = new EventTarget();
  window.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  };
  window.setTimeout = setTimeout;
  window.clearTimeout = clearTimeout;
  const controls = {
    accountId: "alpha", gateStatus: "ready", afterRequest: null,
    beforeGetDb: null, responsePages: null, afterQuery: null, beforeRun: null,
  };
  const requests = [];
  const events = [];
  const remote = new Map(records.map((page) => [page.id, page]));
  const adapter = {
    query: (sql, params = []) => {
      const rows = db.prepare(sql).all(...params);
      controls.afterQuery?.(sql, params);
      return rows;
    },
    run: (sql, params = []) => {
      controls.beforeRun?.(sql, params);
      return db.prepare(sql).run(...params);
    },
  };
  const load = loader({
    "@/lib/db/local/client": { getDb: async () => {
      await controls.beforeGetDb?.();
      return adapter;
    } },
    "@/lib/account/accountCloudSyncGate": {
      checkAccountCloudSyncGate: async () => ({ status: controls.gateStatus }),
    },
    "@/lib/account/clientSession": {
      getLastAuthenticatedAccount: () => controls.accountId ? { id: controls.accountId } : null,
      fetchAccountSession: async () => ({
        status: "ok", authenticated: !!controls.accountId,
        account: controls.accountId ? { id: controls.accountId } : null,
      }),
    },
    ...options.overrides,
  }, {
    window,
    fetch: async (url, init) => {
      assert.equal(url, "/api/pages/account-sync", "no external requests permitted");
      assert.equal(init.method, "POST");
      const body = JSON.parse(init.body);
      assert.equal(body.action, "pull", "lookup must never upload");
      assert.ok(Array.isArray(body.ids));
      requests.push({ accountId: controls.accountId, ids: body.ids });
      const pages = controls.responsePages
        ? controls.responsePages(body.ids)
        : body.ids.flatMap((id) => remote.has(id) ? [remote.get(id)] : []);
      await controls.afterRequest?.(body.ids);
      return Response.json({ pages });
    },
    ...options.globals,
  });
  db.exec(load("@/lib/db/local/schema").CREATE_TABLES_SQL);
  db.exec("PRAGMA foreign_keys = ON");
  const owner = load("@/lib/utils/id").DEFAULT_OWNER_ID;
  db.prepare("INSERT INTO users (id, name, created_at, updated_at) VALUES (?, 'Synthetic', ?, ?)")
    .run(owner, now, now);
  const queries = load("@/lib/db/local/queries");
  const sync = load("@/lib/pages/accountPageSync");
  const bus = load("@/lib/pages/pageUpdateBus");
  window.addEventListener(bus.PAGE_LOCAL_UPDATE_EVENT, (event) => events.push(event.detail));
  const rows = () => db.prepare("SELECT * FROM pages ORDER BY id").all().map((row) => ({ ...row }));
  const pending = (id, status = "pending") => db.prepare(
    `INSERT INTO sync_log (table_name, row_id, operation, changed_cols, timestamp, synced, status)
     VALUES ('pages', ?, 'update', '["title","content_text"]', ?, 0, ?)`
  ).run(id, now, status);
  return { db, load, queries, sync, bus, controls, requests, events, remote, storage,
    window, rows, pending, cache: (page = records[0]) => sync.cacheCloudPageWithAncestors(page, "alpha") };
}

test("cold cache: direct minutes lookup loads exact ancestor chain, bodies and hierarchy", async (t) => {
  const f = fixture(t, [...chain(), record("unrelated")]);
  const lookup = await f.sync.fetchCloudPageById("minutes");
  assert.equal(lookup.status, "ok");
  assert.equal(lookup.accountId, "alpha");
  assert.equal(f.rows().length, 0, "fetch alone does not write local cache");
  const page = await f.sync.cacheCloudPageWithAncestors(lookup.pages[0], lookup.accountId);
  assert.equal(page.parent_id, "daily");
  for (const remote of chain()) {
    const local = await f.queries.getPage(remote.id);
    assert.equal(local.parent_id, remote.parent_id);
    assert.equal(local.content_text, remote.content_text);
    assert.equal(local.updated_at, remote.updated_at);
  }
  assert.deepEqual(f.rows().map((row) => row.id), ["daily", "minutes", "root"]);
  assert.deepEqual(f.requests.map((request) => request.ids), [["minutes"], ["daily"], ["root"]]);
  assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM sync_log").get().n, 0);
  assert.equal(f.events.length, 1);
  assert.equal(f.events[0].reason, "cloud-pull");
  assert.equal(f.events[0].count, 3);
  assert.ok(f.events[0].pages.every((event) => event.content_text === null), "events omit bodies");
});

test("existing local ancestors keep their title, body, hierarchy and timestamps", async (t) => {
  const f = fixture(t);
  await f.queries.applyRemotePages([
    record("root", null, { title: "Local root", content_text: "Local root body" }),
    record("daily", "root", { title: "Local day", content_text: "Local day body" }),
  ]);
  const before = f.rows();
  await f.cache();
  assert.deepEqual(f.rows().filter((row) => row.id !== "minutes"), before);
  assert.deepEqual(f.requests.map((request) => request.ids), [["daily"], ["root"]]);
  assert.equal((await f.queries.getPage("minutes")).parent_id, "daily");
});

test("same-version flattened ancestor is repaired without replacing its local body or title", async (t) => {
  const f = fixture(t);
  await f.queries.applyRemotePages([
    record("daily", "root", { title: "Local daily title", content_text: "Local daily body" }),
  ]);
  assert.equal((await f.queries.getPage("daily")).parent_id, null);
  const before = f.rows()[0];
  await f.cache();
  const repaired = { ...f.db.prepare("SELECT * FROM pages WHERE id = 'daily'").get() };
  assert.deepEqual(repaired, { ...before, parent_id: "root", depth: 1 });
  assert.equal((await f.queries.getPage("minutes")).parent_id, "daily");
  assert.equal((await f.queries.getPage("root")).parent_id, null);
  const emitted = f.events.length;
  await f.cache();
  assert.equal(f.events.length, emitted, "a repeated unchanged lookup cannot trigger a refresh loop");
});

for (const variant of ["newer flattened version", "different non-null parent"]) {
  test(`${variant}: preserve the existing hierarchy and reject the complete lookup`, async (t) => {
    const f = fixture(t);
    const local = variant === "newer flattened version"
      ? [record("daily", null, { updated_at: "2026-10-09T04:00:00.000Z" })]
      : [record("local-root"), record("daily", "local-root")];
    await f.queries.applyRemotePages(local);
    const before = f.rows();
    await assert.rejects(f.cache(), /hierarchy/i);
    assert.deepEqual(f.rows(), before);
    assert.equal(f.events.length, 0);
  });
}

for (const id of ["minutes", "daily", "root"]) {
  for (const status of ["pending", "in_flight", "failed"]) {
    test(`pending protection: ${id} in ${status} survives with zero partial writes`, async (t) => {
      const f = fixture(t);
      await f.queries.applyRemotePages(chain().map((page) => ({ ...page, content_text: `Unsent ${page.id}` })));
      f.pending(id, status);
      const before = f.rows();
      await assert.rejects(f.cache(), /pending/i);
      assert.deepEqual(f.rows(), before);
      assert.equal(f.events.length, 0);
      assert.equal(f.db.prepare("SELECT synced FROM sync_log WHERE row_id = ?").get(id).synced, 0);
    });
  }
}

test("pending push storage also protects a missing ancestor without creating any page", async (t) => {
  const f = fixture(t);
  f.storage.set("zhinote.pagesync.pendingPushIds", JSON.stringify(["daily"]));
  await assert.rejects(f.cache(), /pending/i);
  assert.deepEqual(f.rows(), []);
});

for (const [name, records] of [
  ["missing parent", [record("minutes", "missing")]],
  ["cycle", [record("minutes", "daily"), record("daily", "root"), record("root", "minutes")]],
  ["self cycle", [record("minutes", "minutes")]],
  ["deleted parent", [record("minutes", "daily"), record("daily", null, { deleted_at: now })]],
  ["depth greater than 64", Array.from({ length: 66 }, (_, i) => record(`page-${i}`, i === 65 ? null : `page-${i + 1}`))],
]) {
  test(`${name}: reject before write; never silently create a root page`, async (t) => {
    const f = fixture(t, records);
    await assert.rejects(f.cache(), /hierarchy|parent/i);
    assert.deepEqual(f.rows(), []);
    assert.equal(f.events.length, 0);
  });
}

test("incomplete chain preserves an already cached target instead of reparenting it", async (t) => {
  const f = fixture(t, [record("minutes", "missing")]);
  await f.queries.applyRemotePages([record("local-root"), record("minutes", "local-root", { content_text: "Original" })]);
  const before = f.rows();
  await assert.rejects(f.cache(), /hierarchy/i);
  assert.deepEqual(f.rows(), before);
});

test("account changed before ancestor request: no request, cache write, or event", async (t) => {
  const f = fixture(t);
  f.controls.accountId = "beta";
  await assert.rejects(f.cache(), /account/i);
  assert.equal(f.requests.length, 0);
  assert.deepEqual(f.rows(), []);
  assert.equal(f.events.length, 0);
});

test("account changed while ancestor request is in flight: no write", async (t) => {
  const f = fixture(t);
  f.controls.afterRequest = () => { f.controls.accountId = "beta"; };
  await assert.rejects(f.cache(), /account/i);
  assert.equal(f.requests.length, 1);
  assert.deepEqual(f.rows(), []);
});

test("account changed while the local cache is being read: no write", async (t) => {
  const f = fixture(t, [record("minutes")]);
  f.controls.beforeGetDb = () => { f.controls.accountId = "beta"; };
  await assert.rejects(f.cache(), /account/i);
  assert.deepEqual(f.rows(), []);
});

test("query account guard rechecks after SQLite opens, immediately before writes", async (t) => {
  const f = fixture(t);
  f.controls.beforeGetDb = () => { f.controls.accountId = "beta"; };
  await assert.rejects(f.queries.applyRemotePages(chain(), {
    isCurrent: () => f.controls.accountId === "alpha",
    isProtected: () => false,
    requiredParentIds: ["daily", "root"],
  }), /account/i);
  assert.deepEqual(f.rows(), []);
});

test("ancestor populated by a newer background pull cannot be overwritten by the older lookup", async (t) => {
  const f = fixture(t);
  await f.queries.applyRemotePages([record("root")]);
  let concurrentSnapshot;
  f.controls.afterRequest = async (ids) => {
    if (!ids.includes("root")) return;
    // daily was absent when observed, then fetched as T1; while its parent is
    // loading, an independent background pull has already installed T2.
    await f.queries.applyRemotePages([
      record("daily", "root", {
        content_text: "Newer background body", updated_at: "2026-10-09T04:00:00.000Z",
      }),
    ]);
    concurrentSnapshot = f.rows();
  };
  await assert.rejects(f.cache(), /changed/i);
  assert.ok(concurrentSnapshot, "the concurrent background write actually ran");
  assert.deepEqual(f.rows(), concurrentSnapshot);
  assert.equal(await f.queries.getPage("minutes"), null);
  assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM sync_log").get().n, 0);
  assert.equal(f.events.length, 0);
});

for (const change of ["new insertion", "newer version", "synced deletion"]) {
  test(`target ${change} during final database await survives without pending markers`, async (t) => {
    const f = fixture(t, [record("minutes")]);
    if (change !== "new insertion") await f.queries.applyRemotePages([record("minutes")]);
    let concurrentSnapshot;
    f.controls.afterQuery = (sql, params) => {
      if (!sql.includes("FROM pages") || !params.includes("minutes")) return;
      f.controls.afterQuery = null;
      // Schedule T2 after the helper has captured T1/absence, at the next
      // database-open await immediately before guarded persistence.
      f.controls.beforeGetDb = async () => {
        f.controls.beforeGetDb = null;
        await f.queries.applyRemotePages([record("minutes", null, {
          content_text: "Concurrent target body",
          updated_at: "2026-10-09T04:00:00.000Z",
          deleted_at: change === "synced deletion" ? "2026-10-09T04:00:00.000Z" : null,
        })]);
        concurrentSnapshot = f.rows();
      };
    };
    await assert.rejects(f.cache(), /changed/i);
    assert.ok(concurrentSnapshot, "the concurrent target write actually ran");
    assert.deepEqual(f.rows(), concurrentSnapshot);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM sync_log").get().n, 0);
    assert.equal(f.events.length, 0);
  });
}

for (const operation of ["INSERT", "UPDATE"]) {
  test(`guarded lookup rolls back every change when the second ${operation} fails`, async (t) => {
    const f = fixture(t);
    await f.queries.applyRemotePages([
      record("existing", null, { content_text: "Existing unrelated body" }),
      ...(operation === "UPDATE" ? [record("minutes", null, { content_text: "Original target body" })] : []),
    ]);
    const before = f.rows();
    let writeCount = 0;
    f.controls.beforeRun = (sql) => {
      if (new RegExp(`^\\s*${operation}\\s+(?:INTO\\s+)?pages\\b`, "i").test(sql) && ++writeCount === 2) {
        throw new Error("Synthetic second write failure");
      }
    };
    await assert.rejects(f.cache(), /Synthetic second write failure/);
    assert.equal(writeCount, 2, "injection happened after an earlier successful write");
    assert.deepEqual(f.rows(), before, "no empty roots, partial bodies, or overwritten records survive");
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM sync_log").get().n, 0);
    assert.equal(f.events.length, 0);
    // A subsequent lookup can still commit after the failed savepoint closes.
    f.controls.beforeRun = null;
    assert.equal((await f.cache()).parent_id, "daily");
  });
}

for (const parentState of ["missing", "deleted locally"]) {
  test(`tombstone with ${parentState} ancestor applies without fetching that ancestor`, async (t) => {
    const tombstone = record("minutes", "daily", { deleted_at: now });
    const f = fixture(t, [tombstone]);
    const previous = parentState === "missing"
      ? [record("minutes")]
      : [record("daily", null, { deleted_at: now }), record("minutes", "daily")];
    await f.queries.applyRemotePages(previous);
    assert.equal(await f.cache(tombstone), null);
    assert.equal(await f.queries.getPage("minutes"), null);
    assert.equal(f.db.prepare("SELECT deleted_at FROM pages WHERE id = 'minutes'").get().deleted_at, now);
    assert.equal(f.requests.length, 0);
    assert.equal(f.events.length, 1);
  });
}

test("tombstone cannot overwrite a pending target even when the old parent is absent", async (t) => {
  const tombstone = record("minutes", "daily", { deleted_at: now });
  const f = fixture(t, [tombstone]);
  await f.queries.applyRemotePages([record("minutes", null, { content_text: "Unsent local body" })]);
  f.pending("minutes", "failed");
  const before = f.rows();
  await assert.rejects(f.cache(tombstone), /pending/i);
  assert.deepEqual(f.rows(), before);
  assert.equal(f.requests.length, 0);
  assert.equal(f.events.length, 0);
});

for (const [name, overrides] of [
  ["non-string parent", { parent_id: 123 }],
  ["missing body", { content_text: undefined }],
  ["non-finite depth", { depth: Infinity }],
]) {
  test(`invalid target (${name}) is rejected without partial writes`, async (t) => {
    const f = fixture(t);
    await assert.rejects(f.cache(record("minutes", "daily", overrides)), /invalid/i);
    assert.deepEqual(f.rows(), []);
    assert.equal(f.requests.length, 0);
  });
}

test("incomplete ancestor record is rejected before cache insertion", async (t) => {
  const f = fixture(t);
  f.controls.responsePages = () => [{ id: "daily", parent_id: null }];
  await assert.rejects(f.cache(), /hierarchy/i);
  assert.deepEqual(f.rows(), []);
  assert.equal(f.events.length, 0);
});

test("lookup cache is scoped by account, and a switched in-flight result is discarded", async (t) => {
  const f = fixture(t, [record("minutes")]);
  const first = await f.sync.fetchCloudPageById("minutes");
  assert.equal(first.accountId, "alpha");
  f.controls.accountId = "beta";
  f.remote.set("minutes", record("minutes", null, { title: "Beta page" }));
  const second = await f.sync.fetchCloudPageById("minutes");
  assert.equal(second.accountId, "beta");
  assert.equal(second.pages[0].title, "Beta page");
  assert.equal(f.requests.length, 2);
  f.remote.set("other", record("other"));
  f.controls.afterRequest = () => { f.controls.accountId = "gamma"; };
  const switched = await f.sync.fetchCloudPageById("other");
  assert.equal(switched.status, "unconfirmed");
  assert.equal(switched.pages.length, 0);
  assert.deepEqual(f.rows(), []);
});

test("query guard rejects missing parents, protected ids, and late pending before any writes", async (t) => {
  const f = fixture(t);
  const guards = { isCurrent: () => true, isProtected: () => false, requiredParentIds: ["daily"] };
  await assert.rejects(f.queries.applyRemotePages([record("minutes", "daily")], guards), /hierarchy/i);
  await assert.rejects(f.queries.applyRemotePages(chain(), { ...guards, isProtected: (id) => id === "root" }), /pending/i);
  f.controls.beforeGetDb = () => {
    f.controls.beforeGetDb = null;
    f.pending("root");
  };
  await assert.rejects(f.queries.applyRemotePages(chain(), guards), /pending/i);
  assert.deepEqual(f.rows(), []);
});

test("unguarded existing bulk pull contract retains missing-parent and pending behavior", async (t) => {
  const f = fixture(t);
  await f.queries.applyRemotePages([record("orphan", "not-fetched")]);
  assert.equal((await f.queries.getPage("orphan")).parent_id, null);
  f.pending("orphan");
  const applied = await f.queries.applyRemotePages([record("orphan", null, { content_text: "Remote replacement" }), record("clean")]);
  assert.deepEqual(Array.from(applied, (page) => page.id), ["clean"]);
  assert.equal((await f.queries.getPage("orphan")).content_text, record("orphan").content_text);
});

function hookHarness() {
  const effects = [], updates = [];
  let notify = null;
  return {
    effects, updates,
    react: {
      useRef: (value) => ({ current: value }),
      useState: (value) => [value, (next) => {
        if (Array.isArray(next)) { updates.push(next); notify?.(); }
      }],
      useEffect: (effect) => effects.push(effect),
    },
    nextUpdate: () => new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { notify = null; reject(new Error("Breadcrumb did not refresh")); }, 1000);
      notify = () => { clearTimeout(timeout); notify = null; resolve(); };
    }),
  };
}

test("breadcrumb reloads same-tab cached parents and body-independent ancestor renames", async (t) => {
  const hooks = hookHarness();
  const f = fixture(t, chain(), { overrides: {
    react: hooks.react,
    "@/hooks/useLocalFirstPageNavigation": { useLocalFirstPageNavigation: () => () => {} },
  } });
  // Reproduce an old cache row whose missing parent was previously lost.
  await f.queries.applyRemotePages([record("minutes", "daily")]);
  const Breadcrumb = f.load("@/components/shared/Breadcrumb").default;
  Breadcrumb({ pageId: "minutes" });
  const initial = hooks.nextUpdate();
  const cleanups = hooks.effects.map((effect) => effect()).filter(Boolean);
  t.after(() => cleanups.forEach((cleanup) => cleanup()));
  await initial;
  assert.deepEqual(Array.from(hooks.updates.at(-1), (page) => page.id), ["minutes"]);
  const refreshed = hooks.nextUpdate();
  await f.cache();
  await refreshed;
  assert.deepEqual(Array.from(hooks.updates.at(-1), (page) => page.id), ["root", "daily", "minutes"]);
  const renamed = hooks.nextUpdate();
  f.db.prepare("UPDATE pages SET title = 'Renamed ancestor' WHERE id = 'root'").run();
  f.bus.emitPagesUpdated("local-refresh", 1, [{ ...record("root"), content_text: null }]);
  await renamed;
  assert.equal(hooks.updates.at(-1)[0].title, "Renamed ancestor");
});

// Extract the unchanged function declarations through the TypeScript AST so
// these tests execute usePage's real fallback without mounting its editor.
function loadPageLookupFallback(f, options = {}) {
  const file = path.join(root, "src/hooks/usePage.ts");
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.ES2022, true);
  const names = ["applyCloudPageLookup", "remoteRecordToPage", "remoteIsAtLeastAsFresh"];
  const selected = source.statements.filter((node) => ts.isFunctionDeclaration(node) && names.includes(node.name?.text));
  assert.equal(selected.length, names.length, "fallback functions must still exist in usePage");
  const code = selected.map((node) => node.getText(source)).join("\n") + "\nexports.apply = applyCloudPageLookup;";
  const result = {};
  vm.runInNewContext(ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports: result, DEFAULT_OWNER_ID: "solo-user",
    loadPageAccountSyncModule: async () => f.sync,
    getPagesForSyncByIds: f.queries.getPagesForSyncByIds,
    getPendingPageSyncRecords: f.queries.getPendingPageSyncRecords,
    readPendingPageDraft: options.readPendingPageDraft ?? (() => null),
    clearPendingPageDraft: options.clearPendingPageDraft ?? (() => assert.fail("fallback must keep the pending draft")),
    clearPageRouteHandoff: options.clearPageRouteHandoff ?? (() => assert.fail("fallback must keep the route handoff")),
    require: (name) => {
      assert.equal(name, "@/lib/account/clientSession");
      return { getLastAuthenticatedAccount: () => ({ id: f.controls.accountId }) };
    },
    queueCloudPagePushWithAccountSync: () => { throw new Error("fallback must not upload"); },
  }, { filename: file });
  return result.apply;
}

for (const condition of ["missing ancestor", "pending ancestor"]) {
  for (const hasLocal of [false, true]) {
    test(`usePage fallback: ${condition}, ${hasLocal ? "keep local body" : "show cloud body without caching"}`, async (t) => {
      const f = fixture(t);
      if (condition === "missing ancestor") f.remote.delete("daily");
      else f.pending("daily");
      if (hasLocal) await f.queries.applyRemotePages([record("minutes", null, { content_text: "Local body must survive" })]);
      const local = await f.queries.getPage("minutes");
      const before = f.rows();
      const shown = [], upserted = [];
      const applied = await loadPageLookupFallback(f)(
        { status: "ok", pages: [chain()[0]], accountId: "alpha" }, local,
        (page) => shown.push(page), (pages) => upserted.push(...pages),
      );
      assert.equal(applied, true);
      assert.equal(shown.length, 1);
      assert.equal(shown[0].content_text, hasLocal ? "Local body must survive" : chain()[0].content_text);
      assert.equal(shown[0].parent_id, hasLocal ? null : "daily");
      assert.equal(upserted.length, 0, "a display-only fallback must not update the workspace cache");
      assert.deepEqual(f.rows(), before);
      assert.equal(f.events.length, 0, "blocked caching must not emit a successful download");
    });
  }
}

for (const condition of ["missing ancestor", "pending ancestor"]) {
  for (const body of [null, ""]) {
    test(`usePage fallback: ${condition}, ${body === null ? "metadata-only cache displays same-version cloud body" : "intentional empty local body stays empty"}`, async (t) => {
      const f = fixture(t);
      if (condition === "missing ancestor") f.remote.delete("daily");
      else f.pending("daily");
      await f.queries.applyRemotePages([record("minutes", null, { content_text: body })]);
      const local = await f.queries.getPage("minutes");
      const before = f.rows();
      const shown = [], upserted = [];
      const applied = await loadPageLookupFallback(f)(
        { status: "ok", pages: [chain()[0]], accountId: "alpha" }, local,
        (page) => shown.push(page), (pages) => upserted.push(...pages), () => local,
      );
      assert.equal(applied, true);
      assert.equal(shown.length, 1);
      assert.equal(shown[0].content_text, body === null ? chain()[0].content_text : "");
      assert.equal(upserted.length, 0, "display-only body must not enter the workspace cache");
      assert.deepEqual(f.rows(), before, "metadata-only SQLite cache stays untouched on blocked hierarchy");
      assert.equal(f.events.length, 0, "displaying a cloud body is not a persisted-download receipt");
    });
  }

  test(`usePage fallback: ${condition}, newer local metadata cannot accept an older cloud body`, async (t) => {
    const f = fixture(t);
    if (condition === "missing ancestor") f.remote.delete("daily");
    else f.pending("daily");
    await f.queries.applyRemotePages([record("minutes", null, { content_text: null })]);
    const local = await f.queries.getPage("minutes");
    let updatedSnapshot;
    f.controls.afterRequest = async () => {
      f.controls.afterRequest = null;
      await f.queries.applyRemotePages([record("minutes", null, {
        content_text: null, title: "Newer metadata version", updated_at: "2026-10-09T04:00:00.000Z",
      })]);
      updatedSnapshot = f.rows();
    };
    const shown = [], upserted = [];
    const applied = await loadPageLookupFallback(f)(
      { status: "ok", pages: [chain()[0]], accountId: "alpha" }, local,
      (page) => shown.push(page), (pages) => upserted.push(...pages), () => local,
    );
    assert.equal(applied, true);
    assert.ok(updatedSnapshot, "the metadata version actually changed during ancestor loading");
    assert.equal(shown.length, 1);
    assert.equal(shown[0].content_text, null, "an older cloud body cannot be grafted onto newer metadata");
    assert.equal(shown[0].updated_at, "2026-10-09T04:00:00.000Z");
    assert.equal(upserted.length, 0);
    assert.deepEqual(f.rows(), updatedSnapshot);
    assert.equal(f.events.length, 0);
  });

  test(`usePage fallback: ${condition}, pending target draft outranks metadata and cloud body`, async (t) => {
    const f = fixture(t);
    if (condition === "missing ancestor") f.remote.delete("daily");
    else f.pending("daily");
    await f.queries.applyRemotePages([record("minutes", null, { content_text: null })]);
    f.pending("minutes");
    const local = await f.queries.getPage("minutes");
    const draft = { ...local, content_text: "Unsent target draft must remain visible" };
    const before = f.rows();
    const shown = [], upserted = [];
    const applied = await loadPageLookupFallback(f, {
      readPendingPageDraft: (id) => id === "minutes" ? draft : null,
    })(
      { status: "ok", pages: [chain()[0]], accountId: "alpha" }, local,
      (page) => shown.push(page), (pages) => upserted.push(...pages), () => local,
    );
    assert.equal(applied, true);
    assert.equal(shown.length, 1);
    assert.equal(shown[0].content_text, draft.content_text);
    assert.equal(upserted.length, 0);
    assert.deepEqual(f.rows(), before);
    assert.equal(f.events.length, 0);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS count FROM sync_log WHERE row_id = 'minutes' AND synced = 0").get().count, 1);
  });

  for (const protection of ["target sync log", "target push queue", "local Yjs body"]) {
    test(`usePage fallback: ${condition}, ${protection} prevents borrowing a cloud body`, async (t) => {
      const f = fixture(t);
      if (condition === "missing ancestor") f.remote.delete("daily");
      else f.pending("daily");
      await f.queries.applyRemotePages([record("minutes", null, { content_text: null })]);
      if (protection === "target sync log") f.pending("minutes");
      if (protection === "target push queue") {
        f.storage.set("zhinote.pagesync.pendingPushIds", JSON.stringify(["minutes"]));
      }
      if (protection === "local Yjs body") {
        f.db.prepare("UPDATE pages SET content_yjs = ? WHERE id = 'minutes'")
          .run(new Uint8Array([1, 2, 3]));
      }
      const local = await f.queries.getPage("minutes");
      const before = f.rows();
      const shown = [], upserted = [];
      const applied = await loadPageLookupFallback(f)(
        { status: "ok", pages: [chain()[0]], accountId: "alpha" }, local,
        (page) => shown.push(page), (pages) => upserted.push(...pages), () => local,
      );
      assert.equal(applied, true);
      assert.equal(shown.length, 1);
      assert.equal(shown[0].content_text, null, "local pending or Yjs content is not a blank placeholder");
      if (protection === "local Yjs body") assert.deepEqual(shown[0].content_yjs, local.content_yjs);
      assert.equal(upserted.length, 0);
      assert.deepEqual(f.rows(), before);
      assert.equal(f.events.length, 0);
    });
  }
}

test("usePage fallback discards an old account's page instead of displaying it", async (t) => {
  const f = fixture(t);
  f.controls.afterRequest = () => { f.controls.accountId = "beta"; };
  const shown = [], upserted = [];
  const applied = await loadPageLookupFallback(f)(
    { status: "ok", pages: [chain()[0]], accountId: "alpha" }, null,
    (page) => shown.push(page), (pages) => upserted.push(...pages),
  );
  assert.equal(applied, false);
  assert.equal(shown.length, 0);
  assert.equal(upserted.length, 0);
  assert.deepEqual(f.rows(), []);
  assert.equal(f.events.length, 0);
});

for (const change of ["new local edit", "synced deletion"]) {
  test(`usePage fallback re-reads ${change} made while ancestors load`, async (t) => {
    const f = fixture(t);
    await f.queries.applyRemotePages([record("minutes", null, { content_text: "Old visible body" })]);
    const local = await f.queries.getPage("minutes");
    let concurrentSnapshot;
    f.controls.afterRequest = async () => {
      f.controls.afterRequest = null;
      await f.queries.applyRemotePages([record("minutes", null, {
        content_text: "New local body made during request",
        updated_at: "2026-10-09T04:00:00.000Z",
        deleted_at: change === "synced deletion" ? "2026-10-09T04:00:00.000Z" : null,
      })]);
      if (change === "new local edit") f.pending("minutes");
      concurrentSnapshot = f.rows();
    };
    const shown = [], upserted = [];
    const applied = await loadPageLookupFallback(f)(
      { status: "ok", pages: [chain()[0]], accountId: "alpha" }, local,
      (page) => shown.push(page), (pages) => upserted.push(...pages), () => local,
    );
    assert.equal(applied, true);
    assert.ok(concurrentSnapshot, "the concurrent change actually occurred");
    assert.equal(shown.length, 1);
    if (change === "synced deletion") assert.equal(shown[0], null);
    else assert.equal(shown[0].content_text, "New local body made during request");
    assert.equal(upserted.length, 0);
    assert.deepEqual(f.rows(), concurrentSnapshot);
    assert.equal(f.events.length, 0);
  });
}

test("usePage fallback keeps the newest visible optimistic edit and leaves drafts untouched", async (t) => {
  const f = fixture(t);
  f.remote.delete("daily");
  await f.queries.applyRemotePages([record("minutes", null, { content_text: "Old stored body" })]);
  const local = await f.queries.getPage("minutes");
  const before = f.rows();
  let visible = local;
  f.controls.afterRequest = () => {
    visible = { ...local, content_text: "Current unsaved optimistic body", updated_at: "2026-10-09T04:00:00.000Z" };
  };
  const shown = [], upserted = [];
  const applied = await loadPageLookupFallback(f)(
    { status: "ok", pages: [chain()[0]], accountId: "alpha" }, local,
    (page) => shown.push(page), (pages) => upserted.push(...pages), () => visible,
  );
  assert.equal(applied, true);
  assert.equal(shown.length, 1);
  assert.equal(shown[0], visible);
  assert.equal(shown[0].content_text, "Current unsaved optimistic body");
  assert.equal(upserted.length, 0);
  assert.deepEqual(f.rows(), before);
  assert.equal(f.events.length, 0);
});

test("usePage successful cache clears the draft and handoff only after persistence", async (t) => {
  const f = fixture(t);
  const cleared = [], shown = [], upserted = [];
  const recordClear = (kind, id) => {
    assert.equal(f.db.prepare("SELECT parent_id FROM pages WHERE id = ?").get(id).parent_id, "daily");
    cleared.push([kind, id]);
  };
  const applied = await loadPageLookupFallback(f, {
    clearPendingPageDraft: (id) => recordClear("draft", id),
    clearPageRouteHandoff: (id) => recordClear("handoff", id),
  })(
    { status: "ok", pages: [chain()[0]], accountId: "alpha" }, null,
    (page) => shown.push(page), (pages) => upserted.push(...pages),
  );
  assert.equal(applied, true);
  assert.deepEqual(cleared, [["draft", "minutes"], ["handoff", "minutes"]]);
  assert.equal(shown[0].parent_id, "daily");
  assert.equal(upserted.length, 1);
  assert.equal(f.events.length, 1);
});
