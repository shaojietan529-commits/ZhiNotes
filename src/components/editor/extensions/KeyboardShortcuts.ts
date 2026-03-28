import { Extension } from "@tiptap/core";

/**
 * Notion-compatible keyboard shortcuts for Zhinote.
 *
 * Many shortcuts are already provided by Tiptap's StarterKit and other extensions:
 *   Mod-b: Bold, Mod-i: Italic, Mod-u: Underline, Mod-e: Code,
 *   Mod-Shift-x: Strikethrough, Mod-z: Undo, Mod-Shift-z: Redo,
 *   Tab/Shift-Tab: Indent/Outdent in lists,
 *   Markdown shortcuts (# , ## , > , - , 1. , etc.)
 *
 * This extension adds the remaining Notion shortcuts that Tiptap doesn't
 * provide out of the box.
 */
export const KeyboardShortcuts = Extension.create({
  name: "zhinoteKeyboardShortcuts",

  addKeyboardShortcuts() {
    return {
      // ── Turn-Into Shortcuts (Notion: Cmd+Shift+0-9) ──────────
      "Mod-Shift-0": () =>
        this.editor.chain().focus().setParagraph().run(),
      "Mod-Shift-1": () =>
        this.editor.chain().focus().toggleHeading({ level: 1 }).run(),
      "Mod-Shift-2": () =>
        this.editor.chain().focus().toggleHeading({ level: 2 }).run(),
      "Mod-Shift-3": () =>
        this.editor.chain().focus().toggleHeading({ level: 3 }).run(),
      "Mod-Shift-4": () =>
        this.editor.chain().focus().toggleTaskList().run(),
      "Mod-Shift-5": () =>
        this.editor.chain().focus().toggleBulletList().run(),
      "Mod-Shift-6": () =>
        this.editor.chain().focus().toggleOrderedList().run(),
      "Mod-Shift-7": () =>
        // Notion uses this for toggle list; we use blockquote as closest match
        this.editor.chain().focus().toggleBlockquote().run(),
      "Mod-Shift-8": () =>
        this.editor.chain().focus().toggleCodeBlock().run(),
      "Mod-Shift-9": () =>
        this.editor.chain().focus().toggleBlockquote().run(),

      // ── Text Formatting ───────────────────────────────────────
      "Mod-Shift-h": () =>
        this.editor.chain().focus().toggleHighlight().run(),
      "Mod-Shift-s": () =>
        this.editor.chain().focus().toggleStrike().run(),

      // ── Text Alignment (Notion: Cmd+Shift+L/R/E/J) ───────────
      "Mod-Shift-l": () =>
        this.editor.chain().focus().setTextAlign("left").run(),
      "Mod-Shift-r": () =>
        this.editor.chain().focus().setTextAlign("right").run(),
      "Mod-Shift-e": () =>
        this.editor.chain().focus().setTextAlign("center").run(),
      "Mod-Shift-j": () =>
        this.editor.chain().focus().setTextAlign("justify").run(),

      // ── Block Operations ──────────────────────────────────────
      "Mod-d": () => {
        // Duplicate current block (Notion: Cmd+D)
        const { state } = this.editor;
        const { $from } = state.selection;
        // Find the top-level block node
        const pos = $from.before(1);
        const node = state.doc.nodeAt(pos);
        if (node) {
          const endPos = pos + node.nodeSize;
          this.editor
            .chain()
            .focus()
            .insertContentAt(endPos, node.toJSON())
            .run();
        }
        return true;
      },

      "Mod-Shift-d": () => {
        // Alternative duplicate shortcut
        const { state } = this.editor;
        const { $from } = state.selection;
        const pos = $from.before(1);
        const node = state.doc.nodeAt(pos);
        if (node) {
          const endPos = pos + node.nodeSize;
          this.editor
            .chain()
            .focus()
            .insertContentAt(endPos, node.toJSON())
            .run();
        }
        return true;
      },

      "Mod-Backspace": () => {
        // Delete entire block (Notion: Cmd+Shift+Delete / Cmd+Backspace)
        const { state } = this.editor;
        const { $from } = state.selection;
        const pos = $from.before(1);
        const node = state.doc.nodeAt(pos);
        if (node) {
          const endPos = pos + node.nodeSize;
          this.editor.chain().focus().deleteRange({ from: pos, to: endPos }).run();
        }
        return true;
      },

      // ── Navigation & Structure ────────────────────────────────
      "Mod-Enter": () => {
        // Toggle task item checkbox (Notion: Cmd+Enter toggles todo)
        if (this.editor.isActive("taskItem")) {
          // Toggle the checkbox by updating the checked attribute
          const { state } = this.editor;
          const { $from } = state.selection;
          // Walk up to find the taskItem node
          for (let d = $from.depth; d > 0; d--) {
            const node = $from.node(d);
            if (node.type.name === "taskItem") {
              const pos = $from.before(d);
              this.editor.view.dispatch(
                state.tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  checked: !node.attrs.checked,
                })
              );
              return true;
            }
          }
        }
        return false;
      },

      // ── Horizontal Rule ───────────────────────────────────────
      "Mod-Shift-minus": () =>
        this.editor.chain().focus().setHorizontalRule().run(),
    };
  },
});
