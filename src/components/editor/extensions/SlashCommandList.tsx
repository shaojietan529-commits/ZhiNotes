"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  useRef,
} from "react";
import type { Editor } from "@tiptap/core";

type SlashCommandRange = { from: number; to: number };

export interface SlashCommandItem {
  title: string;
  description: string;
  icon: string;
  category: string;
  aliases?: string[];
  command: (props: { editor: Editor; range: SlashCommandRange }) => void | Promise<void>;
}

export interface SlashCommandListRef {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

interface SlashCommandListProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
}

const SlashCommandList = forwardRef<SlashCommandListRef, SlashCommandListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      queueMicrotask(() => {
        setSelectedIndex(0);
      });
    }, [items]);

    // Scroll selected item into view
    useEffect(() => {
      const container = scrollRef.current;
      if (!container) return;
      const selected = container.querySelector(`[data-index="${selectedIndex}"]`);
      if (selected) {
        selected.scrollIntoView({ block: "nearest" });
      }
    }, [selectedIndex]);

    useImperativeHandle(ref, () => ({
      onKeyDown(event: KeyboardEvent) {
        if (items.length === 0) {
          return ["ArrowUp", "ArrowDown", "Enter"].includes(event.key);
        }

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
            command(item);
          }
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg p-3 text-sm text-zinc-400">
          没有找到命令
        </div>
      );
    }

    return (
      <div
        ref={scrollRef}
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg overflow-hidden max-h-80 overflow-y-auto w-72"
      >
        {items.map((item, index) => {
          const showCategory =
            index === 0 || item.category !== items[index - 1]?.category;

          return (
            <div key={`${item.category}-${item.title}`}>
              {showCategory && (
                <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-zinc-400 font-medium">
                  {item.category}
                </div>
              )}
              <button
                data-index={index}
                onClick={() => command(item)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                  index === selectedIndex
                    ? "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                    : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                }`}
              >
                <span className="shrink-0 w-8 h-8 flex items-center justify-center rounded bg-zinc-100 dark:bg-zinc-800 text-base">
                  {item.icon}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {item.title}
                  </div>
                  <div className="text-[11px] text-zinc-400 truncate">
                    {item.description}
                  </div>
                </div>
              </button>
            </div>
          );
        })}
      </div>
    );
  }
);

SlashCommandList.displayName = "SlashCommandList";
export default SlashCommandList;
