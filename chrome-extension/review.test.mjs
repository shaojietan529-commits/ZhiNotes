// Synthetic fixtures only. Never reads a live meeting page or browser profile.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import vm from "node:vm";
import { test } from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
function loadTS(path, dependencies = {}, extra = {}) {
  const code = ts.transpileModule(read(path), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const sandbox = { exports: {}, URL, Date, Request, Response, TextDecoder, TextEncoder,
    AbortController, setTimeout, clearTimeout, ...extra,
    require: (name) => dependencies[name] ?? require(name) };
  vm.runInNewContext(code, sandbox, { filename: path });
  return sandbox.exports;
}
const parser = loadTS("src/lib/meetings/meetingInviteIntake.ts");
const bundle = { URL, Date };
vm.runInNewContext(read("chrome-extension/meeting-parser.js"), bundle);
const fields = {
  topic: "人工确认的行业讨论", organizer: "测试研究机构", platform: "其他",
  date: "2026-09-26", time: "16:00", endTime: "17:00",
  url: "https://www.comein.cn/roadshow/home/123456?token=synthetic#secret",
};
const fetched = { url: fields.url, host: "www.comein.cn", title: "旧标题",
  description: "旧机构邀请您参加\n主题：旧主题\n时间：2025-01-01 09:00\n腾讯会议",
  text: "会议密码：SYNTHETIC_ONLY" };

test("extension parser was generated from the current app source", () => {
  execFileSync(process.execPath, [new URL("build-parser.mjs", import.meta.url).pathname, "--check"]);
});

test("all reviewed edits survive downstream parsing, ignoring fetched originals", () => {
  for (const api of [parser, bundle.ZhiHuiIntake]) {
    const input = api.serializeReviewedMeetingInput({ ...fields, rawText: fetched.text, title: fetched.title });
    const result = api.parseMeetingInviteInput(input, fetched).meeting;
    for (const key of ["topic", "organizer", "platform", "date", "time", "endTime"]) {
      assert.equal(result[key], fields[key], key);
    }
    assert.equal(result.durationMinutes, 60);
    assert.equal(result.joinUrl, "https://www.comein.cn/roadshow/home/123456");
    assert.equal(result.passcode, "");
    assert.equal(result.meetingId, "");
    assert.ok(!/SYNTHETIC_ONLY|旧标题|token=|#secret|原始抓取文本/.test(input));
  }
});

test("intentional blank optional fields remain blank", () => {
  const empty = { ...fields, organizer: "", endTime: "", url: "" };
  const result = parser.parseMeetingInviteInput(parser.serializeReviewedMeetingInput(empty), fetched).meeting;
  for (const key of ["organizer", "endTime"]) assert.equal(result[key], "");
  assert.equal(result.durationMinutes, null);
  assert.equal(result.joinUrl, "");
  assert.equal(result.confidence, "medium");
});

test("midnight and overnight edits do not invent a date or end time", () => {
  const input = parser.serializeReviewedMeetingInput({ ...fields, time: "23:30", endTime: "00:30" });
  assert.equal(parser.parseMeetingInviteInput(input).meeting.durationMinutes, 60);
  const single = parser.serializeReviewedMeetingInput({ ...fields, time: "00:00", endTime: "" });
  assert.equal(parser.parseMeetingInviteInput(single).meeting.time, "00:00");
  assert.equal(parser.parseMeetingInviteInput(single).meeting.endTime, "");
});

test("multiline edits cannot inject extra fields", () => {
  const input = parser.serializeReviewedMeetingInput({ ...fields, topic: "行业讨论\n会议平台：Zoom" });
  assert.equal(input.split("\n").length, 8);
  assert.equal(parser.parseMeetingInviteInput(input).meeting.platform, "其他");
  assert.throws(() => parser.parseMeetingInviteInput(input + "\n页面标题：旧标题"));
});

test("invalid reviewed fields fail closed instead of falling back to originals", () => {
  for (const patch of [
    { topic: "" }, { date: "" }, { time: "", endTime: "" }, { date: "2026-02-30" }, { time: "25:00" },
    { time: "", endTime: "12:00" }, { platform: "arbitrary" },
    { organizer: "person@example.test" }, { topic: "密码：SYNTHETIC_ONLY" },
  ]) assert.throws(() => parser.serializeReviewedMeetingInput({ ...fields, ...patch }));
});

test("source host outranks unrelated platform mentions, using domain boundaries", () => {
  for (const [url, expected] of [
    ["https://www.comein.cn/roadshow/home/123456", "进门财经"],
    ["https://forum.meritco-group.com/meeting", "久谦论坛"],
    ["https://comein.cn.example.test/path", "腾讯会议"],
  ]) {
    const input = `页面网址：${url}\n会议主题：测试行业讨论\n2026-09-26 16:00\n腾讯会议`;
    assert.equal(parser.parseMeetingInviteInput(input).meeting.platform, expected);
  }
});

test("synthetic Comein heading format supplies topic, organizer, date and platform", () => {
  const input = "页面网址：https://www.comein.cn/roadshow/home/123456\n页面标题：[回放]示例证券｜行业展望与策略讨论\n2026-06-14 16:00\n会议介绍\n6月14日（周日）16:00，示例证券为您带来：行业展望与策略讨论。敬请关注！";
  const result = parser.parseMeetingInviteInput(input).meeting;
  assert.equal(result.topic, "示例证券｜行业展望与策略讨论");
  assert.equal(result.organizer, "示例证券");
  assert.equal(result.date, "2026-06-14");
  assert.equal(result.time, "16:00");
  assert.equal(result.platform, "进门财经");
});

test("sanitizer strips secrets, personal contact details and token-bearing URL parts", () => {
  const result = parser.sanitizeCapturedMeetingText("会议主题：行业讨论\n会议密码：SYNTHETIC_ONLY\n邮箱：person@example.test\n电话：13800138000\nhttps://example.test/private-path?token=synthetic#fragment");
  assert.ok(!/SYNTHETIC_ONLY|person@|13800138000|private-path|token|fragment/.test(result));
  assert.ok(result.includes("行业讨论"));
  assert.equal(parser.safeMeetingSourceUrl("https://user:synthetic@example.test/private"), "https://example.test");
  assert.equal(parser.safeMeetingSourceUrl("javascript:alert(1)"), "");
  assert.equal(parser.sanitizeCapturedMeetingText("会议密码：\n\nSYNTHETIC_ONLY\n会议主题：行业讨论").includes("SYNTHETIC_ONLY"), false);
});

test("a dated meeting clock outranks video timers, but explicit time labels still win", () => {
  const input = "页面标题：示例证券｜行业展望与策略讨论\n00:00 / 00:00\n2026-06-14 16:00";
  assert.equal(parser.parseMeetingInviteInput(input).meeting.time, "16:00");
  assert.equal(parser.parseMeetingInviteInput(input + "\n时间：17:00").meeting.time, "17:00");
});

test("actual intake route skips network reads for reviewed fields and rejects malformed input", async () => {
  let fetchCalls = 0;
  const requestBody = loadTS("src/lib/meetings/requestBody.ts");
  const route = loadTS("src/app/api/meetings/intake/route.ts", {
    "@/lib/meetings/meetingInviteIntake": parser,
    "@/lib/meetings/requestBody": requestBody,
  }, { fetch: async () => { fetchCalls++; throw new Error("Network forbidden in fixture"); } });
  const input = parser.serializeReviewedMeetingInput(fields);
  const request = (value) => new Request("https://zhi-note.com/api/meetings/intake", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input: value }),
  });
  const response = await route.POST(request(input));
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.meeting.topic, fields.topic);
  assert.equal(payload.fetched, false);
  assert.equal(payload.intakeReceipt.fetchedPageReadStatus, "not_started");
  assert.equal(payload.calendarWriteStatus, "not_started");
  assert.equal(payload.requiresUserConfirmation, true);
  assert.equal(fetchCalls, 0);
  const invalid = await route.POST(request(input + "\n额外字段：不应解析"));
  assert.equal(invalid.status, 400);
  assert.equal(fetchCalls, 0);
});

test("background bridge only sends structured confirmed fields to existing ZhiNote destination", async () => {
  let handler;
  const writes = [];
  const navigations = [];
  const sandbox = {
    ZhiHuiIntake: parser, importScripts: () => {},
    chrome: {
      runtime: { id: "fixture-extension", onMessage: { addListener: (listener) => { handler = listener; } } },
      storage: { local: { set: async (value) => writes.push(value) } },
      tabs: { query: async () => [], create: async (value) => navigations.push(value) },
    },
  };
  vm.runInNewContext(read("chrome-extension/background.js"), sandbox);
  assert.equal(writes.length, 0);
  const sender = { id: "fixture-extension", tab: { id: 1 }, url: "https://www.comein.cn/" };
  const send = (message, source = sender) => new Promise((resolve) => handler(message, source, resolve));
  assert.equal((await send({ type: "zhihui:sendReviewedIntake", fields }, { id: "other" })).ok, false);
  assert.equal(writes.length, 0);
  assert.equal((await send({ type: "zhihui:sendReviewedIntake", fields })).ok, true);
  assert.equal(writes.length, 1);
  const stored = writes[0].zhihui_pending_intake;
  assert.equal(parser.parseMeetingInviteInput(stored).meeting.topic, fields.topic);
  assert.equal(navigations[0].url, "https://zhi-note.com/schedule");
  assert.equal((await send({ type: "zhihui:sendReviewedIntake", text: "unreviewed raw body" })).ok, false);
  assert.equal(writes.length, 1);
});
