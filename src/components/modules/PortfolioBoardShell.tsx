"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Sidebar from "@/components/sidebar/Sidebar";
import {
  buildExposures,
  parseBookTagRows,
  parsePositionRows,
  type ExposureRow,
  type PortfolioPosition,
  type PortfolioSnapshot,
  type TagMap,
} from "@/lib/portfolio/positionReport";
import {
  loadAllocation,
  loadDataUpdatedAt,
  loadLastEmailMessageId,
  loadSnapshot,
  loadTagMap,
  saveAllocation,
  saveDataUpdatedAt,
  saveLastEmailMessageId,
  saveSnapshot,
  saveTagMap,
  DEFAULT_GMV_ALLOCATION,
} from "@/lib/portfolio/portfolioStore";
import {
  clearSyncPasscode,
  loadSyncPasscode,
  pullCloudData,
  pushCloudData,
  saveSyncPasscode,
} from "@/lib/portfolio/cloudSync";

type BoardTab = "positions" | "analysis";
type SyncStatus = "off" | "syncing" | "synced" | "error";

export default function PortfolioBoardShell() {
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [tagMap, setTagMap] = useState<TagMap>({});
  const [allocation, setAllocation] = useState<number>(DEFAULT_GMV_ALLOCATION);
  const [tab, setTab] = useState<BoardTab>("positions");
  const [importError, setImportError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [aiTagging, setAiTagging] = useState(false);
  const [emailChecking, setEmailChecking] = useState(false);
  const [syncPasscode, setSyncPasscode] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("off");
  // Expanded exposure rows live here (not in ExposureTable) so they survive
  // switching between the 当前持仓 / 持仓分析 tabs.
  const [expandedTagRows, setExpandedTagRows] = useState<Set<string>>(
    () => new Set()
  );
  const [expandedCountryRows, setExpandedCountryRows] = useState<Set<string>>(
    () => new Set()
  );
  const posInputRef = useRef<HTMLInputElement>(null);
  const bookInputRef = useRef<HTMLInputElement>(null);
  const syncReadyRef = useRef(false);
  const lastPayloadRef = useRef<string | null>(null);
  const pushTimerRef = useRef<number | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setSnapshot(loadSnapshot());
      setTagMap(loadTagMap());
      setAllocation(loadAllocation());
      const code = loadSyncPasscode();
      if (code) {
        setSyncPasscode(code);
        void runInitialSync(code, false);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- cloud sync -----------------------------------------------------------
  // One cloud copy in the project's KV store, shared by every device that
  // enters the same sync passcode. Snapshots follow the newer side; tag maps
  // are always merged (union) so syncing can never wipe labels.

  const corePayload = (
    snap: PortfolioSnapshot | null,
    tags: TagMap,
    alloc: number
  ) => JSON.stringify({ snapshot: snap, tagMap: tags, allocation: alloc });

  const runInitialSync = useCallback(
    async (code: string, manual: boolean) => {
      setSyncStatus("syncing");
      const result = await pullCloudData(code);
      if (result.status === "unconfigured") {
        setSyncStatus("off");
        if (manual) {
          window.alert(
            "云端存储还没有开通。请在 Vercel 项目里：Storage → Create Database → 选 Redis（Upstash）→ 连接到 zhi-notes 项目，然后 Redeploy 一次。"
          );
        }
        return;
      }
      if (result.status === "unauthorized") {
        setSyncStatus("error");
        clearSyncPasscode();
        setSyncPasscode(null);
        window.alert("同步密码不正确：云端已有数据，请输入当初设置的同一个密码。");
        return;
      }
      if (result.status === "error") {
        setSyncStatus("error");
        return;
      }

      const cloud = result.data;
      const localUpdated = loadDataUpdatedAt();
      const localSnapshot = loadSnapshot();
      const localTags = loadTagMap();
      const localAlloc = loadAllocation();

      const cloudNewer = Boolean(
        cloud && (!localUpdated || cloud.updatedAt > localUpdated)
      );

      // Union of both tag maps; the newer side wins per-stock conflicts.
      const mergedTags: TagMap = cloudNewer
        ? { ...localTags, ...(cloud?.tagMap ?? {}) }
        : { ...(cloud?.tagMap ?? {}), ...localTags };

      const snapshotToUse =
        cloudNewer && cloud?.snapshot ? cloud.snapshot : localSnapshot;
      const allocToUse =
        cloudNewer && cloud && cloud.allocation > 0
          ? cloud.allocation
          : localAlloc;

      if (snapshotToUse) {
        saveSnapshot(snapshotToUse);
        setSnapshot(snapshotToUse);
      }
      setTagMap(mergedTags);
      saveTagMap(mergedTags);
      setAllocation(allocToUse);
      saveAllocation(allocToUse);
      if (cloud?.lastEmailMessageId) {
        saveLastEmailMessageId(cloud.lastEmailMessageId);
      }

      // Push the merged result back so the cloud copy includes everything.
      const now = new Date().toISOString();
      saveDataUpdatedAt(now);
      lastPayloadRef.current = corePayload(snapshotToUse, mergedTags, allocToUse);
      const pushed = await pushCloudData(code, {
        snapshot: snapshotToUse,
        tagMap: mergedTags,
        allocation: allocToUse,
        lastEmailMessageId: loadLastEmailMessageId(),
        updatedAt: now,
      });
      if (pushed.status === "ok" && pushed.data) {
        const serverTags = pushed.data;
        if (JSON.stringify(serverTags) !== JSON.stringify(mergedTags)) {
          lastPayloadRef.current = corePayload(
            snapshotToUse,
            serverTags,
            allocToUse
          );
          setTagMap(serverTags);
          saveTagMap(serverTags);
        }
      }
      setSyncStatus(pushed.status === "ok" ? "synced" : "error");
      syncReadyRef.current = true;
    },
    []
  );

  // Push local changes to the cloud (debounced) once initial sync completed.
  useEffect(() => {
    if (!syncPasscode || !syncReadyRef.current) return;
    const payload = corePayload(snapshot, tagMap, allocation);
    if (payload === lastPayloadRef.current) return;
    lastPayloadRef.current = payload;
    if (pushTimerRef.current) window.clearTimeout(pushTimerRef.current);
    setSyncStatus("syncing");
    pushTimerRef.current = window.setTimeout(() => {
      const now = new Date().toISOString();
      saveDataUpdatedAt(now);
      void pushCloudData(syncPasscode, {
        snapshot,
        tagMap,
        allocation,
        lastEmailMessageId: loadLastEmailMessageId(),
        updatedAt: now,
      }).then((result) => {
        if (result.status === "ok" && result.data) {
          const serverTags = result.data;
          if (JSON.stringify(serverTags) !== JSON.stringify(tagMap)) {
            lastPayloadRef.current = corePayload(
              snapshot,
              serverTags,
              allocation
            );
            setTagMap(serverTags);
            saveTagMap(serverTags);
          }
        }
        setSyncStatus(result.status === "ok" ? "synced" : "error");
      });
    }, 1500);
  }, [snapshot, tagMap, allocation, syncPasscode]);

  const handleEnableSync = useCallback(async () => {
    const code = window.prompt(
      "设置一个云同步密码（至少 6 位）。\n所有设备输入同一个密码即可共享持仓数据。请使用专门的密码，不要复用其他账号密码。"
    );
    if (!code) return;
    const trimmed = code.trim();
    if (trimmed.length < 6) {
      window.alert("密码至少需要 6 位。");
      return;
    }
    saveSyncPasscode(trimmed);
    setSyncPasscode(trimmed);
    await runInitialSync(trimmed, true);
  }, [runInitialSync]);

  const handleSyncChipClick = useCallback(() => {
    if (!syncPasscode) return;
    if (syncStatus === "error") {
      void runInitialSync(syncPasscode, true);
      return;
    }
    const off = window.confirm(
      "要在这台设备上关闭云同步吗？云端数据会保留，本机数据也保留，只是不再互相同步。"
    );
    if (off) {
      clearSyncPasscode();
      setSyncPasscode(null);
      setSyncStatus("off");
      syncReadyRef.current = false;
    }
  }, [syncPasscode, syncStatus, runInitialSync]);

  const handleAllocationChange = useCallback((value: number) => {
    if (!Number.isFinite(value) || value <= 0) return;
    setAllocation(value);
    saveAllocation(value);
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

  // ----- email auto-import ----------------------------------------------------
  // Asks the server to relay the newest "Roger Pos" attachment from the
  // configured mailbox; parsing and storage stay in this browser.

  const handleEmailCheck = useCallback(
    async (auto: boolean) => {
      if (emailChecking) return;
      setEmailChecking(true);
      try {
        const res = await fetch("/api/portfolio/email-position");
        if (res.status === 501) {
          if (!auto) {
            const go = window.confirm(
              "邮箱自动导入还没有授权。要打开授权设置页吗？（一次性设置，约 10 分钟）"
            );
            if (go) window.location.assign("/portfolio/email-setup");
          }
          return;
        }
        if (!res.ok) {
          if (!auto) {
            const data = await res.json().catch(() => null);
            setImportError(data?.error ?? "读取邮箱失败，请稍后重试。");
          }
          return;
        }
        const data: {
          found?: boolean;
          messageId?: string;
          fileName?: string;
          receivedAt?: string;
          contentBase64?: string;
        } = await res.json();
        if (!data.found || !data.messageId || !data.contentBase64) {
          if (!auto) showNotice("邮箱里最近 30 天没有找到 Roger Pos 持仓邮件。");
          return;
        }
        if (data.messageId === loadLastEmailMessageId()) {
          if (!auto) {
            showNotice(`邮箱里最新的持仓（${data.fileName}）已经导入过了。`);
          }
          return;
        }

        const bytes = Uint8Array.from(atob(data.contentBase64), (c) =>
          c.charCodeAt(0)
        );
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(bytes);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
        const result = parsePositionRows(rows, data.fileName ?? "邮件附件");
        if ("error" in result) {
          if (!auto) setImportError(`邮件附件解析失败：${result.error}`);
          return;
        }
        saveSnapshot(result.snapshot);
        setSnapshot(result.snapshot);
        saveLastEmailMessageId(data.messageId);
        showNotice(
          `已从邮箱自动导入 ${data.fileName}（${result.snapshot.positions.length} 条持仓，收件 ${formatImportTime(data.receivedAt ?? "")}），数据仅保存在本机。`
        );
      } catch (err) {
        console.error("[Zhinote] Email position check failed:", err);
        if (!auto) setImportError("检查邮箱持仓时出错，请稍后重试。");
      } finally {
        setEmailChecking(false);
      }
    },
    [emailChecking, showNotice]
  );

  // On open, quietly look for a newer position email and import it.
  useEffect(() => {
    const timer = window.setTimeout(() => void handleEmailCheck(true), 800);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
                onClick={() =>
                  syncPasscode ? handleSyncChipClick() : void handleEnableSync()
                }
                title={
                  syncPasscode
                    ? "云同步已开启，点击管理"
                    : "开启后持仓数据保存到云端，可跨设备使用"
                }
                className={`rounded-lg border px-3.5 py-2 text-sm shadow-sm transition-colors ${
                  syncStatus === "error"
                    ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
                    : syncPasscode
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                }`}
              >
                {!syncPasscode
                  ? "☁️ 开启云同步"
                  : syncStatus === "syncing"
                    ? "☁️ 同步中…"
                    : syncStatus === "error"
                      ? "☁️ 同步失败，点击重试"
                      : "☁️ 已同步"}
              </button>
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
              <button
                type="button"
                onClick={() => void handleEmailCheck(false)}
                disabled={emailChecking}
                title="从 zhinote1@outlook.com 邮箱获取最新的 Roger Pos 持仓文件"
                className="rounded-lg border border-sky-200 bg-sky-50 px-3.5 py-2 text-sm text-sky-700 shadow-sm transition-colors hover:border-sky-300 disabled:opacity-50 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300"
              >
                {emailChecking ? "检查邮箱中…" : "📧 检查邮箱持仓"}
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
              <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <AllocationCard
                  allocation={allocation}
                  onChange={handleAllocationChange}
                />
                <StatCard
                  label="Total Long GMV"
                  value={formatAllocPct(totalLongGmv, allocation)}
                  sub={formatMoney(totalLongGmv)}
                  tone="long"
                />
                <StatCard
                  label="Total Short GMV"
                  value={formatAllocPct(totalShortGmv, allocation)}
                  sub={formatMoney(totalShortGmv)}
                  tone="short"
                />
                <StatCard
                  label="NMV（净敞口）"
                  value={formatSignedAllocPct(totalNmv, allocation)}
                  sub={formatSignedMoney(totalNmv)}
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
                    allocation={allocation}
                    tagOf={tagOf}
                    knownTags={knownTags}
                    onTagChange={handleTagChange}
                  />
                  <PositionTable
                    title="Short"
                    tone="short"
                    positions={shorts}
                    subtotal={totalShortGmv}
                    allocation={allocation}
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
                      allocation={allocation}
                      expanded={expandedTagRows}
                      onExpandedChange={setExpandedTagRows}
                    />
                  )}
                  {countryExposures && (
                    <ExposureTable
                      title="按 Country"
                      icon="🌏"
                      exposures={countryExposures}
                      allocation={allocation}
                      expanded={expandedCountryRows}
                      onExpandedChange={setExpandedCountryRows}
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
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
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
      {sub && (
        <div className="mt-0.5 text-xs font-medium tabular-nums text-zinc-400">
          {sub}
        </div>
      )}
    </div>
  );
}

// GMV allocation is the denominator for all % metrics. Click the number to
// edit; the value is stored locally in the browser only.
function AllocationCard({
  allocation,
  onChange,
}: {
  allocation: number;
  onChange: (value: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const startEdit = () => {
    setDraft((allocation / 1_000_000).toFixed(1));
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    const parsed = Number(draft.replace(/[,\s]/g, ""));
    if (Number.isFinite(parsed) && parsed > 0) onChange(parsed * 1_000_000);
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-5 py-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-400">
        GMV Allocation
      </div>
      {editing ? (
        <div className="mt-1 flex items-baseline gap-1">
          <span className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">
            $
          </span>
          <input
            autoFocus
            inputMode="decimal"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setEditing(false);
            }}
            className="w-20 rounded border border-zinc-300 bg-white px-1 text-2xl font-bold tabular-nums text-zinc-800 outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <span className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">
            M
          </span>
        </div>
      ) : (
        <button
          type="button"
          onClick={startEdit}
          title="点击修改 GMV allocation"
          className="mt-1 rounded text-2xl font-bold tabular-nums text-zinc-800 transition-colors hover:text-zinc-500 dark:text-zinc-100 dark:hover:text-zinc-300"
        >
          {formatMoney(allocation)}
        </button>
      )}
      <div className="mt-0.5 text-xs text-zinc-400">所有 % 的分母</div>
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

// Column sort accessors. Numbers sort numerically; strings sort with
// localeCompare. First header click sorts high→low, second low→high.
const POSITION_SORT_ACCESSORS = {
  ticker: (p: PortfolioPosition) => p.key,
  name: (p: PortfolioPosition) => p.name,
  size: (p: PortfolioPosition) => Math.abs(p.nmv),
  pnlDaily: (p: PortfolioPosition) => p.pnlDaily,
  pnlMtd: (p: PortfolioPosition) => p.pnlMtd,
  pnlYtd: (p: PortfolioPosition) => p.pnlYtd,
  pnlItd: (p: PortfolioPosition) => p.pnlItd,
  change1d: (p: PortfolioPosition) => p.priceChange1dPct,
  country: (p: PortfolioPosition) => p.country,
} as const;

type PositionSortKey = keyof typeof POSITION_SORT_ACCESSORS | "tag";

function PositionTable({
  title,
  tone,
  positions,
  subtotal,
  allocation,
  tagOf,
  knownTags,
  onTagChange,
}: {
  title: string;
  tone: "long" | "short";
  positions: PortfolioPosition[];
  subtotal: number;
  allocation: number;
  tagOf: (position: PortfolioPosition) => string;
  knownTags: string[];
  onTagChange: (key: string, tag: string) => void;
}) {
  const toneBar = tone === "long" ? "bg-emerald-500" : "bg-rose-500";
  const toneText =
    tone === "long"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-rose-600 dark:text-rose-400";

  const [sortKey, setSortKey] = useState<PositionSortKey | null>(null);
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const handleSort = (key: PositionSortKey) => {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sorted = useMemo(() => {
    if (!sortKey) return positions;
    const accessor =
      sortKey === "tag"
        ? tagOf
        : POSITION_SORT_ACCESSORS[sortKey];
    const flip = sortDir === "desc" ? -1 : 1;
    return [...positions].sort((a, b) => {
      const va = accessor(a);
      const vb = accessor(b);
      const cmp =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb));
      return cmp * flip;
    });
  }, [positions, sortKey, sortDir, tagOf]);

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
          Total {title} GMV：{formatAllocPct(subtotal, allocation)}
          <span className="ml-1.5 font-medium opacity-70">
            ({formatMoney(subtotal)})
          </span>
        </div>
      </div>
      {positions.length === 0 ? (
        <p className="px-4 py-6 text-sm text-zinc-400">没有 {title} 持仓。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left text-[11px] uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
                <SortableTh
                  label="Ticker"
                  sortKey="ticker"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                  className="px-4 py-2"
                />
                <SortableTh
                  label="名称"
                  sortKey="name"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                />
                <SortableTh
                  label="% Alloc"
                  sortKey="size"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                  align="right"
                />
                <SortableTh
                  label="仓位 ($)"
                  sortKey="size"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                  align="right"
                />
                <SortableTh
                  label="Daily PnL"
                  sortKey="pnlDaily"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                  align="right"
                />
                <SortableTh
                  label="MTD PnL"
                  sortKey="pnlMtd"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                  align="right"
                />
                <SortableTh
                  label="YTD PnL"
                  sortKey="pnlYtd"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                  align="right"
                />
                <SortableTh
                  label="ITD PnL"
                  sortKey="pnlItd"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                  align="right"
                />
                <SortableTh
                  label="1D %"
                  sortKey="change1d"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                  align="right"
                />
                <SortableTh
                  label="Country"
                  sortKey="country"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                />
                <SortableTh
                  label="Tag"
                  sortKey="tag"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                />
              </tr>
            </thead>
            <tbody>
              {sorted.map((position) => (
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
                    {formatAllocPct(Math.abs(position.nmv), allocation)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
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

function SortableTh<K extends string>({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  align,
  className,
}: {
  label: string;
  sortKey: K;
  activeKey: K | null;
  dir: "desc" | "asc";
  onSort: (key: K) => void;
  align?: "right";
  className?: string;
}) {
  const active = activeKey === sortKey;
  return (
    <th
      className={`${className ?? "px-3 py-2"} font-medium ${
        align === "right" ? "text-right" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        title="点击排序"
        className={`inline-flex items-center gap-0.5 uppercase tracking-wide transition-colors hover:text-zinc-700 dark:hover:text-zinc-200 ${
          active ? "text-zinc-700 dark:text-zinc-200" : ""
        }`}
      >
        {label}
        <span className="w-3 text-[9px]">
          {active ? (dir === "desc" ? "▼" : "▲") : ""}
        </span>
      </button>
    </th>
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

type ExposureSortKey = "label" | "long" | "short" | "net" | "gross";

function ExposureTable({
  title,
  icon,
  exposures,
  allocation,
  expanded,
  onExpandedChange,
}: {
  title: string;
  icon: string;
  allocation: number;
  exposures: {
    rows: ExposureRow[];
    totalGross: number;
  };
  expanded: Set<string>;
  onExpandedChange: (next: Set<string>) => void;
}) {
  const { rows } = exposures;
  const totalLong = rows.reduce((sum, row) => sum + row.long, 0);
  const totalShort = rows.reduce((sum, row) => sum + row.short, 0);
  const maxGross = rows.reduce((max, row) => Math.max(max, row.gross), 0);

  const [sortKey, setSortKey] = useState<ExposureSortKey | null>(null);
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const handleSort = (key: ExposureSortKey) => {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const flip = sortDir === "desc" ? -1 : 1;
    return [...rows].sort((a, b) => {
      const cmp =
        sortKey === "label"
          ? a.label.localeCompare(b.label)
          : a[sortKey] - b[sortKey];
      return cmp * flip;
    });
  }, [rows, sortKey, sortDir]);

  const toggle = (label: string) => {
    const next = new Set(expanded);
    if (next.has(label)) next.delete(label);
    else next.add(label);
    onExpandedChange(next);
  };

  // Divider class between the % group and $ group
  const divCls =
    "border-l border-zinc-200 dark:border-zinc-700";

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
            {/* Group header row */}
            <tr className="text-[10px] uppercase tracking-widest text-zinc-300 dark:text-zinc-600">
              <th />
              <th
                colSpan={4}
                className="border-b border-zinc-100 px-3 pb-0.5 pt-2 text-center font-medium dark:border-zinc-800"
              >
                % of Allocation
              </th>
              <th
                colSpan={4}
                className={`border-b border-zinc-100 px-3 pb-0.5 pt-2 text-center font-medium dark:border-zinc-800 ${divCls}`}
              >
                Dollar
              </th>
              <th />
            </tr>
            {/* Column header row */}
            <tr className="border-b border-zinc-100 text-left text-[11px] uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
              <SortableTh
                label={title.replace("按 ", "")}
                sortKey="label"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                className="px-4 py-2"
              />
              <SortableTh
                label="Long"
                sortKey="long"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                align="right"
              />
              <SortableTh
                label="Short"
                sortKey="short"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                align="right"
              />
              <SortableTh
                label="Net"
                sortKey="net"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                align="right"
              />
              <SortableTh
                label="Gross"
                sortKey="gross"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                align="right"
              />
              <SortableTh
                label="Long"
                sortKey="long"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                align="right"
                className={`px-3 py-2 ${divCls}`}
              />
              <SortableTh
                label="Short"
                sortKey="short"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                align="right"
              />
              <SortableTh
                label="Net"
                sortKey="net"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                align="right"
              />
              <SortableTh
                label="Gross"
                sortKey="gross"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                align="right"
              />
              <th className="w-[14%] px-3 py-2 font-medium">L / S</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => {
              const barScale = maxGross > 0 ? row.gross / maxGross : 0;
              const longShare = row.gross > 0 ? row.long / row.gross : 0;
              const isOpen = expanded.has(row.label);
              const sorted = isOpen
                ? [...row.positions].sort((a, b) => {
                    const aLong = a.nmv >= 0;
                    const bLong = b.nmv >= 0;
                    if (aLong !== bLong) return aLong ? -1 : 1;
                    return Math.abs(b.nmv) - Math.abs(a.nmv);
                  })
                : [];
              return (
                <Fragment key={row.label}>
                  <tr
                    onClick={() => toggle(row.label)}
                    className="cursor-pointer border-b border-zinc-50 transition-colors last:border-0 hover:bg-zinc-50/80 dark:border-zinc-800/50 dark:hover:bg-zinc-800/40"
                  >
                    <td className="px-4 py-2 font-medium text-zinc-800 dark:text-zinc-100">
                      <span className="mr-1.5 inline-block w-3 text-[10px] text-zinc-400">
                        {isOpen ? "▼" : "▶"}
                      </span>
                      {row.label}
                      <span className="ml-1.5 text-[11px] font-normal text-zinc-400">
                        ({row.positions.length})
                      </span>
                    </td>
                    {/* — % group — */}
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatAllocPct(row.long, allocation)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-rose-600 dark:text-rose-400">
                      {formatAllocPct(row.short, allocation)}
                    </td>
                    <td
                      className={`whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums ${pnlColor(row.net)}`}
                    >
                      {formatSignedAllocPct(row.net, allocation)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-700 dark:text-zinc-200">
                      {formatAllocPct(row.gross, allocation)}
                    </td>
                    {/* — $ group — */}
                    <td className={`whitespace-nowrap px-3 py-2 text-right tabular-nums text-emerald-600/70 dark:text-emerald-400/70 ${divCls}`}>
                      {formatMoney(row.long)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-rose-600/70 dark:text-rose-400/70">
                      {formatMoney(row.short)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                      {formatSignedMoney(row.net)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                      {formatMoney(row.gross)}
                    </td>
                    <td className="px-3 py-2">
                      <div
                        className="flex h-2.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
                        style={{ width: `${Math.max(barScale * 100, 4)}%` }}
                        title={`Long ${formatAllocPct(row.long, allocation)} / Short ${formatAllocPct(row.short, allocation)}`}
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
                  {isOpen &&
                    sorted.map((p, i) => (
                      <tr
                        key={p.key}
                        className={`border-b border-zinc-50/50 bg-zinc-50/50 dark:border-zinc-800/30 dark:bg-zinc-800/20 ${
                          i > 0 && p.nmv < 0 && sorted[i - 1].nmv >= 0
                            ? "border-t border-t-zinc-200 dark:border-t-zinc-700"
                            : ""
                        }`}
                      >
                        <td
                          className={`py-1.5 pl-10 pr-3 font-mono text-xs ${
                            p.nmv >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {p.ticker}
                          <span className="ml-1.5 font-sans opacity-80">
                            {p.name}
                          </span>
                        </td>
                        {/* — % group — */}
                        <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-xs text-emerald-600 dark:text-emerald-400">
                          {p.nmv >= 0
                            ? formatAllocPct(p.nmv, allocation)
                            : ""}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-xs text-rose-600 dark:text-rose-400">
                          {p.nmv < 0
                            ? formatAllocPct(-p.nmv, allocation)
                            : ""}
                        </td>
                        <td
                          className={`whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-xs ${pnlColor(p.nmv)}`}
                        >
                          {formatSignedAllocPct(p.nmv, allocation)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-xs text-zinc-700 dark:text-zinc-200">
                          {formatAllocPct(Math.abs(p.nmv), allocation)}
                        </td>
                        {/* — $ group — */}
                        <td className={`whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-xs text-emerald-600/70 dark:text-emerald-400/70 ${divCls}`}>
                          {p.nmv >= 0 ? formatMoney(p.nmv) : ""}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-xs text-rose-600/70 dark:text-rose-400/70">
                          {p.nmv < 0 ? formatMoney(-p.nmv) : ""}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-xs text-zinc-500 dark:text-zinc-400">
                          {formatSignedMoney(p.nmv)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-xs text-zinc-500 dark:text-zinc-400">
                          {formatMoney(Math.abs(p.nmv))}
                        </td>
                        <td className="px-3 py-1.5">
                          <div
                            className={`h-1.5 rounded-full ${
                              p.nmv >= 0 ? "bg-emerald-500" : "bg-rose-500"
                            }`}
                            style={{
                              width: `${Math.max(
                                maxGross > 0
                                  ? (Math.abs(p.nmv) / maxGross) * 100
                                  : 0,
                                2
                              )}%`,
                            }}
                            title={`${p.nmv >= 0 ? "Long" : "Short"} ${formatAllocPct(Math.abs(p.nmv), allocation)}`}
                          />
                        </td>
                      </tr>
                    ))}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-zinc-200 bg-zinc-50/60 font-medium dark:border-zinc-700 dark:bg-zinc-800/40">
              <td className="px-4 py-2 text-zinc-700 dark:text-zinc-200">
                Total
              </td>
              {/* — % group — */}
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatAllocPct(totalLong, allocation)}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-rose-600 dark:text-rose-400">
                {formatAllocPct(totalShort, allocation)}
              </td>
              <td
                className={`whitespace-nowrap px-3 py-2 text-right tabular-nums ${pnlColor(totalLong - totalShort)}`}
              >
                {formatSignedAllocPct(totalLong - totalShort, allocation)}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-700 dark:text-zinc-200">
                {formatAllocPct(totalLong + totalShort, allocation)}
              </td>
              {/* — $ group — */}
              <td className={`whitespace-nowrap px-3 py-2 text-right tabular-nums text-emerald-600/70 dark:text-emerald-400/70 ${divCls}`}>
                {formatMoney(totalLong)}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-rose-600/70 dark:text-rose-400/70">
                {formatMoney(totalShort)}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                {formatSignedMoney(totalLong - totalShort)}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                {formatMoney(totalLong + totalShort)}
              </td>
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

function formatAllocPct(value: number, allocation: number): string {
  if (allocation <= 0) return "—";
  return `${((value / allocation) * 100).toFixed(1)}%`;
}

function formatSignedAllocPct(value: number, allocation: number): string {
  if (allocation <= 0) return "—";
  const pct = (value / allocation) * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
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
