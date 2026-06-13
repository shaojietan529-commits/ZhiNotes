// ZhiNote meeting capture — popup logic.
//
// Flow: when the owner clicks "抓取本页会议信息", we read ONLY the active tab's
// visible text (granted by activeTab on click), stash it in extension storage,
// then open ZhiNote's ZhiHui page. A content script on ZhiNote hands the text
// to the app's existing "会议信息输入" box, where the owner reviews and clicks
// 导入 — reusing the app's parser and confirmation. The extension itself never
// touches cookies, passwords, or login tokens, and never reads pages in the
// background.

const STORAGE_KEY = "zhihui_pending_intake";
const ZHINOTE_URL = "https://zhi-note.com/schedule";
const ZHINOTE_TAB_PATTERNS = [
  "https://zhi-note.com/*",
  "https://zhi-notes.vercel.app/*",
];
const MAX_CHARS = 15000;

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
    const priorityParts = collectTitleCandidates(doc).map((title) => ({
      label: "page-title",
      score: 1000 + titleScore(title),
      text: `页面标题：${title}`,
    }));
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
    hasMeetingSignal: isUseful(text),
    keywordHits: keywordHits(text),
    length: text.length,
  };
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

    await chrome.storage.local.set({ [STORAGE_KEY]: text });

    // Reuse an existing ZhiNote tab if one is open; otherwise open a new one.
    const existing = await chrome.tabs.query({ url: ZHINOTE_TAB_PATTERNS });
    if (existing.length > 0) {
      const target = existing[0];
      await chrome.tabs.update(target.id, {
        active: true,
        url: ZHINOTE_URL,
      });
      if (target.windowId !== undefined) {
        await chrome.windows.update(target.windowId, { focused: true });
      }
    } else {
      await chrome.tabs.create({ url: ZHINOTE_URL });
    }

    setStatus("已发送到 ZhiNote，请在 ZhiHui 核对后点击导入。", "ok");
    setTimeout(() => window.close(), 800);
  } catch (error) {
    setStatus("读取失败：" + (error && error.message ? error.message : "未知错误"), "err");
    button.disabled = false;
  }
});
