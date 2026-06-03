"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import {
  NodeViewContent,
  ReactNodeViewRenderer,
  NodeViewWrapper,
} from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";

const CALLOUT_TONES = {
  neutral:
    "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200",
  blue:
    "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100",
  yellow:
    "border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-100",
  green:
    "border-green-200 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-100",
  red:
    "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100",
} as const;

type CalloutTone = keyof typeof CALLOUT_TONES;

function isCalloutTone(value: unknown): value is CalloutTone {
  return typeof value === "string" && value in CALLOUT_TONES;
}

function CalloutComponent({ node, updateAttributes }: NodeViewProps) {
  const tone = isCalloutTone(node.attrs.tone) ? node.attrs.tone : "blue";
  const icon = String(node.attrs.icon || "i");

  return (
    <NodeViewWrapper className="my-3" data-type="callout-block">
      <div
        className={`rounded-lg border px-3 py-3 ${CALLOUT_TONES[tone]}`}
      >
        <div className="flex items-start gap-3">
          <input
            value={icon}
            onChange={(event) =>
              updateAttributes({ icon: event.target.value.slice(0, 4) || "i" })
            }
            aria-label="Callout icon"
            className="h-7 w-8 shrink-0 rounded bg-white/70 text-center text-sm font-semibold outline-none dark:bg-black/20"
            contentEditable={false}
          />
          <NodeViewContent
            className="min-h-7 flex-1 text-sm leading-6 outline-none [&>p:first-child]:mt-0 [&>p:last-child]:mb-0"
          />
          <select
            value={tone}
            onChange={(event) => updateAttributes({ tone: event.target.value })}
            aria-label="Callout color"
            className="rounded border border-current/15 bg-white/60 px-2 py-1 text-xs outline-none dark:bg-black/20"
            contentEditable={false}
          >
            <option value="blue">Blue</option>
            <option value="neutral">Gray</option>
            <option value="yellow">Yellow</option>
            <option value="green">Green</option>
            <option value="red">Red</option>
          </select>
        </div>
      </div>
    </NodeViewWrapper>
  );
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    calloutBlock: {
      insertCallout: () => ReturnType;
    };
  }
}

export const CalloutNode = Node.create({
  name: "calloutBlock",
  group: "block",
  content: "block+",
  draggable: true,

  addAttributes() {
    return {
      icon: {
        default: "i",
        parseHTML: (element) => element.getAttribute("data-icon") || "i",
        renderHTML: (attributes) => ({ "data-icon": attributes.icon }),
      },
      tone: {
        default: "blue",
        parseHTML: (element) => element.getAttribute("data-tone") || "blue",
        renderHTML: (attributes) => ({ "data-tone": attributes.tone }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="callout-block"]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "callout-block" }),
      ["span", { "data-callout-icon": "" }, node.attrs.icon],
      ["div", { "data-callout-content": "" }, 0],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutComponent);
  },

  addCommands() {
    return {
      insertCallout:
        () =>
        ({ chain }) =>
          chain()
            .insertContent({
              type: this.name,
              attrs: {
                icon: "i",
                tone: "blue",
              },
              content: [{ type: "paragraph" }],
            })
            .run(),
    };
  },
});
