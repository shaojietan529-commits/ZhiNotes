import { kvGet, kvSet, normalizeEmail, type KvEnv } from "@/lib/account/server";
import {
  createPageProperty,
  parsePageProperties,
  stringifyPageProperties,
  type PageProperty,
  type PagePropertyType,
} from "@/lib/pages/pageProperties";
import { generateId } from "@/lib/utils/id";

const INDEX_KEY_PREFIX = "zhinotes:pagesync:index:";
const PAGE_KEY_PREFIX = "zhinotes:pagesync:page:";
const CHANGE_LOG_KEY_PREFIX = "zhinotes:pagesync:changes:";
const MAX_SCAN_PAGES = 3000;
const SCAN_CHUNK = 32;
const CHANGE_LOG_LIMIT = 5000;
const MAX_TRANSCRIPT_CHARS = 650_000;

interface IndexEntry {
  u: string;
  d: 0 | 1;
}

interface IndexSummary {
  count: number;
  deleted: number;
  maxUpdatedAt: string;
  cursor: string;
}

interface PageChangeLogEntry {
  id: string;
  u: string;
  d: 0 | 1;
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

interface MeetingImportPayload {
  schema_version?: unknown;
  workspace_id?: unknown;
  meeting?: unknown;
  content?: unknown;
  recording?: unknown;
  source_manifest?: unknown;
}

interface NormalizedMeetingImport {
  meetingKey: string;
  contentFingerprint: string;
  title: string;
  topic: string;
  organizer: string;
  platform: string;
  date: string;
  time: string;
  durationMinutes: string;
  language: string;
  minutesMarkdown: string;
  transcript: string;
  transcriptTruncated: boolean;
  recordingFilename: string;
  recordingSize: string;
  recordingUploadMode: string;
  importId: string;
}

export interface MeetingImportResult {
  importId: string;
  url: string;
  minutesPageId: string;
  meetingPageId: string;
  dailyPageId: string;
  dailyRootId: string;
  zhihuiRootId: string;
  meetingPageUrl: string;
  minutesPageUrl: string;
  accountEmail: string;
  meeting: {
    title: string;
    date: string;
    time: string;
    platform: string;
    organizer: string;
  };
  calendar: {
    source: "meeting-agent-import";
    dateKey: string;
    dailyPageId: string;
    meetingPageId: string;
    minutesPageId: string;
    changedPageIds: string[];
    changeLogEntries: number;
    previousCursor: string;
    nextCursor: string;
  };
}

export class MeetingImportError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
  }
}

export async function importMeetingArtifactToPages(
  kv: KvEnv,
  payload: unknown
): Promise<MeetingImportResult> {
  const accountEmail = resolveImportAccountEmail();
  const meeting = normalizeImportPayload(payload);
  const index = await readIndex(kv, accountEmail);
  const previousSummary = summarizeIndex(index);
  const pages = await readActivePages(kv, accountEmail, index);

  const dailyRoot = await resolveOrCreateRoot({
    kv,
    email: accountEmail,
    index,
    pages,
    title: "每日纪要",
    icon: "📅",
  });
  const zhihuiRoot = await resolveOrCreateRoot({
    kv,
    email: accountEmail,
    index,
    pages,
    title: "ZhiHui",
    legacyTitles: ["会议日程"],
    icon: "🗓️",
  });

  const now = new Date().toISOString();
  let meetingPage = await upsertMeetingPage({
    kv,
    email: accountEmail,
    index,
    pages,
    rootId: zhihuiRoot.id,
    meeting,
    now,
  });

  let dailyPage = await upsertDailyPage({
    kv,
    email: accountEmail,
    index,
    pages,
    rootId: dailyRoot.id,
    meeting,
    now,
  });

  const minutesPage = await upsertMinutesPage({
    kv,
    email: accountEmail,
    index,
    pages,
    dailyPageId: dailyPage.id,
    meetingPageId: meetingPage.id,
    meeting,
    now,
  });

  dailyPage = await upsertDailyPage({
    kv,
    email: accountEmail,
    index,
    pages,
    rootId: dailyRoot.id,
    meeting,
    now,
    minutesPage,
    legacyMeetingPageId: meetingPage.id,
  });

  meetingPage = await upsertMeetingPage({
    kv,
    email: accountEmail,
    index,
    pages,
    rootId: zhihuiRoot.id,
    meeting,
    now,
    minutesPage,
  });

  const changedRecords = uniquePageRecords([
    dailyRoot,
    zhihuiRoot,
    dailyPage,
    meetingPage,
    minutesPage,
  ]);
  const nextSummary = summarizeIndex(index);
  await writeIndex(kv, accountEmail, index);
  const changeLogEntries = await appendMeetingImportChangeLog(
    kv,
    accountEmail,
    changedRecords
  );

  return {
    importId: meeting.importId,
    url: `/page/${minutesPage.id}`,
    minutesPageId: minutesPage.id,
    meetingPageId: meetingPage.id,
    dailyPageId: dailyPage.id,
    dailyRootId: dailyRoot.id,
    zhihuiRootId: zhihuiRoot.id,
    meetingPageUrl: `/page/${meetingPage.id}`,
    minutesPageUrl: `/page/${minutesPage.id}`,
    accountEmail,
    meeting: {
      title: meeting.title,
      date: meeting.date,
      time: meeting.time,
      platform: meeting.platform,
      organizer: meeting.organizer,
    },
    calendar: {
      source: "meeting-agent-import",
      dateKey: meeting.date,
      dailyPageId: dailyPage.id,
      meetingPageId: meetingPage.id,
      minutesPageId: minutesPage.id,
      changedPageIds: changedRecords.map((page) => page.id),
      changeLogEntries,
      previousCursor: previousSummary.cursor,
      nextCursor: nextSummary.cursor,
    },
  };
}

function resolveImportAccountEmail() {
  const explicit = normalizeEmail(
    process.env.ZHINOTES_AGENT_ACCOUNT_EMAIL ??
      process.env.ZHIHUI_AGENT_ACCOUNT_EMAIL ??
      ""
  );
  const allowed = (process.env.ZHINOTES_ACCOUNT_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter((email): email is string => Boolean(email));

  if (explicit) {
    if (allowed.length > 0 && !allowed.includes(explicit)) {
      throw new MeetingImportError(
        "ZHINOTES_AGENT_ACCOUNT_EMAIL is not in ZHINOTES_ACCOUNT_ALLOWED_EMAILS",
        501
      );
    }
    return explicit;
  }

  if (allowed.length === 1) return allowed[0];
  if (allowed.length === 0) {
    throw new MeetingImportError(
      "missing ZHINOTES_AGENT_ACCOUNT_EMAIL or ZHINOTES_ACCOUNT_ALLOWED_EMAILS",
      501
    );
  }
  throw new MeetingImportError(
    "multiple account emails configured; set ZHINOTES_AGENT_ACCOUNT_EMAIL for ZhiHui imports",
    501
  );
}

function normalizeImportPayload(payload: unknown): NormalizedMeetingImport {
  if (!payload || typeof payload !== "object") {
    throw new MeetingImportError("invalid import payload");
  }
  const importPayload = payload as MeetingImportPayload;
  if (importPayload.schema_version !== "zhinotes.meeting_import.v1") {
    throw new MeetingImportError("unsupported meeting import schema");
  }

  const meeting = objectValue(importPayload.meeting);
  const content = objectValue(importPayload.content);
  const recording = objectValue(importPayload.recording);
  const sourceManifest = objectValue(importPayload.source_manifest);
  const fingerprint = objectValue(sourceManifest.content_fingerprint);

  const topic = text(meeting.topic, 300) || text(meeting.title, 500) || "会议";
  const organizer = text(meeting.organizer, 160) || "未知组织者";
  const startTime = text(meeting.start_time, 80);
  const date = extractDate(startTime, text(meeting.date_label, 40));
  if (!date) {
    throw new MeetingImportError("meeting import is missing a valid date");
  }
  const time = extractTime(startTime, numberText(meeting.duration_minutes));
  const title =
    text(meeting.title, 500) || [topic, organizer, date].filter(Boolean).join("-");
  const contentFingerprint = text(fingerprint.sha256, 80);
  const meetingKey =
    text(meeting.meeting_key, 200) || contentFingerprint || `${title}-${date}`;
  const importId = contentFingerprint || generateId();
  const transcriptRaw = text(content.transcript, MAX_TRANSCRIPT_CHARS + 1);
  const transcriptTruncated = transcriptRaw.length > MAX_TRANSCRIPT_CHARS;

  return {
    meetingKey,
    contentFingerprint,
    title,
    topic,
    organizer,
    platform: normalizePlatform(text(meeting.platform, 80)),
    date,
    time,
    durationMinutes: numberText(meeting.duration_minutes),
    language: text(meeting.language, 40),
    minutesMarkdown: text(content.minutes_markdown, 900_000),
    transcript: transcriptRaw.slice(0, MAX_TRANSCRIPT_CHARS),
    transcriptTruncated,
    recordingFilename: text(recording.filename, 80) || "recording",
    recordingSize: numberText(recording.size_bytes),
    recordingUploadMode: text(recording.upload_mode, 120),
    importId,
  };
}

async function upsertMeetingPage({
  kv,
  email,
  index,
  pages,
  rootId,
  meeting,
  now,
  minutesPage,
}: {
  kv: KvEnv;
  email: string;
  index: Record<string, IndexEntry>;
  pages: PageRecord[];
  rootId: string;
  meeting: NormalizedMeetingImport;
  now: string;
  minutesPage?: PageRecord;
}) {
  const existing = pages.find((page) => {
    if (page.parent_id !== rootId || page.deleted_at) return false;
    const props = parsePageProperties(page.properties);
    return (
      propValue(props, "Meeting Key") === meeting.meetingKey ||
      (meeting.contentFingerprint &&
        propValue(props, "内容指纹") === meeting.contentFingerprint) ||
      page.title === meeting.title
    );
  });

  const page = existing
    ? { ...existing }
    : createPageRecord({
        parentId: rootId,
        title: meeting.title,
        icon: "🗓️",
        depth: 1,
        now,
      });

  page.title = meeting.title;
  page.icon = "🗓️";
  page.content_text = buildMeetingDetailPageHtml(meeting, minutesPage);
  page.properties = stringifyPageProperties([
    prop("date", "日期", meeting.date),
    prop("text", "时间", meeting.time),
    prop("select", "平台", meeting.platform, [
      "腾讯会议",
      "Zoom",
      "Webex",
      "进门财经",
      "久谦论坛",
      "Teams",
      "Google Meet",
      "其他",
    ]),
    prop("text", "组织者", meeting.organizer),
    prop("select", "会议痕迹", "已完成", [
      "已留痕-待执行",
      "已留痕-待补时间",
      "导入失败-已留痕",
      "已完成",
      "已取消",
    ]),
    prop("select", "时间状态", "已识别", ["已识别", "待补充"]),
    prop("select", "录制状态", "录制成功", [
      "待执行",
      "录制中",
      "录制成功",
      "录制失败",
      "跳过",
    ]),
    prop("select", "录制链路", "已验证", ["未验证", "已验证", "未就绪"]),
    prop("text", "导入时间", now),
    prop("select", "转写模型", inferTranscriptionModel(meeting), [
      "auto",
      "qwen",
      "gpt",
    ]),
    prop("select", "会议优先级", "default", ["default", "high"]),
    prop("select", "录制任务", "已完成", [
      "未入队",
      "已入队",
      "已完成",
      "失败",
    ]),
    prop("text", "录制任务ID", meeting.importId),
    prop("select", "导入来源", "meeting-agent", [
      "手动输入",
      "邮件",
      "meeting-agent",
      "页面导入",
    ]),
    prop("select", "入会链接状态", "已脱敏", [
      "已读取",
      "未读取",
      "已脱敏",
    ]),
    prop("text", "Meeting Key", meeting.meetingKey),
    prop("text", "内容指纹", meeting.contentFingerprint),
    prop("text", "留痕说明", "录音、转写和纪要已由 ZhiHui agent 生成并入库。"),
  ]);
  page.updated_at = now;
  await writePage(kv, email, index, page);
  replacePage(pages, page);
  return page;
}

async function upsertDailyPage({
  kv,
  email,
  index,
  pages,
  rootId,
  meeting,
  now,
  minutesPage,
  legacyMeetingPageId,
}: {
  kv: KvEnv;
  email: string;
  index: Record<string, IndexEntry>;
  pages: PageRecord[];
  rootId: string;
  meeting: NormalizedMeetingImport;
  now: string;
  minutesPage?: PageRecord;
  legacyMeetingPageId?: string;
}) {
  const existing = pages.find((page) => {
    if (page.parent_id !== rootId || page.deleted_at) return false;
    if (page.title === meeting.date) return true;
    return propValue(parsePageProperties(page.properties), "日期") === meeting.date;
  });
  const page = existing
    ? { ...existing }
    : createPageRecord({
        parentId: rootId,
        title: meeting.date,
        icon: "📅",
        depth: 1,
        now,
      });

  const properties = parsePageProperties(page.properties);
  if (!propValue(properties, "日期")) {
    properties.push(prop("date", "日期", meeting.date));
  }
  ensureProperty(properties, "要点", "text");
  ensureProperty(properties, "Summary", "text");
  ensureProperty(properties, "相关公司", "tags");
  ensureProperty(properties, "相关行业", "tags");

  const existingBody = page.content_text ?? "";
  page.title = meeting.date;
  page.icon = "📅";
  page.properties = stringifyPageProperties(properties);
  let nextBody = existingBody;
  if (legacyMeetingPageId) {
    nextBody = removeMentionParagraph(nextBody, legacyMeetingPageId);
  }
  if (minutesPage && !nextBody.includes(`data-id="${minutesPage.id}"`)) {
    nextBody += buildDailyMentionHtml({
      title: minutesPage.title,
      pageId: minutesPage.id,
    });
  }
  page.content_text = nextBody;
  page.updated_at = now;
  await writePage(kv, email, index, page);
  replacePage(pages, page);
  return page;
}

async function upsertMinutesPage({
  kv,
  email,
  index,
  pages,
  dailyPageId,
  meetingPageId,
  meeting,
  now,
}: {
  kv: KvEnv;
  email: string;
  index: Record<string, IndexEntry>;
  pages: PageRecord[];
  dailyPageId: string;
  meetingPageId: string;
  meeting: NormalizedMeetingImport;
  now: string;
}) {
  const title = buildMinutesPageTitle(meeting);
  const existing = pages.find((page) => {
    if (page.parent_id !== dailyPageId || page.deleted_at) return false;
    const props = parsePageProperties(page.properties);
    return (
      propValue(props, "Meeting Key") === meeting.meetingKey ||
      (meeting.contentFingerprint &&
        propValue(props, "内容指纹") === meeting.contentFingerprint) ||
      page.title === title
    );
  });
  const page = existing
    ? { ...existing }
    : createPageRecord({
        parentId: dailyPageId,
        title,
        icon: "📝",
        depth: 2,
        now,
      });

  page.title = title;
  page.icon = "📝";
  page.content_text = buildMinutesPageHtml(meeting, meetingPageId);
  page.properties = stringifyPageProperties([
    prop("date", "日期", meeting.date),
    prop("select", "平台", meeting.platform, [
      "腾讯会议",
      "Zoom",
      "Webex",
      "进门财经",
      "久谦论坛",
      "Teams",
      "Google Meet",
      "其他",
    ]),
    prop("text", "组织者", meeting.organizer),
    prop("text", "会议详情页", `/page/${meetingPageId}`),
    prop("text", "Meeting Key", meeting.meetingKey),
    prop("text", "内容指纹", meeting.contentFingerprint),
    prop("text", "导入时间", now),
    prop("select", "导入来源", "meeting-agent", [
      "手动输入",
      "邮件",
      "meeting-agent",
      "页面导入",
    ]),
  ]);
  page.updated_at = now;
  await writePage(kv, email, index, page);
  replacePage(pages, page);
  return page;
}

async function resolveOrCreateRoot({
  kv,
  email,
  index,
  pages,
  title,
  legacyTitles = [],
  icon,
}: {
  kv: KvEnv;
  email: string;
  index: Record<string, IndexEntry>;
  pages: PageRecord[];
  title: string;
  legacyTitles?: string[];
  icon: string;
}) {
  const titles = new Set([title, ...legacyTitles]);
  const existing = pages
    .filter(
      (page) =>
        !page.deleted_at && page.parent_id === null && titles.has(page.title)
    )
    .sort((a, b) => (a.id < b.id ? -1 : 1))[0];
  if (existing) {
    if (existing.title !== title || existing.icon !== icon) {
      const updated = {
        ...existing,
        title,
        icon,
        updated_at: new Date().toISOString(),
      };
      await writePage(kv, email, index, updated);
      replacePage(pages, updated);
      return updated;
    }
    return existing;
  }

  const now = new Date().toISOString();
  const page = createPageRecord({
    parentId: null,
    title,
    icon,
    depth: 0,
    now,
  });
  await writePage(kv, email, index, page);
  pages.push(page);
  return page;
}

async function readIndex(kv: KvEnv, email: string) {
  const raw = await kvGet(kv, `${INDEX_KEY_PREFIX}${email}`);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, IndexEntry>;
    }
  } catch {
    // corrupt index; caller can rebuild touched records
  }
  return {};
}

async function writeIndex(
  kv: KvEnv,
  email: string,
  index: Record<string, IndexEntry>
) {
  await kvSet(kv, `${INDEX_KEY_PREFIX}${email}`, JSON.stringify(index));
}

async function appendMeetingImportChangeLog(
  kv: KvEnv,
  email: string,
  records: PageRecord[]
) {
  const entries = records
    .filter((record) => isValidPageId(record.id) && record.updated_at)
    .map((record) => ({
      id: record.id,
      u: record.updated_at,
      d: record.deleted_at ? 1 : 0,
    }) satisfies PageChangeLogEntry);
  if (entries.length === 0) return 0;

  try {
    const existing = await readChangeLog(kv, email);
    const next = normalizeChangeLog([...existing, ...entries]).slice(
      -CHANGE_LOG_LIMIT
    );
    await kvSet(
      kv,
      `${CHANGE_LOG_KEY_PREFIX}${email}`,
      JSON.stringify(next)
    );
    return entries.length;
  } catch {
    // Page records and the index are authoritative. If this acceleration log
    // write fails, the next calendar metadata request can still rebuild safely.
    return 0;
  }
}

async function readChangeLog(kv: KvEnv, email: string) {
  const raw = await kvGet(kv, `${CHANGE_LOG_KEY_PREFIX}${email}`);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return normalizeChangeLog(
      parsed
        .map(sanitizeChangeLogEntry)
        .filter((entry): entry is PageChangeLogEntry => Boolean(entry))
    );
  } catch {
    return [];
  }
}

function sanitizeChangeLogEntry(value: unknown): PageChangeLogEntry | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (!isValidPageId(raw.id)) return null;
  if (typeof raw.u !== "string" || !raw.u) return null;
  return {
    id: raw.id,
    u: raw.u,
    d: raw.d === 1 ? 1 : 0,
  };
}

function normalizeChangeLog(entries: PageChangeLogEntry[]) {
  const byPosition = new Map<string, PageChangeLogEntry>();
  for (const entry of entries) {
    byPosition.set(`${entry.u}\u0000${entry.id}`, entry);
  }
  return [...byPosition.values()].sort((a, b) =>
    compareChangePosition(a.u, a.id, b.u, b.id)
  );
}

function summarizeIndex(index: Record<string, IndexEntry>): IndexSummary {
  let count = 0;
  let deleted = 0;
  let maxUpdatedAt = "";
  let maxUpdatedId = "";
  for (const [id, entry] of Object.entries(index)) {
    count += 1;
    if (entry.d === 1) deleted += 1;
    if (
      entry.u > maxUpdatedAt ||
      (entry.u === maxUpdatedAt && id > maxUpdatedId)
    ) {
      maxUpdatedAt = entry.u;
      maxUpdatedId = id;
    }
  }
  return {
    count,
    deleted,
    maxUpdatedAt,
    cursor: stringifyPageChangeCursor(maxUpdatedAt, maxUpdatedId),
  };
}

function compareChangePosition(
  leftUpdatedAt: string,
  leftId: string,
  rightUpdatedAt: string,
  rightId: string
) {
  return leftUpdatedAt.localeCompare(rightUpdatedAt) || leftId.localeCompare(rightId);
}

function stringifyPageChangeCursor(updatedAt: string, id: string) {
  if (!updatedAt) return "";
  return JSON.stringify({ updatedAt, id });
}

async function readActivePages(
  kv: KvEnv,
  email: string,
  index: Record<string, IndexEntry>
) {
  const ids = Object.entries(index)
    .filter(([, entry]) => entry && entry.d !== 1)
    .map(([id]) => id)
    .slice(0, MAX_SCAN_PAGES);
  const pages: PageRecord[] = [];
  for (let i = 0; i < ids.length; i += SCAN_CHUNK) {
    const chunk = ids.slice(i, i + SCAN_CHUNK);
    const raws = await Promise.all(
      chunk.map((id) => kvGet(kv, `${PAGE_KEY_PREFIX}${email}:${id}`))
    );
    for (const raw of raws) {
      const page = parsePageRecord(raw);
      if (page && !page.deleted_at) pages.push(page);
    }
  }
  return pages;
}

async function writePage(
  kv: KvEnv,
  email: string,
  index: Record<string, IndexEntry>,
  page: PageRecord
) {
  await kvSet(kv, `${PAGE_KEY_PREFIX}${email}:${page.id}`, JSON.stringify(page));
  index[page.id] = { u: page.updated_at, d: page.deleted_at ? 1 : 0 };
}

function parsePageRecord(raw: string | null): PageRecord | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    if (typeof obj.id !== "string" || !obj.id) return null;
    if (typeof obj.updated_at !== "string" || !obj.updated_at) return null;
    if (typeof obj.created_at !== "string" || !obj.created_at) return null;
    return {
      id: obj.id,
      parent_id: typeof obj.parent_id === "string" ? obj.parent_id : null,
      title: typeof obj.title === "string" ? obj.title : "",
      icon: typeof obj.icon === "string" ? obj.icon : null,
      cover_url: typeof obj.cover_url === "string" ? obj.cover_url : null,
      content_text:
        typeof obj.content_text === "string" ? obj.content_text : null,
      properties: typeof obj.properties === "string" ? obj.properties : null,
      position: typeof obj.position === "number" ? obj.position : Date.now(),
      depth: typeof obj.depth === "number" ? obj.depth : 0,
      created_at: obj.created_at,
      updated_at: obj.updated_at,
      deleted_at: typeof obj.deleted_at === "string" ? obj.deleted_at : null,
    };
  } catch {
    return null;
  }
}

function createPageRecord({
  parentId,
  title,
  icon,
  depth,
  now,
}: {
  parentId: string | null;
  title: string;
  icon: string;
  depth: number;
  now: string;
}): PageRecord {
  return {
    id: generateId(),
    parent_id: parentId,
    title,
    icon,
    cover_url: null,
    content_text: null,
    properties: null,
    position: Date.now(),
    depth,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
}

function replacePage(pages: PageRecord[], page: PageRecord) {
  const index = pages.findIndex((item) => item.id === page.id);
  if (index >= 0) pages[index] = page;
  else pages.push(page);
}

function uniquePageRecords(records: PageRecord[]) {
  const byId = new Map<string, PageRecord>();
  for (const record of records) byId.set(record.id, record);
  return [...byId.values()];
}

function buildMeetingDetailPageHtml(
  meeting: NormalizedMeetingImport,
  minutesPage?: PageRecord
) {
  const minutesLink = minutesPage
    ? buildPageMentionHtml({
        pageId: minutesPage.id,
        label: minutesPage.title,
      })
    : "纪要页面创建中";
  return [
    `<h1>${escapeHtml(meeting.title)}</h1>`,
    "<p>ZhiHui 已完成这场会议的录音、转写和纪要入库。这个页面保留会议执行痕迹；完整纪要单独存放在每日纪要下的纪要页面。</p>",
    "<h2>纪要页面</h2>",
    `<p>${minutesLink}</p>`,
    "<h2>会议信息</h2>",
    "<table><tbody>",
    row("主题", meeting.topic),
    row("组织方", meeting.organizer),
    row("日期", meeting.date),
    row("时间", meeting.time),
    row("平台", meeting.platform),
    row("转写模型", inferTranscriptionModel(meeting)),
    row("录音文件", meeting.recordingFilename),
    row("录音大小", formatBytes(meeting.recordingSize)),
    "</tbody></table>",
  ].join("");
}

function buildMinutesPageHtml(
  meeting: NormalizedMeetingImport,
  meetingPageId: string
) {
  const transcriptNote = meeting.transcriptTruncated
    ? "<p><strong>提示：</strong>转写全文超过页面同步上限，已保留前半部分；完整文件仍在 ZhiHui 本地产物目录。</p>"
    : "";
  return [
    `<h1>${escapeHtml(buildMinutesPageTitle(meeting))}</h1>`,
    "<h2>会议详情</h2>",
    `<p>${buildPageMentionHtml({
      pageId: meetingPageId,
      label: meeting.title,
    })}</p>`,
    "<h2>会议纪要</h2>",
    markdownToHtml(meeting.minutesMarkdown || "纪要为空。"),
    "<h2>录音</h2>",
    "<table><tbody>",
    row("文件", meeting.recordingFilename),
    row("大小", formatBytes(meeting.recordingSize)),
    row("保存状态", meeting.recordingUploadMode || "metadata_only"),
    "</tbody></table>",
    "<h2>转写全文</h2>",
    transcriptNote,
    `<details><summary>展开转写</summary><pre>${escapeHtml(
      meeting.transcript || "转写为空。"
    )}</pre></details>`,
  ].join("");
}

function buildDailyMentionHtml({
  title,
  pageId,
}: {
  title: string;
  pageId: string;
}) {
  return `<p>${buildPageMentionHtml({ pageId, label: title })}</p>`;
}

function buildPageMentionHtml({
  pageId,
  label,
}: {
  pageId: string;
  label: string;
}) {
  return (
    `<a data-type="mention" data-id="${pageId}" ` +
    `data-label="${escapeHtml(label)}" href="/page/${pageId}" ` +
    `class="wiki-link inline-flex items-center gap-0.5 px-1 py-0.5 rounded ` +
    `bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 text-sm ` +
    `font-medium cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900 ` +
    `transition-colors no-underline">📄 ${escapeHtml(label)}</a>`
  );
}

function markdownToHtml(markdown: string) {
  const lines = markdown.split(/\r?\n/);
  const html: string[] = [];
  let inList = false;
  const closeList = () => {
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
  };
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      closeList();
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = Math.min(3, heading[1].length + 1);
      html.push(`<h${level}>${escapeHtml(heading[2])}</h${level}>`);
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${escapeHtml(bullet[1])}</li>`);
      continue;
    }
    closeList();
    html.push(`<p>${escapeHtml(line)}</p>`);
  }
  closeList();
  return html.join("");
}

function prop(
  type: PagePropertyType,
  name: string,
  value: string,
  options?: string[]
): PageProperty {
  return {
    ...createPageProperty(type, name),
    value,
    ...(type === "select" && options ? { options } : {}),
  };
}

function ensureProperty(
  properties: PageProperty[],
  name: string,
  type: PagePropertyType
) {
  if (!properties.some((item) => item.name === name)) {
    properties.push(createPageProperty(type, name));
  }
}

function propValue(properties: PageProperty[], name: string) {
  return properties.find((item) => item.name === name)?.value ?? "";
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function text(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function numberText(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

function isValidPageId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 64 &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

function extractDate(startTime: string, dateLabel: string) {
  const direct = startTime.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
  if (direct) return direct;
  const fromLabel = dateLabel.match(/(\d{4}-\d{2}-\d{2})/)?.[1];
  return fromLabel ?? "";
}

function extractTime(startTime: string, durationMinutes: string) {
  const start = startTime.match(/T(\d{2}:\d{2})/)?.[1] ?? "";
  if (!start) return "";
  const duration = Number(durationMinutes);
  if (!Number.isFinite(duration) || duration <= 0) return start;
  const [hour, minute] = start.split(":").map(Number);
  const total = hour * 60 + minute + duration;
  const end = `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(
    total % 60
  ).padStart(2, "0")}`;
  return `${start}-${end}`;
}

function normalizePlatform(platform: string) {
  if (platform === "jinmen_finance" || platform.includes("进门")) return "进门财经";
  if (platform === "tencent_meeting" || platform.includes("腾讯")) return "腾讯会议";
  if (platform === "zoom" || platform.toLowerCase().includes("zoom")) return "Zoom";
  if (platform === "webex" || platform.toLowerCase().includes("webex")) return "Webex";
  if (platform.includes("久谦") || platform.toLowerCase().includes("meritco")) {
    return "久谦论坛";
  }
  if (platform.toLowerCase().includes("teams")) return "Teams";
  if (platform.toLowerCase().includes("google")) return "Google Meet";
  return platform || "其他";
}

function inferTranscriptionModel(meeting: NormalizedMeetingImport) {
  const value = `${meeting.language}\n${meeting.topic}\n${meeting.organizer}`;
  const chineseChars = value.match(/[\u3400-\u9fff]/g)?.length ?? 0;
  const latinWords = value.match(/[a-zA-Z]{2,}/g)?.length ?? 0;
  return chineseChars >= latinWords * 2 ? "qwen" : "gpt";
}

function buildMinutesPageTitle(meeting: NormalizedMeetingImport) {
  return [
    cleanTitlePart(meeting.topic || "会议"),
    cleanTitlePart(meeting.organizer || "未知组织方"),
    toCompactDate(meeting.date),
  ]
    .filter(Boolean)
    .join("-");
}

function cleanTitlePart(value: string) {
  return value.replace(/\s+/g, " ").replace(/[\\/:*?"<>|]/g, "").trim();
}

function toCompactDate(date: string) {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return date;
  return `${match[1].slice(2)}${match[2]}${match[3]}`;
}

function removeMentionParagraph(html: string, pageId: string) {
  if (!pageId || !html.includes(`data-id="${pageId}"`)) return html;
  const escaped = pageId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.replace(
    new RegExp(`<p>\\s*<a[^>]+data-id="${escaped}"[\\s\\S]*?<\\/a>\\s*<\\/p>`, "g"),
    ""
  );
}

function row(label: string, value: string) {
  return `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value || "无")}</td></tr>`;
}

function formatBytes(value: string) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return "未知";
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
