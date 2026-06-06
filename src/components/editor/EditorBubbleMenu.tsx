"use client";

import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor as TiptapEditor } from "@tiptap/core";

// Notion-style floating toolbar shown when text is selected. Reuses the
// editor's existing mark commands; purely local formatting, no I/O.
export default function EditorBubbleMenu({
  editor,
  editable,
}: {
  editor: TiptapEditor | null;
  editable: boolean;
}) {
  if (!editor || !editable) return null;

  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: "top" }}
      shouldShow={({ editor: ed, from, to }) => {
        // Only for non-empty text selections; skip atom/node selections
        // (images, inline databases, file previews, etc.).
        if (from === to) return false;
        if (ed.isActive("inlineDatabase") || ed.isActive("filePreview")) {
          return false;
        }
        return ed.isEditable;
      }}
      className="zhinote-bubble-menu"
    >
      <BubbleButton
        active={editor.isActive("bold")}
        label="B"
        title="加粗"
        className="font-bold"
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <BubbleButton
        active={editor.isActive("italic")}
        label="I"
        title="斜体"
        className="italic"
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <BubbleButton
        active={editor.isActive("underline")}
        label="U"
        title="下划线"
        className="underline"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      />
      <BubbleButton
        active={editor.isActive("strike")}
        label="S"
        title="删除线"
        className="line-through"
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />
      <BubbleButton
        active={editor.isActive("code")}
        label="</>"
        title="行内代码"
        onClick={() => editor.chain().focus().toggleCode().run()}
      />
      <BubbleButton
        active={editor.isActive("highlight")}
        label="◖"
        title="高亮"
        onClick={() => editor.chain().focus().toggleHighlight().run()}
      />
      <span className="zhinote-bubble-divider" aria-hidden="true" />
      <BubbleButton
        active={editor.isActive("link")}
        label="🔗"
        title="链接"
        onClick={() => {
          const prev = (editor.getAttributes("link").href as string) || "";
          const url = window.prompt("链接地址：", prev);
          if (url === null) return;
          if (url === "") {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
            return;
          }
          editor
            .chain()
            .focus()
            .extendMarkRange("link")
            .setLink({ href: url })
            .run();
        }}
      />
      <BubbleButton
        label="✕"
        title="清除格式"
        onClick={() =>
          editor.chain().focus().unsetAllMarks().run()
        }
      />
    </BubbleMenu>
  );
}

function BubbleButton({
  active,
  label,
  title,
  className = "",
  onClick,
}: {
  active?: boolean;
  label: string;
  title: string;
  className?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`zhinote-bubble-btn ${active ? "is-active" : ""} ${className}`}
    >
      {label}
    </button>
  );
}
