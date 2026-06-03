import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { findCodeHighlightTokens } from "@/lib/codeHighlight";

export const CodeSyntaxHighlight = Extension.create({
  name: "codeSyntaxHighlight",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];

            state.doc.descendants((node, pos) => {
              if (node.type.name !== "codeBlock") return;
              const code = node.textContent;
              if (!code.trim()) return;

              const language = String(node.attrs.language ?? "");
              const tokens = findCodeHighlightTokens(code, language);
              const contentStart = pos + 1;

              for (const token of tokens) {
                decorations.push(
                  Decoration.inline(contentStart + token.start, contentStart + token.end, {
                    class: `zhinote-code-token zhinote-code-${token.kind}`,
                  })
                );
              }
            });

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});
