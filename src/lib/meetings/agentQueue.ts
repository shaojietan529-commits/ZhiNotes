import { randomUUID } from "crypto";

const QUEUE_KEY = "zhinotes:zhihui:agent-jobs";
const MAX_QUEUE_ITEMS = 200;
const MAX_PAYLOAD_BYTES = 64 * 1024;
const MEETING_AGENT_QUEUE_REQUEST_TIMEOUT_MS = 8000;

export interface MeetingAgentQueueJob {
  id: string;
  job_type: string;
  payload: Record<string, unknown>;
  created_at: string;
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
): Promise<MeetingAgentQueueJob[]> {
  const jobs = await readQueue(kv);
  return jobs.slice(0, Math.max(1, Math.min(limit, 50)));
}

export async function enqueueMeetingAgentJob(
  kv: KvEnv,
  payload: {
    job_type: string;
    payload: Record<string, unknown>;
  }
): Promise<MeetingAgentQueueJob> {
  const serializedPayload = JSON.stringify(payload.payload);
  if (serializedPayload.length > MAX_PAYLOAD_BYTES) {
    throw new MeetingAgentQueueFailureError({
      code: "zhihui_agent_queue_payload_too_large",
      message:
        "ZhiHui 云端任务内容过大；会议页和日历本地数据不受影响，请精简会议字段或转入人工处理。",
      status: 413,
      retryable: false,
      details: {
        max_payload_bytes: MAX_PAYLOAD_BYTES,
        actual_payload_chars: serializedPayload.length,
      },
    });
  }
  const jobs = await readQueue(kv);
  const job: MeetingAgentQueueJob = {
    id: `zhihui_${randomUUID()}`,
    job_type: payload.job_type,
    payload: payload.payload,
    created_at: new Date().toISOString(),
  };
  jobs.push(job);
  await writeQueue(kv, jobs.slice(-MAX_QUEUE_ITEMS));
  return job;
}

export async function ackMeetingAgentJobs(
  kv: KvEnv,
  jobIds: string[]
): Promise<string[]> {
  const ids = new Set(jobIds.filter((id) => typeof id === "string" && id));
  if (ids.size === 0) return [];
  const jobs = await readQueue(kv);
  const acknowledged: string[] = [];
  const remaining = jobs.filter((job) => {
    if (!ids.has(job.id)) return true;
    acknowledged.push(job.id);
    return false;
  });
  await writeQueue(kv, remaining);
  return acknowledged;
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
  const data = await res.json();
  if (typeof data.result !== "string" || !data.result) return [];
  try {
    const parsed = JSON.parse(data.result);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isQueueJob).slice(-MAX_QUEUE_ITEMS);
  } catch {
    return [];
  }
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
