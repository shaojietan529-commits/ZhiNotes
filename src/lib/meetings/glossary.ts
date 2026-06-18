import { kvGet } from "@/lib/account/server";

const PAGE_SYNC_INDEX_KEY_PREFIX = "zhinotes:pagesync:index:";
const PAGE_SYNC_PAGE_KEY_PREFIX = "zhinotes:pagesync:page:";
const MAX_INDEX_ITEMS = 180;
const MAX_PAGE_RECORDS = 80;
const MAX_PAGE_TEXT_CHARS = 24_000;
const MAX_TERMS = 140;

const GENERIC_TERMS = new Set([
  "and",
  "api",
  "app",
  "for",
  "from",
  "home",
  "http",
  "https",
  "index",
  "key",
  "meeting",
  "page",
  "password",
  "passcode",
  "roadshow",
  "scheduled",
  "topic",
  "www",
  "会议",
  "会议号",
  "会议链接",
  "会议密码",
  "其他会议",
  "复制",
  "链接",
  "点击",
]);

const DEFAULT_DOMAIN_TERMS = [
  "DCF",
  "IRR",
  "ROIC",
  "ROE",
  "EV/EBITDA",
  "P/E",
  "EPS",
  "EBITDA",
  "free cash flow",
  "gross margin",
  "operating margin",
  "guidance",
  "take rate",
  "ARR",
  "net revenue retention",
  "AI capex",
  "GPU",
  "ASIC",
  "AI accelerator",
  "AI server",
  "liquid cooling",
  "HBM",
  "HBM3E",
  "CoWoS",
  "advanced packaging",
  "hybrid bonding",
  "semiconductor",
  "foundry",
  "fabless",
  "IDM",
  "wafer",
  "EUV",
  "DUV",
  "etch",
  "deposition",
  "photoresist",
  "EDA",
  "OSAT",
  "ABF substrate",
  "capex intensity",
  "utilization rate",
  "channel inventory",
  "NVIDIA",
  "TSMC",
  "ASML",
  "SK Hynix",
  "Samsung Electronics",
  "Tokyo Electron",
  "Applied Materials",
  "Lam Research",
  "KLA",
  "台积电",
  "台積電",
  "北方华创",
  "中微公司",
  "拓荆科技",
  "半导体设备",
  "设备涨价",
  "晶圆厂",
  "设备商",
  "供应链",
  "久谦论坛",
  "进门财经",
  "腾讯会议",
];

const TERM_PATTERN =
  /\b\d{3,6}\.(?:HK|JP|KS|KQ|T|TW|US)\b|[A-Za-z]{1,12}[\u4e00-\u9fff][\u4e00-\u9fffA-Za-z0-9·-]{1,18}|\$?[A-Za-z][A-Za-z0-9&.+/#-]{1,40}|[\u4e00-\u9fff][\u4e00-\u9fffA-Za-z0-9·-]{1,18}|[\u3040-\u30ff][\u3040-\u30ffA-Za-z0-9・ー-]{1,30}|[\uac00-\ud7af][\uac00-\ud7afA-Za-z0-9·-]{1,30}/g;
const URL_PATTERN = /https?:\/\/\S+|www\.\S+/gi;
const EMAIL_PATTERN = /\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g;
const EMAIL_TERM_PATTERN = /\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/;
const LONG_NUMBER_PATTERN = /\+?\d[\d\s().-]{7,}\d/g;
const LONG_NUMBER_TERM_PATTERN = /^\+?\d[\d\s().-]{7,}\d$/;
const LISTED_TICKER_PATTERN = /^\d{3,6}\.(?:HK|JP|KS|KQ|T|TW|US)$/i;
const SECRET_LINE_PATTERN =
  /^.*(?:passcode|password|meeting\s*(?:id|passcode|password)|会议(?:号|密码)|入会密码|#\s*腾讯会议).*$/i;

export interface ZhiHuiGlossaryTerm {
  term: string;
  source: "meeting_context" | "zhinote_pages" | "default_domain";
  score: number;
}

interface KvEnv {
  url: string;
  token: string;
}

interface PageIndexEntry {
  u: string;
  d: 0 | 1;
}

interface PageRecord {
  id: string;
  title: string;
  content_text: string | null;
  updated_at: string;
  deleted_at: string | null;
}

interface TermCandidate {
  term: string;
  source: ZhiHuiGlossaryTerm["source"];
  score: number;
  order: number;
}

export async function buildZhiHuiGlossary(params: {
  kv: KvEnv;
  requestUrl: URL;
}) {
  const topic = cleanText(params.requestUrl.searchParams.get("topic") ?? "", 500);
  const organizer = cleanText(
    params.requestUrl.searchParams.get("organizer") ?? "",
    200
  );
  const platform = cleanText(
    params.requestUrl.searchParams.get("platform") ?? "",
    80
  );
  const workspaceId = cleanText(
    params.requestUrl.searchParams.get("workspace_id") ?? "",
    120
  );
  const accountEmail = resolveGlossaryAccountEmail();
  const candidates: TermCandidate[] = [];
  let order = 0;

  const pushTerms = (
    terms: string[],
    source: ZhiHuiGlossaryTerm["source"],
    score: number
  ) => {
    for (const term of terms) {
      candidates.push({ term, source, score, order: order++ });
    }
  };

  const meetingContext = [topic, organizer, platform].filter(Boolean).join("\n");
  const meetingContextTerms = extractTerms(meetingContext);
  pushTerms(meetingContextTerms, "meeting_context", 100);

  let pagesRead = 0;
  let pageTerms = 0;
  const sourceWarnings: string[] = [];
  if (accountEmail) {
    const pages = await readRelevantPages(params.kv, accountEmail, [
      topic,
      organizer,
      platform,
      ...meetingContextTerms,
    ]);
    pagesRead = pages.length;
    for (const page of pages) {
      const titleTerms = extractTerms(page.title);
      const bodyTerms = extractTerms(page.content_text ?? "");
      pageTerms += titleTerms.length + bodyTerms.length;
      pushTerms(titleTerms, "zhinote_pages", 70 + pageMatchScore(page, meetingContextTerms));
      pushTerms(bodyTerms, "zhinote_pages", 35 + pageMatchScore(page, meetingContextTerms));
    }
  } else {
    sourceWarnings.push(
      "ZHIHUI_GLOSSARY_EMAIL is not configured; used meeting context and default domain terms only."
    );
  }

  pushTerms(DEFAULT_DOMAIN_TERMS, "default_domain", 10);
  const terms = rankTerms(candidates, MAX_TERMS);

  return {
    schema: "zhinote.zhihui.glossary.v1",
    terms,
    source_counts: {
      meeting_context: meetingContextTerms.length,
      zhinote_pages: pageTerms,
      default_domain: DEFAULT_DOMAIN_TERMS.length,
    },
    diagnostics: {
      workspace_id_present: Boolean(workspaceId),
      account_source: accountEmail ? "configured" : "missing",
      pages_read: pagesRead,
      warnings: sourceWarnings,
    },
    privacy: {
      raw_page_text_returned: false,
      raw_meeting_credentials_returned: false,
      terms_only: true,
    },
  };
}

function resolveGlossaryAccountEmail() {
  const explicit = normalizeEmail(process.env.ZHIHUI_GLOSSARY_EMAIL ?? "");
  if (explicit) return explicit;
  const allowed = (process.env.ZHINOTES_ACCOUNT_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((email) => normalizeEmail(email))
    .find((email): email is string => Boolean(email));
  return allowed ?? "";
}

async function readRelevantPages(
  kv: KvEnv,
  accountEmail: string,
  queryTerms: string[]
) {
  const indexRaw = await kvGet(kv, `${PAGE_SYNC_INDEX_KEY_PREFIX}${accountEmail}`);
  if (!indexRaw) return [];

  let index: Record<string, PageIndexEntry>;
  try {
    index = JSON.parse(indexRaw) as Record<string, PageIndexEntry>;
  } catch {
    return [];
  }

  const entries = Object.entries(index)
    .filter(([, entry]) => entry && entry.d !== 1)
    .sort((a, b) => String(b[1]?.u ?? "").localeCompare(String(a[1]?.u ?? "")))
    .slice(0, MAX_INDEX_ITEMS);

  const pages: PageRecord[] = [];
  for (const [pageId] of entries) {
    if (pages.length >= MAX_PAGE_RECORDS) break;
    const raw = await kvGet(kv, `${PAGE_SYNC_PAGE_KEY_PREFIX}${accountEmail}:${pageId}`);
    const page = parsePageRecord(raw);
    if (page) pages.push(page);
  }

  const needles = queryTerms
    .map((term) => term.toLowerCase())
    .filter((term) => term.length >= 2);
  return pages
    .map((page) => ({ page, score: pageMatchScore(page, needles) }))
    .sort((a, b) => b.score - a.score || b.page.updated_at.localeCompare(a.page.updated_at))
    .slice(0, MAX_PAGE_RECORDS)
    .map((item) => item.page);
}

function parsePageRecord(raw: string | null): PageRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed.id !== "string" || typeof parsed.updated_at !== "string") {
      return null;
    }
    if (typeof parsed.deleted_at === "string" && parsed.deleted_at) return null;
    return {
      id: parsed.id,
      title: typeof parsed.title === "string" ? parsed.title : "",
      content_text:
        typeof parsed.content_text === "string"
          ? parsed.content_text.slice(0, MAX_PAGE_TEXT_CHARS)
          : null,
      updated_at: parsed.updated_at,
      deleted_at: typeof parsed.deleted_at === "string" ? parsed.deleted_at : null,
    };
  } catch {
    return null;
  }
}

function pageMatchScore(page: PageRecord, queryTerms: string[]) {
  if (queryTerms.length === 0) return 0;
  const text = `${page.title}\n${page.content_text ?? ""}`.toLowerCase();
  let score = 0;
  for (const term of queryTerms) {
    const needle = term.toLowerCase();
    if (needle.length < 2) continue;
    if (page.title.toLowerCase().includes(needle)) score += 8;
    else if (text.includes(needle)) score += 3;
  }
  return score;
}

function rankTerms(candidates: TermCandidate[], limit: number): ZhiHuiGlossaryTerm[] {
  const best = new Map<string, TermCandidate>();
  for (const candidate of candidates) {
    const term = normalizeTerm(candidate.term);
    if (!isSafeTerm(term)) continue;
    const key = term.toLowerCase();
    const existing = best.get(key);
    if (
      !existing ||
      candidate.score > existing.score ||
      (candidate.score === existing.score && candidate.order < existing.order)
    ) {
      best.set(key, { ...candidate, term });
    }
  }
  return [...best.values()]
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, limit)
    .map(({ term, source, score }) => ({ term, source, score }));
}

function extractTerms(value: string) {
  const cleaned = stripPrivateArtifacts(value);
  const terms: string[] = [];
  for (const match of cleaned.matchAll(TERM_PATTERN)) {
    const term = normalizeTerm(match[0]);
    if (isSafeTerm(term)) terms.push(term);
  }
  return terms;
}

function stripPrivateArtifacts(value: string) {
  return value
    .replace(URL_PATTERN, " ")
    .replace(EMAIL_PATTERN, " ")
    .replace(LONG_NUMBER_PATTERN, " ")
    .split(/\r?\n/)
    .filter((line) => !SECRET_LINE_PATTERN.test(line))
    .join("\n");
}

function normalizeTerm(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function isSafeTerm(term: string) {
  if (!term || term.length < 2 || term.length > 64) return false;
  if (GENERIC_TERMS.has(term.toLowerCase())) return false;
  if (term.endsWith(".")) return false;
  if (/[\x00-\x1F\x7F]/.test(term)) return false;
  if (/https?:\/\//i.test(term) || /^www\./i.test(term)) return false;
  if (EMAIL_TERM_PATTERN.test(term)) return false;
  if (LONG_NUMBER_TERM_PATTERN.test(term)) return false;
  if (term.includes(".") && !LISTED_TICKER_PATTERN.test(term)) return false;
  if (looksLikeSecretToken(term)) return false;
  return true;
}

function looksLikeSecretToken(term: string) {
  return (
    /^[A-Za-z0-9]{5,32}$/.test(term) &&
    /[a-z]/.test(term) &&
    /[A-Z]/.test(term) &&
    /\d/.test(term)
  );
}

function cleanText(value: string, maxLength: number) {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}
