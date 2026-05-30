"use client";

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
  return (
    <div className="mb-6 border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden bg-white dark:bg-zinc-900">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Version history
          <span className="ml-2 text-xs text-zinc-400">
            {versions.length} saved
          </span>
        </span>
        <button
          onClick={onClose}
          className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          Close
        </button>
      </div>

      {versions.length === 0 ? (
        <div className="px-4 py-6 text-sm text-zinc-400 text-center">
          No versions saved yet. Versions are captured automatically as you
          edit, or save one manually with “Save version”.
        </div>
      ) : (
        <div className="max-h-80 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
          {versions.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    v{v.version_num}
                  </span>
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
                  title="Compare this version with the current page"
                >
                  Compare
                </button>
                <button
                  onClick={() => onRestore(v)}
                  className="text-[11px] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  title="Restore the page to this version"
                >
                  Restore
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
