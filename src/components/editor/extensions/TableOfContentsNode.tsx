"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useEffect, useState } from "react";

interface TocHeading {
  level: number;
  text: string;
  index: number;
}

function collectHeadings(editor: NodeViewProps["editor"]): TocHeading[] {
  const headings: TocHeading[] = [];

  editor.state.doc.descendants((node) => {
    if (node.type.name !== "heading") return;
    const text = node.textContent.trim();
    if (!text) return;
    headings.push({
      level: Number(node.attrs.level ?? 1),
      text,
      index: headings.length,
    });
  });

  return headings;
}

function TableOfContentsComponent({ editor }: NodeViewProps) {
  const [headings, setHeadings] = useState<TocHeading[]>([]);

  useEffect(() => {
    let active = true;

    const refresh = () => {
      if (!active) return;
      setHeadings(collectHeadings(editor));
    };

    queueMicrotask(refresh);
    editor.on("update", refresh);
    editor.on("transaction", refresh);

    return () => {
      active = false;
      editor.off("update", refresh);
      editor.off("transaction", refresh);
    };
  }, [editor]);

  const scrollToHeading = (index: number) => {
    const headingElements = editor.view.dom.querySelectorAll("h1, h2, h3");
    headingElements[index]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <NodeViewWrapper className="my-4" data-type="toc-block">
      <nav
        className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900"
        contentEditable={false}
      >
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
          目录
        </div>
        {headings.length === 0 ? (
          <p className="text-sm text-zinc-400">添加标题后会自动生成目录。</p>
        ) : (
          <div className="space-y-1">
            {headings.map((heading) => (
              <button
                key={`${heading.index}-${heading.text}`}
                type="button"
                onClick={() => scrollToHeading(heading.index)}
                className="block w-full truncate rounded px-2 py-1 text-left text-sm text-zinc-600 hover:bg-white hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                style={{ paddingLeft: `${(heading.level - 1) * 14 + 8}px` }}
              >
                {heading.text}
              </button>
            ))}
          </div>
        )}
      </nav>
    </NodeViewWrapper>
  );
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    tableOfContentsBlock: {
      insertTableOfContents: () => ReturnType;
    };
  }
}

export const TableOfContentsNode = Node.create({
  name: "tableOfContentsBlock",
  group: "block",
  atom: true,
  draggable: true,

  parseHTML() {
    return [{ tag: 'div[data-type="toc-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "toc-block" }),
      ["p", "目录"],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TableOfContentsComponent);
  },

  addCommands() {
    return {
      insertTableOfContents:
        () =>
        ({ chain }) =>
          chain()
            .insertContent({
              type: this.name,
            })
            .run(),
    };
  },
});
