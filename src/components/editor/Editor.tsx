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
  getPageMetadata,
  updateWikiLinks,
} from "@/lib/db/local/queries";
import {
  BLOCK_COMMENTS_CHANGED_EVENT,
  INLINE_COMMENT_DELETED_EVENT,
  INLINE_COMMENT_SELECTED_EVENT,
} from "@/components/shared/blockCommentEvents";
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
import { FileEmbedNode } from "./extensions/FileEmbedNode";
import { ToggleBlockNode } from "./extensions/ToggleBlockNode";
import { CalloutNode } from "./extensions/CalloutNode";
import { ModuleCardNode } from "./extensions/ModuleCardNode";
import { TableOfContentsNode } from "./extensions/TableOfContentsNode";
import { BlockOperations } from "./extensions/BlockOperations";
import { IndentExtension } from "./extensions/IndentExtension";
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
import { PastePageLink } from "./extensions/PastePageLink";
import { buildChildPageInitialHtml } from "@/lib/pages/childPageSeed";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useLocalFirstDatabaseNavigation } from "@/hooks/useLocalFirstDatabaseNavigation";
import { useLocalFirstPageNavigation } from "@/hooks/useLocalFirstPageNavigation";
import {
  openLocalFirstPageRoute,
  subscribeLocalFirstPageNavigation,
} from "@/lib/pages/localFirstPageNavigation";
import { subscribeLocalFirstDatabaseNavigation } from "@/lib/database/localFirstDatabaseNavigation";
import { BlockDragHandleLayer } from "./BlockDragHandleLayer";
import EditorBubbleMenu from "./EditorBubbleMenu";
import {
  FILE_PREVIEW_IMPORT_PROGRESS_EVENT,
  type FilePreviewImportProgress,
  insertFilesAsEmbeds,
} from "./filePreviewUpload";
import {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";

type OpenPage = ReturnType<typeof useLocalFirstPageNavigation>;

interface EditorProps {
  pageId: string;
  initialContent?: string | null;
  editable?: boolean;
  onUpdate?: (html: string, text: string, linkedPageIds: string[]) => void;
}

const CODE_BLOCK_LANGUAGE_OPTIONS = [
  { label: "Plain", value: "text" },
  { label: "JavaScript", value: "javascript" },
  { label: "TypeScript", value: "typescript" },
  { label: "Python", value: "python" },
  { label: "SQL", value: "sql" },
  { label: "HTML", value: "html" },
  { label: "CSS", value: "css" },
  { label: "JSON", value: "json" },
  { label: "Markdown", value: "markdown" },
  { label: "YAML", value: "yaml" },
  { label: "XML", value: "xml" },
  { label: "Shell", value: "bash" },
  { label: "LaTeX", value: "latex" },
  { label: "BibTeX", value: "bibtex" },
  { label: "Mermaid", value: "mermaid" },
  { label: "RIS", value: "ris" },
  { label: "Julia", value: "julia" },
  { label: "SAS", value: "sas" },
  { label: "Stata", value: "stata" },
  { label: "Log", value: "log" },
];

const CODE_BLOCK_LANGUAGE_VALUES = CODE_BLOCK_LANGUAGE_OPTIONS.map(
  (option) => option.value
).join(",");

const loadPageMutationModule = () => import("@/lib/pages/cloudPageMutations");
const loadPageExportModule = () => import("@/lib/export/pageExport");

export interface EditorRef {
  insertSubPageLink: (childId: string, childTitle: string) => string | undefined;
  insertInlineDatabase: (databaseId: string) => string | undefined;
  appendHtml: (html: string) => string | undefined;
  setContent: (html: string) => void;
  getHTML: () => string;
}

const Editor = forwardRef<EditorRef, EditorProps>(
  ({ pageId, initialContent, editable = true, onUpdate }, ref) => {
    const openDatabase = useLocalFirstDatabaseNavigation();
    const openPage = useLocalFirstPageNavigation();
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
        PastePageLink,
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
        FileEmbedNode,
        ToggleBlockNode,
        CalloutNode,
        ModuleCardNode,
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
        IndentExtension,
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
          void insertFilesAsEmbeds(editorInstance, files);
          return true;
        },
        handlePaste: (_view, event) => {
          if (!editableRef.current) return false;
          const files = Array.from(event.clipboardData?.files ?? []);
          const editorInstance = tiptapEditorRef.current;
          if (!files.length || !editorInstance) return false;
          event.preventDefault();
          void insertFilesAsEmbeds(editorInstance, files);
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
        // The static block menu is gone; trigger the "/" slash menu instead.
        editor.chain().focus().insertContent("/").run();
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
          runEditorLocalCommand(editor, command, pageId, persistEditorNow, openPage)
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
    }, [editor, openPage, pageId, persistEditorNow]);

    useEffect(() => {
      return subscribeLocalFirstPageNavigation((target, options) => {
        openPage(target, options);
      });
    }, [openPage]);

    useEffect(() => {
      return subscribeLocalFirstDatabaseNavigation((databaseId, options) => {
        openDatabase(databaseId, options);
      });
    }, [openDatabase]);

    const handleInternalPageLinkClick = useCallback(
      (event: ReactMouseEvent<HTMLDivElement>) => {
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }
        const target = event.target instanceof Element ? event.target : null;
        const link = target?.closest<HTMLAnchorElement>(
          'a[data-type="mention"][data-id], a[href^="/page/"]'
        );
        if (!link) return;
        const pageId =
          link.dataset.id ??
          link.getAttribute("href")?.match(/^\/page\/([^/?#]+)/)?.[1] ??
          "";
        if (!pageId) return;
        event.preventDefault();
        event.stopPropagation();
        void getPageMetadata(pageId)
          .catch(() => null)
          .then((page) => {
            openPage(page ?? pageId, { source: "child-page-open" });
          });
      },
      [openPage]
    );

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

    // Reset editor content when switching pages. If a lightweight page record
    // is opened first and the full body arrives later, fill it only while the
    // editor is still empty so user typing is never overwritten.
    const appliedInitialContentRef = useRef({
      pageId,
      content: initialContent || "",
    });
    useEffect(() => {
      if (!editor) return;
      const nextContent = initialContent || "";
      const applied = appliedInitialContentRef.current;
      if (applied.pageId !== pageId) {
        flushPendingSave();
        editor.commands.setContent(nextContent);
        appliedInitialContentRef.current = { pageId, content: nextContent };
        return;
      }
      if (applied.content === nextContent) return;
      if (!applied.content && nextContent && editor.isEmpty) {
        editor.commands.setContent(nextContent);
        appliedInitialContentRef.current = { pageId, content: nextContent };
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
        {/* No static toolbar — formatting is via "/" slash commands, the
            selection bubble menu, and keyboard shortcuts (Notion-style). */}
        {!editable && (
          <div className="mb-4 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
            当前页面已锁定，解锁后才能编辑。
          </div>
        )}
        {editable && fileImportProgress && (
          <FileImportProgressBar progress={fileImportProgress} />
        )}
        <div
          className="zhinote-editor-surface"
          data-editable={editable ? "true" : "false"}
          data-code-languages={CODE_BLOCK_LANGUAGE_VALUES}
          onClickCapture={handleInternalPageLinkClick}
        >
          <BlockDragHandleLayer editor={editor} editable={editable} />
          <CodeBlockCopyLayer editor={editor} />
          <EditorBubbleMenu editor={editor} editable={editable} />
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
  onPersistContent?: (editor: TiptapEditor) => void,
  openPage?: OpenPage
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
      return createChildPageFromEditorCommand(editor, pageId, openPage);
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
  parentPageId: string,
  openPage?: OpenPage
) {
  const { createPageWithCloud, updatePageWithCloud } =
    await loadPageMutationModule();
  const page = await createPageWithCloud({
    parentId: parentPageId,
  });
  const parentPage = await getPageMetadata(parentPageId);
  const updatedPage = await updatePageWithCloud(page.id, {
    content_text: buildChildPageInitialHtml({
      parentPageId,
      parentTitle: parentPage?.title ?? null,
    }),
  });
  const pageToOpen = updatedPage ?? page;
  useWorkspaceStore.getState().upsertPages([pageToOpen]);

  editor
    .chain()
    .focus()
    .insertContent([
      {
        type: "mention",
        attrs: {
          id: page.id,
          label: page.title || "新页面",
        },
      },
      { type: "text", text: " " },
    ])
    .run();

  await updatePageWithCloud(parentPageId, { content_text: editor.getHTML() });
  await updateWikiLinks(parentPageId, getLinkedPageIds(editor));

  if (openPage) {
    openPage(pageToOpen, { source: "child-page-create" });
  } else {
    openLocalFirstPageRoute(pageToOpen, {
      source: "child-page-create",
    });
  }
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

  const { htmlToMarkdown } = await loadPageExportModule();
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
