// ZhiNote meeting capture — popup logic.
//
// Flow: when the owner clicks "抓取本页会议信息", we read ONLY the active tab's
// visible text (granted by activeTab on click), show a review dialog on that
// meeting page, then send the owner-confirmed fields to ZhiNote. The extension
// itself never touches cookies, passwords, or login tokens, and never reads
// pages in the background.

const MAX_CHARS = 15000;
const PLATFORMS = [
  "进门财经",
  "久谦论坛",
  "腾讯会议",
  "Zoom",
  "Webex",
  "Teams",
  "Google Meet",
  "其他",
];

// Runs in the page: returns the URL, title and useful visible text. Kept
// self-contained because it is injected as a function.
async function grabPageText() {
  const MEETING_KEYWORDS = [
    "会议",
    "时间",
    "主持",
    "主讲",
    "嘉宾",
    "主题",
    "路演",
    "活动",
    "开始",
    "直播",
    "调研",
  ];
  const MAIN_SELECTORS = [
    "main",
    "article",
    "[role='main']",
    "[class*='content' i]",
    "[class*='detail' i]",
    "[class*='meeting' i]",
    "[class*='roadshow' i]",
    "[class*='schedule' i]",
    "[class*='info' i]",
    "[id*='content' i]",
    "[id*='detail' i]",
    "[id*='meeting' i]",
    "[id*='roadshow' i]",
  ];
  const TITLE_SELECTORS = [
    "h1",
    "h2",
    "[class*='title' i]",
    "[class*='subject' i]",
    "[class*='topic' i]",
    "[class*='name' i]",
  ];
  const NOISE_LINE_PATTERN =
    /^(home|note|en|sign in|sign out|login|log in|register|download|tips|ok|i know|首页|登录|注册|下载|下载app|我的|返回|分享|收藏|提示|知道了)$/i;
  const GENERIC_HEADING_PATTERN =
    /^(专场|会议介绍|会议详情|详情|简介|议程|嘉宾介绍|相关会议|热门推荐|新财富|加载中|暂无数据)$/i;

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const normalizeText = (value) => {
    const seen = new Set();
    return String(value || "")
      .replace(/\r/g, "\n")
      .replace(/\u00a0/g, " ")
      .split("\n")
      .map((line) => line.replace(/[ \t]+/g, " ").trim())
      .filter((line) => line && !NOISE_LINE_PATTERN.test(line))
      .filter((line) => {
        const key = line.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .join("\n")
      .trim();
  };

  const keywordHits = (text) =>
    MEETING_KEYWORDS.reduce(
      (count, keyword) => count + (text.includes(keyword) ? 1 : 0),
      0
    );

  const isUseful = (text) => {
    const normalized = normalizeText(text);
    return keywordHits(normalized) >= 2 || normalized.length >= 800;
  };

  const isVisible = (node) => {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
    if (node === document.body || node === document.documentElement) return true;
    const style = node.ownerDocument.defaultView.getComputedStyle(node);
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0" &&
      node.getClientRects().length > 0
    );
  };

  const scoreText = (text) => {
    const normalized = normalizeText(text);
    if (!normalized) return 0;
    const lengthScore = Math.min(normalized.length / 40, 120);
    return keywordHits(normalized) * 80 + lengthScore;
  };

  const titleScore = (line) => {
    const text = normalizeText(line);
    if (!text || text.length < 8 || text.length > 140) return 0;
    if (GENERIC_HEADING_PATTERN.test(text)) return 0;
    if (/^\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}/.test(text)) return 0;
    if (/(次浏览|浏览|报名|已结束|进行中)/.test(text)) return 0;
    if (/^(电子|通信|传媒|计算机|医药|消费|金融|汽车|机械|化工|有色|煤炭|地产)(\s+\+?\d+)?$/.test(text)) {
      return 0;
    }
    let score = Math.min(text.length, 80);
    if (/[｜|:：\-–—]/.test(text)) score += 35;
    if (/(证券|基金|资本|投研|策略|科技|行业|公司|交流|调研|路演|论坛)/.test(text)) {
      score += 30;
    }
    if (/(如何|怎么看|看待|未来|机会|风险|当前|展望|复盘)/.test(text)) {
      score += 20;
    }
    return score;
  };

  const readCandidateText = (node) => {
    if (!isVisible(node)) return "";
    return normalizeText(node.innerText || node.textContent || "");
  };

  const collectTitleCandidates = (doc) => {
    const candidates = [];
    const addLines = (value) => {
      for (const line of normalizeText(value).split("\n")) {
        const cleaned = normalizeText(line);
        const score = titleScore(cleaned);
        if (score > 0) candidates.push({ text: cleaned, score });
      }
    };

    for (const selector of TITLE_SELECTORS) {
      try {
        for (const node of doc.querySelectorAll(selector)) {
          if (isVisible(node)) addLines(node.innerText || node.textContent || "");
        }
      } catch {
        // Keep title extraction best-effort and generic.
      }
    }

    if (doc.title) addLines(doc.title);

    const seen = new Set();
    return candidates
      .sort((a, b) => b.score - a.score)
      .filter((candidate) => {
        const key = candidate.text.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 3)
      .map((candidate) => candidate.text);
  };

  const collectDocumentText = (doc, depth) => {
    const candidates = [];
    const priorityParts = [
      {
        label: "page-url",
        score: 1200,
        text: `页面网址：${doc.location?.href || ""}`,
      },
      ...collectTitleCandidates(doc).map((title) => ({
        label: "page-title",
        score: 1000 + titleScore(title),
        text: `页面标题：${title}`,
      })),
    ].filter((part) => part.text.trim());
    const addCandidate = (label, text) => {
      const normalized = normalizeText(text);
      if (!normalized) return;
      candidates.push({
        label,
        score: scoreText(normalized),
        text: normalized.slice(0, 12000),
      });
    };

    addCandidate("url", doc.location?.href || "");
    addCandidate("title", doc.title || "");

    for (const selector of MAIN_SELECTORS) {
      try {
        for (const node of doc.querySelectorAll(selector)) {
          addCandidate(selector, readCandidateText(node));
        }
      } catch {
        // Some pages may reject a selector variant; keep trying the rest.
      }
    }

    if (doc.body) {
      addCandidate("body", readCandidateText(doc.body));
    }

    const topCandidates = candidates
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    const parts = [
      ...priorityParts,
      ...(topCandidates.length > 0 ? topCandidates : candidates.slice(0, 4)),
    ];

    if (depth < 2) {
      for (const frame of doc.querySelectorAll("iframe")) {
        try {
          const frameDoc = frame.contentDocument;
          if (frameDoc && frameDoc.body) {
            const frameText = collectDocumentText(frameDoc, depth + 1);
            if (frameText) parts.push({ label: "iframe", score: 1, text: frameText });
          }
        } catch {
          // Cross-origin frames are intentionally unreadable. activeTab grants
          // the clicked page only; we never request broad host permissions.
        }
      }
    }

    return normalizeText(parts.map((part) => part.text).join("\n\n"));
  };

  let best = "";
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const text = collectDocumentText(document, 0);
    if (text.length > best.length || scoreText(text) > scoreText(best)) {
      best = text;
    }
    if (isUseful(text)) break;
    await wait(350 + attempt * 250);
  }

  const text = normalizeText(best);
  return {
    text,
    url: location.href,
    title: document.title,
    hasMeetingSignal: isUseful(text),
    keywordHits: keywordHits(text),
    length: text.length,
  };
}

function buildReviewDraft(captured) {
  const text = String(captured?.text || "");
  const url = String(captured?.url || matchFirstUrl(text) || "");
  const title = extractLabel(text, "页面标题") || String(captured?.title || "");
  const topic = extractTopic(text, title);
  const organizer = extractOrganizer(text, topic);
  const timeRange = extractDateTime(text);

  return {
    url,
    title,
    topic,
    organizer,
    platform: detectPlatform(`${text}\n${url}`),
    date: timeRange.date,
    time: timeRange.time,
    endTime: timeRange.endTime,
    rawText: text,
  };
}

function matchFirstUrl(text) {
  return String(text || "").match(/https?:\/\/[^\s<>"'，。；、)）]+/i)?.[0] || "";
}

function extractLabel(text, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(text || "").match(
    new RegExp(`(?:^|\\n)${escaped}\\s*[:：]\\s*([^\\n]+)`, "i")
  );
  return cleanValue(match?.[1] || "");
}

function cleanValue(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[，。；;,]+$/g, "")
    .trim();
}

function cleanTopic(value) {
  return cleanValue(value)
    .replace(/^(?:页面标题|会议主题|路演主题|活动主题|主题|标题)\s*[:：]\s*/i, "")
    .replace(/(?:。?敬请关注[！!]?)$/g, "")
    .trim();
}

function isGoodTopic(value) {
  const text = cleanTopic(value);
  if (text.length < 8 || text.length > 140) return false;
  if (/^(专场|会议介绍|会议详情|详情|简介|议程|新财富|加载中|暂无数据)$/.test(text)) {
    return false;
  }
  if (/^(路演时间|会议时间|活动时间|直播时间|开始时间|日期时间|时间)$/.test(text)) {
    return false;
  }
  if (/(次浏览|浏览|报名|已结束|进行中)/.test(text)) return false;
  if (/^(电子|通信|传媒|计算机|医药|消费|金融|汽车|机械|化工|有色|煤炭|地产)(\s+\+?\d+)?$/.test(text)) {
    return false;
  }
  return true;
}

function extractTopic(text, pageTitle) {
  for (const label of ["页面标题", "路演主题", "活动主题", "会议主题", "主题", "标题"]) {
    const candidate = cleanTopic(extractLabel(text, label));
    if (isGoodTopic(candidate)) return candidate;
  }

  const lines = String(text || "").split("\n").map(cleanValue).filter(Boolean);
  for (const line of lines) {
    const match = line.match(
      /(?:为您带来|为您分享|带来|主题为|主题是)\s*[:：]?\s*([^。！？!；;\n]+)/
    );
    const candidate = cleanTopic(match?.[1] || "");
    if (isGoodTopic(candidate)) return candidate;
  }

  const titleCandidate = cleanTopic(pageTitle);
  if (isGoodTopic(titleCandidate)) return titleCandidate;

  for (const line of lines) {
    const candidate = cleanTopic(line);
    if (isGoodTopic(candidate)) return candidate;
  }

  return "";
}

function extractOrganizer(text, topic) {
  const labeled = extractLabel(text, "组织者") || extractLabel(text, "主办方");
  if (labeled) return labeled;

  const titleMatch = String(topic || "").match(/^([^｜|]+?)\s*[｜|]\s*.+$/);
  if (titleMatch) return cleanValue(titleMatch[1]);

  const introMatch = String(text || "").match(
    /[，,]\s*([^\n，,。；;]{2,40}?)(?:为您带来|为您分享|带来)/
  );
  return cleanValue(introMatch?.[1] || "");
}

function detectPlatform(value) {
  const text = String(value || "").toLowerCase();
  if (text.includes("comein.cn") || text.includes("进门财经")) return "进门财经";
  if (text.includes("meritco-group.com") || text.includes("久谦")) return "久谦论坛";
  if (text.includes("meeting.tencent.com") || text.includes("腾讯会议")) return "腾讯会议";
  if (text.includes("zoom.us") || /\bzoom\b/i.test(value)) return "Zoom";
  if (text.includes("webex.com") || /\bwebex\b/i.test(value)) return "Webex";
  if (text.includes("teams.microsoft.com") || /\bteams\b/i.test(value)) return "Teams";
  if (text.includes("meet.google.com") || text.includes("google meet")) return "Google Meet";
  return "其他";
}

function extractDateTime(text) {
  const value = String(text || "");
  const date = extractDate(value);
  const time = extractTime(value);
  return {
    date,
    time: time.time,
    endTime: time.endTime,
  };
}

function extractDate(text) {
  const withYear = String(text || "").match(
    /(20\d{2})\s*[\/.\-年]\s*(\d{1,2})\s*[\/.\-月]\s*(\d{1,2})\s*[日号]?/
  );
  if (withYear) {
    return `${withYear[1]}-${pad(Number(withYear[2]))}-${pad(Number(withYear[3]))}`;
  }

  const monthDay =
    String(text || "").match(/(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]?/) ||
    String(text || "").match(/(?:^|[^\d])(\d{1,2})\s*[\/.\-]\s*(\d{1,2})\s*[日号]/);
  if (!monthDay) return "";

  const now = new Date();
  let year = now.getFullYear();
  const month = Number(monthDay[1]);
  const day = Number(monthDay[2]);
  const candidate = new Date(year, month - 1, day);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const deltaDays = Math.floor((candidate.getTime() - today.getTime()) / 86400000);
  if (deltaDays < -180) year += 1;
  return `${year}-${pad(month)}-${pad(day)}`;
}

function extractTime(text) {
  const value = String(text || "");
  const timeMatch = value.match(
    /(上午|下午|中午|晚上|凌晨)?\s*([01]?\d|2[0-3])\s*(?::|：|点|时)\s*([0-5]\d)?(?:\s*点?\s*(?:-|--|---|~|至|到|to)\s*(上午|下午|中午|晚上|凌晨)?\s*([01]?\d|2[0-3])\s*(?::|：|点|时)\s*([0-5]\d)?)?/i
  );
  if (!timeMatch) return { time: "", endTime: "" };
  const startHour = applyPeriod(Number(timeMatch[2]), timeMatch[1] || "");
  const startMinute = Number(timeMatch[3] || 0);
  const endTime = timeMatch[5]
    ? `${pad(applyPeriod(Number(timeMatch[5]), timeMatch[4] || timeMatch[1] || ""))}:${pad(Number(timeMatch[6] || 0))}`
    : "";
  return {
    time: `${pad(startHour)}:${pad(startMinute)}`,
    endTime,
  };
}

function applyPeriod(hour, period) {
  if ((period === "下午" || period === "晚上" || period === "中午") && hour < 12) {
    return hour + 12;
  }
  if ((period === "上午" || period === "凌晨") && hour === 12) return 0;
  return hour;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function showMeetingReviewDialog(draft, platforms) {
  const buildReviewedText = (fields) => {
    const range = fields.time
      ? `${fields.time}${fields.endTime ? `-${fields.endTime}` : ""}`
      : "";
    const lines = [
      `页面网址：${fields.url || ""}`,
      `页面标题：${fields.title || fields.topic || ""}`,
      `会议主题：${fields.topic || ""}`,
      `组织者：${fields.organizer || ""}`,
      `会议平台：${fields.platform || ""}`,
      `会议日期：${fields.date || ""}`,
      `会议时间：${[fields.date, range].filter(Boolean).join(" ")}`,
      `开始时间：${fields.time || ""}`,
      `结束时间：${fields.endTime || ""}`,
      "",
      "原始抓取文本：",
      fields.rawText || "",
    ];
    return lines.join("\n").slice(0, 15000).trim();
  };

  const existing = document.getElementById("zhinote-meeting-review-root");
  if (existing) existing.remove();

  const root = document.createElement("div");
  root.id = "zhinote-meeting-review-root";
  const shadow = root.attachShadow({ mode: "closed" });
  document.documentElement.appendChild(root);

  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: grid;
      place-items: center;
      background: rgba(15, 23, 42, 0.48);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      color: #18181b;
    }
    .dialog {
      width: min(720px, calc(100vw - 32px));
      max-height: calc(100vh - 32px);
      overflow: auto;
      border-radius: 12px;
      border: 1px solid #e4e4e7;
      background: #fff;
      box-shadow: 0 24px 80px rgba(15, 23, 42, 0.28);
    }
    .header {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 18px 20px 12px;
      border-bottom: 1px solid #f1f5f9;
    }
    h2 {
      margin: 0;
      font-size: 18px;
      line-height: 1.35;
      font-weight: 700;
      color: #0f172a;
    }
    .sub {
      margin: 6px 0 0;
      font-size: 12px;
      line-height: 1.5;
      color: #64748b;
    }
    .close {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      border: 1px solid transparent;
      background: transparent;
      color: #64748b;
      font-size: 22px;
      line-height: 1;
      cursor: pointer;
    }
    .close:hover { background: #f1f5f9; color: #0f172a; }
    .body {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px 16px;
      padding: 18px 20px;
    }
    label {
      display: grid;
      gap: 6px;
      font-size: 12px;
      font-weight: 600;
      color: #475569;
    }
    label.full { grid-column: 1 / -1; }
    input, select, textarea {
      box-sizing: border-box;
      width: 100%;
      border-radius: 8px;
      border: 1px solid #cbd5e1;
      background: #fff;
      color: #0f172a;
      padding: 9px 10px;
      font: inherit;
      font-size: 14px;
      outline: none;
    }
    textarea { min-height: 72px; resize: vertical; line-height: 1.45; }
    input:focus, select:focus, textarea:focus {
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14);
    }
    .url {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      border-radius: 8px;
      background: #f8fafc;
      padding: 9px 10px;
      font-size: 12px;
      color: #64748b;
    }
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 14px 20px 18px;
      border-top: 1px solid #f1f5f9;
    }
    .status {
      min-height: 18px;
      font-size: 12px;
      color: #64748b;
    }
    .status.err { color: #dc2626; }
    .actions { display: flex; gap: 10px; }
    button {
      border-radius: 8px;
      border: 1px solid #cbd5e1;
      padding: 9px 13px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      background: #fff;
      color: #334155;
    }
    button.primary {
      border-color: #18181b;
      background: #18181b;
      color: #fff;
    }
    button:disabled {
      cursor: default;
      opacity: 0.6;
    }
    @media (max-width: 640px) {
      .body { grid-template-columns: 1fr; }
      .footer { align-items: stretch; flex-direction: column; }
      .actions { width: 100%; }
      .actions button { flex: 1; }
    }
  `;

  const wrapper = document.createElement("div");
  wrapper.className = "backdrop";
  wrapper.innerHTML = `
    <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="zhinote-review-title">
      <div class="header">
        <div>
          <h2 id="zhinote-review-title">核对会议信息</h2>
          <p class="sub">确认后才会发送到 ZhiNote。可以直接修改识别不准的字段。</p>
        </div>
        <button class="close" type="button" aria-label="关闭">×</button>
      </div>
      <div class="body">
        <label class="full">会议主题
          <textarea data-field="topic"></textarea>
        </label>
        <label>会议日期
          <input data-field="date" type="date" />
        </label>
        <label>开始时间
          <input data-field="time" type="time" />
        </label>
        <label>结束时间
          <input data-field="endTime" type="time" />
        </label>
        <label>会议平台
          <select data-field="platform"></select>
        </label>
        <label>组织者
          <input data-field="organizer" type="text" />
        </label>
        <label class="full">来源页面
          <div class="url"></div>
        </label>
      </div>
      <div class="footer">
        <div class="status"></div>
        <div class="actions">
          <button class="cancel" type="button">取消</button>
          <button class="primary" type="button">发送到 ZhiNote</button>
        </div>
      </div>
    </section>
  `;

  shadow.append(style, wrapper);

  const find = (selector) => wrapper.querySelector(selector);
  const fields = {
    topic: find('[data-field="topic"]'),
    date: find('[data-field="date"]'),
    time: find('[data-field="time"]'),
    endTime: find('[data-field="endTime"]'),
    platform: find('[data-field="platform"]'),
    organizer: find('[data-field="organizer"]'),
  };

  for (const platform of platforms) {
    const option = document.createElement("option");
    option.value = platform;
    option.textContent = platform;
    fields.platform.appendChild(option);
  }

  fields.topic.value = draft.topic || "";
  fields.date.value = draft.date || "";
  fields.time.value = draft.time || "";
  fields.endTime.value = draft.endTime || "";
  fields.platform.value = platforms.includes(draft.platform) ? draft.platform : "其他";
  fields.organizer.value = draft.organizer || "";
  find(".url").textContent = draft.url || "未识别来源网址";

  const close = () => root.remove();
  find(".close").addEventListener("click", close);
  find(".cancel").addEventListener("click", close);
  wrapper.addEventListener("click", (event) => {
    if (event.target === wrapper) close();
  });

  find(".primary").addEventListener("click", () => {
    const status = find(".status");
    const primary = find(".primary");
    const reviewed = {
      ...draft,
      topic: fields.topic.value.trim(),
      date: fields.date.value,
      time: fields.time.value,
      endTime: fields.endTime.value,
      platform: fields.platform.value,
      organizer: fields.organizer.value.trim(),
    };

    if (!reviewed.topic) {
      status.textContent = "请先填写会议主题。";
      status.className = "status err";
      fields.topic.focus();
      return;
    }

    status.textContent = "正在发送到 ZhiNote...";
    status.className = "status";
    primary.disabled = true;

    chrome.runtime.sendMessage(
      {
        type: "zhihui:sendReviewedIntake",
        text: buildReviewedText(reviewed),
      },
      (response) => {
        if (chrome.runtime.lastError || !response?.ok) {
          status.textContent =
            response?.error || chrome.runtime.lastError?.message || "发送失败。";
          status.className = "status err";
          primary.disabled = false;
          return;
        }
        status.textContent = "已发送，正在打开 ZhiNote...";
        setTimeout(close, 700);
      }
    );
  });

  fields.topic.focus();
}

const button = document.getElementById("capture");
const status = document.getElementById("status");

function setStatus(message, kind) {
  status.textContent = message;
  status.className = "status" + (kind ? " " + kind : "");
}

button.addEventListener("click", async () => {
  button.disabled = true;
  setStatus("正在读取当前页面…");

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab || !tab.id) {
      setStatus("找不到当前标签页。", "err");
      button.disabled = false;
      return;
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: grabPageText,
    });
    const captured = results && results[0] ? results[0].result : null;
    const raw =
      typeof captured === "string"
        ? captured
        : captured && typeof captured.text === "string"
          ? captured.text
          : "";
    const text = raw.slice(0, MAX_CHARS).trim();
    const hasMeetingSignal =
      typeof captured === "string" ? text.length >= 800 : Boolean(captured?.hasMeetingSignal);

    if (!text) {
      setStatus("这个页面没有读到可用文字。", "err");
      button.disabled = false;
      return;
    }

    if (!hasMeetingSignal) {
      setStatus("没有读到明显会议正文；请确认已登录并等页面加载完成。", "err");
      button.disabled = false;
      return;
    }

    const reviewDraft = buildReviewDraft({
      ...captured,
      text,
    });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: showMeetingReviewDialog,
      args: [reviewDraft, PLATFORMS],
    });

    setStatus("已在当前页面打开核对窗口。", "ok");
    setTimeout(() => window.close(), 500);
  } catch (error) {
    setStatus("读取失败：" + (error && error.message ? error.message : "未知错误"), "err");
    button.disabled = false;
  }
});
