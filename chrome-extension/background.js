// Background bridge for the review dialog injected into the current meeting
// page. The page-side dialog cannot use chrome.tabs directly, so it asks this
// worker to store the reviewed intake and open/focus ZhiNote.

const STORAGE_KEY = "zhihui_pending_intake";
const ZHINOTE_URL = "https://zhi-note.com/schedule";
const ZHINOTE_TAB_PATTERNS = [
  "https://zhi-note.com/*",
  "https://zhi-notes.vercel.app/*",
];

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "zhihui:sendReviewedIntake") return false;

  void sendReviewedIntake(String(message.text || ""))
    .then(() => sendResponse({ ok: true }))
    .catch((error) =>
      sendResponse({
        ok: false,
        error: error && error.message ? error.message : "发送失败",
      })
    );

  return true;
});

async function sendReviewedIntake(text) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("没有可发送的会议信息。");

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
