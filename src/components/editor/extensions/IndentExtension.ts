import { Extension } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    indent: {
      indentBlock: () => ReturnType;
      outdentBlock: () => ReturnType;
    };
  }
}

const INDENT_TYPES = ["paragraph", "heading"];

export const IndentExtension = Extension.create({
  name: "indent",

  addGlobalAttributes() {
    return [
      {
        types: INDENT_TYPES,
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) => {
              const pl = element.style.paddingLeft;
              if (!pl) return 0;
              const rem = parseFloat(pl);
              if (!rem) return 0;
              return Math.round(rem / 1.5);
            },
            renderHTML: (attributes) => {
              const indent = attributes.indent as number;
              if (!indent || indent <= 0) return {};
              return { style: `padding-left: ${indent * 1.5}rem` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      indentBlock:
        () =>
        ({ state, dispatch }) => {
          const { from, to } = state.selection;
          const tr = state.tr;
          let applied = false;
          state.doc.nodesBetween(from, to, (node, pos) => {
            if (
              node.isTextblock &&
              "indent" in node.attrs &&
              (node.attrs.indent as number) < 8
            ) {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                indent: ((node.attrs.indent as number) || 0) + 1,
              });
              applied = true;
            }
          });
          if (applied && dispatch) dispatch(tr);
          return applied;
        },
      outdentBlock:
        () =>
        ({ state, dispatch }) => {
          const { from, to } = state.selection;
          const tr = state.tr;
          let applied = false;
          state.doc.nodesBetween(from, to, (node, pos) => {
            if (
              node.isTextblock &&
              "indent" in node.attrs &&
              (node.attrs.indent as number) > 0
            ) {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                indent: (node.attrs.indent as number) - 1,
              });
              applied = true;
            }
          });
          if (applied && dispatch) dispatch(tr);
          return applied;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        const { $from } = this.editor.state.selection;
        if ($from.parent.type.name === "codeBlock") return false;
        for (let d = $from.depth; d > 0; d--) {
          const name = $from.node(d).type.name;
          if (name === "listItem" || name === "taskItem") return false;
        }
        return this.editor.commands.indentBlock();
      },
      "Shift-Tab": () => {
        const { $from } = this.editor.state.selection;
        if ($from.parent.type.name === "codeBlock") return false;
        for (let d = $from.depth; d > 0; d--) {
          const name = $from.node(d).type.name;
          if (name === "listItem" || name === "taskItem") return false;
        }
        return this.editor.commands.outdentBlock();
      },
    };
  },
});
