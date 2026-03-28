import { Extension } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion from "@tiptap/suggestion";
import SlashCommandSuggestion from "./SlashCommandSuggestion";

export const SlashCommandPluginKey = new PluginKey("slashCommand");

export const SlashCommandExtension = Extension.create({
  name: "slashCommand",

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...SlashCommandSuggestion,
        pluginKey: SlashCommandPluginKey,
      }),
    ];
  },
});
