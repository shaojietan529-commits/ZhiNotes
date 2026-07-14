#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const root = process.cwd();
const sourcePath = "src/lib/sync/syncPendingDomainRegistry.ts";
const source = readFileSync(path.join(root, sourcePath), "utf8");
const failures = [];

const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    isolatedModules: true,
  },
  fileName: sourcePath,
}).outputText;

const cjsModule = { exports: {} };
const sandbox = {
  exports: cjsModule.exports,
  module: cjsModule,
  require(id) {
    throw new Error(`Unexpected runtime import from registry verifier: ${id}`);
  },
};
vm.runInNewContext(output, sandbox, { filename: sourcePath });

const {
  PENDING_DOMAIN_DEFINITIONS,
  buildPendingDomainRows,
  getPendingDomainCatalog,
  summarizeSyncSummaryTables,
} = cjsModule.exports;

check(
  Array.isArray(PENDING_DOMAIN_DEFINITIONS) &&
    PENDING_DOMAIN_DEFINITIONS.length === 8,
  "registry should expose the eight stable cloud-master pending domains"
);

for (const id of [
  "pages",
  "databases",
  "comments",
  "versions",
  "files",
  "settings",
  "permissions",
  "audit",
]) {
  check(
    PENDING_DOMAIN_DEFINITIONS.some((definition) => definition.id === id),
    `registry missing domain ${id}`
  );
}

const catalog = getPendingDomainCatalog();
check(
  Array.isArray(catalog) && catalog.length === PENDING_DOMAIN_DEFINITIONS.length,
  "registry should expose a stable pending-domain catalog for health checks"
);
check(
  catalog.every(
    (item) =>
      typeof item.id === "string" &&
      typeof item.label === "string" &&
      typeof item.detail === "string" &&
      Array.isArray(item.tableNames) &&
      Array.isArray(item.tablePrefixes)
  ),
  "pending-domain catalog items should expose id, label, detail, tableNames, and tablePrefixes"
);
check(
  catalog.some(
    (item) =>
      item.id === "pages" &&
      item.tableNames.includes("pages") &&
      item.tablePrefixes.includes("daily_")
  ),
  "pending-domain catalog should include page and daily-note metadata"
);
check(
  catalog.some(
    (item) =>
      item.id === "settings" &&
      item.tableNames.includes("sidebar_items") &&
      item.tablePrefixes.includes("sidebar_")
  ),
  "pending-domain catalog should include sidebar/module settings metadata"
);

const catalogPages = catalog.find((item) => item.id === "pages");
catalogPages?.tableNames.push("mutated_by_verifier");
check(
  !PENDING_DOMAIN_DEFINITIONS.find((item) => item.id === "pages")?.tableNames.includes(
    "mutated_by_verifier"
  ),
  "pending-domain catalog should return copied arrays, not mutable registry internals"
);

const syncSummary = {
  tables: [
    table("pages", 2, 0, 1, 0, "2026-07-01T00:00:00.000Z"),
    table("database_rows", 1, 1, 0, 0, "2026-07-02T00:00:00.000Z"),
    table("page_comments", 0, 0, 0, 1, "2026-07-03T00:00:00.000Z"),
    table("workspace_settings", 1, 0, 0, 0, "2026-07-04T00:00:00.000Z"),
    table("custom_signal", 4, 0, 0, 0, "2026-07-05T00:00:00.000Z"),
  ],
  pending: 8,
  failed: 1,
  inFlight: 1,
  manualReview: 1,
  total: 11,
};

const rows = buildPendingDomainRows(
  syncSummary,
  {
    pending: 3,
    queued: 2,
    failed: 1,
    manualReviewCount: 1,
    lastFailureAt: "2026-07-06T00:00:00.000Z",
    oldestPendingQueuedAt: "2026-07-01T00:00:00.000Z",
    lastAttemptAt: "2026-07-05T00:00:00.000Z",
    lastSyncAt: "2026-07-04T00:00:00.000Z",
  },
  {
    pending: 1,
    queued: 3,
    syncLogPending: 2,
    failed: 0,
    manualReviewCount: 2,
    lastFailureAt: null,
    oldestPendingQueuedAt: "2026-07-02T00:00:00.000Z",
    lastAttemptAt: "2026-07-07T00:00:00.000Z",
    lastSyncAt: "2026-07-01T00:00:00.000Z",
  },
  {
    pending: 5,
    failed: 1,
    manualReviewCount: 0,
    lastFailureAt: null,
    oldestPendingQueuedAt: "2026-07-08T00:00:00.000Z",
    lastAttemptAt: "2026-07-09T00:00:00.000Z",
  }
);

const rowById = new Map(rows.map((row) => [row.id, row]));
const pageRow = rowById.get("pages");
const databaseRow = rowById.get("databases");
const commentRow = rowById.get("comments");
const fileRow = rowById.get("files");
const settingsRow = rowById.get("settings");
const versionsRow = rowById.get("versions");
const otherRow = rowById.get("other");

check(rows[0]?.id === "databases", "largest pending core queue should sort first");
check(pageRow?.pending === 5, "page row should merge page pending + queued");
check(pageRow?.failed === 1, "page row should preserve page failures");
check(
  pageRow?.manualReview === 1 &&
    pageRow?.nextAction.includes("人工复核包"),
  "page manual-review rows should ask for a review packet"
);
check(
  pageRow?.tableNames.includes("pending_page_cloud_push"),
  "page row should expose pending_page_cloud_push as a core fallback table"
);

check(
  databaseRow?.pending === 6 && databaseRow?.manualReview === 2,
  "database row should merge pending, queued, sync_log pending, and manual review"
);
check(
  databaseRow?.tableNames.includes("pending_database_cloud_push") &&
    databaseRow?.tableNames.includes("database_sync_log"),
  "database row should expose database fallback tables"
);

check(
  commentRow?.manualReview === 1 &&
    commentRow?.tableNames.includes("page_comments"),
  "comment row should aggregate page_comments manual-review rows"
);
check(
  settingsRow?.pending === 1 &&
    settingsRow?.tableNames.includes("workspace_settings"),
  "settings row should include workspace_settings pending rows"
);
check(
  fileRow?.pending === 5 &&
    fileRow?.failed === 1 &&
    fileRow?.tableNames.includes("file_embed_sync_queue"),
  "file row should merge file embed queue status"
);
check(
  fileRow?.nextAction.includes("补传待上传"),
  "failed file rows should ask the user to retry pending uploads"
);
check(
  otherRow?.pending === 4 &&
    otherRow?.tableNames.includes("custom_signal") &&
    otherRow?.nextAction.includes("等待后台补传"),
  "unmatched tables should stay visible as other local tables"
);
check(
  versionsRow?.total === 0 && versionsRow?.nextAction === "当前无需处理。",
  "inactive domains should remain visible with a no-op next action"
);

const settingsSummary = summarizeSyncSummaryTables(syncSummary, [
  "workspace_settings",
]);
check(
  settingsSummary.pending === 1 &&
    settingsSummary.total === 1 &&
    settingsSummary.lastChangeAt === "2026-07-04T00:00:00.000Z",
  "summarizeSyncSummaryTables should preserve pending totals and latest change"
);

if (failures.length > 0) {
  console.error("Sync pending domain registry verification failed");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Sync pending domain registry verification passed");
console.log(
  JSON.stringify(
    {
      domains: PENDING_DOMAIN_DEFINITIONS.length,
      catalog_domains: catalog.length,
      rows: rows.length,
      active_rows: rows.filter((row) => row.total > 0).length,
      core_fallbacks_checked: 3,
      unmatched_tables_visible: Boolean(otherRow),
      local_only: true,
      privacy_boundary:
        "Synthetic in-memory verification only. It does not read browser storage, page bodies, database row values, comments, file names, file bytes, cookies, credentials, cloud data, or local user content.",
    },
    null,
    2
  )
);

function table(tableName, pending, failed, inFlight, manualReview, lastChangeAt) {
  return {
    tableName,
    pending,
    failed,
    inFlight,
    manualReview,
    total: pending + failed + inFlight + manualReview,
    lastChangeAt,
  };
}

function check(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}
