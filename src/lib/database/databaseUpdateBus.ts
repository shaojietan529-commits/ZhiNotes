"use client";

import type { RemoteDatabaseRecord } from "@/lib/db/local/queries";

export type DatabaseUpdateReason =
  | "local-refresh"
  | "cloud-pull"
  | "cloud-push"
  | "cross-tab";

export type DatabaseUpdatePayload = RemoteDatabaseRecord;

export interface DatabaseUpdateMessage {
  type: "databases-updated";
  sourceId: string;
  reason: DatabaseUpdateReason;
  at: string;
  count?: number;
  records?: DatabaseUpdatePayload[];
}

const CHANNEL_NAME = "zhinote:databases-updated:v1";
const STORAGE_KEY = "zhinote.databases.updated.broadcast.v1";

let clientId: string | null = null;
let channel: BroadcastChannel | null | undefined;

export function getDatabaseUpdateClientId(): string {
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

export function emitDatabasesUpdated(
  reason: DatabaseUpdateReason = "local-refresh",
  count?: number,
  records?: DatabaseUpdatePayload[]
) {
  if (typeof window === "undefined") return;
  const message: DatabaseUpdateMessage = {
    type: "databases-updated",
    sourceId: getDatabaseUpdateClientId(),
    reason,
    at: new Date().toISOString(),
    count,
    records,
  };
  getChannel()?.postMessage(message);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(message));
  } catch {
    // BroadcastChannel is the primary path; storage is only a fallback.
  }
}

function isDatabaseUpdateMessage(
  value: unknown
): value is DatabaseUpdateMessage {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    (value as DatabaseUpdateMessage).type === "databases-updated" &&
    typeof (value as DatabaseUpdateMessage).sourceId === "string"
  );
}

export function subscribeDatabasesUpdated(
  handler: (message: DatabaseUpdateMessage) => void
): () => void {
  if (typeof window === "undefined") return () => {};
  const ownId = getDatabaseUpdateClientId();
  const onMessage = (event: MessageEvent) => {
    if (
      !isDatabaseUpdateMessage(event.data) ||
      event.data.sourceId === ownId
    ) {
      return;
    }
    handler(event.data);
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      const parsed = JSON.parse(event.newValue) as unknown;
      if (!isDatabaseUpdateMessage(parsed) || parsed.sourceId === ownId) return;
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
