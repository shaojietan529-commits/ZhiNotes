"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useEffect } from "react";
import { usePages } from "@/hooks/usePages";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { Page } from "@/lib/utils/types";

function BreadcrumbBlockComponent({ node, updateAttributes }: NodeViewProps) {
  const { pages } = usePages();
  const currentPageId = useWorkspaceStore((state) => state.currentPageId);
  const pageId = String(node.attrs.pageId || currentPageId || "");
  const path = getPagePath(pageId, pages);
  const pathLabel = path.join(" / ");

  useEffect(() => {
    const nextAttrs: { pageId?: string; path?: string } = {};
    if (pageId && node.attrs.pageId !== pageId) nextAttrs.pageId = pageId;
    if (pathLabel && node.attrs.path !== pathLabel) nextAttrs.path = pathLabel;
    if (Object.keys(nextAttrs).length > 0) updateAttributes(nextAttrs);
  }, [node.attrs.pageId, node.attrs.path, pageId, pathLabel, updateAttributes]);

  return (
    <NodeViewWrapper
      className="my-3"
      data-type="breadcrumb-block"
      data-page-id={pageId}
      data-path={pathLabel}
    >
      <div
        className="flex flex-wrap items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
        contentEditable={false}
      >
        {path.length > 0 ? (
          path.map((part, index) => (
            <span key={`${part}-${index}`} className="inline-flex items-center gap-1">
              {index > 0 && <span className="text-zinc-300 dark:text-zinc-600">/</span>}
              <span className={index === path.length - 1 ? "font-medium text-zinc-700 dark:text-zinc-200" : ""}>
                {part}
              </span>
            </span>
          ))
        ) : (
          <span>页面路径</span>
        )}
      </div>
    </NodeViewWrapper>
  );
}

function getPagePath(pageId: string, pages: Page[]) {
  const pagesById = new Map(pages.map((page) => [page.id, page]));
  const path: string[] = [];
  const seen = new Set<string>();
  let cursor: string | null = pageId;

  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const page = pagesById.get(cursor);
    if (!page) break;
    path.unshift(page.title || "未命名页面");
    cursor = page.parent_id;
  }

  return path;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    breadcrumbBlock: {
      insertBreadcrumbBlock: (pageId?: string) => ReturnType;
    };
  }
}

export const BreadcrumbBlockNode = Node.create({
  name: "breadcrumbBlock",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      pageId: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-page-id") || "",
        renderHTML: (attributes) => ({ "data-page-id": attributes.pageId }),
      },
      path: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-path") || "",
        renderHTML: (attributes) => ({ "data-path": attributes.path }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="breadcrumb-block"]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "breadcrumb-block" }),
      node.attrs.path || "页面路径",
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(BreadcrumbBlockComponent);
  },

  addCommands() {
    return {
      insertBreadcrumbBlock:
        (pageId?: string) =>
        ({ chain }) =>
          chain()
            .insertContent({
              type: this.name,
              attrs: { pageId: pageId ?? "" },
            })
            .run(),
    };
  },
});
