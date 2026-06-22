"use client";

export type PageUpdateReason =
  | "local-refresh"
  | "cloud-pull"
  | "cloud-push"
  | "cross-tab";

interface PageUpdateMessage {
  type: "pages-updated";
  sourceId: string;
  reason: PageUpdateReason;
  at: string;
  count?: number;
}

const CHANNEL_NAME = "zhinote:pages-updated:v1";
const STORAGE_KEY = "zhinote.pages.updated.broadcast.v1";

let clientId: string | null = null;
let channel: BroadcastChannel | null | undefined;

export function getPageUpdateClientId(): string {
  if (clientId) return clientId;
  clientId = `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2)}`;
  return clientId;
}

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) {
    return null;
  }
  if (channel === undefined) {
    channel = new BroadcastChannel(CHANNEL_NAME);
  }
  return channel;
}

export function emitPagesUpdated(
  reason: PageUpdateReason = "local-refresh",
  count?: number
) {
  if (typeof window === "undefined") return;
  const message: PageUpdateMessage = {
    type: "pages-updated",
    sourceId: getPageUpdateClientId(),
    reason,
    at: new Date().toISOString(),
    count,
  };
  getChannel()?.postMessage(message);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(message));
  } catch {
    // BroadcastChannel is the primary path; storage is only a fallback.
  }
}

function isPageUpdateMessage(value: unknown): value is PageUpdateMessage {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    (value as PageUpdateMessage).type === "pages-updated" &&
    typeof (value as PageUpdateMessage).sourceId === "string"
  );
}

export function subscribePagesUpdated(
  handler: (message: PageUpdateMessage) => void
): () => void {
  if (typeof window === "undefined") return () => {};
  const ownId = getPageUpdateClientId();
  const onMessage = (event: MessageEvent) => {
    if (!isPageUpdateMessage(event.data) || event.data.sourceId === ownId) {
      return;
    }
    handler(event.data);
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      const parsed = JSON.parse(event.newValue) as unknown;
      if (!isPageUpdateMessage(parsed) || parsed.sourceId === ownId) return;
      handler(parsed);
    } catch {
      // Ignore malformed fallback messages.
    }
  };
  const currentChannel = getChannel();
  currentChannel?.addEventListener("message", onMessage);
  window.addEventListener("storage", onStorage);
  return () => {
    currentChannel?.removeEventListener("message", onMessage);
    window.removeEventListener("storage", onStorage);
  };
}
