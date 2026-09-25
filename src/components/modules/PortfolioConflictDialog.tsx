"use client";

import { useEffect, useRef, useState } from "react";
import {
  preparePortfolioConflictReview, type PortfolioConflictChoice, type PortfolioConflictMode,
  type PortfolioConflictReview,
} from "@/lib/portfolio/portfolioConflictResolution";
import { submitPortfolioConflictResolution, type DrainPortfolioCloudSyncResult } from "@/lib/portfolio/portfolioSyncStatus";

const buttonClass = "rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:hover:bg-zinc-800";

export default function PortfolioConflictDialog({ mode, onClose, onUpdated }: {
  mode: PortfolioConflictMode;
  onClose: () => void;
  onUpdated: (result: DrainPortfolioCloudSyncResult) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [review, setReview] = useState<PortfolioConflictReview | null>(null);
  const [choices, setChoices] = useState<Record<string, PortfolioConflictChoice>>({});
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void preparePortfolioConflictReview(mode).then((next) => {
      if (!cancelled) { setReview(next); setChoices({}); }
    }).catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "读取失败，未修改数据。");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [mode, reload]);

  const readAgain = () => { setLoading(true); setReview(null); setError(null); setReload((value) => value + 1); };
  const selectAll = (side: PortfolioConflictChoice) => {
    if (review) setChoices(Object.fromEntries(review.fields.map((field) => [field.id, side])));
  };
  const remaining = review?.fields.filter((field) => !choices[field.id]).length ?? 0;

  async function confirm() {
    if (!review || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitPortfolioConflictResolution(review, choices);
      onUpdated(result);
      if (result.status === "ok") onClose();
      else setError(result.message ?? "尚未收到确认；本机内容和处理结果已保留，请重新核对差异。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "处理未完成，两个版本均已保留。");
    } finally { setSubmitting(false); }
  }

  return (
    <dialog ref={dialogRef} aria-labelledby="portfolio-conflict-title"
      onCancel={(event) => { event.preventDefault(); if (!submitting) onClose(); }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-5xl overflow-hidden rounded-lg border border-zinc-300 bg-white p-0 text-zinc-900 shadow-xl backdrop:bg-black/40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
      <div className="flex max-h-[90dvh] flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-zinc-200 p-4 dark:border-zinc-700">
          <div>
            <h2 id="portfolio-conflict-title" className="text-lg font-semibold">处理组合同步冲突</h2>
            <p className="text-xs text-zinc-500">{loading ? "正在读取云端版本…" : review ? `本机与云端均已保留 · ${review.fields.length} 项差异` : "版本读取未完成"}</p>
          </div>
          <button type="button" className={buttonClass} onClick={onClose} disabled={submitting}>关闭</button>
        </header>
        <div className="overflow-y-auto p-4">
          {error && <p role="alert" className="mb-4 break-words border-l-2 border-amber-500 pl-3 text-sm text-amber-700 dark:text-amber-300">{error}</p>}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button type="button" className={buttonClass} onClick={readAgain} disabled={loading || submitting}>重新读取差异</button>
            <button type="button" className={buttonClass} onClick={() => selectAll("local")} disabled={!review || submitting}>全部选本机</button>
            <button type="button" className={buttonClass} onClick={() => selectAll("cloud")} disabled={!review || submitting}>全部选云端</button>
            <input type="search" aria-label="筛选差异" placeholder="筛选差异" value={query} onChange={(event) => setQuery(event.target.value)}
              className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-600" />
          </div>
          {review?.fields.length === 0 && <p className="py-8 text-center text-sm text-zinc-500">内容已一致，等待云端确认。</p>}
          {review?.fields.filter((field) => field.label.toLowerCase().includes(query.toLowerCase())).map((field) => (
            <fieldset key={field.id} className="min-w-0 border-t border-zinc-200 py-4 dark:border-zinc-700" disabled={submitting}>
              <legend className="max-w-full break-words px-1 text-sm font-medium">{field.label}</legend>
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                {(["local", "cloud"] as const).map((side) => (
                  <div key={side} className="min-w-0">
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input type="radio" name={`choice-${field.id}`} value={side} checked={choices[field.id] === side}
                        onChange={() => setChoices((current) => ({ ...current, [field.id]: side }))} />
                      {side === "local" ? "保留本机" : "保留云端"}
                    </label>
                    {field.id === "report" ? (
                      <details className="mt-2 text-xs">
                        <summary className="cursor-pointer">{(side === "local" ? review.local : review.cloud).snapshot?.positions.length ?? 0} 条持仓 · 查看完整报告</summary>
                        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs">{field[side]}</pre>
                      </details>
                    ) : <p className="mt-2 whitespace-pre-wrap break-words text-sm text-zinc-600 dark:text-zinc-300">{field[side]}</p>}
                  </div>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 p-4 dark:border-zinc-700">
          <span role="status" className="text-xs text-zinc-500">{submitting ? "正在等待云端确认，本机内容尚未替换…" : remaining ? `还有 ${remaining} 项未选择` : "原始版本将保留在本机"}</span>
          <button type="button" onClick={() => void confirm()} disabled={loading || submitting || !review || remaining > 0}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">确认并同步</button>
        </footer>
      </div>
    </dialog>
  );
}
