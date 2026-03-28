"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import type { Page } from "@/lib/utils/types";

export interface WikiLinkListRef {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

interface WikiLinkListProps {
  items: Page[];
  command: (item: { id: string; label: string }) => void;
}

const WikiLinkList = forwardRef<WikiLinkListRef, WikiLinkListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    useImperativeHandle(ref, () => ({
      onKeyDown(event: KeyboardEvent) {
        if (event.key === "ArrowUp") {
          setSelectedIndex((i) => (i + items.length - 1) % items.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((i) => (i + 1) % items.length);
          return true;
        }
        if (event.key === "Enter") {
          const item = items[selectedIndex];
          if (item) {
            command({ id: item.id, label: item.title || "Untitled" });
          }
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg p-3 text-sm text-zinc-400">
          No pages found
        </div>
      );
    }

    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg overflow-hidden max-h-64 overflow-y-auto">
        {items.map((item, index) => (
          <button
            key={item.id}
            onClick={() =>
              command({ id: item.id, label: item.title || "Untitled" })
            }
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
              index === selectedIndex
                ? "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            }`}
          >
            <span className="shrink-0">{item.icon || "📄"}</span>
            <span className="truncate">{item.title || "Untitled"}</span>
          </button>
        ))}
      </div>
    );
  }
);

WikiLinkList.displayName = "WikiLinkList";
export default WikiLinkList;
