export const EDITOR_LOCAL_COMMAND_EVENT = "zhinote:editor-local-command";

export type EditorLocalCommand =
  | "block-comment"
  | "blockquote"
  | "bold"
  | "bookmark"
  | "breadcrumb"
  | "bullet-list"
  | "callout"
  | "child-page"
  | "clear-formatting"
  | "code-block"
  | "columns"
  | "copy-block-html"
  | "copy-block-link"
  | "copy-block-markdown"
  | "embed"
  | "equation"
  | "heading-1"
  | "heading-2"
  | "heading-3"
  | "horizontal-rule"
  | "inline-equation"
  | "italic"
  | "numbered-list"
  | "paragraph"
  | "strike"
  | "synced-block"
  | "table"
  | "table-of-contents"
  | "task-list"
  | "template-button"
  | "toggle-block"
  | "underline";

export function dispatchEditorLocalCommand(command: EditorLocalCommand) {
  window.dispatchEvent(
    new CustomEvent(EDITOR_LOCAL_COMMAND_EVENT, {
      detail: { command },
    })
  );
}
