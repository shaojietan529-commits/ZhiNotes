"use client";

import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { getPage } from "@/lib/db/local/queries";
import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";

const PAGE_LINK_RE = /\/page\/([a-zA-Z0-9_-]+)(?:[?#].*)?$/;

function extractPageId(text: string): string | null {
  const m = text.trim().match(PAGE_LINK_RE);
  return m ? m[1] : null;
}

type PasteFormat = "mention" | "url" | "text";

interface PasteAsMenuProps {
  x: number;
  y: number;
  pageId: string;
  onSelect: (format: PasteFormat, pageTitle: string) => void;
  onDismiss: () => void;
}

function PasteAsMenu({
  x,
  y,
  pageId,
  onSelect,
  onDismiss,
}: PasteAsMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pageTitle, setPageTitle] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getPage(pageId).then((page) => {
      if (cancelled) return;
      setPageTitle(page?.title || "未命名页面");
    });
    return () => {
      cancelled = true;
    };
  }, [pageId]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onDismiss();
      }
    };
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onDismiss();
      }
    };
    window.addEventListener("keydown", handleKey, true);
    window.addEventListener("mousedown", handleClick, true);
    return () => {
      window.removeEventListener("keydown", handleKey, true);
      window.removeEventListener("mousedown", handleClick, true);
    };
  }, [onDismiss]);

  const select = useCallback(
    (fmt: PasteFormat) => {
      onSelect(fmt, pageTitle || "未命名页面");
    },
    [onSelect, pageTitle]
  );

  const top = y;
  const left = x;

  return (
    <div
      ref={ref}
      className="fixed z-[9999] min-w-[160px] overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
      style={{ top, left }}
    >
      <div className="px-3 py-1.5 text-[11px] font-medium text-zinc-400">
        粘贴为
      </div>
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-zinc-700 transition-colors hover:bg-blue-50 dark:text-zinc-200 dark:hover:bg-zinc-700"
        onClick={() => select("mention")}
      >
        <span className="text-base">📄</span>
        <span>页面引用</span>
        {pageTitle && (
          <span className="ml-auto max-w-[120px] truncate text-xs text-zinc-400">
            {pageTitle}
          </span>
        )}
      </button>
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-zinc-700 transition-colors hover:bg-blue-50 dark:text-zinc-200 dark:hover:bg-zinc-700"
        onClick={() => select("url")}
      >
        <span className="text-base">🔗</span>
        <span>URL</span>
      </button>
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-zinc-700 transition-colors hover:bg-blue-50 dark:text-zinc-200 dark:hover:bg-zinc-700"
        onClick={() => select("text")}
      >
        <span className="text-base">T</span>
        <span>纯文字</span>
      </button>
    </div>
  );
}

export const PastePageLink = Extension.create({
  name: "pastePageLink",

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      new Plugin({
        props: {
          handlePaste: (view, event) => {
            const text =
              event.clipboardData?.getData("text/plain")?.trim() ?? "";
            const pageId = extractPageId(text);
            if (!pageId) return false;

            event.preventDefault();

            const { from } = view.state.selection;
            const coords = view.coordsAtPos(from);
            const x = coords.left;
            const y = coords.bottom + 4;

            const container = document.createElement("div");
            document.body.appendChild(container);
            let root: Root | null = null;

            const cleanup = () => {
              if (root) {
                root.unmount();
                root = null;
              }
              container.remove();
              editor.view.focus();
            };

            const handleSelect = (format: PasteFormat, pageTitle: string) => {
              cleanup();

              if (format === "mention") {
                editor
                  .chain()
                  .focus()
                  .insertContent({
                    type: "mention",
                    attrs: { id: pageId, label: pageTitle },
                  })
                  .run();
              } else if (format === "url") {
                editor
                  .chain()
                  .focus()
                  .insertContent({
                    type: "text",
                    text,
                    marks: [
                      {
                        type: "link",
                        attrs: { href: `/page/${pageId}`, target: null },
                      },
                    ],
                  })
                  .run();
              } else {
                editor.chain().focus().insertContent(text).run();
              }
            };

            root = createRoot(container);
            root.render(
              <PasteAsMenu
                x={x}
                y={y}
                pageId={pageId}
                onSelect={handleSelect}
                onDismiss={() => {
                  cleanup();
                  editor.chain().focus().insertContent(text).run();
                }}
              />
            );

            return true;
          },
        },
      }),
    ];
  },
});
