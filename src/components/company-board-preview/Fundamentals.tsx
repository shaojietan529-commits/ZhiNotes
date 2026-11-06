import { FUNDAMENTALS, FUNDAMENTALS_AS_OF, FUNDAMENTAL_METRICS, formatFundamental, type FundamentalsView } from "./fundamentalsData";
import { formatMoney, REPORT_CURRENCY, type Currency, type FxRates } from "./currency";
import s from "./CompanyBoardPreview.module.css";

export default function Fundamentals({ view, onChange, ready, currency, rates }: { view: FundamentalsView; onChange: (view: FundamentalsView) => void; ready: boolean; currency: Currency; rates?: FxRates }) {
  const periods = FUNDAMENTALS[view];
  return <>
    <div className={s.fundamentalsToolbar}>
      <div className={s.segmented} role="group" aria-label="基本面数据组合">
        <button type="button" aria-pressed={view === "annual"} disabled={!ready} onClick={() => onChange("annual")}>年度 + YTD</button>
        <button type="button" aria-pressed={view === "quarterly"} disabled={!ready} onClick={() => onChange("quarterly")}>最近六季度</button>
      </div>
      <span>金额：亿 {currency}</span>
    </div>
    <div className={s.tableScroll} role="region" aria-label="基本面数据表" tabIndex={0}>
      <table className={`${s.table} ${s.fundamentalsTable}`} aria-label={view === "annual" ? "过去五年及今年YTD基本面" : "最近六季度基本面"}>
        <thead><tr><th scope="col">指标</th>{periods.map(period => <th scope="col" key={period.id} className={period.id.endsWith("ytd") ? s.ytdColumn : ""}>{period.label}<small>{period.detail}</small></th>)}</tr></thead>
        <tbody>{FUNDAMENTAL_METRICS.map(metric => <tr key={metric.key} data-metric={metric.key}>
          <th scope="row" title={metric.definition}>{metric.label}</th>
          {periods.map(period => {
            const value = period.values[metric.key];
            const color = metric.format === "yoy" && value !== null && value !== 0 ? (value > 0 ? s.green : s.amber) : "";
            return <td key={period.id} className={`${color} ${period.id.endsWith("ytd") ? s.ytdColumn : ""}`}>{metric.format === "amount" && value !== null ? formatMoney(value, currency, REPORT_CURRENCY, 2, rates) : formatFundamental(value, metric.format)}</td>;
          })}
        </tr>)}</tbody>
      </table>
    </div>
    <div className={s.source}>示例财务数据 · 截至 {FUNDAMENTALS_AS_OF} · 原始报表 {REPORT_CURRENCY} · 净利润采用归母口径<br />
      {currency !== REPORT_CURRENCY ? <>按看板所示汇率统一换算为 {currency}；YoY 保留原币口径，非历史汇率折算。<br /></> : null}
      {view === "annual" ? "年度 YoY 对比上年全年；YTD 对比上年 1–9 月，未年化。" : "收入、净利润和资本开支均为单季值；YoY 对比上年同季。"}<br />
      固定资产为期末净额；存货周转天数按期初期末平均存货及期间实际天数计算。
    </div>
  </>;
}
