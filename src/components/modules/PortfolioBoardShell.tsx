"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "@/components/sidebar/Sidebar";
import {
  buildExposures,
  parseBookTagRows,
  parsePositionRows,
  type PortfolioPosition,
  type PortfolioSnapshot,
  type TagMap,
} from "@/lib/portfolio/positionReport";
import {
  loadSnapshot,
  loadTagMap,
  saveSnapshot,
  saveTagMap,
} from "@/lib/portfolio/portfolioStore";

type BoardTab = "positions" | "analysis";

export default function PortfolioBoardShell() {
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [tagMap, setTagMap] = useState<TagMap>({});
  const [tab, setTab] = useState<BoardTab>("positions");
  const [importError, setImportError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [aiTagging, setAiTagging] = useState(false);
  const posInputRef = useRef<HTMLInputElement>(null);
  const bookInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setSnapshot(loadSnapshot());
      setTagMap(loadTagMap());
    });
  }, []);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 4000);
  }, []);

  // ----- file imports (browser-local parsing; nothing leaves the device) ----

  const handleImportPositions = useCallback(
    async (file: File) => {
      setImportError(null);
      try {
        const XLSX = await import("xlsx");
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
        const result = parsePositionRows(rows, file.name);
        if ("error" in result) {
          setImportError(result.error);
          return;
        }
        saveSnapshot(result.snapshot);
        setSnapshot(result.snapshot);
        showNotice(
          `已导入 ${result.snapshot.positions.length} 条持仓（仅保存在本机浏览器）`
        );
      } catch (err) {
        console.error("[Zhinote] Failed to import position report:", err);
        setImportError("文件解析失败，请确认是 .xls / .xlsx 持仓报告。");
      }
    },
    [showNotice]
  );

  const handleImportBookTags = useCallback(
    async (file: File) => {
      setImportError(null);
      try {
        const XLSX = await import("xlsx");
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer);
        const sheets = workbook.SheetNames.map((name) => ({
          name,
          rows: XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], {
            header: 1,
          }),
        }));
        const imported = parseBookTagRows(sheets);
        const count = Object.keys(imported).length;
        if (count === 0) {
          setImportError(
            "没有在文件里找到 Ticker → Tags 映射（需要 Tags 列）。"
          );
          return;
        }
        // Imported book tags fill gaps but never overwrite manual edits.
        const merged = { ...imported, ...tagMap };
        saveTagMap(merged);
        setTagMap(merged);
        showNotice(`已从 Book 导入 ${count} 个标签映射`);
      } catch (err) {
        console.error("[Zhinote] Failed to import book tags:", err);
        setImportError("Book 文件解析失败，请确认格式。");
      }
    },
    [tagMap, showNotice]
  );

  // ----- tags ---------------------------------------------------------------

  const tagOf = useCallback(
    (position: PortfolioPosition) => tagMap[position.key] ?? "",
    [tagMap]
  );

  const knownTags = useMemo(() => {
    const set = new Set<string>();
    for (const tag of Object.values(tagMap)) if (tag) set.add(tag);
    return [...set].sort();
  }, [tagMap]);

  const handleTagChange = useCallback((key: string, tag: string) => {
    setTagMap((current) => {
      const next = { ...current };
      if (tag.trim()) next[key] = tag.trim();
      else delete next[key];
      saveTagMap(next);
      return next;
    });
  }, []);

  const untagged = useMemo(
    () =>
      snapshot
        ? snapshot.positions.filter((position) => !tagMap[position.key])
        : [],
    [snapshot, tagMap]
  );

  const handleAiTag = useCallback(async () => {
    if (!snapshot || untagged.length === 0 || aiTagging) return;
    const ok = window.confirm(
      `将把 ${untagged.length} 只未打标股票的代码和名称发送给 Claude AI 来按主营业务分配标签（不发送仓位金额或 PnL）。确认继续？`
    );
    if (!ok) return;
    setAiTagging(true);
    try {
      const res = await fetch("/api/ai/suggest-position-tags", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          stocks: untagged.map((p) => ({ key: p.key, name: p.name })),
          availableTags: knownTags,
        }),
      });
      if (res.status === 501) {
        window.alert(
          "AI 功能尚未配置。请在 Vercel 项目设置中添加 ANTHROPIC_API_KEY。"
        );
        return;
      }
      if (!res.ok) {
        window.alert("AI 打标失败，请稍后重试。");
        return;
      }
      const data: { tags?: Record<string, string> } = await res.json();
      const suggested = data.tags ?? {};
      const count = Object.keys(suggested).length;
      if (count === 0) {
        window.alert("AI 没有返回任何标签建议。");
        return;
      }
      setTagMap((current) => {
        const next = { ...current, ...suggested };
        saveTagMap(next);
        return next;
      });
      showNotice(`AI 已为 ${count} 只股票分配标签，可随时手动修改`);
    } catch {
      window.alert("AI 打标出错，请检查网络。");
    } finally {
      setAiTagging(false);
    }
  }, [snapshot, untagged, knownTags, aiTagging, showNotice]);

  // ----- derived numbers ------------------------------------------------------

  const longs = useMemo(
    () =>
      snapshot
        ? snapshot.positions
            .filter((p) => p.nmv >= 0)
            .sort((a, b) => b.nmv - a.nmv)
        : [],
    [snapshot]
  );
  const shorts = useMemo(
    () =>
      snapshot
        ? snapshot.positions
            .filter((p) => p.nmv < 0)
            .sort((a, b) => a.nmv - b.nmv)
        : [],
    [snapshot]
  );

  const totalLongGmv = useMemo(
    () => longs.reduce((sum, p) => sum + p.nmv, 0),
    [longs]
  );
  const totalShortGmv = useMemo(
    () => shorts.reduce((sum, p) => sum + -p.nmv, 0),
    [shorts]
  );
  const totalNmv = totalLongGmv - totalShortGmv;

  const tagExposures = useMemo(
    () =>
      snapshot
        ? buildExposures(snapshot.positions, (p) => tagMap[p.key] || "未分类")
        : null,
    [snapshot, tagMap]
  );
  const countryExposures = useMemo(
    () =>
      snapshot ? buildExposures(snapshot.positions, (p) => p.country) : null,
    [snapshot]
  );

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-zinc-50/40 dark:bg-zinc-950">
        <div className="mx-auto max-w-6xl px-8 py-10">
          {/* Header */}
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="flex items-center gap-2.5 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                <span className="text-3xl">💼</span> 组合管理
              </h1>
              <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                每日导入持仓报告，实时监控组合。数据只保存在本机浏览器，不上传。
              </p>
              {snapshot && (
                <p className="mt-1 text-xs text-zinc-400">
                  最近导入：{formatImportTime(snapshot.importedAt)} ·{" "}
                  {snapshot.sourceName} · {snapshot.positions.length} 条持仓
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={posInputRef}
                type="file"
                accept=".xls,.xlsx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void handleImportPositions(file);
                }}
              />
              <input
                ref={bookInputRef}
                type="file"
                accept=".xls,.xlsx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void handleImportBookTags(file);
                }}
              />
              <button
                type="button"
                onClick={() => posInputRef.current?.click()}
                className="rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-zinc-700 active:scale-95 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                导入持仓报告
              </button>
              <button
                type="button"
                onClick={() => bookInputRef.current?.click()}
                className="rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm text-zinc-600 shadow-sm transition-colors hover:border-zinc-400 hover:text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
              >
                导入 Book 标签
              </button>
              {untagged.length > 0 && (
                <button
                  type="button"
                  onClick={() => void handleAiTag()}
                  disabled={aiTagging}
                  className="rounded-lg border border-violet-200 bg-violet-50 px-3.5 py-2 text-sm text-violet-700 shadow-sm transition-colors hover:border-violet-300 disabled:opacity-50 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-300"
                >
                  {aiTagging
                    ? "AI 打标中…"
                    : `✨ AI 打标（${untagged.length} 只未分类）`}
                </button>
              )}
            </div>
          </div>

          {importError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
              {importError}
            </div>
          )}
          {notice && (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
              {notice}
            </div>
          )}

          {!snapshot ? (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-white py-20 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
              <div className="mb-3 text-4xl">📊</div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                还没有持仓数据。点右上角「导入持仓报告」选择每日的 Roger Pos
                文件。
              </p>
              <p className="mt-1.5 text-xs text-zinc-400">
                文件在浏览器本地解析，持仓数据不会上传到任何服务器。
              </p>
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatCard
                  label="Total Long GMV"
                  value={formatMoney(totalLongGmv)}
                  tone="long"
                />
                <StatCard
                  label="Total Short GMV"
                  value={formatMoney(totalShortGmv)}
                  tone="short"
                />
                <StatCard
                  label="NMV（净敞口）"
                  value={formatSignedMoney(totalNmv)}
                  tone={totalNmv >= 0 ? "long" : "short"}
                />
              </div>

              {/* Tabs */}
              <div className="mb-4 flex items-center gap-1 border-b border-zinc-200 dark:border-zinc-800">
                <TabButton
                  active={tab === "positions"}
                  onClick={() => setTab("positions")}
                >
                  当前持仓
                </TabButton>
                <TabButton
                  active={tab === "analysis"}
                  onClick={() => setTab("analysis")}
                >
                  持仓分析
                </TabButton>
              </div>

              {tab === "positions" ? (
                <div className="space-y-8">
                  <PositionTable
                    title="Long"
                    tone="long"
                    positions={longs}
                    subtotal={totalLongGmv}
                    tagOf={tagOf}
                    knownTags={knownTags}
                    onTagChange={handleTagChange}
                  />
                  <PositionTable
                    title="Short"
                    tone="short"
                    positions={shorts}
                    subtotal={totalShortGmv}
                    tagOf={tagOf}
                    knownTags={knownTags}
                    onTagChange={handleTagChange}
                  />
                </div>
              ) : (
                <div className="space-y-8">
                  {tagExposures && (
                    <ExposureTable
                      title="按 Tag"
                      icon="🏷️"
                      exposures={tagExposures}
                    />
                  )}
                  {countryExposures && (
                    <ExposureTable
                      title="按 Country"
                      icon="🌏"
                      exposures={countryExposures}
                    />
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

// ----- presentational pieces ---------------------------------------------------

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "long" | "short";
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-5 py-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-400">
        {label}
      </div>
      <div
        className={`mt-1 text-2xl font-bold tabular-nums ${
          tone === "long"
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-rose-600 dark:text-rose-400"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
          : "border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
      }`}
    >
      {children}
    </button>
  );
}

function PositionTable({
  title,
  tone,
  positions,
  subtotal,
  tagOf,
  knownTags,
  onTagChange,
}: {
  title: string;
  tone: "long" | "short";
  positions: PortfolioPosition[];
  subtotal: number;
  tagOf: (position: PortfolioPosition) => string;
  knownTags: string[];
  onTagChange: (key: string, tag: string) => void;
}) {
  const toneBar = tone === "long" ? "bg-emerald-500" : "bg-rose-500";
  const toneText =
    tone === "long"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-rose-600 dark:text-rose-400";

  return (
    <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${toneBar}`} />
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            {title}
          </h2>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            {positions.length} 只
          </span>
        </div>
        <div className={`text-sm font-bold tabular-nums ${toneText}`}>
          Total {title} GMV：{formatMoney(subtotal)}
        </div>
      </div>
      {positions.length === 0 ? (
        <p className="px-4 py-6 text-sm text-zinc-400">没有 {title} 持仓。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left text-[11px] uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
                <th className="px-4 py-2 font-medium">Ticker</th>
                <th className="px-3 py-2 font-medium">名称</th>
                <th className="px-3 py-2 text-right font-medium">仓位 ($)</th>
                <th className="px-3 py-2 text-right font-medium">Daily PnL</th>
                <th className="px-3 py-2 text-right font-medium">MTD PnL</th>
                <th className="px-3 py-2 text-right font-medium">YTD PnL</th>
                <th className="px-3 py-2 text-right font-medium">ITD PnL</th>
                <th className="px-3 py-2 text-right font-medium">1D %</th>
                <th className="px-3 py-2 font-medium">Country</th>
                <th className="px-3 py-2 font-medium">Tag</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((position) => (
                <tr
                  key={position.key}
                  className="border-b border-zinc-50 transition-colors last:border-0 hover:bg-zinc-50/80 dark:border-zinc-800/50 dark:hover:bg-zinc-800/40"
                >
                  <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                    {position.key}
                  </td>
                  <td className="max-w-44 truncate px-3 py-2 text-zinc-800 dark:text-zinc-100">
                    {position.name}
                  </td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums text-zinc-800 dark:text-zinc-100">
                    {formatMoney(Math.abs(position.nmv))}
                  </td>
                  <PnlCell value={position.pnlDaily} />
                  <PnlCell value={position.pnlMtd} />
                  <PnlCell value={position.pnlYtd} />
                  <PnlCell value={position.pnlItd} />
                  <td
                    className={`px-3 py-2 text-right tabular-nums ${pnlColor(position.priceChange1dPct)}`}
                  >
                    {formatPct(position.priceChange1dPct)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">
                    {position.country}
                  </td>
                  <td className="px-3 py-2">
                    <TagEditor
                      value={tagOf(position)}
                      knownTags={knownTags}
                      onChange={(tag) => onTagChange(position.key, tag)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function PnlCell({ value }: { value: number }) {
  return (
    <td className={`px-3 py-2 text-right tabular-nums ${pnlColor(value)}`}>
      {formatSignedMoney(value)}
    </td>
  );
}

function TagEditor({
  value,
  knownTags,
  onChange,
}: {
  value: string;
  knownTags: string[];
  onChange: (tag: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    queueMicrotask(() => setDraft(value));
  }, [value]);

  const commit = () => {
    setEditing(false);
    if (draft.trim() !== value) onChange(draft);
  };

  if (editing) {
    return (
      <span>
        <input
          autoFocus
          list="zhinote-portfolio-tags"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft(value);
              setEditing(false);
            }
          }}
          className="w-28 rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-xs text-zinc-800 outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <datalist id="zhinote-portfolio-tags">
          {knownTags.map((tag) => (
            <option key={tag} value={tag} />
          ))}
        </datalist>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs transition-colors ${
        value
          ? "bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-950"
          : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-700"
      }`}
      title="点击修改标签"
    >
      {value || "未分类"}
    </button>
  );
}

function ExposureTable({
  title,
  icon,
  exposures,
}: {
  title: string;
  icon: string;
  exposures: {
    rows: {
      label: string;
      long: number;
      short: number;
      net: number;
      gross: number;
    }[];
    totalGross: number;
  };
}) {
  const { rows, totalGross } = exposures;
  const totalLong = rows.reduce((sum, row) => sum + row.long, 0);
  const totalShort = rows.reduce((sum, row) => sum + row.short, 0);
  const maxGross = rows.length > 0 ? rows[0].gross : 0;

  return (
    <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <span>{icon}</span>
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
          {title}
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 text-left text-[11px] uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
              <th className="px-4 py-2 font-medium">
                {title.replace("按 ", "")}
              </th>
              <th className="px-3 py-2 text-right font-medium">Long</th>
              <th className="px-3 py-2 text-right font-medium">Short</th>
              <th className="px-3 py-2 text-right font-medium">Net</th>
              <th className="px-3 py-2 text-right font-medium">Total</th>
              <th className="px-3 py-2 text-right font-medium">Total %</th>
              <th className="w-1/4 px-3 py-2 font-medium">L / S</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const barScale = maxGross > 0 ? row.gross / maxGross : 0;
              const longShare = row.gross > 0 ? row.long / row.gross : 0;
              return (
                <tr
                  key={row.label}
                  className="border-b border-zinc-50 transition-colors last:border-0 hover:bg-zinc-50/80 dark:border-zinc-800/50 dark:hover:bg-zinc-800/40"
                >
                  <td className="px-4 py-2 font-medium text-zinc-800 dark:text-zinc-100">
                    {row.label}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatMoney(row.long)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-rose-600 dark:text-rose-400">
                    {formatMoney(row.short)}
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-medium tabular-nums ${pnlColor(row.net)}`}
                  >
                    {formatSignedMoney(row.net)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-700 dark:text-zinc-200">
                    {formatMoney(row.gross)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                    {totalGross > 0
                      ? `${((row.gross / totalGross) * 100).toFixed(1)}%`
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div
                      className="flex h-2.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
                      style={{ width: `${Math.max(barScale * 100, 4)}%` }}
                      title={`Long ${formatMoney(row.long)} / Short ${formatMoney(row.short)}`}
                    >
                      <div
                        className="bg-emerald-500"
                        style={{ width: `${longShare * 100}%` }}
                      />
                      <div
                        className="bg-rose-500"
                        style={{ width: `${(1 - longShare) * 100}%` }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-zinc-200 bg-zinc-50/60 font-medium dark:border-zinc-700 dark:bg-zinc-800/40">
              <td className="px-4 py-2 text-zinc-700 dark:text-zinc-200">
                Total
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatMoney(totalLong)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-rose-600 dark:text-rose-400">
                {formatMoney(totalShort)}
              </td>
              <td
                className={`px-3 py-2 text-right tabular-nums ${pnlColor(totalLong - totalShort)}`}
              >
                {formatSignedMoney(totalLong - totalShort)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-zinc-700 dark:text-zinc-200">
                {formatMoney(totalGross)}
              </td>
              <td className="px-3 py-2 text-right text-zinc-500">100%</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

// ----- formatting ----------------------------------------------------------------

function formatMoney(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  return `$${value.toFixed(0)}`;
}

function formatSignedMoney(value: number): string {
  const formatted = formatMoney(Math.abs(value));
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
}

function formatPct(value: number): string {
  if (value === 0) return "0.0%";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function pnlColor(value: number): string {
  if (value > 0) return "text-emerald-600 dark:text-emerald-400";
  if (value < 0) return "text-rose-600 dark:text-rose-400";
  return "text-zinc-400";
}

function formatImportTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}
