import { Node, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    columns: {
      insertTwoColumns: () => ReturnType;
    };
  }
}

export const ColumnBlockNode = Node.create({
  name: "columnBlock",
  content: "block+",
  isolating: true,

  parseHTML() {
    return [{ tag: 'div[data-type="column-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "column-block" }),
      0,
    ];
  },
});

export const ColumnLayoutNode = Node.create({
  name: "columnLayout",
  group: "block",
  content: "columnBlock+",
  isolating: true,
  draggable: true,

  addAttributes() {
    return {
      columns: {
        default: 2,
        parseHTML: (element) => Number(element.getAttribute("data-columns") || 2),
        renderHTML: (attributes) => ({ "data-columns": attributes.columns }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="column-layout"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "column-layout" }),
      0,
    ];
  },

  addCommands() {
    return {
      insertTwoColumns:
        () =>
        ({ chain }) =>
          chain()
            .insertContent({
              type: this.name,
              attrs: { columns: 2 },
              content: [
                {
                  type: "columnBlock",
                  content: [{ type: "paragraph" }],
                },
                {
                  type: "columnBlock",
                  content: [{ type: "paragraph" }],
                },
              ],
            })
            .run(),
    };
  },
});

