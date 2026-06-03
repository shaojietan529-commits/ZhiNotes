"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useState } from "react";

function EmbedComponent({ node, updateAttributes }: NodeViewProps) {
  const url = String(node.attrs.url || "");
  const caption = String(node.attrs.caption || "");
  const embedTarget = getEmbedTarget(url);
  const [previewLoaded, setPreviewLoaded] = useState(false);

  return (
    <NodeViewWrapper className="my-3" data-type="embed-block">
      <div
        className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
        contentEditable={false}
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-xs font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            {embedTarget?.label.slice(0, 3).toUpperCase() ?? "EMB"}
          </div>
          <div className="min-w-[180px] flex-1">
            <input
              value={url}
              onChange={(event) => {
                setPreviewLoaded(false);
                updateAttributes({ url: event.target.value });
              }}
              placeholder="https://..."
              className="w-full bg-transparent text-sm font-medium text-zinc-900 outline-none placeholder:text-zinc-300 dark:text-zinc-100 dark:placeholder:text-zinc-600"
            />
            <input
              value={caption}
              onChange={(event) => updateAttributes({ caption: event.target.value })}
              placeholder="Optional caption"
              className="mt-1 w-full bg-transparent text-xs text-zinc-500 outline-none placeholder:text-zinc-300 dark:text-zinc-400 dark:placeholder:text-zinc-600"
            />
          </div>
          {embedTarget && (
            <span className="rounded bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              {embedTarget.label}
            </span>
          )}
          {embedTarget && (
            <a
              href={embedTarget.openUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-500 no-underline hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              Open
            </a>
          )}
        </div>

        {!embedTarget && (
          <div className="rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:bg-zinc-800/70 dark:text-zinc-400">
            Add an http or https URL to embed.
          </div>
        )}

        {embedTarget && !previewLoaded && (
          <button
            type="button"
            onClick={() => setPreviewLoaded(true)}
            className="w-full rounded-md border border-dashed border-zinc-300 px-3 py-6 text-center text-xs font-medium text-zinc-500 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-blue-900 dark:hover:bg-blue-950/40 dark:hover:text-blue-300"
          >
            Load {embedTarget.label} preview
          </button>
        )}

        {embedTarget && previewLoaded && (
          <iframe
            src={embedTarget.previewUrl}
            title={caption || embedTarget.openUrl}
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="no-referrer"
            className="h-[480px] w-full rounded-md border border-zinc-200 bg-white dark:border-zinc-700"
          />
        )}
      </div>
    </NodeViewWrapper>
  );
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    embedBlock: {
      insertEmbed: (attrs?: { url?: string; caption?: string }) => ReturnType;
    };
  }
}

export const EmbedNode = Node.create({
  name: "embedBlock",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      url: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-url") || "",
        renderHTML: (attributes) => ({ "data-url": attributes.url }),
      },
      caption: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-caption") || "",
        renderHTML: (attributes) => ({ "data-caption": attributes.caption }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="embed-block"]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const url = String(node.attrs.url || "");
    const caption = String(node.attrs.caption || "");
    const embedTarget = getEmbedTarget(url);
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "embed-block" }),
      ["p", caption || "Embed"],
      embedTarget
        ? [
            "a",
            { href: embedTarget.openUrl, target: "_blank", rel: "noreferrer" },
            embedTarget.openUrl,
          ]
        : ["span", url],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(EmbedComponent);
  },

  addCommands() {
    return {
      insertEmbed:
        (attrs = {}) =>
        ({ chain }) =>
          chain()
            .insertContent({
              type: this.name,
              attrs: {
                url: attrs.url ?? "",
                caption: attrs.caption ?? "",
              },
            })
            .run(),
    };
  },
});

interface EmbedTarget {
  label: string;
  openUrl: string;
  previewUrl: string;
}

export function getSafeEmbedUrl(url: string) {
  return getEmbedTarget(url)?.openUrl ?? "";
}

function getEmbedTarget(url: string): EmbedTarget | null {
  const openUrl = normalizeHttpUrl(url);
  if (!openUrl) return null;

  const parsed = parseUrl(openUrl);
  if (!parsed) return { label: "Web", openUrl, previewUrl: openUrl };

  const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
  const youtubeId = getYouTubeVideoId(parsed, host);
  if (youtubeId) {
    return {
      label: "YouTube",
      openUrl,
      previewUrl: `https://www.youtube-nocookie.com/embed/${youtubeId}`,
    };
  }

  const vimeoId = getVimeoVideoId(parsed, host);
  if (vimeoId) {
    return {
      label: "Vimeo",
      openUrl,
      previewUrl: `https://player.vimeo.com/video/${vimeoId}`,
    };
  }

  const loomId = getLoomVideoId(parsed, host);
  if (loomId) {
    return {
      label: "Loom",
      openUrl,
      previewUrl: `https://www.loom.com/embed/${loomId}`,
    };
  }

  if (host === "figma.com" && /^\/(file|design|proto)\//.test(parsed.pathname)) {
    return {
      label: "Figma",
      openUrl,
      previewUrl: `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(
        openUrl
      )}`,
    };
  }

  const googleWorkspaceTarget = getGoogleWorkspaceTarget(parsed, host, openUrl);
  if (googleWorkspaceTarget) return googleWorkspaceTarget;

  const googleDriveTarget = getGoogleDriveTarget(parsed, host, openUrl);
  if (googleDriveTarget) return googleDriveTarget;

  const googleMapsTarget = getGoogleMapsTarget(parsed, host, openUrl);
  if (googleMapsTarget) return googleMapsTarget;

  const codePenTarget = getCodePenTarget(parsed, host, openUrl);
  if (codePenTarget) return codePenTarget;

  const spotifyTarget = getSpotifyTarget(parsed, host, openUrl);
  if (spotifyTarget) return spotifyTarget;

  const miroTarget = getMiroTarget(parsed, host, openUrl);
  if (miroTarget) return miroTarget;

  const canvaTarget = getCanvaTarget(parsed, host, openUrl);
  if (canvaTarget) return canvaTarget;

  const formTarget = getFormEmbedTarget(parsed, host, openUrl);
  if (formTarget) return formTarget;

  if (host.endsWith(".streamlit.app") || host === "streamlit.app") {
    return { label: "Streamlit", openUrl, previewUrl: openUrl };
  }

  return { label: "Web", openUrl, previewUrl: openUrl };
}

function normalizeHttpUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return "";
}

function parseUrl(url: string) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function getYouTubeVideoId(url: URL, host: string) {
  if (host === "youtu.be") {
    return sanitizeEmbedId(url.pathname.split("/").filter(Boolean)[0]);
  }
  if (!["youtube.com", "youtube-nocookie.com", "m.youtube.com"].includes(host)) {
    return "";
  }
  if (url.pathname === "/watch") {
    return sanitizeEmbedId(url.searchParams.get("v") ?? "");
  }
  const parts = url.pathname.split("/").filter(Boolean);
  if (["embed", "shorts", "live"].includes(parts[0])) {
    return sanitizeEmbedId(parts[1]);
  }
  return "";
}

function getVimeoVideoId(url: URL, host: string) {
  if (host === "player.vimeo.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "video") return sanitizeEmbedId(parts[1]);
  }
  if (host !== "vimeo.com") return "";
  return sanitizeEmbedId(url.pathname.split("/").filter(Boolean)[0]);
}

function getLoomVideoId(url: URL, host: string) {
  if (host !== "loom.com") return "";
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] === "share" || parts[0] === "embed") {
    return sanitizeEmbedId(parts[1]);
  }
  return "";
}

function getGoogleWorkspaceTarget(url: URL, host: string, openUrl: string): EmbedTarget | null {
  if (host !== "docs.google.com") return null;
  const parts = url.pathname.split("/").filter(Boolean);
  const product = parts[0];
  const id = product === "forms" ? getGoogleFormId(parts) : getGoogleDocumentId(parts);
  if (!id) return null;

  if (product === "document") {
    return {
      label: "Google Docs",
      openUrl,
      previewUrl: `https://docs.google.com/document/d/${id}/preview`,
    };
  }

  if (product === "spreadsheets") {
    return {
      label: "Google Sheets",
      openUrl,
      previewUrl: `https://docs.google.com/spreadsheets/d/${id}/preview`,
    };
  }

  if (product === "presentation") {
    return {
      label: "Google Slides",
      openUrl,
      previewUrl: `https://docs.google.com/presentation/d/${id}/embed`,
    };
  }

  if (product === "forms") {
    return {
      label: "Google Forms",
      openUrl,
      previewUrl: `https://docs.google.com/forms/d/${id}/viewform?embedded=true`,
    };
  }

  return null;
}

function getGoogleDriveTarget(url: URL, host: string, openUrl: string): EmbedTarget | null {
  if (host !== "drive.google.com") return null;
  const parts = url.pathname.split("/").filter(Boolean);
  let id = "";

  if (parts[0] === "file" && parts[1] === "d") {
    id = sanitizeLooseEmbedId(parts[2]);
  } else if (url.searchParams.has("id")) {
    id = sanitizeLooseEmbedId(url.searchParams.get("id") ?? "");
  }

  if (!id) return null;
  return {
    label: "Google Drive",
    openUrl,
    previewUrl: `https://drive.google.com/file/d/${id}/preview`,
  };
}

function getGoogleMapsTarget(url: URL, host: string, openUrl: string): EmbedTarget | null {
  const isGoogleMapsHost = host === "maps.google.com" || host === "google.com";
  if (!isGoogleMapsHost || !url.pathname.startsWith("/maps")) return null;
  return {
    label: "Google Maps",
    openUrl,
    previewUrl: withQueryParam(openUrl, "output", "embed"),
  };
}

function getCodePenTarget(url: URL, host: string, openUrl: string): EmbedTarget | null {
  if (host !== "codepen.io") return null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[1] === "embed") {
    return { label: "CodePen", openUrl, previewUrl: openUrl };
  }

  if (!["pen", "full", "details"].includes(parts[1])) return null;
  const user = sanitizeLooseEmbedId(parts[0]);
  const penId = sanitizeLooseEmbedId(parts[2]);
  if (!user || !penId) return null;

  return {
    label: "CodePen",
    openUrl,
    previewUrl: `https://codepen.io/${user}/embed/${penId}?default-tab=result`,
  };
}

function getSpotifyTarget(url: URL, host: string, openUrl: string): EmbedTarget | null {
  if (host !== "open.spotify.com") return null;
  const [type, rawId] = url.pathname.split("/").filter(Boolean);
  const supportedTypes = new Set(["album", "artist", "episode", "playlist", "show", "track"]);
  const id = sanitizeLooseEmbedId(rawId);
  if (!supportedTypes.has(type) || !id) return null;

  return {
    label: "Spotify",
    openUrl,
    previewUrl: `https://open.spotify.com/embed/${type}/${id}`,
  };
}

function getMiroTarget(url: URL, host: string, openUrl: string): EmbedTarget | null {
  if (host !== "miro.com") return null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] !== "app") return null;

  if (parts[1] === "live-embed" && sanitizeLooseEmbedId(parts[2])) {
    return { label: "Miro", openUrl, previewUrl: openUrl };
  }

  if (parts[1] !== "board") return null;
  const boardId = sanitizeLooseEmbedId(parts[2]);
  if (!boardId) return null;
  return {
    label: "Miro",
    openUrl,
    previewUrl: `https://miro.com/app/live-embed/${boardId}/?embedMode=view_only_without_ui`,
  };
}

function getCanvaTarget(url: URL, host: string, openUrl: string): EmbedTarget | null {
  if (host !== "canva.com") return null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] !== "design") return null;
  const designId = sanitizeLooseEmbedId(parts[1]);
  if (!designId) return null;
  return {
    label: "Canva",
    openUrl,
    previewUrl: `https://www.canva.com/design/${designId}/view?embed`,
  };
}

function getFormEmbedTarget(url: URL, host: string, openUrl: string): EmbedTarget | null {
  const parts = url.pathname.split("/").filter(Boolean);

  if (host === "tally.so") {
    const id = sanitizeLooseEmbedId(parts[1]);
    if ((parts[0] === "r" || parts[0] === "embed") && id) {
      return {
        label: "Tally",
        openUrl,
        previewUrl: `https://tally.so/embed/${id}?alignLeft=1&hideTitle=1&transparentBackground=1`,
      };
    }
  }

  if (host === "form.typeform.com" || host.endsWith(".typeform.com")) {
    const id = sanitizeLooseEmbedId(parts[1]);
    if (parts[0] === "to" && id) {
      return {
        label: "Typeform",
        openUrl,
        previewUrl: `https://form.typeform.com/to/${id}`,
      };
    }
  }

  return null;
}

function getGoogleDocumentId(parts: string[]) {
  const dIndex = parts.indexOf("d");
  const rawId = dIndex >= 0 ? parts[dIndex + 1] : "";
  return sanitizeLooseEmbedId(rawId);
}

function getGoogleFormId(parts: string[]) {
  const dIndex = parts.indexOf("d");
  if (dIndex < 0) return "";
  const rawId = parts[dIndex + 1] === "e" ? parts[dIndex + 2] : parts[dIndex + 1];
  return sanitizeLooseEmbedId(rawId);
}

function sanitizeEmbedId(value?: string) {
  return value && /^[\w-]+$/.test(value) ? value : "";
}

function sanitizeLooseEmbedId(value?: string) {
  return value && /^[\w=-]+$/.test(value) ? value : "";
}

function withQueryParam(url: string, key: string, value: string) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set(key, value);
    return parsed.toString();
  } catch {
    return url;
  }
}
