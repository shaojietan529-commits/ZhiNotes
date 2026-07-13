type BoundedJsonBodyResult =
  | { ok: true; value: unknown; bytesRead: number }
  | {
      ok: false;
      reason: "payload_too_large" | "invalid_json";
      bytesRead?: number;
    };

export async function readBoundedJsonBody(
  request: Request,
  maxBytes: number
): Promise<BoundedJsonBodyResult> {
  const bodyText = await readBoundedRequestText(request, maxBytes);
  if (!bodyText.ok) return bodyText;

  try {
    return {
      ok: true,
      value: JSON.parse(bodyText.text),
      bytesRead: bodyText.bytesRead,
    };
  } catch {
    return {
      ok: false,
      reason: "invalid_json",
      bytesRead: bodyText.bytesRead,
    };
  }
}

async function readBoundedRequestText(request: Request, maxBytes: number) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return { ok: false as const, reason: "payload_too_large" as const };
  }

  if (!request.body) {
    return { ok: true as const, text: "", bytesRead: 0 };
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      bytesRead += value.byteLength;
      if (bytesRead > maxBytes) {
        await reader.cancel();
        return {
          ok: false as const,
          reason: "payload_too_large" as const,
          bytesRead,
        };
      }

      text += decoder.decode(value, { stream: true });
    }

    text += decoder.decode();
    return { ok: true as const, text, bytesRead };
  } finally {
    reader.releaseLock();
  }
}
