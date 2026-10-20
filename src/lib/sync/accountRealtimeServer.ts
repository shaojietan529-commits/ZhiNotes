import { createHash } from "node:crypto";
import type { KvEnv } from "@/lib/account/server";
import { encodeSseData, isRealtimeDomain, readSseData, type RealtimeDomain } from "./realtimeProtocol";

export function isAccountRealtimeEnabled(): boolean {
  return process.env.ZHINOTES_REALTIME_SYNC_ENABLED === "true";
}

export function accountRealtimeChannel(accountId: string): string {
  return `zhinote:changes:v1:${createHash("sha256").update(accountId).digest("hex")}`;
}

// A notification is a hint, never the durable data or an upload receipt.
// Failure here must not turn a committed write into a failed save.
export async function publishAccountChange(kv: KvEnv, accountId: string, domain: RealtimeDomain): Promise<boolean> {
  if (!isAccountRealtimeEnabled()) return false;
  try {
    const response = await fetch(kv.url, {
      method: "POST",
      headers: { authorization: `Bearer ${kv.token}`, "content-type": "application/json" },
      body: JSON.stringify(["PUBLISH", accountRealtimeChannel(accountId), domain]),
      signal: AbortSignal.timeout(1500),
      cache: "no-store",
    });
    if (!response.ok) return false;
    const result = await response.json();
    return typeof result.result === "number" && !result.error;
  } catch {
    return false;
  }
}

export function accountChangeStream(kv: KvEnv, accountId: string, requestSignal: AbortSignal, lifetimeMs = 55_000) {
  const upstream = new AbortController();
  const channel = accountRealtimeChannel(accountId);
  let stop = () => upstream.abort();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const cleanup = () => {
        clearTimeout(lifetime);
        clearTimeout(connectTimeout);
        clearInterval(heartbeat);
        requestSignal.removeEventListener("abort", stop);
        upstream.abort();
      };
      stop = () => {
        if (closed) return;
        closed = true;
        cleanup();
        try { controller.close(); } catch { /* The reader may already have cancelled. */ }
      };
      const send = (value: unknown) => {
        if (closed) return;
        if ((controller.desiredSize ?? 0) <= 0) { stop(); return; }
        controller.enqueue(encodeSseData(value));
      };
      // Bounded below the route's 60s budget. Each reconnect rechecks the
      // session and triggers catch-up after the subscription is confirmed.
      const lifetime = setTimeout(stop, lifetimeMs);
      const connectTimeout = setTimeout(stop, 8_000);
      const heartbeat = setInterval(() => send({ type: "heartbeat" }), 15_000);
      requestSignal.addEventListener("abort", stop, { once: true });
      if (requestSignal.aborted) { stop(); return; }
      void (async () => {
        try {
          const response = await fetch(`${kv.url.replace(/\/$/, "")}/subscribe/${encodeURIComponent(channel)}`, {
            method: "POST",
            headers: { authorization: `Bearer ${kv.token}`, accept: "text/event-stream" },
            signal: upstream.signal,
            cache: "no-store",
          });
          if (!response.ok || !response.body ||
              !response.headers.get("content-type")?.includes("text/event-stream")) return;
          let ready = false;
          for await (const data of readSseData(response.body)) {
            if (data === `subscribe,${channel},1` && !ready) {
              ready = true;
              clearTimeout(connectTimeout);
              send({ type: "ready", accountId });
            } else if (ready && data.startsWith(`message,${channel},`)) {
              const domain = data.slice(`message,${channel},`.length);
              if (isRealtimeDomain(domain)) send({ type: "change", accountId, domain });
            }
          }
        } catch {
          // Close quietly; browser catch-up and polling recover missed hints.
        } finally { stop(); }
      })();
    },
    cancel() { stop(); },
  });
}
