"use client";

import { useEffect, useState } from "react";
import {
  deletePage,
  getNextPosition,
  getPage,
  listMoveTargetPageMetadata,
} from "@/lib/db/local/queries";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { displayPageTitle } from "@/lib/pages/displayTitle";
import { collectMovedPageSnapshots } from "@/lib/pages/pageSnapshotUpdates";
import { usePages } from "@/hooks/usePages";
import type { Page } from "@/lib/utils/types";

export interface PageContextMenuProps {
  pageId: string;
  x: number;
  y: number;
  onClose: () => void;
  onOpen: (pageId: string) => void;
  onOpenFull: (pageId: string) => void;
  onChanged?: () => void;
}

const loadPageAccountSyncModule = () => import("@/lib/pages/accountPageSync");
const loadPageMutationModule = () => import("@/lib/pages/cloudPageMutations");

export default function PageContextMenu({
  pageId,
  x,
  y,
  onClose,
  onOpen,
  onOpenFull,
  onChanged,
}: PageContextMenuProps) {
  const pageClipboard = useWorkspaceStore((s) => s.pageClipboard);
  const setPageClipboard = useWorkspaceStore((s) => s.setPageClipboard);
  const pages = useWorkspaceStore((s) => s.pages);
  const { upsertPages } = usePages({ autoLoad: false });
  const [moveMode, setMoveMode] = useState(false);
  const [moveQuery, setMoveQuery] = useState("");
  const [moveTargets, setMoveTargets] = useState<Page[]>([]);
  const [moveTargetsLoading, setMoveTargetsLoading] = useState(false);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const el = document.getElementById("page-context-menu");
      if (el?.contains(event.target as Node)) return;
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (moveMode) setMoveMode(false);
        else onClose();
      }
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, moveMode]);

  useEffect(() => {
    if (!moveMode) return;
    let cancelled = false;
    const timer = window.setTimeout(
      () => {
        setMoveTargetsLoading(true);
        listMoveTargetPageMetadata({
          pageId,
          query: moveQuery,
          limit: 20,
        })
          .then((targets) => {
            if (!cancelled) setMoveTargets(targets);
          })
          .catch(() => {
            if (!cancelled) setMoveTargets([]);
          })
          .finally(() => {
            if (!cancelled) setMoveTargetsLoading(false);
          });
      },
      moveQuery.trim() ? 120 : 0
    );
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [moveMode, pageId, moveQuery]);

  const copyLink = async () => {
    const url = `${window.location.origin}/page/${pageId}`;
    try {
      await window.navigator.clipboard.writeText(url);
    } catch {
      window.prompt("复制页面链接：", url);
    }
  };

  const duplicate = async () => {
    const { duplicatePageDeepWithCloud } = await loadPageMutationModule();
    const duplicate = await duplicatePageDeepWithCloud(pageId, null);
    if (duplicate) upsertPages([duplicate]);
    onChanged?.();
  };

  const cutPage = () => {
    setPageClipboard({ pageId, mode: "cut" });
  };

  const copyPage = () => {
    setPageClipboard({ pageId, mode: "copy" });
  };

  const pastePage = async () => {
    if (!pageClipboard) return;
    const { duplicatePageDeepWithCloud, movePageWithCloud } =
      await loadPageMutationModule();
    if (pageClipboard.mode === "cut") {
      const pos = await getNextPosition(pageId);
      const moved = await movePageWithCloud(pageClipboard.pageId, pageId, pos);
      if (moved) upsertPages(collectMovedPageSnapshots(pages, moved));
      setPageClipboard(null);
    } else {
      const duplicate = await duplicatePageDeepWithCloud(
        pageClipboard.pageId,
        pageId
      );
      if (duplicate) upsertPages([duplicate]);
    }
    onChanged?.();
  };

  const moveToTrash = async () => {
    const ok = window.confirm("移到回收站？之后可以从侧边栏回收站恢复。");
    if (!ok) return;
    const snapshot = await getPage(pageId).catch(() => null);
    const deletedAt = new Date().toISOString();
    try {
      await deletePage(pageId);
    } finally {
      if (snapshot) {
        void queuePageContextMenuCloudDelete(snapshot, deletedAt).catch(
          () => undefined
        );
      }
      if (snapshot) {
        upsertPages([
          {
            ...snapshot,
            deleted_at: deletedAt,
            updated_at: deletedAt,
          },
        ]);
      }
    }
    onChanged?.();
  };

  const handleMoveTo = async (targetId: string | null) => {
    const pos = await getNextPosition(targetId);
    const { movePageWithCloud } = await loadPageMutationModule();
    const moved = await movePageWithCloud(pageId, targetId, pos);
    if (moved) upsertPages(collectMovedPageSnapshots(pages, moved));
    setMoveMode(false);
    onChanged?.();
    onClose();
  };

  const left = Math.min(
    x,
    (typeof window !== "undefined" ? window.innerWidth : x) - 220
  );
  const top = Math.min(
    y,
    (typeof window !== "undefined" ? window.innerHeight : y) - 360
  );

  if (moveMode) {
    return (
      <div
        id="page-context-menu"
        className="fixed z-[60] w-64 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        style={{ left, top }}
        onPointerDown={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div className="border-b border-zinc-100 px-2 py-2 dark:border-zinc-800">
          <input
            type="text"
            autoFocus
            placeholder="搜索目标页面..."
            value={moveQuery}
            onChange={(e) => setMoveQuery(e.target.value)}
            className="w-full rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-sm outline-none focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
          />
        </div>
        <div className="max-h-64 overflow-y-auto py-1">
          <button
            type="button"
            onClick={() => handleMoveTo(null)}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <span className="text-xs">📂</span>
            <span>根目录</span>
          </button>
          {moveTargets.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleMoveTo(p.id)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <span className="text-xs">{p.icon || "\u{1F4C4}"}</span>
              <span className="truncate">{displayPageTitle(p.title)}</span>
            </button>
          ))}
          {moveTargets.length === 0 && (
            <p className="px-3 py-2 text-xs text-zinc-400">
              {moveTargetsLoading ? "正在搜索..." : "没有匹配页面"}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      id="page-context-menu"
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
      <Item label="剪切" shortcut="⌘X" onClick={() => run(onClose, cutPage)} />
      <Item label="复制" shortcut="⌘C" onClick={() => run(onClose, copyPage)} />
      {pageClipboard && (
        <Item
          label={`粘贴${pageClipboard.mode === "cut" ? " (移入)" : " (副本)"}`}
          shortcut="⌘V"
          onClick={() => run(onClose, () => void pastePage())}
        />
      )}
      <Divider />
      <Item
        label="移动到..."
        onClick={() => setMoveMode(true)}
      />
      <Item
        label="复制链接"
        onClick={() => run(onClose, () => void copyLink())}
      />
      <Item
        label="创建副本"
        onClick={() => run(onClose, () => void duplicate())}
      />
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

async function queuePageContextMenuCloudDelete(
  page: Page,
  deletedAt: string
): Promise<void> {
  const { queueCloudPageDelete } = await loadPageAccountSyncModule();
  queueCloudPageDelete(page, deletedAt);
}

function Item({
  label,
  onClick,
  danger = false,
  shortcut,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  shortcut?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between px-3 py-1.5 text-left transition-colors ${
        danger
          ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
          : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      }`}
      role="menuitem"
    >
      <span>{label}</span>
      {shortcut && (
        <span className="ml-2 text-[10px] text-zinc-400">{shortcut}</span>
      )}
    </button>
  );
}

function Divider() {
  return <div className="my-1 h-px bg-zinc-100 dark:bg-zinc-800" />;
}
