"use client";

import { useEffect, useRef, useState } from "react";
import { PRICE_SERIES } from "./model";
import { convertMoney, formatMoney, QUOTE_CURRENCY, type Currency, type FxRates } from "./currency";
import styles from "./CompanyBoardPreview.module.css";

export default function MarketChart({ range, currency, rates }: { range: "1M" | "3M" | "6M"; currency: Currency; rates?: FxRates }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const plotRight = useRef(0);
  const [hover, setHover] = useState<number | null>(null);
  const count = range === "1M" ? 16 : range === "3M" ? 48 : 96;
  const values = PRICE_SERIES.slice(-count);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const draw = () => {
      const width = canvas.clientWidth, height = canvas.clientHeight;
      if (!width || !height) return;
      const scale = window.devicePixelRatio || 1;
      canvas.width = width * scale; canvas.height = height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(scale, scale);
      const data = PRICE_SERIES.slice(-count);
      const min = Math.floor((Math.min(...data) - 3) / 5) * 5, max = Math.ceil((Math.max(...data) + 3) / 5) * 5;
      ctx.font = "11px Arial";
      const ticks = Array.from({ length: 4 }, (_, i) => min + (max - min) * i / 3);
      const labels = ticks.map(value => formatMoney(value, currency, QUOTE_CURRENCY, convertMoney(max, QUOTE_CURRENCY, currency, rates) < 20 ? 2 : 0, rates));
      const right = width - Math.max(...labels.map(label => ctx.measureText(label).width)) - 16;
      plotRight.current = right;
      const left = 5, top = 18, bottom = height - 42;
      const x = (i: number) => left + i / (data.length - 1) * (right - left);
      const y = (v: number) => bottom - (v - min) / (max - min) * (bottom - top);
      ctx.font = "11px Arial";
      for (let i = 0; i <= 3; i++) {
        const v = min + (max - min) * i / 3, row = y(v);
        ctx.strokeStyle = "#282c30"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(left, row); ctx.lineTo(right, row); ctx.stroke();
        ctx.fillStyle = "#7f888d"; ctx.fillText(labels[i], right + 10, row + 4);
      }
      ctx.beginPath(); data.forEach((v, i) => i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v)));
      ctx.lineWidth = 2; ctx.strokeStyle = "#66d8b0"; ctx.stroke();
      ctx.lineTo(right, bottom); ctx.lineTo(left, bottom); ctx.closePath(); ctx.fillStyle = "#66d8b00b"; ctx.fill();
      data.forEach((_, i) => { ctx.fillStyle = i % 4 === 0 ? "#4a5554" : "#2b3833"; ctx.fillRect(x(i), height - 30 - (9 + (i * 7) % 14), Math.max(1, (right - left) / count - 2), 9 + (i * 7) % 14); });
      ctx.fillStyle = "#7f888d"; ctx.fillText(range === "6M" ? "05 / 2026" : range === "3M" ? "08 / 2026" : "10 / 2026", left, height - 4); ctx.fillText("10 / 30", right - 38, height - 4);
      if (hover !== null) {
        const i = Math.min(data.length - 1, Math.max(0, hover));
        ctx.setLineDash([3, 4]); ctx.strokeStyle = "#929d9a"; ctx.beginPath(); ctx.moveTo(x(i), top); ctx.lineTo(x(i), bottom); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = "#66d8b0"; ctx.beginPath(); ctx.arc(x(i), y(data[i]), 4, 0, Math.PI * 2); ctx.fill();
      }
    };
    draw();
    const observer = new ResizeObserver(draw); observer.observe(canvas);
    return () => observer.disconnect();
  }, [range, count, hover, currency, rates]);
  return <div className={styles.chartWrap}>
    <div className={styles.chartReadout}>{hover === null ? `收盘价 · ${currency}` : `示例交易日 ${96 - count + hover + 1} · ${formatMoney(values[Math.min(hover, values.length - 1)], currency, QUOTE_CURRENCY, 2, rates)} ${currency}`}</div>
    <canvas ref={ref} role="img" aria-label={`${range} 示例股价与成交量图，期末价格 ${formatMoney(PRICE_SERIES.at(-1)!, currency, QUOTE_CURRENCY, 2, rates)} ${currency}`} onPointerLeave={() => setHover(null)} onPointerMove={e => {
      const rect = e.currentTarget.getBoundingClientRect();
      setHover(Math.min(count - 1, Math.max(0, Math.round((e.clientX - rect.left - 5) / Math.max(1, plotRight.current - 5) * (count - 1)))));
    }} />
  </div>;
}
