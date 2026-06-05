"use client";

import { useMemo } from "react";
import { htmlToText, wordDiff, diffStats } from "@/lib/comparison/differ";
import DiffHighlight from "./DiffHighlight";

interface SideBySideDiffProps {
  oldHtml: string;
  newHtml: string;
  oldLabel: string;
  newLabel: string;
}

export default function SideBySideDiff({
  oldHtml,
  newHtml,
  oldLabel,
  newLabel,
}: SideBySideDiffProps) {
  const { parts, stats } = useMemo(() => {
    const oldText = htmlToText(oldHtml);
    const newText = htmlToText(newHtml);
    return {
      parts: wordDiff(oldText, newText),
      stats: diffStats(oldText, newText),
    };
  }, [oldHtml, newHtml]);

  return (
    <div>
      {/* Change stats bar */}
      <div className="flex items-center gap-4 mb-4 text-xs">
        {stats.addedWords > 0 && (
          <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
            <span className="w-2 h-2 rounded-sm bg-green-400 inline-block" />
            新增 {stats.addedWords} 个词
          </span>
        )}
        {stats.removedWords > 0 && (
          <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
            <span className="w-2 h-2 rounded-sm bg-red-400 inline-block" />
            删除 {stats.removedWords} 个词
          </span>
        )}
        {!stats.hasChanges && (
          <span className="text-zinc-400">没有文本差异</span>
        )}
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
          <div className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-500">
            {oldLabel}
          </div>
          <div className="p-3">
            <DiffHighlight parts={parts} side="old" />
          </div>
        </div>
        <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
          <div className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-500">
            {newLabel}
          </div>
          <div className="p-3">
            <DiffHighlight parts={parts} side="new" />
          </div>
        </div>
      </div>
    </div>
  );
}
