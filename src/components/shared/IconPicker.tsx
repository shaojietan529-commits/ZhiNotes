"use client";

import { useState, useRef, useEffect } from "react";

const EMOJI_LIST = [
  "📄", "📝", "📋", "📌", "📎", "📁", "📂", "📊", "📈", "📉",
  "💰", "💵", "💹", "🏦", "🏢", "🏭", "🏗️", "🔬", "🔭", "💡",
  "⭐", "🎯", "🚀", "🔥", "💎", "🏆", "📱", "💻", "🌐", "🔗",
  "📅", "⏰", "✅", "❌", "⚠️", "❓", "💬", "📧", "🔔", "🔒",
  "🧠", "📚", "🎓", "✏️", "🖊️", "📐", "🗂️", "🗃️", "🗄️", "📦",
  "🔍", "🔎", "👤", "👥", "🤝", "💼", "📑", "🗒️", "🗓️", "📆",
];

interface IconPickerProps {
  currentIcon: string | null;
  onSelect: (icon: string) => void;
  disabled?: boolean;
}

export default function IconPicker({
  currentIcon,
  onSelect,
  disabled = false,
}: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          if (!disabled) setOpen(!open);
        }}
        disabled={disabled}
        className="text-3xl hover:bg-zinc-100 disabled:cursor-default disabled:hover:bg-transparent dark:hover:bg-zinc-800 dark:disabled:hover:bg-transparent rounded-md p-1 transition-colors"
        title="更换图标"
      >
        {currentIcon || "📄"}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg z-50 p-2 w-[280px]">
          <p className="text-[10px] text-zinc-400 uppercase tracking-wider mb-2 px-1">
            选择图标
          </p>
          <div className="grid grid-cols-10 gap-0.5">
            {EMOJI_LIST.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  onSelect(emoji);
                  setOpen(false);
                }}
                className={`w-6 h-6 flex items-center justify-center rounded text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors ${
                  currentIcon === emoji ? "bg-zinc-200 dark:bg-zinc-600" : ""
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
