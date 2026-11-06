import { parseFxQuote, isFxStale } from "@/components/company-board-preview/currency";

let pending: Promise<Response> | null = null;
let retryAfter = 0;

function unavailable() {
  return Response.json({ error: "FX_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "60" } });
}

export async function GET() {
  if (Date.now() < retryAfter) return unavailable();
  if (!pending) pending = (async () => {
    try {
      const response = await fetch("https://api.exchangerate.fun/latest?base=USD", {
        next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000),
        headers: { Accept: "application/json" }, credentials: "omit", redirect: "error",
      });
      if (!response.ok) throw new Error("FX unavailable");
      const quote = parseFxQuote(await response.json());
      return Response.json(quote, { headers: { "Cache-Control": `public, max-age=0, s-maxage=${isFxStale(quote) ? 60 : 3600}` } });
    } catch {
      retryAfter = Date.now() + 60000;
      return unavailable();
    } finally { pending = null; }
  })();
  return (await pending).clone();
}
