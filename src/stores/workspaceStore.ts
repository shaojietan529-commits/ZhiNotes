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
  setCurrentPageId: (id: string | null) => void;
  toggleSidebar: () => void;
  setDbReady: (ready: boolean) => void;
  setPageClipboard: (clip: PageClipboard | null) => void;
  pushPageMove: (record: PageMoveRecord) => void;
  popPageMove: () => PageMoveRecord | undefined;
}

const MAX_MOVE_HISTORY = 20;

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  pages: [],
  currentPageId: null,
  sidebarOpen: true,
  dbReady: false,
  pageClipboard: null,
  pageMoveHistory: [],
  setPages: (pages) => set({ pages }),
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
