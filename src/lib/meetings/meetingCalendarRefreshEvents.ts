export const MEETING_CALENDAR_REFRESH_EVENT =
  "zhinote:meeting-calendar-refresh";
export const MEETING_CALENDAR_REFRESH_STORAGE_KEY =
  "zhinote.meeting.calendarRefresh.v1";

const MEETING_CALENDAR_REFRESH_TTL_MS = 30_000;
const MAX_CHANGED_PAGE_IDS = 32;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type MeetingCalendarRefreshSurface = "daily" | "meeting";

export type MeetingCalendarRefreshSource =
  | "meeting-local-draft"
  | "meeting-agent-import";

export type MeetingCalendarRefreshReason =
  | "meeting-local-draft"
  | "meeting-import-change-log";

export type MeetingCalendarRefreshMode =
  | "local-page-update"
  | "incremental-change-log"
  | "full-cache-rebuild";

export interface MeetingCalendarRefreshPayloadInput {
  source: MeetingCalendarRefreshSource;
  dateKey: string;
  affectedCalendars: MeetingCalendarRefreshSurface[];
  changedPageIds: string[];
  metadataRefreshReason: MeetingCalendarRefreshReason;
  metadataRefreshMode: MeetingCalendarRefreshMode;
  fullCacheRebuildRequired: boolean;
}

export interface MeetingCalendarRefreshPayload
  extends MeetingCalendarRefreshPayloadInput {
  schema: "zhinote.meeting.calendar-refresh.v1";
  generatedAt: string;
  expiresAt: string;
  metadataOnly: true;
  readsPageBodyText: false;
  readsMeetingContent: false;
  readsMeetingCredentials: false;
}

export function createMeetingCalendarRefreshPayload(
  input: MeetingCalendarRefreshPayloadInput,
  now = new Date()
): MeetingCalendarRefreshPayload | null {
  if (!DATE_KEY_PATTERN.test(input.dateKey)) return null;
  const affectedCalendars = normalizeAffectedCalendars(input.affectedCalendars);
  if (affectedCalendars.length === 0) return null;
  const generatedAt = now.toISOString();
  const expiresAt = new Date(
    now.getTime() + MEETING_CALENDAR_REFRESH_TTL_MS
  ).toISOString();

  return {
    schema: "zhinote.meeting.calendar-refresh.v1",
    source: input.source,
    dateKey: input.dateKey,
    affectedCalendars,
    changedPageIds: normalizeChangedPageIds(input.changedPageIds),
    metadataRefreshReason: input.metadataRefreshReason,
    metadataRefreshMode: input.metadataRefreshMode,
    fullCacheRebuildRequired: input.fullCacheRebuildRequired,
    generatedAt,
    expiresAt,
    metadataOnly: true,
    readsPageBodyText: false,
    readsMeetingContent: false,
    readsMeetingCredentials: false,
  };
}

export function dispatchMeetingCalendarRefresh(
  input: MeetingCalendarRefreshPayloadInput
): MeetingCalendarRefreshPayload | null {
  if (typeof window === "undefined") return null;
  const payload = createMeetingCalendarRefreshPayload(input);
  if (!payload) return null;

  window.dispatchEvent(
    new CustomEvent<MeetingCalendarRefreshPayload>(
      MEETING_CALENDAR_REFRESH_EVENT,
      { detail: payload }
    )
  );

  try {
    window.localStorage.setItem(
      MEETING_CALENDAR_REFRESH_STORAGE_KEY,
      JSON.stringify(payload)
    );
  } catch {
    // Same-tab listeners already received the event; storage is only a cross-tab hint.
  }

  return payload;
}

export function parseMeetingCalendarRefreshPayload(
  raw: unknown
): MeetingCalendarRefreshPayload | null {
  const value = typeof raw === "string" ? safeParseJson(raw) : raw;
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<MeetingCalendarRefreshPayload>;
  if (record.schema !== "zhinote.meeting.calendar-refresh.v1") return null;
  if (
    record.source !== "meeting-local-draft" &&
    record.source !== "meeting-agent-import"
  ) {
    return null;
  }
  if (typeof record.dateKey !== "string" || !DATE_KEY_PATTERN.test(record.dateKey)) {
    return null;
  }
  if (!Array.isArray(record.affectedCalendars)) return null;
  if (!Array.isArray(record.changedPageIds)) return null;
  if (
    record.metadataRefreshReason !== "meeting-local-draft" &&
    record.metadataRefreshReason !== "meeting-import-change-log"
  ) {
    return null;
  }
  if (
    record.metadataRefreshMode !== "local-page-update" &&
    record.metadataRefreshMode !== "incremental-change-log" &&
    record.metadataRefreshMode !== "full-cache-rebuild"
  ) {
    return null;
  }
  if (typeof record.fullCacheRebuildRequired !== "boolean") return null;
  if (typeof record.generatedAt !== "string" || Number.isNaN(Date.parse(record.generatedAt))) {
    return null;
  }
  if (typeof record.expiresAt !== "string" || Number.isNaN(Date.parse(record.expiresAt))) {
    return null;
  }
  if (
    record.metadataOnly !== true ||
    record.readsPageBodyText !== false ||
    record.readsMeetingContent !== false ||
    record.readsMeetingCredentials !== false
  ) {
    return null;
  }

  return {
    schema: "zhinote.meeting.calendar-refresh.v1",
    source: record.source,
    dateKey: record.dateKey,
    affectedCalendars: normalizeAffectedCalendars(record.affectedCalendars),
    changedPageIds: normalizeChangedPageIds(record.changedPageIds),
    metadataRefreshReason: record.metadataRefreshReason,
    metadataRefreshMode: record.metadataRefreshMode,
    fullCacheRebuildRequired: record.fullCacheRebuildRequired,
    generatedAt: record.generatedAt,
    expiresAt: record.expiresAt,
    metadataOnly: true,
    readsPageBodyText: false,
    readsMeetingContent: false,
    readsMeetingCredentials: false,
  };
}

export function isFreshMeetingCalendarRefreshPayload(
  payload: MeetingCalendarRefreshPayload,
  now = Date.now()
) {
  return Date.parse(payload.expiresAt) > now;
}

function normalizeAffectedCalendars(
  value: MeetingCalendarRefreshSurface[]
): MeetingCalendarRefreshSurface[] {
  const next: MeetingCalendarRefreshSurface[] = [];
  for (const item of value) {
    if ((item === "daily" || item === "meeting") && !next.includes(item)) {
      next.push(item);
    }
  }
  return next;
}

function normalizeChangedPageIds(value: string[]) {
  const next: string[] = [];
  for (const item of value) {
    const id = typeof item === "string" ? item.trim() : "";
    if (!id || next.includes(id)) continue;
    next.push(id);
    if (next.length >= MAX_CHANGED_PAGE_IDS) break;
  }
  return next;
}

function safeParseJson(raw: string) {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}
