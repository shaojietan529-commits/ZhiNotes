// Runs on ZhiNote pages. If the popup stashed captured meeting text, hand it
// to the ZhiNote app via a DOM CustomEvent (the only channel that crosses the
// content-script / page isolated worlds). A small handshake covers both load
// orders: the app announces "zhihui:ready"; this script answers with the text.
// We say "zhihui:hello" too, so an already-mounted app re-announces readiness.

(async () => {
  const STORAGE_KEY = "zhihui_pending_intake";

  let stored;
  try {
    stored = await chrome.storage.local.get(STORAGE_KEY);
  } catch {
    return;
  }
  const text = stored && stored[STORAGE_KEY];
  if (!text || typeof text !== "string") return;

  let delivered = false;

  const deliver = () => {
    if (delivered) return;
    delivered = true;
    window.dispatchEvent(
      new CustomEvent("zhihui:intake", { detail: { text } })
    );
    chrome.storage.local.remove(STORAGE_KEY);
    window.removeEventListener("zhihui:ready", deliver);
  };

  // The app fires this on mount (and again whenever it hears our hello).
  window.addEventListener("zhihui:ready", deliver);

  // Nudge an app that mounted before this script ran to re-announce.
  window.dispatchEvent(new CustomEvent("zhihui:hello"));

  // Safety net: if the handshake is missed, retry a few times then give up
  // (leaving the text in storage so a manual reload still works).
  let attempts = 0;
  const retry = setInterval(() => {
    attempts += 1;
    window.dispatchEvent(new CustomEvent("zhihui:hello"));
    if (delivered || attempts >= 10) clearInterval(retry);
  }, 500);
})();
