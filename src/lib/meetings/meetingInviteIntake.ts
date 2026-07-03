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
  const sourceHost = extractSourceHost(inputText) || extractSourceHost(combinedText);
  const joinUrlHost = safeUrlHost(url) || sourceHost || fetched?.host || "";
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
  const hostSignal = safeUrlHost(host) || host;
  const haystack = `${text}\n${hostSignal}`.toLowerCase();
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

function extractSourceHost(text: string) {
  const patterns = [
    /(?:页面网址|来源网址|当前网址|网页地址|URL)\s*[:：]\s*(https?:\/\/[^\s<>"'，。；、)）]+)/i,
    /(https?:\/\/[^\s<>"'，。；、)）]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const host = safeUrlHost(match?.[1] ?? "");
    if (host) return host;
  }

  return "";
}

function extractTopic(text: string, fetchedTitle: string | undefined, platform: string) {
  const patterns = [
    /[【\[]?\s*(?:会议邀请|邀请函|会议通知)\s*[】\]]?\s*[:：]?\s*([^\n]+)/i,
    /(?:页面标题|候选标题|主标题|大标题)\s*[:：]\s*([^\n]+)/i,
    /(?:路演主题|活动主题|活动名称|会议标题|会议议题|会议主题|会议名称|主题|标题|名称)\s*[:：]\s*([^\n]+)/i,
    /(?:会议主题|会议名称|主题|Topic)\s*[:：]\s*([^\n]+)/i,
    /(?:Meeting topic|Meeting title)\s*[:：]\s*([^\n]+)/i,
    /(?:Title)\s*[:：]\s*([^\n]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const candidate = cleanTopicCandidate(match?.[1] ?? "");
    if (candidate) return candidate;
  }

  const headingCandidate = extractStandaloneHeadingTopic(text);
  if (headingCandidate) return headingCandidate;

  const introCandidate = extractIntroTopic(text);
  if (introCandidate) return introCandidate;

  const fetchedCandidate = cleanPageTitle(fetchedTitle ?? "");
  if (fetchedCandidate) return fetchedCandidate;

  const datedLineCandidate = extractDatedLineTopic(text);
  if (datedLineCandidate) return datedLineCandidate;

  return `${platform}会议`;
}

function extractStandaloneHeadingTopic(text: string) {
  const lines = text.split("\n").map(cleanLine).filter(Boolean);
  for (const line of lines) {
    const candidate = cleanTopicCandidate(line);
    if (isLikelyTopicCandidate(candidate)) return candidate;
  }
  return "";
}

function extractIntroTopic(text: string) {
  const lines = text.split("\n").map(cleanLine).filter(Boolean);
  for (const line of lines) {
    const match = line.match(
      /(?:为您带来|为您分享|带来|主题为|主题是)\s*[:：]?\s*([^。！？!；;\n]+)/
    );
    const candidate = cleanTopicCandidate(match?.[1] ?? "");
    if (isLikelyTopicCandidate(candidate)) return candidate;
  }
  return "";
}

function extractDatedLineTopic(text: string) {
  const lines = text.split("\n").map(cleanLine).filter(Boolean);
  for (const line of lines) {
    if (!hasDateTime(line)) continue;
    const candidate = cleanTopicCandidate(line.replace(DATE_TIME_IN_LINE_PATTERN, ""));
    if (isLikelyTopicCandidate(candidate)) return candidate;
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
    .replace(/^[【\[]?\s*(?:会议邀请|邀请函|会议通知)\s*[】\]]?\s*[:：]?\s*/i, "")
    .replace(/^(?:页面标题|候选标题|主标题|大标题|路演主题|活动主题|会议主题|主题|标题|名称)\s*[:：]\s*/i, "")
    .replace(/^(?:专场|新财富)\s+/, "")
    .replace(/(?:。?敬请关注[！!]?)$/g, "")
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .replace(/[，。；;,|｜:：\-–—\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyTopicCandidate(value: string) {
  const candidate = cleanLine(value);
  if (candidate.length < 8 || candidate.length > 140) return false;
  if (/^(专场|会议介绍|会议详情|详情|简介|议程|嘉宾介绍|相关会议|热门推荐|新财富)$/.test(candidate)) {
    return false;
  }
  if (/^(路演时间|会议时间|活动时间|直播时间|开始时间|日期时间|时间)$/.test(candidate)) {
    return false;
  }
  if (/^(路演时间|会议时间|活动时间|直播时间|开始时间|日期时间|时间)\s*[:：]/.test(candidate)) {
    return false;
  }
  if (/(为您带来|为您分享|敬请关注)/.test(candidate)) return false;
  if (/(次浏览|浏览|报名|已结束|进行中|加载中|暂无数据)/.test(candidate)) return false;
  if (/^\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}/.test(candidate)) return false;
  if (/^(电子|通信|传媒|计算机|医药|消费|金融|汽车|机械|化工|有色|煤炭|地产)(\s+\+?\d+)?$/.test(candidate)) {
    return false;
  }
  if (hasDateTime(candidate) && !/[｜|:：\-–—]/.test(candidate)) return false;
  return (
    /[｜|:：\-–—]/.test(candidate) ||
    /(证券|基金|资本|投研|策略|科技|行业|公司|交流|调研|路演|论坛|讨论|电话会|业绩会|如何|怎么看|看待|未来|机会|风险|当前|展望|复盘)/.test(candidate)
  );
}

function extractOrganizer(text: string) {
  const patterns = [
    /([^\n]{1,80}?)\s*邀请您参加/,
    /[，,]\s*([^\n，,。；;]{2,40}?)(?:为您带来|为您分享|带来)/,
    /^(?:(?:页面标题|候选标题|主标题|大标题)\s*[:：]\s*)?([^\n｜|]{2,40}?)\s*[｜|]\s*[^\n]{6,}/m,
    /^([^\n]{1,80}?)\s+is inviting you to\b/im,
    /(?:组织者|主持人|主持|主讲人|主讲嘉宾|演讲人|嘉宾|发起人|主办方|组织机构|机构|Host|Organizer)\s*[:：]\s*([^\n]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const candidate = cleanOrganizerCandidate(match?.[1] ?? "");
    if (candidate) return candidate;
  }

  return "";
}

function cleanOrganizerCandidate(value: string) {
  return cleanLine(value)
    .replace(/^(?:页面标题|候选标题|主标题|大标题)\s*[:：]\s*/i, "")
    .trim();
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
  // Find the date and the time independently. Invites often separate them
  // with periods, weekday tags or AM/PM markers ("06.14日（本周日）下午16:00点"),
  // so a single contiguous pattern misses them — search each on its own.
  const date = findDate(text);
  const time = findTime(text);

  if (date && time) {
    return buildTimeResult({
      year: date.year ?? inferYearForMonthDay(date.month, date.day),
      month: date.month,
      day: date.day,
      hour: time.hour,
      minute: time.minute,
      endHour: time.endHour,
      endMinute: time.endMinute,
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

  // Date but no readable time: still place it on the right calendar day so
  // the owner only has to fill in the start time.
  if (date) {
    const year = date.year ?? inferYearForMonthDay(date.month, date.day);
    return {
      date: `${year}-${pad(date.month)}-${pad(date.day)}`,
      time: "",
      endTime: "",
      durationMinutes: null,
    };
  }

  return { date: "", time: "", endTime: "", durationMinutes: null };
}

function validMonthDay(month: number, day: number) {
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

const WEEKDAY_MAP: Record<string, number> = {
  "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "日": 0, "天": 0,
};

const ENGLISH_WEEKDAY_MAP: Record<string, number> = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  wednesday: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
};

function findDate(
  text: string
): { year: number | null; month: number; day: number } | null {
  // Explicit year: 2026年6月14日, 2026/06/14, 2026-6-14, 2026.6.14
  const withYear = text.match(
    /(20\d{2})\s*[\/.\-年]\s*(\d{1,2})\s*[\/.\-月]\s*(\d{1,2})\s*[日号]?/
  );
  if (withYear && validMonthDay(Number(withYear[2]), Number(withYear[3]))) {
    return {
      year: Number(withYear[1]),
      month: Number(withYear[2]),
      day: Number(withYear[3]),
    };
  }

  // Explicit month/day should outrank relative weekday labels that often sit
  // beside it, e.g. "06.14日（本周日）下午16:00点".
  const chineseMonthDay = text.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]?/);
  if (
    chineseMonthDay &&
    validMonthDay(Number(chineseMonthDay[1]), Number(chineseMonthDay[2]))
  ) {
    return {
      year: null,
      month: Number(chineseMonthDay[1]),
      day: Number(chineseMonthDay[2]),
    };
  }

  // Numeric with 日/号 suffix: 06.14日, 06-14号
  const numericWithSuffix = text.match(
    /(?:^|[^\d])(\d{1,2})\s*[\/.\-]\s*(\d{1,2})\s*[日号]/
  );
  if (
    numericWithSuffix &&
    validMonthDay(Number(numericWithSuffix[1]), Number(numericWithSuffix[2]))
  ) {
    return {
      year: null,
      month: Number(numericWithSuffix[1]),
      day: Number(numericWithSuffix[2]),
    };
  }

  // Bare numeric date: 6/14, 6-14, 6.14 — guarded against longer number runs
  const numericBare = text.match(
    /(?:^|[^\d.\-/])(\d{1,2})\s*[\/\-\.]\s*(\d{1,2})(?![\/\-\.]\d)/
  );
  if (
    numericBare &&
    validMonthDay(Number(numericBare[1]), Number(numericBare[2]))
  ) {
    return {
      year: null,
      month: Number(numericBare[1]),
      day: Number(numericBare[2]),
    };
  }

  const englishMonthDay = text.match(
    /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(20\d{2})?/i
  );
  if (englishMonthDay) {
    const month = MONTHS[englishMonthDay[1].toLowerCase()];
    const day = Number(englishMonthDay[2]);
    if (month && validMonthDay(month, day)) {
      return {
        year: englishMonthDay[3] ? Number(englishMonthDay[3]) : null,
        month,
        day,
      };
    }
  }

  // Relative dates: 今天/明天/后天/大后天
  const relativeDay = text.match(/(?:大后天|后天|明天|今天)/);
  if (relativeDay) {
    const now = new Date();
    const offsets: Record<string, number> = {
      "今天": 0, "明天": 1, "后天": 2, "大后天": 3,
    };
    const offset = offsets[relativeDay[0]] ?? 0;
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    return {
      year: target.getFullYear(),
      month: target.getMonth() + 1,
      day: target.getDate(),
    };
  }

  // English relative dates: today / tomorrow / day after tomorrow.
  const englishRelativeDay = text.match(/\b(day\s+after\s+tomorrow|tomorrow|today)\b/i);
  if (englishRelativeDay) {
    const now = new Date();
    const normalized = englishRelativeDay[1].toLowerCase().replace(/\s+/g, " ");
    const offsets: Record<string, number> = {
      today: 0,
      tomorrow: 1,
      "day after tomorrow": 2,
    };
    const offset = offsets[normalized] ?? 0;
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    return {
      year: target.getFullYear(),
      month: target.getMonth() + 1,
      day: target.getDate(),
    };
  }

  // Relative weekday: 本周一/下星期三/这礼拜五/周六/下个周日
  const relWeekday = text.match(
    /(?:(本|这|下)\s*个?\s*)?(?:周|星期|礼拜)\s*([一二三四五六日天])/
  );
  if (relWeekday) {
    const prefix = relWeekday[1] ?? "";
    const targetDow = WEEKDAY_MAP[relWeekday[2]];
    const now = new Date();
    const currentDow = now.getDay();
    const diff =
      prefix === "下"
        ? daysUntilNextChineseWeekday(targetDow, currentDow)
        : daysUntilUpcomingWeekday(targetDow, currentDow);
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
    return {
      year: target.getFullYear(),
      month: target.getMonth() + 1,
      day: target.getDate(),
    };
  }

  const englishRelWeekday = text.match(
    /\b(?:(this|next)\s+)?(Sun(?:day)?|Mon(?:day)?|Tue(?:s|sday)?|Wed(?:nesday)?|Thu(?:r|rs|rsday|rday)?|Fri(?:day)?|Sat(?:urday)?)\b/i
  );
  if (englishRelWeekday) {
    const prefix = englishRelWeekday[1]?.toLowerCase() ?? "";
    const targetDow = ENGLISH_WEEKDAY_MAP[englishRelWeekday[2].toLowerCase()];
    const now = new Date();
    const currentDow = now.getDay();
    const diff =
      prefix === "next"
        ? daysUntilNextChineseWeekday(targetDow, currentDow)
        : daysUntilUpcomingWeekday(targetDow, currentDow);
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
    return {
      year: target.getFullYear(),
      month: target.getMonth() + 1,
      day: target.getDate(),
    };
  }

  return null;
}

function daysUntilUpcomingWeekday(targetDow: number, currentDow: number) {
  let diff = targetDow - currentDow;
  if (diff < 0) diff += 7;
  return diff;
}

function daysUntilNextChineseWeekday(targetDow: number, currentDow: number) {
  const currentMondayIndex = currentDow === 0 ? 6 : currentDow - 1;
  const targetMondayIndex = targetDow === 0 ? 6 : targetDow - 1;
  return 7 - currentMondayIndex + targetMondayIndex;
}

// Convert a 12-hour clock reading to 24-hour using a Chinese period marker.
function applyChinesePeriod(hour: number, period: string) {
  const normalized = period.trim().toLowerCase().replace(/\./g, "");
  if (
    normalized === "下午" ||
    normalized === "晚上" ||
    normalized === "中午" ||
    normalized === "pm"
  ) {
    return hour < 12 ? hour + 12 : hour;
  }
  if (
    normalized === "上午" ||
    normalized === "凌晨" ||
    normalized === "am"
  ) {
    return hour === 12 ? 0 : hour;
  }
  return hour;
}

interface ClockHit {
  rawHour: number;
  minute: number;
  period: string;
  start: number;
  end: number;
}

// Parse the first clock in the text: optional Chinese period marker, then
// HH:MM or H点(MM分)? or H点半 or H时MM分, with Chinese/AM/PM markers
// either before or after the clock. English hour-only readings like "4 PM"
// are accepted only when an AM/PM marker is present.
function parseClockAt(text: string): ClockHit | null {
  const re =
    /(?:(上午|下午|中午|晚上|凌晨|a\.?m\.?|p\.?m\.?)\s*)?([01]?\d|2[0-3])\s*(?:(?:[:：]\s*([0-5]\d)\s*点?)|(?:[点时]\s*(?:(半)|([0-5]?\d)\s*分?)?)|(?=(?:上午|下午|中午|晚上|凌晨|a\.?m\.?|p\.?m\.?)\b))(?:\s*(上午|下午|中午|晚上|凌晨|a\.?m\.?|p\.?m\.?))?/i;
  const m = re.exec(text);
  if (!m) return null;
  let minute = 0;
  if (m[3] !== undefined) minute = Number(m[3]);
  else if (m[4] === "半") minute = 30;
  else if (m[5] !== undefined && m[5] !== "") minute = Number(m[5]);
  const period = m[1] || m[6] || "";
  return {
    rawHour: Number(m[2]),
    minute,
    period,
    start: m.index,
    end: m.index + m[0].length,
  };
}

// Find a start time (and optional end time) anywhere in the text, honouring
// Chinese period markers and an optional range connector.
// Prioritises time that appears after a label like 时间：, 开始时间：, Time:
function findTime(
  text: string
): { hour: number; minute: number; endHour: number | null; endMinute: number | null } | null {
  // Try labeled time first — these are the highest-confidence hits.
  const labelPattern =
    /(?:会议时间|活动时间|路演时间|直播时间|开始时间|日期时间|时间|Time|Start)\s*[:：]\s*/gi;
  let labelMatch: RegExpExecArray | null;
  while ((labelMatch = labelPattern.exec(text)) !== null) {
    const afterLabel = text.slice(labelMatch.index + labelMatch[0].length);
    const hit = parseTimeRange(afterLabel);
    if (hit) return hit;
  }

  // Fall back to the first clock anywhere in the text.
  return parseTimeRange(text);
}

function parseTimeRange(
  text: string
): { hour: number; minute: number; endHour: number | null; endMinute: number | null } | null {
  const first = parseClockAt(text);
  if (!first) return null;
  const startHour = applyChinesePeriod(first.rawHour, first.period);

  let endHour: number | null = null;
  let endMinute: number | null = null;
  const rest = text.slice(first.end);
  const connector = rest.match(/^\s*点?\s*(?:-|--|---|~|至|到|to)\s*/i);
  if (connector) {
    const second = parseClockAt(rest.slice(connector[0].length));
    if (second && second.start === 0) {
      const endPeriod = second.period || first.period;
      endHour = applyChinesePeriod(second.rawHour, endPeriod);
      endMinute = second.minute;
    }
  }

  return { hour: startHour, minute: first.minute, endHour, endMinute };
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
