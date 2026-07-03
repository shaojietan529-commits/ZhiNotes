"use client";

export const FILE_EMBED_SYNC_REQUEST_TIMEOUT_MS = 12000;

export class FileEmbedSyncRequestTimeoutError extends Error {
  timeoutMs: number;

  constructor(timeoutMs: number) {
    super("文件云同步请求超时；文件已保存在本地，可稍后重试。");
    this.name = "FileEmbedSyncRequestTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export async function fetchFileEmbedSyncWithTimeout(
  body: Record<string, unknown>
): Promise<Response> {
  const controller = new AbortController();
  let didTimeout = false;
  const timeout = window.setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, FILE_EMBED_SYNC_REQUEST_TIMEOUT_MS);

  try {
    return await fetch("/api/files/embed-sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (didTimeout) {
      throw new FileEmbedSyncRequestTimeoutError(
        FILE_EMBED_SYNC_REQUEST_TIMEOUT_MS
      );
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}
