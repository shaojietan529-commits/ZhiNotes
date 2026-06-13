// Simulates the extension <-> ZhiNote app handshake to prove the captured
// text is delivered exactly once, regardless of which side loads first.
//
// Mirrors the real wiring:
//   App (MeetingScheduleShell): listens "zhihui:intake"; on "zhihui:hello"
//     re-emits "zhihui:ready"; emits "zhihui:ready" once on mount.
//   Content script (content-zhinote.js): on "zhihui:ready" delivers text via
//     "zhihui:intake"; emits "zhihui:hello" (+ retries) to nudge the app.
//
// In a real page the content script and page share one DOM EventTarget even
// though they run in isolated JS worlds, so a single EventTarget models it.

import assert from "node:assert";

class CustomEvent extends Event {
  constructor(type, init = {}) {
    super(type);
    this.detail = init.detail;
  }
}

function runScenario(order) {
  const bus = new EventTarget();
  let received = [];

  const mountApp = () => {
    bus.addEventListener("zhihui:intake", (e) => received.push(e.detail.text));
    bus.addEventListener("zhihui:hello", () =>
      bus.dispatchEvent(new CustomEvent("zhihui:ready"))
    );
    bus.dispatchEvent(new CustomEvent("zhihui:ready"));
  };

  const mountContent = (text) => {
    let delivered = false;
    const deliver = () => {
      if (delivered) return;
      delivered = true;
      bus.dispatchEvent(new CustomEvent("zhihui:intake", { detail: { text } }));
      bus.removeEventListener("zhihui:ready", deliver);
    };
    bus.addEventListener("zhihui:ready", deliver);
    bus.dispatchEvent(new CustomEvent("zhihui:hello"));
  };

  if (order === "app-first") {
    mountApp();
    mountContent("MEETING_TEXT");
  } else {
    mountContent("MEETING_TEXT");
    mountApp();
  }
  return received;
}

for (const order of ["app-first", "content-first"]) {
  const received = runScenario(order);
  assert.deepStrictEqual(
    received,
    ["MEETING_TEXT"],
    `${order}: expected exactly one delivery, got ${JSON.stringify(received)}`
  );
  console.log(`✓ ${order}: delivered exactly once`);
}

console.log("handshake test passed");
