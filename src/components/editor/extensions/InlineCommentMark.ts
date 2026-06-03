import { Mark, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    inlineComment: {
      setInlineComment: (inlineCommentId: string) => ReturnType;
    };
  }
}

export const InlineCommentMark = Mark.create({
  name: "inlineComment",

  addAttributes() {
    return {
      inlineCommentId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-inline-comment-id"),
        renderHTML: (attributes) => {
          if (!attributes.inlineCommentId) return {};
          return {
            "data-inline-comment-id": attributes.inlineCommentId,
            class: "zhinote-inline-comment",
          };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-inline-comment-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setInlineComment:
        (inlineCommentId) =>
        ({ commands }) =>
          commands.setMark(this.name, { inlineCommentId }),
    };
  },
});
