"use client";

import { useEffect } from "react";
import {
  createPage,
  deletePage,
  getPage,
  updatePage,
} from "@/lib/db/local/queries";

interface PageContextMenuProps {
  pageId: string;
  x: number;
  y: number;
  onClose: () => void;
  onOpen: (pageId: string) => void;
  onOpenFull: (pageId: string) => void;
  onChanged?: () => void;
}

// A right-click / two-finger-tap context menu for a page entry (Notion-style).
export default function PageContextMenu({
  pageId,
  x,
  y,
  onClose,
  onOpen,
  onOpenFull,
  onChanged,
}: PageContextMenuProps) {
  useEffect(() => {
    const handlePointerDown = () => onClose();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    // Close on the next pointer interaction or Escape.
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const copyLink = async () => {
    const url = `${window.location.origin}/page/${pageId}`;
    try {
      await window.navigator.clipboard.writeText(url);
    } catch {
      window.prompt("复制页面链接：", url);
    }
  };

  const duplicate = async () => {
    const page = await getPage(pageId);
    if (!page) return;
    const copy = await createPage({
      title: `${page.title || "未命名页面"} 副本`,
      parentId: page.parent_id,
      icon: page.icon ?? undefined,
    });
    await updatePage(copy.id, {
      content_text: page.content_text ?? "",
      properties: page.properties ?? undefined,
    });
    onChanged?.();
  };

  const moveToTrash = async () => {
    const ok = window.confirm("移到回收站？之后可以从侧边栏回收站恢复。");
    if (!ok) return;
    await deletePage(pageId);
    onChanged?.();
  };

  // Keep the menu inside the viewport.
  const left = Math.min(x, (typeof window !== "undefined" ? window.innerWidth : x) - 200);
  const top = Math.min(y, (typeof window !== "undefined" ? window.innerHeight : y) - 260);

  return (
    <div
      className="fixed z-[60] w-48 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 text-sm shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
      style={{ left, top }}
      onPointerDown={(event) => event.stopPropagation()}
      role="menu"
    >
      <Item label="打开" onClick={() => run(onClose, () => onOpen(pageId))} />
      <Item
        label="打开完整页面 ↗"
        onClick={() => run(onClose, () => onOpenFull(pageId))}
      />
      <Divider />
      <Item label="复制链接" onClick={() => run(onClose, () => void copyLink())} />
      <Item label="创建副本" onClick={() => run(onClose, () => void duplicate())} />
      <Divider />
      <Item
        label="移到回收站"
        danger
        onClick={() => run(onClose, () => void moveToTrash())}
      />
    </div>
  );
}

function run(onClose: () => void, action: () => void) {
  onClose();
  action();
}

function Item({
  label,
  onClick,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full px-3 py-1.5 text-left transition-colors ${
        danger
          ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
          : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      }`}
      role="menuitem"
    >
      {label}
    </button>
  );
}

function Divider() {
  return <div className="my-1 h-px bg-zinc-100 dark:bg-zinc-800" />;
}
