export const CURRENCIES = [
  { code: "USD", name: "美元" }, { code: "CNY", name: "人民币" },
  { code: "EUR", name: "欧元" }, { code: "JPY", name: "日元" },
  { code: "TWD", name: "台币" }, { code: "KRW", name: "韩币" },
] as const;
export type Currency = typeof CURRENCIES[number]["code"];
export type CurrencyChoice = "original" | Currency;
export const REPORT_CURRENCY: Currency = "CNY";
export const QUOTE_CURRENCY: Currency = "CNY";

export type FxRates = Readonly<Record<Currency, number>>;
export type FxQuote = { base: "USD"; timestamp: number; rates: FxRates; provider?: "exchangerate-api" };
export const FX_HOUR = 60 * 60 * 1000;
export const FX_MAX_AGE = 7 * 24 * FX_HOUR;
export const FX_SOURCE = "https://www.exchangerate.fun/docs/";

export function parseFxQuote(value: unknown, now = Date.now()): FxQuote {
  if (!value || typeof value !== "object") throw new Error("Invalid FX response");
  const data = value as Record<string, unknown>;
  const timestamp = data.timestamp;
  if (data.base !== "USD" || typeof timestamp !== "number" || !Number.isInteger(timestamp)
    || timestamp < 1577836800 || timestamp * 1000 > now + 5 * 60 * 1000
    || now - timestamp * 1000 > FX_MAX_AGE || !data.rates || typeof data.rates !== "object") {
    throw new Error("Invalid or expired FX quote");
  }
  const input = data.rates as Record<string, unknown>;
  const rates = {} as Record<Currency, number>;
  for (const { code } of CURRENCIES) {
    const rate = input[code];
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0 || rate > 1e9) throw new Error("Missing or invalid FX currency");
    rates[code] = rate;
  }
  if (rates.USD !== 1) throw new Error("Invalid FX base rate");
  if (data.provider !== undefined && data.provider !== "exchangerate-api") throw new Error("Invalid FX provider");
  return { base: "USD", timestamp, rates, ...(data.provider === "exchangerate-api" ? { provider: "exchangerate-api" as const } : {}) };
}

export function isFxStale(quote: FxQuote, now = Date.now()): boolean {
  return now - quote.timestamp * 1000 > (quote.provider === "exchangerate-api" ? 26 : 2) * FX_HOUR;
}

export function parseDailyFxQuote(value: unknown, now = Date.now()): FxQuote {
  if (!value || typeof value !== "object") throw new Error("Invalid daily FX response");
  const data = value as Record<string, unknown>;
  if (data.result !== "success") throw new Error("Daily FX unavailable");
  return parseFxQuote({ base: data.base_code, timestamp: data.time_last_update_unix, rates: data.rates, provider: "exchangerate-api" }, now);
}

export function fxSource(quote: FxQuote) {
  return quote.provider === "exchangerate-api"
    ? { url: "https://www.exchangerate-api.com", name: "Rates By Exchange Rate API", cadence: "每日更新 · 备用汇率" }
    : { url: FX_SOURCE, name: "ExchangeRate.fun", cadence: "每小时更新" };
}

export function displayCurrency(choice: CurrencyChoice, original: Currency = REPORT_CURRENCY): Currency {
  return choice === "original" ? original : choice;
}

export function convertMoney(value: number, from: Currency, to: Currency, rates?: FxRates | null): number {
  if (from === to) return value;
  if (!rates || !Number.isFinite(rates[from]) || !Number.isFinite(rates[to]) || rates[from] <= 0 || rates[to] <= 0) return NaN;
  return value / rates[from] * rates[to];
}

export function formatMoney(value: number, to: Currency, from: Currency = REPORT_CURRENCY, digits = 2, rates?: FxRates | null): string {
  const converted = convertMoney(value, from, to, rates);
  if (!Number.isFinite(converted)) return "—";
  return converted.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
