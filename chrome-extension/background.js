// Background bridge for the review dialog injected into the current meeting
// page. The page-side dialog cannot use chrome.tabs directly, so it asks this
// worker to store the reviewed intake and open/focus ZhiNote.

importScripts("meeting-parser.js");

const STORAGE_KEY = "zhihui_pending_intake";
const ZHINOTE_URL = "https://zhi-note.com/schedule";
const ZHINOTE_TAB_PATTERNS = [
  "https://zhi-note.com/*",
  "https://zhi-notes.vercel.app/*",
];

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "zhihui:sendReviewedIntake") return false;
  if (sender.id !== chrome.runtime.id || !sender.tab || !/^https?:\/\//.test(sender.url || "")) {
    sendResponse({ ok: false, error: "请从当前会议页面的核对窗口发送。" });
    return false;
  }

  void sendReviewedIntake(message.fields)
    .then(() => sendResponse({ ok: true }))
    .catch((error) =>
      sendResponse({
        ok: false,
        error: error && error.message ? error.message : "发送失败",
      })
    );

  return true;
});

async function sendReviewedIntake(fields) {
  if (!fields || typeof fields !== "object") throw new Error("没有可发送的会议信息。");
  const trimmed = globalThis.ZhiHuiIntake.serializeReviewedMeetingInput(fields);

  await chrome.storage.local.set({ [STORAGE_KEY]: trimmed });

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
}
