"use client";

import { formatRelativeDate } from "@/lib/utils/dates";
import type { PageVersion } from "@/lib/utils/types";

interface HoverSummaryProps {
  versions: PageVersion[];
}

/**
 * Popover content showing the most recent changes to a page. Meant to be
 * rendered inside a `group relative` wrapper and revealed on hover.
 */
export default function HoverSummary({ versions }: HoverSummaryProps) {
  if (versions.length === 0) {
    return (
      <div className="absolute right-0 top-full mt-1 z-50 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg p-3 text-xs text-zinc-400 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity">
        还没有保存版本。编辑时会自动生成版本。
      </div>
    );
  }

  const recent = versions.slice(0, 5);

  return (
    <div className="absolute right-0 top-full mt-1 z-50 w-72 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity">
      <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-400 font-medium">
        最近变化
      </div>
      <div className="max-h-64 overflow-y-auto">
        {recent.map((v) => (
          <div
            key={v.id}
            className="px-3 py-2 border-b border-zinc-50 dark:border-zinc-800 last:border-0"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                v{v.version_num}
              </span>
              <span className="text-[10px] text-zinc-400">
                {formatRelativeDate(v.created_at)}
              </span>
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
              {v.summary || "—"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
