"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import { useEffect, useRef, useCallback } from "react";

interface EditorProps {
  pageId: string;
  initialContent?: string | null;
  onUpdate?: (text: string) => void;
}

export default function Editor({ pageId, initialContent, onUpdate }: EditorProps) {
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
        openOnClick: false,
        autolink: true,
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
        const text = ed.getText();
        onUpdate?.(text);
      }, 1000);
    },
  });

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
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          label="S"
          title="Strikethrough"
          strike
        />
        <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-600 mx-1" />
        <ToolbarButton
          active={editor.isActive("heading", { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          label="H1"
          title="Heading 1"
        />
        <ToolbarButton
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          label="H2"
          title="Heading 2"
        />
        <ToolbarButton
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
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
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarButton({
  active,
  onClick,
  label,
  title,
  bold,
  italic,
  strike,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  title: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`px-2 py-1 rounded text-sm transition-colors ${
        active
          ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
          : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
      } ${bold ? "font-bold" : ""} ${italic ? "italic" : ""} ${strike ? "line-through" : ""}`}
    >
      {label}
    </button>
  );
}
