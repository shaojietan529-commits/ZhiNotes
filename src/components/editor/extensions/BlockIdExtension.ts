import { Extension } from "@tiptap/core";

export const BLOCK_ID_TYPES = [
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "taskList",
  "blockquote",
  "codeBlock",
  "horizontalRule",
  "table",
  "image",
  "inlineDatabase",
  "filePreview",
  "toggleBlock",
  "calloutBlock",
  "tableOfContentsBlock",
  "columnLayout",
  "bookmarkBlock",
  "equationBlock",
  "templateButton",
  "breadcrumbBlock",
  "syncedBlock",
  "embedBlock",
];

export const BlockIdExtension = Extension.create({
  name: "blockId",

  addGlobalAttributes() {
    return [
      {
        types: BLOCK_ID_TYPES,
        attributes: {
          blockId: {
            default: null,
            parseHTML: (element) => element.getAttribute("data-block-id"),
            renderHTML: (attributes) => {
              if (!attributes.blockId) return {};
              return {
                "data-block-id": attributes.blockId,
                id: attributes.blockId,
              };
            },
          },
        },
      },
    ];
  },
});
