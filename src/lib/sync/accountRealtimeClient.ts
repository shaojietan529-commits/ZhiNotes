import { isRealtimeDomain, readSseData, type RemoteChange } from "./realtimeProtocol";

export type RealtimeState = "connecting" | "connected" | "polling";

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const finish = () => { clearTimeout(timer); signal.removeEventListener("abort", finish); resolve(); };
    const timer = setTimeout(finish, ms);
    signal.addEventListener("abort", finish, { once: true });
    if (signal.aborted) finish();
  });
}

export async function listenForAccountChanges(options: {
  accountId: string;
  signal: AbortSignal;
  onChange: (change: RemoteChange) => void;
  onState: (state: RealtimeState) => void;
  fetcher?: typeof fetch;
  delay?: typeof wait;
}) {
  const { accountId, signal, onChange, onState } = options;
  const fetcher = options.fetcher ?? fetch;
  const delay = options.delay ?? wait;
  let failures = 0;
  while (!signal.aborted) {
    const connection = new AbortController();
    const abort = () => connection.abort();
    signal.addEventListener("abort", abort, { once: true });
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    const resetWatchdog = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(abort, 30_000);
    };
    let retryMs = Math.min(30_000, 1000 * 2 ** Math.min(failures++, 5));
    try {
      onState("connecting");
      resetWatchdog();
      const response = await fetcher(`/api/account/sync-events?accountId=${encodeURIComponent(accountId)}`, {
        credentials: "same-origin", cache: "no-store", signal: connection.signal,
      });
      if ([401, 403, 409].includes(response.status)) { onState("polling"); return; }
      if (response.status === 204) retryMs = 300_000;
      else if (response.ok && response.body && response.headers.get("content-type")?.includes("text/event-stream")) {
        let ready = false;
        for await (const data of readSseData(response.body)) {
          if (signal.aborted) return;
          const message = JSON.parse(data);
          resetWatchdog();
          if (message.type === "heartbeat") continue;
          if (message.accountId !== accountId) continue;
          if (message.type === "ready" && !ready) {
            ready = true;
            failures = 0;
            retryMs = 1000;
            onState("connected");
            onChange({ accountId, domain: "all" });
          } else if (ready && message.type === "change" && isRealtimeDomain(message.domain)) {
            onChange({ accountId, domain: message.domain });
          }
        }
      }
    } catch {
      // Polling remains active while notifications reconnect.
    } finally {
      clearTimeout(watchdog);
      signal.removeEventListener("abort", abort);
      connection.abort();
    }
    if (signal.aborted) return;
    onState("polling");
    await delay(retryMs + Math.floor(Math.random() * 500), signal);
  }
}
