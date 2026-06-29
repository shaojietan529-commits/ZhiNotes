"use client";

import { useEffect, useRef, useState } from "react";

export interface PageActionsMenuProps {
  locked: boolean;
  widePage: boolean;
  versionsCount: number;
  initialOpen?: boolean;
  onAddSubPage: () => void;
  onAddCover: () => void;
  onToggleLock: () => void;
  onToggleWidth: () => void;
  onSaveVersion: () => void;
  onToggleHistory: () => void;
  onToggleInfo: () => void;
  onDuplicate: () => void;
  onCopyLink: () => void;
  onMoveTo: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste?: () => void;
  onExportHtml: () => void;
  onExportMarkdown: () => void;
  onCopyMarkdown: () => void;
  onCopyHtml: () => void;
  onPrintPdf: () => void;
  onDelete: () => void;
}

export default function PageActionsMenu(props: PageActionsMenuProps) {
  const [open, setOpen] = useState(() => Boolean(props.initialOpen));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && ref.current?.contains(event.target)) {
        return;
      }
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const run = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex h-7 w-7 items-center justify-center rounded text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        title="更多操作"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="19" cy="12" r="1.6" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-40 w-52 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 text-sm shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
          <MenuItem label="添加子页面" disabled={props.locked} onClick={run(props.onAddSubPage)} />
          <MenuItem label="添加封面" disabled={props.locked} onClick={run(props.onAddCover)} />

          <Divider />
          <MenuItem
            label={props.locked ? "解锁编辑" : "锁定页面"}
            onClick={run(props.onToggleLock)}
          />
          <MenuItem
            label={props.widePage ? "标准宽度" : "宽页面"}
            onClick={run(props.onToggleWidth)}
          />

          <Divider />
          <MenuItem label="保存版本" onClick={run(props.onSaveVersion)} />
          <MenuItem
            label={`版本历史${props.versionsCount > 0 ? ` (${props.versionsCount})` : ""}`}
            onClick={run(props.onToggleHistory)}
          />
          <MenuItem label="页面信息" onClick={run(props.onToggleInfo)} />

          <Divider />
          <MenuItem label="剪切页面" onClick={run(props.onCut)} />
          <MenuItem label="复制页面" onClick={run(props.onCopy)} />
          {props.onPaste && (
            <MenuItem label="粘贴页面" onClick={run(props.onPaste)} />
          )}
          <MenuItem label="移动到..." onClick={run(props.onMoveTo)} />
          <MenuItem label="创建副本" onClick={run(props.onDuplicate)} />
          <MenuItem label="复制链接" onClick={run(props.onCopyLink)} />

          <Divider />
          <MenuItem label="导出 HTML" onClick={run(props.onExportHtml)} />
          <MenuItem label="导出 Markdown" onClick={run(props.onExportMarkdown)} />
          <MenuItem label="复制 Markdown" onClick={run(props.onCopyMarkdown)} />
          <MenuItem label="复制 HTML" onClick={run(props.onCopyHtml)} />
          <MenuItem label="打印 / PDF" onClick={run(props.onPrintPdf)} />

          <Divider />
          <MenuItem
            label="删除页面"
            disabled={props.locked}
            danger
            onClick={run(props.onDelete)}
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  label,
  onClick,
  disabled = false,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`block w-full px-3 py-1.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        danger
          ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
          : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      }`}
    >
      {label}
    </button>
  );
}

function Divider() {
  return <div className="my-1 h-px bg-zinc-100 dark:bg-zinc-800" />;
}
