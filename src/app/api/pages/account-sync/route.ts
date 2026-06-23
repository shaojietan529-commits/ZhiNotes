import { NextResponse } from "next/server";
import {
  accountMissingEnv,
  getAccountConfig,
  getSessionAccount,
  kvGet,
  kvSet,
  readSessionToken,
  type AccountConfig,
} from "@/lib/account/server";
import { generateId } from "@/lib/utils/id";

export const dynamic = "force-dynamic";

// Account-scoped page cloud sync. Each signed-in account owns one cloud
// copy of its page tree, keyed by email, so the same workspace appears on
// every domain/device that signs in with that account. Local-first stays
// the default: nothing is uploaded until the owner turns the sync toggle
// on in /account (client-side gate), and this route additionally requires
// a valid session on every call.
//
// Storage layout (same KV store as portfolio sync):
//   zhinotes:pagesync:index:{email}        → { [pageId]: { u, d } }
//   zhinotes:pagesync:page:{email}:{id}    → full page record JSON
// Last-write-wins by updated_at; the server never overwrites a newer copy
// with an older one, so a stale device cannot roll back edits.

const INDEX_KEY_PREFIX = "zhinotes:pagesync:index:";
const PAGE_KEY_PREFIX = "zhinotes:pagesync:page:";
const MAX_PAYLOAD_BYTES = 950 * 1024;
const MAX_PUSH_RECORDS = 100;
const MAX_PULL_IDS = 50;
const DAILY_REPAIR_READ_BATCH = 100;
const DAILY_REPAIR_WRITE_BATCH = 50;
const DAILY_ROOT_TITLE = "每日纪要";
const MODULE_ROOT_TITLES = new Set([
  "每日纪要",
  "产业链研究",
  "ZhiHui",
  "会议日程",
  "知识库",
]);

interface IndexEntry {
  u: string; // updated_at
  d: 0 | 1; // deleted tombstone
}

interface IndexSummary {
  count: number;
  deleted: number;
  maxUpdatedAt: string;
  watermark: string;
}

interface PageRecord {
  id: string;
  parent_id: string | null;
  title: string;
  icon: string | null;
  cover_url: string | null;
  content_text: string | null;
  properties: string | null;
  position: number;
  depth: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface PageProperty {
  id: string;
  name: string;
  type: string;
  value: string;
  options?: string[];
}

interface DailyRepairResult {
  scanned: number;
  repaired: number;
  skippedNoDate: number;
  skippedNoRoot: boolean;
}

interface DailyManifestResult {
  rootId: string | null;
  ids: string[];
  count: number;
  scanned: number;
}

function isValidId(value: unknown): value is string {
  return (
    typeof value === "string" && value.length > 0 && value.length <= 64 &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

function sanitizeRecord(value: unknown): PageRecord | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (!isValidId(raw.id)) return null;
  if (typeof raw.updated_at !== "string" || !raw.updated_at) return null;
  if (typeof raw.created_at !== "string" || !raw.created_at) return null;
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  return {
    id: raw.id,
    parent_id: isValidId(raw.parent_id) ? raw.parent_id : null,
    title: typeof raw.title === "string" ? raw.title : "",
    icon: str(raw.icon),
    cover_url: str(raw.cover_url),
    content_text: str(raw.content_text),
    properties: str(raw.properties),
    position: typeof raw.position === "number" ? raw.position : 0,
    depth: typeof raw.depth === "number" ? raw.depth : 0,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    deleted_at: str(raw.deleted_at),
  };
}

async function readIndex(
  config: AccountConfig,
  email: string
): Promise<Record<string, IndexEntry>> {
  const raw = await kvGet(config.kv, `${INDEX_KEY_PREFIX}${email}`);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, IndexEntry>;
    }
  } catch {
    // corrupt index — per-page keys remain the source of truth and the
    // next push rebuilds the touched entries
  }
  return {};
}

function summarizeIndex(index: Record<string, IndexEntry>): IndexSummary {
  let count = 0;
  let deleted = 0;
  let maxUpdatedAt = "";
  for (const entry of Object.values(index)) {
    count += 1;
    if (entry.d === 1) deleted += 1;
    if (entry.u > maxUpdatedAt) maxUpdatedAt = entry.u;
  }
  return {
    count,
    deleted,
    maxUpdatedAt,
    watermark: `${count}:${deleted}:${maxUpdatedAt}`,
  };
}

function hasSameOriginReferer(request: Request): boolean {
  const referer = request.headers.get("referer");
  if (!referer) return false;
  try {
    return new URL(referer).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function parseProperties(raw: string | null): PageProperty[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (entry): entry is Record<string, unknown> =>
          Boolean(entry) && typeof entry === "object"
      )
      .map((entry) => ({
        id: typeof entry.id === "string" && entry.id ? entry.id : generateId(),
        name: typeof entry.name === "string" ? entry.name : "属性",
        type: typeof entry.type === "string" ? entry.type : "text",
        value: typeof entry.value === "string" ? entry.value : "",
        ...(Array.isArray(entry.options)
          ? { options: entry.options.filter((v): v is string => typeof v === "string") }
          : {}),
      }));
  } catch {
    return [];
  }
}

function getPropertyValue(record: PageRecord, name: string): string {
  return parseProperties(record.properties).find((property) => property.name === name)
    ?.value ?? "";
}

function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function formatInferredDate(
  yearText: string,
  monthText: string,
  dayText: string
): string | null {
  let year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return null;
  }
  if (yearText.length === 2) year += year >= 70 ? 1900 : 2000;
  if (
    year < 2000 ||
    year > 2099 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function inferDateFromTitle(title: string): string | null {
  const compact = title.match(
    /(?:^|[^0-9])([0-9]{2})([01][0-9])([0-3][0-9])(?:[^0-9]|$)/
  );
  if (compact) return formatInferredDate(compact[1], compact[2], compact[3]);

  const separated = title.match(
    /(?:^|[^0-9])([0-9]{4})[-/.年]([0-9]{1,2})[-/.月]([0-9]{1,2})(?:日)?(?:[^0-9]|$)/
  );
  if (separated) {
    return formatInferredDate(separated[1], separated[2], separated[3]);
  }
  return null;
}

function getDailyDateKey(record: PageRecord): string | null {
  const existing = getPropertyValue(record, "日期");
  if (isDateKey(existing)) return existing;
  return inferDateFromTitle(record.title);
}

function isRepairCandidate(record: PageRecord): boolean {
  if (record.deleted_at || record.parent_id !== null) return false;
  if (MODULE_ROOT_TITLES.has(record.title)) return false;
  const source = getPropertyValue(record, "来源");
  return (
    source === "notion-daily-import" ||
    isDateKey(getPropertyValue(record, "日期")) ||
    Boolean(inferDateFromTitle(record.title))
  );
}

function withDailyDateProperty(record: PageRecord, dateKey: string): string {
  const properties = parseProperties(record.properties);
  const existing = properties.find((property) => property.name === "日期");
  if (existing) {
    existing.type = "date";
    existing.value = dateKey;
  } else {
    properties.unshift({
      id: generateId(),
      name: "日期",
      type: "date",
      value: dateKey,
    });
  }
  return JSON.stringify(properties);
}

async function readIndexedPages(
  config: AccountConfig,
  email: string,
  index: Record<string, IndexEntry>
): Promise<PageRecord[]> {
  const pages: PageRecord[] = [];
  const ids = Object.keys(index);
  for (let i = 0; i < ids.length; i += DAILY_REPAIR_READ_BATCH) {
    const batch = ids.slice(i, i + DAILY_REPAIR_READ_BATCH);
    const raws = await Promise.all(
      batch.map((id) => kvGet(config.kv, `${PAGE_KEY_PREFIX}${email}:${id}`))
    );
    for (const raw of raws) {
      if (!raw) continue;
      try {
        const record = sanitizeRecord(JSON.parse(raw));
        if (record) pages.push(record);
      } catch {
        // skip corrupt record
      }
    }
  }
  return pages;
}

async function repairDailyImportPlacement(
  config: AccountConfig,
  email: string
): Promise<DailyRepairResult> {
  const index = await readIndex(config, email);
  const pages = await readIndexedPages(config, email, index);
  const active = pages.filter((page) => !page.deleted_at);
  const dailyRoot = active
    .filter((page) => page.parent_id === null && page.title === DAILY_ROOT_TITLE)
    .sort((a, b) => (a.id < b.id ? -1 : 1))[0];

  if (!dailyRoot) {
    return {
      scanned: active.length,
      repaired: 0,
      skippedNoDate: 0,
      skippedNoRoot: true,
    };
  }

  let nextPosition =
    Math.max(
      0,
      ...active
        .filter((page) => page.parent_id === dailyRoot.id)
        .map((page) => page.position || 0)
    ) + 1;
  const updates: PageRecord[] = [];
  let skippedNoDate = 0;

  for (const page of active.filter(isRepairCandidate)) {
    if (page.id === dailyRoot.id) continue;
    const dateKey = getDailyDateKey(page);
    if (!dateKey) {
      skippedNoDate += 1;
      continue;
    }
    const now = new Date().toISOString();
    const nextRecord: PageRecord = {
      ...page,
      parent_id: dailyRoot.id,
      depth: (dailyRoot.depth || 0) + 1,
      position: nextPosition,
      properties: withDailyDateProperty(page, dateKey),
      updated_at: now,
    };
    nextPosition += 1;
    index[nextRecord.id] = { u: now, d: 0 };
    updates.push(nextRecord);
  }

  for (let i = 0; i < updates.length; i += DAILY_REPAIR_WRITE_BATCH) {
    const batch = updates.slice(i, i + DAILY_REPAIR_WRITE_BATCH);
    await Promise.all(
      batch.map((record) =>
        kvSet(
          config.kv,
          `${PAGE_KEY_PREFIX}${email}:${record.id}`,
          JSON.stringify(record)
        )
      )
    );
  }

  if (updates.length > 0) {
    await kvSet(
      config.kv,
      `${INDEX_KEY_PREFIX}${email}`,
      JSON.stringify(index)
    );
  }

  return {
    scanned: active.length,
    repaired: updates.length,
    skippedNoDate,
    skippedNoRoot: false,
  };
}

async function getDailyManifest(
  config: AccountConfig,
  email: string
): Promise<DailyManifestResult> {
  const index = await readIndex(config, email);
  const pages = await readIndexedPages(config, email, index);
  const active = pages.filter((page) => !page.deleted_at);
  const dailyRoot = active
    .filter((page) => page.parent_id === null && page.title === DAILY_ROOT_TITLE)
    .sort((a, b) => (a.id < b.id ? -1 : 1))[0];

  if (!dailyRoot) {
    return { rootId: null, ids: [], count: 0, scanned: active.length };
  }

  const ids = new Set<string>([dailyRoot.id]);
  const childrenByParent = new Map<string, PageRecord[]>();
  for (const page of active) {
    if (!page.parent_id) continue;
    const children = childrenByParent.get(page.parent_id) ?? [];
    children.push(page);
    childrenByParent.set(page.parent_id, children);
  }

  const visit = (parentId: string) => {
    for (const child of childrenByParent.get(parentId) ?? []) {
      if (ids.has(child.id)) continue;
      ids.add(child.id);
      visit(child.id);
    }
  };
  visit(dailyRoot.id);

  // Also include top-level imported/date-tagged pages that are not yet under
  // the daily root. Nested non-daily pages may reference parents that are not
  // part of this targeted pull, so keep the force-pull set self-contained.
  for (const page of active) {
    if (isRepairCandidate(page)) {
      ids.add(page.id);
    }
  }

  return {
    rootId: dailyRoot.id,
    ids: Array.from(ids),
    count: ids.size,
    scanned: active.length,
  };
}

export async function GET(request: Request) {
  const config = getAccountConfig();
  if (!config) {
    return NextResponse.json(
      {
        error: "account system not configured",
        missing_env: accountMissingEnv(),
      },
      { status: 501 }
    );
  }

  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  const confirm = url.searchParams.get("confirm");
  if (
    action !== "repair-daily-imports" ||
    confirm !== "manual-daily-repair"
  ) {
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
  if (!hasSameOriginReferer(request)) {
    return NextResponse.json(
      { error: "请从 /account/repair-daily 页面触发修复。" },
      { status: 403 }
    );
  }

  const token = readSessionToken(request);
  if (!token) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  try {
    const account = await getSessionAccount(config, token);
    if (!account) {
      return NextResponse.json(
        { error: "登录已过期，请重新登录。" },
        { status: 401 }
      );
    }
    const result = await repairDailyImportPlacement(config, account.email);
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json(
      { error: "云端存储读写失败，请稍后重试。" },
      { status: 502 }
    );
  }
}

export async function POST(request: Request) {
  const config = getAccountConfig();
  if (!config) {
    return NextResponse.json(
      {
        error: "account system not configured",
        missing_env: accountMissingEnv(),
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

  let body: { action?: string; ids?: unknown; pages?: unknown };
  try {
    body = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  try {
    const account = await getSessionAccount(config, token);
    if (!account) {
      return NextResponse.json(
        { error: "登录已过期，请重新登录。" },
        { status: 401 }
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

    if (body.action === "repair-daily-imports") {
      const result = await repairDailyImportPlacement(config, me);
      return NextResponse.json({ ok: true, ...result });
    }

    if (body.action === "daily-manifest") {
      const result = await getDailyManifest(config, me);
      return NextResponse.json({ ok: true, ...result });
    }

    if (body.action === "pull") {
      if (!Array.isArray(body.ids)) {
        return NextResponse.json({ error: "缺少 ids" }, { status: 400 });
      }
      const ids = body.ids.filter(isValidId).slice(0, MAX_PULL_IDS);
      const pages: PageRecord[] = [];
      for (const id of ids) {
        const raw = await kvGet(config.kv, `${PAGE_KEY_PREFIX}${me}:${id}`);
        if (!raw) continue;
        try {
          const record = sanitizeRecord(JSON.parse(raw));
          if (record) pages.push(record);
        } catch {
          // skip corrupt record
        }
      }
      return NextResponse.json({ pages });
    }

    if (body.action === "push") {
      if (!Array.isArray(body.pages)) {
        return NextResponse.json({ error: "缺少 pages" }, { status: 400 });
      }
      if (body.pages.length > MAX_PUSH_RECORDS) {
        return NextResponse.json({ error: "单次推送过多" }, { status: 400 });
      }
      const index = await readIndex(config, me);
      const accepted: string[] = [];
      const skipped: string[] = [];

      for (const item of body.pages) {
        const record = sanitizeRecord(item);
        if (!record) continue;
        const existing = index[record.id];
        // Never let an older copy overwrite a newer one.
        if (existing && existing.u >= record.updated_at) {
          skipped.push(record.id);
          continue;
        }
        await kvSet(
          config.kv,
          `${PAGE_KEY_PREFIX}${me}:${record.id}`,
          JSON.stringify(record)
        );
        index[record.id] = {
          u: record.updated_at,
          d: record.deleted_at ? 1 : 0,
        };
        accepted.push(record.id);
      }

      if (accepted.length > 0) {
        await kvSet(
          config.kv,
          `${INDEX_KEY_PREFIX}${me}`,
          JSON.stringify(index)
        );
      }
      return NextResponse.json({ ok: true, accepted, skipped });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch {
    return NextResponse.json(
      { error: "云端存储读写失败，请稍后重试。" },
      { status: 502 }
    );
  }
}
