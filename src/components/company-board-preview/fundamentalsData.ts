export type FundamentalsView = "annual" | "quarterly";

type FinancialPeriod = {
  year: number;
  quarter?: number;
  revenue: number;
  netProfit: number;
  grossProfit: number;
  capex: number;
  fixedAssets: number;
  openingInventory: number;
  closingInventory: number;
  days: number;
};

// All figures are synthetic; monetary values are CNY 100 million.
export const DEMO_QUARTERS: readonly FinancialPeriod[] = [
  { year: 2024, quarter: 1, revenue: 4.6, netProfit: 1.10, grossProfit: 1.656, capex: .40, fixedAssets: 5.9, openingInventory: 1.7, closingInventory: 1.8, days: 91 },
  { year: 2024, quarter: 2, revenue: 5.1, netProfit: 1.32, grossProfit: 1.887, capex: .45, fixedAssets: 6.2, openingInventory: 1.8, closingInventory: 1.9, days: 91 },
  { year: 2024, quarter: 3, revenue: 5.7, netProfit: 1.55, grossProfit: 2.166, capex: .55, fixedAssets: 6.6, openingInventory: 1.9, closingInventory: 2.0, days: 92 },
  { year: 2024, quarter: 4, revenue: 6.4, netProfit: 1.95, grossProfit: 2.466, capex: .60, fixedAssets: 7.0, openingInventory: 2.0, closingInventory: 2.1, days: 92 },
  { year: 2025, quarter: 1, revenue: 5.4, netProfit: 1.30, grossProfit: 2.187, capex: .50, fixedAssets: 7.4, openingInventory: 2.1, closingInventory: 2.2, days: 90 },
  { year: 2025, quarter: 2, revenue: 6.5, netProfit: 1.65, grossProfit: 2.665, capex: .62, fixedAssets: 7.7, openingInventory: 2.2, closingInventory: 2.4, days: 91 },
  { year: 2025, quarter: 3, revenue: 7.3, netProfit: 1.97, grossProfit: 3.0879, capex: .70, fixedAssets: 8.0, openingInventory: 2.4, closingInventory: 2.6, days: 92 },
  { year: 2025, quarter: 4, revenue: 9.4, netProfit: 2.76, grossProfit: 4.0149, capex: .88, fixedAssets: 8.4, openingInventory: 2.6, closingInventory: 2.8, days: 92 },
  { year: 2026, quarter: 1, revenue: 7.8, netProfit: 1.952, grossProfit: 3.276, capex: .78, fixedAssets: 8.85, openingInventory: 2.8, closingInventory: 2.9, days: 90 },
  { year: 2026, quarter: 2, revenue: 8.7, netProfit: 2.304, grossProfit: 3.741, capex: .88, fixedAssets: 9.35, openingInventory: 2.9, closingInventory: 3.05, days: 91 },
  { year: 2026, quarter: 3, revenue: 9.4, netProfit: 2.528, grossProfit: 4.089, capex: .96, fixedAssets: 9.9, openingInventory: 3.05, closingInventory: 3.1, days: 92 },
];

function aggregate(periods: readonly FinancialPeriod[]): FinancialPeriod {
  const first = periods[0], last = periods[periods.length - 1];
  const sum = (key: "revenue" | "netProfit" | "grossProfit" | "capex" | "days") => periods.reduce((total, p) => total + p[key], 0);
  return { year: first.year, revenue: sum("revenue"), netProfit: sum("netProfit"), grossProfit: sum("grossProfit"), capex: sum("capex"), days: sum("days"),
    fixedAssets: last.fixedAssets, openingInventory: first.openingInventory, closingInventory: last.closingInventory };
}

const years: readonly FinancialPeriod[] = [
  { year: 2020, revenue: 9.8, netProfit: 1.85, grossProfit: 3.136, capex: .8, fixedAssets: 3.1, openingInventory: .9, closingInventory: 1.05, days: 366 },
  { year: 2021, revenue: 12.0, netProfit: 2.4, grossProfit: 3.96, capex: 1.0, fixedAssets: 3.6, openingInventory: 1.05, closingInventory: 1.2, days: 365 },
  { year: 2022, revenue: 14.4, netProfit: 3.0, grossProfit: 4.968, capex: 1.25, fixedAssets: 4.3, openingInventory: 1.2, closingInventory: 1.45, days: 365 },
  { year: 2023, revenue: 17.8, netProfit: 4.15, grossProfit: 6.408, capex: 1.65, fixedAssets: 5.3, openingInventory: 1.45, closingInventory: 1.7, days: 365 },
  aggregate(DEMO_QUARTERS.filter(p => p.year === 2024)),
  aggregate(DEMO_QUARTERS.filter(p => p.year === 2025)),
];

export function yearOverYear(value: number, prior: number | undefined): number | null {
  return prior !== undefined && prior > 0 ? (value / prior - 1) * 100 : null;
}

function values(period: FinancialPeriod, prior?: FinancialPeriod) {
  const costOfSales = period.revenue - period.grossProfit;
  return {
    revenue: period.revenue,
    revenueYoy: yearOverYear(period.revenue, prior?.revenue),
    netProfit: period.netProfit,
    netProfitYoy: yearOverYear(period.netProfit, prior?.netProfit),
    grossMargin: period.grossProfit / period.revenue * 100,
    capex: period.capex,
    fixedAssets: period.fixedAssets,
    inventoryDays: (period.openingInventory + period.closingInventory) / 2 / costOfSales * period.days,
  };
}

const ytd = aggregate(DEMO_QUARTERS.filter(p => p.year === 2026));
const priorYtd = aggregate(DEMO_QUARTERS.filter(p => p.year === 2025 && p.quarter! <= 3));
export const FUNDAMENTALS_AS_OF = "2026-09-30";
export const FUNDAMENTALS = {
  annual: [
    ...years.slice(1).map(p => ({ id: String(p.year), label: String(p.year), detail: "全年", values: values(p, years.find(prev => prev.year === p.year - 1)) })),
    { id: "2026-ytd", label: "2026 YTD", detail: "1–9 月", values: values(ytd, priorYtd) },
  ],
  quarterly: DEMO_QUARTERS.slice(-6).map(p => ({ id: `${p.year}-q${p.quarter}`, label: `${p.year} Q${p.quarter}`, detail: "单季", values: values(p, DEMO_QUARTERS.find(prev => prev.year === p.year - 1 && prev.quarter === p.quarter)) })),
};

export const FUNDAMENTAL_METRICS: readonly { key: keyof ReturnType<typeof values>; label: string; format: "amount" | "percent" | "yoy" | "days"; definition?: string }[] = [
  { key: "revenue", label: "收入", format: "amount" },
  { key: "revenueYoy", label: "收入 YoY", format: "yoy" },
  { key: "netProfit", label: "净利润（归母）", format: "amount" },
  { key: "netProfitYoy", label: "净利润 YoY", format: "yoy" },
  { key: "grossMargin", label: "毛利润率", format: "percent", definition: "同期毛利润 ÷ 同期收入" },
  { key: "capex", label: "资本开支", format: "amount", definition: "购建固定资产、无形资产和其他长期资产支付的现金；按期间累计或单季展示" },
  { key: "fixedAssets", label: "固定资产（期末）", format: "amount", definition: "期末固定资产净额，不累加各季度余额" },
  { key: "inventoryDays", label: "存货周转天数", format: "days", definition: "（期初存货 + 期末存货）÷ 2 ÷ 同期营业成本 × 期间实际天数" },
];

export function formatFundamental(value: number | null, format: typeof FUNDAMENTAL_METRICS[number]["format"]) {
  if (value === null || !Number.isFinite(value)) return "—";
  if (format === "amount") return value.toFixed(2);
  if (format === "days") return `${value.toFixed(1)} 天`;
  return `${format === "yoy" && value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}
