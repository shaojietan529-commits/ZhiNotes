export interface FetchedMeetingLinkText {
  url: string;
  host: string;
  title: string;
  description: string;
  text: string;
}

export interface MeetingInviteIntakeMeeting {
  topic: string;
  organizer: string;
  platform: string;
  date: string;
  time: string;
  endTime: string;
  durationMinutes: number | null;
  hasJoinUrl: boolean;
  joinUrl: string;
  joinUrlHost: string;
  meetingId: string;
  passcode: string;
  source: "pasted_text" | "linked_page" | "mixed";
  confidence: "high" | "medium" | "low";
  warnings: string[];
}

export interface MeetingInviteIntakeResult {
  meeting: MeetingInviteIntakeMeeting;
}

const URL_PATTERN = /https?:\/\/[^\s<>"'，。；、)）]+/i;
const URL_GLOBAL_PATTERN = /https?:\/\/[^\s<>"'，。；、)）]+/gi;

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

export function extractFirstMeetingUrl(input: string): string {
  return input.match(URL_PATTERN)?.[0] ?? "";
}

export function parseMeetingInviteInput(
  input: string,
  fetched?: FetchedMeetingLinkText | null
): MeetingInviteIntakeResult {
  const inputText = normalizeText(input);
  const fetchedText = fetched
    ? normalizeText(
        [fetched.title, fetched.description, fetched.text]
          .filter(Boolean)
          .join("\n")
      )
    : "";
  const combinedText = normalizeText([inputText, fetchedText].filter(Boolean).join("\n"));
  const url = extractFirstMeetingUrl(inputText) || extractFirstMeetingUrl(combinedText);
  const joinUrlHost = safeUrlHost(url) || fetched?.host || "";
  const source = getSource(inputText, Boolean(fetched));
  const platform = detectPlatform(combinedText, joinUrlHost);
  const timeRange = extractTimeRange(combinedText);
  const topic = extractTopic(combinedText, fetched?.title, platform);
  const organizer = extractOrganizer(combinedText);
  const meetingId = extractMeetingId(combinedText);
  const passcode = extractPasscode(combinedText);
  const warnings = buildWarnings({
    hasUrl: Boolean(url || fetched),
    date: timeRange.date,
    time: timeRange.time,
    topic,
  });

  return {
    meeting: {
      topic,
      organizer,
      platform,
      date: timeRange.date,
      time: timeRange.time,
      endTime: timeRange.endTime,
      durationMinutes: timeRange.durationMinutes,
      hasJoinUrl: Boolean(url || fetched),
      joinUrl: url || fetched?.url || "",
      joinUrlHost,
      meetingId,
      passcode,
      source,
      confidence: getConfidence({
        date: timeRange.date,
        time: timeRange.time,
        topic,
        organizer,
      }),
      warnings,
    },
  };
}

function normalizeText(value: string) {
  return value
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getSource(
  inputText: string,
  fetched: boolean
): MeetingInviteIntakeMeeting["source"] {
  if (!fetched) return "pasted_text";
  const withoutUrls = inputText.replace(URL_GLOBAL_PATTERN, "").trim();
  return withoutUrls ? "mixed" : "linked_page";
}

function detectPlatform(text: string, host: string) {
  const haystack = `${text}\n${host}`.toLowerCase();
  if (haystack.includes("meeting.tencent.com") || haystack.includes("腾讯会议")) {
    return "腾讯会议";
  }
  if (haystack.includes("zoom.us") || /\bzoom\b/i.test(text)) {
    return "Zoom";
  }
  if (haystack.includes("webex.com") || /\bwebex\b/i.test(text)) {
    return "Webex";
  }
  if (haystack.includes("comein.cn") || haystack.includes("进门财经")) {
    return "进门财经";
  }
  if (
    haystack.includes("meritco-group.com") ||
    haystack.includes("久谦论坛") ||
    haystack.includes("久谦")
  ) {
    return "久谦论坛";
  }
  if (haystack.includes("teams.microsoft.com") || /\bteams\b/i.test(text)) {
    return "Teams";
  }
  if (haystack.includes("meet.google.com") || haystack.includes("google meet")) {
    return "Google Meet";
  }
  return "其他";
}

function extractTopic(text: string, fetchedTitle: string | undefined, platform: string) {
  const patterns = [
    /(?:会议主题|会议名称|主题|Topic)\s*[:：]\s*([^\n]+)/i,
    /(?:Meeting topic|Meeting title)\s*[:：]\s*([^\n]+)/i,
    /(?:Title)\s*[:：]\s*([^\n]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const candidate = cleanLine(match?.[1] ?? "");
    if (candidate) return candidate;
  }

  const datedLineCandidate = extractDatedLineTopic(text);
  if (datedLineCandidate) return datedLineCandidate;

  const fetchedCandidate = cleanPageTitle(fetchedTitle ?? "");
  if (fetchedCandidate) return fetchedCandidate;

  return `${platform}会议`;
}

function extractDatedLineTopic(text: string) {
  const lines = text.split("\n").map(cleanLine).filter(Boolean);
  for (const line of lines) {
    if (!hasDateTime(line)) continue;
    const candidate = cleanTopicCandidate(line.replace(DATE_TIME_IN_LINE_PATTERN, ""));
    if (candidate) return candidate;
  }
  return "";
}

const DATE_TIME_IN_LINE_PATTERN =
  /[（(]?\s*(?:(?:20\d{2})\s*[\/.\-年]\s*)?\d{1,2}\s*[\/.\-月]\s*\d{1,2}\s*日?\s*(?:\([^)]+\)|（[^）]+）)?\s*(?:周[一二三四五六日天]\s*)?(?:[01]?\d|2[0-3])[:：][0-5]\d(?:\s*(?:-|–|—|至|到|~|to)\s*(?:[01]?\d|2[0-3])[:：][0-5]\d)?\s*[）)]?/gi;

function hasDateTime(line: string) {
  return (
    /(?:20\d{2}\s*[\/.\-年]\s*)?\d{1,2}\s*[\/.\-月]\s*\d{1,2}\s*日?/.test(line) &&
    /(?:[01]?\d|2[0-3])[:：][0-5]\d/.test(line)
  );
}

function cleanTopicCandidate(value: string) {
  return value
    .replace(URL_GLOBAL_PATTERN, "")
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .replace(/[，。；;,|｜:：\-–—\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractOrganizer(text: string) {
  const patterns = [
    /([^\n]{1,80}?)\s*邀请您参加/,
    /^([^\n]{1,80}?)\s+is inviting you to\b/im,
    /(?:组织者|主持人|发起人|Host|Organizer)\s*[:：]\s*([^\n]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const candidate = cleanLine(match?.[1] ?? "");
    if (candidate) return candidate;
  }

  return "";
}

function extractMeetingId(text: string) {
  const patterns = [
    /#\s*腾讯会议\s*[:：]\s*([0-9][0-9\s-]{5,})/i,
    /(?:会议号|会议\s*ID|Meeting\s*ID|Webinar\s*ID)\s*[:：]?\s*([0-9][0-9\s-]{5,})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const candidate = cleanSecret(match?.[1] ?? "");
    if (candidate) return candidate;
  }

  return "";
}

function extractPasscode(text: string) {
  const patterns = [
    /(?:会议密码|入会密码|密码|Passcode|Password)\s*[:：]?\s*([A-Za-z0-9._-]{3,})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const candidate = cleanSecret(match?.[1] ?? "");
    if (candidate) return candidate;
  }

  return "";
}

function extractTimeRange(text: string) {
  const chinese = text.match(
    /(20\d{2})\s*[\/.\-年]\s*(\d{1,2})\s*[\/.\-月]\s*(\d{1,2})\s*日?\s*(?:\([^)]+\)|（[^）]+）)?\s*(?:周[一二三四五六日天]\s*)?([01]?\d|2[0-3]):([0-5]\d)(?:\s*(?:-|–|—|至|到|~)\s*([01]?\d|2[0-3]):([0-5]\d))?/
  );
  if (chinese) {
    return buildTimeResult({
      year: Number(chinese[1]),
      month: Number(chinese[2]),
      day: Number(chinese[3]),
      hour: Number(chinese[4]),
      minute: Number(chinese[5]),
      endHour: chinese[6] ? Number(chinese[6]) : null,
      endMinute: chinese[7] ? Number(chinese[7]) : null,
    });
  }

  const yearless = text.match(
    /(?:^|[\s(（])(\d{1,2})\s*[\/.\-月]\s*(\d{1,2})\s*日?\s*(?:\([^)]+\)|（[^）]+）)?\s*(?:周[一二三四五六日天]\s*)?([01]?\d|2[0-3])[:：]([0-5]\d)(?:\s*(?:-|–|—|至|到|~)\s*([01]?\d|2[0-3])[:：]([0-5]\d))?/m
  );
  if (yearless) {
    const month = Number(yearless[1]);
    const day = Number(yearless[2]);
    return buildTimeResult({
      year: inferYearForMonthDay(month, day),
      month,
      day,
      hour: Number(yearless[3]),
      minute: Number(yearless[4]),
      endHour: yearless[5] ? Number(yearless[5]) : null,
      endMinute: yearless[6] ? Number(yearless[6]) : null,
    });
  }

  const english = text.match(
    /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(20\d{2})\s+(\d{1,2}):([0-5]\d)\s*(AM|PM)?(?:\s*(?:-|–|—|to)\s*(\d{1,2}):([0-5]\d)\s*(AM|PM)?)?/i
  );
  if (english) {
    const month = MONTHS[english[1].toLowerCase()];
    const start = to24Hour(Number(english[4]), english[6]);
    const endPeriod = english[9] || english[6];
    const endHour = english[7] ? to24Hour(Number(english[7]), endPeriod) : null;
    return buildTimeResult({
      year: Number(english[3]),
      month,
      day: Number(english[2]),
      hour: start,
      minute: Number(english[5]),
      endHour,
      endMinute: english[8] ? Number(english[8]) : null,
    });
  }

  const dateOnly = text.match(
    /(20\d{2})\s*[\/.\-年]\s*(\d{1,2})\s*[\/.\-月]\s*(\d{1,2})\s*日?/
  );
  const timeOnly = text.match(
    /(?:会议时间|时间|Time|Start time|Start)\s*[:：]?\s*([01]?\d|2[0-3]):([0-5]\d)(?:\s*(?:-|–|—|至|到|~|to)\s*([01]?\d|2[0-3]):([0-5]\d))?/i
  );
  if (dateOnly && timeOnly) {
    return buildTimeResult({
      year: Number(dateOnly[1]),
      month: Number(dateOnly[2]),
      day: Number(dateOnly[3]),
      hour: Number(timeOnly[1]),
      minute: Number(timeOnly[2]),
      endHour: timeOnly[3] ? Number(timeOnly[3]) : null,
      endMinute: timeOnly[4] ? Number(timeOnly[4]) : null,
    });
  }

  return { date: "", time: "", endTime: "", durationMinutes: null };
}

function inferYearForMonthDay(month: number, day: number) {
  const now = new Date();
  let year = now.getFullYear();
  const candidate = new Date(year, month - 1, day);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const deltaDays = Math.floor(
    (candidate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
  );
  if (deltaDays < -180) year += 1;
  return year;
}

function buildTimeResult({
  year,
  month,
  day,
  hour,
  minute,
  endHour,
  endMinute,
}: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  endHour: number | null;
  endMinute: number | null;
}) {
  const time = `${pad(hour)}:${pad(minute)}`;
  const endTime =
    endHour !== null && endMinute !== null ? `${pad(endHour)}:${pad(endMinute)}` : "";
  return {
    date: `${year}-${pad(month)}-${pad(day)}`,
    time,
    endTime,
    durationMinutes: endTime ? minutesBetween(time, endTime) : null,
  };
}

function minutesBetween(start: string, end: string) {
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  let delta = endHour * 60 + endMinute - (startHour * 60 + startMinute);
  if (delta < 0) delta += 24 * 60;
  return delta;
}

function to24Hour(hour: number, period: string | undefined) {
  if (!period) return hour;
  const upper = period.toUpperCase();
  if (upper === "PM" && hour < 12) return hour + 12;
  if (upper === "AM" && hour === 12) return 0;
  return hour;
}

function safeUrlHost(url: string) {
  if (!url) return "";
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function cleanLine(value: string) {
  return value
    .replace(URL_GLOBAL_PATTERN, "")
    .replace(/复制该信息.*$/i, "")
    .replace(/点击链接.*$/i, "")
    .replace(/\s+/g, " ")
    .replace(/[，。；;]+$/g, "")
    .trim();
}

function cleanSecret(value: string) {
  return value
    .replace(/[，。；;,]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanPageTitle(value: string) {
  const cleaned = cleanLine(value)
    .replace(/\s*[-|]\s*(腾讯会议|Zoom|Webex|进门财经|Microsoft Teams|Google Meet).*$/i, "")
    .trim();
  if (!cleaned || /^https?:\/\//i.test(cleaned)) return "";
  return cleaned;
}

function buildWarnings({
  hasUrl,
  date,
  time,
  topic,
}: {
  hasUrl: boolean;
  date: string;
  time: string;
  topic: string;
}) {
  const warnings: string[] = [];
  if (hasUrl) {
    warnings.push("已读取入会链接，导入后会保存到会议页面用于自动接入。");
  }
  if (!date || !time) {
    warnings.push("没有读到明确会议日期和开始时间，需要补充后才能加入日历。");
  }
  if (!topic || topic === "其他会议") {
    warnings.push("会议主题不明确，已使用平台名称占位。");
  }
  return warnings;
}

function getConfidence({
  date,
  time,
  topic,
  organizer,
}: {
  date: string;
  time: string;
  topic: string;
  organizer: string;
}) {
  if (date && time && topic && organizer) return "high";
  if (date && time && topic) return "medium";
  return "low";
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
