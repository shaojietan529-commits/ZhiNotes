"use client";

import { useMemo, useRef, useState, type ChangeEvent } from "react";
import PagePeekModal, {
  warmPagePeekModal,
} from "@/components/page/LazyPagePeekModal";
import { useLocalFirstDatabaseNavigation } from "@/hooks/useLocalFirstDatabaseNavigation";
import { useLocalFirstPageNavigation } from "@/hooks/useLocalFirstPageNavigation";
import { usePages } from "@/hooks/usePages";
import {
  buildPageImportPlan,
  buildExportablePageImportManifest,
  buildPageImportRetryPlan,
  type PageImportLaneId,
  type PageImportPlan,
  type PageImportPreviewRoute,
  type PageImportSourceFile,
} from "@/lib/files/pageImportPlan";
import {
  executePageImportPlan,
  countExecutableItems,
  type PageImportExecutionResult,
  type PageImportFailureMode,
  type PageImportItemExecutionResult,
  type PageImportItemExecutionStatus,
} from "@/lib/files/pageImportExecutor";
import {
  appendPageImportExecutionReceipt,
  buildPageImportExecutionReceipt,
  type PageImportExecutionReceipt,
} from "@/lib/files/pageImportReceipts";
import { rememberPendingPageDraft } from "@/lib/pages/pendingPageDrafts";
import { rememberPageRouteHandoff } from "@/lib/pages/pageRouteHandoff";
import type { Page } from "@/lib/utils/types";

const LANE_BADGE: Record<
  PageImportLaneId,
  { label: string; className: string }
> = {
  "page-import": {
    label: "导入为页面",
    className:
      "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  },
  "database-import": {
    label: "导入为数据库",
    className:
      "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  },
  "local-retain": {
    label: "本地留存",
    className:
      "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  },
  "blocked-review": {
    label: "阻塞复核",
    className:
      "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  },
};

const PREVIEW_ROUTE_BADGE: Record<
  PageImportPreviewRoute,
  { label: string; className: string }
> = {
  "editable-page-body": {
    label: "可编辑正文",
    className:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  },
  "file-page-native-preview": {
    label: "文件页原生预览",
    className:
      "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  },
  "file-page-converted-preview": {
    label: "文件页转换预览",
    className:
      "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  },
  "database-mapping": {
    label: "数据库列映射",
    className:
      "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  },
  "local-metadata-review": {
    label: "本地元数据复核",
    className:
      "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  },
  "blocked-owner-review": {
    label: "需人工复核",
    className:
      "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  },
};

const ITEM_STATUS_BADGE: Record<
  PageImportItemExecutionStatus,
  { label: string; className: string }
> = {
  completed: {
    label: "完成",
    className:
      "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200",
  },
  skipped: {
    label: "跳过",
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200",
  },
  failed: {
    label: "失败",
    className: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200",
  },
  "rolled-back": {
    label: "已回退",
    className:
      "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
  },
  "not-run": {
    label: "未执行",
    className:
      "bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400",
  },
};

const ITEM_ACTION_LABEL: Record<PageImportItemExecutionResult["action"], string> =
  {
    "created-editable-page": "创建可编辑页",
    "created-html-preview-page": "创建 HTML 预览页",
    "created-local-preview-page": "创建本地预览页",
    "created-database": "创建数据库",
    "skipped-owner-review": "等待人工复核",
    "skipped-missing-file": "文件未找到",
    "skipped-database-kind-mismatch": "数据库类型不匹配",
    "failed-during-import": "导入时报错",
    "not-run": "未执行",
  };

type ImportProgressStatus =
  | "idle"
  | "running"
  | "completed"
  | "partially-completed"
  | "rolled-back";

interface ImportProgressState {
  done: number;
  total: number;
  status: ImportProgressStatus;
  message: string;
}

const EMPTY_IMPORT_PROGRESS: ImportProgressState = {
  done: 0,
  total: 0,
  status: "idle",
  message: "",
};

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024))
  );
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function downloadJson(fileName: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Files-module panel that turns a batch of user-selected files into a
 * metadata-only import plan: per-file routing, target list, rollback step
 * count, required confirmation gates, and an exportable manifest that omits
 * file names. This stage previews the plan only — it does not read file
 * bytes, create pages/databases, upload, or call AI.
 */
export default function PageImportPlanPanel() {
  const openDatabase = useLocalFirstDatabaseNavigation();
  const openPage = useLocalFirstPageNavigation();
  const { upsertPages } = usePages({ autoLoad: false });
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [plan, setPlan] = useState<PageImportPlan | null>(null);
  const [activeImportPlan, setActiveImportPlan] = useState<PageImportPlan | null>(
    null
  );
  const [files, setFiles] = useState<File[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [failureMode, setFailureMode] =
    useState<PageImportFailureMode>("keep-successful");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<PageImportExecutionResult | null>(null);
  const [lastReceipt, setLastReceipt] =
    useState<PageImportExecutionReceipt | null>(null);
  const [importProgress, setImportProgress] = useState<ImportProgressState>(
    EMPTY_IMPORT_PROGRESS
  );
  const [selectedRetryItemIndexes, setSelectedRetryItemIndexes] = useState<
    number[]
  >([]);
  const [peekPageId, setPeekPageId] = useState<string | null>(null);
  const [peekInitialPage, setPeekInitialPage] = useState<Page | null>(null);

  const handleChoose = () => inputRef.current?.click();

  const handleFilesSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;
    const selected = Array.from(fileList);
    event.target.value = "";
    // Plan is built from metadata only (name + size); bytes are read only later
    // if the user explicitly confirms the import.
    const sources: PageImportSourceFile[] = selected.map((f) => ({
      name: f.name,
      size_bytes: f.size,
    }));
    setFiles(selected);
    setPlan(buildPageImportPlan(sources));
    setConfirmed(false);
    setResult(null);
    setLastReceipt(null);
    setActiveImportPlan(null);
    setImportProgress(EMPTY_IMPORT_PROGRESS);
    setSelectedRetryItemIndexes([]);
  };

  const handleExportManifest = () => {
    if (!plan) return;
    const manifest = buildExportablePageImportManifest(plan);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    downloadJson(`zhinote-page-import-manifest-${stamp}.json`, manifest);
  };

  const handleClear = () => {
    setPlan(null);
    setFiles([]);
    setConfirmed(false);
    setResult(null);
    setLastReceipt(null);
    setActiveImportPlan(null);
    setImportProgress(EMPTY_IMPORT_PROGRESS);
    setSelectedRetryItemIndexes([]);
  };

  const openImportedPageInPeek = (page: Page) => {
    rememberPendingPageDraft(page);
    rememberPageRouteHandoff(page, "module-create");
    warmPagePeekModal();
    setPeekInitialPage(page);
    setPeekPageId(page.id);
  };

  const openImportedPageIdInPeek = (pageId: string) => {
    warmPagePeekModal();
    setPeekInitialPage(null);
    setPeekPageId(pageId);
  };

  const openImportFullPageById = (pageId: string) => {
    if (peekInitialPage?.id === pageId) {
      openPage(peekInitialPage, { source: "module-open" });
      return;
    }
    openPage(pageId, { source: "module-open" });
  };

  const runImportPlan = async (
    activePlan: PageImportPlan,
    mode: PageImportFailureMode,
    opts?: {
      navigateOnFullSuccess?: boolean;
      retryRun?: boolean;
      selectedRetryItemIndexes?: number[];
      selectableRetryItemCount?: number;
    }
  ) => {
    if (!confirmed || importing) return;
    setImporting(true);
    setActiveImportPlan(activePlan);
    setResult(null);
    setLastReceipt(null);
    setSelectedRetryItemIndexes([]);
    setImportProgress({
      done: 0,
      total: activePlan.items.length,
      status: "running",
      message: opts?.retryRun ? "准备重试队列..." : "准备导入队列...",
    });
    if (opts?.navigateOnFullSuccess) warmPagePeekModal();
    try {
      const res = await executePageImportPlan(files, activePlan, {
        failureMode: mode,
        onProgress: (done, total) => {
          setImportProgress({
            done,
            total,
            status: "running",
            message:
              done >= total
                ? "正在收尾并生成本地 receipt..."
                : `正在处理第 ${Math.min(done + 1, total)} / ${total} 个对象...`,
          });
        },
      });
      const receipt = buildPageImportExecutionReceipt({
        plan: activePlan,
        result: res,
        confirmation_checked: confirmed,
        selected_retry_item_indexes: opts?.selectedRetryItemIndexes,
        selectable_retry_items: opts?.selectableRetryItemCount,
      });
      appendPageImportExecutionReceipt(receipt);
      setResult(res);
      setLastReceipt(receipt);
      setSelectedRetryItemIndexes(getRetryableImportItemIndexes(res.item_results));
      setImportProgress({
        done: activePlan.items.length,
        total: activePlan.items.length,
        status: res.status,
        message:
          res.status === "completed"
            ? "导入完成，已生成本地 receipt。"
            : res.status === "partially-completed"
              ? "导入部分完成，成功项已保留，可重试失败项。"
              : "导入失败，已按回退计划处理并生成本地 receipt。",
      });
      if (res.status !== "rolled-back" && res.created_page_metadata.length > 0) {
        upsertPages(res.created_page_metadata);
      }
      const firstPage = res.created_page_metadata[0] ?? null;
      if (opts?.navigateOnFullSuccess && res.status === "completed" && firstPage) {
        openImportedPageInPeek(firstPage);
      } else if (
        opts?.navigateOnFullSuccess &&
        res.status === "completed" &&
        res.first_page_id
      ) {
        openImportedPageIdInPeek(res.first_page_id);
      } else if (
        opts?.navigateOnFullSuccess &&
        res.status === "completed" &&
        res.first_database_id
      ) {
        openDatabase(res.first_database_id);
      }
    } catch (err) {
      console.error("[Zhinote] import execution error:", err);
      setResult(null);
      setSelectedRetryItemIndexes([]);
      setImportProgress({
        done: 0,
        total: activePlan.items.length,
        status: "rolled-back",
        message: "导入异常，未上传或外发文件；请检查浏览器本地存储。",
      });
      window.alert("批量导入失败。文件没有上传或外发；请检查浏览器是否允许本地存储。");
    } finally {
      setImporting(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!plan || !confirmed || importing) return;
    await runImportPlan(plan, failureMode, { navigateOnFullSuccess: true });
  };

  const handleRetryImport = async (retryIndexesOverride?: number[]) => {
    if (!plan || !result || !confirmed || importing) return;
    const allowedRetryIndexes = getRetryableImportItemIndexes(result.item_results);
    const requestedRetryIndexes = new Set(
      retryIndexesOverride ?? selectedRetryItemIndexes
    );
    const retryIndexes = allowedRetryIndexes.filter((index) =>
      requestedRetryIndexes.has(index)
    );
    if (retryIndexes.length === 0) return;
    const retryPlan = buildPageImportRetryPlan(plan, retryIndexes);
    setPlan(retryPlan);
    await runImportPlan(retryPlan, "keep-successful", {
      retryRun: true,
      selectedRetryItemIndexes: retryIndexes,
      selectableRetryItemCount: allowedRetryIndexes.length,
    });
  };

  const handleExportLastReceipt = () => {
    if (!lastReceipt) return;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    downloadJson(`zhinote-page-import-receipt-${stamp}.json`, lastReceipt);
  };

  const executableCount = useMemo(
    () => (plan ? countExecutableItems(plan) : 0),
    [plan]
  );

  const manifest = useMemo(
    () => (plan ? buildExportablePageImportManifest(plan) : null),
    [plan]
  );
  const importProgressPercent =
    importProgress.total > 0
      ? Math.min(100, Math.round((importProgress.done / importProgress.total) * 100))
      : 0;
  const visibleProgressItems = useMemo(() => {
    const progressPlan = activeImportPlan ?? plan;
    if (!progressPlan || importProgress.status === "idle") return [];
    const start = Math.max(
      0,
      Math.min(importProgress.done, progressPlan.items.length - 1) - 1
    );
    return progressPlan.items.slice(start, start + 5);
  }, [activeImportPlan, importProgress.done, importProgress.status, plan]);

  const retryableImportItems = useMemo(
    () => result?.item_results.filter(isOneClickRetryableImportItem) ?? [],
    [result]
  );
  const retryableImportItemCount = retryableImportItems.length;
  const selectedRetryItemCount = useMemo(() => {
    const retryableIndexSet = new Set(retryableImportItems.map((item) => item.index));
    return selectedRetryItemIndexes.filter((index) =>
      retryableIndexSet.has(index)
    ).length;
  }, [retryableImportItems, selectedRetryItemIndexes]);

  const handleToggleRetryItem = (index: number) => {
    setSelectedRetryItemIndexes((current) =>
      current.includes(index)
        ? current.filter((itemIndex) => itemIndex !== index)
        : [...current, index].sort((a, b) => a - b)
    );
  };

  const handleSelectAllRetryItems = () => {
    setSelectedRetryItemIndexes(retryableImportItems.map((item) => item.index));
  };

  const handleClearRetryItems = () => {
    setSelectedRetryItemIndexes([]);
  };

  return (
    <>
      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            批量导入计划
          </p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            文件 → 页面 / 数据库 导入预览
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            选择一批文件，先生成只读的导入计划：每个文件去哪个模块、变成页面还是
            本地留存、是否需要确认，并附带失败回退步骤。这一步只读取文件名、类型和
            大小，不读取文件内容、不创建页面或数据库、不上传、不调用 AI。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFilesSelected}
          />
          <button
            type="button"
            onClick={handleChoose}
            className="rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
          >
            选择文件生成计划
          </button>
          {plan && (
            <>
              <button
                type="button"
                onClick={handleExportManifest}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                导出计划 JSON
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                清空
              </button>
            </>
          )}
        </div>
      </div>

      {!plan ? (
        <div className="mt-4 rounded-lg border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-400 dark:border-zinc-700">
          还没有选择文件。选择一批文件后，这里会显示导入计划和回退方案。
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-5">
          {/* Summary */}
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Metric label="选中文件" value={plan.summary.selected_files} />
            <Metric label="变页面" value={plan.summary.page_import_candidates} />
            <Metric
              label="进数据库"
              value={plan.summary.database_import_candidates}
            />
            <Metric label="本地留存" value={plan.summary.local_retain_files} />
            <Metric
              label="待复核"
              value={plan.summary.blocked_for_review}
              highlight={plan.summary.blocked_for_review > 0}
            />
            <Metric label="回退步骤" value={plan.rollback_plan.length} />
          </div>

          {/* Per-file plan */}
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                <tr>
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">文件</th>
                  <th className="px-3 py-2 font-medium">类型</th>
                  <th className="px-3 py-2 font-medium">大小</th>
                  <th className="px-3 py-2 font-medium">去向</th>
                  <th className="px-3 py-2 font-medium">预览路线</th>
                  <th className="px-3 py-2 font-medium">目标模块</th>
                  <th className="px-3 py-2 font-medium">需转换</th>
                  <th className="px-3 py-2 font-medium">需确认</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {plan.items.map((item) => {
                  const badge = LANE_BADGE[item.lane];
                  const previewBadge = PREVIEW_ROUTE_BADGE[item.preview_route];
                  return (
                    <tr
                      key={item.index}
                      className="text-zinc-700 dark:text-zinc-200"
                    >
                      <td className="px-3 py-2 text-zinc-400">{item.index}</td>
                      <td
                        className="max-w-[220px] truncate px-3 py-2"
                        title={item.source_name}
                      >
                        {item.source_name}
                      </td>
                      <td className="px-3 py-2 text-zinc-500">
                        {item.extension}
                      </td>
                      <td className="px-3 py-2 text-zinc-500">
                        {formatBytes(item.size_bytes)}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${previewBadge.className}`}
                          title={item.execution_note}
                        >
                          {previewBadge.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-zinc-500">
                        {item.destination_module}
                      </td>
                      <td className="px-3 py-2 text-zinc-500">
                        {item.needs_conversion ? "是" : "—"}
                      </td>
                      <td className="px-3 py-2 text-zinc-500">
                        {item.confirmation_required ? "是" : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Gates */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-900 dark:bg-amber-950">
            <p className="font-medium text-amber-800 dark:text-amber-200">
              执行前必经确认（共 {plan.required_gates.length} 项）
            </p>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-amber-700 dark:text-amber-300">
              {plan.required_gates.map((gate) => (
                <li key={gate.id}>
                  <span className="font-medium">{gate.label}</span> —{" "}
                  {gate.reason}
                </li>
              ))}
            </ul>
          </div>

          {/* Confirmed execution gate */}
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
              确认后执行导入
            </p>
            <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              本次会创建 {executableCount} 个本地页面、文件页或数据库。Markdown / 纯文本 / RTF / EPUB / Notebook / DOCX / ODT / PPTX / ODP 会转为可编辑正文；
              CSV / Excel / ODS 会创建本地数据库并写入前 500 行、最多 50 列；
              HTML、PDF、旧版 Office、媒体和 iWork 会先创建本地文件页用于预览或复核；
              未知格式需单独复核，本步骤会跳过。中途任何一步失败时，会按下面选择的策略处理。
              导入只在本地进行，不上传、不调用 AI；页面和数据库记录是否同步云端继续跟随账号同步设置。
            </p>
            <fieldset className="mt-3 grid gap-2 sm:grid-cols-2">
              <legend className="sr-only">失败处理策略</legend>
              <label
                className={`rounded-md border px-3 py-2 text-xs leading-5 transition-colors ${
                  failureMode === "keep-successful"
                    ? "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200"
                    : "border-zinc-200 bg-white text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400"
                }`}
              >
                <input
                  type="radio"
                  name="page-import-failure-mode"
                  value="keep-successful"
                  checked={failureMode === "keep-successful"}
                  disabled={importing}
                  onChange={() => setFailureMode("keep-successful")}
                  className="mr-2 align-middle"
                />
                <span className="font-medium">保留成功项</span>
                <span className="ml-1 opacity-80">
                  推荐大批量导入；失败项可单独重试。
                </span>
              </label>
              <label
                className={`rounded-md border px-3 py-2 text-xs leading-5 transition-colors ${
                  failureMode === "rollback-all"
                    ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
                    : "border-zinc-200 bg-white text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400"
                }`}
              >
                <input
                  type="radio"
                  name="page-import-failure-mode"
                  value="rollback-all"
                  checked={failureMode === "rollback-all"}
                  disabled={importing}
                  onChange={() => setFailureMode("rollback-all")}
                  className="mr-2 align-middle"
                />
                <span className="font-medium">失败即整批回退</span>
                <span className="ml-1 opacity-80">
                  更保守；适合需要整批一致性的导入。
                </span>
              </label>
            </fieldset>
            <label className="mt-3 flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
              />
              我已查看导入计划，确认创建这些本地页面和数据库
            </label>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleConfirmImport()}
                disabled={!confirmed || importing || executableCount === 0}
                className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {importing ? "导入中..." : `确认并导入 ${executableCount} 个对象`}
              </button>
              {executableCount === 0 && (
                <span className="text-xs text-zinc-400">
                  当前没有可在本步骤直接创建的文件。
                </span>
              )}
            </div>
            {importProgress.status !== "idle" && (
              <div className="mt-4 rounded-lg border border-zinc-200 bg-white px-3 py-3 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="font-medium text-zinc-700 dark:text-zinc-200">
                    导入进度队列
                  </span>
                  <span>
                    {importProgress.done} / {importProgress.total} ·{" "}
                    {importProgressPercent}%
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                  <div
                    className={`h-full rounded-full transition-all ${
                      importProgress.status === "rolled-back"
                        ? "bg-amber-500"
                        : "bg-blue-600"
                    }`}
                    style={{ width: `${importProgressPercent}%` }}
                  />
                </div>
                <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  {importProgress.message}
                </p>
                {visibleProgressItems.length > 0 && (
                  <ol className="mt-2 space-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {visibleProgressItems.map((item) => {
                      const state =
                        item.index <= importProgress.done
                          ? "已处理"
                          : item.index === importProgress.done + 1 &&
                              importProgress.status === "running"
                            ? "处理中"
                            : "等待";
                      return (
                        <li
                          key={`progress-${item.index}`}
                          className="flex items-center justify-between gap-3 rounded border border-zinc-100 px-2 py-1 dark:border-zinc-800"
                        >
                          <span className="truncate">
                            #{item.index} · {item.extension || "unknown"} ·{" "}
                            {LANE_BADGE[item.lane].label}
                          </span>
                          <span className="shrink-0">{state}</span>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            )}
          </div>

          {/* Result */}
          {result && (
            <div
              className={`rounded-lg border px-4 py-3 text-sm ${
                result.status === "completed"
                  ? "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200"
                  : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
              }`}
            >
              {result.status === "completed" ? (
                <div className="space-y-2">
                  <p>
                    导入完成：创建页面 {result.created_pages} 个、数据库{" "}
                    {result.created_databases} 个、文件页 {result.retained_file_pages}{" "}
                    个；跳过异常表格 {result.skipped_database} 个、待复核{" "}
                    {result.skipped_blocked} 个。
                    文件没有上传或调用 AI。
                  </p>
                  <p className="text-xs leading-5">
                    其中可编辑正文页 {result.editable_page_imports} 个，Markdown
                    可编辑页 {result.markdown_editable_pages} 个，HTML 报告沙盒预览页{" "}
                    {result.html_native_preview_pages} 个，其他本地预览页{" "}
                    {result.local_preview_pages} 个。HTML 外部资源默认继续阻止。
                  </p>
                  {result.notes.length > 0 && (
                    <ul className="list-disc space-y-1 pl-5 text-xs leading-5">
                      {result.notes.slice(0, 5).map((note, index) => (
                        <li key={`${index}-${note}`}>{note}</li>
                      ))}
                    </ul>
                  )}
                  {lastReceipt && (
                    <button
                      type="button"
                      onClick={handleExportLastReceipt}
                      className="rounded-md border border-green-300 px-2 py-1 text-xs font-medium text-green-800 transition-colors hover:bg-green-100 dark:border-green-800 dark:text-green-200 dark:hover:bg-green-900/40"
                    >
                      导出批量导入 receipt
                    </button>
                  )}
                </div>
              ) : result.status === "partially-completed" ? (
                <div className="space-y-2">
                  <p>
                    导入部分完成：已保留成功创建的{" "}
                    {result.preserved_successful_items} 个对象；失败{" "}
                    {result.failed} 个，可重试 {result.retryable_items} 个。
                    文件没有上传或外发。
                  </p>
                  <p className="text-xs leading-5">
                    当前策略是保留成功项；你可以只重试失败、未执行或已回退项目，不会重复导入已经完成的项目。
                  </p>
                  {lastReceipt && (
                    <button
                      type="button"
                      onClick={handleExportLastReceipt}
                      className="rounded-md border border-amber-300 px-2 py-1 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-900/40"
                    >
                      导出部分完成 receipt
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <p>
                    导入中途失败，已回退本次创建的 {result.rolled_back_pages}{" "}
                    个页面、{result.rolled_back_databases} 个数据库，工作区恢复到导入前状态。文件没有上传或外发。
                  </p>
                  {lastReceipt && (
                    <button
                      type="button"
                      onClick={handleExportLastReceipt}
                      className="rounded-md border border-amber-300 px-2 py-1 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-900/40"
                    >
                      导出回退 receipt
                    </button>
                  )}
                </div>
              )}
              <ImportItemExecutionSummary
                result={result}
                onRetryAll={
                  retryableImportItemCount > 0
                    ? () =>
                        void handleRetryImport(
                          retryableImportItems.map((item) => item.index)
                        )
                    : undefined
                }
                onRetrySelected={
                  selectedRetryItemCount > 0
                    ? () => void handleRetryImport(selectedRetryItemIndexes)
                    : undefined
                }
                selectedRetryItemIndexes={selectedRetryItemIndexes}
                onToggleRetryItem={handleToggleRetryItem}
                onSelectAllRetryItems={handleSelectAllRetryItems}
                onClearRetryItems={handleClearRetryItems}
                retryableImportItemCount={retryableImportItemCount}
                selectedRetryItemCount={selectedRetryItemCount}
                retrying={importing}
              />
            </div>
          )}

          <p className="text-xs leading-5 text-zinc-400">
            {plan.privacy_note}
            {manifest
              ? ` 导出清单含 ${manifest.extension_groups.length} 个扩展名分组，不含文件名。`
              : ""}
          </p>
        </div>
      )}
      </section>
      {peekPageId && (
        <PagePeekModal
          pageId={peekPageId}
          initialPage={peekInitialPage}
          onClose={() => {
            setPeekPageId(null);
            setPeekInitialPage(null);
          }}
          onOpenFull={(id) => {
            setPeekPageId(null);
            setPeekInitialPage(null);
            openImportFullPageById(id);
          }}
        />
      )}
    </>
  );
}

function Metric({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 ${
        highlight
          ? "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950"
          : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
      }`}
    >
      <p className="text-[11px] text-zinc-400">{label}</p>
      <p
        className={`mt-0.5 text-lg font-semibold ${
          highlight
            ? "text-amber-700 dark:text-amber-300"
            : "text-zinc-900 dark:text-zinc-100"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function ImportItemExecutionSummary({
  result,
  onRetryAll,
  onRetrySelected,
  selectedRetryItemIndexes,
  onToggleRetryItem,
  onSelectAllRetryItems,
  onClearRetryItems,
  retryableImportItemCount,
  selectedRetryItemCount,
  retrying,
}: {
  result: PageImportExecutionResult;
  onRetryAll?: () => void;
  onRetrySelected?: () => void;
  selectedRetryItemIndexes: number[];
  onToggleRetryItem: (index: number) => void;
  onSelectAllRetryItems: () => void;
  onClearRetryItems: () => void;
  retryableImportItemCount: number;
  selectedRetryItemCount: number;
  retrying: boolean;
}) {
  if (result.item_results.length === 0) return null;

  const visibleItems = result.item_results.slice(0, 8);
  const hiddenItems = result.item_results.length - visibleItems.length;
  const retryableItems = result.item_results.filter(isOneClickRetryableImportItem);
  const visibleRetryableItems = retryableItems.slice(0, 30);
  const hiddenRetryableItems = retryableItems.length - visibleRetryableItems.length;
  const selectedRetryItemIndexSet = new Set(selectedRetryItemIndexes);

  return (
    <div className="mt-3 rounded-md border border-current/20 bg-white/50 px-3 py-3 dark:bg-black/20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium">导入明细（不含文件名）</p>
        <p className="text-xs opacity-80">
          可重试 {result.retryable_items} 项 · 已回退{" "}
          {result.rolled_back_item_results} 项
        </p>
      </div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-xs">
          <thead className="opacity-70">
            <tr>
              <th className="py-1 pr-3 font-medium">#</th>
              <th className="py-1 pr-3 font-medium">类型</th>
              <th className="py-1 pr-3 font-medium">去向</th>
              <th className="py-1 pr-3 font-medium">动作</th>
              <th className="py-1 pr-3 font-medium">状态</th>
              <th className="py-1 pr-3 font-medium">重试</th>
              <th className="py-1 font-medium">说明</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-current/10">
            {visibleItems.map((item) => {
              const statusBadge = ITEM_STATUS_BADGE[item.status];
              return (
                <tr key={`execution-${item.index}`}>
                  <td className="py-1.5 pr-3 opacity-80">{item.index}</td>
                  <td className="py-1.5 pr-3 opacity-80">
                    {item.extension || "unknown"}
                  </td>
                  <td className="py-1.5 pr-3 opacity-80">
                    {LANE_BADGE[item.lane].label}
                  </td>
                  <td className="py-1.5 pr-3 opacity-80">
                    {ITEM_ACTION_LABEL[item.action]}
                  </td>
                  <td className="py-1.5 pr-3">
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 font-medium ${statusBadge.className}`}
                    >
                      {statusBadge.label}
                    </span>
                  </td>
                  <td className="py-1.5 pr-3 opacity-80">
                    {item.retryable ? "可重试" : "不用"}
                  </td>
                  <td className="py-1.5 opacity-80">{item.note}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {hiddenItems > 0 && (
        <p className="mt-2 text-xs opacity-70">
          还有 {hiddenItems} 项未展开；完整状态会写入本地 receipt，仍不包含文件名或正文。
        </p>
      )}
      {retryableImportItemCount > 0 && (
        <div className="mt-3 rounded-md border border-current/20 bg-white/70 px-3 py-3 dark:bg-black/20">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium">失败项修复工作台</p>
              <p className="mt-0.5 text-xs leading-5 opacity-75">
                筛选范围：失败 / 未执行 / 已回退。已选择{" "}
                {selectedRetryItemCount} / {retryableImportItemCount} 项；receipt
                只记录序号和类型，不含文件名。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onSelectAllRetryItems}
                disabled={retrying}
                className="rounded-md border border-current/30 px-2 py-1 text-xs font-medium transition-colors hover:bg-current/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                全选可重试项
              </button>
              <button
                type="button"
                onClick={onClearRetryItems}
                disabled={retrying || selectedRetryItemCount === 0}
                className="rounded-md border border-current/30 px-2 py-1 text-xs font-medium transition-colors hover:bg-current/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                清空选择
              </button>
            </div>
          </div>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[580px] text-left text-xs">
              <thead className="opacity-70">
                <tr>
                  <th className="py-1 pr-3 font-medium">选择</th>
                  <th className="py-1 pr-3 font-medium">#</th>
                  <th className="py-1 pr-3 font-medium">类型</th>
                  <th className="py-1 pr-3 font-medium">状态</th>
                  <th className="py-1 pr-3 font-medium">动作</th>
                  <th className="py-1 font-medium">说明</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-current/10">
                {visibleRetryableItems.map((item) => {
                  const statusBadge = ITEM_STATUS_BADGE[item.status];
                  return (
                    <tr key={`retry-workbench-${item.index}`}>
                      <td className="py-1.5 pr-3">
                        <input
                          type="checkbox"
                          checked={selectedRetryItemIndexSet.has(item.index)}
                          disabled={retrying}
                          onChange={() => onToggleRetryItem(item.index)}
                          aria-label={`选择第 ${item.index} 个导入项重试`}
                          className="h-3.5 w-3.5 rounded border-current/30"
                        />
                      </td>
                      <td className="py-1.5 pr-3 opacity-80">{item.index}</td>
                      <td className="py-1.5 pr-3 opacity-80">
                        {item.extension || "unknown"}
                      </td>
                      <td className="py-1.5 pr-3">
                        <span
                          className={`inline-block rounded px-1.5 py-0.5 font-medium ${statusBadge.className}`}
                        >
                          {statusBadge.label}
                        </span>
                      </td>
                      <td className="py-1.5 pr-3 opacity-80">
                        {ITEM_ACTION_LABEL[item.action]}
                      </td>
                      <td className="py-1.5 opacity-80">{item.note}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {hiddenRetryableItems > 0 && (
            <p className="mt-2 text-xs opacity-70">
              还有 {hiddenRetryableItems} 个可重试项未展开；可用“全选可重试项”一并纳入。
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onRetrySelected}
              disabled={retrying || selectedRetryItemCount === 0}
              className="rounded-md border border-current/30 px-2 py-1 text-xs font-medium transition-colors hover:bg-current/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {retrying
                ? "重试中..."
                : `重试已选择（${selectedRetryItemCount}）`}
            </button>
            {onRetryAll && (
              <button
                type="button"
                onClick={onRetryAll}
                disabled={retrying}
                className="rounded-md border border-current/30 px-2 py-1 text-xs font-medium transition-colors hover:bg-current/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {retrying
                  ? "重试中..."
                  : `只重试失败/未执行/已回退项（${retryableImportItemCount}）`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function getRetryableImportItemIndexes(items: PageImportItemExecutionResult[]) {
  return items.filter(isOneClickRetryableImportItem).map((item) => item.index);
}

function isOneClickRetryableImportItem(item: PageImportItemExecutionResult) {
  return (
    item.retryable &&
    (item.status === "failed" ||
      item.status === "rolled-back" ||
      item.status === "not-run")
  );
}
