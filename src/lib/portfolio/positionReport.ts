// Portfolio position report parsing. All parsing happens in the browser on
// files the user explicitly picks; nothing here uploads or persists remotely.

export interface PortfolioPosition {
  key: string; // normalized "CODE EXCHANGE", e.g. "000660 KS"
  ticker: string;
  name: string;
  nmv: number; // signed USD market value (negative = short)
  gmv: number;
  pnlDaily: number;
  pnlMtd: number;
  pnlYtd: number;
  pnlItd: number;
  priceChange1dPct: number;
  country: string;
  sector: string;
}

export interface PortfolioSnapshot {
  importedAt: string;
  sourceName: string;
  positions: PortfolioPosition[];
}

export type TagMap = Record<string, string>;

// Bloomberg uses C1/C2/CG etc. for China A-share lines; fold them into CH so
// the same stock maps to one key across exports.
const EXCHANGE_FOLD: Record<string, string> = {
  C1: "CH",
  C2: "CH",
  CG: "CH",
  CS: "CH",
};

export function normalizeBbKey(bbKey: string): string {
  const tokens = bbKey.trim().split(/\s+/);
  if (tokens.length < 2) return bbKey.trim().toUpperCase();
  const code = tokens[0].toUpperCase();
  let exchange = tokens[1].toUpperCase();
  exchange = EXCHANGE_FOLD[exchange] ?? exchange;
  return `${code} ${exchange}`;
}

// Map local-code suffixes (Book 代码 column, e.g. "688037.SH") to the same
// normalized key space as the Bloomberg yellow keys.
const LOCAL_SUFFIX_TO_EXCHANGE: Record<string, string> = {
  SH: "CH",
  SZ: "CH",
  BJ: "CH",
  KS: "KS",
  KQ: "KS",
  HK: "HK",
  TW: "TT",
  TWO: "TT",
  T: "JT",
  JP: "JT",
  US: "US",
  // Europe
  L: "LN",
  LN: "LN",
  DE: "GR",
  GR: "GR",
  GY: "GR",
  PA: "FP",
  FP: "FP",
  AS: "NA",
  NA: "NA",
  SW: "SW",
  VX: "SW",
  MI: "IM",
  IM: "IM",
  MC: "SM",
  SM: "SM",
  ST: "SS",
  SS: "SS",
  CO: "DC",
  DC: "DC",
  OL: "NO",
  NO: "NO",
  HE: "FH",
  FH: "FH",
  BR: "BB",
  BB: "BB",
  LS: "PL",
  PL: "PL",
  VI: "AV",
  AV: "AV",
  ID: "ID",
  IR: "ID",
};

export function normalizeLocalCode(localCode: string): string | null {
  const match = localCode.trim().match(/^([A-Za-z0-9]+)\.([A-Za-z]+)$/);
  if (!match) return null;
  const exchange = LOCAL_SUFFIX_TO_EXCHANGE[match[2].toUpperCase()];
  if (!exchange) return null;
  return `${match[1].toUpperCase()} ${exchange}`;
}

type SheetRow = unknown[];

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[$,%\s,]/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function toText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function findColumn(header: SheetRow, candidates: string[]): number {
  for (const candidate of candidates) {
    const index = header.findIndex(
      (cell) =>
        typeof cell === "string" &&
        cell.trim().toLowerCase() === candidate.toLowerCase()
    );
    if (index >= 0) return index;
  }
  return -1;
}

// Parse the daily position report (single-sheet Bloomberg-style export).
// Returns null with a reason when the expected columns cannot be found.
export function parsePositionRows(
  rows: SheetRow[],
  sourceName: string
): { snapshot: PortfolioSnapshot } | { error: string } {
  const headerIndex = rows.findIndex(
    (row) =>
      findColumn(row, ["Ticker"]) >= 0 && findColumn(row, ["NMV"]) >= 0
  );
  if (headerIndex < 0) {
    return { error: "没有找到包含 Ticker / NMV 的表头行，请确认是持仓报告文件。" };
  }
  const header = rows[headerIndex];

  const col = {
    bbKey: findColumn(header, ["BB Yellow Key"]),
    ticker: findColumn(header, ["Ticker"]),
    name: findColumn(header, ["Description"]),
    pnlDaily: findColumn(header, ["$ Daily P&L", "Daily P&L"]),
    priceChange: findColumn(header, ["% Price Change", "Price Change %"]),
    nmv: findColumn(header, ["NMV"]),
    gmv: findColumn(header, ["GMV"]),
    pnlMtd: findColumn(header, ["$ MTD P&L", "MTD P&L"]),
    pnlItd: findColumn(header, ["$ ITD P&L", "ITD P&L"]),
    pnlYtd: findColumn(header, ["$ YTD P&L", "YTD P&L"]),
    sector: findColumn(header, ["GIC Sector", "GICS Sector"]),
    country: findColumn(header, ["Exchange Country Name", "Country"]),
  };

  const positions: PortfolioPosition[] = [];
  for (const row of rows.slice(headerIndex + 1)) {
    const ticker = toText(col.ticker >= 0 ? row[col.ticker] : "");
    const bbKey = toText(col.bbKey >= 0 ? row[col.bbKey] : "");
    if (!ticker && !bbKey) continue;
    const nmv = toNumber(col.nmv >= 0 ? row[col.nmv] : 0);
    const gmv = toNumber(col.gmv >= 0 ? row[col.gmv] : 0);
    if (nmv === 0 && gmv === 0) continue;
    positions.push({
      key: bbKey ? normalizeBbKey(bbKey) : ticker.toUpperCase(),
      ticker: ticker || bbKey.split(/\s+/)[0],
      name: toText(col.name >= 0 ? row[col.name] : ""),
      nmv,
      gmv: Math.abs(gmv) || Math.abs(nmv),
      pnlDaily: toNumber(col.pnlDaily >= 0 ? row[col.pnlDaily] : 0),
      pnlMtd: toNumber(col.pnlMtd >= 0 ? row[col.pnlMtd] : 0),
      pnlYtd: toNumber(col.pnlYtd >= 0 ? row[col.pnlYtd] : 0),
      pnlItd: toNumber(col.pnlItd >= 0 ? row[col.pnlItd] : 0),
      priceChange1dPct: toNumber(
        col.priceChange >= 0 ? row[col.priceChange] : 0
      ),
      country: toText(col.country >= 0 ? row[col.country] : "") || "未知",
      sector: toText(col.sector >= 0 ? row[col.sector] : ""),
    });
  }

  if (positions.length === 0) {
    return { error: "表头识别成功，但没有解析到任何持仓行。" };
  }

  return {
    snapshot: {
      importedAt: new Date().toISOString(),
      sourceName,
      positions,
    },
  };
}

// Parse ticker → tag mappings out of the Book workbook (Longs / Shorts /
// Exited / ETFs sheets all share the same column layout).
export function parseBookTagRows(
  sheets: { name: string; rows: SheetRow[] }[]
): TagMap {
  const map: TagMap = {};
  for (const { rows } of sheets) {
    const headerIndex = rows.findIndex(
      (row) => findColumn(row, ["Tags"]) >= 0
    );
    if (headerIndex < 0) continue;
    const header = rows[headerIndex];
    const tickerCol = findColumn(header, ["Ticker"]);
    const localCol = findColumn(header, ["代码"]);
    const tagCol = findColumn(header, ["Tags"]);
    if (tagCol < 0) continue;

    for (const row of rows.slice(headerIndex + 1)) {
      const tag = toText(row[tagCol]);
      if (!tag) continue;
      const bb = toText(tickerCol >= 0 ? row[tickerCol] : "");
      const local = toText(localCol >= 0 ? row[localCol] : "");
      let key: string | null = null;
      if (bb && /\s/.test(bb)) key = normalizeBbKey(bb);
      else if (local) key = normalizeLocalCode(local);
      if (key) map[key] = tag;
    }
  }
  return map;
}

export interface ExposureRow {
  label: string;
  long: number; // USD, positive
  short: number; // USD, positive
  net: number;
  gross: number;
  positions: PortfolioPosition[];
}

export function buildExposures(
  positions: PortfolioPosition[],
  labelOf: (position: PortfolioPosition) => string
): { rows: ExposureRow[]; totalGross: number } {
  const byLabel = new Map<string, ExposureRow>();
  for (const position of positions) {
    const label = labelOf(position) || "未分类";
    const row = byLabel.get(label) ?? {
      label,
      long: 0,
      short: 0,
      net: 0,
      gross: 0,
      positions: [] as PortfolioPosition[],
    };
    if (position.nmv >= 0) row.long += position.nmv;
    else row.short += -position.nmv;
    row.net = row.long - row.short;
    row.gross = row.long + row.short;
    row.positions.push(position);
    byLabel.set(label, row);
  }
  const rows = [...byLabel.values()].sort((a, b) => b.gross - a.gross);
  const totalGross = rows.reduce((sum, row) => sum + row.gross, 0);
  return { rows, totalGross };
}
