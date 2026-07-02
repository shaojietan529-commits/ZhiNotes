import { create } from "zustand";
import type { Page } from "@/lib/utils/types";

interface PageClipboard {
  pageId: string;
  mode: "cut" | "copy";
}

export interface PageMoveRecord {
  pageId: string;
  fromParentId: string | null;
  fromPosition: number;
  toParentId: string | null;
  toPosition: number;
  timestamp: number;
}

interface WorkspaceState {
  pages: Page[];
  pagesById: Map<string, Page>;
  currentPageId: string | null;
  sidebarOpen: boolean;
  dbReady: boolean;
  pageClipboard: PageClipboard | null;
  pageMoveHistory: PageMoveRecord[];
  setPages: (pages: Page[]) => void;
  upsertPages: (pages: Page[]) => void;
  getPageById: (id: string) => Page | undefined;
  setCurrentPageId: (id: string | null) => void;
  toggleSidebar: () => void;
  setDbReady: (ready: boolean) => void;
  setPageClipboard: (clip: PageClipboard | null) => void;
  pushPageMove: (record: PageMoveRecord) => void;
  popPageMove: () => PageMoveRecord | undefined;
}

const MAX_MOVE_HISTORY = 20;
const WORKSPACE_ORDERED_MERGE_LIMIT = 32;

function comparePagesForWorkspace(a: Page, b: Page): number {
  const updated = (b.updated_at || "").localeCompare(a.updated_at || "");
  if (updated !== 0) return updated;
  return a.id.localeCompare(b.id);
}

function sortPagesForWorkspace(pages: Page[]): Page[] {
  return [...pages].sort(comparePagesForWorkspace);
}

function indexPagesById(pages: Page[]): Map<string, Page> {
  return new Map(pages.map((page) => [page.id, page]));
}

function mergePageSnapshot(incoming: Page, existing?: Page): Page {
  if (!existing) return incoming;
  return {
    ...incoming,
    content_text:
      incoming.content_text === null && existing.content_text !== null
        ? existing.content_text
        : incoming.content_text,
    content_yjs:
      incoming.content_yjs === null && existing.content_yjs !== null
        ? existing.content_yjs
        : incoming.content_yjs,
  };
}

function hasWorkspaceOrderChange(incoming: Page, existing?: Page): boolean {
  if (!existing || incoming.deleted_at) return true;
  return (
    incoming.updated_at !== existing.updated_at ||
    incoming.parent_id !== existing.parent_id ||
    incoming.position !== existing.position ||
    incoming.depth !== existing.depth
  );
}

function canPatchPagesWithoutResort(
  incomingPages: Page[],
  currentById: Map<string, Page>
): boolean {
  if (incomingPages.length === 0) return true;
  return incomingPages.every(
    (page) => !hasWorkspaceOrderChange(page, currentById.get(page.id))
  );
}

function patchPagesWithoutResort(
  currentPages: Page[],
  incomingPages: Page[],
  currentById: Map<string, Page>
): { pages: Page[]; pagesById: Map<string, Page> } {
  const incomingById = new Map(incomingPages.map((page) => [page.id, page]));
  const pagesById = new Map(currentById);
  const pages = currentPages.map((page) => {
    const incoming = incomingById.get(page.id);
    if (!incoming) return page;
    const merged = mergePageSnapshot(incoming, page);
    pagesById.set(merged.id, merged);
    return merged;
  });
  return { pages, pagesById };
}

function insertPageInWorkspaceOrder(pages: Page[], page: Page): void {
  let low = 0;
  let high = pages.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (comparePagesForWorkspace(page, pages[mid]) < 0) {
      high = mid;
    } else {
      low = mid + 1;
    }
  }
  pages.splice(low, 0, page);
}

function canPatchPagesWithOrderedMerge(incomingPages: Page[]): boolean {
  return incomingPages.length <= WORKSPACE_ORDERED_MERGE_LIMIT;
}

function patchPagesWithOrderedMerge(
  currentPages: Page[],
  incomingPages: Page[],
  currentById: Map<string, Page>
): { pages: Page[]; pagesById: Map<string, Page> } {
  const pagesById = new Map(currentById);
  const pages = [...currentPages];
  for (const incoming of incomingPages) {
    const existing = pagesById.get(incoming.id);
    const existingIndex = existing
      ? pages.findIndex((page) => page.id === incoming.id)
      : -1;
    if (existingIndex >= 0) {
      pages.splice(existingIndex, 1);
    }

    if (incoming.deleted_at) {
      pagesById.delete(incoming.id);
      continue;
    }

    const merged = mergePageSnapshot(incoming, existing);
    pagesById.set(merged.id, merged);
    insertPageInWorkspaceOrder(pages, merged);
  }
  return { pages, pagesById };
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  pages: [],
  pagesById: new Map(),
  currentPageId: null,
  sidebarOpen: true,
  dbReady: false,
  pageClipboard: null,
  pageMoveHistory: [],
  setPages: (pages) =>
    set((s) => {
      const previous = s.pagesById;
      const nextPages = sortPagesForWorkspace(
        pages.map((page) => mergePageSnapshot(page, previous.get(page.id)))
      );
      return {
        pages: nextPages,
        pagesById: indexPagesById(nextPages),
      };
    }),
  upsertPages: (pages) =>
    set((s) => {
      if (pages.length === 0) return {};
      const byId = new Map(s.pagesById);
      if (canPatchPagesWithoutResort(pages, byId)) {
        return patchPagesWithoutResort(s.pages, pages, byId);
      }
      if (canPatchPagesWithOrderedMerge(pages)) {
        return patchPagesWithOrderedMerge(s.pages, pages, byId);
      }
      for (const page of pages) {
        if (page.deleted_at) {
          byId.delete(page.id);
        } else {
          byId.set(page.id, mergePageSnapshot(page, byId.get(page.id)));
        }
      }
      const nextPages = sortPagesForWorkspace([...byId.values()]);
      return { pages: nextPages, pagesById: indexPagesById(nextPages) };
    }),
  getPageById: (id) => get().pagesById.get(id),
  setCurrentPageId: (id) => set({ currentPageId: id }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setDbReady: (ready) => set({ dbReady: ready }),
  setPageClipboard: (clip) => set({ pageClipboard: clip }),
  pushPageMove: (record) =>
    set((s) => ({
      pageMoveHistory: [...s.pageMoveHistory, record].slice(-MAX_MOVE_HISTORY),
    })),
  popPageMove: () => {
    const { pageMoveHistory } = get();
    if (pageMoveHistory.length === 0) return undefined;
    const last = pageMoveHistory[pageMoveHistory.length - 1];
    set({ pageMoveHistory: pageMoveHistory.slice(0, -1) });
    return last;
  },
}));
