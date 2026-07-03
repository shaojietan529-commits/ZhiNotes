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
const fullParserPath = path.join(root, parserPath);

const parser = loadParser(fullParserPath);

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
    name: "English month date with AM/PM",
    input: "Meeting topic: Test meeting\nTime: Jul 8, 2026 4:00 PM to 5:30 PM",
    expected: { date: "2026-07-08", time: "16:00", endTime: "17:30", durationMinutes: 90 },
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
      synthetic_cases: cases.length,
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
