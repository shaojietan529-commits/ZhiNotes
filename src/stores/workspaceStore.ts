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
  currentPageId: string | null;
  sidebarOpen: boolean;
  dbReady: boolean;
  pageClipboard: PageClipboard | null;
  pageMoveHistory: PageMoveRecord[];
  setPages: (pages: Page[]) => void;
  upsertPages: (pages: Page[]) => void;
  setCurrentPageId: (id: string | null) => void;
  toggleSidebar: () => void;
  setDbReady: (ready: boolean) => void;
  setPageClipboard: (clip: PageClipboard | null) => void;
  pushPageMove: (record: PageMoveRecord) => void;
  popPageMove: () => PageMoveRecord | undefined;
}

const MAX_MOVE_HISTORY = 20;

function sortPagesForWorkspace(pages: Page[]): Page[] {
  return [...pages].sort((a, b) => {
    const updated = (b.updated_at || "").localeCompare(a.updated_at || "");
    if (updated !== 0) return updated;
    return a.id.localeCompare(b.id);
  });
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
  incomingPages: Page[]
): Page[] {
  const incomingById = new Map(incomingPages.map((page) => [page.id, page]));
  return currentPages.map((page) => {
    const incoming = incomingById.get(page.id);
    return incoming ? mergePageSnapshot(incoming, page) : page;
  });
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  pages: [],
  currentPageId: null,
  sidebarOpen: true,
  dbReady: false,
  pageClipboard: null,
  pageMoveHistory: [],
  setPages: (pages) =>
    set((s) => {
      const previous = new Map(s.pages.map((page) => [page.id, page]));
      return {
        pages: sortPagesForWorkspace(
          pages.map((page) => mergePageSnapshot(page, previous.get(page.id)))
        ),
      };
    }),
  upsertPages: (pages) =>
    set((s) => {
      if (pages.length === 0) return {};
      const byId = new Map(s.pages.map((page) => [page.id, page]));
      if (canPatchPagesWithoutResort(pages, byId)) {
        return { pages: patchPagesWithoutResort(s.pages, pages) };
      }
      for (const page of pages) {
        if (page.deleted_at) {
          byId.delete(page.id);
        } else {
          byId.set(page.id, mergePageSnapshot(page, byId.get(page.id)));
        }
      }
      return { pages: sortPagesForWorkspace([...byId.values()]) };
    }),
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
