"use client";

import { ReactRenderer } from "@tiptap/react";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import { type SuggestionOptions } from "@tiptap/suggestion";
import SlashCommandList, {
  type SlashCommandItem,
  type SlashCommandListRef,
} from "./SlashCommandList";
import { createDatabase } from "@/lib/db/local/queries";

function getSlashCommands(editor: any): SlashCommandItem[] {
  return [
    // ── Basic Blocks ──
    {
      title: "Text",
      description: "Plain text block",
      icon: "Aa",
      category: "Basic Blocks",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setParagraph().run();
      },
    },
    {
      title: "Heading 1",
      description: "Large section heading",
      icon: "H1",
      category: "Basic Blocks",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
      },
    },
    {
      title: "Heading 2",
      description: "Medium section heading",
      icon: "H2",
      category: "Basic Blocks",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
      },
    },
    {
      title: "Heading 3",
      description: "Small section heading",
      icon: "H3",
      category: "Basic Blocks",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
      },
    },
    // ── Lists ──
    {
      title: "Bullet List",
      description: "Simple bulleted list",
      icon: "•",
      category: "Lists",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBulletList().run();
      },
    },
    {
      title: "Numbered List",
      description: "Numbered ordered list",
      icon: "1.",
      category: "Lists",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run();
      },
    },
    {
      title: "To-do List",
      description: "Checkbox task list",
      icon: "☑",
      category: "Lists",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleTaskList().run();
      },
    },
    // ── Content Blocks ──
    {
      title: "Quote",
      description: "Block quotation",
      icon: "❝",
      category: "Content Blocks",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setBlockquote().run();
      },
    },
    {
      title: "Divider",
      description: "Horizontal divider line",
      icon: "—",
      category: "Content Blocks",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHorizontalRule().run();
      },
    },
    {
      title: "Code Block",
      description: "Code with syntax formatting",
      icon: "<>",
      category: "Content Blocks",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setCodeBlock().run();
      },
    },
    {
      title: "Callout",
      description: "Highlighted info block",
      icon: "💡",
      category: "Content Blocks",
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setBlockquote()
          .run();
      },
    },
    // ── Media ──
    {
      title: "Image",
      description: "Upload or embed an image",
      icon: "🖼",
      category: "Media",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        // Prompt for URL
        const url = window.prompt("Image URL:");
        if (url) {
          editor.chain().focus().setImage({ src: url }).run();
        }
      },
    },
    {
      title: "Table",
      description: "Insert a table",
      icon: "⊞",
      category: "Media",
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run();
      },
    },
    // ── Database ──
    {
      title: "Database - Inline",
      description: "Embed a new database in this page",
      icon: "🗄️",
      category: "Database",
      command: async ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        try {
          const db = await createDatabase({ title: "Untitled Database" });
          editor.chain().focus().insertInlineDatabase(db.id).run();
        } catch (err) {
          console.error("[Zhinote] Failed to create inline database:", err);
        }
      },
    },
    {
      title: "Database - Full Page",
      description: "Create a new database page",
      icon: "🗄️",
      category: "Database",
      command: async ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        try {
          const db = await createDatabase({ title: "Untitled Database" });
          // Navigate to the full database page
          window.location.href = `/database/${db.id}`;
        } catch (err) {
          console.error("[Zhinote] Failed to create database:", err);
        }
      },
    },
    // ── Inline ──
    {
      title: "Link to page",
      description: "Link to an existing page (or type //)",
      icon: "📄",
      category: "Inline",
      command: ({ editor, range }) => {
        // Delete the slash command text and insert the wiki link trigger
        editor.chain().focus().deleteRange(range).insertContent("//").run();
      },
    },
    // ── Text Formatting ──
    {
      title: "Bold",
      description: "Bold text",
      icon: "B",
      category: "Text Formatting",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBold().run();
      },
    },
    {
      title: "Italic",
      description: "Italic text",
      icon: "I",
      category: "Text Formatting",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleItalic().run();
      },
    },
    {
      title: "Underline",
      description: "Underline text",
      icon: "U",
      category: "Text Formatting",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleUnderline().run();
      },
    },
    {
      title: "Strikethrough",
      description: "Strikethrough text",
      icon: "S̶",
      category: "Text Formatting",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleStrike().run();
      },
    },
    {
      title: "Code",
      description: "Inline code",
      icon: "`",
      category: "Text Formatting",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleCode().run();
      },
    },
    {
      title: "Highlight",
      description: "Highlight text",
      icon: "🖍",
      category: "Text Formatting",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleHighlight().run();
      },
    },
    // ── Alignment ──
    {
      title: "Align Left",
      description: "Left-align text",
      icon: "⫷",
      category: "Alignment",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setTextAlign("left").run();
      },
    },
    {
      title: "Align Center",
      description: "Center-align text",
      icon: "⫸",
      category: "Alignment",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setTextAlign("center").run();
      },
    },
    {
      title: "Align Right",
      description: "Right-align text",
      icon: "⫸",
      category: "Alignment",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setTextAlign("right").run();
      },
    },
    // ── Colors ──
    {
      title: "Red Text",
      description: "Set text color to red",
      icon: "🔴",
      category: "Colors",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setColor("#ef4444").run();
      },
    },
    {
      title: "Orange Text",
      description: "Set text color to orange",
      icon: "🟠",
      category: "Colors",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setColor("#f97316").run();
      },
    },
    {
      title: "Yellow Text",
      description: "Set text color to yellow",
      icon: "🟡",
      category: "Colors",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setColor("#eab308").run();
      },
    },
    {
      title: "Green Text",
      description: "Set text color to green",
      icon: "🟢",
      category: "Colors",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setColor("#22c55e").run();
      },
    },
    {
      title: "Blue Text",
      description: "Set text color to blue",
      icon: "🔵",
      category: "Colors",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setColor("#3b82f6").run();
      },
    },
    {
      title: "Purple Text",
      description: "Set text color to purple",
      icon: "🟣",
      category: "Colors",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setColor("#a855f7").run();
      },
    },
    {
      title: "Gray Text",
      description: "Set text color to gray",
      icon: "⚪",
      category: "Colors",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setColor("#9ca3af").run();
      },
    },
    // ── Background Colors ──
    {
      title: "Red Background",
      description: "Highlight with red background",
      icon: "🔴",
      category: "Backgrounds",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleHighlight({ color: "#fecaca" }).run();
      },
    },
    {
      title: "Yellow Background",
      description: "Highlight with yellow background",
      icon: "🟡",
      category: "Backgrounds",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleHighlight({ color: "#fef08a" }).run();
      },
    },
    {
      title: "Green Background",
      description: "Highlight with green background",
      icon: "🟢",
      category: "Backgrounds",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleHighlight({ color: "#bbf7d0" }).run();
      },
    },
    {
      title: "Blue Background",
      description: "Highlight with blue background",
      icon: "🔵",
      category: "Backgrounds",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleHighlight({ color: "#bfdbfe" }).run();
      },
    },
    {
      title: "Purple Background",
      description: "Highlight with purple background",
      icon: "🟣",
      category: "Backgrounds",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleHighlight({ color: "#e9d5ff" }).run();
      },
    },
  ];
}

const SlashCommandSuggestion: Omit<SuggestionOptions<SlashCommandItem>, "editor"> = {
  char: "/",
  allowSpaces: false,
  startOfLine: false,

  items: ({ query, editor }) => {
    // If query starts with "/" it means the user typed "//", let wiki links handle it
    if (query.startsWith("/")) return [];

    const commands = getSlashCommands(editor);
    if (!query) return commands;

    const lower = query.toLowerCase();
    return commands.filter(
      (item) =>
        item.title.toLowerCase().includes(lower) ||
        item.category.toLowerCase().includes(lower) ||
        item.description.toLowerCase().includes(lower)
    );
  },

  render: () => {
    let component: ReactRenderer<SlashCommandListRef> | null = null;
    let popup: TippyInstance[] | null = null;

    return {
      onStart: (props) => {
        component = new ReactRenderer(SlashCommandList, {
          props: {
            items: props.items,
            command: (item: SlashCommandItem) => {
              item.command({ editor: props.editor, range: props.range });
            },
          },
          editor: props.editor,
        });

        if (!props.clientRect) return;

        popup = tippy("body", {
          getReferenceClientRect: props.clientRect as () => DOMRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: "manual",
          placement: "bottom-start",
          maxWidth: "none",
        });
      },

      onUpdate(props) {
        component?.updateProps({
          items: props.items,
          command: (item: SlashCommandItem) => {
            item.command({ editor: props.editor, range: props.range });
          },
        });

        if (popup && props.clientRect) {
          popup[0].setProps({
            getReferenceClientRect: props.clientRect as () => DOMRect,
          });
        }
      },

      onKeyDown(props) {
        if (props.event.key === "Escape") {
          popup?.[0]?.hide();
          return true;
        }
        return component?.ref?.onKeyDown(props.event) ?? false;
      },

      onExit() {
        popup?.[0]?.destroy();
        component?.destroy();
      },
    };
  },
};

export default SlashCommandSuggestion;
