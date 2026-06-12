import { create } from "zustand";
import type { Page } from "@/lib/utils/types";

interface PageClipboard {
  pageId: string;
  mode: "cut" | "copy";
}

interface WorkspaceState {
  pages: Page[];
  currentPageId: string | null;
  sidebarOpen: boolean;
  dbReady: boolean;
  pageClipboard: PageClipboard | null;
  setPages: (pages: Page[]) => void;
  setCurrentPageId: (id: string | null) => void;
  toggleSidebar: () => void;
  setDbReady: (ready: boolean) => void;
  setPageClipboard: (clip: PageClipboard | null) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  pages: [],
  currentPageId: null,
  sidebarOpen: true,
  dbReady: false,
  pageClipboard: null,
  setPages: (pages) => set({ pages }),
  setCurrentPageId: (id) => set({ currentPageId: id }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setDbReady: (ready) => set({ dbReady: ready }),
  setPageClipboard: (clip) => set({ pageClipboard: clip }),
}));
