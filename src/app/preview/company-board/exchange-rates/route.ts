import { parseFxQuote, parseDailyFxQuote, isFxStale } from "@/components/company-board-preview/currency";

let pending: Promise<Response> | null = null;
let retryAfter = 0;

function unavailable() {
  return Response.json({ error: "FX_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "60" } });
}

export async function GET() {
  if (Date.now() < retryAfter) return unavailable();
  if (!pending) pending = (async () => {
    try {
      const read = async (url: string, timeout: number) => {
        const response = await fetch(url, {
          next: { revalidate: 3600 }, signal: AbortSignal.timeout(timeout),
          headers: { Accept: "application/json" }, credentials: "omit", redirect: "error",
        });
        if (!response.ok) throw new Error("FX unavailable");
        return response.json();
      };
      let quote;
      try {
        quote = parseFxQuote(await read("https://api.exchangerate.fun/latest?base=USD", 3500));
      } catch {
        // The fallback carries its actual provider timestamp and daily cadence.
        quote = parseDailyFxQuote(await read("https://open.er-api.com/v6/latest/USD", 5000));
      }
      return Response.json(quote, { headers: { "Cache-Control": `public, max-age=0, s-maxage=${isFxStale(quote) ? 60 : 3600}` } });
    } catch {
      retryAfter = Date.now() + 60000;
      return unavailable();
    } finally { pending = null; }
  })();
  return (await pending).clone();
}
