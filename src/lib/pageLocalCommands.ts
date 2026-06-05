export const PAGE_LOCAL_COMMAND_EVENT = "zhinote:page-local-command";

export type PageLocalCommand =
  | "copy-html"
  | "copy-link"
  | "copy-markdown"
  | "history"
  | "info"
  | "print-pdf";

export function dispatchPageLocalCommand(command: PageLocalCommand) {
  window.dispatchEvent(
    new CustomEvent(PAGE_LOCAL_COMMAND_EVENT, {
      detail: { command },
    })
  );
}
