import { NextResponse } from "next/server";
import {
  accountIdentityMissingEnv,
  getAccountIdentityConfig,
  getSessionAccount,
  kvGet,
  kvSet,
  readSessionToken,
  type AccountIdentityConfig,
} from "@/lib/account/server";
import { accountSessionUnconfirmedResponse } from "@/lib/account/sessionResponses";

export const dynamic = "force-dynamic";

type KnowledgeRecordType =
  | "wiki_link"
  | "page_comment"
  | "block_comment"
  | "page_version";

interface KnowledgeIndexEntry {
  u: string;
  d: 0 | 1;
  t: KnowledgeRecordType;
}

interface KnowledgeChangeLogEntry extends KnowledgeIndexEntry {
  k: string;
}

interface KnowledgeChangeCursor {
  updatedAt: string;
  key: string;
}

interface KnowledgeCloudRecord {
  type: KnowledgeRecordType;
  id: string;
  source_page_id?: string | null;
  target_page_id?: string | null;
  page_id?: string | null;
  block_ref?: string | null;
  anchor_text?: string | null;
  owner_id?: string | null;
  body?: string | null;
  resolved?: number | null;
  version_num?: number | null;
  title?: string | null;
  content_text?: string | null;
  summary?: string | null;
  created_at: string;
  updated_at?: string | null;
  deleted_at: string | null;
  sync_version?: number | null;
}

interface KnowledgeSummary {
  count: number;
  deleted: number;
  maxUpdatedAt: string;
  cursor: string;
  watermark: string;
}

const INDEX_KEY_PREFIX = "zhinotes:knowledge-sync:index:";
const RECORD_KEY_PREFIX = "zhinotes:knowledge-sync:record:";
const CHANGE_LOG_KEY_PREFIX = "zhinotes:knowledge-sync:changes:";
const MAX_PAYLOAD_BYTES = 950 * 1024;
const MAX_PUSH_RECORDS = 200;
const MAX_PULL_IDS = 200;
const MAX_CHANGE_RECORDS = 200;
const CHANGE_LOG_LIMIT = 5000;
const MAX_TEXT_FIELD_CHARS = 600 * 1024;
const VALID_RECORD_TYPES = new Set<KnowledgeRecordType>([
  "wiki_link",
  "page_comment",
  "block_comment",
  "page_version",
]);

export async function POST(request: Request) {
  const config = getAccountIdentityConfig();
  if (!config) {
    return NextResponse.json(
      {
        error: "account system not configured",
        missing_env: accountIdentityMissingEnv(),
      },
      { status: 501 }
    );
  }

  const token = readSessionToken(request);
  if (!token) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  let bodyText: string;
  try {
    bodyText = await request.text();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (bodyText.length > MAX_PAYLOAD_BYTES) {
    return NextResponse.json({ error: "数据过大" }, { status: 413 });
  }

  let body: {
    action?: string;
    records?: unknown;
    keys?: unknown;
    since?: unknown;
    limit?: unknown;
  };
  try {
    body = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  try {
    const account = await getSessionAccount(config, token);
    if (!account) {
      return accountSessionUnconfirmedResponse(
        "知识库同步暂时无法确认账号；本地输入已保留，请稍后重试。"
      );
    }
    const email = account.email;

    if (body.action === "summary") {
      const index = await readIndex(config, email);
      return NextResponse.json({ ok: true, summary: summarizeIndex(index) });
    }

    if (body.action === "changes-since") {
      const since = typeof body.since === "string" ? body.since : "";
      const limit = normalizeLimit(body.limit, MAX_CHANGE_RECORDS);
      const result = await getChangesSince(config, email, since, limit);
      return NextResponse.json({ ok: true, ...result });
    }

    if (body.action === "pull") {
      if (!Array.isArray(body.keys)) {
        return NextResponse.json({ error: "缺少 keys" }, { status: 400 });
      }
      const keys = body.keys
        .filter((key): key is string => typeof key === "string")
        .filter(isValidRecordKey)
        .slice(0, MAX_PULL_IDS);
      const records = await readRecordsByKeys(config, email, keys);
      return NextResponse.json({ ok: true, records });
    }

    if (body.action === "push") {
      if (!Array.isArray(body.records)) {
        return NextResponse.json({ error: "缺少 records" }, { status: 400 });
      }
      if (body.records.length > MAX_PUSH_RECORDS) {
        return NextResponse.json({ error: "单次推送过多" }, { status: 400 });
      }
      const result = await pushRecords(config, email, body.records);
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch {
    return accountSessionUnconfirmedResponse(
      "知识库同步云端读写暂时失败；本地输入已保留，会稍后重试。"
    );
  }
}

async function pushRecords(
  config: AccountIdentityConfig,
  email: string,
  rawRecords: unknown[]
) {
  const index = await readIndex(config, email);
  const accepted: string[] = [];
  const skipped: string[] = [];
  const rejected: string[] = [];
  const changeLogEntries: KnowledgeChangeLogEntry[] = [];

  for (const item of rawRecords) {
    const record = sanitizeRecord(item);
    if (!record) {
      rejected.push("invalid-record");
      continue;
    }
    const key = buildRecordKey(record.type, record.id);
    const updatedAt = recordUpdatedAt(record);
    const existing = index[key];
    if (existing && compareChangePosition(existing.u, key, updatedAt, key) >= 0) {
      skipped.push(key);
      continue;
    }
    await kvSet(config.kv, recordKey(email, key), JSON.stringify(record));
    const entry: KnowledgeIndexEntry = {
      u: updatedAt,
      d: record.deleted_at ? 1 : 0,
      t: record.type,
    };
    index[key] = entry;
    changeLogEntries.push({ ...entry, k: key });
    accepted.push(key);
  }

  if (accepted.length > 0) {
    await kvSet(config.kv, indexKey(email), JSON.stringify(index));
    await appendChangeLog(config, email, changeLogEntries);
  }
  const summary = summarizeIndex(index);
  return {
    accepted,
    skipped,
    rejected,
    ack: {
      format: "zhinote-knowledge-cloud-ack-receipt",
      format_version: 1,
      ack_status:
        accepted.length > 0 || skipped.length > 0 ? "acknowledged" : "empty",
      requested_count: rawRecords.length,
      accepted_count: accepted.length,
      skipped_count: skipped.length,
      rejected_count: rejected.length,
      remote_cursor: summary.cursor,
      remote_watermark: summary.watermark,
      boundary: {
        account_scoped: true,
        stores_only_authenticated_account_copy: true,
        uses_raw_browser_storage_dump: false,
      },
    },
  };
}

async function getChangesSince(
  config: AccountIdentityConfig,
  email: string,
  since: string,
  limit: number
) {
  const cursor = parseCursor(since);
  const log = await readChangeLog(config, email);
  const firstLogEntry = log[0];
  const canUseLog =
    Boolean(cursor.updatedAt) &&
    Boolean(firstLogEntry) &&
    compareChangePosition(
      cursor.updatedAt,
      cursor.key,
      firstLogEntry?.u ?? "",
      firstLogEntry?.k ?? ""
    ) >= 0;

  const changed = canUseLog
    ? log.filter((entry) => isAfterCursor(entry.u, entry.k, cursor))
    : Object.entries(await readIndex(config, email))
        .map(([key, entry]) => ({ ...entry, k: key }))
        .filter((entry) => isAfterCursor(entry.u, entry.k, cursor))
        .sort((a, b) => compareChangePosition(a.u, a.k, b.u, b.k));
  const selected = changed.slice(0, limit);
  const records = await readRecordsByKeys(
    config,
    email,
    selected.map((entry) => entry.k)
  );
  const last = selected[selected.length - 1];
  return {
    records,
    count: records.length,
    totalChanged: changed.length,
    cursor: last ? stringifyCursor(last.u, last.k) : since,
    hasMore: changed.length > selected.length,
    source: canUseLog ? "change-log" : "index",
    summary: summarizeIndex(await readIndex(config, email)),
  };
}

async function readRecordsByKeys(
  config: AccountIdentityConfig,
  email: string,
  keys: string[]
): Promise<KnowledgeCloudRecord[]> {
  const uniqueKeys = Array.from(new Set(keys.filter(isValidRecordKey)));
  const records: KnowledgeCloudRecord[] = [];
  for (const key of uniqueKeys) {
    const raw = await kvGet(config.kv, recordKey(email, key));
    if (!raw) continue;
    try {
      const record = sanitizeRecord(JSON.parse(raw));
      if (record) records.push(record);
    } catch {
      // Ignore corrupt cloud record; a later push can repair it.
    }
  }
  return records;
}

async function readIndex(
  config: AccountIdentityConfig,
  email: string
): Promise<Record<string, KnowledgeIndexEntry>> {
  const raw = await kvGet(config.kv, indexKey(email));
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const index: Record<string, KnowledgeIndexEntry> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!isValidRecordKey(key) || !value || typeof value !== "object") {
        continue;
      }
      const entry = value as Partial<KnowledgeIndexEntry>;
      if (
        typeof entry.u === "string" &&
        isRecordType(entry.t) &&
        (entry.d === 0 || entry.d === 1)
      ) {
        index[key] = { u: entry.u, d: entry.d, t: entry.t };
      }
    }
    return index;
  } catch {
    return {};
  }
}

async function readChangeLog(
  config: AccountIdentityConfig,
  email: string
): Promise<KnowledgeChangeLogEntry[]> {
  const raw = await kvGet(config.kv, `${CHANGE_LOG_KEY_PREFIX}${email}`);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return normalizeChangeLog(
      parsed
        .map(sanitizeChangeLogEntry)
        .filter((entry): entry is KnowledgeChangeLogEntry => Boolean(entry))
    );
  } catch {
    return [];
  }
}

async function appendChangeLog(
  config: AccountIdentityConfig,
  email: string,
  entries: KnowledgeChangeLogEntry[]
): Promise<void> {
  const valid = entries.filter((entry) => isValidRecordKey(entry.k) && entry.u);
  if (valid.length === 0) return;
  const existing = await readChangeLog(config, email);
  const next = normalizeChangeLog([...existing, ...valid]).slice(-CHANGE_LOG_LIMIT);
  await kvSet(config.kv, `${CHANGE_LOG_KEY_PREFIX}${email}`, JSON.stringify(next));
}

function sanitizeRecord(value: unknown): KnowledgeCloudRecord | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (!isRecordType(raw.type) || !isValidRecordId(raw.id)) return null;
  const createdAt = getTimestamp(raw.created_at);
  if (!createdAt) return null;
  const base = {
    type: raw.type,
    id: raw.id,
    owner_id: getOptionalString(raw.owner_id),
    created_at: createdAt,
    updated_at: getTimestamp(raw.updated_at),
    deleted_at: getTimestamp(raw.deleted_at),
    sync_version: getOptionalNumber(raw.sync_version),
  };

  if (raw.type === "wiki_link") {
    const sourcePageId = getValidLinkedId(raw.source_page_id);
    const targetPageId = getValidLinkedId(raw.target_page_id);
    if (!sourcePageId || !targetPageId) return null;
    return {
      ...base,
      source_page_id: sourcePageId,
      target_page_id: targetPageId,
    };
  }

  if (raw.type === "page_comment") {
    const pageId = getValidLinkedId(raw.page_id);
    if (!pageId) return null;
    return {
      ...base,
      page_id: pageId,
      body: getBoundedString(raw.body),
      resolved: getBooleanNumber(raw.resolved),
    };
  }

  if (raw.type === "block_comment") {
    const pageId = getValidLinkedId(raw.page_id);
    const blockRef = getBoundedString(raw.block_ref);
    if (!pageId || !blockRef) return null;
    return {
      ...base,
      page_id: pageId,
      block_ref: blockRef,
      anchor_text: getBoundedString(raw.anchor_text),
      body: getBoundedString(raw.body),
      resolved: getBooleanNumber(raw.resolved),
    };
  }

  const pageId = getValidLinkedId(raw.page_id);
  const versionNum = getOptionalNumber(raw.version_num);
  if (!pageId || typeof versionNum !== "number") return null;
  return {
    ...base,
    page_id: pageId,
    version_num: versionNum,
    title: getBoundedString(raw.title) || "未命名页面",
    content_text: getBoundedString(raw.content_text),
    summary: getBoundedString(raw.summary),
  };
}

function sanitizeChangeLogEntry(value: unknown): KnowledgeChangeLogEntry | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<KnowledgeChangeLogEntry>;
  if (!raw.k || !isValidRecordKey(raw.k)) return null;
  if (!raw.u || typeof raw.u !== "string") return null;
  if (!isRecordType(raw.t)) return null;
  return { k: raw.k, u: raw.u, d: raw.d === 1 ? 1 : 0, t: raw.t };
}

function normalizeChangeLog(
  entries: KnowledgeChangeLogEntry[]
): KnowledgeChangeLogEntry[] {
  const byPosition = new Map<string, KnowledgeChangeLogEntry>();
  for (const entry of entries) {
    byPosition.set(`${entry.u}\u0000${entry.k}`, entry);
  }
  return [...byPosition.values()].sort((a, b) =>
    compareChangePosition(a.u, a.k, b.u, b.k)
  );
}

function summarizeIndex(index: Record<string, KnowledgeIndexEntry>): KnowledgeSummary {
  let count = 0;
  let deleted = 0;
  let maxUpdatedAt = "";
  let maxKey = "";
  for (const [key, entry] of Object.entries(index)) {
    count += 1;
    if (entry.d === 1) deleted += 1;
    if (compareChangePosition(entry.u, key, maxUpdatedAt, maxKey) > 0) {
      maxUpdatedAt = entry.u;
      maxKey = key;
    }
  }
  return {
    count,
    deleted,
    maxUpdatedAt,
    cursor: stringifyCursor(maxUpdatedAt, maxKey),
    watermark: `${count}:${deleted}:${maxUpdatedAt}`,
  };
}

function normalizeLimit(value: unknown, max: number): number {
  return typeof value === "number" && Number.isInteger(value)
    ? Math.min(max, Math.max(1, value))
    : max;
}

function isAfterCursor(
  updatedAt: string,
  key: string,
  cursor: KnowledgeChangeCursor
): boolean {
  return compareChangePosition(updatedAt, key, cursor.updatedAt, cursor.key) > 0;
}

function compareChangePosition(
  leftUpdatedAt: string,
  leftKey: string,
  rightUpdatedAt: string,
  rightKey: string
): number {
  return leftUpdatedAt.localeCompare(rightUpdatedAt) || leftKey.localeCompare(rightKey);
}

function parseCursor(value: string): KnowledgeChangeCursor {
  if (!value) return { updatedAt: "", key: "" };
  try {
    const parsed = JSON.parse(value) as Partial<KnowledgeChangeCursor>;
    if (
      parsed &&
      typeof parsed.updatedAt === "string" &&
      typeof parsed.key === "string"
    ) {
      return { updatedAt: parsed.updatedAt, key: parsed.key };
    }
  } catch {
    // Backward-compatible cursor.
  }
  return { updatedAt: value, key: "" };
}

function stringifyCursor(updatedAt: string, key: string): string {
  if (!updatedAt) return "";
  return JSON.stringify({ updatedAt, key });
}

function recordUpdatedAt(record: KnowledgeCloudRecord): string {
  return [record.updated_at, record.deleted_at, record.created_at]
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? record.created_at;
}

function indexKey(email: string): string {
  return `${INDEX_KEY_PREFIX}${email}`;
}

function recordKey(email: string, key: string): string {
  return `${RECORD_KEY_PREFIX}${email}:${key}`;
}

function buildRecordKey(type: KnowledgeRecordType, id: string): string {
  return `${type}:${id}`;
}

function isValidRecordKey(value: string): boolean {
  const [type, ...rest] = value.split(":");
  return isRecordType(type) && isValidRecordId(rest.join(":"));
}

function isRecordType(value: unknown): value is KnowledgeRecordType {
  return typeof value === "string" && VALID_RECORD_TYPES.has(value as KnowledgeRecordType);
}

function isValidRecordId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 160 &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

function getValidLinkedId(value: unknown): string | null {
  return isValidRecordId(value) ? value : null;
}

function getBoundedString(value: unknown): string {
  return typeof value === "string" ? value.slice(0, MAX_TEXT_FIELD_CHARS) : "";
}

function getOptionalString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function getTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  return Number.isNaN(Date.parse(value)) ? null : value;
}

function getOptionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getBooleanNumber(value: unknown): number {
  if (typeof value === "number") return value ? 1 : 0;
  return value ? 1 : 0;
}
