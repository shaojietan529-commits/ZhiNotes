import { Extension, type Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin } from "@tiptap/pm/state";
import { promptForLink } from "./linkHelpers";
import {
  dispatchEditorBlockMenu,
  dispatchEditorLocalCommand,
} from "@/lib/editorLocalCommands";
import { dispatchPageLocalCommand } from "@/lib/pageLocalCommands";

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

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleKeyDown: (_view, event) => {
            if (isHeadingThreeShortcut(event)) {
              event.preventDefault();
              return this.editor.chain().focus().setHeading({ level: 3 }).run();
            }

            if (handleNotionMarkdownShortcut(this.editor, event)) {
              return true;
            }

            return false;
          },
        },
      }),
    ];
  },

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
      // Browsers may report Cmd/Ctrl+Shift+3 as "#" instead of "3".
      "Mod-#": () =>
        this.editor.chain().focus().toggleHeading({ level: 3 }).run(),
      // macOS may reserve Cmd+Shift+3 for screenshots, so keep a browser-safe fallback.
      "Mod-Alt-3": () =>
        this.editor.chain().focus().toggleHeading({ level: 3 }).run(),
      "Mod-Shift-4": () =>
        this.editor.chain().focus().toggleTaskList().run(),
      "Mod-Shift-5": () =>
        this.editor.chain().focus().toggleBulletList().run(),
      "Mod-Shift-6": () =>
        this.editor.chain().focus().toggleOrderedList().run(),
      "Mod-Shift-7": () =>
        this.editor.chain().focus().insertToggleBlock().run(),
      "Mod-Shift-8": () =>
        this.editor.chain().focus().toggleCodeBlock().run(),
      "Mod-Shift-9": () => {
        dispatchEditorLocalCommand("child-page");
        return true;
      },

      // ── Text Formatting ───────────────────────────────────────
      "Mod-/": () => {
        dispatchEditorBlockMenu();
        return true;
      },

      "Mod-k": () => promptForLink(this.editor),

      "Mod-l": () => {
        dispatchPageLocalCommand("copy-link");
        return true;
      },

      "Mod-Shift-m": () => {
        dispatchEditorLocalCommand("block-comment");
        return true;
      },

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
      "Mod-d": () => this.editor.chain().focus().duplicateCurrentBlock().run(),

      "Mod-Shift-d": () =>
        this.editor.chain().focus().duplicateCurrentBlock().run(),

      "Mod-Backspace": () =>
        this.editor.chain().focus().deleteCurrentBlock().run(),
      "Mod-Shift-ArrowUp": () =>
        this.editor.chain().focus().moveCurrentBlockUp().run(),
      "Mod-Shift-ArrowDown": () =>
        this.editor.chain().focus().moveCurrentBlockDown().run(),

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
        // Otherwise consume Cmd/Ctrl+Enter so the editor never inserts a new
        // line for it. Cmd+Enter is reserved for "open the full page" when a
        // page is shown in the peek modal — that handler lives on window and
        // still fires because ProseMirror does not stop event propagation.
        return true;
      },

      "Mod-Alt-t": () => toggleAllToggleBlocks(this.editor),

      // ── Horizontal Rule ───────────────────────────────────────
      "Mod-Shift-minus": () =>
        this.editor.chain().focus().setHorizontalRule().run(),
    };
  },
});

function isHeadingThreeShortcut(event: KeyboardEvent) {
  const hasModifier = event.metaKey || event.ctrlKey;
  if (!hasModifier) return false;

  const isDigitThree = event.key === "3" || event.code === "Digit3";
  const isHash = event.key === "#";
  const isPrimaryH3Shortcut = event.shiftKey && (isDigitThree || isHash);
  const isFallbackH3Shortcut = event.altKey && isDigitThree;

  return isPrimaryH3Shortcut || isFallbackH3Shortcut;
}

function toggleAllToggleBlocks(editor: Editor) {
  const toggleBlocks: Array<{ node: ProseMirrorNode; pos: number }> = [];

  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "toggleBlock") {
      toggleBlocks.push({ node, pos });
    }
    return true;
  });

  if (toggleBlocks.length === 0) return false;

  const shouldOpen = toggleBlocks.some(({ node }) => !Boolean(node.attrs.open ?? true));
  let tr = editor.state.tr;
  for (const { node, pos } of toggleBlocks) {
    tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, open: shouldOpen }, node.marks);
  }

  editor.view.dispatch(tr.scrollIntoView());
  editor.view.focus();
  return true;
}

function handleNotionMarkdownShortcut(editor: Editor, event: KeyboardEvent) {
  if (
    event.key !== " " ||
    event.metaKey ||
    event.ctrlKey ||
    event.altKey ||
    !editor.state.selection.empty
  ) {
    return false;
  }

  const { $from } = editor.state.selection;
  if ($from.parent.type.name !== "paragraph") return false;

  const textBefore = $from.parent.textBetween(0, $from.parentOffset, "\n");
  const textAfter = $from.parent
    .textBetween($from.parentOffset, $from.parent.content.size, "\n")
    .trim();
  if (textAfter) return false;

  const replacementRange = {
    from: $from.pos - textBefore.length,
    to: $from.pos,
  };

  if (textBefore === ">") {
    event.preventDefault();
    return editor
      .chain()
      .focus()
      .deleteRange(replacementRange)
      .insertToggleBlock()
      .run();
  }

  if (textBefore === "\"") {
    event.preventDefault();
    return editor
      .chain()
      .focus()
      .deleteRange(replacementRange)
      .setBlockquote()
      .run();
  }

  if (textBefore === "---") {
    event.preventDefault();
    return editor
      .chain()
      .focus()
      .deleteRange(replacementRange)
      .setHorizontalRule()
      .run();
  }

  return false;
}
