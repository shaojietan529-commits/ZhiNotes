"use client";

import { Node, mergeAttributes, nodeInputRule } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";

function InlineEquationComponent({ node, updateAttributes }: NodeViewProps) {
  const formula = String(node.attrs.formula || "");

  const handleEdit = () => {
    const nextFormula = window.prompt("行内公式：", formula);
    if (nextFormula === null) return;
    updateAttributes({ formula: nextFormula.trim() });
  };

  return (
    <NodeViewWrapper
      as="span"
      data-type="inline-equation"
      className="inline-flex align-baseline"
      contentEditable={false}
    >
      <button
        type="button"
        onDoubleClick={handleEdit}
        title="双击编辑行内公式"
        className="mx-0.5 rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[0.9em] text-zinc-800 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700"
      >
        {formula || "公式"}
      </button>
    </NodeViewWrapper>
  );
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    inlineEquation: {
      insertInlineEquation: (formula?: string) => ReturnType;
    };
  }
}

export const InlineEquationNode = Node.create({
  name: "inlineEquation",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      formula: {
        default: "",
        parseHTML: (element) =>
          element.getAttribute("data-formula") ||
          element.querySelector("[data-inline-equation-formula]")?.textContent ||
          "",
        renderHTML: (attributes) => ({ "data-formula": attributes.formula }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="inline-equation"]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { "data-type": "inline-equation" }),
      ["code", { "data-inline-equation-formula": "" }, node.attrs.formula],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(InlineEquationComponent);
  },

  addCommands() {
    return {
      insertInlineEquation:
        (formula = "") =>
        ({ chain }) =>
          chain()
            .insertContent({
              type: this.name,
              attrs: { formula },
            })
            .run(),
    };
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: /(?<!\S)\$([^\s$](?:[^$\n]*[^\s$])?)\$$/,
        type: this.type,
        getAttributes: (match) => ({ formula: match[1].trim() }),
      }),
      nodeInputRule({
        find: /(?<!\S)\\\((.+?)\\\)$/,
        type: this.type,
        getAttributes: (match) => ({ formula: match[1].trim() }),
      }),
    ];
  },
});
