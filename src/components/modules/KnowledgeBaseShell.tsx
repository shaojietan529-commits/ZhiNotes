"use client";

// 知识库 board: a free-form grid of page cards under the knowledge-base
// workspace root. Each card is a real local page — typically one company —
// that accumulates research: meeting notes become sub-pages, and local
// files (HTML/PDF/Excel/Word/PPT…) import as file sub-pages. Cards drag to
// reorder; dropping one card onto another nests it as a sub-page. Files
// stay in browser IndexedDB (no upload, no AI, no external fetch).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "@/components/sidebar/Sidebar";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useLocalFirstPageNavigation } from "@/hooks/useLocalFirstPageNavigation";
import {
  getNextPosition,
  updateWikiLinks,
} from "@/lib/db/local/queries";
import { getModuleRootId } from "@/lib/pages/moduleWorkspaces";
import { displayPageTitle } from "@/lib/pages/displayTitle";
import {
  buildIndustryCompanyLinkPathIndex,
  buildIndustryCompanyLinkContent,
  buildIndustryCompanyLinkProperties,
  getLinkedKnowledgeCompanyPageId,
  isKnowledgeCompanyLinkPage,
  type IndustryCompanyLinkPath,
} from "@/lib/pages/industryChainCompanyLinks";
import { savePageFile, type PageFileKind } from "@/lib/files/localStore";
import {
  buildFileLibraryPageContent,
  buildFileLibraryPageTitle,
} from "@/lib/files/filePage";
import PageContextMenu from "@/components/page/LazyPageContextMenu";
import PagePeekModal, {
  warmPagePeekModal,
} from "@/components/page/LazyPagePeekModal";
import {
  listScopedPageMetadata,
  mergePageMetadata,
} from "@/lib/pages/scopedPageMetadata";
import type { Page } from "@/lib/utils/types";

const loadPageMutationModule = () => import("@/lib/pages/cloudPageMutations");

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

type IndustryParentOption = {
  page: Page;
  path: string;
  childCount: number;
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
  const openPage = useLocalFirstPageNavigation();
  const dbReady = useWorkspaceStore((s) => s.dbReady);
  const upsertWorkspacePages = useWorkspaceStore((s) => s.upsertPages);
  const pagesById = useWorkspaceStore((s) => s.pagesById);
  const [pages, setPages] = useState<Page[]>([]);
  const [rootId, setRootId] = useState<string | null>(null);
  const [industryRootId, setIndustryRootId] = useState<string | null>(null);
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
  const [industryLinkNotice, setIndustryLinkNotice] = useState<string | null>(
    null
  );
  const [industryLinkCardId, setIndustryLinkCardId] = useState<string | null>(
    null
  );
  const [undoNotice, setUndoNotice] = useState<string | null>(null);
  const pushPageMove = useWorkspaceStore((s) => s.pushPageMove);
  const popPageMove = useWorkspaceStore((s) => s.popPageMove);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Which page imported files should land under (null = board root).
  const importTargetRef = useRef<string | null>(null);
  const mergeScopedPages = useCallback(
    (incoming: Page[]) => {
      setPages((current) => mergePageMetadata(current, incoming));
      upsertWorkspacePages(incoming);
    },
    [upsertWorkspacePages]
  );

  useEffect(() => {
    if (!dbReady) return;
    queueMicrotask(() => {
      void getModuleRootId("knowledge-base").then(setRootId);
      void getModuleRootId("industry-chain").then(setIndustryRootId);
    });
  }, [dbReady]);

  const loadScopedPages = useCallback(async () => {
    const roots = [rootId, industryRootId].filter((id): id is string =>
      Boolean(id)
    );
    if (roots.length === 0) return;
    const scoped = (
      await Promise.all(
        roots.map((id) =>
          listScopedPageMetadata(id, {
            includeRoot: true,
            includeDescendants: true,
          })
        )
      )
    ).flat();
    setPages(mergePageMetadata([], scoped));
    upsertWorkspacePages(scoped);
  }, [industryRootId, rootId, upsertWorkspacePages]);

  useEffect(() => {
    if (!rootId && !industryRootId) return;
    queueMicrotask(() => {
      void loadScopedPages();
    });
  }, [industryRootId, loadScopedPages, rootId]);

  const cards = useMemo(
    () =>
      rootId
        ? pages
            .filter((p) => p.parent_id === rootId)
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        : [],
    [pages, rootId]
  );

  const industryParentOptions = useMemo(
    () =>
      industryRootId ? buildIndustryParentOptions(pages, industryRootId) : [],
    [pages, industryRootId]
  );

  const industryLinkCard = useMemo(
    () =>
      industryLinkCardId
        ? pagesById.get(industryLinkCardId) ?? null
        : null,
    [industryLinkCardId, pagesById]
  );
  const industryLinksByCompanyId = useMemo(
    () =>
      industryRootId
        ? buildIndustryCompanyLinkPathIndex(pages, industryRootId)
        : new Map<string, IndustryCompanyLinkPath[]>(),
    [industryRootId, pages]
  );
  const peekPage = useMemo(
    () =>
      peekPageId ? pagesById.get(peekPageId) ?? null : null,
    [pagesById, peekPageId]
  );
  const openKnowledgePage = useCallback(
    (id: string) => {
      openPage(pagesById.get(id) ?? id, { source: "module-open" });
    },
    [openPage, pagesById]
  );
  const openKnowledgePeek = useCallback((id: string) => {
    warmPagePeekModal();
    setPeekPageId(id);
  }, []);

  // New cards start untitled and icon-less (Notion-style); the title input
  // in the peek modal shows a 新页面 placeholder to type straight into.
  const addCard = useCallback(async () => {
    if (!rootId) return;
    const { createPageWithCloud } = await loadPageMutationModule();
    const page = await createPageWithCloud({ parentId: rootId });
    mergeScopedPages([page]);
    warmPagePeekModal();
    setPeekPageId(page.id);
  }, [mergeScopedPages, rootId]);

  const renameCard = useCallback(
    async (id: string, title: string) => {
      const { updatePageWithCloud } = await loadPageMutationModule();
      const updated = await updatePageWithCloud(id, { title });
      if (updated) mergeScopedPages([updated]);
    },
    [mergeScopedPages]
  );

  const linkCardToIndustryParent = useCallback(
    async (parentId: string) => {
      if (!industryLinkCard) return;

      const existing = pages.find(
        (page) =>
          page.parent_id === parentId &&
          getLinkedKnowledgeCompanyPageId(page) === industryLinkCard.id
      );

      if (existing) {
        setIndustryLinkCardId(null);
        setIndustryLinkNotice("这个产业链层级已经链接过这家公司。");
        window.setTimeout(() => setIndustryLinkNotice(null), 2600);
        return;
      }

      const { createPageWithCloud, updatePageWithCloud } =
        await loadPageMutationModule();
      const linkPage = await createPageWithCloud({
        parentId,
        title: displayPageTitle(industryLinkCard.title),
        icon: industryLinkCard.icon ?? "🏢",
      });
      const updatedLinkPage = await updatePageWithCloud(linkPage.id, {
        properties: buildIndustryCompanyLinkProperties(industryLinkCard),
        content_text: buildIndustryCompanyLinkContent(industryLinkCard),
      });
      await updateWikiLinks(linkPage.id, [industryLinkCard.id]);
      mergeScopedPages([updatedLinkPage ?? linkPage]);
      setIndustryLinkCardId(null);
      setIndustryLinkNotice(
        `已把「${displayPageTitle(industryLinkCard.title)}」链入产业链。`
      );
      window.setTimeout(() => setIndustryLinkNotice(null), 2600);
    },
    [industryLinkCard, mergeScopedPages, pages]
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
      const importedPages: Page[] = [];
      try {
        const { createPageWithCloud, updatePageWithCloud } =
          await loadPageMutationModule();
        for (const file of Array.from(fileList)) {
          const stored = await savePageFile(file);
          const page = await createPageWithCloud({
            parentId,
            title: buildFileLibraryPageTitle(stored),
            icon: fileKindIcon(stored.kind),
          });
          const updated = await updatePageWithCloud(page.id, {
            content_text: buildFileLibraryPageContent(stored),
          });
          importedPages.push(updated ?? page);
          imported += 1;
        }
        mergeScopedPages(importedPages);
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
    [mergeScopedPages, rootId]
  );

  const pickFilesFor = useCallback((parentId: string | null) => {
    importTargetRef.current = parentId;
    fileInputRef.current?.click();
  }, []);

  const handleDragEnd = useCallback(async () => {
    const dragged = draggedId;
    const spot = dropSpot;
    setDraggedId(null);
    setDropSpot(null);
    if (!dragged || !spot || dragged === spot.pageId || !rootId) return;

    const target = cards.find((c) => c.id === spot.pageId);
    if (!target) return;

    const draggedPage = pages.find((p) => p.id === dragged);
    const prevParentId = draggedPage?.parent_id ?? null;
    const prevPosition = draggedPage?.position ?? 0;

    try {
      const { movePageWithCloud } = await loadPageMutationModule();
      let newParentId: string;
      let newPosition: number;
      if (spot.position === "inside") {
        newPosition = await getNextPosition(target.id);
        newParentId = target.id;
        const moved = await movePageWithCloud(dragged, newParentId, newPosition);
        if (moved) mergeScopedPages([moved]);
      } else {
        newParentId = rootId;
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
        newPosition =
          insertIndex === 0 ? prevPos - 1 : (prevPos + nextPos) / 2;
        const moved = await movePageWithCloud(dragged, newParentId, newPosition);
        if (moved) mergeScopedPages([moved]);
      }
      pushPageMove({
        pageId: dragged,
        fromParentId: prevParentId,
        fromPosition: prevPosition,
        toParentId: newParentId,
        toPosition: newPosition,
        timestamp: Date.now(),
      });
    } catch (err) {
      console.error("[Zhinote] Knowledge base drag move failed:", err);
    }
  }, [draggedId, dropSpot, cards, mergeScopedPages, pages, rootId, pushPageMove]);

  const handleUndo = useCallback(async () => {
    const record = popPageMove();
    if (!record) return;
    try {
      const { movePageWithCloud } = await loadPageMutationModule();
      const moved = await movePageWithCloud(
        record.pageId,
        record.fromParentId!,
        record.fromPosition
      );
      if (moved) mergeScopedPages([moved]);
      setUndoNotice("已撤回移动");
      setTimeout(() => setUndoNotice(null), 2000);
    } catch (err) {
      console.error("[Zhinote] Undo move failed:", err);
    }
  }, [mergeScopedPages, popPageMove]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        const active = document.activeElement;
        const isEditing =
          active instanceof HTMLInputElement ||
          active instanceof HTMLTextAreaElement ||
          (active instanceof HTMLElement && active.isContentEditable);
        if (isEditing) return;
        e.preventDefault();
        void handleUndo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleUndo]);

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

          {undoNotice && (
            <p className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300">
              {undoNotice}
            </p>
          )}

          {importNotice && (
            <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
              {importNotice}
            </p>
          )}

          {industryLinkNotice && (
            <p className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300">
              {industryLinkNotice}
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
                  industryLinks={industryLinksByCompanyId.get(card.id) ?? []}
                  dragged={draggedId === card.id}
                  dropSpot={dropSpot?.pageId === card.id ? dropSpot : null}
                  anyDragging={draggedId !== null}
                  onOpen={openKnowledgePeek}
                  onOpenFull={openKnowledgePage}
                  onOpenIndustryParent={openKnowledgePage}
                  onPrimeOpen={warmPagePeekModal}
                  onRename={(id, title) => void renameCard(id, title)}
                  onImport={(id) => pickFilesFor(id)}
                  onLinkIndustry={(id) => setIndustryLinkCardId(id)}
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
          initialPage={peekPage}
          onClose={() => setPeekPageId(null)}
          onOpenFull={openKnowledgePage}
          onChanged={() => void loadScopedPages()}
        />
      )}

      {contextMenu && (
        <PageContextMenu
          pageId={contextMenu.pageId}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onOpen={openKnowledgePeek}
          onOpenFull={openKnowledgePage}
          onChanged={() => void loadScopedPages()}
        />
      )}

      {industryLinkCard && (
        <IndustryParentPickerDialog
          companyPage={industryLinkCard}
          options={industryParentOptions}
          onChoose={(parentId) => void linkCardToIndustryParent(parentId)}
          onClose={() => setIndustryLinkCardId(null)}
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

function buildIndustryParentOptions(
  pages: Page[],
  rootId: string
): IndustryParentOption[] {
  const childrenByParent = new Map<string, Page[]>();
  for (const page of pages) {
    if (!page.parent_id || isKnowledgeCompanyLinkPage(page)) continue;
    const bucket = childrenByParent.get(page.parent_id) ?? [];
    bucket.push(page);
    childrenByParent.set(page.parent_id, bucket);
  }
  for (const bucket of childrenByParent.values()) {
    bucket.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }

  const options: IndustryParentOption[] = [];
  const walk = (parentId: string, pathParts: string[]) => {
    for (const child of childrenByParent.get(parentId) ?? []) {
      const title = displayPageTitle(child.title);
      const nextPath = [...pathParts, title];
      const childCount = (childrenByParent.get(child.id) ?? []).length;
      options.push({
        page: child,
        path: nextPath.join(" / "),
        childCount,
      });
      walk(child.id, nextPath);
    }
  };

  walk(rootId, []);
  return options;
}

function IndustryParentPickerDialog({
  companyPage,
  options,
  onChoose,
  onClose,
}: {
  companyPage: Page;
  options: IndustryParentOption[];
  onChoose: (parentId: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleOptions = options.filter(
    (option) =>
      !normalizedQuery ||
      option.path.toLowerCase().includes(normalizedQuery) ||
      displayPageTitle(option.page.title).toLowerCase().includes(normalizedQuery)
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/35 px-4 pt-[12vh] backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                链入产业链
              </h2>
              <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                为「{displayPageTitle(companyPage.title)}」选择一个产业链层级。只创建引用，不搬动公司页。
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-2 py-1 text-sm text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              title="关闭"
            >
              ×
            </button>
          </div>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索产业链层级…"
            className="mt-3 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 outline-none transition-colors placeholder:text-zinc-400 focus:border-blue-400 focus:bg-white dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-500 dark:focus:bg-zinc-950"
          />
        </div>

        <div className="max-h-[46vh] overflow-y-auto p-2">
          {options.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
              产业链研究里还没有分类。先到「产业链研究」创建一级分类，再回来链接公司页。
            </div>
          ) : visibleOptions.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
              没有匹配的产业链层级。
            </div>
          ) : (
            <div className="space-y-1">
              {visibleOptions.map((option) => (
                <button
                  key={option.page.id}
                  type="button"
                  disabled={Boolean(busyId)}
                  onClick={() => {
                    setBusyId(option.page.id);
                    onChoose(option.page.id);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-55 dark:hover:bg-zinc-900"
                >
                  <span className="text-lg">{option.page.icon || "📂"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">
                      {displayPageTitle(option.page.title)}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-zinc-400">
                      {option.path}
                      {option.childCount > 0
                        ? ` · ${option.childCount} 个下级`
                        : ""}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
                    {busyId === option.page.id ? "链接中…" : "选择"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KnowledgeCard({
  card,
  allPages,
  industryLinks,
  dragged,
  dropSpot,
  anyDragging,
  onOpen,
  onOpenFull,
  onOpenIndustryParent,
  onPrimeOpen,
  onRename,
  onImport,
  onLinkIndustry,
  onContextMenu,
  onDragStart,
  onDragEnd,
  onDropSpotChange,
}: {
  card: Page;
  allPages: Page[];
  industryLinks: IndustryCompanyLinkPath[];
  dragged: boolean;
  dropSpot: DropSpot | null;
  anyDragging: boolean;
  onOpen: (id: string) => void;
  onOpenFull: (id: string) => void;
  onOpenIndustryParent: (id: string) => void;
  onPrimeOpen: () => void;
  onRename: (id: string, title: string) => void;
  onImport: (id: string) => void;
  onLinkIndustry: (id: string) => void;
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
        onPointerEnter={onPrimeOpen}
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
          <span className="shrink-0 text-xl">{card.icon || "📄"}</span>
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
              onPointerEnter={onPrimeOpen}
              onFocus={onPrimeOpen}
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
          {industryLinks.length > 0 && (
            <span
              className="shrink-0 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-blue-950/50 dark:text-blue-300"
              title={`已链入 ${industryLinks.length} 个产业链层级`}
            >
              链 {industryLinks.length}
            </span>
          )}
        </div>

        {/* Sub-page chips */}
        <div className="mt-2.5 flex min-h-[3.5rem] flex-1 flex-col gap-1">
          {children.slice(0, 4).map((child) => (
            <button
              key={child.id}
              type="button"
              onPointerEnter={onPrimeOpen}
              onFocus={onPrimeOpen}
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

        {industryLinks.length > 0 && (
          <div className="mt-2 border-t border-zinc-100 pt-2 dark:border-zinc-800">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[10px] font-medium text-zinc-400">
                产业链位置
              </span>
              {industryLinks.length > 2 && (
                <span className="text-[10px] text-zinc-400">
                  +{industryLinks.length - 2}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {industryLinks.slice(0, 2).map((link) => (
                <button
                  key={link.linkPageId}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (link.parentId) onOpenIndustryParent(link.parentId);
                  }}
                  className="max-w-full truncate rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700 transition-colors hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/50"
                  title={`打开产业链层级：${link.parentPath}`}
                >
                  {link.parentPath}
                </button>
              ))}
            </div>
          </div>
        )}

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
          <button
            type="button"
            onClick={() => onLinkIndustry(card.id)}
            className="rounded px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            title="把这张公司页链接到产业链研究的某个层级"
          >
            🔗 {industryLinks.length > 0 ? "继续链入" : "链入产业链"}
          </button>
        </div>
      </div>
    </div>
  );
}
