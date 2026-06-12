"use client";

// 知识库 board: a free-form grid of page cards under the knowledge-base
// workspace root. Each card is a real local page — typically one company —
// that accumulates research: meeting notes become sub-pages, and local
// files (HTML/PDF/Excel/Word/PPT…) import as file sub-pages. Cards drag to
// reorder; dropping one card onto another nests it as a sub-page. Files
// stay in browser IndexedDB (no upload, no AI, no external fetch).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/sidebar/Sidebar";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { usePages } from "@/hooks/usePages";
import {
  createPage,
  updatePage,
  movePage,
  getNextPosition,
} from "@/lib/db/local/queries";
import { getModuleRootId } from "@/lib/pages/moduleWorkspaces";
import { displayPageTitle } from "@/lib/pages/displayTitle";
import { savePageFile, type PageFileKind } from "@/lib/files/localStore";
import {
  buildFileLibraryPageContent,
  buildFileLibraryPageTitle,
} from "@/lib/files/filePage";
import PageContextMenu from "@/components/page/PageContextMenu";
import PagePeekModal from "@/components/page/PagePeekModal";
import type { Page } from "@/lib/utils/types";

const IMPORT_ACCEPT = [
  ".html",
  ".htm",
  ".md",
  ".markdown",
  ".pdf",
  ".xlsx",
  ".xls",
  ".csv",
  ".docx",
  ".doc",
  ".pptx",
  ".ppt",
  ".txt",
].join(",");

type DropSpot = {
  pageId: string;
  position: "before" | "inside" | "after";
};

function fileKindIcon(kind: PageFileKind): string {
  if (kind === "pdf") return "📕";
  if (kind === "spreadsheet") return "📊";
  if (kind === "word") return "📝";
  if (kind === "presentation") return "📽️";
  if (kind === "html") return "🌐";
  if (kind === "markdown") return "✏️";
  if (kind === "image") return "🖼️";
  if (kind === "audio" || kind === "video") return "🎬";
  return "📄";
}

export default function KnowledgeBaseShell() {
  const router = useRouter();
  const dbReady = useWorkspaceStore((s) => s.dbReady);
  const { pages, refresh } = usePages();
  const [rootId, setRootId] = useState<string | null>(null);
  const [peekPageId, setPeekPageId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    pageId: string;
    x: number;
    y: number;
  } | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropSpot, setDropSpot] = useState<DropSpot | null>(null);
  const [importing, setImporting] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Which page imported files should land under (null = board root).
  const importTargetRef = useRef<string | null>(null);

  useEffect(() => {
    if (!dbReady) return;
    queueMicrotask(() => {
      void getModuleRootId("knowledge-base").then(setRootId);
    });
  }, [dbReady]);

  const cards = useMemo(
    () =>
      rootId
        ? pages
            .filter((p) => p.parent_id === rootId)
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        : [],
    [pages, rootId]
  );

  const addCard = useCallback(async () => {
    if (!rootId) return;
    const page = await createPage({
      parentId: rootId,
      title: "未命名公司",
      icon: "🏢",
    });
    await refresh();
    setPeekPageId(page.id);
  }, [rootId, refresh]);

  const renameCard = useCallback(
    async (id: string, title: string) => {
      await updatePage(id, { title });
      await refresh();
    },
    [refresh]
  );

  // Owner-confirmed import: triggered only by an explicit file pick. Files
  // go to browser IndexedDB and each becomes a sub-page with a local
  // preview block — same contract as the Files module.
  const importFiles = useCallback(
    async (fileList: FileList) => {
      const parentId = importTargetRef.current ?? rootId;
      if (!parentId) return;
      setImporting(true);
      setImportNotice(null);
      let imported = 0;
      try {
        for (const file of Array.from(fileList)) {
          const stored = await savePageFile(file);
          const page = await createPage({
            parentId,
            title: buildFileLibraryPageTitle(stored),
            icon: fileKindIcon(stored.kind),
          });
          await updatePage(page.id, {
            content_text: buildFileLibraryPageContent(stored),
          });
          imported += 1;
        }
        await refresh();
        setImportNotice(`已导入 ${imported} 个文件（仅保存在本机浏览器）。`);
      } catch (err) {
        console.error("[Zhinote] Knowledge base file import failed:", err);
        setImportNotice(
          imported > 0
            ? `导入中断：成功 ${imported} 个，其余失败，请重试。`
            : "导入失败，请重试。"
        );
      } finally {
        setImporting(false);
        importTargetRef.current = null;
      }
    },
    [rootId, refresh]
  );

  const pickFilesFor = useCallback((parentId: string | null) => {
    importTargetRef.current = parentId;
    fileInputRef.current?.click();
  }, []);

  // Drag handling: before/after reorders within the board, inside nests the
  // dragged card as a sub-page of the target.
  const handleDragEnd = useCallback(async () => {
    const dragged = draggedId;
    const spot = dropSpot;
    setDraggedId(null);
    setDropSpot(null);
    if (!dragged || !spot || dragged === spot.pageId || !rootId) return;

    const target = cards.find((c) => c.id === spot.pageId);
    if (!target) return;

    try {
      if (spot.position === "inside") {
        const pos = await getNextPosition(target.id);
        await movePage(dragged, target.id, pos);
      } else {
        const siblings = cards.filter((c) => c.id !== dragged);
        const targetIndex = siblings.findIndex((c) => c.id === target.id);
        const insertIndex =
          spot.position === "before" ? targetIndex : targetIndex + 1;
        const prevPos =
          insertIndex > 0 ? (siblings[insertIndex - 1]?.position ?? 0) : 0;
        const nextPos =
          insertIndex < siblings.length
            ? (siblings[insertIndex]?.position ?? prevPos + 2)
            : prevPos + 2;
        const newPosition =
          insertIndex === 0 ? prevPos - 1 : (prevPos + nextPos) / 2;
        await movePage(dragged, rootId, newPosition);
      }
      await refresh();
    } catch (err) {
      console.error("[Zhinote] Knowledge base drag move failed:", err);
    }
  }, [draggedId, dropSpot, cards, rootId, refresh]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-zinc-50/40 dark:bg-zinc-950">
        <div className="mx-auto max-w-5xl px-8 py-10">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={IMPORT_ACCEPT}
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) void importFiles(e.target.files);
              e.target.value = "";
            }}
          />

          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <h1 className="flex items-center gap-2.5 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                <span className="text-3xl">📚</span> 知识库
              </h1>
              <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                每张卡片是一个页面（建议一家公司一张卡）。纪要、文件都装进卡片里
                变成子页面；拖动卡片排版，拖到另一张卡上则并入它的名下。
              </p>
            </div>
            {rootId && (
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => pickFilesFor(null)}
                  disabled={importing}
                  className="rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm text-zinc-600 shadow-sm transition-colors hover:border-zinc-400 hover:text-zinc-800 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
                  title="导入 HTML / PDF / Excel / Word / PPT 等本地文件，文件只存在本机浏览器"
                >
                  {importing ? "导入中…" : "⬆ 导入文件"}
                </button>
                <button
                  type="button"
                  onClick={() => void addCard()}
                  className="rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-zinc-700 hover:shadow active:scale-95 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                >
                  + 新建页面
                </button>
              </div>
            )}
          </div>

          {importNotice && (
            <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
              {importNotice}
            </p>
          )}

          {!rootId ? (
            <div className="py-16 text-center text-sm text-zinc-400">
              正在加载知识库…
            </div>
          ) : cards.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-white py-16 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
              <div className="mb-3 text-4xl">🗂️</div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                还没有页面。新建一张卡片（比如一家公司），或直接导入文件。
              </p>
              <button
                type="button"
                onClick={() => void addCard()}
                className="mt-4 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-600 shadow-sm transition-colors hover:border-zinc-400 hover:text-zinc-800 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
              >
                + 创建第一个页面
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map((card) => (
                <KnowledgeCard
                  key={card.id}
                  card={card}
                  allPages={pages}
                  dragged={draggedId === card.id}
                  dropSpot={dropSpot?.pageId === card.id ? dropSpot : null}
                  anyDragging={draggedId !== null}
                  onOpen={(id) => setPeekPageId(id)}
                  onOpenFull={(id) => router.push(`/page/${id}`)}
                  onRename={(id, title) => void renameCard(id, title)}
                  onImport={(id) => pickFilesFor(id)}
                  onContextMenu={(id, x, y) =>
                    setContextMenu({ pageId: id, x, y })
                  }
                  onDragStart={(id) => setDraggedId(id)}
                  onDragEnd={() => void handleDragEnd()}
                  onDropSpotChange={setDropSpot}
                />
              ))}
            </div>
          )}

          <p className="mt-8 text-xs leading-5 text-zinc-400">
            提示：单击卡片标题预览页面，双击就地重命名，右键打开菜单。
            拖动卡片到另一张卡的左/右边缘可调整顺序，拖到卡片中间则并入成为子页面。
            导入的文件只保存在本机浏览器（IndexedDB），不上传、不调用 AI。
          </p>
        </div>
      </main>

      {peekPageId && (
        <PagePeekModal
          pageId={peekPageId}
          onClose={() => setPeekPageId(null)}
          onOpenFull={(id) => router.push(`/page/${id}`)}
          onChanged={() => void refresh()}
        />
      )}

      {contextMenu && (
        <PageContextMenu
          pageId={contextMenu.pageId}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onOpen={(id) => setPeekPageId(id)}
          onOpenFull={(id) => router.push(`/page/${id}`)}
          onChanged={() => void refresh()}
        />
      )}
    </div>
  );
}

function countDescendants(pages: Page[], id: string): number {
  const children = pages.filter((p) => p.parent_id === id);
  return children.reduce(
    (sum, child) => sum + 1 + countDescendants(pages, child.id),
    0
  );
}

function KnowledgeCard({
  card,
  allPages,
  dragged,
  dropSpot,
  anyDragging,
  onOpen,
  onOpenFull,
  onRename,
  onImport,
  onContextMenu,
  onDragStart,
  onDragEnd,
  onDropSpotChange,
}: {
  card: Page;
  allPages: Page[];
  dragged: boolean;
  dropSpot: DropSpot | null;
  anyDragging: boolean;
  onOpen: (id: string) => void;
  onOpenFull: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onImport: (id: string) => void;
  onContextMenu: (id: string, x: number, y: number) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDropSpotChange: (spot: DropSpot | null) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(card.title);
  const cardRef = useRef<HTMLDivElement>(null);
  // Single click opens the page; double click renames. Delay the open so a
  // double click can cancel it (otherwise the peek modal swallows click #2).
  const clickTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (clickTimerRef.current !== null) {
        window.clearTimeout(clickTimerRef.current);
      }
    };
  }, []);

  const children = allPages
    .filter((p) => p.parent_id === card.id)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const descendantCount = countDescendants(allPages, card.id);

  const commitRename = () => {
    setRenaming(false);
    const next = draft.trim();
    if (next && next !== card.title) onRename(card.id, next);
    else setDraft(card.title);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!anyDragging || dragged) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;
    let position: DropSpot["position"];
    if (ratio < 0.25) position = "before";
    else if (ratio > 0.75) position = "after";
    else position = "inside";
    onDropSpotChange({ pageId: card.id, position });
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (cardRef.current?.contains(e.relatedTarget as Node)) return;
    if (dropSpot) onDropSpotChange(null);
  };

  const isBefore = dropSpot?.position === "before";
  const isInside = dropSpot?.position === "inside";
  const isAfter = dropSpot?.position === "after";

  return (
    <div className="relative">
      {isBefore && (
        <div className="absolute -left-2 top-2 bottom-2 w-1 rounded-full bg-blue-500 pointer-events-none z-10" />
      )}
      {isAfter && (
        <div className="absolute -right-2 top-2 bottom-2 w-1 rounded-full bg-blue-500 pointer-events-none z-10" />
      )}
      <div
        ref={cardRef}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", card.id);
          onDragStart(card.id);
        }}
        onDragEnd={onDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={(e) => e.preventDefault()}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu(card.id, e.clientX, e.clientY);
        }}
        className={`group flex h-full cursor-grab flex-col rounded-xl border bg-white p-3.5 shadow-sm transition-all hover:shadow-md active:cursor-grabbing dark:bg-zinc-900 ${
          dragged ? "opacity-40" : ""
        } ${
          isInside
            ? "border-blue-400 ring-2 ring-blue-400/60"
            : "border-zinc-200 dark:border-zinc-800"
        }`}
      >
        {/* Card header */}
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-xl">{card.icon || "🏢"}</span>
          {renaming ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") {
                  setDraft(card.title);
                  setRenaming(false);
                }
              }}
              className="min-w-0 flex-1 rounded bg-white px-1.5 py-0.5 text-sm font-semibold text-zinc-800 outline-none ring-1 ring-zinc-300 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-600"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                if (clickTimerRef.current !== null) {
                  window.clearTimeout(clickTimerRef.current);
                }
                clickTimerRef.current = window.setTimeout(() => {
                  clickTimerRef.current = null;
                  onOpen(card.id);
                }, 250);
              }}
              onDoubleClick={(e) => {
                e.preventDefault();
                if (clickTimerRef.current !== null) {
                  window.clearTimeout(clickTimerRef.current);
                  clickTimerRef.current = null;
                }
                setDraft(card.title);
                setRenaming(true);
              }}
              className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-zinc-800 transition-colors hover:text-blue-600 dark:text-zinc-100 dark:hover:text-blue-400"
              title={`${displayPageTitle(card.title)}（单击预览，双击重命名）`}
            >
              {displayPageTitle(card.title)}
            </button>
          )}
          {descendantCount > 0 && (
            <span className="shrink-0 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              {descendantCount}
            </span>
          )}
        </div>

        {/* Sub-page chips */}
        <div className="mt-2.5 flex min-h-[3.5rem] flex-1 flex-col gap-1">
          {children.slice(0, 4).map((child) => (
            <button
              key={child.id}
              type="button"
              onClick={() => onOpen(child.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onContextMenu(child.id, e.clientX, e.clientY);
              }}
              className="flex items-center gap-1.5 truncate rounded-md bg-zinc-50 px-2 py-1 text-left text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:bg-zinc-800/60 dark:text-zinc-300 dark:hover:bg-zinc-800"
              title={displayPageTitle(child.title)}
            >
              <span className="shrink-0">{child.icon || "📄"}</span>
              <span className="truncate">{displayPageTitle(child.title)}</span>
            </button>
          ))}
          {children.length > 4 && (
            <button
              type="button"
              onClick={() => onOpenFull(card.id)}
              className="px-2 text-left text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              还有 {children.length - 4} 个子页面 →
            </button>
          )}
          {children.length === 0 && (
            <p className="px-1 text-[11px] leading-5 text-zinc-300 dark:text-zinc-600">
              空页面 — 导入文件或在页面里添加纪要
            </p>
          )}
        </div>

        {/* Card actions */}
        <div className="mt-2 flex items-center gap-1 border-t border-zinc-100 pt-2 opacity-0 transition-opacity group-hover:opacity-100 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => onOpenFull(card.id)}
            className="rounded px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            打开 ↗
          </button>
          <button
            type="button"
            onClick={() => onImport(card.id)}
            className="rounded px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            title="把 HTML/PDF/Excel/Word/PPT 等文件导入为这张卡的子页面"
          >
            ⬆ 导入文件
          </button>
        </div>
      </div>
    </div>
  );
}
