import { Extension, type Editor } from "@tiptap/core";
import { Fragment, type Node as ProseMirrorNode } from "@tiptap/pm/model";

interface TopLevelBlock {
  node: ProseMirrorNode;
  pos: number;
  end: number;
  index: number;
}

interface TopLevelBlockRange {
  blocks: TopLevelBlock[];
  from: number;
  to: number;
}

function getCurrentTopLevelBlock(editor: Editor): TopLevelBlock | null {
  const { state } = editor;
  const { $from } = state.selection;
  if ($from.depth === 0) return null;

  const pos = $from.before(1);
  const node = state.doc.nodeAt(pos);
  if (!node) return null;

  let index = -1;
  state.doc.forEach((_child, offset, childIndex) => {
    if (offset === pos) index = childIndex;
  });

  if (index < 0) return null;

  return {
    node,
    pos,
    end: pos + node.nodeSize,
    index,
  };
}

function getSelectedTopLevelBlockRange(editor: Editor): TopLevelBlockRange | null {
  const { state } = editor;
  if (state.selection.empty) {
    const block = getCurrentTopLevelBlock(editor);
    return block ? { blocks: [block], from: block.pos, to: block.end } : null;
  }

  const { from, to } = state.selection;
  const blocks: TopLevelBlock[] = [];

  state.doc.forEach((node, offset, index) => {
    const pos = offset;
    const end = pos + node.nodeSize;
    if (from < end && to > pos) {
      blocks.push({ node, pos, end, index });
    }
  });

  if (blocks.length === 0) return null;
  return {
    blocks,
    from: blocks[0].pos,
    to: blocks[blocks.length - 1].end,
  };
}

function getTopLevelPosByIndex(
  doc: ProseMirrorNode,
  targetIndex: number
): number | null {
  let result: number | null = null;
  doc.forEach((_child, offset, index) => {
    if (index === targetIndex) result = offset;
  });
  return result;
}

function topLevelBlocksToFragment(blocks: TopLevelBlock[]): Fragment {
  return Fragment.fromArray(blocks.map((block) => block.node));
}

function duplicateTopLevelBlocksToFragment(blocks: TopLevelBlock[]): Fragment {
  return Fragment.fromArray(
    blocks.map((block) => cloneNodeWithoutBlockIds(block.node))
  );
}

function cloneNodeWithoutBlockIds(node: ProseMirrorNode): ProseMirrorNode {
  if (node.isText) return node;

  const children: ProseMirrorNode[] = [];
  node.content.forEach((child) => {
    children.push(cloneNodeWithoutBlockIds(child));
  });

  const attrs = Object.prototype.hasOwnProperty.call(node.attrs, "blockId")
    ? { ...node.attrs, blockId: null }
    : node.attrs;
  const content = children.length > 0 ? Fragment.fromArray(children) : node.content;
  return node.type.create(attrs, content, node.marks);
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    blockOperations: {
      duplicateCurrentBlock: () => ReturnType;
      deleteCurrentBlock: () => ReturnType;
      moveCurrentBlockUp: () => ReturnType;
      moveCurrentBlockDown: () => ReturnType;
    };
  }
}

export const BlockOperations = Extension.create({
  name: "blockOperations",

  addCommands() {
    return {
      duplicateCurrentBlock:
        () =>
        ({ editor }) => {
          const range = getSelectedTopLevelBlockRange(editor);
          if (!range) return false;

          const tr = editor.state.tr.insert(
            range.to,
            duplicateTopLevelBlocksToFragment(range.blocks)
          );
          editor.view.dispatch(tr.scrollIntoView());
          editor.view.focus();
          return true;
        },

      deleteCurrentBlock:
        () =>
        ({ editor }) => {
          const range = getSelectedTopLevelBlockRange(editor);
          if (!range) return false;
          editor
            .chain()
            .focus()
            .deleteRange({ from: range.from, to: range.to })
            .run();
          return true;
        },

      moveCurrentBlockUp:
        () =>
        ({ editor }) => {
          const range = getSelectedTopLevelBlockRange(editor);
          if (!range || range.blocks[0].index === 0) return false;

          const targetPos = getTopLevelPosByIndex(
            editor.state.doc,
            range.blocks[0].index - 1
          );
          if (targetPos === null) return false;

          const tr = editor.state.tr
            .delete(range.from, range.to)
            .insert(targetPos, topLevelBlocksToFragment(range.blocks));
          editor.view.dispatch(tr.scrollIntoView());
          return true;
        },

      moveCurrentBlockDown:
        () =>
        ({ editor }) => {
          const range = getSelectedTopLevelBlockRange(editor);
          if (!range) return false;

          const nextNode = editor.state.doc.nodeAt(range.to);
          if (!nextNode) return false;

          const tr = editor.state.tr
            .delete(range.from, range.to)
            .insert(range.from + nextNode.nodeSize, topLevelBlocksToFragment(range.blocks));
          editor.view.dispatch(tr.scrollIntoView());
          return true;
        },
    };
  },
});
