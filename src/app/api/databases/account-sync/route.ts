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

// Account-scoped database cloud sync foundation.
//
// This route is intentionally session-gated and inert unless a signed-in
// browser explicitly calls it. The client helper keeps database sync off by
// default, so adding this endpoint does not upload existing local tables by
// itself. It gives stage-three cloud architecture a safe ledger for database
// schemas and rows before the UI opts into migration.
//
// Storage layout:
//   zhinotes:dbsync:index:{email}           → { [recordKey]: { u, d, t, db } }
//   zhinotes:dbsync:record:{email}:{key}    → sanitized database record JSON
//   zhinotes:dbsync:changes:{email}         → bounded [{ key, u, d, t }]

const INDEX_KEY_PREFIX = "zhinotes:dbsync:index:";
const RECORD_KEY_PREFIX = "zhinotes:dbsync:record:";
const CHANGE_LOG_KEY_PREFIX = "zhinotes:dbsync:changes:";
const MAX_PAYLOAD_BYTES = 950 * 1024;
const MAX_PUSH_RECORDS = 100;
const MAX_PULL_RECORDS = 100;
const MAX_RECORD_BYTES = 64 * 1024;
const MAX_TEXT_CHARS = 20_000;
const CHANGE_LOG_LIMIT = 5000;

const RECORD_TYPES = new Set(["database", "field", "row", "view"]);

type DatabaseSyncRecordType = "database" | "field" | "row" | "view";

interface DatabaseSyncIndexEntry {
  u: string;
  d: 0 | 1;
  t: DatabaseSyncRecordType;
  db: string | null;
}

interface DatabaseSyncSummary {
  count: number;
  deleted: number;
  maxUpdatedAt: string;
  watermark: string;
  cursor: string;
}

interface DatabaseSyncRecord {
  type: DatabaseSyncRecordType;
  id: string;
  database_id: string | null;
  parent_page_id: string | null;
  page_id: string | null;
  owner_id: string;
  title: string | null;
  icon: string | null;
  description: string | null;
  name: string | null;
  field_type: string | null;
  view_type: string | null;
  config: string | null;
  field_values: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface DatabaseSyncChangeCursor {
  updatedAt: string;
  key: string;
}

interface DatabaseSyncChangeLogEntry {
  key: string;
  u: string;
  d: 0 | 1;
  t: DatabaseSyncRecordType;
}

interface DatabaseSyncChangesResult {
  records: DatabaseSyncRecord[];
  count: number;
  totalChanged: number;
  cursor: string;
  hasMore: boolean;
  summary?: DatabaseSyncSummary;
  source: "change-log" | "index";
}

interface DatabaseSyncMetadataResult {
  records: DatabaseSyncRecord[];
  count: number;
  total: number;
  summary: DatabaseSyncSummary;
}

interface DatabaseRecordsResult {
  records: DatabaseSyncRecord[];
  count: number;
  total: number;
  offset: number;
  nextOffset: number | null;
  hasMore: boolean;
  summary: DatabaseSyncSummary;
}

interface DatabaseCloudAckReceipt {
  format: "zhinote-database-cloud-ack-receipt";
  format_version: 1;
  ack_status: "acknowledged" | "empty";
  generated_at: string;
  requested_count: number;
  accepted_count: number;
  skipped_count: number;
  rejected_count: number;
  index_count: number;
  index_deleted: number;
  remote_watermark: string;
  remote_cursor: string;
  boundary: {
    account_scoped: true;
    stores_only_authenticated_account_copy: true;
    uses_raw_browser_storage_dump: false;
  };
}

function isValidId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 64 &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

function isValidRecordKey(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 140) return false;
  const [type, id, extra] = value.split(":");
  return !extra && RECORD_TYPES.has(type) && isValidId(id);
}

function sanitizeType(value: unknown): DatabaseSyncRecordType | null {
  return typeof value === "string" && RECORD_TYPES.has(value)
    ? (value as DatabaseSyncRecordType)
    : null;
}

function recordKey(record: Pick<DatabaseSyncRecord, "type" | "id">): string {
  return `${record.type}:${record.id}`;
}

function nullableId(value: unknown): string | null {
  return isValidId(value) ? value : null;
}

function nullableString(value: unknown, maxChars = MAX_TEXT_CHARS): string | null {
  if (typeof value !== "string") return null;
  return value.slice(0, maxChars);
}

function requiredString(value: unknown, fallback: string): string {
  if (typeof value !== "string" || !value) return fallback;
  return value.slice(0, MAX_TEXT_CHARS);
}

function sanitizeRecord(value: unknown): DatabaseSyncRecord | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const type = sanitizeType(raw.type);
  if (!type || !isValidId(raw.id)) return null;
  if (typeof raw.updated_at !== "string" || !raw.updated_at) return null;
  if (typeof raw.created_at !== "string" || !raw.created_at) return null;

  const record: DatabaseSyncRecord = {
    type,
    id: raw.id,
    database_id: nullableId(raw.database_id),
    parent_page_id: nullableId(raw.parent_page_id),
    page_id: nullableId(raw.page_id),
    owner_id: requiredString(raw.owner_id, "local"),
    title: nullableString(raw.title),
    icon: nullableString(raw.icon, 64),
    description: nullableString(raw.description),
    name: nullableString(raw.name),
    field_type: nullableString(raw.field_type, 64),
    view_type: nullableString(raw.view_type, 64),
    config: nullableString(raw.config),
    field_values: nullableString(raw.field_values),
    position: typeof raw.position === "number" ? raw.position : 0,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    deleted_at: nullableString(raw.deleted_at, 128),
  };

  if (type === "database") {
    record.database_id = record.id;
    record.page_id = null;
    record.name = null;
    record.field_type = null;
    record.view_type = null;
    record.config = null;
    record.field_values = null;
  }
  if (type === "field" || type === "view" || type === "row") {
    if (!record.database_id) return null;
  }
  if (type === "row" && !record.page_id) return null;

  return JSON.stringify(record).length <= MAX_RECORD_BYTES ? record : null;
}

async function readIndex(
  config: AccountIdentityConfig,
  email: string
): Promise<Record<string, DatabaseSyncIndexEntry>> {
  const raw = await kvGet(config.kv, `${INDEX_KEY_PREFIX}${email}`);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const next: Record<string, DatabaseSyncIndexEntry> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!isValidRecordKey(key) || !value || typeof value !== "object") {
        continue;
      }
      const entry = value as Record<string, unknown>;
      const type = sanitizeType(entry.t);
      if (!type || typeof entry.u !== "string" || !entry.u) continue;
      next[key] = {
        u: entry.u,
        d: entry.d === 1 ? 1 : 0,
        t: type,
        db: nullableId(entry.db),
      };
    }
    return next;
  } catch {
    return {};
  }
}

function compareChangePosition(
  leftUpdatedAt: string,
  leftKey: string,
  rightUpdatedAt: string,
  rightKey: string
): number {
  return leftUpdatedAt.localeCompare(rightUpdatedAt) || leftKey.localeCompare(rightKey);
}

function parseCursor(value: string): DatabaseSyncChangeCursor {
  if (!value) return { updatedAt: "", key: "" };
  try {
    const parsed = JSON.parse(value) as Partial<DatabaseSyncChangeCursor>;
    if (
      parsed &&
      typeof parsed.updatedAt === "string" &&
      typeof parsed.key === "string"
    ) {
      return { updatedAt: parsed.updatedAt, key: parsed.key };
    }
  } catch {
    // Backward-compatible fallback for raw updated_at cursors.
  }
  return { updatedAt: value, key: "" };
}

function stringifyCursor(updatedAt: string, key: string): string {
  if (!updatedAt) return "";
  return JSON.stringify({ updatedAt, key });
}

function isAfterCursor(
  entry: { key: string; u: string },
  cursor: DatabaseSyncChangeCursor
): boolean {
  return (
    entry.u > cursor.updatedAt ||
    (entry.u === cursor.updatedAt && entry.key > cursor.key)
  );
}

function sanitizeChangeLogEntry(
  value: unknown
): DatabaseSyncChangeLogEntry | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const type = sanitizeType(raw.t);
  if (!isValidRecordKey(raw.key) || !type || typeof raw.u !== "string" || !raw.u) {
    return null;
  }
  return {
    key: raw.key,
    u: raw.u,
    d: raw.d === 1 ? 1 : 0,
    t: type,
  };
}

function normalizeChangeLog(
  entries: DatabaseSyncChangeLogEntry[]
): DatabaseSyncChangeLogEntry[] {
  const byPosition = new Map<string, DatabaseSyncChangeLogEntry>();
  for (const entry of entries) {
    byPosition.set(`${entry.u}\u0000${entry.key}`, entry);
  }
  return [...byPosition.values()].sort((a, b) =>
    compareChangePosition(a.u, a.key, b.u, b.key)
  );
}

async function readChangeLog(
  config: AccountIdentityConfig,
  email: string
): Promise<DatabaseSyncChangeLogEntry[]> {
  const raw = await kvGet(config.kv, `${CHANGE_LOG_KEY_PREFIX}${email}`);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return normalizeChangeLog(
      parsed
        .map(sanitizeChangeLogEntry)
        .filter((entry): entry is DatabaseSyncChangeLogEntry => Boolean(entry))
    );
  } catch {
    return [];
  }
}

async function appendChangeLog(
  config: AccountIdentityConfig,
  email: string,
  entries: DatabaseSyncChangeLogEntry[]
): Promise<void> {
  const valid = entries.filter((entry) => isValidRecordKey(entry.key) && entry.u);
  if (valid.length === 0) return;
  const existing = await readChangeLog(config, email);
  const next = normalizeChangeLog([...existing, ...valid]).slice(-CHANGE_LOG_LIMIT);
  await kvSet(
    config.kv,
    `${CHANGE_LOG_KEY_PREFIX}${email}`,
    JSON.stringify(next)
  );
}

function summarizeIndex(
  index: Record<string, DatabaseSyncIndexEntry>
): DatabaseSyncSummary {
  let count = 0;
  let deleted = 0;
  let maxUpdatedAt = "";
  let maxUpdatedKey = "";

  for (const [key, entry] of Object.entries(index)) {
    count += 1;
    if (entry.d === 1) deleted += 1;
    if (
      entry.u > maxUpdatedAt ||
      (entry.u === maxUpdatedAt && key > maxUpdatedKey)
    ) {
      maxUpdatedAt = entry.u;
      maxUpdatedKey = key;
    }
  }

  return {
    count,
    deleted,
    maxUpdatedAt,
    watermark: `${count}:${deleted}:${maxUpdatedAt}`,
    cursor: stringifyCursor(maxUpdatedAt, maxUpdatedKey),
  };
}

async function readRecordsByKeys(
  config: AccountIdentityConfig,
  email: string,
  keys: string[]
): Promise<DatabaseSyncRecord[]> {
  const records: DatabaseSyncRecord[] = [];
  const uniqueKeys = Array.from(new Set(keys.filter(isValidRecordKey))).slice(
    0,
    MAX_PULL_RECORDS
  );
  const raws = await Promise.all(
    uniqueKeys.map((key) =>
      kvGet(config.kv, `${RECORD_KEY_PREFIX}${email}:${key}`)
    )
  );
  for (const raw of raws) {
    if (!raw) continue;
    try {
      const record = sanitizeRecord(JSON.parse(raw));
      if (record) records.push(record);
    } catch {
      // skip corrupt record
    }
  }
  return records;
}

async function getChangesSince(
  config: AccountIdentityConfig,
  email: string,
  since: string,
  limit: number
): Promise<DatabaseSyncChangesResult> {
  const cursor = parseCursor(since);
  const log = await readChangeLog(config, email);
  const firstLogEntry = log[0];
  const canUseChangeLog =
    Boolean(cursor.updatedAt) &&
    Boolean(firstLogEntry) &&
    compareChangePosition(
      cursor.updatedAt,
      cursor.key,
      firstLogEntry?.u ?? "",
      firstLogEntry?.key ?? ""
    ) >= 0;

  if (canUseChangeLog) {
    const changed = log.filter((entry) => isAfterCursor(entry, cursor));
    const selected = changed.slice(0, limit);
    const records = await readRecordsByKeys(
      config,
      email,
      selected.map((entry) => entry.key)
    );
    const last = selected[selected.length - 1];
    return {
      records,
      count: records.length,
      totalChanged: changed.length,
      cursor: last ? stringifyCursor(last.u, last.key) : since,
      hasMore: changed.length > selected.length,
      source: "change-log",
    };
  }

  const index = await readIndex(config, email);
  const changed = Object.entries(index)
    .filter(
      ([key, entry]) =>
        isValidRecordKey(key) && isAfterCursor({ key, u: entry.u }, cursor)
    )
    .sort(
      ([leftKey, left], [rightKey, right]) =>
        compareChangePosition(left.u, leftKey, right.u, rightKey)
    );
  const selected = changed.slice(0, limit);
  const records = await readRecordsByKeys(
    config,
    email,
    selected.map(([key]) => key)
  );
  const last = selected[selected.length - 1];
  return {
    records,
    count: records.length,
    totalChanged: changed.length,
    cursor: last ? stringifyCursor(last[1].u, last[0]) : since,
    hasMore: changed.length > selected.length,
    summary: summarizeIndex(index),
    source: "index",
  };
}

async function getDatabaseMetadata(
  config: AccountIdentityConfig,
  email: string,
  limit: number
): Promise<DatabaseSyncMetadataResult> {
  const index = await readIndex(config, email);
  const databaseKeys = Object.entries(index)
    .filter(([key, entry]) => isValidRecordKey(key) && entry.t === "database")
    .sort(
      ([leftKey, left], [rightKey, right]) =>
        compareChangePosition(right.u, rightKey, left.u, leftKey)
    )
    .map(([key]) => key);
  const records = await readRecordsByKeys(
    config,
    email,
    databaseKeys.slice(0, limit)
  );
  return {
    records,
    count: records.length,
    total: databaseKeys.length,
    summary: summarizeIndex(index),
  };
}

async function getDatabaseRecords(
  config: AccountIdentityConfig,
  email: string,
  databaseId: string,
  offset: number,
  limit: number
): Promise<DatabaseRecordsResult> {
  const index = await readIndex(config, email);
  const typeOrder: Record<DatabaseSyncRecordType, number> = {
    database: 0,
    field: 1,
    view: 2,
    row: 3,
  };
  const databaseKey = `database:${databaseId}`;
  const keys = Object.entries(index)
    .filter(
      ([key, entry]) =>
        isValidRecordKey(key) &&
        (key === databaseKey || entry.db === databaseId)
    )
    .sort(
      ([leftKey, left], [rightKey, right]) =>
        typeOrder[left.t] - typeOrder[right.t] ||
        compareChangePosition(left.u, leftKey, right.u, rightKey)
    )
    .map(([key]) => key);
  const safeOffset = Math.min(Math.max(0, offset), keys.length);
  const selected = keys.slice(safeOffset, safeOffset + limit);
  const records = await readRecordsByKeys(config, email, selected);
  const nextOffset = safeOffset + selected.length;
  return {
    records,
    count: records.length,
    total: keys.length,
    offset: safeOffset,
    nextOffset: nextOffset < keys.length ? nextOffset : null,
    hasMore: nextOffset < keys.length,
    summary: summarizeIndex(index),
  };
}

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
    keys?: unknown;
    records?: unknown;
    databaseId?: unknown;
    since?: unknown;
    limit?: unknown;
    offset?: unknown;
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
        "数据库同步暂时无法确认账号；本地修改已保留，请稍后重试。"
      );
    }
    const me = account.email;

    if (body.action === "manifest") {
      const index = await readIndex(config, me);
      return NextResponse.json({ index });
    }

    if (body.action === "summary") {
      const index = await readIndex(config, me);
      return NextResponse.json({ summary: summarizeIndex(index) });
    }

    if (body.action === "database-metadata") {
      const limit =
        typeof body.limit === "number" && Number.isInteger(body.limit)
          ? Math.min(MAX_PULL_RECORDS, Math.max(1, body.limit))
          : MAX_PULL_RECORDS;
      const result = await getDatabaseMetadata(config, me, limit);
      return NextResponse.json({ ok: true, ...result });
    }

    if (body.action === "database-records") {
      if (!isValidId(body.databaseId)) {
        return NextResponse.json({ error: "缺少 databaseId" }, { status: 400 });
      }
      const limit =
        typeof body.limit === "number" && Number.isInteger(body.limit)
          ? Math.min(MAX_PULL_RECORDS, Math.max(1, body.limit))
          : MAX_PULL_RECORDS;
      const offset =
        typeof body.offset === "number" && Number.isInteger(body.offset)
          ? Math.max(0, body.offset)
          : 0;
      const result = await getDatabaseRecords(
        config,
        me,
        body.databaseId,
        offset,
        limit
      );
      return NextResponse.json({ ok: true, ...result });
    }

    if (body.action === "changes-since") {
      const since = typeof body.since === "string" ? body.since : "";
      const limit =
        typeof body.limit === "number" && Number.isInteger(body.limit)
          ? Math.min(MAX_PULL_RECORDS, Math.max(1, body.limit))
          : MAX_PULL_RECORDS;
      const result = await getChangesSince(config, me, since, limit);
      return NextResponse.json({ ok: true, ...result });
    }

    if (body.action === "pull") {
      if (!Array.isArray(body.keys)) {
        return NextResponse.json({ error: "缺少 keys" }, { status: 400 });
      }
      const records = await readRecordsByKeys(config, me, body.keys as string[]);
      return NextResponse.json({ records });
    }

    if (body.action === "push") {
      if (!Array.isArray(body.records)) {
        return NextResponse.json({ error: "缺少 records" }, { status: 400 });
      }
      if (body.records.length > MAX_PUSH_RECORDS) {
        return NextResponse.json({ error: "单次推送过多" }, { status: 400 });
      }

      const index = await readIndex(config, me);
      const accepted: string[] = [];
      const skipped: string[] = [];
      const rejected: string[] = [];
      const changeLogEntries: DatabaseSyncChangeLogEntry[] = [];

      for (const item of body.records) {
        const record = sanitizeRecord(item);
        if (!record) {
          rejected.push("invalid-record");
          continue;
        }
        const key = recordKey(record);
        const existing = index[key];
        if (existing && existing.u >= record.updated_at) {
          skipped.push(key);
          continue;
        }
        await kvSet(
          config.kv,
          `${RECORD_KEY_PREFIX}${me}:${key}`,
          JSON.stringify(record)
        );
        index[key] = {
          u: record.updated_at,
          d: record.deleted_at ? 1 : 0,
          t: record.type,
          db: record.database_id,
        };
        changeLogEntries.push({
          key,
          u: record.updated_at,
          d: record.deleted_at ? 1 : 0,
          t: record.type,
        });
        accepted.push(key);
      }

      if (accepted.length > 0) {
        await kvSet(
          config.kv,
          `${INDEX_KEY_PREFIX}${me}`,
          JSON.stringify(index)
        );
        await appendChangeLog(config, me, changeLogEntries);
      }
      const summary = summarizeIndex(index);
      const ack: DatabaseCloudAckReceipt = {
        format: "zhinote-database-cloud-ack-receipt",
        format_version: 1,
        ack_status:
          accepted.length > 0 || skipped.length > 0 ? "acknowledged" : "empty",
        generated_at: new Date().toISOString(),
        requested_count: body.records.length,
        accepted_count: accepted.length,
        skipped_count: skipped.length,
        rejected_count: rejected.length,
        index_count: summary.count,
        index_deleted: summary.deleted,
        remote_watermark: summary.watermark,
        remote_cursor: summary.cursor,
        boundary: {
          account_scoped: true,
          stores_only_authenticated_account_copy: true,
          uses_raw_browser_storage_dump: false,
        },
      };
      return NextResponse.json({ ok: true, accepted, skipped, rejected, ack });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch {
    return accountSessionUnconfirmedResponse(
      "数据库同步云端读写暂时失败；本地修改已保留，会稍后重试。"
    );
  }
}
