"use client";

import { ReactRenderer } from "@tiptap/react";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import { type SuggestionOptions } from "@tiptap/suggestion";
import WikiLinkList, { type WikiLinkListRef } from "./WikiLinkList";
import { searchPages, listRecentPageMetadata } from "@/lib/db/local/queries";
import type { Page } from "@/lib/utils/types";

const WikiLinkSuggestion: Omit<SuggestionOptions<Page>, "editor"> = {
  char: "//",
  allowSpaces: true,

  items: async ({ query }) => {
    if (query.length === 0) {
      // Show recent pages when no query
      return await listRecentPageMetadata(8);
    }
    return await searchPages(query);
  },

  render: () => {
    let component: ReactRenderer<WikiLinkListRef> | null = null;
    let popup: TippyInstance[] | null = null;

    return {
      onStart: (props) => {
        component = new ReactRenderer(WikiLinkList, {
          props: {
            items: props.items,
            command: props.command,
          },
          editor: props.editor,
        });

        if (!props.clientRect) return;

        popup = tippy("body", {
          getReferenceClientRect: props.clientRect as () => DOMRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: "manual",
          placement: "bottom-start",
          maxWidth: "360px",
        });
      },

      onUpdate(props) {
        component?.updateProps({
          items: props.items,
          command: props.command,
        });

        if (popup && props.clientRect) {
          popup[0].setProps({
            getReferenceClientRect: props.clientRect as () => DOMRect,
          });
        }
      },

      onKeyDown(props) {
        if (props.event.key === "Escape") {
          popup?.[0]?.hide();
          return true;
        }
        return component?.ref?.onKeyDown(props.event) ?? false;
      },

      onExit() {
        popup?.[0]?.destroy();
        component?.destroy();
      },
    };
  },
};

export default WikiLinkSuggestion;
