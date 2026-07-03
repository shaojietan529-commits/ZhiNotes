export const ANTHROPIC_REQUEST_TIMEOUT_MS = 8000;

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";

export class AnthropicRequestTimeoutError extends Error {
  status = 504;
  timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`Anthropic request timed out after ${timeoutMs}ms`);
    this.name = "AnthropicRequestTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export async function fetchAnthropicMessagesWithTimeout(
  apiKey: string,
  payload: unknown
): Promise<Response> {
  const controller = new AbortController();
  let didTimeout = false;
  const timeout = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, ANTHROPIC_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(ANTHROPIC_MESSAGES_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    if (didTimeout) {
      throw new AnthropicRequestTimeoutError(ANTHROPIC_REQUEST_TIMEOUT_MS);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function buildAnthropicTimeoutBody(error: AnthropicRequestTimeoutError) {
  return {
    error: "ai-provider-request-timeout",
    message: "AI 请求超时；本地数据不受影响，可稍后重试。",
    timeout_ms: error.timeoutMs,
  };
}
