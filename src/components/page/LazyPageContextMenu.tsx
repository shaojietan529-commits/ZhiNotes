"use client";

import dynamic from "next/dynamic";
import type { PageContextMenuProps } from "@/components/page/PageContextMenu";

let pageContextMenuPromise:
  | Promise<typeof import("@/components/page/PageContextMenu")>
  | null = null;

function loadPageContextMenu() {
  if (!pageContextMenuPromise) {
    pageContextMenuPromise = import("@/components/page/PageContextMenu").catch(
      (error) => {
        pageContextMenuPromise = null;
        throw error;
      }
    );
  }
  return pageContextMenuPromise;
}

export function warmPageContextMenu() {
  void loadPageContextMenu().catch(() => undefined);
}

const LazyPageContextMenu = dynamic<PageContextMenuProps>(loadPageContextMenu, {
  ssr: false,
  loading: () => null,
});

export default LazyPageContextMenu;
