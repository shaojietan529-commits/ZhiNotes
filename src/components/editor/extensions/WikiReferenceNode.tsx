"use client";

import { Node, mergeAttributes, nodeInputRule } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";

function WikiReferenceComponent({ node, updateAttributes }: NodeViewProps) {
  const target = String(node.attrs.target || "");
  const label = String(node.attrs.label || target || "Untitled");

  const handleEdit = () => {
    const current =
      target && label && target !== label ? `${target}|${label}` : label || target;
    const nextValue = window.prompt("Wiki reference:", current);
    if (nextValue === null) return;

    const next = parseWikiReferenceValue(nextValue);
    updateAttributes(next);
  };

  return (
    <NodeViewWrapper
      as="span"
      data-type="wiki-reference"
      className="inline-flex align-baseline"
      contentEditable={false}
    >
      <button
        type="button"
        onDoubleClick={handleEdit}
        title={
          target && target !== label
            ? `Unresolved wiki reference to ${target}`
            : "Unresolved wiki reference"
        }
        className="mx-0.5 rounded bg-blue-50 px-1.5 py-0.5 text-[0.9em] font-medium text-blue-700 ring-1 ring-inset ring-blue-100 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-900 dark:hover:bg-blue-900"
      >
        [[{label || target || "Untitled"}]]
      </button>
    </NodeViewWrapper>
  );
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    wikiReference: {
      insertWikiReference: (value?: string) => ReturnType;
    };
  }
}

export const WikiReferenceNode = Node.create({
  name: "wikiReference",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      target: {
        default: "",
        parseHTML: (element) => {
          const target =
            element.getAttribute("data-target") ||
            element.getAttribute("data-label") ||
            extractWikiReferenceText(element.textContent ?? "").target;
          return sanitizeWikiReferencePart(target);
        },
        renderHTML: (attributes) => ({
          "data-target": sanitizeWikiReferencePart(attributes.target),
        }),
      },
      label: {
        default: "",
        parseHTML: (element) => {
          const parsed = extractWikiReferenceText(element.textContent ?? "");
          const label =
            element.getAttribute("data-label") ||
            parsed.label ||
            element.getAttribute("data-target") ||
            parsed.target;
          return sanitizeWikiReferencePart(label);
        },
        renderHTML: (attributes) => ({
          "data-label": sanitizeWikiReferencePart(attributes.label),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="wiki-reference"]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const target = sanitizeWikiReferencePart(node.attrs.target);
    const label = sanitizeWikiReferencePart(node.attrs.label || target);
    const value = formatWikiReferenceValue(target, label);

    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-type": "wiki-reference",
        "data-target": target,
        "data-label": label,
      }),
      value,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(WikiReferenceComponent);
  },

  addCommands() {
    return {
      insertWikiReference:
        (value = "") =>
        ({ chain }) =>
          chain()
            .insertContent({
              type: this.name,
              attrs: parseWikiReferenceValue(value),
            })
            .run(),
    };
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: /(?<!\S)\[\[([^\]\n]{1,180})]]$/,
        type: this.type,
        getAttributes: (match) => parseWikiReferenceValue(match[1]),
      }),
    ];
  },
});

function parseWikiReferenceValue(value: string) {
  const cleaned = value.replace(/^\[\[|\]\]$/g, "").trim();
  const [rawTarget, ...labelParts] = cleaned.split("|");
  const target = sanitizeWikiReferencePart(rawTarget);
  const label = sanitizeWikiReferencePart(labelParts.join("|")) || target;

  return {
    target: target || label || "Untitled",
    label: label || target || "Untitled",
  };
}

function extractWikiReferenceText(value: string) {
  return parseWikiReferenceValue(value);
}

function formatWikiReferenceValue(target: string, label: string) {
  if (target && label && target !== label) return `[[${target}|${label}]]`;
  return `[[${label || target || "Untitled"}]]`;
}

function sanitizeWikiReferencePart(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\]\]/g, ")")
    .trim()
    .slice(0, 180);
}
