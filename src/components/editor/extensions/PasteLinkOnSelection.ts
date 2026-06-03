import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { normalizeLinkHref } from "./linkHelpers";

export const PasteLinkOnSelection = Extension.create({
  name: "pasteLinkOnSelection",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handlePaste: (view, event) => {
            const { selection, schema } = view.state;
            if (selection.empty) return false;

            const pastedText = event.clipboardData?.getData("text/plain")?.trim() ?? "";
            const href = normalizeLinkHref(pastedText);
            const linkMark = schema.marks.link;
            if (!href || !linkMark) return false;

            event.preventDefault();
            view.dispatch(
              view.state.tr
                .addMark(selection.from, selection.to, linkMark.create({ href }))
                .scrollIntoView()
            );
            return true;
          },
        },
      }),
    ];
  },
});
