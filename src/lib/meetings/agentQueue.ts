import { createHash, randomUUID } from "crypto";

const QUEUE_KEY = "zhinotes:zhihui:agent-jobs";
const MAX_QUEUE_ITEMS = 200;
const MAX_LISTED_QUEUE_JOBS = 50;
const MAX_PAYLOAD_BYTES = 64 * 1024;
const MAX_QUEUE_RESPONSE_BYTES = 4 * 1024 * 1024;
const MEETING_AGENT_QUEUE_REQUEST_TIMEOUT_MS = 8000;
const MEETING_AGENT_QUEUE_LEASE_MS = 90 * 1000;
const MAX_RUNNER_ID_CHARS = 80;

export interface MeetingAgentQueueJob {
  id: string;
  job_type: string;
  payload: Record<string, unknown>;
  created_at: string;
  lease?: MeetingAgentQueueLease;
}

export interface MeetingAgentQueueLease {
  lease_id: string;
  runner_id_hash: string;
  leased_at: string;
  expires_at: string;
  attempts: number;
}

export interface MeetingAgentQueueEnqueueResult {
  job: MeetingAgentQueueJob;
  deduplicated: boolean;
  updatedExisting: boolean;
  leasedDuplicatePreserved: boolean;
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
  claimMode: boolean;
  claimedJobs: number;
  availableQueueJobs: number;
  leasedQueueJobs: number;
  expiredLeaseJobs: number;
  leaseDurationMs: number | null;
  leaseExpiresAt: string | null;
}

export interface MeetingAgentQueueAckResult {
  acknowledged: string[];
  missing: string[];
  leaseMismatched: string[];
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
  limit: number,
  options: {
    claim?: boolean;
    runnerId?: string;
    now?: Date;
    leaseDurationMs?: number;
  } = {}
): Promise<MeetingAgentQueueListResult> {
  const jobs = await readQueue(kv);
  const now = options.now ?? new Date();
  const visibility = queueVisibility(jobs, now);
  const requestedLimit = Number.isFinite(limit) ? limit : 25;
  const effectiveLimit = Math.max(
    1,
    Math.min(Math.trunc(requestedLimit), MAX_LISTED_QUEUE_JOBS)
  );
  const limitedJobs = visibility.availableJobs.slice(0, effectiveLimit);
  const claimMode = options.claim === true;
  if (!claimMode || limitedJobs.length === 0) {
    return {
      jobs: limitedJobs,
      ...queueStats(jobs),
      requestedLimit,
      effectiveLimit,
      returnedJobs: limitedJobs.length,
      hasMore: limitedJobs.length < visibility.availableJobs.length,
      claimMode,
      claimedJobs: 0,
      availableQueueJobs: visibility.availableJobs.length,
      leasedQueueJobs: visibility.leasedQueueJobs,
      expiredLeaseJobs: visibility.expiredLeaseJobs,
      leaseDurationMs: null,
      leaseExpiresAt: null,
    };
  }

  const runnerId = normalizeRunnerId(options.runnerId);
  if (!runnerId) {
    throw new MeetingAgentQueueFailureError({
      code: "zhihui_agent_queue_claim_runner_required",
      message:
        "ZhiHui runner 认领任务时必须提供 runner_id；未写入队列，任务仍可稍后处理。",
      status: 400,
      retryable: false,
      details: {
        max_runner_id_chars: MAX_RUNNER_ID_CHARS,
        queue_write_status: "not_started",
      },
    });
  }

  const leaseDurationMs = Math.max(
    15_000,
    Math.min(
      Math.trunc(options.leaseDurationMs ?? MEETING_AGENT_QUEUE_LEASE_MS),
      5 * 60 * 1000
    )
  );
  const leasedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + leaseDurationMs).toISOString();
  const selectedIds = new Set(limitedJobs.map((job) => job.id));
  const runnerIdHash = hashRunnerId(runnerId);
  const claimedJobs = jobs.map((job) => {
    if (!selectedIds.has(job.id)) return job;
    return {
      ...job,
      lease: {
        lease_id: `lease_${randomUUID()}`,
        runner_id_hash: runnerIdHash,
        leased_at: leasedAt,
        expires_at: expiresAt,
        attempts: (job.lease?.attempts ?? 0) + 1,
      },
    };
  });
  await writeQueue(kv, claimedJobs);
  const claimedJobMap = new Map(claimedJobs.map((job) => [job.id, job]));
  return {
    jobs: limitedJobs.map((job) => claimedJobMap.get(job.id) ?? job),
    ...queueStats(claimedJobs),
    requestedLimit,
    effectiveLimit,
    returnedJobs: limitedJobs.length,
    hasMore: limitedJobs.length < visibility.availableJobs.length,
    claimMode,
    claimedJobs: limitedJobs.length,
    availableQueueJobs: visibility.availableJobs.length,
    leasedQueueJobs: visibility.leasedQueueJobs,
    expiredLeaseJobs: visibility.expiredLeaseJobs,
    leaseDurationMs,
    leaseExpiresAt: expiresAt,
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
  const duplicateMatch = findDuplicateQueueJob(
    jobs,
    payload.job_type,
    payload.payload
  );
  const existingJob = duplicateMatch.job;
  if (existingJob) {
    const existingPayload = JSON.stringify(existingJob.payload);
    if (existingPayload === serializedPayload) {
      return {
        job: existingJob,
        deduplicated: true,
        updatedExisting: false,
        leasedDuplicatePreserved: duplicateMatch.leasedDuplicatePreserved,
        ...queueStats(jobs),
      };
    }

    const updatedJob = { ...existingJob, payload: payload.payload };
    const updatedJobs = jobs.map((job) =>
      job.id === existingJob.id ? updatedJob : job
    );
    await writeQueue(kv, updatedJobs);
    return {
      job: updatedJob,
      deduplicated: true,
      updatedExisting: true,
      leasedDuplicatePreserved: duplicateMatch.leasedDuplicatePreserved,
      ...queueStats(updatedJobs),
    };
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
  return {
    job,
    deduplicated: false,
    updatedExisting: false,
    leasedDuplicatePreserved: duplicateMatch.leasedDuplicatePreserved,
    ...queueStats(jobs),
  };
}

export async function ackMeetingAgentJobs(
  kv: KvEnv,
  jobIds: string[],
  options: { jobLeases?: Record<string, string> } = {}
): Promise<MeetingAgentQueueAckResult> {
  const ids = uniqueJobIds(jobIds);
  const requestedIds = new Set(ids);
  const expectedLeases = options.jobLeases ?? {};
  const jobs = await readQueue(kv);
  if (ids.length === 0) {
    return {
      acknowledged: [],
      missing: [],
      leaseMismatched: [],
      ...queueStats(jobs),
    };
  }
  const acknowledged: string[] = [];
  const leaseMismatched: string[] = [];
  const presentIds = new Set<string>();
  const remaining = jobs.filter((job) => {
    if (!requestedIds.has(job.id)) return true;
    presentIds.add(job.id);
    const expectedLeaseId = expectedLeases[job.id];
    if (job.lease && job.lease.lease_id !== expectedLeaseId) {
      leaseMismatched.push(job.id);
      return true;
    }
    acknowledged.push(job.id);
    return false;
  });
  const acknowledgedIds = new Set(acknowledged);
  const leaseMismatchedIds = new Set(leaseMismatched);
  const missing = ids.filter(
    (id) =>
      !acknowledgedIds.has(id) &&
      !leaseMismatchedIds.has(id) &&
      !presentIds.has(id)
  );
  if (acknowledged.length === 0) {
    return { acknowledged, missing, leaseMismatched, ...queueStats(jobs) };
  }
  await writeQueue(kv, remaining);
  return { acknowledged, missing, leaseMismatched, ...queueStats(remaining) };
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
  if (!targetKey) return { job: null, leasedDuplicatePreserved: false };
  const candidates = jobs.filter(
    (job) =>
      job.job_type === jobType &&
      queueDedupeKey(job.job_type, job.payload) === targetKey
  );
  const serializedPayload = JSON.stringify(payload);
  const exactJob =
    candidates.find(
      (job) => JSON.stringify(job.payload) === serializedPayload
    ) ?? null;
  if (exactJob) {
    return { job: exactJob, leasedDuplicatePreserved: false };
  }

  const unleasedJob = candidates.find((job) => !job.lease) ?? null;
  if (unleasedJob) {
    return { job: unleasedJob, leasedDuplicatePreserved: false };
  }

  return {
    job: null,
    leasedDuplicatePreserved: candidates.some((job) => Boolean(job.lease)),
  };
}

function queueDedupeKey(jobType: string, payload: Record<string, unknown>) {
  const meeting = objectValue(payload.meeting);
  const pageId = textValue(meeting.page_id);
  if (!pageId) return "";
  return JSON.stringify({
    job_type: jobType,
    meeting_page_id: pageId,
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

function queueVisibility(jobs: MeetingAgentQueueJob[], now: Date) {
  const availableJobs: MeetingAgentQueueJob[] = [];
  let leasedQueueJobs = 0;
  let expiredLeaseJobs = 0;
  for (const job of jobs) {
    if (isLeaseActive(job.lease, now)) {
      leasedQueueJobs += 1;
      continue;
    }
    if (job.lease) {
      expiredLeaseJobs += 1;
    }
    availableJobs.push(job);
  }
  return { availableJobs, leasedQueueJobs, expiredLeaseJobs };
}

function isLeaseActive(lease: MeetingAgentQueueLease | undefined, now: Date) {
  if (!lease) return false;
  const expiresAt = Date.parse(lease.expires_at);
  return Number.isFinite(expiresAt) && expiresAt > now.getTime();
}

function normalizeRunnerId(runnerId: unknown) {
  return typeof runnerId === "string"
    ? runnerId.trim().slice(0, MAX_RUNNER_ID_CHARS)
    : "";
}

function hashRunnerId(runnerId: string) {
  return createHash("sha256").update(runnerId).digest("hex").slice(0, 16);
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
  const serializedJobs = JSON.stringify(jobs);
  const serializedJobsBytes = payloadByteLength(serializedJobs);
  if (serializedJobsBytes > MAX_QUEUE_RESPONSE_BYTES) {
    throw queueStorageTooLargeError(serializedJobsBytes);
  }

  const res = await fetchMeetingAgentQueueWithTimeout(
    `${kv.url}/set/${encodeURIComponent(QUEUE_KEY)}`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${kv.token}` },
      body: serializedJobs,
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
    typeof item.payload === "object" &&
    (item.lease == null || isQueueLease(item.lease))
  );
}

function isQueueLease(value: unknown): value is MeetingAgentQueueLease {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.lease_id === "string" &&
    typeof item.runner_id_hash === "string" &&
    typeof item.leased_at === "string" &&
    typeof item.expires_at === "string" &&
    typeof item.attempts === "number" &&
    Number.isFinite(item.attempts)
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

function queueStorageTooLargeError(actualStorageBytes: number) {
  return new MeetingAgentQueueFailureError({
    code: "zhihui_agent_queue_storage_too_large",
    message:
      "ZhiHui 云端任务队列写入体过大；为避免写出后无法快速读取，已暂停写入，请人工复核队列。",
    status: 409,
    retryable: false,
    details: {
      max_storage_bytes: MAX_QUEUE_RESPONSE_BYTES,
      actual_storage_bytes: actualStorageBytes,
      manual_review_required: true,
      unconfirmed_jobs_preserved: true,
    },
  });
}
