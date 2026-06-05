"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { NOTE_TEMPLATES } from "@/lib/templates/noteTemplates";

type TemplateInsertPosition = "above" | "below" | "bottom" | "top";
const DEFAULT_TEMPLATE_BUTTON_LABEL = "插入模板";

const INSERT_POSITION_OPTIONS: Array<{
  label: string;
  value: TemplateInsertPosition;
}> = [
  { label: "按钮下方", value: "below" },
  { label: "按钮上方", value: "above" },
  { label: "页面顶部", value: "top" },
  { label: "页面底部", value: "bottom" },
];

function findTemplate(title: string) {
  return (
    NOTE_TEMPLATES.find((template) => template.title === title) ??
    NOTE_TEMPLATES[0]
  );
}

function normalizeInsertPosition(value: unknown): TemplateInsertPosition {
  return INSERT_POSITION_OPTIONS.some((option) => option.value === value)
    ? (value as TemplateInsertPosition)
    : "below";
}

function TemplateButtonComponent({
  node,
  editor,
  getPos,
  updateAttributes,
}: NodeViewProps) {
  const label = String(node.attrs.label || DEFAULT_TEMPLATE_BUTTON_LABEL);
  const templateTitle = String(
    node.attrs.templateTitle || NOTE_TEMPLATES[0]?.title || ""
  );
  const insertPosition = normalizeInsertPosition(node.attrs.insertPosition);
  const template = findTemplate(templateTitle);

  const handleInsert = () => {
    const pos = typeof getPos === "function" ? getPos() : null;
    if (typeof pos !== "number" || !template) return;
    editor
      .chain()
      .focus()
      .insertContentAt(
        getTemplateInsertPosition(editor, pos, node.nodeSize, insertPosition),
        template.html
      )
      .run();
  };

  return (
    <NodeViewWrapper
      className="my-3"
      data-type="template-button"
      data-label={label}
      data-template-title={template?.title ?? templateTitle}
      data-insert-position={insertPosition}
    >
      <div
        className="flex flex-wrap items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        contentEditable={false}
      >
        <button
          type="button"
          onClick={handleInsert}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {label}
        </button>
        <input
          value={label}
          onChange={(event) =>
            updateAttributes({
              label: event.target.value || DEFAULT_TEMPLATE_BUTTON_LABEL,
            })
          }
          aria-label="模板按钮文案"
          className="min-w-0 flex-1 rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
        />
        <select
          value={template?.title ?? templateTitle}
          onChange={(event) =>
            updateAttributes({ templateTitle: event.target.value })
          }
          aria-label="模板"
          className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
        >
          {NOTE_TEMPLATES.map((item) => (
            <option key={item.title} value={item.title}>
              {item.title}
            </option>
          ))}
        </select>
        <select
          value={insertPosition}
          onChange={(event) =>
            updateAttributes({
              insertPosition: normalizeInsertPosition(event.target.value),
            })
          }
          aria-label="插入位置"
          className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
        >
          {INSERT_POSITION_OPTIONS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
    </NodeViewWrapper>
  );
}

function getTemplateInsertPosition(
  editor: NodeViewProps["editor"],
  buttonPos: number,
  buttonSize: number,
  insertPosition: TemplateInsertPosition
) {
  switch (insertPosition) {
    case "above":
      return buttonPos;
    case "top":
      return 0;
    case "bottom":
      return editor.state.doc.content.size;
    case "below":
    default:
      return buttonPos + buttonSize;
  }
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    templateButton: {
      insertTemplateButton: () => ReturnType;
    };
  }
}

export const TemplateButtonNode = Node.create({
  name: "templateButton",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      label: {
        default: DEFAULT_TEMPLATE_BUTTON_LABEL,
        parseHTML: (element) =>
          element.getAttribute("data-label") || DEFAULT_TEMPLATE_BUTTON_LABEL,
        renderHTML: (attributes) => ({ "data-label": attributes.label }),
      },
      templateTitle: {
        default: NOTE_TEMPLATES[0]?.title || "Investment Memo",
        parseHTML: (element) =>
          element.getAttribute("data-template-title") ||
          NOTE_TEMPLATES[0]?.title ||
          "Investment Memo",
        renderHTML: (attributes) => ({
          "data-template-title": attributes.templateTitle,
        }),
      },
      insertPosition: {
        default: "below",
        parseHTML: (element) =>
          normalizeInsertPosition(element.getAttribute("data-insert-position")),
        renderHTML: (attributes) => ({
          "data-insert-position": normalizeInsertPosition(attributes.insertPosition),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="template-button"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "template-button" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TemplateButtonComponent);
  },

  addCommands() {
    return {
      insertTemplateButton:
        () =>
        ({ chain }) =>
          chain()
            .insertContent({
              type: this.name,
              attrs: {
                label: DEFAULT_TEMPLATE_BUTTON_LABEL,
                templateTitle: NOTE_TEMPLATES[0]?.title || "Investment Memo",
                insertPosition: "below",
              },
            })
            .run(),
    };
  },
});
