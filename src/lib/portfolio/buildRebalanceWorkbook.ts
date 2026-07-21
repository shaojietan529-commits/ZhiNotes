import * as XLSX from "xlsx";
import { REBALANCE_TEMPLATE_BASE64 } from "./rebalanceTemplate";

// ---------------------------------------------------------------------------
// Rebalance instruction export.
//
// Fills the owner's Keystone "idea" Excel template from the confirmed trades in
// the portfolio rebalance simulator. Only these template inputs are written:
//   D1  — trade date (YYYYMMDD number)
//   A   — BBG Ticker (e.g. "000660 KS Equity")
//   C   — Transaction Type (Buy / Sell / SellShort / BuyToCover)
//   D   — GMV in USD thousands (always positive)
//   E   — "Unwind?" flag ("Y" when the trade fully closes the position)
//   F   — Reason (left blank; the owner fills this in)
// The Bloomberg BDP formulas in columns B/H/I/J (Name / CH / JP / KR) are left
// intact — they resolve on the owner's Bloomberg terminal. Aggregate GMV/NMV
// change formulas in row 2 recompute themselves from the Transaction Type and
// GMV columns.
// ---------------------------------------------------------------------------

export type RebalanceTradeAction = "buy" | "sell" | "sellshort" | "buytocover";

export interface RebalanceExportTrade {
  ticker: string;
  action: RebalanceTradeAction;
  amountK: number;
  unwind: boolean;
}

const ACTION_LABEL: Record<RebalanceTradeAction, string> = {
  buy: "Buy",
  sell: "Sell",
  sellshort: "SellShort",
  buytocover: "BuyToCover",
};

// First data row and the last row that carries pre-seeded BDP formulas in the
// template. Beyond this we add BDP formulas ourselves.
const DATA_START_ROW = 5;
const TEMPLATE_PREFILLED_LAST_ROW = 53;

// Bloomberg BDP fields already used by the template's Name columns.
const BDP_FIELDS: { col: string; field: string }[] = [
  { col: "B", field: "NAME" },
  { col: "H", field: "NAME_CHINESE_SIMPLIFIED" },
  { col: "I", field: "NAME_KANJI_SHORT" },
  { col: "J", field: "NAME_KOREAN" },
];

function toBbgTicker(raw: string): string {
  const t = (raw || "").trim();
  if (!t) return t;
  return /equity$/i.test(t) ? t : `${t} Equity`;
}

function decodeBase64(b64: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(b64, "base64"));
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export interface BuiltRebalanceWorkbook {
  buffer: Uint8Array;
  filename: string;
  dateNum: number;
  tradeCount: number;
}

// Build the filled workbook. `dateNum` is a YYYYMMDD integer (caller passes the
// owner's local date so the day matches their wall clock).
export function buildRebalanceWorkbook(
  trades: RebalanceExportTrade[],
  dateNum: number
): BuiltRebalanceWorkbook {
  const wb = XLSX.read(decodeBase64(REBALANCE_TEMPLATE_BASE64), {
    cellStyles: true,
    cellFormula: true,
  });
  const ws = wb.Sheets["Trades"];
  if (!ws) throw new Error("template-missing-trades-sheet");

  const cellAt = (addr: string): XLSX.CellObject => {
    let c = ws[addr] as XLSX.CellObject | undefined;
    if (!c) {
      c = { t: "s", v: "" };
      ws[addr] = c;
    }
    return c;
  };
  const setStr = (addr: string, v: string) => {
    const c = cellAt(addr);
    c.t = "s";
    c.v = v;
    delete c.f;
    delete (c as { F?: string }).F;
  };
  const setNum = (addr: string, v: number) => {
    const c = cellAt(addr);
    c.t = "n";
    c.v = v;
    delete c.f;
    delete (c as { F?: string }).F;
  };
  const clearVal = (addr: string) => {
    const c = ws[addr] as XLSX.CellObject | undefined;
    if (!c) return;
    delete c.v;
    delete c.f;
    delete (c as { F?: string }).F;
    c.t = "z";
  };
  const setBdp = (addr: string, row: number, field: string) => {
    const c = cellAt(addr);
    c.t = "s";
    c.f = `_xll.BDP(A${row}, "${field}")`;
    (c as { F?: string }).F = addr;
    delete c.v;
  };

  // Trade date.
  setNum("D1", dateNum);

  const count = trades.length;
  for (let i = 0; i < count; i++) {
    const r = DATA_START_ROW + i;
    const t = trades[i];
    setStr(`A${r}`, toBbgTicker(t.ticker));
    setStr(`C${r}`, ACTION_LABEL[t.action] ?? t.action);
    setNum(`D${r}`, Math.round(Math.abs(t.amountK) * 100) / 100);
    if (t.unwind) setStr(`E${r}`, "Y");
    else clearVal(`E${r}`);
    clearVal(`F${r}`); // Reason — owner fills in.
    for (const { col, field } of BDP_FIELDS) setBdp(`${col}${r}`, r, field);
  }

  // Clear any leftover template example / pre-seeded rows below the new data.
  for (let r = DATA_START_ROW + count; r <= TEMPLATE_PREFILLED_LAST_ROW; r++) {
    for (const col of ["A", "B", "C", "D", "E", "F", "H", "I", "J"]) {
      clearVal(`${col}${r}`);
    }
  }

  // Extend the sheet range if needed.
  if (ws["!ref"]) {
    const range = XLSX.utils.decode_range(ws["!ref"]);
    range.e.r = Math.max(range.e.r, DATA_START_ROW + Math.max(count, 1) - 1);
    ws["!ref"] = XLSX.utils.encode_range(range);
  }

  const buffer = XLSX.write(wb, {
    bookType: "xlsx",
    type: "buffer",
    cellStyles: true,
  }) as Uint8Array;

  return {
    buffer,
    filename: `Keystone_Idea_${dateNum}.xlsx`,
    dateNum,
    tradeCount: count,
  };
}
