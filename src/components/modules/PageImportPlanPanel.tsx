"use client";

import { useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  buildPageImportPlan,
  buildExportablePageImportManifest,
  type PageImportLaneId,
  type PageImportPlan,
  type PageImportSourceFile,
} from "@/lib/files/pageImportPlan";

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
    label: "数据库候选",
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
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [plan, setPlan] = useState<PageImportPlan | null>(null);

  const handleChoose = () => inputRef.current?.click();

  const handleFilesSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    event.target.value = "";
    if (!fileList || fileList.length === 0) return;
    // Metadata only: read name + size, never the bytes.
    const sources: PageImportSourceFile[] = Array.from(fileList).map((f) => ({
      name: f.name,
      size_bytes: f.size,
    }));
    setPlan(buildPageImportPlan(sources));
  };

  const handleExportManifest = () => {
    if (!plan) return;
    const manifest = buildExportablePageImportManifest(plan);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    downloadJson(`zhinote-page-import-manifest-${stamp}.json`, manifest);
  };

  const handleClear = () => setPlan(null);

  const manifest = useMemo(
    () => (plan ? buildExportablePageImportManifest(plan) : null),
    [plan]
  );

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            批量导入计划
          </p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            文件 → 页面 导入预览
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            选择一批文件，先生成只读的导入计划：每个文件去哪个模块、变成页面还是
            本地留存、是否需要确认，并附带失败回退步骤。这一步只读取文件名、类型和
            大小，不读取文件内容、不创建页面、不上传、不调用 AI。
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
                  <th className="px-3 py-2 font-medium">目标模块</th>
                  <th className="px-3 py-2 font-medium">需转换</th>
                  <th className="px-3 py-2 font-medium">需确认</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {plan.items.map((item) => {
                  const badge = LANE_BADGE[item.lane];
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

          <p className="text-xs leading-5 text-zinc-400">
            {plan.privacy_note}
            {manifest
              ? ` 导出清单含 ${manifest.extension_groups.length} 个扩展名分组，不含文件名。`
              : ""}
          </p>
        </div>
      )}
    </section>
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
