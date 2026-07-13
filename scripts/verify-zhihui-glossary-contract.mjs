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
const queueReceipts = read("src/lib/meetings/agentQueueReceipts.ts");
const requestBody = read("src/lib/meetings/requestBody.ts");
const jobsRoute = read("src/app/api/meetings/agent/jobs/route.ts");
const ackRoute = read("src/app/api/meetings/agent/jobs/ack/route.ts");
const readme = read("README.md");
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
  "function glossaryJson",
  "function glossaryFailurePayload",
  "\"Cache-Control\", \"no-store, max-age=0\"",
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
  "syncCenterStatus: retryable",
  "pendingWriteCount: 0",
  "failedWriteCount: 0",
  "localPendingWrite: false",
  "safeToContinueLocalUse: true",
  "pendingGlossaryReadCount: 0",
  "failedGlossaryReadCount: retryable ? 1 : 0",
  "manualReviewGlossaryCount: 0",
  "safeToRefreshCaches: true",
  "cacheRefreshStatus: \"safe\"",
  "cacheRefreshBlockedBy: []",
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
  "MEETING_AGENT_QUEUE_LEASE_MS = 90 * 1000",
  "MAX_RUNNER_ID_CHARS = 80",
  "MAX_LISTED_QUEUE_JOBS = 50",
  "MAX_QUEUE_RESPONSE_BYTES = 4 * 1024 * 1024",
  "export interface MeetingAgentQueueLease",
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
  "function readBoundedQueueResponseJson",
  "function readBoundedQueueResponseText",
  "response.headers.get(\"content-length\")",
  "response.body.getReader()",
  "bytesRead += value.byteLength",
  "await reader.cancel()",
  "JSON.parse(body.text)",
  "function queueResponseTooLargeError",
  "function queueStorageTooLargeError",
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
  "zhihui_agent_queue_response_too_large",
  "zhihui_agent_queue_storage_too_large",
  "max_response_bytes: MAX_QUEUE_RESPONSE_BYTES",
  "actual_response_bytes: actualResponseBytes",
  "max_storage_bytes: MAX_QUEUE_RESPONSE_BYTES",
  "actual_storage_bytes: actualStorageBytes",
  "upstream_status: res.status",
  "function queueCorruptError",
  "function queueFullError",
  "function queueOversizedError",
  "function findDuplicateQueueJob",
  "function queueDedupeKey",
  "meeting_page_id: pageId",
  "updatedExisting: true",
  "updatedExisting: false",
  "leasedDuplicatePreserved",
  "deduplicated: true",
  "deduplicated: false",
  "function queueStats",
  "function queueVisibility",
  "function isLeaseActive",
  "function normalizeRunnerId",
  "function hashRunnerId",
  "function isQueueLease",
  "createHash(\"sha256\")",
  "zhihui_agent_queue_claim_runner_required",
  "lease_id: `lease_${randomUUID()}`",
  "runner_id_hash: runnerIdHash",
  "expires_at: expiresAt",
  "attempts: (job.lease?.attempts ?? 0) + 1",
  "availableQueueSlots",
  "queueAlmostFull",
  "maxQueueItems: MAX_QUEUE_ITEMS",
  "requestedLimit",
  "effectiveLimit",
  "returnedJobs: limitedJobs.length",
  "claimMode",
  "claimedJobs",
  "availableQueueJobs",
  "leasedQueueJobs",
  "expiredLeaseJobs",
  "leaseDurationMs",
  "leaseExpiresAt",
  "hasMore: limitedJobs.length < visibility.availableJobs.length",
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
check(
  !agentQueue.includes("res.json()") && !agentQueue.includes("response.json()"),
  "agent queue 读取 KV 响应必须先按字节限额读取，不能直接 response.json()"
);
for (const token of [
  "MEETING_AGENT_QUEUE_RECEIPT_STALE_AFTER_MS",
  "MEETING_AGENT_QUEUE_POLL_INTERVAL_MS",
  "buildMeetingAgentQueueReceiptTiming",
  "buildMeetingAgentQueuePendingStatus",
  "buildMeetingAgentQueueFailureStatus",
  "MeetingAgentQueueSyncCenterStatus",
  "MeetingAgentQueueCacheRefreshStatus",
  "receiptGeneratedAt",
  "receiptStaleAfter",
  "receiptFreshnessWindowMs",
  "recommendedNextPollMs",
  "recommendedNextPollAt",
  "manual_review: null",
  "pendingWriteCount: 0",
  "failedWriteCount: 0",
  "localPendingWrite: false",
  "pendingAgentJobCount: queueDepth",
  "pendingRunnerAckCount: queueDepth",
  "failedAgentJobCount: 0",
  "agentQueuePending: queueDepth > 0",
  "safeToContinueLocalUse: true",
  "safeToRefreshCaches:",
  "cacheRefreshStatus:",
  "cacheRefreshBlockedBy",
  "\"blocked_pending_agent_jobs\"",
  "\"blocked_manual_review\"",
  "\"blocked_retry_later\"",
  "\"agent_jobs_pending\"",
  "\"attention_recommended\"",
  "\"retryable_unknown\"",
]) {
  check(queueReceipts.includes(token), `agent queue receipts 缺少 ${token}`);
}
check(
  verifyReceiptTimingBehavior(),
  "agent queue receipt timing 必须生成 active/idle/retry/manual review 的过期时间和建议轮询时间"
);
check(
  verifyQueueRefreshSafetyBehavior(),
  "agent queue receipts 只能在队列空且无复核/异常时允许刷新本地缓存"
);
check(
  requestBody.includes("export async function readBoundedJsonBody") &&
    requestBody.includes("request.headers.get(\"content-length\")") &&
    requestBody.includes("request.body.getReader()") &&
    requestBody.includes("bytesRead += value.byteLength") &&
    requestBody.includes("await reader.cancel()") &&
    requestBody.includes("JSON.parse(bodyText.text)") &&
    requestBody.includes('reason: "payload_too_large"') &&
    requestBody.includes('reason: "invalid_json"'),
  "meeting request body helper 必须在 JSON.parse 前按字节限制请求体"
);
check(
  !jobsRoute.includes("request.json()") && !ackRoute.includes("request.json()"),
  "agent queue jobs/ack routes 不能直接 request.json()，必须先走 bounded request body helper"
);
for (const token of [
  "MeetingAgentQueueTimeoutError",
  "MeetingAgentQueueFailureError",
  "buildMeetingAgentQueuePendingStatus",
  "buildMeetingAgentQueueFailureStatus",
  "function queueJson",
  "readBoundedJsonBody",
  "MAX_QUEUE_REQUEST_BYTES",
  "function queueRequestTooLarge",
  "zhihui_agent_queue_request_too_large",
  "max_request_bytes: MAX_QUEUE_REQUEST_BYTES",
  "\"Cache-Control\", \"no-store, max-age=0\"",
  "const queueContinuityReceipt",
  "const queueReceiptBase",
  "schema: \"zhinote.zhihui.agent.queue.receipt.v1\"",
  "buildMeetingAgentQueueReceiptTiming",
  "pollMode: queueResult.returnedJobs > 0 ? \"active\" : \"idle\"",
  "pollMode: \"active\"",
  "pollMode: manualReviewRequired",
  "function queueListReceipt",
  "function queueListAction",
  "function queueListWriteStatus",
  "function queueEnqueueWriteStatus",
  "function queueEnqueueReceipt",
  "function queueFailureReceipt",
  "function queueReceiptTimingFields",
  "...queueReceiptTimingFields(queueReceipt)",
  "const receiptTiming = queueReceiptTimingFields(failureReceipt)",
  "receiptGeneratedAt: receipt.receiptGeneratedAt",
  "receiptStaleAfter: receipt.receiptStaleAfter",
  "receiptFreshnessWindowMs: receipt.receiptFreshnessWindowMs",
  "pollMode: receipt.pollMode",
  "recommendedNextPollMs: receipt.recommendedNextPollMs",
  "recommendedNextPollAt: receipt.recommendedNextPollAt",
  "...queueContinuityReceipt",
  "ok: true",
  "operation: \"list\"",
  "status: \"ready\"",
  "queueResult.claimedJobs > 0",
  "? \"process_claimed_jobs\"",
  ": queueResult.jobs.length > 0",
  "? \"dispatch_available_jobs\"",
  ": \"poll_later\"",
  "const claimMode = url.searchParams.get(\"claim\") === \"true\"",
  "request.headers.get(\"x-zhihui-runner-id\")",
  "claimMode ? { claim: true, runnerId } : {}",
  "\"process_claimed_jobs\"",
  "syncStatus: \"agent_queue_index_read\"",
  "queueAction: queueListAction(queueResult)",
  "queueReadStatus: \"completed\"",
  "queueWriteStatus: queueListWriteStatus(queueResult)",
  "const queueReceipt = queueListReceipt(queueResult, queueHealth)",
  "const enqueueHealth = queueCapacityHealth(enqueueResult)",
  "const queueReceipt = queueEnqueueReceipt(",
  "{ runNow: body.runNow === true }",
  "const enqueueWriteStatus = queueEnqueueWriteStatus(enqueueResult)",
  "metadataOnly: true",
  "rawMeetingCredentialsEchoed: false",
  "payloadEchoedInReceipt: false",
  "queueReadStatus: \"completed\"",
  "\"claim_available_jobs\"",
  "\"read_available_jobs\"",
  "\"lease_claim_completed\"",
  "\"not_needed_no_available_jobs\"",
  "\"not_started\"",
  "\"not_needed_existing_job\"",
  "\"updated_existing_job\"",
  "jobId: enqueueResult.job.id",
  "updatedExisting: enqueueResult.updatedExisting",
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
  "const queueFailureStatus = buildMeetingAgentQueueFailureStatus",
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
  "...queueFailureStatus",
  "queueFailureReceipt: failureReceipt",
  "operation: \"failure\"",
  "queueAction: \"queue_operation_failed\"",
  "failureCode: code",
  "queueReadStatus: queueWriteAttempted ? \"unknown\" : \"not_started\"",
  "\"already_queued\"",
  "operation: \"enqueue\"",
  "queueAction",
  "queueWriteStatus: enqueueWriteStatus",
  "jobs: queueResult.jobs",
  "queueDepth: queueResult.queueDepth",
  "maxQueueItems: queueResult.maxQueueItems",
  "requestedLimit: queueResult.requestedLimit",
  "effectiveLimit: queueResult.effectiveLimit",
  "availableQueueSlots: queueResult.availableQueueSlots",
  "returnedJobs: queueResult.returnedJobs",
  "hasMore: queueResult.hasMore",
  "queueAlmostFull: queueResult.queueAlmostFull",
  "claimMode: queueResult.claimMode",
  "claimedJobs: queueResult.claimedJobs",
  "availableQueueJobs: queueResult.availableQueueJobs",
  "leasedQueueJobs: queueResult.leasedQueueJobs",
  "expiredLeaseJobs: queueResult.expiredLeaseJobs",
  "leaseDurationMs: queueResult.leaseDurationMs",
  "leaseExpiresAt: queueResult.leaseExpiresAt",
  "function queueListHealth",
  "\"queue_almost_full\"",
  "\"expired_leases_reclaimable\"",
  "\"attention_recommended\"",
  "\"healthy\"",
  "function queueCapacityHealth",
  "queueHealth: queueHealth.queueHealth",
  "attentionRequired: queueHealth.attentionRequired",
  "attentionReason: queueHealth.attentionReason",
  "reclaimableLeaseCount: queueHealth.reclaimableLeaseCount",
  "queueHealth: enqueueHealth.queueHealth",
  "attentionRequired: enqueueHealth.attentionRequired",
  "attentionReason: enqueueHealth.attentionReason",
  "reclaimableLeaseCount: 0",
  "manualReviewRequired: false",
  "manualReviewJobCount: 0",
  "...queuePendingStatus",
  "ackContract: \"lease_aware\"",
  "ackRequiresLease: queueResult.claimMode",
  "ackLeaseSource: queueResult.claimMode ? \"job.lease.lease_id\" : null",
  "runnerIdEchoed: false",
  "\"reused_existing_job\"",
  "\"updated_existing_job\"",
  "\"wait_for_existing_job\"",
  "\"wait_for_runner_ack\"",
  "syncStatus: \"agent_queue_updated\"",
  "deduplicated: enqueueResult.deduplicated",
  "updatedExisting: enqueueResult.updatedExisting",
  "leasedDuplicatePreserved: enqueueResult.leasedDuplicatePreserved",
  "\"created_followup_job_for_leased_duplicate\"",
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
  "zhihui_agent_queue_request_too_large",
  "zhihui_agent_queue_claim_runner_required",
  "invalid_json",
  "invalid_meeting_payload",
  "zhihui_agent_queue_timeout",
  "zhihui_agent_queue_payload_too_large",
  "zhihui_agent_queue_kv_get_failed",
  "zhihui_agent_queue_kv_set_failed",
  "zhihui_agent_queue_corrupt",
  "zhihui_agent_queue_full",
  "zhihui_agent_queue_oversized",
  "zhihui_agent_queue_response_too_large",
  "zhihui_agent_queue_storage_too_large",
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
  "function ackJson",
  "readBoundedJsonBody",
  "MAX_ACK_REQUEST_BYTES",
  "function ackRequestTooLarge",
  "zhihui_agent_queue_ack_request_too_large",
  "max_request_bytes: MAX_ACK_REQUEST_BYTES",
  "MAX_ACK_JOB_IDS",
  "MAX_ACK_JOB_ID_CHARS",
  "MAX_ACK_LEASE_ID_CHARS",
  "ACK_JOB_ID_PATTERN",
  "function normalizeAckJobIds",
  "function invalidAckJobIds",
  "function normalizeAckJobLeases",
  "function invalidAckJobLeases",
  "invalid_ack_job_ids",
  "invalid_ack_job_leases",
  "zhihui_agent_queue_ack_too_many_ids",
  "max_ack_job_ids: MAX_ACK_JOB_IDS",
  "max_ack_job_id_chars: MAX_ACK_JOB_ID_CHARS",
  "max_ack_lease_id_chars: MAX_ACK_LEASE_ID_CHARS",
  "allowed_ack_job_id_pattern: ACK_JOB_ID_PATTERN.source",
  "allowed_ack_lease_id_pattern: ACK_JOB_ID_PATTERN.source",
  "raw_ack_job_ids_echoed: false",
  "raw_ack_job_leases_echoed: false",
  "queueWriteAttempted = false",
  "\"Cache-Control\", \"no-store, max-age=0\"",
  "const ackContinuityReceipt",
  "const ackReceiptBase",
  "schema: \"zhinote.zhihui.agent.queue.receipt.v1\"",
  "buildMeetingAgentQueueReceiptTiming",
  "buildMeetingAgentQueuePendingStatus",
  "buildMeetingAgentQueueFailureStatus",
  "pollMode: manualReviewRequired",
  "pollMode: hasPreservedJobs ? \"manual_review\" : \"idle\"",
  "function queueAckReceipt",
  "function queueAckHealth",
  "function ackFailureReceipt",
  "function ackReceiptTimingFields",
  "...ackReceiptTimingFields(queueReceipt)",
  "const receiptTiming = ackReceiptTimingFields(failureReceipt)",
  "operation: \"ack_failure\"",
  "receiptGeneratedAt: receipt.receiptGeneratedAt",
  "receiptStaleAfter: receipt.receiptStaleAfter",
  "receiptFreshnessWindowMs: receipt.receiptFreshnessWindowMs",
  "pollMode: receipt.pollMode",
  "recommendedNextPollMs: receipt.recommendedNextPollMs",
  "recommendedNextPollAt: receipt.recommendedNextPollAt",
  "...ackContinuityReceipt",
  "zhihui-agent-queue-timeout",
  "不会清空未确认任务",
  "timeout_ms: error.timeoutMs",
  "code: error.code",
  "retryable: error.retryable",
  "details: error.details",
  "queueWriteAttempted: true",
  "const failureStatus = manualReviewRequired",
  "failureStatus,",
  "manualReviewRequired",
  "const syncStatus = manualReviewRequired",
  "syncStatus,",
  "queueWriteStatus",
  "queueReadStatus: queueWriteAttempted ? \"unknown\" : \"not_started\"",
  "queueWriteAttempted",
  "partialQueueWritePossible",
  "const queueFailureStatus = buildMeetingAgentQueueFailureStatus",
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
  "...queueFailureStatus",
  "ackFailureReceipt: failureReceipt",
  "operation: \"ack_failure\"",
  "queueAction: \"ack_operation_failed\"",
  "failureCode: code",
  "queueReadStatus: queueWriteAttempted ? \"unknown\" : \"not_started\"",
  "ackResult.missing",
  "ackResult.leaseMismatched",
  "requestedAckCount: normalizedAck.requestedAckCount",
  "requestedLeaseCount: normalizedAckLeases.requestedLeaseCount",
  "acknowledgedCount",
  "missingCount",
  "unconfirmedJobCount",
  "const ackCompletionStatus = hasUnconfirmedJobs",
  "const ackSyncStatus = hasUnconfirmedJobs",
  "const ackWriteStatus = ackQueueWriteStatus(acknowledgedCount)",
  "\"partial_manual_review_required\"",
  "operation: \"ack\"",
  "ackCompletionStatus,",
  "syncStatus: ackSyncStatus",
  "queueReadStatus: \"completed\"",
  "queueWriteStatus: ackWriteStatus",
  "const ackHealth = queueAckHealth",
  "\"ack_unconfirmed_jobs_preserved\"",
  "ackContract: \"lease_aware\"",
  "manualReviewRequired: hasUnconfirmedJobs",
  "manualReviewJobCount: unconfirmedJobCount",
  "...queuePendingStatus",
  "ok: true",
  "const queueReceipt = queueAckReceipt(",
  "metadataOnly: true",
  "rawMeetingCredentialsEchoed: false",
  "payloadEchoedInReceipt: false",
  "queueReadStatus: \"completed\"",
  "function ackQueueWriteStatus",
  "\"not_needed_no_matching_jobs\"",
  "requestedAckCount",
  "requestedLeaseCount",
  "acknowledgedCount",
  "missingCount",
  "leaseMismatchCount",
  "acknowledgedJobIds: ackResult.acknowledged",
  "missingJobIds: ackResult.missing",
  "leaseMismatchedJobIds: ackResult.leaseMismatched",
  "\"review_missing_or_lease_mismatched_jobs\"",
  "\"poll_for_next_jobs\"",
  "\"agent_queue_acknowledged\"",
  "\"agent_queue_ack_partial_manual_review\"",
  "queueDepth: ackResult.queueDepth",
  "availableQueueSlots: ackResult.availableQueueSlots",
  "queueAlmostFull: ackResult.queueAlmostFull",
  "queueHealth: ackHealth.queueHealth",
  "attentionRequired: ackHealth.attentionRequired",
  "attentionReason: ackHealth.attentionReason",
  "reclaimableLeaseCount: ackHealth.reclaimableLeaseCount",
  "const hasPreservedJobs = preservedCount > 0",
  "const ackSyncStatus = hasPreservedJobs",
  "manualReviewRequired: hasPreservedJobs",
  "manualReviewJobCount: preservedCount",
  "\"partial\"",
  "\"acknowledged_existing_jobs_with_missing_or_lease_mismatched_ids\"",
  "unconfirmedJobsPreserved: hasUnconfirmedJobs",
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
  "zhihui_agent_queue_ack_request_too_large",
  "invalid_ack_job_ids",
  "invalid_ack_job_leases",
  "zhihui_agent_queue_ack_too_many_ids",
  "invalid_json",
  "zhihui_agent_queue_timeout",
  "zhihui_agent_queue_kv_get_failed",
  "zhihui_agent_queue_kv_set_failed",
  "zhihui_agent_queue_corrupt",
  "zhihui_agent_queue_oversized",
  "zhihui_agent_queue_response_too_large",
  "zhihui_agent_queue_storage_too_large",
  "zhihui_agent_queue_ack_failed",
]) {
  check(
    ackRoute.includes(code) || agentQueue.includes(code),
    `jobs ack route 缺少稳定失败 code ${code}`
  );
}
for (const token of [
  "ZhiHui agent queue consumers must use the lease-aware ACK contract",
  "GET /api/meetings/agent/jobs?claim=true",
  "POST /api/meetings/agent/jobs/ack",
  "job_leases",
  "lease.lease_id",
  "Missing, lease-less, or mismatched ACKs",
]) {
  check(readme.includes(token), `README 缺少 ZhiHui runner ACK 合同说明 ${token}`);
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
for (const token of [
  "ok: true",
  'syncStatus: "glossary_read_completed"',
  'glossaryReadStatus: "completed"',
  'syncCenterStatus: "idle"',
  "pendingWriteCount: 0",
  "failedWriteCount: 0",
  "localPendingWrite: false",
  "safeToContinueLocalUse: true",
  "pendingGlossaryReadCount: 0",
  "failedGlossaryReadCount: 0",
  "manualReviewGlossaryCount: 0",
  "safeToRefreshCaches: true",
  'cacheRefreshStatus: "safe"',
  "cacheRefreshBlockedBy: []",
  "manualReviewRequired: false",
  "requiresUserConfirmation: false",
  "highRiskWriteGated: true",
  "termsReturned: true",
]) {
  check(helper.includes(token), `glossary helper 成功回执缺少 ${token}`);
}

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
const ackLeaseMismatchBehavior = await verifyAckLeaseMismatchBehavior();
check(
  ackLeaseMismatchBehavior,
  "agent queue ACK 带 lease 时必须校验 lease id，不匹配的任务必须保留且不能被误删"
);
const queueCapacityBehavior = await verifyQueueCapacityBehavior();
check(
  queueCapacityBehavior,
  "agent queue 满载或超过上限时必须进入 manual review，不能静默截断未确认任务"
);
const queueResponseByteLimitBehavior = await verifyQueueResponseByteLimitBehavior();
check(
  queueResponseByteLimitBehavior,
  "agent queue 读取 KV 响应必须先按字节限额，超大响应进入 manual review 且不能写回"
);
const queueStorageByteLimitBehavior = await verifyQueueStorageByteLimitBehavior();
check(
  queueStorageByteLimitBehavior,
  "agent queue 写入 KV 前必须按字节限额，超大写入进入 manual review 且不能调用 set"
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
const leasedDuplicateQueueBehavior = await verifyLeasedDuplicateQueueBehavior();
check(
  leasedDuplicateQueueBehavior,
  "agent queue 不能用新的重复 payload 覆盖已认领 job；必须为后续变更另建可见任务"
);
const queueClaimLeaseBehavior = await verifyQueueClaimLeaseBehavior();
check(
  queueClaimLeaseBehavior,
  "agent queue 认领任务时必须写入短租约，未过期租约不可重复派发，过期后必须重新可见"
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
          return kvJsonResponse({ result: testCase.result });
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
      return kvJsonResponse({ result: "" });
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
      return kvJsonResponse({ result: storedQueue });
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

async function verifyAckLeaseMismatchBehavior() {
  const seedJobs = [
    {
      id: "job_lease_1",
      job_type: "meeting_recording_request",
      payload: { synthetic: true },
      created_at: "2026-07-13T00:00:00.000Z",
      lease: {
        lease_id: "lease_correct_1",
        runner_id_hash: "runnerhash000001",
        leased_at: "2026-07-13T00:00:00.000Z",
        expires_at: "2026-07-13T00:05:00.000Z",
        attempts: 1,
      },
    },
    {
      id: "job_lease_2",
      job_type: "meeting_recording_request",
      payload: { synthetic: true },
      created_at: "2026-07-13T00:00:01.000Z",
      lease: {
        lease_id: "lease_correct_2",
        runner_id_hash: "runnerhash000002",
        leased_at: "2026-07-13T00:00:01.000Z",
        expires_at: "2026-07-13T00:05:01.000Z",
        attempts: 1,
      },
    },
  ];
  const calls = { get: 0, set: 0 };
  let storedQueue = JSON.stringify(seedJobs);
  const queue = loadAgentQueueWithFetch(async (url, init) => {
    const requestUrl = String(url);
    if (requestUrl.includes("/get/")) {
      calls.get += 1;
      return kvJsonResponse({ result: storedQueue });
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

  const partial = await queue.ackMeetingAgentJobs(
    mockKv(),
    ["job_lease_1", "job_lease_2", "missing_lease_job"],
    {
      jobLeases: {
        job_lease_1: "lease_correct_1",
        job_lease_2: "lease_wrong_2",
      },
    }
  );
  const afterPartial = JSON.parse(storedQueue);
  const allMismatch = await queue.ackMeetingAgentJobs(
    mockKv(),
    ["job_lease_2"],
    { jobLeases: { job_lease_2: "lease_wrong_2" } }
  );
  const afterAllMismatch = JSON.parse(storedQueue);
  const missingLease = await queue.ackMeetingAgentJobs(mockKv(), [
    "job_lease_2",
  ]);
  const afterMissingLease = JSON.parse(storedQueue);

  return (
    Array.isArray(partial.acknowledged) &&
    partial.acknowledged.length === 1 &&
    partial.acknowledged[0] === "job_lease_1" &&
    partial.missing.length === 1 &&
    partial.missing[0] === "missing_lease_job" &&
    Array.isArray(partial.leaseMismatched) &&
    partial.leaseMismatched.length === 1 &&
    partial.leaseMismatched[0] === "job_lease_2" &&
    afterPartial.length === 1 &&
    afterPartial[0].id === "job_lease_2" &&
    Array.isArray(allMismatch.acknowledged) &&
    allMismatch.acknowledged.length === 0 &&
    allMismatch.missing.length === 0 &&
    allMismatch.leaseMismatched.length === 1 &&
    allMismatch.leaseMismatched[0] === "job_lease_2" &&
    afterAllMismatch.length === 1 &&
    afterAllMismatch[0].id === "job_lease_2" &&
    missingLease.acknowledged.length === 0 &&
    missingLease.missing.length === 0 &&
    missingLease.leaseMismatched.length === 1 &&
    missingLease.leaseMismatched[0] === "job_lease_2" &&
    afterMissingLease.length === 1 &&
    afterMissingLease[0].id === "job_lease_2" &&
    calls.get === 3 &&
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
      return kvJsonResponse({ result: JSON.stringify(fullQueue) });
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
      return kvJsonResponse({ result: JSON.stringify(oversizedQueue) });
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

async function verifyQueueResponseByteLimitBehavior() {
  const calls = { get: 0, set: 0 };
  const queue = loadAgentQueueWithFetch(async (url) => {
    const requestUrl = String(url);
    if (requestUrl.includes("/get/")) {
      calls.get += 1;
      return new Response("{}", {
        status: 200,
        headers: {
          "content-type": "application/json",
          "content-length": String(4 * 1024 * 1024 + 1),
        },
      });
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
    await queue.listMeetingAgentJobs(mockKv(), 25);
  } catch (error) {
    caught = error;
  }

  return (
    caught &&
    caught.code === "zhihui_agent_queue_response_too_large" &&
    caught.status === 409 &&
    caught.retryable === false &&
    caught.details?.manual_review_required === true &&
    caught.details?.unconfirmed_jobs_preserved === true &&
    caught.details?.actual_response_bytes === 4 * 1024 * 1024 + 1 &&
    calls.get === 1 &&
    calls.set === 0
  );
}

async function verifyQueueStorageByteLimitBehavior() {
  const { seedJobs, newPayload } = buildQueueStorageLimitFixture();
  const calls = { get: 0, set: 0 };
  let storedQueue = JSON.stringify(seedJobs);
  const queue = loadAgentQueueWithFetch(async (url, init) => {
    const requestUrl = String(url);
    if (requestUrl.includes("/get/")) {
      calls.get += 1;
      return kvJsonResponse({ result: storedQueue });
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

  let caught = null;
  try {
    await queue.enqueueMeetingAgentJob(mockKv(), {
      job_type: "meeting_recording_request",
      payload: newPayload,
    });
  } catch (error) {
    caught = error;
  }

  return (
    caught &&
    caught.code === "zhihui_agent_queue_storage_too_large" &&
    caught.status === 409 &&
    caught.retryable === false &&
    caught.details?.actual_storage_bytes >
      caught.details?.max_storage_bytes &&
    caught.details?.manual_review_required === true &&
    caught.details?.unconfirmed_jobs_preserved === true &&
    calls.get === 1 &&
    calls.set === 0
  );
}

function buildQueueStorageLimitFixture() {
  const maxQueueBytes = 4 * 1024 * 1024;
  const maxPayloadBytes = 64 * 1024;
  const newPayload = {
    meeting: {
      page_id: "meeting_page_storage_limit",
      topic: "新".repeat(17000),
    },
  };
  const newPayloadBytes = Buffer.byteLength(JSON.stringify(newPayload), "utf8");
  if (newPayloadBytes >= maxPayloadBytes) {
    throw new Error("queue storage fixture payload unexpectedly exceeds limit");
  }

  for (let fillerLength = 7200; fillerLength >= 1000; fillerLength -= 100) {
    const seedJobs = Array.from({ length: 199 }, (_, index) => ({
      id: `job_storage_${index + 1}`,
      job_type: "meeting_recording_request",
      payload: { synthetic: true, filler: "中".repeat(fillerLength) },
      created_at: `2026-07-13T00:04:${String(index % 60).padStart(
        2,
        "0"
      )}.000Z`,
    }));
    const storedQueue = JSON.stringify(seedJobs);
    const responseBytes = Buffer.byteLength(
      JSON.stringify({ result: storedQueue }),
      "utf8"
    );
    const nextJob = {
      id: "synthetic_storage_limit_job",
      job_type: "meeting_recording_request",
      payload: newPayload,
      created_at: "2026-07-13T00:05:00.000Z",
    };
    const writeBytes = Buffer.byteLength(
      JSON.stringify([...seedJobs, nextJob]),
      "utf8"
    );
    if (responseBytes < maxQueueBytes && writeBytes > maxQueueBytes) {
      return { seedJobs, newPayload };
    }
  }

  throw new Error("unable to build queue storage byte-limit fixture");
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
      return kvJsonResponse({ result: JSON.stringify(seedJobs) });
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
      return kvJsonResponse({ result: storedQueue });
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
    first.updatedExisting === false &&
    first.queueDepth === 2 &&
    first.maxQueueItems === 200 &&
    first.availableQueueSlots === 198 &&
    first.queueAlmostFull === false &&
    duplicate.deduplicated === true &&
    duplicate.updatedExisting === false &&
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
      return kvJsonResponse({ result: storedQueue });
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
    first.job.id === third.job.id &&
    first.deduplicated === false &&
    first.updatedExisting === false &&
    second.deduplicated === true &&
    second.updatedExisting === false &&
    third.deduplicated === true &&
    third.updatedExisting === true &&
    calls.get === 3 &&
    calls.set === 2 &&
    Array.isArray(storedJobs) &&
    storedJobs.length === 1 &&
    storedJobs[0].id === first.job.id &&
    storedJobs[0].payload.meeting.recording_device === "Mac Mini" &&
    storedJobs[0].payload.routing.target_runner_id === "mac-mini"
  );
}

async function verifyLeasedDuplicateQueueBehavior() {
  const leasedSeedJob = {
    id: "job_leased_existing",
    job_type: "meeting_recording_request",
    payload: syntheticRecordingPayload({ pageId: "meeting_page_leased" }),
    created_at: "2026-07-13T00:07:00.000Z",
    lease: {
      lease_id: "lease_existing",
      runner_id_hash: "runnerhash000003",
      leased_at: "2026-07-13T00:07:01.000Z",
      expires_at: "2026-07-13T00:09:01.000Z",
      attempts: 1,
    },
  };
  const calls = { get: 0, set: 0 };
  let storedQueue = JSON.stringify([leasedSeedJob]);
  const queue = loadAgentQueueWithFetch(async (url, init) => {
    const requestUrl = String(url);
    if (requestUrl.includes("/get/")) {
      calls.get += 1;
      return kvJsonResponse({ result: storedQueue });
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

  const changedPayload = syntheticRecordingPayload({
    pageId: "meeting_page_leased",
    recordingDevice: "Mac Mini",
  });
  const changed = await queue.enqueueMeetingAgentJob(mockKv(), {
    job_type: "meeting_recording_request",
    payload: changedPayload,
  });
  const afterChanged = JSON.parse(storedQueue);
  const repeatedChanged = await queue.enqueueMeetingAgentJob(mockKv(), {
    job_type: "meeting_recording_request",
    payload: changedPayload,
  });
  const afterRepeated = JSON.parse(storedQueue);

  return (
    changed.deduplicated === false &&
    changed.updatedExisting === false &&
    changed.leasedDuplicatePreserved === true &&
    changed.job.id !== leasedSeedJob.id &&
    changed.queueDepth === 2 &&
    afterChanged.length === 2 &&
    afterChanged[0].id === leasedSeedJob.id &&
    afterChanged[0].payload.meeting.recording_device === "MacBook Pro" &&
    afterChanged[0].lease?.lease_id === "lease_existing" &&
    afterChanged[1].id === changed.job.id &&
    afterChanged[1].payload.meeting.recording_device === "Mac Mini" &&
    !afterChanged[1].lease &&
    repeatedChanged.deduplicated === true &&
    repeatedChanged.updatedExisting === false &&
    repeatedChanged.leasedDuplicatePreserved === false &&
    repeatedChanged.job.id === changed.job.id &&
    afterRepeated.length === 2 &&
    calls.get === 2 &&
    calls.set === 1
  );
}

async function verifyQueueClaimLeaseBehavior() {
  const seedJobs = [
    {
      id: "job_claim_1",
      job_type: "meeting_recording_request",
      payload: { synthetic: true, index: 1 },
      created_at: "2026-07-13T00:06:00.000Z",
    },
    {
      id: "job_claim_2",
      job_type: "meeting_recording_request",
      payload: { synthetic: true, index: 2 },
      created_at: "2026-07-13T00:06:01.000Z",
    },
  ];
  const calls = { get: 0, set: 0 };
  let storedQueue = JSON.stringify(seedJobs);
  const queue = loadAgentQueueWithFetch(async (url, init) => {
    const requestUrl = String(url);
    if (requestUrl.includes("/get/")) {
      calls.get += 1;
      return kvJsonResponse({ result: storedQueue });
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

  const now = new Date("2026-07-13T10:00:00.000Z");
  const claimed = await queue.listMeetingAgentJobs(mockKv(), 1, {
    claim: true,
    runnerId: "MacBook Pro",
    now,
    leaseDurationMs: 60000,
  });
  const storedAfterClaim = JSON.parse(storedQueue);
  const blocked = await queue.listMeetingAgentJobs(mockKv(), 5, { now });
  const expired = await queue.listMeetingAgentJobs(mockKv(), 5, {
    now: new Date("2026-07-13T10:02:00.000Z"),
  });

  return (
    claimed.claimMode === true &&
    claimed.claimedJobs === 1 &&
    claimed.returnedJobs === 1 &&
    claimed.jobs[0].id === "job_claim_1" &&
    claimed.jobs[0].lease?.lease_id?.startsWith("lease_") &&
    typeof claimed.jobs[0].lease?.runner_id_hash === "string" &&
    claimed.jobs[0].lease.runner_id_hash.length === 16 &&
    claimed.jobs[0].lease.expires_at === "2026-07-13T10:01:00.000Z" &&
    claimed.jobs[0].lease.attempts === 1 &&
    storedAfterClaim[0].lease?.expires_at === "2026-07-13T10:01:00.000Z" &&
    blocked.claimMode === false &&
    blocked.jobs.length === 1 &&
    blocked.jobs[0].id === "job_claim_2" &&
    blocked.leasedQueueJobs === 1 &&
    blocked.expiredLeaseJobs === 0 &&
    expired.jobs.length === 2 &&
    expired.jobs[0].id === "job_claim_1" &&
    expired.expiredLeaseJobs === 1 &&
    calls.get === 3 &&
    calls.set === 1
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

function kvJsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
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
    TextDecoder,
  };
  sandbox.module.exports = sandbox.exports;
  vm.runInNewContext(compiled, sandbox, { filename: fullPath });
  return sandbox.module.exports;
}

function verifyReceiptTimingBehavior() {
  const helpers = loadTypescriptModule("src/lib/meetings/agentQueueReceipts.ts");
  const now = new Date("2026-07-13T10:00:00.000Z");
  const active = helpers.buildMeetingAgentQueueReceiptTiming({
    now,
    pollMode: "active",
  });
  const idle = helpers.buildMeetingAgentQueueReceiptTiming({
    now,
    pollMode: "idle",
  });
  const retry = helpers.buildMeetingAgentQueueReceiptTiming({
    now,
    pollMode: "retry",
  });
  const manualReview = helpers.buildMeetingAgentQueueReceiptTiming({
    now,
    pollMode: "manual_review",
  });

  return (
    active.receiptGeneratedAt === "2026-07-13T10:00:00.000Z" &&
    active.receiptStaleAfter === "2026-07-13T10:00:30.000Z" &&
    active.receiptFreshnessWindowMs === 30000 &&
    active.recommendedNextPollMs === 4000 &&
    active.recommendedNextPollAt === "2026-07-13T10:00:04.000Z" &&
    idle.recommendedNextPollMs === 12000 &&
    idle.recommendedNextPollAt === "2026-07-13T10:00:12.000Z" &&
    retry.recommendedNextPollMs === 30000 &&
    retry.recommendedNextPollAt === "2026-07-13T10:00:30.000Z" &&
    manualReview.recommendedNextPollMs === null &&
    manualReview.recommendedNextPollAt === null
  );
}

function verifyQueueRefreshSafetyBehavior() {
  const helpers = loadTypescriptModule("src/lib/meetings/agentQueueReceipts.ts");
  const idle = helpers.buildMeetingAgentQueuePendingStatus({
    queueDepth: 0,
  });
  const active = helpers.buildMeetingAgentQueuePendingStatus({
    queueDepth: 2,
  });
  const attention = helpers.buildMeetingAgentQueuePendingStatus({
    queueDepth: 0,
    attentionRequired: true,
  });
  const manualReview = helpers.buildMeetingAgentQueuePendingStatus({
    queueDepth: 0,
    manualReviewRequired: true,
  });
  const retryFailure = helpers.buildMeetingAgentQueueFailureStatus({
    retryable: true,
    queueWriteAttempted: true,
    partialQueueWritePossible: false,
    manualReviewRequired: false,
  });

  return (
    idle.safeToRefreshCaches === true &&
    idle.cacheRefreshStatus === "safe" &&
    idle.cacheRefreshBlockedBy.length === 0 &&
    active.safeToRefreshCaches === false &&
    active.cacheRefreshStatus === "blocked_pending_agent_jobs" &&
    active.cacheRefreshBlockedBy.includes("pending_agent_jobs") &&
    attention.safeToRefreshCaches === false &&
    attention.cacheRefreshStatus === "blocked_attention_required" &&
    attention.cacheRefreshBlockedBy.includes("attention_required") &&
    manualReview.safeToRefreshCaches === false &&
    manualReview.cacheRefreshStatus === "blocked_manual_review" &&
    manualReview.cacheRefreshBlockedBy.includes("manual_review_required") &&
    retryFailure.safeToRefreshCaches === false &&
    retryFailure.cacheRefreshStatus === "blocked_retry_later" &&
    retryFailure.cacheRefreshBlockedBy.includes("retry_later") &&
    retryFailure.cacheRefreshBlockedBy.includes("failed_not_completed")
  );
}

function loadTypescriptModule(rel) {
  const fullPath = path.join(root, rel);
  const source = readFileSync(fullPath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const sandbox = {
    exports: {},
    module: { exports: {} },
    require,
  };
  sandbox.module.exports = sandbox.exports;
  vm.runInNewContext(compiled, sandbox, { filename: fullPath });
  return sandbox.module.exports;
}
