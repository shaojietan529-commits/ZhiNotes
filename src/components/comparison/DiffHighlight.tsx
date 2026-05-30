"use client";

import type { DiffPart } from "@/lib/comparison/differ";

interface DiffHighlightProps {
  parts: DiffPart[];
  /**
   * "old" renders unchanged + removed text (removed shown struck-through in red).
   * "new" renders unchanged + added text (added shown highlighted in green).
   * "unified" renders everything inline (added green, removed red strikethrough).
   */
  side: "old" | "new" | "unified";
}

export default function DiffHighlight({ parts, side }: DiffHighlightProps) {
  return (
    <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
      {parts.map((part, i) => {
        if (part.added) {
          if (side === "old") return null;
          return (
            <span
              key={i}
              className="bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 rounded-sm"
            >
              {part.value}
            </span>
          );
        }
        if (part.removed) {
          if (side === "new") return null;
          return (
            <span
              key={i}
              className="bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 line-through rounded-sm"
            >
              {part.value}
            </span>
          );
        }
        return <span key={i}>{part.value}</span>;
      })}
    </div>
  );
}
