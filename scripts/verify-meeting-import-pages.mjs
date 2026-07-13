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
const importerSource = readFileSync(path.join(root, importPath), "utf8");
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
const dailyRootRecord = pageRecord(result.dailyRootId);
const zhihuiRootRecord = pageRecord(result.zhihuiRootId);
const dailyRecord = pageRecord(result.dailyPageId);
const meetingRecord = pageRecord(result.meetingPageId);
const minutesRecord = pageRecord(result.minutesPageId);

expect(result.importId === "synthetic-meeting-fingerprint", "import id should use the content fingerprint");
expect(result.dailyPageId && result.meetingPageId && result.minutesPageId, "result should expose all created page ids");
expect(result.meeting.date === "2026-06-14", "result should expose normalized meeting date");
expect(result.meeting.time === "10:00-11:00", "result should expose normalized meeting time range");
expect(result.meeting.platform === "Zoom", "result should expose normalized meeting platform");
expect(result.calendar.source === "meeting-agent-import", "calendar receipt should identify the import source");
expect(result.calendar.dateKey === "2026-06-14", "calendar receipt should expose the meeting date key");
expect(
  Array.isArray(result.calendar.affectedCalendars) &&
    result.calendar.affectedCalendars.join(",") === "daily,meeting",
  "calendar receipt should identify both daily and meeting calendar surfaces"
);
expect(
  Array.isArray(result.calendar.metadataActions) &&
    result.calendar.metadataActions.join(",") ===
      "daily-calendar-metadata,meeting-calendar-metadata",
  "calendar receipt should identify both metadata refresh actions"
);
expect(result.calendar.dailyPageId === result.dailyPageId, "calendar receipt should include daily page id");
expect(result.calendar.meetingPageId === result.meetingPageId, "calendar receipt should include meeting page id");
expect(result.calendar.minutesPageId === result.minutesPageId, "calendar receipt should include minutes page id");
expect(Array.isArray(result.calendar.changedPageIds), "calendar receipt should include changed page ids");
expect(result.calendar.changedPageIds.length === 5, "calendar receipt should include daily root, ZhiHui root, daily, meeting, and minutes pages");
expect(result.calendar.changeLogEntries === result.calendar.changedPageIds.length, "calendar receipt should report every change-log entry");
expect(result.calendar.previousCursor === "", "first import should start from an empty previous cursor");
expect(Boolean(result.calendar.nextCursor), "calendar receipt should expose the next change cursor");
expect(result.calendar.dailyCalendarVisible === true, "calendar receipt should state the daily calendar is visible after import");
expect(result.calendar.meetingCalendarVisible === true, "calendar receipt should state the ZhiHui meeting calendar is visible after import");
expect(result.calendar.requiresMetadataRefresh === true, "calendar receipt should require a metadata refresh after import");
expect(
  result.calendar.metadataRefreshReason === "meeting-import-change-log",
  "calendar receipt should explain that visibility is driven by the meeting import change log"
);

for (const id of result.calendar.changedPageIds) {
  expect(Boolean(index?.[id]), `changed page ${id} should be present in the page index`);
  expect(
    changeLog?.some((entry) => entry.id === id),
    `changed page ${id} should be present in the change log`
  );
}

expect(
  dailyRootRecord?.title === "每日纪要" &&
    dailyRootRecord.parent_id === null &&
    dailyRootRecord.icon === "📅",
  "import should create or reuse a recognizable daily calendar root"
);
expect(
  zhihuiRootRecord?.title === "ZhiHui" &&
    zhihuiRootRecord.parent_id === null &&
    zhihuiRootRecord.icon === "🗓️",
  "import should create or reuse a recognizable ZhiHui calendar root"
);
expect(
  dailyRecord?.parent_id === result.dailyRootId &&
    dailyRecord.title === "2026-06-14" &&
    propertyValue(dailyRecord, "日期") === "2026-06-14",
  "daily page should be nested under 每日纪要 and expose the 日期 property"
);
expect(
  typeof dailyRecord?.content_text === "string" &&
    dailyRecord.content_text.includes(`data-id="${result.minutesPageId}"`),
  "daily page should mention the imported minutes page"
);
expect(
  meetingRecord?.parent_id === result.zhihuiRootId &&
    propertyValue(meetingRecord, "日期") === "2026-06-14" &&
    propertyValue(meetingRecord, "时间") === "10:00-11:00" &&
    propertyValue(meetingRecord, "会议痕迹") === "已完成" &&
    propertyValue(meetingRecord, "时间状态") === "已识别" &&
    propertyValue(meetingRecord, "导入来源") === "meeting-agent",
  "meeting page should be nested under ZhiHui and expose calendar-recognizable properties"
);
expect(
  minutesRecord?.parent_id === result.dailyPageId &&
    propertyValue(minutesRecord, "日期") === "2026-06-14" &&
    propertyValue(minutesRecord, "导入来源") === "meeting-agent" &&
    typeof minutesRecord.content_text === "string" &&
    minutesRecord.content_text.includes(`/page/${result.meetingPageId}`),
  "minutes page should be nested under the daily page and link back to the meeting page"
);
expect(
  new Set(result.calendar.changedPageIds).size === 5 &&
    result.calendar.changedPageIds.includes(result.dailyRootId) &&
    result.calendar.changedPageIds.includes(result.zhihuiRootId) &&
    result.calendar.changedPageIds.includes(result.dailyPageId) &&
    result.calendar.changedPageIds.includes(result.meetingPageId) &&
    result.calendar.changedPageIds.includes(result.minutesPageId),
  "calendar receipt should name every page needed for metadata-first refresh"
);
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
  importerSource.includes("export class MeetingImportError extends Error") &&
    importerSource.includes("this.code = options.code ?? \"meeting_import_validation_failed\"") &&
    importerSource.includes("this.retryable = options.retryable ?? status >= 500") &&
    importerSource.includes("meeting_import_index_corrupt") &&
    importerSource.includes("meeting_import_page_record_missing") &&
    importerSource.includes("meeting_import_page_record_corrupt") &&
    importerSource.includes("manual_review_required: true") &&
    importerSource.includes("unconfirmed_pages_preserved: true"),
  "meeting import should stop corrupt page indexes and page records with stable manual-review failures"
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
  importRouteSource.includes("function importFailurePayload") &&
    importRouteSource.includes("ok: false") &&
    importRouteSource.includes("accountSessionUnaffected: true") &&
    importRouteSource.includes("localUseCanContinue: true") &&
    importRouteSource.includes("rawMeetingContentEchoed: false") &&
    importRouteSource.includes("failureStatus: manualReviewRequired") &&
    importRouteSource.includes("manualReviewRequired") &&
    importRouteSource.includes("nextAction: manualReviewRequired") &&
    importRouteSource.includes("code: error.code") &&
    importRouteSource.includes("retryable: error.retryable") &&
    importRouteSource.includes("\"manual_review\"") &&
    importRouteSource.includes("\"failed_retryable\"") &&
    importRouteSource.includes("\"failed_final\"") &&
    importRouteSource.includes("\"fix_input_or_configuration\""),
  "import route failures should be structured and must not look like account sign-out or lost local input"
);
for (const expectedFailureCode of [
  "zhihui_meeting_import_not_configured",
  "zhihui_agent_unauthorized",
  "invalid_json",
  "meeting_import_validation_failed",
  "meeting_import_index_corrupt",
  "meeting_import_page_record_missing",
  "meeting_import_page_record_corrupt",
  "zhihui_meeting_import_failed",
]) {
  expect(
    importRouteSource.includes(expectedFailureCode) ||
      importerSource.includes(expectedFailureCode),
    `import path should expose stable failure code ${expectedFailureCode}`
  );
}
expect(
  accountSyncClientSource.includes('"daily-calendar-metadata"'),
  "client sync helper should request daily calendar metadata"
);
expect(
  accountSyncClientSource.includes('action: "meeting-calendar-metadata"'),
  "client sync helper should request meeting calendar metadata"
);
expect(
  accountSyncRouteSource.includes('body.action === "daily-calendar-metadata"'),
  "account sync route should expose daily calendar metadata"
);
expect(
  accountSyncRouteSource.includes('body.action === "meeting-calendar-metadata"'),
  "account sync route should expose meeting calendar metadata"
);
expect(
  /async function getDailyCalendarMetadata[\s\S]*refreshDailyCalendarCacheFromChangeLog/.test(
    accountSyncRouteSource
  ),
  "daily metadata should attempt a change-log refresh before full rebuild"
);
expect(
  /async function getMeetingCalendarMetadata[\s\S]*refreshMeetingCalendarCacheFromChangeLog/.test(
    accountSyncRouteSource
  ),
  "meeting metadata should attempt a change-log refresh before full rebuild"
);
expect(
  /async function refreshDailyCalendarCacheFromChangeLog[\s\S]*readChangedPageRecordsFromChangeLog[\s\S]*updateDailyCalendarCacheWithRecords[\s\S]*writeDailyCalendarCache/.test(
    accountSyncRouteSource
  ),
  "daily metadata change-log refresh should read changed ids, update cache records, and persist the cache"
);
expect(
  /async function refreshMeetingCalendarCacheFromChangeLog[\s\S]*readChangedPageRecordsFromChangeLog[\s\S]*updateMeetingCalendarCacheWithRecords[\s\S]*writeMeetingCalendarCache/.test(
    accountSyncRouteSource
  ),
  "meeting metadata change-log refresh should read changed ids, update cache records, and persist the cache"
);

const corruptIndexManualReview = await verifyCorruptIndexManualReview();
const corruptPageRecordManualReview = await verifyPageRecordManualReview({
  mode: "corrupt",
});
const missingPageRecordManualReview = await verifyPageRecordManualReview({
  mode: "missing",
});

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
      affected_calendars: result.calendar.affectedCalendars,
      metadata_actions: result.calendar.metadataActions,
      daily_calendar_visible: result.calendar.dailyCalendarVisible,
      meeting_calendar_visible: result.calendar.meetingCalendarVisible,
      metadata_refresh_required: result.calendar.requiresMetadataRefresh,
      metadata_refresh_reason: result.calendar.metadataRefreshReason,
      calendar_recognizable_page_records: true,
      structured_failure_contract: true,
      corrupt_index_manual_review: corruptIndexManualReview,
      corrupt_page_record_manual_review: corruptPageRecordManualReview,
      missing_page_record_manual_review: missingPageRecordManualReview,
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

function pageRecord(id) {
  return parseJson(kvStore.get(pageRecordKey(id)));
}

function pageRecordKey(id) {
  return `zhinotes:pagesync:page:owner@example.com:${id}`;
}

function propertyValue(record, name) {
  const properties = parseJson(record?.properties);
  if (!Array.isArray(properties)) return "";
  return properties.find((property) => property?.name === name)?.value ?? "";
}

async function verifyCorruptIndexManualReview() {
  const previousIndexRaw = kvStore.get(indexKey);
  const previousPageRecordCount = countPageRecords();
  const corruptIndexValue = "{corrupt-page-index";
  let caught = null;

  kvStore.set(indexKey, corruptIndexValue);
  try {
    await importer.importMeetingArtifactToPages(
      { url: "memory://kv", token: "mock-token" },
      {
        ...payload,
        source_manifest: {
          content_fingerprint: {
            sha256: "synthetic-corrupt-index-fingerprint",
          },
        },
      }
    );
  } catch (error) {
    caught = error;
  } finally {
    if (typeof previousIndexRaw === "string") {
      kvStore.set(indexKey, previousIndexRaw);
    } else {
      kvStore.delete(indexKey);
    }
  }

  const caughtError = caught && typeof caught === "object" ? caught : null;
  const passed =
    caughtError?.code === "meeting_import_index_corrupt" &&
    caughtError?.status === 409 &&
    caughtError?.retryable === false &&
    caughtError?.details?.manual_review_required === true &&
    caughtError?.details?.unconfirmed_pages_preserved === true &&
    countPageRecords() === previousPageRecordCount;

  expect(
    passed,
    "corrupt page index should stop ZhiHui import with manual review and preserve existing page records"
  );
  expect(
    kvStore.get(indexKey) === previousIndexRaw,
    "corrupt index verification should restore the synthetic page index after the safety check"
  );
  return passed;
}

async function verifyPageRecordManualReview({ mode }) {
  const pageId = result.meetingPageId;
  const key = pageRecordKey(pageId);
  const previousRaw = kvStore.get(key);
  const previousPageRecordCount = countPageRecords();
  let caught = null;

  if (mode === "missing") {
    kvStore.delete(key);
  } else {
    kvStore.set(key, "{corrupt-page-record");
  }

  try {
    await importer.importMeetingArtifactToPages(
      { url: "memory://kv", token: "mock-token" },
      {
        ...payload,
        source_manifest: {
          content_fingerprint: {
            sha256: `synthetic-${mode}-page-record-fingerprint`,
          },
        },
      }
    );
  } catch (error) {
    caught = error;
  } finally {
    if (typeof previousRaw === "string") {
      kvStore.set(key, previousRaw);
    } else {
      kvStore.delete(key);
    }
  }

  const expectedCode =
    mode === "missing"
      ? "meeting_import_page_record_missing"
      : "meeting_import_page_record_corrupt";
  const caughtError = caught && typeof caught === "object" ? caught : null;
  const passed =
    caughtError?.code === expectedCode &&
    caughtError?.status === 409 &&
    caughtError?.retryable === false &&
    caughtError?.details?.manual_review_required === true &&
    caughtError?.details?.unconfirmed_pages_preserved === true &&
    caughtError?.details?.page_id === pageId &&
    countPageRecords() === previousPageRecordCount;

  expect(
    passed,
    `${mode} active page record should stop ZhiHui import with manual review and preserve existing page records`
  );
  expect(
    kvStore.get(key) === previousRaw,
    `${mode} page record verification should restore the synthetic page record after the safety check`
  );
  return passed;
}

function countPageRecords() {
  return [...kvStore.keys()].filter((key) =>
    key.startsWith("zhinotes:pagesync:page:owner@example.com:")
  ).length;
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
