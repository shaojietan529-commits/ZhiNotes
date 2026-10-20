export const REALTIME_DOMAINS = ["pages", "databases", "portfolio"] as const;
export type RealtimeDomain = typeof REALTIME_DOMAINS[number];
export const ACCOUNT_REMOTE_CHANGE_EVENT = "zhinote:account-remote-change";
export type RemoteChange = { accountId: string; domain: RealtimeDomain | "all" };

export function isRealtimeDomain(value: unknown): value is RealtimeDomain {
  return REALTIME_DOMAINS.some((domain) => domain === value);
}

// Both streams carry small notifications only. Bound incomplete frames so an
// invalid upstream cannot make a long-lived connection accumulate memory.
export async function* readSseData(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let data: string[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      if (buffer.length > 16_384) throw new Error("Invalid notification frame");
      let end: number;
      while ((end = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, end).replace(/\r$/, "");
        buffer = buffer.slice(end + 1);
        if (!line) {
          if (data.length) yield data.join("\n");
          data = [];
        } else if (line.startsWith("data:")) {
          data.push(line.slice(5).replace(/^ /, ""));
          if (data.join("\n").length > 4096) throw new Error("Invalid notification data");
        }
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export function encodeSseData(value: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(value)}\n\n`);
}
