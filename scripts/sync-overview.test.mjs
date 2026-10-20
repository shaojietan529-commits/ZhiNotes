import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { test } from "node:test";
import ts from "typescript";

const root = new URL("../", import.meta.url).pathname;
function load(name, parent = path.join(root, "src/entry.ts")) {
  const file = (name.startsWith("@/") ? path.join(root, "src", name.slice(2)) : path.resolve(path.dirname(parent), name)) + ".ts";
  const loaded = { exports: {} };
  const code = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { module: loaded, exports: loaded.exports, require: (value) => load(value, file) });
  return loaded.exports;
}
const { describeSyncDomain, buildSyncOverview } = load("@/lib/sync/syncOverview");
const { pendingEntityCount } = load("@/lib/sync/pendingEntityCount");
const base = { id: "pages", label: "Pages", pending: 0, failed: 0, manualReview: 0, enabled: true, known: true };

test("queue layers are overlapping, not three independent uploads", () => {
  assert.equal(pendingEntityCount({ pending: 50, queued: 50, syncLogPending: 50, uniquePending: 50 }), 50);
  assert.equal(pendingEntityCount({ pending: 3, queued: 2, syncLogPending: 4 }), 7);
});
test("empty queue without a cloud acknowledgement never claims cloud persistence", () => {
  assert.equal(describeSyncDomain(base, true).state, "idle");
  assert.equal(describeSyncDomain({ ...base, known: false }, true).state, "checking");
  assert.equal(describeSyncDomain({ ...base, lastConfirmedAt: "2026-10-20T00:00:00Z" }, true).state, "synced");
});
test("ordinary backlog is not an error; failure and manual review are subsets", () => {
  assert.equal(describeSyncDomain({ ...base, pending: 50 }, true).state, "queued");
  const result = buildSyncOverview([{ ...base, pending: 50, failed: 4, manualReview: 2 }], true);
  assert.equal(result.pending, 50);
  assert.equal(result.state, "attention");
});
test("offline, expired session, uncertain auth, unconfigured service are distinct", () => {
  assert.equal(describeSyncDomain({ ...base, pending: 3 }, false).state, "offline");
  assert.equal(describeSyncDomain({ ...base, auth: "unauthenticated" }, true).state, "signed-out");
  assert.equal(describeSyncDomain({ ...base, auth: "unconfirmed" }, true).state, "checking");
  assert.equal(describeSyncDomain({ ...base, auth: "unconfigured" }, true).state, "attention");
});
test("unused domains are neutral; disabled domains with unsent work remain visible", () => {
  assert.equal(describeSyncDomain({ ...base, enabled: false }, true).state, "disabled");
  assert.equal(describeSyncDomain({ ...base, enabled: false, pending: 1 }, true).state, "attention");
});
test("read errors and unresolved conflicts cannot be hidden by empty counts or offline", () => {
  const result = buildSyncOverview([{ ...base, readError: true }], true);
  assert.equal(result.state, "attention");
  assert.equal(result.countsKnown, false);
  assert.equal(describeSyncDomain({ ...base, manualReview: 1 }, false).state, "attention");
});
test("failure explanations categorize errors without exposing raw messages", () => {
  const row = describeSyncDomain({ ...base, failed: 1, failureMessage: "403 private-user-content" }, true);
  assert.match(row.detail, /权限/);
  assert.ok(!JSON.stringify(row).includes("private-user-content"));
});
test("reports use the same deduplicated count and retain unclassified sync-log work", () => {
  const report = load("@/lib/sync/cloudUploadReliabilityReport").buildCloudUploadReliabilityReport({
    pageStatus: { ...base, pending: 50, queued: 50, syncLogPending: 50, uniquePending: 50, manualReviewCount: 0 },
    databaseStatus: { ...base, queued: 0, syncLogPending: 0, uniquePending: 0, manualReviewCount: 0 },
    fileStatus: { ...base, manualReviewCount: 0 },
    syncSummary: { pending: 53, failed: 0, manualReview: 0 },
    workspaceIdentity: null,
  });
  assert.equal(report.summary.page_waiting_rows, 50);
  assert.equal(report.summary.sync_log_pending_rows, 3);
  assert.equal(report.summary.total_waiting_rows, 53);
});
test("advanced domain rows deduplicate core entities without hiding other page tables", () => {
  const empty = { pending: 0, queued: 0, failed: 0, manualReviewCount: 0, syncLogPending: 0, uniquePending: 0 };
  const table = (tableName, pending) => ({ tableName, pending, total: pending, failed: 0, manualReview: 0, inFlight: 0, lastChangeAt: null });
  const rows = load("@/lib/sync/syncPendingDomainRegistry").buildPendingDomainRows(
    { tables: [table("pages", 100), table("daily_imports", 3)] },
    { ...empty, pending: 50, queued: 50, syncLogPending: 100, uniquePending: 50 },
    empty, empty
  );
  assert.equal(rows.find((row) => row.id === "pages").pending, 53);
});
test("normal sync view shares its coordinator and keeps destructive actions out", () => {
  const source = readFileSync(path.join(root, "src/components/modules/SyncCenterShell.tsx"), "utf8");
  assert.match(source, /<Sidebar accountSync=\{sync\}/);
  assert.match(source, /advanced \? <AdvancedDiagnostics/);
  assert.match(source, /includeFileSync: false, includeManualReview: false/);
  assert.doesNotMatch(source, /localStorage\.clear|includeManualReview: true|forceLease: true|sampleRowIds/);
});
