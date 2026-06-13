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

// Runs in the page: returns the URL, title and visible text. Kept tiny and
// self-contained because it is injected as a function.
function grabPageText() {
  const parts = [
    location.href,
    document.title,
    document.body ? document.body.innerText : "",
  ];
  return parts.filter(Boolean).join("\n");
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
    const raw = results && results[0] ? results[0].result || "" : "";
    const text = raw.slice(0, MAX_CHARS).trim();

    if (!text) {
      setStatus("这个页面没有读到可用文字。", "err");
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
