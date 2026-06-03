"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";

function BookmarkComponent({ node, updateAttributes }: NodeViewProps) {
  const url = String(node.attrs.url || "");
  const title = String(node.attrs.title || url || "Bookmark");
  const description = String(node.attrs.description || "");
  const openUrl = getSafeBookmarkUrl(url);

  return (
    <NodeViewWrapper className="my-3" data-type="bookmark-block">
      <div
        className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
        contentEditable={false}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-xs font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            URL
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <input
              value={title}
              onChange={(event) => updateAttributes({ title: event.target.value })}
              placeholder="Bookmark title"
              className="w-full bg-transparent text-sm font-semibold text-zinc-900 outline-none placeholder:text-zinc-300 dark:text-zinc-100 dark:placeholder:text-zinc-600"
            />
            <input
              value={description}
              onChange={(event) =>
                updateAttributes({ description: event.target.value })
              }
              placeholder="Optional description"
              className="w-full bg-transparent text-xs text-zinc-500 outline-none placeholder:text-zinc-300 dark:text-zinc-400 dark:placeholder:text-zinc-600"
            />
            <input
              value={url}
              onChange={(event) => updateAttributes({ url: event.target.value })}
              placeholder="https://..."
              className="w-full truncate bg-transparent text-xs text-blue-600 outline-none placeholder:text-zinc-300 dark:text-blue-400 dark:placeholder:text-zinc-600"
            />
          </div>
          {openUrl && (
            <a
              href={openUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-500 no-underline hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              Open
            </a>
          )}
        </div>
      </div>
    </NodeViewWrapper>
  );
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    bookmarkBlock: {
      insertBookmark: (attrs: {
        url: string;
        title?: string;
        description?: string;
      }) => ReturnType;
    };
  }
}

export const BookmarkNode = Node.create({
  name: "bookmarkBlock",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      url: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-url") || "",
        renderHTML: (attributes) => ({ "data-url": attributes.url }),
      },
      title: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-title") || "",
        renderHTML: (attributes) => ({ "data-title": attributes.title }),
      },
      description: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-description") || "",
        renderHTML: (attributes) => ({
          "data-description": attributes.description,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="bookmark-block"]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "bookmark-block" }),
      [
        "a",
        { href: getSafeBookmarkUrl(String(node.attrs.url || "")) || "#" },
        node.attrs.title || node.attrs.url,
      ],
      ["p", node.attrs.description],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(BookmarkComponent);
  },

  addCommands() {
    return {
      insertBookmark:
        (attrs) =>
        ({ chain }) =>
          chain()
            .insertContent({
              type: this.name,
              attrs: {
                url: getSafeBookmarkUrl(attrs.url) || attrs.url,
                title: attrs.title ?? attrs.url,
                description: attrs.description ?? "",
              },
            })
            .run(),
    };
  },
});

function getSafeBookmarkUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed)) {
    return trimmed;
  }
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return "";
}
