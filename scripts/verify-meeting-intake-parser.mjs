#!/usr/bin/env node

// Verifies the ZhiHui meeting invite parser with synthetic examples only.
// It does not read browser storage, page bodies, meeting transcripts, join URLs,
// passcodes, file bytes, cookies, credentials, or cloud data.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import vm from "node:vm";
import ts from "typescript";

const root = process.cwd();
const require = createRequire(import.meta.url);
const parserPath = "src/lib/meetings/meetingInviteIntake.ts";
const intakeRoutePath = "src/app/api/meetings/intake/route.ts";
const fullParserPath = path.join(root, parserPath);

const parser = loadParser(fullParserPath);
const intakeRouteSource = readFileSync(path.join(root, intakeRoutePath), "utf8");

const cases = [
  {
    name: "下周一 bounded to next Chinese week",
    input: "会议主题：测试会议\n时间：下周一 10:00-11:00",
    expected: { date: "2026-07-06", time: "10:00", endTime: "11:00", durationMinutes: 60 },
  },
  {
    name: "下星期一 common wording",
    input: "会议主题：测试会议\n时间：下星期一 10:00",
    expected: { date: "2026-07-06", time: "10:00", endTime: "", durationMinutes: null },
  },
  {
    name: "下个星期三 common wording",
    input: "会议主题：测试会议\n时间：下个星期三 10:00-11:00",
    expected: { date: "2026-07-08", time: "10:00", endTime: "11:00", durationMinutes: 60 },
  },
  {
    name: "下礼拜三 common wording",
    input: "会议主题：测试会议\n时间：下礼拜三 10:00-11:00",
    expected: { date: "2026-07-08", time: "10:00", endTime: "11:00", durationMinutes: 60 },
  },
  {
    name: "星期日 without prefix",
    input: "会议主题：测试会议\n时间：星期日 上午9点半",
    expected: { date: "2026-07-05", time: "09:30", endTime: "", durationMinutes: null },
  },
  {
    name: "explicit month day outranks weekday label",
    input: "会议主题：测试会议\n时间：6月14日（本周日）下午16:00点",
    expected: { date: "2026-06-14", time: "16:00", endTime: "", durationMinutes: null },
  },
  {
    name: "relative day with Chinese period",
    input: "会议主题：测试会议\n时间：明天 下午4点",
    expected: { date: "2026-07-05", time: "16:00", endTime: "", durationMinutes: null },
  },
  {
    name: "Chinese formal today alias with colon range",
    input: "会议主题：测试会议\n时间：今日15:00-16:00",
    expected: { date: "2026-07-04", time: "15:00", endTime: "16:00", durationMinutes: 60 },
  },
  {
    name: "Chinese formal tomorrow alias with tight bare range",
    input: "会议主题：测试会议\n时间：明日15-16",
    expected: { date: "2026-07-05", time: "15:00", endTime: "16:00", durationMinutes: 60 },
  },
  {
    name: "Chinese formal day-after-tomorrow alias with short end hour",
    input: "会议主题：测试会议\n时间：后日9:30-10",
    expected: { date: "2026-07-06", time: "09:30", endTime: "10:00", durationMinutes: 30 },
  },
  {
    name: "English month date with AM/PM",
    input: "Meeting topic: Test meeting\nTime: Jul 8, 2026 4:00 PM to 5:30 PM",
    expected: { date: "2026-07-08", time: "16:00", endTime: "17:30", durationMinutes: 90 },
  },
  {
    name: "Chinese relative weekday with trailing PM range",
    input: "会议主题：测试会议\n时间：下周一 4:00 PM - 5:30 PM",
    expected: { date: "2026-07-06", time: "16:00", endTime: "17:30", durationMinutes: 90 },
  },
  {
    name: "English next weekday with trailing PM range",
    input: "Meeting topic: Test meeting\nTime: next Monday 4:00 PM - 5:30 PM",
    expected: { date: "2026-07-06", time: "16:00", endTime: "17:30", durationMinutes: 90 },
  },
  {
    name: "English weekday with AM midnight range",
    input: "Meeting topic: Test meeting\nTime: Monday 12:00 AM - 1:00 AM",
    expected: { date: "2026-07-06", time: "00:00", endTime: "01:00", durationMinutes: 60 },
  },
  {
    name: "English tomorrow with trailing PM range",
    input: "Meeting topic: Test meeting\nTime: tomorrow 4:00 PM - 5:30 PM",
    expected: { date: "2026-07-05", time: "16:00", endTime: "17:30", durationMinutes: 90 },
  },
  {
    name: "English today with AM single time",
    input: "Meeting topic: Test meeting\nTime: today 9:30 AM",
    expected: { date: "2026-07-04", time: "09:30", endTime: "", durationMinutes: null },
  },
  {
    name: "English day after tomorrow with noon range",
    input: "Meeting topic: Test meeting\nTime: day after tomorrow 12:00 PM - 1:00 PM",
    expected: { date: "2026-07-06", time: "12:00", endTime: "13:00", durationMinutes: 60 },
  },
  {
    name: "English tomorrow with hour-only PM range",
    input: "Meeting topic: Test meeting\nTime: tomorrow at 4 PM - 5 PM",
    expected: { date: "2026-07-05", time: "16:00", endTime: "17:00", durationMinutes: 60 },
  },
  {
    name: "English today with hour-only AM time",
    input: "Meeting topic: Test meeting\nTime: today 9 AM",
    expected: { date: "2026-07-04", time: "09:00", endTime: "", durationMinutes: null },
  },
  {
    name: "English weekday with hour-only noon range",
    input: "Meeting topic: Test meeting\nTime: Monday 12 PM - 1 PM",
    expected: { date: "2026-07-06", time: "12:00", endTime: "13:00", durationMinutes: 60 },
  },
  {
    name: "English day-month date with separate hour-only time",
    input: "Meeting topic: Test meeting\nDate: 8 Jul 2026\nTime: 4 PM - 5 PM",
    expected: { date: "2026-07-08", time: "16:00", endTime: "17:00", durationMinutes: 60 },
  },
  {
    name: "English ordinal day-month date with AM time",
    input: "Meeting topic: Test meeting\nTime: 8th July 2026 9:30 AM",
    expected: { date: "2026-07-08", time: "09:30", endTime: "", durationMinutes: null },
  },
  {
    name: "English abbreviated dotted month date",
    input: "Meeting topic: Test meeting\nTime: 8 Jul. 2026 4:00 PM - 5:30 PM",
    expected: { date: "2026-07-08", time: "16:00", endTime: "17:30", durationMinutes: 90 },
  },
  {
    name: "English month year is not mistaken for month day",
    input: "Meeting topic: Test meeting\nTime: July 2026 4 PM",
    expected: { date: "", time: "", endTime: "", durationMinutes: null },
  },
  {
    name: "Numeric day-first slash date with year",
    input: "Meeting topic: Test meeting\nDate: 14/06/2026\nTime: 4 PM - 5 PM",
    expected: { date: "2026-06-14", time: "16:00", endTime: "17:00", durationMinutes: 60 },
  },
  {
    name: "Numeric day-first dash date with year",
    input: "Meeting topic: Test meeting\nTime: 14-06-2026 9:30 AM",
    expected: { date: "2026-06-14", time: "09:30", endTime: "", durationMinutes: null },
  },
  {
    name: "Numeric day-first dotted date with year",
    input: "Meeting topic: Test meeting\nTime: 14.06.2026 4:00 PM - 5:30 PM",
    expected: { date: "2026-06-14", time: "16:00", endTime: "17:30", durationMinutes: 90 },
  },
  {
    name: "Numeric day-first slash date without year",
    input: "Meeting topic: Test meeting\nTime: 14/06 4 PM",
    expected: { date: "2026-06-14", time: "16:00", endTime: "", durationMinutes: null },
  },
  {
    name: "Ambiguous numeric date keeps existing month-first behavior",
    input: "Meeting topic: Test meeting\nTime: 12/06 4 PM",
    expected: { date: "2026-12-06", time: "16:00", endTime: "", durationMinutes: null },
  },
  {
    name: "Chinese text month-day with text hour range",
    input: "会议主题：测试会议\n时间：六月十四日下午四点到五点",
    expected: { date: "2026-06-14", time: "16:00", endTime: "17:00", durationMinutes: 60 },
  },
  {
    name: "Chinese short year month-day date",
    input: "会议主题：测试会议\n时间：26年6月14日 9:00-10:00",
    expected: { date: "2026-06-14", time: "09:00", endTime: "10:00", durationMinutes: 60 },
  },
  {
    name: "Dotted short year date is not read as month-day",
    input: "会议主题：测试会议\n时间：26.6.14 9-10",
    expected: { date: "2026-06-14", time: "09:00", endTime: "10:00", durationMinutes: 60 },
  },
  {
    name: "Slash short year date",
    input: "会议主题：测试会议\n时间：26/6/14 15:00-16",
    expected: { date: "2026-06-14", time: "15:00", endTime: "16:00", durationMinutes: 60 },
  },
  {
    name: "Chinese text month-day with half-hour time",
    input: "会议主题：测试会议\n时间：六月十四日 上午九点半",
    expected: { date: "2026-06-14", time: "09:30", endTime: "", durationMinutes: null },
  },
  {
    name: "Numeric month-day with Chinese text half-hour range",
    input: "会议主题：测试会议\n时间：6月14日 下午四点半-五点半",
    expected: { date: "2026-06-14", time: "16:30", endTime: "17:30", durationMinutes: 60 },
  },
  {
    name: "Relative day with Chinese text minute",
    input: "会议主题：测试会议\n时间：明天上午九点三十分",
    expected: { date: "2026-07-05", time: "09:30", endTime: "", durationMinutes: null },
  },
  {
    name: "Chinese tonight compact relative time",
    input: "会议主题：测试会议\n时间：今晚八点到九点",
    expected: { date: "2026-07-04", time: "20:00", endTime: "21:00", durationMinutes: 60 },
  },
  {
    name: "Chinese tonight compact hour range without first 点",
    input: "会议主题：测试会议\n时间：今晚8-9点",
    expected: { date: "2026-07-04", time: "20:00", endTime: "21:00", durationMinutes: 60 },
  },
  {
    name: "Chinese tonight bare compact hour range is not a month-day",
    input: "会议主题：测试会议\n时间：今晚8-9",
    expected: { date: "2026-07-04", time: "20:00", endTime: "21:00", durationMinutes: 60 },
  },
  {
    name: "Chinese tomorrow night compact relative time",
    input: "会议主题：测试会议\n时间：明晚8点-9点",
    expected: { date: "2026-07-05", time: "20:00", endTime: "21:00", durationMinutes: 60 },
  },
  {
    name: "Chinese tomorrow night compact hour range without first 点",
    input: "会议主题：测试会议\n时间：明晚8-9点",
    expected: { date: "2026-07-05", time: "20:00", endTime: "21:00", durationMinutes: 60 },
  },
  {
    name: "Chinese tomorrow morning compact relative time",
    input: "会议主题：测试会议\n时间：明早九点半",
    expected: { date: "2026-07-05", time: "09:30", endTime: "", durationMinutes: null },
  },
  {
    name: "Chinese tomorrow morning compact hour range",
    input: "会议主题：测试会议\n时间：明早9-10点",
    expected: { date: "2026-07-05", time: "09:00", endTime: "10:00", durationMinutes: 60 },
  },
  {
    name: "Chinese relative day compact afternoon hour range",
    input: "会议主题：测试会议\n时间：明天下午3-4点",
    expected: { date: "2026-07-05", time: "15:00", endTime: "16:00", durationMinutes: 60 },
  },
  {
    name: "Chinese formal today alias compact afternoon bare range",
    input: "会议主题：测试会议\n时间：今日下午3-4",
    expected: { date: "2026-07-04", time: "15:00", endTime: "16:00", durationMinutes: 60 },
  },
  {
    name: "Chinese relative day compact 24-hour range",
    input: "会议主题：测试会议\n时间：明天15-16点",
    expected: { date: "2026-07-05", time: "15:00", endTime: "16:00", durationMinutes: 60 },
  },
  {
    name: "Chinese relative day bare compact 24-hour range",
    input: "会议主题：测试会议\n时间：明天15-16",
    expected: { date: "2026-07-05", time: "15:00", endTime: "16:00", durationMinutes: 60 },
  },
  {
    name: "Chinese relative weekday bare compact 24-hour range",
    input: "会议主题：测试会议\n时间：周三15-16",
    expected: { date: "2026-07-08", time: "15:00", endTime: "16:00", durationMinutes: 60 },
  },
  {
    name: "Chinese relative day colon range to bare end hour",
    input: "会议主题：测试会议\n时间：明天15:00-16",
    expected: { date: "2026-07-05", time: "15:00", endTime: "16:00", durationMinutes: 60 },
  },
  {
    name: "Chinese relative day en dash colon range",
    input: "会议主题：测试会议\n时间：明天15:00–16:00",
    expected: { date: "2026-07-05", time: "15:00", endTime: "16:00", durationMinutes: 60 },
  },
  {
    name: "Chinese relative day em dash range to bare end hour",
    input: "会议主题：测试会议\n时间：明天15:00—16",
    expected: { date: "2026-07-05", time: "15:00", endTime: "16:00", durationMinutes: 60 },
  },
  {
    name: "Chinese relative day half-hour range to bare end hour",
    input: "会议主题：测试会议\n时间：明天15:30-16",
    expected: { date: "2026-07-05", time: "15:30", endTime: "16:00", durationMinutes: 30 },
  },
  {
    name: "Chinese month-day compact hour range without period",
    input: "会议主题：测试会议\n时间：6月14日 9-10点",
    expected: { date: "2026-06-14", time: "09:00", endTime: "10:00", durationMinutes: 60 },
  },
  {
    name: "Chinese month-day tight bare compact hour range",
    input: "会议主题：测试会议\n时间：6月14日9-10",
    expected: { date: "2026-06-14", time: "09:00", endTime: "10:00", durationMinutes: 60 },
  },
  {
    name: "Chinese month-day bare compact hour range",
    input: "会议主题：测试会议\n时间：6月14日 9-10",
    expected: { date: "2026-06-14", time: "09:00", endTime: "10:00", durationMinutes: 60 },
  },
  {
    name: "Chinese month-day fullwidth dash compact hour range",
    input: "会议主题：测试会议\n时间：6月14日 9－10点",
    expected: { date: "2026-06-14", time: "09:00", endTime: "10:00", durationMinutes: 60 },
  },
  {
    name: "Chinese month-day colon range to bare end hour",
    input: "会议主题：测试会议\n时间：6月14日 9:30-10",
    expected: { date: "2026-06-14", time: "09:30", endTime: "10:00", durationMinutes: 30 },
  },
  {
    name: "Chinese month-day fullwidth dash colon range to bare end hour",
    input: "会议主题：测试会议\n时间：6月14日 9：30－10",
    expected: { date: "2026-06-14", time: "09:30", endTime: "10:00", durationMinutes: 30 },
  },
  {
    name: "Chinese split date and compact hour range",
    input: "会议主题：测试会议\n日期：6月14日\n时间：9-10点",
    expected: { date: "2026-06-14", time: "09:00", endTime: "10:00", durationMinutes: 60 },
  },
  {
    name: "Chinese split date and bare compact hour range",
    input: "会议主题：测试会议\n日期：6月14日\n时间：9-10",
    expected: { date: "2026-06-14", time: "09:00", endTime: "10:00", durationMinutes: 60 },
  },
  {
    name: "ISO date-only is not misread as bare compact time",
    input: "会议主题：测试会议\n日期：2026-07-04",
    expected: { date: "2026-07-04", time: "", endTime: "", durationMinutes: null },
  },
  {
    name: "ISO date with bare compact hour range",
    input: "会议主题：测试会议\n时间：2026-07-08 15-16",
    expected: { date: "2026-07-08", time: "15:00", endTime: "16:00", durationMinutes: 60 },
  },
  {
    name: "Chinese compact hour range without date is not a fake date",
    input: "会议主题：测试会议\n时间：下午3-4点",
    expected: { date: "", time: "", endTime: "", durationMinutes: null },
  },
  {
    name: "Chinese compact numeric hour range without date stays incomplete",
    input: "会议主题：测试会议\n时间：9-10点",
    expected: { date: "", time: "", endTime: "", durationMinutes: null },
  },
  {
    name: "Chinese colon range without date stays incomplete",
    input: "会议主题：测试会议\n时间：9:30-10",
    expected: { date: "", time: "", endTime: "", durationMinutes: null },
  },
  {
    name: "Chinese tomorrow noon remains supported",
    input: "会议主题：测试会议\n时间：明天中午十二点到一点",
    expected: { date: "2026-07-05", time: "12:00", endTime: "13:00", durationMinutes: 60 },
  },
];

const results = [];
const errors = [];

for (const testCase of cases) {
  const parsed = parser(testCase.input).meeting;
  const actual = {
    date: parsed.date,
    time: parsed.time,
    endTime: parsed.endTime,
    durationMinutes: parsed.durationMinutes,
  };
  const passed = deepEqual(actual, testCase.expected);
  results.push({ name: testCase.name, passed, actual, expected: testCase.expected });
  if (!passed) {
    errors.push(
      `${testCase.name}: expected ${JSON.stringify(testCase.expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

for (const checkResult of verifyIntakeRouteContract(intakeRouteSource)) {
  results.push(checkResult);
  if (!checkResult.passed) errors.push(checkResult.message);
}

if (errors.length > 0) {
  console.error("verify:meeting-intake 失败：");
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log("verify:meeting-intake 通过 ✓ （合成会议邀请日期/时间样例）");
console.log(
  JSON.stringify(
    {
      parser: parserPath,
      route: intakeRoutePath,
      synthetic_cases: cases.length,
      route_contract_checks: results.filter((result) => result.kind === "route-contract").length,
      fixed_now: "2026-07-04T10:00:00 local time",
      privacy_boundary:
        "Synthetic parser verification only. It does not read real meeting content, browser storage, page bodies, transcripts, join URLs, passcodes, cookies, credentials, cloud data, or file bytes.",
      results,
    },
    null,
    2
  )
);

function loadParser(filePath) {
  const source =
    readFileSync(filePath, "utf8") +
    "\nexports.__parseMeetingInviteInput = parseMeetingInviteInput;";
  const js = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;

  const RealDate = Date;
  class FixedDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) return new RealDate(2026, 6, 4, 10, 0, 0);
      return new RealDate(...args);
    }

    static now() {
      return new RealDate(2026, 6, 4, 10, 0, 0).getTime();
    }
  }
  FixedDate.UTC = RealDate.UTC;
  FixedDate.parse = RealDate.parse;

  const sandbox = {
    exports: {},
    require,
    console,
    Date: FixedDate,
  };
  vm.runInNewContext(js, sandbox, { filename: filePath });
  return sandbox.exports.__parseMeetingInviteInput;
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function verifyIntakeRouteContract(source) {
  const checks = [
    {
      name: "input length is bounded",
      passed: source.includes("const MAX_INPUT_CHARS = 20_000"),
      message: "intake route must keep pasted invite payloads bounded at 20,000 characters",
    },
    {
      name: "fetched page text is bounded",
      passed: source.includes("const MAX_FETCH_CHARS = 250_000"),
      message: "intake route must cap fetched linked-page text before parsing",
    },
    {
      name: "linked-page fetch is timed out",
      passed:
        source.includes("const FETCH_TIMEOUT_MS = 5_000") &&
        source.includes("const controller = new AbortController();") &&
        source.includes("signal: controller.signal") &&
        source.includes("controller.abort()"),
      message: "intake route must abort slow linked-page fetches instead of hanging import",
    },
    {
      name: "fetch warning falls back to pasted content",
      passed:
        source.includes("fetchWarning") &&
        source.includes("链接读取超时或失败，已优先使用粘贴内容解析。") &&
        source.includes("parsed.meeting.warnings.push(fetchWarning)"),
      message: "intake route must surface fetch failures as warnings while preserving pasted-content parsing",
    },
    {
      name: "local and private network hosts are blocked",
      passed:
        source.includes("function isBlockedHost") &&
        source.includes('host === "localhost"') &&
        source.includes("host.endsWith(\".local\")") &&
        source.includes("a === 10") &&
        source.includes("a === 127") &&
        source.includes("a === 192 && b === 168"),
      message: "intake route must skip localhost and private-network links",
    },
    {
      name: "raw invite is not stored",
      passed: source.includes("storesRawInvite: false"),
      message: "intake route privacy response must state that raw invite text is not stored",
    },
    {
      name: "raw invite and fetched page text are not echoed",
      passed:
        source.includes("rawInviteEchoed: false") &&
        source.includes("fetchedPageTextEchoed: false"),
      message: "intake route must not echo pasted invite text or fetched page text",
    },
    {
      name: "success responses are structured and local-safe",
      passed:
        source.includes("function intakeJson") &&
        source.includes("\"Cache-Control\", \"no-store, max-age=0\"") &&
        source.includes("const intakeContinuityReceipt") &&
        source.includes("const intakeReceiptBase") &&
        source.includes("schema: \"zhinote.zhihui.intake.receipt.v1\"") &&
        source.includes("function intakeSuccessReceipt") &&
        source.includes("ok: true") &&
        source.includes("status: \"parsed\"") &&
        source.includes("nextAction: \"review_and_save_to_calendar\"") &&
        source.includes("syncStatus: \"local_review_required\"") &&
        source.includes("cloudWriteStatus: \"not_started\"") &&
        source.includes("calendarWriteStatus: \"not_started\"") &&
        source.includes("requiresUserConfirmation: true") &&
        source.includes("highRiskWriteGated: true") &&
        source.includes("intakeReceipt: intakeSuccessReceipt") &&
        source.includes("parseStatus: \"completed\"") &&
        source.includes("fetchedPageReadStatus: fetched") &&
        source.includes("\"skipped_or_failed_warning\"") &&
        source.includes("warningCount") &&
        source.includes("confidence") &&
        source.includes("metadataOnly: true") &&
        source.includes("...intakeContinuityReceipt") &&
        source.includes("accountSessionUnaffected: true") &&
        source.includes("localUseCanContinue: true") &&
        source.includes("localMeetingDataUnaffected: true") &&
        source.includes("localCalendarDataUnaffected: true") &&
        source.includes("rawInviteEchoed: false") &&
        source.includes("fetchedPageTextEchoed: false"),
      message:
        "intake route success responses should tell the UI that parsing did not sign out the account, mutate local data, or echo private invite text",
    },
    {
      name: "failure responses are structured and local-safe",
      passed:
        source.includes("function intakeFailurePayload") &&
        source.includes("function intakeFailureReceipt") &&
        source.includes("ok: false") &&
        source.includes('source: "zhihui-meeting-intake"') &&
        source.includes("accountSessionUnaffected: true") &&
        source.includes("localUseCanContinue: true") &&
        source.includes("localMeetingDataUnaffected: true") &&
        source.includes("localCalendarDataUnaffected: true") &&
        source.includes("syncStatus: \"not_started\"") &&
        source.includes("cloudWriteStatus: \"not_started\"") &&
        source.includes("calendarWriteStatus: \"not_started\"") &&
        source.includes("highRiskWriteGated: true") &&
        source.includes("rawInviteEchoed: false") &&
        source.includes("fetchedPageTextEchoed: false") &&
        source.includes("failureStatus: manualReviewRequired") &&
        source.includes("manualReviewRequired") &&
        source.includes("nextAction: manualReviewRequired") &&
        source.includes("intakeReceipt: intakeFailureReceipt") &&
        source.includes("failureCode: code") &&
        source.includes("parseStatus: manualReviewRequired") &&
        source.includes("retryable") &&
        source.includes("metadataOnly: true") &&
        source.includes("\"manual_review\"") &&
        source.includes("\"failed_retryable\"") &&
        source.includes("\"failed_final\"") &&
        source.includes("\"fix_input_or_configuration\""),
      message:
        "intake route failures should be structured and must not look like account sign-out, lost local input, or echoed private invite text",
    },
    {
      name: "failure codes are stable",
      passed:
        source.includes("invalid_json") &&
        source.includes("meeting_intake_empty_input") &&
        source.includes("meeting_intake_input_too_large") &&
        source.includes("max_chars: MAX_INPUT_CHARS"),
      message:
        "intake route should expose stable failure codes for invalid JSON, empty input, and oversized input",
    },
    {
      name: "unsafe content types are skipped",
      passed:
        source.includes("content-type") &&
        source.includes("!contentType.includes(\"text/html\")") &&
        source.includes("!contentType.includes(\"text/plain\")"),
      message: "intake route must only read text/html or text/plain linked pages",
    },
    {
      name: "script/style/svg bodies are stripped",
      passed:
        source.includes("replace(/<script[\\s\\S]*?<\\/script>/gi") &&
        source.includes("replace(/<style[\\s\\S]*?<\\/style>/gi") &&
        source.includes("replace(/<svg[\\s\\S]*?<\\/svg>/gi"),
      message: "intake route must strip script/style/svg content before readable-page extraction",
    },
  ];

  return checks.map((check) => ({
    kind: "route-contract",
    name: check.name,
    passed: check.passed,
    message: check.message,
  }));
}
