// ZhiNotes Web Clipper — popup logic

const DEFAULT_SERVER = "https://zhi-note.com";

async function getSettings() {
  const result = await chrome.storage.sync.get(["serverUrl", "apiKey"]);
  return {
    serverUrl: result.serverUrl || DEFAULT_SERVER,
    apiKey: result.apiKey || "",
  };
}

async function saveSettings(serverUrl, apiKey) {
  await chrome.storage.sync.set({ serverUrl, apiKey });
}

function showStatus(el, type, message) {
  el.className = `status ${type}`;
  el.textContent = message;
  el.style.display = "block";
}

async function getPageContent(mode) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) throw new Error("无法获取当前标签页");

  if (mode === "link") {
    return {
      title: tab.title || "未命名页面",
      content: `<p><a href="${escapeHtml(tab.url)}">${escapeHtml(tab.title || tab.url)}</a></p>`,
      url: tab.url,
    };
  }

  // Execute content script to grab content
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: extractPageContent,
    args: [mode],
  });

  const result = results[0]?.result;
  if (!result) throw new Error("无法读取页面内容");

  return {
    title: result.title || tab.title || "未命名页面",
    content: result.html,
    url: tab.url,
  };
}

// Injected into the active tab to extract content
function extractPageContent(mode) {
  if (mode === "selection") {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      return { title: document.title, html: "<p>（未选中任何内容）</p>" };
    }
    const range = selection.getRangeAt(0);
    const div = document.createElement("div");
    div.appendChild(range.cloneContents());
    return { title: document.title, html: div.innerHTML };
  }

  // Full page: try to grab article content, fallback to body
  const article =
    document.querySelector("article") ||
    document.querySelector('[role="main"]') ||
    document.querySelector("main") ||
    document.querySelector(".post-content") ||
    document.querySelector(".article-content") ||
    document.querySelector("#content");

  const target = article || document.body;

  // Clone and clean
  const clone = target.cloneNode(true);

  // Remove scripts, styles, nav, ads
  const removeTags = ["script", "style", "nav", "footer", "iframe", "noscript", "svg"];
  removeTags.forEach((tag) => {
    clone.querySelectorAll(tag).forEach((el) => el.remove());
  });

  // Remove hidden elements
  clone.querySelectorAll('[aria-hidden="true"], [style*="display:none"], [style*="display: none"]').forEach((el) => el.remove());

  // Limit content size (~500KB)
  let html = clone.innerHTML;
  if (html.length > 500000) {
    html = html.slice(0, 500000) + "\n<!-- 内容过长，已截断 -->";
  }

  return { title: document.title, html };
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Local YYYY-MM-DD so the page lands in the right day's column regardless
// of the server timezone.
function localDateKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// --- UI Logic ---

document.addEventListener("DOMContentLoaded", async () => {
  const titleInput = document.getElementById("title");
  const clipMode = document.getElementById("clip-mode");
  const saveBtn = document.getElementById("save-btn");
  const statusEl = document.getElementById("status");
  const serverUrlSelect = document.getElementById("server-url");
  const apiKeyInput = document.getElementById("api-key");
  const saveSettingsBtn = document.getElementById("save-settings");

  // Load settings
  const settings = await getSettings();
  serverUrlSelect.value = settings.serverUrl;
  apiKeyInput.value = settings.apiKey;

  // Pre-fill title from current tab
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      titleInput.value = tab.title || "";
    }
  } catch {
    // ignore
  }

  // Save settings
  saveSettingsBtn.addEventListener("click", async () => {
    await saveSettings(serverUrlSelect.value, apiKeyInput.value);
    showStatus(statusEl, "success", "设置已保存");
    setTimeout(() => { statusEl.style.display = "none"; }, 1500);
  });

  // Main save action
  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = "保存中…";
    statusEl.style.display = "none";

    try {
      const currentSettings = await getSettings();
      const mode = clipMode.value;
      const pageData = await getPageContent(mode);

      // Use custom title if user edited it
      const finalTitle = titleInput.value.trim() || pageData.title;

      const payload = {
        title: finalTitle,
        content: pageData.content,
        source: "web-clipper",
        url: pageData.url,
        clientDate: localDateKey(),
      };

      const headers = { "Content-Type": "application/json" };
      if (currentSettings.apiKey) {
        headers["Authorization"] = `Bearer ${currentSettings.apiKey}`;
      }

      const response = await fetch(
        `${currentSettings.serverUrl}/api/pages/ingest`,
        {
          method: "POST",
          headers,
          credentials: "include", // send session cookie
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json();

      if (response.ok && result.ok) {
        const where =
          result.placement === "daily"
            ? `已存入每日纪要 ${result.date}`
            : "已保存";
        showStatus(statusEl, "success", `✓ ${where}：「${result.title}」`);
      } else {
        const msg = result.message || result.error || "保存失败";
        showStatus(statusEl, "error", `✗ ${msg}`);
      }
    } catch (err) {
      showStatus(statusEl, "error", `✗ ${err.message || "网络错误"}`);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "📥 保存到 ZhiNotes";
    }
  });
});
