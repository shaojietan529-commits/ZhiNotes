"use client";

import { useMemo, useState } from "react";
import { formatRelativeDate, formatFullDate } from "@/lib/utils/dates";
import type { PageVersion } from "@/lib/utils/types";

interface VersionHistoryPanelProps {
  versions: PageVersion[];
  onCompare: (version: PageVersion) => void;
  onRestore: (version: PageVersion) => void;
  onClose: () => void;
}

export default function VersionHistoryPanel({
  versions,
  onCompare,
  onRestore,
  onClose,
}: VersionHistoryPanelProps) {
  const [query, setQuery] = useState("");
  const filteredVersions = useMemo(
    () => filterVersions(versions, query),
    [versions, query]
  );
  const trimmedQuery = query.trim();

  return (
    <div className="mb-6 border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden bg-white dark:bg-zinc-900">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          版本历史
          <span className="ml-2 text-xs text-zinc-400">
            已保存 {versions.length} 个
          </span>
        </span>
        <button
          onClick={onClose}
          className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          关闭
        </button>
      </div>

      {versions.length === 0 ? (
        <div className="px-4 py-6 text-sm text-zinc-400 text-center">
          还没有保存版本。编辑时会自动生成版本，也可以手动点击“保存版本”。
        </div>
      ) : (
        <>
          <div className="border-b border-zinc-100 px-4 py-2 dark:border-zinc-800">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="筛选版本..."
              className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-700 outline-none placeholder:text-zinc-300 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-blue-700 dark:focus:ring-blue-950"
            />
            {trimmedQuery && (
              <div className="mt-1 text-[11px] text-zinc-400">
                显示 {filteredVersions.length}/{versions.length} 个版本
              </div>
            )}
          </div>
          {filteredVersions.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-zinc-400">
              没有匹配“{trimmedQuery}”的版本。
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredVersions.map((v, index) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        v{v.version_num}
                      </span>
                      {index === 0 && !trimmedQuery && (
                        <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-blue-950 dark:text-blue-300">
                          最新
                        </span>
                      )}
                      <span
                        className="text-[11px] text-zinc-400"
                        title={formatFullDate(v.created_at)}
                      >
                        {formatRelativeDate(v.created_at)}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                      {v.summary || "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => onCompare(v)}
                      className="text-[11px] text-blue-500 hover:text-blue-600 px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors"
                      title="对比此版本和当前页面"
                    >
                      对比
                    </button>
                    <button
                      onClick={() => onRestore(v)}
                      className="text-[11px] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      title="恢复页面到此版本"
                    >
                      恢复
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function filterVersions(versions: PageVersion[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return versions;

  return versions.filter((version) => {
    const haystack = [
      `v${version.version_num}`,
      String(version.version_num),
      version.summary ?? "",
      formatFullDate(version.created_at),
      formatRelativeDate(version.created_at),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}
