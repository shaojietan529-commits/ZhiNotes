import type { Editor } from "@tiptap/core";

export function promptForLink(editor: Editor) {
  const previousUrl = String(editor.getAttributes("link").href ?? "");
  const value = window.prompt("Link URL:", previousUrl);
  if (value === null) return true;

  const trimmed = value.trim();
  if (!trimmed) {
    return editor.chain().focus().extendMarkRange("link").unsetLink().run();
  }

  const href = normalizeLinkHref(trimmed);
  if (!href) {
    window.alert("Please use a safe web, mail, anchor, or local page URL.");
    return true;
  }

  const { empty } = editor.state.selection;
  if (empty && !editor.isActive("link")) {
    return editor
      .chain()
      .focus()
      .insertContent({
        type: "text",
        text: trimmed,
        marks: [
          {
            type: "link",
            attrs: {
              href,
              target: null,
            },
          },
        ],
      })
      .run();
  }

  return editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
}

export function normalizeLinkHref(value: string) {
  if (/\s/.test(value)) return null;
  if (/^(https?:|mailto:|#|\/)/i.test(value)) return value;
  if (/^[a-z0-9.-]+\.[a-z]{2,}([/?#].*)?$/i.test(value)) {
    return `https://${value}`;
  }
  return null;
}
