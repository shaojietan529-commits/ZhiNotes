"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table";
import { TableCell } from "@tiptap/extension-table";
import { TableHeader } from "@tiptap/extension-table";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-text-style";
import Mention from "@tiptap/extension-mention";
import WikiLinkSuggestion from "./extensions/WikiLinkSuggestion";
import {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
} from "react";

interface EditorProps {
  pageId: string;
  initialContent?: string | null;
  onUpdate?: (html: string, text: string, linkedPageIds: string[]) => void;
}

export interface EditorRef {
  insertSubPageLink: (childId: string, childTitle: string) => string | undefined;
  getHTML: () => string;
}

const Editor = forwardRef<EditorRef, EditorProps>(
  ({ pageId, initialContent, onUpdate }, ref) => {
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const editor = useEditor({
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
        }),
        Placeholder.configure({
          placeholder: "Start writing, or press / for commands...",
        }),
        Link.configure({
          openOnClick: true,
          autolink: true,
          HTMLAttributes: {
            class: "text-blue-500 underline cursor-pointer",
          },
        }),
        Image.configure({
          inline: true,
          allowBase64: true,
          HTMLAttributes: {
            class: "max-w-full rounded-md my-2",
          },
        }),
        Table.configure({
          resizable: true,
          HTMLAttributes: {
            class: "border-collapse table-auto w-full my-4",
          },
        }),
        TableRow,
        TableCell.configure({
          HTMLAttributes: {
            class: "border border-zinc-300 dark:border-zinc-600 px-3 py-2",
          },
        }),
        TableHeader.configure({
          HTMLAttributes: {
            class:
              "border border-zinc-300 dark:border-zinc-600 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 font-semibold text-left",
          },
        }),
        Underline,
        TextAlign.configure({
          types: ["heading", "paragraph"],
        }),
        TaskList,
        TaskItem.configure({
          nested: true,
        }),
        Highlight.configure({
          multicolor: true,
        }),
        TextStyle,
        Color,
        Mention.configure({
          HTMLAttributes: {
            class:
              "wiki-link inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 text-sm font-medium cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors no-underline",
          },
          suggestion: WikiLinkSuggestion,
          renderHTML({ options, node }) {
            return [
              "a",
              {
                ...options.HTMLAttributes,
                href: `/page/${node.attrs.id}`,
                "data-type": "mention",
                "data-id": node.attrs.id,
                "data-label": node.attrs.label,
              },
              `📄 ${node.attrs.label ?? node.attrs.id}`,
            ];
          },
        }),
      ],
      content: initialContent || "",
      editorProps: {
        attributes: {
          class:
            "prose prose-zinc dark:prose-invert max-w-none focus:outline-none min-h-[200px] px-1 py-2",
        },
      },
      onUpdate: ({ editor: ed }) => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
          const html = ed.getHTML();
          const text = ed.getText();
          // Extract linked page IDs from mention nodes
          const linkedPageIds: string[] = [];
          ed.state.doc.descendants((node) => {
            if (node.type.name === "mention" && node.attrs.id) {
              linkedPageIds.push(node.attrs.id);
            }
          });
          onUpdate?.(html, text, linkedPageIds);
        }, 1000);
      },
    });

    // Expose methods to parent via ref
    useImperativeHandle(ref, () => ({
      insertSubPageLink(childId: string, childTitle: string) {
        if (!editor) return;
        editor
          .chain()
          .focus("end")
          .insertContent({
            type: "paragraph",
            content: [
              {
                type: "text",
                marks: [
                  {
                    type: "link",
                    attrs: {
                      href: `/page/${childId}`,
                      target: null,
                    },
                  },
                ],
                text: `📄 ${childTitle || "Untitled"}`,
              },
            ],
          })
          .run();
        // Return current HTML so caller can save immediately
        return editor.getHTML();
      },
      getHTML() {
        return editor?.getHTML() ?? "";
      },
    }));

    // Reset editor content when switching pages
    const prevPageIdRef = useRef(pageId);
    useEffect(() => {
      if (prevPageIdRef.current !== pageId && editor) {
        editor.commands.setContent(initialContent || "");
        prevPageIdRef.current = pageId;
      }
    }, [pageId, initialContent, editor]);

    // Cleanup
    useEffect(() => {
      return () => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      };
    }, []);

    if (!editor) return null;

    return (
      <div className="w-full">
        {/* Toolbar */}
        <div className="flex items-center gap-1 border-b border-zinc-200 dark:border-zinc-700 pb-2 mb-4 flex-wrap">
          <ToolbarButton
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
            label="B"
            title="Bold"
            bold
          />
          <ToolbarButton
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            label="I"
            title="Italic"
            italic
          />
          <ToolbarButton
            active={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            label="U"
            title="Underline"
            underline
          />
          <ToolbarButton
            active={editor.isActive("strike")}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            label="S"
            title="Strikethrough"
            strike
          />
          <ToolbarButton
            active={editor.isActive("highlight")}
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            label="H"
            title="Highlight"
            highlight
          />
          <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-600 mx-1" />
          <ToolbarButton
            active={editor.isActive("heading", { level: 1 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 1 }).run()
            }
            label="H1"
            title="Heading 1"
          />
          <ToolbarButton
            active={editor.isActive("heading", { level: 2 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
            label="H2"
            title="Heading 2"
          />
          <ToolbarButton
            active={editor.isActive("heading", { level: 3 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
            label="H3"
            title="Heading 3"
          />
          <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-600 mx-1" />
          <ToolbarButton
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            label="&#8226;"
            title="Bullet List"
          />
          <ToolbarButton
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            label="1."
            title="Numbered List"
          />
          <ToolbarButton
            active={editor.isActive("taskList")}
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            label="&#9745;"
            title="Task List"
          />
          <ToolbarButton
            active={editor.isActive("codeBlock")}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            label="<>"
            title="Code Block"
          />
          <ToolbarButton
            active={editor.isActive("blockquote")}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            label="&#8220;"
            title="Quote"
          />
          <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-600 mx-1" />
          <ToolbarButton
            active={false}
            onClick={() =>
              editor
                .chain()
                .focus()
                .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                .run()
            }
            label="&#9638;"
            title="Insert Table"
          />
        </div>
        <EditorContent editor={editor} />
      </div>
    );
  }
);

Editor.displayName = "Editor";
export default Editor;

function ToolbarButton({
  active,
  onClick,
  label,
  title,
  bold,
  italic,
  underline,
  strike,
  highlight,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  title: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`px-2 py-1 rounded text-sm transition-colors ${
        active
          ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
          : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
      } ${bold ? "font-bold" : ""} ${italic ? "italic" : ""} ${
        underline ? "underline" : ""
      } ${strike ? "line-through" : ""} ${
        highlight ? "bg-yellow-200 dark:bg-yellow-800" : ""
      }`}
    >
      {label}
    </button>
  );
}
