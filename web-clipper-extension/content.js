// ZhiNotes Web Clipper — content script
// This file is loaded on all pages but remains passive.
// The actual extraction is done via chrome.scripting.executeScript
// from the popup, so this file only provides a message-based fallback
// for browsers that restrict scripting.

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "zhiclip:extract") {
    const mode = msg.mode || "full";

    if (mode === "selection") {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        sendResponse({ title: document.title, html: "<p>（未选中任何内容）</p>" });
        return;
      }
      const range = selection.getRangeAt(0);
      const div = document.createElement("div");
      div.appendChild(range.cloneContents());
      sendResponse({ title: document.title, html: div.innerHTML });
      return;
    }

    // Full page extraction
    const article =
      document.querySelector("article") ||
      document.querySelector('[role="main"]') ||
      document.querySelector("main") ||
      document.querySelector(".post-content") ||
      document.querySelector(".article-content") ||
      document.querySelector("#content");

    const target = article || document.body;
    const clone = target.cloneNode(true);

    const removeTags = ["script", "style", "nav", "footer", "iframe", "noscript", "svg"];
    removeTags.forEach((tag) => {
      clone.querySelectorAll(tag).forEach((el) => el.remove());
    });

    let html = clone.innerHTML;
    if (html.length > 500000) {
      html = html.slice(0, 500000);
    }

    sendResponse({ title: document.title, html });
  }
});
