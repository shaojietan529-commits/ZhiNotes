#!/usr/bin/env node

// Verifies the ZhiHui meeting artifact import path with synthetic data only.
// It uses an in-memory KV mock and does not read real meeting content, browser
// storage, page bodies, transcripts, join URLs, passcodes, cookies, credentials,
// cloud data, or file bytes.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import vm from "node:vm";
import ts from "typescript";

const root = process.cwd();
const require = createRequire(import.meta.url);
const importPath = "src/lib/meetings/meetingImportPages.ts";
const importRoutePath = "src/app/api/meetings/import/route.ts";
const accountSyncRoutePath = "src/app/api/pages/account-sync/route.ts";
const accountSyncClientPath = "src/lib/pages/accountPageSync.ts";
const kvStore = new Map();
let idCounter = 0;

const importer = loadImporter(path.join(root, importPath));
const importRouteSource = readFileSync(path.join(root, importRoutePath), "utf8");
const accountSyncRouteSource = readFileSync(
  path.join(root, accountSyncRoutePath),
  "utf8"
);
const accountSyncClientSource = readFileSync(
  path.join(root, accountSyncClientPath),
  "utf8"
);

const payload = {
  schema_version: "zhinotes.meeting_import.v1",
  meeting: {
    title: "FUND A 每周讨论会",
    topic: "FUND A 每周讨论会",
    organizer: "Marsh, Mo",
    start_time: "2026-06-14T10:00:00+08:00",
    duration_minutes: 60,
    platform: "zoom",
    language: "zh",
  },
  content: {
    minutes_markdown: "# 要点\n- 合成纪要，仅用于验证。",
    transcript: "合成转写，仅用于验证。",
  },
  recording: {
    filename: "synthetic.m4a",
    size_bytes: 1024,
    upload_mode: "metadata_only",
  },
  source_manifest: {
    content_fingerprint: {
      sha256: "synthetic-meeting-fingerprint",
    },
  },
};

const failures = [];
const result = await importer.importMeetingArtifactToPages(
  { url: "memory://kv", token: "mock-token" },
  payload
);

const indexKey = "zhinotes:pagesync:index:owner@example.com";
const changeLogKey = "zhinotes:pagesync:changes:owner@example.com";
const index = parseJson(kvStore.get(indexKey));
const changeLog = parseJson(kvStore.get(changeLogKey));

expect(result.importId === "synthetic-meeting-fingerprint", "import id should use the content fingerprint");
expect(result.dailyPageId && result.meetingPageId && result.minutesPageId, "result should expose all created page ids");
expect(result.meeting.date === "2026-06-14", "result should expose normalized meeting date");
expect(result.meeting.time === "10:00-11:00", "result should expose normalized meeting time range");
expect(result.meeting.platform === "Zoom", "result should expose normalized meeting platform");
expect(result.calendar.source === "meeting-agent-import", "calendar receipt should identify the import source");
expect(result.calendar.dateKey === "2026-06-14", "calendar receipt should expose the meeting date key");
expect(result.calendar.dailyPageId === result.dailyPageId, "calendar receipt should include daily page id");
expect(result.calendar.meetingPageId === result.meetingPageId, "calendar receipt should include meeting page id");
expect(result.calendar.minutesPageId === result.minutesPageId, "calendar receipt should include minutes page id");
expect(Array.isArray(result.calendar.changedPageIds), "calendar receipt should include changed page ids");
expect(result.calendar.changedPageIds.length === 5, "calendar receipt should include daily root, ZhiHui root, daily, meeting, and minutes pages");
expect(result.calendar.changeLogEntries === result.calendar.changedPageIds.length, "calendar receipt should report every change-log entry");
expect(result.calendar.previousCursor === "", "first import should start from an empty previous cursor");
expect(Boolean(result.calendar.nextCursor), "calendar receipt should expose the next change cursor");

for (const id of result.calendar.changedPageIds) {
  expect(Boolean(index?.[id]), `changed page ${id} should be present in the page index`);
  expect(
    changeLog?.some((entry) => entry.id === id),
    `changed page ${id} should be present in the change log`
  );
}

expect(
  changeLog?.every((entry) => {
    const keys = Object.keys(entry).sort().join(",");
    return keys === "d,id,u" && typeof entry.id === "string" && typeof entry.u === "string";
  }),
  "change log entries should stay metadata-only: id, updated_at, deleted flag"
);
expect(
  !JSON.stringify(result).includes(payload.content.transcript),
  "import result should not echo transcript text"
);
expect(
  !JSON.stringify(result).includes(payload.content.minutes_markdown),
  "import result should not echo minutes markdown"
);

expect(
  importRouteSource.includes("meeting: result.meeting"),
  "import route should return sanitized meeting metadata"
);
expect(
  importRouteSource.includes("calendar: result.calendar"),
  "import route should return the calendar visibility receipt"
);
expect(
  accountSyncClientSource.includes('action: "meeting-calendar-metadata"'),
  "client sync helper should request meeting calendar metadata"
);
expect(
  accountSyncRouteSource.includes('body.action === "meeting-calendar-metadata"'),
  "account sync route should expose meeting calendar metadata"
);
expect(
  /async function getMeetingCalendarMetadata[\s\S]*refreshMeetingCalendarCacheFromChangeLog/.test(
    accountSyncRouteSource
  ),
  "meeting metadata should attempt a change-log refresh before full rebuild"
);
expect(
  /async function refreshMeetingCalendarCacheFromChangeLog[\s\S]*readChangedPageRecordsFromChangeLog[\s\S]*updateMeetingCalendarCacheWithRecords[\s\S]*writeMeetingCalendarCache/.test(
    accountSyncRouteSource
  ),
  "meeting metadata change-log refresh should read changed ids, update cache records, and persist the cache"
);

if (failures.length > 0) {
  console.error("verify:meeting-import 失败：");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("verify:meeting-import 通过 ✓ （合成 ZhiHui 导入、日历小票、change log）");
console.log(
  JSON.stringify(
    {
      importer: importPath,
      route: importRoutePath,
      metadata_route: accountSyncRoutePath,
      metadata_client: accountSyncClientPath,
      synthetic_imports: 1,
      index_records: Object.keys(index ?? {}).length,
      change_log_entries: changeLog?.length ?? 0,
      changed_page_ids: result.calendar.changedPageIds.length,
      calendar_date_key: result.calendar.dateKey,
      downstream_cache_refresh_contract: true,
      privacy_boundary:
        "Synthetic in-memory KV verification only. It does not connect real cloud storage, read browser storage, page bodies, real meeting content, transcripts, join URLs, passcodes, cookies, credentials, or file bytes.",
    },
    null,
    2
  )
);

function expect(condition, message) {
  if (!condition) failures.push(message);
}

function parseJson(value) {
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function loadImporter(fullPath) {
  const source = readFileSync(fullPath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const sandbox = {
    console,
    exports: {},
    module: { exports: {} },
    process: {
      env: {
        ZHINOTES_ACCOUNT_ALLOWED_EMAILS: "owner@example.com",
      },
    },
    require(spec) {
      if (spec === "@/lib/account/server") {
        return {
          normalizeEmail(value) {
            return typeof value === "string" && value.includes("@")
              ? value.trim().toLowerCase()
              : null;
          },
          async kvGet(_env, key) {
            return kvStore.has(key) ? kvStore.get(key) : null;
          },
          async kvSet(_env, key, value) {
            kvStore.set(key, value);
          },
        };
      }
      if (spec === "@/lib/pages/pageProperties") {
        return {
          createPageProperty(type, name) {
            return {
              id: `prop-${name}`,
              name,
              type,
              value: "",
              ...(type === "select" ? { options: [] } : {}),
            };
          },
          parsePageProperties(raw) {
            return parseJson(raw) ?? [];
          },
          stringifyPageProperties(properties) {
            return JSON.stringify(properties);
          },
        };
      }
      if (spec === "@/lib/utils/id") {
        return {
          generateId() {
            idCounter += 1;
            return `synthetic_${idCounter}`;
          },
        };
      }
      return require(spec);
    },
  };
  sandbox.module.exports = sandbox.exports;
  vm.runInNewContext(compiled, sandbox, { filename: fullPath });
  return sandbox.module.exports;
}
