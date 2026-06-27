"use client";

export type PageUpdateReason =
  | "local-refresh"
  | "cloud-pull"
  | "cloud-push"
  | "cross-tab";

export interface PageUpdatePayload {
  id: string;
  parent_id: string | null;
  title: string;
  icon: string | null;
  cover_url: string | null;
  content_text: null;
  properties: string | null;
  position: number;
  depth: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface PageUpdateMessage {
  type: "pages-updated";
  sourceId: string;
  reason: PageUpdateReason;
  at: string;
  count?: number;
  pages?: PageUpdatePayload[];
}

interface PageUpdateSnapshot {
  id: string;
  parent_id: string | null;
  title: string;
  icon: string | null;
  cover_url: string | null;
  properties: string | null;
  position: number;
  depth: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

const CHANNEL_NAME = "zhinote:pages-updated:v1";
const STORAGE_KEY = "zhinote.pages.updated.broadcast.v1";
export const PAGE_LOCAL_UPDATE_EVENT = "zhinote:pages-local-updated";

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
  count?: number,
  pages?: PageUpdatePayload[]
) {
  if (typeof window === "undefined") return;
  const message: PageUpdateMessage = {
    type: "pages-updated",
    sourceId: getPageUpdateClientId(),
    reason,
    at: new Date().toISOString(),
    count,
    pages,
  };
  window.dispatchEvent(
    new CustomEvent<PageUpdateMessage>(PAGE_LOCAL_UPDATE_EVENT, {
      detail: message,
    })
  );
  getChannel()?.postMessage(message);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(message));
  } catch {
    // BroadcastChannel is the primary path; storage is only a fallback.
  }
}

function pageSnapshotToUpdatePayload(
  page: PageUpdateSnapshot
): PageUpdatePayload {
  return {
    id: page.id,
    parent_id: page.parent_id,
    title: page.title,
    icon: page.icon,
    cover_url: page.cover_url,
    content_text: null,
    properties: page.properties,
    position: page.position,
    depth: page.depth,
    created_at: page.created_at,
    updated_at: page.updated_at,
    deleted_at: page.deleted_at,
  };
}

export function emitPageSnapshotsUpdated(
  reason: PageUpdateReason = "cloud-push",
  pages: PageUpdateSnapshot[]
) {
  emitPagesUpdated(reason, pages.length, pages.map(pageSnapshotToUpdatePayload));
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
