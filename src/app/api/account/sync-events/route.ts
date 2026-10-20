import { getAccountIdentityConfig, getSessionAccount, readSessionToken } from "@/lib/account/server";
import { accountChangeStream, isAccountRealtimeEnabled } from "@/lib/sync/accountRealtimeServer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const startedAt = Date.now();
  const headers = { "Cache-Control": "private, no-store, no-transform" };
  const origin = request.headers.get("origin");
  if ((origin && origin !== new URL(request.url).origin) ||
      request.headers.get("sec-fetch-site") === "cross-site") {
    return new Response(null, { status: 403, headers });
  }
  if (!isAccountRealtimeEnabled()) return new Response(null, { status: 204, headers });
  const config = getAccountIdentityConfig();
  if (!config) return new Response(null, { status: 503, headers });
  const token = readSessionToken(request);
  if (!token) return new Response(null, { status: 401, headers });
  try {
    const account = await getSessionAccount(config, token);
    if (!account) return new Response(null, { status: 401, headers });
    if (new URL(request.url).searchParams.get("accountId") !== account.id) {
      return new Response(null, { status: 409, headers });
    }
    return new Response(accountChangeStream(config.kv, account.id, request.signal,
      Math.max(1, 55_000 - (Date.now() - startedAt))), {
      headers: { ...headers, "Content-Type": "text/event-stream", "X-Accel-Buffering": "no" },
    });
  } catch {
    return new Response(null, { status: 503, headers });
  }
}
