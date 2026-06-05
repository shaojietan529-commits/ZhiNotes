"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import type { Editor as TiptapEditor } from "@tiptap/core";
import {
  DOMSerializer,
  Fragment,
  type Node as ProseMirrorNode,
} from "@tiptap/pm/model";
import {
  addBlockComment,
  createPage,
  getAllPages,
  updatePage,
  updateWikiLinks,
} from "@/lib/db/local/queries";
import {
  BLOCK_COMMENTS_CHANGED_EVENT,
  INLINE_COMMENT_DELETED_EVENT,
  INLINE_COMMENT_SELECTED_EVENT,
} from "@/components/shared/BlockComments";
import { htmlToMarkdown } from "@/lib/export/pageExport";
import {
  EDITOR_BLOCK_MENU_EVENT,
  EDITOR_LOCAL_COMMAND_EVENT,
  type EditorLocalCommand,
} from "@/lib/editorLocalCommands";
import { nanoid } from "nanoid";
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
import { SlashCommandExtension } from "./extensions/SlashCommandExtension";
import { KeyboardShortcuts } from "./extensions/KeyboardShortcuts";
import { InlineDatabaseNode } from "./extensions/InlineDatabaseNode";
import { FilePreviewNode } from "./extensions/FilePreviewNode";
import { ToggleBlockNode } from "./extensions/ToggleBlockNode";
import { CalloutNode } from "./extensions/CalloutNode";
import { TableOfContentsNode } from "./extensions/TableOfContentsNode";
import { BlockOperations } from "./extensions/BlockOperations";
import { ColumnBlockNode, ColumnLayoutNode } from "./extensions/ColumnsNode";
import { BookmarkNode } from "./extensions/BookmarkNode";
import { EquationNode } from "./extensions/EquationNode";
import { InlineEquationNode } from "./extensions/InlineEquationNode";
import { WikiReferenceNode } from "./extensions/WikiReferenceNode";
import { TemplateButtonNode } from "./extensions/TemplateButtonNode";
import { BreadcrumbBlockNode } from "./extensions/BreadcrumbBlockNode";
import { SyncedBlockNode } from "./extensions/SyncedBlockNode";
import { EmbedNode } from "./extensions/EmbedNode";
import { BlockIdExtension } from "./extensions/BlockIdExtension";
import { InlineCommentMark } from "./extensions/InlineCommentMark";
import { CodeSyntaxHighlight } from "./extensions/CodeSyntaxHighlight";
import { PasteLinkOnSelection } from "./extensions/PasteLinkOnSelection";
import { promptForLink } from "./extensions/linkHelpers";
import { buildChildPageInitialHtml } from "@/lib/pages/childPageSeed";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { BlockDragHandleLayer } from "./BlockDragHandleLayer";
import {
  FILE_PREVIEW_IMPORT_PROGRESS_EVENT,
  type FilePreviewImportProgress,
  insertFilesAsPreviews,
  promptAndInsertFilePreview,
} from "./filePreviewUpload";
import {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
  useState,
} from "react";

const TEXT_COLORS = [
  { label: "灰色", value: "#71717a" },
  { label: "红色", value: "#dc2626" },
  { label: "橙色", value: "#ea580c" },
  { label: "黄色", value: "#ca8a04" },
  { label: "绿色", value: "#16a34a" },
  { label: "蓝色", value: "#2563eb" },
  { label: "紫色", value: "#9333ea" },
];

const BACKGROUND_COLORS = [
  { label: "红色背景", value: "#fecaca" },
  { label: "橙色背景", value: "#fed7aa" },
  { label: "黄色背景", value: "#fef08a" },
  { label: "绿色背景", value: "#bbf7d0" },
  { label: "蓝色背景", value: "#bfdbfe" },
  { label: "紫色背景", value: "#e9d5ff" },
  { label: "灰色背景", value: "#e4e4e7" },
];

const CODE_BLOCK_LANGUAGES = [
  { label: "纯文本", value: "" },
  { label: "JavaScript", value: "javascript" },
  { label: "TypeScript", value: "typescript" },
  { label: "Python", value: "python" },
  { label: "SQL", value: "sql" },
  { label: "HTML", value: "html" },
  { label: "CSS", value: "css" },
  { label: "JSON", value: "json" },
  { label: "Markdown", value: "markdown" },
  { label: "LaTeX", value: "latex" },
  { label: "BibTeX", value: "bibtex" },
  { label: "Mermaid", value: "mermaid" },
  { label: "YAML", value: "yaml" },
  { label: "TOML", value: "toml" },
  { label: "XML", value: "xml" },
  { label: "Shell", value: "bash" },
  { label: "Java", value: "java" },
  { label: "C / C++", value: "cpp" },
  { label: "Go", value: "go" },
  { label: "Rust", value: "rust" },
  { label: "PHP", value: "php" },
  { label: "Ruby", value: "ruby" },
  { label: "Swift", value: "swift" },
  { label: "Kotlin", value: "kotlin" },
  { label: "R", value: "r" },
  { label: "Julia", value: "julia" },
  { label: "SAS", value: "sas" },
  { label: "Stata", value: "stata" },
  { label: "GraphQL", value: "graphql" },
  { label: "Dockerfile", value: "dockerfile" },
  { label: "Makefile", value: "makefile" },
  { label: "Dart", value: "dart" },
  { label: "Lua", value: "lua" },
  { label: "Perl", value: "perl" },
  { label: "Protobuf", value: "protobuf" },
  { label: "Groovy", value: "groovy" },
  { label: "Log", value: "log" },
];

interface EditorProps {
  pageId: string;
  initialContent?: string | null;
  editable?: boolean;
  onUpdate?: (html: string, text: string, linkedPageIds: string[]) => void;
}

export interface EditorRef {
  insertSubPageLink: (childId: string, childTitle: string) => string | undefined;
  insertInlineDatabase: (databaseId: string) => string | undefined;
  appendHtml: (html: string) => string | undefined;
  setContent: (html: string) => void;
  getHTML: () => string;
}

const Editor = forwardRef<EditorRef, EditorProps>(
  ({ pageId, initialContent, editable = true, onUpdate }, ref) => {
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingSaveRef = useRef<{
      html: string;
      text: string;
      linkedPageIds: string[];
      onUpdate?: EditorProps["onUpdate"];
    } | null>(null);
    const onUpdateRef = useRef(onUpdate);
    const tiptapEditorRef = useRef<TiptapEditor | null>(null);
    const editableRef = useRef(editable);
    const [blockMenuOpen, setBlockMenuOpen] = useState(false);
    const [fileImportProgress, setFileImportProgress] =
      useState<FilePreviewImportProgress | null>(null);
    const fileImportProgressTimerRef = useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

    useEffect(() => {
      onUpdateRef.current = onUpdate;
    }, [onUpdate]);

    const flushPendingSave = useCallback(() => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      const pendingSave = pendingSaveRef.current;
      pendingSaveRef.current = null;
      if (!pendingSave) return;
      pendingSave.onUpdate?.(
        pendingSave.html,
        pendingSave.text,
        pendingSave.linkedPageIds
      );
    }, []);

    const queueSave = useCallback(
      (ed: TiptapEditor) => {
        pendingSaveRef.current = {
          html: ed.getHTML(),
          text: ed.getText(),
          linkedPageIds: getLinkedPageIds(ed),
          onUpdate: onUpdateRef.current,
        };
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(flushPendingSave, 1000);
      },
      [flushPendingSave]
    );

    const persistEditorNow = useCallback(
      (ed: TiptapEditor) => {
        if (!editableRef.current) return;
        pendingSaveRef.current = {
          html: ed.getHTML(),
          text: ed.getText(),
          linkedPageIds: getLinkedPageIds(ed),
          onUpdate: onUpdateRef.current,
        };
        flushPendingSave();
      },
      [flushPendingSave]
    );

    const editor = useEditor({
      immediatelyRender: false,
      editable,
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
          codeBlock: {
            defaultLanguage: null,
            enableTabIndentation: true,
            languageClassPrefix: "language-",
            tabSize: 2,
          },
          link: false,
          underline: false,
        }),
        Placeholder.configure({
          placeholder: "开始写作，或输入 / 打开命令菜单...",
        }),
        Link.configure({
          openOnClick: true,
          autolink: true,
          HTMLAttributes: {
            class: "text-blue-500 underline cursor-pointer",
          },
        }),
        PasteLinkOnSelection,
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
        BlockIdExtension,
        InlineCommentMark,
        CodeSyntaxHighlight,
        SlashCommandExtension,
        KeyboardShortcuts,
        InlineDatabaseNode,
        FilePreviewNode,
        ToggleBlockNode,
        CalloutNode,
        TableOfContentsNode,
        ColumnLayoutNode,
        ColumnBlockNode,
        BookmarkNode,
        EquationNode,
        InlineEquationNode,
        WikiReferenceNode,
        TemplateButtonNode,
        BreadcrumbBlockNode,
        SyncedBlockNode,
        EmbedNode,
        BlockOperations,
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
        handleDrop: (_view, event) => {
          if (!editableRef.current) return false;
          const files = Array.from(event.dataTransfer?.files ?? []);
          const editorInstance = tiptapEditorRef.current;
          if (!files.length || !editorInstance) return false;
          event.preventDefault();
          void insertFilesAsPreviews(editorInstance, files);
          return true;
        },
        handlePaste: (_view, event) => {
          if (!editableRef.current) return false;
          const files = Array.from(event.clipboardData?.files ?? []);
          const editorInstance = tiptapEditorRef.current;
          if (!files.length || !editorInstance) return false;
          event.preventDefault();
          void insertFilesAsPreviews(editorInstance, files);
          return true;
        },
      },
      onUpdate: ({ editor: ed }) => {
        if (!editableRef.current) return;
        queueSave(ed);
      },
    });

    useEffect(() => {
      tiptapEditorRef.current = editor;
    }, [editor]);

    useEffect(() => {
      editableRef.current = editable;
      editor?.setEditable(editable);
    }, [editable, editor]);

    useEffect(() => {
      if (!editor) return;
      let timers: number[] = [];

      const clearScheduledScrolls = () => {
        timers.forEach((timer) => window.clearTimeout(timer));
        timers = [];
      };

      const scrollToHashBlock = () => {
        const blockId = getBlockIdFromLocationHash();
        if (!blockId) return;
        clearScheduledScrolls();
        timers = [0, 100, 250, 500, 900, 1300].map((delay) =>
          window.setTimeout(() => {
            highlightLinkedBlock(blockId);
          }, delay)
        );
      };

      const handleHashChange = () => scrollToHashBlock();

      scrollToHashBlock();
      window.addEventListener("hashchange", handleHashChange);
      return () => {
        clearScheduledScrolls();
        window.removeEventListener("hashchange", handleHashChange);
      };
    }, [editor, pageId, initialContent]);

    useEffect(() => {
      if (!editor) return;

      const handleEditorBlockMenu = () => {
        if (!editableRef.current) {
          window.alert("当前页面已锁定，解锁后才能编辑。");
          return;
        }
        editor.commands.focus();
        setBlockMenuOpen(true);
      };

      window.addEventListener(EDITOR_BLOCK_MENU_EVENT, handleEditorBlockMenu);
      return () =>
        window.removeEventListener(
          EDITOR_BLOCK_MENU_EVENT,
          handleEditorBlockMenu
        );
    }, [editor]);

    useEffect(() => {
      if (!editor) return;

      const handleInlineCommentDeleted = (event: Event) => {
        const detail = (event as CustomEvent<{ inlineCommentId?: string }>).detail;
        if (!detail?.inlineCommentId) return;
        removeInlineCommentMark(editor, detail.inlineCommentId);
        persistEditorNow(editor);
      };

      window.addEventListener(
        INLINE_COMMENT_DELETED_EVENT,
        handleInlineCommentDeleted
      );
      return () =>
        window.removeEventListener(
          INLINE_COMMENT_DELETED_EVENT,
          handleInlineCommentDeleted
        );
    }, [editor, persistEditorNow]);

    useEffect(() => {
      if (!editor) return;

      const handleEditorLocalCommand = (event: Event) => {
        const command = (event as CustomEvent<{ command?: EditorLocalCommand }>)
          .detail?.command;
        if (!command) return;

        if (!editableRef.current) {
          window.alert("Unlock this page before editing it.");
          return;
        }

        void Promise.resolve(
          runEditorLocalCommand(editor, command, pageId, persistEditorNow)
        )
          .then((changed) => {
            if (changed) persistEditorNow(editor);
          })
          .catch((err) => {
            console.error("[Zhinote] Failed to run editor command:", err);
            window.alert("Command failed. Please check the console.");
          });
      };

      window.addEventListener(
        EDITOR_LOCAL_COMMAND_EVENT,
        handleEditorLocalCommand
      );
      return () =>
        window.removeEventListener(
          EDITOR_LOCAL_COMMAND_EVENT,
          handleEditorLocalCommand
        );
    }, [editor, pageId, persistEditorNow]);

    useEffect(() => {
      if (!editor) return;
      const editorDom = editor.view.dom;

      const handleInlineCommentClick = (event: MouseEvent) => {
        const target =
          event.target instanceof Element
            ? event.target.closest("[data-inline-comment-id]")
            : null;
        if (!target || !editorDom.contains(target)) return;

        const inlineCommentId = target.getAttribute("data-inline-comment-id");
        if (!inlineCommentId) return;
        window.dispatchEvent(
          new CustomEvent(INLINE_COMMENT_SELECTED_EVENT, {
            detail: { inlineCommentId },
          })
        );
      };

      editorDom.addEventListener("click", handleInlineCommentClick);
      return () => {
        editorDom.removeEventListener("click", handleInlineCommentClick);
      };
    }, [editor]);

    useEffect(() => {
      const handleFileImportProgress = (event: Event) => {
        const detail = (event as CustomEvent<FilePreviewImportProgress>).detail;
        if (!detail) return;
        if (fileImportProgressTimerRef.current) {
          clearTimeout(fileImportProgressTimerRef.current);
          fileImportProgressTimerRef.current = null;
        }
        setFileImportProgress(detail);
        if (detail.status === "done") {
          fileImportProgressTimerRef.current = setTimeout(() => {
            setFileImportProgress(null);
            fileImportProgressTimerRef.current = null;
          }, detail.failed > 0 ? 4000 : 1800);
        }
      };

      window.addEventListener(
        FILE_PREVIEW_IMPORT_PROGRESS_EVENT,
        handleFileImportProgress
      );
      return () => {
        window.removeEventListener(
          FILE_PREVIEW_IMPORT_PROGRESS_EVENT,
          handleFileImportProgress
        );
        if (fileImportProgressTimerRef.current) {
          clearTimeout(fileImportProgressTimerRef.current);
          fileImportProgressTimerRef.current = null;
        }
      };
    }, []);

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
                text: `📄 ${childTitle || "未命名页面"}`,
              },
            ],
          })
          .run();
        // Return current HTML so caller can save immediately
        return editor.getHTML();
      },
      insertInlineDatabase(databaseId: string) {
        if (!editor) return;
        editor.chain().focus().insertInlineDatabase(databaseId).run();
        return editor.getHTML();
      },
      appendHtml(html: string) {
        if (!editor || !html.trim()) return;
        editor
          .chain()
          .focus("end")
          .insertContentAt(editor.state.doc.content.size, html)
          .run();
        return editor.getHTML();
      },
      setContent(html: string) {
        editor?.commands.setContent(html || "");
      },
      getHTML() {
        return editor?.getHTML() ?? "";
      },
    }));

    // Reset editor content when switching pages
    const prevPageIdRef = useRef(pageId);
    useEffect(() => {
      if (prevPageIdRef.current !== pageId && editor) {
        flushPendingSave();
        editor.commands.setContent(initialContent || "");
        prevPageIdRef.current = pageId;
      }
    }, [pageId, initialContent, editor, flushPendingSave]);

    // Cleanup
    useEffect(() => {
      return () => {
        flushPendingSave();
      };
    }, [flushPendingSave]);

    if (!editor) return null;

    return (
      <div className="w-full">
        {/* Toolbar */}
        {!editable && (
          <div className="mb-4 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
            当前页面已锁定，解锁后才能编辑。
          </div>
        )}
        {editable && (
        <div className="zhinote-editor-toolbar flex items-center gap-1 border-b border-zinc-200 dark:border-zinc-700 pb-2 mb-4 flex-wrap">
          <ToolbarButton
            active={false}
            onClick={() => editor.chain().focus().undo().run()}
            label="撤销"
            title="撤销"
          />
          <ToolbarButton
            active={false}
            onClick={() => editor.chain().focus().redo().run()}
            label="重做"
            title="重做"
          />
          <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-600 mx-1" />
          <ToolbarButton
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
            label="B"
            title="加粗"
            bold
          />
          <ToolbarButton
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            label="I"
            title="斜体"
            italic
          />
          <ToolbarButton
            active={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            label="U"
            title="下划线"
            underline
          />
          <ToolbarButton
            active={editor.isActive("strike")}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            label="S"
            title="删除线"
            strike
          />
          <ToolbarButton
            active={editor.isActive("link")}
            onClick={() => promptForLink(editor)}
            label="链接"
            title="添加或编辑链接"
          />
          <ToolbarButton
            active={editor.isActive("highlight")}
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            label="H"
            title="高亮"
            highlight
          />
          <ToolbarButton
            active={false}
            onClick={() =>
              editor.chain().focus().unsetAllMarks().clearNodes().run()
            }
            label="清除"
            title="清除格式"
          />
          <BlockContextMenu
            editor={editor}
            pageId={pageId}
            onPersistContent={persistEditorNow}
            open={blockMenuOpen}
            onOpenChange={setBlockMenuOpen}
          />
          <ToolbarColorSwatches
            label="A"
            title="文字颜色"
            colors={TEXT_COLORS}
            activeColor={editor.getAttributes("textStyle").color}
            onSelect={(color) => editor.chain().focus().setColor(color).run()}
            onClear={() => editor.chain().focus().unsetColor().run()}
          />
          <ToolbarColorSwatches
            label="Bg"
            title="背景色"
            colors={BACKGROUND_COLORS}
            activeColor={editor.getAttributes("highlight").color}
            onSelect={(color) =>
              editor.chain().focus().setHighlight({ color }).run()
            }
            onClear={() => editor.chain().focus().unsetHighlight().run()}
          />
          <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-600 mx-1" />
          <ToolbarButton
            active={editor.isActive("heading", { level: 1 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 1 }).run()
            }
            label="H1"
            title="标题 1"
          />
          <ToolbarButton
            active={editor.isActive("heading", { level: 2 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
            label="H2"
            title="标题 2"
          />
          <ToolbarButton
            active={editor.isActive("heading", { level: 3 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
            label="H3"
            title="标题 3"
          />
          <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-600 mx-1" />
          <ToolbarButton
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            label="&#8226;"
            title="无序列表"
          />
          <ToolbarButton
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            label="1."
            title="编号列表"
          />
          <ToolbarButton
            active={editor.isActive("taskList")}
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            label="&#9745;"
            title="待办列表"
          />
          <ToolbarButton
            active={editor.isActive("codeBlock")}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            label="<>"
            title="代码块"
          />
          {editor.isActive("codeBlock") && (
            <>
              <select
                aria-label="代码语言"
                title="代码语言"
                value={String(editor.getAttributes("codeBlock").language ?? "")}
                onChange={(event) =>
                  editor
                    .chain()
                    .focus()
                    .updateAttributes("codeBlock", {
                      language: event.target.value || null,
                    })
                    .run()
                }
                className="h-7 rounded border border-zinc-200 bg-white px-2 text-xs text-zinc-600 outline-none hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
              >
                {CODE_BLOCK_LANGUAGES.map((language) => (
                  <option key={language.value || "plain"} value={language.value}>
                    {language.label}
                  </option>
                ))}
              </select>
              <ToolbarButton
                active={false}
                onClick={() => void copyCurrentCodeBlock(editor)}
                label="复制"
                title="复制代码"
              />
            </>
          )}
          <ToolbarButton
            active={editor.isActive("blockquote")}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            label="&#8220;"
            title="引用"
          />
          <ToolbarButton
            active={editor.isActive("toggleBlock")}
            onClick={() => editor.chain().focus().insertToggleBlock().run()}
            label=">"
            title="折叠列表"
          />
          <ToolbarButton
            active={editor.isActive("calloutBlock")}
            onClick={() => editor.chain().focus().insertCallout().run()}
            label="!"
            title="提示块"
          />
          <ToolbarButton
            active={editor.isActive("columnLayout")}
            onClick={() => editor.chain().focus().insertTwoColumns().run()}
            label="双栏"
            title="双栏"
          />
          <ToolbarButton
            active={editor.isActive("equationBlock")}
            onClick={() => editor.chain().focus().insertEquation().run()}
            label="公式"
            title="公式块"
          />
          <ToolbarButton
            active={editor.isActive("inlineEquation")}
            onClick={() => {
              const formula = window.prompt("行内公式：", "");
              if (formula === null) return;
              editor.chain().focus().insertInlineEquation(formula.trim()).run();
            }}
            label="$x$"
            title="行内公式"
          />
          <ToolbarButton
            active={editor.isActive("templateButton")}
            onClick={() => editor.chain().focus().insertTemplateButton().run()}
            label="模板"
            title="模板按钮"
          />
          <ToolbarButton
            active={editor.isActive("breadcrumbBlock")}
            onClick={() =>
              editor.chain().focus().insertBreadcrumbBlock(pageId).run()
            }
            label="路径"
            title="面包屑路径"
          />
          <ToolbarButton
            active={editor.isActive("syncedBlock")}
            onClick={() => editor.chain().focus().insertSyncedBlock().run()}
            label="同步"
            title="同步块"
          />
          <ToolbarButton
            active={editor.isActive("embedBlock")}
            onClick={() => editor.chain().focus().insertEmbed().run()}
            label="嵌入"
            title="网页嵌入"
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
            title="插入表格"
          />
          {editor.isActive("table") && (
            <>
              <ToolbarButton
                active={false}
                onClick={() => editor.chain().focus().addRowAfter().run()}
                label="+行"
                title="在下方添加行"
              />
              <ToolbarButton
                active={false}
                onClick={() => editor.chain().focus().addColumnAfter().run()}
                label="+列"
                title="在右侧添加列"
              />
              <ToolbarButton
                active={false}
                onClick={() => editor.chain().focus().deleteRow().run()}
                label="-行"
                title="删除行"
              />
              <ToolbarButton
                active={false}
                onClick={() => editor.chain().focus().deleteColumn().run()}
                label="-列"
                title="删除列"
              />
              <ToolbarButton
                active={false}
                onClick={() => editor.chain().focus().toggleHeaderRow().run()}
                label="表头"
                title="切换表头行"
              />
              <ToolbarButton
                active={false}
                onClick={() => editor.chain().focus().mergeCells().run()}
                label="合并"
                title="合并选中单元格"
              />
              <ToolbarButton
                active={false}
                onClick={() => editor.chain().focus().splitCell().run()}
                label="拆分"
                title="拆分单元格"
              />
              <ToolbarButton
                active={false}
                onClick={() => editor.chain().focus().deleteTable().run()}
                label="删表"
                title="删除表格"
              />
            </>
          )}
          <ToolbarButton
            active={editor.isActive("tableOfContentsBlock")}
            onClick={() => editor.chain().focus().insertTableOfContents().run()}
            label="TOC"
            title="目录"
          />
          <ToolbarButton
            active={false}
            onClick={() => promptAndInsertFilePreview(editor)}
            label="文件"
            title="上传文件 / 报告"
          />
          <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-600 mx-1" />
          <ToolbarButton
            active={false}
            onClick={() => editor.chain().focus().moveCurrentBlockUp().run()}
            label="上移"
            title="上移当前块"
          />
          <ToolbarButton
            active={false}
            onClick={() => editor.chain().focus().moveCurrentBlockDown().run()}
            label="下移"
            title="下移当前块"
          />
          <ToolbarButton
            active={false}
            onClick={() => editor.chain().focus().duplicateCurrentBlock().run()}
            label="复制"
            title="复制当前块"
          />
          <ToolbarButton
            active={false}
            onClick={() => editor.chain().focus().deleteCurrentBlock().run()}
            label="删除"
            title="删除当前块"
          />
        </div>
        )}
        {editable && fileImportProgress && (
          <FileImportProgressBar progress={fileImportProgress} />
        )}
        <div
          className="zhinote-editor-surface"
          data-editable={editable ? "true" : "false"}
        >
          <BlockDragHandleLayer editor={editor} editable={editable} />
          <CodeBlockCopyLayer editor={editor} />
          <EditorContent editor={editor} />
        </div>
      </div>
    );
  }
);

Editor.displayName = "Editor";
export default Editor;

function runEditorLocalCommand(
  editor: TiptapEditor,
  command: EditorLocalCommand,
  pageId: string,
  onPersistContent?: (editor: TiptapEditor) => void
): boolean | Promise<boolean> {
  const chain = editor.chain().focus();

  switch (command) {
    case "block-comment":
      return commentCurrentBlock(
        editor,
        pageId,
        onPersistContent ?? (() => undefined)
      ).then(() => false);
    case "copy-block-html":
      return copyCurrentBlockHtml(editor).then(() => false);
    case "copy-block-markdown":
      return copyCurrentBlockMarkdown(editor).then(() => false);
    case "copy-block-link":
      return copyCurrentBlockLink(
        editor,
        onPersistContent ?? (() => undefined)
      ).then(() => false);
    case "child-page":
      return createChildPageFromEditorCommand(editor, pageId);
    case "bold":
      return chain.toggleBold().run();
    case "italic":
      return chain.toggleItalic().run();
    case "underline":
      return chain.toggleUnderline().run();
    case "strike":
      return chain.toggleStrike().run();
    case "clear-formatting":
      return chain.unsetAllMarks().clearNodes().run();
    case "paragraph":
      return chain.setParagraph().run();
    case "heading-1":
      return chain.toggleHeading({ level: 1 }).run();
    case "heading-2":
      return chain.toggleHeading({ level: 2 }).run();
    case "heading-3":
      return chain.toggleHeading({ level: 3 }).run();
    case "bullet-list":
      return chain.toggleBulletList().run();
    case "numbered-list":
      return chain.toggleOrderedList().run();
    case "task-list":
      return chain.toggleTaskList().run();
    case "blockquote":
      return chain.toggleBlockquote().run();
    case "code-block":
      return chain.toggleCodeBlock().run();
    case "horizontal-rule":
      return chain.setHorizontalRule().run();
    case "toggle-block":
      return chain.insertToggleBlock().run();
    case "callout":
      return chain.insertCallout().run();
    case "table-of-contents":
      return chain.insertTableOfContents().run();
    case "columns":
      return chain.insertTwoColumns().run();
    case "bookmark":
      return chain.insertBookmark({ url: "", title: "" }).run();
    case "embed":
      return chain.insertEmbed().run();
    case "equation":
      return chain.insertEquation().run();
    case "inline-equation": {
      const formula = window.prompt("行内公式：", "");
      if (formula === null) return false;
      return chain.insertInlineEquation(formula.trim()).run();
    }
    case "template-button":
      return chain.insertTemplateButton().run();
    case "breadcrumb":
      return chain.insertBreadcrumbBlock(pageId).run();
    case "synced-block":
      return chain.insertSyncedBlock().run();
    case "table":
      return chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    default:
      return false;
  }
}

async function createChildPageFromEditorCommand(
  editor: TiptapEditor,
  parentPageId: string
) {
  const title = window.prompt("新页面标题：", "未命名页面");
  if (title === null) return false;

  const pageTitle = title.trim() || "未命名页面";
  const page = await createPage({
    title: pageTitle,
    parentId: parentPageId,
  });
  const allPages = await getAllPages();
  const parentPage = allPages.find((candidate) => candidate.id === parentPageId);
  await updatePage(page.id, {
    content_text: buildChildPageInitialHtml({
      parentPageId,
      parentTitle: parentPage?.title ?? null,
    }),
  });
  useWorkspaceStore.getState().setPages(allPages);

  editor
    .chain()
    .focus()
    .insertContent([
      {
        type: "mention",
        attrs: {
          id: page.id,
          label: page.title || pageTitle,
        },
      },
      { type: "text", text: " " },
    ])
    .run();

  await updatePage(parentPageId, { content_text: editor.getHTML() });
  await updateWikiLinks(parentPageId, getLinkedPageIds(editor));

  window.location.href = `/page/${page.id}`;
  return false;
}

function FileImportProgressBar({
  progress,
}: {
  progress: FilePreviewImportProgress;
}) {
  const percent =
    progress.total > 0
      ? Math.min(100, Math.round((progress.completed / progress.total) * 100))
      : 0;
  const hasFailures = progress.failed > 0;
  const complete = progress.status === "done";

  return (
    <div
      className={`mb-3 rounded-md border px-3 py-2 text-xs ${
        hasFailures
          ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
          : "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"
      }`}
    >
      <div className="mb-1 flex items-center justify-between gap-3">
        <span>
          {complete
            ? hasFailures
              ? `已导入 ${progress.completed - progress.failed} / ${
                  progress.total
                } 个文件`
              : `已导入 ${progress.total} 个文件`
            : `正在导入 ${progress.completed} / ${progress.total} 个文件`}
        </span>
        {progress.currentFileName && !complete && (
          <span className="max-w-[220px] truncate text-[11px] opacity-75">
            {progress.currentFileName}
          </span>
        )}
      </div>
      <div className="h-1.5 overflow-hidden rounded bg-white/70 dark:bg-black/20">
        <div
          className={`h-full rounded ${
            hasFailures ? "bg-amber-500" : "bg-blue-500"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {hasFailures && complete && (
        <div className="mt-1 text-[11px] opacity-80">
          {progress.failed} 个文件无法导入。
        </div>
      )}
    </div>
  );
}

function getLinkedPageIds(ed: TiptapEditor) {
  const linkedPageIds: string[] = [];
  ed.state.doc.descendants((node) => {
    if (node.type.name === "mention" && node.attrs.id) {
      linkedPageIds.push(node.attrs.id);
    }
  });
  return linkedPageIds;
}

function BlockContextMenu({
  editor,
  pageId,
  onPersistContent,
  open,
  onOpenChange,
}: {
  editor: TiptapEditor;
  pageId: string;
  onPersistContent: (editor: TiptapEditor) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const run = (action: () => void) => {
    action();
    onOpenChange(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        title="块菜单"
        className={`px-2 py-1 rounded text-sm transition-colors ${
          open
            ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100"
            : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        }`}
      >
        块 v
      </button>
      {open && (
        <div className="absolute left-0 top-8 z-50 w-56 rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <BlockMenuSection label="转换为" />
          <BlockMenuItem
            label="文本"
            onClick={() => run(() => editor.chain().focus().setParagraph().run())}
          />
          <BlockMenuItem
            label="标题 1"
            onClick={() =>
              run(() => editor.chain().focus().toggleHeading({ level: 1 }).run())
            }
          />
          <BlockMenuItem
            label="标题 2"
            onClick={() =>
              run(() => editor.chain().focus().toggleHeading({ level: 2 }).run())
            }
          />
          <BlockMenuItem
            label="标题 3"
            onClick={() =>
              run(() => editor.chain().focus().toggleHeading({ level: 3 }).run())
            }
          />
          <BlockMenuItem
            label="无序列表"
            onClick={() => run(() => editor.chain().focus().toggleBulletList().run())}
          />
          <BlockMenuItem
            label="编号列表"
            onClick={() =>
              run(() => editor.chain().focus().toggleOrderedList().run())
            }
          />
          <BlockMenuItem
            label="待办"
            onClick={() => run(() => editor.chain().focus().toggleTaskList().run())}
          />
          <BlockMenuItem
            label="引用"
            onClick={() => run(() => editor.chain().focus().toggleBlockquote().run())}
          />
          <BlockMenuItem
            label="代码"
            onClick={() => run(() => editor.chain().focus().toggleCodeBlock().run())}
          />
          <BlockMenuDivider />
          <BlockMenuSection label="插入块" />
          <BlockMenuItem
            label="折叠"
            onClick={() => run(() => editor.chain().focus().insertToggleBlock().run())}
          />
          <BlockMenuItem
            label="提示块"
            onClick={() => run(() => editor.chain().focus().insertCallout().run())}
          />
          <BlockMenuItem
            label="目录"
            onClick={() =>
              run(() => editor.chain().focus().insertTableOfContents().run())
            }
          />
          <BlockMenuItem
            label="双栏"
            onClick={() => run(() => editor.chain().focus().insertTwoColumns().run())}
          />
          <BlockMenuItem
            label="模板按钮"
            onClick={() =>
              run(() => editor.chain().focus().insertTemplateButton().run())
            }
          />
          <BlockMenuItem
            label="面包屑路径"
            onClick={() =>
              run(() => editor.chain().focus().insertBreadcrumbBlock(pageId).run())
            }
          />
          <BlockMenuItem
            label="同步块"
            onClick={() => run(() => editor.chain().focus().insertSyncedBlock().run())}
          />
          <BlockMenuItem
            label="网页嵌入"
            onClick={() => run(() => editor.chain().focus().insertEmbed().run())}
          />
          <BlockMenuDivider />
          <BlockMenuSection label="当前块" />
          <BlockMenuItem
            label="上移"
            onClick={() => run(() => editor.chain().focus().moveCurrentBlockUp().run())}
          />
          <BlockMenuItem
            label="下移"
            onClick={() =>
              run(() => editor.chain().focus().moveCurrentBlockDown().run())
            }
          />
          <BlockMenuItem
            label="复制块"
            onClick={() =>
              run(() => editor.chain().focus().duplicateCurrentBlock().run())
            }
          />
          <BlockMenuItem
            label="复制 HTML"
            onClick={() => run(() => void copyCurrentBlockHtml(editor))}
          />
          <BlockMenuItem
            label="复制 Markdown"
            onClick={() => run(() => void copyCurrentBlockMarkdown(editor))}
          />
          <BlockMenuItem
            label="复制块链接"
            onClick={() =>
              run(() => void copyCurrentBlockLink(editor, onPersistContent))
            }
          />
          <BlockMenuItem
            label="评论"
            onClick={() =>
              run(() => void commentCurrentBlock(editor, pageId, onPersistContent))
            }
          />
          <BlockMenuItem
            label="删除"
            danger
            onClick={() =>
              run(() => editor.chain().focus().deleteCurrentBlock().run())
            }
          />
        </div>
      )}
    </div>
  );
}

function BlockMenuSection({ label }: { label: string }) {
  return (
    <div className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
      {label}
    </div>
  );
}

function BlockMenuDivider() {
  return <div className="my-1 h-px bg-zinc-100 dark:bg-zinc-800" />;
}

function BlockMenuItem({
  label,
  danger,
  onClick,
}: {
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full px-3 py-1.5 text-left text-xs transition-colors ${
        danger
          ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
          : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      }`}
    >
      {label}
    </button>
  );
}

async function copyCurrentBlockHtml(editor: TiptapEditor) {
  const block = getSelectedTopLevelBlocksMeta(editor) ?? getCurrentBlockMeta(editor);
  if (!block?.html) return;

  try {
    await window.navigator.clipboard.writeText(block.html);
  } catch {
    window.prompt("复制块 HTML：", block.html);
  }
}

async function copyCurrentBlockMarkdown(editor: TiptapEditor) {
  const block = getSelectedTopLevelBlocksMeta(editor) ?? getCurrentBlockMeta(editor);
  if (!block?.html) return;

  const markdown = htmlToMarkdown(block.html);
  try {
    await window.navigator.clipboard.writeText(markdown);
  } catch {
    window.prompt("复制块 Markdown：", markdown);
  }
}

async function copyCurrentBlockLink(
  editor: TiptapEditor,
  onPersistContent: (editor: TiptapEditor) => void
) {
  const block = ensureCurrentBlockId(editor);
  if (!block?.blockId) return;
  onPersistContent(editor);

  const url = new URL(window.location.href);
  url.hash = block.blockId;
  const link = url.toString();

  try {
    await window.navigator.clipboard.writeText(link);
  } catch {
    window.prompt("复制块链接：", link);
  }
}

async function copyCurrentCodeBlock(editor: TiptapEditor) {
  const block = getCurrentCodeBlockMeta(editor);
  if (!block) return;

  await copyCodeText(block.text);
}

async function commentCurrentBlock(
  editor: TiptapEditor,
  pageId: string,
  onPersistContent: (editor: TiptapEditor) => void
) {
  const { selection } = editor.state;
  if (!selection.empty) {
    const from = selection.from;
    const to = selection.to;
    const anchorText = editor.state.doc.textBetween(from, to, "\n").trim();
    if (anchorText) {
      const body = window.prompt("给这段选中文本添加本地评论：");
      if (!body?.trim()) return;

      const inlineCommentId = `inline_${nanoid(12)}`;
      await addBlockComment({
        pageId,
        blockRef: inlineCommentId,
        anchorText: truncateBlockAnchor(anchorText),
        body: body.trim(),
      });
      editor
        .chain()
        .focus()
        .setTextSelection({ from, to })
        .setInlineComment(inlineCommentId)
        .run();
      onPersistContent(editor);
      window.dispatchEvent(new Event(BLOCK_COMMENTS_CHANGED_EVENT));
      return;
    }
  }

  const block = ensureCurrentBlockId(editor);
  if (!block) return;
  onPersistContent(editor);

  const body = window.prompt("给当前块添加本地评论：");
  if (!body?.trim()) return;

  await addBlockComment({
    pageId,
    blockRef: block.blockId,
    anchorText: block.text,
    body: body.trim(),
  });
  window.dispatchEvent(new Event(BLOCK_COMMENTS_CHANGED_EVENT));
}

function getCurrentBlockMeta(editor: TiptapEditor) {
  const { state } = editor;
  const { $from } = state.selection;
  if ($from.depth === 0) return null;

  const pos = $from.before(1);
  const node = state.doc.nodeAt(pos);
  if (!node) return null;

  let index = 0;
  state.doc.forEach((_child, offset, childIndex) => {
    if (offset === pos) index = childIndex;
  });

  const wrapper = document.createElement("div");
  const serializer = DOMSerializer.fromSchema(state.schema);
  wrapper.appendChild(serializer.serializeNode(node));
  const text =
    node.textContent.trim() ||
    wrapper.textContent?.trim() ||
    node.type.name ||
    "Selected block";

  return {
    blockId: typeof node.attrs.blockId === "string" ? node.attrs.blockId : "",
    html: wrapper.innerHTML,
    index,
    text: truncateBlockAnchor(text),
  };
}

function getSelectedTopLevelBlocksMeta(editor: TiptapEditor) {
  const { state } = editor;
  const { selection } = state;
  if (selection.empty) return null;

  const nodes: ProseMirrorNode[] = [];
  const { from, to } = selection;
  state.doc.forEach((node, offset) => {
    const end = offset + node.nodeSize;
    if (from < end && to > offset) nodes.push(node);
  });

  if (nodes.length <= 1) return null;

  const wrapper = document.createElement("div");
  const serializer = DOMSerializer.fromSchema(state.schema);
  wrapper.appendChild(serializer.serializeFragment(Fragment.fromArray(nodes)));
  const text =
    wrapper.textContent?.trim() ||
    nodes.map((node) => node.textContent).join("\n").trim() ||
    "Selected blocks";

  return {
    blockId: "",
    html: wrapper.innerHTML,
    index: 0,
    text: truncateBlockAnchor(text),
  };
}

function getCurrentCodeBlockMeta(editor: TiptapEditor) {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name === "codeBlock") {
      return {
        node,
        pos: $from.before(depth),
        text: node.textContent,
      };
    }
  }
  return null;
}

async function copyCodeText(code: string) {
  try {
    await window.navigator.clipboard.writeText(code);
  } catch {
    window.prompt("Copy code:", code);
  }
}

function CodeBlockCopyLayer({ editor }: { editor: TiptapEditor }) {
  const [target, setTarget] = useState<{
    code: string;
    left: number;
    top: number;
  } | null>(null);

  const updateTarget = useCallback(() => {
    const block = getCurrentCodeBlockMeta(editor);
    if (!block) {
      setTarget(null);
      return;
    }

    const element = editor.view.nodeDOM(block.pos);
    if (!(element instanceof HTMLElement)) {
      setTarget(null);
      return;
    }

    const rect = element.getBoundingClientRect();
    setTarget(getCodeCopyTarget(rect, block.text));
  }, [editor]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(updateTarget);
    const editorDom = editor.view.dom;

    const handleMouseMove = (event: MouseEvent) => {
      const targetElement =
        event.target instanceof Element
          ? event.target.closest("pre")
          : null;
      if (targetElement instanceof HTMLElement && editorDom.contains(targetElement)) {
        setTarget(
          getCodeCopyTarget(
            targetElement.getBoundingClientRect(),
            targetElement.textContent ?? ""
          )
        );
        return;
      }

      if (!getCurrentCodeBlockMeta(editor)) setTarget(null);
    };

    editor.on("selectionUpdate", updateTarget);
    editor.on("transaction", updateTarget);
    editorDom.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("resize", updateTarget);
    document.addEventListener("scroll", updateTarget, true);
    return () => {
      window.cancelAnimationFrame(frame);
      editor.off("selectionUpdate", updateTarget);
      editor.off("transaction", updateTarget);
      editorDom.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", updateTarget);
      document.removeEventListener("scroll", updateTarget, true);
    };
  }, [editor, updateTarget]);

  if (!target) return null;

  return (
    <button
      type="button"
      className="zhinote-code-copy-button"
      style={{ left: target.left, top: target.top }}
      onMouseDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void copyCodeText(target.code);
      }}
    >
      Copy
    </button>
  );
}

function getCodeCopyTarget(rect: DOMRect, code: string) {
  return {
    code,
    left: Math.min(
      Math.max(8, window.innerWidth - 70),
      Math.max(8, rect.right - 62)
    ),
    top: Math.max(8, rect.top + 8),
  };
}

function ensureCurrentBlockId(editor: TiptapEditor) {
  const block = getCurrentBlockMeta(editor);
  if (!block) return null;
  if (block.blockId) return block;

  const { state } = editor;
  const { $from } = state.selection;
  const pos = $from.before(1);
  const node = state.doc.nodeAt(pos);
  if (!node) return null;

  const blockId = `blk_${nanoid(12)}`;
  const tr = state.tr.setNodeMarkup(pos, undefined, {
    ...node.attrs,
    blockId,
  });
  editor.view.dispatch(tr);
  return { ...block, blockId };
}

function getBlockIdFromLocationHash() {
  const hash = window.location.hash.slice(1);
  if (!hash.startsWith("blk_")) return null;
  try {
    return decodeURIComponent(hash);
  } catch {
    return hash;
  }
}

function highlightLinkedBlock(blockId: string) {
  const target = Array.from(
    document.querySelectorAll("[data-block-id]")
  ).find((element) => element.getAttribute("data-block-id") === blockId);

  if (!target || !("scrollIntoView" in target) || !target.classList) {
    return false;
  }
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  target.classList.add("zhinote-linked-block-target");
  window.setTimeout(() => {
    target.classList.remove("zhinote-linked-block-target");
  }, 1600);
  return true;
}

function removeInlineCommentMark(editor: TiptapEditor, inlineCommentId: string) {
  const markType = editor.state.schema.marks.inlineComment;
  if (!markType) return;

  const tr = editor.state.tr;
  let changed = false;
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText) return;
    const mark = node.marks.find(
      (candidate) =>
        candidate.type === markType &&
        candidate.attrs.inlineCommentId === inlineCommentId
    );
    if (!mark) return;
    tr.removeMark(pos, pos + node.nodeSize, mark);
    changed = true;
  });

  if (changed) editor.view.dispatch(tr);
}

function truncateBlockAnchor(value: string) {
  return value.length > 180 ? `${value.slice(0, 177)}...` : value;
}

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

function ToolbarColorSwatches({
  label,
  title,
  colors,
  activeColor,
  onSelect,
  onClear,
}: {
  label: string;
  title: string;
  colors: { label: string; value: string }[];
  activeColor?: string;
  onSelect: (color: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded px-1 py-1">
      <button
        type="button"
        onClick={onClear}
        title={`Clear ${title.toLowerCase()}`}
        className="text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        {label}
      </button>
      <div className="flex items-center gap-0.5">
        {colors.map((color) => (
          <button
            key={color.value}
            type="button"
            onClick={() => onSelect(color.value)}
            title={color.label}
            className={`h-4 w-4 rounded-sm border transition-transform hover:scale-110 ${
              activeColor === color.value
                ? "border-zinc-900 ring-1 ring-zinc-900 dark:border-zinc-100 dark:ring-zinc-100"
                : "border-zinc-300 dark:border-zinc-600"
            }`}
            style={{ backgroundColor: color.value }}
          />
        ))}
      </div>
    </div>
  );
}
