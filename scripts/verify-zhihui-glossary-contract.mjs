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
  "const glossaryFailureBoundary",
  "function glossaryFailurePayload",
  "ok: false",
  'source: "zhihui-glossary"',
  "accountSessionUnaffected: true",
  "localUseCanContinue: true",
  "localMeetingDataUnaffected: true",
  "cloudWriteStatus: \"not_started\"",
  "localCacheWriteStatus: \"not_started\"",
  "rawPageTextEchoed: false",
  "rawMeetingCredentialsEchoed: false",
  "termsReturned: false",
  "highRiskWriteGated: true",
  "zhihui_glossary_not_configured",
  "zhihui_glossary_fetch_failed",
  "zhihui_agent_unauthorized",
  "syncStatus: retryable ? \"glossary_failed_retryable\" : \"glossary_not_started\"",
  "glossaryReadStatus: retryable ? \"failed_retryable\" : \"not_started\"",
  "manualReviewRequired: false",
  "requiresUserConfirmation: false",
  "nextAction",
  "\"configure_environment\"",
  "\"check_agent_token\"",
  "\"retry\"",
  "raw_page_text_returned: false",
  "raw_meeting_credentials_returned: false",
  "terms_only: true",
]) {
  check(route.includes(token), `glossary route 结构化失败响应缺少 ${token}`);
}
for (const token of [
  "MEETING_AGENT_QUEUE_REQUEST_TIMEOUT_MS = 8000",
  "MAX_LISTED_QUEUE_JOBS = 50",
  "export class MeetingAgentQueueTimeoutError extends Error",
  "export class MeetingAgentQueueFailureError extends Error",
  "export interface MeetingAgentQueueListResult",
  "export interface MeetingAgentQueueEnqueueResult",
  "export interface MeetingAgentQueueAckResult",
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
  "actual_payload_bytes: serializedPayloadBytes",
  "actual_payload_chars: serializedPayload.length",
  "status: 413",
  "retryable: false",
  "zhihui_agent_queue_kv_get_failed",
  "zhihui_agent_queue_kv_set_failed",
  "zhihui_agent_queue_corrupt",
  "zhihui_agent_queue_full",
  "zhihui_agent_queue_oversized",
  "upstream_status: res.status",
  "function queueCorruptError",
  "function queueFullError",
  "function queueOversizedError",
  "function findDuplicateQueueJob",
  "function queueDedupeKey",
  "meeting_page_id: pageId",
  "deduplicated: true",
  "deduplicated: false",
  "function queueStats",
  "availableQueueSlots",
  "queueAlmostFull",
  "maxQueueItems: MAX_QUEUE_ITEMS",
  "requestedLimit",
  "effectiveLimit",
  "returnedJobs: limitedJobs.length",
  "hasMore: limitedJobs.length < jobs.length",
  "function payloadByteLength",
  "Buffer.byteLength",
  "function uniqueJobIds",
  "missing",
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
  "const queueContinuityReceipt",
  "const queueReceiptBase",
  "schema: \"zhinote.zhihui.agent.queue.receipt.v1\"",
  "function queueListReceipt",
  "function queueEnqueueReceipt",
  "function queueFailureReceipt",
  "...queueContinuityReceipt",
  "ok: true",
  "status: \"ready\"",
  "nextAction: queueResult.jobs.length > 0 ? \"dispatch_available_jobs\" : \"poll_later\"",
  "syncStatus: \"agent_queue_index_read\"",
  "queueReceipt: queueListReceipt(queueResult)",
  "queueReceipt: queueEnqueueReceipt(enqueueResult",
  "metadataOnly: true",
  "rawMeetingCredentialsEchoed: false",
  "payloadEchoedInReceipt: false",
  "queueReadStatus: \"completed\"",
  "queueWriteStatus: \"not_started\"",
  "\"not_needed_existing_job\"",
  "jobId: enqueueResult.job.id",
  "zhihui-agent-queue-timeout",
  "会议页和日历本地数据不受影响",
  "timeout_ms: error.timeoutMs",
  "code: error.code",
  "retryable: error.retryable",
  "details: error.details",
  "accountSessionUnconfirmedPayload",
  "account_session_unconfirmed",
  "keeps_session_cookie: sessionUnconfirmed.keeps_session_cookie",
  "reason: sessionUnconfirmed.reason",
  "queueWriteAttempted: true",
  "const failureStatus = manualReviewRequired",
  "failureStatus,",
  "manualReviewRequired",
  "const syncStatus = manualReviewRequired",
  "syncStatus,",
  "queueWriteStatus",
  "queueWriteAttempted",
  "partialQueueWritePossible",
  "queueWriteAttempted && retryable && !manualReviewRequired",
  "requiresUserConfirmation: manualReviewRequired",
  "highRiskWriteGated: true",
  "\"manual_review_required\"",
  "\"unknown_retryable\"",
  "\"not_completed\"",
  "\"not_started\"",
  "\"retryable_unknown\"",
  "\"failed_not_completed\"",
  "\"failed_not_started\"",
  "const nextAction = manualReviewRequired",
  "nextAction,",
  "queueFailureReceipt: failureReceipt",
  "operation: \"failure\"",
  "queueAction: \"queue_operation_failed\"",
  "failureCode: code",
  "queueReadStatus: queueWriteAttempted ? \"unknown\" : \"not_started\"",
  "\"already_queued\"",
  "queueAction",
  "jobs: queueResult.jobs",
  "queueDepth: queueResult.queueDepth",
  "maxQueueItems: queueResult.maxQueueItems",
  "requestedLimit: queueResult.requestedLimit",
  "effectiveLimit: queueResult.effectiveLimit",
  "availableQueueSlots: queueResult.availableQueueSlots",
  "returnedJobs: queueResult.returnedJobs",
  "hasMore: queueResult.hasMore",
  "queueAlmostFull: queueResult.queueAlmostFull",
  "\"reused_existing_job\"",
  "\"wait_for_existing_job\"",
  "\"wait_for_runner_ack\"",
  "syncStatus: \"agent_queue_updated\"",
  "deduplicated: enqueueResult.deduplicated",
  "queueDepth: enqueueResult.queueDepth",
  "availableQueueSlots: enqueueResult.availableQueueSlots",
  "queueAlmostFull: enqueueResult.queueAlmostFull",
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
  "account_session_unconfirmed",
  "invalid_json",
  "invalid_meeting_payload",
  "zhihui_agent_queue_timeout",
  "zhihui_agent_queue_payload_too_large",
  "zhihui_agent_queue_kv_get_failed",
  "zhihui_agent_queue_kv_set_failed",
  "zhihui_agent_queue_corrupt",
  "zhihui_agent_queue_full",
  "zhihui_agent_queue_oversized",
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
  "const ackContinuityReceipt",
  "const ackReceiptBase",
  "schema: \"zhinote.zhihui.agent.queue.receipt.v1\"",
  "function queueAckReceipt",
  "...ackContinuityReceipt",
  "zhihui-agent-queue-timeout",
  "不会清空未确认任务",
  "timeout_ms: error.timeoutMs",
  "code: error.code",
  "retryable: error.retryable",
  "details: error.details",
  "queueWriteAttempted: true",
  "failureStatus: manualReviewRequired",
  "manualReviewRequired",
  "syncStatus: manualReviewRequired",
  "queueWriteStatus",
  "queueWriteAttempted",
  "partialQueueWritePossible",
  "queueWriteAttempted && retryable && !manualReviewRequired",
  "requiresUserConfirmation: manualReviewRequired",
  "highRiskWriteGated: true",
  "\"manual_review_required\"",
  "\"unknown_retryable\"",
  "\"not_completed\"",
  "\"not_started\"",
  "\"retryable_unknown\"",
  "\"failed_not_completed\"",
  "\"failed_not_started\"",
  "nextAction: manualReviewRequired",
  "ackResult.missing",
  "ok: true",
  "queueReceipt: queueAckReceipt(ackResult, jobIds.length)",
  "metadataOnly: true",
  "rawMeetingCredentialsEchoed: false",
  "payloadEchoedInReceipt: false",
  "queueReadStatus: \"completed\"",
  "\"not_needed_no_matching_jobs\"",
  "requestedAckCount",
  "acknowledgedCount",
  "missingCount",
  "acknowledgedJobIds: ackResult.acknowledged",
  "missingJobIds: ackResult.missing",
  "\"review_missing_jobs\"",
  "\"poll_for_next_jobs\"",
  "syncStatus: \"agent_queue_acknowledged\"",
  "queueDepth: ackResult.queueDepth",
  "availableQueueSlots: ackResult.availableQueueSlots",
  "queueAlmostFull: ackResult.queueAlmostFull",
  "\"partial\"",
  "\"acknowledged_existing_jobs_with_missing_ids\"",
  "unconfirmedJobsPreserved: ackResult.missing.length > 0",
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
  "zhihui_agent_queue_oversized",
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
  "const MAX_PAGE_RECORDS = 24",
  "const GLOSSARY_KV_READ_TIMEOUT_MS = 1200",
  "function kvGetForGlossary",
  "const controller = new AbortController();",
  "signal: controller.signal",
  "Promise.allSettled",
  "page_read_limit: MAX_PAGE_RECORDS",
  "page_read_failures: pageReadFailures",
  "page_read_timeout_ms: GLOSSARY_KV_READ_TIMEOUT_MS",
  "time-budgeted to keep meeting workflows responsive",
]) {
  check(helper.includes(token), `glossary helper 缺少 ${token}`);
}
check(
  !helper.includes('from "@/lib/account/server"'),
  "glossary helper 应使用短预算 KV 读取，不能复用账号通用 8 秒 KV helper 拖慢会议流程"
);
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
const payloadByteLimitBehavior = await verifyPayloadByteLimitBehavior();
check(
  payloadByteLimitBehavior,
  "agent queue 必须按真实 UTF-8 字节数限制 payload，中文内容超限时不能写入队列"
);
const ackMissingBehavior = await verifyAckMissingBehavior();
check(
  ackMissingBehavior,
  "agent queue ACK 必须返回 missing job id，且全 miss 时不能重写队列"
);
const queueCapacityBehavior = await verifyQueueCapacityBehavior();
check(
  queueCapacityBehavior,
  "agent queue 满载或超过上限时必须进入 manual review，不能静默截断未确认任务"
);
const queueListMetadataBehavior = await verifyQueueListMetadataBehavior();
check(
  queueListMetadataBehavior,
  "agent queue list 必须返回队列深度、上限、返回数量和是否还有更多任务"
);
const queueMutationMetadataBehavior = await verifyQueueMutationMetadataBehavior();
check(
  queueMutationMetadataBehavior,
  "agent queue enqueue/ack 必须返回写入或确认后的队列状态，方便 UI 和 runner 判断积压"
);
const queueDedupeBehavior = await verifyQueueDedupeBehavior();
check(
  queueDedupeBehavior,
  "agent queue 重复入同一会议录制任务时必须复用已有 job，不能重复写入队列"
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

async function verifyPayloadByteLimitBehavior() {
  const calls = { get: 0, set: 0 };
  const queue = loadAgentQueueWithFetch(async (url) => {
    const requestUrl = String(url);
    if (requestUrl.includes("/get/")) {
      calls.get += 1;
      return {
        ok: true,
        status: 200,
        async json() {
          return { result: "" };
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
    await queue.enqueueMeetingAgentJob(mockKv(), {
      job_type: "meeting_recording_request",
      payload: {
        meeting: {
          page_id: "meeting_page_utf8_limit",
          topic: "会议".repeat(12000),
        },
      },
    });
  } catch (error) {
    caught = error;
  }

  return (
    caught &&
    caught.code === "zhihui_agent_queue_payload_too_large" &&
    caught.status === 413 &&
    caught.retryable === false &&
    caught.details?.actual_payload_bytes > caught.details?.max_payload_bytes &&
    caught.details?.actual_payload_chars < caught.details?.max_payload_bytes &&
    calls.get === 0 &&
    calls.set === 0
  );
}

async function verifyAckMissingBehavior() {
  const seedJobs = [
    {
      id: "job_1",
      job_type: "meeting_recording_request",
      payload: { synthetic: true },
      created_at: "2026-07-13T00:00:00.000Z",
    },
    {
      id: "job_2",
      job_type: "meeting_recording_request",
      payload: { synthetic: true },
      created_at: "2026-07-13T00:00:01.000Z",
    },
  ];
  const calls = { get: 0, set: 0 };
  let storedQueue = JSON.stringify(seedJobs);
  const queue = loadAgentQueueWithFetch(async (url, init) => {
    const requestUrl = String(url);
    if (requestUrl.includes("/get/")) {
      calls.get += 1;
      return {
        ok: true,
        status: 200,
        async json() {
          return { result: storedQueue };
        },
      };
    }
    if (requestUrl.includes("/set/")) {
      calls.set += 1;
      storedQueue = typeof init?.body === "string" ? init.body : "";
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

  const partial = await queue.ackMeetingAgentJobs(mockKv(), [
    "job_1",
    "missing_job",
    " job_1 ",
    "",
  ]);
  const afterPartial = JSON.parse(storedQueue);
  const allMissing = await queue.ackMeetingAgentJobs(mockKv(), ["missing_only"]);
  const afterAllMissing = JSON.parse(storedQueue);

  return (
    Array.isArray(partial.acknowledged) &&
    partial.acknowledged.length === 1 &&
    partial.acknowledged[0] === "job_1" &&
    Array.isArray(partial.missing) &&
    partial.missing.length === 1 &&
    partial.missing[0] === "missing_job" &&
    afterPartial.length === 1 &&
    afterPartial[0].id === "job_2" &&
    Array.isArray(allMissing.acknowledged) &&
    allMissing.acknowledged.length === 0 &&
    allMissing.missing.length === 1 &&
    allMissing.missing[0] === "missing_only" &&
    afterAllMissing.length === 1 &&
    afterAllMissing[0].id === "job_2" &&
    calls.get === 2 &&
    calls.set === 1
  );
}

async function verifyQueueCapacityBehavior() {
  const fullQueue = Array.from({ length: 200 }, (_, index) => ({
    id: `job_${index + 1}`,
    job_type: "meeting_recording_request",
    payload: { synthetic: true, index },
    created_at: `2026-07-13T00:00:${String(index % 60).padStart(2, "0")}.000Z`,
  }));
  const oversizedQueue = [
    ...fullQueue,
    {
      id: "job_201",
      job_type: "meeting_recording_request",
      payload: { synthetic: true, index: 201 },
      created_at: "2026-07-13T00:03:21.000Z",
    },
  ];

  const fullCalls = { get: 0, set: 0 };
  const fullQueueModule = loadAgentQueueWithFetch(async (url) => {
    const requestUrl = String(url);
    if (requestUrl.includes("/get/")) {
      fullCalls.get += 1;
      return {
        ok: true,
        status: 200,
        async json() {
          return { result: JSON.stringify(fullQueue) };
        },
      };
    }
    if (requestUrl.includes("/set/")) {
      fullCalls.set += 1;
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

  let fullError = null;
  try {
    await fullQueueModule.enqueueMeetingAgentJob(mockKv(), {
      job_type: "meeting_recording_request",
      payload: syntheticRecordingPayload({ pageId: "meeting_page_2" }),
    });
  } catch (error) {
    fullError = error;
  }

  const oversizedCalls = { get: 0, set: 0 };
  const oversizedQueueModule = loadAgentQueueWithFetch(async (url) => {
    const requestUrl = String(url);
    if (requestUrl.includes("/get/")) {
      oversizedCalls.get += 1;
      return {
        ok: true,
        status: 200,
        async json() {
          return { result: JSON.stringify(oversizedQueue) };
        },
      };
    }
    if (requestUrl.includes("/set/")) {
      oversizedCalls.set += 1;
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

  let oversizedError = null;
  try {
    await oversizedQueueModule.listMeetingAgentJobs(mockKv(), 25);
  } catch (error) {
    oversizedError = error;
  }

  return (
    fullError &&
    fullError.code === "zhihui_agent_queue_full" &&
    fullError.status === 409 &&
    fullError.retryable === false &&
    fullError.details?.actual_queue_items === 200 &&
    fullError.details?.manual_review_required === true &&
    fullError.details?.unconfirmed_jobs_preserved === true &&
    fullCalls.get === 1 &&
    fullCalls.set === 0 &&
    oversizedError &&
    oversizedError.code === "zhihui_agent_queue_oversized" &&
    oversizedError.status === 409 &&
    oversizedError.retryable === false &&
    oversizedError.details?.actual_queue_items === 201 &&
    oversizedError.details?.manual_review_required === true &&
    oversizedError.details?.unconfirmed_jobs_preserved === true &&
    oversizedCalls.get === 1 &&
    oversizedCalls.set === 0
  );
}

async function verifyQueueListMetadataBehavior() {
  const seedJobs = Array.from({ length: 3 }, (_, index) => ({
    id: `job_${index + 1}`,
    job_type: "meeting_recording_request",
    payload: { synthetic: true, index },
    created_at: `2026-07-13T00:01:0${index}.000Z`,
  }));
  const calls = { get: 0, set: 0 };
  const queue = loadAgentQueueWithFetch(async (url) => {
    const requestUrl = String(url);
    if (requestUrl.includes("/get/")) {
      calls.get += 1;
      return {
        ok: true,
        status: 200,
        async json() {
          return { result: JSON.stringify(seedJobs) };
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

  const result = await queue.listMeetingAgentJobs(mockKv(), 2);
  const clampedResult = await queue.listMeetingAgentJobs(mockKv(), 5000);

  return (
    Array.isArray(result.jobs) &&
    result.jobs.length === 2 &&
    result.jobs[0].id === "job_1" &&
    result.queueDepth === 3 &&
    result.maxQueueItems === 200 &&
    result.requestedLimit === 2 &&
    result.effectiveLimit === 2 &&
    result.availableQueueSlots === 197 &&
    result.returnedJobs === 2 &&
    result.hasMore === true &&
    clampedResult.requestedLimit === 5000 &&
    clampedResult.effectiveLimit === 50 &&
    clampedResult.returnedJobs === 3 &&
    clampedResult.hasMore === false &&
    result.queueAlmostFull === false &&
    calls.get === 2 &&
    calls.set === 0
  );
}

async function verifyQueueMutationMetadataBehavior() {
  const seedJobs = [
    {
      id: "job_seed",
      job_type: "meeting_recording_request",
      payload: syntheticRecordingPayload({ pageId: "meeting_page_seed" }),
      created_at: "2026-07-13T00:02:00.000Z",
    },
  ];
  const calls = { get: 0, set: 0 };
  let storedQueue = JSON.stringify(seedJobs);
  const queue = loadAgentQueueWithFetch(async (url, init) => {
    const requestUrl = String(url);
    if (requestUrl.includes("/get/")) {
      calls.get += 1;
      return {
        ok: true,
        status: 200,
        async json() {
          return { result: storedQueue };
        },
      };
    }
    if (requestUrl.includes("/set/")) {
      calls.set += 1;
      storedQueue = typeof init?.body === "string" ? init.body : "";
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

  const first = await queue.enqueueMeetingAgentJob(mockKv(), {
    job_type: "meeting_recording_request",
    payload: syntheticRecordingPayload({ pageId: "meeting_page_mutation" }),
  });
  const duplicate = await queue.enqueueMeetingAgentJob(mockKv(), {
    job_type: "meeting_recording_request",
    payload: syntheticRecordingPayload({ pageId: "meeting_page_mutation" }),
  });
  const ack = await queue.ackMeetingAgentJobs(mockKv(), [first.job.id]);
  const storedJobs = JSON.parse(storedQueue);

  return (
    first.deduplicated === false &&
    first.queueDepth === 2 &&
    first.maxQueueItems === 200 &&
    first.availableQueueSlots === 198 &&
    first.queueAlmostFull === false &&
    duplicate.deduplicated === true &&
    duplicate.job.id === first.job.id &&
    duplicate.queueDepth === 2 &&
    duplicate.availableQueueSlots === 198 &&
    ack.acknowledged.length === 1 &&
    ack.acknowledged[0] === first.job.id &&
    ack.missing.length === 0 &&
    ack.queueDepth === 1 &&
    ack.availableQueueSlots === 199 &&
    ack.queueAlmostFull === false &&
    Array.isArray(storedJobs) &&
    storedJobs.length === 1 &&
    storedJobs[0].id === "job_seed" &&
    calls.get === 3 &&
    calls.set === 2
  );
}

async function verifyQueueDedupeBehavior() {
  const calls = { get: 0, set: 0 };
  let storedQueue = "";
  const queue = loadAgentQueueWithFetch(async (url, init) => {
    const requestUrl = String(url);
    if (requestUrl.includes("/get/")) {
      calls.get += 1;
      return {
        ok: true,
        status: 200,
        async json() {
          return { result: storedQueue };
        },
      };
    }
    if (requestUrl.includes("/set/")) {
      calls.set += 1;
      storedQueue = typeof init?.body === "string" ? init.body : "";
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

  const first = await queue.enqueueMeetingAgentJob(mockKv(), {
    job_type: "meeting_recording_request",
    payload: syntheticRecordingPayload({ pageId: "meeting_page_1" }),
  });
  const second = await queue.enqueueMeetingAgentJob(mockKv(), {
    job_type: "meeting_recording_request",
    payload: syntheticRecordingPayload({ pageId: "meeting_page_1" }),
  });
  const third = await queue.enqueueMeetingAgentJob(mockKv(), {
    job_type: "meeting_recording_request",
    payload: syntheticRecordingPayload({
      pageId: "meeting_page_1",
      recordingDevice: "Mac Mini",
    }),
  });
  const storedJobs = JSON.parse(storedQueue);

  return (
    first.job.id === second.job.id &&
    first.job.id !== third.job.id &&
    first.deduplicated === false &&
    second.deduplicated === true &&
    third.deduplicated === false &&
    calls.get === 3 &&
    calls.set === 2 &&
    Array.isArray(storedJobs) &&
    storedJobs.length === 2 &&
    storedJobs[0].id === first.job.id &&
    storedJobs[1].id === third.job.id
  );
}

function syntheticRecordingPayload({
  pageId,
  recordingDevice = "MacBook Pro",
}) {
  return {
    schema: "zhinote.zhihui.meeting-recording-request.v1",
    source: {
      type: "zhinote_schedule_page",
      account_id: "account_1",
      account_email_hash_only: true,
    },
    meeting: {
      page_id: pageId,
      title: "Synthetic meeting",
      topic: "Synthetic meeting",
      organizer: "Synthetic organizer",
      platform: "Zoom",
      date: "2026-07-13",
      time: "10:00-11:00",
      join_url: "https://example.invalid/meeting",
      meeting_id: "123456",
      passcode: "hidden",
      recording_device: recordingDevice,
      fallback_device: "MacBook Pro",
      priority: "default",
      transcription_model: "qwen",
    },
    target_runner_id: recordingDevice === "Mac Mini" ? "mac-mini" : "macbook-pro",
    fallback_runner_id: "macbook-pro",
    priority: "default",
    routing: {
      target_runner_id:
        recordingDevice === "Mac Mini" ? "mac-mini" : "macbook-pro",
      fallback_runner_id: "macbook-pro",
      meeting_account_key: "zoom",
    },
    run_now: false,
  };
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
    Buffer,
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
