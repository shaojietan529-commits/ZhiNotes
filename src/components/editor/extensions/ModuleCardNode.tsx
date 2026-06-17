"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import {
  NodeViewContent,
  ReactNodeViewRenderer,
  NodeViewWrapper,
} from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useState } from "react";
import IconPicker from "@/components/shared/IconPicker";

// A free-form "module card": a self-contained block with an icon, a title,
// a color tone, and a body that holds any rich content (text, lists, images,
// nested blocks via slash commands). Cards can be placed side by side with
// the 双栏/多栏 layout to compose a page out of modules.

const MODULE_TONES = {
  neutral: {
    label: "灰",
    card: "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900",
    header: "bg-zinc-50 dark:bg-zinc-800/60",
    swatch: "bg-zinc-300 dark:bg-zinc-600",
  },
  blue: {
    label: "蓝",
    card: "border-blue-200 bg-blue-50/40 dark:border-blue-900 dark:bg-blue-950/30",
    header: "bg-blue-100/70 dark:bg-blue-900/40",
    swatch: "bg-blue-400",
  },
  green: {
    label: "绿",
    card: "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/30",
    header: "bg-emerald-100/70 dark:bg-emerald-900/40",
    swatch: "bg-emerald-400",
  },
  amber: {
    label: "黄",
    card: "border-amber-200 bg-amber-50/40 dark:border-amber-900 dark:bg-amber-950/30",
    header: "bg-amber-100/70 dark:bg-amber-900/40",
    swatch: "bg-amber-400",
  },
  red: {
    label: "红",
    card: "border-red-200 bg-red-50/40 dark:border-red-900 dark:bg-red-950/30",
    header: "bg-red-100/70 dark:bg-red-900/40",
    swatch: "bg-red-400",
  },
  purple: {
    label: "紫",
    card: "border-purple-200 bg-purple-50/40 dark:border-purple-900 dark:bg-purple-950/30",
    header: "bg-purple-100/70 dark:bg-purple-900/40",
    swatch: "bg-purple-400",
  },
} as const;

type ModuleTone = keyof typeof MODULE_TONES;
const TONE_ORDER = Object.keys(MODULE_TONES) as ModuleTone[];

function isModuleTone(value: unknown): value is ModuleTone {
  return typeof value === "string" && value in MODULE_TONES;
}

function ModuleCardComponent({
  node,
  updateAttributes,
  editor,
}: NodeViewProps) {
  const tone = isModuleTone(node.attrs.tone) ? node.attrs.tone : "neutral";
  const icon = String(node.attrs.icon || "📦");
  const title = String(node.attrs.title || "");
  const toneStyle = MODULE_TONES[tone];
  const editable = editor.isEditable;
  const [tonePickerOpen, setTonePickerOpen] = useState(false);

  return (
    <NodeViewWrapper className="my-3" data-type="module-card">
      <div className={`overflow-hidden rounded-xl border ${toneStyle.card}`}>
        {/* Header: icon + title + color control */}
        <div
          className={`flex items-center gap-2 px-3 py-2 ${toneStyle.header}`}
          contentEditable={false}
        >
          {editable ? (
            <IconPicker
              currentIcon={icon}
              onSelect={(value) => updateAttributes({ icon: value })}
            />
          ) : (
            <span className="text-2xl">{icon}</span>
          )}

          <input
            value={title}
            onChange={(event) =>
              updateAttributes({ title: event.target.value })
            }
            placeholder="模块标题"
            readOnly={!editable}
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-zinc-800 outline-none placeholder:font-normal placeholder:text-zinc-400 dark:text-zinc-100"
          />

          {editable && (
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setTonePickerOpen((open) => !open)}
                className={`h-5 w-5 rounded-full ring-1 ring-black/5 ${toneStyle.swatch}`}
                title="模块颜色"
                aria-label="模块颜色"
              />
              {tonePickerOpen && (
                <div className="absolute right-0 top-7 z-50 flex gap-1 rounded-lg border border-zinc-200 bg-white p-1.5 shadow-xl dark:border-zinc-700 dark:bg-zinc-800">
                  {TONE_ORDER.map((toneKey) => (
                    <button
                      key={toneKey}
                      type="button"
                      onClick={() => {
                        updateAttributes({ tone: toneKey });
                        setTonePickerOpen(false);
                      }}
                      className={`h-5 w-5 rounded-full ${MODULE_TONES[toneKey].swatch} ${
                        tone === toneKey
                          ? "ring-2 ring-zinc-900 ring-offset-1 dark:ring-zinc-100"
                          : "ring-1 ring-black/5"
                      }`}
                      title={MODULE_TONES[toneKey].label}
                      aria-label={MODULE_TONES[toneKey].label}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Body: free editable content */}
        <NodeViewContent className="px-3 py-2.5 text-sm leading-6 outline-none [&>:first-child]:mt-0 [&>:last-child]:mb-0" />
      </div>
    </NodeViewWrapper>
  );
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    moduleCard: {
      insertModuleCard: (attrs?: {
        icon?: string;
        title?: string;
        tone?: string;
      }) => ReturnType;
    };
  }
}

export const ModuleCardNode = Node.create({
  name: "moduleCard",
  group: "block",
  content: "block+",
  draggable: true,

  addAttributes() {
    return {
      icon: {
        default: "📦",
        parseHTML: (element) => element.getAttribute("data-icon") || "📦",
        renderHTML: (attributes) => ({ "data-icon": attributes.icon }),
      },
      title: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-title") || "",
        renderHTML: (attributes) => ({ "data-title": attributes.title }),
      },
      tone: {
        default: "neutral",
        parseHTML: (element) => element.getAttribute("data-tone") || "neutral",
        renderHTML: (attributes) => ({ "data-tone": attributes.tone }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="module-card"]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "module-card" }),
      [
        "div",
        { "data-module-header": "" },
        ["span", { "data-module-icon": "" }, node.attrs.icon],
        ["span", { "data-module-title": "" }, node.attrs.title || ""],
      ],
      ["div", { "data-module-content": "" }, 0],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ModuleCardComponent);
  },

  addCommands() {
    return {
      insertModuleCard:
        (attrs) =>
        ({ chain }) =>
          chain()
            .insertContent({
              type: this.name,
              attrs: {
                icon: attrs?.icon ?? "📦",
                title: attrs?.title ?? "",
                tone: attrs?.tone ?? "neutral",
              },
              content: [{ type: "paragraph" }],
            })
            .run(),
    };
  },
});
