"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import {
  NodeViewContent,
  ReactNodeViewRenderer,
  NodeViewWrapper,
} from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";

function ToggleBlockComponent({ node, updateAttributes }: NodeViewProps) {
  const open = Boolean(node.attrs.open ?? true);
  const summary = String(node.attrs.summary || "Toggle");

  const handleOpenChange = (nextOpen: boolean) => {
    updateAttributes({ open: nextOpen });
  };

  return (
    <NodeViewWrapper className="my-2" data-type="toggle-block">
      <div
        className="rounded-md border border-transparent px-1 py-1 hover:border-zinc-200 dark:hover:border-zinc-700"
      >
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={() => handleOpenChange(!open)}
            className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            title={open ? "Collapse toggle" : "Expand toggle"}
            contentEditable={false}
          >
            {open ? "v" : ">"}
          </button>
          <input
            value={summary}
            onChange={(event) =>
              updateAttributes({ summary: event.target.value || "Toggle" })
            }
            placeholder="Toggle title"
            className="min-w-0 flex-1 bg-transparent text-sm font-medium text-zinc-900 outline-none placeholder:text-zinc-300 dark:text-zinc-100 dark:placeholder:text-zinc-600"
            contentEditable={false}
          />
        </div>
        {open && (
          <NodeViewContent
            className="ml-7 mt-1 border-l border-zinc-200 pl-3 text-sm leading-6 dark:border-zinc-700"
          />
        )}
      </div>
    </NodeViewWrapper>
  );
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    toggleBlock: {
      insertToggleBlock: () => ReturnType;
    };
  }
}

export const ToggleBlockNode = Node.create({
  name: "toggleBlock",
  group: "block",
  content: "block+",
  draggable: true,

  addAttributes() {
    return {
      summary: {
        default: "Toggle",
        parseHTML: (element) =>
          element.getAttribute("data-summary") ||
          element.querySelector("[data-toggle-summary]")?.textContent ||
          "Toggle",
        renderHTML: (attributes) => ({ "data-summary": attributes.summary }),
      },
      open: {
        default: true,
        parseHTML: (element) => element.getAttribute("data-open") !== "false",
        renderHTML: (attributes) => ({
          "data-open": String(attributes.open ?? true),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="toggle-block"]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "toggle-block" }),
      ["div", { "data-toggle-summary": "" }, node.attrs.summary],
      ["div", { "data-toggle-content": "" }, 0],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ToggleBlockComponent);
  },

  addCommands() {
    return {
      insertToggleBlock:
        () =>
        ({ chain }) =>
          chain()
            .insertContent({
              type: this.name,
              attrs: {
                summary: "Toggle",
                open: true,
              },
              content: [{ type: "paragraph" }],
            })
            .run(),
    };
  },
});
