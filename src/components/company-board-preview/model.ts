import type { FundamentalsView } from "./fundamentalsData";
import type { CurrencyChoice } from "./currency";

export const STORAGE_KEY = "zhinote:company-board-demo:v1";
export const PRICE = 86.4;
export const BASE_EPS = 2.4;

export type SectionKind = "thesis" | "market" | "target" | "fundamentals" | "earnings" | "business" | "expectations" | "growth" | "notes" | "relations" | "custom";
export type Section = { id: string; kind: SectionKind; title: string; wide: boolean; hidden: boolean; text?: string };
export type Note = { id: string; title: string; category: string; date: string; body: string };
export type ChainLink = { id: string; chain: string; role: string };
export type DemoState = {
  version: 1;
  sections: Section[];
  thesis: string[];
  investmentThesis: string;
  notes: Note[];
  pe: number;
  eps: number;
  links: ChainLink[];
  growth: string[];
  fundamentalsView: FundamentalsView;
  currency: CurrencyChoice;
};

export const SECTION_TITLES: Record<SectionKind, string> = {
  thesis: "投资判断", market: "股价与交易", target: "目标估值", fundamentals: "基本面关键数据",
  earnings: "业绩复盘与预测", business: "业务拆分", expectations: "股价隐含预期",
  growth: "增长点跟踪", notes: "笔记与资料", relations: "产业链归属", custom: "自由笔记",
};

export function defaultSections(): Section[] {
  return (Object.keys(SECTION_TITLES) as SectionKind[]).filter(k => k !== "custom").map(kind => ({
    id: kind, kind, title: SECTION_TITLES[kind], wide: ["thesis", "earnings", "relations"].includes(kind), hidden: false,
  }));
}

export function createDemo(): DemoState {
  return {
    version: 1, sections: defaultSections(), pe: 25, eps: 4.1, fundamentalsView: "annual", currency: "original", investmentThesis: "",
    thesis: [
      "从通用连接器向高速互联升级，产品结构改善有望比单纯的出货增长更重要。重点跟踪新平台放量与现金转化。",
      "示例一致预期更关注短期订单波动；我的假设是高速互联占比继续提升，2027 年每股收益达到 4.10 元。",
      "若连续两个季度高速互联收入增速低于 20%，或应收账款增速持续超过收入，应重新评估增长与盈利质量。",
    ],
    notes: [
      { id: "n1", title: "Q3 业绩复盘：增长兑现，现金流仍需验证", category: "业绩复盘", date: "2026-10-30", body: "【虚构研究资料】\n\n本季度收入 9.4 亿元，较上次示例预测高 0.4 亿元。高速互联产品组合改善是主要贡献。\n\n待验证：应收回款节奏是否与收入增长匹配；新平台放量是否增加短期营运资金占用。\n\n下一步：更新产品结构假设，保留上一版预测用于复盘。" },
      { id: "n2", title: "高速互联：从送样到量产的三个观察点", category: "研究笔记", date: "2026-10-27", body: "【虚构研究资料】\n\n1. 客户验证进度与量产时间。\n2. 新产品良率与单位成本。\n3. 单客户订单集中度。\n\n判断仍是研究假设，不视为已确认订单。" },
      { id: "n3", title: "示例管理层交流：产能与资本开支", category: "会议纪要", date: "2026-10-21", body: "【虚构会议纪要】\n\n本记录仅为公司看板样板素材，并非真实访谈。\n\n讨论主题：产能扩张节奏、资本开支回报、产品升级与客户导入。\n\n需要进一步核对的事项：扩产投入、折旧影响与新产品毛利率。" },
      { id: "n4", title: "2027 年盈利情景与反证条件", category: "估值假设", date: "2026-10-18", body: "【虚构模型备注】\n\n基准情景 EPS 为 4.10 元，估值参考 25 倍 2027E P/E。\n\n情景价格不做时间折现，不能作为投资建议。\n\n敏感因素：产品结构、毛利率、费用率及股本变化。" },
    ],
    links: [{ id: "ai", chain: "AI 算力", role: "高速互联" }, { id: "auto", chain: "智能汽车", role: "车载连接" }],
    growth: ["跟踪中", "待验证", "跟踪中"],
  };
}

export function moveSection(sections: Section[], id: string, targetId: string): Section[] {
  const from = sections.findIndex(s => s.id === id), to = sections.findIndex(s => s.id === targetId);
  if (from < 0 || to < 0 || from === to) return sections;
  const next = [...sections];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function valuation(pe: number, eps: number) {
  const multiple = Math.max(16, Math.min(40, Number.isFinite(pe) ? pe : 25));
  const estimate = Math.max(0.1, Math.min(20, Number.isFinite(eps) ? eps : 4.1));
  return { impliedEps: PRICE / multiple, impliedGrowth: (Math.sqrt(PRICE / multiple / BASE_EPS) - 1) * 100,
    target: estimate * multiple, upside: (estimate * multiple / PRICE - 1) * 100 };
}

export function readDemo(raw: string | null): DemoState {
  if (!raw) return createDemo();
  try {
    const d = JSON.parse(raw);
    const string = (s: unknown, max: number) => typeof s === "string" && s.length <= max;
    if (d.version !== 1 || !Array.isArray(d.sections) || d.sections.length > 31 || !d.sections.every((s: Section) =>
      s && string(s.id, 100) && Object.hasOwn(SECTION_TITLES, s.kind) && string(s.title, 80) &&
      typeof s.wide === "boolean" && typeof s.hidden === "boolean" && (s.text === undefined || string(s.text, 20000))) ||
      new Set(d.sections.map((s: Section) => s.id)).size !== d.sections.length ||
      !Array.isArray(d.thesis) || d.thesis.length !== 3 || !d.thesis.every((s: unknown) => string(s, 4000)) ||
      !Array.isArray(d.notes) || d.notes.length > 100 || !d.notes.every((n: Note) => n && string(n.id, 100) && string(n.title, 200) && string(n.category, 40) && string(n.date, 40) && string(n.body, 20000)) ||
      !Array.isArray(d.links) || d.links.length > 20 || !d.links.every((l: ChainLink) => l && string(l.id, 100) && string(l.chain, 80) && string(l.role, 80)) ||
      !Array.isArray(d.growth) || d.growth.length !== 3 || !d.growth.every((s: string) => ["跟踪中", "待验证", "已兑现"].includes(s)) ||
      !Number.isFinite(d.pe) || d.pe < 16 || d.pe > 40 || !Number.isFinite(d.eps) || d.eps < 0.1 || d.eps > 20) return createDemo();
    // Keep all three legacy fields; move edited text into the manual thesis without importing demo hypotheses.
    const editedLegacy = d.thesis.some((text: string, index: number) => text !== createDemo().thesis[index]);
    const investmentThesis = string(d.investmentThesis, 16000) ? d.investmentThesis : editedLegacy
      ? d.thesis.map((text: string, index: number) => `${["核心判断", "与市场的分歧", "反证条件"][index]}\n${text}`).join("\n\n") : "";
    const sections: Section[] = [...d.sections];
    if (!sections.some(section => section.kind === "target") && sections.length < 31) {
      const target = defaultSections().find(section => section.kind === "target")!;
      let suffix = 0;
      while (sections.some(section => section.id === target.id)) target.id = `target-${++suffix}`;
      sections.splice(Math.max(0, sections.findIndex(section => section.kind === "market") + 1), 0, target);
    }
    return { ...d, sections, investmentThesis, fundamentalsView: d.fundamentalsView === "quarterly" ? "quarterly" : "annual",
      currency: ["USD", "CNY", "EUR", "JPY", "TWD", "KRW"].includes(d.currency) ? d.currency : "original" } as DemoState;
  } catch { return createDemo(); }
}

// Deterministic illustrative series, never a market-data feed.
export const PRICE_SERIES = Array.from({ length: 96 }, (_, i) =>
  Number((56 + i * 0.31 + Math.sin(i * 0.63) * 1.7 + Math.sin(i * 0.16) * 4.1).toFixed(2)));
PRICE_SERIES[95] = PRICE;
