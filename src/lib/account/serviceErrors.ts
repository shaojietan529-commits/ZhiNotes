export type AccountServiceOperation =
  | "storage-get"
  | "storage-setex"
  | "storage-set"
  | "storage-del"
  | "email-send";

type FailureReason = "timeout" | "network" | "access" | "quota" | "upstream" | "invalid-response";

export class AccountServiceError extends Error {
  constructor(
    readonly operation: AccountServiceOperation,
    readonly reason: FailureReason,
    readonly status: number | null = null
  ) {
    super(`account service failure: ${operation} ${reason}`);
    this.name = "AccountServiceError";
  }
}

export function accountServiceFailureReason(status: number, body: unknown): FailureReason {
  const record = body && typeof body === "object" ? body as Record<string, unknown> : {};
  // Inspect only provider error fields; never retain or log their raw values.
  const detail = [record.error, record.message, record.name]
    .filter((value): value is string => typeof value === "string")
    .join(" ").slice(0, 2048);
  if (status === 429 || /quota|(?:daily|monthly|max|request|command|rate)[\s_-]*(?:requests?[\s_-]*)?limit|limit[\s_-]*(?:has[\s_-]*)?(?:been[\s_-]*)?exceeded/i.test(detail)) {
    return "quota";
  }
  if (status === 401 || status === 403 || /wrongpass|noauth|invalid[\s_-]*(?:api[\s_-]*)?(?:key|token)/i.test(detail)) {
    return "access";
  }
  return "upstream";
}

const lastReported = new Map<string, number>();

export function reportAccountServiceFailure(error: AccountServiceError): void {
  const key = `${error.operation}:${error.reason}:${error.status}`;
  const now = Date.now();
  if (now - (lastReported.get(key) ?? -Infinity) < 60_000) return;
  lastReported.set(key, now);
  // Deliberately omit URLs, Redis keys, headers, payloads, error messages and stacks.
  console.error("[account-service-failure]", {
    operation: error.operation,
    reason: error.reason,
    status: error.status,
  });
}
