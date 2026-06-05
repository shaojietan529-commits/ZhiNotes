"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import {
  NodeViewContent,
  ReactNodeViewRenderer,
  NodeViewWrapper,
} from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin } from "@tiptap/pm/state";
import type { EditorState } from "@tiptap/pm/state";
import { nanoid } from "nanoid";

const SYNCED_BLOCK_META = "zhinoteSyncedBlockApplied";

function SyncedBlockComponent({ node, updateAttributes }: NodeViewProps) {
  const syncId = String(node.attrs.syncId || "");

  return (
    <NodeViewWrapper className="my-3" data-type="synced-block">
      <div className="rounded-lg border border-sky-200 bg-sky-50/70 px-3 py-3 dark:border-sky-900 dark:bg-sky-950/40">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-sky-700 dark:text-sky-300">
          <span className="font-semibold">同步块</span>
          <span className="max-w-[180px] truncate rounded bg-white/70 px-2 py-0.5 font-mono text-[10px] text-sky-600 dark:bg-black/20 dark:text-sky-300">
            {syncId}
          </span>
          <button
            type="button"
            onClick={() => updateAttributes({ syncId: nanoid() })}
            className="rounded border border-sky-200 bg-white/70 px-2 py-0.5 text-[11px] text-sky-700 hover:bg-white dark:border-sky-900 dark:bg-black/20 dark:text-sky-300 dark:hover:bg-black/30"
            contentEditable={false}
            title="将此块移到新的同步组"
          >
            新同步组
          </button>
        </div>
        <NodeViewContent className="min-h-7 text-sm leading-6 outline-none [&>p:first-child]:mt-0 [&>p:last-child]:mb-0" />
      </div>
    </NodeViewWrapper>
  );
}

interface SyncedBlockRef {
  node: ProseMirrorNode;
  pos: number;
}

function contentJson(node: ProseMirrorNode) {
  return JSON.stringify(node.content.toJSON());
}

function findSyncedBlockNearSelection(state: EditorState): SyncedBlockRef | null {
  const { $from } = state.selection;

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name === "syncedBlock") {
      return {
        node,
        pos: $from.before(depth),
      };
    }
  }

  return null;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    syncedBlock: {
      insertSyncedBlock: () => ReturnType;
    };
  }
}

export const SyncedBlockNode = Node.create({
  name: "syncedBlock",
  group: "block",
  content: "block+",
  draggable: true,

  addAttributes() {
    return {
      syncId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-sync-id"),
        renderHTML: (attributes) => ({
          "data-sync-id": attributes.syncId,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="synced-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "synced-block" }),
      ["div", { "data-synced-label": "" }, "同步块"],
      ["div", { "data-synced-content": "" }, 0],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SyncedBlockComponent);
  },

  addCommands() {
    return {
      insertSyncedBlock:
        () =>
        ({ chain }) =>
          chain()
            .insertContent({
              type: this.name,
              attrs: {
                syncId: nanoid(),
              },
              content: [{ type: "paragraph" }],
            })
            .run(),
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction: (transactions, _oldState, newState) => {
          if (
            transactions.some((transaction) => transaction.getMeta(SYNCED_BLOCK_META)) ||
            !transactions.some((transaction) => transaction.docChanged)
          ) {
            return null;
          }

          const source = findSyncedBlockNearSelection(newState);
          const syncId = String(source?.node.attrs.syncId || "");
          if (!source || !syncId) return null;

          const sourceJson = contentJson(source.node);
          const replacements: { from: number; to: number }[] = [];

          newState.doc.descendants((node, pos) => {
            if (
              node.type.name === this.name &&
              pos !== source.pos &&
              String(node.attrs.syncId || "") === syncId &&
              contentJson(node) !== sourceJson
            ) {
              replacements.push({ from: pos + 1, to: pos + node.nodeSize - 1 });
            }
          });

          if (replacements.length === 0) return null;

          const tr = newState.tr;
          for (const replacement of replacements.reverse()) {
            tr.replaceWith(replacement.from, replacement.to, source.node.content);
          }
          tr.setMeta(SYNCED_BLOCK_META, true);

          return tr;
        },
      }),
    ];
  },
});
