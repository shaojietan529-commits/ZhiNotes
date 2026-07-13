import { randomUUID } from "crypto";

const QUEUE_KEY = "zhinotes:zhihui:agent-jobs";
const MAX_QUEUE_ITEMS = 200;
const MAX_LISTED_QUEUE_JOBS = 50;
const MAX_PAYLOAD_BYTES = 64 * 1024;
const MAX_QUEUE_RESPONSE_BYTES = 4 * 1024 * 1024;
const MEETING_AGENT_QUEUE_REQUEST_TIMEOUT_MS = 8000;

export interface MeetingAgentQueueJob {
  id: string;
  job_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface MeetingAgentQueueEnqueueResult {
  job: MeetingAgentQueueJob;
  deduplicated: boolean;
  queueDepth: number;
  maxQueueItems: number;
  availableQueueSlots: number;
  queueAlmostFull: boolean;
}

export interface MeetingAgentQueueListResult {
  jobs: MeetingAgentQueueJob[];
  queueDepth: number;
  maxQueueItems: number;
  requestedLimit: number;
  effectiveLimit: number;
  availableQueueSlots: number;
  returnedJobs: number;
  hasMore: boolean;
  queueAlmostFull: boolean;
}

export interface MeetingAgentQueueAckResult {
  acknowledged: string[];
  missing: string[];
  queueDepth: number;
  maxQueueItems: number;
  availableQueueSlots: number;
  queueAlmostFull: boolean;
}

interface KvEnv {
  url: string;
  token: string;
}

export class MeetingAgentQueueTimeoutError extends Error {
  status = 504;
  timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`ZhiHui agent queue request timed out after ${timeoutMs}ms`);
    this.name = "MeetingAgentQueueTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export class MeetingAgentQueueFailureError extends Error {
  status: number;
  code: string;
  retryable: boolean;
  details: Record<string, unknown> | null;

  constructor({
    code,
    message,
    status,
    retryable,
    details = null,
  }: {
    code: string;
    message: string;
    status: number;
    retryable: boolean;
    details?: Record<string, unknown> | null;
  }) {
    super(message);
    this.name = "MeetingAgentQueueFailureError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.details = details;
  }
}

export function getMeetingAgentQueueConfig():
  | { status: "ok"; kv: KvEnv; agentToken: string }
  | { status: "missing"; missing: string[] } {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  const agentToken = process.env.ZHIHUI_AGENT_TOKEN ?? "";
  const missing: string[] = [];
  if (!url || !token) missing.push("KV_REST_API_URL / KV_REST_API_TOKEN");
  if (!agentToken) missing.push("ZHIHUI_AGENT_TOKEN");
  if (missing.length > 0 || !url || !token || !agentToken) {
    return { status: "missing", missing };
  }
  return { status: "ok", kv: { url, token }, agentToken };
}

export function authorizeMeetingAgent(request: Request, agentToken: string) {
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${agentToken}`;
}

export async function listMeetingAgentJobs(
  kv: KvEnv,
  limit: number
): Promise<MeetingAgentQueueListResult> {
  const jobs = await readQueue(kv);
  const requestedLimit = Number.isFinite(limit) ? limit : 25;
  const effectiveLimit = Math.max(
    1,
    Math.min(Math.trunc(requestedLimit), MAX_LISTED_QUEUE_JOBS)
  );
  const limitedJobs = jobs.slice(0, effectiveLimit);
  return {
    jobs: limitedJobs,
    ...queueStats(jobs),
    requestedLimit,
    effectiveLimit,
    returnedJobs: limitedJobs.length,
    hasMore: limitedJobs.length < jobs.length,
  };
}

export async function enqueueMeetingAgentJob(
  kv: KvEnv,
  payload: {
    job_type: string;
    payload: Record<string, unknown>;
  }
): Promise<MeetingAgentQueueEnqueueResult> {
  const serializedPayload = JSON.stringify(payload.payload);
  const serializedPayloadBytes = payloadByteLength(serializedPayload);
  if (serializedPayloadBytes > MAX_PAYLOAD_BYTES) {
    throw new MeetingAgentQueueFailureError({
      code: "zhihui_agent_queue_payload_too_large",
      message:
        "ZhiHui 云端任务内容过大；会议页和日历本地数据不受影响，请精简会议字段或转入人工处理。",
      status: 413,
      retryable: false,
      details: {
        max_payload_bytes: MAX_PAYLOAD_BYTES,
        actual_payload_bytes: serializedPayloadBytes,
        actual_payload_chars: serializedPayload.length,
      },
    });
  }
  const jobs = await readQueue(kv);
  const existingJob = findDuplicateQueueJob(
    jobs,
    payload.job_type,
    payload.payload
  );
  if (existingJob) {
    return { job: existingJob, deduplicated: true, ...queueStats(jobs) };
  }
  if (jobs.length >= MAX_QUEUE_ITEMS) {
    throw queueFullError(jobs.length);
  }

  const job: MeetingAgentQueueJob = {
    id: `zhihui_${randomUUID()}`,
    job_type: payload.job_type,
    payload: payload.payload,
    created_at: new Date().toISOString(),
  };
  jobs.push(job);
  await writeQueue(kv, jobs);
  return { job, deduplicated: false, ...queueStats(jobs) };
}

export async function ackMeetingAgentJobs(
  kv: KvEnv,
  jobIds: string[]
): Promise<MeetingAgentQueueAckResult> {
  const ids = uniqueJobIds(jobIds);
  const requestedIds = new Set(ids);
  const jobs = await readQueue(kv);
  if (ids.length === 0) {
    return { acknowledged: [], missing: [], ...queueStats(jobs) };
  }
  const acknowledged: string[] = [];
  const remaining = jobs.filter((job) => {
    if (!requestedIds.has(job.id)) return true;
    acknowledged.push(job.id);
    return false;
  });
  const acknowledgedIds = new Set(acknowledged);
  const missing = ids.filter((id) => !acknowledgedIds.has(id));
  if (acknowledged.length === 0) {
    return { acknowledged, missing, ...queueStats(jobs) };
  }
  await writeQueue(kv, remaining);
  return { acknowledged, missing, ...queueStats(remaining) };
}

async function readQueue(kv: KvEnv): Promise<MeetingAgentQueueJob[]> {
  const res = await fetchMeetingAgentQueueWithTimeout(
    `${kv.url}/get/${encodeURIComponent(QUEUE_KEY)}`,
    {
      headers: { authorization: `Bearer ${kv.token}` },
      cache: "no-store",
    }
  );
  if (!res.ok) {
    throw new MeetingAgentQueueFailureError({
      code: "zhihui_agent_queue_kv_get_failed",
      message:
        "ZhiHui 云端任务队列读取失败；会议页和日历本地数据不受影响，可稍后重试。",
      status: 502,
      retryable: true,
      details: { upstream_status: res.status },
    });
  }
  const data = await readBoundedQueueResponseJson(res);
  if (!data || typeof data !== "object") {
    throw queueCorruptError("kv_response_not_object");
  }
  const result = (data as { result?: unknown }).result;
  if (result == null || result === "") return [];
  if (typeof result !== "string") {
    throw queueCorruptError("non_string_result");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(result);
  } catch {
    throw queueCorruptError("invalid_json");
  }
  if (!Array.isArray(parsed)) {
    throw queueCorruptError("not_array");
  }
  if (!parsed.every(isQueueJob)) {
    throw queueCorruptError("invalid_job_shape");
  }
  if (parsed.length > MAX_QUEUE_ITEMS) {
    throw queueOversizedError(parsed.length);
  }
  return parsed;
}

async function readBoundedQueueResponseJson(response: Response) {
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_QUEUE_RESPONSE_BYTES
  ) {
    throw queueResponseTooLargeError(contentLength);
  }

  const body = await readBoundedQueueResponseText(
    response,
    MAX_QUEUE_RESPONSE_BYTES
  );
  if (!body.ok) {
    throw queueResponseTooLargeError(body.bytesRead);
  }

  try {
    return JSON.parse(body.text) as unknown;
  } catch {
    throw queueCorruptError("kv_response_invalid_json");
  }
}

async function readBoundedQueueResponseText(
  response: Response,
  maxBytes: number
) {
  if (!response.body) {
    return { ok: true as const, text: "", bytesRead: 0 };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      bytesRead += value.byteLength;
      if (bytesRead > maxBytes) {
        await reader.cancel();
        return { ok: false as const, bytesRead };
      }

      text += decoder.decode(value, { stream: true });
    }

    text += decoder.decode();
    return { ok: true as const, text, bytesRead };
  } finally {
    reader.releaseLock();
  }
}

function findDuplicateQueueJob(
  jobs: MeetingAgentQueueJob[],
  jobType: string,
  payload: Record<string, unknown>
) {
  const targetKey = queueDedupeKey(jobType, payload);
  if (!targetKey) return null;
  return (
    jobs.find(
      (job) =>
        job.job_type === jobType &&
        queueDedupeKey(job.job_type, job.payload) === targetKey
    ) ?? null
  );
}

function queueDedupeKey(jobType: string, payload: Record<string, unknown>) {
  const meeting = objectValue(payload.meeting);
  const pageId = textValue(meeting.page_id);
  if (!pageId) return "";
  const routing = objectValue(payload.routing);
  return JSON.stringify({
    job_type: jobType,
    meeting_page_id: pageId,
    date: textValue(meeting.date),
    time: textValue(meeting.time),
    platform: textValue(meeting.platform),
    priority: textValue(payload.priority),
    run_now: payload.run_now === true,
    recording_device: textValue(meeting.recording_device),
    fallback_device: textValue(meeting.fallback_device),
    transcription_model: textValue(meeting.transcription_model),
    target_runner_id: textValue(routing.target_runner_id),
    fallback_runner_id: textValue(routing.fallback_runner_id),
  });
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 500) : "";
}

function payloadByteLength(value: string) {
  return Buffer.byteLength(value, "utf8");
}

function queueStats(jobs: MeetingAgentQueueJob[]) {
  const queueDepth = jobs.length;
  const availableQueueSlots = Math.max(0, MAX_QUEUE_ITEMS - queueDepth);
  return {
    queueDepth,
    maxQueueItems: MAX_QUEUE_ITEMS,
    availableQueueSlots,
    queueAlmostFull: availableQueueSlots <= 10,
  };
}

function uniqueJobIds(jobIds: string[]) {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const rawId of jobIds) {
    const id = typeof rawId === "string" ? rawId.trim() : "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

async function writeQueue(kv: KvEnv, jobs: MeetingAgentQueueJob[]) {
  const res = await fetchMeetingAgentQueueWithTimeout(
    `${kv.url}/set/${encodeURIComponent(QUEUE_KEY)}`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${kv.token}` },
      body: JSON.stringify(jobs),
    }
  );
  if (!res.ok) {
    throw new MeetingAgentQueueFailureError({
      code: "zhihui_agent_queue_kv_set_failed",
      message:
        "ZhiHui 云端任务队列写入失败；会议页和日历本地数据不受影响，可稍后重试。",
      status: 502,
      retryable: true,
      details: { upstream_status: res.status },
    });
  }
}

async function fetchMeetingAgentQueueWithTimeout(
  url: string,
  init: RequestInit
) {
  const controller = new AbortController();
  let didTimeout = false;
  const timeout = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, MEETING_AGENT_QUEUE_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (didTimeout) {
      throw new MeetingAgentQueueTimeoutError(
        MEETING_AGENT_QUEUE_REQUEST_TIMEOUT_MS
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function isQueueJob(value: unknown): value is MeetingAgentQueueJob {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.job_type === "string" &&
    typeof item.created_at === "string" &&
    Boolean(item.payload) &&
    typeof item.payload === "object"
  );
}

function queueCorruptError(reason: string) {
  return new MeetingAgentQueueFailureError({
    code: "zhihui_agent_queue_corrupt",
    message:
      "ZhiHui 云端任务队列格式异常；为避免覆盖或清空未确认任务，已暂停队列写入，请人工复核。",
    status: 409,
    retryable: false,
    details: {
      reason,
      manual_review_required: true,
      unconfirmed_jobs_preserved: true,
    },
  });
}

function queueFullError(actualQueueItems: number) {
  return new MeetingAgentQueueFailureError({
    code: "zhihui_agent_queue_full",
    message:
      "ZhiHui 云端任务队列已满；为避免挤掉未确认任务，已暂停新增任务，请先让 runner 确认已处理任务或人工复核。",
    status: 409,
    retryable: false,
    details: {
      max_queue_items: MAX_QUEUE_ITEMS,
      actual_queue_items: actualQueueItems,
      manual_review_required: true,
      unconfirmed_jobs_preserved: true,
    },
  });
}

function queueOversizedError(actualQueueItems: number) {
  return new MeetingAgentQueueFailureError({
    code: "zhihui_agent_queue_oversized",
    message:
      "ZhiHui 云端任务队列超过安全上限；为避免读取或写回时丢失未确认任务，已暂停队列操作，请人工复核。",
    status: 409,
    retryable: false,
    details: {
      max_queue_items: MAX_QUEUE_ITEMS,
      actual_queue_items: actualQueueItems,
      manual_review_required: true,
      unconfirmed_jobs_preserved: true,
    },
  });
}

function queueResponseTooLargeError(actualResponseBytes: number) {
  return new MeetingAgentQueueFailureError({
    code: "zhihui_agent_queue_response_too_large",
    message:
      "ZhiHui 云端任务队列响应过大；为避免页面或 runner 卡顿，已暂停读取，请人工复核队列。",
    status: 409,
    retryable: false,
    details: {
      max_response_bytes: MAX_QUEUE_RESPONSE_BYTES,
      actual_response_bytes: actualResponseBytes,
      manual_review_required: true,
      unconfirmed_jobs_preserved: true,
    },
  });
}
