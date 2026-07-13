#!/usr/bin/env node

// Verifies the ZhiHui glossary API contract:
// - It is protected by the same ZhiHui agent token as the recording queue.
// - It reads only account-scoped synced pages from KV.
// - It returns short glossary terms and diagnostics, not raw page text or meeting secrets.

import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import vm from "node:vm";
import ts from "typescript";

const root = process.cwd();
const require = createRequire(import.meta.url);
const errors = [];
const check = (cond, msg) => {
  if (!cond) errors.push(msg);
};
const read = (rel) => {
  const full = path.join(root, rel);
  if (!existsSync(full)) {
    errors.push(`缺少文件 ${rel}`);
    return "";
  }
  return readFileSync(full, "utf8");
};

const route = read("src/app/api/glossary/route.ts");
const agentQueue = read("src/lib/meetings/agentQueue.ts");
const jobsRoute = read("src/app/api/meetings/agent/jobs/route.ts");
const ackRoute = read("src/app/api/meetings/agent/jobs/ack/route.ts");
for (const token of [
  "getMeetingAgentQueueConfig",
  "authorizeMeetingAgent",
  "buildZhiHuiGlossary",
  "force-dynamic",
]) {
  check(route.includes(token), `glossary route 缺少 ${token}`);
}
check(!route.includes("console."), "glossary route 不应该写日志");
for (const token of [
  "MEETING_AGENT_QUEUE_REQUEST_TIMEOUT_MS = 8000",
  "export class MeetingAgentQueueTimeoutError extends Error",
  "export class MeetingAgentQueueFailureError extends Error",
  "async function fetchMeetingAgentQueueWithTimeout",
  "const controller = new AbortController();",
  "signal: controller.signal",
  "throw new MeetingAgentQueueTimeoutError",
  "clearTimeout(timeout)",
  "fetchMeetingAgentQueueWithTimeout(\n    `${kv.url}/get/",
  "fetchMeetingAgentQueueWithTimeout(\n    `${kv.url}/set/",
]) {
  check(agentQueue.includes(token), `agent queue 缺少 ${token}`);
}
for (const token of [
  "zhihui_agent_queue_payload_too_large",
  "max_payload_bytes: MAX_PAYLOAD_BYTES",
  "actual_payload_chars: serializedPayload.length",
  "status: 413",
  "retryable: false",
  "zhihui_agent_queue_kv_get_failed",
  "zhihui_agent_queue_kv_set_failed",
  "zhihui_agent_queue_corrupt",
  "upstream_status: res.status",
  "function queueCorruptError",
  "manual_review_required: true",
  "unconfirmed_jobs_preserved: true",
  "status: 409",
  "retryable: true",
]) {
  check(agentQueue.includes(token), `agent queue typed failure 缺少 ${token}`);
}
check(
  (agentQueue.match(/\bfetch\(/g) ?? []).length === 1,
  "agent queue 的 KV get/set 必须统一走 8 秒超时 helper，不能直接分散 fetch"
);
for (const token of [
  "MeetingAgentQueueTimeoutError",
  "MeetingAgentQueueFailureError",
  "zhihui-agent-queue-timeout",
  "会议页和日历本地数据不受影响",
  "timeout_ms: error.timeoutMs",
  "code: error.code",
  "retryable: error.retryable",
  "details: error.details",
  "failureStatus: manualReviewRequired",
  "manualReviewRequired",
  "nextAction: manualReviewRequired",
]) {
  check(jobsRoute.includes(token), `jobs route 缺少 ${token}`);
}
for (const token of [
  "function queueFailurePayload",
  "ok: false",
  'source: "zhihui-agent-queue"',
  "accountSessionUnaffected: true",
  "localUseCanContinue: true",
  "localMeetingDataUnaffected: true",
  "rawMeetingContentEchoed: false",
  "\"manual_review\"",
  "\"failed_retryable\"",
  "\"failed_final\"",
  "\"fix_input_or_configuration\"",
]) {
  check(jobsRoute.includes(token), `jobs route 结构化失败响应缺少 ${token}`);
}
for (const code of [
  "zhihui_agent_queue_not_configured",
  "zhihui_agent_unauthorized",
  "account_system_not_configured",
  "account_session_required",
  "invalid_json",
  "invalid_meeting_payload",
  "zhihui_agent_queue_timeout",
  "zhihui_agent_queue_payload_too_large",
  "zhihui_agent_queue_kv_get_failed",
  "zhihui_agent_queue_kv_set_failed",
  "zhihui_agent_queue_corrupt",
  "zhihui_agent_queue_failed",
]) {
  check(
    jobsRoute.includes(code) || agentQueue.includes(code),
    `jobs route 缺少稳定失败 code ${code}`
  );
}
for (const token of [
  "MeetingAgentQueueTimeoutError",
  "MeetingAgentQueueFailureError",
  "zhihui-agent-queue-timeout",
  "不会清空未确认任务",
  "timeout_ms: error.timeoutMs",
  "code: error.code",
  "retryable: error.retryable",
  "details: error.details",
  "failureStatus: manualReviewRequired",
  "manualReviewRequired",
  "nextAction: manualReviewRequired",
]) {
  check(ackRoute.includes(token), `jobs ack route 缺少 ${token}`);
}
for (const token of [
  "function ackFailurePayload",
  "ok: false",
  'source: "zhihui-agent-queue-ack"',
  "accountSessionUnaffected: true",
  "localUseCanContinue: true",
  "localMeetingDataUnaffected: true",
  "rawMeetingContentEchoed: false",
  "unconfirmedJobsPreserved: true",
  "\"manual_review\"",
  "\"failed_retryable\"",
  "\"failed_final\"",
  "\"fix_input_or_configuration\"",
]) {
  check(ackRoute.includes(token), `jobs ack route 结构化失败响应缺少 ${token}`);
}
for (const code of [
  "zhihui_agent_queue_not_configured",
  "zhihui_agent_unauthorized",
  "invalid_json",
  "zhihui_agent_queue_timeout",
  "zhihui_agent_queue_kv_get_failed",
  "zhihui_agent_queue_kv_set_failed",
  "zhihui_agent_queue_corrupt",
  "zhihui_agent_queue_ack_failed",
]) {
  check(
    ackRoute.includes(code) || agentQueue.includes(code),
    `jobs ack route 缺少稳定失败 code ${code}`
  );
}

const helper = read("src/lib/meetings/glossary.ts");
for (const token of [
  "PAGE_SYNC_INDEX_KEY_PREFIX",
  "PAGE_SYNC_PAGE_KEY_PREFIX",
  "ZHIHUI_GLOSSARY_EMAIL",
  "ZHINOTES_ACCOUNT_ALLOWED_EMAILS",
  "raw_page_text_returned: false",
  "raw_meeting_credentials_returned: false",
  "terms_only: true",
  "SECRET_LINE_PATTERN",
  "looksLikeSecretToken",
]) {
  check(helper.includes(token), `glossary helper 缺少 ${token}`);
}
check(
  !helper.includes("console."),
  "glossary helper 不应该写日志（避免泄露页面词条）"
);
check(
  helper.includes("content_text.slice(0, MAX_PAGE_TEXT_CHARS)"),
  "glossary helper 读取页面正文必须有长度上限"
);
check(
  helper.includes("terms,") && helper.includes("diagnostics"),
  "glossary helper 应返回 terms 和 diagnostics"
);

const packageJson = read("package.json");
check(
  packageJson.includes('"verify:zhihui-glossary"'),
  "package.json 缺少 verify:zhihui-glossary 脚本"
);

const queueBehavior = await verifyCorruptQueueBehavior();
check(
  queueBehavior,
  "agent queue 遇到损坏队列时必须进入 manual review，且 list/enqueue/ack 都不能写回清空未确认任务"
);

if (errors.length > 0) {
  console.error("verify:zhihui-glossary 失败：");
  for (const err of errors) console.error(`  - ${err}`);
  process.exit(1);
}

console.log(
  "verify:zhihui-glossary 通过 ✓ （agent token、同步页读取、只返回短词条、隐藏原文和会议密钥）"
);

async function verifyCorruptQueueBehavior() {
  const cases = [
    { name: "invalid-json", result: "{not-json" },
    { name: "not-array", result: JSON.stringify({ id: "job_1" }) },
    {
      name: "invalid-job-shape",
      result: JSON.stringify([{ id: "job_1", job_type: "recording" }]),
    },
  ];

  for (const testCase of cases) {
    for (const operation of ["list", "enqueue", "ack"]) {
      const calls = { get: 0, set: 0 };
      const queue = loadAgentQueueWithFetch(async (url) => {
        const requestUrl = String(url);
        if (requestUrl.includes("/get/")) {
          calls.get += 1;
          return {
            ok: true,
            status: 200,
            async json() {
              return { result: testCase.result };
            },
          };
        }
        if (requestUrl.includes("/set/")) {
          calls.set += 1;
          return {
            ok: true,
            status: 200,
            async json() {
              return { result: "OK" };
            },
          };
        }
        throw new Error(`unexpected queue URL ${requestUrl}`);
      });

      let caught = null;
      try {
        if (operation === "list") {
          await queue.listMeetingAgentJobs(mockKv(), 25);
        } else if (operation === "enqueue") {
          await queue.enqueueMeetingAgentJob(mockKv(), {
            job_type: "meeting_recording_request",
            payload: { synthetic: true },
          });
        } else {
          await queue.ackMeetingAgentJobs(mockKv(), ["job_1"]);
        }
      } catch (error) {
        caught = error;
      }

      const passed =
        caught &&
        caught.code === "zhihui_agent_queue_corrupt" &&
        caught.status === 409 &&
        caught.retryable === false &&
        caught.details?.manual_review_required === true &&
        caught.details?.unconfirmed_jobs_preserved === true &&
        calls.get === 1 &&
        calls.set === 0;
      if (!passed) {
        errors.push(
          `agent queue corrupt behavior failed for ${testCase.name}/${operation}`
        );
        return false;
      }
    }
  }
  return true;
}

function mockKv() {
  return { url: "https://kv.example.invalid", token: "synthetic-token" };
}

function loadAgentQueueWithFetch(fetchImpl) {
  const fullPath = path.join(root, "src/lib/meetings/agentQueue.ts");
  const source = readFileSync(fullPath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const sandbox = {
    AbortController,
    clearTimeout,
    exports: {},
    fetch: fetchImpl,
    module: { exports: {} },
    process: { env: {} },
    require,
    setTimeout,
  };
  sandbox.module.exports = sandbox.exports;
  vm.runInNewContext(compiled, sandbox, { filename: fullPath });
  return sandbox.module.exports;
}
