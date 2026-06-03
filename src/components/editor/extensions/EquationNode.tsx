"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";

function EquationComponent({ node, updateAttributes }: NodeViewProps) {
  const formula = String(node.attrs.formula || "");

  return (
    <NodeViewWrapper className="my-3" data-type="equation-block">
      <div
        className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900"
        contentEditable={false}
      >
        <textarea
          value={formula}
          onChange={(event) => updateAttributes({ formula: event.target.value })}
          placeholder="e.g. IRR = sum(CF_t / (1 + r)^t)"
          rows={Math.max(2, Math.min(6, formula.split("\n").length + 1))}
          className="w-full resize-y bg-transparent font-mono text-sm leading-6 text-zinc-800 outline-none placeholder:text-zinc-300 dark:text-zinc-100 dark:placeholder:text-zinc-600"
        />
      </div>
    </NodeViewWrapper>
  );
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    equationBlock: {
      insertEquation: () => ReturnType;
    };
  }
}

export const EquationNode = Node.create({
  name: "equationBlock",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      formula: {
        default: "",
        parseHTML: (element) =>
          element.getAttribute("data-formula") ||
          element.querySelector("[data-equation-formula]")?.textContent ||
          "",
        renderHTML: (attributes) => ({ "data-formula": attributes.formula }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="equation-block"]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "equation-block" }),
      ["code", { "data-equation-formula": "" }, node.attrs.formula],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(EquationComponent);
  },

  addCommands() {
    return {
      insertEquation:
        () =>
        ({ chain }) =>
          chain()
            .insertContent({
              type: this.name,
              attrs: { formula: "" },
            })
            .run(),
    };
  },
});

