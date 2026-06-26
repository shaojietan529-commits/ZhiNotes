"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useCallback, useState } from "react";
import {
  formatFileSize,
  getStoredPageFile,
  type PageFileKind,
} from "@/lib/files/localStore";

function FileEmbedComponent({ node }: NodeViewProps) {
  const fileId = String(node.attrs.fileId || "");
  const fileName = String(node.attrs.fileName || "未命名文件");
  const mimeType = String(node.attrs.mimeType || "");
  const kind = String(node.attrs.kind || "unknown") as PageFileKind;
  const size = Number(node.attrs.size || 0);
  const [expanded, setExpanded] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadFile = useCallback(async () => {
    if (!fileId) return;
    setLoading(true);
    setError("");
    try {
      const stored = await getStoredPageFile(fileId);
      if (stored) {
        setDataUrl(stored.dataUrl);
        setTextContent(stored.textContent ?? null);
        setLoading(false);
        return;
      }
      const res = await fetch("/api/files/embed-sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "pull", fileId }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          found?: boolean;
          dataUrl?: string;
          textContent?: string;
        };
        if (data.found && data.dataUrl) {
          setDataUrl(data.dataUrl);
          setTextContent(data.textContent ?? null);
        } else {
          setError("云端未找到此文件");
        }
      } else {
        setError("文件加载失败");
      }
    } catch {
      setError("文件加载失败");
    } finally {
      setLoading(false);
    }
  }, [fileId]);

  const handleToggle = useCallback(() => {
    if (!expanded) {
      setExpanded(true);
      if (!dataUrl) void loadFile();
    } else {
      setExpanded(false);
    }
  }, [expanded, dataUrl, loadFile]);

  return (
    <NodeViewWrapper data-type="file-embed">
      <div contentEditable={false} className="my-2">
        <button
          type="button"
          onClick={handleToggle}
          className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors ${
            expanded
              ? "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40"
              : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          }`}
        >
          <span className="shrink-0">{FILE_KIND_ICONS[kind] || "📎"}</span>
          <span className="font-medium text-zinc-700 dark:text-zinc-200">
            {fileName}
          </span>
          {size > 0 && (
            <span className="text-xs text-zinc-400">
              ({formatFileSize(size)})
            </span>
          )}
          <span className="ml-1 text-[11px] text-zinc-400">
            {expanded ? "▲ 收起" : "▼ 展开"}
          </span>
        </button>

        {expanded && (
          <div className="mt-2 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
            {loading && (
              <div className="flex items-center justify-center py-10 text-sm text-zinc-400">
                正在加载文件…
              </div>
            )}
            {error && (
              <div className="px-4 py-8 text-center text-sm text-red-500">
                {error}
              </div>
            )}
            {!loading &&
              !error &&
              dataUrl &&
              renderFilePreview(kind, mimeType, dataUrl, textContent, fileName)}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

function renderFilePreview(
  kind: PageFileKind,
  _mimeType: string,
  dataUrl: string,
  textContent: string | null,
  fileName: string
) {
  if (kind === "html" && textContent) {
    return (
      <iframe
        srcDoc={textContent}
        title={fileName}
        sandbox="allow-scripts"
        className="h-[500px] w-full border-0"
      />
    );
  }

  if (kind === "pdf") {
    return (
      <object
        data={dataUrl}
        type="application/pdf"
        className="h-[600px] w-full"
      >
        <div className="px-4 py-8 text-center text-sm text-zinc-400">
          浏览器无法显示 PDF，
          <a
            href={dataUrl}
            download={fileName}
            className="text-blue-500 underline"
          >
            点击下载
          </a>
        </div>
      </object>
    );
  }

  if (kind === "image") {
    return (
      // Local file embeds use data URLs; next/image does not add value here.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={dataUrl}
        alt={fileName}
        className="max-h-[600px] w-full object-contain"
      />
    );
  }

  if (kind === "audio") {
    return (
      <div className="px-4 py-4">
        <audio controls src={dataUrl} className="w-full" />
      </div>
    );
  }

  if (kind === "video") {
    return <video controls src={dataUrl} className="w-full" />;
  }

  if (textContent) {
    return (
      <pre className="max-h-96 overflow-auto whitespace-pre-wrap p-4 text-sm text-zinc-700 dark:text-zinc-300">
        {textContent}
      </pre>
    );
  }

  return (
    <div className="px-4 py-8 text-center text-sm text-zinc-400">
      此文件类型暂不支持预览，
      <a
        href={dataUrl}
        download={fileName}
        className="text-blue-500 underline"
      >
        点击下载
      </a>
    </div>
  );
}

const FILE_KIND_ICONS: Record<string, string> = {
  html: "🌐",
  markdown: "📝",
  pdf: "📄",
  image: "🖼️",
  audio: "🎵",
  video: "🎬",
  spreadsheet: "📊",
  word: "📃",
  presentation: "📽️",
  archive: "📦",
  text: "📄",
  notebook: "📓",
  epub: "📚",
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fileEmbed: {
      insertFileEmbed: (attrs: {
        fileId: string;
        fileName: string;
        mimeType: string;
        kind: string;
        size: number;
      }) => ReturnType;
    };
  }
}

export const FileEmbedNode = Node.create({
  name: "fileEmbed",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      fileId: {
        default: "",
        parseHTML: (el: HTMLElement) => el.getAttribute("data-file-id") || "",
        renderHTML: (attrs: Record<string, unknown>) => ({
          "data-file-id": attrs.fileId,
        }),
      },
      fileName: {
        default: "",
        parseHTML: (el: HTMLElement) => el.getAttribute("data-file-name") || "",
        renderHTML: (attrs: Record<string, unknown>) => ({
          "data-file-name": attrs.fileName,
        }),
      },
      mimeType: {
        default: "",
        parseHTML: (el: HTMLElement) =>
          el.getAttribute("data-mime-type") || "",
        renderHTML: (attrs: Record<string, unknown>) => ({
          "data-mime-type": attrs.mimeType,
        }),
      },
      kind: {
        default: "unknown",
        parseHTML: (el: HTMLElement) =>
          el.getAttribute("data-kind") || "unknown",
        renderHTML: (attrs: Record<string, unknown>) => ({
          "data-kind": attrs.kind,
        }),
      },
      size: {
        default: 0,
        parseHTML: (el: HTMLElement) =>
          Number(el.getAttribute("data-size")) || 0,
        renderHTML: (attrs: Record<string, unknown>) => ({
          "data-size": String(attrs.size),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="file-embed"]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const icon =
      FILE_KIND_ICONS[node.attrs.kind as string] || "📎";
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "file-embed" }),
      `${icon} ${node.attrs.fileName || "文件"}`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FileEmbedComponent);
  },

  addCommands() {
    return {
      insertFileEmbed:
        (attrs) =>
        ({ chain }) =>
          chain()
            .insertContent({ type: this.name, attrs })
            .run(),
    };
  },
});
