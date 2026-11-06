import type { Currency, CurrencyChoice } from "./currency";

export type TargetField = "price" | "marketCap";
export type CapUnit = "hundredMillion" | "trillion";
export type ShareBasis = { shares: number; currency: Currency; asOf: string; source: string; url?: string; approximate?: boolean };
export type TargetDraft = {
  version: 1;
  companyId: string;
  source: TargetField;
  amount: number | null;
  shareMode: "reported" | "custom";
  customShares: number | null;
  capUnit: CapUnit;
  currency: CurrencyChoice;
};

export const CAP_UNITS = { hundredMillion: { label: "亿", scale: 1e8 }, trillion: { label: "万亿", scale: 1e12 } };
export const NVIDIA_SHARE_BASIS: ShareBasis = {
  shares: 24_100_000_000, currency: "USD", asOf: "2026-08-21", approximate: true,
  source: "NVIDIA FY2027 Q2 10-Q · 流通在外股数",
  url: "https://www.sec.gov/Archives/edgar/data/1045810/000104581026000075/nvda-20260726.htm",
};
export const DEMO_SHARE_BASIS: ShareBasis = { shares: 320_000_000, currency: "CNY", asOf: "2026-10-30", source: "虚构公司 · 示例股本" };
export const targetDraftKey = (companyId: string) => `zhinote:company-target-valuation:v1:${companyId}`;

export function createTargetDraft(companyId: string, capUnit: CapUnit = "hundredMillion"): TargetDraft {
  return { version: 1, companyId, source: "price", amount: null, shareMode: "reported", customShares: null, capUnit, currency: "original" };
}

export function parseTargetNumber(text: string): number | null {
  if (!text.trim()) return null;
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text.trim())) return NaN;
  const value = Number(text);
  return Number.isFinite(value) && value >= 0 ? value : NaN;
}

export function calculateTarget(source: TargetField, amount: number | null, shares: number | null) {
  if (amount === null) return { price: null, marketCap: null, overflow: false };
  if (!Number.isFinite(amount) || amount < 0) return { price: null, marketCap: null, overflow: true };
  const validShares = shares !== null && Number.isFinite(shares) && shares > 0;
  const derived = validShares ? (source === "price" ? amount * shares : amount / shares) : null;
  const overflow = derived !== null && (!Number.isFinite(derived) || (amount > 0 && derived === 0));
  const result = overflow ? null : derived;
  return { price: source === "price" ? amount : result, marketCap: source === "marketCap" ? amount : result, overflow };
}

export function readTargetDraft(raw: string | null, companyId: string, capUnit: CapUnit = "hundredMillion"): TargetDraft {
  const fallback = createTargetDraft(companyId, capUnit);
  if (!raw) return fallback;
  try {
    const d = JSON.parse(raw);
    const nullableNumber = (n: unknown) => n === null || (typeof n === "number" && Number.isFinite(n) && n >= 0);
    if (!d || d.version !== 1 || d.companyId !== companyId || !["price", "marketCap"].includes(d.source) ||
      !nullableNumber(d.amount) || !nullableNumber(d.customShares) || d.customShares === 0 ||
      !["reported", "custom"].includes(d.shareMode) || !Object.hasOwn(CAP_UNITS, d.capUnit) ||
      !["original", "USD", "CNY", "EUR", "JPY", "TWD", "KRW"].includes(d.currency)) return fallback;
    return { ...fallback, source: d.source, amount: d.amount, shareMode: d.shareMode, customShares: d.customShares, capUnit: d.capUnit, currency: d.currency };
  } catch { return fallback; }
}
